# CareerNeed Project Conventions

> Status: Active  
> Last updated: 2026-09-17  
> Purpose: Define the product, frontend, backend, and engineering conventions for CareerNeed. All new work must follow these rules.

---

## 1. Product Scope and Roadmap

### Product Purpose
CareerNeed is an AI-assisted career operating system designed to:
1. Minimize manual tracking and administrative work.
2. Connect the full career lifecycle from resume analysis to continuous interview improvement.
3. Provide explainable, actionable guidance to help candidates improve their outcomes.

### Current Status: Phase 1 (Completed ✅)
- Authentication and full per-user data isolation.
- Multi-version resume management with technical skill extraction.
- Unified job pool with Ashby, Greenhouse, Lever connectors and manual job entry.
- Real-time job search, multi-select filters, and saved Search Directions.
- Application tracking in List and Pipeline Kanban views.
- Application Detail workspace with status editor, follow-up scheduler, rich markdown notes, resume linker, and contact management.
- Daily focus dashboard (`/todo`) for urgent follow-ups.
- Encrypted BYOK settings for OpenAI, Groq, and OpenRouter.
- Unified Next.js design system with semantic theme tokens (System/Light/Dark).

### Active Milestone: Phase 2 (Interview Management & AI Coaching 🎯)
- Multi-round interview tracking per application.
- Upcoming interview schedule and timeline view.
- Fast Capture modal (smart copy-paste of emails/invites into structured drafts).
- AI Interview Preparation workspace.
- Post-interview outcome logging & AI failure diagnosis.

### Future Milestones: Phases 3–5
- Resume-first onboarding & AI career profiling.
- Target company recommendation & automated job crawling.
- Semantic JD/Resume matching & career gap roadmap.
- Career history snapshots, backup, and longitudinal analytics.

---

## 2. Frontend UI Design System

### Design Principles
- **One Visual System**: Consistent layout, card surfaces, and input controls across all pages.
- **Semantic Tokens Only**: Never use arbitrary hard-coded palette classes (`bg-slate-900`, `text-indigo-600`, `bg-purple-500`). Use semantic tokens mapped from CSS variables.
- **Theme Modes**: Full support for System, Light, and Dark modes. Zero hydration flash (`suppressHydrationWarning` on `<html>`).
- **One Primary Action**: Every page or major card section should feature at most one primary action button (`bg-primary text-primary-foreground`).

### Required Semantic Token Mapping

| Purpose | Utility Classes |
| :--- | :--- |
| Page Background | `bg-background` |
| Primary Text | `text-foreground` |
| Card / Surface Background | `bg-card` |
| Card Text | `text-card-foreground` |
| Boundaries & Dividers | `border-border` |
| Muted Surface | `bg-muted` |
| Secondary Text | `text-muted-foreground` |
| Primary Action Background | `bg-primary` |
| Primary Action Text | `text-primary-foreground` |
| Focus Ring | `focus-visible:ring-2 focus-visible:ring-primary/20` |
| Destructive Action | `text-destructive bg-destructive/10 border-destructive/40` |

### Semantic Status Colors
Status colors communicate meaning and must not be replaced with the `primary` token:
- **Success / Passed**: Green/emerald surface and text (`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`).
- **Warning / Due Today / Attention**: Amber surface and text (`bg-amber-500/10 text-amber-600 dark:text-amber-400`).
- **Destructive / Overdue / Rejected / Failed**: Rose/red surface and text (`bg-destructive/10 text-destructive`).
- **Informational / Scheduled**: Sky/blue surface and text (`bg-sky-500/10 text-sky-600 dark:text-sky-400`).
- **Neutral / Muted / Saved**: Muted surface and text (`bg-muted text-muted-foreground`).

### Standard Page Layout
```tsx
<main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
  <div className="mx-auto max-w-6xl">
    {/* Standard page content */}
  </div>
</main>
```

---

## 3. Routing and Navigation

### Route Map

| Route | Purpose |
| :--- | :--- |
| `/` | Home workspace and high-level navigation |
| `/todo` | Daily focus workspace: urgent follow-ups & upcoming interviews |
| `/jobs` | Unified job discovery, multi-filters, and search directions |
| `/jobs/add` | Manual job entry form |
| `/applications` | Application list view with status and follow-up filters |
| `/applications/board` | Application pipeline Kanban board view |
| `/applications/[applicationId]` | Application detail: status, notes, follow-up, contacts, and interviews |
| `/resumes` | Resume uploads, labeling, skill extraction, and default toggle |
| `/sources` | Company ATS board configuration and synchronization |
| `/login`, `/register` | User authentication |
| `/forgot-password`, `/reset-password`| Password recovery |
| `/settings` | LLM BYOK credentials and usage quotas |

### Navigation Guidelines
- Standard application header (`AppHeader`) is present on every standard page.
- Always use Next.js `<Link>` for navigation to preserve client-side cache and performance.
- Use `router.push` only for mutations or imperative workflows.
- User-selected filter criteria on list pages must be preserved in URL query parameters.

---

## 4. Backend API Conventions

### General Principles
- Use resource-oriented endpoints and standard HTTP semantics (`200 OK`, `201 Created`, `204 No Content`, `422 Unprocessable Entity`, `404 Not Found`, `409 Conflict`).
- All JSON keys in requests and responses must use `snake_case`.
- Pydantic models validate all incoming payloads. Never return raw database ORM models without a defined Pydantic schema.
- All endpoints must strictly enforce `current_user` authentication via dependency injection (`Depends(get_current_user)`).

### Core Endpoint Signatures

#### Applications & Contacts
```text
GET    /applications
POST   /applications
GET    /applications/{application_id}
PATCH  /applications/{application_id}
DELETE /applications/{application_id}
PUT    /applications/by-job/{job_id}
GET    /applications/me/job-states

GET    /applications/{application_id}/contacts
POST   /applications/{application_id}/contacts
PATCH  /applications/{application_id}/contacts/{contact_id}
DELETE /applications/{application_id}/contacts/{contact_id}
```

#### Interviews (Phase 2)
```text
GET    /interviews/upcoming
POST   /interviews/fast-capture
GET    /applications/{application_id}/interviews
POST   /applications/{application_id}/interviews
PATCH  /applications/{application_id}/interviews/{interview_id}
DELETE /applications/{application_id}/interviews/{interview_id}
POST   /applications/{application_id}/interviews/{interview_id}/prep-plan
POST   /applications/{application_id}/interviews/{interview_id}/analyze-outcome
```

#### Resumes & LLM Settings
```text
GET    /resumes
POST   /resumes/upload
PATCH  /resumes/{resume_id}
DELETE /resumes/{resume_id}

GET    /settings/llm-credentials
POST   /settings/llm-credentials
DELETE /settings/llm-credentials/{provider}
GET    /settings/extraction-mode
```

---

## 5. AI Interaction & Privacy Guidelines

1. **Structured Outputs**: All AI operations (skill extraction, fast capture parsing, interview prep, outcome diagnostics) must use Pydantic schemas with structured outputs (`response_format` or JSON mode).
2. **Deterministic Fallbacks**: If external AI calls fail (e.g., token limit, missing key, provider outage), the system must gracefully fall back to heuristic/regex extractors or manual inputs without throwing fatal application errors.
3. **User Confirmation**: The AI suggests; the user decides. Never commit parsed text or AI plans directly to the database without user preview.
4. **Data Minimization**: Send only the minimum context required for each prompt (e.g., truncate raw resume text to 12,000 characters).

---

## 6. Definition of Done (DoD)

A feature or change is only complete when:
- [ ] Requirements and user workflows are verified against `docs/product-requirements.md`.
- [ ] Database schema changes are covered by an explicit, reviewed Alembic migration.
- [ ] Backend API endpoints are protected by `get_current_user` and strictly isolate user rows.
- [ ] New backend logic is accompanied by automated tests in `apps/api/tests/`.
- [ ] Backend test suite passes: `python -m pytest -q`.
- [ ] Frontend UI conforms to the semantic Tailwind token design system in Light and Dark modes.
- [ ] Frontend lint passes: `npm run lint`.
- [ ] Frontend production build passes: `npm run build`.
- [ ] Relevant documentation (`README.md`, `CURRENT_STATUS.md`, `docs/`) is updated in the same change.
- [ ] No extraneous files, secrets, or temporary artifacts are committed.
