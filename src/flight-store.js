// ---- src/flight-store.js ----
// 專注飛行's focus as kept on the phone, and how it's written: nothing from
// the kit, so 工具's card and the start-up can read it without loading the
// flight's code (src/flight.js, flight-plan.js).
export const STORE_KEY = 'class.flight.v1';

// A focus read back: one of ours, still sane; else null (never half of one).
export function readFocus(text) {
  try {
    const f = JSON.parse(text || 'null');
    const okLeg = l => l && /^[0-9a-f]{6}$/.test(l.hex) && l.fix && Number.isFinite(l.fix.lat) && Number.isFinite(l.to?.lat) && Number.isFinite(l.from?.lat);
    return f?.v === 1 && Number.isFinite(f.end) && Number.isFinite(f.start) && Array.isArray(f.legs) && f.legs.length && f.legs.every(okLeg) ? f : null;
  } catch {
    return null;
  }
}

export const focusLeft = (focus, now) => Math.max(0, focus.end - now);

export const currentLeg = focus => focus.legs[focus.legs.length - 1];

// 25:00, 1:05:09.
export function clock(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = n => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

// BR190 → BR 190.
export const flightNo = no => String(no || '').replace(/^([A-Z0-9]{2}|[A-Z]{3})(\d{1,4}[A-Z]{0,2})$/, '$1 $2');

// One account, many places (Jay 2026-11-13: what's under way follows the
// account): a focus begun, handed to another plane, landed or ended goes to
// the Pass too (the session's putNow; Orbit-Core eco.js eco-now), from the
// place that runs Class, so Class opened anywhere else (Orbit, the separate
// app, the iPad) flies the same flight. The plane's latest fix and whether
// it's shrunk to the pill are each screen's own. Newer wins; an end is a change.
const AT_KEY = 'class.flight.at';
const atHere = () => {
  try {
    return Number(localStorage.getItem(AT_KEY)) || 0;
  } catch {
    return 0;
  }
};
const noteAt = at => {
  try {
    localStorage.setItem(AT_KEY, String(at));
  } catch {
    // (A full store: this run still works.)
  }
};
// This opening has heard the Pass; a change made before it (a flight kept
// here landing as Class opens) waits for it, and gives way to anything newer
// there than this phone's last word (ended in the other app since).
let heard = false;
let held = null;
// Changed here: sent up (not from a copy another place has taken over).
export function focusChanged(q, focus, at = Date.now()) {
  if (!q?.putNow || q.canSave === false) return;
  if (!heard) held = { at, base: held ? held.base : atHere() };
  noteAt(at);
  // (`until`: when it lands; Orbit's window opens on the app with something under way.)
  if (heard) q.putNow('flight', focus || null, at, { until: focus?.end || undefined });
}
// The Pass's shelf (a claim's, the sign-in's): a focus changed there after
// here kept on this phone (→ true: the flight's screen takes it up); one
// changed here after there sent up (held for it, or never got through).
export function focusFromPass(q, shelf) {
  const e = shelf?.flight;
  const h = held;
  held = null;
  heard = true;
  const mine = h ? h.base : atHere();
  if (e && e.at > mine) {
    const f = e.v ? readFocus(JSON.stringify(e.v)) : null;
    try {
      if (f) localStorage.setItem(STORE_KEY, JSON.stringify(f));
      else localStorage.removeItem(STORE_KEY);
    } catch {
      return false;
    }
    noteAt(e.at);
    return true;
  }
  const at = h ? h.at : mine;
  if (at > (e?.at || 0) && q?.canSave !== false) {
    const f = loadFocus();
    q?.putNow?.('flight', f, at, { until: f?.end || undefined });
  }
  return false;
}
// A claim that came back without a shelf (a Worker without one): heard all the same.
export const focusHeard = q => heard || focusFromPass(q, {});

// The focus on this phone, or null.
export function loadFocus() {
  try {
    return readFocus(localStorage.getItem(STORE_KEY));
  } catch {
    return null;
  }
}
