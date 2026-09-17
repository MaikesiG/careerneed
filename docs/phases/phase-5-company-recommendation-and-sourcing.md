# Phase 5: Target Company Recommendation & Automated Job Crawling

> Status: Planned  
> Target: Proactively discover relevant companies and automate job board crawling based on the user's profile.  
> Repository: `careerneed`

---

## 1. Objective & Product Value

Job seekers spend hours browsing random job boards without knowing which companies actually hire for their specific stack and seniority.

**Phase 5 eliminates manual company hunting**:
1. AI analyzes the candidate's career profile to recommend high-relevance target companies.
2. The user selects target companies or industry categories.
3. CareerNeed automatically identifies their ATS provider and syncs active openings into the user's job pool.

---

## 2. Technical Architecture & Workflow

```text
User Career Profile (Skills, Seniority, Target Roles)
            ↓
Company Recommendation Engine (app/services/company_recommender.py)
            ↓
Categorized Recommendations:
  ├── High-Fit Companies (exact match for stack & seniority)
  ├── Stretch / Aspirational Companies (top-tier tech, high-growth AI)
  └── Industry Clusters (e.g. AI Infrastructure, DevTools, FinTech)
            ↓
User Selects Companies (or adds custom company career URLs)
            ↓
ATS Board Auto-Discovery Service
  - Checks Ashby, Greenhouse, Lever, Workday endpoints
            ↓
Automated Background Job Sync → Unified Job Pool
```

---

## 3. Endpoints

- `GET /companies/recommendations` — Fetch AI-recommended companies based on profile.
- `POST /companies/subscribe` — Subscribe to a recommended company and trigger initial sync.
- `POST /companies/discover-board` — Probe a custom company career URL to identify the ATS provider.

---

## 4. Granular Commit Plan

1. `feat: implement company recommendation engine with fit categorization`
2. `feat: add ats board auto-discovery service for custom urls`
3. `feat: add company recommendation and subscription api endpoints`
4. `feat: build company discovery and watchlist ui in frontend`
5. `test: add tests for company recommendation and board discovery`
