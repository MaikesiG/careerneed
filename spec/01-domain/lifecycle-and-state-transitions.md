# Lifecycle, State Transitions, and Historical Truth

> **Status:** Implemented (Core Statuses) / Planned (Timeline & Snapshots)  
> **Owner:** CareerNeed Platform Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Application state machine, interview stages and statuses, follow-up lifecycles, job lifecycles, user job states, immutable snapshots, and event timelines.

---

## 1. The Historical Truth Principle

A candidate's past decisions must never be distorted by later edits. 

```text
Future Resume Edits        ──┐
Future Direction Changes    ──┼──► CANNOT rewrite past application context!
Future Job Post Closures   ──┤
Future Matching Algorithm  ──┘
```

When a user submits an application, CareerNeed captures an **immutable snapshot** of the job description, company name, applied URL, direction preferences, resume version, and matching evaluation as they existed at that exact moment.

---

## 2. Application State Machine

```text
       ┌─────────────── [ saved ] ──────────────┐
       │                    │                   │
       │                    ▼                   │
       │               [ applied ]              │
       │                    │                   │
       │                    ▼                   │
       │              [ screening ]             │
       │                    │                   │
       │                    ▼                   │
       │              [ interview ]             │
       │                    │                   │
       │                    ▼                   │
       │                [ offer ]               │
       │              /     │     \             │
       │             ▼      ▼      ▼            │
       │    [ accepted ] [ declined ]           │
       │            \       /                   │
       ▼             ▼     ▼                    ▼
   [ withdrawn ] ◄── [ rejected ] ◄──────── [ on_hold ]
```

### Complete State Vocabulary

| Status | Category | Description | Terminal? |
|---|---|---|:---:|
| `saved` | Pre-application | Job evaluated and bookmarked for application preparation. | No |
| `applied` | Active Pipeline | Application formally submitted to the employer. | No |
| `screening` | Active Pipeline | Initial recruiter or automated resume screen underway. | No |
| `interview` | Active Pipeline | Actively progressing through one or more interview rounds. | No |
| `offer` | Decision Phase | Formal job offer extended; candidate considering terms. | No |
| `accepted` | Terminal Outcome | Candidate signed and accepted the job offer. | **Yes** |
| `declined` | Terminal Outcome | Candidate declined the extended job offer. | **Yes** |
| `rejected` | Terminal Outcome | Employer terminated candidacy at any stage. | **Yes** |
| `withdrawn` | Terminal Outcome | Candidate voluntarily withdrew from consideration. | **Yes** |
| `on_hold` | Suspended | Hiring paused by employer (e.g. headcount freeze) or user. | No |

### Transition Invariants
- **Offer is Not Terminal**: Extending an offer does not complete the lifecycle. The user must explicitly transition the application to `accepted`, `declined`, or `withdrawn`.
- **Explicit Reopening**: Transitioning out of a terminal state (`accepted`, `declined`, `rejected`, `withdrawn`) is permitted only through a deliberate user action that logs a re-opened event.
- **Transactional Mutation**: Every application status change must validate ownership, record the new status, update timestamps, and insert an immutable `career_event` in a single transaction.

---

## 3. Interview Lifecycle

Each application contains zero or more ordered interview rounds:

```text
Scheduled ──► Rescheduled ──► Completed ──► [ Outcome: Advance / Rejected / Offer / Withdrawn ]
    │
    └──► Cancelled
```

### 3.1 Interview Stages
- `recruiter_screen`: Initial talent partner / recruiter conversation (typically 15–30 min).
- `hiring_manager`: Strategic or alignment discussion with the team manager.
- `technical`: Coding, algorithm, or technical problem-solving session.
- `system_design`: Architecture, scalability, or distributed systems evaluation.
- `behavioral`: Culture, leadership principles, collaboration, or STAR scenario questions.
- `case_study`: Presentation, take-home review, or live business problem solving.
- `onsite`: Multi-interview panel / final-round loop.
- `final`: Executive or founder conversation.
- `other`: Specialized or custom interview formats.

### 3.2 Interview Statuses
- `scheduled`: Confirmed date, time, timezone, and meeting link.
- `completed`: The interview session occurred and debrief notes may be captured.
- `rescheduled`: The interview date/time was updated.
- `cancelled`: The round was called off before completion.

### 3.3 Round Outcomes
- `pending`: Awaiting decision from employer.
- `advance`: Successfully passed to the next round.
- `rejected`: Did not advance past this round.
- `offer`: Round resulted directly in an offer.
- `withdrawn`: Candidate withdrew following the round.
- `unknown`: Outcome not recorded or disclosed.

---

## 4. Follow-up Action Lifecycle

Follow-ups represent critical workflow obligations associated with an application or interview round:

- **Follow-up Types**:
  - `thank_you`: Gratitude and key technical clarification message sent after an interview round.
  - `status_check`: Polite inquiry following an elapsed response window.
  - `recruiter_reply`: Response to an inbound recruiter email or scheduling request.
  - `preparation`: Self-study task (e.g., "Review system design for payment gateways").
  - `custom`: Candidate-defined reminder.
- **Status Progression**:
  - `pending` (Scheduled for future date/time).
  - `due_today` (Calculated dynamically against user timezone).
  - `overdue` (Calculated dynamically when due time has elapsed).
  - `completed` (Resolved with explicit `completed_at` timestamp).
  - `dismissed` (Safely removed without execution).

---

## 5. Job Catalog Lifecycle

Canonical Jobs exist independently of individual user tracking:

```text
[ discovered ] ──► [ active ] ──► [ expired ] | [ closed ] | [ removed ]
```

- `discovered`: Ingested from source ATS but awaiting validation/normalization.
- `active`: Verified opportunity actively hiring across at least one live source listing.
- `expired`: Posting duration passed without recent ATS confirmation.
- `closed`: Confirmed taken down by employer.
- `removed`: Manually or programmatically delisted due to policy violation or error.

**Persistence Guarantee**: If a job transitions to `closed` or `expired`, any user `Application` that references that job continues to retain full access to the original job description, title, and company snapshots.

---

## 6. User Job States (Private Relationship)

A job's tracking status is user-specific and must never be stored on the global `Job` record:

```text
[ unseen ] ──► [ viewed ] ──► [ saved ] ──► [ applied ]
     │                           │
     └───────────────────────────┴────────► [ dismissed ]
```

- `unseen`: Candidate has not viewed this job card.
- `viewed`: Candidate opened job details.
- `saved`: Candidate bookmarked the job for preparation.
- `dismissed`: Candidate hid the job (storing structured dismissal reason).
- `applied`: Candidate initiated or created an application for this job.

---

## 7. Application Snapshots and Career Events Timeline

### 7.1 Required Snapshot Schema (Captured at Application Creation)

```json
{
  "application_id": "uuid",
  "snapshot_timestamp": "2026-09-19T12:00:00Z",
  "job_snapshot": {
    "company_name": "Stripe",
    "title": "Backend Engineer, Core Infrastructure",
    "source_url": "https://stripe.com/jobs/...",
    "location": "New York, NY (Hybrid)",
    "description": "Full job description text frozen at submission time..."
  },
  "career_direction_snapshot": {
    "id": "uuid",
    "name": "Backend Infrastructure",
    "target_roles": ["backend_engineer", "systems_engineer"],
    "seniority": ["mid", "senior"]
  },
  "resume_version_snapshot": {
    "resume_id": "uuid",
    "version_number": 2,
    "file_id": "uuid",
    "content_text": "Frozen plain-text extraction of submitted resume..."
  },
  "match_result_snapshot": {
    "score": 88,
    "eligibility": "eligible",
    "matched_skills": ["Go", "PostgreSQL", "Distributed Systems"],
    "missing_skills": ["gRPC", "Kafka"]
  }
}
```

### 7.2 Immutable Career Events Log
Every material candidate milestone is written to `career_events`:
- `application_created`
- `application_status_changed`
- `resume_version_linked`
- `interview_scheduled`
- `interview_rescheduled`
- `interview_completed`
- `interview_question_recorded`
- `follow_up_created`
- `follow_up_completed`

Each event records `event_type`, `occurred_at`, `actor_type` (`user` | `system`), and structured `payload`.
