# Prod Deployment Guide

Status: current WSL-native PROD deployment guide. Verify live AWS state before any mutating command.
Last reviewed: 2026-07-09 after the critical feedback reporting PROD release.

For the shortest operator commands, start with `docs/ops/deployments/deployment-quick-guide.md`.

This guide records the PROD safety sequence. The active app artifact rollout is WSL-native through `scripts/path-deploy.js`; do not use stale Windows checkout paths as a deployment source.

## Before You Start

- Work from the WSL admin repo: `/home/bill/ISET/admin-dashboard`.
- Before any PROD app deploy with user-visible changes, update `docs/meta/next-release-notes-log.md` so the landing-page release notes match the release being shipped. The public page must show the standard `What changed`, `Known Bugs`, and `What's Coming` sections; `What changed` must contain expandable groups for the three most recent release packages, newest first, and must not use `Earlier changes`.
- If the PROD deploy includes fixes for in-app feedback bug/CR reports, list the affected report IDs before deploy and make sure each live report has a current note/status for the pending release. Report reconciliation is part of the deploy, not a separate follow-up.
- Do not deploy each prepared bug/CR fix to PROD on its own by default. Batch suitable fixes into a planned PROD maintenance release unless Bill explicitly approves an emergency hotfix.
- Do not use old `X:\ISET` / `/mnt/x/ISET` checkout instructions for PROD. They were superseded by the WSL migration and are not a valid way to recover deploy safety.
- PROD plan/schema/data/app/smoke helpers are WSL-safe through `path:deploy`. The PROD app branch builds and packages the WSL admin repo, sibling portal repo, and sibling `shared` tree, uploads fixed `*-latest.zip` artifacts to `nwac-prod-artifacts`, then waits for the PROD ASG refresh.
- Prefer the PATH orchestrator from `admin-dashboard`; it wraps schema/data/app rollout/smoke into one release command.
- Uploading artifacts does not update the live instance by itself. The orchestrator and the low-level manual flow both trigger a prod instance refresh after uploads.
- The dedicated prod operator profile is `nwac-prod`. In the current Codex sandbox it assumes the reduced role `nwac-prod-codex-operator` from `default`; `default` is only the bootstrap IAM user and direct prod resource calls through it are expected to fail.
- The reduced `nwac-prod` role covers normal deploys, prod SQL/dumps via SSM, ASG refresh, automatic prod restore-point capture, and the ALB `path:maintenance:fallback` flow. It does not cover broader infra/admin tasks such as WAF changes, SSM env parameter writes, uploads-bucket CORS changes, or Terraform/ACM changes.
- In the current Codex sandbox, trusted operator AWS profiles live in the bash/WSL-side AWS CLI config. The PATH control-plane scripts already route AWS-backed checks through `bash`; if you write new operator helpers, follow the same pattern.
- Current prod DB helper assumption: `nwac-prod-db-credentials` currently contains only `username` and `password`, so `bash scripts/run-prod-sql-via-ssm.sh` defaults the host/database/port to `nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com`, `iset_intake`, and `3306`.
- `bash scripts/run-db-dump-via-ssm.sh` now exports temporary credentials from the active AWS profile before uploading the dump back to S3, so the role-backed `nwac-prod` profile works for prod dump capture as well.
- Do not use `-SkipBuild` unless you have already inspected the current `build/` output and confirmed it was compiled for prod. React bundles bake environment-specific Cognito domains, client IDs, and external links, so a stale test build can be uploaded to prod unchanged.
- Before a future PROD app deploy, explicitly inspect `git status --short` and the relevant WSL diffs. The app artifact packages the current WSL working trees, not just the Git index. The deploy orchestrator now blocks dirty PROD app source trees before mutation; use `--allow-dirty --dirty-reason "<specific approved reason>"` only for an explicitly approved emergency exception.
- `/home/bill/ISET/shared` should be clean and pushed to private GitHub remote `https://github.com/BrimborionInc/iset_shared.git` before PROD app deploys.
- Deployment scope boundary: a PROD app deploy means the current app build plus planned schema migrations. It does not include runtime configuration, allowlisted data promotion, arbitrary SQL data fixes, or full database restores unless Bill explicitly confirms that exact data scope in the current thread. Use `--skip-data` or omit `--dataset` for app/schema-only releases. Do not include `--dataset intake-release` as boilerplate; it promotes workflow authoring plus the global published intake runtime row. Do not mirror DEV runtime config into PROD as routine deployment hygiene; PROD runtime setting changes must name specific keys/rows and have their own review.
- Release-scope ownership boundary: Codex owns deciding which code/config files belong in the release. Do not ask Bill implementation-level release-composition questions; inspect the source trees, diffs, generated artifacts, and runtime-config boundaries, then choose defensibly. Ask only for true business/data/runtime ambiguity with concrete consequences, for example whether to promote a named DEV-published intake runtime schema that appears experimental.
- Unqualified deploy scope: include all outstanding coherent, tested, release-ready code/schema/documentation work across threads, repositories, and backlog items, not only the current thread. Explicitly list prepared exclusions before mutation. Never interpret this default as authority to copy DEV applicant/user/business/operational data, blanket-copy DEV configuration, or ship unfinished experiments. If a backlog item requires configuration, target only its named keys/rows under the normal explicit config approval gate.
- Environment boundary: DEV may contain other nForm applications and experiments, including legal aid; PROD and TEST are dedicated to NWAC ISET. Prove any intake/runtime/config payload is the intended ISET workflow before promotion. A prior experimental legal-aid intake was accidentally published to PROD and caused a significant SLA and reputational breach, so any missing/mismatched/unexplained workflow identity is a hard stop rather than a judgment call.
- Fresh-thread deploy rule: start by reading `docs/AGENTS.md`, `docs/ops/deployments/deployment-quick-guide.md`, this guide, `docs/ops/deployments/path-deploy-orchestrator.md`, and `docs/ops/deployments/data-promotion-catalog.md`; then state the deploy scope and plan command before asking Bill for approval. If any PROD data/runtime mutation is proposed, state the exact dataset or SQL, target tables/keys, source environment, reason an app/schema-only deploy is insufficient, restore/rollback path, and verification plan before any mutating command.
- Maintenance-surface rule: finalize warning, fallback, and smoke surfaces only after reading the completed plan's `App deploy` line. `shared=true` requires `--surfaces all` and an all-surface normal-routing smoke, even when admin or portal is otherwise skipped; a shared rollout changes the common runtime and the replacement host starts both processes. Scope maintenance to admin-only or portal-only only when the plan confirms `shared=false` and the rollout is genuinely isolated.

## Full Prod Deploy

Preflight from WSL:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:deploy:plan -- --env prod --skip-data
```

Planned maintenance sequence:

```bash
npm run path:maintenance -- set --env prod --surfaces all --start-in 5m --expected-duration 15m --yes
# wait through the warning window
npm run path:maintenance:fallback -- set --env prod --surfaces all --yes
npm run path:deploy -- --env prod --skip-data --release-id <release-id> --skip-smoke --yes
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
npm run path:deploy:smoke -- --env prod
npm run path:maintenance -- clear --env prod --surfaces all --yes
```

If `path:deploy` reports `Target.NotInUse` or insufficient ELB health data during the ASG refresh while the ALB fallback is enabled, verify the replacement instance is serving local `/healthz` on the admin/portal ports through SSM before clearing fallback. If the host is still bootstrapping (`npm ci`, pm2 not started, or local health failing), keep fallback active and recheck shortly. Once local health passes, clear fallback in another shell and let the refresh continue. Target groups must be in normal forwarding before ELB health can become healthy. Keep the in-app warning active until normal-routing smoke passes.

The orchestrator performs:

- AWS identity preflight
- automatic Aurora cluster snapshot restore point when schema or allowlisted data will change
- if that restore-point step ever fails under the reduced role, do not force through a DB-affecting deploy; either fix IAM first or prove the schema/data payload is already identical and rerun app-only with `--skip-schema --skip-data`
- canonical shared-schema plan/apply through SSM
- optional allowlisted data/config promotion only when `--dataset` is explicitly included and approved as part of the PROD scope
- WSL-native `shared` + `admin` + `portal` artifact upload
- waited prod ASG instance refresh
- post-refresh smoke checks
- release manifest capture under `tmp/path-deploy/prod/`
- the existing boot-time runtime install path already removes deployed `node_modules` before `npm ci/install`, which is the dependency-reinstall rule TEST now mirrors for its in-place deploy scripts

Current validation note:
- Release `20260708-critical-feedback-reporting-prod` deployed the full shared + admin + portal PROD path for manual-backload approval-date reporting, Critical bug/CR System Administrator email notification routing, and the Regional Snapshot `Approved Applications` label. Scope was app/schema-only with `--skip-data`; no allowlisted data promotion, runtime config, arbitrary SQL repair, intake runtime promotion, Terraform, or DB restore was deployed. The deploy applied one canonical migration, `20260708_0001_seed_admin_feedback_critical_notification.sql`, to seed the `admin_feedback_critical` System Administrator email setting. Restore point `path-prod-20260708-critical-feedback-reporting-prod-20260709005` was captured before schema apply. Sequence used all-surface warning, five-minute wait, all-surface ALB fallback, deploy with `--skip-smoke`, local replacement health check when ELB had insufficient data under fallback, fallback clear for ELB evaluation, normal-routing smoke, deployed-source marker check, SQL verification, and warning clear. Shared/admin/portal artifacts uploaded to `s3://nwac-prod-artifacts/shared/shared-latest.zip`, `s3://nwac-prod-artifacts/admin/admin-dashboard-latest.zip`, and `s3://nwac-prod-artifacts/portal/portal-latest.zip`; ASG refresh `d09452ad-b3a4-4580-8943-d60047f6393b` completed successfully on replacement instance `i-09b726950738aae8e`. Local health SSM command `d51dcc99-e9f7-460f-ba7e-58b52e649d77` confirmed admin `:5001`, portal `:5000`, and PM2 `nwac-admin`/`nwac-portal` before fallback was cleared. Final smoke returned `200` for `https://nwac-console.awentech.ca/healthz`, `https://iset.nwac.ca/healthz`, and `https://nwac-public.awentech.ca/healthz`. Deployed-source SSM command `4156f52f-ff21-4f6d-a4b1-128e87a03e64` confirmed release id in admin/portal, `manualBackloadReviewedAtValue`, `emitAdminFeedbackCriticalNotification`, shared `admin_feedback_critical`, the `Approved Applications` bundle label, and PM2 processes. SQL-over-SSM command `37e19a68-df6f-4c5b-8cac-34ad45b14f02` confirmed the migration succeeded at `2026-07-09 00:57:52` UTC and exactly one enabled System Administrator `admin_feedback_critical` email setting exists. Fallback status returned to normal forwarding and SQL-over-SSM command `68a9855c-eb44-4ee6-946c-8f0d55d61716` confirmed `service_announcement_rows = 0`. Manifest: `/home/bill/ISET/admin-dashboard/tmp/path-deploy/prod/20260708-critical-feedback-reporting-prod--2026-07-09T00-53-05-802Z.json`.
- Release `20260708-admin-user-ei-notification-fix` deployed the full shared + admin + portal PROD path for staff setup invite hardening, post-submission EI correction, and applicant-name notification display. Scope was app/schema-only with `--skip-data`; schema pending count was `0`, restore point was skipped as `no-db-mutation-planned`, data dataset was `none`, and source tree guard reported clean packaged source at admin commit `8061aa6f8be9` and portal commit `3c5dc999c6c8`. Sequence used all-surface warning, five-minute wait, all-surface ALB fallback, deploy with `--skip-smoke`, local replacement health check, fallback clear for ELB evaluation, normal-routing all-surface smoke, deployed-source marker check, feedback #157 closeout, and warning clear. Shared/admin/portal artifacts uploaded to `s3://nwac-prod-artifacts/shared/shared-latest.zip`, `s3://nwac-prod-artifacts/admin/admin-dashboard-latest.zip`, and `s3://nwac-prod-artifacts/portal/portal-latest.zip`; ASG refresh `c5c6503c-1fef-4301-a6cf-89710b6e52b5` completed successfully on replacement instance `i-02150848df7b6aca7`. The first local health check `f6fd8daa-80ec-42bd-8cdc-7e86cfe07f6e` found admin still bootstrapping; recheck `4b33d6c4-c1fc-4680-8b4c-d13a4011bf5a` passed for admin `:5001`, portal `:5000`, and PM2 `nwac-admin`/`nwac-portal`, so fallback was cleared for ELB health evaluation. Final smoke returned `200` for `https://nwac-console.awentech.ca/healthz`, `https://iset.nwac.ca/healthz`, and `https://nwac-public.awentech.ca/healthz`. Deployed-source SSM command `71540db2-8328-4071-ab6f-13c8263ad243` confirmed release id in admin and portal, `MessageAction: 'SUPPRESS'`, `ei_eligibility_dependency_blocked`, and shared `GENERIC_APPLICANT_NAME_VALUES` markers in `/opt/nwac/shared`, admin staged shared, and portal staged shared. Fallback status returned to normal forwarding and SQL-over-SSM command `b91db477-5d43-4afa-a8c7-efa03d3bc5d2` confirmed `service_announcement_rows = 0`. Feedback report `#157` moved from `planned` to `resolved` by SQL-over-SSM command `a4372be3-1a30-474f-b083-474d098950c8`. Manifest: `/home/bill/ISET/admin-dashboard/tmp/path-deploy/prod/20260708-admin-user-ei-notification-fix--2026-07-08T10-08-25-348Z.json`.
- Release `20260705-two-step-review-test-notification-fix` deployed the full shared + admin + portal PROD path for the two-step review notification fix and deploy-tool/doc updates. Scope was app/shared only: `--skip-schema --skip-data`; no schema, data promotion, runtime config, intake runtime, Terraform, or cross-environment data copy was deployed. Sequence used a short all-surface warning, all-surface ALB fallback, PROD deploy with `--skip-smoke`, local replacement health check, fallback clear for ELB health evaluation, normal-routing all-surface smoke, deployed-source marker check, and warning clear. The deploy used a recorded dirty-source override because Bill approved deploying the current intended release package before commit; the portal repo was clean and the dirty admin tree contained the intended code, generated release notes, test harness, deploy-tool hardening, and docs. ASG refresh `82a399ed-0a01-40a1-bc4d-c31d04674537` completed on replacement instance `i-0b035421748e15738`; final smoke returned `200` for `https://nwac-console.awentech.ca/healthz`, `https://iset.nwac.ca/healthz`, and `https://nwac-public.awentech.ca/healthz`. Deployed-source SSM command `a37dda23-0198-4f27-aba1-c48715d357ed` confirmed release id `20260705-two-step-review-test-notification-fix`, `resolveInterventionDecisionNotificationEventType`, `interventionDecisionReviewStatus`, `rm_review_requested`, and shared `isInterventionReviewPayload` markers. Maintenance fallback returned to normal forwarding and SQL-over-SSM command `41390a82-b185-4eb4-9991-c7c0fa43bc9b` confirmed the active `runtime/service.announcement` row count was `0`.
- Release `20260705-two-step-review-prevention` deployed an admin-only PROD prevention release for the two-step review document-link and proposal timestamp fixes. Scope was admin app only: `--skip-schema --skip-data --skip-portal --skip-shared`; no schema, data promotion, portal, shared, Terraform, or runtime-config change was deployed. Sequence used a 5-minute admin warning, admin ALB fallback, PROD deploy with `--skip-smoke`, local replacement health check, fallback clear for ELB health evaluation, normal-routing admin smoke, deployed-source check, post-deploy two-step audit SQL, and warning clear. PROD source-control guard recorded a clean source tree at commit `d0ddc56957a46761471b32c9e04956bfdf1ea53e`. ASG refresh `56e2371d-7fce-4f78-8d7c-257272bfa177` completed on replacement instance `i-0307e0c730b98a7bc`; final admin smoke returned `200` for `https://nwac-console.awentech.ca/healthz`. Deployed-source SSM command `a1129867-9c9e-42cd-89ef-4635fdf12824` confirmed release id `20260705-two-step-review-prevention`, the generated assessment PDF `interventionIds` path, and the proposal timestamp preservation marker `ELSE iset_intervention_proposal.submitted_at`. Post-deploy audit SSM command `7405d66e-0bf6-4076-808d-114b562715e7` returned only the runtime flag and workflow stage-count sections, with no known mismatch rows; maintenance fallback was normal and `service_announcement_rows = 0`.
- Release `20260626-rm-two-step-role-matrix-prod` deployed an admin-only PROD hotfix for the two-step Regional Manager review role matrix. Scope was admin app only: `--skip-schema --skip-data --skip-portal --skip-shared`; no schema, data promotion, portal, shared, Terraform, or runtime-config change was deployed. Sequence used a 5-minute admin warning, admin ALB fallback, PROD ASG refresh `9eed731d-4330-4191-9583-12a333c8142d`, fallback clear, normal-routing admin smoke, deployed-source/runtime checks, targeted Case 16 repair, feedback closeout, and warning clear. Replacement instance: `i-047ed87247d2e408e`; final admin smoke returned `200` for `https://nwac-console.awentech.ca/healthz`. Deployed-source SSM check `86773998-142d-4cc7-b060-2b29d4a561dd` confirmed release id `20260626-rm-two-step-role-matrix-prod`, `SUBMITTER_ROLE_KEYS = new Set(['isetcoordinator'])`, the server transition guard, role matrix behavior, and the guarded repair exports; runtime SQL-over-SSM command `6031e172-0271-4ba4-be44-98584f86baf3` confirmed the two-step flag enabled for application assessments, intervention proposals, and intervention revisions. Targeted repair SSM command `0f75dd7a-cdca-4567-a411-88fa8de80970` repaired feedback `#148` / Case 16 by creating review workflow `9` for intervention revision `198` / proposal `320` and generating active documents `4913` (`Case manager assessment v2`) and `4914` (`Case manager assessment redline v2`); S3 object check `4af3db1f-de61-4800-8e8f-07c92f831139` verified both uploaded PDFs. Feedback report `#148` was moved from `in_progress` to `resolved` by SQL-over-SSM command `f50554c8-962c-4674-81e6-44105cf435d2`.
- Release `20260624-rm-draft-edit-hotfix` deployed an admin-only PROD hotfix for Regional Manager in-review assessment draft editing. Scope was admin app only: `--skip-schema --skip-data --skip-portal --skip-shared`; no schema, data, portal, shared, Terraform, or runtime-config changes were deployed. The bundle was prebuilt for production and deployed with `--skip-build --skip-smoke` under the admin-only runbook sequence: 10-minute admin warning, admin ALB fallback, deploy, local replacement health check, fallback clear for ELB health evaluation, normal-routing admin smoke, deployed-source check, warning clear. ASG refresh `f972930b-62c6-4cc7-b82d-7df49894cb78` completed on replacement instance `i-07d89e5d81b3a2077`; final admin smoke returned `200` for `https://nwac-console.awentech.ca/healthz`. Deployed-source SSM check `72dc8bd0-541c-4d6c-8e9e-adbec173be25` confirmed release id `20260624-rm-draft-edit-hotfix`, `buildTarget: production`, public release notes, and `canEditDraftAssessmentAsRegionalManager` in `CoordinatorAssessmentWidget.js`. Feedback report `#146` was moved from `planned` to `resolved` with closeout note after live case/application recheck.
- Release `20260622-path-bugfix-patch` deployed the full WSL-native PROD app path with no schema or allowlisted data promotion: plan reported schema pending `0`, restore point skipped as `no-db-mutation-planned`, artifacts `shared/shared-latest.zip`, `admin/admin-dashboard-latest.zip`, and `portal/portal-latest.zip`, ASG refresh `c032312c-3fd6-40cf-8ac7-cb35f595cc3e`, replacement instance `i-0362df79d25a76d15`, and final public smoke all passed. The runbook fallback/ELB-health branch was used: local `/healthz` on admin `:5001` and portal `:5000` passed before clearing fallback so ELB could evaluate target health. After app deploy, guarded cleanup SQL `sql/ops/prod-path-patch-bugfix-cleanup-20260622-apply.sql` repaired existing PATH bug residue and the preview returned zero for all four cleanup categories. Feedback reports `#144` and `#145` were moved from `planned` to `resolved` with closeout notes.
- Release `20260620-rm-two-step-review-rollout` deployed the full WSL-native PROD path with four schema migrations and no data sync: restore point `path-prod-20260620-rm-two-step-review-rollout-20260620142732`, artifacts `shared/shared-latest.zip`, `admin/admin-dashboard-latest.zip`, and `portal/portal-latest.zip`, ASG refresh `83f76172-0b5a-4556-a769-e0ee77833911`, replacement instance `i-04f3c7c4b7084a92b`, and final public smoke all passed. The release also applied approved runtime/config SQL after smoke: `feature_flags/workflow.two_step_rm_review.enabled` is enabled for application assessments, intervention proposals, and intervention revisions; two-step review bell-alert rows are normalized; legacy `assessment_submitted` rows for `NWAC Administrator`, `System Administrator`, and `Regional Manager` are disabled.
- Release `20260507-prod-contact-retirement` confirmed the WSL-native PROD path: restore point `path-prod-20260507-prod-contact-retirement-20260508000234`, artifacts `shared/shared-latest.zip`, `admin/admin-dashboard-latest.zip`, `portal/portal-latest.zip`, ASG refresh `f323cb21-bc0c-4063-b0e8-017b40f31544`, replacement instance `i-00b00ebdff3f55dc5`, and final public smoke all passed.
- Release `20260425-100201` confirmed the repaired IAM path by capturing restore point `path-prod-20260425-100201-20260425100220` before the normal full prod deploy completed successfully.

## Feature-Flagged Portal Changes

For portal behaviors guarded by runtime config, deploy code first and enable the flag only after the app rollout is complete.

Recommended prod sequence:

1. Keep the target runtime row absent or set to `false`.
2. Deploy the portal code:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-admin --skip-shared --release-id intake-draft-autosave-prod --yes
```

3. After the prod refresh and smoke checks pass, enable the flag:

```bash
cd /home/bill/ISET/admin-dashboard
bash scripts/run-prod-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
```

Rollback path:
- Set the same runtime row to `{\"enabled\": false}` first.
- Only redeploy code if the problem is not resolved by turning the feature off.

Current autosave safety note:
- The portal uses a separate endpoint, `POST /api/draft/autosave`, so code-first / flag-later rollout avoids changing behavior for in-flight applicants until the fleet is fully updated.

## Intake Runtime Promotion

Only promote intake runtime/config when Bill explicitly confirms that the release includes runtime configuration or workflow authoring changes.

Preflight must prove the source runtime row belongs to the intended workflow:

```bash
cd /home/bill/ISET/admin-dashboard
npm run data:sync:plan -- --dataset intake-release --workflow-id 21 --target-env prod
```

The plan or deploy manifest must show `summary.runtimePublish.runtime.workflowId` equal to the intended workflow before apply. The row `iset_runtime_config(scope='publish', k='workflow.schema.intake')` is global, not per workflow, so this check is mandatory before changing PROD applicant intake behavior. For the current ISET intake, `workflowId=21` is expected; any mismatch, missing workflow id, unexpected source row, or unexplained runtime diff is a hard stop.

If runtime promotion is explicitly in scope, either include the dataset deliberately in the PROD deploy:

```bash
npm run path:deploy -- --env prod --dataset intake-release --workflow-id 21 --release-id <release-id> --yes
```

or apply only the data/config bundle:

```bash
npm run data:sync:apply -- --dataset intake-release --workflow-id 21 --target-env prod --yes
```

## Low-Level Component Flow

Legacy reference only. Prefer `path:deploy` from WSL so schema/data/app/refresh/smoke stay in one manifest.

From the admin repo, legacy commands were:

```bash
npm run deploy-shared-to-prod -- -Profile nwac-prod
npm run deploy-admin-to-prod -- -Profile nwac-prod
```

From the portal repo, legacy commands were:

```bash
npm run deploy-portal-to-prod -- -Profile nwac-prod
```

Then trigger the prod rollout from either repo:

```bash
npm run refresh-prod -- -Profile nwac-prod
```

If you want the refresh script to wait and print progress:

```bash
npm run refresh-prod -- -Profile nwac-prod -Wait
```

Current default refresh preferences:

```text
MinHealthyPercentage=100,InstanceWarmup=180,SkipMatching=false
```

The warmup is intentionally short because the real gate is ALB health; prod instances have been reaching healthy state well before 15 minutes.

## Partial Deploys

Current status:

- Admin-only, portal-only, and shared-only PROD app deploys are WSL-native through `path:deploy`.
- The old component commands are retained only in [Low-Level Component Flow](#low-level-component-flow) as legacy reference material.
- Use `--skip-smoke` while the ALB fallback is active, clear fallback when ELB health needs normal forwarding or once refresh succeeds, then run `path:deploy:smoke` before clearing the in-app warning.

Admin-only hotfix path:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:maintenance -- set --env prod --surfaces admin --start-in 5m --expected-duration 5m --yes
```

Wait through the warning window, then run:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:maintenance:fallback -- set --env prod --surfaces admin --yes
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-portal --skip-shared --release-id <release-id> --skip-smoke --yes
npm run path:maintenance:fallback -- clear --env prod --surfaces admin --yes
npm run path:deploy:smoke -- --env prod --skip-portal --skip-shared
npm run path:maintenance -- clear --env prod --surfaces admin --yes
```

Use this when:
- the release is app-only
- the release does not include changes from `/home/bill/ISET/shared`
- the change is already validated in TEST
- you want a short admin-only `brief interruptions possible` warning instead of a hard maintenance page

Portal-only hotfix path:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:maintenance -- set --env prod --surfaces portal --start-in 5m --expected-duration 5m --yes
```

Wait through the warning window, then run:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:maintenance:fallback -- set --env prod --surfaces portal --yes
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-admin --skip-shared --release-id <release-id> --skip-smoke --yes
npm run path:maintenance:fallback -- clear --env prod --surfaces portal --yes
npm run path:deploy:smoke -- --env prod --skip-admin --skip-shared
npm run path:maintenance -- clear --env prod --surfaces portal --yes
```

Use this when:
- the release is portal-only
- the release does not include changes from `/home/bill/ISET/shared`
- the change is already validated or intentionally being hotfixed directly
- you want a short portal-only `brief interruptions possible` warning instead of a hard maintenance page

Shared-only app rollout:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:maintenance -- set --env prod --surfaces all --start-in 5m --expected-duration 5m --yes
# wait through the warning window
npm run path:maintenance:fallback -- set --env prod --surfaces all --yes
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-admin --skip-portal --release-id <release-id> --skip-smoke --yes
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
npm run path:deploy:smoke -- --env prod
npm run path:maintenance -- clear --env prod --surfaces all --yes
```

## Verify Prod

Check refresh status:

```bash
aws autoscaling describe-instance-refreshes --region ca-central-1 --auto-scaling-group-name nwac-prod-asg --profile nwac-prod --output table
```

Check health:

```bash
curl https://nwac-console.awentech.ca/healthz
curl https://iset.nwac.ca/healthz
curl https://nwac-public.awentech.ca/healthz
```

Expected result for each health URL:

```json
{"status":"ok"}
```

If the run included prod schema or allowlisted data mutation, the manifest under `tmp/path-deploy/prod/` will also record the captured restore-point snapshot identifier for `nwac-prod-db`.

## Bug/CR Feedback Closeout

For any PROD deploy that ships fixes from the in-app bug/change-request queue, the release is not complete until the live feedback reports are reconciled.

- Before deploy, identify every included `admin_feedback_report.id` and add or confirm a note/status showing the item is planned or in progress for the release.
- After normal-routing smoke passes, perform the targeted workflow/artifact recheck for each included report.
- Update `admin_feedback_report.status`, `admin_feedback_status_history`, and `admin_feedback_note` in PROD after the recheck. Use `bash scripts/run-prod-sql-via-ssm.sh`; for multi-row or guarded updates, keep a reviewed SQL artifact in `sql/ops/`.
- Mark a report `resolved` only when the deployed behavior and all relevant generated/sent/client-facing artifacts have been verified. If anything remains unverified or only partially fixed, leave the report open and record exactly what remains.
