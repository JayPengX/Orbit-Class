// ---- src/bring.js ----
// 明天要帶: the night before, what tomorrow's classes need brought along
// (PE clothes, swim gear, art supplies, an instrument, class materials),
// read from the subjects' names, so there is nothing to set up. Shown on 今天
// from the evening on, until midnight; tomorrow is the real next day (the
// Sunday night before Monday counts), 調課 and holidays applied.
import { WEEKDAY_LABELS } from './constants.js';
import { classesOn, getWeekType, processSplitName } from './schedule.js';
import { subjectLook, subjectTile } from './subjects.js';
import { t } from './strings.js';

export const BRING_FROM_HOUR = 17;
// Subject kind → the thing to bring (strings 'bring.<item>'). A subject that
// matches none brings nothing.
const SWIM = /游泳|swim/i;
const ITEMS = { pe: 'pe', art: 'art', music: 'music', 'life-tech': 'craft' };
export function bringItem(subject) {
  if (SWIM.test(subject)) return 'swim';
  return ITEMS[subjectLook(subject).key] || null;
}

// What to bring for a day's classes: one row per item, the first class that
// needs it; [{ item, subject }].
export function bringList(classes, week) {
  const seen = new Set();
  const out = [];
  for (const c of classes) {
    const subject = processSplitName(c, week).n;
    const item = bringItem(subject);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push({ item, subject });
  }
  return out;
}
// { day, items } for tomorrow when it is evening and tomorrow brings something, else null.
export function bringTomorrow(now) {
  if (now.getHours() < BRING_FROM_HOUR) return null;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const items = bringList(classesOn(date), getWeekType(date));
  return items.length ? { day: WEEKDAY_LABELS[date.getDay()], items } : null;
}

let drawn = '';
export function renderBring(now = new Date()) {
  const box = document.getElementById('cx-bring');
  if (!box) return;
  const plan = bringTomorrow(now);
  const key = plan ? `${t('bring.title')}|${plan.day}|${JSON.stringify(plan.items)}` : '';
  if (key === drawn) return;
  drawn = key;
  box.replaceChildren();
  if (!plan) return;
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const head = make('div', 'q-section-head');
  head.append(make('h2', 'cx-section', t('bring.title', { day: plan.day })));
  const card = make('div', 'cx-bring-card q-rowcard');
  for (const { item, subject } of plan.items) {
    const row = make('div', 'cx-bring-row q-ritem');
    const text = make('span', 'q-ritem-text');
    text.append(make('b', 'cx-bring-item q-ritem-title', t(`bring.${item}`)), make('small', 'cx-bring-for', subject));
    row.append(subjectTile(subject), text);
    card.append(row);
  }
  box.classList.add('q-section');
  box.append(head, card);
}
