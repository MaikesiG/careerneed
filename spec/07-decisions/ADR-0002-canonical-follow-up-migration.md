# ADR-0002: Canonical FollowUp Migration and Legacy Application.follow_up_on Deprecation

## Status

Accepted / Current Compatibility State

Date: 2026-09-20

## Context

The original `Application.follow_up_on` field stores one date without a time, timezone, lifecycle,
or Interview relationship. It cannot represent multiple reminders, application and interview
scope, completion/reopening, or timezone-aware scheduling. Joining multiple reminder rows directly
to Application would also risk duplicate list rows and incorrect pagination.

Existing database and response compatibility prevents immediate removal of the legacy field.

## Decision

### Canonical record and lifecycle

`FollowUp` is the canonical behavioral source for reminders. Open means
`completed_at IS NULL`; completed means `completed_at IS NOT NULL`. The supported lifecycle is
create, edit, complete, reopen, and delete.

Every record **MUST** be owner-scoped through its Application. `user_id` **MUST** match the
Application owner. `interview_id` MAY be null for application scope; when present, the Interview
**MUST** belong to that Application and owner. The Application overview and Interview section may
show the same interview-scoped record without creating duplicate data.

### Application summaries

List, Board, and Dashboard application metrics **MUST** aggregate incomplete FollowUps by
`application_id` before joining Application. `MIN(due_at_utc)` supplies
`next_open_follow_up_at`; `COUNT(id)` supplies `open_follow_up_count`. The aggregate is owner-scoped
and outer-joined so one Application produces at most one row and Applications with no open record
remain present with null/zero summary values.

Due/overdue Dashboard summary values are Application counts. `GET /dashboard/follow-ups` remains
application-centric and returns at most one row per Application, controlled and ordered by its
earliest incomplete FollowUp.

### Date-sensitive behavior

`due_at_utc` is a UTC-aware instant and `timezone` is a validated IANA identifier. Date-sensitive
routes use a requested IANA timezone, defaulting to UTC where the parameter is optional. They
construct consecutive local calendar midnights, convert both to UTC, and use the half-open interval
`[utc_start, utc_next_start)`. They **MUST NOT** use server-local dates or add 24 hours to a UTC
boundary because DST local days may contain 23 or 25 hours.

### Legacy compatibility

`Application.follow_up_on` remains temporarily stored and serialized by selected compatibility
responses, but it is not an active behavioral source. New Application creation, FollowUp lifecycle
operations, and Interview completion **MUST NOT** write it.

`PATCH /applications/{application_id}` explicitly rejects any supplied `follow_up_on`, including
null, with HTTP 422 and exact detail:

`follow_up_on is deprecated; use the FollowUp endpoints instead`

The API **MUST NOT** silently ignore legacy input or implicitly convert a date into a FollowUp.

A local read-only audit reported `legacy_only = 0`, `canonical_only = 0`, `both = 1`, and
`neither = 0`. That local result means no local backfill is presently required; it is not evidence
that production or staging is ready for removal.

Before any future column or response-field removal, the project **MUST** repeat read-only audits in
relevant environments, identify external consumers, approve response deprecation, define rollback
and retention, evaluate an idempotent historical backfill, and review the migration plan.

## Consequences

- Multiple application- and interview-scoped reminders have one owner-safe lifecycle.
- List and Dashboard calculations remain pagination-safe and do not over-count Applications.
- Local-day behavior is explicit and DST-safe.
- The legacy column and response fields impose temporary compatibility cost and remain unavailable
  for new writes.
- Consumers must migrate to canonical FollowUp endpoints and summary fields before legacy response
  removal can be considered.
- Production/staging data and consumer validation remain future work; the legacy column is not
  approved for removal.

## Alternatives considered

- **Retain dual writes:** rejected because two behavioral sources can diverge.
- **Silently ignore legacy PATCH input:** rejected because it falsely signals a successful update.
- **Convert legacy date input automatically:** rejected because date-only input cannot preserve the
  user's intended instant, timezone, type, or scope.
- **Immediately remove the column and response fields:** rejected because compatibility and
  non-local data have not been fully audited.
- **Use server-local date semantics:** rejected because deployment timezone and DST would change
  user-visible classification.

## Verification

Focused tests cover owner isolation and application/interview relationship checks; create, edit,
complete, reopen, and delete behavior; exclusion of completed records from open summaries;
earliest-open aggregation and application counts; pagination safety; IANA validation and DST/local
midnight boundaries; explicit legacy input rejection without mutation; and the absence of legacy
dual writes from FollowUp lifecycle and Interview completion flows.

Related documentation:

- [Domain ownership](../01-domain/domain-model-and-ownership.md)
- [Lifecycle and state transitions](../01-domain/lifecycle-and-state-transitions.md)
- [Applications](../02-current-product/applications.md)
- [Contacts, FollowUps, and Today](../02-current-product/contacts-follow-ups-and-todos.md)
- [API and data conventions](../06-architecture/api-and-data-conventions.md)
- [Frontend architecture](../06-architecture/frontend-architecture-and-quality.md)
