// 分享金鑰 shared the whole timetable string: the sharer's 待辦 went to the
// classmate (and sat open in the share copy on the Worker), and taking it
// replaced the classmate's own 待辦 and school with the sharer's. Now the
// timetable alone goes, and the classmate's own 待辦 and school stay.
import { beforeAll, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { buildFixtureData, seedLocalStorage } from './helpers/fixtureData.js';
const ops = [];
let sharerPayload = '';
const session = {
  pass: 'ABCDE23456', wallet: { settings: {} }, active: true, handlers: {}, payload: null, inbox: [],
  on(n, f) { this.handlers[n] = f; return this; },
  async start() { return { payload: this.payload, inbox: this.inbox }; },
  async read() { return { payload: this.payload, inbox: this.inbox }; },
  async write(b) { if (b.payload) this.payload = b.payload; return {}; },
  async op(name, body) { ops.push([name, body]); if (name === 'share-create') return { key: 'KEY23456', exp: Date.now() + 86400000 }; if (name === 'share-redeem') return { payload: sharerPayload, own: false }; return {}; },
  async dropInbox() {}, async ensureToken() { return 'T'; }
};
vi.mock('#kit/orbit.mjs', () => ({ orbitSession: () => session, storedAccount: () => 'account', schedulePush() {}, accountSheet() {}, errorText: e => e.message, detectLang: () => 'zh', notify() {}, tabBar: () => ({ select() {} }), topActions() {}, onScreen() {}, API: '' }));
let sync, backup, state;
const mineTodo = { id: 'mine1', kind: 'hw', subject: '英文', text: '我自己的英文作業', due: '', done: false };
const theirTodo = { id: 'theirs1', kind: 'do', subject: '', text: '分享者的私事：繳補習費', due: '', done: false };
beforeAll(async () => {
  backup = await import('../src/editor-backup.js');
  const me = backup.normalizeSettingsData({ ...buildFixtureData(), todos: [mineTodo], school: { name: '我的學校', url: 'https://www.mine.edu.tw', grade: '2' } });
  seedLocalStorage(me);
  session.payload = await backup.encodeTransferData(me);
  sharerPayload = await backup.encodeTransferData(backup.normalizeSettingsData({ ...buildFixtureData(), todos: [theirTodo], school: { name: '分享者的學校', url: 'https://www.other.edu.tw', grade: '1' } }));
  await loadApp();
  sync = await import('../src/sync.js');
  ({ state } = await import('../src/state.js'));
  await sync.whenReady();
});
it('the share carries no 待辦; taking a key keeps this person’s own 待辦 and school', async () => {
  // Sharer side: what share-create sends.
  [...document.querySelectorAll('#orbit-box button')].find(b => /金鑰/.test(b.textContent) && !/複製/.test(b.textContent))?.click();
  await vi.waitFor(() => expect(ops.some(o => o[0] === 'share-create')).toBe(true));
  const sent = await backup.decodeTransferData(ops.find(o => o[0] === 'share-create')[1].payload);
  expect(sent.todos || []).toEqual([]);
  expect(sent.weeklySchedule[1]).toEqual(['A', 'B', 'C']);
  // Receiver side.
  document.getElementById('orbit-key').value = 'ABCD2345';
  const take = document.querySelectorAll('#orbit-box .tr-card')[1].querySelector('button');
  take.click();
  await vi.waitFor(() => expect(ops.some(o => o[0] === 'share-redeem')).toBe(true));
  // (A key made before the fix still carries the sharer's 待辦: never taken.)
  await vi.waitFor(() => expect(document.getElementById('sync-status')?.textContent || '').toContain('已複製'));
  expect(state.applicationData.todos.map(t => t.id)).toEqual(['mine1']);
  expect(state.applicationData.school?.name).toBe('我的學校');
});
