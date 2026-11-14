// ---- src/calendar.js ----
// 加到行事曆 (Jay 2026-11-10): the timetable in the phone's own Calendar, by
// subscription, so classes show there, on the lock screen and in Siri, and
// follow every change made here.
//
// The calendar is made here, from what the 課表 tab shows (`classesOn`: the
// week's timetable, odd/even weeks, 調課, Taiwan's days off and typhoon
// stops), for the next WEEKS weeks only: there's no school year to read, so a
// summer with the app unopened runs out instead of filling with classes. It is
// handed to the Worker (Orbit-Core cal.js) when it changes, and at least
// weekly to roll forward; the Worker only keeps it and serves it at a private
// address the Calendar app subscribes to (webcal://). Turned off, that address
// stops answering. Kept on this phone: `class.cal.v1` { url, hash, at }.
//
// 一個行事曆 (the AI plan's family links): the same calendar also holds the
// school days off (Taiwan's holidays and typhoon 停課, all day, from
// holidays.js) and the games followed in Orbit Sports over the next 8 days
// (the family notebook's sports.games, told by Sports; a tap opens the game
// there), so the phone's Calendar shows one week, not three apps'.
import * as kit from '#kit/orbit.mjs';
import { heard } from '#kit/family.mjs';
import { classesOn, getWeekType, processSplitName } from './schedule.js';
import { holidayOn } from './holidays.js';
import { getLocale } from './strings.js';
import { state } from './state.js';

export const WEEKS = 4;
const KEY = 'class.cal.v1';
const ROLL_MS = 6 * 86_400_000;

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const hm = s => String(s || '').replace(':', '') + '00';
const utc = t => new Date(t).toISOString().replace(/[-:]|\.\d+/g, '');
// Text as iCalendar wants it: , ; \ and new lines escaped, lines folded at 75 bytes.
const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => `\\${m}`).replace(/\r?\n/g, '\\n');
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  let n = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (n + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      n = 0;
    }
    cur += ch;
    n += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

// The calendar for `from` (a date) and the WEEKS weeks after its Monday.
// `stamp`: DTSTAMP (kept out of the change check: it's the same calendar).
// `games`: Sports' followed games [{ id, at, mins, title, hash }] (the notebook's, by default).
export function buildIcs(from = new Date(), { stamp = '19700101T000000Z', name = 'Orbit Class', games = followedGames() } = {}) {
  const monday = new Date(from.getFullYear(), from.getMonth(), from.getDate() - ((from.getDay() + 6) % 7));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Orbit//Class//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'X-WR-TIMEZONE:Asia/Taipei',
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Taipei',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];
  for (let i = 0; i < WEEKS * 7; i++) {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const week = getWeekType(date);
    // A school day off (a holiday, a typhoon's 停課), all day.
    const off = date.getDay() % 6 ? holidayOn(date) : null;
    if (off) {
      const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${ymd(date)}-off@class.orbit`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(date)}`,
        `DTEND;VALUE=DATE:${ymd(next)}`,
        `SUMMARY:${esc(getLocale() === 'en' ? off.en || off.zh : off.zh)}`,
        'TRANSP:TRANSPARENT',
        'END:VEVENT'
      );
    }
    for (const c of classesOn(date)) {
      if (!c.s || !c.e) continue;
      const { n, t } = c.swap ? c : processSplitName(c, week);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${ymd(date)}-${c.p}@class.orbit`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Taipei:${ymd(date)}T${hm(c.s)}`,
        `DTEND;TZID=Asia/Taipei:${ymd(date)}T${hm(c.e)}`,
        `SUMMARY:${esc(n)}`,
        ...(c.loc ? [`LOCATION:${esc(c.loc)}`] : []),
        ...(t && t !== n ? [`DESCRIPTION:${esc(t)}`] : []),
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    }
  }
  const end = monday.getTime() + WEEKS * 7 * 86_400_000;
  const site = globalThis.location?.origin || '';
  for (const g of games || []) {
    if (!g?.id || !Number.isFinite(g.at) || g.at < monday.getTime() || g.at >= end) continue;
    lines.push(
      'BEGIN:VEVENT',
      `UID:game-${String(g.id).replace(/[^\w-]/g, '-')}@sports.orbit`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utc(g.at)}`,
      `DTEND:${utc(g.at + (g.mins || 150) * 60_000)}`,
      `SUMMARY:${esc(g.title)}`,
      ...(site && g.hash ? [`URL:${site}/sports/${g.hash}`] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// Sports' followed games, as it last told them (a week old at most).
function followedGames() {
  try {
    const g = heard('sports', 'games', { maxAge: 7 * 86_400_000 });
    return Array.isArray(g) ? g : [];
  } catch {
    return [];
  }
}

function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
const read = () => kit.readJson(KEY, null) ?? null;
const write = v => kit.writeJson(KEY, v);
export const calendarOn = () => !!read()?.url;

async function upload(ics) {
  const r = await kit.workerJson('/cal', 'v=1', { body: JSON.stringify({ ics }), timeout: 15_000, errors: true });
  return r?.url ? r : null;
}
// The address the Calendar app subscribes to.
export const subscribeUrl = url => `${kit.API.replace(/^https?:/, 'webcal:')}${url}`;

// Turned on (a tap): the calendar handed over, then the Calendar app asked to subscribe.
export async function addCalendar() {
  const ics = buildIcs(new Date(), { stamp: new Date().toISOString().replace(/[-:]|\.\d+/g, '') });
  const r = await upload(ics);
  if (!r) return false;
  write({ url: r.url, hash: hashOf(buildIcs()), at: Date.now() });
  const sub = subscribeUrl(r.url);
  // Apple's Calendar takes webcal:// itself; elsewhere Google Calendar's add-by-address.
  const apple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  location.href = apple ? sub : `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(sub)}`;
  return true;
}
export async function stopCalendar() {
  await kit.workerJson('/cal', 'v=1', { body: JSON.stringify({ off: true }), timeout: 15_000 });
  write(null);
}

// Kept current: after the timetable changes (or at least weekly), the new one handed over.
let timer = 0;
export function keepCalendar() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const on = read();
    if (!on?.url || !state.runtimeSchedule) return;
    const plain = buildIcs();
    const hash = hashOf(plain);
    if (hash === on.hash && Date.now() - on.at < ROLL_MS) return;
    const r = await upload(buildIcs(new Date(), { stamp: new Date().toISOString().replace(/[-:]|\.\d+/g, '') }));
    if (r) write({ url: r.url, hash, at: Date.now() });
  }, 4000);
}
