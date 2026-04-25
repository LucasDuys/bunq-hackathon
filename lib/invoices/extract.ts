import { z } from "zod";
import { MODEL_SONNET, anthropic, withAnthropicFallback } from "@/lib/anthropic/client";
import { ALL_CATEGORIES } from "@/lib/factors";
import { fileToBase64 } from "./storage";

const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unitPriceCents: z.number().nullable(),
  amountCents: z.number(),
  vatRatePct: z.number().nullable(),
  vatCents: z.number().nullable(),
  category: z.string().nullable(),
});

export const InvoiceExtractionSchema = z.object({
  merchant: z.string(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  lineItems: z.array(LineItemSchema),
  subtotalCents: z.number().nullable(),
  vatCents: z.number().nullable(),
  totalCents: z.number(),
  currency: z.string().default("EUR"),
  confidence: z.number().min(0).max(1),
  notes: z.string().nullable(),
});

export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;

function mockExtraction(): InvoiceExtraction {
  return {
    merchant: "Mock Supplier BV",
    invoiceNumber: "INV-2026-0042",
    invoiceDate: "2026-04-15",
    dueDate: "2026-05-15",
    lineItems: [
      { description: "Cloud hosting EU-west", quantity: 1, unitPriceCents: 8500, amountCents: 8500, vatRatePct: 21, vatCents: 1785, category: "cloud" },
      { description: "Support plan", quantity: 1, unitPriceCents: 3800, amountCents: 3800, vatRatePct: 21, vatCents: 798, category: "cloud" },
    ],
    subtotalCents: 12300,
    vatCents: 2583,
    totalCents: 14883,
    currency: "EUR",
    confidence: 0.85,
    notes: null,
  };
}

const PROMPT = `You extract structured data from invoices. Return STRICT JSON only, no prose, no code fences.

All monetary amounts must be in CENTS (integer). For example, €123.45 = 12345.

Categories: ${ALL_CATEGORIES.join(", ")}.

Output schema:
{
  "merchant": "vendor name",
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "lineItems": [
    {
      "description": "line item text",
      "quantity": number_or_null,
      "unitPriceCents": integer_or_null,
      "amountCents": integer,
      "vatRatePct": number_or_null,
      "vatCents": integer_or_null,
      "category": "one of categories or null"
    }
  ],
  "subtotalCents": integer_or_null,
  "vatCents": integer_or_null,
  "totalCents": integer,
  "currency": "EUR",
  "confidence": 0.0_to_1.0,
  "notes": "string or null"
}

Extract every visible line item. If the document is unclear or partially readable, set confidence below 0.6. Assign each line item a category from the list above if you can determine it.`;

export async function extractInvoice(params: {
  fileBuffer: Buffer;
  mime: string;
  fileName: string;
}): Promise<{ extraction: InvoiceExtraction; rawResponse: string }> {
  const fallback = () => {
    const extraction = mockExtraction();
    return { extraction, rawResponse: JSON.stringify(extraction) };
  };

  return withAnthropicFallback(
    async () => {
      const client = anthropic();
      const b64 = fileToBase64(params.fileBuffer);

      const imageContent = params.mime === "application/pdf"
        ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: b64 } }
        : { type: "image" as const, source: { type: "base64" as const, media_type: params.mime as "image/jpeg" | "image/png", data: b64 } };

      const msg = await client.messages.create({
        model: MODEL_SONNET,
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            imageContent,
            { type: "text", text: `${PROMPT}\n\nFilename: ${params.fileName}` },
          ],
        }],
      });

      const text = msg.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { text: string }).text)
        .join("");
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) return fallback();

      const parsed = InvoiceExtractionSchema.parse(JSON.parse(jsonMatch[0]));
      return { extraction: parsed, rawResponse: text };
    },
    fallback,
    "invoices.extractInvoice",
  );
}
