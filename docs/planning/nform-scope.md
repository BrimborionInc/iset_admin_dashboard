# nForm Scope Boundary (Draft)

Purpose: Define what belongs to reusable nForm platform core versus what belongs to PATH/ISET solution logic.
Audience: Engineering and product owners shaping extraction and module boundaries.
Last Updated: 2026-07-21
Status: Active product-boundary draft. Extraction resumed on 2026-07-21; use this with `docs/planning/nform-extraction-plan.md` as the persistent handoff for the current work.

## Working Definition
- `nForm`: Domain-agnostic platform for intake, workflow, notifications, events, storage, administration, and configurable workspaces.
- `PATH/ISET`: One domain-specific solution implemented on nForm, including ISET program rules, assessment, and case management.

## Primary Direction
- The defining nForm capability is codeless intake-wizard authoring and management by policy makers.
- nForm must support multiple domains (not only ISET).
- First post-extraction implementation target is VAC appointments booking/management.
- Therefore, ISET-specific semantics must not remain hardcoded as platform defaults.
- nForm v1 is an empty, self-contained project template from which new solutions are independently forked.
- VAC is a validation case after extraction, not the source of the vanilla platform definition.
- Do not include sample workflows, dashboards, or demo data in the template.
- Prefer configuration for genuinely declarative behavior and ordinary solution modules/code for domain behavior. A fully configurable multi-solution platform is not required for v1.

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
  - Keep only generic workspace/dashboard composition primitives in nForm core.
  - Treat cases, case relationships, and ISET case workflows/widgets as PATH solution code.
- Event catalog:
  - Keep generic event engine in core.
  - Move domain event dictionaries to per-solution packages.
- Notification templates:
  - Keep template engine/runtime in core.
  - Move template content and trigger mapping to per-solution packages.
- Status systems:
  - Keep status framework/config capability in core.
  - Move concrete status sets and transition rules to solutions.

## VAC Validation Boundary

- VAC remains the first expected downstream project used to test whether the template is genuinely reusable.
- Appointment, service, slot, location, capacity, booking-state, customer, and contact business models belong to the VAC solution, not nForm core.
- nForm should supply configurable intake journeys, identities, submissions, documents, events, notifications, and workspace/dashboard composition that VAC can use without importing PATH concepts.

## Boundary Rules (for extraction decisions)
When classifying code during manifest creation:
1. If capability is reusable across at least two domains (ISET + VAC), classify as nForm core.
2. If capability encodes ISET program policy or language, classify as PATH/ISET solution.
3. If shared utility currently imports ISET constants/logic, split utility and move domain parts out.
4. Prefer configuration-driven behavior in core over hardcoded domain branches.

## Open Questions
- No product-boundary question currently blocks the dependency/coupling audit. Record new questions only when repository evidence exposes a real business ambiguity.

## Infrastructure Boundary

- nForm v1 retains the current AWS service and deployment model, including Cognito, S3, and SES.
- AWS resource identifiers, credentials, domains, and environment differences must be supplied through deployment/environment configuration rather than PATH-specific constants.
- Cloud-neutral providers are not a v1 requirement, though extracted service boundaries should avoid unnecessary AWS coupling outside their infrastructure adapters.

## Tenancy Boundary

- nForm v1 is single-tenant per deployment.
- Each derived solution uses its own configured organization, AWS resources, application environment, and database rather than sharing one runtime across customer tenants.
- First-class tenant IDs, tenant partitioning, tenant switching, and cross-tenant administration are not v1 requirements.

## Data Model Boundary

- nForm core must not impose generic `client`, `case`, `application`, `appointment`, or equivalent business-domain records.
- Core owns user/authentication identities, configurable intake definitions and submissions, intake-journey execution state, documents/attachments, notifications, events/audit, configuration, and generic administration infrastructure.
- Each derived solution owns its business entities and relationships and connects them to core infrastructure through explicit identifiers and extension points.
- PATH/ISET client/case/application schemas are solution code and must not survive in the vanilla database merely under generic labels.

## Role Boundary

- `System Administrator` is the only built-in nForm role.
- Derived solutions define every business role, permission bundle, organizational label, and assignment rule.
- PATH roles such as NWAC Administrator, Regional Manager, and ISET Coordinator must not remain as platform defaults or hidden authorization branches. Finance is an external business/integration boundary, not a PATH role, and must likewise not become an nForm authorization branch.

## Portal and Identity Boundary

- nForm always includes two first-class surfaces: a staff portal for internal operators and a public portal for external users.
- Core owns the authentication/user-lifecycle infrastructure for both internal and external identity populations.
- Platform code and schema use generic identity/surface language. Derived solutions supply business labels such as staff member, applicant, client, participant, customer, or service user.
- Internal business roles remain solution-defined; the existence of the staff portal does not introduce PATH roles into core.

## Public Authentication Boundary

- Each public workflow can permit anonymous use or require an authenticated external-user account.
- Account creation is not a global prerequisite for using the public portal.
- Authentication mode is workflow configuration; derived solutions choose it according to continuity, sensitivity, saved-progress, and identity-assurance requirements.
- Anonymous workflows still require server-side validation, privacy controls, rate/abuse protection, and an explicit submission lifecycle.

## Codeless Authoring Boundary

- Staff-portal visual intake-wizard authoring, preview, versioning, publication, and rollback are first-class nForm core capabilities.
- Authorized policy makers can draft and publish intake changes without modifying application code or waiting for normal code build/deployment cycles.
- Authors compose workflows only from platform-approved components, rules, and integrations; arbitrary executable code is not an authoring feature.
- Core must validate authored definitions before publication and retain immutable version history, publisher identity, timestamps, audit evidence, and a reliable rollback path.
- Codeless publication avoids repeated code-level security review for ordinary authored changes because the authoring system enforces the security/privacy boundary. It does not remove access control, privacy assessment, audit, or solution governance requirements.
- Publication governance is configurable: authorized authors may publish directly, or a solution may require distinct author, reviewer, and publisher permissions and transitions.
- Codeless workflow configuration governs the public intake journey: steps, branching, validation, authentication mode, save/resume behavior, and submission.
- Generic staff review stages, task lifecycles, cases, work queues, and downstream business-process orchestration are not part of the nForm core contract.
- Derived solutions decide what a submission creates or triggers, such as a booking, registration, payment, request, domain record, integration event, or no persistent business object beyond the submission itself.

## Submission Management Boundary

- Core includes a neutral staff-side submissions registry for authorized viewing, search/filtering, export, attachment access, audit, and retention operations.
- Core owns the durable submission envelope, its intake-definition/version provenance, submitter identity when present, timestamps, captured answers, attachments, and platform lifecycle/audit metadata.
- A core submission is not a client, case, application, appointment, task, or business-process instance.
- Derived solutions own every downstream domain record, status model, action, assignment, queue, and integration-specific outcome created from a submission.

## Immediate Follow-up
1. Build `nform-dependency-map.md` with concrete file/module references.
2. Then build `nform-copy-manifest.md` tagging `keep` / `split` / `drop` by path and record genuine unresolved items in `needs-decision`.
