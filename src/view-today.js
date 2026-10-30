// ---- src/view-today.js ----
// 今天: the hero (the class now, or the one coming, or a day over, from
// schedule-calc.js heroView, with the day as a strip of chips), the classes
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
import { breakIcon, eventLook, shortNames, subjectIcon, subjectLook, subjectTile } from './subjects.js';
import { openModal } from './view-sheet.js';
import { el, button, glyph, nameSize, section } from './ui.js';
import { t } from './strings.js';

// ---- The hero ----
let dom = null;
const $ = id => document.getElementById(id);
function heroDom() {
  if (dom) return dom;
  dom = {};
  for (const id of ['cx-hero', 'cx-kicker', 'cx-span', 'now-name', 'cx-meta', 'now-teacher', 'now-place', 'now-class-label', 'timer-group', 'timer-val', 'timer-label', 'cx-ring-fill', 'cx-art', 'cx-foot', 'next-label', 'next-name', 'next-time', 'next-sub', 'next-note', 'cx-icon', 'cx-glyph', 'next-icon']) dom[id] = $(id);
  return dom;
}
// Last-drawn values: the card is asked every second, but only the time left
// and the ring change that often.
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
  put('kicker', hero.kicker, v => (d['cx-kicker'].textContent = v));
  put('span', hero.span, v => (d['cx-span'].textContent = v));
  put('title', hero.title, v => {
    d['now-name'].textContent = v;
    d['now-name'].className = `cx-title${nameSize(v)}`;
  });
  // The card is the subject's colour, its glyph large behind the words.
  put('icon', hero.subject ? `s:${hero.subject}` : `m:${hero.mode}`, () => {
    d['cx-icon'].innerHTML = hero.subject ? subjectIcon(hero.subject) : hero.mode === 'break' ? breakIcon() : glyph('moon');
    d['cx-art'].innerHTML = d['cx-icon'].innerHTML;
    d['cx-hero'].classList.toggle('has-subject', Boolean(hero.subject));
    if (hero.subject) d['cx-hero'].style.setProperty('--subject', subjectLook(hero.subject).color);
    else d['cx-hero'].style.removeProperty('--subject');
  });
  put('teacher', hero.teacher, v => (d['now-teacher'].textContent = v));
  put('place', hero.place, v => (d['now-place'].textContent = v));
  put('label', hero.label, v => (d['now-class-label'].innerHTML = v));
  put('hasMeta', Boolean(hero.teacher || hero.place || hero.label), v => (d['cx-meta'].hidden = !v));
  put('hasTimer', Boolean(hero.timer), v => (d['timer-group'].style.display = v ? 'flex' : 'none'));
  if (hero.timer) {
    put('timerLabel', hero.timer.label, v => (d['timer-label'].textContent = v));
    put('timerVal', hero.timer.value, v => (d['timer-val'].textContent = v));
  }
  // The ring round the glyph: the class (or the wait) gone by.
  put('progress', hero.progress == null ? '' : hero.progress.toFixed(1), v => (d['cx-ring-fill'].style.strokeDasharray = v === '' ? '0 100' : `${v} 100`));
  const foot = hero.foot;
  put('foot', foot ? (foot.note ? 'note' : 'class') : 'none', v => {
    d['cx-foot'].hidden = v === 'none';
    d['cx-foot'].dataset.kind = v;
  });
  if (foot?.note) put('note', foot.note, v => (d['next-note'].textContent = v));
  else if (foot) {
    put('nextLabel', foot.label, v => (d['next-label'].textContent = v));
    put('nextName', foot.name, v => {
      d['next-name'].textContent = v;
      d['next-name'].className = nameSize(v).trim();
    });
    put('nextIcon', foot.subject || '', v => d['next-icon'].replaceChildren(...(v ? [subjectTile(v, 'sm', true)] : [])));
    put('nextTime', foot.time, v => (d['next-time'].textContent = v));
    put('nextSub', foot.sub, v => (d['next-sub'].textContent = v));
  }
  put('strip', `${week}|${JSON.stringify(hero.strip)}`, () => renderStrip(hero.strip, week));
}

// The day at a glance, under the card's words: a chip per class in its
// colour (its two-character short name), the ones done faded, the one now
// ringed, each opening its own class; then how many are left, the week (單 / 雙) and when school's out.
function renderStrip(strip, week) {
  const box = $('cx-strip');
  if (!box) return;
  box.hidden = !strip;
  if (!strip) return box.replaceChildren();
  // Each by a two-character short name (國語文 → 國語, 空間資訊科技 → 空間), never two alike.
  const short = shortNames(strip.chips.map(c => c.name), 2);
  const chips = strip.chips.map((c, i) => {
    const chip = el('i', `cx-chip is-${c.state}`, short.get(c.name) || '·');
    chip.dataset.i = String(i);
    chip.setAttribute('aria-label', `${c.start} ${c.name}`);
    chip.style.setProperty('--subject', subjectLook(c.name).color);
    chip.title = `${c.start} ${c.name}`;
    return chip;
  });
  const words = el('span', 'cx-strip-words', [el('b', '', strip.left ? t('dashboard.stripLeft', { n: strip.left }) : t('dashboard.stripNone')), el('small', '', [week ? t(week === '單' ? 'week.odd' : 'week.even') : '', t('dashboard.stripEnd', { time: strip.end })].filter(Boolean).join(' · '))]);
  box.replaceChildren(el('span', 'cx-chips', chips), words);
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
