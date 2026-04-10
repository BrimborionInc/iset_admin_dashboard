# Admin Dashboard Assistant Context

Purpose: persistent context for future threads.

This file is a fast onboarding and handoff document for assistants and developers working in the admin dashboard repo. It should help a new thread start quickly, avoid repeated mistakes, and find the right code/docs/data locations with minimal back-and-forth.

Audience: assistants and developers.
Last Updated: 2026-04-07

## Working relationship (design dialog)

- Treat implementation as a design dialog with the user, not literal instruction execution.
- The user may be wrong or operating from incomplete context; surface contradictions and risks early.
- If requested changes could break behavior, conflict with data reality, or create regressions, pause and discuss tradeoffs before coding.
- Challenge weak assumptions with concrete evidence (code paths, payloads, schema, runtime config), then agree on the target behavior.
- Own technical decisions once requirements are clear, but do not silently make high-risk assumptions.
- In discovery/design conversations, Codex leads the design process: provide concrete recommendations, challenge contradictions directly, and drive toward a robust design before implementation planning.
- Treat the user as business-domain authority and Codex as design authority; use constructive, direct challenge ("confrontational perfectionism") to remove ambiguity and weak decisions early.
- During interviews/discovery, avoid list-style question dumps. Ask one question at a time and track answers across the conversation.
- Keep questioning intentional: ask only when a material assumption is required or intent is unclear enough to risk rework.
- Continue the interview until requirements are sufficient to move to the next phase; do not ask questions for their own sake.
- Codex owns code and data decisions. Do not expect Bill to answer implementation-level questions about code paths, payloads, schema, or persistence mechanics.
- Codex must inspect the codebase and database directly and make defensible data-handling decisions from evidence.
- Interview focus with Bill should be UI/UX behavior, workflow expectations, and business intent.
- It is expected to challenge current code/data design when flaws are found; use confrontational perfectionism to reach a robust design before refactor planning.
- Do not ask "preference boundary" questions when a clear, defensible recommendation already exists.
- In those cases, state the recommendation, apply it as the default, and only ask for confirmation or an explicit override.
- Do not ask questions for the sake of visible collaboration; minimize user questions.
- Ask only when requirements are genuinely ambiguous or when a real dilemma remains after code/data introspection.

## How to use this file

- Use this as a starting context map, then verify details in code before making claims.
- Treat linked docs as the source of truth for deeper implementation details.
- Keep this file focused on practical orientation (what matters, where to look, what commonly breaks).

## Thread-start checklist

- Clarify requirements if business behavior is ambiguous.
- If the user references a previous chat, prior note, or missing historical context, search `docs/meta/codex-thread-index.md` first and then open the linked canonical doc(s).
- Confirm real behavior from code/API payloads before changing UI.
- For dashboard/widget work, read `docs/guides/configurable-dashboard-notes.md` first.
- For homepage Metrics or Items work, read `docs/dashboards/admin-home-metrics-widget.md`.
- For coordinator-facing PATH help-panel or AI-context work, use `docs/training/TRAINING_MODULES_September_2025_extracted.md` as the baseline for staff workflow expectations and write guidance as a job aid, not a product tour.
- Keep doc updates in the same change when behavior or structure changes.
- If blocked by tooling, permissions, or environment access, call it out immediately.

## For future Codex threads

Before making changes, read [AGENTS.md](./AGENTS.md) and treat it as the current project context for this repo. If the user references prior-thread work, notes, or "something we already figured out", check [codex-thread-index.md](./meta/codex-thread-index.md) before searching blindly. As you work, keep the docbase current: update [AGENTS.md](./AGENTS.md) with durable context pointers, guardrails, and architecture notes that would help future chats; update [codex-thread-index.md](./meta/codex-thread-index.md) whenever you add or materially revise a durable handoff/how-to note that a future thread may need to rediscover; update affected live docs under [`docs/`](./) when behavior changes; and record notable shipped changes in [changelog.md](./meta/changelog.md) and [next-release-notes-log.md](./meta/next-release-notes-log.md). The goal is that a new thread can recover the current state of the system from the repo docs without depending on prior chat history.

## Core conventions

- Prefer Cloudscape components over native HTML. Use `Link` from `@cloudscape-design/components` instead of raw `<a>` unless there is no Cloudscape equivalent.
- Cloudscape `Input` does not provide built-in currency formatting. For money-entry fields, use the shared helper in `src/utils/currencyFormat.js` (`getCurrencyInputDisplayValue`) with focus/blur state so the form keeps the raw value while the blurred field shows formatted currency. Do not hand-roll one-off currency formatting per widget or modal.
- Do not assume parity with the public portal. Verify the full chain:
  schema -> runtime config JSON -> API payload -> renderer/template.
- Current intake-conditionality caveat: the public portal runtime now supports checkbox-array condition operators (`contains`, `notContains`, `containsAny`, `notContainsAny`, `containsAll`) and auto-skips steps whose authored components all hide, and DEV workflow `21` uses that for Step 19 support-driven follow-up questions/uploads. DEV workflow `21` also currently splits Step 19 into two variants after Step `93`, routing `dependent-children = 0` applicants to a no-childcare copy of `Financial Supports Requested`. Manual Intake, Workflow Preview, and the intake-step editor do not yet support those operators or the same whole-step skip behavior. See `docs/planning/step19-checkbox-conditionality-followup.md` before editing those rules.
- Current intake deployment caveat (2026-04-02): additional last-minute public-portal/runtime-schema fixes now live in DEV runtime data that the admin-side workflow authoring, editing, preview, and Manual Intake paths cannot yet reproduce correctly. For prod rollout of intake changes, treat the DEV runtime row `iset_runtime_config(scope='publish', k='workflow.schema.intake')` as the deployment source of truth for portal behavior; do not assume a fresh admin-side republish from the current authoring tables will generate the correct runtime schema, and do not assume Manual Intake can safely render the newest runtime schema yet.
- When adding/changing UI fields, confirm the backend actually returns the data.
- Fix root causes instead of layering workarounds.

## Auth model

- Admin sign-in now uses real Cognito/IAM only. Do not reintroduce simulated-user flows, IAM on/off toggles, dev-bypass headers, or header-driven role impersonation in admin code.
- The admin-dashboard backend is staff-only. Applicant-pool tokens must be rejected by this service; do not treat shared Cognito verification as permission to expose admin API routes to applicants.
- Staff/admin region scope and staff identity IDs must resolve from `staff_profiles` and `staff_region` on the server. Do not make staff authorization or admin-user management depend on Cognito `custom:region_id` or `custom:user_id`.
- Frontend auth state is centralized in `src/context/AuthContext.js`. Prefer `useAuth()` and `useCurrentUser()` over direct token/session reads in page or widget code.
- The OAuth callback is handled as a shell-less bootstrapping route. If sign-in behavior changes, inspect `src/App.js`, `src/pages/AuthCallback.js`, `src/auth/cognito.js`, and `src/auth/apiClient.js` together.
- Server middleware and admin-user routes no longer support `AUTH_PROVIDER=none`, mock admin users, or auth-disabled mutation fallbacks. If auth is misconfigured, fail explicitly instead of inventing local placeholder behavior.
- Raw debug/file-maintenance endpoints must stay behind explicit server-side enablement (for example `ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES=true`) plus System Administrator access. Do not leave purge or direct file read/write helpers broadly reachable.
- Local repo dev launcher note: `start-dev.ps1` now starts the Admin Backend with `ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES=true` so Demo Controls like `Clear ISET test data` and `/api/dev/*` work in local dev. Manual admin-backend starts still need that env var set explicitly.
- Current Demo Controls rule: `Create Dummy Draft` should list portal-sign-in applicant users from the local `user` table, excluding staff identities, rather than relying only on client-linked applicant-account rows.

## Development data policy (no legacy fallbacks)

- This system is in active development; do not assume legacy data constraints by default.
- After refactors, dev/test databases can be purged of old records that would otherwise require backward-compatibility handling.
- As a principle, avoid adding legacy fallback fields, compatibility branches, or dual-write/dual-read logic when they increase code or data complexity without current operational need.
- Prefer a clean target model and simple code paths. Only introduce compatibility handling when explicitly required and validated from current production constraints.

## High-value repo map

- Docs base path: `X:\ISET\admin-dashboard\docs` (WSL: `/mnt/x/ISET/admin-dashboard/docs`)
- Codex thread/context recovery index: `docs/meta/codex-thread-index.md`
- Applicant-account activation data model: `docs/data/applicant-account-activation.md`
- Client-file import guide: `docs/guides/client-file-imports.md`
- Client Batch Import dashboard reference: `docs/dashboards/client-file-import-dashboard.md`
- Data and Results dashboard reference: `docs/dashboards/data-and-results-dashboard.md`
- Financial Reports dashboard reference: `docs/dashboards/financial-reports-dashboard.md`
- Applicant Watchlist dashboard reference: `docs/dashboards/applicant-watchlist-dashboard.md`
- Admin feedback reporting reference: `docs/features/admin-feedback-reporting.md`
- Homepage Metrics dashboard reference: `docs/dashboards/admin-home-metrics-widget.md`
- Query Editor dashboard reference: `docs/dashboards/query-editor-dashboard.md`
- Test DB access from Codex/WSL: `docs/guides/test-db-access-from-codex.md`
- Operational reporting workbook reference: `docs/data/NWAC - data info 2025-26.xlsx`
- NWAC staff training extract for PATH-aligned help content: `docs/training/TRAINING_MODULES_September_2025_extracted.md`
- Admin intake preview renderer: `apps/web/src/features/intake/ComponentRenderer.tsx`
- Public portal renderer (other repo): `../ISET-intake/src/renderer/renderers.js`
- Help panel content: `src/helpPanelContents/*`
- Admin test deploy staging script: `scripts/deploy-admin-test.ps1`
- Portal test deploy staging script: `../ISET-intake/scripts/deploy-portal-test.ps1`
- PATH deploy orchestrator guide: `docs/ops/deployments/path-deploy-orchestrator.md`
- PATH deployment quick guide: `docs/ops/deployments/deployment-quick-guide.md`
- PATH deploy orchestrator CLI: `scripts/path-deploy.js`
- Test DB SQL helper for Codex/WSL: `scripts/run-test-sql-via-ssm.sh`
- Prod deploy guide: `docs/ops/deployments/prod-deployment-guide.md`
- Prod environment guide: `docs/ops/environments/prod-env-guide.md`
- Test deployment notes: `docs/ops/deployments/deploy-test-notes.md`
- Test DB refresh planning note: `docs/ops/environments/test-env-db-refresh.md`
- TEST DB refresh CLI: `scripts/path-test-db-refresh.js`
- TEST DB restore helper: `scripts/run-test-db-restore-via-ssm.sh`
- Legacy reference only: `scripts/deploy-test-db.ps1` (the npm alias `deploy:test-db` now routes to `scripts/path-test-db-refresh.js run`)
- Prod DB SQL helper: `scripts/run-prod-sql.ps1`
- PATH data promotion catalog: `docs/ops/deployments/data-promotion-catalog.md`
- PATH data sync CLI: `scripts/path-data-sync.js`

## Documentation gateway

- Start here for current orientation, then go deeper into the docs below rather than relying on planning notes alone.
- Cross-thread context recovery index: `docs/meta/codex-thread-index.md`
- Live dashboard behavior: `docs/dashboards/*`
- Import and data-backload constraints: `docs/guides/client-file-imports.md`
- Client Batch Import dashboard: `docs/dashboards/client-file-import-dashboard.md`
- Data and Results dashboard: `docs/dashboards/data-and-results-dashboard.md`
- Widget-level docs index: `docs/widgets/admin/README.md`
- Workflow-level docs index: `docs/workflows/admin/README.md`
- Project structure / architecture map: `docs/meta/project-map.md`
- Historical plans and design notes: `docs/planning/*` (useful for intent/history, but verify against code before treating as current behavior)

## Query Editor status

- Route: `/configuration/query-editor`
- Default access: System Administrator only
- Current input model: `SQL Editor` tab for typed/pasted SQL text plus single-file `.sql` / `.txt` upload, and `Server Export` tab for DB/table selection and dump-file path entry
- Current execution model: frontend posts `{ sql }` to `/api/admin/query-editor`; backend executes one or more semicolon-delimited statements against the active environment DB connection
- Current server-export model: frontend loads DB/table metadata from `GET /api/admin/query-editor/export-metadata` and posts `{ database, tables, outputPath }` to `POST /api/admin/query-editor/export`
- Current file-upload constraint: client-side upload limit is 900 KB so requests stay within the server's 1 MB JSON body limit
- Current result handling: `SELECT` results are capped at 100 rows per statement; write statements return rows affected/status; multiple statements use a result-set selector
- Current export rule: server export is fixed to `Dump Structure and Data`, `Export to a Self-Contained File`, and `Include Create Schema`; triggers/routines/events are intentionally not exposed
- Current export-path rule: default dump path should be a date-stamped database-based `.sql` file under a Windows-style `Documents\\dumps` directory when the server can resolve a Windows user profile, with fallback to the local server home directory otherwise
- Current WSL/dev rule: prefer the Windows `mysqldump.exe` client from WSL when available so Query Editor export matches the established Windows-from-WSL DB tooling guidance
- Separate path to keep distinct: the admin startup migration runner executes canonical `.sql` files from `/sql/migrations`, but that is not the Query Editor dashboard
- Current shared-schema rule: PATH canonical migrations live in `admin-dashboard/sql/migrations/`; one-off/manual SQL belongs in `admin-dashboard/sql/ops/`
- Current promotion rule: treat cross-environment DB promotion as allowlisted config/reference sync only. Full DB overwrite/reset is acceptable for TEST, but PROD may receive only canonical schema migrations plus explicit datasets from `docs/ops/deployments/data-promotion-catalog.md`.

## Applicant watchlist manager status

- Route: `/configuration/applicant-watchlist`
- Current navigation path: `Configuration > Applicant Watchlist`
- Default access: `System Administrator` and `NWAC Administrator`, controlled through the standard access-control matrix and enforced server-side through the same route key.
- Current contextual-add rule: case/application quick actions that add a client or applicant to the watchlist remain broadly available; only the aggregated manager page is restricted.
- Current data/privacy rule: the dashboard table masks SIN values by default, while the modal editor shows the full SIN only to authorized roles.
- Current lifecycle rule: watchlist removal is implemented as `inactive`, not hard delete. Re-adding an inactive SIN reactivates the same row.
- Current homepage rule: the `Watchlist Hits` queue matches only active watchlist entries.
- Current event rule: shared event types are `applicant_watchlist_added`, `applicant_watchlist_updated`, `applicant_watchlist_removed`, and `applicant_watchlist_hit`.
- Current cross-app rule: `applicant_watchlist_hit` is emitted from both admin manual-intake submissions and the public-portal intake completion flow, using masked SIN in the payload only.
- Current feed-safety rule: users without access to `/configuration/applicant-watchlist` must not receive watchlist events from the generic `/api/events/feed` endpoint even if they probe alternate filters.

## Admin feedback reporting status

- Top-header report button now lives beside the existing `Admin Console Help` utility and opens a help panel titled `Bug reporting and change requests`.
- Help-panel content lives in `src/helpPanelContents/adminFeedbackHelp.js`; the floating report window lives in `src/features/adminFeedback/FloatingFeedbackReporter.jsx`; the floating review window lives in `src/features/adminFeedback/FloatingFeedbackReviewPanel.jsx`; shell state/event wiring lives in `src/AppContent.js`.
- The current launcher flow is: top-nav button -> help panel instructions -> `Report a bug` / `Request a change` -> floating non-modal report window.
- The floating report window captures page context when opened (path, URL, title, breadcrumbs, browser metadata, viewport, timezone) so staff can keep navigating while they write.
- System Administrators now also get a homepage triage widget (`src/pages/home/widgets/SystemAdminFeedbackQueueWidget.jsx`) that opens the floating review window via the `admin-feedback:open-review` shell event.
- Backend routes now include:
  - `POST /api/admin/feedback-reports`
  - `GET /api/dashboard/system-admin-feedback-reports`
  - `GET /api/admin/feedback-reports/:id`
  - `PATCH /api/admin/feedback-reports/:id/status`
  - `POST /api/admin/feedback-reports/:id/notes`
- Canonical schema migrations: `sql/migrations/20260405_0001_create_admin_feedback_reporting.sql` and `sql/migrations/20260405_0002_create_admin_feedback_management_tables.sql`.
- DEV recovery note from 2026-04-05: the original feedback attachment DDL used `storage_key VARCHAR(1024) UNIQUE`, which exceeds MySQL/InnoDB's 3072-byte utf8mb4 index limit. The canonical migration now uses `storage_key VARCHAR(512)`, and the shared-schema runner now treats failed tracking rows as still pending and upserts retries into `iset_migration`.
- Persistence is intentionally separate from `iset_document`: use `admin_feedback_report`, `admin_feedback_attachment`, `admin_feedback_status_history`, and `admin_feedback_note`, because bug/change evidence is not a client/application/case supporting document and must not appear in Supporting Documents.

## PATH deployment control plane

- Preferred operator entry point: `npm run path:deploy -- --env test|prod ...` from `admin-dashboard`.
- Planning entry point: `npm run path:deploy:plan -- --env test|prod ...`.
- Smoke-only entry point: `npm run path:deploy:smoke -- --env test|prod`.
- TEST destructive reset entry points: `npm run test:db:refresh:plan -- --source-env dev` and `npm run test:db:refresh -- --source-env dev --yes`. Manual `--snapshot-file` / `--snapshot-key` inputs still work when needed.
- Canonical schema preflight/apply now supports remote targets: `npm run db:migrate:plan -- --target-env test|prod` and `npm run db:migrate:apply -- --target-env test|prod`.
- Current deploy orchestration order is: AWS identity preflight -> optional TEST DB refresh/reset -> prod restore point when DB mutation is planned -> canonical schema apply -> optional allowlisted data sync -> app rollout primitives -> smoke checks -> local release manifest under `tmp/path-deploy/<env>/`.
- Deployed admin environments now force `DISABLE_AUTO_MIGRATIONS=true`, so TEST/PROD schema changes should come through the explicit deploy/migration commands, not server startup.
- TEST app rollout still uses the existing in-place SSM deploy scripts for admin and portal. PROD still uses artifact upload plus ASG instance refresh.
- TEST DB reset now has an explicit Codex/operator path: either upload/reference a prepared scrubbed dump or have Codex generate a DEV-derived baseline snapshot automatically, restore it through SSM on a live TEST app host, then run canonical schema apply and TEST smoke. The DEV-derived baseline snapshot contains full schema plus only allowlisted safe/reference data and the published intake runtime row; applicant, case, message, payment, and identity-link data are intentionally excluded. The command is destructive and requires `--yes`.
- Preferred one-command TEST release path when a reset is desired: `npm run path:deploy -- --env test --refresh-test-db --dataset intake-release --workflow-id 21 --yes`.
- TEST smoke should use target-group health, not public `/healthz`, because the current TEST ALB/Nginx layer returns `403` to unauthenticated public requests from Codex even when both target groups are healthy.
- Current TEST smoke target groups: `nwac-test-admin-tg` on port `5001` and `nwac-test-portal-tg` on port `5000`.
- Current prod smoke path in the orchestrator remains the public `/healthz` URLs (`nwac-console.awentech.ca`, `iset.nwac.ca`, `nwac-public.awentech.ca`).
- Current prod control-plane default profile is `nwac-prod`.
- Prod DB-affecting deploy runs now auto-capture an Aurora cluster snapshot restore point for `nwac-prod-db` before schema/data mutation starts.
- Current deployed build marker rule: app deploys do not auto-increment `package.json` semver, but admin/portal frontend builds now embed a visible release/build stamp (package version + release ID + git SHA). Read it on the admin landing-page footer or the public portal Help page.
- Current TEST deploy-script default profile is `nwac-test` in both admin and portal scripts; stop relying on the old `nwac` default.
- Sandbox/runtime caveat: `npm` commands in this workspace run under Windows Node (`HOME=C:\Users\Wilson`), but the Codex-controlled AWS profiles used for operator work live in the bash/WSL-side CLI config. The PATH deploy orchestrator now exports credentials from the working bash-side profile into the Windows-side PowerShell deploy subprocesses before app rollout, so prod app deploys no longer depend on the stale Windows `aws.exe` profile state.
- Current prod DB helper rule: Secrets Manager secret `nwac-prod-db-credentials` currently supplies credentials only (`username`, `password`). `scripts/run-prod-sql-via-ssm.sh` therefore provides the default host/name/port (`nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com`, `iset_intake`, `3306`) unless explicitly overridden.
- Current TEST DB helper rule: Secrets Manager secret `nwac-test-db-credentials` also supplies credentials only (`username`, `password`). `scripts/run-test-db-restore-via-ssm.sh` therefore provides the default host/name/port (`nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com`, `iset_intake`, `3306`) unless explicitly overridden.
- Current SSM SQL helper rule: when `--sql-file` is used, both test/prod helpers stage the SQL file through the environment artifact bucket (`nwac-test-artifacts` / `nwac-prod-artifacts`) first so larger migration/data-sync bundles do not hit SSM document size limits.

## Client Batch Import status

- Route: `/iset/imports/client-files`
- Current navigation label: `Configuration > Client Batch Import`
- Default access: System Administrator and Program Administrator
- Current upload support: one `.xlsx`, `.xlsm`, or `.csv` file per dry run
- Current limits: 5 MB and 500 data rows per run
- Current flow: upload -> dry run -> review -> commit
- Current matching order: raw `SIN`, prior case/submission `SIN` fallback, normalized email, then name + DOB
- Current commit model:
  - create a new `client` + application-less `iset_case`
  - create an application-less `iset_case` for an existing client
  - update the single existing case linked to the matched client
- Current non-goals:
  - no applicant `user` creation
  - no historical application recreation
  - no placeholder assessment/action-plan/intervention/document rows
- Read `docs/dashboards/client-file-import-dashboard.md` and `docs/guides/client-file-imports.md` before changing import UX or matching rules.

## Homepage dashboard context

- Public landing-page route: signed-out `/`
- Public landing-page rule: this page is a pre-sign-in NWAC staff access/support entry point, not a role-aware dashboard. Role-aware behavior starts after authentication on the signed-in home dashboards.
- Public landing-page UX rule: keep release notes secondary/opt-in on this page; do not let them dominate the initial staff sign-in experience.
- Homepage route: `/`
- Current homepage Metrics widget behavior is documented in `docs/dashboards/admin-home-metrics-widget.md`.
- Current homepage Work Queue widget behavior is documented in `docs/dashboards/admin-home-my-work-widget.md`.
- Current System Administrator homepage behavior is documented in `docs/dashboards/admin-home-system-admin-homepage.md`.
- Current System Administrator homepage rule: the default board now includes `Operations Snapshot`, `Bug & Change Requests`, `AWS Environment Status`, `Users & Access Alerts`, and `Recent Admin Activity`; the AWS widget is a read-only live check of staff/applicant Cognito plus SES mail for the active environment, not a generic infrastructure monitor.
- Shared help-panel AI chat prompt is built in `src/AppContent.js` (`buildSystemPrompt`). For coordinator-facing PATH workflows, treat that prompt as a staff job-aid layer and keep it aligned with NWAC training expectations, not just with page mechanics.
- Frontend files to inspect together:
  - `src/pages/home/HomeDashboardPage.jsx`
  - `src/pages/home/widgets/ProgramAdminWorkQueueWidget.js`
  - `src/pages/home/widgets/IsetCoordinatorWorkQueueWidget.js`
  - `src/pages/home/widgets/MetricsWidget.js`
  - `src/pages/home/widgets/WorkQueueItemsTableWidget.js`
- Current NWAC Administrator work-queue rule: the first queue card is `All Applications`, the second is `All Cases`, and the shared admin/manager queues follow them.
- Current NWAC Administrator open-application rule: `All Applications` is sourced from `/api/applications?excludeTerminal=1`, so the count/list excludes terminal application statuses rather than relying on a partial status list in the frontend.
- Current NWAC Administrator client-case rule: `All Cases` is sourced from `/api/dashboard/all-client-cases`, counts case rows rather than deduped clients, and excludes only `closed` and `archived` so `dormant` and `ready_to_close` stay visible.
- Current Regional Manager work-queue rule: the first queue card is `Applications in My Region`, the second is `Clients in My Region`, and `My Applications` follows them.
- Current Regional Manager application-queue region-scope rule: use all resolved `regionIds` from the current staff context (including `staff_region` mappings when present), include direct assignments to the manager, and include unassigned applications whose applicant address province/territory code matches one of those region codes.
- Current Regional Manager open-application rule: `Applications in My Region` is sourced from `/api/applications?excludeTerminal=1`, so the count/list excludes terminal application statuses rather than relying on a partial status list in the frontend.
- Current Regional Manager client-case rule: `Clients in My Region` is sourced from `/api/dashboard/regional-client-cases`, counts case rows rather than deduped clients, uses direct assignment plus owner-region/portfolio-region scope, and excludes only `closed` and `archived` so `dormant` and `ready_to_close` stay visible.
- Current drilldown rule: count metrics in the Metrics widget open the existing `Work Queue Items` widget in a dedicated metric-results mode; currency metrics do not open a row list.
- Current implementation rule: do not fake metric drilldown as another queue bucket. `Work Queue Items` now has separate queue mode and metric-results mode.
- Current scoping rule: Program Administrators see global metrics, Regional Coordinators must honor all resolved `regionIds`, and Application Assessors are owner-scoped.
- Current UX rule: do not add a Metrics-only region filter. If homepage geography scoping is added later, make it a shared page-level control that drives both Metrics and the Items drilldown.
- Current metric caveat: `Active Cases` is a current snapshot metric, so its drilldown list does not change with the selected period.

## Operational reporting context

- For PATH/NWAC operational reporting work, inspect workbook references in `docs/data` before designing report schemas or dashboard widgets.
- Verified reference workbook on 2026-03-19: `docs/data/NWAC - data info 2025-26.xlsx`.
- Current `Budgets and Finance > Financial Reports` implementation detail: route `/finance/reports` now presents the annual `ISET Advances and Active Clients` report with fiscal-year and region filtering, optional carry-over estimation, payment status, and Excel export. The current live backend endpoints are `/api/finance/reports/intervention-funding*`.
- Current `Budgets and Finance > Financial Reports` implementation detail: approved funding currently means approved intervention expense by `COALESCE(intervention.reviewed_at, intervention.created_at)`, reported one row per intervention and grouped/exportable by CRF vs EI. The same rows also expose payment follow-up based on payment-packet and finance-transaction state.
- Current workbook structure: `Sheet1` contains the working content and `Sheet2` is empty.
- The verified workbook includes sections for overall results targets vs year-end results, quarterly data uploads, and interventions, with instructions pointing to Data Gateway and ILMP workflows.
- Current management-reporting direction: keep dashboard naming, ordering, and layout closely aligned to the workbook so NWAC users can map the UI directly to the existing report.
- For reporting filters, use a shared report-controls block rather than per-section filters. Current `Budgets and Finance > Financial Reports` page-level controls are fiscal year, region (participant home province/territory), and the optional `Include carry-over` toggle.
- Current `Reporting > Data and Results` implementation detail: the `Intake and Assessment` section now leads the default layout and shows participant home province/territory rows with month columns. Its section header controls switch between `New applications`, `Approved applications`, and `Denied applications`, and include a text filter for the province rows.
- Current `Reporting > Data and Results` implementation detail: `New applications` use `iset_application_submission.submitted_at` for month bucketing. `Approved applications` and `Denied applications` currently use `iset_application.updated_at` as the best available decision-month proxy because PATH does not yet persist dedicated application decision timestamps/history.
- Current `Reporting > Data and Results` implementation detail: the `Interventions` section now also has section-level controls for show mode (`Count`, `Cost`), intervention status (`Completed`, `Planned`, `Active`, `Cancelled`), and date basis. The default workbook-aligned view is `Count` for `Completed` interventions by `By end date`; when `Cost` is selected, values are shown by payment month and completed interventions use actual cost when available.
- Current `Reporting > Data and Results` drilldown rule: in live mode, non-zero values in `Intake and Assessment` and `Interventions` open an inline detail panel directly beneath the clicked row rather than in a detached modal/popover or a separate page section.
- Current `Reporting > Data and Results` drilldown rule: `Intake and Assessment` drilldowns link applicant names to `/application-case/:caseId` when a linked case exists and otherwise fall back to the normal assignment/dashboard route. `Interventions` drilldowns link participant names to `/cases/:caseId`.
- Current `Reporting > Data and Results` drilldown rule: cumulative clicks show contributing records from fiscal-year start through the clicked month; monthly clicks show only the clicked month; `Final (p14)` still represents the full-year total and uses the full fiscal-year window even in monthly view.
- Current `Reporting > Data and Results` demo/dev rule: demo mode remains summary-only for drilldown. Do not imply that sample matrix values have live linked-record expansion unless demo drilldown rows are implemented explicitly.
- Geography for NWAC reporting means participant home province/territory unless explicitly stated otherwise.
- Current `Reporting > Data and Results` implementation direction: keep a workbook-aligned default layout, but render the report sections as full-width removable Cloudscape board items so users can hide and restore sections without changing the report controls.
- Current `Reporting > Data and Results` layout direction: `Intake and Assessment` is the first section shown under the report controls by default, followed by `Interventions`; removed sections should be restorable through standard board palette/header actions.
- Current `Reporting > Data and Results` demo/dev rule: support a `Demo mode` toggle in the report-controls header actions that populates the report with sample data, and make shared report filters apply to demo data too.
- Current `Reporting > Data and Results` demo/dev rule: demo figures should remain internally consistent across sections. In particular, sample overall results, client results, and intervention totals should reconcile with each other so the demo does not show contradictory numbers.
- Current `Reporting > Data and Results` live-data rule: `Quarterly Data Uploads` is backed by agreement-level `esdc_reporting_package` data, so it should stay workbook-aligned and explicitly note that participant home province/territory and case manager filters do not change that section.
- Current `Reporting > Data and Results` live-data rule: `Intake and Assessment`, `Overall Results`, `Interventions`, `Client Results`, `ILMP Data Uploads`, and `Status of Action Plans` are wired to PATH reporting aggregates derived from applications, action plans, interventions, and participant submission history, while `Additional Comments` is a saved fiscal-year narrative note stored in runtime config.
- Current `Reporting > Data and Results` ILMP-upload rule: only `Submitted` counts should be shown in `ILMP Data Uploads`; do not imply accepted/processed/error gateway outcomes unless PATH has a supported API/source for those values.
- Current `Reporting > Data and Results` configuration rule: the three AOP targets in the overall-results section are admin-editable from the dashboard and persist to fiscal-year-scoped runtime config keys like `reporting.dataAndResults / targets.<startYear>`, with read fallback to the older global `targets` key.
- Current `Reporting > Data and Results` configuration rule: `Additional Comments` is admin-editable from the dashboard and persists to runtime config under fiscal-year-scoped keys like `reporting.dataAndResults / additionalComments.<startYear>`.
- Current `Reporting > Data and Results` copy rule: user-visible descriptions, status text, help content, and empty-state messages should read as end-user reporting guidance for management/NWAC review, not as developer-facing implementation notes.
- Current `Reporting > Regional Snapshot` direction: treat it as a separate Board-style summary report, not an extension of `Data and Results`. Use a fixed regional snapshot layout, live PATH counts where available, and saved DB-backed manual inputs for reporting fields PATH does not yet support directly.

## Finance dashboard context

- `Budgets and Finance` is the current navigation label for the finance area.
- Current finance tracking direction: keep `Reporting` read-only/report-oriented and put editable finance/admin tracking dashboards under `Budgets and Finance`.
- Current finance-semantics rule: approved interventions are funding authority only. Live `committed` finance starts when a payment packet is sent to finance, and live `actual` finance starts only when PATH records a posted/confirmed payment.
- Current payments-workflow rule: approved interventions do not auto-create live payment packets. Staff create payment packets over time for the specific month, receipt, or claim period being sent to finance, and multiple packets may exist for the same intervention as long as total authorized funding is not exceeded.
- Current payments-status rule: canonical packet statuses are `draft`, `ready_to_send`, `submitted`, `confirmed`, and `cancelled`; canonical line statuses are `needs_evidence`, `ready_to_send`, `submitted`, `paid`, `held`, and `cancelled`. Optional `payment_batch` records may still group submitted lines, but batching is not itself a packet or line status.
- Current `Budgets and Finance > Financial Reports` implementation: fixed annual approved-funding page for CRF/EI intervention funding with slice-and-dice filters, province summary, intervention detail, finance follow-up, and workbook-style Excel export. It is not a configurable widget board anymore.
- Current `Budgets and Finance > Salaries` implementation: standard Cloudscape board dashboard backed by `finance_regional_salary_entry`, with a fiscal-year control, one editable annual salary row per province/territory, explicit budget-pot assignment, and derived monthly values shown for review.
- `Budgets and Finance > Salaries` is monthly total tracking only. It is not payroll, not AP processing, and not the accounting system of record.
- Current `Case Workspace > Case header` applicant-account rule: show `PATH Account Status` directly in the detail grid, and expose a quick action that creates/sends or resends applicant activation from the case itself so case managers do not need to leave the workspace for the common activation flow.
- Current `Case Workspace > Events timeline` rule: the case workspace now exposes the same case-event audit feed used in Application Workspace, both as an optional widget and through a `View audit trail` quick action that switches the board to a focused header + participant-details + events layout.

## Applicant account activation context

- Imported participant/applicant accounts now use a PATH-managed activation workflow anchored on `client`, not the legacy generic `user` admin model.
- Current schema anchor: `client.applicant_cognito_sub`, `client.applicant_cognito_username`, `client.applicant_account_status`, `client.applicant_account_email`, `client.applicant_invited_at`, `client.applicant_invited_by_staff_profile_id`, and `client.applicant_activated_at`, plus audit table `client_applicant_account_event`.
- Current visible PATH statuses are `No account`, `Ready to invite`, `Invitation sent`, and `Activated`.
- Current import rule: client-file import may silently create/link an applicant Cognito account only when the row resolves to exactly one clean email. Missing, invalid, partially invalid, or multiple email values must suppress account creation while still allowing the client/case import path when otherwise valid.
- Current no-cold-email rule: import must never send Cognito welcome mail or PATH activation mail. Account creation uses Cognito admin APIs with message suppression only.
- Current activation rule: PATH sends its own branded `Activate your account` email later as a manual staff action; the public portal wraps Cognito forgot-password mechanics behind `/activate-account` and activation-specific copy so applicants are never told they have “forgotten” a password they never set.
- Current identity-link rule: one client maps to one applicant account. Reuse an existing linked applicant Cognito user for repeat imports rather than creating duplicates.
- Current workflow-anchor rule: PATH owns invitation state and timestamps on `client`; Cognito remains the identity store; the legacy `user` table is still seeded/linked so public-portal auth continues to work.
- Current activation-complete rule: mark applicant accounts `Activated` on the first successful authenticated portal session, not when an invitation is sent and not merely when a reset code is requested.
- Current user-management rule: `Manage Users` now has an `Applicant Accounts` tab for this workflow, and `Application Assessor` may access that tab even though staff-user administration remains restricted.

## Known pitfalls

- Program Admin "Unassigned Applications" must use `/api/applications`, not `/api/cases`, or applicant names are missing.
- NWAC Administrator homepage `All Cases` must use `/api/dashboard/all-client-cases`, not the generic `/api/cases` list, because the homepage queue is case-based and must exclude only `closed` and `archived` while keeping global scope.
- Regional Manager homepage `Clients in My Region` must use `/api/dashboard/regional-client-cases`, not the generic `/api/cases` list, because the homepage queue is case-based and must respect owner-region/portfolio-region scope with only `closed` and `archived` excluded.
- Schema allows `iset_case.application_id = NULL`, and core case create/update/list flows now support client-file cases.
- Supporting Documents now has a case-based mode for application-less client files: it reads from `GET /api/cases/:id/documents`, uploads through `POST /api/cases/:id/documents/upload`, hides the checklist tab, and allows `client`, `case`, `action_plan`, plus application-type document categories. When no linked application exists, application-type uploads fall back to action-plan or case storage instead of requiring a fake application record. This rule is keyed to the case having no linked `application_id`, not to whether the client happens to have a linked PATH account.
- Secure Messaging now supports application-less client-file cases when the case is linked to a participant PATH account; imported cases without a participant account can still manage documents, plans, and interventions, but messaging remains unavailable until that account exists.
- Applicant-facing secure-message/document-reminder emails only render clickable portal links when the public-portal runtime can resolve a portal URL. Preferred envs are `APPLICANT_PORTAL_URL` / `APPLICANT_PORTAL_BASE`; runtime fallback also checks `PUBLIC_PORTAL_BASE_URL`, `REACT_APP_PORTAL_URL`, `REACT_APP_API_BASE_URL`, and `PORTAL_DOMAIN`. If none resolve in production, `[link url="{portal_dashboard_url}"]...[/link]` degrades to plain text with no anchor.
- Case Header now exposes explicit backload quick actions on application-less cases: `Add existing action plan`, `Add existing intervention`, and `Upload existing documents`.
- Current backload integrity rule: `Add existing intervention` must preserve real plan/intervention lifecycle state. Archived plans are read-only, closed plans can receive only `completed`/`cancelled` interventions, `in_progress`/`suspended` interventions require an active plan, closed backloaded interventions must carry an end date, and `manual_backload` interventions must stay silent on later edit/close flows instead of auto-creating payment-packet, finance-email, or CFA side effects. Their `actual amount` now writes historical posted finance ledger history only; unpaid remainder should move into a new live intervention.
- Coordinator-facing Case Workspace help panels and embedded AI guidance should explicitly support imported/application-less backload work. When relevant, explain the Case Header quick actions, the silent historical nature of those actions, the intervention lifecycle guardrails, and the case-based document fallback when no linked `application_id` exists.
- `src/widgets/CaseCalendarWidget.js` is shared by the case workspace and application workspace. Treat date-only values (`YYYY-MM-DD`) as local Canadian calendar dates; UTC-based parsing/weekday anchors will shift headers or event days backward.
- Tutorial updates must be validated end-to-end (including `Next` progression on every step) so no step dead-ends due to missing hotspots.
- If a change introduces new deployment artifacts, update the relevant deploy script(s) so files are staged.

## Documentation maintenance

- Update `docs/meta/changelog.md` for user-visible or operational changes.
- Record major structural doc reorganizations in `docs/meta/project-map.md`.
- Maintain `docs/meta/next-release-notes-log.md` as a standing running log for the next Landing Page "What's New" update.
- Keep release-note entries tagged with an explicit target release number (for example `v0.5.4`) and verify the current public version from `src/pages/LandingPage.jsx` before drafting or updating entries.
- Keep credentials and environment-specific secrets out of docs.
- The thread index exists to recover the exact item in Codex Task History. The Task History label is the point of the index; topic labels are only fallback search aids.
- When updating `docs/meta/codex-thread-index.md` for the current thread, record the exact Codex Task History label verbatim. If the user gives you the label, store that exact string even if the thread later covers additional topics.
- Do not substitute a descriptive topic label for the Task History label. A human-written summary heading is not an acceptable replacement for the recovery key.
- Do not create or finalize a new thread-index entry for the current thread unless the exact Task History label is known. If it is not visible in the current session, ask the user for it first.
- Only use `exact original task title not preserved` for true historical backfills where the original Task History label cannot be recovered. Those entries should be treated as incomplete recovery records, not first-class indexed threads.
- When refactoring dashboards/widgets, update matching help panel content (`src/helpPanelContents/*`) and related `aiContext` strings in the same change.
- Coordinator-facing PATH help content should bias toward staff workflow, compliance reminders, timelines, documentation expectations, and next-step coaching instead of frontend implementation detail.
- When AI help output quality is part of the task, validate both layers: the page/widget `aiContext` in `src/helpPanelContents/*` and the shared help-chat system prompt in `src/AppContent.js`.
- For Case Workspace backload flows, validate both layers against imported/application-less use cases: page/widget help should mention historical action plans, interventions, and supporting documents, and the shared AI prompt should reinforce the same silent-workflow and no-fake-application rules.

## Database documentation and access

- Start at `docs/data/database-documentation.md` for DB index and cross-app pointers.
- When tables/columns/relationships change, update the index and linked domain docs.
- Regenerate schema dump after schema changes (do not commit dump files):
  `npm run dump:dev-schema`

### DB interaction from WSL (dev)

- MySQL runs on the Windows host and accepts local connections.
- Verified on 2026-04-04: the new shared-schema CLI can reach DEV from the sandbox via the repo `.env` when invoked through the Windows Node runtime:
  `"/mnt/c/Program Files/nodejs/node.exe" scripts/path-schema-migrate.js plan`
- Use Windows MySQL client from WSL (not Linux `mysql`):
  `"/mnt/c/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" -h localhost -P 3306 -u root -p"<from .env>" -D iset_intake -e "SELECT 1;"`
- Read credentials from `.env`: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`.
- Connectivity check:
  `"/mnt/c/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" -h localhost -P 3306 -u root -p"<from .env>" -D iset_intake -e "SELECT DATABASE() AS db, @@hostname AS host, @@port AS port;"`
- Schema discovery:
  - Tables: `... -e "SHOW TABLES;"`
  - Table DDL: `... -e "SHOW CREATE TABLE <table_name>\\G"`
  - Recent rows: `... -e "SELECT * FROM <table_name> ORDER BY id DESC LIMIT 10;"`
- Safe write workflow for test data:
  - Confirm table/columns with `SHOW CREATE TABLE`.
  - Wrap writes in `START TRANSACTION; ...; COMMIT;` (or `ROLLBACK;`).
  - Use clearly tagged dummy values like `DUMMY_` and `TEST_`.

### Test DB interaction from Codex/WSL

- Verified on 2026-03-28: the Codex sandbox can run SQL against TEST indirectly through SSM on a live `nwac-test-app` EC2 instance using AWS profile `nwac-test`.
- Do not assume direct network access from the sandbox to the Aurora cluster. The test DB security group only allows MySQL from the app security group, so the normal Codex path is remote execution on the app host.
- Preferred helper for future chats: `scripts/run-test-sql-via-ssm.sh`
- Preferred config/data promotion entry point: `npm run data:sync:plan -- --dataset <name> ...` followed by `npm run data:sync:apply -- --target-env test ...`
- Preferred full TEST reset entry points: `npm run test:db:refresh:plan -- --source-env dev` and `npm run test:db:refresh -- --source-env dev --yes`
- Supporting guide: `docs/guides/test-db-access-from-codex.md`
- Current caveat: older scripts such as `scripts/deploy-test-db.ps1` reference retired test instance IDs; re-check live AWS resources before trusting those IDs.
- Current schema rule: treat `admin-dashboard/sql/migrations/` -> `iset_migration` as the canonical PATH shared-schema path. Treat `admin-dashboard/sql/ops/` as manual-only SQL, `admin-dashboard/db/migrations/` as legacy archive, and the portal-side `__migrations` / `schema_migrations` paths as retired for deployed PATH schema work unless a thread explicitly proves otherwise.
- Never run destructive broad statements unless explicitly requested.
- If host DB access fails from WSL, run `npm run dump:dev-schema` and continue with read-only analysis from docs.

## Prod start/stop reference (NWAC, ca-central-1)

Use these commands to shut down or restart prod for cost savings (all in `ca-central-1`).

Shutdown:
- Scale ASG to zero:
  - `aws autoscaling update-auto-scaling-group --region ca-central-1 --auto-scaling-group-name nwac-prod-asg --min-size 0 --desired-capacity 0`
- Stop Aurora cluster:
  - `aws rds stop-db-cluster --region ca-central-1 --db-cluster-identifier nwac-prod-db`
- Verify:
  - `aws autoscaling describe-auto-scaling-groups --region ca-central-1 --auto-scaling-group-names nwac-prod-asg --query 'AutoScalingGroups[0].{Min:MinSize,Desired:DesiredCapacity,Instances:Instances[].[InstanceId,LifecycleState,HealthStatus]}' --output table`
  - `aws rds describe-db-clusters --region ca-central-1 --db-cluster-identifier nwac-prod-db --query 'DBClusters[0].Status' --output text`

Restart:
- Start Aurora cluster:
  - `aws rds start-db-cluster --region ca-central-1 --db-cluster-identifier nwac-prod-db`
- Scale ASG back up:
  - `aws autoscaling update-auto-scaling-group --region ca-central-1 --auto-scaling-group-name nwac-prod-asg --min-size 1 --desired-capacity 1`
- Optional: after uploading new `admin-dashboard-latest.zip`, force replacement so new artifact is pulled:
- `aws autoscaling start-instance-refresh --region ca-central-1 --auto-scaling-group-name nwac-prod-asg --preferences MinHealthyPercentage=100,InstanceWarmup=180,SkipMatching=false`
- Verify:
  - `aws autoscaling describe-auto-scaling-groups --region ca-central-1 --auto-scaling-group-names nwac-prod-asg --query 'AutoScalingGroups[0].{Min:MinSize,Desired:DesiredCapacity,Instances:Instances[].[InstanceId,LifecycleState,HealthStatus]}' --output table`
  - `aws rds describe-db-clusters --region ca-central-1 --db-cluster-identifier nwac-prod-db --query 'DBClusters[0].Status' --output text`

Notes:
- This stops compute + database, but ALB/NAT/EIP/VPC endpoint costs may remain.
- Confirm target AWS account before running commands:
  `aws sts get-caller-identity`
- Do not use deploy-script `-SkipBuild` for admin or portal unless you have already inspected the current `build/` output and confirmed it was compiled for the target environment. The compiled React bundle bakes Cognito domains, client IDs, and portal/admin links, so a stale test build can ship test sign-in targets to prod even when prod SSM/runtime env is correct.

### AWS CLI profile/account mapping (Codex sandbox)

- Keep prod and test identities as separate AWS CLI profiles; never rely on implicit defaults.
- Current known mappings in this Codex environment (re-verified 2026-04-04):
  - `default` -> `arn:aws:iam::468278742295:user/nwac-prod-automation` (prod account `468278742295`)
  - `nwac-prod` -> `arn:aws:iam::468278742295:user/nwac-prod-automation` (dedicated prod alias for Codex/operator use)
  - `nwac-test` -> `arn:aws:iam::124355655255:user/CODEX_CLI_Admin` (test account `124355655255`)
- `npm`-spawned Windows processes do not share the same AWS config home as the bash/WSL sandbox. If an operator script needs AWS access from inside a Node/npm process, route the AWS CLI call through `bash` so it reads the Codex-managed profile set under `/root/.aws`.
- Always pass `--profile` for AWS commands in threads that touch infra or storage:
  - Test example: `aws s3api get-bucket-encryption --bucket nwac-test-uploads-20251014 --region ca-central-1 --profile nwac-test`
  - Prod example: `aws sts get-caller-identity --profile nwac-prod`

## Cross-app boundaries

- Admin dashboard and public portal are separate apps/repos.
- Do not copy env files or code between apps without explicit approval.
- Confirm which renderer you are editing before making intake-rendering changes.
- PATH-generated SES sender email is now shared through `iset_runtime_config` (`scope='notifications'`, `k='path.email'`) and edited from the admin Notification Settings widget; keep admin and portal mailers aligned to that runtime value rather than hardcoded app-local defaults.
- Staff bell alerts are fetched from `/api/me/notifications`, backed by `iset_internal_notification`, and rendered in the app shell `Flashbar` from `src/AppContent.js`.
- Current bell-alert timestamp rule: the heading uses `delivered_at` when populated and otherwise `created_at`, formatted in the viewer browser's IANA timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`, with `America/Toronto` as the fallback display timezone.
- Current timezone limitation: no staff/applicant timezone preference is persisted in the database yet. Treat the stored notification row timestamp as the audit/source-of-truth value, and do not infer a person's timezone from province/region alone.
- Reminder due/overdue classification is intentionally not viewer-local. Reminder events, Case Calendar reminder badges, and note follow-up badges all use the PATH business day in `America/Toronto`, ignoring time-of-day when deciding whether a reminder is due today or overdue.
