// ---- src/plan.js ----
// 考前讀書計畫's time, by code (Jay 11-10, code first): which days, how many
// sessions each subject gets, and when. The AI (class-plan) only writes what
// to do in each one, from the scope typed; with no AI, these words stand.
//   planSessions({ subjects: [{ name, exam, weak, scope }], perDay, start, schoolDay })
//     → [{ day, subject, min, k, n, last }]  (k: 1…n within its subject; last: its 總複習, the latest free session before its exam)
// A school day gives `perDay` minutes; a day without classes twice that (4 h at most).
import { subjectLook } from './subjects.js';

const MS_DAY = 86_400_000;
const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const at = k => new Date(`${k}T12:00:00`);
const add = (k, n) => key(new Date(at(k).getTime() + n * MS_DAY));
const between = (a, b) => Math.round((at(b) - at(a)) / MS_DAY);

// The subjects an exam usually covers: the timetable's 國語文, languages, 數學, 自然, 社會.
const EXAM_GROUPS = new Set(['chinese', 'english', 'language', 'math', 'science', 'social']);
export const examSubject = name => EXAM_GROUPS.has(subjectLook(name).group) && !/探究|專題|選修|彈性|自主/.test(name);

// One day's minutes as sessions of about 45 (20 at least).
export function blocksOf(min) {
  if (min < 20) return [];
  const n = Math.max(1, Math.round(min / 45));
  const each = Math.max(20, Math.round(min / n / 5) * 5);
  return Array.from({ length: n }, () => each);
}

export function planSessions({ subjects = [], perDay = 60, start, schoolDay = () => true, maxDays = 45 }) {
  const list = subjects.filter(s => s.name && s.exam && s.exam > start);
  if (!list.length) return [];
  const lastExam = list.map(s => s.exam).sort().at(-1);
  const end = between(start, lastExam) > maxDays ? add(start, maxDays) : lastExam;
  // Each day's sessions, as minutes: a school day perDay, a day without classes twice (4 h at most).
  const days = [];
  for (let day = start; day < end; day = add(day, 1)) days.push({ day, blocks: blocksOf(schoolDay(day) ? perDay : Math.min(240, perDay * 2)), taken: [] });
  // Each subject's 總複習 first: the latest session free before its exam
  // (the day before, unless that day is full with others' already). Later exams first.
  const lastDay = {};
  for (const s of [...list].sort((a, b) => b.exam.localeCompare(a.exam))) {
    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      if (d.day >= s.exam || d.taken.length >= d.blocks.length) continue;
      d.taken.push({ subject: s.name, last: true });
      lastDay[s.name] = d.day;
      break;
    }
  }
  const weight = s => (s.weak ? 1.6 : 1) * (s.scope ? 1.15 : 1);
  const got = Object.fromEntries(list.map(s => [s.name, 0]));
  const out = [];
  for (const d of days) {
    // The day's reviews come first; the rest of its sessions to the subjects
    // still before their 總複習: the least studied (weighted), the nearest exam
    // lifted, never the same one twice running.
    const today = d.taken.map((x, i) => ({ day: d.day, subject: x.subject, min: d.blocks[i], last: true }));
    const open = list.filter(s => lastDay[s.name] && lastDay[s.name] > d.day);
    for (let i = today.length; i < d.blocks.length; i++) {
      const prev = today.at(-1)?.subject;
      let best = null, bestScore = -1;
      for (const s of open) {
        const left = Math.max(1, between(d.day, s.exam));
        let score = (weight(s) / (got[s.name] + 1)) * (1 + 2 / (left + 1));
        if (s.name === prev) score *= 0.4;
        if (score > bestScore) (best = s), (bestScore = score);
      }
      if (!best) break;
      today.push({ day: d.day, subject: best.name, min: d.blocks[i], last: false });
      got[best.name]++;
    }
    out.push(...today);
  }
  // Each subject's sessions counted in order.
  const n = {};
  for (const x of out) n[x.subject] = (n[x.subject] || 0) + 1;
  const k = {};
  return out.map(x => ({ ...x, k: (k[x.subject] = (k[x.subject] || 0) + 1), n: n[x.subject] }));
}

// A session's words when the AI wrote none for it.
export function plainTask(s, scope = '', en = false) {
  if (s.last) return en ? 'Full review: key points and past mistakes' : '總複習：重點和錯題';
  const ord = s.n > 1 ? (en ? ` (${s.k}/${s.n})` : `（${s.k}/${s.n}）`) : '';
  return en ? `Review ${scope || s.subject}${ord}` : `複習${scope ? ` ${scope}` : ''}${ord}`;
}

// The sessions with what to do in each: the AI's tasks by subject, in order, else plainTask.
export function withTasks(sessions, plans = {}, scopes = {}, en = false) {
  return sessions.map(s => ({ ...s, text: (plans[s.subject] || [])[s.k - 1] || plainTask(s, scopes[s.subject], en) }));
}
