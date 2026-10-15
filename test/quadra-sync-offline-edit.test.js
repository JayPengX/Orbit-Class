import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';
import { buildFixtureData } from './helpers/fixtureData.js';

// The Quadra Pass session is mocked: the calls Orbit Class makes are what's
// under test, not the Worker.
const calls = [];
const session = {
  pass: 'ABCDE23456',
  wallet: { settings: {} },
  active: true,
  handlers: {},
  payload: null,
  inbox: [],
  on(name, fn) {
    this.handlers[name] = fn;
    return this;
  },
  async start() {
    calls.push(['start']);
    return { payload: this.payload, inbox: this.inbox };
  },
  async read() {
    calls.push(['read']);
    return { payload: this.payload, inbox: this.inbox };
  },
  async write(body) {
    calls.push(['write', body]);
    if (body.payload) this.payload = body.payload;
    if (body.wallet?.settings)
      this.wallet = {
        ...this.wallet,
        settings: { ...this.wallet.settings, ...body.wallet.settings }
      };
    return {};
  },
  async merge(sources) {
    calls.push(['merge', sources]);
    return {};
  },
  async op(name, body) {
    calls.push(['op', name, body]);
    if (name === 'share-create') return { key: 'KEY23456', exp: Date.now() + 86_400_000 };
    if (name === 'share-redeem') return { link: 'LINK', payload: this.payload, own: false };
    if (name === 'follow') return { payload: this.payload };
    return {};
  },
  async dropInbox() {},
  async ensureToken() {
    return 'TOKEN';
  }
};
vi.mock('#kit/quadra.mjs', () => ({
  quadraSession: () => session,
  storedAccount: () => 'account',
  schedulePush: () => {},
  accountSheet: () => {},
  errorText: error => error.message,
  detectLang: () => 'zh',
  notify: () => {}
}));

// An edit made with no connection, the app closed before it went up: the
// next opening finds it waiting on the device (orbit-class.sync.pending,
// with the fingerprint of the pass's copy it was made on).
const fingerprint = text => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `${(h >>> 0).toString(36)}:${text.length}`;
};
const withTeacher = name => {
  const d = buildFixtureData();
  d.teacherDB.A = ['數學', name, ''];
  return d;
};
let sync;
let backup;
const writes = () => calls.filter(c => c[0] === 'write' && typeof c[1].payload === 'string');
beforeAll(async () => {
  backup = await import('../src/editor-backup.js');
  session.payload = await backup.encodeTransferData(withTeacher('雲端版'));
  seedLocalStorage({ teacherDB: withTeacher('離線的修改').teacherDB });
  localStorage.setItem('orbit-class.sync.pending', fingerprint(session.payload));
  await loadApp();
  sync = await import('../src/sync.js');
  await sync.whenReady();
});

describe('an edit made offline, on the pass’s copy as it still is', () => {
  it('goes up at the next opening, not overwritten by the older copy', async () => {
    const { state } = await import('../src/state.js');
    await vi.waitFor(() => expect(writes().length).toBe(1));
    expect((await backup.decodeTransferData(session.payload)).teacherDB.A[1]).toBe('離線的修改');
    expect(state.applicationData.teacherDB.A[1]).toBe('離線的修改');
    expect(localStorage.getItem('orbit-class.sync.pending')).toBe(null);
  });
});
