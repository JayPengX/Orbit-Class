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
vi.mock('../src/quadra.mjs', () => ({
  quadraSession: () => session,
  storedAccount: () => 'account',
  schedulePush: () => {},
  accountSheet: () => {},
  activityPatch: (wallet, app, action) => ({
    settings: { [`act:${app}`]: { value: { day: 'd', n: { [action]: 1 } }, t: 1 } }
  }),
  setting: (wallet, key, fallback = null) => wallet?.settings?.[key]?.value ?? fallback,
  taipeiDay: () => 'd',
  errorText: error => error.message,
  detectLang: () => 'zh',
  notify: () => {}
}));

// Data loss: a device left open with an older schedule must never save it
// over a newer one another device put on the pass.
const withTeacher = name => {
  const d = buildFixtureData();
  d.teacherDB.A = ['數學', name, ''];
  return d;
};
let sync;
let backup;
const writes = () => calls.filter(c => c[0] === 'write' && typeof c[1].payload === 'string');
beforeAll(async () => {
  seedLocalStorage();
  backup = await import('../src/editor-backup.js');
  session.payload = await backup.encodeTransferData(withTeacher('第一版'));
  await loadApp();
  sync = await import('../src/sync.js');
  await sync.whenReady();
});

describe('never saving over a newer schedule', () => {
  it('opens with the pass’s copy and uploads nothing', async () => {
    const { state } = await import('../src/state.js');
    expect(state.applicationData.teacherDB.A[1]).toBe('第一版');
    expect(writes().length).toBe(0);
  });

  it('back on screen after another device saved: takes the newer copy, uploads nothing', async () => {
    const { state } = await import('../src/state.js');
    session.payload = await backup.encodeTransferData(withTeacher('第二版'));
    await sync.syncTick();
    expect(state.applicationData.teacherDB.A[1]).toBe('第二版');
    expect(writes().length).toBe(0);
  });

  it('a change made on top of an older copy is set aside, the newer one kept', async () => {
    const { state } = await import('../src/state.js');
    const newer = await backup.encodeTransferData(withTeacher('第三版'));
    session.payload = newer;
    // A save on this (now stale) device.
    backup.applyEditorSettingsData(withTeacher('舊裝置的修改'));
    await sync.whenReady();
    await vi.waitFor(() => expect(state.applicationData.teacherDB.A[1]).toBe('第三版'));
    expect(session.payload).toBe(newer);
    expect(writes().length).toBe(0);
    expect(JSON.parse(localStorage.getItem('orbitSetAside')).length).toBe(1);
  });

  it('a change made on the newest copy goes up', async () => {
    const { state } = await import('../src/state.js');
    backup.applyEditorSettingsData(withTeacher('第四版'));
    await vi.waitFor(() => expect(writes().length).toBe(1));
    const back = await backup.decodeTransferData(session.payload);
    expect(back.teacherDB.A[1]).toBe('第四版');
    expect(state.applicationData.teacherDB.A[1]).toBe('第四版');
  });
});
