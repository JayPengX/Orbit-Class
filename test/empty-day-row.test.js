import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A day without classes: one row (a picture, why), never a period badge or
// a time column holding 「可以休息或安排自習」.
describe('a day without classes', () => {
  const css = readFileSync(resolve(process.cwd(), 'css/styles.css'), 'utf8');
  const src = readFileSync(resolve(process.cwd(), 'src/view-today.js'), 'utf8');
  it('is a row of its own, with no period badge or time', () => {
    expect(css).toMatch(/\.row\.is-empty \{/);
    const fn = src.slice(src.indexOf('export function emptyDay'), src.indexOf('export function renderTodayList'));
    expect(fn).toContain("'q-ritem row is-empty'");
    expect(fn).not.toContain('period-badge');
    expect(fn).not.toContain('cx-time');
  });
});

// 課表's grid: an empty period stays empty (no wash from the day it's in).
describe("an empty period in the week grid", () => {
  const css = readFileSync(resolve(process.cwd(), 'css/styles.css'), 'utf8');
  it('has its own quiet fill, and no rule colours a cell by its day', () => {
    expect(css).toMatch(/\.cx-tl-cell\.is-empty \{/);
    expect(css).not.toMatch(/\.cx-tl-cell\.is-today/);
  });
});
