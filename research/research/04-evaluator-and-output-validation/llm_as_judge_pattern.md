# LLM-as-Judge Pattern

## Summary

The LLM-as-Judge pattern uses a large language model to assess the outputs of another LLM (or itself), scoring responses against defined criteria as a scalable substitute for human assessment. For the Sidekick agent, this pattern is directly applicable: an assessor LLM can check whether the agent's response contains raw JSON/schema data that should not be shown to users, whether brick edits reference valid field names, and whether the response is coherent and helpful. The foundational paper is "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena" by Zheng et al. (2023), published at NeurIPS 2023 Datasets and Benchmarks Track.

## Key Concepts

- **LLM-as-Judge**: Using a strong LLM (e.g., GPT-4, Claude) to assess the output of another model or agent, producing a score and/or reasoning.
- **MT-Bench**: A multi-turn benchmark of 80 questions across 8 categories (writing, roleplay, reasoning, math, coding, extraction, STEM, humanities) introduced alongside the LLM-as-Judge concept.
- **Chatbot Arena**: A crowdsourced platform where users compare model outputs in blind pairwise battles, producing human preference data at scale.
- **Position Bias**: The tendency of LLM judges to favor the response presented first (or second) in a pairwise comparison, regardless of quality.
- **Verbosity Bias**: The tendency of LLM judges to prefer longer, more detailed responses even when shorter answers are equally correct.
- **Self-Enhancement Bias**: The tendency of an LLM judge to favor outputs produced by itself or similar models.
- **Single Answer Grading**: The judge assesses a single response in isolation, producing an absolute score.
- **Pairwise Comparison**: The judge compares two responses and selects the better one.
- **Reference-Guided Grading**: The judge is given a reference answer (ground truth) to compare against.
- **Few-Shot Calibration**: Including labeled examples in the judge prompt to align its scoring with human expectations.
- **Critique Shadowing**: An iterative process where a domain expert and an LLM judge assess the same examples, comparing scores until they converge (from Hamel Husain's practical guide).

## How It Works

### The Original Research (Zheng et al. 2023)

The paper systematically studied using GPT-4 as a judge for assessing chat assistants. The key findings:

1. **Agreement with humans**: Strong LLM judges like GPT-4 achieve over 80% agreement with human preferences -- the same level of agreement that humans have with each other.

2. **Three assessment modes tested**:
   - **Pairwise comparison**: Present two model responses, ask which is better. Most reliable for comparing models.
   - **Single answer grading**: Rate one response on a 1-10 scale. More scalable but less reliable.
   - **Reference-guided grading**: Provide a reference answer for the judge to compare against. Most accurate for factual questions.

3. **Bias mitigation strategies**:
   - Swap position of answers and check consistency to detect position bias.
   - Provide chain-of-thought reasoning before the final score.
   - Use few-shot examples to calibrate scoring.

4. **The implementation** is publicly available at https://github.com/lm-sys/FastChat/tree/main/fastchat/llm_judge

### Implementation Step-by-Step

#### Step 1: Define What You Are Assessing

Choose the specific quality dimension(s) to assess. Each assessor should focus on a single aspect:

- **Technical data leakage**: Does the response contain raw JSON, schema objects, or internal field names?
- **Edit correctness**: Do the proposed brick edits use valid field names and values?
- **Helpfulness**: Is the response useful and actionable for a marketing user?
- **Tone**: Is the response appropriate for a non-technical marketing audience?

#### Step 2: Choose an Assessment Mode

For the Sidekick use case:

```
Single Answer Grading (binary pass/fail):
  - Best for: inline checks before sending response to user
  - Latency: 1 LLM call
  - Example: "Does this response contain raw JSON? Yes/No"

Pairwise Comparison:
  - Best for: offline A/B testing of prompt versions
  - Latency: 1 LLM call per pair
  - Example: "Which response better explains the brick edit?"

Reference-Guided:
  - Best for: offline regression testing with golden answers
  - Latency: 1 LLM call
  - Example: "Compare this response to the reference answer for accuracy"
```

#### Step 3: Write the Assessment Prompt

The assessment prompt is the most critical component. Key principles from practitioners:

**From Hamel Husain's guide** (https://hamel.dev/blog/posts/llm-judge/):
- Use binary pass/fail judgments initially -- they force clarity about what success means.
- Include 3+ diverse few-shot examples with detailed critiques showing reasoning.
- Provide full context: include the system prompt, user message, available tools, and the agent's response.
- Write critiques so detailed that "a new employee could understand it."

**From Evidently AI's guide** (https://www.evidentlyai.com/llm-guide/llm-as-a-judge):
- Split complex criteria into separate assessors (do not combine "helpful" and "safe" in one prompt).
- Request step-by-step reasoning before the final verdict.
- Set temperature to 0-0.1 for deterministic outputs.
- Request structured output (JSON) for easier parsing.

Example assessment prompt for technical data leakage detection:

```
You are assessing a response from an AI assistant in a marketing campaign
designer tool. The assistant helps users edit campaign bricks (design elements).

Your task: Determine if the response contains technical data that should NOT
be shown to a marketing user.

Technical data includes:
- Raw JSON objects or arrays (e.g., {"key": "value"})
- Database field names or internal identifiers (e.g., _id, objectId, brickType)
- MongoDB query syntax or operators (e.g., $set, $push, $match)
- Schema definitions or type annotations
- Internal API paths or endpoint URLs
- Stack traces or error objects

The response PASSES if it communicates naturally without exposing internal
technical details.
The response FAILS if it contains any of the above technical data.

## Examples

### Example 1 (PASS)
User: "Change the headline text to Summer Sale"
Response: "I've updated the headline text to 'Summer Sale'. The change has been
applied to your brick."
Reasoning: The response communicates the action naturally without exposing any
internal field names or JSON structures.
Verdict: PASS

### Example 2 (FAIL)
User: "Change the headline text to Summer Sale"
Response: "I've updated the brick. Here is what changed:
{"brickId": "abc123", "fields": {"headline.text": "Summer Sale"}}"
Reasoning: The response contains a raw JSON object with internal field names
like brickId and the dot-notation path headline.text. This technical data
should not be shown to a marketing user.
Verdict: FAIL

### Example 3 (FAIL)
User: "What colors are available?"
Response: "Based on the schema, the colorPalette field accepts an array of
hex values stored in the brandColors.primary collection."
Reasoning: References internal field names (colorPalette, brandColors.primary)
and uses technical terms (schema, collection) that expose the data model.
Verdict: FAIL

## Now assess this response:

User: {user_message}
Response: {agent_response}

First explain your reasoning step by step, then provide your verdict.
Output as JSON: {"reasoning": "...", "verdict": "PASS" or "FAIL"}
```

#### Step 4: Implement the Assessor

Using LangChain's OpenEvals library:

```python
from openevals.llm import create_llm_as_judge

# Technical data leakage assessor
technical_leakage_assessor = create_llm_as_judge(
    prompt=TECHNICAL_LEAKAGE_PROMPT,  # the prompt template above
    feedback_key="technical_data_leakage",
    model="openai:gpt-4o-mini",  # use a fast model for inline checks
)

# Run assessment
result = technical_leakage_assessor(
    inputs=user_message,
    outputs=agent_response,
)
# result = {"key": "technical_data_leakage", "score": True/False, "comment": "..."}
```

Using a custom assessor function for LangSmith:

```python
from langsmith.schemas import Run, Example
import re

def technical_leakage_assessor(run: Run, example: Example = None) -> dict:
    """Check if agent response contains technical data."""
    response = run.outputs.get("response", "")

    # Quick regex pre-check (fast, no LLM call needed)
    json_pattern = r'\{["\']?\w+["\']?\s*:'
    if re.search(json_pattern, response):
        return {"key": "technical_leakage", "score": 0, "comment": "Contains JSON-like data"}

    # If no obvious pattern, use LLM judge for nuanced check
    # ... LLM call here ...
    return {"key": "technical_leakage", "score": 1, "comment": "Clean response"}
```

#### Step 5: Validate the Judge Against Human Labels

The most critical and often-skipped step. From Hamel Husain's guide:

1. Have a domain expert label 50-200 diverse examples as pass/fail with detailed critiques.
2. Run the LLM judge on the same examples.
3. Calculate precision and recall separately (not just raw accuracy, especially with imbalanced data).
4. Iterate on the prompt until you achieve >90% alignment with the expert.
5. Test on held-out data to avoid overfitting the prompt to your calibration set.

```python
# Calibration loop pseudocode
expert_labels = load_expert_labels()  # 100 labeled examples
judge_predictions = [assessor(ex) for ex in expert_labels]

precision = calculate_precision(expert_labels, judge_predictions)
recall = calculate_recall(expert_labels, judge_predictions)

print(f"Precision: {precision}, Recall: {recall}")
# Target: both > 0.90
```

#### Step 6: Deploy and Monitor

- **Inline (blocking)**: Run the assessor before sending the response to the user. Adds latency but catches issues in real time.
- **Async (non-blocking)**: Log the response, run assessment in the background, alert on failures. No latency impact.
- **Hybrid**: Run cheap regex checks inline, run LLM judge asynchronously.

### Using LangSmith's Built-in LLM-as-Judge

LangSmith now supports configuring LLM-as-judge assessors directly in the UI:

1. Navigate to your dataset or tracing project.
2. Click "+ Evaluator" to create a new assessor.
3. Choose a prebuilt template (hallucination, correctness, conciseness) or create custom.
4. Configure the prompt, map variables to input/output fields.
5. Set scoring type: Boolean (pass/fail), Categorical (good/bad/neutral), or Continuous (0-1 float).
6. For online assessment, set up Rule Automations to run the assessor automatically on production traces with configurable sampling rates.

LangSmith also supports "Align Evals" -- when a human corrects an LLM judge's score, that correction is stored as a few-shot example, improving the judge over time without manual prompt engineering.

### Using OpenEvals (LangChain's Open-Source Library)

OpenEvals provides ready-made assessors:

```python
# Install
# pip install openevals

from openevals.llm import create_llm_as_judge
from openevals.prompts import HALLUCINATION_PROMPT, CORRECTNESS_PROMPT

# Hallucination check
hallucination_checker = create_llm_as_judge(
    prompt=HALLUCINATION_PROMPT,
    feedback_key="hallucination",
    model="openai:gpt-4o-mini",
)

# Correctness check (requires reference output)
correctness_checker = create_llm_as_judge(
    prompt=CORRECTNESS_PROMPT,
    feedback_key="correctness",
    model="openai:gpt-4o-mini",
)

# Custom assessor with your own prompt
custom_checker = create_llm_as_judge(
    prompt="Assess whether the response uses valid brick field names...\n\nInput: {inputs}\nOutput: {outputs}\nContext: {context}",
    feedback_key="field_validity",
    model="openai:gpt-4o-mini",
)
```

Available built-in prompts in OpenEvals:
- `CONCISENESS_PROMPT`: Assesses output brevity and efficiency
- `CORRECTNESS_PROMPT`: Assesses accuracy with optional reference outputs
- `HALLUCINATION_PROMPT`: Detects fabricated information against provided context
- `TOXICITY_PROMPT`: Identifies harmful or offensive language

### Using AgentEvals for Trajectory Assessment

For assessing the agent's tool call sequences (not just final output):

```python
# pip install agentevals

from agentevals.trajectory import create_trajectory_llm_as_judge

trajectory_checker = create_trajectory_llm_as_judge(model="openai:gpt-4o-mini")

result = trajectory_checker(
    inputs="Change the headline to Summer Sale",
    outputs=final_response,
    trajectory=[
        {"role": "assistant", "tool_calls": [{"name": "get_brick", "args": {"id": "abc"}}]},
        {"role": "tool", "content": "...brick data..."},
        {"role": "assistant", "tool_calls": [{"name": "update_brick", "args": {"field": "headline.text", "value": "Summer Sale"}}]},
        {"role": "tool", "content": "...success..."},
    ]
)
```

## Use Cases Relevant to This Project

### 1. Technical Data Leakage Detection
The Sidekick agent sometimes returns raw JSON/schema objects to users. An LLM judge can assess each response for technical data before it reaches the user. This is the highest-priority use case.

**Assessment criteria**: Does the response contain JSON objects, internal field names, database identifiers, schema definitions, or API paths?

### 2. Brick Edit Validation
The agent sometimes makes incorrect brick edits with wrong field names. An LLM judge (with the brick schema as context) can verify that proposed edits reference valid fields.

**Assessment criteria**: Given the brick schema, are all referenced field names valid? Are the proposed values of the correct type?

### 3. Response Quality Scoring
For async monitoring, score all agent responses on helpfulness, clarity, and tone appropriateness for a marketing audience.

**Assessment criteria**: Is the response helpful? Does it use language appropriate for non-technical marketing users? Is it concise?

### 4. Hallucination Detection
The agent might claim it made changes it did not actually make, or describe capabilities that do not exist.

**Assessment criteria**: Given the tool call results, does the agent's response accurately reflect what actually happened?

### 5. Offline Prompt Iteration
When updating the Sidekick system prompt, use pairwise comparison to determine which version produces better responses across a test dataset.

**Assessment criteria**: Which response is more helpful, accurate, and user-friendly?

## Tradeoffs

| Approach | Latency | Cost | Accuracy | Best For |
|----------|---------|------|----------|----------|
| **Single answer grading (binary)** | 0.5-2s per check | Low (1 LLM call) | High for clear criteria | Inline blocking checks |
| **Single answer grading (scored)** | 0.5-2s per check | Low (1 LLM call) | Moderate (scale ambiguity) | Async quality monitoring |
| **Pairwise comparison** | 0.5-2s per pair | Low (1 LLM call) | Highest for relative quality | Offline A/B testing |
| **Reference-guided** | 0.5-2s per check | Low (1 LLM call) | Highest for factual correctness | Regression testing with golden answers |
| **GPT-4 as judge** | 1-3s per check | Higher ($) | Highest overall | Critical assessments |
| **GPT-4o-mini as judge** | 0.3-1s per check | Low | Good for clear criteria | Inline checks, high volume |
| **Custom fine-tuned judge** | 0.1-0.5s per check | Upfront training cost | Potentially highest for domain | High-volume production |

### Binary vs. Scored Assessments

Hamel Husain's guide strongly recommends **starting with binary (pass/fail)** assessments:
- Binary judgments force clarity about what constitutes success.
- 1-5 scales lack actionability and rarely correlate with what truly matters.
- Use the judge's reasoning/critique to capture nuance, not the score.
- Only move to scored assessments when you have evidence that the granularity is needed.

### Judge Model Selection

- **GPT-4/Claude for judge**: Highest accuracy, highest cost and latency. Use for offline assessment and calibration.
- **GPT-4o-mini for judge**: Good balance of speed and accuracy. Use for inline production checks.
- **Local/fine-tuned models**: Lowest latency, no API costs, but requires training data and infrastructure. Consider only at high volume.

### Known Limitations

1. **LLM judges are not perfect**: They have biases (position, verbosity, self-enhancement) and limited reasoning ability.
2. **Prompt sensitivity**: Small changes in the assessment prompt can significantly shift scores.
3. **Domain blindness**: Without proper context (e.g., the brick schema), the judge cannot detect domain-specific errors.
4. **Cost at scale**: Each assessment requires an LLM call. At 10,000 responses/day, even cheap models add up.
5. **Non-determinism**: LLM outputs vary between calls. Use temperature=0 and run multiple assessments for high-stakes decisions.

## Recommended Approach for This Project

### Phase 1: Inline Binary Checks (Immediate)

Implement two binary LLM-as-judge assessors that run before sending the response to the user:

1. **Technical data leakage check**: Binary pass/fail. Use GPT-4o-mini for speed. Block responses that fail and regenerate with an updated prompt.
2. **Field name validity check**: Binary pass/fail. Compare referenced field names against the brick schema (can be partially done with regex, with LLM as fallback).

### Phase 2: Async Quality Monitoring (Short-term)

Add LLM-as-judge assessors that run asynchronously on production traces via LangSmith:

3. **Response quality score**: Use the LangSmith UI to configure an LLM-as-judge assessor on the Sidekick tracing project. Set up Rule Automations with a 100% sampling rate initially, then reduce as volume grows.
4. **Hallucination detection**: Reference the tool call results as context and check whether the response accurately reflects what happened.

### Phase 3: Calibration and Iteration (Medium-term)

5. Label 100+ production examples with domain expert judgments (use LangSmith annotation queues).
6. Measure judge agreement with expert labels.
7. Iterate on prompts until agreement exceeds 90%.
8. Enable "Align Evals" in LangSmith to automatically incorporate human corrections.

### Implementation Priority

Start with the technical data leakage assessor as it addresses the most user-visible problem. Use a hybrid approach: regex pre-filter (5ms) catches obvious JSON, then LLM judge (~500ms) handles edge cases. This keeps the p95 latency impact under 1 second for most responses.

### Advanced Patterns to Consider

**Continual In-Context Learning**: Instead of fixed few-shot examples in the judge prompt, dynamically select the most relevant examples based on the response being assessed. Use embedding similarity to find the closest labeled examples from your calibration dataset. This improves accuracy on edge cases without bloating the prompt for straightforward cases.

**Specialized Judges**: Instead of one general-purpose judge, create multiple narrow judges each targeting a specific failure mode. From Hamel Husain's guide: "Create specialized judges" for specific failure patterns discovered during error analysis. For Sidekick, this means separate judges for:
- Technical data leakage (the most common issue)
- Invalid field name references (requires brick schema context)
- Hallucinated actions (requires tool call results as context)
- Tone/audience appropriateness (reference-free quality check)

Each specialized judge can use a simpler, more focused prompt, which improves both accuracy and speed.

**Multi-Judge Consensus**: For high-stakes decisions (e.g., whether to block a response), run 2-3 judges in parallel and use majority vote. This reduces the impact of any single judge's non-determinism. The trade-off is 2-3x the cost per assessment.

**Progressive Judge Complexity**: Start with a cheap/fast model (GPT-4o-mini) and only escalate to an expensive/slow model (GPT-4, Claude) when the fast model is uncertain (confidence below a threshold). This keeps average cost low while maintaining accuracy on hard cases.

```python
async def progressive_judge(response: str, context: dict) -> dict:
    """Use fast model first, escalate to slow model if uncertain."""
    # Fast judge (~300ms, ~$0.001)
    fast_result = await run_judge(response, context, model="gpt-4o-mini")

    # If confident, return immediately
    if fast_result["confidence"] > 0.9:
        return fast_result

    # Uncertain: escalate to powerful model (~1-2s, ~$0.01)
    slow_result = await run_judge(response, context, model="gpt-4")
    return slow_result
```

**Feedback Loop with LangSmith Align Evals**: LangSmith's Align Evals feature stores human corrections to judge scores as few-shot examples. Over time, this creates a self-improving judge that adapts to your team's quality standards without manual prompt engineering. The workflow is:
1. Judge scores a response.
2. Human reviews and corrects the score (via annotation queue).
3. LangSmith stores the correction as a few-shot example.
4. Next time the judge encounters a similar case, it has the correction as context.
5. Track agreement rate over time -- it should increase.

## Sources

- Zheng et al. (2023). "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena." NeurIPS 2023. https://arxiv.org/abs/2306.05685
- MT-Bench implementation: https://github.com/lm-sys/FastChat/tree/main/fastchat/llm_judge
- Hamel Husain. "Using LLM-as-a-Judge For Assessment: A Complete Guide." https://hamel.dev/blog/posts/llm-judge/
- Evidently AI. "LLM-as-a-judge: a complete guide to using LLMs for assessments." https://www.evidentlyai.com/llm-guide/llm-as-a-judge
- LangSmith LLM-as-Judge docs: https://docs.langchain.com/langsmith/llm-as-judge
- LangSmith Assessment Concepts: https://docs.langchain.com/langsmith/evaluation-concepts
- LangChain blog. "Aligning LLM-as-a-Judge with Human Preferences." https://blog.langchain.com/aligning-llm-as-a-judge-with-human-preferences/
- LangChain OpenEvals: https://github.com/langchain-ai/openevals
- LangChain AgentEvals: https://github.com/langchain-ai/agentevals
- LangChain blog. "Quickly Start Assessing LLMs With OpenEvals." https://blog.langchain.com/evaluating-llms-with-openevals/
- Langfuse. "LLM-as-a-Judge Assessment: Complete Guide." https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge
