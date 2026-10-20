import { describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

// Each `it` here needs localStorage seeded with bad data *before* loadApp()
// runs main.js's import chain (bootstrap.js reads it synchronously via
// data.js's loadData() as part of boot) - and each needs its own fresh
// module registry so that boot happens fresh against that specific bad
// value, matching the pattern other multi-scenario test files in this suite
// use (see sync-default-project.test.js's comment on the same constraint).
describe("loadData() sets a saved schedule it can't read aside, never erasing it, so the pass's copy comes back", () => {
  it('keeps invalid JSON aside and drops the waiting-edit marker', async () => {
    localStorage.setItem('classFocusData', '{not valid json');
    localStorage.setItem('orbit-class.sync.pending', 'abc:12');
    await loadApp();
    const { state } = await import('../src/state.js');

    expect(localStorage.getItem('classFocusData')).toBeNull();
    expect(localStorage.getItem('classFocusData.unreadable')).toBe('{not valid json');
    expect(localStorage.getItem('orbit-class.sync.pending')).toBeNull();
    expect(state.applicationData.teacherDB).toHaveProperty('01國文');
  });
});
