# Future Module: Contextual Resume-Aware Matching Engine

> **Status:** Planned (Phase 4 Core Deliverable)  
> **Owner:** CareerNeed Machine Learning & Recommendation Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Multi-factor contextual matching algorithm, hard eligibility evaluation, explainable score breakdown, score policy tiers, and feedback loops.

---

## 1. Core Principle of Contextual Matching

A Match Result is **never** a static, intrinsic property of a job listing. It is a dynamic, versioned, explainable evaluation computed at the intersection of five private and market entities:

$$\text{Match Result} = f(\text{Canonical Job}, \text{Career Direction}, \text{Resume Version}, \text{Work Authorization}, \text{Matching Config})$$

```text
       Canonical Job (Requirements & Scope)
             │
             ├──► [ Hard Eligibility Filter ] ──► (Ineligible ──► Structured Reason)
             │          │ (Passed)
             │          ▼
             ├──► [ Tier 1: Deterministic Taxonomy Score ]
             │          │ (High Potential >= 75)
             │          ▼
             └──► [ Tier 2: Deep Contextual AI Analysis ] ──► Explainable Match Result
```

---

## 2. Multi-Stage Evaluation Pipeline

### Stage 1: Hard Eligibility Filter (Run First)
Before calculating any percentage score, the engine checks non-negotiable hard constraints:
1. **Work Authorization & Sponsorship**:
   - Compares candidate's `work_authorizations` against the job's `sponsorship_policy`.
   - If candidate requires sponsorship and job explicitly states "No sponsorship provided", the job is immediately designated `not_eligible`.
   - **Invariant**: Hard constraint failures never appear as `0%`. They display structured human-readable reasons (e.g. *"Employer does not sponsor required work authorization"*).
2. **Work Arrangement**:
   - If candidate's direction requires `remote_only` and job is strictly `onsite`, marked `not_eligible`.
3. **Mandatory Geography**:
   - If job physical location conflicts with candidate's hard location exclusions.

### Stage 2: Deterministic Taxonomy & Semantic Scoring
For eligible jobs, the system calculates dimension scores across five weighted areas:
- **Role Alignment (25%)**: Canonical job role vs direction target roles.
- **Skills Alignment (30%)**: Required and preferred skills extracted from job vs candidate profile and resume evidence.
- **Seniority Fit (20%)**: Target seniority levels vs job responsibility indicators.
- **Experience & Domain Fit (15%)**: System scale, industry exposure, and project complexity.
- **Location / Arrangement Fit (10%)**: Soft geographic proximity and hybrid attendance preferences.

### Stage 3: Deep AI Contextual Analysis (Selective High-Potential Execution)
To control external API costs, expensive deep LLM analysis is **not** run indiscriminately on every listing. It is triggered only for candidates scoring $\ge 70$ on deterministic passes:
- Identifies subtle technical strengths (e.g., "Candidate's open-source database contributions directly align with Stripe's storage team requirements").
- Highlights concrete preparation gaps (e.g., "Listing emphasizes Kafka stream processing; candidate resume demonstrates RabbitMQ only").

---

## 3. Score Policy Tiers

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MATCH SCORE OPERATIONAL TIERS                         │
├──────────────┬──────────────────┬───────────────────────────────────────────┤
│ Score Band   │ System Action    │ UI Label & Meaning                        │
├──────────────┼──────────────────┼───────────────────────────────────────────┤
│ **85 – 100** │ Immediate Alert  │ **Strong Fit**: High alignment; candidate │
│              │ (In-App)         │ should apply immediately.                 │
├──────────────┼──────────────────┼───────────────────────────────────────────┤
│ **70 – 84**  │ Daily Digest     │ **Good Fit**: Strong potential; minor     │
│              │                  │ gaps or preparation required.             │
├──────────────┼──────────────────┼───────────────────────────────────────────┤
│ **55 – 69**  │ In-App Stream    │ **Potential Stretch**: Viable stretch     │
│              │ Only             │ opportunity requiring targeted prep.      │
├──────────────┼──────────────────┼───────────────────────────────────────────┤
│ **< 55**     │ Hidden by Default│ **Low Fit**: Suppressed from default      │
│              │                  │ feeds to prevent cognitive overload.      │
└──────────────┴──────────────────┴───────────────────────────────────────────┘
```

---

## 4. Structured Output Contract (`JobMatchResult`)

```python
class EligibilityState(str, Enum):
    ELIGIBLE = "eligible"
    NOT_ELIGIBLE = "not_eligible"
    NEEDS_REVIEW = "needs_review"
    INSUFFICIENT_DATA = "insufficient_data"

class MatchDimensionScore(BaseModel):
    score: int                                       # 0–100
    weight: float                                    # e.g. 0.30
    explanation: str                                 # Grounded rationale

class JobMatchResultOut(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    career_direction_id: uuid.UUID
    resume_version_id: uuid.UUID
    
    eligibility: EligibilityState
    eligibility_reasons: list[str]                   # Human-readable reasons if not eligible
    overall_score: int | None                        # Null if not_eligible
    
    dimension_scores: dict[str, MatchDimensionScore]
    matched_skills: list[str]
    missing_required_skills: list[str]
    missing_preferred_skills: list[str]
    strengths: list[str]
    growth_areas: list[str]
    
    algorithm_version: str                           # e.g. "v2.4-hybrid"
    generated_at: datetime
```

---

## 5. Candidate Feedback Loop

Every match result displayed to the user includes a fast, single-click feedback mechanism:
- `Relevant`: Confirms high match quality.
- `Saved`: Converted to saved job.
- `Applied`: Application initiated.
- `Not relevant`: Low perceived alignment.
- `Wrong role`: Incompatible role family.
- `Wrong seniority`: Level mismatch.
- `Wrong location`: Incompatible geography.
- `Work-authorization mismatch`: Visa conflict not detected in job text.
- `Already applied`: Applied via alternative channel.
- `Not interested`: Generic disinterest.

Feedback events train local scoring weights and tune user-specific watch filters over time.
