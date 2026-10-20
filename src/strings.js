// ---- src/strings.js ----
// A lookup table for UI strings, keyed by a dotted namespace.key (e.g.
// 'dashboard.notStarted'). Call `t('the.key')` where a literal used to be,
// optionally with a second argument for {placeholder}-style interpolation
// (e.g. `t('dashboard.periodCount', { count })` against a value of
// "{count} 節"). Every key must exist in src/locales/zh-TW.js - that's the
// fallback locale for anything missing from another one, and Orbit Class's
// original (and still primary) language, so it's treated as the source of
// truth.
//
// Each locale's actual strings live in their own file under src/locales/ -
// see zh-TW.js and en.js there. Adding a new language: copy en.js to
// src/locales/<code>.js, translate its values, then add one import and one
// STRINGS entry below, plus a branch in detectLocale() if it should be
// auto-detected.
import zhTW from './locales/zh-TW.js';
import en from './locales/en.js';

const STRINGS = { 'zh-TW': zhTW, en };

// ---- Locale detection, override, and persistence ----
//
// detectLocale() reads the browser's reported language(s) and maps anything
// starting 'zh' to 'zh-TW' and anything starting 'en' to 'en', defaulting to
// 'zh-TW' for everything else (matches the assumption test/helpers/setupEnv.js
// pins the test environment to, and Orbit Class's actual user base, which is
// Taiwanese schools).
function detectLocale() {
  const candidates = [];
  try {
    if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
    if (navigator.language) candidates.push(navigator.language);
  } catch {
    /* navigator unavailable (non-browser environment) - fall through to default. */
  }
  for (const raw of candidates) {
    const lang = String(raw || '').toLowerCase();
    if (lang.startsWith('zh')) return 'zh-TW';
    if (lang.startsWith('en')) return 'en';
  }
  return 'zh-TW';
}

// The family's choice (quadra.lang, set in any Quadra or Orbit app's
// settings and kept on the device) before the phone's language.
function readFamilyLocale() {
  try {
    const value = localStorage.getItem('quadra.lang');
    return value === 'en' ? 'en' : value === 'zh' ? 'zh-TW' : null;
  } catch {
    return null;
  }
}

const currentLocale = readFamilyLocale() || detectLocale();

/**
 * Returns the active locale ('zh-TW' or 'en').
 */
function getLocale() {
  return currentLocale;
}

/**
 * Looks up a UI string by key in the current locale, falling back to zh-TW
 * (and then the key itself) if a locale is ever missing one. `vars`, when
 * given, fills in {name}-style placeholders in the resolved string.
 */
function t(key, vars) {
  const raw = STRINGS[currentLocale]?.[key] ?? STRINGS['zh-TW'][key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export { detectLocale, getLocale, t };
