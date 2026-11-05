// ---- src/subject-picker.js ----
// A subject's icon and colour, picked (or put back to its own): a kit sheet
// over whatever opened it (the class's sheet, 編輯課表). The colours first,
// each named by the group that wears it by itself (國文 red, 社會 yellow…), so
// the pattern is on the screen where it's chosen; then the icons. A tap
// changes it at once, everywhere (saved with the timetable:
// applicationData.subjectColors / subjectIcons, so the Pass carries them);
// ✕ or a swipe closes it, and `changed` redraws what opened it.
import * as kitUI from '#kit/ui.mjs';
import { state } from './state.js';
import { COLOR_CHOICES, ICON_CHOICES, SWATCHES, colorKeyOf, groupOfColor, iconKeyOf, iconSvg, subjectLook, subjectTile } from './subjects.js';
import { saveData } from './data.js';
import { pushSyncSnapshot } from './sync.js';
import { el, button } from './ui.js';
import { t } from './strings.js';

export function openSubjectPicker(name, changed = () => {}) {
  const n = String(name || '').trim();
  if (!n) return null;
  // changes: { subjectColors: 'blue' } or { subjectIcons: null, … } (null: its own).
  const set = changes => {
    for (const [field, key] of Object.entries(changes)) {
      const map = { ...(state.applicationData[field] || {}) };
      if (key) map[n] = key;
      else delete map[n];
      state.applicationData[field] = map;
    }
    saveData(state.applicationData);
    pushSyncSnapshot();
    state.lastListKey = '';
    window.update?.();
    draw();
    changed();
  };
  const own = () => !!((state.applicationData.subjectIcons || {})[n] || (state.applicationData.subjectColors || {})[n]);
  const colors = el('div', 'cx-color-grid');
  const icons = el('div', 'cx-icon-grid');
  const reset = button('q-btn tinted block cx-pick-reset', () => set({ subjectIcons: null, subjectColors: null }), t('sheet.autoIcon'));
  function draw() {
    const color = subjectLook(n).color;
    const nowColor = colorKeyOf(n);
    const nowIcon = iconKeyOf(n);
    colors.replaceChildren(
      ...COLOR_CHOICES.map(key => {
        const b = button(`cx-color-pick${key === nowColor ? ' is-on' : ''}`, () => set({ subjectColors: key }), [el('span', 'cx-color-dot'), el('span', 'cx-color-name', t(`subjectGroup.${groupOfColor(key)}`))]);
        b.style.setProperty('--swatch', SWATCHES[key]);
        b.setAttribute('aria-label', t(`subjectGroup.${groupOfColor(key)}`));
        b.setAttribute('aria-pressed', String(key === nowColor));
        return b;
      })
    );
    icons.replaceChildren(
      ...ICON_CHOICES.map(key => {
        const b = button(`cx-icon-pick${key === nowIcon ? ' is-on' : ''}`, () => set({ subjectIcons: key }));
        b.innerHTML = iconSvg(key);
        b.setAttribute('aria-label', key);
        return b;
      })
    );
    icons.style.setProperty('--subject', color);
    reset.hidden = !own();
    picker?.head.firstChild.replaceWith(subjectTile(n, 'lg'));
  }
  let picker = null;
  draw();
  picker = kitUI.sheet({
    title: n,
    lead: subjectTile(n, 'lg'),
    body: [el('div', 'cx-sheet-body', [el('h3', 'cx-sheet-h', t('sheet.colorLabel')), colors, el('h3', 'cx-sheet-h', t('sheet.iconLabel')), icons, reset])],
    cls: 'cx-kit-sheet cx-pick-sheet',
    closeLabel: t('common.close')
  });
  return picker;
}
