// ---- src/holidays.js ----
// Taiwan's national days off (the shared kit's holidays.mjs): a holiday has
// no classes, whatever the weekly timetable says, so no class card, no
// "next class" and no class notices for it. And a typhoon day (the kit's
// dayoff.mjs): 停課 announced for the school's township (the school place
// set in Orbit Weather, else home; none known, none assumed): the whole day,
// or, from an hour (12:00 起), the classes from then on.
import { twHoliday } from '#kit/holidays.mjs';
import { dayOffOn, placeOf } from '#kit/dayoff.mjs';
import { dateKey } from './dates.js';

const schoolPlace = () => placeOf('school') || placeOf('home');
// The typhoon 停課 on this (local) date: { zh, en, from }, or null.
export const typhoonOn = date => {
  const place = schoolPlace();
  return place ? dayOffOn(dateKey(date), place, 'class') : null;
};
// (Before the first class, 08:00: the whole school day.)
const allDay = o => (o && (!o.from || o.from <= '08:00') ? o : null);

// The holiday on this (local) date: { zh, en }, or null.
export const holidayOn = date => twHoliday(dateKey(date)) ?? allDay(typhoonOn(date));
// A typhoon stop from an hour on this date ('HH:MM'), or null: classes from then on are off.
export const classesOffFrom = date => {
  const o = typhoonOn(date);
  return o && !allDay(o) ? o.from : null;
};
