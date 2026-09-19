# Active Capabilities and Implementation Status Matrix

> **Status:** Authoritative Capability Registry  
> **Owner:** CareerNeed Product & Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Consolidated tracking index of all functional product capabilities, implementation statuses, primary specifications, and architectural dependencies.

---

## 1. Capability Status Index

This document serves as the single authoritative status matrix for CareerNeed's functional capabilities. It maps each core feature to its primary specification and operational implementation status:

| Capability | Status | Primary Spec | Dependencies / Notes |
|---|---|---|---|
| **Jobs Catalog & Ingestion** | **Implemented** | [`jobs-and-job-sources.md`](jobs-and-job-sources.md) | Ashby, Greenhouse, Lever connectors, manual entry (`/jobs/add`), deduplication by `(source, external_job_id)`. |
| **Jobs Workspace & Filters** | **In progress** | [`jobs-and-job-sources.md`](jobs-and-job-sources.md) | Direction-aware two-column desktop layout (`lg`), mobile drawer, workplace type, source, match score, offset pagination. |
| **Applications Tracking** | **Implemented** | [`applications.md`](applications.md) | User-scoped CRUD, List and Kanban Board (`/applications/board`), Status Editor, Notes Editor. |
| **Application Detail Workspace** | **Implemented** | [`applications.md`](applications.md) | Client-side detail view (`/applications/[id]`), Resume Linker, Follow-up Date Editor, linked contacts. |
| **Application Snapshots** | **In progress** | [`applications.md`](applications.md) | Immutable freezing of job description, applied resume text, and match evaluation at submission time. |
| **Interviews Management** | **Implemented** | [`interviews-and-preparation.md`](interviews-and-preparation.md) | Multi-round interview CRUD, stages, statuses, outcomes, UTC scheduled timestamps, IANA timezones. |
| **Contacts & Participants** | **Implemented** | [`contacts-follow-ups-and-todos.md`](contacts-follow-ups-and-todos.md) | Global reusable contacts (`/contacts`), application contacts (`ApplicationContact`), participant linking. |
| **Questions & Reflections** | **Implemented** | [`interviews-and-preparation.md`](interviews-and-preparation.md) | Independent `interview_questions` table, categories, answer notes, reflections, validated HTTPS LeetCode URLs. |
| **Follow-ups & Today Dashboard** | **Implemented** | [`contacts-follow-ups-and-todos.md`](contacts-follow-ups-and-todos.md) | Actionable `FollowUp` entities, due/overdue calculation, Today daily action dashboard (`/todo`). |
| **Resume Foundation** | **Implemented** | [`resumes.md`](resumes.md) | PDF upload (10MB limit), `pdfplumber` text extraction, skill extraction with regex fallback, labeling, soft archive, single default. |
| **AI Server-Side Routing** | **Implemented** | [`../03-ai/controlled-ai-architecture.md`](../03-ai/controlled-ai-architecture.md) | Centralized server-side model routing, secure environment/platform secret configuration, timeout controls, safe error normalization. |
| **Interview Preparation Brief** | **In progress** | [`../03-ai/interview-preparation-brief.md`](../03-ai/interview-preparation-brief.md) | First controlled AI feature; grounded in JD, resume, and round stage. Pydantic schema validation; draft lifecycle. |
| **Career Memory & Imports** | **Planned** | [`../04-future-modules/career-memory-and-imports.md`](../04-future-modules/career-memory-and-imports.md) | Phase 3 deliverable. Safe parsing sandbox, interactive column mapping, AI suggestions, merge review, provenance, one-click undo. |
| **AI Career Search** | **Planned** | [`../03-ai/future-ai-search.md`](../03-ai/future-ai-search.md) | Phase 3 deliverable. Direct Search (SQL), Ask/Analyze, Plan/Act. Pre-retrieval authorization, clickable citations. Gated on Career Memory. |
| **Career Directions** | **Planned** | [`../01-domain/career-directions.md`](../01-domain/career-directions.md) | Phase 4 dependency. Durable user-owned planning object informing resume version targeting, match evaluation, and job watch. |
| **Resume-Aware Matching** | **Planned** | [`../04-future-modules/resume-aware-matching.md`](../04-future-modules/resume-aware-matching.md) | Phase 4 deliverable. Contextual Match Result ($Job \times Direction \times Resume \times Constraints$). Hard eligibility before soft scoring. |
| **Opportunity Watch** | **Planned** | [`../04-future-modules/opportunity-watch-and-routines.md`](../04-future-modules/opportunity-watch-and-routines.md) | Phase 4 deliverable. Automated ATS crawl, rule-based alerts, in-app alert inbox, quiet hours, dismissal feedback calibration. |
| **Career Routines** | **Planned** | [`../04-future-modules/opportunity-watch-and-routines.md`](../04-future-modules/opportunity-watch-and-routines.md) | Phase 2 deliverable. Daily LeetCode/system design, weekly review, monthly resume audit habits integrated into Today view. |
| **Career Intelligence Community** | **Planned** | [`../04-future-modules/career-intelligence-community.md`](../04-future-modules/career-intelligence-community.md) | Phase 5 deliverable. Task-driven intelligence (Interview Lab, Company Intelligence, Offer Desk, Interview Packs). No generic social feed. |
| **PetCoin & Gamification** | **Planned** | [`../04-future-modules/incentives-petcoin-pets-badges.md`](../04-future-modules/incentives-petcoin-pets-badges.md) | Phase 6 deliverable. Closed-loop virtual credits, Career Pets, non-pay-to-win badges. Zero cash value, no crypto, no P2P transfer. |

---

## 2. Specification Reading Navigation

- For current shipped features and data models, review the specifications in this directory (`02-current-product/`).
- For the strategic vision and 6-phase dependency sequence, consult [`../00-product/roadmap-and-dependencies.md`](../00-product/roadmap-and-dependencies.md).
- For platform architecture and integration standards, consult [`../06-architecture/`](../06-architecture/system-boundaries-and-integration-principles.md).
