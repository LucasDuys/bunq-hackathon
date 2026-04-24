# Architecture -- Carbon Reserve

## High-level diagram

```
+--------------------------------------------------------------+
|                       Next.js 14 App                          |
|  +---------+  +---------+  +-----------+  +---------------+  |
|  | Receipt |  | Voice   |  | Barcode / |  | Invoice PDF   |  |
|  | camera  |  | capture |  | product   |  | upload        |  |
|  +----+----+  +----+----+  +-----+-----+  +-------+-------+  |
|       |            |             |                |           |
|       v            v             v                v           |
|  +--------------------------------------------------------+  |
|  |        Multimodal normalizer  (Mercury 2)               |  |
|  |  image -> line items | voice -> context tag |           |  |
|  |  invoice PDF -> supplier + category + VAT               |  |
|  +-----------------------------+--------------------------+  |
|                                |                              |
|                                v                              |
|  +--------------------------------------------------------+  |
|  |  Agent harness  (GraphBot DAG executor, ported)         |  |
|  |  +-----------+  +-----------+  +------------------+    |  |
|  |  | Tool reg  |  | Autonomy  |  | Verification /    |    |  |
|  |  |           |  | ceiling   |  | pre-flight check  |    |  |
|  |  +-----------+  +-----------+  +------------------+    |  |
|  |                                                         |  |
|  |  Mercury 2 for classification, lookup, routing          |  |
|  |  Claude Opus 4.7 for policy judgment + reasoning trace  |  |
|  +-----------------------------+--------------------------+  |
|                                |                              |
|                                v                              |
|  +--------------------------------------------------------+  |
|  |       Carbon estimator                                  |  |
|  |  - emission factor lookup (Climatiq / OEF)              |  |
|  |  - LLM-as-judge fallback for fuzzy items                |  |
|  |  - per-item kg CO2e + confidence + category             |  |
|  +-----------------------------+--------------------------+  |
|                                |                              |
|                                v                              |
|  +--------------------------------------------------------+  |
|  |       Policy engine  (YAML rules -> decision)           |  |
|  |  threshold checks | budget checks | EU-credit filter    |  |
|  +-----------------------------+--------------------------+  |
|                                |                              |
|                                v                              |
|  +--------------------------------------------------------+  |
|  |       bunq action layer                                 |  |
|  |  monetary-account-savings move | draft-payment |        |  |
|  |  note-attachment (audit) | payment (simulated credit)   |  |
|  +-----------------------------+--------------------------+  |
|                                |                              |
|                                v                              |
|  +--------------------------------------------------------+  |
|  |       Carbon ledger + CSRD E1-7 export                  |  |
|  |  Postgres (Supabase). Row per event with reasoning.     |  |
|  +--------------------------------------------------------+  |
|                                                               |
|  bunq callbacks (HTTPS, idempotent):                          |
|  MUTATION | CARD_TRANSACTION_SUCCESSFUL | DRAFT_PAYMENT      |
+--------------------------------------------------------------+
```

## Mercury 2 + Claude split

| Layer | Model | Example tasks |
|---|---|---|
| Reflex (fast, cheap, frequent) | Mercury 2 | Classify a MUTATION into spend category; extract line items from a receipt; look up an emission factor; extract VAT rate from an invoice; pick the next tool to call |
| Judgment (slow, expensive, rare) | Claude Opus 4.7 | Decide auto-reserve vs request-approval for borderline amounts; write the user-facing reasoning summary; reason over a full month for the end-of-month credit recommendation; compose the CSRD narrative block |

See `research/10-hybrid-architectures.md` for the full reasoning on this split (carried over from prior-round research).

## Policy engine

Rules are loaded from `policy.yaml` at startup and evaluated per transaction. Minimal DSL:

```yaml
- match:
    category: food
    kgco2e_above: 5
  action: offset
  approval: auto
  credit_preference: [biochar, reforestation]
  credit_region: EU

- match:
    amount_eur_above: 25
  action: offset
  approval: manager

- match:
    category: travel
    leg: intercontinental
  action: offset
  approval: auto
  credit_preference: [removal_only]

- budget:
    team: marketing
    monthly_kgco2e_cap: 500
  on_breach: require_manager_approval
```

Each rule is evaluated top-to-bottom; first match wins for the action decision. Budget rules are evaluated as side constraints.

Serialize every matched rule into the ledger row for audit. A CSRD auditor must be able to trace any offset back to the policy line that triggered it.

## Autonomy ceiling

Ported from `C:\dev\graphbot\core_gb\autonomy.py`. The ceiling is a hard cap the agent cannot exceed without human approval. Defaults:

- Single transaction: auto-reserve up to EUR 5 per transaction.
- Daily: auto-reserve up to EUR 50 per account per day.
- Monthly: auto-reserve up to 1% of last month's outflow.

Anything above the ceiling becomes a `draft-payment` that a manager approves in the bunq app.

## Ledger schema (Supabase)

```sql
create table carbon_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  bunq_monetary_account_id bigint not null,
  bunq_payment_id bigint,
  merchant text,
  amount_eur numeric(12,2) not null,
  currency text default 'EUR',
  tx_time timestamptz not null,
  receipt_image_sha256 text,
  extracted_items jsonb,              -- [{name, qty, unit_price, category}]
  carbon_estimate jsonb,              -- [{item, kgco2e, confidence, factor_source}]
  aggregate_kgco2e numeric(12,4),
  policy_rule_id text,                -- which rule fired
  action text check (action in ('offset','skip','draft','approved','rejected')),
  reserve_amount_eur numeric(12,2),
  approver_id text,
  approved_at timestamptz,
  credit_purchase_id uuid,            -- fk to credit_purchases at month-end
  reasoning_summary text,             -- Claude's one-paragraph summary
  csrd_fields jsonb                   -- pre-computed E1-7 export fields
);

create table credit_purchases (
  id uuid primary key default gen_random_uuid(),
  purchased_at timestamptz default now(),
  project text check (project in ('biochar','reforestation','peatland')),
  tonnes_co2e numeric(12,4) not null,
  price_eur numeric(12,2) not null,
  retirement_certificate_url text,
  simulated boolean default true      -- hackathon only
);
```

## CSRD E1-7 export view

CSV columns, one row per reporting period per emission category:

```
reporting_period, entity_id, scope, category, activity_data, activity_unit,
  emission_factor_kgco2e_per_unit, factor_source, gross_emissions_tco2e,
  offsets_tco2e, offsets_project, offsets_certificate_url, net_emissions_tco2e,
  uncertainty_pct, methodology_narrative
```

Methodology narrative is a Claude-composed paragraph explaining how emissions were estimated, which factor sources were used, and where uncertainty sits.

## Observability

Port `withTracing` / `wrapWithTrace` from Nimbus. Each DAG node logs:

- start / end timestamps
- inputs (hashed if PII; see `research/13-pseudonym-envelope.md`)
- outputs
- tool calls made
- model used (Mercury 2 vs Claude Opus)
- tokens in / out
- reasoning summary

For the demo, render this as a live-streaming waterfall next to the dashboard.

## Security + privacy boundaries

- Receipts stored as hashed filenames in Supabase Storage, encrypted at rest.
- PII (names on receipts, IBANs) pseudonymized before any LLM call. See `research/13-pseudonym-envelope.md`.
- bunq API key + session cached locally in an env-encrypted file, never checked in.
- Policy file in-repo; company-specific overrides loaded from a private `.policy.local.yaml`.
