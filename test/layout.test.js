import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { state } from '../src/state.js';
import { buildSchedule, dateKey, dateOfDay, dateOfDayInWeek, getWeekType } from '../src/schedule.js';
import { normalizeSettingsData } from '../src/editor-backup.js';
import { renderTools } from '../src/tools.js';

// Where everything sits: 課表 (the day in either of its weeks, and 調課),
// 工具 (the timetable, AI, 分享), the transfer sheet opened for one thing.
const fixture = () =>
  normalizeSettingsData({
    teacherDB: { A: ['數學', '王老師', '101'], B: ['國文/公民', '李老師/陳老師', '102'] },
    teacherOrder: ['A', 'B'],
    locationDB: {},
    weeklySchedule: { 1: ['A', 'B'], 2: ['B', 'A'], 3: ['A', 'B'], 4: ['B', 'A'], 5: ['A', 'B'] },
    bellTimes: [
      ['08:00', '08:50'],
      ['09:10', '10:00']
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

const names = () => [...document.querySelectorAll('#schedule-list .row .row-name')].map(n => n.textContent);

describe('dateOfDayInWeek', () => {
  it('is the coming date, or a week on when that is the other week', () => {
    const now = new Date(2030, 0, 9);
    const coming = dateOfDay(1, now);
    const week = getWeekType(coming);
    const other = week === '單' ? '雙' : '單';
    expect(dateKey(dateOfDayInWeek(1, null, now))).toBe(dateKey(coming));
    expect(dateKey(dateOfDayInWeek(1, week, now))).toBe(dateKey(coming));
    const later = dateOfDayInWeek(1, other, now);
    expect(Math.round((later - coming) / 86400000)).toBe(7);
    expect(getWeekType(later)).toBe(other);
  });
});

describe('課表', () => {
  it('shows the day in either of its weeks, its other half a tap away', () => {
    document.body.dataset.tab = 'week';
    state.viewDay = 1;
    state.viewWeek = null;
    window.update();
    const seg = () => [...document.querySelectorAll('#cx-week-switch button')];
    expect(seg().map(b => b.textContent.split(' ')[0]).sort()).toEqual(['單週', '雙週']);
    const first = names().join(',');
    expect(first).toMatch(/國文|公民/);
    seg().find(b => b.getAttribute('aria-selected') === 'false').click();
    expect(state.viewWeek).not.toBeNull();
    const second = names().join(',');
    expect(second).not.toBe(first);
    expect(second).toMatch(/國文|公民/);
    // 調課 is here, not on 工具.
    expect(document.querySelector('#cx-swaps .cx-way.is-swap')).not.toBeNull();
  });
});

describe('工具', () => {
  it('is the timetable, then AI and 分享', () => {
    document.body.dataset.tab = 'tools';
    renderTools();
    const heads = [...document.querySelectorAll('#cx-tools .cx-section')].map(h => h.textContent);
    expect(heads).toEqual(['我的課表', 'AI', '分享']);
    expect(document.querySelector('#cx-tools .cx-tl-part')).toBeNull();
    expect(document.querySelector('#cx-tools .cx-way.is-swap')).toBeNull();
  });

  it('拍照匯入 opens the transfer sheet on AI 匯入 alone, 分享金鑰 on the key alone', () => {
    document.body.dataset.tab = 'tools';
    renderTools();
    const sheet = document.getElementById('transfer-sheet');
    document.querySelector('#cx-tools .cx-way.is-photo').click();
    expect(sheet.dataset.focus).toBe('photo');
    expect(sheet.querySelector('.editor-title').textContent).toBe('拍照匯入');
    window.closeTransferSheet?.(true);
    document.querySelector('#cx-tools .cx-way.is-key').click();
    expect(sheet.dataset.focus).toBe('key');
    expect(sheet.querySelector('.editor-title').textContent).toBe('分享金鑰');
    expect(document.activeElement?.id).not.toBe('quadra-key');
    window.closeTransferSheet?.(true);
  });

  it('AI 課表編輯 opens the editor on its own page', () => {
    document.body.dataset.tab = 'tools';
    renderTools();
    document.querySelector('#cx-tools .cx-way.is-ai').click();
    expect(document.getElementById('editor-fold-ai').classList.contains('active')).toBe(true);
    expect(document.querySelector('#editor-fold-ai #nl-edit-input')).not.toBeNull();
    window.closeEditor?.(true);
  });
});
