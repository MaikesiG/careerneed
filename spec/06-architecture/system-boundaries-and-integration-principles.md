# System Boundaries, Integration Standards, and Architecture Principles

> **Status:** Authoritative Architecture Standard  
> **Owner:** CareerNeed Lead Architect & Platform Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Core system boundaries, frontend state ownership, backend API standards, database conventions, and anti-complexity rules.

---

## 1. System Architecture Boundaries

CareerNeed is architected as a modular, monolithic application with clean separation of concerns across three core runtime tiers:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CAREERNEED TIER TOPOLOGY                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Web Tier (apps/web)                                                      │
│    Next.js (App Router) · React · TypeScript · Tailwind CSS                 │
│    State Management: Server State (TanStack Query), URL State, Forms (RHF) │
├──────────────────────────────────────┬──────────────────────────────────────┤
│                                      │ HTTP (Credentials Included)          │
│                                      ▼                                      │
│ 2. API Tier (apps/api)                                                      │
│    FastAPI · Python · Pydantic v2 · Server-Side Model Routing               │
│    Enforces Session Auth, Object-Level Authorization, and Business Logic   │
├──────────────────────────────────────┼──────────────────────────────────────┤
│                                      │ SQLAlchemy 2.0 Typed ORM             │
│                                      ▼                                      │
│ 3. Data Tier                                                                │
│    PostgreSQL (Relational Storage) · Alembic Migrations                     │
│    Private Object Storage (PDFs & Career Memory Archives)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Anti-Complexity Architecture Invariants
- **No Premature Microservices**: The system remains a clean modular monolith. Domain boundaries are enforced via Python modules and directory structures, not distributed network RPCs.
- **No Premature Queue Infrastructure**: Initial AI generations and background evaluations execute synchronously with bounded HTTP timeouts (15–30s). Worker queue engines (Celery/RabbitMQ) will be introduced only when asynchronous scale metrics require them.
- **No Premature Vector Databases**: Vector storage is deferred to Phase 3. Structured SQL queries and full-text search satisfy early retrieval needs.

---

## 2. Frontend State Ownership Standard

To prevent state synchronization bugs and race conditions, state is categorized into four mutually exclusive owners:

| State Category | Sole Owner | Examples | Storage Location |
|---|---|---|---|
| **1. Server State** | TanStack Query | Jobs, Applications, Interviews, Questions, Resumes, Contacts. | TanStack Query cache. Never copied to Zustand. |
| **2. URL State** | Search Parameters | Active filters, page offsets, search keyword, selected Career Direction. | Browser URL query string. Single source of truth for list views. |
| **3. Form State** | React Hook Form + Zod | Application editing, interview question drafts, prep note inputs. | Form hook memory. Validated client-side before submit. |
| **4. Local UI State** | React `useState` | Modal open/closed, expanded rows, active tabs, inline error banners. | Component tree memory. |

---

## 3. Backend API Integration Conventions

1. **RESTful Resource Naming**: Plural lowercase kebab-case paths (e.g. `/applications`, `/interviews`, `/career-directions`).
2. **Strict Session Derivation**: The authenticated user identity is derived strictly from verified HTTP-only session cookies via `get_current_user`. Client-supplied `user_id` is never trusted.
3. **Pydantic Validation**: Every request payload is validated with strict Pydantic schemas. Response models use `model_config = ConfigDict(from_attributes=True)` and explicitly omit password hashes and secrets.
4. **Standardized Error Envelope**:
   ```json
   {
     "detail": "Human-readable safe error message",
     "code": "optional_machine_readable_code"
   }
   ```
5. **Deterministic Pagination**: Initial standard uses offset pagination (`limit` default 20/25, max 100; `offset` integer). Total counts are calculated server-side and returned via headers or envelopes.
6. **Idempotency**: Critical write endpoints (e.g. creating applications or enqueueing parsing tasks) support an optional `Idempotency-Key` header.
7. **Optimistic Concurrency**: Mutable entities (`applications`, `career_directions`) track a `record_version` or timestamp. Conflicting concurrent writes return `409 Conflict`.
8. **Timezone-Aware Timestamps**: All real timestamps are stored in PostgreSQL as `DateTime(timezone=True)` using UTC.
