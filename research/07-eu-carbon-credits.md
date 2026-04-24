# 07 — EU carbon credits

## Problem
The spec says "recommend EU credits" with 3 simulated project types (biochar, reforestation, peatland). We need to pick plausible real-world analogs so that the recommendations stand up to inspection and the product has a credible positioning against greenwashing concerns.

## Key facts
- **Three markets, not one**:
  - **EU ETS (compliance)** — cap-and-trade for heavy industry (power, airlines, steel…). ~€70–95 per tonne (2024 avg). Not accessible to SMBs and not what we're funding.
  - **Voluntary carbon market (VCM)** — Gold Standard, Verra (VCS), Puro.earth, Peatland Code. Prices €5–€500/t depending on project type.
  - **EU CRCF** — Carbon Removal Certification Framework; regulation entered into force 2024-12-27; implementing acts being drafted. Long-term: the standard for EU removals. Not yet operational; we position for it.
- **Project type hierarchy** (SBTi/science-aligned):
  - **Permanent removals**: biochar (Puro.earth methodology, ~100-year permanence, €100–€200/t), DACCS (€400–€1000/t), enhanced weathering.
  - **Nature-based removals**: reforestation, peatland rewetting, blue carbon. Cheaper (€20–€80/t) but reversibility risk.
  - **Avoidance / reduction**: REDD+, renewables. Cheapest (€3–€20/t) but increasing scrutiny; not aligned with net-zero claims beyond a transitional period.
- **EU-based projects** gain: (a) CSRD/CRCF alignment, (b) nearer-term project monitoring, (c) co-benefits (biodiversity, rural economy). Premium of 20–40% vs global-south projects.
- **Registries we reference**:
  - **Puro.earth** — Helsinki-based, removal-only (biochar, DACCS, wood building). Owned by Nasdaq.
  - **Gold Standard** — Geneva-based, broad methodology library, strong co-benefit focus.
  - **Peatland Code (UK/IE)** — domain-specific; active in UK/Ireland rewetting projects.
  - **CRCF (forthcoming)** — EU statutory registry; watch for 2025–2026 operationalization.

## What we simulate
Three fake-but-plausible projects in `lib/credits/projects.ts`:
| ID | Type | Price/t | Source family |
|---|---|---|---|
| `biochar-nl-gelderland` | removal_technical | €145 | Puro.earth biochar methodology |
| `reforestation-ee-baltic` | removal_nature | €38 | Gold Standard nature-based |
| `peatland-ie-midlands` | removal_nature | €62 | Peatland Code (IE) |

Default mix: 50% biochar (high-permanence), 30% peatland, 20% reforestation — averages ≈ €113/t blended.

## Decisions for this build
- EU-only projects in seed data; policy filter enforces region = EU.
- Default mix weighted toward removals (80%) per SBTi directional guidance.
- No integration with real carbon-market APIs in MVP (Patch, Klima DAO, Supercritical) — scope cut. Easy drop-in later; the `CreditProjectSeed` shape matches what those APIs return.
- CSRD report lists project type / region / registry per E1-7 requirements.
- Simulated "purchase" in the demo = a bunq intra-user transfer to a dedicated "credits" sub-account with a structured description.
