# Current Product: Applications Workflow and Workspace

> **Status:** Implemented (Core Tracking & Detail Workspace) / In Progress (Snapshots & Concurrency)  
> **Owner:** CareerNeed Product & Platform  
> **Last Updated:** 2026-09-20  
> **Scope:** Application lifecycle tracking, List and Pipeline Board views, Application Detail workspace, notes, resume linkage, and historical snapshots.

---

## 1. Module Overview and Current Status

The Applications module tracks a candidate's actual job-search pipeline from initial interest to final offer decisions.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAPABILITY STATUS BREAKDOWN                       │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Shipped & Verified in Code           │ • Application CRUD scoped by user_id │
│                                      │ • Statuses: saved, applied,          │
│                                      │   interviewing, offer, rejected,     │
│                                      │   withdrawn                          │
│                                      │ • Application List view              │
│                                      │ • Pipeline / Kanban Board view       │
│                                      │ • Application Detail workspace:      │
│                                      │   Status, Notes, canonical FollowUps │
│                                      │ • Linked Application Contacts CRUD   │
│                                      │ • Multi-interview sections           │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ In Progress (Active Milestone)       │ • Immutable submission snapshots     │
│                                      │ • Optimistic concurrency (versioning)│
│                                      │ • Extended statuses (screening,      │
│                                      │   accepted, declined, on_hold)       │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ Planned (Subsequent Phases)          │ • Immutable Career Event timeline    │
│                                      │ • Automated pipeline analytics       │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Application Data Model

```python
class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("user_id", "job_id", name="uq_applications_user_job"),
    )

    id: uuid.UUID                                    # Primary key
    user_id: uuid.UUID                               # Authenticated owner
    job_id: uuid.UUID                                # Canonical Job reference
    resume_id: uuid.UUID | None                      # Linked Resume version
    status: str                                      # Current lifecycle state
    applied_at: datetime | None                      # Official submission timestamp
    notes: str | None                                # User-authored markdown notes
    follow_up_on: date | None                        # Legacy compatibility only
    created_at: datetime
    updated_at: datetime

    # Relationships
    job: Mapped["Job"]
    resume: Mapped["Resume | None"]
    contacts: Mapped[list["ApplicationContact"]]
    interviews: Mapped[list["Interview"]]
    follow_ups: Mapped[list["FollowUp"]]
```

---

## 3. Application Lifecycle and State Transitions

Applications move through defined lifecycle states:

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

### State Rules
1. **Offer is Non-Terminal**: Receiving an offer is an active negotiation state. Terminal resolution requires explicit candidate action: `accepted`, `declined`, or `withdrawn`.
2. **Applied Date Automation**: When an application transitions from `saved` to `applied`, `applied_at` automatically populates with the current UTC timestamp if not previously set.
3. **Application Uniqueness**: A candidate can have at most one active application per canonical job (`uq_applications_user_job`).

### `applied_at` UTC contract

- Explicit PATCH input **MUST** be timezone-aware and is normalized to UTC. Naive input is
  rejected with normal schema-validation behavior.
- Automatic assignments use timezone-aware UTC current time.
- Historical naive persisted values are interpreted as UTC during response serialization.
- Output normalization is pure and **MUST NOT** mutate or persist ORM state.
- The model column remains unchanged; broader repository timestamp cleanup is deferred.

---

## 4. UI View Modes

### 4.1 Application List View (`/applications`)
- Tabular / card presentation showing Company, Title, Current Status badge, Applied Date, Follow-up alert, and Quick Action buttons.
- Filterable by Status (e.g. show only `interviewing` or `offer`), Follow-up status (`all`, `today`, `overdue`, `scheduled`), and free text search.
- Server-side offset pagination with total counts.

The list response includes canonical summary fields:

- `next_open_follow_up_at`: the earliest `due_at_utc` among incomplete FollowUps, or null.
- `open_follow_up_count`: the number of incomplete FollowUps, or zero.

The owner-scoped aggregate is grouped by `application_id` and outer-joined to Application. A raw
FollowUp join **MUST NOT** duplicate application rows or corrupt pagination and counts. Filters use
the earliest open timestamp: `all` adds no predicate, `scheduled` requires a timestamp, `today`
uses the requested local day's half-open UTC interval, and `overdue` is earlier than its start.

### 4.2 Pipeline / Kanban Board View (`/applications/board`)
- Visual multi-column workflow board categorized by status columns (`Saved`, `Applied`, `Interviewing`, `Offer`, `Closed`).
- Responsive card layouts showing company name, job title, match score badge, and next action due date.
- Quick status movement with optimistic UI update.

---

## 5. Application Detail Workspace (`/applications/[applicationId]`)

The detail page serves as the mission control for an active candidacy:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ APPLICATION DETAIL: Senior Backend Engineer @ Stripe                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Header: Company · Title · Location · Source Link · Status Editor            │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ INTERVIEW WORKSPACE                  │ APPLICATION CONTEXT                  │
│ • Interviews Section:                │ • Canonical Follow-ups overview      │
│   - Multi-round schedule             │ • Personal Application Notes         │
│   - Round prep notes & debrief       │ • Application Contacts Editor        │
│   - Interview participants           │   (Recruiters, hiring managers, etc.)│
│   - Questions, reflections & LeetCode│                                      │
│ • Interview-scoped Follow-ups        │                                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### Components
1. **Status Editor**: Dropdown triggering immediate server-side state transition.
2. **Notes Editor**: Autosaving / explicit-save textarea preserving markdown formatting.
3. **Canonical Follow-ups Overview**: `ApplicationFollowUpsSection` manages application-level
   reminders and shows interview-linked FollowUps without duplicating records.
4. **Application Contacts Editor**: CRUD for people involved in this application (see
   [`contacts-follow-ups-and-todos.md`](contacts-follow-ups-and-todos.md)).
5. **Interviews Section**: Detailed round management (see
   [`interviews-and-preparation.md`](interviews-and-preparation.md)).

Application Detail **MUST NOT** render the removed date-only Follow-up form or submit
`follow_up_on`. It has no legacy Follow-up date input, Tomorrow/Next week shortcuts, or Save/Clear
legacy controls.

## 6. Legacy `follow_up_on` compatibility state

`Application.follow_up_on` remains a date-only database column and is still serialized by selected
application list/detail/job-state response models for compatibility. It is not the behavioral
source for List, Board, Today, Dashboard, Application Detail, or Interview Follow-ups.

- New Application creation, FollowUp CRUD, and Interview completion **MUST NOT** write it.
- `PATCH /applications/{application_id}` **MUST** reject the field even when its value is null with
  HTTP 422 and detail `follow_up_on is deprecated; use the FollowUp endpoints instead`.
- The API **MUST NOT** silently ignore it or implicitly convert its date to a FollowUp.
- The column and compatibility response fields are not approved for removal. See
  [ADR-0002](../07-decisions/ADR-0002-canonical-follow-up-migration.md).

---

## 7. Concurrency and Snapshot Preservation

### Optimistic Concurrency Protection
To prevent accidental overwrites when a candidate has multiple tabs open:
- API requests include a version identifier (`record_version`).
- Conflicting updates return `409 Conflict`, requiring client-side reconciliation rather than silently clobbering recent edits.

### Historical Snapshot Capture
Upon transition to `applied`, the system freezes an immutable JSON snapshot of:
- Company name, title, and job URL.
- Full job description text.
- Resume version text.
- Match score and breakdown at application time.
Later modifications to global job catalog listings or candidate resumes do not alter this frozen snapshot.
