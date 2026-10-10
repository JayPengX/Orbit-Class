// A bottom sheet (test/style panel, the modal, the editor) swiped down closes,
// as on iOS: from anywhere on it while what's under the finger is scrolled to
// its top (not only the small grab handle, which was all that worked: a swipe
// on the sheet itself did nothing), following the finger, closing past 90 px
// or a quick flick, else springing back. Not from a field, a slider or a
// sideways strip, and not a finger that starts by scrolling up or sideways.
// The handle still drags with a mouse. closeFn is called on a successful
// dismiss so guards like the style panel's unsaved-changes confirm still run;
// if it declines to close (panel keeps the 'show' class), the sheet snaps
// back open instead of staying hidden.
// (A row's reorder handle: touch-action none, set on it by bindEditorDragReorder.)
export const SHEET_SKIP = 'input, textarea, select, [contenteditable="true"], .teacher-drag-handle, [style*="touch-action: none"], [data-no-sheet-drag]';
// The scrolled box between the finger and the sheet (the sheet itself included) that isn't at its top.
function scrolledAbove(target, panel) {
  for (let node = target; node && node !== panel.parentElement; node = node.parentElement) {
    if (node.scrollTop > 0 && node.scrollHeight > node.clientHeight) return true;
    if (node === panel) break;
  }
  return false;
}
export function bindSheetDragToDismiss(panelId, closeFn) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const handle = panel.querySelector('.test-panel-handle');
  // Test/style panels are horizontally centered via left:50% + translateX(-50%)
  // baked into their CSS transform (modal-sheet isn't - it's positioned with
  // left/right instead). Dragging must preserve that -50% or the panel loses
  // its centering and ends up shoved off to the right of the screen.
  const centered = panel.classList.contains('test-panel');
  const translate = y => (centered ? `translate(-50%,${y}px)` : `translateY(${y}px)`);
  const threshold = 90;
  const settle = open => {
    panel.style.transition = open
      ? 'transform .35s cubic-bezier(.16,1,.3,1)'
      : 'transform .22s cubic-bezier(.4,0,1,1)';
    panel.style.transform = open ? translate(0) : translate(panel.offsetHeight + 40);
    setTimeout(
      () => {
        panel.style.transition = '';
        panel.style.transform = '';
      },
      open ? 360 : 230
    );
  };
  const begin = () => {
    panel.style.transition = 'none';
    handle?.classList.add('is-dragging');
  };
  const release = (deltaY, ms) => {
    handle?.classList.remove('is-dragging');
    if (deltaY <= threshold && !(deltaY > 40 && deltaY / Math.max(1, ms) > 0.6)) return settle(true);
    panel.style.transition = 'transform .22s cubic-bezier(.4,0,1,1)';
    panel.style.transform = translate(panel.offsetHeight + 40);
    navigator.vibrate?.(8);
    setTimeout(async () => {
      // closeFn may be async (e.g. closeEditor's unsaved-changes check) - await
      // it so the 'show' class check below reflects the actual outcome instead
      // of racing an in-flight promise.
      await closeFn();
      requestAnimationFrame(() => settle(panel.classList.contains('show')));
    }, 220);
  };

  // A finger: anywhere on the sheet.
  let touch = null;
  panel.addEventListener(
    'touchstart',
    event => {
      touch = null;
      if (event.touches.length !== 1 || !panel.classList.contains('show')) return;
      if (event.target.closest?.(SHEET_SKIP) || scrolledAbove(event.target, panel)) return;
      const t = event.touches[0];
      touch = { x: t.clientX, y: t.clientY, at: Date.now(), dy: 0, dragging: false };
    },
    { passive: true }
  );
  panel.addEventListener(
    'touchmove',
    event => {
      // Taken by something under the finger (a reorder, a slider): theirs.
      if (!touch || (event.defaultPrevented && !touch.dragging)) return void (touch = null);
      const t = event.touches[0];
      const dy = t.clientY - touch.y;
      const dx = t.clientX - touch.x;
      if (!touch.dragging) {
        // Up, or sideways: the sheet scrolls, the strip slides; not a swipe down.
        if (dy < -4 || Math.abs(dx) > Math.abs(dy) + 4) return void (touch = null);
        if (dy < 8) return;
        touch.dragging = true;
        begin();
      }
      touch.dy = Math.max(0, dy);
      panel.style.transform = translate(touch.dy);
      if (event.cancelable) event.preventDefault();
    },
    { passive: false }
  );
  const touchEnd = () => {
    const t = touch;
    touch = null;
    if (t?.dragging) release(t.dy, Date.now() - t.at);
  };
  panel.addEventListener('touchend', touchEnd);
  panel.addEventListener('touchcancel', touchEnd);

  // A mouse: the handle.
  if (!handle) return;
  let startY = 0;
  let startAt = 0;
  const move = event => {
    panel.style.transform = translate(Math.max(0, event.clientY - startY));
  };
  const finish = event => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish);
    if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    release(Math.max(0, event.clientY - startY), Date.now() - startAt);
  };
  handle.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' || (event.button !== undefined && event.button !== 0)) return;
    event.preventDefault();
    startY = event.clientY;
    startAt = Date.now();
    begin();
    handle.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  });
}
