import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { state } from '../src/state.js';
import { buildSchedule } from '../src/schedule.js';
import { normalizeSettingsData } from '../src/editor-backup.js';
import { openModal } from '../src/dashboard.js';
import { renderTools } from '../src/tools.js';

// A day's list (runtimeSchedule) leaves its free periods out, so a class's
// place in it isn't its period: Monday's 1st period free, 數學 is 第 2 節.
const fixture = () =>
  normalizeSettingsData({
    teacherDB: { A: ['數學', '王老師', '101'], B: ['英文', '林老師', '102'] },
    teacherOrder: ['A', 'B'],
    locationDB: {},
    weeklySchedule: { 1: ['', 'A', '', 'B'], 2: ['A', 'B'], 3: ['', '', 'A'] },
    bellTimes: [
      ['08:00', '08:50'],
      ['09:10', '10:00'],
      ['10:10', '11:00'],
      ['11:10', '12:00']
    ],
    breakTimes: [],
    countdownEvents: [],
    reverseWeek: false,
    styleSlots: []
  });

beforeAll(async () => {
  await loadApp();
});
beforeEach(() => {
  state.applicationData = { ...fixture(), classSwaps: [] };
  buildSchedule();
});

describe('a class’s card names each day’s periods by their own number', () => {
  it('數學: 週一 第 2 節, 週二 第 1 節, 週三 第 3 節', () => {
    openModal(state.runtimeSchedule[1].find(c => c.key === 'A'));
    const days = [...document.querySelectorAll('#m-occ-list .occ-day')].map(d => [
      d.querySelector('.occ-day-name').textContent,
      d.querySelector('.occ-day-period').textContent,
      d.querySelector('.occ-day-time').textContent
    ]);
    expect(days.slice(0, 3)).toEqual([
      ['週一', '第 2 節', '09:10'],
      ['週二', '第 1 節', '08:00'],
      ['週三', '第 3 節', '10:10']
    ]);
    expect(document.getElementById('m-count').textContent).toBe('3 節');
    window.closeModal();
  });
});

describe('工具’s week grid puts each class in its own period’s row', () => {
  it('a free period is an empty cell, never the next class moved up', () => {
    document.body.dataset.tab = 'tools';
    renderTools();
    const grid = document.querySelector('.cx-tl-grid');
    const days = [...grid.querySelectorAll('.cx-tl-day')].length;
    const cells = [...grid.querySelectorAll('.cx-tl-cell')];
    // Four periods (Monday's last is 第 4 節), one row each.
    expect([...grid.querySelectorAll('.cx-tl-num')].map(n => n.textContent)).toEqual(['1', '2', '3', '4']);
    const at = (row, col) => cells[row * days + col];
    expect(at(0, 0).classList.contains('is-empty')).toBe(true);
    expect(at(1, 0).textContent).toBe('數學');
    expect(at(2, 0).classList.contains('is-empty')).toBe(true);
    expect(at(3, 0).textContent).toBe('英文');
    expect(at(0, 1).textContent).toBe('數學');
    expect(at(2, 2).textContent).toBe('數學');
  });
});
