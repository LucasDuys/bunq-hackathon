# 03 -- Receipt Vision + OCR

_Status: stub. Pre-calibrate on real Albert Heijn and Jumbo receipts before Day 0 hour 2._

## What we need to extract

Per line: `{name, qty, unit, unit_price, total_price}`. Plus: `merchant, total, date, VAT_breakdown`.

## Candidates

| Approach | Cost | Latency | Accuracy on Dutch retail receipts | Notes |
|---|---|---|---|---|
| Claude Opus 4.7 vision | moderate | ~3-5s | expected high, unverified | single call, structured output via tool use |
| Mercury 2 (multimodal?) | low | ~1s | unverified | check if Mercury 2 has vision; if not, skip |
| Google Document AI | low | ~2s | high on structured docs | OAuth overhead, slower to set up |
| Tesseract + LLM post | free | fast | low on low-quality phone photos | last resort |

## Receipt peculiarities we have to handle

- Dutch labels: "KIP FILET" -> chicken fillet; "RUNDERGEHAKT" -> beef mince.
- Discount lines (`BONUS -0.50`) must be attributed to the right item.
- VAT categories (6% food, 9% food, 21% non-food) appear as a block at the bottom.
- Loyalty-card lines must be ignored.
- Albert Heijn-specific: kilogram-priced items vs per-item.

## Structured output contract

Use tool-use with a JSON Schema. Grammar-constrain with the same pattern as `teambrain/app/src/inference/nli.ts`.

```json
{
  "merchant": "Albert Heijn",
  "date": "2026-04-24T18:05:00+02:00",
  "total": 42.80,
  "currency": "EUR",
  "items": [
    {
      "name_raw": "RUNDERGEHAKT",
      "name_normalized": "beef mince",
      "qty": 0.500,
      "unit": "kg",
      "unit_price_eur": 9.50,
      "total_price_eur": 4.75,
      "category_guess": "food.meat.beef",
      "confidence": 0.93
    }
  ],
  "vat_breakdown": [
    {"rate_pct": 9, "base_eur": 30.20, "vat_eur": 2.72},
    {"rate_pct": 21, "base_eur": 9.88, "vat_eur": 2.07}
  ]
}
```

## Pre-calibration plan

- Print 5 real receipts (AH, Jumbo, Hema, petrol station, restaurant).
- Shoot phone photos in both good and bad light.
- Run them through the chosen model the evening before Day 0.
- Tune the prompt (few-shot examples added) until extraction confidence > 0.8 for all items on 4 of 5 receipts.

## Output shape

See `RESEARCH-INDEX.md` -> Research agent output format.
