// ---- src/nl-swap.js ----
// 調課 from the AI box, worked out right here (no AI request): a one-time
// swap of two dated periods, as a class's sheet or 課表's 新增調課 makes
// (src/swap.js). It reads the instruction before editor-nl-edit.js's
// clean-up turns 明天 into a weekday, since a 調課 needs the date itself.
//
//   明天第2節和第5節調課            → tomorrow, periods 2 and 5
//   10/23 第3節跟 10/30 第1節調課   → across weeks
//   下週三第一節與週五第四節對調    → dated, so a 調課, not the timetable
//   取消明天的調課                  → that day's swaps removed
//
// A swap with no date and no 調課 word ("週二第三節和週四第五節對調") is
// the weekly timetable's, left to nl-edit-local.js. Returns null when the
// instruction isn't a 調課, { error } when it is but can't be done, else
// { swaps } (the complete new list).
import { dateKey } from './dates.js';
import { t } from './strings.js';

const DIGITS = { 〇: 0, 零: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const DAYS = { 日: 0, 天: 0, 7: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
const RELATIVE = { 今天: 0, 今日: 0, 明天: 1, 明日: 1, 後天: 2, 后天: 2, 大後天: 3, 大后天: 3 };
const SWAP_WORD = /調課|换课|換課|對調|交換|互換|調換|互調/;
const CANCEL_WORD = /取消|撤銷|撤回|刪除|刪掉|不要/;

function number(text) {
  if (/^\d+$/.test(text)) return Number(text);
  if (text === '十') return 10;
  const [tens, ones] = text.split('十');
  if (text.includes('十')) return (tens ? DIGITS[tens] : 1) * 10 + (ones ? DIGITS[ones] : 0);
  return DIGITS[text] ?? NaN;
}
const atDay = (now, ahead) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);

// The dates and periods the text names, in order: [{ kind: 'date', date } | { kind: 'period', p }].
const TOKEN = new RegExp(
  [
    '(大後天|大后天|今天|今日|明天|明日|後天|后天)',
    '(這個|這|本|下個|下)?(?:星期|禮拜|週|周)([日天一二三四五六1-7])',
    '(\\d{1,2})\\s*[/月]\\s*(\\d{1,2})日?',
    '第?\\s*([一二兩三四五六七八九十\\d]{1,3})\\s*[節节堂]'
  ].join('|'),
  'g'
);
function tokens(text, now) {
  const out = [];
  for (const m of text.matchAll(TOKEN)) {
    // (`firm`: a date as such. A bare 週二 is also how the weekly timetable is named.)
    if (m[1]) out.push({ kind: 'date', firm: true, date: atDay(now, RELATIVE[m[1]]) });
    else if (m[3]) {
      const want = DAYS[m[3]];
      const today = now.getDay();
      const monday = atDay(now, -((today + 6) % 7));
      const inWeek = d => (d === 0 ? 6 : d - 1);
      let date;
      if (m[2] && /下/.test(m[2])) date = atDay(monday, 7 + inWeek(want));
      else if (m[2]) date = atDay(monday, inWeek(want));
      else date = atDay(now, (want - today + 7) % 7);
      out.push({ kind: 'date', firm: !!m[2], date });
    } else if (m[4]) {
      let date = new Date(now.getFullYear(), Number(m[4]) - 1, Number(m[5]));
      if (date < atDay(now, -60)) date = new Date(now.getFullYear() + 1, Number(m[4]) - 1, Number(m[5]));
      out.push({ kind: 'date', firm: true, date });
    } else out.push({ kind: 'period', p: number(m[6]) - 1 });
  }
  return out;
}

export function parseSwapEdit(rawText, current, now = new Date()) {
  const text = String(rawText || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!SWAP_WORD.test(text) && !CANCEL_WORD.test(text)) return null;
  const marks = tokens(text, now);
  const dated = marks.some(x => x.firm);
  const isSwapDay = /調課|換課|换课/.test(text);
  if (!dated && !isSwapDay) return null;
  const swaps = (current.classSwaps || []).map(s => ({ a: { ...s.a }, b: { ...s.b } }));
  const periods = (current.bellTimes || []).length;
  const key = s => `${s.date}#${s.p}`;

  // 取消: the swaps of the named day (and period, when one is named).
  if (CANCEL_WORD.test(text) && /調課|換課|换课|對調|交換/.test(text)) {
    const day = marks.find(x => x.kind === 'date');
    const period = marks.find(x => x.kind === 'period');
    const hit = s => [s.a, s.b].some(side => (!day || side.date === dateKey(day.date)) && (!period || side.p === period.p));
    if (!day && !period) return { error: t('nlEdit.swapWhich') };
    const left = swaps.filter(s => !hit(s));
    if (left.length === swaps.length) return { error: t('nlEdit.swapNoneThere') };
    return { swaps: left };
  }

  // Two sides: each period takes the date before it (the first side's date
  // carries to a second side that names none).
  const sides = [];
  let date = null;
  for (const m of marks) {
    if (m.kind === 'date') date = m.date;
    else sides.push({ date, p: m.p });
  }
  if (sides.length !== 2) return null;
  const first = sides[0].date || sides[1].date || (isSwapDay ? now : null);
  if (!first) return null;
  const a = { date: dateKey(sides[0].date || first), p: sides[0].p };
  const b = { date: dateKey(sides[1].date || first), p: sides[1].p };
  if (![a, b].every(s => Number.isInteger(s.p) && s.p >= 0 && s.p < periods)) return { error: t('nlEdit.swapNoPeriod') };
  if (key(a) === key(b)) return { error: t('nlEdit.swapSame') };
  if (a.date < dateKey(now) || b.date < dateKey(now)) return { error: t('nlEdit.swapPast') };
  const taken = swaps.find(s => [s.a, s.b].some(side => key(side) === key(a) || key(side) === key(b)));
  if (taken) return { error: t('nlEdit.swapTaken') };
  return { swaps: [...swaps, { a, b }] };
}
