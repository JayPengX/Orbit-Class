import { beforeAll, describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { state } from '../src/state.js';
import { buildSchedule } from '../src/schedule.js';
import { normalizeClassSwaps } from '../src/data.js';
import { normalizeSettingsData } from '../src/editor-backup.js';
import { WEEKS, buildIcs } from '../src/calendar.js';

// 加到行事曆: the calendar the phone hands the Worker (src/calendar.js).
// 2030-01-07 is a Monday; 2030-01-01 (元旦), a Tuesday, is a day off.
const fixture = () =>
  normalizeSettingsData({
    teacherDB: { A: ['數學', '王老師', '101'], B: ['國文/公民', '李老師/陳老師', '102'], C: ['英文, 會話', '林老師', '103'] },
    teacherOrder: ['A', 'B', 'C'],
    locationDB: { A: '101', B: '102', C: '' },
    weeklySchedule: { 1: ['A', 'B', 'C'], 2: ['A'], 3: ['C'] },
    bellTimes: [
      ['08:00', '08:50'],
      ['09:10', '10:00'],
      ['10:10', '11:00']
    ],
    breakTimes: [],
    countdownEvents: [],
    reverseWeek: false,
    styleSlots: []
  });

beforeAll(async () => {
  await loadApp();
  state.applicationData = { ...fixture(), classSwaps: normalizeClassSwaps([]) };
  buildSchedule();
});

const events = ics => ics.split('BEGIN:VEVENT').slice(1);

describe('buildIcs', () => {
  it('a valid calendar: CRLF lines, Taipei time, every class of WEEKS weeks', () => {
    const ics = buildIcs(new Date(2030, 0, 9));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
    // Mondays 3 classes, Tuesdays and Wednesdays 1, from Monday 01-07.
    expect(events(ics)).toHaveLength(WEEKS * 5);
    expect(ics).toContain('DTSTART;TZID=Asia/Taipei:20300107T080000');
    expect(ics).toContain('DTEND;TZID=Asia/Taipei:20300107T085000');
    expect(ics).toContain('UID:20300107-0@class.orbit');
    expect(ics).toContain('LOCATION:101');
  });
  it('odd and even weeks each show their own subject; text is escaped', () => {
    const ics = buildIcs(new Date(2030, 0, 7));
    const b = events(ics).filter(e => e.includes('T091000'));
    const subjects = new Set(b.map(e => /SUMMARY:(.*)\r\n/.exec(e)[1]));
    expect(subjects).toEqual(new Set(['國文', '公民']));
    expect(ics).toContain('SUMMARY:英文\\, 會話');
  });
  it('the same timetable gives the same calendar (no stamp): the change check holds', () => {
    expect(buildIcs(new Date(2030, 0, 9))).toBe(buildIcs(new Date(2030, 0, 10)));
  });
  it('no class on a national day off', () => {
    const ics = buildIcs(new Date(2029, 11, 31));
    expect(ics).not.toContain('20300101T');
    expect(ics).toContain('DTSTART;TZID=Asia/Taipei:20300108T080000');
  });
  it('一個行事曆: the day off itself, all day, and the games followed in Orbit Sports', () => {
    const at = Date.UTC(2030, 0, 2, 11, 30); // Wed 2030-01-02 19:30 in Taipei
    const games = [
      { id: 'nba:401', at, mins: 150, title: '湖人 vs 勇士', hash: '#event=nba:401' },
      { id: 'mlb:9', at: Date.UTC(2030, 2, 1), mins: 180, title: '道奇 vs 洋基', hash: '' }
    ];
    const ics = buildIcs(new Date(2029, 11, 31), { games });
    const off = events(ics).find(e => e.includes('DTSTART;VALUE=DATE:20300101'));
    expect(off).toContain('DTEND;VALUE=DATE:20300102');
    expect(off).toContain('SUMMARY:');
    expect(off).toContain('TRANSP:TRANSPARENT');
    const game = events(ics).find(e => e.includes('UID:game-nba-401@sports.orbit'));
    expect(game).toContain('DTSTART:20300102T113000Z');
    expect(game).toContain('DTEND:20300102T140000Z');
    expect(game).toContain('SUMMARY:湖人 vs 勇士');
    // (Past the calendar's weeks: left out.)
    expect(ics).not.toContain('mlb-9');
  });
});
