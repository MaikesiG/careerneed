# Architecture: Frontend Standards, State Ownership, and UI Quality

> **Status:** Authoritative Frontend Standard  
> **Owner:** CareerNeed Frontend Engineering  
> **Last Updated:** 2026-09-20  
> **Scope:** Next.js App Router boundaries, current state ownership, loading/error/empty states, web accessibility, and safe AI text rendering.

---

## 1. Next.js Server and Client Component Boundaries

CareerNeed uses the Next.js App Router (`apps/web/src/app/`):

```text
Server Component (Layout / Shell)
      │
      ├── Ingests Server Context & Initial Data
      ├── Renders Static Layout & Metadata
      │
      ▼
Client Component ('use client')
      ├── Calls the route-local `apiFetch` client
      ├── Owns loading, error, empty, form, and disclosure state
      └── Uses request guards and abort/mounted checks where needed
```

- **Boundary Invariant**: Keep server components as high in the tree as possible. Introduce `'use client'` only at interactive leaf components (e.g. `ApplicationStatusEditor`, `InterviewModal`, `JobFilterDrawer`).
- **Zero Secret Exposure**: Server components never pass unmasked environment variables or API keys down to client components.

---

## 2. Current state and request ownership

The current implementation uses route-local `apiFetch` calls and component-owned state. Client
components use `useState`, `useRef`, `useCallback`, and `useEffect` for loading/error/empty states,
forms, disclosure, in-flight guards, cancellation, and stale-response protection.

- Visible URL parameters are for user-controlled, shareable, restorable page state such as list
  filters, sorting, and pagination.
- Browser timezone is API-only request context. Transient dialogs, disclosure state, pending form
  state, and timezone **MUST NOT** be added to visible query parameters.
- Global state SHOULD be avoided unless a demonstrated cross-route ownership problem requires it.
- A query/cache library or form library MAY be adopted later when measured complexity justifies
  it. TanStack Query, React Hook Form, and Zod are not mandatory current architecture.

### Route-local FollowUp synchronization

Application Detail lifts a numeric `followUpsRevision` and stable `onFollowUpsChanged` callback to
`ApplicationDetailClient`. Successful canonical mutations update the mutating component locally,
then increment the revision once. Other mounted Application or Interview FollowUp sections refetch
their own scope once per external revision while ignoring their own notification. Implementations
use in-flight, mounted, and abort protections and **MUST NOT** introduce a global event bus or cache
for this route-local requirement.

### Interview workspace disclosure ownership

Questions, Participants, and Interview Follow-ups each own their single disclosure control in the
corresponding child component. Parent visual containers **MUST NOT** duplicate heading, count,
Show/Hide text, caret, disclosure state, or accessibility relationship. See
[Interviews and preparation](../02-current-product/interviews-and-preparation.md).

---

## 3. Standardized UI State Handling

Every data-driven view (Jobs, Applications, Interviews, Contacts) must explicitly implement four discrete visual states:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MANDATORY COMPONENT STATES                         │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ 1. Loading State    │ Semantic skeleton loaders matching final layout;      │
│                     │ zero jarring layout shift (CLS).                      │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 2. Success State    │ Clear data presentation with high information density │
│                     │ and touch-friendly interactive targets (>=44px).      │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 3. Empty State      │ Friendly illustration, clear explanation, and a direct│
│                     │ primary action button (e.g. "Add your first job").    │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 4. Error State      │ Human-readable error banner with a "Retry" button.    │
│                     │ Never display raw stack traces or JSON exceptions.    │
└─────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 4. Web Accessibility Standards (WCAG 2.1 AA)

CareerNeed enforces accessible web standards across all desktop and mobile views:
1. **Keyboard Navigability**: All interactive elements (buttons, links, inputs, modals) are fully accessible via keyboard (`Tab`, `Enter`, `Space`, `Escape`). Modals trap focus when open and restore focus on dismiss.
2. **Accessible Labels**: Form inputs pair with `<label>` elements or have explicit `aria-label` attributes.
3. **Contrast Ratios**: Normal text maintains a minimum contrast ratio of 4.5:1 against its background; large text maintains 3:1 in both light and dark themes.
4. **Semantic HTML**: Standard semantic landmarks (`<main>`, `<nav>`, `<header>`, `<section>`, `<article>`) are used throughout.

---

## 5. Safe AI Text Rendering Protocol

Because AI models generate advisory text that may contain markdown or user-pasted quotes:

1. **Zero `dangerouslySetInnerHTML`**: Injecting raw HTML strings via `dangerouslySetInnerHTML` is strictly prohibited.
2. **Sanitized Markdown AST**: Markdown rendering uses parsed AST components (e.g. `react-markdown`) with strict HTML tag stripping enabled.
3. **Auto-Escaped JSX**: All dynamic variables in React components are escaped automatically by the JSX engine.
4. **Safe Link Targets**: Any external URLs rendered in job descriptions or interview questions (such as validated LeetCode links) must include `rel="noopener noreferrer"` and `target="_blank"`.
