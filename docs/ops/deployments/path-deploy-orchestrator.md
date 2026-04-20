# PATH Deploy Orchestrator

Start with the short operator runbook in `docs/ops/deployments/deployment-quick-guide.md` if you just need the normal commands.

The PATH deployment control plane now lives in `admin-dashboard` and is operated through `scripts/path-deploy.js`.

Deployed admin environments now force `DISABLE_AUTO_MIGRATIONS=true`, so this explicit deploy path is the intended schema-ownership path for TEST/PROD.

Operator runtime caveat: in the current Codex sandbox, `npm` package scripts execute under Windows Node while the trusted operator AWS profiles live in the bash/WSL-side AWS CLI config. The control-plane scripts intentionally shell AWS-backed checks through `bash` so `nwac-test` / `nwac-prod` resolve consistently.
For prod app rollout, the control plane now also exports credentials from the working bash-side profile into the Windows-side PowerShell deploy subprocesses before running the shared/admin/portal upload scripts and the ASG refresh.

Use this from `X:\ISET\admin-dashboard` so one command can sequence:

1. AWS/profile preflight
2. prod restore point capture when DB mutation is planned
3. canonical shared-schema migration preflight/apply
4. optional allowlisted data/config promotion
5. app deployment primitives
6. environment-appropriate smoke checks
7. release-manifest capture under `tmp/path-deploy/`

## Commands

Plan a TEST deployment:

```powershell
npm run path:deploy:plan -- --env test --dataset intake-release --workflow-id 21
```

Run a TEST deployment:

```powershell
npm run path:deploy -- --env test --dataset intake-release --workflow-id 21
```

Run a TEST deployment that also rebuilds TEST from the current DEV baseline first:

```powershell
npm run path:deploy -- --env test --refresh-test-db --dataset intake-release --workflow-id 21 --yes
```

Plan a PROD deployment:

```powershell
npm run path:deploy:plan -- --env prod --dataset intake-release --workflow-id 21
```

Run a PROD deployment:

```powershell
npm run path:deploy -- --env prod --dataset intake-release --workflow-id 21 --yes
```

Run smoke checks only:

```powershell
npm run path:deploy:smoke -- --env test
npm run path:deploy:smoke -- --env prod
```

## Maintenance announcements

The deploy control plane now has a companion operator command for scoped admin and/or portal maintenance warnings:

```powershell
npm run path:maintenance -- set --env test --surfaces admin --start-in 5m --expected-duration 20m
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

For the hard maintenance page itself, use the separate ALB helper:

```powershell
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
5. Clear the warning after smoke passes.
6. Clear the ALB fixed-response maintenance page if you enabled it.

Guidance:
- Size `--expected-duration` to the likely user-facing interruption window, not the total operator runtime of the release.
- For normal rolling releases, prefer no banner or a short `brief interruptions possible` warning and keep the ALB `503` fallback as contingency only.
- For admin-only or portal-only hotfixes, prefer a scoped announcement instead of a global banner so unaffected users are not warned unnecessarily.

## Feature-Flagged Portal Rollouts

Some portal changes are intentionally deployed behind runtime flags. The current example is draft autosave via `iset_runtime_config(scope='runtime', k='intake.draft_autosave')`.

Use this pattern:

1. Deploy the portal code first.
2. Leave the runtime flag absent or set to `false` during the rollout.
3. Wait for deploy/smoke to finish.
4. Flip the runtime flag to `true` with the environment SQL helper.

Suggested portal-only deploy commands:

```powershell
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
  - App rollout still uses the existing in-place SSM deploy scripts for admin and portal.
  - The frontend bundles now carry a visible build stamp derived from package version + release ID + git SHA. Check the admin landing-page footer or the public portal Help page after deploy.
  - Smoke uses ALB target-group health (`nwac-test-admin-tg`, `nwac-test-portal-tg`) instead of public `/healthz`, because the public TEST hosts are fronted by ALB/Nginx auth and currently return `403` to unauthenticated requests from Codex.
  - Standalone full TEST reset still exists through `npm run test:db:refresh`, but the normal Codex-operated path can now generate a DEV-derived baseline snapshot automatically with `--source-env dev`.
  - The generated DEV-derived baseline snapshot contains full schema, allowlisted safe/reference data, and only `iset_runtime_config(scope='publish', k='workflow.schema.intake')`; applicant, case, message, payment, and identity-link data are excluded by design.

- `prod`
  - Uses AWS profile `nwac-prod` by default in the Codex/operator control plane.
  - Captures an Aurora cluster snapshot restore point automatically when the planned run will apply canonical schema changes or allowlisted data promotion.
  - Runs canonical schema work remotely through SSM on a PROD app host.
  - Optional config/data promotion uses `scripts/path-data-sync.js`.
  - App rollout uploads `shared`, `admin`, and `portal` artifacts, then waits for `refresh-prod`.
  - The frontend bundles now carry a visible build stamp derived from package version + release ID + git SHA. Check the admin landing-page footer or the public portal Help page after deploy.
  - Smoke currently uses public `/healthz` URLs (`nwac-console.awentech.ca`, `iset.nwac.ca`, `nwac-public.awentech.ca`).
  - `scripts/run-prod-sql-via-ssm.sh` currently reads DB credentials from `nwac-prod-db-credentials`, but supplies the prod cluster host/database/port itself because that secret currently contains only `username` and `password`.

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
  - `npm run test:db:refresh -- --snapshot-file X:\path\to\scrubbed.sql --yes`

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
