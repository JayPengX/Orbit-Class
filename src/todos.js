// ---- src/todos.js ----
// 待辦 (Jay 11-10, the AI plan): what's due, on 今天, kept with the timetable
// (applicationData.todos, src/todos-data.js), so the Pass carries it to every
// device. Each a row: a round check in its subject's colour, what to do, and
// under it its subject, its kind and when (今天, 明天, 週四 11/14, 過期).
// They come from 拍聯絡簿 (a photo read by the AI door's class-book: each
// item looked over before it's kept; "下次上課" or no date lands on that
// subject's next class as held, by code), 自己加, and 考前讀書計畫 (study.js).
import * as kitUI from '#kit/ui.mjs';
import { state } from './state.js';
import { saveData } from './data.js';
import { pushSyncSnapshot } from './sync.js';
import { dateFromKey, dateKey } from './dates.js';
import { classesOn, getWeekType, processSplitName } from './schedule.js';
import { subjectLook, subjectTile } from './subjects.js';
import { normalizeTodo, normalizeTodos, newId, todosKept } from './todos-data.js';
import { el, button, glyph, section, tile } from './ui.js';
import { getLocale } from './strings.js';

const L = (zh, en) => (getLocale() === 'en' ? en : zh);
const $ = id => document.getElementById(id);
const WD = '日一二三四五六';
const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const KIND = { hw: ['作業', 'Homework'], test: ['考試', 'Test'], bring: ['要帶', 'Bring'], do: ['要做', 'To do'], study: ['讀書', 'Study'] };
export const kindName = k => L(...(KIND[k] || KIND.do));
const SHOWN = 6;

export const todos = () => normalizeTodos(state.applicationData?.todos);
export function saveTodos(list) {
  state.applicationData.todos = normalizeTodos(todosKept(normalizeTodos(list), dateKey(new Date())));
  saveData(state.applicationData);
  pushSyncSnapshot();
  drawn = '';
  renderTodos();
}

// The timetable's subjects, in its own order (the editor's), once each.
export function subjectsOf(data = state.applicationData) {
  const db = data?.teacherDB || {};
  const order = [...(data?.teacherOrder || []), ...Object.keys(db)];
  return [...new Set(order.map(k => db[k]?.[0]).filter(Boolean).map(s => String(s).trim()).filter(Boolean))];
}
// A subject's next class after `from` (the timetable as held: 單雙週, 調課, days off), or ''.
export function nextClassOf(subject, from = new Date(), within = 30) {
  if (!subject) return '';
  for (let i = 1; i <= within; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const week = getWeekType(d);
    if (classesOn(d).some(c => processSplitName(c, week).n === subject)) return dateKey(d);
  }
  return '';
}
// When, in words: 今天, 明天, 後天, 週四 (this week and next), 11/14; 過期 N 天.
export function dueWords(due, now = new Date()) {
  if (!due) return '';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = dateFromKey(due);
  const n = Math.round((d - today) / 86_400_000);
  if (n < 0) return L(`過期 ${-n} 天`, `${-n} day${n === -1 ? '' : 's'} late`);
  if (n === 0) return L('今天', 'Today');
  if (n === 1) return L('明天', 'Tomorrow');
  if (n === 2 && getLocale() !== 'en') return '後天';
  if (n < 7) return L(`週${WD[d.getDay()]}`, WD_EN[d.getDay()]);
  return L(`${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`, `${WD_EN[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`);
}
// The open ones in the order they're due (late first, no date last); a study session only on its day.
export function openTodos(list = todos(), now = new Date()) {
  const today = dateKey(now);
  return list
    .filter(t => !t.done && !(t.kind === 'study' && t.due && t.due > today))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.kind === 'test' ? -1 : 0) - (b.kind === 'test' ? -1 : 0));
}

// ---- A row ----
function todoRow(t, { onToggle, onOpen, now = new Date() } = {}) {
  const color = t.subject ? subjectLook(t.subject).color : 'var(--q-label-3, #8e8e93)';
  const check = button(`cx-todo-check${t.done ? ' is-done' : ''}`, e => (e.stopPropagation(), onToggle?.(t)));
  check.innerHTML = glyph('check');
  check.style.setProperty('--subject', color);
  check.setAttribute('aria-label', t.done ? L('還沒做完', 'Not done') : L('做完了', 'Done'));
  check.setAttribute('aria-pressed', String(t.done));
  const when = dueWords(t.due, now);
  const late = t.due && t.due < dateKey(now) && !t.done;
  const bits = [t.subject, kindName(t.kind), t.kind === 'study' && t.min ? L(`${t.min} 分`, `${t.min} min`) : ''].filter(Boolean).join(' · ');
  const words = el('span', 'q-ritem-text', [el('span', 'q-ritem-title cx-todo-text', t.text), el('small', '', bits)]);
  const end = when ? el('span', `cx-todo-when${late ? ' is-late' : t.due === dateKey(now) ? ' is-today' : ''}${t.kind === 'test' ? ' is-test' : ''}`, when) : null;
  const row = el('div', `q-ritem cx-todo${t.done ? ' is-done' : ''}`, [check, words, end]);
  row.dataset.id = t.id;
  if (onOpen) {
    row.classList.add('q-press');
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.addEventListener('click', () => onOpen(t));
  }
  return row;
}
const toggle = t => {
  const list = todos().map(x => (x.id === t.id ? { ...x, done: !x.done } : x));
  saveTodos(list);
  kitUI.haptic?.();
};

// ---- 今天's section ----
let drawn = '';
export function renderTodos(now = new Date()) {
  const box = $('cx-todos');
  if (!box) return;
  const all = todos();
  const open = openTodos(all, now);
  const today = dateKey(now);
  const doneToday = all.filter(t => t.done && t.due === today);
  const exam = upcomingExam(now);
  const key = `${today}|${getLocale()}|${JSON.stringify(all)}|${exam?.name || ''}`;
  if (key === drawn) return;
  drawn = key;
  const rows = [...open.slice(0, SHOWN), ...doneToday].map(t => todoRow(t, { onToggle: toggle, onOpen: openTodoSheet, now }));
  const more = open.length - SHOWN;
  if (more > 0) rows.push(button('q-ritem chevron cx-todo-more', () => openAllSheet(), [el('span', 'q-ritem-text', [el('span', 'q-ritem-title', L(`還有 ${more} 項`, `${more} more`))])]));
  // A test or an exam coming with no plan yet: one row that plans for it.
  if (exam && !all.some(t => t.kind === 'study' && t.plan === exam.name)) rows.push(planRow(exam, now));
  if (!all.length) {
    rows.push(addRow('camera', 'var(--q-orange)', L('拍聯絡簿', 'Photo of the contact book'), L('作業和考試自己排進來', 'Homework and tests sorted in'), () => openBook()));
    rows.push(addRow('pencil', 'var(--q-blue)', L('自己加一項', 'Add one yourself'), '', () => openTodoSheet(null)));
  }
  const body = el('div', 'q-rowcard cx-todos-card', rows);
  const add = button('cx-more cx-todo-add', e => addMenu(e.currentTarget), L('新增', 'Add'));
  const sec = section(L('待辦', 'To do'), body, {});
  sec.querySelector('.q-section-head')?.append(add);
  box.replaceChildren(...sec.childNodes);
}
function addRow(icon, color, title, sub, onClick) {
  const r = button('q-ritem chevron cx-todo-way', onClick, [tile(icon, color), el('span', 'q-ritem-text', [el('span', 'q-ritem-title', title), sub ? el('small', '', sub) : null])]);
  return r;
}
function planRow(exam, now) {
  const days = Math.round((dateFromKey(exam.date) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
  return addRow('target', 'var(--q-indigo, #6366f1)', L('考前讀書計畫', 'Study plan'), L(`${exam.name} · ${days} 天後`, `${exam.name} · in ${days} days`), () => import('./study.js').then(m => m.openStudyPlan(exam)));
}
export function addMenu(anchor) {
  kitUI.menu(anchor, [
    { label: L('拍聯絡簿', 'Photo of the contact book'), lead: tile('camera', 'var(--q-orange)'), onClick: () => openBook() },
    { label: L('考前讀書計畫', 'Study plan'), lead: tile('target', 'var(--q-indigo, #6366f1)'), onClick: () => import('./study.js').then(m => m.openStudyPlan()) },
    { label: L('自己加一項', 'Add one yourself'), lead: tile('pencil', 'var(--q-blue)'), onClick: () => openTodoSheet(null) }
  ]);
}

// The nearest exam worth a plan: a countdown 2–45 days away, or a test 待辦 2+ days away.
export function upcomingExam(now = new Date()) {
  const today = dateKey(now);
  const far = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 45));
  const near = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2));
  const list = [
    ...(state.applicationData?.countdownEvents || []).filter(e => e.startDate >= near && e.startDate <= far).map(e => ({ name: e.name, date: e.startDate, end: e.endDate, kind: 'event' })),
    ...todos().filter(t => t.kind === 'test' && !t.done && t.due >= near && t.due <= far).map(t => ({ name: (t.subject && !t.text.includes(t.subject) ? `${t.subject} ${t.text}` : t.text).slice(0, 30), date: t.due, end: t.due, subject: t.subject, scope: t.text, kind: 'test' }))
  ].filter(x => x.date > today);
  return list.sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}
export function examsAhead(now = new Date()) {
  const near = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const far = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 60));
  return [
    ...(state.applicationData?.countdownEvents || []).filter(e => e.startDate >= near && e.startDate <= far).map(e => ({ name: e.name, date: e.startDate, end: e.endDate, kind: 'event' })),
    ...todos().filter(t => t.kind === 'test' && !t.done && t.due >= near && t.due <= far).map(t => ({ name: (t.subject && !t.text.includes(t.subject) ? `${t.subject} ${t.text}` : t.text).slice(0, 30), date: t.due, end: t.due, subject: t.subject, scope: t.text, kind: 'test' }))
  ].sort((a, b) => a.date.localeCompare(b.date));
}

// ---- Every one: a sheet, by day ----
function openAllSheet() {
  const now = new Date();
  const body = el('div', 'cx-todo-all');
  const draw = () => {
    const all = todos();
    const groups = new Map();
    for (const t of openTodos(all, now).concat(all.filter(t => t.kind === 'study' && !t.done && t.due > dateKey(now)), all.filter(t => t.done))) {
      const k = t.done ? 'done' : t.due || 'none';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
    const order = [...groups.keys()].sort((a, b) => (a === 'done') - (b === 'done') || (a === 'none') - (b === 'none') || a.localeCompare(b));
    body.replaceChildren(
      ...order.map(k =>
        kitUI.section(k === 'done' ? L('做完了', 'Done') : k === 'none' ? L('沒有日期', 'No date') : dueWords(k, now), el('div', 'q-rowcard', groups.get(k).map(t => todoRow(t, { onToggle: x => (toggle(x), draw()), onOpen: x => (s.close(), openTodoSheet(x)), now }))), { shd: true, cls: 'cx-sec' })
      )
    );
  };
  draw();
  const s = kitUI.sheet({ title: L('待辦', 'To do'), body: [body], cls: 'cx-kit-sheet', detent: 'large', closeLabel: L('關閉', 'Close') });
}

// ---- One, added or changed by hand ----
const subjectItems = () => subjectsOf().map(n => ({ id: n, name: n, lead: subjectTile(n) }));
function kindChips(value, onChange, kinds = ['hw', 'test', 'bring', 'do']) {
  const row = el('div', 'q-chips cx-kind-chips');
  const draw = v => row.replaceChildren(...kinds.map(k => button(`q-chip${k === v ? ' on' : ''}`, () => (onChange(k), draw(k)), kindName(k))));
  draw(value);
  return row;
}
// A field the kit's way: its label over it.
const field = (label, input) => el('label', 'cx-field', [el('span', 'cx-field-label', label), input]);
const dateInput = value => {
  const i = document.createElement('input');
  i.type = 'date';
  i.className = 'cx-input cx-date';
  i.value = value || '';
  return i;
};
export function openTodoSheet(todo) {
  const t = todo ? { ...todo } : { id: newId(), kind: 'hw', subject: '', text: '', due: '', done: false, min: 0, plan: '' };
  const text = document.createElement('input');
  text.className = 'cx-input';
  text.maxLength = 60;
  text.value = t.text;
  text.placeholder = L('例如：習作 p.32-35', 'e.g. workbook p.32-35');
  const pick = picker(subjectItems(), t.subject, v => {
    t.subject = v;
    if (!due.value && t.kind !== 'study') due.value = nextClassOf(v);
  });
  const due = dateInput(t.due);
  const next = button('q-chip cx-next-class', () => {
    const d = nextClassOf(t.subject);
    if (d) due.value = d;
  }, L('下次上課', 'Next class'));
  const save = () => {
    const out = normalizeTodo({ ...t, text: text.value, due: due.value });
    if (!out) return text.focus();
    const list = todos();
    const i = list.findIndex(x => x.id === out.id);
    if (i >= 0) list[i] = out;
    else list.push(out);
    saveTodos(list);
    s.close();
  };
  const foot = kitUI.sheetFoot({ button: { label: todo ? L('儲存', 'Save') : L('加入', 'Add'), onClick: save } });
  const remove = todo ? button('q-btn tinted danger block cx-todo-remove', () => {
    saveTodos(todos().filter(x => x.id !== t.id));
    s.close();
    kitUI.toast?.(L('刪掉了', 'Deleted'), { action: { label: L('復原', 'Undo'), onClick: () => saveTodos([...todos(), todo]) } });
  }, L('刪除', 'Delete')) : null;
  const s = kitUI.sheet({
    title: todo ? L('待辦', 'To do') : L('新增待辦', 'New to-do'),
    body: [
      el('div', 'cx-todo-form', [
        t.kind === 'study' ? null : kindChips(t.kind, k => (t.kind = k)),
        field(L('要做什麼', 'What'), text),
        field(L('科目', 'Subject'), pick),
        field(L('什麼時候', 'When'), el('div', 'cx-due-row', [due, next])),
        remove
      ])
    ],
    foot,
    cls: 'cx-kit-sheet',
    closeLabel: L('關閉', 'Close')
  });
}
// The kit's picker (kit/ai.mjs), read with a fallback for an older kit: a <select>.
function picker(items, value, onChange) {
  const holder = el('div', 'cx-picker-holder');
  import('#kit/ai.mjs')
    .then(ai => {
      if (!ai.picker) throw new Error('old kit');
      holder.replaceChildren(ai.picker(items, { value, title: L('科目', 'Subject'), empty: L('不分科', 'No subject'), onChange }));
    })
    .catch(() => {
      const sel = document.createElement('select');
      sel.className = 'cx-input';
      sel.append(new Option(L('不分科', 'No subject'), ''), ...items.map(it => new Option(it.name, it.id)));
      sel.value = value || '';
      sel.addEventListener('change', () => onChange(sel.value));
      holder.replaceChildren(sel);
    });
  return holder;
}

// ---- 拍聯絡簿 ----
// A photo → the AI door's class-book → each item to look over (on, its kind,
// subject, words, day) → the ones kept go into 待辦.
export async function openBook() {
  const ai = await import('#kit/ai.mjs').catch(() => null);
  if (!ai?.pickPicture) return kitUI.toast?.(L('需要更新後才能用，請重新開啟 Orbit Class。', 'Reopen Orbit Class to use this.'));
  const file = await ai.pickPicture();
  if (!file) return;
  const body = el('div', 'cx-book');
  const foot = kitUI.sheetFoot({ button: { label: L('加入待辦', 'Add to to-do'), onClick: () => keep() } });
  const btn = foot.querySelector('button');
  if (btn) btn.disabled = true;
  const s = kitUI.sheet({ title: L('拍聯絡簿', 'Contact book'), body: [body], foot, cls: 'cx-kit-sheet', detent: 'large', closeLabel: L('關閉', 'Close') });
  const wait = ai.aiAnswerWait?.({ text: L('讀聯絡簿…', 'Reading it…'), rows: 4 }) || ai.aiThinking(L('讀聯絡簿…', 'Reading it…'));
  body.append(wait);
  const image = await ai.aiPicture(file);
  if (!image) {
    wait.remove();
    body.append(el('p', 'cx-book-error', L('這張照片讀不了，換一張（JPG、PNG）。', 'That picture can’t be read. Try a JPG or PNG.')));
    return;
  }
  const now = new Date();
  const subjects = subjectsOf();
  const r = await ai.aiCall('class-book', { image, today: dateKey(now), subjects, lang: getLocale() === 'en' ? 'en' : 'zh' }, { timeout: 45_000 });
  wait.remove();
  if (!s.el.isConnected) return;
  if (r.error || !r.out) return body.append(el('p', 'cx-book-error', ai.aiSays?.(r.error, r.left) || L('沒讀到，再試一次。', 'Couldn’t read it. Try again.')));
  const items = (r.out.items || []).map(x => {
    const due = x.due || (x.subject && (x.next || x.kind !== 'test') ? nextClassOf(x.subject, now) : '');
    return { ...x, id: newId(), due, keep: true, guessed: !x.due && !!due };
  });
  if (!items.length) return body.append(el('p', 'cx-book-error', L('照片裡沒看到要做的事。', 'Nothing to do in that picture.')));
  const list = el('div', 'q-rowcard cx-book-list');
  const draw = () => {
    list.replaceChildren(...items.map(it => bookRow(it, draw)));
    const n = items.filter(x => x.keep).length;
    if (btn) {
      btn.disabled = !n;
      btn.textContent = n ? L(`加入 ${n} 項`, `Add ${n}`) : L('加入待辦', 'Add to to-do');
    }
  };
  body.append(ai.aiNote?.(L('AI 讀的，加入前都可以改', 'Read by AI: change anything before adding')) || el('span'), list);
  draw();
  function keep() {
    const add = items.filter(x => x.keep).map(x => normalizeTodo({ id: x.id, kind: x.kind, subject: x.subject, text: x.text, due: x.due })).filter(Boolean);
    if (!add.length) return;
    saveTodos([...todos(), ...add]);
    s.close();
    kitUI.toast?.(L(`加了 ${add.length} 項待辦`, `${add.length} added`));
  }
}
// One item read from the photo: on or off, its kind (a tap: the next), subject, words, day.
function bookRow(it, redraw) {
  const on = button(`cx-todo-check${it.keep ? ' is-done' : ''}`, () => ((it.keep = !it.keep), redraw()));
  on.innerHTML = glyph('check');
  on.style.setProperty('--subject', it.subject ? subjectLook(it.subject).color : 'var(--q-label-3, #8e8e93)');
  on.setAttribute('aria-label', it.keep ? L('不要這項', 'Leave this out') : L('要這項', 'Keep this'));
  const kinds = ['hw', 'test', 'bring', 'do'];
  const kind = button(`q-chip cx-book-kind is-${it.kind}`, () => ((it.kind = kinds[(kinds.indexOf(it.kind) + 1) % kinds.length]), redraw()), kindName(it.kind));
  const text = document.createElement('input');
  text.className = 'cx-book-text';
  text.value = it.text;
  text.maxLength = 60;
  text.addEventListener('input', () => (it.text = text.value));
  const subj = picker(subjectItems(), it.subject, v => {
    it.subject = v;
    if (!it.due || it.guessed) {
      it.due = nextClassOf(v);
      it.guessed = !!it.due;
    }
    redraw();
  });
  const due = dateInput(it.due);
  due.addEventListener('change', () => ((it.due = due.value), (it.guessed = false)));
  const when = el('small', 'cx-book-when', it.guessed ? L(`下次${it.subject}課`, `next ${it.subject} class`) : '');
  const row = el('div', `q-ritem cx-book-row${it.keep ? '' : ' is-off'}`, [on, el('div', 'cx-book-main', [el('div', 'cx-book-top', [kind, subj]), text, el('div', 'cx-due-row', [due, when])])]);
  return row;
}
