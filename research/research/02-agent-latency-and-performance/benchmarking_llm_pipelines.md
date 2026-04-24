# Benchmarking LLM Pipelines

## Summary

Benchmarking an LLM agent pipeline means instrumenting every step -- LLM calls, tool executions, retrieval operations, and custom logic -- to collect timing, token usage, and cost data so you can identify and fix bottlenecks. For a LangGraph-based agent seeing 44-second response times, the first step is always to measure where those seconds are actually going. This document covers the major instrumentation approaches (OpenTelemetry, LangSmith, Langfuse, Helicone) and how to apply them to a LangGraph pipeline.

## Key Concepts

- **Trace**: A complete record of a single request flowing through your system, from user input to final response. Contains nested spans.
- **Span**: A single operation within a trace (e.g., one LLM call, one tool execution). Has a start time, end time, and attributes.
- **TTFT (Time to First Token)**: How long before the user sees the first token of a response. Critical for perceived latency.
- **Per-Token Latency**: Time to generate each subsequent output token. Dominated by the sequential decode phase.
- **Token Usage**: Input and output token counts per LLM call. Directly affects both cost and latency.
- **P50/P95/P99 Latency**: Percentile-based latency metrics. P95 means 95% of requests complete faster than this value. Use P95 for production targets.
- **Prefill Phase**: The phase where the model processes input tokens in parallel. Fast, but scales with input size.
- **Decode Phase**: The phase where the model generates output tokens sequentially. This is where most latency lives.
- **Superstep**: A LangGraph concept where multiple nodes execute concurrently within a single execution unit.

## How It Works

### Step 1: Choose Your Instrumentation Stack

There are four main approaches, each with different trade-offs:

| Tool | Type | Setup Effort | Self-Hostable | Cost | Best For |
|------|------|-------------|---------------|------|----------|
| LangSmith | SaaS platform | Minimal (env vars) | No | Free tier + paid | LangChain/LangGraph-native projects |
| Langfuse | Open-source platform | Low-Medium | Yes | Free (self-hosted) or SaaS | Teams wanting data ownership |
| Helicone | Proxy-based | Minimal (URL change) | Yes | Free tier + $20/seat/mo | Quick setup, multi-provider monitoring |
| OpenTelemetry | Standard/protocol | Medium-High | N/A (protocol) | Free (protocol) | Existing OTEL infrastructure, vendor-neutral |

### Step 2: Instrument with LangSmith (Fastest Path for LangGraph)

Since this project already uses LangGraph, LangSmith is the lowest-friction option. Tracing is enabled with environment variables alone:

```bash
# Install the LangSmith SDK
pip install "langsmith[otel]"

# Set environment variables
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=<your_api_key>
export LANGSMITH_ENDPOINT=https://api.smith.langchain.com
export LANGSMITH_PROJECT=sidekick-agent  # organize traces by project
```

Once set, every LangChain and LangGraph operation automatically emits traces. Each node in the graph, each LLM call, each tool invocation becomes a span with timing and token data.

For the router-specialist pattern, traces will show:
1. Router node (GPT-4o-mini) -- should be fast, ~500-1500ms
2. Specialist node (Campaign Creator o3 / Platform Expert RAG / Brick Editor GPT-5) -- likely the bulk of latency
3. Tool calls within specialists (get_brick, get_brick_schema, edit_brick) -- external API calls adding latency

### Step 3: Add OpenTelemetry for Custom Spans

For operations outside LangChain (e.g., custom MongoDB queries, Redis cache lookups, internal API calls), add OpenTelemetry spans directly:

```python
# Install OTEL packages
# pip install opentelemetry-sdk opentelemetry-exporter-otlp

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

# Configure exporter to send traces to LangSmith's OTEL endpoint
otlp_exporter = OTLPSpanExporter(
    endpoint="https://api.smith.langchain.com/otel",
    headers={"x-api-key": "<your_langsmith_api_key>"}
)

# Set up the tracer provider
provider = TracerProvider()
provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("sidekick-agent")
```

Now instrument custom operations:

```python
# Instrument a database lookup
async def load_campaign_context(campaign_id: str):
    with tracer.start_as_current_span("load_campaign_context") as span:
        span.set_attribute("campaign.id", campaign_id)
        span.set_attribute("langsmith.span.kind", "retriever")

        # Time the MongoDB query
        with tracer.start_as_current_span("mongodb.find_campaign") as db_span:
            db_span.set_attribute("db.system", "mongodb")
            campaign = await db.campaigns.find_one({"_id": campaign_id})
            db_span.set_attribute("db.response_size", len(str(campaign)))

        # Time the context assembly
        with tracer.start_as_current_span("assemble_context") as ctx_span:
            context = format_campaign_for_prompt(campaign)
            ctx_span.set_attribute("context.token_count", count_tokens(context))

        return context
```

Instrument tool calls within the brick editor agent:

```python
# Instrument individual tool calls
async def get_brick(brick_id: str):
    with tracer.start_as_current_span("tool.get_brick") as span:
        span.set_attribute("langsmith.span.kind", "tool")
        span.set_attribute("brick.id", brick_id)

        start = time.monotonic()
        result = await brick_api.get(brick_id)
        elapsed = time.monotonic() - start

        span.set_attribute("tool.latency_ms", elapsed * 1000)
        span.set_attribute("tool.response_size_bytes", len(json.dumps(result)))
        return result
```

### Step 4: Add GenAI Semantic Convention Attributes

OpenTelemetry has standardized attributes for LLM operations. Use these for consistent cross-platform analysis:

```python
with tracer.start_as_current_span("llm.router_call") as span:
    # Standard GenAI attributes
    span.set_attribute("gen_ai.system", "openai")
    span.set_attribute("gen_ai.request.model", "gpt-4o-mini")
    span.set_attribute("gen_ai.request.temperature", 0.0)
    span.set_attribute("gen_ai.request.max_tokens", 500)

    # After the call completes
    span.set_attribute("gen_ai.usage.prompt_tokens", response.usage.prompt_tokens)
    span.set_attribute("gen_ai.usage.completion_tokens", response.usage.completion_tokens)
    span.set_attribute("gen_ai.response.model", response.model)

    # LangSmith-specific attributes
    span.set_attribute("langsmith.span.kind", "LLM")
    span.set_attribute("langsmith.metadata.agent_type", "router")
```

### Step 5: Set Up Langfuse as an Alternative/Complement

Langfuse can run alongside LangSmith or replace it. It offers self-hosting for data sovereignty:

```python
# pip install langfuse

from langfuse import Langfuse
from langfuse.callback import CallbackHandler

# Initialize Langfuse client
langfuse = Langfuse(
    public_key="pk-...",
    secret_key="sk-...",
    host="https://cloud.langfuse.com"  # or self-hosted URL
)

# Use as a LangChain callback handler
langfuse_handler = CallbackHandler()

# Pass to LangGraph invocations
result = await graph.ainvoke(
    {"messages": [user_message]},
    config={"callbacks": [langfuse_handler]}
)
```

Using the `@observe()` decorator for custom functions:

```python
from langfuse.decorators import observe, langfuse_context

@observe()
async def process_brick_edit(user_request: str, brick_id: str):
    # Everything inside this function becomes part of the trace
    brick = await get_brick(brick_id)
    schema = await get_brick_schema(brick.type)

    # Add metadata to the current observation
    langfuse_context.update_current_observation(
        metadata={"brick_id": brick_id, "brick_type": brick.type}
    )

    result = await llm.invoke(build_edit_prompt(user_request, brick, schema))
    return result
```

### Step 6: Set Up Helicone as a Proxy Layer

Helicone sits between your application and the LLM API, requiring only a base URL change:

```python
from openai import OpenAI

# Standard OpenAI client -- just change the base URL
client = OpenAI(
    api_key="sk-...",
    base_url="https://oai.helicone.ai/v1",
    default_headers={
        "Helicone-Auth": "Bearer <your_helicone_key>",
        "Helicone-Session-Id": session_id,  # group related calls
        "Helicone-Session-Name": "brick-edit",
        "Helicone-Property-Agent": "brick_editor",
    }
)
```

Helicone adds approximately 50-80ms of latency per request due to its proxy architecture.

### Step 7: Define What to Measure

For diagnosing a 44-second response time, collect these metrics at each stage:

```
Target breakdown for a brick edit operation:
┌─────────────────────────────────────────────────────┐
│ Total Response Time: 44s (target: <8s)              │
├─────────────────────────────────────────────────────┤
│ 1. Context Loading         │ ???ms  │ target: <500ms│
│    ├─ Campaign fetch       │        │               │
│    ├─ Brick fetch          │        │               │
│    └─ Schema fetch         │        │               │
│ 2. Router LLM Call         │ ???ms  │ target: <1.5s │
│    ├─ TTFT                 │        │               │
│    └─ Total generation     │        │               │
│ 3. Specialist LLM Call     │ ???ms  │ target: <5s   │
│    ├─ TTFT                 │        │               │
│    ├─ Token generation     │        │               │
│    └─ Input token count    │        │               │
│ 4. Tool Execution          │ ???ms  │ target: <1s   │
│    ├─ get_brick            │        │               │
│    ├─ get_brick_schema     │        │               │
│    └─ edit_brick           │        │               │
│ 5. Additional LLM Rounds   │ ???ms  │ target: 0     │
│    └─ (redundant calls?)   │        │               │
└─────────────────────────────────────────────────────┘
```

### Step 8: Collect and Analyze

Once instrumented, collect data across 50-100 representative requests. Key queries:

1. **Where does time go?** Sort spans by duration. Identify the top 3 time consumers.
2. **How many LLM calls per request?** If the brick editor makes 3+ LLM calls (router + specialist + tool processing), each adds 2-10 seconds.
3. **How many tool calls per request?** Each sequential tool call adds network latency. Are any redundant?
4. **What is the input token count?** Large system prompts or campaign contexts bloat TTFT. Every 1000 extra input tokens adds ~200ms TTFT.
5. **Are there retry loops?** Failed tool calls being retried silently can double response times.

## Use Cases Relevant to This Project

### Diagnosing the 44-Second Response Time

The router-specialist architecture has multiple potential bottleneck points:

1. **Router call (GPT-4o-mini)**: Should complete in 500-2000ms. If it takes longer, the system prompt or conversation context is too large.
2. **Brick Editor specialist (GPT-5)**: This is likely the largest single contributor. GPT-5 with tool use and a large system prompt could easily take 5-15 seconds per LLM call, and if multiple rounds of tool calls are needed (get_brick -> get_schema -> edit_brick), each round adds another LLM call.
3. **Tool execution (get_brick, get_brick_schema, edit_brick)**: If these hit external APIs or databases sequentially, each adds 100-500ms. If the brick data is large, serialization/deserialization adds more.
4. **Multiple LLM rounds**: The brick editor likely needs to: (a) decide which tools to call, (b) process tool results, (c) generate the edit. That is 3 LLM calls minimum, each taking 2-8 seconds.

### Campaign Context Loading

Campaign data (creatives, brand guidelines, previous edits) loaded as context directly affects input token count and thus TTFT. Instrument the context assembly step to measure:
- How many tokens does the campaign context add?
- Could any of it be cached or pre-computed?
- Is irrelevant context being loaded?

### Multi-Tenant Performance Comparison

With tenants like KLM, Philips, and Takeaway having different campaign complexities, tracing can reveal:
- Do certain tenants consistently have slower responses?
- Are some campaign types inherently more complex (more bricks, larger schemas)?
- Can tenant-specific optimizations be justified?

## Tradeoffs

### LangSmith vs Langfuse vs Helicone vs Raw OpenTelemetry

| Dimension | LangSmith | Langfuse | Helicone | OpenTelemetry |
|-----------|-----------|----------|----------|---------------|
| **Setup time** | Minutes (env vars) | 30min-1hr | Minutes (URL change) | Hours-Days |
| **LangGraph integration** | Native, automatic | Callback handler | Proxy (no graph visibility) | Manual spans |
| **Trace depth** | Full graph + LLM + tools | Full with decorators | LLM calls only | Whatever you instrument |
| **Self-hostable** | No | Yes (Docker/K8s) | Yes (Docker/K8s) | N/A (protocol) |
| **Data privacy** | Data sent to LangChain | Self-hosted option | Self-hosted option | Your infra |
| **Cost (SaaS)** | Free tier, then usage-based | Free tier, then usage-based | Free 10K req, $20/seat/mo | Free |
| **Added latency** | ~0ms (async callbacks) | ~0ms (async batching) | 50-80ms (proxy) | ~0ms (async export) |
| **Alerting** | Webhook, PagerDuty | Webhook | Slack, email | Depends on backend |
| **LLM evaluation** | Built-in LLM-as-judge | Built-in LLM-as-judge | Basic metrics | None (bring your own) |
| **Vendor lock-in** | High (LangChain ecosystem) | Low (open-source, OTEL) | Medium | None |

### When to Use Each

- **LangSmith**: You already use LangChain/LangGraph and want the fastest path to visibility. Accept vendor lock-in for convenience.
- **Langfuse**: You want open-source, self-hosting, or plan to switch LLM frameworks. Good middle ground.
- **Helicone**: You want cost/latency monitoring without touching application code. Limited visibility into agent internals.
- **OpenTelemetry direct**: You have existing OTEL infrastructure (Datadog, New Relic, Grafana) and want LLM traces alongside application traces.

## Recommended Approach for This Project

**Start with LangSmith, add OpenTelemetry custom spans for non-LangChain operations.**

Rationale:
1. The project already uses LangGraph, so LangSmith gives automatic full-depth tracing with just environment variables.
2. The 44-second latency diagnosis is urgent -- LangSmith can be turned on in production in minutes, not days.
3. Custom OTEL spans should be added for MongoDB queries, Redis cache operations, and any internal API calls that are not part of the LangChain/LangGraph execution.
4. LangSmith traces are already available (mentioned in the project brief), so the infrastructure exists.
5. Once the latency problem is diagnosed and fixed, evaluate whether to add Langfuse for self-hosting or long-term cost savings.

**Immediate action items:**
1. Ensure `LANGSMITH_TRACING=true` is set in all environments.
2. Add custom spans for tool execution (get_brick, get_brick_schema, edit_brick) to measure external API latency.
3. Add token count logging to identify which prompts are bloated.
4. Collect 50+ traces of brick edit operations and sort by total duration.
5. Identify the top 3 time consumers and address them in order.

## Sources

- [Trace with OpenTelemetry - LangSmith Docs](https://docs.langchain.com/langsmith/trace-with-opentelemetry)
- [End-to-End OpenTelemetry Support in LangSmith (Blog)](https://blog.langchain.com/end-to-end-opentelemetry-langsmith/)
- [AI Agent Observability - OpenTelemetry Blog (2025)](https://opentelemetry.io/blog/2025/ai-agent-observability/)
- [Instrument LangChain and LangGraph Apps with OpenTelemetry - Last9](https://last9.io/blog/langchain-and-langgraph-instrumentation-guide/)
- [LangChain Observability with OpenTelemetry - SigNoz](https://signoz.io/blog/langchain-observability-with-opentelemetry/)
- [Langfuse Observability Overview](https://langfuse.com/docs/observability/overview)
- [Get Started with Langfuse Tracing](https://langfuse.com/docs/observability/get-started)
- [Langfuse GitHub Repository](https://github.com/langfuse/langfuse)
- [Langfuse OpenTelemetry Integration](https://langfuse.com/integrations/native/opentelemetry)
- [Helicone GitHub Repository](https://github.com/Helicone/helicone)
- [Helicone Quickstart Docs](https://docs.helicone.ai/)
- [Helicone LLM Observability Guide](https://www.helicone.ai/blog/the-complete-guide-to-LLM-observability-platforms)
- [AI Engineer's Guide to LLM Observability with OpenTelemetry - Agenta](https://agenta.ai/blog/the-ai-engineer-s-guide-to-llm-observability-with-opentelemetry)
- [Tracing LangChain with OpenTelemetry - New Relic](https://newrelic.com/blog/log/tracing-langchain-applications-with-opentelemetry)
- [LangSmith Observability Platform](https://www.langchain.com/langsmith/observability)
- [Advanced LangSmith Tracing Techniques 2025 - SparkCo](https://sparkco.ai/blog/advanced-langsmith-tracing-techniques-in-2025)
