// ---- src/ui.js ----
// The few pieces every view here draws with: an element, a glyph (the kit's
// icons), a kit tile and a section. Views write the kit's
// class names (quadra.css: .q-tile, .q-rowcard, .q-ritem, .q-section…).
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
  const head = kitUI.sectionHead(title);
  if (more) head.append(button('cx-more', onMore, more));
  return el('section', `q-section cx-sec${cls ? ` ${cls}` : ''}`, [head, ...[].concat(body)]);
}
// Every [data-glyph] in the page's markup filled once.
export function fillGlyphs(root = document) {
  root.querySelectorAll('[data-glyph]').forEach(node => {
    if (!node.firstChild) node.innerHTML = glyph(node.dataset.glyph);
  });
}
