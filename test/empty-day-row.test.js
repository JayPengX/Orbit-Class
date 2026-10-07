import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 今天's list on a day without classes: the agenda's grid is time | class |
// period, and a row with no time put 「可以休息或安排自習」 in the 50px time
// column (「可…」) and the × in the middle of the card.
describe("a day without classes in the agenda", () => {
  const css = readFileSync(resolve(process.cwd(), 'css/styles.css'), 'utf8');
  const src = readFileSync(resolve(process.cwd(), 'src/dashboard-render.js'), 'utf8');
  it('is a row of one column, with no period badge', () => {
    expect(css).toMatch(/#schedule-list \.row\.is-empty\{grid-template-columns:minmax\(0,1fr\)\}/);
    const line = src.split('\n').find(l => l.includes("t('dashboard.noClassesToday')"));
    expect(line).not.toContain('period-badge');
    expect(src).toContain("empty.className = 'row is-empty'");
  });
});

// 工具's timetable: an empty period in today's column was filled with
// is-today's accent wash (a later rule of the same weight).
describe("an empty period in today's column", () => {
  const css = readFileSync(resolve(process.cwd(), 'css/styles.css'), 'utf8');
  it('stays empty (no wash), after is-today', () => {
    const today = css.indexOf('.cx-tl-cell.is-today{');
    const empty = css.indexOf('.cx-tl-cell.is-empty.is-today{background:transparent');
    expect(today).toBeGreaterThan(-1);
    expect(empty).toBeGreaterThan(today);
  });
});
