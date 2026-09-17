# Phase 3: AI Interview Preparation & Post-Mortem Failure Analysis

> Status: Planned  
> Target: Provide intelligent, tailored prep before every round and actionable failure diagnosis after every outcome.  
> Repository: `careerneed`

---

## 1. Objective & Product Value

Attending interviews without targeted preparation and receiving rejections without understanding why creates a frustrating "black box" cycle.

**Phase 3 creates an intelligent coaching feedback loop**:
1. **Pre-Interview**: Generates a tailored preparation brief based on the exact job requirements, submitted resume, and round type.
2. **Post-Interview**: Dissects candidate self-reflections and interviewer feedback to uncover root failure causes and cross-interview patterns.

---

## 2. Technical Architecture & Data Flow

### 2.1 Pre-Interview Preparation Pipeline

```text
Inputs:
  ├── Job Description (Responsibilities, Tech Stack, Domain)
  ├── Submitted Resume (Projects, Languages, Scale Metrics)
  ├── Round Type (e.g. Coding, System Design, Behavioral)
  ├── Previous Round Notes
  └── Company Information
          ↓
  AI Context Aggregator (app/services/interview_prep.py)
          ↓
  Prompt Engineering with Pydantic Structured Output
          ↓
Output: `ai_prep_plan` (JSON)
  ├── Core Technical Topics & Architectural Trade-offs
  ├── Recommended STAR Resume Stories
  ├── Weakness & Gap Warnings
  └── High-Impact Questions for the Interviewer
```

### 2.2 Post-Interview Debrief & Outcome Logger
- After completing an interview, the candidate logs:
  - `questions_asked`: List of questions asked by the interviewer.
  - `user_reflections`: Areas of confidence, hesitations, or mistakes.
  - `interviewer_feedback`: Direct feedback received from recruiter or interview panel.
  - `result`: `passed`, `failed`, or `pending`.

### 2.3 Post-Interview Failure & Diagnosis Engine
- When an interview fails (`result == "failed"`):
  - **Diagnostic Root Cause**: Evaluates whether the failure was due to technical depth, architectural trade-offs, behavioral structuring, or time management.
  - **Cross-Interview Pattern Recognition**: Correlates notes across multiple failed interviews to identify recurring weaknesses (e.g., *"System design rounds consistently struggle on database partitioning"*).
  - **Remediation Plan**: Actionable resources, mock focus areas, and project improvements.

---

## 3. Schema Additions

Add JSONB fields to `interviews`:
- `ai_prep_plan`: JSONB
- `questions_asked`: Text
- `user_reflections`: Text
- `interviewer_feedback`: Text
- `ai_outcome_analysis`: JSONB

---

## 4. Endpoints

- `POST /applications/{application_id}/interviews/{interview_id}/prep-plan` — Generate/refresh AI preparation plan.
- `POST /applications/{application_id}/interviews/{interview_id}/debrief` — Record questions, reflections, and result.
- `POST /applications/{application_id}/interviews/{interview_id}/analyze-outcome` — Trigger AI failure root-cause analysis.
- `GET /interviews/insights/failure-patterns` — Retrieve aggregated cross-interview failure patterns.

---

## 5. Granular Commit Plan

1. `feat: add prep and debrief fields to interview schema`
2. `feat: implement ai interview preparation pipeline with structured output`
3. `feat: implement post-interview debrief logger and outcome api`
4. `feat: implement ai failure diagnostic engine and pattern recognition`
5. `feat: add ai prep workspace and debrief modal to frontend`
6. `test: add unit tests for prep prompt generation and debrief analysis`
