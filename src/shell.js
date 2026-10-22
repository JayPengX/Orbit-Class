// ---- src/shell.js ----
// The family's frame, as every Quadra app has it: the kit's glass buttons
// top-right (說明 and the Quadra Pass circle) and its tab bar, one question
// each: 今天 (the class now and next, src/view-today.js), 課表 (the week,
// this one or the next, and 調課, src/view-week.js) and 工具 (the timetable's
// parts, AI, sharing, src/tools.js).
import * as kit from '#kit/quadra.mjs';
import * as kitUI from '#kit/ui.mjs';
import { state } from './state.js';
import { orbitSession } from './sync.js';
import { t } from './strings.js';
import { renderTools } from './tools.js';
import { pickDay, schoolDays } from './view-today.js';
import { dateKey } from './dates.js';
import { dateOfDay } from './schedule.js';

const TABS = [
  { id: 'today', icon: 'home' },
  { id: 'week', icon: 'calendar' },
  { id: 'tools', icon: 'grid' }
];
const today = () => (window.MANUALLY_TEST && Number.isFinite(window.TEST_DAY) ? window.TEST_DAY : new Date().getDay());

let asked = null;
function show(id) {
  document.body.dataset.tab = id;
  nav.select(id);
  if (id === 'today') {
    // A day asked for (課表's day heads), else today.
    state.viewDate = asked;
    state.viewDay = asked ? asked.getDay() : today();
    // Today over: 今天 goes on to the next school day's every time it's shown (a day asked for stays).
    state.autoAdvancedAfterFinishedDay = asked ? today() : null;
    asked = null;
  }
  // 課表 opens on the coming school week.
  if (id === 'week') state.viewWeek = null;
  state.lastListKey = '';
  if (id === 'tools') renderTools();
  else window.update?.();
}

const nav = kit.tabBar({ tabs: TABS.map(x => ({ ...x, label: t(`tab.${x.id}`) })), onSelect: (id, { again }) => !again && show(id), hash: id => `#${id}` });
kit.topActions(orbitSession);
// Every tab but the first opens on the kit's large title (今天 has none).
for (const x of TABS.slice(1)) {
  const panel = document.getElementById(`panel-${x.id}`);
  if (panel) panel.prepend(kitUI.navTitle(t(`tab.${x.id}`)));
}
// A link to another tab (今天's 全部 → 課表).
document.addEventListener('click', event => {
  const go = event.target instanceof Element && event.target.closest('[data-go]');
  if (go && TABS.some(x => x.id === go.dataset.go)) show(go.dataset.go);
});
// 課表's day heads: 今天 on that day.
window.showDay = date => {
  asked = date;
  show('today');
};
// A swipe across 今天: the day either side on its strip.
kitUI.daySwipe(document.getElementById('panel-today'), dir => {
  if (window.MANUALLY_TEST) return false;
  const now = new Date();
  const d = kitUI.dayStep(schoolDays(now), dateKey(state.viewDate || dateOfDay(state.viewDay, now)), dir);
  return Boolean(d && (pickDay(d), true));
});
const start = (location.hash || '').slice(1);
show(TABS.some(x => x.id === start) ? start : 'today');
