import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';
import { buildFixtureData } from './helpers/fixtureData.js';

// The Orbit Pass session is mocked: the calls Orbit Class makes are what's
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
  async dropInbox(id) {
    calls.push(['drop', id]);
    this.inbox = this.inbox.filter(item => item.id !== id);
  },
  async ensureToken() {
    return 'TOKEN';
  }
};
vi.mock('#kit/orbit.mjs', () => ({
  orbitSession: () => session,
  storedAccount: () => 'account',
  schedulePush: () => {},
  accountSheet: () => {},
  errorText: error => error.message,
  detectLang: () => 'zh',
  notify: () => {},
  tabBar: () => ({ select() {} }),
  topActions: () => {}
}));

// The editor open with changes not saved when a newer copy arrives: the
// copy waits (it isn't applied under the editor), and the editor's save,
// made on the older copy, never goes up over the newer one.
const withTeacher = name => {
  const d = buildFixtureData();
  d.teacherDB.A = ['數學', name, ''];
  return d;
};
let sync;
let backup;
let state;
const writes = () => calls.filter(c => c[0] === 'write' && typeof c[1].payload === 'string');
const drops = () => calls.filter(c => c[0] === 'drop');
const setAsideCount = () => JSON.parse(localStorage.getItem('orbitSetAside') || '[]').length;
const editorDirty = on => {
  document.getElementById('editor-sheet').classList.toggle('show', on);
  if (on) state.editorBaselineSnapshot = 'not what the form holds';
};
beforeAll(async () => {
  seedLocalStorage();
  backup = await import('../src/editor-backup.js');
  session.payload = await backup.encodeTransferData(withTeacher('第一版'));
  await loadApp();
  sync = await import('../src/sync.js');
  ({ state } = await import('../src/state.js'));
  await sync.whenReady();
});

describe('a newer copy while the editor has changes not saved', () => {
  it('waits, and the editor’s save is set aside rather than written over it', async () => {
    expect(state.applicationData.teacherDB.A[1]).toBe('第一版');
    editorDirty(true);
    const newer = await backup.encodeTransferData(withTeacher('另一台裝置的第二版'));
    session.payload = newer;
    await sync.pullSyncSnapshot();
    // Not applied under the editor.
    expect(state.applicationData.teacherDB.A[1]).toBe('第一版');
    // The editor saved: its change was made on 第一版.
    editorDirty(false);
    backup.applyEditorSettingsData(withTeacher('編輯器裡的修改'));
    await sync.whenReady();
    await vi.waitFor(() => expect(state.applicationData.teacherDB.A[1]).toBe('另一台裝置的第二版'));
    expect(session.payload).toBe(newer);
    expect(writes().length).toBe(0);
    expect(setAsideCount()).toBe(1);
  });

  it('a schedule merged into the pass stays in the inbox until the editor is saved or closed', async () => {
    const merged = await backup.encodeTransferData(withTeacher('合併進來的'));
    session.inbox = [{ id: 'in-1', payload: merged }];
    editorDirty(true);
    await sync.pullSyncSnapshot();
    expect(drops().length).toBe(0);
    expect(state.applicationData.teacherDB.A[1]).toBe('另一台裝置的第二版');
    editorDirty(false);
    await sync.pullSyncSnapshot();
    expect(state.applicationData.teacherDB.A[1]).toBe('合併進來的');
    expect(drops().map(c => c[1])).toEqual(['in-1']);
    expect(await backup.decodeTransferData(session.payload)).toMatchObject({ teacherDB: { A: ['數學', '合併進來的', ''] } });
  });

  it('an edit not yet on the pass is set aside before a merged schedule replaces it', async () => {
    const before = setAsideCount();
    // Paused (another app live): the edit stays on the device, waiting.
    session.active = false;
    backup.applyEditorSettingsData(withTeacher('還沒上傳的修改'));
    await sync.whenReady();
    session.active = true;
    session.inbox = [{ id: 'in-2', payload: await backup.encodeTransferData(withTeacher('第二次合併')) }];
    await sync.pullSyncSnapshot();
    expect(state.applicationData.teacherDB.A[1]).toBe('第二次合併');
    const kept = JSON.parse(localStorage.getItem('orbitSetAside'));
    expect(kept.length).toBe(before + 1);
    const aside = await backup.decodeTransferData(kept.at(-1).payload);
    expect(aside.teacherDB.A[1]).toBe('還沒上傳的修改');
  });
});
