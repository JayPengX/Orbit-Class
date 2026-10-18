// ---- src/dates.js ----
// A day as the app writes it (YYYY-MM-DD, the device's local date) and back:
// 調課's sides, the holidays, the countdowns, the notices' tags. One place,
// imports nothing, so every module can use it (holidays.js sits under
// schedule.js).

// Pads a number to two digits for clock display.
export function pad2(n) {
  return String(n).padStart(2, '0');
}
// A date's day: YYYY-MM-DD, local.
export function dateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
// YYYY-MM-DD back to that day's local midnight.
export function dateFromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
// HH:MM to minutes after midnight (a time the app wrote: no checking).
export function parseTime(value) {
  const [h, m] = String(value).split(':').map(Number);
  return h * 60 + m;
}
// HH:MM to minutes, anything else 9999 (sorts last): for times being typed
// or read in (the editor, an import), where a field can be half filled.
export function timeToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return 9999;
  return parseTime(value);
}
// Whether text is a real calendar day (YYYY-MM-DD): 2026-02-30 and 2026-13-01
// are not (Date.parse rolls the first over to March, so it can't tell).
export function isRealDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  return dateKey(dateFromKey(text)) === text;
}
