// ---- src/tools.js ----
// 工具: changing the timetable. It leads with 我的課表 (the week in
// miniature, opening the editor), then a figure card straight into
// each part of the editor, then AI (a sentence, or a photo) and 分享 (the
// share key and the Pass). Drawn when the tab opens, and again when the timetable
// changes while it's on screen.
import { getWeekType, processSplitName } from './schedule.js';
import { subjectLook } from './subjects.js';
import { state } from './state.js';
import { getCountdownEvents } from './data.js';
import { el, button, glyph, row, section, tile } from './ui.js';
import { t } from './strings.js';

function openPart(id) {
  window.openEditor?.();
  if (id) window.openEditorFold?.(id);
}
// Opened, not typed into: no keyboard over the sheet until the field is tapped.
const openTransfer = focus => window.openTransferSheet?.(focus);

// 我的課表: the week in miniature, a coloured block per class (its first
// character), today's column lit; tapping it opens the editor on the week.
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
  for (let p = 0; p < periods; p += 1)
    for (const d of days) {
      const item = (schedule[d] || []).find(x => x.p === p);
      const name = item ? processSplitName(item, week).n || '' : '';
      const cell = el('span', `cx-mini-cell${name ? '' : ' is-empty'}${d === today ? ' is-today' : ''}`, name ? [...name][0] : '');
      if (name) cell.style.setProperty('--subject', subjectLook(name).color);
      grid.append(cell);
    }
  const card = button('cx-mini q-press', () => openPart('editor-fold-schedule'), [head, grid]);
  card.setAttribute('aria-label', `${t('tools.myTimetable')} · ${t('sync.editTitle')}`);
  return card;
}

let drawn = '';
function renderTools() {
  const box = document.getElementById('cx-tools');
  if (!box) return;
  const data = state.applicationData || {};
  const subjects = new Set(Object.values(data.teacherDB || {}).map(v => v?.[0]).filter(Boolean)).size;
  const breaks = (data.breakTimes || []).length;
  const events = getCountdownEvents().length;
  const key = `${JSON.stringify(state.runtimeSchedule)}|${subjects}|${breaks}|${events}|${t('tab.tools')}`;
  if (key === drawn && box.childElementCount) return;
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
  const parts = el('div', 'cx-parts', [
    figure('book', '#6366f1', subjects, t('editorTeachers.subjectsAndTeachersFoldLabel'), 'editor-fold-teachers'),
    figure('clock', '#f97316', (data.bellTimes || []).length, t('editorBackup.sectionBellTimes'), 'editor-fold-bells'),
    figure('cup', '#0d9488', breaks, t('editorSchedule.specialTimeFoldLabel'), 'editor-fold-breaks'),
    figure('flag', '#e5484d', events, t('editorBackup.sectionCountdownEvents'), 'editor-fold-countdown')
  ]);
  const way = (cls, icon, color, title, onClick) => {
    const pic = el('span', 'cx-cl-icon');
    pic.innerHTML = glyph(icon);
    const card = button(`cx-way-card ${cls} q-press`, onClick, [pic, el('strong', '', title)]);
    card.style.setProperty('--subject', color);
    return card;
  };
  const ai = el('div', 'cx-ways', [way('cx-way is-ai', 'spark', '#0284c7', t('tools.aiEditTitle'), () => openPart('editor-fold-schedule')), way('cx-way is-photo', 'camera', '#f97316', t('tools.photoTitle'), () => openTransfer('photo'))]);
  const share = el('div', 'q-rowcard', [row({ cls: 'cx-way is-key', icon: tile('key', 'var(--q-green)'), title: t('tools.keyTitle'), sub: t('tools.keySub'), onClick: () => openTransfer('key') })]);
  box.replaceChildren(weekCard(), section(t('tools.partsSection'), parts), section(t('tools.aiSection'), ai), section(t('tools.shareSection'), share));
}

// Kept current while it's on screen (a timetable arriving from the pass).
setInterval(() => {
  if (document.body.dataset.tab === 'tools' && !document.hidden) renderTools();
}, 1000);

export { renderTools };
