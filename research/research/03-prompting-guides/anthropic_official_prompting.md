# Anthropic Official Prompt Engineering Guide

## Summary

Anthropic maintains a comprehensive prompt engineering guide covering every major technique for getting reliable, high-quality outputs from Claude models. This matters to the Sidekick project because the system prompts stored in LangSmith are the primary control surface for agent behavior -- every issue with instruction following, raw JSON leakage, or inconsistent notes traces back to how those prompts are written. Anthropic's official guidance is the authoritative reference for fixing these problems.

## Key Concepts

- **System prompt vs user prompt**: System prompts set persistent role, behavior, and constraints. User prompts provide task-specific instructions. Claude places emphasis on both, but system prompts define the agent's "constitution" while user prompts are the per-turn "laws."
- **XML tags**: Anthropic's recommended way to structure complex prompts. Tags like `<instructions>`, `<context>`, `<example>`, and `<input>` create unambiguous boundaries between sections.
- **Few-shot (multishot) prompting**: Providing 3-5 concrete input/output examples to steer format, tone, and structure. The single most reliable way to get consistent output.
- **Role prompting**: Assigning Claude a specific persona via the system prompt to focus behavior and tone.
- **Chain of thought**: Encouraging Claude to reason through problems step by step, either via extended thinking (API parameter) or manual `<thinking>` tags.
- **Clarity and directness**: Anthropic's golden rule -- if a colleague with minimal context would be confused by your prompt, Claude will be too.
- **Effort parameter**: Controls thinking depth in Claude 4.6 models (low/medium/high/max).
- **Adaptive thinking**: Claude 4.6's default thinking mode where it dynamically decides when and how much to reason.
- **Structured outputs**: API-level schema enforcement via `strict: true` on tool definitions, guaranteeing output matches a JSON schema.

## How It Works

### Step 1: Establish Success Criteria Before Prompting

Anthropic recommends starting with:
1. A clear definition of success criteria for your use case
2. Empirical tests against those criteria
3. A first draft prompt to improve

This is the foundation -- prompt engineering without evaluation is guesswork.

### Step 2: Be Clear and Direct

Claude responds well to explicit instructions. Anthropic's golden rule:

> Show your prompt to a colleague with minimal context on the task and ask them to follow it. If they'd be confused, Claude will be too.

Specific practices:
- Be specific about desired output format and constraints
- Provide instructions as sequential steps using numbered lists when order matters
- Tell Claude what to do, not what not to do

**Less effective:**
```
Create an analytics dashboard
```

**More effective:**
```
Create an analytics dashboard. Include as many relevant features and interactions as possible. Go beyond the basics to create a fully-featured implementation.
```

### Step 3: Add Context and Motivation

Explain *why* an instruction matters. Claude generalizes from explanations.

**Less effective:**
```
NEVER use ellipses
```

**More effective:**
```
Your response will be read aloud by a text-to-speech engine, so never use ellipses since the text-to-speech engine will not know how to pronounce them.
```

### Step 4: Use XML Tags for Structure

XML tags help Claude parse complex prompts unambiguously. This is especially important when prompts mix instructions, context, examples, and variable inputs.

```xml
<documents>
  <document index="1">
    <source>annual_report_2023.pdf</source>
    <document_content>
      {{ANNUAL_REPORT}}
    </document_content>
  </document>
</documents>

<instructions>
Analyze the annual report and identify strategic advantages.
</instructions>
```

Best practices:
- Use consistent, descriptive tag names across prompts
- Nest tags when content has natural hierarchy
- Wrap examples in `<example>` tags (multiple in `<examples>`)

### Step 5: Provide Few-Shot Examples

Examples are the single most reliable way to steer output format, tone, and structure. Anthropic recommends 3-5 examples that are:
- **Relevant**: Mirror actual use cases
- **Diverse**: Cover edge cases; vary enough to prevent unintended pattern pickup
- **Structured**: Wrapped in `<example>` tags to separate from instructions

```xml
<examples>
  <example>
    <input>What campaigns are running for KLM?</input>
    <output>You currently have 3 active campaigns for KLM: Summer Sale 2024, Loyalty Program Q3, and Brand Refresh. Would you like details on any of them?</output>
  </example>
  <example>
    <input>Show me the brick layout</input>
    <output>Here's the current layout for your campaign. You have 4 items arranged in a 2x2 grid. Each item includes a headline, image, and CTA button. Would you like to modify any of them?</output>
  </example>
</examples>
```

### Step 6: Assign a Role via the System Prompt

Setting a role focuses Claude's behavior:

```python
message = client.messages.create(
    model="claude-opus-4-6",
    max_tokens=1024,
    system="You are a helpful coding assistant specializing in Python.",
    messages=[
        {"role": "user", "content": "How do I sort a list of dictionaries by key?"}
    ],
)
```

Even a single sentence in the system prompt makes a measurable difference in output quality and consistency.

### Step 7: Handle Long Context Properly

For prompts with 20K+ tokens of context:
- **Put longform data at the top**: Place documents above your query and instructions. Queries at the end improve response quality by up to 30%.
- **Structure with XML tags**: Wrap each document in `<document>` tags with metadata subtags.
- **Ground responses in quotes**: Ask Claude to quote relevant parts before reasoning. This cuts through noise.

### Step 8: Control Output Format

Four effective approaches:
1. **Tell Claude what to do, not what not to do**: Instead of "Do not use markdown," say "Your response should be composed of smoothly flowing prose paragraphs."
2. **Use XML format indicators**: "Write prose sections in `<smoothly_flowing_prose_paragraphs>` tags."
3. **Match prompt style to desired output**: Formatting in prompts influences response formatting.
4. **Provide detailed formatting instructions**: Explicit guidance about when to use lists, headers, prose, etc.

### Step 9: Leverage Thinking Capabilities

Claude 4.6 supports adaptive thinking where it dynamically decides when and how deeply to reason:

```python
client.messages.create(
    model="claude-opus-4-6",
    max_tokens=64000,
    thinking={"type": "adaptive"},
    output_config={"effort": "high"},
    messages=[{"role": "user", "content": "..."}],
)
```

Key guidance:
- Prefer general instructions ("think thoroughly") over prescriptive step-by-step plans
- Multishot examples work with thinking -- use `<thinking>` tags in examples
- Ask Claude to self-check: "Before you finish, verify your answer against [criteria]"
- When thinking is disabled, you can still encourage step-by-step reasoning manually

### Step 10: Tune for Model Version

Claude 4.6 models are significantly more responsive to system prompts than previous versions. Critical migration advice:
- **Dial back aggressive language**: Where you used "CRITICAL: You MUST use this tool when...", now use "Use this tool when..."
- **Remove anti-laziness prompting**: Claude 4.6 is proactive by default; aggressive thoroughness prompts cause overtriggering
- **Use effort parameter**: Instead of prompt-based thoroughness control, use `effort: "low"/"medium"/"high"/"max"`
- **Prefilled responses are deprecated**: Use structured outputs or direct instructions instead

## Use Cases Relevant to This Project

### Preventing Raw JSON Leakage in Sidekick Responses

The Sidekick agent returning raw JSON/schema to users is a formatting control problem. Anthropic's recommended fix:

```xml
<output_rules>
Always respond in natural, conversational language. Never include raw JSON,
API responses, tool schemas, or technical data structures in your response
to the user. If you receive structured data from a tool call, summarize it
in plain English. Your response should be composed of smoothly flowing prose
or brief, clear bullet points -- never code blocks or raw data.
</output_rules>
```

Combine with few-shot examples showing the correct transformation from raw data to user-friendly text.

### Consistent Instruction Following Across Models

Since the router uses GPT-4o-mini, campaign creator uses o3, and brick editor uses GPT-5, each system prompt needs model-specific tuning:
- For the GPT-4o-mini router: Keep prompts short and extremely explicit. Mini models follow literal instructions better with less context.
- For the o3 campaign creator: o3 has built-in reasoning; avoid redundant chain-of-thought instructions that add latency.
- For the GPT-5 brick editor: GPT-5 is "agent-ready" with stronger tool use; reduce scaffolding prompts.

### Controlling the "Notes" Behavior

The agent adding unnecessary notes can be fixed with explicit negative instruction plus motivation:

```xml
<response_format>
Respond directly to the user's request. Do not add notes, disclaimers,
caveats, or meta-commentary unless the user explicitly asks for them.
The user is a marketing professional who wants actionable answers,
not commentary about the answer.
</response_format>
```

### Campaign Context Loading

For loading campaign context (templates, brand guidelines, previous campaigns) into prompts:
- Use XML document structure with metadata tags
- Place context above the query
- Use the `<document>` / `<document_content>` / `<source>` pattern Anthropic recommends

## Tradeoffs

| Approach | Pros | Cons |
|----------|------|------|
| **XML tags for structure** | Unambiguous parsing, nesting support, Claude specifically trained on them | Verbose, adds tokens, unfamiliar to some developers |
| **Few-shot examples** | Most reliable format control, works across models | Adds token cost, requires maintenance, examples can become stale |
| **Role prompting** | Quick behavioral shift, minimal tokens | Limited control over specifics, can conflict with tool definitions |
| **Explicit formatting instructions** | Precise control over output | Verbose, can be ignored under pressure (long outputs) |
| **Adaptive thinking** | Better quality on complex tasks, dynamic depth | Higher latency, unpredictable token cost, may overthink simple tasks |
| **Extended thinking with budget** | Predictable token cost | Fixed ceiling may be too low or too high for varying tasks |
| **Structured outputs (strict: true)** | Guaranteed schema conformance | Only works for tool calls, not free-text responses |
| **Effort parameter** | Simple tuning knob for thoroughness | Coarse control, may not match per-task needs |

## Recommended Approach for This Project

Use Anthropic's layered prompt architecture for all Sidekick system prompts:

1. **System prompt structure**: Role definition at top, then behavioral rules in XML sections (`<output_rules>`, `<tool_usage>`, `<response_format>`), then few-shot examples in `<examples>` tags.

2. **Few-shot examples are mandatory**: Include 3-5 examples per specialist agent showing correct behavior -- especially the transformation from raw tool output to user-friendly text. This is the single most effective fix for the JSON leakage problem.

3. **Model-specific tuning**: Since prompts are stored in LangSmith hub, maintain separate prompt versions per model. The GPT-4o-mini router needs shorter, more literal prompts. The o3 campaign creator should avoid redundant reasoning scaffolding. The GPT-5 brick editor should use concise tool descriptions.

4. **Use structured outputs for tool calls**: Enable `strict: true` on all tool schemas to prevent malformed tool inputs.

5. **Explicit output control**: Every system prompt should include a section that says "Never expose raw JSON, schemas, or technical data to the user. Always translate tool results into natural language."

6. **Leverage LangSmith versioning**: Use commit tags (e.g., `production`, `staging`) to manage prompt versions. Test prompt changes against evaluation sets before promoting to production.

## Additional Techniques from the Anthropic Guide

### Prompt Chaining

With adaptive thinking and subagent orchestration, Claude handles most multi-step reasoning internally. However, explicit prompt chaining (breaking a task into sequential API calls) remains useful when you need to inspect intermediate outputs or enforce a specific pipeline structure.

The most common chaining pattern is **self-correction**: generate a draft, have Claude review it against criteria, have Claude refine based on the review. Each step is a separate API call so you can log, evaluate, or branch at any point.

For the Sidekick project, prompt chaining applies to campaign creation: generate campaign structure -> validate against brand guidelines -> refine based on validation results.

### Minimizing Hallucinations

Anthropic provides specific guidance for reducing hallucinations in agentic contexts:

```xml
<investigate_before_answering>
Never speculate about data you have not looked up. If the user references a specific
campaign, brick, or setting, you MUST use a tool to retrieve it before answering.
Make sure to investigate and read relevant data BEFORE answering questions about
campaigns or designs. Never make claims about campaign data before investigating
unless you are certain of the correct answer.
</investigate_before_answering>
```

This is directly relevant to the Sidekick project where the agent must look up campaign and brick data rather than guessing.

### Balancing Autonomy and Safety

Anthropic recommends explicit guidance on which actions require confirmation:

```
Consider the reversibility and impact of your actions. You are encouraged to
take reversible actions like editing brick content or generating previews,
but for actions that are hard to reverse (publishing a campaign, deleting items,
modifying shared templates), ask the user before proceeding.
```

### Reducing Overengineering

Claude Opus 4.5/4.6 tend to overengineer. Anthropic's specific mitigation:

```
Avoid over-engineering. Only make changes that are directly requested or clearly
necessary. Keep solutions simple and focused:
- Scope: Don't add features beyond what was asked.
- Defensive coding: Don't add error handling for impossible scenarios.
- Abstractions: Don't create helpers for one-time operations.
```

### Avoiding Hard-Coded or Test-Passing Solutions

Claude can sometimes focus on making tests pass rather than building general solutions:

```
Implement a solution that works correctly for all valid inputs, not just the test
cases. Do not hard-code values or create solutions that only work for specific
inputs. Focus on understanding the requirements and implementing the correct
logic.
```

### Long Context Prompt Ordering

Anthropic testing shows that placing queries at the END of long-context prompts (after all documents and context) improves response quality by up to 30%. This has direct implications for how campaign context is loaded:

```xml
<campaign_context>
[Brand guidelines, templates, previous campaigns -- potentially 20K+ tokens]
</campaign_context>

<campaign_data>
[Current campaign data -- loaded via tool results]
</campaign_data>

<user_query>
{{USER_REQUEST}}
</user_query>
```

The user query comes LAST, after all context. This ordering is validated by Anthropic's internal testing.

### Prefilled Response Deprecation (Claude 4.6)

Starting with Claude 4.6, prefilled responses on the last assistant turn are no longer supported. This affects common patterns:

- **Format forcing**: Previously used `{"` as a prefill to force JSON output. Now use structured outputs or explicit formatting instructions instead.
- **Preamble elimination**: Previously used `Here is the summary:\n` to skip intros. Now use "Respond directly without preamble" in the system prompt.
- **Continuations**: Previously used partial text as prefill to continue. Now move continuation context to the user message.

This is important for the Sidekick project if any current prompts use prefilled responses -- they will need migration.

### Communication Style Changes in Newer Models

Claude's latest models have a notably different communication style:
- **More direct and grounded**: Provides fact-based progress rather than self-celebratory updates
- **More conversational**: Less machine-like tone
- **Less verbose**: May skip summaries after tool calls

If the Sidekick prompts were written for older Claude models, they may need adjustment. What worked as anti-laziness prompts before may now cause overtriggering.

### Structured Outputs vs JSON Mode

Anthropic now supports guaranteed schema validation via `strict: true`:

```python
tools=[{
    "name": "format_campaign_response",
    "description": "Format a campaign response for the user",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "items_count": {"type": "integer"},
            "status": {"type": "string", "enum": ["draft", "active", "paused"]},
            "next_action": {"type": "string"}
        },
        "required": ["summary", "items_count", "status"]
    },
    "strict": true
}]
```

This eliminates an entire class of formatting bugs. For the Sidekick project, structured outputs can enforce that the agent always returns responses in a predictable format, which downstream UI code can reliably parse.

## Sources

- Anthropic Prompt Engineering Overview: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/overview
- Anthropic Prompting Best Practices (Claude 4.x): https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices
- Anthropic System Prompts Documentation: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/system-prompts
- Anthropic Interactive Prompt Engineering Tutorial: https://github.com/anthropics/prompt-eng-interactive-tutorial
- Anthropic 6 Techniques for Effective Prompt Engineering (PDF): https://www-cdn.anthropic.com/62df988c101af71291b06843b63d39bbd600bed8.pdf
- Anthropic Courses (Prompt Engineering): https://github.com/anthropics/courses
- Building Effective Agents (Anthropic Research): https://www.anthropic.com/research/building-effective-agents
- Anthropic Claude Cookbooks (GitHub): https://github.com/anthropics/claude-cookbooks
- Claude Claude Cookbook (Official): https://platform.claude.com/cookbook/
- Writing Tools for Agents (Anthropic Engineering): https://www.anthropic.com/engineering/writing-tools-for-agents
- Advanced Tool Use (Anthropic Engineering): https://www.anthropic.com/engineering/advanced-tool-use
- Anthropic Models Overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Choosing the Right Model: https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- LangSmith Prompt Management: https://docs.langchain.com/langsmith/manage-prompts
- Review of Anthropic's Prompt Engineering Guide: https://scalablehuman.com/2025/07/02/review-anthropics-prompt-engineering-guide/
- Prompt Engineering on Amazon Bedrock: https://aws.amazon.com/blogs/machine-learning/prompt-engineering-techniques-and-best-practices-learn-by-doing-with-anthropics-claude-3-on-amazon-bedrock/
