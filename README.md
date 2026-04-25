<div align="center">

<br />

# Carbo

### Agentic carbon accounting for bunq Business

*Webhook-ingested transactions → spend-based emissions with confidence ranges → agent-driven refinement → policy-routed reserve transfer → simulated EU carbon credits → CSRD ESRS E1 report.*

<br />

[![Built for bunq Hackathon 7.0](https://img.shields.io/badge/bunq-Hackathon%207.0-3ecf8e?style=for-the-badge&labelColor=0f0f0f)](https://www.bunq.com)
[![24 hours](https://img.shields.io/badge/Built%20in-24%20hours-f7b955?style=for-the-badge&labelColor=0f0f0f)](DEMO.md)
[![Team of 3](https://img.shields.io/badge/Team-3%20people-9d72ff?style=for-the-badge&labelColor=0f0f0f)](#)

[![Next.js 16](https://img.shields.io/badge/Next.js-16-fafafa?style=for-the-badge&logo=nextdotjs&logoColor=fafafa&labelColor=0f0f0f)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-5fb9ff?style=for-the-badge&logo=typescript&logoColor=5fb9ff&labelColor=0f0f0f)](https://www.typescriptlang.org)
[![Tailwind 4](https://img.shields.io/badge/Tailwind-4-3ecf8e?style=for-the-badge&logo=tailwindcss&logoColor=3ecf8e&labelColor=0f0f0f)](https://tailwindcss.com)
[![Anthropic Claude](https://img.shields.io/badge/Claude-Sonnet%204.6%20%2B%20Haiku%204.5-9d72ff?style=for-the-badge&labelColor=0f0f0f)](https://www.anthropic.com)
[![SQLite](https://img.shields.io/badge/SQLite-Drizzle%20ORM-5fb9ff?style=for-the-badge&logo=sqlite&logoColor=5fb9ff&labelColor=0f0f0f)](https://www.sqlite.org)
[![Node 22 LTS](https://img.shields.io/badge/Node-22%20LTS-3ecf8e?style=for-the-badge&logo=nodedotjs&logoColor=3ecf8e&labelColor=0f0f0f)](https://nodejs.org)

<br />

## Watch the demo

<a href="https://www.youtube.com/watch?v=7zTyIQmJTBk">
  <img src="https://img.youtube.com/vi/7zTyIQmJTBk/maxresdefault.jpg" alt="Carbo demo video — click to watch on YouTube" width="780" />
</a>

<br />

### **[▸ Watch the full demo on YouTube](https://www.youtube.com/watch?v=7zTyIQmJTBk)**

<sub>3 minutes · click-by-click · live bunq sandbox + real Claude</sub>

</div>

---

<div align="center">

> ### *"We turn bunq transactions into a monthly, audit-ready carbon report — and automatically fund your EU carbon reserve."*

</div>

---

## The 60-second pitch

**The problem.** The EU Omnibus Directive (Feb 2026) cut mandatory CSRD scope by ~85% — only companies with **>1,000 employees** and **>€450M turnover** must report, starting FY2027.[^1] But that didn't make the work disappear: it pushed it down the supply chain. SMEs now face a flood of carbon-data requests from large customers and banks, capped at the **VSME** (Voluntary SME Standard, EFRAG → European Commission, July 2025).[^2] The current options are bad: SaaS tooling runs **€1k–€5k/year for the light tier**, in-depth consulting **starts at €10k+**, and enterprise platforms **€2k–€25k+/year**.[^3] Manual VSME drafts take weeks.[^4]

**The insight.** bunq Business already has the only signal a credible estimate needs: *what was bought, from whom, for how much.*

**The build.** Carbo plugs into the bunq webhook in minutes. Every transaction becomes a calibrated emissions estimate with an explicit confidence range. Once a month, an **8-agent DAG** runs, surfaces **2–3 refinement questions** (only the high-spend low-confidence ones), and proposes a **reserve transfer + EU carbon-credit allocation**. The user clicks **Approve & transfer €X**. Money moves from the main bunq account to a **bunq Reserve sub-account**, recorded on a **SHA-256 hash-chained audit ledger** that satisfies an external auditor.

**The demo numbers** *(measured from the seeded SQLite, not aspirational)*. 181 transactions over 90 days · €54,730 total spend · ~7.5 tCO₂e per monthly close · EU credits split across biochar / peatland / reforestation · CSRD ESRS E1-6 + E1-7 report · audit chain valid.

[^1]: [Council of the EU — Omnibus simplification press release, Feb 2026](https://www.consilium.europa.eu/en/press/press-releases/2026/02/24/council-signs-off-simplification-of-sustainability-reporting-and-due-diligence-requirements-to-boost-eu-competitiveness/) · [BDO — CSRD post-Omnibus revised scope](https://www.bdo.com/insights/sustainability-and-esg/csrd-post-omnibus-revised-scope-and-requirements)
[^2]: [European Commission — VSME recommendation](https://finance.ec.europa.eu/publications/commission-presents-voluntary-sustainability-reporting-standard-ease-burden-smes_en) · [EFRAG — SMEs and Sustainability Reporting](https://www.efrag.org/en/smes-and-sustainability-reporting)
[^3]: [D-Carbonize — Carbon accounting cost breakdown](https://d-carbonize.eu/blog/carbon-accounting-cost/) · [EcoHedge — Cost of carbon accounting for SMEs](https://www.ecohedge.com/blog/how-much-does-carbon-accounting-cost-for-smes/)
[^4]: [GoClimate — Comparing the Top 5 VSME Tools](https://www.goclimate.com/knowledge/articles/comparing-the-top-5-vsme-tools)

---

## Contents

| | |
|---|---|
| **[Why it's novel](#whats-novel)** | The 5 ideas judges should leave with |
| **[The agentic DAG](#the-agentic-dag)** | 8-agent reasoning layer with code-adjudicated judges |
| **[The close state machine](#the-close-state-machine)** | DB-persisted, idempotent, replayable |
| **[Quickstart](#quickstart)** | `npm install && npm run dev` — under 90 seconds |
| **[Demo flow](#demo-flow-3-minutes)** | What to click, in what order |
| **[Stack](#stack)** | Locked-in choices and why |
| **[Emission estimation](#emission-estimation)** | Spend-based, GHG Scope 3 Cat 1 |
| **[Judge guide](#judge-guide)** | Criteria → evidence map |
| **[bunq integration](#bunq-integration)** | Native primitives end-to-end |
| **[Architecture & docs](#architecture--agent-docs-read-first)** | Read these before editing |
| **[Directory map](#directory-map)** | Where everything lives |
| **[Real vs simulated](#whats-real-vs-simulated)** | Honest scope |

---

## What's novel

| | |
|---|---|
| **8-agent DAG, not a chatbot** | `lib/agents/dag/` — Baseline → Research → [Green Alt ‖ Cost Savings] → [Green Judge ‖ Cost Judge] → Credit Strategy → Executive Report. See [`docs/agents/00-overview.md`](docs/agents/00-overview.md). |
| **LLMs author, code adjudicates** | `greenJudge` and `costJudge` re-verify math and source-evidence in code; their verdicts can flip the LLM's. Credit-strategy and report numbers are computed **before** the LLM sees them. The LLM cannot move money or invent savings. |
| **DB-persisted state machines** | 12-state close, 10-state onboarding. No LangGraph, no Temporal. Every transition is `WHERE state = ...` — idempotent, replayable, restart-safe. |
| **SHA-256 hash-chained ledger** | `lib/audit/append.ts`. Append-only via SQL trigger. Tampering breaks `verifyChain` on the next read. `/ledger` renders a live "Chain valid" badge. |
| **Quadrature confidence rollup** | `lib/emissions/estimate.ts`. Variance-correct, spend-weighted; refine-Q clustering on `spend × (1 − confidence)` so we only ask about transactions that matter. |

---

## The agentic DAG

Entry point: `POST /api/impacts/research`. Baseline is deterministic; everything downstream uses Sonnet 4.6 with code-side judges that can override LLM verdicts on hard rules (zero-sources, math mismatch).

```mermaid
flowchart LR
    A[Spend<br/>Baseline]:::deterministic --> B[Research<br/>web_search]:::llm
    B --> C[Green<br/>Alternatives]:::llm
    B --> D[Cost<br/>Savings]:::llm
    C --> E[Green<br/>Judge]:::judge
    D --> F[Cost<br/>Judge]:::judge
    E --> G[Credit<br/>Strategy]:::deterministic
    F --> G
    G --> H[Executive<br/>Report]:::llm

    classDef deterministic fill:#0f0f0f,stroke:#3ecf8e,color:#fafafa,stroke-width:2px
    classDef llm fill:#0f0f0f,stroke:#9d72ff,color:#fafafa,stroke-width:1px
    classDef judge fill:#0f0f0f,stroke:#f7b955,color:#fafafa,stroke-width:1px
```

| Node | Model | Authority |
|---|---|---|
| **Spend Baseline** | deterministic | Source of truth for spend + emissions |
| **Research** | Sonnet 4.6 + `web_search_20250305` (30-day cache) | Suggests green alternatives + price intel |
| **Green Alternatives** | Sonnet 4.6 | Proposes switches with payback math |
| **Cost Savings** | Sonnet 4.6 | Proposes savings with payback math |
| **Green Judge** | Sonnet 4.6 → **code override** | Validates evidence + math; can flip verdict |
| **Cost Judge** | Sonnet 4.6 → **code override** | Validates evidence + math; can flip verdict |
| **Credit Strategy** | deterministic | Allocates reserve across EU credit projects |
| **Executive Report** | Sonnet 4.6 | Writes prose **on top of frozen numbers** |

### Per-agent contracts

One row per agent — what flows in, what flows out, and the single rule that defines it.

| # | Agent | Ingests | Emits | Single invariant |
|---|---|---|---|---|
| 01 | **Spend Baseline** | `{orgId, month}` + tx rows | `BaselineOutput` (≤20 priority targets) | Never passes raw rows downstream |
| 02 | **Research** | priority targets | `ResearchedPool` keyed by cluster | Every alternative carries ≥1 source URL |
| 03 | **Green Alternatives** | baseline + pool | `GreenAltOutput` | Picks from the pool — cannot invent vendors |
| 04 | **Cost Savings** | baseline + pool | `CostSavingsOutput` | Annualizes only recurring spend |
| 05 | **Green Judge** | greenAlt + pool | `GreenJudgeOutput` | Code overrides verdict on zero-source / math mismatch |
| 06 | **Cost Judge** | costSavings + pool | `CostJudgeOutput` | Same code-override rule as Green Judge |
| 07 | **Credit Strategy** | both judges + baseline | `CreditStrategyOutput` | Numbers frozen by code **before** the LLM sees them |
| 08 | **Executive Report** | judges + strategy + baseline | `ExecReportOutput` | Only `approved` / `approved_with_caveats` items appear |

<details>
<summary><b>▸ How each agent actually works (8 workflows)</b></summary>

<br />

**01 — Spend Baseline**

> *Why score on `spend × (1 − confidence)`: that product is exactly where one refinement question or one judge override moves the most CFO-grade money. The top 20 clusters fit a 20k-token downstream budget even on 10k transactions.*

```mermaid
flowchart LR
    A[bunq tx rows<br/>for the month] --> B[Match each row<br/>to a category<br/>via merchant rules]
    B --> C[EUR × kgCO2e/EUR<br/>category factor]
    C --> D[Add ± factor uncertainty<br/>→ low / point / high]
    D --> E[Quadrature rollup<br/>variance + spend-weighted<br/>confidence]
    E --> F[Score every cluster<br/>spend × 1−confidence]
    F --> G[Keep top 20]
    G --> H[Tag each:<br/>green / cost / both]
    H --> I[priority_targets]
```

---

**02 — Research**

> *Why fingerprint-cached web search: vendor lists and prices change weekly, not daily. A 30-day cache keyed on `(category, jurisdiction, policy, week)` lets a second company reuse the first company's research at near-zero cost. Templates only fire when the search literally returns nothing.*

```mermaid
flowchart LR
    A[priority_targets] --> B{Cache hit?<br/>category + jurisdiction<br/>+ policy + week}
    B -->|hit ≤30d| H[Reuse cached vendors]
    B -->|miss| C[Search the web<br/>≤3 queries / cluster]
    C --> D[Extract vendor candidates<br/>from real result snippets]
    D --> E[Validate each via<br/>record_alternative tool<br/>name · url · geography ·<br/>cost/CO2 deltas]
    E --> F{≥1 alternative<br/>recorded?}
    F -->|yes| G[Persist 30-day cache]
    F -->|no| I[Fall back to<br/>GREEN_TEMPLATES]
    I --> G
    G --> H
    H --> J[ResearchedPool]
```

---

**03 — Green Alternatives**

> *Why a carbon-first decision tree: cost cannot beat carbon at this stage. We only escalate to "recommend if policy allows" when there's a real cost premium, and we reject anything that isn't functionally comparable so the judge isn't stuck adjudicating apples vs oranges.*

```mermaid
flowchart LR
    A[priority target<br/>+ vendor pool] --> B[Compute current<br/>kg CO2e baseline]
    B --> C{Comparable<br/>alt in pool?}
    C -->|no| D[no_viable_alternative_found]
    C -->|yes| E{Functionally<br/>comparable?}
    E -->|no| D
    E -->|yes| F{Δ CO2e ≥ 10%?}
    F -->|no| G[no_action_needed]
    F -->|yes| H{Cost<br/>premium?}
    H -->|none| I[recommend_switch]
    H -->|positive| J[recommend_if_policy_allows]
```

---

**04 — Cost Savings**

> *Why detect recurring spend in SQL first: annualizing a one-time charge by multiplying by 12 is the most common LLM hallucination. We tag each cluster as recurring vs one-time before the model sees it, so only the recurring path can ever flow into annual savings.*

```mermaid
flowchart LR
    A[priority target<br/>+ 90d history] --> B[SQL: ≥3 charges<br/>same merchant<br/>= recurring]
    B --> C{Recurring?}
    C -->|yes| D[Annualize<br/>monthly_avg × 12]
    C -->|no| E[One-time only<br/>no annualization]
    D --> F{Decision tree}
    E --> F
    F --> G[vendor_switch<br/>cheaper equivalent]
    F --> H[supplier_consolidation<br/>multi-vendor category]
    F --> I[bulk_purchase<br/>high-volume]
    F --> J[cancellation<br/>+ business_risk flag]
    F --> K[needs_validation<br/>too speculative]
```

---

**05 — Green Judge**

> *Why code overrides the verdict: a confident-sounding "approved" with zero source URLs, or with `saved_kg ≠ current × Δ%`, is exactly the failure mode reviewers won't catch by reading prose. We re-count and re-multiply in code; mismatches force a reject regardless of how good the writeup is.*

```mermaid
flowchart LR
    A[GreenAlt result] --> B[Score 0–100<br/>on 10 evaluation criteria]
    B --> C[Map to verdict<br/>approved / w_caveats /<br/>needs_context / rejected]
    C --> D[Code: count source URLs<br/>in researchedPool]
    D --> E{≥1 source?}
    E -->|no| F[OVERRIDE → rejected<br/>reason: zero_sources]
    E -->|yes| G[Code: recompute<br/>saved_kg = current × Δ%]
    G --> H{Within ±5%<br/>of LLM number?}
    H -->|no| I[OVERRIDE → rejected<br/>reason: math_mismatch]
    H -->|yes| J[Keep verdict<br/>+ apply correction]
    F --> K[Append signed audit row]
    I --> K
    J --> K
```

---

**06 — Cost Judge**

> *Why three guard checks: each one maps to a known failure mode of the cost agent — (1) annualizing a one-time, (2) recommending a cancellation without flagging business risk, (3) recommending a cheaper option that's secretly higher carbon. Any one trip flips the verdict.*

```mermaid
flowchart LR
    A[CostSavings result] --> B[Score 0–100]
    B --> C[Map to verdict]
    C --> D{Annualized<br/>a one-time?}
    D -->|yes| E[OVERRIDE → rejected]
    D -->|no| F{Cancellation w/o<br/>business_risk?}
    F -->|yes| E
    F -->|no| G{Carbon higher<br/>and unflagged?}
    G -->|yes| E
    G -->|no| H[Keep verdict]
    E --> I[Append signed audit row]
    H --> I
```

---

**07 — Credit Strategy**

> *Why every number is computed in code first: the CFO net-impact figure is the most consequential number in the report — it goes on a signed audit chain. We compute the full formula deterministically, freeze the numbers, then only let the agent write a 220-char prose label on top. The model cannot move a single digit.*

```mermaid
flowchart LR
    A[approved switches<br/>+ jurisdiction NL/DE/FR/EU] --> B[direct_saving =<br/>old_annual − new_annual]
    B --> C[avoided_offset =<br/>kg_reduced/1000<br/>× credit_price]
    C --> D[tax_deduction =<br/>deductible<br/>× marginal_rate]
    D --> E[avoided_carbon_tax =<br/>tCO2e × EU ETS price]
    E --> F[net = sum<br/>− implementation_cost<br/>− risk_adjustment]
    F --> G[Allocate residual tCO2e<br/>across biochar /<br/>peatland / reforestation]
    G --> H[Freeze numbers<br/>+ sha256 digest]
    H --> I[Generate ≤220-char<br/>CFO prose summary<br/>on frozen numbers]
    I --> J[CreditStrategyOutput]
```

---

**08 — Executive Report**

> *Why a cost × carbon matrix: the CFO doesn't need 30 recommendations, they need to know which 3 to act on this month. Quadrants make the trade-off explicit. Rejected items don't appear at all but their reason surfaces in `limitations[]` so the report stays honest about its gaps.*

```mermaid
flowchart LR
    A[judges + strategy<br/>+ baseline] --> B[Filter to approved /<br/>approved_with_caveats]
    B --> C[Place each rec on<br/>cost × carbon grid]
    C --> D{Quadrant?}
    D -->|low / low| E[best — green flag]
    D -->|high / low| F[ESG-positive,<br/>finance-sensitive]
    D -->|low / high| G[cost-saving,<br/>carbon-risk]
    D -->|high / high| H[avoid / replace]
    E --> I[Top-5 by carbon<br/>+ Top-5 by EUR]
    F --> I
    G --> I
    H --> I
    I --> J[Compute headline KPIs]
    J --> K[Generate executive summary]
    K --> L[Package CSRD export<br/>ESRS E1-6 + E1-7]
    L --> M[Rejected items →<br/>limitations]
```

</details>

---

## The close state machine

12 states, DB-persisted, every transition guarded by `WHERE state = ...`. The pipeline animates through these on `/close/[id]`.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> INGEST
    INGEST --> CLASSIFY: tx ingested
    CLASSIFY --> ESTIMATE: merchants matched
    ESTIMATE --> CLUSTER: emissions estimated
    CLUSTER --> READY: 3 questions answered
    READY --> APPROVED: user approves
    APPROVED --> [*]: reserve transferred
```

| State | Copy |
|---|---|
| `INGEST` | "Ingesting transactions…" |
| `CLASSIFY` | "Matching merchants…" |
| `ESTIMATE` | "Estimating emissions…" |
| `CLUSTER` | "We have 3 questions." |
| `READY` | "Ready to approve." |
| `APPROVED` | "Reserve transferred." |

---

## Quickstart

> **Heads up.** Use **Node 22 LTS** (`.nvmrc` pins it). Do **not** run on Node 25 — its higher memory baseline plus `better-sqlite3`'s native rebuild has been observed to wedge 18GB MacBooks during install.

```bash
nvm use            # or: fnm use
npm install
npm run migrate    # creates ./data/carbon.db
npm run seed       # 61 sandbox transactions across 90 days
npm run dev
```

Open <http://localhost:3000> → click **Run Carbon Close**.

### Environment

Copy `.env.example` to `.env.local`. Defaults are mock-only — no external API keys needed to demo.

```bash
ANTHROPIC_MOCK=1   # 1 = stub LLM. 0 = real (needs ANTHROPIC_API_KEY).
BUNQ_MOCK=1        # 1 = stub bunq. 0 = real (needs API key + signing key).
DRY_RUN=1          # 1 = don't actually move money via bunq.
```

### Reset the demo

```bash
npm run reset      # wipes + re-seeds. Restart `npm run dev` afterward
                   # so the DB handle isn't stale.
```

### Run the DAG end-to-end (with real Claude)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_MOCK=0
npm run dev
# in another shell:
curl -X POST http://localhost:3000/api/impacts/research \
  -H 'content-type: application/json' \
  -d '{"month":"2026-03"}' | jq
```

---

## Demo flow (3 minutes)

> **TL;DR.** Run Carbon Close → answer 3 refinement questions → approve → see CSRD report + signed audit chain.
> Click-by-click with expected screen text in [`DEMO.md`](DEMO.md).

| # | Route | What you see |
|---|---|---|
| 1 | **`/`** | Dashboard — 181 tx over 90 days, €54.7k spend. Click **Run Carbon Close**. |
| 2 | **`/close/[id]`** | Pipeline animates `INGEST → CLASSIFY → ESTIMATE → CLUSTER`. Pauses at 3 refinement questions surfaced by spend-weighted uncertainty. |
| 3 | (modal) | Answer each → confidence rises (method flips `spend_based → refined`). |
| 4 | **`/close/[id]`** | Proposed actions — reserve transfer + ~7.5 tCO₂e of EU credits across biochar / peatland / reforestation. Click **Approve & execute**. |
| 5 | **`/report/2026-04`** | CSRD ESRS E1-6 + E1-7 report, ready for export. |
| 6 | **`/ledger`** | SHA-256 chain renders a live "Chain valid" badge. |
| 7 | **`/impacts`** | Cost-vs-carbon 2×2 matrix of switch recommendations. |
| 8 | **`/presentation`** | Interactive scroll-sync deck of the DAG. |

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** App Router, TypeScript, Tailwind 4, Recharts | Server components by default, route handlers for the bunq webhook |
| Database | **SQLite** via better-sqlite3 + **Drizzle ORM** | Hash-chained `audit_events` via SQL trigger; zero-deps deploy |
| LLMs | **Anthropic TS SDK** — Haiku 4.5 (classify), Sonnet 4.6 (refine + CSRD) | No Opus. Tool-use only; Zod-validated outputs |
| Banking | **bunq** thin client, RSA-SHA256 signing, webhook verify | Mock-first; flip `BUNQ_MOCK=0` for live sandbox |
| Factors | DEFRA 2024 / ADEME / Exiobase, **hardcoded** in `lib/factors/` | No external API calls; every row keeps its `source` |
| Tunnel | Cloudflare Tunnel | Stable webhook URL across restarts |

---

## Emission estimation

Spend-based emission factors (GHG Protocol Scope 3, Category 1). Each transaction's EUR amount × category-specific factor (kg CO₂e per EUR). Factors from **DEFRA 2024**, **ADEME Base Carbone**, and **Exiobase** — all hardcoded in `lib/factors/index.ts`, no external API calls.

The Claude API handles the intelligence layer: classifying merchants into the right emission category, generating refinement questions to reduce uncertainty, and writing CSRD-compliant narratives.

```text
confidence = (1 − factor_uncertainty) × classifier_confidence × tier_weight
rollup     = quadrature-summed variance, spend-weighted confidence
cluster    = group transactions by spend × (1 − confidence) — surface the highest first
```

---

## Judge guide

| Criterion | Weight | Where it shows up | Anchor |
|---|---|---|---|
| **Impact & usefulness** | 30% | CSRD report, tax-savings + reserve loop, real bunq transfer, switch recommendations | [JUDGE §1](JUDGE.md#1-impact--usefulness--30) |
| **Creativity & innovation** | 25% | 8-agent DAG with code-adjudicated judges, refine-Q clustering, hash-chained ledger, DB-persisted state machines | [JUDGE §2](JUDGE.md#2-creativity--innovation--25) |
| **Technical execution** | 20% | Idempotent state transitions, quadrature confidence math, Zod-validated tool_use, prompt-cached system prompts | [JUDGE §3](JUDGE.md#3-technical-execution--20) |
| **bunq integration** | 15% | RSA-SHA256 signing, 3-leg OAuth, sub-accounts, signed-webhook ingest, intra-user transfer | [JUDGE §4](JUDGE.md#4-bunq-integration--15) |
| **Pitch** | ~10% | One-pager `PITCH.md`, click-by-click `DEMO.md`, in-app `/presentation` deck | [JUDGE §5](JUDGE.md#5-pitch--10) |

[`JUDGE.md`](JUDGE.md) is the single-page **claim → file evidence → run-to-verify** map.
[`PITCH.md`](PITCH.md) is the 60-second narrative.
[`DEMO.md`](DEMO.md) is the click-by-click demo with expected screen output.

---

## bunq integration

Native bunq Business primitives end-to-end:

- **Signed API client** — RSA-SHA256 (`lib/bunq/signing.ts` + `lib/bunq/client.ts`).
- **3-leg auth** — installation → device → session.
- **Sub-accounts** — main + Carbo Reserve, created via API.
- **Webhook + signature verification** — every inbound transaction validated.
- **Intra-user transfer** — main → reserve, with structured description.

7 automation scripts under `scripts/bunq-*.ts`:

| Script | Purpose |
|---|---|
| `bunq:keygen` | Generate RSA keypair for signing |
| `bunq:sandbox-user` | Create sandbox user |
| `bunq:bootstrap` | Full install + device + session |
| `bunq:create-reserve` | Create the Carbo Reserve sub-account |
| `bunq:sugardaddy` | Seed sandbox balance |
| `bunq:backfill-notes` | Backfill historical descriptions |
| `bunq:register` | Register the webhook URL |

Defaults are safe (`BUNQ_MOCK=1`, `DRY_RUN=1`); flip one flag for live sandbox, no code changes.

---

## Architecture & agent docs (read first)

The reasoning layer is an **8-agent DAG** under `lib/agents/dag/`. Entry point: `POST /api/impacts/research`.

Read in this order before editing any agent:

1. [`docs/agents/00-overview.md`](docs/agents/00-overview.md) — DAG diagram, model split, authority boundaries, persistence tables, entry-point routes.
2. [`docs/architecture-comparison.md`](docs/architecture-comparison.md) — original-plan-vs-reality, drift section, parallel-path inventory, migration order.
3. The per-agent doc you're touching: [`docs/agents/01-spend-baseline.md`](docs/agents/01-spend-baseline.md) … [`07-executive-report.md`](docs/agents/07-executive-report.md), plus [`08-research.md`](docs/agents/08-research.md). Each contains the agent's full system prompt + I/O schema + gap-vs-current-code.
4. The relevant Forge spec under [`.forge/specs/`](.forge/specs/): `spec-baseline-agent.md` (shipped), `spec-dag-hardening.md` (next round — credit-strategy audit, mock-fallback observability, researchCache leakage fix, Annual Savings Forecaster, path consolidation, close-machine integration).
5. Cross-cutting research briefs in [`research/`](research/) — especially [`research/13-context-scaling-patterns.md`](research/13-context-scaling-patterns.md) (token budgets, chunking, prompt caching) and [`research/13-tax-savings-incentives.md`](research/13-tax-savings-incentives.md) (Dutch EIA/MIA/Vamil + EU ETS math feeding the credit strategy).

---

## Directory map

```
carbo/
├── app/                     Next routes — pages + API routes
│  └── api/impacts/          /api/impacts/research = canonical DAG runner
├── lib/
│  ├── agents/dag/           8-agent DAG (Baseline → … → Executive Report)
│  ├── agent/                onboarding suite, 12-state close machine, impact-analysis
│  ├── bunq/                 signed HTTP client, webhook verify, sub-accounts, payments
│  ├── classify/             rule-first + LLM-fallback merchant classifier + cache
│  ├── factors/              hardcoded spend-based factors (DEFRA / ADEME / Exiobase)
│  ├── emissions/            per-tx point + low/high + confidence; quadrature rollup
│  ├── policy/               Zod-validated policy DSL + evaluator
│  ├── credits/              simulated EU carbon-credit projects
│  ├── tax/                  EIA/MIA/Vamil + EU ETS math feeding credit strategy
│  ├── audit/                SHA-256 hash-chained append-only ledger
│  ├── anthropic/            Anthropic SDK wrapper + mock mode
│  └── impacts/              persistDagRun() — writes agentRuns + agentMessages
├── docs/                    architecture-comparison, agents/00-overview, per-agent docs
├── .forge/                  shared specs and task frontiers
├── research/                domain briefs that feed the agents (01..13)
└── scripts/                 migrate / seed / reset / bunq bootstrap / DAG smoke
```

---

<div align="center">

<br />

### **Built in 24 hours for bunq Hackathon 7.0**

<br />

[**▸ Watch the demo**](https://www.youtube.com/watch?v=7zTyIQmJTBk) · [Pitch](PITCH.md) · [Demo script](DEMO.md) · [Judge guide](JUDGE.md) · [Architecture](ARCHITECTURE.md) · [Design system](DESIGN.md) · [Agent docs](docs/agents/00-overview.md)

<sub>Made with care · Carbon-aware · Audit-grade</sub>

<br />

</div>
