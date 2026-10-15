# Orbit Class

A browser-based class-schedule dashboard that tells you what's happening right now, not just what your timetable says.

> **Live site: [https://jaypengx.github.io/Orbit-Class/](https://jaypengx.github.io/Orbit-Class/)** — Try it now, no install required.

---

**Without a connection**: opens on the timetable kept on the phone (the worker opens on its kept page at once and refreshes it behind); the AI features say they need the network. An edit not yet on the pass is remembered on the device with the fingerprint of the pass copy it was made on (`orbit-class.sync.pending`): at the next opening it goes up if the pass is unchanged, and is set aside (never lost) if another device changed it.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Getting Started](#getting-started)
- [How Schedules Are Built](#how-schedules-are-built)
- [Odd/Even Week Detection](#oddeven-week-detection)
- [Appearance & Theming](#appearance--theming)
- [Time Simulation](#time-simulation)
- [AI Schedule-Photo Import](#ai-schedule-photo-import)
- [AI Natural-Language Schedule Editing](#ai-natural-language-schedule-editing)
- [Backup, Export & Device Transfer](#backup-export--device-transfer)
- [Cross-Device Sync: the Quadra Pass](#cross-device-sync-the-quadra-pass)
- [Data Storage](#data-storage)
- [Project Structure / Architecture](#project-structure--architecture)
- [The Per-Second Update Loop](#the-per-second-update-loop)
- [Responsive Design & Accessibility](#responsive-design--accessibility)
- [Privacy](#privacy)
- [Contributing / Notes for Modifying This Project](#contributing--notes-for-modifying-this-project)
- [Known Limitations](#known-limitations)
- [Current Status](#current-status)
- [Related Projects](#related-projects)

---

## Overview

Orbit Class is a class-schedule dashboard that runs entirely in the browser. It doesn't just display a timetable — it continuously computes which period is happening right now, how many minutes are left, and what's coming up next, so opening the page gives you the answer immediately instead of making you cross-reference a printed schedule yourself.

It's an Orbit app (the everyday tools of the Quadra family), a static front-end site built with Vite, and **signed in with the Quadra Pass like every app**. The schedule lives on the pass (the Worker's `/eco`, app `orbit`), with a cache in the browser so it opens at once. The family's rules are `Shared-Proxy/docs/TRUTH.md`; the kit (sign-in, the account button, notices, the update watch, the glass look) is Shared-Proxy's `kit/`, loaded from its Pages.

Two features use the shared Worker (`orbit-workers-proxy`, in Shared-Proxy), both needing the pass's session:

- **AI schedule-photo import** (`/gemini`)
- **AI natural-language schedule editing** (`/nl-edit`)

Both run with hard caps: Gemini's daily cap on billed calls, and Cloudflare's $5 plan held by Shared-Proxy's `quota-guard`, which stops the Workers before anything past the plan is billed. The worst case of abuse is a cap running out and the feature pausing until it resets, never a bigger bill.

---

## Key Features

- **"Right now" front and center**: the top of the dashboard always shows the current class, teacher, room, and time remaining (progress bar + countdown), followed by a preview of the next period, then the full day's schedule list — tap any period for a detail card. Once the day's last class is over, 今天 shows the next school day's (明天的課) every time it's opened, not today's finished list. A class's detail card shows its week as five days side by side (each day's periods and start time, a day without it dimmed), so the card is the same height for a class met twice a week or six times.
- **調課, one-time class swaps (across weeks too)**: tap a class on 今天 or 課表 and 調課, or 工具's 新增調課, then pick the period to trade with on any date (the same day, another day, another week; a free period moves the class there, a Saturday make-up included). Only those two dates change: the swapped class shows in that period's time with an orange 調課 tag, keeps the odd/even half of the week it came from, and the card, the list and the notices all follow it (`classesOnDate` in `src/schedule.js`, the one rule every view reads). Its sheet says 與 … 對調 and undoes it; 工具 lists the swaps still to come (tap one to undo). Saved and synced with the timetable (`classSwaps`, appended to the transfer format), one swap per period, those over dropped at the next change; not on a device that only views. 課表 shows each weekday's coming date (today's, or the next), with its own odd/even week and swaps; 第 N 節 is the period's own number.
- **Countdowns that clear themselves**: 倒數活動's 結束後自動刪除 (off by default) deletes a countdown the day after its last day; saved and synced like 單雙週對調 (`pruneCountdowns`, appended to the transfer format so an older copy ignores it), not on a device that only views, nor under an editor with unsaved changes.
- **Fully automatic transitions**: period changes, day changes, and end-of-class all recompute automatically — no manual refresh or "next period" button needed.
- **Made for phones**: on a computer the page shows a QR code and the link to open Orbit Class on a phone, with how to add it to the home screen (the kit's `phoneOnlyGate`; only in the built site, so `vite dev` and the tests still run on a computer).
- **A notice before each class**: five minutes before a class starts, a banner (on screen) or a system notification names it with its time, teacher and room (`classStartingSoon` in `src/schedule-calc.js`, the kit's `notify`; the kit's `orbit:class` kind, its switch following the pass). The week's notices are handed to the Worker (`schedulePush`) so they arrive with the app closed.
- **National holidays**: no classes and no class notices on Taiwan's days off and their 補假 (`src/holidays.js`, from the kit's `holidays.mjs`); the "next day with classes" skips them.
- **Non-class periods handled properly**: lunch break, cleaning time, and similar special periods are shown by name with their own countdown on the main screen, rather than being forced into the "class" display format.

---

## Getting Started

This is a purely front-end project — no server, no database at runtime. During development, [Vite](https://vitejs.dev/) bundles the ES modules under `src/` and provides a dev server and test runner.

**Online use**: just open [jaypengx.github.io/Orbit-Class](https://jaypengx.github.io/Orbit-Class/) — nothing to install. Every push to `main` triggers `.github/workflows/static.yml`, which runs tests, builds, and deploys — a failing test blocks deployment.

**Local development**:

```bash
git clone https://github.com/JayPengX/Orbit-Class.git
cd Orbit-Class
npm install
npm run dev
```

Open the URL printed in the terminal (default `http://localhost:5173/`) — changes hot-reload on save.

**Other commands**:

```bash
npm test           # run the Vitest test suite
npm run build       # build the production bundle into dist/
npm run preview     # preview the dist/ build locally
npm run lint         # run ESLint over src/
npm run format       # run Prettier (excludes index.html and css/styles.css)
```

---

## How Schedules Are Built

Click the schedule-editor icon in the top-right tools menu to open the settings panel:

- **Teacher / course list**: each entry records a course name, teacher, and room. When building the schedule you pick from this list rather than retyping it for every period.
- **Scheduling**: a drawer-style interface — pick one day at a time and assign each period.
- **Bell times**: set the start/end time for each period; malformed times or overlaps with other periods are rejected.
- **Special periods**: lunch break, cleaning time, and similar.
- **Countdown events**: see the "Countdown events" note further down this section.

The editor remembers the last saved state. Any difference between the current form contents and that saved state counts as "unsaved changes" — closing the editor or doing an export/import in that state triggers a confirmation prompt first, to avoid accidentally overwriting your edits.

**Countdown events** are a list independent of the schedule itself: each entry records a name and a date (a single day, or a range — e.g. a three-day exam week). The dashboard shows the nearest upcoming events and the days remaining, sorted soonest-first.

---

## Odd/Even Week Detection

The app computes the ISO week number from the current date and maps even/odd to a "second week / first week" designation (a "swap odd/even" toggle is available to flip this to match how your school actually counts weeks) — no manual switching required. For a period that alternates between two different subjects on odd vs. even weeks, use a slash notation like `Chinese/Civics` to fill both subjects into one slot; the system automatically picks the correct half to display based on the currently computed week parity.

---

## Appearance & Theming

Appearance settings are stored separately from schedule data and don't affect each other. You can switch between light/dark mode, pick a preset color scheme, or choose a custom accent color (secondary and supporting colors are automatically derived to stay readable). Color changes go through a two-step "preview" then "confirm apply" flow — nothing is actually saved until you confirm. There are also several custom style save-slots you can switch between with one click.

---

## Time Simulation

This is a debugging tool, deliberately *not* a persistent button in the top toolbar. It's tucked inside a collapsed-by-default "Advanced: Time Simulation" sub-section at the bottom of the "Sync / Import-Export" panel, and only opens once you expand it and click "Open Time Simulation" — this avoids accidental activation during normal use, and keeps the toolbar limited to its fixed three buttons (Edit Schedule, Sync / Import-Export, Style Tools).

The time simulation panel lets you specify any weekday and any time directly; the entire dashboard (progress bar, countdown, next-period preview, special-period detection) recomputes and displays as if that were the real time. Leaving simulation mode restores the real clock — no need to wait for an actual point in time to test edge cases.

The automated test suite run by `npm test` uses the same simulation flags (`window.MANUALLY_TEST` / `TEST_DAY` / `TEST_TIME_SEC`) to exercise a set of boundary time points in jsdom. The time simulation panel handles interactive, manual spot-checks; the automated suite guards against regressions.

Next to the version number in the time simulation panel are two small buttons: "Update" forces a fresh fetch of the latest version (clearing the Service Worker cache), and "Reset" wipes all of this device's Orbit Class data (schedule, styles, sync settings) and returns to the initial start screen — this always prompts for confirmation first rather than clearing immediately, and does not affect any other device that's part of the same sync.

---

## AI Schedule-Photo Import

Take a photo or screenshot of a class schedule and let AI read it automatically, instead of entering every period by hand:

1. **Pick a file** → supports JPG/PNG/WebP, iPhone HEIC/HEIF, and PDF (a school-issued schedule file can be dropped in directly). Images the browser can decode are drawn onto a canvas, capped on their longest edge, and re-compressed as JPEG (to avoid sending huge files and slowing down recognition); HEIC and PDF are usually not decodable in-browser, so those are sent as-is — Gemini already understands both formats natively, so there's no need to bundle a PDF parser for every user. While recognition is in progress the "Choose File" button is locked, so switching files mid-flight can't leave an in-flight request pointless (it can't be cancelled, so switching would just waste a quota unit).
2. **Up to 6 files can be selected at once, and they are read together as one schedule** — not processed separately and stitched together afterward. This is the key part: you can give it one photo of a schedule whose columns use codes or generic subject names, then a second file — a screenshot from a course-registration system — and within the same request the model can use the second file's subject and teacher names to fill in the blanks left by the first. Order matters: later files supplement or correct earlier ones; when both files disagree about the same slot, the later file wins.
3. **Sent to Gemini** with a prompt that instructs the model to only report what it can actually see — uncertain bell times come back as an empty array rather than a guessed common schedule; teachers/rooms it can't read are left blank rather than invented (cross-referencing information between the two files doesn't count as inventing — only filling in something neither file contains does). The response format is constrained server-side by a Structured Output Schema, so the model can't return markdown fences, preambles, or any other shape — this measured about a 6% average reduction in output tokens in testing, **but had no measurable effect on latency itself** (A/B runs of the same model and photo, with and without the schema, came out essentially tied, occasionally even slightly slower with the schema). The claim that "a schema lets the model skip reasoning" didn't hold up here — the schema's real value is elsewhere: it guarantees the response is always parseable JSON, so `parseResponse()`'s fallback shell-stripping logic is no longer on the normal path, and during this change it caught a real bug that would otherwise have broken the feature outright (see "How this was measured" below). The odd/even-week toggle is entirely unaffected by AI import: a single photo can never reliably tell you whether it was taken during an odd or even week, so this setting always keeps its current value — whatever the AI recognizes never overrides it.
4. **Multiple Gemini models are tried in order — fastest first, strongest last.** Beyond connection/HTTP failures triggering a fallback to the next model, a structurally unusable result (e.g. zero classes recognized) also automatically triggers a retry with a stronger model further up the chain; only if all of them fail does the app hand the last attempt's result and error to the user for manual correction. While waiting, the UI shows a **fixed, non-counting estimated duration** (computed from file count, not a countdown — a countdown draws attention to exactly the moment it's most likely to be wrong, and hitting zero without finishing looks broken). Only once the wait significantly exceeds the estimate does the message change to "Taking a bit longer than expected, still recognizing…". A separate, smaller and dimmer "Waited N seconds" counter ticks alongside it — it answers a different question ("is this still alive?" rather than "how much longer?"), and is deliberately made less prominent than the estimate text and excluded from screen-reader announcements (`aria-hidden`), unlike the old countdown that used to announce a new number every second.
5. **Results go through the same validation/normalization pipeline as manual input**, and are shown as an editable, checkable preview.
6. **The preview screen also runs a second, content-level check** (`detectScheduleAnomalies()` in `src/gemini-ocr.js`) — the prior step only confirms the result is *structurally* valid (bell times are valid times, `weeklySchedule` has the right shape, at least one class or countdown event was recognized), not that the content actually makes sense. This second pass runs entirely locally — no additional Gemini call — and looks for cases that are structurally legal but suspicious: two bell times overlapping each other, a period whose time falls inside a special period like lunch or cleaning time yet still has a class assigned, two overlapping periods on the same day each assigned a different class (a scheduling conflict), or a class duration that's implausibly short (e.g. two minutes) or implausibly long. Each of these is only a heuristic and can produce false positives (a school might genuinely have two overlapping bell schedules), so they are always shown as a "might need attention" list in the preview and **never block or hide the import button** — blocking import is reserved for the hard validation failure in the prior step.
7. **Nothing is applied until the user confirms** (overwrite or merge into the existing schedule) — AI output never takes effect without explicit confirmation.

**Speed**: as soon as the user reaches the file picker (while they're still choosing a file), the app fires an empty warm-up request to the proxy, shifting the cost of DNS, TLS, and Worker cold-start into the seconds the user was going to spend picking a file anyway, rather than leaving it on the critical path after the user hits import. The proxy streams Gemini's response straight through rather than buffering the full response in the Worker and re-serializing it. Image encoding uses the asynchronous `canvas.toBlob` instead of `toDataURL` (which runs the entire JPEG encode synchronously on the main thread — for a large photo, that shows up as a frozen UI that looks like a crash). The browser console logs three timing segments — `GeminiEncode` / `GeminiCall:<model>` / `GeminiParse:<model>` — so a slow run can be diagnosed as an encoding, network, or front-end parsing bottleneck without guesswork.

**How this was measured**: the speed numbers above aren't guesses — a synthetic set of schedule photos plus course-registration screenshots was run directly against the real Gemini API (bypassing the not-yet-deployed Worker, using the same prompt/schema/generationConfig) for several dozen real requests. That process caught two bugs that would have broken this feature outright in production:

- The initial design used `additionalProperties` to describe `teacherDB`, an object whose keys are subject names the model itself invents. It turns out Gemini's `response_schema` (actually a subset of OpenAPI 3.0) doesn't support that keyword at all — every request was rejected with a 400 before it even reached the model. This isn't documented anywhere; it only surfaces when you make a real request with a real key. Simply removing the constraint down to a bare `type: 'object'` overcorrected: with no structural hint at all, the model just left the field empty. The fix that was both schema-legal *and* actually got populated by the model was replacing the `teacherDB`/`locationDB` maps with a `classes` array (each entry `{key, subject, teacher, location}`). `normalizeAIOutput()` in `src/gemini-ocr.js` now understands both the new array format and the old map format, for the same reason as the other `LEGACY_*` compatibility shims in that file: to guard against the window where a client and proxy version are momentarily out of sync during a rolling deploy.
- `maxOutputTokens: 8192` turned out to be too tight once schema constraints were combined with multi-file input: `gemini-3.6-flash` once stalled for 94 seconds, burned through the output cap, and returned content truncated mid-stream — not valid JSON (`finishReason: MAX_TOKENS`). Raising the cap to 24576 let the same request finish cleanly in 4 seconds, using fewer than 1000 tokens in the end — the model wasn't trying to say more, it just needed more headroom to wrap up properly; raising the cap doesn't make it talk longer. That same model later reproduced a completely different failure mode across several independent test runs (reading only 1 class instead of the expected 12), suggesting this model version is simply unstable under schema-constrained decoding — it was removed from the candidate list entirely rather than just reordered, since a fallback model that might silently hang for 94 seconds and then fail anyway is worse than no fallback at all. The same round of testing also found `gemini-2.5-flash` now returns 404 for new callers (Google has retired it) and was dropped from the list; `gemini-3.8-flash` (the newest version) returned 503 (overloaded) three times in a row even with backoff retries and isn't stable enough to use yet.

In practice (single photo, multiple runs) `gemini-3.5-flash-lite` consistently lands at 2–3 seconds; sending two photos together doesn't noticeably slow this down, and the bridging behavior between files works as intended — comfortably inside the target of "under 10 seconds, ideally under 5." That said, this is a one-time measurement against the current candidate model list, this prompt/schema, and whatever capacity Google's infrastructure happened to have at test time — not a permanent guarantee. Model availability, load, and even model behavior itself can change later.

An internet connection is required; without one, every other feature is unaffected (this is a skippable, optional feature). Opening the editor (settings) checks connectivity, and if there's no connection, the AI import and cross-device sync create/join buttons are grayed out and locked immediately, rather than letting you find out after clicking. The lock clears automatically once connectivity returns — no refresh needed. This check can only detect "no network at all" (e.g. airplane mode) — it can't detect "network present but can't reach the external service," which still only surfaces once an actual request fails.

### Where the key lives, and how secure it is

Ordinary users **never need** to obtain or enter their own Gemini API key. The deployment site already has a server-side proxy configured (`worker.js` in the separate [Shared-Proxy](https://github.com/JayPengX/Shared-Proxy) repo, at the `/gemini` path — the same Worker also serves `/eco`, where the schedule lives on the pass; see [Cross-Device Sync](#cross-device-sync-the-quadra-pass) below). The real key exists only as that Worker's encrypted secret and never ships in client-side code.

The proxy isn't a dumb pass-through: the client can only send `{model, files}` (file count, per-file and total size limits, and allowed MIME types are all enforced Worker-side); the actual prompt, response schema, and generation parameters sent to Gemini are hardcoded in the Worker itself. Even if someone extracts the Worker URL (it's already sitting in public front-end code) and calls it directly, all they can do is run "recognize the schedule in this image" — they cannot repurpose it as a general-purpose free AI proxy for arbitrary questions. This is deliberate, since the Worker URL was never meant to be secret.

**Hourly request limits**: when bound to a KV namespace (`RATE_LIMIT_KV`, see deployment steps below), this becomes a real counter shared across edge nodes, not a soft per-instance tally — without it, the count falls back to in-memory per-instance state, and since Cloudflare's edge runs many parallel instances, that's trivially bypassed by spreading requests across them. Whether or not KV is bound, this layer can only catch "a lot of requests from one IP in a short window" — it can't stop abuse spread across many IPs, and it isn't a cryptographic security mechanism.

The real backstop is **Shared-Proxy's `quota-guard`** (its README §8.1): Cloudflare's Workers Paid plan ($5) has no spending cap of its own, so the guard reads the account's real use every five minutes and turns the Workers off at 90% of any included amount until the next billing period; it cannot generate a bill past the $5 (unless someone deliberately attaches their own Gemini key to a paid, credit-card-backed billing account — see [Known Limitations](#known-limitations)).

Without internet, recognition simply can't happen; without a deployed proxy, the whole feature is unavailable (`VITE_PROXY_URL` set to `''`, or the Worker down) — it does not fall back to a bring-your-own-key flow. All other schedule features are unaffected.

### One-Time Deployment Setup

The Worker's source code, deployment steps, and detailed configuration (Cloudflare account setup, `GEMINI_API_KEY`, KV rate limiting, why `[placement] region` is set the way it is, GitHub Actions auto-deploy) have all moved to the separate [Shared-Proxy](https://github.com/JayPengX/Shared-Proxy) repo — because this one Worker has served Orbit, Orbit Vocab, and Match Find (three independent sites) from day one, and keeping it inside Orbit's own repo would make "which repo do I change the proxy in" an open question. Full steps are in that repo's README.

This repo needs no setting for it: the Worker's address is public (every visitor's browser calls it), so it's the default in `src/proxy-config.js` (`https://orbit-workers-proxy.pengzjay.workers.dev`; each feature appends its own path: `/gemini`, `/nl-edit`). A fork builds with `VITE_PROXY_URL` set to its own Worker, or `''` for none (the tests run that way).

Gemini occasionally reports `AI recognition request failed (400): User location is not supported for the API use.` (see `src/gemini-ocr.js`). The client automatically retries the whole request when this happens (up to 2 retries; `/nl-edit` uses the same retry logic — see [AI Natural-Language Schedule Editing](#ai-natural-language-schedule-editing) below). The error message also includes a Cloudflare colo code (`X-Worker-Colo` header, e.g. "colo: IAD") to help with bug reports. Why this error actually happens, and how shared-proxy is configured to avoid it, is documented in that repo's README under `[placement]`.

---

## AI Natural-Language Schedule Editing

This is a separate feature from AI schedule-photo import (independent requests, validation, and failure handling), but shares the same Worker address and the same `GEMINI_API_KEY` — the `/gemini` and `/nl-edit` paths are enabled **together**, with no way to turn on just one (whether the Worker actually implements a given path is the real switch — see the deployment setup below).

At the top of the **Schedule** tab in the "Edit Schedule" panel (not the "Sync / Import-Export" panel — the schedule editor is where the schedule is actually changed, so this tool lives here rather than in the sync panel) there is an "AI Schedule Edit" text input. Type a sentence (or several requests at once) describing what you want changed — e.g. "change Tuesday's third period to Physics," "move Wednesday's first period to Thursday's first period," or several things at once: "change Tuesday's third period to Physics, then clear Thursday's first period." After submitting, the AI translates the sentence into one or more structured edit operations, and applying them always shows a diff preview for confirmation first — the same preview/confirm flow used for AI import (the same `describeSettingsDiff()` / `showEditorSaveConfirm` path) — there's no such thing as a submission that changes the schedule directly.

- **Not a fixed set of actions — a compact edit patch**: an earlier version only recognized four fixed actions ("change a period," "move a period," "swap two periods," "clear a period"), so requests like "add a new class," "add another period," or "add a break period" had no matching action at all. It was then changed to have the AI read every editable field and return those fields' *complete* content "after applying the instruction" — this solved the missing-action problem, but meant the AI had to copy out every untouched class and every untouched schedule slot verbatim on every request, and it would occasionally miscopy a character during that process, silently corrupting a field the instruction never mentioned — with no obvious starting point for diagnosing it. The current design is a middle ground: the AI still reads every editable field (as before), but the response contains only what it's actually adding or changing — the classes to add/update (`classUpserts`), the class keys to delete (`deletedClassKeys`), the schedule slots to change (`scheduleEdits`, one entry per slot), plus a changed/unchanged flag for each of bell times, special periods, countdown events, and odd/even-week setting, with the new full content included only when changed. Adding a class, adding/removing a bell period, adding a special period, adding a countdown event, or toggling odd/even week are all naturally covered by this same response shape — the only difference is that anything the instruction didn't mention is no longer allowed to appear in the response at all.
- **Anything the instruction doesn't mention never appears in the response, so there's nothing left to miscopy**: the server-side prompt explicitly instructs the model to "list only what is actually being added, changed, or deleted — everything else must not appear in the response." The client takes this compact patch and layers it directly onto the current data (anything not mentioned — classes, schedule slots, bell times, special periods, countdown events — stays byte-for-byte unchanged), then computes the confirmation screen's diff from the before/after state. This makes "something the AI wasn't asked to change gets changed anyway" structurally impossible, rather than something that depends on a carefully worded prompt to avoid. A single instruction covering several things at once (e.g. "change Tuesday's third period to Physics, and add a lunch break from 12:00–13:00") is still one request and one response — the AI lists all the changes together in the same reply.
- **What's sent is just this one instruction, plus the schedule's full set of editable fields** (`classes` / `weeklySchedule` / `bellTimes` / `breakTimes` / `countdownEvents` / `reverseWeek` — not styling, sync settings, or other data), giving the AI enough context to resolve references like "my Tuesday third period" or "the Physics teacher's class," and enough data to actually add something rather than being forced to guess or fail.
- **A misunderstood instruction, or a reference to something that doesn't exist, are both clean failure states, not crashes**: when the AI returns "couldn't understand this instruction," it explains why in one sentence; when it returns "the thing you're referring to doesn't exist" (e.g. the schedule has no ninth period), it explains that too. Both cases show a dismissible message dialog — no error screen, and no data changes.
- **Anything the server returns is treated as untrusted and re-validated**: the client first does a shape check (are the expected fields present, with the expected types), then feeds the result into `normalizeSettingsData()` — the same content-level validation and sanitization shared with manual save, AI import, and backup restore. Any structurally implausible content is rejected before it reaches the confirmation screen; an unreasonable AI suggestion is never shown to the user as something to confirm. If the instruction produces no actual field changes, the UI shows "no changes" instead of an empty confirmation screen.
- **Automatic retry on Gemini's "User location is not supported" error**: this error comes from Google inferring a region from the Cloudflare Worker's egress IP rather than the user's actual location, so the same user can get a different result simply because Cloudflare routed them to a different edge node. On this error, the client automatically retries the whole request (not a retry within the same node), up to 2 times, before showing an error — the user never has to manually re-click submit. This uses the same retry logic as AI import (`gemini-ocr.js`).
- **This is an optional feature and is simply unavailable when not deployed/configured**: with no proxy (`VITE_PROXY_URL=''`), the input box shows "AI schedule editing is not configured yet — please contact your schedule administrator," with no fallback mode — consistent with AI import.

### One-Time Deployment Setup

This uses the **same** shared-proxy Worker, the **same** `GEMINI_API_KEY`, and the **same** Worker address as AI import (see the deployment setup under [AI Schedule-Photo Import](#ai-schedule-photo-import) above) — if you've already set that up, there's nothing else to do here. The `/nl-edit` path is already implemented in that Worker's `worker.js`, so it works as soon as the Worker is up.

If the Worker is down, or the build has no proxy, this feature is simply unavailable — it doesn't affect AI import, cross-device sync, or any other schedule feature.

---

## Backup, Export & Device Transfer

Data lives in a single browser only. Moving to another device/browser, or keeping an archival copy, relies on export/import: export flattens the schedule data, compresses it with raw DEFLATE, and turns it into a copy-pasteable text block. Pasting it into another device to import always shows a diff for confirmation before applying — it never silently overwrites the existing schedule. Older (uncompressed JSON) backups still import fine; new exports always use the new format.

---

## Cross-Device Sync: the Quadra Pass

Orbit Class is Quadra's related service, and a **Quadra Pass is required**:
the shared kit (loaded from Shared-Proxy's Pages through `index.html`'s
`kit:head`, `Shared-Proxy/kit/loader.html`; `#kit/quadra.mjs` stays out of
Vite's bundle) shows the
sign-in, and the schedule lives on the pass (the Worker's `/eco`, app
`orbit`, collection `orbit-quadra`). Its data is the same compressed v2
backup string the export/import flow produces, so every device signed in
with the pass shows the same schedule, updated when it's saved and checked
whenever the app comes back on screen or is used (`src/sync.js`).

### Never saving over a newer schedule

A device uploads only its own saved edits, and only while the pass still holds the copy the device last saw. If another device changed the schedule meanwhile, the pass's newer copy is kept, the change made here is set aside on the device (`orbitSetAside`, the newest ten) and a note says so. A device left open with an older schedule used to push it back over the newer one when it came back on screen.

### Sharing: merge keys

Only the pass that owns a schedule edits it. Its owner makes a **key**
(8 characters, valid 24 hours, `op: 'share-create'`); another pass that
enters it (`share-redeem`) gets **its own copy** of the schedule, to edit
as it likes. (Following another pass's schedule read-only is gone.)

### Older data

- A device that managed an old sync code (a code plus a manager passcode in
  localStorage) merges it into the pass automatically on first sign-in
  (`op: 'merge'`, the Worker checks the manager passcode); the transfer
  sheet's "舊版同步代碼" fold does the same by hand.
- A schedule kept only on the device is uploaded when the pass has none.
- Old read-only sync codes are retired: the schedule's manager shares a
  merge key instead.

The AI features (`/gemini`, `/nl-edit`) also need the pass: requests carry
the session token (`qt=`) and are limited per session.

## Data Storage

Everything is stored under a single browser `localStorage` key, `classFocusData`. Main fields:

| Field | Contents |
| ----- | -------- |
| `teacherDB` | course → `[course name, teacher, room]` |
| `locationDB` | course → room (fast lookup table) |
| `weeklySchedule` | each weekday (`Date.getDay()` 0–6, 0 = Sunday) mapped to that day's scheduled periods |
| `bellTimes` | each period's `[start time, end time]` |
| `breakTimes` | special periods, each `{name, start, end}` |
| `countdownEvents` | countdown events, each `{name, startDate, endDate}` |
| `reverseWeek` | odd/even-week swap toggle |
| `classSwaps` | 調課, one-time swaps: `{ a: { date: 'YYYY-MM-DD', p }, b: { date, p } }`, `p` the period's place in `bellTimes` |
| `proAccent` / `proSecondary` | appearance accent and secondary colors |
| `styleSlots` | custom style save-slots |

Every save carries an internal schema-version marker, checked on read; a mismatch triggers compatibility handling first. A corrupted save (invalid JSON, missing fields, wrong types) is discarded outright in favor of the default schedule, rather than keeping broken data around to fail again next time.

Other independent keys:

- `orbitSetAside` — the last ten edits set aside when the pass held a newer schedule (see above).
- `orbitOnboardingSeen` — whether the first-time-use prompt has been shown; `1` or absent.
- `orbitLocaleOverride` — the language chosen by hand.
- `orbitTestState` — the time simulation's state.
- The kit's own keys (the device's sign-in, never the pass; the pass's cached copy). Signing out removes every Quadra key on the origin.

---

## Project Structure / Architecture

The browser only ever loads static files: `index.html`, `css/styles.css`, and one built JS bundle. The original 4,500-line `js/app.js` has been split into ES modules under `src/`, using `import`/`export` to make dependencies explicit:

```text
src/data.js              Data read/write, validation, normalization, localStorage access
src/schedule.js          Assembles settings data into a "running schedule," weekday/week-parity computation
src/schedule-calc.js     Pure computation: which class/period should be shown right now
src/appearance.js        Theme color and light/dark mode
src/dashboard.js         Main-screen live-update core, including the update() state machine
src/editor-backup.js     Backup export/import, v2 transfer-format encode/decode
src/editor-core.js       Schedule editor main flow, unsaved-changes detection
src/editor-teachers.js   Teacher/course list editing
src/editor-schedule.js   Weekly scheduling interface
src/dashboard-render.js  Actual DOM rendering for the main screen
src/gemini-ocr.js        File pre-processing (image/HEIC/PDF) and Gemini proxy calls
src/editor-nl-edit.js    AI schedule editing: natural-language instruction parsing, validation, pre-apply preview
src/swap.js              調課: the swap sheet, making and undoing a one-time swap, 工具's list
src/sync.js              The schedule on the Quadra Pass (the kit's quadraSession('orbit')): read, write, never over a newer copy, share keys, old sync codes merged
src/onboarding.js        First-time-use prompt flow
src/bootstrap.js         Startup flow: load data, build schedule, start the per-second timer
src/testsim-runtime.js   Time simulation state machine
src/state.js             Shared mutable state across modules
src/constants.js         Shared constants across modules (weekday names, default colors)
src/strings.js           UI text lookup table
src/main.js              Entry point, imports every module above in order
```

Server-side code (`/gemini`, `/nl-edit`, `/eco`) does not live in this repo — that Cloudflare Worker is now the independent [Shared-Proxy](https://github.com/JayPengX/Shared-Proxy) repo, is not part of `src/`'s dependency graph, and is naturally not bundled by Vite. Without it deployed and its environment variables configured, the corresponding feature is simply unavailable — there is no fallback mode.

Each file starts with a one-line comment describing its responsibility. A few conventions worth knowing before changing code:

- **`src/state.js` is the shared mutable-state container.** State that's shared across modules and written from multiple places belongs in the object `state.js` exports (`state.xxx = ...`) — don't create another module-level `let` for it. ES module `import` bindings are read-only, so another module can't assign to it directly.
- **`window.update()` is a deliberately dynamic call.** At runtime, `testsim-runtime.js` swaps it out for a wrapper that layers in time-simulation logic. To trigger a re-render, always call `window.update()` rather than `import { update }` — importing it directly would call the original, un-swapped version, silently breaking time simulation. The same applies to `window.openTestPanel`.
- **`update()` is split into a pure-computation layer and a rendering layer**: `computeDashboardViewModel()` in `schedule-calc.js` never touches the DOM — it only produces a plain object describing what the screen should look like; `renderDashboard()` in `dashboard.js` then writes that result into the page (diffing against the previous render so unchanged fields aren't rewritten). Changes to schedule-computation logic usually belong in `schedule-calc.js`, and can be unit-tested directly as a pure function.
- **`src/strings.js` is the text lookup table**, currently only containing `zh-TW`, accessed via `t('some.key')`. This isn't in preparation for immediate multi-language support — it's just keeping text separate from logic; new UI text should follow this same convention.
- **`src/constants.js` holds constants shared across modules, and deliberately imports nothing.** `data.js` and `appearance.js` import each other, so putting shared constants in either one would create a circular-import TDZ error. Weekday labels (`WEEKDAY_LABELS`) and the two weekday orderings (`WEEKDAYS_DISPLAY_ORDER`, Monday-first, used for display; `WEEKDAYS_INDEX_ORDER`, Sunday-first, matching `Date.getDay()` and the storage format) both live here — import them as needed rather than redefining them per file.

---

## The Per-Second Update Loop

On startup, a timer runs once per second, fully recomputing every time:

```text
get current time → derive weekday → derive odd/even week → look up today's schedule
    → determine current period (or special period) → determine next period
    → update remaining time / countdown numbers → render to screen
```

Because the whole state is recomputed from scratch every tick, rather than patched incrementally on top of the previous state, edge cases like "class just ended" or "day just changed" need no special-case handling at all.

"Recomputing" and "writing to the screen" are two separate steps: computation always runs in full every tick, but the DOM-write step diffs against the previous render and only writes fields that actually changed (countdown numbers and progress-bar width change every second by nature and are excluded from this diffing). A given class's name, for instance, typically stays the same for tens of minutes at a stretch — there's no reason to rewrite it every second and trigger unnecessary browser style recalculation.

---

## Responsive Design & Accessibility

On mobile, the layout is touch-first: larger buttons, reflowed cards, a bottom sheet menu in place of a sidebar, iOS safe-area handling, and respect for the system's "reduce motion" preference.

Tablet/desktop don't get a separate layout — they're the same mobile-first design scaled up and centered proportionally, with card width capped in stages as the viewport widens (`≥700px`, `≥1024px`), and the whole layout centered vertically when the screen is taller than the content.

"Add to Home Screen" provides a dedicated icon (`public/icons/`), rather than relying on a system-generated thumbnail.

---

## Privacy

Ordinary use — building a schedule, viewing the dashboard, backup export/import — happens entirely on-device; no data leaves the device. There are two exceptions, both enabled by default on the deployed site:

- **AI recognition**: a selected file is sent to the proxy and forwarded to Gemini (the proxy doesn't retain files, but the file's contents genuinely do leave the browser). This only happens once you select a file and click import; the warm-up request fired when the file picker opens carries no file content.
- **AI schedule editing**: the instruction text you type, along with every editable field of the current schedule (course list, scheduling, bell times, special periods, countdown events, odd/even-week setting — see [AI Natural-Language Schedule Editing](#ai-natural-language-schedule-editing)), is sent to the proxy and forwarded to Gemini. This only happens once you type something and click submit.
- **Quadra Pass**: the schedule is stored on your Quadra Pass (only a hash of the pass is kept server-side); see [Cross-Device Sync](#cross-device-sync-the-quadra-pass).

On a self-hosted fork without the corresponding environment variables configured, each of these features is simply unavailable — there's no fallback.

---

## Contributing / Notes for Modifying This Project

There's no framework and no backend at runtime; development uses Vite + Vitest + ESLint/Prettier.

- Don't add a front-end framework (React/Vue/etc.) — Vite here is purely a bundler/dev-server/test-runner.
- Put new features into whichever existing module is the closest semantic fit (see [Project Structure / Architecture](#project-structure--architecture)); mutable state shared across modules belongs in `state.js`.
- New `localStorage` fields should follow the pattern already used by the `normalize*`/`validate*`/`sanitize*` functions in `src/data.js`: validate before storing, and make sure old data loading in won't blow up.
- After changing schedule-computation or countdown logic, run `npm test` first; scenarios not covered by automated tests (most editor UI, the style panel, the AI import flow) should be manually spot-checked at boundary times using the time simulation panel.
- After a style change, check both dark mode and mobile width.
- After finishing a change, run `npm run build` and confirm `dist/` is a fully working site, not just something that runs fine in dev mode.

---

## Known Limitations

- Sync is not push-based: a save uploads immediately, and another device picks it up when it comes back on screen or is used (the kit's heartbeat also reads the pass every two minutes while open).
- No real-time multi-user editing: one pass owns a schedule; others get copies.
- AI schedule editing reads and rewrites the entire set of editable data at once (classes, scheduling, bell times, special periods, countdown events, odd/even-week setting); anything it doesn't understand, or that refers to something nonexistent, is never guessed at, and a diff preview must be reviewed and confirmed before anything applies. Like AI import, it requires an internet connection and shares the same hourly request limit.
- AI recognition, AI schedule editing, and cross-device sync all run on the deployer's shared infrastructure, and quota is counted against the deployer, not the individual user; the worst case of abuse is the quota running out and the feature pausing, not a bill — unless the deployer has personally attached their Gemini key to a paid, credit-card-backed billing account.
- AI recognition accuracy depends on photo clarity and schedule layout — always review the preview before confirming an import; an internet connection is required. To keep wait times short, the fastest model is tried first, with escalation to stronger models only when the result is structurally unusable — this is much faster on average than always starting with the largest model, though occasionally a couple of extra fields may need manual correction even at the same photo quality.
- Automated tests cover schedule computation, data validation, backup format, the sync module, and the AI proxy logic, but editor UI flows, the style panel, and actual AI-recognition accuracy still rely primarily on time simulation and manual verification.

---

## Current Status

Schedule display, scheduling, odd/even-week switching, bell times, special periods, countdown events, appearance customization, time simulation, backup export/import, AI photo recognition (including content-level anomaly warnings in the import preview), AI schedule editing, and cross-device sync are all fully functional and independent of one another — the core schedule features never depend on network access or AI; AI and sync are both optional. `js/app.js` has been fully split into ES modules under `src/`, with automated tests covering schedule computation, data validation, backup format, the sync module, and the AI proxy logic (including natural-language-edit validation and anomaly detection); test coverage of the editor UI flows may be extended further going forward.

---

## Related Projects

- **[Shared-Proxy](https://github.com/JayPengX/Shared-Proxy)** — the Workers (`/eco`, `/gemini`, `/nl-edit`, `/push`), the kit and the brand; its README describes the whole family.
- The other apps of the family, the same pass: Quadra Securities, Quadra Play, Orbit Weather, Orbit Transit, Orbit Sports, Orbit Words.

## What depends on what

| If you change… | Also check |
| --- | --- |
| The saved schedule's shape (`src/data.js`) | `normalize*`/`validate*`, the v2 backup string (`editor-backup.js`: the pass's copy is the same string), older copies opening |
| 調課 (`classSwaps`) | `classesOnDate` (今天, 課表, the card, `weekClasses`' notices), `normalizeClassSwaps`, the transfer format's 12th entry, AI import keeping them |
| Class times or the notice rule | `classStartingSoon`, the Worker's list (`schedulePush`), holidays |
| The prompts or schema of `/gemini`, `/nl-edit` | They live in Shared-Proxy's `worker.js`; `normalizeAIOutput` here reads both old and new shapes |
| The look | The kit's glass tokens (`kit-glass.test.js`), dark mode, 375 px |

---

**[jaypengx.github.io/Orbit-Class](https://jaypengx.github.io/Orbit-Class/)** — open it in a browser and start using it.
