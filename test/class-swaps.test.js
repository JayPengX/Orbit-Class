import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { state } from '../src/state.js';
import { buildSchedule, classesOnDate, getWeekType } from '../src/schedule.js';
import { dateFromKey } from '../src/dates.js';
import { normalizeClassSwaps, remapClassSwaps, swapsNotOver } from '../src/data.js';
import { applyEditorSettingsData, decodeTransferData, encodeTransferData, normalizeSettingsData } from '../src/editor-backup.js';
import { computeDashboardViewModel, heroView } from '../src/schedule-calc.js';
import { addSwap, openSwapSheet, removeSwap, swapOf } from '../src/swap.js';

// 調課: one-time swaps of two periods on given dates, across weeks too.
// Mondays 2030-01-07 and 01-14 are in different weeks (odd and even);
// Thursday 01-17 is in the second.
const MON = '2030-01-07';
const NEXT_MON = '2030-01-14';
const THU = '2030-01-10';
const NEXT_THU = '2030-01-17';

const fixture = () =>
  normalizeSettingsData({
    teacherDB: { A: ['數學', '王老師', '101'], B: ['國文/公民', '李老師/陳老師', '102'], C: ['英文', '林老師', '103'] },
    teacherOrder: ['A', 'B', 'C'],
    locationDB: { A: '101', B: '102', C: '103' },
    weeklySchedule: { 1: ['A', 'B', 'C'], 4: ['', 'C', 'A'] },
    bellTimes: [
      ['08:00', '08:50'],
      ['09:10', '10:00'],
      ['10:10', '11:00']
    ],
    breakTimes: [],
    countdownEvents: [],
    reverseWeek: false,
    styleSlots: []
  });
function use(swaps) {
  state.applicationData = { ...fixture(), classSwaps: normalizeClassSwaps(swaps) };
  buildSchedule();
}
const names = key => classesOnDate(dateFromKey(key)).map(c => `${c.p}:${c.n}@${c.s}`);

beforeAll(async () => {
  await loadApp();
});
beforeEach(() => use([]));

describe('normalizeClassSwaps', () => {
  it('keeps valid swaps, drops broken ones, the same period twice, and a period already swapped', () => {
    const out = normalizeClassSwaps([
      { a: { date: MON, p: 0 }, b: { date: NEXT_THU, p: 1 } },
      { a: { date: 'tomorrow', p: 0 }, b: { date: MON, p: 1 } },
      { a: { date: MON, p: 2 }, b: { date: MON, p: 2 } },
      { a: { date: MON, p: 0 }, b: { date: THU, p: 2 } },
      { a: { date: MON, p: -1 }, b: { date: THU, p: 2 } },
      null
    ]);
    expect(out).toEqual([{ a: { date: MON, p: 0 }, b: { date: NEXT_THU, p: 1 } }]);
  });

  it('swapsNotOver keeps a swap while either of its days is still to come', () => {
    const swaps = [
      { a: { date: '2030-01-01', p: 0 }, b: { date: '2030-01-02', p: 0 } },
      { a: { date: '2030-01-01', p: 1 }, b: { date: '2030-01-20', p: 1 } }
    ];
    expect(swapsNotOver(swaps, '2030-01-05')).toEqual([swaps[1]]);
  });

  it('travels with the timetable (the pass copy) and survives an older copy without it', async () => {
    const data = { ...fixture(), classSwaps: [{ a: { date: MON, p: 0 }, b: { date: NEXT_THU, p: 1 } }] };
    const decoded = normalizeSettingsData(await decodeTransferData(await encodeTransferData(data)));
    expect(decoded.classSwaps).toEqual(data.classSwaps);
    expect(normalizeSettingsData(fixture()).classSwaps).toEqual([]);
  });
});

describe('classesOnDate', () => {
  it('swaps two periods across weeks, on those dates only, each in its new period’s time', () => {
    use([{ a: { date: MON, p: 0 }, b: { date: NEXT_THU, p: 1 } }]);
    expect(names(MON)).toEqual(['0:英文@08:00', '1:國文/公民@09:10', '2:英文@10:10']);
    expect(names(NEXT_THU)).toEqual(['1:數學@09:10', '2:數學@10:10']);
    // The other Monday and Thursday as the timetable has them.
    expect(names(NEXT_MON)).toEqual(['0:數學@08:00', '1:國文/公民@09:10', '2:英文@10:10']);
    expect(names(THU)).toEqual(['1:英文@09:10', '2:數學@10:10']);
    const moved = classesOnDate(dateFromKey(MON))[0];
    expect(moved.swap).toEqual({ date: NEXT_THU, p: 1 });
    expect(moved.from.key).toBe('C');
  });

  it('a split class keeps the half of the week it came from', () => {
    expect(getWeekType(dateFromKey(MON))).not.toBe(getWeekType(dateFromKey(NEXT_MON)));
    use([{ a: { date: MON, p: 1 }, b: { date: NEXT_MON, p: 2 } }]);
    const fromWeek = getWeekType(dateFromKey(MON)) === '單' ? '國文' : '公民';
    const moved = classesOnDate(dateFromKey(NEXT_MON))[2];
    expect(moved).toMatchObject({ n: fromWeek, isSplit: false, s: '10:10', p: 2 });
  });

  it('swapped with a free period, the class moves and its own period is free that day', () => {
    use([{ a: { date: THU, p: 0 }, b: { date: MON, p: 0 } }]);
    expect(names(THU)).toEqual(['0:數學@08:00', '1:英文@09:10', '2:數學@10:10']);
    expect(names(MON)).toEqual(['1:國文/公民@09:10', '2:英文@10:10']);
  });

  it('a day the timetable leaves empty can take a class (a Saturday make-up)', () => {
    use([{ a: { date: '2030-01-12', p: 1 }, b: { date: MON, p: 0 } }]);
    expect(names('2030-01-12')).toEqual(['1:數學@09:10']);
  });
});

describe('the card and list name a period by its place', () => {
  it('第 N 節 is the period’s own number, not its place in the day’s list', () => {
    use([{ a: { date: THU, p: 0 }, b: { date: MON, p: 0 } }]);
    const today = classesOnDate(dateFromKey(MON));
    const now = new Date(2030, 0, 7, 9, 30);
    const vm = computeDashboardViewModel({ now, curDay: 1, week: '單', todaySchedule: today, breakTimes: [] });
    expect(heroView(vm, { now, week: '單', todaySchedule: today }).kicker).toContain('2');
  });
});

describe('making a swap', () => {
  it('refuses two free periods and a period already swapped', () => {
    expect(addSwap({ date: THU, p: 0 }, { date: '2030-01-12', p: 0 })).toBe(false);
    expect(addSwap({ date: MON, p: 0 }, { date: NEXT_THU, p: 1 })).toBe(true);
    expect(addSwap({ date: MON, p: 0 }, { date: NEXT_MON, p: 2 })).toBe(false);
    expect(state.applicationData.classSwaps).toHaveLength(1);
  });

  it('undoes a swap after the timetable was replaced (the pass’s copy applied meanwhile)', () => {
    expect(addSwap({ date: MON, p: 0 }, { date: NEXT_THU, p: 1 })).toBe(true);
    const shown = swapOf({ date: MON, p: 0 });
    // A sync applies the pass's copy: every object new, the same swaps.
    state.applicationData = JSON.parse(JSON.stringify(state.applicationData));
    expect(removeSwap(shown)).toBe(true);
    expect(state.applicationData.classSwaps).toHaveLength(0);
    // Nothing left to undo: says so, saves nothing.
    expect(removeSwap(shown)).toBe(false);
  });

  it('the sheet lists the day’s periods, then asks for the one to swap with', () => {
    openSwapSheet({ date: MON, p: 0 });
    const rows = [...document.querySelectorAll('#swap-periods .swap-slot')];
    expect(rows).toHaveLength(3);
    expect(rows[0].disabled).toBe(true);
    expect(document.getElementById('swap-first').hidden).toBe(false);
    // Another week's day: its periods, the free one with a free one picked first not offered.
    const input = document.getElementById('swap-date');
    input.value = NEXT_THU;
    input.dispatchEvent(new Event('change'));
    const next = [...document.querySelectorAll('#swap-periods .swap-slot')];
    expect(next.map(r => r.querySelector('strong').textContent)).toEqual(['空堂', '英文', '數學']);
    expect(next[0].disabled).toBe(false);
    window.closeSwapSheet();
  });
});

describe('swaps when the bell times change', () => {
  const bells = [['08:00', '08:50'], ['09:10', '10:00'], ['10:10', '11:00']];
  it('follow their periods to their new places; a period gone takes its swap with it', () => {
    const swaps = [
      { a: { date: MON, p: 2 }, b: { date: THU, p: 1 } },
      { a: { date: MON, p: 0 }, b: { date: NEXT_MON, p: 1 } }
    ];
    // The first period deleted: 09:10 is now place 0, 10:10 place 1.
    expect(remapClassSwaps(swaps, bells, bells.slice(1))).toEqual([{ a: { date: MON, p: 1 }, b: { date: THU, p: 0 } }]);
    // A period added before them.
    expect(remapClassSwaps(swaps, bells, [['07:10', '08:00'], ...bells])[0]).toEqual({ a: { date: MON, p: 3 }, b: { date: THU, p: 2 } });
    // A time edited in place: the same places.
    const edited = [['08:05', '08:50'], ...bells.slice(1)];
    expect(remapClassSwaps(swaps, bells, edited)).toEqual(swaps);
    expect(remapClassSwaps(swaps, bells, bells)).toBe(swaps);
  });

  it('a save that deletes a period keeps each swap on its class', () => {
    use([{ a: { date: MON, p: 2 }, b: { date: THU, p: 1 } }]);
    expect(names(MON)[2]).toBe('2:英文@10:10');
    const next = { ...fixture(), classSwaps: state.applicationData.classSwaps };
    next.bellTimes = bells.slice(1);
    next.weeklySchedule = { ...next.weeklySchedule, 1: ['B', 'C'], 4: ['C', 'A'] };
    applyEditorSettingsData(next);
    expect(state.applicationData.classSwaps).toEqual([{ a: { date: MON, p: 1 }, b: { date: THU, p: 0 } }]);
    // Monday's 英文 (10:10) and Thursday's 英文 (09:10) still traded.
    expect(names(MON)).toEqual(['0:國文/公民@09:10', '1:英文@10:10']);
    // Thursday's side, 09:10, holds Monday's 英文.
    expect(names(THU)).toEqual(['0:英文@09:10', '1:數學@10:10']);
  });
});
