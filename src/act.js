// ---- src/act.js ----
// A command said to Class (Jay 11-14: the AI box and 問 Orbit also do, not
// only answer): 「開始專注飛行 50 分鐘」, 「加段考倒數 11/30」. Read by the
// kit's code (kit act.mjs), never an AI call. Each is done the way its own
// buttons do it: the focus opens 專注飛行 on that length and starts when a
// plane is picked; a countdown is offered with the editor's 套用 (the same
// confirm every AI edit goes through, editor-nl-edit.js).
import { normalizeCountdownEvents } from './data.js';

// The kit's reader; null on a kit from before it (phones may run an older one).
export async function readClassAct(text, now = new Date()) {
  const kit = await import('#kit/act.mjs').catch(() => null);
  const act = kit?.readAct?.(text, { now });
  return act?.app === 'orbit' ? act : null;
}

// 專注飛行 on the length said (the editor folded away first when nothing in it is unsaved).
export async function startFocus(act, { closeEditor = () => {} } = {}) {
  closeEditor();
  const m = await import('./flight.js');
  m.openFlight({ minutes: act.minutes });
}

// The settings with the countdown added: { next } or { error } (12 at most, as the editor holds).
export function withCountdown(current, act) {
  const now = normalizeCountdownEvents(current.countdownEvents ?? []);
  if (now.some(e => e.name === act.name && e.startDate === act.start)) return { same: true };
  if (now.length >= 12) return { error: 'full' };
  const countdownEvents = normalizeCountdownEvents([...now, { name: act.name, startDate: act.start, endDate: act.end || '' }]);
  return { next: { ...current, countdownEvents } };
}
