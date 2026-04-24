# RAG and Retrieval Patterns

## Summary

Retrieval-Augmented Generation (RAG) is an architecture that augments a large language model's knowledge by retrieving relevant external documents at query time, rather than relying solely on the model's parametric memory. For the Sidekick brick editor agent, RAG is the primary alternative to loading entire campaign structures (50-200 bricks, up to 10k theoretical) directly into the context window. Understanding when RAG helps versus when full-context loading is sufficient is the single most important architectural decision for this project's performance.

## Key Concepts

- **Parametric vs Non-Parametric Memory**: LLMs have parametric memory (trained weights) and can be augmented with non-parametric memory (retrieved documents). RAG combines both.
- **Embeddings**: Text is converted into dense vector representations (typically 768-1536 dimensions) that capture semantic meaning. Similar texts have vectors close together in embedding space.
- **Vector Store**: A database optimized for storing embeddings and performing fast similarity search (nearest-neighbor lookup).
- **Retriever**: The component that takes a query, converts it to an embedding, and finds the top-k most relevant document chunks from the vector store.
- **Generator**: The LLM that receives the user query plus retrieved context and produces the final response.
- **Chunking**: The process of breaking documents into smaller pieces for indexing. Chunk size affects retrieval precision and context quality.
- **Top-k Retrieval**: Returning the k most similar documents to a query. Typical values range from 3-20.
- **Rank Fusion**: Combining results from multiple retrieval methods (e.g., semantic search + keyword search) into a single ranked list.
- **Contextual Retrieval**: Anthropic's technique of prepending explanatory context to each chunk before embedding, reducing retrieval failures by up to 67%.
- **Reranking**: A second-pass filtering step that uses a more expensive model to re-score retrieved candidates for relevance.

## How It Works

### The Original RAG Architecture (Lewis et al., 2020)

The foundational RAG paper, "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," was published at NeurIPS 2020 by researchers at Meta AI. It introduced a general-purpose fine-tuning approach that endows pre-trained, parametric-memory generation models with a non-parametric memory through retrieval.

The original architecture:

1. **Document Encoder**: Converts each document in the knowledge base into a dense vector embedding using a Dense Passage Retriever (DPR).
2. **Query Encoder**: Transforms the input query into a corresponding dense vector embedding.
3. **Retrieval**: Matches the query embedding against document embeddings using dot-product similarity.
4. **Generation**: A pre-trained seq2seq transformer (BART) receives the query concatenated with retrieved documents and generates the output.

The paper demonstrated two variants:
- **RAG-Sequence**: Uses the same retrieved documents for the entire output sequence.
- **RAG-Token**: Can use different retrieved documents for each output token, providing more flexibility.

Results showed RAG outperformed parametric-only models on open-domain QA tasks and generated more specific, diverse, and factual language.

### Modern RAG Pipeline (2024-2025)

Modern RAG systems have evolved significantly from the original architecture. A current production pipeline typically follows these steps:

**Step 1: Data Preparation (Indexing)**
```
Raw Data --> Document Loader --> Text Splitter --> Embedding Model --> Vector Store
```

- Documents are loaded from various sources (databases, files, APIs).
- Text splitters break documents into chunks (typically 200-500 tokens each).
- An embedding model (e.g., OpenAI text-embedding-3-small, Cohere embed-v3) converts chunks to vectors.
- Vectors are stored in a vector database with associated metadata.

**Step 2: Query Processing (Retrieval)**
```
User Query --> Query Embedding --> Similarity Search --> Top-k Chunks --> (Optional) Reranking --> Filtered Chunks
```

- The user's query is embedded using the same embedding model.
- Vector similarity search returns the top-k candidate chunks.
- Optionally, a reranker (e.g., Cohere Rerank, cross-encoder model) re-scores and filters candidates.

**Step 3: Augmented Generation**
```
System Prompt + Retrieved Chunks + User Query --> LLM --> Response
```

- The filtered chunks are injected into the LLM prompt alongside the original query.
- The LLM generates a response grounded in the retrieved context.

### Anthropic's Contextual Retrieval

Anthropic published a significant improvement to standard RAG in September 2024 called "Contextual Retrieval." The key insight is that standard chunking loses important context — a chunk saying "the company's revenue grew by 3%" is meaningless without knowing which company and which time period.

**How it works:**

1. For every chunk in the knowledge base, use Claude to generate a short (50-100 token) context snippet that situates the chunk within the overall document.
2. Prepend this context to the chunk before embedding and indexing.
3. Create both TF-IDF/BM25 indices and semantic embeddings for the contextualized chunks.
4. At query time, combine BM25 (exact match) and embedding (semantic) retrieval using rank fusion.
5. Optionally apply reranking to the combined results.

**Example transformation:**
```
Original chunk:
"The company's revenue grew by 3% over the previous quarter."

Contextualized chunk:
"This chunk is from an SEC filing on ACME corp's performance in Q2 2023;
the previous quarter's revenue was $314 million. The company's revenue
grew by 3% over the previous quarter."
```

**Performance improvements (measured on top-20 retrieval failure rate):**
- Standard embeddings only: 5.7% failure rate (baseline)
- Contextual embeddings alone: 3.7% failure rate (35% reduction)
- Contextual embeddings + contextual BM25: 2.9% failure rate (49% reduction)
- Contextual embeddings + contextual BM25 + reranking: 1.9% failure rate (67% reduction)

**Cost**: Using prompt caching, contextualization costs approximately $1.02 per million document tokens as a one-time preprocessing cost.

### Agentic RAG (LangGraph Pattern)

In agent-based systems like Sidekick, RAG can be integrated as a tool that the agent decides when to invoke, rather than being a fixed pipeline:

```python
# Conceptual LangGraph agentic RAG pattern
from langgraph.graph import StateGraph

def should_retrieve(state):
    """Agent decides if retrieval is needed based on the query."""
    # Simple queries might not need retrieval
    # Complex queries trigger vector search
    return "retrieve" if state["needs_context"] else "respond"

def retrieve_node(state):
    """Retrieve relevant bricks/ad groups from vector store."""
    query = state["query"]
    docs = retriever.invoke(query)
    return {"context": docs}

def generate_node(state):
    """Generate response using retrieved context."""
    response = llm.invoke(
        system_prompt + state["context"] + state["query"]
    )
    return {"response": response}

graph = StateGraph()
graph.add_node("router", should_retrieve)
graph.add_node("retrieve", retrieve_node)
graph.add_node("generate", generate_node)
graph.add_edge("router", "retrieve", condition="retrieve")
graph.add_edge("router", "generate", condition="respond")
graph.add_edge("retrieve", "generate")
```

This pattern allows the agent to dynamically decide when retrieval is needed rather than always retrieving, which reduces unnecessary latency for simple queries.

## Use Cases Relevant to This Project

### Use Case 1: Brick Editor — Finding Specific Bricks to Edit
When a user says "change the headline on the summer sale brick," the agent needs to find the specific brick(s) matching "summer sale." RAG can retrieve the relevant brick(s) by semantic similarity rather than loading all 200 bricks into context.

**RAG advantage**: Only loads 3-5 relevant bricks instead of 200. Reduces token usage by 95%+.

### Use Case 2: Cross-Brick Consistency Checks
When a user says "make sure all the CTA buttons use the same color," the agent needs to inspect a property across many bricks. RAG with metadata filtering can retrieve all bricks that have a CTA button element.

**RAG limitation**: This requires broad retrieval (potentially most bricks), where full-context loading may be simpler.

### Use Case 3: Campaign Structure Navigation
When a user asks "what ad groups are in this campaign and how many bricks does each have?" the agent needs structural/summary data. A hierarchical summary index or pre-computed metadata can answer this without loading individual brick details.

**Best pattern**: Hierarchical summary (campaign summary > ad group summaries) rather than RAG on individual bricks.

### Use Case 4: Large Campaign (1,000+ Bricks)
For campaigns at the theoretical ceiling of 10,000 bricks, full context loading is impossible (would exceed any context window). RAG becomes mandatory.

**RAG advantage**: Scales linearly regardless of campaign size. Retrieval latency stays constant.

## Tradeoffs

### Full Context Loading vs RAG

| Dimension | Full Context Loading | RAG |
|-----------|---------------------|-----|
| **Setup complexity** | Zero — just serialize and send | Requires embedding pipeline, vector store, chunking strategy |
| **Latency (first query)** | Higher — must process all tokens | Lower — only processes retrieved chunks |
| **Latency (subsequent queries)** | Lower with prompt caching (0.1x cost, 80% faster) | Constant — retrieval + generation each time |
| **Token cost per query** | High — pays for all tokens every time (or 0.1x with cache) | Low — only pays for retrieved chunks |
| **Accuracy on targeted queries** | Good — all data is available, but "lost in the middle" risk | Good — retrieves most relevant data, but may miss context |
| **Accuracy on broad queries** | Better — model sees everything | Worse — may miss relevant bricks not retrieved |
| **Scale ceiling** | ~200K tokens (~50-150 bricks depending on detail) | Unlimited — retrieves fixed number regardless of total |
| **Infrastructure** | None beyond API | Vector store, embedding model, retrieval pipeline |
| **Maintenance** | None — always fresh from DB | Must keep embeddings in sync with source data |

### Anthropic's Guidance: When RAG Is Unnecessary

Anthropic's own documentation states: "If your knowledge base is smaller than 200,000 tokens (about 500 pages of material), you can just include the entire knowledge base in the prompt that you give the model, with no need for RAG or similar methods."

With prompt caching, this approach becomes significantly faster and more cost-effective:
- Cache write: 1.25x base price (one-time per 5 minutes)
- Cache read: 0.1x base price (90% discount on every subsequent query)
- Latency reduction: Up to 80-85% on cached content

### RAG Approaches Compared

| Approach | Retrieval Quality | Latency | Cost | Complexity |
|----------|------------------|---------|------|------------|
| Standard embeddings only | Baseline | Low | Low | Low |
| BM25 + embeddings (hybrid) | +20-30% better | Low | Low | Medium |
| Contextual embeddings | +35% better | Low | Medium (preprocessing) | Medium |
| Contextual + BM25 + reranking | +67% better | Medium (reranking step) | Medium | High |
| Agentic RAG (LangGraph) | Variable — agent decides | Variable | Variable | High |

### The "Lost in the Middle" Problem

Research by Liu et al. (2023) demonstrated that LLMs perform best when relevant information appears at the beginning or end of the input context, with significant accuracy degradation when critical details are buried in the middle. This was tested across models including Claude, GPT-3.5-Turbo, and others.

Key findings:
- Performance follows a U-shaped curve based on information position.
- The effect is worse as context length increases.
- Claude showed notably better robustness than other models on certain structured tasks (near-perfect on JSON retrieval tasks).

This means that simply stuffing all brick data into context is not guaranteed to work well — the agent may miss bricks in the middle of the list. RAG avoids this by only placing relevant bricks in context.

## Recommended Approach for This Project

**For typical campaigns (50-200 bricks): Use full context loading with prompt caching, supplemented by tool-based lazy retrieval.**

Here is the reasoning:

1. **50-200 bricks fit comfortably in context.** A typical brick serialized as JSON is roughly 200-500 tokens. At 200 bricks x 400 tokens = 80,000 tokens. This is well within the 200K context window and falls under Anthropic's guidance that RAG is unnecessary for knowledge bases under 200K tokens.

2. **Prompt caching eliminates the latency penalty.** The campaign structure can be cached in the system prompt. First request pays full price (~11.5s for 100K tokens). Subsequent requests read from cache (~2.4s). This directly addresses the 44-second response time problem.

3. **RAG adds complexity without proportional benefit at this scale.** Setting up a vector store, maintaining embedding sync with MongoDB, and managing the retrieval pipeline is significant engineering work for a small team. The retrieval quality gains do not justify this at 50-200 bricks.

4. **Use tool-based retrieval as a fallback for scale.** Implement a `get_brick_details` tool that the agent can call to fetch individual brick data from MongoDB on demand. This handles the 10,000-brick ceiling without requiring a full RAG infrastructure. The agent receives a lightweight campaign summary (campaign > ad groups > brick names/IDs) in context, and uses the tool to fetch full details only when needed.

5. **Reserve full RAG for if/when the 10K brick case becomes real.** If campaign sizes routinely exceed 500 bricks, invest in a proper RAG pipeline with contextual retrieval and hybrid search. Until then, the tool-based lazy retrieval pattern is simpler and sufficient.

**Implementation priority:**
1. Optimize context loading with prompt caching (immediate win)
2. Implement hierarchical summary (campaign summary in context, brick details via tool)
3. Add RAG infrastructure only if scale demands it

## Sources

- Lewis, P., et al. (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks." NeurIPS 2020. https://arxiv.org/abs/2005.11401
- Anthropic. "Introducing Contextual Retrieval." September 2024. https://www.anthropic.com/news/contextual-retrieval
- Anthropic. "Prompt Caching." Claude API Docs. https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Anthropic. "Retrieval augmented generation (RAG) for projects." Claude Help Center. https://support.claude.com/en/articles/11473015-retrieval-augmented-generation-rag-for-projects
- Anthropic. "Context Windows." Claude API Docs. https://platform.claude.com/docs/en/build-with-claude/context-windows
- Pinecone. "Beyond the hype: Why RAG remains essential for modern AI." 2025. https://www.pinecone.io/learn/rag-2025/
- LlamaIndex. "Towards Long Context RAG." https://www.llamaindex.ai/blog/towards-long-context-rag
- LangChain. "Build a RAG agent with LangChain." https://docs.langchain.com/oss/python/langchain/rag
- LangChain. "Build a custom RAG agent with LangGraph." https://docs.langchain.com/oss/python/langgraph/agentic-rag
- Elastic. "RAG vs long context model LLM." Elasticsearch Labs. https://www.elastic.co/search-labs/blog/rag-vs-long-context-model-llm
- Airbyte. "Large Context Windows in LLMs: Uses and Trade-Offs." https://airbyte.com/agentic-data/large-context-window
- IBM. "What is RAG (Retrieval Augmented Generation)?" https://www.ibm.com/think/topics/retrieval-augmented-generation
- DataCamp. "Anthropic's Contextual Retrieval: A Guide With Implementation." https://www.datacamp.com/tutorial/contextual-retrieval-anthropic
- Liu, N.F., et al. (2023). "Lost in the Middle: How Language Models Use Long Contexts." https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00638/119630/Lost-in-the-Middle-How-Language-Models-Use-Long
- Anthropic. "Prompt engineering for Claude's long context window." https://www.anthropic.com/news/prompting-long-context
- Medium (Abonia Sojasingarayar). "Summarization with LangChain." https://medium.com/@abonia/summarization-with-langchain-b3d83c030889
- Qdrant. "Agentic RAG with LangGraph." https://qdrant.tech/documentation/tutorials-build-essentials/agentic-rag-langgraph/
- RAGFlow. "The Rise and Evolution of RAG in 2024: A Year in Review." https://ragflow.io/blog/the-rise-and-evolution-of-rag-in-2024-a-year-in-review
- EdenAI. "The 2025 Guide to Retrieval-Augmented Generation (RAG)." https://www.edenai.co/post/the-2025-guide-to-retrieval-augmented-generation-rag
