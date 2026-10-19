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

const TABS = [
  { id: 'today', icon: 'home' },
  { id: 'week', icon: 'calendar' },
  { id: 'tools', icon: 'grid' }
];
const today = () => (window.MANUALLY_TEST && Number.isFinite(window.TEST_DAY) ? window.TEST_DAY : new Date().getDay());

function show(id) {
  document.body.dataset.tab = id;
  nav.select(id);
  if (id === 'today') {
    state.viewDay = today();
    // Today over: 今天 goes on to the next school day's every time it's shown.
    state.autoAdvancedAfterFinishedDay = null;
  }
  // 課表 opens on the coming school week.
  if (id === 'week') state.viewWeek = null;
  state.lastListKey = '';
  if (id === 'tools') renderTools();
  else window.update?.();
}

// Through the kit's module, each with a fallback: an older kit on a phone,
// or a test's stand-in, without them.
const has = name => {
  try {
    return typeof kit[name] === 'function';
  } catch {
    return false;
  }
};
const nav = has('tabBar') ? kit.tabBar({ tabs: TABS.map(x => ({ ...x, label: t(`tab.${x.id}`) })), onSelect: (id, { again }) => !again && show(id), hash: id => `#${id}` }) : { select() {} };
if (has('topActions')) kit.topActions(orbitSession);
// Every tab but the first opens on the kit's large title (今天 has none).
for (const x of TABS.slice(1)) {
  const panel = document.getElementById(`panel-${x.id}`);
  const title = kitUI.navTitle?.(t(`tab.${x.id}`));
  if (panel && title) panel.prepend(title);
}
// A link to another tab (今天's 全部 → 課表).
document.addEventListener('click', event => {
  const go = event.target instanceof Element && event.target.closest('[data-go]');
  if (go && TABS.some(x => x.id === go.dataset.go)) show(go.dataset.go);
});
const start = (location.hash || '').slice(1);
show(TABS.some(x => x.id === start) ? start : 'today');
