import { describe, expect, it } from 'vitest';
import { classStartingSoon, computeDashboardViewModel, heroView, noticeLead } from '../src/schedule-calc.js';

// A 3-period Monday with one split (單/雙 week) class in the middle, and the
// default 打掃時間 break sitting exactly between periods 0 and 1 - same
// shape as test/helpers/fixtureData.js, but exercised directly against the
// pure function instead of through a full app boot.
const todaySchedule = [
  { key: 'A', n: '數學', t: '王老師', s: '08:00', e: '08:50', isSplit: false, loc: '101' },
  {
    key: 'B',
    n: '國文/公民',
    t: '李老師/陳老師',
    s: '09:10',
    e: '10:00',
    isSplit: true,
    loc: '102'
  },
  { key: 'C', n: '英文', t: '林老師', s: '10:10', e: '11:00', isSplit: false, loc: '103' }
];
const breakTimes = [{ name: '打掃時間', start: '08:50', end: '09:10' }];

function at(hh, mm, ss = 0) {
  const now = new Date('2024-01-08T00:00:00'); // a Monday, arbitrary - only H:M:S matter here
  now.setHours(hh, mm, ss, 0);
  return now;
}

function compute(now, overrides = {}) {
  return computeDashboardViewModel({
    now,
    curDay: 1,
    week: '單',
    todaySchedule,
    breakTimes,
    ...overrides
  });
}

describe('computeDashboardViewModel - boundary cases', () => {
  it('before the first period: 尚未開始, no timer, no progress', () => {
    const vm = compute(at(7, 30));
    expect(vm.statusText).toBe('尚未開始');
    expect(vm.timerVisible).toBe(false);
    expect(vm.progressVisible).toBe(false);
    expect(vm.dotState).toBe('wait');
  });

  it('exactly at a period start boundary: counts as in-class', () => {
    const vm = compute(at(8, 0, 0));
    expect(vm.statusText).toBe('數學');
    expect(vm.dotState).toBe('active');
  });

  it('one second before a period ends: still in-class, 1 second left', () => {
    const vm = compute(at(8, 49, 59));
    expect(vm.statusText).toBe('數學');
    expect(vm.timerValue).toBe('0:01');
  });

  it('exactly at a period end boundary: no longer in that class', () => {
    const vm = compute(at(8, 50, 0));
    expect(vm.statusText).not.toBe('數學');
  });

  it('mid-class: progress is proportional to elapsed time', () => {
    // 08:25:00 is 25 of 50 minutes into 08:00-08:50 -> 50%
    const vm = compute(at(8, 25, 0));
    expect(vm.progressPercent).toBeCloseTo(50, 5);
    expect(vm.progressIsClass).toBe(true);
  });

  it('during the auto-injected break between periods: shows the break name, not a class', () => {
    const vm = compute(at(9, 0, 0));
    expect(vm.statusText).toBe('打掃時間');
    expect(vm.dotState).toBe('wait');
    expect(vm.teacherText).toBe('');
  });

  it('still previews the real next class during a special time that sits between two periods', () => {
    // 打掃時間 (08:50-09:10) is a routine interruption between period 0 and
    // period 1, not the end of the school day - the "next" panel should
    // keep showing 國文/公民 at 09:10 the whole time, not fall back to a
    // sign-off the way it correctly does once the day is actually over.
    const vm = compute(at(9, 0, 0));
    expect(vm.statusText).toBe('打掃時間'); // still the special time as the main status
    expect(vm.nxtIdx).toBe(1);
    expect(vm.nextText).toBe('國文'); // week: '單' in the shared `compute()` fixture
    expect(vm.nextMeta).toBe('09:10 · 李老師 · 102');
  });

  it('during a between-period gap with no named break: 下課, counts down to the next period', () => {
    // there's no break defined for 10:00-10:10; falls through to the
    // generic "下課, waiting for next period" branch
    const vm = compute(at(10, 5, 0), { breakTimes: [] });
    expect(vm.statusText).toBe('下課');
    expect(vm.timerVisible).toBe(true);
  });

  it('split-week class resolves the correct half for each week label', () => {
    const single = compute(at(9, 30, 0), { week: '單' });
    expect(single.statusText).toBe('國文');
    expect(single.teacherText).toBe('李老師');

    const double = compute(at(9, 30, 0), { week: '雙' });
    expect(double.statusText).toBe('公民');
    expect(double.teacherText).toBe('陳老師');
  });

  it('after the last period ends: 放學時間, isDayFinished true', () => {
    const vm = compute(at(11, 0, 0));
    expect(vm.statusText).toBe('放學時間');
    expect(vm.isDayFinished).toBe(true);
    expect(vm.dotState).toBe('none');
  });

  it('on a day with no classes at all: 今日無課', () => {
    // breakTimes: [] isolates this from any break that happens to be active
    // at 9:00 - see the dedicated "no school day" describe block below for
    // that interaction.
    const vm = compute(at(9, 0, 0), { todaySchedule: [], breakTimes: [] });
    expect(vm.statusText).toBe('今日無課');
    expect(vm.isSchoolDay).toBe(false);
    expect(vm.isDayFinished).toBe(false);
  });

  it('next-class preview reflects the split label too', () => {
    const vm = compute(at(8, 20, 0), { week: '雙' });
    expect(vm.nextText).toBe('公民');
    expect(vm.nextMeta).toBe('09:10 · 陳老師 · 102');
  });

  it('last class of the day has no next class: weekday-dependent sign-off text', () => {
    const friday = compute(at(10, 30, 0), { curDay: 5 });
    expect(friday.nextText).toBe('週末愉快');
    const tuesday = compute(at(10, 30, 0), { curDay: 2 });
    expect(tuesday.nextText).toBe('再見');
  });
});

describe('computeDashboardViewModel - overnight (cross-midnight) special time', () => {
  const overnightBreak = [{ name: '就寢時間', start: '18:00', end: '05:00' }];
  const pad2 = n => String(n).padStart(2, '0');
  const formatCountdownFor = totalSeconds => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`;
  };

  it('is active before midnight, counting down toward the next-day end', () => {
    // 22:00 -> 05:00 next day is 7h = 25200s away
    const vm = compute(at(22, 0, 0), { breakTimes: overnightBreak });
    expect(vm.statusText).toBe('就寢時間');
    expect(vm.timerValue).toBe(formatCountdownFor(7 * 3600));
    expect(vm.timerValue).toBe('7:00:00'); // hours shown, not minutes - see below
    expect(vm.progressPercent).toBeCloseTo((4 / 11) * 100, 5); // 4h of 18:00-05:00's 11h
  });

  it('is still active in the early-morning tail after midnight', () => {
    // 02:00 -> 05:00 is 3h away; 8h elapsed of the 11h window
    const vm = compute(at(2, 0, 0), { breakTimes: overnightBreak });
    expect(vm.statusText).toBe('就寢時間');
    expect(vm.timerValue).toBe(formatCountdownFor(3 * 3600));
    expect(vm.progressPercent).toBeCloseTo((8 / 11) * 100, 5);
  });

  it('still has no next class once the whole school day is genuinely over', () => {
    // 22:00 is well after today's last period (11:00 in the shared
    // `compute()` fixture) - there's nothing left today for "next" to point
    // to, break or no break, so this comes out -1 on its own.
    const evening = compute(at(22, 0, 0), { breakTimes: overnightBreak });
    expect(evening.nxtIdx).toBe(-1);
    expect(evening.nextText).toBe('再見'); // curDay: 1 (Monday) in the shared `compute()` fixture
  });

  it('previews today\'s first class once the overnight break reaches its early-morning tail', () => {
    // 02:00 is still within the same 就寢時間 window, but it's also before
    // today's first period (08:00) - the school day hasn't started yet, so
    // unlike the evening case above there genuinely IS a next class today,
    // and it should preview normally instead of being suppressed just
    // because a special time happens to still be active.
    const earlyMorning = compute(at(2, 0, 0), { breakTimes: overnightBreak });
    expect(earlyMorning.nxtIdx).toBe(0);
    expect(earlyMorning.nextText).toBe('數學');
  });

  it('is not active outside the overnight window', () => {
    const vm = compute(at(12, 0, 0), { breakTimes: overnightBreak });
    expect(vm.statusText).not.toBe('就寢時間');
  });

  it('still shows its countdown on a day with no classes at all', () => {
    // e.g. a weekend, where todaySchedule is empty - the bedtime break
    // isn't tied to school hours, so it should count down just like it
    // does on a school day instead of being hidden behind "今日無課".
    const vm = compute(at(22, 0, 0), {
      todaySchedule: [],
      breakTimes: overnightBreak
    });
    expect(vm.isSchoolDay).toBe(false);
    expect(vm.statusText).toBe('就寢時間');
    expect(vm.timerVisible).toBe(true);
    expect(vm.timerValue).toBe(formatCountdownFor(7 * 3600));
    expect(vm.progressVisible).toBe(true);
    expect(vm.dotState).toBe('wait');
  });

  it('falls back to 今日無課 on a no-class day when no break is active', () => {
    const vm = compute(at(12, 0, 0), { todaySchedule: [], breakTimes: overnightBreak });
    expect(vm.statusText).toBe('今日無課');
    expect(vm.timerVisible).toBe(false);
  });
});

describe('computeDashboardViewModel - same-day special time on a no-class day', () => {
  // 中午時間 (12:00-13:00) only means anything relative to a school day's
  // schedule - on a weekend/holiday with no classes it shouldn't show as an
  // active special time, unlike an overnight break (e.g. 就寢時間) which
  // keeps counting down regardless of whether today has classes.
  const noonBreak = [{ name: '中午時間', start: '12:00', end: '13:00' }];

  it('does not show a same-day break as active on a no-class day', () => {
    const vm = compute(at(12, 30, 0), { todaySchedule: [], breakTimes: noonBreak });
    expect(vm.statusText).toBe('今日無課');
    expect(vm.timerVisible).toBe(false);
    expect(vm.activeBreakName).toBe('');
  });

  it('still shows the same-day break normally on an actual school day', () => {
    const vm = compute(at(12, 30, 0), { breakTimes: noonBreak });
    expect(vm.statusText).toBe('中午時間');
    expect(vm.timerVisible).toBe(true);
  });

  it('keeps an overnight break active even alongside an ignored same-day one', () => {
    const vm = compute(at(22, 0, 0), {
      todaySchedule: [],
      breakTimes: [...noonBreak, { name: '就寢時間', start: '18:00', end: '05:00' }]
    });
    expect(vm.statusText).toBe('就寢時間');
    expect(vm.timerVisible).toBe(true);
  });
});

describe('noticeLead', () => {
  const day = [
    { s: '08:10', e: '09:00' },
    { s: '09:10', e: '10:00' },
    { s: '13:10', e: '15:00' },
    { s: '15:10', e: '16:00' },
    { s: '16:05', e: '16:55' }
  ];
  it('tells as the break starts; after a long break or first thing, five minutes before', () => {
    expect([0, 1, 2, 3, 4].map(i => noticeLead(day, i))).toEqual([5, 10, 5, 10, 5]);
  });
});

describe('classStartingSoon', () => {
  const at = (h, m) => new Date(2026, 8, 28, h, m, 0);
  it('announces the next class in the five minutes before it', () => {
    const soon = classStartingSoon({ now: at(9, 6), week: '單', todaySchedule });
    expect(soon).toEqual({ tag: 'class:2026-09-28:09:10', name: '國文', start: '09:10', lead: 5, left: 4, due: false, meta: '09:10 · 李老師 · 102' });
    expect(classStartingSoon({ now: at(9, 9), week: '雙', todaySchedule }).name).toBe('公民');
  });
  it('is due only in the notice\'s own minute, with the minutes really left', () => {
    // Opened later in the break: the card says how long is left; no banner
    // saying the notice's full lead (the bug: "10 分鐘後上課" five minutes in).
    expect(classStartingSoon({ now: at(9, 5), week: '單', todaySchedule })).toMatchObject({ due: true, left: 5 });
    expect(classStartingSoon({ now: new Date(2026, 8, 28, 9, 5, 40), week: '單', todaySchedule })).toMatchObject({ due: true, left: 5 });
    expect(classStartingSoon({ now: at(9, 7), week: '單', todaySchedule })).toMatchObject({ due: false, left: 3 });
  });
  it('says nothing earlier, during a class, or after the last one', () => {
    expect(classStartingSoon({ now: at(9, 0), week: '單', todaySchedule })).toBeNull();
    expect(classStartingSoon({ now: at(9, 10), week: '單', todaySchedule })).toBeNull();
    expect(classStartingSoon({ now: at(12, 0), week: '單', todaySchedule })).toBeNull();
    expect(classStartingSoon({ now: at(9, 6), week: '單', todaySchedule: [] })).toBeNull();
  });
});

describe('heroView: the card says one thing', () => {
  const hero = (now, extra = {}) => heroView(compute(now), { now, week: '單', todaySchedule, ...extra });
  it('in class: the class, the time left, the next class along the foot', () => {
    const h = hero(at(8, 20));
    expect(h).toMatchObject({ mode: 'class', kicker: '第 1 節 · 上課中', span: '08:00–08:50', title: '數學', teacher: '王老師', place: '101' });
    expect(h.timer).toEqual({ value: '30:00', label: '後下課' });
    expect(h.foot).toEqual({ label: '下一節', name: '國文', time: '09:10', sub: '李老師 · 102' });
  });
  it('on a break: the class coming is the card, the break on its top line, the class after along the foot', () => {
    const h = hero(at(10, 5, 7));
    expect(h).toMatchObject({ mode: 'break', kicker: '下課 · 接著第 3 節', span: '10:10–11:00', title: '英文', teacher: '林老師' });
    expect(h.timer).toEqual({ value: '4:53', label: '後上課' });
    expect(Math.round(h.progress)).toBe(51);
    expect(h.foot).toEqual({ note: '最後一節，11:00 放學' });
  });
  it('a break that stands on its own is the card, with the time until it ends', () => {
    const night = [{ name: '就寢時間', start: '22:00', end: '06:00' }];
    const now = at(23, 0);
    const h = heroView(compute(now, { breakTimes: night }), { now, week: '單', todaySchedule, nextDay: { label: '明天', first: todaySchedule[0], week: '雙' } });
    expect(h).toMatchObject({ mode: 'break', title: '就寢時間', span: '22:00–06:00' });
    expect(h.timer.label).toBe('後結束');
    expect(h.foot).toEqual({ label: '明天', name: '數學', time: '08:00', sub: '王老師 · 101' });
  });
  it('the day over: its state, and the next school day along the foot', () => {
    const h = hero(at(12, 0), { nextDay: { label: '明天', first: todaySchedule[1], week: '雙' } });
    expect(h).toMatchObject({ mode: 'off', title: '放學時間', timer: null, progress: null });
    expect(h.foot).toMatchObject({ label: '明天', name: '公民' });
  });
});
