---
status: archived
superseded_by: ../04-future-modules/career-memory-and-imports.md and ../05-trust-privacy/security-import-safety-and-prompt-injection.md
reason: Consolidated into Career Memory import pipeline and security standard.
archived_date: 2026-09-19
---

> **ARCHIVED DOCUMENTATION**  
> This specification has been archived and superseded as part of the 2026-09-19 documentation consolidation.  
> It is preserved for historical decision context and provenance only. For current authoritative architecture, see [../04-future-modules/career-memory-and-imports.md](../04-future-modules/career-memory-and-imports.md).

# File Storage and Resume Ingestion

> **Version:** 1.0  
> **Status:** Required Before Production Resume Upload  
> **Priority:** P0 Before Broad Resume-Import Release  
> **Scope:** Private file upload, validation, storage, extraction, resume-import lifecycle, AI handoff, retention, and deletion.

---

## 1. Purpose

CareerNeed allows users to upload resumes and, later, supporting career documents. Those files can contain highly sensitive personal information:

```text
Full name
Email and phone number
Home location
Employment history
Education history
Skills
Projects
Portfolio links
Work authorization information
Compensation information
Recruiter correspondence
Interview notes
```

File upload must therefore be treated as a private-data workflow, not as a generic public media upload feature.

```text
Upload file
→ validate
→ store privately
→ scan
→ extract text
→ create resume import
→ generate reviewable suggestions
→ user confirms profile/resume changes
```

The uploaded resume is not automatically the Candidate Profile source of truth. It is an input artifact whose extracted data must be reviewed by the user.

---

## 2. Scope

### In scope

```text
Private resume file upload
PDF support
Future DOCX support
File metadata
Private storage
Authenticated access
Size/type validation
Content validation
Checksum calculation
Malware scanning integration boundary
Text extraction
Resume import task lifecycle
AI extraction handoff
Manual fallback
Soft delete and retention
```

### Out of scope

```text
Public resume sharing links
Recruiter-facing resume hosting
Collaborative document editing
Automatic resume rewriting
Automatic application submission
Generic arbitrary file hosting
```

---

## 3. Supported File Policy

### 3.1 Initial supported formats

Initial production support:

```text
PDF
```

Future supported formats after dedicated validation/testing:

```text
DOCX
TXT
```

Do not accept formats simply because a browser reports a matching MIME type.

### 3.2 Explicitly unsupported formats

The first release rejects:

```text
EXE
DMG
PKG
APP
JS
HTML
ZIP
RAR
7Z
PPTX
XLSX
CSV
Unknown binary formats
Password-protected/encrypted PDFs unless explicit support is implemented
```

### 3.3 File limits

Initial defaults should be configuration values:

```text
MAX_RESUME_FILE_BYTES=10_485_760
MAX_RESUME_UPLOADS_PER_DAY=20
MAX_ACTIVE_RESUME_FILES_PER_USER=20
MAX_EXTRACTION_TEXT_CHARACTERS=250_000
```

Recommended initial values:

| Control | Initial value |
|---|---:|
| Maximum upload size | 10 MB |
| Maximum uploads per user/day | 20 |
| Maximum active stored resume files/user | 20 |
| Maximum extracted text retained for processing | 250,000 characters |
| Allowed file type | PDF only |
| Maximum parser retry count | 3 |

Limits must be enforced server-side.

---

## 4. File Data Model

### 4.1 File record

```text
files
├── id
├── user_id
├── storage_provider
├── storage_key
├── original_filename
├── normalized_filename
├── content_type
├── detected_content_type
├── byte_size
├── sha256_checksum
├── status
├── scan_status
├── uploaded_at
├── deleted_at
├── purge_after
└── metadata
```

Suggested field meanings:

```text
storage_provider:
local | s3 | r2 | gcs | other

status:
uploaded | validating | scanning | ready | rejected | deleted

scan_status:
not_required | pending | clean | suspicious | infected | failed

metadata:
controlled JSON metadata only
```

### 4.2 Resume import record

```text
resume_imports
├── id
├── user_id
├── file_id
├── resume_id
├── resume_version_id
├── extraction_status
├── extraction_version
├── extracted_text
├── extracted_text_checksum
├── parser_name
├── parser_version
├── error_code
├── error_message_safe
├── created_at
├── started_at
└── completed_at
```

Suggested extraction statuses:

```text
pending
processing
completed
failed
cancelled
```

### 4.3 File-to-resume relationship

The relationship should support this flow:

```text
Uploaded file
→ Resume
→ Resume Version
→ Candidate Profile extraction suggestions
```

A file may be the source of one or more Resume Versions, but a Resume Version should retain the exact file/document snapshot used at that version.

---

## 5. Storage Requirements

### 5.1 Private storage only

Resume files must never be placed in a public static web directory.

Incorrect:

```text
/public/uploads/resume.pdf
/static/resumes/user-123.pdf
```

Required behavior:

```text
Private object storage
or
Private server-side file storage outside public web root
```

### 5.2 Storage keys

Never use client filename as the storage path.

Incorrect:

```text
uploads/john-smith-resume.pdf
uploads/../../sensitive-file.pdf
```

Preferred storage key shape:

```text
users/{user_id}/resumes/{file_id}/{random_object_name}.pdf
```

Example:

```text
users/636bbb80-5974-4902-ba13-67df6bc11023/resumes/98fa.../resume-source.pdf
```

The user-facing filename remains metadata only.

### 5.3 Access model

Files are private by default.

Allowed retrieval patterns:

```text
Authenticated application download endpoint
Short-lived signed download URL
Short-lived signed upload URL with server-side post-validation
```

Every download must verify file ownership or authorized delegated access.

### 5.4 Storage encryption

Production storage should support encryption at rest through the storage provider or encrypted volume. Transport must use HTTPS/TLS.

Do not implement custom encryption schemes unless there is a defined threat model and security review.

---

## 6. Upload Security Requirements

### 6.1 Validation sequence

```text
Authenticate user
→ enforce rate/quota limits
→ validate extension allowlist
→ enforce byte-size limit
→ inspect MIME/content signature where feasible
→ generate safe storage key
→ store privately/quarantine
→ scan if available
→ mark ready or rejected
→ queue extraction
```

### 6.2 Filename handling

```text
Preserve original filename only as display metadata.
Never trust filename extension.
Never use filename as storage path.
Normalize/display safely.
Reject path separators and control characters for display safety.
```

### 6.3 Content validation

For PDF uploads:

```text
Verify expected PDF file signature where feasible.
Attempt safe parser opening in isolated/error-handled process.
Reject malformed files that cannot be safely processed.
Do not rely solely on browser-provided Content-Type.
```

### 6.4 Malware scanning

Production architecture must reserve a scanning step.

```text
Upload
→ quarantine/private storage
→ scan
→ clean/rejected decision
→ extraction only after clean/approved state
```

Local development may use:

```text
scan_status = not_required
```

but production should not pretend that a skipped scan is equivalent to a clean scan.

### 6.5 Rate limiting

Rate-limit:

```text
Upload endpoint
Resume parsing trigger
Extraction retry endpoint
Signed URL creation endpoint
```

Uploads and extraction consume storage, CPU, queue capacity, and possibly AI budget. Limits are required even for authenticated users.

---

## 7. Resume Ingestion Lifecycle

### 7.1 Upload lifecycle

```text
1. User selects PDF.
2. Client receives upload validation feedback.
3. API creates/accepts private File record.
4. File status becomes uploaded/validating.
5. Scan is completed or marked not_required in local development.
6. File status becomes ready or rejected.
7. Resume import task is queued.
8. User sees processing, completed, or failed state.
9. Completed extraction becomes reviewable input.
```

### 7.2 Extraction lifecycle

```text
Ready file
→ create ResumeImport
→ extraction_status = pending
→ background worker claims task
→ extraction_status = processing
→ parser extracts text
→ text is bounded/validated
→ structured extraction may run
→ extraction_status = completed
→ reviewable AI/profile suggestions created
```

### 7.3 Extraction failure

Failure must not make the uploaded file disappear.

User-facing states:

```text
We could not read this resume.
[Try again]
[Upload another file]
[Paste resume text]
[Create resume manually]
```

Safe internal states:

```text
extraction_status = failed
error_code = unsupported_pdf | encrypted_pdf | parser_error | scan_rejected | timeout
```

Do not expose raw stack traces to users.

### 7.4 Manual fallback

The user must always be able to:

```text
Create a Resume manually
Paste plain text
Add Candidate Profile skills/experience manually
Retry upload where safe
Delete the failed upload
```

AI/parser availability must not block core career tracking.

---

## 8. Text Extraction and AI Handoff

### 8.1 Extracted text handling

Extracted text is sensitive data.

Rules:

```text
Store privately.
Do not expose extracted text to other users.
Do not place full text in generic logs or analytics.
Do not automatically publish extracted text.
Bound stored/exposed size.
Allow user deletion according to retention policy.
```

### 8.2 AI extraction flow

```text
Extracted resume text
→ targeted extraction task
→ AI suggestions
→ user review
→ accepted/rejected/edited decision
→ confirmed profile/resume update
```

AI may suggest:

```text
Skills
Employment history
Project details
Education
Role/seniority clues
Career themes
Resume improvement opportunities
```

AI output is not automatically written into Candidate Profile as truth.

### 8.3 Data minimization

Send only the minimum content needed to a model provider.

Examples:

```text
Skill extraction:
Resume text excerpts may be sufficient.

Role classification:
Relevant headings/experience may be sufficient.

Interview preparation:
Use selected resume snapshot and job context, not every user file.
```

Never send:

```text
Passwords
Session tokens
Password-reset tokens
Database credentials
Provider API keys
Unnecessary private file metadata
```

---

## 9. Deduplication and Idempotency

### 9.1 Checksum

Calculate SHA-256 for each uploaded file.

```text
sha256_checksum
```

Use checksum as an aid for:

```text
Duplicate upload detection
Extraction idempotency
Storage integrity checking
```

Do not automatically delete a newly uploaded duplicate without explaining it. The user may intentionally upload the same file under a different resume/workflow context.

### 9.2 Extraction idempotency

A parser run should be unique by:

```text
file_id + extraction_version
```

Example:

```text
UNIQUE(file_id, extraction_version)
```

A retry should reuse or explicitly supersede the existing import task rather than create unlimited duplicate extraction rows.

### 9.3 Resume Version relationship

If a user uploads the same content intentionally as a new Resume Version:

```text
Resume Version remains a user decision.
File checksum can be identical.
Version history still records the action.
```

---

## 10. Retention and Deletion

### 10.1 Soft delete

User-facing deletion should first mark:

```text
files.deleted_at
resumes.deleted_at
resume_imports.cancelled/deleted state
```

Normal list/download queries exclude deleted files.

### 10.2 Referenced file retention

If a file supports a Resume Version used in an Application:

```text
Do not silently purge it immediately.
Retain according to Application/history retention policy.
Allow the user to understand that historical application evidence may be affected.
```

### 10.3 Physical purge

Physical deletion should occur through a controlled background task only after:

```text
Retention window elapsed
No legal/product retention requirement remains
No active historical reference requires preservation
User-account deletion policy permits purge
```

### 10.4 Account deletion

Account deletion workflow must consider:

```text
Files
Extracted text
Resume Versions
Candidate Profile data
Applications
Interview notes
AI suggestions
Background task artifacts
Object storage copies
Backups according to retention policy
```

---

## 11. API Requirements

Suggested endpoints:

```text
POST   /api/files/resumes
GET    /api/files/{file_id}
GET    /api/files/{file_id}/download
DELETE /api/files/{file_id}

POST   /api/resume-imports
GET    /api/resume-imports/{resume_import_id}
POST   /api/resume-imports/{resume_import_id}/retry
```

Rules:

```text
Every endpoint requires authentication.
Every file/import query validates ownership.
Upload endpoint enforces server-side type/size/quota checks.
Download endpoints do not reveal another user’s file.
Retry endpoint is idempotent and rate-limited.
Delete is soft delete unless controlled purge policy applies.
```

---

## 12. Observability

Required safe events/metrics:

```text
resume_upload_started
resume_upload_completed
resume_upload_rejected
resume_scan_completed
resume_scan_rejected
resume_extraction_started
resume_extraction_completed
resume_extraction_failed
resume_import_retry_requested
```

Track:

```text
Upload size distribution
Upload rejection rate
Parser success/failure rate
Average extraction time
Queue delay
Scan status distribution
Duplicate checksum rate
Storage consumption per user/tenant
```

Never log:

```text
Full resume text
Full file contents
Passwords/tokens
Signed URLs
Storage credentials
```

---

## 13. Definition of Done

```text
PDF upload is private and authenticated.
Server enforces file size/type/rate/quota rules.
Storage keys are generated and do not trust filenames.
Files are not served from public web paths.
Ownership is checked for every upload/download/delete/import operation.
File status and scan status are modeled.
Resume extraction is asynchronous, idempotent, and observable.
Extraction failure provides user-safe manual fallback.
AI extraction creates reviewable suggestions only.
Referenced resume artifacts are not silently destroyed.
Soft delete and purge lifecycle is documented.
No file text, credentials, passwords, reset URLs, or tokens enter general logs/analytics.
```