# Research Index -- Carbon Reserve

Navigation hub for research. Runs the same pattern as `C:\dev\zebralegal-proposal\research\INDEX.md` and the prior bunq round.

## For the AI agent / team member reading this

1. Identify which part of the loop you are researching.
2. Jump to the listed file.
3. Run the listed searches and read the listed sources.
4. Act. Do not ask permission.

## Files in this repo

### Carbon Reserve specific (to be filled)

| # | File | Status | Topic |
|---|---|---|---|
| 01 | `research/01-carbon-accounting-primer.md` | stub | GHG Protocol scopes, kg CO2e basics, boundary rules |
| 02 | `research/02-emission-factors.md` | stub | Climatiq vs OpenEmissionFactors vs Ecoinvent -- pick one |
| 03 | `research/03-receipt-vision-ocr.md` | stub | Claude Vision vs Mercury 2 OCR for line items |
| 04 | `research/04-csrd-e1-reporting.md` | stub | ESRS E1 disclosure points, E1-7 structure, wave timelines |
| 05 | `research/05-eu-carbon-credits.md` | stub | CRCF 2024/3012, EU biochar + peatland + reforestation verification |
| 06 | `research/06-policy-engine-dsl.md` | stub | YAML vs JSON vs small expression language |
| 07 | `research/07-voluntary-carbon-market.md` | stub | VCMI Claims Code, ICVCM core carbon principles |
| 08 | `research/08-alternative-matrix.md` | stub | Lower-carbon product recommendation, food footprint databases |
| 09 | `research/09-enterprise-ledger.md` | stub | Audit trail schema, tamper-evidence, reasoning snapshots |

### Portable from prior round (copied verbatim, frame still applies)

| # | File | Source | Topic |
|---|---|---|---|
| 10 | `research/10-hybrid-architectures.md` | `bunq-hackathon/research/ravel/09` | Hybrid local-embed / cloud-LLM split; pseudonym envelope pattern |
| 11 | `research/11-eu-regulatory-context.md` | `bunq-hackathon/research/ravel/08` | DORA / DAC8 / GDPR / AI Act; adapt for CSRD framing |
| 12 | `research/12-approval-ux.md` | `bunq-hackathon/research/sentry/07` | Warn / pause / block ladder; maps to auto / draft / reject here |
| 13 | `research/13-pseudonym-envelope.md` | `bunq-hackathon/research/ravel/04` | HMAC + Presidio + coarsened amounts before LLM calls |

### Portable lessons

- `LEARNINGS.md` -- cross-cutting learnings from prior research round (hackathon pitch patterns, zero-training-data defaults, calibrated confidence).

## Shared research from Zebra (applies here too)

| Topic | Primary source |
|---|---|
| LLM-as-judge for confidence calibration | `C:\dev\zebralegal-proposal\research\04-evaluator-and-output-validation\llm_as_judge_pattern.md` |
| Structured output / schema-validated tool use | `C:\dev\zebralegal-proposal\research\05-structured-output\structured_output_formatting.md` |
| Prompt caching + context management | `C:\dev\zebralegal-proposal\research\01-agent-context-and-scale\context_window_management.md` |
| Parallel tool-use | `C:\dev\zebralegal-proposal\research\02-agent-latency-and-performance\parallel_tool_use.md` |
| EU AI Act Article 14 (human oversight) | `C:\dev\zebralegal-proposal\research\06-compliance\article-14-human-oversight.md` |
| EU AI Act Article 50 (AI disclosure) | `C:\dev\zebralegal-proposal\research\06-compliance\article-50-transparency.md` |
| GDPR DPIA methodology | `C:\dev\zebralegal-proposal\research\06-compliance\gdpr-dpia-for-legal-ai.md` |
| Anthropic prompting guide | `C:\dev\zebralegal-proposal\research\03-prompting-guides\anthropic_official_prompting.md` |

## Task -> file routing

| Task | Read |
|---|---|
| "Pick an emission factor API today" | 02 |
| "Extract line items from a receipt image" | 03 + shared structured output |
| "Explain to a judge what CSRD E1 compliance looks like" | 04 + 11 |
| "Decide if simulated biochar credits are defensible" | 05 + 07 |
| "Build the rule DSL" | 06 |
| "Design the approval UX for a EUR 50 draft" | 12 + shared Article 14 |
| "Prove no PII leaves the laptop" | 13 |
| "Write the ledger schema" | 09 + ARCHITECTURE.md |
| "Should Mercury 2 or Claude run this step" | 10 |

## Research agent tasking (Day 0, first 2 hours)

Dispatch in parallel before building:

1. **Emission factors**: "Compare Climatiq API, OpenEmissionFactors, and Ecoinvent for a 24-hour hackathon. Free tier, coverage of EU grocery + food + fuel + travel, response latency, license."
2. **CSRD E1-7**: "What are the mandatory disclosure points in ESRS E1 (Climate Change), especially E1-7 (GHG removals and carbon credits). What fields must an offset record contain for an auditor to accept it?"
3. **EU credit verification**: "Under EU Regulation 2024/3012 (CRCF), what qualifies a biochar, peatland, or reforestation project as verified? Where are sandbox or demo registries?"
4. **Receipt OCR accuracy**: "Claude Opus 4.7 vision vs Mercury 2 OCR vs Google Document AI for Dutch supermarket receipts. Per-item extraction accuracy."
5. **VCMI / ICVCM**: "VCMI Claims Code and ICVCM Core Carbon Principles as of 2026. What claim level can a company make after reserving for a credit that has not yet been retired?"

If using Forge: one `/forge:researcher` task per query. Manual fallback: one person, 2 hours, timeboxed.

## Research agent output format (same template every time)

- Summary (4-6 sentences)
- Key Concepts
- How It Works
- State of the Art 2024-2026
- Use Cases for Carbon Reserve
- Feasibility verdict (green / yellow / red)
- Tradeoffs
- Recommended Approach
- Sources (with dates)
- <400 word summary for the caller to synthesize

---

_Last updated: 2026-04-24. Index only. Content lives in numbered files._
