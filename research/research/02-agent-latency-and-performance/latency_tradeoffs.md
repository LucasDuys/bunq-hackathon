# Latency Tradeoffs

## Summary

LLM agent latency is a function of four compounding factors: model selection, input token count, number of LLM round-trips, and tool execution time. A 44-second response from a LangGraph agent is not caused by any single factor but by the multiplicative effect of choosing a large model, sending it a large prompt, waiting for multiple sequential tool calls, and doing this 3-4 times per request. This document covers the specific latency characteristics of each Claude and GPT model, how token count affects response time, the cost of streaming vs non-streaming, common causes of slow agent runs, and the concrete tradeoffs involved in fixing them.

## Key Concepts

- **Time to First Token (TTFT)**: The delay from sending the API request to receiving the first response token. Dominated by the prefill phase (processing input tokens). The primary metric for perceived responsiveness.
- **Per-Token Latency (Inter-Token Latency)**: Time between consecutive output tokens during generation. Determines how fast text streams to the user.
- **Throughput (tokens/second)**: Total output tokens generated per second. Higher throughput means faster total completion.
- **Prefill Phase**: The phase where the model processes all input tokens in parallel. Scales roughly linearly with input token count due to GPU optimization.
- **Decode Phase**: The phase where the model generates output tokens one at a time, sequentially. This is where most wall-clock time is spent.
- **Prompt Caching**: Reusing previously processed prompt prefixes across API calls. Reduces both cost (10% of input price) and TTFT for repeated prompts.
- **Streaming**: Receiving response tokens as they are generated via SSE, rather than waiting for the complete response. Reduces perceived latency without changing total generation time.
- **Tool Chain Depth**: The number of sequential LLM call -> tool -> LLM call cycles in a single user request. Each cycle adds a full round-trip of TTFT + generation time.

## How It Works

### Token Count vs Latency: The Physics

LLM inference has two distinct phases with fundamentally different performance characteristics:

**Phase 1: Prefill (Input Processing)**
- Processes ALL input tokens in a single forward pass
- GPU parallelism makes this fast, but not free
- Each additional 1,000 input tokens adds approximately 200ms to TTFT (measured on GPT-4 Turbo, Azure PTU)
- At P95, the impact is ~240ms per 1,000 tokens
- A 15,000-token prompt vs a 5,000-token prompt adds ~2 seconds to TTFT alone

**Phase 2: Decode (Output Generation)**
- Generates tokens ONE AT A TIME, sequentially
- Each token requires a full forward pass through the model
- Output token generation is 20-400x slower than input token processing per token
- 100 input tokens have approximately the same latency impact as 1 output token
- A 500-token output at 50 tokens/second takes 10 seconds of sequential generation

**The practical implication**: For agent pipelines, the dominant latency factor is usually (number of LLM calls) x (output generation time per call), not input processing. But bloated prompts still contribute meaningfully.

**Concrete example for the Sidekick agent:**

```
Brick Editor flow (current, estimated):
  LLM Call #1 (Router, GPT-4o-mini):
    Input: 2,100 tokens → TTFT: ~600ms
    Output: 45 tokens → Generation: ~700ms
    Total: ~1.3s

  LLM Call #2 (Specialist, GPT-5):
    Input: 8,500 tokens → TTFT: ~1,700ms
    Output: 120 tokens → Generation: ~2,400ms
    Total: ~4.1s

  Tool calls: get_brick + get_brick_schema
    Sequential execution: ~900ms

  LLM Call #3 (Specialist, GPT-5):
    Input: 14,100 tokens → TTFT: ~2,800ms
    Output: 350 tokens → Generation: ~7,000ms
    Total: ~9.8s

  Tool call: edit_brick
    Execution: ~600ms

  LLM Call #4 (Specialist, GPT-5):
    Input: 15,200 tokens → TTFT: ~3,000ms
    Output: 180 tokens → Generation: ~3,600ms
    Total: ~6.6s

  TOTAL: ~23.3s (LLM calls only, plus ~1.5s tool execution)
  With overhead/variability: ~25-45s
```

### Model Latency Benchmarks (March 2026)

Real-world API latency benchmarks measured across different prompt lengths:

#### Short Prompts (~50 input tokens)

| Model | TTFT (avg) | TTFT (p95) | Total Latency (avg) | Throughput |
|-------|-----------|-----------|-------------------|-----------|
| Claude Haiku 4.5 | 639ms | 742ms | 952ms | 62 tok/s |
| GPT-4.1 | 889ms | 1,749ms | 1,770ms | 42.4 tok/s |
| Gemini 2.5 Flash | 1,753ms | 2,405ms | 2,021ms | 32.7 tok/s |
| Claude Sonnet 4 | 1,946ms | 2,358ms | 2,902ms | 20 tok/s |
| GPT-4.1 Mini | 2,205ms | 4,004ms | 3,541ms | 24.9 tok/s |

#### Medium Prompts (~200 input tokens)

| Model | TTFT (avg) | TTFT (p95) | Total Latency (avg) | Throughput |
|-------|-----------|-----------|-------------------|-----------|
| Claude Haiku 4.5 | 597ms | 612ms | 3,954ms | 78.9 tok/s |
| Gemini 2.5 Flash | 730ms | 752ms | 1,729ms | 146.5 tok/s |
| Claude Sonnet 4 | 1,042ms | 1,191ms | 7,616ms | 42.4 tok/s |
| GPT-4.1 Mini | 1,523ms | 2,094ms | 5,771ms | 55.8 tok/s |
| GPT-4.1 | 1,696ms | 2,037ms | 5,562ms | 50 tok/s |

#### Long Prompts (~500 input tokens)

| Model | TTFT (avg) | TTFT (p95) | Total Latency (avg) | Throughput |
|-------|-----------|-----------|-------------------|-----------|
| Claude Haiku 4.5 | 610ms | 843ms | 7,574ms | 135.2 tok/s |
| Claude Sonnet 4 | 1,216ms | 4,288ms | 20,445ms | 50.1 tok/s |
| GPT-4.1 | 1,670ms | 1,833ms | 16,900ms | 63 tok/s |
| Gemini 2.5 Flash | 1,885ms | 2,014ms | 6,485ms | 173 tok/s |
| GPT-4.1 Mini | 2,501ms | 2,609ms | 18,075ms | 62.2 tok/s |

**Key takeaway**: Claude Haiku 4.5 consistently achieves the fastest TTFT (597-639ms). For total latency on long outputs, Gemini 2.5 Flash leads due to its 173 tok/s throughput. Claude Sonnet 4 is 3-4x slower than Haiku on the same tasks.

### Model Pricing and Cost-Latency Tradeoffs

#### Anthropic Claude Models

| Model | Input ($/MTok) | Output ($/MTok) | Cache Write | Cache Read | Speed Class |
|-------|---------------|----------------|-------------|------------|-------------|
| Claude Haiku 4.5 | $1.00 | $5.00 | $1.25 | $0.10 | Fastest |
| Claude Sonnet 4.5 | $3.00 | $15.00 | $3.75 | $0.30 | Balanced |
| Claude Sonnet 4 | $3.00 | $15.00 | $3.75 | $0.30 | Balanced |
| Claude Opus 4.6 | $5.00 | $25.00 | $6.25 | $0.50 | Slowest (standard) |
| Claude Opus 4.6 (fast) | $30.00 | $150.00 | - | - | Fast (6x premium) |

**Prompt caching economics:**
- Cache write: 1.25x base input price (5-minute TTL) or 2x (1-hour TTL)
- Cache read: 0.1x base input price (90% savings)
- Break-even: After just 1 cache hit for 5-minute cache, 2 hits for 1-hour cache

**Batch processing:**
- 50% discount on both input and output tokens
- Available for all models
- Asynchronous processing (not real-time)

#### Cost per Brick Edit Request (Estimated)

Using the trace breakdown from the Observability section:

| Model Choice | Input Tokens | Output Tokens | Cost per Request | Latency (est.) |
|-------------|-------------|--------------|-----------------|----------------|
| GPT-5 (current) | ~42,000 | ~695 | ~$0.21 | 25-45s |
| Claude Sonnet 4 | ~42,000 | ~695 | ~$0.14 | 20-35s |
| Claude Haiku 4.5 | ~42,000 | ~695 | ~$0.05 | 8-15s |
| GPT-4.1 Mini | ~42,000 | ~695 | ~$0.06 | 15-25s |

With prompt caching (assuming 80% cache hit rate on system prompt):

| Model + Caching | Effective Input Cost | Cost per Request | Savings |
|-----------------|---------------------|-----------------|---------|
| Claude Sonnet 4 + cache | ~$0.02 (vs $0.13) | ~$0.03 | 85% input reduction |
| Claude Haiku 4.5 + cache | ~$0.007 (vs $0.04) | ~$0.01 | 82% input reduction |

### Streaming Responses

Streaming does not reduce total generation time, but it dramatically improves perceived latency by showing the first token as soon as it is available.

**Anthropic streaming implementation:**

```python
import anthropic

client = anthropic.Anthropic()

# Streaming mode
with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Edit the headline to 'Summer Sale'"}],
    tools=tools,
) as stream:
    for text in stream.text_stream:
        # Send each token to the frontend immediately
        await websocket.send(text)
```

**Event types in Anthropic streaming:**

```
1. message_start         → Contains Message object with empty content
2. content_block_start   → New content block begins (text or tool_use)
3. content_block_delta   → Incremental content (text_delta or input_json_delta)
4. content_block_stop    → Content block complete
5. message_delta         → Top-level message changes (usage, stop_reason)
6. message_stop          → Stream complete
```

**Streaming with tool use:**

When streaming and the model decides to call a tool, you receive:
- `content_block_start` with type `tool_use`
- Multiple `content_block_delta` with `input_json_delta` (partial JSON of tool input)
- `content_block_stop` when the tool call is fully specified

You can start preparing the tool execution as soon as you have enough of the JSON to identify the tool and its key parameters, before the full input is streamed.

```python
# Streaming with tool use
with client.messages.stream(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=messages,
    tools=tools,
) as stream:
    for event in stream:
        if event.type == "content_block_start":
            if event.content_block.type == "tool_use":
                # Tool call starting -- prepare execution
                tool_name = event.content_block.name
                tool_id = event.content_block.id
        elif event.type == "content_block_delta":
            if event.delta.type == "text_delta":
                # Stream text to user immediately
                await websocket.send(event.delta.text)
            elif event.delta.type == "input_json_delta":
                # Accumulate tool input JSON
                partial_json += event.delta.partial_json
        elif event.type == "content_block_stop":
            if current_block_is_tool:
                # Execute tool with complete input
                result = await execute_tool(tool_name, json.loads(partial_json))
```

**Perceived latency improvement from streaming:**

| Scenario | Without Streaming | With Streaming | Perceived Improvement |
|----------|-------------------|----------------|----------------------|
| Short response (50 tokens) | 3.0s (wait for all) | 0.6s TTFT | 80% faster perceived |
| Medium response (200 tokens) | 6.5s (wait for all) | 1.0s TTFT | 85% faster perceived |
| Long response (500 tokens) | 12.0s (wait for all) | 1.2s TTFT | 90% faster perceived |

Streaming is especially valuable for the final response to the user, where the specialist is summarizing what it did. The user can start reading while tokens are still generating.

### Common Causes of Slow Agent Runs

Based on research across production agent systems, the most common latency sources in order of impact:

#### 1. Excessive LLM Round-Trips (Highest Impact)

Every LLM call adds TTFT + output generation time. For a Sonnet-class model, that is 3-10 seconds per call.

**Common anti-pattern:**
```
Call 1: "What tools should I use?" → decides to call get_brick
Call 2: "Here's the brick data. What next?" → decides to call get_schema
Call 3: "Here's the schema. Now what?" → decides to call edit_brick
Call 4: "Edit succeeded. Summarize for user." → generates response
```
4 LLM calls x ~5 seconds each = 20 seconds just in LLM time.

**Fix**: Pre-fetch data, use parallel tool calls, prompt the model to plan all actions upfront.

#### 2. Large Input Context

Every token in the prompt adds to TTFT. Common causes:
- **Bloated system prompts**: Brand guidelines, full schema definitions, verbose instructions
- **Conversation history**: Including 20+ turns of conversation history
- **Tool outputs**: Returning entire JSON objects when only a few fields are needed
- **Tool definitions**: Each tool definition consumes tokens (346 system prompt tokens just for tool use in Claude 4.x, plus ~50-200 tokens per tool schema)

**Impact**: A 15,000-token prompt vs 5,000-token prompt adds ~2 seconds to TTFT per LLM call. Across 3 calls, that is 6 seconds.

**Fix**: Compress prompts, truncate conversation history, return only relevant fields from tools, use prompt caching.

#### 3. Sequential Tool Execution

When the LLM calls tools one at a time, each call adds network latency + execution time:

```
get_brick:        500ms
get_brick_schema: 400ms
edit_brick:       600ms
Total:           1,500ms (sequential)
```

If get_brick and get_brick_schema run in parallel:
```
get_brick + get_brick_schema: 500ms (parallel, limited by slowest)
edit_brick:                    600ms
Total:                        1,100ms (27% faster)
```

**Fix**: Enable parallel tool calls, restructure graph for fan-out/fan-in.

#### 4. Redundant Tool Calls

The LLM re-fetches data it already has. This happens when:
- Tool results are too large for the model to track in context
- The model "forgets" data from earlier in the conversation
- Conversation history is truncated, removing previous tool results

**Fix**: Cache tool results in the agent state, summarize large tool outputs, ensure conversation history retains key data.

#### 5. Retry Loops

When tool calls fail (validation errors, API timeouts), the LLM retries:

```
edit_brick attempt 1: FAIL (400ms + LLM reasoning 4s)
edit_brick attempt 2: FAIL (400ms + LLM reasoning 4s)
edit_brick attempt 3: SUCCESS (400ms + LLM reasoning 3s)
Total wasted: ~8.8s
```

**Fix**: Validate inputs before calling tools, improve error messages so the LLM can fix issues on the first retry, implement max retry limits.

#### 6. Cold Starts

Serverless deployments (Cloud Run) have cold start penalties:
- Container startup: 2-5 seconds
- Python runtime initialization: 1-2 seconds
- Model/connection warmup: 1-3 seconds

**Fix**: Keep minimum instances warm, use Cloud Run min-instances setting, pre-warm connections.

#### 7. Network Overhead

Each API call to OpenAI/Anthropic includes:
- DNS resolution: 10-50ms
- TLS handshake: 50-100ms (first request)
- Request serialization/deserialization: 10-30ms
- Response transfer: proportional to response size

With 3-4 LLM API calls per request, overhead adds up to 200-500ms.

**Fix**: Use connection pooling, keep-alive connections, deploy in regions close to API endpoints.

### The Compounding Effect

These factors multiply, not add. Here is a concrete model of how a simple brick edit reaches 44 seconds:

```
Base case: "Change headline to 'Summer Sale'"

Step 1: Cold start (Cloud Run)                          3.0s
Step 2: Load campaign context from MongoDB               0.8s
Step 3: Router LLM call (GPT-4o-mini, 2.1K tokens)      1.3s
Step 4: Specialist LLM call #1 (GPT-5, 8.5K tokens)     4.1s
   - Decides to call get_brick
Step 5: Execute get_brick (API call)                     0.5s
Step 6: Specialist LLM call #2 (14.1K tokens)            9.8s
   - Processes brick data, decides to call get_schema
Step 7: Execute get_brick_schema (API call)              0.4s
Step 8: Specialist LLM call #3 (16.3K tokens)           11.2s
   - Generates edit, calls edit_brick
Step 9: Execute edit_brick (API call)                    0.6s
Step 10: Specialist LLM call #4 (17.1K tokens)           7.2s
   - Summarizes result for user
Step 11: Response serialization                          0.1s
                                                   ─────────
TOTAL                                                   39.0s
Plus network overhead (~4%):                             1.6s
Plus variability (P95):                                 +3-5s
                                                   ─────────
P95 TOTAL                                           ~43-44s
```

### The Optimized Version

After applying the recommended optimizations:

```
Optimized: "Change headline to 'Summer Sale'"

Step 1: No cold start (min instances = 1)                0.0s
Step 2: Load context + brick + schema (parallel)         0.8s
   - All pre-fetched in parallel graph nodes
Step 3: Router LLM call (GPT-4o-mini, 1.2K tokens)      0.9s
   - Compressed prompt, cached system prompt
Step 4: Specialist LLM call #1 (Claude Haiku 4.5, 6K)   3.5s
   - Brick data + schema already in context
   - Generates edit in single pass, calls edit_brick
Step 5: Execute edit_brick (API call)                    0.6s
Step 6: Specialist LLM call #2 (Haiku 4.5, 7K)          2.1s
   - Summarizes result (or stream directly)
                                                   ─────────
TOTAL                                                    7.9s
```

**Savings breakdown:**
| Optimization | Seconds Saved | How |
|-------------|---------------|-----|
| Eliminate cold start | 3.0s | Cloud Run min-instances |
| Parallel pre-fetch | 0.4s | Graph-level fan-out |
| Compress prompts | 1.5s | Smaller system prompts, summarize context |
| Prompt caching | 1.0s | Cache system prompt (repeated across calls) |
| Eliminate 2 LLM round-trips | 15.0s | Pre-fetch data, parallel tool use |
| Faster model (Haiku 4.5 vs GPT-5) | 9.0s | Model swap for specialist |
| Stream final response | -2.0s perceived | User sees tokens immediately |
| **Total saved** | **~32s** | **From 44s to ~8s** |

## Use Cases Relevant to This Project

### Brick Editor Optimization Path

The brick editor is the most latency-sensitive operation because users expect near-instant edits. Recommended optimization order:

1. **Pre-fetch brick + schema** (graph change, saves 1 LLM round-trip)
2. **Switch specialist to Claude Haiku 4.5** for simple edits (model change, saves 5-10s)
3. **Keep GPT-5 or Sonnet for complex creative edits** (conditional routing)
4. **Enable prompt caching** for the system prompt (API config, saves 1-2s)
5. **Stream the final response** to the user (UX improvement, -2s perceived)
6. **Compress tool outputs** to only include relevant fields (prompt engineering)

### Campaign Creator Optimization

Campaign creation is less latency-sensitive but still benefits from:
- Prompt caching for the campaign template system prompt
- Pre-fetching brand guidelines and campaign history in parallel
- Using o3 only for complex creative decisions, Haiku for simple operations

### Multi-Model Routing Strategy

Not every request needs the same model. Implement quality-aware routing:

```
Simple edits ("change color to blue"):
  → Claude Haiku 4.5 (~3s, $0.01/request)

Complex creative ("rewrite headline for summer campaign targeting millennials"):
  → Claude Sonnet 4 (~8s, $0.14/request)

Campaign creation with brand compliance:
  → o3 (~15s, variable cost, no parallel tools)
```

### Prompt Caching for Repeated Context

The system prompt for the brick editor likely contains:
- Agent instructions (~500-1000 tokens)
- Tool definitions (~600 tokens for 3 tools)
- Brand guidelines (~1000-3000 tokens)
- Brick type documentation (~500-1000 tokens)

Total: ~2,600-5,600 tokens of repeated context per LLM call. With 3-4 LLM calls per request, that is 8,000-22,000 tokens re-processed every time.

With prompt caching:
- First call: Cache write (1.25x cost)
- Subsequent calls within 5 minutes: Cache read (0.1x cost, near-zero TTFT for cached portion)
- Across all tenants: If the system prompt is shared, every user benefits from the cache

## Tradeoffs

### Model Speed vs Quality

| Model | Latency | Quality | Cost | Best For |
|-------|---------|---------|------|----------|
| Claude Haiku 4.5 | Fastest (TTFT ~600ms) | Good for straightforward tasks | $1/$5 MTok | Simple edits, classification, routing |
| Claude Sonnet 4 | Medium (TTFT ~1,000ms) | Strong reasoning and creativity | $3/$15 MTok | Complex edits, creative writing |
| Claude Opus 4.6 | Slowest standard | Highest quality | $5/$25 MTok | Complex multi-step reasoning |
| Claude Opus 4.6 Fast | Fast | Highest quality | $30/$150 MTok | When you need quality + speed |
| GPT-4o-mini | Fast (~500ms TTFT) | Good for simple tasks | Low | Router, classification |
| GPT-4.1 | Medium | Strong all-around | $2/$8 MTok | General specialist tasks |
| o3 | Slow (reasoning time) | Strongest reasoning | Variable | Complex planning, no parallel tools |

### Streaming vs Non-Streaming

| Dimension | Streaming | Non-Streaming |
|-----------|-----------|--------------|
| **Perceived latency** | TTFT only (0.5-2s) | Full generation time (5-20s) |
| **Total generation time** | Same | Same |
| **Implementation complexity** | Higher (SSE handling, partial parsing) | Lower |
| **Tool use handling** | More complex (accumulate partial JSON) | Simple (full response available) |
| **Error handling** | Must handle mid-stream errors | Error before any output |
| **When to use** | User-facing responses | Internal agent-to-agent calls |

### Prompt Caching vs No Caching

| Dimension | With Caching | Without Caching |
|-----------|-------------|----------------|
| **First request cost** | 1.25x input price | 1x input price |
| **Subsequent requests** | 0.1x input price | 1x input price |
| **TTFT improvement** | Cached portion near-instant | Full prefill every time |
| **Break-even point** | After 1 cache hit (5-min) or 2 hits (1-hr) | N/A |
| **Implementation** | Add `cache_control` to request | Nothing |
| **Cache invalidation** | Automatic (TTL-based) | N/A |
| **Best for** | Repeated system prompts, shared context | One-off requests |

### Fewer Tokens vs Better Context

| Approach | Latency | Quality | Risk |
|----------|---------|---------|------|
| **Minimal prompt** (compress everything) | Lowest | Lower (model has less info) | Wrong edits, missed constraints |
| **Full context** (send everything) | Highest | Highest (model has all info) | Slow, expensive |
| **Selective context** (send relevant subset) | Medium | Good (if selection is good) | Miss relevant info if selection fails |
| **Cached full context** | Low (after first call) | Highest | Cache misses on first call |

### Pre-Fetch All Data vs On-Demand Tool Calls

| Approach | Latency | Token Usage | Flexibility |
|----------|---------|-------------|-------------|
| **Pre-fetch all** | Lower (no tool round-trips) | Higher (data in prompt even if unused) | Low (fixed data set) |
| **On-demand tools** | Higher (each tool = LLM round-trip) | Lower (only fetches what's needed) | High (LLM decides) |
| **Hybrid** (pre-fetch common, tools for rare) | Medium | Medium | Medium |

## Recommended Approach for This Project

**Implement a phased optimization plan targeting the highest-impact changes first:**

### Phase 1: Quick Wins (Week 1) -- Target: 44s to 20s

1. **Pre-fetch brick data and schema in parallel graph nodes** before the specialist LLM call. This eliminates 1-2 LLM round-trips. Expected savings: 5-10 seconds.

2. **Enable prompt caching** on the specialist's system prompt. Add `cache_control` to the system message. Expected savings: 1-2 seconds per request (after first call).

3. **Stream the final response** to the user via websocket. This does not reduce total time but makes the response feel 3-5 seconds faster.

### Phase 2: Model Optimization (Week 2) -- Target: 20s to 10s

4. **Route simple edits to Claude Haiku 4.5** instead of GPT-5. Most brick edits (color changes, text updates, toggling visibility) do not need a frontier model. Expected savings: 5-10 seconds.

5. **Keep GPT-5 or Claude Sonnet for complex creative edits** where quality matters more than speed.

6. **Compress tool outputs** -- instead of returning the full brick JSON (potentially 3,000+ tokens), return only the fields relevant to the edit request.

### Phase 3: Architecture (Week 3-4) -- Target: 10s to 6s

7. **Eliminate the summarization LLM call** -- instead of having the specialist generate a user-facing summary in a separate LLM call, have it include the summary in the edit response.

8. **Implement semantic caching** for repeated operations (e.g., the same brick type's schema does not change and should be cached).

9. **Add Cloud Run min-instances** to eliminate cold starts.

### Expected Result

| Phase | P95 Latency | Cost per Request |
|-------|-------------|-----------------|
| Current | 44s | ~$0.21 |
| After Phase 1 | ~20s | ~$0.15 |
| After Phase 2 | ~10s | ~$0.05 |
| After Phase 3 | ~6s | ~$0.03 |

The target of sub-8-second P95 latency is achievable with Phases 1 and 2 alone. Phase 3 provides additional headroom and cost savings.

## Sources

- [Anthropic Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic Streaming Messages API](https://platform.claude.com/docs/en/api/messages-streaming)
- [How Input Token Count Impacts LLM Latency - Glean](https://www.glean.com/blog/glean-input-token-llm-latency)
- [LLM API Latency Benchmarks 2026 - Kunal Ganglani](https://www.kunalganglani.com/blog/llm-api-latency-benchmarks-2026)
- [LLM Latency Benchmark by Use Cases 2026 - AIMultiple](https://research.aimultiple.com/llm-latency-benchmark/)
- [Understanding LLM Latency and Throughput Metrics - Anyscale](https://docs.anyscale.com/llm/serving/benchmarking/metrics)
- [Key Metrics for LLM Inference - BentoML](https://bentoml.com/llm/inference-optimization/llm-inference-metrics)
- [Understanding LLM Response Latency - Medium](https://medium.com/@gezhouz/understanding-llm-response-latency-a-deep-dive-into-input-vs-output-processing-2d83025b8797)
- [LLM Token Optimization: Cut Costs and Latency - Redis](https://redis.io/blog/llm-token-optimization-speed-up-apps/)
- [Comparing Latencies: OpenAI, Azure, Anthropic - PromptHub](https://www.prompthub.us/blog/comparing-latencies-get-faster-responses-from-openai-azure-and-anthropic)
- [Why Your AI Agent Is Slow - DEV Community](https://dev.to/askpatrick/why-your-ai-agent-is-slow-hint-its-not-the-model-4fja)
- [How Poor Tool Calling Increases LLM Cost and Latency - DEV Community](https://dev.to/amartyajha/how-poor-tool-calling-behavior-increases-llm-cost-and-latency-3idf)
- [Why Bad Tool Calling Makes LLMs Slow and Expensive - CodeAnt](https://www.codeant.ai/blogs/poor-tool-calling-llm-cost-latency)
- [Why Multi-Agent LLM Systems Fail - Galileo](https://galileo.ai/blog/multi-agent-llm-systems-fail)
- [Common Solutions to Latency Issues in LLM Applications - Medium](https://medium.com/@mancity.kevindb/common-solutions-to-latency-issues-in-llm-applications-d58b8cf4be17)
- [LLM Tool-Calling in Production: Rate Limits and Retries - Medium](https://medium.com/@komalbaparmar007/llm-tool-calling-in-production-rate-limits-retries-and-the-infinite-loop-failure-mode-you-must-2a1e2a1e84c8)
- [Understanding LLM Latency and Token Generation - Proxet](https://www.proxet.com/blog/llm-has-a-performance-problem-inherent-to-its-architecture-latency)
- [Anthropic Claude Review 2026 - Hackceleration](https://hackceleration.com/anthropic-review/)
- [Claude Haiku 4.5 Benchmarks - LLM Stats](https://llm-stats.com/models/claude-haiku-4-5-20251001)
- [Anthropic API Pricing Guide 2026 - MetaCTO](https://www.metacto.com/blogs/anthropic-api-pricing-a-full-breakdown-of-costs-and-integration)
- [Anthropic API Pricing Guide 2026 - nOps](https://www.nops.io/blog/anthropic-api-pricing/)
