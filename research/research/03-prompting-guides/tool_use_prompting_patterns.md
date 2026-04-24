# Tool Use Prompting Patterns

## Summary

Tool use is the primary mechanism through which the Sidekick agent interacts with campaign data, brick configurations, and external services. Poorly written tool definitions and unclear system prompt instructions about when to call tools are the root cause of many agent failures -- including hallucinated parameters, unnecessary tool calls, raw JSON leakage to users, and inconsistent behavior across models. This document covers how to write prompts that make LLMs use tools correctly and consistently, drawing from both Anthropic and OpenAI official documentation.

## Key Concepts

- **Tool definitions**: Structured descriptions (name, description, input schema) that tell the model what tools are available. These are injected into the model's context and count against token limits.
- **Tool choice / tool_choice**: API parameter controlling whether the model must use a tool, can choose, or is forbidden from using tools.
- **Parallel tool calling**: Executing multiple independent tool calls simultaneously rather than sequentially.
- **Strict mode / structured outputs**: Setting `strict: true` on tool definitions to guarantee schema conformance.
- **Tool search / deferred loading**: Loading tool definitions only when needed rather than including all tools in every request.
- **Programmatic tool calling**: Claude executing tool calls within a code execution environment, reducing round-trips.
- **Agent-Computer Interface (ACI)**: Anthropic's concept that tool design deserves the same rigor as human-computer interface (HCI) design.
- **Error messaging in tool results**: Returning actionable error messages that guide the model toward correct usage.

## How It Works

### 1. Designing Tool Definitions

Tool definitions are the most important control surface for tool behavior. Anthropic found that developers spent more time optimizing tools than overall prompts when building their SWE-bench agent.

#### Naming

Use clear, descriptive names with namespace prefixes:
```json
{
  "name": "campaign_get_details",
  "description": "Retrieve full details of a campaign including name, status, date range, audience, and all associated items.",
  "input_schema": {
    "type": "object",
    "properties": {
      "campaign_id": {
        "type": "string",
        "description": "The unique identifier for the campaign. Use the campaign name or ID returned from campaign_list."
      }
    },
    "required": ["campaign_id"]
  }
}
```

Key naming principles:
- Use prefix-based namespacing: `campaign_list`, `campaign_get_details`, `brick_update`, `brick_get_layout`
- Names should indicate purpose at a glance
- Avoid generic names like `get_data` or `run_action`

#### Descriptions

Write descriptions as you would explain tools to a junior developer:
- Make usage obvious from the description alone
- Include example usage patterns and edge cases
- Specify what the tool returns
- Clarify boundaries between similar tools
- Document format requirements for parameters

**Bad description:**
```
"Get campaign data"
```

**Good description:**
```
"Retrieve the full details of a specific campaign, including its name, status (draft/active/paused/completed), date range, target audience, and a list of all items (bricks) in the campaign. Returns the campaign object with all fields populated. Use campaign_list first to find the campaign_id if you only have the campaign name."
```

#### Parameter Design

- Use unambiguous parameter names: `campaign_id` not `id`, `item_name` not `name`
- Prefer semantic identifiers over UUIDs when possible -- models make fewer errors with natural language identifiers
- Use enums to constrain valid values:

```json
{
  "status_filter": {
    "type": "string",
    "enum": ["draft", "active", "paused", "completed", "all"],
    "description": "Filter campaigns by status. Use 'all' to include every status."
  }
}
```

- Add a `response_format` parameter to let the model control verbosity:

```json
{
  "response_format": {
    "type": "string",
    "enum": ["concise", "detailed"],
    "description": "Use 'concise' for brief summaries. Use 'detailed' when you need full data including IDs for follow-up operations."
  }
}
```

### 2. Controlling When Tools Are Called

#### Anthropic Approach

Claude's latest models are trained for precise instruction following with tools. Key patterns:

**Making Claude take action (not just suggest):**
```
<default_to_action>
By default, implement changes rather than only suggesting them. If the user's intent
is unclear, infer the most useful likely action and proceed, using tools to discover
any missing details instead of guessing.
</default_to_action>
```

**Making Claude be conservative:**
```
<do_not_act_before_instructions>
Do not jump into implementation unless clearly instructed to make changes. When the
user's intent is ambiguous, default to providing information and recommendations
rather than taking action.
</do_not_act_before_instructions>
```

**Preventing overtriggering (critical for newer models):**
Claude Opus 4.5/4.6 are more responsive to system prompts than previous models. Prompts designed to reduce undertriggering will now cause overtriggering:
- Replace "CRITICAL: You MUST use this tool when..." with "Use this tool when..."
- Replace "If in doubt, use [tool]" with "Use [tool] when it would enhance your understanding"
- Replace "Default to using [tool]" with "Use [tool] when it would help solve the problem"

#### OpenAI Approach

GPT-4.1's instruction following is more literal. Three essential prompt components for agent tool use:

1. **Persistence instruction**: Tell the model it is in a multi-turn interaction:
```
Keep going until the user's query is completely resolved. Do not end your turn
prematurely or yield control to the user unless you need clarification.
```

2. **Tool-calling instruction**: Reduce hallucination:
```
Use your tools to look up information. Do NOT guess or make up answers.
If you need data, call the appropriate tool. Never fabricate tool parameters.
```

3. **Planning instruction** (optional but impactful -- +4% on benchmarks):
```
Before each tool call, briefly explain what you're about to do and why.
After receiving tool results, reflect on whether you have enough information
to answer the user's question before making another tool call.
```

These three instructions alone increased OpenAI's internal SWE-bench Verified performance by ~20%.

**Preventing hallucinated tool inputs:**
```
If you must call a tool but don't have enough information to fill all required
parameters, ask the user for the missing information rather than guessing.
```

### 3. Handling Tool Errors

#### Anthropic Pattern

Return clear, actionable error messages in `tool_result` blocks:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_123",
  "content": "Error: Campaign 'Summer Sale 2024' not found. Available campaigns: 'Summer Sale 2025', 'Q3 Loyalty Program', 'Brand Refresh'. Try again with the correct campaign name.",
  "is_error": true
}
```

The `is_error: true` flag helps Claude understand the tool failed and adjust its approach.

Key principles:
- Return specific, actionable error messages, not opaque error codes
- Include context that helps the model self-correct (available options, correct format examples)
- If truncation occurs, include instructions: "Results truncated. Try more targeted searches."

#### OpenAI Pattern

Track function call outputs with their respective call IDs:

```python
{
    "role": "tool",
    "tool_call_id": "call_abc123",
    "content": "Error: Invalid campaign_id format. Expected a string like 'camp_12345', received '12345'. Please include the 'camp_' prefix."
}
```

### 4. Parallel Tool Calling

#### Anthropic Pattern

Claude excels at parallel tool execution. To boost parallel calling to ~100% success rate:

```
<use_parallel_tool_calls>
If you intend to call multiple tools and there are no dependencies between the
tool calls, make all independent calls in parallel. For example, when loading
campaign details and brick layout simultaneously, run both tool calls at once.
However, if one tool call depends on another's result (e.g., you need the
campaign_id before fetching its bricks), call them sequentially. Never use
placeholders or guess missing parameters.
</use_parallel_tool_calls>
```

#### OpenAI Pattern

GPT-4.1 generally handles parallel calling well. Rare issues with incorrect parallel calls can be addressed:
- Set `parallel_tool_calls=false` in the API if issues persist
- Monitor for cases where the model makes dependent calls in parallel

### 5. Structured Outputs (Strict Mode)

Both Anthropic and OpenAI support schema enforcement on tool inputs:

**Anthropic:**
```json
{
  "name": "update_brick",
  "description": "Update a brick's content or styling",
  "input_schema": {
    "type": "object",
    "properties": {
      "brick_id": {"type": "string"},
      "field": {"type": "string", "enum": ["headline", "body", "cta", "image_url"]},
      "value": {"type": "string"}
    },
    "required": ["brick_id", "field", "value"]
  },
  "strict": true
}
```

**OpenAI:**
```json
{
  "type": "function",
  "function": {
    "name": "update_brick",
    "description": "Update a brick's content or styling",
    "parameters": {
      "type": "object",
      "properties": {
        "brick_id": {"type": "string"},
        "field": {"type": "string", "enum": ["headline", "body", "cta", "image_url"]},
        "value": {"type": "string"}
      },
      "required": ["brick_id", "field", "value"],
      "additionalProperties": false
    },
    "strict": true
  }
}
```

Always enable strict mode in production. It eliminates type mismatches and missing fields.

### 6. Tool Consolidation

Instead of many small tools, build fewer high-impact tools that match agent workflows:

**Bad (too many small tools):**
- `list_campaigns`
- `get_campaign_by_id`
- `get_campaign_status`
- `get_campaign_bricks`
- `get_brick_by_id`

**Better (consolidated by workflow):**
- `campaign_search` -- searches and filters campaigns, returns summary or detail
- `campaign_get_context` -- gets a campaign with all its bricks, brand guidelines, and recent changes in one call
- `brick_update` -- updates any brick field (content, styling, layout position)

Anthropic's guidance: "Instead of separate list_users + get_user + list_events tools, build a schedule_event tool that does all of that behind the scenes."

### 7. Tool Token Management

Tool definitions count against the model's context limit and are billed as input tokens. Strategies:
- Limit the number of tools loaded per request (OpenAI: <100 tools, <20 args per tool is the safe range)
- Use Anthropic's deferred tool loading (`defer_loading: true`) for large tool sets
- Shorten descriptions where possible without losing clarity
- Consider loading different tool sets for different specialist agents

## Use Cases Relevant to This Project

### Brick Editor Tool Definitions

The brick editor agent (GPT-5) works with structured brick data. Tool definitions must:
- Use semantic field names (`headline_text`, `cta_label`) not technical IDs
- Return natural language descriptions of changes, not raw brick JSON
- Include a `response_format` parameter so the agent can request concise vs detailed results

Example tool result that prevents JSON leakage:
```json
{
  "role": "tool",
  "tool_call_id": "call_xyz",
  "content": "Updated: The headline of brick 'Hero Banner' was changed from 'Summer Sale' to 'Summer Savings Event'. The brick is now in draft status, ready for review."
}
```

The tool implementation should format the response as natural language BEFORE returning it to the model. This is the most reliable way to prevent JSON leakage -- the model never sees the raw JSON.

### Campaign Context Loading

The campaign creator agent (o3) needs to load campaign context. Instead of multiple sequential tool calls:

```json
{
  "name": "campaign_load_context",
  "description": "Load all context needed to create or modify a campaign: brand guidelines, available templates, target audience segments, and existing campaign history for the tenant. Returns a structured summary organized by category.",
  "input_schema": {
    "type": "object",
    "properties": {
      "tenant": {
        "type": "string",
        "enum": ["cape", "klm", "takeaway", "philips", "optus", "airfrance", "switch"],
        "description": "The tenant/brand to load context for."
      },
      "include_sections": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["brand_guidelines", "templates", "audiences", "recent_campaigns"]
        },
        "description": "Which context sections to include. Omit to load all."
      }
    },
    "required": ["tenant"]
  }
}
```

### Router Tool Selection

The router agent (GPT-4o-mini) does not use tools in the traditional sense -- it classifies and routes. But if tool-based routing is used, keep the tool set minimal:

```json
{
  "name": "route_request",
  "description": "Classify the user's request and route it to the appropriate specialist agent.",
  "input_schema": {
    "type": "object",
    "properties": {
      "route": {
        "type": "string",
        "enum": ["campaign_creator", "brick_editor", "general_assistant"],
        "description": "The specialist agent to handle this request."
      },
      "confidence": {
        "type": "string",
        "enum": ["high", "medium", "low"],
        "description": "How confident you are in this routing decision."
      },
      "reasoning": {
        "type": "string",
        "description": "Brief explanation of why this route was chosen."
      }
    },
    "required": ["route", "confidence", "reasoning"],
    "additionalProperties": false
  },
  "strict": true
}
```

## Tradeoffs

| Approach | Pros | Cons |
|----------|------|------|
| **Many small tools** | Fine-grained control, simple implementations | More token overhead, more decision points for the model, higher error rate |
| **Few consolidated tools** | Fewer decisions, lower token cost, matches workflows | Complex implementations, harder to test individually |
| **Strict mode (structured outputs)** | Guaranteed schema conformance, no type errors | Requires `additionalProperties: false`, some schema constraints |
| **Deferred tool loading** | Saves tokens, scales to hundreds of tools | Additional round-trip for tool discovery, complexity |
| **Natural language tool results** | Prevents JSON leakage, better user experience | Loses precision, harder for model to chain operations |
| **Raw JSON tool results** | Precise data for chaining, no information loss | Risk of JSON leakage to users, higher token cost |
| **Parallel tool calls** | Faster execution, better user experience | Risk of incorrect parallel execution on dependent calls |
| **Sequential tool calls** | Safer for dependent operations | Slower, worse user experience |
| **Planning before tool calls** | Better tool selection, fewer wasted calls (+4% on benchmarks) | Higher latency, more tokens |
| **Direct tool calling (no planning)** | Faster, fewer tokens | More errors, especially on complex tasks |

## Recommended Approach for This Project

1. **Enable strict mode on ALL tool definitions across all three specialist agents.** This eliminates the class of bugs where the model passes malformed parameters.

2. **Format tool results as natural language in the tool implementation layer.** The most reliable way to prevent JSON leakage is to never let the model see raw JSON. The tool's server-side code should transform structured data into human-readable summaries before returning the result. Include a `response_format` parameter on tools that need both concise and detailed modes.

3. **Consolidate tools by workflow, not by API endpoint.** The brick editor should have `brick_update` (handles any field), `brick_layout_modify`, and `brick_preview` -- not separate tools for each field type. The campaign creator should have `campaign_load_context`, `campaign_create`, and `campaign_validate`.

4. **Add the three essential instructions to every agent's system prompt:**
   - Persistence: "Keep working until the user's request is fully resolved."
   - Tool-calling: "Use tools to look up information. Never guess or fabricate data."
   - Planning: "Before calling a tool, briefly explain what you need and why."

5. **Use model-appropriate tool triggering language:**
   - GPT-4o-mini (router): Explicit rules, no aggressive triggering language
   - o3 (campaign creator): Let o3's reasoning decide; focus on what, not how
   - GPT-5 (brick editor): Moderate guidance; GPT-5 handles tools naturally

6. **Return actionable error messages from all tools.** When a tool fails, the result should tell the model exactly what went wrong and what to try instead. Include available options, correct format examples, and contextual guidance.

7. **Use semantic identifiers over UUIDs wherever possible.** Instead of returning `brick_id: "abc-123-def"`, return `brick_name: "Hero Banner (ID: abc-123-def)"`. The model can use the name for reasoning and the ID for subsequent tool calls.

8. **Monitor tool usage patterns via LangSmith.** Track redundant tool calls (suggests tool descriptions need improvement), parameter errors (suggests unclear parameter documentation), and tool error rates (suggests implementation issues).

## Sources

- Anthropic Tool Use Overview: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Anthropic How to Implement Tool Use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
- Anthropic Programmatic Tool Calling: https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling
- Anthropic Advanced Tool Use: https://www.anthropic.com/engineering/advanced-tool-use
- Anthropic Writing Tools for Agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- Anthropic Prompting Best Practices (Tool Use Section): https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices
- Anthropic Building Effective Agents: https://www.anthropic.com/research/building-effective-agents
- Anthropic Claude Cookbooks -- Tool Choice: https://github.com/anthropics/anthropic-cookbook/blob/main/tool_use/tool_choice.ipynb
- Anthropic Claude Cookbooks -- Memory Tool: https://github.com/anthropics/claude-cookbooks/blob/main/tool_use/memory_cookbook.ipynb
- OpenAI Function Calling Guide: https://platform.openai.com/docs/guides/function-calling
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs/
- OpenAI Structured Outputs Introduction: https://developers.openai.com/cookbook/examples/structured_outputs_intro/
- OpenAI o3/o4-mini Function Calling Guide: https://developers.openai.com/cookbook/examples/o-series/o3o4-mini_prompting_guide/
- OpenAI GPT-4.1 Prompting Guide: https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide
- OpenAI Reasoning Function Calls Cookbook: https://cookbook.openai.com/examples/reasoning_function_calls
- OpenAI GPT-5 New Params and Tools: https://cookbook.openai.com/examples/gpt-5/gpt-5_new_params_and_tools
- OpenAI Using Tools Guide: https://platform.openai.com/docs/guides/tools
- Claude Function Calling Guide (Composio): https://composio.dev/content/claude-function-calling-tools
- Structured Outputs and Function Calling Guide (Agenta): https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms
- Building Better Agent Tools from Anthropic (Joshua Berkowitz): https://joshuaberkowitz.us/blog/news-1/unlocking-agentic-potential-best-practices-for-building-ai-tools-from-anthropic-1078
- Anthropic Tool Creation Guide Summary (Medium): https://medium.com/@dan.avila7/i-read-anthropics-complete-tool-creation-guide-so-you-don-t-have-to-here-s-what-actually-works-dc9377f20913
- Anthropic Tool Guide Analysis (Chro Blog): https://chro-ai.com/media/en/anthropic-tools-agents-guide/
- Tool Use on Amazon Bedrock: https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-tool-use.html
