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
import { breakIcon, eventLook, moonIcon, shortNames, subjectIcon, subjectLook } from './subjects.js';
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

// "39:54" or "1:02:03" → seconds.
export function secondsOf(value) {
  const parts = String(value || '')
    .split(':')
    .map(Number);
  if (!value || parts.some(n => !Number.isFinite(n))) return null;
  return parts.reduce((s, n) => s * 60 + n, 0);
}
// "39:54" or "1:02:03" → whole minutes, rounded up (a class 39:54 from its end is 40 minutes).
export function minutesOf(value) {
  const secs = secondsOf(value);
  return secs == null ? null : Math.ceil(secs / 60);
}
// The big figure: 40 分鐘後下課 / 1 小時 5 分後上課 (the numbers large, the
// words small after them). Within the hour of a class starting or ending
// (Jay 2026-11-03: in class, to the second): 39 分 54 秒後下課, ticking.
function bigTime(secs, label, toSecond) {
  if (secs == null) return null;
  const unit = s => el('small', 'nv-unit', s);
  const tail = getLocale() === 'en' ? ` ${label}` : label;
  const num = (n, pad) => el('b', '', pad ? String(n).padStart(2, '0') : String(n));
  let parts;
  if (toSecond) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    parts = m ? [num(m), unit(L('分', 'm')), num(s, true), unit(L('秒', 's') + tail)] : [num(s), unit(L('秒', 's') + tail)];
  } else {
    const mins = Math.ceil(secs / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    parts = h ? [num(h), unit(L('小時', 'h')), m ? num(m) : null, unit(m ? L('分', 'm') + tail : tail)] : [num(m), unit(L('分鐘', 'min') + tail)];
  }
  return withId(el('div', 'nv-big', parts), 'timer-val');
}

// A break that is the card itself (bedtime, one long before the next class):
// a band of its own, the moon for the night (or the cup), its hours under its
// name; under the time left, how far through it is as a bar from start to end.
const isNight = (name, span) => /睡|寢|就寢|熄燈|晚安|sleep|bed|night|lights/i.test(name) || (() => {
  const [a, b] = String(span || '').split(/[–-]/).map(parseTime);
  return Number.isFinite(a) && Number.isFinite(b) && b < a;
})();
function breakBand(name, span) {
  const pic = el('span', 'q-band-mark');
  pic.innerHTML = isNight(name, span) ? moonIcon() : breakIcon();
  const node = el('div', 'q-band nv-band is-rest', [pic, el('span', 'q-band-text', [withId(el('b', '', name), 'now-name'), span ? withId(el('small', '', span), 'cx-span') : null])]);
  node.style.setProperty('--band', isNight(name, span) ? 'var(--q-indigo)' : 'var(--q-gray)');
  return node;
}
function breakBar(span, progress) {
  const [from, to] = String(span || '').split(/[–-]/);
  const bar = el('div', 'nv-bar', [el('i', 'nv-bar-fill')]);
  bar.style.setProperty('--done', `${Math.max(0, Math.min(100, progress || 0)).toFixed(2)}%`);
  return el('div', 'nv-span-bar', [el('small', '', from || ''), bar, el('small', '', to || '')]);
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
  const total = hero.timer ? secondsOf(hero.timer.value) : null;
  const mins = total == null ? null : Math.ceil(total / 60);
  // To the second within the hour of a class's start or end; a break of its own (bedtime) in minutes.
  const toSecond = total != null && Boolean(hero.subject) && total < 3600;
  const rows = today || [];
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const lineKey = hero.strip ? rows.map(c => `${c.s}${parseTime(c.e) * 60 <= secs ? 1 : 0}${parseTime(c.s) * 60 <= secs ? 1 : 0}`).join() : '';
  const key = [getLocale(), week, hero.mode, hero.kicker, hero.span, hero.title, hero.place, hero.teacher, hero.label, toSecond ? 's' : mins, curIdx, lineKey, hero.mode === 'break' && !hero.subject ? Math.floor(hero.progress || 0) : '', JSON.stringify(hero.strip), JSON.stringify(hero.foot), nextDay?.first?.s, nextDay?.label].join('|');
  if (key === drawn) {
    // (Ticking: only the figure, each second, in place.)
    if (toSecond) $('timer-val')?.replaceChildren(...bigTime(total, hero.timer.label, true).childNodes);
    return;
  }
  drawn = key;

  const f = hero.foot;
  // A day over (or a day off): the next school day's first class is the one
  // coming, its band; the day's state and when on the top line, no foot.
  const ahead = hero.mode === 'off' && f && !f.note && f.subject;
  const kicker = ahead ? hero.title : hero.kicker || (hero.mode === 'off' ? L('今天', 'Today') : '');
  // A break that is the card (bedtime): its own band, no top line (it had only the hours, alone on the right).
  const rest = hero.mode === 'break' && !hero.subject;
  const top = rest ? null : el('div', 'nv-top', [el('span', 'nv-kicker', [hero.mode === 'class' ? el('i', 'nv-live') : null, withId(el('span', '', kicker), 'cx-kicker')]), withId(el('span', 'nv-span', ahead ? `${f.label} ${f.time}` : hero.span || ''), 'cx-span')]);
  const parts = f?.sub ? f.sub.split(' · ') : [];
  const main = ahead
    ? band(f.name, parts.length > 1 ? parts[0] : '', parts.at(-1) || '')
    : hero.subject
      ? band(hero.title, [hero.teacher, plain(hero.label)].filter(Boolean).join(' · '), hero.place)
      : rest
        ? breakBand(hero.title, hero.span)
        : withId(el('strong', 'nv-title', hero.title), 'now-name');
  const big = hero.timer ? bigTime(total, hero.timer.label, toSecond) : null;
  const bar = rest && hero.span ? breakBar(hero.span, hero.progress) : null;

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
  box.replaceChildren(...[top, main, big, bar, line, end, foot].filter(Boolean));
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
export function dayCards(rows, week, { date = null, from = 0, over = false } = {}) {
  const out = [];
  rows.forEach((c, i) => {
    if (i < from) return;
    const info = processSplitName(c, week);
    const pic = el('span', 'cx-cl-icon');
    pic.innerHTML = subjectIcon(info.n);
    // A timeline: the start over the end on the left, the class as a block washed in its subject's colour.
    const when = el('span', 'cx-cl-when', [el('b', 'cx-cl-time', c.s), el('small', 'cx-cl-till', c.e)]);
    const sub = [info.t, c.loc].filter(Boolean).join(' · ');
    const words = el('span', 'cx-cl-words', [el('strong', `cx-cl-name${nameSize(info.n)}`, info.n), sub ? el('small', 'cx-cl-sub', sub) : null]);
    const card = button('cx-cl q-press', () => openModal(c, { date }), [when, el('span', 'cx-cl-block', [pic, words])]);
    card.setAttribute('aria-label', `${t('dashboard.periodNumber', { number: (c.p ?? i) + 1 })} ${c.s}–${c.e} ${info.n}${sub ? ` ${sub}` : ''}`);
    card.style.setProperty('--subject', subjectLook(info.n).color);
    if (info.label) card.classList.add('is-split');
    if (over) card.classList.add('is-over');
    out.push(card);
    const after = rows[i + 1];
    const gap = after && breakBetween(c.e, after.s);
    if (gap) {
      const cup = el('span', 'cx-cl-icon');
      cup.innerHTML = breakIcon();
      out.push(el('div', `cx-cl is-break${over ? ' is-over' : ''}`, [el('b', 'cx-cl-time', gap.start), el('span', 'cx-cl-gap', [cup, el('strong', 'cx-cl-name', breakLabel(gap.name))])]));
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
  // Today picked once it's over: its classes, all done (faded), under 今天的課, never 之後的課.
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const over = isToday && rows.length > 0 && rows.every(c => parseTime(c.e) * 60 <= secs);
  // No timetable yet: one card that says so and adds it.
  const none = !Object.values(state.runtimeSchedule || {}).some(r => (r || []).length);
  drawDays(none ? null : date, now);
  const items = none ? [] : dayCards(rows, week, { date, from: isToday && !over ? through + 1 : 0, over });
  if (none) items.push(kitUI.empty({ icon: 'calendar', title: t('dashboard.noTimetable'), body: t('dashboard.noTimetableBody'), action: { label: t('dashboard.addTimetable'), onTap: () => showOnboardingPrompt({ force: true }) } }));
  else if (!rows.length) items.push(emptyDay(holiday));
  // Today's all on the card already: said so, the strip's day still under its head.
  else if (!items.length) items.push(emptyDay(null, t('dashboard.noneLater')));
  const title = $('cx-list-title');
  if (title) {
    const ahead = date ? Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / MS_PER_DAY) : (state.viewDay - curDay + 7) % 7;
    const day = ahead === 1 ? t('dashboard.tomorrow') : ahead > 6 || ahead < 0 ? `${date.getMonth() + 1}/${date.getDate()} ${WEEKDAY_LABELS[state.viewDay]}` : WEEKDAY_LABELS[state.viewDay];
    title.textContent = none ? t('tools.myTimetable') : over ? t('dashboard.dayClasses', { day: t('dashboard.today') }) : isToday ? t('dashboard.laterToday') : t('dashboard.dayClasses', { day });
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
