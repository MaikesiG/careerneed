---
status: archived
superseded_by: ../03-ai/controlled-ai-architecture.md and ../06-architecture/observability-audit-and-cost-controls.md
reason: Consolidated into controlled AI architecture and cost observability.
archived_date: 2026-09-19
---

> **ARCHIVED DOCUMENTATION**  
> This specification has been archived and superseded as part of the 2026-09-19 documentation consolidation.  
> It is preserved for historical decision context and provenance only. For current authoritative architecture, see [../03-ai/controlled-ai-architecture.md](../03-ai/controlled-ai-architecture.md).

# AI Cost, Quality, and Evaluation

> **Version:** 1.0  
> **Status:** Planned  
> **Priority:** P2, With Required Controls Before Broad AI Automation  
> **Scope:** AI provider routing, prompt/model versioning, quality evaluation, cost controls, safety, human review, observability, and kill switches.

---

## 1. Purpose

CareerNeed uses AI to reduce repetitive work and provide career decision support. AI features must be:

```text
Useful
Reviewable
Explainable
Affordable
Measurable
Privacy-aware
Safely disableable
Non-blocking for core manual workflows
```

AI should not become an opaque source of truth or an uncontrolled cost center.

---

## 2. Covered AI Features

Potential AI-assisted capabilities:

```text
Resume/profile extraction
Skill extraction
Experience/project extraction
Role normalization
Company resolution
Location/remote-scope normalization
Job matching explanation
Career gap analysis
Job-to-direction recommendation
Resume recommendation
Fast Capture interview invite parsing
Interview preparation plan
Interview question classification
Post-interview outcome analysis
Cross-interview pattern recognition
Follow-up recommendation
```

Each feature must have its own:

```text
Input contract
Output schema
Prompt version
Model/provider version
Evaluation dataset
Cost budget
Confidence/review policy
Fallback behavior
Kill switch
```

---

## 3. Core AI Principle

```text
AI output ≠ source of truth

AI suggestion
→ user review
→ accept / reject / edit
→ user-confirmed value becomes source of truth
```

AI may prefill a form or propose an action. It must not silently overwrite:

```text
Candidate Profile
Career Direction
Resume Version
Work Authorization
Application status
Interview notes
Contact records
User preferences
```

---

## 4. AI Suggestion Model

```text
ai_suggestions
├── id
├── user_id
├── entity_type
├── entity_id
├── suggestion_type
├── proposed_value
├── confidence
├── rationale
├── model_provider
├── model_version
├── prompt_version
├── input_snapshot_hash
├── output_schema_version
├── status
├── resolved_value
├── resolved_at
├── created_at
└── updated_at
```

Suggested statuses:

```text
pending
accepted
rejected
edited
expired
failed
```

Suggested suggestion types:

```text
profile_skill_extract
profile_experience_extract
normalized_role
normalized_company
normalized_location
job_direction_recommendation
resume_recommendation
match_explanation
gap_analysis
interview_fast_capture
interview_prep
interview_question_category
interview_outcome_pattern
follow_up_recommendation
```

---

## 5. Prompt and Model Versioning

Every persisted AI result must record:

```text
Provider
Model name/version
Prompt version
Output schema version
Input snapshot hash
Generation timestamp
```

Example:

```text
provider: openai
model_version: gpt-...
prompt_version: interview-prep-v3
output_schema_version: 2
input_snapshot_hash: sha256:...
```

Rules:

```text
Prompt changes require a version increment.
Output-schema changes require a version increment.
Model changes require recorded model version.
Historical results remain interpretable after upgrades.
No output should be stored without provenance.
```

---

## 6. Quality Evaluation

### 6.1 Evaluation datasets

Maintain labeled/golden datasets for high-value features.

```text
Resume skill extraction
Experience extraction
Role normalization
Company normalization
Location/remote-scope normalization
Fast Capture interview parsing
Question classification
Match explanation factuality
```

### 6.2 Evaluation criteria

Measure feature-appropriate quality.

| Feature                 | Example metrics                                                       |
| ----------------------- | --------------------------------------------------------------------- |
| Resume skill extraction | precision, recall, user acceptance/edit rate                          |
| Role normalization      | top-1 accuracy, top-k accuracy, ambiguity detection                   |
| Location normalization  | country/region/city precision/recall, unsafe false-positive rate      |
| Fast Capture            | field extraction accuracy, date/time accuracy, confirmation edit rate |
| Match explanation       | grounding/factual consistency, user helpfulness                       |
| Question classification | category accuracy, confidence calibration                             |
| Gap analysis            | relevance, actionability, unsupported-claim rate                      |

### 6.3 Regression gate

Any change to:

```text
Prompt
Model
Provider
Taxonomy
Matching algorithm
Output schema
Parsing logic
```

must run applicable evaluation/regression tests before broad release.

Do not deploy a quality regression simply because a new model is cheaper or faster.

---

## 7. Confidence and Review Policy

### 7.1 Risk-based automation

Confidence alone is not enough. Automation level depends on confidence and impact.

| Output type                 | Example                                | Required behavior                                      |
| --------------------------- | -------------------------------------- | ------------------------------------------------------ |
| Low impact, high confidence | Suggest skill tag                      | Prefill for user review                                |
| Medium impact               | Suggest Career Direction role          | Show explicit confirmation                             |
| High impact                 | Work authorization / eligibility claim | Never silently decide; show evidence and review        |
| Ambiguous                   | Remote scope says EMEA                 | Mark needs review                                      |
| Financial/legal sensitive   | Sponsorship/legal eligibility          | Explain as listing-based information, not legal advice |

### 7.2 User corrections

Record:

```text
Suggested value
User-selected final value
Accepted/rejected/edited status
Optional correction reason
```

Corrections become feedback signals for evaluation and future product improvement. They must not immediately be used for external model training without explicit policy/consent.

---

## 8. Cost Controls

### 8.1 Cost dimensions

Track cost by:

```text
User
Feature
Provider
Model
Prompt version
Task type
Environment
Date/time window
```

### 8.2 Budget controls

Define:

```text
Per-user daily/monthly budget
Per-feature budget
Global platform budget
Free-tier quota
Paid-plan allowance
Maximum request/input size
Maximum output size
Maximum concurrent tasks
```

Examples:

```text
Resume extraction: limited attempts/day
Fast Capture: limited requests/day
Interview preparation: limited generation/regeneration count
Bulk match generation: batched with strict budget
Cross-interview analysis: only on demand or scheduled low frequency
```

### 8.3 Cost prevention

Use:

```text
Idempotency keys
Caching
Request deduplication
Input trimming
Model routing
Batch processing
Rate limiting
Task cancellation
Maximum retry budget
```

Do not regenerate the same result repeatedly because a user refreshes a page.

---

## 9. Model Routing and Fallbacks

AI routing may choose among:

```text
User-provided key
Managed platform model
Low-cost extraction model
Higher-quality reasoning model
Rule-based parser
No-AI manual workflow
```

Rules:

```text
Routing is explicit and auditable.
User BYOK credentials are never exposed to other users.
Failure of a preferred provider should fall back only when privacy, cost, and feature policy allow it.
Manual workflow is always available.
```

Example fallback:

```text
Fast Capture:
Regex/date parser
→ optional AI extractor
→ user manual form
```

Do not send the same sensitive payload to multiple providers automatically without clear policy.

---

## 10. Safety and Grounding

### 10.1 Required behavior

AI-generated content must distinguish:

```text
Extracted fact
Inference
Recommendation
Unknown/insufficient evidence
```

Examples:

```text
Good:
"The job listing mentions Kubernetes."

Good:
"Based on your saved profile, Kubernetes experience was not found. Review this before relying on it."

Bad:
"You are not qualified for this job."

Bad:
"The interviewer rejected you because of weak system design."
```

### 10.2 Employment decision boundary

CareerNeed provides candidate decision support. It does not make employment decisions for employers.

AI output must not promise:

```text
You will get an interview
You are legally eligible
This company will hire you
This rejection had a confirmed cause
```

### 10.3 Legal/privacy sensitivity

Work authorization, sponsorship, compensation, and health/disability-related content require extra caution.

Use:

```text
Based on the available listing information and your saved preferences
```

not:

```text
You are legally ineligible
```

unless the product has reliable, explicit information and a carefully reviewed policy.

---

## 11. Input and Output Data Minimization

### 11.1 Input rules

Send only necessary excerpts/context.

```text
Skill extraction:
Relevant resume text

Interview prep:
Selected Resume Version + Job snapshot + Interview stage

Fast Capture:
User-submitted invite snippet only

Match explanation:
Structured match factors + bounded job/profile evidence
```

### 11.2 Never send

```text
Passwords
Password hashes
Session cookies
Authorization headers
Raw reset tokens
Full reset URLs
Database credentials
Provider API keys
Unrelated user records
Other users' data
```

### 11.3 Output retention

Persist only useful structured output and needed provenance.

Avoid retaining:

```text
Unbounded raw prompts
Unbounded chain-of-thought/internal reasoning
Repeated duplicate model outputs
Sensitive content without clear product purpose
```

---

## 12. Kill Switches

Every AI feature must be disableable without deployment.

Suggested controls:

```text
AI_ENABLED
RESUME_EXTRACTION_AI_ENABLED
FAST_CAPTURE_AI_ENABLED
MATCH_EXPLANATION_AI_ENABLED
INTERVIEW_PREP_AI_ENABLED
OUTCOME_ANALYSIS_AI_ENABLED
AI_PROVIDER_<NAME>_ENABLED
```

Kill switch behavior:

```text
Stop new AI task enqueueing
Cancel queued work where safe
Use manual/rule-based fallback
Show clear non-alarming user message
Preserve existing user data
Do not break application/interview/job tracking
```

---

## 13. Observability

Track:

```text
Request/task count by feature
Success/failure rate
Latency percentiles
Provider/model usage
Input/output size
Cost
Cache hit rate
Retry count
Budget exhaustion
Kill-switch state
User acceptance/rejection/edit rate
Evaluation score by prompt/model version
```

Safe log context:

```text
task_id
feature
provider
model_version
prompt_version
output_schema_version
safe error code
latency
cost bucket
```

Never log raw prompt text, full resume text, sensitive interview notes, credentials, or tokens in general telemetry.

---

## 14. Definition of Done

```text
Every AI feature has a documented input/output contract.
Persisted output records provider/model/prompt/schema/version metadata.
AI suggestions can be accepted, rejected, or edited.
User-confirmed data is not silently overwritten.
Quality evaluation datasets and regression checks exist for high-impact features.
Cost is tracked and bounded by user/feature/provider/model.
Idempotency, caching, size limits, rate limits, and retry budgets prevent runaway cost.
Manual workflow remains usable during AI/provider outage.
Sensitive inputs are minimized.
AI features have kill switches.
AI output distinguishes evidence, inference, recommendation, and uncertainty.
```
