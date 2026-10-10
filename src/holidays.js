// ---- src/holidays.js ----
// Taiwan's national days off (the shared kit's holidays.mjs): a holiday has
// no classes, whatever the weekly timetable says, so no class card, no
// "next class" and no class notices for it. An older kit without the file:
// every weekday a school day, as before.
let kitHolidays = null;
export const holidaysReady = import('#kit/holidays.mjs')
  .then(m => (kitHolidays = m))
  .catch(() => null);

const ymd = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
// The holiday on this (local) date: { zh, en }, or null.
export const holidayOn = date => kitHolidays?.twHoliday?.(ymd(date)) ?? null;
// For the tests.
export const useHolidays = m => (kitHolidays = m);
