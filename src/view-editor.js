// ---- src/view-editor.js ----
// The editor sheet's own look (its logic is editor-*.js): one page per
// part, the timetable first. On it, a day picker shows one day's periods at
// a time, each period by its number and start time beside its class picker,
// then rows into the other parts (科目與教師, 節次時間, 特殊時段, 倒數, AI).
// Each part's page has a ‹ 課表 back button in the head (editor-core.js
// ensureEditorBackButtons) and its name as a large title.
import * as kitUI from '#kit/ui.mjs';
import { WEEKDAYS_DISPLAY_ORDER } from './constants.js';
import { openEditorFold } from './editor-core.js';
import { el, fillGlyphs, row, tile } from './ui.js';
import { t } from './strings.js';

const sheet = document.getElementById('editor-sheet');
const grid = document.getElementById('schedule-grid');
const dayLabel = d => t(`tools.day${d}`);

// Only one page open at a time; the open one stays open.
sheet?.querySelectorAll('details.editor-fold').forEach(det => {
  det.querySelector('.editor-fold-summary')?.addEventListener('click', event => {
    if (sheet.classList.contains('is-layered') && det.classList.contains('active')) event.preventDefault();
  });
  det.addEventListener('toggle', () => {
    if (sheet.classList.contains('is-layered')) {
      if (det.open && !det.classList.contains('active')) openEditorFold(det.id);
      else if (!det.open && det.classList.contains('active')) det.open = true;
      return;
    }
    if (det.open) sheet.querySelectorAll('details.editor-fold').forEach(other => other !== det && (other.open = false));
  });
});

// ---- The timetable page: a day at a time ----
let day = [1, 2, 3, 4, 5, 6].includes(new Date().getDay()) ? new Date().getDay() : 1;
function showDay() {
  grid?.querySelectorAll('.schedule-day-row').forEach(r => r.classList.toggle('is-shown', Number(r.dataset.day) === day));
}
// Each day's periods by number and start time (the bell rows as they stand).
function numberRows() {
  if (!grid) return;
  const starts = [...document.querySelectorAll('#bell-list .bell-row .bell-start')].map(input => input.value);
  grid.querySelectorAll('.schedule-day-row').forEach(r => {
    const count = r.querySelectorAll('.period-select').length;
    const old = r.querySelector('.ed-nums');
    if (old?.childElementCount === count && old.dataset.starts === starts.join()) return;
    const nums = el('div', 'ed-nums', Array.from({ length: count }, (_, i) => el('span', '', [el('b', '', String(i + 1)), el('small', '', starts[i] || '')])));
    nums.dataset.starts = starts.join();
    nums.setAttribute('aria-hidden', 'true');
    if (old) old.replaceWith(nums);
    else r.insertBefore(nums, r.querySelector('.schedule-periods'));
  });
  showDay();
}
if (grid) {
  new MutationObserver(numberRows).observe(grid, { childList: true });
  document.getElementById('bell-list')?.addEventListener('change', numberRows);
  const days = document.getElementById('ed-days');
  if (days && kitUI.segmented) {
    const seg = kitUI.segmented(
      WEEKDAYS_DISPLAY_ORDER.map(d => ({ id: d, label: dayLabel(d) })),
      {
        value: day,
        label: t('editorTeachers.chooseWeekdayAriaLabel'),
        onChange: d => {
          day = d;
          showDay();
        }
      }
    );
    days.replaceChildren(seg);
  }
}

// ---- Rows into the other parts ----
const PARTS = [
  ['editor-fold-teachers', 'book', 'var(--q-indigo)', 'editorTeachers.subjectsAndTeachersFoldLabel'],
  ['editor-fold-bells', 'clock', 'var(--q-orange)', 'editorBackup.sectionBellTimes'],
  ['editor-fold-breaks', 'cup', 'var(--q-teal)', 'editorSchedule.specialTimeFoldLabel'],
  ['editor-fold-countdown', 'flag', 'var(--q-red)', 'editorBackup.sectionCountdownEvents'],
  ['editor-fold-ai', 'spark', 'var(--q-accent)', 'nlEdit.headingLabel']
];
document.getElementById('ed-parts')?.replaceChildren(...PARTS.map(([id, icon, color, key]) => row({ icon: tile(icon, color, 'sm'), title: t(key), onClick: () => openEditorFold(id) })));

fillGlyphs();
