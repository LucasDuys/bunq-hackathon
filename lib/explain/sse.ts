import type { ExplainEvent } from "./schema";

const encoder = new TextEncoder();

export const sseFrame = (event: ExplainEvent): Uint8Array =>
  encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

/**
 * Yield word-boundary chunks of `text` paced by `delayMs`, so the mock path
 * looks identical on the wire to the live Anthropic stream. Default ~25 chars
 * per chunk, ~24ms apart — same cadence as Sonnet's text_delta events.
 */
export async function* streamTextChunks(
  text: string,
  opts: { chunkSize?: number; delayMs?: number } = {},
): AsyncGenerator<string, void, void> {
  const chunkSize = opts.chunkSize ?? 25;
  const delayMs = opts.delayMs ?? 24;
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + chunkSize);
    if (end < text.length) {
      const slice = text.slice(i, end);
      const lastSpace = slice.lastIndexOf(" ");
      if (lastSpace > chunkSize * 0.4) end = i + lastSpace + 1;
    }
    yield text.slice(i, end);
    i = end;
    if (i < text.length && delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * SSE response headers that work behind both Vercel and a bare Node server.
 * `no-transform` matters — Cloudflare/proxies will buffer otherwise.
 */
export const sseHeaders: HeadersInit = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};
