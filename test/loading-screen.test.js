import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = f => readFileSync(resolve(process.cwd(), f), 'utf8');

// Class opens like every other app: the kit's loading screen (boot.js drawn
// into #loading), lifted once the first screen is ready. It was the one app
// without it (a spinner inside the summary card instead).
describe("the family's loading screen", () => {
  it("index.html has #loading first in the body, the kit's boot script right after it", () => {
    const html = read('index.html');
    const body = html.slice(html.indexOf('<body'));
    expect(body).toMatch(/^<body[^>]*>\s*<div id="loading" data-title="Orbit Class"><\/div>\s*<!-- kit:boot/);
    expect(body).toContain("ORBIT_KIT.url('boot.js')");
    // The family's service worker, with Class's own cache.
    expect(read('public/sw.js')).toContain("importScripts('../Orbit-Core/kit/sw.js')");
  });
  it('the app says it started and lifts the screen itself (never left up, never "didn\'t start")', () => {
    const js = read('src/bootstrap.js');
    expect(js).toContain('window.__fxStarted = true');
    expect(js).toMatch(/Promise\.race\(\[ready\.then\(\(\) => true\), new Promise\(resolve => setTimeout\(resolve, (?:\d+|LIFT_MS), false\)\)\]\)\.then\(liftLoading, \(\) => liftLoading\(false\)\)/);
  });
});
