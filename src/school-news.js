// ---- src/school-news.js ----
// 學校公告摘要 (Jay 11-10, the AI plan): the student's school, picked once
// (the Ministry's list of senior high schools, public/schools.json; or its
// site pasted) with their grade, kept with the timetable (applicationData.school).
// The proxy's /class-news reads the school's own list by code and words each
// title once for everyone at that school (Orbit-Core class-news.js); here
// only the ones for this student: for every student, their grade, or their
// school's 國中部 for a 國中 grade. 今天 shows the newest few (a week); the
// sheet all of them, the rest folded. A tap opens the school's own page.
import * as kitUI from '#kit/ui.mjs';
import * as kit from '#kit/orbit.mjs';
import { state } from './state.js';
import { saveData } from './data.js';
import { pushSyncSnapshot } from './sync.js';
import { dateFromKey, dateKey } from './dates.js';
import { GRADES, normalizeSchool } from './todos-data.js';
import { el, button, section, tile } from './ui.js';
import { getLocale } from './strings.js';

const L = (zh, en) => (getLocale() === 'en' ? en : zh);
const KEY = 'class.news.v1';
const FRESH = 30 * 60_000;
const GRADE_NAME = { 1: ['高一', 'Grade 10'], 2: ['高二', 'Grade 11'], 3: ['高三', 'Grade 12'], j1: ['國一', 'Grade 7'], j2: ['國二', 'Grade 8'], j3: ['國三', 'Grade 9'] };
export const gradeName = g => (GRADE_NAME[g] ? L(...GRADE_NAME[g]) : '');

export const schoolOf = () => normalizeSchool(state.applicationData?.school);
// For this student: who names everyone, their grade (1–3), or 國中部 (jh) for a 國中 grade; 'some' when it asks to sign up.
export function forMe(item, grade = '') {
  const who = Array.isArray(item.who) ? item.who : null;
  if (!who) return false;
  if (who.includes('all')) return true;
  if (!grade) return who.includes('1') || who.includes('2') || who.includes('3') || who.includes('jh');
  if (grade.startsWith('j')) return who.includes('jh'); // a 完全中學's "1" is its 高一
  return who.includes(grade);
}
export const isSome = item => Array.isArray(item.who) && item.who.length === 1 && item.who[0] === 'some';

const kept = () => {
  try {
    return kit.readJson?.(KEY) || JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
};
const keep = v => {
  try {
    kit.writeJson ? kit.writeJson(KEY, v) : localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // a full or blocked store: read again next time
  }
};
let asking = null;
// The school's list: the phone's copy, read again from the proxy past 30 minutes.
export async function loadNews({ force = false } = {}) {
  const sc = schoolOf();
  if (!sc) return null;
  const have = kept();
  if (!force && have?.site === sc.url && Date.now() - (have.got || 0) < FRESH) return have;
  asking ||= kit
    .workerJson('/class-news', `site=${encodeURIComponent(sc.url)}`, { timeout: 40_000, errors: true })
    .then(r => {
      if (r && Array.isArray(r.items)) {
        const v = { ...r, site: sc.url, got: Date.now() };
        keep(v);
        return v;
      }
      return have?.site === sc.url ? { ...have, failed: r?.error || 'offline' } : { site: sc.url, items: [], failed: r?.error || 'offline' };
    })
    .finally(() => (asking = null));
  return asking;
}

const words = it => it.line || it.title;
function newsRow(it, now = new Date()) {
  const d = it.date ? dateFromKey(it.date) : null;
  const bits = [d ? `${d.getMonth() + 1}/${d.getDate()}` : '', it.unit || '', it.by && it.by >= dateKey(now) ? L(`${shortDay(it.by)} 前`, `by ${shortDay(it.by)}`) : ''].filter(Boolean).join(' · ');
  const act = it.act ? el('span', 'cx-news-act', it.act) : null;
  const r = button('q-ritem chevron cx-news', () => kit.openLink?.(it.url) ?? window.open(it.url, '_blank', 'noopener'), [el('span', 'q-ritem-text', [el('span', 'q-ritem-title', words(it)), el('small', '', bits)]), act]);
  r.title = it.title;
  return r;
}
const shortDay = k => {
  const d = dateFromKey(k);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// ---- 今天: the newest few for this student, a week back ----
let drawn = '';
export async function renderSchoolNews(now = new Date()) {
  const box = document.getElementById('cx-news');
  if (!box) return;
  const sc = schoolOf();
  if (!sc) {
    if (box.childElementCount) box.replaceChildren();
    box.hidden = true;
    drawn = '';
    return;
  }
  const have = kept();
  draw(have?.site === sc.url ? have : null, sc, now);
  if (!have || have.site !== sc.url || Date.now() - (have.got || 0) > FRESH) {
    const fresh = await loadNews();
    draw(fresh, sc, now);
  }
}
function draw(news, sc, now) {
  const box = document.getElementById('cx-news');
  const week = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
  const mine = (news?.items || []).filter(it => forMe(it, sc.grade) && it.date >= week).slice(0, 3);
  const key = `${sc.url}|${sc.grade}|${getLocale()}|${JSON.stringify(mine)}|${!!news}`;
  if (key === drawn) return;
  drawn = key;
  box.hidden = !news || !mine.length;
  if (box.hidden) return box.replaceChildren();
  const sec = section(L('學校公告', 'School news'), el('div', 'q-rowcard', mine.map(it => newsRow(it, now))), { more: L('全部', 'All'), onMore: () => openNewsSheet() });
  box.replaceChildren(...sec.childNodes);
}

// ---- Every one: for this student first, the rest folded ----
export async function openNewsSheet() {
  const sc = schoolOf();
  if (!sc) return openSchoolPicker();
  const body = el('div', 'cx-news-all');
  const note = el('div', 'cx-news-note');
  let noted = false;
  const change = button('q-btn plain cx-news-school', () => (s.close(), openSchoolPicker()), L('換學校或年級', 'Change school or grade'));
  const s = kitUI.sheet({ title: L('學校公告', 'School news'), subtitle: `${sc.name}${sc.grade ? ` · ${gradeName(sc.grade)}` : ''}`, body: [note, body, change], cls: 'cx-kit-sheet', detent: 'large', closeLabel: L('關閉', 'Close') });
  const fill = news => {
    const items = news?.items || [];
    const mine = items.filter(it => forMe(it, sc.grade));
    const rest = items.filter(it => !forMe(it, sc.grade));
    const parts = [];
    if (news?.unread || (!items.length && news?.failed)) parts.push(kitUI.empty({ icon: 'school', title: L('讀不到這所學校的公告', 'Can’t read this school’s news'), body: L('有些學校網站要用瀏覽器才看得到。可以換成學校「最新消息」那一頁的網址。', 'Some school sites only work in a browser. Try the address of its news page.'), action: { label: L('換網址', 'Change address'), onTap: () => (s.close(), openSchoolPicker()) } }));
    else if (!items.length) parts.push(kitUI.empty({ icon: 'school', title: L('最近沒有公告', 'No news lately'), body: '' }));
    if (mine.length) parts.push(kitUI.section(L('跟你有關', 'For you'), el('div', 'q-rowcard', mine.map(it => newsRow(it))), { shd: true, cls: 'cx-sec' }));
    if (rest.length) {
      const fold = el('div', 'q-rowcard', rest.map(it => newsRow(it)));
      fold.hidden = true;
      const words = L(`其他 ${rest.length} 則`, `${rest.length} others`);
      const t = kitUI.moreToggle ? kitUI.moreToggle({ more: words, less: L('收起', 'Less'), cls: 'cx-news-more', onToggle: o => (fold.hidden = !o) }) : button('q-more cx-news-more', () => (fold.hidden = !fold.hidden), words);
      parts.push(el('div', 'cx-sec', [t, fold]));
    }
    if (!noted && mine.some(it => it.line)) {
      noted = true;
      import('#kit/ai.mjs')
        .then(ai => {
          const n = ai.aiNote?.(L('每則一句話是 AI 依標題寫的，點開看學校原文', 'One line each by AI from the title; tap for the school’s page'));
          if (n) note.replaceChildren(n);
        })
        .catch(() => {});
    }
    body.replaceChildren(...parts);
  };
  const have = kept();
  if (have?.site === sc.url) fill(have);
  else {
    const wait = await import('#kit/ai.mjs').then(ai => ai.aiThinking?.(L('讀學校網站…', 'Reading the school’s site…'))).catch(() => null);
    if (wait) body.replaceChildren(wait);
  }
  const fresh = await loadNews({ force: !have || have.site !== sc.url || Date.now() - (have.got || 0) > FRESH });
  if (s.el.isConnected) fill(fresh);
  drawn = '';
  renderSchoolNews();
}

// ---- Picking the school and grade ----
let schools = null;
const loadSchools = () => (schools ||= fetch(new URL('schools.json', document.baseURI)).then(r => r.json()).catch(() => []));
export async function openSchoolPicker() {
  const now = schoolOf();
  const st = { name: now?.name || '', url: now?.url || '', grade: now?.grade || '' };
  const list = el('div', 'q-rowcard cx-school-list');
  const own = document.createElement('input');
  own.className = 'cx-input';
  own.placeholder = L('或貼上學校網站，例如 https://www.xxx.edu.tw', 'Or paste the school’s site');
  own.inputMode = 'url';
  own.addEventListener('input', () => {
    const v = own.value.trim();
    if (v) {
      st.url = /^https?:\/\//.test(v) ? v : `https://${v}`;
      st.name = '';
      try {
        st.name = new URL(st.url).hostname;
      } catch {
        // not an address yet: 完成 stays off
      }
    }
    check();
  });
  const grades = el('div', 'q-chips wrap cx-grade-chips');
  const drawGrades = () => grades.replaceChildren(...GRADES.map(g => button(`q-chip${st.grade === g ? ' on' : ''}`, () => ((st.grade = g), drawGrades(), check()), gradeName(g))));
  drawGrades();
  const all = await loadSchools();
  const draw = (q = '') => {
    const k = q.trim();
    const hits = (k ? all.filter(([name, , county]) => name.includes(k) || county.includes(k)) : all.filter(([n]) => n === st.name)).slice(0, 8);
    list.replaceChildren(
      ...hits.map(([name, url, county]) => {
        const on = st.url === url;
        const r = button(`q-ritem cx-school${on ? ' is-on' : ''}`, () => ((st.name = name), (st.url = url), (own.value = ''), draw(q), check()), [tile('school', 'var(--q-green)'), el('span', 'q-ritem-text', [el('span', 'q-ritem-title', name), el('small', '', county)]), on ? el('span', 'cx-school-on', '✓') : null]);
        return r;
      })
    );
    list.hidden = !hits.length;
  };
  // A school pasted (not on the list): its address stays in the field.
  if (now && !all.some(([, url]) => url === now.url)) own.value = now.url;
  const find = kitUI.search({ placeholder: L('找學校：校名或縣市', 'Find your school: name or county'), value: '', onInput: draw });
  draw();
  const foot = kitUI.sheetFoot({ button: { label: L('完成', 'Done'), onClick: () => done() } });
  const btn = foot.querySelector('button');
  const check = () => btn && (btn.disabled = !normalizeSchool(st));
  check();
  const remove = now ? button('q-btn tinted danger block', () => save(null), L('不看學校公告', 'Stop school news')) : null;
  const s = kitUI.sheet({
    title: L('學校公告', 'School news'),
    body: [
      el('p', 'cx-sheet-sub', L('選你的學校和年級，只列跟你有關的公告，每則一句話。', 'Pick your school and grade: only the news for you, one line each.')),
      kitUI.section(L('學校', 'School'), el('div', 'cx-school-find', [find, list, own]), { shd: true, cls: 'cx-sec' }),
      kitUI.section(L('年級', 'Grade'), grades, { shd: true, cls: 'cx-sec' }),
      remove
    ],
    foot,
    cls: 'cx-kit-sheet',
    detent: 'large',
    closeLabel: L('關閉', 'Close')
  });
  function save(v) {
    state.applicationData.school = v;
    saveData(state.applicationData);
    pushSyncSnapshot();
    drawn = '';
    s.close();
    renderSchoolNews();
    window.dispatchEvent(new Event('class-school'));
  }
  function done() {
    const v = normalizeSchool(st);
    if (!v) return;
    save(v);
    openNewsSheet();
  }
}
