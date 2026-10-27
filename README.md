<p align="center">
  <img src="public/icons/icon-192.png" width="96" height="96" alt="">
</p>

<h1 align="center">Orbit Class</h1>

<p align="center">
  <b>Today's classes at a glance.</b><br>
  <a href="https://jaypengx.com/class/"><b>jaypengx.com/class</b></a>
</p>

<p align="center">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES_modules-F7DF1E?logo=javascript&logoColor=000"> <img alt="Vite" src="https://img.shields.io/badge/Vite-build-646CFF?logo=vite&logoColor=fff"> <img alt="PWA" src="https://img.shields.io/badge/PWA-works_offline-5A0FC8?logo=pwa&logoColor=fff"> <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=fff"> <img alt="GitHub" src="https://img.shields.io/badge/GitHub-Pages-24292F?logo=github&logoColor=fff"> <img alt="Tests" src="https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=fff">
</p>

The class now and what comes next, at a glance. Part of **Orbit**, a family of phone apps for life in Taiwan that share one sign-in, the Orbit Pass. See them all at [jaypengx.com](https://jaypengx.com/).

## What it does

- **Today:** the class now, the teacher and room, time left, and the rest of the day.
- **The week** as a grid, with odd and even weeks and one-off class swaps.
- **Countdowns** to exams and events.
- **A notice** five minutes before each class, with no classes on holidays.
- **AI import:** photograph a timetable or describe a change in a sentence, then confirm.

## Stack

- Plain JavaScript (ES modules), HTML and CSS, bundled by Vite: no framework.
- An installable phone web app (Add to Home Screen), cached by a service worker.
- The look, sign-in (the Orbit Pass) and notices come from the shared kit in [Shared-Proxy](https://github.com/JayPengX/Shared-Proxy).
- Tested with Vitest.
- AI features go through the Orbit proxy (`api.jaypengx.com`) to Gemini.
- Hosted on GitHub Pages and served at jaypengx.com by a Cloudflare Worker; every push to `main` tests and deploys.

## For developers

```bash
npm install
npm test
```

How it works, file by file, and the decisions still in force: **[MAP.md](MAP.md)**.
