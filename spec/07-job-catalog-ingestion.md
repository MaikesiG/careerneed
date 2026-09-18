# Job Catalog, Ingestion, Deduplication, and Lifecycle

> **Version:** 1.0  
> **Status:** Approved  
> **Priority:** P1  
> **Scope:** Companies, canonical jobs, external source listings, normalization, deduplication, and job lifecycle.

## Purpose

CareerNeed may ingest one opportunity from multiple sources.

```text
Company career site
Greenhouse
Lever
Ashby
LinkedIn
Manual user entry
Browser extension
Referral
```

Users should interact with one canonical Job when confidence is sufficient, while the system preserves every source listing and URL.

## Company Model

```text
companies
├── id
├── name
├── normalized_name
├── website
├── linkedin_url
├── industry_id
├── company_size_band
├── headquarters_location_id
├── description
├── created_at
├── updated_at
└── deleted_at
```

## Canonical Job Model

```text
jobs
├── id
├── company_id
├── company_name_raw
├── title
├── normalized_role_id
├── role_confidence
├── role_review_status               accepted | needs_review | unresolved
├── description
├── employment_type
├── seniority_id
├── work_arrangement
├── sponsorship_policy
├── posted_at
├── posted_date
├── discovered_at
├── last_seen_at
├── expires_at
├── status                           discovered | active | expired | closed | removed
├── canonical_fingerprint
├── created_at
└── updated_at
```

## Job Source Model

```text
job_sources
├── id
├── job_id
├── provider                         greenhouse | lever | ashby | company_site | linkedin | manual | other
├── external_id
├── source_url
├── source_payload
├── source_posted_at
├── source_last_seen_at
├── source_status                    active | unavailable | removed
├── created_at
└── updated_at
```

## Lifecycle

```text
discovered
→ active
→ expired | closed | removed
```

Rules:

```text
Closed/expired jobs are excluded from default discovery.
Jobs referenced by Applications are never deleted because a listing disappears.
A canonical Job remains active when at least one trusted source listing remains active.
```

## Deduplication

Priority order:

```text
1. Provider + external ID
2. Canonical application URL
3. Requisition ID
4. Company + normalized title + location + posting window fingerprint
5. Fuzzy candidate match with review threshold
```

Do not auto-merge low-confidence duplicates.

## Role Normalization

```text
job_role_candidates
├── id
├── job_id
├── role_id
├── confidence
├── rank
├── generated_by_version
└── created_at
```

Rules:

```text
High confidence: accept by policy
Medium confidence: show as likely, permit correction
Low confidence: needs review
```

## Ingestion Pipeline

```text
Source capture
→ preserve raw fields
→ provider-specific parser
→ company resolution
→ job location/work arrangement normalization
→ role normalization
→ duplicate candidate detection
→ canonical job assignment
→ lifecycle update
→ match generation trigger
```

## Definition of Done

```text
Canonical Jobs retain multiple Job Sources.
Source identity is idempotent where external IDs exist.
Job lifecycle is visible and preserves historical applications.
Company and role normalization retain provenance/confidence.
Duplicate handling avoids false merge behavior.
Ingestion is idempotent and auditable.
```
