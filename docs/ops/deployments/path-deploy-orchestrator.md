# PATH Deploy Orchestrator

Status: current deployment control-plane reference.
Last reviewed: 2026-05-25 after adding the PROD bug/CR feedback reconciliation closeout gate; command names checked against current `package.json`.

Start with the short operator runbook in `docs/ops/deployments/deployment-quick-guide.md` if you just need the normal commands.

The PATH deployment control plane now lives in `admin-dashboard` and is operated through `scripts/path-deploy.js`.

Deployed admin environments now force `DISABLE_AUTO_MIGRATIONS=true`, so this explicit deploy path is the intended schema-ownership path for TEST/PROD.

Operator runtime caveat: in the current Codex sandbox, the trusted operator AWS profiles live in the bash/WSL-side AWS CLI config. The control-plane scripts intentionally shell AWS-backed checks through `bash` so `nwac-test` / `nwac-prod` resolve consistently. `nwac-prod` is now a reduced assumed-role profile and `default` is only a bootstrap IAM user, so direct prod resource calls through `default` are expected to fail.
TEST app rollout is WSL-native in `scripts/path-deploy.js`: it builds/packages the WSL admin repo, sibling portal repo, and sibling shared tree, uploads artifacts with WSL AWS CLI, and runs the in-place SSM update commands directly. Do not route TEST deploys through stale Windows checkout instructions.
PROD app rollout is also WSL-native in `scripts/path-deploy.js`: it uploads `shared/shared-latest.zip`, `admin/admin-dashboard-latest.zip`, and `portal/portal-latest.zip` to `nwac-prod-artifacts`, then starts and waits for the PROD ASG refresh.

Use this from the WSL admin repo:

```bash
cd /home/bill/ISET/admin-dashboard
```

The orchestrator packages the WSL working tree for TEST and PROD app deploys. If `/mnt/x/ISET` still exists, treat it as stale/archive-only unless a task explicitly asks to inspect it.

The admin artifact also stages selected operational support scripts used by deployed-runtime checks/backfills, currently the application-assessment backfill, context-backfill, and Option B smoke scripts referenced by package aliases.

1. AWS/profile preflight
2. prod restore point capture when DB mutation is planned
3. canonical shared-schema migration preflight/apply
4. optional allowlisted data/config promotion
5. app deployment primitives
6. environment-appropriate smoke checks
7. release-manifest capture under `tmp/path-deploy/`

## Commands

Plan a TEST deployment:

```bash
npm run path:deploy:plan -- --env test --dataset intake-release --workflow-id 21
```

Run a TEST deployment:

```bash
npm run path:deploy -- --env test --dataset intake-release --workflow-id 21
```

Run a TEST deployment that also rebuilds TEST from the current DEV baseline first:

```bash
npm run path:deploy -- --env test --refresh-test-db --dataset intake-release --workflow-id 21 --yes
```

Plan a PROD deployment:

```bash
npm run path:deploy:plan -- --env prod --dataset intake-release --workflow-id 21
```

Run a PROD deployment:

```bash
npm run path:deploy -- --env prod --dataset intake-release --workflow-id 21 --yes
```

Run smoke checks only:

```bash
npm run path:deploy:smoke -- --env test
npm run path:deploy:smoke -- --env prod
```

## Maintenance announcements

The deploy control plane now has a companion operator command for scoped admin and/or portal maintenance warnings:

```bash
npm run path:maintenance -- set --env test --surfaces admin --start-in 5m --expected-duration 20m --title "Test and Training maintenance" --message "The Test and Training environment is temporarily unavailable for maintenance. Production is not affected."
npm run path:maintenance -- set --env test --surfaces portal --start-in 5m --expected-duration 20m
npm run path:maintenance -- set --env test --surfaces all --start-in 5m --expected-duration 20m
npm run path:maintenance -- set --env prod --surfaces admin --start-in 5m --expected-duration 20m --yes
npm run path:maintenance -- set --env prod --surfaces portal --start-in 5m --expected-duration 20m --yes
npm run path:maintenance -- set --env prod --surfaces all --start-in 5m --expected-duration 20m --yes
npm run path:maintenance -- clear --env test --surfaces admin
npm run path:maintenance -- clear --env test --surfaces portal
npm run path:maintenance -- clear --env test
npm run path:maintenance -- clear --env prod --surfaces admin --yes
npm run path:maintenance -- clear --env prod --surfaces portal --yes
npm run path:maintenance -- clear --env prod --yes
```

Current behavior:

- Stores one structured announcement in `iset_runtime_config(scope='runtime', k='service.announcement')`.
- `--surfaces admin|portal|all` controls which shell(s) render the banner, with `all` as the default for backwards compatibility.
- Admin polls `/api/service-announcement/current` and renders the warning in the shell `Flashbar`.
- Portal polls the same endpoint and renders one global GOV.UK notification banner below the shared header.
- Polling runs every 15 seconds with a local 1-second countdown after load, so operators should use a 2 to 5 minute warning window instead of relying on precise sub-minute delivery.
- This command does not currently automate the ALB fixed-response `503` hard-maintenance fallback.
- TEST app rollouts should rehearse PROD user-facing maintenance behavior. Any rollout that restarts app processes, changes target routing, makes a surface unavailable, or can surface transient `502 Bad Gateway` responses needs a scoped warning first or the affected TEST surface behind the ALB fixed-response maintenance page. TEST does not require PROD's `--yes` approval gate for ordinary app deploys, but it should not intentionally show raw 502s while down. TEST maintenance warnings must use the user-facing name `Test and Training environment` and state that Production is not affected.
- PROD app rollouts are user-impacting unless the plan proves otherwise. Any rollout that refreshes ASG instances, restarts app processes, rotates target groups, changes ALB routing, or can surface transient `502 Bad Gateway` responses needs a scoped warning first, even when the change is admin-only, portal-only, or code-only.

For the hard maintenance page itself, use the separate ALB helper:

```bash
npm run path:maintenance:fallback -- status --env test
npm run path:maintenance:fallback -- set --env test --surfaces all
npm run path:maintenance:fallback -- clear --env test --surfaces all
npm run path:maintenance:fallback -- set --env prod --surfaces all --yes
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
```

Current fallback behavior:

- Modifies the selected HTTPS host rules in place for admin and/or portal traffic.
- Returns a static HTML `503` maintenance page from the ALB instead of a generic browser error while the app is unavailable.
- `clear` restores the normal forward-to-target-group behavior.
- Prod mutations require `--yes`.

Recommended planned-maintenance sequence:

1. Set the maintenance warning.
2. Wait through the warning window.
3. If a hard outage is required, enable the ALB fixed-response maintenance page.
4. Run `path:deploy`.
5. For TEST in-place deploys, keep the maintenance page up until the deploy finishes, then clear it and smoke normal routing.
6. For PROD ASG refreshes, do not leave the ALB maintenance page up if the refresh stalls on ELB health with `Target.NotInUse` or `insufficient data`; the fixed response makes the target group unused, so clear the fallback once the refreshed instance is in service and let the in-app warning cover final warm-up.
7. Run smoke with normal routing restored.
8. Clear the warning after normal-routing smoke passes.
9. For PROD bug/CR releases, reconcile the affected live feedback reports after smoke and targeted recheck: update report status, status history, and internal notes before calling the release complete.

Guidance:
- Size `--expected-duration` to the likely user-facing interruption window, not the total operator runtime of the release.
- For normal rolling releases that are proven not to interrupt service, no banner is acceptable. If a TEST or PROD rollout may produce raw 502s or make a surface unavailable, use a short `brief interruptions possible` warning or the ALB `503` fallback before starting.
- For admin-only or portal-only hotfixes, prefer a scoped announcement instead of a global banner so unaffected users are not warned unnecessarily.
- For bug/CR work, a prepared fix is not automatically a PROD hotfix. Batch suitable fixes into the next planned PROD maintenance release unless Bill explicitly approves emergency hotfix handling.
- Do not assume "hotfix", "code-only", or "admin-only" means "no user impact". The deciding factor is the rollout primitive. ASG refresh, app restart, target-group change, or known transient gateway risk requires warning/fallback handling; in PROD this also requires the explicit prod approval gates.
- If `path:deploy` reports a smoke `503` immediately after a PROD fallback clear but ASG refresh is `Successful`, confirm fallback status and rerun smoke before declaring the release failed; ALB rule propagation can lag the deploy command by a few seconds.

## Feature-Flagged Portal Rollouts

Some portal changes are intentionally deployed behind runtime flags. The current example is draft autosave via `iset_runtime_config(scope='runtime', k='intake.draft_autosave')`.

Use this pattern:

1. Deploy the portal code first.
2. Leave the runtime flag absent or set to `false` during the rollout.
3. Wait for deploy/smoke to finish.
4. Flip the runtime flag to `true` with the environment SQL helper.

Suggested portal-only deploy commands:

```bash
npm run path:deploy -- --env test --skip-schema --skip-data --skip-admin --release-id intake-draft-autosave-test
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-admin --release-id intake-draft-autosave-prod --yes
```

Then enable the flag with:

```bash
scripts/run-test-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
scripts/run-prod-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
```

Current autosave rollout note:
- The portal uses a separate endpoint, `POST /api/draft/autosave`, so mixed old/new app instances fail safe while the flag is still off.
- If you need to back out after rollout, first set the runtime row to `{\"enabled\": false}`. That disables autosave without another code deploy.

## Current behavior

- `test`
  - Uses AWS profile `nwac-test` by default.
  - Optional `--refresh-test-db` now makes TEST reset a first-class deploy step instead of a separate manual prerequisite.
  - Runs canonical schema work remotely through SSM on a TEST app host.
  - Optional config/data promotion uses `scripts/path-data-sync.js`.
  - App rollout uses WSL-native build/package/upload/SSM steps in `scripts/path-deploy.js` for admin and portal instead of the legacy PowerShell component scripts.
  - Current runtime-install safeguard: the TEST admin/portal deploy scripts now remove the deployed `node_modules` tree before remote `npm ci/install`, matching the existing PROD bootstrap rule, so stale instance filesystems do not break a rerun with `ENOTEMPTY`.
  - The frontend bundles now carry a visible build stamp derived from package version + release ID + git SHA. Check the admin landing-page footer or the public portal Help page after deploy.
  - Smoke uses ALB target-group health (`nwac-test-admin-tg`, `nwac-test-portal-tg`) instead of public `/healthz`, because the public TEST hosts are fronted by ALB/Nginx auth and currently return `403` to unauthenticated requests from Codex.
  - Standalone full TEST reset still exists through `npm run test:db:refresh`, but the normal Codex-operated path can now generate a DEV-derived baseline snapshot automatically with `--source-env dev`.
  - The generated DEV-derived baseline snapshot contains full schema, allowlisted safe/reference data, and only `iset_runtime_config(scope='publish', k='workflow.schema.intake')`; applicant, case, message, payment, and identity-link data are excluded by design.

- `prod`
  - Uses AWS profile `nwac-prod` by default in the Codex/operator control plane.
  - `nwac-prod` now resolves to the reduced role `nwac-prod-codex-operator`; it covers `path:deploy`, prod SQL/dump helpers via SSM, ASG refresh, automatic prod restore-point capture, and the ALB `path-maintenance-fallback` flow, but not broader infra/admin operations such as WAF changes, SSM env parameter writes, uploads-bucket CORS changes, or Terraform/ACM changes.
  - Captures an Aurora cluster snapshot restore point automatically when the planned run will apply canonical schema changes or allowlisted data promotion.
  - If that restore-point step ever fails again, only rerun with `--skip-schema --skip-data` when you have direct proof that no schema/data delta remains. Example from 2026-04-24: DEV and PROD checksums for workflow `21` plus `publish/workflow.schema.intake` were identical, so an app-only rerun was safe. Follow-up validation from 2026-04-25: after the IAM policy update, release `20260425-100201` captured restore point `path-prod-20260425-100201-20260425100220` successfully under the normal full prod path.
  - Runs canonical schema work remotely through SSM on a PROD app host.
  - Optional config/data promotion uses `scripts/path-data-sync.js`.
  - App rollout uses WSL-native build/package/upload steps in `scripts/path-deploy.js`: `shared/shared-latest.zip`, `admin/admin-dashboard-latest.zip`, and `portal/portal-latest.zip` are uploaded to `nwac-prod-artifacts`, then `nwac-prod-asg` is refreshed with `MinHealthyPercentage=100,InstanceWarmup=180,SkipMatching=false`.
  - WSL-native PROD validation: release `20260507-prod-contact-retirement` captured restore point `path-prod-20260507-prod-contact-retirement-20260508000234`, uploaded all three artifacts, completed ASG refresh `f323cb21-bc0c-4063-b0e8-017b40f31544` on replacement instance `i-00b00ebdff3f55dc5`, and passed final public smoke.
  - The boot-time app bootstrap already removes deployed `node_modules` before reinstalling runtime dependencies; keep any future prod in-place helper aligned with that rule.
  - The frontend bundles now carry a visible build stamp derived from package version + release ID + git SHA. Check the admin landing-page footer or the public portal Help page after deploy.
  - Smoke currently uses public `/healthz` URLs (`nwac-console.awentech.ca`, `iset.nwac.ca`, `nwac-public.awentech.ca`).
  - `scripts/run-prod-sql-via-ssm.sh` currently reads DB credentials from `nwac-prod-db-credentials`, but supplies the prod cluster host/database/port itself because that secret currently contains only `username` and `password`.
  - `scripts/run-db-dump-via-ssm.sh` now uses `aws configure export-credentials`, so assumed-role profiles such as `nwac-prod` also work for prod dump capture.

## Key flags

- `--env test|prod`
- `--release-id <label>`
- `--profile <aws-profile>`
- `--region ca-central-1`
- `--dataset <allowlisted-dataset>`
- `--workflow-id <id>`
- `--refresh-test-db`
- `--source-env-file <path>`
- `--skip-schema`
- `--skip-data`
- `--skip-admin`
- `--skip-portal`
- `--skip-shared`
- `--skip-build`
- `--skip-smoke`
- `--yes`

## Related commands

- Canonical schema:
  - `npm run db:migrate:plan -- --target-env test`
  - `npm run db:migrate:apply -- --target-env prod --yes`

- Allowlisted config/data promotion:
  - `npm run data:sync:plan -- --dataset intake-release --workflow-id 21 --target-env test`
  - `npm run data:sync:apply -- --dataset intake-release --workflow-id 21 --target-env prod --yes`

- TEST DB reset:
  - `npm run test:db:refresh:plan -- --source-env dev`
  - `npm run test:db:refresh -- --source-env dev --yes`
  - `npm run test:db:refresh -- --snapshot-file /path/to/scrubbed.sql --yes`

## Release manifests

Each `plan` or `run` command writes a manifest JSON file under:

```text
tmp/path-deploy/<env>/<release-id>--<timestamp>.json
```

The manifest records:

- release ID
- environment/profile/region
- AWS identity used
- admin/portal/shared repo heads
- schema plan/apply result
- data-sync plan/apply result
- prod restore-point plan/capture result
- app deploy selection
- smoke results
- rollback guidance

`tmp/` is ignored by Git, so these manifests are local operator artifacts.

Release manifests do not update the in-app feedback queue. When a PROD release includes bug/CR report fixes, the operator must still update the live `admin_feedback_report`, `admin_feedback_status_history`, and `admin_feedback_note` rows after the deployed behavior is verified.
