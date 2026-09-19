# AI Feature: Application-Grounded Interview Preparation Brief

> **Status:** In Progress (Active Milestone Feature)  
> **Owner:** CareerNeed AI & Product Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Grounded inputs, data minimization boundaries, schema-validated output structure, advisory lifecycle, and user confirmation for the Interview Preparation Brief.

---

## 1. Feature Purpose and Role

The **Interview Preparation Brief** is CareerNeed’s first production AI feature. It synthesizes private application context into a tailored, round-specific preparation plan to help technical candidates prepare with maximum efficiency.

### Core Advisory Invariant
- **Strictly Advisory**: The preparation brief is strictly advisory and cannot automatically mutate canonical records (applications, interviews, questions, contacts, or todos).
- **No Autonomous Writes**: Every application of recommendations (e.g. copying to notes, creating todos) requires explicit user action.

---

## 2. Input Contract and Data Minimization Boundaries

### 2.1 Current v1 Context Extraction
Current v1 extracts strictly minimized, bounded context across application, interview, and participant records:
- **Application Context**:
  - `company_name`: Target company name (max 255 chars).
  - `role_title`: Target job title (max 500 chars).
  - `job_description`: Cleaned, bounded job description excerpt (max 6,000 chars).
- **Interview Context**:
  - `title`: Interview round title (max 255 chars).
  - `round`: Sequential round number.
  - `scheduled_at`: Scheduled interview timestamp in ISO format (or `None`).
  - `timezone`: Candidate IANA timezone string.
  - `format`: Interview format/type (e.g. `technical`, `coding`, `system_design`, max 50 chars).
  - `duration_minutes`: Estimated round duration.
  - `notes`: Candidate's existing interview round notes (max 3,000 chars).
- **Participant Context**:
  - Up to 20 linked interview participants with `name` (max 255 chars), `role` (`interviewer`, `coordinator`, `observer`), `title` (max 255 chars), and `relationship_type`.

### 2.2 Strict Context Exclusions
To protect candidate privacy and minimize third-party data exposure, the preparation engine strictly excludes from model payloads:
- **Contact Email Addresses**: `contact.email` is never forwarded to AI providers.
- **LinkedIn / Social URLs**: `contact.linkedin_url` and external profile links are excluded.
- **Private Notes**: Private candidate notes on contacts, debrief reflections, and unrelated personal notes are omitted.
- **Internal Identifiers**: Database UUIDs, application IDs, interview IDs, and participant primary keys are omitted from LLM prompts.
- **Exact Interview Location**: Physical street addresses and sensitive online meeting URLs (Zoom, Google Meet, Microsoft Teams links) are stripped.
- **Credentials & Auth Tokens**: Session tokens, passwords, API keys, and account credentials are strictly excluded.
- **Unrelated Records**: Cross-application history, unrelated company notes, and overall candidate profile drafts are excluded.

### 2.3 Future Context Expansion Candidates
Additional context sources are candidates for future context expansion:
1. **Submitted Resume Versions**: Plain-text snapshot of the specific resume version attached to the application.
2. **Question & Reflection History**: Historical questions and reflections recorded from earlier interview rounds in this application.
3. **Broader Preparation Notes**: Comprehensive preparation notes, debrief summaries, and research documents.

**Prerequisite Expansion Gate**: These context expansions will only be enabled after explicit source-selection controls, provenance tracking, data-minimization boundaries, privacy rules, and objective quality-evaluation rubrics are formally established and tested.

---

## 3. Validated Output Schema

### 3.1 Active v1 Production Schema (`InterviewPreparationBriefOut`)
The live brief output is strictly enforced via Pydantic schema validation:

```python
class InterviewPreparationBriefParticipantContext(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    role: Literal["interviewer", "coordinator", "observer"]
    suggested_focus: str = Field(min_length=1, max_length=1000)

class _InterviewPreparationBriefGenerated(BaseModel):
    summary: str = Field(min_length=1, max_length=3000)
    likely_topics: list[str] = Field(default_factory=list, max_length=12)
    questions_to_prepare: list[str] = Field(default_factory=list, max_length=12)
    participant_context: list[InterviewPreparationBriefParticipantContext] = Field(
        default_factory=list,
        max_length=20,
    )
    next_steps: list[str] = Field(default_factory=list, max_length=12)

class InterviewPreparationBriefOut(_InterviewPreparationBriefGenerated):
    disclaimer: str = Field(min_length=1, max_length=1000)
```

### 3.2 Planned Expanded Schema (`InterviewPrepOutput`)
Future iterations may expand the output structure to include granular sections once quality gates are satisfied:
- `preparation_priorities`: High/medium/low priority prep tasks with explicit rationale.
- `technical_topics`: Core domain topics and recommended study actions.
- `behavioral_stories`: Candidate stories mapped to company competencies.
- `likely_questions`: Predicted questions categorized by interview type.
- `gap_warnings`: Identified candidate experience gaps with suggested mitigations.
- `readiness`: Multi-dimensional readiness assessment with explicit data limitations.

---

## 4. User Interaction & Advisory Artifact Lifecycle

```text
[ Generate Brief ] ──► Server Schema-Validated ──► Displayed as Advisory Preview in Modal
                                                          │
         ┌────────────────────────────────────────────────┴────────────────────────────────┐
         │                                                │                                │
         ▼                                                ▼                                ▼
[ Inspect Grounding ]                            [ Edit / Add Notes ]            [ Manual Copy to Prep Notes ]
                                                          │                                │
                                                          ▼                                ▼
                                                 [ User-Owned Notes ]            [ User Creates Todos ]
```

1. **User-Triggered Generation**: User clicks "Generate Preparation Brief" inside the Application Detail Interviews section. Generation executes synchronously with bounded timeout; execution telemetry is committed to `ai_runs`.
2. **Advisory Preview Modal**:
   - The brief opens in a structured preview modal accompanied by a mandatory disclaimer: *"AI-generated preparation guidance. Verify details before relying on it."*
   - Findings provide clear grounding in supplied job description and interview parameters.
3. **No Automatic Record Mutation**:
   - The brief **remains strictly advisory** and **cannot automatically mutate canonical records**.
   - It does not automatically create todo items, alter application stages, overwrite interview notes, or modify contact cards.
4. **Explicit User Application**:
   - The candidate may manually copy or apply suggested questions and topics to `interview.preparation_notes`.
   - The candidate may explicitly create separate action items or follow-up tasks if desired.

---

## 5. Non-Blocking Manual Fallback

If the AI provider times out, fails schema validation, or exceeds budget:
- The interview workspace displays a friendly error: *\"Preparation brief could not be generated. You can enter prep notes manually.\"*
- The manual `preparation_notes` editor remains completely functional.
- The interview schedule, links, and question tracking operate normally without interruption.
