// ---- src/appearance.js ----
// Class's own colour (no choice of colour: the style panel is gone), and the
// readers for the colours and style slots older saves still carry.
import { state } from './state.js';
import { fitNowTitleText } from './dashboard-render.js';
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
// Picks black or white text for a solid-color badge/button/pill painted in
// the user's own chosen accent color. This used to maximize WCAG 2's
// gamma-linearized contrast ratio (whichever of black/white had the higher
// ratio against the background), which is the textbook-correct approach
// but a known bad fit for exactly this job: that formula weights the red
// channel so lightly (0.2126, versus green's 0.7152) that a vivid, fully
// saturated red/pink/magenta - visually one of the *brighter*, punchier
// colors on screen - computes as "dark" and tips the ratio toward black
// text, which reads as harsh/muddy on a color that vivid. It also produces
// near-coin-flip results for plenty of ordinary mid-saturation colors,
// where the two ratios differ by only a few percent - not a stable signal
// for something that should look obviously right. Plain perceptual
// brightness (the classic YIQ-weighted average, no gamma curve) tracks how
// bright a color actually looks far more closely, and a single 128/255
// threshold (the standard cutoff for this exact black-or-white decision)
// gives consistent, unsurprising results across the whole preset palette -
// including fixing the red/pink family specifically.
function getReadableTextColor(value) {
  const color = normalizeProAccent(value).slice(1);
  const [r, g, b] = [0, 2, 4].map(index => parseInt(color.slice(index, index + 2), 16));
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 128 ? '#10171A' : '#FFFFFF';
}
function getReadableSurfaceColor(value) {
  const color = normalizeProAccent(value).slice(1);
  const channels = [0, 2, 4]
    .map(index => parseInt(color.slice(index, index + 2), 16) / 255)
    .map(channel =>
      channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
    );
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const surfaceLuminance = 0.008;
  const contrast =
    (Math.max(luminance, surfaceLuminance) + 0.05) / (Math.min(luminance, surfaceLuminance) + 0.05);
  return contrast >= 3 ? '#' + color : '#F4FBFF';
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
// The app is single-hue now: there's one color the person picks (proAccent),
// and everywhere the UI needs a second tone for contrast/emphasis (the
// countdown card, the toolbar hub, "next up" vs "happening now", ...) that
// tone is this - the same hue, mixed 32% toward white, rather than an
// independently chosen second color. Plain per-channel mix (not an HSL
// round-trip) so it's the exact same math as the CSS `color-mix(in srgb,
// var(--pro-accent) 100%, white 32%)` shade used to preview this everywhere
// else in the design - the two never had to be re-tuned to agree with each
// other.
function deriveSingleHueSecondary(primary) {
  const color = normalizeProAccent(primary).slice(1);
  const rgb = [0, 2, 4].map(index => parseInt(color.slice(index, index + 2), 16));
  const toHex = value => Math.round(value).toString(16).padStart(2, '0').toUpperCase();
  return `#${rgb.map(channel => toHex(channel + (255 - channel) * 0.32)).join('')}`;
}
// Class's own colour, whatever an old save or a synced device says: the
// family's apps don't offer a colour choice (樣式工具 is gone).
// eslint-disable-next-line no-unused-vars
function applyProAccent(data = state.applicationData) {
  const accent = normalizeProAccent(DEFAULT_STYLE_PRIMARY);
  // Always derived from accent, never read off data.proSecondary - see
  // deriveSingleHueSecondary's own comment. That field still exists in
  // storage/sync/import payloads for backward compatibility, but nothing
  // that actually paints the UI looks at it any more.
  const secondary = deriveSingleHueSecondary(accent);
  document.body.style.setProperty('--pro-accent', accent);
  document.body.style.setProperty('--pro-secondary', secondary);
  document.body.style.setProperty('--pro-accent-text', getReadableTextColor(accent));
  document.body.style.setProperty('--pro-secondary-text', getReadableTextColor(secondary));
  document.body.style.setProperty('--pro-accent-readable', getReadableSurfaceColor(accent));
  document.body.style.setProperty('--pro-secondary-readable', getReadableSurfaceColor(secondary));
}
// Switches to the Orbit Color visual skin.
function setStyleMode() {
  document.body.classList.add('pro-style');
  applyProAccent();
  refreshStyleModeLayout();
}
function refreshStyleModeLayout() {
  requestAnimationFrame(() => {
    const list = document.getElementById('schedule-list');
    if (list) {
      state.lastAutoScrollKey = null;
    }
    if (typeof window.update === 'function') window.update();
    requestAnimationFrame(() => {
      if (typeof fitNowTitleText === 'function') fitNowTitleText(true);
    });
  });
}
export {
  applyProAccent,
  normalizeProAccent,
  normalizeProSecondary,
  normalizeStyleSlots,
  setStyleMode
};
