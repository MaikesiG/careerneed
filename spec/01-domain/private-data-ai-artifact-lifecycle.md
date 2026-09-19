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

## 2. Complete AI Artifact Lifecycle

Every AI-generated deliverable (such as an Interview Preparation Brief, a Post-Interview Debrief Analysis, or an Import Mapping Proposal) progresses through a rigorous 11-stage lifecycle:

```text
  [ 1. Create Request ]
           │
           ▼
  [ 2. Persist as Draft ] ◄──────────────────────────────┐
           │                                             │
           ▼                                             │
  [ 3. View Proposal ]                                   │
           │                                             │
           ▼                                             │
  [ 4. Inspect Source Context ]                          │
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

### Stage Definitions

1. **Create Request**: The user triggers an AI generation (e.g., clicking "Generate Preparation Brief" for a technical round). Request parameters and prompt snapshots are captured.
2. **Persist as Draft**: The AI response is schema-validated server-side and written to the database with `status = draft`. It does **not** alter any application or candidate fields.
3. **View Proposal**: The candidate reads the advice, questions, and checklists in a clean, non-intrusive preview UI.
4. **Inspect Source Context**: The candidate can click transparent citation badges to inspect the exact resume bullet, job requirement, or past interview reflection that prompted each claim.
5. **Edit & Add User Notes**: The candidate can modify generated points, remove irrelevant questions, or append private notes. AI suggestions **never overwrite existing user-authored notes**.
6. **Save User-Reviewed Version**: The candidate saves the artifact as a finalized, user-approved document (`status = accepted` or `status = edited`).
7. **Explicitly Apply**: If the artifact contains recommended actions (e.g., "Schedule follow-up on Friday", "Add 2 practice questions to Todo"), the candidate must click an explicit "Apply Actions" button before any Todo or Follow-up rows are created.
8. **Regenerate with New Context**: The candidate may trigger a re-run with adjusted focus (e.g. emphasizing system design). The prior version is preserved in history.
9. **Compare Versions**: The candidate can view side-by-side diffs between generation attempts.
10. **Archive Artifact**: Retired or superseded briefs are softly archived without losing historical context.
11. **Delete Artifact**: Candidate may permanently purge the artifact and its generation metadata.

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

Every persisted AI suggestion and artifact must store complete operational metadata in `ai_suggestions`:

```python
from datetime import datetime
import uuid
from pydantic import BaseModel, Field

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
