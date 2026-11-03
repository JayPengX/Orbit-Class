import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Jay: no cut-off text at 320. The card's top line ("打掃時間 · 接著第 2 節"
// beside "09:10–10:00") ran 5px past its room at 15px; on narrow phones it
// steps down to 14px (the time to 12px). shots.mjs flags a cut if it returns.
describe('the 今天 card top line on a narrow phone', () => {
  it('steps the words and the time down at ≤360px', () => {
    const css = readFileSync(resolve(process.cwd(), 'css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const narrow = css.match(/@media \(max-width: 360px\) \{([\s\S]*?)\n\}/)?.[1] || '';
    expect(narrow).toMatch(/\.cx-hero-top \.q-hc-eyebrow \{[^}]*font-size: 14px/);
    expect(narrow).toMatch(/\.cx-span \{[^}]*font-size: 12px/);
  });
});
