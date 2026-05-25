# Prod Deployment Guide

Status: current WSL-native PROD deployment guide. Verify live AWS state before any mutating command.
Last reviewed: 2026-05-25 after adding the mandatory bug/CR feedback reconciliation closeout gate.

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
- Current prod DB helper assumption: `nwac-prod-db-credentials` currently contains only `username` and `password`, so `scripts/run-prod-sql-via-ssm.sh` defaults the host/database/port to `nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com`, `iset_intake`, and `3306`.
- `scripts/run-db-dump-via-ssm.sh` now exports temporary credentials from the active AWS profile before uploading the dump back to S3, so the role-backed `nwac-prod` profile works for prod dump capture as well.
- Do not use `-SkipBuild` unless you have already inspected the current `build/` output and confirmed it was compiled for prod. React bundles bake environment-specific Cognito domains, client IDs, and external links, so a stale test build can be uploaded to prod unchanged.
- Before a future PROD app deploy, explicitly inspect `git status --short` and the relevant WSL diffs. The app artifact packages the current WSL working trees, not just the Git index.

## Full Prod Deploy

Preflight from WSL:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:deploy:plan -- --env prod --dataset intake-release --workflow-id 21
```

Planned maintenance sequence:

```bash
npm run path:maintenance -- set --env prod --surfaces all --start-in 5m --expected-duration 15m --yes
# wait through the warning window
npm run path:maintenance:fallback -- set --env prod --surfaces all --yes
npm run path:deploy -- --env prod --dataset intake-release --workflow-id 21 --release-id <release-id> --skip-smoke --yes
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
npm run path:deploy:smoke -- --env prod
npm run path:maintenance -- clear --env prod --surfaces all --yes
```

If `path:deploy` reports `Target.NotInUse` or insufficient ELB health data during the ASG refresh while the ALB fallback is enabled, clear the fallback immediately in another shell and let the refresh continue. Target groups must be in normal forwarding before ELB health can become healthy. Keep the in-app warning active until normal-routing smoke passes.

The orchestrator performs:

- AWS identity preflight
- automatic Aurora cluster snapshot restore point when schema or allowlisted data will change
- if that restore-point step ever fails under the reduced role, do not force through a DB-affecting deploy; either fix IAM first or prove the schema/data payload is already identical and rerun app-only with `--skip-schema --skip-data`
- canonical shared-schema plan/apply through SSM
- optional allowlisted data/config promotion
- WSL-native `shared` + `admin` + `portal` artifact upload
- waited prod ASG instance refresh
- post-refresh smoke checks
- release manifest capture under `tmp/path-deploy/prod/`
- the existing boot-time runtime install path already removes deployed `node_modules` before `npm ci/install`, which is the dependency-reinstall rule TEST now mirrors for its in-place deploy scripts

Current validation note:
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
scripts/run-prod-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
```

Rollback path:
- Set the same runtime row to `{\"enabled\": false}` first.
- Only redeploy code if the problem is not resolved by turning the feature off.

Current autosave safety note:
- The portal uses a separate endpoint, `POST /api/draft/autosave`, so code-first / flag-later rollout avoids changing behavior for in-flight applicants until the fleet is fully updated.

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
- Update `admin_feedback_report.status`, `admin_feedback_status_history`, and `admin_feedback_note` in PROD after the recheck. Use `scripts/run-prod-sql-via-ssm.sh`; for multi-row or guarded updates, keep a reviewed SQL artifact in `sql/ops/`.
- Mark a report `resolved` only when the deployed behavior and all relevant generated/sent/client-facing artifacts have been verified. If anything remains unverified or only partially fixed, leave the report open and record exactly what remains.
