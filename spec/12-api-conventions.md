# CareerNeed API Conventions

> **Version:** 1.0  
> **Status:** Required Engineering Standard  
> **Scope:** REST paths, authentication, ownership, validation, errors, pagination, idempotency, timestamps, and response conventions.

## Base Convention

Use one API-prefix convention consistently across the application.

Preferred:

```text
/api/auth
/api/career-directions
/api/jobs
/api/applications
/api/interviews
```

If the existing project intentionally uses direct prefixes such as `/auth`, maintain a documented consistent alternative rather than mixing both patterns.

## Resource Naming

```text
Plural nouns
Lowercase kebab-case paths
UUID identifiers in path parameters
```

Examples:

```text
GET    /api/career-directions
GET    /api/career-directions/{career_direction_id}
PATCH  /api/career-directions/{career_direction_id}

GET    /api/applications
POST   /api/applications
PATCH  /api/applications/{application_id}
```

## Static Route Ordering

Register static paths before dynamic paths where prefixes overlap.

Preferred:

```text
GET /api/taxonomy/career-roles
GET /api/career-directions/{career_direction_id}
```

Avoid placing static taxonomy routes under a dynamic route namespace where `taxonomy` could be parsed as an ID.

## Authentication

Protected routes obtain user identity from the server-side session.

```python
current_user = get_current_user(...)
```

Do not trust request body `user_id`.

## Ownership

Every query for user-owned resources includes authenticated owner scope.

```python
select(Resource).where(
    Resource.id == resource_id,
    Resource.user_id == current_user.id,
)
```

Nested resources validate both child and parent ownership.

## HTTP Methods

```text
GET     Retrieve
POST    Create or action with meaningful transaction semantics
PATCH   Partial update
PUT     Full replacement only
DELETE  Archive/soft delete unless true destructive deletion is explicit and approved
```

Use `PATCH` for optional partial update schemas.

## HTTP Status Codes

```text
200 OK                  Successful retrieval/update
201 Created             Successful creation
202 Accepted            Accepted asynchronous request
204 No Content          Successful action with no body
400 Bad Request         Invalid request state
401 Unauthorized        Missing/invalid authentication
403 Forbidden           Authenticated but prohibited where policy uses explicit forbidden
404 Not Found           Resource missing or hidden by ownership policy
409 Conflict            Uniqueness/concurrency/idempotency conflict
422 Unprocessable Entity Validation failure
429 Too Many Requests   Rate limit
500 Internal Server Error Unexpected server error
```

## Validation

```text
Validate at API boundary with Pydantic.
Normalize string input: trim whitespace, normalize supported identifiers.
Use controlled values for lifecycle/status fields.
Reject invalid values rather than silently ignoring them.
```

Pydantic v2 ORM responses use:

```python
model_config = ConfigDict(from_attributes=True)
```

## Error Response Shape

Use a consistent JSON error shape.

```json
{
  "detail": "Human-readable safe message",
  "code": "optional_machine_readable_code"
}
```

Do not expose:

```text
Stack traces
SQL errors
Secrets
Raw provider responses containing private data
Internal authorization detail
```

## Pagination

Offset pagination initial standard:

```text
GET /api/jobs?limit=25&offset=0
```

Response:

```json
{
  "total": 148,
  "limit": 25,
  "offset": 0,
  "items": []
}
```

Rules:

```text
Safe default limit
Maximum limit enforced server-side
Total is computed server-side
Use stable deterministic ordering
Cursor pagination may replace offset when catalog scale requires it
```

## Filtering

```text
Repeated query values or documented comma-separated values may be used.
Choose one convention consistently.
Validate filter values.
Return effective filters where default/override resolution is significant.
```

## Idempotency

Creation endpoints vulnerable to retries or duplicate clicks support:

```text
Idempotency-Key: client-generated-key
```

Applies especially to:

```text
Application creation
Job ingestion
AI processing request enqueueing
External webhook processing
```

## Concurrency

Mutable critical records should support optimistic concurrency.

```text
record_version
or
If-Match
```

Conflicting updates return `409 Conflict` rather than silently overwriting a newer change.

## Timestamps

```text
Store concrete times using timezone-aware UTC datetime.
Use DateTime(timezone=True).
Use the project utcnow() helper.
Store IANA timezone context where scheduling matters.
Use DATE for date-only source values.
```

## Response Security

Never include in responses:

```text
password_hash
raw password
session token
raw reset token
full reset URL
provider secrets
database credentials
another user’s private resource state
```

## Testing Standard

Every protected resource should test:

```text
Authentication required
Owner can create/read/update/archive
Another user cannot read/update/archive
Invalid payload is rejected
Lifecycle/transition constraints work
Pagination/filter behavior works where applicable
Idempotency and concurrency behavior work for relevant writes
```
