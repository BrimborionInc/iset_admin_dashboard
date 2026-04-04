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
