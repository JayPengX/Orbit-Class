import { describe, expect, it } from 'vitest';
import { COLOR_CHOICES, eventLook, iconKeyOf, subjectLook, subjectTile } from '../src/subjects.js';
import { normalizeSettingsData, encodeTransferData, decodeTransferData } from '../src/editor-backup.js';
import { buildFixtureData } from './helpers/fixtureData.js';
import { state } from '../src/state.js';

describe('every subject has its picture (an icon in its own colour)', () => {
  it('knows the subjects of a Taiwanese timetable, the narrower names first', () => {
    const key = n => subjectLook(n).key;
    expect(['國文', '英文', '數學', '物理', '化學', '生物', '歷史', '地理', '公民與社會', '體育', '音樂', '美術', '自主學習'].map(key)).toEqual(['chinese', 'english', 'math', 'physics', 'chemistry', 'biology', 'history', 'geography', 'civics', 'pe', 'music', 'art', 'study']);
    // 地球科學 isn't 地理; 生活科技 isn't 資訊.
    expect(key('地球科學')).toBe('earth');
    expect(key('生活科技')).toBe('life-tech');
    expect(key('資訊科技')).toBe('computer');
    expect(key('English Literature')).toBe('english');
  });
  it('a subject it does not know: a book, the same colour every time', () => {
    const a = subjectLook('週末營隊A');
    expect(a.key).toBe('other');
    expect(subjectLook('週末營隊A').color).toBe(a.color);
    expect(a.icon).toMatch(/^<svg/);
  });
  it('no two subjects of a timetable share an icon; a picked one wins', () => {
    const before = state.applicationData;
    state.applicationData = { teacherDB: { A: ['國文', '', ''], B: ['國文選讀', '', ''], C: ['週末營隊', '', ''], D: ['公民/國寫', '', ''] }, teacherOrder: ['A', 'B', 'C', 'D'] };
    const keys = ['國文', '國文選讀', '週末營隊', '公民', '國寫'].map(iconKeyOf);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toBe('book');
    state.applicationData.subjectIcons = { 週末營隊: 'book' };
    expect(iconKeyOf('週末營隊')).toBe('book');
    expect(iconKeyOf('國文')).not.toBe('book');
    state.applicationData = before;
  });
  it('drawn as a tile in the subject colour', () => {
    const tile = subjectTile('物理', 'sm');
    expect(tile.className).toBe('q-tile sm');
    expect(tile.style.getPropertyValue('--t')).toBe(subjectLook('物理').color);
    expect(tile.querySelector('svg')).not.toBeNull();
  });
  it("倒數's events: an exam a pen, sports day a trophy, anything else a calendar", () => {
    expect(eventLook('第一次段考')).not.toEqual(eventLook('校慶運動會'));
    expect(eventLook('寒假')).toEqual(eventLook('某天'));
  });
});

// Jay 2026-11-05: "I literally can't tell how you color them" — a colour says
// the subject's group, a group never shares its colour with another, and a
// person can put any subject on any colour (kept with the timetable).
describe('a subject colour follows its group, and can be picked', () => {
  const groupColor = names => new Set(names.map(n => subjectLook(n).color));
  it('subjects of one group wear one colour', () => {
    expect(groupColor(['國文', '國寫', '古文選讀']).size).toBe(1);
    expect(groupColor(['物理', '化學', '生物', '地球科學']).size).toBe(1);
    expect(groupColor(['歷史', '地理', '公民與社會', '民主政治與法律', '族群與性別']).size).toBe(1);
    expect(groupColor(['英文', '英文作文', 'Advanced English']).size).toBe(1);
  });
  it('the groups never share a colour', () => {
    const one = ['國文', '英文', '西班牙語', '數學', '物理', '歷史', '美術', '體育', '資訊科技', '班會'];
    expect(groupColor(one).size).toBe(one.length);
  });
  it("a subject no rule knows is grey, as 班會 (no colour of a group it isn't)", () => {
    expect(subjectLook('週末營隊').color).toBe(subjectLook('班會').color);
  });
  it('a picked colour wins, and back to its group when cleared', () => {
    const before = state.applicationData;
    state.applicationData = { teacherDB: { A: ['國文', '', ''] }, teacherOrder: ['A'], subjectColors: { 國文: 'teal' } };
    expect(subjectLook('國文').swatch).toBe('teal');
    expect(COLOR_CHOICES).toContain('teal');
    state.applicationData.subjectColors = { 國文: 'nonsense' };
    expect(subjectLook('國文').color).toBe(subjectLook('國寫').color);
    state.applicationData = before;
  });
  it('picked colours ride with the timetable: saved, sent and read back', async () => {
    const data = normalizeSettingsData({ ...buildFixtureData(), subjectColors: { 國文: 'teal', '': 'red' } });
    expect(data.subjectColors).toEqual({ 國文: 'teal' });
    const back = await decodeTransferData(await encodeTransferData({ ...data, subjectIcons: { 國文: 'feather' } }));
    expect(back.subjectColors).toEqual({ 國文: 'teal' });
    expect(back.subjectIcons).toEqual({ 國文: 'feather' });
  });
});
