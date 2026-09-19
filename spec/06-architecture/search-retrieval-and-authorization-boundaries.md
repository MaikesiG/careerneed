# Architecture: Search, Retrieval, and Pre-Retrieval Authorization Boundaries

> **Status:** Authoritative Security & Search Standard  
> **Owner:** CareerNeed Data & AI Architecture  
> **Last Updated:** 2026-09-19  
> **Scope:** Pre-retrieval authorization boundaries, logical data separation, grounding contracts, and clickable citation generation.

---

## 1. The Pre-Retrieval Authorization Invariant

In multi-tenant AI systems, post-retrieval filtering (allowing the LLM to see all data and relying on the model to omit other users' secrets) is a critical security flaw.

CareerNeed strictly enforces **Pre-Retrieval Authorization**:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                 PRE-RETRIEVAL AUTHORIZATION INVARIANT                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    Every search, retrieval, or aggregation query MUST filter by authenticated│
│    user_id at the database/storage query layer BEFORE snippets are passed   │
│    into model prompt context.                                               │
│                                                                             │
│    An LLM prompt context NEVER contains un-authorized data.                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Logical Separation of Private vs Community Data

When answering broad career questions (e.g. *"What should I expect in a Stripe backend interview?"*), the retrieval engine accesses two distinct data corpora:

```text
                     Candidate Query
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
    [ Private Corpus ]             [ Community Corpus ]
    • User's Stripe Application    • Verified Interview Lab questions
    • User's Resume Version        • Anonymized company round benchmarks
    • User's Past Reflections      • Community Interview Packs
             │                             │
             └──────────────┬──────────────┘
                            ▼
             [ Dual-Stream Grounded Synthesis ]
```

1. **Independent Retrieval Streams**: Private user data and community intelligence are retrieved via completely separate query pipelines with distinct access tokens and visibility filters.
2. **Distinct Presentation**: The UI clearly separates personal private context from crowd-sourced community benchmarks. The system never exposes personal notes under the guise of community intelligence.

---

## 3. Grounding and Clickable Citation Contract

1. **Mandatory Object Attribution**: Any AI response making assertions regarding the candidate's career history must cite specific database records using structured citation tokens:
   ```json
   {
     "claim": "You previously struggled with distributed transactions during your screening call.",
     "source_object": {
       "entity_type": "interview_question",
       "entity_id": "8b51a5c1-3f40-429a-9e19-012b1d3c87e0",
       "display_label": "Round 1 Question 2 Reflection",
       "relative_url": "/applications/app-123#question-8b51"
     }
   }
   ```
2. **Clickable UI Links**: Frontend clients transform these citations into clickable badges (e.g. `[Stripe Round 1 Debrief]`), allowing the user to inspect the exact historical source document.
3. **No Phantom Evidence**: If a candidate asks about an event not found in the database, the system must declare: *"No records found regarding salary discussions for this application."* Fabricating details to appear helpful is strictly disallowed.
