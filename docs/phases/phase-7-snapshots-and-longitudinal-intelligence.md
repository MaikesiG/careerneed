# Phase 7: Stage Snapshots, Backup & Longitudinal Intelligence

> Status: Planned  
> Target: Preserve immutable historical career records and derive long-term search insights.  
> Repository: `careerneed`

---

## 1. Objective & Product Value

A job search spanning months contains invaluable data that is typically lost. Candidates need to know:
- *Which resume version generated the most interviews?*
- *What interview round causes the highest failure rate?*
- *What specific salary discussions or promises were recorded months ago?*

**Phase 7** introduces automated stage snapshots and longitudinal analytics.

---

## 2. Technical Architecture & Data Model

### 2.1 Schema (`career_snapshots` table)

```sql
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

### 2.2 Longitudinal Insights
- **Funnel Conversion Rates**: Application → Recruiter Screen → Technical Screen → Onsite → Offer.
- **Performance by Role Family**: Compare response rates for Platform vs. Full-Stack vs. MLOps.
- **Pass Rate by Interview Type**: Identify whether coding screens or behavioral interviews are the primary roadblock.
- **Export**: Full JSON / CSV export of all personal career data.

---

## 3. Endpoints

- `GET /analytics/funnel` — Retrieve conversion funnel statistics.
- `GET /analytics/interview-pass-rates` — Retrieve pass rates broken down by round type.
- `GET /export/career-data` — Export complete career search history as JSON/CSV.

---

## 4. Granular Commit Plan

1. `feat: create career snapshots model and automated snapshot triggers`
2. `feat: implement longitudinal funnel and pass rate analytics queries`
3. `feat: implement full career data export service (json and csv)`
4. `feat: build analytics dashboard and data export view in frontend`
5. `test: add tests for snapshot immutability and analytics calculations`
