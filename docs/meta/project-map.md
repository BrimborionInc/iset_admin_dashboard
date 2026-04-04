# Admin Dashboard – Project Map

Purpose: Living reference of structure, core modules, and cross-cutting concerns (auth, workflow authoring, preview, task tracking). Mirrors style of intake portal map.

## Top-Level Directories
- `src/`: React application source (Cloudscape + custom authoring tools).
- `public/`: Static assets.
- `build/`: Production build output (generated).
- `docs/`: Documentation (landing page evolution, feature specs, this map).
- `scripts/`: Utility scripts (e.g., dev tasks migration export).
- `templates/`: Nunjucks / HTML templates used in workflow/document preview (if any shared with portal).
- `blocksteps/`: JSON + Nunjucks definitions for workflow steps (authoring assets).
- `workflow_dev_blocksteps/` & `workflow_dev_workflows/`: Development / draft workflow definitions.
- `tests/`: Test assets (if populated).
- `infra/`: Deployment or infra configuration (nginx, etc.).
- `infra/terraform/environments/`: Terraform environment roots (test and prod).
- `infra/terraform/modules/`: Terraform building blocks (bootstrap, networking, logging, artifacts, etc.).
- `db/`: Legacy DB archive/reference files.
- `sql/migrations/`: Canonical PATH shared-schema migrations executed by the admin runner.
- `sql/ops/`: One-off/manual SQL that is intentionally not auto-applied.

## Key Source Areas (`src/`)
(Continuously expanded; every newly learned architectural fact must be reflected here immediately – standing directive.)
- `layouts/`: Navigation & global layout components (e.g., `DemoNavigation.js`, `TopNavigation.js`). Handles global admin controls, top-level navigation, and session-aware layout state.
- `pages/`: Page-level screens & dashboards (all dashboards, editors, management consoles live here). Examples: `home/HomeDashboardPage.jsx` (landing dashboard), `templateEditorDashboard.js` (standalone notification template authoring), `modifyIntakeStep.js` (intake step/component authoring working area), workflow management pages, code tables, messaging, notifications.
- `widgets/`: Reusable complex UI building blocks embedded within pages (e.g., `WorkflowPreviewWidget.js` – interactive workflow step preview mirroring portal runtime logic for file upload visibility & messaging). Pages compose multiple widgets; widgets should not own routing.
- `auth/`: Cognito helpers for session storage, token parsing, Hosted UI redirects, and bearer-auth API calls.
- (Future) `components/`: Smaller presentational or configuration components (to catalog as added).
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

## Auth
- Session detection uses real Cognito tokens only.
- Frontend auth/current-user state is centralized in `src/context/AuthContext.js`.
- `/auth/callback` is treated as a shell-less bootstrap route in `src/App.js` so the main app does not render against partial auth state.

## Landing Dashboard
- File: `src/pages/home/HomeDashboardPage.jsx`.
- Features: role-aware welcome copy, quick actions, alerts (mock), My Work metrics (mock), recent activity (mock), resources, Development Tracker (System Administrator only).
- Development Tracker widget: `src/pages/home/widgets/DevTaskTrackerWidget.jsx` (Cloudscape `SegmentedControl`, modal task detail, status persistence in `sessionStorage.devTasks` with enrichment merge when new tasks shipped).
- Dev task metadata central source: `src/devTasksData.js`.

## Workflow Authoring & Preview
- `WorkflowPreviewWidget.js`: Simulates portal step rendering, respects conditional visibility for `file-upload` components, shows bilingual "no documents required" notice when all hidden.
- Block step JSON templates in `blocksteps/` consumed to build workflows; Nunjucks templates provide markup for some step types.
- Planned extension point: new `signature-ack` component for acknowledgment capture (task t9, see Tasks & Roadmap below once added).

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

### Planned Custom Component Infrastructure (Macro + Registry)
Rationale: Current stop-gap for bespoke components (e.g., `signature-ack`) relies on client-side DOM transformation inside iframe previews to achieve final layout. This is brittle (timing-dependent, repeated heuristics) and diverges from server-rendered GOV.UK macro approach.

Planned Architecture (task t9):
1. Local Macro Directory: `src/server-macros/` added to Nunjucks search path before GOV.UK paths.
2. Macro Authoring: Each custom component gets a `component-name.njk` exporting a macro (or plain template) accepting `props` mirroring DB `default_props` shape.
3. Render Registry: Server module (e.g., `src/server/componentRenderRegistry.js`) exporting a map `{ 'signature-ack': { macro: 'signatureAck' } }` or function-based renderer for complex cases.
4. Preview Resolution Order: `/api/preview/step` resolves component by (a) registry macro/custom renderer, else (b) DB `export_njk_template`, else (c) fallback comment stub.
5. Migration Strategy: Keep existing DOM surgery for one release while macro output validated for parity, then remove transformation code (clean historical tech debt entry in changelog).
6. Documentation: New `/docs/custom-component-infra.md` describing pattern, validation checklist (accessibility, GOV.UK class alignment), and migration steps.

Benefits:
- Eliminates timing race & fragile selectors.
- Centralizes render decisions making future custom components cheaper.
- Enables parity audit tooling to operate uniformly across GOV.UK + custom components.

Risk Mitigations:
- Incremental rollout with feature flag or dual-render logging.
- Snapshot HTML diffs for signature-ack before removing client transform.
- Clear rollback (delete registry entry & macro) if regressions appear.

## Conditional Visibility
- Current parity established for file upload components only (AND semantics). Planned enhancements (task t7) to introduce grouped boolean logic and isNull/isNotNull operators.

## Development Tasks System
- Source of truth: `devTasksData.js` -> merged into `sessionStorage.devTasks`.
- Modal shows: category, status (editable), notes, next steps tokens, documentation link.
- Migration script: `scripts/exportDevTasksMigration.js` outputs SQL UPSERT for `dev_tasks` table.
- Documentation: `docs/planning/dev-tasks-migration.md` covers persistence approach.

## Docs & Specs
- `docs/meta/codex-thread-index.md`: Searchable cross-thread recovery index for durable handoff notes, runbooks, and prior-thread findings that future chats may need to rediscover quickly.
- `docs/features/landing-page.md`: Iterative change log for dashboard/landing-page evolution.
- `docs/features/file-uploads/conditional-rules.md`: Spec for expanded file-upload conditional rule logic.
- `docs/dashboards/client-file-import-dashboard.md`: Current Client Batch Import dashboard behavior and constraints.
- `docs/dashboards/data-and-results-dashboard.md`: Current `Reporting > Data and Results` behavior, section order, and live/demo data rules.
- `docs/dashboards/query-editor-dashboard.md`: Current Query Editor dashboard behavior and limitations.
- `docs/meta/project-map.md`: This map.

## Cross-Cutting Events & State
- Custom DOM event `auth:session-changed` triggers re-render for simulation or session updates.
- `sessionStorage` keys: `devTasks`, `currentRole`, `simulateSignedOut`.

## Styling & UI Frameworks
- Cloudscape Design System components (global styles imported at root). Nunjucks templates for some rendered previews.
- Bilingual content currently focused on workflow preview notices; broader i18n may be future requirement.

## Known Extension Points (Planned / In Progress)
- Conditional rules expansion (t7).
- Signature acknowledgment component (upcoming task) for intake step editor & portal runtime.
	- Now implemented: template + schema + server sync + portal renderer (needs E2E validation & authoring UI confirm). Future: add required-value enforcement and audit log of name capture.
- Real data integration for My Work / Alerts panels.
- API persistence for development tasks with audit logging.

## Update Log
- v0.1: Initial map created (structure, auth simulation, dev tasks system, conditional visibility scope, planned extensions).
- v0.2: Added Component Library section, synchronization workflow documentation, signature-ack component integration (template, schema, server sync, supported types update, validation hook).
- v0.3: Clarified separation: dashboards & editors reside in `pages/`; reusable building blocks in `widgets/`. Added standing directive to keep this map updated on every newly learned structural detail.
- v0.4: Added planned custom component macro/registry infrastructure section (task t9) outlining elimination of client DOM surgery for signature-ack and future bespoke components.
- v0.4a: Draft `src/server-macros/signature-ack.njk` macro scaffolded (not yet wired into preview route or registry) to enable upcoming server-first rendering.
- v0.4b: Added Query Editor architecture notes and corrected stale documentation paths under Docs & Specs and development-task references.

---
Maintenance (Standing Directive): This map MUST be updated immediately upon learning any new structural, architectural, or cross-cutting detail (pages vs widgets placement, new directories, lifecycle hooks, synchronization pipelines). No feature work considered complete until corresponding map updates are made.
