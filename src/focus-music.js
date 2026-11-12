// ---- src/focus-music.js ----
// 專注配樂 (the AI plan's family links, Class + Beats): 專注飛行 can play
// Orbit Beats' calm radio while it flies. The music is Beats' own
// (`/beats/lib/focus.mjs`, imported from its site on the same origin, made
// on this phone); Class only says when: on the tap that starts a flight
// (when 專注配樂 is on in the picker), the screen's ♪ to pause or play, and
// it stops when the flight ends. Its switch is kept on the phone.
const KEY = 'class.focusMusic.v1';
export const musicWanted = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
export const wantMusic = on => {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // (Private browsing: not remembered.)
  }
};

// Beats' module, from its site; null where it can't load (offline, an older Beats).
// (A module that failed once stays failed at its address for the page's life:
// asked again, it's at a new one, so ♪ works once the connection is back.)
let mod = null;
let failed = 0;
const load = () =>
  (mod ||= import(/* @vite-ignore */ new URL(`../beats/lib/focus.mjs${failed ? `?again=${failed}` : ''}`, location.href).href).catch(() => {
    failed += 1;
    mod = null;
    return null;
  }));

let player = null;
let audio = null;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
let state = 'off';
let info = null;
const watchers = new Set();
const tell = () => watchers.forEach(fn => fn(state, info));
export const musicState = () => ({ state, info });
export function onMusic(fn) {
  watchers.add(fn);
  fn(state, info);
  return () => watchers.delete(fn);
}

// In a tap: the music on (made, then playing), paused, or playing again.
export async function toggleMusic() {
  if (state === 'playing') return void player?.pause();
  if (state === 'paused') return void player?.resume();
  if (state === 'making') return;
  await startMusic();
}
export async function startMusic() {
  if (player?.on) return;
  state = 'making';
  tell();
  // (iOS lets a page play only from a tap: the player's element unlocked
  // here, before Beats' module is waited for, and handed to it.)
  audio ||= new Audio();
  audio.src = SILENT;
  audio.play().catch(() => {});
  const m = await load();
  if (!m?.focusMusic) {
    state = 'failed';
    return tell();
  }
  player ||= m.focusMusic({
    audio,
    onState: (s, i) => {
      state = s;
      if (i) info = i;
      tell();
    }
  });
  player.start();
}
export function stopMusic() {
  player?.stop();
  player = null;
  state = 'off';
  info = null;
  tell();
}
// (Warmed while the picker is open: the tap that starts finds it loaded.)
export const warmMusic = () => (musicWanted() ? load() : null);
