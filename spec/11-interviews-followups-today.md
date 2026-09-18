# Interviews, Follow-ups, and Today

> **Version:** 1.0  
> **Status:** Approved  
> **Priority:** P0 for Interviews; P1 for reusable Contacts and Today integration  
> **Scope:** Interview rounds, participants, questions, preparation, outcomes, follow-up tasks, and daily action view.

## Purpose

CareerNeed must support multi-round interviewing without forcing users to reconstruct their history from email and notes.

```text
Application
└── Interview
    ├── Participants
    ├── Preparation
    ├── Questions
    ├── Reflection
    ├── Outcome
    └── Follow-up
```

## Interview Model

```text
interviews
├── id
├── user_id
├── application_id
├── stage
├── status                           scheduled | completed | cancelled | rescheduled
├── scheduled_at_utc
├── timezone
├── local_start_label
├── duration_minutes
├── format                           video | phone | in_person | online_assessment | other
├── location_or_link
├── preparation_notes
├── outcome                          pending | advance | rejected | offer | withdrawn | unknown
├── outcome_notes
├── created_at
├── updated_at
└── deleted_at
```

Suggested stages:

```text
recruiter_screen
hiring_manager
technical
behavioral
system_design
case_study
onsite
final
other
```

## Contacts

Contacts are reusable across applications/interviews.

```text
contacts
├── id
├── user_id
├── company_id
├── name
├── title
├── email
├── linkedin_url
├── relationship_type                recruiter | interviewer | hiring_manager | referral | networking | other
├── notes
├── source_type
├── confidence
├── created_at
├── updated_at
└── deleted_at
```

```text
interview_participants
├── id
├── interview_id
├── contact_id
├── role                             interviewer | coordinator | observer
├── created_at
└── updated_at
```

## Interview Questions

```text
interview_questions
├── id
├── interview_id
├── question
├── category                         behavioral | technical | coding | system_design | case | product | culture | other
├── difficulty                       easy | medium | hard | unknown
├── answer_notes
├── reflection
├── leetcode_url
├── asked_at
├── created_at
├── updated_at
└── deleted_at
```

LeetCode links:

```text
Use validated HTTPS URLs.
Open in a new tab.
Use rel="noopener noreferrer".
```

## Follow-ups

```text
follow_ups
├── id
├── user_id
├── application_id
├── interview_id
├── type                             thank_you | status_check | recruiter_reply | preparation | custom
├── title
├── due_at_utc
├── timezone
├── completed_at
├── notes
├── created_at
├── updated_at
└── deleted_at
```

## Today

Today is a focused action page.

Priority order:

```text
Overdue follow-ups
Interviews today
Follow-ups due today
Upcoming interviews
Applications needing update
```

## Timezone Rules

```text
Store concrete scheduled/due times in UTC.
Store IANA timezone for interview context.
Do not use server-local time as permanent event time.
Use DATE only when source data contains only a date.
```

## Fast Capture

Fast Capture is an optional assisted flow:

```text
Paste invite/message
→ parser extracts suggested fields
→ user previews
→ user edits/approves
→ Interview is created
```

Manual interview creation must remain complete and usable when AI is unavailable.

## AI Preparation

AI preparation is optional and must use:

```text
Job snapshot
Resume Version snapshot
Career Direction context
Interview stage
Known participant information
Past reflections where user permits
```

AI output should be reviewable and never silently overwrite preparation notes or questions.

## Definition of Done

```text
Users can create/schedule/reschedule/complete/cancel interviews.
One interview supports multiple participants.
Questions, answer notes, reflections, and LeetCode links are separately stored.
Follow-ups can be created and completed.
Today correctly surfaces upcoming and overdue items in user timezone.
All private records are owner-scoped.
Core CRUD works without AI availability.
```
