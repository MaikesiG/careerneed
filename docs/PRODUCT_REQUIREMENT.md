# CareerNeed Product Requirements — v0.2

> Status: Active  
> Last updated: 2026-09-17  
> Product name: CareerNeed  
> Local development folder: `careerneed`  
> Repository: `careerneed`

---

## 1. Problem Statement

Technical job seekers repeatedly browse fragmented company career sites, public ATS boards, LinkedIn links, referrals, and shared opportunities. Once in the search loop, they face significant operational and learning bottlenecks:

- **Fragmented Opportunities**: Roles are discovered across numerous boards, often leading to duplicate reviews or lost opportunities.
- **Manual Overhead**: Tracking applications, dates, contacts, and interview rounds in spreadsheets or fragmented notes is exhausting and prone to neglect.
- **The "Black Box" Loop**: Job seekers rarely understand their true match gaps before applying, and they receive generic rejections without understanding why they failed technical or behavioral interview rounds.
- **Lack of Actionable Direction**: Generic advice tells candidates to "do more LeetCode" or "improve your resume," rather than diagnosing their specific gaps against actual target job requirements.

CareerNeed provides a single, privacy-focused career operating system that **minimizes manual recording** and **maximizes candidate improvement**.

---

## 2. Product Vision & Philosophy

> **"Help users spend less time recording, focus more on deliberate improvement, and receive actionable advice for every step of their career journey."**

The platform connects the entire career transition journey:

```text
Resume Upload & AI Career Profiling
  ↳ Target Company Recommendation & Discovery
    ↳ Automated Job Crawling & Sourcing
      ↳ JD / Resume Match & Career Gap Roadmap
        ↳ Unified Job Selection & Application Tracking (List & Pipeline)
          ↳ Multi-Round Interview Management & Fast Capture
            ↳ Per-Round AI Interview Preparation
              ↳ Post-Interview Failure Diagnosis & Learning
                ↳ Career Stage Snapshots & Continuous Growth
```

---

## 3. Brand and Project Identity

- **Product name**: `CareerNeed` (used in user-facing UI, page titles, documentation headings).
- **Directory/Package/Repo identifier**: `careerneed` (lowercase for repository, directories, packages, and database identifiers).

---

## 4. User Personas & Primary Stories

### Primary Persona
Technical professionals (Software Engineers, Platform Engineers, SREs, AI/ML Infrastructure Engineers, and Engineering Leaders) actively seeking new opportunities.

### Core User Stories
1. **Onboarding & Profiling**:
   > *As a technical candidate, I want to upload my resume on first use and receive an AI analysis of my strengths, seniority, and skills, so I don't have to manually fill out my career profile.*
2. **Company & Job Discovery**:
   > *As a job seeker, I want CareerNeed to recommend companies matching my profile and automatically crawl their job openings, so I can discover high-relevance roles without browsing dozens of separate boards.*
3. **Career Gap & Growth Roadmap**:
   > *As an ambitious engineer, I want to compare target job descriptions against my resume to see my exact skill/experience gaps and get an actionable plan to close them.*
4. **Application Tracking**:
   > *As an applicant, I want a unified list and Kanban pipeline board to track all my applications, notes, follow-up dates, and recruiter contacts.*
5. **Interview Schedule & Overview**:
   > *As an active candidate, I want to see at a glance how many interviews I have in the coming days, what types of rounds they are, and whether my prep is done.*
6. **Fast Capture (Smart Copy-Paste)**:
   > *As a busy interviewee, I want to quickly paste an email or calendar invite from a recruiter and have CareerNeed automatically extract the round details and meeting link, without manual form-filling.*
7. **AI Interview Preparation**:
   > *As an applicant heading into a technical or behavioral round, I want an AI-generated preparation plan based on the company, JD, my resume, and round type.*
8. **Post-Interview Failure Analysis**:
   > *As a candidate who failed an interview, I want AI-driven diagnostic feedback analyzing what went wrong and how to improve for the next attempt.*
9. **Career History Backup**:
   > *As a continuous learner, I want snapshots of my resumes, interview notes, and outcomes preserved over time so I can review past progress.*

---

## 5. Completed Foundation (Phase 1 Status)

The following core modules are implemented and verified in production:

1. **Authentication & User Isolation**:
   - Registration, login, logout, password reset tokens (`/forgot-password`, `/reset-password`).
   - Database session tokens with secure HTTP-only cookies.
   - Strict row-level user isolation across all entities (`user_id`).
2. **Resume Management**:
   - Multi-version PDF upload via `pdfplumber`.
   - Automated skill extraction with LLM support (OpenAI, Groq, OpenRouter) and regex fallback.
   - Labeling, default resume designation, and soft archival.
3. **Job Sourcing & Dashboard**:
   - Connectors for Ashby, Greenhouse, Lever, and Manual entry.
   - Ingestion deduplication by `(source, external_job_id)`.
   - Unified search, multi-select filters, Search Directions, match score thresholds, and URL query persistence.
4. **Application Tracking & Contacts**:
   - Status workflow (`saved`, `applied`, `interviewing`, `offer`, `rejected`, `withdrawn`).
   - List view and Pipeline Kanban board (`/applications/board`).
   - Application Detail workspace with status editor, follow-up scheduler, notes, resume linker, and contact management.
5. **Daily Focus Dashboard**:
   - `/todo` workspace backed by `/dashboard/summary` and `/dashboard/follow-ups`.
6. **Security & LLM BYOK**:
   - AES-128 encrypted BYOK API keys, 5-call platform free tier, usage logs.
7. **UI Design System**:
   - Next.js 15, Tailwind semantic tokens, System/Light/Dark theme toggle.

---

## 6. Detailed Requirements for Phase 2: Interview Management & AI Coaching

### 6.1 Multi-Round Interview Model
- Each tracked application in `interviewing` status supports multiple chronologically ordered interview rounds.
- **Round Types**: `recruiter`, `technical_screen`, `coding`, `system_design`, `behavioral`, `hiring_manager`, `panel`, `final`, `other`.
- **Round Statuses**: `scheduled`, `completed`, `cancelled`, `rescheduled`.
- **Round Results**: `pending`, `passed`, `failed`, `no_decision`.
- **Key Fields**: Scheduled date/time (timezone-aware), duration (minutes), interviewer name/title/LinkedIn, meeting URL (Zoom/Meet/Teams), location, and notes.

### 6.2 Upcoming Interview Timeline View
- Displayed prominently on the Home, To Do, and Applications workspaces.
- Answers:
  - Number of interviews scheduled today, tomorrow, and over the next 7 days.
  - Grouped by date and sorted by start time.
  - Direct 1-click button to open the meeting URL.
  - Direct link to the interview's AI Prep Workspace.

### 6.3 Fast Capture (Smart Text Ingestion)
- **Modal / Quick Action**: Accessible via a global "+ Log Interview" or within an Application.
- **Input**: Free-form raw text pasted from a recruiter email, calendar invite, or messaging thread.
- **Smart Extraction Engine**:
  - Automatically identifies: Company/Application, Round Type, Scheduled Date & Time, Duration, Interviewer Name, Meeting Link.
  - Non-destructive: Always presents an editable preview modal to the user before committing to the database.
  - Fallback: If text is ambiguous, prompts user to confirm the extracted fields.

### 6.4 AI-Assisted Interview Preparation
- Context inputs: JD, submitted resume, company context, round type, previous round notes, known gaps.
- Actionable output sections:
  1. **Core Technical Topics & Trade-Offs**: Concepts critical to this company's architecture.
  2. **Recommended Resume Stories (STAR Method)**: Relevant projects to articulate.
  3. **Gap & Weakness Warnings**: Technical areas where the candidate previously hesitated.
  4. **High-Value Questions to Ask**: Strategic questions demonstrating domain mastery.

### 6.5 Post-Interview Debrief & AI Failure Analysis
- **Post-Call Logger**:
  - Questions asked by the interviewer.
  - Candidate's self-reflections (where they felt confident vs. struggled).
  - Formal or informal recruiter feedback.
  - Round outcome (`passed` / `failed`).
- **AI Failure Diagnostic Engine**:
  - Dissects failure root causes (e.g., system design scalability, coding optimization, communication structure).
  - Cross-interview pattern detection across all applications.
  - Actionable remediation: specific exercises, project areas, or concepts to practice.

---

## 7. Detailed Requirements for Phase 3: Onboarding & Discovery

### 7.1 First-Use Resume Ingestion
- First-time users are prompted to upload their resume before accessing empty dashboards.
- AI parses technical competencies, seniority, domain background, and quantifiable achievements.
- User reviews and confirms their baseline Career Profile.

### 7.2 Target Company Recommendation & Ingestion
- AI suggests matching companies (Direct-Fit vs. Stretch/Aspirational).
- User selects target companies or company categories.
- System automatically registers career URLs and initiates job sync.

### 7.3 JD/Resume Matching & Career Gap Roadmap
- Semantic comparison evaluating hard skill fit, domain fit, and seniority alignment.
- Clearly differentiates **Match** (alignment with background) from **Readiness** (immediate preparation needed).
- Generates a prioritized gap-closing roadmap (Quick Wins vs. Long-Term Projects).

---

## 8. Detailed Requirements for Phase 4: Snapshots & Backup

### 8.1 Career Stage Snapshots
- System creates immutable historical snapshots of:
  - Specific resume versions sent to each company.
  - JD match scores and gap analyses at time of application.
  - Interview notes, prep plans, and diagnostic outcomes.
- Data export in standard JSON and CSV formats.

---

## 9. Non-Functional Requirements

- **Privacy & Security**: All resume data, notes, and API keys are strictly user-isolated. No user data is used for training public models.
- **Performance**:
  - Fast capture extraction: `< 3 seconds`.
  - Upcoming interview schedule query: `< 150 ms`.
- **Reliability & Offline Tolerance**: If external LLM APIs fail or quotas expire, all core tracking, calendar viewing, and note editing remain 100% operational.
- **Design System Consistency**: Strict compliance with Tailwind semantic tokens and responsive layout conventions in `docs/project-conventions.md`.
