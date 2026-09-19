---
status: archived
superseded_by: ../01-domain/domain-model-and-ownership.md
reason: Consolidated into authoritative domain model and ownership specification.
archived_date: 2026-09-19
---

> **ARCHIVED DOCUMENTATION**  
> This specification has been archived and superseded as part of the 2026-09-19 documentation consolidation.  
> It is preserved for historical decision context and provenance only. For current authoritative architecture, see [../01-domain/domain-model-and-ownership.md](../01-domain/domain-model-and-ownership.md).

# CareerNeed V2 Domain Architecture

> **Version:** 1.0  
> **Status:** Approved  
> **Scope:** Canonical domain objects, boundaries, relationships, historical context, and future extensibility.

## Core Principle

CareerNeed must keep the following concepts separate:

```text
Candidate Profile
Career Direction
Resume / Resume Version
Company
Canonical Job
Job Source
Match Result
Application
Interview
Follow-up
```

The separation prevents future rewrites when users have multiple career goals, multiple resumes, multiple job sources, AI-generated analysis, and historical job-search records.

## Core Domain Map

```text
Candidate Profile
  “What I can do”
        ↓
Career Direction
  “What I want to pursue”
        ↓
Resume Version
  “How I present relevant evidence”
        ↓
Canonical Job
  “What opportunity exists”
        ↓
Match Result
  “How this opportunity fits this goal and resume context”
        ↓
Application
  “What action I took”
        ↓
Interview
  “What happened and what I learned”
        ↓
Follow-up / Career Intelligence
  “What I should do next”
```

## Candidate Profile

Candidate Profile is the durable source of truth for a person’s professional capabilities.

```text
candidate_profiles
├── id
├── user_id
├── headline
├── summary
├── timezone
├── created_at
└── updated_at
```

Related data:

```text
candidate_experiences
candidate_skills
candidate_educations
candidate_projects
work_authorizations
```

Candidate Profile must not be overwritten when a user edits a Career Direction or Resume.

## Career Direction

Career Direction captures one job-search goal.

```text
career_directions
├── id
├── user_id
├── name
├── category
├── status                           active | paused | archived
├── is_default
├── preferred_resume_id
├── matching_config_id
├── created_at
├── updated_at
└── deleted_at
```

A user may have multiple directions:

```text
Full Stack Engineering       active
Frontend Engineering         active
Data Analytics               paused
Product Management           archived
```

## Resume and Resume Version

A Resume is a named targeting artifact. A Resume Version is immutable once used in a match or application.

```text
resumes
├── id
├── user_id
├── career_direction_id
├── name
├── status
└── timestamps

resume_versions
├── id
├── resume_id
├── version_number
├── content_snapshot
├── source_file_id
├── is_current
└── timestamps
```

## Company and Job

Company is a reusable employer entity.

```text
companies
├── id
├── name
├── normalized_name
├── website
├── industry_id
└── timestamps
```

Job is a canonical opportunity, not a source-specific duplicate.

```text
jobs
├── id
├── company_id
├── company_name_raw
├── title
├── normalized_role_id
├── description
├── status                           discovered | active | expired | closed | removed
├── discovered_at
├── last_seen_at
├── expires_at
└── timestamps
```

A job may have several source listings.

```text
job_sources
├── id
├── job_id
├── provider
├── external_id
├── source_url
├── source_status
├── source_last_seen_at
└── timestamps
```

## Match Result

Match Result is contextual. It must never be modeled as a permanent global Job score.

```text
Job
+ User
+ Career Direction
+ Resume Version
+ Work Authorization
+ Matching Configuration
+ Algorithm Version
+ Taxonomy Version
= Match Result
```

```text
job_match_results
├── id
├── user_id
├── job_id
├── career_direction_id
├── resume_version_id
├── matching_config_id
├── eligibility
├── eligibility_reasons
├── score
├── score_breakdown
├── matched_skills
├── missing_skills
├── strengths
├── risks
├── explanation
├── algorithm_version
├── taxonomy_version
├── input_snapshot
├── generated_at
└── superseded_at
```

## Application

Application represents an actual user action and current workflow state.

```text
applications
├── id
├── user_id
├── job_id
├── company_id
├── company_name_snapshot
├── job_title_snapshot
├── job_url_snapshot
├── career_direction_id
├── career_direction_snapshot
├── resume_version_id
├── resume_snapshot
├── job_match_result_id
├── match_snapshot
├── status
├── applied_at
├── next_follow_up_at
├── record_version
└── timestamps
```

Application must preserve historical truth even after job, direction, resume, or matching algorithm changes.

## Interview

```text
interviews
├── id
├── user_id
├── application_id
├── stage
├── status
├── scheduled_at_utc
├── timezone
├── duration_minutes
├── format
├── location_or_link
├── preparation_notes
├── outcome
├── outcome_notes
└── timestamps
```

```text
contacts
interview_participants
interview_questions
follow_ups
```

## Historical Integrity

The product must preserve:

```text
The resume used when applying
The direction selected when applying
The job title/company/URL shown at the time
The match result current at the time
Application status history
Interview history and questions
Follow-up completion history
```

Use a combination of:

```text
Immutable snapshots
Event timeline
Soft delete
Versioned match results
```

## Ownership

All user-owned resources must be scoped to the authenticated user.

```text
Candidate Profile
Career Direction
Resume
Resume Version
Application
Interview
Contact
Follow-up
User Job State
Job Match Result
AI Suggestion
```

Global catalog resources are platform-managed:

```text
Company
Canonical Job
Job Source
Taxonomy
System matching templates
```

## Future Organization Support

Do not prematurely make the current consumer model multi-tenant. When a real collaboration need exists, add:

```text
organizations
organization_memberships
roles
permissions
resource_grants
```

Maintain clean user ownership now so organization-level access can be introduced later.
