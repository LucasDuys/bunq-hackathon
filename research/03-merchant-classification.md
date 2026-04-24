# 03 — Merchant classification

## Problem
Every bunq transaction gives us a raw counterparty display name and maybe a description. We need to get it into the right (category, sub-category) bucket cheaply, accurately, and repeatably — because spend-based emissions are only as good as the bucket.

## Key facts
- **MCC codes (Merchant Category Codes)** exist in card network data but are **not directly exposed** by bunq's Payment object. Some payment types carry `counterparty_alias.merchant_category_code` or similar, but it's unreliable. bunq gives us `counterparty_alias.display_name` and free-text `description` — that's the honest raw material.
- **Rule-first, LLM-fallback** is the standard pattern:
  - Rules are cheap, deterministic, auditable. Most business merchants repeat (AWS, KLM, AH) — a rule table of ~50 regexes covers 70–85%.
  - LLM (Haiku) handles the long tail. One call per *new* merchant, cached by normalized name.
- **Normalization** matters: lowercase, collapse spaces, strip corporate suffixes (BV, Inc, GmbH) and transaction-specific cruft (`*1411`, `NL `). Then key the cache by the normalized form so "AH 1411" and "AH 2201" share a bucket.
- **Confidence coming out of the classifier** should be calibrated: rule matches tend to be binary (0.9+), LLM fallback outputs its own score (use it but soft-cap at 0.85 since LLMs are overconfident in the 0.9–1.0 range).
- **LLM prompting**: force structured JSON output (Zod schema) with `{category, subCategory, confidence, rationale}`. Include the full allowed category/sub-category list in the system prompt. Short prompt; Haiku 4.5 handles this easily with <300 output tokens.

## Gotchas
- "Amazon" is the canonical ambiguous case — could be AWS (cloud) or Amazon retail (procurement). Rule gives low-confidence match (0.4); LLM often can't resolve without description; it's meant to fall into the refinement-questions bucket.
- "Services" and "consultancy" merchants are genuinely ambiguous by category family. Usually procurement vs services; the sub-category is even harder.
- Currency-coded corporate names (e.g. "XYZ Payments") triggered false positives — ensure rules anchor with `\b` and don't match inside longer words.
- Caching is crucial. Without it, every run re-classifies every merchant — at scale that's thousands of LLM calls per month.

## Design choices
- `lib/classify/rules.ts`: ~50 rules, each a regex with (category, subCategory, confidence). First-match-wins in declared order.
- `lib/classify/merchant.ts`: cache lookup → rules → LLM. Cache source recorded (`rule | llm | refinement`).
- Refinement (user answered a question) **overwrites** the cache entry with `source: refinement`, `confidence: 0.95`. Subsequent webhook ingests from the same merchant skip both rules and LLM.
- If `ANTHROPIC_MOCK=1`, LLM returns `other/null/0.4` — these merchants fall into the agent's uncertainty clusters, which is correct demo behavior.

## Decisions for this build
- No dependency on MCC codes.
- Rules first at confidence ≥ 0.85 threshold; anything below falls to LLM.
- Cache by normalized merchant in `merchant_category_cache` (Postgres/SQLite row).
- LLM model: Haiku 4.5 (cheap, fast, sufficient). Sonnet is reserved for the monthly reasoning pass, not per-tx classification.
