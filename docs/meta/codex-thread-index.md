# Codex Thread Index

Purpose: searchable index of durable notes, handoff docs, and thread-born findings that future chats may need to recover quickly when prior chat history is unavailable.

Last Updated: 2026-04-05

## How to use

- Start here when the user references "another chat", "previous thread", "there should be a note", or asks for context that is not visible in the current session.
- Search this file using the user's own words first, then open the linked canonical doc instead of relying on the short index summary.
- Keep entries focused on cross-thread recovery value. This is not a changelog and should not duplicate normal release-note logging.
- When a thread produces durable context that a future chat is likely to need, either update an existing canonical doc and add it here, or create a short handoff note and index it here in the same change.
- Prefer canonical docs by type:
  - operational/how-to guidance -> `docs/guides/*`
  - design or decision handoffs -> `docs/planning/*`
  - repo-wide durable context -> `docs/AGENTS.md` or `docs/meta/*`

## Entry format

For each indexed thread/topic, keep:

- `Codex task title`: exact task/chat title from the Codex plugin history when known; if it was not captured, say so explicitly
- `Topic`: short human-readable label
- `Keywords`: terms a future chat is likely to search
- `When to open`: concrete trigger conditions
- `Primary docs`: canonical docs/scripts to open next
- `Status`: whether the note is current, partial, or superseded

## Indexed Topics

### Admin-console bug reporting and change requests

- Codex task title: `This task is to create an in-app bug reporting and change request function on the admin-console side.`
- Topic: in-app staff bug-reporting / change-request flow plus System Administrator homepage triage
- Keywords: `bug reporting`, `change request`, `admin console help`, `top header bug button`, `floating report window`, `floating review window`, `system administrator homepage`, `Bug & Change Requests widget`, `admin_feedback_report`, `admin_feedback_attachment`, `admin_feedback_status_history`, `admin_feedback_note`
- When to open: the user asks how internal PATH staff are supposed to report admin-console issues from inside the app, asks where the floating report or review windows are wired, asks how Sysadmins triage those reports from the homepage, or asks whether those uploads use Supporting Documents or their own storage model
- Primary docs:
  - `docs/features/admin-feedback-reporting.md`
  - `docs/AGENTS.md`
  - `docs/meta/project-map.md`
- Status: current as of 2026-04-05
- Notes: durable decisions from this thread: the report entry point is a dedicated top-header button beside `Admin Console Help`; the launcher flow is top-nav button -> help panel instructions -> floating non-modal report window; page context is captured when the window opens so staff can keep navigating while writing; and persistence is intentionally separate from `iset_document` because bug/change evidence is not a client/application/case document. A later pass in the same feature added System Administrator homepage triage via the `Bug & Change Requests` widget plus a floating review panel with status changes and internal notes. The canonical schema migrations are `sql/migrations/20260405_0001_create_admin_feedback_reporting.sql` and `sql/migrations/20260405_0002_create_admin_feedback_management_tables.sql`, and the backend routes now include `POST /api/admin/feedback-reports`, `GET /api/dashboard/system-admin-feedback-reports`, `GET /api/admin/feedback-reports/:id`, `PATCH /api/admin/feedback-reports/:id/status`, and `POST /api/admin/feedback-reports/:id/notes`.

### Client-file backload action-plan and intervention rules

- Codex task title: `Improve back-loaded case flow`
- Topic: imported/application-less case backload rules for existing action plans and existing interventions
- Keywords: `Improve back-loaded case flow`, `back-loaded case flow`, `client-file backload`, `existing action plan`, `existing intervention`, `manual_backload`, `application-less case`, `closed plan`, `in progress intervention`, `archived plan`
- When to open: the user asks how imported pre-PATH clients are supposed to add historical plans/interventions, asks whether backload actions are allowed to create open interventions on closed plans, or asks what lifecycle constraints apply to the Case Header backload actions
- Primary docs:
  - `docs/guides/client-file-imports.md`
  - `docs/widgets/admin/case-header-widget.md`
  - `docs/AGENTS.md`
- Status: current as of 2026-04-05
- Notes: the current operating rule is that client-file import creates only the client plus application-less case, while historical plans/interventions are added later through Case Header backload actions. Those backload actions stay silent, and `manual_backload` interventions stay silent on later edit/close flows too: no approval routing, checklist progression, notifications, payment-packet generation, or finance-email side effects. They must still preserve real lifecycle state: archived plans are read-only, closed plans can receive only completed/cancelled interventions, in-progress or suspended interventions require an active plan, and historical start/result/end dates now seed the stored lifecycle timestamps used by the workspace. Finance handling is now history-only: `actual amount` on a backloaded intervention writes a posted historical ledger entry for reporting/budget burn, while unpaid remainder should move into a new live intervention.

### PATH deployment model and canonical shared-schema migrations

- Codex task title: `Plan deployment strategy`
- Topic: PATH deployment formalization, with canonical shared-schema migration ownership moved to the admin repo
- Keywords: `deployment model`, `dev test prod`, `canonical migrations`, `sql/migrations`, `sql/ops`, `path-schema-migrate`, `AUTO_MIGRATE=false`, `portal migrations`
- When to open: the user asks how PATH deployments are meant to work across dev/test/prod, asks which repo owns DB migrations, asks why the portal no longer auto-migrates in deployed environments, or asks how to preflight/apply shared-schema migrations before a deploy
- Primary docs:
  - `docs/ops/migration-runner.md`
  - `docs/ops/deployments/path-deploy-orchestrator.md`
  - `docs/data/database-overview.md`
  - `docs/AGENTS.md`
  - `scripts/path-schema-migrate.js`
- Status: current as of 2026-04-04
- Notes: this thread established `admin-dashboard/sql/migrations/` as the canonical PATH shared-schema path tracked by `iset_migration`, moved one-off/manual SQL into `admin-dashboard/sql/ops/`, documented `admin-dashboard/db/migrations/` as legacy archive only, and updated deployed portal paths to force `AUTO_MIGRATE=false`. It also captured the intended deployment direction: use an explicit DB preflight/apply step instead of relying on app startup or the legacy portal runners for test/prod schema work.
- Follow-on implementation in the same thread added `scripts/path-data-sync.js`, the `docs/ops/deployments/data-promotion-catalog.md` allowlist, and a bash `scripts/run-prod-sql-via-ssm.sh` helper so Codex can promote the published intake runtime row and workflow-authoring graph to TEST/PROD through explicit commands instead of manual SQL bundles.
- The same thread later added `scripts/path-deploy.js` plus the `docs/ops/deployments/path-deploy-orchestrator.md` runbook, making `npm run path:deploy` the preferred operator entry point. Durable outcomes from that phase: remote canonical schema plan/apply now supports `--target-env test|prod`; TEST smoke uses ALB target-group health (`nwac-test-admin-tg`, `nwac-test-portal-tg`) because public TEST `/healthz` currently returns `403` to Codex; release manifests are written locally under `tmp/path-deploy/`; and the TEST component deploy scripts now default to AWS profile `nwac-test`. On 2026-04-04 a dedicated `nwac-prod` profile alias was added in the Codex sandbox and the control-plane defaults were switched to it, so future prod operator work should use `nwac-prod` instead of relying on `default`. The same day, read-only prod verification confirmed that `npm` in this workspace runs under Windows Node while the trusted AWS profiles live in the bash/WSL CLI config, so AWS-backed Node/npm operator calls must shell through `bash`; the thread also captured that prod DB secret `nwac-prod-db-credentials` currently stores credentials only, so the prod SSM SQL helper supplies the default cluster host/database/port itself.
- Follow-on completion in the same thread closed the remaining lifecycle gaps: `scripts/path-test-db-refresh.js` is now a real destructive TEST reset command (with `plan` and `run --yes`) that can generate its own DEV-derived baseline snapshot, backed by `scripts/run-test-db-restore-via-ssm.sh`, and prod `path:deploy` plans/runs now include an explicit restore-point step that auto-captures an Aurora snapshot for `nwac-prod-db` before DB-affecting prod mutations. The same final pass added `--refresh-test-db` to `scripts/path-deploy.js`, so Codex can now run a one-command TEST reset + redeploy path with no manual dump-taking from the user.
- Final operational completion in the same thread verified the control plane against live environments: a non-destructive prod release (`20260404-142139`) completed through `path:deploy`, later followed by an admin-only prod refresh (`20260404-144835`) and a matching admin-only TEST rollout using the same release ID. The same pass added a visible frontend build stamp (package version + release ID + git SHA) to the admin landing-page footer and public portal Help page so operators can confirm which release is deployed without checking AWS.

### System Administrator homepage widgets

- Codex task title: `Suggest admin homepage widgets`
- Topic: redesigning the System Administrator homepage away from the old stub/development-tracker layout into an operations board with actionable admin widgets
- Keywords: `Suggest admin homepage widgets`, `System Administrator homepage`, `Operations Snapshot`, `Bug & Change Requests`, `AWS Environment Status`, `Users & Access Alerts`, `Recent Admin Activity`, `admin-home-layout-v10`
- When to open: the user references the chat where the System Administrator homepage was redesigned, asks why `Metrics` is hidden for System Administrators, asks what widgets belong on the admin homepage, or asks where the AWS/Cognito/SES status tile came from
- Primary docs:
  - `docs/dashboards/admin-home-system-admin-homepage.md`
  - `docs/AGENTS.md`
  - `docs/meta/changelog.md`
- Status: current as of 2026-04-03
- Notes: this thread replaced the prior System Administrator homepage direction with an exception-driven operational board. Durable outcomes include the live `Operations Snapshot`, `Recent Admin Activity`, `Users & Access Alerts`, and `AWS Environment Status` widgets; the rule that these widgets should prefer schema-free aggregate endpoints; the rule that the AWS widget stays read-only and focused on PATH-backed services rather than generic infrastructure monitoring; and the current System Administrator default layout storage key `admin-home-layout-v9`. A later follow-up added the `Bug & Change Requests` widget plus floating review-panel integration and moved the layout storage key to `admin-home-layout-v10`.

### Prod portal hostname cutover

- Codex task title: `Confirm Excel import support`
- Topic: production public-portal cutover from `nwac-public.awentech.ca` to `iset.nwac.ca` while retaining the old hostname
- Keywords: `iset.nwac.ca`, `prod portal hostname`, `production environment`, `live production environment`, `nwac-public.awentech.ca`, `prod cutover`, `prod portal domain`, `production domain`
- When to open: the user asks about the prior Codex discussion for making `iset.nwac.ca` the live production portal hostname, or asks how the prod hostname/certificate/CAPTCHA/DNS cutover is meant to work
- Primary docs:
  - `docs/ops/runbooks/prod-portal-hostname-cutover.md`
  - `docs/ops/runbooks/terraform-prod-runbook.md`
  - `docs/ops/environments/prod-env-guide.md`
- Status: current as of 2026-04-02
- Notes: the exact original Codex chat title was not preserved in the repo docs/index. The durable handoff that replaced it is `Prod Portal Hostname Cutover`, which captures the intended `iset.nwac.ca` go-live plan, including WAF CAPTCHA key rotation, prod env updates, ACM certificate request/validation, ALB listener updates, Cognito callback/logout URL changes, and DNS handoff to the `nwac.ca` domain admin. On 2026-04-02 the AWS-side cutover was executed in prod: a fresh ACM cert `arn:aws:acm:ca-central-1:468278742295:certificate/70e5fe66-19b8-4715-bc0f-5dd8fe300b0b` was issued, the prod ALB listener was switched to it, the `iset.nwac.ca` host-header rule was added to the portal target group, prod SSM env values were aligned to `iset.nwac.ca`, and the prod ASG instance refresh completed successfully. Later the same thread, `iset.nwac.ca` was temporarily put behind an ALB fixed-response maintenance rule returning `503` with a go-live message for April 3, 2026, while `nwac-public.awentech.ca` remained live, and then restored to the live portal forwarding rule. The same thread also confirmed by code and AWS account checks that SES sandbox status is account-and-region specific: prod account `468278742295` and test account `124355655255` are separate, both in `ca-central-1`, and moving prod SES out of sandbox would not automatically affect TEST or the current local DEV setup, which is pointed at the test account for SES.

### Prod intake sync and deploy recovery

- Codex task title: `Review prod deploy guide`
- Topic: selective prod intake/runtime database patch from DEV, followed by prod `shared` + `admin` + `portal` deploy, bootstrap recovery, and prod SES sandbox-exit setup
- Keywords: `prod deploy`, `prod database patch`, `workflow.schema.intake`, `iset_runtime_config`, `staff_profiles cognito_sub`, `nwac-prod-direct`, `app-bootstrap.sh`, `unzip exit code 1`, `instance refresh recovery`, `SES sandbox`, `noreply@nwac.ca`, `nwac.ca DKIM`, `production access`
- When to open: the user asks whether prod intake/runtime data was safely copied from DEV without touching live case records, asks how the 2026-04-02 prod rollout was recovered after temporary `502` health failures during refresh, asks for the thread that compared prod `staff_profiles` against the prod Cognito pool before deployment, or asks how prod SES was prepared to move out of sandbox for `noreply@nwac.ca`
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/ops/deployments/prod-deployment-guide.md`
  - `scripts/bootstrap/app-bootstrap.sh`
- Status: current as of 2026-04-02
- Notes: this thread first verified that prod `staff_profiles` was aligned with the prod staff Cognito pool (`10/10` email-to-`sub` matches, `0` mismatches), so the feared DEV-to-prod `cognito_sub` contamination was not present. For the intake rollout, prod was patched selectively from DEV by replacing only the workflow authoring graph tables (`workflow`, `step`, `step_component`, `workflow_step`, `workflow_route`, `workflow_route_option`) and upserting only `iset_runtime_config(scope='publish', k='workflow.schema.intake')`; broader `iset_runtime_config` keys and prod case/application data were left untouched. The subsequent prod rollout uploaded `shared`, `admin`, and `portal` artifacts using the Windows AWS profile `nwac-prod-direct`, then started prod ASG instance refresh `473dcd64-0939-4b78-ae7f-700fe890c6e8`. The replacement instance initially failed bootstrap because `scripts/bootstrap/app-bootstrap.sh` treated `unzip` warning exit code `1` as fatal, and the uploaded archives emitted a backslash-path warning. The instance was repaired in place, both target groups became healthy (`admin` on `5001`, `portal` on `5000`), public health checks returned `{"status":"ok"}`, and the refresh completed successfully on replacement instance `i-06366bbbbd9c17cc6`. The durable repo fix from this thread is that `scripts/bootstrap/app-bootstrap.sh` now tolerates `unzip` exit code `1` for non-fatal archive warnings, and the corrected bootstrap script was uploaded to `s3://nwac-prod-artifacts/bootstrap/app-bootstrap.sh` for future replacements. The same task later covered prod SES setup in `ca-central-1`: account `468278742295` was confirmed still in sandbox, the app's PATH sender was confirmed to be `noreply@nwac.ca` via runtime config, prod SES was found to have only `ISET@awentech.ca` verified, and a new SES domain identity for `nwac.ca` was created with Easy DKIM (`RSA_2048_BIT`). SES generated three required DNS CNAME records for `nwac.ca`, and the handoff was prepared for the NWAC webmaster so DNS can be updated and production-access can then be requested for transactional mail.

### Public portal prelaunch review and rich-HTML regression

- Topic: production-aware public-portal launch review, security hardening discussion, and the fix for flattened authored HTML in digital forms such as the Client Funding Agreement
- Keywords: `public portal launch review`, `CFA flattened`, `Client Funding Agreement`, `raw HTML`, `dangerouslySetInnerHTML`, `security fixes`, `LOG_SENSITIVE_INTAKE_PAYLOADS`, `message recipient auth`, `upload ownership`, `EFT_form`, `MinIO scanner`
- When to open: the user references the thread that reviewed public-portal launch blockers, asks about the chat where the CFA render broke after security fixes, asks whether a thread was the `iset.nwac.ca` cutover discussion, or asks what was already fixed in the sibling portal repo before launch
- Primary docs:
  - `docs/planning/public-portal-prelaunch-review-2026-03-28.md`
  - `../ISET-intake/server.js`
  - `../ISET-intake/src/renderer/renderers.js`
- Status: current as of 2026-04-02
- Notes: this is not the production hostname/domain cutover thread. The durable outcomes from this chat were: replacing raw intake-payload logging with metadata-only logging by default, hardening applicant message target/file-delete authorization, confirming the EFT workflow structure in DEV DB, and restoring raw authored HTML rendering in the public portal after the sanitizer path flattened stored digital-form HTML.

### Reporting dashboards and applicant-account activation

- Topic: workbook-aligned reporting buildout plus the imported applicant-account activation workflow and related client-anchored admin behavior
- Keywords: `Data and Results`, `Regional Snapshot`, `Budgets and Finance Salaries`, `Applicant Accounts`, `activate account`, `dummy draft applicant list`, `Notification Settings sender email`, `client anchored`, `reporting dashboard thread`
- When to open: the user asks about the long thread that built the reporting dashboards, regional snapshot export/reporting surfaces, salaries tracking, imported applicant activation flow, case-header PATH account actions, or why dummy-draft applicant selection no longer mirrors Cognito directly
- Primary docs:
  - `docs/dashboards/data-and-results-dashboard.md`
  - `docs/data/regional-snapshot-reporting.md`
  - `docs/data/finance-regional-salaries.md`
  - `docs/data/applicant-account-activation.md`
  - `docs/features/user-management.md`
  - `docs/dashboards/manage-notifications-dashboard.md`
- Status: current as of 2026-04-02
- Notes: this is not the `iset.nwac.ca` production-hostname thread. Durable outcomes from this chat included: `Reporting > Data and Results` workbook-aligned sections plus drilldowns and exports; `Reporting > Regional Snapshot` with Excel export and live/manual hybrid data; `Budgets and Finance > Salaries` annual-entry tracking that feeds Regional Snapshot salary values; imported applicant accounts anchored on `client` with manual PATH activation, user-management tab, and case-header quick action; PATH SES sender email moved into `iset_runtime_config`; and the current rule that the AI dummy-draft applicant picker is `client`/`user`-anchored rather than a direct Cognito-user list. A one-off dev repair in this thread also repopulated missing `client`/`user` rows from the DEV applicant Cognito pool after the `client` table was purged; treat that as environment repair, not normal product behavior.

### Applicant notification portal-link resolution

- Topic: why applicant secure-message or reminder emails can lose the clickable portal link even when the template uses `[link url="{portal_dashboard_url}"]...[/link]`
- Keywords: `secure message email link missing`, `portal_dashboard_url`, `APPLICANT_PORTAL_BASE`, `message_received`, `please sign in here`, `TEST email hyperlink`, `public portal link`, `notification template link`
- When to open: the user reports that applicant emails show the sign-in text without a hyperlink, or asks which app/env actually controls applicant email portal links in TEST/prod
- Primary docs:
  - `docs/AGENTS.md`
  - `../ISET-intake/docs/system/runtime/notifications.md`
  - `docs/ops/environments/test-env-config-map.md`
  - `docs/planning/notification-applicant-integration.md`
- Status: current as of 2026-04-02
- Notes: the template syntax is not the root cause. The renderer supports `[link url="..."]...[/link]`, but if `{portal_dashboard_url}` resolves empty or invalid the runtime intentionally degrades to plain text with no anchor. For admin-triggered secure-message emails, the send is initiated by `admin-dashboard` but uses shared notification code from `ISET-intake`, so the effective runtime env is the admin backend process. Current durable rule: prefer `APPLICANT_PORTAL_URL` / `APPLICANT_PORTAL_BASE`; fallback also checks `PUBLIC_PORTAL_BASE_URL`, `REACT_APP_PORTAL_URL`, `REACT_APP_API_BASE_URL`, and `PORTAL_DOMAIN`. For current TEST env-only mitigation before code deploy, set `APPLICANT_PORTAL_BASE=https://nwac-public-test.awentech.ca` in `admin-dashboard/.env.test` and redeploy the admin backend.

### Test-environment form/data pull path

- Topic: TEST DB access and the current Codex path for pulling tester-made environment data
- Keywords: `tester changes`, `download changes`, `test environment`, `intake process`, `digital forms`, `pull from test`, `workflow.schema.intake`, `run-test-sql-via-ssm`
- When to open: the user asks how to download, inspect, or pull changes testers made in TEST, or asks whether Codex is ready to query TEST from WSL/sandbox
- Primary docs:
  - `docs/guides/test-db-access-from-codex.md`
  - `docs/AGENTS.md` -> `Test DB interaction from Codex/WSL`
  - `scripts/run-test-sql-via-ssm.sh`
- Status: current as of 2026-04-01
- Notes: the durable note currently covers verified TEST DB access. As of 2026-04-01, large JSON exports through SSM stdout were observed truncating, so intake-step authoring pulls should use per-component base64 export and local reconstruction rather than one large stdout dump. If DEV is meant to become the new editing source of truth, treat `step` plus `step_component` as the import target and keep published runtime JSON as a reference snapshot, not the only artifact.

### Payment packet scheduling handoff

- Topic: locked scheduling, packet-grouping, and regeneration decisions for finance/payment packets
- Keywords: `payment packet`, `scheduling`, `awaiting_trigger`, `recurrence`, `queue timeline`, `regeneration`, `group by intervention date`
- When to open: the user references a prior design thread about packet scheduling, manual trigger flow, or why packets are grouped the way they are
- Primary docs:
  - `docs/planning/thread-handoff-2026-03-02.md`
  - `docs/planning/payment-packet-scheduling-design.md`
- Status: current durable handoff baseline

### Sage Intacct mock dashboard handoff

- Topic: durable handoff for the separate Intacct mock-dashboard and AP-bills design work
- Keywords: `intacct`, `sage`, `mock dashboard`, `AP bills`, `bill splitting`, `reconciliation`
- When to open: the user references the prior Intacct design thread or asks for the saved mock-dashboard direction
- Primary docs:
  - `docs/planning/intacct-mock-dashboard-design.md`
- Status: current durable handoff baseline

### Step 19 checkbox-conditionality follow-up

- Topic: keeping Step 19 `Supports Requested` as a checkbox array while driving later intake conditionality from those selections
- Keywords: `step 19`, `supports requested`, `checkbox array`, `contains`, `containsAny`, `notContainsAny`, `manual intake parity`, `workflow preview parity`
- When to open: the user asks why Step 19 support selections work in the public portal but not in Manual Intake or preview, or asks how the checkbox-array conditionality was implemented without refactoring Step 19 into yes/no fields
- Primary docs:
  - `docs/planning/step19-checkbox-conditionality-followup.md`
  - `docs/AGENTS.md`
- Status: current partial implementation as of 2026-04-01
- Notes: public portal runtime support and DEV workflow-21 authoring were added on 2026-04-01. That runtime support now includes checkbox-array operators plus whole-step skipping when a step has no visible components, and DEV Step 21/22 rely on that behavior instead of placeholder notices. Workflow 21 also now branches after Step `93` so applicants with `dependent-children = 0` are sent to a cloned Step 19 that omits the `Childcare` option. Manual Intake, Workflow Preview, and the intake-step editor still need parity work before this becomes a full-stack authoring feature. Additional 2026-04-02 deployment note: last-minute portal/runtime fixes now exist in DEV runtime data that current admin-side authoring/preview flows cannot faithfully regenerate, so prod intake rollouts must copy `iset_runtime_config(scope='publish', k='workflow.schema.intake')` from DEV rather than relying on admin-side republish, and Manual Intake is not yet safe to treat as parity coverage for the newest runtime schema.

### TEST staff Cognito recovery

- Topic: recovering TEST admin/staff accounts when region display is wrong or Cognito invitation/reset email flows fail
- Keywords: `mcoppola`, `acurtis`, `emarion`, `Administrative Users regions`, `primary region only`, `staff_profiles cognito_sub`, `FORCE_CHANGE_PASSWORD`, `resend invite`, `admin-set-user-password`, `forgot password email not received`
- When to open: the user reports that TEST admin users only show one region in `Administrative Users`, or a staff user cannot receive a Cognito password/invitation email, or a TEST DB refresh may have copied the wrong `staff_profiles` data
- Primary docs:
  - `docs/guides/test-staff-cognito-recovery.md`
  - `docs/AGENTS.md`
  - `src/routes/admin/users.js`
- Status: current as of 2026-04-02
- Notes: the durable findings from this thread are: `Administrative Users` multi-region display depends on matching Cognito `sub` to `staff_profiles.cognito_sub`; stale DB `cognito_sub` values make the UI fall back to the single Cognito `custom:region_id` primary region. The TEST staff pool currently uses `COGNITO_DEFAULT` mail with `verified_email` account recovery only, so legacy users missing `email` / `email_verified` cannot receive recovery mail until those attributes are repaired. For existing `FORCE_CHANGE_PASSWORD` users, prefer `admin-create-user --message-action RESEND`; if email delivery still fails, use `admin-set-user-password --no-permanent` and send the temporary password out-of-band.

## Future improvements

- Add stable entry IDs if this grows beyond a small manual list.
- Split the index by area (`Casework`, `Reporting`, `Ops`, `Auth`, `Finance`) once the list becomes long enough that a flat file slows search.
- Mark entries `superseded` when a newer canonical doc replaces them, but keep the old search keywords so future chats can still find the redirect.
