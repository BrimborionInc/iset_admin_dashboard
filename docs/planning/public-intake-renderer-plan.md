# Public Intake Renderer Reconstruction Plan
_Last updated: 2025-09-28_

## Overview
The goal is to rebuild the public intake renderer so it can consume the full legacy-driven schema published by the admin dashboard. This renderer must faithfully reproduce legacy behaviour (layout, validation, conditional visibility, submission wiring) while living inside the clean Vite/React codebase.

## Milestones
- **M0 – Planning & Tracking (current)**
  - Document scope, assumptions, open questions, and deliverables.
  - Align on terminology (`IntakeStep`, `IntakeComponent`, etc.).
  - Establish repo locations for renderer code, tests, fixtures.
  - Capture risks and validation strategy.
- **M1 – Schema & Types**
  - Parse the legacy/admin JSON into strongly-typed structures.
  - Handle nested components, option children, and conditional definitions.
  - Expose reusable utilities for resolving localized text, storage keys, visibility, etc.
- **M2 – Core Field Rendering**
  - Implement React renderers for paragraphs, inputs, textareas, selects, radios, checkboxes (incl. children), date inputs, file uploads.
  - Ensure GOV.UK classes/markup match legacy output.
  - Wire draft state updates + field-level errors.
- **M3 – Specialty Components & Layout**
  - Signature acknowledgement (`signature-ack`) interactions.
  - Summary lists & review sections.
  - Inset text, headings, validation messaging.
  - Conditional rendering & nested structures.
- **M4 – Validation & Conditions**
  - Respect required rules, custom messages, and predicate-based blockers.
  - Support dynamic validation for nested child components.
  - Integrate aggregated draft state for summary displays.
- **M5 – Draft & Submission Workflow**
  - Persist step data (save draft) and hydrate from `fetchIntakeDraft`.
  - Implement submission flow mirroring legacy portal behaviour.
  - Surface submission success screen + error handling.
- **M6 – QA & Rollout**
  - Add component/unit/integration tests for critical flows.
  - Create fixtures mirroring production schemas.
  - Document migration notes + deployment checklist.

## Current Status
- Schema parsing utilities and language resolution live in apps/web/src/features/intake/schema.ts.
- Renderer enforces conditional visibility for components and options; validation now skips hidden fields and option children unless their parents are selected.
- Component coverage expanded to include date-input, character-count, details, accordion, summary-list review panels, signature-ack text capture, and a disabled file-upload placeholder while storage wiring is pending.
- Summary lists respect hideEmpty/emptyFallback rules and derive values directly from stored form state, including nested child components.
- Submission flow saves drafts, resets to the first step after success, and surfaces a GOV.UK notification banner; navigation/confirmation hand-off still needs the final destination route.

## Next Actions
1. Replace the file-upload placeholder with real storage integration (API wiring, progress UI, remove disabled state).
2. Harden summary formatting/localisation (dates, currencies, arrays) and add unit coverage around the new helpers.
3. Round out UX polish with integration tests/a11y sweeps and connect the success path to the intended post-submit landing experience.

## Risks & Questions
- **Scope creep**: Ensure we only support component types actually emitted by admin dashboard.
- **Validation parity**: Need alignment on server vs client validation responsibilities.
- **Localized copy**: Confirm bilingual expectations for new components.
- **Upload UX**: Decide whether to stub uploads locally or integrate real storage adapter now.

## Tracking Progress
Update this doc after each milestone/slice is completed or reprioritized.

## Interview Notes (2025-09-28)
- Schema scope: renderer must support the full `SUPPORTED_COMPONENT_TYPES` list from admin dashboard (`radio`, `panel`, `input`, `text`, `email`, `phone`, `password`, `password-input`, `number`, `textarea`, `select`, `checkbox`, `checkboxes`, `date`, `date-input`, `label`, `paragraph`, `inset-text`, `warning-text`, `details`, `accordion`, `character-count`, `file-upload`, `summary-list`, `signature-ack`). Future types should be pluggable.
- Validation: mirror legacy behaviour; client enforces all rules authored in admin (required, predicate blockers, nested children) before draft save/submit.
- Conditional logic & summaries: reproduce legacy summary-list grouping, hideEmpty handling, and existing condition operators (`equals`, `notEquals`, `exists`, `notExists`, `>`, `<`). Design evaluation utilities to extend later if needed.
- File uploads: implement full upload workflow as legacy portal (real POSTs, same UX). No changes to drag/drop or multi-select semantics.
- Localization: fall back to English when bilingual copy is missing, matching current behaviour.
- Success criteria: new renderer must match legacy functionality end-to-end. Once validated in dev, old `X:\ISET\ISET-intake` workspace will be removed; no feature flags required.

## Operating Notes
- Avoid context/window overflows by querying files selectively (use `Select-String`, `rg`, or `-TotalCount` instead of dumping whole files). Summaries and targeted snippets keep the assistant responsive.






