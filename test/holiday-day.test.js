import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';

// 國慶日補假, Friday 2026-10-09: no classes that day, whatever the timetable
// says. 今天 said so on its card but listed Friday's classes under it.
let state;
const names = () => [...document.querySelectorAll('#schedule-list .cx-cl:not(.is-break) .cx-cl-name')].map(n => n.textContent);

beforeAll(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 9, 9, 30));
  seedLocalStorage({
    weeklySchedule: { 1: ['A', 'B', 'C'], 2: ['C'], 3: [], 4: [], 5: ['C', 'A'], 6: [], 0: [] }
  });
  await loadApp();
  ({ state } = await import('../src/state.js'));
});
afterAll(() => vi.useRealTimers());

describe('a national holiday on 今天', () => {
  it('the card names the holiday; the list is the next school day’s, not the holiday’s timetable', () => {
    document.body.dataset.tab = 'today';
    window.MANUALLY_TEST = false;
    state.viewDay = 5;
    state.autoAdvancedAfterFinishedDay = null;
    state.lastListKey = '';
    window.update();
    expect(document.getElementById('now-name').textContent).toBe('國慶日補假');
    expect(state.viewDay).toBe(1);
    expect(names()).toEqual(['數學', '公民', '英文'].map((n, i) => (i === 1 ? expect.stringMatching(/國文|公民/) : n)));
    expect(document.getElementById('cx-list-title').textContent).toContain('週一');
  });

  it('the holiday on 課表: its column empty and named; tapped, no classes', () => {
    document.body.dataset.tab = 'week';
    state.viewWeek = null;
    state.lastListKey = '';
    window.update();
    const friday = () => {
      const days = document.querySelectorAll('#cx-grid .cx-tl-day').length;
      return [...document.querySelectorAll('#cx-grid .cx-tl-cell')].filter((_, i) => i % days === 4);
    };
    expect(friday().every(c => c.classList.contains('is-empty'))).toBe(true);
    expect(document.querySelector('#cx-grid .cx-tl-offs').textContent).toContain('國慶日補假');
    document.querySelectorAll('#cx-grid .cx-tl-day')[4].click();
    const empty = document.querySelector('#m-body .row.is-empty');
    expect(empty).not.toBe(null);
    expect(empty.textContent).toContain('國慶日補假');
    window.closeModal();
    // The week after: Friday's classes as usual.
    const other = [...document.querySelectorAll('#cx-week-switch button')].find(b => b.getAttribute('aria-selected') === 'false');
    other.click();
    expect(friday().filter(c => !c.classList.contains('is-empty')).map(c => c.textContent)).toEqual(['英文', '數學']);
  });
});
