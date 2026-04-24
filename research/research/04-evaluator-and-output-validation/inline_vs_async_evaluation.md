# Inline vs. Async Evaluation

## Summary

Inline evaluation blocks the response pipeline -- the user waits while the check runs -- while async evaluation logs the response and scores it in the background with no latency impact. For the Sidekick agent, the choice between inline and async determines whether you can actually prevent bad responses from reaching users (inline) or only detect them after the fact (async). The recommended approach is a hybrid: fast deterministic checks run inline (regex, keyword matching, under 5ms), while expensive LLM-based checks run asynchronously via LangSmith, with the option to escalate specific high-risk scenarios to inline LLM checks when the cost of a bad response is high.

## Key Concepts

- **Inline Evaluation**: A check that runs synchronously in the response pipeline, blocking delivery to the user until it completes. Adds latency but can prevent bad responses.
- **Async Evaluation**: A check that runs in the background after the response is sent. Zero latency impact but cannot prevent bad responses; can only log, alert, and inform future improvements.
- **Hybrid Evaluation**: Combining fast inline checks (regex, heuristics) with async LLM-based checks. The fast checks catch obvious issues in real-time; the LLM checks catch subtle issues after the fact.
- **Short-Circuit Evaluation**: In an inline pipeline, stopping early when a fast check fails, avoiding the cost of running slower downstream checks.
- **Fire-and-Forget**: Launching an async task without waiting for its result. The evaluation runs in the background and reports results later.
- **Rule Automations**: LangSmith's mechanism for running evaluators automatically on production traces, with configurable filters and sampling rates.
- **Annotation Queues**: LangSmith's mechanism for routing traces to human reviewers based on automated evaluation results.
- **p95/p99 Latency**: The 95th/99th percentile response time. More meaningful than average latency because it represents the experience of the slowest 5%/1% of users.
- **Latency Budget**: The maximum acceptable latency for a user-facing response. For the Sidekick agent, likely 3-8 seconds total (including the LLM generation itself).
- **Quality Gate**: A check that must pass before a response can proceed. Inline evaluation acts as a quality gate; async evaluation does not.

## How It Works

### Inline Evaluation in a LangGraph Pipeline

In LangGraph, inline evaluation is implemented as a node in the state graph that runs between the agent's response generation and the final output to the user.

#### Architecture

```
User Message
    |
    v
[Agent Node] -- generates response via LLM + tools
    |
    v
[Inline Evaluation Node] -- checks response quality
    |-- PASS --> [Output Node] --> User
    |-- FAIL --> [Correction Node] --> [Agent Node] (retry)
    |                                   or
    |-- FAIL --> [Fallback Node] --> User (safe fallback message)
```

#### Implementation in LangGraph

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Literal
import re

class SidekickState(TypedDict):
    user_message: str
    agent_response: str
    tool_calls: list
    evaluation_result: dict
    retry_count: int
    final_response: str

def agent_node(state: SidekickState) -> dict:
    """Generate the agent response (existing logic)."""
    response = run_sidekick_agent(
        state["user_message"],
        retry_context=state.get("evaluation_result", {}).get("reason"),
    )
    return {
        "agent_response": response["message"],
        "tool_calls": response["tool_calls"],
    }

def inline_evaluation_node(state: SidekickState) -> dict:
    """Run fast inline checks on the agent response."""
    response = state["agent_response"]
    violations = []

    # Check 1: JSON objects in response (~1ms)
    if re.search(r'\{["\']?\w+["\']?\s*:', response):
        violations.append("Response contains JSON object")

    # Check 2: Internal field names (~1ms)
    internal_fields = ["_id", "objectId", "brickType", "templateId", "brickId"]
    for field in internal_fields:
        if field in response:
            violations.append(f"Response contains internal field: {field}")

    # Check 3: MongoDB operators (~1ms)
    if re.search(r'\$(?:set|push|pull|match)', response):
        violations.append("Response contains MongoDB operator")

    # Check 4: Excessive length suggesting raw data dump (~0ms)
    if len(response) > 3000:
        violations.append("Response exceeds length limit (possible data dump)")

    passed = len(violations) == 0
    return {
        "evaluation_result": {
            "passed": passed,
            "violations": violations,
            "reason": "; ".join(violations) if violations else None,
        },
    }

def route_after_evaluation(state: SidekickState) -> Literal["output", "retry", "fallback"]:
    """Decide what to do based on evaluation result."""
    if state["evaluation_result"]["passed"]:
        return "output"
    elif state["retry_count"] < 2:
        return "retry"
    else:
        return "fallback"

def retry_node(state: SidekickState) -> dict:
    """Increment retry count and feed evaluation feedback to agent."""
    return {
        "retry_count": state["retry_count"] + 1,
        # The evaluation_result.reason is already in state,
        # agent_node reads it to adjust its response
    }

def output_node(state: SidekickState) -> dict:
    """Send the validated response to the user."""
    return {"final_response": state["agent_response"]}

def fallback_node(state: SidekickState) -> dict:
    """Send a safe fallback message after max retries."""
    return {
        "final_response": "I've processed your request. "
        "Let me know if you'd like me to explain what was changed."
    }

# Build the graph
graph = StateGraph(SidekickState)
graph.add_node("agent", agent_node)
graph.add_node("evaluate", inline_evaluation_node)
graph.add_node("retry", retry_node)
graph.add_node("output", output_node)
graph.add_node("fallback", fallback_node)

graph.set_entry_point("agent")
graph.add_edge("agent", "evaluate")
graph.add_conditional_edges(
    "evaluate",
    route_after_evaluation,
    {"output": "output", "retry": "retry", "fallback": "fallback"},
)
graph.add_edge("retry", "agent")  # Loop back to agent with feedback
graph.add_edge("output", END)
graph.add_edge("fallback", END)

app = graph.compile()
```

#### Inline LLM-Based Evaluation (When Needed)

For cases where regex is insufficient, an inline LLM judge can be added. This is slower (~500ms-2s) but catches edge cases:

```python
from langchain_openai import ChatOpenAI

async def inline_llm_evaluation_node(state: SidekickState) -> dict:
    """Run LLM-based evaluation. Only use when fast checks are insufficient."""
    response = state["agent_response"]

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    check_prompt = f"""Check if this response from a marketing tool AI assistant
contains any technical data that should not be shown to a marketing user.

Technical data includes: raw JSON, database field names, API paths,
schema definitions, error objects, MongoDB operators.

Response to check: {response}

Answer with just PASS or FAIL, followed by a brief reason."""

    result = await llm.ainvoke(check_prompt)
    verdict = "PASS" if "PASS" in result.content.upper() else "FAIL"
    reason = result.content.split("\n", 1)[-1] if "\n" in result.content else ""

    return {
        "evaluation_result": {
            "passed": verdict == "PASS",
            "violations": [reason] if verdict == "FAIL" else [],
            "reason": reason if verdict == "FAIL" else None,
        },
    }
```

### Async Evaluation with LangSmith

Async evaluation runs in the background on production traces, using LangSmith's tracing infrastructure.

#### How LangSmith Tracing Works (Zero Latency Impact)

LangSmith's SDK uses an async callback handler that sends traces to a distributed collector. The tracing happens asynchronously and does not block the main response pipeline. From the LangSmith docs: "your application performance is never impacted."

This means every Sidekick response is already being traced (assuming LangSmith is configured), and you can run evaluators on those traces without adding any latency to the user experience.

#### Setting Up Online Evaluation with Rule Automations

Rule Automations in LangSmith are configured in the UI and execute on incoming traces:

**Step 1: Create an online evaluator**

In the LangSmith UI:
1. Go to your tracing project (e.g., "sidekick-production").
2. Navigate to "Rules" in the project settings.
3. Create a new rule with:
   - **Filter**: All traces (or filter by tags, metadata, etc.)
   - **Sampling rate**: 100% initially, reduce as volume grows
   - **Action**: "Run Online Evaluator"
   - **Evaluator**: Choose an LLM-as-judge or code-based evaluator

**Step 2: Configure the evaluator prompt**

For an LLM-as-judge online evaluator:
- The evaluator receives only the production run data (no reference outputs).
- It must use reference-free criteria (safety, quality heuristics, format checks).
- Configure scoring as Boolean (pass/fail), Categorical, or Continuous.

**Step 3: Set up alerts and routing**

Additional automation rules can:
- Add low-scoring traces to a dataset (for future regression testing)
- Add traces to an annotation queue (for human review)
- Trigger a webhook (for alerting via Slack, PagerDuty, etc.)

#### Implementing Async Evaluation in Code

If you want more control than LangSmith Rule Automations provide, you can implement fire-and-forget evaluation in your application code:

```python
import asyncio
from langsmith import Client

client = Client()

async def fire_and_forget_evaluation(run_id: str, response: str, context: dict):
    """Run evaluation asynchronously without blocking the response."""
    try:
        # LLM-based quality check
        from openevals.llm import create_llm_as_judge
        from openevals.prompts import HALLUCINATION_PROMPT

        hallucination_check = create_llm_as_judge(
            prompt=HALLUCINATION_PROMPT,
            feedback_key="hallucination",
            model="openai:gpt-4o-mini",
        )

        result = hallucination_check(
            inputs=context.get("user_message", ""),
            outputs=response,
            context=context.get("tool_results", ""),
        )

        # Log feedback to LangSmith
        client.create_feedback(
            run_id=run_id,
            key="hallucination",
            score=result.get("score"),
            comment=result.get("comment"),
        )

        # Custom technical data check
        import re
        has_json = bool(re.search(r'\{["\']?\w+["\']?\s*:', response))
        client.create_feedback(
            run_id=run_id,
            key="technical_data_leakage",
            score=0 if has_json else 1,
            comment="JSON detected in response" if has_json else "Clean",
        )

    except Exception as e:
        # Async evaluation failures should never crash the main app
        logger.error(f"Async evaluation failed for run {run_id}: {e}")

# In the main response handler:
async def handle_sidekick_request(user_message: str):
    # Generate response (this is what the user waits for)
    response = await generate_sidekick_response(user_message)

    # Fire and forget: launch evaluation without waiting
    asyncio.create_task(
        fire_and_forget_evaluation(
            run_id=response.run_id,
            response=response.message,
            context={"user_message": user_message, "tool_results": response.tool_results},
        )
    )

    # Return immediately -- evaluation happens in background
    return response
```

#### Batch Async Evaluation

For high-volume scenarios, batch evaluation is more efficient than per-request evaluation:

```python
import asyncio
from collections import deque

class BatchEvaluationQueue:
    """Collects responses and evaluates them in batches."""

    def __init__(self, batch_size: int = 10, flush_interval_seconds: int = 60):
        self.queue = deque()
        self.batch_size = batch_size
        self.flush_interval = flush_interval_seconds
        self._running = False

    async def add(self, run_id: str, response: str, context: dict):
        """Add a response to the evaluation queue."""
        self.queue.append({
            "run_id": run_id,
            "response": response,
            "context": context,
        })

        if len(self.queue) >= self.batch_size:
            await self._flush()

    async def _flush(self):
        """Evaluate all queued responses."""
        batch = []
        while self.queue and len(batch) < self.batch_size:
            batch.append(self.queue.popleft())

        if batch:
            await asyncio.gather(*[
                self._evaluate_single(item) for item in batch
            ])

    async def start_periodic_flush(self):
        """Start periodic flushing for time-based batching."""
        self._running = True
        while self._running:
            await asyncio.sleep(self.flush_interval)
            await self._flush()

    async def _evaluate_single(self, item: dict):
        """Evaluate a single response (called within a batch)."""
        await fire_and_forget_evaluation(
            item["run_id"], item["response"], item["context"]
        )
```

### The Hybrid Approach

The hybrid approach combines the best of both worlds:

```
Agent Response
    |
    v
[Inline: Fast Deterministic Checks] (~2ms)
    |-- FAIL --> Block & Retry (immediate protection)
    |-- PASS --> Send to user
    |
    v (in parallel, non-blocking)
[Async: LLM-Based Quality Checks] (~1-3s, background)
    |-- Results logged to LangSmith
    |-- Low scores trigger alerts
    |-- Flagged responses routed to human review
```

#### Implementation

```python
class HybridEvaluationPipeline:
    """Combines inline fast checks with async LLM checks."""

    def __init__(self):
        self.regex_detector = TechnicalDataDetector()
        self.blocklist = FieldNameBlocklist()
        self.langsmith_client = Client()

    async def evaluate_inline(self, response: str) -> dict:
        """Fast inline checks. Must complete in <10ms."""
        # Layer 1: Regex (~1ms)
        regex_result = self.regex_detector.check(response)
        if not regex_result["passed"]:
            return {"passed": False, "reason": regex_result["violations"][0]["description"]}

        # Layer 2: Blocklist (~1ms)
        blocklist_result = self.blocklist.check(response)
        if not blocklist_result["passed"]:
            return {"passed": False, "reason": f"Blocked terms found: {blocklist_result['blocked_terms']}"}

        # Layer 3: Length check (~0ms)
        if len(response) > 3000:
            return {"passed": False, "reason": "Response too long (possible data dump)"}

        return {"passed": True}

    async def evaluate_async(self, run_id: str, response: str, context: dict):
        """Async LLM checks. Runs in background, no latency impact."""
        # Hallucination check
        hallucination_score = await self._check_hallucination(response, context)
        self.langsmith_client.create_feedback(
            run_id=run_id,
            key="hallucination",
            score=hallucination_score,
        )

        # Quality score
        quality_score = await self._check_quality(response, context)
        self.langsmith_client.create_feedback(
            run_id=run_id,
            key="response_quality",
            score=quality_score,
        )

        # Field validity (for edit operations)
        if context.get("is_edit_operation"):
            field_score = await self._check_field_validity(response, context)
            self.langsmith_client.create_feedback(
                run_id=run_id,
                key="field_validity",
                score=field_score,
            )

    async def run(self, run_id: str, response: str, context: dict) -> dict:
        """Main entry point: inline check + async fire-and-forget."""
        # Inline: blocks until complete (~2ms)
        inline_result = await self.evaluate_inline(response)

        if inline_result["passed"]:
            # Async: fire and forget (~0ms to launch)
            asyncio.create_task(
                self.evaluate_async(run_id, response, context)
            )

        return inline_result
```

### When to Use Which Approach

#### Use Inline Evaluation When:

1. **The issue is user-facing and obvious**: Raw JSON in a response is immediately visible and confusing to users. Blocking it is worth the latency.
2. **The check is fast**: Regex, keyword matching, length checks all complete in under 5ms. No reason not to run them inline.
3. **The cost of a bad response is high**: If a bad response could cause the user to lose trust, make incorrect changes, or see sensitive data, block it.
4. **You have a fallback**: If the check fails, you need a plan -- retry with feedback, send a safe fallback message, or ask the user to try again.

#### Use Async Evaluation When:

1. **The check is slow**: LLM-based evaluations take 500ms-3s. Running them inline doubles the response time.
2. **The issue is subtle**: Quality drift, slight hallucinations, and tone issues are important but not urgent enough to block every response.
3. **You want coverage without cost**: You cannot afford to run an LLM judge on every single response inline, but you can run it on 100% of responses asynchronously (or a sample).
4. **You are gathering data**: Building up a dataset of scored responses to train a better system, without impacting the current user experience.
5. **The check requires context you do not have inline**: Some evaluations need to compare against historical data, cross-reference with other systems, or aggregate across multiple interactions.

#### Use Hybrid When:

1. **You have both types of issues**: Fast-detectable problems (JSON leakage) AND subtle problems (hallucination) in the same system.
2. **You want defense in depth**: Fast checks catch 90% of issues instantly; LLM checks catch the remaining 10% after the fact, informing improvements.
3. **You are iterating**: Start with async-only evaluation to understand your failure modes, then promote the most critical checks to inline once you have confidence in them.

### Latency Analysis for the Sidekick Agent

Current Sidekick response pipeline (estimated):

```
User message received:           0ms
LangGraph agent processing:      500-2000ms (tool calls, LLM generation)
Response sent to user:           Total ~1-3s

With inline regex/keyword checks:
User message received:           0ms
LangGraph agent processing:      500-2000ms
Inline evaluation (regex):       1-5ms
Response sent to user:           Total ~1-3s (negligible impact)

With inline LLM judge:
User message received:           0ms
LangGraph agent processing:      500-2000ms
Inline LLM evaluation:           500-2000ms
Response sent to user:           Total ~2-5s (significant impact)

With inline LLM judge + retry on failure:
User message received:           0ms
First attempt + evaluation:      1-4s
Retry (if failed):               1-4s additional
Response sent to user:           Total ~2-8s (worst case)
```

**Verdict**: Inline regex/keyword checks are essentially free. Inline LLM checks roughly double the response time. Retries can triple it. This is why the hybrid approach -- fast inline + async LLM -- is recommended.

### Monitoring and Alerting Patterns

#### Dashboard Metrics to Track

```python
# Metrics to emit from the evaluation pipeline

# Inline evaluation metrics
INLINE_PASS_RATE = "sidekick.inline_eval.pass_rate"           # % of responses passing inline
INLINE_BLOCK_RATE = "sidekick.inline_eval.block_rate"         # % blocked by inline checks
INLINE_RETRY_RATE = "sidekick.inline_eval.retry_rate"         # % that needed a retry
INLINE_LATENCY_P95 = "sidekick.inline_eval.latency_p95"      # p95 inline check latency

# Async evaluation metrics
ASYNC_HALLUCINATION_RATE = "sidekick.async_eval.hallucination_rate"    # % flagged as hallucination
ASYNC_QUALITY_MEAN = "sidekick.async_eval.quality_mean"                # Mean quality score
ASYNC_FIELD_ERROR_RATE = "sidekick.async_eval.field_error_rate"        # % with invalid fields
ASYNC_TECHNICAL_LEAK_RATE = "sidekick.async_eval.technical_leak_rate"  # % with leaked data (caught async)
```

#### Alert Thresholds

```yaml
alerts:
  - name: "High inline block rate"
    metric: INLINE_BLOCK_RATE
    threshold: "> 10%"  # More than 10% of responses blocked
    window: "1 hour"
    action: "notify_slack"
    meaning: "Agent is producing many bad responses -- check prompt or model"

  - name: "Inline latency spike"
    metric: INLINE_LATENCY_P95
    threshold: "> 50ms"  # Inline checks should be <10ms
    window: "15 minutes"
    action: "notify_slack"
    meaning: "Something is slow in the evaluation pipeline"

  - name: "Async hallucination spike"
    metric: ASYNC_HALLUCINATION_RATE
    threshold: "> 5%"
    window: "1 hour"
    action: "notify_slack + annotation_queue"
    meaning: "Agent is hallucinating more than expected -- route to human review"

  - name: "Technical data in async"
    metric: ASYNC_TECHNICAL_LEAK_RATE
    threshold: "> 0%"
    window: "1 hour"
    action: "notify_slack + urgent_review"
    meaning: "Inline checks missed a technical data leak -- update regex patterns"
```

### LangSmith Integration Pattern

#### Complete Integration

```python
from langsmith import Client, traceable
from langsmith.run_helpers import get_current_run_tree
import asyncio

client = Client()

@traceable(name="sidekick-agent")
async def handle_user_message(user_message: str) -> str:
    """Main Sidekick handler with hybrid evaluation."""

    # Get the current LangSmith run for feedback attachment
    run_tree = get_current_run_tree()

    # Step 1: Generate agent response (traced automatically)
    agent_result = await generate_response(user_message)
    response = agent_result["message"]
    tool_calls = agent_result.get("tool_calls", [])

    # Step 2: Inline evaluation (fast, blocking)
    pipeline = HybridEvaluationPipeline()
    inline_result = await pipeline.evaluate_inline(response)

    if not inline_result["passed"]:
        # Log the failure
        if run_tree:
            client.create_feedback(
                run_id=run_tree.id,
                key="inline_block",
                score=0,
                comment=inline_result["reason"],
            )

        # Retry with feedback
        retry_result = await generate_response(
            user_message,
            system_addendum=f"IMPORTANT: Your previous response was blocked because: {inline_result['reason']}. Please provide a clean, user-friendly response without any technical data.",
        )
        response = retry_result["message"]

        # Re-evaluate the retry
        retry_eval = await pipeline.evaluate_inline(response)
        if not retry_eval["passed"]:
            response = "I've processed your request. Would you like me to describe what was changed?"

    # Step 3: Async evaluation (non-blocking, fire and forget)
    if run_tree:
        asyncio.create_task(
            pipeline.evaluate_async(
                run_id=str(run_tree.id),
                response=response,
                context={
                    "user_message": user_message,
                    "tool_calls": tool_calls,
                    "is_edit_operation": any(
                        tc.get("name", "").startswith("update_") for tc in tool_calls
                    ),
                },
            )
        )

    return response
```

## Use Cases Relevant to This Project

### 1. Blocking Raw JSON Responses (Inline)
The most critical check. Use inline regex to catch JSON patterns before the response reaches the user. Latency impact: ~1ms.

### 2. Hallucination Detection (Async)
Check whether the agent accurately describes what happened during tool calls. Too slow for inline (~1-2s per check), but critical for quality monitoring.

### 3. Field Name Validation (Inline for known fields, Async for edge cases)
Known internal field names can be checked inline via blocklist. Edge cases (e.g., "the headline.text property" -- is that technical?) can be checked async with an LLM.

### 4. Response Quality Trending (Async)
Track quality scores over time to detect drift. Run quality scoring on 100% of production traces asynchronously.

### 5. Human Review Routing (Async)
Use async evaluation scores to automatically route low-quality responses to a LangSmith annotation queue for human review.

### 6. A/B Testing (Async)
When testing a new prompt version, run both versions and compare quality scores asynchronously without impacting user latency.

## Tradeoffs

| Aspect | Inline | Async | Hybrid |
|--------|--------|-------|--------|
| **Latency impact** | Direct (adds to response time) | None | Minimal (fast checks only) |
| **Prevention** | Yes (blocks bad responses) | No (detects after the fact) | Partial (blocks obvious issues) |
| **Coverage** | Limited by latency budget | Unlimited | Broad |
| **Cost per request** | Regex: free. LLM: $0.001-0.01 | LLM: $0.001-0.01 (no urgency) | Regex: free + async LLM |
| **Complexity** | Simple (add node to graph) | Moderate (async tasks, LangSmith rules) | Higher (both systems) |
| **Failure handling** | Retry or fallback needed | Alert and review | Both |
| **Suitable checks** | Regex, keyword, length, schema | LLM judge, quality scoring, hallucination | Fast inline + slow async |
| **Debugging** | Results visible in real-time | Results visible in LangSmith after delay | Both |

### Latency Budget Allocation

For a Sidekick response with a 5-second latency budget:

```
LLM generation:          2000ms (fixed, cannot reduce without model change)
Tool calls:              1000ms (variable, depends on operation)
Inline evaluation:         5ms (regex + blocklist)
Network overhead:        100ms
Remaining for user:     1895ms (comfortable margin)

If adding inline LLM judge:
LLM judge:              1000ms (eats into margin)
Remaining:               895ms (tight but acceptable for critical checks)
```

### Cost Analysis

Assuming 1,000 Sidekick interactions per day:

```
Inline regex only:          $0/day
Inline LLM judge (all):     1000 * $0.003 = $3/day ($90/month)
Async LLM judge (all):      1000 * $0.003 = $3/day ($90/month)
Async LLM judge (10% sample): 100 * $0.003 = $0.30/day ($9/month)
Hybrid (regex inline + async LLM 100%): $3/day ($90/month)
Hybrid (regex inline + async LLM 25%):  $0.75/day ($22.50/month)
```

## Recommended Approach for This Project

### Phase 1: Inline Fast Checks (Week 1)

Add a deterministic evaluation node to the LangGraph pipeline:

1. **Regex patterns** for JSON detection, MongoDB operators, error traces.
2. **Keyword blocklist** for internal field names from the brick schema.
3. **Length threshold** to catch data dumps.
4. **Retry logic**: On failure, regenerate with feedback prompt. Max 2 retries, then fallback.

Expected latency impact: <5ms. Expected catch rate: 90%+ of technical data leakage.

### Phase 2: Async LLM Checks via LangSmith (Week 2-3)

Configure online evaluation in LangSmith:

1. **Rule Automation**: Run hallucination check (OpenEvals) on 100% of production traces.
2. **Rule Automation**: Run response quality check on 100% of traces.
3. **Alert rule**: If quality score drops below threshold, notify Slack.
4. **Routing rule**: Send low-scoring responses to annotation queue for human review.

Expected latency impact: Zero. Cost: ~$90/month at 1,000 interactions/day.

### Phase 3: Promote Critical Async Checks to Inline (Month 2)

Based on data from Phase 2, identify which async checks catch issues that regex misses:

1. If hallucination rate is significant, add inline hallucination check (GPT-4o-mini) for edit operations only.
2. If field validity issues persist, add inline field validation with the brick schema as context.
3. Measure the latency impact and user satisfaction before/after.

### Phase 4: Continuous Improvement Loop (Ongoing)

1. Export flagged responses from annotation queue to regression test dataset.
2. Run offline evaluation on prompt changes using the growing dataset.
3. Update regex patterns when async checks catch new leakage patterns.
4. Tune LLM judge prompts based on human correction data (LangSmith Align Evals).

## Sources

- LangSmith Evaluation docs: https://docs.langchain.com/langsmith/evaluation
- LangSmith Evaluation concepts: https://docs.langchain.com/langsmith/evaluation-concepts
- LangSmith Rule Automations: https://docs.smith.langchain.com/observability/how_to_guides/rules
- LangSmith Observability: https://www.langchain.com/langsmith/observability
- LangGraph Graph API: https://docs.langchain.com/oss/python/langgraph/graph-api
- LangGraph conditional edges: https://dev.to/jamesli/advanced-langgraph-implementing-conditional-edges-and-tool-calling-agents-3pdn
- LangGraph async execution: https://www.baihezi.com/mirrors/langgraph/how-tos/async/index.html
- LangGraph best practices: https://www.swarnendu.de/blog/langgraph-best-practices/
- Adding output validation to LangGraph: https://dev.to/srijith/adding-output-validation-to-your-langgraph-agent-with-rynko-flow-41mi
- Langfuse LangGraph integration: https://langfuse.com/guides/cookbook/integration_langgraph
- Modelmetry guardrails latency: https://modelmetry.com/blog/latency-of-llm-guardrails
- ZenML LLMOps production patterns: https://www.zenml.io/blog/what-1200-production-deployments-reveal-about-llmops-in-2025
- ZenML agent deployment gap: https://www.zenml.io/blog/the-agent-deployment-gap-why-your-llm-loop-isnt-production-ready-and-what-to-do-about-it
- Cobbai latency calculator: https://cobbai.com/blog/llm-latency-cost-calculator-support
- OpenEvals: https://github.com/langchain-ai/openevals
- Freeplay LLM assessment guide: https://freeplay.ai/blog/llm-evaluation
- Arxiv assessment-driven development: https://arxiv.org/html/2411.13768v3
