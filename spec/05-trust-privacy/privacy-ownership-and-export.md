# Trust and Privacy: Ownership, Portability, and Export

> **Status:** Authoritative Platform Standard  
> **Owner:** CareerNeed Security & Privacy Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Data privacy, object-level authorization, data export formats, soft delete retention, and the permanent account cancellation guarantee.

---

## 1. The Private-by-Default Commitment

A candidate’s career records—resumes, past rejections, interview transcripts, compensation figures, and private reflections—represent highly confidential personal data. 

CareerNeed operates on a non-negotiable **Private-by-Default** standard:
- No user-owned record is ever made visible to another user without an explicit, multi-step opt-in.
- Resumes and interview notes are strictly quarantined within the user's private tenant space.
- Internal platform telemetry never logs raw resume text, interview reflections, or recruiter contacts.

---

## 2. Object-Level Authorization Model

Every API route servicing user-owned records enforces strict object-level authorization at the database query layer:

```python
# Server-side identity derivation strictly from authenticated session
current_user: User = Depends(get_current_user)

# Hard tenant boundary: client-supplied user_id is ignored
query = select(Application).where(
    Application.id == requested_application_id,
    Application.user_id == current_user.id,
    Application.deleted_at.is_(None),
)
```

- **UUIDs Are Not Permissions**: Random UUID primary keys prevent enumeration, but never replace explicit `user_id` ownership checks.
- **Parent-Child Integrity**: Mutations to nested resources (`interview_questions`, `follow_ups`, `application_contacts`) verify that the parent application belongs to `current_user.id` before committing changes.

---

## 3. The Cancellation and Access Guarantee

Users must never feel trapped by CareerNeed:

> **The Cancellation Guarantee**: If a user cancels their paid subscription or decides to stop using CareerNeed, they are **NEVER locked out** of accessing, viewing, or exporting their complete private career history.

Subscription gating applies exclusively to premium features (e.g. advanced AI quota, automated watch frequency, deep analytics). Core manual tracking and historical career records remain permanently readable and exportable.

---

## 4. Complete Data Portability and Export

Candidates can export their entire career archive at any time via `/settings/export`:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CAREER ARCHIVE EXPORT SHAPES                       │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ JSON Archive        │ Complete, relational, machine-readable JSON dump of   │
│ (`careerneed-export.│ Candidate Profile, Resumes, Applications, Interviews, │
│  json`)             │ Questions, Reflections, and Career Events.            │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ CSV Bundle          │ Formatted spreadsheets:                               │
│ (`applications.csv`,│ • `applications.csv` (Company, Title, Status, Dates)  │
│  `interviews.csv`,  │ • `interviews.csv` (Round, Stage, Time, Notes)        │
│  `questions.csv`)   │ • `questions.csv` (Question, Category, Reflection)    │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ Original Files      │ Authenticated downloads of all original uploaded PDF  │
│                     │ resume files.                                         │
└─────────────────────┴───────────────────────────────────────────────────────┘
```

**Export Security**: Exports omit password hashes, session cookies, unmasked third-party API credentials, and internal operational logs.

---

## 5. Soft Deletion, Retention Windows, and Permanent Purge

To prevent catastrophic accidental data loss:
1. **User Deletion is Soft by Default**: Deleting an application, interview, or resume sets `deleted_at = utcnow()`. Records are immediately excluded from standard views.
2. **30-Day Recovery Window**: Candidates can view and restore soft-deleted items from `/settings/trash` for 30 days.
3. **Controlled Permanent Purge**: After 30 days, or upon explicit user request to "Permanently Delete Account", an automated purge job removes all relational records, files, and audit logs. Backups overwrite older snapshots according to a defined 90-day maximum backup retention cycle.
