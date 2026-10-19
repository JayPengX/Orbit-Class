// ---- src/appearance.js ----
// The readers for the colours and style slots older saves still carry (read,
// never applied: Class has one look, its own colour in css/styles.css).
import { DEFAULT_STYLE_PRIMARY, DEFAULT_STYLE_SECONDARY } from './constants.js';

function normalizeHexColor(value, fallback) {
  const color = String(value || '')
    .trim()
    .toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : fallback;
}
function normalizeProAccent(value) {
  return normalizeHexColor(value, DEFAULT_STYLE_PRIMARY);
}
function normalizeProSecondary(value, fallback = DEFAULT_STYLE_SECONDARY) {
  return normalizeHexColor(value, fallback);
}
function normalizeStyleSlots(value) {
  const slots = Array.isArray(value) ? value : [];
  return Array.from({ length: 5 }, (_, index) => {
    const source = slots[index] && typeof slots[index] === 'object' ? slots[index] : {};
    const primary = normalizeProAccent(source.primary);
    return {
      name: String(source.name || '')
        .trim()
        .slice(0, 12),
      primary,
      // An explicitly stored secondary (a legacy slot synced in from before
      // the app went single-hue) is preserved as-is, never silently
      // rewritten - but an empty/unfilled slot's preview swatch now falls
      // back to a shade of ITS OWN primary instead of the old app-wide
      // default pink, so five empty slots don't show five copies of a
      // two-tone combo nothing on screen still uses.
      secondary: normalizeProSecondary(source.secondary, deriveSingleHueSecondary(primary))
    };
  });
}
// An old slot's second tone: its own colour mixed 32% toward white.
function deriveSingleHueSecondary(primary) {
  const color = normalizeProAccent(primary).slice(1);
  const rgb = [0, 2, 4].map(index => parseInt(color.slice(index, index + 2), 16));
  const toHex = value => Math.round(value).toString(16).padStart(2, '0').toUpperCase();
  return `#${rgb.map(channel => toHex(channel + (255 - channel) * 0.32)).join('')}`;
}
export { normalizeProAccent, normalizeProSecondary, normalizeStyleSlots };
