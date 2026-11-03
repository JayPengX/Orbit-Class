// Every feature in FEATURES.md must still be in the code: each line names
// the files and the marks (a function, a class, a string) that make it.
// A refactor that drops one fails here instead of vanishing silently.
// To remove a feature on purpose, delete its line in FEATURES.md in the same commit.
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = readFileSync(join(root, 'FEATURES.md'), 'utf8').split('\n').filter(l => /^- .+ — `[^`]+`.*: `/.test(l));

describe('features kept', () => {
  it('FEATURES.md lists features', () => expect(rows.length).toBeGreaterThan(0));
  for (const row of rows) {
    const [name, rest] = row.slice(2).split(' — ');
    const [filesPart, marksPart] = rest.split(/`:\s/);
    const files = [...(filesPart + '`').matchAll(/`([^`]+)`/g)].map(m => m[1]);
    const marks = [...marksPart.matchAll(/`([^`]+)`/g)].map(m => m[1]);
    it(name, () => {
      const text = files.map(f => (expect(existsSync(join(root, f)), `${name}: ${f} is gone`).toBe(true), readFileSync(join(root, f), 'utf8'))).join('\n');
      for (const m of marks) expect(text.includes(m), `${name}: "${m}" is gone from ${files.join(', ')}`).toBe(true);
    });
  }
});
