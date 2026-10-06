import { beforeAll, describe, expect, it } from 'vitest';
import { loadApp } from './helpers/loadApp.js';

let shortNames;
beforeAll(async () => {
  await loadApp();
  ({ shortNames } = await import('../src/tools.js'));
});

describe('工具 grid: every subject its own short name', () => {
  it('keeps names of up to four characters whole', () => {
    const out = shortNames(['國文', '自主學習', '體育']);
    expect([...out.values()]).toEqual(['國文', '自主學習', '體育']);
  });
  it('a long name by its first two, unless that reads like another subject', () => {
    const out = shortNames(['社會經濟補給站', '社會', '民主政治與法律', '英文閱讀與寫作', '英文聽講練習']);
    expect(out.get('民主政治與法律')).toBe('民主');
    // Was 社會 for both: the first character, then the first that differs.
    expect(out.get('社會')).toBe('社會');
    expect(out.get('社會經濟補給站')).toBe('社經');
    expect(out.get('英文閱讀與寫作')).toBe('英閱');
    expect(out.get('英文聽講練習')).toBe('英聽');
    expect(new Set(out.values()).size).toBe(out.size);
  });
  it('a Latin name by its first word', () => {
    expect(shortNames(['Physics Lab']).get('Physics Lab')).toBe('Physic');
  });
});
