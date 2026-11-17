// ---- src/todos.js ----
// 待辦 (Jay 11-10, the AI plan): what's due, on 今天, kept with the timetable
// (applicationData.todos, src/todos-data.js), so the Pass carries it to every
// device. Each a row: a round check in its subject's colour, what to do, and
// under it its subject, its kind and when (今天, 明天, 週四 11/14, 過期).
// Typed in by hand; "下次上課" lands on that subject's next class as held, by
// code. (A study session, kept from the 讀書計畫 Class once had, shows on its day.)
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
  // (A class split by week, 國文／公民, is two subjects.)
  return [...new Set(order.map(k => db[k]?.[0]).filter(Boolean).flatMap(s => String(s).split(/[/／]/)).map(s => s.trim()).filter(Boolean))];
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
  kitUI.tick();
};

// ---- 今天's section ----
let drawn = '';
export function renderTodos(now = new Date()) {
  const box = $('cx-todos');
  if (!box) return;
  const all = todos();
  const open = openTodos(all, now);
  const today = dateKey(now);
  // Done today stays in view, ticked (one due later or with no day too: it
  // left the list at the tick, and with six or fewer open there was no 全部
  // to find it again and take the tick back).
  const doneToday = all.filter(t => t.done && (t.due === today || t.doneOn === today));
  const key = `${today}|${getLocale()}|${JSON.stringify(all)}`;
  if (key === drawn) return;
  drawn = key;
  const rows = [...open.slice(0, SHOWN), ...doneToday].map(t => todoRow(t, { onToggle: toggle, onOpen: openTodoSheet, now }));
  const more = open.length - SHOWN;
  if (more > 0) rows.push(button('q-ritem chevron cx-todo-more', () => openAllSheet(), [el('span', 'q-ritem-text', [el('span', 'q-ritem-title', L(`還有 ${more} 項`, `${more} more`))])]));
  if (!all.length) rows.push(button('q-ritem chevron cx-todo-way', () => openTodoSheet(null), [tile('pencil', 'var(--q-blue)'), el('span', 'q-ritem-text', [el('span', 'q-ritem-title', L('自己加一項', 'Add one yourself'))])]));
  const body = el('div', 'q-rowcard cx-todos-card', rows);
  const add = button('cx-more cx-todo-add', () => openTodoSheet(null), L('新增', 'Add'));
  const sec = section(L('待辦', 'To do'), body, {});
  sec.querySelector('.q-section-head')?.append(add);
  box.replaceChildren(...sec.childNodes);
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
    kitUI.toast(L('刪掉了', 'Deleted'), { action: { label: L('復原', 'Undo'), onTap: () => saveTodos([...todos(), todo]) } });
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
      holder.replaceChildren(ai.picker(items, { value, title: L('科目', 'Subject'), empty: L('不分科', 'No subject'), clear: true, onChange }));
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
