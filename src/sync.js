// ---- src/sync.js ----
// The schedule lives on the Quadra Pass: Orbit Class is Quadra's related
// service, and signing in with a pass is required (src/quadra.mjs, the
// shared kit, shows the sign-in). The pass's Orbit data is the same
// compressed v2 backup string the export/import flow produces
// (editor-backup.js), so every device signed in with the pass gets the
// same schedule.
//
// Sharing: the pass that made a schedule is the only one that edits it. Its
// owner makes a merge key (8 characters, valid a day); another pass that
// enters it either follows the schedule (a copy that stays up to date and
// can't be edited there) or takes its own editable copy. Following is kept
// in the pass's wallet settings ('orbitFollow'), so it holds on every
// device; the owner can stop every follower at once.
//
// Older versions synced with a sync code and a manager passcode, or kept
// the schedule on the device only. Both move onto the pass by themselves:
// a stored code + manager passcode is merged in (the Worker checks the
// passcode), and a schedule only on this device is uploaded when the pass
// has none.
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
  accountButton,
  setting,
  settingPatch,
  errorText,
  detectLang
} from './quadra.mjs';

const lang = detectLang();
const q = quadraSession('orbit', { lang });
const LEGACY_CODE_KEY = 'orbitSyncCode';
const LEGACY_MANAGER_KEY = 'orbitSyncManagerPasscode';
const LEGACY_KEYS = [
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

function readLocal(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}
function dropLocal(keys) {
  try {
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing to clean.
  }
}

const followed = () => setting(q.wallet, 'orbitFollow', null)?.link || '';
function isSyncConfigured() {
  return Boolean(q.pass);
}
// Following someone else's schedule: this device only shows it.
function isSyncViewer() {
  return Boolean(followed());
}
// Kept for appearance.js: a follower's colours are always its own now.
function getSyncKeepLocalStyle() {
  return isSyncViewer();
}
function setSyncStatusUi(message, isError) {
  setStatusText('sync-status', message, isError);
}
const failText = error => errorText(error, lang) || error?.message || String(error);

// ---- Reading and writing the schedule ------------------------------------------------

let lastPayload = null;
let chain = Promise.resolve();
const serial = fn => (chain = chain.then(fn, fn));

async function applyPayload(payload, message) {
  if (!payload || payload === lastPayload) return false;
  const next = normalizeSettingsData(await decodeTransferData(payload), { requireMarker: true });
  lastPayload = payload;
  // A follower keeps its own colours.
  if (isSyncViewer() && state.applicationData) {
    for (const k of ['proAccent', 'proSecondary', 'styleSlots'])
      if (k in state.applicationData) next[k] = state.applicationData[k];
  }
  if (JSON.stringify(next) === JSON.stringify(state.applicationData)) return false;
  if (isEditorDirty()) {
    lastPayload = null;
    return false;
  }
  applyEditorSettingsData(next, { statusMessage: message, fromSync: true });
  return true;
}

// Uploads the saved schedule (never an unsaved editor draft) to the pass.
function pushSyncSnapshot() {
  return serial(async () => {
    if (!q.pass || isSyncViewer()) return { ok: true, pushed: false };
    try {
      const payload = await encodeTransferData(state.applicationData);
      if (payload === lastPayload) return { ok: true, pushed: false };
      await q.write({ payload });
      lastPayload = payload;
      return { ok: true, pushed: true };
    } catch (error) {
      if (error.code === 'ECO_SESSION_MOVED') return { ok: true, pushed: false };
      return { ok: false, error: t('sync.uploadFailed', { message: failText(error) }) };
    }
  });
}

// Picks up changes: the followed schedule, or this pass's own (another device).
function pullSyncSnapshot() {
  return serial(async () => {
    if (!q.pass || !q.active) return { ok: true, applied: false };
    try {
      if (isSyncViewer()) {
        const res = await q.op('follow', { link: followed() });
        return { ok: true, applied: await applyPayload(res.payload, t('quadra.followUpdated')) };
      }
      const res = await q.read({ data: true, inbox: true });
      const applied = await absorbInbox(res.inbox);
      return {
        ok: true,
        applied: applied || (await applyPayload(res.payload, t('sync.syncedFromOtherDevice')))
      };
    } catch (error) {
      if (error.code === 'ECO_LINK_GONE') {
        await stopFollowing({ quiet: true });
        setSyncStatusUi(t('quadra.followEnded'), true);
        return { ok: true, applied: false };
      }
      return { ok: false, error: t('sync.downloadFailed', { message: failText(error) }) };
    }
  });
}

// Schedules merged into the pass (an old sync code) wait in its inbox: the
// newest becomes this pass's schedule.
async function absorbInbox(inbox = []) {
  if (!inbox?.length) return false;
  const newest = inbox[inbox.length - 1];
  const applied = await applyPayload(newest.payload, t('quadra.merged'));
  for (const item of inbox) await q.dropInbox(item.id).catch(() => {});
  lastPayload = null;
  if (applied && !isSyncViewer()) {
    const payload = await encodeTransferData(state.applicationData);
    await q.write({ payload });
    lastPayload = payload;
  }
  return applied;
}

// ---- Start: sign in, bring older data over, then keep in step -------------------------

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
    // An older sync code this device managed: merged into the pass.
    const code = readLocal(LEGACY_CODE_KEY);
    const manager = readLocal(LEGACY_MANAGER_KEY);
    if (code && manager) {
      try {
        await q.merge([{ app: 'orbit', passcode: code, manager }]);
        dropLocal(LEGACY_KEYS);
        setSyncStatusUi(t('quadra.legacyMoved'));
      } catch (error) {
        if (
          ['ECO_SOURCE_NOT_FOUND', 'ECO_SOURCE_LOCKED', 'ECO_INVALID_SOURCE'].includes(error.code)
        )
          dropLocal(LEGACY_KEYS);
      }
    } else if (code) {
      // Only a viewer of someone else's code: that person can share a merge key now.
      dropLocal(LEGACY_KEYS);
      setSyncStatusUi(t('quadra.legacyViewer'));
    }
    const res = code && manager ? await q.read({ data: true, inbox: true }) : first;
    if (isSyncViewer()) await pullSyncSnapshot();
    else if (res?.inbox?.length) await serial(() => absorbInbox(res.inbox));
    else if (res?.payload)
      await serial(() => applyPayload(res.payload, t('sync.syncedFromOtherDevice')));
    else if (hasSavedSchedule()) await pushSyncSnapshot();
  } catch (error) {
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
  const pushed = isSyncViewer() ? null : await pushSyncSnapshot();
  if (pushed && !pushed.ok) setSyncStatusUi(pushed.error, true);
  const pulled = await pullSyncSnapshot();
  if (!pulled.ok) setSyncStatusUi(pulled.error, true);
  if (pulled.applied) renderSyncPanel();
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
  q.on('wallet', () => renderSyncPanel());
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
    await pushSyncSnapshot();
    shared = await q.op('share-create');
    renderSyncPanel();
  } catch (error) {
    setSyncStatusUi(failText(error), true);
  }
}
async function revokeShares() {
  try {
    await q.op('share-revoke');
    shared = null;
    setSyncStatusUi(t('quadra.revoked'));
    renderSyncPanel();
  } catch (error) {
    setSyncStatusUi(failText(error), true);
  }
}
async function redeemKey(mode) {
  const input = document.getElementById('quadra-key');
  const key = String(input?.value || '').trim();
  if (!key) return setSyncStatusUi(t('quadra.enterKey'), true);
  try {
    const res = await q.op('share-redeem', { key });
    if (res.own) return setSyncStatusUi(t('quadra.ownKey'), true);
    if (mode === 'follow') {
      await q.write({ wallet: settingPatch('orbitFollow', { link: res.link }) });
      lastPayload = null;
      await serial(() => applyPayload(res.payload, t('quadra.nowFollowing')));
    } else {
      const next = normalizeSettingsData(await decodeTransferData(res.payload), {
        requireMarker: true
      });
      applyEditorSettingsData(next, { statusMessage: t('quadra.copied') });
    }
    if (input) input.value = '';
    renderSyncPanel();
  } catch (error) {
    setSyncStatusUi(
      error.code === 'ECO_SHARE_NOT_FOUND' ? t('quadra.keyNotFound') : failText(error),
      true
    );
  }
}
async function stopFollowing({ quiet = false } = {}) {
  try {
    await q.write({ wallet: settingPatch('orbitFollow', null) });
    lastPayload = null;
    const res = await q.read({ data: true });
    if (res.payload) await serial(() => applyPayload(res.payload, t('quadra.backToOwn')));
    if (!quiet) setSyncStatusUi(t('quadra.backToOwn'));
    renderSyncPanel();
  } catch (error) {
    setSyncStatusUi(failText(error), true);
  }
}
async function mergeLegacy() {
  const code = String(document.getElementById('quadra-legacy-code')?.value || '').trim();
  const manager = String(document.getElementById('quadra-legacy-manager')?.value || '').trim();
  if (!code || !manager) return setSyncStatusUi(t('quadra.legacyNeedBoth'), true);
  try {
    await q.merge([{ app: 'orbit', passcode: code, manager }]);
    if (isSyncViewer()) await q.write({ wallet: settingPatch('orbitFollow', null) });
    lastPayload = null;
    const res = await q.read({ data: true, inbox: true });
    await serial(
      async () => (await absorbInbox(res.inbox)) || applyPayload(res.payload, t('quadra.merged'))
    );
    clearSyncInputFields();
    setSyncStatusUi(t('quadra.merged'));
    renderSyncPanel();
  } catch (error) {
    const known = {
      ECO_SOURCE_NOT_FOUND: 'quadra.legacyNotFound',
      ECO_SOURCE_LOCKED: 'quadra.legacyLocked',
      ECO_INVALID_SOURCE: 'quadra.legacyNotFound'
    }[error.code];
    setSyncStatusUi(known ? t(known) : failText(error), true);
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

let accountNode = null;
function renderSyncPanel() {
  const box = document.getElementById('quadra-box');
  if (!box) return;
  accountNode ||= accountButton(q);
  const viewer = isSyncViewer();
  const keyRow = shared
    ? el('div', { class: 'sync-code-row' }, [
        el('div', {
          class: 'sync-code-row-label',
          text: t('quadra.keyLabel', {
            time: new Date(shared.exp).toLocaleString(lang === 'en' ? 'en-US' : 'zh-TW', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })
          })
        }),
        el('div', { class: 'sync-code-row-value' }, [
          el('div', { class: 'sync-active-code', text: shared.key }),
          btn(t('common.copy'), copyKey)
        ])
      ])
    : null;
  box.replaceChildren(
    el('div', { class: 'transfer-section-heading' }, [
      el('span', { text: 'Quadra Pass' }),
      el('span', { class: 'transfer-section-tag', text: t('quadra.tag') })
    ]),
    el('div', { class: 'quadra-account' }, [
      el('div', { class: 'editor-hint-body', text: t('quadra.hint') }),
      accountNode
    ]),
    viewer
      ? el('div', { class: 'sync-upgrade-box' }, [
          el('div', { class: 'sync-role-label is-viewer', text: t('quadra.following') }),
          el('div', { class: 'settings-transfer-actions' }, [
            btn(t('quadra.stopFollowing'), () => stopFollowing())
          ])
        ])
      : el('div', { class: 'sync-upgrade-box' }, [
          el('div', { class: 'editor-hint-body', text: t('quadra.shareHint') }),
          keyRow,
          el('div', { class: 'settings-transfer-actions' }, [
            btn(t(shared ? 'quadra.newKey' : 'quadra.makeKey'), createShareKey, !shared),
            btn(t('quadra.revoke'), revokeShares)
          ])
        ]),
    el('div', { class: 'sync-divider', text: t('quadra.orReceive') }),
    el('input', {
      id: 'quadra-key',
      class: 'settings-transfer-text sync-input',
      type: 'text',
      autocapitalize: 'characters',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: t('quadra.keyPlaceholder')
    }),
    el('div', { class: 'settings-transfer-actions' }, [
      btn(t('quadra.follow'), () => redeemKey('follow')),
      btn(t('quadra.copy'), () => redeemKey('copy'), true)
    ]),
    el('details', { class: 'legacy-fold', id: 'quadra-legacy-fold' }, [
      el('summary', { class: 'legacy-fold-summary', text: t('quadra.legacySummary') }),
      el('div', { class: 'legacy-fold-body' }, [
        el('div', { class: 'editor-hint-body', text: t('quadra.legacyHint') }),
        el('input', {
          id: 'quadra-legacy-code',
          class: 'settings-transfer-text sync-input',
          type: 'text',
          autocapitalize: 'characters',
          autocomplete: 'off',
          spellcheck: 'false',
          placeholder: t('sync.enterSyncCodePlaceholder')
        }),
        el('input', {
          id: 'quadra-legacy-manager',
          class: 'settings-transfer-text sync-input',
          type: 'text',
          autocapitalize: 'none',
          autocomplete: 'off',
          spellcheck: 'false',
          placeholder: t('sync.enterManagerPasscodePlaceholder')
        }),
        el('div', { class: 'settings-transfer-actions' }, [
          btn(t('quadra.legacyMerge'), mergeLegacy, true)
        ])
      ])
    ])
  );
  applyEditorRoleLock();
}

// A follower can't edit: the editor button, AI import and manual import lock.
function applyEditorRoleLock() {
  const viewer = isSyncViewer();
  const editButton = document.getElementById('btn-edit');
  if (editButton) {
    editButton.classList.toggle('is-disabled', viewer);
    editButton.title = viewer ? t('sync.editLockedTitle') : t('sync.editTitle');
  }
  document.getElementById('transfer-sheet')?.classList.toggle('sync-viewer-locked', viewer);
}

function clearSyncInputFields() {
  for (const id of ['quadra-key', 'quadra-legacy-code', 'quadra-legacy-manager']) {
    const input = document.getElementById(id);
    if (input) input.value = '';
  }
  const fold = document.getElementById('quadra-legacy-fold');
  if (fold) fold.open = false;
}

export {
  applyEditorRoleLock,
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
