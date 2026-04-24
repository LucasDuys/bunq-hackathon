# Cross-Cutting Learnings from bunq Hackathon 7 Research

What we learned from researching two complete concepts (Sentry + Ravel) with 5 parallel research agents across 18 domains. Intended as portable lessons for future hackathon runs and AI-heavy product research generally.

## Architecture patterns that generalize

### Classical-first, ML-second at MVP scale
Both concepts landed on the same verdict independently: skip ML-heavy paths when you don't have labeled data. 2024-2025 research consistently confirms hand-tuned rule-based approaches get ~80% of the value at a fraction of the complexity. Specific examples:

- Sentry signal fusion: hand-tuned weighted logistic + override rules beats learned temporal GNN at hackathon scale (3-5 hours vs weeks of labeling)
- Ravel graph COI: NetworkX + DuckDB recursive CTE for cycle detection beats GNN (no training data at SMB scale)
- Ravel entity resolution: Splink (Fellegi-Sunter, 1969) beats transformer-based record linkage when pairs are unlabeled

Lesson: default to the zero-training-data path. Only reach for the learned approach when you have labeled examples in hand.

### Research existing infrastructure before building detection
The biggest single research surprise: SurePay VoP (Verification of Payee) is EU-mandatory for every bank since October 2025. Sentry would have duplicated this check entirely if the research hadn't surfaced it. Lesson generalizes: always audit whether a problem has been solved at the infrastructure or regulatory layer before building a classifier. Public APIs, mandated checks, and industry standards often already exist for "the hard part."

### Late fusion composes, joint encoders need labeled data
For multimodal classification, both projects validated late fusion over joint encoders. Sentry phishing (CatBoost URL + CodeBERT HTML + ViT screenshot, fused late) and Ravel multi-signal alerting both showed: joint encoders need thousands of labeled examples; late fusion lets you stack off-the-shelf models trained on their native modalities and combine only at the decision layer. For non-FAANG orgs, late fusion is the default correct answer.

### Pseudonym envelopes beat fancy crypto for privacy-preserving LLM calls
FHE (Zama Concrete-ML: ~11 seconds per token on GPU, 4x data blow-up) is dead for real-time. Federated learning is operationally too complex for MVP. The pattern that actually ships in 2026:

1. Salted HMAC-SHA256 on identifiers (names, IBANs, emails)
2. Microsoft Presidio for PII detection + pseudonymization
3. Bucketed amounts (ranges, not exact values)
4. Quarter-coarsened dates
5. Trust boundary inspectable in DevTools network tab

This is the "pseudonym envelope" pattern. Reusable far beyond Ravel. The demo proof is three-layered: DevTools inspection, privacy audit panel, `sha256(envelope)` fingerprint logged for deterministic replay.

### LLM-as-judge with stance-aware calibrated confidence
Showed up in both projects as the classifier-of-2026 pattern. Emit `{label, confidence, reasoning}` with grammar constraints. Run stance pairs: "is this legitimate?" and "is this suspicious?" and check consistency. Surface low-confidence to the user as an explicit "needs your attention" state. Turns the most common AI failure mode (wrong-but-confident) into a product feature.

## 2026 stack choices to update your defaults

| Old default | 2026 winner | Why the flip |
|---|---|---|
| Cytoscape.js for graphs | sigma.js + graphology + WebGL | Cytoscape caps at 3-5k nodes (fCoSE blocks main thread); sigma does 10k+ live with ForceAtlas2 in a Web Worker |
| jina-embeddings-v3 | nomic-embed-text-v2-moe | jina is CC-BY-NC (commercial blocker); nomic is Apache-2.0 with Matryoshka dimension reduction |
| Full SSL front-ends for audio detection | AASIST-L alone (~1MB ONNX) | 85k params, browser-tractable via onnxruntime-web, under-200MB with huge headroom |
| Transformer-based ER | Splink on DuckDB | Zero training data required; LLM fallback only for borderline pairs |
| FHE for privacy-preserving RAG | HMAC + Presidio + pseudonym envelope | 300x faster, explicit trust boundary, demonstrable in DevTools |
| WASM-only browser ML | transformers.js v4 + WebGPU | ~4x BERT speedup over WASM; first production-ready year for browser ML |
| Cytoscape fCoSE layout | ForceAtlas2 in a Web Worker | Keeps UI responsive during layout; sigma ships this out of the box |

## Research methodology lessons

### Parallel research agents with strict templates are a force multiplier
Five agents writing 17 research files in ~8 minutes produced content equivalent to a 30-hour solo research task. The working pattern:

- One agent per domain cluster (3-4 related domains, not spread thin)
- Identical 9-section template per file (Summary / Key Concepts / How It Works / SOTA 2024-2026 / Use Cases / Feasibility / Tradeoffs / Recommended Approach / Sources)
- Priority-ranked current-year searches embedded in the prompt
- Explicit feasibility verdict per domain (green / yellow / red)
- Return a <400-word summary for the caller to synthesize

Saturation-test by looking for contradictions between parallel agents' findings. If two agents studying adjacent domains disagree on a shared fact, one is wrong.

### Current-year qualifiers in searches are non-negotiable
Without "2024" or "2025" anchoring, half the returns were stale benchmarks from 2022. This is why half the internet still recommends Cytoscape for graph viz: the 2018 advice won't get updated until the questioner names the year. Every search query should include a year qualifier.

### "No existing competitor" is a two-way signal
Ravel's "no one does hashed-envelope hybrid RAG for finance" was validated positive because every component exists and composition is tractable. In projects where "no competitor" pairs with "no open-source building blocks," that's a red flag, not an opportunity. Always test both sides of the gap before declaring a market opening.

### Real benchmarks kill vibes-based architecture decisions
The highest-value single research output across both concepts: "AASIST best EER is 7.6% with severe cross-dataset degradation." That sentence converted Sentry's deepfake-detection domain from GREEN handwave to YELLOW with concrete mitigation (pre-calibrate on the specific demo voice). Always demand numbers, not adjectives. If a research source says "state-of-the-art" without a benchmark score, keep looking.

## Hackathon-specific lessons

### Audit external-dependency signups before build day
PhishTank app-key approval takes hours. KVK developer portal is instant but requires a business account. OpenSanctions trial keys are business-email-gated. You lose 4 hours of a 24-hour sprint if you discover these at 19:00 on Day 0. Research agents should explicitly surface which external APIs require advance signup.

### "Minimum viable slice that still proves the architecture" is the right scoping question
Every domain research ended here. Instead of "here's the full 6-week build," the output was "here's the 3-5 hour slice that still demos the capability." Replacing aspiration-first scoping with slice-first scoping is the difference between shipping and flailing.

### Zero-training-data paths should be the default assumption at 24h scale
Research confirmed competitive zero-training paths exist for both projects (Sentry rules + LLM judge, Ravel Splink + classical graph + LLM narration). When the zero-data path exists, take it regardless of whether a learned approach would theoretically be "better" in a longer build. The training-data acquisition tax is the most underestimated cost in hackathon scoping.

### Compliance is a pitch artifact at hackathon scale, not product infrastructure
DORA, DAC8, GDPR, EU AI Act applicability = 1 hour of research + 1 pitch slide + 1 footer disclosure. Don't build consent pipelines, audit logging, or DPIA infrastructure at hackathon scope. Articulate compliance correctly in the pitch; don't implement it in code.

### Pre-calibrate the riskiest demo beat on the exact demo data
The deepfake detection warning isn't "train the model on more data"; it's "calibrate the threshold on the specific ElevenLabs voice used on stage." Most demo failures are calibration failures, not capability failures. Identify the single highest-risk moment in your demo and budget 30-60 minutes on Day -1 or Day 0 morning to tune it on the actual data you'll use live.

### Browser-first stacks make the privacy story more defensible
Sentry's detection in-browser and Ravel's embeddings in-browser both make the "no data left this machine" pitch inspectable in DevTools. Server-side inference cannot make this claim. When the product has a privacy angle, the default architecture decision should tilt toward browser-first even if server-side would be technically cleaner.

## Meta: the compounding effect of research templates

Zebra's research pattern (Summary / Key Concepts / How It Works / Tradeoffs / Recommended Approach / Sources) ported directly to bunq with zero modification. Same template, different domain. This compounds: each project that adopts the template contributes patterns that benefit the next. The format is low-taste and low-cost; its value is cumulative across projects.

The specific transfers from Zebra to bunq that paid immediate dividends:
- Article 14 (human oversight) framework from legal-AI directly applicable to Sentry's intervention ladder
- Article 50 (AI disclosure) pattern applicable to Sentry's voice-clone warning
- KVK integration approach directly applicable to Ravel's OSINT agent
- Parallel tool use patterns from Zebra's latency research applicable to both enrichment fan-outs
- Structured output formatting (schema-validated tool calls) directly applicable to all classifier outputs

Write research files as if a future project in an unrelated domain will need them. It will.

---

_Written 2026-04-24 after 5 parallel research agents completed 18 domain files. See per-concept appendices in `SENTRY-CONCEPT.md`, `RAVEL-CONCEPT.md`; research files in `research/{sentry,ravel}/`._
