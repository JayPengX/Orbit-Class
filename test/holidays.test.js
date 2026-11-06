import { describe, expect, it } from 'vitest';
import * as kit from '../.kit/holidays.mjs';
import { holidayOn } from '../src/holidays.js';
import { computeDashboardViewModel, heroView } from '../src/schedule-calc.js';

describe('Taiwan national holidays: no classes', () => {
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

describe('a typhoon day: 停課 at the school', () => {
  it('only where the school is, whole day or from its hour', async () => {
    const dayoff = await import('../.kit/dayoff.mjs');
    const { typhoonOn, classesOffFrom } = await import('../src/holidays.js');
    const fri = new Date(2026, 9, 23);
    expect(holidayOn(fri)).toBe(null);
    dayoff.setPlace('school', { county: '新竹縣', town: '竹東鎮' });
    dayoff.keepDayOff({ county: '新竹縣', town: '竹東鎮' }, { '2026-10-23': { work: { off: true, from: null }, class: { off: true, from: null } } });
    expect(holidayOn(fri)?.zh).toBe('颱風停課');
    dayoff.keepDayOff({ county: '新竹縣', town: '竹東鎮' }, { '2026-10-23': { class: { off: true, from: '12:00' } } });
    expect(holidayOn(fri)).toBe(null);
    expect(classesOffFrom(fri)).toBe('12:00');
    dayoff.keepDayOff({ county: '新竹縣', town: '竹東鎮' }, { '2026-10-23': { work: { off: true, from: null }, class: { off: false, from: null } } });
    expect(typhoonOn(fri)).toBe(null);
  });
});
