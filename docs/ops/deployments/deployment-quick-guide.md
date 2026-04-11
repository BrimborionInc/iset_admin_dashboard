# PATH Deployment Quick Guide

This is the shortest operator guide for normal PATH deployments.

Work from:

```powershell
cd X:\ISET\admin-dashboard
```

## Rules

- Do not dump the DEV database manually before asking Codex to deploy.
- Use `path:deploy` for normal releases.
- Use `test:db:refresh` only when you want to reset TEST.
- PROD deploys require `--yes`.
- TEST deploys require `--yes` only when you include `--refresh-test-db`.
- Deploys do not auto-bump `package.json` semver; instead, each frontend build now carries a visible release/build stamp.

## Most Common Commands

### 1. Deploy current code to TEST

```powershell
npm run path:deploy -- --env test --dataset intake-release --workflow-id 21
```

Use this when:
- you want to deploy app/config/schema changes to TEST
- you do not want to wipe TEST data first

### 2. Reset TEST from the current DEV baseline, then deploy

```powershell
npm run path:deploy -- --env test --refresh-test-db --dataset intake-release --workflow-id 21 --yes
```

Use this when:
- TEST data can be thrown away
- you want a clean TEST environment
- you want Codex to handle the snapshot generation automatically

What this does:
- builds a DEV-derived TEST baseline snapshot automatically
- restores TEST
- applies canonical schema work
- applies the allowlisted intake release dataset
- deploys admin + portal
- runs TEST smoke checks

### 3. Deploy to PROD

```powershell
npm run path:deploy -- --env prod --dataset intake-release --workflow-id 21 --yes
```

Use this when:
- the change has already been validated in TEST
- you want the normal safe prod path

What this does:
- verifies AWS prod identity
- captures a prod DB restore point if DB mutation is planned
- applies canonical schema work
- applies allowlisted config/data only
- deploys artifacts
- waits for prod refresh
- runs prod smoke checks

## Feature-Flagged Portal Changes

Use this pattern when a portal behavior change is guarded by a runtime flag such as `iset_runtime_config(scope='runtime', k='intake.draft_autosave')`.

### TEST

Deploy the portal code first, without unrelated schema/data/admin work:

```powershell
npm run path:deploy -- --env test --skip-schema --skip-data --skip-admin --release-id intake-draft-autosave-test
```

Then enable the runtime flag in TEST:

```bash
cd /mnt/x/ISET/admin-dashboard
scripts/run-test-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
```

### PROD

Deploy the code first with the flag still absent or `false`, let the rollout finish, and only then enable the flag:

```powershell
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-admin --release-id intake-draft-autosave-prod --yes
```

After prod smoke passes, enable the flag:

```bash
cd /mnt/x/ISET/admin-dashboard
scripts/run-prod-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
```

Why this sequence matters:
- The portal uses a separate endpoint, `POST /api/draft/autosave`, so a new client talking to an old server during rollout fails harmlessly.
- Enabling the flag only after the app rollout avoids mixed-fleet behavior for in-flight applicants.
- Rollback is simple: set the same runtime row to `{\"enabled\": false}` without redeploying.

If the feature is already enabled in the target environment, set it to `false` before starting the app rollout, then re-enable it after smoke passes.

## Safe Preflight Commands

Plan TEST:

```powershell
npm run path:deploy:plan -- --env test --dataset intake-release --workflow-id 21
```

Plan TEST reset + deploy:

```powershell
npm run path:deploy:plan -- --env test --refresh-test-db --dataset intake-release --workflow-id 21
```

Plan PROD:

```powershell
npm run path:deploy:plan -- --env prod --dataset intake-release --workflow-id 21
```

Smoke only:

```powershell
npm run path:deploy:smoke -- --env test
npm run path:deploy:smoke -- --env prod
```

## Planned Maintenance Warning

Set a warning before a planned deploy:

```powershell
npm run path:maintenance -- set --env test --start-in 5m --expected-duration 20m
npm run path:maintenance -- set --env prod --start-in 5m --expected-duration 20m --yes
```

Use this when:
- you want the admin console and public portal to show a global maintenance warning before the cutover
- a 2 to 5 minute lead time is acceptable

For unscheduled work that is already starting:

```powershell
npm run path:maintenance -- set --env test --start-now --expected-duration 20m --unscheduled
npm run path:maintenance -- set --env prod --start-now --expected-duration 20m --unscheduled --yes
```

Clear the warning after smoke passes:

```powershell
npm run path:maintenance -- clear --env test
npm run path:maintenance -- clear --env prod --yes
```

Notes:
- The warning is driven by `iset_runtime_config(scope='runtime', k='service.announcement')`.
- Admin and portal clients poll every 15 seconds and render the countdown locally, so this is an operator warning tool, not a precise sub-minute push channel.
- If the service must be fully unavailable during cutover, the warning can be combined with the separate ALB `503` maintenance fallback.

## Hard Maintenance Page

If you want users to see a deliberate maintenance page instead of a generic browser error while the app is unavailable:

```powershell
npm run path:maintenance:fallback -- set --env test --surfaces all
npm run path:maintenance:fallback -- clear --env test --surfaces all
npm run path:maintenance:fallback -- set --env prod --surfaces all --yes
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
```

Notes:
- This changes the HTTPS ALB host rules in place for the selected admin/portal hostnames.
- The ALB returns a static HTML `503` page during the cutover.
- `clear` restores the normal admin and portal target-group forwarding.
- You can scope it to `admin`, `portal`, or `all` with `--surfaces`.

## TEST Reset Only

If you want to reset TEST without doing an app deploy:

```powershell
npm run test:db:refresh -- --source-env dev --yes
```

Preflight only:

```powershell
npm run test:db:refresh:plan -- --source-env dev
```

## What Moves Between Environments

- `TEST` may be reset or overwritten.
- `PROD` must not be overwritten from DEV or TEST.
- `PROD` only receives:
  - canonical schema migrations
  - allowlisted config/reference promotion

The TEST baseline built from DEV is not a raw copy of DEV data. It contains:
- full schema
- safe/reference data
- the published intake runtime row

It does not contain:
- applicant/client/case data
- messages
- payments
- identity-link rows

## If Something Fails

- TEST: fix forward or reset TEST and rerun.
- PROD app issue: rollback the app release, not the database, unless there is an explicit maintenance decision.
- Check the local manifest written under:

```text
tmp/path-deploy/<env>/
```

## How To Verify The Deployed Release

- Admin console: check the subtle version line at the bottom of the landing page.
- Public portal: open the Help page and check the version line near the bottom.
- The line shows the package version plus the deploy release ID and git SHA when available.

## How To Ask Codex

Use plain instructions like:

- `Deploy PATH to test.`
- `Reset test from dev and deploy PATH.`
- `Plan the prod deployment.`
- `Deploy PATH to prod.`
