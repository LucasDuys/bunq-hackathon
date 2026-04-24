# Carbon Reserve -- Concept

Working name: **Carbon Reserve** (TBD -- alternatives to consider: Offset, Verdant, Tally-C, Leaf, E1).

bunq Hackathon 7.0 entry. Agentic transaction-to-carbon-reserve loop with CSRD-ready audit trail. Not a marketplace.

## One-line pitch

Every bunq transaction becomes a carbon estimate; the agent moves money into a Carbon Reserve sub-account and, at month end, buys verified EU credits, producing CSRD E1-7 ready evidence.

## Why this angle

The hackathon theme ("AI that sees, hears, understands") is usually interpreted as consumer banking. The differentiator here is B2B/enterprise sustainability operations: the thing every EU company above 250 employees is about to get crushed by (CSRD reporting from FY2025 onwards, with E1 climate disclosures mandatory). The agentic loop does what a sustainability analyst would do manually, across thousands of transactions, with a defensible audit trail.

Not a carbon-credit marketplace. That's a separate, capital-intensive business. The differentiator is the loop between a payment and a reserved offset with a traceable reasoning chain.

## The flow (verbatim from spec)

### Onboarding

1. User (or company admin) connects a bunq account via OAuth.
2. Automatic webhook registration against bunq's `NotificationFilterUrl` on the monetary account(s).
3. Dashboard populates with recent transactions, first-pass carbon estimates, analytics (footprint by category, by team, by time).
4. For every purchase the system can compute an **alternative matrix**:
   - low environmental impact / low cost
   - low environmental impact / high cost
   - high environmental impact / low cost
   - high environmental impact / high cost
   (This is the "next time suggest a lower-carbon shopping list" capability.)

### Core flow per transaction

1. **Webhook receives transaction.** bunq fires MUTATION (or CARD_TRANSACTION_SUCCESSFUL) with merchant, amount, timestamp, account, description.

2. **Agent asks for missing context.** Push notification: "Upload receipt or scan product?" The user can respond with:
   - receipt image
   - product photo
   - barcode scan
   - invoice PDF
   - voice note ("This was team lunch for 8")
   If no response within a configurable window, the agent proceeds with merchant-level defaults.

3. **Vision / OCR extraction.**
   - Receipt image -> line items, quantities, prices.
   - Product image / barcode -> category, brand, material, food type.
   - Invoice PDF -> supplier, category, VAT, shipment method, business unit.

4. **Carbon estimation.** Each item is mapped to an emission factor. Output per item:
   - estimated kg CO2e
   - confidence
   - category (personal / team / travel / procurement / office / food / software / ...)
   - lower-carbon alternative
   Aggregated per transaction.

5. **Decision policy engine.** Applies company rules:
   - "Offset all food purchases above 5 kg CO2e."
   - "Do not offset first; suggest reduction if avoidable."
   - "Only buy EU-based credits."
   - "Prefer removal credits over avoidance credits."
   - "Require manager approval above EUR 25."
   - "Monthly carbon budget per team."

6. **Agentic action.**
   - Low-risk, pre-approved: auto-move money into the **Carbon Reserve** bunq sub-account.
   - High-risk / over threshold: request manager approval first.
   - Month end: batch-purchase verified EU carbon credits or retirement certificates. For the hackathon this is simulated via a `bunq.me` payment to a mock verified climate-project account.

7. **Enterprise ledger.** For every event, store:
   - original transaction (id, amount, merchant, time)
   - receipt image hash
   - extracted items (structured)
   - carbon estimate (per item + aggregate, with confidence)
   - model reasoning summary
   - offset / reserve amount
   - approval status + approver id + timestamp
   - credit / project metadata (for end-of-month purchases)
   - CSRD E1-7 ready export fields

## The demo beat

> User buys something. The app says:
>
> "I saw a EUR 42.80 Albert Heijn purchase. Scan the receipt?"
>
> They scan it.
>
> "Detected: beef, cheese, oat milk, vegetables. Estimated footprint: 14.2 kg CO2e. Beef is 73% of this. Company policy offsets food purchases above 10 kg CO2e. I recommend reserving EUR 1.06 into the EU Carbon Reserve. Approve?"
>
> "Approve, but next time suggest a lower-carbon shopping list."
>
> bunq moves EUR 1.06 into a dedicated Carbon Reserve savings account.
>
> At month end:
>
> "Your team generated 184 kg CO2e from meals and travel. EUR 13.80 reserved. Recommended: 0.18 tonnes of EU-based biochar removal credits. Ready to purchase and attach to CSRD E1-7?"

## System architecture

```
bunq webhook
    |
    v
transaction_normalizer   (Mercury 2, fast)
    |
    v
context_request_agent    (push, wait, timeout)
    |
    v
receipt / product parser (Claude Vision or Mercury 2 OCR)
    |
    v
carbon_estimator         (emission-factor lookup + LLM-as-judge for fuzzy items)
    |
    v
policy_engine            (rule DSL + autonomy ceiling, ported from GraphBot)
    |
    v
approval_agent           (Claude Opus 4.7 when stakes merit; Mercury 2 otherwise)
    |
    v
bunq_action_layer        (monetary-account-savings move, note-attachment for audit)
    |
    v
carbon_ledger            (Postgres + CSRD E1 export view)
```

## Hackathon MVP scope

Build this. Everything else is stretch.

1. bunq webhook receives one transaction (sandbox).
2. Web UI accepts a receipt upload.
3. Vision model extracts line items.
4. Carbon estimator returns kg CO2e per item.
5. Policy engine decides reserve amount.
6. bunq `monetary-account-savings` creates / moves money into a "Carbon Reserve" sub-account.
7. Dashboard shows transactions, kg CO2e, reserve balance, end-of-month recommended EU credit purchase, audit / CSRD export view.

### Explicitly out of scope for the hackathon

- Real carbon credit marketplace integration. Simulate with three fixed EU projects (biochar, reforestation, peatland restoration) with fake retirement certificates.
- Full CSRD E1 XBRL output. A CSV export with the right columns is enough to make the point.
- Bulk historical backfill. The loop must work for new transactions; backfill is a roadmap slide.
- Cross-account reconciliation, multi-entity group reporting.

## Why this wins (mapped to hackathon judging patterns)

| Criterion | Answer |
|---|---|
| Theme fit (sees, hears, understands) | Vision on receipts, voice for context ("team lunch for 8"), reasoning in the policy engine, action via bunq API. |
| Single innovation focus | One loop, explained in one sentence: transaction -> estimate -> reserve -> credit. |
| Deep bunq integration | MUTATION / CARD_TRANSACTION callbacks, monetary-account-savings, note-attachment, draft-payment (for approvals), payment for simulated credit purchase. |
| Agentic loop | Full DAG with autonomy gates; high-amount flows demand human approval, low-risk flows auto-execute. |
| Industry zeitgeist | CSRD mandatory reporting lands on thousands of EU mid-caps right now. Every CFO and sustainability lead is hunting for a way to automate this. |
| Practical value | "EUR 5k/year sustainability consultant replacement" is a defensible ROI line. |

## Known constraints (carry over from prior bunq research)

- Claude Opus 4.7 (judgment) + Mercury 2 (reflex) hybrid.
- EU data residency: prefer `eu-central-1`.
- Grammar-constrained structured output from Teambrain NLI pipeline.
- GraphBot `dag_executor.py` for the step DAG.
- GraphBot `autonomy.py` for money-movement ceilings.
- Nimbus connector pattern (`lib/integrations/`) for adding bunq alongside existing ones.
- 24-hour build, 3-person team, one live demo + 3-5 min video.

## Open questions

- **Emission factor data source.** Options: Climatiq (commercial API), Ecoinvent (licensed), OpenEmissionFactors (open), EXIOBASE (macro). Pick one with a sandbox tier by end of Day -1. See `research/02-emission-factors.md`.
- **Policy DSL shape.** YAML rules vs a small expression language vs plain JSON. YAML is demoable; JSON is safer to serialize into the ledger. Lean YAML for the hackathon.
- **Approval channel.** In-app push only, or also email? In-app only for the demo.
- **Mock credit projects.** Pick three: biochar, reforestation, peatland. Fake EU project ids, fake certificates, real-looking retirement metadata.
- **Simulated vs real month-end purchase.** Use `bunq.me` or a direct payment to a pre-created account labelled "EU Climate Project Fund".

---

_Last updated: 2026-04-24. Revise after Day -1 dry run._
