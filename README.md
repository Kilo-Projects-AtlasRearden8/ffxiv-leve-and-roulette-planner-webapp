# FFXIV Daily & Weekly Planner

A friendly, local-first static web app that helps Final Fantasy XIV players plan their daily roulettes, leve allowances, and weekly goals. Checklists reset automatically on the game's reset times — which you can configure to match your server and schedule.

Built and published by **Asdale Dynamics, LLC** (Indiana), the indie label of Dylan Asdale — registered nurse, AI author of *The Massive AI Manual*, and founder of dylanasdale.github.io. Asdale Dynamics makes beginner-friendly, plain-English tools and guides. This is a fan project: no game assets, no subscriptions, no tracking.

## What it does

- **Daily Roulettes** — a checklist of your daily duties. Tick them off as you complete them; they reset each game day.
- **Leve Allowance** — track how many leves you've used today out of your daily total (default 12). Resets each game day.
- **Weekly Goals** — a checklist for weekly targets. Resets each game week.
- **Custom items** — add your own daily or weekly checklist items.
- **Configurable reset times** — set the daily reset time, the weekly reset day and time, and your timezone offset. FFXIV runs on a fixed server time (Japan Standard Time, UTC+9, no daylight saving), so a fixed offset matches the game exactly.
- **localStorage** — your data stays on your device. Nothing is sent to a server, and no account is required.
- **Accessible UI** — semantic HTML, keyboard operable, high-contrast focus indicators, `prefers-reduced-motion` respected, and screen-reader friendly labels.

## How to run it

This is a plain static site — no build step, no install, no server required.

1. Open the folder.
2. Open `index.html` in your browser.

Or serve it locally with any static server. For example, with Python:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Run the tests

The reset-time logic is covered by a dependency-free Node test suite:

```bash
npm test
```

## Who this is for

This tool is part of Asdale Dynamics, LLC's catalog of practical, beginner-friendly open-source apps. Dylan Asdale writes AI education "like a friend would" — plain English, step by step, never condescending — at dylanasdale.github.io, and publishes books and guides through Asdale Dynamics, LLC (Indiana, formed October 2026).

The LLC focuses on:

- Beginner manuals for AI tools, agents/MCP, local AI, free AI coding, GitHub, automation, and privacy
- Open-source apps and templates: prompt tools, local-LLM utilities, MCP servers, agent skills
- Small-business and author tools: KDP/book publishing, marketing, reselling (eBay/Amazon), bookkeeping
- Accessible life-admin helpers: paperwork organizers, budgeting, low-energy productivity (ADHD-friendly)
- Healthcare-worker AI aids (education only, never medical advice)
- Fun extras: gaming (FFXIV) and chess tools

## Credits

Built by **Asdale Dynamics, LLC** — Dylan Asdale, Indiana. Hub: https://dylanasdale.github.io

This is an unofficial fan project not affiliated with Square Enix or Final Fantasy XIV. No game assets are used.

## License

MIT License. Copyright (c) 2026 Asdale Dynamics, LLC. See `LICENSE`.
