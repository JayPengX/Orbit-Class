// ---- src/shell.js ----
// The family's frame, as every Quadra app has it: the kit's app bar (the
// status on the left; 說明 and the Quadra Pass circle on the right) and its
// tab bar: 今天 (now, and today's classes), 課表 (any day's) and 工具 (editing,
// sharing and importing; src/tools.js). 今天 and 課表 are one panel: the
// list and the day switcher stay put, 今天 only pins the list to today.
import * as kit from '#kit/quadra.mjs';
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
  // 課表 shares 今天's panel.
  if (id === 'week') document.getElementById('panel-today').hidden = false;
  const title = document.getElementById('cx-list-title');
  if (id === 'today') {
    state.viewDay = today();
    if (title) title.textContent = t('dashboard.todayClasses');
  } else if (title) title.textContent = t('dashboard.timetable');
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
const start = (location.hash || '').slice(1);
show(TABS.some(x => x.id === start) ? start : 'today');

export { show as showTab };
