# ADR-0001: Product Scope, Initial Technical ICP, and 6-Phase Strategic Roadmap

> **Status:** Accepted  
> **Date:** 2026-09-19  
> **Scope:** Architecture Decision Record establishing product scope, technical ICP, 4 pillars, and 6-phase roadmap.  
> **Deciders:** CareerNeed Product & Engineering Architecture  
> **Consulted:** Authoritative Baseline (CareerNeed Future Vision Specification)

---

## 1. Context

Early CareerNeed specifications contained divergent product scopes, conflicting delivery roadmaps, and unconstrained market definitions. Specifically:
- Some early specifications attempted to model all corporate professions (sales, human resources, accounting, corporate finance) simultaneously, resulting in diluted taxonomy and UI complexity.
- Early roadmaps used fragmented, inconsistent numbering schemes (e.g. Phase 1, 2A–2E vs 5-phase delivery), with unclear dependency boundaries.
- Several documents prematurely promised autonomous application submission bots, open social feeds, and vector-database RAG systems before core data models and import foundations were established.

To achieve world-class product quality and compounding intelligence, CareerNeed required an authoritative, non-negotiable strategic baseline.

---

## 2. Decision

We formally decide and establish the following architectural and product policies:

### 2.1 Initial Market Focus: United States and Canada (US/CA) with Global Portability
CareerNeed will constrain its initial operating market to United States and Canadian technical job seekers across Software Engineering, AI/ML Engineering, Data & Analytics, and Platform/SRE, operating English-first. User-owned career records are architected for lifelong global portability, but global portability does not imply worldwide operational support today. Non-technical disciplines and broader international markets are deferred.

### 2.2 Adopt the Four Product Pillars and Core Loop
The product is structured around four mutually reinforcing pillars:
1. **Private Career OS**
2. **AI Career Intelligence**
3. **Opportunity Watch & Career Routines**
4. **Career Intelligence Community**

The core product loop is: **Discover → Decide → Act → Record → Reflect → Contribute → Improve the next opportunity**.

### 2.3 Enforce the Canonical Domain Object Hierarchy
All future features must attach to the canonical domain chain:
$$\text{Profile} \to \text{Direction} \to \text{Resume Version} \to \text{Job} \to \text{Match Result} \to \text{Application} \to \text{Interview} \to \text{Question / Follow-up / Todo}$$
No parallel or disconnected job, application, or interview subsystems may be created.

### 2.4 Authoritative Phased Roadmap (Phases 0 through 6)
We formally establish the single authoritative delivery roadmap:
- **Phase 0 — Stabilize Execution System**: Reliable manual CRUD (Jobs, Applications, Interviews, Questions, Follow-ups, Todos).
- **Phase 1 — Controlled AI**: Application-grounded Interview Preparation Brief, post-interview debrief, server-side routing, and audit telemetry.
- **Phase 2 — Daily Career Rhythm**: Action Center / Todo aggregation, Career Routines, in-app/email reminders, and Direct Search.
- **Phase 3 — Career Memory and AI Search**: CSV/Markdown/TXT import pipeline, mapping, provenance, and grounded AI Career Search.
- **Phase 4 — Proactive Opportunity Discovery**: Career Directions, Resume Versions, resume-aware matching, and Job Watch alerts.
- **Phase 5 — Career Intelligence Community**: Anonymized contribution flow, pre-moderation, Interview Lab, and insight-to-action packs.
- **Phase 6 — Incentives and Ecosystem Expansion**: PetCoin closed-loop community credit, Career Pets, non-pay-to-win badges, and B2B pilots.

### 2.5 Strict Strategic Non-Goals
The following capabilities are officially classified as non-goals for early releases:
- No generic social feeds or vanity engagement loops.
- No open peer-to-peer direct messaging.
- No automated job application submission bots.
- No cryptocurrency, cash redemption, or P2P transfer of PetCoin.
- No company employee verification badges.
- No vector database or RAG deployment prior to Phase 3 Career Memory.

---

## 3. Consequences

### Positive
- **Uncompromised Product Depth**: Concentrating on technical roles allows us to build deep, differentiated workflows (LeetCode tracking, system design rubrics, work-authorization filtering) that generic job boards cannot match.
- **Strict Dependency Discipline**: Phased milestones prevent building AI recommendations or community feeds before underlying private data models are solid.
- **High Trust & Safety**: The explicit confirmation write model and pre-retrieval authorization protect candidate privacy and eliminate hallucinated writes.

### Trade-offs & Risks
- **Exclusion of Non-Technical Users**: Candidates seeking sales, marketing, or general business roles will find CareerNeed ill-suited until future expansion phases.
- **No Instant Automation**: Candidates wanting fully automated application submission will find CareerNeed intentionally uncooperative; the product requires deliberate human reflection.
