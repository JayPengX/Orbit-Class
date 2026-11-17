// Device B opens a day after a countdown ended (結束後自動刪除 on). Device A
// already took the same countdown off and sent that copy. B's first tick takes
// it off too, before the pass answers (an edit waiting on the copy B last saw).
// The opening compared only which copy each edit was made on, never "is it the
// very same copy" as a read does: B's identical copy was set aside, with
// 「別處有較新的版本」 and 用我的.
import { beforeAll, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { buildFixtureData, seedLocalStorage } from './helpers/fixtureData.js';
const calls = [];
const toasts = [];
const session = {
  pass: 'ABCDE23456', wallet: { settings: {} }, active: false, handlers: {}, payload: null, inbox: [],
  on(n, f) { this.handlers[n] = f; return this; },
  async start() { await new Promise(r => setTimeout(r, 20)); this.active = true; return { payload: this.payload, inbox: this.inbox }; },
  async read() { calls.push(['read']); return { payload: this.payload, inbox: this.inbox }; },
  async write(b) { calls.push(['write', b]); if (b.payload) this.payload = b.payload; return {}; },
  async op() { return {}; }, async dropInbox() {}, async ensureToken() { return 'T'; }
};
vi.mock('#kit/orbit.mjs', () => ({ orbitSession: () => session, storedAccount: () => 'account', schedulePush() {}, accountSheet() {}, errorText: e => e.message, detectLang: () => 'zh', notify() {}, tabBar: () => ({ select() {} }), topActions() {}, onScreen() {}, API: '' }));
vi.mock('#kit/ui.mjs', async orig => ({ ...(await orig()), toast: (text, o) => (toasts.push([text, o?.action?.label]), null) }));
const fingerprint = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return `${(h >>> 0).toString(36)}:${text.length}`; };
let sync, backup, state;
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T07:30:00'));
  backup = await import('../src/editor-backup.js');
  const day0 = { ...buildFixtureData(), pruneCountdowns: true, countdownEvents: [{ name: '第二次段考', startDate: '2026-11-16', endDate: '2026-11-17' }, { name: '116 學測', startDate: '2027-01-22', endDate: '2027-01-24' }] };
  const day0n = backup.normalizeSettingsData(day0);
  const P0 = await backup.encodeTransferData(day0n);
  const P1 = await backup.encodeTransferData({ ...day0n, countdownEvents: day0n.countdownEvents.slice(1) }); // A pruned it
  seedLocalStorage(day0n);
  localStorage.setItem('orbit-class.sync.base', fingerprint(P0)); // the copy B last saw
  session.payload = P1;
  await loadApp();
  sync = await import('../src/sync.js');
  ({ state } = await import('../src/state.js'));
  await sync.whenReady();
  await new Promise(r => setTimeout(r, 50));
});
it('the same pruned copy on the pass and here, at opening: no conflict, nothing set aside, nothing sent', async () => {
  const mine = await backup.encodeTransferData(state.applicationData);
  expect(mine).toBe(session.payload);
  expect(JSON.parse(localStorage.getItem('orbitSetAside') || '[]')).toEqual([]);
  expect(toasts).toEqual([]);
  expect(calls.filter(c => c[0] === 'write' && c[1].payload)).toEqual([]);
  expect(localStorage.getItem('orbit-class.sync.pending')).toBe(null);
});
