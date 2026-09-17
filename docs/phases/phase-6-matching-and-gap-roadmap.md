# Phase 6: Explainable JD Matching & Career Gap Roadmap

> Status: Planned  
> Target: Provide deep, explainable JD/resume match scoring and an actionable bridge plan to close skill gaps.  
> Repository: `careerneed`

---

## 1. Objective & Product Value

Generic job match scores only provide arbitrary percentages without explanation. Candidates need to know:
- *Why does this job fit me?*
- *What specific requirements am I missing?*
- *How do I bridge the gap between my current level and this target role?*

**Phase 6 separates Match from Readiness and creates an actionable growth roadmap**:
- **Match**: Alignment of candidate's historical background with the job.
- **Readiness**: Candidate's immediate preparedness to clear the interview rounds.
- **Gap Roadmap**: Prioritized concrete actions (quick wins vs. architecture projects).

---

## 2. Technical Design & Data Flow

```text
Job Description Requirements
          vs.
Active Resume Evidence
          ↓
Semantic Evaluation Engine (app/services/match_engine.py)
          ↓
Output:
  ├── Match Score (0–100%) & Readiness Score (0–100%)
  ├── Requirements Met vs. Missing (Must-have vs. Nice-to-have)
  └── Career Gap Action Plan:
        ├── Quick Wins (1–2 weeks): Certifications, targeted tutorials
        ├── Portfolio Projects (1–2 months): Specific system architectures to build
        └── Study Topics: Core concepts required for the technical screen
```

---

## 3. Endpoints

- `POST /jobs/{job_id}/match-analysis` — Generate semantic match breakdown and gap plan for a job.
- `GET /profile/growth-roadmap` — Aggregated career gap roadmap across all target/saved jobs.

---

## 4. Granular Commit Plan

1. `feat: implement semantic jd matching service with match vs readiness distinction`
2. `feat: implement actionable career gap roadmap generator`
3. `feat: add match analysis and growth roadmap api endpoints`
4. `feat: build match breakdown card and gap roadmap view in web`
5. `test: add tests for match scoring and roadmap generation`
