// ---- src/editor-nl-edit.js ----
// Natural-language schedule edits: turns a short Traditional Chinese
// instruction ("把我週二第三節改成物理") into a proposed next state for the
// schedule - previewed as a diff and only ever applied after an explicit
// confirm - never silently. Same server-owns-the-prompt discipline as
// src/gemini-ocr.js's AI photo import: this module only ever sends
// {model, text, context} to the proxy; the Worker's /nl-edit path (see
// the shared-proxy repo's worker.js) owns the actual prompt and
// response_schema, so the deployed proxy URL can never be used to run an
// arbitrary free-form prompt.
//
// Sparse patch, not full-state: an earlier revision of this feature had the
// model echo back the COMPLETE new value of every editable field - classes,
// weeklySchedule, bellTimes, breakTimes, countdownEvents, reverseWeek -
// including everything the instruction never asked to touch, copied back
// verbatim. In practice that occasionally came back with an unrelated class
// or schedule cell subtly changed - not because the instruction asked for
// it, but because the model was asked to retype a wall of JSON it had no
// reason to even be touching, and an LLM copying text it wasn't asked to
// change is exactly the kind of task where it can drop or mis-type
// something. applyNlEditResult below now takes a sparse patch instead
// (classUpserts/deletedClassKeys/scheduleEdits, plus a handful of
// whole-value fields the model only fills in when it actually changes
// them - see NL_EDIT_RESPONSE_SCHEMA's own comment in worker.js) and
// applies it on top of `current`: anything the patch doesn't mention comes
// from the app's own existing data, never from the model, so it is
// structurally impossible for an untouched class or cell to come back
// different. normalizeSettingsData() is still run over the result before
// it's ever shown or saved - the same real safety net every other write
// path (manual save, AI photo import, backup import) already runs through,
// never trusting a class key, day/period reference, or time blindly.
import { state } from './state.js';
import { t } from './strings.js';
import { isSyncViewer, sessionUrl } from './sync.js';
import {
  applyEditorSettingsData,
  cloneSettingsData,
  describeSettingsDiff,
  normalizeSettingsData,
  settingsDataForExport
} from './editor-backup.js';
import {
  hideEditorDiscardConfirm,
  setEditorConfirmContent,
  showEditorConfirmSheet
} from './editor-core.js';
import { proxyPath } from './proxy-config.js';
import { parseLocalNlEdit } from './nl-edit-local.js';

// Must match GEMINI_ALLOWED_MODELS in the shared-proxy repo's worker.js -
// the Worker's /nl-edit path reuses the exact same vetted model list as
// /gemini. Unlike photo import, the stronger model goes first here: an
// instruction is a few words, so the request is small either way, and the
// lite model was the one misreading casually worded instructions. The lite
// model stays as the fallback on a transient failure (same fallback shape
// as AIVisionProcessor.callGemini).
const NL_EDIT_MODELS = ['gemini-3.7-flash', 'gemini-3.5-flash-lite'];

// Same shared PROXY_URL as gemini-ocr.js and sync.js (see proxy-config.js) -
// a fork that hasn't deployed the Worker simply doesn't get this feature
// (see isNlEditConfigured's callers), no bring-your-own-key fallback. The
// `/nl-edit` path is hardcoded here, not part of the env var.
const NL_EDIT_PROXY_URL = proxyPath('/nl-edit');
function isNlEditConfigured() {
  return !!NL_EDIT_PROXY_URL;
}

// Everything this feature can read and rewrite - the AI can now genuinely
// add a bell period, a break time, or a countdown event, not just move
// classes around within weeklySchedule (see the Worker's own comment on why
// that used to be too narrow). Still never the whole app data blob - no
// style/sync state, same payload-size discipline as gemini-ocr.js.
//
// Each class also lists where it already sits ("slots", e.g. "週二第3節"),
// so an instruction that names a class instead of a period ("把數學移到週五
// 早上", "王老師的課都刪掉") doesn't need the model to cross-reference
// weeklySchedule's bare keys against the class list itself. The Worker
// passes class entries through as-is; the prompt only relies on key/subject.
const NL_EDIT_DAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
function buildNlEditContext() {
  const data = settingsDataForExport();
  const slots = {};
  Object.entries(data.weeklySchedule || {}).forEach(([day, periods]) => {
    (periods || []).forEach((key, period) => {
      if (!key) return;
      (slots[key] ||= []).push(`${NL_EDIT_DAY_LABELS[day] || day}第${period + 1}節`);
    });
  });
  const classes = Object.entries(data.teacherDB || {}).map(([key, value]) => ({
    key,
    subject: value[0] || '',
    teacher: value[1] || '',
    location: data.locationDB?.[key] || '',
    slots: slots[key] || []
  }));
  return {
    weeklySchedule: data.weeklySchedule,
    classes,
    bellTimes: data.bellTimes,
    breakTimes: data.breakTimes,
    countdownEvents: data.countdownEvents,
    reverseWeek: data.reverseWeek
  };
}

// Cheap, deterministic clean-up of the typed instruction before it is sent,
// so neither the local parser nor the model has to guess at things plain
// code can settle for free (no extra prompt text, no extra request):
// - NFKC folds full-width digits/punctuation ("３節", "２、３") to ASCII.
// - Spaces next to a Chinese character carry no meaning ("週 二 第 3 節",
//   "改成 物理") and are dropped. A space between two digits or two Latin
//   words is kept: in "週3 2節" it is what separates the day from the period.
// - Simplified/variant spellings of the words the local parser keys on
//   ("星期", "节", "课", "换", "删") are folded to the Traditional ones.
// - Relative days ("今天", "明天", "後天", "昨天") become the actual weekday,
//   and "這週/下週/本週" in front of a day is dropped - the schedule repeats
//   every week, so "下週二" is just 週二.
// - A day written straight into its periods ("星期三二三節", "週五1-2節",
//   "禮拜一三到四節") gets a 的 between them. Otherwise the numerals run
//   together and the model can't tell where the day ends; with the 的 it
//   reads it correctly. Only fires when the numerals after the day run up
//   to 節/堂, so "週一二第三節" (Monday and Tuesday) is left alone.
const NL_EDIT_DAY_BEFORE_PERIODS =
  /((?:星期|禮拜|礼拜|週|周)[日天一二三四五六七1-7])(?=[一二三四五六七八九十0-9、,和與跟到至~-]*[一二三四五六七八九十0-9][節节堂])/g;
const NL_EDIT_SPACE_NEAR_CJK =
  /(?<=[\u3000-\u303f\u3400-\u9fff\uff00-\uffef])\s+|\s+(?=[\u3000-\u303f\u3400-\u9fff\uff00-\uffef])/g;
const NL_EDIT_VARIANTS = {
  礼拜: '禮拜',
  节: '節',
  课: '課',
  换: '換',
  删: '刪',
  为: '為',
  这: '這'
};
const NL_EDIT_RELATIVE_DAYS = {
  大後天: 3,
  大后天: 3,
  今天: 0,
  今日: 0,
  明天: 1,
  明日: 1,
  後天: 2,
  后天: 2,
  昨天: -1
};
function normalizeNlEditText(rawText, now = new Date()) {
  let text = String(rawText || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(NL_EDIT_SPACE_NEAR_CJK, '');
  text = text.replace(/礼拜|节|课|换|删|为|这/g, match => NL_EDIT_VARIANTS[match]);
  text = text.replace(/大後天|大后天|今天|今日|明天|明日|後天|后天|昨天/g, match => {
    const day = (((now.getDay() + NL_EDIT_RELATIVE_DAYS[match]) % 7) + 7) % 7;
    return NL_EDIT_DAY_LABELS[day];
  });
  return text
    .replace(/(?:這個|這|本|下個|下|上個|上)(?=(?:星期|禮拜|週|周)[日天一二三四五六七1-7])/g, '')
    .replace(NL_EDIT_DAY_BEFORE_PERIODS, '$1的');
}

// Same fence-stripping/brace-hunting salvage as gemini-ocr.js's
// parseResponse - the Worker's response_schema should already guarantee
// clean JSON, but this stays defensive rather than trusting that blindly
// (see validateNlEditResult/applyNlEditResult below for the same discipline
// applied to the parsed object's actual field values).
function extractJsonObject(rawText) {
  if (!rawText) throw new Error(t('nlEdit.badResponse'));
  const fenceStripped = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const firstBrace = fenceStripped.indexOf('{');
  const lastBrace = fenceStripped.lastIndexOf('}');
  const cleaned =
    firstBrace !== -1 && lastBrace > firstBrace
      ? fenceStripped.slice(firstBrace, lastBrace + 1)
      : fenceStripped;
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(t('nlEdit.invalidJsonResponse', { message: error.message }), { cause: error });
  }
}

// One full pass over NL_EDIT_MODELS, fastest-first - factored out of
// callNlEditProxy so the location-block retry there can cleanly re-run it
// from scratch without duplicating the loop (see that function's own
// comment on why a fresh pass is worth retrying). Returns a discriminated
// result instead of throwing directly for the location-block case
// specifically, since callNlEditProxy needs to tell that one apart from
// every other failure (which isn't worth retrying a whole pass over).
async function tryNlEditModels(text, context) {
  let lastError = null;
  for (const model of NL_EDIT_MODELS) {
    let response;
    try {
      response = await fetch(await sessionUrl(NL_EDIT_PROXY_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, text, context })
      });
    } catch (networkError) {
      lastError = new Error(t('nlEdit.cannotConnect', { message: networkError.message }));
      continue;
    }
    if (response.ok) {
      const responseData = await response.json();
      return {
        ok: true,
        value: extractJsonObject(responseData.candidates?.[0]?.content?.parts?.[0]?.text)
      };
    }
    const errorJson = await response.json().catch(() => ({}));
    const message = errorJson.error?.message || response.statusText;
    // This regex matches the companion backend's own rate-limit error text
    // verbatim (worker.js, a separate repo) - it is not UI copy this app
    // owns or renders on its own, so it is left as the backend's own
    // Chinese wording rather than being run through t().
    if (response.status === 429 && /請求過於頻繁/.test(message)) throw new Error(message);
    // Google's Gemini API rejects the request based on the calling IP's
    // geolocation - here, the Cloudflare Worker's own egress IP, not the
    // end user's (see gemini-ocr.js's matching comment on AIVisionProcessor
    // for the full explanation). Every model in THIS pass shares that same
    // outbound path, so stop this pass immediately rather than burning
    // through the whole model list - callNlEditProxy decides whether a
    // fresh pass is worth retrying.
    if (response.status === 400 && /User location is not supported/i.test(message)) {
      // Surfaces the Cloudflare colo (X-Worker-Colo, set by worker.js
      // from request.cf.colo) that actually got blocked - see
      // gemini-ocr.js's matching comment for why this pass's own retry can't
      // detect or route around a colo Smart Placement keeps reusing.
      const colo = response.headers.get('X-Worker-Colo') || t('common.unknown');
      return {
        ok: false,
        locationBlocked: true,
        colo,
        error: new Error(t('nlEdit.locationBlocked', { colo }))
      };
    }
    // Retryable on the next model: retired/unknown model (404), overloaded
    // (503), rate-limited (429), or transient server errors (5xx) - same
    // set AIVisionProcessor.callGemini treats as retryable.
    lastError = new Error(t('nlEdit.parseFailedWithStatus', { status: response.status, message }));
    const retryableStatus =
      response.status === 404 ||
      response.status === 429 ||
      response.status === 503 ||
      response.status >= 500;
    if (!retryableStatus) throw lastError;
  }
  throw lastError || new Error(t('nlEdit.parseFailedNoModel'));
}

// Low-level call: same fastest-first-model/escalate-on-transient-failure
// shape as gemini-ocr.js's AIVisionProcessor.callGemini, PLUS the same
// location-block retry that function has - a brand new request has a real
// chance of landing on a different Cloudflare edge colo than the one that
// just got blocked, so it's worth retrying a couple of whole passes (with a
// short delay) before finally giving up, rather than surfacing the error on
// the very first hit.
async function callNlEditProxy(text, context, status) {
  if (!NL_EDIT_PROXY_URL) throw new Error(t('nlEdit.notConfigured'));
  if (!navigator.onLine) throw new Error(t('nlEdit.offline'));
  const LOCATION_BLOCK_RETRY_LIMIT = 2;
  const LOCATION_BLOCK_RETRY_DELAY_MS = 500;
  for (let locationAttempt = 0; ; locationAttempt++) {
    const result = await tryNlEditModels(text, context);
    if (result.ok) return result.value;
    if (!result.locationBlocked || locationAttempt >= LOCATION_BLOCK_RETRY_LIMIT)
      throw result.error;
    status?.(
      t('nlEdit.locationBlockedRetrying', { colo: result.colo, attempt: locationAttempt + 2 })
    );
    await new Promise(resolve => setTimeout(resolve, LOCATION_BLOCK_RETRY_DELAY_MS));
  }
}

// Cheap shape check only - is every field the right JS type at all? This
// can't fail on CONTENT (a bad class key, an out-of-range day, a malformed
// time) since it has no context to judge that against; applyNlEditResult
// below is what actually re-checks the content, by running it through the
// exact same normalizeSettingsData() every other write path in this app
// already trusts for that job.
function validateNlEditResult(result) {
  if (!result || typeof result !== 'object')
    return { valid: false, errors: [t('nlEdit.badResponse')] };
  if (!['ok', 'unclear', 'not_found'].includes(result.status)) {
    return { valid: false, errors: [t('nlEdit.badResponse')] };
  }
  if (result.status !== 'ok') return { valid: true, errors: [] };
  const shapeOk =
    Array.isArray(result.classUpserts) &&
    Array.isArray(result.deletedClassKeys) &&
    Array.isArray(result.scheduleEdits) &&
    typeof result.bellTimesChanged === 'boolean' &&
    Array.isArray(result.bellTimes) &&
    typeof result.breakTimesChanged === 'boolean' &&
    Array.isArray(result.breakTimes) &&
    typeof result.countdownEventsChanged === 'boolean' &&
    Array.isArray(result.countdownEvents) &&
    typeof result.reverseWeekChanged === 'boolean' &&
    typeof result.reverseWeek === 'boolean';
  if (!shapeOk) return { valid: false, errors: [t('nlEdit.badResponse')] };
  return { valid: true, errors: [] };
}

// Turns an already-shape-checked `result` - now a sparse PATCH, not a full
// next state (see this file's own top-of-file comment and
// NL_EDIT_RESPONSE_SCHEMA's comment in worker.js for why) - into a
// full next settings-data object, built on top of `current` (as
// settingsDataForExport() sees it) - pure data rearrangement, no DOM, so the
// caller can diff it with describeSettingsDiff before ever touching the
// real schedule.
//
// Every class/cell/time/event the patch doesn't mention is carried over
// from `current` completely untouched - cloneSettingsData deep-clones it
// first, so nothing here ever re-derives an unmentioned value from
// anything the model sent. Only classUpserts/deletedClassKeys/
// scheduleEdits (classes + weeklySchedule) and the four optional
// whole-value fields (bellTimes/breakTimes/countdownEvents/reverseWeek,
// each gated by its own *Changed flag - see NL_EDIT_RESPONSE_SCHEMA's own
// comment) are ever written. style, sync state, and teacherOrder's own
// existing order all pass through untouched the same way they always did
// (normalizeSettingsData below preserves teacherOrder's current order for
// still-existing keys and appends any new ones).
//
// The AI manages class keys itself (see buildNlEditPrompt's own
// explanation: reuse an existing key, invent a short new one for a
// genuinely new class) - there's no subject-matching reconciliation to do
// here. Throws (a clear Chinese message) if normalizeSettingsData rejects
// the result as structurally unsound - the same defensive check AI photo
// import and manual backup import already run every result through, never
// trusting a day/period reference, bell time, or class key blindly; it's
// also what quietly drops any weeklySchedule cell still pointing at a
// deleted class key that the model's own scheduleEdits didn't clear.
function applyNlEditResult(current, result) {
  const next = cloneSettingsData(current);

  const teacherDB = cloneSettingsData(current.teacherDB || {});
  const locationDB = cloneSettingsData(current.locationDB || {});
  (result.classUpserts || []).forEach(entry => {
    const key = String(entry?.key || '').trim();
    if (!key) return;
    teacherDB[key] = [
      String(entry.subject || ''),
      String(entry.teacher || ''),
      String(entry.location || '')
    ];
    locationDB[key] = String(entry.location || '');
  });
  (result.deletedClassKeys || []).forEach(rawKey => {
    const key = String(rawKey || '').trim();
    if (!key) return;
    delete teacherDB[key];
    delete locationDB[key];
  });
  next.teacherDB = teacherDB;
  next.locationDB = locationDB;

  const weeklySchedule = {};
  Object.entries(current.weeklySchedule || {}).forEach(([day, periods]) => {
    weeklySchedule[day] = [...(periods || [])];
  });
  (result.scheduleEdits || []).forEach(edit => {
    const day = String(edit?.day);
    const period = Number(edit?.period);
    if (!weeklySchedule[day] || !Number.isInteger(period) || period < 0) return;
    while (weeklySchedule[day].length <= period) weeklySchedule[day].push('');
    weeklySchedule[day][period] = String(edit.key || '');
  });
  next.weeklySchedule = weeklySchedule;

  if (result.bellTimesChanged) next.bellTimes = result.bellTimes;
  if (result.breakTimesChanged) next.breakTimes = result.breakTimes;
  if (result.countdownEventsChanged) next.countdownEvents = result.countdownEvents;
  if (result.reverseWeekChanged) next.reverseWeek = result.reverseWeek;

  return normalizeSettingsData(next);
}

// A single-button info sheet - same shape as editor-core.js's own "AI 辨識
// 中" dialog (setEditorConfirmContent with cancelLabel null) - for the two
// non-crashing failure states this feature has to treat as first-class,
// not as thrown errors: "I can't understand this command" (unclear) and
// "this refers to something that doesn't exist" (not_found).
function showNlEditInfo(title, message) {
  setEditorConfirmContent(title, message, '', t('nlEdit.dismiss'), hideEditorDiscardConfirm, null);
  showEditorConfirmSheet();
}

// The confirm-before-apply step every proposed edit goes through, reusing
// editor-backup.js's own diff/save machinery rather than inventing a
// second one: describeSettingsDiff produces the same human-readable diff
// text the schedule editor's own save confirmation uses, and
// applyEditorSettingsData is the exact same "apply, save, toast, push to
// sync if configured" path a normal manual save goes through - see
// editor-schedule.js's saveEditor(). Nothing here is ever applied without
// this step. Unlike a manual save, the settings sheet stays open afterwards:
// an AI edit is usually one of several, and the re-rendered editor below
// the box is where the user checks the result.
function showNlEditConfirm(current, next, { local = false, onApplied } = {}) {
  const diff = describeSettingsDiff(current, next);
  if (diff === t('editorBackup.noChanges')) {
    showNlEditInfo(t('nlEdit.noChangeTitle'), t('nlEdit.noChangeMessage'));
    return;
  }
  state.pendingEditorSaveData = next;
  const apply = () => {
    const pending = state.pendingEditorSaveData;
    state.pendingEditorSaveData = null;
    hideEditorDiscardConfirm();
    if (!pending) return;
    applyEditorSettingsData(pending, { closeAfter: false });
    onApplied?.();
  };
  setEditorConfirmContent(
    t(local ? 'nlEdit.confirmTitleLocal' : 'nlEdit.confirmTitle'),
    t('nlEdit.confirmMessage'),
    diff,
    t('nlEdit.confirmApply'),
    apply,
    t('nlEdit.confirmCancel')
  );
  showEditorConfirmSheet();
}

// The entry point the UI wiring below calls. `status` reports progress/
// errors back to the caller's own status line; `onDone` always fires last
// (success, failure, or a first-class unclear/not_found outcome) so the UI
// can re-enable its controls; `onApplied` fires only once the user has
// confirmed and the edit is saved.
async function submitNlEdit(rawText, { status, onDone, onApplied } = {}) {
  const text = normalizeNlEditText(rawText);
  try {
    if (isSyncViewer()) {
      status?.(t('nlEdit.viewerLocked'), true);
      return;
    }
    if (!text) {
      status?.(t('nlEdit.emptyInput'), true);
      return;
    }
    const current = settingsDataForExport();
    // Common edits (swap/move/clear/set a period) are recognized right here
    // for free - see nl-edit-local.js. Only what it can't fully account for
    // goes to the AI, which is also why these checks come after it: a local
    // edit works offline and without a configured proxy.
    let result = parseLocalNlEdit(text, current);
    const local = !!result;
    if (!local) {
      if (!isNlEditConfigured()) {
        status?.(t('nlEdit.notConfigured'), true);
        return;
      }
      if (!navigator.onLine) {
        status?.(t('nlEdit.offline'), true);
        return;
      }
      status?.(t('nlEdit.working'));
      result = await callNlEditProxy(text, buildNlEditContext(), status);
    }
    const validation = validateNlEditResult(result);
    if (!validation.valid) {
      status?.(validation.errors.join('') || t('nlEdit.badResponse'), true);
      return;
    }
    if (result.status === 'unclear') {
      status?.('');
      showNlEditInfo(t('nlEdit.unclearTitle'), result.reason?.trim() || t('nlEdit.unclearMessage'));
      return;
    }
    if (result.status === 'not_found') {
      status?.('');
      showNlEditInfo(
        t('nlEdit.notFoundTitle'),
        result.reason?.trim() || t('nlEdit.notFoundMessage')
      );
      return;
    }
    let next;
    try {
      next = applyNlEditResult(current, result);
    } catch (error) {
      status?.(error.message || t('nlEdit.badResponse'), true);
      return;
    }
    status?.(t('nlEdit.ready'));
    showNlEditConfirm(current, next, { local, onApplied });
  } catch (error) {
    status?.(error.message, true);
  } finally {
    onDone?.();
  }
}

// Wires the schedule editor's always-present "AI 課表編輯" box (see
// index.html - it lives at the top of #editor-sheet-body, not the transfer
// sheet, since it edits the schedule directly) - unlike gemini-ocr.js's OCR
// importer, there's no lazy mount here: no image canvas/preview plumbing to
// defer, just one text input and one button.
function mountNlEditor() {
  const input = document.getElementById('nl-edit-input');
  const button = document.getElementById('nl-edit-submit');
  const statusElement = document.getElementById('nl-edit-status');
  if (!input || !button || !statusElement) return;
  const setStatus = (message, isError = false) => {
    statusElement.textContent = message || '';
    statusElement.classList.toggle('error', isError);
  };
  const run = async () => {
    button.disabled = true;
    input.disabled = true;
    await submitNlEdit(input.value, {
      status: setStatus,
      onDone: () => {
        button.disabled = false;
        input.disabled = false;
      },
      onApplied: () => {
        input.value = '';
        setStatus('');
      }
    });
  };
  button.addEventListener('click', run);
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    run();
  });
}
mountNlEditor();

export {
  applyNlEditResult,
  buildNlEditContext,
  isNlEditConfigured,
  normalizeNlEditText,
  submitNlEdit,
  validateNlEditResult
};
