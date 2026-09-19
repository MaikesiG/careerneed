# Private Data and AI Artifact Lifecycle

> **Status:** Authoritative Domain Standard  
> **Owner:** CareerNeed AI & Data Architecture  
> **Last Updated:** 2026-09-19  
> **Scope:** Lifecycle of AI-generated artifacts, explicit-confirmation write model, grounding, citation integrity, and provenance.

---

## 1. Foundational AI Boundary

In CareerNeed, AI is strictly an **advisory intelligence engine**. It operates over authorized private data to summarize evidence, evaluate fit, highlight blind spots, and propose structured actions. 

AI is **never** the autonomous source of truth, and it possesses **zero autonomous write authority**.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THE CORE GOVERNANCE INVARIANT                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│          AI Can Propose.      AI Can Advise.      AI Cannot Write.          │
│                                                                             │
│    Every state transition, application edit, published record, email,       │
│    and bulk action requires EXPLICIT, UNAMBIGUOUS USER CONFIRMATION.        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. AI Artifact Lifecycle: Current v1 vs. Long-Term Target

To clearly separate current operational reality from future architectural capabilities, the lifecycle distinguishes between active v1 behavior and the long-term target architecture.

### 2.1 Current v1 Implementation
In the active v1 product, AI capabilities (such as the Interview Preparation Brief) execute a focused, synchronous advisory interaction:
1. **User-Triggered Generation**: The candidate explicitly clicks "Generate Preparation Brief" from an authorized application or interview view.
2. **Schema Validation**: Outputs are generated synchronously through the backend model router and validated against strict Pydantic models before client delivery.
3. **Server-Owned Disclaimer**: The response automatically attaches a mandatory server-owned disclaimer:
   ```text
   "AI-generated preparation guidance. Verify details before relying on it."
   ```
4. **Advisory Viewing in Modal**: The structured brief is presented in a client preview modal for candidate review.
5. **Regeneration**: Candidates may re-trigger generation to produce updated guidance.
6. **Metadata-Only Audit Records (`ai_runs`)**: Execution telemetry is committed to the `ai_runs` table (`user_id`, `application_id`, `interview_id`, `feature_name`, `prompt_version`, `status`, `provider`, `model`, `duration_ms`, `input_tokens`, `output_tokens`, `total_tokens`, `safe_error_code`).
7. **Explicit Non-Claim**: **There is no claim that complete persisted draft/version/apply workflows are implemented now.** In v1, the brief is held in transient client session state; it does not persist structured draft entities, maintain multi-version history, or automatically update canonical records.

---

### 2.2 Long-Term Lifecycle Target
As the platform expands and satisfies real-provider validation gates, AI-generated deliverables will progress through a complete 10-stage persisted lifecycle:

```text
  [ 1. Generate Proposal ]
           │
           ▼
  [ 2. Persist as Draft ] ◄──────────────────────────────┐
           │                                             │
           ▼                                             │
  [ 3. View Proposal ]                                   │
           │                                             │
           ▼                                             │
  [ 4. Inspect Sources & Citations ]                     │
           │                                             │
           ▼                                             │
  [ 5. Edit & Add User Notes ]                           │
           │                                             │
           ▼                                             │
  [ 6. Save User-Reviewed Version ]                      │
           │                                             │
           ├──► [ 7. Explicitly Apply ]                  │
           │           │                                 │
           │           ▼                                 │
           │      [ Core Records Updated ]               │
           │                                             │
           ├──► [ 8. Regenerate with New Context ] ──────┘
           │
           ├──► [ 9. Compare Versions ]
           │
           ├──► [ 10. Archive Artifact ]
           │
           └──► [ 11. Delete Artifact ]
```

#### Long-Term Stage Definitions
1. **Generate Proposal**: User triggers generation; request parameters and input hashes are captured.
2. **Persist as Draft**: AI output is validated and written to an `ai_suggestions` table with `status = draft`, isolated from core records.
3. **View Proposal**: Candidate reviews structured recommendations in a dedicated interface.
4. **Inspect Sources**: Transparent source citations link findings directly to specific resume bullets, job requirements, or notes.
5. **Edit & Add Notes**: Candidate modifies text, removes irrelevant items, or appends notes without overwriting existing user-authored text.
6. **Save**: Candidate commits the reviewed version as finalized (`status = accepted` or `status = edited`).
7. **Explicitly Apply**: Candidate confirms transfer of proposed actions (e.g. creating todos or updating interview prep notes).
8. **Regenerate**: Produces fresh proposals while preserving previous iterations in version history.
9. **Compare**: Side-by-side diffing across generation attempts.
10. **Archive**: Soft-archives superseded briefs without losing audit context.
11. **Delete**: User may permanently purge artifacts and generation telemetry.

---

## 3. Four-Tier AI Output Epistemology

To eliminate hallucinations and prevent overconfidence, every AI output must explicitly categorize its findings into four distinct epistemological tiers:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EPISTEMOLOGICAL OUTPUT TIERS                           │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ Tier 1: EVIDENCE    │ Verifiable, extracted facts directly present in the   │
│ (Ground Truth)      │ source documents (e.g. "The job requires Go & gRPC"). │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ Tier 2: INFERENCE   │ Logical deduction derived from evidence               │
│ (Reasoned Analysis) │ (e.g. "Because this is a payment team, idempotency and│
│                     │ transaction isolation will likely be emphasized").    │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ Tier 3: RECOMMENDED │ Specific, actionable suggestions for the candidate    │
│ (Proposed Action)   │ (e.g. "Review distributed locking and Raft consensus").│
├─────────────────────┼───────────────────────────────────────────────────────┤
│ Tier 4: UNCERTAINTY │ Explicit admission of missing or ambiguous data       │
│ (Data Limitations)  │ (e.g. "Listing does not specify cloud provider;       │
│                     │ confirm whether AWS or GCP is used during screen").   │
└─────────────────────┴───────────────────────────────────────────────────────┘
```

**Epistemological Invariant**: Any AI claim grounded in private candidate data must provide a clickable link to the source entity (`ResumeVersion`, `Job`, `InterviewQuestion`, or `CareerDirection`). If evidence is absent, the system must report `insufficient_data` rather than inventing confident answers.

---

## 4. The Explicit-Confirmation Write Contract

The following operations are **strictly classified as Consequential Writes** and may **NEVER** be executed autonomously by an AI agent or background job:

| Target Domain | Prohibited Autonomous Action | Required Confirmation UI |
|---|---|---|
| **Application State** | Transitioning status (e.g. moving from `applied` to `interviewing`). | User clicks explicit status dropdown or confirm button. |
| **User Notes** | Overwriting or merging candidate's personal reflection or notes. | AI displays suggested additions in a side-by-side diff; user clicks "Append". |
| **External Messaging** | Sending emails, submitting ATS forms, or messaging recruiters. | **Strict Non-Goal**: System never sends external messages. |
| **Task / Todo Creation** | Inserting new follow-up tasks, study todos, or calendar events. | User reviews action checklist and clicks "Add Selected Tasks". |
| **Community Sharing** | Publishing interview questions, company benchmarks, or reviews. | User executes explicit 3-step anonymized submission workflow. |
| **Profile & Resume** | Mutating Candidate Profile skills, experience dates, or resume text. | User reviews extracted draft and clicks "Save to Profile". |

---

## 5. Auditability and Metadata Schema

### 5.1 Active v1 Execution Telemetry (`ai_runs`)
In current v1, execution metadata is captured in the `ai_runs` table:

```python
from datetime import datetime
from typing import Literal
import uuid
from pydantic import BaseModel

class AIRunMetadata(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    application_id: uuid.UUID | None = None
    interview_id: uuid.UUID | None = None
    feature_name: str                        # "interview_preparation_brief"
    prompt_version: str                      # "v1"
    status: Literal["started", "succeeded", "failed"]
    provider: str | None = None              # "openai"
    model: str | None = None                 # e.g., "gpt-4o-mini"
    duration_ms: int | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    safe_error_code: str | None = None
    created_at: datetime
```

### 5.2 Planned Future Artifact Audit Schema (`ai_suggestions`)
When persistent draft and apply workflows are introduced in future phases, structured suggestions will record extended lifecycle states:

```python
class AIAuditMetadata(BaseModel):
    artifact_id: uuid.UUID
    user_id: uuid.UUID
    entity_type: str                         # "application", "interview", "resume"
    entity_id: uuid.UUID
    suggestion_type: str                     # "interview_prep", "outcome_debrief", "match_explanation"
    
    # Provenance and Model Versioning
    model_provider: str                      # "openai", "groq", "anthropic" (Never conflate groq and xai)
    model_version: str                       # e.g., "gpt-4o-mini-2024-07-18"
    prompt_version: str                      # e.g., "prep-brief-v2.1"
    output_schema_version: str               # e.g., "1.0"
    input_snapshot_hash: str                 # SHA-256 hash of input context payload
    
    # Telemetry and Economics
    prompt_tokens: int
    completion_tokens: int
    total_cost_usd: float
    execution_duration_ms: int
    
    # Lifecycle & Resolution
    status: str                              # "draft", "accepted", "edited", "rejected", "expired"
    resolved_at: datetime | None = None
    created_at: datetime
```

This ensures that any erroneous suggestion, regression, or cost spike can be traced back to the exact prompt template, model checkpoint, and source input snapshot.
