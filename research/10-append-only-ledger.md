# 10 — Append-only ledger

## Problem
Every state transition, external call, and policy decision must be traceable for CSRD defensibility and internal auditability. A naive INSERT into a log table is silently editable — not enough. Need tamper-evidence.

## Key facts
- **Hash chain** is the simplest tamper-evident structure: each event stores `hash = SHA256(prev_hash || actor || type || payload || created_at)`. Changing any past event changes its hash, which breaks all subsequent hashes.
- **Merkle trees** are overkill for linear logs; we're not generating compact proofs for third parties.
- **Database-level enforcement**:
  - Postgres: `CREATE RULE blocking UPDATE/DELETE`, or `BEFORE UPDATE / BEFORE DELETE` triggers that `RAISE EXCEPTION`, or revoke UPDATE/DELETE privileges from app role.
  - SQLite: `CREATE TRIGGER ... BEFORE UPDATE/DELETE ... BEGIN SELECT RAISE(ABORT, ...); END;`
- **Assurance workflow** (out of scope): periodically hash the latest event with a timestamp authority (e.g. OpenTimestamps) or commit to a public chain. Gives cryptographic third-party assurance. Stretch.

## What we store per event
| field | note |
|---|---|
| `actor` | `webhook`, `agent`, `user`, or `system` |
| `type` | verb-like string, e.g. `close.start`, `refinement.answered`, `action.reserve_transfer` |
| `payload` | JSON blob with the interesting bits |
| `prev_hash` | hex sha256 of the previous row's `hash` (for first row, `0×64`) |
| `hash` | hex sha256 of `(prev_hash, actor, type, payload, created_at)` |
| `close_run_id` | nullable FK to `close_runs` for close-scoped filtering |

## Invariants
- `prev_hash` = previous row's `hash` in insertion order (per-org; cross-org chains aren't linked).
- `hash` is recomputable from the other fields.
- `UPDATE` and `DELETE` are blocked by trigger; breaking the chain requires breaking the DB.

## Verification
`verifyChain(orgId)` walks rows in id order and recomputes hashes. Returns `{valid, brokenAtId?}`. The ledger page shows this badge live.

## Decisions for this build
- SHA-256, hex-encoded, single chain per org.
- Trigger-based UPDATE/DELETE block on `audit_events` table.
- Every state transition, every bunq call, every user decision gets an event.
- Chain verification is O(n) on ledger page load; acceptable for hackathon.
- Future: periodic OpenTimestamps anchoring for third-party assurance.
