import { describe, expect, it } from 'vitest';
import { musicWanted, wantMusic, onMusic, stopMusic, warmMusic } from '../src/focus-music.js';

// 專注配樂 (src/focus-music.js): the switch is kept on the phone; the screen's ♪ hears every change.
describe('focus music', () => {
  it('the switch is remembered, off by default', () => {
    localStorage.removeItem('class.focusMusic.v1');
    expect(musicWanted()).toBe(false);
    expect(warmMusic()).toBe(null);
    wantMusic(true);
    expect(musicWanted()).toBe(true);
    wantMusic(false);
    expect(musicWanted()).toBe(false);
  });
  it('a watcher hears the state at once and when it stops, and lets go', () => {
    const heard = [];
    const off = onMusic(s => heard.push(s));
    stopMusic();
    off();
    stopMusic();
    expect(heard).toEqual(['off', 'off']);
  });
});
