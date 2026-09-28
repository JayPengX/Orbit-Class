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
  accountSheet: () => {},
  activityPatch: (wallet, app, action) => ({ settings: { [`act:${app}`]: { value: { day: 'd', n: { [action]: 1 } }, t: 1 } } }),
  setting: (wallet, key, fallback = null) => wallet?.settings?.[key]?.value ?? fallback,
  taipeiDay: () => 'd',
  errorText: error => error.message,
  detectLang: () => 'zh',
  notify: () => {}
}));

let sync;
beforeAll(async () => {
  seedLocalStorage();
  localStorage.setItem('orbitSyncCode', 'CODE2345');
  await loadApp();
  sync = await import('../src/sync.js');
  await sync.whenReady();
});

describe('Orbit Class on the Quadra Pass', () => {
  it('forgets what older versions kept on the device, and never merges it', () => {
    expect(calls.some(c => c[0] === 'merge')).toBe(false);
    expect(localStorage.getItem('orbitSyncCode')).toBe(null);
  });

  it('uploads the schedule on this device when the pass has none', () => {
    expect(calls.some(c => c[0] === 'write' && typeof c[1].payload === 'string')).toBe(true);
    expect(sync.isSyncConfigured()).toBe(true);
    expect(sync.isSyncViewer()).toBe(false);
  });

  it('makes a share key and shows it', async () => {
    document.querySelector('#quadra-box .settings-transfer-btn.primary').click();
    await vi.waitFor(() =>
      expect(document.querySelector('#quadra-box .sync-active-code')?.textContent).toBe('KEY23456')
    );
  });

  it('a share key copies that schedule as this pass’s own; typing survives a refresh', async () => {
    const input = document.getElementById('quadra-key');
    input.value = 'KEY2';
    sync.renderSyncPanel();
    expect(document.getElementById('quadra-key').value).toBe('KEY2');
    document.getElementById('quadra-key').value = 'KEY23456';
    document.querySelector('#quadra-box .qp-key-row .settings-transfer-btn').click();
    await vi.waitFor(() =>
      expect(calls.some(c => c[0] === 'op' && c[1] === 'share-redeem')).toBe(true)
    );
    expect(sync.isSyncViewer()).toBe(false);
    expect(document.getElementById('btn-edit').classList.contains('is-disabled')).toBe(false);
  });

  it('counts the day it was opened, once, for Rewards’ mission', () => {
    const opened = calls.filter(c => c[0] === 'write' && c[1].wallet?.settings?.['act:orbit']?.value?.n?.open);
    expect(opened.length).toBe(1);
  });

  it('AI requests carry the session token', async () => {
    expect(await sync.sessionUrl('https://w.example/gemini')).toBe(
      'https://w.example/gemini?qt=TOKEN'
    );
  });
});
