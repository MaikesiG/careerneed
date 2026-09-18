# Applications Workflow and Event Timeline

> **Version:** 1.0  
> **Status:** Approved  
> **Priority:** P0  
> **Scope:** Application lifecycle, current state, historical events, snapshots, user job state, deletion, and concurrency.

## Application Purpose

Application records a real user action and ongoing hiring-process state.

```text
Application
= What the user decided to do
= What the current process state is
= What history should be preserved
```

## Application State Machine

```text
saved
applied
screening
interview
offer
accepted
declined
rejected
withdrawn
on_hold
```

Suggested transitions:

```text
saved → applied | withdrawn | on_hold
applied → screening | interview | rejected | withdrawn | on_hold
screening → interview | rejected | withdrawn | on_hold
interview → offer | rejected | withdrawn | on_hold
offer → accepted | declined | withdrawn | on_hold
on_hold → saved | applied | screening | interview | offer | rejected | withdrawn
```

Terminal states:

```text
accepted
declined
rejected
withdrawn
```

Reopening terminal states requires an explicit action and timeline event.

## Application Model

```text
applications
├── id
├── user_id
├── job_id
├── company_id
├── company_name_snapshot
├── job_title_snapshot
├── job_url_snapshot
├── job_description_snapshot
├── career_direction_id
├── career_direction_snapshot
├── resume_version_id
├── resume_snapshot
├── job_match_result_id
├── match_snapshot
├── status
├── source                            saved_job | manual | import | referral | other
├── applied_at
├── next_follow_up_at
├── notes
├── record_version
├── created_at
├── updated_at
└── deleted_at
```

## Event Timeline

```text
career_events
├── id
├── user_id
├── application_id
├── interview_id
├── event_type
├── occurred_at
├── actor_type                        user | system | ai | import
├── actor_id
├── payload
├── created_at
└── created_by_version
```

Core events:

```text
application_created
application_status_changed
application_note_added
application_restored
resume_selected
match_generated
interview_scheduled
interview_rescheduled
interview_completed
interview_cancelled
follow_up_created
follow_up_completed
```

## Transaction Rule

Any operation changing application state must:

```text
Validate ownership and transition
→ update current Application state
→ create immutable Career Event
→ commit once
```

## User Job State

```text
user_job_states
├── id
├── user_id
├── job_id
├── career_direction_id
├── state                             unseen | viewed | saved | dismissed | applied
├── saved_at
├── dismissed_at
├── dismissal_reason
├── created_at
└── updated_at
```

Saved/dismissed/viewed/applied are user-specific and must never be stored globally on Job.

## Soft Delete

```text
Application deletion is soft delete by default.
Referenced interviews/follow-ups/events are preserved according to retention policy.
Normal lists exclude deleted records.
Restore supports a defined recovery window.
```

## Idempotency and Concurrency

Application creation supports:

```text
Idempotency-Key
```

Application update supports optimistic concurrency:

```text
record_version
or
If-Match
```

The API returns conflict instead of silently overwriting a newer edit.

## Definition of Done

```text
Application has an explicit state machine.
Historical snapshots are persisted.
Events are created for significant workflow changes.
User job states remain private/user-specific.
Create is idempotent.
Concurrent updates do not silently overwrite.
Delete is recoverable.
All access is owner-scoped.
```
