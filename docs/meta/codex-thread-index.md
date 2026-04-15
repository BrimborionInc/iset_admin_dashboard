# Codex Thread Index

Purpose: searchable index of durable notes, handoff docs, and thread-born findings that future chats may need to recover quickly when prior chat history is unavailable.

Last Updated: 2026-04-14

## How to use

- Start here when the user references "another chat", "previous thread", "there should be a note", or asks for context that is not visible in the current session.
- Use the `Codex task title` as the primary bridge back to the user's Task History list. Topic labels and keywords are secondary lookup aids.
- The Task History label is the reason this index exists. Do not treat the `Topic` line as an acceptable substitute for the recovery key.
- Search this file using the user's own words first, then open the linked canonical doc instead of relying on the short index summary.
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

### WSL repo relocation, finance-semantics rollout, and case-header funding fix

- Codex task title: `Avoid Git on Windows drives`
- Topic: moving active admin-dashboard work off `/mnt/x`, keeping TEST/PROD deploys on the Windows checkout, re-aligning PATH case-funding semantics to `Approved` / `Committed` / `Actual`, correcting the one prod decimal-shift finance record, and fixing the case-header overall-approved fallback bug
- Keywords: `Avoid Git on Windows drives`, `WSL warning`, `/mnt/x`, `/root/ISET/admin-dashboard`, `X:\\ISET\\admin-dashboard`, `deploy from Windows checkout`, `Approved Committed Actual`, `funds approved`, `case header funding`, `Overall $0 approved`, `ISET-20260408-509365`, `CASE-2026-0000070`, `decimal point`, `divide by 100`, `budget pot recalc`
- When to open: the user references the `Avoid Git on Windows drives` thread, asks why WSL warns against running Git-heavy work on Windows-mounted drives, asks where the active repo should live versus where deploys should be launched, asks what `Approved`, `Committed`, and `Actual` now mean in PATH, asks why a case header showed `Overall $0.00 approved` while the selected action plan showed approved funding, or asks which prod record was manually corrected for the decimal-shift finance bug
- Primary docs:
  - `docs/AGENTS.md`
  - `docs/ops/deployments/deployment-quick-guide.md`
  - `docs/ops/deployments/deploy-test-notes.md`
  - `docs/ops/deployments/prod-deployment-guide.md`
  - `docs/dashboards/admin-home-metrics-widget.md`
  - `docs/widgets/admin/case-header-widget.md`
  - `docs/widgets/admin/case-finance-panel-widget.md`
  - `docs/meta/changelog.md`
- Status: current as of 2026-04-14
- Notes: durable outcomes from this thread: the WSL warning was valid for this repo because `X:\ISET\admin-dashboard` appears in WSL as `/mnt/x/ISET/admin-dashboard`, so active coding/Git work was moved into the Linux filesystem (`/root/ISET/admin-dashboard`) while the old Windows checkout remained the supported deploy working tree. The deploy docs were updated to say explicitly that TEST/PROD app deploys must be launched from `X:\ISET\admin-dashboard`, not from a WSL-only checkout or a `\\wsl$\\...` current directory, because the rollout still shells into Windows `npm` / PowerShell. The finance model was then clarified and implemented as: `Approved` = intervention funding approved in PATH, `Committed` = PATH finance transactions submitted to finance, and `Actual` = PATH-recorded paid spend. Homepage metrics, Case Workspace funding summaries, finance widgets, and budget-pot rollups were updated to use that model, and TEST `budget_pot` committed/actual rollups were backfilled after deploy so older totals matched the new meaning immediately. Manual backloads remain history-only and should contribute to `Actual`, not to new approval or commitment. The same thread also repaired one production data defect on `CASE-2026-0000070`: intervention `#5` and linked finance transaction `#1` had `1,394,862.00` stored instead of the obvious divide-by-100 value `13,948.62`, so the intervention actual, finance transaction amount/metadata, and affected pot `actual_amount` rollups were corrected in prod. A later pass uncovered a UI-only bug on TEST case `ISET-20260408-509365`, where the selected action plan line correctly showed `$6,500.00 approved` but the overall case-header line incorrectly showed `$0.00 approved`; that fallback bug was fixed in `CaseHeaderWidget.jsx`, verified in TEST, and then deployed to PROD in release `20260414-prod-approved-committed-actual-header-fix`. The thread also established an operational rule for this repo: normal rolling admin-only releases like this one do not require a maintenance banner unless user-visible downtime is expected; the final TEST and PROD rollouts were verified with instance health / `/healthz` smoke checks.

### Digital forms parity, workflow-21 publish alignment, and late-thread admin/prod follow-ups

- Codex task title: `Investigate edit digital forms`
- Topic: aligning the admin digital-forms editor suite with the published public-intake runtime, verifying DEV workflow-21 authoring/runtime parity, and the later same-thread admin-console, PROD case-access, and feedback-log follow-up work
- Keywords: `Investigate edit digital forms`, `Investigate digital forms`, `digital forms`, `intake editor parity`, `workflow preview parity`, `manual intake parity`, `workflow 21`, `step library`, `workflow library`, `workflow.schema.intake`, `buildWorkflowSchema`, `Step 19`, `containsAny`, `containsAll`, `Approvals below All Cases`, `NWAC Administrator status selector`, `Amanda Curtis`, `Failed to load case`, `/cases/50`, `/cases/90`, `regional manager direct assignment`, `case 88 BC`, `prod bug log`
- When to open: the user references the `Investigate edit digital forms` thread, asks whether the step library/workflow library still drift from the published intake, asks how the intake step editor / Workflow Preview / Manual Intake were brought back in line with the public portal runtime, asks about the remaining caveats for those admin paths, remembers the later same-thread changes that moved `Approvals` under the case queue or extended the Application Overview status selector to NWAC Administrators, asks why Amanda Curtis got `Failed to load case` on `/cases/50` or `/cases/90`, or asks what later PROD follow-up work was handled under the same task-history item
- Primary docs:
  - `docs/planning/step19-checkbox-conditionality-followup.md`
  - `docs/features/file-uploads/conditional-visibility-authoring.md`
  - `docs/guides/workflow-studio.md`
  - `docs/dashboards/admin-home-my-work-widget.md`
  - `docs/dashboards/application-assessment-dashboard.md`
  - `docs/workflows/admin/case-management.md`
  - `docs/features/admin-feedback-reporting.md`
  - `docs/AGENTS.md`
- Status: current as of 2026-04-14
- Notes: durable outcomes from this thread: the admin intake-step editor, validation path, Workflow Preview, and Manual Intake now share the runtime-backed conditional-visibility operator set used by the public portal for renderable manual-intake content, including checkbox-array operators (`contains`, `notContains`, `containsAny`, `notContainsAny`, `containsAll`) and whole-step skipping when authored content becomes fully hidden. Workflow Preview and Manual Intake now also clear hidden answers so stale conditional data does not survive backtracking. DEV workflow `21` authoring rows were compared directly against `iset_runtime_config(scope='publish', k='workflow.schema.intake')`, and `buildWorkflowSchema` / `scripts/publish-workflow.js` now reproduce the same published payload apart from normal timestamp/checksum refresh, so the step library, workflow library, and published runtime row are back in sync in DEV. Remaining caveat: Manual Intake still intentionally skips portal-only upload/signature steps, so parity claims there apply only to renderable manual-intake content. Later in the same thread, the homepage `Work Queue` was reordered so `Approvals` appears directly below `All Cases` / `Clients in My Region` for `NWAC Administrator` and `Regional Manager`, and the `Application Overview` manual status selector was extended to `NWAC Administrator` users. The same task later covered a PROD Regional Manager access defect where directly assigned out-of-region case-workspace files still failed with `Failed to load case`; that fix was deployed to PROD in release `20260414-190101`, after which Amanda Curtis reports `#20` (`/cases/90`) and `#21` (`/cases/50`) were marked resolved in the live PROD feedback tables. The same PROD pass also corrected the internally inconsistent BC/NS data on case `88` / application `6` / client `97`. Durable process updates captured from this thread: Codex should keep the live PROD feedback log (`admin_feedback_report`, `admin_feedback_status_history`, `admin_feedback_note`) current when PROD bugs/CRs are investigated or resolved, and short hotfix notes should use neutral outcome-first bullets such as `Fixed a bug...` / `Made a change...` without naming the underlying report or reporter.

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
- Topic: in-app staff bug-reporting / change-request flow plus System Administrator homepage triage
- Keywords: `Add issue reporting flow`, `bug reporting`, `change request`, `admin console help`, `top header bug button`, `floating report window`, `floating review window`, `system administrator homepage`, `Bug & Change Requests widget`, `admin_feedback_report`, `admin_feedback_attachment`, `admin_feedback_status_history`, `admin_feedback_note`
- When to open: the user asks how internal PATH staff are supposed to report admin-console issues from inside the app, asks where the floating report or review windows are wired, asks how Sysadmins triage those reports from the homepage, or asks whether those uploads use Supporting Documents or their own storage model
- Primary docs:
  - `docs/features/admin-feedback-reporting.md`
  - `docs/AGENTS.md`
  - `docs/meta/project-map.md`
- Status: current as of 2026-04-05
- Notes: durable decisions from this thread: the report entry point is a dedicated top-header button beside `Admin Console Help`; the launcher flow is top-nav button -> help panel instructions -> floating non-modal report window; page context is captured when the window opens so staff can keep navigating while writing; and persistence is intentionally separate from `iset_document` because bug/change evidence is not a client/application/case document. A later pass in the same feature added System Administrator homepage triage via the `Bug & Change Requests` widget plus a floating review panel with status changes and internal notes. The canonical schema migrations are `sql/migrations/20260405_0001_create_admin_feedback_reporting.sql` and `sql/migrations/20260405_0002_create_admin_feedback_management_tables.sql`, and the backend routes now include `POST /api/admin/feedback-reports`, `GET /api/dashboard/system-admin-feedback-reports`, `GET /api/admin/feedback-reports/:id`, `PATCH /api/admin/feedback-reports/:id/status`, and `POST /api/admin/feedback-reports/:id/notes`. Original plugin prompt title for this thread was `This task is to create an in-app bug reporting and change request function on the admin-console side.`

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
- Notes: durable rule from this thread: in Case Workspace, document mode is keyed to whether the case has a linked `application_id`, not whether the client has a linked PATH account. Imported cases without an application must stay in case-based document mode even after applicant-account activation or silent account linking. In that mode, application-scoped document types still work by falling back to action-plan or case storage instead of forcing staff to select a nonexistent application.

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

### Sage Intacct mock dashboard handoff

- Topic: durable handoff for the separate Intacct mock-dashboard and AP-bills design work
- Keywords: `intacct`, `sage`, `mock dashboard`, `AP bills`, `bill splitting`, `reconciliation`
- When to open: the user references the prior Intacct design thread or asks for the saved mock-dashboard direction
- Primary docs:
  - `docs/planning/intacct-mock-dashboard-design.md`
- Status: current durable handoff baseline

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

- Codex task title: `exact original task title not preserved`
- Topic: recovering TEST admin/staff accounts when region display is wrong or Cognito invitation/reset email flows fail
- Keywords: `mcoppola`, `acurtis`, `emarion`, `sstacey`, `Administrative Users regions`, `primary region only`, `staff_profiles cognito_sub`, `FORCE_CHANGE_PASSWORD`, `resend invite`, `admin-set-user-password`, `admin-update-user-attributes`, `admin-get-user`, `AWS CLI`, `nwac-test`, `forgot password email not received`
- When to open: the user reports that TEST admin users only show one region in `Administrative Users`, or a staff user cannot receive a Cognito password/invitation email, or the user remembers a thread where AWS CLI commands were used to inspect/fix a TEST staff Cognito profile, or a TEST DB refresh may have copied the wrong `staff_profiles` data
- Primary docs:
  - `docs/guides/test-staff-cognito-recovery.md`
  - `docs/AGENTS.md`
  - `src/routes/admin/users.js`
- Status: current as of 2026-04-02
- Notes: the durable findings from this thread are: `Administrative Users` multi-region display depends on matching Cognito `sub` to `staff_profiles.cognito_sub`; stale DB `cognito_sub` values make the UI fall back to the single Cognito `custom:region_id` primary region. The TEST staff pool currently uses `COGNITO_DEFAULT` mail with `verified_email` account recovery only, so legacy users missing `email` / `email_verified` cannot receive recovery mail until those attributes are repaired. For existing `FORCE_CHANGE_PASSWORD` users, prefer `admin-create-user --message-action RESEND`; if email delivery still fails, use `admin-set-user-password --no-permanent` and send the temporary password out-of-band.

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

## Future improvements

- Add stable entry IDs if this grows beyond a small manual list.
- Split the index by area (`Casework`, `Reporting`, `Ops`, `Auth`, `Finance`) once the list becomes long enough that a flat file slows search.
- Mark entries `superseded` when a newer canonical doc replaces them, but keep the old search keywords so future chats can still find the redirect.
