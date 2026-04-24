# Model Differences: Opus vs Sonnet vs Haiku and GPT-4o-mini vs GPT-4 vs o3 vs GPT-5

## Summary

Different LLM models behave differently on the same prompt -- what works for GPT-4o-mini as a router may fail on o3 as a campaign creator, and what works on GPT-5 for brick editing may produce unwanted behavior on a smaller model. This matters critically to the Sidekick project because it uses three different OpenAI models (GPT-4o-mini for routing, o3 for campaign creation, GPT-5 for brick editing) and each requires model-specific prompt tuning to get consistent instruction following, prevent data leakage, and control output format.

## Key Concepts

- **Instruction following fidelity**: How literally a model follows explicit instructions. Smaller models follow more literally but miss nuance; larger models infer more but may deviate.
- **Reasoning depth**: The degree of multi-step logical processing a model applies. Reasoning models (o3, o4-mini) have built-in chain-of-thought; non-reasoning models (GPT-4o, GPT-4.1) need it prompted.
- **Tool use reliability**: How consistently a model selects the right tool, passes correct parameters, and handles tool results. Varies dramatically between model families.
- **Verbosity and output control**: Larger models tend to be more verbose. Claude Opus produces longer, more detailed outputs than Haiku. GPT-5 is more verbose than GPT-4o-mini.
- **Latency-quality tradeoff**: Bigger models are slower but more capable. The right model depends on the task's tolerance for latency.
- **Overtriggering vs undertriggering**: Newer, more capable models may overuse tools or over-reason when given prompts designed for weaker models.
- **Effort parameter (Claude)**: Anthropic's tuning knob for thinking depth (low/medium/high/max), replacing manual budget_tokens.

## How It Works

### Claude Model Family (Anthropic)

#### Claude Opus 4.6

The most intelligent Claude model. Best for:
- Complex reasoning tasks and architectural decisions
- Advanced coding and multi-step debugging
- Long-horizon agentic workflows (multi-hour research, large-scale migrations)
- Extended autonomous work across multiple context windows

Key behavioral traits:
- **Tends to overthink**: Does significantly more upfront exploration, especially at higher effort settings. Can inflate thinking tokens and slow responses.
- **Overengineers solutions**: Tendency to create extra files, add unnecessary abstractions, build in unrequested flexibility.
- **Strong subagent predilection**: May spawn subagents when simpler direct approaches suffice.
- **Highly responsive to system prompt**: Prompts designed to reduce undertriggering on previous models may now cause overtriggering.
- **Adaptive thinking by default**: Dynamically decides when and how much to reason.

Prompting adjustments for Opus 4.6:
- Replace "CRITICAL: You MUST use this tool" with "Use this tool when..."
- Add constraints: "Choose an approach and commit to it. Avoid revisiting decisions unless you encounter contradicting information."
- Use `effort` parameter instead of prompt-based thoroughness control.

#### Claude Sonnet 4.6

Balanced capability and efficiency. Best for:
- Code generation, data analysis, content creation
- Agentic tool use with moderate complexity
- Daily development work (80-90% of tasks)
- Visual understanding

Key behavioral traits:
- **Defaults to high effort**: May produce higher latency than expected if effort is not explicitly set.
- **Strong instruction following**: Handles structured reasoning and multi-step logic well.
- **Good balance**: Faster than Opus with strong reasoning depth.

Recommended settings:
- Medium effort for most applications
- Low effort for high-volume or latency-sensitive workloads
- 64k max output tokens at medium/high effort to give room for thinking

#### Claude Haiku 4.5

Speed and cost optimized. Best for:
- Real-time applications and high-volume processing
- Simple classification, routing, content moderation
- Sub-agent tasks where speed matters more than depth
- Customer service automation

Key behavioral traits:
- **Fast but shallow**: 4-5x faster than Sonnet at a fraction of the cost.
- **Literal instruction following**: Less inference, more direct execution.
- **May miss nuance**: Works best with well-defined tasks and clear solution spaces.

### OpenAI Model Family

#### GPT-4o-mini (Used for Router)

The smallest, fastest model in the project. Key characteristics:
- **Cost-efficient**: Significantly cheaper than GPT-4o.
- **Fast response time**: Suitable for routing decisions that need low latency.
- **More literal instruction following**: Follows explicit instructions well but may miss implied intent.
- **Weaker at complex reasoning**: Not suitable for multi-step logical chains.
- **Limited context**: Less effective at utilizing long context windows compared to larger models.

Prompting implications for the Sidekick router:
- Keep system prompts short and extremely explicit.
- Use concrete routing rules, not fuzzy heuristics.
- Provide explicit classification categories with clear boundaries.
- Do not assume the model will infer intent from ambiguous user messages.

#### GPT-4o (Reference Model)

Mid-tier general-purpose model. Key characteristics:
- **Strong all-around**: Good at coding, analysis, and content tasks.
- **Recommended for tool-heavy workflows**: Still the best for many function calling scenarios according to OpenAI.
- **Good instruction following**: Better than mini at handling nuanced instructions.

#### GPT-4.1 (Current Generation Non-Reasoning)

OpenAI's latest non-reasoning model. Key characteristics:
- **Dramatically improved instruction following**: 10.5% improvement over GPT-4o on Scale's MultiChallenge benchmark.
- **More literal than GPT-4o**: Follows instructions more closely but infers less. A single clarifying sentence is usually sufficient.
- **Better at long context**: 1M token context window with improved comprehension.
- **Instruction placement matters**: Place instructions at both beginning and end of context for best results.
- **Markdown is the best delimiter format**: Ranked above XML and JSON for GPT-4.1.

Prompting implications:
- Instructions closer to the end of the prompt are prioritized.
- Avoid "Always call a tool before responding" -- can trigger hallucinated tool inputs. Add "if you don't have enough information, ask the user."
- Use the `tools` field in the API rather than manually injecting tool descriptions into prompts (showed 2% benchmark improvement).

#### o3 (Used for Campaign Creator)

OpenAI's most powerful reasoning model. Key characteristics:
- **Built-in chain-of-thought**: Has internal reasoning; do not add redundant CoT prompting.
- **Excels at complex multi-step tasks**: Coding, math, science, visual perception.
- **Multi-step tool chains**: Better at coordinating sequences of tool calls.
- **SOTA on coding benchmarks**: Codeforces, SWE-bench, MMMU.
- **Higher latency**: Reasoning adds processing time.

Prompting implications for the Sidekick campaign creator:
- Do NOT add "think step by step" or chain-of-thought instructions -- o3 already does this internally. Redundant CoT prompting adds latency without quality gain.
- Focus prompts on WHAT to do, not HOW to reason about it.
- Use explicit tool schemas and let o3's reasoning figure out the workflow.
- Be explicit about output format since o3 may be verbose in its reasoning.

#### GPT-5 (Used for Brick Editor)

OpenAI's latest flagship model. Key characteristics:
- **Most "agent-ready" OpenAI model**: Fewer dead-ends, better error recovery when tools fail.
- **Requires fewer tool calls**: More efficient at multi-step tool chains than previous models.
- **Lower hallucination rate**: ~45% fewer factual errors than GPT-4o with web search enabled.
- **New developer controls**: Supports `verbosity` and `reasoning_effort` parameters.
- **Better at recovering from errors**: Self-corrects more reliably when tool calls fail.

Prompting implications for the Sidekick brick editor:
- Reduce scaffolding prompts -- GPT-5 handles multi-step workflows more naturally.
- Rely on structured tool schemas rather than verbose tool descriptions.
- Be explicit about what NOT to include in user-facing responses (prevent JSON leakage).
- Use the `verbosity` parameter rather than prompt-based verbosity control.

### Cross-Model Instruction Following Comparison

| Behavior | GPT-4o-mini | GPT-4o/4.1 | o3 | GPT-5 | Haiku 4.5 | Sonnet 4.6 | Opus 4.6 |
|----------|-------------|-------------|-----|-------|-----------|------------|----------|
| Literal instruction following | High | High (4.1 highest) | Medium (reasons around instructions) | High | High | High | Medium (may infer beyond instructions) |
| Tool use reliability | Moderate | High | High (with reasoning) | Highest | Moderate | High | High |
| Hallucination risk | Higher | Moderate | Lower | Lowest | Higher | Moderate | Lower |
| Verbosity | Low | Medium | High (reasoning tokens) | Medium-High | Low | Medium | High |
| Multi-step reasoning | Weak | Moderate | Strong (built-in) | Strong | Weak | Moderate | Strong (adaptive thinking) |
| Latency | Fastest | Medium | Slow | Medium | Fastest | Medium | Slowest |
| Cost | Cheapest | Medium | Expensive | Expensive | Cheapest | Medium | Most expensive |

## Use Cases Relevant to This Project

### Router Model (GPT-4o-mini) -- Instruction Following Issues

The router's job is classification: determine which specialist to route to. GPT-4o-mini may:
- Misclassify ambiguous requests because it does not deeply reason about intent.
- Route incorrectly when user messages are vague or multi-intent.

Fix: Use explicit routing rules with concrete keyword patterns and examples:
```
<routing_rules>
Route to CAMPAIGN_CREATOR when the user wants to:
- Create a new campaign
- Set up campaign parameters (name, dates, audience)
- Generate campaign variations

Route to BRICK_EDITOR when the user wants to:
- Edit existing items (headlines, images, CTAs)
- Modify layout or design
- Change colors, fonts, or styling

Route to GENERAL when:
- The user asks a question about their account
- The user needs help understanding a feature
- The request does not clearly match CAMPAIGN_CREATOR or BRICK_EDITOR
</routing_rules>
```

### Campaign Creator (o3) -- Redundant Reasoning

o3 has built-in reasoning. System prompts that include "think step by step" or "reason carefully before acting" add latency without benefit. The campaign creator prompt should:
- Focus on WHAT the output should look like (campaign structure, required fields, validation rules)
- NOT tell o3 HOW to reason
- Include explicit output format requirements to prevent verbose reasoning from bleeding into user responses

### Brick Editor (GPT-5) -- JSON Leakage and Notes

GPT-5 is the most capable model but may still expose technical data if not explicitly told not to. The brick editor works with structured brick data (JSON schemas, layout configs). The system prompt must:
- Explicitly prohibit returning raw JSON/schema to users
- Include examples of transforming technical data into natural language
- Specify when notes are appropriate (almost never for end-user responses)

### Inconsistent Behavior Across Models

Since prompts are stored in LangSmith hub and each specialist uses a different model, a prompt that works on one model may fail on another. The fix:
- Maintain model-specific prompt variants in LangSmith with tags like `router-gpt4omini`, `creator-o3`, `editor-gpt5`
- Test each prompt against its target model's specific behaviors
- Use LangSmith evaluation to catch cross-model regressions

## Tradeoffs

| Factor | Use Smaller Model (mini/Haiku) | Use Mid-Tier (4o/Sonnet) | Use Top-Tier (o3/Opus/GPT-5) |
|--------|-------------------------------|--------------------------|-------------------------------|
| **Latency** | Best (fastest) | Moderate | Worst (slowest) |
| **Cost** | Best (cheapest) | Moderate | Worst (most expensive) |
| **Instruction following** | Literal but shallow | Balanced | Deep but may over-interpret |
| **Tool use** | May need more scaffolding | Reliable with good schemas | Most reliable, may overtrigger |
| **Complex reasoning** | Poor | Adequate | Excellent |
| **Hallucination** | Higher risk | Moderate risk | Lowest risk |
| **Prompt sensitivity** | High (small changes = big impact) | Moderate | Lower (more robust to variation) |
| **When to use** | Routing, classification, simple transforms | Daily workflows, standard agent tasks | Complex multi-step, architecture, hard problems |

### Reasoning Models vs Non-Reasoning Models

| Factor | Non-Reasoning (GPT-4o, GPT-4.1, Sonnet) | Reasoning (o3, o4-mini, Opus with adaptive thinking) |
|--------|------------------------------------------|------------------------------------------------------|
| **Chain-of-thought** | Must be prompted explicitly | Built-in; prompting it adds latency without gain |
| **Multi-step tool chains** | Needs scaffolding | Handles naturally |
| **Output predictability** | More predictable | May include reasoning artifacts |
| **Latency** | Faster | Slower (reasoning overhead) |
| **When to avoid CoT prompts** | Never -- they usually help | Always -- they are redundant |
| **Cost per query** | Lower | Higher (reasoning tokens) |

## Recommended Approach for This Project

1. **Router (GPT-4o-mini)**: Use the simplest, most explicit prompt possible. Concrete routing rules with keyword examples. No reasoning scaffolding. Keep the system prompt under 500 tokens. Use enum-based classification (route to one of N categories). Test with ambiguous edge cases.

2. **Campaign Creator (o3)**: Remove all "think step by step" and chain-of-thought instructions. Focus the prompt on output schema, business rules, and validation constraints. Use structured outputs to enforce campaign data format. Let o3's built-in reasoning handle the how.

3. **Brick Editor (GPT-5)**: Include explicit output control section prohibiting raw JSON/schema in responses. Add 3-5 few-shot examples showing correct transformation from brick data to natural language. Use the `verbosity` parameter if available. Explicitly prohibit unnecessary notes and meta-commentary.

4. **LangSmith Prompt Versioning**: Maintain separate prompt commits tagged per model. When changing a shared behavior (like "never expose JSON"), update all three prompts and test each against its target model. Use LangSmith evaluation hooks to validate outputs after prompt changes.

5. **Model-Specific Testing**: Build an evaluation set for each model that tests: (a) correct instruction following, (b) absence of JSON leakage, (c) absence of unnecessary notes, (d) correct tool use, (e) appropriate verbosity. Run this evaluation on every prompt change.

## Detailed Prompt Tuning Per Model

### GPT-4o-mini Router: Specific Prompt Patterns

The router's system prompt should be minimal. Here is a recommended structure:

```
You are a request classifier for a campaign design tool. Your ONLY job is to
determine which specialist agent should handle the user's request.

Classify every request into exactly one category:
- CAMPAIGN_CREATOR: Requests to create new campaigns, set up campaign parameters,
  generate campaign variations, or configure campaign settings.
- BRICK_EDITOR: Requests to edit existing items (change headlines, images, CTAs,
  colors, fonts, layout, styling).
- GENERAL: Questions about the tool, account, features, or anything that does not
  clearly fit the above categories.

Respond with ONLY the category name. No explanation.
```

Key principle: GPT-4o-mini performs best with extremely constrained output spaces. Use enum-based tools or classification-only prompts. Do not ask it to reason or explain.

### o3 Campaign Creator: Specific Prompt Patterns

o3's internal reasoning means the system prompt should focus on WHAT, not HOW:

```
You are a campaign creation specialist for a marketing design tool.

When creating a campaign:
1. Gather required information: campaign name, target audience, date range, brand
2. Load brand guidelines and available templates using the campaign_load_context tool
3. Create the campaign structure using the campaign_create tool
4. Validate the campaign against brand guidelines using the campaign_validate tool

Output rules:
- Never show raw JSON, schemas, or technical data to the user
- Respond in conversational language
- After completing an action, briefly confirm what was done
- Do not add notes or disclaimers
```

Notice: No "think step by step" instruction. No chain-of-thought scaffolding. o3 handles reasoning internally. The prompt is purely declarative.

### GPT-5 Brick Editor: Specific Prompt Patterns

GPT-5 benefits from explicit output control but less scaffolding:

```
You are a design editing assistant for a marketing campaign tool. You help users
modify campaign items (bricks) including headlines, images, CTAs, layouts, and styling.

Tool usage:
- Use brick_get_details to look up current item properties before making changes
- Use brick_update to apply changes
- Use brick_preview to show the user what changes look like

Output rules:
- Always confirm changes in plain language: "Done. I updated [what] to [new value]."
- Never include raw JSON, schemas, or technical data in your response
- Do not add notes, caveats, or suggestions unless the user asks for them
- If the user's request is ambiguous, ask one clarifying question

<examples>
[3-5 examples as described in the few-shot section]
</examples>
```

### Prompt Length Guidelines Per Model

| Model | Recommended System Prompt Length | Reason |
|-------|--------------------------------|--------|
| GPT-4o-mini | 200-500 tokens | Small context, literal following, keep it focused |
| o3 | 500-1000 tokens | Internal reasoning handles complexity; prompt is declarative |
| GPT-5 | 800-1500 tokens | Can handle longer prompts well; include few-shot examples |
| Haiku 4.5 | 200-500 tokens | Speed-optimized; shorter prompts reduce latency |
| Sonnet 4.6 | 500-1500 tokens | Balanced; include structure and examples |
| Opus 4.6 | 1000-2000 tokens | Handles long prompts well; needs explicit constraint instructions |

### Delimiter Format by Model Family

OpenAI GPT-4.1 Prompting Guide ranks delimiter formats for GPT models:
1. **Markdown** (recommended starting point) -- clear hierarchy with H1-H4 titles
2. **XML** -- improved adherence; convenient nesting and metadata attributes
3. **JSON** -- performs poorly; verbose with escaping overhead

Anthropic Claude models are specifically trained on XML tags and respond best to them.

Recommendation for the Sidekick project:
- OpenAI models (router, campaign creator, brick editor): Use Markdown headers for top-level structure, XML tags for data boundaries and examples
- If considering Claude models for any agent: Use XML tags throughout

### Context Window and Token Budget Considerations

| Model | Max Context | Effective Usage Notes |
|-------|-------------|---------------------|
| GPT-4o-mini | 128K tokens | Keep total context (system + history + tools) under 32K for best results |
| GPT-4.1 | 1M tokens | Strong long-context performance but degrades with complex cross-document reasoning |
| o3 | 200K tokens | Reasoning tokens count against this; budget 30-50% for reasoning overhead |
| GPT-5 | 1M tokens | Requires fewer tool calls, so effective context usage is higher |
| Haiku 4.5 | 200K tokens | Fast but shallow; keep context lean |
| Sonnet 4.6 | 200K (1M with beta header) | Good balance; 64K max output tokens recommended at medium+ effort |
| Opus 4.6 | 200K (1M with beta header) | Best at utilizing full context; may use more thinking tokens |

### How Models Handle Conflicting Instructions

When the system prompt says one thing and the user says another:

- **Claude models**: System prompt has strong weight, but user messages are also strongly weighted. Explicit XML-tagged instructions in the system prompt are most reliable. Claude 4.6 is particularly responsive to system prompts.
- **GPT-4.1**: Instructions closer to the end of the prompt take priority. Place critical rules both at the start and end of the system prompt.
- **o3**: May reason around instructions if it determines a "better" approach. Use very explicit, unambiguous language. Avoid instructions that o3 might interpret as guidelines rather than hard rules.
- **GPT-5**: Strong instruction following. Handles competing instructions by defaulting to the most explicit one.

### Tool Description Optimization Per Model

How each model handles tool descriptions differently:

**GPT-4o-mini**: Needs SHORT, CLEAR descriptions. Avoid long explanatory text. Use enums aggressively to constrain choices.

**o3**: Can handle longer descriptions. Benefits from descriptions that explain WHY the tool exists, not just what it does (the reasoning model uses this context for planning).

**GPT-5**: Best at inferring tool usage from minimal descriptions. Can handle ambiguous situations. But explicit descriptions still prevent edge case failures.

**Claude models**: Anthropic found that "developers spent more time optimizing tools than overall prompts" -- tool descriptions are the highest-leverage optimization surface. Claude is especially sensitive to parameter naming; prefer semantic names over UUIDs.

### Practical Model Selection for Future Sidekick Changes

If the project considers changing models:
- **Replacing GPT-4o-mini router with Haiku 4.5**: Comparable speed, potentially better classification. Test with the same evaluation set.
- **Replacing o3 with Opus 4.6**: Better for very long-horizon campaign creation. Higher cost. Requires different prompt style (XML tags instead of markdown).
- **Replacing GPT-5 with Sonnet 4.6**: Cost reduction. May need more explicit tool scaffolding. Test JSON leakage carefully.
- **Cross-vendor migration**: Moving from OpenAI to Claude (or vice versa) requires rewriting prompts, not just swapping model names. Delimiter preferences, instruction priority, and tool calling conventions all differ.

## Sources

- Anthropic Models Overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Choosing the Right Claude Model: https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- Anthropic Prompting Best Practices (Claude 4.x): https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices
- Claude AI Models 2025 Guide (DEV Community): https://dev.to/dr_hernani_costa/claude-ai-models-2025-opus-vs-sonnet-vs-haiku-guide-24mn
- Claude AI Models 2025 (First AI Movers): https://www.firstaimovers.com/p/claude-ai-models-opus-sonnet-haiku-2025
- Which Claude Model Is Best for Coding: https://www.dataannotation.tech/developers/which-claude-model-is-best-for-coding
- Sonnet 4.5 vs Haiku 4.5 vs Opus 4.1 Comparison: https://medium.com/@ayaanhaider.dev/sonnet-4-5-vs-haiku-4-5-vs-opus-4-1-which-claude-model-actually-works-best-in-real-projects-7183c0dc2249
- Anthropic Claude Models Complete Guide (CodeGPT): https://www.codegpt.co/blog/anthropic-claude-models-complete-guide
- Claude Opus vs Sonnet vs Haiku Testing: https://dextralabs.com/blog/claude-opus-vs-sonnet-vs-haiku/
- Introducing Claude 3 Family: https://www.anthropic.com/news/claude-3-family
- Claude AI All Models Late 2025: https://www.datastudios.org/post/claude-ai-all-models-available-differences-and-use-cases-in-late-2025
- OpenAI Introducing o3 and o4-mini: https://openai.com/index/introducing-o3-and-o4-mini/
- OpenAI Model Selection Guide (Cookbook): https://cookbook.openai.com/examples/partners/model_selection_guide/model_selection_guide
- OpenAI Models API Reference: https://developers.openai.com/api/docs/models
- Introducing GPT-4.1: https://openai.com/index/gpt-4-1/
- GPT-4.1 Prompting Guide (OpenAI Cookbook): https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide
- Introducing GPT-5: https://openai.com/index/introducing-gpt-5/
- GPT-5 vs GPT-4o Comparison: https://medium.com/@leucopsis/how-gpt-5-compares-to-gpt-4o-b493d1b8812b
- GPT-5 Benchmarks: https://www.vellum.ai/blog/gpt-5-benchmarks
- GPT-5 vs o3 vs 4o Benchmarks: https://www.getpassionfruit.com/blog/chatgpt-5-vs-gpt-5-pro-vs-gpt-4o-vs-o3-performance-benchmark-comparison-recommendation-of-openai-s-2025-models
- GPT-5 vs GPT-4o vs o3 Comparison: https://www.creolestudios.com/gpt5-vs-gpt4o-vs-o3-model-comparison/
- OpenAI o3/o4-mini System Card: https://cdn.openai.com/pdf/2221c875-02dc-4789-800b-e7758f3722c1/o3-and-o4-mini-system-card.pdf
- OpenAI GPT Models Differences (ScrumLaunch): https://www.scrumlaunch.com/blog/openai-gpt-models-differences
