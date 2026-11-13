// One account, many places (Jay 2026-11-13): a 專注飛行 begun, handed over or
// ended in one place is the account's; Class opened anywhere else flies it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newFocus } from '../src/flight-plan.js';
import { STORE_KEY, focusChanged, focusFromPass, loadFocus } from '../src/flight-store.js';

const TPE = { iata: 'TPE', city: 'Taipei', lat: 25.0777, lon: 121.233 };
const NRT = { iata: 'NRT', city: 'Tokyo', lat: 35.7647, lon: 140.386 };
const now = 1_800_000_000_000;
const flight = { hex: 'abc123', no: 'BR190', airline: { icao: 'EVA', iata: 'BR', name: 'EVA Air' }, from: TPE, to: NRT, fix: { lat: 30.6, lon: 130.5, track: 50, gs: 450, alt: 35000, at: now }, eta: now + 80 * 60_000 };
const session = (live = true) => ({ canSave: live, puts: [], putNow(key, v, at, opts) { this.puts.push({ key, v, at, ...(opts?.until ? { until: opts.until } : {}) }); } });

describe('專注飛行 on the Pass', () => {
  beforeEach(() => localStorage.clear());

  it('begun here: sent up from the place that runs Class (once it has heard the Pass), never from a paused copy', () => {
    const q = session();
    focusChanged(q, null, now - 10);
    expect(q.puts).toEqual([]);
    focusFromPass(q, {});
    expect(q.puts).toEqual([{ key: 'flight', v: null, at: now - 10 }]);
    q.puts.length = 0;
    const f = newFocus(flight, 25, now);
    focusChanged(q, f, now);
    expect(q.puts).toEqual([{ key: 'flight', v: f, at: now, until: f.end }]);
    const paused = session(false);
    focusChanged(paused, null, now + 1);
    expect(paused.puts).toEqual([]);
  });

  it("another place's newer focus is kept here; an end there ends it here; an older one isn't", () => {
    const q = session();
    const f = newFocus(flight, 50, now);
    expect(focusFromPass(q, { flight: { v: f, at: now } })).toBe(true);
    expect(loadFocus()).toEqual(f);
    expect(focusFromPass(q, { flight: { v: null, at: now - 5 } })).toBe(false);
    expect(loadFocus()).toEqual(f);
    expect(focusFromPass(q, { flight: { v: null, at: now + 5 } })).toBe(true);
    expect(localStorage.getItem(STORE_KEY)).toBe(null);
  });

  it('a change here the Pass never got (no connection) goes up again', () => {
    const q = session();
    const f = newFocus(flight, 25, now);
    localStorage.setItem(STORE_KEY, JSON.stringify(f));
    focusChanged(session(), f, now + 10);
    expect(focusFromPass(q, { flight: { v: null, at: now } })).toBe(false);
    expect(q.puts).toEqual([{ key: 'flight', v: f, at: now + 10, until: f.end }]);
  });

  it('an opening reads the Pass first: a flight kept here landing as Class opens gives way to an end made elsewhere', async () => {
    vi.resetModules();
    const S = await import('../src/flight-store.js');
    const f = newFocus(flight, 25, now);
    localStorage.setItem(S.STORE_KEY, JSON.stringify(f));
    localStorage.setItem('class.flight.at', String(now));
    const q = session();
    S.focusChanged(q, { ...f, done: true }, now + 60 * 60_000);
    expect(q.puts).toEqual([]);
    expect(S.focusFromPass(q, { flight: { v: null, at: now + 5 * 60_000 } })).toBe(true);
    expect(localStorage.getItem(S.STORE_KEY)).toBe(null);
    expect(q.puts).toEqual([]);
  });
});
