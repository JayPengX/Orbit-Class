// ---- src/tools.js ----
// 工具: the timetable at a glance, then the ways to change it. A card with
// the week as a small grid (today's column lit, the class on now filled) and
// three figures (subjects, classes a week, the school day's span), the
// editor's button and a shortcut to each of its parts; then the two ways in
// from elsewhere (a photo read by AI, a classmate's share key) as two tiles.
// Drawn each time the tab opens, from the saved timetable.
import { state } from './state.js';
import { getWeekType, processSplitName } from './schedule.js';
import { isSyncViewer } from './sync.js';
import { t } from './strings.js';

const DAYS = [1, 2, 3, 4, 5, 6];
const PARTS = [
  ['editor-fold-teachers', 'tools.partTeachers'],
  ['editor-fold-bells', 'tools.partPeriods'],
  ['editor-fold-breaks', 'tools.partBreaks'],
  ['editor-fold-countdown', 'tools.partCountdown']
];

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}
function button(cls, onClick, children = []) {
  const node = el('button', cls);
  node.type = 'button';
  node.addEventListener('click', onClick);
  node.append(...children);
  return node;
}
const minutes = value => {
  const [h, m] = String(value || '').split(':').map(Number);
  return h * 60 + m;
};
function openPart(id) {
  window.openEditor?.();
  if (id !== 'editor-fold-schedule') window.openEditorFold?.(id);
}
function openTransfer(focus) {
  window.openTransferSheet?.();
  if (focus === 'photo') document.getElementById('ocr-import-box')?.scrollIntoView({ block: 'center' });
  else document.getElementById('quadra-key')?.focus();
}

function weekCard() {
  const schedule = state.runtimeSchedule || {};
  const week = getWeekType();
  const now = new Date();
  const testing = window.MANUALLY_TEST;
  const today = testing && Number.isFinite(window.TEST_DAY) ? window.TEST_DAY : now.getDay();
  const nowMin = testing ? Math.floor((window.TEST_TIME_SEC || 0) / 60) : now.getHours() * 60 + now.getMinutes();
  const days = DAYS.filter(d => d < 6 || (schedule[d] || []).length);
  const rows = Math.max(0, ...days.map(d => (schedule[d] || []).length));
  const subjects = new Set();
  let total = 0;
  let first = Infinity;
  let last = -Infinity;
  for (const d of days)
    for (const item of schedule[d] || []) {
      total += 1;
      subjects.add(processSplitName(item, week).n);
      first = Math.min(first, minutes(item.s));
      last = Math.max(last, minutes(item.e));
    }
  const clock = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const card = el('section', 'cx-tl-card');
  const figures = el('div', 'cx-tl-figures');
  const figure = (value, label) => {
    const box = el('div', 'cx-tl-figure');
    box.append(el('b', '', value), el('span', '', label));
    return box;
  };
  figures.append(
    figure(String(subjects.size), t('tools.subjects')),
    figure(String(total), t('tools.perWeek')),
    figure(total ? `${clock(first)}–${clock(last)}` : '—', t('tools.schoolDay'))
  );

  const grid = el('div', 'cx-tl-grid');
  grid.style.setProperty('--days', String(days.length));
  grid.append(el('span', 'cx-tl-corner'));
  for (const d of days) grid.append(el('span', `cx-tl-day${d === today ? ' is-today' : ''}`, t(`tools.day${d}`)));
  for (let r = 0; r < rows; r += 1) {
    grid.append(el('span', 'cx-tl-num', String(r + 1)));
    for (const d of days) {
      const item = (schedule[d] || [])[r];
      const on = item && d === today && nowMin >= minutes(item.s) && nowMin < minutes(item.e);
      const cell = el('span', `cx-tl-cell${item ? '' : ' is-empty'}${d === today ? ' is-today' : ''}${on ? ' is-now' : ''}`);
      if (item) {
        const name = processSplitName(item, week).n || '';
        cell.textContent = [...name].slice(0, 2).join('');
        cell.title = name;
      }
      grid.append(cell);
    }
  }
  if (!rows) grid.append(el('p', 'cx-tl-empty', t('tools.noClasses')));

  const viewer = isSyncViewer();
  const edit = button('cx-tl-edit', () => openPart('editor-fold-schedule'), [el('span', '', t('sync.editTitle'))]);
  edit.disabled = viewer;
  const parts = el('div', 'cx-tl-parts');
  for (const [id, key] of PARTS) {
    const chip = button('cx-tl-part', () => openPart(id), [el('span', '', t(key))]);
    chip.disabled = viewer;
    parts.append(chip);
  }
  card.append(figures, grid, edit, parts);
  return card;
}

function wayTile(kind, icon, title, sub) {
  const svg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
  const iconBox = el('span', 'cx-way-icon');
  iconBox.innerHTML = svg;
  const words = el('span', 'cx-way-words');
  words.append(el('strong', '', title), el('small', '', sub));
  return button(`cx-way is-${kind}`, () => openTransfer(kind), [iconBox, words]);
}

function renderTools() {
  const box = document.getElementById('cx-tools');
  if (!box) return;
  const ways = el('div', 'cx-ways');
  ways.append(
    wayTile('photo', '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/>', t('tools.photoTitle'), t('tools.photoSub')),
    wayTile('key', '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2"/>', t('tools.keyTitle'), t('tools.keySub'))
  );
  box.replaceChildren(
    el('h2', 'cx-section', t('tools.myTimetable')),
    weekCard(),
    el('h2', 'cx-section', t('tools.bringIn')),
    ways
  );
}

// Kept current while it's on screen (the class on now moves along).
setInterval(() => {
  if (document.body.dataset.tab === 'tools' && !document.hidden) renderTools();
}, 60_000);

export { renderTools };
