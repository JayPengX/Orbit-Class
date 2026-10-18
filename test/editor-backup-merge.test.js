import { beforeAll, describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

// 合併匯入 (merge, not replace): the import's classes added to this device's
// timetable, a class both have merged into one, the import's periods over
// this device's where both have one.
let merge;
let normalize;
beforeAll(async () => {
  await loadApp();
  const backup = await import('../src/editor-backup.js');
  merge = backup.mergeImportedSettings;
  normalize = backup.normalizeSettingsData;
});
const data = ({ teacherDB, weeklySchedule, bellTimes = [['08:00', '08:50'], ['09:10', '10:00'], ['10:10', '11:00']], ...rest }) =>
  normalize({
    teacherDB,
    locationDB: Object.fromEntries(Object.entries(teacherDB).map(([k, v]) => [k, v[2] || ''])),
    weeklySchedule,
    bellTimes,
    breakTimes: [],
    countdownEvents: [],
    ...rest
  });
const subjectsOn = (d, day) => d.weeklySchedule[day].map(key => (key ? d.teacherDB[key][0] : ''));

describe('mergeImportedSettings', () => {
  it('one teacher’s two subjects (國文, 國寫) stay two classes, each in its own periods', () => {
    const current = data({ teacherDB: { c1: ['國文', '李老師', '201'] }, weeklySchedule: { 1: ['c1', '', 'c1'] } });
    const imported = data({
      teacherDB: { x1: ['國文', '李老師', '201'], x2: ['國寫', '李老師', '201'] },
      weeklySchedule: { 2: ['x2', 'x1'] }
    });
    const { data: out } = merge(current, imported);
    expect(Object.values(out.teacherDB).map(v => v[0]).sort()).toEqual(['國寫', '國文']);
    expect(subjectsOn(out, 1)).toEqual(['國文', '', '國文']);
    expect(subjectsOn(out, 2)).toEqual(['國寫', '國文']);
  });

  it('a teacher’s other subject never replaces this device’s class', () => {
    const current = data({ teacherDB: { c1: ['物理', '王老師', ''] }, weeklySchedule: { 1: ['c1'] } });
    const imported = data({
      teacherDB: { x1: ['數學', '王老師', ''], x2: ['物理', '王老師', ''] },
      weeklySchedule: { 3: ['x1', 'x2'] }
    });
    const { data: out } = merge(current, imported);
    expect(subjectsOn(out, 1)).toEqual(['物理']);
    expect(subjectsOn(out, 3)).toEqual(['數學', '物理']);
  });

  it('a renamed subject of the same teacher is still the same class (國語文 for 國文)', () => {
    const current = data({ teacherDB: { c1: ['國文', '李老師', ''] }, weeklySchedule: { 1: ['c1', 'c1'] } });
    const imported = data({ teacherDB: { x1: ['國語文', '李老師', ''] }, weeklySchedule: { 2: ['x1'] } });
    const { data: out, mergedActions } = merge(current, imported);
    expect(Object.keys(out.teacherDB)).toEqual(['x1']);
    expect(subjectsOn(out, 1)).toEqual(['國語文', '國語文']);
    expect(mergedActions.filter(line => line.includes('國語文'))).toHaveLength(1);
  });

  it('the import wins a period both have; this device’s other periods stay', () => {
    const current = data({ teacherDB: { c1: ['數學', '', ''], c2: ['英文', '', ''] }, weeklySchedule: { 1: ['c1', 'c2', 'c1'] } });
    const imported = data({ teacherDB: { x1: ['歷史', '', ''] }, weeklySchedule: { 1: ['', 'x1'] } });
    const { data: out, replacedActions, addedActions } = merge(current, imported);
    expect(subjectsOn(out, 1)).toEqual(['數學', '歷史', '數學']);
    expect(replacedActions.some(line => line.includes('英文'))).toBe(true);
    expect(addedActions.some(line => line.includes('歷史'))).toBe(true);
  });

  it('keeps 調課 and this device’s countdowns; the import’s bell times and odd/even setting win', () => {
    const current = data({
      teacherDB: { c1: ['數學', '', ''] },
      weeklySchedule: { 1: ['c1'] },
      countdownEvents: [{ name: '段考', startDate: '2030-03-01', endDate: '2030-03-02' }],
      classSwaps: [{ a: { date: '2030-01-07', p: 0 }, b: { date: '2030-01-08', p: 0 } }]
    });
    const imported = data({
      teacherDB: { x1: ['數學', '', ''] },
      weeklySchedule: { 1: ['x1'] },
      bellTimes: [['07:50', '08:40']],
      reverseWeek: true,
      countdownEvents: [{ name: '學測', startDate: '2031-01-20', endDate: '2031-01-22' }]
    });
    const { data: out } = merge(current, imported);
    expect(out.bellTimes).toEqual([['07:50', '08:40']]);
    expect(out.reverseWeek).toBe(true);
    expect(out.countdownEvents.map(e => e.name)).toEqual(['段考', '學測']);
    expect(out.classSwaps).toHaveLength(1);
  });
});
