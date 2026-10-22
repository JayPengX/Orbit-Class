// ---- src/schedule.js ----
// Turns settings data (from data.js) into the day-by-day runtime schedule,
// plus the pure day/week-parity time helpers most other modules rely on.
import { MS_PER_DAY, WEEKDAYS_INDEX_ORDER } from './constants.js';
import { dateFromKey, dateKey } from './dates.js';
import { classesOffFrom, holidayOn } from './holidays.js';
import { state } from './state.js';
import { t } from './strings.js';

// Builds the runtime schedule rows from teacher, location, and bell-time data.
function buildSchedule() {
  state.runtimeSchedule = {};
  WEEKDAYS_INDEX_ORDER.forEach(day => {
    state.runtimeSchedule[day] = (state.applicationData.weeklySchedule[day] || [])
      .map((key, i) => {
        if (!key) return null;
        const m = state.applicationData.teacherDB[key] || [
          t('common.unknown'),
          t('common.unknown')
        ];
        const bt = state.applicationData.bellTimes[i];
        if (!bt) return null;
        return {
          key,
          n: m[0],
          t: m[1],
          s: bt[0],
          e: bt[1],
          p: i,
          isSplit: m[0].includes('/'),
          loc: state.applicationData.locationDB[key] || ''
        };
      })
      .filter(Boolean);
  });
}
// The week's number for odd/even weeks: weeks counted on from one Monday
// (2025-12-29, 2026's ISO week 1), never starting over at a new year. ISO
// week numbers did: a year with 53 weeks (2026, 2032…) ends on week 53 and
// the next begins on week 1, two odd weeks in a row, and every week after
// the new year read as the other half of the timetable until the setting
// was flipped by hand. Through 2026 this is the ISO number, so no setting
// made this year changes.
const WEEK_EPOCH = Date.UTC(2025, 11, 29);
function getWeekNumber(date) {
  const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const monday = day - ((new Date(day).getUTCDay() + 6) % 7) * MS_PER_DAY;
  return Math.round((monday - WEEK_EPOCH) / (7 * MS_PER_DAY)) + 1;
}
// Returns the current odd/even week label, respecting the reverse-week setting.
function getWeekType(now = new Date()) {
  const even = Math.abs(getWeekNumber(now)) % 2 === 0;
  return state.applicationData.reverseWeek ? (even ? '單' : '雙') : even ? '雙' : '單';
}
// Creates the small odd/even week badge used in the schedule UI.
function getWeekLabelHtml(w) {
  const label = w === '單' ? t('week.odd') : t('week.even');
  return `<span class="week-label ${w === '單' ? 'label-odd' : 'label-even'}">${label}</span>`;
}
// Returns the next weekday tab after the given day.
function getNextSchoolDay(day) {
  for (let step = 1; step <= 7; step++) {
    const next = (day + step) % 7;
    if ((state.runtimeSchedule[next] || []).length > 0) return next;
  }
  if (day >= 1 && day <= 4) return day + 1;
  return 1;
}
// The timetable's class at a weekday's period, if any.
function slotClass(day, p) {
  return (state.runtimeSchedule[day] || []).find(c => c.p === p) || null;
}
// A date's classes, 調課 applied: a swapped period holds the other side's
// class (its odd/even half that of the other side's week), in this period's
// time; a period swapped with an empty one is empty. Each swapped class
// carries `swap` (the other side: { date, p }) and `from` (the timetable's
// class it came from, for its sheet).
function classesOnDate(date) {
  const day = date.getDay();
  const base = state.runtimeSchedule[day] || [];
  const key = dateKey(date);
  const mine = (state.applicationData.classSwaps || []).flatMap(({ a, b }) =>
    a.date === key ? [[a, b]] : b.date === key ? [[b, a]] : []
  );
  if (!mine.length) return base;
  const byPeriod = new Map(base.map(c => [c.p, c]));
  for (const [here, there] of mine) {
    const thereDate = dateFromKey(there.date);
    const from = slotClass(thereDate.getDay(), there.p);
    const bt = state.applicationData.bellTimes[here.p];
    if (!from || !bt) {
      byPeriod.delete(here.p);
      continue;
    }
    const info = processSplitName(from, getWeekType(thereDate));
    byPeriod.set(here.p, {
      ...from,
      n: info.n,
      t: info.t,
      isSplit: false,
      s: bt[0],
      e: bt[1],
      p: here.p,
      swap: { date: there.date, p: there.p },
      from
    });
  }
  return [...byPeriod.values()].sort((x, y) => x.p - y.p);
}
// A date's classes as they are held: none on a national holiday or a
// typhoon day, those from a typhoon stop's hour on dropped, 調課 applied.
function classesOn(date) {
  if (holidayOn(date)) return [];
  const from = classesOffFrom(date);
  const rows = classesOnDate(date);
  return from ? rows.filter(r => !r.s || r.s < from) : rows;
}
// The date a weekday's list shows: today's, or the coming one.
function dateOfDay(day, now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((day - now.getDay() + 7) % 7));
}
// The weekday's coming date in an odd or even week ('單' / '雙'): its coming
// date, or the one a week on when that is the other week. No week: the
// coming date.
function dateOfDayInWeek(day, week, now = new Date()) {
  const date = dateOfDay(day, now);
  if (!week || getWeekType(date) === week) return date;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
}
// Chooses the correct subject and teacher for split odd/even-week classes.
// A swapped class is already one subject; it says so in the week label's place.
function processSplitName(c, week) {
  if (c.swap) return { n: c.n, t: c.t, label: `<span class="week-label label-swap">${t('swap.label')}</span>` };
  if (!c.isSplit)
    return {
      n: c.n,
      t: c.t,
      label: ''
    };
  const nP = c.n.split('/'),
    tP = c.t.split('/');
  return {
    n: week === '單' ? nP[0].trim() : nP[1].trim(),
    t: week === '單' ? tP[0].trim() : (tP[1] || tP[0]).trim(),
    label: getWeekLabelHtml(week)
  };
}

// Deterministic per-subject color hue, shared by the teacher/subject editor's
// avatars and the dashboard's class cards so the same subject always reads
// as the same color in both places.
const SUBJECT_HUES = [6, 28, 48, 145, 168, 200, 225, 265, 290, 330];
function subjectHue(subject) {
  const text = String(subject || '').trim();
  if (!text) return SUBJECT_HUES[0];
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return SUBJECT_HUES[hash % SUBJECT_HUES.length];
}

export {
  buildSchedule,
  classesOn,
  classesOnDate,
  dateOfDay,
  dateOfDayInWeek,
  getWeekNumber,
  getNextSchoolDay,
  getWeekLabelHtml,
  getWeekType,
  processSplitName,
  slotClass,
  subjectHue
};
