import { describe, expect, it } from 'vitest';
import { isQuestion, dayOf, localAnswer, askFacts } from '../src/class-ask.js';

const now = new Date(2026, 10, 11, 7, 0); // Wed
const days = {
  '2026-11-11': [{ n: 1, name: '國文', from: '08:10', to: '09:00' }, { n: 7, name: '自習', from: '15:10', to: '16:00' }],
  '2026-11-12': [{ n: 1, name: '數學', from: '08:10', to: '09:00' }, { n: 6, name: '美術', from: '14:10', to: '15:00' }],
  '2026-11-14': [],
  '2026-11-18': [{ n: 1, name: '英文', from: '08:10', to: '09:00' }, { n: 5, name: '體育', from: '13:10', to: '14:00', out: true }]
};

describe('問我的課表', () => {
  it('tells a question from an edit', () => {
    expect(isQuestion('下週三幾點放學？')).toBe(true);
    expect(isQuestion('哪天最早放學')).toBe(true);
    expect(isQuestion('把週二第三節改成物理')).toBe(false);
    expect(isQuestion('週二第三節換成物理嗎')).toBe(false);
  });
  it('reads the day a question names', () => {
    expect(dayOf('明天', now).getDate()).toBe(12);
    expect(dayOf('週三', now).getDate()).toBe(11);
    expect(dayOf('下週三', now).getDate()).toBe(18);
    expect(dayOf('星期六', now).getDate()).toBe(14);
    expect(dayOf('哪天', now)).toBe(null);
  });
  it('answers a day’s first, last and classes by code; the rest is the AI’s', () => {
    expect(localAnswer('明天幾點放學？', days, now)).toBe('11/12（週四）最後一節是第 6 節美術，15:00 下課。');
    expect(localAnswer('下週三第一節是什麼？', days, now)).toBe('11/18（週三）第一節是英文，08:10 上課。');
    expect(localAnswer('今天有什麼課', days, now)).toBe('11/11（週三）：1 國文、7 自習。');
    expect(localAnswer('星期六有課嗎', days, now)).toBe('11/14（週六）沒有課。');
    expect(localAnswer('哪天最早放學？', days, now)).toBe(null);
  });
  it('tells the AI a line a day, outdoors marked', () => {
    const f = askFacts(days, now);
    expect(f.split('\n')[0]).toBe('Today: 2026-11-11 (Wed).');
    expect(f).toContain('2026-11-18 Wed: 1 08:10-09:00 英文; 5 13:10-14:00 體育 (outdoors)');
    expect(f).not.toContain('2026-11-14');
  });
});
