---
status: archived
superseded_by: ../02-current-product/resumes.md and ../01-domain/lifecycle-and-state-transitions.md
reason: Consolidated into current resume foundation and domain lifecycle.
archived_date: 2026-09-19
---

> **ARCHIVED DOCUMENTATION**  
> This specification has been archived and superseded as part of the 2026-09-19 documentation consolidation.  
> It is preserved for historical decision context and provenance only. For current authoritative architecture, see [../02-current-product/resumes.md](../02-current-product/resumes.md).

# Resume Versioning and Application Snapshots

> **Version:** 1.0  
> **Status:** Approved  
> **Priority:** P0  
> **Scope:** Resume artifacts, immutable versions, selected resume context, and historical application preservation.

## Purpose

A resume is a curated representation of Candidate Profile evidence.

```text
Candidate Profile
= Complete professional record

Resume
= Named targeting artifact

Resume Version
= Immutable version used for a job/application/match context
```

## Resume Model

```text
resumes
├── id
├── user_id
├── career_direction_id
├── name
├── status                           active | archived
├── created_at
├── updated_at
└── deleted_at
```

## Resume Version Model

```text
resume_versions
├── id
├── resume_id
├── version_number
├── content_snapshot
├── source_file_id
├── parsed_profile_snapshot
├── summary
├── is_current
├── created_at
└── updated_at
```

## Versioning Rules

```text
Editing a resume creates a new Resume Version.
A version used by an Application or Match Result is immutable.
Changing the current version does not alter history.
Archived resumes retain referenced versions.
A user can select a non-default resume version for an individual application.
```

## Application Snapshot Requirements

At application creation, retain:

```text
resume_version_id
resume_snapshot or durable document reference
career_direction_id
career_direction_snapshot
job_match_result_id
match_snapshot
company_name_snapshot
job_title_snapshot
job_url_snapshot
applied_at
```

## Snapshot Rationale

The following must not rewrite historical applications:

```text
Resume edits
Resume archival
Career Direction edits
Job changes
Company merges
Matching algorithm upgrades
Taxonomy changes
```

## API Rules

```text
GET    /resumes
POST   /resumes
GET    /resumes/{id}
PATCH  /resumes/{id}
DELETE /resumes/{id}

GET    /resumes/{id}/versions
POST   /resumes/{id}/versions
GET    /resume-versions/{id}
```

All resume and version endpoints enforce current-user ownership.

## Soft Delete Rules

```text
User deletion archives/soft-deletes first.
A version referenced by an Application cannot be normally hard deleted.
Historical files/content must remain available according to retention policy.
```

## Definition of Done

```text
Users can create multiple named resumes.
Each resume has ordered versions.
Application records show selected resume version.
Historical applications remain unchanged after later resume edits.
Referenced versions cannot be silently modified or deleted.
Every resume/version operation enforces ownership.
```
