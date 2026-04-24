import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Link2, ExternalLink } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, Stat, SectionDivider } from "@/components/ui";
import { getInvoiceWithItems } from "@/lib/queries";
import { fmtEur, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = getInvoiceWithItems(id);
  if (!invoice) notFound();

  const dateStr = invoice.invoiceDate
    ? new Date(invoice.invoiceDate * 1000).toLocaleDateString("en-NL", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const dueStr = invoice.dueDate
    ? new Date(invoice.dueDate * 1000).toLocaleDateString("en-NL", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="relative z-[1] flex flex-col gap-6">
      {/* Back link + header */}
      <div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 text-xs font-medium mb-4 hover:underline"
          style={{ color: "var(--text-dim)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to invoices
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.8px] font-semibold" style={{ color: "var(--text-mute)" }}>
              Invoice
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1.5" style={{ color: "var(--text)" }}>
              {invoice.merchantRaw ?? invoice.fileName}
            </h1>
            {invoice.invoiceNumber && (
              <p className="text-sm mt-1 font-mono" style={{ color: "var(--text-dim)" }}>
                {invoice.invoiceNumber}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Badge tone={invoice.status === "processed" ? "positive" : "warning"}>
              {invoice.status}
            </Badge>
            <Badge tone={invoice.source === "gmail" ? "info" : "default"}>
              {invoice.source}
            </Badge>
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
        <Card><CardBody><Stat label="Total" value={fmtEur(invoice.totalCents / 100)} /></CardBody></Card>
        <Card><CardBody><Stat label="Subtotal" value={invoice.subtotalCents ? fmtEur(invoice.subtotalCents / 100) : "—"} /></CardBody></Card>
        <Card><CardBody><Stat label="VAT" value={invoice.vatCents ? fmtEur(invoice.vatCents / 100) : "—"} /></CardBody></Card>
        <Card>
          <CardBody>
            <Stat
              label="Confidence"
              value={invoice.categoryConfidence ? fmtPct(invoice.categoryConfidence) : "—"}
              tone={invoice.categoryConfidence && invoice.categoryConfidence >= 0.85 ? "positive" : "warning"}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Linked"
              value={invoice.linkedTxId ? "Yes" : "No"}
              sub={invoice.linkedTxId ? invoice.linkedTxId.slice(0, 16) : undefined}
              tone={invoice.linkedTxId ? "positive" : "default"}
            />
          </CardBody>
        </Card>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {dateStr && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>Invoice date</dt>
                <dd className="mt-1 tabular-nums" style={{ color: "var(--text)" }}>{dateStr}</dd>
              </div>
            )}
            {dueStr && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>Due date</dt>
                <dd className="mt-1 tabular-nums" style={{ color: "var(--text)" }}>{dueStr}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>Category</dt>
              <dd className="mt-1" style={{ color: "var(--text)" }}>{invoice.category ?? "—"}{invoice.subCategory ? ` / ${invoice.subCategory}` : ""}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>Classifier</dt>
              <dd className="mt-1" style={{ color: "var(--text)" }}>{invoice.classifierSource ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>File</dt>
              <dd className="mt-1 font-mono text-xs" style={{ color: "var(--text-dim)" }}>{invoice.fileName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>Size</dt>
              <dd className="mt-1 tabular-nums" style={{ color: "var(--text)" }}>{(invoice.fileSizeBytes / 1024).toFixed(1)} KB</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {/* Line items */}
      {invoice.lineItems.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{invoice.lineItems.length} line items</CardTitle></CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className="text-left text-[10px] uppercase tracking-[0.5px] font-semibold"
                    style={{ borderBottom: "1px solid var(--border)", color: "var(--text-faint)" }}
                  >
                    <th className="py-2.5 pr-3">Description</th>
                    <th className="py-2.5 pr-3 text-right">Qty</th>
                    <th className="py-2.5 pr-3 text-right">Unit price</th>
                    <th className="py-2.5 pr-3 text-right">Amount</th>
                    <th className="py-2.5 pr-3 text-right">VAT %</th>
                    <th className="py-2.5 pr-3 text-right">VAT</th>
                    <th className="py-2.5 pr-3">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--border-faint)" }}>
                      <td className="py-2.5 pr-3" style={{ color: "var(--text)" }}>{item.description}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: "var(--text-mute)" }}>
                        {item.quantity ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: "var(--text-mute)" }}>
                        {item.unitPriceCents ? fmtEur(item.unitPriceCents / 100) : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: "var(--text)" }}>
                        {fmtEur(item.amountCents / 100)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: "var(--text-mute)" }}>
                        {item.vatRatePct != null ? `${item.vatRatePct}%` : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: "var(--text-mute)" }}>
                        {item.vatCents ? fmtEur(item.vatCents / 100) : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        {item.category ? <Badge tone="default">{item.category}</Badge> : <span style={{ color: "var(--text-faint)" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
