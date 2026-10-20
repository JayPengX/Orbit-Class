// ---- src/bring.js ----
// 明天要帶: the night before, what tomorrow's classes need brought along
// (PE clothes, swim gear, art supplies, an instrument, class materials),
// read from the subjects' names, so there is nothing to set up. Shown on 今天
// (src/view-today.js) from the evening on, until midnight; tomorrow is the
// real next day (the Sunday night before Monday counts), 調課 and holidays
// applied.
import { WEEKDAY_LABELS } from './constants.js';
import { classesOn, getWeekType, processSplitName } from './schedule.js';
import { subjectLook } from './subjects.js';

const BRING_FROM_HOUR = 17;
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
function bringList(classes, week) {
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
