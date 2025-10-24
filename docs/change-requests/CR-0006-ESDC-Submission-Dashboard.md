# Change Request CR-0006 — ESDC Submissions Module

## Context
- **Business driver:** ISET partners must deliver both ILMP participant payloads and agreement-level reporting packages that meet ESDC validation rules before each submission window.
- **Current state:** The `ApplicationCaseDashboard` mixes assessment tasks with compliance needs and offers no queue, readiness view, or audit trail for submissions.
- **Reference material:** `docs/data/ESDC/ILMP-data-exchange-guide/content.xml` and `docs/data/ESDC/ILMP-standard-data-file/content.xml`.

## Problem Statement
Administrators lack a dedicated workspace to:
- monitor all client and reporting submissions awaiting export,
- run authoritative validation checklists with actionable remediation,
- preview and download submission artefacts,
- trace who submitted what, when, and with what result.

## Goals
1. MVP module that surfaces submission workload, validation status, and history for participants and reporting packages.
2. Dedicated per-participant workspace for ILMP readiness (client + action plan segments).
3. Provide audit history while keeping the existing case board uncluttered.

## Non-Goals
- Automating upstream data fixes (remains in existing workflows).
- Implementing transport to ESDC endpoints (future phase).
- Delivering batch automation; MVP focuses on visibility, validation, download, and logging.

## Proposed Solution
- Add an `ESDC Submissions` module with three dashboards plus a participant workspace route:
  - `/esdc/overview`: KPIs, deadlines, quick links.
  - `/esdc/participants`: queue, validation summary, recent activity, launch workspace at `/esdc/participants/:clientId`.
  - `/esdc/reporting`: quarterly/annual reporting checklist and history.
- Mirror the finance scaffolding pattern (Cloudscape board, widget registry, palette, localStorage persistence, help content, mock data). No backend changes in this CR.
- Access control: limit to System Administrators and Program Administrators via role matrix defaults.
- Future stories reuse the scaffolds to call dedicated submission APIs (validation, payload generation, history).

## Dependencies & Assumptions
- Backend endpoints will be delivered later; current work is frontend scaffolding.
- Reference data (province ↔ postal prefix, reporting templates) becomes available before wiring validation.
- Participant workspace will respect application locking once editing is enabled.

## Risks & Mitigations
- **Duplicate logic** between forms and validation → centralize rules when backend work begins.
- **Context switching friction** → deep-link from case board and queue, maintain breadcrumbs.
- **Scope creep into transport** → keep MVP focused on monitoring, validation, download, logging.

## Open Questions
1. How will administrators prioritise multiple pending participant submissions (is batching required later)?
2. What minimum metadata must submission history capture for compliance (user, payload hash, external ids, notes)?
3. Where are reporting packages stored/generated (S3 object vs on-demand build) to inform widget design?

## Next Steps
- Socialize revised scope with product/operations.
- Scaffold overview, participants, reporting dashboards and participant workspace using the standard board template.
- Author help panel content and AI context strings for each dashboard/widget.
- Plan follow-on stories for backend integration (validation APIs, payload generation, submission logging).
