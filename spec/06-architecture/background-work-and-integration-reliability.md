# Architecture: Background Work, Integration Reliability, and External Boundaries

> **Status:** Authoritative Architecture Standard  
> **Owner:** CareerNeed Platform & Reliability Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** External integration timeouts, idempotency, safe retry boundaries, provider error normalization, secret redaction, and deferred asynchronous infrastructure.

---

## 1. Integration Reliability Principles

CareerNeed integrates with multiple external providers (ATS boards like Ashby/Greenhouse/Lever, third-party LLM providers, and file parsing utilities). 

To ensure external provider flakiness does not degrade candidate experience:
1. **Bounded Timeouts**: All external network calls enforce strict timeouts (HTTP requests: 15–30s maximum; background crawls: 60s).
2. **Safe Retry Boundaries**: Only transient errors (HTTP 429 rate limit, 502/503/504 gateway errors, network connection drops) are retried. Client errors (400, 401, 403, 404, 422) are never retried automatically.
3. **Exponential Backoff with Jitter**: Retries use exponential backoff with full jitter (e.g. $1\text{s} \to 2\text{s} \to 4\text{s}$ with random jitter) capped at 3 attempts.

---

## 2. Infrastructure Stance: Asynchronous Queues are Deferred / Conditional

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BACKGROUND INFRASTRUCTURE ARCHITECTURE STANCE           │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ ACTIVE MVP STANDARD                  │ DEFERRED / CONDITIONAL SCALE         │
│ (Phases 0–2: Keep Infrastructure Lean│ (Phases 3+: Introduced Only When     │
│  and Deterministic)                  │  Telemetry Metrics Demand It)        │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • Synchronous HTTP with bounded      │ • Dedicated Celery / RabbitMQ /      │
│   timeouts (15–30s)                  │   Redis distributed queue clusters   │
│ • Lightweight in-process background  │ • Distributed cross-service circuit  │
│   tasks (FastAPI BackgroundTasks)    │   breakers                           │
│ • Scheduled batch scripts via cron / │ • Independent worker microservices   │
│   scheduled cloud jobs               │                                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

**Anti-Complexity Invariant**: Do **not** prematurely introduce Celery, RabbitMQ, Redis queues, distributed circuit breakers, or separate worker microservices into early MVP specifications. Early phases must remain lean, testable, and operable as a unified containerized service.

---

## 3. Provider Error Normalization

External API errors are intercepted and translated into standardized internal domain codes before reaching application logic or clients:

```text
External Provider Error (e.g. OpenAI 429 / Lever 503)
                     │
                     ▼
        [ Error Normalization Layer ]
                     ├── Redacts Auth Headers & Query Keys
                     ├── Maps Status Code to Internal Enum
                     └── Logs Correlation Event
                     │
                     ▼
Safe Internal Response ({ "detail": "Service temporarily busy", "code": "ai_rate_limited" })
```

### Internal Error Code Vocabulary
- `provider_timeout`: External service failed to respond within deadline.
- `provider_rate_limited`: Rate limit ceiling encountered; client advised to retry later.
- `provider_unavailable`: 5xx upstream outage.
- `provider_authentication_failed`: Invalid internal credential (logged as critical alert).
- `provider_schema_invalid`: Upstream payload did not match expected Pydantic schema.

---

## 4. Secret Redaction and Observability Integrity

1. **Authorization Headers**: All outgoing integration logs automatically redact `Authorization`, `Bearer`, `X-API-Key`, and `Cookie` headers with `[REDACTED]`.
2. **Credential Secrets**: Raw third-party API credentials loaded from server-side environment or platform secrets are held in short-lived memory only during the outbound request and are never logged, persisted, or returned to clients.
3. **Correlation Tracking**: Outbound integration calls attach `X-Request-ID` and `X-Correlation-ID` to track downstream latencies and failure rates.
