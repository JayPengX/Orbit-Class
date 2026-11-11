// ---- src/school-news.js ----
// 學校公告摘要 (Jay 11-10, the AI plan): the student's school, picked once
// (the Ministry's list of senior high schools, public/schools.json; or its
// site pasted) with their grade, kept with the timetable (applicationData.school).
// The proxy's /class-news reads the school's own list by code and words each
// title once for everyone at that school (Orbit-Core class-news.js). Fast
// (Jay 11-11, "a bit too slow"): the titles come at once, the AI's lines
// behind them (`wording`: asked again a few seconds on). Drawn, never plain
// text (Jay 11-11): each one a row with its kind's tile (考試, 升學, 活動,
// 獎助, by code), the thing first, its day and unit, a deadline as a tag;
// the sheet's text tabs 跟你有關 · 全部 · each kind · 進修部. 進修部's own
// (a school's night school, by its title, code) are never "for you" and sit
// in their own tab. 今天 shows the newest few for this student (a week).
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

// ---- By code: the night school's, each one's kind, who it's for before the AI says ----
export const isNight = it => /進修部|夜間部|進修學校|補校/.test(it?.title || '');
// The thing first: a title's 【轉知】, <公告>, 公告本校 and its end's 。 off.
export function cleanTitle(t = '') {
  let s = String(t).trim();
  for (let i = 0; i < 3; i++) s = s.replace(/^\s*(?:【[^】」]{1,8}[】」]|\[[^\]]{1,8}\]|<[^>]{1,8}>|〔[^〕]{1,8}〕|（[^）]{1,6}）)\s*/, '');
  return s.replace(/^公告(?:本校)?/, '').replace(/[。．.！!]+$/, '').trim() || String(t).trim();
}
export const words = it => (it.line || '').replace(/[。．.！!]+$/, '') || cleanTitle(it.title);
export const KINDS = {
  exam: { re: /段考|期中考|期末考|模擬考|考程|補考|複習考|小考|考試/, name: ['考試', 'Exams'], icon: 'pencil', color: 'var(--q-red)' },
  apply: { re: /學測|分科|甄選入學|申請入學|特殊選才|招生|升學|四技|二專|繁星|志願|簡章/, name: ['升學', 'University'], icon: 'school', color: 'var(--q-indigo, #6366f1)' },
  money: { re: /獎學金|助學金|減免|補助|學雜費|助學|獎助/, name: ['獎助', 'Grants'], icon: 'coin', color: 'var(--q-green)' },
  event: { re: /營隊|營$|營。|冬令營|夏令營|競賽|比賽|徵稿|徵件|徵選|活動|講座|說明會|志工|體驗|展覽|成果展|特展|科技展|音樂會|講習|交流|研討會|課程/, name: ['活動', 'Events'], icon: 'star', color: 'var(--q-orange)' },
  night: { re: null, name: ['進修部', 'Night school'], icon: 'moon', color: 'var(--q-gray)' },
  other: { re: null, name: ['校務', 'School'], icon: 'bell', color: 'var(--q-teal, #14b8a6)' }
};
export function kindOf(it) {
  if (isNight(it)) return 'night';
  const text = `${it.title || ''} ${it.line || ''}`;
  for (const k of ['exam', 'apply', 'money', 'event']) if (KINDS[k].re.test(text)) return k;
  // A university's name alone (its camp, its show are 活動 above) is 升學.
  return /大學|科大/.test(text) ? 'apply' : 'other';
}
// Not for students, whatever the AI says: teachers', staff's, grown-ups' degrees.
const ADULTS = /教師|教職員|研習(?!營)|招標|採購|公開觀課|人事|會議紀錄|家長會|碩士|博士|在職專班|進修推廣/;
// Who, from the title alone, for one the AI hasn't worded yet (null: can't tell).
export function guessWho(it) {
  const t = it?.title || '';
  if (ADULTS.test(t)) return [];
  const who = [];
  if (/高一|一年級|1\d\d班/.test(t)) who.push('1');
  if (/高二|二年級|2\d\d班/.test(t)) who.push('2');
  if (/高三|三年級|3\d\d班|畢業班|學測|分科測驗/.test(t)) who.push('3');
  if (/國中部|國一|國二|國三|[七八九]年級/.test(t)) who.push('jh');
  if (!who.length && /全校|全體|同學|學生/.test(t)) who.push('all');
  return who.length ? who : null;
}
// For this student: everyone's, their grade's (1–3), or 國中部 (jh) for a 國中
// grade; never the night school's; 'some' (sign-ups) not.
export function forMe(item, grade = '') {
  if (isNight(item) || ADULTS.test(item?.title || '')) return false;
  const who = Array.isArray(item.who) ? item.who : guessWho(item);
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
let again = null;
let tries = 0;
// The school's list: the phone's copy, read again from the proxy past 30
// minutes. While the AI words it (`wording`, about 30 s for a school's 25),
// asked again at 6, 12, 20, 30, 42 and 57 seconds; each new copy announced ('class-news') to whatever shows it.
export async function loadNews({ force = false } = {}) {
  const sc = schoolOf();
  if (!sc) return null;
  const have = kept();
  if (!force && have?.site === sc.url && Date.now() - (have.got || 0) < FRESH && !have.wording) return have;
  asking ||= kit
    .workerJson('/class-news', `site=${encodeURIComponent(sc.url)}`, { timeout: 40_000, errors: true })
    .then(r => {
      if (r && Array.isArray(r.items)) {
        const v = { ...r, site: sc.url, got: Date.now() };
        keep(v);
        clearTimeout(again);
        if (r.wording && tries < 6) again = setTimeout(() => loadNews({ force: true }), [6, 6, 8, 10, 12, 15][tries++] * 1000);
        else tries = 0;
        window.dispatchEvent(new Event('class-news'));
        return v;
      }
      return have?.site === sc.url ? { ...have, failed: r?.error || 'offline' } : { site: sc.url, items: [], failed: r?.error || 'offline' };
    })
    .finally(() => (asking = null));
  return asking;
}

const short = k => {
  const d = dateFromKey(k);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
// One announcement: its kind's tile, the thing (two lines at most), its day ·
// unit · what to do; a day still ahead the line doesn't say a tag (orange within a week).
function newsRow(it, now = new Date()) {
  const k = kindOf(it);
  const today = dateKey(now);
  const ahead = it.by && it.by >= today;
  const soon = ahead && it.by <= dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  const day = it.date === today ? L('今天', 'Today') : it.date ? short(it.date) : '';
  const bits = [day, it.unit || '', it.act || ''].filter(Boolean).join(' · ');
  // The day as a tag only where the line doesn't already say it; 截止 only
  // where the words say it's a deadline (the AI's `by` is also an event's day).
  const md = it.by ? short(it.by) : '';
  const said = md && new RegExp(`(^|[^\\d])${md}($|[^\\d])`).test(words(it));
  const due = /截止|為止|止$|前$|前繳|前報名|前上傳/.test(`${it.title} ${it.line || ''} ${it.act || ''}`);
  const by = ahead && !said ? kitUI.tag?.(due ? L(`${md} 截止`, `by ${md}`) : md, '', soon ? '#f97316' : '') || el('span', 'q-tag', md) : null;
  const r = button(`q-ritem chevron cx-news is-${k}`, () => kit.openLink?.(it.url) ?? window.open(it.url, '_blank', 'noopener'), [tile(KINDS[k].icon, KINDS[k].color), el('span', 'q-ritem-text', [el('span', 'q-ritem-title', words(it)), el('small', '', bits)]), by]);
  r.title = it.title;
  return r;
}
// Rows' places held while the list is read.
const skeleton = (n = 4) =>
  el(
    'div',
    'q-rowcard cx-news-skel',
    Array.from({ length: n }, () => el('div', 'q-ritem', [el('span', 'q-tile q-skel'), el('span', 'q-ritem-text', [el('span', 'q-skel cx-skel-a'), el('span', 'q-skel cx-skel-b')])]))
  );

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
  if (!have || have.site !== sc.url || Date.now() - (have.got || 0) > FRESH || have.wording) {
    const fresh = await loadNews();
    draw(fresh, sc, now);
  }
}
window.addEventListener('class-news', () => {
  const sc = schoolOf();
  const have = kept();
  if (sc && have?.site === sc.url) draw(have, sc, new Date());
});
function draw(news, sc, now) {
  const box = document.getElementById('cx-news');
  if (!box) return;
  const week = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
  const mine = (news?.items || []).filter(it => forMe(it, sc.grade) && it.date >= week).slice(0, 3);
  const key = `${sc.url}|${sc.grade}|${getLocale()}|${dateKey(now)}|${JSON.stringify(mine)}|${!!news}`;
  if (key === drawn) return;
  drawn = key;
  box.hidden = !news || !mine.length;
  if (box.hidden) return box.replaceChildren();
  const sec = section(L('學校公告', 'School news'), el('div', 'q-rowcard', mine.map(it => newsRow(it, now))), { more: L('全部', 'All'), onMore: () => openNewsSheet() });
  box.replaceChildren(...sec.childNodes);
}

// ---- Every one: text tabs (跟你有關, 全部, each kind, 進修部), newest first ----
export async function openNewsSheet() {
  const sc = schoolOf();
  if (!sc) return openSchoolPicker();
  const body = el('div', 'cx-news-all');
  const note = el('div', 'cx-news-note');
  const change = button('q-btn plain cx-news-school', () => (s.close(), openSchoolPicker()), L('換學校或年級', 'Change school or grade'));
  const s = kitUI.sheet({ title: L('學校公告', 'School news'), subtitle: `${sc.name}${sc.grade ? ` · ${gradeName(sc.grade)}` : ''}`, body: [note, body, change], cls: 'cx-kit-sheet', detent: 'large', closeLabel: L('關閉', 'Close') });
  let tab = '';
  const ai = await import('#kit/ai.mjs').catch(() => null);
  const fill = news => {
    if (!s.el.isConnected) return;
    const items = news?.items || [];
    const now = new Date();
    const mine = items.filter(it => forMe(it, sc.grade));
    if (news?.unread || (!items.length && news?.failed)) {
      note.replaceChildren();
      return body.replaceChildren(kitUI.empty({ icon: 'school', title: L('讀不到這所學校的公告', 'Can’t read this school’s news'), body: L('有些學校網站要用瀏覽器才看得到。可以換成學校「最新消息」那一頁的網址。', 'Some school sites only work in a browser. Try the address of its news page.'), action: { label: L('換網址', 'Change address'), onTap: () => (s.close(), openSchoolPicker()) } }));
    }
    if (!items.length) {
      note.replaceChildren();
      return body.replaceChildren(kitUI.empty({ icon: 'school', title: L('最近沒有公告', 'No news lately'), body: '' }));
    }
    // The tabs: only those with any; 跟你有關 first when it has some.
    const groups = [
      ['me', L('跟你有關', 'For you'), mine],
      ['all', L('全部', 'All'), items.filter(it => !isNight(it))],
      ...['exam', 'apply', 'event', 'money', 'other', 'night'].map(k => [k, L(...KINDS[k].name), items.filter(it => kindOf(it) === k)])
    ].filter(([, , list]) => list.length);
    if (!groups.some(([id]) => id === tab)) tab = groups[0][0];
    const tabs = el('div', 'q-chips q-texttabs cx-news-tabs', groups.map(([id, name, list]) => button(`q-chip${id === tab ? ' on' : ''}`, () => ((tab = id), fill(news)), `${name} ${list.length}`)));
    const list = groups.find(([id]) => id === tab)[2];
    body.replaceChildren(tabs, el('div', 'q-rowcard', list.map(it => newsRow(it, now))));
    requestAnimationFrame(() => tabs.querySelector('.on')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' }));
    // While the AI words them: a line that says so; then the note that it did.
    const wording = news?.wording;
    const n = wording ? ai?.aiThinking?.(L('AI 正在整理每一則…', 'AI is sorting each one…')) : items.some(it => it.line) ? ai?.aiNote?.(L('每則一句話由 AI 依標題寫成，點開看學校原文', 'One line each by AI from the title; tap for the school’s page')) : null;
    note.replaceChildren(...(n ? [n] : []));
  };
  const onNews = () => {
    if (!s.el.isConnected) return window.removeEventListener('class-news', onNews);
    const have = kept();
    if (have?.site === sc.url) fill(have);
  };
  window.addEventListener('class-news', onNews);
  const have = kept();
  if (have?.site === sc.url) fill(have);
  else body.replaceChildren(skeleton(5));
  const stale = !have || have.site !== sc.url || Date.now() - (have.got || 0) > FRESH || have.wording;
  if (stale) {
    const fresh = await loadNews({ force: true });
    fill(fresh);
  }
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
