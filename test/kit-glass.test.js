import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Class's own surfaces are solid, but the kit's tab bar is glass in every
// app: a blanket "no blur" rule over every element took its blur away and
// left it see-through beside the rest of the family.
describe("the kit's glass keeps its blur", () => {
  it('no rule that turns blur off reaches the tab bar', () => {
    const css = readFileSync(resolve(process.cwd(), 'css/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const offenders = [];
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/backdrop-filter:\s*none\s*!important/.test(body)) continue;
      for (const sel of selectors.split(',').map(x => x.trim())) {
        const element = sel.replace(/::?(before|after)$/, '');
        if (sel !== element) continue; // a pseudo-element is never the bar
        if (/(^|\s)\*/.test(sel) && !sel.includes(':not(.q-tabbar)')) offenders.push(sel);
        if (sel.replace(/:not\([^)]*\)/g, '').includes('q-tabbar')) offenders.push(sel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
