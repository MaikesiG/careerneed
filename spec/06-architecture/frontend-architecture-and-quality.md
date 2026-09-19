# Architecture: Frontend Standards, State Ownership, and UI Quality

> **Status:** Authoritative Frontend Standard  
> **Owner:** CareerNeed Frontend Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Next.js App Router boundaries, four-tier state ownership, loading/error/empty states, web accessibility, and safe AI text rendering.

---

## 1. Next.js Server and Client Component Boundaries

CareerNeed uses the Next.js App Router (`apps/web/app/`):

```text
Server Component (Layout / Shell)
      │
      ├── Ingests Server Context & Initial Data
      ├── Renders Static Layout & Metadata
      │
      ▼
Client Component ('use client')
      ├── Manages Interactive State (Modals, Forms, Tabs)
      ├── Subscribes to TanStack Query for Dynamic Mutations
      └── Handles Optimistic UI Updates
```

- **Boundary Invariant**: Keep server components as high in the tree as possible. Introduce `'use client'` only at interactive leaf components (e.g. `ApplicationStatusEditor`, `InterviewModal`, `JobFilterDrawer`).
- **Zero Secret Exposure**: Server components never pass unmasked environment variables or API keys down to client components.

---

## 2. Four-Tier State Ownership Standard

To eliminate state duplication and stale UI bugs, every piece of frontend data belongs to exactly one tier:

| State Tier | Responsible Tool | Use Cases | State Invariant |
|---|---|---|---|
| **1. Server State** | TanStack Query | Jobs, Applications, Interviews, Questions, Resumes, Contacts. | Never duplicated into local React state or global store. Relies on query invalidation. |
| **2. URL State** | Next.js Router / SearchParams | Active filters, sort keys, page offsets, active direction ID. | Single source of truth for list views. Back button and refresh must reproduce state. |
| **3. Form State** | React Hook Form + Zod | Application editing, interview question drafts, prep notes. | Managed locally in form hook; validated with Zod before network submission. |
| **4. Local UI State** | React `useState` | Modal open/close, accordion toggles, dropdown active item. | Component-scoped ephemeral state. |

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
