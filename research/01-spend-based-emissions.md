# 01 — Spend-based emissions

## Problem
We need to estimate CO₂e for every bunq transaction using only (category, sub-category, EUR amount) — no activity data, no receipts. This is the default method for Scope 3 Categories 1 (purchased goods) and 6 (business travel) under the GHG Protocol.

## Key facts
- **GHG Protocol spend-based method**: CO₂e ≈ spend × emission factor (kg CO₂e per EUR). It's the lowest data-quality tier (Tier 3 in most conventions) but the only tractable option when you only have transactional data.
- **EEIOA databases** map economic sectors to emission factors: Exiobase v3 (EU-focused, 200 sectors, regionalized), EORA, USEEIO. Factors are typically kg CO₂e / EUR of sectoral output.
- **Activity-based factors** (per kWh, per passenger-km, per kg of beef) are higher quality but need quantity data we don't have from bank transactions.
- **Public ready-to-use factors**:
  - UK DEFRA 2024 GHG conversion factors (https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024) — includes spend-based travel/food factors.
  - ADEME Base Carbone (https://base-empreinte.ademe.fr/) — French factors for categories including catering, hotels, services.
  - EEA electricity grid factors per member state (https://www.eea.europa.eu/ims/greenhouse-gas-emission-intensity-of-1) — critical for cloud-region differentiation.
- **Climatiq API** (climatiq.io) wraps many of these with consistent sector keys — useful reference even if we don't depend on it.
- **Uncertainty**: DEFRA and Exiobase both publish ±% per factor. For spend-based Scope 3, typical uncertainty is 25–60% depending on sector aggregation; services and cloud are the widest (sector heterogeneity).
- **Inflation / year-alignment**: spend factors are pegged to a base year. Factors older than ~3 years should be inflation-adjusted; for a hackathon we accept the ~5% systematic error and note it.

## Design choices
- Keep a **hard-coded factor table** in `lib/factors/index.ts` rather than calling an API — removes latency, auth, cost, rate limits in the demo. Factors derived from DEFRA 2024 + ADEME + Exiobase.
- One row per (category, sub-category) with `factorKgPerEur`, `uncertaintyPct`, `tier`, `source`. Each row is auditable (source cited).
- `factorFor(category, subCategory)` falls back sub-category → category → `other.generic` to always return something.
- **Region = EU** fixed for the MVP; multi-region requires a region dimension we skip.
- **Tier weight** in confidence calc: tier-2 factors (sector-specific) count ~0.9, tier-3 generic ~0.75.

## Decisions for this build
- Spend × factor only. No activity data.
- Uncertainty range = factor uncertainty %; reported as low / point / high per tx.
- EU grid mix for electricity (~1.2 kg/EUR at 2026 NL retail rates).
- Cloud has two sub-factors: `compute_eu` (0.08 kg/EUR) and `compute_high` (0.25 kg/EUR) for coal-grid regions; agent asks which when it matters.
- Revisit factor table against actual DEFRA 2024 PDF before scale-up; hackathon values are coarsened.
