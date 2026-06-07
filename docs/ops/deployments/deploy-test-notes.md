# Test Environment Deployment Notes

Status: current TEST deployment notes. Prefer `deployment-quick-guide.md` for the shortest operator commands.
Last reviewed: 2026-05-07 after WSL TEST deploy runner migration; command names checked against current admin and portal `package.json` files.

For the shortest operator commands, start with `docs/ops/deployments/deployment-quick-guide.md`.

## One-command deploy (recommended)

Run the PATH orchestrator from the WSL admin repo:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:deploy -- --env test --dataset intake-release --workflow-id 21
```

The TEST app rollout is WSL-native. It builds/packages `/home/bill/ISET/admin-dashboard`, `/home/bill/ISET/ISET-intake`, and `/home/bill/ISET/shared`, uploads the artifacts with the WSL AWS CLI, then runs the in-place SSM update commands. Do not use stale `X:\ISET` or `/mnt/x/ISET` guidance for TEST.

Important: the deploy scripts package the current WSL working tree, not just the Git index. If you only want to release a subset of local edits, isolate unrelated local changes before running `path:deploy`.

Important coupling rule: do not assume `admin-only` just because the user-facing behavior is in the admin console. The admin backend stages sibling `../shared` during the TEST admin deploy, and some admin runtime paths also import sibling `../ISET-intake` modules from the deployed portal tree. If the changed code path touches either of those sibling locations, deploy the coupled surface as well instead of using `--skip-portal`.

Important maintenance rule: TEST should rehearse PROD maintenance behavior. If a TEST deploy can restart the admin or portal app, make either surface unavailable, or expose transient `502 Bad Gateway` responses, set a scoped maintenance warning before the deploy or put the affected surface behind the ALB fixed-response maintenance page. TEST can remain less strict than PROD about approval flags, but it should not intentionally show raw gateway errors while down. TEST maintenance messages must use the user-facing name `Test and Training environment` and explicitly state that Production is not affected.

What it does:
- Verifies the TEST AWS identity/profile before doing anything
- Plans/applies canonical shared-schema migrations through SSM on a TEST app host
- Optionally promotes an allowlisted config dataset from DEV (`intake-release` shown above)
- Runs WSL-native admin and portal TEST app deploy steps from `scripts/path-deploy.js`
- Verifies TEST health through the ALB target groups (`nwac-test-admin-tg`, `nwac-test-portal-tg`)
- Writes a release manifest under `tmp/path-deploy/test/`
- Current dependency-install safeguard: the TEST admin and portal deploy steps clear the deployed `node_modules` tree before running remote `npm ci/install`, mirroring the existing PROD bootstrap behavior and avoiding stale-filesystem `ENOTEMPTY` failures on rerun.

Current SES safety guard:
- Before the PROD-data migration rehearsal, TEST SES was checked in `ca-central-1` and was still sandboxed (`ProductionAccessEnabled=false`), but the TEST account has several verified recipient identities.
- The deployed TEST app env includes an explicit AWS access key for IAM user `SES_backend`, so SES safety cannot be inferred from the EC2 instance role alone.
- Inline IAM policy `DenySesSendDuringProdDataRehearsal` is now attached to both IAM user `SES_backend` and role `nwac-test-app-role`, denying `ses:Send*` on `*`. IAM simulation confirmed `explicitDeny` for `ses:SendEmail`, `ses:SendRawEmail`, templated send, and bulk send actions.
- DEV local `.env` now uses separate IAM user `SES_backend_dev` with SES `SendEmail` / `SendRawEmail` and scoped DEV Cognito permissions. Do not remove the TEST deny from `SES_backend` when DEV email delivery needs to work; rotate or update the DEV-specific credential instead.
- Leave this deny in place while TEST may contain copied PROD data. Remove it only deliberately when email delivery testing is required, then restore it before any further PROD-data rehearsal.

For a non-destructive preflight first:

```bash
npm run path:deploy:plan -- --env test --dataset intake-release --workflow-id 21
```

## Recent deploy evidence

- 2026-06-07: Admin-only TEST release `20260607-test-tutorials-training-shorts` deployed from isolated worktree `/home/bill/ISET/admin-dashboard-test-deploy-tutorials-20260607` so unrelated dirty files in the main checkout were not packaged. Sequence: `warning -> wait -> ALB fallback -> admin-only deploy -> clear fallback -> normal-routing smoke -> clear warning`. Flags: `--skip-schema --skip-data --skip-portal --skip-shared`. Normal-routing smoke after fallback clear reported both `nwac-test-admin-tg` targets healthy on port `5001`. Manifest: `/home/bill/ISET/admin-dashboard/tmp/path-deploy/test/20260607-test-tutorials-training-shorts--2026-06-07T16-54-17-110Z.json`.

If you only need the legacy component rollout primitives:

Do not call the legacy PowerShell component deploy scripts directly from WSL. Windows `npm.cmd` is not reliable from `\\wsl.localhost\...`, and the supported TEST component path is now the Node orchestrator with `--skip-admin` / `--skip-portal` flags as needed.

Use that split form when you have already determined the coupling explicitly:
- admin-only is acceptable only when the changed runtime path stays inside `admin-dashboard` plus any sibling `shared` code staged by the admin artifact
- include the portal deploy whenever the admin runtime path imports `../ISET-intake/*` modules on the server

For a planned admin-only TEST deploy that may briefly interrupt the admin console, use:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:maintenance -- set --env test --surfaces admin --start-in 5m --expected-duration 5m --title "Test and Training maintenance" --message "The Test and Training environment is temporarily unavailable for maintenance. Production is not affected."
npm run path:deploy -- --env test --skip-schema --skip-data --skip-portal --skip-shared --release-id <release-id>
npm run path:maintenance -- clear --env test --surfaces admin
```

Recommended TEST message text: `The Test and Training environment is temporarily unavailable for maintenance. Production is not affected.`

## Feature-Flagged Portal Runtime Changes

For portal-only changes guarded by a runtime flag, use a portal-only app rollout first, then flip the TEST runtime row after the deploy is healthy.

Deploy the portal code:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:deploy -- --env test --skip-schema --skip-data --skip-admin --release-id intake-draft-autosave-test
```

Enable the flag after smoke passes:

```bash
cd /home/bill/ISET/admin-dashboard
bash scripts/run-test-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
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
