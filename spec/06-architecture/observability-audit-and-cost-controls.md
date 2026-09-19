# Architecture: Observability, Audit Logging, and AI Cost Controls

> **Status:** Authoritative Platform Standard  
> **Owner:** CareerNeed Platform & Reliability Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Structured correlation logging, telemetry metrics, health check endpoints, restore testing, AI cost tracking, and emergency kill switches.

---

## 1. Observability Principles

1. **Correlation Across System Tiers**: Every HTTP request, AI generation, and background execution carries a unique `request_id` and optional `task_id` for end-to-end tracing.
2. **Strict Telemetry Sanitization**: Telemetry must never become a back-channel data leak for passwords, tokens, full resume texts, or private interview reflections.
3. **Actionable Alerts Only**: Alerts are bound to verified failure thresholds and linked to explicit operational runbooks.

---

## 2. Structured Correlation Logging

All logs are formatted as structured JSON with mandatory standard correlation fields:

```json
{
  "timestamp": "2026-09-19T14:32:01.124Z",
  "level": "INFO",
  "service": "api",
  "release": "v0.8.2",
  "request_id": "req_01j8m4n7b3q2",
  "route": "/applications/{id}/interviews",
  "method": "POST",
  "status_code": 201,
  "duration_ms": 42,
  "user_id_hash": "sha256:4a3b8c...",
  "entity_type": "interview",
  "entity_id": "8b51a5c1-3f40-429a-9e19-012b1d3c87e0"
}
```

### Strictly Forbidden from Logs
- Raw passwords and password hashes.
- Session tokens, reset tokens, and cookie values.
- Unmasked external API keys or server-side secret values.
- Full plain-text resumes or interview debrief reflections.
- Private contact emails in broad application telemetry.

---

## 3. Health Checks and Service Readiness

CareerNeed exposes standardized endpoints to distinguish process liveness from dependency readiness:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SERVICE HEALTH CHECK CONTRACT                      │
├───────────────────┬─────────────────────────────────────────────────────────┤
│ GET /health/live  │ Returns 200 OK if the FastAPI worker process is running.│
│                   │ Does not query external providers or database pools.    │
├───────────────────┼─────────────────────────────────────────────────────────┤
│ GET /health/ready │ Returns 200 OK only if:                                 │
│                   │ 1. PostgreSQL pool is connected and queryable.          │
│                   │ 2. Current database schema matches active Alembic head. │
│                   │ 3. Essential local storage mounts are writable.         │
└───────────────────┴─────────────────────────────────────────────────────────┘
```

---

## 4. AI Cost Tracking and Emergency Kill Switches

To prevent runaway API bills and protect against upstream model outages, CareerNeed enforces fine-grained cost governance:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI GOVERNANCE CONTROLS                            │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ Token Budgeting     │ Hard prompt and completion token ceilings per request │
│                     │ (e.g. max 2,000 output tokens for prep brief).        │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ Cost Accounting     │ Live cost calculation stored per generation in        │
│                     │ `ai_suggestions.total_cost_usd`.                      │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ Rate Limiting       │ Per-user daily limits (e.g. max 10 prep brief runs/day│
│                     │ on platform tier).                                    │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ Emergency Kill      │ Environment-level feature toggles:                    │
│ Switches            │ • `AI_ENABLED=true/false`                             │
│                     │ • `AI_INTERVIEW_PREP_ENABLED=true/false`              │
│                     │ • `AI_PROVIDER_OPENAI_ENABLED=true/false`             │
└─────────────────────┴───────────────────────────────────────────────────────┘
```

**Graceful Degradation**: If an AI kill switch is engaged, the platform returns a user-friendly advisory message and keeps all manual preparation notes, interview schedules, and application workflows 100% operational.

---

## 5. Backup Verification and Recovery Testing

- **Scheduled Backups**: Automated PostgreSQL snapshots executed daily, stored in dedicated, access-restricted backup storage.
- **Mandatory Restore Drills**: Backups are not considered valid until verified via scheduled restore drills into an isolated staging database. Under no circumstances are restore drills tested against active production instances.
