# Future Module: Career Memory and Safe Imports Pipeline

> **Status:** Planned (Phase 3 Core Deliverable)  
> **Owner:** CareerNeed Data Platform Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Multi-format file imports (CSV, Markdown, TXT), safe parsing sandbox, interactive mapping wizard, provenance tracking, and reversible import transactions.

---

## 1. Module Purpose and Principles

Candidates frequently have historical job searches trapped in personal spreadsheets, Notion pages, or markdown notes. **Career Memory** ingests these historical records safely without overwriting current application truth or injecting unverified data.

### Core Invariants
1. **Never Overwrite Without Confirmation**: Imported records never automatically overwrite or mutate existing canonical applications, jobs, or contacts.
2. **Preserve Source Provenance**: Every imported entity retains a cryptographic link to the source file, row, section, and extraction timestamp.
3. **Reversible Imports**: Candidates can undo or roll back an imported batch in one click without data corruption.
4. **Prevent Stale Overwrites**: Older imported application statuses (e.g. "Applied") are blocked from regressing newer live statuses (e.g. "Interviewing").

---

## 2. Staged File Format Support

```text
┌──────────────────────────────────────┬──────────────────────────────────────┐
│       PHASE 3 INITIAL FORMATS        │      DEFERRED SUBSEQUENT FORMATS     │
│       (Prioritized at Launch)        │      (Requires Dedicated Testing)    │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • CSV (Comma-Separated Values)       │ • XLSX / Microsoft Excel             │
│ • Markdown (.md tables & lists)      │ • Notion Export ZIP archives         │
│ • Plain Text (.txt structured dumps) │ • Google Sheets live integration     │
│                                      │ • PDF / DOCX portfolio archives      │
│                                      │ • Email / Calendar OAuth sync        │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 3. The 9-Stage Safe Import Pipeline

```text
  [ 1. Upload File ]
           │
           ▼
  [ 2. Safe Parsing Sandbox ] ──► (Quarantine, size/row limits, strip scripts)
           │
           ▼
  [ 3. Interactive Data Preview ]
           │
           ▼
  [ 4. Sheet / Section Selection ]
           │
           ▼
  [ 5. Column / Field Mapping ]
           │
           ▼
  [ 6. AI Extraction Suggestions ] ──► (Propose normalized dates, companies, roles)
           │
           ▼
  [ 7. Candidate Review & Edit ]
           │
           ▼
  [ 8. Duplicate & Merge Review ] ──► (Resolve collisions: skip, merge, keep separate)
           │
           ▼
  [ 9. Confirm & Commit Batch ] ──► Immutable Provenance Stored (Undo Available)
```

### Pipeline Details
1. **Upload**: User uploads a `.csv`, `.md`, or `.txt` file (max 10MB, max 5,000 rows).
2. **Safe Parse**: Server-side parser operates in an isolated environment:
   - **Zero Code Execution**: Disables all macro execution, external hyperlink resolution, dynamic formulas (`=CMD(...)`), and embedded content.
   - Rejects malformed byte streams, control characters, and invalid UTF-8 encodings.
3. **Data Preview**: Renders the first 25 rows in a clean preview table.
4. **Sheet / Section Selection**: User selects which table or markdown section to ingest.
5. **Column Mapping**: Candidate maps file columns to canonical domain attributes:
   - `Company Name` → `Job.company_name`
   - `Job Title` → `Job.title`
   - `Status` → `Application.status`
   - `Date Applied` → `Application.applied_at`
   - `Notes` → `Application.notes`
6. **AI Extraction Suggestions**: Model router optionally suggests column mappings and normalizes date formats (`MM/DD/YYYY` → ISO 8601 UTC).
7. **Candidate Review & Edit**: Candidate reviews the transformed table, correcting errors inline.
8. **Duplicate / Merge Review**: The system checks for collisions against existing applications using `(company, title)`. For each duplicate, candidate selects:
   - **Skip**: Ignore the imported row.
   - **Merge**: Append imported notes to existing application without altering newer status.
   - **Create Separately**: Record as an independent application track.
9. **Confirm & Commit**: Records are committed within a single database transaction. The batch receives a unique `import_batch_id`.

---

## 4. Provenance and Rollback Architecture

### 4.1 Provenance Model (`import_provenance`)
Every row created via import stores:
- `import_batch_id`: UUID of the import execution.
- `source_file_id`: Reference to the privately stored original file.
- `source_row_index`: Original line/row number in the user file.
- `extracted_raw_fragment`: Frozen JSON representation of the original row.
- `imported_at`: UTC timestamp.

### 4.2 Reversible Imports (One-Click Undo)
If a user imports the wrong spreadsheet or is dissatisfied with column mappings:
- Candidate clicks "Undo Import" on the import history panel.
- The server identifies all applications, jobs, contacts, and notes created with that `import_batch_id`.
- Entities with no subsequent user activity are cleanly purged.
- Entities that were merged revert their appended text to the pre-import snapshot.
- The source file remains available in user-owned private storage or can be deleted per user choice.

---

## 5. Storage Topology and Lifecycle Controls

1. **Storage Topology Separation**:
   - **Local Development**: Ignored local storage paths (e.g. `uploads/`, git-ignored) used strictly for non-production test data.
   - **Production**: Private object storage (e.g. S3-compatible) or platform-managed persistent storage accessed strictly behind an abstract `StorageService` interface. The final provider choice remains open until production infrastructure topology is chosen.
2. **Access Control & Non-Public Buckets**:
   - Zero public bucket or container exposure.
   - All object keys are generated as non-enumerable UUID paths.
   - All file downloads and reads require authenticated user-ownership verification.
3. **Safe Delivery & Scanning**:
   - Delivery is executed via authenticated streaming proxies or short-lived (5-minute) signed URLs.
   - Files are subject to a future pre-processing hook for automated malware scanning and malicious payload inspection before parsing.
4. **Retention & Deletion**:
   - 30-day soft-delete recovery retention matching the platform user data lifecycle.
   - Permanent account deletion executes a hard purge of all associated raw files and parsed artifacts.
