// ---- src/main.js ----
// Entry point: imports every module purely for its
// side effects (the AI parts once the page has loaded, at the end), in the one order that matters - bootstrap.js must finish
// (build the schedule, start the clock) before testsim-runtime.js patches
// it. Nothing else imports either of those two, so this ordering holds.
import './data.js';
import './schedule.js';
import './dashboard.js';
import './editor-backup.js';
import './editor-core.js';
import './editor-teachers.js';
import './editor-schedule.js';
import './view-editor.js';
import './bootstrap.js';
import './testsim-runtime.js';
import './shell.js';

// The two AI parts (photo import, a sentence into an edit) bind their own
// sheets' controls and are the bundle's largest code: they load once the
// page has, so starting the app doesn't wait to compile them.
const loadAI = () => setTimeout(() => (import('./gemini-ocr.js'), import('./editor-nl-edit.js')), 0);
if (document.readyState === 'complete') loadAI();
else addEventListener('load', loadAI, { once: true });
