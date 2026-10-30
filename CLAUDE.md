# Working on Orbit Class

Read `../Orbit-Core/docs/TRUTH.md` first (one page: how the owner works and what matters).
MAP.md is this repo's map (README.md is the short public front page).

- Vite app: `npm test` (vitest) and `npm run lint`, then `git push origin HEAD:main`.
- See it on a phone: `node ../Orbit-Core/tools/preview.mjs orbit --live --width 375`.
- Screenshots for a change: `node ../Orbit-Core/tools/shots.mjs class --before main` (320/390, light/dark, live data, a diff against what's live; `../Orbit-Core/tools/README.md`).
