# Features kept

Every feature a person uses in this app, with the code that makes it.
`test/features.test.js` fails if any mark below disappears, so a refactor cannot
drop a feature silently (2026-11-03, after the lost-features audit).
To remove a feature on purpose, delete its line here in the same commit and say why.
- 今天: the hero, the day's classes, any school day picked — `src/view-today.js`: `renderHero`, `dayCards`, `pickDay`
- Countdowns in your own order — `src/view-today.js`: `renderCountdowns`
- 課表 with 單/雙週 — `src/view-week.js`: `renderWeek`, `單週`
- 調課: add and undo, and by AI — `src/swap.js`, `src/nl-swap.js`: `openSwapSheet`, `removeSwap`, `parseSwapEdit`
- 拍照匯入 and 分享金鑰 — `src/locales/zh-TW.js`: `拍照匯入`, `分享金鑰`
- Typhoon 停課 as a day off — `src/holidays.js`: `dayoff`, `停課`
- 專注飛行 (a focus timer following a real plane) — `src/flight.js`: `openFlight`, `resumeFlight`
