// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bindSheetDragToDismiss } from '../src/sheet-drag.js';

// A finger on the sheet, moved down `dy` px over `ms`.
function swipe(target, dy, { dx = 0, ms = 400 } = {}) {
  const at = (x, y) => ({ clientX: x, clientY: y, identifier: 0, target });
  const ev = (type, x, y) => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [at(x, y)] });
    target.dispatchEvent(e);
    return e;
  };
  const now = Date.now();
  vi.setSystemTime(now);
  ev('touchstart', 100, 100);
  ev('touchmove', 100 + dx / 2, 100 + dy / 2);
  vi.setSystemTime(now + ms);
  const last = ev('touchmove', 100 + dx, 100 + dy);
  ev('touchend', 100 + dx, 100 + dy);
  return last;
}

function sheet() {
  document.body.innerHTML = '<div id="s" class="modal-sheet show"><div class="test-panel-handle"></div><div class="body"><p>課</p><input id="f"></div></div>';
  const close = vi.fn();
  bindSheetDragToDismiss('s', close);
  return { panel: document.getElementById('s'), close };
}

describe('a sheet swiped down closes from anywhere on it, as on iOS', () => {
  it('a swipe on the sheet itself (not only the small handle) closes it', async () => {
    vi.useFakeTimers();
    const { panel, close } = sheet();
    const move = swipe(panel.querySelector('p'), 160);
    expect(move.defaultPrevented).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(close).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
  it('a short pull springs back; sideways, from a field or while scrolled down does nothing', async () => {
    vi.useFakeTimers();
    const { panel, close } = sheet();
    swipe(panel.querySelector('p'), 50, { ms: 600 });
    swipe(panel.querySelector('p'), 160, { dx: 300 });
    swipe(panel.querySelector('#f'), 160);
    Object.defineProperty(panel, 'scrollTop', { value: 40, configurable: true });
    Object.defineProperty(panel, 'scrollHeight', { value: 900 });
    Object.defineProperty(panel, 'clientHeight', { value: 400 });
    swipe(panel.querySelector('p'), 160);
    await vi.advanceTimersByTimeAsync(400);
    expect(close).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
