import { beforeAll, describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';
import { normalizeClassSwaps, normalizeCountdownEvents } from '../src/data.js';
import { getWeekType, getWeekNumber } from '../src/schedule.js';
import { state } from '../src/state.js';
import { useHolidays, holidayOn } from '../src/holidays.js';

let applyNlEditResult;
let validateNlEditResult;
let extractJsonObject;
let decodeTransferData;
let encodeTransferData;
let normalizeSettingsData;

beforeAll(async () => {
  seedLocalStorage();
  await loadApp();
  ({ applyNlEditResult, extractJsonObject, validateNlEditResult } = await import('../src/editor-nl-edit.js'));
  ({ decodeTransferData, encodeTransferData, normalizeSettingsData } = await import('../src/editor-backup.js'));
  useHolidays(await import('../.kit/holidays.mjs'));
});

describe('impossible dates are not dates', () => {
  it('a swap on 2026-02-30 is dropped', () => {
    expect(normalizeClassSwaps([{ a: { date: '2026-02-30', p: 0 }, b: { date: '2026-03-02', p: 1 } }])).toEqual([]);
  });
  it('a countdown on 2026-04-31 is dropped', () => {
    expect(normalizeCountdownEvents([{ name: 'x', startDate: '2026-04-31', endDate: '2026-05-01' }])).toEqual([]);
    expect(normalizeCountdownEvents([{ name: 'ok', startDate: '2028-02-29', endDate: '2028-02-29' }])).toHaveLength(1);
  });
});

const base = () =>
  JSON.parse(
    JSON.stringify({
      teacherDB: { A: ['數學', '王老師', '101'], B: ['英文', '林老師', '102'] },
      teacherOrder: ['A', 'B'],
      locationDB: { A: '101', B: '102' },
      weeklySchedule: { 0: [], 1: ['A', 'B'], 2: [], 3: [], 4: [], 5: [], 6: [] },
      bellTimes: [['08:00', '08:50'], ['09:00', '09:50']],
      breakTimes: [],
      countdownEvents: [],
      reverseWeek: false,
      proAccent: '#0A84FF',
      proSecondary: '#5856D6',
      styleSlots: []
    })
  );
const patch = o => ({
  status: 'ok',
  classUpserts: [],
  deletedClassKeys: [],
  scheduleEdits: [],
  bellTimesChanged: false,
  bellTimes: [],
  breakTimesChanged: false,
  breakTimes: [],
  countdownEventsChanged: false,
  countdownEvents: [],
  reverseWeekChanged: false,
  reverseWeek: false,
  ...o
});

describe('AI edit is all or nothing', () => {
  it.each([
    ['unknown class key', { scheduleEdits: [{ day: 1, period: 0, key: 'ZZ' }] }],
    ['day that does not exist', { scheduleEdits: [{ day: 9, period: 0, key: 'A' }] }],
    ['period past the last', { scheduleEdits: [{ day: 2, period: 5, key: 'A' }] }],
    ['fractional period', { scheduleEdits: [{ day: 2, period: 0.5, key: 'A' }] }],
    ['entry that is not an object', { scheduleEdits: [null] }],
    ['upsert without a key', { classUpserts: [{ key: '', subject: 'x', teacher: '', location: '' }] }],
    ['a countdown with an impossible date', { countdownEventsChanged: true, countdownEvents: [{ name: 'a', startDate: '2026-02-30', endDate: '2026-03-01' }, { name: 'b', startDate: '2026-05-01', endDate: '2026-05-01' }] }],
    ['a countdown with no name', { countdownEventsChanged: true, countdownEvents: [{ name: '', startDate: '2026-05-01', endDate: '2026-05-01' }] }]
  ])('throws for %s rather than applying the rest', (_, o) => {
    expect(() => applyNlEditResult(base(), patch({ ...o, scheduleEdits: [...(o.scheduleEdits || []), { day: 2, period: 0, key: 'B' }] }))).toThrow();
  });
  it('still applies a clean edit', () => {
    const next = applyNlEditResult(base(), patch({ scheduleEdits: [{ day: 2, period: 1, key: 'B' }, { day: 1, period: 0, key: '' }] }));
    expect(next.weeklySchedule[2]).toEqual(['', 'B']);
    expect(next.weeklySchedule[1]).toEqual(['', 'B']);
  });
  it('rejects truncated or garbled replies', () => {
    for (const bad of ['{"status":"ok","classUpserts":[{"key":"a"}', 'sorry {no} json', '{"status":"ok"', '']) {
      let out;
      try { out = extractJsonObject(bad); } catch { out = null; }
      expect(out == null || !validateNlEditResult(out).valid).toBe(true);
    }
  });
});

describe('weeks', () => {
  it('week type flips every Monday through the 2026/2027 turn and ISO week 53', () => {
    state.applicationData = { reverseWeek: false };
    const w = d => getWeekType(new Date(d));
    expect(w('2026-12-21T12:00')).not.toBe(w('2026-12-28T12:00'));
    expect(w('2026-12-28T12:00')).toBe(w('2027-01-03T12:00'));
    expect(w('2027-01-03T12:00')).not.toBe(w('2027-01-04T12:00'));
    expect(getWeekNumber(new Date('2027-01-04T12:00'))).toBe(getWeekNumber(new Date('2026-12-28T12:00')) + 1);
    expect(w('2025-12-28T12:00')).not.toBe(w('2025-12-29T12:00'));
  });
});

describe('Taiwan holidays', () => {
  const day = d => holidayOn(new Date(`${d}T12:00:00`));
  it('2026 and 2027 days off', () => {
    for (const d of ['2026-10-09', '2026-10-26', '2026-12-25', '2027-02-09', '2027-04-30', '2027-10-11', '2027-12-24']) expect(day(d)).not.toBeNull();
    for (const d of ['2026-10-12', '2026-10-27', '2027-10-12']) expect(day(d)).toBeNull();
  });
});

describe('share key', () => {
  it('round-trips swaps and rejects junk', async () => {
    const data = normalizeSettingsData({ ...base(), classSwaps: [{ a: { date: '2030-01-07', p: 0 }, b: { date: '2030-01-14', p: 1 } }] });
    const back = await decodeTransferData(await encodeTransferData(data));
    expect(back.classSwaps).toEqual(data.classSwaps);
    await expect(decodeTransferData('nonsense')).rejects.toThrow();
  });
});
