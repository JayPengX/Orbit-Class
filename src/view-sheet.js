// ---- src/view-sheet.js ----
// The sheet from the foot (#sheet in index.html) for one class or one day.
// A class: its picture, name, teacher · room; its figures (a week's
// periods, when it meets next); its two halves when it splits by week;
// its week as five day cells; 調課 for the date it was opened on. A day
// (from 課表's grid): its classes in order, as on 今天.
import { WEEKDAY_LABELS } from './constants.js';
import { state } from './state.js';
import { dateFromKey, dateKey, parseTime } from './dates.js';
import { classesOn, getWeekType, processSplitName } from './schedule.js';
import { holidayOn } from './holidays.js';
import * as kitUI from '#kit/ui.mjs';
import { openSwapSheet, slotText, swapOf, undoSwap } from './swap.js';
import { subjectTile } from './subjects.js';
import { dayRows, emptyDay } from './view-today.js';
import { el, button, tile } from './ui.js';
import { t } from './strings.js';

let previousFocus = null;

// The class's or the day's sheet is the kit's: its tile before the title, the teacher and room under it.
let shown = null;
function show(lead, title, sub, body) {
  if (shown?.el.isConnected) shown.el.remove();
  else previousFocus = document.activeElement;
  const box = el('div', 'cx-sheet-body', body);
  box.id = 'm-body';
  shown = kitUI.sheet({
    title,
    lead,
    body: [sub ? el('p', 'cx-sheet-sub', sub) : null, box],
    cls: 'cx-kit-sheet',
    closeLabel: t('common.close'),
    onClose: () => {
      previousFocus?.focus?.();
      previousFocus = null;
      shown = null;
    }
  });
}
export function closeModal() {
  shown?.close();
}

const fig = (label, value, id = '') => {
  const strong = el('strong', '', value);
  if (id) strong.id = id;
  return el('div', 'q-stat', [el('small', '', label), strong]);
};

// `shown`: a class as a day lists it; `date`: the day it was opened on, for
// 調課. A swapped class is shown as the timetable's class it came from, in
// that day's week.
export function openModal(shown, { date = null } = {}) {
  const c = shown.from || shown;
  const week = getWeekType(shown.swap ? dateFromKey(shown.swap.date) : date || new Date());
  const info = processSplitName(c, week);
  const terms = c.isSplit ? c.n.split('/').map(x => x.trim()) : [c.n];
  const teachers = c.isSplit ? c.t.split('/').map(x => x.trim()) : [c.t];
  // Its week: each day the periods it meets (by their own numbers) and when.
  const days = {};
  let count = 0;
  for (const d of [1, 2, 3, 4, 5])
    for (const item of state.runtimeSchedule[d] || []) {
      if (c.isSplit ? !terms.some(x => item.n.includes(x)) : item.n !== c.n) continue;
      count += 1;
      (days[d] ||= []).push({ n: item.p + 1, s: item.s });
    }
  const body = [];
  if (c.isSplit) {
    const i = week === '單' ? 0 : 1;
    const half = (j, label) => el('div', `cx-half${j === i ? ' is-this' : ''}`, [el('small', '', label), el('strong', '', terms[j] || ''), el('span', '', teachers[j] || teachers[0] || '')]);
    body.push(el('div', 'cx-halves', [half(0, t('week.odd')), half(1, t('week.even'))]));
  }
  const next = nextMeeting(info.n);
  const stats = el('div', 'q-stats cx-figs', [fig(t('dashboard.periodsPerWeekLabel'), String(count), 'm-count'), next ? fig(`${t('dashboard.nextClassLabel')} · ${next.day}`, next.time, 'm-next') : null].filter(Boolean));
  stats.style.setProperty('--q-stats-n', String(stats.childElementCount));
  body.push(stats);
  const occ = el(
    'div',
    'cx-occ',
    [1, 2, 3, 4, 5].map(d => {
      const on = days[d];
      const periods = on ? (on.length === 1 ? t('dashboard.occPeriod', { number: on[0].n }) : t('dashboard.occPeriods', { list: on.map(x => x.n).join(t('dashboard.occJoin')) })) : '—';
      return el('div', `occ-day${on ? '' : ' is-off'}`, [el('span', 'occ-day-name', WEEKDAY_LABELS[d]), el('b', 'occ-day-period', periods), el('span', 'occ-day-time', on ? on[0].s : '')]);
    })
  );
  occ.id = 'm-occ-list';
  body.push(el('h3', 'cx-sheet-h', t('dashboard.occurrencesLabel')), occ);
  const swap = swapPart(shown, date);
  if (swap) body.push(swap);
  show(subjectTile(info.n, 'lg'), info.n, [info.t, c.loc].filter(Boolean).join(' · '), body);
}

// When the subject meets next (調課 and holidays applied): { day: 今天 /
// 明天 / 週四 / a date two weeks out at most, time: its start }.
function nextMeeting(name, now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  for (let ahead = 0; ahead < 14; ahead++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
    const week = getWeekType(date);
    const hit = classesOn(date).find(x => processSplitName(x, week).n === name && (ahead > 0 || parseTime(x.s) > mins));
    if (!hit) continue;
    const day = ahead === 0 ? t('dashboard.today') : ahead === 1 ? t('dashboard.tomorrow') : ahead < 7 ? WEEKDAY_LABELS[date.getDay()] : `${date.getMonth() + 1}/${date.getDate()}`;
    return { day, time: hit.s };
  }
  return null;
}

// 調課: a class on a date can be swapped once with another period (any
// day); a swapped one says with which, and can be put back.
function swapPart(c, date) {
  const here = date && Number.isInteger(c.p) ? { date: dateKey(date), p: c.p } : null;
  if (!here) return null;
  const swap = swapOf(here);
  const other = swap && (swap.a.date === here.date && swap.a.p === here.p ? swap.b : swap.a);
  const btn = button(`q-btn large block ${swap ? 'danger tinted' : 'tinted'}`, async () => {
    if (swap) {
      if (await undoSwap(swap)) closeModal();
      return;
    }
    closeModal();
    openSwapSheet(here);
  }, swap ? t('swap.undo') : t('swap.button'));
  btn.id = 'm-swap-btn';
  return el('div', 'cx-swap-part', [swap ? el('p', 'cx-foot-line', t('swap.with', { slot: slotText(other) })) : null, btn]);
}

// A day from 課表: its classes in order (調課 and its week applied), or why it has none.
export function openDaySheet(date) {
  const week = getWeekType(date);
  const holiday = holidayOn(date);
  const rows = classesOn(date);
  const items = rows.length ? dayRows(rows, week, { date }) : [emptyDay(holiday)];
  const title = `${WEEKDAY_LABELS[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`;
  const sub = [week === '單' ? t('week.odd') : t('week.even'), rows.length ? t('dashboard.periodCount', { count: rows.length }) : ''].filter(Boolean).join(' · ');
  show(tile('calendar', 'var(--q-accent)', 'lg'), title, sub, [el('div', 'q-rowcard cx-day', items)]);
}

window.closeModal = closeModal;
