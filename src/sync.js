// ---- src/sync.js ----
// The schedule lives on the Orbit Pass, and only there: Orbit Class is
// Orbit's related service, and signing in with a pass is required
// (src/orbit.mjs, the shared kit, shows the sign-in). The pass's Orbit data
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
  orbitSession,
  accountSheet,
  errorText,
  detectLang,
  notify,
  schedulePush
} from '#kit/orbit.mjs';
import { h } from '#kit/ui.mjs';

const lang = detectLang();
const q = orbitSession('orbit', { lang });
function isSyncConfigured() {
  return Boolean(q.pass);
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

// An edit not yet on the pass is remembered on the device, with the pass's
// copy it was made on top of (a fingerprint, kept from the last sync): one
// made with no connection and the app closed before it went up was lost,
// the pass's older copy applied over it at the next opening.
const PENDING_KEY = 'orbit-class.sync.pending';
const BASE_KEY = 'orbit-class.sync.base';
const fingerprint = text => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `${(h >>> 0).toString(36)}:${text.length}`;
};
const readKey = key => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeKey = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage full: the edit still goes up while the app is open.
  }
};
function setBase(value) {
  base = value;
  if (value != null) writeKey(BASE_KEY, fingerprint(value));
}
function setDirty(on) {
  localDirty = on;
  writeKey(PENDING_KEY, on ? (base != null ? fingerprint(base) : readKey(BASE_KEY) || '?') : null);
}
// (An edit still waiting from before this opening counts from the start.)
localDirty = Boolean(readKey(PENDING_KEY));
let unreadable = false;
let chain = Promise.resolve();
const serial = fn => (chain = chain.then(fn, fn));
const SET_ASIDE_KEY = 'orbitSetAside';
// applyPayload's answer when the editor has changes not saved: the copy is
// taken later, and isn't `base` meanwhile. (It was: the editor's save, made
// on the older copy, then went up over the newer one as if made on it.)
const DEFERRED = 'deferred';

// The pass's copy shown here: true, false when it is what shows already, or
// DEFERRED.
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
    return DEFERRED;
  }
  applyEditorSettingsData(decoded, { fromSync: true });
  if (message) setSyncStatusUi(message);
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
  // (Not seen this session: the copy the waiting edit was made on, by its fingerprint.)
  const same = base != null ? remote === base : fingerprint(remote) === readKey(PENDING_KEY);
  if (localDirty && remote && !same) return { conflict: remote };
  // The edit here is on top of this very copy: it stands (the copy isn't applied over it).
  if (localDirty) {
    setBase(remote);
    lastPayload = remote;
    return { applied: false };
  }
  const done = remote ? await applyPayload(remote, t('sync.syncedFromOtherDevice')) : false;
  if (done === DEFERRED) return { applied: false };
  setBase(remote);
  return { applied: done };
}
// This device's change lost to a newer one on the pass: kept aside on the
// device (the newest ten), and the pass's copy shown.
async function keepAside() {
  try {
    const kept = JSON.parse(localStorage.getItem(SET_ASIDE_KEY) || '[]');
    kept.push({ t: Date.now(), payload: await encodeTransferData(state.applicationData) });
    localStorage.setItem(SET_ASIDE_KEY, JSON.stringify(kept.slice(-10)));
  } catch {
    // Storage full: the pass's newer copy still wins.
  }
}
async function setAside(remote) {
  await keepAside();
  setDirty(false);
  lastPayload = null;
  // (Under an editor with changes not saved the newer copy shows once it's
  // saved or closed; `base` stays the older one till then.)
  if ((await applyPayload(remote, t('sync.newerElsewhere'))) !== DEFERRED) setBase(remote);
  setSyncStatusUi(t('sync.newerElsewhere'), true);
}

// Uploads this device's saved schedule (never an unsaved editor draft) to
// the pass: called after a real local save, marking it as one.
function pushSyncSnapshot({ mine = true } = {}) {
  if (mine) setDirty(true);
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
        setDirty(false);
        return { ok: true, pushed: false };
      }
      await q.write({ payload });
      lastPayload = payload;
      setBase(payload);
      setDirty(false);
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
      // Live on another device for now: not a failure (the kit says so).
      if (error.code === 'ECO_SESSION_MOVED') return { ok: true, applied: false };
      return { ok: false, error: t('sync.downloadFailed', { message: failText(error) }) };
    }
  });
}

// A schedule merged into the pass waits in its inbox: the newest becomes
// this pass's schedule. It waits there while the editor has changes not
// saved (it was dropped unapplied), and an edit here not yet on the pass is
// set aside first, never lost under it.
async function absorbInbox(inbox = []) {
  if (!inbox?.length || isEditorDirty()) return false;
  const newest = inbox[inbox.length - 1];
  if (localDirty) await keepAside();
  const applied = await applyPayload(newest.payload, t('orbit.merged'));
  for (const item of inbox) await q.dropInbox(item.id).catch(() => {});
  lastPayload = null;
  if (applied) {
    const payload = await encodeTransferData(state.applicationData);
    await q.write({ payload });
    lastPayload = payload;
    setBase(payload);
    setDirty(false);
  }
  return applied;
}

// ---- Start: sign in, then keep in step ---------------------------------------------------

let started = false;
let ready = null;
const whenReady = () => ready || Promise.resolve();
function startOrbit() {
  ready ||= startOrbitOnce();
  return ready;
}
async function startOrbitOnce() {
  started = true;
  const first = await q.start({ data: true });
  renderSyncPanel();
  if (!q.pass) return;
  try {
    // The pass's copy wins over this device's; a device's schedule goes up
    // only when the pass has none yet.
    const pending = readKey(PENDING_KEY);
    if (first?.inbox?.length) await serial(() => absorbInbox(first.inbox));
    // An edit made here that never went up (no connection, the app closed):
    // on top of the pass's copy as it still is, it goes up now; the pass
    // changed elsewhere meanwhile, the newer copy wins and this one is set
    // aside on the device, never lost.
    else if (first?.payload && pending)
      await serial(async () => {
        if (pending !== fingerprint(first.payload)) return setAside(first.payload);
        setBase(first.payload);
        lastPayload = first.payload;
        localDirty = true;
      }).then(() => localDirty && pushSyncSnapshot({ mine: false }));
    else if (first?.payload)
      await serial(async () => {
        if ((await applyPayload(first.payload, t('sync.syncedFromOtherDevice'))) !== DEFERRED)
          setBase(first.payload);
      });
    else if (!first?.offline && 'payload' in (first || {})) {
      setBase('');
      if (hasSavedSchedule()) await pushSyncSnapshot();
    }
  } catch (error) {
    if (error.code !== 'ECO_SESSION_MOVED')
      setSyncStatusUi(t('sync.downloadFailed', { message: failText(error) }), true);
  }
  renderSyncPanel();
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
  startOrbit();
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
  q.on('active', live => live && syncTick());
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
  const input = document.getElementById('orbit-key');
  const key = String(input?.value || '').trim();
  if (!key) return setSyncStatusUi(t('orbit.enterKey'), true);
  try {
    const res = await q.op('share-redeem', { key });
    if (res.own) return setSyncStatusUi(t('orbit.ownKey'), true);
    const next = normalizeSettingsData(await decodeTransferData(res.payload), {
      requireMarker: true
    });
    // The timetable it replaces is kept on the device (orbitSetAside), never gone.
    if (JSON.stringify(next) !== JSON.stringify(state.applicationData)) await keepAside();
    applyEditorSettingsData(next);
    setSyncStatusUi(t('orbit.copied'));
    if (input) input.value = '';
  } catch (error) {
    setSyncStatusUi(
      error.code === 'ECO_SHARE_NOT_FOUND' ? t('orbit.keyNotFound') : failText(error),
      true
    );
  }
}
async function copyKey() {
  try {
    await navigator.clipboard.writeText(shared?.key || '');
    setSyncStatusUi(t('orbit.keyCopied'));
  } catch {
    // Clipboard blocked: the key is on screen to copy by hand.
  }
}

// ---- The panel (the transfer sheet's first section) -----------------------------------------

const el = h;
const btn = (text, onclick, primary = false, cls = '') =>
  el('button', {
    type: 'button',
    class: `settings-transfer-btn q-btn ${primary ? 'primary' : 'tinted'}${cls ? ` ${cls}` : ''}`,
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
  const box = document.getElementById('orbit-box');
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
  // The Pass that keeps the timetable, then the share key both ways.
  const pass = el('div', { class: 'q-rowcard' }, [
    el('div', { class: 'q-ritem tr-pass' }, [
      el('img', { class: 'q-tile tr-app', src: './favicon.svg', alt: '' }),
      el('span', { class: 'q-ritem-text' }, [
        el('span', {
          class: 'q-ritem-title',
          text: q.pass ? t('orbit.signedIn') : t('orbit.signedOut')
        }),
        el('small', { text: t('orbit.hint') })
      ]),
      el('button', {
        type: 'button',
        class: 'q-btn small tinted',
        text: t('orbit.account'),
        onclick: () => accountSheet(q)
      })
    ])
  ]);
  const key = shared
    ? el('div', { class: 'tr-keycard' }, [
        el('small', { text: t('orbit.keyLabel', { time: when }) }),
        el('div', { class: 'tr-keycard-row' }, [
          el('strong', { class: 'sync-active-code', text: shared.key }),
          btn(t('common.copy'), copyKey, false, 'small')
        ])
      ])
    : null;
  box.replaceChildren(
    ...[
      pass,
      el('h3', { class: 'cx-sheet-h', text: t('orbit.shareTitle') }),
      key,
      btn(t(shared ? 'orbit.newKey' : 'orbit.makeKey'), createShareKey, !shared, 'large block'),
      el('p', { class: 'cx-foot-line', text: t('orbit.shareHint') }),
      el('h3', { class: 'cx-sheet-h', text: t('orbit.receiveTitle') }),
      el('div', { class: 'qp-key-row' }, [
        el('input', {
          id: 'orbit-key',
          class: 'q-field',
          type: 'text',
          autocapitalize: 'characters',
          autocomplete: 'off',
          spellcheck: 'false',
          maxlength: '9',
          placeholder: t('orbit.keyPlaceholder')
        }),
        btn(t('orbit.copy'), redeemKey, true)
      ]),
      el('p', { class: 'cx-foot-line', text: t('orbit.receiveHint') })
    ].filter(Boolean)
  );
  restore();
}

function clearSyncInputFields() {
  const input = document.getElementById('orbit-key');
  if (input) input.value = '';
}

// The next class is about to start: the kit's notice (a banner on screen, a
// system notice in the background once turned on in the account sheet).
// The class alone in the title (iOS gives a web app's title one line, then
// "from Class": "安全教育與傷害防護 10 分鐘後…" was cut), when it starts
// first in the body, which wraps: "10 分鐘後上課 · 14:00 · 李榮哲 · 314 教室".
const soonTitle = name => name;
const soonBody = (meta, lead = 5) =>
  [lang === 'en' ? `In ${lead} minutes` : `${lead} 分鐘後上課`, meta].filter(Boolean).join(' · ');
function notifyClassSoon({ tag, name, meta, lead }) {
  notify(q, {
    title: soonTitle(name),
    body: soonBody(meta, lead),
    tag,
    kind: 'class'
  });
}

// The week's classes, each as the break before it starts, for notices while the app
// is closed (the Worker sends them: see the kit's schedulePush).
function scheduleClassNotices(classes) {
  schedulePush(
    q,
    classes.map(c => ({
      at: c.at,
      title: soonTitle(c.name),
      body: soonBody(c.meta, c.lead),
      tag: c.tag,
      kind: 'class'
    }))
  );
}

export {
  q as orbitSession,
  notifyClassSoon,
  scheduleClassNotices,
  clearSyncInputFields,
  isSyncConfigured,
  pullSyncSnapshot,
  pushSyncSnapshot,
  renderSyncPanel,
  sessionUrl,
  setSyncStatusUi,
  startSyncLoop,
  syncTick,
  whenReady
};
