import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

let _client: Anthropic | null = null;
export const anthropic = () => {
  if (!_client) _client = new Anthropic({ apiKey: env.anthropicKey });
  return _client;
};

export const MODEL_HAIKU = "claude-haiku-4-5-20251001";
export const MODEL_SONNET = "claude-sonnet-4-6";

// Runtime "soft" offline flag: flipped on once any Anthropic call returns a
// permanent failure (auth, exhausted credits, repeated rate-limit). Subsequent
// callers see isAnthropicMock() === true and skip the HTTP call entirely.
let _runtimeOffline = false;
let _offlineReason: string | null = null;

export const isAnthropicMock = () =>
  env.anthropicMock || !env.anthropicKey || _runtimeOffline;

export const isApiOffline = () => _runtimeOffline;
export const apiOfflineReason = () => _offlineReason;

/**
 * Inspect a thrown error from the Anthropic SDK and return a human-readable
 * reason if it should permanently disable live calls for this process. Returns
 * null when the error is transient or unrelated.
 */
const classifyFatalError = (err: unknown): string | null => {
  if (!(err instanceof APIError)) return null;
  const msg = err.message ?? "";
  // 401/403 — invalid or revoked key.
  if (err.status === 401 || err.status === 403) return `auth (${err.status})`;
  // 400 with credit-balance language — exhausted credits.
  if (err.status === 400 && /credit balance/i.test(msg)) return "credit_balance_too_low";
  // 402 — payment required.
  if (err.status === 402) return "payment_required";
  return null;
};

const isLikelyTransient = (err: unknown): boolean => {
  if (!(err instanceof APIError)) return true; // network/unknown — treat as transient
  if (err.status === 429) return true; // rate limit
  if (err.status && err.status >= 500) return true; // upstream
  return false;
};

/**
 * Inspect a thrown error and, if it's a permanent live-API failure (auth,
 * exhausted credits), flip the runtime offline flag so subsequent
 * `isAnthropicMock()` checks short-circuit to the deterministic path.
 *
 * Returns `true` if the error was classified as fatal (caller should fall back
 * to a mock), `false` otherwise (caller may rethrow or use its own logic).
 */
export const notifyAnthropicFailure = (err: unknown, label = "anthropic"): boolean => {
  const fatal = classifyFatalError(err);
  if (!fatal) return false;
  if (!_runtimeOffline) {
    _runtimeOffline = true;
    _offlineReason = fatal;
    console.warn(
      `[anthropic] ${label}: live API disabled for this process (${fatal}); falling back to deterministic mock.`,
    );
  }
  return true;
};

/**
 * Run an Anthropic API call with automatic fallback to a deterministic mock
 * value if the call fails. On permanent failures (auth, exhausted credits)
 * the runtime offline flag is set so subsequent callers skip the API entirely.
 *
 * Use this everywhere `client.messages.create` is called outside the DAG
 * `callAgent` path, so the UI never breaks when credits run out.
 */
export const withAnthropicFallback = async <T>(
  call: () => Promise<T>,
  fallback: () => T | Promise<T>,
  label = "anthropic",
): Promise<T> => {
  if (isAnthropicMock()) return fallback();
  try {
    return await call();
  } catch (err) {
    const fatal = classifyFatalError(err);
    if (fatal) {
      if (!_runtimeOffline) {
        _runtimeOffline = true;
        _offlineReason = fatal;
        console.warn(
          `[anthropic] ${label}: live API disabled for this process (${fatal}); falling back to deterministic mock.`,
        );
      }
      return fallback();
    }
    if (isLikelyTransient(err)) {
      console.warn(
        `[anthropic] ${label}: transient failure (${(err as Error).message ?? "unknown"}); using mock for this call.`,
      );
      return fallback();
    }
    // Unknown non-API error: surface it.
    throw err;
  }
};
