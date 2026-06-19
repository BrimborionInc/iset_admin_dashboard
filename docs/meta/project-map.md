# Admin Dashboard - Project Map

Purpose: living agent-facing reference of repo structure, core modules, and cross-cutting concerns. Verify behavior against code before treating this map as proof.

Last reviewed for documentation cleanup: 2026-04-29.

## Top-Level Directories
- `src/`: React application source (Cloudscape + custom authoring tools).
- `public/`: Static assets.
- `build/`: Production build output (generated).
- `apps/`: Secondary app/package workspace material where present.
- `docs/`: Agent-facing project memory plus source/reference artifacts.
- `scripts/`: Build, deploy, migration, smoke-test, data-sync, and repair utilities.
- `scripts/check-doc-links.py`: Read-only local Markdown reference checker for both admin `docs/` and sibling portal `../ISET-intake/docs`.
- `templates/`: Nunjucks / HTML templates used in workflow/document preview (if any shared with portal).
- `blocksteps/`: JSON + Nunjucks definitions for workflow steps (authoring assets).
- `workflow_dev_blocksteps/` & `workflow_dev_workflows/`: Development / draft workflow definitions.
- `tests/`: Test assets.
- `infra/`: Deployment or infra configuration (nginx, etc.).
- `infra/terraform/environments/`: Terraform environment roots (test and prod).
- `infra/terraform/modules/`: Terraform building blocks (bootstrap, networking, logging, artifacts, etc.).
- `db/`: Legacy DB archive/reference files.
- `sql/migrations/`: Canonical PATH shared-schema migrations executed by the admin runner.
- `sql/ops/`: One-off/manual SQL that is intentionally not auto-applied.

## Key Source Areas (`src/`)
(Keep this section current when source structure or cross-cutting architecture changes; put subsystem detail in canonical domain docs.)
- `layouts/`: Navigation & global layout components (e.g., `DemoNavigation.js`, `TopNavigation.js`). Handles global admin controls, top-level navigation, and session-aware layout state.
- `pages/`: Page-level screens & dashboards (all dashboards, editors, management consoles live here). Examples: `home/HomeDashboardPage.jsx` (landing dashboard), `templateEditorDashboard.js` (standalone notification template authoring), `modifyIntakeStep.js` (intake step/component authoring working area), workflow management pages, code tables, messaging, notifications.
- `widgets/`: Reusable complex UI building blocks embedded within pages (e.g., `WorkflowPreviewWidget.js` – interactive workflow step preview mirroring portal runtime logic for conditional visibility, option-reveal children, and whole-step skipping). Pages compose multiple widgets; widgets should not own routing.
- `features/`: Feature-scoped UI modules that are broader than a widget but narrower than a full page. Current example: `src/features/adminFeedback/` for the shell-level bug/change reporting and System Administrator feedback-review windows.
- `auth/`: Cognito helpers for session storage, token parsing, Hosted UI redirects, and bearer-auth API calls.
- `components/`: Smaller shared/presentational components, including intake previews and shared modals.
### Configuration dashboards
- Query Editor route: `src/pages/configuration/QueryEditorDashboard.js` mounted at `/configuration/query-editor`.
- Query Editor widgets live under `src/pages/configuration/widgets/` and currently cover SQL input, multi-statement results, and environment display.
- Query Editor backend execution path is `POST /api/admin/query-editor` in `isetadminserver.js`; it accepts `{ sql }`, splits semicolon-delimited SQL text, and caps `SELECT` results to 100 rows per statement.
- Query Editor supports typed/pasted SQL plus single-file `.sql` / `.txt` upload that loads file contents into the editor before execution; the client-side upload limit is 900 KB to stay within the server's 1 MB JSON body limit.
- Keep Query Editor distinct from the startup migration runner in `isetadminserver.js`, which auto-applies canonical `.sql` files from `/sql/migrations` only.
### Import dashboards
- Client Batch Import route: `src/pages/imports/ClientFileImportDashboard.jsx` mounted at `/iset/imports/client-files` and surfaced in navigation under `Configuration`.
- Client Batch Import widget lives under `src/pages/imports/widgets/` and provides spreadsheet upload, dry-run preview, blocked-row review, and commit actions.
- Client Batch Import backend execution paths are `POST /api/imports/client-files/dry-run` and `POST /api/imports/client-files/commit` in `isetadminserver.js`.
- The importer targets real `client` + application-less `iset_case` records and seeds `case_context_json`; it does not fabricate applications or applicant accounts.
### Workflow Studio (authoring)
- Manage Intake Steps / Manage Components page (`src/pages/manageIntakeSteps.js`) is mounted at `/manage-components` and composes Intake Step Library, Preview, and Step JSON widgets. Its board layout persists in localStorage key `manage-components-board-layout-v2`; local smoke: `npm run smoke:manage-components:browser`.
- Modify Intake Step editor (`src/pages/modifyIntakeStep.js`) is mounted at `/modify-component/:id`; it owns the searchable component library, GOV.UK working-area preview, properties/translations/validation/conditional-visibility side panel, and step save/copy/delete actions. Local smoke: `npm run smoke:modify-component:browser`.
- Manage Workflows page (`src/pages/manageWorkflows.js`) composes widgets: Workflow Library (lists `/api/workflows`), Workflow Properties, Workflow Preview, Runtime Schema.
- Editor (`src/pages/modifyWorkflow.js`) wires IntakeStepLibrary, WorkflowCanvas, StepProperties, WorkflowPropertiesEditor; canvas draft persists in `sessionStorage` (`mw:steps-v1`); save/load via `/api/workflows`.
- Templates live in `src/component-lib/` (+ schemas); server syncs them on startup; `StepPropertiesWidget` forms are driven by `prop_schema`. See `docs/guides/workflow-studio.md` for details.

### Tutorial Platform (hands-on tours)
- Canonical tutorial catalog + shared helpers: `src/tutorials/tutorialPlatform.js`.
- Category wrappers only:
  - `src/tutorials/isetCoordinatorIntroTutorials.js`
  - `src/tutorials/applicationWorkspaceTutorials.js`
  - `src/tutorials/caseWorkspaceTutorials.js`
  - `src/tutorials/nwacAssessmentTutorials.js`
- Runtime orchestration (start/exit/finish/prompt/reset handling): `src/AppContent.js` via Cloudscape `AnnotationContext`.
- Home route hotspot anchors for tutorial steps: `src/routes/AppRoutes.js`.
- Home tutorial panel role filtering: `src/helpPanelContents/homeDashboardHelp.js`.
- Tutorial status management entry point: `src/pages/support/TutorialsDashboardPage.jsx` (role-filtered tutorial table, per-row completion toggle, and `Reset all`; emits `tutorials:refresh`).
- Canonical tutorial runbook: `docs/features/tutorial-platform.md`.

### Shell notifications
- `src/AppContent.js` owns the global admin shell (`AppLayout`) and renders the page-top notifications rail through `AppLayout.notifications`.
- Staff bell alerts load from `/api/me/notifications` and are rendered as a stacked Cloudscape `Flashbar` from `src/AppContent.js`. The default ordering is newest-first chronological order; when multiple bell alerts are visible, the shell shows a Cloudscape segmented sort control so the viewer can switch between `Newest` and `Urgency`.
- `src/internalNotifications.js` reads `iset_internal_notification` plus `iset_internal_notification_dismissal`; current filtering supports `global`, `role`, and typed direct staff/applicant audiences plus scheduled windows via `starts_at` / `expires_at`.
- `src/layouts/SideNavigation.js` footer item `Notifications` is a shell refresh affordance only, not a routed notification center.
- Service-wide maintenance warnings now use the separate runtime-config key `iset_runtime_config(scope='runtime', k='service.announcement')` instead of the bell-notification tables.
- `src/AppContent.js` polls `/api/service-announcement/current` every 15 seconds and renders the active maintenance warning as a non-dismissible `Flashbar` item ahead of bell alerts, with a local 1-second countdown once loaded.
- Current limitation: this is still polling, not websocket/SSE push, so operator guidance should use a 2 to 5 minute lead time rather than relying on precise sub-minute delivery.

## Auth
- Session detection uses real Cognito tokens only.
- Frontend auth/current-user state is centralized in `src/context/AuthContext.js`.
- `/auth/callback` is treated as a shell-less bootstrap route in `src/App.js` so the main app does not render against partial auth state.

## Landing Dashboard
- File: `src/pages/home/HomeDashboardPage.jsx`.
- Features: role-aware board layouts with work queues, queue drilldowns, metrics, recent activity, watchlist/tagged applications, System Administrator operations widgets, feedback queue, and Development Tracker.
- Some homepage widgets still carry sample/fallback data paths for empty/error states; verify each widget before assuming a metric is live.
- System Administrator operational widgets now include `Operations Snapshot`, `Bugs and Change Requests`, `AWS Environment Status`, `Users & Access Alerts`, and `Recent Admin Activity`.
- Dedicated support triage dashboard: `src/pages/support/BugsChangeRequestsDashboard.jsx`, route `/support/bugs-change-requests`.
- Development Tracker widget: `src/pages/home/widgets/DevTaskTrackerWidget.jsx` (Cloudscape `SegmentedControl`, modal task detail, status persistence in `sessionStorage.devTasks` with enrichment merge when new tasks shipped).
- Dev task metadata central source: `src/devTasksData.js`.

## Workflow Authoring & Preview
- `WorkflowPreviewWidget.js`: Simulates portal step rendering, now using the shared admin conditional-visibility evaluator so preview matches portal behavior for supported condition targets, checkbox-array operators, option reveal-children, and steps that become empty after hiding.
- Block step JSON templates in `blocksteps/` consumed to build workflows; Nunjucks templates provide markup for some step types.
- `signature-ack` is implemented as a supported component type with template/schema, admin preview handling, server macro registration, and portal/runtime integration notes below.

## Component Library (Source of Truth)
Canonical component template + schema pairs live under `src/component-lib/`:
- Template files: `src/component-lib/<template_key>.template.json` (fields: `template_key`, `type`, `label`, `description`, `default_props`, `prop_schema`, `export_njk_template`, plus option metadata).
- JSON Schemas: `src/component-lib/schemas/<template_key>.schema.json` consumed at server start by AJV (`validateTemplatePayload`). Missing schema => permissive pass; present schema enforces prop shape in update endpoints.

### Startup Synchronization Pipeline
On `isetadminserver.js` startup each known template key triggers a file -> DB synchronization:
1. For each hard‑coded sync function (e.g., `syncInputTemplateFromFile`) the server reads the matching `.template.json` file.
2. Finds latest active DB row in `component_templates` / fallback `component_template` by `template_key` (highest `version`, `id`).
3. If no row exists: inserts an initial version (version=1) making the template available to authoring UI.
4. If row exists: detects drift across `default_props`, `prop_schema`, `label`, `description`, `export_njk_template` and performs in‑place update (no version bump yet) logging `[sync] <key> template updated from file source of truth`.
5. Radio retains a dedicated legacy `syncRadioTemplateFromFile`; newer components share generic `syncTemplateFromFile`.

Dev helper endpoints (`/api/dev/sync/<template>-template`) allow forced re-sync without restart (now includes `signature-ack`).

### Supported Component Types Registry
`SUPPORTED_COMPONENT_TYPES` set (server) mirrors portal runtime registry: ensures publish & preview tooling only expose interoperable types. Added `signature-ack` to set.

### Signature Acknowledgment Component (`signature-ack`)
Files Added:
- `src/component-lib/signature-ack.template.json`
- `src/component-lib/schemas/signature-ack.schema.json`

Template Highlights:
- Captures `{ signed: true, name }` after user presses Sign; name entry disabled (locked) afterward until Clear.
- `prop_schema` exposes configurable labels, placeholder, font, required flag, CSS width classes.
- `export_njk_template` renders a GOV.UK input (non-interactive signing logic handled by portal/admin React renderer).

Admin Server Changes:
- Added sync function + dev endpoint: `/api/dev/sync/signature-ack-template`.
- Added validation branch in PUT handler using AJV schema.
- Added `'signature-ack'` to `SUPPORTED_COMPONENT_TYPES` (publish metadata + preview discovery).

Portal Runtime (ISET-intake) Integration (summary):
- Added React renderer mapping `signature-ack` key to interactive component (handwriting font application, Sign & Clear handlers).

### Validation Flow
1. Author updates a template -> PUT endpoint triggers `validateTemplatePayload` if schema present.
2. For `signature-ack`, schema enforces presence of `name`, label/hint/action/clear/placeholder objects.
3. Workflow validation (future) should assert: if component marked required then stored value must have `signed === true` plus a non-empty `name`.

### Future Library Enhancements
- Automate enumeration (glob) to avoid manually adding new sync functions (reduce code drift risk).
- Introduce version bumping strategy (immutable historical versions) with migration endpoint for promoting draft templates.
- Add parity / diff audit endpoint to show pending file vs DB drift before applying.

### Custom Component Infrastructure (Macro + Registry)
- `src/server/componentRenderRegistry.js` registers custom server renderers by template key/type.
- `src/server-macros/` is in the Nunjucks search path for preview rendering.
- `src/server-macros/signature-ack.njk` currently backs the `signature-ack` custom preview renderer.
- Preview rendering resolves custom registry components before falling back to DB `export_njk_template`.
- Remaining tech debt: `src/pages/modifyIntakeStep.js` and `src/widgets/WorkflowPreviewWidget.js` still contain client-side `signature-ack` preview behavior for working-area/React preview parity; verify before removing.

## Conditional Visibility
- Admin intake-step authoring and `WorkflowPreviewWidget.js` now share the runtime-backed operator set for supported target components: `equals`, `notEquals`, `exists`, `notExists`, `emptyOrZero`, `contains`, `notContains`, `containsAny`, `notContainsAny`, `containsAll`, `>`, `<`.
- Workflow Preview now skips steps whose authored content becomes fully hidden after conditional evaluation and renumbers visible progress to match the applicant-visible path.
- Manual Intake now uses the same shared evaluator and visible-step skipping for renderable manual-intake steps, clearing hidden answers after backtracks so stale values are not submitted.
- Manual Intake still intentionally skips portal-only upload and signature steps.
- Planned enhancements (task t7) remain grouped boolean logic and isNull/isNotNull-style operators if future runtime work requires them.

## Development Tasks System
- Source of truth: `devTasksData.js` -> merged into `sessionStorage.devTasks`.
- Modal shows: category, status (editable), notes, next steps tokens, documentation link.
- Migration script: `scripts/exportDevTasksMigration.js` outputs SQL UPSERT for `dev_tasks` table.
- Documentation: `docs/planning/dev-tasks-migration.md` covers persistence approach.
- Current cleanup caveat: `src/devTasksData.js` still contains older planned/auth-simulation language. Treat it as a legacy internal tracker until separately curated.

## Docs & Specs
- `docs/README.md`: Top-level docs directory index and directory-gate map.
- Root agent entry point: `AGENTS.md` points future agents to `docs/AGENTS.md`.
- `docs/meta/README.md`: Meta-docs gate for the project-memory control layer.
- `docs/AGENTS.md`: Required project entry point for AI coding agents and high-level project-memory map.
- `docs/meta/standing-directive.md`: Durable project-memory maintenance contract for future short task-based threads.
- `docs/meta/documentation-audit-2026-04-29.md`: Current first-pass documentation inventory, risk classification, and cleanup queue.
- `docs/meta/documentation-cleanup-plan-2026-04-29.md`: Active execution tracker for the broader documentation cleanup effort.
- `docs/meta/planning-cr-archive-triage-2026-04-29.md`: First-pass classification index for planning docs, change requests, and portal archive docs.
- `docs/meta/data-artifact-retention-2026-04-29.md`: First-pass retention policy for generated schema dumps and tracked source/temp data artifacts.
- `docs/meta/meta-log-retention-2026-04-29.md`: First-pass search/update/split policy for large admin and portal meta logs.
- `../ISET-intake/docs/AGENTS.md`: Public portal documentation entry point; in scope for the cross-app Codex memory cleanup plan.
- `docs/meta/codex-thread-index.md`: Searchable cross-thread recovery index for durable handoff notes, runbooks, and prior-thread findings that future chats may need to rediscover quickly.
- `docs/planning/README.md`: Directory gate explaining current-vs-historical handling for planning notes.
- `docs/change-requests/README.md`: Directory gate explaining historical/source handling for CR notes and DOCX artifacts.
- `docs/data/README.md`: Directory gate distinguishing maintained data docs from generated dumps, reference datasets, and temporary source artifacts.
- `docs/data/DB-Structure-Dump/README.md`: Gate for legacy generated schema snapshot files; not authoritative schema guidance.
- `docs/data/temp/README.md`: Gate for tracked binary source artifacts that are not maintained guidance.
- `docs/ops/README.md`: Directory gate for deployment, environment, migration, and infrastructure runbooks.
- `docs/ops/agent-operational-access.md`: Codex/WSL DB access, TEST SQL, PROD start/stop, and AWS profile notes moved out of the agent entry point.
- `docs/ops/deployments/deployment-quick-guide.md`: Shortest current TEST/PROD deployment command guide.
- `docs/ops/deployments/path-deploy-orchestrator.md`: Current deployment control-plane reference for schema/data/app rollout and smoke checks.
- `docs/ops/environments/prod-env-guide.md`: PROD environment snapshot; verify live AWS state before operations.
- `../ISET-intake/docs/system/ops/prod-portal-deployment.md`: Portal-specific PROD deployment pointer that links back to the admin orchestrator docs.
- `docs/guides/README.md`: Directory gate for maintained how-to docs that still require code/script verification.
- `docs/requirements/README.md`: Directory gate for source requirements, specs, and applicant form artifacts.
- `docs/training/README.md`: Directory gate for staff training source material and help-panel guidance inputs.
- `docs/features/landing-page.md`: Iterative change log for dashboard/landing-page evolution.
- `docs/features/admin-feedback-reporting.md`: Current in-app bug-reporting and change-request flow, API, storage model, and shell entry points.
- `docs/features/file-uploads/conditional-rules.md`: Partial implementation record for conditional visibility plus remaining grouped-logic/null-semantics proposal.
- `docs/features/file-uploads/architecture-admin.md`: Admin-specific upload architecture companion that now points at the current portal upload docs under `../ISET-intake/docs/portal/intake/`.
- `docs/planning/client-case-application-target-model.md`: Canonical target-model and migration tracker for one-client/one-case/many-applications work.
- `docs/planning/client-case-application-migration-plan.md`: Canonical rollout plan for schema changes, backfills, workflow cutover, and production data migration.
- `docs/planning/client-case-application-cutover-dependency-inventory.md`: Concrete inventory of the backend routes, frontend widgets, queue logic, and status assumptions that must be changed before production cutover and historical case consolidation.
- `docs/planning/status-architecture-overhaul.md`: Canonical target status model and rollout plan for separating lifecycle state, decisions, queues, and intervention proposals.
- `docs/dashboards/client-file-import-dashboard.md`: Current Client Batch Import dashboard behavior and constraints.
- `docs/dashboards/data-and-results-dashboard.md`: Current `Reporting > Data and Results` behavior, section order, and live/demo data rules.
- `docs/dashboards/query-editor-dashboard.md`: Current Query Editor dashboard behavior and limitations.
- `docs/meta/project-map.md`: This map.

## Cross-Cutting Events & State
- Custom DOM event `auth:session-changed` is emitted by `src/auth/cognito.js` and consumed by auth/layout contexts after session save/clear.
- Custom DOM event `admin-feedback:open-composer` opens the floating admin-feedback report window from help-panel actions.
- Custom DOM event `admin-feedback:open-review` opens the floating System Administrator feedback-review window from the homepage widget.
- Custom DOM event `admin-feedback:changed` lets the report composer and review panel tell homepage widgets to refresh feedback counts/lists after create/status/note changes.
- Common `sessionStorage` uses include auth session state, current language, dark mode, side-nav expansion, home/workspace board layouts, workflow-editor drafts, tutorial reset flags, and legacy `devTasks` state.

## Styling & UI Frameworks
- Cloudscape Design System components (global styles imported at root). Nunjucks templates for some rendered previews.
- Bilingual content currently focused on workflow preview notices; broader i18n may be future requirement.

## Known Extension Points (Planned / In Progress)
- Conditional rules expansion (t7).
- Signature acknowledgment component: implemented template/schema/server sync/server macro/preview/runtime support; remaining future work is required-value enforcement and audit behavior if product requirements demand it.
- Development Tracker cleanup or retirement: current tracker data includes legacy/auth-simulation tasks and should not be treated as current roadmap without verification.
- API persistence for development tasks with audit logging.

## Update Log
- v0.1: Initial map created (structure, auth simulation, dev tasks system, conditional visibility scope, planned extensions).
- v0.2: Added Component Library section, synchronization workflow documentation, signature-ack component integration (template, schema, server sync, supported types update, validation hook).
- v0.3: Clarified separation: dashboards & editors reside in `pages/`; reusable building blocks in `widgets/`. Added standing directive to keep this map updated on every newly learned structural detail.
- v0.4: Added planned custom component macro/registry infrastructure section (task t9) outlining elimination of client DOM surgery for signature-ack and future bespoke components.
- v0.4a: Draft `src/server-macros/signature-ack.njk` macro scaffolded (not yet wired into preview route or registry) to enable upcoming server-first rendering.
- v0.4b: Added Query Editor architecture notes and corrected stale documentation paths under Docs & Specs and development-task references.
- v0.4c: Added shell-notifications notes covering `AppLayout.notifications`, internal-notification data flow, and the current lack of hot-push refresh for service-wide warnings.
- v0.4d: Updated workflow-authoring notes to reflect shared conditional-visibility utilities, runtime-parity workflow preview behavior, and the then-remaining Manual Intake parity gap.
- v0.4e: Updated Manual Intake notes to reflect shared conditional-visibility evaluation, visible-step skipping, and the intentional omission of portal-only upload/signature steps.
- v0.4f: Closed the intake parity follow-up by documenting that the step editor, Workflow Preview, and renderable Manual Intake content now align with the public-intake runtime operator set and that DEV workflow `21` authoring rows rebuild the published runtime payload.
- v0.4g: Added the canonical client/case/application target-model planning note to the docs index so future threads can distinguish current hybrid behavior from the agreed structural target.
- v0.4h: Added the root agent entry point, refreshed the project-memory standing directive, and recorded the first-pass documentation cleanup audit.
- v0.4i: Replaced stale README orientation, updated project-map claims around source directories, homepage widgets, signature-ack macro infrastructure, cross-cutting session state, and legacy development-tracker caveats.
- v0.4j: Added planning and change-request directory gates so future agents do not treat mixed historical notes as current behavior.
- v0.4k: Added data, requirements, and training directory gates to separate maintained guidance from generated dumps, source artifacts, and reference material.
- v0.4l: Added ops and guides directory gates so future agents verify operational commands and how-to assumptions before acting.
- v0.4m: Added a top-level docs index plus gates for architecture, assignment, auth, components, dashboards, features, financial reporting requirements, inventory, meta, prompts, runtime, testing, widgets, and workflows.
- v0.4n: Corrected stale local and cross-repo doc references, marked the nForm extraction plan/scope notes as historical/planned, updated planned-status component docs for `signature-ack` and conditional visibility, cleaned up broken intake-authoring/finance/ESDC/runbook references found by a broader scan, added a reusable cross-app doc-link checker, moved operational access command detail out of `docs/AGENTS.md`, gated `docs/data/temp/`, added the active cleanup execution tracker, expanded cleanup scope to include `../ISET-intake/docs`, completed first-pass portal doc gates, and compacted the agent entry point.
- v0.4o: Completed the first ops-doc audit pass by adding status/review metadata across admin and portal ops runbooks, checking documented deployment/data/migration command names against package scripts, marking historical TEST/prod environment records, redacting literal DB credentials from historical notes, and updating PROD portal hostname references.
- v0.4p: Added the first planning/change-request/archive triage index, linked it from directory gates, classified CR DOCX files as source artifacts, and recorded initial delete/archive candidates without deleting them.
- v0.4q: Added the first data-artifact retention policy, gated `docs/data/DB-Structure-Dump/`, and clarified that tracked temp binaries are source artifacts that may contain sensitive data.
- v0.4r: Added the first meta-log retention policy, keeping current large logs searchable in place while defining when and how to split them later.

---
Maintenance: keep this map current when work changes repo structure, major modules, lifecycle hooks, cross-cutting architecture, or documentation organization. Do not expand it with subsystem detail that belongs in a canonical domain doc.
