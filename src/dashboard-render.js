// ---- src/dashboard-render.js ----
// DOM rendering for the schedule list (not the live "now" card - that's
// dashboard.js) and viewport-driven layout fitting (title sizing, accordion).
import { WEEKDAY_LABELS } from './constants.js';
import { state } from './state.js';
import { keepActiveClassVisible, openModal } from './dashboard.js';
import { openEditorFold } from './editor-core.js';
import { getNextSchoolDay, parseTime, processSplitName } from './schedule.js';
import { t } from './strings.js';
import { subjectIcon } from './subjects.js';

// Updates the simulation play/pause button and indicator. (Simulator controls
// change the displayed clock only - never the saved schedule data.)
function syncTestPlayPauseUi() {
  const btn = document.getElementById('test-play-pause-btn');
  const indicator = document.getElementById('sim-indicator');
  const exitButton = document.getElementById('test-exit-btn');

  if (!btn || !indicator) return;

  const { text, active, indicatorVisible } = !window.MANUALLY_TEST
    ? { text: t('testsim.start'), active: false, indicatorVisible: false }
    : window.IS_SIMULATING
      ? { text: t('testsim.pause'), active: true, indicatorVisible: true }
      : { text: t('testsim.resume'), active: false, indicatorVisible: false };

  btn.textContent = text;
  btn.classList.toggle('active', active);
  indicator.style.display = indicatorVisible ? 'inline-flex' : 'none';

  if (exitButton) {
    exitButton.disabled = false;
    exitButton.style.opacity = '1';
  }
}

// Keeps only one editor accordion section open at a time.
(function initEditorAccordion() {
  const sheet = document.getElementById('editor-sheet');

  if (!sheet) return;

  sheet.querySelectorAll('details.editor-fold').forEach(det => {
    const summary = det.querySelector('.editor-fold-summary');

    if (summary) {
      summary.addEventListener('click', event => {
        if (!sheet.classList.contains('is-layered')) return;

        // In layered mode, the active layer should stay open.
        // Prevent the native <details> close/reopen flash.
        if (det.classList.contains('active')) {
          event.preventDefault();
        }
      });
    }

    det.addEventListener('toggle', () => {
      if (sheet.classList.contains('is-layered')) {
        if (det.open && !det.classList.contains('active')) openEditorFold(det.id);
        else if (!det.open && det.classList.contains('active')) det.open = true;
        return;
      }
      if (!det.open) return;

      sheet.querySelectorAll('details.editor-fold').forEach(other => {
        if (other !== det) other.open = false;
      });
    });
  });
})();
// Marks real user input the instant it starts, not only once a 'scroll' event eventually
// fires — see the comment on keepActiveClassVisible. There is no manual-scroll correction
// here at all: the list's scrollable bounds are always the browser's own native bounds, so
// there is nothing for this code to enforce beyond what iOS/desktop scrolling already does.
(function initScheduleScrollInputTracking() {
  const list = document.getElementById('schedule-list');

  if (!list) return;

  ['pointerdown', 'touchstart', 'wheel'].forEach(type => {
    list.addEventListener(
      type,
      () => {
        state.userScrolledDuringAlign = true;
      },
      { passive: true }
    );
  });
})();

// Press feedback for the class cards: a live, held-state size change, not a
// canned one-shot animation - grows the finger's card (.is-pressed), eases
// back the instant it lifts, tracking the actual press in real time
// exactly the way the day-nav buttons' own :active does (see .nav-item in
// styles.css). A separate fixed-length "replay the tap" animation was
// tried here first (triggered on the 'click' event, i.e. necessarily after
// the finger had already lifted) and it was never going to feel immediate
// no matter how short it ran, because it always started after the physical
// gesture was already over rather than during it - a structural lag a
// shorter duration can't fix.
//
// Still JS-driven rather than a bare CSS :active rule: on iOS Safari
// specifically, :active on an element with a backdrop-filter has a history
// of failing to composite in time for a tap this quick (see .nav-item's own
// comment on the same issue) - .is-pressed, held for exactly as long as the
// finger is actually down, is the reliable version of the same state.
//
// Applying .is-pressed is NOT immediate on pointerdown, on purpose: a
// touch that's about to become a scroll starts with exactly the same
// pointerdown a tap does, and the 'scroll' event that used to be this
// code's only defense against that doesn't fire until the browser has
// already recognized real movement - a real, visible gap in which the
// card had already popped larger for a gesture that was never a tap at
// all (reported as "cards grow just from scrolling, not clicking").
// PRESS_DELAY_MS holds off actually applying the class until a touch has
// had a moment to prove it isn't the start of a scroll; MOVE_THRESHOLD_PX
// cancels it outright the instant the pointer moves enough to look like a
// drag rather than a stationary press, whether that happens before or
// after the delay elapses. A tap doesn't feel late from this: the delay is
// far under normal press duration, and a real scroll gesture (which moves
// well past the threshold within single-digit milliseconds) never shows
// the grow at all, exactly as intended.
//
// One delegated listener rather than per-row ones: renderList() rebuilds
// every card from scratch on each update, so anything bound to a row would
// have to be re-bound several times a minute.
(function initSchedulePressFeedback() {
  const list = document.getElementById('schedule-list');

  if (!list) return;

  const PRESS_DELAY_MS = 80;
  const MOVE_THRESHOLD_PX = 8;

  let pressedRow = null;
  let pendingRow = null;
  let pendingTimer = 0;
  let activePointerId = null;
  let startX = 0;
  let startY = 0;

  const release = () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = 0;
    }
    pendingRow = null;
    activePointerId = null;
    if (!pressedRow) return;
    pressedRow.classList.remove('is-pressed');
    pressedRow = null;
  };
  const commitPress = () => {
    pendingTimer = 0;
    if (!pendingRow) return;
    pressedRow = pendingRow;
    pendingRow = null;
    pressedRow.classList.add('is-pressed');
  };

  list.addEventListener(
    'pointerdown',
    event => {
      const row = event.target instanceof Element ? event.target.closest('.row') : null;
      if (!row) return;
      release();
      pendingRow = row;
      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      pendingTimer = setTimeout(commitPress, PRESS_DELAY_MS);
    },
    { passive: true }
  );
  // Cancels a still-pending press before its delay even elapses, or backs
  // an already-applied one back out - either way, movement past the
  // threshold means this was never a stationary tap.
  list.addEventListener(
    'pointermove',
    event => {
      if (!pendingRow && !pressedRow) return;
      if (event.pointerId !== activePointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (dx * dx + dy * dy > MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) release();
    },
    { passive: true }
  );
  // Released on anything that ends the press, including ones that never
  // reach the list itself: a finger lifted after dragging off the card, a
  // scroll turning the touch into a pan (pointercancel), or the sheet the
  // tap opened stealing the pointer.
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type =>
    window.addEventListener(type, release, { passive: true })
  );
  list.addEventListener('scroll', release, { passive: true });
})();

/* Dashboard sizing and accessible list rendering. */
// Shrinks el's font-size (assumed already single-line/nowrap with visible
// overflow) to fit within `available` px, binary-searching between minSize
// and defaultSize; leaves it at defaultSize if that already fits. Shared by
// fitNowTitleText (the "now playing" title) and dashboard.js's countdown
// event name fit.
function shrinkFontToFit(el, available, defaultSize, minSize) {
  el.style.fontSize = defaultSize + 'px';
  if (el.scrollWidth <= available + 1) return;
  let lo = minSize,
    hi = defaultSize,
    best = minSize;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    el.style.fontSize = mid + 'px';
    if (el.scrollWidth <= available + 1) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  el.style.fontSize = Math.floor(best) + 'px';
}
// The card's title: one line at its full size, shrunk as far as 24px for a
// long name; a name still too long (族群、性別與國家的歷史 beside the icon)
// on the second line drawn for it (.is-two: at 24px, ending in an ellipsis
// only past that), never cut short on one.
function fitNowTitleText() {
  const el = document.getElementById('now-name');
  if (!el) return;
  el.style.fontSize = '';
  el.classList.remove('is-two');
  const width = el.clientWidth;
  // Hidden (the sign-in screen is still up): fitted once it has a size (below).
  if (!width || el.scrollWidth <= width + 1) return;
  const size = parseFloat(getComputedStyle(el).fontSize) || 34;
  const min = Math.min(size, 24);
  shrinkFontToFit(el, width, size, min);
  if (el.scrollWidth > width + 1) {
    el.style.fontSize = min + 'px';
    el.classList.add('is-two');
  }
}
function createMetaChip(text, cls = '') {
  const span = document.createElement('span');
  span.className = 'meta-chip ' + cls;
  span.textContent = text;
  return span;
}
// The day's named break that sits wholly between two classes, if any.
function breakBetween(end, start) {
  const from = parseTime(end);
  const to = parseTime(start);
  return (state.applicationData.breakTimes || []).find(b => b.name && b.start && b.end && parseTime(b.start) >= from && parseTime(b.end) <= to && parseTime(b.end) > parseTime(b.start));
}
function renderList(week, curIdx, nxtIdx, curDay, isDayFinished) {
  const list = document.getElementById('schedule-list');
  if (!list) return;
  list.classList.remove('animate-list');
  void list.offsetWidth;
  list.classList.add('animate-list');
  const tomorrow = getNextSchoolDay(curDay);
  document.querySelectorAll('.nav-item').forEach(btn => {
    const day = parseInt(btn.dataset.day, 10);
    btn.classList.toggle('active', day === state.viewDay);
    btn.classList.toggle('is-today', day === curDay);
    btn.classList.toggle('is-tomorrow', isDayFinished && day === tomorrow);
  });

  list.innerHTML = '';
  const rows = state.runtimeSchedule[state.viewDay] || [];
  // 今天: the classes still to come first, what's over below them under its
  // own line (the rest of the day within reach without scrolling past it).
  const ahead = [];
  const done = [];
  rows.forEach((c, i) => {
    const isToday = state.viewDay === (window.MANUALLY_TEST ? window.TEST_DAY : curDay);
    const info = processSplitName(c, week);
    const isNow = isToday && i === curIdx;
    const isNext = isToday && i === nxtIdx;
    const row = document.createElement('div');
    // Today's classes already over, faded.
    const upTo = curIdx >= 0 ? curIdx : nxtIdx >= 0 ? nxtIdx : isDayFinished ? rows.length : 0;
    const isPast = isToday && i < upTo;
    row.className = `row ${isNow ? 'is-now' : ''} ${isNext ? 'is-next' : ''} ${isPast ? 'is-past' : ''}`.replace(/\s+/g, ' ').trim();
    row.style.setProperty('--row-i', String(i));
    row.dataset.i = String(i * 2);
    row.tabIndex = 0;
    row.role = 'button';
    row.addEventListener('click', () => openModal(c));
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal(c);
      }
    });

    const badge = document.createElement('div');
    badge.className = 'period-badge';
    badge.textContent = String(i + 1);
    const content = document.createElement('div');
    content.className = 'content';
    const name = document.createElement('div');
    name.className = 'row-name';
    const nameText = document.createElement('span');
    nameText.className = 'row-name-text';
    nameText.textContent = info.n;
    name.append(nameText);
    if (info.label) {
      const labelWrap = document.createElement('span');
      labelWrap.className = 'row-name-week-label';
      labelWrap.innerHTML = info.label;
      name.append(labelWrap);
    }
    // The class on now and the next one say so where the period's number
    // goes, so the name keeps its whole line.
    if (isNow || isNext) {
      badge.classList.add('row-state');
      badge.textContent = isNow ? t('dashboard.inProgress') : t('dashboard.nextPeriod');
    }
    const meta = document.createElement('div');
    meta.className = 'row-meta';
    // The times in a column of their own (the timeline's), the chip kept for small screens' old layout.
    const time = document.createElement('div');
    time.className = 'row-time';
    const start = document.createElement('b');
    start.textContent = c.s;
    const end = document.createElement('span');
    end.textContent = c.e;
    time.append(start, end);
    meta.append(createMetaChip(`${c.s} – ${c.e}`, 'meta-time'));
    if (info.t) meta.append(createMetaChip(info.t, 'meta-teacher'));
    if (c.loc) meta.append(createMetaChip(c.loc, 'meta-location'));
    content.append(name, meta);
    // The subject's picture beside its name (src/subjects.js); the period's
    // number moves to the meta line, the state pill keeps the right.
    const icon = subjectIcon(info.n, 'row-icon');
    if (!isNow && !isNext) {
      badge.textContent = '';
      badge.classList.add('is-quiet');
    }
    // (The class on now and the next one: their pill says so, the line keeps its teacher and room whole.)
    if (!isNow && !isNext) meta.prepend(createMetaChip(t('dashboard.periodNumber', { number: i + 1 }), 'meta-period'));
    row.append(time, icon, content, badge);
    (isPast ? done : ahead).push(row);
    // A named break between this class and the next (打掃時間, 午休): a quiet
    // line between them, as a calendar's agenda shows a gap.
    const after = rows[i + 1];
    const gap = after && !isPast && breakBetween(c.e, after.s);
    if (gap) {
      const line = document.createElement('div');
      line.className = 'row-gap';
      line.dataset.i = String(i * 2 + 1);
      const label = document.createElement('span');
      label.textContent = gap.name;
      const span = document.createElement('span');
      span.textContent = `${gap.start}–${gap.end}`;
      line.append(label, span);
      ahead.push(line);
    }
  });
  const onToday = document.body?.dataset.tab === 'today';
  // 今天 shows the next school day's once today is over: its title says so.
  const title = document.getElementById('cx-list-title');
  if (onToday && title) {
    const shown = state.viewDay === (window.MANUALLY_TEST ? window.TEST_DAY : curDay);
    const ahead1 = (state.viewDay - curDay + 7) % 7 === 1;
    title.textContent = shown ? t('dashboard.todayClasses') : t('dashboard.dayClasses', { day: ahead1 ? t('dashboard.tomorrow') : WEEKDAY_LABELS[state.viewDay] });
  }
  if (onToday && done.length && ahead.length) {
    const head = document.createElement('div');
    head.className = 'row-done-head';
    head.textContent = t('dashboard.doneHeader', { count: done.length });
    list.append(...ahead, head, ...done);
  } else {
    // Any other day, or 課表: the day in order (what's over stays where it was).
    const order = [...done, ...ahead].sort((a, b) => (a.dataset.i ?? 0) - (b.dataset.i ?? 0));
    list.append(...order);
  }
  if (!rows.length) {
    const empty = document.createElement('div');
    // No time and no period: the agenda's three columns would put the words
    // in the time's 50px column, so this row is one column of its own.
    empty.className = 'row is-empty';
    empty.innerHTML = `<div class="content"><div class="row-name">${t('dashboard.noClassesToday')}</div><div class="row-meta"><span class="meta-chip">${t('dashboard.restOrStudy')}</span></div></div>`;
    list.appendChild(empty);
  }
  keepActiveClassVisible(
    list,
    isDayFinished,
    `${state.viewDay}-${curIdx}-${nxtIdx}-${isDayFinished}`
  );
}
window.addEventListener('resize', () => fitNowTitleText());
// The card changes size without a window resize (shown after the sign-in
// screen, the layout settling): fitted again then.
if (typeof ResizeObserver !== 'undefined') {
  let lastWidth = -1;
  const observer = new ResizeObserver(entries => {
    const width = Math.round(entries[0]?.contentRect.width || 0);
    if (!width || width === lastWidth) return;
    lastWidth = width;
    fitNowTitleText();
  });
  const hero = document.getElementById('cx-hero');
  if (hero) observer.observe(hero);
}

/* Test mode advances from one clock tick; the consolidated controller handles input changes. */
function mainClockTick() {
  if (window.MANUALLY_TEST && window.IS_SIMULATING) {
    window.TEST_TIME_SEC = ((window.TEST_TIME_SEC || 0) + 1) % 86400;
    const slider = document.getElementById('test-time-slider');
    if (slider) slider.value = Math.floor(window.TEST_TIME_SEC / 60);
  }
  window.update();
}

export {
  fitNowTitleText,
  mainClockTick,
  renderList,
  shrinkFontToFit,
  syncTestPlayPauseUi
};
