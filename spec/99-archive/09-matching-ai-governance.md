---
status: archived
superseded_by: ../03-ai/ai-principles-and-safety.md and ../04-future-modules/resume-aware-matching.md
reason: Split into AI safety governance and matching engine.
archived_date: 2026-09-19
---

> **ARCHIVED DOCUMENTATION**  
> This specification has been archived and superseded as part of the 2026-09-19 documentation consolidation.  
> It is preserved for historical decision context and provenance only. For current authoritative architecture, see [../03-ai/ai-principles-and-safety.md](../03-ai/ai-principles-and-safety.md).

# Matching and AI Governance

> **Version:** 1.0  
> **Status:** Approved  
> **Priority:** P0 for match context; P1 for AI workflows  
> **Scope:** Eligibility, matching score, versioning, explanations, AI suggestions, review, correction, and privacy.

## Core Principle

```text
Match Score ≠ Job property

Match Result
= Job
+ Candidate Profile
+ Career Direction
+ Resume Version
+ Work Authorization
+ Matching Configuration
+ Algorithm Version
+ Taxonomy Version
```

## Matching Configuration

```text
matching_configs
├── id
├── user_id
├── career_direction_id
├── name
├── status
├── hard_constraints
├── weighting_config
├── algorithm_version
├── taxonomy_version
├── created_at
└── updated_at
```

## Hard Constraints

Hard constraints determine eligibility before soft scoring.

```text
Work authorization
Sponsorship requirements
Required location
Required work arrangement
Employment type
Hard exclusions
```

## Soft Scoring

```text
Role fit
Skill fit
Seniority fit
Experience evidence
Resume alignment
Industry preference
Location fit
Compensation alignment
```

## Match Result

```text
job_match_results
├── id
├── user_id
├── job_id
├── career_direction_id
├── resume_version_id
├── matching_config_id
├── eligibility                       eligible | not_eligible | needs_review | insufficient_data
├── eligibility_reasons
├── score
├── score_breakdown
├── matched_skills
├── missing_skills
├── strengths
├── risks
├── explanation
├── algorithm_version
├── taxonomy_version
├── input_snapshot
├── generated_at
├── superseded_at
└── created_at
```

## Version Rules

Create/version a new Match Result when any material input changes:

```text
Job metadata
Candidate Profile
Career Direction
Resume Version
Work Authorization
Matching Configuration
Taxonomy
Algorithm/model
```

Do not silently overwrite historical Match Results.

## Readiness Is Different from Match

```text
Match:
How aligned the candidate’s historical evidence is with a Job.

Readiness:
How prepared the candidate is for a particular application, interview stage, or date.
```

A user may have:

```text
Match: 85
Readiness: 60
```

Readiness should be modeled separately and associated with an Application or Interview, not permanently stored on the Job.

## AI Suggestions

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
├── status                           pending | accepted | rejected | edited | expired
├── resolved_value
├── resolved_at
├── created_at
└── updated_at
```

## Human-in-the-Loop Rule

```text
AI suggestion
→ user review
→ accepted / rejected / edited
→ user-confirmed output becomes source of truth
```

AI must not silently overwrite confirmed candidate skills, target roles, company data, or application notes.

## Explainability

Every visible Match Result should answer:

```text
Why is this score shown?
Which direction was used?
Which resume version was used?
Which hard constraints passed or failed?
Which factors increased/lowered score?
Which model/taxonomy version generated it?
When was it generated?
Why did it change?
```

## Privacy

```text
No passwords/tokens/secrets sent to AI.
Minimize personally identifiable data.
Record provider/model/prompt version for persisted output.
Clearly label AI-generated content.
Provide correction path.
Do not claim an AI result guarantees eligibility or outcome.
```

## Definition of Done

```text
Match is contextual, versioned, and explainable.
Eligibility is distinct from score.
Hard constraints run before soft scoring.
AI suggestions support accept/reject/edit.
User corrections are preserved.
AI processing does not block core CRUD workflows.
```
