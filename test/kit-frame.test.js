// The tab bar and the rail are the kit's alone, so all nine apps draw them
// alike (Jay 2026-11-06, an iPad: Law's side bar beside Sports'): this app's
// CSS sets only their colours, never a size, a place or the type.
import { expect, it } from 'vitest';
import { appFrameFaults } from '../.kit/frame-guard.mjs';

it("the kit's tab bar and rail are drawn as the kit draws them", () => {
  expect(appFrameFaults(process.cwd())).toEqual([]);
});
