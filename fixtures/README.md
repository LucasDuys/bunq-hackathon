# Fixtures

Seed data for local development and the hackathon demo. Not production.

## `bunq-transactions.json`

120 synthetic `Payment` objects in bunq webhook shape, spanning 2026-02-23 to 2026-04-24.

- 4 mock employees (`monetary_account_id` 4821-4824) across three teams: engineering, operations, sales
- 12 merchant categories: grocery, software, food_service, food_delivery, travel_air, travel_rail, travel_rideshare, electronics, fuel, retail, furniture, utility_telco
- Dutch/EU merchant mix (Albert Heijn, Jumbo, NS, KLM, Shell, AWS, Anthropic, Bol.com, Coolblue, Eneco, Vodafone, etc.)
- All amounts negative (outgoing), EUR, with realistic MCC codes
- `_hackathon_metadata` field carries the ground-truth team + category for demo scripting; strip before any code that assumes production shape

Payload envelope matches `GET /user/{userID}/monetary-account/{monetary-account-id}/payment`: `{"Response": [{"Payment": {...}}]}`.

Regeneration is deterministic with `seed=42` (script not checked in; ask Daniel).

## `emission-factors/agribalyse-synthese-3.2.csv`

Agribalyse 3.2 Synthèse — 2,517 agricultural and food products with per-kg environmental impacts. Published November 2024 by ADEME (French environment agency).

Key columns for the carbon estimator:

| Column | Meaning |
|---|---|
| `Code CIQUAL` | Stable product ID (join key) |
| `Nom du Produit en Français` | French product name |
| `LCI Name` | English name (useful for matching) |
| `Groupe d'aliment` / `Sous-groupe d'aliment` | Category hierarchy |
| `Changement climatique` | **kg CO₂e per kg product** (primary estimator input) |
| `DQR` | Data Quality Rating (1 = excellent, 5 = poor) — surface in confidence scoring |
| `Matériau d'emballage` | Packaging material (for alternative-matrix suggestions) |

Scope: covers the Albert Heijn / Jumbo supermarket aisle well (dairy, meat, produce, processed). Does **not** cover non-food items — non-food emission factors are hardcoded in `lib/factors/index.ts` (derived from DEFRA 2024, ADEME, and Exiobase). Merchant classification uses the Claude API (Anthropic SDK) to map transactions to the right factor.

Source: <https://doc.agribalyse.fr/documentation-en/agribalyse-data/data-access>
License: Open (ADEME public data).
