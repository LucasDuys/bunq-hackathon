# Large Dataset Chunking Strategies

## Summary
When campaign data grows beyond what fits comfortably in a single LLM context, it must be broken into pieces (chunks) and either retrieved selectively or processed iteratively. For hierarchical data like campaigns > ad groups > bricks, the chunking strategy must respect the parent-child relationships or the agent loses structural context.

## Key Concepts
- **Chunking**: Splitting a large dataset into smaller units for retrieval or processing
- **Hierarchical indexing**: Organising chunks in a tree that mirrors the data's natural parent-child structure
- **Map-reduce**: A pattern where each chunk is processed independently (map), then results are combined (reduce)
- **Recursive summarisation**: Summarising leaf nodes first, then rolling those summaries up to parent nodes
- **Retrieval tree**: A LlamaIndex structure that stores summaries at multiple levels and retrieves at the right level based on query type
- **Chunk overlap**: Including a small amount of context from the previous chunk to avoid cutting mid-thought
- **Metadata filtering**: Restricting retrieval to chunks that match a filter (e.g., only ad group bricks, not campaign-level)

## How It Works

### Strategy 1: Hierarchical Summarisation (LlamaIndex Tree Index)

LlamaIndex's `TreeIndex` builds a bottom-up summary tree from leaf nodes:

```python
from llama_index.core import TreeIndex, Document

# Each brick becomes a Document
documents = []
for brick in campaign_bricks:
    doc = Document(
        text=f"Brick: {brick['title']}\nType: {brick['subType']}\nID: {brick['id']}",
        metadata={
            "brick_id": brick["id"],
            "parent_id": brick.get("parentId"),
            "sub_type": brick["subType"]
        }
    )
    documents.append(doc)

# Build tree — LlamaIndex summarises bottom-up automatically
index = TreeIndex.from_documents(documents)
query_engine = index.as_query_engine()

result = query_engine.query("What ad groups are in this campaign?")
```

The tree structure mirrors the campaign hierarchy:
- Level 0 (leaves): Individual bricks
- Level 1: Ad group summaries
- Level 2: Campaign summary
- Query routing: Broad questions hit level 2; specific questions drill to level 0

Source: https://docs.llamaindex.ai/en/stable/module_guides/indexing/tree_index/

### Strategy 2: Map-Reduce with LangChain

For summarising or analysing large campaigns in bulk:

```typescript
import { loadSummarizationChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

// Split bricks into chunks of 20
const chunkSize = 20;
const docs: Document[] = [];
for (let i = 0; i < bricks.length; i += chunkSize) {
    const chunk = bricks.slice(i, i + chunkSize);
    docs.push(new Document({
        pageContent: chunk.map(b => `${b.title} (${b.subType})`).join("\n"),
        metadata: { chunkIndex: i / chunkSize }
    }));
}

// Map: summarise each chunk
// Reduce: combine summaries into final answer
const chain = loadSummarizationChain(model, {
    type: "map_reduce",
    verbose: false
});

const result = await chain.invoke({ input_documents: docs });
console.log(result.text); // Final campaign summary
```

Source: https://js.langchain.com/docs/modules/chains/document/map_reduce

### Strategy 3: Recursive Summarisation for Hierarchy

For campaign structures specifically, summarise from leaves up:

```typescript
async function summariseCampaignHierarchy(bricks: Brick[]): Promise<string> {
    // Group bricks by parent
    const byParent: Record<string, Brick[]> = {};
    for (const brick of bricks) {
        const key = brick.parentId || "root";
        byParent[key] = byParent[key] || [];
        byParent[key].push(brick);
    }

    // Summarise each ad group (children of root campaigns)
    const adGroupSummaries: string[] = [];
    for (const [parentId, children] of Object.entries(byParent)) {
        if (parentId === "root") continue;

        const childSummary = children
            .map(c => `  - ${c.title} (${c.subType})`)
            .join("\n");

        // LLM summarises the ad group's children
        const summary = await llm.invoke(
            `Summarise this ad group's contents in 1-2 sentences:\n${childSummary}`
        );
        adGroupSummaries.push(`Ad Group ${parentId}: ${summary.content}`);
    }

    return adGroupSummaries.join("\n");
}
```

### Strategy 4: Flat Chunking with Metadata Filters

When using vector search, chunk by structural unit and filter by metadata:

```typescript
// Store each brick as a vector with metadata
await vectorStore.addDocuments(bricks.map(brick => ({
    pageContent: `${brick.title}: ${JSON.stringify(brick.data)}`,
    metadata: {
        brickId: brick.id,
        parentId: brick.parentId,
        subType: brick.subType,
        campaignId: brick.campaignId
    }
})));

// Retrieve only bricks in a specific ad group
const results = await vectorStore.similaritySearch(
    "budget settings",
    5,
    { parentId: "target-adgroup-id" }  // Filter by parent
);
```

### Chunk Size Guidelines

| Data type | Recommended chunk size | Rationale |
|-----------|----------------------|-----------|
| Individual bricks | 1 brick = 1 chunk | Preserves atomic unit for tool resolution |
| Ad group + children | 1 ad group + its ads = 1 chunk | Preserves hierarchy |
| Campaign overview | All ad groups (names only) = 1 chunk | For routing/overview queries |
| Full brick data | Strip to key fields only | Reduces tokens without losing structure |

## Use Cases Relevant to This Project

**Scenario 1: "Show me all bricks in ad group 2"**
- Without chunking: Load all 200 bricks, let the agent filter — wasteful
- With chunking: Filter by `parentId === adgroup2_id` before loading — only 5-20 bricks loaded

**Scenario 2: "Summarise this campaign for me"**
- Without chunking: Load all bricks, hope the agent summarises well
- With map-reduce: Summarise each ad group independently, then combine — better quality, scalable

**Scenario 3: 10k brick campaign**
- Full load: Impossible (exceeds context window)
- With hierarchical summary: Load campaign-level summary (50 tokens), drill down via tools — always feasible

**Current implementation in the project**: `getCampaign()` in `Agent.service.ts` already builds a hierarchy string using `recursiveFindDepth()` and `itemToString()`. This is effectively a recursive summary at the title level — a solid foundation. The missing piece is using this as the default context and fetching full brick detail via `get_brick` tool only when needed.

## Tradeoffs

| Strategy | Latency | Token cost | Accuracy | Complexity | Best for |
|----------|---------|-----------|----------|------------|---------|
| Full load | Low | High | High | Low | <200 bricks |
| Flat chunking + filter | Low | Medium | High | Low | Targeted queries by type |
| Hierarchical summary | Medium (+1 summarise pass) | Low | Good | Medium | Overview + drill-down pattern |
| Map-reduce | High (+N LLM calls) | Medium | Good | Medium | Bulk analysis of all bricks |
| Tree index (LlamaIndex) | Medium | Low | Good | High | Read-heavy, rarely mutated data |

**The key constraint**: This data is **mutable** (users edit bricks constantly). Strategies that pre-build indexes (vector stores, tree indexes) require re-indexing on every edit. For the current edit-heavy use case, on-demand summarisation + tool fetching is more practical than pre-built indexes.

## Recommended Approach for This Project

Use **flat chunking with metadata filtering** for targeted queries, combined with the existing **hierarchy string** for structural context. Specifically:

1. Keep `getCampaign()` output as the structural overview (already works well)
2. Add parent-scoped brick fetching: when a user selects an ad group, pre-load only that ad group's children (not the full campaign)
3. For the rare "analyse entire campaign" case, implement map-reduce over ad group chunks

Do **not** implement LlamaIndex tree index — the operational overhead of re-indexing on every brick edit outweighs the benefits at current scale.

## Sources
- LlamaIndex Tree Index: https://docs.llamaindex.ai/en/stable/module_guides/indexing/tree_index/
- LangChain map-reduce summarisation: https://js.langchain.com/docs/modules/chains/document/map_reduce
- LangChain document transformers (chunking): https://js.langchain.com/docs/modules/data_connection/document_transformers/
- Anthropic long context best practices: https://docs.anthropic.com/en/docs/build-with-claude/long-context-tips
- LlamaIndex hierarchical retrieval: https://docs.llamaindex.ai/en/stable/examples/retrievers/recursive_retriever_nodes/
