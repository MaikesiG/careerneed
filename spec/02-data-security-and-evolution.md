# Data Security, Privacy, and Database Evolution

> **Version:** 1.0  
> **Status:** Required Platform Standard  
> **Scope:** Authentication, access control, secrets, privacy, migrations, backups, retention, and future tenancy.

## Sensitive Data

CareerNeed processes sensitive personal data.

```text
Email addresses
Password hashes
Resume content
Employment history
Skills
Work authorization
Job-search preferences
Application records
Interview notes
Recruiter and interviewer contact details
AI-generated recommendations
```

## Authentication Rules

```text
Passwords are stored only as strong non-reversible hashes.
Raw passwords are never stored.
Password hashes never appear in API responses, logs, analytics, or client code.
Password reset tokens are stored as hashes.
Raw reset tokens and full reset URLs are never logged in production.
Resetting a password invalidates active sessions according to security policy.
```

## Secrets

Never commit, log, expose, or submit to analytics/AI providers:

```text
DATABASE_URL
Database passwords
Provider API keys
Private keys
Session cookies
Session tokens
Authorization headers
Password reset tokens
Full reset URLs
Passwords
Password hashes
```

Required `.gitignore` coverage:

```gitignore
.env
.env.*
!.env.example
```

## Object-Level Authorization

All user-owned endpoints must derive identity from the authenticated session.

```python
current_user = authenticated session user
```

Client-provided `user_id` is not trusted.

Every read/update/delete must include owner scope:

```python
select(Resource).where(
    Resource.id == requested_id,
    Resource.user_id == current_user.id,
)
```

UUIDs do not replace authorization.

## Soft Delete

User-facing deletion should normally be reversible.

```text
deleted_at
deleted_by
```

Rules:

```text
Default lists exclude deleted records.
Restore is available for a defined window.
Referenced resume/application/interview history is not silently destroyed.
Permanent deletion happens through controlled retention workflows.
```

## Data Export and Account Deletion

Before broader launch, CareerNeed must define:

```text
Export my data
Delete my account
Restore recently deleted content
Retention windows
Permanent deletion workflow
```

Exports must exclude internal secrets, other-user data, and security-sensitive system fields.

## Database Migration Rules

1. Use version-controlled Alembic migrations.
2. Review generated migrations before applying them.
3. Back up before high-risk or destructive changes.
4. Test migrations against representative data.
5. Prefer additive migrations.
6. Never run `drop_all()` in normal app startup/deployment flows.
7. Never rebuild tables to simulate migration.
8. Keep development, test, staging, and production database configuration separate.
9. Verify target database identity before migration.
10. Test restore procedures.

## Additive Migration Pattern

```text
1. Add nullable field/table
2. Deploy readers compatible with old/new structure
3. Backfill data
4. Validate backfill
5. Deploy writers using new structure
6. Enforce constraints after validation
7. Remove legacy field after controlled deprecation
```

## Backup Standard

```text
Backup
→ Verify backup exists
→ Run migration
→ Validate data and application behavior
→ Retain rollback/recovery path
```

Restore testing must happen in a separate database/environment.

## Privacy and AI

```text
AI use requires disclosure and minimized data transfer.
AI output is not source-of-truth user data until reviewed/accepted.
Meaningful AI classification must support user correction.
Provider/model/prompt/version metadata is stored for persisted AI outputs.
No user data is used for external model training without explicit consent/policy.
```

## Analytics Policy

Safe product events may include:

```text
career_direction_created
resume_version_created
job_saved
match_viewed
application_created
interview_scheduled
interview_completed
follow_up_completed
```

Never capture in generic analytics:

```text
Passwords
Tokens
Full resume body
Interview answers
Contact emails
Raw job descriptions
Database credentials
```

## Future Tenancy

The current model is user-owned. Future B2B/coach/team support should add explicit organization membership and permissions.

PostgreSQL Row-Level Security may later provide defense in depth, but does not replace application-layer object authorization.
