# nForm Extraction Plan

Purpose: Define a repeatable plan to extract nForm-related functionality from the current PATH-aligned workspace into the standalone WSL repository at `/home/bill/nForm`. The older `X:\nForm` / `/mnt/x/nForm` target is historical.
Audience: Engineering and operations teams maintaining PATH, nForm, and shared services.
Last Updated: 2026-07-23
Status: Active implementation in the standalone `/home/bill/nForm` repository.

## Current Product Direction (2026-07-21)

- nForm v1 is a vanilla, reusable project template extracted from PATH.
- nForm's defining product capability is codeless intake-wizard authoring and management: authorized policy makers can draft, preview, version, and publish intakes without application code changes or normal software release cycles.
- Retain nForm infrastructure; remove PATH/ISET/NWAC solution code, configuration, terminology, workflows, reports, and data.
- The template is an empty operational platform, not a demonstration product. Do not include sample workflows, dashboards, users, or demo data.
- The only initially provisioned user may be the System Administrator `bill@sillery.co.uk`. Provision that identity through deployment/bootstrap configuration, not hardcoded application authorization logic.
- The template baseline includes authentication and user administration, codeless forms/intake-journey infrastructure, permissions, notifications, documents/storage, events/audit, configurable dashboard/workspace composition, shared API infrastructure, and generic administration. It does not presume a downstream case-management/task workflow.
- nForm always has two first-class application surfaces at its core: a staff portal for internal operators and a public portal for external users. Use generic platform language; derived solutions supply labels such as staff, applicant, client, customer, or participant.
- Package the admin application, public intake application, shared code, and database migrations in one self-contained nForm repository. New solutions may begin as independent forks of that repository.
- A configuration-plus-extension platform remains a possible later evolution. Do not force PATH domain behavior into configuration during the v1 extraction.
- VAC appointment booking remains the first expected real project created from nForm, but it is a later validation case and must not define the vanilla extraction scope.

### Next unresolved decision

- No product decision is currently blocking the dependency/coupling audit. Codex should proceed with engineering recommendations and return to Bill only for genuine business/product ambiguities or consequential tradeoffs.

## Implementation Checkpoint (2026-07-23)

- Created a separate local Git repository at `/home/bill/nForm` on branch `main`; no remote or AWS resource was created.
- Added npm-workspace boundaries for staff portal, public portal, API, and reusable packages.
- Added the clean squashed baseline migration described by `docs/planning/nform-v1-schema-and-extension-contract.md`.
- Added repository-local product memory, empty-template guardrails, and boundary tests.
- `npm run check` passes in `/home/bill/nForm`: required neutral tables exist; solution-domain tables/foreign keys and seeded intake/submission data are absent; forbidden runtime PATH coupling is absent.
- Initial local commit `65d4906` records the repository/schema scaffold.
- Local commit `c3eba1d` adds the first real extracted subsystem: a canonical versioned component registry plus deterministic intake compiler/validator shared-contract foundation.
- The intake contract tests cover anonymous/authenticated save rules, exact component versions/properties, unique response keys, route targets, reachability, termination, and deterministic publication checksums.
- Local commit `ecf4a3d` adds the framework-independent staff authoring domain service and repository port.
- The authoring service now covers empty-intake creation, incomplete draft saving, optimistic concurrency, validation, direct publication, strict separated author/reviewer/publisher governance, immutable versions, automatic next-draft creation, and rollback through appended publication history.
- Forward migration `0002_intake_authoring_controls.sql` records publication policy, draft lock version, publication-request release notes, and the non-unique checksum index required for rollback history.
- `npm run check` passes after the authoring slice; the next implementation boundary is the MySQL repository/HTTP API, followed by the staff editor UI.
- Application extraction remains in progress. The new repository is not yet a runnable product and has no remote.

## Historical Session Checkpoint (2026-07-21)

This checkpoint is retained only as history. Its discovery questions and
no-repository state were superseded by the implementation checkpoint above.

## Context Snapshot
Current top-level workspace (`/mnt/x/ISET`) includes multiple repositories/folders:
- `admin-dashboard`
- `ISET-intake`
- `iset-public-portal`
- `shared`
- `intacct-mock-service`
- Additional workspace/config artifacts

Historical extraction target:
- `X:\nForm` (`/mnt/x/nForm`) was planned in the Windows-mounted checkout era.

Current extraction target:
- `/home/bill/nForm`

## Objectives
- Isolate nForm features and dependencies from PATH-oriented code.
- Copy only required elements into the new workspace.
- Reduce cruft (dead code, legacy scripts, stale docs, one-off artifacts).
- Preserve runtime behavior for nForm workflows during and after extraction.

## Non-Objectives (Phase 1)
- Full toolchain migration (for example, Webpack to Vite) before extraction stabilizes.
- Broad architecture redesign unrelated to nForm extraction.
- Rewriting stable modules solely for style/structure.

## Guardrails
- Keep `npm` as package manager during extraction.
- Prefer minimal-change stabilization first, then optional modernization.
- Do not remove or mutate PATH source of truth until nForm workspace is validated.
- Use a manifest-driven copy process so extraction is auditable and repeatable.

## Extraction Strategy
Original strategy: `A -> B`
- `A` (bootstrap): Copy the full working codebase into `X:\\nForm` first to preserve runtime behavior.
- `B` (refine): Remove PATH/ISET-specific capabilities selectively using a reviewed manifest.

Why this strategy:
- Reduces risk of missed hidden dependencies during initial move.
- Keeps a runnable baseline while classification and cleanup proceed.
- Produces a safer path to the same end-state as pure selective copy.

Not selected for Phase 1:
- Pure `B` from day one (copy only nForm subsets) because dependency misses are more likely and recovery is slower.

Current strategy note (2026-07-21): re-evaluate copy-then-prune after the dependency/coupling map. The target is a credible empty platform template, not an ISET application with its labels removed. Do not perform a bulk copy until the target repository structure and keep/split/drop manifest are approved.

## Phase Plan

### Phase 1: Scope Definition
Deliverables:
- `docs/planning/nform-scope.md`
- In/out matrix identifying nForm vs PATH-only areas.

Actions:
1. Identify all user-facing nForm capabilities and related backend flows.
2. Classify modules as `in`, `out`, or `needs-decision`.
3. Capture open questions blocking classification.

Exit Criteria:
- Scope reviewed and approved.

### Phase 2: Dependency Inventory
Active deliverables:
- `docs/planning/nform-dependency-map.md`

Actions:
1. Map frontend entry points, routes, widgets, and shared components used by nForm.
2. Map backend endpoints, services, data access, jobs, and integrations.
3. Identify cross-repo dependencies (`shared`, `ISET-intake`, `iset-public-portal`, etc.).

Exit Criteria:
- Known runtime and build dependencies documented.

### Phase 3: Copy Manifest
Active deliverables:
- `docs/planning/nform-copy-manifest.md`
- `docs/planning/nform-copy-manifest.json`

Actions:
1. Build file/folder list tagged `keep`, `optional`, `drop`.
2. Mark owner/rationale for each ambiguous area.
3. Add exclusion rules for obvious cruft (temp logs, backups, one-off patches, generated noise).

Exit Criteria:
- Manifest approved for dry run.

### Phase 4: Dry-Run Extraction
Planned deliverables:
- Dry-run copy log
- `docs/planning/nform-extraction-dry-run.md`

Actions:
1. Create `/mnt/x/nForm` structure.
2. Perform full bootstrap copy of source workspace into `/mnt/x/nForm` (strategy `A`).
3. Produce before/after tree and file count summary.

Exit Criteria:
- Dry run completes with a runnable baseline in `/mnt/x/nForm`.

### Phase 5: Selective Prune (A -> B)
Planned deliverables:
- `docs/planning/nform-prune-manifest.md`
- `docs/planning/nform-prune-log.md`

Actions:
1. Apply manifest-driven removals for PATH/ISET-specific modules.
2. Remove known cruft categories (stale backups, temp logs, one-off patch files, obsolete docs).
3. Track each removal with rationale and rollback note.

Exit Criteria:
- PATH/ISET-specific code is removed or isolated; nForm core remains runnable.

### Phase 6: Standalone Stabilization
Planned deliverables:
- Working `nForm` workspace with updated local config
- `docs/planning/nform-stabilization-notes.md`

Actions:
1. Fix imports/path aliases/package scripts/config references.
2. Replace PATH-coupled config defaults with nForm-specific values.
3. Remove unresolved PATH-only references.

Exit Criteria:
- Local install/build/start succeeds for core nForm flows.

### Phase 7: Validation and Cleanup
Planned deliverables:
- `docs/planning/nform-validation-report.md`
- `docs/planning/nform-cruft-removal-log.md`

Actions:
1. Run available tests/lint/build checks.
2. Smoke-test key nForm workflows.
3. Remove dead files and stale docs discovered during validation.

Exit Criteria:
- No blocker defects for baseline nForm operation.

### Phase 8: Handoff and Next Modernization Step
Planned deliverables:
- `docs/planning/nform-handoff-summary.md`
- Optional `docs/planning/nform-vite-migration-plan.md`

Actions:
1. Publish final keep/drop report and risk register.
2. Decide on post-stabilization migration (for example, Vite).

Exit Criteria:
- nForm extraction complete and ready for ongoing iteration.

## Decision Log (to maintain during execution)
- Decision: Deliver nForm v1 as a standalone empty project template with deliberate future platform seams.
  - Reason: Produces a useful asset without first converting all PATH domain code into a configuration language.
  - Date: 2026-07-21
- Decision: Remove the PATH/ISET/NWAC solution while retaining the generic nForm infrastructure baseline listed above.
  - Reason: This is the agreed product boundary for the vanilla template.
  - Date: 2026-07-21
- Decision: Use one self-contained repository for admin, public intake, shared code, and database migrations.
  - Reason: A reusable template should not inherit the current cross-repository PATH coupling.
  - Date: 2026-07-21
- Decision: Ship no demonstration configuration or sample data.
  - Reason: nForm is a project template, not a demo product.
  - Date: 2026-07-21
- Decision: Treat VAC appointments as the first downstream validation project, not as the definition of nForm core.
  - Reason: Vanilla scope must stand independently; VAC later tests whether ISET assumptions were genuinely removed.
  - Date: 2026-07-21
- Decision: Retain the current AWS service and deployment model for nForm v1, including Cognito, S3, and SES, with environment-specific resource configuration.
  - Reason: Cloud-neutral replacement would expand extraction into an unrelated infrastructure rewrite; provider boundaries may remain clean without making alternate clouds a v1 requirement.
  - Date: 2026-07-21
- Decision: Make nForm v1 single-tenant per deployment.
  - Reason: New solutions will use separate forks/environments, and first-class multi-tenant partitioning is not required for the initial reusable template.
  - Date: 2026-07-21
- Decision: Keep business entities such as clients, cases, applications, and appointments out of nForm core.
  - Reason: Those nouns impose solution-specific domain models. Core owns identities, form definitions/submissions, workflow instances/tasks, documents, events, and supporting infrastructure; derived solutions add their own business records.
  - Date: 2026-07-21
- Decision: Make `System Administrator` the only built-in nForm role; all business roles and their permissions are solution-defined.
  - Reason: The platform needs one bootstrap administration authority but must not carry PATH organizational roles into derived solutions.
  - Date: 2026-07-23
- Decision: Make the staff portal and public portal permanent first-class nForm surfaces, with generic internal-operator and external-user identity populations in core.
  - Reason: Both sides are fundamental to nForm rather than PATH-specific product features; solution terminology and business roles remain outside core.
  - Date: 2026-07-23
- Decision: Support both anonymous and authenticated public workflows, selected per workflow by the derived solution.
  - Reason: Simple public forms must not require accounts, while sensitive, resumable, or identity-bound journeys can require external-user authentication.
  - Date: 2026-07-23
- Decision: Make codeless staff-portal intake-wizard authoring, preview, versioning, and publication the defining nForm core capability.
  - Reason: Policy makers must be able to create and change public intakes without application code changes or normal software release cycles.
  - Date: 2026-07-23
- Decision: Keep authored publication safe through platform-enforced components, validation, permissions, version history, audit, rollback, and privacy controls.
  - Reason: Avoiding code-change security reviews depends on constrained, secure-by-construction authoring; it does not make authored workflows exempt from security and privacy governance.
  - Date: 2026-07-23
- Decision: Make publication governance configurable.
  - Reason: A solution may grant trusted authors direct publication or require separate author, reviewer, and publisher permissions without application code changes.
  - Date: 2026-07-23
- Decision: Do not make configurable staff review stages, tasks, case workflows, or work queues part of the nForm core contract.
  - Reason: Those concepts prejudge downstream use as case management. A submission may instead create a booking, registration, payment, request, integration event, or other solution-owned outcome.
  - Date: 2026-07-23
- Decision: Limit the core codeless workflow concept to the intake journey itself, including steps, branching, validation, authentication requirements, save/resume behavior, and submission.
  - Reason: This preserves nForm's defining authoring capability without turning it into a universal business-process language.
  - Date: 2026-07-23
- Decision: Include a neutral staff-side submissions registry in nForm core.
  - Reason: Secure submission storage, retrieval, search, export, attachment access, audit, retention, and integration events are reusable platform plumbing; each solution still owns what a submission means and what downstream action it triggers.
  - Date: 2026-07-23
- Decision: Codex leads the extraction design and makes defensible technical decisions without asking Bill to approve each implementation detail.
  - Reason: Bill is collaborating as product/business authority, not acting as the engineering decision proxy. Ask only when a real product ambiguity or consequential tradeoff remains after investigation.
  - Date: 2026-07-23
- Decision: Keep `npm` during extraction; evaluate Vite after stabilization.
  - Reason: Reduces simultaneous change risk.
  - Date: 2026-02-26
- Decision: Manifest-first extraction.
  - Reason: Traceability and rollback confidence.
  - Date: 2026-02-26
- Decision: Use `A -> B` approach (full copy, then selective PATH/ISET pruning).
  - Reason: Faster bootstrap with lower break risk than pure selective copy.
  - Date: 2026-02-26

## Initial Risks
- Hidden PATH coupling in shared modules.
- Environment/config drift between old and new workspaces.
- Incomplete copy if dependency map misses dynamic imports or runtime-loaded templates.

## Mitigations
- Add dependency verification during dry run.
- Keep extraction script and manifest under version control.
- Validate with workflow-focused smoke tests before declaring cutover readiness.

## Immediate Next Steps
1. Implement the production MySQL adapter for the tested authoring repository port.
2. Expose staff-authoring HTTP routes through the domain service and authorization contract.
3. Extract the staff editor UI against those APIs without copying PATH publication or solution defaults.
4. Continue bringing Bill only product ambiguities or consequential architectural tradeoffs that cannot be resolved responsibly from repository evidence.
