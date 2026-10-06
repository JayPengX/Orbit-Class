// ---- src/dashboard.js ----
// The live "what's happening right now" dashboard: update()'s per-second
// orchestration (calls schedule-calc.js for the math, then renders), plus
// the toolbar/modal/countdown-card UI around it.
import { MS_PER_DAY, WEEKDAY_LABELS } from './constants.js';
import { state } from './state.js';
import { closeStylePanel } from './appearance.js';
import { fitNowTitleText, renderList, shrinkFontToFit } from './dashboard-render.js';
import { formatCountdownEventDate, normalizeCountdownEvents } from './data.js';
import { isEditorDirty } from './editor-backup.js';
import {
  closeEditor,
  closeTransferSheet,
  esc,
  hasUnconsumedImportData,
  hideEditorDiscardConfirm,
  showEditorDiscardConfirm,
  showTransferDiscardConfirm
} from './editor-core.js';
import { closeAssignSheet } from './editor-teachers.js';
import {
  getNextSchoolDay,
  getWeekLabelHtml,
  getWeekType,
  pad2,
  processSplitName
} from './schedule.js';
import { classStartingSoon, computeDashboardViewModel, heroView, noticeLead } from './schedule-calc.js';
import { eventLook, stateIcon, subjectIcon, subjectLook } from './subjects.js';
import { notifyClassSoon, scheduleClassNotices } from './sync.js';
import { getLocale, t } from './strings.js';

// Opens or closes the manual time simulation panel.
// Modal and toolbar state is separate from saved schedule settings.
async function toggleTestPanel() {
  const editorSheet = document.getElementById('editor-sheet');
  if (editorSheet.classList.contains('show')) {
    if (isEditorDirty()) {
      state.pendingAfterEditorDiscard = 'test';
      showEditorDiscardConfirm();
      return;
    }
    closeEditor(true);
  }
  // Reachable via a button *inside* the transfer sheet itself (see
  // index.html's #test-mode-fold) - unlike the toolbar buttons, this one
  // isn't hidden while the transfer sheet is open, so this check is the
  // normal, expected path here, not just defensive belt-and-suspenders.
  const transferSheet = document.getElementById('transfer-sheet');
  if (transferSheet && transferSheet.classList.contains('show')) {
    if (await hasUnconsumedImportData()) {
      state.pendingAfterEditorDiscard = 'test';
      showTransferDiscardConfirm();
      return;
    }
    await closeTransferSheet(true);
  }
  state.testPanelOpen = !state.testPanelOpen;
  setOverlayVisible('test-panel-overlay', 'debug-panel', state.testPanelOpen);
  closeStylePanel();
  syncTestToolbar();
}
// Closes the manual time simulation panel.
function closeTestPanel() {
  state.testPanelOpen = false;
  setOverlayVisible('test-panel-overlay', 'debug-panel', false);
  syncTestToolbar();
}
// Opens Test Mode directly after another UI has been safely closed.
function openTestPanel() {
  state.testPanelOpen = true;
  setOverlayVisible('test-panel-overlay', 'debug-panel', true);
  syncTestToolbar();
}
// Keeps the toolbar test button state in sync with simulation mode.
function syncTestToolbar() {
  const btn = document.getElementById('btn-test');
  if (!btn) return;
  btn.classList.toggle('active', state.testPanelOpen);
  btn.classList.toggle('manual-test-on', !!window.MANUALLY_TEST);
  btn.classList.toggle('sim-running', !!window.IS_SIMULATING);
}
// Wires the grab handle on a bottom sheet (test/style panel) to an actual
// swipe-down-to-dismiss gesture, matching the affordance the handle implies.
// closeFn is called on a successful dismiss so guards like the style panel's
// unsaved-changes confirm still run; if it declines to close (panel keeps
// the 'show' class), the sheet snaps back open instead of staying hidden.
function bindSheetDragToDismiss(panelId, closeFn) {
  const panel = document.getElementById(panelId);
  const handle = panel && panel.querySelector('.test-panel-handle');
  if (!panel || !handle) return;
  // Test/style panels are horizontally centered via left:50% + translateX(-50%)
  // baked into their CSS transform (modal-sheet isn't - it's positioned with
  // left/right instead). Dragging must preserve that -50% or the panel loses
  // its centering and ends up shoved off to the right of the screen.
  const centered = panel.classList.contains('test-panel');
  const translate = y => (centered ? `translate(-50%,${y}px)` : `translateY(${y}px)`);
  let dragging = false;
  let startY = 0;
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
  const move = event => {
    if (!dragging) return;
    const deltaY = Math.max(0, event.clientY - startY);
    panel.style.transform = translate(deltaY);
  };
  const finish = event => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('is-dragging');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish);
    if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    const deltaY = Math.max(0, event.clientY - startY);
    if (deltaY <= threshold) {
      settle(true);
      return;
    }
    panel.style.transition = 'transform .22s cubic-bezier(.4,0,1,1)';
    panel.style.transform = translate(panel.offsetHeight + 40);
    setTimeout(async () => {
      // closeFn may be async (e.g. closeEditor's unsaved-changes check) - await
      // it so the 'show' class check below reflects the actual outcome instead
      // of racing an in-flight promise.
      await closeFn();
      requestAnimationFrame(() => settle(panel.classList.contains('show')));
    }, 220);
  };
  handle.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    dragging = true;
    startY = event.clientY;
    panel.style.transition = 'none';
    handle.classList.add('is-dragging');
    handle.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  });
}
bindSheetDragToDismiss('debug-panel', closeTestPanel);
bindSheetDragToDismiss('style-panel', closeStylePanel);
bindSheetDragToDismiss('sheet', closeModal);
bindSheetDragToDismiss('editor-sheet', () => closeEditor());
bindSheetDragToDismiss('transfer-sheet', () => closeTransferSheet());
// Changes the visible day when a navigation tab is pressed, sliding the
// schedule list in from the side the newly picked tab sits on relative to
// the one that was active (so hopping right along the week bar reads as
// "forward" and vice versa).
function handleNav(d) {
  const list = document.getElementById('schedule-list');
  if (list && d !== state.viewDay) {
    const buttons = [...document.querySelectorAll('.nav-item')];
    const oldIndex = buttons.findIndex(btn => parseInt(btn.dataset.day, 10) === state.viewDay);
    const newIndex = buttons.findIndex(btn => parseInt(btn.dataset.day, 10) === d);
    list.style.setProperty('--nav-dir', newIndex > oldIndex ? '1' : '-1');
    list.classList.remove('nav-slide');
    void list.offsetWidth;
    list.classList.add('nav-slide');
  }
  state.viewDay = d;
  window.update();
}
/* Tool menu and viewport fitting. */
function setToolHubState(open) {
  const actions = document.querySelector('.top-actions');
  const btn = document.getElementById('btn-menu');
  if (!actions || !btn) return;
  actions.classList.toggle('open', !!open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  const label = open ? t('dashboard.closeTools') : t('dashboard.openTools');
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
}
function toggleActionMenu() {
  const actions = document.querySelector('.top-actions');
  setToolHubState(!(actions && actions.classList.contains('open')));
}
let modalPreviousFocus = null;
document.addEventListener(
  'click',
  event => {
    const actions = document.querySelector('.top-actions');
    if (!actions || !actions.classList.contains('open')) return;
    if (!actions.contains(event.target)) setToolHubState(false);
  },
  { capture: true }
);
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (document.getElementById('assign-sheet')?.classList.contains('show')) closeAssignSheet();
  else if (document.getElementById('sheet')?.classList.contains('show')) closeModal();
  else if (document.getElementById('editor-confirm-sheet')?.classList.contains('show'))
    hideEditorDiscardConfirm();
  else if (document.getElementById('debug-panel')?.classList.contains('show')) closeTestPanel();
  else if (document.getElementById('style-panel')?.classList.contains('show')) closeStylePanel();
  else if (document.getElementById('editor-sheet')?.classList.contains('show')) closeEditor();
  else if (document.getElementById('transfer-sheet')?.classList.contains('show'))
    closeTransferSheet();
  else setToolHubState(false);
});
['btn-edit', 'btn-transfer', 'btn-style'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', () => setTimeout(() => setToolHubState(false), 80));
});

let activeCountdownIndex = 0;
// Countdown cards can be switched with a horizontal swipe on touch devices.
function getCountdownEvents(data = state.applicationData) {
  return normalizeCountdownEvents(data?.countdownEvents ?? []);
}
function showCountdownEvent(index) {
  const events = getCountdownEvents();
  activeCountdownIndex = (index + events.length) % events.length;
  updateExamCountdown();
  const card = document.getElementById('exam-countdown');
  if (card) {
    card.classList.remove('is-swapping');
    // Force reflow so re-adding the class restarts the animation even when
    // swiping again before the previous swap animation finished.
    void card.offsetWidth;
    card.classList.add('is-swapping');
  }
}
// Shrinks the countdown event name to fit its column instead of immediately
// falling back to the CSS text-overflow:ellipsis truncation - the date next
// to it doesn't need this (its longest realistic form, a cross-year range,
// is short and predictable enough to just always fit at its own fixed size).
function fitCountdownLabelText() {
  const label = document.querySelector('.exam-countdown-label');
  const copy = document.querySelector('.exam-countdown-copy');
  if (!label || !copy) return;
  label.style.fontSize = '';
  const defaultSize = parseFloat(getComputedStyle(label).fontSize);
  // Same shrink ratio fitNowTitleText uses for the "now playing" title
  // (down to roughly half its default size) rather than the few px of
  // headroom this had before - that shallow a range meant text-overflow:
  // ellipsis was doing most of the work for any name longer than a few
  // characters. text-overflow:ellipsis (in CSS) stays on as the backstop
  // for names too long to fit even at minSize - this column is a fraction
  // of the "now playing" title's width, so unlike that title, an 80-
  // character name (the input's own max length) genuinely cannot always be
  // shrunk down to a legible size and still fit.
  const minSize = Math.max(9, Math.round(defaultSize * 0.6));
  const available = copy.clientWidth;
  if (!available) return;
  shrinkFontToFit(label, available, defaultSize, minSize);
}
function updateExamCountdown() {
  showCountdown();
  showStatus();
}
function showCountdown() {
  const el = document.getElementById('exam-countdown-value');
  const card = document.getElementById('exam-countdown');
  if (!el || !card) return;

  const events = getCountdownEvents();
  if (!events.length) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  activeCountdownIndex = Math.min(activeCountdownIndex, events.length - 1);
  const event = events[activeCountdownIndex];
  const label = document.querySelector('.exam-countdown-label');
  const dateLabel = document.querySelector('.exam-countdown-date');
  if (label) label.textContent = event.name;
  if (dateLabel) dateLabel.textContent = formatCountdownEventDate(event);
  fitCountdownLabelText();
  const dots = document.getElementById('exam-countdown-dots');
  if (dots) {
    if (events.length < 2) {
      dots.hidden = true;
      dots.innerHTML = '';
    } else {
      dots.hidden = false;
      dots.innerHTML = events
        .map(
          (_, index) =>
            `<span class="exam-countdown-dot${index === activeCountdownIndex ? ' active' : ''}"></span>`
        )
        .join('');
    }
  }
  const toDate = value => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const examStart = toDate(event.startDate);
  const examEnd = toDate(event.endDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffStart = Math.round((examStart - today) / MS_PER_DAY);
  const diffEnd = Math.round((examEnd - today) / MS_PER_DAY);
  const isSingleDay = event.startDate === event.endDate;

  if (diffStart > 0) {
    el.innerHTML = `${diffStart}<span class="exam-countdown-unit">${t('dashboard.countdownDayUnit')}</span>`;
    card.setAttribute(
      'aria-label',
      t('dashboard.countdownAriaDays', { name: event.name, days: diffStart })
    );
  } else if (isSingleDay && diffStart === 0) {
    el.textContent = t('dashboard.countdownToday');
    card.setAttribute('aria-label', t('dashboard.countdownAriaStartsToday', { name: event.name }));
  } else if (diffEnd >= 0) {
    el.textContent = t('dashboard.countdownInProgress');
    card.setAttribute('aria-label', t('dashboard.countdownAriaInProgress', { name: event.name }));
  } else {
    el.textContent = t('dashboard.countdownEnded');
    card.setAttribute('aria-label', t('dashboard.countdownAriaEnded', { name: event.name }));
  }
}

// The app bar's status: the date and the week (10月6日 週二 · 雙週).
let statusWeek = null;
function showStatus(week = statusWeek) {
  statusWeek = week;
  const status = document.getElementById('status');
  if (!status) return;
  const en = getLocale() === 'en';
  const date = new Date().toLocaleDateString(en ? 'en-US' : 'zh-TW', { month: en ? 'short' : 'long', day: 'numeric', weekday: 'short' });
  const parts = [date, week == null ? '' : getWeekLabelHtml(week).replace(/<[^>]+>/g, '')];
  status.textContent = parts.filter(Boolean).join(' · ');
}

// 今天's countdowns: one card per event, side by side (swipe when there are
// several), in the editor's order. Each says how far off it is in large type
// (15 天), or that it starts today, is on, or is over; the last card adds one.
// Tapping any opens the editor at 倒數. Redrawn only when the events or the
// date change (update() asks every second).
const DAY_MS = 86400000;
function countdownState(event, today) {
  const at = value => {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const start = Math.round((at(event.startDate) - today) / DAY_MS);
  const end = Math.round((at(event.endDate) - today) / DAY_MS);
  if (start > 0) return { kind: 'ahead', days: start };
  if (start === 0) return { kind: 'today' };
  if (end >= 0) return { kind: 'on' };
  return { kind: 'over' };
}
let countdownsKey = '';
function renderCountdowns() {
  const box = document.getElementById('cx-countdowns');
  if (!box) return;
  const events = getCountdownEvents();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const key = `${today.getTime()}|${t('dashboard.countdowns')}|${JSON.stringify(events)}`;
  if (key === countdownsKey) return;
  countdownsKey = key;
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };
  const edit = () => {
    window.openEditor?.();
    window.openEditorFold?.('editor-fold-countdown');
  };
  const row = make('div', 'cx-cd-row');
  for (const event of events) {
    const st = countdownState(event, today);
    const card = make('button', `cx-cd is-${st.kind}`);
    card.type = 'button';
    card.addEventListener('click', edit);
    const words = make('span', 'cx-cd-words');
    words.append(make('span', 'cx-cd-name', event.name), make('span', 'cx-cd-date', formatCountdownEventDate(event).replace(new RegExp(`^${today.getFullYear()}\\.`), '')));
    const big = make('span', 'cx-cd-big');
    if (st.kind === 'ahead') {
      big.append(make('b', '', String(st.days)), make('small', '', t('dashboard.countdownDayUnit')));
      card.setAttribute('aria-label', t('dashboard.countdownAriaDays', { name: event.name, days: st.days }));
    } else {
      const word = { today: 'countdownToday', on: 'countdownInProgress', over: 'countdownEnded' }[st.kind];
      big.append(make('em', '', t(`dashboard.${word}`)));
    }
    // The event's picture (段考 a pen, 運動會 a trophy) beside its name.
    const pic = make('span', 'cx-cd-icon');
    pic.innerHTML = eventLook(event.name);
    card.append(pic, words, big);
    row.append(card);
  }
  const add = make('button', 'cx-cd cx-cd-add');
  add.type = 'button';
  add.setAttribute('aria-label', t('dashboard.addCountdown'));
  add.append(make('span', 'cx-cd-plus', '+'), make('span', 'cx-cd-addtext', t('dashboard.addCountdown')));
  add.addEventListener('click', edit);
  row.append(add);
  box.classList.toggle('is-many', events.length > 1);
  box.replaceChildren(make('h2', 'cx-section', t('dashboard.countdowns')), row);
}

const countdownCard = document.getElementById('exam-countdown');
let countdownSwipeStartX = null;
if (countdownCard) {
  countdownCard.addEventListener('pointerdown', event => {
    countdownSwipeStartX = event.clientX;
    countdownCard.setPointerCapture(event.pointerId);
  });
  countdownCard.addEventListener('pointerup', event => {
    if (countdownSwipeStartX === null) return;
    const distance = event.clientX - countdownSwipeStartX;
    countdownSwipeStartX = null;
    if (Math.abs(distance) < 35 || getCountdownEvents().length < 2) return;
    showCountdownEvent(activeCountdownIndex + (distance < 0 ? 1 : -1));
  });
  countdownCard.addEventListener('pointercancel', () => (countdownSwipeStartX = null));
}
window.addEventListener('resize', () => fitCountdownLabelText());
window.addEventListener('orientationchange', () => setTimeout(() => fitCountdownLabelText(), 120));

// Recomputes the current class, next class, timer, and visible schedule state.
// DOM nodes update()/render() touch every tick, queried once instead of via
// getElementById/querySelector on every single call (previously ~20 lookups
// a second even while nothing on screen was changing).
let dashboardDom = null;
function getDashboardDom() {
  if (dashboardDom) return dashboardDom;
  const $ = id => document.getElementById(id);
  dashboardDom = {
    simStatus: $('sim-status'),
    weekDisplay: $('week-display-main'),
    hero: $('cx-hero'),
    kicker: $('cx-kicker'),
    span: $('cx-span'),
    title: $('now-name'),
    meta: $('cx-meta'),
    teacher: $('now-teacher'),
    place: $('now-place'),
    classLabel: $('now-class-label'),
    timer: $('timer-group'),
    timerVal: $('timer-val'),
    timerLabel: $('timer-label'),
    bar: $('cx-bar'),
    fill: $('cx-fill'),
    foot: $('cx-foot'),
    nextLabel: $('next-label'),
    nextName: $('next-name'),
    nextTime: $('next-time'),
    nextSub: $('next-sub'),
    nextNote: $('next-note'),
    icon: $('cx-icon'),
    nextIcon: $('next-icon')
  };
  return dashboardDom;
}

// Last-drawn values: the card is asked every second, but only the time left
// and the bar change that often; everything else is written when it changes.
const lastRendered = {};
function put(key, value, write) {
  if (lastRendered[key] === value) return false;
  lastRendered[key] = value;
  write(value);
  return true;
}

// Draws heroView()'s card (src/schedule-calc.js). Pure data in, DOM writes out.
function renderDashboard(week, hero) {
  const dom = getDashboardDom();
  if (put('week', week, w => dom.weekDisplay && (dom.weekDisplay.innerHTML = getWeekLabelHtml(w)))) showStatus(week);
  if (!dom.hero) return;
  put('mode', hero.mode, v => (dom.hero.dataset.mode = v));
  put('kicker', hero.kicker, v => (dom.kicker.textContent = v));
  put('span', hero.span, v => (dom.span.textContent = v));
  if (put('title', hero.title, v => (dom.title.textContent = v))) fitNowTitleText();
  // The class's picture (src/subjects.js); a break's cup, a day over the moon.
  put('icon', hero.subject ? `s:${hero.subject}` : `m:${hero.mode}`, () => {
    dom.icon?.replaceChildren(hero.subject ? subjectIcon(hero.subject, 'hero-icon') : stateIcon(hero.mode, 'hero-icon'));
    // The bar and the top line in the class's colour.
    if (hero.subject) dom.hero.style.setProperty('--subject', subjectLook(hero.subject).color);
    else dom.hero.style.removeProperty('--subject');
  });
  put('teacher', hero.teacher, v => (dom.teacher.textContent = v));
  put('place', hero.place, v => (dom.place.textContent = v));
  put('classLabel', hero.label, v => (dom.classLabel.innerHTML = v));
  put('hasMeta', Boolean(hero.teacher || hero.place || hero.label), v => (dom.meta.hidden = !v));
  put('hasTimer', Boolean(hero.timer), v => (dom.timer.style.display = v ? 'flex' : 'none'));
  if (hero.timer) {
    put('timerLabel', hero.timer.label, v => (dom.timerLabel.textContent = v));
    put('timerVal', hero.timer.value, v => (dom.timerVal.textContent = v));
  }
  put('hasBar', hero.progress != null, v => (dom.bar.hidden = !v));
  if (hero.progress != null) put('progress', hero.progress.toFixed(2), v => (dom.fill.style.width = v + '%'));
  const foot = hero.foot;
  put('foot', foot ? (foot.note ? 'note' : 'class') : 'none', v => {
    dom.foot.hidden = v === 'none';
    dom.foot.dataset.kind = v;
  });
  if (foot?.note) put('note', foot.note, v => (dom.nextNote.textContent = v));
  else if (foot) {
    put('nextLabel', foot.label, v => (dom.nextLabel.textContent = v));
    put('nextName', foot.name, v => (dom.nextName.textContent = v));
    put('nextIcon', foot.subject || '', v => dom.nextIcon?.replaceChildren(...(v ? [subjectIcon(v, 'foot-icon')] : [])));
    put('nextTime', foot.time, v => (dom.nextTime.textContent = v));
    put('nextSub', foot.sub, v => {
      dom.nextSub.textContent = v;
      dom.nextSub.hidden = !v;
    });
  }
}

// The next school day after `day`, for the card's foot once today is over.
function nextSchoolDay(now, curDay) {
  const day = getNextSchoolDay(curDay);
  const first = (state.runtimeSchedule[day] || [])[0];
  if (!first) return null;
  const ahead = (day - curDay + 7) % 7 || 7;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
  return { label: ahead === 1 ? t('dashboard.tomorrow') : WEEKDAY_LABELS[day], first, week: getWeekType(date) };
}

// updateExamCountdown() computes a day-granularity D-day count (it can't
// change more than once a day - it uses the real calendar date, not Test
// Mode's simulated time), but was being called on every one-second tick.
// Re-running it only when the real date has actually rolled over avoids a
// DOM rebuild (including the countdown-dots innerHTML) 86399 times a day
// for nothing. showCountdownEvent() (swiping between countdown events)
// still calls updateExamCountdown() directly, bypassing this guard, since
// that's a real, immediate change the user just made.
let lastCountdownDateKey = null;
function updateExamCountdownIfDayChanged() {
  const dateKey = new Date().toDateString();
  if (dateKey === lastCountdownDateKey) return;
  lastCountdownDateKey = dateKey;
  updateExamCountdown();
}

function update() {
  updateExamCountdownIfDayChanged();
  renderCountdowns();
  const dom = getDashboardDom();
  const now = new Date();
  if (window.MANUALLY_TEST) {
    const h = Math.floor((window.TEST_TIME_SEC || 0) / 3600),
      m = Math.floor(((window.TEST_TIME_SEC || 0) % 3600) / 60),
      s = (window.TEST_TIME_SEC || 0) % 60;
    now.setHours(h, m, s, 0);
    if (dom.simStatus)
      dom.simStatus.innerText = window.IS_SIMULATING ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : '';
  } else if (dom.simStatus) {
    dom.simStatus.innerText = '';
  }
  const curDay = window.MANUALLY_TEST ? window.TEST_DAY : now.getDay();
  const week = getWeekType();

  // A day with no classes (weekend or otherwise - the nav bar itself no
  // longer shows a tab for one) should never be the day we land on by
  // default: point at whichever day actually has classes instead. This
  // covers both the very first render and Test Mode restoring a simulated
  // empty day straight into state.viewDay, bypassing state.js's own initial
  // Sat/Sun -> Monday fallback. Guarded on at least one day having classes
  // at all, so a totally empty schedule (nothing scheduled yet) doesn't spin
  // getNextSchoolDay()'s no-match fallback into a different empty day every
  // single tick.
  const hasAnyClasses = Object.values(state.runtimeSchedule).some(rows => (rows || []).length > 0);
  if (hasAnyClasses && !(state.runtimeSchedule[state.viewDay] || []).length) {
    state.viewDay = getNextSchoolDay(state.viewDay);
  }

  const viewModel = computeDashboardViewModel({
    now,
    curDay,
    week,
    todaySchedule: state.runtimeSchedule[curDay],
    breakTimes: state.applicationData.breakTimes
  });

  if (!viewModel.isDayFinished && state.autoAdvancedAfterFinishedDay === curDay) {
    state.autoAdvancedAfterFinishedDay = null;
  }
  if (
    viewModel.isDayFinished &&
    state.viewDay === curDay &&
    state.autoAdvancedAfterFinishedDay !== curDay
  ) {
    state.viewDay = getNextSchoolDay(curDay);
    state.autoAdvancedAfterFinishedDay = curDay;
  }

  renderDashboard(
    week,
    heroView(viewModel, { now, week, todaySchedule: state.runtimeSchedule[curDay], nextDay: nextSchoolDay(now, curDay) })
  );

  // As the break before a class starts (five minutes before, after a long
  // one): a notice (once per class; not in test mode), only in its own
  // minute: opened later, the card already says how long is left.
  if (!window.MANUALLY_TEST) {
    const soon = classStartingSoon({ now, week, todaySchedule: state.runtimeSchedule[curDay] });
    if (soon?.due) notifyClassSoon({ ...soon, lead: soon.left });
    // The coming week's, for the Worker (again every ten minutes).
    const slot = Math.floor(now.getTime() / 600_000);
    if (slot !== state.classPushSlot) {
      state.classPushSlot = slot;
      scheduleClassNotices(weekClasses(now));
    }
  }

  const liveStateKey = `${window.MANUALLY_TEST ? 'T' : 'R'}-${curDay}-${week}-${viewModel.curIdx}-${viewModel.nxtIdx}-${viewModel.activeBreakName}-${viewModel.isDayFinished}-${state.viewDay}-${document.body.dataset.tab}`;
  if (state.lastListKey !== liveStateKey) {
    renderList(week, viewModel.curIdx, viewModel.nxtIdx, curDay, viewModel.isDayFinished);
    state.lastListKey = liveStateKey;
  }
}

// Every class from now to a week ahead: { at (its notice's time, noticeLead), lead, tag, name, meta }.
function weekClasses(now) {
  const out = [];
  for (let d = 0; d < 7 && out.length < 60; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const week = getWeekType(date);
    const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    const list = state.runtimeSchedule[date.getDay()] || [];
    for (const [i, c] of list.entries()) {
      const [h, m] = String(c.s || '')
        .split(':')
        .map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
      const lead = noticeLead(list, i);
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m).getTime() - lead * 60_000;
      if (at <= now.getTime()) continue;
      const info = processSplitName(c, week);
      if (!info.n) continue;
      out.push({
        at,
        lead,
        tag: `class:${day}:${c.s}`,
        name: info.n,
        meta: [c.s, info.t, c.loc].filter(Boolean).join(' · ')
      });
    }
  }
  return out;
}

// Set the instant the user touches or scrolls the list (see initScheduleScrollInputTracking),
// not only once a 'scroll' event actually lands. A pending one-time alignment (below) checks
// this and backs off instead of yanking the list out from under an in-progress gesture.

function keepActiveClassVisible(list, isDayFinished, scrollKey) {
  if (scrollKey === state.lastAutoScrollKey) return;
  state.lastAutoScrollKey = scrollKey;
  state.userScrolledDuringAlign = false;

  const activeRow = list.querySelector('.is-now') || list.querySelector('.is-next');

  if (isDayFinished || !activeRow) {
    requestAnimationFrame(() =>
      list.scrollTo({
        top: 0,
        behavior: 'auto'
      })
    );
    return;
  }

  // One pass, one frame after layout: the row entrance animation only transforms
  // opacity/transform/filter (never layout-affecting properties), so activeRow.offsetTop
  // is already correct here and doesn't need to be re-polled on a timer afterwards.
  requestAnimationFrame(() => {
    if (state.userScrolledDuringAlign) return;
    // Clamped to the list's own natural scroll bound — this never manufactures extra
    // scrollable room to force exact top-alignment for a class near the end of a long
    // day. That used to need a second system to stop manual scrolling drifting into the
    // manufactured room, which meant fighting iOS Safari's native rubber-band bounce at
    // the bottom edge and reading as flicker. A class within the last screenful now
    // settles as high as native scrolling allows instead of exactly at the top; nothing
    // here ever imposes a ceiling tighter than the browser's own, so there is nothing
    // left to contest during a touch gesture.
    const targetTop = Math.min(Math.max(0, activeRow.offsetTop), getNaturalListMaxScroll(list));
    list.scrollTo({ top: targetTop, behavior: 'auto' });
  });
}

// Real content boundary for scrolling.
function getNaturalListMaxScroll(list) {
  return Math.max(0, list.scrollHeight - list.clientHeight);
}

// Closes the class detail modal.
function setElementVisible(id, visible) {
  const element = document.getElementById(id);
  if (element) element.classList.toggle('show', visible);
  return element;
}
function setOverlayVisible(overlayId, panelId, visible, bodyClass) {
  const overlay = setElementVisible(overlayId, visible);
  setElementVisible(panelId, visible);
  if (overlay) overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (bodyClass) document.body.classList.toggle(bodyClass, visible);
}
function closeModal() {
  setOverlayVisible('overlay', 'sheet', false, 'modal-open');
  if (modalPreviousFocus && typeof modalPreviousFocus.focus === 'function')
    modalPreviousFocus.focus();
  modalPreviousFocus = null;
}
function setSplitWeekClass(id, subject, teacher) {
  const target = document.getElementById(id);
  if (!target) return;
  target.replaceChildren(document.createTextNode(subject || ''));
  const teacherText = document.createElement('div');
  teacherText.style.cssText = 'font-size:11px;font-weight:400;color:var(--sub)';
  teacherText.textContent = teacher || '';
  target.appendChild(teacherText);
}
// Opens the class detail modal and fills in occurrence/location details.
function openModal(c) {
  modalPreviousFocus = document.activeElement;
  const week = getWeekType();
  const terms = c.isSplit ? c.n.split('/').map(t => t.trim()) : [c.n];
  const teachers = c.isSplit ? c.t.split('/').map(t => t.trim()) : [c.t];
  let count = 0,
    occHtml = '';
  const locCard = document.getElementById('m-location-card');
  const statGrid = locCard.closest('.stat-grid');
  if (c.loc) {
    locCard.style.display = 'block';
    document.getElementById('m-location-val').innerText = c.loc;
    statGrid.classList.add('has-location');
  } else {
    locCard.style.display = 'none';
    statGrid.classList.remove('has-location');
  }
  [1, 2, 3, 4, 5].forEach(d => {
    state.runtimeSchedule[d].forEach((item, idx) => {
      const match = c.isSplit ? terms.some(t => item.n.includes(t)) : item.n === c.n;
      if (match) {
        count++;
        occHtml += `<div class="occ-row"><span class="occ-row-day">${WEEKDAY_LABELS[d]}</span><div class="occ-row-meta"><div class="occ-row-period">${t('dashboard.periodNumber', { number: idx + 1 })}</div><div class="occ-row-time">${esc(item.s)} – ${esc(item.e)}</div></div></div>`;
      }
    });
  });
  const sc = document.getElementById('split-info-card');
  if (c.isSplit) {
    sc.style.display = 'block';
    const idx = week === '單' ? 0 : 1;
    setSplitWeekClass('this-week-class', terms[idx], teachers[idx] || teachers[0]);
    setSplitWeekClass('next-week-class', terms[1 - idx], teachers[1 - idx] || teachers[0]);
    document.getElementById('m-type-val').innerText = t('dashboard.typeSplit');
  } else {
    sc.style.display = 'none';
    document.getElementById('m-type-val').innerText = t('dashboard.typeFixed');
  }
  const info = processSplitName(c, week);
  document.getElementById('m-title').innerText = info.n;
  document.getElementById('m-icon')?.replaceChildren(subjectIcon(info.n, 'sheet-icon'));
  document.getElementById('m-teacher').innerText = [info.t, c.loc].filter(Boolean).join(' · ');
  document.getElementById('m-count').innerText = t('dashboard.periodCount', { count });
  document.getElementById('m-occ-list').innerHTML =
    occHtml ||
    `<div class="occ-row"><span class="occ-row-day">×</span><div class="occ-row-meta"><div class="occ-row-period">${t('dashboard.noOccurrences')}</div></div></div>`;
  setOverlayVisible('overlay', 'sheet', true, 'modal-open');
}

// Exposed on window for inline HTML event handlers (onclick="..." in
// index.html and in generated template strings).
window.closeModal = closeModal;
window.closeTestPanel = closeTestPanel;
window.handleNav = handleNav;
window.openTestPanel = openTestPanel; // testsim-runtime.js's patchPanelOpeners()
// monkey-patches this (see applyPendingSheetAfterDiscard in editor-core.js for why
// callers go through window.openTestPanel() rather than the bare function) - it
// needs the real function bound here first, or it wraps undefined.
window.toggleActionMenu = toggleActionMenu;
window.toggleTestPanel = toggleTestPanel;
window.update = update; // testsim-runtime.js monkey-patches this; every
// cross-module caller goes through window.update() to see that patch.

export {
  closeTestPanel,
  getCountdownEvents,
  handleNav,
  keepActiveClassVisible,
  openModal,
  openTestPanel,
  setOverlayVisible,
  syncTestToolbar,
  toggleTestPanel
};
