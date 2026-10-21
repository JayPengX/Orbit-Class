// ---- src/tools.js ----
// 工具: changing the timetable. It leads with 我的課表 (its periods a week
// and the school day's span, and 編輯課表), then a figure card straight into
// each part of the editor, then AI (a sentence, or a photo) and 分享 (the
// share key and the Pass). Drawn when the tab opens, and again when the timetable
// changes while it's on screen.
import { pad2, parseTime } from './dates.js';
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

function figures() {
  const schedule = state.runtimeSchedule || {};
  let total = 0;
  let first = Infinity;
  let last = -Infinity;
  for (const d of [1, 2, 3, 4, 5, 6])
    for (const item of schedule[d] || []) {
      total += 1;
      first = Math.min(first, parseTime(item.s));
      last = Math.max(last, parseTime(item.e));
    }
  const clock = m => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
  return { total, span: total ? `${clock(first)}–${clock(last)}` : '' };
}

function hero() {
  const { total, span } = figures();
  const eyebrow = el('span', 'q-hc-eyebrow', [el('span', 'cx-glyph'), el('span', '', t('tools.myTimetable'))]);
  eyebrow.firstChild.innerHTML = glyph('calendar');
  const fig = (value, label) => el('span', 'cx-fig', [el('b', '', value), el('small', '', label)]);
  const big = total ? el('div', 'cx-figs-row', [fig(String(total), t('tools.perWeek')), fig(span, t('tools.schoolDay'))]) : el('strong', 'q-hc-title', t('tools.noClasses'));
  const edit = button('q-hc-btn', () => openPart('editor-fold-schedule'), t('sync.editTitle'));
  return el('section', 'q-hero-card cx-tools-hero', [eyebrow, big, el('div', 'q-hc-row', [edit])]);
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
  const ai = el('div', 'cx-ways', [way('cx-way is-ai', 'spark', '#0284c7', t('tools.aiEditTitle'), () => openPart('editor-fold-ai')), way('cx-way is-photo', 'camera', '#f97316', t('tools.photoTitle'), () => openTransfer('photo'))]);
  const share = el('div', 'q-rowcard', [row({ cls: 'cx-way is-key', icon: tile('key', 'var(--q-green)'), title: t('tools.keyTitle'), sub: t('tools.keySub'), onClick: () => openTransfer('key') })]);
  box.replaceChildren(hero(), section(t('tools.partsSection'), parts), section(t('tools.aiSection'), ai), section(t('tools.shareSection'), share));
}

// Kept current while it's on screen (a timetable arriving from the pass).
setInterval(() => {
  if (document.body.dataset.tab === 'tools' && !document.hidden) renderTools();
}, 1000);

export { renderTools };
