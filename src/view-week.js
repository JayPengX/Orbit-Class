// ---- src/view-week.js ----
// 課表: the week as one grid, this school week or the next (單週 / 雙週,
// each by its Monday's date). Each column a date (調課 and holidays applied,
// that date's half of a split class), each row a period by its own number
// and start time; the class on now filled, today's done ones faded. A tap on a class opens it for
// that date (and its 調課), a tap on a day its classes in order. Then 調課:
// the swaps still to come, a tap to undo one, and 新增調課.
import * as kitUI from '#kit/ui.mjs';
import { WEEKDAY_LABELS } from './constants.js';
import { state } from './state.js';
import { swapsNotOver } from './data.js';
import { dateKey, parseTime } from './dates.js';
import { classesOn, getWeekType, processSplitName } from './schedule.js';
import { holidayOn } from './holidays.js';
import { showOnboardingPrompt } from './onboarding.js';
import { subjectLook } from './subjects.js';
import { nameAt, openSwapSheet, slotText, undoSwap } from './swap.js';
import { openDaySheet, openModal } from './view-sheet.js';
import { el, button, fitText, row, section, tile } from './ui.js';
import { t } from './strings.js';

const $ = id => document.getElementById(id);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// The grid's short names, one per subject and never two alike: a name of up
// to four characters whole (自主學習), a longer one by its first two
// (民主政治與法律 → 民主), and where two would read the same, its first
// character and the first one that tells it apart (社會經濟補給站 beside
// 社會 → 社經; 英文閱讀 and 英文寫作 → 英閱, 英寫). A name in Latin letters
// whole: its cell wraps it by word and shrinks it to fit (never cut).
const FULL = 4;
export function shortNames(names) {
  const list = [...new Set(names.filter(Boolean))];
  const chars = name => [...name];
  const latin = name => /^[ -~]+$/.test(name);
  const base = name => (latin(name) ? name : chars(name).length <= FULL ? name : chars(name).slice(0, 2).join(''));
  const first = new Map(list.map(name => [name, base(name)]));
  const out = new Map(first);
  for (const name of list) {
    if (chars(name).length <= FULL || latin(name)) continue;
    const rivals = list.filter(other => other !== name && first.get(other) === first.get(name));
    if (!rivals.length) continue;
    const mine = chars(name);
    const at = mine.findIndex((ch, i) => i > 0 && rivals.every(other => chars(other)[i] !== ch));
    if (at > 0) out.set(name, mine[0] + mine[at]);
  }
  return out;
}

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
  const items = both.map(({ monday, week }) => ({ id: week, label: `${week === '單' ? t('week.odd') : t('week.even')} ${monday.getMonth() + 1}/${monday.getDate()}` }));
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
  const box = $('cx-grid');
  if (!box) return;
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
    const head = button(`cx-tl-day${isToday ? ' is-today' : ''}${c.holiday ? ' is-off' : ''}`, () => openDaySheet(c.date), [el('small', '', t(`tools.day${c.d}`)), el('b', '', String(c.date.getDate()))]);
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
  }
  // A holiday's column says which.
  const offs = cols.filter(c => c.holiday);
  const foot = offs.length ? el('div', 'cx-tl-offs', offs.map(c => el('span', 'q-tag red', `${t(`tools.day${c.d}`)} ${c.holiday.zh}`))) : null;
  box.replaceChildren(...[periods ? grid : kitUI.empty({ icon: 'calendar', title: t('dashboard.noTimetable'), body: t('dashboard.noTimetableBody'), action: { label: t('dashboard.addTimetable'), onTap: () => showOnboardingPrompt({ force: true }) } }), foot].filter(Boolean));
  // A long Latin name wraps by word; what still won't fit shrinks.
  requestAnimationFrame(() => fitText(grid.querySelectorAll('.cx-tl-cell.is-latin')));
}

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
  drawSwitch(both, shown);
  drawGrid(shown.monday, now);
  drawSwaps();
}
