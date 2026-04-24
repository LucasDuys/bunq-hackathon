import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const INVOICE_DIR = path.resolve(process.cwd(), "data", "invoices");

export function ensureInvoiceDir(): string {
  mkdirSync(INVOICE_DIR, { recursive: true });
  return INVOICE_DIR;
}

function sanitizeName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/pdf": "pdf",
  };
  return map[mime] ?? "bin";
}

export function saveInvoiceFile(params: {
  invoiceId: string;
  buffer: Buffer;
  originalName: string;
  mime: string;
}): string {
  ensureInvoiceDir();
  const ext = extFromMime(params.mime);
  const sanitized = sanitizeName(params.originalName);
  const filename = `${params.invoiceId}_${sanitized}.${ext}`;
  const fullPath = path.join(INVOICE_DIR, filename);
  writeFileSync(fullPath, params.buffer);
  return path.relative(process.cwd(), fullPath);
}

export function readInvoiceFile(relativePath: string): Buffer {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return readFileSync(fullPath);
}

export function fileToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
