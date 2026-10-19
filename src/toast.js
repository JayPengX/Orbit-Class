// ---- src/toast.js ----
// One toast for the app: the kit's (bottom, same as every Orbit app).
import * as kitUI from '#kit/ui.mjs';

export function toast(text, ms = 2500) {
  return kitUI.toast?.(text, { ms, batch: 'class' });
}
