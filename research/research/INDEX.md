# Research Index — ZebraLegal AI Onboarding

> 24+ research documents across 8 domains. Rescoped from a prior agent project for the ZebraLegal onboarding build. Generic agent research (01–05) is kept verbatim; project-specific research (06–08) is written for this project.

---

## For the AI Agent Reading This

**You are Claude Code. This file is your navigation guide. Follow these rules:**

1. **Do not ask the user which file to read.** When given a task, determine the relevant domain from the table below, read the specific file, then act on its recommendations directly.

2. **Task → Domain mapping:**
   - "add evaluation / detect bad drafts / flag hallucinations" → `04-evaluator-and-output-validation/inline_vs_async_evaluation.md` then `guardrails_and_output_filtering.md`
   - "reduce latency / briefing takes 40s" → `02-agent-latency-and-performance/parallel_tool_use.md` then `latency_tradeoffs.md`
   - "update/improve a system prompt" → `03-prompting-guides/system_prompt_best_practices.md` then `anthropic_official_prompting.md`
   - "schema for proposal / tool use" → `03-prompting-guides/tool_use_prompting_patterns.md` then `05-structured-output/structured_output_formatting.md`
   - "which model for this step" → `03-prompting-guides/opus_vs_sonnet_differences.md`
   - "prompt caching / template library size / fee taxonomy" → `01-agent-context-and-scale/context_window_management.md` then `scale_tradeoffs.md`
   - "EU AI Act / Article 14 / Article 50 / high-risk?" → `06-compliance/article-14-human-oversight.md`, `article-50-transparency.md`, `annex-iii-high-risk-assessment.md`
   - "NOvA / Dutch bar rules / confidentiality" → `06-compliance/nova-advocaten-overlay.md`
   - "DPIA / GDPR" → `06-compliance/gdpr-dpia-for-legal-ai.md`
   - "Graph webhook / Power Automate / integration backbone" → `07-ms365-integration/graph-vs-power-automate.md`
   - "Outlook add-in / Word taskpane" → `07-ms365-integration/office-js-add-in-patterns.md`
   - "CRM / SharePoint List extension / Matter dashboard" → `07-ms365-integration/sharepoint-list-as-crm.md`
   - "Dutch legal prose / tone calibration / few-shot" → `08-legal-domain/dutch-legal-prose-calibration.md`
   - "engagement letter structure" → `08-legal-domain/engagement-letter-structure.md`
   - "KvK / Dutch trade register" → `08-legal-domain/kvk-handelsregister-integration.md`

3. **When implementing from research:** Start with the "Recommended Approach for This Project" section if present. Then read "How It Works" for the implementation detail.

4. **Cross-references:**
   - Top-level docs: `../PROPOSAL.md`, `../ARCHITECTURE.md`, `../CLAUDE.md`, `../soul.md`
   - Client source-of-truth artifacts: `../client-artifacts/` (engagement letters, intake form, client brief)
   - Meeting notes: `../meeting-notes/`
   - Workflow docs: `../docs/` (lead turnover, contact routing, urgency framework)

5. **Known constraints (do not re-investigate — these are decided):**
   - Claude via AWS Bedrock `eu-central-1` (Frankfurt) for EU data residency
   - Microsoft Graph direct (not Power Automate — new-email trigger deprecated)
   - Partner review on every outbound — enforced in pipeline, no bypass
   - TypeScript end-to-end; Python only for the docxtpl renderer
   - SharePoint Matters List is the visible source of truth

6. **Known open questions (require ZebraLegal input):**
   - LinkedIn scraping legality
   - Urgency-flagging criteria
   - Phone/VoIP software name
   - Redirect list for non-lead traffic
   - E-signature platform (DocuSign vs Evidos vs Syntex)
   - Teams Premium licence scope

---

## Domain Summaries

### 01 — Agent Context & Scale
How to load structured datasets (fee taxonomy, template library, past matters) into a Claude agent efficiently. Covers RAG, context window limits, hierarchical chunking, and prompt-cache tiering. Directly relevant to our decision to use fat-context + 1-hour TTL caching over vector RAG until the template corpus grows past ~200k tokens.

| File | Description |
|------|-------------|
| [RAG_and_retrieval_patterns.md](01-agent-context-and-scale/RAG_and_retrieval_patterns.md) | RAG architecture, when to use vs full context, LangChain/LlamaIndex |
| [context_window_management.md](01-agent-context-and-scale/context_window_management.md) | Token limits per model, prompt caching, compression techniques |
| [large_dataset_chunking_strategies.md](01-agent-context-and-scale/large_dataset_chunking_strategies.md) | Hierarchical summarisation, map-reduce, flat chunking with metadata |
| [scale_tradeoffs.md](01-agent-context-and-scale/scale_tradeoffs.md) | Full context vs RAG vs hierarchical summary vs lazy retrieval |

### 02 — Agent Latency & Performance
Pipeline instrumentation (LangSmith, OpenTelemetry), parallel vs sequential tool calls, token-to-latency physics. Directly relevant to our claim that parallel tool use saves 9–22s on the Briefing Researcher.

| File | Description |
|------|-------------|
| [benchmarking_llm_pipelines.md](02-agent-latency-and-performance/benchmarking_llm_pipelines.md) | OpenTelemetry, LangSmith, Langfuse instrumentation |
| [parallel_tool_use.md](02-agent-latency-and-performance/parallel_tool_use.md) | Parallel tool calls, LangGraph fan-out, 9-22s savings estimate |
| [observability_and_tracing.md](02-agent-latency-and-performance/observability_and_tracing.md) | LangSmith trace analysis, slow-run patterns, monitoring rules |
| [latency_tradeoffs.md](02-agent-latency-and-performance/latency_tradeoffs.md) | Token/latency benchmarks, model pricing, optimisation plans |

### 03 — Prompting Guides
Anthropic's official guide, Opus-vs-Sonnet, tool-use patterns, leakage prevention. Directly relevant to every agent prompt we write, the tiered-routing decision (Haiku/Sonnet/Opus), and the Zod-schema-validated tool-call contract.

| File | Description |
|------|-------------|
| [anthropic_official_prompting.md](03-prompting-guides/anthropic_official_prompting.md) | Full summary of Anthropic's prompt engineering guide |
| [opus_vs_sonnet_differences.md](03-prompting-guides/opus_vs_sonnet_differences.md) | Cross-model comparison, per-agent tuning advice |
| [tool_use_prompting_patterns.md](03-prompting-guides/tool_use_prompting_patterns.md) | Tool definition design, controlling calls, error handling |
| [system_prompt_best_practices.md](03-prompting-guides/system_prompt_best_practices.md) | 4-layer leakage prevention, few-shot formatting, CoT tradeoffs |

### 04 — Evaluator & Output Validation
LLM-as-judge, Guardrails AI, RAGAS/DeepEval, hybrid inline+async evaluation. Directly backs our hybrid eval architecture (inline regex/schema + async Haiku judge at ~€90/month).

| File | Description |
|------|-------------|
| [llm_as_judge_pattern.md](04-evaluator-and-output-validation/llm_as_judge_pattern.md) | MT-Bench, assessment modes, bias types, OpenEvals |
| [guardrails_and_output_filtering.md](04-evaluator-and-output-validation/guardrails_and_output_filtering.md) | Guardrails AI, NeMo, regex/keyword/ML, <2ms short-circuit |
| [ragas_and_evaluation_frameworks.md](04-evaluator-and-output-validation/ragas_and_evaluation_frameworks.md) | RAGAS, DeepEval, LangSmith, 5 core metrics |
| [inline_vs_async_evaluation.md](04-evaluator-and-output-validation/inline_vs_async_evaluation.md) | Hybrid architecture, latency analysis, cost estimate |

### 05 — Structured Output
How to make the agent emit validated JSON for downstream tools and keep prose out of machine paths (and vice versa). Directly relevant to the `ProposalDraft` schema handoff from Transcript Structurer → Opus drafter → docxtpl.

| File | Description |
|------|-------------|
| [avoiding_raw_json_in_responses.md](05-structured-output/avoiding_raw_json_in_responses.md) | Prevention strategies, prompt templates for separation of structured vs natural output |
| [structured_output_formatting.md](05-structured-output/structured_output_formatting.md) | Internal structured output vs external natural language, strict mode |
| [response_transformation_patterns.md](05-structured-output/response_transformation_patterns.md) | Transformation patterns, result-processor node, phased rollout |

### 06 — Compliance (EU AI Act, NOvA, GDPR) — NEW
Everything we have to defend before Bastiaan and before 2 August 2026. Article 14, Article 50, why we're not high-risk, NOvA advocaten rules, GDPR DPIA scope.

| File | Description |
|------|-------------|
| [article-14-human-oversight.md](06-compliance/article-14-human-oversight.md) | What Article 14 requires, why it's advisory (not mandatory) for us, how we honour it anyway |
| [article-50-transparency.md](06-compliance/article-50-transparency.md) | Four sub-paragraphs, which trigger, disclosure design in practice |
| [annex-iii-high-risk-assessment.md](06-compliance/annex-iii-high-risk-assessment.md) | Why our onboarding AI is not high-risk under Annex III §8 |
| [nova-advocaten-overlay.md](06-compliance/nova-advocaten-overlay.md) | Dutch bar confidentiality + care duty, how HITL satisfies it |
| [gdpr-dpia-for-legal-ai.md](06-compliance/gdpr-dpia-for-legal-ai.md) | DPIA scope, Article 22, DPA checklist for Anthropic + AWS + Microsoft |

### 07 — Microsoft 365 Integration — NEW
Graph API vs Power Automate, Office.js taskpane patterns, SharePoint as CRM.

| File | Description |
|------|-------------|
| [graph-vs-power-automate.md](07-ms365-integration/graph-vs-power-automate.md) | Why Graph direct, why Power Automate's new-email trigger is disqualifying, Logic Apps comparison |
| [office-js-add-in-patterns.md](07-ms365-integration/office-js-add-in-patterns.md) | Outlook + Word taskpane architecture, Fluent UI, state sync |
| [sharepoint-list-as-crm.md](07-ms365-integration/sharepoint-list-as-crm.md) | Matters List schema, Kanban web part (SPFx), Contacts + Activities + Tasks extension |

### 08 — Legal Domain — NEW
Dutch legal prose, engagement-letter structure, KvK integration. Client artifacts live in `../client-artifacts/` and get analysed here.

| File | Description |
|------|-------------|
| [dutch-legal-prose-calibration.md](08-legal-domain/dutch-legal-prose-calibration.md) | Few-shot calibration from real templates, tone transfer, language-switch handling |
| [engagement-letter-structure.md](08-legal-domain/engagement-letter-structure.md) | Structural analysis of the NL + EN templates, required clauses, variable fields |
| [kvk-handelsregister-integration.md](08-legal-domain/kvk-handelsregister-integration.md) | Dutch trade register API, cost, what we pull, legal basis |

---

## Start Here — By Project Phase

### Phase 1 (weeks 1–2): Scoping + compliance + infrastructure
1. [06-compliance/article-14-human-oversight.md](06-compliance/article-14-human-oversight.md) — anchor the compliance posture
2. [06-compliance/gdpr-dpia-for-legal-ai.md](06-compliance/gdpr-dpia-for-legal-ai.md) — DPIA scope for week-3 deliverable
3. [07-ms365-integration/graph-vs-power-automate.md](07-ms365-integration/graph-vs-power-automate.md) — lock the integration backbone
4. [01-agent-context-and-scale/scale_tradeoffs.md](01-agent-context-and-scale/scale_tradeoffs.md) — confirm fat-context over RAG

### Phase 2 (weeks 3–6): Intake + briefing
1. [02-agent-latency-and-performance/parallel_tool_use.md](02-agent-latency-and-performance/parallel_tool_use.md) — enable parallel web sub-agents
2. [03-prompting-guides/tool_use_prompting_patterns.md](03-prompting-guides/tool_use_prompting_patterns.md) — Zod-backed tool contracts
3. [08-legal-domain/kvk-handelsregister-integration.md](08-legal-domain/kvk-handelsregister-integration.md) — wire Dutch trade register

### Phase 3 (weeks 7–10): Proposal + letter
1. [08-legal-domain/engagement-letter-structure.md](08-legal-domain/engagement-letter-structure.md) — calibrate the templates
2. [08-legal-domain/dutch-legal-prose-calibration.md](08-legal-domain/dutch-legal-prose-calibration.md) — few-shot from real letters
3. [05-structured-output/structured_output_formatting.md](05-structured-output/structured_output_formatting.md) — `ProposalDraft` schema handoff
4. [03-prompting-guides/opus_vs_sonnet_differences.md](03-prompting-guides/opus_vs_sonnet_differences.md) — confirm Opus-for-drafting decision

### Phase 4 (weeks 11–12): Hardening + handover
1. [04-evaluator-and-output-validation/inline_vs_async_evaluation.md](04-evaluator-and-output-validation/inline_vs_async_evaluation.md) — deploy eval layer
2. [04-evaluator-and-output-validation/guardrails_and_output_filtering.md](04-evaluator-and-output-validation/guardrails_and_output_filtering.md) — regex + LLM guards
3. [06-compliance/article-50-transparency.md](06-compliance/article-50-transparency.md) — finalise transparency disclosures
4. [07-ms365-integration/sharepoint-list-as-crm.md](07-ms365-integration/sharepoint-list-as-crm.md) — Matters dashboard web part
