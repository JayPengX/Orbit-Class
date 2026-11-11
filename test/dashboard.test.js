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
    expect(text('now-teacher')).toContain('陳老師');
    expect(text('now-place')).toBe('102');
  });

  it('books the week (and a focus flight landing) by the real clock in the time simulation', () => {
    state.classPushSlot = null;
    setSimTime(8, 20);
    window.update();
    expect(state.classPushSlot).toBe(Math.floor(Date.now() / 600_000));
  });

  it('shows a non-split class name and teacher unchanged', () => {
    setSimTime(8, 20); // inside period 0 (08:00-08:50)
    window.update();
    expect(text('now-name')).toBe('數學');
    expect(text('now-teacher')).toBe('王老師');
    expect(text('now-place')).toBe('101');
  });

  // The card's rule (docs/DESIGN.md §11): it leads with the class, the
  // minutes and the room; the class is a band in its subject's colour on the
  // graphite card, never the card filled with it.
  it('in class: the band in the subject\'s colour, the room, the minutes left, live', () => {
    setSimTime(8, 20); // 30 minutes before 08:50
    window.update();
    const card = document.getElementById('cx-hero');
    const band = card.querySelector('.q-band');
    expect(band.style.getPropertyValue('--band')).not.toBe('');
    expect(card.style.getPropertyValue('--subject')).toBe('');
    expect(text('timer-val')).toBe('30分00秒後下課');
    expect(card.querySelector('.nv-live')).not.toBeNull();
  });

  it('the day as one line: a dot per class, the one now ringed, the ones done faded', () => {
    setSimTime(9, 30);
    window.update();
    const stops = [...document.querySelectorAll('#cx-hero .nv-line .nv-stop')];
    expect(stops).toHaveLength(3);
    expect(stops.map(s => s.className.match(/is-(\w+)/)[1])).toEqual(['done', 'now', 'ahead']);
    expect(document.querySelector('#cx-hero .nv-end').textContent).toContain('11:00');
  });

  it('a dot opens its own class, not the card\'s', () => {
    setSimTime(9, 30); // card: 公民
    window.update();
    document.querySelectorAll('#cx-hero .nv-stop')[2].click(); // 英文
    const sheets = document.querySelectorAll('.cx-kit-sheet');
    const sheet = sheets[sheets.length - 1];
    expect(sheet?.textContent || '').toContain('林老師');
    sheet.remove();
  });

  it('on a break, the class coming is the card, the break named on its top line', () => {
    setSimTime(9, 0); // inside 打掃時間 (08:50-09:10), period 2 (09:10) next
    window.update();
    expect(text('now-name')).toBe('公民');
    expect(text('cx-kicker')).toBe('打掃時間 · 接著第 2 節');
    expect(text('timer-val')).toBe('10分00秒後上課');
    // The foot: the class after it, one row.
    expect(text('next-label')).toBe('接著');
    expect(text('next-name')).toBe('英文');
    expect(text('next-time')).toContain('10:10');
  });

  it('a tap on the foot opens the class it names (接著), not the card\'s', () => {
    setSimTime(9, 0); // card: 公民 (period 2); foot: 接著 英文
    window.update();
    document.getElementById('next-name').click();
    const sheets = document.querySelectorAll('.cx-kit-sheet');
    const sheet = sheets[sheets.length - 1];
    expect(sheet?.textContent || '').toContain('林老師'); // 英文's teacher
    expect(sheet?.textContent || '').not.toContain('陳老師'); // not the card's 公民
    sheet.remove();
  });

  // Jay 2026-11-03: closing the icon picker (the class sheet's pencil) closed the class too.
  it('the icon picker opens over the class sheet; closing it leaves the class open', () => {
    setSimTime(9, 0);
    window.update();
    document.getElementById('next-name').click();
    const sheet = [...document.querySelectorAll('.cx-kit-sheet')].at(-1);
    sheet.querySelector('.cx-pick-lead').click();
    const sheets = [...document.querySelectorAll('.cx-kit-sheet')];
    const picker = sheets.at(-1);
    expect(picker).not.toBe(sheet);
    expect(picker.querySelector('.cx-icon-grid')).not.toBeNull();
    picker.querySelector('[data-q-close]').click();
    expect(sheet.isConnected).toBe(true);
    expect(sheet.open).toBe(true);
    document.querySelectorAll('.cx-kit-sheet').forEach(d => d.remove());
  });

  it('once the day is over: 放學時間 on the top line, the next school day\'s first class as the band, the viewed day moved on', () => {
    setSimTime(11, 1); // just after period 2 (10:10-11:00) ends
    window.update();
    expect(text('cx-kicker')).toBe('放學時間');
    // Wednesday (day 3) is the next day with any classes in the fixture;
    // Tuesday (day 2) has none.
    expect(text('cx-span')).toBe('週三 08:00');
    expect(text('now-name')).toBe('數學');
    expect(document.getElementById('timer-val')).toBeNull();
    expect(state.viewDay).toBe(3);
  });

  // Jay 2026-11-03: today picked again once it's over listed its classes as
  // 之後的課, as if still to come.
  it('today picked once it is over: 今天的課, every class done, never 之後的課', () => {
    setSimTime(11, 1);
    window.update();
    state.viewDay = 1; // 今天 tapped again (Test Mode walks weekdays)
    state.lastListKey = '';
    window.update();
    expect(text('cx-list-title')).not.toBe('之後的課');
    const cards = [...document.querySelectorAll('#schedule-list .cx-cl:not(.is-break)')];
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every(c => c.classList.contains('is-over'))).toBe(true);
  });

  it('within the hour of a class, the time to the second', () => {
    window.TEST_TIME_SEC = 9 * 3600 + 30 * 60 + 15; // period 1 ends 10:00
    window.update();
    expect(text('timer-val')).toBe('29分45秒後下課');
  });

  it('before the first period, the first class and the time until it', () => {
    setSimTime(7, 30);
    window.update();
    expect(text('now-name')).toBe('數學');
    expect(text('cx-kicker')).toBe('今天 · 第 1 節');
    expect(text('timer-val')).toBe('30分00秒後上課');
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
