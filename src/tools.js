// ---- src/tools.js ----
// 工具: changing the timetable. It leads with 我的課表 (its periods a week
// and the school day's span, and 編輯課表), then rows straight into each
// part of the editor, then AI (a sentence, or a photo) and 分享 (the share
// key and the Pass). Drawn when the tab opens, and again when the timetable
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

const count = n => (n ? el('span', 'q-ritem-value', String(n)) : null);
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
  const parts = el('div', 'q-rowcard', [
    row({ icon: tile('book', 'var(--q-indigo)'), title: t('editorTeachers.subjectsAndTeachersFoldLabel'), end: count(subjects), onClick: () => openPart('editor-fold-teachers') }),
    row({ icon: tile('clock', 'var(--q-orange)'), title: t('editorBackup.sectionBellTimes'), end: count((data.bellTimes || []).length), onClick: () => openPart('editor-fold-bells') }),
    row({ icon: tile('cup', 'var(--q-teal)'), title: t('editorSchedule.specialTimeFoldLabel'), end: count(breaks), onClick: () => openPart('editor-fold-breaks') }),
    row({ icon: tile('flag', 'var(--q-red)'), title: t('editorBackup.sectionCountdownEvents'), end: count(events), onClick: () => openPart('editor-fold-countdown') })
  ]);
  const ai = el('div', 'q-rowcard', [
    row({ cls: 'cx-way is-ai', icon: tile('spark', 'var(--q-accent)'), title: t('tools.aiEditTitle'), sub: t('tools.aiEditSub'), onClick: () => openPart('editor-fold-ai') }),
    row({ cls: 'cx-way is-photo', icon: tile('camera', 'var(--q-orange)'), title: t('tools.photoTitle'), sub: t('tools.photoSub'), onClick: () => openTransfer('photo') })
  ]);
  const share = el('div', 'q-rowcard', [row({ cls: 'cx-way is-key', icon: tile('key', 'var(--q-green)'), title: t('tools.keyTitle'), sub: t('tools.keySub'), onClick: () => openTransfer('key') })]);
  box.replaceChildren(hero(), section(t('tools.partsSection'), parts), section(t('tools.aiSection'), ai), section(t('tools.shareSection'), share));
}

// Kept current while it's on screen (a timetable arriving from the pass).
setInterval(() => {
  if (document.body.dataset.tab === 'tools' && !document.hidden) renderTools();
}, 1000);

export { renderTools };
