// ---- src/swap.js ----
// 調課: a one-time swap of two periods, on the same day or any two days
// (across weeks too). Each side is a date and a period; the swap is kept
// with the timetable (data.js classSwaps, on the pass like the rest) and
// applied by schedule.js classesOnDate wherever a date's classes are read
// (今天, 課表, the card, the notices). Made from a class's sheet (調課) or
// 課表's 新增調課, in one sheet: the period, then the one it swaps with;
// undone from the class's sheet or 課表's list (renderSwaps). Swaps whose days are over
// leave the list at the next change.
import * as kit from '#kit/quadra.mjs';
import { WEEKDAY_LABELS } from './constants.js';
import { normalizeClassSwaps, saveData, swapsNotOver } from './data.js';
import { holidayOn } from './holidays.js';
import { dateFromKey, dateKey, getWeekType, processSplitName, slotClass } from './schedule.js';
import { state } from './state.js';
import { isSyncViewer, pushSyncSnapshot } from './sync.js';
import { setOverlayVisible } from './dashboard.js';
import { bindSheetDragToDismiss } from './sheet-drag.js';
import { t } from './strings.js';

const todayKey = () => dateKey(new Date());
const slotKey = s => `${s.date}#${s.p}`;
const swaps = () => state.applicationData.classSwaps || [];

// "10/29 週四 第 5 節"
function slotText({ date, p }) {
  const d = dateFromKey(date);
  return t('swap.slot', { date: `${d.getMonth() + 1}/${d.getDate()}`, day: WEEKDAY_LABELS[d.getDay()], n: p + 1 });
}
// The timetable's class at a side (its odd/even half that week), or null.
function classAt({ date, p }) {
  const d = dateFromKey(date);
  const c = slotClass(d.getDay(), p);
  return c ? processSplitName(c, getWeekType(d)) : null;
}
const nameAt = slot => classAt(slot)?.n || t('swap.free');
// The swap a side is in, if any.
function swapOf(slot) {
  const key = slotKey(slot);
  return swaps().find(s => slotKey(s.a) === key || slotKey(s.b) === key) || null;
}

function store(next) {
  state.applicationData.classSwaps = normalizeClassSwaps(swapsNotOver(next, todayKey()));
  saveData(state.applicationData);
  pushSyncSnapshot();
  state.lastListKey = '';
  window.update?.();
}
function toast(text) {
  const el = document.getElementById('save-toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}
// The two sides as the dialog's two lines: each class, and when it is.
const sides = (a, b) => [
  ['↑', nameAt(a), slotText(a)],
  ['↓', nameAt(b), slotText(b)]
];
const confirm = opts => (typeof kit.ask === 'function' ? kit.ask(opts) : Promise.resolve(true));

function addSwap(a, b) {
  if (swapOf(a) || swapOf(b) || slotKey(a) === slotKey(b)) return false;
  if (!classAt(a) && !classAt(b)) return false;
  store([...swaps(), { a, b }]);
  return true;
}
async function undoSwap(swap) {
  const ok = await confirm({
    title: t('swap.undoTitle'),
    points: sides(swap.a, swap.b),
    ok: t('swap.undo'),
    cancel: t('common.cancel'),
    danger: true
  });
  if (!ok) return false;
  store(swaps().filter(s => s !== swap));
  toast(t('swap.undone'));
  return true;
}

// ---- The sheet ----
let first = null; // the side picked first: { date, p }
let shownDate = '';

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

// The sheet's own controls, wired the first time it opens.
let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  document.getElementById('swap-date')?.addEventListener('change', event => {
    const value = event.target.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    shownDate = value < todayKey() ? todayKey() : value;
    drawSheet();
  });
  document.getElementById('swap-first')?.addEventListener('click', () => {
    first = null;
    drawSheet();
  });
  bindSheetDragToDismiss('swap-sheet', closeSwapSheet);
}

function openSwapSheet(from = null) {
  if (isSyncViewer()) return;
  wire();
  first = from;
  shownDate = from?.date || todayKey();
  drawSheet();
  setOverlayVisible('swap-overlay', 'swap-sheet', true, 'modal-open');
}
function closeSwapSheet() {
  setOverlayVisible('swap-overlay', 'swap-sheet', false, 'modal-open');
  first = null;
}

function drawSheet() {
  const sub = document.getElementById('swap-sub');
  const input = document.getElementById('swap-date');
  const box = document.getElementById('swap-periods');
  const chosen = document.getElementById('swap-first');
  if (!sub || !input || !box) return;
  sub.textContent = first ? t('swap.pickSecond') : t('swap.pickFirst');
  input.min = todayKey();
  input.value = shownDate;
  // The period picked first, a tap away from picking again.
  if (chosen) {
    chosen.hidden = !first;
    chosen.replaceChildren();
    if (first) {
      const words = el('span', 'swap-first-words');
      words.append(el('small', '', slotText(first)), el('strong', '', nameAt(first)));
      chosen.append(words, el('span', 'swap-first-change', t('swap.change')));
    }
  }
  box.replaceChildren();
  const date = dateFromKey(shownDate);
  if (holidayOn(date)) {
    box.append(el('p', 'swap-note', t('swap.holiday')));
    return;
  }
  const week = getWeekType(date);
  const bells = state.applicationData.bellTimes || [];
  bells.forEach(([start], p) => {
    const slot = { date: shownDate, p };
    const c = slotClass(date.getDay(), p);
    const info = c ? processSplitName(c, week) : null;
    const isFirst = first && slotKey(first) === slotKey(slot);
    const taken = swapOf(slot);
    // Two free periods swapped is nothing.
    const pointless = first && !info && !classAt(first);
    const row = el('button', `swap-slot${info ? '' : ' is-free'}`);
    row.type = 'button';
    row.disabled = Boolean(isFirst || taken || pointless);
    const when = el('span', 'swap-slot-when');
    when.append(el('b', '', t('dashboard.periodNumber', { number: p + 1 })), el('span', '', start));
    const words = el('span', 'swap-slot-words');
    words.append(el('strong', '', info ? info.n : t('swap.free')));
    const note = isFirst ? t('swap.thisOne') : taken ? t('swap.taken') : info?.t || '';
    if (note) words.append(el('small', '', note));
    row.append(when, words);
    row.addEventListener('click', () => pick(slot));
    box.append(row);
  });
}

async function pick(slot) {
  if (!first) {
    first = slot;
    drawSheet();
    return;
  }
  const a = first;
  const ok = await confirm({
    title: t('swap.title'),
    points: sides(a, slot),
    ok: t('swap.button'),
    cancel: t('common.cancel')
  });
  if (!ok) return;
  if (addSwap(a, slot)) {
    closeSwapSheet();
    toast(t('swap.done'));
  }
}

// ---- 課表's 調課: each swap still to come (both sides, a tap to undo it),
// then 新增調課. Drawn again only when the swaps or the viewer change.
const SWAP_ICON = '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>';
function swapIcon() {
  const box = el('span', 'cx-way-icon');
  box.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SWAP_ICON}</svg>`;
  return box;
}
let swapsDrawn = '';
function renderSwaps() {
  const page = document.getElementById('cx-swaps');
  if (!page) return;
  const viewer = isSyncViewer();
  const coming = swapsNotOver(swaps(), todayKey());
  const key = `${JSON.stringify(coming)}|${viewer}|${t('swap.section')}`;
  if (key === swapsDrawn && page.childElementCount) return;
  swapsDrawn = key;
  const box = el('div', 'cx-ways cx-swaps');
  for (const swap of coming) {
    const words = el('span', 'cx-swap-sides');
    for (const side of [swap.a, swap.b]) {
      const line = el('span', 'cx-swap-side');
      line.append(el('small', '', slotText(side)), el('strong', '', nameAt(side)));
      words.append(line);
    }
    const row = el('button', 'cx-way cx-swap');
    row.type = 'button';
    row.append(swapIcon(), words);
    row.addEventListener('click', () => undoSwap(swap));
    row.disabled = viewer;
    box.append(row);
  }
  const words = el('span', 'cx-way-words');
  words.append(el('strong', '', t('swap.add')), el('small', '', t('swap.addSub')));
  const add = el('button', 'cx-way is-swap');
  add.type = 'button';
  add.append(swapIcon(), words, el('span', 'cx-way-go', '›'));
  add.addEventListener('click', () => openSwapSheet());
  add.disabled = viewer;
  box.append(add);
  page.replaceChildren(el('h2', 'cx-section', t('swap.section')), box);
}

window.closeSwapSheet = closeSwapSheet;

export { addSwap, closeSwapSheet, nameAt, openSwapSheet, renderSwaps, slotText, swapOf, undoSwap };
