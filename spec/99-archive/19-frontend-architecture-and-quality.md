---
status: archived
superseded_by: ../06-architecture/system-boundaries-and-integration-principles.md
reason: Archived historical frontend guidelines; referenced by system boundaries.
archived_date: 2026-09-19
---

> **ARCHIVED DOCUMENTATION**  
> This specification has been archived and superseded as part of the 2026-09-19 documentation consolidation.  
> It is preserved for historical decision context and provenance only. For current authoritative architecture, see [../06-architecture/system-boundaries-and-integration-principles.md](../06-architecture/system-boundaries-and-integration-principles.md).

# CareerNeed Frontend Architecture and Quality Standard

> **Version:** 1.0  
> **Status:** Required Before Broad Phase 3+ Frontend Expansion  
> **Priority:** P0  
> **Scope:** Next.js frontend architecture, state ownership, API client design, forms, validation, quality tooling, testing, errors, environment validation, CI, and production monitoring.

---

## 1. Purpose

CareerNeed will grow across Jobs, Career Directions, Candidate Profile, Resumes, Applications, Pipeline, Interviews, Follow-ups, AI Preparation, and Career Intelligence.

The primary frontend architecture risk is not the absence of Redux. It is mixing several categories of state:

```text
Server state
URL state
Form state
Client UI state
```

This standard defines clear ownership for each state category so that AI-assisted development remains reliable and maintainable.

---

## 2. Technology Baseline

| Concern                         | Standard                                                     | Purpose                                       |
| ------------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| Framework                       | Next.js + React + TypeScript                                 | Application framework                         |
| Styling                         | Tailwind CSS                                                 | Semantic design system                        |
| Component primitives            | shadcn/ui-compatible shared UI layer                         | Accessible reusable components                |
| Formatting                      | Prettier                                                     | Consistent formatting                         |
| Linting                         | ESLint                                                       | Code quality and framework rules              |
| Import ordering                 | `simple-import-sort` or equivalent ESLint rule               | Stable import organization                    |
| Server state                    | TanStack Query                                               | Fetching, caching, mutations, invalidation    |
| URL state                       | Next.js search parameters                                    | Filters, pagination, sort, selected direction |
| Lightweight global client state | Zustand only when needed                                     | Cross-page non-server UI state                |
| Complex global workflows        | Redux Toolkit only if evidence requires it                   | Deferred                                      |
| Forms                           | React Hook Form                                              | Form lifecycle and performance                |
| Client validation               | Zod                                                          | Form/input schema validation                  |
| API contract                    | FastAPI OpenAPI-generated TS types/client + feature wrappers | Backend/frontend consistency                  |
| Unit testing                    | Vitest                                                       | Fast unit tests                               |
| Component testing               | React Testing Library                                        | User-focused component tests                  |
| End-to-end testing              | Playwright                                                   | Cross-stack workflows                         |
| Git hooks                       | Husky + lint-staged                                          | Local quality feedback                        |
| Error monitoring                | Sentry or equivalent                                         | Production client/server error visibility     |
| Package management              | pnpm                                                         | Dependency/workspace consistency              |

---

## 3. State Ownership

### 3.1 Server State

Server state is owned by the backend and cached in TanStack Query.

Examples:

```text
Jobs
Companies
Job Sources
Job Match Results
Resumes
Resume Versions
Applications
Application Contacts
Interviews
Interview Questions
Follow-ups
Career Directions
Candidate Profile
AI Suggestions
Preparation generations
Notification records
```

Rules:

```text
Do not copy server state into Zustand.
Do not maintain a second manual global cache with useState.
Use TanStack Query query keys, queries, mutations, invalidation, and optimistic updates.
Use API response data as the source of truth.
```

### 3.2 URL State

URL state represents user-shareable, refresh-safe page state.

Examples:

```text
Jobs search keyword
Jobs provider filter
Jobs work-arrangement filter
Jobs posted-date filter
Jobs job-state filter
Jobs score threshold
Jobs sort
Jobs pagination
Selected Career Direction
Application list filters
Pipeline view selection
```

Examples:

```text
/jobs?careerDirectionId=<uuid>
/jobs?provider=ashby&provider=lever
/jobs?workplaceType=remote&workplaceType=hybrid
/jobs?jobState=saved&jobState=applied
/jobs?minMatchScore=80
/jobs?offset=25&limit=25
```

Rules:

```text
URL is the source of truth for list/search/filter/pagination state.
TanStack Query keys derive from normalized URL state.
Zustand must not duplicate URL filter state.
Do not place secrets, tokens, resume text, private notes, provider keys, or sensitive values in URLs.
```

### 3.3 Form State

Form state belongs to React Hook Form and Zod.

Examples:

```text
Create/Edit Application
Create/Edit Interview
Interview Question
Career Direction wizard
Resume labeling
Profile experience
Work authorization
Notification preferences
```

Rules:

```text
Use React Hook Form for non-trivial forms.
Use Zod schemas for client validation.
Backend Pydantic validation remains authoritative.
Map backend field errors safely where API supports them.
Do not put form draft state into TanStack Query or Zustand unless draft persistence is an intentional product feature.
```

### 3.4 Client UI State

Use component-local `useState` first. Use Zustand only for genuinely cross-page or cross-component UI state.

Examples suitable for local state:

```text
Dialog open/closed
Delete-confirmation target
Expanded interview card
Inline edit mode
Temporary tab selection
Tooltip visibility
Loading animation state
```

Examples potentially suitable for Zustand:

```text
Global command palette open state
Persistent sidebar collapse preference
Cross-page UI preferences
Multi-step wizard recovery state
Temporary non-URL workspace layout preference
```

Rules:

```text
Do not store Jobs/API resources in Zustand.
Do not store form field values in Zustand by default.
Do not introduce Redux Toolkit for simple UI coordination.
```

---

## 4. State Decision Table

| Question                                                                | Correct owner                |
| ----------------------------------------------------------------------- | ---------------------------- |
| Does backend own the data?                                              | TanStack Query               |
| Should refresh/share/back navigation reproduce it?                      | URL state                    |
| Is it an in-progress user form?                                         | React Hook Form + Zod        |
| Is it temporary local visual state?                                     | Component `useState`         |
| Is it cross-page, non-server, non-URL UI preference?                    | Zustand if needed            |
| Is it a complex multi-module client-only workflow with reducers/events? | Evaluate Redux Toolkit later |

---

## 5. Directory Architecture

Target structure:

```text
apps/web/src/
├── app/
│   ├── (auth)/
│   ├── dashboard/
│   ├── jobs/
│   ├── resumes/
│   ├── applications/
│   ├── interviews/
│   ├── career-directions/
│   ├── profile/
│   └── settings/
│
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
│
├── features/
│   ├── jobs/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── schemas/
│   │   ├── types/
│   │   └── utils/
│   ├── resumes/
│   ├── applications/
│   ├── interviews/
│   ├── career-directions/
│   ├── candidate-profile/
│   └── notifications/
│
├── lib/
│   ├── api/
│   │   ├── generated/
│   │   ├── api-error.ts
│   │   └── client.ts
│   ├── auth/
│   ├── query/
│   ├── validation/
│   ├── env/
│   └── utils/
│
├── stores/
├── hooks/
├── types/
└── test/
```

### 5.1 Placement Rules

```text
app/
Route entries, page composition, layouts, metadata, route-level loading/error boundaries.

features/
Feature-specific API wrappers, query keys, hooks, schemas, components, types, and utilities.

components/ui/
Shared low-level UI primitives.

components/layout/
Application shell, navigation, page layout components.

components/shared/
Cross-feature reusable presentation components.

lib/api/generated/
Generated OpenAPI client/types only. Do not manually edit generated files.

lib/api/
API client, API errors, auth-aware fetch, generated-client adapters.

stores/
Zustand stores only. No server-state cache.

test/
Test utilities, render wrappers, fixtures, mock server setup.
```

---

## 6. TypeScript Standards

Use strict TypeScript.

Recommended `tsconfig.json` options:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Rules:

```text
Do not use `any` except in tightly isolated, documented interop boundaries.
Prefer `unknown` plus runtime validation.
Do not use type assertions to silence API uncertainty.
Use generated API types where available.
Use discriminated unions for async/result/status states.
Avoid duplicate handwritten backend interfaces.
```

Allowed escape hatch:

```ts
// Reason: third-party library has incomplete type definitions.
const payload = value as ExternalLibraryPayload;
```

Every escape hatch should be local and justified.

---

## 7. API Contract and Typed Client

### 7.1 Source of Truth

```text
FastAPI Pydantic schemas
→ OpenAPI document
→ generated TypeScript client/types
→ feature API wrappers
→ TanStack Query hooks
→ UI
```

Do not manually maintain a duplicate API interface when generated types are available.

### 7.2 Generated Code Boundary

Generated output lives in:

```text
src/lib/api/generated/
```

Rules:

```text
Never manually edit generated code.
Regenerate from OpenAPI when backend contract changes.
Commit generated code only if repository policy requires it.
Feature code wraps generated client calls in feature-specific functions.
```

### 7.3 API Client

The shared API client must:

```text
Include credentials for authenticated calls.
Normalize safe errors into ApiError.
Support request cancellation through AbortSignal when appropriate.
Avoid exposing raw backend/provider error payloads to UI.
Avoid direct fetch duplication across pages/components.
```

Example:

```ts
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

### 7.4 Error Mapping

| HTTP status | Default UI behavior                           |
| ----------- | --------------------------------------------- |
| 401         | Session-expired/auth redirect behavior        |
| 403         | Safe permission message where used            |
| 404         | Safe resource-not-found/no-access message     |
| 409         | Conflict/stale-data recovery UI               |
| 422         | Form field errors or safe validation message  |
| 429         | Rate-limit/retry-later UI                     |
| 5xx         | Generic retryable error; report to monitoring |

Never display raw stack traces, provider error bodies, SQL errors, credentials, or internal implementation details.

---

## 8. TanStack Query Standards

### 8.1 Query-Key Factories

Every feature owns stable query keys.

Example:

```ts
export const interviewsKeys = {
  all: ['interviews'] as const,

  lists: () => [...interviewsKeys.all, 'list'] as const,

  list: (applicationId: string) =>
    [...interviewsKeys.lists(), { applicationId }] as const,

  details: () => [...interviewsKeys.all, 'detail'] as const,

  detail: (applicationId: string, interviewId: string) =>
    [...interviewsKeys.details(), { applicationId, interviewId }] as const,

  questions: (applicationId: string, interviewId: string) =>
    [
      ...interviewsKeys.all,
      'questions',
      { applicationId, interviewId },
    ] as const,

  preparation: (applicationId: string, interviewId: string) =>
    [
      ...interviewsKeys.all,
      'preparation',
      { applicationId, interviewId },
    ] as const,
};
```

Rules:

```text
Do not create ad hoc string query keys in components.
Do not use inconsistent keys for the same resource.
Query key parameters must be normalized.
URL-derived filters must be included in relevant Jobs query keys.
```

### 8.2 Feature API Layers

Example structure:

```text
features/interviews/
├── api/
│   ├── interviews.api.ts
│   ├── interviews.keys.ts
│   └── interviews.queries.ts
├── components/
├── hooks/
├── schemas/
├── types/
└── utils/
```

### 8.3 Mutation Invalidation

Never use broad invalidation by default:

```ts
queryClient.invalidateQueries();
```

Prefer precise invalidation:

```ts
queryClient.invalidateQueries({
  queryKey: interviewsKeys.questions(applicationId, interviewId),
});
```

Invalidate related data only when needed:

```ts
applicationsKeys.detail(applicationId);
interviewsKeys.list(applicationId);
dashboardKeys.todo();
```

### 8.4 Optimistic Updates

Use optimistic updates only where:

```text
The operation is reversible.
The prior cache can be safely restored.
Conflict behavior is understood.
The UI benefits materially from immediate feedback.
```

Good candidates:

```text
Save/dismiss Job
Mark Follow-up complete
Update simple Application status
Toggle local preference
```

Avoid optimistic updates for:

```text
AI generation
File upload
Destructive operations without clear restore behavior
Complex multi-entity transitions
```

### 8.5 Query Defaults

Set project-wide defaults intentionally.

Example policy:

```text
Retry transient read failures a limited number of times.
Do not endlessly retry 401/403/404/422 errors.
Use stale time appropriate to feature volatility.
Avoid refetch-on-window-focus for expensive AI/history data unless justified.
Cancel obsolete Jobs filter queries where possible.
```

---

## 9. Forms and Validation

### 9.1 React Hook Form

Use React Hook Form for:

```text
Create/Edit Interview
Interview Question
Application editor
Career Direction editor
Resume metadata
Candidate Profile sections
Work authorization
Settings
Notification preferences
```

### 9.2 Zod

Each feature keeps UI validation schemas close to feature code:

```text
features/interviews/schemas/interview-question.schema.ts
features/career-directions/schemas/career-direction.schema.ts
```

Rules:

```text
Zod improves immediate user feedback.
Pydantic backend validation remains authoritative.
Keep client and server validation semantics aligned.
Do not expose backend internal validation implementation.
Map field errors safely when backend supports structured errors.
```

### 9.3 Form Submission

Submission behavior:

```text
Disable/guard duplicate submit.
Show inline validation.
Show pending state.
Normalize API errors.
Invalidate/update relevant TanStack Query cache after success.
Preserve user input on retryable server failure where appropriate.
```

---

## 10. Server and Client Component Boundaries

### 10.1 Server Components

Prefer Server Components for:

```text
Layouts
Metadata
Static shell
Read-only route composition
Public/static data when appropriate
```

### 10.2 Client Components

Use Client Components for:

```text
Authenticated interactive fetching
TanStack Query
Forms
Mutations
Dialogs/drawers
Drag-and-drop
Local UI state
Live filtering
Optimistic updates
```

Rules:

```text
Do not mark an entire route tree `use client` merely for one interactive component.
Keep client boundaries as small as practical.
Do not duplicate server-fetched and Query-fetched copies of the same private resource without an explicit hydration/prefetch design.
```

---

## 11. Error Boundaries and Loading

### 11.1 Route-Level Boundaries

Use Next.js route-level:

```text
loading.tsx
error.tsx
not-found.tsx
```

where appropriate.

### 11.2 Feature-Level Errors

Feature components must show:

```text
Loading state
Empty state
Retryable error state
Permission/not-found state where relevant
Mutation pending state
Validation errors
Success feedback where action outcome is not obvious
```

### 11.3 Error Boundary Rules

```text
Use Error Boundaries for unexpected rendering failures.
Use TanStack Query error handling for request/mutation failures.
Do not catch every error and reduce it to an unhelpful generic string.
Do not show raw API/provider stack traces to users.
Report unexpected errors to Sentry/monitoring with safe context.
```

---

## 12. Testing Standard

### 12.1 Unit Tests

Use Vitest for:

```text
Pure utilities
URL filter normalization
Date/time formatting
Query-key factories
Form payload builders
Validation schemas
Error mapping
Feature business logic
```

### 12.2 Component Tests

Use React Testing Library for:

```text
Forms
Dialogs
Loading/empty/error states
Question manager
Interview preparation review
Jobs filters
Application status actions
Accessibility interaction
```

Test user behavior rather than implementation internals.

### 12.3 API Mocking

Use an API mocking layer such as MSW where useful.

Rules:

```text
Mock network boundaries, not internal component functions.
Use realistic response/error shapes.
Cover 401, 404, 409, 422, 429, and 5xx UI behavior for key workflows.
```

### 12.4 End-to-End Tests

Use Playwright for high-value user workflows:

```text
Registration/login/logout
Password reset flow in test environment
Create/edit application
Change application status
Schedule/complete interview
Create/edit/delete Interview Question
Open safe LeetCode link
Create/follow-up completion
Jobs filter URL persistence
Career Direction selection
AI generation fallback/review flow using test provider/mocks
```

Do not use production provider credentials in E2E tests.

### 12.5 Test Commands

Preferred scripts:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

---

## 13. Formatting and Linting

### 13.1 Prettier

Use Prettier as the formatting authority.

Rules:

```text
No manual formatting arguments in code review.
Run formatting automatically on staged files.
Keep Prettier config versioned.
Use one newline/line-ending policy across environments.
```

### 13.2 ESLint

ESLint should enforce:

```text
Next.js rules
React hooks rules
TypeScript safety rules
Import ordering
No unused imports/variables
No accidental any
No direct unsafe environment access outside env module
Accessibility rules where supported
```

### 13.3 Imports

Use `simple-import-sort` or equivalent.

Recommended order:

```text
1. React/Next/external packages
2. Absolute internal imports
3. Relative imports
4. Type-only imports where applicable
```

Do not manually rearrange imports inconsistently across files.

---

## 14. Git Hooks

Use Husky and lint-staged.

Suggested pre-commit behavior:

```text
Prettier on staged supported files
ESLint fix/check on staged frontend files
Typecheck or targeted validation where fast enough
```

Suggested pre-push or CI behavior:

```text
pnpm lint
pnpm typecheck
pnpm test
```

Hooks improve local feedback but do not replace CI.

---

## 15. Environment Validation

Environment variables must be validated at startup/build time.

Do not scatter:

```ts
process.env.NEXT_PUBLIC_API_URL;
```

through feature components.

Create:

```text
src/lib/env/client.ts
src/lib/env/server.ts
```

Example client environment schema:

```ts
import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});
```

Rules:

```text
Client variables require NEXT_PUBLIC_ prefix.
Server-only secrets must never be imported into client components.
Local .env files are never committed.
Use .env.example with safe placeholders.
```

---

## 16. Error Monitoring

Production error monitoring should use Sentry or equivalent.

Capture:

```text
Unhandled client errors
Route error-boundary failures
Unhandled API failures
Performance traces where privacy-safe
Release version
Environment
Safe route metadata
```

Do not capture:

```text
Passwords
Tokens
Cookies
Authorization headers
Reset URLs
Provider API keys
Full resumes
Full interview notes
Full job descriptions
Private contact data
```

Use before-send scrubbing/redaction.

---

## 17. CI Quality Gate

### 17.1 Pull Request Gate

At minimum, run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run targeted Playwright tests for affected critical workflows where CI time allows.

### 17.2 Main/Nightly Gate

Run:

```bash
Full Playwright suite
Dependency/security scan
Accessibility checks
Production-like build
Broader integration tests
Performance/Lighthouse checks where configured
```

### 17.3 AI-Agent Rule

Code produced by Claude, Codex, Gemini, or any other agent follows the exact same quality gate as human-written code.

```text
Agent speed increases the need for automated verification.
No agent-generated code bypasses formatting, linting, types, tests, build, review, or security checks.
```

---

## 18. Redux Decision

Redux Toolkit is intentionally deferred.

Do not add Redux merely because the product has many pages or entities.

Add
