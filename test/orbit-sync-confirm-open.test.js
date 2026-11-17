// An AI 課表編輯 (or import) card is made on the copy shown when it was asked.
// The editor's form isn't changed by it, so a newer copy from another device
// was applied under the open card (a touch on it is a sync check), and 套用
// then wrote the older copy over the newer one: the other device's edit gone,
// nothing set aside. Now the newer copy waits, and 套用 meets it as a conflict.
import { beforeAll, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { buildFixtureData, seedLocalStorage } from './helpers/fixtureData.js';
const calls = [];
const session = {
  pass: 'ABCDE23456', wallet: { settings: {} }, active: true, handlers: {}, payload: null, inbox: [],
  on(n, f) { this.handlers[n] = f; return this; },
  async start() { return { payload: this.payload, inbox: this.inbox }; },
  async read() { return { payload: this.payload, inbox: this.inbox }; },
  async write(b) { calls.push(['write', b]); if (b.payload) this.payload = b.payload; return {}; },
  async op() { return {}; }, async dropInbox() {}, async ensureToken() { return 'T'; }
};
vi.mock('#kit/orbit.mjs', () => ({ orbitSession: () => session, storedAccount: () => 'account', schedulePush() {}, accountSheet() {}, errorText: e => e.message, detectLang: () => 'zh', notify() {}, tabBar: () => ({ select() {} }), topActions() {}, onScreen() {}, API: '' }));
let sync, backup, state;
beforeAll(async () => {
  seedLocalStorage();
  backup = await import('../src/editor-backup.js');
  session.payload = await backup.encodeTransferData(buildFixtureData());
  await loadApp();
  sync = await import('../src/sync.js');
  ({ state } = await import('../src/state.js'));
  await sync.whenReady();
});
it('套用 on an AI edit never writes over a newer copy that came while its card was open', async () => {
  window.openEditor();
  const nl = await import('../src/editor-nl-edit.js');
  await nl.submitNlEdit('週一第三節改成數學', {});       // code's edit, no AI call; confirm sheet up
  expect(state.pendingEditorSaveData).toBeTruthy();
  // Meanwhile the phone adds a to-do (another device), and a tap here is a sync check.
  const other = { ...buildFixtureData(), todos: [{ id: 'phone1', kind: 'hw', subject: '數學', text: '手機上加的作業', due: '', done: false }] };
  session.payload = await backup.encodeTransferData(other);
  await sync.pullSyncSnapshot();
  // Not applied under the card.
  expect(state.applicationData.todos || []).toEqual([]);
  // 套用
  document.querySelectorAll('#editor-confirm-sheet .editor-confirm-btn')[1].click();
  await sync.whenReady();
  await vi.waitFor(() => expect(localStorage.getItem('orbitSetAside')).toBeTruthy());
  await new Promise(r => setTimeout(r, 50));
  // The phone's to-do stays on the pass and shows here; the edit here kept aside (用我的).
  const onPass = await backup.decodeTransferData(session.payload);
  expect(onPass.todos.map(t => t.text)).toEqual(['手機上加的作業']);
  expect(state.applicationData.todos.map(t => t.text)).toEqual(['手機上加的作業']);
  expect(JSON.parse(localStorage.getItem('orbitSetAside')).length).toBe(1);
});
