# Context Window Management

## Summary
Every LLM has a fixed token limit for what it can "see" in one call. For a campaign agent loading brick data, this limit determines how many bricks can fit in a single request — and exceeding it causes either truncation, errors, or degraded performance. Managing the window deliberately is critical before the dataset grows past ~200 bricks.

## Key Concepts
- **Context window**: The total tokens an LLM can process in one request (input + output combined on most models)
- **Token**: Roughly 0.75 words, or ~4 characters in English; JSON is denser and uses more tokens per byte of data
- **Prompt caching**: Anthropic and OpenAI allow repeated prefix sections to be cached, reducing cost and latency on subsequent calls
- **KV cache**: Internal model mechanism that stores attention computations for previously seen tokens
- **Input tokens vs output tokens**: Input (prompt) tokens are cheaper and faster; output tokens drive most latency
- **Context poisoning**: Filling the window with low-signal data (raw JSON blobs) that competes with high-signal instructions

## How It Works

### Hard Token Limits by Model (as of early 2026)

| Model | Context Window | Max Output | Notes |
|-------|---------------|------------|-------|
| Claude Haiku 3.5 | 200,000 tokens | 8,192 tokens | Fastest, cheapest |
| Claude Sonnet 4 | 200,000 tokens | 16,000 tokens | Balanced |
| Claude Opus 4 | 200,000 tokens | 32,000 tokens | Most capable |
| GPT-4o | 128,000 tokens | 16,384 tokens | Used for routing |
| GPT-4o-mini | 128,000 tokens | 16,384 tokens | Cheapest OpenAI |
| o3 | 200,000 tokens | 100,000 tokens | Used for campaign creator |
| GPT-5 | 128,000 tokens | 32,768 tokens | Used for brick editor |

Source: https://docs.anthropic.com/en/docs/about-claude/models and https://platform.openai.com/docs/models

### Token Cost of Brick Data

A typical brick serialised as JSON:
```json
{
  "id": "69a7045c9b280e8a98a31ce6",
  "title": "Meta Campaign - Spring",
  "subType": "meta_campaign",
  "parentId": null,
  "metadata": { "dateStart": "2026-03-01", "dateEnd": "2026-04-30" },
  "data": { "metadata": { "plannedBudget": 5000 } }
}
```
Approximate token count: ~80-120 tokens per brick (varies by field count and string lengths).

| Dataset size | Approx tokens | % of 128k window |
|-------------|--------------|-----------------|
| 50 bricks | ~5,000 | 4% |
| 200 bricks | ~20,000 | 16% |
| 500 bricks | ~50,000 | 39% |
| 1,000 bricks | ~100,000 | 78% |
| 2,000 bricks | ~200,000 | Exceeds 128k models |
| 10,000 bricks | ~1,000,000 | Exceeds all models |

**Conclusion**: Full-context loading works up to ~500 bricks on Claude (200k window). Beyond that, retrieval or selective loading is required.

### Calculating Token Usage

Use Anthropic's tokeniser or tiktoken:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function countTokens(text: string): Promise<number> {
    const response = await client.messages.countTokens({
        model: "claude-sonnet-4-6",
        messages: [{ role: "user", content: text }]
    });
    return response.input_tokens;
}

// Count tokens for your campaign data before sending
const campaignJson = JSON.stringify(campaignBricks);
const tokenCount = await countTokens(campaignJson);
console.log(`Campaign data: ${tokenCount} tokens`);
```

Source: https://docs.anthropic.com/en/docs/build-with-claude/token-counting

### Prompt Caching

Anthropic supports caching repeated context sections (system prompt, static campaign metadata) to reduce cost and latency on multi-turn conversations.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
        {
            type: "text",
            text: "You are the Sidekick brick editor agent...",
            cache_control: { type: "ephemeral" }  // Cache this prefix
        },
        {
            type: "text",
            text: JSON.stringify(fullCampaignData),  // Cache expensive campaign data
            cache_control: { type: "ephemeral" }
        }
    ],
    messages: [
        { role: "user", content: userMessage }
    ]
});
```

Cache rules:
- Minimum cacheable block: 1,024 tokens
- Cache TTL: 5 minutes (ephemeral)
- Cache hit cost: 10% of normal input price
- Cache write cost: 125% of normal input price (amortises over subsequent calls)

Source: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching

### Context Compression Techniques

**1. Selective field loading** — strip fields the agent doesn't need:
```typescript
function compressBrick(brick: Brick): CompressedBrick {
    return {
        id: brick.id,
        title: brick.title,
        subType: brick.subType,
        parentId: brick.parentId,
        // Omit: createdAt, updatedAt, internal audit fields, raw asset URLs
    };
}
```

**2. Summary-first loading** — load a structural summary, then fetch detail on demand:
```typescript
// Initial context: compact hierarchy string
const summary = `Campaign: ${campaign.title}
- Ad Group 1: Retargeting (id: abc123)
  - Ad 1: Homepage Hero (id: def456)
  - Ad 2: Product Banner (id: ghi789)
- Ad Group 2: Prospecting (id: jkl012)
  - Ad 3: Brand Video (id: mno345)`;

// Tool fetches full detail only when needed
const get_brick = tool({
    description: "Get full details of a specific brick by ID",
    parameters: z.object({ brickId: z.string() }),
    execute: async ({ brickId }) => getBrickDetails(brickId)
});
```

**3. Lazy loading** — pass only selected brick context, load others via tools:
```typescript
// Only pass the currently selected brick as inline context
const systemPrompt = selections.length > 0
    ? `Selected brick: ${JSON.stringify(await getBrickDetails(selections[0].identifier))}`
    : `No brick selected. Use get_campaign to view the campaign structure.`;
```

## Use Cases Relevant to This Project

**Current state**: `getCampaign()` in `Agent.service.ts` loads the full campaign hierarchy as a text string and passes it to the agent. This works for campaigns up to ~500 bricks. For the current typical range (50-200 bricks), it uses roughly 5,000-20,000 tokens — well within limits.

**Where this breaks down**:
1. High-brick campaigns (>500) will start to degrade GPT-4o-mini routing (128k limit)
2. Multi-turn conversations accumulate history — 10 turns × 20k tokens = 200k tokens, hitting limits
3. `validateBrickData()` loads full brick schemas into the prompt, adding ~2,000-5,000 tokens per edit call

**Prompt caching opportunity**: The system prompt and campaign structure string are repeated on every turn. Caching them would reduce per-turn cost by ~60% after the first turn in a conversation.

## Tradeoffs

| Technique | Latency impact | Cost impact | Complexity | When to use |
|-----------|---------------|-------------|------------|-------------|
| Full context load | Baseline | Baseline | Low | <500 bricks |
| Selective field stripping | -5-10% | -20-30% | Low | Always — no reason not to |
| Prompt caching | -20-40% on cache hit | -50-60% after first turn | Low | Any repeated context >1,024 tokens |
| Summary-first + tools | +1 tool call | -40-60% | Medium | >200 bricks or complex structures |
| Lazy loading | +1-2 tool calls | -70-80% | Medium | When user typically edits 1 brick |
| RAG | +50-200ms retrieval | -80-90% | High | >1,000 bricks or semantic search needed |

## Recommended Approach for This Project

**Immediate (no architecture change)**:
1. Strip non-essential fields from brick serialisation in `getCampaign()` — saves 20-30% tokens
2. Add `cache_control: { type: "ephemeral" }` to the system prompt and campaign context blocks — saves ~60% cost on turns 2+

**Medium term (>200 bricks)**:
1. Switch to summary-first: pass the hierarchy string (already generated in `getCampaign()`) as initial context
2. Use `get_brick` tool for detail — it already exists in `BrickEditor.ts`
3. This eliminates the need to load all brick data upfront

**Do not implement RAG** for this use case. Campaign data is structured, relational, and small enough that hierarchical summarisation + tool fetching is simpler, faster, and more accurate than vector similarity search on JSON fields.

## Sources
- Anthropic model overview: https://docs.anthropic.com/en/docs/about-claude/models
- Anthropic token counting API: https://docs.anthropic.com/en/docs/build-with-claude/token-counting
- Anthropic prompt caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- OpenAI model overview: https://platform.openai.com/docs/models
- Anthropic pricing: https://www.anthropic.com/pricing
- OpenAI pricing: https://openai.com/api/pricing/
