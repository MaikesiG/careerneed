# Phase 2: Interview Management & Fast Capture (Current Milestone 🎯)

> Status: In Progress (Current Sprint)  
> Target: Turn tracked applications into multi-round interview workflows with zero tedious data entry.  
> Repository: `careerneed`

---

## 1. Objective & Product Value

Technical candidates frequently juggle 5–10 active interview processes across various stages (Recruiter Screen, Technical Coding, System Design, Behavioral, Hiring Manager).

**Phase 2 solves two primary problems**:
1. **Administrative Friction**: Replaces manual multi-field form-filling with **Fast Capture** (*Paste snippet → Smart Extraction → Review → Confirm*).
2. **Interview Organization**: Gives candidates an immediate overview of upcoming interviews in the next 1–7 days, complete with direct meeting URLs, round notes, and prep status.

---

## 2. Technical Architecture & Data Model

### 2.1 Database Schema (`interviews` table)

```sql
CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    round INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    interview_type VARCHAR(50) NOT NULL DEFAULT 'technical_screen',
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    result VARCHAR(50) NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 60,
    interviewer_name VARCHAR(255),
    interviewer_title VARCHAR(255),
    interviewer_linkedin_url VARCHAR(1000),
    meeting_url VARCHAR(1000),
    location VARCHAR(500),
    preparation_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX ix_interviews_application_id ON interviews(application_id);
CREATE INDEX ix_interviews_scheduled_at ON interviews(scheduled_at);
```

- **Round Types**: `recruiter`, `technical_screen`, `coding`, `system_design`, `behavioral`, `hiring_manager`, `panel`, `final`, `other`.
- **Statuses**: `scheduled`, `completed`, `cancelled`, `rescheduled`.
- **Results**: `pending`, `passed`, `failed`, `no_decision`.

---

## 3. Endpoints & API Contracts

### 3.1 Interview CRUD Routes
- `GET /applications/{application_id}/interviews` — List all rounds for an application (chronological).
- `POST /applications/{application_id}/interviews` — Create a new round.
- `PATCH /applications/{application_id}/interviews/{interview_id}` — Update round details.
- `DELETE /applications/{application_id}/interviews/{interview_id}` — Remove an interview round.

### 3.2 Global Upcoming Interview Query
- `GET /interviews/upcoming?days=7`
  - Scoped to `current_user.id` across all applications.
  - Returns interviews with `scheduled_at >= now()` and `scheduled_at <= now() + days`.
  - Joined with `jobs` and `applications` to provide company name, job title, meeting URL, and round title.

### 3.3 Fast Capture Extraction API
- `POST /interviews/fast-capture`
  - **Payload**: `{ "raw_text": "...", "application_id": null }`
  - **Logic**:
    1. Evaluates raw pasted text (recruiter email or calendar invite).
    2. Searches user's active applications to guess company/role if `application_id` is omitted.
    3. Extracts `scheduled_at`, `duration_minutes`, `interview_type`, `interviewer_name`, `meeting_url`.
    4. Returns uncommitted draft object for frontend preview modal.

---

## 4. Frontend UX Workflows

### 4.1 Fast Capture Interaction Model
```text
User receives email / invite
  ↳ Clicks "+ Log Interview"
    ↳ Pastes raw email snippet
      ↳ AI / Regex extracts structured fields in < 2 seconds
        ↳ User reviews pre-populated modal (can edit any field)
          ↳ Clicks "Confirm & Save"
            ↳ Record created & immediately visible
```

### 4.2 Upcoming Interview Timeline (`/todo` & `/applications`)
- Answers:
  - *How many interviews in the next 24h, 3 days, 7 days?*
  - *Which companies and roles?*
  - *1-click button to launch Zoom / Google Meet / Teams.*
  - *1-click link to round notes.*

---

## 5. Granular Commit Plan for Phase 2

1. `feat: add interview data model and alembic migration`
2. `feat: add interview CRUD endpoints with user isolation`
3. `feat: add upcoming interviews query endpoint`
4. `feat: add interviews section to application detail workspace`
5. `feat: add upcoming interview calendar widget to todo dashboard`
6. `feat: implement fast capture smart paste extraction flow`
7. `test: add automated test suite for interviews and fast capture`
