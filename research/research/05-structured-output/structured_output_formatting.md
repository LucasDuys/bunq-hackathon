# Structured Output Formatting

## Summary

Structured output refers to constraining an LLM's response to follow a specific schema (typically JSON) so the output is machine-parseable and type-safe. This is essential for tool calls (where the agent must produce valid function arguments) but must be carefully separated from user-facing output (which should be natural language). The core challenge for the ByCape Sidekick agent is using structured output internally for reliable tool invocations while ensuring the final user-facing message is always conversational prose, not a JSON object or schema dump.

## Key Concepts

- **Structured output**: LLM responses constrained to follow a predefined JSON schema, guaranteed at the decoding level (not just prompt-level).
- **Constrained decoding**: A technique where the model's token generation is restricted at inference time to only produce tokens that form valid output according to a grammar or schema. Both Anthropic and OpenAI implement this.
- **Tool call parameters vs. user response**: Two fundamentally different output channels. Tool calls need structured data (function name, typed arguments). User responses need natural language.
- **Strict mode**: A flag (`strict: true` in Anthropic, `strict: true` in OpenAI) that enables constrained decoding for tool inputs, guaranteeing schema compliance.
- **Response format**: A separate API parameter that constrains the model's final text response to a JSON schema, distinct from tool call constraints.
- **Context-free grammar (CFG)**: The formal mechanism behind constrained decoding. The JSON schema is compiled into a CFG that masks invalid tokens during generation.
- **Pydantic / Zod models**: Python (Pydantic) and TypeScript (Zod) libraries for defining typed schemas that can be used directly with structured output APIs.
- **Internal vs. external output**: The distinction between data the model produces for programmatic consumption (internal) and text the model produces for human consumption (external).

## How It Works

### Anthropic's Structured Output System

Anthropic launched structured outputs in public beta on November 14, 2025, providing two complementary features:

#### 1. JSON Outputs (Response Format)

Controls the format of Claude's text response. Useful when you need the model's final answer in a specific schema.

```python
from pydantic import BaseModel
import anthropic

class ContactInfo(BaseModel):
    name: str
    email: str
    plan_interest: str
    demo_requested: bool

client = anthropic.Anthropic()
response = client.messages.parse(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": "Extract contact info from this email: John Smith (john@example.com) interested in Enterprise plan, wants demo."
    }],
    output_format=ContactInfo,
)
print(response.parsed_output)
# ContactInfo(name='John Smith', email='john@example.com', plan_interest='Enterprise', demo_requested=True)
```

(Source: Anthropic Structured Outputs Documentation)

#### 2. Strict Tool Use

Validates tool call parameters against the schema, ensuring Claude produces correctly-typed arguments.

```python
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "What's the weather in San Francisco?"}],
    tools=[{
        "name": "get_weather",
        "description": "Get current weather",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {"type": "string"},
                "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
            },
            "required": ["location"],
            "additionalProperties": False,
        },
    }]
)
```

(Source: Anthropic Structured Outputs Documentation)

**Key guarantees with strict mode:**
- Tool inputs strictly follow the schema
- No type mismatches (e.g., `"2"` instead of `2`)
- No missing required fields
- Tool names are always valid

**Without strict mode**, Claude might return `passengers: "two"` instead of `passengers: 2`, or omit required fields entirely.

#### Using Both Together

JSON outputs and strict tool use solve different problems and can be combined:

- **JSON outputs** control what Claude says (response format)
- **Strict tool use** validates how Claude calls functions (tool parameters)

```python
response = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Plan a trip to Paris departing May 15, 2026"}],
    # JSON outputs: structured final response
    output_config={
        "format": {
            "type": "json_schema",
            "schema": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "next_steps": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["summary", "next_steps"],
                "additionalProperties": False,
            },
        }
    },
    # Strict tool use: guaranteed tool calls
    tools=[{
        "name": "search_flights",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "destination": {"type": "string"},
                "date": {"type": "string", "format": "date"},
            },
            "required": ["destination", "date"],
            "additionalProperties": False,
        },
    }],
)
```

(Source: Anthropic Structured Outputs Documentation)

### OpenAI's Structured Output System

OpenAI's structured outputs use the same constrained decoding principle. The documentation establishes a clear distinction between two modes:

**For tool integration (function calling):**
> "Use function calling with Structured Outputs when you are connecting the model to tools, functions, data, etc. in your system."

**For user-facing output (response format):**
> "Use response_format when you want to structure the model's output when it responds to the user."

(Source: OpenAI Structured Outputs Guide)

In the newer Responses API, `response_format` has moved to `text.format`:

```python
# OpenAI Responses API
response = client.chat.completions.create(
    model="gpt-4o",
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "math_response",
            "schema": {
                "type": "object",
                "properties": {
                    "steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "explanation": {"type": "string"},
                                "output": {"type": "string"}
                            },
                            "required": ["explanation", "output"],
                            "additionalProperties": False
                        }
                    },
                    "final_answer": {"type": "string"}
                },
                "required": ["steps", "final_answer"],
                "additionalProperties": False
            }
        }
    },
    messages=[{"role": "user", "content": "solve 8x + 31 = 2"}]
)
```

(Source: OpenAI Structured Outputs Guide)

### How Constrained Decoding Works Under the Hood

Both Anthropic and OpenAI implement constrained decoding using context-free grammars (CFGs). The process:

1. **Schema compilation**: Your JSON schema is compiled into a grammar that defines all valid token sequences.
2. **Schema caching**: The compiled grammar is cached (Anthropic caches for 24 hours) so subsequent requests are faster.
3. **Token masking**: During generation, at each step, tokens that would violate the grammar are masked (their probability is set to zero), so the model can only produce valid output.
4. **Guaranteed compliance**: The output is guaranteed to be valid JSON matching your schema -- not "very likely" but mathematically certain.

As Charlie Guo describes it in "Stop Begging for JSON": with constrained decoding, "we have mathematical certainty instead of prompt engineering hope." (Source: "Stop Begging for JSON")

### The Guide to Structured Outputs and Function Calling

The comprehensive guide from Agenta explains the evolution:

**Level 1 - Prompt engineering**: "Please return valid JSON" -- unreliable, model may add prose, miss fields, or produce invalid syntax.

**Level 2 - JSON mode**: Forces the model to output valid JSON, but does not enforce a schema. You might get valid JSON that is completely wrong structurally.

**Level 3 - Structured outputs**: Constrains both JSON validity AND schema compliance. The model literally cannot produce output that violates your schema.

**Level 4 - Constrained decoding with tools**: Same guarantees applied to function call parameters, ensuring tool invocations are always well-formed.

(Source: Agenta Guide to Structured Outputs)

### LangGraph's Structured Response Pattern

LangGraph provides a `response_format` parameter on `create_react_agent` that binds a response schema as a tool to the model:

```python
from pydantic import BaseModel, Field

class WeatherResponse(BaseModel):
    """Final response to the user"""
    temperature: float = Field(description="the temperature in fahrenheit")
    conditions: str = Field(description="weather conditions description")
    advice: str = Field(description="advice for the user")

# Create agent with structured response
agent = create_react_agent(
    model=model,
    tools=[get_weather_tool],
    response_format=WeatherResponse
)
```

When `response_format` is specified, the schema is added as a special "final answer" tool. When the model calls this tool, the arguments are coerced into the response schema, and the agent loop terminates. This eliminates the need for an additional LLM call to format the response.

(Source: LangGraph Documentation, LangGraph Issues #5872, #4756)

You can also pair a prompt instruction with the schema:

```python
agent = create_react_agent(
    model=model,
    tools=[get_weather_tool],
    response_format=("Always describe weather in friendly terms", WeatherResponse)
)
```

(Source: LangGraph Structured Output Guide via Agentuity)

## Use Cases Relevant to This Project

### Use Case 1: Structured Tool Calls (Internal)

The Sidekick agent's `edit_brick` tool needs structured input to know which fields to change:

```json
{
  "brick_id": "brick_abc123",
  "updates": {
    "fontFamily": "Montserrat",
    "fontSize": 18,
    "fontWeight": "bold"
  }
}
```

This is an **internal structured output** -- the model must produce valid, typed JSON for the tool to execute correctly. Using `strict: true` on tool definitions ensures the model never sends `fontSize: "eighteen"` or omits required fields.

### Use Case 2: Natural Language User Response (External)

After the tool executes, the user should see:

> "Done! I've updated the heading font to Montserrat Bold at 18px."

This is an **external natural language output** -- it should never contain JSON notation, field names, or technical identifiers.

### Use Case 3: Schema Description (Hybrid)

When the user asks "What can I change on this brick?", the `get_brick_schema` tool returns a JSON schema object. The agent must:

1. Parse the schema internally (structured, internal)
2. Describe the available options in plain language (natural, external)

This requires the agent to understand structured data and translate it, not forward it.

### Use Case 4: Error Handling

When a tool returns an error response like `{"error": "VALIDATION_ERROR", "field": "fontSize", "message": "Value must be between 8 and 200"}`, the agent should say:

> "I couldn't make that change -- the font size needs to be between 8 and 200. What size would you like?"

Not: `Error: VALIDATION_ERROR on field fontSize: Value must be between 8 and 200`

### Use Case 5: Batch Operations

When multiple tool calls return results, the structured data should be aggregated internally and presented as a single natural language summary, not as a list of JSON responses.

## Tradeoffs

### Structured Output for User Responses vs. Natural Language

| Dimension | Structured User Response | Natural Language User Response |
|-----------|------------------------|-------------------------------|
| **Predictability** | 100% schema compliance | Varies; depends on prompt quality |
| **User experience** | Poor for conversational UX (JSON is not friendly) | Excellent for conversational UX |
| **Parsability** | Trivially machine-parseable | Requires NLP if you need to extract data later |
| **Flexibility** | Rigid schema; new fields require schema changes | Naturally handles novel situations |
| **Token cost** | May be slightly higher (constrained decoding overhead) | Standard token cost |
| **Implementation** | Requires schema definition + API parameter changes | Requires only prompt engineering |
| **When to use** | Internal processing, API responses, data extraction | User-facing chat, descriptions, confirmations |

### Strict Tool Use vs. Prompt-Only Tool Formatting

| Dimension | Strict Tool Use | Prompt-Only Formatting |
|-----------|----------------|----------------------|
| **Reliability** | 100% schema compliance | 95-99% with good prompts |
| **Type safety** | Guaranteed (no string/number confusion) | Occasional type errors |
| **Required fields** | Always present | Usually present, sometimes missing |
| **Setup cost** | Schema definition + `strict: true` flag | Zero additional setup |
| **Latency** | Slight increase (first call for schema compilation) | None |
| **Schema limitations** | No `minimum`/`maximum`, no `pattern`, no conditional schemas | No limitations (model uses judgment) |
| **Provider support** | Anthropic (Claude 4.5+), OpenAI (GPT-4o+) | All models |

### The Two-Output Architecture

The recommended architecture uses structured output for tool calls and natural language for user responses. This creates a clean separation:

```
User Message
    |
    v
[LLM Agent] ---(structured tool call)---> [Tool]
    ^                                        |
    |                                        |
    +--------(structured tool result)--------+
    |
    v
[LLM Agent] ---(natural language)---> [User]
```

The model receives structured data from tools but produces natural language for users. The key insight from OpenAI's documentation: "Use function calling when connecting the model to tools. Use response_format when structuring the model's output to the user." (Source: OpenAI Structured Outputs Guide)

### Provider-Specific Structured Output Limitations

**Anthropic (Claude):**
- Supported types: `object`, `array`, `string`, `integer`, `number`, `boolean`
- Supported constraints: `enum`, `required`, `additionalProperties: false`
- NOT supported: `minimum`, `maximum`, `minLength`, `maxLength`, complex patterns, conditional schemas
- Schemas cached for 24 hours with zero data retention (ZDR)
- Available on Claude Sonnet 4.5, Opus 4.1, and later models

(Source: Anthropic Structured Outputs Documentation)

**OpenAI:**
- Similar type support to Anthropic
- Available on GPT-4o-2024-08-06 and later, GPT-4o-mini
- SDK helpers: Pydantic (Python), Zod (TypeScript)
- Structured outputs preferred over JSON mode for schema compliance

(Source: OpenAI Structured Outputs Guide)

## Recommended Approach for This Project

### Architecture: Strict Tool Calls + Natural Language Responses

For the ByCape Sidekick agent, the recommended approach separates the two output channels:

#### Channel 1: Tool Invocations (Structured)

Enable `strict: true` on all Sidekick tool definitions to guarantee well-formed tool calls:

```python
tools = [
    {
        "name": "get_brick",
        "description": "Retrieves a brick's current properties and content",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "brick_id": {"type": "string", "description": "The brick identifier"}
            },
            "required": ["brick_id"],
            "additionalProperties": False
        }
    },
    {
        "name": "edit_brick",
        "description": "Updates one or more properties on a brick",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "brick_id": {"type": "string"},
                "updates": {
                    "type": "object",
                    "description": "Key-value pairs of properties to update"
                }
            },
            "required": ["brick_id", "updates"],
            "additionalProperties": False
        }
    },
    {
        "name": "get_brick_schema",
        "description": "Returns the schema of editable properties for a brick type",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "brick_type": {"type": "string", "description": "The type of brick"}
            },
            "required": ["brick_type"],
            "additionalProperties": False
        }
    }
]
```

This ensures the agent always sends valid parameters to your tools, eliminating tool execution errors from malformed inputs.

#### Channel 2: User Responses (Natural Language)

Do NOT use structured output / `response_format` for the user-facing response. Instead, use prompt engineering to ensure natural language:

```text
<response_rules>
Your responses to the user must always be in plain, conversational language.
Never include JSON, code blocks, field names, or technical identifiers.
Describe what you found or changed using terms a marketing designer would understand.
</response_rules>
```

**Why not use `response_format` for user messages?**

1. The Sidekick agent is a conversational assistant, not a data extraction pipeline. Users expect chat-like responses, not JSON objects.
2. A structured response schema would be rigid and unable to handle the variety of conversational contexts (questions, confirmations, errors, suggestions, clarifications).
3. Prompt engineering is sufficient for natural language quality and far more flexible for a conversational agent.

#### Channel 3: Tool Results (Optimized)

Apply Anthropic's guidance on tool result design from their "Writing Tools for Agents" blog post:

1. **Return only high-signal information**: Strip unnecessary metadata from tool results before passing them back to the model.
2. **Use semantic identifiers**: Return `brick_name: "Hero Banner"` instead of just `brick_id: "brick_abc123"`.
3. **Consider a ResponseFormat enum**: Implement `concise` vs `detailed` response modes on tools so the agent can request less data for simple confirmations.

(Source: Anthropic Writing Tools for Agents)

```python
# In tool implementation
def get_brick(brick_id: str, response_format: str = "concise") -> dict:
    brick = fetch_brick(brick_id)
    if response_format == "concise":
        return {
            "name": brick.name,
            "type": brick.type,
            "key_properties": {
                "font": f"{brick.font_family} {brick.font_weight} {brick.font_size}px",
                "colors": f"text: {brick.text_color}, background: {brick.bg_color}",
                "content_preview": brick.content[:100]
            }
        }
    else:
        return brick.to_dict()  # Full object for when the agent needs everything
```

This reduces the chance of raw JSON leakage because the tool result itself is more human-readable, making it easier for the model to describe naturally.

### Implementation Steps

1. **Add `strict: true` to all Sidekick tool definitions** -- immediate reliability win for tool calls.
2. **Add response formatting instructions to the system prompt** -- see File 1 for detailed prompt templates.
3. **Optimize tool result content** -- return pre-formatted, high-signal data from tools.
4. **Test with representative queries** -- verify the agent describes rather than dumps across all tool types.
5. **Monitor for regressions** -- log any instances where JSON appears in user-facing responses and add few-shot examples to address them.

## Sources

- Anthropic Structured Outputs Documentation: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Anthropic Prompting Best Practices: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices
- Anthropic Writing Tools for Agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- Anthropic Advanced Tool Use: https://www.anthropic.com/engineering/advanced-tool-use
- Anthropic Tool Use Implementation: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
- Anthropic Effective Context Engineering: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- OpenAI Structured Outputs Guide: https://developers.openai.com/api/docs/guides/structured-outputs/
- OpenAI Introducing Structured Outputs: https://openai.com/index/introducing-structured-outputs-in-the-api/
- OpenAI Function Calling: https://platform.openai.com/docs/guides/function-calling
- OpenAI Building Agents Track: https://developers.openai.com/tracks/building-agents
- OpenAI Practical Guide to Building Agents: https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
- "Stop Begging for JSON" (Charlie Guo): https://www.ignorance.ai/p/stop-begging-for-json
- Agenta Guide to Structured Outputs and Function Calling: https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms
- LangGraph Respond in Structured Format: https://www.baihezi.com/mirrors/langgraph/how-tos/respond-in-format/index.html
- LangGraph Structured Output (Agentuity): https://agentuity.com/blog/langgraph-structured-output
- LangGraph Issue #5872 (Structured Output in Agent Node): https://github.com/langchain-ai/langgraph/issues/5872
- LangGraph Issue #4756 (structured_response behavior): https://github.com/langchain-ai/langgraph/issues/4756
- LangGraph Structured Output and Self-Correcting Agents: https://machinelearningplus.com/gen-ai/langgraph-structured-output-validation-self-correcting/
- Claude API Structured Output (Thomas Wiegold): https://thomas-wiegold.com/blog/claude-api-structured-output/
- Zero-Error JSON with Claude (Medium): https://medium.com/@meshuggah22/zero-error-json-with-claude-how-anthropics-structured-outputs-actually-work-in-real-code-789cde7aff13
- Constrained Decoding Guide (Aidan Cooper): https://www.aidancooper.co.uk/constrained-decoding/
- Enforcing JSON Outputs in Commercial LLMs (DataChain): https://datachain.ai/blog/enforcing-json-outputs-in-commercial-llms
- Taming LLMs Structured Output (DEV Community): https://dev.to/shrsv/taming-llms-how-to-get-structured-output-every-time-even-for-big-responses-445c
