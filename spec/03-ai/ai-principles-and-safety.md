# AI Principles, Safety, and User Confirmation Model

> **Status:** Authoritative Architecture Standard  
> **Owner:** CareerNeed AI & Security Architecture  
> **Last Updated:** 2026-09-19  
> **Scope:** AI safety boundaries, data minimization, evidence grounding, prompt injection defenses, and the non-negotiable human confirmation write model.

---

## 1. Core Principles of Controlled AI

CareerNeed applies artificial intelligence strictly to accelerate human reflection and career execution. The platform is built upon four foundational AI principles:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CORE AI SAFETY PRINCIPLES                           │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ 1. Evidence Before Confidence │ 2. Private Context Authorization            │
│ Ground every factual claim in │ AI operates only over user-authorized       │
│ verified private objects.     │ private records; never across tenant bounds.│
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 3. Explicit Confirmation Write│ 4. Transparent Epistemology                 │
│ AI is advisory. AI possesses  │ Distinguish facts, inferences,              │
│ zero autonomous write power.  │ recommendations, and uncertainties clearly. │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 2. The Explicit-Confirmation Write Contract

Under no circumstances may an AI model or autonomous agent execute write operations or state changes without explicit user approval.

### Prohibited Autonomous Actions
- **State Machine Transitions**: AI cannot change an application from `applied` to `interviewing`, or `interviewing` to `rejected`.
- **Note Overwrites**: AI cannot overwrite, replace, or prune user-authored notes, interview debriefs, or reflections.
- **External Communications**: AI cannot send emails, submit forms, or contact recruiters.
- **Task Creation**: AI cannot insert tasks, todos, or reminders into the candidate's action center without review.
- **Publication**: AI cannot publish content to the community.

### Required Interaction Flow
```text
User Triggers AI Action ──► Server Validates Context ──► Model Generates Draft
                                                               │
                                                               ▼
User Executes Write ◄── User Confirms / Edits ◄── Draft Displayed with Sources
```

---

## 3. Epistemological Distinction of Outputs

Every user-facing AI response must explicitly delineate its statements into four clear categories:

| Category | Definition | UI Presentation | Example |
|---|---|---|---|
| **Evidence** | Directly extracted facts from authorized documents. | Grounded text with clickable source tag `[Source]`. | *"The job listing lists Go, Kubernetes, and gRPC as required technologies."* |
| **Inference** | Logical deductions derived by the model based on evidence. | Clearly marked as analytical inference. | *"Because this role sits within Core Infrastructure, system scalability questions are highly probable."* |
| **Recommendation** | Suggested preparatory actions or study topics. | Actionable items with checkboxes. | *"Review distributed consensus protocols (Raft) prior to Round 2."* |
| **Uncertainty** | Acknowledgment of missing, ambiguous, or unverifiable data. | Explicit informational warning. | *"The listing does not specify compensation bands; verify this during the recruiter screen."* |

**Negative Hallucination Rule**: If private context does not contain sufficient data to answer a question, the model must report `insufficient_data` or state that evidence is missing. It is strictly forbidden to guess or fabricate facts.

---

## 4. Data Minimization Protocol

When calling external model APIs, the system enforces strict payload minimization:

```text
Full Candidate Profile ──► Payload Sanitizer ──► Bounded Minimal Excerpt ──► Model API
```

1. **Feature-Specific Context Only**:
   - For skill extraction: only relevant resume text sections.
   - For interview prep: only target job description, submitted resume version, and round stage.
   - For match explanations: only structured match factors and bounded evidence snippets.
2. **Strictly Prohibited from Model Payloads**:
   - Passwords and password hashes.
   - Session tokens, reset tokens, and cookie values.
   - API keys, database connection strings, and infrastructure secrets.
   - Government ID numbers, full home addresses, and unassociated contact records.
   - Unrelated private notes from other job applications.

---

## 5. Prompt Injection Defense

Because CareerNeed ingests external, untrusted text (job descriptions from public ATS boards, user-pasted recruiter invitations, and uploaded resumes), it must guard against indirect prompt injection:

1. **Strict Context Isolation**:
   - Untrusted inputs (job descriptions, emails) are quarantined in dedicated schema-delimited blocks (e.g. `<untrusted_job_description>`).
   - System prompts explicitly instruct models to treat content within these blocks strictly as passive data, never as operational instructions.
2. **Schema-Constrained Outputs**:
   - Free-form model generation is rejected in favor of strict JSON schema validation.
   - If an injection attempt tries to redirect the model to output arbitrary text, Pydantic schema validation fails and the response is safely dropped.
3. **No Dynamic Execution**:
   - AI outputs are never evaluated as code, scripts, SQL, or HTML.
   - All rendered text is escaped and sanitized in the frontend.
