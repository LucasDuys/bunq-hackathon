# 13 — Tax Savings & Carbon Incentives for SMEs

## Why this matters for Carbo

Carbo already tracks per-transaction emissions. The natural next question from a bunq Business user:
"So what? What do I _do_ with this data?"

Answer: **it saves you money**. Dutch and EU tax schemes directly reward lower emissions and green investments. Carbo's passive tracking becomes the evidence base for claiming these incentives. This turns carbon accounting from a compliance cost into a profit center.

## Dutch Tax Schemes (NL jurisdiction)

### EIA — Energie-investeringsaftrek (Energy Investment Deduction)
- **Rate:** 45.5% extra tax deduction on qualifying energy-saving investments.
- **Minimum:** €2,500 per asset.
- **What qualifies:** LED lighting, heat pumps, solar panels, EVs, energy management systems, efficient servers. Full list: RVO Energielijst (updated annually).
- **Cash impact:** €50k investment → €50k × 45.5% × 25.8% corp tax = **€5,870 tax saved**.
- **Source:** RVO.nl / Energielijst 2024.

### MIA — Milieu-investeringsaftrek (Environmental Investment Deduction)
- **Rate:** 27% (tier III), 36% (tier II), or 45% (tier I) extra deduction.
- **What qualifies:** Clean transport, circular materials, sustainable building, environmental tech. Full list: RVO Milieulijst.
- **Cash impact:** €100k at 36% tier → €100k × 36% × 25.8% = **€9,288 tax saved**.
- **Stackable with Vamil** (below).

### Vamil — Willekeurige afschrijving milieu-investeringen
- **Rate:** Write off up to 75% of qualifying green assets in any year you choose.
- **Benefit:** Not a larger deduction, but _timing_ — massive cash-flow advantage. Pull forward deductions to high-profit years.
- **NPV advantage:** Roughly 15% of the accelerated amount at current discount rates.
- **Same qualifying list as MIA.** Can be combined.

### Dutch Carbon Tax (CO₂-heffing industrie)
- **Who:** ~300 large industrial facilities (on top of EU ETS). Not directly applicable to most SMEs.
- **Rate:** ~€50/tonne, rising toward €125–150/tonne by 2030.
- **Relevance to Carbo users:** SMEs feel this indirectly through supplier pricing. Lower-emission supply chain = lower cost pass-through.

## EU-Wide Mechanisms

### EU ETS — Emissions Trading System
- **Carbon price:** ~€65–75/tonne CO₂ (mid-2025, down from €100 peak).
- **Who's covered:** Large installations (>25k tonnes/year), aviation. Most SMEs are _not_ directly covered.
- **SME exposure:** Indirect — energy suppliers, raw materials, logistics providers all pass through their ETS costs. Every tonne your supply chain avoids saves ~€70.
- **ETS2 (2027):** Extends to buildings and road transport fuel. This _will_ hit SMEs directly.

### CBAM — Carbon Border Adjustment Mechanism
- **What:** Importers of steel, aluminium, cement, fertilizer, electricity, hydrogen must buy CBAM certificates matching embedded emissions.
- **SME impact:** 5–15% cost increase on affected imports from Jan 2026.
- **Relevance:** Carbo users importing these materials need to factor CBAM into procurement decisions.

### Green Financing
- **Rate reduction:** 20–50 basis points (0.2–0.5%) for demonstrably sustainable businesses.
- **Who offers it:** bunq, Triodos, ASN, Rabobank (Groenfinanciering — up to 1% via RVO Groenverklaring).
- **Cash impact:** €500k loan at 30 bps reduction = **€1,500/year** interest saved.
- **Carbo connection:** Our emission tracking and CSRD reports are the _evidence_ banks need to qualify businesses.

## Category-Specific Switch Savings

| Current | Alternative | Emission reduction | Price impact |
|---------|-------------|-------------------|-------------|
| Short-haul flights | Train (Thalys/ICE) | ~16x lower CO₂/EUR | 30% cheaper |
| Meat-heavy catering | Plant-forward meals | ~3x lower CO₂/EUR | 15–30% cheaper |
| Gas heating | Heat pump (green elec.) | ~2.3x lower CO₂/EUR | ~10% cheaper + EIA/MIA |
| Petrol fleet | EV fleet | ~2.1x lower factor + green grid | 40% cheaper running + lower bijtelling |
| High-carbon cloud region | EU green-powered region | ~3x lower CO₂/EUR | Same cost |
| Paper processes | Digital-first | ~4x lower CO₂/EUR | 50% cheaper |

## The Demo Number

For a Dutch SME spending €200k/month:
- **Carbon cost avoidance (ETS pass-through):** €3k–8k/year
- **EIA on green capex (if €80k invested):** ~€9,400/year
- **MIA + Vamil (if applicable):** ~€7,400/year
- **Green financing advantage:** €600–2,500/year
- **CSRD compliance cost reduction:** €8k–12k/year (already tracking via Carbo)
- **Total:** **~€28k–40k/year**

Extrapolated to bunq's business customer base:
> "If 10,000 bunq Business users each unlock €30k/year in tax savings through carbon-conscious purchasing, that's **€300M in collective savings** enabled by Carbo."

## Implementation in Carbo

- `lib/tax/incentives.ts` — Scheme definitions with rates, thresholds, sources.
- `lib/tax/alternatives.ts` — Factor-to-factor green switch mappings with price ratios.
- `lib/tax/savings.ts` — Transaction-level and monthly rollup calculations.
- `app/tax-savings/page.tsx` — Full detail page with scheme breakdown and switch recommendations.
- Dashboard card — Highlighted annual projection linking to detail page.

All computed from existing transaction data — no new data collection, no new API calls. Pure value-add on top of existing emission estimates.
