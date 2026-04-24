# Hybrid Local-Embed / Cloud-LLM Architectures

## Summary

Ravel is neither fully local (we want cloud-grade reasoning quality) nor fully cloud (we want a provable privacy story for a bank-regulated setting). The product sits in a small but growing niche: hybrid local-embed + cloud-LLM. This file surveys how existing tools handle the same split, proposes Ravel's reference architecture, and explains exactly how we prove on stage that "no raw data left the laptop."

## Key Concepts

- Hybrid inference: split the pipeline so privacy-sensitive steps (ingest, PII detection, embedding, retrieval) happen client-side, and only reasoning over a redacted payload happens in the cloud.
- Pseudonym envelope: the outbound request is a small structured object with hashed IDs and coarsened numerics. No free-text counterparty names or exact amounts.
- Local-only embeddings: browser or desktop runs the embedding model; the cloud never sees the raw text.
- Attestation: the ability to demonstrate (not just claim) the privacy property. Options: open DevTools, sign the outbound payload and display the signature, publish a deterministic hash of the redaction function.

## How It Works (Reference Architecture for Ravel)

```
Browser tab
+-----------------------------------------------------------+
| 1. bunq CSV import                                        |
| 2. Presidio-style PII detection (NER + regex)             |
| 3. Salted HMAC-SHA256 token replacement                   |
| 4. Local embedding (transformers.js, WebGPU + WASM)       |
| 5. Local HNSW index (usearch WASM)                        |
| 6. Graph build (graphology) + sigma.js render             |
| 7. Query: embed -> k-NN -> subgraph extract -> serialize  |
|    as pseudonym envelope                                  |
+-----------------------------------------------------------+
                 |
                 |  HTTPS, body = {question, pseudonym envelope}
                 v
Cloud LLM (Claude / GPT / OpenRouter)
+-----------------------------------------------------------+
| Reasons over hashed tokens. Returns answer referencing    |
| tok_* IDs.                                                |
+-----------------------------------------------------------+
                 |
                 v
Browser tab re-substitutes tok_* -> real names locally for display.
```

The salt, the substitution table, the raw CSV, and the unhashed embeddings never leave step 1-6. Only step 7's envelope is on the wire.

## Comparison to Existing Tools

### PrivateGPT
- Architecture: LlamaIndex + FastAPI + local LLM (llama.cpp / Ollama). Embeddings and LLM both run locally.
- Privacy model: "nothing leaves" because nothing connects out. Cannot benefit from frontier-model quality.
- Takeaway for Ravel: PrivateGPT validates the local-embed-local-index halves of our pipeline; doesn't touch the hybrid problem.

### AnythingLLM
- Architecture: orchestrator layer on top of Ollama, LM Studio, LocalAI, or cloud APIs (OpenAI-compatible, Bedrock). Default vector DB is LanceDB, colocated with the app.
- Privacy model: configurable. When you point it at OpenAI, raw chunks go to OpenAI. When you point it at Ollama, nothing leaves.
- 1.8.5 (Aug 2025) redesigned the RAG ingestion pipeline with better chunking and reranking.
- Takeaway for Ravel: AnythingLLM is the canonical "BYO-LLM" wrapper. It does not attempt the hashed-envelope trick; either you trust the cloud LLM with raw chunks or you run local.

### Jan
- Architecture: Electron desktop app, local GGUF models, optional cloud connectors. Strong emphasis on offline UX.
- Privacy model: offline-first; anything you route to cloud is cleartext.
- Takeaway for Ravel: good UX reference for the "trust-indicator" pattern (a visible local/cloud status badge).

### Open WebUI, LM Studio, GPT4All, Ollama-based front-ends
- Similar pattern to AnythingLLM: orchestration, not redaction. None of them hash identifiers before a cloud call because their default narrative is "stay local."

### What is novel about Ravel
None of the above prove "no raw data left" with a cloud LLM in the loop, because they either stay local (nothing to prove) or go cloud (can't credibly claim privacy). Ravel's hashed subgraph envelope is the thing a finance-regulated user actually wants: cloud-grade reasoning on structure, with identifiers cryptographically hidden.

## Current State of the Art (2024-2026)

- Local inference: `transformers.js` v4 (2025) brought a C++-rewritten WebGPU runtime and a ~4x BERT speedup. EmbeddingGemma at 308M params runs in <200 MB RAM with INT8.
- Local vector search: `usearch` WASM; `hnswlib-wasm`; IndexedDB for persistence; Origin Private File System (OPFS) for larger blobs.
- Structured RAG: the 2025 trend is "GraphRAG" (Microsoft) and agentic retrieval; both fit the pseudonym envelope idea well because the payload is naturally graph-shaped.
- Cloud-side confidential compute: Azure H100 CVM GA, Phala GPU TEEs on OpenRouter. Optional future upgrade: route Ravel's cloud step into a TEE for defense-in-depth.
- Presidio + salted hash operator (2025): the canonical PII redaction primitive.

## Use Cases for Ravel

- Audit firm prep: load a client's bunq export at the partner's desk; no cloud upload; produce an LLM-guided exception list that references hashed IDs, then print to PDF with names re-substituted locally.
- Second-opinion sharing: a sole trader forwards the hashed subgraph + LLM analysis to their accountant. The accountant never sees identities unless the trader also shares the session salt.
- Internal controls at bunq: employees can inspect suspicious patterns via cloud LLMs without exposing customer PII to the LLM vendor.

## Feasibility for a 24-hour Hackathon

High. Every piece exists in open source and has a working browser build. The integration work is three things:
1. Stand up the in-browser pipeline (ingest -> Presidio -> hash -> embed -> index -> graph).
2. Define the pseudonym envelope JSON schema.
3. Wire a single cloud LLM call with OpenRouter or Anthropic's API, using the envelope as context.

Risks:
- Presidio-analyzer is Python-first. Options: (a) wrap in pyodide; (b) write a JS-only detector using spaCy Dutch via compromise.js + custom IBAN regex. (b) is faster for a hackathon.
- Cloud LLM provider enforces request size limits; envelope must stay under a few hundred KB. Natural because it's already a pruned subgraph.

## Proving "No Raw Data Left" in the Demo

Three layered proofs, from cheapest to most rigorous:

1. Live DevTools demo. Open the Network tab, filter to the LLM host. Click the outbound request. Point to the request body: token IDs, no names, no IBANs, no cents-level amounts, bucketed dates. Show the UI then re-substitutes client-side so the displayed answer has real names. 30 seconds on stage.

2. Network logging toggle. Ship a "Privacy Audit" button that opens a side panel showing every outbound request with a pretty-printed body and a diff against the unredacted version. Always-on in dev mode.

3. Payload signature. Compute `sha256(envelope)` client-side and log it to console along with the salt fingerprint. Anyone replaying the demo can recompute the hash from the console log; any mismatch would mean the envelope was mutated by the network layer, which it isn't.

For extra theater: publish the exact redaction function source with its own `sha256(source)` on the splash screen. If the function hasn't changed between demo and audit, the audit replay is deterministic.

## Tradeoffs

| Architecture | Cloud LLM quality | Raw data on wire | Build time (24h) | Attestation story |
|---|---|---|---|---|
| Fully local (PrivateGPT style) | Low-to-mid | None | Medium | Trivial (nothing to attest) |
| Fully cloud with PII-strip prompt | High | Partial (prompt leaks) | Low | Weak |
| Hybrid with cleartext chunks (AnythingLLM + OpenAI) | High | All retrieved chunks | Low | None |
| Ravel: local-embed + hashed envelope | High (reasoning over structure) | Only hashed tokens + bucketed numerics | Medium | Strong (DevTools reproducible) |
| Ravel + TEE-hosted cloud LLM | High | Hashed, inside enclave | High | Strongest (hardware attestation) |
| Fully homomorphic | High in theory | Ciphertext only | Beyond 24h | Strongest but slowest |

## Recommended Approach for the Hackathon

Ship the Ravel hybrid as in the reference diagram above, picking:
- Embedding: `nomic-embed-text-v2-moe` at 256 dims via `transformers.js` (see `03-local-embeddings.md`).
- Index: `usearch` WASM (see same).
- Redaction: JS-native detector + HMAC-SHA256 (see `04-privacy-preserving-rag.md`).
- Graph render: `sigma.js` + `react-sigma` (see `05-graph-visualization.md`).
- Cloud LLM: Claude via Anthropic API or OpenRouter. One tool call, envelope in, answer out.

Post-hackathon upgrade path:
- Route the cloud step through OpenRouter's Phala TEE for hardware attestation.
- Add a signed attestation string (`sig = sign(privkey, sha256(envelope))`) the user can archive with audit logs.
- Explore a federated variant once there is more than one Ravel tenant.

## Sources

- [PrivateGPT on GitHub](https://github.com/zylon-ai/private-gpt)
- [AnythingLLM on GitHub](https://github.com/Mintplex-Labs/anything-llm)
- [AnythingLLM review (2025)](https://skywork.ai/blog/anythingllm-review-2025-local-ai-rag-agents-setup/)
- [Open WebUI vs PrivateGPT vs AnythingLLM](https://medium.com/@humble92/open-webui-vs-privategpt-vs-anythingllm-a-compact-guide-to-your-local-llm-solution-6b1722614f34)
- [Jan](https://jan.ai)
- [Browser-based RAG with WebGPU (Sitepoint)](https://www.sitepoint.com/browser-based-rag-private-docs/)
- [What I Learned Building a Browser-Based RAG System with WebGPU](https://medium.com/@stramanu/what-i-learned-building-a-browser-based-rag-system-with-webgpu-8f03393f3d18)
- [Transformers.js v3 blog (WebGPU)](https://huggingface.co/blog/transformersjs-v3)
- [Transformers.js v4 on npm](https://www.npmjs.com/package/@xenova/transformers)
- [Microsoft Presidio](https://github.com/microsoft/presidio)
- [LlamaIndex PII Detector for RAG](https://www.llamaindex.ai/blog/pii-detector-hacking-privacy-in-rag)
- [Azure Confidential Computing with NVIDIA H100](https://techcommunity.microsoft.com/blog/azureconfidentialcomputingblog/unlocking-the-potential-of-privacy-preserving-ai-with-azure-confidential-computi/3776838)
- [Phala GPU TEEs on OpenRouter](https://phala.com/posts/GPU-TEEs-is-Alive-on-OpenRouter)
