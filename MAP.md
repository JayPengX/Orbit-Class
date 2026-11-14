# Orbit Class: the map

The class now and what comes next, at a glance; the timetable, 調課, to-dos,
the school's news. Signed in with the Orbit Pass, which keeps the timetable.
The one Vite app in the family (`src/`). Live: https://orbit.jaypengx.com/class/

## Rules

Jay's, dated (Taiwan day), newest wins; the family's are in Orbit-Core `docs/RULEBOOK.md`.

- 10-21 Class never guesses what to bring (要帶).
- The local timetable is kept aside if unreadable, never lost; the Pass copy restores. A device uploads only while the Pass holds the copy it last saw; otherwise its edit is set aside (`orbitSetAside`).
- 10-30 專注飛行 is a trial: all of it is `src/flight*.js` and `src/focus-music.js`, the `flight.*` strings and the `.cx-fl`/`.cx-fly` CSS, so removing it is deleting those, its 工具 card (`tools.js` flightCard), `main.js`'s resume line and `testing.js`'s two flight presets.
- 11-05 A subject's colour says its group: ten swatches clearly apart, one per group (國語文 red, 英語 blue, 外語 sky, 數學 violet, 自然 green, 社會 yellow, 藝術 pink, 健體 orange, 科技 teal, the rest grey), each subject its own icon; both can be picked per subject. `test/subjects.test.js` holds the pattern, not the hexes.
- 11-10 學校公告 shows only what's for you (everyone, your grade, 國中部 for a 國中 grade); 轉知 (what the school passes on) and 進修部 are their own tabs, never in 跟你有關; every board the school has is read, kept 45 days; drawn rows, never plain text.
- 11-12 An imported timetable (photo, backup) keeps the 調課 whose periods it still has (by time, else by number) and drops the rest; the saved toast says how many (`data.js` remapClassSwaps `imported`).
- 11-10 The family's AI, code first: 問我的課表 answers a named day's classes by code, the rest by the AI door, every claim checked against the timetable, drawn as the days that answer it, never applied. AI import and AI editing are always shown to confirm; the odd/even toggle is never changed by AI import. The prompts live in the Worker; the client sends only files or the instruction.
- 11-14 A copy that arrives from the Pass comes in quietly: no 從其他裝置更新 notice (it was mostly the app's own 結束後自動刪除 run in another place). The same copy made in two places is no conflict. 問我的課表 is told the countdowns still to come.
- 11-11 A wide 今天 deals its parts into even columns, dealt again as each fills in (`.q-flow-refit`).
- Orbit's own look (`data-look="native"`, `css/look.css` after `styles.css`; `test/look.test.js`, `test/dashboard.test.js`). The language is the family's (`orbit.lang`). No classes or notices on Taiwan's holidays or typhoon days off.

## How it works

- **Tabs:** 今天 (one card for what's left today: the class on now or next as a band in its subject's colour, the time left, the day as a line of dots; then the day strip, the day's classes as a timeline, 待辦, 學校公告, countdowns; `view-today.js`) · 課表 (the week as a grid, 單週/雙週, 調課) · 工具 (the week with 編輯課表, 專注飛行, AI 課表編輯, 拍照匯入, 分享金鑰, 加到行事曆, 拍聯絡簿, 考前讀書計畫, 學校公告).
- **Every second** the whole state is recomputed from the clock (weekday, odd/even week, period or break, next); only changed fields are written to the page.
- **One rule for a day:** `classesOnDate` (`src/schedule.js`), read by every view and notice; 調課 swaps two periods on any two dates, following them by their times when the bell changes. Odd/even weeks count on from the week of 2025-12-29 (`WEEK_EPOCH`), with a toggle for schools that count otherwise.
- **Notices** five minutes before each class, handed to the Worker so they arrive with the app closed.
- **AI:** 拍照匯入 (`/gemini`: up to 6 photos, screenshots, HEIC or PDF read as one timetable, checked locally); AI 課表編輯 (`/nl-edit`: a compact patch shown as a diff, validated like a manual save); 拍聯絡簿 (`class-book`), 考前讀書計畫 (code plans the time, `planSessions`; `class-plan` writes each session's work), 學校公告 (Orbit-Core `/class-news` reads the school's boards and words new titles once for everyone, `class-news`), 問我的課表 (`class-ask`). The AI box and 問 Orbit also take a command (`act.js`, read by the kit's `act.mjs`, no AI call): a focus opens 專注飛行 on the length said, a countdown is offered to 套用.
- **專注飛行:** a focus timer that follows a real plane landing in about the chosen time (Orbit-Core `/flight`, the kit's `flight.mjs`; Leaflet and Esri imagery loaded only here); 縮小 folds it into the kit's `.q-accessory` pill; 專注配樂 plays Beats' calm radio (`/beats/lib/focus.mjs`). A focus begun, handed to another plane, landed or ended goes to the Pass's shelf too (`flight-store.js focusChanged`, RULEBOOK 11-13 one account, many places), so Class opened in Orbit, the separate app or another device flies the same one (`focusFromPass`, `sync.js`, `flight.js flightFromPass`); the plane's latest fix and the pill are each screen's own. An opening's change waits till the Pass is heard (`focusHeard`): a kept flight landing as Class opens never wins over an end made elsewhere.
- **The family's notebook** (kit `family.mjs`): Class tells its next two weeks as held (`src/family-tell.js`, for Weather and the Pass's 今天); reads Words' `vocab.due` (下課背五個 → `#five`); 怎麼去學校 / 回家怎麼搭 open Transit's planner (`planHash`).
- **The Pass:** the timetable is the payload (app `orbit`), the compressed v2 string (also the transfer format; to-dos the 15th entry, the school the 16th, subject icons and colours the 13th and 14th). An unsaved editor defers a newer copy (`DEFERRED`). 分享金鑰: an 8-character key, 24 h.
- **Offline:** opens on the kept timetable; the AI features say they need the network.

## Code (`src/`)

| File | What |
| --- | --- |
| `data.js` | Read, write, validate, normalize (`classFocusData` in localStorage) |
| `schedule.js`, `schedule-calc.js` | The running schedule; what to show now (pure, tested) |
| `dashboard.js` | The per-second loop and its rendering |
| `editor-*.js` | The editor; backup format; AI editing |
| `gemini-ocr.js` | Photo import |
| `subjects.js`, `subject-picker.js` | A subject's icon and colour (by its group); picking them |
| `swap.js`, `tools.js`, `sync.js` | 調課; the 工具 tab; the Pass |
| `state.js`, `constants.js`, `strings.js` | Shared state; shared constants; text |
| `flight.js`, `flight-plan.js`, `flight-store.js` | 專注飛行: the sheet and the flying screen; its rules (tested); what's kept |
| `focus-music.js` | 專注配樂 (the AI plan's family links): Orbit Beats' calm radio while a flight flies, its module imported from Beats' site (`/beats/lib/focus.mjs`, same origin, made on the phone); the picker's switch (`class.focusMusic.v1`), started by the tap on a flight (the audio element unlocked in that tap, iOS), ♪ on the screen to pause or play, stopped when the flight ends |
| `calendar.js` | 加到行事曆: the next 4 weeks' classes (`classesOn`: 單/雙週, 調課, days off) as an .ics, handed to the proxy's `/cal` (Orbit-Core `cal.js`) when the timetable changes and weekly, which serves it at a private webcal:// address the phone's Calendar subscribes to; `class.cal.v1` on the phone. 一個行事曆: the same calendar holds the school days off (holidays, typhoon 停課, all day) and the games followed in Orbit Sports (the family notebook's `sports.games`, a tap opens the game) |
| `todos.js`, `todos-data.js` | 待辦 and 拍聯絡簿; the saved shapes (pure: to-dos, the school, the v2 entries) |
| `study.js`, `plan.js` | 考前讀書計畫: the sheet; the time by code (pure, tested) |
| `school-news.js` | 學校公告: the school picker, 今天's section, the sheet |
| `dates.js` | Date keys and times (`dateKey`, `parseTime`, `timeToMinutes`): the one copy |

Gotchas:

- Call `window.update()`, not an imported `update`: the time simulation
  swaps it.
- Shared mutable state goes in `state.js`.
- `constants.js` imports nothing, to avoid a circular import.

## Run and test

```bash
npm install && npm test && npm run lint
npm run dev                                                  # Vite, locally
node ../Orbit-Core/tools/preview.mjs orbit --live --width 375
```

A push builds and deploys to Cloudflare (`push.sh` runs the build too). The
time simulation (`testsim-runtime.js`) opens from the kit's 測試工具 (Orbit Pass ›
seven taps on 除錯紀錄 › 這個 App › 時間模擬): `testing.js` adds Class's switches
there (the sim, the welcome card, `classOff` today off, `flightFail` / `flightNone`).

## If you change…

| This | Also check |
| --- | --- |
| The saved shape (`data.js`) | `normalize*`, the v2 transfer string, older copies opening |
| 調課 (`classSwaps`) | `classesOnDate`, its notices, the transfer format |
| Class times or the notice rule | `classStartingSoon`, `schedulePush`, holidays |
| `/gemini`, `/nl-edit` | Orbit-Core's `worker.js`; `normalizeAIOutput` reads old and new shapes |
| `class-book`, `class-plan`, `class-news` | Orbit-Core's `ai-features.js` (prompts, checks), `ai-fixtures.js` (tried with `build.yml` ai-try), `class-news.js` (the school readers) |
