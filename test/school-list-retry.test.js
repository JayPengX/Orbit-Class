// 學校公告's school list: one failed read (offline, a 503) was kept as no list
// for the rest of the visit, so the picker found no school once the connection
// was back (proven 11-18: 竹東 found nothing before and after).
import { describe, expect, it, vi } from 'vitest';
import { loadSchools } from '../src/school-news.js';

describe('the school list', () => {
  it('a failed read is no list for that opening only; the next opening reads it again', async () => {
    const was = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn(async () => new Response('down', { status: 503 }));
      expect(await loadSchools()).toEqual([]);
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify([['國立竹東高級中學', 'https://www.ctsh.hcc.edu.tw', '新竹縣']]), { status: 200 }));
      expect((await loadSchools())[0][0]).toBe('國立竹東高級中學');
      // Read once it's had an answer.
      await loadSchools();
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = was;
    }
  });
});
