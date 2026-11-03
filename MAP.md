# Orbit Class: the map

The class now and what comes next, at a glance. Any screen, signed in
with the Orbit Pass, which keeps the timetable.

Live: https://orbit.jaypengx.com/class/

## How it works

- **Tabs, one question each:**
  - **今天:** one graphite card answers "what's left today", led by the
    class: the one on now (or the next) as a band in its subject's colour
    (glyph, name, teacher, the room large on the right), the minutes left
    large (40 分鐘後下課), then the day as one line of dots, each its subject's
    colour with its two-character short name (an English one by its words'
    capitals, Advanced English → AE; done faded, now ringed in the app's
    colour; lunch a longer dashed gap; a tap opens that dot's own class),
    how many are left, when school's out and the next school day's first
    class; the foot (接著 / 下一節) opens the class it names. Once school's
    out the band is the next school day's first class (`view-today.js renderHero`, `css/look.css`).
    Below it the family's strip of days (today and the school days of the
    next two weeks, 📅 for any day, a swipe for the next) over that day's
    classes (today's: the ones after the card), and the countdowns. After
    the last class it shows the next school day.
  - **課表:** the week as a grid, this one or the next (單週 / 雙週; both side by side on a wide screen), a day's head opening 今天 on that day; and 調課.
  - **工具:** the week as a grid (課表's short names) with 編輯課表; 專注飛行; AI 課表編輯 and 拍照匯入;
    分享金鑰.
- **專注飛行** (a trial, Jay 2026-10-30): a focus timer that follows a real plane.
  Pick 25/50/90 minutes or type 10–180; the proxy's `/flight` (Orbit-Core
  `flight.js`) offers three planes in the air now that land in about that
  time. The planes in the air are kept on the phone (10 minutes, refreshed
  behind) and picked there, so 25/50/90 switch at once; up to 6 flights, whole
  short flights first, never none. The screen is the plane on a satellite map (Esri imagery, Leaflet,
  loaded only here), gliding every frame from its last fix (kit
  `flight.mjs`), the camera riding along, clouds drifting under it; the time
  left large. Landing early hands over to another plane for the rest; the end
  is a notice through the Worker. Kept on the phone only (`class.flight.v1`).
  All of it is `src/flight*.js`, the `flight.*` strings and the `.cx-fl`/
  `.cx-fly` CSS: removing it is deleting those and the 工具 card.
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

- One look: Orbit's own (Orbit-Core `docs/DESIGN.md` §11; `index.html` says
  `data-look="native"`, `css/look.css` after `styles.css`): graphite cards,
  colour only on what it names (a subject's band, its dot, the class sheet's
  count), Class's accent only for now and the main action; light or dark with
  the device. The style panel was deleted (old saves' colours are read, never applied).
  `test/look.test.js` and `test/dashboard.test.js` hold it.
- Every screen, either way up (Jay 2026-10-31): a phone upright or on its side, a
  tablet, a computer. On a wide page (`html.q-wide`) 今天's card runs across the
  top (the class on the left, the day's line on the right) with the day's classes beside the countdowns, 課表 shows both weeks side
  by side (調課 beside them on a computer), 工具 the week beside its tools; the
  app's own sheets are centred cards on a tablet or computer (`styles.css` §7).
- The language is the family's: one picked in any Orbit app (`orbit.lang`) opens Class.
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
| `flight.js`, `flight-plan.js`, `flight-store.js` | 專注飛行: the sheet and the flying screen; its rules (tested); what's kept |
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
deploys to Cloudflare. The time simulation panel (in the transfer sheet, under
Advanced) sets any day and time by hand.

## If you change…

| This | Also check |
| --- | --- |
| The saved shape (`data.js`) | `normalize*`, the v2 transfer string, older copies opening |
| 調課 (`classSwaps`) | `classesOnDate`, its notices, the transfer format |
| Class times or the notice rule | `classStartingSoon`, `schedulePush`, holidays |
| `/gemini`, `/nl-edit` | Orbit-Core's `worker.js`; `normalizeAIOutput` reads old and new shapes |
