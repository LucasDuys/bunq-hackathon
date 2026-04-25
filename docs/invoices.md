# Invoice Ingestion System

Two-channel invoice ingestion pipeline that extracts structured financial data from uploaded documents and forwarded emails.

## How it works

```
Upload (photo/PDF)  ──┐
                       ├──→ processInvoice() ──→ DB + audit
Gmail forwarding   ──┘

processInvoice():
  1. Save file to data/invoices/
  2. Send to Claude Sonnet (multimodal) for extraction
  3. Zod-validate the structured output
  4. Normalize + classify merchant (rules → Haiku → fallback)
  5. Auto-link to matching bank transaction (amount + merchant + ±7d)
  6. Insert invoice + line items rows
  7. Append audit event
```

## Supported formats

| Format | How it's sent to Claude | Notes |
|---|---|---|
| PDF | `type: "document"`, base64 | Multi-page invoices supported |
| JPEG | `type: "image"`, base64 | Phone photos, scanned docs |
| PNG | `type: "image"`, base64 | Screenshots, exports |

Max file size: 10MB. Claude sets `confidence < 0.6` for blurry/partial docs.

## Extracted data (Zod schema)

```typescript
{
  merchant: string,
  invoiceNumber: string | null,
  invoiceDate: "YYYY-MM-DD" | null,
  dueDate: "YYYY-MM-DD" | null,
  lineItems: [{
    description: string,
    quantity: number | null,
    unitPriceCents: number | null,
    amountCents: number,        // always in cents
    vatRatePct: number | null,
    vatCents: number | null,
    category: string | null,    // from ALL_CATEGORIES
  }],
  subtotalCents: number | null,
  vatCents: number | null,
  totalCents: number,           // required
  currency: "EUR",
  confidence: 0.0–1.0,
  notes: string | null,         // Claude's notes on readability
}
```

## API routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/invoices/upload` | Upload invoice (FormData with `file` field) |
| GET | `/api/invoices` | List all invoices for org |
| GET | `/api/invoices/[id]` | Invoice detail + line items |
| GET | `/api/invoices/[id]/file` | Download/view the stored file |
| POST | `/api/invoices/[id]/link` | Manual transaction linking (`{ transactionId }`) |
| POST | `/api/invoices/[id]/reprocess` | Re-run Claude extraction on a failed/stale invoice |
| POST | `/api/invoices/gmail/poll` | Trigger Gmail inbox poll |

### Upload example

```bash
curl -F "file=@invoice.pdf" http://localhost:3000/api/invoices/upload
# Returns: { ok, id, linked, linkedTxId, merchant, totalCents, lineItems, confidence }
```

### Reprocess example

```bash
curl -X POST http://localhost:3000/api/invoices/inv_abc123/reprocess
# Re-extracts from stored file, updates DB, returns new extraction data
```

## Transaction linking

Auto-matching algorithm in `lib/invoices/process.ts::linkToTransaction()`:

1. Match by `orgId + amountCents + merchantNorm` (exact)
2. Fallback: match by `orgId + amountCents` only
3. If multiple candidates + invoice has a date: filter to ±7 day window, pick closest

Manual linking via `POST /api/invoices/[id]/link` with `{ transactionId }`.

## DAG integration

The baseline agent (`lib/agents/dag/spendBaseline.ts`) checks if any transactions in a cluster have linked invoices:

- **Confidence boost**: invoice-linked transactions get +0.15 confidence (capped at 1.0)
- **data_basis upgrade**: clusters with invoices get `data_basis: "invoice"` (cost savings) or `"item_level"` (green alternatives) instead of the default `"spend_based"` / `"category_level"`
- The cost judge scores `data_basis: "invoice"` higher than `"assumption"` (no -15 penalty)

This means: uploading invoices for your biggest transactions directly improves the quality of all downstream agent recommendations.

## Gmail channel

Forward/CC invoices to `carbo.invoices@gmail.com`. The system:
1. Polls for messages with attachments matching PDF/JPEG/PNG
2. Deduplicates via `gmail_message_id` column
3. Downloads each attachment, runs through `processInvoice()`
4. Skips files >10MB

### Setup (one-time)

1. Create Google Cloud project, enable Gmail API
2. Create OAuth Desktop client → get client ID + secret
3. Run consent flow to get refresh token
4. Set env vars:

```
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_POLL_ADDRESS=carbo.invoices@gmail.com
GMAIL_MOCK=false
```

## File storage

- Runtime uploads: `data/invoices/` (gitignored)
- Demo fixtures: `fixtures/invoices/` (committed)
- Naming: `{invoiceId}_{sanitized-name}.{ext}`

## Testing

```bash
npm run invoice:test        # mock mode — no API key needed
npm run invoice:test:live   # live Claude extraction
npx tsx scripts/test-invoice-extraction.ts --live path/to/real-invoice.pdf
```

## DB tables

**`invoices`**: id, orgId, filePath, fileName, fileMime, fileSizeBytes, source (upload|gmail), gmailMessageId, merchantRaw, merchantNorm, invoiceNumber, invoiceDate, dueDate, subtotalCents, vatCents, totalCents, currency, category, subCategory, categoryConfidence, classifierSource, linkedTxId, extractionModel, extractionRaw, status (processed|failed|pending), errorMessage, createdAt.

**`invoice_line_items`**: id, invoiceId, description, quantity, unitPriceCents, amountCents, vatRatePct, vatCents, category, createdAt.

Indexes: org, linked_tx, gmail_message_id, invoice_id (line items).

## Pages

- `/invoices` — stats row (count, linked, total amount) + drag-and-drop upload + invoice table
- `/invoices/[id]` — detail with metadata, stats, actions (view file, download, reprocess), line items table
