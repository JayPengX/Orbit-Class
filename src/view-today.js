// ---- src/view-today.js ----
// 今天: the hero (the class now, or the one coming, or a day over, from
// schedule-calc.js heroView), the classes still ahead, 明天要帶 in the
// evening, and the countdowns. dashboard.js's update() asks every second;
// each part is written only when what it shows changed.
import { MS_PER_DAY, WEEKDAY_LABELS } from './constants.js';
import { state } from './state.js';
import { formatCountdownEventDate, getCountdownEvents } from './data.js';
import { dateFromKey, parseTime } from './dates.js';
import { classesLeft } from './schedule-calc.js';
import { classesOn, dateOfDay, getWeekType, processSplitName } from './schedule.js';
import { bringTomorrow } from './bring.js';
import { holidayOn } from './holidays.js';
import { eventLook, stateTile, subjectTile } from './subjects.js';
import { openModal } from './view-sheet.js';
import { el, button, glyph, section } from './ui.js';
import { t } from './strings.js';

// ---- The hero ----
let dom = null;
const $ = id => document.getElementById(id);
function heroDom() {
  if (dom) return dom;
  dom = {};
  for (const id of ['cx-hero', 'cx-kicker', 'cx-span', 'now-name', 'cx-meta', 'now-teacher', 'now-place', 'now-class-label', 'timer-group', 'timer-val', 'timer-label', 'cx-bar', 'cx-fill', 'cx-foot', 'next-label', 'next-name', 'next-time', 'next-sub', 'next-note', 'cx-icon', 'cx-glyph', 'cx-week', 'next-icon']) dom[id] = $(id);
  return dom;
}
// Last-drawn values: the card is asked every second, but only the time left
// and the bar change that often.
const last = {};
function put(key, value, write) {
  if (last[key] === value) return;
  last[key] = value;
  write(value);
}
const GLYPH = { class: 'clock', break: 'bell', before: 'clock', off: 'moon' };

export function renderHero(hero, week = '') {
  const d = heroDom();
  if (!d['cx-hero']) return;
  put('mode', hero.mode, v => (d['cx-hero'].dataset.mode = v));
  put('glyph', hero.mode, v => (d['cx-glyph'].innerHTML = glyph(GLYPH[v] || 'clock')));
  put('week', week, v => {
    d['cx-week'].hidden = !v;
    d['cx-week'].textContent = v ? t(v === '單' ? 'week.odd' : 'week.even') : '';
    d['cx-week'].classList.toggle('label-odd', v === '單');
    d['cx-week'].classList.toggle('label-even', v === '雙');
  });
  put('kicker', hero.kicker, v => (d['cx-kicker'].textContent = v));
  put('span', hero.span, v => (d['cx-span'].textContent = v));
  put('title', hero.title, v => (d['now-name'].textContent = v));
  put('icon', hero.subject ? `s:${hero.subject}` : `m:${hero.mode}`, () => d['cx-icon'].replaceChildren(hero.subject ? subjectTile(hero.subject, 'lg', true) : stateTile(hero.mode, 'lg', true)));
  document.body.dataset.heroClass = hero.subject ? '1' : '';
  put('teacher', hero.teacher, v => (d['now-teacher'].textContent = v));
  put('place', hero.place, v => (d['now-place'].textContent = v));
  put('label', hero.label, v => (d['now-class-label'].innerHTML = v));
  put('hasMeta', Boolean(hero.teacher || hero.place || hero.label), v => (d['cx-meta'].hidden = !v));
  put('hasTimer', Boolean(hero.timer), v => (d['timer-group'].style.display = v ? 'flex' : 'none'));
  if (hero.timer) {
    put('timerLabel', hero.timer.label, v => (d['timer-label'].textContent = v));
    put('timerVal', hero.timer.value, v => (d['timer-val'].textContent = v));
  }
  put('hasBar', hero.progress != null, v => (d['cx-bar'].hidden = !v));
  if (hero.progress != null) put('progress', hero.progress.toFixed(2), v => (d['cx-fill'].style.width = `${v}%`));
  const foot = hero.foot;
  put('foot', foot ? (foot.note ? 'note' : 'class') : 'none', v => {
    d['cx-foot'].hidden = v === 'none';
    d['cx-foot'].dataset.kind = v;
  });
  if (foot?.note) put('note', foot.note, v => (d['next-note'].textContent = v));
  else if (foot) {
    put('nextLabel', foot.label, v => (d['next-label'].textContent = v));
    put('nextName', foot.name, v => (d['next-name'].textContent = v));
    put('nextIcon', foot.subject || '', v => d['next-icon'].replaceChildren(...(v ? [subjectTile(v, 'sm', true)] : [])));
    put('nextTime', foot.time, v => (d['next-time'].textContent = v));
    put('nextSub', foot.sub, v => (d['next-sub'].textContent = v));
  }
}

// ---- A day's classes as rows (今天's list, and 課表's day sheet) ----
// The day's named break that sits wholly between two classes, if any.
function breakBetween(end, start) {
  const from = parseTime(end);
  const to = parseTime(start);
  return (state.applicationData.breakTimes || []).find(b => b.name && b.start && b.end && parseTime(b.start) >= from && parseTime(b.end) <= to && parseTime(b.end) > parseTime(b.start));
}
// One class: its tile, name (a split week's or 調課's label beside it), teacher · room, and its times.
export function classRow(c, week, { date = null, cls = '' } = {}) {
  const info = processSplitName(c, week);
  const name = el('span', 'q-ritem-title row-name', info.n);
  const title = el('span', 'cx-row-title', [name]);
  if (info.label) title.insertAdjacentHTML('beforeend', info.label);
  const sub = [info.t, c.loc].filter(Boolean).join(' · ');
  const words = el('span', 'q-ritem-text', [title, sub ? el('small', '', sub) : null]);
  const time = el('span', 'cx-time', [el('b', '', c.s), el('small', '', c.e)]);
  const node = button(`q-ritem row${cls ? ` ${cls}` : ''}`, () => openModal(c, { date }), [subjectTile(info.n), words, time]);
  return node;
}
// The rows of a day's classes from `from` on, a named break as a thin row between two.
export function dayRows(rows, week, { date = null, from = 0, skip = () => false } = {}) {
  const out = [];
  rows.forEach((c, i) => {
    if (i < from || skip(i)) return;
    out.push(classRow(c, week, { date }));
    const after = rows[i + 1];
    const gap = after && breakBetween(c.e, after.s);
    if (gap) out.push(el('div', 'q-ritem cx-gap', [el('span', '', gap.name), el('span', '', `${gap.start}–${gap.end}`)]));
  });
  while (out[0]?.classList.contains('cx-gap')) out.shift();
  while (out.at(-1)?.classList.contains('cx-gap')) out.pop();
  return out;
}
// A day without classes: why (a holiday by name).
export function emptyDay(holiday) {
  const pic = el('span', 'q-tile soft cx-gray');
  pic.innerHTML = glyph('moon');
  const words = el('span', 'q-ritem-text', [el('span', 'q-ritem-title row-name', t('dashboard.noClassesToday')), el('small', '', holiday ? t('dashboard.holidayTitle', { zh: holiday.zh, en: holiday.en || holiday.zh }) : t('dashboard.restOrStudy'))]);
  return el('div', 'q-ritem row is-empty', [pic, words]);
}

// 今天's list: today's classes still to come (the hero's left out), or once the
// day is over the next school day's, whole.
export function renderTodayList({ week, curIdx, nxtIdx, curDay, isDayFinished, now }) {
  const list = $('schedule-list');
  const sec = $('cx-list-sec');
  if (!list || !sec) return;
  const testing = window.MANUALLY_TEST;
  const date = testing ? null : dateOfDay(state.viewDay, now);
  const holiday = date ? holidayOn(date) : null;
  const rows = date ? classesOn(date) : state.runtimeSchedule[state.viewDay] || [];
  if (date) week = getWeekType(date);
  const isToday = state.viewDay === curDay && (!date || date.toDateString() === now.toDateString());
  const heroHas = document.body.dataset.heroClass === '1';
  const upTo = curIdx >= 0 ? curIdx : nxtIdx >= 0 ? nxtIdx : isDayFinished ? rows.length : 0;
  const inHero = i => heroHas && (i === curIdx || (i === nxtIdx && curIdx < 0));
  const items = isToday ? dayRows(rows, week, { date, from: upTo, skip: inHero }) : dayRows(rows, week, { date });
  if (!rows.length) items.push(emptyDay(holiday));
  const title = $('cx-list-title');
  if (title) {
    const ahead1 = (state.viewDay - curDay + 7) % 7 === 1;
    const left = isToday && !testing ? classesLeft(rows, now) : 0;
    title.textContent = isToday ? (heroHas && items.length ? t('dashboard.upNext') : left ? t('dashboard.todayClassesLeft', { n: left }) : t('dashboard.todayClasses')) : t('dashboard.dayClasses', { day: ahead1 ? t('dashboard.tomorrow') : WEEKDAY_LABELS[state.viewDay] });
  }
  sec.hidden = !items.length;
  list.replaceChildren(...(items.length ? [el('div', 'q-rowcard cx-day', items)] : []));
}

// ---- 明天要帶: the evening before, one row per thing ----
let bringDrawn = null;
export function renderBring(now = new Date()) {
  const box = $('cx-bring');
  if (!box) return;
  const plan = bringTomorrow(now);
  const key = plan ? `${t('bring.title')}|${plan.day}|${JSON.stringify(plan.items)}` : '';
  if (key === bringDrawn) return;
  bringDrawn = key;
  box.hidden = !plan;
  if (!plan) return box.replaceChildren();
  const rows = plan.items.map(({ item, subject }) => el('div', 'q-ritem', [subjectTile(subject), el('span', 'q-ritem-text', [el('span', 'q-ritem-title', t(`bring.${item}`)), el('small', '', subject)])]));
  box.replaceChildren(...section(t('bring.title', { day: plan.day }), el('div', 'q-rowcard', rows)).childNodes);
}

// ---- 倒數: a rail of cards, each its days to go in large type ----
function countdownState(event, today) {
  const start = Math.round((dateFromKey(event.startDate) - today) / MS_PER_DAY);
  const end = Math.round((dateFromKey(event.endDate) - today) / MS_PER_DAY);
  if (start > 0) return { kind: 'ahead', days: start };
  if (start === 0) return { kind: 'today' };
  if (end >= 0) return { kind: 'on' };
  return { kind: 'over' };
}
const editCountdowns = () => {
  window.openEditor?.();
  window.openEditorFold?.('editor-fold-countdown');
};
let countdownsDrawn = '';
export function renderCountdowns(now = new Date()) {
  const box = $('cx-countdowns');
  if (!box) return;
  const events = getCountdownEvents();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const key = `${today.getTime()}|${t('dashboard.countdowns')}|${JSON.stringify(events)}`;
  if (key === countdownsDrawn) return;
  countdownsDrawn = key;
  const cards = events.map(event => {
    const st = countdownState(event, today);
    const pic = el('span', `q-tile sm${st.kind === 'over' ? ' soft cx-gray' : ''}`);
    pic.innerHTML = eventLook(event.name);
    const big = st.kind === 'ahead' ? el('span', 'cx-cd-big', [el('b', '', String(st.days)), el('small', '', t('dashboard.countdownDayUnit'))]) : el('span', `cx-cd-big is-${st.kind}`, [el('em', '', t(`dashboard.${{ today: 'countdownToday', on: 'countdownInProgress', over: 'countdownEnded' }[st.kind]}`))]);
    const card = button(`q-rail-card cx-cd is-${st.kind}`, editCountdowns, [el('span', 'cx-cd-top', [pic, el('small', '', formatCountdownEventDate(event, { withYear: dateFromKey(event.startDate) - today > 330 * MS_PER_DAY }))]), el('strong', 'cx-cd-name', event.name), big]);
    if (st.kind === 'ahead') card.setAttribute('aria-label', t('dashboard.countdownAriaDays', { name: event.name, days: st.days }));
    return card;
  });
  // None yet: one card that adds the first.
  const body = cards.length ? el('div', 'q-rail cx-cds', cards) : el('div', 'q-rowcard', [button('q-ritem chevron', editCountdowns, [el('span', 'q-tile', null), el('span', 'q-ritem-text', [el('span', 'q-ritem-title', t('dashboard.addCountdown'))])])]);
  if (!cards.length) body.querySelector('.q-tile').innerHTML = glyph('plus');
  box.replaceChildren(...section(t('dashboard.countdowns'), body, { more: cards.length ? t('common.edit') : '', onMore: editCountdowns }).childNodes);
}
