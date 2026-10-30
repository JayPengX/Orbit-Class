import { describe, expect, it } from 'vitest';
import { newFocus, readFocus, planeNow, withFix, wantsHandoff, clock, flightNo, minutesOf, airlineName, cityName, STALE_MS } from '../src/flight-plan.js';

const TPE = { iata: 'TPE', city: 'Taipei', lat: 25.0777, lon: 121.233 };
const NRT = { iata: 'NRT', city: 'Tokyo', lat: 35.7647, lon: 140.386 };
const now = 1_800_000_000_000;
// Half way from Taipei to Tokyo at 450 knots, seen just now.
const flight = { hex: 'abc123', no: 'BR190', airline: { icao: 'EVA', iata: 'BR', name: 'EVA Air' }, from: TPE, to: NRT, fix: { lat: 30.6, lon: 130.5, track: 50, gs: 450, alt: 35000, at: now }, eta: now + 80 * 60_000 };

describe('專注飛行', () => {
  it('a focus kept and read back; anything broken is no focus', () => {
    const f = newFocus(flight, 25, now);
    expect(f.end - f.start).toBe(25 * 60_000);
    expect(readFocus(JSON.stringify(f))).toEqual(f);
    for (const bad of ['', '{', 'null', JSON.stringify({ ...f, legs: [] }), JSON.stringify({ ...f, legs: [{ ...f.legs[0], hex: 'x' }] })]) expect(readFocus(bad)).toBe(null);
  });

  it('the plane flies on from its fix, along the route, never past the airport', () => {
    const leg = newFocus(flight, 25, now).legs[0];
    const a = planeNow(leg, now);
    const b = planeNow(leg, now + 10 * 60_000);
    expect(b.progress).toBeGreaterThan(a.progress);
    expect(b.landed).toBe(false);
    expect(b.stale).toBe(true);
    const late = planeNow(leg, now + 10 * 3_600_000);
    expect(late.landed).toBe(true);
    expect(late.progress).toBe(1);
  });

  it('a new fix moves the landing time; one on the ground lands it', () => {
    const leg = newFocus(flight, 25, now).legs[0];
    const later = withFix(leg, { ...leg.fix, at: now + 60_000 });
    expect(later.eta).toBeGreaterThan(now + 60_000);
    expect(withFix(leg, { ...NRT, gs: 10, ground: true, track: 0, at: now + 60_000 }).landed).toBe(true);
    expect(planeNow(leg, now + STALE_MS - 1).stale).toBe(false);
  });

  it('landed with time to go: another plane; at the very end: none', () => {
    const f = newFocus(flight, 25, now);
    f.legs[0] = { ...f.legs[0], landed: true };
    expect(wantsHandoff(f, now + 60_000)).toBe(true);
    expect(wantsHandoff(f, f.end - 60_000)).toBe(false);
    expect(wantsHandoff({ ...f, done: true }, now)).toBe(false);
  });

  it('times, flight numbers, minutes and names', () => {
    expect(clock(25 * 60_000)).toBe('25:00');
    expect(clock(65 * 60_000 + 9000)).toBe('1:05:09');
    expect(clock(-5)).toBe('00:00');
    expect(flightNo('BR190')).toBe('BR 190');
    expect(flightNo('7C6013')).toBe('7C 6013');
    expect(flightNo('EVA190')).toBe('EVA 190');
    expect(minutesOf('45')).toBe(45);
    expect(minutesOf('5')).toBe(null);
    expect(minutesOf('abc')).toBe(null);
    expect(airlineName(flight.airline, true)).toBe('長榮航空');
    expect(airlineName(flight.airline, false)).toBe('EVA Air');
    expect(cityName(NRT, true)).toBe('東京成田');
    expect(cityName({ iata: 'XYZ', city: 'Somewhere' }, true)).toBe('Somewhere');
    expect(cityName({ iata: 'TLS', city: 'Toulouse/Blagnac' }, true)).toBe('Toulouse');
    expect(cityName({ iata: 'ZZZ', city: 'Shanghai (Pudong)' }, false)).toBe('Shanghai');
  });
});
