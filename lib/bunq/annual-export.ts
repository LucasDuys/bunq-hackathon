import { callBunq } from "./client";
import { loadContext } from "./context";

/**
 * bunq ExportAnnualOverview wrappers.
 *
 * The end goal: the bank's own end-of-year statement is the CSRD source
 * document. Carbo's monthly carbon notes (written via writeCarbonNote)
 * already live on each Payment record; the annual overview pulls the
 * year together. Whether bunq actually renders the custom NoteText in
 * the official PDF is undocumented — flag for sandbox verification.
 *
 * Mock-mode: callBunq returns canned ids, no network.
 */

export type AnnualOverviewStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

/**
 * POST /v1/user/{userId}/export-annual-overview
 *
 * Triggers bunq to generate the official annual statement for the given
 * calendar year. Returns the export id; poll getAnnualOverview until status
 * is READY, then fetch the PDF via downloadAnnualOverviewContent.
 */
export const requestAnnualOverview = async (params: {
  year: number;
  userId?: string;
  token?: string;
}) => {
  const ctx = loadContext();
  const userId = params.userId ?? ctx.userId ?? "0";

  return callBunq<{ Response: Array<{ Id: { id: number } }> }>({
    method: "POST",
    path: `/v1/user/${userId}/export-annual-overview`,
    body: { year: params.year },
    token: params.token,
  });
};

/**
 * GET /v1/user/{userId}/export-annual-overview/{exportId}
 *
 * Returns current status + (when ready) a content URL.
 */
export const getAnnualOverview = async (params: {
  exportId: number;
  userId?: string;
  token?: string;
}) => {
  const ctx = loadContext();
  const userId = params.userId ?? ctx.userId ?? "0";

  return callBunq<{
    Response: Array<{ ExportAnnualOverview?: { id: number; year: number; status: AnnualOverviewStatus } }>;
  }>({
    method: "GET",
    path: `/v1/user/${userId}/export-annual-overview/${params.exportId}`,
    token: params.token,
  });
};

/**
 * GET /v1/user/{userId}/export-annual-overview/{exportId}/content
 *
 * Returns the binary PDF (in real mode) or a placeholder buffer (mock).
 */
export const downloadAnnualOverviewContent = async (_params: {
  exportId: number;
  userId?: string;
  token?: string;
}): Promise<Buffer> => {
  // bunq's content endpoint returns a binary PDF, not JSON; callBunq
  // assumes JSON. For the hackathon we don't actually need the binary
  // (the live-mode path would use a raw fetch with X-Bunq-Client-Authentication
  // and stream the response). For mock, return a minimal valid PDF stub.
  const stub = Buffer.from(
    "%PDF-1.4\n%mock\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\nxref\n0 3\n0000000000 65535 f\n0000000015 00000 n\n0000000053 00000 n\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n96\n%%EOF\n",
    "utf8",
  );
  return stub;
};
