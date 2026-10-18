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

// Each way in has a kit glyph on a colour tile (drawn here when an old kit has none).
const GLYPHS = {
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3L9.5 4.5h5L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/><circle cx="12" cy="13" r="3.5"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>'
};
const glyph = name => (kitUI.icons ?? {})[name] ?? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[name]}</svg>`;
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
  node.innerHTML = glyph(icon);
  node.style.setProperty('--t', color);
  return node;
}

function showOnboardingPrompt() {
  if (hasSavedSchedule() || hasSeenOnboarding()) return;
  markOnboardingSeen();
  const dialog = el('dialog', {
    id: 'orbit-welcome',
    class: 'orbit-welcome',
    'aria-labelledby': 'orbit-welcome-title'
  });
  const close = () => {
    if (dialog.open) dialog.close();
    dialog.remove();
  };
  dialog.append(
    el('div', { class: 'orbit-welcome-box' }, [
      el('p', { class: 'orbit-welcome-kicker', text: 'ORBIT CLASS' }),
      el('h2', {
        id: 'orbit-welcome-title',
        class: 'orbit-welcome-title',
        text: t('onboarding.welcomeTitle')
      }),
      el('p', { class: 'orbit-welcome-lede', text: t('onboarding.welcomeMessage') }),
      el(
        'div',
        { class: 'orbit-welcome-choices q-rowcard' },
        CHOICES.map(([id, icon, color, go]) =>
          el(
            'button',
            {
              class: 'orbit-welcome-choice q-ritem chevron',
              type: 'button',
              'data-choice': id,
              onclick: () => (close(), go())
            },
            [
              tileNode(icon, color),
              el('span', { class: 'orbit-welcome-text q-ritem-text' }, [
                el('strong', { class: 'q-ritem-title', text: t(`onboarding.${id}Title`) }),
                el('small', { text: t(`onboarding.${id}Hint`) })
              ])
            ]
          )
        )
      ),
      el('button', {
        class: 'orbit-welcome-later',
        type: 'button',
        text: t('onboarding.later'),
        onclick: close
      })
    ])
  );
  dialog.addEventListener('cancel', e => (e.preventDefault(), close()));
  document.body.append(dialog);
  try {
    dialog.showModal();
  } catch {
    dialog.setAttribute('open', '');
  }
}

export { showOnboardingPrompt };
