// ---- src/toast.js ----
// One toast for the app: the kit's (bottom, same as every Orbit app); the
// old #save-toast pill on a cached kit that has none.
import * as kitUI from '#kit/ui.mjs';

export function toast(text, ms = 2500) {
  if (typeof kitUI.toast === 'function') return kitUI.toast(text, { ms, batch: 'class' });
  const el = document.getElementById('save-toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), ms);
}
