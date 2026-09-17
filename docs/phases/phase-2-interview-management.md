# Phase 2: Interview Management & Fast Capture (Implemented ✅)

> Status: Completed  
> Target: Turn tracked applications into structured multi-round interview workflows with zero tedious data entry.  
> Repository: `careerneed`

---

## 1. Objective & Product Value

Technical candidates frequently juggle 5–10 active interview processes across various stages (Recruiter Screen, Technical Coding, System Design, Behavioral, Hiring Manager).

**Phase 2 achieves the following key loop**:
1. **Administrative Friction Reduction**: Replaces manual multi-field form-filling with **Fast Capture** (*Paste snippet → Smart Extraction → Review → Confirm*).
2. **Interview Organization**: Gives candidates an immediate overview of upcoming interviews in the next 1–7 days, complete with direct meeting URLs, round notes, and prep status.
3. **Data Model Integrity**: Decouples `status` (`scheduled`, `completed`, `cancelled`, `rescheduled`) from `result` (`pending`, `passed`, `failed`, `unknown`), allowing clean debriefing.

---

## 2. Technical Architecture & Data Model

### 2.1 Database Schema (`interviews` table)

```sql
CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    round INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    interview_type VARCHAR(50) NOT NULL DEFAULT 'technical',
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    result VARCHAR(50) NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMP WITHOUT TIME ZONE,
    duration_minutes INTEGER DEFAULT 60,
    timezone VARCHAR(50),
    interviewer_name VARCHAR(255),
    interviewer_title VARCHAR(255),
    interviewer_email VARCHAR(255),
    meeting_url VARCHAR(1000),
    location VARCHAR(500),
    notes TEXT,
    preparation_notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX ix_interviews_application_id ON interviews(application_id);
CREATE INDEX ix_interviews_scheduled_at ON interviews(scheduled_at);
CREATE INDEX ix_interviews_status ON interviews(status);
CREATE INDEX ix_interviews_result ON interviews(result);
```

- **Types**: `recruiter`, `technical`, `coding`, `system_design`, `behavioral`, `hiring_manager`, `panel`, `final`, `other`.
- **Statuses**: `scheduled`, `completed`, `cancelled`, `rescheduled`.
- **Results**: `pending`, `passed`, `failed`, `unknown`.

---

## 3. Endpoints & API Contracts

### 3.1 Interview CRUD Routes
- `GET /applications/{application_id}/interviews` — List all rounds for an application (chronological by round).
- `POST /applications/{application_id}/interviews` — Create a new round (with automatic round number incrementing).
- `GET /applications/{application_id}/interviews/{interview_id}` — Get single round details.
- `PATCH /applications/{application_id}/interviews/{interview_id}` — Update round details.
- `DELETE /applications/{application_id}/interviews/{interview_id}` — Remove an interview round.

### 3.2 Global Upcoming Interview Query
- `GET /interviews/upcoming?days=30&include_past=false`
  - Scoped to `current_user.id` across all applications.
  - Returns interviews with joined company and job title.

### 3.3 Fast Capture Extraction API
- `POST /interviews/fast-capture`
  - **Payload**: `{ "raw_text": "...", "application_id": null }`
  - **Logic**:
    1. Evaluates raw pasted text (recruiter email or calendar invite).
    2. Runs AI Structured Extraction (OpenAI / Groq / OpenRouter with Pydantic validation).
    3. Runs robust deterministic regex fallback (extracts Date/Time, Duration, Meeting URL, Timezone, Interviewer Name/Title).
    4. Automatically binds company and role if `application_id` is supplied.
    5. Returns uncommitted draft object for frontend preview modal. Never writes directly to DB without user review and confirmation.

---

## 4. Frontend UX Workflows

### 4.1 Fast Capture Interaction Model
1. User clicks **"⚡ Paste & Extract"** on Application Detail.
2. User pastes email or calendar invitation text.
3. System extracts structured details and shows **"Interview Detected"** review card.
4. User inspects, edits any fields, and clicks **"Confirm & Schedule Round"**.
5. Record created and immediately appears in the interview timeline.

### 4.2 Interviews Section on `/applications/[applicationId]`
- Shows scheduled rounds, badges for status & outcome.
- 1-click **"Join Meeting ↗"** launcher for Zoom / Google Meet / Teams.
- **"✓ Mark Completed"** dialog with outcome selection and 1-click Thank-you follow-up schedule.
- Edit & Delete actions.

### 4.3 Interview Center (`/interviews`) & Dashboard Integration (`/todo`)
- `/interviews`: Groups rounds into **Today**, **Tomorrow**, **This Week**, **Later**, and **Past / Needs Review**.
- `/todo`: Highlights upcoming interviews directly within the daily workflow with prep note status.

---

## 5. Automated Test Coverage
- `tests/test_interviews.py`: Comprehensive test suite verifying user authentication, ownership isolation, CRUD operations, auto-round increment, delete cascades, upcoming interview queries, and deterministic fast capture extraction.
