# Carbon report schema

Canonical shape of an annual corporate carbon report. Used two ways:

1. **Extraction target** — when reading a published sustainability report (PDF), the extractor returns one `CarbonReport` object. See `extract.ts`.
2. **Emission target** — when Carbo produces its own year-end report, the output conforms to this shape, so downstream consumers (PDF renderer, CSRD export, comparison tools) can handle internal and external data uniformly.

Schema lives in `lib/reports/schema.ts` (zod v4 + exported TypeScript types).

## Source corpus

Derived by reading the climate / E1-equivalent sections of three real filings:

| Company | Country | Year | Framework | Size | Longest climate run |
|---|---|---|---|---:|---|
| Koninklijke Philips | NL | 2024 | CSRD / ESRS E1 | 302 pages | pp. 183–196 |
| ENGIE | FR | 2023 | TCFD + SBTi (pre-CSRD) | 114 pages | pp. 75–84 |
| Shell plc | GB | 2023 | Voluntary (GHG Protocol + proprietary NCI metric) | 98 pages | pp. 24–35 |

Extracted text for each lives at `~/datasets/carbon-reports/_notes/{slug}-climate.md` (outside the repo). Full PDFs and the additional ING corpus (24 reports: Amazon / BP / Coca Cola / ENGIE / Intel / Nestle / SSE / Shell × 2021–2023) live at `~/datasets/carbon-reports/`.

## Design decisions

- **Nearly every field is nullable.** Real reports diverge heavily — a CSRD-native filing (Philips) populates most of the schema; a voluntary filing (Shell) leaves large sections empty. A required field is one the schema literally cannot be meaningful without (`company`, `reportingYear`, `framework`, `emissions.unit`, `emissions.reportingPeriod`).
- **Units are fixed.** Emissions are always `tCO2e` (extractor converts from kt / Mt). Money is always EUR (extractor converts from USD / GBP with a note). UI layer handles display conversion.
- **Scope 3 is an array, not a map.** Real reports either include or exclude each GHG Protocol category with a stated reason (immaterial / not applicable). The array captures both the presence of a number and the absence-with-reason.
- **`byGas` and `byStandard` use `z.record(string, number)`.** Keys are documented in the zod enums (`ghgTypeSchema`, `creditStandardSchema`) and extractor prompt, but we don't require all keys present — real reports disclose a subset.
- **`targets` is open-ended.** Target-naming varies wildly (`"1.5°C Scope 1+2 2030"`, `"Halve Scope 1 and 2 by 2030"`, `"Net Zero 2045"`). We normalize on `targetType` (`absolute | intensity | net_zero | carbon_neutral | other`) + `sbtiClassification` (`1.5C | well_below_2C | 2C | net_zero | flag | none`).
- **Framework is a single strongest-cited value.** `MIXED` reserved for reports that explicitly weight two frameworks equally (ENGIE cites both TCFD + SBTi with similar prominence).
- **Extraction metadata is separate.** `_extraction` holds model + timestamp + low-confidence-field list. Not canonical; strip before downstream consumers.

## Fill rates (3 fixtures)

Run `npx tsx scripts/reports-coverage.ts` to regenerate. Fields ordered by fill rate descending.

| Field | Filled | Total | Fill % |
|---|---:|---:|---:|
| `actionSummary` | 3 | 3 | 100% |
| `assurance.level` | 3 | 3 | 100% |
| `assurance.scopeNote` | 3 | 3 | 100% |
| `company` | 3 | 3 | 100% |
| `country` | 3 | 3 | 100% |
| `credits.byStandard.American_Carbon_Registry` | 1 | 1 | 100% |
| `credits.byStandard.Australian_ACCU` | 1 | 1 | 100% |
| `credits.byStandard.Gold_Standard` | 2 | 2 | 100% |
| `credits.byStandard.Verra_VCS` | 2 | 2 | 100% |
| `credits.projects[].country` | 11 | 11 | 100% |
| `credits.projects[].description` | 11 | 11 | 100% |
| `credits.projects[].name` | 11 | 11 | 100% |
| `credits.projects[].standard` | 11 | 11 | 100% |
| `credits.projects[].type` | 11 | 11 | 100% |
| `emissions.baseYear` | 3 | 3 | 100% |
| `emissions.intensity[].metric` | 5 | 5 | 100% |
| `emissions.intensity[].scopeCoverage` | 5 | 5 | 100% |
| `emissions.intensity[].value` | 5 | 5 | 100% |
| `emissions.operationalControlBoundary` | 3 | 3 | 100% |
| `emissions.reportingPeriod` | 3 | 3 | 100% |
| `emissions.scope1.totalTco2e` | 3 | 3 | 100% |
| `emissions.scope1.methodNote` | 3 | 3 | 100% |
| `emissions.scope1.includesBiogenic` | 3 | 3 | 100% |
| `emissions.scope2.marketBasedTco2e` | 3 | 3 | 100% |
| `emissions.scope2.methodNote` | 3 | 3 | 100% |
| `emissions.scope3[].category` | 21 | 21 | 100% |
| `emissions.totalScope1And2Tco2e` | 3 | 3 | 100% |
| `emissions.totalTco2e` | 3 | 3 | 100% |
| `framework` | 3 | 3 | 100% |
| `frameworkNotes` | 3 | 3 | 100% |
| `governance.boardOversight` | 3 | 3 | 100% |
| `governance.execRemunerationTiedToClimate` | 3 | 3 | 100% |
| `governance.transitionPlanPublished` | 3 | 3 | 100% |
| `governance.transitionPlanReference` | 3 | 3 | 100% |
| `industry` | 3 | 3 | 100% |
| `methodology.ghgProtocolVersion` | 3 | 3 | 100% |
| `methodology.gwpAssessmentReport` | 3 | 3 | 100% |
| `methodology.scope2MethodsUsed` | 3 | 3 | 100% |
| `reportingYear` | 3 | 3 | 100% |
| `risks[].description` | 14 | 14 | 100% |
| `risks[].kind` | 14 | 14 | 100% |
| `risks[].timeHorizon` | 14 | 14 | 100% |
| `sourceFile` | 3 | 3 | 100% |
| `targets[].name` | 18 | 18 | 100% |
| `targets[].scopeCoverage` | 18 | 18 | 100% |
| `targets[].targetType` | 18 | 18 | 100% |
| `targets[].targetYear` | 18 | 18 | 100% |
| `transitionPlanSummary` | 3 | 3 | 100% |
| `targets[].reductionPct` | 16 | 18 | 89% |
| `targets[].sbtiValidated` | 16 | 18 | 89% |
| `targets[].baseYear` | 15 | 18 | 83% |
| `credits.projects` | 2 | 3 | 67% |
| `credits.totalTonnesRetired` | 2 | 3 | 67% |
| `credits.usedForNetClaim` | 2 | 3 | 67% |
| `emissions.biogenicEmissionsTco2e` | 2 | 3 | 67% |
| `emissions.equityShareBoundary` | 2 | 3 | 67% |
| `governance.climateCommittees` | 2 | 3 | 67% |
| `methodology.factorSources` | 2 | 3 | 67% |
| `targets[].sbtiClassification` | 10 | 18 | 56% |
| `internalCarbonPrice.volumeAtStakeTco2e` | 1 | 2 | 50% |
| `targets[].baseEmissionsTco2e` | 9 | 18 | 50% |
| `emissions.scope3[].method` | 10 | 21 | 48% |
| `emissions.scope3[].tco2e` | 10 | 21 | 48% |
| `assurance.assurer` | 1 | 3 | 33% |
| `credits.correspondingAdjustmentPct` | 1 | 3 | 33% |
| `credits.reductionPct` | 1 | 3 | 33% |
| `credits.removalPct` | 1 | 3 | 33% |
| `credits.totalSpendEur` | 1 | 3 | 33% |
| `emissions.avoidedEmissionsTco2e` | 1 | 3 | 33% |
| `emissions.scope1.uncertaintyPct` | 1 | 3 | 33% |
| `emissions.scope2.locationBasedTco2e` | 1 | 3 | 33% |
| `emissions.scope2.uncertaintyPct` | 1 | 3 | 33% |
| `governance.execRemunerationClimateSharePct` | 1 | 3 | 33% |
| `methodology.materialityMethod` | 1 | 3 | 33% |
| `revenueEur` | 1 | 3 | 33% |
| `sourceUrl` | 1 | 3 | 33% |
| `emissions.scope3[].factorSource` | 5 | 21 | 24% |
| `targets[].progressPct` | 3 | 18 | 17% |
| `risks[].controlEffectivenessLabel` | 2 | 14 | 14% |
| `risks[].financialImpactEur` | 2 | 14 | 14% |
| `risks[].likelihoodLabel` | 2 | 14 | 14% |
| `credits.projects[].tonnesRetired` | 1 | 11 | 9% |
| `credits.euBasedPct` | 0 | 3 | 0% |
| `credits.projects[].vintageYear` | 0 | 11 | 0% |
| `employees` | 0 | 3 | 0% |
| `energy` | 0 | 2 | 0% |
| `energy.highClimateImpactSectorSharePct` | 0 | 1 | 0% |
| `euTaxonomy` | 0 | 1 | 0% |
| `euTaxonomy.climateAdaptationSharePct` | 0 | 2 | 0% |
| `euTaxonomy.climateMitigationSharePct` | 0 | 2 | 0% |
| `euTaxonomy.opexAlignedPct` | 0 | 2 | 0% |
| `euTaxonomy.revenueAlignedPct` | 0 | 2 | 0% |
| `internalCarbonPrice` | 0 | 1 | 0% |
| `methodology.restatementReason` | 0 | 3 | 0% |

**84** reliably-filled, **26** sometimes-filled, **17** rarely-filled fields at n=3.

## Interpretation notes

The 0% fill fields are **not bugs in the schema** — they're real gaps in the sample. With only three fixtures, any field that's CSRD-specific (EU taxonomy breakdown, high-climate-impact sector share) or company-specific (vintage year on credits, employee count) simply didn't land in this sample. Most should rise above 0% as the corpus grows.

Fields likely to stay <20% even at scale:
- `credits.projects[].vintageYear` — rarely disclosed project-by-project in narratives.
- `risks[].financialImpactEur` — few companies quantify; most give qualitative narrative.
- `targets[].progressPct` — companies prefer "we are on track" prose over a number.

Fields likely to rise past 80% at scale:
- `emissions.scope3[].tco2e` — 48% here only because Philips declares five applicable categories but only populates numbers for those, marking others immaterial (correct behavior).
- `targets[].sbtiClassification` — 56% here because ENGIE has six targets, not all of which are individually SBTi-stamped (the Group certification covers them jointly).

## Extending the corpus

1. Drop a new `{slug}.json` into `fixtures/reports/`.
2. Re-run `npx tsx scripts/reports-coverage.ts`.
3. If any field's fill rate changes tier (≥80%, 20–80%, <20%), update this doc's top fields accordingly.

## Extractor

`extract.ts` uses Claude Sonnet (`MODEL_SONNET` from `lib/anthropic/client.ts`) with a TypeScript-shaped prompt. Input: the climate section text (~30–130 KB per report, extracted via `pymupdf` from the PDF). Output: JSON parsed by `carbonReportSchema`.

The extractor has a mock fallback when `ANTHROPIC_API_KEY` is unset — returns an empty-field shell so downstream code doesn't crash in offline development. Same pattern as `lib/agent/questions.ts`.
