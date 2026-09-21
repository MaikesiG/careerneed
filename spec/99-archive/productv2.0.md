---
status: archived
superseded_by: ../04-future-modules/resume-aware-matching.md
reason: Archived duplicate of 06-location-eligibility.md.
archived_date: 2026-09-19
---

> **ARCHIVED DOCUMENTATION**  
> This specification has been archived and superseded as part of the 2026-09-19 documentation consolidation.  
> It is preserved for historical decision context and provenance only. For current authoritative architecture, see [../04-future-modules/resume-aware-matching.md](../04-future-modules/resume-aware-matching.md).

# CareerNeed Specification: Location, Work Arrangement & Eligibility Engine (`LOCATION_TAXONOMY_SPEC.md`)

> **Version:** 1.1  
> **Status:** Approved with V2 Domain Architecture Amendments  
> **Target Release:** Phase 2B–2D — Career Directions, Job Catalog, and Matching  
> **Core Principle:** _Location is not merely a free-text filter. It is a structured representation of opportunity geography, work arrangement, candidate preference, and legal eligibility. These concepts must remain separate so the system can make reliable, explainable decisions._

---

## 1. Purpose

CareerNeed must answer several different questions that are often incorrectly collapsed into a single `location` field:

```text
Where is the job physically located?
Where may the job be performed remotely?
What office attendance does the job require?
Where does the candidate want to work?
Where is the candidate legally authorized to work?
Does the job provide or require sponsorship?
```

These are related but not interchangeable.

```text
Career Direction Location Preference
= Where the candidate wants to work

Work Authorization
= Where the candidate can legally work

Job Location / Remote Scope
= Where the employer permits work

Work Arrangement
= Whether the role is remote, hybrid, onsite, or unknown

Eligibility Result
= Whether the candidate can reasonably pursue the job under configured hard constraints
```

---

## 2. Problem Statement

### 2.1 Problems with free-text location

A flat string such as:

```text
New York
```

cannot reliably support:

- Differentiating New York, United States from York, United Kingdom.
- Multiple job locations.
- Remote roles restricted to specific countries, states, or regions.
- Hybrid jobs requiring specific office attendance.
- Cross-border work authorization and sponsorship constraints.
- Explainable filtering and matching.
- Consistent query/index behavior across job sources.

### 2.2 Problems with one location field per Job

A job can have:

```text
New York, NY
San Francisco, CA
Remote — United States
Hybrid — London, UK
Remote within EMEA
```

Therefore, this is insufficient as a long-term model:

```python
normalized_country
normalized_state
normalized_city
remote_country_code
```

Those fields permit only one location and one remote country. They can be retained temporarily for legacy compatibility, but they are not the authoritative V2 model.

---

## 3. Core Separation of Concepts

```text
Candidate Profile / User
└── Work Authorization
    ├── Country or jurisdiction
    ├── Authorization type
    ├── Sponsorship requirement
    └── Expiration where applicable

Career Direction
└── Location and Arrangement Preferences
    ├── Preferred/acceptable/required locations
    ├── Remote/hybrid/onsite preferences
    ├── Commute/attendance preferences
    └── Explicit exclusions

Canonical Job
├── Physical job locations
├── Work arrangement
├── Remote eligibility scope
├── Office attendance requirements
└── Sponsorship policy where known

Match Result
├── Eligibility
├── Eligibility reasons
├── Location fit
├── Work-arrangement fit
└── Score breakdown
```

The system must not infer legal authorization solely from target geography.

Example:

```text
Career Direction:
Target country: US
Preferred city: New York City
Work arrangement: Remote or Hybrid

Candidate authorization:
US
Sponsorship: required

Job:
Remote — US only
Sponsorship: unavailable

Result:
Location preference: compatible
Remote scope: compatible
Legal eligibility: not eligible
Reason: employer does not sponsor required work authorization
```

---

## 4. Geographic Taxonomy

### 4.1 Hierarchy

```text
Global
└── Country
    └── Administrative region
        └── Metropolitan area / city
```

Canonical formats:

```text
Country: ISO 3166-1 alpha-2
Examples: US, CA, GB, DE, CN

Administrative region:
Canonical country-scoped code where available
Examples: US-NY, US-CA, CA-ON, GB-ENG

City:
Canonical display name plus country/region context
Examples: New York, US-NY
          San Francisco, US-CA
          London, GB-ENG
```

A city name is never globally unique. City identity must retain parent country and, where available, region.

### 4.2 Curated Taxonomy

The application may ship a curated taxonomy for initial high-value markets and use it for:

```text
UI selection
Alias resolution
Basic ingestion normalization
Offline local development
Predictable filters
```

It must not claim that a curated dictionary alone is complete world geocoding.

Suggested module:

```text
apps/api/app/taxonomy/locations.py
```

Illustrative structure:

```python
CURATED_LOCATION_TAXONOMY = {
    "US": {
        "name": "United States",
        "aliases": ["USA", "United States of America", "U.S.", "U.S.A."],
        "regions": {
            "US-NY": {
                "name": "New York",
                "aliases": ["NY", "N.Y."],
                "cities": [
                    {"name": "New York", "aliases": ["New York City", "NYC", "Manhattan", "Brooklyn"]},
                    {"name": "Buffalo", "aliases": []},
                    {"name": "Rochester", "aliases": []},
                    {"name": "Albany", "aliases": []},
                ],
            },
            "US-CA": {
                "name": "California",
                "aliases": ["CA", "Calif."],
                "cities": [
                    {"name": "San Francisco", "aliases": ["SF", "Bay Area"]},
                    {"name": "San Jose", "aliases": ["Silicon Valley"]},
                    {"name": "Oakland", "aliases": []},
                    {"name": "Los Angeles", "aliases": ["LA", "L.A."]},
                    {"name": "San Diego", "aliases": []},
                    {"name": "Palo Alto", "aliases": []},
                    {"name": "Mountain View", "aliases": []},
                ],
            },
        },
    },
    "CA": {
        "name": "Canada",
        "aliases": [],
        "regions": {
            "CA-ON": {
                "name": "Ontario",
                "aliases": ["ON"],
                "cities": [
                    {"name": "Toronto", "aliases": []},
                    {"name": "Ottawa", "aliases": []},
                    {"name": "Waterloo", "aliases": []},
                    {"name": "Mississauga", "aliases": []},
                ],
            },
            "CA-BC": {
                "name": "British Columbia",
                "aliases": ["BC"],
                "cities": [
                    {"name": "Vancouver", "aliases": []},
                    {"name": "Victoria", "aliases": []},
                    {"name": "Richmond", "aliases": []},
                ],
            },
        },
    },
    "GB": {
        "name": "United Kingdom",
        "aliases": ["UK", "Great Britain", "Britain"],
        "regions": {
            "GB-ENG": {
                "name": "England",
                "aliases": ["ENG"],
                "cities": [
                    {"name": "London", "aliases": []},
                    {"name": "Manchester", "aliases": []},
                    {"name": "Cambridge", "aliases": []},
                    {"name": "Oxford", "aliases": []},
                    {"name": "Birmingham", "aliases": []},
                ],
            },
        },
    },
}
```

### 4.3 Taxonomy Rules

- Preserve the original raw location text from the source.
- Normalize only when confidence is sufficient.
- Retain normalization confidence and source/version metadata.
- Do not convert ambiguous text to a specific city/country with false certainty.
- Unknown or ambiguous locations remain visible as raw text and may receive `needs_review`.
- Taxonomy may evolve without rewriting historical Application snapshots.

---

## 5. Job Location Model

### 5.1 Long-Term Normalized Model

A canonical Job may have multiple allowed physical locations.

```text
job_locations
├── id
├── job_id
├── country_code
├── region_code                     nullable
├── city                             nullable
├── metro_area                       nullable
├── location_type                    primary | alternate | office | flexible
├── raw_location_fragment            nullable
├── normalization_confidence         nullable
├── normalization_source             rule | provider | ai | manual
├── taxonomy_version                 nullable
├── created_at
└── updated_at
```

### 5.2 Job Work Arrangement Model

```text
jobs
├── ...
├── work_arrangement                 remote | hybrid | onsite | flexible | unknown
├── office_days_per_week_min         nullable
├── office_days_per_week_max         nullable
├── arrangement_raw_text             nullable
└── ...
```

Definitions:

| Value      | Meaning                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| `remote`   | No regular office presence indicated, subject to remote-scope restrictions |
| `hybrid`   | Regular office attendance required or expected                             |
| `onsite`   | Work is expected at an office/location                                     |
| `flexible` | Employer allows multiple arrangements but terms are unclear or variable    |
| `unknown`  | Source data does not reliably describe arrangement                         |

### 5.3 Remote Eligibility Scope

Remote scope must support more than one country and more than one jurisdiction type.

```text
job_remote_scopes
├── id
├── job_id
├── scope_type                       worldwide | country | region | timezone | jurisdiction | unknown
├── country_code                     nullable
├── region_code                      nullable
├── timezone_name                    nullable
├── raw_scope_text                   nullable
├── is_inclusive                     boolean
├── normalization_confidence         nullable
├── normalization_source             rule | provider | ai | manual
├── taxonomy_version                 nullable
├── created_at
└── updated_at
```

Examples:

```text
Remote worldwide:
scope_type = worldwide

Remote — US only:
scope_type = country
country_code = US

Remote — US or Canada:
two country-scope rows:
US
CA

Remote — New York only:
scope_type = region
country_code = US
region_code = US-NY

Remote — EMEA:
scope_type = jurisdiction
raw_scope_text = EMEA
normalization_confidence = nullable/limited
```

### 5.4 Legacy Compatibility Fields

During migration, legacy `Job` fields may be retained temporarily:

```text
raw_location
normalized_country
normalized_state
normalized_city
is_remote_eligible
```

Rules:

- They are compatibility/projection fields only.
- `job_locations` and `job_remote_scopes` become the authoritative structured model.
- Do not add new product logic that assumes only one Job location or one remote country.
- Backfill legacy data incrementally and preserve raw source values.

---

## 6. Candidate Location Preference Model

Career Direction location preference answers:

```text
Where does the candidate want to work for this specific direction?
```

Long-term model:

```text
career_direction_locations
├── id
├── career_direction_id
├── country_code
├── region_code                     nullable
├── city                             nullable
├── preference                       required | preferred | acceptable
├── created_at
└── updated_at
```

Work-arrangement preference:

```text
career_direction_work_arrangements
├── id
├── career_direction_id
├── arrangement                       remote | hybrid | onsite
├── preference                        required | preferred | acceptable
├── max_office_days_per_week          nullable
├── created_at
└── updated_at
```

MVP JSON-compatible shape:

```json
{
  "country_code": "US",
  "region_code": "US-NY",
  "city": "New York",
  "preference": "preferred"
}
```

Rules:

- `required` means a hard location preference for that direction.
- `preferred` means an important score modifier.
- `acceptable` means the role is permitted but receives less preference weight.
- Location preference is not authorization.
- Specific city/region preference should not incorrectly exclude fully remote roles when the direction accepts remote work and remote scope is legally compatible.

---

## 7. Work Authorization Model

Work authorization is user-level data and is not stored inside a Career Direction location record.

```text
work_authorizations
├── id
├── user_id
├── country_code
├── authorization_type               citizen | permanent_resident | visa | other
├── sponsorship_requirement          not_required | may_require | required
├── expires_at                       nullable
├── notes                            nullable
├── created_at
├── updated_at
└── deleted_at                       nullable
```

Rules:

- One user may have authorization in multiple countries.
- Visa expiration is sensitive and optional; do not infer it from location.
- The product must not make legal advice claims.
- Unknown authorization data should produce `needs_review` or `insufficient_data`, not an inaccurate eligible/ineligible decision.
- The user may decide whether a direction should treat sponsorship requirement as a hard constraint or a visible warning, subject to product policy.

---

## 8. Job Sponsorship Policy

Job sponsorship policy is distinct from work arrangement and location.

```text
jobs
├── ...
├── sponsorship_policy               available | unavailable | transfer_only | case_by_case | unknown
├── sponsorship_raw_text             nullable
├── sponsorship_confidence           nullable
└── ...
```

Rules:

- Only show a clear `not_eligible` result when the data confidently identifies an actual conflict.
- If job sponsorship policy is unknown and candidate sponsorship is required, return a transparent warning or `needs_review`, not a definitive rejection.
- The product should preserve source text and evidence where feasible.

---

## 9. Location Normalization Pipeline

### 9.1 Inputs

Job sources may provide:

```text
Structured ATS location fields
Structured remote flags
Raw location text
Job description text
Company careers-page metadata
Manual user-entered location
```

### 9.2 Pipeline

```text
Source payload
    ↓
Preserve raw source fields
    ↓
Provider-specific structured-field parsing
    ↓
Rule-based parsing and alias resolution
    ↓
Entity extraction for country/region/city/remote scope
    ↓
Work-arrangement extraction
    ↓
Sponsorship-policy extraction where supported
    ↓
Confidence scoring and ambiguity detection
    ↓
Normalized job_locations and job_remote_scopes
    ↓
Needs-review state where confidence is insufficient
```

### 9.3 Example

Input:

```text
New York, NY; San Francisco, CA (Hybrid)
```

Output:

```json
{
  "work_arrangement": "hybrid",
  "office_days_per_week_min": null,
  "office_days_per_week_max": null,
  "job_locations": [
    {
      "country_code": "US",
      "region_code": "US-NY",
      "city": "New York",
      "location_type": "primary",
      "normalization_confidence": 0.99
    },
    {
      "country_code": "US",
      "region_code": "US-CA",
      "city": "San Francisco",
      "location_type": "alternate",
      "normalization_confidence": 0.99
    }
  ],
  "remote_scopes": []
}
```

Input:

```text
Remote — United States only
```

Output:

```json
{
  "work_arrangement": "remote",
  "job_locations": [],
  "remote_scopes": [
    {
      "scope_type": "country",
      "country_code": "US",
      "is_inclusive": true,
      "normalization_confidence": 0.99
    }
  ]
}
```

Input:

```text
Remote — EMEA preferred
```

Output:

```json
{
  "work_arrangement": "remote",
  "remote_scopes": [
    {
      "scope_type": "jurisdiction",
      "raw_scope_text": "EMEA",
      "is_inclusive": true,
      "normalization_confidence": 0.65
    }
  ],
  "review_status": "needs_review"
}
```

### 9.4 Normalization Requirements

- Provider structured fields take precedence over inferred text when consistent.
- Preserve multiple locations.
- Preserve multiple remote scopes.
- Preserve raw text for audit/debugging/display.
- Include parser/taxonomy version on normalized output.
- Do not overwrite manually reviewed corrections with a later automated parser run.
- Automated normalization should create a new version/provenance record where material values change.

---

## 10. Eligibility and Preference Engine

### 10.1 Separation of Discovery Filters and Eligibility

The Jobs search interface uses filters to decide what to display.

The matching engine evaluates eligibility to explain whether the candidate can pursue a Job.

```text
Discovery filter:
What the user wants to browse

Eligibility decision:
Whether hard constraints are satisfied

Preference score:
How well an eligible Job fits the direction
```

A user may intentionally browse jobs outside their normal preference. The UI must not hide an eligibility conflict merely because a display filter was widened.

### 10.2 Evaluation Inputs

```text
Candidate work authorizations
Career Direction location preferences
Career Direction work-arrangement preferences
Career Direction exclusions
Job physical locations
Job work arrangement
Job remote scopes
Job sponsorship policy
Matching configuration
```

### 10.3 Structured Result

The engine returns structured results rather than only one free-text failure string.

```python
from dataclasses import dataclass, field
from typing import Literal


Eligibility = Literal[
    "eligible",
    "not_eligible",
    "needs_review",
    "insufficient_data",
]


@dataclass
class EligibilityReason:
    code: str
    severity: Literal["hard", "warning", "info"]
    message: str
    evidence: dict[str, object] = field(default_factory=dict)


@dataclass
class LocationEligibilityResult:
    eligibility: Eligibility
    reasons: list[EligibilityReason]
    location_fit: float | None
    arrangement_fit: float | None
    authorization_fit: float | None
```

Suggested reason codes:

```text
location_required_mismatch
location_unknown
remote_scope_mismatch
remote_scope_unknown
work_arrangement_required_mismatch
office_attendance_exceeds_preference
work_authorization_mismatch
work_authorization_unknown
sponsorship_unavailable
sponsorship_unknown
job_location_ambiguous
```

### 10.4 Arrangement Compatibility

Do not hardcode all compatibility rules as universal truth.

Default compatibility behavior:

| Candidate direction accepts | Job arrangement | Default result                                                           |
| --------------------------- | --------------- | ------------------------------------------------------------------------ |
| Remote only                 | Remote          | Compatible                                                               |
| Remote only                 | Hybrid          | Not eligible when remote-only is required                                |
| Remote only                 | Onsite          | Not eligible                                                             |
| Hybrid                      | Hybrid          | Compatible                                                               |
| Hybrid                      | Remote          | Compatible unless direction explicitly requires office attendance        |
| Hybrid                      | Onsite          | Compatible only if location and attendance preference allow              |
| Onsite                      | Onsite          | Compatible                                                               |
| Onsite                      | Hybrid          | Usually compatible if office location is acceptable                      |
| Onsite                      | Remote          | Needs preference policy; do not assume the candidate rejects remote work |

The `career_direction_work_arrangements` model defines whether each arrangement is `required`, `preferred`, or `acceptable`.

### 10.5 High-Level Evaluation Order

```text
1. Validate available Job location/arrangement data.
2. Evaluate explicit hard exclusions.
3. Evaluate required work arrangement.
4. Evaluate required physical/remote geographic scope.
5. Evaluate work authorization and sponsorship conflict.
6. Determine eligibility.
7. For eligible Jobs, compute soft location and arrangement preference fit.
8. Return structured reasons and score inputs.
```

### 10.6 Pseudocode

```python
def evaluate_location_eligibility(
    *,
    direction_locations,
    direction_arrangements,
    work_authorizations,
    job_locations,
    job_arrangement,
    job_remote_scopes,
    sponsorship_policy,
) -> LocationEligibilityResult:
    reasons = []

    # 1. Arrangement requirement.
    if violates_required_arrangement(
        direction_arrangements=direction_arrangements,
        job_arrangement=job_arrangement,
    ):
        reasons.append(
            EligibilityReason(
                code="work_arrangement_required_mismatch",
                severity="hard",
                message="This role does not meet the direction's required work arrangement.",
            )
        )

    # 2. Geography requirement, including remote scope.
    geographic_result = evaluate_geographic_scope(
        direction_locations=direction_locations,
        job_locations=job_locations,
        job_remote_scopes=job_remote_scopes,
        job_arrangement=job_arrangement,
    )
    reasons.extend(geographic_result.reasons)

    # 3. Legal authorization and sponsorship.
    authorization_result = evaluate_authorization(
        work_authorizations=work_authorizations,
        job_locations=job_locations,
        job_remote_scopes=job_remote_scopes,
        sponsorship_policy=sponsorship_policy,
    )
    reasons.extend(authorization_result.reasons)

    if any(reason.severity == "hard" for reason in reasons):
        return LocationEligibilityResult(
            eligibility="not_eligible",
            reasons=reasons,
            location_fit=None,
            arrangement_fit=None,
            authorization_fit=None,
        )

    if has_material_unknown(reasons):
        return LocationEligibilityResult(
            eligibility="needs_review",
            reasons=reasons,
            location_fit=geographic_result.location_fit,
            arrangement_fit=arrangement_fit(direction_arrangements, job_arrangement),
            authorization_fit=None,
        )

    return LocationEligibilityResult(
        eligibility="eligible",
        reasons=reasons,
        location_fit=geographic_result.location_fit,
        arrangement_fit=arrangement_fit(direction_arrangements, job_arrangement),
        authorization_fit=1.0,
    )
```

### 10.7 Important Decision Rules

- Worldwide remote does not automatically mean legally eligible. Work authorization, payroll jurisdiction, and employer policy may still matter.
- Remote scope compatibility does not automatically mean sponsorship compatibility.
- Missing sponsorship data is not proof of sponsorship availability.
- Unknown structured location data should result in a transparent uncertainty state rather than silent inclusion/exclusion.
- A Job with several locations passes a geographic preference if at least one allowed location is compatible, unless job text explicitly requires a specific location or all locations.
- City preference is normally a soft modifier unless configured as `required`.
- Geographic proximity and commute-radius scoring should be deferred until reliable office coordinates/metro data exist.

---

## 11. Jobs Search Filtering

### 11.1 Hierarchical Filter Semantics

```text
Country = US
matches:
- US-NY, New York
- US-CA, San Francisco
- Remote US-only
- Remote worldwide, if display policy includes it

Region = US-NY
matches:
- New York physical locations
- New York remote scope
- Remote worldwide only when user chooses to include broadly eligible remote listings

City = New York
matches:
- New York physical location
- Not all jobs in US-NY unless city filter is intentionally widened
```

### 11.2 Remote Filtering

Remote filtering must distinguish:

```text
Remote worldwide
Remote in selected country
Remote in selected region
Remote scope unknown
```

The UI must not represent every `remote` Job as location-unrestricted.

### 11.3 Job Search Query Parameters

Suggested contract:

```typescript
interface LocationJobFilters {
  countries?: string[];
  regions?: string[];
  cities?: string[];
  workplace_type?: Array<'remote' | 'hybrid' | 'onsite'>;
  include_worldwide_remote?: boolean;
  include_unknown_location?: boolean;
}
```

The service returns effective filters and whether direction defaults or user overrides produced them.

---

## 12. Frontend Experience

### 12.1 Career Direction Editor

Career Direction location editing includes:

```text
Countries
Regions / states / provinces
Cities / metro areas
Work arrangement preferences
Maximum office days per week, optional
Location requirement level:
required / preferred / acceptable
```

Work authorization appears in a separate Profile or Eligibility section, not inside the Location preference panel.

### 12.2 Jobs Sidebar — Desktop

The Jobs filter sidebar supports:

1. **Countries**
   - Multi-select chips or searchable select.
   - Canonical display names and country codes internally.

2. **Regions**
   - Dynamically constrained to selected countries.

3. **Cities**
   - Optional autocomplete constrained by selected country/region context.

4. **Work arrangement**
   - Multi-select controls:
     ```text
     Remote
     Hybrid
     Onsite
     ```

5. **Remote scope**
   - Optional advanced filter:
     ```text
     Worldwide remote
     Remote in selected countries
     Remote in selected regions
     Unknown remote scope
     ```

### 12.3 Jobs Card Eligibility Display

If a user intentionally views an ineligible or uncertain Job, the Job Card and detail page display structured, human-readable reasons.

Examples:

```text
Not eligible
Employer does not sponsor required work authorization.

Needs review
Remote scope is listed as EMEA; confirm whether your location is eligible.

Location fit: preferred
New York hybrid office is within this direction's preferred region.
```

Do not show legal conclusions beyond known employment constraints. Use language such as:

```text
Based on the listing information and your saved preferences
```

rather than:

```text
You are legally ineligible
```

### 12.4 Mobile Experience

The mobile Filter Drawer includes the same hierarchy and arrangement controls as desktop. It must:

- Keep selected country/region/city chips visible.
- Clearly show active override count.
- Use an Apply action and Reset-to-direction-defaults action.
- Avoid forcing users through three large cascading selectors when only country/remote filtering is necessary.

---

## 13. Accuracy, Quality, and Review Policy

### 13.1 Do Not Use an Undefined Accuracy Claim

The statement:

```text
>95% accuracy against 100 sample ATS strings
```

is not sufficient unless the test corpus, labels, failure definition, and confidence policy are defined.

### 13.2 Minimum Test Corpus

Before claiming an accuracy metric, maintain a labeled test set containing at least:

```text
Single US city/state
Multiple US locations
Canadian province/city
United Kingdom locations
Country-only listings
Remote worldwide
Remote country-specific
Remote region-specific
Hybrid with location
Onsite with location
Ambiguous city names
Malformed provider metadata
Conflicting structured and text source fields
Unknown/unsupported locations
```

### 13.3 Required Metrics

Measure separately:

```text
Country extraction precision and recall
Region extraction precision and recall
City extraction precision and recall
Work-arrangement classification accuracy
Remote-scope classification accuracy
Ambiguity detection rate
False-positive normalization rate
```

### 13.4 Safety Threshold

A better initial acceptance standard is:

```text
High-confidence structured/provider inputs normalize deterministically.
Ambiguous inputs preserve raw text and are marked needs_review.
The system prioritizes avoiding incorrect hard eligibility decisions over maximizing automatic normalization rate.
```

The matching engine must not make a hard `not_eligible` decision from low-confidence geography inference alone.

---

## 14. Privacy and Security

- Work authorization information is sensitive personal data.
- Store only fields necessary for matching and user value.
- Do not log raw work-authorization notes, document details, visa numbers, password data, session tokens, reset tokens, or database credentials.
- Do not make work authorization publicly visible.
- AI/normalization providers receive minimized data and never receive credentials or authentication secrets.
- All Work Authorization, Career Direction, Match Result, and Application data is scoped to the authenticated owner.
- Users must be able to edit and eventually export/delete their sensitive profile data under the platform data-lifecycle policy.

---

## 15. Definition of Done

### Taxonomy and Job Data

1. Canonical country and region codes are defined and documented.
2. Raw source location text is preserved.
3. Job location normalization supports multiple physical locations.
4. Remote eligibility supports worldwide, country, region, jurisdiction, timezone, and unknown scope representations.
5. Job work arrangement is stored separately from physical location and remote scope.
6. Normalization retains confidence, source, and taxonomy/parser version metadata.
7. Ambiguous locations are preserved and marked for review rather than falsely normalized.
8. Legacy single-location fields are treated as compatibility projections only.

### Preference and Eligibility

9. Career Direction location preference is distinct from user Work Authorization.
10. Work authorization includes sponsorship requirement separately from target geography.
11. Eligibility output uses structured status and reason codes:
    ```text
    eligible
    not_eligible
    needs_review
    insufficient_data
    ```
12. Eligibility reasons distinguish location mismatch, remote-scope mismatch, work-arrangement mismatch, work authorization mismatch, sponsorship conflict, and unknown data.
13. Hard eligibility decisions are not made from low-confidence inferred data alone.
14. Work arrangement compatibility is governed by saved preference levels, not a hardcoded universal exception.

### Search and UX

15. Country, region, city, and workplace filters support documented hierarchical semantics.
16. Country filtering correctly includes compatible in-country physical jobs and properly scoped remote jobs.
17. Remote filters distinguish worldwide, restricted, and unknown remote scope.
18. Job Cards and details show understandable, non-legal-advice eligibility explanations.
19. Desktop and mobile filter controls maintain parity without unnecessary complexity.

### Testing

20. A labeled location-normalization corpus exists and covers multiple countries, remote scopes, hybrid/onsite roles, ambiguity, and malformed provider data.
21. Tests measure country, region, city, work-arrangement, and remote-scope extraction separately.
22. Unit tests cover structured eligibility reason codes and hard/soft preference handling.
23. Tests ensure user-owned work authorization and directions cannot be read or modified by another user.
24. Tests confirm low-confidence/unknown data produces review states rather than unsafe hard rejection.

---

## 16. Implementation Order

```text
1. Define canonical codes and curated taxonomy module.
2. Add Career Direction location-preference structures with canonical country/region values.
3. Add separate Work Authorization model and ownership API.
4. Add multi-location Job and remote-scope schema through additive migrations.
5. Preserve legacy fields while backfilling where confidence is high.
6. Implement source-aware location/work-arrangement normalization.
7. Implement structured location eligibility evaluation.
8. Integrate results into Job Match Result, not directly as a global Job field.
9. Add hierarchical Jobs filters and clear remote scope UX.
10. Add test corpus, confidence thresholds, monitoring, and user review tools.
11. Consider commute radius only after reliable location/coordinate data exists.
```

---

## 17. Final Design Contract

```text
Career Direction Location Preference
= Where the user wants to work

Work Authorization
= Where the user may work and whether sponsorship is needed

Canonical Job Location
= Where the job may be performed physically

Job Remote Scope
= Where the employer permits remote work

Work Arrangement
= How the employer expects the work to be performed

Eligibility Result
= Whether configured hard constraints are satisfied

Location Fit
= How strongly an eligible job aligns with the direction’s preferences
```

This separation prevents misleading recommendations, supports explainable matching, preserves uncertainty, and gives CareerNeed a foundation for international job discovery without treating geography or legal eligibility as a fragile text filter.
