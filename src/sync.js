// ---- src/sync.js ----
// The schedule lives on the Quadra Pass, and only there: Orbit Class is
// Quadra's related service, and signing in with a pass is required
// (src/quadra.mjs, the shared kit, shows the sign-in). The pass's Orbit data
// is the same compressed v2 backup string editor-backup.js produces, so every
// device signed in with the pass gets the same schedule. The copy in this
// device's storage is only a cache of the pass's: on opening, the pass's
// copy wins.
//
// Sharing: the pass that made a schedule is the only one that edits it. Its
// owner makes a key (8 characters, valid a day); another pass that enters it
// gets its own copy of the schedule, to edit as it likes.
//
// The export names below are the ones the rest of the app has always
// imported from here.
import { state } from './state.js';
import {
  applyEditorSettingsData,
  decodeTransferData,
  encodeTransferData,
  isEditorDirty,
  normalizeSettingsData
} from './editor-backup.js';
import { setStatusText } from './editor-core.js';
import { hasSavedSchedule } from './data.js';
import { t } from './strings.js';
import {
  quadraSession,
  accountSheet,
  errorText,
  detectLang,
  activityPatch,
  setting,
  taipeiDay,
  notify,
  schedulePush
} from './quadra.mjs';

const lang = detectLang();
const q = quadraSession('orbit', { lang });
// What older versions kept on the device (sync codes, backups): gone.
const OLD_KEYS = [
  'orbitSyncCode',
  'orbitSyncManagerPasscode',
  'orbitSyncLastUpdateTime',
  'orbitSyncProjectId',
  'orbitSyncRole',
  'orbitSyncKeepLocalStyle',
  'orbitSyncLastKnownStyle',
  'orbitSyncStyleBackup',
  'orbitSyncScheduleBackup'
];
try {
  for (const key of OLD_KEYS) localStorage.removeItem(key);
} catch {
  // Storage unavailable: nothing to clean.
}

function isSyncConfigured() {
  return Boolean(q.pass);
}
// Kept for the modules that ask: nobody views someone else's schedule now.
function isSyncViewer() {
  return false;
}
function getSyncKeepLocalStyle() {
  return false;
}
function setSyncStatusUi(message, isError) {
  setStatusText('sync-status', message, isError);
}
const failText = error => errorText(error, lang) || error?.message || String(error);

// ---- Reading and writing the schedule ------------------------------------------------
//
// Never save over something newer. `base` is the pass's copy as this device
// last saw it (read or written). A device uploads only its own saved edits
// (`localDirty`), and only while the pass still holds `base`: when another
// device changed it meanwhile, the pass's copy is kept and this device's
// change is set aside (orbitSetAside) instead of wiping the newer one. It
// used to push whatever it had before pulling, so a device left open with
// an older schedule overwrote the newer one when it came back.

let lastPayload = null;
let base = null; // null: the pass's copy not seen yet this session
let localDirty = false;
let unreadable = false;
let chain = Promise.resolve();
const serial = fn => (chain = chain.then(fn, fn));
const SET_ASIDE_KEY = 'orbitSetAside';

async function applyPayload(payload, message) {
  if (!payload || payload === lastPayload) return false;
  let decoded;
  try {
    decoded = normalizeSettingsData(await decodeTransferData(payload), { requireMarker: true });
  } catch (error) {
    // A copy on the pass that can't be read is never saved over.
    unreadable = true;
    throw error;
  }
  unreadable = false;
  lastPayload = payload;
  if (JSON.stringify(decoded) === JSON.stringify(state.applicationData)) return false;
  if (isEditorDirty()) {
    lastPayload = null;
    return false;
  }
  applyEditorSettingsData(decoded, { statusMessage: message, fromSync: true });
  return true;
}
// The pass's copy, read now: applied, and remembered as `base`.
async function readPass() {
  const res = await q.read({ data: true, inbox: true });
  const applied = await absorbInbox(res.inbox);
  if (applied) return { applied: true };
  const remote = res.payload || '';
  // An edit made here on top of a copy that's since changed (or one never
  // seen, when the device was offline): conflict, never a silent overwrite.
  if (localDirty && remote && remote !== base) return { conflict: remote };
  const done = remote ? await applyPayload(remote, t('sync.syncedFromOtherDevice')) : false;
  base = remote;
  return { applied: done };
}
// This device's change lost to a newer one on the pass: kept aside on the
// device (the newest ten), and the pass's copy shown.
async function setAside(remote) {
  try {
    const kept = JSON.parse(localStorage.getItem(SET_ASIDE_KEY) || '[]');
    kept.push({ t: Date.now(), payload: await encodeTransferData(state.applicationData) });
    localStorage.setItem(SET_ASIDE_KEY, JSON.stringify(kept.slice(-10)));
  } catch {
    // Storage full: the pass's newer copy still wins.
  }
  localDirty = false;
  lastPayload = null;
  base = remote;
  await applyPayload(remote, t('sync.newerElsewhere'));
  setSyncStatusUi(t('sync.newerElsewhere'), true);
}

// Uploads this device's saved schedule (never an unsaved editor draft) to
// the pass: called after a real local save, marking it as one.
function pushSyncSnapshot({ mine = true } = {}) {
  if (mine) localDirty = true;
  return serial(async () => {
    if (!q.pass || !localDirty) return { ok: true, pushed: false };
    try {
      if (!q.active) return { ok: true, pushed: false };
      // Check the pass first: never over a copy changed elsewhere, one this
      // device hasn't seen, or one it can't read.
      const seen = await readPass();
      if (seen.conflict !== undefined) {
        await setAside(seen.conflict);
        return { ok: true, pushed: false };
      }
      if (unreadable)
        return { ok: false, error: t('sync.uploadFailed', { message: 'unreadable' }) };
      const payload = await encodeTransferData(state.applicationData);
      if (payload === base) {
        localDirty = false;
        return { ok: true, pushed: false };
      }
      await q.write({ payload });
      lastPayload = payload;
      base = payload;
      localDirty = false;
      countToday('edit');
      return { ok: true, pushed: true };
    } catch (error) {
      if (error.code === 'ECO_SESSION_MOVED') return { ok: true, pushed: false };
      return { ok: false, error: t('sync.uploadFailed', { message: failText(error) }) };
    }
  });
}

// Picks up changes made on another device.
function pullSyncSnapshot() {
  return serial(async () => {
    if (!q.pass) return { ok: true, applied: false };
    try {
      const seen = await readPass();
      if (seen.conflict !== undefined) {
        await setAside(seen.conflict);
        return { ok: true, applied: true };
      }
      return { ok: true, applied: seen.applied };
    } catch (error) {
      return { ok: false, error: t('sync.downloadFailed', { message: failText(error) }) };
    }
  });
}

// A schedule merged into the pass waits in its inbox: the newest becomes
// this pass's schedule.
async function absorbInbox(inbox = []) {
  if (!inbox?.length) return false;
  const newest = inbox[inbox.length - 1];
  const applied = await applyPayload(newest.payload, t('quadra.merged'));
  for (const item of inbox) await q.dropInbox(item.id).catch(() => {});
  lastPayload = null;
  if (applied) {
    const payload = await encodeTransferData(state.applicationData);
    await q.write({ payload });
    lastPayload = payload;
    base = payload;
    localDirty = false;
  }
  return applied;
}

// ---- Start: sign in, then keep in step ---------------------------------------------------

let started = false;
let ready = null;
const whenReady = () => ready || Promise.resolve();
function startQuadra() {
  ready ||= startQuadraOnce();
  return ready;
}
async function startQuadraOnce() {
  started = true;
  const first = await q.start({ data: true });
  renderSyncPanel();
  if (!q.pass) return;
  try {
    // The pass's copy wins over this device's; a device's schedule goes up
    // only when the pass has none yet.
    if (first?.inbox?.length) await serial(() => absorbInbox(first.inbox));
    else if (first?.payload)
      await serial(async () => {
        await applyPayload(first.payload, t('sync.syncedFromOtherDevice'));
        base = first.payload;
      });
    else if (!first?.offline && 'payload' in (first || {})) {
      base = '';
      if (hasSavedSchedule()) await pushSyncSnapshot();
    }
  } catch (error) {
    setSyncStatusUi(t('sync.downloadFailed', { message: failText(error) }), true);
  }
  renderSyncPanel();
  countToday('open');
}

// What Orbit Class was used for today, on the pass (act:orbit): Quadra
// Rewards' daily Orbit mission reads it. Opened counts once a day.
function countToday(action) {
  if (!q.pass || !q.active) return;
  const had = setting(q.wallet, 'act:orbit', null);
  if (action === 'open' && had?.day === taipeiDay() && had.n?.open) return;
  q.write({ wallet: activityPatch(q.wallet, 'orbit', action) }).catch(() => {});
}

// Checks when the app comes back on screen or is used (at most every few
// seconds), never on a timer while nobody is looking.
const ACTIVITY_SYNC_THROTTLE_MS = 8000;
let lastCheck = 0;
async function syncTick() {
  if (!q.pass || !navigator.onLine || document.hidden || isEditorDirty()) return false;
  lastCheck = Date.now();
  // Newer copies first; then this device's own edit, if one hasn't gone up.
  const pulled = await pullSyncSnapshot();
  if (!pulled.ok) setSyncStatusUi(pulled.error, true);
  if (localDirty) {
    const pushed = await pushSyncSnapshot({ mine: false });
    if (pushed && !pushed.ok) setSyncStatusUi(pushed.error, true);
  }
  return Boolean(pulled.applied);
}
let loopStarted = false;
function startSyncLoop() {
  if (loopStarted) return;
  loopStarted = true;
  startQuadra();
  for (const type of ['click', 'keydown', 'touchstart']) {
    document.addEventListener(
      type,
      () => Date.now() - lastCheck > ACTIVITY_SYNC_THROTTLE_MS && started && syncTick(),
      { passive: true }
    );
  }
  document.addEventListener(
    'visibilitychange',
    () => document.visibilityState === 'visible' && started && syncTick()
  );
  q.on('active', live => live && (syncTick(), countToday('open')));
}

// The pass's session token for Orbit's AI requests (the Worker needs one).
async function sessionUrl(url) {
  const token = await q.ensureToken().catch(() => '');
  if (!token) return url;
  return `${url}${url.includes('?') ? '&' : '?'}qt=${encodeURIComponent(token)}`;
}

// ---- Sharing ------------------------------------------------------------------------------

let shared = null;
async function createShareKey() {
  try {
    await pushSyncSnapshot({ mine: false });
    shared = await q.op('share-create');
    renderSyncPanel();
  } catch (error) {
    setSyncStatusUi(failText(error), true);
  }
}
async function redeemKey() {
  const input = document.getElementById('quadra-key');
  const key = String(input?.value || '').trim();
  if (!key) return setSyncStatusUi(t('quadra.enterKey'), true);
  try {
    const res = await q.op('share-redeem', { key });
    if (res.own) return setSyncStatusUi(t('quadra.ownKey'), true);
    const next = normalizeSettingsData(await decodeTransferData(res.payload), {
      requireMarker: true
    });
    applyEditorSettingsData(next, { statusMessage: t('quadra.copied') });
    if (input) input.value = '';
  } catch (error) {
    setSyncStatusUi(
      error.code === 'ECO_SHARE_NOT_FOUND' ? t('quadra.keyNotFound') : failText(error),
      true
    );
  }
}
async function copyKey() {
  try {
    await navigator.clipboard.writeText(shared?.key || '');
    setSyncStatusUi(t('quadra.keyCopied'));
  } catch {
    // Clipboard blocked: the key is on screen to copy by hand.
  }
}

// ---- The panel (the transfer sheet's first section) -----------------------------------------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of [].concat(children)) if (child != null && child !== false) node.append(child);
  return node;
}
const btn = (text, onclick, primary = false) =>
  el('button', {
    type: 'button',
    class: `settings-transfer-btn${primary ? ' primary' : ''}`,
    text,
    onclick
  });

// The panel is built once per change of its own state (a new key), never on
// a background refresh: what's typed and what's open stay as they are.
function keepTyped(box) {
  const typed = {};
  for (const input of box.querySelectorAll('input')) if (input.id) typed[input.id] = input.value;
  const focused = document.activeElement?.id;
  return () => {
    for (const [id, value] of Object.entries(typed)) {
      const input = document.getElementById(id);
      if (input && value) input.value = value;
    }
    if (focused && box.querySelector(`#${focused}`)) document.getElementById(focused).focus();
  };
}

function renderSyncPanel() {
  const box = document.getElementById('quadra-box');
  if (!box) return;
  const restore = keepTyped(box);
  const when = shared
    ? new Date(shared.exp).toLocaleString(lang === 'en' ? 'en-US' : 'zh-TW', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    : '';
  box.replaceChildren(
    el('div', { class: 'transfer-section-heading' }, [
      el('span', { text: 'Quadra Pass' }),
      el('span', { class: 'transfer-section-tag', text: t('quadra.tag') })
    ]),
    el('div', { class: 'qp-card' }, [
      el('img', { class: 'qp-icon', src: './favicon.svg', alt: '' }),
      el('div', { class: 'qp-card-text' }, [
        el('strong', { text: q.pass ? t('quadra.signedIn') : t('quadra.signedOut') }),
        el('span', { text: t('quadra.hint') })
      ]),
      el('button', {
        type: 'button',
        class: 'settings-transfer-btn qp-account',
        text: t('quadra.account'),
        onclick: () => accountSheet(q)
      })
    ]),
    el('div', { class: 'qp-section' }, [
      el('div', { class: 'qp-section-title', text: t('quadra.shareTitle') }),
      el('div', { class: 'editor-hint-body', text: t('quadra.shareHint') }),
      shared
        ? el('div', { class: 'sync-code-row' }, [
            el('div', { class: 'sync-code-row-label', text: t('quadra.keyLabel', { time: when }) }),
            el('div', { class: 'sync-code-row-value' }, [
              el('div', { class: 'sync-active-code', text: shared.key }),
              btn(t('common.copy'), copyKey)
            ])
          ])
        : null,
      el('div', { class: 'settings-transfer-actions' }, [
        btn(t(shared ? 'quadra.newKey' : 'quadra.makeKey'), createShareKey, !shared)
      ])
    ]),
    el('div', { class: 'qp-section' }, [
      el('div', { class: 'qp-section-title', text: t('quadra.receiveTitle') }),
      el('div', { class: 'editor-hint-body', text: t('quadra.receiveHint') }),
      el('div', { class: 'qp-key-row' }, [
        el('input', {
          id: 'quadra-key',
          class: 'settings-transfer-text sync-input',
          type: 'text',
          autocapitalize: 'characters',
          autocomplete: 'off',
          spellcheck: 'false',
          maxlength: '9',
          placeholder: t('quadra.keyPlaceholder')
        }),
        btn(t('quadra.copy'), redeemKey, true)
      ])
    ])
  );
  restore();
}

// Nobody is locked out of editing their own schedule any more.
function applyEditorRoleLock() {
  document.getElementById('btn-edit')?.classList.remove('is-disabled');
  document.getElementById('transfer-sheet')?.classList.remove('sync-viewer-locked');
}

function clearSyncInputFields() {
  const input = document.getElementById('quadra-key');
  if (input) input.value = '';
}

// The next class is about to start: the kit's notice (a banner on screen, a
// system notice in the background once turned on in the account sheet).
function notifyClassSoon({ tag, name, meta }) {
  notify(q, {
    title: lang === 'en' ? `Next: ${name}` : `下一堂：${name}`,
    body: meta,
    tag,
    kind: 'class'
  });
}

// The week's classes, five minutes before each, for notices while the app
// is closed (the Worker sends them: see the kit's schedulePush).
function scheduleClassNotices(classes) {
  schedulePush(
    q,
    classes.map(c => ({
      at: c.at,
      title: lang === 'en' ? `Next: ${c.name}` : `下一堂：${c.name}`,
      body: c.meta,
      tag: c.tag,
      kind: 'class'
    }))
  );
}

export {
  applyEditorRoleLock,
  notifyClassSoon,
  scheduleClassNotices,
  clearSyncInputFields,
  getSyncKeepLocalStyle,
  isSyncConfigured,
  isSyncViewer,
  pullSyncSnapshot,
  pushSyncSnapshot,
  renderSyncPanel,
  sessionUrl,
  setSyncStatusUi,
  startSyncLoop,
  syncTick,
  whenReady
};
