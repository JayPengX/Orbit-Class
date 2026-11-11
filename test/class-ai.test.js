// 待辦, 考前讀書計畫, 學校公告 (Jay 11-10, the AI plan): what code does
// around the AI. A to-do and the school ride with the timetable (the v2
// string), the plan's time is code's, the news for this student by grade.
import { describe, expect, it } from 'vitest';
import { normalizeSchool, normalizeTodo, normalizeTodos, todoEntry, todoOf, todosKept } from '../src/todos-data.js';
import { blocksOf, examSubject, planSessions, plainTask, withTasks } from '../src/plan.js';
import { cleanTitle, forMe, guessWho, isNight, isRelay, isSome, kindOf, words } from '../src/school-news.js';
import { normalizeSettingsData, encodeTransferData, decodeTransferData } from '../src/editor-backup.js';
import { buildFixtureData } from './helpers/fixtureData.js';

describe('待辦 and the school, kept with the timetable', () => {
  it('a to-do is cleaned: words cut, a real day or none, a known kind', () => {
    expect(normalizeTodo({ text: '  ' })).toBe(null);
    const t = normalizeTodo({ id: 'a1', kind: 'nonsense', subject: '數學', text: '習作  p.32', due: '2026-02-30', min: 999 });
    expect(t).toMatchObject({ id: 'a1', kind: 'do', subject: '數學', text: '習作 p.32', due: '', done: false, min: 240 });
    expect(todoOf(todoEntry(t))).toEqual(t);
    expect(normalizeTodos([t, t, { text: 'b', id: 'b' }]).map(x => x.id)).toEqual(['a1', 'b']);
  });
  it('a school is an edu.tw site only, its grade one of the six', () => {
    expect(normalizeSchool({ name: 'X', url: 'https://evil.example.com' })).toBe(null);
    expect(normalizeSchool({ name: '', url: 'https://www.abc.edu.tw/news', grade: '4' })).toEqual({ name: 'www.abc.edu.tw', url: 'https://www.abc.edu.tw/news', grade: '' });
    expect(normalizeSchool({ name: 'A 高中', url: 'https://www.abc.edu.tw', grade: 'j2' }).grade).toBe('j2');
  });
  it('a done one kept 3 days past its day, an open one 30', () => {
    const list = [
      { id: '1', due: '2026-11-06', done: true },
      { id: '2', due: '2026-11-08', done: true },
      { id: '3', due: '2026-10-10', done: false },
      { id: '4', due: '2026-10-12', done: false },
      { id: '5', due: '', done: false }
    ];
    expect(todosKept(list, '2026-11-10').map(x => x.id)).toEqual(['2', '4', '5']);
  });
  it('a done one with no day kept 3 days past the day it was ticked; an open one with no day always', () => {
    const list = [
      { id: '1', due: '', done: true, doneOn: '2026-11-06' },
      { id: '2', due: '', done: true, doneOn: '2026-11-08' },
      { id: '3', due: '', done: true },
      { id: '4', due: '', done: false, doneOn: '2020-01-01' }
    ];
    const kept = todosKept(list, '2026-11-10');
    expect(kept.map(x => x.id)).toEqual(['2', '3', '4']);
    expect(kept[1].doneOn).toBe('2026-11-10');
    expect(kept[2].doneOn).toBe('');
    expect(todosKept(kept, '2026-11-14').map(x => x.id)).toEqual(['4']);
    const once = normalizeTodo({ id: 'x', text: 'a', done: true, doneOn: '2026-11-08' });
    expect(todoOf(todoEntry(once))).toEqual(once);
  });
  it('ride the v2 string (to every device) and back', async () => {
    const todos = [normalizeTodo({ id: 'x1', kind: 'test', subject: '英文', text: 'L4 小考', due: '2026-11-12' }), normalizeTodo({ id: 'x2', kind: 'study', subject: '數學', text: '複習 2-1', due: '2026-11-11', min: 45, plan: '第二次段考', done: true })];
    const school = { name: 'A 高中', url: 'https://www.abc.edu.tw', grade: '2' };
    const data = normalizeSettingsData({ ...buildFixtureData(), todos, school });
    const back = await decodeTransferData(await encodeTransferData(data));
    expect(back.todos).toEqual(todos);
    expect(back.school).toEqual(school);
    const none = await decodeTransferData(await encodeTransferData(normalizeSettingsData(buildFixtureData())));
    expect(none.todos).toEqual([]);
    expect(none.school).toBe(null);
  });
});

describe('考前讀書計畫: the time by code', () => {
  const ALL = ['國語文', '英語文', '數學A', '物理', '歷史', '體育', '自主學習', '探究與實作'];
  it('an exam’s usual subjects: the written ones, not PE or 自主/探究', () => {
    expect(ALL.filter(examSubject)).toEqual(['國語文', '英語文', '數學A', '物理', '歷史']);
  });
  it('a day’s minutes as sessions of about 45', () => {
    expect(blocksOf(10)).toEqual([]);
    expect(blocksOf(30)).toEqual([30]);
    expect(blocksOf(60)).toEqual([60]);
    expect(blocksOf(90)).toEqual([45, 45]);
    expect(blocksOf(120).reduce((a, b) => a + b, 0)).toBe(120);
  });
  it('every subject before its exam, its last session the day before, a day off twice as long', () => {
    const subjects = [
      { name: '數學', exam: '2026-11-20', weak: true, scope: '2-1~2-3' },
      { name: '英文', exam: '2026-11-20', weak: false, scope: '' },
      { name: '國文', exam: '2026-11-21', weak: false, scope: 'L4-L6' }
    ];
    const schoolDay = k => ![6, 0].includes(new Date(`${k}T12:00:00`).getDay());
    const out = planSessions({ subjects, perDay: 60, start: '2026-11-10', schoolDay });
    for (const s of subjects) {
      const mine = out.filter(x => x.subject === s.name);
      expect(mine.length).toBeGreaterThan(1);
      expect(mine.every(x => x.day < s.exam)).toBe(true);
      expect(mine.at(-1)).toMatchObject({ last: true, k: mine.length, n: mine.length });
      expect(['2026-11-18', '2026-11-19', '2026-11-20']).toContain(mine.at(-1).day);
    }
    const minutes = d => out.filter(x => x.day === d).reduce((m, x) => m + x.min, 0);
    expect(minutes('2026-11-10')).toBe(60);
    expect(minutes('2026-11-14')).toBe(120); // a Saturday
    // The weak one gets more than the other on the same day.
    expect(out.filter(x => x.subject === '數學').length).toBeGreaterThan(out.filter(x => x.subject === '英文').length);
  });
  it('never more than a day holds: nine subjects on one exam day spread their reviews back', () => {
    const subjects = '國文 英文 數學 物理 化學 生物 歷史 地理 公民'.split(' ').map(name => ({ name, exam: '2026-11-26' }));
    const out = planSessions({ subjects, perDay: 60, start: '2026-11-11' });
    const byDay = {};
    for (const x of out) byDay[x.day] = (byDay[x.day] || 0) + x.min;
    expect(Math.max(...Object.values(byDay))).toBe(60);
    expect(out.filter(x => x.last).length).toBe(9);
    for (const s of subjects) expect(out.filter(x => x.subject === s.name).at(-1).last).toBe(true);
  });
  it('an exam today or past: nothing to plan', () => {
    expect(planSessions({ subjects: [{ name: '數學', exam: '2026-11-10' }], start: '2026-11-10' })).toEqual([]);
  });
  it('the AI’s tasks in order, plain words where it wrote none', () => {
    const s = [
      { day: '2026-11-10', subject: '國文', min: 45, k: 1, n: 2, last: false },
      { day: '2026-11-11', subject: '國文', min: 45, k: 2, n: 2, last: true },
      { day: '2026-11-11', subject: '英文', min: 45, k: 1, n: 1, last: false }
    ];
    const out = withTasks(s, { 國文: ['讀 L4 課文、注釋'] }, { 國文: 'L4-L6', 英文: '' });
    expect(out.map(x => x.text)).toEqual(['讀 L4 課文、注釋', '總複習：重點和錯題', '複習']);
    expect(plainTask(s[0], 'L4-L6')).toBe('複習 L4-L6（1/2）');
    expect(plainTask(s[0], '', true)).toBe('Review 國文 (1/2)');
  });
});

describe('學校公告: only the ones for this student', () => {
  const it_ = who => ({ who });
  it('everyone’s, their grade’s, and 國中部 for a 國中 grade', () => {
    expect(forMe(it_(['all']), '2')).toBe(true);
    expect(forMe(it_(['2']), '2')).toBe(true);
    expect(forMe(it_(['3']), '2')).toBe(false);
    expect(forMe(it_(['jh']), '2')).toBe(false);
    expect(forMe(it_(['jh']), 'j1')).toBe(true);
    expect(forMe(it_(['1']), 'j1')).toBe(false); // a 完全中學's 1 is its 高一
    expect(forMe(it_(['some']), '2')).toBe(false);
    expect(forMe({ title: 'not worded yet' }, '2')).toBe(false);
    expect(forMe({ title: '【轉知】文藻外語大學2027文藻國高中雙外語冬令營', who: ['jh', '1', '2', '3'] }, '3')).toBe(false); // 轉知 (Jay 11-11)
    expect(forMe({ title: '<轉知>某大學營隊', who: ['all'] }, '3')).toBe(false);
    expect(isRelay({ title: '【轉知」國立臺北科技大學校慶特展' })).toBe(true);
    expect(forMe({ title: '【流感疫苗】學生公費流感疫苗補接種相關事宜', who: ['all'] }, '3')).toBe(true);
    expect(forMe({ title: '會計與資訊科技碩士在職專班招生', who: ['3'] }, '3')).toBe(false); // grown-ups', whatever the AI said
  });
  it('no grade picked: anything for students', () => {
    expect(forMe(it_(['3']), '')).toBe(true);
    expect(forMe(it_(['some']), '')).toBe(false);
    expect(isSome(it_(['some']))).toBe(true);
  });
  it('進修部 (a school’s night school) by its title: never for a day student, its own tab', () => {
    const night = { title: '【進修部】116學年度四技二專甄選入學對照表', who: ['all'] };
    expect(isNight(night)).toBe(true);
    expect(forMe(night, '3')).toBe(false);
    expect(kindOf(night)).toBe('night');
  });
  it('each one’s kind by code', () => {
    expect(kindOf({ title: '115學年度第1學期第2次期中考考程表' })).toBe('exam');
    expect(kindOf({ title: '【轉知】南華大學特殊選才線上說明會' })).toBe('apply');
    expect(kindOf({ title: '公告本校115學年度第2學期減免學雜費申請' })).toBe('money');
    expect(kindOf({ title: '寒假雙外語冬令營' })).toBe('event');
    expect(kindOf({ title: '11/27(五)全校晚自習暫停乙次' })).toBe('other');
    expect(kindOf({ title: '【轉知】國立清華大學雙外語冬令營' })).toBe('event'); // a university's camp is a camp
    expect(kindOf({ title: '高等教育深耕計畫成果展' })).toBe('event');
    expect(kindOf({ title: '逢甲大學參訪' })).toBe('apply');
    expect(kindOf({ title: '大葉大學116學年度特殊選才招生考試相關訊息' })).toBe('apply'); // a university's entrance test is 升學
    expect(kindOf({ title: '臺灣太空科學聯盟TSU學生日', kind: '活動消息' })).toBe('event'); // its board's name
  });
  it('before the AI words it: who from the title, the title without its tags', () => {
    expect(guessWho({ title: '教師專業發展研習 第二梯次' })).toEqual([]);
    expect(guessWho({ title: '高三模擬考 12/3 舉行' })).toEqual(['3']);
    expect(guessWho({ title: '【全校】學習歷程檔案上傳期程' })).toEqual(['all']);
    expect(guessWho({ title: '南華大學說明會' })).toBe(null);
    expect(forMe({ title: '高三模擬考 12/3 舉行' }, '3')).toBe(true);
    expect(forMe({ title: '高三模擬考 12/3 舉行' }, '2')).toBe(false);
    expect(cleanTitle('【轉知】【全校】寒假營隊開放報名。')).toBe('寒假營隊開放報名');
    expect(cleanTitle('<公告>教育人員任用條例修正')).toBe('教育人員任用條例修正');
    expect(words({ title: 't', line: '學測報名 11/20 截止。' })).toBe('學測報名 11/20 截止');
    expect(words({ title: '【轉知】志工營', line: '' })).toBe('志工營');
  });
});
