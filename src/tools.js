// ---- src/tools.js ----
// 工具: changing the timetable. It leads with 我的課表 (the week in
// miniature, opening the editor), then a figure card straight into
// each part of the editor, then AI (a sentence, or a photo) and 分享 (the
// share key and the Pass). Drawn when the tab opens, and again when the timetable
// changes while it's on screen.
import { getWeekType, processSplitName } from './schedule.js';
import { shortNames, subjectLook } from './subjects.js';
import { state } from './state.js';
import { getCountdownEvents } from './data.js';
import { el, button, fitText, glyph, row, section, tile } from './ui.js';
import { t } from './strings.js';
import { clock, currentLeg, flightNo, focusLeft, loadFocus } from './flight-store.js';
import * as kit from '#kit/orbit.mjs';

function openPart(id) {
  window.openEditor?.();
  if (id) window.openEditorFold?.(id);
}
// Opened, not typed into: no keyboard over the sheet until the field is tapped.
const openTransfer = focus => window.openTransferSheet?.(focus);

// 我的課表: the week in miniature, a coloured block per class with the
// 課表 tab's short name (國語文, 民主; four characters on two lines), today's column lit; tapping it opens the editor on the week.
function weekCard() {
  const schedule = state.runtimeSchedule || {};
  const days = [1, 2, 3, 4, 5, ...((schedule[6] || []).length ? [6] : [])];
  const periods = Math.max(0, ...days.flatMap(d => (schedule[d] || []).map(x => x.p + 1)));
  const today = new Date().getDay();
  const week = getWeekType(new Date());
  const head = el('span', 'cx-mini-head', [el('span', 'cx-mini-title', t('tools.myTimetable')), el('span', 'cx-mini-edit', t('common.edit'))]);
  if (!periods) return button('cx-mini q-press', () => openPart('editor-fold-schedule'), [head, el('strong', 'cx-mini-none', t('tools.noClasses'))]);
  const grid = el('span', 'cx-mini-grid');
  grid.style.setProperty('--days', String(days.length));
  for (const d of days) grid.append(el('span', `cx-mini-day${d === today ? ' is-today' : ''}`, t(`tools.day${d}`)));
  const short = shortNames(days.flatMap(d => (schedule[d] || []).map(x => processSplitName(x, week).n || '')));
  for (let p = 0; p < periods; p += 1)
    for (const d of days) {
      const item = (schedule[d] || []).find(x => x.p === p);
      const name = item ? processSplitName(item, week).n || '' : '';
      const chars = [...(short.get(name) || name)];
      const latin = /^[ -~]+$/.test(name);
      const pair = chars.length === 4 && !latin;
      const size = pair ? ' is-pair' : latin && chars.length > 3 ? ' is-latin' : chars.length > 2 ? ' is-long' : '';
      const cell = el('span', `cx-mini-cell${name ? size : ' is-empty'}${d === today ? ' is-today' : ''}`, pair ? [el('span', '', chars.slice(0, 2).join('')), el('span', '', chars.slice(2).join(''))] : chars.join(''));
      if (name) cell.style.setProperty('--subject', subjectLook(name).color);
      grid.append(cell);
    }
  const card = button('cx-mini q-press', () => openPart('editor-fold-schedule'), [head, grid]);
  requestAnimationFrame(() => fitText(grid.querySelectorAll('.cx-mini-cell.is-latin')));
  card.setAttribute('aria-label', `${t('tools.myTimetable')} · ${t('sync.editTitle')}`);
  return card;
}

// 專注飛行 (src/flight.js, loaded on the tap): a card on the night sky; while a
// focus runs, its flight and the time left, kept current every second.
const openFlight = () => import('./flight.js').then(m => m.openFlight());
function flightLine(now = Date.now()) {
  const f = loadFocus();
  if (!f) return t('flight.toolsSub');
  return f.done ? flightNo(currentLeg(f).no) : `${flightNo(currentLeg(f).no)} · ${t('flight.left', { t: clock(focusLeft(f, now)) })}`;
}
function flightCard() {
  const pic = el('span', 'cx-cl-icon');
  pic.innerHTML = PLANE_GLYPH;
  // A flight's arc drawn on the card's right: where it took off, the plane on its way, where it lands.
  const arc = el('span', 'cx-fly-arc');
  arc.setAttribute('aria-hidden', 'true');
  arc.innerHTML = FLIGHT_ARC;
  const card = button('cx-fly-card q-press', openFlight, [pic, el('span', 'cx-fly-text', [el('strong', '', t('flight.title')), el('small', 'cx-fly-line', flightLine())]), arc]);
  card.addEventListener('pointerdown', () => import('./flight.js').then(m => m.warmFlights()), { once: true });
  return card;
}
const FLIGHT_ARC = '<svg viewBox="0 0 120 48"><path d="M6 42 C 34 4, 86 4, 114 42" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 4" stroke-linecap="round"/><circle cx="6" cy="42" r="3" fill="currentColor"/><circle cx="114" cy="42" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M60 8.5c.6 0 1 .6 1 1.4v3.3l5 3v1.4l-5-1.6v3l1.5 1.2v1.1L60 20.6l-2.5.7v-1.1L59 19v-3l-5 1.6v-1.4l5-3V9.9c0-.8.4-1.4 1-1.4z" transform="rotate(90 60 14.5)" fill="currentColor" class="cx-fly-plane"/></svg>';
const PLANE_GLYPH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.8c.9 0 1.5 1 1.5 2.2v5.1l7.7 4.6v2.1l-7.7-2.4v4.7l2.3 1.8v1.7L12 20.6l-3.8 1v-1.7l2.3-1.8v-4.7l-7.7 2.4v-2.1l7.7-4.6V4c0-1.2.6-2.2 1.5-2.2z"/></svg>';

// 加到行事曆 (src/calendar.js, loaded on the tap): the timetable in the phone's
// Calendar by subscription; on, a tap offers to stop it.
const calOn = () => kit.readStore?.('class.cal.v1')?.includes('url');
function calRow() {
  const r = row({
    cls: 'cx-way is-cal',
    icon: tile('calendar', 'var(--q-red)'),
    title: t('tools.calTitle'),
    sub: t(calOn() ? 'tools.calOn' : 'tools.calSub'),
    onClick: async () => {
      const cal = await import('./calendar.js');
      if (!calOn()) {
        r.querySelector('small').textContent = t('tools.calAdding');
        const ok = await cal.addCalendar();
        r.querySelector('small').textContent = t(ok ? 'tools.calOn' : 'tools.calFailed');
        return;
      }
      const stop = await kit.ask({ title: t('tools.calTitle'), body: t('tools.calStopBody'), ok: t('tools.calStop'), cancel: t('common.close'), danger: true });
      if (!stop) return;
      await cal.stopCalendar();
      r.querySelector('small').textContent = t('tools.calSub');
    }
  });
  return r;
}

let drawn = '';
function renderTools(again = false) {
  const box = document.getElementById('cx-tools');
  if (!box) return;
  const data = state.applicationData || {};
  const subjects = new Set(Object.values(data.teacherDB || {}).map(v => v?.[0]).filter(Boolean)).size;
  const breaks = (data.breakTimes || []).length;
  const events = getCountdownEvents().length;
  const key = `${JSON.stringify(state.runtimeSchedule)}|${subjects}|${breaks}|${events}|${t('tab.tools')}`;
  if (!again && key === drawn && box.childElementCount) return;
  drawn = key;
  // The parts as four figure cards (each its colour, its count large), the
  // two AI ways as two cards, the share key a row.
  const figure = (icon, color, n, title, fold) => {
    const pic = el('span', 'cx-cl-icon');
    pic.innerHTML = glyph(icon);
    const card = button('cx-part q-press', () => openPart(fold), [pic, el('b', 'cx-part-n', String(n)), el('span', 'cx-part-title', title)]);
    card.style.setProperty('--subject', color);
    return card;
  };
  const parts = el('div', 'cx-parts q-card', [
    figure('book', '#6366f1', subjects, t('editorTeachers.subjectsAndTeachersFoldLabel'), 'editor-fold-teachers'),
    figure('clock', '#f97316', (data.bellTimes || []).length, t('editorBackup.sectionBellTimes'), 'editor-fold-bells'),
    figure('cup', '#0d9488', breaks, t('editorSchedule.specialTimeFoldLabel'), 'editor-fold-breaks'),
    figure('flag', '#e5484d', events, t('editorBackup.sectionCountdownEvents'), 'editor-fold-countdown')
  ]);
  const way = (cls, icon, color, title, sub, onClick) => {
    const pic = el('span', 'cx-cl-icon');
    pic.innerHTML = glyph(icon);
    const card = button(`cx-way-card ${cls} q-press`, onClick, [pic, el('strong', '', title), el('small', '', sub)]);
    card.style.setProperty('--subject', color);
    return card;
  };
  const ai = el('div', 'cx-ways', [way('cx-way is-ai', 'spark', '#0284c7', t('tools.aiEditTitle'), t('tools.aiEditSub'), () => openPart('editor-fold-schedule')), way('cx-way is-photo', 'camera', '#f97316', t('tools.photoTitle'), t('tools.photoSub'), () => openTransfer('photo'))]);
  const share = el('div', 'q-rowcard', [row({ cls: 'cx-way is-key', icon: tile('key', 'var(--q-green)'), title: t('tools.keyTitle'), sub: t('tools.keySub'), onClick: () => openTransfer('key') }), calRow()]);
  // Two columns on a wide screen (.q-cols): the week beside the rest; one on a phone.
  box.classList.add('q-cols');
  box.replaceChildren(el('div', 'cx-tools-a', [weekCard()]), el('div', 'cx-tools-b', [section(t('flight.section'), flightCard()), section(t('tools.partsSection'), parts), section(t('tools.aiSection'), ai), section(t('tools.shareSection'), share)]));
}

// Kept current while it's on screen (a timetable arriving from the pass).
setInterval(() => {
  if (document.body.dataset.tab !== 'tools' || document.hidden) return;
  renderTools();
  const line = document.querySelector('#cx-tools .cx-fly-line');
  if (line) line.textContent = flightLine();
}, 1000);

export { renderTools };
