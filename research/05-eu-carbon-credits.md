# 05 -- EU-verified Carbon Credits and Mock Project Selection

_Status: stub. Pick three mock projects by end of hour 2._

## Regulatory backdrop

- **EU CRCF (Regulation 2024/3012)**: sets EU-wide certification framework for carbon removal and soil emission reduction. Entered into force end 2024; methodologies being adopted through 2025-2026.
- **EU ETS**: not relevant here (that is the compliance market for large emitters, not voluntary).
- **VCMI + ICVCM**: voluntary integrity frameworks the pitch should reference.

## Three mock projects to fabricate for the demo

Pick three deliberately different project types. Each gets a fake id, a plausible price per tonne, and a fake retirement certificate URL.

| Project | Type | Region | Price (EUR / tonne) | Vintage | Standard |
|---|---|---|---|---|---|
| Biochar -- Frisian Agricultural Co-op | Removal | NL | 180 | 2026 | CRCF-aligned (mock) |
| Reforestation -- Scottish Highlands | Removal | UK/EU | 95 | 2025 | CRCF-aligned (mock) |
| Peatland restoration -- Drenthe | Removal | NL | 140 | 2026 | CRCF-aligned (mock) |

Prices are plausible for 2026 EU removals (biochar currently EUR 150-250/t, afforestation EUR 60-120/t, peatland EUR 100-180/t per 2024 market data).

## Why removal-only

- Stronger defense under VCMI + ICVCM.
- Maps to Oxford Principles 2024 revision ("move the money to removals").
- Differentiates the pitch from generic "offset any flight" consumer products.

## Fake retirement certificate shape

Generate a PDF at month-end simulated purchase with:

- Project name + id
- Tonnes retired
- Purchase date
- Purchaser (the bunq account holder's company name)
- A QR code pointing to a local route that renders the ledger row

## Sources to validate prices + methodology

- Carbon Market Watch pricing surveys (quarterly)
- Allied Offsets (commercial market data)
- Puro.earth biochar registry (real public reference)
- AlliedOffsets blog posts on biochar pricing 2024-2026

## Output shape

See `RESEARCH-INDEX.md` -> Research agent output format.
