# 08 — bunq primitives

## Problem
Nail down which bunq API primitives we use, which we avoid, and the non-obvious gotchas that will break a demo.

## Key facts (compiled from bunq hackathon toolkit + doc.bunq.com)

### Authentication chain
1. `POST /v1/installation` — send our RSA-2048 public key; server returns installation token + server public key.
2. `POST /v1/device-server` — send API key + description; returns device ID.
3. `POST /v1/session-server` — send API key; returns **session token** (used for all further calls) + UserCompany / UserPerson object.
4. Cache session token in DB (`bunq_sessions`); it expires, but re-creating is rate-limited (1/30s).

### Request signing
- **All** state-changing requests need `X-Bunq-Client-Signature` = RSA-SHA256(body) base64.
- GETs with empty body can skip signing in practice (per toolkit).
- Headers: `X-Bunq-Client-Authentication` (session token), `X-Bunq-Client-Request-Id` (UUID per request, must be unique), `X-Bunq-Language`, `X-Bunq-Region`, `User-Agent`.

### Webhooks
- Register via `POST /v1/user/{uid}/monetary-account/{acct}/notification-filter-url` with category and target URL.
- **Categories**: `MUTATION` (all balance changes, our default), `PAYMENT` (standard card/transfer payments only), 16 total.
- **Signature**: `X-Bunq-Server-Signature` = RSA-SHA256 over body, verified with the installation's server public key.
- **Delivery**: 6 retries, 1-minute interval, then stored in `notification-filter-failure`.
- **URL** must be HTTPS and publicly reachable **at registration time** — hence Cloudflare Tunnel or paid ngrok (free ngrok URLs change on restart).

### Money movement
- **Intra-user transfers between sub-accounts = immediate, zero per-call approval.** This is the core primitive that makes enterprise single-user flows work.
- **Cross-user transfers** require a manual RequestInquiry accept. We don't use them.
- **DraftPayment** freezes until a human taps approve in the bunq app — do NOT use in automated pipelines.
- **Sandbox bot**: `sugardaddy@bunq.com` auto-accepts RequestInquiries up to €500. Use for demo seeding.
- Sandbox `bunq.me` may return no URL (per toolkit source) — always budget for a fallback flow.

### Sub-accounts
- `POST /user/{uid}/monetary-account-bank` with `{"currency":"EUR","description":"Carbon Reserve"}` — instant.
- Limits: Free plan 3 accounts, Core 5, business tiers up to 25. Hackathon demo fits comfortably.
- `MonetaryAccountJoint` requires all co-owners to accept invite — high friction, skip.
- `MonetaryAccountSavings` limited to 2 withdrawals/month — skip for programmatic use.

### Rate limits
- GET 3/3s, POST 5/3s, PUT 2/3s, `session-server` 1/30s.
- On HTTP 429: back off 3s. Cache `bunq_sessions` across restarts so we don't hit the session-server limit.

### Sandbox multi-user trick
- `POST /sandbox-user-person` creates test users programmatically, returns API keys unauthenticated. Useful for seeding multi-user sandbox data server-side.

## Decisions for this build
- **Mock mode by default** (`BUNQ_MOCK=1`). Real mode switches to live sandbox.
- Single-user (single org) in MVP — each org connects their own bunq Business API key directly.
- Webhook: `MUTATION` category only. Signature verified in real mode, skipped in mock.
- Sub-accounts: one Carbon Reserve, one Credits (for simulated purchases). Created at onboarding.
- Session tokens cached in `bunq_sessions`.
- Cloudflare Tunnel is the recommended deploy path for the webhook URL.
- Every bunq-touching code path writes an audit_event before + after the call.
