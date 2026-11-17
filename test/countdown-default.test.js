import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDefaultData, normalizeCountdownEvents } from '../src/data.js';

// A new timetable's countdown is the next 學測 only while it's still to come:
// from 2027-01-25 a new person starts with none, never an exam already over.
describe('the countdown a new timetable starts with', () => {
  afterEach(() => vi.useRealTimers());
  it('is 116 學測 until its last day, then none', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 24, 20, 0));
    expect(getDefaultData().countdownEvents.map(e => e.name)).toEqual(['116 學測']);
    expect(normalizeCountdownEvents(undefined).map(e => e.name)).toEqual(['116 學測']);
    vi.setSystemTime(new Date(2027, 0, 25, 8, 0));
    expect(getDefaultData().countdownEvents).toEqual([]);
    expect(normalizeCountdownEvents(undefined)).toEqual([]);
    // (A person's own list is theirs, past or not.)
    expect(normalizeCountdownEvents([{ name: '116 學測', startDate: '2027-01-22', endDate: '2027-01-24' }])).toHaveLength(1);
  });
});
