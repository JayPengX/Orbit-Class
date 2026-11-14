# Features kept

Every feature a person uses in this app, with the code that makes it.
`test/features.test.js` fails if any mark below disappears, so a refactor cannot
drop a feature silently (2026-11-03, after the lost-features audit).
To remove a feature on purpose, delete its line here in the same commit and say why.
- 今天: the card (the class as a band, the minutes, the day as one line), the day's classes, any school day picked — `src/view-today.js`: `renderHero`, `dayCards`, `pickDay` (its look in css/look.css)
- Countdowns in your own order — `src/view-today.js`: `renderCountdowns`
- 課表 with 單/雙週 — `src/view-week.js`: `renderWeek`, `單週`
- 調課: add and undo, and by AI — `src/swap.js`, `src/nl-swap.js`: `openSwapSheet`, `removeSwap`, `parseSwapEdit`
- 拍照匯入 and 分享金鑰 — `src/locales/zh-TW.js`: `拍照匯入`, `分享金鑰`
- Typhoon 停課 as a day off — `src/holidays.js`: `dayoff`, `停課`
- 專注飛行 (a focus timer following a real plane) — `src/flight.js`: `openFlight`, `resumeFlight`
- 專注飛行 follows the account: begun, handed over, landed or ended in one place (Orbit, the separate app, another device), Class opened anywhere else flies the same flight — `src/flight-store.js`, `src/flight.js`, `src/sync.js`: `focusChanged`, `focusFromPass`, `flightFromPass`
- A class's icon and colour picked (class sheet, 編輯課表) — `src/subject-picker.js`: `openSubjectPicker`, `subjectColors`
- 加到行事曆 (the timetable in the phone's Calendar, kept current) — `src/calendar.js`, `src/tools.js`: `buildIcs`, `keepCalendar`, `calRow`
- 待辦 on 今天, kept with the timetable — `src/todos.js`, `src/todos-data.js`: `renderTodos`, `openTodoSheet`, `todoEntry`
- 拍聯絡簿變待辦 (a photo read by AI, looked over before it's kept) — `src/todos.js`: `openBook`, `class-book`, `nextClassOf`
- 考前讀書計畫 (time by code, what to do by AI) — `src/study.js`, `src/plan.js`: `openStudyPlan`, `planSessions`, `class-plan`
- 學校公告摘要 (only the ones for this student) — `src/school-news.js`: `openSchoolPicker`, `renderSchoolNews`, `forMe`, `/class-news`
- 問 Orbit's question (`#ask=`, the Pass sheet's box) asked in the editor's AI box as 問我的課表 — `src/ask-link.js`, `src/shell.js`: `askInBox`, `askFromLink(opened)`
- 問我的課表 knows the countdowns still to come (name and days only) — `src/class-ask.js`: `askFacts`
- Told, not only asked (Jay 11-14): 「開始專注飛行 50 分鐘」 in the AI box or 問 Orbit opens 專注飛行 on that length, 「加段考倒數 11/30」 offers the countdown to 套用; read by code (kit act.mjs), no AI call — `src/act.js`, `src/editor-nl-edit.js`, `src/ask-link.js`: `readClassAct`, `startFocus`, `withCountdown`
