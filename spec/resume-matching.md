# CareerNeed Specification: Contextual Matching Engine

> **Version:** 3.0  
> **Status:** Approved with V2 Domain Architecture  
> **Target Release:** Phase 2D — Contextual Matching and Jobs Workspace  
> **Core Principle:** _A Match Result is not a black-box Job score. It is a versioned, explainable evaluation of a Canonical Job for one user, one Career Direction, one resume context, and one matching configuration._

---

## 1. Purpose

CareerNeed helps users decide which jobs deserve attention. The product must not present a generic percentage without explaining:

```text
Which Career Direction was used?
Which Resume Version was used?
Which candidate evidence was considered?
Which hard constraints were checked?
What is known versus inferred?
Why is the job eligible, ineligible, uncertain, or low fit?
Why did the result change over time?
```

The matching engine is candidate decision support. It does not guarantee legal eligibility, interview selection, employer interest, or hiring outcome.

---

## 2. Core Matching Contract

```text
Canonical Job
+ Candidate Profile snapshot
+ Career Direction snapshot
+ Work Authorization snapshot
+ Resume Version snapshot
+ Matching Configuration
+ Algorithm Version
+ Taxonomy Version
= Job Match Result
```

Formally:

\[
\text{JobMatchResult} =
f(
\text{Job},
\text{CandidateProfile},
\text{CareerDirection},
\text{WorkAuthorization},
\text{ResumeVersion},
\text{MatchingConfig},
\text{AlgorithmVersion},
\text{TaxonomyVersion}
)
\]

A Match Result is **not** a property of the Job.

```text
Google Software Engineer

Full Stack Engineering direction
→ Eligible
→ Score: 91
→ Resume: Full Stack Resume v3

Frontend Engineering direction
→ Eligible
→ Score: 86
→ Resume: Frontend Resume v2

Data Analytics direction
→ Needs review or not eligible
→ Different reasons and no misleading global score
```

---

## 3. Inputs

## 3.1 Candidate Profile

Candidate Profile provides durable evidence:

```text
Experience
Skills
Education
Projects
Achievements
Domain exposure
Leadership/scope evidence
Work authorization
```

Profile is not replaced by Resume Version.

## 3.2 Career Direction

Career Direction provides intentional target context:

```text
Target roles
Seniority preferences
Location preferences
Work-arrangement preferences
Compensation preferences
Industry preferences
Exclusions
Preferred Resume
Matching configuration
Lifecycle status
```

Only active directions are used for automatic/default matching.

## 3.3 Resume Version

Resume Version provides the actual presentation context.

```text
Resume
→ Resume Version
→ immutable content/file snapshot
```

Rules:

```text
CareerDirection.default_resume_id is the default recommendation.
The user may explicitly choose another owned Resume Version for a Job/Application.
A Match Result records the actual Resume Version used.
Application history stores the selected Resume Version and snapshot.
```

## 3.4 Canonical Job

Canonical Job provides:

```text
Company
Title
Normalized role candidates
Description
Required/preferred skills
Seniority clues
Physical location(s)
Remote scope(s)
Work arrangement
Sponsorship policy
Employment type
Compensation data where reliable
Source provenance
Lifecycle
```

## 3.5 Work Authorization

Work Authorization is separate from Career Direction location preference.

```text
Target location:
Where user wants to work

Work authorization:
Where user may work
Whether sponsorship is required
```

## 3.6 Matching Configuration

Matching Configuration controls hard constraints, scoring weights, and policy.

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

Weights are configuration values, not permanent hard-coded product truth.

---

## 4. Output: Job Match Result

```text
job_match_results
├── id
├── user_id
├── job_id
├── career_direction_id
├── resume_version_id
├── matching_config_id
├── eligibility
├── eligibility_reasons
├── score
├── score_breakdown
├── matched_skills
├── missing_skills
├── strengths
├── risks
├── explanation
├── evidence
├── confidence
├── algorithm_version
├── taxonomy_version
├── input_snapshot
├── generated_at
├── superseded_at
└── created_at
```

## 4.1 Eligibility States

```text
eligible
not_eligible
needs_review
insufficient_data
```

| State               | Meaning                                     | Score behavior                         |
| ------------------- | ------------------------------------------- | -------------------------------------- |
| `eligible`          | Known hard constraints pass                 | Score may be shown                     |
| `not_eligible`      | Known hard constraint conflicts             | Score is `null` or visually suppressed |
| `needs_review`      | Material ambiguity/uncertainty exists       | Score optional but clearly qualified   |
| `insufficient_data` | Missing data prevents meaningful evaluation | Score absent                           |

A hard-constraint failure must not be represented as `0%`.

```text
Wrong:
Country mismatch → 0%

Correct:
Not eligible
Employer listing indicates no sponsorship, while your profile requires sponsorship.
```

---

## 5. Tier 1: Eligibility Evaluation

Eligibility runs before soft scoring.

```text
Hard constraints
→ eligibility state and structured reasons
→ soft scoring only where appropriate
```

## 5.1 Hard Constraint Categories

| Category                  | Example                                                         | Result behavior                               |
| ------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| Work authorization        | Job requires US citizenship; user has no matching authorization | `not_eligible` only when evidence is reliable |
| Sponsorship               | Job explicitly does not sponsor; user requires sponsorship      | `not_eligible`                                |
| Required work arrangement | Direction requires remote-only; job is onsite                   | `not_eligible`                                |
| Required location         | Direction requires New York; job is onsite in Seattle only      | `not_eligible`                                |
| Employment type           | Direction requires full-time; job is contract-only              | `not_eligible` when configured hard           |
| Explicit exclusion        | User excludes a company/industry/keyword                        | `not_eligible` or filtered by policy          |

## 5.2 Unknown and Ambiguous Data

Unknown data does not equal failure.

Examples:

```text
Sponsorship policy absent
Remote scope ambiguous
Location parser confidence low
Work authorization profile incomplete
Job has incomplete description
```

These should normally result in:

```text
needs_review
or
insufficient_data
```

not an unsupported eligibility decision.

## 5.3 Structured Eligibility Reasons

```python
from pydantic import BaseModel, Field
from typing import Literal


EligibilityState = Literal[
    "eligible",
    "not_eligible",
    "needs_review",
    "insufficient_data",
]


class EligibilityReason(BaseModel):
    code: str
    severity: Literal["hard", "warning", "info"]
    message: str
    evidence: dict[str, object] = Field(default_factory=dict)
```

Suggested reason codes:

```text
location_required_mismatch
remote_scope_mismatch
remote_scope_unknown
work_arrangement_required_mismatch
office_attendance_exceeds_preference
work_authorization_mismatch
work_authorization_unknown
sponsorship_unavailable
sponsorship_unknown
employment_type_mismatch
direction_exclusion_match
job_location_ambiguous
```

---

## 6. Tier 2: Soft Scoring

Soft scoring evaluates fit among Jobs that are eligible or sufficiently understood.

Initial default categories may include:

```text
Role alignment
Seniority alignment
Skills alignment
Experience/domain alignment
Location preference fit
Work-arrangement preference fit
Compensation fit where reliable
Resume presentation alignment
```

Default weights must be stored in Matching Configuration.

Example initial template:

| Dimension                     | Example default weight | Purpose                                                        |
| ----------------------------- | ---------------------: | -------------------------------------------------------------- |
| Role alignment                |                    25% | Fit to target roles                                            |
| Seniority alignment           |                    15% | Fit to desired scope/level                                     |
| Skills alignment              |                    30% | Required/preferred skill evidence                              |
| Experience/domain alignment   |                    20% | Relevant domain, scale, impact, scope                          |
| Location/work arrangement     |                     5% | Soft geographic/work-model preference                          |
| Resume presentation alignment |                     5% | How clearly selected Resume Version presents relevant evidence |

Weights may change by Career Direction and product version.

For an eligible job:

\[
S =
w_r S_r

- w_s S_s
- w_k S_k
- w_e S_e
- w_l S_l
- w_p S_p
  \]

where:

\[
\sum_i w_i = 1
\]

Score must be returned only when inputs are sufficient to support it.

## 6.1 Score Interpretation

| Score range | Suggested UI label | Meaning                                                 |
| ----------: | ------------------ | ------------------------------------------------------- |
|      90–100 | Strong fit         | Strong evidence across major dimensions                 |
|       80–89 | Good fit           | Strong fit with manageable gaps                         |
|       70–79 | Potential fit      | Worth review; meaningful gaps or uncertainty            |
|       60–69 | Stretch            | Some alignment; significant preparation or evidence gap |
|    Below 60 | Lower fit          | Limited alignment or weaker evidence                    |

These labels are decision-support guidance, not employment predictions.

---

## 7. Dimension Requirements

## 7.1 Role Alignment

Role alignment considers:

```text
Canonical Job title
Normalized Job role candidates
Career Direction target roles
Role taxonomy aliases
Candidate user corrections
Confidence/provenance
```

Output:

```text
role_score
matched_target_roles
role_explanation
role_confidence
```

Example:

```text
Job:
Senior Product Analyst

Direction:
Data Analytics

Matched target role:
Product Analyst

Explanation:
The normalized role aligns with a secondary target role in this direction.
```

## 7.2 Seniority Alignment

Seniority compares:

```text
Job seniority evidence
Career Direction target/acceptable seniority
Candidate Profile scope evidence where available
```

Rules:

```text
Do not infer precise years/level when job data is absent.
Distinguish exact fit, adjacent fit, stretch, and mismatch.
Explain uncertainty if seniority is inferred.
```

Output:

```text
seniority_score
job_seniority
direction_seniority_preferences
seniority_relation
seniority_explanation
```

## 7.3 Skills Alignment

Skills alignment compares:

```text
Job required skills
Job preferred skills
Candidate Profile skills/evidence
Selected Resume Version evidence
Skill taxonomy aliases
Skill criticality
```

Output:

```text
skills_score
matched_required_skills
matched_preferred_skills
missing_required_skills
missing_preferred_skills
skill_evidence
skills_explanation
```

Rules:

```text
Do not classify a skill as missing merely because it is absent from the selected resume when it exists in confirmed Candidate Profile evidence.
Do distinguish:
- evidence in Candidate Profile
- evidence presented in selected Resume Version
- inferred/uncertain evidence
```

## 7.4 Experience and Domain Alignment

Consider:

```text
Industry/domain experience
Project type
System scale
Leadership scope
Customer/business context
Relevant achievements
Architecture/technology evidence
```

Output:

```text
experience_domain_score
matched_domains
experience_evidence
domain_explanation
```

This must use Candidate Profile evidence first and selected Resume Version presentation context second.

## 7.5 Location and Work Arrangement Fit

Location and arrangement evaluation uses the dedicated Location Eligibility spec.

```text
Hard mismatch:
Eligibility issue

Preferred/acceptable match:
Soft scoring input

Unknown:
Needs review or insufficient data
```

Output:

```text
location_fit_score
arrangement_fit_score
location_explanation
```

## 7.6 Resume Presentation Alignment

Resume presentation alignment answers:

```text
Does the selected Resume Version clearly communicate relevant experience already present in Candidate Profile?
```

It does not claim the candidate lacks a skill simply because the resume did not mention it.

Output:

```text
resume_presentation_score
well_presented_evidence
underrepresented_evidence
resume_recommendation
```

---

## 8. Explainability Contract

Every displayed Match Result must allow the user to understand:

```text
Selected Career Direction
Selected Resume Version
Eligibility state
Hard-constraint reasons
Overall score when appropriate
Dimension breakdown
Matched skills
Missing/underrepresented skills
Strengths
Risks
Known data versus AI/rule inference
Algorithm version
Taxonomy version
Generation date/time
```

## 8.1 Pydantic Response Schema

```python
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class MatchDimension(BaseModel):
    score: int | None = Field(default=None, ge=0, le=100)
    weight: float | None = Field(default=None, ge=0, le=1)
    explanation: str | None = None
    evidence: list[str] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0, le=1)


class MatchBreakdown(BaseModel):
    role: MatchDimension | None = None
    seniority: MatchDimension | None = None
    skills: MatchDimension | None = None
    experience_domain: MatchDimension | None = None
    location: MatchDimension | None = None
    work_arrangement: MatchDimension | None = None
    resume_presentation: MatchDimension | None = None


class JobMatchResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    job_id: str
    career_direction_id: str
    resume_version_id: str | None
    eligibility: Literal[
        "eligible",
        "not_eligible",
        "needs_review",
        "insufficient_data",
    ]
    eligibility_reasons: list[EligibilityReason] = Field(default_factory=list)

    score: int | None = Field(default=None, ge=0, le=100)
    score_label: str | None = None
    breakdown: MatchBreakdown | None = None

    matched_skills: list[str] = Field(default_factory=list)
    missing_required_skills: list[str] = Field(default_factory=list)
    missing_preferred_skills: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)

    explanation: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)

    algorithm_version: str
    taxonomy_version: str
    generated_at: datetime
```

## 8.2 UI Requirements

### Eligible job

```text
Eligible · Strong fit 87%

Role: 92%
Skills: 84%
Seniority: Good fit
Location: Preferred

Matches:
SQL, Python, experimentation

Growth areas:
dbt, Snowflake

Evaluated for:
Data Analytics
Data Analyst Resume v2
```

### Not eligible job

```text
Not eligible

The listing indicates that sponsorship is unavailable.
Your saved profile indicates that sponsorship is required.

[View listing details]
[Edit work authorization]
[Dismiss]
```

### Needs review

```text
Needs review

The listing says “Remote — EMEA preferred.”
Remote-scope eligibility could not be determined from available data.

[View source]
[Edit direction preferences]
```

Do not show a visually dominant score when eligibility is `not_eligible`.

---

## 9. Multi-Resume Routing

### 9.1 Default Resume

A Career Direction may identify a preferred Resume:

```text
career_direction.default_resume_id
```

This is a convenience default for matching and application creation.

### 9.2 Explicit Resume Selection

Users may choose a different owned Resume Version for:

```text
Job matching
Application creation
Interview preparation
```

The chosen version must be recorded in:

```text
JobMatchResult.resume_version_id
Application.resume_version_id
Application.resume_snapshot
```

### 9.3 No Cross-Contamination Rule

The system must not silently use an unrelated resume context.

```text
Data Analytics job
→ default: Data Analyst Resume v2

User explicitly selects Full Stack Resume v3
→ allowed if owned
→ Match Result clearly records selected version
→ user sees that a non-default resume was used
```

---

## 10. Match Result Versioning

A new Match Result should be generated when a material input changes:

```text
Job description changes
Job role/location/sponsorship normalization changes
Candidate Profile changes
Career Direction changes
Work Authorization changes
Selected Resume Version changes
Matching Configuration changes
Algorithm changes
Taxonomy changes
```

Rules:

```text
Do not overwrite historical Match Results without traceability.
Mark prior result superseded when a newer equivalent-context result exists.
Applications continue to use their saved Match Result reference/snapshot.
Jobs workspace normally shows current unsuperseded result.
```

---

## 11. AI Governance

AI may help with:

```text
Skill extraction
Role normalization
Company normalization
Location/remote scope extraction
Match explanation
Gap analysis
Resume recommendation
Career Direction recommendation
```

AI output must carry:

```text
provider
model_version
prompt_version
input_snapshot_hash
output_schema_version
confidence
generation timestamp
```

For material suggestions:

```text
AI suggestion
→ user review
→ accepted / rejected / edited
→ user-confirmed value becomes source of truth
```

AI must not silently alter:

```text
Candidate Profile
Career Direction
Work Authorization
Resume Version
Application status
Interview notes
Contact records
```

---

## 12. Match vs. Readiness

Match and readiness are separate concepts.

```text
Match:
How well existing candidate evidence aligns with the Job.

Readiness:
How prepared the user is for a specific application/interview at a particular time.
```

Example:

```text
Match: 85
Readiness for upcoming system-design interview: 60
```

Readiness should be associated with:

```text
Application
Interview
Preparation plan
User-confirmed study progress
```

It must not be stored as a fixed Job field.

---

## 13. Reliability and Performance

### 13.1 Matching Execution

Non-trivial matching runs through background tasks.

```text
Match request
→ idempotent task
→ versioned Match Result
→ user-visible pending/success/failure state
```

### 13.2 Caching

Caching must include match context:

```text
user_id
job_id
career_direction_id
resume_version_id
matching_config/version
taxonomy_version
algorithm_version
```

Never share user-specific Match Results across users.

### 13.3 Graceful Fallback

If AI/model provider is unavailable:

```text
Jobs remain browseable.
Applications remain usable.
Existing Match Results remain visible.
Rule-based/basic matching may run if available.
UI clearly states when detailed analysis is unavailable.
Manual user decisions remain available.
```

---

## 14. Testing Requirements

### 14.1 Core Matching Tests

```text
Same Job produces distinct results for different Career Directions.
Same Job produces distinct results for different Resume Versions.
Hard sponsorship conflict results in not_eligible.
Unknown sponsorship does not result in unsupported hard rejection.
Remote scope ambiguity produces needs_review where material.
Required remote-only preference rejects onsite/hybrid according to configuration.
Match score is absent/suppressed for not_eligible results.
Soft score breakdown weights sum correctly.
Required/preferred skill distinction works.
Candidate Profile evidence and Resume presentation evidence are distinguished.
```

### 14.2 Versioning Tests

```text
Changing Resume Version creates a new Match Result.
Changing direction preference creates a new Match Result.
Changing algorithm/taxonomy version creates a new Match Result.
Historical Application Match snapshot remains unchanged.
Current Jobs view returns latest unsuperseded matching context.
```

### 14.3 Ownership and Privacy Tests

```text
User A cannot retrieve User B Match Result.
User A cannot generate/use User B Resume Version.
User A cannot use User B Career Direction.
AI/task logs do not contain tokens/secrets/private content.
```

### 14.4 Explainability Tests

```text
Every visible score has breakdown/version metadata.
Eligibility reason codes map to user-readable messages.
Unknown data is visible as uncertainty.
No score is fabricated when input data is insufficient.
```

---

## 15. Definition of Done

1. Match Result is modeled as a versioned user-specific contextual entity, not a global Job field.
2. Matching input includes Candidate Profile, Career Direction, Resume Version, Work Authorization, Job, Matching Configuration, algorithm version, and taxonomy version.
3. Eligibility supports `eligible`, `not_eligible`, `needs_review`, and `insufficient_data`.
4. Hard constraint failures use structured reasons and do not appear as `0%` scores.
5. Soft scoring weights are defined by versioned Matching Configuration, not permanently hard-coded.
6. Role, seniority, skill, experience/domain, location, work arrangement, and resume presentation outputs are explainable.
7. Candidate Profile evidence and Resume Version presentation are distinguished.
8. Users can use a non-default owned Resume Version when explicitly selected.
9. Job Match Results retain version, provenance, timestamp, input snapshot, and current/superseded state.
10. Applications preserve the Match Result/reference or immutable snapshot used at creation.
11. AI-derived matching inputs/output retain model/prompt/provider metadata and support user review when material.
12. Match and Readiness are separate models/concepts.
13. Background processing is idempotent, bounded, observable, and degrades gracefully.
14. Tests cover contextual behavior, eligibility, uncertainty, ownership, versioning, explanations, and snapshots.
