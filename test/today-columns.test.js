import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = f => readFileSync(resolve(process.cwd(), f), 'utf8');

// 今天 on a wide screen (Jay's iPad 2026-11-11: one class on the left beside a
// long right column of 待辦, 學校公告 and the countdowns): the day strip across
// the page, then its four sections as one flow the kit deals into two columns of
// even height, and deals again as each fills in (.q-flow-refit). Never a fixed
// left/right split.
describe('今天 lays its sections out by their height', () => {
  const html = read('index.html');
  const today = html.slice(html.indexOf('id="panel-today"'), html.indexOf('id="panel-week"'));
  it('puts the day strip before the flow, and the four sections in it', () => {
    const flow = today.match(/<div class="([^"]*\bq-flow\b[^"]*)">/);
    expect(flow?.[1].split(' ')).toEqual(expect.arrayContaining(['q-flow', 'q-flow-2', 'q-flow-refit', 'cx-today-cols']));
    expect(today.indexOf('id="cx-days"')).toBeLessThan(today.indexOf('cx-today-cols'));
    const inside = today.slice(today.indexOf('cx-today-cols'));
    const ids = [...inside.matchAll(/<section class="q-section cx-sec" id="([^"]+)"/g)].map(m => m[1]);
    expect(ids).toEqual(['cx-list-sec', 'cx-todos', 'cx-news', 'cx-countdowns']);
    expect(today).not.toMatch(/cx-today-side|cx-today-day/);
  });
  it('deals the flow once drawn', () => {
    const src = read('src/view-today.js');
    expect(src).toMatch(/flowColumns\?\.\(cols\)/);
  });
});
