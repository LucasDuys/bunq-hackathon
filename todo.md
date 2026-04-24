# TODO

Everything the plan called for but we didn't ship — organized by blast radius. Hackathon MVP is functional; this is the list for anyone (or future-you) picking up after the demo.

## Not yet wired to real services
Mock mode works end-to-end. Bunq live path is fully scripted but not yet exercised against the live sandbox.

- [ ] **Bunq sandbox end-to-end** — scripts exist (`bunq:sandbox-user`, `bunq:keygen`, `bunq:bootstrap`, `bunq:create-reserve`, `bunq:sugardaddy`, `bunq:register`, `dev:live`); still need to run them in order against the sandbox to confirm a real `MUTATION` lands in `transactions` and a real intra-user transfer moves balance.
- [ ] **Anthropic live mode** — hit Haiku 4.5 classifier and Sonnet 4.6 question generator / CSRD narrative for real. Verify JSON output compliance; handle Anthropic rate limits. Currently: `ANTHROPIC_MOCK=1` by default; live path exists, untested under load.
- [x] **Cloudflare Tunnel in front of `/api/webhook/bunq`** — `npm run dev:live` boots the tunnel + dev server and prints the public URL. Still need to (a) install cloudflared on the demo laptop, (b) run it, (c) paste URL into `BUNQ_WEBHOOK_URL`, (d) `npm run bunq:register`.
- [x] **`sugardaddy@bunq.com` seeding** — `scripts/bunq-sugardaddy.ts` sends a RequestInquiry; default amount EUR 500 (override with `SUGARDADDY_AMOUNT`).

## Features in the spec but de-scoped for MVP

- [ ] **Optional invoice upload for large/ambiguous spend** — spec allows it as a refinement path alongside questions. Multimodal (PDF + image) Claude parse → auto-apply category. The `refinement_qa` schema can hold it as-is; need an upload endpoint and UI card.
- [ ] **Voice refinement** — "this was a team dinner." Claude voice → text → treat as a free-text refinement. Nice-to-have.
- [ ] **Visual/narrative dashboard summary** — an LLM-written paragraph at the top of `/` contextualizing the month. Share a prompt with `generateCsrdNarrative` but target the overview reader, not auditors.
- [ ] **Onboarding flow** — right now an org is seeded. Real flow: user authenticates, we create the sub-accounts, register webhook, install default policy. Probably 1–2 screens.
- [ ] **Multi-entity consolidation** — a parent org with many bunq users → single CSRD report. Requires multi-tenant rework of queries. Out of hackathon scope.
- [ ] **Policy editor UI** — `/settings/policy`: form-based edit of the JSON policy, validated by the same Zod schema. Right now policies live in DB only; editing means SQL.
- [ ] **Approval workflow via bunq RequestInquiry** — instead of an in-app approve button, fire a RequestInquiry to the CFO's bunq user so approval is bank-native. Spec mentions this as an option.

## Close/accuracy improvements

- [ ] **Lognormal uncertainty model** — current `point × (1 ± u)` is symmetric; real factor distributions are lognormal, so the high end under-states. Swap in when it matters for audit claims.
- [ ] **Pedigree matrix data quality scoring** — GHG Protocol Chapter 7 formalism. Replaces our ad-hoc confidence score. Mostly UI relabelling plus a dimension table.
- [ ] **Year-of-factor drift** — our factors are pegged to 2024 (DEFRA) / 2022 (Exiobase). Inflation-adjust per year. Small multiplier.
- [ ] **Correlated-error handling in rollup** — our quadrature sum assumes factor errors are independent. In practice, factors sharing a parent sector are correlated. Bounded fix: group by top-level category and use a covariance matrix.

## Carbon-credit integrations (currently simulated)

- [ ] **Patch or Supercritical API** for real credit quotes (drop-in on `lib/credits/projects.ts`).
- [ ] **Puro.earth / Gold Standard / Peatland Code registry links** — live project pages behind each seeded project.
- [ ] **Credit retirement flow** — actual "I bought X tonnes" retirement certificate, stored against `credit_purchases`. Currently just a bunq transfer with a description.
- [ ] **CRCF compliance check** — once the EU Carbon Removal Certification Framework registries go live (expected 2025–2026), verify the projects against CRCF methodology. Watch EC announcements.

## CSRD / audit

- [ ] **Scope 1 + 2 channels** — bank data doesn't cover owned vehicles (Scope 1) or grid-electricity purchase details (Scope 2 market-based). Need a CSV upload for utility bills + vehicle log. Meaningful but separate surface.
- [ ] **Intensity metric (tCO₂e / EUR revenue)** — E1-6 requires it. We compute tCO₂e per month and the user knows their own revenue — small addition.
- [ ] **Annual rollup page** — `/report/[year]` that aggregates 12 monthly closes. Straightforward DB query.
- [ ] **PDF print stylesheet** — right now the report is browser-print-styleable but we haven't made the A4 layout precise. Add `@media print` CSS.
- [ ] **External assurance flow** — auditor review UI, with comments on individual factor choices, sign-off on a close.
- [ ] **OpenTimestamps / chain anchoring** — periodic SHA-256 commit of latest audit hash to a public chain for third-party tamper evidence.

## Ops & resilience

- [ ] **Real migrations via drizzle-kit** — currently raw DDL in `scripts/migrate.ts`. Works for hackathon; breaks as soon as schema drifts.
- [ ] **Single-process DB handle after reset** — `pnpm reset` deletes the SQLite file while the dev server holds a stale handle, so the next write goes to the deleted inode. Fix either by restarting dev server automatically or by closing + re-opening the handle on each API call (expensive; bad for hot path). Current workaround documented in CLAUDE.md.
- [ ] **Unit tests** — zero written. Priority targets: `lib/audit/append.ts` (hash chain), `lib/policy/evaluate.ts` (policy eval), `lib/emissions/estimate.ts` (rollup math), `lib/bunq/signing.ts` (sign/verify roundtrip).
- [ ] **E2E tests** — Playwright: "run close → answer questions → approve → verify ledger". Would catch the stale-DB-handle issue automatically.
- [ ] **Observability** — console logs only right now. Anthropic SDK call logging, bunq call logging, close-run timing.
- [ ] **Error pages** — `/close/[id]/page.tsx` calls `notFound()` but we don't have a nice 404 in the layout.

## UI / UX polish

The UI is functional but not brand-built. Reference: [getdesign.md Wise design example](https://getdesign.md/wise/design-md) — the kind of fintech-grade design spec we'd adopt if this ships.

- [ ] **DESIGN.md** — write the full 9-section visual design spec (colour system, typography, spacing, motion, iconography, illustration direction, writing tone, accessibility commitments, component library). Use the `design-system` skill's 9-section Google Stitch format.
- [ ] **Brand-aware palette** — currently stock zinc + emerald. Pick a proper palette (our domain: trust + nature + bank). Light + dark parity.
- [ ] **Typography pairing** — Geist Sans/Mono is the default. Try Inter / IBM Plex Sans for a bank-y feel.
- [ ] **Micro-interactions on the close pipeline** — when a state transitions, animate the step icon. Right now it just re-renders.
- [ ] **Refinement-question UX polish** — option cards with the sub-category's typical emission range, so user sees the consequence of their answer before clicking.
- [ ] **Impact matrix interactivity** — click a row to expand into the month's actual spend spread across the spectrum. Visual hook is half there.
- [ ] **Chart accessibility** — Recharts needs aria-labels + keyboard navigation + non-colour differentiation. See `web-accessibility` skill.
- [ ] **Dark mode audit** — every page should look right in dark. Most do; confidence bars and impact badges need contrast check.
- [ ] **Mobile layout** — no explicit mobile work done. Overview breaks at <600px.
- [ ] **Confidence range visual** — show the low/point/high as a range bar, not just a point number. Users understand bars faster than ±uncertainty strings.

## Demo / go-live

- [ ] **Rehearse the 3-minute demo twice** with `pnpm reset` between. Time each step. See `research/12-demo-choreography.md`.
- [ ] **Deploy to Vercel OR run locally behind Cloudflare Tunnel** during the demo. Confirm webhook URL stability.
- [ ] **Backup story for "mock mode"** — if anything in the live pipeline fails, have `ANTHROPIC_MOCK=1 BUNQ_MOCK=1 DRY_RUN=1` as the safe fallback that still demos everything except real money movement.

## References & follow-ups

- Wise-style design.md (visual spec): https://getdesign.md/wise/design-md
- CSRD ESRS E1 standard text (EFRAG): https://www.efrag.org/Assets/Download?assetUrl=%2Fsites%2Fwebpublishing%2FSiteAssets%2FESRS%2520E1%2520Climate%2520change.pdf
- EU CRCF regulation: https://climate.ec.europa.eu/eu-action/carbon-removals-and-carbon-farming_en
- GHG Protocol Scope 3 Standard: https://ghgprotocol.org/standards/scope-3-standard
- bunq API docs (re-verify before live integration): https://doc.bunq.com
- bunq hackathon toolkit: https://github.com/bunq/hackathon_toolkit
