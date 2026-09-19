# Current Product: Contacts, Follow-ups, and the Today Dashboard

> **Status:** Implemented (Contacts CRUD, Follow-ups, Today Dashboard) / In Progress (Career Routines Integration)  
> **Owner:** CareerNeed Product & Engineering  
> **Last Updated:** 2026-09-19  
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

## 3. Follow-up Actions

A `FollowUp` is an actionable task record, completely distinct from an alert or notification delivery:

```python
class FollowUp(Base):
    __tablename__ = "follow_ups"

    id: uuid.UUID
    user_id: uuid.UUID                               # Authenticated owner
    application_id: uuid.UUID                        # Parent Application
    interview_id: uuid.UUID | None                   # Optional linked interview round
    type: str                                        # "thank_you", "status_check",
                                                     # "recruiter_reply", "preparation", "custom"
    title: str                                       # "Send thank-you email to Sarah"
    due_at_utc: datetime                             # Target completion timestamp (UTC)
    timezone: str                                    # User IANA timezone
    completed_at: datetime | None                    # Resolved timestamp
    notes: str | None                                # Task context / draft text
    created_at: datetime
    updated_at: datetime
```

### Follow-up Types
1. `thank_you`: Gratitude and technical clarification sent within 24 hours of an interview.
2. `status_check`: Follow-up message sent after an agreed recruiter timeline has elapsed.
3. `recruiter_reply`: Inbound recruiter inquiry requiring information or availability.
4. `preparation`: Dedicated study or practice task before a scheduled round.
5. `custom`: Custom user-defined milestone.

---

## 4. The Today Action Dashboard (`/todo`)

The Today dashboard aggregates urgent career tasks into a zero-clutter execution view:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ TODAY ACTION CENTER                                         Friday, Sep 19  │
├─────────────────────────────────────────────────────────────────────────────┤
│ SUMMARY: 1 Overdue · 2 Due Today · 1 Interview Today · 12 Active Apps       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🚨 OVERDUE FOLLOW-UPS                                                       │
│ [!] Follow up with Stripe recruiter on screening feedback (Due yesterday)   │
│     [ Mark Complete ] [ Snooze ] [ Open Application ]                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 📅 INTERVIEWS TODAY                                                         │
│ [●] 2:00 PM EDT — Datadog: Systems Architecture (Round 2)                 │
│     Meeting: Google Meet · Interviewer: Alex Chen                           │
│     [ View Prep Notes ] [ Open Meeting ↗ ]                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⏳ DUE TODAY                                                                │
│ [ ] Send thank-you note to Jane Doe @ Figma                                 │
│     [ Mark Complete ] [ Open Draft ]                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🗓️ UPCOMING INTERVIEWS (NEXT 7 DAYS)                                        │
│ [ ] Monday 10:00 AM — MongoDB Technical Screen                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Priority Order
1. **Overdue Follow-ups**: Follow-ups whose `due_at_utc` is in the past and `completed_at` is null.
2. **Interviews Today**: Interviews scheduled within the user's current calendar day.
3. **Follow-ups Due Today**: Actions maturing today in the user's timezone.
4. **Upcoming Interviews**: Confirmed rounds in the next 7 days.
5. **Applications Needing Update**: Applications with zero activity for >14 days.

### Dashboard APIs
- `GET /dashboard/summary`: Returns real-time counts (`follow_ups_due_today`, `follow_ups_overdue`, `applications_saved`, `applications_applied`, `applications_interviewing`, `active_applications`).
- `GET /dashboard/follow-ups`: Returns prioritized list of active applications with their due or overdue follow-up details.
