---
status: archived
superseded_by: ../00-product/vision-and-principles.md and ../00-product/roadmap-and-dependencies.md
reason: Consolidated into modern product vision and 6-phase strategic roadmap.
archived_date: 2026-09-19
---

> **ARCHIVED DOCUMENTATION**  
> This specification has been archived and superseded as part of the 2026-09-19 documentation consolidation.  
> It is preserved for historical decision context and provenance only. For current authoritative architecture, see [../00-product/vision-and-principles.md](../00-product/vision-and-principles.md).

# CareerNeed Global Product Specification

> **Version:** 1.0  
> **Status:** Approved  
> **Scope:** Product mission, user journey, module boundaries, and delivery phases.

## Product Mission

CareerNeed helps job seekers reduce administrative work, make deliberate career decisions, improve through structured feedback, and preserve their job-search history.

```text
Spend less time recording
→ Focus more on deliberate improvement
→ Receive actionable help through every career stage
```

CareerNeed is not merely:

```text
A generic job board
A spreadsheet replacement
A resume parser
A Kanban application tracker
```

It is a career operating system that connects candidate identity, career intent, market opportunities, application actions, interviews, and learning.

## Core Problem

Job seekers experience two related problems.

### Administrative overhead

```text
Jobs spread across company websites, ATS boards, LinkedIn, referrals, and email
Application status stored in notes or spreadsheets
Interview invitations copied manually
Follow-ups missed
Resume versions confused
Recruiter/interviewer details lost
```

### Black-box career loop

```text
User applies
→ receives little feedback
→ attends interviews
→ repeats similar weaknesses
→ cannot identify recurring gaps
→ cannot connect past outcomes to next actions
```

## Product Principles

1. **Candidate capability and career intent are different.**

   ```text
   Candidate Profile = what a user can do
   Career Direction = what a user wants to pursue
   ```

2. **A resume is a presentation artifact, not the complete person.**

   ```text
   Candidate Profile = full professional record
   Resume Version = selected evidence for a target
   ```

3. **Job fit is contextual.**

   ```text
   Match Result = Job × Career Direction × Resume Version × Matching Context
   ```

4. **History must remain meaningful.**

   Applications, resumes, jobs, matches, interviews, and outcomes must preserve historical snapshots and events.

5. **AI assists; users decide.**

   AI can extract, classify, recommend, summarize, and explain. It must not silently overwrite user-owned data.

6. **Today is an action page.**

   Today should show what needs attention now, not function as a link directory.

7. **The product must remain simple at the point of use.**

   Rich domain structure should reduce user cognitive load, not surface as excessive forms, cards, or controls.

## Primary User Journey

```text
1. Create account
   ↓
2. Build Candidate Profile manually or import resume
   ↓
3. Review and correct extracted profile data
   ↓
4. Create one or more Career Directions
   ↓
5. Create/select Resume Versions for those directions
   ↓
6. Discover canonical jobs through direction-aware Jobs workspace
   ↓
7. Review contextual Match Result and eligibility
   ↓
8. Save, dismiss, or create Application
   ↓
9. Track Application status, Interviews, Contacts, and Follow-ups
   ↓
10. Record questions, reflections, outcomes, and preparation status
   ↓
11. Use optional AI insights to identify patterns and next actions
   ↓
12. Preserve/export career history safely
```

## Product Modules

| Module               | Primary question                         | Core objects                                                  |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| Candidate Profile    | What can I do?                           | profile, experience, skills, education, projects              |
| Career Directions    | What do I want to pursue?                | direction, role preferences, location preferences, exclusions |
| Resume Management    | How do I present relevant evidence?      | resume, resume version, file/content snapshot                 |
| Jobs Discovery       | What opportunities exist?                | canonical job, company, job source, user job state            |
| Matching             | How does this opportunity fit this goal? | match result, eligibility, matching config                    |
| Applications         | What actions have I taken?               | application, status, event timeline, snapshots                |
| Interviews           | What happened in the process?            | interview, participant, question, reflection                  |
| Follow-ups and Today | What needs action now?                   | follow-up, reminders, upcoming interviews                     |
| Career Intelligence  | What should I improve next?              | AI suggestions, readiness assessments, pattern analysis       |

## Non-Goals for Early Releases

```text
Automatic submission to all ATS systems
Guaranteed employment or interview outcomes
Fully autonomous AI profile editing
Employer-side recruiting platform
Global legal work-authorization advice
Complex enterprise RBAC before a validated collaboration use case
Unlimited integrations before core CRUD workflows are reliable
```

## Delivery Phases

### Phase 1 — Foundation

```text
Authentication
Sessions
Users
Applications CRUD
List/Pipeline views
Basic resume management
Password reset flow
```

### Phase 2A — Interview Workflow

```text
Interview scheduling
Interview status/outcomes
Interview participants
Interview questions
LeetCode links
Follow-ups
Today upcoming-interview and due-action view
```

### Phase 2B — Candidate Context

```text
Candidate Profile
Career Directions
Location preferences
Work authorization
Resume Version foundation
```

### Phase 2C — Job Catalog

```text
Company
Canonical Job
Job Source
Job lifecycle
Job location normalization
Deduplication
```

### Phase 2D — Contextual Matching

```text
Match Result
Eligibility
Matching configuration
Score breakdown
Version metadata
Direction-aware Jobs workspace
```

### Phase 2E — Intelligence

```text
AI suggestions with user review
Gap analysis
Readiness assessment
Fast Capture preview/confirmation
Cross-interview learning patterns
Career analytics
```

## Success Metrics

Initial product metrics should prioritize completed workflows rather than vanity usage.

```text
Career direction creation rate
Resume version creation rate
Jobs saved per active user
Applications created and updated
Follow-ups completed on time
Interviews scheduled and debriefed
Time from interview completion to reflection capture
Percentage of AI suggestions reviewed by users
User-reported reduction in tracking effort
```

## Final Product Contract

```text
Candidate Profile
  What I can do

Career Direction
  What I want to pursue

Resume Version
  How I present relevant evidence

Canonical Job
  A market opportunity

Match Result
  How the job fits my current context

Application
  What I decided to do

Interview
  What happened and what I learned

Follow-up / Today
  What I need to do next
```
