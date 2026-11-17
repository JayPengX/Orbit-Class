// ---- src/holidays.js ----
// Taiwan's national days off (the shared kit's holidays.mjs): a holiday has
// no classes, whatever the weekly timetable says, so no class card, no
// "next class" and no class notices for it. So has 寒假 and 暑假 (below).
// And a typhoon day (the kit's
// dayoff.mjs): 停課 announced for the school's township (the school place
// set in Orbit Weather, else home; none known, none assumed): the whole day,
// or, from an hour (12:00 起), the classes from then on.
import { twHoliday } from '#kit/holidays.mjs';
import { dayOffOn, placeOf } from '#kit/dayoff.mjs';
import { dateKey } from './dates.js';

const schoolPlace = () => placeOf('school') || placeOf('home');
// (測試工具's classOff switch, today only: testing.js.)
const testOff = date => {
  const f = globalThis.ORBIT_TEST?.flags?.classOff;
  return f && dateKey(date) === dateKey(new Date()) ? f : '';
};
// The typhoon 停課 on this (local) date: { zh, en, from }, or null.
export const typhoonOn = date => {
  const f = testOff(date);
  if (f === 'typhoon' || f === 'afternoon') return { zh: '颱風停課（測試）', en: 'Typhoon day off (test)', from: f === 'afternoon' ? '12:00' : '' };
  const place = schoolPlace();
  return place ? dayOffOn(dateKey(date), place, 'class') : null;
};
// (Before the first class, 08:00: the whole school day.)
const allDay = o => (o && (!o.from || o.from <= '08:00') ? o : null);

// 寒假 and 暑假, as 教育部 set them for 高級中等以下學校 each 學年度 (the
// first day off, the last), by the year they fall in. The rule (各級學校學生
// 學年學期假期辦法 §4): 寒假 1/21–2/10, 暑假 7/1–8/29, moved for 春節.
// 竹東高中's own 行事曆 has the same days (114-2: 開學 2/23, 暑假 7/1, 開學
// 8/31; 115-1: 結業式 1/20, 寒假 1/21–2/10, 開學 2/11). Add each year as
// 教育部 publishes it (in June, for the 學年度 from August). A year not
// listed: the rule, 寒假 running on through 春節's days off when they end
// after 2/10, as 教育部 did in 2026 (no school days between the two).
const BREAKS = {
  2026: { winter: ['01-24', '02-22'], summer: ['07-01', '08-30'] }, // 114學年度 寒假; 暑假, 115學年度 from 8/31
  2027: { winter: ['01-21', '02-10'] } // 115學年度
};
const WINTER = { zh: '寒假', en: 'Winter break' };
const SUMMER = { zh: '暑假', en: 'Summer break' };
const nextKey = key => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8) + 1)).toISOString().slice(0, 10);
const weekend = key => [0, 6].includes(new Date(`${key}T12:00:00Z`).getUTCDay());
// The rule's 寒假 end: 2/10, or 春節's last day off and the weekend after.
function winterEnd(y) {
  let end = `${y}-02-10`;
  for (let k = `${y}-02-11`; k <= `${y}-02-28`; k = nextKey(k)) if (/^(小年夜|除夕|春節)/.test(twHoliday(k)?.zh || '')) end = k;
  while (end > `${y}-02-10` && (weekend(nextKey(end)) || twHoliday(nextKey(end)))) end = nextKey(end);
  return end.slice(5);
}
const years = new Map();
const breaksOf = y => {
  if (!years.has(y)) years.set(y, { winter: BREAKS[y]?.winter || ['01-21', winterEnd(y)], summer: BREAKS[y]?.summer || ['07-01', '08-29'] });
  return years.get(y);
};
// 寒假 or 暑假 on this (local) date: { zh, en }, or null.
export const schoolBreakOn = date => {
  const key = dateKey(date);
  const { winter, summer } = breaksOf(+key.slice(0, 4));
  const md = key.slice(5);
  return md >= winter[0] && md <= winter[1] ? WINTER : md >= summer[0] && md <= summer[1] ? SUMMER : null;
};

// The day off on this (local) date: { zh, en } (a holiday by its name, 春節
// within 寒假 too), or null.
export const holidayOn = date => (testOff(date) === 'holiday' ? { zh: '假日（測試）', en: 'Holiday (test)' } : null) ?? twHoliday(dateKey(date)) ?? schoolBreakOn(date) ?? allDay(typhoonOn(date));
// A typhoon stop from an hour on this date ('HH:MM'), or null: classes from then on are off.
export const classesOffFrom = date => {
  const o = typhoonOn(date);
  return o && !allDay(o) ? o.from : null;
};
