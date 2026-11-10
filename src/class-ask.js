// ---- src/class-ask.js ----
// 問我的課表 (Jay 11-10, the family's AI): the editor's AI box also answers a
// question about the timetable ("下週三最後一節幾點下課", "哪天最早放學").
// Code first: a day's classes, its first or last period, read here for
// nothing. Anything else goes to the AI door (class-ask) with the next two
// weeks as held (family-tell.js familyDays: 調課, 單雙週 and days off
// applied); it only reads them, and every time it says is one of theirs.
import { dateKey } from './dates.js';
import { familyDays } from './family-tell.js';

const WD = '日一二三四五六';
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EDIT = /改|換|調|刪|移|加入|新增|設為|設成|清掉|取消|把/;

// A question, not an edit: asked (？, 嗎, 幾點, 哪天, 什麼課…) and nothing to change.
export function isQuestion(text) {
  const t = String(text || '').trim();
  if (!t || EDIT.test(t)) return false;
  return /[?？]\s*$|[嗎呢]\s*$|幾點|幾節|幾堂|幾天|哪天|哪一天|哪幾|哪節|什麼課|什麼時候|多少|有沒有|是不是|何時|^(when|what|which|how|do|does|is|are)\b/i.test(t);
}

// The day a question names: 今天, 明天, 後天, (下)週三 / 星期三 / 禮拜三; null none.
export function dayOf(text, now = new Date()) {
  const t = String(text || '');
  const at = n => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
  if (/今天|today/i.test(t)) return at(0);
  if (/後天/.test(t)) return at(2);
  if (/明天|tomorrow/i.test(t)) return at(1);
  const m = /(下)?(?:週|星期|禮拜)([一二三四五六日天])/.exec(t);
  if (!m) return null;
  const want = m[2] === '天' ? 0 : WD.indexOf(m[2]);
  const today = now.getDay();
  if (m[1]) {
    // 下週: next week's (weeks from Monday).
    const mon = at(-((today + 6) % 7) + 7);
    return new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + ((want + 6) % 7));
  }
  return at((want - today + 7) % 7);
}

const label = (d, en) => (en ? `${WD_EN[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}` : `${d.getMonth() + 1}/${d.getDate()}（週${WD[d.getDay()]}）`);

// The questions code answers alone; null: the AI's.
export function localAnswer(text, days, now = new Date(), en = false) {
  const d = dayOf(text, now);
  if (!d) return null;
  const list = days[dateKey(d)];
  if (!list) return null;
  const when = label(d, en);
  if (!list.length) return en ? `No classes on ${when}.` : `${when}沒有課。`;
  if (/幾點(放學|下課)|最後一節|最晚|when.*(end|finish|out)/i.test(text)) {
    const last = list.at(-1);
    return en ? `On ${when} the last class is period ${last.n}, ${last.name}, ending at ${last.to}.` : `${when}最後一節是第 ${last.n} 節${last.name}，${last.to} 下課。`;
  }
  if (/幾點(上課|到校)|第一節|最早|when.*(start|begin)/i.test(text)) {
    const first = list[0];
    return en ? `On ${when} the first class is ${first.name} at ${first.from}.` : `${when}第一節是${first.name}，${first.from} 上課。`;
  }
  if (/什麼課|哪些課|課表|上什麼|what class|which class|classes/i.test(text)) {
    return (en ? `${when}: ` : `${when}：`) + list.map(c => `${c.n} ${c.name}`).join(en ? ', ' : '、') + (en ? '.' : '。');
  }
  return null;
}

// The two weeks as the AI is told them, lean: a line a day.
export function askFacts(days, now = new Date()) {
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const head = `Now: ${dateKey(now)} (${WD_EN[now.getDay()]}) ${hm}.`;
  const lines = Object.entries(days)
    .filter(([, list]) => list.length)
    .map(([key, list]) => {
      const d = new Date(`${key}T12:00:00`);
      return `${key} ${WD_EN[d.getDay()]}: ${list.map(c => `${c.n} ${c.from}-${c.to} ${c.name}${c.out ? ' (outdoors)' : ''}`).join('; ')}`;
    });
  return [head, ...lines].join('\n').slice(0, 4500);
}

// The answer: code's, else the AI's. { text, ai } or { error }.
export async function askTimetable(question, { now = new Date(), en = false } = {}) {
  const days = familyDays(now, 14);
  const local = localAnswer(question, days, now, en);
  if (local) return { text: local, ai: false };
  const ai = await import('#kit/ai.mjs').catch(() => null);
  if (!ai?.aiCall) return { error: en ? 'This needs the newer app; reopen Orbit Class.' : '需要更新後才能問，請重新開啟 Orbit Class。' };
  const r = await ai.aiCall('class-ask', { question, facts: askFacts(days, now), lang: en ? 'en' : 'zh' });
  if (r?.out?.answer) return { text: r.out.answer, ai: true };
  return { error: r?.error ? (ai.aiSays?.(r.error, r.left) || r.error) : en ? 'Your timetable doesn’t say. Try asking another way.' : '課表裡看不出來，換個問法試試。' };
}
