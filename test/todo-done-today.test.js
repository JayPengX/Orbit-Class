import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadApp } from './helpers/loadApp.js';
import { seedLocalStorage } from './helpers/fixtureData.js';

// A to-do due later (or with no day) ticked by mistake left 今天 at the tick,
// and with six or fewer open there was no 全部 to find it and take it back.
describe('待辦 ticked today', () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-08T10:30:00'));
    seedLocalStorage({
      todos: [
        { id: 'a', kind: 'hw', subject: '數學', text: '習作 p.3', due: '2024-01-12', done: false },
        { id: 'b', kind: 'do', subject: '', text: '交回條', due: '', done: false }
      ]
    });
    await loadApp();
  });
  afterAll(() => vi.useRealTimers());
  it('stays on 今天, ticked, until the day is over', () => {
    window.update();
    const rows = () => [...document.querySelectorAll('#cx-todos .cx-todo')].map(r => [r.dataset.id, r.classList.contains('is-done')]);
    expect(rows()).toEqual([['a', false], ['b', false]]);
    for (const id of ['a', 'b']) document.querySelector(`#cx-todos .cx-todo[data-id="${id}"] .cx-todo-check`).click();
    expect(rows()).toEqual([['a', true], ['b', true]]);
    document.querySelector('#cx-todos .cx-todo[data-id="a"] .cx-todo-check').click();
    expect(rows()).toEqual([['a', false], ['b', true]]);
    vi.setSystemTime(new Date('2024-01-09T08:00:00'));
    window.update();
    expect(rows()).toEqual([['a', false]]);
  });
});
