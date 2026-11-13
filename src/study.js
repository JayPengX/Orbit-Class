// ---- src/study.js ----
// 考前讀書計畫 (Jay 11-10, the AI plan): pick the exam (a countdown, or a
// test in 待辦), its subjects (the timetable's own, as chips: an exam's usual
// ones lit), each one's scope if typed and ★ for a weak one, and how long a
// day. Code plans the time (plan.js: the days left, about 45-minute sessions,
// a day without classes twice as long, each subject's last session the day
// before its exam); the AI door's class-plan writes what to do in each, from
// the scope (its numbers only the scope's). Looked over, then kept in 待辦 as
// study sessions on their days.
import * as kitUI from '#kit/ui.mjs';
import { dateFromKey, dateKey } from './dates.js';
import { classesOn } from './schedule.js';
import { holidayOn } from './holidays.js';
import { subjectLook, subjectTile } from './subjects.js';
import { examSubject, planSessions, withTasks } from './plan.js';
import { examsAhead, saveTodos, subjectsOf, todos, dueWords } from './todos.js';
import { normalizeTodo, newId } from './todos-data.js';
import { el, button, glyph } from './ui.js';
import { getLocale } from './strings.js';

const L = (zh, en) => (getLocale() === 'en' ? en : zh);
const PER_DAY = [30, 60, 90, 120];
const days = (a, b) => {
  const out = [];
  for (let d = a; d <= b; d = dateKey(new Date(dateFromKey(d).getTime() + 86_400_000))) out.push(d);
  return out;
};
const short = k => {
  const d = dateFromKey(k);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export function openStudyPlan(first = null, now = new Date()) {
  const exams = examsAhead(now);
  if (first && !exams.some(e => e.name === first.name && e.date === first.date)) exams.unshift(first);
  const body = el('div', 'cx-study');
  const foot = kitUI.sheetFoot({ button: { label: L('排計畫', 'Plan it'), onClick: () => (st.planned ? keepPlan() : go()) } });
  const btn = foot.querySelector('button');
  const st = { exam: null, perDay: 60, picked: new Map(), planned: null };
  const s = kitUI.sheet({ title: L('考前讀書計畫', 'Study plan'), body: [body], foot, cls: 'cx-kit-sheet', detent: 'large', closeLabel: L('關閉', 'Close') });
  if (!exams.length) {
    body.append(kitUI.empty({ icon: 'flag', title: L('沒有要考的', 'No exam coming'), body: L('在倒數加段考，或拍聯絡簿把小考加進待辦。', 'Add an exam to the countdowns, or a quiz to To do from your contact book.') }));
    if (btn) btn.disabled = true;
    return;
  }
  const all = subjectsOf();
  st.exam = first ? exams.find(e => e.name === first.name) || exams[0] : exams[0];
  const setExam = e => {
    st.exam = e;
    st.picked = new Map();
    const on = e.kind === 'test' && e.subject ? [e.subject] : all.filter(examSubject);
    for (const n of on) st.picked.set(n, { scope: e.kind === 'test' && n === e.subject ? e.scope || '' : '', weak: false, exam: e.date });
    draw();
  };
  const draw = () => {
    const e = st.exam;
    const examDays = days(e.date, e.end || e.date);
    const examChips = el('div', 'q-chips q-texttabs cx-study-exams', exams.map(x => button(`q-chip${x === e ? ' on' : ''}`, () => setExam(x), `${x.name} · ${short(x.date)}`)));
    const subjChips = el(
      'div',
      'q-chips wrap cx-study-subjects',
      all.map(n =>
        button(`q-chip${st.picked.has(n) ? ' on' : ''}`, () => {
          if (st.picked.has(n)) st.picked.delete(n);
          else st.picked.set(n, { scope: '', weak: false, exam: e.date });
          draw();
        }, n)
      )
    );
    const rows = [...st.picked.entries()].map(([n, p]) => {
      const scope = document.createElement('input');
      scope.className = 'cx-study-scope';
      scope.placeholder = L('範圍，例如 L4-L6、Ch3', 'Scope, e.g. L4-L6, Ch3');
      scope.maxLength = 60;
      scope.value = p.scope;
      scope.addEventListener('input', () => (p.scope = scope.value));
      const weak = button(`cx-study-weak${p.weak ? ' on' : ''}`, () => ((p.weak = !p.weak), weak.classList.toggle('on', p.weak), weak.setAttribute('aria-pressed', String(p.weak))));
      weak.innerHTML = glyph('star');
      weak.setAttribute('aria-label', L('弱科，多排一點', 'Weak: more time'));
      weak.setAttribute('aria-pressed', String(p.weak));
      const day =
        examDays.length > 1
          ? el(
              'div',
              'q-chips wrap cx-study-day',
              examDays.map(d => button(`q-chip${p.exam === d ? ' on' : ''}`, () => ((p.exam = d), draw()), short(d)))
            )
          : null;
      const r = el('div', 'q-ritem cx-study-row', [subjectTile(n, 'sm'), el('div', 'cx-study-main', [el('div', 'cx-study-top', [el('strong', '', n), weak]), scope, day])]);
      r.style.setProperty('--subject', subjectLook(n).color);
      return r;
    });
    const per = kitUI.segmented(
      PER_DAY.map(m => ({ id: String(m), label: m < 60 ? L(`${m} 分`, `${m} min`) : L(`${m / 60} 小時`, `${m / 60} h`) })),
      { value: String(st.perDay), onChange: v => (st.perDay = Number(v)), label: L('每天讀多久', 'A day') }
    );
    requestAnimationFrame(() => examChips.querySelector('.on')?.scrollIntoView?.({ inline: 'center', block: 'nearest' }));
    body.replaceChildren(
      kitUI.section(L('考什麼', 'Exam'), examChips, { shd: true, cls: 'cx-sec' }),
      kitUI.section(L('考哪些科', 'Subjects'), subjChips, { shd: true, cls: 'cx-sec' }),
      rows.length ? kitUI.section(L('範圍和弱科', 'Scope, ★ for weak ones'), el('div', 'q-rowcard', rows), { shd: true, cls: 'cx-sec', sub: examDays.length > 1 ? L('考試有好幾天：點每科考哪天', 'Several days: tap each subject’s day') : '' }) : null,
      kitUI.section(L('上課日每天讀多久', 'Each school day'), per, { shd: true, cls: 'cx-sec', sub: L('沒課的日子排兩倍', 'Days off get twice that') })
    );
    if (btn) {
      btn.disabled = !st.picked.size;
      btn.textContent = L('排計畫', 'Plan it');
    }
  };
  setExam(st.exam);

  async function go() {
    const today = dateKey(now);
    const start = now.getHours() >= 20 ? dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)) : today;
    const subjects = [...st.picked.entries()].map(([name, p]) => ({ name, exam: p.exam, weak: p.weak, scope: p.scope.trim() }));
    const schoolDay = k => {
      const d = dateFromKey(k);
      return !holidayOn(d) && classesOn(d).length > 0;
    };
    const sessions = planSessions({ subjects, perDay: st.perDay, start, schoolDay });
    if (!sessions.length) {
      body.replaceChildren(kitUI.empty({ icon: 'clock', title: L('來不及排了', 'No time left to plan'), body: L('考試就在明天：今晚把重點和錯題看一遍。', 'The exam is tomorrow: go over key points and mistakes tonight.') }));
      return;
    }
    if (btn) btn.disabled = true;
    const ai = await import('#kit/ai.mjs').catch(() => null);
    const wait = ai?.aiAnswerWait?.({ text: L('想每一段要讀什麼…', 'Working out what to study…'), rows: 4 }) || ai?.aiThinking?.(L('想每一段要讀什麼…', 'Working out what to study…'));
    if (wait) body.replaceChildren(wait);
    const n = {};
    for (const x of sessions) n[x.subject] = x.n;
    const scopes = Object.fromEntries(subjects.map(x => [x.name, x.scope]));
    const r = ai?.aiCall ? await ai.aiCall('class-plan', { today: start, exam: st.exam.name, subjects: subjects.map(x => ({ ...x, n: n[x.name] || 0 })).filter(x => x.n), lang: getLocale() === 'en' ? 'en' : 'zh' }, { timeout: 40_000 }) : { error: 'offline' };
    if (!s.el.isConnected) return;
    const planned = withTasks(sessions, r?.out?.plans || {}, scopes, getLocale() === 'en');
    // A reason worth saying (today's AI used up, offline…) before the plain steps; any other failure: the plain note alone.
    const why = ['cap', 'signin', 'busy', 'paused', 'offline'].includes(r?.error) ? ai?.aiSays?.(r.error) : '';
    showPlan(planned, !r?.out, why ? `${why}${L('先用一般的讀法。', ' Plain steps for now.')}` : '');
  }
  function showPlan(planned, plain, why) {
    const byDay = new Map();
    for (const x of planned) {
      if (!byDay.has(x.day)) byDay.set(x.day, []);
      byDay.get(x.day).push(x);
    }
    const total = planned.reduce((m, x) => m + x.min, 0);
    const head = el('p', 'cx-study-sum', L(`${byDay.size} 天、${planned.length} 段，共 ${Math.round(total / 6) / 10} 小時`, `${byDay.size} days, ${planned.length} sessions, ${Math.round(total / 6) / 10} h`));
    const note = plain ? el('p', 'cx-study-plain', why || L('AI 這次沒回應，先用一般的讀法；之後可以再排一次。', 'AI didn’t answer: plain steps for now.')) : null;
    const secs = [...byDay.entries()].map(([d, list]) =>
      kitUI.section(
        `${dueWords(d)}${dueWords(d).includes('/') ? '' : ` · ${short(d)}`}`,
        el(
          'div',
          'q-rowcard',
          list.map(x => {
            const r = el('div', `q-ritem cx-study-sess${x.last ? ' is-last' : ''}`, [subjectTile(x.subject, 'sm'), el('span', 'q-ritem-text', [el('span', 'q-ritem-title', x.text), el('small', '', `${x.subject} · ${L(`${x.min} 分`, `${x.min} min`)}`)])]);
            return r;
          })
        ),
        { shd: true, cls: 'cx-sec' }
      )
    );
    import('#kit/ai.mjs')
      .then(ai => {
        const n = !plain && ai.aiNote?.(L('每段讀什麼由 AI 建議', 'What to study: suggested by AI'));
        if (n) head.after(n);
      })
      .catch(() => {});
    body.replaceChildren(head, ...(note ? [note] : []), ...secs);
    if (btn) {
      btn.disabled = false;
      btn.textContent = L('加到待辦', 'Add to 待辦');
    }
    st.planned = planned;
  }
  function keepPlan() {
    const planned = st.planned;
    const name = st.exam.name;
    const kept = todos().filter(t => !(t.kind === 'study' && t.plan === name && !t.done));
    const add = planned.map(x => normalizeTodo({ id: newId(), kind: 'study', subject: x.subject, text: x.text, due: x.day, min: x.min, plan: name })).filter(Boolean);
    saveTodos([...kept, ...add]);
    s.close();
    kitUI.toast?.(L(`排好了：${planned.length} 段在待辦`, `Planned: ${planned.length} sessions in 待辦`));
  }
}
