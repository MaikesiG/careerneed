# Future Module: Opportunity Watch and Career Routines

> **Status:** Planned (Phase 4 Core Deliverable; Routines in Phase 2)  
> **Owner:** CareerNeed Product & Recommendation Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Proactive Opportunity Watch alert engine, watch configuration, explainable notifications, and repeatable Career Routines.

---

## 1. Module Purpose and Principles

CareerNeed transitions candidates from passive manual searching to **proactive opportunity alerts** and **disciplined daily career habits**.

### Core Invariants
- **Explainable Alerts Only**: Every alert must state exactly why it fired and which watch rule triggered it.
- **Routines Are Habits, Not Todos**: Routines are recurring career disciplines, completely distinct from one-off application follow-ups.
- **In-App First**: Multi-channel external notifications (Telegram, push, SMS) are strictly deferred until in-app alert quality and dismissal feedback loops are proven.

---

## 2. Opportunity Watch Architecture

Opportunity Watch runs an automated evaluation pipeline across newly ingested and updated canonical jobs:

```text
[ ATS Job Sync ]
        │
        ▼
[ Normalize & Deduplicate ]
        │
        ▼
[ Detect New / Changed Active Jobs ]
        │
        ▼
[ Hard Eligibility Filter ] ──► (Reject unauthorized / mismatched roles)
        │
        ▼
[ Resume-Aware Contextual Match ] ──► (Evaluate against Career Direction & Resume)
        │
        ▼
[ Alert Policy Decision ]
   ├── Score >= 85 ──► Immediate In-App Alert (High Action Probability)
   ├── Score 70–84 ──► Daily Digest
   └── Score < 70  ──► In-App Recommendation Stream Only
        │
        ▼
[ Candidate Receives Alert ] ──► [ User Feedback Loop ]
                                 (Relevant · Applied · Wrong Role · No Sponsorship)
```

### 2.1 Opportunity Watch Configuration
Candidates define watch rules bound to specific Career Directions:
- `target_companies`: List of target employers (or "all technical employers").
- `role_keywords`: Specific role titles or families (e.g. `Backend Engineer`, `Distributed Systems`).
- `location_preferences`: Preferred cities (e.g. `New York, NY`, `San Francisco, CA`).
- `workplace_type`: Allowed arrangements (`remote`, `hybrid`, `onsite`).
- `seniority_levels`: Target levels (`junior`, `mid`, `senior`).
- `work_authorization`: Citizenship, visa type, and mandatory sponsorship constraints.
- `min_match_score`: Minimum contextual score threshold (default: 80).
- `bound_resume_version_id`: Resume version used to calculate the match.
- `notification_preferences`: Immediate vs digest, quiet hours, delivery frequency.

---

## 3. Career Routines (Repeatable Habits)

Routines represent recurring, deliberate disciplines that build candidate momentum over multi-month job-search cycles:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CAREER ROUTINES VOCABULARY                          │
├───────────────┬───────────────────────────────────┬─────────────────────────┤
│ Cadence       │ Routine Name                      │ Core Candidate Action   │
├───────────────┼───────────────────────────────────┼─────────────────────────┤
│ **Daily**     │ Coding & Algorithmic Practice     │ Solve 1–2 LeetCode / SQL│
│               │                                   │ problems; record link.  │
├───────────────┼───────────────────────────────────┼─────────────────────────┤
│ **Weekly**    │ Application Pipeline Review       │ Triage active apps,     │
│               │                                   │ archive stale leads.    │
├───────────────┼───────────────────────────────────┼─────────────────────────┤
│ **Weekly**    │ Recruiter Follow-up Triage        │ Check status checks and │
│               │                                   │ thank-you obligations.  │
├───────────────┼───────────────────────────────────┼─────────────────────────┤
│ **Weekly**    │ Targeted Networking Outreach      │ Contact 2–3 engineers or│
│               │                                   │ alumni in target roles. │
├───────────────┼───────────────────────────────────┼─────────────────────────┤
│ **Weekly**    │ Interview Prep & Mock Review      │ Review behavioral STAR  │
│               │                                   │ stories or sys design.  │
├───────────────┼───────────────────────────────────┼─────────────────────────┤
│ **Monthly**   │ Resume Freshness Audit            │ Update bullet points    │
│               │                                   │ with recent projects.   │
├───────────────┼───────────────────────────────────┼─────────────────────────┤
│ **Quarterly** │ LinkedIn & Portfolio Polish       │ Refresh public profiles │
│               │                                   │ and GitHub repositories.│
├───────────────┼───────────────────────────────────┼─────────────────────────┤
│ **Quarterly** │ Career Direction Calibration      │ Review active directions│
│               │                                   │ and target salary bands.│
└───────────────┴───────────────────────────────────┴─────────────────────────┘
```

Routines are integrated into the Today action center as recurring check-ins. Completing a routine counts toward the **Weekly Qualified Job-Search Actions** North Star metric.

---

## 4. Anti-Spam Notification Policy and User Feedback

### 4.1 Strict Notification Controls
- **User Ownership**: Candidates can adjust notification frequency, set quiet hours (e.g. no alerts 10 PM – 8 AM), or pause watch alerts entirely.
- **Duplicate Suppression**: Re-synced or slightly edited job listings never trigger duplicate alerts for the same candidate.
- **Digest Gating**: Only top-tier opportunities (Score 85+) qualify for immediate in-app alerts. Secondary opportunities are aggregated into a daily summary.

### 4.2 The Dismissal Feedback Loop
When a candidate dismisses an Opportunity Watch alert, CareerNeed collects structured, single-tap feedback:
- `Relevant`: Bookmarked or saved to pipeline.
- `Wrong role`: Candidate does not want this role family.
- `Wrong seniority`: Too junior or too senior.
- `Wrong location`: Incompatible geography or hybrid commute requirement.
- `Work-authorization mismatch`: Employer does not sponsor required visa.
- `Already applied`: Candidate submitted through external channel.
- `Not interested`: Generic disinterest.

**Automated Calibration**: If a candidate repeatedly dismisses alerts for a specific reason (e.g. 3 consecutive dismissals for "Wrong seniority"), the system prompts: *"Would you like to adjust your Career Direction seniority preference from Mid to Senior?"*
