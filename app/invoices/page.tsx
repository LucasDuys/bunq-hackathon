import Link from "next/link";
import { FileText, Mail, Upload as UploadIcon, Link2 } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, CardTitle, Stat, SectionDivider } from "@/components/ui";
import { InvoiceUpload } from "@/components/InvoiceUpload";
import { ExplainButton } from "@/components/ExplainButton";
import { DEFAULT_ORG_ID, getInvoicesForOrg, getInvoiceStats } from "@/lib/queries";
import { fmtEur, fmtPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoiceList = getInvoicesForOrg(DEFAULT_ORG_ID);
  const stats = getInvoiceStats(DEFAULT_ORG_ID);

  return (
    <div className="relative z-[1] flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.8px] font-semibold" style={{ color: "var(--text-mute)" }}>
            Documents
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1.5" style={{ color: "var(--text)" }}>
            Invoice ingestion
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
            Upload invoices or forward them to your Carbo inbox. Claude extracts line items, categories, and VAT automatically.
          </p>
        </div>
        <div className="shrink-0 mt-2">
          <ExplainButton metric="invoice-stats" />
        </div>
      </div>

      <SectionDivider />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <CardBody>
            <Stat label="Total invoices" value={String(stats?.total ?? 0)} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Linked to transactions"
              value={String(stats?.linked ?? 0)}
              sub={stats?.total ? `${((stats.linked / stats.total) * 100).toFixed(0)}% match rate` : "—"}
              tone="positive"
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <Stat
              label="Total invoiced"
              value={fmtEur((stats?.totalAmountCents ?? 0) / 100)}
              tone="default"
            />
          </CardBody>
        </Card>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload invoice</CardTitle>
        </CardHeader>
        <CardBody>
          <InvoiceUpload />
        </CardBody>
      </Card>

      <SectionDivider />

      {/* Invoice list */}
      <Card>
        <CardHeader>
          <CardTitle>{invoiceList.length} invoices</CardTitle>
        </CardHeader>
        <CardBody>
          {invoiceList.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-mute)" }}>
              No invoices yet. Upload one above or forward to your Carbo inbox.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className="text-left text-[10px] uppercase tracking-[0.5px] font-semibold"
                    style={{ borderBottom: "1px solid var(--border)", color: "var(--text-faint)" }}
                  >
                    <th className="py-2.5 pr-3">Merchant</th>
                    <th className="py-2.5 pr-3">Invoice #</th>
                    <th className="py-2.5 pr-3 text-right">Total</th>
                    <th className="py-2.5 pr-3 text-right">VAT</th>
                    <th className="py-2.5 pr-3">Category</th>
                    <th className="py-2.5 pr-3">Source</th>
                    <th className="py-2.5 pr-3">Status</th>
                    <th className="py-2.5 pr-3">Linked</th>
                    <th className="py-2.5 pr-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceList.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: "1px solid var(--border-faint)" }}>
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-medium hover:underline"
                          style={{ color: "var(--text)" }}
                        >
                          {inv.merchantRaw ?? inv.fileName}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[11px]" style={{ color: "var(--text-mute)" }}>
                        {inv.invoiceNumber ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: "var(--text)" }}>
                        {fmtEur(inv.totalCents / 100)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: "var(--text-mute)" }}>
                        {inv.vatCents ? fmtEur(inv.vatCents / 100) : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        {inv.category ? (
                          <Badge tone="default">{inv.category}</Badge>
                        ) : (
                          <span style={{ color: "var(--text-faint)" }}>—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={inv.source === "gmail" ? "info" : "default"}>
                          {inv.source === "gmail" ? (
                            <><Mail className="h-3 w-3 inline mr-1" />email</>
                          ) : (
                            <><UploadIcon className="h-3 w-3 inline mr-1" />upload</>
                          )}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={inv.status === "processed" ? "positive" : inv.status === "failed" ? "warning" : "default"}>
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        {inv.linkedTxId ? (
                          <Link2 className="h-3.5 w-3.5" style={{ color: "var(--green)" }} />
                        ) : (
                          <span style={{ color: "var(--text-faint)" }}>—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums" style={{ color: "var(--text-mute)" }}>
                        {inv.invoiceDate
                          ? new Date(inv.invoiceDate * 1000).toLocaleDateString("en-NL", { day: "numeric", month: "short", year: "numeric" })
                          : new Date(inv.createdAt * 1000).toLocaleDateString("en-NL", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
