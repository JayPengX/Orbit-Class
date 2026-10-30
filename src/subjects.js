import * as kitUI from '#kit/ui.mjs';
import { state } from './state.js';
// ---- src/subjects.js ----
// Every subject's picture: an icon and a colour, from its name (Traditional
// Chinese first, English too), as the family gives every team its logo and
// every player a face. A subject the list doesn't know gets a book in a
// colour of its own (the same every time for the same name).
//
//   subjectLook('物理')        → { key: 'physics', color: '#8b5cf6', icon: '<svg…>' }
//   subjectTile('物理', 'sm') → a kit .q-tile in its colour

// The icons: 24×24, drawn with a 2px stroke in currentColor (Lucide's way).
const P = {
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7h8M8 11h6"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  speech: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 10h6M9 14h4"/>',
  sigma: '<path d="M18 6V4H6l6 8-6 8h12v-2"/>',
  atom: '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/>',
  flask: '<path d="M9 3h6M10 3v6L4.6 18.2A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.8L14 9V3"/><path d="M7.5 15h9"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 6-9 16-10-1 10-4 16-10 16"/><path d="M4 21c3-5 6-8 11-11"/>',
  globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5a14.5 14.5 0 0 1 0 19M12 2.5a14.5 14.5 0 0 0 0 19"/>',
  mountain: '<path d="M3 20 9.5 8l4 7 2.5-4L21 20z"/><circle cx="17" cy="5" r="1.8"/>',
  landmark: '<path d="M3 21h18M5 18v-7M9.5 18v-7M14.5 18v-7M19 18v-7M2.5 10 12 4l9.5 6z"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="m5 7-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z"/>',
  ball: '<circle cx="12" cy="12" r="9.5"/><path d="M12 2.5v19M2.5 12h19"/><path d="M5.3 5.3c3.5 3 3.5 10.4 0 13.4M18.7 5.3c-3.5 3-3.5 10.4 0 13.4"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  palette: '<path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4.5 4H16a2 2 0 0 0-1.4 3.4A1.7 1.7 0 0 1 12 22z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/>',
  laptop: '<rect x="4" y="4" width="16" height="11" rx="2"/><path d="M2 20h20M9 9.5l-1.8 1.5L9 12.5M15 9.5l1.8 1.5-1.8 1.5"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-8-8 1.7-1.3a4 4 0 0 0 5-5L13 5z"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  heart: '<path d="M20.8 5.6a5.4 5.4 0 0 0-7.7 0L12 6.7l-1.1-1.1a5.4 5.4 0 1 0-7.7 7.7L12 22l8.8-8.7a5.4 5.4 0 0 0 0-7.7z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14a5 5 0 0 1 5 5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  compass: '<circle cx="12" cy="12" r="9.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  languages: '<path d="M4 5h8M8 3v2M5.5 5a9 9 0 0 0 5.5 7.5M10.5 5A9 9 0 0 1 4 12.5"/><path d="m12 21 4.5-10L21 21M13.5 17.5h6"/>',
  dna: '<path d="M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12"/><path d="M8.5 7h7M8.5 17h7"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2l-1.3 1.3L10 11l-3 3H4l-1 1 3 2 2 3 1-1v-3l3-3 3.5 6.5z"/>',
  flag: '<path d="M4 22V3M4 4h12l-2 4 2 4H4"/>',
  cup: '<path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M7 2v3M11 2v3"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  feather: '<path d="M20.2 3.8a5.5 5.5 0 0 0-7.8 0L5 11.2V19h7.8l7.4-7.4a5.5 5.5 0 0 0 0-7.8z"/><path d="M16 8 2 22M17.5 15H9"/>',
  scroll: '<path d="M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
  bookA: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="m8.5 13 3.5-7 3.5 7M9.5 11h5"/>',
  microscope: '<path d="M6 18h8M3 22h18M14 22a7 7 0 1 0 0-14h-1M9 14h2M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2zM12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>',
  magnet: '<path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15M5 8l4 4M12 15l4 4"/>',
  calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0zM14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  film: '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3zM6.2 5.3l3.1 3.9M12.4 3.4l3.1 4M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  sprout: '<path d="M7 20h10M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8zM14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  rainbow: '<path d="M22 17a10 10 0 0 0-20 0M6 17a6 6 0 0 1 12 0M10 17a2 2 0 0 1 4 0"/>',
  map: '<path d="M14.1 6.1 9.9 3.9a2 2 0 0 0-1.8 0L3.6 6.2A1 1 0 0 0 3 7.1v12.3a1 1 0 0 0 1.4.9l3.7-1.9a2 2 0 0 1 1.8 0l4.2 2.1a2 2 0 0 0 1.8 0l4.5-2.3a1 1 0 0 0 .6-.9V5a1 1 0 0 0-1.4-.9l-3.7 1.9a2 2 0 0 1-1.8 0zM15 5.8v15M9 3.2v15"/>',
  hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1zM12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
  dumbbell: '<path d="M14.4 14.4 9.6 9.6M18.7 21.5a2 2 0 1 1-2.8-2.8l-1.8 1.8a2 2 0 1 1-2.8-2.8l6.2-6.2a2 2 0 1 1 2.8 2.8l-1.8 1.8a2 2 0 1 1 2.8 2.8zM21.5 21.5l-1.4-1.4M3.9 3.9 2.5 2.5M6.4 12.8a2 2 0 1 1-2.8-2.8l1.8-1.8a2 2 0 1 1-2.8-2.8l2.8-2.8a2 2 0 1 1 2.8 2.8l1.8-1.8a2 2 0 1 1 2.8 2.8z"/>',
  waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18M7 6h1v4M16.7 13.9l.7.7-2.8 2.8"/>',
  gavel: '<path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>',
  star: '<path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'
};

// Name → look. The first rule whose words the name contains wins, so the
// narrower ones (地球科學 before 地理, 生活科技 before 科技) come first.
const RULES = [
  ['earth', 'mountain', '#b7791f', /地科|地球科學|earth/i],
  ['life-tech', 'wrench', '#64748b', /生活科技|生科|家政|工藝|technology|craft/i],
  ['stem', 'rocket', '#4f46e5', /天文|機器人|創客|stem|robot|maker/i],
  ['computer', 'laptop', '#475569', /資訊|資科|電腦|程式|計算機|資訊科技|computer|coding|programming|\bit\b/i],
  ['diversity', 'rainbow', '#c2410c', /族群|性別|多元文化|平權|gender|diversity/i],
  ['writing', 'feather', '#be123c', /國寫|寫作|作文|writing/i],
  ['classics', 'scroll', '#9f1239', /古文|國學|經典|論語|classics/i],
  ['chinese', 'book', '#e5484d', /國文|國語|語文|中文|文學|閱讀|chinese/i],
  ['english', 'speech', '#2563eb', /英文|英語|english/i],
  ['language', 'languages', '#0891b2', /日文|日語|韓文|韓語|法文|法語|德文|德語|西班牙|外語|第二外|language|japanese|french|german|spanish|korean/i],
  ['math', 'sigma', '#6366f1', /數學|數甲|數乙|數a|數b|算數|math|calculus|algebra|geometry|statistics/i],
  ['physics', 'atom', '#8b5cf6', /物理|physics/i],
  ['chemistry', 'flask', '#0d9488', /化學|chemistry/i],
  ['biology', 'dna', '#16a34a', /生物|biology/i],
  ['inquiry', 'microscope', '#0e7490', /探究|實驗|研究|inquiry|\blab\b/i],
  ['science', 'magnet', '#0ea5e9', /自然|理化|科學|science/i],
  ['history', 'landmark', '#d97706', /歷史|history/i],
  ['geography', 'globe', '#0891b2', /地理|geography/i],
  ['environment', 'sprout', '#15803d', /環境|永續|園藝|農業|environment|sustainab/i],
  ['economics', 'coins', '#a16207', /經濟|理財|economics|finance/i],
  ['law', 'gavel', '#475569', /法律|law\b/i],
  ['civics', 'scale', '#0284c7', /公民|社會|政治|civics|social/i],
  ['swim', 'waves', '#0ea5e9', /游泳|swim/i],
  ['fitness', 'dumbbell', '#ea580c', /體能|健身|fitness/i],
  ['pe', 'ball', '#f97316', /體育|球類|\bpe\b|physical education|sport/i],
  ['choir', 'mic', '#db2777', /合唱|演講|口語|choir|speaking/i],
  ['music', 'music', '#ec4899', /音樂|music/i],
  ['drama', 'film', '#a855f7', /表演|戲劇|電影|影視|drama|film|theat/i],
  ['art', 'palette', '#d946ef', /美術|藝術|視覺|美勞|art|drawing/i],
  ['health', 'heart', '#f43f5e', /健康|護理|健教|health|nursing/i],
  ['defense', 'shield', '#4d7c0f', /國防|軍訓|defen[cs]e/i],
  ['career', 'briefcase', '#0f766e', /生涯|職涯|career/i],
  ['psychology', 'smile', '#14b8a6', /心理|psychology/i],
  ['guidance', 'compass', '#14b8a6', /輔導|生命教育|guidance/i],
  ['homeroom', 'people', '#6b7280', /班會|週會|朝會|導師|團體活動|社團|班級|homeroom|assembly|club/i],
  ['project', 'target', '#ca8a04', /專題|project/i],
  ['study', 'bulb', '#ca8a04', /自主學習|自習|彈性|study/i],
  ['elective', 'star', '#7c3aed', /選修|特色|elective/i]
];
// A subject no rule knows: a book, in one of these by its name.
const SPARE = ['#e5484d', '#f97316', '#ca8a04', '#16a34a', '#0d9488', '#0891b2', '#2563eb', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'];
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7);

const svg = body => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

// A subject's rule, or null.
const ruleOf = name => RULES.find(([, , , re]) => re.test(name)) || null;

// Icons a subject can take, best first, when its own is taken by another
// subject of the timetable: one of its kind, then any.
const ALTS = { book: ['feather', 'scroll', 'bookA'], speech: ['bookA', 'mic', 'languages'], sigma: ['calculator', 'ruler'], atom: ['magnet', 'rocket'], flask: ['microscope'], magnet: ['microscope', 'atom'], dna: ['microscope', 'leaf'], leaf: ['sprout'], globe: ['map', 'compass'], landmark: ['hourglass', 'scroll'], scale: ['gavel', 'coins', 'rainbow'], ball: ['dumbbell', 'waves'], music: ['mic'], palette: ['film'], laptop: ['cpu'], wrench: ['ruler'], bulb: ['target', 'star'], heart: ['smile'], people: ['rainbow', 'star'], compass: ['briefcase', 'smile'] };
// The icons a person can pick from (and the spares, in this order).
export const ICON_CHOICES = ['book', 'feather', 'scroll', 'bookA', 'speech', 'languages', 'sigma', 'calculator', 'ruler', 'atom', 'magnet', 'flask', 'microscope', 'dna', 'leaf', 'sprout', 'mountain', 'globe', 'map', 'landmark', 'hourglass', 'scale', 'gavel', 'coins', 'rainbow', 'ball', 'dumbbell', 'waves', 'music', 'mic', 'palette', 'film', 'laptop', 'cpu', 'rocket', 'wrench', 'heart', 'smile', 'shield', 'compass', 'briefcase', 'people', 'bulb', 'target', 'star', 'pen'];

// The timetable's subjects, each with an icon no other of them has: the one
// the person picked (applicationData.subjectIcons), else its rule's, else
// the next free of its kind, else the next free at all. Worked out once per
// timetable.
let plan = { key: null, icons: new Map() };
function iconPlan() {
  const data = state.applicationData || {};
  const picked = data.subjectIcons || {};
  const names = [];
  for (const id of [...(data.teacherOrder || []), ...Object.keys(data.teacherDB || {})])
    for (const part of String(data.teacherDB?.[id]?.[0] || '').split(/[/／]/)) {
      const n = part.trim();
      if (n && !names.includes(n)) names.push(n);
    }
  const key = JSON.stringify([names, picked]);
  if (plan.key === key) return plan.icons;
  const icons = new Map();
  const used = new Set();
  const take = (n, icon) => (icons.set(n, icon), used.add(icon));
  for (const n of names) if (P[picked[n]]) take(n, picked[n]);
  const free = list => list.find(icon => !used.has(icon));
  const order = [...names.filter(n => ruleOf(n)), ...names.filter(n => !ruleOf(n))];
  for (const n of order) {
    if (icons.has(n)) continue;
    const own = ruleOf(n)?.[1] || 'book';
    const spares = ICON_CHOICES.slice(hash(n) % ICON_CHOICES.length).concat(ICON_CHOICES);
    take(n, used.has(own) ? free(ALTS[own] || []) || free(spares) || own : own);
  }
  plan = { key, icons };
  return icons;
}

export function subjectLook(name) {
  const n = String(name || '').trim();
  const hit = n && ruleOf(n);
  const planned = n && iconPlan().get(n);
  const icon = svg(P[planned || (hit ? hit[1] : 'book')]);
  if (hit) return { key: hit[0], color: hit[2], icon };
  return { key: 'other', color: SPARE[hash(n) % SPARE.length], icon };
}
// A subject's icon by its key, for the picker.
export const iconSvg = key => svg(P[key] || P.book);
// The icon key a subject shows now.
export const iconKeyOf = name => iconPlan().get(String(name || '').trim()) || ruleOf(String(name || '').trim())?.[1] || 'book';

// An event's picture for 倒數 (段考 a pen, 運動會 a trophy, a trip a plane…).
// Its colour too: an exam red, a sports day orange, a trip sky, a ceremony violet.
const EVENTS = [
  ['pen', '#e5484d', /考|測驗|exam|test|quiz/i],
  ['trophy', '#f97316', /運動會|校慶|比賽|競賽|game|sports day|contest/i],
  ['plane', '#0ea5e9', /旅行|校外|畢旅|戶外|trip|travel|tour/i],
  ['flag', '#8b5cf6', /開學|結業|畢業|典禮|graduation|ceremony|term/i]
];
export function eventLook(name) {
  const hit = EVENTS.find(([, , re]) => re.test(String(name || '')));
  return { icon: svg(P[hit ? hit[0] : 'calendar']), color: hit ? hit[1] : '#0284c7' };
}

// A subject's (or a break's) glyph alone, for a card that is its colour.
export const subjectIcon = name => subjectLook(name).icon;
export const breakIcon = () => svg(P.cup);

// A kit tile (kitUI.tile) around a glyph's svg.
function makeTile(html, color, size, glass) {
  const node = kitUI.tile(html, color, size);
  if (glass) node.classList.add('cx-glass');
  return node;
}
// The subject's picture as a kit tile (.q-tile): its colour, the glyph in
// white; `size` '' | 'sm' | 'lg'. `glass` sits it on the hero card (white on a wash).
export function subjectTile(name, size = '', glass = false) {
  const look = subjectLook(name);
  return makeTile(look.icon, look.color, size, glass);
}
// A class-less picture as a kit tile: a break's cup, a free period's, a day over the moon.
export function stateTile(mode, size = '', glass = false) {
  const node = makeTile(svg(P[mode === 'break' || mode === 'free' ? 'cup' : 'moon']), '', size, glass);
  if (mode === 'free') node.classList.add('soft', 'cx-gray');
  return node;
}

// A timetable's short names, one per subject and never two alike: a name of
// up to `full` characters whole (four: 自主學習), a longer one by its first two
// (民主政治與法律 → 民主), and where two would read the same, its first
// character and the first one that tells it apart (社會經濟補給站 beside
// 社會 → 社經; 英文閱讀 and 英文寫作 → 英閱, 英寫). A name in Latin letters
// whole (its cell wraps it by word and shrinks it to fit, never cut), or
// with `full` under four by its words' capitals (Advanced English → AE; one
// word by its first three letters, Physics → Phy), its first word's first
// three letters where two would read the same.
export function shortNames(names, full = 4) {
  const list = [...new Set(names.filter(Boolean))];
  const chars = name => [...name];
  const latin = name => /^[ -~]+$/.test(name);
  const words = name => name.trim().split(/\s+/);
  const initials = name => (words(name).length > 1 ? words(name).map(w => w[0].toUpperCase()).join('').slice(0, 3) : words(name)[0].slice(0, 3));
  const base = name => (latin(name) ? (full < 4 ? initials(name) : name) : chars(name).length <= full ? name : chars(name).slice(0, 2).join(''));
  const first = new Map(list.map(name => [name, base(name)]));
  const out = new Map(first);
  for (const name of list) {
    if (latin(name) && full < 4 && list.some(other => other !== name && first.get(other) === first.get(name))) out.set(name, words(name)[0].slice(0, 3));
    if (chars(name).length <= full || latin(name)) continue;
    const rivals = list.filter(other => other !== name && first.get(other) === first.get(name));
    if (!rivals.length) continue;
    const mine = chars(name);
    const at = mine.findIndex((ch, i) => i > 0 && rivals.every(other => chars(other)[i] !== ch));
    if (at > 0) out.set(name, mine[0] + mine[at]);
  }
  return out;
}
