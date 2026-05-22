# PATH Deployment Quick Guide

Status: current primary operator guide for normal TEST/PROD PATH deploys.
Last reviewed: 2026-05-08 after WSL-native PROD release `20260507-prod-contact-retirement`; command names checked against current `package.json`.

This is the shortest operator guide for normal PATH deployments.

Work from:

```bash
cd /home/bill/ISET/admin-dashboard
```

Daily coding/Codex work and deployments now happen from the WSL workspace `/home/bill/ISET/path-dev-wsl.code-workspace`. `path:deploy` packages the WSL admin repo plus sibling `ISET-intake` and `shared` trees. TEST rolls out through WSL AWS CLI + SSM; PROD uploads fixed latest artifacts and waits for the PROD ASG refresh. Do not use stale `X:\ISET` or `/mnt/x/ISET` checkout instructions for deploys.

## Rules

- Do not dump the DEV database manually before asking Codex to deploy.
- Use `path:deploy` for normal releases.
- Use `test:db:refresh` only when you want to reset TEST.
- Before every TEST or PROD app deploy, update `docs/meta/next-release-notes-log.md` for user-visible changes. The public landing-page panel must keep the standard sections `What changed`, `Known Bugs`, and `What's Coming`; do not publish `Earlier changes`.
- Under `What changed`, maintain three expandable release-package groups for the three most recent release packages. Add the new release as the first `#### Release ...` group in `What Changed Packages (draft - EN)` and `Lots de changements (brouillon - FR)`, keep only the two next-most-recent groups below it, and remove the oldest fourth group.
- Keep the flat `What's New (draft bullets - EN)` and `Nouveautes (brouillon - FR)` fallback sections focused on the newest release package. `Known Bugs` and `What's Coming` can be empty only when there is nothing accurate to publish.
- Before deploy, run or inspect the generated `src/generated/publicReleaseNotes.js` and confirm it contains `featurePackages` for the three current release packages and does not expose `Earlier changes`.
- In the current Codex sandbox, `nwac-prod` is the standard role-backed prod operator profile. `default` is only the bootstrap IAM user and direct prod resource calls through it are expected to fail.
- The reduced `nwac-prod` role covers normal deploys, prod SQL/dumps via SSM, ASG refresh, automatic prod restore-point snapshots, and the ALB maintenance fallback. It does not cover broader infra/admin work such as WAF changes, SSM env parameter writes, uploads-bucket CORS changes, or Terraform/ACM changes.
- PROD deploys require `--yes`.
- TEST deploys require `--yes` only when you include `--refresh-test-db`.
- Deploys do not auto-bump `package.json` semver; instead, each frontend build now carries a visible release/build stamp.
- TEST app deploys package the current WSL working tree and sibling WSL portal/shared trees. If you mean "deploy only the staged subset," isolate unrelated local edits before running `path:deploy`; the deploy artifact is not limited to the Git index.
- TEST app rollouts should rehearse PROD user-facing maintenance behavior. Any TEST deploy that can restart app processes, make a surface unavailable, or produce transient `502 Bad Gateway` responses needs a scoped warning first and the affected surface behind the ALB maintenance page before deploy starts. TEST remains less strict than PROD because ordinary app deploys do not require `--yes`, but raw 502s are not an acceptable planned TEST experience. TEST maintenance copy must use the user-facing name `Test and Training environment` and explicitly state that Production is not affected.
- PROD app rollouts are user-impacting unless the plan proves otherwise. Any PROD deploy that refreshes ASG instances, restarts app processes, rotates target groups, or can produce transient `502 Bad Gateway` responses needs a scoped warning first and the affected surface behind the ALB maintenance page before deploy starts, even if it is admin-only, portal-only, or code-only.
- Operator checklist rule: before running `path:deploy`, state the exact maintenance sequence. For TEST in-place app rollouts that restart admin or portal, use `warning -> wait -> ALB 503 fallback -> deploy -> clear fallback -> smoke normal routing -> clear warning`. For PROD ASG-refresh rollouts, use the ALB fallback for the cutover risk, but clear it if the instance refresh waits on ELB health with `Target.NotInUse` / `insufficient data`; target groups must be in normal forwarding to become healthy. Do not treat the in-app warning as a substitute for the ALB fallback when target health may drop, but keep the in-app warning active until normal-routing smoke passes.
- Current dependency-reinstall safeguard: in-place TEST deploy steps now clear the deployed `node_modules` tree before running remote `npm ci/install`, and the PROD bootstrap path already does the same during instance boot. Keep that rule in any future deploy helper to avoid stale-filesystem `ENOTEMPTY` failures during runtime dependency replacement.

## Most Common Commands

### 1. Deploy current code to TEST

```bash
npm run path:deploy -- --env test --dataset intake-release --workflow-id 21
```

Use this when:
- you want to deploy app/config/schema changes to TEST
- you do not want to wipe TEST data first

For an admin-only TEST rollout with no schema/data/portal work:

```bash
npm run path:deploy -- --env test --skip-schema --skip-data --skip-portal --release-id <release-id>
```

Before running that shortcut, set an admin-scoped TEST warning or use the ALB maintenance page if the rollout may restart the admin app or briefly expose a gateway error:

```bash
npm run path:maintenance -- set --env test --surfaces admin --start-in 5m --expected-duration 5m --title "Test and Training maintenance" --message "The Test and Training environment is temporarily unavailable for maintenance. Production is not affected."
```

Use TEST-specific copy, for example: `The Test and Training environment is temporarily unavailable for maintenance. Production is not affected.`

Wait through the warning window when practical, then deploy. Clear the warning only after smoke passes.

If the shortcut may restart the admin app or briefly expose a gateway error, enable the ALB fallback after the warning window and before deploy:

```bash
npm run path:maintenance:fallback -- set --env test --surfaces admin
```

Clear it only after smoke is green:

```bash
npm run path:maintenance:fallback -- clear --env test --surfaces admin
```

After clearing the fallback, run `path:deploy:smoke` once more before clearing the in-app warning so the final check covers normal target-group routing, not just protected maintenance-page routing.

Use that admin-only shortcut only when the change is truly confined to the admin repo. Do not use `--skip-portal` when the admin backend depends on sibling code under `../ISET-intake` or `../shared` for the changed runtime path. Current concrete example: assignment/reassignment notification email delivery uses `../shared/events/notificationDispatcher.js` plus `../ISET-intake/notifications/templateRenderer.js`, so that fix must ship as an `admin + portal` TEST rollout, not as admin-only.

### 2. Reset TEST from the current DEV baseline, then deploy

```bash
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

First plan:

```bash
npm run path:deploy:plan -- --env prod --dataset intake-release --workflow-id 21
```

For a normal app rollout, use the maintenance sequence so smoke runs after normal routing is restored:

```bash
npm run path:maintenance -- set --env prod --surfaces all --start-in 5m --expected-duration 15m --yes
# wait through the warning window
npm run path:maintenance:fallback -- set --env prod --surfaces all --yes
npm run path:deploy -- --env prod --dataset intake-release --workflow-id 21 --release-id <release-id> --skip-smoke --yes
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
npm run path:deploy:smoke -- --env prod
npm run path:maintenance -- clear --env prod --surfaces all --yes
```

If the ASG refresh reports `Target.NotInUse` or insufficient ELB health data while fallback is active, clear the fallback in another shell and let the refresh continue.

Use this when:
- the change has already been validated in TEST
- the maintenance warning/fallback sequence has been stated before the run

What this does:
- verifies AWS prod identity
- captures a prod DB restore point if DB mutation is planned
- applies canonical schema work
- applies allowlisted config/data only
- deploys artifacts
- waits for prod refresh
- runs prod smoke checks, or records the release before a manual normal-routing smoke when `--skip-smoke` is used during ALB fallback

Historical note:
- On 2026-05-08, release `20260507-prod-contact-retirement` validated the WSL-native PROD app path with restore point `path-prod-20260507-prod-contact-retirement-20260508000234`, ASG refresh `f323cb21-bc0c-4063-b0e8-017b40f31544`, replacement instance `i-00b00ebdff3f55dc5`, and green final public smoke.
- On 2026-04-24 the reduced role briefly lacked `rds:AddTagsToResource`, which blocked automatic restore-point capture. That IAM gap was fixed, and release `20260425-100201` confirmed restore-point capture is working again under the normal prod path.

For an admin-only PROD rollout with no schema/data/portal work and no shared-library changes:

```bash
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-portal --skip-shared --release-id <release-id> --skip-smoke --yes
```

Before running that shortcut, set an admin-scoped warning if the rollout will refresh PROD instances or can cause a brief gateway error:

```bash
npm run path:maintenance -- set --env prod --surfaces admin --start-in 5m --expected-duration 5m --yes
```

Wait through the warning window, then deploy. Clear the warning only after smoke passes.

## Feature-Flagged Portal Changes

Use this pattern when a portal behavior change is guarded by a runtime flag such as `iset_runtime_config(scope='runtime', k='intake.draft_autosave')`.

### TEST

Deploy the portal code first, without unrelated schema/data/admin work:

```bash
npm run path:deploy -- --env test --skip-schema --skip-data --skip-admin --release-id intake-draft-autosave-test
```

Then enable the runtime flag in TEST:

```bash
cd /home/bill/ISET/admin-dashboard
scripts/run-test-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
```

### PROD

Deploy the code first with the flag still absent or `false`, let the rollout finish, and only then enable the flag:

```bash
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-admin --skip-shared --release-id intake-draft-autosave-prod --yes
```

After prod smoke passes, enable the flag:

```bash
cd /home/bill/ISET/admin-dashboard
scripts/run-prod-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
```

Why this sequence matters:
- The portal uses a separate endpoint, `POST /api/draft/autosave`, so a new client talking to an old server during rollout fails harmlessly.
- Enabling the flag only after the app rollout avoids mixed-fleet behavior for in-flight applicants.
- Rollback is simple: set the same runtime row to `{\"enabled\": false}` without redeploying.

If the feature is already enabled in the target environment, set it to `false` before starting the app rollout, then re-enable it after smoke passes.

Portal-only PROD hotfix command:

```bash
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-admin --skip-shared --release-id <release-id> --yes
```

The deploy command records smoke-check details in the release manifest even when the console only prints the final summary. If you need operator-visible smoke lines before clearing the maintenance warning, run:

```bash
npm run path:deploy:smoke -- --env test --skip-admin
npm run path:deploy:smoke -- --env prod --skip-admin --skip-shared
```

## Safe Preflight Commands

Plan TEST:

```bash
npm run path:deploy:plan -- --env test --dataset intake-release --workflow-id 21
```

Plan TEST reset + deploy:

```bash
npm run path:deploy:plan -- --env test --refresh-test-db --dataset intake-release --workflow-id 21
```

Plan PROD:

```bash
npm run path:deploy:plan -- --env prod --dataset intake-release --workflow-id 21
```

Smoke only:

```bash
npm run path:deploy:smoke -- --env test
npm run path:deploy:smoke -- --env prod
```

## Planned Maintenance Warning

Set a warning before a planned deploy:

```bash
npm run path:maintenance -- set --env test --start-in 5m --expected-duration 5m
npm run path:maintenance -- set --env prod --start-in 5m --expected-duration 5m --yes
```

Use this when:
- you want the admin console and public portal to show a global maintenance warning before the cutover
- a 2 to 5 minute lead time is acceptable
- the expected user-facing interruption window is brief and you want to warn about possible reloads or short transient failures rather than true downtime

For unscheduled work that is already starting:

```bash
npm run path:maintenance -- set --env test --start-now --expected-duration 5m --unscheduled
npm run path:maintenance -- set --env prod --start-now --expected-duration 5m --unscheduled --yes
```

Clear the warning after smoke passes. If you enabled the ALB fallback, clear the fallback first, run smoke with normal routing restored, then clear the warning:

```bash
npm run path:maintenance -- clear --env test
npm run path:maintenance -- clear --env prod --yes
```

Notes:
- The warning is driven by `iset_runtime_config(scope='runtime', k='service.announcement')`.
- Admin and portal clients poll every 15 seconds and render the countdown locally, so this is an operator warning tool, not a precise sub-minute push channel.
- Set `expected-duration` to the likely user-visible interruption window, not the full end-to-end deploy runtime. Rolling app deploys often take several minutes in the operator console while causing little or no visible disruption.
- If the service must be fully unavailable during cutover, the warning can be combined with the separate ALB `503` maintenance fallback.
- During PROD ASG-refresh deploys, the ALB fallback can make target groups report `Target.NotInUse`; if the refresh stalls on that reason, clear the fallback once the refreshed instance is in service so ELB health can evaluate, then rerun smoke with normal routing.
- A generic `502 Bad Gateway` during TEST deploy is not an acceptable planned rehearsal behavior. If the release can expose that state, either warn users first or put the affected TEST surface behind the ALB maintenance page.
- A generic `502 Bad Gateway` during PROD deploy is not acceptable planned behavior. If the release can expose that state, either warn users first or put the affected surface behind the ALB maintenance page.

## App-Coupling Rule

- The TEST deploy decision is based on runtime dependency, not on which repo you edited from first.
- The WSL-native TEST admin deploy stages the sibling `../shared` tree into the admin artifact, so admin changes that touch `shared` still count as admin deploys.
- The admin backend on the server also resolves some modules from the deployed portal tree via `../ISET-intake/*`, so changes under `/home/bill/ISET/ISET-intake` that are used by the admin backend require a portal deploy too.
- Before using an `admin-only` shortcut, check whether the changed execution path imports from `../shared/*` or `../ISET-intake/*`. If it does, ship the coupled surface(s) together.

## Hard Maintenance Page

If you want users to see a deliberate maintenance page instead of a generic browser error while the app is unavailable:

```bash
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
- For PROD ASG refreshes, normal forwarding may be required before the refresh can finish because the ASG relies on ELB target health.

## TEST Reset Only

If you want to reset TEST without doing an app deploy:

```bash
npm run test:db:refresh -- --source-env dev --yes
```

Preflight only:

```bash
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
- The admin landing page now also generates its public release-notes panel from `docs/meta/next-release-notes-log.md` during build, so the visible landing-page notes heading should carry the same deployed release ID/date as the footer build line.

## How To Ask Codex

Use plain instructions like:

- `Deploy PATH to test.`
- `Reset test from dev and deploy PATH.`
- `Plan the prod deployment.`
- `Deploy PATH to prod.`
