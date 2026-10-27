# STATUS

## What was built

A static, local-first web app for Final Fantasy XIV players to plan daily roulettes, leve allowances, and weekly goals.

**Files**
- `index.html` — semantic, accessible shell (skip link, landmarks, `aria-live` countdowns)
- `styles.css` — warm, polished, high-contrast CSS with `:focus-visible`, large touch targets, `prefers-reduced-motion` support
- `reset.js` — pure, deterministic game-reset time logic (daily + weekly resets, configurable timezone offset). Zero DOM/localStorage dependency; fully testable
- `storage.js` — tiny localStorage wrapper with graceful degradation (works without localStorage)
- `app.js` — state management, rendering, automatic reset detection, UI interactions
- `test-reset.js` — Node test suite for reset-time logic (uses built-in `node:assert`, no external deps)
- `package.json` — `npm test` script; `type: module`
- `README.md` — plain-English guide crediting Asdale Dynamics, LLC
- `LICENSE` — MIT, copyright `Copyright (c) 2026 Asdale Dynamics, LLC`
- `STATUS.md` — this file

**Features**
- Daily Roulettes checklist (resets each game day)
- Leve Allowance counter with daily total (default 12; resets each game day)
- Weekly Goals checklist (resets each game week)
- Add/remove custom daily and weekly items
- Configurable reset times: daily HH:MM, weekly day + HH:MM, timezone offset (FFXIV uses fixed UTC+9, no DST)
- Data persists in `localStorage`; nothing leaves your device, no account, no tracking
- Accessible UI: semantic HTML, keyboard operable, screen-reader labels, high-contrast focus indicators

**No game assets, no secrets, no API keys, no personal data.**

## How to run it

Open `index.html` directly in a browser, or serve the folder with any static server, e.g.:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Run the test suite:

```bash
npm test
```

## Verification results

- `npm test`: **21/21 tests pass** (reset-time logic: daily/weekly next-reset, countdowns, validation, date keys, day-of-week)
- `app.js`: loads as an ES module without errors; all exports resolve
- `index.html` / `styles.css` / `reset.js` / `storage.js`: syntax reviewed; module imports resolve
- Browser visual/accessibility smoke test: not automated in this environment — open `index.html` and confirm the page renders, countdowns tick, checklist toggles persist on reload, and settings save

## Known gaps

- No automated browser/DOM test suite (tests cover pure reset logic only); visual rendering verified by code review, not a headless browser
- No service worker / offline install (PWA) — the app is static and works offline once loaded, but isn't installable
- Leve allowance total is a single shared daily cap; per-class leve tracking is not modeled
- Timezone uses a fixed offset (matches FFXIV's fixed server time); IANA zones with daylight saving are not supported
- Data is scoped to one browser/device (`localStorage`); no sync or export/import yet
