# Market Scope, Geographic Hierarchy, and Global Portability

> **Status:** Authoritative Product Standard  
> **Owner:** CareerNeed Product  
> **Last Updated:** 2026-09-19  
> **Scope:** Long-term global portability, English-first product language, United States and Canada (US/CA) operational market, technical job seeker wedge, geographic hierarchy, timezones, currency metadata, work eligibility boundaries, and expansion gates.

---

## 1. Long-Term Direction: Globally Portable Career Operating System

CareerNeed is fundamentally conceived as a **globally portable, user-owned career operating system**:
- **Globally Portable Career Records**: The long-term direction of CareerNeed is to ensure candidate career records, historical resumes, application timelines, interview reflections, and professional skills belong permanently to the candidate, remaining globally portable across employers, borders, and career transitions.
- **Portability Invariant**: Global portability guarantees that user data models, career export formats, and personal career timelines remain universally applicable worldwide.
- **Boundary Clarification (No Worldwide-Support Claim)**: Global data portability is an architectural data-ownership model; it is **not a current worldwide-support claim**. It does **not** mean worldwide operational support, international legal compliance, or global job catalog coverage today.

---

## 2. Current Initial Scope: English-First, United States and Canada (US/CA)

To achieve profound workflow depth and high match quality, the current operational boundaries are strictly focused:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CURRENT OPERATIONAL MARKET BOUNDARIES                 │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ Product Language    │ English-first. All system interfaces, data schemas,   │
│                     │ error messages, and AI interaction prompts operate    │
│                     │ primarily in English. Multilingual UI is deferred.    │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ Operating Market    │ United States and Canada (US/CA). Ingestion sources,  │
│                     │ ATS feeds, location structures, and compensation      │
│                     │ conventions are calibrated for North American hiring. │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ Initial Wedge       │ Technical Job Seekers: Software Engineering, AI/ML    │
│                     │ Engineering, Data & Analytics, and Platform/DevOps/SRE│
│                     │ across early-career, career switchers, and senior ICs.│
└─────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 3. Geographic Hierarchy and Workplace Scope

Locations are normalized using a four-tier geographic hierarchy:

$$\text{Country} \longrightarrow \text{Region / State / Province} \longrightarrow \text{City / Metropolitan Area} \longrightarrow \text{Workplace Arrangement}$$

### 3.1 Geographic Normalization
- **Country**: ISO 3166-1 alpha-2 code (`US`, `CA`).
- **Region / State / Province**: Standard postal abbreviations (e.g. `NY`, `CA`, `WA`, `ON`, `BC`).
- **City / Metro Area**: Standardized urban center (e.g. `New York, NY`, `San Francisco, CA`, `Toronto, ON`, `Vancouver, BC`).

### 3.2 Workplace Arrangement Scope
Job opportunities and candidate preferences classify workplace arrangements into three categories:
1. **Remote**:
   - `remote_us`: Work from anywhere within the United States.
   - `remote_ca`: Work from anywhere within Canada.
   - `remote_north_america`: Work from anywhere within the US or Canada.
   - `remote_worldwide`: Rare roles permitting global remote work.
2. **Hybrid**: Requires regular on-site presence (e.g. 2–3 days/week) within a specific metropolitan commute radius.
3. **On-Site**: Requires 100% physical presence at a designated facility or office.

---

## 4. Timezones, Currency, and Compensation Metadata

### 4.1 Timezones
- **Storage Standard**: All concrete event and action timestamps (`created_at`, `applied_at`, `scheduled_at`, `due_at_utc`) are stored strictly in UTC.
- **Display & Evaluation**: Candidate profiles, interviews, and reminders store an IANA timezone string (e.g. `America/New_York`, `America/Los_Angeles`, `America/Toronto`). All daily focus calculations, quiet hours, and calendar presentations are dynamically evaluated against this IANA string.

### 4.2 Currency and Compensation Periods
Compensation metadata enforces explicit currency and period attributes:
- **Currency Code**: Standard ISO 4217 code (primarily `USD` and `CAD`).
- **Compensation Period**: `annual` (default for salaried technical roles), `hourly` (for contract/consulting roles), or `monthly`.
- **Band Structure**: Min amount, max amount, currency, period, and optional equity description.

---

## 5. Work Eligibility and Legal Disclaimer Boundary

Work authorization attributes in CareerNeed operate strictly as **user preference filters** and **job requirement comparisons**:
- Candidates specify their work authorization status (e.g. Citizen, Permanent Resident, F-1 OPT/CPT, H-1B, TN visa, requiring visa sponsorship).
- Job listings are parsed for employer sponsorship policies (e.g. "Visa sponsorship available", "No sponsorship provided").
- **Strict Legal Disclaimer**: CareerNeed does **not** provide legal, immigration, tax, employment-law, or work-authorization determinations. The matching engine compares stated candidate preferences against stated employer requirements to save job-search time, but does not verify legal right to work, certify immigration status, or make legal work-authorization determinations.

---

## 6. International Expansion Gates

CareerNeed will not expand its active operating market to additional countries or languages until each of the following five objective gates is satisfied:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MARKET EXPANSION GATES                               │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ 1. Candidate Demand │ Verified volume of active candidates actively seeking │
│                     │ roles in the target jurisdiction.                     │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 2. Job Catalog      │ Direct, reliable, continuous ATS ingestion pipelines  │
│    Data Quality     │ delivering high-signal, active local job listings.    │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 3. AI Evaluation    │ Evaluation test datasets measuring AI prompt accuracy,│
│    Calibration      │ regional role taxonomy fit, and cultural tone in the  │
│                     │ target market.                                        │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 4. Privacy & Legal  │ Full compliance with local privacy frameworks         │
│    Governance       │ (e.g. GDPR, local statutory employment disclosures).  │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 5. Operational &    │ Proven localized notification delivery, timezone     │
│    Notification     │ handling, and moderation support capacity.            │
└─────────────────────┴───────────────────────────────────────────────────────┘
```
