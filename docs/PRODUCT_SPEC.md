# CareerNeed Product Specification (v0.2)

> Status: Approved & Active  
> Last Updated: 2026-09-17  
> Repository: `careerneed`

---

## 1. Executive Summary & Core Mission

### The Core Problem
Technical job seekers face two severe bottlenecks:
1. **Administrative Overhead**: Manually tracking jobs across disparate company career boards, copy-pasting interview invites, keeping notes in spreadsheets, and managing follow-ups consumes significant cognitive energy.
2. **The "Black Box" Loop**: Job seekers submit applications and attend interviews without understanding *why* they don't match certain roles, *what* their exact skill gaps are, or *why* they failed a technical/behavioral round. They repeat the same mistakes without a structured feedback loop.

### Product Mission
> **"Help users spend less time recording, focus more on deliberate improvement, and receive actionable advice for every step of their career journey."**

CareerNeed transforms passive job-hunting into an active, intelligent career operating loop:

```text
Step 1: Resume Upload & AI Career Profiling
   ↓
Step 2: Target Company Recommendation & Discovery
   ↓
Step 3: Automated Job Crawling & JD/Resume Match Analysis
   ↓
Step 4: Career Gap Diagnosis & Actionable Growth Roadmap
   ↓
Step 5: Unified Job Selection & Application Lifecycle Tracking
   ↓
Step 6: Interview Management (Upcoming Calendar & Fast Capture)
   ↓
Step 7: Per-Round AI Interview Preparation
   ↓
Step 8: Post-Interview Outcome Analysis & Failure Diagnosis
   ↓
Step 9: Stage Snapshots, Backup & Longitudinal Growth
```

---

## 2. User Journey & Detailed Module Specifications

### Module 1: First-Use Experience & AI Resume Profiling

#### 1.1 First-Use Onboarding Flow
1. **Resume Ingestion**: Upon first login, the user is welcomed with a streamlined onboarding prompt: "Upload your primary resume to initialize your career intelligence engine."
2. **Format Support**: Accepts PDF files (and optional raw text paste). File parsed using `pdfplumber`.
3. **AI Resume Analysis**:
   - Extracts structured entities: Technical Skills, Frameworks, Infrastructure/Cloud, Languages, Tooling.
   - Infers Domain Expertise: E.g., Distributed Systems, AI Infrastructure, Full-Stack, SRE.
   - Assesses Seniority Level: Junior, Mid, Senior, Staff, Principal.
   - Evaluates Career Themes & Strengths: Projects, leadership, scale, quantifiable achievements.
   - Identifies Initial Resume Gaps: Missing metrics, vague technical descriptions, underrepresented modern tooling.
4. **Interactive Profile Review**: The user inspects the extracted profile, corrects any misparsed data, and marks it as their baseline Career Profile.

---

### Module 2: Target Company Recommendation & Automated Job Discovery

#### 2.1 AI Company Recommendation
- Based on the user's parsed resume and target role preferences, the system suggests:
  - **Direct-Fit Companies**: Companies actively hiring for the candidate's exact profile and stack.
  - **Aspirational / Stretch Companies**: Top-tier tech firms or high-growth AI startups that align with the user's career trajectory.
  - **Company Categories & Industries**: E.g., AI/ML Infrastructure, Developer Tools, Enterprise SaaS, FinTech, Autonomous Systems.
- **User Preference Configuration**:
  - Desired companies (watchlist).
  - Excluded companies (blacklist).
  - Target company size/stage (Seed, Series A–C, Late-stage, Public).
  - Workplace preference (Remote-first, Hybrid, On-site locations).

#### 2.2 Automated Job Crawling & Sourcing
- For selected target companies, the system detects their ATS provider (Ashby, Greenhouse, Lever, Workday) and automatically configures career board synchronization.
- **Connectors**:
  - `AshbyConnector`
  - `GreenhouseConnector`
  - `LeverConnector`
  - `ManualJobEntry` (for roles discovered via referrals, LinkedIn, X, or email).
- **Idempotent Ingestion**: Deduplicates jobs via `(source, external_job_id)`. Tracks `first_seen_at`, `posted_at`, and `last_seen_at`.

---

### Module 3: JD / Resume Matching & Career Gap Roadmap

#### 3.1 Explainable Match & Readiness Scoring
For every discovered or manually entered job, the platform analyzes the Job Description against the active Resume:
- **Match Score (0–100%)**: How closely the candidate's historical background aligns with the job requirements.
  - Hard Skill Match: Languages, frameworks, specific databases.
  - Domain & Architecture Fit: Scale, system design, cloud environments.
  - Seniority & Scope Alignment: Years of experience, leadership scope.
- **Readiness vs. Match Distinction**:
  - A candidate can have an **85% Match** (strong background) but **60% Readiness** (needs to review specific LeetCode patterns or system design concepts).
  - Clearly distinguishes:
    - *Must-Have Requirements Met vs. Missing*
    - *Nice-to-Have Requirements Met vs. Missing*

#### 3.2 Career Gap Analysis & Actionable Growth Roadmap
When a user evaluates a job or an entire target job direction, CareerNeed generates an actionable roadmap:
- **Gap Identification**:
  - "This role requires production Kubernetes orchestration and Terraform, but your resume only shows Docker."
  - "This Staff Engineer role expects experience designing multi-region fault tolerance."
- **Actionable Bridge Plan**:
  1. **Quick Wins (1–2 weeks)**: Specific open-source tutorials, certifications, or targeted mini-projects to add verifiable evidence.
  2. **Medium-Term Projects (1–2 months)**: Architecture projects that can be added to GitHub and highlighted on the resume.
  3. **Interview Preparation Focus**: Specific technical topics to study before applying.

---

### Module 4: Job Selection & Application Lifecycle Tracking

#### 4.1 Application Lifecycle Workflow
Every job selected by the user transitions into a tracked **Application**:
```text
Saved → Applied → Interviewing → Offer / Rejected / Withdrawn
```
- **Fields Preserved**:
  - Job details (Company, Title, Location, Workplace Type, URLs).
  - Linked Resume Version (`resume_id`).
  - Applied Date (`applied_at`).
  - Markdown Notes (`notes`).
  - Follow-up Date (`follow_up_on`).
  - Application Contacts (`ApplicationContact`: Recruiter, Hiring Manager, Interviewer, Referral).

#### 4.2 Application Views
- **Table / List View**: Quick filtering by status, follow-up status (Due Today, Overdue, Scheduled), sorting, and search.
- **Pipeline Kanban Board (`/applications/board`)**: Drag-and-drop or one-click status transitions across stages.
- **Daily Focus Workspace (`/todo`)**: Dedicated view summarizing active pipeline metrics and highlighting urgent follow-ups.

---

### Module 5: Interview Management (Upcoming Phase 2 Milestone)

#### 5.1 Multi-Round Interview Tracking
An application in the `interviewing` stage can have multiple structured interview rounds:
```text
Application
  ├── Round 1: Recruiter Screen (30m)
  ├── Round 2: Technical Screen / Coding (60m)
  ├── Round 3: System Design & Architecture (60m)
  ├── Round 4: Behavioral & Leadership (45m)
  └── Round 5: Hiring Manager Chat (45m)
```

#### 5.2 Interview Data Model
- `id`: UUID (Primary Key)
- `application_id`: UUID (Foreign Key to `applications.id`, ON DELETE CASCADE)
- `round`: Integer (1, 2, 3...)
- `title`: String (e.g., "Round 2 - Live Coding & Data Structures")
- `interview_type`: Enum/String (`recruiter`, `technical_screen`, `coding`, `system_design`, `behavioral`, `hiring_manager`, `panel`, `final`, `other`)
- `status`: Enum/String (`scheduled`, `completed`, `cancelled`, `rescheduled`)
- `result`: Enum/String (`pending`, `passed`, `failed`, `no_decision`)
- `scheduled_at`: DateTime with timezone
- `duration_minutes`: Integer (e.g., 30, 45, 60, 90)
- `interviewer_name`: String (optional)
- `interviewer_title`: String (optional)
- `interviewer_linkedin_url`: String (optional)
- `meeting_url`: String (Zoom, Google Meet, Microsoft Teams link)
- `location`: String (e.g., "Virtual", "Office - NYC")
- `preparation_notes`: Text (Manual prep checklist and user notes)
- `ai_prep_plan`: JSON/Text (AI-generated preparation guide)
- `questions_asked`: Text (User's recording of questions posed during the interview)
- `user_reflections`: Text (How the candidate felt, answers given, areas of hesitation)
- `interviewer_feedback`: Text (Any formal or informal feedback received)
- `ai_outcome_analysis`: JSON/Text (AI post-interview diagnostic evaluation)
- `created_at` / `updated_at`: Timestamps

#### 5.3 Upcoming Interview Schedule & Calendar View
The primary daily view for an active candidate:
- **Questions Answered at a Glance**:
  - *How many interviews do I have in the next 1, 3, or 7 days?*
  - *Which companies and which roles?*
  - *What specific interview round is each one?*
  - *Is my preparation ready or pending?*
  - *Direct one-click link to the meeting URL and the AI Prep Workspace.*

#### 5.4 Fast Capture (Smart Copy-Paste Ingestion)
Manual data entry is the primary reason users abandon tracking tools.
**Fast Capture Workflow**:
1. User receives an email, calendar invite, or LinkedIn message from a recruiter:
   > *"Hi Alex, let's schedule your 45-minute Technical Screen on Zoom with our Staff Engineer Sarah Chen on Thursday, Sep 24 at 2:00 PM EST. Meeting link: https://zoom.us/j/123456"*
2. User copies the text and pastes it into the Fast Capture modal in CareerNeed.
3. **AI Smart Parser** extracts:
   - Associated Application / Company (matches against active applications).
   - Round Type: `technical_screen`
   - Interviewer: `Sarah Chen (Staff Engineer)`
   - Scheduled Date & Time: `2026-09-24 14:00:00-04:00`
   - Duration: `45` minutes
   - Meeting URL: `https://zoom.us/j/123456`
4. **Preview & Confirmation**: The user reviews the extracted fields, makes any quick edits, and clicks **Confirm & Save**.
5. The interview is created and linked to the application without manual typing.

---

### Module 6: AI-Assisted Interview Preparation

#### 6.1 Personalized Preparation Workspace
For every scheduled interview, CareerNeed aggregates all available context:
- **Job Description**: Required tech stack, core responsibilities, team mission.
- **Linked Resume**: The exact projects, skills, and metrics submitted.
- **Company Profile**: Engineering blog topics, recent tech news, tech stack clues.
- **Interview Round Type**: Coding vs. System Design vs. Behavioral.
- **Known Interviewer Background**: When contact information is available.
- **Past Interview History**: Weaknesses noted in prior rounds.

#### 6.2 AI Preparation Output Structure
The AI generates a targeted, non-generic preparation plan:
1. **High-Probability Technical Questions**:
   - Questions directly mapped to the company's domain and JD requirements.
   - Architectural trade-offs likely to be explored.
2. **Targeted Behavioral Stories to Review**:
   - Selects 3–4 specific stories from the user's resume that fit the STAR method for this company's leadership principles.
3. **Specific Weakness & Gap Warnings**:
   - Reminds the candidate of gaps identified during the JD matching phase (e.g., "Review concurrency primitives in Go; you flagged this as a weaker area").
4. **Smart Questions to Ask the Interviewer**:
   - Thoughtful, engineering-focused reverse-interview questions about their architecture, deployment pipeline, and team velocity.

---

### Module 7: Post-Interview Outcome Analysis & Failure Diagnosis

#### 7.1 Recording the Outcome
Immediately after the interview (while memory is fresh), the user completes a 2-minute debrief:
- What questions were asked?
- What answers went smoothly?
- Where did you get stuck or feel uncertain?
- Any feedback given by the interviewer?
- Did you pass, fail, or are you waiting for feedback?

#### 7.2 AI Failure & Success Diagnostic
When an interview results in a rejection or failure, the AI analyzes the debrief data:
- **Root-Cause Analysis**:
  - *Technical Depth Gap*: Inability to explain trade-offs at the required seniority level.
  - *Communication/Structure Gap*: Rambling answers without clear STAR framework.
  - *Domain Mismatch*: Insufficient familiarity with specific distributed systems concepts.
  - *Time Management*: Spent too much time on brute-force coding without reaching optimal solution.
- **Cross-Interview Pattern Recognition**:
  - Detects recurring patterns across multiple applications:
    - *"In 3 out of 4 failed system design rounds, you struggled with database partitioning and caching invalidation strategies."*
    - *"Your recruiter screens have a 90% pass rate, but coding screens have a 30% pass rate. Priority: Daily LeetCode practice over resume rewriting."*
- **Actionable Remediation**:
  - Recommends specific articles, practice sets, or mock interview focuses to fix the issue before the next upcoming interview.

---

### Module 8: Career History Snapshots & Backup

#### 8.1 Immutable Stage Snapshots
A candidate's job search is a multi-month journey. CareerNeed periodically snapshots:
- Resume versions submitted to each application.
- Initial JD match analyses.
- Application status changes and timestamp history.
- Interview notes, preparation plans, and outcomes.
- AI evaluations and feedback.

#### 8.2 Value of Longitudinal History
- Users can review past applications from 6 months or 2 years ago when re-applying.
- Never lose track of who referred you, what salary was discussed, or what technical questions were asked.
- Full data export (JSON/CSV) ensures the user always owns their career data.

---

## 3. Data Model & Architecture Additions

### New Tables for Phase 2 & Beyond

```sql
-- Interviews table
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
    ai_prep_plan JSONB,
    questions_asked TEXT,
    user_reflections TEXT,
    interviewer_feedback TEXT,
    ai_outcome_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX ix_interviews_application_id ON interviews(application_id);
CREATE INDEX ix_interviews_scheduled_at ON interviews(scheduled_at);

-- User Career Profile (AI Onboarding Analysis)
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

-- Career Stage Snapshots
CREATE TABLE career_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'application', 'interview', 'resume_profile'
    entity_id UUID NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX ix_career_snapshots_user_entity ON career_snapshots(user_id, entity_type, entity_id);
```

---

## 4. Non-Functional Requirements & Security

1. **Privacy & Security**:
   - Resume text and interview notes contain sensitive career and personal information.
   - All AI interactions must pass through user-authorized credentials (BYOK or managed platform tier with explicit disclosures).
   - User data is never used for training external public models.
2. **Speed & Latency**:
   - Fast Capture extraction must return parsed fields within 3 seconds.
   - Upcoming interview queries must load in `< 200ms`.
3. **Graceful Fallbacks**:
   - If an LLM provider is unavailable or token quotas are reached, all CRUD and note-taking features must remain 100% functional with manual inputs and rule-based heuristic parsing.
