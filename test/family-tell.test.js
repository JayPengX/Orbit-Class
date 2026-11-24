import { beforeAll, describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { state } from '../src/state.js';
import { buildSchedule } from '../src/schedule.js';
import { normalizeSettingsData } from '../src/editor-backup.js';
import { familyDays } from '../src/family-tell.js';

// The family's notebook (src/family-tell.js): the next two weeks as held,
// each odd/even class its week's subject, 體育 marked outdoors.
beforeAll(async () => {
  await loadApp();
});

describe('familyDays', () => {
  it('tells each day as held: the week’s half of a split class, 體育 outdoors, a free weekday empty', () => {
    state.applicationData = normalizeSettingsData({
      teacherDB: { A: ['數學', '王老師', '101'], B: ['國文/體育', '李老師/陳老師', '102'] },
      teacherOrder: ['A', 'B'],
      locationDB: {},
      weeklySchedule: { 1: ['A', 'B'] },
      bellTimes: [
        ['08:00', '08:50'],
        ['13:10', '14:00']
      ],
      breakTimes: [],
      countdownEvents: [],
      reverseWeek: false,
      styleSlots: []
    });
    buildSchedule();
    // 2030-01-07 and 01-14: Mondays in an odd and an even week.
    const days = familyDays(new Date(2030, 0, 7), 8);
    expect(Object.keys(days)).toHaveLength(8);
    expect(days['2030-01-07']).toEqual([{ n: 1, name: '數學', from: '08:00', to: '08:50' }, { n: 2, name: '國文', from: '13:10', to: '14:00' }]);
    expect(days['2030-01-14'][1]).toEqual({ n: 2, name: '體育', from: '13:10', to: '14:00', out: true });
    expect(days['2030-01-08']).toEqual([]);
  });
});
