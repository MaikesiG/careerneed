# Phase 4: Resume-First Onboarding & AI Career Profiling

> Status: Planned  
> Target: Transform the resume into the foundational career intelligence profile upon first use.  
> Repository: `careerneed`

---

## 1. Objective & Product Value

Rather than greeting new users with an empty, overwhelming dashboard, **Phase 4** initiates an intelligent onboarding wizard:
1. Candidate uploads their primary resume.
2. AI extracts deep technical competencies, seniority levels, domain expertise, and career themes.
3. Candidate reviews, tunes, and confirms their baseline **Career Profile**.

---

## 2. Onboarding Workflow

```text
Step 1: Welcome & Upload Prompt
  ↳ User uploads PDF or pastes resume
    ↳ PDF text extracted via pdfplumber
      ↳ AI deep profiling analysis executes
        ↳ Step 2: Interactive Review Modal
          - Technical Skills & Tools
          - Detected Seniority (Junior / Mid / Senior / Staff)
          - Domain Background (e.g. Distributed Systems, AI Infra, Web)
          - Target Roles (e.g. Platform Engineer, MLOps)
          - Initial Resume Improvement Suggestions
            ↳ Step 3: User Confirms Profile
              ↳ Transitions into Company Recommendation (Phase 5)
```

---

## 3. Data Model (`user_career_profiles` table)

```sql
CREATE TABLE user_career_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
    extracted_skills JSONB NOT NULL DEFAULT '[]',
    seniority_level VARCHAR(50),
    target_roles JSONB NOT NULL DEFAULT '[]',
    target_company_types JSONB NOT NULL DEFAULT '[]',
    preferred_locations JSONB NOT NULL DEFAULT '[]',
    strengths_summary TEXT,
    growth_areas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_user_career_profiles_user UNIQUE (user_id)
);
```

---

## 4. Endpoints

- `POST /onboarding/analyze-resume` — Upload resume for onboarding analysis without committing.
- `GET /profile/career-profile` — Fetch the user's active career profile.
- `PUT /profile/career-profile` — Update or confirm the user's career profile.

---

## 5. Granular Commit Plan

1. `feat: create user career profile model and migration`
2. `feat: implement deep resume profiling service with structured extraction`
3. `feat: add career profile get and update endpoints`
4. `feat: build first-use onboarding wizard frontend flow`
5. `test: add tests for profile extraction and onboarding transitions`
