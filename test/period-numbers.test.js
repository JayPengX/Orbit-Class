import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { state } from '../src/state.js';
import { buildSchedule } from '../src/schedule.js';
import { normalizeSettingsData } from '../src/editor-backup.js';
import { openModal } from '../src/view-sheet.js';
import { renderWeek } from '../src/view-week.js';

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
    expect(document.getElementById('m-count').textContent).toBe('3');
    window.closeModal();
  });
});

describe('課表’s week grid puts each class in its own period’s row', () => {
  it('a free period is an empty cell, never the next class moved up', () => {
    // The week of Tuesday 2026-10-20 (no holiday in it).
    renderWeek(new Date(2026, 9, 20, 9));
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

// 11-12 testing: the editor's hint (and a phone's Chinese keys) write 「／」; it splits by week like "/".
describe('a class split by week with the full-width slash', () => {
  it('國文／公民 is 國文 in a 單週 and 公民 in a 雙週, each counted in its own week', async () => {
    const { processSplitName, getWeekType } = await import('../src/schedule.js');
    state.applicationData = { ...fixture(), teacherDB: { A: ['數學', '王老師', ''], B: ['英文', '林老師', ''], C: ['國文／公民', '李老師／蔡老師', ''], D: ['公民', '蔡老師', ''] }, weeklySchedule: { 1: ['C', 'D'], 2: ['A', 'B'] }, classSwaps: [] };
    buildSchedule();
    const c = state.runtimeSchedule[1][0];
    expect(c.isSplit).toBe(true);
    expect(processSplitName(c, '單')).toMatchObject({ n: '國文', t: '李老師' });
    expect(processSplitName(c, '雙')).toMatchObject({ n: '公民', t: '蔡老師' });
    // A 雙週 Monday: 公民 meets twice that week (the split period and its own).
    const even = [new Date(2026, 10, 9), new Date(2026, 10, 16)].find(d => getWeekType(d) === '雙');
    openModal(c, { date: even });
    expect(document.querySelector('#m-count').textContent).toBe('2');
  });
});
