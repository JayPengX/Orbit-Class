// ---- src/subjects.js ----
// Every subject's picture: an icon and a colour, from its name (Traditional
// Chinese first, English too), as the family gives every team its logo and
// every player a face. A subject the list doesn't know gets a book in a
// colour of its own (the same every time for the same name).
//
//   subjectLook('物理')        → { key: 'physics', color: '#8b5cf6', icon: '<svg…>' }
//   subjectIcon('物理', 'cls') → a <span class="subject-icon cls"> with the svg, tinted

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
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
};

// Name → look. The first rule whose words the name contains wins, so the
// narrower ones (地球科學 before 地理, 生活科技 before 科技) come first.
const RULES = [
  ['earth', 'mountain', '#b7791f', /地科|地球科學|earth/i],
  ['life-tech', 'wrench', '#64748b', /生活科技|生科|家政|工藝|technology|craft/i],
  ['computer', 'laptop', '#475569', /資訊|資科|電腦|程式|計算機|資訊科技|computer|coding|programming|\bit\b/i],
  ['chinese', 'book', '#e5484d', /國文|國語|語文|中文|文學|閱讀|寫作|作文|chinese/i],
  ['english', 'speech', '#2563eb', /英文|英語|english/i],
  ['language', 'languages', '#0891b2', /日文|日語|韓文|韓語|法文|法語|德文|德語|西班牙|外語|第二外|language|japanese|french|german|spanish|korean/i],
  ['math', 'sigma', '#6366f1', /數學|數甲|數乙|數a|數b|算數|math|calculus|algebra|geometry|statistics/i],
  ['physics', 'atom', '#8b5cf6', /物理|physics/i],
  ['chemistry', 'flask', '#0d9488', /化學|chemistry/i],
  ['biology', 'dna', '#16a34a', /生物|biology/i],
  ['science', 'flask', '#0ea5e9', /自然|理化|科學|science/i],
  ['history', 'landmark', '#d97706', /歷史|history/i],
  ['geography', 'globe', '#0891b2', /地理|geography/i],
  ['civics', 'scale', '#0284c7', /公民|社會|法律|經濟|政治|civics|social|economics|law/i],
  ['pe', 'ball', '#f97316', /體育|體能|游泳|球類|\bpe\b|physical education|sport/i],
  ['music', 'music', '#ec4899', /音樂|合唱|music|choir/i],
  ['art', 'palette', '#d946ef', /美術|藝術|視覺|美勞|art|drawing/i],
  ['health', 'heart', '#f43f5e', /健康|護理|健教|health|nursing/i],
  ['defense', 'shield', '#4d7c0f', /國防|軍訓|defen[cs]e/i],
  ['guidance', 'compass', '#14b8a6', /輔導|生涯|生命教育|心理|guidance|career/i],
  ['homeroom', 'people', '#6b7280', /班會|週會|朝會|導師|團體活動|社團|班級|homeroom|assembly|club/i],
  ['study', 'bulb', '#ca8a04', /自主學習|自習|彈性|專題|探究|study|project/i]
];
// A subject no rule knows: a book, in one of these by its name.
const SPARE = ['#e5484d', '#f97316', '#ca8a04', '#16a34a', '#0d9488', '#0891b2', '#2563eb', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'];
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7);

const svg = body => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export function subjectLook(name) {
  const n = String(name || '').trim();
  const hit = n && RULES.find(([, , , re]) => re.test(n));
  if (hit) return { key: hit[0], color: hit[2], icon: svg(P[hit[1]]) };
  return { key: 'other', color: SPARE[hash(n) % SPARE.length], icon: svg(P.book) };
}

// An event's picture for 倒數 (段考 a pen, 運動會 a trophy, a trip a plane…).
const EVENTS = [
  ['pen', /考|測驗|exam|test|quiz/i],
  ['trophy', /運動會|校慶|比賽|競賽|game|sports day|contest/i],
  ['plane', /旅行|校外|畢旅|戶外|trip|travel|tour/i],
  ['flag', /開學|結業|畢業|典禮|graduation|ceremony|term/i]
];
export function eventLook(name) {
  const hit = EVENTS.find(([, re]) => re.test(String(name || '')));
  return svg(P[hit ? hit[0] : 'calendar']);
}

// The card's picture when it isn't a class: a break a cup, a day without
// classes (or one that's over) the moon, in the app's own colours.
export function stateIcon(mode, cls = '') {
  const tile = document.createElement('span');
  tile.className = `subject-icon is-state ${cls}`.trim();
  tile.setAttribute('aria-hidden', 'true');
  tile.innerHTML = svg(P[mode === 'break' ? 'cup' : 'moon']);
  return tile;
}

// The picture on the page: the icon on a soft tile of the subject's colour.
export function subjectIcon(name, cls = '') {
  const look = subjectLook(name);
  const tile = document.createElement('span');
  tile.className = `subject-icon ${cls}`.trim();
  tile.style.setProperty('--subject', look.color);
  tile.setAttribute('aria-hidden', 'true');
  tile.innerHTML = look.icon;
  return tile;
}
