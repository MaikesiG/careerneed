# AI Feature: Application-Grounded Interview Preparation Brief

> **Status:** In Progress (Active Milestone Feature)  
> **Owner:** CareerNeed AI & Product Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Grounded inputs, schema-validated output structure, draft lifecycle, and user confirmation for the Interview Preparation Brief.

---

## 1. Feature Purpose and Role

The **Interview Preparation Brief** is CareerNeed’s first production AI feature. It synthesizes private application context into a tailored, round-specific preparation plan to help technical candidates prepare with maximum efficiency.

Rather than offering generic interview tips, the brief evaluates the specific intersection of:
1. The target company's job description.
2. The candidate's submitted resume version.
3. The specific interview stage (e.g. Recruiter Screen, Technical Coding, System Design, or Behavioral).
4. Past reflections from prior rounds at this company (where available).

---

## 2. Input Contract and Data Minimization

The preparation engine extracts strictly bounded context to minimize external token exposure:

```python
class InterviewPrepInputContext(BaseModel):
    application_id: uuid.UUID
    interview_id: uuid.UUID
    
    # Grounding Context
    company_name: str
    job_title: str
    job_description_excerpt: str                     # Cleaned, bounded description (max 8,000 chars)
    submitted_resume_text: str                       # Plain-text snapshot of submitted resume (max 10,000 chars)
    interview_stage: str                             # "technical", "system_design", "behavioral", etc.
    round_number: int
    interviewer_title: str | None = None
    prior_round_reflections: list[str] = []          # User reflections from earlier rounds in this application
```

---

## 3. Validated Output Schema (`InterviewPrepOutput`)

The output is strictly enforced via Pydantic schema validation:

```python
class PrepPriority(BaseModel):
    title: str = Field(max_length=255)
    reason: str = Field(max_length=2000)
    recommended_action: str = Field(max_length=2000)
    priority: Literal["high", "medium", "low"]

class TechnicalTopic(BaseModel):
    topic: str = Field(max_length=255)
    reason: str = Field(max_length=2000)
    recommended_actions: list[str] = Field(default_factory=list, max_length=20)

class BehavioralStory(BaseModel):
    story_or_evidence: str = Field(max_length=2000)
    relevance: str = Field(max_length=2000)
    suggested_angle: str = Field(max_length=2000)

class LikelyQuestion(BaseModel):
    question: str = Field(max_length=2000)
    category: Literal["technical", "coding", "system_design", "behavioral", "case", "culture"]
    reason: str = Field(max_length=2000)
    recommended_angle: str = Field(max_length=2000)

class GapWarning(BaseModel):
    area: str = Field(max_length=255)
    reason: str = Field(max_length=2000)
    suggested_action: str = Field(max_length=2000)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)

class ReadinessAssessment(BaseModel):
    score: int | None = Field(default=None, ge=0, le=100)
    summary: str = Field(max_length=2000)
    limitations: list[str] = Field(default_factory=list, max_length=20)

class InterviewPrepOutput(BaseModel):
    summary: str = Field(max_length=3000)
    preparation_priorities: list[PrepPriority] = Field(default_factory=list, max_length=20)
    technical_topics: list[TechnicalTopic] = Field(default_factory=list, max_length=20)
    behavioral_stories: list[BehavioralStory] = Field(default_factory=list, max_length=20)
    likely_questions: list[LikelyQuestion] = Field(default_factory=list, max_length=30)
    questions_to_ask: list[str] = Field(default_factory=list, max_length=20)
    gap_warnings: list[GapWarning] = Field(default_factory=list, max_length=20)
    readiness: ReadinessAssessment
```

---

## 4. User Interaction & Artifact Lifecycle

```text
[ Generate Brief ] ──► Schema-Validated ──► Displayed as Draft in Modal
                                                  │
         ┌────────────────────────────────────────┴────────────────────────────────────────┐
         │                                        │                                        │
         ▼                                        ▼                                        ▼
[ Inspect Citations ]                   [ Edit / Add Notes ]                      [ Save to Prep Notes ]
                                                  │                                        │
                                                  ▼                                        ▼
                                        [ Append to Notes ]                     [ Add Tasks to Todo ]
```

1. **Initial Generation**: User clicks "Generate Preparation Brief" inside the Application Detail Interviews section. The generation is saved as an `ai_suggestion` with `status = pending`.
2. **Review Modal**:
   - The brief opens in a structured preview modal.
   - Every recommended topic displays a `[Source]` badge linking to the relevant resume bullet or job requirement.
3. **User Customization**:
   - The user can uncheck questions they do not wish to practice.
   - The user can edit the summary text or add private bullet points.
4. **Explicit Application**:
   - Clicking "Save to Interview Notes" copies the reviewed outline to `interview.preparation_notes`.
   - Clicking "Add Practice Questions to Todo" explicitly creates actionable `follow_up` tasks due before the interview date.

---

## 5. Non-Blocking Manual Fallback

If the AI provider times out, fails schema validation, or exceeds budget:
- The interview workspace displays a friendly error: *"Preparation brief could not be generated. You can enter prep notes manually."*
- The manual `preparation_notes` editor remains completely functional.
- The interview schedule, links, and question tracking operate normally without interruption.
