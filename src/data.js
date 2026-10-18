// ---- src/data.js ----
// Reads/writes/validates/normalizes localStorage data. No DOM, no other
// src/ module may be assumed ready yet when this one's top-level code runs
// (see state.js's comment on the circular-import TDZ this ran into).
import { normalizeProAccent, normalizeProSecondary, normalizeStyleSlots } from './appearance.js';
import { isRealDate, timeToMinutes } from './dates.js';
import {
  DEFAULT_STYLE_PRIMARY,
  DEFAULT_STYLE_SECONDARY,
  WEEKDAYS_INDEX_ORDER,
  isPlainObject
} from './constants.js';
import { state } from './state.js';
import { t } from './strings.js';

// App defaults and live simulator state.
const REVERSE_WEEK_LOGIC_DEFAULT = false;
window.MANUALLY_TEST = false;
window.TEST_DAY = 1;
window.TEST_TIME_SEC = 8 * 3600;
window.IS_SIMULATING = false;

const DEFAULT_TEACHER_DB = {
  '01國文': ['國文', ''],
  '02英文': ['英文', ''],
  '03數學': ['數學', ''],
  '04歷史': ['歷史', ''],
  '10自主': ['自主學習', ''],
  '07體育': ['體育', ''],
  '08班會': ['班會課', ''],
  '06公民': ['公民', ''],
  '05地理': ['地理', '']
};

const DEFAULT_LOCATION_DB = {
  國文: '',
  英文: '',
  數學: '',
  歷史: '',
  自主: '',
  體育: '',
  班會: '',
  公民: '',
  地理: '',
  國寫: '',
  學策: '',
  英作: ''
};

const DEFAULT_WEEKLY_SCHEDULE = {
  1: [],
  2: [],
  3: [],
  4: [],
  5: []
};

const DEFAULT_BELL_TIMES = [
  ['08:00', '08:50'],
  ['09:10', '10:00'],
  ['10:10', '11:00'],
  ['11:10', '12:00'],
  ['13:00', '13:50'],
  ['14:00', '14:50'],
  ['15:00', '15:50'],
  ['15:55', '16:45']
];

const DEFAULT_BREAK_TIMES = [
  {
    name: '打掃時間',
    start: '08:50',
    end: '09:10'
  },
  {
    name: '中午時間',
    start: '12:00',
    end: '13:00'
  }
];
const DEFAULT_COUNTDOWN_EVENT = {
  name: '116 學測',
  startDate: '2027-01-22',
  endDate: '2027-01-24'
};
const DEFAULT_COUNTDOWN_EVENTS = [DEFAULT_COUNTDOWN_EVENT];
// Shared validation and normalization keeps saved and imported data predictable.
function isValidTime(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return false;
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
// `allowOvernight` lets a range's end be earlier than its start, meaning it
// crosses midnight (e.g. 18:00 -> 05:00). Only named breaks ("special time")
// may do this - bell periods (class time) always stay within one day.
function isValidTimeRange(start, end, allowOvernight = false) {
  if (!isValidTime(start) || !isValidTime(end)) return false;
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  return allowOvernight ? endMin !== startMin : endMin > startMin;
}
// Splits a start/end range into 1 or 2 same-day [start, end) pieces so an
// overnight range (end <= start, meaning it crosses midnight) can be
// compared for overlap using plain minute-of-day numbers. Every bell period
// and break recurs identically every day, so two recurring ranges overlap
// at some point iff their day-pieces overlap within a single day.
function timeRangeToDayPieces(startMin, endMin) {
  if (endMin > startMin) return [[startMin, endMin]];
  const pieces = [];
  if (startMin < 1440) pieces.push([startMin, 1440]);
  if (endMin > 0) pieces.push([0, endMin]);
  return pieces;
}
// `kind` ('bell' | 'break') travels alongside each interval/error purely so
// callers (editor-schedule.js's showEditorTimeConflict) can tell which
// editor fold to send the user to - it must not be derived by pattern-
// matching the (now-translatable) error message text, which would only
// ever match the zh-TW wording.
function validateTimeIntervals(bellTimes, breakTimes) {
  const intervals = [];
  const addInterval = (start, end, label, kind, allowOvernight) => {
    if (!isValidTimeRange(start, end, allowOvernight)) {
      const error = new Error(t('editorSchedule.invalidTimeRange', { label }));
      error.conflictKind = kind;
      throw error;
    }
    timeRangeToDayPieces(timeToMinutes(start), timeToMinutes(end)).forEach(
      ([pieceStart, pieceEnd]) => intervals.push({ start: pieceStart, end: pieceEnd, label, kind })
    );
  };
  (bellTimes || []).forEach((item, index) =>
    addInterval(
      item[0],
      item[1],
      t('editorSchedule.periodLabel', { number: index + 1 }),
      'bell',
      false
    )
  );
  (breakTimes || []).forEach(item =>
    addInterval(
      item.start,
      item.end,
      t('editorSchedule.breakLabel', { name: item.name }),
      'break',
      true
    )
  );
  intervals.sort((a, b) => a.start - b.start || a.end - b.end);
  intervals.forEach((item, index) => {
    if (index > 0 && item.start < intervals[index - 1].end) {
      const error = new Error(
        t('editorSchedule.timeConflict', { labelA: intervals[index - 1].label, labelB: item.label })
      );
      error.conflictKind =
        intervals[index - 1].kind === 'break' || item.kind === 'break' ? 'break' : 'bell';
      throw error;
    }
  });
}
function normalizeCountdownEvent(value) {
  const source = value && typeof value === 'object' ? value : {};
  const name = String(source.name || '')
    .trim()
    .slice(0, 80);
  const isDate = isRealDate;
  const legacyDate = String(source.date || '').trim();
  let startDate = String(source.startDate || legacyDate || '').trim();
  let endDate = String(source.endDate || legacyDate || startDate || '').trim();
  if (!name || !isDate(startDate) || !isDate(endDate)) return null;
  if (endDate < startDate) {
    const swap = startDate;
    startDate = endDate;
    endDate = swap;
  }
  return { name, startDate, endDate };
}
// Formats a countdown event's date(s) for display, e.g. "2027.01.22" or "2027.01.22–01.24".
// 2027.01.22, 2027.01.22–24 (one month), 2027.01.30–02.01 (one year),
// 2026.12.30–2027.01.02. `withYear: false`: the year left off (a date within
// the coming year, where the countdown says how far it is).
function formatCountdownEventDate(event, { withYear = true } = {}) {
  const dot = value => String(value || '').replaceAll('-', '.');
  if (!event) return '';
  const start = withYear ? event.startDate : event.startDate.slice(5);
  if (event.startDate === event.endDate) return dot(start);
  const sameYear = event.startDate.slice(0, 4) === event.endDate.slice(0, 4);
  const sameMonth = sameYear && event.startDate.slice(5, 7) === event.endDate.slice(5, 7);
  const endShort = event.endDate.slice(sameMonth ? 8 : sameYear || !withYear ? 5 : 0);
  return `${dot(start)}–${dot(endShort)}`;
}
function normalizeCountdownEvents(value) {
  const source = Array.isArray(value) ? value : [];
  const events = source.map(normalizeCountdownEvent).filter(Boolean).slice(0, 12);
  return events.length
    ? events
    : Array.isArray(value)
      ? []
      : DEFAULT_COUNTDOWN_EVENTS.map(event => ({ ...event }));
}
// The saved countdowns, cleaned (the app's data by default).
function getCountdownEvents(data = state.applicationData) {
  return normalizeCountdownEvents(data?.countdownEvents ?? []);
}
// The countdowns still to come or on (its last day counts): with 結束後自動刪除
// on, the others leave the list. `today` is the local day, YYYY-MM-DD.
function countdownsNotOver(events, today) {
  return (events || []).filter(e => (e.endDate || e.startDate) >= today);
}
// 調課: one-time swaps of two periods on given dates, any two dates (across
// weeks too): { a: { date: 'YYYY-MM-DD', p }, b: { date, p } }, `p` the
// period's place in the bell times. A period is in one swap at most (the
// first kept), and the two sides are never the same period.
const MAX_CLASS_SWAPS = 60;
function normalizeClassSwaps(value) {
  const isDate = isRealDate;
  const slot = v => {
    const date = String(v?.date || '');
    const p = Number(v?.p);
    return isDate(date) && Number.isInteger(p) && p >= 0 && p < 30 ? { date, p } : null;
  };
  const used = new Set();
  const out = [];
  for (const item of Array.isArray(value) ? value : []) {
    const a = slot(item?.a);
    const b = slot(item?.b);
    if (!a || !b) continue;
    const ka = `${a.date}#${a.p}`;
    const kb = `${b.date}#${b.p}`;
    if (ka === kb || used.has(ka) || used.has(kb)) continue;
    used.add(ka);
    used.add(kb);
    out.push({ a, b });
    if (out.length >= MAX_CLASS_SWAPS) break;
  }
  return out;
}
// The swaps after the bell times changed: each side's period found again by
// its time (a period deleted, added or the list sorted moved every later
// period's place, and a swap kept pointing at the place, so it moved to
// another class); a period whose time was edited in place keeps its place
// while the count is the same; a swap on a period gone is dropped.
function remapClassSwaps(swaps, before, after) {
  const list = swaps || [];
  if (!list.length || JSON.stringify(before) === JSON.stringify(after)) return list;
  const key = bt => `${bt[0]}-${bt[1]}`;
  const place = new Map((after || []).map((bt, i) => [key(bt), i]));
  const move = p => {
    const bt = (before || [])[p];
    if (!bt) return null;
    if (place.has(key(bt))) return place.get(key(bt));
    return (before || []).length === (after || []).length ? p : null;
  };
  return list.flatMap(({ a, b }) => {
    const pa = move(a.p);
    const pb = move(b.p);
    return pa == null || pb == null ? [] : [{ a: { ...a, p: pa }, b: { ...b, p: pb } }];
  });
}
// The periods in time order, each day's classes and the swaps moved with
// them. Every view takes a day's list in period order as its time order
// (the class on now, the next, the notices), and an AI answer or an older
// save could list a period out of order: the next class shown was the
// wrong one. The editor sorted its form, never the saved data.
function sortPeriodsByTime({ bellTimes, weeklySchedule, classSwaps }) {
  const minutes = value => timeToMinutes(value);
  const order = bellTimes
    .map((bt, index) => ({ index, start: minutes(bt[0]), end: minutes(bt[1]) }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index)
    .map(item => item.index);
  if (order.every((from, to) => from === to)) return { bellTimes, weeklySchedule, classSwaps };
  const place = new Map(order.map((from, to) => [from, to]));
  const rows = Object.fromEntries(
    Object.entries(weeklySchedule).map(([day, row]) => {
      const sorted = order.map(from => row[from] || '');
      while (sorted.length > row.length && !sorted[sorted.length - 1]) sorted.pop();
      return [day, [...sorted, ...row.slice(bellTimes.length)]];
    })
  );
  const move = side => ({ ...side, p: place.has(side.p) ? place.get(side.p) : side.p });
  return {
    bellTimes: order.map(from => bellTimes[from]),
    weeklySchedule: rows,
    classSwaps: (classSwaps || []).map(({ a, b }) => ({ a: move(a), b: move(b) }))
  };
}
// The swaps with a day still to come (today counts).
function swapsNotOver(swaps, today) {
  return (swaps || []).filter(s => s.a.date >= today || s.b.date >= today);
}
const ORBIT_APP_ID = 'Orbit_Color';
const ORBIT_STORAGE_SCHEMA = 'r8N3wL0yS5qM9uV7';

function getDefaultData() {
  return {
    teacherDB: DEFAULT_TEACHER_DB,
    teacherOrder: Object.keys(DEFAULT_TEACHER_DB),
    locationDB: { ...DEFAULT_LOCATION_DB },
    weeklySchedule: { ...DEFAULT_WEEKLY_SCHEDULE },
    bellTimes: DEFAULT_BELL_TIMES.map(period => [...period]),
    breakTimes: DEFAULT_BREAK_TIMES.map(item => ({ ...item })),
    countdownEvents: DEFAULT_COUNTDOWN_EVENTS.map(event => ({ ...event })),
    reverseWeek: REVERSE_WEEK_LOGIC_DEFAULT,
    pruneCountdowns: false,
    classSwaps: [],
    proAccent: DEFAULT_STYLE_PRIMARY,
    proSecondary: DEFAULT_STYLE_SECONDARY,
    styleSlots: normalizeStyleSlots([])
  };
}

function sanitizeBreakTimes(bellTimes, breakTimes = []) {
  const validBreaks = [];
  const source = Array.isArray(breakTimes) ? breakTimes : [];
  source.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const name = String(item.name || '').trim();
    const start = String(item.start || '').trim();
    const end = String(item.end || '').trim();
    if (!name && !start && !end) return;
    if (!name || !isValidTimeRange(start, end, true)) return;
    try {
      validateTimeIntervals(bellTimes, [...validBreaks, { name, start, end }]);
      validBreaks.push({ name, start, end });
    } catch {
      // Keep a valid timetable even if one optional break conflicts.
    }
  });

  DEFAULT_BREAK_TIMES.forEach(defaultBreak => {
    if (validBreaks.some(item => item.name === defaultBreak.name)) return;
    try {
      validateTimeIntervals(bellTimes, [...validBreaks, { ...defaultBreak }]);
      validBreaks.push({ ...defaultBreak });
    } catch {
      // Only add the default break when it fits the current timetable.
    }
  });

  return validBreaks;
}

// If localStorage's saved schedule fails to load for any reason - it isn't
// valid JSON, it's missing required fields, a field is the wrong shape, or
// something later on chokes while reading it - this clears the stored key
// outright rather than leaving corrupt data sitting there to fail the same
// way on every future load. loadData() falls back to a clean default
// schedule either way; clearing it here just means that's a one-time thing,
// not a repeat failure on the next visit too.
function clearStoredData() {
  try {
    localStorage.removeItem('classFocusData');
  } catch {
    /* localStorage unavailable (private browsing, etc.) - nothing to clear. */
  }
}

// Whether this browser has ever actually saved a schedule - i.e. a
// brand-new user, as opposed to one who's just looking at the (indistinguish-
// able-looking) default data loadData() also returns on a first run. Used to
// decide whether to show the first-run onboarding prompt (src/onboarding.js).
function hasSavedSchedule() {
  try {
    return !!localStorage.getItem('classFocusData');
  } catch {
    return false;
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem('classFocusData');
    if (!raw) return getDefaultData();

    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) throw new Error('saved schedule is not an object');

    const required = ['teacherDB', 'locationDB', 'weeklySchedule', 'bellTimes'];
    if (!required.every(key => Object.prototype.hasOwnProperty.call(parsed, key)))
      throw new Error('saved schedule is missing required fields');
    if (!isPlainObject(parsed.teacherDB))
      throw new Error('saved schedule has an invalid teacherDB');
    if (!isPlainObject(parsed.locationDB))
      throw new Error('saved schedule has an invalid locationDB');
    if (!isPlainObject(parsed.weeklySchedule))
      throw new Error('saved schedule has an invalid weeklySchedule');
    if (!Array.isArray(parsed.bellTimes))
      throw new Error('saved schedule has an invalid bellTimes');
    if (Object.values(parsed.teacherDB).some(value => !Array.isArray(value)))
      throw new Error('saved schedule has an invalid teacherDB entry');
    if (Object.values(parsed.weeklySchedule).some(value => !Array.isArray(value)))
      throw new Error('saved schedule has an invalid weeklySchedule entry');
    if (
      !parsed.bellTimes.every(
        item =>
          Array.isArray(item) &&
          item.length >= 2 &&
          isValidTimeRange(String(item[0] || ''), String(item[1] || ''))
      )
    )
      throw new Error('saved schedule has an invalid bellTimes entry');

    const bellTimes = parsed.bellTimes.map(item => [String(item[0]), String(item[1])]);
    const normalized = {
      teacherDB: Object.fromEntries(
        Object.entries(parsed.teacherDB).map(([key, value]) => [
          String(key).trim(),
          Array.isArray(value)
            ? [String(value[0] || ''), String(value[1] || ''), String(value[2] || '')]
            : ['', '', '']
        ])
      ),
      teacherOrder: Array.isArray(parsed.teacherOrder)
        ? parsed.teacherOrder.filter(Boolean).map(String)
        : Object.keys(parsed.teacherDB),
      locationDB: Object.fromEntries(
        Object.entries(parsed.locationDB).map(([key, value]) => [
          String(key).trim(),
          String(value || '')
        ])
      ),
      weeklySchedule: Object.fromEntries(
        WEEKDAYS_INDEX_ORDER.map(day => {
          const row = Array.isArray(
            parsed.weeklySchedule[day] || parsed.weeklySchedule[String(day)]
          )
            ? parsed.weeklySchedule[day] || parsed.weeklySchedule[String(day)]
            : [];
          return [day, row.map(item => String(item || ''))];
        })
      ),
      bellTimes,
      breakTimes: sanitizeBreakTimes(bellTimes, parsed.breakTimes),
      countdownEvents: normalizeCountdownEvents(parsed.countdownEvents),
      reverseWeek:
        typeof parsed.reverseWeek === 'boolean' ? parsed.reverseWeek : REVERSE_WEEK_LOGIC_DEFAULT,
      pruneCountdowns: parsed.pruneCountdowns === true,
      classSwaps: normalizeClassSwaps(parsed.classSwaps),
      proAccent: normalizeProAccent(parsed.proAccent),
      proSecondary: normalizeProSecondary(parsed.proSecondary),
      styleSlots: normalizeStyleSlots(parsed.styleSlots)
    };

    return { ...normalized, ...sortPeriodsByTime(normalized) };
  } catch {
    clearStoredData();
    return getDefaultData();
  }
}
// Persists the editable schedule data in the browser.
function saveData(d) {
  try {
    localStorage.setItem(
      'classFocusData',
      JSON.stringify({ ...d, __orbit: { app: ORBIT_APP_ID, schema: ORBIT_STORAGE_SCHEMA } })
    );
  } catch {
    // localStorage can throw (private browsing, quota exceeded) - nothing
    // more useful to do here than drop this save attempt.
  }
}
export {
  countdownsNotOver,
  getCountdownEvents,
  ORBIT_APP_ID,
  ORBIT_STORAGE_SCHEMA,
  REVERSE_WEEK_LOGIC_DEFAULT,
  formatCountdownEventDate,
  getDefaultData,
  hasSavedSchedule,
  isValidTimeRange,
  loadData,
  normalizeCountdownEvent,
  normalizeCountdownEvents,
  normalizeClassSwaps,
  remapClassSwaps,
  sanitizeBreakTimes,
  saveData,
  sortPeriodsByTime,
  swapsNotOver,
  validateTimeIntervals
};
