# Privacy-Preserving RAG for Ravel

## Summary

Ravel's pitch is "your books never leave your laptop." To hold up under scrutiny at a bunq hackathon demo, we need (a) a coherent taxonomy of privacy-preserving RAG techniques, (b) an honest statement of where our chosen technique sits, and (c) a reproducible proof -- in the live browser console -- that no raw personal data or counterparty names cross the wire.

Our choice is deterministic hashing of identifiers combined with local embedding and Microsoft Presidio for PII detection. We explicitly reject fully homomorphic encryption (FHE) on the grounds of cost (300 s per GPT-2 token without GPU, ~11 s with one) and ship complexity. Federated RAG and differential privacy are overkill for a single-tenant audit tool. This file is the full reasoning.

## Key Concepts

- Raw retrieval: naive RAG sends embeddings and retrieved chunks in cleartext to the LLM. Baseline to compare against.
- Hashing / pseudonymization: replace identifiers (IBANs, names, phone numbers, emails) with HMAC-SHA256(value, salt). Stable within a session, irreversible without the salt.
- Homomorphic encryption (HE): operate on ciphertexts. FHE schemes (CKKS, TFHE) allow cosine similarity and even transformer layers over encrypted data. Correct but slow.
- Federated RAG: never move the documents; embed them at the silo, exchange only gradients or encrypted aggregates. Useful for multi-tenant setups, not a 24-hour demo.
- Differential privacy (DP): add calibrated noise to outputs (or to training) so single records can't be recovered. Useful for telemetry, less for per-query RAG.
- Confidential computing (TEE): run the LLM inside a GPU enclave (NVIDIA H100 CC, Azure Confidential VMs). Shifts trust from the provider to the silicon.

## How It Works -- Ravel's Approach

1. Ingest bunq CSV locally. Run a Presidio pipeline (NER + regex + custom IBAN recognizer) to tag PII spans in transaction memos.
2. Replace each tagged span with `tok_<HMAC-SHA256(value, session_salt)[:10]>`. The salt lives only in the browser tab; it is regenerated on reload.
3. Embed the redacted text locally (see `03-local-embeddings.md`). Build the graph: nodes are hashed entity IDs, edges are transactions / co-occurrences.
4. On a user question, retrieve the relevant subgraph locally. Before any network call, the subgraph is serialized as `{token -> type, edges: [(tok_a, tok_b, amount_bucket, date_quarter)]}`. Amounts are bucketed, dates are coarsened to the quarter. No names, no IBANs, no raw memos.
5. Send that structure plus the user's question to the cloud LLM. The LLM reasons over pseudonyms and returns a response referencing `tok_*`. The browser re-substitutes tokens back to real names for display. The substitution table never leaves the tab.

## Current State of the Art (2024-2026)

### Hashing / pseudonymization
Salted SHA-256 / HMAC remains the industry default for PII and log anonymization. The 2025 PRvL benchmark and the arXiv paper "Privacy-Preserving Anonymization of System and Network Event Logs" (2507.21904) show that salted hashing preserves subnet-like structure for correlation without allowing reidentification. Presidio shipped a `hash` operator with configurable salt in its 2025 releases, specifically to defend against brute-force attacks on common value spaces.

### Homomorphic encryption for RAG
Zama's Concrete ML v1.2 introduced hybrid on-prem deployment where some linear layers of the LLM run in FHE on the server. Data transfer is ~4x the cleartext per token (about 2.2 MB per token for GPT-2, 18 MB for LLaMA-1B). Latency is ~11 s per token on GPU, 300 s on CPU. SecureRAG (OpenReview 2025) and RemoteRAG (ACL 2025) use CKKS for encrypted similarity. All are orders of magnitude too slow for interactive demo.

### Federated RAG
FedE4RAG and HyFedRAG (2025) orchestrate embedding learning and retrieval across silos, fusing HE and federated averaging. Meaningful for cross-bank consortia; out of scope for a single-tenant audit tool.

### Confidential computing
Azure made H100 confidential VMs generally available in 2025; Phala serves DeepSeek-R1-70B from a GPU TEE on OpenRouter. Throughput penalty is 4-8% vs non-confidential. This is the credible "cloud-side" complement to Ravel if we ever want to run an enclave-hosted LLM.

### PII detection layer
Microsoft Presidio is the de facto open-source standard. LlamaIndex ships a `NERPIINodePostprocessor` that wraps it for RAG pipelines. Presidio's 2025 release added a LangExtract recognizer, batch REST endpoints, and the salted hash operator.

## Use Cases for Ravel

- Audit trail redaction: regulators see the graph, not the counterparties.
- Shareable analysis: an accountant forwards the hashed subgraph + LLM response to a partner; the partner sees structure, not identities.
- Self-custody: the salt never leaves the user's device, so even if Ravel's hosting is subpoenaed, no reidentification is possible.
- Provable-in-demo privacy: we can open DevTools live and show an empty Network tab apart from calls to the LLM with pseudonymized payloads.

## Feasibility for a 24-hour Hackathon

High for our chosen approach. Presidio-analyzer is a pip install. HMAC-SHA256 with a salt is 5 lines of code using SubtleCrypto in the browser. Amount bucketing and date coarsening are trivial.

Out of reach in 24 hours:
- FHE: even a toy Concrete-ML demo takes a day to set up, and the latency kills the "live graph" story.
- Federated RAG: needs more than one silo to be meaningful.
- Full DP: calibrating epsilon without breaking utility is a research project.

## Tradeoffs

| Technique | Privacy strength | Reasoning quality | Latency impact | Hackathon feasibility |
|---|---|---|---|---|
| Raw retrieval (baseline) | None | Best | None | Trivial |
| PII hashing + local embed (Ravel) | Strong for identifiers; structure leaks | Near-baseline; LLM reasons over tokens | +10-50 ms per batch | High |
| Microsoft Presidio only | PII removed but tokens are obvious placeholders | Drops if names carry signal | +20-100 ms | High |
| FHE (Zama Concrete / CKKS) | Cryptographic | Near-baseline | 10-100x slower | Low (beyond 24h) |
| Federated RAG | Strong across silos | Can match baseline with good aggregation | Network-bound | Low |
| Differential privacy | Noisy outputs | Hurts per-query answers | Small | Medium (calibration hard) |
| Confidential GPU (H100 TEE) | Trusts hardware, not provider | Baseline | ~5-8% throughput | Medium (infra setup, not logic) |

## Recommended Approach for the Hackathon

1. Presidio-analyzer in a Web Worker (wasm-python via pyodide) OR a lightweight JS port: spaCy's `nl_core_news_sm` NER + regex rules for IBAN / bunq account formats.
2. `crypto.subtle.importKey` + HMAC-SHA256 with a 32-byte random salt per session. Tokens shown in the UI as `tok_ab12cd34` for demo drama.
3. Local embedding and local k-NN as per `03-local-embeddings.md`.
4. Outbound payload shape: `{question, subgraph: {nodes: [{id: tok_*, type}], edges: [{src, dst, amount_bucket, quarter}]}, salt_fingerprint: sha256(salt)[:8]}`. The salt fingerprint is printed in the UI so the auditor can verify it never changes mid-session but also never matches another session.
5. Demo proof: open DevTools Network tab, filter on the LLM host, show each request body contains no Latin-script counterparty names, no IBANs, no cents-level amounts. Record a 20-second screen capture for the pitch.

Optional stretch: add Presidio's salted hash operator server-side as a "belt-and-braces" check that the redaction held.

## Comparison to Adjacent Projects

- PrivateGPT: runs embeddings and LLM locally; no cloud step, so no "hash before send" problem to solve. Ravel differs by using a cloud LLM for reasoning while keeping data local.
- AnythingLLM: orchestrator that delegates to Ollama / LM Studio / OpenAI. Local is an option, not a guarantee; no hashing layer.
- Jan: fully offline desktop chat, no RAG-to-cloud story.
None of these three prove "no raw data leaves" in a demo because they either run fully local (nothing to prove) or fully cloud (nothing to claim). Ravel's hybrid claim is the interesting one.

## Sources

- [Microsoft Presidio](https://github.com/microsoft/presidio)
- [Microsoft Presidio supported entities](https://microsoft.github.io/presidio/supported_entities/)
- [LlamaIndex: PII Detector for RAG with Presidio](https://www.llamaindex.ai/blog/pii-detector-hacking-privacy-in-rag)
- [SecureRAG (OpenReview 2025)](https://openreview.net/forum?id=5uXACIHz6K)
- [RemoteRAG: A Privacy-Preserving LLM Cloud RAG Service (ACL 2025)](https://aclanthology.org/2025.findings-acl.197.pdf)
- [Zama Concrete ML v1.2 release](https://www.zama.org/post/releasing-concrete-ml-v1-2-0)
- [Concrete ML inference docs](https://docs.zama.org/concrete-ml/llms/inference)
- [Privacy-Preserving Anonymization of System and Network Event Logs (arXiv 2507.21904)](https://arxiv.org/abs/2507.21904)
- [Adaptive PII Mitigation Framework for LLMs (arXiv 2501.12465)](https://arxiv.org/html/2501.12465v1)
- [Azure Confidential Computing with NVIDIA H100](https://techcommunity.microsoft.com/blog/azureconfidentialcomputingblog/unlocking-the-potential-of-privacy-preserving-ai-with-azure-confidential-computi/3776838)
- [Confidential LLM Inference: Performance and Cost Across CPU and GPU TEEs (arXiv 2509.18886)](https://www.arxiv.org/pdf/2509.18886)
- [Phala: GPU TEEs on OpenRouter](https://phala.com/posts/GPU-TEEs-is-Alive-on-OpenRouter)
