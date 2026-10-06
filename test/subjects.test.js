import { describe, expect, it } from 'vitest';
import { eventLook, subjectIcon, subjectLook } from '../src/subjects.js';

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
    const a = subjectLook('多元選修A');
    expect(a.key).toBe('other');
    expect(subjectLook('多元選修A').color).toBe(a.color);
    expect(a.icon).toMatch(/^<svg/);
  });
  it('drawn as a tile in the subject colour', () => {
    const tile = subjectIcon('物理', 'row-icon');
    expect(tile.className).toBe('subject-icon row-icon');
    expect(tile.style.getPropertyValue('--subject')).toBe('#8b5cf6');
    expect(tile.querySelector('svg')).not.toBeNull();
  });
  it("倒數's events: an exam a pen, sports day a trophy, anything else a calendar", () => {
    expect(eventLook('第一次段考')).not.toBe(eventLook('校慶運動會'));
    expect(eventLook('寒假')).toBe(eventLook('某天'));
  });
});
