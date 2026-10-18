import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';
import * as kit from '../.kit/holidays.mjs';

// 明天要帶: the night before, what tomorrow's classes need.
let bring;
let state;
let schedule;

beforeAll(async () => {
  vi.useFakeTimers();
  seedLocalStorage({
    teacherDB: { P: ['體育', '', '操場'], M: ['數學', '', ''], S: ['游泳', '', ''], A: ['美術', '', ''], X: ['體育/音樂', '', ''] },
    teacherOrder: ['P', 'M', 'S', 'A', 'X'],
    locationDB: { P: '操場', M: '', S: '', A: '', X: '' },
    weeklySchedule: { 0: [], 1: ['P', 'M', 'S'], 2: ['M', 'A', 'P'], 3: ['M'], 4: [], 5: ['X'], 6: [] }
  });
  await loadApp();
  bring = await import('../src/bring.js');
  schedule = await import('../src/schedule.js');
  ({ state } = await import('../src/state.js'));
  (await import('../src/holidays.js')).useHolidays(kit);
});
afterAll(() => vi.useRealTimers());

describe('bringItem', () => {
  it('knows the subjects that need something', () => {
    expect(bring.bringItem('體育')).toBe('pe');
    expect(bring.bringItem('游泳')).toBe('swim');
    expect(bring.bringItem('美術')).toBe('art');
    expect(bring.bringItem('數學')).toBeNull();
  });
});

describe('bringTomorrow', () => {
  it('the evening before: each thing once, in class order', () => {
    // 2030-01-06 is a Sunday; Monday has 體育, 數學, 游泳.
    const plan = bring.bringTomorrow(new Date(2030, 0, 6, 20, 0));
    expect(plan.items.map(i => i.item)).toEqual(['pe', 'swim']);
  });
  it('not before the evening', () => {
    expect(bring.bringTomorrow(new Date(2030, 0, 6, 16, 59))).toBeNull();
    expect(bring.bringTomorrow(new Date(2030, 0, 6, 17, 0))).not.toBeNull();
  });
  it('nothing when tomorrow brings nothing, or has no classes', () => {
    expect(bring.bringTomorrow(new Date(2030, 0, 8, 21, 0))).toBeNull(); // Wednesday: 數學 only
    expect(bring.bringTomorrow(new Date(2030, 0, 9, 21, 0))).toBeNull(); // Thursday: none
  });
  it('a split subject is read for that week', () => {
    // Friday 2030-01-11's class is 體育/音樂: odd week the first, even the second.
    const day = new Date(2030, 0, 10, 20, 0);
    const week = schedule.getWeekType(new Date(2030, 0, 11));
    expect(bring.bringTomorrow(day).items[0].item).toBe(week === '單' ? 'pe' : 'music');
  });
  it('a holiday tomorrow brings nothing', () => {
    // Friday 2026-10-09 is 國慶日補假; seed Friday with PE.
    state.applicationData.weeklySchedule[5] = ['P'];
    schedule.buildSchedule();
    expect(bring.bringTomorrow(new Date(2026, 9, 8, 20, 0))).toBeNull();
  });
});
