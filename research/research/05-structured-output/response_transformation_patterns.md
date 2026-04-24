# Response Transformation Patterns

## Summary

Response transformation is the process of converting raw tool output (JSON objects, database records, API responses) into clean, human-readable text before presenting it to the user. This can happen at multiple levels: within the LLM's generation (via prompt engineering), in a dedicated post-processing node in the agent graph, or through a separate LLM call that takes structured data and produces a natural language summary. For the ByCape Sidekick brick editor agent, response transformation patterns are critical because every tool interaction (get_brick, edit_brick, get_brick_schema) returns structured data that must be translated into conversational language for marketing designers.

## Key Concepts

- **Tool result processing**: The step between receiving raw tool output and generating a user-facing response. This is where transformation happens.
- **Two-pass LLM pattern**: A retrieval pass (tool call) followed by a narration pass (LLM generates natural language from the tool result). The second pass may be implicit (same LLM turn) or explicit (separate API call).
- **Output parsers**: LangChain components that transform raw LLM output into specific formats. Includes `StrOutputParser` (string extraction), `JsonOutputParser` (JSON parsing), and `StructuredOutputParser` (schema-based parsing).
- **Response synthesizers**: LlamaIndex components that generate natural language answers from retrieved data chunks. Modes include `compact`, `refine`, `tree_summarize`, and `simple_summarize`.
- **Tool result clearing**: An Anthropic-recommended pattern where raw tool results are removed from the conversation history after processing, replaced by the model's natural language interpretation.
- **Result injection**: Inserting a processed/summarized version of tool results into the next LLM turn instead of the raw output.
- **Sub-agent summarization**: Delegating tool execution to a sub-agent that returns only a condensed natural language summary (1,000-2,000 tokens) rather than full raw data.
- **Programmatic tool orchestration**: Running tool calls within a sandboxed code execution environment so intermediate results never enter the model's context, and only the final aggregated result is returned.
- **ResponseFormat enum**: A pattern from Anthropic's tool design guidance where tools accept a `concise` or `detailed` parameter, controlling the verbosity of their output.

## How It Works

### Pattern 1: Implicit Transformation (Same LLM Turn)

This is the most common pattern in tool-using agents. The LLM receives the tool result as a `tool_result` message and generates a response in the same conversation turn. The transformation from structured data to natural language happens entirely within the LLM's generation.

**How it works in practice:**

```
[User]: "What font is the headline using?"
[Agent]: (calls get_brick with brick_id)
[Tool Result]: {"type": "text", "properties": {"content": "Summer Sale", "fontFamily": "Montserrat", "fontWeight": "bold", "fontSize": 32}}
[Agent -> User]: "The headline is using Montserrat Bold at 32px."
```

The agent receives the JSON tool result and, guided by system prompt instructions, produces natural language. No additional API call or processing step is needed.

**Advantages:**
- Simplest to implement (just prompt engineering)
- Lowest latency (single LLM turn handles both tool use and response)
- No additional infrastructure

**Disadvantages:**
- Relies entirely on prompt quality; the model may still dump JSON
- Raw tool data enters the model's context window, consuming tokens
- No programmatic guarantee that the response will be natural language

**Implementation in LangGraph:**

In a standard LangGraph ReAct agent, this happens automatically within the agent loop. When the model calls a tool, the tool node executes it and returns the result as a `ToolMessage`. The model then generates its response using the full conversation history including the tool result.

```python
from langgraph.prebuilt import create_react_agent

# The agent loop handles tool execution and response generation
agent = create_react_agent(
    model=chat_model,
    tools=[get_brick, edit_brick, get_brick_schema],
    state_modifier="""You are a friendly design assistant.
    Always describe tool results in plain language.
    Never show JSON or field names to the user."""
)
```

(Source: LangChain Agents Documentation)

### Pattern 2: Explicit Result Processor Node

Add a dedicated node in the LangGraph graph that processes tool results before passing them to the model for response generation. This node can transform, filter, or summarize the raw tool output.

**How it works:**

```
[Agent Node] ---(tool call)---> [Tool Node] ---(raw result)---> [Result Processor Node] ---(processed result)---> [Agent Node] ---(natural language)---> [User]
```

The result processor node sits between the tool execution and the next agent turn. It transforms the raw JSON into a more digestible format.

**Implementation:**

```python
from langchain_core.messages import ToolMessage, AIMessage
from langgraph.graph import StateGraph, MessagesState

def process_tool_results(state: MessagesState) -> dict:
    """Transform raw tool results into human-readable summaries."""
    messages = state["messages"]
    processed_messages = []

    for msg in messages:
        if isinstance(msg, ToolMessage):
            raw_content = msg.content
            try:
                data = json.loads(raw_content) if isinstance(raw_content, str) else raw_content
                summary = transform_to_summary(data, msg.name)
                processed_messages.append(
                    ToolMessage(
                        content=summary,
                        tool_call_id=msg.tool_call_id,
                        name=msg.name
                    )
                )
            except (json.JSONDecodeError, TypeError):
                processed_messages.append(msg)
        else:
            processed_messages.append(msg)

    return {"messages": processed_messages}

def transform_to_summary(data: dict, tool_name: str) -> str:
    """Convert structured tool output to a natural language summary."""
    if tool_name == "get_brick":
        brick_type = data.get("type", "unknown")
        props = data.get("properties", {})
        parts = [f"This is a {brick_type} brick."]
        if "fontFamily" in props:
            font = f"{props['fontFamily']} {props.get('fontWeight', '')} {props.get('fontSize', '')}px"
            parts.append(f"Font: {font.strip()}")
        if "backgroundColor" in props:
            parts.append(f"Background: {props['backgroundColor']}")
        if "content" in props:
            content_preview = props["content"][:80]
            parts.append(f"Content: \"{content_preview}\"")
        return " | ".join(parts)

    elif tool_name == "edit_brick":
        if data.get("success"):
            updated = data.get("updated_fields", {})
            changes = [f"{k}: {v}" for k, v in updated.items()]
            return f"Successfully updated: {', '.join(changes)}"
        else:
            return f"Update failed: {data.get('error', 'unknown error')}"

    elif tool_name == "get_brick_schema":
        properties = data.get("properties", {})
        prop_names = [humanize_field_name(k) for k in properties.keys()]
        return f"Editable properties: {', '.join(prop_names)}"

    return json.dumps(data)  # Fallback

def humanize_field_name(field: str) -> str:
    """Convert camelCase field names to human-readable labels."""
    import re
    # camelCase to space-separated
    result = re.sub(r'([A-Z])', r' \1', field).lower().strip()
    return result

# Wire into LangGraph
graph = StateGraph(MessagesState)
graph.add_node("agent", agent_node)
graph.add_node("tools", tool_node)
graph.add_node("process_results", process_tool_results)

# Route: agent -> tools -> process_results -> agent
graph.add_edge("tools", "process_results")
graph.add_edge("process_results", "agent")
```

(Source: LangGraph Tool Result Processing Tutorial at aiproduct.engineer)

**Advantages:**
- Guarantees that the model never sees raw JSON -- only pre-processed summaries
- Reduces token consumption (processed summaries are typically much shorter than raw JSON)
- Centralizes transformation logic in one place
- Can be tested independently of the LLM

**Disadvantages:**
- Additional code to maintain
- Transformation logic must be updated when tool schemas change
- May lose nuance that the LLM could have extracted from the raw data
- Adds a small amount of latency (though no additional LLM call)

### Pattern 3: Two-Step LLM Call (Retrieve Then Describe)

Make an explicit second LLM call specifically to transform structured data into natural language. This is useful when the tool returns complex data that needs sophisticated interpretation.

**How it works:**

```
Pass 1: Agent calls tool, receives structured result
Pass 2: A separate LLM call takes the structured result + original question and generates a natural language description
```

**Implementation:**

```python
import anthropic

client = anthropic.Anthropic()

def describe_tool_result(tool_name: str, tool_result: dict, user_question: str) -> str:
    """Use a separate LLM call to describe tool results in natural language."""
    response = client.messages.create(
        model="claude-sonnet-4-6",  # Use a fast, cheap model for this
        max_tokens=300,
        system="""You are a response formatter. Given a tool result (JSON) and the user's
original question, write a brief, friendly response in plain language.
Never include JSON, field names, or technical identifiers.
Write as if explaining to a non-technical marketing designer.""",
        messages=[{
            "role": "user",
            "content": f"""Tool: {tool_name}
Result: {json.dumps(tool_result)}
User's question: {user_question}

Write a natural language response:"""
        }]
    )
    return response.content[0].text
```

This pattern is sometimes called the "supervisor-agent-summarizer" architecture, where a supervisor oversees the process, agents execute tasks, and a summarizer generates the final output. (Source: Multi-AI Agent Parallel Processing, Medium)

**Advantages:**
- Highest quality natural language output (dedicated LLM call focused solely on description)
- Can use a smaller/cheaper model for the description step
- Complete separation of retrieval logic from presentation logic
- Works for arbitrarily complex tool outputs

**Disadvantages:**
- Additional LLM call adds latency and cost
- More complex to implement and debug
- The description model needs context about the domain

### Pattern 4: Tool Result Clearing (Anthropic)

Anthropic recommends "tool result clearing" as one of the safest, lightest-touch forms of context compaction. After the model has processed a tool result and generated its response, the raw tool result is removed from the conversation history and replaced with the model's interpretation.

From Anthropic's context engineering guide: "once a tool has been called deep in the message history, why would the agent need to see the raw result again?" (Source: Anthropic Effective Context Engineering)

**How it works:**

```python
def compact_tool_results(messages: list) -> list:
    """Remove raw tool results that have already been processed."""
    compacted = []
    processed_tool_ids = set()

    # First pass: identify tool results that have been followed by an AI response
    for i, msg in enumerate(messages):
        if hasattr(msg, 'tool_call_id') and i + 1 < len(messages):
            next_msg = messages[i + 1]
            if hasattr(next_msg, 'content') and not hasattr(next_msg, 'tool_call_id'):
                processed_tool_ids.add(msg.tool_call_id)

    # Second pass: replace processed tool results with placeholders
    for msg in messages:
        if hasattr(msg, 'tool_call_id') and msg.tool_call_id in processed_tool_ids:
            compacted.append(ToolMessage(
                content="[Result processed - see assistant response above]",
                tool_call_id=msg.tool_call_id,
                name=msg.name
            ))
        else:
            compacted.append(msg)

    return compacted
```

**Advantages:**
- Reduces context window usage over long conversations
- Prevents the model from re-reading (and potentially re-echoing) old raw data
- Recommended by Anthropic as a safe compaction strategy
- Simple to implement as a conversation history post-processor

**Disadvantages:**
- Loses the raw data if the model needs to re-examine it later
- Must be applied carefully to avoid breaking the conversation flow
- Should not be applied to the most recent tool result (the model needs it for the current response)

### Pattern 5: Programmatic Tool Orchestration (Code Execution)

Anthropic's advanced tool use documentation describes a pattern where the model writes Python code to orchestrate multiple tool calls within a sandboxed environment. Intermediate results stay in the sandbox and never enter the model's context. Only the final aggregated result is returned.

From the documentation: "Intermediate results consume massive token budgets" when returned to context. The programmatic approach keeps intermediate data in the execution environment, "returning only final aggregated results." (Source: Anthropic Advanced Tool Use)

**Example scenario:** The user asks "Update all 5 headline bricks to use Montserrat Bold."

**Without programmatic orchestration:**
- 5 separate `edit_brick` tool calls
- 5 JSON responses in the context window
- The model must process all 5 results to generate a summary

**With programmatic orchestration:**
```python
# Model generates this code internally
results = []
for brick_id in headline_brick_ids:
    result = edit_brick(brick_id, {"fontFamily": "Montserrat", "fontWeight": "bold"})
    results.append(result)

success_count = sum(1 for r in results if r["success"])
failed = [r for r in results if not r["success"]]
print(f"Updated {success_count} of {len(results)} bricks. Failures: {len(failed)}")
```

Only the final print output enters the model's context: "Updated 5 of 5 bricks. Failures: 0"

The model then tells the user: "Done! I've updated all 5 headline bricks to Montserrat Bold."

**Advantages:**
- Dramatic token savings for batch operations
- Only final results enter context (reduces raw data leakage risk)
- Anthropic reports ~37% average token savings on complex tasks

**Disadvantages:**
- Requires a code execution sandbox
- More complex infrastructure
- Model must be able to write correct orchestration code

### Pattern 6: LlamaIndex Response Synthesizers

LlamaIndex provides dedicated response synthesizer components that transform retrieved data chunks into natural language answers. While designed for RAG, the patterns apply to any scenario where structured data needs natural language transformation.

**Available modes (from LlamaIndex documentation):**

1. **compact** (default): Concatenates data chunks, stuffing as many as fit within the context window, then sends a single LLM call to generate the response. Good for most scenarios.

2. **refine**: Processes each chunk sequentially, refining the answer with each new chunk. First chunk uses a `text_qa_template`, subsequent chunks use a `refine_template`. Good for detailed answers from multiple data sources.

3. **tree_summarize**: Recursively summarizes chunks in a tree structure until a single final answer remains. Ideal for summarization of large datasets.

4. **simple_summarize**: Truncates all chunks to fit in one prompt. Fast but may lose detail.

5. **accumulate**: Runs the query against each chunk separately, concatenating all responses. Good for comprehensive analysis.

(Source: LlamaIndex Response Synthesizers Documentation)

**Example:**

```python
from llama_index.core import get_response_synthesizer

# Create a synthesizer that compacts data before generating a response
synthesizer = get_response_synthesizer(response_mode="compact")

# Synthesize a natural language answer from structured data nodes
response = synthesizer.synthesize(
    "What does this brick look like?",
    nodes=[brick_data_node]
)
print(response)  # "The brick has a blue background with white text in Montserrat Bold..."
```

**Advanced feature - structured answer filtering:**
Setting `structured_answer_filtering=True` causes the synthesizer to filter out irrelevant data before generating the response, reducing noise in the final output.

(Source: LlamaIndex Response Synthesizers Documentation)

### Pattern 7: LangChain Output Parsers

LangChain provides several output parser types that handle the transformation between raw model output and desired formats:

**StrOutputParser**: Extracts the string content from an `AIMessage`. This is the simplest parser, returning the model's response as plain text. It "takes the raw output from the language model and returns it as a plain string, without making any changes or trying to structure it." Ideal for ensuring the final output is natural language.

(Source: LangChain Output Parsers Documentation, StrOutputParser API Reference)

```python
from langchain_core.output_parsers import StrOutputParser

# Chain: prompt -> model -> string parser
chain = prompt | model | StrOutputParser()
result = chain.invoke({"question": "What font is the headline using?"})
# result is a plain string: "The headline is using Montserrat Bold at 32px."
```

**JsonOutputParser**: Parses the model's output as JSON. Useful for intermediate processing steps where you need to extract structured data before a natural language transformation step.

```python
from langchain_core.output_parsers import JsonOutputParser

# Extract structured data, then convert to natural language
data_chain = prompt | model | JsonOutputParser()
structured_data = data_chain.invoke({"input": tool_result})

# Second chain to convert to natural language
nl_chain = describe_prompt | model | StrOutputParser()
user_response = nl_chain.invoke({"data": structured_data})
```

**StructuredOutputParser**: Creates format instructions from a schema and injects them into the prompt. Useful when you need the model to return specific fields that will be used for downstream processing.

(Source: LangChain Output Parsers Guide, Mastering LangChain Output Parsers)

### Pattern 8: Sub-Agent Architecture for Response Transformation

Anthropic's context engineering guide describes a pattern where specialized sub-agents handle tool execution and return only condensed summaries:

> "Specialized agents explore deeply but return only condensed summaries (1,000-2,000 tokens)"

(Source: Anthropic Effective Context Engineering)

```python
# Main agent delegates to a specialist sub-agent
class BrickEditorSubAgent:
    """Sub-agent that executes brick operations and returns natural language summaries."""

    def execute(self, operation: str, params: dict) -> str:
        # Execute the tool
        if operation == "get_brick":
            raw_result = self.tools.get_brick(params["brick_id"])
            # Transform internally before returning
            return self._summarize_brick(raw_result)
        elif operation == "edit_brick":
            raw_result = self.tools.edit_brick(params["brick_id"], params["updates"])
            return self._summarize_edit(raw_result)

    def _summarize_brick(self, data: dict) -> str:
        """Return a 1-2 sentence natural language description."""
        brick_type = data.get("type", "unknown")
        props = data.get("properties", {})
        return f"Found a {brick_type} brick. " + self._describe_key_properties(props)

    def _summarize_edit(self, data: dict) -> str:
        if data.get("success"):
            changes = data.get("updated_fields", {})
            change_list = [f"{self._humanize(k)} to {v}" for k, v in changes.items()]
            return f"Updated: {', '.join(change_list)}."
        return f"Failed to update: {data.get('error', 'unknown error')}"
```

The main agent only sees the natural language summary returned by the sub-agent, never the raw JSON.

### Pattern 9: High-Signal Tool Results (Upstream Optimization)

Rather than transforming results after the tool returns, optimize what the tool returns in the first place. Anthropic's tool design guide states: "Design tool responses to return only high-signal information. Return semantic, stable identifiers rather than opaque internal references, and include only the fields Claude needs to reason about its next step." (Source: Anthropic Writing Tools for Agents)

**Before optimization (bloated tool result):**
```json
{
  "id": "brick_5f3a2b1c",
  "campaign_id": "camp_8e7d6f5a",
  "template_id": "tmpl_4c3b2a19",
  "created_at": "2024-01-15T14:30:00Z",
  "updated_at": "2024-01-16T09:45:00Z",
  "version": 3,
  "type": "text",
  "position": {"x": 100, "y": 200, "width": 400, "height": 150},
  "properties": {
    "content": "Summer Sale - 50% Off",
    "fontFamily": "Montserrat",
    "fontWeight": "bold",
    "fontSize": 32,
    "fontStyle": "normal",
    "textDecoration": "none",
    "textTransform": "uppercase",
    "letterSpacing": 2,
    "lineHeight": 1.2,
    "textAlign": "center",
    "color": "#FFFFFF",
    "backgroundColor": "#1a237e",
    "padding": {"top": 16, "right": 24, "bottom": 16, "left": 24},
    "borderRadius": 8,
    "borderWidth": 0,
    "borderColor": "transparent",
    "borderStyle": "none",
    "opacity": 1,
    "overflow": "hidden",
    "zIndex": 5
  },
  "metadata": {
    "created_by": "user_abc123",
    "last_edited_by": "user_abc123",
    "lock_status": "unlocked",
    "approval_status": "draft"
  }
}
```

**After optimization (high-signal tool result):**
```json
{
  "name": "Hero Headline",
  "type": "text",
  "content": "Summer Sale - 50% Off",
  "style": {
    "font": "Montserrat Bold 32px",
    "text_color": "white (#FFFFFF)",
    "background": "dark blue (#1a237e)",
    "alignment": "center",
    "transform": "uppercase"
  },
  "status": "draft, unlocked"
}
```

The optimized result is 80% smaller and already uses human-readable descriptions ("dark blue" instead of just "#1a237e"), making it trivial for the model to describe naturally.

**Anthropic also recommends a ResponseFormat enum:**

```python
class ResponseFormat(str, Enum):
    DETAILED = "detailed"   # ~206 tokens, includes all IDs for follow-up calls
    CONCISE = "concise"     # ~72 tokens, just the essentials
```

"This reduces token consumption by ~1/3 while maintaining necessary data for chained operations." (Source: Anthropic Writing Tools for Agents)

### Pattern 10: SummarizationMiddleware (LangChain)

LangChain's `SummarizationMiddleware` monitors message token counts and automatically summarizes older messages when a threshold is reached. This prevents context bloat from accumulated tool results over long conversations.

The middleware "preserves recent messages and maintains context continuity by ensuring AI/Tool message pairs remain together." (Source: LangChain SummarizationMiddleware Reference)

This is particularly useful for the Sidekick agent in long editing sessions where the user makes many sequential edits, each generating tool results that accumulate in the context.

## Use Cases Relevant to This Project

### Use Case 1: Single Brick Retrieval

**User asks:** "Tell me about this brick"

**Pattern:** Implicit transformation (Pattern 1) + High-signal tool results (Pattern 9)

The `get_brick` tool returns an optimized result. The system prompt instructs the model to describe the brick naturally. One LLM turn handles both tool use and response.

### Use Case 2: Brick Editing

**User asks:** "Make the headline bigger and red"

**Pattern:** Implicit transformation (Pattern 1) with confirmation formatting

The `edit_brick` tool returns `{"success": true, "updated_fields": {"fontSize": 48, "color": "#FF0000"}}`. The system prompt ensures the model responds: "Done! I've increased the headline size to 48px and changed the color to red."

### Use Case 3: Schema Exploration

**User asks:** "What can I customize on this image brick?"

**Pattern:** Explicit result processor (Pattern 2) or Two-step LLM (Pattern 3)

The `get_brick_schema` tool returns a full JSON schema with property definitions, types, defaults, and constraints. This is complex enough that a dedicated processor should transform it into a categorized, readable list before the model describes it.

### Use Case 4: Batch Operations

**User asks:** "Update all text bricks to use the new brand font"

**Pattern:** Programmatic orchestration (Pattern 5) or Sub-agent (Pattern 8)

Multiple `edit_brick` calls are needed. Using programmatic orchestration or a sub-agent prevents 10+ JSON responses from entering the context. The model receives: "Updated 10 of 10 text bricks to Montserrat." and tells the user: "All done! I've updated the font on all 10 text bricks to the new brand font (Montserrat)."

### Use Case 5: Long Editing Sessions

**User conducts 20+ edits over a conversation**

**Pattern:** Tool result clearing (Pattern 4) + SummarizationMiddleware (Pattern 10)

After each edit is confirmed, the raw tool result is replaced with a placeholder. Periodically, older messages are summarized. This keeps the context window clean and prevents the model from re-reading old JSON data that might leak into responses.

### Use Case 6: Error Recovery

**Tool returns an error**

**Pattern:** Implicit transformation (Pattern 1) with error-specific prompt instructions

```text
When a tool returns an error:
- Explain the problem in plain language
- Never show error codes, stack traces, or raw error objects
- Suggest what the user can do instead
- Example: Instead of "VALIDATION_ERROR: fontSize must be 8-200",
  say "That font size is outside the allowed range (8-200px). What size would you like?"
```

## Tradeoffs

| Pattern | Quality | Latency | Token Cost | Complexity | Best For |
|---------|---------|---------|------------|------------|----------|
| **1. Implicit (prompt only)** | Good (90%) | Lowest | Standard | Lowest | Simple tool results |
| **2. Result processor node** | Very good (95%) | Low (no LLM call) | Reduced (smaller context) | Medium | Known, predictable schemas |
| **3. Two-step LLM** | Highest (98%+) | Higher (+1 LLM call) | Higher (+1 API call) | Medium-high | Complex, varied data |
| **4. Tool result clearing** | N/A (compaction) | None | Reduced over time | Low | Long conversations |
| **5. Programmatic orchestration** | Very good | Variable | Significantly reduced | High | Batch operations |
| **6. LlamaIndex synthesizers** | Good-high | Medium | Standard | Medium | RAG-like retrieval scenarios |
| **7. LangChain output parsers** | Good | Lowest | Standard | Low | Chain composition |
| **8. Sub-agent architecture** | Very good | Higher | Reduced (summary only) | High | Complex multi-tool workflows |
| **9. High-signal tool results** | Excellent (preventive) | None | Reduced | Low-medium | All scenarios |
| **10. SummarizationMiddleware** | N/A (context management) | Low | Reduced over time | Low | Long sessions |

### Trade-off: Prompt Engineering vs. Code-Level Transformation

**Prompt engineering only:**
- Fastest to implement
- No code changes to the agent graph
- Lower reliability (model can still leak data)
- Easy to iterate (just change the prompt)

**Code-level transformation (result processor, sub-agent):**
- More reliable (programmatic guarantee)
- Requires code changes and maintenance
- Must be updated when tool schemas change
- Can be tested with unit tests

**The sweet spot is combining both:** Code-level optimization of tool results (Pattern 9) reduces the raw data the model sees, while prompt instructions (Pattern 1) ensure the model describes what remains in natural language. This is lower effort than building a full result processor node but more reliable than prompt engineering alone.

## Recommended Approach for This Project

### Phase 1: Quick Wins (This Sprint)

#### 1A. Optimize Tool Result Content (Pattern 9)

Modify the `get_brick`, `edit_brick`, and `get_brick_schema` tool implementations to return high-signal, pre-formatted results:

```typescript
// In the brick editor tool implementation
function formatBrickResult(brick: Brick): object {
  return {
    name: brick.name || `${brick.type} brick`,
    type: brick.type,
    content_preview: brick.properties?.content?.substring(0, 100) || null,
    style_summary: {
      font: brick.properties?.fontFamily
        ? `${brick.properties.fontFamily} ${brick.properties.fontWeight || ''} ${brick.properties.fontSize || ''}px`.trim()
        : null,
      text_color: brick.properties?.color || null,
      background: brick.properties?.backgroundColor || null,
      alignment: brick.properties?.textAlign || null,
    },
    status: brick.metadata?.approval_status || 'unknown',
  };
}
```

This reduces the data the model sees by 70-80% and uses human-friendly formatting, making it much harder for the model to dump raw JSON because there is less raw JSON to dump.

#### 1B. Add Response Formatting to System Prompt (Pattern 1)

Add the `<response_formatting>` block from File 1 to the Sidekick system prompt. This is the single highest-impact prompt change.

#### 1C. Add Few-Shot Examples

Include 3-5 examples showing correct tool-result-to-natural-language transformation for each tool type.

### Phase 2: Robustness (Next Sprint)

#### 2A. Add a Result Processor Node (Pattern 2)

Implement a lightweight result processor in the LangGraph graph that:
- Parses tool results
- Translates field names to user-friendly terms
- Truncates large payloads
- Replaces UUIDs and internal IDs with meaningful names

This provides a code-level guarantee that certain patterns (raw JSON brackets, camelCase field names, UUIDs) never reach the model's context.

#### 2B. Implement Tool Result Clearing (Pattern 4)

After the model has responded to a tool result, replace the raw tool result in the conversation history with a short summary. This prevents old tool data from accumulating and leaking into later responses.

### Phase 3: Advanced (Future)

#### 3A. ResponseFormat Enum on Tools

Add `concise` and `detailed` response modes to tools so the agent can request the appropriate level of detail based on the user's question.

#### 3B. Conversation Summarization

For long editing sessions, implement periodic conversation summarization (Pattern 10) to keep the context clean and prevent the model from re-reading old tool data.

### Why This Phased Approach

- **Phase 1** requires minimal code changes (tool output formatting + prompt engineering) and addresses 90%+ of raw JSON leakage.
- **Phase 2** adds code-level guarantees for the remaining edge cases and improves performance in long conversations.
- **Phase 3** optimizes for advanced scenarios (batch operations, long sessions) that may not be common yet but will become important as usage grows.

Each phase builds on the previous one, and each can be shipped independently. The key principle from Anthropic's tool design guide applies throughout: "find the smallest set of high-signal tokens that maximize the likelihood of your desired outcome." (Source: Anthropic Effective Context Engineering)

## Sources

- Anthropic Effective Context Engineering for AI Agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic Advanced Tool Use: https://www.anthropic.com/engineering/advanced-tool-use
- Anthropic Writing Tools for Agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- Anthropic Tool Use Implementation: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
- Anthropic Prompting Best Practices: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices
- Anthropic Structured Outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- OpenAI Structured Outputs Guide: https://developers.openai.com/api/docs/guides/structured-outputs/
- OpenAI Function Calling: https://platform.openai.com/docs/guides/function-calling
- OpenAI Building Agents Track: https://developers.openai.com/tracks/building-agents
- OpenAI Practical Guide to Building Agents: https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
- LangChain Agents Documentation: https://docs.langchain.com/oss/python/langchain/agents
- LangChain Output Parsers: https://python.langchain.com/docs/modules/model_io/output_parsers/
- LangChain StrOutputParser API Reference: https://python.langchain.com/api_reference/core/output_parsers/langchain_core.output_parsers.string.StrOutputParser.html
- LangChain SummarizationMiddleware: https://reference.langchain.com/python/langchain/agents/middleware/summarization/SummarizationMiddleware
- LangChain DeepAgents: https://github.com/langchain-ai/deepagents
- LangGraph Respond in Structured Format: https://www.baihezi.com/mirrors/langgraph/how-tos/respond-in-format/index.html
- LangGraph Issue #4756 (structured_response behavior): https://github.com/langchain-ai/langgraph/issues/4756
- LangGraph Issue #5872 (Structured Output in Agent Node): https://github.com/langchain-ai/langgraph/issues/5872
- LangGraph Processing Tool Results Tutorial: https://aiproduct.engineer/tutorials/langgraph-tutorial-processing-tool-results-unit-21-exercise-4
- LangGraph Conversation Summarization Tutorial: https://aiproduct.engineer/tutorials/langgraph-tutorial-dynamic-conversation-summarization-unit-12-exercise-4
- LangGraph State Management Guide: https://medium.com/@o39joey/a-comprehensive-guide-to-langgraph-managing-agent-state-with-tools-ae932206c7d7
- LlamaIndex Response Synthesizers: https://developers.llamaindex.ai/python/framework/module_guides/querying/response_synthesizers/
- LlamaIndex Building Response Synthesis from Scratch: https://docs.llamaindex.ai/en/stable/examples/low_level/response_synthesis/
- Multi-AI Agent Parallel Processing (Medium): https://medium.com/@astropomeai/multi-ai-agent-parallel-processing-and-automatic-summarization-using-multiple-llms-ad80f410ae21
- Multi-Step LLM Chains Best Practices (Deepchecks): https://deepchecks.com/orchestrating-multi-step-llm-chains-best-practices/
- Agentic Design Patterns Part 3 - Tool Use (DeepLearning.AI): https://www.deeplearning.ai/the-batch/agentic-design-patterns-part-3-tool-use/
- LangChain Output Parser Guide (Mastering Output Parsing): https://www.comet.com/site/blog/mastering-output-parsing-in-langchain/
- LangChain Output Parsers Deep Dive (Medium): https://medium.com/@priyanka_neogi/mastering-langchain-output-parsers-and-prompt-templates-a-deep-dive-with-examples-400efe4839b8
- LangChain Output Parsers (SuperML.dev): https://superml.dev/langchain-output-parsers-guide
- LangMem Summarization Guide: https://langchain-ai.github.io/langmem/guides/summarization/
- "Stop Begging for JSON" (Charlie Guo): https://www.ignorance.ai/p/stop-begging-for-json
- OpenAI Agents SDK Guardrails: https://openai.github.io/openai-agents-python/guardrails/
- Output Formatting Best Practices (Agent.ai): https://docs.agent.ai/output-formatting
