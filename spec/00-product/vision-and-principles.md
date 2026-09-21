# CareerNeed Vision and Product Principles

> **Status:** Implemented (Core Vision) / Authoritative Baseline  
> **Owner:** CareerNeed Product  
> **Last Updated:** 2026-09-19  
> **Scope:** Product identity, North Star mission, user promise, product pillars, core loops, and foundational principles.

---

## 1. Product Identity

**CareerNeed** is an AI-powered career operating system that helps people preserve their career history, discover appropriate opportunities, turn intelligence into action, and improve through each job-search cycle.

CareerNeed is fundamentally distinct from:
- A generic job board aggregator (which optimizes for employer eyeballs, not candidate fit).
- A passive resume parser (which merely converts files into text blocks).
- A disconnected spreadsheet or Kanban tracker (which requires grueling manual entry and offers zero actionable insight).
- An ungrounded conversational chatbot (which invents advice without private context or verified facts).

It is a coherent, private workspace connecting candidate capabilities, strategic career goals, resume presentations, market opportunities, real application actions, multi-round interviews, and continuous learning.

---

## 2. North Star Mission and User Promise

### North Star Statement
> **Help users spend less time recording, focus more on deliberate self-improvement, and receive actionable help throughout their career journey.**  
> **帮用户减少记录时间，专注刻意提升，并在整个职业旅程中获得可落地的帮助。**

### Primary User Promise
> **Users put their career information into CareerNeed; the product preserves it safely, organizes it continuously, alerts them when action matters, and helps each interview, application, and reflection improve the next opportunity.**

---

## 3. The Core Product Loop

Career improvement is a closed-loop compounding flywheel, not an isolated set of forms:

```text
       ┌─────────────── Discover ──────────────┐
       │                                       │
       ▼                                       │
     Decide                                    │
       │                                       │
       ▼                                       │
      Act                                      │
       │                                       │
       ▼                                       │
     Record ───────────────────────────────────┤
       │                                       │
       ▼                                       │
    Reflect                                    │
       │                                       │
       ▼                                       │
   Contribute                                  │
       │                                       │
       ▼                                       │
Improve the next opportunity ──────────────────┘
```

1. **Discover**: Identify verified, active canonical opportunities matched against candidate context.
2. **Decide**: Evaluate fit, hard eligibility constraints, and potential gaps with transparent explanations.
3. **Act**: Create an application, tailor an immutable resume version, or schedule follow-up actions.
4. **Record**: Capture multi-round interviews, participants, actual technical/behavioral questions, and practice links.
5. **Reflect**: Conduct post-interview self-debriefs, logging what succeeded, what failed, and key takeaways.
6. **Contribute**: Optionally sanitize and share structured interview intelligence to the community.
7. **Improve the next opportunity**: Convert reflections and community insights into actionable preparation for upcoming rounds.

---

## 4. The Four Product Pillars

CareerNeed is architected around four synergistic pillars:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAREERNEED PRODUCT PILLARS                        │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ 1. Private Career OS          │ 2. AI Career Intelligence                   │
│ Durable, private-by-default   │ Grounded, advisory, evidence-backed insight │
│ career records, timeline,     │ with explicit confirmation write model and  │
│ applications, and artifacts.  │ strict data minimization.                   │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 3. Opportunity Watch &        │ 4. Career Intelligence Community            │
│    Career Routines            │ Task-driven, structured interview lab and   │
│ Proactive, explainable alerts │ knowledge packs with closed-loop PetCoin    │
│ and repeatable career habits. │ incentives (no generic social feeds).       │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### Pillar 1: Private Career OS
- **Private by Default**: All resumes, applications, interview reflections, recruiter contacts, and notes are strictly private to the authenticated owner.
- **Data Portability & Deletion**: Users can view, correct, export, and delete their owned records at any time.
- **Account Cancellation Guarantee**: Account cancellation must never lock users out of exporting their core historical career data.
- **Provenance Preservation**: Changes to career records create versioned history rather than overwriting past truth without a trace.

### Pillar 2: AI Career Intelligence
- **Authorized Private Context**: AI operates exclusively over private context that the user has authorized.
- **Evidence-Backed Insight**: AI distinguishes between verifiable facts, algorithmic inferences, strategic recommendations, and data uncertainties.
- **Explicit-Confirmation Write Model**: AI never automatically alters application state, publishes records, sends emails, or performs bulk writes. Every meaningful write requires explicit user approval.
- **Auditable & Controllable**: All AI generations record provider, model version, prompt version, execution latency, and cost metadata, backed by emergency kill switches.

### Pillar 3: Opportunity Watch & Career Routines
- **Proactive Watch**: Automated monitoring of active ATS boards and job catalogs against structured rules (keywords, seniority, locations, work authorization, match score thresholds).
- **Explainable Alerts**: In-app alerts explain exactly why an opportunity triggered notification.
- **Repeatable Routines**: Structured support for repeatable career habits (daily LeetCode practice, weekly follow-up reviews, monthly resume audits, quarterly direction reviews).
- **Anti-Spam Alert Policy**: High-priority items trigger immediate in-app alerts; secondary items aggregate into periodic digests. Repeated dismissal initiates automated preference calibration.

### Pillar 4: Career Intelligence Community
- **Structured Career Intelligence**: A community centered on task-driven assets (Interview Lab, Company Intelligence, Offer Desk, Interview Packs), not an open conversational feed.
- **Insight-to-Action**: Every community insight connects directly into private action: save to application, add question to practice list, or generate interview prep plan.
- **Anonymized & Moderated**: Contributions require explicit user submission, automated scrubbing, and pre-moderation before public visibility.
- **Closed-Loop Incentives**: PetCoin serves exclusively as an internal recognition credit for verified contributions; it carries zero cash/crypto value, cannot be traded peer-to-peer, and has no influence over job matching.

---

## 5. Ten Final Product Principles

1. **Action over content**: Every feature must lead to a concrete, measurable candidate action. We do not build features for passive browsing.
2. **Private by default**: User career history is sensitive personal property. Publication requires an explicit, deliberate, multi-step opt-in.
3. **Structured before social**: Structured databases, standardized interview rubrics, and clean taxonomies must precede any community interaction.
4. **Evidence before AI confidence**: AI claims must cite specific source objects. We report missing information instead of fabricating confident answers.
5. **Reward quality, not activity**: Community recognition is granted for verified, high-utility contributions, never for posting volume or engagement farming.
6. **Context compounds**: The value of CareerNeed grows as each application, interview question, and reflection informs subsequent preparation.
7. **No notification spam**: Users retain absolute control over channels, schedules, quiet hours, and frequencies. Notifications must be explainable.
8. **User ownership builds trust**: Users own their data, can correct any system inference, export their complete history, and delete their records permanently.
9. **Start narrow and deepen value**: We master the core workflows of US and Canadian technical job seekers and build a globally portable career data foundation before expanding to non-technical disciplines or additional international markets.
10. **Build flywheels, not a disconnected feature list**: New modules must anchor to canonical domain objects (Profile, Direction, Resume, Job, Application, Interview, Follow-up). Disconnected standalone features are strictly forbidden.

---

## 6. Strategic Non-Goals

To maintain unwavering focus, the following capabilities are explicitly non-goals for CareerNeed:
- **No generic social feed**: No Twitter/LinkedIn-style timeline, vanity metrics, or unbounded discussion walls.
- **No open direct messaging**: No unrestricted user-to-user private chat in early community milestones.
- **No automated application submission**: We do not build bots that spam ATS portals with low-quality auto-applications.
- **No cash, cryptocurrency, or speculative tokenomics**: PetCoin has zero monetary value and cannot be withdrawn or traded.
- **No pay-to-win career advantages**: Trust badges, pet levels, or payments cannot alter job match scores or employer visibility.
- **No legal immigration advice**: The system models work authorization constraints based on user inputs, but explicitly disclaims legal counsel.
- **No enterprise recruiting portal**: We are unapologetically candidate-aligned; we do not build an employer-side applicant screening tool.

---

## 7. Long-Term Horizon: NeedOS

CareerNeed is intentionally built as an autonomous, self-sustaining career operating system. While it may eventually serve as the career-stage foundation for a broader lifelong productivity architecture (**NeedOS**), CareerNeed must first achieve independent excellence:
- It must be independently valuable to job seekers.
- It must be commercially viable on its own merits.
- It must earn profound user trust through rigorous privacy and data ownership.

No architectural complexity, premature abstraction, or speculative dependencies may be introduced into CareerNeed under the rationale of future NeedOS platform expansion.
