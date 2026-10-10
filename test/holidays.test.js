import { describe, expect, it } from 'vitest';
import * as kit from '../.kit/holidays.mjs';
import { holidayOn, useHolidays } from '../src/holidays.js';
import { computeDashboardViewModel, heroView } from '../src/schedule-calc.js';

describe('Taiwan national holidays: no classes', () => {
  useHolidays(kit);
  it('knows the days off, in lieu ones too', () => {
    expect(holidayOn(new Date(2026, 9, 9))?.zh).toBe('國慶日補假');
    expect(holidayOn(new Date(2026, 8, 28))?.zh).toBe('教師節');
    expect(holidayOn(new Date(2026, 9, 12))).toBe(null);
    expect(kit.twWorkday('2026-10-09')).toBe(false);
    expect(kit.twWorkday('2026-10-12')).toBe(true);
    expect(kit.twDayOff('2026-10-10')).toBe(true);
    // A Date in the evening, Taiwan time.
    expect(kit.twHoliday(Date.parse('2026-10-09T17:00:00Z'))?.zh).toBe('國慶日');
    expect(kit.twHoliday(Date.parse('2026-10-09T10:00:00Z'))?.zh).toBe('國慶日補假');
  });
  it('a holiday shows its name and no class, whatever the timetable', () => {
    const now = new Date(2026, 9, 9, 8, 0);
    const vm = computeDashboardViewModel({ now, curDay: 5, week: '單', todaySchedule: [], breakTimes: [] });
    const hero = heroView(vm, { now, week: '單', todaySchedule: [], holiday: holidayOn(now) });
    expect(hero.mode).toBe('off');
    expect(hero.title).toBe('國慶日補假');
  });
});
