// Jay 11-26: on 11/26 the newest 學校公告 was 11/20. The proxy answers an old copy while it reads the school
// again behind it; the phone kept that as fresh for half an hour. Now it asks again in seconds.
import { describe, expect, it, vi } from 'vitest';
import * as kit from '#kit/orbit.mjs';
import { state } from '../src/state.js';
import { loadNews } from '../src/school-news.js';

describe('an old copy from the proxy', () => {
  it('is asked again in seconds, then the new one is kept', async () => {
    vi.useFakeTimers();
    state.applicationData = { ...(state.applicationData || {}), school: { name: '國立竹東高中', url: 'https://www.ctsh.hcc.edu.tw/', grade: '3' } };
    const answers = [
      { site: 'https://www.ctsh.hcc.edu.tw/', stale: true, items: [{ id: 'a', title: '舊', date: '2026-11-20' }] },
      { site: 'https://www.ctsh.hcc.edu.tw/', items: [{ id: 'b', title: '新', date: '2026-11-26' }] }
    ];
    const ask = vi.spyOn(kit, 'workerJson').mockImplementation(async () => answers.shift());
    const first = await loadNews({ force: true });
    expect(first.items[0].id).toBe('a');
    await vi.advanceTimersByTimeAsync(7000);
    expect(ask).toHaveBeenCalledTimes(2);
    expect((await loadNews()).items[0].id).toBe('b');
    vi.useRealTimers();
  });
});
