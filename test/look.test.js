import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Orbit's own look is the app's only look (docs/DESIGN.md §11): the page
// says so before anything draws (no flash of another look), and its
// stylesheet comes after the app's own so its rules are the ones that hold.
const read = f => readFileSync(resolve(process.cwd(), f), 'utf8');
describe('the look, always on', () => {
  it('index.html says data-look="native" on <html> and links css/look.css after styles.css', () => {
    const html = read('index.html');
    expect(html).toMatch(/<html[^>]*data-look="native"/);
    const app = html.indexOf('css/styles.css');
    const look = html.indexOf('css/look.css');
    expect(app).toBeGreaterThan(0);
    expect(look).toBeGreaterThan(app);
  });
  it('the card is never filled with the subject\'s colour: graphite, the class a band', () => {
    const css = read('css/look.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/#cx-hero \{[^}]*background: var\(--nv-card\)/);
    expect(read('css/styles.css')).not.toMatch(/\.cx-hero\b/);
  });
  // Jay: no cut-off text at 320. The top line (打掃時間 · 接著第 2 節 beside
  // 09:10–10:00) keeps its time whole: the words give way, the time never.
  it('the top line\'s time never shrinks', () => {
    const css = read('css/look.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/\.nv-span \{[^}]*flex: none/);
    expect(css).toMatch(/\.nv-kicker \{[^}]*min-width: 0/);
  });
});
