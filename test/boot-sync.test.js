// The Pass turning live as Class opens is that same opening: its copy is
// merged by the opening (startFromPass), never read a second time by the
// 'active' check. Each opening read the account twice, 11-18
// (tools/speed.mjs class: 4 Pass calls → 2 on a first opening).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sync = readFileSync(resolve(process.cwd(), 'src/sync.js'), 'utf8');

describe('opening', () => {
  it("doesn't read the Pass again while the opening merges it", () => {
    expect(sync).toMatch(/q\.on\('active', live => live && !bootMerging && syncTick\(\)\)/);
    expect(sync).toMatch(/finally \{\s*bootMerging = false;/);
  });
});
