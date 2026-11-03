// ---- src/view-week.js ----
// 課表: the week as one grid, this school week or the next (單週 / 雙週,
// each by its Monday's date). Each column a date (調課 and holidays applied,
// that date's half of a split class), each row a period by its own number
// and start time; the class on now filled, today's done ones faded. A tap on a class opens it for
// that date (and its 調課), a tap on a day 今天's list on that day. Then 調課:
// the swaps still to come, a tap to undo one, and 新增調課.
import * as kit from '#kit/orbit.mjs';
import * as kitUI from '#kit/ui.mjs';
import { WEEKDAY_LABELS } from './constants.js';
import { state } from './state.js';
import { breakLabel, swapsNotOver } from './data.js';
import { dateKey, parseTime } from './dates.js';
import { classesOn, getWeekType, processSplitName } from './schedule.js';
import { holidayOn } from './holidays.js';
import { showOnboardingPrompt } from './onboarding.js';
import { shortNames, subjectLook } from './subjects.js';

export { shortNames };
import { nameAt, openSwapSheet, slotText, undoSwap } from './swap.js';
import { openModal } from './view-sheet.js';
import { el, button, fitText, row, section, tile } from './ui.js';
import { t } from './strings.js';

const $ = id => document.getElementById(id);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const hasSaturday = () => (state.runtimeSchedule?.[6] || []).length > 0;
// The school week shown first: this one, or from the weekend on the next.
function firstMonday(now) {
  const day = now.getDay();
  const monday = addDays(now, 1 - (day || 7));
  return day === 0 || (day === 6 && !hasSaturday()) ? addDays(monday, 7) : monday;
}
// The two weeks the switch offers, and the one chosen (state.viewWeek: its 單 / 雙).
function weeks(now) {
  const a = firstMonday(now);
  const both = [a, addDays(a, 7)].map(monday => ({ monday, week: getWeekType(monday) }));
  return { both, shown: both.find(w => w.week === state.viewWeek) || both[0] };
}

let switchKey = '';
let seg = null;
function drawSwitch(both, shown) {
  const box = $('cx-week-switch');
  if (!box) return;
  const items = both.map(w => ({ id: w.week, label: weekName(w) }));
  const key = JSON.stringify(items);
  if (key !== switchKey || !box.childElementCount) {
    switchKey = key;
    seg = kitUI.segmented(items, {
      value: shown.week,
      label: t('dashboard.weekSwitchLabel'),
      onChange: w => {
        state.viewWeek = w;
        state.lastListKey = '';
        window.update?.();
      }
    });
    box.replaceChildren(seg);
  } else seg?.set(shown.week);
}

function drawGrid(monday, now) {
  const testing = window.MANUALLY_TEST;
  const days = [1, 2, 3, 4, 5, ...(hasSaturday() ? [6] : [])];
  const cols = days.map(d => {
    const date = addDays(monday, d - 1);
    // (Test Mode walks the timetable by weekday, not dates.)
    const rows = testing ? state.runtimeSchedule[d] || [] : classesOn(date);
    return { d, date, rows, week: getWeekType(date), holiday: testing ? null : holidayOn(date) };
  });
  const today = testing ? addDays(monday, ((window.TEST_DAY ?? 1) + 6) % 7) : now;
  const nowMin = testing ? Math.floor((window.TEST_TIME_SEC || 0) / 60) : now.getHours() * 60 + now.getMinutes();
  const bells = state.applicationData.bellTimes || [];
  // A row per period (a day's list leaves its free periods out: its place in the list isn't its period).
  const periods = Math.max(0, ...cols.flatMap(c => c.rows.map(x => x.p + 1)), ...days.map(d => (state.runtimeSchedule[d] || []).reduce((m, x) => Math.max(m, x.p + 1), 0)));
  const short = shortNames(cols.flatMap(c => c.rows.map(x => processSplitName(x, c.week).n || '')));
  const grid = el('div', 'cx-tl-grid');
  grid.style.setProperty('--days', String(days.length));
  grid.append(el('span', 'cx-tl-corner'));
  for (const c of cols) {
    const isToday = dateKey(c.date) === dateKey(today);
    const head = button(`cx-tl-day${isToday ? ' is-today' : ''}${c.holiday ? ' is-off' : ''}`, () => window.showDay?.(c.date), [el('small', '', t(`tools.day${c.d}`)), el('b', '', String(c.date.getDate()))]);
    head.setAttribute('aria-label', `${WEEKDAY_LABELS[c.d]} ${c.date.getMonth() + 1}/${c.date.getDate()}`);
    grid.append(head);
  }
  for (let p = 0; p < periods; p += 1) {
    grid.append(el('span', 'cx-tl-row', [el('b', 'cx-tl-num', String(p + 1)), el('small', '', bells[p]?.[0] || '')]));
    for (const c of cols) {
      const item = c.rows.find(x => x.p === p);
      if (!item) {
        grid.append(el('span', `cx-tl-cell is-empty${c.holiday ? ' is-off' : ''}`));
        continue;
      }
      const name = processSplitName(item, c.week).n || '';
      const label = short.get(name) || name;
      const isToday = dateKey(c.date) === dateKey(today);
      const on = isToday && nowMin >= parseTime(item.s) && nowMin < parseTime(item.e);
      const past = isToday && nowMin >= parseTime(item.e);
      // Four characters (自主學習) on two lines of two, so a narrow column keeps them whole.
      const chars = [...label];
      const isLatin = /^[ -~]+$/.test(label);
      const pair = chars.length === 4 && !isLatin;
      const cell = button(`cx-tl-cell${on ? ' is-now' : ''}${past ? ' is-past' : ''}${item.swap ? ' is-swap' : ''}${pair ? ' is-pair' : isLatin && chars.length > 3 ? ' is-latin' : chars.length > 2 ? ' is-long' : ''}`, () => openModal(item, { date: testing ? null : c.date }), pair ? [el('span', '', chars.slice(0, 2).join('')), el('span', '', chars.slice(2).join(''))] : label);
      cell.style.setProperty('--subject', subjectLook(name).color);
      cell.setAttribute('aria-label', `${WEEKDAY_LABELS[c.d]} ${t('dashboard.periodNumber', { number: p + 1 })} ${name}`);
      grid.append(cell);
    }
    // A long break after this period (lunch): a quiet line across the week, named when the timetable names it.
    const gap = bellGap(bells, p);
    if (gap) grid.append(el('span', 'cx-tl-gap', gap.name ? [el('small', '', `${gap.start} ${gap.name}`)] : null));
  }
  // A holiday's column says which.
  const offs = cols.filter(c => c.holiday);
  const foot = offs.length ? el('div', 'cx-tl-offs', offs.map(c => el('span', 'q-tag red', `${t(`tools.day${c.d}`)} ${t('dashboard.holidayTitle', { zh: c.holiday.zh, en: c.holiday.en || c.holiday.zh })}`))) : null;
  if (!periods) return null;
  // A long Latin name wraps by word; what still won't fit shrinks.
  requestAnimationFrame(() => fitText(grid.querySelectorAll('.cx-tl-cell.is-latin')));
  return [grid, foot].filter(Boolean);
}
// The break of 30 minutes or more between period p and the next, by the bells (and its name from 特殊時段).
function bellGap(bells, p) {
  const end = bells[p]?.[1];
  const next = bells[p + 1]?.[0];
  if (!end || !next || parseTime(next) - parseTime(end) < 30) return null;
  const named = (state.applicationData.breakTimes || []).find(b => b.name && b.start && parseTime(b.start) >= parseTime(end) && parseTime(b.start) < parseTime(next));
  return { start: named?.start || end, name: named ? breakLabel(named.name) : '' };
}
const weekName = ({ monday, week }) => `${week === '單' ? t('week.odd') : t('week.even')} ${monday.getMonth() + 1}/${monday.getDate()}`;
const noTimetable = () => kitUI.empty({ icon: 'calendar', title: t('dashboard.noTimetable'), body: t('dashboard.noTimetableBody'), action: { label: t('dashboard.addTimetable'), onTap: () => showOnboardingPrompt({ force: true }) } });

// 調課's section: the swaps still to come, then 新增調課.
let swapsDrawn = '';
function drawSwaps() {
  const box = $('cx-swaps');
  if (!box) return;
  const coming = swapsNotOver(state.applicationData.classSwaps || [], dateKey(new Date()));
  const key = `${JSON.stringify(coming)}|${t('swap.section')}`;
  if (key === swapsDrawn && box.childElementCount) return;
  swapsDrawn = key;
  const swapTile = () => tile('swap', 'var(--q-orange)');
  const rows = coming.map(swap => {
    const sides = el('span', 'q-ritem-text cx-swap-sides', [swap.a, swap.b].map(side => el('span', 'cx-swap-side', [el('b', '', nameAt(side)), el('small', '', slotText(side))])));
    return button('q-ritem cx-swap', () => undoSwap(swap), [swapTile(), sides]);
  });
  rows.push(row({ cls: 'cx-way is-swap', icon: swapTile(), title: t('swap.add'), onClick: () => openSwapSheet() }));
  box.replaceChildren(...section(t('swap.section'), el('div', 'q-rowcard', rows)).childNodes);
}

export function renderWeek(now = new Date()) {
  const { both, shown } = weeks(now);
  const box = $('cx-grid');
  // A wide screen has room for both weeks side by side, each under its name: no switch.
  const both2 = Boolean(kit.screenFit?.().wide);
  $('cx-week-switch').hidden = both2;
  if (!both2) drawSwitch(both, shown);
  if (box) {
    box.classList.toggle('is-both', both2);
    const grids = (both2 ? both : [shown]).map(w => ({ w, parts: drawGrid(w.monday, now) }));
    if (grids.every(g => !g.parts)) box.replaceChildren(noTimetable());
    else if (!both2) box.replaceChildren(...grids[0].parts);
    else box.replaceChildren(...grids.map(({ w, parts }) => el('section', 'cx-week-one', [el('h3', 'q-list-head', weekName(w)), el('div', 'cx-grid-card', parts || [])])));
  }
  drawSwaps();
}
