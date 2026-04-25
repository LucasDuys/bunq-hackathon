# 06 — CSRD ESRS E1

## Problem
The CSRD (Corporate Sustainability Reporting Directive) with standards EFRAG ESRS E1 "Climate change" is what large EU companies now report against. Our product targets SMBs, which are voluntary reporters — but the output must LOOK audit-ready, because that's the whole pitch.

## Key facts
- **CSRD scope**: large companies since FY 2024; listed SMEs from FY 2026; other SMEs by choice via the **VSME** (Voluntary SME) standard, published by EFRAG Dec 2024.
- **ESRS E1** requires, in relevant part:
  - **E1-6**: Gross Scope 1, 2 (location + market-based), and 3 GHG emissions, plus intensity metric.
  - **E1-7**: GHG removals and mitigation projects, carbon credits purchased/cancelled including quality attributes (project type, vintage, registry, permanence for removals).
  - Methodology + data quality per category.
- **GHG Protocol Corporate + Scope 3 Standard** is the underlying accounting framework; CSRD requires conformance.
- **VSME standard (for SMBs)** simplifies to: basic B3 module (Scope 1/2 only) vs comprehensive C module. Scope 3 is voluntary in VSME.
- **Key disclosures for credits**:
  - Quantity (tCO₂e) by project type (removal / reduction).
  - Region of project.
  - Registry / standard (Gold Standard, Verra, Puro.earth, CRCF once live).
  - Vintage year.
  - Permanence (for removals).

## What we generate
`/report/[month]` page is structured as a monthly extract of the ESRS E1 disclosures most relevant to our scope:
- **E1-6 approximation**: spend-based Scope 3 Category 1 + 6 estimate, broken down by our category taxonomy, with methodology footnote.
- **E1-7 table**: credit mix with type/region/registry/EUR/tonnes.
- **Narrative summary**: 4 sentences — what the number is, top drivers, reserve allocated, methodology caveat. Sonnet-generated; deterministic mock fallback.
- **Methodology appendix**: classifier + factor sources + confidence methodology + audit ledger pointer.

## Auto-generated PDF (the company doesn't assemble this themselves)

The pitch behavioural shift: **bunq generates the CSRD source artefact; the sustainability team downloads it.**

Every `close.completed` audit row triggers `lib/agent/report-agent.ts::runReportAgent`, which renders a bunq-branded monthly PDF (`lib/reports/render-briefing.tsx`) and writes it to `data/exports/carbo-{orgId}-{YYYY}-{MM}.pdf`. December closes additionally fire the year's annual report once (idempotent via audit-chain scan). The dashboard's **Reports** panel (`app/page.tsx`) lists the latest six PDFs with one-tap downloads served by `app/api/reports/download/route.ts`.

The monthly PDF positioning: **CSRD ESRS E1-7 source artefact**, not a substitute for the company's audited annual disclosure. Cover page reads "CSRD ESRS E1-7 ready"; methodology footer says "source disclosure feeding {orgName}'s annual CSRD ESRS E1 report". Limited-assurance audit sign-off remains the company's responsibility — Carbo automates the assembly, not the certification.

What this saves a 50-person EU mid-cap (anchored to defensible benchmarks; see `research/14-realistic-seed-data.md` and Cushman & Wakefield Amsterdam offices for cost references):
- **6–12 weeks of Q1 staff time** today on Excel-stitching invoices to factors and writing the methodology narrative.
- **€15–40k/yr in external consultant fees** for a small mid-cap.
- Carbo automates the assembly; conservative estimate is **~80% reduction in CSRD assembly hours and €10–30k/yr saved on consultant fees**, while raising audit quality (deterministic factor citation per row vs hand-keyed spreadsheets).

## Gaps we're honest about
- We don't do Scope 1 (direct emissions, e.g. company vehicles) or Scope 2 (electricity from grid). Those need utility bills / vehicle records, not bank txs.
- Scope 3 coverage is limited to categories visible in bank spend — no upstream supplier emissions beyond what their spend factor implies.
- Intensity metric (tCO₂e / EUR revenue) is skipped in MVP; trivial to add.
- No assurance workflow; auditor-review UI would be a v2.

## Decisions for this build
- Monthly CSRD extract, not annual — our novel framing.
- Single-org, single-currency. Scale requires multi-entity consolidation (material for enterprise).
- PDF via browser print — page uses standard HTML with print-friendly CSS (no heavy PDF library).
- Narrative cites GHG Protocol Scope 3 + DEFRA + Exiobase explicitly; methodology transparency is the point.
- Every number on the page is traceable to `audit_events` via `close_runs.id`.
