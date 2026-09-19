# Architecture: API, Data Invariants, and Storage Conventions

> **Status:** Authoritative Architecture Standard  
> **Owner:** CareerNeed Platform & Data Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** RESTful API conventions, owner-scoped authorization, safe 404 behavior, error envelope, pagination, idempotency, timestamps, Alembic migrations, and private file storage standards.

---

## 1. Owner-Scoped Authorization and Safe 404 Semantics

CareerNeed enforces strict object-level authorization across all user-owned endpoints:

```python
# Authorization Invariant: Owner Scoping
current_user: User = Depends(get_current_user)

stmt = select(Application).where(
    Application.id == application_id,
    Application.user_id == current_user.id,
    Application.deleted_at.is_(None)
)
result = await db.execute(stmt)
app = result.scalar_one_or_none()

if app is None:
    # SAFE 404: Never return 403 or distinguish between non-existent vs unauthorized
    raise HTTPException(status_code=404, detail="Application not found")
```

### The Safe 404 Rule
- If an entity exists in the database but belongs to a different `user_id`, the API returns **`404 Not Found`**, strictly identical to a non-existent UUID.
- Returning `403 Forbidden` for other users' resource IDs is strictly prohibited because it leaks the existence of private entities to unauthorized callers.

---

## 2. API Conventions, Input Validation, and Error Envelopes

1. **REST Conventions**: Resource nouns, lowercase kebab-case paths (e.g. `/applications`, `/career-directions`).
2. **Strict Input Validation**: All request bodies and query parameters are parsed via Pydantic schemas. Extra, unexpected fields are forbidden (`extra = "forbid"`).
3. **Safe Error Envelope**: Unhandled exceptions and validation failures return standardized, safe JSON:
   ```json
   {
     "detail": "Human-readable explanation of error",
     "code": "resource_not_found"
   }
   ```
4. **Secret Sanitization**: Stack traces, raw SQL queries, database credentials, and internal file paths are never exposed in error responses.

---

## 3. Pagination, Idempotency, and Timestamps

### 3.1 Offset Pagination Standard
- Default page size: `limit = 20` (max allowed: 100).
- Offset: `offset = 0`, `20`, `40`...
- Total count returned via headers (`X-Total-Count`, `X-Total-Pages`) or response envelopes.

### 3.2 Idempotent Mutations
- Critical creation and ingestion endpoints support an optional `Idempotency-Key` header (UUID or client token).
- Repeated submissions with the same key within a 24-hour window return the cached initial response without executing duplicate database mutations.

### 3.3 UTC Timestamps and IANA Timezones
- All database columns storing timestamps use `DateTime(timezone=True)` storing UTC.
- User-facing schedule calculations store the associated IANA timezone (e.g. `America/Toronto`).

---

## 4. Additive Alembic Database Migrations

- Every schema modification must be represented as a discrete Alembic migration script under version control.
- **Additive Evolution Invariant**: Migrations must be backwards-compatible (e.g. adding nullable columns or columns with defaults). Destructive operations (dropping columns, changing types) require a multi-release deprecation cycle.
- Seed scripts and migrations must be fully idempotent.

---

## 5. Private File Storage, Parsing, and Safe Exports

```text
File Upload ──► Type Allowlist Check ──► 10MB Ceiling ──► Private Storage Key
                                                                 │
                                                                 ▼
Sanitized Plain Text ◄── Strip Code & Macros ◄── Safe Parsing Sandbox
```

1. **Storage Topology & Isolation**:
   - **Local Development**: Ignored local filesystem directories (e.g. `uploads/`, strictly ignored by version control) used solely for non-production test data.
   - **Production**: Private object storage (e.g. S3-compatible) or platform-managed encrypted persistent storage accessed strictly behind an abstract `StorageService` interface. The final provider choice remains open until production infrastructure topology is finalized.
   - **Non-Public Storage**: Storage containers or buckets must never be publicly accessible. All storage keys use non-enumerable, randomized UUID paths (`users/{user_id}/resumes/{uuid}.pdf`).
2. **Download Authorization**: File retrieval endpoints verify `user_id` ownership before streaming bytes or issuing short-lived (5-minute) pre-signed download URLs.
3. **Safe Parsing Sandbox**:
   - Zero macro, formula, or script execution.
   - Rejects malformed binary streams or non-printable control characters.
4. **Permanent Purge & Provenance**:
   - Soft-deleted files retain metadata during a 30-day recovery window before permanent purge.
   - Deleting a source file deletes or unlinks derived AI summaries according to explicit user selection.
5. **Safe Data Exports**: Data exports (`careerneed-export.json`, `.csv`) omit password hashes, session cookies, and third-party API credentials.
6. **Future Malware & Content Scanning**: A security hook is reserved for automated malware scanning and content inspection prior to parsing untrusted file streams.
