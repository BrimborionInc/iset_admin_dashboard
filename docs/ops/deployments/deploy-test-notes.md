# Test Environment Deployment Notes

For the shortest operator commands, start with `docs/ops/deployments/deployment-quick-guide.md`.

## One-command deploy (recommended)

Run the PATH orchestrator from `X:\ISET\admin-dashboard`:

```powershell
npm run path:deploy -- --env test --dataset intake-release --workflow-id 21
```

What it does:
- Verifies the TEST AWS identity/profile before doing anything
- Plans/applies canonical shared-schema migrations through SSM on a TEST app host
- Optionally promotes an allowlisted config dataset from DEV (`intake-release` shown above)
- Runs the existing admin and portal TEST app deploy scripts
- Verifies TEST health through the ALB target groups (`nwac-test-admin-tg`, `nwac-test-portal-tg`)
- Writes a release manifest under `tmp/path-deploy/test/`

For a non-destructive preflight first:

```powershell
npm run path:deploy:plan -- --env test --dataset intake-release --workflow-id 21
```

If you only need the legacy component rollout primitives:

```powershell
npm run deploy-admin-to-test -- -AwsProfile nwac-test
cd X:\ISET\ISET-intake
npm run deploy-portal-to-test -- -AwsProfile nwac-test
```

## Feature-Flagged Portal Runtime Changes

For portal-only changes guarded by a runtime flag, use a portal-only app rollout first, then flip the TEST runtime row after the deploy is healthy.

Deploy the portal code:

```powershell
cd X:\ISET\admin-dashboard
npm run path:deploy -- --env test --skip-schema --skip-data --skip-admin --release-id intake-draft-autosave-test
```

Enable the flag after smoke passes:

```bash
cd /mnt/x/ISET/admin-dashboard
scripts/run-test-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
```

Rollback is the same helper with `{\"enabled\": false}`.

## Manual fall-back (legacy process)

These steps are kept for reference in case you ever need to perform the deployment by hand.

1. Build with test variables  
   `npm run build:test`
2. Package the artefact (build/, isetadminserver.js, package.json, package-lock.json, .env.test) using `Compress-Archive`
3. Upload the zip to `s3://nwac-test-artifacts/admin-dashboard/` (or presign it)
4. Craft an SSM `AWS-RunShellScript` payload that downloads the zip, copies the files into place, installs dependencies, and restarts PM2
5. Execute `aws ssm send-command` against each instance in the fleet and poll until the status is `Success`
6. Perform a quick smoke test and clean up the temporary zip once verified

> **Reminder:** Avoid the legacy `deploy.ps1` workflow; use `path:deploy` for the supported PATH flow, or the component scripts/manual SSM path only as a lower-level fallback.
