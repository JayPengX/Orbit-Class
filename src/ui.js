// ---- src/ui.js ----
// The few pieces every view here draws with: an element, a glyph (the kit's
// icons, else drawn here or from src/subjects.js's pictures, so an old kit on
// a phone still shows one), a kit tile and a section. Views write the kit's
// class names (quadra.css: .q-tile, .q-rowcard, .q-ritem, .q-section…).
import * as kitUI from '#kit/ui.mjs';
import { picture } from './subjects.js';

const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const OWN = {
  spark: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3L9.5 4.5h5L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z"/><circle cx="12" cy="13" r="3.5"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/>',
  swap: '<path d="M7 4 3.5 7.5 7 11M3.5 7.5h13M17 13l3.5 3.5L17 20M20.5 16.5h-13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r=".8"/><circle cx="4.5" cy="12" r=".8"/><circle cx="4.5" cy="17.5" r=".8"/>',
  backpack: '<path d="M6 10a6 6 0 0 1 12 0v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM9.5 4.5V3.5h5v1M9 14h6v4H9z"/>'
};

// A glyph by name: the kit's, else ours.
export function glyph(name) {
  return (kitUI.icons ?? {})[name] ?? (OWN[name] ? svg(OWN[name]) : picture(name));
}

// el('div', 'cls', 'text' | [children]); null children are skipped.
export function el(tag, cls = '', content = null) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (Array.isArray(content)) node.append(...content.filter(x => x != null && x !== false));
  else if (content != null) node.textContent = String(content);
  return node;
}
export function button(cls, onClick, content = null) {
  const node = el('button', cls, content);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}
// A kit tile holding a glyph, in a colour (a CSS colour or var()).
export function tile(name, color = '', size = '') {
  const node = el('span', `q-tile${size ? ` ${size}` : ''}`);
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = glyph(name);
  if (color) node.style.setProperty('--t', color);
  return node;
}
// A row of a .q-rowcard: a tile, a title and its line, an end, a chevron when it goes somewhere.
export function row({ cls = '', icon = null, title = '', sub = '', end = null, onClick = null }) {
  const node = onClick ? button(`q-ritem${cls ? ` ${cls}` : ''} chevron`, onClick) : el('div', `q-ritem${cls ? ` ${cls}` : ''}`);
  const words = el('span', 'q-ritem-text', [el('span', 'q-ritem-title', title), sub ? el('small', '', sub) : null]);
  node.append(...[icon, words, end].filter(Boolean));
  return node;
}
// A page section: a 20px head (and a link on its right), then its body.
export function section(title, body, { more = '', onMore = null, cls = '' } = {}) {
  const head = kitUI.sectionHead?.(title) ?? el('div', 'q-section-head', [el('h2', '', title)]);
  if (more) head.append(button('cx-more', onMore, more));
  return el('section', `q-section cx-sec${cls ? ` ${cls}` : ''}`, [head, ...[].concat(body)]);
}
// Every [data-glyph] in the page's markup filled once.
export function fillGlyphs(root = document) {
  root.querySelectorAll('[data-glyph]').forEach(node => {
    if (!node.firstChild) node.innerHTML = glyph(node.dataset.glyph);
  });
}
