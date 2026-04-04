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
