# Current Product: Interviews, Questions, and Preparation

> **Status:** Implemented (CRUD, Questions, LeetCode, Participants) / In Progress (Preparation Brief Integration)  
> **Owner:** CareerNeed Product & Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Multi-round interview scheduling, participants, interview questions, reflections, LeetCode links, preparation notes, and outcome debriefs.

---

## 1. Module Overview and Current Status

The Interviews module converts static job applications into structured interview journeys, capturing questions, reflections, and preparation notes as compounding career intelligence.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAPABILITY STATUS BREAKDOWN                       │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Shipped & Verified in Code           │ • Multi-round Interview CRUD per app │
│                                      │ • Stages, statuses, and outcomes     │
│                                      │ • UTC timestamps + IANA timezone     │
│                                      │ • Interview participants (Contacts)  │
│                                      │ • Separately stored Questions table  │
│                                      │ • Answer notes and reflections       │
│                                      │ • Validated HTTPS LeetCode URLs      │
│                                      │ • Upcoming interviews list (`/todo`) │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ In Progress (Active Milestone)       │ • AI Interview Preparation Brief     │
│                                      │ • Fast Capture invite text parser    │
│                                      │ • Structured outcome debrief analysis│
├──────────────────────────────────────┼──────────────────────────────────────┤
│ Planned (Subsequent Phases)          │ • Cross-interview question analytics │
│                                      │ • One-click calendar (.ics) exports  │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Interview Data Model

```python
class Interview(Base):
    __tablename__ = "interviews"

    id: uuid.UUID                                    # Primary key
    application_id: uuid.UUID                        # Parent Application
    round: int                                       # 1, 2, 3...
    title: str                                       # "Technical Screen - Pair Programming"
    interview_type: str                              # Stage category (e.g. "technical")
    scheduled_at: datetime | None                    # Stored in UTC
    duration_minutes: int | None                     # Duration (default 60)
    timezone: str | None                             # IANA timezone (e.g. "America/New_York")
    status: str                                      # "scheduled", "completed", "cancelled", "rescheduled"
    result: str                                      # "pending", "passed", "failed", "unknown"
    meeting_url: str | None                          # Zoom/Google Meet/Teams URL
    location: str | None                             # Office address or room
    notes: str | None                                # General candidate notes
    preparation_notes: str | None                    # Targeted study outline / checklist
    created_at: datetime
    updated_at: datetime

    # Relationships
    application: Mapped["Application"]
    questions: Mapped[list["InterviewQuestion"]]
    participants: Mapped[list["InterviewParticipant"]]
    ai_suggestions: Mapped[list["AISuggestion"]]
```

### Timezone Invariant
All concrete interview times are stored strictly as UTC timestamps in the database (`scheduled_at`). The display string and calendar reminders are calculated dynamically using the associated IANA timezone (`timezone`, e.g. `America/Los_Angeles`).

---

## 3. Interview Participants

Interviews support multiple participants linked to reusable canonical contacts (`contacts` table):

```text
Interview (1) ──► InterviewParticipant (N) ◄── Contact (1)
```

- **Participant Roles**:
  - `interviewer`: Engineer or hiring manager conducting the evaluation.
  - `coordinator`: Recruiting coordinator handling logistics and links.
  - `observer`: Shadow interviewer or apprentice evaluator.
- **Data Safety**: Adding a participant links an existing canonical contact or creates an application snapshot contact. Deleting a contact removes participant links without deleting the parent interview or application.

---

## 4. Interview Questions, Reflections, and Practice Links

Rather than lumping questions into unstructured notes, questions are recorded as independent, queryable entities in `interview_questions`:

```python
class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id: uuid.UUID
    interview_id: uuid.UUID                        # Parent Interview round
    question: str                                  # The prompt or problem statement
    category: str                                  # "technical", "coding", "system_design",
                                                   # "behavioral", "case", "product", "culture"
    difficulty: str                                # "easy", "medium", "hard", "unknown"
    answer_notes: str | None                       # How candidate answered during interview
    reflection: str | None                         # Post-interview evaluation of gaps/strengths
    leetcode_url: str | None                       # Optional validated LeetCode problem link
    asked_at: datetime | None
    created_at: datetime
    updated_at: datetime
```

### LeetCode URL Validation
LeetCode links are validated strictly server-side:
- Must use `https://` protocol.
- Hostname must be `leetcode.com` or `www.leetcode.com`.
- Must contain a valid problem path (e.g. `https://leetcode.com/problems/lru-cache/`).
- Must not contain user credentials.
- Rendered with `target="_blank"` and `rel="noopener noreferrer"`.

---

## 5. Preparation and Outcome Debrief Workflow

```text
Scheduled Round ──► Generate Prep Brief ──► Candidate Reviews ──► Attends Round
                                                                        │
                                                                        ▼
Next Opportunities ◄── Actionable Gaps ◄── Outcome Debrief ◄── Record Questions
```

1. **Pre-Interview Preparation**:
   - Candidate reviews the job description, interview stage, and submitted resume.
   - Optional AI Interview Preparation Brief generates targeted questions, behavioral stories, and system design topics (see [`03-ai/interview-preparation-brief.md`](../03-ai/interview-preparation-brief.md)).
   - Preparation notes are editable by the user and saved to `interview.preparation_notes`.
2. **Post-Interview Outcome Debrief**:
   - Immediately following the round, candidate logs questions while memory is fresh.
   - Candidate records reflections: what trade-offs were missed, which behavioral answer lacked data, or where the algorithm stumbled.
   - Reflections feed into the next round's preparation and daily study tasks in Todo.
