# 09 -- Enterprise Ledger + Audit Trail

_Status: stub. Schema is in `ARCHITECTURE.md`; this file captures the "why"._

## Audit requirements (from CSRD limited-assurance regime)

An auditor must be able to answer, for any reserve or credit purchase:

- Where did the source number come from? (receipt image, OCR confidence, specific line item)
- Which emission factor was applied, and from which dated version of which source?
- Which policy rule fired, and what was the policy version at the time?
- Who (human or agent) made the final decision, and when?
- If an LLM was involved, what was its reasoning summary? (Not the full transcript -- a one-paragraph summary is enough.)
- What is the tamper-evidence story? (Hash chain? Signed rows?)

## Design choices

- **Hash every receipt on ingest** -- `sha256(image_bytes)`. Store the hash, not the image, in the audit column; store the image in object storage with the hash as the filename.
- **Snapshot the emission factor table** on every lookup -- store the factor value + source_name + source_version in the ledger row, not just a pointer.
- **Snapshot the policy file hash** on every decision -- so a rule change later cannot change the interpretation of a past decision.
- **Log the reasoning summary**, not the full model transcript -- summaries are auditable; full transcripts blow up storage and leak intermediate drafts.
- **Append-only** -- no updates to existing rows. Corrections are new rows that reference the corrected row's id.

## Tamper-evidence (stretch goal)

Hash-chain the ledger: each row includes `prev_row_hash`. Daily tree-root goes into a signed commit on a public repo. Overkill for the hackathon; mention as a roadmap slide.

## Reasoning summary prompt

When Claude makes a judgment call, we ask it to emit one paragraph of <=80 words explaining what it saw and why it decided. This paragraph is stored verbatim. At demo time, hovering over any ledger row renders the summary.

## Output shape

See `RESEARCH-INDEX.md` -> Research agent output format.
