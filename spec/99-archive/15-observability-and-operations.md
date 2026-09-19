---
status: archived
superseded_by: ../06-architecture/observability-audit-and-cost-controls.md
reason: Consolidated into observability, audit, and cost controls architecture.
archived_date: 2026-09-19
---

> **ARCHIVED DOCUMENTATION**  
> This specification has been archived and superseded as part of the 2026-09-19 documentation consolidation.  
> It is preserved for historical decision context and provenance only. For current authoritative architecture, see [../06-architecture/observability-audit-and-cost-controls.md](../06-architecture/observability-audit-and-cost-controls.md).

# Observability and Operations

> **Version:** 1.0  
> **Status:** Required Platform Standard  
> **Priority:** P1  
> **Scope:** Logging, metrics, traces, health checks, alerting, deployment, migrations, backups, recovery, and incident handling.

---

## 1. Purpose

CareerNeed must be operable. The team must be able to answer, safely and quickly:

```text
Why did this request fail?
Why is the Jobs page empty?
Why did job synchronization stop?
Why did a resume upload or parse fail?
Why was an interview reminder not sent?
Why did an AI request fail or become expensive?
Why is an interview time displayed incorrectly?
Why did a migration create inconsistent data?
Can the database be restored?
```

Observability must improve reliability without logging sensitive career or authentication content.

---

## 2. Observability Principles

1. **Every request and task receives a correlation identifier.**
2. **Logs are structured and machine-searchable.**
3. **Metrics cover user-facing workflows, providers, databases, queues, and cost.**
4. **Alerts target actionable failures, not noise.**
5. **Health checks distinguish running from ready.**
6. **Production changes have runbooks and rollback/forward-fix plans.**
7. **Sensitive content does not enter logs, traces, or generic analytics.**
8. **Backups are only valuable when restore procedures are tested.**

---

## 3. Structured Logging

### 3.1 Required correlation fields

Use safe structured fields where applicable:

```text
timestamp
environment
service
release_version
request_id
trace_id
task_id
route
http_method
http_status
duration_ms
entity_type
entity_id
provider
safe_error_code
attempt_count
```

User identifier rules:

```text
Use internal user_id only in protected operational systems where justified.
Prefer pseudonymous/hash representation in broad telemetry systems.
Do not use email address as general correlation field.
```

### 3.2 Example safe log

```json
{
  "event": "job_source_sync_failed",
  "environment": "production",
  "request_id": "req_...",
  "task_id": "task_...",
  "provider": "greenhouse",
  "safe_error_code": "provider_timeout",
  "attempt_count": 2,
  "duration_ms": 15023
}
```

### 3.3 Never log

```text
Passwords
Password hashes
Raw password-reset tokens
Full reset URLs
Session cookies
Authorization headers
Database URLs
Database credentials
Provider API keys
Full resume text
Full interview notes/reflections
Full job descriptions unless explicitly sanitized and justified
Personal contact email addresses in broad telemetry
Signed storage URLs
```

---

## 4. Metrics

### 4.1 API metrics

```text
Request count
Request error rate
Status-code distribution
Latency p50/p95/p99
Route-level throughput
Request-size distribution
Rate-limit rejection count
Authentication failure rate
Authorization denial count
```

### 4.2 Database metrics

```text
Connection pool usage
Query latency
Slow-query count
Transaction rollback count
Migration duration
Deadlock/lock-wait count
Database storage usage
Backup success/failure
Restore-test success/failure
```

### 4.3 Background task metrics

```text
Queue depth
Task waiting time
Task duration p50/p95
Task success/failure rate
Retry count
Dead-letter count
Worker concurrency
Task timeout count
Task cancellation count
```

### 4.4 Product workflow metrics

```text
Resume upload success/rejection rate
Resume extraction success/failure rate
Career Direction creation rate
Job sync success/failure rate
Canonical job count/lifecycle distribution
Match generation throughput/failure rate
Application creation/update rate
Interview scheduling/completion rate
Follow-up completion rate
Today query latency
```

### 4.5 Provider metrics

```text
Provider request count
Provider latency
Provider HTTP/status error distribution
Provider rate-limit events
Provider authentication failures
Last successful sync/call
Circuit breaker state
Fallback activation count
```

### 4.6 AI metrics

```text
Request count by feature
Latency
Failure rate
Input/output size
Cost by user/feature/model/provider
Cache-hit rate
Budget-exceeded count
User acceptance/rejection/edit rate for suggestions
Evaluation/regression score
```

---

## 5. Health Checks

### 5.1 Liveness

Liveness answers:

```text
Is the service process running?
```

Example:

```text
GET /health/live
```

A liveness check must not require every external provider to be available.

### 5.2 Readiness

Readiness answers:

```text
Can the service currently accept traffic?
```

Example:

```text
GET /health/ready
```

Readiness can verify critical dependencies appropriate to deployment policy:

```text
Database connectivity
Migration compatibility
Required configuration present
Queue connection where worker-backed features are mandatory
```

### 5.3 Dependency status

Optional protected/internal endpoint:

```text
GET /health/dependencies
```

May summarize:

```text
Database
Queue
Object storage
Email provider
AI provider
Job providers
```

Do not expose internal dependency detail publicly.

---

## 6. Alerting

Alerts should be actionable and linked to an owner/runbook.

### 6.1 Initial alert categories

```text
Sustained API 5xx error increase
Authentication/session failure spike
Authorization denial anomaly
Database unavailable or connection exhaustion
Queue backlog above threshold
Task failure/retry spike
Job source sync failure/staleness
File upload/scan/extraction failure spike
Email delivery failure spike
AI provider outage or budget spike
Migration failure
Backup failure
Restore-drill failure
Unexpected storage growth
Unexpected provider rate-limit state
```

### 6.2 Alert quality rules

```text
Avoid paging for transient single failures.
Use duration/window thresholds.
Include environment, affected service, metric, threshold, runbook link, and recent deployment context.
Deduplicate repeated alerts.
Escalate only when user impact or data-risk threshold is met.
```

---

## 7. Tracing

Distributed tracing becomes important when one user action crosses:

```text
Web client
API
Database
Queue
Worker
Object storage
AI provider
Email provider
Job source provider
```

Trace propagation should include:

```text
request_id
trace_id
task_id
```

Tracing data must follow the same privacy restrictions as logs.

Do not attach full resume content, prompt content, credentials, or tokens as trace attributes.

---

## 8. Deployment and Release Operations

### 8.1 Deployment checklist

```text
Review code and migration.
Confirm environment configuration.
Confirm secrets are provisioned through deployment system.
Confirm health checks.
Confirm database backup/current recovery posture.
Apply additive migration.
Deploy compatible app version.
Verify readiness.
Run smoke tests.
Monitor errors/latency/task queue/provider status.
```

### 8.2 Migration runbook

Before a production migration:

```text
1. Confirm exact target database.
2. Check current Alembic revision.
3. Review migration for destructive operations.
4. Create/verify backup.
5. Test against representative/staging data where possible.
6. Apply migration.
7. Verify expected tables/indexes/row counts.
8. Run application smoke tests.
9. Monitor errors.
10. Prefer forward fix if rollback is unsafe.
```

### 8.3 Rollback policy

Database rollback is not always safe after new writes occur.

Preferred principle:

```text
Application rollback where compatible
+ forward migration/fix for schema issues
```

Do not treat destructive downgrade as routine recovery.

---

## 9. Backup and Restore

### 9.1 Backup requirements

```text
Scheduled database backups
Encrypted backup storage
Documented retention period
Backup success monitoring
Object-storage/file backup strategy
Recovery point objective target
Recovery time objective target
```

### 9.2 Restore drills

A backup is not considered validated until it has been restored in a separate environment.

Restore drill validates:

```text
Backup integrity
Schema restoration
User/application/interview records
Resume metadata/file references
Migration compatibility
Application startup against restored database
```

Never test restoration by overwriting the active production database.

---

## 10. Incident Response

### 10.1 Incident categories

```text
Authentication/security incident
Data exposure/authorization incident
Data loss/corruption incident
Provider outage
Queue/worker outage
Database outage
File storage incident
AI cost/runaway task incident
Job-source ingestion incident
```

### 10.2 Minimum response flow

```text
Detect
→ assess user/data impact
→ contain
→ disable affected integration if necessary
→ communicate internally
→ recover
→ validate
→ document root cause
→ implement prevention
```

### 10.3 Security incident controls

Potential containment actions:

```text
Disable provider integration
Rotate affected secret
Invalidate sessions when needed
Disable AI feature
Stop uploads
Pause queue consumption
Block suspicious client/request
Restore from validated backup if needed
```

---

## 11. Operational Dashboards

Recommended initial dashboards:

```text
API health and latency
Database health
Background tasks/queue health
Job source sync health
File storage/resume processing health
AI cost and quality health
Notification/email delivery health
Business workflow health
Backup/restore status
```

The dashboards must distinguish:

```text
No traffic
Normal low traffic
Provider failure
Queue backlog
Application bug
Database failure
User-specific data issue
```

---

## 12. Definition of Done

```text
Structured safe logging exists.
Requests and tasks carry correlation identifiers.
API/database/queue/provider/AI/file metrics are collected.
Liveness and readiness checks exist.
Actionable alerts and runbooks exist for critical failure modes.
Deployment and migration checklist is documented.
Backups are monitored.
Restore drills are performed in a separate environment.
Incident response process and emergency kill-switch actions are defined.
No passwords, tokens, secrets, full resumes, or private interview content appear in broad telemetry.
```
