import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';

// Orbit keeps Class open: a phone that slept from Monday's school day to
// Wednesday morning ran no tick when Monday ended. 今天 still listed 週一的課
// (next Monday's) on Wednesday, never today's.
let state;
describe('a day later, the app kept open', () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-08T10:30:00'));
    seedLocalStorage();
    await loadApp();
    ({ state } = await import('../src/state.js'));
  });
  afterAll(() => vi.useRealTimers());
  it('lists today again after the phone slept through the night', () => {
    window.update();
    expect(state.viewDay).toBe(1);
    vi.setSystemTime(new Date('2024-01-10T07:30:00'));
    window.update();
    expect(state.viewDay).toBe(3);
    expect(document.getElementById('cx-list-title').textContent).toBe('之後的課');
  });
});
