# CareerNeed Specification: Jobs Discovery & Workspace V2

> **Version:** 2.1  
> **Status:** Approved with V2 Domain Architecture Amendments  
> **Target Release:** Phase 2C–2D — Job Catalog and Contextual Matching  
> **Owner:** CareerNeed Product and Platform  
> **Core Principle:** _The Jobs page is not a generic job-board aggregator. It is a responsive, explainable opportunity workspace organized around a selected active Career Direction and its matching context._

---

## 1. Executive Summary

### 1.1 Product Purpose

Jobs V2 helps a user discover, evaluate, save, dismiss, and act on opportunities through a deliberate Career Direction.

The page must answer these questions quickly:

```text
Which opportunities are relevant to the career path I am pursuing?
Am I eligible for this opportunity under my constraints?
Why does this job fit or not fit me?
Which resume should I use?
Have I already saved, dismissed, or applied to this job?
What is the next best action?
```

### 1.2 Architectural Shift

Legacy Jobs behavior was a collection of temporary global filters:

```text
User
  → Global jobs list
  → Ad-hoc keyword/source/location filters
  → Match score treated as a Job field
```

Jobs V2 uses a selected **active Career Direction** as its persistent default context:

```text
Candidate Profile
  + Career Direction
  + Work Authorization
  + Resume Version
  + Matching Configuration
  + Canonical Job
  = Contextual Job Match Result
```

The selected Career Direction hydrates defaults but does not prevent the user from applying explicit temporary filters.

### 1.3 Non-Negotiable Domain Rules

```text
Match Score ≠ Job property

Match Score = Job × User × Career Direction × Resume Version × Matching Configuration × Version
```

```text
Job ≠ Source Listing

Canonical Job
├── Company relationship
├── Normalized metadata
├── Lifecycle
└── One or more Job Source listings
```

```text
Saved / dismissed / viewed / applied ≠ Job properties

They are user-specific Job relationships.
```

---

## 2. Jobs V2 Scope

### 2.1 In Scope

```text
Active Career Direction context
Direction switching
Canonical job search and filtering
User-specific saved/dismissed/applied states
Direction-aware match results
Eligibility and explanation display
Company, source, work arrangement, location, date, and application-state filters
Result count and pagination
Responsive desktop/mobile layouts
Accessible filters and actions
Application creation from a Job
```

### 2.2 Explicitly Deferred

```text
Automatic application submission to third-party job boards
Guaranteed ATS autofill
AI coach conversation experience
Calendar synchronization
Automated follow-up email delivery
Employer-side recruiting workflows
Complex cross-source manual merge console
Infinite scrolling as the only pagination mechanism
```

The first release should prioritize reliable discovery, clear evaluation, and user-controlled actions over broad automation.

---

## 3. Information Architecture

### 3.1 Selected Direction Context

The Jobs page has one selected active Career Direction at a time.

Example:

```text
Selected Career Direction: Data Analytics

Target roles:
Data Analyst, BI Analyst, Product Analyst

Seniority:
mid, senior

Location preferences:
US, New York City preferred

Work arrangements:
remote, hybrid

Preferred resume:
Data Analyst Resume v2
```

The direction acts as a default filter and matching context, not as an irreversible lock.

### 3.2 Direction Resolution Rules

On loading `/jobs`:

1. If `careerDirectionId` is in the URL, resolve that direction.
2. Otherwise use the user’s active default direction.
3. If no default exists, use the first active direction ordered by creation date or prompt selection.
4. If the user has no active directions, show a focused empty state directing them to create one.
5. If the requested direction is paused, archived, deleted, or not owned by the user, do not silently use it; show an appropriate error/reselection state.

### 3.3 Filter Precedence

Direction preferences populate initial defaults. Explicit user request parameters override direction defaults for the current page session.

```text
Direction defaults
        ↓
URL query parameters override defaults
        ↓
User filter interactions update URL state
        ↓
Server resolves final effective query
```

Example:

```text
Direction default seniority: mid, senior
User URL override: senior only
Effective filter: senior only
```

The UI must visibly distinguish:

```text
Direction defaults
vs.
Temporary overrides
```

Provide a single clear action:

```text
Reset to direction defaults
```

### 3.4 Active Direction Behavior

- Only `active` Career Directions appear in the default direction switcher.
- Paused directions may be viewed through a deliberate management flow but do not drive normal Jobs discovery.
- Archived directions do not drive Jobs discovery or automatic matching.
- Existing Applications and historical Match Results remain attached to archived directions.

---

## 4. Responsive Layout

### 4.1 Global Design Requirements

Jobs V2 must follow the project’s unified visual system:

```text
Light and dark theme support
Consistent global content width and side margins
Compact, intuitive controls
Accessible keyboard navigation
No unnecessary card/link overload
Clear primary action hierarchy
```

### 4.2 Standard Control Tokens

```css
--control-height-sm: 32px;
--control-height-md: 40px;
--control-height-lg: 44px;
--control-radius: 6px;
```

Component standards:

```text
Button default: h-10 px-4 text-sm rounded-md
Input: h-10 px-3 text-sm rounded-md
Select trigger: h-10 px-3 text-sm rounded-md
Combobox trigger: h-10
Search input container: h-10
Filter trigger: h-10
Dense table/status controls: h-8 only where density is intentional
Prominent modal submit action: h-11 where needed
```

Do not create page-specific variants that silently diverge from these tokens.

### 4.3 Desktop Layout

At `lg` breakpoint and above (`min-width: 1024px`), use a two-column workspace.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Global navigation: Brand · Jobs · Applications · Career Directions · Resumes · Profile    │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Discover Opportunities                                                    [Search jobs]   │
├───────────────────────────────┬──────────────────────────────────────────────────────────┤
│ FILTER SIDEBAR                │ JOB STREAM                                               │
│ width: 18rem / w-72           │                                                          │
│ sticky below header           │ Direction: [● Data Analytics ▼] [Resume: Data v2]        │
│ independently scrollable      │ 148 matching roles                                       │
│                               │ [Direction defaults] [3 temporary overrides] [Reset]    │
│ Career Direction              ├──────────────────────────────────────────────────────────┤
│ Seniority                     │ Job cards / compact list                                 │
│ Location                      │                                                          │
│ Work arrangement              │                                                          │
│ Provider                      │                                                          │
│ Posted date                   │                                                          │
│ Match score                   │                                                          │
│ Job state                     │                                                          │
│ Clear filters                 │                                                          │
│                               ├──────────────────────────────────────────────────────────┤
│                               │ Pagination                                                │
└───────────────────────────────┴──────────────────────────────────────────────────────────┘
```

Desktop rules:

- Sidebar uses `w-72` unless real content testing requires a measured adjustment.
- Sidebar must not cover footer content or exceed available viewport height.
- Main stream remains flexible and readable; do not force very wide cards on large screens.
- Search, direction context, result count, and override summary stay visually connected.
- Job results use numbered pagination as the reliable baseline; infinite scrolling may be added later as an enhancement, not the only way to access results.

### 4.4 Narrow Screen Layout

Below `lg` (`max-width: 1023px`), use a single-column, touch-friendly layout.

Order:

1. Search bar.
2. Direction selector as horizontally scrollable compact pills or a single selector.
3. Filter trigger showing active override count.
4. Direction context summary.
5. Single-column jobs stream.
6. Pagination.

```text
[ Search jobs                                      ]

[ Data Analytics ▼ ] [ Filters · 3 ]

Roles: Data Analyst, BI Analyst
Remote · Hybrid · Mid–Senior
148 matching roles

[ Job card ]
[ Job card ]
[ Pagination ]
```

Mobile rules:

- Use a modal/drawer sheet for full filters.
- Filter drawer has Apply and Reset actions fixed at the bottom if the content scrolls.
- Direction switching remains one-tap where feasible.
- Minimum touch target is 44px for important primary mobile actions.
- Cards must not require hover to reveal required actions or explanations.

### 4.5 Empty and Error States

#### No active Career Directions

```text
Set up a career direction to personalize job discovery.
[ Create career direction ]
```

#### No matching jobs

```text
No active jobs match this direction and filter set.
[ Reset to direction defaults ]
[ Edit direction preferences ]
```

#### Direction unavailable

```text
This career direction is not active or is no longer available.
[ Choose an active direction ]
```

#### Matching not generated

```text
Match analysis is not ready for this job yet.
You can still save the job or open the original listing.
```

---

## 5. Filters and Query Behavior

### 5.1 Filter Groups

The Jobs page must preserve existing filter behavior while adding direction-aware discovery.

| Filter                  | Interaction                  | Requirement                                                                                  |
| ----------------------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| Career Direction        | Single-select                | One selected active direction establishes matching context                                   |
| Keyword                 | Free text                    | Temporary override; searches title, company, normalized role, and selected searchable fields |
| Seniority               | Multi-select                 | Direction default may prefill values; user can override                                      |
| Country / region / city | Multi-select / hierarchical  | Uses canonical values and clear remote handling                                              |
| Workplace type          | Multi-select                 | `remote`, `hybrid`, `onsite`                                                                 |
| Provider                | Multi-select                 | Source provider filter; canonical job may have multiple providers                            |
| Posted date             | Multi-select or preset range | e.g. 24h, 3d, 7d, 30d, any                                                                   |
| Job state               | Multi-select                 | `saved`, `applied`, `dismissed`, optionally `unseen`/`viewed`                                |
| Match score             | Single-select threshold      | e.g. any, 90+, 80+, 70+, 60+                                                                 |
| Job lifecycle           | Default active-only          | Advanced/history mode may expose expired/closed/removed listings                             |

The user’s established preference is preserved:

```text
Matching score: single-select
Provider: multi-select
Workplace type: multi-select
Posted date: multi-select/preset selection
Job state: multi-select
```

### 5.2 Direction Defaults vs Temporary Overrides

Direction-controlled defaults include:

```text
Target roles
Seniority preferences
Location preferences
Work arrangements
Exclusions
Preferred resume
Matching configuration
```

Temporary Jobs-page overrides may include:

```text
Keyword
Alternative seniority selection
Alternative location selection
Provider
Date range
Match-score threshold
User job state
```

Rules:

- Jobs-page changes do not automatically mutate the saved Career Direction.
- Provide an explicit future action such as `Save filters to direction` only after a confirmation/review experience exists.
- A temporary override can widen or narrow a direction preference for current discovery.
- Hard user constraints, including work authorization conflicts and explicit `hard` exclusions, cannot be bypassed into an `eligible` Match Result simply by changing display filters.

### 5.3 Job Lifecycle Filtering

Default discovery query:

```text
job.status = active
```

Optional history/research modes may expose:

```text
expired
closed
removed
```

Rules:

- Expired/closed/removed jobs are excluded from the standard active discovery pool.
- A job that has an Application remains visible from that Application even if the listing is no longer active.
- A job can have multiple source listings; the canonical job remains active if at least one reliable listing remains active.

---

## 6. API Contract

### 6.1 Endpoint

```text
GET /api/jobs
```

Use the project’s established API-prefix convention consistently. If the API does not mount a global `/api` prefix, the equivalent route may be `/jobs`.

### 6.2 Query Parameters

```typescript
type JobState = 'saved' | 'applied' | 'dismissed' | 'unseen' | 'viewed';
type WorkplaceType = 'remote' | 'hybrid' | 'onsite';
type JobLifecycle = 'active' | 'expired' | 'closed' | 'removed';

interface JobListQueryParams {
  career_direction_id?: string;
  keyword?: string;

  seniority?: string[];
  countries?: string[];
  regions?: string[];
  cities?: string[];
  workplace_type?: WorkplaceType[];

  provider?: string[];
  posted_within?: 'day' | '3d' | '7d' | '30d' | 'any';
  job_state?: JobState[];
  lifecycle?: JobLifecycle[];

  min_match_score?: 60 | 70 | 80 | 90;
  eligibility?:
    | 'eligible'
    | 'not_eligible'
    | 'needs_review'
    | 'insufficient_data';

  limit?: number;
  offset?: number;
}
```

Rules:

- `career_direction_id` is optional only when a default active direction can be resolved.
- `limit` defaults to a documented safe page size, for example `25`.
- The API enforces a maximum page size, for example `100`.
- Repeated query values may be represented as repeated query parameters or a documented comma-separated format; use one consistent convention across the API.
- Invalid filter values return validation errors rather than being silently ignored.

### 6.3 Effective Query Resolution

The service resolves the final query in this order:

```text
1. Authenticate user.
2. Resolve selected direction from query parameter or active default.
3. Verify direction ownership, non-deleted state, and active lifecycle.
4. Load direction defaults and matching configuration.
5. Apply explicit request filters as temporary overrides.
6. Restrict canonical jobs to requested/default lifecycle, normally active only.
7. Join user-specific Job Match Results for the selected direction context.
8. Join user-specific Job State where present.
9. Apply authorization-safe sorting and pagination.
10. Return jobs, contextual match data, user state, effective filters, and total count.
```

### 6.4 Hard Constraint Behavior

Hard constraints must be evaluated separately from display filters and soft scores.

Examples:

```text
Work authorization
Sponsorship requirement
Explicit direction exclusions
Required location
Required work model
Employment type
```

A job with a hard constraint conflict must not receive a misleading positive eligibility label.

Example:

```text
Direction: US target location
Candidate: sponsorship required
Job: no sponsorship

eligibility: not_eligible
eligibility_reasons: ["Sponsorship is unavailable for this role"]
score: null or not emphasized
```

### 6.5 Sorting

Default sorting for active eligible jobs:

```text
1. Eligibility: eligible first
2. Match score descending, where present
3. Posted/discovered date descending
4. Stable job ID tie-breaker
```

Other supported sorts may be:

```text
best_match
newest
oldest
company_name
```

Avoid sorting jobs with `not_eligible` and high raw affinity above eligible jobs unless the user explicitly selects a research-oriented view.

### 6.6 Response Contract

```typescript
interface JobsListResponse {
  selected_career_direction: {
    id: string;
    name: string;
    category: string;
    status: 'active';
    preferred_resume?: {
      id: string;
      name: string;
      current_version_id?: string;
    } | null;
  };
  effective_filters: {
    direction_defaults: Record<string, unknown>;
    temporary_overrides: Record<string, unknown>;
    lifecycle: JobLifecycle[];
  };
  total: number;
  limit: number;
  offset: number;
  items: JobListItem[];
}

interface JobListItem {
  id: string;
  title: string;
  company: {
    id?: string;
    name: string;
    website?: string;
  };
  location_summary?: string;
  workplace_type?: WorkplaceType;
  seniority?: string;
  employment_type?: string;

  posted_at?: string;
  posted_date?: string;
  discovered_at: string;
  lifecycle: JobLifecycle;

  source_listings: Array<{
    provider: string;
    source_url: string;
    is_active: boolean;
  }>;

  user_job_state: {
    state: JobState | null;
    saved_at?: string;
    dismissed_at?: string;
    application_id?: string;
  };

  match: {
    id?: string;
    eligibility:
      | 'eligible'
      | 'not_eligible'
      | 'needs_review'
      | 'insufficient_data';
    eligibility_reasons: string[];
    score?: number;
    score_breakdown?: {
      role?: number;
      skills?: number;
      seniority?: number;
      location?: number;
      work_authorization?: number;
    };
    matched_skills?: string[];
    missing_skills?: string[];
    strengths?: string[];
    risks?: string[];
    explanation?: string;
    resume_version?: {
      id: string;
      name: string;
      version_number: number;
    } | null;
    algorithm_version?: string;
    taxonomy_version?: string;
    generated_at?: string;
  } | null;
}
```

### 6.7 Response Rules

- `total` is the number of records matching the effective server query before pagination.
- `source_listings` may expose a curated subset to avoid large response payloads.
- The UI must display source provenance when an apply link is offered.
- Missing Match Result is valid and must not be represented as a fabricated score.
- `user_job_state` is specific to the authenticated user and must never be cached/shared as global Job data.
- Do not return raw source payloads, private candidate data, secrets, or internal model prompts.

---

## 7. Server-Side Query Pipeline

### 7.1 Direction-Aware Retrieval

```text
Authenticate user
        ↓
Resolve active Career Direction
        ↓
Resolve preferred Resume Version / matching context
        ↓
Apply direction defaults and explicit temporary overrides
        ↓
Query canonical active Jobs
        ↓
Join Company and active Job Sources
        ↓
Join selected-direction Match Results for current user
        ↓
Join user-specific saved/dismissed/applied state
        ↓
Filter, sort, paginate
        ↓
Return explainable, direction-contextual results
```

### 7.2 Data Ownership Requirements

- Career Direction must belong to authenticated user.
- Resume used for match context must belong to authenticated user.
- User Job State must be joined by authenticated `user_id`.
- Match Result must be joined by authenticated `user_id` and selected `career_direction_id`.
- An Application state must only reference an application owned by authenticated user.
- Global Jobs and Companies are read-only catalog records for normal users.

### 7.3 User Job State Model

Jobs must not store global `saved`, `dismissed`, `viewed`, or `applied` booleans.

```text
user_job_states
├── id
├── user_id
├── job_id
├── career_direction_id              nullable
├── state                            unseen | viewed | saved | dismissed | applied
├── saved_at                         nullable
├── dismissed_at                     nullable
├── dismissal_reason                 nullable
├── created_at
└── updated_at
```

Rules:

- A job may be saved by one user and dismissed by another.
- A job can be dismissed in one Career Direction context without necessarily hiding it in every direction.
- `applied` should be derived or synchronized from the user’s Application record to avoid contradictory state.
- User Job State is private and must be scoped by current user in every query.

### 7.4 Match Result Model

The list query reads a versioned Match Result:

```text
job_match_results
├── job_id
├── user_id
├── career_direction_id
├── resume_version_id                nullable
├── matching_config_id               nullable
├── eligibility
├── eligibility_reasons
├── score                            nullable
├── score_breakdown
├── matched_skills
├── missing_skills
├── explanation
├── algorithm_version
├── taxonomy_version
├── generated_at
└── superseded_at                    nullable
```

Rules:

- Jobs V2 displays the most current unsuperseded result for its selected context.
- Historical Application pages use their Application/Match snapshot, not necessarily the latest score.
- A changed resume, taxonomy, job description, or matching algorithm may produce a new result.
- The user must be able to see at least a concise reason for an eligibility failure or match score.

---

## 8. Job Card V2

### 8.1 Job Card Purpose

A Job Card communicates enough actionable information for a user to decide whether to save, dismiss, apply, or inspect details without forcing an immediate modal or page transition.

### 8.2 Card Structure

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Stripe                                              Eligible · Match 88%  │
│ Senior Data Analyst                                                   ⋯   │
│                                                                          │
│ New York, NY · Hybrid · Senior · Posted 2 days ago                       │
│ Source: Ashby                                                            │
│                                                                          │
│ Why it fits                                                              │
│ Role: 92% · Skills: 85% · Location: preferred                            │
│ Matches: SQL, Python, experimentation                                   │
│ Growth areas: stakeholder analytics                                      │
│                                                                          │
│ [ Save ]  [ Dismiss ]  [ View details ]  [ Apply on Ashby ↗ ]           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Required Card Fields

```text
Company name
Job title
Location/work arrangement summary
Seniority when available
Posted date or discovered date
Job lifecycle when non-active/history view
Source/provider provenance
Current user job state
Eligibility status
Match score only when available and appropriate
Concise explanation or breakdown
Primary next action
```

### 8.4 Eligibility and Score Presentation

| Match state              | Card behavior                                                   |
| ------------------------ | --------------------------------------------------------------- |
| `eligible` with score    | Show score and concise breakdown                                |
| `eligible` without score | Show eligible and analysis pending/insufficient-data state      |
| `not_eligible`           | Show clear reason; do not visually promote raw score            |
| `needs_review`           | Show uncertainty and a concise reason, allowing user inspection |
| `insufficient_data`      | Show unavailable/limited analysis rather than a fake percentage |

### 8.5 Transparency Rules

- Never show a percentage without a corresponding Match Result context.
- Avoid precise-looking but unsupported claims such as “5+ years vs candidate 6 years” unless the necessary structured evidence exists and is part of the generated explanation.
- Explanations must distinguish facts from inference.
- Show the selected direction and resume context in card detail or a nearby context bar, not necessarily as repeated large text on every card.
- Show the matching version/details in a detail view, not as visual clutter on the list card.

### 8.6 Actions

Primary actions depend on current user state:

| State                         | Primary action                        | Secondary actions                       |
| ----------------------------- | ------------------------------------- | --------------------------------------- |
| Unseen/viewed                 | Save                                  | Dismiss, View details, Apply externally |
| Saved                         | Create application / Apply externally | Unsave, Dismiss, View details           |
| Applied                       | View application                      | View details, source link               |
| Dismissed                     | Restore                               | View details                            |
| Job inactive with application | View application                      | View historical job details             |

Rules:

- External apply links must identify their provider/source.
- External links use `target="_blank"` and `rel="noopener noreferrer"`.
- Creating an Application requires an explicit user action; do not treat clicking an external link as proof that the application was submitted.
- `Save to Applications` is ambiguous. Use either `Save job` or `Create application` depending on the actual resulting state.

### 8.7 AI Coach Preparation

`AI Coach Preparation` is deferred from the first Jobs V2 release.

When introduced, it must:

- Use the selected Job, Career Direction, and chosen Resume Version context.
- Clearly label output as AI-generated preparation assistance.
- Avoid sending secrets, tokens, or unnecessary private profile content to external providers.
- Allow user review rather than silently writing AI output into profile/application data.

---

## 9. Pagination, Performance, and Caching

### 9.1 Pagination

Jobs V2 uses offset pagination for the first release:

```text
GET /api/jobs?limit=25&offset=0
```

Response provides:

```text
total
limit
offset
items
```

The UI must show:

```text
Total matching jobs
Current page position
Previous/next controls
Direct page selection when count warrants it
```

Cursor pagination may replace offset pagination when catalog scale, sort stability, or performance requires it. Do not expose both styles without a clear migration plan.

### 9.2 Performance Targets

The direction switch UI should feel immediate, but the original requirement of `<300ms` must be interpreted carefully:

- UI selection feedback should occur immediately.
- Cached/local context switching should feel near-instant.
- A network-backed job result refresh depends on database and matching availability; the product must show a lightweight loading/skeleton state rather than promise an impossible universal response time.
- Establish measured service-level targets after representative data and deployment exist.

Initial engineering target for cached/typical local development may be:

```text
Direction control feedback: under 100ms perceived
Typical list API response: target p95 under 500ms at expected early-stage load
```

These are targets, not a substitute for monitoring.

### 9.3 Caching Rules

- Cache public/canonical catalog data carefully.
- Do not share/cache user-specific Match Results or User Job State across users.
- Cache keys for user-specific result sets must include at minimum:

```text
user_id
career_direction_id
resume_version_id or match context version
filter set
page parameters
```

- Invalidate/recompute relevant matches when a direction, profile, resume, matching config, taxonomy, or job changes materially.

### 9.4 Recommended Index Direction

Indexes should be created through reviewed migrations based on actual queries.

Initial likely indexes:

```text
jobs(status, last_seen_at)
jobs(company_id, normalized_role_id)
job_sources(provider, external_id)
job_sources(job_id, source_status)
job_match_results(user_id, career_direction_id, eligibility, score)
user_job_states(user_id, state, updated_at)
applications(user_id, job_id, status)
```

Do not add indexes blindly to every JSONB field before observing real query patterns.

---

## 10. Accessibility and Interaction Requirements

- All controls are keyboard accessible.
- Direction selector, filter drawer, and dropdowns manage focus correctly.
- Filter state is communicated in text, not color alone.
- Match/eligibility badges use semantic text and accessible labels.
- Job action menus have descriptive labels.
- Loading and filtering updates announce meaningful changes through appropriate status/live regions where needed.
- Mobile filter drawers trap focus while open and return focus to the trigger when closed.
- External source links disclose that they open a new tab.

---

## 11. Definition of Done

### Product and UX

1. Jobs V2 uses an active Career Direction as the default discovery and matching context.
2. Users can clearly switch between their active Career Directions.
3. Direction defaults hydrate Jobs filters; temporary overrides are visible and can be reset without mutating saved direction preferences.
4. Desktop uses a stable two-column workspace at `lg` and above.
5. Narrow screens use a single-column stream with full filter parity in an accessible drawer/sheet.
6. All standard inputs, buttons, selects, search controls, and filter triggers use the established `40px` medium control height unless a documented compact/large variant applies.
7. Job cards clearly communicate company, role, source, location/work arrangement, current user state, eligibility, and a contextually valid match explanation.
8. Job card actions use unambiguous language: `Save job`, `Dismiss`, `Create application`, `View application`, and source-specific external apply actions.
9. Jobs view shows matching total and reliable pagination.

### Data and API

10. `GET /api/jobs` resolves a selected active, user-owned Career Direction securely.
11. The API returns canonical Jobs, source provenance, user-specific Job State, and direction-contextual Match Result data.
12. Match score is never stored or represented as a global Job property.
13. Eligibility is distinct from score; hard constraint failures are visible and not visually promoted as high-fit recommendations.
14. User-specific saved/dismissed/viewed/applied state is stored separately from global Job catalog data.
15. Default discovery returns active jobs only; expired, closed, and removed jobs remain accessible through history/application contexts without appearing in normal discovery.
16. Provider, workplace type, date, and job state support multi-select behavior; match score remains a single-select threshold.
17. Result count and pagination are server-authoritative.

### Security and Reliability

18. Career Direction, Resume, Match Result, User Job State, and Application joins are scoped to the authenticated user.
19. No API response exposes another user’s saved state, application state, private resume data, or match results.
20. External apply links are validated/rendered safely and open with `noopener noreferrer`.
21. User-specific response caching is keyed by user and matching context.
22. Tests cover direction ownership, paused/archived direction rejection, default direction resolution, filter precedence, user-job-state isolation, lifecycle filtering, pagination, match-context isolation, and application creation behavior.
23. The implementation preserves existing filter requirements: provider/workplace/date/job state multi-select, match-score single-select, total count, and pagination.

---

## 12. Implementation Order

```text
1. Confirm Career Directions model/API and active/default lifecycle behavior.
2. Define canonical Job, Company, Job Source, and Job lifecycle interfaces.
3. Add User Job State model and APIs for save/dismiss/restore.
4. Define Job Match Result retrieval contract; use explicit unavailable state until matching is implemented.
5. Implement direction-aware GET /api/jobs with ownership, effective-filter resolution, totals, and pagination.
6. Add necessary indexes through reviewed migrations.
7. Build desktop/mobile Jobs layout and direction context bar.
8. Build filter sidebar and mobile drawer with URL-synchronized overrides.
9. Build Job Card V2 with eligibility, source provenance, user state, and safe actions.
10. Integrate Create Application and View Application flows.
11. Add performance monitoring, query measurements, and controlled caching.
12. Introduce AI preparation only after matching context, privacy boundaries, and human-review rules are in place.
```

---

## 13. Final Design Contract

Jobs V2 is a direction-aware opportunity workspace.

```text
Candidate Profile
  What the user can do

Career Direction
  What the user wants to pursue now

Resume Version
  How the user presents relevant evidence

Canonical Job
  A deduplicated market opportunity with source provenance and lifecycle

Match Result
  A versioned, explainable evaluation of this Job for this user and direction

User Job State
  What this user has saved, dismissed, viewed, or applied to

Application
  The user’s real decision and historical record
```

The Jobs page must make this context useful without overwhelming the user: one selected direction, clear defaults, visible overrides, explainable fit, trustworthy lifecycle state, and obvious next actions.
