// ---- src/onboarding.js ----
// The welcome card: a Quadra Pass with no schedule yet gets one card, once,
// with the three ways to get a schedule in - a photo read by AI, typing it
// in, or a classmate's share key - and a "later". It's a modal <dialog> on
// the top layer (nothing of the dashboard shows through or sits above it).
// Shown at most once per device (see markOnboardingSeen()), so a returning
// user is never nagged.
import { hasSavedSchedule } from './data.js';
import { isSyncViewer } from './sync.js';
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

// Sync setup and AI import both live in the "同步 / 匯入匯出" sheet.
function focusShareKeyField() {
  window.openTransferSheet();
  document.getElementById('quadra-key')?.focus();
}
function focusAIImportSection() {
  window.openTransferSheet();
  document.getElementById('ocr-import-box')?.scrollIntoView({ block: 'center' });
}

const CHOICES = [
  ['photo', '📷', focusAIImportSection],
  ['manual', '✍️', () => window.openEditor()],
  ['key', '🔑', focusShareKeyField]
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

function showOnboardingPrompt() {
  if (hasSavedSchedule() || isSyncViewer() || hasSeenOnboarding()) return;
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
        { class: 'orbit-welcome-choices' },
        CHOICES.map(([id, icon, go]) =>
          el(
            'button',
            {
              class: 'orbit-welcome-choice',
              type: 'button',
              'data-choice': id,
              onclick: () => (close(), go())
            },
            [
              el('span', { class: 'orbit-welcome-icon', 'aria-hidden': 'true', text: icon }),
              el('span', { class: 'orbit-welcome-text' }, [
                el('strong', { text: t(`onboarding.${id}Title`) }),
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
