import { NextResponse } from "next/server";
import { attachUpload } from "@/lib/agent/onboarding";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const guessMime = (name: string, declared: string | null): string => {
  if (declared && declared !== "application/octet-stream") return declared;
  const ext = name.toLowerCase().split(".").pop();
  if (!ext) return "text/plain";
  switch (ext) {
    case "md":
    case "markdown":
      return "text/markdown";
    case "json":
      return "application/json";
    case "yaml":
    case "yml":
      return "text/yaml";
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "txt":
    default:
      return "text/plain";
  }
};

export const POST = async (req: Request, { params }: { params: Promise<{ runId: string }> }) => {
  const { runId } = await params;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "missing file field" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `file too large (max ${MAX_BYTES} bytes)` }, { status: 413 });
    }
    const mime = guessMime(file.name, file.type || null);
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: `unsupported mime type: ${mime}. Allowed: ${Array.from(ALLOWED_MIME).join(", ")}` },
        { status: 415 },
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await attachUpload({ runId, filename: file.name, mime, bytes });
    return NextResponse.json({ ok: true, parsed });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
};
