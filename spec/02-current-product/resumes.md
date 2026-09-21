# Current Product: Resume Management and Versioning

> **Status:** Implemented (Upload, Skill Extraction, Archive, Application Link) / In Progress (Immutable Version Snapshots)  
> **Owner:** CareerNeed Product & Platform  
> **Last Updated:** 2026-09-19  
> **Scope:** Resume management (`/resumes`), PDF parsing, automated skill extraction, labeling, default resume rules, and application linking.

---

## 1. Module Overview and Current Status

The Resumes module allows job seekers to maintain, parse, label, and link targeted resume versions to specific applications.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAPABILITY STATUS BREAKDOWN                       │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Shipped & Verified in Code           │ • PDF upload with 10MB size limit    │
│                                      │ • Text extraction via pdfplumber     │
│                                      │ • Automated skill extraction with    │
│                                      │   Pydantic schema and regex fallback │
│                                      │ • User-defined resume labeling       │
│                                      │ • Single active default constraint   │
│                                      │ • Soft archive & restore workflow    │
│                                      │ • Application resume linkage         │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ In Progress (Active Milestone)       │ • Immutable ResumeVersion entity     │
│                                      │ • Frozen snapshot attached to apps   │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ Planned (Subsequent Phases)          │ • Multi-format Career Memory imports │
│                                      │   (CSV, Markdown, TXT)               │
│                                      │ • Full DOCX / Notion export support  │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Resume Data Model

```python
class Resume(Base):
    __tablename__ = "resumes"

    id: uuid.UUID                                    # Primary key
    user_id: uuid.UUID                               # Authenticated owner
    filename: str                                    # Uploaded file display name
    raw_text: str                                    # Extracted plain text content
    skills: str | None                               # JSON string of extracted skills
    label: str | None                                # User-defined target label ("Backend v2")
    is_default: bool                                 # Primary default indicator
    archived_at: datetime | None                     # Soft archive timestamp
    source: str | None                               # "pdf_upload", "manual_entry"
    uploaded_at: datetime

    # Relationships
    user: Mapped["User"]
    applications: Mapped[list["Application"]]
```

---

## 3. PDF Ingestion and Skill Extraction Pipeline

```text
PDF Upload (<=10MB) ──► Validation ──► pdfplumber Parse ──► Raw Text Stored
                                                                 │
                                                                 ▼
Extracted Skills ◄── Regex Section Fallback ◄── AI Skill Extractor (Schema)
```

1. **File Validation**:
   - Accepts strictly PDF format.
   - Enforces 10 MB file size limit server-side.
   - Verifies file header and readable stream structure before processing.
2. **Text Extraction**:
   - Uses `pdfplumber` for robust text extraction across multi-column technical resumes.
   - Strips dangerous non-printable control characters and normalizes whitespace.
3. **Structured Skill Extraction (`app/services/skill_extractor.py`)**:
   - Submits extracted text to the server-side model router with a strict Pydantic JSON schema.
   - Categorizes skills into Languages, Frameworks, Cloud/Infrastructure, and Developer Tools.
   - **Deterministic Fallback**: If LLM provider is unavailable, rate-limited, or fails schema validation, the system automatically falls back to regex-based section parsing. Text upload and resume creation **never fail** due to AI provider downtime.

---

## 4. Default Selection and Archival Rules

1. **Single Active Default Constraint**:
   - A user may have at most one active default resume across their account.
   - Marking a resume as default (`is_default = true`) automatically clears the default flag on any previous default resume in the same database transaction.
2. **Soft Archive and Restore**:
   - Deleting a resume sets `archived_at = utcnow()` rather than physically dropping rows.
   - Archived resumes are excluded from default lists and cannot be set as the default resume.
   - Archived resumes can be un-archived at any time.
3. **Application Preservation**:
   - Applications maintain a foreign key reference (`resume_id`) to the resume used at submission.
   - Archiving a resume never deletes or disassociates historical applications that used that resume.
