// A command said to Class (src/act.js, the kit's act.mjs): read by code, done the way its own buttons do it.
import { describe, expect, it } from 'vitest';
import { readClassAct, withCountdown } from '../src/act.js';

describe('Class commands', () => {
  const now = new Date(2026, 10, 14, 15, 0);
  it('reads a focus and a countdown, not a question or another app’s', async () => {
    expect(await readClassAct('開始專注飛行 50 分鐘', now)).toEqual({ app: 'orbit', act: 'focus', minutes: 50 });
    expect(await readClassAct('start a flight focus', now)).toEqual({ app: 'orbit', act: 'focus', minutes: null });
    expect(await readClassAct('加段考倒數 11/30', now)).toEqual({ app: 'orbit', act: 'countdown', name: '段考', start: '2026-11-30', end: '' });
    expect(await readClassAct('明天幾點放學？', now)).toBe(null);
    expect(await readClassAct('週二第三節改成物理', now)).toBe(null);
    expect(await readClassAct('追蹤湖人', now)).toBe(null);
  });
  it('adds a countdown for 套用, never twice, 12 at most', () => {
    const current = { countdownEvents: [{ name: '學測', startDate: '2027-01-17', endDate: '2027-01-17' }], reverseWeek: false };
    const r = withCountdown(current, { name: '段考', start: '2026-11-30', end: '' });
    expect(r.next.countdownEvents.map(e => e.name)).toEqual(['學測', '段考']);
    expect(r.next.countdownEvents[1]).toMatchObject({ startDate: '2026-11-30', endDate: '2026-11-30' });
    expect(r.next.reverseWeek).toBe(false);
    expect(current.countdownEvents).toHaveLength(1);
    expect(withCountdown(current, { name: '學測', start: '2027-01-17', end: '' }).same).toBe(true);
    const full = { countdownEvents: Array.from({ length: 12 }, (_, i) => ({ name: `e${i}`, startDate: '2027-01-01', endDate: '2027-01-01' })) };
    expect(withCountdown(full, { name: '段考', start: '2026-11-30', end: '' }).error).toBe('full');
  });
});
