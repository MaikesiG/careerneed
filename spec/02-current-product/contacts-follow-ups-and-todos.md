# Current Product: Contacts, Follow-ups, and the Today Dashboard

> **Status:** Implemented (Contacts CRUD, Follow-ups, Today Dashboard) / In Progress (Career Routines Integration)  
> **Owner:** CareerNeed Product & Engineering  
> **Last Updated:** 2026-09-20  
> **Scope:** Canonical reusable contacts, application-scoped contacts, actionable follow-up tasks, and the Today daily focus dashboard (`/todo`).

---

## 1. Module Overview and Current Status

This module ensures candidates never drop recruiter communications, miss critical follow-ups, or lose track of interviewers across multi-round hiring loops.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAPABILITY STATUS BREAKDOWN                       │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Shipped & Verified in Code           │ • Canonical Contact CRUD (`/contacts`)│
│                                      │ • Application Contacts CRUD          │
│                                      │ • Explicit "Make reusable" conversion │
│                                      │ • Participant linking to contacts    │
│                                      │ • FollowUp action items with due UTC │
│                                      │ • Dashboard summary API (`/summary`) │
│                                      │ • Today Focus Dashboard (`/todo`)    │
│                                      │ • Due vs overdue prioritization      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ In Progress (Active Milestone)       │ • Linked reusable contact badges     │
│                                      │ • Actionable prep tasks in Today     │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ Planned (Subsequent Phases)          │ • Career Routines (Phase 2)          │
│                                      │ • Automated follow-up recommendations│
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Reusable Contacts and Application Contacts

CareerNeed supports both global reusable candidate contacts and application-scoped contact snapshots:

```text
       Canonical Contact (Global Reusable Record)
             │
             ├──► Linked via contact_id
             ▼
     ApplicationContact (Application-Scoped Snapshot)
             ▲
             └──► Unlinked Legacy Snapshot (Can be converted to Canonical)
```

### 2.1 Canonical Contact Model (`contacts`)
Stores person metadata reusable across multiple applications and interview rounds:
- `id`: UUID primary key.
- `user_id`: Authenticated owner.
- `name`: Full name.
- `title`: Professional title (e.g., "Technical Recruiter", "Staff Infrastructure Engineer").
- `email`: Normalized contact email.
- `linkedin_url`: Validated HTTPS LinkedIn profile URL.
- `relationship_type`: `recruiter`, `interviewer`, `hiring_manager`, `referral`, `networking`, `other`.
- `notes`: Private candidate notes regarding this person.

### 2.2 Application Contact Model (`application_contacts`)
Stores contacts associated with a specific application:
- Preserves snapshot fields (`name`, `contact_type`, `email`, `linkedin_url`, `notes`).
- Optional foreign key `contact_id` pointing to a canonical `Contact`.
- **Make Reusable Endpoint**: Unlinked legacy records can be explicitly converted to canonical contacts via `POST /applications/{id}/contacts/{contact_id}/make-reusable`.

---

## 3. Canonical FollowUp actions

A `FollowUp` is the canonical behavioral source for a reminder. It is distinct from notification
delivery and owns `id`, `user_id`, `application_id`, optional `interview_id`, `type`, `title`,
`due_at_utc`, `timezone`, `completed_at`, `notes`, `created_at`, and `updated_at`.

### Invariants and lifecycle

- The authenticated owner and owning Application **MUST** match. A linked Interview **MUST**
  belong to that same Application and owner.
- Application scope means `interview_id` is null. Interview scope means it is set.
- Open means `completed_at IS NULL`; completed means `completed_at IS NOT NULL`.
- The lifecycle is create, edit, complete, reopen, and delete.
- `thank_you`, `status_check`, `recruiter_reply`, `preparation`, and `custom` are the strict types.
- `due_at_utc` **MUST** be a UTC-aware instant and `timezone` **MUST** be a valid IANA identifier.
- FollowUp mutations **MUST NOT** update `Application.follow_up_on`.

One interview-scoped record may appear in both `InterviewFollowUpsSection` and the application-wide
`ApplicationFollowUpsSection`. Those are two views of one record, coordinated within Application
Detail by a route-local revision callback rather than duplicate persistence.

## 4. Application aggregation

List, Board, and Dashboard application metrics are application-based, not FollowUp-row-based.
The owner-scoped incomplete aggregate groups by `application_id`, computes
`MIN(due_at_utc)` and `COUNT(id)`, and is outer-joined to Application.

- `next_open_follow_up_at` is the earliest incomplete due instant.
- `open_follow_up_count` counts all incomplete records.
- Completed records do not contribute.
- Applications with no open record return null and zero.
- Multiple records **MUST NOT** duplicate Application rows or alter pagination/count semantics.

Application List filters use the earliest open instant: `all`, `scheduled`, `today`, and `overdue`.
Dashboard summary due/overdue values count Applications; each Application contributes at most once
based on its earliest incomplete FollowUp. `GET /dashboard/follow-ups` likewise returns at most one
compatibility row per Application, ordered by that earliest instant; its `follow_up_on` response is
a compatibility date derived in the requested timezone, not a read of the legacy column.

## 5. Today and timezone behavior

`GET /dashboard/today` returns fixed-priority groups: overdue FollowUps, interviews today,
FollowUps due today, upcoming interviews, and applications needing update. The last group currently
has a stable empty shape because no explicit staleness convention exists.

Date-sensitive routes use an IANA `timezone` query parameter. `GET /applications`,
`GET /dashboard/summary`, and `GET /dashboard/follow-ups` default it to UTC;
`GET /dashboard/today` receives it from the Today client. Invalid identifiers return HTTP 422.

The local-day algorithm **MUST**:

1. determine the current UTC instant and requested local date;
2. construct that date's local midnight and the following calendar day's local midnight;
3. convert both boundaries to UTC; and
4. classify with `[utc_start, utc_next_start)`.

Implementations **MUST NOT** use server-local `date.today()` or calculate the next boundary as
`utc_start + 24 hours`; local DST days may contain 23 or 25 hours. Exact next local midnight belongs
to the new day, not the preceding day.

The browser timezone is sent only in API requests. It is not stored in visible URL parameters and
is not currently a persisted account preference. Display uses the stored workflow timezone or a
safe browser-local fallback depending on the surface.

## 6. Legacy compatibility

`Application.follow_up_on` remains stored and is serialized by selected Application contracts, but
it is not active behavior for List, Board, Today, Dashboard, Application Detail, or Interview
Follow-ups. PATCH input is explicitly rejected; there is no dual write, silent no-op, or implicit
date-to-FollowUp conversion. Removal remains deferred under
[ADR-0002](../07-decisions/ADR-0002-canonical-follow-up-migration.md).

See also [Applications](applications.md), [Interviews](interviews-and-preparation.md), and
[API and data conventions](../06-architecture/api-and-data-conventions.md).
