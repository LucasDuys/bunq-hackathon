import { anthropic, MODEL_HAIKU } from "@/lib/anthropic/client";

const main = async () => {
  console.log("probing Anthropic with Haiku…");
  const t0 = performance.now();
  try {
    const msg = await anthropic().messages.create({
      model: MODEL_HAIKU,
      max_tokens: 64,
      messages: [{ role: "user", content: "Reply with exactly: pong" }],
    });
    const text = msg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
    console.log(`✓ OK in ${Math.round(performance.now() - t0)}ms:`, text);
    console.log("input_tokens:", msg.usage.input_tokens, "output_tokens:", msg.usage.output_tokens);
  } catch (e) {
    console.error(`✗ FAILED in ${Math.round(performance.now() - t0)}ms`);
    console.error("name:   ", (e as { name?: string }).name);
    console.error("message:", (e as Error).message);
    console.error("status: ", (e as { status?: number }).status);
    console.error("stack:  ", (e as Error).stack?.split("\n").slice(0, 5).join("\n"));
  }
};

main();
