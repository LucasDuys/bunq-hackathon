# DORA, DAC8, GDPR, and the EU AI Act for Ravel

## Summary

Ravel is a B2B financial-data SaaS that ingests a customer company's bunq + Stripe + Gmail + contracts and emits conflict-of-interest findings. Four regulations could plausibly bind it in 2026: DORA (operational resilience for financial-sector supply chains), DAC8 (crypto-asset reporting), GDPR (personal data in business data), and the EU AI Act (risk-tier classification). This file argues: DORA applies contractually via Ravel's financial-sector customers and is manageable through standard DORA contract clauses; DAC8 does not apply because Ravel is neither a Reporting Crypto-Asset Service Provider nor a digital-platform seller; GDPR triggers a DPIA at scale because we process employee names at the start of a new customer relationship; the AI Act classifies Ravel as low-risk, voluntarily building to Article 14 and Article 50.

This borrows heavily from the ZebraLegal research `06-compliance/*.md`. Where a mechanic is fully worked through there (Article 22, DPIA structure, Annex III reasoning, Article 50 sub-paragraphs), this file references and adapts rather than restates.

---

## Key Concepts

- **ICT third-party service provider (DORA)**: any vendor providing "digital and data services" on an ongoing basis to a financial entity. Includes SaaS. Ravel, sold to financial-sector customers, is one.
- **Critical ICT third-party service provider (DORA)**: a small subset of ICT vendors designated by the European Supervisory Authorities as systemically important. Ravel is not one and will not be for the foreseeable future.
- **Reporting Crypto-Asset Service Provider (DAC8)**: a regulated crypto-asset service provider operating in or serving EU residents. Ravel does not custody, exchange, or transfer crypto-assets.
- **DPIA (GDPR Art. 35)**: mandatory where processing is "likely to result in a high risk to rights and freedoms of natural persons." Ingesting employee names across bank + email + contracts is systematic large-scale processing that arguably triggers it.
- **Annex III (AI Act)**: the list of high-risk AI system categories. None cleanly cover Ravel.
- **Article 14 (AI Act)**: human oversight, binding only for high-risk systems. Advisory for Ravel, followed voluntarily.
- **Article 50 (AI Act)**: transparency obligations, binding for all AI regardless of tier. Very light for Ravel.

---

## How It Works

### DORA — does Ravel qualify as an ICT service?

Yes, by text. DORA's definition of "ICT services" covers "digital and data services provided through ICT systems to one or more internal or external users on an ongoing basis". SaaS fits squarely. Once Ravel sells to any financial-sector customer (bank, insurer, investment firm, crypto-asset service provider, pension fund — all "financial entities" under DORA Art. 2), that customer's contract with Ravel must include the DORA-mandated clauses: service description, data processing location, termination + exit rights, audit rights, incident notification, subcontracting controls.

What Ravel is **not**: a "critical ICT third-party service provider". Those are designated by the ESAs based on systemic importance, customer concentration, and substitutability. A 2026-vintage hackathon product does not qualify. If Ravel ever hits critical-ICT scale, the regulatory burden jumps significantly (direct ESA oversight, EU-based representative, penetration testing regime).

**What this means for the pitch:** Ravel's customers handle the bulk of DORA compliance; Ravel ships the contract clauses. The genuine work for Ravel as a vendor is: (a) an ICT incident reporting flow (we notify customer within N hours of any breach), (b) a documented exit / data-portability capability, (c) security controls documentation. None of this blocks a 24-hour demo, but it must be named in the pitch's compliance slide.

### DAC8 — does Ravel need to report anything?

No. DAC8 applies to crypto-asset service providers (exchanges, brokers, custodians, wallet providers, token issuers) operating in or serving EU residents. It mandates reporting of crypto-asset transactions from 1 January 2026. First reports due by 31 January 2027.

Ravel ingests financial transaction metadata from bunq (fiat bank), Stripe (fiat payment processor), email invoices, and contracts. It does not facilitate, custody, or broker crypto-asset transactions. It is not an RCASP. DAC8 imposes no reporting obligation on Ravel.

What Ravel **might** do: if a customer's bunq or Stripe data surfaces crypto-related counterparties, Ravel's findings can flag the relationship, but flagging is not reporting under DAC8. The flag is intelligence for the customer's own compliance team.

**Sentence for the pitch:** "DAC8 is a hot topic but does not bind Ravel — we don't transact crypto-assets. Our customers handle their own DAC8 reporting; Ravel surfaces the underlying relationships they might need to disclose."

### GDPR — DPIA scope and lawful basis

Ravel ingests employee names embedded in business financial data (invoices mention "Sarah Klein, CFO of Vendor Y", expense records attribute "taxi, March 14, employee: Jan de Vries", email contracts include signatories). These are personal data. The data subjects are the customer's employees plus third-party directors / counterparties mentioned incidentally in the data.

**Lawful basis (reusing ZebraLegal's GDPR framing):**
- Art. 6(1)(b) contractual necessity — the customer contracted Ravel to audit their own books.
- Art. 6(1)(f) legitimate interest — for third-party counterparty names pulled from public registries + invoices.
- Art. 6(1)(c) legal obligation — where the customer uses Ravel findings to satisfy their own Wwft / AML / audit obligations.

**DPIA is required.** Per ZebraLegal `06-compliance/gdpr-dpia-for-legal-ai.md`, Article 35 mandates a DPIA when processing is likely to result in high risk. Ravel meets the threshold on three independent counts: (1) systematic and large-scale processing (entire financial tail of a company), (2) new technology (LLM + local embeddings), (3) data about vulnerable individuals if it incidentally surfaces whistleblowers or people under investigation. See that ZebraLegal file for the extended analysis of DPIA content (systematic description, necessity + proportionality, risk assessment, mitigations, residual risk, consultation record).

**Ravel-specific DPIA angle that differs from ZebraLegal:** Ravel's local-first architecture is itself a primary mitigation. Raw names never leave the customer's machine; only hashed tokens and structural relationships reach Claude. The DPIA narrative lands cleanly: "processing is high-risk; our architecture reduces residual risk to low because the cloud inference pathway never sees personally identifying content in cleartext."

### GDPR Article 22 — automated decision-making

Does Ravel make "decisions based solely on automated processing which produce legal effects or similarly significantly affect" an individual?

Short answer: **No, if we design the UX correctly.** Longer answer mirrors ZebraLegal `article-14-human-oversight.md`: every Finding is a suggestion with severity and evidence, escalated to a human partner (the CFO, the compliance officer, the auditor). Ravel never auto-fires an employee, auto-cancels a vendor, auto-closes an account.

The risk path: if a customer auto-routes "Severity: High" findings to a "suspend vendor" workflow without a human in the loop, that pipeline could trigger Article 22. **Mitigation for Ravel's UX**: every Finding-actionable UI requires an explicit human click. The audit log records the actor.

### EU AI Act — Annex III high-risk test

Ravel is **not high-risk under Annex III**. The reasoning mirrors ZebraLegal's `annex-iii-high-risk-assessment.md`, adapted to Ravel's domain:

Annex III enumerates high-risk areas. The ones closest to Ravel and why each fails:

1. **§5(b) "creditworthiness of natural persons"** — Ravel doesn't score individuals for credit. It scores transaction relationships. No trigger.
2. **§5(c) "insurance risk assessment and pricing for natural persons"** — not applicable.
3. **§4(a) "employment, workers management" — recruitment / promotion / task allocation decisions** — Ravel surfaces COI between employees and vendors; it doesn't recruit, promote, or allocate tasks. If a customer uses a Finding to fire an employee, that's the customer's HR decision, not Ravel's. Analogous to ZebraLegal's "the partner decides, the AI drafts" reasoning.
4. **§6 "law enforcement"** — not applicable, private-sector product.
5. **§8(a) "administration of justice"** — not applicable, same reasoning as ZebraLegal: Ravel is sold to private companies, not judicial authorities.
6. **§3(a) "education — admission, evaluation"** — not applicable.

Ravel is therefore **limited-risk / minimal-risk**. Transparency obligations under Article 50 still apply (see below); Article 14 (human oversight) is advisory only.

**Monitoring trigger:** if Ravel ever adds an "automated remediation" path that directly adjusts credit limits, employment status, or insurance terms for individuals, the Annex III analysis must be redone.

### EU AI Act — Article 14 human oversight

Advisory, not mandatory for Ravel. Followed voluntarily for three reasons (adapted from ZebraLegal `article-14-human-oversight.md`):

1. **Customer indemnity posture.** Ravel's customers will be nervous about AI-driven COI accusations. HITL reduces their liability and ours.
2. **Professional-services alignment.** Big 4 auditors are the prior art for COI detection. They operate under strict HITL conventions. Ravel has to match or exceed.
3. **Future-proofing.** If Annex III is revised to cover adjacent AI-for-auditing, we're already compliant.

See ZebraLegal's Article 14 file for the full requirements-to-implementation mapping table. Ravel's version of that mapping:

| Article 14 requirement | Ravel implementation |
|---|---|
| Human-machine interface for oversight | Finding cards with evidence, severity, and "Investigate / Dismiss / Escalate" buttons |
| Understand capacities/limits | Onboarding tutorial explicit about false-positive rate for each finding type |
| Monitor operation | LangSmith traces per audit pipeline run |
| Automation bias awareness | Findings always say "possible COI", never "confirmed COI"; UX forces user to open evidence panel before dismissing or escalating |
| Stop function | Per-connector pause toggle; emergency "pause all ingestion" button on workspace settings |
| Training for overseers | Short in-app walkthrough + a PDF playbook |

### EU AI Act — Article 50 transparency

Per ZebraLegal `article-50-transparency.md`, Article 50 applies regardless of risk tier. Four sub-paragraphs and Ravel's mapping:

- **50(1) interactive AI disclosure** — If a user chats with Ravel's agent via a chat UI, we show "you're chatting with Ravel's AI assistant". Trivial banner.
- **50(2) synthetic content marking** — Anthropic's obligation (they provide the model). Ravel doesn't generate public-facing synthetic text.
- **50(3) emotion recognition / biometric categorisation** — not applicable.
- **50(4) deepfakes / AI-generated public-interest text** — not applicable. Findings are private to the customer.

Ravel's actual action item: a short disclosure on every Finding card — "generated by Ravel's AI review". Two lines in the footer.

---

## Current Regulatory State (2024–2026)

- **DORA**: fully applicable since 17 January 2025. Financial-entity customers are already asking their SaaS vendors for DORA clauses. Standard contract template is stable.
- **DAC8**: enters force 1 January 2026 for transactions. First reports due 31 January 2027 for the 2026 reporting year. Penalties EUR 20k–500k. All outside Ravel's scope.
- **GDPR**: stable since 2018. Dutch AP and EDPB continue to publish sector-specific DPIA guidance; no 2026 breaking change.
- **EU AI Act**: risk-tier rules binding from 2 August 2026. Ravel ships before that date but must be compliant by then. Article 50 transparency + (voluntarily) Article 14 oversight baked in from day one.

---

## Use Cases for Ravel

This domain doesn't have product use cases the way others do. Instead, it has pitch-level uses:

1. **Compliance slide in the pitch deck**: one slide saying "We thought about DORA, DAC8, GDPR, AI Act. Here's our one-sentence position on each."
2. **Customer sales enablement**: a 2-page "Ravel and DORA" brief for procurement teams.
3. **Q&A ammunition**: when a judge or customer asks "is this high-risk AI?", we answer precisely with Annex III sub-paragraphs, not waving hands.
4. **DPIA template**: lifted from ZebraLegal, adapted. We ship one template DPIA with Ravel that customers can fill in for their own processing.

---

## Feasibility for a 24-hour Hackathon

Trivially feasible as a document exercise; not a product build.

- **Ship in the demo**: a "Compliance" slide, a Finding-card transparency footer line, a manual "pause" toggle (already in connector settings).
- **Ship after the demo, if we move to pilots**: the DPIA template, the DORA contract addendum, a GDPR data-processing agreement template.
- **Don't ship now**: any formal certification, any "AI compliant" marketing claims. We build to the law; we don't market it.

Risk: overclaiming. The one bad outcome here is telling a judge "we're fully DORA compliant" when DORA compliance is principally the customer's obligation. The correct framing is "we ship the clauses our customers need; we are not and do not claim to be a critical ICT third-party service provider."

---

## Tradeoffs

| Decision | Alternative | Why |
|---|---|---|
| Argue Ravel is low-risk under Annex III | Argue Ravel is high-risk and over-comply | Overclaiming invites a compliance burden we don't need to carry; Annex III text doesn't cover us. Mirrors ZebraLegal's "don't gold-plate" posture. |
| Build HITL into the UX voluntarily | Skip it because Article 14 doesn't bind us | Professional-services-adjacent buyers expect HITL; architectural cost is trivial. |
| Ship a template DPIA | Leave DPIA to customers | Customers will demand it in procurement; pre-writing it is a sales accelerator. |
| No DAC8 integration | Add DAC8 reporting capability | Out of scope. We don't touch crypto-assets. Adding DAC8 code would be security theatre. |
| Hashed-token LLM path as GDPR mitigation | Full cloud RAG on cleartext | The hashed-token architecture is simultaneously the product moat and the GDPR high-risk mitigation. Double duty. |

---

## Recommended Approach for the Hackathon

1. **Day 0**: copy the ZebraLegal DPIA structure into `research/ravel/09-dpia-template.md` (not covered in this file — separate deliverable). One page, fillable.
2. **Day 0**: add a one-slide compliance overview to the pitch deck with the four regulations + one-sentence position on each.
3. **Day 0**: add an "AI-generated by Ravel" footer to every Finding card in the UI.
4. **Day 0**: verify the UX has no automated-action paths. Every "dismiss", "escalate", "investigate" is a human click.
5. **Day 1 Q&A prep**: rehearse the Annex III argument. Be ready to cite sub-paragraphs 3(a), 4(a), 5(b), 5(c), 6, 8(a) and why each fails for Ravel. See ZebraLegal file for the pattern.

---

## Sources

- [DORA at EIOPA — Digital Operational Resilience Act](https://www.eiopa.europa.eu/digital-operational-resilience-act-dora_en)
- [DORA in 2026: What it means for SaaS vendors — Usecure](https://blog.usecure.io/dora-what-the-eus-cyber-resilience-law-means-for-saas-vendors-and-their-financial-sector-customers)
- [Classification of ICT third-party providers under DORA — Noerr](https://www.noerr.com/en/insights/classification-of-it-service-providers-under-dora)
- [DORA Regulation from an ICT service provider's perspective — Osborne Clarke](https://www.osborneclarke.com/insights/dora-regulation-ict-service-providers-perspective)
- [DAC8 — European Commission Taxation and Customs Union](https://taxation-customs.ec.europa.eu/taxation/tax-transparency-cooperation/administrative-co-operation-and-mutual-assistance/directive-administrative-cooperation-dac/dac8_en)
- [DAC8 and CARF reporting challenges — RSM](https://rsmus.com/insights/tax-alerts/2025/dac8-and-carf-present-extensive-reporting-challenges-for-crypto-platforms.html)
- [GDPR full text — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [Article 22 GDPR — automated individual decision-making](https://gdpr-info.eu/art-22-gdpr/)
- [Article 35 GDPR — DPIA](https://gdpr-info.eu/art-35-gdpr/)
- [EU AI Act Annex III — high-risk systems](https://artificialintelligenceact.eu/annex/3/)
- [EU AI Act Article 14 — human oversight](https://artificialintelligenceact.eu/article/14/)
- [EU AI Act Article 50 — transparency](https://artificialintelligenceact.eu/article/50/)
- ZebraLegal: `C:\dev\zebralegal-proposal\research\06-compliance\gdpr-dpia-for-legal-ai.md`
- ZebraLegal: `C:\dev\zebralegal-proposal\research\06-compliance\article-14-human-oversight.md`
- ZebraLegal: `C:\dev\zebralegal-proposal\research\06-compliance\annex-iii-high-risk-assessment.md`
- ZebraLegal: `C:\dev\zebralegal-proposal\research\06-compliance\article-50-transparency.md`
