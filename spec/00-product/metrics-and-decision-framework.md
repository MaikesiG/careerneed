# Metrics, Telemetry, and Product Decision Framework

> **Status:** Authoritative Product Standard  
> **Owner:** CareerNeed Product & Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Primary North Star metric, qualified action criteria, supporting pillar KPIs, 7-question decision framework, and near-term feature entry rule.

---

## 1. The North Star Metric

To ensure the product measures real candidate momentum rather than vanity page views or passive scrolling, CareerNeed defines its North Star metric as:

> **Weekly Qualified Job-Search Actions per Active User (WQJA)**

An **Active User** is defined as an authenticated user who opens CareerNeed at least once during the trailing 7-day measurement window.

---

## 2. Qualified Action Definitions

A **Qualified Job-Search Action** represents a deliberate, meaningful step taken by a candidate to advance their job search or career capabilities. Passive browsing, viewing a listing, or refreshing a dashboard does **not** count.

The following eight concrete user actions qualify:

| Qualified Action | Trigger Event | Product Rationale |
|---|---|---|
| **1. Prioritize / Save Job** | `user_job_state.saved` or priority tag applied | User evaluated an opportunity and decided it warrants active attention. |
| **2. Create / Progress Application** | `application.created` or `application.status_changed` | User moved an application forward in their real pipeline. |
| **3. Complete Follow-up Task** | `follow_up.completed` | User took action on a recruiter follow-up, thank-you note, or status check. |
| **4. Complete Interview Prep Action** | `interview_prep.task_completed` | User reviewed and completed a targeted technical or behavioral prep item. |
| **5. Record Question & Reflection** | `interview_question.created` with reflection / LeetCode link | User captured real interview evidence to compound learning for future rounds. |
| **6. Complete Career Routine** | `routine.completed` | User executed a repeatable career habit (e.g. daily LeetCode, weekly review). |
| **7. Tailor / Update Resume Version** | `resume_version.created` or linked to application | User deliberately adapted their career evidence for an opportunity. |
| **8. Apply Community Insight** | `community.insight_applied_to_application` | User converted an approved community question or prep pack into a private task. |

---

## 3. Supporting Pillar Metrics

Each product pillar tracks specific operational and user-outcome KPIs to support the North Star:

### Pillar 1: Private Career OS
- **Application Pipeline Velocity**: Average days spent in each application stage (`applied` → `screening` → `interview` → `offer`).
- **Interview Debrief Rate**: Percentage of completed interviews that have at least one question or reflection recorded within 48 hours.
- **Data Portability Health**: Success rate of data exports and zero unhandled export errors.
- **Account Retention**: Monthly active user retention across multi-month job-search cycles.

### Pillar 2: AI Career Intelligence
- **Generation-to-Save Rate**: Percentage of generated Interview Preparation Briefs that the user edits, notes, or saves.
- **Action Acceptance Rate**: Ratio of AI-suggested action items accepted vs rejected by the user.
- **Citation Click-Through Rate**: Frequency with which users click source citations to inspect the underlying private evidence.
- **Operational Health**: AI generation latency (p50/p95), schema validation error rate (<0.5%), and token cost per active user.

### Pillar 3: Opportunity Watch & Career Routines
- **Alert Quality Rate**: Percentage of Opportunity Watch alerts that lead to a Save or Apply action (Target: >35%).
- **Dismissal Reason Calibration**: Frequency and distribution of alert dismissals ("Wrong role", "No sponsorship") used to auto-tune direction filters.
- **Routine Consistency**: Percentage of active users completing at least 3 career routines per week.
- **Alert Fatigue Indicator**: Rate of alert mutes, quiet hour extensions, or notification dismissals.

### Pillar 4: Career Intelligence Community
- **Contribution Quality Ratio**: Percentage of user-submitted interview questions and debriefs approved by moderation on first review.
- **Insight-to-Action Conversion**: Percentage of community questions/packs that are saved to a user's private application or practice list.
- **Contributor Repeat Rate**: Percentage of contributors who submit more than one structured interview experience.
- **PetCoin Integrity**: Rate of suspicious tipping rings, circular transactions, or reward reversals (<0.1% target).

---

## 4. The 7-Question Product Decision Framework

Before any proposed feature, capability, or technical modification may enter the backlog or design phase, it must provide explicit, documented answers to the following seven questions:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CAREERNEED 7-QUESTION DECISION FRAMEWORK                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Which User?                                                              │
│    Which specific segment of our technical ICP is this built for?           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Which Career-Loop Step?                                                  │
│    Does this serve Discover, Decide, Act, Record, Reflect, Contribute, or   │
│    Improve?                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. What Measurable Improvement?                                             │
│    How does this demonstrably increase Weekly Qualified Job-Search Actions? │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Which Domain Objects & Permissions?                                      │
│    Which canonical entities does this touch, and how is ownership scoped?   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. What Blocks Users if Not Built Now?                                      │
│    What critical workflow failure or drop-off occurs if this is delayed?    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. Which Risk Must Be Mitigated?                                            │
│    What privacy, notification spam, hallucination, abuse, or cost risk      │
│    does this introduce, and how is it bounded?                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 7. Does It Deepen a Pillar or Create a Subsystem?                           │
│    Does this reinforce our four core pillars, or does it invent an isolated,│
│    disconnected tool?                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Near-Term Feature Entry Rule

To protect the roadmap from scope creep and premature feature sprawl, the following strict gate is enforced:

> **A feature CANNOT enter the active or near-term roadmap (Phases 0–2) unless:**
> 1. At least **three answers** to the 7-question framework are backed by concrete user data or verified workflow gaps; AND
> 2. All technical, domain, and data-model **dependencies are already shipped and verified** in prior phases.

Features failing this entry rule must be logged under `spec/07-decisions/` or marked as `Deferred` in the roadmap until prerequisites are satisfied.
