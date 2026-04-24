import { env } from "@/lib/env";
import { isAnthropicMock } from "@/lib/anthropic/client";

console.log("env.anthropicMock      =", env.anthropicMock);
console.log("env.anthropicKey present:", env.anthropicKey.length > 0, "len=", env.anthropicKey.length);
console.log("isAnthropicMock()      =", isAnthropicMock());
console.log("raw process.env.ANTHROPIC_MOCK =", JSON.stringify(process.env.ANTHROPIC_MOCK));
console.log("raw ANTHROPIC_API_KEY len      =", (process.env.ANTHROPIC_API_KEY ?? "").length);
