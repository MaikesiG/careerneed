# Background Jobs and Integration Reliability

> **Version:** 1.0  
> **Status:** Required Before Asynchronous Integrations Scale  
> **Priority:** P1  
> **Scope:** Background task lifecycle, retries, idempotency, provider integrations, scheduling, reconciliation, cost boundaries, and failure handling.

---

## 1. Purpose

CareerNeed contains workflows that should not execute entirely inside a user-facing HTTP request.

Examples:

```text
Resume text extraction
File scanning
AI profile extraction
AI interview preparation
Fast Capture parsing
Job source synchronization
Job deduplication
Company normalization
Location normalization
Match generation
Email delivery
Reminder generation
Data export
Backup/reconciliation tasks
```

These workflows may be slow, costly, rate-limited, unreliable, or dependent on external providers.

```text
HTTP request
→ validate/create business intent
→ enqueue task
→ return stable pending state
→ worker executes task
→ update result/status
→ user/operator can inspect/retry safely
```

---

## 2. Principles

1. **Do not require browser requests to remain open.**
2. **Tasks must be idempotent.**
3. **Retries must be bounded.**
4. **Transient failures should retry; permanent failures should not loop forever.**
5. **User-initiated work needs visible pending, success, failed, and retry states.**
6. **External provider calls require rate limits, timeouts, cost budgets, and kill switches.**
7. **Tasks must not create duplicate applications, jobs, matches, files, notifications, or emails.**
8. **Logs and errors must remain safe and must not expose secrets or sensitive contents.**
9. **A scheduled reconciliation path is required when webhooks or polling fail.**
10. **Core manual CRUD must remain useful if workers or AI providers are unavailable.**

---

## 3. Background Task Model

```text
background_tasks
├── id
├── task_type
├── user_id
├── entity_type
├── entity_id
├── idempotency_key
├── payload_reference
├── status
├── priority
├── attempt_count
├── max_attempts
├── next_attempt_at
├── started_at
├── completed_at
├── error_code
├── error_message_safe
├── created_at
└── updated_at
```

Suggested values:

```text
status:
queued
running
succeeded
failed
cancelled
dead_letter

priority:
critical
high
normal
low
```

`payload_reference` should point to a controlled database record/object rather than duplicating sensitive raw payloads into task rows where possible.

---

## 4. Task Types

Initial task types:

```text
file_scan
resume_text_extract
resume_profile_extract
job_source_sync
job_source_reconcile
job_normalize
job_deduplicate
company_resolve
location_normalize
job_match_generate
interview_fast_capture_extract
interview_prep_generate
interview_outcome_analysis
follow_up_generate
notification_deliver
password_reset_email_deliver
data_export_generate
file_purge
soft_deleted_record_purge
backup_verify
```

Each task type must document:

```text
Input source
Idempotency key
Timeout
Maximum retry attempts
Retryable errors
Non-retryable errors
User-visible state
Expected output
Operator alert threshold
Cost/rate-limit behavior
```

---

## 5. Idempotency

### 5.1 Rule

A task may execute more than once because of:

```text
Worker retry
Network timeout
Queue redelivery
User repeat click
Webhook replay
Scheduled reconciliation
Deployment interruption
```

The resulting business state must be correct even if the task is executed repeatedly.

### 5.2 Idempotency examples

| Task                     | Suggested key / uniqueness rule                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Resume extraction        | `file_id + extraction_version`                                                                      |
| File scan                | `file_id + scanner_version`                                                                         |
| Job source sync          | `provider + external_id + source_scope`                                                             |
| Job normalization        | `job_id + source_updated_at + normalization_version`                                                |
| Job match generation     | `user_id + job_id + career_direction_id + resume_version_id + algorithm_version + taxonomy_version` |
| Fast Capture extraction  | `user_id + submitted_text_checksum + parser_version`                                                |
| AI interview preparation | `interview_id + resume_version_id + prompt_version + model_version`                                 |
| Notification delivery    | `notification_id + channel + delivery_attempt_window`                                               |
| Data export              | `user_id + export_scope + request_id`                                                               |

### 5.3 Business-level idempotency

Where the task creates business records, use unique constraints or transaction-safe upserts.

Examples:

```text
JobSource(provider, external_id) unique
One active current Match Result for context/version
One notification delivery per notification/channel/attempt
One resume extraction result per file/version
```

Do not rely only on worker memory or a client-side button state.

---

## 6. Retry Policy

### 6.1 Retryable failures

Examples:

```text
Temporary provider outage
Network timeout
HTTP 429 rate limit
HTTP 5xx provider response
Queue interruption
Temporary database connection issue
Transient storage read failure
```

### 6.2 Non-retryable failures

Examples:

```text
Invalid input payload
Unsupported file type
Malware scan rejection
Authentication credentials revoked
Permanent permission failure
Malformed source record
Validation failure
User deleted/cancelled target entity
```

### 6.3 Default retry policy

```text
Attempt 1: immediate
Attempt 2: after 30 seconds
Attempt 3: after 5 minutes
Attempt 4: after 30 minutes
Attempt 5: after 2 hours
```

Actual values may vary by task type.

Rules:

```text
Use exponential backoff with jitter.
Enforce a maximum attempt count.
Do not retry permanently invalid requests.
Do not retry expensive AI tasks without budget and idempotency checks.
Record the final error code safely.
Move exhausted tasks to failed/dead_letter.
```

### 6.4 Task cancellation

Tasks should be cancelled or no-op safely when:

```text
User deletes/cancels the underlying request
Resume file is rejected/deleted
Application/interview is no longer accessible to the user
Provider integration is disabled
Budget is exhausted
Security incident requires kill switch
```

---

## 7. Timeouts and Resource Limits

Every external call and worker task must have a bounded timeout.

Suggested initial defaults:

| Workflow            | Soft timeout | Hard timeout |
| ------------------- | -----------: | -----------: |
| File scan           |   30 seconds |    5 minutes |
| PDF text extraction |   30 seconds |    2 minutes |
| Job source request  |   15 seconds |   60 seconds |
| AI extraction       |   30 seconds |    2 minutes |
| Bulk matching batch |    5 minutes |   30 minutes |
| Email delivery      |   15 seconds |   60 seconds |
| Export generation   |    5 minutes |   30 minutes |

Rules:

```text
Timeout values are configuration, not hardcoded throughout business logic.
Timed-out tasks are recorded as retryable/non-retryable according to task type.
Workers must release resources after timeout.
Large batches must be chunked.
```

---

## 8. Provider Integration Controls

External integrations include:

```text
ATS/job-source providers
Email providers
AI providers
Object storage
Virus scanners
Calendar providers
Future browser extension APIs
```

Each provider integration needs:

```text
Provider configuration
Credential source
Timeout
Rate limit
Concurrency limit
Retry policy
Circuit breaker
Kill switch
Fallback behavior
Health metric
Last successful request timestamp
Reconciliation policy
```

### 8.1 Rate limits

Use provider-specific and user-specific limits where appropriate.

```text
Global provider requests/minute
Per-user AI requests/day
Per-user resume extraction attempts/day
Job-source polling interval
Concurrent worker limit
```

### 8.2 Circuit breaker

When a provider repeatedly fails:

```text
Closed
→ failures exceed threshold
→ open
→ stop new calls temporarily
→ use fallback or pending state
→ half-open test
→ close after recovery
```

Do not continue hammering a failing or rate-limited provider.

### 8.3 Kill switch

Each expensive/high-risk integration should support fast disablement:

```text
AI extraction enabled
Fast Capture enabled
Job provider enabled
Email delivery enabled
Calendar sync enabled
```

The application must degrade gracefully rather than fail core CRUD.

---

## 9. Job Source Synchronization

### 9.1 Sync flow

```text
Scheduled/manual sync request
→ task queued
→ fetch source payload
→ preserve provenance
→ upsert JobSource
→ normalize/resolve Company/Location/Role
→ deduplicate to Canonical Job
→ update lifecycle/last_seen
→ queue relevant Match Result generation
```

### 9.2 Source reconciliation

Polling/webhooks can fail. A reconciliation task must periodically:

```text
Re-fetch known active sources
Compare last_seen/source status
Detect stale/missing listings
Mark source availability appropriately
Avoid deleting canonical job/application history
```

### 9.3 Source failure rules

```text
Provider failure does not delete existing jobs.
A failed sync is visible to operators.
Repeated failures trigger alerting/circuit breaker.
Stale source data is labeled rather than silently presented as current.
```

---

## 10. AI Task Reliability

### 10.1 AI output lifecycle

```text
User action or system trigger
→ task queued
→ model call
→ output validated
→ AI Suggestion / versioned result stored
→ user review where material
```

### 10.2 AI failure fallback

If AI is unavailable:

```text
Resume upload still works.
Manual profile entry still works.
Manual interview creation still works.
Manual notes/questions still work.
Jobs remain browsable.
Applications remain trackable.
```

### 10.3 Cost controls

AI tasks must enforce:

```text
Per-user budget
Per-feature budget
Global budget
Request-size ceiling
Maximum output tokens/size
Caching/idempotency
Retry budget
Model/provider routing
```

Do not retry a costly task repeatedly without checking whether a valid result already exists.

---

## 11. User Experience States

Any user-triggered background workflow should have visible state.

Example:

```text
Resume uploaded
Parsing resume…
Resume parsed
Could not parse resume
[Try again]
[Paste text instead]
```

Example:

```text
Interview invitation submitted
Extracting details…
Review suggested interview details
Could not extract details
[Enter manually]
```

Do not show permanent spinners without a persisted status endpoint.

---

## 12. Error Handling

### 12.1 Safe error codes

Examples:

```text
provider_timeout
provider_rate_limited
provider_auth_failed
invalid_source_payload
file_type_rejected
file_scan_rejected
file_parse_failed
ai_budget_exhausted
ai_provider_unavailable
task_timeout
task_cancelled
task_retry_exhausted
```

### 12.2 Safe user messages

```text
We could not complete this automatically. You can retry or continue manually.
The provider is temporarily unavailable. Please try again later.
This file could not be processed. Upload another PDF or paste your resume text.
```

Do not expose:

```text
Provider secret values
Stack traces
Raw SQL errors
Internal prompt text
Full third-party response bodies
```

---

## 13. Observability

Track:

```text
Queue depth
Queued/running/failed task counts
Retry counts
Task duration percentiles
Provider latency/error/rate-limit metrics
Task cost where applicable
Dead-letter count
Reconciliation lag
Last successful sync by provider
```

Log safe task context:

```text
task_id
task_type
request_id
entity_type
entity_id
provider
attempt_count
safe error_code
duration_ms
```

Never log:

```text
Passwords
Session tokens
Reset tokens
Full resume text
Full interview notes
Provider credentials
Database URLs
```

---

## 14. Definition of Done

```text
Background task model exists or queue provider has equivalent durable state.
Every task type defines idempotency, timeout, retry, and failure behavior.
Retries use bounded backoff and do not loop forever.
Business records cannot be duplicated by task retry/replay.
User-triggered tasks expose pending/success/failure/retry states.
Provider limits, circuit breakers, and kill switches are defined.
Core manual workflows remain functional during worker/provider/AI outage.
Failed syncs do not delete historical job/application data.
Task metrics and safe logs are available to operators.
Sensitive content and secrets do not enter task logs.
```
