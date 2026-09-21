# Target Users, Personas, and Jobs-to-be-Done (JTBD)

> **Status:** Implemented (Core Personas) / Planned (Segment Deepening)  
> **Owner:** CareerNeed Product  
> **Last Updated:** 2026-09-19  
> **Scope:** Initial Ideal Customer Profile (ICP), technical role specializations, user personas, jobs-to-be-done, and explicit expansion boundaries.

---

## 1. Initial Market Focus (The Focused ICP)

To achieve world-class product depth and compounding intelligence, CareerNeed strictly constrains its initial market focus to:

**United States and Canada (US/CA) Technical Job Seekers**

> **Global Portability & Operational Scope**: CareerNeed is architected for lifelong global data portability—candidate records, skills, and timelines follow the user globally. Today, our operational focus is strictly English-first, centered on the United States and Canada as the initial operating market, with technical job seekers as our wedge. Global portability does not mean worldwide operational support today.

### Primary Role Families
- **Software Engineering**: Full Stack, Frontend, Backend, Systems Engineering.
- **AI & Machine Learning Engineering**: Applied AI, LLM Engineering, MLOps, Computer Vision, NLP.
- **Data & Analytics**: Data Engineering, Analytics Engineering, Data Science, Business Intelligence.
- **Platform & Infrastructure**: Site Reliability Engineering (SRE), DevOps, Cloud Infrastructure.

### Target Candidate Cohorts
1. **New Graduates & Early Career (0–3 Years Experience)**: Navigating high market noise, entry-level hiring contraction, and rigorous technical interview filtering.
2. **Career Switchers**: Translating adjacent quantitative or domain backgrounds into technical software and data roles.
3. **International & Work-Authorization-Sensitive Candidates**: Job seekers requiring H-1B, F-1 OPT/CPT, TN, or Canadian work permits, for whom work authorization eligibility is a non-negotiable hard constraint.
4. **Active Job Seekers in High-Density Tech Hubs**: Primary concentration in New York City, the San Francisco Bay Area, Seattle, Toronto, Vancouver, and North American Remote markets.

---

## 2. Explicit Expansion Boundaries (Non-Technical Roles Deferred)

While early prototype specs loosely referenced general corporate roles (e.g., Sales, HR, Accounting, Corporate Finance), these domains are **explicitly deferred**:

```text
┌──────────────────────────────────────┬──────────────────────────────────────┐
│       ACTIVE CORE TECHNICAL ICP      │         DEFERRED TO LATER EXPANSIONS │
│       (Current Focus: 2026–2027)     │         (Not in Near-Term Scope)     │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • Software Engineering (Full/Back/Front)│ • B2B Sales & GTM (SDR/AE/AM)        │
│ • AI / Machine Learning Engineering  │ • Human Resources & Talent Acquisition│
│ • Data Engineering & Analytics       │ • Corporate Accounting & Tax         │
│ • Platform, DevOps & SRE             │ • Creative Design & Copywriting      │
│ • Technical Product Management       │ • General Operations & Logistics     │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

**Rationale**: Technical hiring requires specialized workflows that generic job boards cannot handle: LeetCode/algorithm tracking, system design rubrics, behavioral STAR outlines, multi-round technical screening, and work-authorization filtering. Attempting to serve all job categories immediately dilutes matching accuracy and UX coherence.

---

## 3. User Personas

### Persona 1: Alex — The Ambitious New Grad / Early Career SWE
- **Profile**: B.S. in Computer Science or Bootcamp graduate, 0–2 years experience. Based in NYC.
- **Context**: Applying to 15–25 engineering roles per week. Overwhelmed by duplicate job postings on generic boards. Stressed by multi-stage technical screens (OA, phone screen, pair-programming, system design).
- **Core Needs**:
  - Automatically filter out listings requiring 5+ YOE or invalid locations.
  - Track which resume version was submitted to each company.
  - Record coding questions asked during screens and attach LeetCode links for deliberate practice.
  - A single prioritized dashboard showing what follow-up or interview task is due today.

### Persona 2: Maya — The Work-Authorization-Sensitive Senior Data Engineer
- **Profile**: M.S. in Data Science, 4 years experience in data pipelines. Currently on F-1 STEM OPT / H-1B.
- **Context**: Highly skilled in distributed systems, SQL, and Python. Wastes hours researching company career pages only to discover late in the process that the employer does not sponsor visas.
- **Core Needs**:
  - Deterministic filtering of job sponsorship policies (distinguishing "visa sponsorship available" vs "no sponsorship").
  - Maintain two distinct Career Directions: *Data Engineering* and *Analytics Engineering*, each tied to a specialized resume version.
  - Secure, private storage of work authorization parameters without public exposure.
  - Structured post-interview debriefs to systematically refine behavioral stories and technical trade-offs.

### Persona 3: David — The Deliberate Career Switcher
- **Profile**: Former mechanical engineer transitioning to Full Stack & Backend Engineering. Based in Bay Area.
- **Context**: Managing multiple projects, online courses, and a rigorous networking schedule. Needs to turn scattered interview feedback into a structured improvement plan.
- **Core Needs**:
  - An integrated career rhythm (daily LeetCode routine, weekly application review, weekly networking follow-ups).
  - An evidence-backed Interview Preparation Brief generated directly from the target job description and his specific project evidence.
  - Ability to convert past interview mistakes into actionable study items in his daily Todo.

---

## 4. Jobs-to-be-Done (JTBD) Framework

### JTBD 1: Opportunity Discovery & Hard Eligibility
> **When** I am actively searching for relevant technical opportunities,  
> **I want to** filter the catalog through my specific Career Direction, target seniority, and work authorization constraints,  
> **So that** I spend zero time reviewing opportunities that cannot legally hire me or do not match my current technical goals.

### JTBD 2: Contextual Application & Resume Tracking
> **When** I submit an application to a company,  
> **I want to** preserve an immutable snapshot of the job description, the exact resume version used, and the matching context at that moment,  
> **So that** when an interviewer contacts me weeks later, I know precisely what I submitted and how I framed my experience.

### JTBD 3: Structured Multi-Round Interview Management
> **When** I progress through multi-stage technical and behavioral interviews,  
> **I want to** organize rounds, participant contacts, preparation notes, actual questions asked, and reflections in one workspace,  
> **So that** I stay fully prepared for each interview and capture valuable practice questions before I forget them.

### JTBD 4: Actionable Daily Execution (No Dropped Balls)
> **When** I open the product each morning,  
> **I want** an aggregated, zero-clutter action list showing overdue follow-ups, interviews today, and upcoming preparation deadlines,  
> **So that** I know exactly what actions to take today without searching through spreadsheets or email threads.

### JTBD 5: Post-Interview Learning & Preparation Flywheel
> **When** I finish an interview round,  
> **I want to** conduct a structured debrief of what went well and what went poorly,  
> **So that** the system can highlight my recurring technical gaps and tailor preparation for my next opportunity.

---

## 5. Strategic Personas Deferred

The following user personas are recognized as long-term possibilities but are **out of scope** for Phases 0 through 4:
- **Recruiters & Hiring Managers**: CareerNeed does not build employer ATS portals or candidate search directories.
- **Career Coaches & Academic Counselors**: Dedicated multi-tenant delegation interfaces and coach dashboards are deferred until consumer product-market fit is proven.
- **Corporate HR Teams**: Enterprise compliance, team billing, and internal talent mobility are deferred.
