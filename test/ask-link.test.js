// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { hasAsk, askInBox } from '../src/ask-link.js';

describe('問 Orbit → 問我的課表 (#ask=)', () => {
  it('knows the address that carries a question', () => {
    expect(hasAsk('#ask=%E6%98%8E%E5%A4%A9')).toBe(true);
    expect(hasAsk('#today&ask=x')).toBe(true);
    expect(hasAsk('#today')).toBe(false);
    expect(hasAsk('#task=x')).toBe(false);
  });
  it('fills the editor’s AI box and sends it', async () => {
    document.body.innerHTML = '<input id="nl-edit-input"><button id="nl-edit-submit"></button>';
    window.openEditor = vi.fn();
    const sent = vi.fn(() => document.getElementById('nl-edit-input').value);
    document.getElementById('nl-edit-submit').addEventListener('click', () => sent());
    expect(await askInBox('明天幾點放學？', async () => {})).toBe(true);
    expect(window.openEditor).toHaveBeenCalled();
    expect(sent).toHaveReturnedWith('明天幾點放學？');
    expect(await askInBox('', async () => {})).toBe(false);
  });
});
