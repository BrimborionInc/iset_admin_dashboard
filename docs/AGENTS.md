# Admin Dashboard Assistant Context

Purpose: persistent context for future threads.

This file is a fast onboarding and handoff document for assistants and developers working in the admin dashboard repo. It should help a new thread start quickly, avoid repeated mistakes, and find the right code/docs/data locations with minimal back-and-forth.

Audience: assistants and developers.
Last Updated: 2026-03-23

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
- Confirm real behavior from code/API payloads before changing UI.
- For dashboard/widget work, read `docs/guides/configurable-dashboard-notes.md` first.
- Keep doc updates in the same change when behavior or structure changes.
- If blocked by tooling, permissions, or environment access, call it out immediately.

## Core conventions

- Prefer Cloudscape components over native HTML. Use `Link` from `@cloudscape-design/components` instead of raw `<a>` unless there is no Cloudscape equivalent.
- Do not assume parity with the public portal. Verify the full chain:
  schema -> runtime config JSON -> API payload -> renderer/template.
- When adding/changing UI fields, confirm the backend actually returns the data.
- Fix root causes instead of layering workarounds.

## Development data policy (no legacy fallbacks)

- This system is in active development; do not assume legacy data constraints by default.
- After refactors, dev/test databases can be purged of old records that would otherwise require backward-compatibility handling.
- As a principle, avoid adding legacy fallback fields, compatibility branches, or dual-write/dual-read logic when they increase code or data complexity without current operational need.
- Prefer a clean target model and simple code paths. Only introduce compatibility handling when explicitly required and validated from current production constraints.

## High-value repo map

- Docs base path: `X:\ISET\admin-dashboard\docs` (WSL: `/mnt/x/ISET/admin-dashboard/docs`)
- Client-file import guide: `docs/guides/client-file-imports.md`
- Client Batch Import dashboard reference: `docs/dashboards/client-file-import-dashboard.md`
- Query Editor dashboard reference: `docs/dashboards/query-editor-dashboard.md`
- Operational reporting workbook reference: `docs/data/NWAC - data info 2025-26.xlsx`
- Admin intake preview renderer: `apps/web/src/features/intake/ComponentRenderer.tsx`
- Public portal renderer (other repo): `../ISET-intake/src/renderer/renderers.js`
- Help panel content: `src/helpPanelContents/*`
- Admin test deploy staging script: `scripts/deploy-admin-test.ps1`
- Portal test deploy staging script: `../ISET-intake/scripts/deploy-portal-test.ps1`

## Documentation gateway

- Start here for current orientation, then go deeper into the docs below rather than relying on planning notes alone.
- Live dashboard behavior: `docs/dashboards/*`
- Import and data-backload constraints: `docs/guides/client-file-imports.md`
- Client Batch Import dashboard: `docs/dashboards/client-file-import-dashboard.md`
- Widget-level docs index: `docs/widgets/admin/README.md`
- Workflow-level docs index: `docs/workflows/admin/README.md`
- Project structure / architecture map: `docs/meta/project-map.md`
- Historical plans and design notes: `docs/planning/*` (useful for intent/history, but verify against code before treating as current behavior)

## Query Editor status

- Route: `/configuration/query-editor`
- Default access: System Administrator only
- Current input model: typed/pasted SQL text in the dashboard editor, plus single-file `.sql` / `.txt` upload that loads file contents into the editor
- Current execution model: frontend posts `{ sql }` to `/api/admin/query-editor`; backend executes one or more semicolon-delimited statements against the active environment DB connection
- Current file-upload constraint: client-side upload limit is 900 KB so requests stay within the server's 1 MB JSON body limit
- Current result handling: `SELECT` results are capped at 100 rows per statement; write statements return rows affected/status; multiple statements use a result-set selector
- Separate path to keep distinct: the startup migration runner executes `.sql` files from `/sql`, but that is not the Query Editor dashboard

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

## Operational reporting context

- For PATH/NWAC operational reporting work, inspect workbook references in `docs/data` before designing report schemas or dashboard widgets.
- Verified reference workbook on 2026-03-19: `docs/data/NWAC - data info 2025-26.xlsx`.
- Current workbook structure: `Sheet1` contains the working content and `Sheet2` is empty.
- The verified workbook includes sections for overall results targets vs year-end results, quarterly data uploads, and interventions, with instructions pointing to Data Gateway and ILMP workflows.
- Current management-reporting direction: keep dashboard naming, ordering, and layout closely aligned to the workbook so NWAC users can map the UI directly to the existing report.
- For reporting filters, use a shared report-controls block rather than per-section filters. Current page-level controls are participant home province/territory, case manager, fiscal year, and a results-view segmented control for cumulative vs monthly values; demo mode currently lives in the report-controls header actions.
- Current `Reporting > Data and Results` implementation detail: the `Interventions` section now also has section-level controls for show mode (`Count`, `Cost`), intervention status (`Completed`, `Planned`, `Active`, `Cancelled`), and date basis. The default workbook-aligned view is `Count` for `Completed` interventions by `By end date`; when `Cost` is selected, values are shown by payment month and completed interventions use actual cost when available.
- Geography for NWAC reporting means participant home province/territory unless explicitly stated otherwise.
- Current `Reporting > Data and Results` implementation direction: keep a workbook-aligned default layout, but render the report sections as full-width removable Cloudscape board items so users can hide and restore sections without changing the report controls.
- Current `Reporting > Data and Results` layout direction: `Interventions` is the first section shown under the report controls by default; removed sections should be restorable through standard board palette/header actions.
- Current `Reporting > Data and Results` demo/dev rule: support a `Demo mode` toggle in the report-controls header actions that populates the report with sample data, and make shared report filters apply to demo data too.
- Current `Reporting > Data and Results` demo/dev rule: demo figures should remain internally consistent across sections. In particular, sample overall results, client results, and intervention totals should reconcile with each other so the demo does not show contradictory numbers.
- Current `Reporting > Data and Results` live-data rule: `Quarterly Data Uploads` is backed by agreement-level `esdc_reporting_package` data, so it should stay workbook-aligned and explicitly note that participant home province/territory and case manager filters do not change that section.
- Current `Reporting > Data and Results` live-data rule: `Overall Results`, `Interventions`, `Client Results`, `ILMP Data Uploads`, and `Status of Action Plans` are wired to PATH reporting aggregates derived from action plans, interventions, and participant submission history, while `Additional Comments` is a saved fiscal-year narrative note stored in runtime config.
- Current `Reporting > Data and Results` ILMP-upload rule: only `Submitted` counts should be shown in `ILMP Data Uploads`; do not imply accepted/processed/error gateway outcomes unless PATH has a supported API/source for those values.
- Current `Reporting > Data and Results` configuration rule: the three AOP targets in the overall-results section are admin-editable from the dashboard and persist to fiscal-year-scoped runtime config keys like `reporting.dataAndResults / targets.<startYear>`, with read fallback to the older global `targets` key.
- Current `Reporting > Data and Results` configuration rule: `Additional Comments` is admin-editable from the dashboard and persists to runtime config under fiscal-year-scoped keys like `reporting.dataAndResults / additionalComments.<startYear>`.
- Current `Reporting > Data and Results` copy rule: user-visible descriptions, status text, help content, and empty-state messages should read as end-user reporting guidance for management/NWAC review, not as developer-facing implementation notes.
- Current `Reporting > Regional Snapshot` direction: treat it as a separate Board-style summary report, not an extension of `Data and Results`. Use a fixed regional snapshot layout, live PATH counts where available, and saved DB-backed manual inputs for reporting fields PATH does not yet support directly.

## Finance dashboard context

- `Budgets and Finance` is the current navigation label for the finance area.
- Current finance tracking direction: keep `Reporting` read-only/report-oriented and put editable finance/admin tracking dashboards under `Budgets and Finance`.
- Current `Budgets and Finance > Salaries` implementation: standard Cloudscape board dashboard backed by `finance_regional_salary_entry`, with a fiscal-year control, one editable annual salary row per province/territory, explicit budget-pot assignment, and derived monthly values shown for review.
- `Budgets and Finance > Salaries` is monthly total tracking only. It is not payroll, not AP processing, and not the accounting system of record.

## Known pitfalls

- Program Admin "Unassigned Applications" must use `/api/applications`, not `/api/cases`, or applicant names are missing.
- Schema allows `iset_case.application_id = NULL`, and core case create/update/list flows now support client-file cases.
- Supporting Documents now has a case-based mode for application-less client files: it reads from `GET /api/cases/:id/documents`, uploads through `POST /api/cases/:id/documents/upload`, hides the checklist tab, and allows `client`, `case`, `action_plan`, plus application-type document categories. When no linked application exists, application-type uploads fall back to action-plan or case storage instead of requiring a fake application record.
- Secure Messaging still depends on applicant/application linkage today; imported client-file cases without a participant account can manage documents, plans, and interventions but still cannot message the client until a participant account exists.
- Case Header now exposes explicit backload quick actions on application-less cases: `Add existing action plan`, `Add existing intervention`, and `Upload existing documents`.
- Tutorial updates must be validated end-to-end (including `Next` progression on every step) so no step dead-ends due to missing hotspots.
- If a change introduces new deployment artifacts, update the relevant deploy script(s) so files are staged.

## Documentation maintenance

- Update `docs/meta/changelog.md` for user-visible or operational changes.
- Record major structural doc reorganizations in `docs/meta/project-map.md`.
- Maintain `docs/meta/next-release-notes-log.md` as a standing running log for the next Landing Page "What's New" update.
- Keep release-note entries tagged with an explicit target release number (for example `v0.5.4`) and verify the current public version from `src/pages/LandingPage.jsx` before drafting or updating entries.
- Keep credentials and environment-specific secrets out of docs.
- When refactoring dashboards/widgets, update matching help panel content (`src/helpPanelContents/*`) and related `aiContext` strings in the same change.

## Database documentation and access

- Start at `docs/data/database-documentation.md` for DB index and cross-app pointers.
- When tables/columns/relationships change, update the index and linked domain docs.
- Regenerate schema dump after schema changes (do not commit dump files):
  `npm run dump:dev-schema`

### DB interaction from WSL (dev)

- MySQL runs on the Windows host and accepts local connections.
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
  - `aws autoscaling start-instance-refresh --region ca-central-1 --auto-scaling-group-name nwac-prod-asg --preferences MinHealthyPercentage=100,InstanceWarmup=900,SkipMatching=false`
- Verify:
  - `aws autoscaling describe-auto-scaling-groups --region ca-central-1 --auto-scaling-group-names nwac-prod-asg --query 'AutoScalingGroups[0].{Min:MinSize,Desired:DesiredCapacity,Instances:Instances[].[InstanceId,LifecycleState,HealthStatus]}' --output table`
  - `aws rds describe-db-clusters --region ca-central-1 --db-cluster-identifier nwac-prod-db --query 'DBClusters[0].Status' --output text`

Notes:
- This stops compute + database, but ALB/NAT/EIP/VPC endpoint costs may remain.
- Confirm target AWS account before running commands:
  `aws sts get-caller-identity`

### AWS CLI profile/account mapping (Codex sandbox)

- Keep prod and test identities as separate AWS CLI profiles; never rely on implicit defaults.
- Current known mappings in this Codex environment (verified 2026-03-09):
  - `default` -> `arn:aws:iam::468278742295:user/nwac-prod-automation` (prod account `468278742295`)
  - `nwac-test` -> `arn:aws:iam::124355655255:user/CODEX_CLI_Admin` (test account `124355655255`)
- Always pass `--profile` for AWS commands in threads that touch infra or storage:
  - Test example: `aws s3api get-bucket-encryption --bucket nwac-test-uploads-20251014 --region ca-central-1 --profile nwac-test`
  - Prod example: `aws sts get-caller-identity --profile default`

## Cross-app boundaries

- Admin dashboard and public portal are separate apps/repos.
- Do not copy env files or code between apps without explicit approval.
- Confirm which renderer you are editing before making intake-rendering changes.
