// ---- src/holidays.js ----
// Taiwan's national days off (the shared kit's holidays.mjs): a holiday has
// no classes, whatever the weekly timetable says, so no class card, no
// "next class" and no class notices for it. And a typhoon day (the kit's
// dayoff.mjs): 停課 announced for the school's township (the school place
// set in Orbit Weather, else home; none known, none assumed): the whole day,
// or, from an hour (12:00 起), the classes from then on.
import { twHoliday } from '#kit/holidays.mjs';
import { dayOffOn, placeOf } from '#kit/dayoff.mjs';
import * as kit from '#kit/orbit.mjs';
import * as kitLang from '#kit/lang.mjs';
import { dateKey } from './dates.js';

const schoolPlace = () => placeOf('school') || placeOf('home');
// A school in Taiwan: a school or home place set (Taiwan's), or the phone not
// abroad (kit abroad, the country of its last sign-in). A school outside
// Taiwan keeps its classes on Taiwan's holidays (2026-11-06).
// (A place from abroad, Weather's pin there, is no Taiwan county: kit placeEn.)
const inTaiwan = place => Boolean(place?.county) && (!kitLang.placeEn || Boolean(kitLang.placeEn(place.county)));
// (Read with care: an older kit has no abroad, and a test's stand-in kit throws on it.)
const abroadNow = () => {
  try {
    return Boolean(kit.abroad?.());
  } catch {
    return false;
  }
};
export const taiwanSchool = () => inTaiwan(schoolPlace()) || !abroadNow();
// The typhoon 停課 on this (local) date: { zh, en, from }, or null.
export const typhoonOn = date => {
  const place = schoolPlace();
  return place ? dayOffOn(dateKey(date), place, 'class') : null;
};
// (Before the first class, 08:00: the whole school day.)
const allDay = o => (o && (!o.from || o.from <= '08:00') ? o : null);

// The holiday on this (local) date: { zh, en }, or null.
export const holidayOn = date => (taiwanSchool() ? twHoliday(dateKey(date)) : null) ?? allDay(typhoonOn(date));
// A typhoon stop from an hour on this date ('HH:MM'), or null: classes from then on are off.
export const classesOffFrom = date => {
  const o = typhoonOn(date);
  return o && !allDay(o) ? o.from : null;
};
