# Test Environment Deployment Notes

Status: current TEST deployment notes. Prefer `deployment-quick-guide.md` for the shortest operator commands.
Last reviewed: 2026-06-08 after TEST cost-pruning; command names checked against current admin and portal `package.json` files.

For the shortest operator commands, start with `docs/ops/deployments/deployment-quick-guide.md`.

## One-command deploy (recommended)

Run the PATH orchestrator from the WSL admin repo:

```bash
cd /home/bill/ISET/admin-dashboard
npm run path:deploy -- --env test --skip-data --release-id <release-id>
```

This recommended command is app/schema-only. Runtime configuration and allowlisted data promotion are separate scope; include `--dataset intake-release --workflow-id 21` only when Bill explicitly confirms that the TEST run should promote workflow authoring plus the global published intake runtime row.

The TEST app rollout is WSL-native. It builds/packages `/home/bill/ISET/admin-dashboard`, `/home/bill/ISET/ISET-intake`, and `/home/bill/ISET/shared`, uploads the artifacts with the WSL AWS CLI, then runs the in-place SSM update commands. Do not use stale `X:\ISET` or `/mnt/x/ISET` guidance for TEST.

Current TEST topology: TEST is cost-pruned to one steady-state `nwac-test-asg` app instance in `ca-central-1d` and one NAT gateway. The ALB remains on two public subnets. `path:deploy` discovers the healthy ASG host(s) at runtime, and target-group smoke should be read as "all registered targets are healthy"; today that normally means one admin target and one portal target.

Important: the deploy scripts package the current WSL working tree, not just the Git index. If you only want to release a subset of local edits, isolate unrelated local changes before running `path:deploy`.

Important coupling rule: do not assume `admin-only` just because the user-facing behavior is in the admin console. The admin backend stages sibling `../shared` during the TEST admin deploy, and some admin runtime paths also import sibling `../ISET-intake` modules from the deployed portal tree. If the changed code path touches either of those sibling locations, deploy the coupled surface as well instead of using `--skip-portal`.

Important maintenance rule: TEST should rehearse PROD maintenance behavior. If a TEST deploy can restart the admin or portal app, make either surface unavailable, or expose transient `502 Bad Gateway` responses, set a scoped maintenance warning before the deploy or put the affected surface behind the ALB fixed-response maintenance page. TEST can remain less strict than PROD about approval flags, but it should not intentionally show raw gateway errors while down. TEST maintenance messages must use the user-facing name `Test and Training environment` and explicitly state that Production is not affected.

Important release-note rule: before any TEST app deploy with user-visible changes, create the newest release package in `docs/meta/next-release-notes-log.md` draft sections, not only the dated working-log entries. The first English and French package groups must describe the release being deployed and the generated `src/generated/publicReleaseNotes.js` must show that package first. If the generated release ID is current but the first package title is older, stop before `path:deploy`; the landing page will otherwise show stale release notes.

What it does:
- Verifies the TEST AWS identity/profile before doing anything
- Plans/applies canonical shared-schema migrations through SSM on a TEST app host
- Optionally promotes an allowlisted config dataset from DEV only when `--dataset` is explicitly included
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
npm run path:deploy:plan -- --env test --skip-data
```

## Recent deploy evidence

- 2026-06-18: Full admin + portal TEST release `20260618-test-financial-overview-editable` used the runbook sequence `warning -> wait -> ALB fallback -> deploy --skip-smoke -> clear fallback -> normal-routing smoke -> clear warning`. Flags: `--skip-data --release-id 20260618-test-financial-overview-editable`; TEST DB refresh was not requested, schema pending count was `0`, and no dataset/runtime/config/intake data promotion ran. TEST AWS identity was `arn:aws:iam::124355655255:user/CODEX_CLI_Admin`. Admin artifact `s3://nwac-test-artifacts/admin-dashboard/admin-dashboard-20260618-164719.zip` and portal artifact `s3://nwac-test-artifacts/portal/portal-20260618-165540.zip` installed on the cost-pruned single TEST app host `i-0a8be782ed8604211`; final normal-routing smoke reported `nwac-test-admin-tg` healthy on `i-0a8be782ed8604211:5001` and `nwac-test-portal-tg` healthy on `i-0a8be782ed8604211:5000`. ALB fallback returned to normal forwarding for both hostnames and SQL-over-SSM reported `service_announcement_rows = 0`. Deployed-source SSM check `e70de8bb-6d78-4742-9a70-3a182c481fe7` confirmed `fundingOverviewMode` in `/opt/nwac/admin-dashboard/isetadminserver.js`, `finalizeFundingOverviewSigningSubmission` in `/opt/nwac/portal/server.js`, shared `buildFinancialOverviewInitialValues`, shared `FINANCIAL_OVERVIEW_SUBMISSION_KEYS`, intake-style `per month` field copy in `/opt/nwac/shared/financialOverview.js`, and release id `20260618-test-financial-overview-editable` in both admin and portal build info. Manifest: `/home/bill/ISET/admin-dashboard/tmp/path-deploy/test/20260618-test-financial-overview-editable--2026-06-18T20-46-46-070Z.json`.
- 2026-06-13: Corrective admin-only TEST redeploy for release notes on release `20260612-212548` used the runbook sequence `admin warning -> wait -> admin ALB fallback -> admin-only deploy -> clear fallback -> normal-routing admin smoke -> clear warning`. Flags: `--skip-schema --skip-data --skip-portal --skip-shared --release-id 20260612-212548`. Admin artifact `s3://nwac-test-artifacts/admin-dashboard/admin-dashboard-20260612-210450.zip` installed on the cost-pruned single TEST app host `i-0a8be782ed8604211`; final normal-routing smoke reported `nwac-test-admin-tg` healthy on `i-0a8be782ed8604211:5001`; maintenance fallback returned to normal forwarding and `service.announcement` rows returned to 0. Deployed bundle check on `/opt/nwac/admin-dashboard/build/static/js/main.95d54324.js` confirmed `Release 20260612-212548` appears before `Release 20260610-prod-modify-component-editor` and includes `System Administrators can reopen a closed action plan`. Manifest: `/home/bill/ISET/admin-dashboard/tmp/path-deploy/test/20260612-212548--2026-06-13T01-04-50-045Z.json`.
- 2026-06-12: Full admin + portal TEST release `20260612-212548` used the runbook sequence `warning -> wait -> ALB fallback -> deploy -> clear fallback -> normal-routing smoke -> clear warning`. Flags: `--dataset intake-release --workflow-id 21`; TEST DB refresh was not requested and schema pending count was 0. Admin artifact `s3://nwac-test-artifacts/admin-dashboard/admin-dashboard-20260612-173320.zip` and portal artifact `s3://nwac-test-artifacts/portal/portal-20260612-173654.zip` installed on the cost-pruned single TEST app host `i-0a8be782ed8604211`; final normal-routing smoke reported `nwac-test-admin-tg` healthy on `i-0a8be782ed8604211:5001` and `nwac-test-portal-tg` healthy on `i-0a8be782ed8604211:5000`. Manifest: `/home/bill/ISET/admin-dashboard/tmp/path-deploy/test/20260612-212548--2026-06-12T21-32-40-718Z.json`.
- 2026-06-10: Admin-only TEST release `20260610-test-application-workspace-review` used the runbook sequence `warning -> wait -> ALB fallback -> admin-only deploy -> clear fallback -> normal-routing smoke -> clear warning`. Flags: `--skip-schema --skip-data --skip-portal --skip-shared`. Admin artifact `s3://nwac-test-artifacts/admin-dashboard/admin-dashboard-20260610-144955.zip` installed on the cost-pruned single TEST app host `i-0a8be782ed8604211`; final normal-routing smoke reported `nwac-test-admin-tg` healthy on `i-0a8be782ed8604211:5001`. Manifest: `/home/bill/ISET/admin-dashboard/tmp/path-deploy/test/20260610-test-application-workspace-review--2026-06-10T18-49-55-076Z.json`.
- 2026-06-08 post-prune verification: `npm run path:deploy:smoke -- --env test --json` reported `nwac-test-admin-tg` healthy on `i-0a8be782ed8604211:5001` and `nwac-test-portal-tg` healthy on `i-0a8be782ed8604211:5000`. This is the expected one-host TEST shape.
- 2026-06-08 topology note: after TEST cost-pruning, current target-group smoke is expected to show one registered admin target and one registered portal target when the ASG is at its normal size.
- 2026-06-07: Admin-only TEST release `20260607-test-tutorials-training-shorts` deployed from isolated worktree `/home/bill/ISET/admin-dashboard-test-deploy-tutorials-20260607` so unrelated dirty files in the main checkout were not packaged. Sequence: `warning -> wait -> ALB fallback -> admin-only deploy -> clear fallback -> normal-routing smoke -> clear warning`. Flags: `--skip-schema --skip-data --skip-portal --skip-shared`. Normal-routing smoke after fallback clear reported both `nwac-test-admin-tg` targets healthy on port `5001` under the pre-prune two-instance TEST shape. Manifest: `/home/bill/ISET/admin-dashboard/tmp/path-deploy/test/20260607-test-tutorials-training-shorts--2026-06-07T16-54-17-110Z.json`.

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
5. Execute `aws ssm send-command` against the current healthy ASG/SSM app host(s) and poll until the status is `Success`
6. Perform a quick smoke test and clean up the temporary zip once verified

> **Reminder:** Avoid the legacy `deploy.ps1` workflow; use `path:deploy` for the supported PATH flow, or the component scripts/manual SSM path only as a lower-level fallback.
