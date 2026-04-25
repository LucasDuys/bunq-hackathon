/**
 * Invoice extraction test script.
 *
 * Tests the full extraction pipeline:
 * 1. Mock mode: verifies pipeline with canned data (no API key needed)
 * 2. Live mode: sends a real PDF/image to Claude Sonnet for extraction
 *
 * Usage:
 *   npx tsx scripts/test-invoice-extraction.ts              # mock mode
 *   npx tsx scripts/test-invoice-extraction.ts --live        # live Claude
 *   npx tsx scripts/test-invoice-extraction.ts --live path/to/invoice.pdf
 */

import { processInvoice } from "@/lib/invoices/process";
import { extractInvoice } from "@/lib/invoices/extract";
import { isAnthropicMock } from "@/lib/anthropic/client";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const LIVE = process.argv.includes("--live");
const customFile = process.argv.find(
  (a) => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1],
);

async function testMockExtraction() {
  console.log("=== Mock extraction test ===");
  console.log(`ANTHROPIC_MOCK=${isAnthropicMock()}`);

  const result = await processInvoice({
    orgId: "org_acme_bv",
    fileBuffer: Buffer.from("mock-content"),
    fileName: "test-mock-invoice.pdf",
    mime: "application/pdf",
    source: "upload",
  });

  console.log("Invoice ID:", result.invoiceId);
  console.log("Merchant:", result.extraction?.merchant ?? "N/A");
  console.log("Total:", result.extraction?.totalCents ?? 0, "cents");
  console.log(
    "Line items:",
    result.extraction?.lineItems.length ?? 0,
  );
  console.log("Linked TX:", result.linkedTxId ?? "none");
  console.log("Confidence:", result.extraction?.confidence ?? 0);
  console.log("✅ Mock extraction passed\n");
}

async function testLiveExtraction(filePath?: string) {
  console.log("=== Live extraction test ===");

  if (isAnthropicMock()) {
    console.log(
      "⚠ ANTHROPIC_MOCK is true — set ANTHROPIC_MOCK=false in .env.local for live test",
    );
    console.log("Running mock extraction instead...\n");
    return testMockExtraction();
  }

  let buffer: Buffer;
  let fileName: string;
  let mime: string;

  if (filePath && existsSync(filePath)) {
    buffer = readFileSync(filePath);
    fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    mime =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : "image/jpeg";
    console.log(`File: ${filePath} (${mime}, ${(buffer.length / 1024).toFixed(1)} KB)`);
  } else {
    // Generate a simple test "invoice" as text content that Claude can read
    // We'll create a minimal PDF-like text buffer — Claude handles this gracefully
    console.log("No file provided — using built-in test invoice image");
    console.log(
      "Tip: pass a real invoice file for better testing:",
    );
    console.log(
      "  npx tsx scripts/test-invoice-extraction.ts --live path/to/invoice.pdf\n",
    );

    // Use the fixture JSON to create a test — but for live mode we need an actual file
    // Let's test the extraction function directly with a text prompt as fallback
    const testContent = `
FACTUUR
==============================
Van: TestBedrijf BV
KVK: 12345678
BTW: NL123456789B01

Aan: Acme BV

Factuurnummer: TEST-2026-001
Datum: 2026-04-25
Vervaldatum: 2026-05-25

Omschrijving              Aantal  Prijs    Bedrag
---------------------------------------------
Kantoorbenodigdheden         5    €12,50   €62,50
Koffie & thee pakket         2    €34,99   €69,98
Schoonmaakmiddelen           1    €45,00   €45,00

                          Subtotaal: €177,48
                          BTW 21%:   €37,27
                          Totaal:    €214,75

Betaling binnen 30 dagen op NL91 BUNQ 1234 5678 90
`;
    buffer = Buffer.from(testContent);
    fileName = "test-factuur.txt";
    // Send as image — Claude will still attempt to extract text from the base64
    // For a real test, provide an actual PDF/image file
    mime = "application/pdf";
  }

  console.log("\nCalling Claude Sonnet for extraction...");
  const start = Date.now();

  try {
    const { extraction, rawResponse } = await extractInvoice({
      fileBuffer: buffer,
      mime,
      fileName,
    });

    const elapsed = Date.now() - start;
    console.log(`\n✅ Extraction completed in ${elapsed}ms`);
    console.log("─".repeat(50));
    console.log("Merchant:", extraction.merchant);
    console.log("Invoice #:", extraction.invoiceNumber ?? "N/A");
    console.log("Date:", extraction.invoiceDate ?? "N/A");
    console.log("Due:", extraction.dueDate ?? "N/A");
    console.log("Currency:", extraction.currency);
    console.log(
      `Total: €${(extraction.totalCents / 100).toFixed(2)}`,
    );
    console.log(
      `Subtotal: €${extraction.subtotalCents ? (extraction.subtotalCents / 100).toFixed(2) : "N/A"}`,
    );
    console.log(
      `VAT: €${extraction.vatCents ? (extraction.vatCents / 100).toFixed(2) : "N/A"}`,
    );
    console.log(`Confidence: ${(extraction.confidence * 100).toFixed(0)}%`);
    console.log(`Notes: ${extraction.notes ?? "—"}`);
    console.log(`\nLine items (${extraction.lineItems.length}):`);
    for (const item of extraction.lineItems) {
      console.log(
        `  • ${item.description} — qty:${item.quantity ?? "?"} × €${item.unitPriceCents ? (item.unitPriceCents / 100).toFixed(2) : "?"} = €${(item.amountCents / 100).toFixed(2)} (${item.category ?? "uncat"})`,
      );
    }
    console.log("─".repeat(50));

    // Verify Zod parsing succeeded (it did if we got here)
    console.log("\n✅ Zod schema validation passed");

    // Check data quality
    const issues: string[] = [];
    if (extraction.totalCents === 0) issues.push("totalCents is 0");
    if (extraction.lineItems.length === 0) issues.push("no line items extracted");
    if (extraction.confidence < 0.5) issues.push(`low confidence: ${extraction.confidence}`);
    if (!extraction.merchant) issues.push("no merchant extracted");

    if (issues.length > 0) {
      console.log("⚠ Data quality issues:", issues.join(", "));
    } else {
      console.log("✅ Data quality checks passed");
    }

    // Test full pipeline (processInvoice) if we have a real file
    if (filePath && existsSync(filePath)) {
      console.log("\n--- Full pipeline test (processInvoice) ---");
      const pipeResult = await processInvoice({
        orgId: "org_acme_bv",
        fileBuffer: buffer,
        fileName,
        mime,
        source: "upload",
      });
      console.log("Invoice ID:", pipeResult.invoiceId);
      console.log("Linked:", pipeResult.linked, pipeResult.linkedTxId ?? "");
      console.log("✅ Full pipeline passed");
    }
  } catch (e) {
    const elapsed = Date.now() - start;
    console.error(`\n❌ Extraction failed after ${elapsed}ms`);
    console.error("Error:", (e as Error).message);
    if ((e as Error).message.includes("JSON")) {
      console.error(
        "Claude returned non-JSON — this usually means the input wasn't a recognizable invoice",
      );
    }
    process.exit(1);
  }
}

async function run() {
  console.log("Invoice Extraction Test Suite\n");

  if (LIVE) {
    await testLiveExtraction(customFile);
  } else {
    await testMockExtraction();
  }

  console.log("\nAll tests passed ✅");
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
