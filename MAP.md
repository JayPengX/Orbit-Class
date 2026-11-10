# Orbit Class: the map

The class now and what comes next, at a glance. Any screen, signed in
with the Orbit Pass, which keeps the timetable.

Live: https://orbit.jaypengx.com/class/

## How it works

- **Tabs, one question each:**
  - **今天:** one graphite card answers "what's left today", led by the
    class: the one on now (or the next) as a band in its subject's colour
    (glyph, name, teacher, the room large on the right) that fills as it
    goes (its colour lit up to now, a shade darker for what's left: no bar of
    its own), the time left large with the clock it ends at on the right (to the second within the hour of a class: 39 分 54 秒後下課, the
    figure patched in place each second), then the day as one line of dots, each its subject's
    colour with its two-character short name (an English one by its words'
    capitals, Advanced English → AE; done faded, now ringed in the app's
    colour; lunch a longer dashed gap; a tap opens that dot's own class),
    how many are left, when school's out and the next school day's first
    class; the foot (接著 / 下一節 / 明天) is a small band of its own in that
    class's colour (glyph, when over its name, the teacher) and opens it. Once school's
    out the band is the next school day's first class; a break that is the
    card itself (bedtime) is a band of its own (the moon in indigo, its hours
    under its name), the time left in minutes and a bar from its start to its
    end (`view-today.js renderHero`, `css/look.css`).
    Below it the family's strip of days (today and the school days of the
    next two weeks, 📅 for any day, a swipe for the next) over that day's
    classes as a timeline (`dayCards`: the start over the end on the left,
    each class a block washed in its subject's colour with a bar of it at its
    edge, teacher · room under its name; a named break a dashed line with its
    cup; today's: the ones after the card; today picked again once it's
    over: 今天的課, every class faded), and the countdowns. After the last
    class it shows the next school day. A class's sheet (`view-sheet.js`):
    its pencil opens the icon and colour picker as a sheet over it, so closing the
    picker leaves the class open.
  - **課表:** the week as a grid (cells solid in a soft shade of their subject's colour, back-to-back periods of one
    class one block, today's column on a plate, names on one line shrunk to fit, a free period a quiet dot, now ringed), this one or the next (單週 / 雙週; both side by side on a wide screen), a day's head opening 今天 on that day; and 調課.
    Each class a cell washed in its subject's colour with a bar of it on its left, the class on now on its full colour ringed in the app's, today's done ones faded, a break of 30 minutes or more a dashed line across the week (named from 特殊時段, `bellGap`).
  - **工具:** the week as a grid (課表's solid cells, short names, a free period a dot) with 編輯課表; 專注飛行 (a graphite card, a flight's arc drawn on it); the editor's four parts as one card of four figures; AI 課表編輯 and 拍照匯入 as two cards;
    分享金鑰 and 加到行事曆.
  - **編輯課表** (`view-editor.js`): inside a sheet a card is the sheet's cell colour (`--nv-card` set per sheet, the page's graphite read as no card); each period's box solid in a soft shade of its class's colour (`tint`), a free one grey; times centred on one line; the back a plain ‹ 課表; numbers in light figures; 新增… a line in the app's colour; remove a grey minus. No glass anywhere.
- **專注飛行** (a trial, Jay 2026-10-30): a focus timer that follows a real plane.
  Pick 25/50/90 minutes or type 10–180; the proxy's `/flight` (Orbit-Core
  `flight.js`) offers three planes in the air now that land in about that
  time. The planes in the air are kept on the phone (10 minutes, refreshed
  behind) and picked there, so 25/50/90 switch at once; up to 6 flights, whole
  short flights first, never none. 縮小 (top left) folds it into the kit's
  `.q-accessory` pill above the tabs (the plane, the time left, the flight and
  where to, the trip as a hairline; kept folded on reopening, `focus.mini`);
  a tap opens it again. The screen is the plane on a satellite map (Esri imagery, Leaflet,
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
  another pass its own copy; the sheet is the Pass row and two graphite cards (分享給同學, 收到分享金鑰), each a
  glyph, one line and one full-width action. A failed sync shows as a quiet banner and clears on the next good check.
  時間模擬 has no way in from the app any more (its code, `testsim-runtime.js`, stays for the tests).
- **Offline:** opens on the kept timetable; the AI features say they need
  the network.

## Decisions in force

- **A subject's colour says its group** (Jay 2026-11-05: "I literally can't
  tell how you color them"): ten swatches clearly apart (`SWATCHES` in
  `subjects.js`), one per group: 國語文 red, 英語 blue, 外語 sky, 數學 violet,
  自然 green, 社會 yellow, 藝術 pink, 健體 orange, 科技 teal, the rest and any
  unknown subject grey; its icon is its own (no two alike in a timetable).
  Either can be picked per subject (`subject-picker.js`: from the class sheet's
  pencil, or a class's tile or its 圖示和顏色 row in 編輯課表), each colour
  named by its group there; kept as `subjectIcons` / `subjectColors` with the
  timetable (the v2 string's 13th and 14th entries). `test/subjects.test.js`
  holds the pattern, not the hexes.

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
| `subjects.js`, `subject-picker.js` | A subject's icon and colour (by its group); picking them |
| `swap.js`, `tools.js`, `sync.js` | 調課; the 工具 tab; the Pass |
| `state.js`, `constants.js`, `strings.js` | Shared state; shared constants; text |
| `flight.js`, `flight-plan.js`, `flight-store.js` | 專注飛行: the sheet and the flying screen; its rules (tested); what's kept |
| `calendar.js` | 加到行事曆: the next 4 weeks' classes (`classesOn`: 單/雙週, 調課, days off) as an .ics, handed to the proxy's `/cal` (Orbit-Core `cal.js`) when the timetable changes and weekly, which serves it at a private webcal:// address the phone's Calendar subscribes to; `class.cal.v1` on the phone |
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
