// ---- src/onboarding.js ----
// The welcome card: a Quadra Pass with no schedule yet gets one card, once,
// with the three ways to get a schedule in - a photo read by AI, typing it
// in, or a classmate's share key - and a "later". It's a modal <dialog> on
// the top layer (nothing of the dashboard shows through or sits above it).
// Shown at most once per device (see markOnboardingSeen()), so a returning
// user is never nagged.
import { hasSavedSchedule } from './data.js';
import * as kitUI from '#kit/ui.mjs';
import { t } from './strings.js';

const ONBOARDING_SEEN_KEY = 'orbitOnboardingSeen';

function hasSeenOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === '1';
  } catch {
    return true; // Fail closed - never nag if localStorage isn't available.
  }
}
function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, '1');
  } catch {
    /* localStorage unavailable (private browsing, etc.) */
  }
}

function focusShareKeyField() {
  window.openTransferSheet('key');
  document.getElementById('quadra-key')?.focus();
}
function focusAIImportSection() {
  window.openTransferSheet('photo');
}

// Each way in has a kit glyph on a colour tile.
const CHOICES = [
  ['photo', 'camera', 'var(--q-orange)', focusAIImportSection],
  ['manual', 'pencil', 'var(--q-accent)', () => window.openEditor()],
  ['key', 'key', 'var(--q-green)', focusShareKeyField]
];

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function tileNode(icon, color) {
  const node = el('span', { class: 'q-tile orbit-welcome-icon', 'aria-hidden': 'true' });
  node.innerHTML = kitUI.icons[icon];
  node.style.setProperty('--t', color);
  return node;
}

// The welcome as the kit's sheet: a lead line, the three ways in as numbered
// rows (kit tiles), a sticky 稍後 at the foot. `force`: asked for (今天's
// 加入課表), so shown even after it was seen once; `still`: already up as
// the loading screen lifts (the kit's .q-risen: no rise).
function showOnboardingPrompt({ force = false, still = false } = {}) {
  if (hasSavedSchedule() || (!force && hasSeenOnboarding())) return;
  markOnboardingSeen();
  const lead = el('p', { class: 'orbit-welcome-lede', text: t('onboarding.welcomeMessage') });
  const rows = CHOICES.map(([id, icon, color, go]) =>
    el('button', { class: 'orbit-welcome-choice q-ritem chevron', type: 'button', 'data-choice': id, onclick: () => (done(), go()) }, [
      tileNode(icon, color),
      el('span', { class: 'orbit-welcome-text q-ritem-text' }, [
        el('strong', { class: 'q-ritem-title', text: t(`onboarding.${id}Title`) }),
        el('small', { text: t(`onboarding.${id}Hint`) })
      ])
    ])
  );
  const later = kitUI.sheetFoot({ button: { label: t('onboarding.later'), onClick: () => done() } });
  later.querySelector('button').classList.add('orbit-welcome-later');
  const done = () => (sheet.close(), !sheet.el.open && sheet.el.remove());
  const sheet = kitUI.sheet({ title: t('onboarding.welcomeTitle'), cls: 'orbit-welcome-sheet', body: [lead, el('div', { class: 'orbit-welcome-choices q-rowcard' }, rows), later] });
  sheet.el.id = 'orbit-welcome';
  if (still) sheet.el.classList.add('q-risen');
}

export { showOnboardingPrompt };
