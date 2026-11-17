import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';
import { holidayOn } from '../src/holidays.js';

// 寒假 and 暑假 (Jay 11-17): Class didn't know them, so on a break it showed
// the day's classes and sent 「5 分鐘後上課」 every weekday.
const pushes = [];
vi.mock('#kit/orbit.mjs', async importOriginal => ({ ...(await importOriginal()), schedulePush: (q, items) => pushes.push(items) }));

const off = d => holidayOn(new Date(`${d}T12:00:00`));

describe('寒假 and 暑假 are days off', () => {
  it('竹東高中’s 行事曆: 115-1 ends 1/20, 寒假 1/21–2/10, 開學 2/11', () => {
    expect(off('2027-01-20')).toBe(null);
    expect(off('2027-01-21')?.zh).toBe('寒假');
    expect(off('2027-02-01')?.zh).toBe('寒假');
    expect(off('2027-02-08')).not.toBe(null); // 春節, by its name
    expect(off('2027-02-11')).toBe(null);
  });
  it('竹東高中’s 行事曆: 114-2 opens 2/23, 結業式 6/30, 暑假 7/1, 開學 8/31', () => {
    expect(off('2026-01-23')).toBe(null); // 教育部 moved 寒假 to 1/24 that year
    expect(off('2026-01-26')?.zh).toBe('寒假');
    expect(off('2026-02-12')?.zh).toBe('寒假');
    expect(off('2026-02-23')).toBe(null);
    expect(off('2026-06-30')).toBe(null);
    expect(off('2026-07-01')?.zh).toBe('暑假');
    expect(off('2026-08-28')?.zh).toBe('暑假');
    expect(off('2026-08-31')).toBe(null);
  });
  it('a year not yet published: the rule, 寒假 on through 春節 when it comes after 2/10', () => {
    expect(off('2028-01-20')).toBe(null);
    expect(off('2028-02-10')?.zh).toBe('寒假');
    expect(off('2028-02-11')).toBe(null);
    expect(off('2029-02-12')).not.toBe(null); // 春節 2029 runs past 2/10
    expect(off('2029-02-19')).toBe(null);
    expect(off('2028-07-03')?.zh).toBe('暑假');
  });
});

describe('on a break, Class is quiet', () => {
  let state;
  beforeAll(async () => {
    vi.useFakeTimers();
    // Monday 1/18, the last school week before 寒假: classes every weekday.
    vi.setSystemTime(new Date(2027, 0, 18, 7, 0));
    seedLocalStorage({ weeklySchedule: { 0: [], 1: ['A', 'B', 'C'], 2: ['C'], 3: ['A'], 4: ['B'], 5: ['C', 'A'], 6: [] } });
    await loadApp();
    ({ state } = await import('../src/state.js'));
  });
  afterAll(() => vi.useRealTimers());

  const classDays = () => [...new Set((pushes.at(-1) || []).filter(n => n.kind === 'class').map(n => n.tag.split(':')[1]))];

  it('no 上課 notices from the first day of 寒假', () => {
    window.MANUALLY_TEST = false;
    window.update();
    expect(classDays()).toEqual(['2027-01-18', '2027-01-19', '2027-01-20']);
  });

  it('in 寒假: no notices, 今天 says 寒假 and lists the first day back', () => {
    vi.setSystemTime(new Date(2027, 0, 25, 7, 50));
    document.body.dataset.tab = 'today';
    state.classPushSlot = null;
    state.autoAdvancedAfterFinishedDay = null;
    state.lastListKey = '';
    window.update();
    expect(classDays()).toEqual([]);
    expect(document.getElementById('cx-kicker').textContent).toBe('寒假');
    expect(document.getElementById('cx-list-title').textContent).toContain('2/11');
  });

  it('課表 names the week off once', () => {
    document.body.dataset.tab = 'week';
    state.viewWeek = null;
    state.lastListKey = '';
    window.update();
    expect([...document.querySelectorAll('#cx-grid .cx-tl-cell')].every(c => c.classList.contains('is-empty'))).toBe(true);
    expect(document.querySelector('#cx-grid .cx-tl-offs').textContent).toBe('週一至五 寒假');
  });
});
