// ---- src/holidays.js ----
// Taiwan's national days off (the shared kit's holidays.mjs): a holiday has
// no classes, whatever the weekly timetable says, so no class card, no
// "next class" and no class notices for it. An older kit without the file:
// every weekday a school day, as before.
import { dateKey } from './dates.js';

let kitHolidays = null;
export const holidaysReady = import('#kit/holidays.mjs')
  .then(m => (kitHolidays = m))
  .catch(() => null);

// The holiday on this (local) date: { zh, en }, or null.
export const holidayOn = date => kitHolidays?.twHoliday?.(dateKey(date)) ?? null;
// For the tests.
export const useHolidays = m => (kitHolidays = m);
