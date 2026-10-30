// ---- src/flight-plan.js ----
// 專注飛行's rules, without a page: a focus timer that follows a real plane
// (the proxy's /flight finds one landing in about the minutes chosen). What
// is kept on the phone, where the plane is now between two fixes, when it's
// down, and when the timer hands over to another plane (it landed with time
// still to go). The sphere math is the kit's (kit/flight.mjs), the same the
// proxy picks with.
import { aheadOf, distKm, etaMin, landedFix } from '#kit/flight.mjs';
import { currentLeg, focusLeft } from './flight-store.js';

export { STORE_KEY, readFocus, focusLeft, currentLeg, clock, flightNo } from './flight-store.js';

export const PRESETS = [25, 50, 90];
export const MIN_MIN = 10;
export const MAX_MIN = 180;
// A fix older than this: the plane is out of range (over the sea), its place worked out.
export const STALE_MS = 120_000;
// Time left that's worth another plane when one lands early.
export const HANDOFF_MS = 4 * 60_000;

// The focus as kept: { v, start, end, minutes, legs: [leg], done }. A leg is
// one plane: { hex, no, airline, from, to, type, fix, eta }.
export function newFocus(flight, minutes, now) {
  return { v: 1, start: now, end: now + minutes * 60_000, minutes, legs: [legOf(flight)], done: false };
}
export const legOf = f => ({ hex: f.hex, no: f.no, airline: f.airline || {}, from: f.from, to: f.to, type: f.type || '', fix: f.fix, eta: f.eta });

// A new fix on the plane: its time to landing worked out again from it.
export function withFix(leg, fix) {
  if (!fix) return leg;
  return { ...leg, fix, eta: Math.round(fix.at + etaMin(fix, leg.to, fix.gs) * 60_000), landed: leg.landed || landedFix(fix, leg.to) };
}

// The plane now: where it is (flown on from its fix), whether that's
// worked out (no fix lately), how far along the route, and whether it's down
// (its fix says so, or it was out of range and its time came).
export function planeNow(leg, now) {
  const age = now - leg.fix.at;
  const stale = age > STALE_MS;
  const landed = Boolean(leg.landed) || landedFix(leg.fix, leg.to) || (stale && now >= leg.eta);
  const pos = landed ? { lat: leg.to.lat, lon: leg.to.lon } : aheadOf(leg.fix, leg.to, age);
  const total = distKm(leg.from, leg.to);
  const progress = landed ? 1 : total > 0 ? Math.min(1, Math.max(0, 1 - distKm(pos, leg.to) / total)) : 0;
  return { pos, stale: stale && !landed, landed, progress, eta: landed ? Math.min(leg.eta, now) : Math.max(leg.eta, now) };
}

// Landed with time still to go: another plane for the rest.
export const wantsHandoff = (focus, now) => !focus.done && planeNow(currentLeg(focus), now).landed && focusLeft(focus, now) >= HANDOFF_MS;

// Minutes chosen by hand: whole, within what the proxy finds planes for.
export const minutesOf = v => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= MIN_MIN && n <= MAX_MIN ? n : null;
};

// Names in Chinese where Taiwan has them (the rest as the source has them,
// in English): the airlines people here fly and the airports they fly to.
const AIRLINES_ZH = {
  CAL: '中華航空', EVA: '長榮航空', SJX: '星宇航空', TTW: '台灣虎航', MDA: '華信航空', UIA: '立榮航空', CPA: '國泰航空', HDA: '國泰港龍',
  HKE: '香港快運', CRK: '香港航空', JAL: '日本航空', ANA: '全日空', APJ: '樂桃航空', JJP: '捷星日本', KAL: '大韓航空', AAR: '韓亞航空',
  JNA: '真航空', JJA: '濟州航空', TWB: '德威航空', SIA: '新加坡航空', TGW: '酷航', THA: '泰國航空', VJC: '越捷航空', HVN: '越南航空',
  PAL: '菲律賓航空', CEB: '宿霧太平洋', MAS: '馬來西亞航空', AXM: '亞洲航空', CCA: '中國國際航空', CES: '中國東方航空', CSN: '中國南方航空',
  CXA: '廈門航空', CSZ: '深圳航空', CHH: '海南航空', CSC: '四川航空', CQH: '春秋航空', DKH: '吉祥航空', UAE: '阿聯酋航空', QTR: '卡達航空',
  ETD: '阿提哈德航空', THY: '土耳其航空', DLH: '德國漢莎航空', AFR: '法國航空', BAW: '英國航空', KLM: '荷蘭皇家航空', UAL: '聯合航空',
  DAL: '達美航空', AAL: '美國航空', ACA: '加拿大航空', QFA: '澳洲航空', ANZ: '紐西蘭航空', AIC: '印度航空', SWR: '瑞士航空', FIN: '芬蘭航空'
};
const CITIES_ZH = {
  TPE: '桃園', TSA: '台北松山', KHH: '高雄', RMQ: '台中', TNN: '台南', HUN: '花蓮', TTT: '台東', MZG: '澎湖', KNH: '金門', LZN: '南竿',
  NRT: '東京成田', HND: '東京羽田', KIX: '大阪關西', ITM: '大阪伊丹', NGO: '名古屋', FUK: '福岡', CTS: '札幌', OKA: '沖繩', SDJ: '仙台', KMQ: '小松',
  ICN: '首爾仁川', GMP: '首爾金浦', PUS: '釜山', CJU: '濟州', HKG: '香港', MFM: '澳門', PVG: '上海浦東', SHA: '上海虹橋', PEK: '北京首都',
  PKX: '北京大興', CAN: '廣州', SZX: '深圳', XMN: '廈門', CTU: '成都', TFU: '成都天府', CKG: '重慶', HGH: '杭州', NKG: '南京', WUH: '武漢',
  XIY: '西安', KMG: '昆明', TAO: '青島', DLC: '大連', SIN: '新加坡', BKK: '曼谷', DMK: '曼谷廊曼', SGN: '胡志明市', HAN: '河內', DAD: '峴港',
  MNL: '馬尼拉', CEB: '宿霧', KUL: '吉隆坡', CGK: '雅加達', DPS: '峇里島', DEL: '德里', BOM: '孟買', DXB: '杜拜', DOH: '杜哈', AUH: '阿布達比',
  IST: '伊斯坦堡', FRA: '法蘭克福', MUC: '慕尼黑', LHR: '倫敦希斯洛', LGW: '倫敦蓋威克', CDG: '巴黎', AMS: '阿姆斯特丹', ZRH: '蘇黎世',
  VIE: '維也納', FCO: '羅馬', MAD: '馬德里', BCN: '巴塞隆納', HEL: '赫爾辛基', JFK: '紐約', EWR: '紐瓦克', LAX: '洛杉磯', SFO: '舊金山',
  SEA: '西雅圖', ORD: '芝加哥', IAH: '休士頓', DFW: '達拉斯', ATL: '亞特蘭大', YVR: '溫哥華', YYZ: '多倫多', SYD: '雪梨', MEL: '墨爾本',
  BNE: '布里斯本', AKL: '奧克蘭', GUM: '關島', HNL: '檀香山'
};
export const airlineName = (airline, zh) => (zh && AIRLINES_ZH[airline?.icao]) || airline?.name || '';
export const cityName = (place, zh) => (zh && CITIES_ZH[place?.iata]) || place?.city || place?.iata || '';
// (Whether a name is the source's English, for lang="en" on a Chinese page.)
export const hasZhAirline = airline => Boolean(AIRLINES_ZH[airline?.icao]);
export const hasZhCity = place => Boolean(CITIES_ZH[place?.iata]);
