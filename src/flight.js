// ---- src/flight.js ----
// 專注飛行: a focus timer that follows a real plane. 工具 opens a sheet:
// how long (25, 50, 90 or typed), then three real flights in the air now
// that land in about that time (the proxy's /flight). Picking one fills the
// screen with a map of it flying, the time left large; it lands about when
// the time's up. A plane that lands early hands over to another for the
// rest. The rules (what's kept, where the plane is, when it's down) are
// flight-plan.js's; the map is Leaflet on Esri's satellite tiles, loaded only here.
import * as kitUI from '#kit/ui.mjs';
import * as kit from '#kit/orbit.mjs';
import { bearing, gcLine, lonNear, distKm } from '#kit/flight.mjs';
import { proxyPath } from './proxy-config.js';
import { sessionUrl, setFocusNotice } from './sync.js';
import { getLocale, t } from './strings.js';
import { el, button } from './ui.js';
import {
  STORE_KEY,
  PRESETS,
  MIN_MIN,
  MAX_MIN,
  newFocus,
  legOf,
  focusLeft,
  currentLeg,
  withFix,
  planeNow,
  wantsHandoff,
  clock,
  flightNo,
  minutesOf,
  airlineName,
  cityName,
  hasZhAirline,
  hasZhCity
} from './flight-plan.js';
import { loadFocus } from './flight-store.js';

const zh = () => getLocale() !== 'en';
const POLL_MS = 15_000;
const PICKS_MS = 45_000;
const MIN_KEY = 'class.flight.min';

// ---- Kept on the phone ----
function save(focus) {
  try {
    if (focus) localStorage.setItem(STORE_KEY, JSON.stringify(focus));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    // (Private browsing, or a full store: this run still works.)
  }
}
let focus = loadFocus();

// ---- The proxy ----
async function getJson(query) {
  const res = await fetch(await sessionUrl(`${proxyPath('/flight')}?${query}`), { cache: 'no-store' });
  if (!res.ok) throw new Error(`flight ${res.status}`);
  return res.json();
}
const picksKept = new Map();
async function picks(minutes) {
  const kept = picksKept.get(minutes);
  if (kept && Date.now() - kept.at < PICKS_MS) return kept.flights;
  const { flights } = await getJson(`min=${minutes}`);
  if (!Array.isArray(flights)) throw new Error('flight shape');
  picksKept.set(minutes, { at: Date.now(), flights });
  return flights;
}

// ---- Pictures and names ----
const PLANE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8c.9 0 1.5 1 1.5 2.2v5.1l7.7 4.6v2.1l-7.7-2.4v4.7l2.3 1.8v1.7L12 20.6l-3.8 1v-1.7l2.3-1.8v-4.7l-7.7 2.4v-2.1l7.7-4.6V4c0-1.2.6-2.2 1.5-2.2z"/></svg>';
const iataOf = leg => leg.airline?.iata || (/^[A-Z0-9]{2}\d/.test(leg.no || '') ? leg.no.slice(0, 2) : '');
function airlineLogo(leg, size = 40) {
  const box = el('span', 'cx-fl-logo');
  box.style.setProperty('--s', `${size}px`);
  const fallback = () => {
    box.classList.add('is-mark');
    box.innerHTML = PLANE;
  };
  const code = iataOf(leg);
  if (!code) fallback();
  else {
    const img = el('img');
    img.alt = '';
    img.decoding = 'async';
    img.src = `https://pics.avs.io/al_square/64/64/${encodeURIComponent(code)}@2x.png`;
    img.addEventListener('error', () => (img.remove(), fallback()), { once: true });
    box.append(img);
  }
  return box;
}
// A name as its own language (the source's English on a Chinese page).
function named(text, isZh) {
  const node = el('span', '', text);
  if (zh() && !isZh) node.lang = 'en';
  return node;
}
const city = place => named(cityName(place, zh()), hasZhCity(place));
const airline = leg => named(airlineName(leg.airline, zh()) || leg.no, hasZhAirline(leg.airline));
const hhmm = ms => new Date(ms).toLocaleTimeString(zh() ? 'zh-TW' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString(zh() ? 'zh-TW' : 'en-US', { maximumFractionDigits: d }) : '—');

// ---- The sheet: how long, then which plane ----
let sheet = null;
export function openFlight() {
  if (focus) return openFocus();
  let minutes = Number(localStorage.getItem(MIN_KEY)) || PRESETS[0];
  const custom = !PRESETS.includes(minutes);
  const list = el('div', 'q-rowcard cx-fl-picks');
  const input = el('input', 'cx-fl-custom-input');
  Object.assign(input, { type: 'number', inputMode: 'numeric', min: String(MIN_MIN), max: String(MAX_MIN), step: '1', value: custom ? String(minutes) : '' });
  input.setAttribute('aria-label', t('flight.customLabel'));
  const customRow = el('label', 'cx-fl-custom', [input, el('span', '', t('flight.customLabel'))]);
  customRow.hidden = !custom;
  let ask = 0;
  const show = async () => {
    const n = minutes;
    const mine = ++ask;
    list.replaceChildren(...[0, 1, 2].map(() => el('div', 'q-ritem cx-fl-skel', [el('span', 'q-skel cx-fl-skel-logo'), el('span', 'cx-fl-skel-text', [el('span', 'q-skel'), el('span', 'q-skel')])])));
    let flights;
    try {
      flights = await picks(n);
    } catch {
      if (mine === ask) list.replaceChildren(kitUI.empty({ icon: 'map', title: t('flight.failed'), body: t('flight.failedBody'), action: { label: t('flight.retry'), onClick: show } }));
      return;
    }
    if (mine !== ask) return;
    if (!flights.length) {
      list.replaceChildren(kitUI.empty({ icon: 'clock', title: t('flight.none', { n }), body: t('flight.noneBody'), action: { label: t('flight.retry'), onClick: () => (picksKept.delete(n), show()) } }));
      return;
    }
    const now = Date.now();
    list.replaceChildren(
      ...flights.map(f => {
        const leg = legOf(f);
        const row = button('q-ritem cx-fl-pick chevron', () => start(f, n), [
          airlineLogo(leg),
          el('span', 'q-ritem-text', [el('span', 'q-ritem-title cx-fl-route', [city(f.to)]), el('small', '', [t('flight.fromCity'), city(f.from), ` · ${flightNo(f.no)}`])]),
          el('span', 'q-ritem-end cx-fl-in', t('flight.landsIn', { n: Math.max(1, Math.round((f.eta - now) / 60_000)) }))
        ]);
        return row;
      })
    );
  };
  const choose = n => {
    if (!n || n === minutes) return;
    minutes = n;
    try {
      localStorage.setItem(MIN_KEY, String(n));
    } catch {
      // (Private browsing: the choice isn't remembered.)
    }
    show();
  };
  const seg = kitUI.segmented([...PRESETS.map(n => ({ id: String(n), label: t('flight.minutes', { n }) })), { id: 'custom', label: t('flight.custom') }], {
    value: custom ? 'custom' : String(minutes),
    label: t('flight.title'),
    onChange: id => {
      customRow.hidden = id !== 'custom';
      if (id === 'custom') {
        input.value ||= String(minutes);
        input.focus();
        return;
      }
      choose(Number(id));
    }
  });
  let typing = 0;
  input.addEventListener('input', () => {
    clearTimeout(typing);
    typing = setTimeout(() => choose(minutesOf(input.value)), 700);
  });
  input.addEventListener('change', () => {
    const n = minutesOf(input.value);
    if (!n) input.value = String(minutes);
    choose(n);
  });
  sheet = kitUI.sheet({
    title: t('flight.title'),
    cls: 'cx-fl-sheet',
    closeLabel: t('common.close'),
    body: [el('div', 'cx-fl-how', [seg, customRow]), kitUI.section(t('flight.pickSection'), list)],
    onClose: () => {
      sheet = null;
      ask += 1;
    }
  });
  show();
}

function start(flight, minutes) {
  focus = newFocus(flight, minutes, Date.now());
  save(focus);
  bookNotice();
  sheet?.close();
  kitUI.tick?.();
  openFocus();
}
function bookNotice() {
  setFocusNotice(focus && !focus.done ? { at: focus.end, title: t('flight.notice'), body: t('flight.focused', { n: focus.minutes }), tag: 'focus' } : null);
}

// ---- The screen while it flies ----
let screen = null;
async function openFocus() {
  if (screen || !focus) return;
  const root = el('div', 'cx-fl');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', t('flight.title'));
  const mapBox = el('div', 'cx-fl-map');
  const end = button('q-btn glass small cx-fl-endbtn', endEarly, t('flight.end'));
  const recenter = button('q-icon-btn q-glass cx-fl-recenter', follow);
  recenter.innerHTML = kitUI.icons.target;
  recenter.setAttribute('aria-label', t('flight.recenter'));
  recenter.hidden = true;
  const card = el('section', 'cx-fl-card q-glass');
  // (Clouds drifting past below the plane, the way it flies: the feel of speed.)
  const sky = el('div', 'cx-fl-sky', [el('i'), el('i'), el('i')]);
  sky.setAttribute('aria-hidden', 'true');
  const planeEl = el('div', 'cx-fl-plane');
  planeEl.innerHTML = `<span class="cx-fl-shadow">${PLANE}</span><span class="cx-fl-body">${PLANE}</span>`;
  planeEl.hidden = true;
  root.append(mapBox, sky, planeEl, el('div', 'cx-fl-top', [end, recenter]), card);
  document.body.append(root);
  document.body.classList.add('cx-flying');
  screen = { root, mapBox, card, recenter, planeEl, map: null, layers: null, mode: 'intro', legHex: '', drawn: '', timer: 0, poller: 0, handing: 0, watching: false, lock: null };
  draw();
  screen.timer = setInterval(draw, 1000);
  screen.poller = setInterval(poll, POLL_MS);
  poll();
  keepAwake();
  document.addEventListener('visibilitychange', onVisible);
  try {
    await mapOf(screen);
    if (screen) screen.raf = requestAnimationFrame(frame);
  } catch {
    // (No map, no network for its code: the time and the flight still run.)
    mapBox.classList.add('is-off');
  }
}
function closeFocus() {
  if (!screen) return;
  clearInterval(screen.timer);
  clearInterval(screen.poller);
  cancelAnimationFrame(screen.raf);
  clearTimeout(screen.introTimer);
  document.removeEventListener('visibilitychange', onVisible);
  screen.lock?.release?.().catch?.(() => {});
  screen.map?.remove();
  screen.root.remove();
  document.body.classList.remove('cx-flying');
  screen = null;
}
function onVisible() {
  if (document.hidden || !screen) return;
  keepAwake();
  poll();
  draw();
}
// The screen stays on while it's shown (a timer to glance at).
async function keepAwake() {
  try {
    if (!screen || (screen.lock && !screen.lock.released)) return;
    screen.lock = await navigator.wakeLock?.request?.('screen');
  } catch {
    // (No wake lock on this phone: the screen sleeps as usual.)
  }
}

async function poll() {
  if (!focus || !screen || document.hidden) return;
  const leg = currentLeg(focus);
  if (planeNow(leg, Date.now()).landed) return;
  try {
    const { fix } = await getJson(`hex=${leg.hex}`);
    // (Out of range is no news: its place is worked out from the last fix.)
    if (!fix || !focus || currentLeg(focus).hex !== leg.hex || fix.at <= leg.fix.at) return;
    focus.legs[focus.legs.length - 1] = withFix(leg, fix);
    save(focus);
    draw();
  } catch {
    // (A failed read: the next one in 15 s; meanwhile it flies on from its last fix.)
  }
}

// Landed with time still to go: the closest plane landing at the time left.
async function handOff() {
  if (!screen || Date.now() - screen.handing < 60_000) return;
  screen.handing = Date.now();
  const leg = currentLeg(focus);
  try {
    const left = Math.round(focusLeft(focus, Date.now()) / 60_000);
    const flights = await getJson(`min=${Math.max(MIN_MIN, Math.min(MAX_MIN, left))}`).then(x => x.flights || []);
    const next = flights.find(f => f.hex !== leg.hex);
    if (!next || !focus || focus.done) return;
    focus.legs.push(legOf(next));
    save(focus);
    kitUI.toast(t('flight.handoff', { no: flightNo(leg.no), city: cityName(leg.to, zh()), next: flightNo(next.no) }), { ms: 4000 });
    draw();
  } catch {
    // (Tried again in a minute.)
  }
}

async function endEarly() {
  const ok = await kit.ask({ title: t('flight.endAsk'), body: t('flight.endBody'), ok: t('flight.end'), cancel: t('flight.keep'), danger: true, lang: zh() ? 'zh' : 'en' });
  if (!ok) return;
  finishUp();
}
function finishUp() {
  focus = null;
  save(null);
  bookNotice();
  closeFocus();
}

// ---- The map: alive, more film than chart ----
// The plane glides every frame (its place worked out from the last fix),
// the camera rides with it, clouds drift past under it the way it's going,
// its trail glows behind and the airport ahead pulses. On opening, the whole
// route first, then the camera flies in to the plane.
// (Esri's world imagery: the ground as seen from the plane, dimmed at night by the CSS.)
const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const FOLLOW_ZOOM = 8;
let leaflet = null;
async function mapOf(s) {
  leaflet ||= Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([m]) => m.default || m);
  const L = await leaflet;
  if (screen !== s) return;
  const map = L.map(s.mapBox, { zoomControl: false, attributionControl: true, minZoom: 2, maxZoom: 11, zoomSnap: 0, fadeAnimation: true, inertia: true });
  map.attributionControl.setPrefix(false).setPosition('topright');
  L.tileLayer(TILES, { maxZoom: 11, keepBuffer: 4, updateWhenZooming: false, className: 'cx-fl-tiles', attribution: 'Esri, Maxar, Earthstar Geographics' }).addTo(map);
  // A finger on the map: it stays where it's put, until 回到飛機.
  const mine = () => {
    s.mode = 'free';
    s.recenter.hidden = false;
  };
  s.mapBox.addEventListener('pointerdown', mine);
  s.mapBox.addEventListener('wheel', mine, { passive: true });
  s.L = L;
  s.map = map;
}

// The leg's lines, airports and plane, once per plane.
function setLeg(leg) {
  const s = screen;
  const L = s.L;
  s.layers?.forEach(x => x.remove());
  const route = gcLine(leg.from, leg.to, 128);
  const lonAt = f => route[Math.round(Math.min(1, Math.max(0, f)) * (route.length - 1))][1];
  const airport = (place, lon, cls) =>
    L.marker([place.lat, lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: `cx-fl-port ${cls}`, html: `<i></i><b>${place.iata || place.icao || ''}</b>`, iconSize: [0, 0] }) });
  const ahead = L.polyline(route, { className: 'cx-fl-ahead', interactive: false });
  const glow = L.polyline([], { className: 'cx-fl-glow', interactive: false });
  const flown = L.polyline([], { className: 'cx-fl-flown', interactive: false });
  s.layers = [ahead, glow, flown, airport(leg.from, route[0][1], 'is-from'), airport(leg.to, route.at(-1)[1], 'is-to')].map(x => x.addTo(s.map));
  Object.assign(s, { legHex: leg.hex, route, lonAt, at: null, ahead, flown, glow, trailAt: 0, heading: null });
  // The whole route, then in to the plane.
  s.mode = 'intro';
  s.recenter.hidden = true;
  s.map.fitBounds(L.latLngBounds(route), { paddingTopLeft: [32, topEdge() + 24], paddingBottomRight: [32, cardRoom() + 24], animate: false });
  clearTimeout(s.introTimer);
  s.introTimer = setTimeout(() => flyIn(), 1600);
}
const topEdge = () => screen?.root.querySelector('.cx-fl-top')?.getBoundingClientRect().bottom || 60;
const cardRoom = () => (screen ? innerHeight - screen.card.getBoundingClientRect().top : 240);
// Where the camera looks so the plane sits a little above the middle of the map's open part.
function cameraFor(at, zoom) {
  const s = screen;
  const mid = (topEdge() + (innerHeight - cardRoom())) / 2;
  const dy = innerHeight / 2 - mid + 20;
  const pt = s.map.project(at, zoom).add([0, dy]);
  return s.map.unproject(pt, zoom);
}
function flyIn() {
  const s = screen;
  if (!s?.map) return;
  s.mode = 'flyin';
  s.recenter.hidden = true;
  const at = s.at;
  if (!at) return;
  s.map.flyTo(cameraFor(at, FOLLOW_ZOOM), FOLLOW_ZOOM, { duration: 2.4, easeLinearity: 0.2 });
  s.map.once('moveend', () => s.mode === 'flyin' && (s.mode = 'follow'));
}
function follow() {
  flyIn();
}

// Every frame: the plane, its heading eased, the trail, the camera, the clouds.
function frame() {
  const s = screen;
  if (!s) return;
  s.raf = requestAnimationFrame(frame);
  if (!s.map || !focus || document.hidden) return;
  const leg = currentLeg(focus);
  const now = Date.now();
  const p = planeNow(leg, now);
  if (s.legHex !== leg.hex) setLeg(leg);
  const lon = lonNear(p.pos.lon, s.lonAt(p.progress));
  const at = s.L.latLng(p.pos.lat, lon);
  s.at = at;
  const close = distKm(p.pos, leg.to) < 60;
  const want = p.landed ? s.heading ?? 0 : close && Number.isFinite(leg.fix.track) ? leg.fix.track : bearing(p.pos, leg.to);
  const turnBy = ((((want - (s.heading ?? want)) % 360) + 540) % 360) - 180;
  s.heading = ((s.heading ?? want) + turnBy * 0.08 + 360) % 360;
  s.root.style.setProperty('--hdg', `${s.heading}deg`);
  s.planeEl.classList.toggle('is-down', p.landed);
  s.planeEl.classList.toggle('is-stale', p.stale);
  s.root.classList.toggle('is-landed', p.landed);
  // (The trail drawn again twice a second: a line of 60 points is enough work.)
  if (now - s.trailAt > 500) {
    s.trailAt = now;
    const line = [...gcLine(leg.from, p.pos, 60, s.route[0][1]).slice(0, -1), [at.lat, at.lng]];
    s.flown.setLatLngs(line);
    // (What's left from the plane itself: a real plane is never quite on the great circle.)
    s.ahead.setLatLngs(p.landed ? [] : gcLine(p.pos, leg.to, 60, at.lng));
    s.glow.setLatLngs(line.slice(-Math.max(2, Math.round(line.length * 0.25))));
  }
  if (s.mode === 'follow') s.map.setView(cameraFor(at, s.map.getZoom()), s.map.getZoom(), { animate: false });
  // (The plane drawn over the map and its clouds, where the map puts it.)
  const pt = s.map.latLngToContainerPoint(at);
  s.planeEl.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`;
  s.planeEl.hidden = false;
}

// ---- Drawn every second ----
function draw() {
  if (!screen || !focus) return;
  const now = Date.now();
  if (!focus.done && now >= focus.end) {
    focus.done = true;
    focus.doneAt = focus.end;
    save(focus);
    bookNotice();
    kitUI.tick?.();
  }
  if (!focus.done && wantsHandoff(focus, now)) handOff();
  const leg = currentLeg(focus);
  const p = planeNow(leg, now);
  if (focus.done && screen.watching && p.landed) screen.watching = false;
  const view = focus.done ? (screen.watching ? 'watch' : 'end') : 'fly';
  const key = `${view}|${leg.hex}`;
  if (screen.drawn !== key) {
    screen.drawn = key;
    screen.card.replaceChildren(...(view === 'end' ? endCard(leg, p) : flyCard(leg)));
    screen.card.dataset.view = view;
    // (Done: 完成 on the card ends it; no 結束 above.)
    screen.root.querySelector('.cx-fl-endbtn').hidden = view !== 'fly';
  }
  if (view === 'end') return;
  const q = sel => screen.card.querySelector(sel);
  q('.cx-fl-clock').textContent = clock(view === 'fly' ? focusLeft(focus, now) : p.eta - now);
  q('.cx-fl-bar i').style.width = `${(p.progress * 100).toFixed(2)}%`;
  q('.cx-fl-bar b').style.left = `${(p.progress * 100).toFixed(2)}%`;
  q('[data-v="eta"]').textContent = hhmm(p.eta);
  q('[data-v="alt"]').textContent = p.landed ? '0' : Number.isFinite(leg.fix.alt) ? fmt(leg.fix.alt * 0.3048, 0) : '—';
  q('[data-v="gs"]').textContent = p.landed ? '0' : fmt(leg.fix.gs * 1.852, 0);
  q('.cx-fl-stale').hidden = !p.stale;
}

function head(leg) {
  return el('div', 'cx-fl-head', [airlineLogo(leg, 36), el('div', 'cx-fl-id', [el('strong', '', flightNo(leg.no)), el('small', '', [airline(leg)])]), el('span', 'cx-fl-stale q-tag', t('flight.estimated'))]);
}
function routeRow(leg) {
  const bar = el('div', 'cx-fl-bar', [el('i'), el('b')]);
  bar.querySelector('b').innerHTML = PLANE;
  const end = (place, cls) => el('div', `cx-fl-end ${cls}`, [el('strong', '', place.iata || place.icao || ''), el('small', '', [city(place)])]);
  return el('div', 'cx-fl-route-row', [end(leg.from, 'is-from'), bar, end(leg.to, 'is-to')]);
}
function stats() {
  const one = (label, key, unit) => {
    const v = el('b', 'num');
    v.dataset.v = key;
    return el('div', 'cx-fl-stat', [el('small', '', label), el('span', '', [v, unit ? el('small', '', ` ${unit}`) : null])]);
  };
  return el('div', 'cx-fl-stats', [one(t('flight.lands'), 'eta', ''), one(t('flight.alt'), 'alt', 'm'), one(t('flight.speed'), 'gs', 'km/h')]);
}
function flyCard(leg) {
  const label = screen.watching ? el('small', 'cx-fl-clock-label', t('flight.lands')) : null;
  return [head(leg), label, el('div', 'cx-fl-clock num', ''), routeRow(leg), stats()].filter(Boolean);
}
function endCard(leg, p) {
  const first = focus.legs[0];
  const title = p.landed ? t('flight.arrived', { city: cityName(leg.to, zh()) }) : t('flight.timeUp');
  const lines = [t('flight.focused', { n: focus.minutes }), focus.legs.length > 1 ? t('flight.transfers', { n: focus.legs.length - 1 }) : null].filter(Boolean).join(' · ');
  const still = p.landed ? null : el('p', 'cx-fl-still', t('flight.stillFlying', { no: flightNo(leg.no), n: Math.max(1, Math.round((p.eta - Date.now()) / 60_000)) }));
  const trip = el('div', 'cx-fl-trip', [el('strong', '', first.from.iata || ''), el('span', 'cx-fl-trip-line', [el('i')]), el('strong', '', leg.to.iata || '')]);
  trip.querySelector('.cx-fl-trip-line i').innerHTML = PLANE;
  const done = button('q-btn primary large block', finishUp, t('flight.done'));
  const watch = p.landed
    ? null
    : button('q-btn large block', () => {
        screen.watching = true;
        draw();
      }, t('flight.watch'));
  return [el('div', 'cx-fl-done', [trip, el('h2', '', title), el('p', 'cx-fl-done-sub', lines), still]), el('div', 'cx-fl-actions', [done, watch])];
}

// Opened again with a focus running (the app closed mid-flight): straight back to it.
export function resumeFlight() {
  if (!focus) return;
  bookNotice();
  openFocus();
}
