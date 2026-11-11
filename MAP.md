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
    over: 今天的課, every class faded), 待辦, 學校公告 (when a school is
    picked) and the countdowns. After the last
    class it shows the next school day. A class's sheet (`view-sheet.js`):
    its pencil opens the icon and colour picker as a sheet over it, so closing the
    picker leaves the class open.
  - **課表:** the week as a grid (cells solid in a soft shade of their subject's colour, back-to-back periods of one
    class one block, today's column on a plate, names on one line shrunk to fit, a free period a quiet dot, now ringed), this one or the next (單週 / 雙週; both side by side on a wide screen), a day's head opening 今天 on that day; and 調課.
    Each class a cell washed in its subject's colour with a bar of it on its left, the class on now on its full colour ringed in the app's, today's done ones faded, a break of 30 minutes or more a dashed line across the week (named from 特殊時段, `bellGap`).
  - **工具:** the week as a grid (課表's solid cells, short names, a free period a dot) with 編輯課表; 專注飛行 (a graphite card, a flight's arc drawn on it); the editor's four parts as one card of four figures; AI 課表編輯 and 拍照匯入 as two cards;
    分享金鑰 and 加到行事曆. 學習 (after 專注飛行): 拍聯絡簿, 考前讀書計畫, 學校公告.
  - **待辦, 拍聯絡簿, 讀書計畫, 學校公告** (Jay 11-10, the AI plan; code first):
    - **待辦** (`todos.js`): on 今天, what's due (6 at most, then 還有 N 項; the
      sheet by day): a round check in the subject's colour, the words, subject ·
      kind under them, when on the right (過期 red, 今天 the accent). 新增 opens
      a menu: 拍聯絡簿, 考前讀書計畫, 自己加一項. A test or exam 2–45 days away
      with no plan: one row that plans for it. Kept with the timetable
      (`applicationData.todos`, `todos-data.js`; the v2 string's 15th entry),
      so the Pass carries it; done ones kept 3 days, open ones 30.
    - **拍聯絡簿**: a photo → the AI door's `class-book` (Gemini Flash; the
      person's own subjects sent so names match) → every item looked over
      before it's kept (on/off, kind, subject picker, words, day); no day or
      下次上課 lands on that subject's next class by code (`nextClassOf`).
    - **考前讀書計畫** (`study.js`, `plan.js`): the exam (a countdown or a
      test), its subjects as chips (an exam's usual ones lit, `examSubject`),
      each one's scope and ★ weak, minutes a school day. Code plans the time
      (`planSessions`: ~45-minute sessions, a day without classes twice, each
      subject's 總複習 the day before its exam, weak ×1.6); the AI door's
      `class-plan` (Haiku) writes what to do in each from the scope (numbers
      only the scope's); without it, plain steps. Kept as `study` to-dos
      (replacing the same plan's undone ones).
    - **學校公告** (`school-news.js`): the school picked once (`public/schools.json`,
      the Ministry's 498 senior high schools; or a site pasted) and a grade
      (`applicationData.school`, the 16th entry). The proxy's `/class-news`
      (Orbit-Core `class-news.js`) reads the school's own list and words new
      titles once for everyone at that school (`class-news`, Haiku): who it's
      for, one line, what to do, by when. Shown: only `forMe` (everyone, their
      grade, 國中部 for a 國中 grade; before the AI's words, `guessWho` from
      the title); 進修部's (`isNight`) and 轉知, what the school passes on
      (`isRelay`), never for you, each their own tab. Drawn, never plain text: a row each with its kind's tile (`kindOf`:
      考試, 升學, 活動, 獎助, 校務, by code), the thing first (`words`,
      `cleanTitle`), day · unit · what to do, a deadline as a tag; the sheet's
      text tabs 跟你有關 · 全部 · each kind (the school's own) · 轉知 · 進修部. 今天 the last week's 3. Fast: the
      proxy answers with the titles at once and words them behind
      (`wording`; the phone asks again at 6–30 s); kept on the phone
      (`class.news.v1`), read again past 30 minutes. A school whose site can't be read: an empty state that asks
      for its news page's address.
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
- **問我的課表** (the family's AI, Jay 2026-11-10; `src/class-ask.js`): the editor's AI box (工具's AI 課表編輯) also takes a question. A question about a named day's classes, first or last period is answered by code; the rest goes to the AI door (`class-ask`) with the next two weeks as held (`familyDays`, a line a day), every time it says checked to be the timetable's; answered in the box's info sheet as one line and the days that answer it drawn (`answerNode`: each day's periods as rows, the ones that answer it lit; `.ca-*` in `css/styles.css`; Jay 11-10: never a paragraph), never applied.
- **The family's notebook** (the kit's `family.mjs`, Jay 2026-11-10): each time the timetable is built, Class tells the other apps on this phone its next two weeks of classes as held (`src/family-tell.js`: 單/雙週's subject, holidays, typhoon days off and 調課 applied; 體育 and the like marked outdoors). Weather's place 跟著課表 and its 體育課 advice read it; nothing leaves the phone. It reads back Orbit Words' `vocab.due`: at a break between classes, 今天's card ends in 下課背五個 (英文課前 before English), a tap opening Words' five-word round (`#five`, through the session's `go`; `src/view-today.js` `wordsChip`). 出門時間: before the first class, 怎麼去學校 opens Orbit Transit's planner (`#plan`, the kit's `planHash`) to the family's school place, there ten minutes early; once the day's classes are over, 回家怎麼搭 to home (`tripOf`, `tripChip`); places from Weather's pins or Transit's.
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
  top (the class on the left, the day's line on the right), the day strip across under it, then the day's classes, 待辦, 學校公告 and the countdowns dealt into two columns of even height (the kit's `.q-flow.q-flow-refit`, dealt again as each fills in; Jay's iPad 2026-11-11), 課表 shows both weeks side
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
| `class-book`, `class-plan`, `class-news` | Orbit-Core's `ai-features.js` (prompts, checks), `ai-fixtures.js` (tried with `build.yml` ai-try), `class-news.js` (the school readers) |
