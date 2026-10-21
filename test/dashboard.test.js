import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';

// Deliberately *not* a static top-level import of src/state.js: static
// imports resolve before beforeAll() runs, which would evaluate state.js's
// eager `applicationData: loadData()` before seedLocalStorage() below has
// written anything - state must come from a dynamic import performed after
// seeding (loadApp() already imports src/main.js -> ... -> state.js by
// then, so this just returns that same, correctly-initialized module).
let state;

// Monday, ISO week 2 of 2024 (even -> '雙' week with reverseWeek: false).
// Pinning the real system date is required because getWeekType() calls
// `new Date()` directly - Test Mode only overrides day-of-week and
// time-of-day (see src/dashboard.js's update(), which does `now.setHours(...)`
// on top of a fresh `new Date()`), never the calendar date itself.
const FIXED_MONDAY = new Date('2024-01-08T08:00:00');

function setSimTime(hours, minutes) {
  window.MANUALLY_TEST = true;
  window.IS_SIMULATING = false;
  window.TEST_DAY = 1;
  window.TEST_TIME_SEC = hours * 3600 + minutes * 60;
}

function text(id) {
  return document.getElementById(id).textContent;
}

describe('dashboard update() against the real app', () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_MONDAY);
    seedLocalStorage();
    await loadApp();
    ({ state } = await import('../src/state.js'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('shows the current class, split by week parity, during its period', () => {
    setSimTime(9, 30); // inside period 1 (09:10-10:00), the split B class
    window.update();
    expect(text('now-name')).toBe('公民'); // '雙' week -> second half of "國文/公民"
    expect(text('now-teacher')).toBe('陳老師');
    expect(text('now-place')).toBe('102');
  });

  it('shows a non-split class name and teacher unchanged', () => {
    setSimTime(8, 20); // inside period 0 (08:00-08:50)
    window.update();
    expect(text('now-name')).toBe('數學');
    expect(text('now-teacher')).toBe('王老師');
    expect(text('now-place')).toBe('101');
  });

  it('on a break, the class coming is the card, the break named on its top line', () => {
    setSimTime(9, 0); // inside 打掃時間 (08:50-09:10), period 2 (09:10) next
    window.update();
    expect(text('now-name')).toBe('公民');
    expect(text('cx-kicker')).toBe('打掃時間 · 接著第 2 節');
    expect(text('timer-val')).toBe('10:00');
    expect(text('timer-label')).toBe('後上課');
    // The foot: the class after it, on its own two lines.
    expect(text('next-label')).toBe('接著');
    expect(text('next-name')).toBe('英文');
    expect(text('next-time')).toBe('10:10');
  });

  it('shows "放學時間" once the last period of the day ends, and auto-advances the viewed day', () => {
    setSimTime(11, 1); // just after period 2 (10:10-11:00) ends
    window.update();
    expect(text('now-name')).toBe('放學時間');
    // Wednesday (day 3) is the next day with any classes in the fixture;
    // Tuesday (day 2) has none.
    expect(state.viewDay).toBe(3);
  });

  it('before the first period, the first class and the time until it', () => {
    setSimTime(7, 30);
    window.update();
    expect(text('now-name')).toBe('數學');
    expect(text('cx-kicker')).toBe('今天 · 第 1 節');
    expect(text('timer-val')).toBe('30:00');
    expect(document.getElementById('cx-ring-fill').style.strokeDasharray).toBe('0 100');
  });

  it('once the day is over, the next school day\'s first class along the foot', () => {
    setSimTime(11, 1);
    window.update();
    expect(document.getElementById('timer-group').style.display).toBe('none');
    expect(text('next-label')).toBe('週三');
  });

  it('redirects an empty Saturday/Sunday viewDay to Monday instead of showing "這天沒有課"', () => {
    setSimTime(8, 20);
    state.viewDay = 0; // Sunday has no classes in the fixture
    window.update();
    expect(state.viewDay).toBe(1);
    state.viewDay = 6; // neither does Saturday
    window.update();
    expect(state.viewDay).toBe(1);
  });

  it('redirects an empty weekday viewDay too, not just Saturday/Sunday', () => {
    setSimTime(8, 20);
    state.viewDay = 2; // Tuesday has no classes in the fixture
    window.update();
    expect(state.viewDay).toBe(3); // next day with classes
  });
});
