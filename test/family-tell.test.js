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

describe('下課背五個', () => {
  it("reads Words' count due today, and nothing on another day or none due", async () => {
    const { wordsDue } = await import('../src/view-today.js');
    const now = new Date(2026, 10, 11, 10, 5);
    const heard = (app, key) => (app === 'vocab' && key === 'due' ? { day: '2026-11-11', n: 12 } : null);
    expect(wordsDue(now, heard)).toBe(12);
    expect(wordsDue(new Date(2026, 10, 12, 10, 5), heard)).toBe(0);
    expect(wordsDue(now, () => ({ day: '2026-11-11', n: 0 }))).toBe(0);
    expect(wordsDue(now, null)).toBe(0);
  });
});

describe('出門時間', () => {
  const f = {
    planHash: (p, at) => `#plan?to=${p.lat},${p.lon},${p.name}${at ? `&by=${new Date(at).toISOString()}` : ''}`,
    placeFor: role => ({ school: { lat: 24.8, lon: 121, name: '學校' }, home: { lat: 24.7, lon: 121, name: '家' } })[role]
  };
  const rows = [{ s: '08:10', e: '09:00' }, { s: '15:10', e: '16:00' }];
  it('before the first class: to school, there ten minutes early', async () => {
    const { tripOf } = await import('../src/view-today.js');
    const now = new Date(2026, 10, 11, 7, 0);
    const trip = tripOf({ mode: 'before' }, rows, now, f);
    expect(trip.to).toBe('school');
    expect(trip.hash).toBe(`plan?to=24.8,121,學校&by=${new Date(2026, 10, 11, 8, 0).toISOString()}`);
    expect(tripOf({ mode: 'before' }, rows, new Date(2026, 10, 11, 3, 0), f)).toBe(null);
    expect(tripOf({ mode: 'before' }, rows, now, { ...f, placeFor: () => null })).toBe(null);
  });
  it('the day over: home, within three hours of the last class', async () => {
    const { tripOf } = await import('../src/view-today.js');
    expect(tripOf({ mode: 'off', strip: null }, rows, new Date(2026, 10, 11, 16, 20), f).hash).toBe('plan?to=24.7,121,家');
    expect(tripOf({ mode: 'off', strip: null }, rows, new Date(2026, 10, 11, 20, 0), f)).toBe(null);
    expect(tripOf({ mode: 'class' }, rows, new Date(2026, 10, 11, 10, 0), f)).toBe(null);
  });
});
