# CareerNeed Product Requirements — v0.1

> Status: Active  
> Last updated: 2026-09-14  
> Product name: CareerNeed  
> Local development folder: `careerneed`  
> Repository: `careerneed`

## 1. Problem

Technical job seekers repeatedly browse fragmented company career sites, public ATS boards, LinkedIn links, referrals, and shared opportunities.

This creates several problems:

- Relevant jobs are spread across many places.
- The same role may be discovered more than once.
- It is easy to lose a promising role after seeing it.
- Application progress, notes, and follow-up work are often tracked in separate spreadsheets or not tracked at all.
- Job requirements are difficult to compare against the job seeker's existing evidence, skills, and resume.
- Job seekers spend too much time repeatedly browsing and too little time applying, following up, and building evidence.

CareerNeed provides one focused workspace for collecting, finding, evaluating, and tracking technical job opportunities.

## 2. Product vision

CareerNeed helps a technical job seeker operate a consistent daily job-search loop:

```text
Discover or add jobs
→ keep a unified job pool
→ filter and evaluate relevant opportunities
→ save or mark application progress
→ record notes and follow-up dates
→ return daily to decide the next action
```

The product prioritizes reliable, normalized source data and user-controlled career evidence before introducing complex AI features.

## 3. Brand and project identity

```text
Product name: CareerNeed
Local development folder: careerneed
GitHub repository: careerneed
```

Use `CareerNeed` in user-facing product UI, page titles, and documentation headings.

Use `careerneed` for repository, directory, package, environment, and infrastructure identifiers where lowercase naming is appropriate.

## 4. MVP user

The initial MVP user is a single technical job seeker: the project owner.

Primary job targets include:

- Platform Engineering.
- Developer Productivity / Developer Experience.
- Site Reliability Engineering–adjacent roles.
- AI Infrastructure roles.
- Related backend, cloud, infrastructure, and technical systems roles.

The product should remain general enough to support additional technical job categories later, but V1 decisions should optimize for this initial user and daily workflow.

## 5. Primary user story

> As a technical job seeker targeting Platform, Developer Productivity, SRE-adjacent, and AI Infrastructure roles, I want to collect and review a deduplicated set of relevant jobs from company sources and my own discoveries, then track applications and follow-ups in one workspace, so I can spend more time applying and building evidence instead of repeatedly browsing job boards.

## 6. Core workflow

### 6.1 Prepare career evidence

```text
Open Resumes
→ upload or manage resume records
→ select a default resume where applicable
→ use available resume evidence for job matching
```

### 6.2 Collect opportunities

```text
Add target company sources
→ sync public ATS jobs
→ normalize and deduplicate roles
→ display jobs in the unified Jobs pool
```

Or:

```text
Find a job externally
→ open Add a job
→ enter company, title, application URL, and optional job details
→ create a manual job
→ show it in the same unified Jobs pool
```

### 6.3 Find relevant roles

```text
Open Jobs
→ search and filter
→ compare match scores and job details
→ save, apply, interview, reject, withdraw, or update progress
```

### 6.4 Track work

```text
Open Applications
→ view application status
→ add or update notes
→ set follow-up dates
→ add, edit, or remove relevant contacts
→ identify due-today, overdue, and scheduled follow-up work
```

## 7. V1 scope

### 7.1 Home workspace

The Home page provides a clear starting point and links to the primary modules:

```text
Home
To Do
Resumes
Jobs
Applications
Add a job
Sources
```

The dedicated `/todo` workspace surfaces current dashboard summary and follow-up work when the API is available. Home remains a concise entry point for the daily job-search workflow.

### 7.2 Global navigation and visual consistency

All standard pages must include a shared application header with:

```text
CareerNeed → Home
Home
To Do
Resumes
Jobs
Applications
Sources
Theme: System / Light / Dark
```

The product must use one shared design system:

- Consistent page gutters and content alignment.
- Consistent card, button, input, and focus styles.
- A single primary action color.
- Light, Dark, and System modes.
- Accessible text contrast and semantic alerts.
- No page-specific visual system for ordinary UI components.

Detailed implementation requirements are defined in:

```text
docs/PROJECT_CONVENTIONS.md
```

### 7.3 Resume management

Users can:

- Upload and manage resume records.
- View resume labels, filenames, extracted skills, source, and archive status where available.
- Choose or identify a default resume where supported.
- Use resume data as evidence for deterministic match scoring.

V1 does not promise automated resume rewriting or autonomous career recommendations.

### 7.4 Company watchlist and sources

Users can:

- Add and manage target companies or configured job sources.
- Select source types such as Greenhouse, Lever, Ashby, custom, and manual where supported.
- Set source priority.
- Activate or deactivate sources.
- Trigger or observe job refresh behavior where implemented.

The system should support public career-page or ATS-board sources without requiring authenticated LinkedIn or Indeed scraping.

### 7.5 Public ATS job ingestion

The system can ingest publicly available job data from supported sources, including:

```text
Greenhouse
Lever
Ashby
Future supported public ATS connectors
```

Requirements:

- Use modular source connectors.
- Normalize source-specific payloads before persistence.
- Preserve source identity and source URLs where available.
- Make repeated ingestion idempotent.
- Do not let one failed source prevent unrelated source processing.
- Keep source-specific raw formats out of the main frontend and Job domain model.

### 7.6 Unified job pool

All job opportunities must appear in a common Jobs experience, whether sourced from an ATS sync or manually entered by the user.

A Job can include:

```text
Company name
Job title
Source/provider
Location
Workplace type
Description
Application URL
Source URL
Posted date
First seen date
Match score
Tracking status
```

Manual jobs must use:

```text
source = manual
source_type = manual_user_entry
```

Manual jobs must be searchable, filterable, scoreable, saveable, and trackable in the same way as supported synced jobs.

### 7.7 Manual job entry

Users can add a job found on a company website, LinkedIn, referral message, email, or another source.

Route:

```text
/jobs/add
```

Required V1 fields:

```text
Company name
Job title
Application URL
```

Optional V1 fields:

```text
Location
Workplace type
Job description
Source URL
```

Requirements:

- The Jobs page exposes a visible `+ Add a job` primary action.
- The form validates required fields before submission.
- The application URL uses a URL input.
- Submitted fields must be intentionally handled by the backend.
- On success, the job is created through `POST /jobs/manual`.
- On success, redirect to `/jobs?source=manual` or equivalent manual-job view.
- Do not automatically submit an external application.
- Do not automatically mark a role as externally applied merely because the user added it.

### 7.8 Job search, filters, and sorting

Users can search and filter the unified Jobs pool using available V1 criteria, including where implemented:

```text
Keyword search
Company/provider/source
Location text
Workplace type
Match score
Date/recency
Job/application tracking status
Search directions
Sort order
Pagination
```

Requirements:

- Filtering must be reflected in browser-visible URL query parameters where practical.
- URL state should survive refresh and support navigation back to a filtered list.
- Users can clear active filters.
- Empty states must clearly indicate when no jobs match.
- Missing source data must be represented safely, not fabricated.
- Location filtering is V1 text matching; advanced structured geographic normalization is deferred.

### 7.9 Deterministic match scoring

CareerNeed may calculate a rules-based match score from available resume evidence and normalized job content.

Requirements:

- Scoring must remain deterministic and explainable enough to debug.
- A score is an aid for prioritization, not an assertion that the user is qualified.
- Missing job descriptions may reduce score usefulness.
- The user must still be able to save and track low-score roles.
- More detailed score explanation is deferred to V1.1 or later.

### 7.10 Job and application status tracking

The product supports a stable application-tracking vocabulary:

```text
Saved
Applied
Interviewing
Offer
Rejected
Withdrawn
```

Requirements:

- A role may be saved before it is applied to.
- A manual job should not be assumed to be externally applied.
- Status controls must use consistent names throughout Jobs and Applications.
- Status changes should be persisted and reflected across Jobs and Applications.
- Status colors should be meaningful but not the sole indicator of state.

### 7.11 Applications, contacts, notes, and follow-up

Users can:

- View tracked applications in an Applications page.
- View an individual application detail page.
- Add and edit notes.
- Add, edit, and remove application contacts.
- Store a contact name and type, with optional email, LinkedIn URL, and contact notes.
- Set and clear follow-up dates.
- Filter applications by status.
- Filter or identify follow-ups that are due today, overdue, or scheduled.

Requirements:

- Notes, follow-up edits, and contact edits must persist.
- Contact operations must show useful loading, empty, success, and error feedback.
- The UI must show useful success and error feedback.
- Due-today and overdue labels must clearly distinguish urgency.
- Future interview records are a separate feature and should not be forced into a single Notes field.

### 7.12 Theme support

CareerNeed supports:

```text
System
Light
Dark
```

Requirements:

- System is the default mode.
- System follows the device/browser color preference.
- User-selected Light or Dark mode persists locally in V1.
- Every V1 page must be readable and usable in all three modes.
- All standard UI must use semantic theme tokens, not hard-coded page-specific palette classes.

## 8. V1.1 candidates

V1.1 is selected after real daily use reveals the largest friction. Candidate items include:

- Dashboard summary refinements after daily-use feedback.
- Improved manual job intake, including safe support for additional fields only when persisted.
- Interview records with multiple interview rounds, date/time, interview type, contacts, notes, and outcome.
- Resume selection/association per application.
- Explainable match-score breakdown.
- Resume tailoring assistance after data and user workflow are stable.
- Location normalization V2: country, region/state, city, remote scope, and multi-select filters.
- Source sync history and source-health visibility.

## 9. V2 scope: localization

V2 adds complete localization beginning with:

```text
English
Spanish
```

V2 requirements:

- Locale-aware routing, such as `/en/jobs` and `/es/jobs`.
- Language switcher that preserves the current route and query parameters where possible.
- Complete translation coverage, including navigation, forms, errors, filters, statuses, empty states, and buttons.
- Correct plural, date, number, and time formatting.
- Browser-language detection and persisted preference.
- Correct document language attribute such as `<html lang="es">`.
- Human review of Spanish product copy before release.

Localization is not just a menu translation. It is a product-wide route, UI-copy, validation, date/time, pluralization, accessibility, and testing milestone.

## 10. Out of scope

The following are out of scope for V1 unless the product roadmap is deliberately updated:

- Automated job applications or external application submission.
- Scraping authenticated LinkedIn or Indeed pages.
- Multi-user billing, subscriptions, and marketplace features.
- RAG, agents, or autonomous AI workflows before reliable ingestion and user evidence are established.
- AI recommendations that cannot be explained, overridden, or scoped to a useful workflow.
- Complete localization before V2.
- Advanced structured location normalization before V1 usage validates the need.
- Full analytics dashboards before real job-search workflow data exists.
- Automatic follow-up emails or external communications.
- Storing fields in the UI that the API silently ignores.

## 11. Non-functional requirements

### Reliability

- Repeated ingestion must not create duplicate source jobs.
- Manual creation must provide a clear success or error state.
- Source failures must not break unrelated sources.
- Existing jobs, applications, notes, and follow-up data must not disappear during ordinary source refreshes.
- Filter and pagination state should remain stable during normal navigation.

### Usability

- The user should be able to get from any standard page to Home.
- The user should be able to add a manually found job from the Jobs page in one clear action.
- Page layout, button hierarchy, colors, and form behavior must be consistent.
- The app must remain practical at narrow viewport widths.
- Light and Dark modes must have readable contrast.

### Privacy and security

- Do not commit credentials, API keys, source tokens, `.env` files, or private resume/application content.
- Store future source configuration and authentication secrets server-side.
- Treat resume data, notes, and application history as sensitive user data.
- Do not send user data to an AI provider without a documented product feature, user control, and privacy decision.

### Maintainability

- Frontend UI follows `docs/PROJECT_CONVENTIONS.md`.
- API design follows `docs/PROJECT_CONVENTIONS.md`.
- Architecture boundaries follow `docs/ARCHITECTURE.md`.
- New source types use the connector interface and normalized Job representation.
- New work passes defined lint, build, test, and manual acceptance checks.

## 12. Success criteria

The MVP is successful when the project owner can use it repeatedly for a real job search and can answer these questions quickly:

- What relevant jobs are in my current pool?
- Which new or manually found roles should I review?
- Which roles have I saved, applied to, or progressed to interviews?
- What application needs a follow-up today or is overdue?
- Which resume is active or most relevant?
- Can I add a role found outside supported ATS sources without losing it?

Practical V1 acceptance criteria:

- A user can navigate between Home, Resumes, Jobs, Applications, and Sources.
- A user can return Home from every standard page.
- A user can use Light, Dark, and System themes across all V1 pages.
- A user can add a valid manual job from `/jobs/add`.
- A manual job appears in the unified Jobs pool and can be found using the manual source filter.
- A user can save/update application progress and see it consistently.
- A user can add notes, manage follow-up dates, and manage contacts for an application.
- Job filters and pagination remain usable after refresh/navigation.
- The frontend passes `npm run lint` and `npm run build`.
- The backend passes `python -m pytest -q`.
