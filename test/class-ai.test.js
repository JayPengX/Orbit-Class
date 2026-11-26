// 待辦, 學校公告 (Jay 11-10, the AI plan): what code does around the AI.
// A to-do and the school ride with the timetable (the v2 string), the news
// for this student by grade.
import { describe, expect, it, vi } from 'vitest';
import { normalizeSchool, normalizeTodo, normalizeTodos, todoEntry, todoOf, todosKept } from '../src/todos-data.js';
import { cleanTitle, forMe, guessWho, isNight, isRelay, isSome, kindOf, openUrl, words } from '../src/school-news.js';
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
    // Ticked 5 days late (the late ones are listed first): kept 3 days from the tick, so a mis-tap can be taken back.
    const late = todosKept([{ id: 'L', due: '2026-11-12', done: true, doneOn: '2026-11-17' }], '2026-11-17');
    expect(late.map(x => x.id)).toEqual(['L']);
    expect(todosKept(late, '2026-11-20').map(x => x.id)).toEqual(['L']);
    expect(todosKept(late, '2026-11-21')).toEqual([]);
    const once = normalizeTodo({ id: 'x', text: 'a', done: true, doneOn: '2026-11-08' });
    expect(todoOf(todoEntry(once))).toEqual(once);
  });
  it('ride the v2 string (to every device) and back, a study session the old 讀書計畫 kept too', async () => {
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

describe('學校公告 opened', () => {
  it('once: the kit opener gives back null and nothing opens it again', () => {
    const own = vi.spyOn(window, 'open').mockReturnValue(null);
    const kitOpen = vi.fn(() => null);
    openUrl('https://example.edu.tw/n/1', kitOpen);
    expect(kitOpen).toHaveBeenCalledTimes(1);
    expect(own).not.toHaveBeenCalled();
    // A kit from before openLink: the page's own window.open, once.
    openUrl('https://example.edu.tw/n/1', null);
    expect(own).toHaveBeenCalledTimes(1);
    own.mockRestore();
  });
});

// Jay 11-26: 屏東科技大學公費生單獨招生 and 臺北藝術大學學士班單獨招生 in 高三's 跟你有關: one school's own admission
// is for those who pick that school, not everyone in 高三.
describe("one university's own admission is not 跟你有關", () => {
  it('its 單獨招生 stays out, 學測 stays in', () => {
    expect(forMe({ title: '轉知國立屏東科技大學公費生單獨招生簡章', who: ['3'] }, '3')).toBe(false);
    expect(forMe({ title: '臺北藝術大學學士班單獨招生', line: '臺北藝術大學學士班單獨招生，11/25 截止', who: ['3'] }, '3')).toBe(false);
    expect(forMe({ title: '115學年度學測報名', who: ['3'] }, '3')).toBe(true);
  });
});
