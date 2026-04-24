# bunq API -- endpoints Carbon Reserve uses

Trimmed from the prior-round research in `C:\dev\bunq-hackathon\README.md`. This file only lists what we actually touch for the carbon loop. Full API sitemap: <https://doc.bunq.com/sitemap.md>.

## Auth pipeline (do on Day 0, first 2 hours)

1. **Installation** (`POST /installation`) -- register client public key, receive server public key.
2. **Device Server** (`POST /device-server`) -- register device + allowed IPs.
3. **Session Server** (`POST /session-server`) -- open authenticated session.
4. **RSA signing** on every request body; verify response signatures.
5. Cache the context on disk. Do not re-handshake per call.
6. OAuth is mandatory for any publicly deployed demo; API keys are legal for private / solo use only. Decide before Day 1.

Prior-round repo had this working in sandbox; port the handshake code.

## Endpoints we actually touch

| Purpose | Endpoint | Notes |
|---|---|---|
| Receive transaction events | `NotificationFilterUrl` on monetary account | Register once per account; pick MUTATION + CARD_TRANSACTION_SUCCESSFUL categories |
| Read a transaction | `GET /payment` | Only if we need to re-fetch after the callback |
| Create the Carbon Reserve sub-account | `POST /monetary-account-savings` | Named "Carbon Reserve". Can be scoped per team in V2. |
| Move money into the Reserve | `POST /payment` (source = user account, target = Carbon Reserve IBAN) | Auto-move for low-risk; Draft Payment for high-risk |
| Draft for manager approval | `POST /draft-payment` | For amounts above policy threshold. User taps-to-approve in bunq app. |
| Attach receipt for audit | `POST /note-attachment` | Attached to the *incoming mutation* on the user account |
| Month-end simulated credit purchase | `POST /payment` to mock project IBAN | Three mock projects: biochar, reforestation, peatland |
| Budget visibility (optional) | `GET /insights` + `GET /insights-search` | Only if we want a "you're at 73% of the monthly carbon budget" tile |

## Callbacks we register

- `MUTATION` -- money moved in or out. Primary trigger for the loop.
- `CARD_TRANSACTION_SUCCESSFUL` -- card purchase completed. Preferred over MUTATION for card-driven flows because it fires earlier with merchant context.
- `DRAFT_PAYMENT` -- state transitions (for the approval path).

## Operational

- Callbacks come from `185.40.108.0/22` (prod) or variable AWS IPs (sandbox). Do NOT IP-filter in sandbox.
- 5 retries at 1-minute intervals then logged to `notification-filter-failure`. Webhook handler must be idempotent.
- Rate limits per endpoint at `/basics/rate-limits`. Budget polls.

## Why `monetary-account-savings` is the right primitive

The Carbon Reserve must be a real, visible, named sub-account. Users need to feel the money leave the main account and land somewhere dedicated. `monetary-account-savings` gives us:

- real IBAN (end-of-month purchase routes to a real destination, not a virtual balance)
- visible in the bunq app
- independent balance tracking (we can show "EUR 13.80 reserved this month")
- per-team scoping possible via separate savings accounts

Compare to alternatives:

- **Tags on transactions** -- invisible to users, no real money movement, no audit evidence.
- **Separate full monetary account** -- overkill, requires per-account fees in some tiers.
- **External escrow** -- out of scope for a hackathon.

## What NOT to build

- Real carbon-credit marketplace integration. Simulate.
- Multi-bank aggregation. bunq only for the hackathon.
- Historical backfill of transactions predating the webhook install.

## Reference

- Full API docs: <https://doc.bunq.com>
- Prior-round API research (Keeper concept) covered similar endpoints for different reasons: `C:\dev\bunq-hackathon\README.md#bunq-api-surface`
- Professional notes file: `C:\Users\20243455\professional\bunq\hackathon-7-finsight.md`
