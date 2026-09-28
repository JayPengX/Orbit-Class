import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';

let state;
let openStylePanel;

beforeAll(async () => {
  seedLocalStorage();
  await loadApp();
  ({ state } = await import('../src/state.js'));
  ({ openStylePanel } = await import('../src/appearance.js'));
});

beforeEach(() => {
  openStylePanel(true);
});

const confirmSheet = () => document.getElementById('editor-confirm-sheet');
const confirmVisible = () => confirmSheet().classList.contains('show');
const confirmTitle = () => document.getElementById('editor-confirm-title').textContent;
const clickConfirm = (index = 1) =>
  confirmSheet().querySelectorAll('.editor-confirm-btn')[index].onclick?.();
const setDraftColors = primary => {
  document.getElementById('style-primary-input').value = primary;
  window.previewStyleSettings();
};
const isDirty = () =>
  document.getElementById('style-panel').classList.contains('style-draft-dirty');

describe('style panel: saving a preset slot marks the draft dirty', () => {
  it('is not dirty right after opening', () => {
    expect(isDirty()).toBe(false);
  });

  // The bug this covers: saveStyleSlotDraft() used to mutate
  // state.stylePanelDraft.styleSlots without marking the panel dirty, so
  // closeStylePanel() saw nothing to warn about and closed immediately -
  // silently losing the slot save the next time renderStylePanel() rebuilt
  // the draft fresh from the (still unchanged) applicationData.
  it('saving an empty slot marks the panel dirty and blocks closing without a warning', () => {
    window.saveStyleSlot(0);
    clickConfirm(); // 儲存
    expect(isDirty()).toBe(true);

    window.closeStylePanel();
    expect(document.getElementById('style-panel').classList.contains('show')).toBe(true);
    expect(confirmVisible()).toBe(true);
    expect(confirmTitle()).toMatch(/尚未套用樣式/);
  });

  it('saving over an already-named slot also marks the panel dirty once confirmed', () => {
    window.saveStyleSlot(1);
    clickConfirm(); // 儲存 (new slot)
    setDraftColors('#123456');
    window.saveStyleSlot(1);
    clickConfirm(); // 覆寫
    expect(isDirty()).toBe(true);
  });

  it('loading a preset slot (the already-correct path) also marks the panel dirty', () => {
    window.saveStyleSlot(0);
    clickConfirm(); // 儲存
    window.closeStylePanel(); // dismiss the warning sheet without actually closing
    clickConfirm(0); // "返回" - keep editing
    window.loadStyleSlot(0);
    // Same colors as the slot holds, so it applies with no confirmation.
    expect(isDirty()).toBe(true);
  });
});

// Two rules, both of the same shape: confirm only when the answer isn't
// already obvious. Saving names the destination slot (five identical
// swatches make mis-taps easy); applying one only warns when something the
// user actually mixed themselves is about to be replaced.
describe('style slot confirmations only appear when something is at stake', () => {
  it('saving into an empty slot confirms, naming the slot number', () => {
    window.saveStyleSlot(2);
    expect(confirmVisible()).toBe(true);
    expect(confirmTitle()).toMatch(/儲存為樣式 3/);
    clickConfirm(0); // 取消
    expect(state.stylePanelDraft.styleSlots[2].name).toBe('');
  });

  it('overwriting an occupied slot confirms, naming what it replaces', () => {
    window.saveStyleSlot(3);
    clickConfirm(); // 儲存
    setDraftColors('#AABBCC');
    window.saveStyleSlot(3);
    expect(confirmVisible()).toBe(true);
    expect(confirmTitle()).toMatch(/覆寫個人樣式/);
    clickConfirm();
    expect(state.stylePanelDraft.styleSlots[3].primary).toBe('#AABBCC');
  });

  it('re-saving a slot with the colors it already holds asks nothing', () => {
    window.saveStyleSlot(4);
    clickConfirm(); // 儲存
    window.closeStylePanel();
    clickConfirm(0); // 返回
    window.saveStyleSlot(4);
    expect(confirmVisible()).toBe(false);
  });

  it('applying a slot over a built-in preset asks nothing - a preset is one tap to get back', () => {
    window.saveStyleSlot(0);
    clickConfirm(); // 儲存
    window.closeStylePanel();
    clickConfirm(0); // 返回
    window.applyStylePreset('ocean');
    expect(confirmVisible()).toBe(false);
    window.loadStyleSlot(0);
    expect(confirmVisible()).toBe(false);
    expect(document.getElementById('style-primary-input').value).toBe(
      state.stylePanelDraft.styleSlots[0].primary.toLowerCase()
    );
  });

  it('applying a slot over colors the user mixed themselves still confirms', () => {
    window.saveStyleSlot(0);
    clickConfirm(); // 儲存
    window.closeStylePanel();
    clickConfirm(0); // 返回
    setDraftColors('#0F0F0F');
    window.loadStyleSlot(0);
    expect(confirmVisible()).toBe(true);
    expect(confirmTitle()).toMatch(/套用儲存樣式/);
  });
});

describe('state', () => {
  it('sanity: style panel draft exists once opened', () => {
    expect(state.stylePanelDraft).toBeTruthy();
  });
});

