# Codex Thread Index

Purpose: searchable index of durable notes, handoff docs, and thread-born findings that future chats may need to recover quickly when prior chat history is unavailable.

Last Updated: 2026-07-23

## How to use

- Start here when the user references "another chat", "previous thread", "there should be a note", or asks for context that is not visible in the current session.
- Use the `Codex task title` as the primary bridge back to the user's Task History list. Topic labels and keywords are secondary lookup aids.
- The Task History label is the reason this index exists. Do not treat the `Topic` line as an acceptable substitute for the recovery key.
- Search this file using the user's own words first, then open the linked canonical doc instead of relying on the short index summary.
- Current TEST topology supersession: entries before 2026-06-08 may mention two TEST app instances or both TEST targets as historical evidence. Current TEST is cost-pruned to one steady-state app host and one NAT gateway; open `docs/AGENTS.md`, `docs/ops/deployments/deployment-quick-guide.md`, and `docs/ops/environments/test-environment-progress.md` before acting on old TEST instance-count notes.
- Keep entries focused on cross-thread recovery value. This is not a changelog and should not duplicate normal release-note logging.
- When a thread produces durable context that a future chat is likely to need, either update an existing canonical doc and add it here, or create a short handoff note and index it here in the same change.
- For the current thread, do not finalize a new entry until you have the exact Task History title. If the user supplied it, copy it verbatim even if the thread later drifts into other work.
- If the exact Task History title is missing for a historical backfill, mark the entry with `Codex task title: exact original task title not preserved` and treat it as an incomplete index record.
- Prefer canonical docs by type:
  - operational/how-to guidance -> `docs/guides/*`
  - design or decision handoffs -> `docs/planning/*`
  - repo-wide durable context -> `docs/AGENTS.md` or `docs/meta/*`

## Entry format

For each indexed thread/topic, keep:

- `Codex task title`: exact task/chat title from the Codex plugin history; this is the primary recovery key back to Task History. Do not replace it with a human-written summary. Only use `exact original task title not preserved` for legacy backfills where the title truly cannot be recovered, and treat those entries as incomplete
- `Topic`: short human-readable label
- `Keywords`: terms a future chat is likely to search
- `When to open`: concrete trigger conditions
- `Primary docs`: canonical docs/scripts to open next
- `Status`: whether the note is current, partial, incomplete-title, or superseded

## Indexed Topics

### nForm vanilla project-template extraction

- Codex task title: exact original task title not preserved
- Topic: Reactivated extraction of vanilla nForm infrastructure from PATH as a standalone project template.
- Keywords: `nForm`, `vanilla platform`, `project template`, `extract PATH`, `remove ISET`, `VAC`, `single tenant`, `AWS retained`, `monorepo`, `nform-extraction-plan`
- When to open: the user asks to resume nForm extraction, asks what was decided about template versus configurable platform, asks how far extraction progressed, or starts a new product from nForm.
- Primary docs:
  - `docs/planning/nform-extraction-plan.md`
  - `docs/planning/nform-scope.md`
  - `docs/planning/nform-dependency-map.md`
  - `docs/planning/nform-v1-schema-and-extension-contract.md`
  - `docs/planning/nform-copy-manifest.md`
  - `docs/planning/nform-copy-manifest.json`
  - `docs/meta/changelog.md`
- Status: active implementation as of 2026-08-06; incomplete-title. Standalone repository `/home/bill/nForm` has committed scaffold/schema (`65d4906`), canonical component/intake contracts (`c3eba1d`), the tested staff-authoring domain service (`ecf4a3d`), and the private canonical GitHub remote `BrimborionInc/nForm` through checkpoint `0d8af1a`; all current checks pass. Codex Cloud environment setup/validation is next operationally, followed by the MySQL/HTTP adapter and staff editor UI. No AWS resource or runnable application exists yet.
- Notes: nForm v1 is an empty, self-contained, single-tenant-per-deployment project template retaining AWS/Cognito/S3/SES and generic authentication/users, codeless forms/intake journeys, permissions, notifications, documents, events/audit, dashboard/workspace composition, API, and administration infrastructure. Its defining capability is codeless staff-portal intake-wizard drafting, preview, versioning, validation, publication, and rollback for policy makers, using constrained platform-approved components rather than code changes. Publication governance can allow direct publishing or require separate author/reviewer/publisher permissions. Codeless workflow stops at the intake journey and submission; generic staff review stages, tasks, cases, and work queues are not core. Core includes a neutral submissions registry and submission storage/search/export/audit/retention/integration plumbing. Downstream bookings, registrations, payments, requests, and domain processes are solution-owned. It excludes PATH/ISET/NWAC solution behavior and all imposed business entities such as clients, cases, applications, and appointments. Staff and public portals are permanent first-class core surfaces backed by generic internal-operator and external-user identity populations. Public workflows can be anonymous or sign-in-required through per-workflow configuration. Both portals, shared code, and migrations belong in one repository. VAC is the first downstream validation project, not the definition of core. Initial bootstrap may provision only `bill@sillery.co.uk` as System Administrator through environment/deployment configuration. `System Administrator` is the sole built-in role; all business roles and permissions are solution-defined. Codex now leads the dependency/coupling audit and should consult Bill only for genuine product ambiguities.

### PROD NAT gateway consolidation

- Codex task title: exact original task title not preserved
- Topic: PROD NAT gateway consolidation from three NAT gateways to one.
- Keywords: `PROD cost savings`, `NAT gateway`, `single NAT`, `nat-061b3328c8a74487e`, `nat-009f7f0add87674f4`, `nat-039421458cb225a44`, `rtb-0448f405001135392`, `rtb-0507d2829075a05d3`, `NWACProdNatConsolidationTemporaryOperator`, `prod-nat-gateway-consolidation`
- When to open: the user asks about the completed PROD NAT consolidation, asks what IAM policy was needed, asks what NAT was kept, asks for rollback details, asks whether Terraform matches the one-NAT state, or asks about the next large PROD cost-saving target after EC2/database review.
- Primary docs:
  - `docs/ops/runbooks/prod-nat-gateway-consolidation.md`
  - `docs/ops/environments/prod-env-guide.md`
  - `docs/ops/agent-operational-access.md`
  - `docs/meta/changelog.md`
- Status: current as of 2026-06-14; executed; incomplete-title.
- Notes: live prep found current PROD app instance `i-034c7daa416ec6865` and DB writer `nwac-prod-db-1` both in `ca-central-1d`, so the keeper NAT is `nat-061b3328c8a74487e` / `nwac-prod-nat-2`. Route tables `rtb-0448f405001135392`, `rtb-0507d2829075a05d3`, and `rtb-02e4f1d20adc69f0c` now all route `0.0.0.0/0` to the keeper NAT. Removed NATs were `nat-009f7f0add87674f4` and `nat-039421458cb225a44`; released EIPs were `eipalloc-0b52e577cc52e143c` and `eipalloc-0c1f5bfe99e1029bd`. Final public smoke, SQL-over-SSM, SSM online state, ALB target health, and app-host outbound egress through `15.222.143.60` were green. Temporary policy `NWACProdNatConsolidationTemporaryOperator` was required for `ec2:ReplaceRoute`, `ec2:DeleteNatGateway`, and `ec2:ReleaseAddress`; remove it after the rollback watch window. Expected saving is about `$82/month` USD before tax.

### PROD Aurora downsize revalidation

- Codex task title: exact original task title not preserved
- Topic: PROD Aurora provisioned downsize prep/revalidation after the app EC2 right-size.
- Keywords: `PROD cost savings`, `Aurora downsize`, `db.r6g.large`, `db.t4g.large`, `nwac-prod-db`, `nwac-prod-db-1`, `Compute Optimizer`, `freeable memory`, `NWACProdAuroraDownsizeTemporaryOperator`, `prod-aurora-provisioned-downsize`, `prod-aurora-downsize-prep-summary`
- When to open: the user asks about the next PROD cost-saving scope after the EC2 app right-size, asks whether to shrink the PROD database, asks why the DB downsize was not executed, asks what the DB downsize savings/risk would be, or asks what IAM policy is needed for a future Aurora downsize maintenance window.
- Primary docs:
  - `docs/ops/runbooks/prod-aurora-provisioned-downsize.md`
  - `docs/ops/runbooks/prod-aurora-downsize-prep-summary-20260614.md`
  - `docs/ops/environments/prod-env-guide.md`
  - `docs/ops/agent-operational-access.md`
  - `docs/meta/changelog.md`
- Status: current as of 2026-06-14; prep/revalidation only; incomplete-title.
- Notes: no RDS resources were mutated. Live checks found one healthy `db.r6g.large` writer, current backups, green public smoke, and working SQL-over-SSM. Refreshed metrics showed low CPU, low I/O, and no swap, but memory is the blocker: freeable memory averaged about `5.958 GiB` with minimum `5.904 GiB` on the current 16 GiB class, and AWS Compute Optimizer marked the instance `Optimized` with a recommendation to stay on `db.r6g.large`. `db.t4g.large` would save about `$95.23/month` USD before tax at 744 hours, but it halves memory to 8 GiB and should only be attempted as an explicit-risk temporary-reader/failover trial. Future execution needs temporary policy `NWACProdAuroraDownsizeTemporaryOperator`.

### PROD app EC2 right-size

- Codex task title: exact original task title not preserved
- Topic: PROD app-tier EC2 right-size from `t3.large` to `t3.medium`.
- Keywords: `PROD cost savings`, `right-size`, `t3.large`, `t3.medium`, `nwac-prod-asg`, `lt-056df7f45608b95ae`, `CreateLaunchTemplateVersion`, `NWACProdAppRightSizeTemporaryOperator`, `prod-app-instance-rightsize`, `instance refresh`, `EC2 compute savings`
- When to open: the user asks to revisit the first PROD cost-saving step after the AWS cost audit, asks why `t3.medium` was chosen, asks what IAM permissions were needed, asks how to roll back the app instance right-size, asks about the current PROD app instance shape, or asks why Terraform should not be applied blindly for this change.
- Primary docs:
  - `docs/ops/runbooks/prod-app-instance-rightsize.md`
  - `docs/ops/environments/prod-env-guide.md`
  - `docs/ops/agent-operational-access.md`
  - `infra/terraform/environments/prod/variables.tf`
  - `infra/terraform/environments/prod/nwac-prod.tfvars.example`
  - `docs/meta/changelog.md`
- Status: current as of 2026-06-14; executed; incomplete-title.
- Notes: the change was a targeted launch-template version plus ASG instance refresh, not a normal app deploy and not a database/NAT change. Live evidence on 2026-06-14 showed one healthy `t3.large` PROD app instance, green public smoke, low CPU, and ample memory, supporting `t3.medium` as the first step. Bill attached temporary policy `NWACProdAppRightSizeTemporaryOperator`; launch-template version `2` changed only `InstanceType` to `t3.medium`; ASG refresh `24c2eb5f-6843-4685-9df1-35d41eb193ec` completed successfully on instance `i-034c7daa416ec6865`, and launch-template default was then aligned to version `2`. Final public smoke was green, fallback was off, and maintenance announcement count was `0`. Remove the temporary policy after the rollback watch window; reattach it only if rollback/new launch-template work is needed.

### Build billing agent in VS code

- Codex task title: `Build billing agent in VS code`
- Topic: AwenTech monthly billing invoice generator and Codex custom agent setup.
- Keywords: `Build billing agent in VS code`, `AwenTech Billing Agent`, `awentech-billing`, `billing:invoice`, `NWAC invoice`, `AWS Cost Explorer`, `awentech-billing-readonly`, `Bank of Canada FX`, `FXMUSDCAD`, `OneDrive invoices`, `invoice audit`, `SES placeholder`
- When to open: the user asks how to generate the next NWAC invoice, recover the billing-agent setup, understand what the VS Code/Codex Agent does, change billing rules, add another client, troubleshoot AWS/FX lookup, or revisit future email/SES automation.
- Primary docs:
  - `docs/guides/awentech-billing-agent.md`
  - `.codex/agents/awentech-billing.toml`
  - `scripts/billing-invoice-agent.py`
  - `config/billing/clients/nwac.json`
  - `docs/meta/changelog.md`
- Status: current as of 2026-06-09.
- Notes: this thread established that a VS Code/Codex custom Agent is a reusable persona/configuration, not a scheduled background task. Monthly invoice generation is invoked on demand, for example: `Use the awentech-billing agent. Prepare the June 2026 invoice for NWAC.`
- Notes: the implementation generates DOCX/PDF/audit files using the prior Word invoice as template, reads AWS Cost Explorer through the dedicated `awentech-billing-readonly` role assumed via `nwac-prod`, uses AWS `Usage` only while excluding AWS `Tax` from the client passthrough basis, converts USD to CAD using Bank of Canada monthly average `FXMUSDCAD`, applies GST/QST at `14.975%`, and writes outputs under the AwenTech OneDrive invoice archive.
- Notes: May 2026 was generated as invoice `#7` with hosting passthrough CAD `632.81` and total due CAD `3,601.95`; April 2026 was left as paid historical output. Email sending remains out of scope with SES recorded only as a future placeholder.

### Overview approval workflows

- Codex task title: `Overview approval workflows`
- Topic: approval workflow model review, repeat-application assessment containment, browser smoke automation, TEST rehearsal, and PROD release.
- Keywords: `Overview approval workflows`, `three approval workflows`, `application approval`, `intervention proposal approval`, `intervention revision approval`, `repeat application`, `application assessment`, `iset_case_assessment`, `iset_application_assessment`, `applicationDecisionLetters`, `Option B`, `Option A blast radius`, `approval letters`, `Step 14`, `browser smoke`, `Playwright`, `temporary Cognito user`, `TEST rehearsal`, `20260509-prod-option-b-plus-portal`
- When to open: the user asks about the three main approval workflows; asks why application assessments became application-scoped; asks about the repeat-application assessment defect or Option A vs Option B; asks what shipped in PROD release `20260509-prod-option-b-plus-portal`; asks how DEV/TEST browser testing was automated for approval workflows; or asks how to avoid repeated manual workflow testing.
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/planning/application-assessment-application-scope-migration-plan.md`
  - `docs/planning/client-case-application-target-model.md`
  - `docs/testing/browser-workflow-smoke-automation.md`
  - `docs/workflows/admin/application-assessment.md`
  - `docs/widgets/admin/application-assessment-widget.md`
  - `docs/meta/changelog.md`
  - `scripts/application-assessment-option-b-smoke.js`
  - `scripts/application-assessment-backfill.js`
  - `scripts/application-assessment-context-backfill.js`
- Status: current as of 2026-05-09.
- Notes: this thread began with an overview of the approval workflows and established the target model: one real person -> one client -> one long-lived case -> many applications, while keeping case-manager-initiated new intervention proposals and intervention revisions outside the application model. The concrete first production defect was repeat-application assessment ownership: Application 2 could load or overwrite Application 1's case-scoped assessment.
- Notes: the chosen first production fix was Option B containment, not the larger Option A in-place ERM correction. PROD release `20260509-prod-option-b-plus-portal` added the application-scoped assessment store, backfilled `57` clear legacy assessments, scoped `57` approval-letter workflow contexts by application, preserved one applicationless legacy context, and passed final health smoke for admin and both public portal hostnames. PROD had `0` repeat-application cases at deployment time, so the repeat-case behavior is covered by DEV/TEST fixtures until the first real PROD repeat application appears.
- Notes: the major testing lesson from this thread is now in `docs/testing/browser-workflow-smoke-automation.md`: automate workflow invariants with DB/API fixture scripts first, then use real-auth browser smokes for the risky UI surface, capture network/server failures, verify post-run database state, and clean up temporary Cognito/staff/lock/conflict artifacts. The reusable Option B DB smoke is `npm run assessment:option-b:smoke`.

### Investigate missing task history

- Codex task title: `Investigate missing task history`
- Topic: recovery from a lost Codex task thread, completion of the WSL2 Ubuntu development workspace migration, full DEV-environment startup, corrected WSL-native TEST deploy runbook, and the repeat-application assessment-scope defect/containment decision.
- Keywords: `Investigate missing task history`, `missing task history`, `task history gone`, `restart VS Code`, `Open the DEV Environment`, `/home/bill/ISET/path-dev-wsl.code-workspace`, `/home/bill/ISET/admin-dashboard`, `/home/bill/ISET/ISET-intake`, `/home/bill/ISET/shared`, `/home/bill/ISET/intacct-mock-service`, `WSL: Ubuntu`, `dev:all`, `Sage Intacct mock`, `DB_HOST=172.26.176.1`, `LD_LIBRARY_PATH`, `Puppeteer`, `libnspr4.so`, `libnss3.so`, `Chrome`, `assessment PDF`, `WSL-native TEST deploy`, `WSL-native PROD deploy`, `path:deploy packages WSL tree`, `20260507-prod-contact-retirement`, `20260509-prod-option-b-plus-portal`, `repeat application`, `Jacqueline Sillery`, `iset_case_assessment`, `iset_application_assessment`, `application-scoped assessment`, `application assessment containment`, `Option B`, `Option A blast radius`, `applicationId`, `one client one case many applications`
- When to open: the user asks what happened after the Codex thread disappeared; asks how VS Code should be opened now; asks why Explorer should show the WSL workspace instead of `X:\ISET`; asks what "Open the DEV Environment" means; asks how local DEV reaches MySQL from WSL; asks why Puppeteer/Chrome failed with missing Linux shared libraries during assessment/PDF generation; asks whether the Sage Intacct mock is part of startup; asks how TEST/PROD deploys work after daily development moved to WSL; asks why a repeat applicant's new application opens the old assessment; asks about PROD risk for making assessments application-scoped; asks whether to use Option A or Option B for the assessment fix; or asks for the prompt/context needed to recover this migration thread.
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/guides/wsl-local-development.md`
  - `docs/ops/agent-operational-access.md`
  - `docs/ops/deployments/deployment-quick-guide.md`
  - `docs/ops/deployments/deploy-test-notes.md`
  - `docs/ops/deployments/prod-deployment-guide.md`
  - `docs/ops/deployments/path-deploy-orchestrator.md`
  - `docs/planning/application-assessment-application-scope-migration-plan.md`
  - `docs/planning/client-case-application-target-model.md`
  - `docs/meta/changelog.md`
  - `/home/bill/ISET/path-dev-wsl.code-workspace`
- Status: current as of 2026-05-09.
- Notes: the old Codex task thread did not survive a VS Code restart/sign-in transition, but the repo migration was recoverable from disk. The active daily workspace is now the saved WSL multi-root workspace `/home/bill/ISET/path-dev-wsl.code-workspace`, containing `admin-dashboard`, `ISET-intake`, `shared`, and `intacct-mock-service`. The VS Code window should show `WSL: Ubuntu`; do not use the old `X:\ISET` Explorer window for ordinary coding/Codex work.
- Notes: "Open the DEV Environment" means starting the full local stack from WSL: admin frontend `3001`, admin backend `5001`, public portal frontend `3000`, public portal backend `5000`, MinIO console `9001`, and Sage Intacct mock/dashboard `4000`. The WSL task `dev:all` and `docs/guides/wsl-local-development.md` are the canonical startup references. Browser tabs are intentionally not auto-opened when Codex starts the stack; use bookmarks.
- Notes: WSL Node processes reach the Windows-hosted DEV MySQL service with `DB_HOST=172.26.176.1`, not `localhost`. This value was written to the local WSL `.env` files and VS Code tasks. If WSL networking changes after reboot, refresh the Windows host IP and keep `.env` plus `.vscode/tasks.json` aligned.
- Notes: Puppeteer's bundled Chrome initially failed in WSL during assessment PDF generation with missing `libnspr4.so` / NSS libraries; the public portal backend has the same dependency for signature/document PDFs. Because Codex could not run sudo, the current workaround extracts Ubuntu `libnspr4` and `libnss3` packages into `/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu` and sets `LD_LIBRARY_PATH` in the admin and portal `.env` files plus both backend tasks in `dev:all`. Direct Puppeteer launch/page/PDF smoke tests passed with that library path.
- Notes: follow-up corrections on 2026-05-07 and 2026-05-08 superseded the earlier incomplete source-tree split. TEST and PROD `path:deploy` now run from `/home/bill/ISET/admin-dashboard` and package the WSL admin, portal, and shared trees directly through the Node orchestrator. Do not use old `X:\ISET` / `/mnt/x/ISET` checkout guidance for deploys. PROD app rollout was ported and validated in release `20260507-prod-contact-retirement`: restore point `path-prod-20260507-prod-contact-retirement-20260508000234`, ASG refresh `f323cb21-bc0c-4063-b0e8-017b40f31544`, replacement instance `i-00b00ebdff3f55dc5`, and green final public smoke.
- Notes: DEV repeat-application testing found a real model gap: `iset_case_assessment` is still keyed by `case_id`, so a second application on the same case can open and overwrite the prior application's assessment. The current decision is Option B containment first: add application-scoped `iset_application_assessment` and move only the application assessment workflow/direct read-write surfaces first. As of 2026-05-08, DEV has the additive schema and first backend/frontend containment patch, with DEV backfill classification counts recorded as total `1`, clear ownership `0`, copied `0`, ambiguous `1`; DB-level smoke for case `1` / application `2` passed. TEST release `20260508-test-application-assessment-option-b` applied the schema/admin app, copied `45` clear single-application legacy assessments, found `0` ambiguous TEST backfill rows and `0` duplicate application-assessment owners, and passed a transactional repeat-application fixture smoke. Corrected follow-up TEST release `20260508-test-option-b-followup` fixed the `applicationJoinSql is not defined` regression and passed authenticated route-level EI save, repeat-application API isolation, and queue/decision API smoke through SSM localhost calls using temporary TEST Cognito users. The readiness posture was then reset after DEV found another Option B blocker: Step 14 approval-letter workflow state still read/wrote selected-application data through case-scoped `iset_case.case_context_json` keys (`decisionLetterDrafts`, `decisionLetterPackDrafts`, `decisionLetterSent`), so a newly approved Application 2 could inherit Application 1 letters and read-only sent state. DEV now scopes application assessment letter/review context under `case_context_json.applicationDecisionLetters[application_id]`, repaired local case `1` so Application `1` owns the prior sent approval letter and Application `2` has no inherited state, and updated decision-letter send/prefill paths to use the selected application. Added `npm run assessment:option-b:smoke` for repeatable read-only live checks, rollback fixture checks, and persistent fresh fixtures; current DEV browser-test fixture is case `6`, Application B `12`, which passes `--stage fresh-step14`. Added `assessment:context:plan/apply` to audit and migrate root-level application-assessment workflow context only where ownership is clear; DEV context plan inspected two cases and found zero root workflow-key leaks. TEST release `20260508-test-option-b-letter-context` deployed the corrected letter-state build, applied the context backfill to 45 clear single-application root-context rows, preserved one applicationless case, left duplicate application-assessment owners at 0, and created persistent TEST browser fixture case `136` / Application B `62` in fresh Step 14 state. Authenticated TEST API/browser smoke then passed for selected-application read/write isolation, Step 14 letter freshness/editability, queue/decision APIs, document application association, and applicationless case workspace behavior; SES send was intentionally not exercised in TEST. Live DEV case `1` / Application `2` currently passes at `--stage sent` after Bill's latest UI test sent the second approval letter. Option A, the full in-place migration of `iset_case_assessment`, remains the long-term cleanup but is not the first production bugfix because its blast radius includes queues, PDFs, decision context, funding reads, CFA/action-plan creation, scripts, reports, and rollback. The weekend PROD decision is GO only for the controlled combined admin+portal release plan in `docs/planning/application-assessment-application-scope-migration-plan.md`: deploy schema/admin/portal, skip shared/data, run report-first PROD backfills, and do not proceed outside an approved maintenance window. Read-only PROD plan for release `20260509-prod-option-b-plus-portal` passed with one pending schema migration (`20260508_0001_create_application_assessment.sql`), admin+portal app deploy, shared skipped, data skipped, and three smoke targets; latest manifest is `tmp/path-deploy/prod/20260509-prod-option-b-plus-portal--2026-05-08T19-21-50-174Z.json`. The deploy orchestrator now stages the application-assessment support scripts in the admin artifact so PROD backfills can run from `/opt/nwac/admin-dashboard`; local syntax/diff checks and both production builds passed. Read-only PROD inventory found 57 legacy case-assessment rows, 0 repeat-application cases, 58 root workflow-context cases, and no existing `iset_application_assessment` table.
- Notes: PROD release `20260509-prod-option-b-plus-portal` shipped Option B on 2026-05-09 with admin + public portal app rollout, restore point `path-prod-20260509-prod-option-b-plus-portal-20260509093619`, schema migration `20260508_0001_create_application_assessment.sql`, table backfill `57` copied / `0` duplicate application owners, context backfill `57` scoped / `1` applicationless preserved, and final health smoke `200` for `nwac-console.awentech.ca`, `iset.nwac.ca`, and `nwac-public.awentech.ca`. PROD had `0` repeat-application cases at deployment time, so use the DEV/TEST fixtures above until a real PROD repeat application exists.

### Fix PROD checklist rules

- Codex task title: `Fix PROD checklist rules`
- Topic: PROD document-checklist configuration repairs, related feedback triage, editable generated approval-letter packs, and DEV application On Hold workflow bucket.
- Keywords: `Fix PROD checklist rules`, `PROD checklist rules`, `Denial Letter Missing`, `Application Assessment- Missing Documents`, `feedback 78`, `feedback 82`, `document checklist`, `evidence_income`, `evidence_expense`, `band_funding_decision`, `supporting documents`, `Can't delete`, `feedback 86`, `approval letters editable`, `institution letter`, `loan-provider letter`, `other-funder letter`, `Hey Bill`, `feedback 55`, `emarion@nwac.ca`, `on_hold`, `On Hold`, `Put on hold`, `parking`, `Application hold review`
- When to open: the user asks what happened in the May 6 checklist-rule thread; asks whether the checklist fixes were config-only or need deployment; asks why income/expense or Band/Nation decision-letter checklist rules changed; asks about generated approval supporting-letter editability; asks why feedback `#55` or `#86` is `planned`; or asks about the new parking/on-hold workflow.
- Primary docs:
  - `docs/planning/document-checklist-config-widget.md`
  - `docs/guides/status-lifecycle-implementation.md`
  - `docs/dashboards/admin-home-my-work-widget.md`
  - `docs/widgets/admin/application-overview-widget.md`
  - `docs/widgets/admin/application-assessment-widget.md`
  - `docs/widgets/admin/intervention-assessment-widget.md`
  - `docs/planning/application-workspace-quick-actions.md`
  - `docs/planning/status-architecture-overhaul.md`
  - `docs/meta/changelog.md`
  - `docs/meta/next-release-notes-log.md`
  - `src/server/config/checklists/iset-compliance.json`
  - `src/server/config/checklists/iset-intervention.json`
  - `src/widgets/CoordinatorAssessmentWidget.js`
  - `src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx`
  - `src/widgets/ApplicationOverviewWidget.js`
  - `src/pages/home/HomeDashboardPage.jsx`
  - `src/utils/applicationStatus.js`
  - `src/utils/applicationSla.js`
  - `isetadminserver.js`
  - `sql/ops/prod-fix-feedback-78-82-document-checklist-config-20260506.sql`
- Status: current as of 2026-05-06. PROD checklist runtime-config repairs for feedback `#78` / `#82` were applied live; generated supporting approval-letter editability and the application On Hold workflow are DEV code changes that require deployment before PROD users see them. PROD feedback `#55` and `#86` are marked `planned` pending deployment/verification.
- Notes: The checklist portion repaired PROD configuration, not application code: income/expense evidence uses the active evidence document types and conditional checklist item IDs, while intervention proposal Band/Nation decision-letter requirements accept the merged `band_funding_decision` document type. Repo checklist JSON/docs were kept aligned so future deploys do not overwrite the live config fix.
- Notes: Kelly Hyde's `Can't delete` report was triaged as an approval-letter editing limitation. The DEV UI now lets staff edit generated supporting approval letters for institutions, loan providers, and other funders before save/send/download. Application approval supporting-letter edits persist with the decision-letter draft pack; intervention approval/revision supporting-letter edits are editable in the generated pack before send/download. This requires an admin app deployment.
- Notes: Emilie Marion's `Hey Bill` change request became the DEV application On Hold workflow. It persists raw `iset_application.status = 'on_hold'`, stores a hold reason in `awaiting_reason`, creates an `Application hold review` reminder for the selected review date, and exposes parked applications in a dedicated homepage `On Hold` queue for NWAC Administrators, Regional Managers, and ISET Coordinators. It is application-scoped and deliberately does not use case lifecycle `dormant`.

### Test PROD database connectivity

- Codex task title: `Test PROD database connectivity`
- Topic: PROD DB access validation, Occupational Skills intervention approval-letter repair, Kayla Gladue damaged-submission recovery, Madison Lightning-Swampy action-plan status repair, and DEV-only public-portal submit hardening
- Keywords: `Test PROD database connectivity`, `PROD database`, `run-prod-sql-via-ssm`, `Occupational Skills Intervention`, `Occupational skills training – diploma`, `case 40`, `planId=6`, `interventionId=37`, `approvalType=intervention`, `step=communication`, `Prepare approval letters`, `proposal in progress`, `feedback 83`, `ISET-20260505-4ED405`, `Kayla Gladue`, `application 61`, `case 138`, `input_json_state`, `iset_application_draft_dynamic`, `PITR`, `codex-kayla-pitr`, `TemporaryKaylaDraftRecovery`, `intakeCompletionPayload`, `submission_incomplete`, `CASE-2026-0000061`, `Madison Lightning-Swampy`, `Child and Youth Counselor`, `action plan 35`, `closed to draft`, `dormant to initiated`
- When to open: the user asks about the large May 6 thread that began with testing PROD DB connectivity, asks what happened with the Occupational Skills intervention or its approval-letter quick action, asks how Kayla's missing public-portal submission data was recovered, asks whether temporary PROD recovery resources/IAM permissions are still needed, asks why Madison Lightning-Swampy's action plan/case status was repaired, asks about `CASE-2026-0000061`, or asks for the public-portal bug fix that should be rolled out later.
- Primary docs:
  - `docs/ops/agent-operational-access.md`
  - `docs/meta/changelog.md`
  - `docs/meta/next-release-notes-log.md`
  - `docs/widgets/admin/interventions-widget.md`
  - `docs/widgets/admin/intervention-assessment-widget.md`
  - `sql/ops/prod-fix-feedback-83-occupational-skills-letter-pending-20260506.sql`
  - `sql/ops/prod-fix-feedback-83-occupational-skills-letter-pending-metadata-20260506.sql`
  - `sql/ops/prod-fix-kayla-application-61-display-assignment-20260506.sql`
  - `sql/ops/prod-fix-kayla-application-61-repair-metadata-20260506.sql`
  - `docs/guides/status-lifecycle-implementation.md`
  - `src/pages/Caseworking/caseWorkspace/widgets/InterventionsWidget.jsx`
  - `src/pages/applicationCaseDashboard.js`
  - `../ISET-intake/docs/meta/changelog.md`
  - `../ISET-intake/server.js`
  - `../ISET-intake/src/services/intakeCompletionPayload.js`
  - `../ISET-intake/src/__tests__/intakeCompletionPayload.test.js`
  - `../ISET-intake/src/pages/DynamicTest.js`
- Status: current as of 2026-05-08. PROD data repairs are complete and the temporary PITR RDS resources were deleted; the public-portal code fix is DEV-only and intentionally not rolled out yet.
- Notes: this thread confirmed usable PROD database access via the documented SSM SQL helper, then used guarded PROD SQL with restore points for live data repairs. The Occupational Skills intervention investigation started from feedback report title `Occupational Skills Intervention` for case `40`. The PROD data repair made the future Skills Development action plan non-active/draft-planned and put `Occupational skills training – diploma` into the approved letter-pending state so Amanda could prepare the approval letter. A separate DEV admin bug was then fixed because the Case Workspace `Prepare approval letters` row action opened the generic new-proposal wizard instead of the intervention approval-letter route with `entry=approval&approvalType=intervention&step=communication&interventionId=37&planId=6`.
- Notes: the Kayla Gladue PROD issue was application `ISET-20260505-4ED405`, application row `61`, case `138`. The submitted payload had collapsed to final upload/signature fields only, leaving the Manage ISET Applications row blank and assignment facts missing. A first guarded repair populated display/routing facts from linked client `160` and assigned the Alberta case owner. A second guarded recovery used temporary PITR cluster `codex-kayla-pitr-20260506140904` restored to `2026-05-05T16:20:00Z` to recover the May 1 saved draft payload, merged it with the live May 5 final upload/signature fields, and wrote the recovered full payload back to PROD. Verification found `110` answer keys on both `iset_application_submission.id=61` and `iset_application.id=61`; the temporary `codex-kayla-*` cluster/instance were deleted afterward. Bill can remove the temporary IAM inline policy `TemporaryKaylaDraftRecovery`.
- Notes: the root cause for Kayla was in the public portal completion path. `../ISET-intake/server.js` submitted from short-lived `input_json_state` only, so if that state expired/recreated around the final upload/signature step, the endpoint could create a damaged final-step-only submission and delete the durable draft. The DEV-only fix adds `src/services/intakeCompletionPayload.js`, makes `/api/intake/complete` merge durable `iset_application_draft_dynamic` draft data with the latest ephemeral state, strips internal root keys, carries merged history/doc refs, and returns `422 submission_incomplete` instead of creating a submission when core applicant facts are absent. `src/pages/DynamicTest.js` now surfaces that backend message. Focused test `npm test -- --runTestsByPath src/__tests__/intakeCompletionPayload.test.js --watchAll=false` passed; no full build was run per Bill's request, and Bill said he would roll it out later.
- Notes: on 2026-05-08, this same Task History title was reused for a small PROD data repair on Madison Lightning-Swampy's case `CASE-2026-0000061` (`iset_case.id = 61`). A case manager had accidentally closed action plan `35`, `Child and Youth Counselor`, leaving it `closed` with `closed_at = 2026-05-07 00:00:00`, `result_code = 7`, `result_date = 2026-05-07`, and ESDC result fields set. Guarded PROD SQL changed only that plan back to true draft shape: `status = draft`, `activated_at = NULL`, `closed_at = NULL`, result fields cleared, closure/outcome fields cleared, and ESDC result keys removed. A follow-up check showed the case itself still persisted `dormant`; because `recomputeCaseStatus` derives draft-only cases as `initiated` and `dormant` is for closed/archived-plan cases, a second guarded update changed `iset_case.status` and `lifecycle_status` from `dormant` to `initiated`. Final verification showed action plan `35:draft` and case `61` / `CASE-2026-0000061` as `initiated`.

### Review secure messaging panel

- Codex task title: `Review secure messaging panel`
- Topic: secure-message compose/read UX investigation and DEV implementation of a workspace-owned floating compose panel
- Keywords: `Review secure messaging panel`, `secure messaging`, `SecureMessagingWidget`, `SecureMessageComposePanel`, `floating panel`, `floating window`, `non-modal`, `compose`, `reply`, `quick layouts`, `Application Workspace`, `Case Workspace`, `draft`, `secure-messaging:open-compose`, `secure-messaging:refresh`
- When to open: the user asks why secure-message compose is now floating instead of modal, asks why quick layouts should not close the draft, asks whether the secure messaging widget must stay on the board for an open draft, asks about draft-save support, asks how the panel behaves when staff switch to another applicant/case, or wants to continue secure-message read/compose UX work.
- Primary docs:
  - `docs/widgets/admin/secure-messaging-widget.md`
  - `docs/meta/changelog.md`
  - `docs/meta/next-release-notes-log.md`
  - `src/widgets/SecureMessageComposePanel.jsx`
  - `src/widgets/SecureMessagingWidget.js`
  - `src/pages/applicationCaseDashboard.js`
  - `src/pages/Caseworking/CaseWorkspacePage.jsx`
- Status: current as of 2026-05-06; DEV implementation only, with no full build run per user request.
- Notes: the investigation found that reusing the floating-panel pattern was sensible for secure-message compose, but persistent draft save/retrieval would require deeper backend work and was explicitly deferred. The first DEV pass made compose non-modal but kept the panel state inside `SecureMessagingWidget`; quick-layout changes that removed the widget still unmounted the open draft.
- Notes: the follow-up DEV fix hoisted secure-message compose ownership into both workspace shells. `SecureMessagingWidget` now launches compose/reply through `secure-messaging:open-compose`, while the workspace-owned `SecureMessageComposePanel` owns in-memory draft state, sends through the existing `/api/cases/:id/messages` route, preserves form attachment behavior, dispatches `secure-messaging:refresh` after send, and closes with a warning if the workspace changes to another case/applicant. This lets quick layouts remove Secure Messaging from the board without closing the floating draft.

### Fix generic notification emails

- Codex task title: `Fix generic notification emails`
- Topic: generic staff notification email dispatch, approval decision events, intervention proposal follow-up, homepage queue fixes, and TEST deployment of the admin hotfix set
- Keywords: `Fix generic notification emails`, `notification_setting.email_alert`, `notification_template`, `generic staff email`, `notificationDispatcher`, `SES`, `template editor`, `nwac_review_approved`, `nwac_review_denied`, `nwac_review_changes_requested`, `intervention_proposal_approved`, `intervention_proposal_denied`, `intervention_proposal_changes_requested`, `intervention_revision_approved`, `intervention_revision_denied`, `intervention_revision_changes_requested`, `assessment_approval_letter`, `approval letter unlock`, `Pending Completion`, `Awaiting Approval`, `My Clients`, `budget pot code`, `20260505-admin-notification-pot-code-test`
- When to open: the user asks why non-assignment staff notification emails do or do not send, wants to revisit approval/denial/pushback event routing, asks about notification template fields or scenario previews, investigates intervention proposal approval-letter follow-up, sees Pending Completion/Awaiting Approval queue behavior, sees raw budget-pot IDs in bell alerts, or needs the TEST deployment context for the May 5 admin hotfix set.
- Primary docs:
  - `docs/change-requests/CR-0014-Configurable-Notification-Email-Pipeline.md`
  - `docs/dashboards/manage-notifications-dashboard.md`
  - `docs/dashboards/template-editor-dashboard.md`
  - `docs/dashboards/admin-home-my-work-widget.md`
  - `docs/planning/iset-coordinator-homepage.md`
  - `docs/widgets/admin/intervention-assessment-widget.md`
  - `docs/widgets/admin/interventions-widget.md`
  - `docs/ops/deployments/deployment-quick-guide.md`
  - `docs/meta/changelog.md`
  - `docs/meta/next-release-notes-log.md`
  - `isetadminserver.js`
  - `../shared/events/notificationDispatcher.js`
  - `src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx`
  - `src/pages/Caseworking/caseWorkspace/widgets/InterventionsWidget.jsx`
  - `src/pages/home/HomeDashboardPage.jsx`
  - `src/pages/home/widgets/IsetCoordinatorWorkQueueWidget.js`
  - `src/pages/home/widgets/ProgramAdminWorkQueueWidget.js`
  - `src/pages/home/widgets/WorkQueueItemsTableWidget.js`
- Status: current as of 2026-05-05; deployed to TEST as admin release `20260505-admin-notification-pot-code-test` with schema/data/portal skipped.
- Notes: this thread completed the missing generic staff email dispatch path so configured non-assignment events can send SES emails from `notification_setting.email_alert` / `template_id` by event, role, language, and context while preserving the TEST real-email block and existing assignment-family emails. The notification work also split the NWAC review decision outcomes into distinct approval, denial, and changes-requested events, kept owner/watcher scoping expectations explicit for case-specific staff events, and improved the Template Editor with grouped placeholders, scenario previews, unsupported-placeholder warnings, and updated help-panel guidance. Follow-up testing found that broad role notifications can over-send if settings are not owner/watcher scoped; future notification changes should verify recipient scoping in `../shared/events/notificationDispatcher.js` before enabling email rows.
- Notes: the Sarah Froese/Amanda Curtis investigation found that application assessment approval events had been implemented, but the two intervention proposal workflows did not emit equivalent backend events and did not reliably keep the approval-letter step available after approval. The narrow DEV fix added six event keys without a schema migration: `intervention_proposal_approved`, `intervention_proposal_denied`, `intervention_proposal_changes_requested`, `intervention_revision_approved`, `intervention_revision_denied`, and `intervention_revision_changes_requested`. New proposal decisions emit from the intervention decision path; revision denial/changes-requested emit from the draft revision decision path; revision approvals emit when the approved draft is applied to the persisted source intervention so the event survives draft deletion. These events flow through the existing event/notification/audit infrastructure and are intended to appear in notification settings, bell/email routing, the events panel, and audit history.
- Notes: the intervention approval-letter follow-up was changed so approved new/revised intervention proposals remain available/openable until the approval letter is sent. The unlock is derived from persisted approved proposal/revision state, not temporary frontend `completionNote`, and deliberately does not treat every ordinary approved/planned/in-progress intervention as needing a new approval-letter step. The case secure-message attachment guard was updated so `assessment_approval_letter` can be sent when the message belongs to the case, the attached intervention belongs to the case, and the relevant proposal/revision status is approved; intervention denial-letter paths remain hidden/blocked because proposal workflows only need the approval letter on approval.
- Notes: DEV workflow testing in the same thread produced several small queue/workflow fixes: Pending Completion now includes post-decision but pre-completion application and intervention work; opening Pending Completion items should route to the relevant wizard step rather than stale last-viewed step; ISET Coordinator homepages now have a `My Clients` queue for assigned client files; submitted intervention revisions now appear in the coordinator Awaiting Approval queue; pushed-back intervention revisions keep rework state while saving progress and use `Resubmit for approval` on the final action; assigned case managers can PATCH their own interventions, including moving approved interventions to `in_progress`, without being blocked by proposal-decision permissions.
- Notes: two runtime bugs were also fixed during DEV testing. Sending an approval letter for an approved intervention proposal could throw `Cannot read properties of null (reading 'toLowerCase')` because optional intervention metadata was normalized unsafely; the fix made the metadata normalization null-safe. Intervention proposal approved bell alerts could show a raw `budget_pot.id`; new alerts now prefer `budget_pot.code` or name by resolving pot code/name into event payloads and by avoiding raw ID fallback in the shared dispatcher. Existing already-created alerts may still contain the old stored message.
- Notes: the TEST deploy on 2026-05-05 followed the deployment runbook sequence after the earlier maintenance-process miss: admin-scoped warning, wait through the warning window, enable admin ALB fixed-response 503 fallback, run `path:deploy` with `--skip-schema --skip-data --skip-portal`, smoke the admin target group, clear fallback, then clear warning. Release `20260505-admin-notification-pot-code-test` updated both TEST admin instances successfully and smoke reported both admin targets healthy.

### Explain PATH XML validation rules

- Codex task title: `Explain PATH XML validation rules`
- Topic: ILMP XML validation rule storage and status-driven closeout validation for action plans and interventions
- Keywords: `Explain PATH XML validation rules`, `PATH XML validation`, `ILMP validation`, `ESDC ILMP`, `runIlmpValidation`, `ILMP_PARTICIPANT_RULES`, `esdcIlmpParticipantRules`, `ActionPlanEndDate`, `InterventionEndDate`, `InterventionOutcome`, `action plan result`, `terminal status`, `closed`, `ready_to_close`, `completed`, `cancelled`, `planned end date`, `outcome required`, `no schema change`
- When to open: the user asks how PATH stores XML validation rules for ILMP submission, asks why an action plan or intervention with an end date needs outcomes, asks whether planned end dates should fail ILMP validation, asks how closeout fields are emitted in the ILMP XML, or asks about the no-schema-change terminal-status validation decision.
- Primary docs:
  - `docs/workflows/admin/ilmp-reporting.md`
  - `docs/planning/ilmp-export-hardening-plan.md`
  - `docs/data/ESDC/ilmp-standard-data-file-iset-spf-2023-extracted.md`
  - `docs/meta/changelog.md`
  - `docs/meta/next-release-notes-log.md`
  - `src/server/esdcIlmpParticipantRules.js`
  - `isetadminserver.js`
  - `src/pages/Caseworking/caseWorkspace/modals/InterventionModal.jsx`
- Status: current as of 2026-05-04
- Notes: the initial codebase read found that PATH does not store the ILMP XML validation rules as editable database rows. The source rules are mostly hard-coded in `src/server/esdcIlmpParticipantRules.js` as `ILMP_PARTICIPANT_RULES`, with additional validation and readiness logic in `runIlmpValidation()` in `isetadminserver.js`; the database stores validation/readiness results and payload snapshots for participant submissions, not the rule definitions. `fast-xml-parser` is used for XML well-formedness, while the ESDC XSD/SCH files under `docs/data/ESDC` are reference artifacts rather than runtime validators.
- Notes: Bill confirmed that no schema change should be made because changing end-date storage would require a risky PROD migration. The implemented decision keeps the existing `end_date` fields but treats non-terminal end dates as planning data. ILMP closeout validation and XML emission are now status-driven: terminal action plans (`closed` / `ready_to_close`) require result code/date and related conditional closeout fields, while terminal interventions (`completed` / `cancelled`) require end date and outcome. Non-terminal intervention/action-plan end dates can be planned without requiring outcomes and are suppressed from ILMP closeout XML fields; date format and basic sanity checks still run when a date is present. The intervention modal no longer blocks planned end dates for non-terminal interventions, and direct intervention status updates now require an end date when moving to a completed/cancelled terminal state.

### Locate PROD case merge thread

- Codex task title: `Locate PROD case merge thread`
- Topic: PROD repair for duplicate imported/public-portal applicant identities, using Jodie Stephens as the first fully documented case
- Keywords: `Locate PROD case merge thread`, `Jodie Stephens`, `Jodies Stephens`, `CASE-2026-0000072`, `ISET-20260501-9AEC9C`, `duplicate applicant identity`, `public portal canonical`, `client file import`, `client_file_import`, `application lock`, `manual_upload`, `application_submission`, `proposal 84`, `assessment draft`, `jodie-stephens-merge-20260504123533`, `path-prod-jodie-stephens-merge-20260504122704`
- When to open: the user asks about the PROD merge where an imported client/case and a public portal application represented the same applicant, asks how to detect or repair this duplicate-identity pattern, asks why the portal created a second Jodie identity, asks how to preserve staff draft intervention work while keeping the portal application canonical, or asks for the Jodie Stephens repair details.
- Primary docs:
  - `docs/guides/prod-duplicate-applicant-identity-merge.md`
  - `sql/ops/prod-merge-jodie-stephens-client-case-20260504.sql`
  - `docs/ops/agent-operational-access.md`
  - `docs/meta/changelog.md`
  - `docs/data/record-locking.md`
  - `docs/guides/client-file-imports.md`
  - `docs/planning/client-case-application-target-model.md`
- Status: current as of 2026-05-04
- Notes: this thread first tried to locate an earlier merge thread and found no matching indexed entry, then verified PROD DB access through `scripts/run-prod-sql-via-ssm.sh` and improved the operational access docs. The live data investigation found an imported SMU-email client/case and a later activated Gmail public-portal application for the same applicant. The root cause was the intended hardened portal identity behavior: public portal account linking does not fuzzy-match by name, DOB, SIN, or alternate email to an imported client. Bill chose the portal application as the truth for personal details/email and asked that Amanda's unsubmitted intervention proposal work be carried forward into the application assessment context.
- Notes: the PROD repair used Aurora snapshot `path-prod-jodie-stephens-merge-20260504122704`, an application lock, and an admin maintenance warning. The successful guarded SQL run `jodie-stephens-merge-20260504123533` kept public portal client `156` / user `199` / case `134` / application `56` as the survivor, retired imported client `72` / case `72`, suspended old user `75`, seeded a draft assessment from proposal `84`, moved 25 manual-upload documents while preserving source metadata, left 21 portal-submitted documents distinguishable as `application_submission`, inserted client/case merge audit rows, and made no hard deletes. The first apply attempt failed on the manual-upload document scope CHECK and rolled back cleanly; the corrected script populated `applicant_user_id` for moved application-linked manual uploads.

### Locate chat evidence

- Codex task title: `Locate chat evidence`
- Topic: recovery search for prior discussion about Manage ISET Applications filtering, followed by implementation of a Case Management-style application status selector on the ISET Applications widget
- Keywords: `Locate chat evidence`, `Manage ISET Applications`, `ISET Applications`, `case-assignment-dashboard`, `ApplicationsWidget`, `Application list filter`, `Show Active Applications`, `Show Approved Applications`, `Show Denied Applications`, `Show My Flagged Applications`, `statusGroup`, `watchedOnly`, `Auto assignment on`, `Search`
- When to open: the user asks whether there was prior chat evidence for application-list filtering, asks why the Manage ISET Applications table has a header selector, wants to adjust the status filter options/order/placement, asks what the Applications table Search box searches, or wants to compare the applications table selector with the `/iset/cases` Case Management selector.
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/meta/changelog.md`
  - `src/widgets/ApplicationsWidget.js`
  - `isetadminserver.js`
  - `src/server/caseWatchRepository.js`
  - `src/helpPanelContents/applicationsWidgetHelp.js`
  - `src/helpPanelContents/caseAssignmentDashboardHelp.js`
  - `src/pages/Caseworking/portfolio/widgets/CasesTableWidget.jsx`
- Status: current as of 2026-05-03
- Notes: this thread first checked `docs/meta/codex-thread-index.md` and related docs for evidence of an earlier chat about better filtering in the ISET Applications widget on `/case-assignment-dashboard`. No direct indexed prior-thread evidence was found. The closest historical evidence was `docs/change-requests/CR-0001-watchlist.md`, which documented a “My watched cases” filter, and code in `src/widgets/ApplicationsWidget.js` that still had watch/filter state from that era. Bill then clarified the desired pattern by pointing to `/iset/cases`, where `CasesTableWidget` puts a Cloudscape `Select` in the `Header` actions. The DEV implementation added an equivalent header action selector to `ApplicationsWidget`, ordered as auto-assignment badge, selector, refresh button, with light flex centering around the badge. The selector options are `Show Active Applications`, `Show New Applications`, `Show In Assessment`, `Show Pending Decision`, `Show Decision Recorded`, `Show Approved Applications`, `Show Denied Applications`, `Show Closed Applications`, `Show My Flagged Applications`, and `Show All Applications`.
- Notes: backend support was added to `/api/applications` through `statusGroup` and `watchedOnly` query parameters so filtering stays server-side with pagination/counts. `statusGroup` maps to application lifecycle/status/decision filters for submitted, assessment, pending decision, decision recorded, approved, denied, and closed/archived. The flagged view uses `iset_case_watch` via the exported `resolveWatchColumn()` helper to preserve compatibility with the table's current `staff_profile_id`/legacy `user_id` column shape. The existing Search box remains a text search over practical table-facing fields: tracking ID, applicant name/source-name variants, application/case status text, assigned owner email, lock owner name/email, and province; it does not meaningfully search computed overdue label, received date, flag state, or arbitrary application payload answers.

### Locate templates chat history

- Codex task title: `Locate templates chat history`
- Topic: notification template discovery and production rollout for secure-message notification splitting, owner-scoped applicant-message alerts, staff template/email delivery, Administrative Users profile-name editing, and SES/maintenance operational fixes
- Keywords: `Locate templates chat history`, `templates page`, `notification_template`, `New secure message from applicant`, `Approval Pushback Email`, `Illegal mix of collations`, `applicant_secure_message_received`, `staff_secure_message_sent`, `message_received`, `owner-scoped email dispatch`, `case watchers`, `SES_backend`, `DenySesSendDuringProdDataRehearsal`, `program.admin@awentech.ca`, `bill@sillery.co.uk`, `Administrative Users`, `Name`, `Display Name`, `20260502-225259`, `Bad Gateway`, `maintenance fallback`
- When to open: the user asks where the templates-page improvement chat was indexed, asks whether templates are stored in the database, asks for SQL to add notification templates to PROD, asks why secure-message notifications emailed staff/applicants, asks about inbound vs outbound secure-message notification events, asks why applicant secure-message alerts should go only to owners/watchers, asks why DEV SES was blocked by AWS, asks about configuring Administrative Users `Name` / `Display Name`, or asks what happened in the 2026-05-02 PROD rollout.
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/dashboards/manage-notifications-dashboard.md`
  - `docs/dashboards/template-editor-dashboard.md`
  - `docs/features/user-management.md`
  - `docs/assignment/staff-profiles.md`
  - `docs/ops/agent-operational-access.md`
  - `docs/ops/deployments/deployment-quick-guide.md`
  - `docs/ops/deployments/path-deploy-orchestrator.md`
  - `docs/meta/changelog.md`
  - `docs/meta/next-release-notes-log.md`
  - `../ISET-intake/docs/system/runtime/notifications.md`
  - `../shared/events/catalog.js`
  - `../shared/events/notificationDispatcher.js`
  - `../ISET-intake/server.js`
  - `../ISET-intake/notifications/applicantEmailNotifications.js`
  - `../ISET-intake/sesMailer.js`
  - `src/widgets/manageTemplates.js`
  - `src/pages/manageUsers.js`
  - `src/routes/admin/users.js`
  - `sql/migrations/20260502_0001_split_secure_message_notification_events.sql`
  - `scripts/run-prod-sql-via-ssm.sh`
- Status: current as of 2026-05-02. Deployed to PROD as release `20260502-225259`.
- Notes: this thread first confirmed notification templates are database-backed in `notification_template`, listed the DEV templates, produced PROD-safe SQL patterns that avoid template-name collation failures, and created the DEV `New secure message from applicant` template without including secure-message body content in email. Runtime log analysis showed that the old generic `message_received` setting caused staff and applicant notification paths to share one event. The durable fix split secure-message notifications into `applicant_secure_message_received` for public-portal applicant-to-staff messages and `staff_secure_message_sent` for admin staff-to-applicant messages, with `applicant_secure_message_received` owner-scoped for bell alerts and emails. The assigned case/application owner receives through their actual role setting, case watchers receive through the `ISET Coordinator` row, and the event no longer broadcasts to every System/NWAC/Regional/ISET staff user just because that role row is enabled. The thread also added configurable staff `Name` and `Display name` fields to the Administrative Users profile view, backed by `staff_profiles` updates.
- Notes: the SES investigation proved the attempted `program.admin@awentech.ca` and `bill@sillery.co.uk` identities in the AWS error were recipient staff identities, not the configured PATH sender. DEV/test AWS account `124355655255` had verified SES identities and sending enabled, but IAM user `SES_backend` had an explicit inline deny policy named `DenySesSendDuringProdDataRehearsal` (`ses:Send*` on `*`). That leftover safety policy was removed from `SES_backend`; the attached `AllowSESSendOnly` policy remained. SES in that account was still sandboxed at that time, so DEV/test sending remained limited to verified identities.
- Notes: PROD release `20260502-225259` deployed shared/admin/portal changes, applied `20260502_0001_split_secure_message_notification_events.sql`, inserted PROD template id `14` for `New secure message from applicant`, verified the split `notification_setting` rows, and passed final health smoke for `https://nwac-console.awentech.ca/healthz`, `https://iset.nwac.ca/healthz`, and `https://nwac-public.awentech.ca/healthz`. Operational incident from the rollout: only the in-app maintenance warning was set before the ASG refresh, so users briefly saw raw `502 Bad Gateway`; the runbook required the ALB hard maintenance fallback for any PROD rollout that might surface 502s. The fallback was enabled during the refresh and later cleared after the ASG was healthy. Future PROD deploys using ASG refresh must set the ALB fallback before starting the refresh, not only the in-app warning.

### Find secure message event

- Codex task title: `Find secure message event`
- Topic: code-confirmed secure-message event keys, notification dashboard labels, and bell-alert targeting behavior for applicant-origin secure messages
- Keywords: `Find secure message event`, `applicant_secure_message_received`, `staff_secure_message_sent`, `message_received`, `Applicant secure message received`, `Staff secure message sent`, `secure message bell alert`, `Regional Manager notifications`, `ISET Coordinator notifications`, `case watchers`, `tag case`, `notification_setting`, `iset_internal_notification`, `emitApplicantSecureMessageReceivedEvent`
- When to open: the user asks what event applicants trigger when sending a secure message from the public portal, asks what it is called in Manage Notifications, asks whether Regional Managers or ISET Coordinators receive bell alerts for secure messages, asks whether alerts are role-wide or case-assignee scoped, or asks whether an RM must tag/watch a case to keep getting alerts after assigning it to a team member
- Primary docs:
  - `../ISET-intake/server.js`
  - `../shared/events/catalog.js`
  - `../shared/events/emitter.js`
  - `../shared/events/notificationDispatcher.js`
  - `src/internalNotifications.js`
  - `src/widgets/notificationSettingsWidget.js`
  - `isetadminserver.js`
- Status: current as of 2026-05-02
- Notes: as of 2026-05-02, secure-message notification events are direction-specific. The public portal emits `applicant_secure_message_received` after applicant-to-staff case messages; the admin case workspace emits `staff_secure_message_sent` after staff-to-applicant messages. The legacy `message_received` key may still appear in older event history, but new notification matrix configuration should use the split event keys. Enabled bell settings create `iset_internal_notification` rows through `dispatchInternalNotifications()`, and enabled staff email rows render through `dispatchGenericStaffNotificationEmails()`. `applicant_secure_message_received` is owner-scoped for both bells and emails: the assigned owner receives it through the notification row for their actual staff role, while `iset_case_watch` watchers receive it through the `ISET Coordinator` row. The event does not broadcast to every System Administrator, NWAC Administrator, Regional Manager, or ISET Coordinator just because a role row is enabled. If an RM assigns the case to a team member and still wants alerts, they need to watch/tag the case. If a case is unassigned, watchers can still receive alerts when the `ISET Coordinator` row is configured.

### Clarify thread context persistence

- Codex task title: `Clarify thread context persistence`
- Topic: clarified Codex cross-thread persistence limits, confirmed `docs/AGENTS.md` as the future thread entry point, and completed the initial cross-app documentation cleanup pass for admin and portal docs
- Keywords: `Clarify thread context persistence`, `persistent context`, `docbase cleanup`, `documentation cleanup`, `memory base`, `thread index`, `AGENTS.md`, `documentation-cleanup-plan`, `ISET-intake docs`, `portal docbase`, `stale docs`, `schema dumps`, `meta logs`
- When to open: the user asks why future threads need to read `docs/AGENTS.md`, asks whether the docs are now safe/useful for Codex, asks what happened in the documentation cleanup thread, asks where the cleanup plan or triage indexes live, asks whether portal docs are in scope, or asks how to continue/prune the docbase
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/meta/standing-directive.md`
  - `docs/meta/documentation-cleanup-plan-2026-04-29.md`
  - `docs/meta/documentation-audit-2026-04-29.md`
  - `docs/meta/project-map.md`
  - `docs/meta/planning-cr-archive-triage-2026-04-29.md`
  - `docs/meta/data-artifact-retention-2026-04-29.md`
  - `docs/meta/meta-log-retention-2026-04-29.md`
  - `scripts/check-doc-links.py`
  - `../ISET-intake/docs/AGENTS.md`
- Status: current as of 2026-04-29
- Notes: this thread began by clarifying that Codex does not carry hidden durable project context across new chat threads and needs a repo-backed memory base. Bill confirmed the desired model: short task-based threads, with `docs/AGENTS.md` as the entry point and a maintained docbase/thread index to preserve project know-how. The thread then performed the initial cross-app documentation cleanup pass across `admin-dashboard/docs` and `../ISET-intake/docs`: added README gates, compacted `docs/AGENTS.md`, expanded the doc-link checker across both repos, audited ops docs, redacted literal DB passwords from historical notes, classified planning/change-request/archive docs, added data-artifact and meta-log retention policies, replaced three superseded planning docs with redirect stubs, and marked the cleanup pass complete in the persistent cleanup plan. Current future threads should start with `/home/bill/ISET/admin-dashboard/docs/AGENTS.md`; broad docbase cleanup continuation should also open `docs/meta/documentation-cleanup-plan-2026-04-29.md`.

### Recover task thread

- Codex task title: `Recover task thread`
- Topic: recovery and continuation of the lost migration-preparation thread, including the second TEST privacy ERM rehearsal, duplicate-case consolidation, PROD maintenance warning, TEST UI validation, Wabanang generated-document repair, root-cause trace for missing public-portal signed-form PDFs, and the PROD repair that regenerated those missing artifacts
- Keywords: `Recover task thread`, `lost thread`, `second rehearsal`, `privacy ERM rehearsal`, `PROD migration`, `TEST validation`, `duplicate-case consolidation`, `Erica Christian`, `one client one case`, `Wabanang Polson`, `missing assessment PDFs`, `public portal signed forms`, `missing consent PDFs`, `signed-form repair`, `prod-client-case-application-20260416`, `signed-form-repair-2026-04-28T20-48-43-389Z`
- When to open: the user asks to recover the major PROD migration preparation/testing thread, asks what happened during the second TEST rehearsal, asks whether duplicate cases were consolidated, asks why Wabanang was missing generated assessment/application/financial overview PDFs, asks why early PROD public-portal submissions were missing signed consent/declaration PDFs, asks whether the missing signed forms were repaired on PROD, or asks for the current state before proceeding with the PROD cutover
- Primary docs:
  - `docs/ops/environments/privacy-erm-grand-cleanup-rehearsal.md`
  - `docs/ops/environments/test-prod-migration-rehearsal.md`
  - `docs/planning/privacy-erm-cleanup-progress.md`
  - `docs/planning/privacy-erm-cleanup-grand-release-plan.md`
  - `docs/planning/client-case-application-target-model.md`
  - `sql/ops/privacy-erm-duplicate-case-consolidation-preview.sql`
  - `sql/ops/privacy-erm-duplicate-case-consolidation-apply.sql`
  - `scripts/repair-wabanang-generated-docs.js`
  - `scripts/repair-missing-portal-signed-form-docs.js`
  - `tmp/path-deploy/prod/prod-client-case-application-20260416--2026-04-17T02-10-02-689Z.json`
- Status: current as of 2026-04-28
- Notes: this task began as recovery from a prior inaccessible thread while preparing the privacy ERM/client-case-application migration for PROD. The recovered work confirmed that DEV contained the target privacy/entity model, that the first PROD-like TEST rehearsal had exposed duplicate client-case groups, and that a second TEST rehearsal was warranted before PROD. The second rehearsal restored a fresh PROD-like dump to TEST, applied the duplicate-case consolidation step, ran the canonical privacy ERM migrations, applied the TEST identity overlay, redeployed admin and portal, and passed DB and route-scope smoke checks. It measured an app-stop-to-healthy-targets TEST window of about `38m 41s`. During guided TEST validation, Erica Christian confirmed the duplicate-case consolidation outcome, Wabanang Polson exposed missing system-generated assessment/application/financial-overview PDFs that also existed in PROD, and the PROD repair generated those three missing Wabanang documents. A later validation finding showed early PROD public-portal submissions had signed consent/declaration payload data but no generated signed-form PDF document rows. The deployment trace found no categorical historical exception log, but the first successful generated signed-form rows appeared immediately after the `prod-client-case-application-20260416` release made `iset_application.client_id` / `case_id` durable and persisted ownership before document materialisation. The PROD signed-form repair then ran on app host `i-08ac3b26965466f3f` with run ID `signed-form-repair-2026-04-28T20-48-43-389Z`, created `109` active signed-form document rows across `22` affected applications, and a post-repair dry-run reported `0` affected applications and `0` missing documents. Bill spot-checked several records and confirmed the signed forms were visible.

### Privacy ERM cleanup grand release plan

- Codex task title: exact original task title not preserved
- Topic: DEV-first cleanup plan for PATH entity relationships, secure-message privacy risk, staff/user identity-domain confusion, document/message attachment scope, stale backend experiments, and the eventual rehearsed PROD grand cleanup migration
- Keywords: `privacy ERM cleanup`, `grand cleanup release`, `secure messaging`, `message_item`, `staff_profiles.id`, `user.id`, `assigned_to_user_id`, `case thread`, `document scope`, `message attachments`, `legacy experiments`, `govuk_component`, `jordan_application`, `stored procedures`, `DEV first`, `PROD migration`
- When to open: the user asks how to tackle the broken old secure-message/entity model, asks for the durable plan to survive thread transitions, asks what Codex is using as the controlling plan for DEV cleanup before PROD migration, asks why secure messaging should be case-scoped instead of user-recipient scoped, or asks which odd schema/backend experiments should be removed as part of the privacy cleanup release
- Primary docs:
  - `docs/planning/privacy-erm-cleanup-grand-release-plan.md`
  - `docs/planning/privacy-erm-cleanup-progress.md`
  - `docs/data/privacy-erm-audits/dev-20260426.md`
  - `scripts/privacy-erm-audit.js`
  - `scripts/privacy-erm-smoke.js`
  - `sql/migrations/20260427_0003_retire_jordan_application_experiment_tables.sql`
  - `sql/migrations/20260427_0004_retire_appointment_queue_legacy_routines.sql`
  - `sql/migrations/20260427_0005_add_event_entry_typed_actor_references.sql`
  - `sql/migrations/20260427_0006_add_application_version_typed_author_references.sql`
  - `sql/migrations/20260427_0007_add_event_receipt_typed_viewer_references.sql`
  - `sql/migrations/20260427_0008_harden_system_generated_document_scope.sql`
  - `sql/migrations/20260427_0009_retire_secure_message_legacy_participant_columns.sql`
  - `sql/migrations/20260427_0010_retire_legacy_case_assignment_shadow.sql`
  - `sql/migrations/20260427_0011_retire_internal_notification_legacy_identity_shadows.sql`
  - `sql/migrations/20260427_0012_retire_event_receipt_legacy_recipient_shadow.sql`
  - `sql/migrations/20260427_0013_retire_legacy_case_application_pointer.sql`
  - `sql/migrations/20260427_0014_harden_application_case_scope.sql`
  - `sql/migrations/20260427_0015_retire_application_version_legacy_author_shadow.sql`
  - `sql/migrations/20260427_0016_harden_event_entry_typed_actor_scope.sql`
  - `sql/migrations/20260427_0017_harden_application_and_cfa_relationship_fks.sql`
  - `sql/migrations/20260427_0018_harden_remaining_relationship_fks.sql`
  - `sql/migrations/20260427_0019_retire_zzz_legacy_documents_table.sql`
  - `sql/ops/privacy-erm-staff-shared-user-identity-preview.sql`
  - `sql/ops/privacy-erm-client-account-event-orphan-preview.sql`
  - `sql/ops/privacy-erm-client-account-event-orphan-apply.sql`
  - `sql/ops/privacy-erm-duplicate-case-consolidation-preview.sql`
  - `sql/ops/privacy-erm-duplicate-case-consolidation-apply.sql`
  - `sql/ops/privacy-erm-message-item-cleanup-preview.sql`
  - `sql/ops/privacy-erm-message-item-cleanup-apply.sql`
  - `docs/ops/environments/test-prod-migration-rehearsal.md`
  - `docs/ops/environments/privacy-erm-grand-cleanup-rehearsal.md`
  - `docs/planning/privacy-security-systematic-review-2026-04-25.md`
  - `docs/planning/public-portal-legacy-fallback-security-review-2026-04-25.md`
  - `docs/planning/client-case-application-target-model.md`
  - `docs/AGENTS.md`
  - `isetadminserver.js`
  - `../ISET-intake/server.js`
- Status: current as of 2026-04-28; incomplete-title
- Notes: this plan was created after a DEV ERM/backend review found that the secure-message breach class is rooted in broader identity-domain and object-scope weaknesses, including `staff_profiles.id` stored in columns named `user_id`, unconstrained message/document relationships, unsafe `message_item` state, split staff/local-user identity, document rows missing scope, stale routes referencing missing tables, and old experiment tables/procedures. The agreed direction is DEV-first repair and target-model migration, then a carefully rehearsed PROD grand cleanup release with snapshot/restore point, before/after audits, privacy smokes, and guarded data migration. First execution pass on 2026-04-26 added `scripts/privacy-erm-audit.js`, generated `docs/data/privacy-erm-audits/dev-20260426.md`, patched admin case-message reads so authorized staff case viewers no longer create or trust nonparticipant `message_item` rows, applied DEV-only guarded cleanup that deleted 38 unsafe `message_item` rows after preserving them in `privacy_erm_message_item_cleanup_audit`, patched current public-portal attachment creation to persist `message_attachment.case_id`, retired obsolete admin GOV.UK component, old case-based application-version, and direct application-answer patch routes with explicit `410 retired_endpoint` responses, and applied DEV-only document-scope cleanup preserving old/new values in `privacy_erm_document_scope_cleanup_audit`. The next identity-domain pass added canonical migration `sql/migrations/20260426_0001_add_case_assigned_staff_profile_id.sql`, creating `iset_case.assigned_staff_profile_id` with an FK to `staff_profiles(id)`, backfilling it from valid legacy assignment values, normalizing invalid legacy values to unassigned, dual-writing case assignment updates in admin and portal code, extending the privacy audit to report explicit assignment counts and drift, and cutting high-risk admin/shared assignment reads, joins, filters, and comparisons over to explicit staff-profile semantics. The following secure-message bridge migration added `sql/migrations/20260426_0002_add_message_actor_domain_columns.sql`, creating typed sender/recipient actor fields on `messages` with FKs to `user(id)` and `staff_profiles(id)`, backfilling DEV messages to `staff_profile -> applicant_user`, updating admin and portal message writes to populate the new fields, and adding audit counts for missing actor-domain data or `local_user` fallbacks. Attachment hardening then added `sql/migrations/20260426_0003_harden_message_attachment_scope.sql`, adding `message_attachment.client_id`, fixing `application_id` typing, adding FKs to message/case/application/client/user, writing client scope from the public portal, and validating attachment scope during admin adoption into `iset_document`. The secure-message referential pass added `sql/migrations/20260426_0004_add_secure_message_referential_constraints.sql`, adding FKs for legacy message sender/recipient compatibility fields, message case/application scope, and `message_item` message/owner rows after DEV cleanup proved those relationships clean. The code cutover then moved public-portal applicant message reads/reply targeting and admin mailbox-state authority to typed actor fields plus case/application scope while preserving legacy response fields for frontend compatibility. The document reference pass added `sql/migrations/20260426_0005_harden_document_scope_references.sql`, normalizing document user/message ID column types and adding FKs for document user, applicant user, case, application, and origin message relationships. The case/application cleanup confirmed DEV core FKs are present and retired `POST /api/applications/ingest-from-submission` because it could create unscoped application rows. The response-contract cleanup moved admin secure-message widget classification to typed actors and stopped the public portal reply composer from sending legacy `recipient_id` for replies. The 2026-04-28 TEST rehearsal follow-up added duplicate-case consolidation preview/apply SQL after Erica Christian exposed the old one-client/many-cases UI pattern in TEST; rollback-only validation found four merge pairs, zero blockers, zero dangling references, and zero duplicate client groups after the scripted consolidation, then rolled back. The 2026-04-28 second TEST rehearsal then applied the duplicate-case consolidation for real, reached 0 pending migrations, passed SSM DB smokes and route-scope smoke, and measured an app-stop-to-healthy-targets window of about 38m41s. That rehearsal also fixed message-item cleanup SQL to work both before migrations with `messages.sender_id` / `recipient_id` and after migrations with `sender_user_id` / `recipient_user_id`.

### Privacy and security systematic review after secure-message breach

- Codex task title: `Investigate secure message breach`
- Topic: post-incident privacy/security review focused on object-level authorization for client data, with hardening of supporting-document, finance payment-packet, admin secure-message, case-note, reminder, and event routes
- Keywords: `privacy breach`, `secure message`, `SIN`, `client data exposure`, `document presign`, `supporting documents`, `payment packets`, `message_item`, `case notes`, `reminders`, `case events`, `object-level authorization`, `case_or_application_scope_required`, `document_scope_mismatch`, `payment_packet_scope_mismatch`, `message_case_mismatch`
- When to open: the user references the post-2026-04-23 privacy/security audit, asks what was already reviewed after the secure-message breach, asks why document endpoints require case/application/intervention context, asks why finance payment packets are scoped differently for finance roles versus casework roles, asks why `/api/admin/messages` was retired, asks why reminders require scoped context, or asks for the remaining security review lanes
- Primary docs:
  - `docs/planning/privacy-security-systematic-review-2026-04-25.md`
  - `docs/ops/path-portal-secure-message-incident-2026-04-23.txt`
  - `sql/ops/prod-fix-applicant-message-recipient-collision-20260423.sql`
  - `docs/AGENTS.md`
  - `isetadminserver.js`
  - `src/lib/caseAccess.js`
- Status: current as of 2026-04-27
- Notes: this thread was opened after the serious 2026-04-23 public-portal secure-message breach where `staff_profiles.id` / `user.id` confusion misrouted applicant-origin messages containing sensitive data. The first review pass found and patched a separate object-level authorization class in admin supporting documents: document list/checklist, presigned download, upload, edit, link, duplicate, and delete paths must now prove case/application/action-plan/intervention/client/payment context instead of trusting staff auth plus a document ID or applicant ID. The same pass hardened finance payment-packet routes so finance/admin payment roles remain global but casework payment roles are case-scoped, and payment batch/full-ledger surfaces require finance/admin access. The next pass found and patched admin secure-message read/send/attachment/status/delete gaps: broad `/api/admin/messages` list/create behavior is retired, case-thread reads now validate case access before seeding `message_item`, and attachment presign/adoption validates the message's case context. The same pass added case-scope checks to case notes, reminder list/detail/create/update/complete/acknowledge paths, and case event timelines. Remaining lanes are recorded in the review note and include portal secure-message follow-up, escalations/signing/generated forms, public unauthenticated support routes, admin feedback attachments, SQL/reporting/export surfaces, and fuller route-level denial tests.

### Public portal legacy fallback security review

- Codex task title: `Investigate secure message breach`
- Topic: applicant-facing public portal review for obsolete model fallbacks, shared `user` table identity collisions, unsafe client linking, staff-recipient resolution, and legacy endpoints that can expose or misroute client data
- Keywords: `public portal`, `legacy fallback`, `email fallback`, `cognito_sub`, `staff_profiles`, `user.id`, `client.applicant_cognito_sub`, `ensureLocalUser`, `ensureClientForUser`, `resolveOrCreateUserIdForStaffProfile`, `fetchLinkedApplicantClientId`, `POST /api/applications`, `COGNITO_ADDITIONAL_CLIENT_IDS`, `x-user-id`, `iset-public-portal`
- When to open: the user asks whether old public-portal compatibility paths remain after the 2026-04-23 secure-message breach, asks why email/name/SIN fallback matching is dangerous, asks whether applicant portal routes can still expose another client's data, asks what the next public-portal security hardening pass should fix, or asks whether the newer `iset-public-portal` rebuild is safe to deploy
- Primary docs:
  - `docs/planning/public-portal-legacy-fallback-security-review-2026-04-25.md`
  - `docs/planning/privacy-security-systematic-review-2026-04-25.md`
  - `docs/ops/path-portal-secure-message-incident-2026-04-23.txt`
  - `docs/AGENTS.md`
  - `../ISET-intake/auth/cognitoAuth.js`
  - `../ISET-intake/server.js`
  - `../iset-public-portal/apps/api/src/server.ts`
- Status: current as of 2026-04-25
- Notes: the portal-focused review found that the exact numeric `staff_profiles.id` / `user.id` message-recipient bug is mitigated in current `../ISET-intake` messaging routes, but high-risk legacy fallbacks remained. The deployed-code question was then verified from the deploy tooling: TEST/PROD public portal deploys come from `../ISET-intake`, while `../iset-public-portal` is parked experimental/rebuild code and should not be treated as live behavior. The first local hardening pass on 2026-04-25 changed `../ISET-intake` so auth email linking refuses already-bound `user.cognito_sub` mismatches and staff-profile email conflicts; staff Cognito groups with underscore names map as admin/staff instead of applicant; applicant data routes require both Applicant role and the primary applicant portal Cognito client while `/api/admin/*` portal-admin routes remain explicit; portal client linking no longer claims existing clients by SIN, old payload, email, or name fallback and refuses to overwrite different `client.applicant_cognito_sub`; staff recipient resolution no longer falls back from `staff_profiles.email` to arbitrary shared `user` rows; legacy `POST /api/applications` returns `410`; and the header no longer sends stale `userId` query params to `/api/messages`. The hardening was deployed to TEST as `portal-security-hardening-20260425-test`, then followed by `portal-security-hardening-message-20260425-test` so staff/admin or wrong-client public-portal sign-ins display `applicant_account_required` instead of a generic workflow-schema error. Jack's TEST applicant account then exposed a false client-match block (`role: Applicant`, `tokenClientMatchesPortal: false`); `portal-auth-cookie-precedence-20260425-test` made portal auth prefer the HttpOnly `iset_access` cookie over any bearer header, but retesting still failed. The confirmed root cause was the TEST deploy installer: it staged `auth/` but did not copy it to `/opt/nwac/portal/auth`, leaving a stale February `cognitoAuth.js` beside the newly deployed `server.js` gate. Commit `5319327` fixed duplicate-cookie token selection and updated `deploy-portal-test.ps1` to install `auth/`; TEST release `portal-auth-helper-copy-20260425-test` verified both instances had the updated helper. Bill then validated TEST login/dashboard/messages/application details/documents and sent a secure-message smoke test; the TEST DB proved that the message went to Amanda's resolved staff local user (`user.id = 104`) and not the applicant row whose `user.id = 54` collided with Amanda's `staff_profiles.id`. The fix was promoted to PROD as portal-only release `portal-auth-helper-copy-20260425-prod` with no schema/data/admin/shared changes; health checks and deployed auth-helper verification passed. The newer rebuild repo was sampled and should not be deployed as-is because it has dev-header impersonation, unauthenticated admin upload-config routes, broken-looking Cognito issuer construction, and a Cognito-sub versus numeric-MySQL-user-ID mismatch.

### Public portal data exposure coding review

- Codex task title: `exact original task title not preserved`
- Topic: applicant-facing public portal database-read exposure review after the secure-message breach, with emphasis on coding/model mistakes rather than classic endpoint vulnerabilities
- Keywords: `public portal data exposure`, `inappropriate access`, `secure message breach`, `MSG-SR-01`, `UP-01`, `recipient email fallback`, `pending_uploads`, `document finalization`, `upload key mismatch`, `signing_request participant_user_id`
- When to open: the user asks for the May 2026 public portal exposure inventory/review, asks which portal features read applicant data, asks about follow-up fixes from the secure-message breach, asks why admin staff-to-applicant messages must not resolve recipients by email fallback, or asks why document finalization now binds keys/paths to pending uploads.
- Primary docs:
  - `docs/planning/public-portal-data-exposure-coding-review-2026-05-04.md`
  - `docs/planning/public-portal-legacy-fallback-security-review-2026-04-25.md`
  - `docs/planning/privacy-security-systematic-review-2026-04-25.md`
  - `../ISET-intake/docs/portal/intake/file-uploads/architecture.md`
  - `isetadminserver.js`
  - `../ISET-intake/server.js`
- Status: current as of 2026-05-04
- Notes: the first review inventoried applicant-facing public portal database-read surfaces in the active deployed repo `../ISET-intake`, excluding intake schema authoring. It found two high-risk coding/model errors: admin staff-to-applicant message/signing creation still resolved applicant portal recipients by client email fallback, and document finalization could bind a caller-supplied S3 key/local path to the authenticated applicant's document row after proving only pending-upload ownership. The 2026-05-04 fix removed the message/signing email and payload user-id fallbacks from `resolveCaseApplicantMessagingContext()`, fails closed on conflicting strong applicant identities, binds local-direct upload paths back to `pending_uploads`, rejects substituted S3 keys/local paths during finalization, and updated portal upload clients to pass `uploadId` into local multipart uploads. Remaining follow-ups are existing-row data audits and the lower-priority count/list payload minimization findings tracked in the review note.

### Assessment request-changes notes, assessment PDF signatures/redlines, CFA signer ownership, and rollout

- Codex task title: `Fix request change case note`
- Topic: NWAC Application Assessment request-changes notes not appearing in Notes and Reminders, submitted/approved assessment PDF signature and redline defects, CFA signer drift to the clicker instead of the assigned case manager, related TEST/DEV staff-profile name cleanup, and the resulting TEST plus admin-only PROD rollout
- Keywords: `Fix request change case note`, `request changes note`, `Notes and Reminders empty`, `case note not created`, `MI-MO75M26T-860BFF`, `assessment PDF v1 v2 v3 v5`, `redline`, `green text on version 1`, `old value red strikethrough`, `Recommendation and Justification`, `acurtis@nwac.ca`, `Amanda Curtis`, `Not signed`, `Approved case manager assessment`, `iset_event_entry`, `legacy case event`, `CFA Shelley Stacey`, `assigned case manager`, `Program Admin`, `Bill Sillery`, `program.admin@awentech.ca`, `bill@sillery.co.uk`, `TEST deploy`, `PROD deploy`, `admin maintenance warning`
- When to open: the user references the thread that started as the missing request-changes case-note bug but then expanded into assessment PDF version/signature issues, asks why a request-changes note did not appear in Notes and Reminders, asks why first-version assessment PDFs showed green compare text, asks why submitted or approved assessment PDFs showed email addresses or `Not signed`, asks why a CFA picked up Shelley Stacey instead of the assigned case manager, asks which TEST staff-profile names were corrected for signature display, or asks which TEST/PROD releases shipped those assessment/CFA fixes
- Primary docs:
  - `docs/widgets/admin/application-assessment-widget.md`
  - `docs/features/document-signing.md`
  - `docs/ops/deployments/prod-deployment-guide.md`
  - `docs/ops/deployments/path-deploy-orchestrator.md`
  - `docs/meta/changelog.md`
  - `isetadminserver.js`
  - `src/widgets/CoordinatorAssessmentWidget.js`
  - `src/server/templates/pdf/assessment.html`
  - `scripts/run-test-sql-via-ssm.sh`
  - `scripts/run-prod-sql-via-ssm.sh`
- Status: current as of 2026-04-20
- Notes: durable outcomes from this thread: the original `Request Changes` note failure in Step 13 of the NWAC assessment wizard was traced to server-side note insertion hanging off the case update as a best-effort side effect and later to an invalid/unverified `author_user_id` path that could fail silently. The fix moved request-changes case-note creation into the main `PUT /api/cases/:id` transaction, used a verified existing user ID or `NULL` for the note author, emitted the normal `note_added` event, and refreshed Notes and Timeline immediately from `CoordinatorAssessmentWidget.js` after a successful push-back. TEST data confirmed the original failure on case `108` / application reference `MI-MO75M26T-860BFF`: the review status and request-changes text were saved while `iset_case_note` stayed empty until the fix was redeployed and the action was repeated. The same thread then fixed assessment submission so existing uploaded `Application form` and `Financial overview` scans are detected before submit and staff can keep those uploads instead of letting system-generated PDFs overwrite them. Assessment PDF comparison behavior was also corrected: version `v1` must render cleanly with plain black text only, while later redline PDFs now compare against the immediately previous submitted assessment snapshot and render changed text fields with the prior value in red strikethrough above the new green value. Signature resolution for submitted and approved assessment PDFs was traced to a code issue, not missing TEST staff profiles for Amanda Curtis: the PDF logic was reading legacy `iset_case_event` rows while current assessment events were stored in `iset_event_entry`, and newer event payloads could still carry auth-email fallback values. The durable fix was to resolve signatures from `iset_event_entry` first with fallback to legacy case-event rows, and to prefer resolved PATH staff display names over raw auth email when generating both submitted and approved assessment PDFs. That same root cause explained approved assessment PDFs showing `Not signed` despite signed timestamps. A related CFA issue in the same thread showed that funding-agreement signer prefill could drift to the staff member who generated or resent the document, such as Shelley Stacey during training, instead of the case's assigned case manager. The durable fix was to resolve the assigned case manager first, persist that signer name into the CFA version snapshot when the version is created, and prefer the stored snapshot signer on later rerenders and secure-message send flows so the signer does not drift. A data-check mistake in the thread is also worth preserving: Katrina Rae Woodgate's TEST case is `MI-MNT3JPF0-5BFEF1` and was correctly assigned to Amanda Curtis, while the earlier `program.admin@awentech.ca` assignment belonged to a different TEST case (`MI-MO75M26T-860BFF`), so there was no deeper Application Overview assignment-display bug on Katrina's file. For signature-display testing, the thread also updated `staff_profiles.name` and `staff_profiles.display_name` in both TEST and DEV so `program.admin@awentech.ca` reads `Program Admin` and `bill@sillery.co.uk` reads `Bill Sillery`. Operationally, this thread produced multiple deploy records: the assessment and signature fixes were first rolled to TEST in several incremental releases, then the CFA signer fix was deployed to TEST as `20260420-test-cfa-signature-fixes-114806`, and finally the same morning's TEST-validated admin release candidate was promoted to PROD with an admin-only 10-minute warning as `20260420-prod-admin-assessment-cfa-fixes`. A durable deployment-process correction also came out of this thread: PATH maintenance announcements already support `--surfaces admin|portal|all`, so admin-only hotfixes should use scoped admin warnings rather than unnecessary global portal banners; the prod deployment runbooks now document that behavior explicitly, along with the need to inspect both `git diff --cached --name-only` and `git status --short` before prod because app deploys package the working tree, not just staged files.

### Environment parity check, PROD feedback triage, and consent-step bug analysis

- Codex task title: `Check DEV/TEST/PROD parity`
- Topic: verifying DEV/TEST/PROD codebase and schema alignment, triaging the live PROD bug/CR queue, and tracing the public-portal consent-step defect where Coralee's application submitted without the main consent signature
- Keywords: `Check DEV/TEST/PROD parity`, `DEV TEST PROD parity`, `same codebase`, `same schema`, `CoordinatorAssessmentWidget`, `bug triage`, `change request triage`, `admin_feedback_report`, `Build Next`, `Client submitted without signing main Consent`, `Coralee`, `case 101`, `application 19`, `submission 19`, `consent blank`, `resume draft`, `save and finish later`, `input_json_state`, `should not have been possible`, `don't know`, `Assignment email notification`, `case_assigned`, `case_reassigned`, `Manage Notifications`, `notification_setting`, `notification_template`, `watchers`, `ISET Coordinator`, `spam`, `reply-to`, `sender name`, `noreply@nwac.ca`, `deliverability`
- When to open: the user references the parity-check thread, asks whether DEV/TEST/PROD were on the same code and schema, asks which PROD bug/CR items were prioritized next, asks about the queue review that marked `#35`, `#42`, `#31`, and `#26` as build-next items, asks how Coralee submitted with blank consent, asks whether that bug was proven or still partly unknown, asks what note was written back to PROD bug `#35`, or asks whether assignment/reassignment emails were ever fully wired from the Manage Notifications configuration
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/features/admin-feedback-reporting.md`
  - `docs/dashboards/manage-notifications-dashboard.md`
  - `docs/meta/changelog.md`
  - `scripts/run-prod-sql-via-ssm.sh`
  - `../ISET-intake/src/pages/DynamicTest.js`
  - `../ISET-intake/src/renderer/renderers.js`
  - `../ISET-intake/src/pages/userDashboard.js`
  - `../ISET-intake/server.js`
  - `../shared/events/notificationDispatcher.js`
  - `../ISET-intake/notifications/templateRenderer.js`
  - `../ISET-intake/sesMailer.js`
- Status: current as of 2026-04-19
- Notes: durable outcomes from this thread: DEV, TEST, and PROD were confirmed schema-aligned against the canonical shared migrations, while TEST and PROD were code-aligned with each other and local DEV had at least one extra un-deployed change in `src/widgets/CoordinatorAssessmentWidget.js`. The live PROD bug/change-request queue was then reviewed and updated in-place, with internal notes and status changes written to `admin_feedback_report`, `admin_feedback_status_history`, and `admin_feedback_note`; the resulting implementation-priority set was `#35 Client submitted without signing main Consent`, `#42 Deny funding button`, `#31 Supporting Documents columns reorder and sorting`, and `#26 Assignment email notification`. For report `#35`, live PROD data confirmed that case `101` / application `19` / submission `19` was submitted from the public portal with `consent = ""` while other signature fields, including `indigenous_declaration`, were populated. The published workflow schema and the submission's own schema snapshot both still required the consent `signature-ack`, so this was not a missing-schema/publish problem. Event history proved Coralee used `save and finish later` / resume across multiple sessions, and the portal code showed that draft resume can reopen the wizard directly on the saved `stepCursor` while `/api/intake/complete` trusts the aggregate draft payload without re-validating all required steps server-side. However, the exact click path by which she first moved past the Consent step with blank consent could not be reconstructed from retained data because transient pre-submit state was cleared on submission. The durable conclusion for future chats is: this is a real defect, not a mere display issue, but the precise path remains unknown; the correct phrasing is that the application reached `submitted` with blank consent and that should not have been possible. A follow-up internal note stating exactly that uncertainty was written directly into PROD bug `#35`. Later in the same thread, `#42` was implemented in DEV by moving the existing `Deny Funding` shortcut from the earlier eligibility step to `What is being proposed?`, `#31` was closed as already done, and `#26` was traced to a real backend gap: the Manage Notifications matrix and template library were live, but assignment/reassignment events only created bell notifications and never sent email. The DEV fix first wired `case_assigned` and `case_reassigned` through the shared notification configuration, configured the admin runtime to honor the shared SES sender-email setting, and sent the configured template email to the actual assignee using that staff member's role row plus any case watchers using the `ISET Coordinator` row for the same event. A later follow-up in the same thread completed the semantic split Bill asked for: `auto_assigned` is now its own configurable email event sent from the portal/system auto-assignment path, `case_assigned` remains manual first assignment, and `case_reassigned` remains manual reassignment. The duplicate-risk detail that mattered was the portal's two-stage auto-assignment event emission; the durable fix suppresses email on the pre-case `auto_assigned` capture and only sends on the real case-bound event, so an auto-assignment workflow results in one configurable email event rather than two. A later design clarification from Bill in this thread is durable: watchers should receive assignment/reassignment emails, but that does not change the general rule that watchers are simply treated as `ISET Coordinators` on the watched file rather than a separate special-case audience. The same thread also produced an operational TEST deploy rule after the 2026-04-18 rollout: some apparently admin-only changes are actually coupled releases because the admin backend resolves sibling `../shared` code staged with the admin artifact and sibling `../ISET-intake/*` modules from the deployed portal tree. For those paths, use a full `admin + portal` TEST rollout rather than the `--skip-portal` shortcut, and rely on the quick guide / TEST notes that now document that coupling explicitly. A later follow-up under the same recovery topic pinned down PROD bug `#23 Proposal in progress`: case `40` really did have a draft proposal (`iset_case_intervention` `#10`) on action plan `#5`, while the case workspace auto-selected the most recent action plan on load (`#6`). That let the workspace show a case-wide `Proposal in progress` warning while the visible interventions table belonged to the wrong plan and did not show the draft row the user was meant to resume. The durable fix in DEV was to prefer the action plan that owns the latest open proposal when the case workspace loads, and to add a direct jump from the warning banner back to the blocking draft proposal. That fix and the deliverability hardening work were then deployed as coupled `admin + portal` code-only rollouts to TEST and PROD on 2026-04-19 (`20260419-test-dev-outstanding`, `20260419-prod-dev-outstanding`) with short maintenance warnings rather than a hard `503` page, and both environment smokes passed. The corresponding live PROD feedback-log outcome from that end-of-day deployment is also durable: report `#23 Proposal in progress` was moved from `in_progress` to `resolved`, while report `#32 Applicant notification emails often treated as spam` stayed `in_progress` because PROD SES/domain authentication for `nwac.ca` was already broadly healthy (SES verified identity, Easy DKIM enabled, SPF present, DMARC `p=reject`, no VDM recommendations) and the deployed sender-presentation improvements still need real-world monitoring. The deliverability code change itself extended the shared `notifications/path.email` runtime payload from `senderEmail` only to `senderEmail + senderName + replyTo`, exposed those fields in Manage Notifications, and applied them consistently in both the notification mailer and the applicant-account invitation mailer, with safe fallbacks (`NWAC PATH` display name and support-mailbox env fallback for `Reply-To`) when admins leave fields blank.

### WSL repo relocation, finance-semantics rollout, and case-header funding fix

- Codex task title: `Avoid Git on Windows drives`
- Topic: moving active admin-dashboard work off `/mnt/x`, WSL-native local dev startup, later-superseded deploy-checkout notes, re-aligning PATH case-funding semantics to `Approved` / `Committed` / `Actual`, correcting the one prod decimal-shift finance record, and fixing the case-header overall-approved fallback bug
- Keywords: `Avoid Git on Windows drives`, `WSL warning`, `/mnt/x`, `/root/ISET/admin-dashboard`, `/home/bill/ISET/path-dev-wsl.code-workspace`, `/home/bill/ISET/admin-dashboard`, `/home/bill/ISET/ISET-intake`, `/home/bill/ISET/shared`, `/home/bill/ISET/intacct-mock-service`, `dev:all`, `Open the DEV Environment`, `Sage Intacct mock`, `WSL local development`, `deploy-checkout note superseded`, `Approved Committed Actual`, `funds approved`, `case header funding`, `Overall $0 approved`, `ISET-20260408-509365`, `CASE-2026-0000070`, `decimal point`, `divide by 100`, `budget pot recalc`
- When to open: the user references the `Avoid Git on Windows drives` thread, asks why WSL warns against running Git-heavy work on Windows-mounted drives, asks where the active repo should live versus where deploys should be launched, asks how to start the WSL local dev environment, asks what `Approved`, `Committed`, and `Actual` now mean in PATH, asks why a case header showed `Overall $0.00 approved` while the selected action plan showed approved funding, or asks which prod record was manually corrected for the decimal-shift finance bug
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/guides/wsl-local-development.md`
  - `docs/ops/deployments/deployment-quick-guide.md`
  - `docs/ops/deployments/deploy-test-notes.md`
  - `docs/ops/deployments/prod-deployment-guide.md`
  - `docs/dashboards/admin-home-metrics-widget.md`
  - `docs/widgets/admin/case-header-widget.md`
  - `docs/widgets/admin/case-finance-panel-widget.md`
  - `docs/meta/changelog.md`
- Status: current as of 2026-05-08
- Notes: durable outcomes from this thread: the WSL warning was valid for this repo because `X:\ISET\admin-dashboard` appeared in WSL as `/mnt/x/ISET/admin-dashboard`, so active coding/Git work was moved into the Linux filesystem. The current WSL2 Ubuntu workspace is `/home/bill/ISET/path-dev-wsl.code-workspace`, containing `admin-dashboard`, `ISET-intake`, `shared`, and `intacct-mock-service`; open that workspace in VS Code and run task `dev:all` for the full local stack. "Open the DEV Environment" should start admin, public portal, MinIO, and the Sage Intacct mock service. An earlier memory note named `/root/ISET/admin-dashboard`; treat that as superseded. The same thread's claim that TEST/PROD deploys should keep using the Windows checkout was superseded on 2026-05-07 and 2026-05-08: TEST and PROD deploys now package the WSL working tree through `scripts/path-deploy.js`; PROD WSL app deploy was validated in release `20260507-prod-contact-retirement`. The finance model was then clarified and implemented as: `Approved` = intervention funding approved in PATH, `Committed` = PATH finance transactions submitted to finance, and `Actual` = PATH-recorded paid spend. Homepage metrics, Case Workspace funding summaries, finance widgets, and budget-pot rollups were updated to use that model, and TEST `budget_pot` committed/actual rollups were backfilled after deploy so older totals matched the new meaning immediately. Manual backloads remain history-only and should contribute to `Actual`, not to new approval or commitment. The same thread also repaired one production data defect on `CASE-2026-0000070`: intervention `#5` and linked finance transaction `#1` had `1,394,862.00` stored instead of the obvious divide-by-100 value `13,948.62`, so the intervention actual, finance transaction amount/metadata, and affected pot `actual_amount` rollups were corrected in prod. A later pass uncovered a UI-only bug on TEST case `ISET-20260408-509365`, where the selected action plan line correctly showed `$6,500.00 approved` but the overall case-header line incorrectly showed `$0.00 approved`; that fallback bug was fixed in `CaseHeaderWidget.jsx`, verified in TEST, and then deployed to PROD in release `20260414-prod-approved-committed-actual-header-fix`. The thread also established an operational rule for this repo: normal rolling admin-only releases like this one do not require a maintenance banner unless user-visible downtime is expected; the final TEST and PROD rollouts were verified with instance health / `/healthz` smoke checks.

### Digital forms parity, workflow-21 publish alignment, and late-thread admin/prod follow-ups

- Codex task title: `Investigate edit digital forms`
- Topic: aligning the admin digital-forms editor suite with the published public-intake runtime, verifying DEV workflow-21 authoring/runtime parity, and the later same-thread admin-console, PROD case-access, and feedback-log follow-up work
- Keywords: `Investigate edit digital forms`, `Investigate digital forms`, `digital forms`, `intake editor parity`, `workflow preview parity`, `manual intake parity`, `workflow 21`, `step library`, `workflow library`, `workflow.schema.intake`, `buildWorkflowSchema`, `Step 19`, `containsAny`, `containsAll`, `Approvals below All Cases`, `NWAC Administrator status selector`, `Amanda Curtis`, `Failed to load case`, `/cases/50`, `/cases/90`, `regional manager direct assignment`, `case 88 BC`, `prod bug log`, `secure-message form picker`, `EI Consent Form`, `Indigenous Declaration`, `Conflict of Interest Form`, `missing prod workflows`
- When to open: the user references the `Investigate edit digital forms` thread, asks whether the step library/workflow library still drift from the published intake, asks how the intake step editor / Workflow Preview / Manual Intake were brought back in line with the public portal runtime, asks about the remaining caveats for those admin paths, remembers the later same-thread changes that moved `Approvals` under the case queue or extended the Application Overview status selector to NWAC Administrators, asks why Amanda Curtis got `Failed to load case` on `/cases/50` or `/cases/90`, asks why PROD was missing `EI Consent Form`, `Indigenous Declaration`, or `Conflict of Interest Form` in the secure-message form picker, or asks what later PROD follow-up work was handled under the same task-history item
- Primary docs:
  - `docs/planning/step19-checkbox-conditionality-followup.md`
  - `docs/features/file-uploads/conditional-visibility-authoring.md`
  - `docs/guides/workflow-studio.md`
  - `docs/dashboards/admin-home-my-work-widget.md`
  - `docs/dashboards/application-assessment-dashboard.md`
  - `docs/workflows/admin/case-management.md`
  - `docs/features/admin-feedback-reporting.md`
  - `docs/AGENTS.md`
- Status: current as of 2026-04-18
- Notes: durable outcomes from this thread: the admin intake-step editor, validation path, Workflow Preview, and Manual Intake now share the runtime-backed conditional-visibility operator set used by the public portal for renderable manual-intake content, including checkbox-array operators (`contains`, `notContains`, `containsAny`, `notContainsAny`, `containsAll`) and whole-step skipping when authored content becomes fully hidden. Workflow Preview and Manual Intake now also clear hidden answers so stale conditional data does not survive backtracking. DEV workflow `21` authoring rows were compared directly against `iset_runtime_config(scope='publish', k='workflow.schema.intake')`, and `buildWorkflowSchema` / `scripts/publish-workflow.js` now reproduce the same published payload apart from normal timestamp/checksum refresh, so the step library, workflow library, and published runtime row are back in sync in DEV. Remaining caveat: Manual Intake still intentionally skips portal-only upload/signature steps, so parity claims there apply only to renderable manual-intake content. Later in the same thread, the homepage `Work Queue` was reordered so `Approvals` appears directly below `All Cases` / `Clients in My Region` for `NWAC Administrator` and `Regional Manager`, and the `Application Overview` manual status selector was extended to `NWAC Administrator` users. The same task later covered a PROD Regional Manager access defect where directly assigned out-of-region case-workspace files still failed with `Failed to load case`; that fix was deployed to PROD in release `20260414-190101`, after which Amanda Curtis reports `#20` (`/cases/90`) and `#21` (`/cases/50`) were marked resolved in the live PROD feedback tables. The same PROD pass also corrected the internally inconsistent BC/NS data on case `88` / application `6` / client `97`. A later follow-up on 2026-04-18 confirmed another PROD data-migration miss under the same task: the secure-message form picker in PROD was missing workflow rows `49` (`EI Consent Form`), `50` (`Indigenous Declaration`), and `51` (`Conflict of Interest Form`) even though DEV had them and the underlying PROD steps (`76`, `77`, `126`) already existed. The durable fix was a minimal PROD data correction that inserted only those three `iset_intake.workflow` rows plus their `workflow_step` links, recorded in `sql/ops/prod-add-missing-secure-message-form-workflows.sql`. Durable process updates captured from this thread: Codex should keep the live PROD feedback log (`admin_feedback_report`, `admin_feedback_status_history`, `admin_feedback_note`) current when PROD bugs/CRs are investigated or resolved, and short hotfix notes should use neutral outcome-first bullets such as `Fixed a bug...` / `Made a change...` without naming the underlying report or reporter.

### PROD X bug and change-request triage, hotfix rollout, and feedback-log closure

- Codex task title: `Triage PROD X bugs and CRs`
- Topic: production triage and closure of the April 14 PROD X feedback reports, including the Step 6 cost-item fix, the applicant secure-message reply fix, the two-decimal currency display fix, hotfix deployment guidance, and final PROD feedback-log status updates
- Keywords: `Triage PROD X bugs and CRs`, `PROD X`, `prod bug log`, `admin_feedback_report`, `What will it cost step 6`, `Client cannot respond`, `Dollar values`, `Trouble uploading files`, `Approval/Denial`, `Wabanang Polson`, `wabapolson@gmail.com`, `wpolson978@my.nipissingu.ca`, `recipient_not_allowed`, `payment-intervention-type-map`, `hotfix-20260414-bugfixes`, `hotfix-20260414-bugfixes-prod`, `Amanda Curtis`, `Failed to load case`, `/cases/50`, `/cases/90`, `regional manager direct assignment`, `no banner`, `10 MB upload cap`
- When to open: the user references the PROD X bug/CR triage thread, asks which April 2026 PROD feedback reports were confirmed and fixed, asks what was deployed in the `hotfix-20260414-bugfixes` or `hotfix-20260414-bugfixes-prod` releases, asks whether the applicant reply issue for Wabanang Polson was the same case Codex fixed, asks why Step 6 `Add cost item` was disabled for some staff, asks about the one-decimal dollar-display bug, asks why Amanda Curtis got `Failed to load case` on `/cases/50` or `/cases/90`, or asks what final notes/statuses were written back to the PROD feedback log for the April 2026 reports
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/features/admin-feedback-reporting.md`
  - `docs/ops/deployments/prod-deployment-guide.md`
  - `docs/ops/environments/prod-env-guide.md`
  - `docs/ops/deployments/path-deploy-orchestrator.md`
  - `scripts/run-prod-sql-via-ssm.sh`
- Status: current as of 2026-04-14
- Notes: durable outcomes from this thread: PROD feedback reports `#13` through `#18` were reviewed against live prod data and code. Confirmed software defects were `#13` (case-workspace Step 6 `Add cost item` falsely disabled because `InterventionAssessmentWidget` fetched the finance-only `/api/config/runtime/payment-type-mapping` endpoint instead of a broader-read payment mapping source), `#15` / `#16` (application-form dollar values could render with one decimal because `IsetApplicationFormWidget` used a formatter with `minimumFractionDigits: 0`), and `#18` (applicant replies to an existing secure-message thread could fail with `recipient_not_allowed` after case reassignment because portal reply targeting was tied to the current assignee rather than the original same-case thread counterpart). `#14` was confirmed as a real change request but not a hotfix candidate because approval/denial reversal needs its own audit-safe design. `#17` was not fixed in code by Codex; the later resolution was based on a manual increase of the upload cap to `10 MB`, and that manual cap change should not be described as part of the Codex hotfix. The applicant tied to case `84` was confirmed from PROD as Wabanang Polson, with current portal account email `wabapolson@gmail.com`; if staff mention `wpolson978@my.nipissingu.ca`, treat that as a possible alternate contact rather than the PATH login on file. The code hotfixes were deployed app-only to TEST as release `hotfix-20260414-bugfixes` and to PROD as release `hotfix-20260414-bugfixes-prod`, with no schema or data changes required for those fixes. Later the same day, Amanda Curtis reports `#20` (`/cases/90`) and `#21` (`/cases/50`) were confirmed as the same Regional Manager case-workspace access defect class in a different route family: directly assigned out-of-region files were still blocked because the workspace guard honored only region scope, not direct assignment. That fix was deployed in PROD release `20260414-190101`, after which both reports were marked resolved in the live PROD feedback tables. The agreed PROD operator guidance for these rolling hotfix rollouts was `no banner`, `no ALB maintenance fallback`, and user impact framed as near-zero-downtime deployment; during the earlier `hotfix-20260414-bugfixes-prod` refresh there was a brief transient `502` while the replacement instance finished bootstrap and ALB health thresholds, but the release completed successfully with public health `200` on `https://nwac-console.awentech.ca/healthz`, `https://iset.nwac.ca/healthz`, and `https://nwac-public.awentech.ca/healthz`. Final PROD feedback-log outcomes captured from this thread family were: `#13 resolved`, `#14 triaging`, `#15 resolved`, `#16 closed` as duplicate of `#15`, `#17 resolved` on the basis of the manual `10 MB` upload-cap increase, `#18 resolved`, `#20 resolved`, and `#21 resolved`, with matching internal notes and status-history rows written directly into the PROD `admin_feedback_note`, `admin_feedback_status_history`, and `admin_feedback_report` tables.

### Application timing targets and EI status verification stage

- Codex task title: `Add EI status SLA target`
- Topic: add the configurable `EI Status Verification` application timing stage between Assignment and Assessment, route all due/overdue displays through the shared stage helper, and relabel staff-facing `SLA` wording to plainer `workflow timing` / `timeline` language
- Keywords: `Add EI status SLA target`, `EI Status Verification`, `workflow timing targets`, `timeline status`, `timeline target`, `due overdue`, `assessment_esdc_eligibility`, `applicationSla.js`, `sla_stage_target`, `missing stage in widget`, `path:maintenance`, `path:maintenance:fallback`
- When to open: the user asks where the EI status timing stage was added, wants to change application due/overdue behavior, asks why `Awaiting EI Validation` or `EI Status Verification` is or is not appearing in queues/widgets, asks why the configuration widget is missing the EI row in DEV, or asks why the timing clock is still based on submission rather than assignment
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/dashboards/configuration-sla-widget.md`
  - `docs/dashboards/application-assessment-dashboard.md`
  - `docs/guides/status-lifecycle-implementation.md`
  - `db/migrations/20260411_0001_add_ei_status_verification_sla_stage.sql`
- Status: current as of 2026-04-11
- Notes: durable outcomes from this thread: application due/overdue routing now derives the active stage from application status, assignment state, and `assessment_esdc_eligibility`, using `Assignment -> EI Status Verification -> Assessment -> Program decision`; the shared frontend source of truth is `src/utils/applicationSla.js` and the backend helper pair is `getApplicationSlaStageKey()` / `computeApplicationSlaTiming()` in `isetadminserver.js`; the staff-facing UI now prefers `Workflow timing targets`, `Timeline status`, and `Timeline target` while internal config/storage names remain `sla_*`; current timing is still anchored to application submission/creation time rather than a true stage-start timestamp, so a genuine “3 days from assignment” model would require schema/event work; and the configuration page now merges DB-returned rows with placeholder stages so `EI Status Verification` still appears in the widget even if DEV is missing the seeded `sla_stage_target` row. Later in the same thread, the new maintenance operator flow was exercised and deployed alongside this work: `scripts/path-maintenance-fallback.js` can now switch TEST/PROD ALB host rules to a fixed HTML `503` maintenance page for hard cutovers; release `20260411-test-maintenance-ei-sla` verified the warning-banner behavior in TEST while both target groups stayed healthy; and release `20260411-prod-ei-sla-maintenance` successfully deployed both the EI-status timing changes and the maintenance banner feature to PROD, after which `npm run path:deploy:smoke -- --env prod` returned `200` for `https://nwac-console.awentech.ca/healthz`, `https://iset.nwac.ca/healthz`, and `https://nwac-public.awentech.ca/healthz`. Durable prod caveat from that deploy: PROD did not have the in-app maintenance warning before release `20260411-prod-ei-sla-maintenance`, so that rollout could not show the countdown banner in advance, but future prod deploys can now use `path:maintenance` beforehand.

### PATH hosting requirements and scope framing

- Codex task title: `Clarify PATH hosting requirements`
- Topic: concise, business-facing wording for PATH hosting requirements plus slide framing for core scope, transition/business-change scope, integrations, configuration/customization, security/access, and support placement
- Keywords: `Clarify PATH hosting requirements`, `PATH hosting requirements`, `AWS hosting`, `move off AWS`, `on prem`, `core scope`, `supporting scope`, `business change scope`, `transition scope`, `integrations bullet`, `configuration and customization bullet`, `security and access bullet`
- When to open: the user asks whether PATH requires AWS-hosted servers, wants short slide-ready wording about hosting or AWS portability, asks what belongs under core-vs-supporting/transition scope, or asks where support belongs in the scope framing
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/ops/environments/prod-env-guide.md`
  - `docs/ops/deployments/deployment-quick-guide.md`
  - `docs/ops/deployments/path-deploy-orchestrator.md`
- Status: current as of 2026-04-08
- Notes: durable conclusions from this thread: PATH requires an application server, a MySQL-compatible database, and supporting services for authentication/file storage, but it does not inherently require AWS-hosted compute. The current implementation is AWS-centric and presently uses EC2-hosted app servers, Aurora MySQL, Cognito, S3-style object storage/presigned URLs, SES, and AWS ops tooling; however, compute/database could move off AWS while still using AWS services. A full move away from AWS would require replacing AWS-based authentication, storage, email, and operations/deployment dependencies. For slide framing, the recommended split was `Core Scope` (`PATH solution`, `Hosting and infrastructure`, `Integrations`, `Configuration and customization`, `Security and access`) versus a second slide framed as `Transition Scope` (or similar) covering `Data and migration`, `Governance and decision-making`, `Training and readiness`, `Support and operations`, and `Testing and cutover`. Support belongs with transition/operational readiness, not with core product scope.

### Mixed backload/admin follow-up thread

- Codex task title: `Write training scripts`
- Topic: mixed thread that started with the `PATH Training Shorts - Backloading Interventions` script and later covered case-workspace backload fixes, admin-user account-management fixes, and imported-case document-mode debugging
- Keywords: `Write training scripts`, `Backloading Interventions`, `add existing intervention`, `add existing action plan`, `upload existing documents`, `create_intervention_failed`, `currency helper`, `resend invite`, `application-less documents`
- When to open: the user references the misleading `Write training scripts` chat title, asks for the thread where the backloading-interventions training script was written, or remembers a single mixed thread that also fixed the existing-intervention modal, `Administrative Users`, and imported-case document uploads
- Primary docs:
  - `docs/guides/client-file-imports.md`
  - `docs/features/user-management.md`
  - `docs/widgets/admin/supporting-documents-widget.md`
  - `docs/AGENTS.md`
- Status: current as of 2026-04-07
- Notes: this thread began with the training-video script for the Case Workspace backload quick actions `Add existing action plan`, `Add existing intervention`, and `Upload existing documents`. The same thread later produced durable notes now indexed separately under `Cloudscape currency input helper`, `Administrative user resend-invite and role-scoped management`, and `Application-less case documents with linked PATH accounts`. It also included two implementation fixes that are useful search anchors even though they do not have their own standalone index entries: the `create_intervention_failed` SQL placeholder mismatch in `POST /api/action-plans/:id/interventions`, and the System Administrator homepage config-activity query that hit MySQL `Out of sort memory` when sorting the large published intake JSON row. A later pass in the same thread also aligned the Case Workspace help panels and embedded AI chat context so staff asking about imported/application-less backloads get guidance on the quick actions, silent historical behavior, intervention guardrails, and historic-document handling. The closing SES question in this thread was only a thread-index lookup; the actual SES setup work lives under `Prod intake sync and deploy recovery`.

### Administrative user resend-invite and role-scoped management

- Codex task title: `exact original task title not preserved`
- Topic: real Cognito resend-invite behavior plus server-side role resolution and role-scoped visibility for `Manage Users > Administrative Users`
- Keywords: `resend invite`, `Administrative Users`, `Cognito RESEND`, `FORCE_CHANGE_PASSWORD`, `admin users placeholder`, `role-scoped user list`, `ListGroupsForUser`, `force reset vs resend invite`
- When to open: the user asks whether `Resend invite` works, reports that admin-user actions seem to allow or block the wrong roles, asks why a Regional Manager only sees ISET Coordinators in Administrative Users, or asks which action to use for pending-vs-active staff accounts
- Primary docs:
  - `docs/features/user-management.md`
  - `docs/guides/test-staff-cognito-recovery.md`
  - `src/routes/admin/users.js`
- Status: current as of 2026-04-07
- Notes: durable outcomes from this thread: `Resend invite` is no longer a stub and now uses Cognito `AdminCreateUser` with `MessageAction: RESEND` for staff accounts still in `FORCE_CHANGE_PASSWORD`; `Force reset` is for active accounts instead. Administrative-user routes now resolve the target user's actual admin group with `ListGroupsForUser` before authorizing disable, enable, region updates, role changes, role removal, resend invite, and force-reset actions, so the backend no longer trusts `role` or `currentRole` from the browser. The Administrative Users list is now scoped to the roles the actor is allowed to manage, which means Regional Managers see only ISET Coordinators in that dashboard.

### PROD user-management regressions, region-model cleanup, TEST/PROD rollout, and Sillery cleanup

- Codex task title: `Find PROD AWS CLI access`
- Topic: prod AWS access path from the sandbox, diagnosis of production bug report `#2` for admin-user management, the later IAM and region-model follow-up fixes, TEST/PROD rollout of the DB-backed staff-region fix, and the one-off prod purge of Jackie/William Sillery test applicant data
- Keywords: `Find PROD AWS CLI access`, `nwac-prod`, `run-prod-sql-via-ssm.sh`, `Administrative Users`, `bug #2`, `ListGroupsForUserCommand is not a constructor`, `AdminListGroupsForUserCommand`, `AdminGetUser`, `custom:region_id`, `Attribute does not exist in the schema`, `staff_profiles`, `staff_region`, `nwac-prod-app-role`, `nwac-test-app-role`, `lkuzma@nwac.ca`, `resend invite`, `region update failed`, `20260409-user-mgmt-fix`, `20260410-user-mgmt-region-db-fix-prod`, `Sillery`, `Jackie Sillery`, `William Sillery`, `prod bug log`
- When to open: the user asks how prod AWS/DB access works from Codex, references the chat that diagnosed the prod admin-user 500s, asks whether the user-management fix already went to TEST or PROD, asks why region edit or resend invite failed in prod after the first fix, asks whether admin-user regions still rely on Cognito `custom:region_id`, or asks about the prod cleanup that removed the Sillery test records from dashboard counts
- Primary docs:
  - `docs/ops/environments/prod-env-guide.md`
  - `docs/ops/deployments/prod-deployment-guide.md`
  - `docs/ops/deployments/deploy-test-notes.md`
  - `docs/features/user-management.md`
  - `docs/assignment/staff-profiles.md`
  - `scripts/run-prod-sql-via-ssm.sh`
  - `scripts/deploy-admin-test.ps1`
- Status: current as of 2026-04-10
- Notes: durable outcomes from this thread: sandbox prod access works through AWS CLI profile `nwac-prod` in account `468278742295` / region `ca-central-1`, and prod SQL access is through `scripts/run-prod-sql-via-ssm.sh` against the live admin instance discovered from `nwac-prod-asg`. The first critical prod user-management failure reported in bug `#2` was confirmed as a newly deployed backend regression: the code imported `ListGroupsForUserCommand`, but the installed AWS SDK only exports `AdminListGroupsForUserCommand`, which caused target-user admin actions such as disable and region edit to fail at runtime with `ListGroupsForUserCommand is not a constructor`. The same thread also confirmed a separate disabled-state logic bug where Cognito `Enabled=false` users like `lkuzma@nwac.ca` could still show `UserStatus=FORCE_CHANGE_PASSWORD`; the API/UI fix now normalizes those rows to `DISABLED`. The initial code fix set was deployed to TEST as release `20260409-user-mgmt-fix`, with both TEST admin instances updated successfully and the admin target group healthy. A later follow-up in the same thread found two more durable causes behind prod user-management failures: the prod and test EC2 app roles needed `cognito-idp:AdminListGroupsForUser` and `cognito-idp:AdminGetUser`, and the admin-user region update path was still writing legacy Cognito staff attributes such as `custom:region_id` even though staff region access had moved to `staff_profiles` plus `staff_region`. The lasting code fix was to make admin-user region creation/editing DB-backed, treat the DB as the source of truth for staff region context, stop relying on Cognito custom region/user-id staff attributes in admin user-management flows, and leave the pre-token lambda as role-hint-only. TEST on 2026-04-10 required a live IAM hotfix on `nwac-test-app-role`, but no test pre-token lambda deployment because the test admin pool had no trigger attached; the updated admin app then rolled out successfully to both TEST instances. PROD on 2026-04-10 required a matching live IAM hotfix earlier in the thread and then an admin artifact upload plus waited ASG refresh `62380380-c2e8-4162-8056-6ab02c29b2e3`, which completed successfully onto replacement instance `i-0ff0c60b562c7cf2a` with public/admin health checks returning `{"status":"ok"}`. One operator gotcha from the same rollout: the Windows-side prod AWS CLI path returned `InvalidClientTokenId` during artifact upload, while the trusted WSL `nwac-prod` CLI path worked, so in this sandbox the WSL-side AWS CLI remains the safer prod control path. The prod bug log on 2026-04-09 contained four submitted reports, with report `#2` (`Administrative Users`) being the confirmed software defect and reports `#3` and `#4` being dashboard/reporting skew caused by Sillery test data in prod. A later prod hotfix in the same thread purged Jackie Sillery's full applicant/application/case footprint and William Sillery's imported client/case footprint from prod, while deliberately leaving Bill Sillery's real prod System Administrator staff account intact. A prod Aurora restore point was started first as snapshot `nwac-prod-pre-sillery-purge-20260409-144152`.

### Sandbox prod identity mapping, reduced prod operator role, and feedback-queue count

- Codex task title: `Read this for en try point...`
- Topic: verifying how AWS credentials are stored and resolved inside the WSL sandbox, replacing the broad direct-prod profile with a reduced assumed-role path, expanding that role until it covered the full repo-driven prod deploy/migration workflow, and validating it with live prod checks
- Keywords: `Read this for en try point...`, `AWS_PROFILE`, `default profile`, `nwac-prod`, `nwac-prod-automation`, `nwac-prod-codex-operator`, `AssumeRole`, `bootstrap identity`, `path-maintenance-fallback`, `run-db-dump-via-ssm`, `AdministratorAccess`, `admin_feedback_report`, `open bugs CRs`
- When to open: the user asks where the sandbox AWS credentials live, asks whether `default` is prod, asks how to harden prod access without recreating an identity each time, asks whether there is already a reduced prod operator role/profile for Codex, asks whether that role was actually tested against prod, or references the thread where Codex counted live open bug/change-request items through the safer role
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/ops/deployments/prod-deployment-guide.md`
  - `docs/ops/deployments/path-deploy-orchestrator.md`
  - `docs/ops/deployments/deployment-quick-guide.md`
  - `docs/ops/environments/prod-env-guide.md`
  - `docs/ops/runbooks/prod-portal-hostname-cutover.md`
  - `scripts/path-deploy.js`
  - `scripts/run-prod-sql-via-ssm.sh`
  - `scripts/path-maintenance-fallback.js`
- Status: current as of 2026-04-20
- Notes: durable outcomes from this thread: in the Codex WSL sandbox, the AWS CLI reads from `/root/.aws`, and at the start of the thread both implicit `default` and explicit `nwac-prod` resolved to `arn:aws:iam::468278742295:user/nwac-prod-automation`. The agreed safer pattern was not to mint another long-lived IAM user, but to keep that user only as a bootstrap source and move repo-driven prod work onto a reduced role. The thread created IAM role `nwac-prod-codex-operator`, attached policy `arn:aws:iam::468278742295:policy/nwac-prod-codex-operator-policy`, and initially added local profile `nwac-prod-codex-operator` that assumes that role from `default`. The role scope was then widened to the full repo-driven prod deploy/migration boundary: artifact upload/delete in `nwac-prod-artifacts` under `admin/*`, `portal/*`, `shared/*`, `ssm-sql/*`, and `db-dumps/*`; the matching KMS key used by that bucket; prod SSM command execution needed by `scripts/run-prod-sql-via-ssm.sh`; prod Auto Scaling Group describe/start-refresh calls; prod Aurora restore-point snapshot create/describe calls; and ELBv2 permissions needed by `scripts/path-maintenance-fallback.js`. The same thread updated `scripts/run-db-dump-via-ssm.sh` to use `aws configure export-credentials`, so assumed-role profiles now work for prod DB dump uploads as well as SQL execution. Validation in this thread covered the real operator entry points: `aws sts get-caller-identity --profile nwac-prod-codex-operator`, `scripts/run-prod-sql-via-ssm.sh --profile nwac-prod-codex-operator` with `SELECT 1`, `scripts/path-maintenance-fallback.js status --env prod --profile nwac-prod-codex-operator`, `scripts/path-deploy.js plan/smoke --env prod --profile nwac-prod-codex-operator`, an actual Windows-side prod deploy-script artifact upload through `node.exe -> PowerShell -> aws.exe`, and explicit deny verification for direct `secretsmanager:GetSecretValue` on `nwac-prod-db-credentials`. The thread then completed the bootstrap cutover: local profile `nwac-prod` was repointed to the reduced role, inline user policy `AllowAssumeNwacProdCodexOperator` was added to `nwac-prod-automation`, and `AdministratorAccess` was removed from that user. After cutover, `aws sts get-caller-identity --profile nwac-prod`, `scripts/run-prod-sql-via-ssm.sh --profile nwac-prod`, and `scripts/path-deploy.js smoke --env prod --profile nwac-prod` all still succeeded, while direct `default` access to prod resources like `nwac-prod-artifacts` was denied by design. The same thread ended by updating the active prod operator docs/runbooks so they now describe `nwac-prod` as the standard reduced role-backed profile for normal deploy and DB work, record that hostname-cutover/WAF/SSM-parameter/Terraform tasks still need a separate elevated prod infra/admin role, and note that the prod DB dump helper now works with assumed-role credentials. As a live functional check through the reduced role earlier in the thread, the prod `admin_feedback_report` queue count was `12` open items at that moment: `6` bug reports and `6` change requests using statuses `submitted`, `triaging`, `planned`, and `in_progress`. Treat that queue count as time-sensitive and re-query rather than relying on the number later.

### Cloudscape currency input helper

- Codex task title: `exact original task title not preserved`
- Topic: shared currency-input display helper for Cloudscape `Input` fields
- Keywords: `currency helper`, `Cloudscape currency input`, `getCurrencyInputDisplayValue`, `currencyFormat.js`, `formatted amount input`, `money input formatting`
- When to open: the user asks why a money field is not formatting on blur, asks how PATH is supposed to handle currency entry in a Cloudscape `Input`, or asks whether there is already a shared helper for currency-input display
- Primary docs:
  - `docs/AGENTS.md`
  - `src/utils/currencyFormat.js`
- Status: current as of 2026-04-07
- Notes: durable rule from this thread: Cloudscape does not provide built-in currency formatting for `Input` components in this repo, so currency-entry fields should use the shared `getCurrencyInputDisplayValue` helper from `src/utils/currencyFormat.js` together with local focus/blur state. Keep the raw amount in component state while focused, and show formatted currency only for the blurred display state. Do not add ad hoc currency-formatting logic per screen.

### Application Assessment cost-item decimal-input bug trace

- Codex task title: `Trace reported bug`
- Topic: production bug trace for the Application Assessment `Add cost item` modal dropping typed decimal points in the `Total amount` field
- Keywords: `Trace reported bug`, `acurtis@nwac.ca`, `2026-04-10 1:48:03 p.m.`, `report #9`, `Dollar Amounts`, `/application-case/88`, `Add cost item`, `Total amount`, `period character`, `decimal point`, `1505.28`, `150280`, `sanitizeCurrencyInput`, `CoordinatorAssessmentWidget`
- When to open: the user references the acurtis bug report, says the `Add cost item` `Total amount` field will not accept a period/decimal, asks why entering `1505.28` turns into `150280`, or asks which production feedback report matched that behavior
- Primary docs:
  - `docs/planning/coordinator-assessment-costing-line-items-tracker.md`
  - `docs/widgets/admin/application-assessment-widget.md`
  - `docs/features/admin-feedback-reporting.md`
  - `src/widgets/CoordinatorAssessmentWidget.js`
- Status: current as of 2026-04-11
- Notes: production feedback report `#9` in `admin_feedback_report` was submitted by `acurtis@nwac.ca` at `2026-04-10 17:48:03` UTC (`2026-04-10 1:48:03 p.m.` Eastern) from `/application-case/88` with summary `Dollar Amounts`. The defect was reproduced in the `Add cost item` modal: while the controlled `Total amount` input was focused, `sanitizeCurrencyInput()` removed a trailing decimal on every keystroke, so typing `1505.` was immediately rewritten to `1505`, and continuing with `28` produced `150528`. The durable fix is to preserve a just-typed trailing decimal while editing and normalize the value on blur; the same rule now applies to the modal total amount, amount-per-period, and inline table amount editor in `CoordinatorAssessmentWidget.js`.

### Financial reports approved CRF/EI dashboard

- Codex task title: `Add CRF and EI reports`
- Topic: live Budgets and Finance financial-reporting surface for annual approved CRF/EI intervention funding, cleaned-up payment workflow semantics, and workbook-style Excel export
- Keywords: `Add CRF and EI reports`, `CRF EI reports`, `Budgets module reports`, `ISET Advances and Active Clients`, `Approved funding`, `Shelley workbook`, `province territory intervention report`, `finance reports export`, `intervention funding`, `carry over`, `budget committed`
- When to open: the user asks where the CRF/EI finance report lives, asks what the annual approved-funding view means, asks how payment status is shown on that page, asks why carry-over is only best-effort, asks how the Excel export and current filters are supposed to behave, or asks why budget-pot `Committed` does or does not move after intervention approval
- Primary docs:
  - `docs/dashboards/financial-reports-dashboard.md`
  - `docs/guides/payments-module-user-manual.md`
  - `docs/AGENTS.md`
- Status: current as of 2026-04-06
- Notes: durable outcomes from this thread: the route is `/finance/reports`; the page title is now `ISET Advances and Active Clients`; the finance-reporting demo/widget board was replaced by a fixed reporting page; the live report is now an annual approved-funding view based on `COALESCE(intervention.reviewed_at, intervention.created_at)` with fiscal year, region, and optional carry-over only; participant geography is home province/territory with submission-address province first and client-address province fallback; the grain is one row per intervention; only CRF/EI rows are included; intervention rows include payment follow-up derived from payment-packet and finance-transaction state; and Excel export emits `Summary`, `CRF Detail`, and `EI Detail` worksheets from the current filtered dataset. The workbook `CURRENT BC 2025-26 - ISET Advance and Active Client Spreadsheet.xlsx` is a business/layout reference only, not the literal transactional spec. This same thread also settled the current finance semantics used around the report: approved intervention funding is authority only; payment packets are created manually for real claim periods; packet statuses are `draft`, `ready_to_send`, `submitted`, `confirmed`, `cancelled`; line statuses are `needs_evidence`, `ready_to_send`, `submitted`, `paid`, `held`, `cancelled`; carry-over is only exact when PATH has dated line-level packet data; and the Budgets dashboard `Committed` column was restored to its original pot-control meaning of approved intervention funding reserved against the budget pot, while `Actual` remains posted finance spend.

### Admin-console bug reporting and change requests

- Codex task title: `Add issue reporting flow`
- Topic: in-app staff bug-reporting / change-request flow plus System Administrator homepage and shared Support triage
- Keywords: `Add issue reporting flow`, `bug reporting`, `change request`, `admin console help`, `top header bug button`, `floating report window`, `floating review window`, `system administrator homepage`, `Bugs and Change Requests widget`, `/support/bugs-change-requests`, `admin_feedback_report`, `admin_feedback_attachment`, `admin_feedback_status_history`, `admin_feedback_note`
- When to open: the user asks how internal PATH staff are supposed to report admin-console issues from inside the app, asks where the floating report or review windows are wired, asks how Sysadmins/NWAC Admins/Regional Managers triage those reports, or asks whether those uploads use Supporting Documents or their own storage model
- Primary docs:
  - `docs/features/admin-feedback-reporting.md`
  - `docs/AGENTS.md`
  - `docs/meta/project-map.md`
- Status: current as of 2026-04-30
- Notes: durable decisions from this thread: the report entry point is a dedicated top-header button beside `Admin Console Help`; the launcher flow is top-nav button -> help panel instructions -> floating non-modal report window; page context is captured when the window opens so staff can keep navigating while writing; and persistence is intentionally separate from `iset_document` because bug/change evidence is not a client/application/case document. A later pass in the same feature added System Administrator homepage triage via the `Bugs and Change Requests` widget plus a floating review panel with status changes and internal notes. On 2026-04-30 the same widget was reused on a dedicated `Support > Bugs and Change Requests` dashboard (`/support/bugs-change-requests`) with default route/API review access for `System Administrator`, `NWAC Administrator`, and `Regional Manager` only; do not widen beyond those roles without privacy review because feedback attachments can include screenshots/page context. The canonical schema migrations are `sql/migrations/20260405_0001_create_admin_feedback_reporting.sql` and `sql/migrations/20260405_0002_create_admin_feedback_management_tables.sql`, and the backend routes now include `POST /api/admin/feedback-reports`, `GET /api/dashboard/admin-feedback-reports` (`GET /api/dashboard/system-admin-feedback-reports` retained as a compatibility alias), `GET /api/admin/feedback-reports/:id`, `PATCH /api/admin/feedback-reports/:id/status`, and `POST /api/admin/feedback-reports/:id/notes`. Later workflow clarification from 2026-04-17: when Bill asks Codex to triage bugs/CRs, Codex should review the queue, inspect the available evidence for each open item, add internal notes, update statuses for duplicates/by-design/support-only/info-gap items as needed, and then return a prioritized planning analysis of the remaining work. Current boundary: triage does not yet imply autonomous implementation/deployment beyond that queue-management and planning pass. Original plugin prompt title for this thread was `This task is to create an in-app bug reporting and change request function on the admin-console side.`

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
- Notes: the current operating rule is that client-file import creates only the client plus application-less case, while historical plans/interventions are added later through Case Header backload actions. Those backload actions stay silent, and `manual_backload` interventions stay silent on later edit/close flows too: no approval routing, checklist progression, notifications, payment-packet generation, or finance-email side effects. They must still preserve real lifecycle state: archived plans are read-only, closed plans can receive only completed/cancelled interventions, in-progress or suspended interventions require an active plan, and historical start/result/end dates now seed the stored lifecycle timestamps used by the workspace. Finance handling is now history-only: `actual amount` on a backloaded intervention writes a posted historical ledger entry for reporting/budget burn, while unpaid remainder should move into a new live intervention. Coordinator-facing Case Workspace help panels and embedded AI chat context now explicitly coach staff through these backload actions instead of assuming only normal post-approval casework.

### Locate quick action display rules

- Codex task title: `Locate quick action display rules`
- Topic: Case Header display gate for historical-entry actions, the 2026-05-04 widening to application-backed cases, and the split of workspace header controls into `Quick layouts` and `Quick actions`
- Keywords: `Locate quick action display rules`, `Locate quick action display notes`, `backload eligible`, `Add existing action plan`, `Add existing intervention`, `Upload existing documents`, `application-backed case`, `application-less case`, `manual_backload`, `historical action plan`, `historical intervention`, `quick action gate`, `caseData.applicationId`, `Quick layouts`, `Quick actions`
- When to open: the user asks why the existing-plan, existing-intervention, or upload-existing-documents quick actions are hidden; asks what "backload eligible" means; asks whether historical backload is allowed on cases with applications; asks about the historical-record warning; asks which roles can use manual backload; or asks why Application/Case Workspace header menus are split into `Quick layouts` and `Quick actions`.
- Primary docs:
  - `docs/planning/case-workspace-quick-actions.md`
  - `docs/planning/application-workspace-quick-actions.md`
  - `docs/guides/client-file-imports.md`
  - `docs/widgets/admin/case-header-widget.md`
  - `docs/widgets/admin/application-overview-widget.md`
  - `docs/AGENTS.md`
  - `src/pages/Caseworking/caseWorkspace/widgets/CaseHeaderWidget.jsx`
  - `src/widgets/ApplicationOverviewWidget.js`
  - `isetadminserver.js`
- Status: implemented in DEV as of 2026-05-04
- Notes: original behavior was controlled in `CaseHeaderWidget.jsx`: backload actions showed only when the case existed, the case was not archived, and the workspace payload had no `applicationId` / `application_id`; that payload is derived from the primary `iset_application` row whose `case_id` points at the case, not from retired `iset_case.application_id`. The 2026-05-04 follow-on changed the UI gate: `Add existing action plan`, `Add existing intervention`, and `Upload existing documents` now show on non-archived cases for `System Administrator`, `NWAC Administrator`, and `Regional Manager`, including application-backed cases. The three actions show a historical-record warning before opening, and backend `backloadMode` / `entryMode=backload` submits are role-gated to those roles. The design decisions recorded in `docs/planning/case-workspace-quick-actions.md`: workflow bypass is acceptable for historical entry with role restriction and warning; backloaded records should be included in operational/service/ILMP/budget/finance reporting using their real dates; `Upload existing documents` is widened together with plans/interventions; and existing `manual_backload` guardrails remain required (`metadata.source = 'manual_backload'`, `metadata.entryMode = 'existing'`, lifecycle validation, payment-packet blocking, and silent/no-notification behavior). The same implementation split both Case Workspace and Application Workspace header controls into `Quick layouts` for non-mutating board/view presets and `Quick actions` for mutating or workflow-launching actions.

### Application-less case documents with linked PATH accounts

- Codex task title: `exact original task title not preserved`
- Topic: Supporting Documents case-mode rule for imported cases that have a participant PATH account but no linked application
- Keywords: `add existing document`, `upload existing documents`, `application-scoped document`, `imported client`, `application-less`, `PATH account`, `checklist hidden`, `case-based documents`
- When to open: the user reports that `Upload existing documents` is asking for an application on an imported file, says a batch-imported client has a PATH account but no application, or asks why the Supporting Documents widget is or is not in case-based mode
- Primary docs:
  - `docs/guides/client-file-imports.md`
  - `docs/widgets/admin/supporting-documents-widget.md`
  - `docs/data/documents-model.md`
- Status: current as of 2026-04-07
- Notes: durable rule from this thread: in Case Workspace, document mode is keyed to whether a real `iset_application` points at the case, not whether the client has a linked PATH account. Imported cases without an application must stay in case-based document mode even after applicant-account activation or silent account linking. In that mode, application-scoped document types still work by falling back to action-plan or case storage instead of forcing staff to select a nonexistent application.

### Word supporting-document preview and original download

- Codex task title: `Investigate Word view issue`
- Topic: Supporting Documents and shared document-view actions now render Word files through an internal cached preview artifact, with a separate privileged original-file download path
- Keywords: `Investigate Word view issue`, `Word view issue`, `docx viewer`, `Word preview`, `Supporting Documents`, `previews/word`, `mode=original`, `Download original`, `Office Online`, `Microsoft 365 viewer`
- When to open: the user asks why Word documents no longer open through the browser or Microsoft 365 viewer, asks where the internal Word preview behavior was added, asks why `View` shows an internal preview instead of the native `.doc` / `.docx`, asks why privileged users see a separate `Download` action, or reports a prod Word preview failure
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/widgets/admin/supporting-documents-widget.md`
  - `docs/data/documents-model.md`
- Status: current as of 2026-04-11
- Notes: durable outcomes from this task: `GET /api/documents/:id/presign-download` now detects `.doc` / `.docx`, generates or reuses a cached internal preview artifact under object-storage prefix `WORD_PREVIEW_OBJECT_PREFIX` (default `previews/word`), and returns a presigned URL for that preview instead of the raw Office object. The preferred artifact is PDF, but the backend now falls back to a self-contained HTML preview when the deployed host cannot launch Chromium for PDF rendering. The preview artifact is cached in object storage only and must not create a separate `iset_document` row. Supporting Documents also now exposes a separate `Download` action for `System Administrator` and `NWAC Administrator` only, gated by a privacy warning and backed by `GET /api/documents/:id/presign-download?mode=original`, which bypasses the preview substitution and forces attachment download of the original stored file. The prod incident on 2026-04-11 was traced to missing Chromium shared libraries on the EC2 host, not S3 encryption or document data.

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
- Status: current as of 2026-04-11
- Notes: this thread established `admin-dashboard/sql/migrations/` as the canonical PATH shared-schema path tracked by `iset_migration`, moved one-off/manual SQL into `admin-dashboard/sql/ops/`, documented `admin-dashboard/db/migrations/` as legacy archive only, and updated deployed portal paths to force `AUTO_MIGRATE=false`. It also captured the intended deployment direction: use an explicit DB preflight/apply step instead of relying on app startup or the legacy portal runners for test/prod schema work.
- Follow-on implementation in the same thread added `scripts/path-data-sync.js`, the `docs/ops/deployments/data-promotion-catalog.md` allowlist, and a bash `scripts/run-prod-sql-via-ssm.sh` helper so Codex can promote the published intake runtime row and workflow-authoring graph to TEST/PROD through explicit commands instead of manual SQL bundles.
- The same thread later added `scripts/path-deploy.js` plus the `docs/ops/deployments/path-deploy-orchestrator.md` runbook, making `npm run path:deploy` the preferred operator entry point. Durable outcomes from that phase: remote canonical schema plan/apply now supports `--target-env test|prod`; TEST smoke uses ALB target-group health (`nwac-test-admin-tg`, `nwac-test-portal-tg`) because public TEST `/healthz` currently returns `403` to Codex; release manifests are written locally under `tmp/path-deploy/`; and the TEST component deploy scripts now default to AWS profile `nwac-test`. On 2026-04-04 a dedicated `nwac-prod` profile alias was added in the Codex sandbox and the control-plane defaults were switched to it, so future prod operator work should use `nwac-prod` instead of relying on `default`. The same day, read-only prod verification confirmed that `npm` in this workspace runs under Windows Node while the trusted AWS profiles live in the bash/WSL CLI config, so AWS-backed Node/npm operator calls must shell through `bash`; the thread also captured that prod DB secret `nwac-prod-db-credentials` currently stores credentials only, so the prod SSM SQL helper supplies the default cluster host/database/port itself.
- Follow-on completion in the same thread closed the remaining lifecycle gaps: `scripts/path-test-db-refresh.js` is now a real destructive TEST reset command (with `plan` and `run --yes`) that can generate its own DEV-derived baseline snapshot, backed by `scripts/run-test-db-restore-via-ssm.sh`, and prod `path:deploy` plans/runs now include an explicit restore-point step that auto-captures an Aurora snapshot for `nwac-prod-db` before DB-affecting prod mutations. The same final pass added `--refresh-test-db` to `scripts/path-deploy.js`, so Codex can now run a one-command TEST reset + redeploy path with no manual dump-taking from the user.
- Final operational completion in the same thread verified the control plane against live environments: a non-destructive prod release (`20260404-142139`) completed through `path:deploy`, later followed by an admin-only prod refresh (`20260404-144835`) and a matching admin-only TEST rollout using the same release ID. The same pass added a visible frontend build stamp (package version + release ID + git SHA) to the admin landing-page footer and public portal Help page so operators can confirm which release is deployed without checking AWS.
- Follow-on deployment documentation on 2026-04-11 added the companion `npm run path:maintenance -- set|clear ...` operator flow for global maintenance warnings. The current control path stores one structured announcement in `iset_runtime_config(scope='runtime', k='service.announcement')`, exposes it to both apps through `GET /api/service-announcement/current`, renders it in the admin shell `Flashbar` and portal shell GOV.UK banner, and is intended for 2 to 5 minute warning windows before deploy or incident cutovers rather than true sub-minute push delivery.
- Additional TEST validation on 2026-04-11 deployed release `20260411-test-maintenance-smoke`, confirmed both TEST target groups healthy, confirmed the live portal backend row could be set and cleared with `path:maintenance`, and confirmed the deployed portal bundle rendered the expected maintenance banner text when exercised from an on-instance browser context. Durable caveat: the public TEST hosts still return `403` to Codex, so future TEST maintenance smokes may need on-instance checks or a human browser session, and the signed-in admin-console flashbar still needs a real staff session for final visual confirmation.

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

- Codex task title: `Review prod deply guide`
- Topic: selective prod intake/runtime database patch from DEV, followed by prod `shared` + `admin` + `portal` deploy, bootstrap recovery, and prod SES sandbox-exit setup
- Keywords: `prod deploy`, `prod database patch`, `workflow.schema.intake`, `iset_runtime_config`, `staff_profiles cognito_sub`, `nwac-prod-direct`, `app-bootstrap.sh`, `unzip exit code 1`, `instance refresh recovery`, `SES sandbox`, `noreply@nwac.ca`, `nwac.ca DKIM`, `production access`, `temporary password`, `NEW_PASSWORD_REQUIRED`, `AWS Environment Status`, `nwac-prod-app-role`
- When to open: the user asks whether prod intake/runtime data was safely copied from DEV without touching live case records, asks how the 2026-04-02 prod rollout was recovered after temporary `502` health failures during refresh, asks for the thread that compared prod `staff_profiles` against the prod Cognito pool before deployment, asks how prod SES was prepared and approved to move out of sandbox for `noreply@nwac.ca`, or asks why the System Administrator `AWS Environment Status` widget still showed SES warnings after AWS granted production access
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/ops/deployments/prod-deployment-guide.md`
  - `scripts/bootstrap/app-bootstrap.sh`
- Status: current as of 2026-04-08
- Notes: this thread first verified that prod `staff_profiles` was aligned with the prod staff Cognito pool (`10/10` email-to-`sub` matches, `0` mismatches), so the feared DEV-to-prod `cognito_sub` contamination was not present. For the intake rollout, prod was patched selectively from DEV by replacing only the workflow authoring graph tables (`workflow`, `step`, `step_component`, `workflow_step`, `workflow_route`, `workflow_route_option`) and upserting only `iset_runtime_config(scope='publish', k='workflow.schema.intake')`; broader `iset_runtime_config` keys and prod case/application data were left untouched. The subsequent prod rollout uploaded `shared`, `admin`, and `portal` artifacts using the Windows AWS profile `nwac-prod-direct`, then started prod ASG instance refresh `473dcd64-0939-4b78-ae7f-700fe890c6e8`. The replacement instance initially failed bootstrap because `scripts/bootstrap/app-bootstrap.sh` treated `unzip` warning exit code `1` as fatal, and the uploaded archives emitted a backslash-path warning. The instance was repaired in place, both target groups became healthy (`admin` on `5001`, `portal` on `5000`), public health checks returned `{"status":"ok"}`, and the refresh completed successfully on replacement instance `i-06366bbbbd9c17cc6`. The durable repo fix from this thread is that `scripts/bootstrap/app-bootstrap.sh` now tolerates `unzip` exit code `1` for non-fatal archive warnings, and the corrected bootstrap script was uploaded to `s3://nwac-prod-artifacts/bootstrap/app-bootstrap.sh` for future replacements. The same task later covered prod SES setup in `ca-central-1`: account `468278742295` was confirmed initially still in sandbox, the applicant-activation flow was confirmed to be hybrid rather than pure Cognito (PATH/SES-branded invitation email first, then Cognito forgot-password / `NEW_PASSWORD_REQUIRED` handling in the public portal), and `nwac.ca` was created and verified as the prod SES domain identity with Easy DKIM (`RSA_2048_BIT`). After AWS approved case `177558183000529`, prod SES production access became `GRANTED` with quota `50,000/day` and `14/sec`. The same thread also captured two operational follow-ups: a one-off temporary-password workaround for Molly Hink using the portal's supported `NEW_PASSWORD_REQUIRED` challenge flow, and the root cause of the lingering red `AWS Environment Status` SES card after SES approval. That widget failure was not an SES outage; it was an IAM gap on the prod EC2 app role `nwac-prod-app-role`, which had send permissions but lacked the SES read actions used by the widget (`ses:GetAccountSendingEnabled`, `ses:GetSendQuota`, `ses:GetIdentityVerificationAttributes`). Those permissions were added live and also to `infra/terraform/modules/compute/main.tf`, after which the prod instance could read SES status successfully. One final gotcha from this thread: if the widget still shows `Needs attention`, confirm the runtime sender is exactly `noreply@nwac.ca`; mismatched senders such as `noreply@iset.ca` will still produce a sender-verification warning even though the SES account itself is healthy.

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

### Duplicate registration handling for existing applicant accounts

- Codex task title: `Investigate duplicate registration`
- Topic: public-portal self-registration behavior when the email already belongs to an applicant account, including the confirmed-vs-unconfirmed split and the resulting TEST/PROD hotfix rollout
- Keywords: `Investigate duplicate registration`, `duplicate registration`, `existing account registration`, `An account with this email already exists`, `confirmation modal`, `confirm your email to finish signing up`, `sign in instead`, `reset or set password`, `bill@sillery.co.uk`
- When to open: the user reports that an existing applicant is being asked for a confirmation code during registration, asks what should happen when someone tries to register twice, asks whether the portal should direct existing users to sign in instead, or asks whether the duplicate-registration hotfix reached TEST or PROD
- Primary docs:
  - `../ISET-intake/docs/system/auth/public-portal-auth.md`
  - `../ISET-intake/docs/portal/accounts/registration.md`
  - `docs/data/applicant-account-activation.md`
- Status: current as of 2026-04-08
- Notes: durable outcomes from this thread: the old registration flow treated Cognito `UsernameExistsException` as if the account might always be unconfirmed, so the UI opened the email-confirmation modal even for already confirmed applicant accounts. The hotfix changed the backend to inspect the applicant-pool user status and split duplicate-registration handling into two cases: unconfirmed existing accounts still open the confirmation/resend flow, while confirmed existing accounts now stay out of the modal and are directed to sign in or reset/set their password. The thread verified in TEST that `bill@sillery.co.uk` was already `CONFIRMED` in the applicant pool and therefore should not have seen the confirmation-code path. The hotfix was then rolled out portal-only to TEST (`20260408-175356`) and PROD (`20260408-175834`). During the prod rollout there was a brief transient `502` while the ASG replacement instance completed warm-up and ELB health evaluation, but the final public smoke checks for `https://iset.nwac.ca/healthz` and `https://nwac-public.awentech.ca/healthz` both passed. One follow-up observation from the same thread: some older linked applicant accounts can have a valid Cognito/user linkage while the PATH activation fields on `client` remain null, so if future chats touch applicant-account lifecycle reporting or status displays, inspect `client.applicant_account_status`, `applicant_invited_at`, and `applicant_activated_at` directly rather than assuming linkage implies activation bookkeeping is complete.

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

### Finance payment-packet email body reset and follow-up

- Codex task title: `Update payment packet rules`
- Topic: finance payment-packet email body reset for a single-payee Sage-oriented workflow, plus deferred follow-up on evidence-document rules and packet-zip contents
- Keywords: `Update payment packet rules`, `payment packet rules`, `finance email body`, `single payee per packet`, `Sage`, `Payment Instructions`, `Vendor reference`, `payee reference`, `requested payment date`, `evidence documents`, `download zip`
- When to open: the user asks what was decided for the finance payment-packet email body, whether PATH knows a Sage/vendor ID, why `payee reference` is not the same as vendor master data, or wants to resume the later work on evidence-document requirements, checklist rules, or packet-zip contents
- Primary docs:
  - `docs/widgets/admin/finance-payment-communications-widget.md`
  - `docs/widgets/admin/finance-payment-packet-detail-widget.md`
  - `docs/planning/path-document-type-canonical-review.md`
  - `isetadminserver.js`
  - `src/pages/finance/widgets/PaymentDetailWidget.jsx`
- Status: partial as of 2026-04-22
- Notes: durable outcomes from this thread: for NWAC finance processing, the working assumption is now `single payee per packet`. Do not claim PATH knows a Sage vendor ID. The repo-backed optional field is `payment_packet_line.payee_reference`, surfaced in PATH as `Payee reference (optional)` with placeholder `Account or vendor reference`; if included in finance email content it must be treated as a CM-entered reference only, not as confirmed Sage master data. PATH does know packet/line fields such as payee name, amount, service-period dates, invoice reference, requested payment date, budget pot, funding stream, and reporting unit. The agreed next-pass body shape is: intro line `A payment request has been submitted to finance for processing.`, `Payee` section with payee name and optional `Vendor reference` only when staff intentionally entered a prior finance-provided identifier, `Payment Instructions` as an HTML table with required `Payment type`, `Amount`, and `Invoice reference` columns plus optional `Requested payment date` and `Payee reference` columns when present, then `Coding` with budget pot, funding stream, and reporting unit. The evidence-document list and download-zip contents were intentionally deferred for a later continuation. Review the current local `isetadminserver.js` finance-email diff before any TEST/PROD rollout because the thread paused before final verification.

### Payments status-set cleanup

- Topic: canonical payment packet/line status model, packet-first claim workflow, and removal of legacy review-stage statuses
- Keywords: `payment statuses`, `ready_to_send`, `submitted`, `confirmed`, `committed vs actual`, `packet first`, `manual packet creation`, `batch is not a status`
- When to open: the user asks why PATH no longer uses `awaiting_trigger`, `released`, `program_review`, `finance_review`, `batched`, or `closed`, or asks how committed/actual are distinguished in the finance module
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/guides/payments-module-user-manual.md`
  - `docs/features/payments-module.md`
  - `docs/requirements/payments-module.v2.md`
  - `sql/migrations/20260406_0003_simplify_payment_packet_statuses.sql`
- Status: current as of 2026-04-06
- Notes: durable decisions from this thread: approved interventions are funding authority only and do not auto-create live packets; staff create payment packets for specific months, receipts, invoices, or claim periods; canonical packet statuses are `draft`, `ready_to_send`, `submitted`, `confirmed`, `cancelled`; canonical line statuses are `needs_evidence`, `ready_to_send`, `submitted`, `paid`, `held`, `cancelled`; `committed` begins when a packet is sent to finance; `actual` begins only when PATH records confirmed/posted payment; optional `payment_batch` records may group submitted lines but batching is not itself a packet or line status.

### Payments implementation review and cleanup risks

- Codex task title: `Overall look at PATH payments features`
- Topic: 2026-05-11 implementation review of payment packets, evidence gates, email/Intacct submission, simple workflow bypasses, and lingering experimental paths
- Keywords: `payments review`, `SIMPLE_PAYMENT_WORKFLOW`, `send-email`, `line_level_documents_not_supported`, `mark paid`, `Intacct REST`, `Batch Payments`, `payment packet cleanup`, `legacy fallback`
- When to open: the user asks for a current payment-module audit, asks which legacy payment paths still exist, asks why program users can mark paid, asks whether Intacct submission is real or preview-only, or wants the next cleanup/refactor plan for payment packets
- Primary docs:
  - `docs/planning/payments-implementation-review-2026-05-11.md`
  - `docs/planning/payments-target-operating-model-2026-05-11.md`
  - `docs/planning/payments-transformation-plan-2026-05-11.md`
  - `docs/testing/payments-workflow-automation.md`
  - `docs/features/payments-module.md`
  - `docs/guides/payments-module-user-manual.md`
  - `isetadminserver.js`
  - `src/pages/finance/widgets/PaymentDetailWidget.jsx`
  - `src/pages/finance/widgets/PaymentsDataContext.jsx`
  - `src/pages/Caseworking/ProgramPaymentsPage.jsx`
  - `scripts/payments-workflow-smoke.js`
- Status: current implementation review as of 2026-05-11
- Notes: the review found the canonical status enums in local WSL DEV, with no active packet/line rows carrying old status values. A PROD read-only aggregate check on 2026-05-11 found all payment-packet workflow tables empty; only 2 historical `finance_transaction` rows existed, both `metadata.source = manual_backload_history`, and PROD payment email routing was present but disabled. Follow-on design conversation agreed the high-level business boundary: Finance/Sage is the financial system of record; PATH is the ISET operations system for preparing email payment handoffs and tracking operations-side follow-up where Finance feedback is unreliable. Post-email status in PATH should be treated as operational confidence/follow-up state, not authoritative accounting truth, and the distinction belongs mainly in help/design guidance rather than alert-heavy widget copy. Payments should have two surfaces over the same packet/line/follow-up data and core business actions: a case-scoped Case Workspace surface and a cross-client Payments dashboard surface. They differ by scope, filtering, and queueing context, not by having separate workflows. The 2026-05-11 safety tranche disabled `SIMPLE_PAYMENT_WORKFLOW`, retired direct `send-email`, enforced draft-only packet/line creation, moved the frontend send helper to the status transition, hid the old `Mark paid` action, and added `npm run test:payments:safety`. The 2026-05-11 follow-up tranche added current packet/line follow-up fields, immutable `payment_followup_event` history, follow-up API routes, and Payment Detail UI for logging follow-up. The 2026-05-11 two-surface tranche populated `/iset/payments` as the cross-client operational dashboard, added payment communications to the Case Workspace manage-payments layout, changed communications loading to selected-packet scope for scoped users, replaced one-click placeholder manual email logs with a real modal, and hid Intacct XML preview from operational payment surfaces by default. The evidence tranche removed the line-level document attach block, validates packet-line ownership, and sends line ids from the evidence UI so manual link/upload flows persist `payment_packet_document.payment_packet_line_id`. The reporting/budget semantics tranche made Financial Reports prefer explicit `payment_packet.follow_up_status`, changed paid/confirmed report/export language to recorded paid, and changed case/budget/homepage finance labels to recorded actual where PATH is only the operational shadow. Remaining drift: SQL-level cross-client scope scaling, audit bundle/browser coverage for line-level evidence, full DEV browser/API workflow automation, TEST rehearsal, and PROD preflight/config. Use the transformation plan for agreed workstreams and phase ordering.
- Notes: the first DEV workflow automation tranche added `scripts/payments-workflow-smoke.js` plus `npm run payments:workflow:smoke`, `payments:workflow:smoke:api`, and `payments:workflow:smoke:browser`. The rollback DB smoke passed against DEV with `DB_HOST=172.26.176.1` and verifies the submitted packet/line, line evidence, follow-up event, communication, operational finance transaction, and cleanup invariants without persisting fixture rows. The authenticated API and Puppeteer browser smokes also passed on 2026-05-11 using `program.admin@awentech.ca`; the browser pass proved the same synthetic packet renders on the Case Workspace payment surface and `/iset/payments`, with no browser console/page/API failures and cleanup verified. TEST rehearsal then completed on 2026-05-11: read-only preflight found payment workflow tables empty and Finance email routing disabled; release `20260511-test-payments-workflow` applied the follow-up migration and deployed admin under warning/fallback; rollback DB smoke passed on-instance; a deployed-bundle browser issue led to a small `src/auth/apiClient.js` fix so authenticated `apiFetch` honors `window.__API_BASE__`; release `20260511-test-payments-api-base` deployed that fix; authenticated TEST API + Puppeteer smoke passed against the deployed bundle; and final SQL cleanup showed zero smoke rows. Next step is PROD read-only preflight/config in an approved maintenance window, with no real Finance email send unless explicitly approved.

### Sage Intacct mock dashboard handoff

- Codex task title: exact original task title not preserved
- Topic: durable handoff for the separate Intacct mock-dashboard, AP-bills design work, and Sage interface fidelity audit
- Keywords: `intacct`, `sage`, `mock dashboard`, `AP bills`, `bill splitting`, `reconciliation`, `fidelity audit`, `audit:intacct-contract`, `accounts-payable/vendor`, `accounts-payable/bill`, `canonical Intacct paths`, `Sage REST`, `ia::result`
- When to open: the user references the prior Intacct design thread, asks for the saved mock-dashboard direction, asks whether the mock is faithful to Sage Intacct, asks why PATH uses `accounts-payable/vendor` or `accounts-payable/bill`, or wants to resume contract-fidelity work against the mock service
- Primary docs:
  - `docs/planning/intacct-interface-fidelity-audit.md`
  - `docs/planning/intacct-mock-dashboard-design.md`
  - `docs/data/integrations/intacct-interface-fidelity-manifest.json`
  - `scripts/intacct-contract-audit.js`
- Status: current as of 2026-06-15; incomplete-title
- Notes: the 2026-06-15 fidelity pass made canonical Sage-style REST object paths primary for PATH and the mock: `/ia/api/v1/objects/accounts-payable/vendor` and `/ia/api/v1/objects/accounts-payable/bill`. The older local aliases under `/objects/vendors` and `/objects/apbills` remain accepted by the mock and are available as local-only PATH fallback when the Intacct base URL is localhost or `INTACCT_REST_LEGACY_PATH_FALLBACK=true`. The audit script is a local PATH/mock drift guard only; claims about real Sage behavior still need official Sage docs or sandbox evidence. Current major remaining gaps are Sage response envelopes, exact REST create payload shape, attachment/supporting-document behavior, real OAuth/token validation, packet-to-bill grouping, and dashboard lifecycle state mapping.

### Step 19 checkbox-conditionality follow-up

- Codex task title: `exact original task title not preserved`
- Topic: keeping Step 19 `Supports Requested` as a checkbox array while driving later intake conditionality from those selections
- Keywords: `step 19`, `supports requested`, `checkbox array`, `contains`, `containsAny`, `notContainsAny`, `manual intake parity`, `workflow preview parity`
- When to open: the user asks why Step 19 support selections work in the public portal but not in Manual Intake or preview, or asks how the checkbox-array conditionality was implemented without refactoring Step 19 into yes/no fields
- Primary docs:
  - `docs/planning/step19-checkbox-conditionality-followup.md`
  - `docs/AGENTS.md`
- Status: superseded by `Investigate digital forms` for current parity state as of 2026-04-14
- Notes: this older recovery alias is still useful for Step 19 searches, but the current state has moved forward. Admin Workflow Preview, the intake-step editor, and Manual Intake now support the runtime checkbox-array operator set and whole-step skipping for renderable manual-intake content, and DEV workflow `21` authoring rows now regenerate the published runtime payload in `iset_runtime_config(scope='publish', k='workflow.schema.intake')`. The remaining caveat is narrower than before: Manual Intake still intentionally skips portal-only upload/signature steps. For the current full recovery note, open the `Investigate digital forms` entry above.

### TEST staff Cognito recovery

- Codex task title: `Investigate TEST sign-in issue`
- Topic: recovering TEST admin/staff accounts when region display is wrong or Cognito invitation/reset email flows fail
- Keywords: `mcoppola`, `acurtis`, `emarion`, `sstacey`, `Administrative Users regions`, `primary region only`, `staff_profiles cognito_sub`, `FORCE_CHANGE_PASSWORD`, `resend invite`, `admin-set-user-password`, `admin-update-user-attributes`, `admin-get-user`, `AWS CLI`, `nwac-test`, `forgot password email not received`
- When to open: the user reports that TEST admin users only show one region in `Administrative Users`, or a staff user cannot receive a Cognito password/invitation email, or the user remembers a thread where AWS CLI commands were used to inspect/fix a TEST staff Cognito profile, or a TEST DB refresh may have copied the wrong `staff_profiles` data
- Primary docs:
  - `docs/guides/test-staff-cognito-recovery.md`
  - `docs/AGENTS.md`
  - `src/routes/admin/users.js`
- Status: current as of 2026-04-30; auth cleanup code deployed to TEST as release `20260430-auth-region-db-test`
- Notes: the durable findings from this thread are: `Administrative Users` multi-region display depends on matching Cognito `sub` to `staff_profiles.cognito_sub`, then loading DB-backed `staff_profiles.region_id` / `staff_region` assignments. As of the 2026-04-30 auth cleanup, Cognito `custom:region_id` must be treated as historical metadata only; stale or missing DB assignments should be repaired deliberately instead of relying on sign-in to backfill from Cognito. The TEST admin-only deploy `20260430-auth-region-db-test` shipped the code path that ignores legacy staff Cognito region/user-id claims, but did not clear any TEST Cognito custom-attribute values; Bill intends to request that TEST admin user-pool cleanup separately after validating the TEST deployment. The TEST staff pool currently uses `COGNITO_DEFAULT` mail with `verified_email` account recovery only, so legacy users missing `email` / `email_verified` cannot receive recovery mail until those attributes are repaired. For existing `FORCE_CHANGE_PASSWORD` users, prefer `admin-create-user --message-action RESEND`; if email delivery still fails, use `admin-set-user-password --no-permanent` and send the temporary password out-of-band.

### Applicant watchlist manager

- Codex task title: `Add watchlist editor`
- Topic: restricted direct-management dashboard for the SIN-based applicant watchlist, plus cross-app watchlist-hit event emission
- Keywords: `watchlist editor`, `applicant watchlist`, `configuration applicant watchlist`, `watchlist hits`, `inactive watchlist`, `applicant_watchlist_hit`, `SIN watchlist`
- When to open: the user asks where the direct watchlist UI lives, how access is controlled, why quick-add remains broader than the dashboard, or how watchlist-hit events are emitted and filtered
- Primary docs:
  - `docs/dashboards/applicant-watchlist-dashboard.md`
  - `docs/AGENTS.md`
  - `sql/migrations/20260406_0001_rebuild_applicant_watchlist.sql`
- Status: current as of 2026-04-06
- Notes: durable decisions from this thread: the direct manager route is `/configuration/applicant-watchlist`; default access is `System Administrator` plus `NWAC Administrator` through the standard access-control matrix; the contextual case/application quick actions remain broadly available; removal is `inactive`, not hard delete; the canonical schema now stores 9-digit SIN values plus `status`, `updated_by_staff_profile_id`, `deactivated_at`, and `deactivated_by_staff_profile_id`; homepage watchlist-hit matching now uses active entries only; watchlist events are shared events (`added`, `updated`, `removed`, `hit`); hit events are emitted from both admin manual intake and the public intake completion path; and generic event-feed access is filtered so users without dashboard access cannot retrieve watchlist activity by probing the event feed.

### Approvals queue workspace launch behavior

- Codex task title: `exact original task title not preserved`
- Topic: making homepage approval rows open the correct application/case workspace layout, select the correct approval record, and land the wizard on the decision step
- Keywords: `Approvals queue`, `Open workspace`, `approval layout`, `Approval and decision`, `Record of decision`, `approval workspace entry`, `selected proposal`, `stale board`, `stale wizard step`
- When to open: the user asks why an approver lands on the wrong board or wrong wizard step after opening an item from the homepage `Approvals` queue, asks how PATH now ensures the correct intervention proposal is selected from the queue, or asks where the approval-entry routing contract is documented
- Primary docs:
  - `docs/dashboards/admin-home-approvals-items-widget.md`
  - `docs/dashboards/admin-home-my-work-widget.md`
  - `docs/AGENTS.md`
  - `src/utils/approvalWorkspaceEntry.js`
- Status: current as of 2026-04-21
- Notes: durable outcomes from this thread: the homepage `Approvals` queue now opens application approvals with an explicit approval-entry URL (`entry=approval&approvalType=application&step=decision`) so the application workspace switches to an approval-review layout and `CoordinatorAssessmentWidget` lands on `Approval and decision` instead of restoring the last saved wizard step. A later hardening pass is also important: explicit approval-entry step intent now beats both the application wizard's local step-memory restore and the old Cloudscape navigation-priming workaround that briefly jumped to the last step and then restored the previous one. The application workspace board now uses the approval-review layout as the starting layout for queue launches without overwriting the user's saved normal board, and normal board quick actions/reset still work after launch. Intervention approvals now carry `interventionId` and `planId` in the queue-to-workspace handoff so the case workspace opens an approval-review layout, selects the correct submitted proposal, and loads `InterventionAssessmentWidget` at `Record of decision`. That intervention path was also hardened later so approval-entry step intent beats the widget's stored-step restore plus selection/hydration resets instead of snapping back to step 1 or another remembered draft step during queue-driven launches. The case workspace board now likewise uses the approval-review layout as the starting layout for queue launches without overwriting the user's saved normal case board, and normal board quick actions/reset still work after launch. The intervention approval path now treats `Record of decision` as the approval commit point, uses `Approved`, `Denied`, and `Request Changes` as the visible decision labels, and keeps decision-letter preparation separate from the stepper as a post-decision follow-up. The shared fallback helper for `Open workspace` now understands approval rows too, so queue items still route correctly even if a caller does not precompute `workspacePath`.

### PROD feedback merge and follow-up fixes

- Codex task title: `Merge TEST reports into PROD`
- Topic: merging TEST admin feedback into the PROD bug/CR log, triaging the live PROD queue against code/data, updating report statuses/notes, and implementing/deploying low-risk follow-up fixes
- Keywords: `Merge TEST reports into PROD`, `admin_feedback_report`, `TEST into PROD`, `report 40`, `report 46`, `report 47`, `report 49`, `report 51`, `report 52`, `funded clients`, `reminders overdue`, `secure messaging modal`, `Denise Chalifoux`, `application documents hidden`, `test feedback clear`
- When to open: the user asks what happened during the TEST-to-PROD feedback merge, wants queue triage outcomes for reports `#40`/`#41`/`#45`/`#46`/`#47`/`#48`/`#49`/`#51`/`#52`, asks whether TEST feedback was cleared, or wants to recover the later data/code fixes that came out of that review
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/meta/codex-thread-index.md`
  - `sql/ops/prod-sync-test-feedback-20260422.sql`
  - `sql/ops/test-clear-admin-feedback-log-20260424.sql`
  - `sql/ops/prod-merge-denise-chalifoux-client-126-into-108-20260424.sql`
  - `sql/ops/prod-resolve-feedback-49-document-visibility-20260425.sql`
  - `isetadminserver.js`
  - `src/pages/Caseworking/portfolio/widgets/CasesTableWidget.jsx`
  - `src/widgets/CaseNotesWidget.js`
  - `src/widgets/CaseCalendarWidget.js`
  - `src/widgets/SecureMessagingWidget.js`
  - `src/widgets/caseWorkspace/SecureMessagingWidget.js`
- Status: current as of 2026-04-25
- Notes: durable outcomes from this thread: the original TEST feedback merge found no missing report/note/attachment rows to insert into PROD; the only data sync required was reopening report `#25` because TEST had a later status change than PROD. The queue was then reviewed one item at a time in PROD and the live `admin_feedback_report`, `admin_feedback_note`, and `admin_feedback_status_history` tables were updated during triage rather than only in chat. Confirmed low-risk code changes implemented from that pass were: report `#40` adding a `Show Funded Clients` filter plus relabelling the existing cases-list `active` filter to `Show Open Clients` without changing PATH status mechanics; report `#47` fixing reminder severity so future reminders no longer render overdue in notes/calendar views; and report `#46` preventing secure-message compose modals from closing on accidental backdrop/escape dismissal, with explicit cancel/discard confirmation instead. Report `#48` was intentionally left as a low-priority change request rather than implemented. A later 2026-04-24 recheck confirmed TEST had no new feedback beyond the already-merged 27-report set, then cleared the TEST feedback tables. The later open PROD triage resolved report `#51` with a guarded Denise Chalifoux duplicate-client merge after Amanda confirmed the correct email, closed report `#52` because the renaming issue could not be reproduced in current code, and fixed report `#49` by safely showing historical applicant-uploaded intake documents whose submission payload proves they belong to the current application; the `#49` fix was deployed through TEST and PROD and the PROD report was resolved. Dedicated detail entries below preserve the Denise merge, document-visibility fix, TEST clear, and deploy recovery records. This thread also corrected a deploy-process assumption: when Bill says `deploy to TEST` or `deploy to PROD`, the intended meaning is the full current awaiting-release state from the working checkout, including relevant code/config/runtime/schema promotion work, not a hand-picked subset from only the current chat. A narrower subset release should happen only if Bill explicitly asks for that scope. For release-note wording from this thread family, use neutral outcome-first bullets (`Fixed a bug...`, `Made a change...`) and keep PROD feedback-log status updates tied to actual deployment state rather than local code state.

### Portal secure-message recipient collision incident

- Codex task title: `exact original task title not preserved`
- Topic: emergency containment and repair planning after the public portal delivered applicant secure messages into unrelated applicant inboxes because portal recipient routing confused `staff_profiles.id` with `user.id`
- Keywords: `Valerie Peters`, `portal messages wrong inbox`, `secure messaging breach`, `staff_profiles.id`, `messages.recipient_id`, `maintenance page`, `prod-fix-applicant-message-recipient-collision-20260423.sql`
- When to open: the user references Valerie's report about seeing another student's SIN/funding details in portal messages, asks why applicants could receive each other's secure messages, asks how many users were affected, or needs the exact portal-maintenance / repair sequence before reopening the public portal
- Primary docs:
  - `docs/AGENTS.md`
  - `../ISET-intake/server.js`
  - `sql/ops/prod-fix-applicant-message-recipient-collision-20260423.sql`
  - `docs/meta/next-release-notes-log.md`
- Status: current as of 2026-04-23
- Notes: durable findings from this incident: the immediate containment action was `npm run path:maintenance:fallback -- set --env prod --surfaces portal --yes`, which put both public portal hosts behind the static ALB maintenance page while leaving the admin console up. The confirmed root cause was in `../ISET-intake/server.js`: applicant outbound secure-message routing used `iset_case.assigned_to_user_id` directly as `messages.recipient_id`, but that case column stores `staff_profiles.id`, not `user.id`. Because `staff_profiles.id` values overlap numerically with applicant `user.id` values, applicant messages could land in unrelated applicant inboxes. The audited PROD blast radius at the time of discovery was `5` misrouted applicant-origin messages across `5` cases, received by `3` unrelated applicant accounts (`Valerie Peters` received `2`; `Cheyanne Watkinson` `2`; `Teri Daniels` `1`), meaning `5` applicant senders had data exposed and `8` individual portal accounts were directly involved if counting both senders and unauthorized recipients. The local code fix now resolves the assigned staff profile to the real staff `user.id` via `cognito_sub` / `email` before compose is allowed or messages are inserted. Reopening the portal safely required the prepared guarded PROD cleanup script `sql/ops/prod-fix-applicant-message-recipient-collision-20260423.sql`, which rewrites wrong `messages.recipient_id` values, resets corrected inbox state to unread, removes wrong `message_item` rows, and inserts the correct recipient mailbox rows. Before the portal was reopened, live PROD verification confirmed `0` remaining mailbox rows in any folder for the three unauthorized applicant accounts on the five repaired messages, `0` remaining collision-pattern messages in the broader audit query, and the running PROD portal host code contained the `resolveOrCreateUserIdForStaffProfile` recipient fix. The fallback maintenance-page default copy was later shortened to `PATH is temporarily unavailable while maintenance is in progress.` so the public notice did not imply an immediate reopen during the privacy-incident hold; the fallback was then cleared on 2026-04-23 at about 14:34 EDT and both public hosts returned `200 {"status":"ok"}`.
- Follow-on audit notes from the same incident family: the backend review on 2026-04-23 found the same broader failure mode still present in other areas. In admin, staff-profile hydration currently overwrites `req.auth.userId` with `staff_profiles.id`, and helper paths like `getAuthenticatedNumericUserId`, `resolveExistingUserIdFromAuth`, and `resolveAdminActorUserId` can therefore miswrite `*_user_id` audit columns with a staff-profile ID or any overlapping `user.id`. That affects note/reminder/escalation/document audit ownership unless those paths are hardened to resolve the true local `user.id` from Cognito sub/email first. The main finance payment routes have now been hardened so they no longer trust caller-supplied `actorUserId` / `requesterUserId` / `verifiedByUserId`-style fields; preserve that rule for future finance work and keep treating any new client-supplied `*_user_id` values as untrusted unless the backend resolves them from authenticated staff context. In the legacy portal, `POST /api/case-events` had no current portal frontend/build call sites beyond archived docs and has now been removed from `../ISET-intake/server.js`; apply the same source-plus-build verification standard before deleting any other legacy endpoints.
- Additional admin hardening from 2026-04-23: the next repair pass in `isetadminserver.js` now resolves staff-authored note/reminder/escalation/document audit user IDs from the authenticated staff subject (`cognito_sub`) instead of raw `req.auth.userId` / `req.auth.id` / `staff_profiles.id` values. That means admin case notes, reminder acknowledgement edits, escalation case-note authorship, and admin document upload/duplicate ownership no longer reuse staff-profile IDs in shared `user`-table columns.
- Identity-semantics cleanup from 2026-04-23: the follow-on tranche clarified that not all “user ID” values in admin mean the same thing. Backend requester identity now exposes an explicit `staffProfileId` for case assignment / regional-access checks, while the application-lock path continues to use an opaque authenticated actor/subject string for lock ownership. On the frontend, `useCurrentUser()` now exposes `staffProfileId` separately so regional-manager and assignment widgets stop comparing Cognito subject strings to `staff_profiles.id`.
- Additional follow-on cleanup from the same tranche: `staffProfileMiddleware` now writes `req.auth.staffProfileId` explicitly, and shared admin helpers such as `src/lib/rbac.js` / `src/middleware/authz.js` now prefer that field instead of relying on the overloaded `auth.userId` compatibility value for staff assignment scope.
- Follow-on legacy cleanup from the same incident family: the old public-upload delete alias and the Jordan experiment draft/application lookup endpoints also had no current portal source/build call sites and were removed from `../ISET-intake/server.js`. Current upload cleanup is only `DELETE /api/uploads/remove`, and current portal API docs should no longer list the removed experiment aliases. The current portal source also had stale references to older slot-search/save-draft endpoint names; those have now been removed from live code/docs so the dashboard start flow and `DynamicTest` fallback path use only the current draft/intake endpoints (`/api/draft`, `/api/intake-json`, `/api/intake-step/:stepId`, `/api/intake-step/:stepId/update`).
- Additional route-inventory cleanup from 2026-04-23: removed orphan current-source leftovers that were not part of the live portal server at all, including the unused `src/pages/api/test-notification.js` helper, the dead `src/routes/adminAuthMetrics.js` router, and the stray `src/server.js` snippet that referenced it. The current test mock in `src/__tests__/applyRoute.test.js` now matches the real `/api/me` route instead of the old `/api/get-profile` name.
- Finance hardening from the same incident family: the live finance mutation/export routes now ignore caller-supplied audit-owner IDs and resolve them from authenticated staff context on the server. That includes payment-packet create/validate/status/PDF/audit-bundle paths, payment-line status, payment-document verification updates, and payment-batch status/export. Packet requester identity is now derived from auth, packet requester ownership is no longer editable through the generic packet update route, and payment-document verification no longer accepts an arbitrary `verified_by_user_id` from the client.

### Temporary regional-manager approval lockout

- Codex task title: `exact original task title not preserved`
- Topic: Regional Managers no longer record final application/intervention decisions; application assessments, new intervention proposals, and intervention revisions now route through RM review before NWAC final decision, with a Shelley-only high-value funding approval rule
- Keywords: `regional manager approval rights`, `NWAC admins only`, `pending decision`, `pending review`, `intervention proposal decision`, `revised intervention decision`, `two-step review`, `Shelley approval`, `sstacey@nwac.ca`, `$20,000`
- When to open: the user asks whether Regional Managers can still approve/deny applications or intervention proposals, asks about RM review before the Decision Maker's final decision, asks about the `Pending Review` bucket, asks why approval is disabled at `$20,000`, or wants to revise the Shelley-only high-value funding rule
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/planning/rm-two-step-review-workflow.md`
  - `docs/guides/rm-two-step-review-user-guide.md`
  - `src/utils/rbac.js`
  - `src/widgets/CoordinatorAssessmentWidget.js`
  - `src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx`
  - `isetadminserver.js`
- Status: current as of 2026-06-19; supersedes the original April temporary-lockout wording.
- Notes: durable rule from this thread family: Regional Managers should not record final application decisions (`approve`, `reject`, or request changes in the pending-decision flow) or intervention proposal/revision decisions. As of 2026-06-19, the current operating model is a two-step workflow for application assessments, new intervention proposals, and intervention amendments/revisions: submitter sends to RM review, RM returns or submits upward, the Decision Maker records the final decision, and the Decision Maker's request-changes action returns to RM before the submitter. The current high-value funding policy is a single rule: only Shelley Stacey (`sstacey@nwac.ca`) can approve funding of `$20,000` or above. Non-Shelley final-decision pages warn and disable approval at that threshold, while backend guards reject direct API attempts for application assessment approvals, new intervention proposal approvals, intervention revision approvals, and direct approved-intervention creation.

### Homepage application-pipeline bucket model

- Codex task title: `OK please can you implement the new bucket model in DEV.`
- Topic: reworking the admin homepage Work Queue into a clearer non-terminal application pipeline without changing underlying PATH status mechanics
- Keywords: `New Applications`, `Pending Assessment`, `Applications Pending Assessment`, `EI Check Needed`, `In Assessment`, `Pending Decision`, `Pending Completion`, `Approvals`, `awaiting EI status verification`, `homepage pipeline`
- When to open: the user asks how the homepage queue buckets map to application status, wants to continue the work-queue relabel from `Approvals` to `Pending Decision`, wants to add or interpret `Pending Completion`, or asks whether EI verification / docs-requested / closure-response need their own top-level queue cards
- Primary docs:
  - `docs/dashboards/admin-home-my-work-widget.md`
  - `docs/dashboards/admin-home-approvals-items-widget.md`
  - `docs/AGENTS.md`
  - `src/pages/home/HomeDashboardPage.jsx`
  - `src/pages/home/widgets/ProgramAdminWorkQueueWidget.js`
  - `src/pages/home/widgets/WorkQueueItemsTableWidget.js`
- Status: current as of 2026-06-19; superseded for application-assessment RM review by the two-step review workflow.
- Notes: durable rule from this thread: the homepage application flow should be expressed as queue buckets, not as a status-schema rewrite. For NWAC Administrators the order now starts directly with `New Applications`, `In Assessment`, `Pending Decision`, `Pending Completion`, then `All Cases`, then exception queues; the earlier `All Applications` rollup was later removed as redundant once the pipeline buckets were in place, and the narrower EI-pending stage is no longer shown separately to NWAC Administrators. For Regional Managers the order is `Applications in My Region`, `My Applications`, then the shared application pipeline, then `Clients in My Region`, then exception queues, with the EI-pending stage shown under the shorter label `EI Check Needed`. As of 2026-06-19, application assessments, new intervention proposals, and intervention amendments in the two-step review workflow use the RM-facing `Pending Review` bucket for `rm_review` and `returned_to_rm`, while NWAC keeps `Pending Decision` for `nwac_review` and legacy/off-toggle rows. The remaining application pipeline mapping is: normalized `submitted` plus EI still pending on an assigned file -> Regional Manager `EI Check Needed`; other normalized `submitted` files that have not yet moved into active assessment -> `New Applications`; normalized `in_review` plus `awaiting_applicant` -> `In Assessment`; NWAC final-decision-stage work -> `Pending Decision`; and decided application files that still need post-decision follow-through -> `Pending Completion`. That means `New Applications` now includes both unassigned submissions and assigned EI-verified submissions that are ready to start assessment. Applicant-wait states such as docs requested / closure response stay inside `In Assessment` instead of separate top-level queues. The shared decision/review table continues to reuse the existing approval loaders and review-focused `Work Queue Items` table. `Pending Completion` surfaces approved application files until the application is completed/closed, denied application files only until the denial letter is sent, and approved new/revised intervention proposal follow-ups until the intervention approval letter is sent.

### PROD one-off decision hydration repair

- Codex task title: `OK as a one off can you update the PROD record so it correctly is listed as Denied in Step 13`
- Topic: one-off PROD data alignment for a single application whose saved decision fields conflicted between the application/case context and the case-assessment row
- Keywords: `ISET-20260409-123477`, `Madison Coppola`, `Denied in Step 13`, `step 14 opens wrong version`, `nwac_review agree disagree`, `decision hydration`
- When to open: the user asks why a denied application shows as approved in step 13, or asks what was changed in PROD for `ISET-20260409-123477`
- Primary docs:
  - `sql/ops/prod-fix-iset-20260409-123477-decision-alignment-20260423.sql`
  - `src/widgets/CoordinatorAssessmentWidget.js`
  - `isetadminserver.js`
- Status: completed on 2026-04-23
- Notes: for `ISET-20260409-123477`, the live PROD application row already showed `status = rejected`, `decision_outcome = denied`, and the case context already had `assessment_nwac_review_status = reject`, but the live workspace still rendered the approval path after hard refresh. The tactical guarded PROD repair therefore also changed `iset_case_assessment.nwac_review` to `disagree` and bumped `iset_application.row_version`, so any fallback hydration path would still resolve the file to denial and step 14 would open the denial branch. Treat this as a one-off record correction for the live file, not as the underlying code fix. The supporting SQL record is `sql/ops/prod-fix-iset-20260409-123477-decision-alignment-20260423.sql`.

### Application decision hydration precedence fix

- Codex task title: `OK back in DEV can you fix this?`
- Topic: fixing the application-workspace decision hydration so canonical approved/denied outcomes outrank legacy assurance-only fallback fields
- Keywords: `step 13 approved instead of denied`, `step 14 wrong branch`, `assessment_nwac_review_status`, `assessment_nwac_review`, `CoordinatorAssessmentWidget`, `ISET-20260409-123477`
- When to open: the user asks why a denied application opens the approval branch in step 13/14, or asks how decision hydration precedence works in the application workspace
- Primary docs:
  - `src/widgets/CoordinatorAssessmentWidget.js`
  - `src/utils/applicationStatus.js`
  - `src/utils/applicationStatus.test.js`
  - `docs/AGENTS.md`
- Status: current as of 2026-04-23
- Notes: durable fix from this thread: `CoordinatorAssessmentWidget` no longer derives the step-13 funding decision by reading `assessment_nwac_review = agree/disagree` before checking the canonical stored decision. The precedence is now: explicit `assessment_nwac_review_status` first, then canonical recorded decision outcome/application status, and only then the older assurance fallback. This prevents inconsistent historical records from reopening the approval branch after a denied decision has already been recorded.

### TEST portal deploy `ENOTEMPTY` recovery

- Codex task title: `Please deploy to TEST. A full deployment to bring it up to date with the changes to DEV.`
- Topic: recovering a TEST portal rollout when the remote instance filesystem leaves `/opt/nwac/portal/node_modules` in a bad state and `npm ci --omit=dev` fails with `ENOTEMPTY`
- Keywords: `deploy to TEST`, `portal deploy failed`, `ENOTEMPTY`, `node_modules`, `deploy-portal-test.ps1`, `clear node_modules`, `SSM rerun`
- When to open: a TEST portal deploy fails during remote dependency install with `ENOTEMPTY` on `/opt/nwac/portal/node_modules/...`, or the user asks what to do when the portal TEST deploy succeeds on build/upload but fails on-instance during `npm ci`
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/ops/deployments/deployment-quick-guide.md`
  - `docs/ops/deployments/path-deploy-orchestrator.md`
  - `../ISET-intake/scripts/deploy-portal-test.ps1`
  - `scripts/deploy-admin-test.ps1`
- Status: current as of 2026-04-23
- Notes: durable ops note from this thread: one TEST portal deploy failed on instance `i-09fe8c219a4564040` during remote `npm ci --omit=dev` with `ENOTEMPTY: directory not empty, rmdir '/opt/nwac/portal/node_modules/@cloudscape-design/components/attribute-editor'`. The artefact and build were fine; the failure was on the remote instance filesystem. The lasting fix was not just to document a manual cleanup: the in-place TEST admin and portal deploy scripts now remove the deployed `node_modules` tree before reinstalling runtime dependencies, matching the existing PROD bootstrap path. Future deploy guidance should treat that as the standard rule for both environments.

### PROD deploy rerun after snapshot-tagging IAM gap

- Codex task title: `OK now please deploy to PROD. Judge how long a warning and downtime prediction to give staff and users of the public portal based on the TEST deployment and your best judgement.`
- Topic: completing a full PROD rollout after the reduced prod operator role failed the restore-point preflight because Aurora snapshot creation also needed snapshot-tagging permission
- Keywords: `20260424-094930`, `CreateDBClusterSnapshot`, `rds:AddTagsToResource`, `nwac-prod-codex-operator`, `skip-schema`, `skip-data`, `workflow 21 checksum`, `public portal warning`
- When to open: a prod deploy fails before rollout with an RDS snapshot-tagging access error, or the user asks how the 2026-04-24 PROD deploy was recovered safely
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/ops/deployments/deployment-quick-guide.md`
  - `docs/ops/deployments/prod-deployment-guide.md`
  - `docs/ops/deployments/path-deploy-orchestrator.md`
  - `tmp/path-deploy/prod/20260424-094558--2026-04-24T09-46-17-985Z.json`
  - `tmp/path-deploy/prod/20260424-094930--2026-04-24T09-49-30-815Z.json`
- Status: completed on 2026-04-24; IAM follow-up validated on 2026-04-25
- Notes: this PROD release was planned with a 10-minute warning and a 15-minute expected interruption window based on the prior TEST rollout plus normal PROD instance-refresh overhead. The first `path:deploy` run failed before any app rollout because `nwac-prod-codex-operator` could call `CreateDBClusterSnapshot` but not the implicit `rds:AddTagsToResource` on the cluster snapshot, so the automatic restore-point step aborted. Before rerunning, DEV and PROD were compared directly for the only allowlisted data unit in scope (`intake-release` for workflow `21`): the workflow row, `workflow_step`, `step`, `step_component`, `workflow_route`, `workflow_route_option`, and `iset_runtime_config(scope='publish', k='workflow.schema.intake')` all had identical SHA-256 digests between DEV and PROD. Because there was also no pending canonical schema migration, the safe recovery was an app-only rerun with `npm run path:deploy -- --env prod --skip-schema --skip-data --skip-build --yes`, which completed successfully as release `20260424-094930`. Final public verification after clearing maintenance: `https://nwac-console.awentech.ca/healthz`, `https://iset.nwac.ca/healthz`, and `https://nwac-public.awentech.ca/healthz` all returned `{"status":"ok"}`. The IAM repair was then validated the next day by a normal full PROD release, `20260425-100201`, which successfully auto-captured restore point `path-prod-20260425-100201-20260425100220` before completing its schema/data/app path and smoke checks.

### Review PROD and TEST feedback logs; clear TEST

- Codex task title: `OK please reivew the CR and BUG logs on PROD. Please also chack whether any new CRs or BUGs have been added in TEST. After merging into PROD please empty the logs in TEST.`
- Topic: rechecking the live PROD feedback queue, confirming whether TEST had accumulated any new bug/change-request reports worth merging, and then resetting the TEST feedback tables
- Keywords: `review prod bug and cr log`, `test feedback clear`, `admin_feedback_report`, `admin_feedback_note`, `admin_feedback_status_history`, `admin_feedback_attachment`, `test-clear-admin-feedback-log-20260424.sql`
- When to open: the user asks whether TEST has any new bug/CR reports to merge into PROD, asks whether the TEST admin feedback queue has been emptied, or asks what the current open PROD feedback items were after the 2026-04-24 review
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/features/admin-feedback-reporting.md`
  - `sql/ops/test-clear-admin-feedback-log-20260424.sql`
- Status: completed on 2026-04-24
- Notes: direct TEST/PROD comparison on 2026-04-24 showed that TEST still contained only the older 27-report admin-feedback queue already represented in PROD; there were no TEST-only reports, notes, or attachments left to merge. PROD therefore remained unchanged at `52` total reports with `7` open items (`#51`, `#52`, `#49`, `#40`, `#48`, `#46`, `#47`). TEST was then intentionally reset using guarded script `sql/ops/test-clear-admin-feedback-log-20260424.sql`, which deleted all `admin_feedback_report` rows and relied on the existing `ON DELETE CASCADE` foreign keys to clear `admin_feedback_note`, `admin_feedback_status_history`, and `admin_feedback_attachment` as well before resetting the four AUTO_INCREMENT counters. Post-run verification on TEST returned `0` rows in all four tables.

### Denise duplicate-client merge prep

- Codex task title: `OK can you prepare (but not yet implement) that merge?`
- Topic: preparing a guarded PROD merge for duplicate Denise Chalifoux client records discovered while triaging feedback report `#51`
- Keywords: `Denise Chalifoux`, `duplicate client`, `case 113`, `application 31`, `client 108`, `client 126`, `user 115`, `user 159`, `kiyaostisondenisehelen`, `kiyaostinsondenisehelen`, `prod merge prep`
- When to open: the user asks why Denise has two client records, asks whether a guarded merge was prepared, or asks which Denise email must be confirmed before running the merge
- Primary docs:
  - `sql/ops/prod-merge-denise-chalifoux-client-126-into-108-20260424.sql`
  - `docs/meta/changelog.md`
  - `admin_feedback_report` item `#51`
- Status: executed on 2026-04-24
- Notes: PROD data showed duplicate Denise Chalifoux client rows created through different identity anchors. Client `108` was the older Denise record with activated PATH account email `kiyaostisondenisehelen@gmail.com` and Cognito-linked user `115`; client `126` was created by admin manual intake on 2026-04-20 for application `31` / case `113` with no applicant-account linkage, while the linked manual-intake user was local-only `user 159` on email `kiyaostinsondenisehelen@gmail.com`. The durable code-level finding behind the split remains: current `resolveOrCreateManualClient()` in `isetadminserver.js` only reuses an existing client by applicant Cognito sub, while the broader application matching helper can also match by SIN/email/name+DOB, so a staff-entered manual intake with a slightly different email can still create a second client even when a near-duplicate already exists. After Amanda Curtis confirmed `kiyaostisondenisehelen@gmail.com` is Denise's real PATH sign-in, the guarded SQL merge was executed successfully. Temporary live precautions were a manual `application_lock` on application `31` owned by `System maintenance` plus a short admin service-announcement banner telling staff to avoid Denise's record until the notice cleared. The merge kept activated client `108` / user `115` as the survivor, repointed application `31`, case `113`, submission `31`, `input_json_state`, and all linked `iset_document` rows away from duplicate client `126` / user `159`, and then corrected the remaining `iset_application.payload_json.submission_snapshot.user_id` from `159` to `115` for consistency with the new authoritative submission owner. Post-run verification showed `application 31 -> client 108`, `submission 31 -> user 115`, `case 113 -> client 108`, `0` document refs left on client `126` / user `159`, and the temporary lock/banner cleared. The merged-away client row was intentionally retained without live references for audit/recovery rather than hard-deleting it, and PROD feedback report `#51` was resolved as a data fix.

### Historical intake documents hidden on application workspace

- Codex task title: `OK go ahead with the safe fix in DEV. We will then test thoroughly in TEST.`
- Topic: fixing application workspaces that hide older applicant-uploaded intake documents when those `application_submission` rows were saved before an `iset_application` row existed and therefore still have `application_id = NULL`
- Keywords: `#49`, `application-case documents missing`, `acceptance letter hidden`, `application_id NULL`, `application_submission`, `document checklist`, `safe fix`, `submission payload file_path`
- When to open: the user asks why intake uploads exist in PROD but do not appear on `/application-case/:id`, asks whether the fix risks leaking documents from another application, or asks what was changed in DEV for feedback report `#49`
- Primary docs:
  - `isetadminserver.js`
  - `src/lib/applicationSubmissionDocumentScope.js`
  - `tests/applicationSubmissionDocumentScope.test.js`
  - `../ISET-intake/server.js`
- Status: fixed in DEV on 2026-04-24; deployed to TEST on 2026-04-24 and PROD on 2026-04-25
- Notes: the confirmed live pattern on application `4` / case `86` was that original applicant intake uploads such as `Letter of Acceptance`, `Government ID`, `Status Card`, `Band Denial Letter`, and `Resume / CV` were present in `iset_document` with `source = 'application_submission'`, correct `applicant_user_id`, and `application_id = NULL` because the portal upload flow intentionally stores them before final submission without guessing a target application. The old admin application-document query only accepted rows already linked to the current `application_id`, so those historical intake files were hidden even though the data existed. The rejected broad fix was “show all null-application applicant documents,” because that would risk leaking the wrong files onto the wrong application for applicants with multiple files. The chosen safe fix mirrors the existing intake-side linker: it derives a set of upload `file_path` values from the current application's submission payload and treats only those matching unscoped `application_submission` docs as belonging to that application. That narrow proof rule now powers both `/api/applicants/:id/documents` and `/api/applicants/:id/document-checklist`, and the focused unit test in `tests/applicationSubmissionDocumentScope.test.js` covers nested payload path collection plus the “only unscoped application_submission docs may match” guard. It shipped in TEST release `20260424-150407` and PROD release `20260425-100201`; PROD feedback report `#49` was then resolved with `sql/ops/prod-resolve-feedback-49-document-visibility-20260425.sql`.

### Privacy ERM cleanup execution

- Codex task title: `OK continue the cleanup please`
- Topic: continuing the DEV privacy ERM cleanup after the secure-message incident, with persistent plan/progress notes and staged migrations/code cutovers before TEST/PROD rollout.
- Keywords: `privacy ERM cleanup`, `assigned_staff_profile_id`, `secure message actors`, `message attachment scope`, `document FKs`, `manual_upload`, `chk_iset_document_manual_upload_scope`, `assigned_user_id`, `staff profile response contract`, `jordan_application`, `grand cleanup release`
- When to open: continuing this refactor in a new thread, preparing TEST rehearsal, or reviewing why DEV now has explicit staff-profile assignment and typed secure-message/document constraints.
- Primary docs:
  - `docs/planning/privacy-erm-cleanup-progress.md`
  - `docs/planning/privacy-erm-cleanup-grand-release-plan.md`
  - `docs/ops/environments/privacy-erm-grand-cleanup-rehearsal.md`
  - `docs/data/documents-model.md`
  - `docs/widgets/admin/supporting-documents-widget.md`
  - `docs/data/privacy-erm-audits/dev-20260426.md`
  - `scripts/privacy-erm-audit.js`
  - `scripts/privacy-erm-smoke.js`
  - `scripts/privacy-route-scope-smoke.js`
  - `scripts/privacy-route-denial-smoke.js`
  - `sql/migrations/20260426_0001_add_case_assigned_staff_profile_id.sql`
  - `sql/migrations/20260426_0002_add_message_actor_domain_columns.sql`
  - `sql/migrations/20260426_0003_harden_message_attachment_scope.sql`
  - `sql/migrations/20260426_0004_add_secure_message_referential_constraints.sql`
  - `sql/migrations/20260426_0005_harden_document_scope_references.sql`
  - `sql/migrations/20260426_0006_harden_staff_profile_actor_references.sql`
  - `sql/migrations/20260426_0007_harden_secure_message_scope_constraints.sql`
  - `sql/migrations/20260426_0008_harden_signing_request_scope_references.sql`
  - `sql/migrations/20260426_0009_harden_escalation_and_task_user_references.sql`
  - `sql/migrations/20260427_0001_harden_internal_notification_and_upload_identity.sql`
  - `sql/migrations/20260427_0002_harden_legacy_case_assignment_shadow.sql`
  - `sql/migrations/20260427_0003_retire_jordan_application_experiment_tables.sql`
  - `sql/migrations/20260427_0004_retire_appointment_queue_legacy_routines.sql`
  - `sql/migrations/20260427_0005_add_event_entry_typed_actor_references.sql`
  - `sql/migrations/20260427_0006_add_application_version_typed_author_references.sql`
  - `sql/migrations/20260427_0007_add_event_receipt_typed_viewer_references.sql`
  - `sql/migrations/20260427_0008_harden_system_generated_document_scope.sql`
  - `sql/migrations/20260427_0009_retire_secure_message_legacy_participant_columns.sql`
  - `sql/migrations/20260427_0010_retire_legacy_case_assignment_shadow.sql`
  - `sql/migrations/20260427_0011_retire_internal_notification_legacy_identity_shadows.sql`
  - `sql/migrations/20260427_0012_retire_event_receipt_legacy_recipient_shadow.sql`
  - `sql/migrations/20260427_0013_retire_legacy_case_application_pointer.sql`
  - `sql/migrations/20260427_0014_harden_application_case_scope.sql`
  - `sql/migrations/20260427_0015_retire_application_version_legacy_author_shadow.sql`
  - `sql/migrations/20260427_0016_harden_event_entry_typed_actor_scope.sql`
  - `sql/migrations/20260427_0017_harden_application_and_cfa_relationship_fks.sql`
  - `sql/migrations/20260427_0018_harden_remaining_relationship_fks.sql`
  - `sql/migrations/20260427_0019_retire_zzz_legacy_documents_table.sql`
  - `sql/ops/privacy-erm-client-account-event-orphan-preview.sql`
  - `sql/ops/privacy-erm-client-account-event-orphan-apply.sql`
- Status: in progress in DEV as of 2026-04-27; TEST/PROD migrations not yet run.
- Notes: DEV has the additive assignment, secure-message, attachment, message FK, document FK, staff-profile actor FK, secure-message/document scope-constraint, signing-request FK, escalation/task user FK, internal-notification/upload identity, legacy case-assignment shadow FK, Jordan experiment table retirement, appointment/queue routine retirement, event-entry typed actor, application-version typed author, event-receipt typed viewer, system-generated document scope, secure-message participant physical-retirement, case-assignment physical-retirement, internal-notification physical-retirement, event-receipt physical-retirement, case/application pointer physical-retirement, application-scope hardening, application-version author-shadow retirement, event-entry typed-actor scope hardening, application/CFA relationship FK hardening, remaining relationship FK hardening, and legacy document experiment retirement migrations applied with `db:migrate:plan` showing 0 pending. Current code writes/reads case assignment through `assigned_staff_profile_id`; physical `iset_case.assigned_to_user_id` is absent in DEV and any legacy assignment response aliases are derived from the explicit staff-profile field. Secure-message applicant/admin access uses typed actors plus case/application scope, secure-message responses now expose canonical typed actor/thread objects, main secure-message widgets no longer use raw `sender_id` / `recipient_id` fallbacks for applicant direction, portal replies no longer send legacy `recipient_id`, and `messages.sender_id` / `recipient_id` are physically absent in DEV. Migration `20260426_0007` requires case-scoped typed message actors, exactly one applicant actor, scoped message attachments, source-specific document lineage, and `RESTRICT` delete rules for privacy-sensitive relationships while preserving application-less manual-upload support. Follow-up DEV testing on application `3` showed the new `chk_iset_document_manual_upload_scope` correctly rejected an application-linked manual upload when backend resolution dropped `case_id`; the durable fix is in `resolveDocumentAttachmentContext()`, which now preserves/resolves real case scope for application/action-plan/client manual uploads instead of weakening the constraint. Migrations through `20260427_0017` retire the message participant, assignment, notification, event-receipt, case/application pointer, and application-version author shadows; enforce typed event actors; require application ownership; and constrain application/CFA lineage. Migration `20260427_0018` preserves/deletes 40 orphan DEV client-account event rows, adds FKs for client-account events, input-state client links, case-assessment budget-pot links, reminder action-plan links, and staff-profile regions, and records 0 remaining blockers. Migration `20260427_0019` records and drops the empty `zzz_legacy_documents` table with a fail-closed non-empty guard, and the audit now classifies all remaining no-FK ID-like columns as runtime keys, external references, audit principals, upload tokens, tutorial keys, or lookup keys. Workflow `workflow_id` fields remain classified string runtime keys such as `iset-v1`, not numeric `workflow.id` values. The regenerated DEV audit records the privacy FK/CHECK constraints, lists Jordan and zzz legacy experiment tables as missing, lists no stored routines, has 0 message/document/signing-request/escalation/task/notification/upload/case-assignment/application-version/event-receipt/case-application/event-actor/application-CFA/remaining-relationship scope anomalies under the typed model, marks major shadows as physically retired, and leaves only classified opaque/runtime IDs for later model-specific redesign. `npm run smoke:privacy-erm` now passes in DEV as a read-only data-integrity smoke for the cleaned model. Route-level cleanup now covers finance allocation evidence object-key provenance, workflow/component authoring step-editor guards, unsafe raw Nunjucks/blockstep debug gates, case watch scope filtering, application detail/version/lock visibility checks, escalation create/respond/list case-scope filtering, case detail/save/assignment/conflict/ILMP action guards, Query Editor active-database export scope, generated consent/declaration PDF application visibility, public AI support prompt/history sensitive-data filtering, admin feedback attachment scoping, admin AI external-data filtering before OpenRouter calls, notification template/routing configuration API gating, and generic shared-user API retirement. Admin denial-letter drafts now use local templates instead of sending applicant denial context externally, and AI dummy-data generators require the unsafe debug gate. The checked portal/admin shared-user-to-staff-profile helper paths now resolve only by Cognito subject, not email fallback, and `npm run smoke:privacy-routes` includes forbidden-pattern checks for that rule. `npm run smoke:privacy-denials` now exists as a real-token live denial harness for wrong-role, wrong-surface, wrong-applicant, generated PDF, finance evidence, casework payment-packet, global payment-batch, and explicit out-of-scope case/application/document probes; missing tokens/fixtures report `SKIP`, and `--require-live` turns that into a gate for TEST rehearsal. The TEST/PROD rehearsal runbook now lives at `docs/ops/environments/privacy-erm-grand-cleanup-rehearsal.md` and includes exact TEST preflight, deterministic cleanup, migration, post-smoke, maintenance-state, and blocker-decision steps. Continue live route-level scope-denial fixture collection and TEST rehearsal before any PROD grand cleanup release.
- Continuation note: `npm run seed:privacy-denials` creates DEV-only synthetic wrong-owner fixtures for the live denial harness and writes ignored fixture IDs under `tmp/`. The seeded harness exposed and fixed a payment-packet scope bug where compatibility-only `assigned_to_user_id` rows were treated as unassigned; out-of-region Regional Manager payment-packet reads/PDFs now return `403`. With fresh real DEV tokens and seeded fixtures, `npm run smoke:privacy-denials -- --require-live` passed: 26 passed, 0 failed, 0 skipped. Fixture seeding also exposed 11 stale `message_item` anomalies; the cleanup preview/apply SQL was updated to typed message participant columns and DEV cleanup run `message-item-20260427233945` preserved/deleted those rows, after which `npm run smoke:privacy-erm` passed. Public-portal smoke then exposed and fixed a transient intake-state bug where no linked client was normalized to `client_id = 0` for `input_json_state`; the portal now writes SQL `NULL` until a real client is linked. A follow-up public-portal document upload smoke exposed the old pre-submission dual-write path into `iset_document`; the portal now keeps pre-submission uploads in `iset_application_file` plus `doc_refs` and materializes scoped `application_submission` document rows only after case/application creation. The synthetic privacy-denial fixture graph and ignored `tmp/privacy-denial-*.env` files were later removed from DEV at Bill's request, so another live denial run requires fresh tokens and reseeding.

### Locate CASE-2026-0000040

- Codex task title: `Locate CASE-2026-0000040`
- Topic: PROD case/application data repairs for historical assessment PDF gaps and duplicate intervention proposals, followed by DEV queue/admin visibility changes raised from the same support conversation.
- Keywords: `Locate CASE-2026-0000040`, `Sarah Froese`, `CASE-2026-0000040`, `case 40`, `Amanda Curtis`, `8116.00`, `8116.4`, `case_assessment`, `case_assessment_redline`, `Case manager assessment v2`, `Hailey Lafrance-Chaput`, `ISET-20260414-53A087`, `Kelly Hyde`, `Felicia Erickson`, `MI-MNTBETVR-00DF7C`, `proposal 13`, `intervention 12`, `Shelley Stacey`, `New Applications Items`, `Assign`, `Reassign`, `Bugs and Change Requests`, `/support/bugs-change-requests`
- When to open: the user asks about Sarah Froese's missing assessment PDFs, Amanda's amended proposal submission, historical redline/versioned PDF backfills, Hailey Lafrance-Chaput's missing PDFs, Felicia Erickson's duplicate Pending Decision / proposal-in-progress issue, Shelley Stacey's New Applications reassignment request, or the dedicated Support Bugs and Change Requests dashboard.
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/features/admin-feedback-reporting.md`
  - `docs/dashboards/bugs-and-change-requests-dashboard.md`
  - `docs/dashboards/admin-home-my-work-widget.md`
  - `docs/dashboards/admin-home-system-admin-homepage.md`
  - `docs/meta/changelog.md`
  - `docs/meta/next-release-notes-log.md`
  - `isetadminserver.js`
  - `src/pages/home/widgets/WorkQueueItemsTableWidget.js`
  - `src/pages/home/widgets/SystemAdminFeedbackQueueWidget.jsx`
  - `src/pages/support/BugsChangeRequestsDashboard.jsx`
  - `src/config/roleMatrix.json`
  - `src/widgets/AccessControlMatrix.jsx`
  - `scripts/run-test-sql-via-ssm.sh`
  - `scripts/run-prod-sql-via-ssm.sh`
  - `tmp/test-repair-sarah-froese-20260430/repair-sarah-assessment-pdfs.js`
  - `tmp/prod-repair-sarah-froese-delete-duplicate-20260427/before-delete.tsv`
  - `tmp/prod-repair-sarah-froese-delete-duplicate-20260427/after-delete.tsv`
- Status: current as of 2026-05-05. PROD data repairs for Sarah, Hailey, and Felicia are complete; DEV code changes for New Applications reassignment, the Support Bugs and Change Requests dashboard, and intervention proposal decision notification/follow-up fixes are implemented but not necessarily deployed from this thread. A separate DEV intervention-proposal PDF parity refactor noted in this thread still needs deployment review if it remains in the checkout.
- Notes: Sarah Froese's PROD case is `iset_case.id = 40` / `CASE-2026-0000040`. Amanda Curtis submitted the amended proposal before the PDF-generation fixes, at `2026-04-17 12:20:49 UTC`, so the missing versioned assessment and redline PDFs were historical data gaps rather than current expected behavior. After TEST rehearsal, PROD run `sarah-froese-v2-redline-prod-20260430` generated `iset_document.id = 1791` (`case_assessment`, `Case manager assessment v2`) and `iset_document.id = 1792` (`case_assessment_redline`, `Case manager assessment redline v2`) linked to case `40`, action plan `6`, intervention `11`, preserving Amanda's original signature timestamp. The generated PDF snapshot reflects the current line-level total `8116.4` while the proposal/intervention row summary remains `8116.00`; keep that as a separate calculation/persistence follow-up. Because the reduced `nwac-prod` operator role cannot directly `HeadObject` the uploads bucket, PROD PDF/S3 verification should use the app host's `/opt/nwac/portal/s3Provider.headObject()` through SSM.
- Notes: A PROD scan for similar missing PDFs found older records that were mostly beta/backload `Add existing intervention` cases and did not require the same assessment artifacts. A separate missing-version repair was completed for Hailey Lafrance-Chaput's application `16` / case `98` (`ISET-20260414-53A087`): run `hailey-lafrance-chaput-v2-redline-prod-20260430` generated `iset_document.id = 1793` (`case_assessment`, `Case manager assessment v2`) and `iset_document.id = 1794` (`case_assessment_redline`, `Case manager assessment redline v2`), preserving Kelly Hyde's original `2026-04-20 19:24:19 UTC` submission signature.
- Notes: Felicia Erickson's duplicate Pending Decision state came from a mistaken second case-workspace intervention proposal after an application-workspace assessment path had already been used. The application assessment for application `10` / case `92` (`MI-MNTBETVR-00DF7C`) was submitted as a repair with run `felicia-erickson-submit-as-case-manager-prod-20260430`, generating `iset_document.id = 1795` (`case_assessment`, `Case manager assessment v3`) and `iset_document.id = 1796` (`case_assessment_redline`, `Case manager assessment redline v3`) signed as case manager Amanda Curtis at `2026-04-30 17:45:30 UTC`. The first duplicate-proposal cleanup only withdrew proposal `13` / intervention `12`, which removed it from Pending Decision but left it resumable in Case Workspace. The final PROD repair hard-deleted proposal `13` and intervention `12` with run `felicia-delete-duplicate-intervention-proposal-prod-20260430`, archived generated document `1384`, and verified case `92` has zero remaining intervention/proposal rows.
- Notes: Earlier findings from this thread also documented a DEV-only intervention proposal assessment PDF parity refactor in `isetadminserver.js`: submitted new/revision intervention proposals generate `case_assessment`, revision submissions can generate redlines, approved intervention decisions generate `case_assessment_approved` with case-manager plus approver signatures, and application-less cases can store assessment PDFs by case scope. Treat that as pending deployment validation unless a later release note says it shipped.
- Notes: Follow-up DEV fix on 2026-05-05 added backend case events for intervention proposal decisions without a schema migration: `intervention_proposal_approved`, `intervention_proposal_denied`, `intervention_proposal_changes_requested`, `intervention_revision_approved`, `intervention_revision_denied`, and `intervention_revision_changes_requested`. New proposal decisions emit from the intervention PATCH decision path; revised proposal denial/changes-requested emit from the draft revision decision path; revised approvals emit when the approved draft is applied to the source intervention so the event still has a persisted source after the temporary draft is deleted. The same fix makes intervention approval-letter follow-up derive from persisted approved proposal/revision state and allows case secure-message `assessment_approval_letter` attachments for approved intervention proposals/revisions belonging to the case, while keeping intervention-scoped denial-letter attachments blocked.
- Notes: Shelley's New Applications request resulted in a DEV UI change in `WorkQueueItemsTableWidget.js`: New Applications rows now use the applicant name as the workspace link, remove the duplicate inline `Open workspace` action, and show `Assign` or `Reassign` based on whether an owner is already present. The same conversation also added a DEV `Support > Bugs and Change Requests` dashboard at `/support/bugs-change-requests`, reusing the System Administrator feedback queue widget, adding default access for `System Administrator`, `NWAC Administrator`, and `Regional Manager`, adding the route to the Access Control Matrix, and widening the feedback review/list/update/note APIs to the same role set while retaining the old System Administrator endpoint as an alias.

### Investigate regional manager 400s

- Codex task title: `Investigate regional manager 400s`
- Topic: TEST bug where Regional Manager `spam@sillery.co.uk` saw `400 case_or_application_scope_required` network failures in Supporting Documents when the Application Workspace filter was set to `All documents`
- Keywords: `Regional Manager`, `spam@sillery.co.uk`, `case_or_application_scope_required`, `GET /api/applicants/186/documents`, `All documents`, `SupportingDocumentsWidget`, `caseId`, `applicationId`, `regional-manager-doc-scope-test-20260430`
- When to open: the user reports Regional Managers seeing Supporting Documents load failures that NWAC Administrators do not see, especially when `All documents (client + all applications)` is selected in an application workspace.
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/widgets/admin/supporting-documents-widget.md`
  - `docs/meta/changelog.md`
  - `isetadminserver.js`
  - `src/widgets/SupportingDocumentsWidget.js`
- Status: fixed and deployed to TEST on 2026-04-30 as admin release `regional-manager-doc-scope-test-20260430`
- Notes: TEST data showed `spam@sillery.co.uk` is active Regional Manager staff profile `122593`, directly assigned to case `126`; applicant `186` belongs to application `46` on that case. The bug was not a backend authorization failure for the assigned case. The frontend `All documents` option made an unscoped applicant-document call (`/api/applicants/186/documents`), which NWAC Administrators can use but Regional Managers cannot after the 2026-04-25 document-scope hardening. Selecting the specific application worked because the widget then sent `applicationId=46`. The fix makes Application Workspace `All documents` send scoped context, preferring `caseId=126`, and updates the backend `caseId` document query to include documents linked directly to the case, action plans, the case's primary application, and proven historical intake-upload matches from the primary application's submission payload. Verification before deploy passed `node.exe --check isetadminserver.js`, focused Jest tests `tests/applicationSubmissionDocumentScope.test.js` and `tests/caseAccess.test.js`, `npm run smoke:privacy-routes`, and `git diff --check`. TEST deploy was admin-only with schema/data/portal/shared skipped; both admin instances (`i-09fe8c219a4564040`, `i-0a8be782ed8604211`) reported healthy in target-group smoke, and the TEST maintenance warning was cleared afterward.

### Application On Hold workflow bucket

- Codex task title: `Fix PROD checklist rules`
- Topic: DEV implementation for feedback report `#55` from Emilie Marion requesting a way to keep an application open while waiting on external funding or future start timing.
- Keywords: `Fix PROD checklist rules`, `Hey Bill`, `feedback 55`, `emarion@nwac.ca`, `on_hold`, `On Hold`, `parking`, `parked application`, `Put on hold`, `Resume review`, `awaiting_reason`, `external_funding`, `future_start`, `Application Overview`, `Work Queue`
- When to open: the user asks about parking applications, on-hold queue behavior, why parked files leave In Assessment/Pending Decision, or how hold reasons/review reminders are persisted.
- Primary docs:
  - `docs/guides/status-lifecycle-implementation.md`
  - `docs/dashboards/admin-home-my-work-widget.md`
  - `docs/widgets/admin/application-overview-widget.md`
  - `docs/planning/application-workspace-quick-actions.md`
  - `docs/planning/status-architecture-overhaul.md`
  - `src/widgets/ApplicationOverviewWidget.js`
  - `src/pages/home/HomeDashboardPage.jsx`
  - `src/pages/home/widgets/ProgramAdminWorkQueueWidget.js`
  - `src/pages/home/widgets/IsetCoordinatorWorkQueueWidget.js`
  - `src/utils/applicationStatus.js`
  - `isetadminserver.js`
- Status: implemented in DEV on 2026-05-06; not a PROD data/config-only fix until deployed.
- Notes: `Put on hold` persists raw `iset_application.status = 'on_hold'`, lifecycle `awaiting_applicant`, and an `awaiting_reason` of `external_funding`, `future_start`, `applicant_pause`, `internal_follow_up`, `other_hold`, or generic `on_hold`. The quick action captures reason + review date + optional note, creates an `iset_case_reminder` with category `Application hold review`, and `Resume review` moves the application back to `in_review`. Homepage `On Hold` appears for NWAC Administrators, Regional Managers, and ISET Coordinators; raw `on_hold` rows are excluded from active `In Assessment`, missing-docs/follow-up, pending-decision, and active SLA-stage queues. Do not use case lifecycle `dormant` for this pre-decision application parking workflow.

### Denied application ILMP reporting seed

- Codex task title: `Implement all-denial reporting action plan seed`
- Topic: Forward-looking DEV change so every new denied application creates the reporting-only ILMP action-plan/intervention structure NWAC requested.
- Keywords: `denied reporting seed`, `Actions leading to denial`, `Career Research and Exploration`, `Employment Counselling`, `reportingOnlyDenied`, `denied_reporting`, `ILMP`, `ESDC`, `backfill denied applications`
- When to open: the user asks why denied applications create action plans/interventions, asks about the denied-application reporting backfill, or asks where the all-denial reporting seed is documented.
- Primary docs:
  - `docs/change-requests/CR-0017-Denied-Ineligible-ILMP-Seeding.md`
  - `docs/guides/status-lifecycle-implementation.md`
  - `docs/meta/changelog.md`
  - `isetadminserver.js`
  - `src/widgets/ApplicationOverviewWidget.js`
  - `src/widgets/IsetApplicationFormWidget.js`
- Status: implemented forward-only in DEV on 2026-05-20; application-lineage and EI-funding hardening was prepared in source on 2026-08-14 but is not yet deployed. Existing incorrect denied-reporting records still require a separate guarded repair plan.
- Notes: The denial seed runs when an application first moves to raw status `rejected`, not when the denial letter is sent. It creates or updates one exact-application closed reporting-only action plan named `Actions leading to denial`, creates or updates completed interventions for codes `1` (`Career Research and Exploration`) and `3` (`Employment Counselling`), sets start, end, and closed dates to the denial decision date, and flags the case with generic `reportingOnlyDenied: true` plus `excludeFromCaseworkQueues: true`. Reuse is keyed by case plus application; the application assessment maps `EI Active Claim` to claimant `1` / `EI`, `EI Reach Back` to `2` / `EI`, and `CRF` to `3` / `CRF`; plan and intervention disagreement blocks ESDC readiness. Legacy `reportingOnlyDeniedIneligible` and `denied_ineligible_reporting` records remain recognized within the same application.

### Withdrawn application ILMP reporting seed

- Codex task title: `Add withdrawal reporting action plan seed`
- Topic: Forward-looking DEV change so `Withdraw application` also creates the reporting-only ILMP action-plan/intervention structure NWAC expects.
- Keywords: `withdraw application`, `withdrawn_reporting`, `Actions leading to withdrawal`, `Career Research and Exploration`, `Employment Counselling`, `reportingOnlyWithdrawal`, `ILMP`, `ESDC`
- When to open: the user asks whether withdrawals create the closed reporting action plan/interventions, asks about existing withdrawn applications that need backfill, or asks why withdrawn records appear in ESDC reporting correction surfaces.
- Primary docs:
  - `docs/guides/case-workspace-guidance.md`
  - `docs/guides/status-lifecycle-implementation.md`
  - `docs/planning/application-workspace-quick-actions.md`
  - `docs/meta/changelog.md`
  - `isetadminserver.js`
  - `src/widgets/ApplicationOverviewWidget.js`
  - `src/widgets/IsetApplicationFormWidget.js`
- Status: implemented forward-only in DEV on 2026-05-22; PROD read-only preview found one existing withdrawn application missing withdrawal reporting artifacts, so that record needs a separate guarded backfill if the policy is applied retroactively.
- Notes: The withdrawal seed runs when an application first moves to raw status `withdrawn`. It creates or updates one closed reporting-only action plan named `Actions leading to withdrawal`, creates/updates completed interventions for codes `1` (`Career Research and Exploration`) and `3` (`Employment Counselling`), sets start/end/closed dates to the withdrawal date, records `reportingSeedSource: withdrawn_reporting`, and flags the case with `reportingOnlyWithdrawal: true`, `reportingCorrectionAllowed: true`, and `excludeFromCaseworkQueues: true`.

### Synthesia training video production

- Codex task title: `Produce Synthesia training videos`
- Topic: Synthesia API/runbook setup and PATH Support > Tutorials training-shorts dashboard workflow.
- Keywords: `Synthesia`, `SYNTHESIA_API_KEY`, `training shorts`, `Tutorials dashboard`, `Support > Tutorials`, `PATH training video`, `Withdrawing and reopening an application`, `Withdrawing an application`, `Financial Reports`, `ISET Advances and Active Clients`, `NWAC pronunciation`
- When to open: the user asks Codex to create or update PATH training shorts, publish Synthesia videos, add tutorial-video metadata, use Synthesia pronunciation controls, or explain the Synthesia API boundary.
- Primary docs:
  - `docs/guides/synthesia-training-video-production.md`
  - `docs/features/tutorial-platform.md`
  - `src/tutorials/trainingShorts.js`
  - `src/pages/support/TutorialsDashboardPage.jsx`
- Status: active runbook and dashboard pattern created on 2026-06-07; Financial Reports public review draft added to the runbook notes on 2026-06-09.
- Notes: Bill's Synthesia API key lives only in the repo-root `.env` as `SYNTHESIA_API_KEY`; never print or commit it. Script/storyboard approval is mandatory before Synthesia renders unless Bill explicitly waives that checkpoint for the specific draft. Draft/test videos stay private and watermarked, with no Synthesia video ID or embed URL in app metadata until Bill approves a published staff-safe version or explicitly asks to make a draft shareable. The first real in-production dashboard row is `application-withdrawal` / `Withdrawing and reopening an application`; private test-mode withdrawal drafts were rendered for review from disposable DEV fixture screenshots. The Financial Reports public review draft uses sanitized smoke visuals and is intentionally not listed in app metadata yet.

## Future improvements

- Add stable entry IDs if this grows beyond a small manual list.
- Split the index by area (`Casework`, `Reporting`, `Ops`, `Auth`, `Finance`) once the list becomes long enough that a flat file slows search.
- Mark entries `superseded` when a newer canonical doc replaces them, but keep the old search keywords so future chats can still find the redirect.
