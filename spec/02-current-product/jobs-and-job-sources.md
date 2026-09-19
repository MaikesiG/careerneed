# Current Product: Jobs, Ingestion, and Discovery Workspace

> **Status:** Implemented (Ingestion & Filters) / In Progress (Jobs Workspace V2 & Direction Context)  
> **Owner:** CareerNeed Product & Platform  
> **Last Updated:** 2026-09-19  
> **Scope:** Canonical jobs, multi-source ATS connectors, personal tracking states, filtering/sorting/pagination, and the direction-aware discovery workspace.

---

## 1. Module Overview and Current Status

CareerNeed provides a unified, deduplicated opportunity catalog combining external ATS listings and manual user additions with private, user-specific tracking states.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAPABILITY STATUS BREAKDOWN                       │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Shipped & Verified in Code           │ • Ashby, Greenhouse, Lever connectors│
│                                      │ • Manual job entry (`/jobs/add`)      │
│                                      │ • Ingestion deduplication (source+id) │
│                                      │ • Full-text search & provider filters │
│                                      │ • Workplace type (remote/hybrid/onsite│
│                                      │ • Recency & match threshold filters   │
│                                      │ • Server-side offset pagination (20)  │
│                                      │ • URL-persisted search state          │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ In Progress (Active Milestone)       │ • Two-column Jobs Workspace V2        │
│                                      │ • Active Career Direction context     │
│                                      │ • User job states (saved/dismissed)   │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ Planned (Subsequent Phases)          │ • Multi-location structured taxonomy  │
│                                      │ • Automated Job Watch alert triggers  │
│                                      │ • External source health dashboards   │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Ingestion and Multi-Source Connectors

CareerNeed ingests opportunities from multiple ATS providers and user inputs without creating duplicate records for the same listing:

```text
[ Ashby ATS ] ─────┐
[ Greenhouse ] ────┼──► Normalization Engine ──► Ingestion Deduplication ──► Canonical Job
[ Lever ] ─────────┤
[ Manual Entry ] ──┘
```

### Connector Details
1. **Ashby (`app/connectors/ashby.py`)**: Ingests public job listings via Ashby job board APIs. Normalizes compensation, workplace type, and location text.
2. **Greenhouse (`app/connectors/greenhouse.py`)**: Connects to Greenhouse public board feeds. Parses offices, remote status, and requisition metadata.
3. **Lever (`app/connectors/lever.py`)**: Ingests Lever posting endpoints. Normalizes commitment, workplace categories, and clean URLs.
4. **Manual User Entry (`POST /jobs/manual`)**: Allows candidates to record unlisted opportunities, recruiter leads, or private referrals with company name, title, application URL, and notes.

### Ingestion Deduplication Rule
Deduplication at the ingestion boundary is strictly enforced using the composite natural key:
```text
(source, external_job_id)
```
When a recurring sync runs, existing records update `last_seen_at` without re-inserting identical job rows.

---

## 3. The Canonical Job Model

```python
class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint("source", "external_job_id", name="uq_source_external_job_id"),
    )

    id: uuid.UUID                                    # Primary key
    company_id: uuid.UUID | None                     # Optional relationship to Company
    company_name: str                                # Display company name
    source: str                                      # "ashby", "greenhouse", "lever", "manual"
    source_type: str                                 # "company_ats", "manual_user_entry"
    external_job_id: str | None                      # Remote requisition ID
    title: str                                       # Job title
    location: str | None                             # Clean location string
    workplace_type: str | None                       # "remote", "hybrid", "on_site"
    description: str | None                          # Full plain text / markdown description
    application_url: str                             # Link to apply
    source_url: str | None                           # Provenance URL
    status: str                                      # "new", "active", "expired", "closed"
    match_score: int | None                          # Baseline deterministic scoring heuristic
    posted_at: datetime | None                       # When posted by employer
    first_seen_at: datetime                          # Discovered timestamp
    last_seen_at: datetime                           # Most recent sync confirmation
    created_at: datetime
    updated_at: datetime
```

---

## 4. User-Specific Job States

A job's tracking status is strictly **user-specific** and stored in `user_job_states`. Global `Job` rows are read-only to ordinary users:

```text
user_job_states (user_id, job_id, state, saved_at, dismissed_at, dismissal_reason)
```

- **`unseen`**: The listing has not yet been presented to the candidate.
- **`viewed`**: Candidate expanded the listing details.
- **`saved`**: Candidate marked the job for deliberate preparation.
- **`applied`**: Candidate created an active `Application` referencing this job.
- **`dismissed`**: Candidate hid the job, optionally recording a feedback reason (`wrong_role`, `no_sponsorship`, `wrong_location`).

---

## 5. Jobs Discovery Workspace (`/jobs`)

### 5.1 Desktop Two-Column Layout (`lg` / 1024px+)
- **Left Filter Sidebar (`w-72`)**: Sticky, independently scrollable filter rail.
  - Active Career Direction switcher.
  - Workplace type multi-select (`remote`, `hybrid`, `on_site`).
  - Source provider multi-select (`ashby`, `greenhouse`, `lever`, `manual`).
  - Minimum match score single-select threshold (`All`, `50+`, `75+`, `90+`).
  - Recency presets (`All time`, `Since yesterday`, `Past week`, `Past month`).
  - Personal tracking filter (`All`, `Saved`, `Applied`, `Dismissed`).
- **Main Stream**:
  - Context header displaying selected direction, active override count, and total matching roles.
  - Compact, responsive Job Cards.
  - Numbered server-side pagination controls (20 items per page).

### 5.2 Narrow Screen / Mobile Layout (<1024px)
- Single-column flow with full filter parity in a modal slide-over drawer.
- Search input and compact direction pill selector pinned at top.
- Touch-friendly action buttons (minimum 44px touch targets).

---

## 6. URL-Persisted State Contract

All user filters, sort parameters, and pagination offsets are synchronized with URL query parameters to ensure back-navigation, browser refresh, and bookmarking work reliably:

```text
/jobs?provider=ashby&provider=lever&workplaceType=remote&minMatchScore=75&offset=20&limit=20
```

`limit` defaults to 20; `offset` controls pagination. Total count is computed server-side and returned via headers (`X-Total-Count`, `X-Total-Pages`) and response envelopes.
