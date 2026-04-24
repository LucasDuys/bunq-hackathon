# 06 -- Policy Engine DSL

_Status: stub. Lock in day 0._

## Decision

YAML rules loaded from `policy.yaml`. See `ARCHITECTURE.md` -> Policy engine for the shape.

## Why YAML over JSON

- Easier for judges and non-engineer stakeholders to read on screen.
- Supports comments, which we need in a demo ("# block A: food offsets").
- Trivially parsed with `js-yaml` in Node.

## Why not a small expression language

Writing an eval-safe DSL is a half-day distraction. YAML + a flat list of rules covers every use case in the demo script.

## Rule matching semantics

1. Rules are evaluated top-to-bottom.
2. First `match:` block whose conditions are all true wins the `action`.
3. `budget:` blocks are evaluated as side constraints -- any budget breach elevates the action to `draft-payment` requiring approval, regardless of what the winning rule said.
4. If no rule matches, default action is `skip` (no reserve, log only).

## Condition keys we support in MVP

- `category: food | travel | procurement | office | software`
- `kgco2e_above: <number>` -- gross CO2e threshold
- `amount_eur_above: <number>` -- transaction size threshold
- `leg: intercontinental | intra-eu | domestic` -- travel-specific
- `team: <string>` -- from the monetary account label

## Action values

- `offset` -- move the recommended amount into Carbon Reserve
- `offset_with_credit_preference: [<project_type>]` -- restrict which credits are eligible at month end
- `skip` -- no reserve
- `ask_user` -- push notification requesting explicit choice

## Approval values

- `auto` -- within autonomy ceiling, execute
- `manager` -- create a Draft Payment in bunq, push to manager
- `any_user` -- any authenticated user on the account can tap-to-approve

## Examples

See `ARCHITECTURE.md` -> Policy engine for a sample policy.yaml.

## Non-goals for hackathon

- Per-user policies (only per-account or per-team).
- Rule versioning.
- Rule editor UI (edit the YAML file by hand).

## Output shape

See `RESEARCH-INDEX.md` -> Research agent output format.
