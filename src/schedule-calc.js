// ---- src/schedule-calc.js ----
// Pure computation for the dashboard's "what's happening right now" state -
// no DOM access, no shared `state` reads/writes. Extracted out of
// dashboard.js's update() (which still owns the per-second orchestration
// and all the actual DOM writes) specifically so this part - the part with
// real branching logic worth getting right - can be unit tested and
// reasoned about without booting the whole app.
import { pad2, parseTime, processSplitName } from './schedule.js';
import { t } from './strings.js';

// Class/break countdowns used to always render as minutes:seconds, which
// reads fine for a ~50-minute class but turns an overnight special time
// (which can run many hours) into a meaningless triple-digit minute count
// like "540:00" instead of "9:00:00". Show hours whenever there are any.
function formatCountdown(diffSeconds) {
  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`;
}

function decorateSpecialTimeName(name) {
  return name ? name.trim() : '';
}

// A named break/special time (e.g. 18:00 -> 05:00 lights-out) recurs every
// day regardless of whether that day has any classes, so its countdown and
// progress need computing the same way whether or not it's a school day.
function computeBreakView(activeBreak, secs) {
  const SECONDS_PER_DAY = 86400;
  const breakStart = parseTime(activeBreak.start) * 60;
  let breakEnd = parseTime(activeBreak.end) * 60;
  let curSecs = secs;
  if (breakEnd <= breakStart) {
    // Crosses midnight: push the end (and "now", if we're past midnight in
    // the early-morning tail) onto the same continuous timeline as the
    // start so the countdown/progress math below stays linear.
    breakEnd += SECONDS_PER_DAY;
    if (curSecs < breakStart) curSecs += SECONDS_PER_DAY;
  }
  return {
    statusText: decorateSpecialTimeName(activeBreak.name),
    timerValue: formatCountdown(breakEnd - curSecs),
    progressPercent: Math.min(100, ((curSecs - breakStart) / (breakEnd - breakStart)) * 100)
  };
}

/**
 * @param {object} input
 * @param {Date} input.now
 * @param {number} input.curDay - 0-6, Date.getDay() convention
 * @param {string} input.week - '單' or '雙', from getWeekType()
 * @param {Array} input.todaySchedule - runtimeSchedule[curDay]
 * @param {Array} input.breakTimes - applicationData.breakTimes
 * @returns a plain view-model object describing everything the dashboard
 *   needs to render for "now" - no DOM, no side effects, safe to call as
 *   often as needed (including every second, which is exactly how the
 *   real per-second tick uses it).
 */
export function computeDashboardViewModel({ now, curDay, week, todaySchedule, breakTimes }) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const today = todaySchedule || [];
  const lastClass = today[today.length - 1];
  const isSchoolDay = today.length > 0;
  const isDayFinished = isSchoolDay && !!lastClass && mins >= parseTime(lastClass.e);

  let curIdx = -1;
  let nxtIdx = -1;
  today.forEach((c, i) => {
    if (mins >= parseTime(c.s) && mins < parseTime(c.e)) curIdx = i;
    if (mins < parseTime(c.s) && nxtIdx === -1) nxtIdx = i;
  });
  let activeBreak =
    curIdx === -1
      ? (breakTimes || []).find(item => {
          if (!item.name || !item.start || !item.end) return false;
          const startMin = parseTime(item.start);
          const endMin = parseTime(item.end);
          // endMin <= startMin means the break crosses midnight (e.g. 18:00
          // -> 05:00): it's active from start through midnight, then again
          // from midnight through end, so either side of "now" counts.
          return endMin > startMin
            ? mins >= startMin && mins < endMin
            : mins >= startMin || mins < endMin;
        })
      : null;
  // On a day with no classes (weekend, holiday), a same-day break like
  // 中午時間 only means anything relative to a school day's schedule, so it
  // shouldn't show as "active" here - only an overnight break (e.g. a
  // lights-out sleep window crossing midnight) still applies.
  if (!isSchoolDay && activeBreak && parseTime(activeBreak.end) > parseTime(activeBreak.start)) {
    activeBreak = null;
  }

  // statusText/nextText/nextMeta/dotState/timerVisible/progressVisible are
  // unconditionally set in every branch below (isSchoolDay true or false),
  // so they're declared without an initial value on purpose.
  let statusText;
  let nextText;
  let teacherText = '';
  let placeText = '';
  let nextMeta;
  let classLabel = '';
  let dotState; // 'none' | 'wait' | 'active'
  let timerVisible;
  let timerLabel = '';
  let timerValue = '';
  let progressVisible;
  let progressIsClass = false;
  let progressPercent = 0;
  let activeClassKey = '';
  let upcomingClassKey = '';
  // The stretch now is in, as a clock range (10:10–11:00): the card's corner.
  let spanText = '';

  if (isSchoolDay) {
    if (activeBreak) {
      const breakView = computeBreakView(activeBreak, secs);
      statusText = breakView.statusText;
      dotState = 'wait';
      timerVisible = true;
      timerLabel = t('dashboard.duringClass');
      timerValue = breakView.timerValue;
      progressVisible = true;
      progressIsClass = false;
      progressPercent = breakView.progressPercent;
      spanText = `${activeBreak.start}–${activeBreak.end}`;
      curIdx = -1;
      // nxtIdx is left exactly as the forEach above already computed it -
      // the first today's-class whose start time hasn't passed yet,
      // regardless of any break. A special time (in the everyday sense:
      // 打掃時間 between two periods, a between-period assembly, ...) is a
      // temporary interruption, not the end of the school day - if there's
      // still a real class coming up today, the "next" preview should keep
      // showing it exactly like it would between any two ordinary periods.
      // It naturally still comes out -1 on its own for a break that really
      // does mean "no more school today" (this fixture's overnight 就寢
      // break during its evening portion, or any break sitting after the
      // last period) - nothing here needs to force that case specially.
    } else if (curIdx !== -1) {
      const info = processSplitName(today[curIdx], week);
      statusText = info.n;
      teacherText = info.t;
      classLabel = info.label || '';
      placeText = today[curIdx].loc || '';
      activeClassKey = today[curIdx].key || '';
      dotState = 'active';
      timerVisible = true;
      timerLabel = t('dashboard.betweenClasses');
      const endSec = parseTime(today[curIdx].e) * 60;
      const startSec = parseTime(today[curIdx].s) * 60;
      timerValue = formatCountdown(endSec - secs);
      progressVisible = true;
      progressIsClass = true;
      progressPercent = Math.min(100, ((secs - startSec) / (endSec - startSec)) * 100);
      spanText = `${today[curIdx].s}–${today[curIdx].e}`;
    } else {
      dotState = 'wait';
      const firstStart = parseTime('08:00');
      const lastEnd = lastClass ? parseTime(lastClass.e) : parseTime('16:45');
      if (mins < firstStart) {
        statusText = t('dashboard.notStarted');
        timerVisible = false;
        progressVisible = false;
      } else if (mins >= lastEnd) {
        statusText = t('dashboard.schoolOver');
        dotState = 'none';
        timerVisible = false;
        progressVisible = false;
      } else {
        timerVisible = true;
        timerLabel = t('dashboard.duringClass');
        statusText = t('dashboard.betweenClasses');
        if (nxtIdx !== -1) {
          const nextStart = parseTime(today[nxtIdx].s) * 60;
          timerValue = formatCountdown(nextStart - secs);
          const prevEnd =
            nxtIdx > 0 ? parseTime(today[nxtIdx - 1].e) * 60 : parseTime('08:00') * 60;
          progressVisible = true;
          progressIsClass = false;
          progressPercent = Math.min(100, ((secs - prevEnd) / (nextStart - prevEnd)) * 100);
          if (nxtIdx > 0) spanText = `${today[nxtIdx - 1].e}–${today[nxtIdx].s}`;
        } else {
          progressVisible = false;
        }
      }
    }
    if (nxtIdx !== -1) {
      const info = processSplitName(today[nxtIdx], week);
      nextText = info.n;
      nextMeta = [today[nxtIdx].s, info.t, today[nxtIdx].loc].filter(Boolean).join(' · ');
      upcomingClassKey = today[nxtIdx].key || '';
    } else {
      nextText = curDay === 5 ? t('dashboard.seeYouWeekend') : t('dashboard.seeYouTomorrow');
      nextMeta = '';
    }
  } else if (activeBreak) {
    const breakView = computeBreakView(activeBreak, secs);
    statusText = breakView.statusText;
    dotState = 'wait';
    timerVisible = true;
    timerLabel = t('dashboard.duringClass');
    timerValue = breakView.timerValue;
    progressVisible = true;
    progressIsClass = false;
    progressPercent = breakView.progressPercent;
    nextText = t('dashboard.seeYouMonday');
    nextMeta = '';
  } else {
    statusText = t('dashboard.noSchoolToday');
    nextText = t('dashboard.seeYouMonday');
    dotState = 'none';
    timerVisible = false;
    progressVisible = false;
    nextMeta = '';
  }

  const compactStatus = !timerVisible;
  const metaRowVisible = !compactStatus && !!(teacherText || placeText || classLabel);

  return {
    curDay,
    curIdx,
    nxtIdx,
    isSchoolDay,
    isDayFinished,
    activeBreakName: activeBreak ? activeBreak.name : '',
    activeBreak: activeBreak || null,
    statusText,
    teacherText,
    placeText,
    classLabel,
    nextText,
    nextMeta,
    dotState,
    timerVisible,
    timerLabel,
    timerValue,
    progressVisible,
    progressIsClass,
    progressPercent,
    compactStatus,
    metaRowVisible,
    activeClassKey,
    upcomingClassKey,
    spanText
  };
}

export { pad2 };

/**
 * The next class today when it starts within `lead` minutes (for a notice):
 * { tag, name, start, meta }, else null. `tag` is the same all the minutes
 * before one class, so it's announced once.
 */
// When a class's notice goes: as the break before it starts (a short break
// is the time to get there), or five minutes before it after a long one
// (lunch) or as the day's first. In minutes before the class.
export const LONG_BREAK = 15;
export function noticeLead(schedule, i) {
  const prev = schedule[i - 1];
  const gap = prev ? parseTime(schedule[i].s) - parseTime(prev.e) : Infinity;
  return gap > 0 && gap <= LONG_BREAK ? gap : 5;
}
export function classStartingSoon({ now, week, todaySchedule }) {
  const list = todaySchedule || [];
  const mins = now.getHours() * 60 + now.getMinutes();
  const i = list.findIndex(c => parseTime(c.s) > mins);
  if (i < 0) return null;
  const next = list[i];
  const lead = noticeLead(list, i);
  if (parseTime(next.s) - mins > lead) return null;
  const info = processSplitName(next, week);
  const day = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const secsLeft = parseTime(next.s) * 60 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
  return {
    tag: `class:${day}:${next.s}`,
    name: info.n,
    start: next.s,
    lead,
    // Minutes to go now, and whether this is the notice's own minute: an app
    // opened later in the break already shows the time left on its card.
    left: Math.max(1, Math.ceil(secsLeft / 60)),
    due: secsLeft > (lead - 1) * 60,
    meta: [next.s, info.t, next.loc].filter(Boolean).join(' · ')
  };
}

// The summary card on 今天, as one thing to read (src/dashboard.js draws it).
// In class: the class, the time left, the next class along the foot. Waiting
// for a class (a break, lunch, the morning): the class coming is the card,
// its time to start the sentence, the break named on the top line, the class
// after it along the foot. A break that stands on its own (bedtime, one that
// ends long before the next class) is the card itself, with the time until
// it ends. Otherwise the day's state, and the next school day's first class
// along the foot (`nextDay`: { label, first, week }).
// Returns { mode, kicker, span, title, teacher, place, label, timer, progress, foot },
// foot either { label, name, time, sub } or { note }, timer { value, label }.
export function heroView(vm, { now, week, todaySchedule, nextDay = null, holiday = null }) {
  const today = todaySchedule || [];
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const about = (c, w) => {
    const info = processSplitName(c, w);
    return { title: info.n, subject: info.n, teacher: info.t || '', place: c.loc || '', label: info.label || '' };
  };
  const footFor = (c, w, label) => {
    const info = processSplitName(c, w);
    return { label, name: info.n, subject: info.n, time: c.s, sub: [info.t, c.loc].filter(Boolean).join(' · ') };
  };
  const last = today[today.length - 1];
  const lastNote = () => ({ note: t('dashboard.lastPeriodNote', { time: last.e }) });
  const dayFoot = () => (nextDay?.first ? footFor(nextDay.first, nextDay.week, nextDay.label) : null);
  const none = { teacher: '', place: '', label: '' };

  if (vm.curIdx >= 0) {
    const c = today[vm.curIdx];
    return {
      mode: 'class',
      kicker: t('dashboard.periodNow', { n: vm.curIdx + 1 }),
      span: `${c.s}–${c.e}`,
      ...about(c, week),
      timer: { value: vm.timerValue, label: t('dashboard.untilEnd') },
      progress: vm.progressPercent,
      foot: vm.nxtIdx >= 0 ? footFor(today[vm.nxtIdx], week, t('dashboard.nextPeriod')) : lastNote()
    };
  }
  const next = vm.isSchoolDay && vm.nxtIdx >= 0 ? today[vm.nxtIdx] : null;
  const startSec = next ? parseTime(next.s) * 60 : 0;
  // A break leads only when it isn't simply the wait for the next class:
  // nothing comes after it today, or it ends more than a long break before.
  const brk = vm.activeBreakName ? vm.activeBreak : null;
  const breakLeads = brk && (!next || startSec - parseTime(brk.end) * 60 > LONG_BREAK * 60 || parseTime(brk.end) < parseTime(brk.start));
  if (next && !breakLeads) {
    const n = vm.nxtIdx + 1;
    const prev = today[vm.nxtIdx - 1];
    const from = prev ? parseTime(prev.e) * 60 : brk ? parseTime(brk.start) * 60 : null;
    const waiting = brk || prev;
    return {
      mode: waiting ? 'break' : 'before',
      kicker: waiting ? t('dashboard.breakThen', { name: brk?.name || t('dashboard.betweenClasses'), n }) : t('dashboard.firstThen', { n }),
      span: `${next.s}–${next.e}`,
      ...about(next, week),
      timer: { value: formatCountdown(Math.max(0, startSec - secs)), label: t('dashboard.untilStart') },
      progress: from != null && startSec > from ? Math.min(100, Math.max(0, ((secs - from) / (startSec - from)) * 100)) : null,
      foot: today[vm.nxtIdx + 1] ? footFor(today[vm.nxtIdx + 1], week, t('dashboard.thenLabel')) : lastNote()
    };
  }
  if (brk) {
    return {
      mode: 'break',
      kicker: '',
      span: `${brk.start}–${brk.end}`,
      title: brk.name,
      ...none,
      timer: { value: vm.timerValue, label: t('dashboard.untilBreakEnd') },
      progress: vm.progressPercent,
      foot: next ? footFor(next, week, t('dashboard.nextPeriod')) : dayFoot()
    };
  }
  // A national holiday: its name, and the next school day's first class.
  if (holiday) return { mode: 'off', kicker: t('dashboard.holidayKicker'), span: '', title: t('dashboard.holidayTitle', { zh: holiday.zh, en: holiday.en || holiday.zh }), ...none, timer: null, progress: null, foot: dayFoot() };
  return { mode: 'off', kicker: '', span: '', title: vm.statusText, ...none, timer: null, progress: null, foot: dayFoot() };
}
