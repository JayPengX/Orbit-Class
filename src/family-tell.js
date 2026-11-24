// ---- src/family-tell.js ----
// The next two weeks of classes as they're held (單/雙週, holidays, typhoon
// days off and 調課 applied), each period's subject, times and whether it's
// outdoors (體育), for Class's own 問 (class-ask.js). (Told to the other apps
// till 11-24, when that went with the thin cross-app features.)
import { dateKey } from './dates.js';
import { classesOn, getWeekType, processSplitName } from './schedule.js';

const OUT = /體育|球類|游泳|\bpe\b|physical education|sports?\b|swimming/i;
const HM = /^\d{1,2}:\d{2}$/;

export function familyDays(now = new Date(), n = 14) {
  const days = {};
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const week = getWeekType(d);
    days[dateKey(d)] = classesOn(d)
      .filter(c => HM.test(c.s || '') && HM.test(c.e || ''))
      .map(c => {
        const name = processSplitName(c, week).n;
        return { n: c.p + 1, name, from: c.s, to: c.e, ...(OUT.test(name) ? { out: true } : {}) };
      });
  }
  return days;
}
