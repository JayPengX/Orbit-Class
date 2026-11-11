// ---- src/todos-data.js ----
// 待辦 (Jay 11-10, the AI plan: 拍聯絡簿變待辦, 考前讀書計畫) and the school
// the student reads 學校公告 from, kept with the timetable (the v2 string's
// 15th and 16th entries, so the Pass carries them to every device). Pure:
// no DOM, nothing that runs at import.
//   todo:   { id, kind: hw | test | bring | do | study, subject, text, due: 'YYYY-MM-DD' | '', done, min, plan, doneOn: the day it was ticked | '' }
//   school: { name, url (an edu.tw site), grade: '' | '1' | '2' | '3' | 'j1' | 'j2' | 'j3' }
import { isRealDate } from './dates.js';

export const TODO_KINDS = ['hw', 'test', 'bring', 'do', 'study'];
export const GRADES = ['1', '2', '3', 'j1', 'j2', 'j3'];
const MAX_TODOS = 200;
const s = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function normalizeTodo(v) {
  if (!v || typeof v !== 'object') return null;
  const text = s(v.text, 60);
  if (!text) return null;
  const due = isRealDate(String(v.due || '')) ? String(v.due) : '';
  const min = Math.max(0, Math.min(240, Math.round(Number(v.min) || 0)));
  return {
    id: s(v.id, 16) || newId(),
    kind: TODO_KINDS.includes(v.kind) ? v.kind : 'do',
    subject: s(v.subject, 16),
    text,
    due,
    done: v.done === true || v.done === 1,
    min,
    plan: s(v.plan, 30),
    doneOn: (v.done === true || v.done === 1) && isRealDate(String(v.doneOn || '')) ? String(v.doneOn) : ''
  };
}
export function normalizeTodos(value) {
  const seen = new Set();
  const out = [];
  for (const t of (Array.isArray(value) ? value : []).map(normalizeTodo)) {
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= MAX_TODOS) break;
  }
  return out;
}
export function normalizeSchool(v) {
  if (!v || typeof v !== 'object') return null;
  const url = s(v.url, 200);
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // not an address: refused below
  }
  if (!/\.edu\.tw$/i.test(host)) return null;
  return { name: s(v.name, 40) || host, url, grade: GRADES.includes(String(v.grade)) ? String(v.grade) : '' };
}

// The v2 string's shapes: a todo as an array, the school as one or 0.
export const todoEntry = t => [t.id, t.kind, t.subject, t.text, t.due, t.done ? 1 : 0, t.min || 0, t.plan || '', t.doneOn || ''];
export const todoOf = e => (Array.isArray(e) ? normalizeTodo({ id: e[0], kind: e[1], subject: e[2], text: e[3], due: e[4], done: e[5], min: e[6], plan: e[7], doneOn: e[8] }) : null);
export const schoolEntry = sc => (sc ? [sc.name, sc.url, sc.grade] : 0);
export const schoolOf = e => (Array.isArray(e) ? normalizeSchool({ name: e[0], url: e[1], grade: e[2] }) : null);

let n = 0;
export function newId() {
  n = (n + 1) % 1296;
  return `${Date.now().toString(36)}${n.toString(36).padStart(2, '0')}`.slice(-10);
}

// What's kept: a done one until 3 days past its day (one with no day: 3 days
// past the day it was ticked), an open one with a day until 30 past it, an
// open one with no day always. A done one not yet stamped (ticked on an
// older version) is stamped today, so it gets the same 3 days.
export function todosKept(todos, today) {
  const back = days => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  return (todos || [])
    .map(t => (t.done && !t.doneOn ? { ...t, doneOn: today } : !t.done && t.doneOn ? { ...t, doneOn: '' } : t))
    .filter(t => (t.due ? t.due >= back(t.done ? 3 : 30) : !t.done || t.doneOn >= back(3)));
}
