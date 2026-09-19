# Controlled AI Architecture and Provider Integration

> **Status:** In Progress / Mock-Tested (Server-Side Routing & Structured Provider Adapters)
> **Owner:** CareerNeed AI Platform Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Server-side model routing, model registry, server-side secret management, provider isolation, structured output enforcement, and audit observability.

---

## 1. Architectural Overview

CareerNeed uses a centralized, **server-side model routing architecture**. All interactions with external LLM providers pass through authenticated, backend-controlled routing layers:

```text
Web Client ──► Authenticated API Router ──► Model Router & Registry ──► External Provider
                     │                              │
                     ▼                              ▼
             Session Verified              Server-Side / Platform
                                            Secret Configuration
```

### Architectural Invariants
- **Zero Client-Side Keys**: API keys never reach the browser or client-side storage.
- **Strict Server Routing**: All prompt construction, credential resolution, rate limiting, and output validation execute strictly on the backend.
- **Provider Decoupling**: Application domain code interacts with abstract capabilities (e.g. `generate_prep_brief()`), never directly with vendor-specific SDKs.
- **No Premature Queue Architecture**: Initial AI capabilities execute synchronously with bounded timeouts (e.g. 15–30s). Complex asynchronous worker queues (Celery, RabbitMQ, Redis queues) are intentionally deferred until scale demands it.

---

## 2. Server-Side Credential Management and Boundaries

### 2.1 Credential Boundaries
AI credentials and API keys are strictly server-side only:
- **Local Development**: Configured using ignored local environment configuration (e.g. `.env.local`, which is strictly ignored by version control).
- **Production**: Configured using the deployment platform's managed secret configuration or an approved cloud secret-management mechanism.
- **Non-Negotiable Redaction & Security**: Credentials must never be committed to source control, exposed to the browser or client-side code, logged in application telemetry, persisted in application database records, or returned by any API endpoint.
- **Encryption-at-Rest Scope**: Do not claim an application-level encryption-at-rest implementation (e.g. database-stored encrypted keys) unless a specific specification explicitly documents a real, verified implementation and its operational scope.

### 2.2 Provider Key Access Hierarchy
When executing an AI capability:
1. **Server-Side Environment Secrets**: The server resolves API keys from the secure platform environment configuration.
2. **Quota & Rate Limits**: Requests are bounded by per-user tier limits (tracked in `usage_logs`).
3. **Deterministic Fallback**: If no AI provider is configured or available, the system falls back to deterministic parsing (e.g. regex-based skill extraction for resumes).

---

## 3. Strict Provider Isolation and Expansion Policy

### 3.1 Distinct Providers: Groq vs xAI / Grok
To avoid catastrophic configuration errors, the system maintains strict distinctions:
- **Groq**: An independent low-latency inference provider running open-weights models (e.g. Llama 3).
- **xAI / Grok**: A proprietary model family developed by xAI.
**Rule**: These providers are completely distinct services with separate base URLs, SDKs, and authentication headers. They must **never** be conflated or shared under a single configuration key.

### 3.2 One-at-a-Time Integration Stance
To maintain stability and cost control:
1. No provider adapter is treated as completed until a specific spec and accompanying test suite verify it.
2. Provider integrations are introduced **one at a time**, beginning with a single structured-output provider.
3. Every new provider must pass comprehensive mock integration tests before production rollout.

### 3.3 Configuration-Controlled Provider Selection Policy
Long-lived specifications must not be permanently hard-coded to specific model versions. Provider and model choices are strictly configuration-controlled:
1. **Selection Criteria**: Provider selection depends on schema adherence, reliability, latency, cost, privacy (zero data retention), regional availability, SDK maturity, and operational readiness.
2. **Active Adapter Status**: The OpenAI structured-output adapter is currently **In progress / mock-tested** (live provider smoke test pending or blocked until billing/model entitlement succeeds; not production-validated). It is an active integration candidate rather than a permanent platform lock-in.
3. **Conditional Second Provider**: Any evaluation or integration of a second provider is strictly conditional on evidence gathered from quality, schema adherence, latency, failure rate, cost, action value, availability, and operational risk during real-use evaluation. No specific future provider is pre-selected as the automatic next step.

---

## 4. Structured Output Validation

All AI responses must strictly conform to strongly typed Pydantic models:

```text
Model Response JSON ──► Pydantic Model Validator ──► Validated Domain Schema
                               │
                               ▼ (Validation Error)
                       Safe Error Handled & Logged
```

- **Server-Side Enforcement**: Raw text responses are never rendered directly to users without passing Pydantic validation.
- **Fail-Safe Normalization**: If a model produces malformed JSON or violates schema constraints, the request returns a safe, standardized error code (`ai_schema_validation_failed`) rather than crashing or leaking model artifacts.

---

## 5. Audit Logging and Cost Observability

Every AI generation records an audit entry in `ai_suggestions`:

```python
class AISuggestionAudit(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    suggestion_type: str
    
    # Provider & Model Metadata
    model_provider: str
    model_version: str
    prompt_version: str
    output_schema_version: str
    input_snapshot_hash: str
    
    # Operational Telemetry
    prompt_tokens: int | None
    completion_tokens: int | None
    total_cost_usd: float | None
    execution_duration_ms: int
    status: str                                      # "pending", "accepted", "rejected", "edited", "failed"
```

### Telemetry Rules
- Structured logs record execution latency, token counts, and safe error codes.
- **Never Logged**: Raw prompts containing private candidate data, unmasked API keys, or raw external error bodies.
