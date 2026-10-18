import { describe, expect, it } from 'vitest';
import { dateFromKey, dateKey, pad2, parseTime, timeToMinutes } from '../src/dates.js';

describe('dates', () => {
  it('a day and back, local, across months, years and a leap day', () => {
    for (const key of ['2026-01-01', '2026-12-31', '2028-02-29', '2027-03-01']) expect(dateKey(dateFromKey(key))).toBe(key);
    expect(dateKey(new Date(2026, 9, 18, 23, 59, 59))).toBe('2026-10-18');
    expect(dateKey(new Date(2026, 9, 19, 0, 0, 0))).toBe('2026-10-19');
  });
  it('times to minutes: strict for what is typed, plain for what the app wrote', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('23:59')).toBe(1439);
    expect(timeToMinutes('08:05')).toBe(485);
    for (const bad of ['', '8:05', '08:5', null, undefined, '08-05']) expect(timeToMinutes(bad)).toBe(9999);
    expect(pad2(7)).toBe('07');
    expect(pad2(12)).toBe('12');
  });
});
