# Phase 8: Automation, Reminders & External Integrations

> Status: Future Planned  
> Target: Provide ambient, non-intrusive automation, calendar integrations, and system observability.  
> Repository: `careerneed`

---

## 1. Objective & Product Value

Once the core workflow and AI intelligence are stable, Phase 8 connects CareerNeed to the candidate's daily communication and scheduling tools:
- Automated calendar sync for scheduled interviews.
- Email follow-up and preparation alerts.
- 1-click browser extension for saving jobs while browsing.
- Production-grade observability for AI cost, latency, and reliability.

---

## 2. Technical Architecture & Integrations

### 2.1 Calendar Integration
- Two-way sync with Google Calendar and Microsoft Outlook.
- Automatically pushes confirmed `interviews` to candidate's personal calendar with meeting URLs and prep notes.

### 2.2 Browser Extension
- Chrome / Firefox extension allowing 1-click job ingestion from LinkedIn, Indeed, and company career portals.
- Leverages `POST /jobs/manual` with automatic page metadata extraction.

### 2.3 LLM Observability & Cost Tracking
- Deep tracking in `usage_logs`:
  - Provider, model name, prompt tokens, completion tokens, estimated cost.
  - Latency (ms) and status (success, fallback, failure).
  - Extraction confidence scores.

---

## 3. Granular Commit Plan

1. `feat: add google calendar oauth and interview event synchronization`
2. `feat: add email notification service for due follow-ups and interview alerts`
3. `feat: implement browser extension api endpoint for web clipping`
4. `feat: add llm observability metrics dashboard (latency, token costs, fallback rates)`
5. `test: add tests for calendar synchronization and notification dispatch`
