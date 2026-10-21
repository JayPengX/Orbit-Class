// ---- src/dashboard.js ----
// The per-second loop: update() works out the hour from the clock (the
// math is schedule-calc.js's), hands it to the views (src/view-today.js,
// src/view-week.js), keeps the notices booked and prunes countdowns that
// are over; plus the time simulation panel and the sheets' shared show/hide.
import { WEEKDAY_LABELS } from './constants.js';
import { state } from './state.js';
import { countdownsNotOver, saveData } from './data.js';
import { isEditorDirty } from './editor-backup.js';
import {
  closeEditor,
  closeTransferSheet,
  hasUnconsumedImportData,
  hideEditorDiscardConfirm,
  showEditorDiscardConfirm,
  showTransferDiscardConfirm
} from './editor-core.js';
import { closeAssignSheet } from './editor-teachers.js';
import { dateKey, pad2 } from './dates.js';
import { classesOn, classesOnDate, dateOfDay, getNextSchoolDay, getWeekType, processSplitName } from './schedule.js';
import { classStartingSoon, computeDashboardViewModel, heroView, noticeLead } from './schedule-calc.js';
import { notifyClassSoon, pushSyncSnapshot, scheduleClassNotices } from './sync.js';
import { bindSheetDragToDismiss } from './sheet-drag.js';
import { holidayOn } from './holidays.js';
import { openModal } from './view-sheet.js';
import { renderCountdowns, renderHero, renderTodayList } from './view-today.js';
import { renderWeek } from './view-week.js';
import { t } from './strings.js';

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
}
// Closes the manual time simulation panel.
function closeTestPanel() {
  state.testPanelOpen = false;
  setOverlayVisible('test-panel-overlay', 'debug-panel', false);
}
// Opens Test Mode directly after another UI has been safely closed.
function openTestPanel() {
  state.testPanelOpen = true;
  setOverlayVisible('test-panel-overlay', 'debug-panel', true);
}
bindSheetDragToDismiss('debug-panel', closeTestPanel);
bindSheetDragToDismiss('editor-sheet', () => closeEditor());
bindSheetDragToDismiss('transfer-sheet', () => closeTransferSheet());
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (document.getElementById('assign-sheet')?.classList.contains('show')) closeAssignSheet();
  else if (document.getElementById('editor-confirm-sheet')?.classList.contains('show'))
    hideEditorDiscardConfirm();
  else if (document.getElementById('debug-panel')?.classList.contains('show')) closeTestPanel();
  else if (document.getElementById('editor-sheet')?.classList.contains('show')) closeEditor();
  else if (document.getElementById('transfer-sheet')?.classList.contains('show'))
    closeTransferSheet();
});

// The next school day after `day`, for the card's foot once today is over.
// The next day with classes, past any national holiday (國慶日補假 on a
// Friday: Monday's first class, not Friday's).
function nextSchoolDay(now, curDay) {
  for (let ahead = 1; ahead <= 21; ahead++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
    const day = (curDay + ahead) % 7;
    // (Test Mode's simulated weekday walks the timetable, not dates.)
    const first = window.MANUALLY_TEST ? !holidayOn(date) && (state.runtimeSchedule[day] || [])[0] : classesOn(date)[0];
    if (!first) continue;
    return { label: ahead === 1 ? t('dashboard.tomorrow') : ahead < 7 ? WEEKDAY_LABELS[day] : `${date.getMonth() + 1}/${date.getDate()}`, first, week: getWeekType(date), day, date };
  }
  return null;
}

// 結束後自動刪除 on: a countdown whose last day is over leaves the list,
// saved and synced (not under an editor with changes not saved).
function prunePastCountdowns(now = new Date()) {
  const data = state.applicationData;
  if (!data?.pruneCountdowns || isEditorDirty()) return;
  const kept = countdownsNotOver(data.countdownEvents, dateKey(now));
  if (kept.length === (data.countdownEvents || []).length) return;
  data.countdownEvents = kept;
  saveData(data);
  pushSyncSnapshot();
}

let heroTarget = null;
function update() {
  if (!window.MANUALLY_TEST) prunePastCountdowns();
  const now = new Date();
  const simStatus = document.getElementById('sim-status');
  if (window.MANUALLY_TEST) {
    const h = Math.floor((window.TEST_TIME_SEC || 0) / 3600),
      m = Math.floor(((window.TEST_TIME_SEC || 0) % 3600) / 60),
      s = (window.TEST_TIME_SEC || 0) % 60;
    now.setHours(h, m, s, 0);
    if (simStatus) simStatus.textContent = window.IS_SIMULATING ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : '';
  } else if (simStatus) simStatus.textContent = '';
  const curDay = window.MANUALLY_TEST ? window.TEST_DAY : now.getDay();
  const week = getWeekType();
  renderCountdowns();

  // A day with no classes is never the one 今天 lists: the next day that has
  // some instead (only when any day has classes at all; a day the timetable
  // leaves empty can hold a class moved there by 調課).
  const hasAnyClasses = Object.values(state.runtimeSchedule).some(rows => (rows || []).length > 0);
  const viewRows = window.MANUALLY_TEST ? state.runtimeSchedule[state.viewDay] : classesOnDate(dateOfDay(state.viewDay, now));
  if (hasAnyClasses && !(viewRows || []).length) state.viewDay = getNextSchoolDay(state.viewDay);

  // A national holiday: no classes today, whatever the timetable says (Test Mode's simulated days as they are).
  const holiday = window.MANUALLY_TEST ? null : holidayOn(now);
  const todaySchedule = window.MANUALLY_TEST ? state.runtimeSchedule[curDay] : classesOn(now);
  const nextDay = nextSchoolDay(now, curDay);
  const viewModel = computeDashboardViewModel({ now, curDay, week, todaySchedule, breakTimes: state.applicationData.breakTimes });

  // Today over, or a national holiday: 今天 lists the next school day's
  // classes (once: a day tapped stays).
  const dayDone = viewModel.isDayFinished || Boolean(holiday);
  if (!dayDone && state.autoAdvancedAfterFinishedDay === curDay) state.autoAdvancedAfterFinishedDay = null;
  if (dayDone && state.viewDay === curDay && state.autoAdvancedAfterFinishedDay !== curDay) {
    state.viewDay = window.MANUALLY_TEST ? getNextSchoolDay(curDay) : (nextDay?.day ?? getNextSchoolDay(curDay));
    state.autoAdvancedAfterFinishedDay = curDay;
  }

  const hero = heroView(viewModel, { now, week, todaySchedule, nextDay, holiday });
  // What a tap on the card opens: the class it names, else the one along its
  // foot (today's next, or the next school day's first); none, not a button.
  const today = window.MANUALLY_TEST ? null : new Date();
  heroTarget = viewModel.curIdx >= 0 ? { c: todaySchedule[viewModel.curIdx], date: today } : viewModel.nxtIdx >= 0 && viewModel.isSchoolDay && !viewModel.isDayFinished ? { c: todaySchedule[viewModel.nxtIdx], date: today } : nextDay?.first && hero.foot?.name ? { c: nextDay.first, date: window.MANUALLY_TEST ? null : nextDay.date } : null;
  setHeroTappable(Boolean(heroTarget));
  renderHero(hero, week);

  // As the break before a class starts (five minutes before, after a long
  // one): a notice (once per class; not in test mode), only in its own
  // minute: opened later, the card already says how long is left.
  if (!window.MANUALLY_TEST) {
    const soon = classStartingSoon({ now, week, todaySchedule });
    if (soon?.due) notifyClassSoon({ ...soon, lead: soon.left });
    // The coming week's, for the Worker (again every ten minutes).
    const slot = Math.floor(now.getTime() / 600_000);
    if (slot !== state.classPushSlot) {
      state.classPushSlot = slot;
      scheduleClassNotices(weekClasses(now));
    }
  }

  // The lists are drawn again only when what they show moved on (the period,
  // the day, the week chosen, the tab, the minute on 課表's grid).
  const tab = document.body.dataset.tab;
  const minute = tab === 'week' ? Math.floor(now.getTime() / 60_000) : '';
  const listKey = `${window.MANUALLY_TEST ? 'T' : 'R'}-${now.toDateString()}-${curDay}-${week}-${viewModel.curIdx}-${viewModel.nxtIdx}-${viewModel.activeBreakName}-${viewModel.isDayFinished}-${state.viewDay}-${state.viewWeek}-${tab}-${hero.through}-${minute}`;
  if (state.lastListKey !== listKey) {
    state.lastListKey = listKey;
    if (tab === 'week') renderWeek(now);
    else renderTodayList({ week, through: hero.through, curDay, now });
  }
}

// Every class from now to a week ahead: { at (its notice's time, noticeLead), lead, tag, name, meta }.
function weekClasses(now) {
  const out = [];
  for (let d = 0; d < 7 && out.length < 60; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const week = getWeekType(date);
    const day = dateKey(date);
    const list = classesOn(date);
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

// The sheets' shared show / hide: .show on the sheet and its dimming, a class on the page while open.
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
// The time simulation's start / pause button and its line (the clock it
// shows only; never the saved timetable).
function syncTestPlayPauseUi() {
  const btn = document.getElementById('test-play-pause-btn');
  const indicator = document.getElementById('sim-indicator');
  if (!btn || !indicator) return;
  const { text, active } = !window.MANUALLY_TEST ? { text: t('testsim.start'), active: false } : window.IS_SIMULATING ? { text: t('testsim.pause'), active: true } : { text: t('testsim.resume'), active: false };
  btn.textContent = text;
  btn.classList.toggle('active', active);
  indicator.style.display = active ? '' : 'none';
}
// Every second: the simulated clock moves on while it runs, then update().
function mainClockTick() {
  if (window.MANUALLY_TEST && window.IS_SIMULATING) {
    window.TEST_TIME_SEC = ((window.TEST_TIME_SEC || 0) + 1) % 86400;
    const slider = document.getElementById('test-time-slider');
    if (slider) slider.value = Math.floor(window.TEST_TIME_SEC / 60);
  }
  window.update();
}

// Exposed on window for inline HTML event handlers (onclick="..." in
// index.html).
window.closeTestPanel = closeTestPanel;
window.openTestPanel = openTestPanel; // testsim-runtime.js's patchPanelOpeners()
// monkey-patches this (see applyPendingSheetAfterDiscard in editor-core.js for why
// callers go through window.openTestPanel() rather than the bare function) - it
// needs the real function bound here first, or it wraps undefined.
window.toggleTestPanel = toggleTestPanel;
// The hero card opens the class it shows (as a row does).
const hero = document.getElementById('cx-hero');
const openHero = () => heroTarget && openModal(heroTarget.c, { date: heroTarget.date });
function setHeroTappable(on) {
  if (!hero || hero.hasAttribute('role') === on) return;
  if (on) hero.setAttribute('role', 'button');
  else hero.removeAttribute('role');
  hero.tabIndex = on ? 0 : -1;
  hero.classList.toggle('is-still', !on);
}
hero?.addEventListener('click', openHero);
hero?.addEventListener('keydown', event => (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), openHero()));
window.update = update; // testsim-runtime.js monkey-patches this; every
// cross-module caller goes through window.update() to see that patch.

export { closeTestPanel, mainClockTick, openTestPanel, setOverlayVisible, syncTestPlayPauseUi, toggleTestPanel };
