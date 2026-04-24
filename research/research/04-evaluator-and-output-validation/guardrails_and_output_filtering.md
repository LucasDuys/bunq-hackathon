# Guardrails and Output Filtering

## Summary

Guardrails are protective layers that intercept LLM inputs and outputs, applying validation rules to block or modify content before it reaches the user. For the Sidekick agent, guardrails can catch technical data leakage (raw JSON, schema objects, internal field names) and invalid brick edits without requiring a full LLM call for every check. This document covers two major frameworks (Guardrails AI and NVIDIA NeMo Guardrails) as well as lightweight non-LLM approaches (regex, keyword matching) that can run in under 10ms. The key insight is that a layered approach -- fast regex checks first, then heavier LLM-based checks only when needed -- minimizes latency while maximizing coverage.

## Key Concepts

- **Guard**: A wrapper around an LLM call that intercepts inputs and/or outputs, applying one or more validators before allowing data through.
- **Validator**: A specific check applied to content -- can be regex-based, ML-based, or LLM-based. Validators are composable and chainable.
- **Input Rail**: A guardrail that checks the user's input before it reaches the LLM (e.g., detecting prompt injection, blocking off-topic requests).
- **Output Rail**: A guardrail that checks the LLM's output before it reaches the user (e.g., blocking technical data, ensuring tone compliance).
- **Self-Check**: A pattern where a second LLM call assesses the first LLM's output against defined policies (NeMo Guardrails terminology).
- **Colang**: A domain-specific language created by NVIDIA for defining conversational guardrails using canonical forms, bot messages, and flow blocks.
- **Guardrails Hub**: A marketplace of pre-built validators maintained by the Guardrails AI community.
- **Short-Circuit Assessment**: Stopping the validation pipeline early if a fast check (regex, keyword) already determines the content is invalid, avoiding the cost of slower checks.
- **Parallel Rail Execution**: Running multiple independent guardrails simultaneously to reduce total latency to the slowest single check rather than the sum of all checks.

## How It Works

### Guardrails AI

Guardrails AI (https://github.com/guardrails-ai/guardrails) is an open-source Python framework that wraps LLM calls with configurable validators. It intercepts both inputs and outputs.

#### Installation and Setup

```bash
# Install the package
pip install guardrails-ai

# Get a free API key from Guardrails Hub
# https://guardrailsai.com/hub

# Configure the CLI
guardrails configure
# Answer three setup questions:
# 1. Enable metrics reporting? (yes/no)
# 2. Use hosted inference endpoints? (yes/no)
# 3. Enter your API key
```

#### Installing Validators from Hub

Validators are installed individually from the Guardrails Hub marketplace:

```bash
# Install specific validators
guardrails hub install hub://guardrails/regex_match --quiet
guardrails hub install hub://guardrails/valid_length --quiet
guardrails hub install hub://guardrails/detect_pii --quiet
guardrails hub install hub://guardrails/toxic_language --quiet
```

#### Creating Guards for Output Validation

```python
from guardrails.hub import RegexMatch, ValidLength, DetectPII
from guardrails import Guard

# Simple regex-based guard
guard = Guard().use(
    RegexMatch(regex="^[A-Z][a-z]*$"),
    on="output"
)

# Multiple validators chained together
guard = Guard().use_many(
    ValidLength(min=10, max=500),
    DetectPII(pii_entities=["EMAIL_ADDRESS", "PHONE_NUMBER"]),
    on="output"
)

# Validate a response
result = guard.validate(agent_response)
if result.validation_passed:
    send_to_user(result.validated_output)
else:
    handle_failure(result.error)
```

#### Structured Output Validation with Pydantic

```python
from pydantic import BaseModel, Field
from guardrails import Guard

class BrickEditResponse(BaseModel):
    """Expected structure for brick edit responses."""
    message: str = Field(description="User-friendly description of what changed")
    success: bool = Field(description="Whether the edit was successful")

guard = Guard.for_pydantic(output_class=BrickEditResponse)
result = guard(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Change the headline to Summer Sale"}],
)
# The guard ensures the output matches the Pydantic schema
# and rejects responses with extra fields like raw JSON
```

#### Available Validators on the Hub

Key validators relevant to the Sidekick agent:

| Validator | What It Does | Latency |
|-----------|-------------|---------|
| `RegexMatch` | Matches content against a regex pattern | <1ms |
| `ValidLength` | Ensures text length is within bounds | <1ms |
| `DetectPII` | Detects email, phone, SSN, credit card numbers | 5-50ms |
| `ToxicLanguage` | Flags offensive or harmful content | 10-100ms |
| `CompetitorCheck` | Flags mentions of competitor names | 1-5ms |
| `BannedWords` | Blocks specific words (with fuzzy matching) | 1-5ms |
| `BiasCheck` | Detects age, gender, ethnicity biases | 10-100ms |

#### Creating Custom Validators

For the Sidekick use case, you would likely need a custom validator:

```python
from guardrails.validators import Validator, register_validator

@register_validator(name="no_technical_data", data_type="string")
class NoTechnicalData(Validator):
    """Validates that response does not contain technical data."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Patterns that indicate technical data leakage
        self.patterns = [
            r'\{["\']?\w+["\']?\s*:',           # JSON objects
            r'\[[\s]*\{',                         # JSON arrays of objects
            r'\$(?:set|push|pull|match|unwind)',   # MongoDB operators
            r'(?:_id|objectId|brickType)\b',      # Internal field names
            r'\/api\/v\d+\/',                     # API paths
            r'(?:Error|TypeError|ReferenceError)\s*:', # Error types
        ]

    def validate(self, value, metadata=None):
        import re
        for pattern in self.patterns:
            match = re.search(pattern, value)
            if match:
                return FailResult(
                    error_message=f"Response contains technical data: {match.group()}",
                    fix_value=None,  # Cannot auto-fix; needs regeneration
                )
        return PassResult()
```

### NVIDIA NeMo Guardrails

NeMo Guardrails (https://github.com/NVIDIA-NeMo/Guardrails) is an open-source toolkit that adds programmable guardrails to LLM-based conversational systems. It uses a different architecture from Guardrails AI, centered on the Colang domain-specific language and semantic matching.

#### Architecture

NeMo Guardrails acts as a protective layer between users and the LLM. The system uses "a semi or fully deterministic shield" to manage chatbot behavior through semantic matching and predefined flows. All utterances are encoded into a vector space using a sentence transformer (MiniLM by default). User inputs are matched against canonical forms to trigger appropriate flows.

#### Configuration

NeMo requires two files:

**config.yml** - Specifies the LLM and rails:

```yaml
models:
  - type: main
    engine: openai
    model: gpt-4o-mini

rails:
  output:
    flows:
      - self check output
      - self check facts
```

**prompts.yml** - Defines the self-check prompts:

```yaml
- task: self_check_output
  content: |
    Your task is to check if the bot message below complies with the
    company policy.

    Company policy for the bot:
    - messages should not contain raw JSON objects or arrays
    - messages should not expose internal database field names
    - messages should not contain MongoDB query operators
    - messages should not reference internal API endpoints
    - messages should use plain, non-technical language
    - messages should be helpful and friendly to marketing users
    - if a message describes an edit, it should use user-friendly
      field names (e.g., "headline" not "headline.text.value")

    Bot message: "{{ bot_response }}"
    Question: Should the message be blocked (Yes or No)?
    Answer:
```

#### Output Rails with Streaming

NeMo supports output guardrails on streaming responses, buffering tokens and checking chunks:

```yaml
rails:
  output:
    flows:
      - self check output
    streaming:
      enabled: True
      chunk_size: 200     # Check every 200 tokens
      context_size: 50    # Include 50 tokens of context
```

With streaming enabled, tokens are immediately sent to the user while simultaneously being buffered for moderation. When the buffer reaches `chunk_size`, guardrails are applied. If a violation is detected mid-stream, the stream can be interrupted.

#### Colang Flows for Custom Rails

```colang
define user ask about internal data
  "Show me the raw JSON"
  "What's the schema?"
  "Give me the API response"
  "Show the database fields"

define bot refuse internal data
  "I can describe what's in your campaign in plain language.
   What would you like to know about?"

define flow handle internal data requests
  user ask about internal data
  bot refuse internal data
```

#### Performance Characteristics of NeMo

NeMo uses "super fast semantic search" for rail/tool selection rather than additional LLM calls, significantly reducing latency. The self-check output rail, however, does require a separate LLM call, adding 0.5-2s of latency.

When orchestrating up to five GPU-accelerated guardrails in parallel, detection rate increases by 1.4x while adding only approximately 0.5 seconds of latency (per NVIDIA benchmarks).

### Lightweight Non-LLM Approaches

For the Sidekick agent's most common failure mode (raw JSON in responses), fast regex and keyword matching can catch the majority of issues without any LLM call.

#### Regex-Based Detection

```python
import re
from typing import List, Tuple

class TechnicalDataDetector:
    """Fast, deterministic detector for technical data in LLM responses."""

    PATTERNS: List[Tuple[str, str]] = [
        # JSON objects and arrays
        (r'\{["\']?\w+["\']?\s*:', "JSON object detected"),
        (r'\[\s*\{', "JSON array of objects detected"),
        (r'"type"\s*:\s*"(?:string|number|boolean|object|array)"', "JSON Schema type detected"),

        # MongoDB operators
        (r'\$(?:set|push|pull|match|unwind|group|lookup|project|sort|limit|skip)',
         "MongoDB operator detected"),

        # Internal field names (customize per your schema)
        (r'\b(?:_id|objectId|brickId|brickType|templateId|campaignId)\b',
         "Internal field name detected"),
        (r'\b\w+\.\w+\.\w+\b',  # dot-notation paths like "headline.text.value"
         "Dot-notation field path detected"),

        # API/technical artifacts
        (r'\/api\/v\d+\/', "API path detected"),
        (r'(?:Error|TypeError|ReferenceError|SyntaxError)\s*:', "Error type detected"),
        (r'at\s+\w+\s+\(.*:\d+:\d+\)', "Stack trace detected"),
        (r'(?:Bearer|Basic)\s+[A-Za-z0-9+/=]+', "Auth token detected"),

        # Schema/type definitions
        (r'(?:interface|type|enum)\s+\w+\s*\{', "TypeScript type definition detected"),
        (r'required:\s*\[', "Schema required field detected"),
    ]

    def check(self, text: str) -> dict:
        """Returns detection result in under 1ms for typical responses."""
        violations = []
        for pattern, description in self.PATTERNS:
            matches = re.findall(pattern, text)
            if matches:
                violations.append({
                    "pattern": pattern,
                    "description": description,
                    "matches": matches[:3],  # limit for readability
                })

        return {
            "passed": len(violations) == 0,
            "violations": violations,
            "latency_ms": "<1",
        }
```

#### Keyword/Blocklist Matching

```python
class FieldNameBlocklist:
    """Blocks responses containing internal field names."""

    # Internal field names that should never appear in user-facing responses
    BLOCKED_TERMS = {
        # MongoDB/database terms
        "_id", "objectId", "ObjectId", "__v", "createdAt", "updatedAt",

        # Internal brick field names
        "brickType", "brickId", "templateId", "campaignId",
        "parentBrick", "childBricks", "brickConfig",

        # Schema terms
        "enum", "oneOf", "allOf", "anyOf", "$ref",

        # API internals
        "statusCode", "errorCode", "stackTrace",
    }

    # Technical terms that suggest data leakage (case-insensitive)
    SUSPICIOUS_TERMS = {
        "schema", "endpoint", "payload", "middleware",
        "serialization", "deserialization", "mutex",
        "callback", "webhook url", "api key",
    }

    def check(self, text: str) -> dict:
        """Fast blocklist check using set intersection."""
        words = set(text.split())
        blocked_found = words.intersection(self.BLOCKED_TERMS)

        text_lower = text.lower()
        suspicious_found = [
            term for term in self.SUSPICIOUS_TERMS
            if term in text_lower
        ]

        return {
            "passed": len(blocked_found) == 0 and len(suspicious_found) == 0,
            "blocked_terms": list(blocked_found),
            "suspicious_terms": suspicious_found,
        }
```

#### Aho-Corasick for Multi-Pattern Matching

For matching many patterns simultaneously with O(n) complexity (n = text length):

```python
# pip install pyahocorasick
import ahocorasick

class FastMultiPatternMatcher:
    """Uses Aho-Corasick algorithm for O(n) multi-pattern matching."""

    def __init__(self, blocked_terms: list):
        self.automaton = ahocorasick.Automaton()
        for idx, term in enumerate(blocked_terms):
            self.automaton.add_word(term, (idx, term))
        self.automaton.make_automaton()

    def check(self, text: str) -> dict:
        """Scans entire text in a single pass."""
        violations = []
        for end_index, (idx, term) in self.automaton.iter(text):
            violations.append({
                "term": term,
                "position": end_index - len(term) + 1,
            })
        return {
            "passed": len(violations) == 0,
            "violations": violations,
        }

# Usage
matcher = FastMultiPatternMatcher([
    "_id", "objectId", "brickType", "templateId",
    "$set", "$push", "$match", "statusCode",
])
result = matcher.check(agent_response)
```

#### Lightweight ML Model Approaches

For detecting technical data patterns that are harder to catch with regex:

```python
# Using a small classifier (e.g., a distilled BERT or even a logistic regression
# trained on technical vs. non-technical text)

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
import joblib

class TechnicalContentClassifier:
    """Small ML model to detect technical content. ~5-10ms inference."""

    def __init__(self, model_path: str):
        self.model = joblib.load(model_path)
        self.vectorizer = joblib.load(model_path + ".vectorizer")

    def check(self, text: str) -> dict:
        features = self.vectorizer.transform([text])
        prediction = self.model.predict(features)[0]
        probability = self.model.predict_proba(features)[0]

        return {
            "passed": prediction == "non_technical",
            "confidence": float(max(probability)),
            "label": prediction,
        }
```

### Layered Guard Architecture

The recommended pattern is to layer guards from fastest to slowest, short-circuiting when a violation is found:

```python
class LayeredOutputGuard:
    """Layered guard: fast checks first, LLM judge only if needed."""

    def __init__(self):
        self.regex_detector = TechnicalDataDetector()
        self.blocklist = FieldNameBlocklist()
        self.llm_judge = None  # initialized lazily

    async def check(self, response: str, context: dict = None) -> dict:
        # Layer 1: Regex patterns (~1ms)
        regex_result = self.regex_detector.check(response)
        if not regex_result["passed"]:
            return {
                "passed": False,
                "layer": "regex",
                "reason": regex_result["violations"][0]["description"],
                "latency_ms": 1,
            }

        # Layer 2: Keyword blocklist (~1ms)
        blocklist_result = self.blocklist.check(response)
        if not blocklist_result["passed"]:
            return {
                "passed": False,
                "layer": "blocklist",
                "reason": f"Blocked terms: {blocklist_result['blocked_terms']}",
                "latency_ms": 1,
            }

        # Layer 3: LLM judge for edge cases (~500-1500ms)
        # Only reached if fast checks pass (most responses)
        if self._needs_llm_check(response):
            llm_result = await self._run_llm_judge(response, context)
            return {
                "passed": llm_result["verdict"] == "PASS",
                "layer": "llm_judge",
                "reason": llm_result.get("reasoning"),
                "latency_ms": llm_result.get("latency_ms", 1000),
            }

        return {"passed": True, "layer": "all_passed", "latency_ms": 2}

    def _needs_llm_check(self, response: str) -> bool:
        """Heuristic: does the response have characteristics that
        warrant a deeper LLM check?"""
        # Check for semi-technical language that regex might miss
        suspicious_phrases = [
            "field", "property", "value is", "set to",
            "configuration", "parameter", "attribute"
        ]
        count = sum(1 for phrase in suspicious_phrases if phrase in response.lower())
        return count >= 2  # Multiple suspicious phrases trigger LLM check
```

## Use Cases Relevant to This Project

### 1. Blocking Raw JSON in Agent Responses

The primary use case. The Sidekick agent sometimes returns the raw tool call response (a JSON object) instead of a natural language summary.

**Implementation**: Regex layer catches `{...}` patterns and `[{...}]` array patterns. Blocklist layer catches internal field names. Combined, these catch 90%+ of leakage cases in under 2ms.

### 2. Blocking Internal Field Names

When the agent describes brick edits, it sometimes uses internal field names (e.g., "headline.text.value" instead of "headline text").

**Implementation**: Maintain a blocklist of all internal field names from the brick schema. Use Aho-Corasick for fast multi-pattern matching. Update the blocklist when the schema changes.

### 3. PII Detection

Marketing campaigns may contain customer data. The agent should not expose PII in its responses.

**Implementation**: Use Guardrails AI's `DetectPII` validator, which detects email addresses, phone numbers, names, addresses, SSNs, and credit card numbers.

### 4. Response Length Limits

Prevent the agent from returning excessively long responses that could indicate dumping of raw data.

**Implementation**: Simple length check. If the response exceeds a threshold (e.g., 2000 characters), flag for review.

### 5. Streaming Output Filtering

If the Sidekick agent uses streaming responses, NeMo Guardrails' streaming output rails can check chunks in real-time, interrupting the stream if technical data is detected.

## Tradeoffs

### Guardrails AI vs. NeMo Guardrails

| Aspect | Guardrails AI | NeMo Guardrails |
|--------|--------------|----------------|
| **Architecture** | Validator-based, wraps LLM calls | Flow-based, uses Colang DSL |
| **Setup complexity** | Low (pip install, use validators) | Medium (learn Colang, config files) |
| **Customization** | Python validators, easy to extend | Colang flows, more structured |
| **Streaming support** | Limited | Built-in, with chunk-based checking |
| **Self-check pattern** | Via LLM-based validators | Native with `self check output` flow |
| **Community/Hub** | Large validator marketplace | Smaller, NVIDIA-maintained |
| **Performance** | Depends on validators used | Semantic search is fast; self-check adds LLM call |
| **Best for** | Output schema validation, composable checks | Conversational flows, topic control |
| **Language** | Python | Python + Colang |

### Regex/Keyword vs. LLM-Based Guardrails

| Aspect | Regex/Keyword | LLM-Based |
|--------|--------------|-----------|
| **Latency** | <5ms | 500-3000ms |
| **Cost** | Zero (no API calls) | Per-call LLM cost |
| **Accuracy** | High for known patterns | Higher for nuanced/novel patterns |
| **False positives** | Can be high if patterns are too broad | Lower (understands context) |
| **False negatives** | Misses novel patterns | Catches unforeseen issues |
| **Maintenance** | Must update patterns manually | Prompt updates only |
| **Determinism** | Fully deterministic | Non-deterministic |

### Latency Benchmarks (from Modelmetry)

| Guardrail Category | Latency Range | Examples |
|-------------------|---------------|----------|
| **Basic** (regex, keywords, length) | 5-10ms | Keyword filters, regex checks |
| **Moderate** (ML models, rule engines) | 20-50ms | Toxicity detection, prompt injection |
| **Comprehensive** (LLM-based) | 1-5 seconds | Self-check output, deep content analysis |

The recommended approach is to use basic guardrails (5-10ms) as the primary inline filter, with moderate guardrails (20-50ms) for sensitive content, and comprehensive guardrails (1-5s) only asynchronously or for high-risk scenarios.

### Parallel vs. Sequential Execution

From the Modelmetry benchmarks:
- **Sequential**: Total latency = sum of all guardrail latencies
- **Parallel** (using `asyncio.gather`): Total latency = latency of slowest guardrail
- **Short-circuit**: Can be faster than either if a fast check catches the issue

Example for the Sidekick agent:

```
Sequential: regex(1ms) + blocklist(1ms) + PII(50ms) + LLM(1000ms) = 1052ms
Parallel:   max(regex(1ms), blocklist(1ms), PII(50ms), LLM(1000ms)) = 1000ms
Short-circuit: regex(1ms) -> FAIL -> stop = 1ms
```

## Recommended Approach for This Project

### Architecture: Layered Guards with Short-Circuit

```
Agent Response
    |
    v
[Layer 1: Regex Patterns] (~1ms)
    |-- FAIL --> Regenerate response
    |-- PASS --> continue
    v
[Layer 2: Keyword Blocklist] (~1ms)
    |-- FAIL --> Regenerate response
    |-- PASS --> continue
    v
[Layer 3: Heuristic Check] (~1ms)
    |-- LOW RISK --> Send to user (skip LLM judge)
    |-- MEDIUM/HIGH RISK --> continue to Layer 4
    v
[Layer 4: LLM Judge] (~500ms, only for flagged responses)
    |-- FAIL --> Regenerate response
    |-- PASS --> Send to user
```

### Implementation Plan

**Immediate (Week 1-2)**:
1. Implement `TechnicalDataDetector` with regex patterns specific to the Sidekick agent's known failure modes.
2. Build `FieldNameBlocklist` from the brick schema's internal field names.
3. Add these as a guard step in the LangGraph pipeline, before the response reaches the user.
4. Log all blocked responses to LangSmith for analysis.

**Short-term (Week 3-4)**:
5. Add the heuristic layer that decides whether an LLM judge check is needed.
6. Implement the LLM judge layer using GPT-4o-mini with the technical data leakage prompt.
7. Measure the false positive and false negative rates of each layer.

**Medium-term (Month 2)**:
8. Consider Guardrails AI for additional validators (PII detection, response length).
9. If streaming is added to Sidekick, consider NeMo Guardrails for streaming output filtering.
10. Build a custom Guardrails Hub validator for the Sidekick-specific patterns and contribute it internally.

### Why Not Just Use an LLM for Everything?

Running an LLM judge on every response adds 500-3000ms of latency and costs money per call. For the Sidekick agent, the technical data leakage patterns are well-defined enough that regex catches 90%+ of cases in under 1ms. Reserve the LLM judge for edge cases and new/unknown patterns. The hybrid approach gives you the speed of regex with the intelligence of an LLM when needed.

## Sources

- Guardrails AI documentation: https://www.guardrailsai.com/docs
- Guardrails AI GitHub: https://github.com/guardrails-ai/guardrails
- Guardrails AI quickstart: https://www.guardrailsai.com/docs/getting_started/quickstart
- Guardrails Hub: https://guardrailsai.com/hub
- Guardrails AI PII detection: https://hub.guardrailsai.com/validator/guardrails/guardrails_pii
- Guardrails AI validator template: https://github.com/guardrails-ai/validator-template
- NVIDIA NeMo Guardrails: https://github.com/NVIDIA-NeMo/Guardrails
- NeMo Guardrails developer guide: https://docs.nvidia.com/nemo/guardrails/latest/index.html
- NeMo Guardrails output rails: https://docs.nvidia.com/nemo/guardrails/latest/getting-started/5-output-rails/README.html
- NeMo Guardrails streaming: https://developer.nvidia.com/blog/stream-smarter-and-safer-learn-how-nvidia-nemo-guardrails-enhance-llm-output-streaming/
- Pinecone NeMo Guardrails guide: https://www.pinecone.io/learn/nemo-guardrails-intro/
- Modelmetry guardrails latency: https://modelmetry.com/blog/latency-of-llm-guardrails
- NVIDIA guardrails performance blog: https://developer.nvidia.com/blog/measuring-the-effectiveness-and-performance-of-ai-guardrails-in-generative-ai-applications/
- ActiveFence low-latency guardrails: https://www.activefence.com/blog/low-latency-ai-guardrails/
- LangChain guardrails integration: https://docs.langchain.com/oss/python/langchain/guardrails
- Guardrails AI blog on OpenTelemetry: https://www.guardrailsai.com/blog/opentelemetry-llm-performance
