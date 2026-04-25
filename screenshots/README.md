# Carbo — UI Screenshots

Captured against the local dev server at `http://localhost:3000` against the
seeded SQLite fixture (org `org_acme_bv`, close `2026-04`).

Captured at 2x device-scale, dark theme.

## Layout

```
screenshots/
├── desktop/             # 1440 × 900 — every page in the app
├── mobile/              # 390 × 844 — same set, mobile viewport
├── demo-deck-stages/    # /demo-deck — all 17 morphing canvas stages
└── launch-scenes/       # /launch — auto-advancing pitch deck, sampled
```

## Page index (desktop / mobile)

| # | File | Route |
|---|---|---|
| 01 | `01_dashboard.png` | `/` — Monthly overview dashboard |
| 02 | `02_briefing.png` | `/briefing` — Carbon briefing (current month) |
| 03 | `03_briefing_week.png` | `/briefing?kind=week` — Weekly briefing |
| 04 | `04_assistant.png` | `/assistant` — Ask Carbo |
| 05 | `05_impacts.png` | `/impacts` — Impacts / what-if |
| 06 | `06_invoices_list.png` | `/invoices` — Invoice inbox |
| 07 | `07_invoice_detail.png` | `/invoices/:id` — Invoice detail |
| 08 | `08_ledger.png` | `/ledger` — Append-only audit ledger |
| 09 | `09_reserve.png` | `/reserve` — Carbon Reserve sub-account |
| 10 | `10_close_detail.png` | `/close/:id` — Monthly close run detail |
| 11 | `11_report_month.png` | `/report/:month` — CSRD monthly report |
| 12 | `12_report_annual.png` | `/report/annual/:year` — CSRD annual report |
| 13 | `13_report_green.png` | `/report/green/:orgId` — Green dashboard (mobile-first) |
| 14 | `14_proof.png` | `/proof/:orgId` — Proof of Green certificate |
| 15 | `15_verify.png` | `/verify/:id` — Public verification view |
| 16 | `16_onboarding_landing.png` | `/onboarding` — Onboarding landing |
| 17 | `17_onboarding_detail.png` | `/onboarding/:runId` — Onboarding interview |
| 18 | `18_agents_list.png` | `/agents` — Agent runs list |
| 19 | `19_agents_detail.png` | `/agents/:runId` — Agent run detail |
| 20 | `20_demo_deck.png` | `/demo-deck` — Morphing canvas pitch (stage 1) |
| 21 | `21_presentation.png` | `/presentation` — Legacy slide presentation |
| 22 | `22_launch.png` | `/launch` — Auto-advancing launch trailer |

## Demo deck — all 17 stages

Every morph stage of the `/demo-deck` route, advanced with `ArrowRight`.
Files `stage_01.png` … `stage_17.png` in `demo-deck-stages/`.

## Launch trailer — sampled scenes

`/launch` auto-advances at fixed durations (~2:05 total). Sampled every ~5.5s
to cover all 23 scenes. Files `scene_01.png` … `scene_23.png` in
`launch-scenes/`.

## How these were generated

Headless Chromium via Playwright, no project-code changes. Generation scripts
live outside the repo at `/tmp/playwright-shots/` (`shoot.js`, `shoot-decks.js`).
