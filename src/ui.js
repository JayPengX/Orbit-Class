// ---- src/ui.js ----
// The few pieces every view here draws with: an element, a glyph (the kit's
// icons), a kit tile and a section. Views write the kit's
// class names (orbit.css: .q-tile, .q-rowcard, .q-ritem, .q-section…).
import * as kitUI from '#kit/ui.mjs';

// A glyph by name: the kit's.
export function glyph(name) {
  return kitUI.icons[name];
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
// A name's size class by its length (a Chinese character counts 1, a Latin
// letter about half): long names step down a size and wrap, never cut.
export function nameSize(name) {
  const n = [...String(name || '')].reduce((w, ch) => w + (/[ -~]/.test(ch) ? 0.55 : 1), 0);
  return n > 10 ? ' is-xlong' : n > 6 ? ' is-long' : '';
}
// Shrinks each element's font until its text fits its box (down to min px).
export function fitText(nodes, min = 8) {
  for (const node of nodes) {
    if (!node.clientWidth) continue;
    node.style.fontSize = '';
    let size = parseFloat(getComputedStyle(node).fontSize) || 12;
    while (size > min && (node.scrollWidth > node.clientWidth + 0.5 || node.scrollHeight > node.clientHeight + 0.5)) {
      size -= 0.5;
      node.style.fontSize = `${size}px`;
      node.style.lineHeight = `${Math.round(size * 1.15)}px`;
    }
  }
}
// A <select> can't wrap: its chosen option's font steps down until it fits
// beside the arrow (down to min px).
let measure = null;
export function fitSelects(selects, min = 11) {
  measure ||= document.createElement('canvas').getContext?.('2d');
  if (!measure) return;
  for (const sel of selects) {
    const room = sel.clientWidth - 42;
    if (room <= 0) continue;
    const text = sel.selectedOptions?.[0]?.textContent || '';
    const cs = getComputedStyle(sel);
    let size = 16;
    measure.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    while (size > min && measure.measureText(text).width > room) {
      size -= 0.5;
      measure.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    }
    sel.style.fontSize = size < 16 ? `${size}px` : '';
  }
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
export const section = (title, body, { more = '', onMore = null, cls = '' } = {}) =>
  kitUI.section(title, body, { shd: true, cls: `cx-sec${cls ? ` ${cls}` : ''}`, action: more ? button('cx-more', onMore, more) : null });
// Every [data-glyph] in the page's markup filled once.
export function fillGlyphs(root = document) {
  root.querySelectorAll('[data-glyph]').forEach(node => {
    if (!node.firstChild) node.innerHTML = glyph(node.dataset.glyph);
  });
}
