// Class's guide (帶我走一遍, kit coach.mjs GUIDES.orbit): every step's
// target is something the app still draws, so a redesign that moves a
// button fails here, not on a person's first open (Jay 2026-11-19).
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GUIDES } from '#kit/coach.mjs';

const root = process.cwd();
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => (e.name === 'node_modules' || e.name.startsWith('.') ? [] : e.isDirectory() ? walk(join(d, e.name)) : /\.(mjs|js|html)$/.test(e.name) ? [readFileSync(join(d, e.name), 'utf8')] : []));
const app = [...walk(join(root, 'src')), readFileSync(join(root, 'index.html'), 'utf8')].join('\n');
const kit = readdirSync(join(root, '.kit')).filter(f => f.endsWith('.mjs')).map(f => readFileSync(join(root, '.kit', f), 'utf8')).join('\n');

test("every step of Class's guide points at something the app draws", () => {
  const steps = GUIDES.orbit;
  assert.ok(steps?.length, 'Class has a guide');
  for (const s of steps) {
    const sel = s.tap || s.show;
    if (!sel) continue;
    // Each id, class and attribute value the selector names is in the app's code (or the kit's: its tabs, sheets, buttons).
    const names = [...sel.matchAll(/#([\w-]+)|\.([\w-]+)|\[[\w-]+="([^"]+)"\]/g)].map(m => m[1] || m[2] || m[3]);
    for (const name of names) assert.ok(app.includes(name) || kit.includes(name), `${sel}: “${name}” is nowhere in the app`);
  }
});
