# nForm Scope Boundary (Draft)

Purpose: Define what belongs to reusable nForm platform core versus what belongs to PATH/ISET solution logic.
Audience: Engineering and product owners shaping extraction and module boundaries.
Last Updated: 2026-04-29
Status: Historical draft. Treat the follow-up files named at the end as planned outputs unless they are created in a later nForm extraction thread.

## Working Definition
- `nForm`: Domain-agnostic platform for intake, workflow, notifications, events, storage, administration, and configurable workspaces.
- `PATH/ISET`: One domain-specific solution implemented on nForm, including ISET program rules, assessment, and case management.

## Primary Direction
- nForm must support multiple domains (not only ISET).
- First post-extraction implementation target is VAC appointments booking/management.
- Therefore, ISET-specific semantics must not remain hardcoded as platform defaults.

## Classification Matrix (Initial)

### nForm Core (In Scope)
- Authentication, authorization, role/permission framework.
- User lifecycle and user management foundation.
- Organization/tenant-aware configuration model (if present).
- Workflow/intake engine and intake editor runtime.
- Form rendering, schema/model handling, validation framework.
- Notification framework (channels, templates, delivery plumbing).
- Event framework (catalog, emitters, handlers, audit/event history).
- File/document storage abstraction and attachment lifecycle plumbing.
- Generic dashboard/workspace shell, filtering, sorting, table utilities.
- Shared API infrastructure (middleware, error handling, logging, telemetry).
- Shared UI components and design primitives.
- Cross-domain reporting framework (not ISET-specific report definitions).

### PATH/ISET Solution (Out of nForm Core)
- ISET-specific terminology, labels, and workflow copy.
- ISET assessment forms, scoring logic, and decision rules.
- ISET case status taxonomy and lifecycle-specific transitions.
- ISET-specific queues, workspace widgets, and operational dashboards.
- ISET-only SLA semantics and closure policies.
- ISET-specific notification templates/events/messages.
- ISET-specific exports, external integrations, and report definitions.
- ISET domain entities where meaning does not generalize to other solutions.

### Needs-Decision / Likely to Split
- Current "case management" implementation:
  - Keep generic case workspace primitives in nForm core.
  - Move ISET case workflows/widgets to `solutions/iset`.
- Event catalog:
  - Keep generic event engine in core.
  - Move domain event dictionaries to per-solution packages.
- Notification templates:
  - Keep template engine/runtime in core.
  - Move template content and trigger mapping to per-solution packages.
- Status systems:
  - Keep status framework/config capability in core.
  - Move concrete status sets and transition rules to solutions.

## VAC Appointments Implication
To support VAC appointments cleanly, nForm should expose reusable primitives:
- Appointment-capable intake/workflow configuration.
- Scheduling entities (service, slot, location, capacity, booking state).
- Generic participant/contact identity model.
- Domain-configurable dashboards replacing ISET-specific operational widgets.

## Boundary Rules (for extraction decisions)
When classifying code during manifest creation:
1. If capability is reusable across at least two domains (ISET + VAC), classify as nForm core.
2. If capability encodes ISET program policy or language, classify as PATH/ISET solution.
3. If shared utility currently imports ISET constants/logic, split utility and move domain parts out.
4. Prefer configuration-driven behavior in core over hardcoded domain branches.

## Open Questions
- Multi-tenant boundaries: confirm whether nForm is single-tenant now and whether VAC requires tenant isolation from day one.
- Scheduling stack: decide whether appointment booking is a native nForm module or a first-party solution module on top of nForm APIs.
- Data model ownership: define exact boundary between platform entities and solution entities in DB schema.

## Immediate Follow-up
1. Confirm whether the nForm extraction is still active.
2. If active, build `nform-dependency-map.md` with concrete file/module references.
3. Then build `nform-copy-manifest.md` tagging `keep` / `optional` / `drop` by path and record unresolved items in `needs-decision` with owner and due date.
