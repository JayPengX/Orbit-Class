# Orbit Class

The class now and what comes next, at a glance. Phone only, signed in
with the Quadra Pass, which keeps the timetable.

Live: https://jaypengx.github.io/Orbit-Class/

## How it works

- **Tabs, one question each:**
  - **今天:** one card answers "what's left today": the class now (teacher,
    room, time left), the next, and the day as a strip of coloured chips
    (done faded, now ringed) with how many are left and when school's out.
    Below it the family's strip of days (today and the school days of the
    next two weeks, 📅 for any day, a swipe for the next) over that day's
    classes (today's: the ones after the card), and the countdowns. After
    the last class it shows the next school day.
  - **課表:** the week as a grid, this one or the next (單週 / 雙週), a day's head opening 今天 on that day; and 調課.
  - **工具:** the week as a grid with 編輯課表; AI 課表編輯 and 拍照匯入;
    分享金鑰.
- **Every second** the whole state is recomputed from the clock: weekday,
  odd/even week, current period or break, next period. Only changed
  fields are written to the page.
- **調課:** a one-time swap of two periods on any two dates, across weeks
  too. `classesOnDate` (`src/schedule.js`) is the one rule every view and
  notice reads (a holiday has no classes). A swap follows its periods by
  their times when the bell times change, and undo matches it by both sides.
- **Odd/even weeks** counted straight on from the week of 2025-12-29
  (`WEEK_EPOCH`; the same as ISO through 2026, and still alternating over
  2026's 53rd week, where ISO's would repeat odd). A swap toggle if the
  school counts differently; `語文/公民` in a slot splits by week.
- **Countdowns** to exams and events; 結束後自動刪除 optional.
- **Notices** five minutes before each class, handed to the Worker so they
  arrive with the app closed. No classes or notices on Taiwan's holidays.
- **AI 拍照匯入** (`/gemini`): up to 6 photos, screenshots, HEIC or PDF, read
  together as one timetable. Models are tried fastest first, then
  stronger. A local check flags suspicious results, and nothing applies
  until confirmed.
- **AI 課表編輯** (`/nl-edit`): a sentence becomes a compact patch (only
  what changes), always shown as a diff to confirm. The server's answer is
  re-validated like any manual save.
- **The Pass:** the timetable is the pass's payload (app `orbit`), the same
  compressed v2 string as the transfer format. A device uploads only while
  the pass holds the copy it last saw; otherwise its edit is set aside
  (`orbitSetAside`), never lost. With the editor open and unsaved, a newer
  copy (or the inbox) waits (`DEFERRED`) instead of being skipped;
  redeeming a share key sets the local copy aside first. 分享金鑰: an 8-character key (24 h) gives
  another pass its own copy.
- **Offline:** opens on the kept timetable; the AI features say they need
  the network.

## Decisions in force

- One look: Class's own accent, light or dark with the device. The style
  panel was deleted (old saves' colours are read, never applied).
- Phone only: a computer gets a QR code.
- The language is the family's: one picked in any Quadra or Orbit app (`quadra.lang`) opens Class.
- The AI prompts and schemas live in the Worker. The client sends only
  files or the instruction, so the endpoint can't be used as a general AI.
- The odd/even toggle is never changed by AI import.

## Code (`src/`)

| File | What |
| --- | --- |
| `data.js` | Read, write, validate, normalize (`classFocusData` in localStorage) |
| `schedule.js`, `schedule-calc.js` | The running schedule; what to show now (pure, tested) |
| `dashboard.js` | The per-second loop and its rendering |
| `editor-*.js` | The editor; backup format; AI editing |
| `gemini-ocr.js` | Photo import |
| `swap.js`, `tools.js`, `sync.js` | 調課; the 工具 tab; the Pass |
| `state.js`, `constants.js`, `strings.js` | Shared state; shared constants; text |
| `dates.js` | Date keys and times (`dateKey`, `parseTime`, `timeToMinutes`): the one copy |

Gotchas:

- Call `window.update()`, not an imported `update`: the time simulation
  swaps it.
- Shared mutable state goes in `state.js`.
- `constants.js` imports nothing, to avoid a circular import.

## Run and test

```bash
npm install
```

```bash
npm test
```

```bash
npm run lint
```

`npm run dev` serves it locally (Vite). A push to `main` tests, builds and
deploys to Pages. The time simulation panel (in the transfer sheet, under
Advanced) sets any day and time by hand.

## If you change…

| This | Also check |
| --- | --- |
| The saved shape (`data.js`) | `normalize*`, the v2 transfer string, older copies opening |
| 調課 (`classSwaps`) | `classesOnDate`, its notices, the transfer format |
| Class times or the notice rule | `classStartingSoon`, `schedulePush`, holidays |
| `/gemini`, `/nl-edit` | Shared-Proxy's `worker.js`; `normalizeAIOutput` reads old and new shapes |
