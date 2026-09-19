# CareerNeed Specification Archive (Historical & Superseded)

> **Archive Date:** 2026-09-19  
> **Status:** Read-Only Historical Archive  
> **Authority:** None. These documents are preserved exclusively for decision provenance, architectural lineage, and historical reference. Active specifications reside in `spec/00-product/` through `spec/07-decisions/`.

---

## 1. Purpose of the Archive

During the 2026-09-19 documentation-only product specification consolidation, historical specifications, early prototype PRDs, and previous roadmaps were reorganized. 

To ensure Git history and institutional memory remain intact while eliminating active contradictions with the **Authoritative Baseline (CareerNeed Future Vision Specification)**, superseded documents were moved to this directory and prepended with unambiguous archival banners. Useful engineering rules, API conventions, and frontend standards were extracted into active specifications in `spec/06-architecture/` and `spec/01-domain/` prior to archival.

---

## 2. Archived Document Catalog

| Archived File | Original Topic | Primary Reason for Archival | Active Superseding Specification |
|---|---|---|---|
| [`00-global-product.md`](00-global-product.md) | Global Product Overview | Outdated 5-phase delivery model and unconstrained scope. | [`00-product/vision-and-principles.md`](../00-product/vision-and-principles.md), [`00-product/roadmap-and-dependencies.md`](../00-product/roadmap-and-dependencies.md) |
| [`01-domain-architecture.md`](01-domain-architecture.md) | V2 Domain Architecture | Early domain entity draft; superseded by complete domain model. | [`01-domain/domain-model-and-ownership.md`](../01-domain/domain-model-and-ownership.md) |
| [`02-data-security-and-evolution.md`](02-data-security-and-evolution.md) | Data Security & Evolution | Mixed platform security, privacy, and architectural principles. | [`05-trust-privacy/privacy-ownership-and-export.md`](../05-trust-privacy/privacy-ownership-and-export.md), [`06-architecture/api-and-data-conventions.md`](../06-architecture/api-and-data-conventions.md) |
| [`04-career-directions.md`](04-career-directions.md) | Career Directions Spec (V1.1) | Name had duplicate extension (`.md.md`); broad non-technical roles (sales, HR) are now deferred. | [`01-domain/career-directions.md`](../01-domain/career-directions.md) |
| [`05-resume-versioning.md`](05-resume-versioning.md) | Resume Versioning Spec | High-level summary superseded by current product and lifecycle specs. | [`02-current-product/resumes.md`](../02-current-product/resumes.md), [`01-domain/lifecycle-and-state-transitions.md`](../01-domain/lifecycle-and-state-transitions.md) |
| [`06-location-eligibility.md`](06-location-eligibility.md) | Location & Eligibility Engine | Name had duplicate extension (`.md.md`); merged into unified matching and scope specifications. | [`04-future-modules/resume-aware-matching.md`](../04-future-modules/resume-aware-matching.md), [`00-product/market-scope-and-global-portability.md`](../00-product/market-scope-and-global-portability.md) |
| [`07-job-catalog-ingestion.md`](07-job-catalog-ingestion.md) | Job Ingestion & Deduplication | Consolidated into current jobs and catalog architecture. | [`02-current-product/jobs-and-job-sources.md`](../02-current-product/jobs-and-job-sources.md) |
| [`08-jobs-workspace-v2.md`](08-jobs-workspace-v2.md) | Jobs Workspace V2 UX Spec | Name had duplicate extension (`.md.md`); consolidated into current jobs workspace. | [`02-current-product/jobs-and-job-sources.md`](../02-current-product/jobs-and-job-sources.md) |
| [`09-matching-ai-governance.md`](09-matching-ai-governance.md) | Matching & AI Governance | Split between AI safety governance and matching engine specs. | [`03-ai/ai-principles-and-safety.md`](../03-ai/ai-principles-and-safety.md), [`04-future-modules/resume-aware-matching.md`](../04-future-modules/resume-aware-matching.md) |
| [`10-applications-workflow.md`](10-applications-workflow.md) | Applications Workflow | Consolidated into current application workflow and domain lifecycle specs. | [`02-current-product/applications.md`](../02-current-product/applications.md), [`01-domain/lifecycle-and-state-transitions.md`](../01-domain/lifecycle-and-state-transitions.md) |
| [`11-interviews-followups-today.md`](11-interviews-followups-today.md) | Interviews, Follow-ups, Today | Split into dedicated current product workflow specifications. | [`02-current-product/interviews-and-preparation.md`](../02-current-product/interviews-and-preparation.md), [`02-current-product/contacts-follow-ups-and-todos.md`](../02-current-product/contacts-follow-ups-and-todos.md) |
| [`12-api-conventions.md`](12-api-conventions.md) | API Conventions | Standardized into central architecture and API integration standards. | [`06-architecture/api-and-data-conventions.md`](../06-architecture/api-and-data-conventions.md) |
| [`13-file-storage-and-resume-ingestion.md`](13-file-storage-and-resume-ingestion.md) | File Storage & Resume Ingestion | Expanded into full Career Memory import pipeline and upload security. | [`04-future-modules/career-memory-and-imports.md`](../04-future-modules/career-memory-and-imports.md), [`06-architecture/api-and-data-conventions.md`](../06-architecture/api-and-data-conventions.md) |
| [`14-background-jobs-and-integration-reliability.md`](14-background-jobs-and-integration-reliability.md) | Background Jobs & Worker Reliability | Premature queue complexity marked conditional/deferred; active reliability rules migrated. | [`06-architecture/background-work-and-integration-reliability.md`](../06-architecture/background-work-and-integration-reliability.md) |
| [`15-observability-and-operations.md`](15-observability-and-operations.md) | Observability & Operations | Updated with cost controls and audit trails. | [`06-architecture/observability-audit-and-cost-controls.md`](../06-architecture/observability-audit-and-cost-controls.md) |
| [`16-notifications-and-delivery.md`](16-notifications-and-delivery.md) | Notifications & Delivery | Multi-channel push/SMS deferred; aligned with in-app-first alert policy. | [`06-architecture/notifications-and-alert-policy.md`](../06-architecture/notifications-and-alert-policy.md) |
| [`17-ai-cost-quality-and-evaluation.md`](17-ai-cost-quality-and-evaluation.md) | AI Cost, Quality & Evaluation | Consolidated into controlled AI architecture and cost observability. | [`03-ai/controlled-ai-architecture.md`](../03-ai/controlled-ai-architecture.md), [`06-architecture/observability-audit-and-cost-controls.md`](../06-architecture/observability-audit-and-cost-controls.md) |
| [`18-product-roadmap.md`](18-product-roadmap.md) | Product Roadmap (V2.0) | Replaced by the authoritative 6-phase strategic roadmap. | [`00-product/roadmap-and-dependencies.md`](../00-product/roadmap-and-dependencies.md) |
| [`19-frontend-architecture-and-quality.md`](19-frontend-architecture-and-quality.md) | Frontend Architecture & Quality | Active Next.js, state ownership, and accessibility standards extracted to active docs. | [`06-architecture/frontend-architecture-and-quality.md`](../06-architecture/frontend-architecture-and-quality.md) |
| [`CURRENT_STATUS.md`](CURRENT_STATUS.md) | Implementation Status (2026-09-17) | Historical status snapshot. Active status is maintained in `02-current-product/README.md`. | [`02-current-product/README.md`](../02-current-product/README.md) |
| [`conventions.md`](conventions.md) | Engineering Conventions | Engineering conventions extracted into active architecture standards. | [`06-architecture/api-and-data-conventions.md`](../06-architecture/api-and-data-conventions.md), [`06-architecture/frontend-architecture-and-quality.md`](../06-architecture/frontend-architecture-and-quality.md) |
| [`product-requirements.md`](product-requirements.md) | Product Requirements (V1.0) | Replaced by updated vision, target users, and jobs-to-be-done specifications. | [`00-product/target-users-and-jtbd.md`](../00-product/target-users-and-jtbd.md), [`00-product/vision-and-principles.md`](../00-product/vision-and-principles.md) |
| [`productv2.0.md`](productv2.0.md) | Duplicate Location Spec | Byte-for-byte duplicate of `06-location-eligibility.md.md`. | [`04-future-modules/resume-aware-matching.md`](../04-future-modules/resume-aware-matching.md) |
| [`resume-matching.md`](resume-matching.md) | Matching Engine Spec (V3.0) | Contextual matching math and explainability consolidated into future module. | [`04-future-modules/resume-aware-matching.md`](../04-future-modules/resume-aware-matching.md) |
| [`spec-readme.md`](spec-readme.md) | Old Spec README Index | Replaced by the consolidated `spec/README.md`. | [`README.md`](../README.md) |

---

## 3. Explicit Record of Deleted File

- **File**: `spec/03-candidate-profile.md`
- **Deletion Date**: `2026-09-19`
- **Deletion Reason**: The file was an empty 0-byte placeholder originally committed without text, history, or metadata. It contained zero requirements, architecture, or design context. To eliminate empty stub files from the repository, it was deleted rather than archived. Candidate Profile specifications are authoritatively defined in [`01-domain/domain-model-and-ownership.md`](../01-domain/domain-model-and-ownership.md).
