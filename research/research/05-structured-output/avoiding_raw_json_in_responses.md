# Avoiding Raw JSON in Agent Responses

## Summary

When an LLM agent uses tools that return structured data (JSON objects, database records, schema definitions), the agent may echo that raw data directly to the user instead of describing it in natural language. This is a known failure mode in tool-using agents, particularly when the system prompt does not explicitly instruct the model to translate tool output into human-readable language. For the ByCape Sidekick brick editor agent, this manifests when `get_brick`, `edit_brick`, or `get_brick_schema` return JSON payloads and the agent forwards them verbatim rather than summarizing what was found or changed.

## Key Concepts

- **Raw data leakage**: The agent passes internal tool output (JSON, field names, schema objects) directly into the user-facing response without transformation.
- **Response formatting instructions**: Explicit directives in the system prompt that tell the model how to present information to the user.
- **Describe, don't dump**: A prompt engineering principle where the model is instructed to narrate what data means rather than showing the data itself.
- **Audience-appropriate output**: Tailoring the response to the user's technical level; a marketing designer does not need to see `{"type": "text", "properties": {"fontFamily": "Arial", "fontSize": 14}}`.
- **Tool result vs. user response separation**: The architectural distinction between what the model receives from a tool (internal context) and what it says to the user (external output).
- **Constrained decoding**: A technique where token generation is restricted at inference time to enforce output formats, available from both Anthropic and OpenAI.
- **Few-shot examples**: Providing concrete examples in the prompt of how to describe tool results naturally.

## How It Works

### The Root Cause

When a tool returns data to the LLM, that data enters the conversation as a `tool_result` message. The model then generates a response based on the full conversation history, including the raw tool output. Without explicit guidance, the model may:

1. Quote the JSON verbatim because it thinks the user wants "the data."
2. Show field names like `fontFamily`, `backgroundColor`, `contentType` because it lacks context about the user's technical level.
3. Dump an entire schema object when the user asked a simple question like "what font is this brick using?"
4. Mix natural language with embedded JSON fragments, creating a confusing hybrid response.
5. Use camelCase property names from the schema as if they were ordinary English words.

This problem is amplified in agentic systems because the tool-result-to-response pipeline is implicit. In a standard chat completion, the user provides input and the model provides output. In an agent loop, there is an intermediate step -- the tool result -- that is meant for the model's internal consumption but can leak into the user-facing output if the model lacks clear instructions to the contrary.

### Why Models Default to Data Dumping

Models trained with RLHF tend to be helpful and thorough. When they receive data from a tool, their default behavior is to share that data completely because they infer the user wants to see what was retrieved. As noted in the article "Stop Begging for JSON" by Charlie Guo, models "became more conversational, more eager to help, and more likely to wrap their JSON outputs in friendly prose" after instruction tuning. (Source: "Stop Begging for JSON")

This helpfulness bias means the model sees a JSON tool result and thinks: "The user asked a question. I have data that answers it. I should show the data." Without explicit instructions to transform the data first, the model takes the shortest path -- which is often to dump it.

Additionally, newer models like Claude 4.5+ and Claude 4.6 "may skip verbal summaries after tool calls, jumping directly to the next action." (Source: Anthropic Prompting Best Practices) This means they might not even attempt to describe the data -- they might just present it as-is or move to the next tool call without any user-facing output at all.

### The Conversation Message Flow

Understanding how messages flow in a tool-using agent helps clarify where raw JSON can leak:

```
1. User message:    "What font is the headline using?"
2. Assistant (tool): {tool_call: get_brick, args: {brick_id: "brick_123"}}
3. Tool result:     {"type": "text", "properties": {"fontFamily": "Montserrat", ...}}
4. Assistant (text): [THIS IS WHERE THE RESPONSE GOES]
```

Step 4 is the critical moment. The model has the full conversation in context, including the raw JSON from step 3. Its response at step 4 should be natural language, but without guidance, it may reference or echo the content of step 3.

Anthropic's tool use documentation specifies the exact format for tool results:

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01A09q90qw90lq917835lq9",
      "content": "The tool's output as a string"
    }
  ]
}
```

The model sees this `content` field and uses it to formulate its response. If the content is raw JSON, the model has raw JSON in its working context. The design guidance from Anthropic is to "return only high-signal information" in tool results and to "include only the fields Claude needs to reason about its next step." (Source: Anthropic Writing Tools for Agents)

This suggests the problem can be attacked from two directions: (1) what the tool returns (make it cleaner) and (2) what the model does with it (prompt it to describe, not dump).

### Prevention Strategy 1: Explicit System Prompt Instructions

The most direct and effective approach is to add clear formatting instructions to the system prompt. Anthropic's official documentation states: "Claude responds well to clear, explicit instructions. Being specific about your desired output can help enhance results." (Source: Anthropic Prompting Best Practices)

**Example system prompt additions for the Sidekick agent:**

```text
<response_formatting>
When presenting information from tool results to the user:
- Always describe data in plain, conversational language. Never show raw JSON, field names, or schema objects.
- Translate technical property names into user-friendly language (e.g., "fontFamily" becomes "font", "backgroundColor" becomes "background color").
- When reporting what you changed on a brick, summarize the change in one sentence (e.g., "I updated the headline font to Montserrat Bold at 24px").
- When reporting what you found about a brick, describe it naturally (e.g., "The hero image brick is using a blue background with white overlay text in Arial 16px").
- Never include JSON brackets, curly braces, or key-value notation in your response to the user.
- If the user explicitly asks for technical details or JSON, you may provide them, but default to natural language.
</response_formatting>
```

This aligns with Anthropic's guidance to "tell Claude what to do instead of what not to do" and to "be specific about the desired output format and constraints." (Source: Anthropic Prompting Best Practices)

### Prevention Strategy 2: Role Setting

Setting a clear role in the system prompt focuses the model's communication style. Anthropic notes: "Role prompting adjusts Claude's communication style and helps Claude stay more within the bounds of your task's specific requirements." (Source: Anthropic Prompting Best Practices)

```text
You are a friendly design assistant helping marketing professionals edit campaign bricks.
You communicate in plain language that a non-technical designer would understand.
You never expose internal data structures, JSON, or technical field names unless
the user explicitly requests technical details.
```

### Prevention Strategy 3: Few-Shot Examples

Few-shot prompting is described by Anthropic as "one of the most reliable ways to steer Claude's output format, tone, and structure." (Source: Anthropic Prompting Best Practices)

```xml
<examples>
  <example>
    <user_query>What font is the headline using?</user_query>
    <tool_result>{"type": "text", "properties": {"content": "Summer Sale", "fontFamily": "Montserrat", "fontWeight": "bold", "fontSize": 32, "color": "#FFFFFF"}}</tool_result>
    <correct_response>The headline "Summer Sale" is using Montserrat Bold at 32px in white.</correct_response>
    <incorrect_response>The brick has these properties: {"fontFamily": "Montserrat", "fontWeight": "bold", "fontSize": 32, "color": "#FFFFFF"}</incorrect_response>
  </example>
  <example>
    <user_query>Change the background to red</user_query>
    <tool_result>{"success": true, "updated_fields": {"backgroundColor": "#FF0000"}, "brick_id": "brick_abc123"}</tool_result>
    <correct_response>Done! I've changed the background color to red.</correct_response>
    <incorrect_response>Updated successfully. The brick brick_abc123 now has backgroundColor: #FF0000.</incorrect_response>
  </example>
</examples>
```

### Prevention Strategy 4: Output Format Matching

Anthropic's documentation notes: "The formatting style used in your prompt may influence Claude's response style. If you are still experiencing steerability issues with output formatting, try matching your prompt style to your desired output style as closely as possible." (Source: Anthropic Prompting Best Practices)

This means:
- If your system prompt is written in conversational prose, the model is more likely to respond in conversational prose.
- If your system prompt contains JSON examples or technical notation, the model is more likely to include those in its responses.
- Remove any markdown formatting from the prompt if you want to reduce markdown in the output.

### Prevention Strategy 5: Post-Tool-Call Summary Instructions

Anthropic notes that newer Claude models "may skip verbal summaries after tool calls, jumping directly to the next action." To counteract this for user-facing agents: (Source: Anthropic Prompting Best Practices)

```text
After completing a task that involves tool use, provide a quick summary of the
work you've done in plain language that a non-technical user would understand.
```

### Prevention Strategy 6: XML Output Tags

Anthropic recommends XML tags for structuring output:

```text
Write the user-facing portion of your response in <user_message> tags.
Use plain, conversational language. Never include JSON, field names,
or technical identifiers inside <user_message> tags.
```

This gives you a parsing hook in your application code to extract only the user-facing content, even if the model includes internal reasoning elsewhere.

### Prevention Strategy 7: Tool Description Guidance

The tool definition itself can guide the model on how to present results. Anthropic's tool design guide notes that tool descriptions should convey "usage patterns: when to include optional parameters, which combinations make sense, or what conventions your API expects." (Source: Anthropic Advanced Tool Use)

Apply this to response formatting by adding presentation hints in tool descriptions:

```json
{
  "name": "get_brick",
  "description": "Retrieves a brick's current properties. When presenting results to the user, describe the brick's appearance and content in plain language rather than showing the raw property values. Translate field names like fontFamily to 'font', backgroundColor to 'background color', etc.",
  "input_schema": {
    "type": "object",
    "properties": {
      "brick_id": {"type": "string"}
    },
    "required": ["brick_id"]
  }
}
```

This embeds formatting guidance at the tool level, so even if the system prompt is complex or the model's attention wanders, the guidance is co-located with the tool result.

### Prevention Strategy 8: Audience Specification with Context

Anthropic's documentation emphasizes that "providing context or motivation behind your instructions, such as explaining to Claude why such behavior is important, can help Claude better understand your goals and deliver more targeted responses." (Source: Anthropic Prompting Best Practices)

Rather than just saying "don't show JSON," explain why:

```text
<audience_context>
Your users are marketing designers at companies like KLM, Philips, and Takeaway.
They use a visual editor to build campaign materials. They understand design terms
(font, color, spacing, alignment) but not programming terms (JSON, objects, properties,
camelCase field names). When you communicate with them, use the vocabulary of a
design tool, not a code editor.

Your response will be read directly by these designers in a chat interface alongside
the visual editor. Showing raw data structures would break their workflow and create
confusion. Always translate technical tool output into design-friendly language.
</audience_context>
```

This motivation-based approach is often more effective than rules alone because the model understands the reasoning and can generalize to novel situations.

### Prevention Strategy 9: Negative Examples with Explanation

While positive examples show the model what to do, negative examples with explanations show what to avoid and why. This is particularly effective for persistent failure modes:

```xml
<anti_patterns>
  <anti_pattern>
    <bad_response>The brick properties are: {"fontFamily": "Arial", "fontSize": 14, "color": "#333333"}</bad_response>
    <why_bad>Shows raw JSON to a non-technical user. The curly braces, quotes, and camelCase field names are confusing.</why_bad>
    <better>The brick is using Arial at 14px in dark gray.</better>
  </anti_pattern>
  <anti_pattern>
    <bad_response>I've updated brick_abc123's backgroundColor to #FF0000.</bad_response>
    <why_bad>Exposes the internal brick ID and uses a hex color code instead of the color name. Also uses the camelCase field name "backgroundColor".</why_bad>
    <better>Done! I've changed the background color to red.</better>
  </anti_pattern>
  <anti_pattern>
    <bad_response>The schema shows the following editable fields: fontFamily (string), fontSize (integer, min: 8, max: 200), fontWeight (enum: ["normal", "bold", "light"])...</bad_response>
    <why_bad>Dumps the schema with programming types and constraints. The user wants to know what they can change, not the type system.</why_bad>
    <better>You can customize the font (family, size, and weight), text color, background color, padding, and alignment on this brick.</better>
  </anti_pattern>
</anti_patterns>
```

### Prevention Strategy 10: Output Guardrails (Programmatic Safety Net)

As a last line of defense, implement a programmatic check on the agent's output before sending it to the user. OpenAI's agent design guide recommends "output guardrails that run on the agent's final response" for quality assurance. (Source: OpenAI Practical Guide to Building Agents)

```typescript
function sanitizeAgentResponse(response: string): string {
  // Check for common JSON patterns
  const jsonPatterns = [
    /\{[\s]*"[^"]+"\s*:/,     // JSON object start: {"key":
    /\[\s*\{/,                 // JSON array start: [{
    /[a-z]+[A-Z][a-z]+/,      // camelCase words (fontFamily, backgroundColor)
    /[a-f0-9]{24}/i,          // MongoDB ObjectId
    /brick_[a-z0-9]+/,        // Internal brick IDs
    /"type"\s*:\s*"/,          // JSON type field
  ];

  const hasJsonLeakage = jsonPatterns.some(pattern => pattern.test(response));

  if (hasJsonLeakage) {
    // Log for monitoring
    logger.warn('Agent response contains potential raw data leakage', {
      response: response.substring(0, 200),
    });

    // Option 1: Flag for review (recommended during development)
    // Option 2: Run a fast cleanup LLM call
    // Option 3: Strip the JSON and return a generic message (last resort)
  }

  return response;
}
```

This should not be the primary defense (prompt engineering should handle 90%+ of cases), but it provides observability and a safety net for production.

### Combining Strategies: The Defense-in-Depth Model

No single strategy is 100% reliable. The most robust approach layers multiple strategies:

```
Layer 1 (Upstream):   Optimize tool result content (return less raw data)
Layer 2 (Role):       Set the agent's role as a design assistant
Layer 3 (Rules):      Explicit response formatting instructions
Layer 4 (Examples):   Few-shot examples of correct behavior
Layer 5 (Context):    Audience specification with motivation
Layer 6 (Tooling):    Tool descriptions with presentation guidance
Layer 7 (Downstream): Output guardrails for monitoring and safety
```

Each layer catches what the previous layers miss. In practice, Layers 1-4 handle nearly all cases. Layers 5-7 provide incremental improvements and observability.

## Use Cases Relevant to This Project

### Scenario 1: User asks "What does this brick look like?"

The `get_brick` tool returns a full JSON object with dozens of fields. Without formatting instructions, the agent might dump the entire object. With proper prompting, the agent should describe: "This is a text brick with a navy blue background. The headline says 'Summer Sale' in white Montserrat Bold, 32px. Below that is body text in light gray, 14px."

### Scenario 2: User says "Change the font size to 18"

The `edit_brick` tool returns a success response with updated field values. Without formatting instructions, the agent might say: `{"success": true, "updated_fields": {"fontSize": 18}}`. With proper prompting: "Done! I've updated the font size to 18px."

### Scenario 3: User asks "What properties can I change on this brick?"

The `get_brick_schema` tool returns a JSON schema with property definitions, types, enums, etc. Without formatting instructions, the agent might dump the entire schema. With proper prompting: "You can change the text content, font (family, size, weight, style), colors (text color and background), padding, alignment, and border settings."

### Scenario 4: User asks about an error

A tool returns `{"error": "BRICK_NOT_FOUND", "brick_id": "brick_xyz789", "message": "No brick found with the specified identifier"}`. Without formatting: the agent echoes the error object. With formatting: "I couldn't find that brick. It may have been deleted or moved. Could you point me to the brick you'd like to edit?"

### Scenario 5: Bulk operations

The user asks "Update all headings to use Montserrat." Multiple `edit_brick` calls return individual JSON results. Without formatting, the agent lists every JSON response. With formatting: "I've updated 5 headline bricks to use Montserrat. All changes are saved."

### Scenario 6: Partial success in multi-step operations

The user asks to apply a style across bricks, but one brick has a validation error. Without formatting, the agent might show a mix of success JSON and error JSON for each brick. With proper formatting: "I updated 4 of 5 bricks to the new style. The hero banner couldn't be updated because the font size is outside the allowed range. Would you like to adjust the font size for that one?"

### Scenario 7: Comparing bricks

The user asks "How do these two bricks differ?" The agent calls `get_brick` twice and receives two JSON objects. Without formatting, the agent might show both objects side by side. With proper formatting: "The main differences are: the first brick uses Montserrat Bold at 24px, while the second uses Arial Regular at 16px. The first has a dark blue background, and the second has white."

### Scenario 8: Complex nested data

A brick has nested properties (e.g., padding with top/right/bottom/left values, border with width/color/style). Without formatting, the agent shows nested JSON. With formatting: "The brick has 16px padding on all sides and a 2px solid gray border."

## Tradeoffs

| Approach | Reliability | Implementation Effort | Performance Impact | Flexibility |
|----------|------------|----------------------|-------------------|-------------|
| **System prompt instructions** | High (90%+) with clear instructions | Low (prompt changes only) | None | High; easy to iterate |
| **Few-shot examples** | Very high (95%+) when examples cover key scenarios | Medium (need to craft examples) | Slight token increase | Medium; examples cover fixed patterns |
| **Role setting** | Moderate (helps but not sufficient alone) | Very low | None | High |
| **XML output tags** | High; provides parsing fallback | Medium (needs app-side parsing) | None | High; clean separation |
| **Post-processing regex/filter** | Low reliability as sole approach | High (fragile regex patterns) | Slight compute cost | Low; breaks with format changes |
| **Structured output for user message** | Very high (100% schema compliance) | Medium-high (schema definition + API changes) | Slight latency from constrained decoding | Low; rigid schema required |
| **Combination approach** | Highest (97%+) | Medium | Minimal | High |

### Cost of Not Addressing This

- **User confusion**: Non-technical users (marketing designers) see `fontFamily: "Arial"` and don't know what to do with it.
- **Trust erosion**: Raw JSON makes the agent look broken or unintelligent.
- **Support burden**: Users escalate to support when the agent "speaks in code."
- **Adoption risk**: Users abandon the Sidekick agent if responses are not helpful.

### Cost of Over-Constraining

- **Loss of detail**: Overly aggressive suppression of technical info could prevent power users from getting data they actually want.
- **Prompt bloat**: Extensive examples and instructions consume tokens from the context window.
- **Maintenance**: Prompt instructions need updating as the tool schema evolves.

## Recommended Approach for This Project

For the ByCape Sidekick brick editor agent, use a **layered approach** combining multiple strategies:

### 1. Core System Prompt Block (Mandatory)

Add a dedicated `<response_formatting>` section to the Sidekick system prompt with explicit natural-language-only instructions. This is the single highest-impact change:

```text
<response_formatting>
You are speaking to marketing designers who are not developers.

CRITICAL RULES:
- Never include raw JSON, code blocks, field names (like fontFamily, backgroundColor),
  or technical identifiers (like brick IDs, UUIDs) in your responses.
- Always translate tool results into plain, friendly language.
- When you retrieve brick data, describe what the brick looks like and contains.
- When you edit a brick, confirm what you changed in plain terms.
- When you describe available properties, list them in user-friendly terms
  (e.g., "font size" not "fontSize", "background color" not "backgroundColor").
- If a tool returns an error, explain the problem and suggest next steps
  without showing error codes or JSON.

Your response will be read by a non-technical person, so it must be immediately
understandable without any programming knowledge.
</response_formatting>
```

### 2. Few-Shot Examples (Recommended)

Include 3-5 examples in the system prompt demonstrating correct behavior for the most common tool interactions (get, edit, schema). This dramatically improves consistency per Anthropic's guidance.

### 3. Field Name Translation Map (Optional Enhancement)

Provide a reference mapping in the system prompt:

```text
<field_translations>
When describing brick properties, use these user-friendly names:
- fontFamily -> "font"
- fontSize -> "font size"
- fontWeight -> "font weight" (or "bold/regular/light")
- backgroundColor -> "background color"
- textColor -> "text color"
- borderRadius -> "corner rounding"
- contentType -> "brick type"
- imageUrl -> "image"
- overlayOpacity -> "overlay transparency"
</field_translations>
```

### 4. Escape Hatch for Technical Users

Allow advanced users to request raw data:

```text
If the user explicitly asks for "the JSON", "the raw data", "the technical details",
or "the schema", you may provide structured data. Otherwise, always use natural language.
```

### 5. Tool Description Enhancements

Add response formatting hints to each tool's description field:

```json
{
  "name": "get_brick",
  "description": "Retrieves a brick's current properties and content. When presenting results, describe what the brick looks like in plain language. Never show the raw JSON to the user. Translate property names (fontFamily -> font, backgroundColor -> background color, etc.)."
}
```

```json
{
  "name": "edit_brick",
  "description": "Updates one or more properties on a brick. After a successful edit, confirm the change in plain language (e.g., 'I updated the font to Montserrat Bold'). After a failed edit, explain the problem without showing error codes."
}
```

```json
{
  "name": "get_brick_schema",
  "description": "Returns the schema of editable properties for a brick type. When presenting results, list the available customization options in user-friendly terms (e.g., 'font settings', 'colors', 'spacing'). Never show the raw schema with types and constraints."
}
```

### 6. Audience Context Block

Provide motivation for the formatting rules:

```text
<audience_context>
Your users are marketing designers at companies like KLM, Philips, and Takeaway.
They work in a visual editor to build campaign materials. They understand design
concepts (font, color, spacing) but not programming concepts (JSON, objects,
properties, schemas). Your responses appear in a chat panel beside the visual
editor. Showing code or raw data breaks their workflow and erodes trust.
</audience_context>
```

### 7. Output Monitoring (Optional)

Implement a lightweight programmatic check on agent responses to detect JSON leakage patterns (curly braces, camelCase field names, hex color codes without context, internal IDs). This provides observability without blocking the response. Log instances where JSON appears so the team can add targeted few-shot examples.

### Why This Combination Works

- **System prompt instructions** handle 90%+ of cases with zero code changes.
- **Few-shot examples** catch edge cases and demonstrate the exact tone desired.
- **Field translations** prevent the most common leakage point (technical field names).
- **Escape hatch** preserves flexibility for power users without impacting the default experience.
- **No infrastructure changes needed** -- this is entirely achievable through prompt engineering within the existing LangGraph agent setup.

### Implementation Priority

1. Add `<response_formatting>` block to Sidekick system prompt (immediate, high impact)
2. Add few-shot examples for get_brick, edit_brick, get_brick_schema responses (next sprint)
3. Add field translation map (can iterate over time as you discover leakage points)
4. Monitor and add examples for any new patterns where raw JSON leaks through

## Sources

- Anthropic Prompting Best Practices (Claude 4 models): https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices
- Anthropic Prompt Engineering Overview: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
- Anthropic Structured Outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Anthropic Effective Context Engineering for AI Agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic Writing Tools for Agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- Anthropic Advanced Tool Use: https://www.anthropic.com/engineering/advanced-tool-use
- Anthropic Tool Use Implementation: https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use
- OpenAI Structured Outputs Guide: https://developers.openai.com/api/docs/guides/structured-outputs/
- OpenAI Function Calling: https://platform.openai.com/docs/guides/function-calling
- OpenAI Prompt Engineering Best Practices: https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-the-openai-api
- OpenAI Building Agents Track: https://developers.openai.com/tracks/building-agents
- OpenAI Practical Guide to Building Agents: https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
- "Stop Begging for JSON" (Charlie Guo): https://www.ignorance.ai/p/stop-begging-for-json
- Mastering System Prompts for AI Agents: https://pguso.medium.com/mastering-system-prompts-for-ai-agents-3492bf4a986b
- Prompt Engineering for Chatbots (Voiceflow): https://www.voiceflow.com/blog/prompt-engineering
- Claude's Context Engineering Secrets: https://01.me/en/2025/12/context-engineering-from-claude/
- Prompt Engineering Guide (Lakera): https://www.lakera.ai/blog/prompt-engineering-guide
- AWS Prompt Engineering Overview: https://aws.amazon.com/what-is/prompt-engineering/
- Google Cloud Prompt Engineering Guide: https://cloud.google.com/discover/what-is-prompt-engineering
