import { describe, expect, it } from 'vitest';
import { parseSwapEdit } from '../src/nl-swap.js';

// Tuesday 2026-10-20, eight periods.
const now = new Date(2026, 9, 20, 9, 0);
const data = (classSwaps = []) => ({ bellTimes: Array.from({ length: 8 }, () => ['08:00', '08:50']), classSwaps });

describe('調課 from the AI box', () => {
  it('明天第2節和第5節調課: tomorrow, those two periods', () => {
    expect(parseSwapEdit('明天第2節和第5節調課', data(), now).swaps).toEqual([{ a: { date: '2026-10-21', p: 1 }, b: { date: '2026-10-21', p: 4 } }]);
  });
  it('across weeks, by date', () => {
    expect(parseSwapEdit('10/23 第三節跟 10/30 第一節調課', data(), now).swaps).toEqual([{ a: { date: '2026-10-23', p: 2 }, b: { date: '2026-10-30', p: 0 } }]);
  });
  it('下週三 is next week\'s; a dated 對調 is a 調課', () => {
    expect(parseSwapEdit('下週三第一節與週五第四節對調', data(), now).swaps).toEqual([{ a: { date: '2026-10-28', p: 0 }, b: { date: '2026-10-23', p: 3 } }]);
  });
  it('a weekly 對調 (no date, no 調課) is the timetable\'s, not this', () => {
    expect(parseSwapEdit('週二第三節和週四第五節對調', data(), now)).toBeNull();
    expect(parseSwapEdit('把週二第三節改成物理', data(), now)).toBeNull();
  });
  it('keeps the swaps already set, and refuses a period already swapped', () => {
    const had = [{ a: { date: '2026-10-21', p: 1 }, b: { date: '2026-10-21', p: 4 } }];
    expect(parseSwapEdit('週四第1節和第2節調課', data(had), now).swaps).toHaveLength(2);
    expect(parseSwapEdit('明天第2節和第3節調課', data(had), now).error).toBeTruthy();
  });
  it('取消明天的調課 removes that day\'s', () => {
    const had = [{ a: { date: '2026-10-21', p: 1 }, b: { date: '2026-10-21', p: 4 } }];
    expect(parseSwapEdit('取消明天的調課', data(had), now).swaps).toEqual([]);
  });
  it('a period past the day\'s last is an error, not a guess', () => {
    expect(parseSwapEdit('明天第2節和第9節調課', data(), now).error).toBeTruthy();
  });
});
