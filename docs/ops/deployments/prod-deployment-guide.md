# Prod Deployment Guide

For the shortest operator commands, start with `docs/ops/deployments/deployment-quick-guide.md`.

This is the shortest safe path to deploy the current prod stack.

## Before You Start

- Work from the repo roots on the same machine that has AWS prod access.
- Launch the app deploy from the Windows checkout at `X:\ISET\admin-dashboard`, not from a WSL-only checkout or a `\\wsl$\\...` current directory.
- Prefer the PATH orchestrator from `admin-dashboard`; it wraps schema/data/app rollout/smoke into one release command.
- Uploading artifacts does not update the live instance by itself. The orchestrator and the low-level manual flow both trigger a prod instance refresh after uploads.
- The dedicated prod profile name is now `nwac-prod`. Override with `--profile` or `-Profile` only if your local prod credentials live under a different profile name.
- In the current Codex sandbox, `npm` runs under Windows Node while the trusted operator AWS profiles live in the bash/WSL-side AWS CLI config. The PATH control-plane scripts already route AWS-backed checks through `bash`; if you write new operator helpers, follow the same pattern instead of assuming `npm` -> `aws.exe` will see the same profiles.
- Current prod DB helper assumption: `nwac-prod-db-credentials` currently contains only `username` and `password`, so `scripts/run-prod-sql-via-ssm.sh` defaults the host/database/port to `nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com`, `iset_intake`, and `3306`.
- Do not use `-SkipBuild` unless you have already inspected the current `build/` output and confirmed it was compiled for prod. React bundles bake environment-specific Cognito domains, client IDs, and external links, so a stale test build can be uploaded to prod unchanged.
- Prod app deploys package the current working tree. If you intend to ship only a subset of local edits, stage the intended files and temporarily stash the rest before running `path:deploy`.
- Before a PROD app deploy, explicitly inspect both `git diff --cached --name-only` and `git status --short`. This catches the common operator mistake where nothing is staged but unrelated dirty files would still be packaged.

## Full Prod Deploy

Recommended:

```powershell
cd X:\ISET\admin-dashboard
npm run path:deploy -- --env prod --dataset intake-release --workflow-id 21 --yes
```

Preflight only:

```powershell
cd X:\ISET\admin-dashboard
npm run path:deploy:plan -- --env prod --dataset intake-release --workflow-id 21
```

The orchestrator performs:

- AWS identity preflight
- automatic Aurora cluster snapshot restore point when schema or allowlisted data will change
- canonical shared-schema plan/apply through SSM
- optional allowlisted data/config promotion
- `shared` + `admin` + `portal` artifact upload
- waited prod ASG instance refresh
- post-refresh smoke checks
- release manifest capture under `tmp/path-deploy/prod/`

## Feature-Flagged Portal Changes

For portal behaviors guarded by runtime config, deploy code first and enable the flag only after the app rollout is complete.

Recommended prod sequence:

1. Keep the target runtime row absent or set to `false`.
2. Deploy the portal code:

```powershell
cd X:\ISET\admin-dashboard
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-admin --skip-shared --release-id intake-draft-autosave-prod --yes
```

3. After the prod refresh and smoke checks pass, enable the flag:

```bash
cd /mnt/x/ISET/admin-dashboard
scripts/run-prod-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
```

Rollback path:
- Set the same runtime row to `{\"enabled\": false}` first.
- Only redeploy code if the problem is not resolved by turning the feature off.

Current autosave safety note:
- The portal uses a separate endpoint, `POST /api/draft/autosave`, so code-first / flag-later rollout avoids changing behavior for in-flight applicants until the fleet is fully updated.

## Low-Level Component Flow

Use this only when you need the underlying primitives directly.

From `X:\ISET\admin-dashboard`:

```powershell
npm run deploy-shared-to-prod -- -Profile nwac-prod
npm run deploy-admin-to-prod -- -Profile nwac-prod
```

From `X:\ISET\ISET-intake`:

```powershell
npm run deploy-portal-to-prod -- -Profile nwac-prod
```

Then trigger the prod rollout from either repo:

```powershell
npm run refresh-prod -- -Profile nwac-prod
```

If you want the refresh script to wait and print progress:

```powershell
npm run refresh-prod -- -Profile nwac-prod -Wait
```

Current default refresh preferences:

```text
MinHealthyPercentage=100,InstanceWarmup=180,SkipMatching=false
```

The warmup is intentionally short because the real gate is ALB health; prod instances have been reaching healthy state well before 15 minutes.

## Partial Deploys

Admin only:

```powershell
cd X:\ISET\admin-dashboard
npm run deploy-admin-to-prod -- -Profile nwac-prod
npm run refresh-prod -- -Profile nwac-prod
```

Recommended admin-only hotfix path with a user-facing warning:

```powershell
cd X:\ISET\admin-dashboard
npm run path:maintenance -- set --env prod --surfaces admin --start-in 5m --expected-duration 5m --yes
```

Wait through the warning window, then run:

```powershell
cd X:\ISET\admin-dashboard
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-portal --skip-shared --release-id <release-id> --yes
npm run path:maintenance -- clear --env prod --surfaces admin --yes
```

Use this when:
- the release is app-only
- the release does not include changes from `X:\ISET\shared`
- the change is already validated in TEST
- you want a short admin-only `brief interruptions possible` warning instead of a hard maintenance page

Portal only:

```powershell
cd X:\ISET\ISET-intake
npm run deploy-portal-to-prod -- -Profile nwac-prod
npm run refresh-prod -- -Profile nwac-prod
```

Recommended portal-only hotfix path with a user-facing warning:

```powershell
cd X:\ISET\admin-dashboard
npm run path:maintenance -- set --env prod --surfaces portal --start-in 5m --expected-duration 5m --yes
```

Wait through the warning window, then run:

```powershell
cd X:\ISET\admin-dashboard
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-admin --skip-shared --release-id <release-id> --yes
npm run path:maintenance -- clear --env prod --surfaces portal --yes
```

Use this when:
- the release is portal-only
- the release does not include changes from `X:\ISET\shared`
- the change is already validated or intentionally being hotfixed directly
- you want a short portal-only `brief interruptions possible` warning instead of a hard maintenance page

Shared only:

```powershell
cd X:\ISET\admin-dashboard
npm run deploy-shared-to-prod -- -Profile nwac-prod
npm run refresh-prod -- -Profile nwac-prod
```

## Verify Prod

Check refresh status:

```powershell
aws autoscaling describe-instance-refreshes --region ca-central-1 --auto-scaling-group-name nwac-prod-asg --profile nwac-prod --output table
```

Check health:

```powershell
curl https://nwac-console.awentech.ca/healthz
curl https://iset.nwac.ca/healthz
curl https://nwac-public.awentech.ca/healthz
```

Expected result for each health URL:

```json
{"status":"ok"}
```

If the run included prod schema or allowlisted data mutation, the manifest under `tmp/path-deploy/prod/` will also record the captured restore-point snapshot identifier for `nwac-prod-db`.
