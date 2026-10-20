// ---- src/holidays.js ----
// Taiwan's national days off (the shared kit's holidays.mjs): a holiday has
// no classes, whatever the weekly timetable says, so no class card, no
// "next class" and no class notices for it.
import { twHoliday } from '#kit/holidays.mjs';
import { dateKey } from './dates.js';

// The holiday on this (local) date: { zh, en }, or null.
export const holidayOn = date => twHoliday(dateKey(date)) ?? null;
