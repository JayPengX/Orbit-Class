import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';

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
  accountButton: () => document.createElement('button'),
  setting: (wallet, key, fallback = null) => wallet?.settings?.[key]?.value ?? fallback,
  settingPatch: (key, value) => ({ settings: { [key]: { value, t: Date.now() } } }),
  errorText: error => error.message,
  detectLang: () => 'zh'
}));

let sync;
beforeAll(async () => {
  seedLocalStorage();
  localStorage.setItem('orbitSyncCode', 'CODE2345');
  localStorage.setItem('orbitSyncManagerPasscode', 'MANAGER1');
  await loadApp();
  sync = await import('../src/sync.js');
  await sync.whenReady();
});

describe('Orbit Class on the Quadra Pass', () => {
  it('merges an old sync code this device managed into the pass, then forgets it', () => {
    const merge = calls.find(c => c[0] === 'merge');
    expect(merge[1]).toEqual([{ app: 'orbit', passcode: 'CODE2345', manager: 'MANAGER1' }]);
    expect(localStorage.getItem('orbitSyncCode')).toBe(null);
    expect(localStorage.getItem('orbitSyncManagerPasscode')).toBe(null);
  });

  it('uploads the schedule on this device when the pass has none', () => {
    expect(calls.some(c => c[0] === 'write' && typeof c[1].payload === 'string')).toBe(true);
    expect(sync.isSyncConfigured()).toBe(true);
    expect(sync.isSyncViewer()).toBe(false);
  });

  it('makes a merge key and shows it', async () => {
    document.querySelector('#quadra-box .settings-transfer-btn.primary').click();
    await vi.waitFor(() =>
      expect(document.querySelector('#quadra-box .sync-active-code')?.textContent).toBe('KEY23456')
    );
  });

  it('following a schedule locks editing; stopping unlocks it', async () => {
    document.getElementById('quadra-key').value = 'KEY23456';
    [...document.querySelectorAll('#quadra-box .settings-transfer-btn')]
      .find(b => b.textContent.includes('跟隨'))
      .click();
    await vi.waitFor(() =>
      expect(document.querySelector('#quadra-box .sync-role-label')).not.toBe(null)
    );
    expect(sync.isSyncViewer()).toBe(true);
    expect(document.getElementById('btn-edit').classList.contains('is-disabled')).toBe(true);
    expect(document.getElementById('transfer-sheet').classList.contains('sync-viewer-locked')).toBe(
      true
    );
    const pushed = await sync.pushSyncSnapshot();
    expect(pushed.pushed).toBe(false);
    [...document.querySelectorAll('#quadra-box .settings-transfer-btn')]
      .find(b => b.textContent.includes('停止跟隨'))
      .click();
    await vi.waitFor(() =>
      expect(document.getElementById('btn-edit').classList.contains('is-disabled')).toBe(false)
    );
    expect(sync.isSyncViewer()).toBe(false);
  });

  it('AI requests carry the session token', async () => {
    expect(await sync.sessionUrl('https://w.example/gemini')).toBe(
      'https://w.example/gemini?qt=TOKEN'
    );
  });
});
