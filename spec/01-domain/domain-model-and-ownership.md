# Domain Model, Entity Relationships, and Data Ownership

> **Status:** Implemented (Core Tables) / Planned (Direction & Context Extensions)  
> **Owner:** CareerNeed Platform & Data Architecture  
> **Last Updated:** 2026-09-20  
> **Scope:** Canonical domain entities, relationships, ownership boundaries, visibility tiers, and the single domain object rule.

---

## 1. The Stable Domain Object Rule

All future capabilities in CareerNeed must attach to the established canonical domain hierarchy. Engineering teams are **strictly prohibited** from introducing parallel, disconnected, or alternative job, application, interview, resume, or task systems.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CANONICAL DOMAIN OBJECT CHAIN                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Candidate Profile                                                           │
│ “What I can do” (durable professional capabilities and evidence)            │
│        ↓                                                                    │
│ Career Direction                                                            │
│ “What I want to pursue” (roles, seniority, locations, work arrangements)   │
│        ↓                                                                    │
│ Resume / Resume Version                                                     │
│ “How I present relevant evidence” (immutable presentation artifact)        │
│        ↓                                                                    │
│ Company / Canonical Job                                                     │
│ “What opportunity exists” (canonical market opportunity with sources)       │
│        ↓                                                                    │
│ Match Result                                                                │
│ “How this opportunity fits this goal and resume context” (contextual eval)  │
│        ↓                                                                    │
│ Application                                                                 │
│ “What action I took” (real candidate decision and hiring pipeline state)    │
│        ↓                                                                    │
│ Interview                                                                   │
│ “What happened in the process” (stages, rounds, participants, debriefs)     │
│        ↓                                                                    │
│ Question / Reflection / Follow-up / Todo                                    │
│ “What I learned and what I must do next” (actionable improvement flywheel)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Domain Concept Separations

To ensure long-term architectural durability and avoid costly database redesigns, the following concepts must remain strictly separated:

1. **Candidate Profile ≠ Career Direction**:
   - `Candidate Profile` represents durable professional history (skills, experience, education, projects, work authorization).
   - `Career Direction` represents specific job-search intent (target roles, seniority, location preferences, exclusions).
   - A user has one Candidate Profile, but may pursue multiple Career Directions (e.g. Full Stack vs Data Analytics).
2. **Candidate Profile ≠ Resume**:
   - A profile contains complete career evidence.
   - A resume is a curated subset of evidence tailored for a specific audience.
3. **Resume ≠ Resume Version**:
   - A `Resume` is a named entity (e.g., "Senior Backend Resume").
   - A `Resume Version` is an immutable, frozen snapshot tied to specific applications and matches.
4. **Canonical Job ≠ Job Source Listing**:
   - A `Canonical Job` is a singular market opportunity at a company.
   - A `Job Source` is a specific listing captured from an ATS (Ashby, Greenhouse, Lever) or manual entry.
5. **Match Result ≠ Job Property**:
   - Match Score is never a column on the `jobs` table.
   - It is a contextual evaluation: $\text{Job} \times \text{User} \times \text{Career Direction} \times \text{Resume Version} \times \text{Matching Config}$.
6. **Follow-up ≠ Notification**:
   - A `Follow-up` is a business action record (e.g., "Send thank-you to interviewer").
   - A `Notification` is a reminder that an action is due.

### Canonical FollowUp boundary

`FollowUp` is the canonical behavioral source of truth for reminders. It owns `id`, `user_id`,
`application_id`, optional `interview_id`, `title`, `type`, `due_at_utc`, `timezone`,
`completed_at`, `created_at`, and `updated_at`.

- An open FollowUp **MUST** have `completed_at IS NULL`; a completed FollowUp **MUST** have
  `completed_at IS NOT NULL`.
- An application-scoped FollowUp has an `application_id` and a null `interview_id`.
- An interview-scoped FollowUp has both identifiers. The Interview workspace and Application
  overview may show that same record; this is not duplicate data.
- `FollowUp.user_id` **MUST** match the owner of its Application. A supplied Interview **MUST**
  belong to that Application and owner.
- FollowUp lifecycle operations **MUST NOT** write the legacy `Application.follow_up_on` column.

See [ADR-0002](../07-decisions/ADR-0002-canonical-follow-up-migration.md) and the
[current FollowUp workflow](../02-current-product/contacts-follow-ups-and-todos.md).

---

## 3. Data Ownership and Tenant Boundaries

CareerNeed enforces strict separation between user-owned private data and platform-managed public catalog data:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA OWNERSHIP MODEL                           │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ USER-OWNED RECORDS                   │ PLATFORM-MANAGED CATALOG             │
│ (Private to Authenticated Owner)     │ (Shared Global Reference Data)       │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • Candidate Profile & Experiences    │ • Companies                          │
│ • Career Directions & Preferences    │ • Canonical Jobs                     │
│ • Resumes & Resume Versions          │ • Job Source Listings                │
│ • Applications & Notes               │ • Universal Taxonomies (Roles, Skills│
│ • Interviews & Questions             │ • Curated System Match Templates     │
│ • Follow-ups & Career Routines       │ • Public Community Packs (Approved)  │
│ • Reusable Contacts (Personal)       │                                      │
│ • AI Suggestions & Private Artifacts │                                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### Ownership Enforcement Rules
- **Server-Side Session Derivation**: User identity is derived strictly from verified session tokens (`get_current_user`).
- **Zero Client Trust**: Any `user_id` provided in request bodies, query parameters, or route paths is ignored for authorization.
- **Strict Query Scoping**: Every database query for private resources must include `Resource.user_id == current_user.id`.
- **Nested Resource Validation**: Child resources (e.g., `InterviewQuestion` or `InterviewParticipant`) validate ownership of the parent `Application` and `Interview` before executing mutations.

---

## 4. Visibility Levels

Every piece of information inside CareerNeed belongs to exactly one of four visibility tiers:

| Visibility Level | Description | Examples | Access Controls |
|---|---|---|---|
| **1. Private** | Strictly confidential to the authenticated user. Never exposed without explicit action. | Resumes, applications, interview reflections, recruiter emails, personal follow-ups, private AI drafts. | Owner-only authenticated access. |
| **2. Draft / Review** | Candidate-authored or AI-generated items awaiting explicit user confirmation or moderation. | Extracted resume skills awaiting review, Fast Capture interview proposals, unsubmitted community drafts. | Owner-only; uncommitted. |
| **3. Community** | Deliberately shared, anonymized, pre-moderated content accessible to active community members. | Anonymized interview questions in the Interview Lab, company interview round benchmarks, interview packs. | Authenticated community members; anonymized. |
| **4. Aggregated Intelligence** | Anonymized, non-identifying statistical trends computed across verified community contributions. | Company interview pass rates, role compensation percentiles, market timeline benchmarks. | Public / authenticated users; k-anonymity enforced ($k \ge 5$). |

---

## 5. Entity Relationship Schema

```text
users (id, email, password_hash, created_at)
  │
  ├── candidate_profiles (id, user_id, headline, summary, timezone)
  │     ├── candidate_experiences (id, profile_id, company, title, start_date, end_date)
  │     ├── candidate_skills (id, profile_id, skill_name, proficiency)
  │     └── work_authorizations (id, user_id, country_code, visa_type, sponsorship_req)
  │
  ├── career_directions (id, user_id, name, category, status, is_default, default_resume_id)
  │
  ├── resumes (id, user_id, name, is_default, archived_at)
  │     └── resume_versions (id, resume_id, version_number, content_snapshot, file_id)
  │
  ├── user_job_states (id, user_id, job_id, state [saved|applied|dismissed], saved_at)
  │
  ├── contacts (id, user_id, name, title, email, linkedin_url, relationship_type)
  │
  ├── applications (id, user_id, job_id, resume_id, status, applied_at, notes, follow_up_on [legacy])
  │     ├── application_contacts (id, application_id, contact_id, name, role, email)
  │     │
  │     ├── interviews (id, application_id, round, stage, scheduled_at, status, outcome)
  │     │     ├── interview_participants (id, interview_id, contact_id, role)
  │     │     └── interview_questions (id, interview_id, question, category, reflection, leetcode_url)
  │     │
  │     └── follow_ups (id, user_id, application_id, interview_id, type, title,
  │                     due_at_utc, timezone, completed_at, created_at, updated_at)
  │
  ├── ai_suggestions (id, user_id, entity_type, entity_id, suggestion_type, status)
  │
  └── career_routines (id, user_id, routine_type, frequency, last_completed_at)
```

---

## 6. Future Organization & Collaboration Support

While CareerNeed is currently architected as a consumer single-tenant application, data models are structured to allow future multi-tenant delegation (e.g. for universities, career coaches, or cohort programs) without database rewrites:
- Ownership is isolated cleanly at the `User` boundary.
- When B2B institutional pilots launch in Phase 6, an `organizations` and `organization_memberships` table can introduce role-based access grants (`resource_grants`) on top of canonical records with explicit student/candidate consent.
- Direct multi-tenancy or enterprise RBAC will not be prematurely implemented before Phase 6.
