# RAGAS and Assessment Frameworks

## Summary

RAGAS (Retrieval Augmented Generation Assessment) is a framework for automated quality measurement of RAG pipelines, but its concepts extend to agent systems. This document covers RAGAS alongside two other major frameworks -- DeepEval and LangSmith Evaluations -- comparing what each offers. For the Sidekick agent, these frameworks address the need for both offline regression testing (did a prompt change break anything?) and online monitoring (are production responses maintaining quality?). The key finding is that LangSmith Evaluations is the best fit given the existing LangSmith tracing setup, while DeepEval offers the most comprehensive agent-specific metrics, and RAGAS is most useful if the agent evolves to include RAG retrieval.

## Key Concepts

- **RAGAS (Retrieval Augmented Generation Assessment)**: An open-source framework providing reference-free metrics for RAG pipeline quality. Paper: https://arxiv.org/abs/2309.15217
- **DeepEval**: An open-source LLM testing framework by Confident AI, offering 50+ metrics including agent-specific ones (tool correctness, task completion).
- **LangSmith Evaluations**: LangChain's built-in platform for offline and online quality measurement, supporting heuristic, LLM-as-judge, human, and pairwise approaches.
- **OpenEvals**: LangChain's open-source library of ready-made assessors (for use with or without LangSmith).
- **AgentEvals**: LangChain's companion library specifically for assessing agent trajectories (tool call sequences).
- **Faithfulness**: Whether the response is grounded in the provided context (does not fabricate information).
- **Answer Relevancy**: Whether the response actually addresses the user's question.
- **Hallucination**: When the model generates information not supported by the context or reality.
- **Tool Correctness**: Whether the agent called the right tools with the right arguments.
- **Task Completion**: Whether the agent successfully accomplished the user's requested task.
- **G-Eval**: A framework using LLM-as-judge with chain-of-thought to score outputs on arbitrary criteria.
- **Offline Assessment**: Running assessments against curated datasets during development (like unit tests).
- **Online Assessment**: Scoring real production traffic in real-time to detect quality drift.

## How It Works

### RAGAS Framework

RAGAS was originally designed for RAG pipelines but has expanded to support agent use cases.

#### Installation

```bash
pip install ragas
```

#### Core RAG Metrics

**Faithfulness** -- Does the response stick to the facts in the retrieved context?

```python
from ragas.metrics import Faithfulness
from ragas.llms import LangchainLLMWrapper
from langchain_openai import ChatOpenAI

llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o-mini"))
scorer = Faithfulness(llm=llm)

# Requires: question, answer, and contexts
from ragas import SingleTurnSample
sample = SingleTurnSample(
    user_input="What colors are available for this brick?",
    response="The available colors are red, blue, and green.",
    retrieved_contexts=["The brand palette includes red (#FF0000), blue (#0000FF), and green (#00FF00)."]
)
score = await scorer.single_turn_ascore(sample)
# Returns 0.0-1.0 (1.0 = fully faithful)
```

**Answer Relevancy** -- Does the response address the actual question?

```python
from ragas.metrics import ResponseRelevancy

scorer = ResponseRelevancy(llm=llm)
score = await scorer.single_turn_ascore(sample)
# Returns 0.0-1.0 (1.0 = perfectly relevant)
```

**Context Precision** -- How much of the retrieved context is actually useful?

```python
from ragas.metrics import LLMContextPrecisionWithoutReference

scorer = LLMContextPrecisionWithoutReference(llm=llm)
score = await scorer.single_turn_ascore(sample)
```

**Context Recall** -- Did the retrieval find all the relevant information?

```python
from ragas.metrics import LLMContextRecall

scorer = LLMContextRecall(llm=llm)
score = await scorer.single_turn_ascore(sample)
```

#### Agent-Specific Metrics

RAGAS includes metrics specifically for agent/tool use:

**Tool Call Accuracy** -- Did the agent call the right tools?

```python
from ragas.metrics import ToolCallAccuracy

scorer = ToolCallAccuracy()
# Uses MultiTurnSample with tool calls
from ragas import MultiTurnSample
sample = MultiTurnSample(
    user_input=[
        {"role": "user", "content": "Change the headline to Summer Sale"},
        {"role": "assistant", "tool_calls": [
            {"name": "update_brick", "args": {"field": "headline", "value": "Summer Sale"}}
        ]},
        {"role": "tool", "content": "Success"},
        {"role": "assistant", "content": "Done! The headline is now 'Summer Sale'."},
    ],
    reference_tool_calls=[
        {"name": "update_brick", "args": {"field": "headline", "value": "Summer Sale"}}
    ]
)
score = await scorer.multi_turn_ascore(sample)
```

**Agent Goal Accuracy** -- Did the agent accomplish the user's goal?

```python
from ragas.metrics import AgentGoalAccuracy

scorer = AgentGoalAccuracy(llm=llm)
score = await scorer.multi_turn_ascore(sample)
```

**Topic Adherence** -- Did the agent stay on topic throughout the conversation?

```python
from ragas.metrics import TopicAdherence

scorer = TopicAdherence(llm=llm)
score = await scorer.multi_turn_ascore(sample)
```

#### General Purpose Metrics (No RAG Required)

These metrics work for any LLM application:

**Aspect Critic** -- Scores output on any custom aspect you define:

```python
from ragas.metrics import AspectCritic

# Define a custom aspect
technical_leakage_critic = AspectCritic(
    name="technical_data_free",
    definition="The response does not contain any raw JSON, database field names, API paths, or other technical artifacts that should not be shown to a non-technical user.",
    llm=llm,
)
score = await technical_leakage_critic.single_turn_ascore(sample)
```

**Rubrics-Based Scoring** -- Score against a detailed rubric:

```python
from ragas.metrics import RubricsScoreWithoutReference

rubric = {
    1: "Response contains raw JSON or multiple internal field names",
    2: "Response contains one or two technical terms",
    3: "Response is mostly user-friendly but uses slightly technical language",
    4: "Response is fully user-friendly with appropriate language",
    5: "Response is excellent: clear, helpful, and uses only user-appropriate terms",
}

scorer = RubricsScoreWithoutReference(rubrics=rubric, llm=llm)
score = await scorer.single_turn_ascore(sample)
```

**Factual Correctness** -- Compares response against a known-correct reference:

```python
from ragas.metrics import FactualCorrectness

scorer = FactualCorrectness(llm=llm)
# Requires reference_response in the sample
```

#### RAGAS Design Principles

From the documentation (https://docs.ragas.io/en/stable/concepts/metrics/overview/):

1. **Single-Aspect Focus**: Each metric targets one specific performance dimension.
2. **Intuitive Interpretability**: Clarity enables team-wide understanding.
3. **Effective Prompt Flows**: LLM-based metrics decompose tasks into sub-tasks with targeted prompts.
4. **Robustness**: Include sufficient few-shot examples reflecting desired outcomes.
5. **Consistent Scoring Ranges**: Normalize values (typically 0-1) for cross-metric comparison.

#### Metric Selection Strategy

RAGAS recommends:
- Prioritize end-to-end metrics reflecting overall user satisfaction (goal accuracy, correctness).
- Ensure objectivity with inter-rater agreement at or above 80%.
- Choose strong signals over weak ones: one robust metric like "goal accuracy" outperforms multiple weak proxies like coherence or helpfulness.
- Maintain interpretability across technical and non-technical stakeholders.

### DeepEval Framework

DeepEval (https://github.com/confident-ai/deepeval) is an LLM testing framework designed to be used like pytest for LLM applications.

#### Installation

```bash
pip install deepeval
```

#### Core Architecture

All DeepEval metrics output a score between 0-1 with accompanying reasoning. A test case passes when the score meets or exceeds a configured threshold (default 0.5).

```python
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric
from deepeval import assert_test

# Create a test case
test_case = LLMTestCase(
    input="Change the headline to Summer Sale",
    actual_output="I've updated the headline text to 'Summer Sale'.",
)

# Define the metric
relevancy = AnswerRelevancyMetric(threshold=0.7)

# Assert (raises exception if score < threshold)
assert_test(test_case, [relevancy])
```

#### Agent-Specific Metrics

DeepEval offers the most comprehensive agent metrics of any framework:

**Task Completion** -- Did the agent accomplish the user's goal?

```python
from deepeval.metrics import TaskCompletionMetric

task_completion = TaskCompletionMetric(threshold=0.7)
task_completion.measure(test_case)
print(f"Score: {task_completion.score}, Reason: {task_completion.reason}")
```

**Tool Correctness** -- Did the agent use the right tools?

```python
from deepeval.metrics import ToolCorrectnessMetric

tool_correctness = ToolCorrectnessMetric(threshold=0.7)
# Requires tool_calls in the test case
```

**Step Efficiency** -- Did the agent take an efficient path?

```python
from deepeval.metrics import StepEfficiencyMetric

efficiency = StepEfficiencyMetric(threshold=0.5)
```

**Plan Adherence** -- Did the agent follow its stated plan?

```python
from deepeval.metrics import PlanAdherenceMetric

adherence = PlanAdherenceMetric(threshold=0.7)
```

#### G-Eval for Custom Criteria

G-Eval is DeepEval's most versatile metric, using chain-of-thought reasoning to score on any criteria:

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams

# Check for technical data leakage
no_technical_data = GEval(
    name="No Technical Data",
    criteria="The response should not contain any raw JSON objects, internal database field names (like _id, brickType, templateId), MongoDB operators ($set, $push), API paths, or schema definitions. The response should use plain, user-friendly language appropriate for a marketing professional.",
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT,
    ],
    threshold=0.8,
    strict_mode=True,  # Returns 0 if below threshold
)

# Check for correct field name usage
valid_field_names = GEval(
    name="Valid Field Names",
    criteria="When the response describes making an edit to a brick, any field names mentioned should match the user-facing names (like 'headline', 'body text', 'image') rather than internal names (like 'headline.text.value', 'bodyContent', 'imageUrl'). The response should not expose the internal data model.",
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT,
        LLMTestCaseParams.CONTEXT,  # brick schema as context
    ],
    threshold=0.8,
)

test_case = LLMTestCase(
    input="Change the headline to Summer Sale",
    actual_output=agent_response,
    context=["Available user-facing fields: headline, body text, image, background color, CTA text, CTA link"],
)

no_technical_data.measure(test_case)
valid_field_names.measure(test_case)
```

#### RAG Metrics

DeepEval provides RAG metrics that mirror RAGAS:

```python
from deepeval.metrics import (
    AnswerRelevancyMetric,
    FaithfulnessMetric,
    ContextualRelevancyMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
    HallucinationMetric,
)
```

#### Chatbot / Multi-Turn Metrics

```python
from deepeval.metrics import (
    KnowledgeRetentionMetric,    # Does the bot remember earlier context?
    RoleAdherenceMetric,          # Does the bot stay in character?
    ConversationCompletenessMetric,  # Was the conversation resolved?
    ConversationRelevancyMetric,    # Did the bot stay on topic?
)
```

#### Safety Metrics

```python
from deepeval.metrics import (
    BiasMetric,        # Detects age, gender, ethnicity biases
    ToxicityMetric,    # Detects harmful or offensive content
    PIILeakageMetric,  # Detects PII in responses
)
```

#### Running Tests with pytest

```python
# test_sidekick.py
import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import GEval, TaskCompletionMetric

@pytest.mark.parametrize("test_case", load_test_cases())
def test_no_technical_data(test_case):
    metric = GEval(
        name="No Technical Data",
        criteria="Response should not contain raw JSON or internal field names",
        evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT],
        threshold=0.8,
    )
    assert_test(test_case, [metric])

@pytest.mark.parametrize("test_case", load_test_cases())
def test_task_completion(test_case):
    metric = TaskCompletionMetric(threshold=0.7)
    assert_test(test_case, [metric])
```

Run with: `deepeval test run test_sidekick.py`

### LangSmith Evaluations

LangSmith (https://www.langchain.com/langsmith) provides a complete platform for offline and online quality measurement, deeply integrated with LangChain and LangGraph.

#### Offline Assessment Workflow

```python
from langsmith import Client
from langsmith.evaluation import evaluate

client = Client()

# 1. Create a dataset
dataset = client.create_dataset("sidekick-regression-tests")

# 2. Add examples
client.create_example(
    inputs={"message": "Change the headline to Summer Sale"},
    outputs={"expected_response": "I've updated the headline text to 'Summer Sale'."},
    dataset_id=dataset.id,
)

# 3. Define assessors
def no_technical_data(run, example):
    """Check response for technical data."""
    import re
    response = run.outputs.get("response", "")
    has_json = bool(re.search(r'\{["\']?\w+["\']?\s*:', response))
    return {"key": "no_technical_data", "score": 0 if has_json else 1}

def response_length(run, example):
    """Check response is reasonable length."""
    response = run.outputs.get("response", "")
    length = len(response)
    return {"key": "response_length", "score": 1 if 10 < length < 2000 else 0}

# 4. Run the assessment
results = evaluate(
    my_sidekick_agent,  # the function to test
    data="sidekick-regression-tests",
    evaluators=[no_technical_data, response_length],
    experiment_prefix="sidekick-v2.1",
)
```

#### Online Assessment with Rule Automations

LangSmith's online assessment uses Rule Automations to score production traces automatically:

1. **In the LangSmith UI**: Navigate to your tracing project (e.g., "sidekick-production").
2. **Create a Rule**: Define a filter (e.g., all traces, or traces with specific tags).
3. **Set a sampling rate**: Start at 100% for low volume, reduce as volume grows.
4. **Choose an action**: "Run Online Evaluator" with your configured assessor.
5. **Configure the assessor**: LLM-as-judge with your prompt, or code-based heuristic.

The SDK does not currently provide a way to programmatically set up rule automations -- this must be done from the UI or API directly.

#### Annotation Queues for Human Review

```python
# Create an annotation queue
queue = client.create_annotation_queue(
    name="sidekick-review",
    description="Review flagged Sidekick responses",
)

# Automation: send low-scoring responses to the queue
# (configured in LangSmith UI as a Rule Automation)
# Filter: feedback.no_technical_data.score < 1
# Action: Add to annotation queue "sidekick-review"
```

#### Using OpenEvals with LangSmith

```python
from openevals.llm import create_llm_as_judge
from openevals.prompts import HALLUCINATION_PROMPT
from langsmith.evaluation import evaluate

# Create an LLM-as-judge assessor
hallucination_check = create_llm_as_judge(
    prompt=HALLUCINATION_PROMPT,
    feedback_key="hallucination",
    model="openai:gpt-4o-mini",
)

# Use it in an offline assessment run
results = evaluate(
    my_sidekick_agent,
    data="sidekick-regression-tests",
    evaluators=[hallucination_check],
    experiment_prefix="sidekick-hallucination-check",
)
```

#### Using AgentEvals for Trajectory Assessment

```python
from agentevals.trajectory import create_trajectory_llm_as_judge

# Assess whether the agent took the right steps
trajectory_judge = create_trajectory_llm_as_judge(
    model="openai:gpt-4o-mini",
)

# Strict match: exact tool call sequence
from agentevals.trajectory import create_trajectory_strict_match
strict_match = create_trajectory_strict_match()

# Unordered match: same tools, any order
from agentevals.trajectory import create_trajectory_unordered_match
unordered_match = create_trajectory_unordered_match()
```

## Use Cases Relevant to This Project

### 1. Regression Testing After Prompt Changes

When updating the Sidekick system prompt, run the full test dataset through RAGAS or DeepEval to catch regressions.

**Framework**: LangSmith offline assessment with a curated dataset of 50-100 examples covering common user requests.
**Metrics**: Task completion, no technical data (G-Eval), valid field names (G-Eval).

### 2. Monitoring Production Quality

Score real user interactions continuously to detect quality drift.

**Framework**: LangSmith online assessment via Rule Automations.
**Metrics**: No technical data (heuristic), response relevancy (LLM-as-judge), hallucination (LLM-as-judge).

### 3. Validating Tool Call Sequences

Ensure the agent calls the right tools with the right arguments for brick edits.

**Framework**: AgentEvals trajectory assessment.
**Metrics**: Tool call accuracy, trajectory strict/unordered match.

### 4. Identifying Common Failure Modes

Analyze assessed production traces to discover new patterns of failure.

**Framework**: LangSmith annotation queues + human review.
**Process**: Auto-flag low-scoring responses, route to annotation queue, human reviews and labels, export to dataset for future regression tests.

### 5. A/B Testing Prompt Versions

Compare two versions of the Sidekick prompt on the same test cases.

**Framework**: LangSmith pairwise assessment.
**Metrics**: Side-by-side comparison with human or LLM-as-judge scoring.

## Tradeoffs

### Framework Comparison

| Feature | RAGAS | DeepEval | LangSmith Evaluations |
|---------|-------|----------|----------------------|
| **Focus** | RAG pipelines (expanding to agents) | General LLM testing | Full assessment lifecycle |
| **Agent metrics** | Tool call accuracy, goal accuracy, topic adherence | Task completion, tool correctness, step efficiency, plan adherence, plan quality | Via OpenEvals/AgentEvals |
| **RAG metrics** | Faithfulness, relevancy, precision, recall | Mirror of RAGAS metrics | Via OpenEvals |
| **Custom metrics** | Aspect Critic, Rubrics scoring | G-Eval (chain-of-thought), DAG | Custom code assessors |
| **Offline assessment** | Yes (datasets) | Yes (pytest integration) | Yes (datasets + experiments) |
| **Online assessment** | No | No (monitoring via Confident AI paid) | Yes (Rule Automations) |
| **Human review** | No | Via Confident AI | Annotation queues |
| **LLM judge** | Built-in (all LLM metrics) | Built-in (G-Eval, all metrics) | OpenEvals + UI config |
| **Non-LLM metrics** | BLEU, ROUGE, exact match, embedding similarity | String-based, embedding-based | Custom code assessors |
| **Existing integration** | Requires setup | Requires setup | Already have LangSmith tracing |
| **Cost** | Free (open-source) + LLM API costs | Free (open-source) + LLM API costs | LangSmith plan + LLM API costs |
| **Language** | Python | Python | Python + TypeScript |

### Metric Selection Guidelines

From DeepEval's documentation: limit to **no more than 5 metrics**:
- 2-3 generic, system-specific metrics
- 1-2 custom, use-case-specific metrics

For the Sidekick agent, the recommended 5 metrics:

1. **No technical data** (custom G-Eval or heuristic) -- catches JSON/schema leakage
2. **Task completion** (DeepEval or AgentEvals) -- did the agent do what was asked?
3. **Hallucination** (OpenEvals or DeepEval) -- did the agent fabricate information?
4. **Tool correctness** (AgentEvals) -- did the agent call the right tools with right args?
5. **Response relevancy** (RAGAS or DeepEval) -- did the agent answer the right question?

### When to Use Which Framework

| Scenario | Recommended Framework | Why |
|----------|----------------------|-----|
| Quick offline regression test | LangSmith + OpenEvals | Already integrated with your tracing |
| Comprehensive agent testing | DeepEval | Most agent-specific metrics |
| RAG quality measurement | RAGAS | Purpose-built for RAG |
| Production monitoring | LangSmith online assessments | Rule Automations on traces |
| Human review workflow | LangSmith annotation queues | Built into the platform |
| CI/CD pipeline testing | DeepEval (pytest) | Native pytest integration |
| Tool call sequence checking | AgentEvals | Trajectory-specific assessors |

## Recommended Approach for This Project

### Primary Framework: LangSmith Evaluations

Given that the Sidekick agent already uses LangSmith for tracing, LangSmith Evaluations is the natural choice for the primary assessment infrastructure:

1. **Create a regression test dataset** from known good/bad examples.
2. **Configure Rule Automations** for online assessment of production traces.
3. **Set up annotation queues** for human review of flagged responses.
4. **Use OpenEvals** for LLM-as-judge assessors (hallucination, correctness).
5. **Use AgentEvals** for trajectory/tool call assessment.

### Secondary Framework: DeepEval for CI/CD

Add DeepEval for pytest-integrated testing in the CI/CD pipeline:

1. **Create test files** with parameterized test cases.
2. **Define custom G-Eval metrics** for Sidekick-specific criteria (no technical data, valid field names).
3. **Run `deepeval test run`** in GitLab CI on prompt changes.

### Tertiary: RAGAS for Future RAG

If the Sidekick agent adds document retrieval (e.g., searching brand guidelines), RAGAS metrics become directly applicable. Keep it in reserve.

### Metric Implementation Order

1. **Week 1**: Implement `no_technical_data` as a heuristic assessor in LangSmith (regex-based, zero LLM cost).
2. **Week 2**: Add `hallucination` check using OpenEvals LLM-as-judge on production traces.
3. **Week 3**: Set up offline regression test dataset with 50 examples. Run task completion and field validity checks.
4. **Week 4**: Add AgentEvals trajectory assessment for tool call validation.
5. **Month 2**: Add DeepEval to CI/CD pipeline. Create comprehensive test suite.

## Sources

- RAGAS paper: https://arxiv.org/abs/2309.15217
- RAGAS documentation: https://docs.ragas.io/en/stable/
- RAGAS metrics overview: https://docs.ragas.io/en/stable/concepts/metrics/overview/
- RAGAS available metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- DeepEval documentation: https://deepeval.com/docs/getting-started
- DeepEval metrics introduction: https://deepeval.com/docs/metrics-introduction
- DeepEval G-Eval: https://deepeval.com/docs/metrics-llm-evals
- DeepEval RAGAS integration: https://deepeval.com/docs/metrics-ragas
- DeepEval GitHub: https://github.com/confident-ai/deepeval
- LangSmith assessment docs: https://docs.langchain.com/langsmith/evaluation
- LangSmith assessment concepts: https://docs.langchain.com/langsmith/evaluation-concepts
- LangSmith prebuilt assessors: https://docs.langchain.com/langsmith/prebuilt-evaluators
- LangSmith rule automations: https://docs.smith.langchain.com/observability/how_to_guides/rules
- OpenEvals GitHub: https://github.com/langchain-ai/openevals
- AgentEvals GitHub: https://github.com/langchain-ai/agentevals
- LangChain blog on OpenEvals: https://blog.langchain.com/evaluating-llms-with-openevals/
- Confident AI blog on LLM metrics: https://www.confident-ai.com/blog/llm-evaluation-metrics-everything-you-need-for-llm-evaluation
