# Future AI Architecture: Career Search and Action Planning

> **Status:** Planned (Gated on Phase 3 Career Memory)  
> **Owner:** CareerNeed Search & AI Platform  
> **Last Updated:** 2026-09-19  
> **Scope:** Natural-language career search ("Search your career. Ask what to do next."), three search modes, layered retrieval architecture, citation grounding, and write confirmation.

---

## 1. Product Vision and Dependency Gating

### Product Vision
> **“Search your career. Ask what to do next.”**

CareerNeed’s search experience transforms a candidate’s accumulated career records (resumes, job notes, interview questions, reflections, follow-ups) into an interactive intelligence asset.

### Dependency Gating Invariant
**Strict Architecture Rule**: Vector search, embeddings, and complex Retrieval-Augmented Generation (RAG) are **explicitly gated** on Phase 3 prerequisites:
1. Career Memory import pipelines (CSV/Markdown/TXT) must be operational.
2. Provenance tracking must attach every snippet to an immutable source record.
3. Pre-retrieval authorization filters must be proven and tested.

No vector database infrastructure will be introduced into the repository before these foundations exist.

---

## 2. Three Operational Modes

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          THREE MODES OF CAREER SEARCH                       │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ 1. Direct Search    │ Instant, deterministic SQL lookup without an LLM.     │
│    (Zero AI Cost)   │ Ideal for quick navigation (e.g. "Stripe", "Leetcdoe")│
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 2. Ask / Analyze    │ Natural language question answering grounded in       │
│    (Read-Only AI)   │ authorized private career history with citations.     │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 3. Plan / Act       │ AI synthesizes context and proposes concrete actions; │
│    (Confirm-Write)  │ user must confirm every write before DB mutation.     │
└─────────────────────┴───────────────────────────────────────────────────────┘
```

### Mode 1: Direct Search (SQL / Full-Text)
- Fast, local/SQL lookup executing in <100ms.
- Filters across application titles, company names, contacts, interview dates, and question tags.
- Requires zero model inference and incurs zero API cost.

### Mode 2: Ask / Analyze (Evidence-Grounded Synthesis)
- Answers analytical career questions:
  - *"Which system design questions have I been asked across all my interviews?"*
  - *"What resume version did I use for companies where I reached the offer stage?"*
- Synthesizes answers strictly using retrieved, authorized private records.
- Every claim includes a clickable source badge linking directly to the source entity.

### Mode 3: Plan / Act (Advisory Action Proposal)
- Proposes forward-looking plans:
  - *"I have an onsite at Datadog next week. What should I prioritize?"*
- Generates a proposed action list:
  - `[ ] Practice 2 distributed tracing questions from past reflections`
  - `[ ] Review Kafka vs RabbitMQ trade-offs`
  - `[ ] Send status check to recruiter on Friday`
- **Write Rule**: Items appear as uncommitted checkboxes. The candidate must click "Add Selected Tasks to Todo" before any database records are written.

---

## 3. Layered Retrieval Pipeline Architecture

To prevent hallucinations, protect data privacy, and optimize latency, Career Search uses a strictly layered retrieval pipeline:

```text
Natural-Language Query
         │
         ▼
[ Intent Classification ] ──► (Direct Lookup) ──► Instant SQL Results
         │
         ▼ (Complex Question)
[ Pre-Retrieval Authorization Filter ] ──► (Hard tenant isolation: user_id == owner)
         │
         ▼
[ Layer 1: Structured SQL Retrieval ] ──► Filter by date, status, company, stage
         │
         ▼
[ Layer 2: Full-Text Search (FTS) ] ──► Lexical keyword match across descriptions/notes
         │
         ▼
[ Layer 3: Vector Retrieval ] ──► Semantic similarity over authorized chunks (Phase 3+)
         │
         ▼
[ Fusion & Reranking ] ──► Top-K authorized evidence snippets
         │
         ▼
[ Grounded LLM Response Generator ]
         │
         ├──► Clickable Source Citations (Linked to canonical objects)
         └──► Proposed Structured Actions (Awaiting user confirmation)
```

---

## 4. Grounding and Citation Integrity

1. **Pre-Model Authorization**: The search retriever executes user ownership checks **before** snippets are passed into the model prompt context. Other users' records can never be leaked into model context.
2. **Logical Separation of Community Data**: If a query queries both private records and community intelligence, the retrieval sets are fetched independently and presented in distinct UI sections. Private and community data are never conflated.
3. **Mandatory Citations**: Any statement summarizing private candidate history must provide a verifiable citation linking to the object ID (for example, `[Interview Round 2 @ Stripe](/applications/app-123#round-2)`).
4. **Missing Data Reporting**: When queried about an unrecorded event (e.g. "What did the recruiter say about salary?"), the system explicitly states: *"No compensation notes were recorded for this application."*
