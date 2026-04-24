# Observability and Tracing

## Summary

Observability for LLM agents means capturing structured records of every operation -- LLM calls, tool executions, retrieval steps, and custom logic -- along with timing, token usage, costs, and inputs/outputs. LangSmith is the native observability platform for LangChain/LangGraph applications, while Langfuse is the leading open-source alternative. For diagnosing a 44-second agent response time, effective tracing is the prerequisite to every other optimization: you cannot fix what you cannot see.

## Key Concepts

- **Trace**: The complete record of a single end-to-end request. In an agent system, one trace covers everything from user input to final response, including all LLM calls, tool executions, and intermediate reasoning.
- **Span/Observation**: A single operation within a trace. Spans are nested hierarchically -- a "brick_edit" trace might contain spans for "router_llm_call", "get_brick_tool", "specialist_llm_call", etc.
- **Run**: LangSmith's term for a span. Each LangChain/LangGraph operation creates a "run" that appears in the trace tree.
- **Session**: A group of related traces, typically representing a multi-turn conversation. Useful for tracking how agent performance evolves across turns.
- **Latency (P50/P95/P99)**: Percentile-based response time metrics. P50 is the median; P95 means 95% of requests are faster than this value. For production agents, P95 is the target metric.
- **TTFT (Time to First Token)**: Time from request to first token received. Determines perceived responsiveness.
- **Token Usage**: Input and output token counts. Directly correlates with cost and latency.
- **Feedback Score**: A quality rating (automated or human) attached to a trace. Used to correlate quality with latency.
- **Online Evaluation**: Real-time automated quality scoring using LLM-as-judge or code-based evaluators running on production traces.

## How It Works

### LangSmith Tracing Setup

#### Step 1: Enable Tracing

The minimum setup requires two environment variables:

```bash
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=lsv2_pt_xxxxx
```

Optional but recommended:

```bash
export LANGSMITH_PROJECT=sidekick-agent-production  # Organize by environment
export LANGSMITH_ENDPOINT=https://api.smith.langchain.com
# For EU region: https://eu.api.smith.langchain.com
```

Once set, every LangChain and LangGraph operation automatically emits traces. No code changes needed for basic tracing.

#### Step 2: Understand the Trace Structure

For the Sidekick agent's router-specialist architecture, a typical trace looks like:

```
Trace: "Edit brick headline" (total: 44.2s)
├── Router (GPT-4o-mini)
│   ├── Input: 2,100 tokens (system prompt + user message + conversation history)
│   ├── Output: 45 tokens (routing decision)
│   ├── Latency: 1.2s
│   └── Cost: $0.0003
├── Brick Editor Specialist (GPT-5)
│   ├── LLM Call #1: "Decide which tools to call"
│   │   ├── Input: 8,500 tokens (system prompt + brick context + user request)
│   │   ├── Output: 120 tokens (tool_use: get_brick + get_brick_schema)
│   │   ├── Latency: 4.8s
│   │   └── Cost: $0.045
│   ├── Tool: get_brick
│   │   ├── Latency: 450ms
│   │   └── Output size: 3,200 tokens
│   ├── Tool: get_brick_schema
│   │   ├── Latency: 380ms
│   │   └── Output size: 1,800 tokens
│   ├── LLM Call #2: "Process tool results and generate edit"
│   │   ├── Input: 14,100 tokens (previous context + tool results)
│   │   ├── Output: 350 tokens (tool_use: edit_brick)
│   │   ├── Latency: 8.2s
│   │   └── Cost: $0.078
│   ├── Tool: edit_brick
│   │   ├── Latency: 620ms
│   │   └── Output: confirmation
│   ├── LLM Call #3: "Summarize result for user"
│   │   ├── Input: 15,200 tokens (full context + edit result)
│   │   ├── Output: 180 tokens (user-facing response)
│   │   ├── Latency: 6.1s
│   │   └── Cost: $0.082
│   └── Total specialist time: 20.5s
├── Response formatting
│   └── Latency: 0.1s
└── Total trace latency: 44.2s
    Total tokens: ~42,000 input, ~695 output
    Total cost: ~$0.21
```

#### Step 3: Navigate the LangSmith Dashboard

Key views for latency diagnosis:

**Project Dashboard:**
- P50, P95, P99 latency over time
- Token usage trends
- Error rate
- Request volume
- Cost per request

**Trace List:**
- Filter by latency (e.g., show traces > 30 seconds)
- Filter by metadata (e.g., agent_type = "brick_editor")
- Filter by error status
- Sort by duration to find worst cases

**Individual Trace View:**
- Waterfall visualization showing timing of each span
- Input/output for each LLM call (useful for prompt debugging)
- Token counts per span
- Run tree hierarchy

#### Step 4: Set Up Monitoring Rules and Alerts

LangSmith supports alerts via webhook and PagerDuty integration:

```
Alert: "Brick Editor Slow Response"
Condition: P95 latency > 15 seconds over 15-minute window
Channel: Slack webhook
Metadata filter: agent_type = "brick_editor"
```

```
Alert: "High Token Usage"
Condition: Average input tokens > 20,000 per trace
Channel: Email
Project: sidekick-agent-production
```

#### Step 5: Add Custom Metadata for Filtering

Tag traces with metadata for better filtering:

```python
from langchain_core.runnables import RunnableConfig

config = RunnableConfig(
    metadata={
        "agent_type": "brick_editor",
        "tenant": "klm",
        "campaign_id": "camp_abc123",
        "brick_type": "hero_banner",
        "user_id": "user_456",
        "environment": "production"
    },
    tags=["brick-edit", "v2-agent"]
)

result = await graph.ainvoke(state, config=config)
```

Now you can filter traces by tenant, campaign type, brick type, etc. to identify patterns.

#### Step 6: Use the Insights Agent

LangSmith's Insights Agent automatically analyzes traces to surface patterns:
- **Topic clustering**: Groups similar requests to identify common use cases
- **Error analysis**: Identifies recurring error patterns and root causes
- **Executive summaries**: Highlights key performance trends and anomalies

#### Step 7: Add Custom Spans for Non-LangChain Operations

For operations outside LangChain (MongoDB queries, Redis cache, internal APIs):

```python
from langsmith import traceable

@traceable(run_type="retriever", name="load_campaign_context")
async def load_campaign_context(campaign_id: str):
    """Load campaign data from MongoDB. Automatically traced by LangSmith."""
    campaign = await db.campaigns.find_one({"_id": campaign_id})
    return format_for_prompt(campaign)

@traceable(run_type="tool", name="check_redis_cache")
async def check_redis_cache(key: str):
    """Check Redis for cached brick data. Automatically traced."""
    return await redis.get(key)

@traceable(run_type="chain", name="validate_brick_edit")
async def validate_brick_edit(brick_data: dict, schema: dict, edit: dict):
    """Validate an edit against the brick schema. Automatically traced."""
    return jsonschema.validate(edit, schema)
```

The `@traceable` decorator creates spans that appear in the LangSmith trace tree alongside LangChain operations.

### Langfuse as an Open-Source Alternative

#### Why Consider Langfuse

| Feature | LangSmith | Langfuse |
|---------|-----------|----------|
| Self-hosting | No | Yes (Docker, K8s) |
| Open-source | No | Yes (MIT license) |
| Data sovereignty | LangChain servers | Your infrastructure |
| LangChain integration | Native (automatic) | Callback handler |
| OpenTelemetry support | Yes (OTEL exporter) | Yes (native) |
| Prompt management | Yes | Yes |
| Online evaluation | LLM-as-judge | LLM-as-judge |
| Cost | Usage-based SaaS | Free (self-hosted) or SaaS |
| Dashboard quality | Excellent | Good |
| Alerting | Webhook, PagerDuty | Webhook |

#### Langfuse Setup with LangGraph

```python
# pip install langfuse

from langfuse.callback import CallbackHandler

# Option 1: Environment variables
# LANGFUSE_PUBLIC_KEY=pk-...
# LANGFUSE_SECRET_KEY=sk-...
# LANGFUSE_HOST=https://cloud.langfuse.com (or self-hosted URL)

langfuse_handler = CallbackHandler()

# Pass as callback to LangGraph
result = await graph.ainvoke(
    {"messages": [user_message]},
    config={"callbacks": [langfuse_handler]}
)
```

#### Using the @observe Decorator

```python
from langfuse.decorators import observe, langfuse_context

@observe()
async def handle_brick_edit(user_request: str, brick_id: str):
    """Top-level function creates a trace."""

    # Add metadata
    langfuse_context.update_current_trace(
        metadata={"brick_id": brick_id, "tenant": "klm"},
        tags=["brick-edit"]
    )

    # Nested @observe creates child spans
    brick = await fetch_brick(brick_id)
    schema = await fetch_schema(brick["type"])
    result = await generate_edit(user_request, brick, schema)

    # Score the trace
    langfuse_context.score_current_trace(
        name="latency_acceptable",
        value=1 if langfuse_context.current_trace_duration < 8000 else 0
    )

    return result

@observe()
async def fetch_brick(brick_id: str):
    """Creates a child span within the parent trace."""
    return await brick_api.get(brick_id)

@observe()
async def fetch_schema(brick_type: str):
    return await schema_api.get(brick_type)

@observe(as_type="generation")
async def generate_edit(request: str, brick: dict, schema: dict):
    """as_type='generation' captures LLM-specific metrics (tokens, model, etc.)"""
    response = await llm.invoke(build_prompt(request, brick, schema))
    return response
```

#### Langfuse Trace Data Model

Langfuse organizes data in three layers:

```
Session (multi-turn conversation)
└── Trace (single request/response)
    ├── Generation (LLM call)
    │   ├── model: "gpt-5"
    │   ├── input_tokens: 8500
    │   ├── output_tokens: 120
    │   ├── latency: 4800ms
    │   └── cost: $0.045
    ├── Span (custom operation)
    │   ├── name: "get_brick"
    │   ├── latency: 450ms
    │   └── metadata: {brick_id: "abc123"}
    ├── Generation (LLM call #2)
    │   └── ...
    └── Event (point-in-time occurrence)
        └── name: "cache_miss"
```

#### Langfuse Performance Monitoring Dashboard

Langfuse tracks:
- **Latency distribution**: P50, P75, P90, P95, P99 across all traces
- **Cost by model**: Breakdown of spend per model per time period
- **Token usage trends**: Input vs output tokens over time
- **Error rates**: Failed generations, tool errors, timeout rates
- **Custom scores**: Automated quality evaluations attached to traces
- **Session analysis**: How latency evolves across conversation turns

### Debugging Slow Runs: A Step-by-Step Process

#### Step 1: Identify Slow Traces

In LangSmith or Langfuse, filter traces where total latency exceeds your target:

```
Filter: latency > 30s AND metadata.agent_type = "brick_editor"
Sort: latency descending
Time range: last 7 days
```

#### Step 2: Examine the Waterfall

For each slow trace, look at the waterfall visualization. Common patterns:

**Pattern A: One Dominant LLM Call**
```
├── Router: 1.2s
├── Specialist LLM #1: 18.5s  <-- BOTTLENECK
├── Tool execution: 0.4s
├── Specialist LLM #2: 12.8s  <-- ALSO SLOW
└── Total: 33s
```
Diagnosis: Large input context is inflating LLM latency. Check input token count.

**Pattern B: Many Sequential Tool Calls**
```
├── Router: 1.2s
├── Specialist LLM: 4.2s
├── Tool: get_brick: 0.5s
├── Specialist LLM: 3.8s
├── Tool: get_schema: 0.4s
├── Specialist LLM: 3.5s
├── Tool: edit_brick: 0.6s
├── Specialist LLM: 3.2s  <-- Summarize result
└── Total: 17.4s
```
Diagnosis: 4 LLM calls where 2-3 would suffice. Enable parallel tool use or pre-fetch data.

**Pattern C: Retry Loop**
```
├── Router: 1.2s
├── Specialist LLM: 4.5s
├── Tool: edit_brick: 0.3s (FAILED - validation error)
├── Specialist LLM: 4.1s  <-- "Let me try again"
├── Tool: edit_brick: 0.3s (FAILED - different validation error)
├── Specialist LLM: 3.8s  <-- "One more time"
├── Tool: edit_brick: 0.4s (SUCCESS)
├── Specialist LLM: 3.5s
└── Total: 18.1s
```
Diagnosis: Edit validation failures causing retry loops. Improve schema in prompt or add validation before edit_brick.

**Pattern D: Context Loading Bottleneck**
```
├── Load campaign context: 3.2s  <-- DB QUERY SLOW
├── Load brick data: 1.8s
├── Load brand guidelines: 2.1s
├── Router: 1.5s
├── Specialist LLM: 8.2s
└── Total: 16.8s
```
Diagnosis: Database queries are slow. Add caching or parallelize fetches.

#### Step 3: Check Token Counts

For each LLM call in the trace, examine:
- **Input tokens**: Is the system prompt bloated? Is conversation history growing unboundedly?
- **Output tokens**: Is the model generating unnecessarily verbose responses?
- **Tool result tokens**: Are tool outputs too large? (e.g., returning the entire brick schema when only field names are needed)

**Rule of thumb from benchmarks**: Each 1,000 additional input tokens adds ~200ms to TTFT. A system prompt of 5,000 tokens vs 2,000 tokens adds ~600ms per LLM call, and with 3-4 LLM calls per request, that is 1.8-2.4 seconds.

#### Step 4: Compare Fast vs Slow Traces

Filter for both fast and slow traces of the same operation. Compare:
- Token counts (are slow traces processing more context?)
- Number of LLM calls (are slow traces doing more rounds?)
- Tool call patterns (are slow traces hitting retries?)
- Tenant/campaign type (are certain tenants consistently slower?)

#### Step 5: Set Up Automated Monitoring

Configure ongoing monitoring to catch regressions:

**Key metrics to track daily:**
| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| P95 total latency (brick edit) | < 8s | > 15s |
| P95 total latency (campaign create) | < 12s | > 25s |
| Average LLM calls per trace | < 3 | > 5 |
| Average input tokens per trace | < 15,000 | > 25,000 |
| Tool error rate | < 2% | > 10% |
| Cost per trace | < $0.15 | > $0.50 |

### OpenTelemetry Integration

Both LangSmith and Langfuse support OpenTelemetry, allowing you to:
1. Send LLM traces to your existing observability stack (Datadog, Grafana, New Relic)
2. Correlate LLM latency with infrastructure metrics (CPU, memory, network)
3. Create unified dashboards covering both application and LLM performance

```python
# Send traces to LangSmith via OTEL
# pip install "langsmith[otel]"

# Option A: Use LangSmith's OTEL helper
from langsmith.integrations.otel import configure
configure(project_name="sidekick-agent")

# Option B: Send to multiple destinations via OTEL Collector
# Configure OTEL Collector to fan-out traces to:
# - LangSmith (for LLM-specific analysis)
# - Datadog/Grafana (for infrastructure correlation)
# - Langfuse (for open-source backup)
```

OTEL Collector fan-out configuration:

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

exporters:
  otlp/langsmith:
    endpoint: https://api.smith.langchain.com/otel
    headers:
      x-api-key: ${LANGSMITH_API_KEY}
  otlp/langfuse:
    endpoint: https://cloud.langfuse.com/api/public/otel
    headers:
      Authorization: Basic ${LANGFUSE_BASE64_AUTH}
  otlp/datadog:
    endpoint: https://trace.agent.datadoghq.com
    headers:
      DD-API-KEY: ${DD_API_KEY}

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlp/langsmith, otlp/langfuse, otlp/datadog]
```

## Use Cases Relevant to This Project

### Diagnosing the 44-Second Brick Edit

The observability stack should answer these questions within the first day:

1. **Which LLM call is slowest?** The specialist LLM with tool use is the likely culprit, but you need data.
2. **How many LLM rounds are happening?** If 4+ LLM calls per brick edit, that is the primary issue.
3. **How large is the input context?** If the specialist receives 15,000+ tokens, prompt compression could save seconds.
4. **Are tools being called redundantly?** If get_brick is called multiple times for the same brick, caching is needed.
5. **Is the router adding significant latency?** If GPT-4o-mini routing takes >2 seconds, the router prompt needs optimization.

### Multi-Tenant Performance Analysis

Tag every trace with tenant metadata. Then compare P95 latency across tenants:
- KLM campaigns may have more complex brick structures
- Philips may have larger brand guidelines
- Takeaway may have simpler campaigns that should be faster

### Tracking Improvement Over Time

After implementing optimizations (parallel tool use, prompt compression, model changes), use the observability dashboard to measure:
- Did P95 latency actually decrease?
- Did cost per trace change?
- Did quality scores remain stable?
- Are there new bottlenecks that emerged?

### Production Alerting for SLA Compliance

If the team commits to an 8-second response time SLA:
- Alert when P95 exceeds 12 seconds (early warning)
- Alert when P95 exceeds 15 seconds (action required)
- Alert when error rate exceeds 5% (quality degradation)

## Tradeoffs

### LangSmith vs Langfuse

| Dimension | LangSmith | Langfuse |
|-----------|-----------|----------|
| **Setup effort** | Minutes (env vars only) | 30min (SaaS) or hours (self-hosted) |
| **LangGraph depth** | Full automatic tracing | Good with callback handler |
| **Dashboard UX** | Excellent, purpose-built | Good, improving rapidly |
| **Prompt playground** | Built-in | Built-in |
| **Evaluation** | Online LLM-as-judge, code evals | Online LLM-as-judge, custom evals |
| **Alerting** | Webhook, PagerDuty | Webhook |
| **Self-hosting** | Not available | Docker, K8s, Helm chart |
| **Data privacy** | Data on LangChain servers | Full control if self-hosted |
| **Pricing** | Free tier + usage-based | Free (self-hosted) or usage-based SaaS |
| **OTEL support** | Full (import and export) | Full (import and export) |
| **Community** | Large (LangChain ecosystem) | Growing fast (25K+ GitHub stars) |
| **Vendor lock-in** | High | Low (open-source, OTEL export) |

### Cloud-Hosted vs Self-Hosted Langfuse

| Dimension | Cloud Langfuse | Self-Hosted Langfuse |
|-----------|---------------|---------------------|
| **Setup** | Minutes | Hours-Days |
| **Maintenance** | None | You manage infra |
| **Data location** | Langfuse servers | Your servers |
| **Cost** | Usage-based | Infra cost only |
| **Scalability** | Managed | You manage |
| **Compliance** | Check their DPA | Full control |
| **When to use** | Quick start, small team | Data sovereignty required |

### Tracing Everything vs Sampling

| Approach | Pros | Cons | When to Use |
|----------|------|------|-------------|
| **Trace 100%** | Full visibility, catch every outlier | Higher cost, more storage | During diagnosis, low-volume |
| **Sample 10-25%** | Lower cost | May miss rare issues | After diagnosis, high-volume |
| **Head-based sampling** | Simple to implement | Misses slow requests | Steady-state monitoring |
| **Tail-based sampling** | Captures slow/error traces | More complex, needs collector | Production best practice |

## Recommended Approach for This Project

**Use LangSmith as the primary observability platform, with OpenTelemetry custom spans for non-LangChain operations.**

Rationale:

1. **LangSmith is already in use** (traces are in LangSmith per the project brief). No migration needed.
2. **Native LangGraph support** means zero-code tracing for the router, specialists, and tool calls.
3. **The team is small** -- LangSmith's managed service eliminates ops burden.
4. **The diagnosis is urgent** -- LangSmith provides immediate visibility into the 44-second latency.

**Immediate action plan:**

1. **Day 1**: Verify `LANGSMITH_TRACING=true` is set. Add metadata tags for agent_type, tenant, brick_type.
2. **Day 1**: Collect 50+ brick edit traces. Sort by duration. Identify the top 3 time consumers.
3. **Day 2**: Set up monitoring rules: alert on P95 > 15s for brick editor.
4. **Day 3**: Add `@traceable` decorators to all non-LangChain operations (MongoDB queries, Redis cache, brick API calls).
5. **Week 1**: Compare fast vs slow traces. Document the specific bottlenecks with token counts and timing data.
6. **Week 2**: Implement fixes (parallel tool use, prompt compression, model changes). Track P95 latency daily.

**Evaluate Langfuse later** if:
- Data privacy requirements change (GDPR, tenant isolation)
- LangSmith costs become prohibitive at scale
- The team wants to self-host for full control

## Sources

- [LangSmith Observability Platform](https://www.langchain.com/langsmith/observability)
- [Advanced LangSmith Tracing Techniques 2025 - SparkCo](https://sparkco.ai/blog/advanced-langsmith-tracing-techniques-in-2025)
- [Debug LLM Pipeline with LangSmith Traces - Medium](https://medium.com/@sridhar.tondapi_48148/fix-llm-issues-with-langsmith-traces-548be5850184)
- [LangSmith Explained: Debugging and Evaluating LLM Agents - DigitalOcean](https://www.digitalocean.com/community/tutorials/langsmith-debudding-evaluating-llm-agents)
- [LangSmith for LangChain: Observability, Tracing, Prompt Evaluation - Murf.ai](https://murf.ai/blog/llm-observability-with-langsmith)
- [LangSmith: Observability for LLM Applications - Medium](https://medium.com/@vinodkrane/langsmith-observability-for-llm-applications-ef5aaf6c2e5b)
- [LangSmith Tracing: Debugging LLM Chains - Statsig](https://www.statsig.com/perspectives/langsmith-tracing-debug-llm-chains)
- [LangSmith Evaluation: Tracing and Debugging - Analytics Vidhya](https://www.analyticsvidhya.com/blog/2025/11/evaluating-llms-with-langsmith/)
- [Langfuse Observability Overview](https://langfuse.com/docs/observability/overview)
- [Langfuse Get Started Guide](https://langfuse.com/docs/observability/get-started)
- [Langfuse Tracing Data Model](https://langfuse.com/docs/observability/data-model)
- [Langfuse OpenTelemetry Integration](https://langfuse.com/integrations/native/opentelemetry)
- [Langfuse GitHub Repository](https://github.com/langfuse/langfuse)
- [LLM Monitoring and Observability with Langfuse - Towards Data Science](https://towardsdatascience.com/llm-monitoring-and-observability-hands-on-with-langfuse/)
- [LangChain Observability: Zero to Production - Last9](https://last9.io/blog/langchain-observability/)
- [Trace with OpenTelemetry - LangSmith Docs](https://docs.langchain.com/langsmith/trace-with-opentelemetry)
- [End-to-End OpenTelemetry in LangSmith - LangChain Blog](https://blog.langchain.com/end-to-end-opentelemetry-langsmith/)
- [AI Agent Observability - OpenTelemetry Blog](https://opentelemetry.io/blog/2025/ai-agent-observability/)
