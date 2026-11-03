// ---- src/view-today.js ----
// 今天: the card (the class now, or the one coming, or a day over, from
// schedule-calc.js heroView, with the day as one line of dots), the classes
// after it, and the countdowns. dashboard.js's update() asks every second;
// each part is written only when what it shows changed.
import * as kitUI from '#kit/ui.mjs';
import { MS_PER_DAY, WEEKDAY_LABELS } from './constants.js';
import { state } from './state.js';
import { breakLabel, eventName, formatCountdownEventDate, getCountdownEvents } from './data.js';
import { dateFromKey, dateKey, parseTime } from './dates.js';
import { classesOn, dateOfDay, getWeekType, processSplitName } from './schedule.js';
import { showOnboardingPrompt } from './onboarding.js';
import { holidayOn } from './holidays.js';
import { breakIcon, eventLook, shortNames, subjectIcon, subjectLook } from './subjects.js';
import { openModal } from './view-sheet.js';
import { el, button, glyph, nameSize, section } from './ui.js';
import { getLocale, t } from './strings.js';

// ---- The card ----
// Orbit's own look (docs/DESIGN.md §11): the card is the kit's graphite and
// leads with the class: the one on now (minutes left) or the next (minutes
// to it), its room; the day's periods as one line with now lit; when school's
// out and the next school day's first class. The class is a band in its
// subject's colour (colour is what it names), the line's dots each their
// subject's, the period now ringed in the app's colour (the one thing live).
const $ = id => document.getElementById(id);
const L = (zh, en) => (getLocale() === 'en' ? en : zh);
const plain = html => String(html || '').replace(/<[^>]*>/g, '').trim();
const withId = (node, id) => ((node.id = id), node);

// "39:54" or "1:02:03" → whole minutes, rounded up (a class 39:54 from its end is 40 minutes).
export function minutesOf(value) {
  const parts = String(value || '')
    .split(':')
    .map(Number);
  if (!value || parts.some(n => !Number.isFinite(n))) return null;
  return Math.ceil(parts.reduce((s, n) => s * 60 + n, 0) / 60);
}
// The big figure: 40 分鐘後下課 / 1 小時 5 分後上課 (the numbers large, the words small after them).
function bigMinutes(mins, label) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const unit = s => el('small', 'nv-unit', s);
  const tail = getLocale() === 'en' ? ` ${label}` : label;
  const parts = h ? [el('b', '', String(h)), unit(L('小時', 'h')), m ? el('b', '', String(m)) : null, unit(m ? L('分', 'm') + tail : tail)] : [el('b', '', String(m)), unit(L('分鐘', 'min') + tail)];
  return withId(el('div', 'nv-big', parts), 'timer-val');
}

// The class as a band in its subject's colour (the kit's .q-band): its glyph,
// its name, the teacher (and 單週 / 調課); the room large on the right.
function band(name, teacher, room) {
  const pic = el('span', 'q-band-mark');
  pic.innerHTML = subjectIcon(name);
  const node = el('div', 'q-band nv-band', [pic, el('span', 'q-band-text', [withId(el('b', '', name), 'now-name'), teacher ? withId(el('small', '', teacher), 'now-teacher') : null]), room ? withId(el('span', 'q-band-end', room), 'now-place') : null]);
  node.style.setProperty('--band', subjectLook(name).color);
  return node;
}

// The day as one line: a dot per period in its subject's colour (done faded,
// now ringed, the rest to come), its short name under it; a long break
// (lunch) a longer, dashed gap. Each dot opens its own class.
function dayLine(rows, week, now, curIdx, date) {
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const names = rows.map(c => processSplitName(c, week).n);
  const short = shortNames(names, 2);
  const stops = [];
  rows.forEach((c, i) => {
    if (i) {
      const gap = parseTime(c.s) - parseTime(rows[i - 1].e);
      stops.push(el('i', `nv-seg${gap >= 30 ? ' is-long' : ''}${parseTime(c.s) * 60 <= secs ? ' is-done' : ''}`));
    }
    const st = parseTime(c.e) * 60 <= secs ? 'done' : i === curIdx ? 'now' : 'ahead';
    const dot = button(`nv-stop is-${st}`, e => (e.stopPropagation(), openModal(c, { date })), [el('i', 'nv-dot'), el('small', '', short.get(names[i]) || '·')]);
    dot.setAttribute('aria-label', `${c.s} ${names[i]}`);
    dot.style.setProperty('--subject', subjectLook(names[i]).color);
    stops.push(dot);
  });
  return el('div', 'nv-line', stops);
}

let drawn = '';
// dashboard.js asks every second; drawn again only when what it shows changed
// (the minute, the period, the day's line).
export function renderHero(hero, { today = [], week = '', nextDay = null, now = new Date(), curIdx = -1, date = null } = {}) {
  const box = $('nv-now');
  if (!box) return;
  const mins = hero.timer ? minutesOf(hero.timer.value) : null;
  const rows = today || [];
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const lineKey = hero.strip ? rows.map(c => `${c.s}${parseTime(c.e) * 60 <= secs ? 1 : 0}${parseTime(c.s) * 60 <= secs ? 1 : 0}`).join() : '';
  const key = [getLocale(), week, hero.mode, hero.kicker, hero.span, hero.title, hero.place, hero.teacher, hero.label, mins, curIdx, lineKey, JSON.stringify(hero.strip), JSON.stringify(hero.foot), nextDay?.first?.s, nextDay?.label].join('|');
  if (key === drawn) return;
  drawn = key;

  const f = hero.foot;
  // A day over (or a day off): the next school day's first class is the one
  // coming, its band; the day's state and when on the top line, no foot.
  const ahead = hero.mode === 'off' && f && !f.note && f.subject;
  const kicker = ahead ? hero.title : hero.kicker || (hero.mode === 'off' ? L('今天', 'Today') : '');
  const top = el('div', 'nv-top', [el('span', 'nv-kicker', [hero.mode === 'class' ? el('i', 'nv-live') : null, withId(el('span', '', kicker), 'cx-kicker')]), withId(el('span', 'nv-span', ahead ? `${f.label} ${f.time}` : hero.span || ''), 'cx-span')]);
  const parts = f?.sub ? f.sub.split(' · ') : [];
  const main = ahead
    ? band(f.name, parts.length > 1 ? parts[0] : '', parts.at(-1) || '')
    : hero.subject
      ? band(hero.title, [hero.teacher, plain(hero.label)].filter(Boolean).join(' · '), hero.place)
      : withId(el('strong', 'nv-title', hero.title), 'now-name');
  const big = hero.timer ? bigMinutes(mins, hero.timer.label) : null;

  // The line, and under it how many are left, when school's out, the next school day's first class.
  const line = hero.strip && rows.length ? dayLine(rows, week, now, curIdx, date) : null;
  const first = nextDay?.first ? processSplitName(nextDay.first, nextDay.week) : null;
  const end = hero.strip
    ? el('p', 'nv-end', [el('b', '', hero.strip.left ? t('dashboard.stripLeft', { n: hero.strip.left }) : t('dashboard.stripNone')), ` · ${t('dashboard.stripEnd', { time: hero.strip.end })}`, first ? el('span', 'nv-end-next', ` · ${nextDay.label} ${nextDay.first.s} ${first.n}`) : null])
    : null;

  // The foot: the class after (接著 / 下一節), or the next school day's
  // first; a tap on it opens that class (dashboard.js's footTarget).
  let foot = null;
  if (!ahead && f?.note) foot = el('p', 'nv-foot-note', f.note);
  else if (!ahead && f) {
    foot = button('nv-foot q-press', null, [withId(el('small', 'nv-foot-label', f.label), 'next-label'), el('span', 'nv-foot-dot'), withId(el('strong', 'nv-foot-name', f.name), 'next-name'), withId(el('span', 'nv-foot-end', [f.time, parts.length ? ` · ${parts.at(-1)}` : ''].join('')), 'next-time')]);
    if (f.subject) foot.style.setProperty('--subject', subjectLook(f.subject).color);
  }
  box.replaceChildren(...[top, main, big, line, end, foot].filter(Boolean));
}

// ---- A day's classes (今天's list) ----
// The day's named break that sits wholly between two classes, if any.
function breakBetween(end, start) {
  const from = parseTime(end);
  const to = parseTime(start);
  return (state.applicationData.breakTimes || []).find(b => b.name && b.start && b.end && parseTime(b.start) >= from && parseTime(b.end) <= to && parseTime(b.end) > parseTime(b.start));
}
// A day's classes from `from` on as cards in a rail, each its subject's
// colour: its glyph, period, name, time and room; a named break between two
// as a slim card of its own.
export function dayCards(rows, week, { date = null, from = 0 } = {}) {
  const out = [];
  rows.forEach((c, i) => {
    if (i < from) return;
    const info = processSplitName(c, week);
    const pic = el('span', 'cx-cl-icon');
    pic.innerHTML = subjectIcon(info.n);
    const top = el('span', 'cx-cl-top', [pic, el('small', '', t('dashboard.periodNumber', { number: (c.p ?? i) + 1 }))]);
    const name = el('strong', `cx-cl-name${nameSize(info.n)}`, info.n);
    const card = button('cx-cl q-press', () => openModal(c, { date }), [top, el('b', 'cx-cl-time', c.s), name, el('small', 'cx-cl-sub', [c.loc || info.t || c.e].filter(Boolean)[0])]);
    card.style.setProperty('--subject', subjectLook(info.n).color);
    if (info.label) card.classList.add('is-split');
    out.push(card);
    const after = rows[i + 1];
    const gap = after && breakBetween(c.e, after.s);
    if (gap) {
      const cup = el('span', 'cx-cl-icon');
      cup.innerHTML = breakIcon();
      out.push(el('div', 'cx-cl is-break', [cup, el('b', 'cx-cl-time', gap.start), el('strong', 'cx-cl-name', breakLabel(gap.name))]));
    }
  });
  while (out[0]?.classList.contains('is-break')) out.shift();
  while (out.at(-1)?.classList.contains('is-break')) out.pop();
  return out;
}
// A day without classes: why (a holiday by name).
export function emptyDay(holiday, text = '') {
  const pic = el('span', 'q-tile soft cx-gray');
  pic.innerHTML = glyph('moon');
  const words = el('span', 'q-ritem-text', [el('span', 'q-ritem-title row-name', holiday ? t('dashboard.holidayTitle', { zh: holiday.zh, en: holiday.en || holiday.zh }) : text || t('dashboard.restOrStudy'))]);
  return el('div', 'q-ritem row is-empty', [pic, words]);
}

// 今天's list: today's classes after the ones the card names (`through`), or
// once the day is over the next school day's, whole.
export function renderTodayList({ week, through, curDay, now }) {
  const list = $('schedule-list');
  const sec = $('cx-list-sec');
  if (!list || !sec) return;
  const testing = window.MANUALLY_TEST;
  // (A day picked that has since gone by: back to the coming one.)
  if (state.viewDate && dateKey(state.viewDate) < dateKey(now)) state.viewDate = null;
  const date = testing ? null : state.viewDate || dateOfDay(state.viewDay, now);
  const holiday = date ? holidayOn(date) : null;
  const rows = date ? classesOn(date) : state.runtimeSchedule[state.viewDay] || [];
  if (date) week = getWeekType(date);
  const isToday = state.viewDay === curDay && (!date || date.toDateString() === now.toDateString());
  // No timetable yet: one card that says so and adds it.
  const none = !Object.values(state.runtimeSchedule || {}).some(r => (r || []).length);
  drawDays(none ? null : date, now);
  const items = none ? [] : dayCards(rows, week, { date, from: isToday ? through + 1 : 0 });
  if (none) items.push(kitUI.empty({ icon: 'calendar', title: t('dashboard.noTimetable'), body: t('dashboard.noTimetableBody'), action: { label: t('dashboard.addTimetable'), onTap: () => showOnboardingPrompt({ force: true }) } }));
  else if (!rows.length) items.push(emptyDay(holiday));
  // Today's all on the card already: said so, the strip's day still under its head.
  else if (!items.length) items.push(emptyDay(null, t('dashboard.noneLater')));
  const title = $('cx-list-title');
  if (title) {
    const ahead = date ? Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / MS_PER_DAY) : (state.viewDay - curDay + 7) % 7;
    const day = ahead === 1 ? t('dashboard.tomorrow') : ahead > 6 || ahead < 0 ? `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAY_LABELS[state.viewDay]}` : WEEKDAY_LABELS[state.viewDay];
    title.textContent = none ? t('tools.myTimetable') : isToday ? t('dashboard.laterToday') : t('dashboard.dayClasses', { day });
  }
  sec.querySelector('.cx-more')?.toggleAttribute('hidden', none);
  // The hero has nothing to count down until there is a timetable.
  $('cx-hero')?.toggleAttribute('hidden', none);
  sec.hidden = !items.length;
  const body = none ? items : items[0]?.classList.contains('is-empty') ? [el('div', 'q-rowcard cx-day', items)] : [el('div', 'q-rail cx-cls', items)];
  list.replaceChildren(...(items.length ? body : []));
}

// The day 今天's list shows: the family's strip of days (the kit's, as every
// app picks a day), today and the school days of the next two weeks (a
// holiday among them, said so), 📅 for any day; a swipe across the page goes
// a day either way (shell.js). Not in Test Mode (it walks weekdays, not dates).
const daysRec = {};
const DAYS_AHEAD = 14;
export function schoolDays(now = new Date()) {
  const sat = (state.runtimeSchedule?.[6] || []).length > 0;
  const out = [];
  for (let n = 0; n <= DAYS_AHEAD; n++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
    const wd = d.getDay();
    if (n === 0 || (wd >= 1 && wd <= 5) || (wd === 6 && sat) || classesOn(d).length) out.push(dateKey(d));
  }
  return out;
}
export function pickDay(key) {
  const date = dateFromKey(key);
  if (!date) return;
  state.viewDate = date;
  state.viewDay = date.getDay();
  state.lastListKey = '';
  window.update?.();
}
function drawDays(date, now) {
  const bar = $('cx-days');
  if (!bar) return;
  bar.hidden = !date;
  if (!date) return;
  const days = schoolDays(now);
  const current = dateKey(date);
  const later = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 180);
  kitUI.dayStrip(daysRec, { days: days.includes(current) ? days : [...days, current].sort(), current, today: dateKey(now), follow: true, onPick: pickDay, clamp: v => v, bounds: { from: dateKey(now), to: dateKey(later) } });
  if (daysRec.wrap.parentElement !== bar) bar.replaceChildren(daysRec.wrap);
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
  // Soonest first, the ones over last.
  // In the order set in the editor (its drag handles), never re-sorted.
  const cards = events.map(event => {
    const st = countdownState(event, today);
    const look = eventLook(event.name);
    const pic = el('span', 'cx-cl-icon');
    pic.innerHTML = look.icon;
    const big = st.kind === 'ahead' ? el('span', 'cx-cd-big', [el('b', '', String(st.days)), el('small', '', t('dashboard.countdownDayUnit'))]) : el('span', `cx-cd-big is-${st.kind}`, [el('em', '', t(`dashboard.${{ today: 'countdownToday', on: 'countdownInProgress', over: 'countdownEnded' }[st.kind]}`))]);
    const card = button(`q-rail-card cx-cd is-${st.kind}`, editCountdowns, [el('span', 'cx-cd-top', [pic, el('small', '', formatCountdownEventDate(event, { withYear: dateFromKey(event.startDate) - today > 330 * MS_PER_DAY }))]), el('strong', `cx-cd-name${nameSize(eventName(event.name))}`, eventName(event.name)), big]);
    card.style.setProperty('--subject', look.color);
    if (st.kind === 'ahead') card.setAttribute('aria-label', t('dashboard.countdownAriaDays', { name: eventName(event.name), days: st.days }));
    return card;
  });
  // None yet: one card that adds the first.
  const body = cards.length ? el('div', 'q-rail cx-cds', cards) : el('div', 'q-rowcard', [button('q-ritem chevron', editCountdowns, [el('span', 'q-tile', null), el('span', 'q-ritem-text', [el('span', 'q-ritem-title', t('dashboard.addCountdown'))])])]);
  if (!cards.length) body.querySelector('.q-tile').innerHTML = glyph('plus');
  box.replaceChildren(...section(t('dashboard.countdowns'), body, { more: cards.length ? t('common.edit') : '', onMore: editCountdowns }).childNodes);
}
