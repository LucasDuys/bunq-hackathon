# bunq Hackathon 7.0 -- Carbon Reserve

Planning workspace for a carbon-accounting agent that turns every bunq transaction into a reserved offset with a CSRD-ready audit trail.

Working name: **Carbon Reserve**. Final name TBD.

## Quick links

- [CONCEPT.md](CONCEPT.md) -- full concept, flow, MVP scope, demo beat
- [BUNQ-API.md](BUNQ-API.md) -- which bunq endpoints we touch and how
- [REUSABLE-TECH.md](REUSABLE-TECH.md) -- what we pull in from graphbot / teambrain / nimbus / pitchr
- [ARCHITECTURE.md](ARCHITECTURE.md) -- system diagram, Mercury 2 + Claude split, policy engine
- [RESEARCH-INDEX.md](RESEARCH-INDEX.md) -- research navigation
- [LEARNINGS.md](LEARNINGS.md) -- portable lessons from prior hackathon research

## Hackathon context

| Field | Value |
|---|---|
| Event | bunq Hackathon 7.0 -- Multimodal AI |
| Dates | April 24 19:00 CEST -- April 25 19:00 CEST (24 hours) |
| Venue | bunq HQ, Basisweg 32, Amsterdam |
| Theme | "Build AI that sees, hears, and understands. Use it to reinvent what banking feels like." |
| Team size | 3 |
| Tools provided | bunq API, Anthropic Claude, AWS |
| Prizes | EUR 5k / 2k / 1k + Anthropic & AWS sponsor prizes |
| Judging | Round 1: 3-5 min video + popular vote. Round 2: live 8-min demo + 2-min Q&A |

## One-line pitch

Every bunq transaction becomes a carbon estimate. The agent moves money into a Carbon Reserve sub-account and, at month end, buys verified EU credits, producing CSRD E1-7 ready evidence.

## The loop, in one diagram

```
bunq webhook
    |
    v
normalize -> ask for context -> vision/OCR -> carbon estimate -> policy engine -> action (reserve / approve / skip) -> ledger
```

The loop is the differentiator. Not a marketplace. Not a chatbot. A deterministic, auditable chain from payment to offset.

## Why this concept (and not the others we considered)

Prior research in `C:\dev\bunq-hackathon` explored five concepts (Keeper, Sentry, Ravel, Stitch, Tab). Carbon Reserve is a new concept for this hackathon. It reuses the same platform (bunq), the same hybrid model architecture (Mercury 2 + Claude), and the same reusable tech (GraphBot DAG, Teambrain NLI, Nimbus connectors), but targets a different, larger, and time-urgent pain: CSRD compliance for mid-market EU companies.

The portable research from the earlier round lives under `research/` (hybrid architecture, EU regulatory context, approval UX, pseudonym envelope, learnings).

## Three-track team allocation (draft)

### Track A: Agent core + policy engine

- Port GraphBot DAG executor + autonomy gates
- Port Teambrain NLI pipeline for merchant classification
- Mercury 2 reflex layer + Claude Opus 4.7 judgment layer
- Policy engine DSL (YAML rules -> decisions)
- Carbon estimator: emission factor lookup + LLM-as-judge for fuzzy items

### Track B: bunq integration + multimodal ingest

- bunq auth handshake (Installation -> Device -> Session) with request signing
- Callback handler (idempotent, whitelist-tolerant in sandbox)
- Receipt upload flow, Claude Vision line-item extraction
- Voice note ingest for context ("team lunch for 8")
- `monetary-account-savings` creation + move for the Carbon Reserve

### Track C: Dashboard + demo polish + video

- Next.js app shell, analytics (footprint by category, team, time)
- Per-transaction alternative matrix UI
- CSRD E1-7 export view
- Live DAG step visualization for the demo
- Stage choreography, 3-5 min video, backup recordings

### Rotating integrator

Every 4-6 hours, one person stops and does full end-to-end. Catches seams early. This is the role that usually gets skipped in 24-hour hackathons.

## Timeline

Today is 2026-04-24. Hackathon starts tonight. No pre-hackathon runway left; plan the first 6 hours tight.

| Window | Target |
|---|---|
| Hours 0-2 | Auth handshake working, webhook firing into local listener, receipt upload echo-back |
| Hours 2-6 | Vision extraction + carbon estimator end-to-end on a single transaction |
| Hours 6-12 | Policy engine + `monetary-account-savings` move + ledger insert |
| Hours 12-18 | Dashboard + alternative matrix + CSRD export view |
| Hours 18-22 | Demo polish, fallbacks, video |
| Hours 22-24 | GitHub cleanup, README, submit |

## Open questions (fast decisions needed)

See [CONCEPT.md -> Open questions](CONCEPT.md#open-questions). Resolve in first two hours:

1. Emission factor source (Climatiq vs OpenEmissionFactors vs Ecoinvent)
2. Policy DSL shape (YAML)
3. Which three mock EU credit projects to use (biochar, reforestation, peatland)
4. Simulated month-end purchase mechanism (`bunq.me` vs direct payment)

## Fallback ladder (if something breaks on stage)

- If webhook delivery stalls -> pre-recorded callback replay.
- If vision OCR misreads the receipt -> show confidence UI, human correction. Turn the bug into a feature.
- If the whole live demo collapses -> cut to the polished video.

## Research links

### bunq

- Docs index: <https://doc.bunq.com>
- Sitemap: <https://doc.bunq.com/sitemap.md>
- Hackathon 7.0: <https://www.bunq.com/en-nl/hackathon>
- H6 Devpost gallery: <https://bunq-hackathon.devpost.com/project-gallery>
- Community bunq MCP: <https://glama.ai/mcp/servers/@WilcoKruijer/bunq-mcp>

### Carbon + CSRD (to research)

- EFRAG ESRS E1 Climate Change (binding from FY2024/FY2025 depending on wave)
- EU Carbon Removal Certification Framework (CRCF), Regulation (EU) 2024/3012
- Climatiq API: <https://www.climatiq.io>
- OpenEmissionFactors: <https://www.openemissionfactors.org>
- Ecoinvent: <https://ecoinvent.org>

### Models

- Mercury 2 launch: <https://www.inceptionlabs.ai/blog/introducing-mercury-2>
- Claude Opus 4.7 (use via Anthropic SDK)

### Industry

- CSRD wave-3 rollout timelines: EFRAG guidance + national transposition tables
- Voluntary Carbon Market Integrity (VCMI) Claims Code of Practice

---

_Last updated: 2026-04-24._
