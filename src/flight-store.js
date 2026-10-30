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

// The focus on this phone, or null.
export function loadFocus() {
  try {
    return readFocus(localStorage.getItem(STORE_KEY));
  } catch {
    return null;
  }
}
