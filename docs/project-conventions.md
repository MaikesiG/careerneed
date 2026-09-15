# CareerNeed Project Conventions

> Status: Active
>
> Purpose: Define the product, frontend, backend, and delivery conventions for CareerNeed. All new work should follow these rules unless this document is intentionally updated in the same change.

## 1. Product scope and roadmap

### Product purpose

CareerNeed is a focused job-search workspace. It helps a user:

1. Maintain resumes.
2. Collect jobs from synced company sources and manual discovery.
3. Search and filter a unified job pool.
4. Save jobs and track application status.
5. Record notes and follow-up dates.

### Current V1 scope

V1 is English-only and focuses on a coherent daily job-search workflow:

- Home workspace and global navigation.
- Resume management.
- Job discovery, search, filters, sorting, and pagination.
- Manual job entry at `/jobs/add`.
- Application tracking and status changes.
- Application notes and follow-up dates.
- Job source management.
- Light, dark, and system theme choices.

### Deferred to V1.1

- Dashboard counts and real task summary.
- Manual job-entry refinements.
- Interview records.
- Resume-to-application association improvements.
- Match-score explanation and scoring refinements.
- Location-normalization improvements.

### Deferred to V2: localization

V2 introduces complete localization, beginning with English and Spanish.

Localization includes more than translated navigation labels:

- Route and locale strategy, such as `/en/jobs` and `/es/jobs`.
- English and Spanish translation files.
- A language picker that preserves the current page when possible.
- Translation of all UI text, validation messages, empty states, status labels, and buttons.
- Locale-aware date, number, and plural formatting.
- Correct document language, for example `<html lang="es">`.
- Browser-language detection and a persisted language preference.

Until V2, visible UI copy must be English only. Do not add a partial language toggle or mix English and Spanish in V1.

### Out of scope unless planned

- New AI features without a clear user workflow and acceptance criteria.
- Complex analytics charts before the core workflow is validated by regular use.
- New database fields or APIs created only to support a visual experiment.
- Broad refactors combined with unrelated feature work.

---

## 2. Frontend UI design system

### Design principles

- Use one visual system across Home, Resumes, Jobs, Applications, Sources, and future pages.
- Support Light, Dark, and System theme modes on every page.
- Use semantic color tokens, never page-specific hard-coded palette classes for ordinary UI.
- Keep layout gutters, content alignment, controls, and button hierarchy consistent.
- Favor clear, practical UI over decorative effects.
- Preserve semantic color for success, warning, error, and score/status information.

### Global shell

Every route renders within the shared app shell.

The global header must provide:

- `CareerNeed` brand link to `/`.
- Primary navigation links: Home, Resumes, Jobs, Applications, Sources.
- Theme control: System, Light, Dark.

Rules:

- Do not create a new page without the global header unless it is an intentional full-screen exception, such as a future authentication flow.
- The `CareerNeed` brand always links to Home.
- Navigation labels remain English in V1.
- Header styling must use theme tokens.

### Standard page layout

Use this layout for normal application pages:

```tsx
<main className='min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8'>
  <div className='mx-auto max-w-6xl'>{/* Page content */}</div>
</main>
```

Rules:

- Standard horizontal gutter: `px-4 sm:px-6 lg:px-8`.
- Standard vertical page padding: `py-10`.
- Standard wide content container: `mx-auto max-w-6xl`.
- Use `max-w-3xl` only for intentionally narrow reading or form pages, such as `/jobs/add`.
- Narrow pages must retain the same horizontal gutter: `px-4 sm:px-6 lg:px-8`.
- Do not use arbitrary page-level left/right padding unless there is a documented responsive need.

### Standard page header

Use this structure when a page has a title and actions:

```tsx
<header className='mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
  <div>
    <p className='text-sm font-semibold uppercase tracking-[0.2em] text-primary'>
      CareerNeed
    </p>
    <h1 className='mt-2 text-3xl font-bold tracking-tight sm:text-4xl'>
      Page title
    </h1>
    <p className='mt-3 max-w-3xl text-muted-foreground'>Page description.</p>
  </div>

  <div className='flex flex-wrap gap-2'>{/* Page actions */}</div>
</header>
```

### Theme model

The application supports these modes:

- `system`: default; follow the operating system/browser preference.
- `light`: force the light theme.
- `dark`: force the dark theme.

Implementation requirements:

- Use `next-themes` at the root layout with `attribute="class"`, `defaultTheme="system"`, and `enableSystem`.
- The theme class belongs on the document root.
- Use `suppressHydrationWarning` on `<html>` for theme-class differences introduced before hydration.
- Theme selection may be stored locally in the browser during V1.
- Do not render theme-dependent client state during SSR in a way that produces hydration differences. Use a hydration-safe client pattern for the theme control.

### Semantic tokens

Use semantic Tailwind utilities mapped from CSS variables in `src/app/globals.css`.

Required tokens:

| Purpose                   | Utility classes                                                  |
| ------------------------- | ---------------------------------------------------------------- |
| Page background           | `bg-background`                                                  |
| Primary text              | `text-foreground`                                                |
| Card/surface background   | `bg-card`                                                        |
| Card text                 | `text-card-foreground`                                           |
| Borders                   | `border-border`                                                  |
| Muted surface             | `bg-muted`                                                       |
| Secondary text            | `text-muted-foreground`                                          |
| Primary action background | `bg-primary`                                                     |
| Primary action text       | `text-primary-foreground`                                        |
| Focus ring                | `focus:ring-primary/20`                                          |
| Error/danger              | `text-destructive`, `bg-destructive/10`, `border-destructive/40` |

Ordinary UI must not use palette-specific classes such as:

```text
bg-white
bg-slate-50
bg-slate-900
text-slate-*
border-slate-*
bg-indigo-*
text-indigo-*
border-indigo-*
bg-purple-*
text-purple-*
```

These classes may appear only when they are intentionally mapped to a documented semantic state during a migration. New code must use semantic tokens directly.

### Semantic status colors

Status colors communicate meaning and should not be replaced with `primary`.

Use the following meanings consistently:

| Meaning                          | Typical treatment              |
| -------------------------------- | ------------------------------ |
| Success                          | Green/emerald surface and text |
| Warning / attention needed       | Amber surface and text         |
| Error / destructive              | Red/rose surface and text      |
| Informational / selected control | Primary token                  |
| Neutral / unknown                | Muted surface and muted text   |

As the theme migration progresses, status styling should be represented by semantic token families such as `success`, `warning`, and `destructive`, with dark-mode-safe foreground and surface values.

### Cards and surfaces

Standard card:

```tsx
<section className='rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6'>
  {/* Content */}
</section>
```

Empty-state card:

```tsx
<section className='rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-sm'>
  {/* Content */}
</section>
```

Rules:

- Use `rounded-2xl` for major cards and page sections.
- Use `border-border` for ordinary boundaries.
- Use `bg-card` for ordinary surfaces.
- Do not introduce a different card radius or shadow without a documented reason.

### Buttons

Every page should have no more than one primary action in its main action group.

Example for Jobs:

- Primary: `+ Add a job`.
- Secondary: `My applications`, `Refresh jobs`.

Primary button:

```tsx
'inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
```

Secondary button:

```tsx
'inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50';
```

Danger button:

```tsx
'inline-flex h-10 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 px-4 text-sm font-semibold text-destructive transition hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-50';
```

Rules:

- Controls use `rounded-lg`.
- Standard action controls use `h-10`.
- Primary actions use `primary`, not indigo, purple, or a page-specific color.
- Never use color alone to communicate a destructive action; use clear label text.
- Disabled controls must visibly use `disabled:cursor-not-allowed disabled:opacity-50` or an equivalent accessible treatment.

### Forms

Standard text input, select, and textarea:

```tsx
'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60';
```

Rules:

- Every form field requires a visible label.
- Required fields use a visible `*` and browser-level `required` when applicable.
- Use `type="url"` for URL fields.
- Use `type="date"` for date-only fields.
- Place concise help text below the relevant field using `text-muted-foreground`.
- Errors must be visible, associated with the field or form when possible, and not communicated by color alone.
- Do not offer a field in the UI if the API silently ignores or drops it.

### Accessibility baseline

- Use semantic HTML: `main`, `header`, `nav`, `section`, `form`, `label`, `button`.
- Every icon-only control requires an `aria-label`.
- Error messages use `role="alert"`.
- Non-error status messages use `role="status"` where appropriate.
- Use `aria-pressed` for theme-mode buttons.
- Keep keyboard focus visible using the standard focus token.
- Check contrast in Light and Dark mode before accepting a UI change.

---

## 3. Routing and navigation

### Current route map

| Route                           | Purpose                                           |
| ------------------------------- | ------------------------------------------------- |
| `/`                             | Home workspace and module entry points            |
| `/resumes`                      | Resume management                                 |
| `/jobs`                         | Unified job search, filters, job tracking actions |
| `/jobs/add`                     | Manual job entry                                  |
| `/applications`                 | Application list, status and follow-up views      |
| `/applications/[applicationId]` | Application detail, notes, and follow-up editing  |
| `/sources`                      | Company/source management                         |

### Route rules

- Use resource-oriented routes.
- Use plural resource names: `/jobs`, `/resumes`, `/applications`, `/sources`.
- A manual job-entry page belongs under jobs: `/jobs/add`, not `/add-job`.
- A resource detail belongs under its collection: `/applications/[applicationId]`.
- Future editing should follow `/resource/[id]/edit` only when a distinct edit page is necessary.
- Do not create UI-oriented routes such as `/job-dashboard-page` or `/manual-job-form-page`.

### Navigation rules

- Every normal page has access to the shared AppHeader.
- The brand link and Home link always navigate to `/`.
- Page-level back links should return to the immediate meaningful parent, such as `/jobs/add` → `/jobs`.
- Use `Link` for navigation whenever possible.
- Use `router.push` only for navigation caused by successful client-side mutation or explicit imperative actions.
- Preserve query parameters when they represent user-controlled filter state.

### Query parameter rules

For list pages, query parameters are part of the user-visible state.

- Use stable, descriptive, snake_case query names.
- Keep filter values in the URL when users may bookmark, share, refresh, paginate, or return to the list.
- Reset pagination when a filter change makes the current page invalid.
- Do not use query parameters for private secrets or large pasted text.

Examples:

```text
/jobs?source=manual
/jobs?workplace_type=remote
/jobs?location=New%20York
/jobs?min_match_score=75
/applications?status=applied
/applications?follow_up=overdue
```

### Future localization rule

Localization is V2. Until then, do not introduce locale-prefixed routes.

When V2 begins, create a separate approved localization plan before moving routes to a locale structure such as:

```text
/en/jobs
/es/jobs
```

The plan must define redirects from existing V1 routes, language detection, language persistence, and how switching language preserves the active route and query parameters.

---

## 4. Backend API conventions

### General principles

- The API is the source of truth for persistent career data.
- Use resource-oriented endpoints and standard HTTP semantics.
- Validate request data at the API boundary.
- Keep request and response field names in `snake_case`.
- Return errors in a stable, documented shape.
- Do not expose a request field that is silently ignored without documenting it and testing the behavior.

### Naming

- API JSON fields: `snake_case`.
- Python/Pydantic models: `PascalCase` class names, `snake_case` fields.
- TypeScript types: `PascalCase` type names; API object properties preserve `snake_case`.
- Resource paths: plural nouns.

Example:

```json
{
  "company_name": "Example Labs",
  "title": "Backend Engineer",
  "workplace_type": "hybrid",
  "application_url": "https://example.com/careers/backend-engineer"
}
```

### Endpoint patterns

Use these patterns as the default:

```text
GET    /jobs
POST   /jobs/manual
GET    /jobs/{job_id}
PATCH  /jobs/{job_id}
DELETE /jobs/{job_id}

GET    /applications
POST   /applications
GET    /applications/{application_id}
PATCH  /applications/{application_id}
DELETE /applications/{application_id}

GET    /resumes
POST   /resumes
GET    /sources
POST   /sources
```

Rules:

- Use a nested or action-like route only where it represents a clear creation mode or non-CRUD operation.
- `POST /jobs/manual` is acceptable because it creates a Job from user-entered data while setting a known manual source type.
- Do not create endpoints named after frontend components or pages.

### HTTP status codes

| Situation                                | Status |
| ---------------------------------------- | -----: |
| Successful GET                           |  `200` |
| Successful POST creation                 |  `201` |
| Successful PATCH update                  |  `200` |
| Successful DELETE with no body           |  `204` |
| Invalid input / schema validation        |  `422` |
| Authentication required, when introduced |  `401` |
| Permission denied, when introduced       |  `403` |
| Missing resource                         |  `404` |
| State or uniqueness conflict             |  `409` |
| Unexpected server failure                |  `500` |

### Request and response contracts

- Define a Pydantic request schema for every mutation.
- Define a response schema for every public response.
- Avoid returning raw ORM models without a declared response model.
- Treat schema changes as API changes: update frontend types, tests, and relevant documentation in the same pull request/commit series.
- Required fields must be truly required and validated.
- Optional fields should explicitly document whether `null`, omitted values, and empty strings have different meanings.

### Manual job contract

The manual job flow is a canonical contract:

```text
POST /jobs/manual
```

The API must:

- Require a company name, job title, and application URL if those are required by the request schema.
- Assign `source="manual"` and an appropriate manual source type server-side.
- Normalize `workplace_type` server-side.
- Calculate match score according to the current scoring policy.
- Return `201 Created` with the created job.
- Make every accepted request field have a defined behavior: persist it, derive from it, or explicitly reject/remove it from the schema.

Important rule:

> If `JobManualCreate` accepts a field such as `notes`, the endpoint must persist it through an appropriate model/relationship, explicitly transform it, or the field must be removed from the public request schema. The frontend must never present an input whose value is silently discarded.

### List endpoints and pagination

Use one consistent list convention per API version.

Current convention, if already implemented:

```text
GET /jobs?page=1&page_size=20
X-Total-Count: 125
```

Recommended future response convention, when a versioned migration is justified:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 125
  }
}
```

Do not mix pagination conventions in the same endpoint without a documented migration.

### Filtering and sorting

Use stable, user-meaningful names:

```text
source
status
workplace_type
location
min_match_score
sort
page
page_size
```

Rules:

- Use the same concept name across API, frontend state, and URL query parameters whenever possible.
- Validate enums at the API boundary.
- Document default sorting and pagination behavior.
- Handle missing/unknown values deliberately rather than relying on accidental database ordering.

### Error responses

- Validation errors may follow the framework's standard `422` format.
- Domain errors should use a stable `detail` message suitable for display or mapping by the frontend.
- Do not leak stack traces, database credentials, or internal implementation details.
- Frontend code must handle non-JSON error responses safely.

---

## 5. Engineering workflow and definition of done

### Change boundaries

Keep commits and milestones coherent.

Good boundaries:

```text
docs: add product and engineering conventions
feat(web): add app navigation and theme controls
feat(web): migrate jobs page to semantic theme tokens
feat(jobs): add manual job entry
```

Avoid combining unrelated changes:

```text
Bad: theme migration + database migration + i18n routing + unrelated refactor
```

### Required checks for frontend changes

For any frontend feature or styling change:

```bash
cd apps/web
npm run lint
npm run build
```

Manual browser verification must include, when relevant:

- The changed route loads.
- The global header appears and CareerNeed navigates Home.
- Light mode is readable.
- Dark mode is readable.
- System mode follows the device preference.
- Buttons, forms, disabled states, focus states, alerts, and empty states remain usable.
- Mobile/narrow width does not cause header or action controls to overlap.
- Existing URL filters, pagination, and navigation behavior are preserved.

### Required checks for backend changes

For backend behavior or API contract changes:

```bash
cd apps/api
source .venv/bin/activate
python -m pytest -q
```

Also verify the relevant endpoint manually or through a focused automated test:

- Valid request succeeds with expected status and response shape.
- Invalid request fails with expected status.
- Persistent fields are actually stored and returned.
- Existing endpoints and tests remain intact.

### Theme-migration workflow

Migrate one page or tightly related page group at a time.

For each page:

1. Replace ordinary hard-coded colors with semantic tokens.
2. Preserve semantic status colors for success, warning, error, and score meaning.
3. Replace ordinary indigo/purple actions with the global primary token.
4. Apply the standard layout gutter and container rules.
5. Check the page in Light, Dark, and System mode.
6. Run lint and build.
7. Commit only after browser verification.

Recommended migration order:

1. Jobs.
2. Applications list.
3. Application detail, notes editor, and follow-up editor.
4. Resumes.
5. Sources.
6. Home and Add Job final visual consistency pass.

### Definition of done

A feature is done only when all applicable items are complete:

- [ ] User story and acceptance criteria are clear.
- [ ] Route and navigation behavior follow this document.
- [ ] UI uses global layout, theme tokens, card, button, and form conventions.
- [ ] Light, Dark, and System modes are tested for changed UI.
- [ ] No ordinary UI uses unapproved hard-coded palette styling.
- [ ] UI remains accessible by keyboard and has appropriate semantic/ARIA behavior.
- [ ] API request and response contract is defined and implemented consistently.
- [ ] New or changed backend behavior has tests.
- [ ] `npm run lint` passes for frontend changes.
- [ ] `npm run build` passes for frontend changes.
- [ ] `python -m pytest -q` passes for backend changes.
- [ ] Browser/manual acceptance checks pass.
- [ ] `git diff` contains only intended files.
- [ ] No `.env`, `.next`, `.vscode`, credentials, or generated artifacts are accidentally committed.
- [ ] Commit message is scoped and descriptive.

### Before committing

Always inspect the working tree:

```bash
cd ~/development/projects/careerneed
git status
git diff --stat
git diff
```

Stage only intended files:

```bash
git add path/to/intended/file
```

Use scoped conventional commit messages:

```text
docs: add project conventions
feat(web): add app navigation and theme controls
feat(web): migrate jobs page theme
fix(web): prevent theme toggle hydration mismatch
feat(jobs): add manual job entry
```

### Documentation maintenance

Update this document when a deliberate project-wide convention changes.

Update route documentation when a route is added, removed, or intentionally renamed.

Update API documentation and tests whenever an endpoint schema, status code, persistence behavior, pagination contract, or filter name changes.

Do not update conventions merely to justify an inconsistent one-off implementation. Fix the implementation or propose a deliberate, reviewed convention change.
