import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';

// One real boot is enough: showOnboardingPrompt() re-checks
// hasSavedSchedule() and the "seen" flag against live localStorage on
// every call, so each scenario calls it directly.
let showOnboardingPrompt;

beforeAll(async () => {
  // jsdom has no showModal: open the dialog the plain way.
  if (!HTMLDialogElement.prototype.showModal)
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
  if (!HTMLDialogElement.prototype.close)
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  await loadApp();
  ({ showOnboardingPrompt } = await import('../src/onboarding.js'));
});

beforeEach(() => {
  localStorage.removeItem('classFocusData');
  localStorage.removeItem('orbitSyncProjectId');
  localStorage.removeItem('orbitSyncCode');
  localStorage.removeItem('orbitOnboardingSeen');
  document.getElementById('orbit-welcome')?.remove();
  document.getElementById('editor-sheet').classList.remove('show');
  document.getElementById('transfer-sheet').classList.remove('show');
});

const card = () => document.getElementById('orbit-welcome');
const choice = id => card().querySelector(`[data-choice="${id}"]`);

describe('the welcome card', () => {
  it('shows for a brand-new pass (no saved schedule)', () => {
    showOnboardingPrompt();
    expect(card()?.hasAttribute('open')).toBe(true);
    expect(card().textContent).toMatch(/歡迎使用 Orbit Class/);
    expect(card().querySelectorAll('.orbit-welcome-choice').length).toBe(3);
  });

  it('does not show for a returning user with a saved schedule', () => {
    seedLocalStorage();
    showOnboardingPrompt();
    expect(card()).toBe(null);
  });

  it('never shows again once seen', () => {
    showOnboardingPrompt();
    card().querySelector('.orbit-welcome-later').click();
    expect(card()).toBe(null);
    showOnboardingPrompt();
    expect(card()).toBe(null);
  });

  it('the share key opens the transfer sheet with the key field focused', () => {
    showOnboardingPrompt();
    choice('key').click();
    expect(card()).toBe(null);
    expect(document.getElementById('transfer-sheet').classList.contains('show')).toBe(true);
    expect(document.activeElement).toBe(document.getElementById('quadra-key'));
  });

  it('typing it in opens the editor', () => {
    showOnboardingPrompt();
    choice('manual').click();
    expect(document.getElementById('editor-sheet').classList.contains('show')).toBe(true);
  });

  it('a photo opens the transfer sheet (AI import)', () => {
    showOnboardingPrompt();
    choice('photo').click();
    expect(document.getElementById('transfer-sheet').classList.contains('show')).toBe(true);
    expect(document.getElementById('editor-sheet').classList.contains('show')).toBe(false);
  });
});
