import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';

// 春節 2027: Wednesday 02-03's classes over, Thursday 02-04 (小年夜) to
// Wednesday 02-10 off. The card named Thursday 2/11's first class, but 今天's
// list showed this week's Thursday, 小年夜, no classes (the weekday's coming
// date, not the next school day's).
let state;
const names = () => [...document.querySelectorAll('#schedule-list .cx-cl:not(.is-break) .cx-cl-name')].map(n => n.textContent);

beforeAll(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2027, 1, 3, 17, 30));
  seedLocalStorage({
    weeklySchedule: { 1: ['A'], 2: ['A'], 3: ['A', 'B'], 4: ['C', 'A'], 5: ['A'], 6: [], 0: [] }
  });
  await loadApp();
  ({ state } = await import('../src/state.js'));
});
afterAll(() => vi.useRealTimers());

describe('today over before a week off', () => {
  it('the list is the next school day’s, a week and a day on', () => {
    document.body.dataset.tab = 'today';
    window.MANUALLY_TEST = false;
    state.viewDay = 3;
    state.viewDate = null;
    state.autoAdvancedAfterFinishedDay = null;
    state.lastListKey = '';
    window.update();
    expect(state.viewDay).toBe(4);
    expect(names()).toEqual(['英文', '數學']);
    expect(document.getElementById('cx-list-title').textContent).toContain('2/11');
  });
});
