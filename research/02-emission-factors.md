# 02 -- Emission Factor Data Source

_Status: stub. **Decide by end of hour 1.** This is the single biggest external dependency choice._

## Candidates

| Source | Access | Free tier | Coverage | License | Notes |
|---|---|---|---|---|---|
| Climatiq | REST API | yes, rate-limited | broad (goods, services, travel, fuel) | commercial | best DX, good for hackathon |
| OpenEmissionFactors | CSV / JSON | yes, open | patchy, growing | CC-BY | good for a "no external dependency" story |
| Ecoinvent | licensed | no | deepest, most credible | paid | overkill for hackathon |
| EXIOBASE | MRIO tables | yes, academic | macro, country x sector | CC-BY-NC | good for back-of-envelope defaults when item-level data missing |
| UK BEIS / Defra factors | CSV | yes | UK-centric but widely reused | open | fallback for travel + fuel |

## Evaluation checklist (fill this in during research)

- [ ] Does it cover the NL supermarket aisle (dairy, meat, produce)?
- [ ] Does it return per-unit (per kg, per litre, per EUR) factors?
- [ ] Does it include uncertainty bounds?
- [ ] Latency from the NL (p50, p95)?
- [ ] Free-tier rate limit enough for a 24-hour demo?
- [ ] Sign-up time (email vs business verification)?
- [ ] Attribution / citation rules we must show in the UI?

## Fallback strategy

Whatever we pick primary, keep a hardcoded JSON dictionary of the top 50 most common items (beef per kg, chicken per kg, oat milk per L, petrol per L, KLM short-haul per km, rail NS intercity per km, cloud compute per vCPU-hour) as a zero-network backup for the demo.

## Output shape

See `RESEARCH-INDEX.md` -> Research agent output format.

## Preliminary recommendation

**Climatiq for primary, hardcoded dictionary for backup.** Rationale: free tier, fast sign-up, JSON API, covers EU grocery + travel. Cite Climatiq in the UI footer; keep the backup dictionary under `src/data/emission-factors-fallback.json`.
