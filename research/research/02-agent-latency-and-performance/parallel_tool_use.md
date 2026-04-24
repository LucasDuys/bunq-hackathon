# Parallel Tool Use

## Summary

Parallel tool use is the ability for an LLM to request multiple tool calls in a single response, which can then be executed concurrently rather than sequentially. For a brick editor agent making 3 sequential tool calls (get_brick, get_brick_schema, edit_brick), converting the first two to parallel execution could save 2-5 seconds per request. This document covers how parallel tool use works in the Anthropic and OpenAI APIs, how LangGraph handles parallel execution at the graph level, and how to apply both techniques to reduce the 44-second response time.

## Key Concepts

- **Parallel Tool Calls (API level)**: The LLM returns multiple `tool_use` blocks in a single response. You execute them concurrently, then return all results in one message.
- **Sequential Tool Calls**: The LLM returns one tool call, waits for the result, then decides the next tool call. Each round-trip adds a full LLM inference cycle.
- **Fan-out / Fan-in**: A graph pattern where one node triggers multiple parallel nodes, which all feed into a single aggregation node.
- **Superstep**: LangGraph's execution unit that groups nodes running concurrently. All nodes in a superstep must complete before the next step begins.
- **Tool Chain Depth**: The number of sequential LLM call -> tool execution -> LLM call cycles needed to complete a task. Deeper chains mean more latency.
- **`disable_parallel_tool_use`**: Anthropic's parameter to control whether Claude can make multiple tool calls per turn.
- **`parallel_tool_calls`**: OpenAI's parameter to control whether GPT models can make multiple function calls per turn.

## How It Works

### Anthropic API: Parallel Tool Use

Claude supports parallel tool calls by default. When Claude determines that multiple independent operations are needed, it returns multiple `tool_use` blocks in a single response.

**Enabling/Disabling:**

```python
import anthropic

client = anthropic.Anthropic()

# Parallel tool use is ON by default
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=[
        {
            "name": "get_brick",
            "description": "Get a brick's current data by ID",
            "input_schema": {
                "type": "object",
                "properties": {
                    "brick_id": {"type": "string"}
                },
                "required": ["brick_id"]
            }
        },
        {
            "name": "get_brick_schema",
            "description": "Get the JSON schema for a brick type",
            "input_schema": {
                "type": "object",
                "properties": {
                    "brick_type": {"type": "string"}
                },
                "required": ["brick_type"]
            }
        },
        {
            "name": "edit_brick",
            "description": "Apply edits to a brick",
            "input_schema": {
                "type": "object",
                "properties": {
                    "brick_id": {"type": "string"},
                    "changes": {"type": "object"}
                },
                "required": ["brick_id", "changes"]
            }
        }
    ],
    messages=[{
        "role": "user",
        "content": "Change the headline to 'Summer Sale' in brick abc123"
    }]
)

# To DISABLE parallel tool use:
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    messages=messages,
    disable_parallel_tool_use=True  # Forces at most one tool call per turn
)
```

**How `tool_choice` interacts with `disable_parallel_tool_use`:**

| `tool_choice` | `disable_parallel_tool_use=True` | Effect |
|---------------|----------------------------------|--------|
| `auto` (default) | Yes | At most ONE tool call (or zero) |
| `any` | Yes | Exactly ONE tool call |
| `{"type": "tool", "name": "..."}` | Yes | Exactly ONE call to the named tool |
| `auto` (default) | No (default) | Zero or more tool calls |
| `any` | No (default) | One or more tool calls |

**What a parallel response looks like:**

When Claude decides to fetch both the brick data and schema simultaneously, the response contains:

```json
{
  "role": "assistant",
  "stop_reason": "tool_use",
  "content": [
    {
      "type": "text",
      "text": "I'll fetch the brick data and schema to understand the structure."
    },
    {
      "type": "tool_use",
      "id": "toolu_01A",
      "name": "get_brick",
      "input": {"brick_id": "abc123"}
    },
    {
      "type": "tool_use",
      "id": "toolu_01B",
      "name": "get_brick_schema",
      "input": {"brick_type": "hero_banner"}
    }
  ]
}
```

**Returning parallel tool results (critical formatting):**

Tool results MUST come first in the content array, before any text:

```python
# Execute tools in parallel
import asyncio

async def execute_parallel_tools(tool_calls):
    tasks = []
    for block in tool_calls:
        if block.type == "tool_use":
            if block.name == "get_brick":
                tasks.append(("get_brick", block.id, get_brick(block.input["brick_id"])))
            elif block.name == "get_brick_schema":
                tasks.append(("get_brick_schema", block.id, get_brick_schema(block.input["brick_type"])))

    # Execute all tool calls concurrently
    results = await asyncio.gather(*[task[2] for task in tasks])

    # Build tool_result blocks -- these MUST come first in content array
    tool_results = []
    for (name, tool_id, _), result in zip(tasks, results):
        tool_results.append({
            "type": "tool_result",
            "tool_use_id": tool_id,
            "content": json.dumps(result)
        })

    return tool_results

# Send results back
messages.append({"role": "assistant", "content": response.content})
messages.append({
    "role": "user",
    "content": tool_results  # tool_result blocks FIRST, then optional text
})
```

**Encouraging parallel tool use via system prompt:**

For Claude 4+ models, add this to your system prompt to encourage parallel execution:

```text
For maximum efficiency, whenever you need to perform multiple independent operations,
invoke all relevant tools simultaneously rather than sequentially. For example, if you
need to fetch a brick and its schema, call get_brick and get_brick_schema in the same
turn rather than waiting for one to complete before calling the other.
```

For stronger enforcement:

```xml
<use_parallel_tool_calls>
When performing multiple independent operations, invoke all relevant tools simultaneously
rather than sequentially. Prioritize calling tools in parallel whenever possible.
</use_parallel_tool_calls>
```

### OpenAI API: Parallel Function Calling

OpenAI also supports parallel tool calls, enabled by default. The parameter name is `parallel_tool_calls`:

```python
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4.1",
    messages=messages,
    tools=tools,
    parallel_tool_calls=True  # This is the default
)

# Multiple tool calls appear in the tool_calls array
for tool_call in response.choices[0].message.tool_calls:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    result = call_function(name, args)

    # Each result is a separate message with role "tool"
    messages.append({
        "role": "tool",
        "tool_call_id": tool_call.id,
        "content": str(result)
    })

# To disable parallel tool calls:
response = client.chat.completions.create(
    model="gpt-4.1",
    messages=messages,
    tools=tools,
    parallel_tool_calls=False  # Forces at most one tool call
)
```

**Model support for parallel tool calls (OpenAI):**

| Model | Parallel Tool Calls | Notes |
|-------|---------------------|-------|
| GPT-4o | Yes | Full support |
| GPT-4o-mini | Yes | Full support |
| GPT-4.1 | Yes | Full support |
| GPT-4.1 Mini | Yes | Full support; nano snapshot may duplicate calls |
| GPT-4 Turbo | Yes | Full support |
| o3 | No | Reasoning models do not support parallel tool calls |
| o3-mini | No | Reasoning models process sequentially |
| o4-mini | Varies | May not support `parallel_tool_calls` parameter |

**Critical limitation for this project:** The router uses GPT-4o-mini (supports parallel), but Campaign Creator uses o3 (does NOT support parallel tool calls). If o3 needs multiple tool calls, they will always be sequential.

### LangGraph: Parallel Node Execution

LangGraph supports parallelism at the graph topology level, separate from the API-level parallel tool calls. When multiple edges fan out from a single node, LangGraph automatically runs the target nodes concurrently in a "superstep."

**Sequential execution (slow):**

```python
from langgraph.graph import StateGraph, START, END

builder = StateGraph(AgentState)
builder.add_node("router", router_node)
builder.add_node("get_brick", get_brick_node)
builder.add_node("get_schema", get_schema_node)
builder.add_node("generate_edit", generate_edit_node)

# Sequential: each step waits for the previous one
builder.add_edge(START, "router")
builder.add_edge("router", "get_brick")
builder.add_edge("get_brick", "get_schema")
builder.add_edge("get_schema", "generate_edit")
builder.add_edge("generate_edit", END)
```

**Parallel execution (fast):**

```python
builder = StateGraph(AgentState)
builder.add_node("router", router_node)
builder.add_node("get_brick", get_brick_node)
builder.add_node("get_schema", get_schema_node)
builder.add_node("generate_edit", generate_edit_node)

# Parallel: get_brick and get_schema run concurrently
builder.add_edge(START, "router")
builder.add_edge("router", "get_brick")     # Fan-out: both edges
builder.add_edge("router", "get_schema")    # from router node
builder.add_edge("get_brick", "generate_edit")    # Fan-in: both feed
builder.add_edge("get_schema", "generate_edit")   # into generate_edit
builder.add_edge("generate_edit", END)
```

In the parallel version, `get_brick` and `get_schema` execute in the same superstep. LangGraph waits for both to complete before starting `generate_edit`.

**Controlling concurrency:**

```python
# Limit how many nodes can run simultaneously
config = {"max_concurrency": 3}
result = await graph.ainvoke(state, config=config)
```

**State management in parallel branches:**

When parallel nodes write to the same state key, LangGraph uses a reducer to merge results:

```python
from typing import Annotated
from operator import add

class AgentState(TypedDict):
    messages: Annotated[list, add]  # Lists are concatenated
    brick_data: dict  # Last write wins (default)
    schema_data: dict
    context: Annotated[list, add]  # Parallel results merged

def get_brick_node(state):
    brick = fetch_brick(state["brick_id"])
    return {"context": [{"type": "brick", "data": brick}]}

def get_schema_node(state):
    schema = fetch_schema(state["brick_type"])
    return {"context": [{"type": "schema", "data": schema}]}

# Both nodes write to "context" -- the `add` reducer concatenates both lists
```

**Map-Reduce pattern for batch operations:**

For operations like editing multiple bricks, LangGraph supports the Send API for dynamic fan-out:

```python
from langgraph.constants import Send

def router_node(state):
    brick_ids = state["brick_ids_to_edit"]
    # Dynamically fan-out to N parallel edit nodes
    return [Send("edit_single_brick", {"brick_id": bid}) for bid in brick_ids]
```

### Combining API-Level and Graph-Level Parallelism

The most effective approach combines both levels:

1. **Graph-level**: Fan out independent data-fetching nodes (get_brick, get_schema, load_campaign_context) to run concurrently.
2. **API-level**: Within the specialist LLM call, enable parallel tool use so the model can request multiple operations in one turn.
3. **Application-level**: Use `asyncio.gather()` to execute the actual tool implementations concurrently when the LLM requests multiple tools.

```python
# The ToolNode in LangGraph already handles parallel execution
from langgraph.prebuilt import ToolNode

# When the LLM returns multiple tool_use blocks, ToolNode
# executes them all concurrently by default
tool_node = ToolNode(tools=[get_brick, get_brick_schema, edit_brick])
```

## Use Cases Relevant to This Project

### Brick Editor: get_brick + get_brick_schema in Parallel

Currently, the brick editor likely follows this sequence:
1. LLM call: "I need to get the brick data" -> tool_use(get_brick)
2. Execute get_brick, return result
3. LLM call: "Now I need the schema" -> tool_use(get_brick_schema)
4. Execute get_brick_schema, return result
5. LLM call: "Now I'll generate the edit" -> tool_use(edit_brick)
6. Execute edit_brick, return result
7. LLM call: "Here's the result for the user"

That is 4 LLM calls and 3 sequential tool executions. With parallel tool use:
1. LLM call: "I need the brick data and schema" -> tool_use(get_brick) + tool_use(get_brick_schema)
2. Execute BOTH concurrently, return both results
3. LLM call: "Here's the edit" -> tool_use(edit_brick)
4. Execute edit_brick, return result
5. LLM call: "Here's the result for the user"

That reduces it to 3 LLM calls and the first two tools run in parallel. If each LLM call takes 3 seconds and each tool takes 500ms, the sequential version takes ~13.5 seconds and the parallel version takes ~10 seconds -- a 25% improvement from this optimization alone.

### Router Fan-Out to Data Prefetch

Before the specialist LLM call, pre-fetch all data the specialist might need:

```python
# Graph-level parallelism: fetch context before specialist runs
builder.add_edge("router", "prefetch_brick_data")
builder.add_edge("router", "prefetch_schema")
builder.add_edge("router", "prefetch_campaign_context")
builder.add_edge("prefetch_brick_data", "specialist")
builder.add_edge("prefetch_schema", "specialist")
builder.add_edge("prefetch_campaign_context", "specialist")
```

This way, when the specialist LLM runs, all data is already in the state. The specialist may not even need tool calls -- it can receive the brick data, schema, and campaign context directly in its prompt. This eliminates tool call round-trips entirely.

### Platform Expert RAG: Parallel Retrieval

The Platform Expert uses RAG to answer questions. If it needs to search multiple knowledge bases (e.g., platform docs + campaign history + brand guidelines), these searches can run in parallel:

```python
builder.add_edge("router", "search_platform_docs")
builder.add_edge("router", "search_campaign_history")
builder.add_edge("router", "search_brand_guidelines")
builder.add_edge("search_platform_docs", "generate_answer")
builder.add_edge("search_campaign_history", "generate_answer")
builder.add_edge("search_brand_guidelines", "generate_answer")
```

## Tradeoffs

### API-Level Parallel Tool Use vs Graph-Level Parallelism

| Dimension | API-Level (LLM parallel tool calls) | Graph-Level (LangGraph fan-out) |
|-----------|-------------------------------------|---------------------------------|
| **Control** | LLM decides what to parallelize | Developer decides at design time |
| **Reliability** | Model may not always choose parallel | Guaranteed parallel execution |
| **Flexibility** | Adapts to different inputs dynamically | Fixed topology (or Send() for dynamic) |
| **LLM calls saved** | Reduces round-trips within a specialist | Can eliminate specialist tool calls entirely |
| **Complexity** | Low (prompt engineering + API param) | Medium (graph topology design) |
| **Model dependency** | Not all models support it (o3 does not) | Model-independent |
| **Latency savings** | 1-3 seconds per eliminated round-trip | Depends on slowest parallel branch |

### Pre-Fetching All Data vs Tool Calls

| Dimension | Pre-Fetch in Graph | Tool Calls by LLM |
|-----------|-------------------|-------------------|
| **Token usage** | Higher (data in prompt even if unused) | Lower (only fetches what's needed) |
| **Latency** | Lower (no tool call round-trips) | Higher (each tool call = LLM round-trip) |
| **Accuracy** | Risk of context overload | LLM chooses relevant data |
| **Implementation** | Graph topology change | Prompt engineering |
| **When to use** | Predictable data needs (brick editor) | Unpredictable queries (Platform Expert) |

### Sequential vs Parallel: When Sequential Is Better

Parallel is not always better. Use sequential when:
- Tool B's input depends on Tool A's output (e.g., edit_brick needs get_brick data)
- The LLM needs to reason about intermediate results before deciding the next step
- You want to minimize token usage (parallel pre-fetch sends more context)

## Recommended Approach for This Project

**Implement a two-layer parallelism strategy:**

### Layer 1: Graph-Level Pre-Fetching (Highest Impact)

Restructure the brick editor subgraph to pre-fetch data before the specialist LLM call:

```
router -> [prefetch_brick, prefetch_schema, prefetch_campaign_context] -> specialist_llm -> edit_brick -> respond
```

This eliminates 2 out of 4 LLM calls in the brick editor flow. Expected savings: 4-8 seconds.

### Layer 2: API-Level Parallel Tool Use (Complementary)

For the specialist models that still need tool calls:
1. Ensure `disable_parallel_tool_use` is NOT set (it is off by default in Anthropic).
2. Add system prompt instructions encouraging parallel tool calls.
3. In the LangGraph ToolNode, ensure tools are executed concurrently (this is the default behavior).

**Note for Campaign Creator (o3):** Since o3 does not support parallel tool calls, focus on minimizing the number of tool calls through better prompting and pre-fetching.

### Expected Impact

| Optimization | Estimated Savings | Confidence |
|--------------|-------------------|------------|
| Pre-fetch brick + schema in parallel | 3-6 seconds | High |
| Eliminate redundant LLM round-trips | 3-8 seconds | High |
| API-level parallel tool calls | 1-3 seconds | Medium |
| Prompt engineering for fewer tool calls | 2-5 seconds | Medium |
| **Total estimated savings** | **9-22 seconds** | |

Combined with other optimizations (model selection, prompt size reduction), this should bring the 44-second response time well under 15 seconds.

## Sources

- [Tool Use with Claude - Anthropic Docs](https://platform.claude.com/docs/en/docs/build-with-claude/tool-use)
- [How to Implement Tool Use - Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
- [Introducing Advanced Tool Use - Anthropic Engineering Blog](https://www.anthropic.com/engineering/advanced-tool-use)
- [Function Calling - OpenAI API Docs](https://developers.openai.com/api/docs/guides/function-calling/)
- [What Models Support parallel_tool_calls - OpenAI Community](https://community.openai.com/t/what-models-support-parallel-tool-calls-and-when-to-use-it/1310788)
- [Reasoning Models Do Not Call Functions in Parallel - OpenAI Community](https://community.openai.com/t/reasoning-models-do-not-call-functions-in-parallel/1322833)
- [Parallel Execution with LangChain and LangGraph - Focused.io](https://focused.io/lab/parallel-execution-with-langchain-and-langgraph)
- [Building Parallel Workflows with LangGraph - GoPenAI](https://blog.gopenai.com/building-parallel-workflows-with-langgraph-a-practical-guide-3fe38add9c60)
- [Scaling LangGraph Agents: Parallelization, Subgraphs, and Map-Reduce - AI Practitioner](https://aipractitioner.substack.com/p/scaling-langgraph-agents-parallelization)
- [Branches for Parallel Node Execution - LangGraph GitHub Discussion](https://github.com/langchain-ai/langgraph/discussions/2931)
- [How to Parallelize Nodes in LangGraph - Medium](https://medium.com/@fingervinicius/how-to-parallelize-nodes-in-langgraph-3c2667bd9c3f)
- [Parallel Nodes in LangGraph: Deferred Execution - Medium](https://medium.com/@gmurro/parallel-nodes-in-langgraph-managing-concurrent-branches-with-the-deferred-execution-d7e94d03ef78)
- [LangGraph Multi-Agent Orchestration Guide 2025 - Latenode](https://latenode.com/blog/ai-frameworks-technical-infrastructure/langgraph-multi-agent-orchestration/langgraph-ai-framework-2025-complete-architecture-guide-multi-agent-orchestration-analysis)
- [Programmatic Tool Calling - Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling)
- [Handling Function Calls with Reasoning Models - OpenAI Cookbook](https://cookbook.openai.com/examples/reasoning_function_calls)
