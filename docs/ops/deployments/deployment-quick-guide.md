# PATH Deployment Quick Guide

Status: current primary operator guide for normal TEST/PROD PATH deploys.
Last reviewed: 2026-07-13 after comprehensive release qualification became mandatory; command names checked against current `package.json`.

This is the shortest operator guide for normal PATH deployments.

Qualification authority lives in `release-qualification-runbook.md`. Every mutating TEST command now needs `--qualification-evidence <DEV-GO.json>` and every mutating PROD command needs `--qualification-evidence <TEST-GO.json>`. Command fragments below that focus on deploy scope do not override that requirement; the CLI rejects an omitted, expired, mismatched, failed, skipped, or unavailable qualification.

Work from:

```bash
cd /home/bill/ISET/admin-dashboard
```

Daily coding/Codex work and deployments now happen from the WSL workspace `/home/bill/ISET/path-dev-wsl.code-workspace`. `path:deploy` packages the WSL admin repo plus sibling `ISET-intake` and `shared` trees. TEST rolls out through WSL AWS CLI + SSM; PROD uploads fixed latest artifacts and waits for the PROD ASG refresh. Do not use stale `X:\ISET` or `/mnt/x/ISET` checkout instructions for deploys.

## Fresh Thread Deploy Preflight

When Bill starts a new Codex thread for deploy work, the agent must first:

- Read `docs/AGENTS.md`, this quick guide, `docs/ops/deployments/prod-deployment-guide.md`, `docs/ops/deployments/path-deploy-orchestrator.md`, and `docs/ops/deployments/data-promotion-catalog.md`.
- Run `git status --short` from `/home/bill/ISET/admin-dashboard`, `git -C ../ISET-intake status --short`, and `git -C ../shared status --short`, then state that the deploy artifact packages the current WSL working trees, not only staged files.
- For PROD app deploys, the deploy orchestrator now fails dirty source trees before mutation. Commit, stash, or isolate the admin/portal/shared source before deploy; use `--allow-dirty --dirty-reason "<specific approved reason>"` only for an explicitly approved emergency exception.
- Every deploy run now consumes machine-generated `release.qualification` before `release.preflight` and every mutation boundary. TEST requires DEV GO; PROD requires deployed TEST GO. The evidence covers both apps, shared runtime, real MySQL, compiled journeys, configuration, workers, external substitutes, provenance, rollback, cleanup, and deployed acceptance. Do not treat the smaller packaging preflight or later health checks as a substitute.
- `--skip-build` requires `build/path-build-manifest.json` for the exact target, release ID, clean Git commit, and untampered build tree. Generate it with `npm run build:manifest` only after building the exact prebuilt release; an older TEST/PROD build cannot be relabelled during deploy.
- PROD normal-routing smoke uses public `/readyz` for admin and portal so missing canonical runtime schema fails with `503`; use local `/healthz` only to diagnose whether a replacement process has started while ALB routing/fallback is still in transition.
- `/home/bill/ISET/shared` should be a local Git repo. If it is missing or not a repo, stop and restore/recreate it before deploy unless Bill explicitly approves an emergency exception with marker/checksum verification.
- State the intended deploy scope before planning. Ordinary TEST/PROD deploys mean the current app build plus planned schema migrations, and use `--skip-data`; runtime/config/data promotion is a separate scope and is not included by default.
- Codex owns release composition. Do not ask Bill which code/config files to include; inspect the diffs, source trees, generated artifacts, and runtime-config boundaries, then choose the release package defensibly. Pause only for true business/data/runtime ambiguity with concrete consequences, such as whether to promote a named DEV-published intake runtime schema that appears experimental.
- Treat an unqualified deployment trigger as “deploy all outstanding coherent, tested, release-ready scope” across threads, repositories, and backlog work, not as shorthand for only the most recently discussed change. Before any mutating deploy command, state a concise release manifest that names every included app surface, shared dependency, planned migration, runtime/data operation, and feedback item, plus every prepared user-visible change deliberately excluded. Do not include unfinished or experimental work. If readiness or business intent remains genuinely uncertain after inspecting the working trees and project memory, pause and ask Bill to confirm that specific ambiguity before mutation; asking first is correct and silence is not approval to omit or risk a change.
- “All outstanding scope” never includes copying DEV applicant/user/business/operational data into TEST or PROD and never authorizes a blanket DEV configuration overwrite. Configuration required by an included backlog change must be a targeted, named set of keys/rows with its normal explicit approval and verification. DEV hosts other nForm experiments, while TEST and PROD remain dedicated to NWAC ISET; a published runtime/config payload that is not proven to be the intended ISET workflow is a hard stop.
- Derive the final maintenance and smoke surfaces from the completed `path:deploy:plan`, not from the initial change description. Read the plan's `App deploy` line before setting a warning. If `shared=true`, use all-surface warning/fallback and all-surface normal-routing smoke because the shared runtime and PROD replacement host affect both admin and portal processes, even when one app artifact is skipped. Use admin-only or portal-only maintenance only when the plan confirms `shared=false` and the rollout is genuinely isolated to that surface.
- Do not copy DEV runtime config to PROD as routine deployment hygiene. A PROD runtime setting change must be a named, reviewed operation for specific keys/rows.
- Before any PROD command that mutates runtime config, allowlisted data, or arbitrary DB rows, state the exact dataset or SQL, the target tables/keys, the source environment, why app/schema-only deploy is insufficient, the restore/rollback path, and the verification that will prove the right thing changed.
- Treat `--dataset intake-release`, `--dataset intake-runtime-publish`, and any direct `iset_runtime_config` SQL as deliberate runtime operations, never boilerplate. They require Bill to explicitly approve that exact scope in the current thread.
- For intake runtime promotion, require `--workflow-id` and prove the plan or manifest names the intended workflow before apply. For the current ISET intake, a promotion is only safe when it is explicitly in scope and `summary.runtimePublish.runtime.workflowId` is `21`.
- PROD deploys still require Bill's explicit approval in the current thread before any mutating `path:deploy`, `data:sync:apply`, maintenance fallback, runtime SQL command, or other DB-impacting command.

## Rules

- Do not dump the DEV database manually before asking Codex to deploy.
- Use `path:deploy` for normal releases.
- Use `test:db:refresh` only when you want to reset TEST.
- Before every TEST or PROD app deploy, choose or confirm the release ID, then update `docs/meta/next-release-notes-log.md` for user-visible changes. The public landing-page panel must keep the standard sections `What changed`, `Known Bugs`, and `What's Coming`; do not publish `Earlier changes`.
- For any PROD deploy that includes in-app feedback bug/CR fixes, report reconciliation is part of the deploy. Before the deploy, identify the affected `admin_feedback_report` IDs and make sure each report has a current note/status reflecting the planned release. After normal-routing smoke and the targeted workflow recheck pass, update `admin_feedback_report.status`, `admin_feedback_status_history`, and `admin_feedback_note` in PROD before calling the deployment complete. Only mark a report `resolved` after the deployed behavior and relevant client-facing/generated artifacts have been verified; otherwise leave it open with the remaining verification work noted.
- Do not turn every prepared bug/CR fix into its own PROD deploy. Batch suitable fixes into the next planned PROD maintenance release unless Bill explicitly approves an emergency hotfix.
- For major workflow changes, apply `docs/ops/deployments/major-workflow-release-management.md` before TEST/PROD release. The release must be driven by the business-state contract, not by isolated bug symptoms: roles, states, queues, editability, generated artifacts, notifications, data repair, feedback reconciliation, and owner communication must all be accounted for.
- Under `What changed`, maintain three expandable release-package groups for the three most recent release packages. Add the new release as the first `#### Release ...` group in `What Changed Packages (draft - EN)` and `Lots de changements (brouillon - FR)`, keep only the two next-most-recent groups below it, and remove the oldest fourth group.
- Keep the flat `What's New (draft bullets - EN)` and `Nouveautes (brouillon - FR)` fallback sections focused on the newest release package. `Known Bugs` and `What's Coming` can be empty only when there is nothing accurate to publish.
- Release-note preflight is not satisfied by raw dated entries near the top of `docs/meta/next-release-notes-log.md`. The visible landing-page content comes from the draft sections at the bottom. Before deploy, the first English and French package groups must represent the release being deployed, preferably with the exact heading `#### Release <release-id>`, the flat `What's New` / `Nouveautes` fallback bullets must describe that same newest package, and every user-visible `Release TBD` or otherwise unreleased item intended for the deploy must be either represented in that package or deliberately deferred.
- Before deploy, generate or inspect `src/generated/publicReleaseNotes.js` and confirm that it contains `featurePackages` for the three current release packages, does not expose `Earlier changes`, and has today's/current release package as the first `featurePackages[0]` entry in both languages. A generated file stamped with the new release ID but showing an older package title first is a failed preflight; stop and fix the draft release notes before running `path:deploy`.
- For fixes that affect audit, auth, support diagnostics, retention, messaging scope, document scope, payment scope, or any other schema-backed operational evidence, verify the deployed DB schema and the writer code before relying on the table. A table existing is not enough; run a focused preflight that proves the writer uses real columns, does not silently swallow failures, and creates/updates at least one safe TEST row or has an equivalent automated test. For PROD investigations, state any evidence gaps plainly instead of implying a broken/empty audit table proves no activity happened.
- In the current Codex sandbox, `nwac-prod` is the standard role-backed prod operator profile. `default` is only the bootstrap IAM user and direct prod resource calls through it are expected to fail.
- The reduced `nwac-prod` role covers established compatibility-artifact deploys, prod SQL/dumps via SSM, ASG refresh, automatic prod restore-point snapshots, and the ALB maintenance fallback. It does not currently permit the newer immutable `releases/*` prefix. While bootstrap still consumes `*-latest.zip`, an explicitly reviewed recovery may add `--compatibility-only`; otherwise obtain separate IAM authority. The role also excludes broader infra/admin work such as WAF changes, SSM env parameter writes, uploads-bucket CORS changes, or Terraform/ACM changes.
- PROD deploys require explicit Bill approval in the current thread plus `--yes`. A prepared fix, passing TEST result, or urgent support issue is not approval to deploy to PROD.
- PROD app deploys require clean packaged source trees. The orchestrator checks the admin repo for admin artifacts, the portal repo for portal artifacts, and the sibling `shared` repo whenever admin, portal, or shared artifacts include it. A dirty-source override must be named, approved, and recorded with `--allow-dirty --dirty-reason`.
- The `shared` tree is a Git repo as of 2026-07-08 and tracks private GitHub remote `https://github.com/BrimborionInc/iset_shared.git`. Verify it is clean and pushed before deploys, like admin and portal.
- Deployment scope boundary: app deploys do not include runtime configuration, allowlisted data promotion, arbitrary SQL data fixes, or full database restores unless Bill explicitly confirms that exact scope in the current thread. For ordinary app/schema releases, use `--skip-data` or omit `--dataset`. Do not include `--dataset intake-release` as boilerplate, and do not treat DEV runtime config as something to mirror into PROD.
- TEST deploys require `--yes` only when you include `--refresh-test-db`.
- Deploys do not auto-bump `package.json` semver; instead, each frontend build now carries a visible release/build stamp.
- TEST app deploys package the current WSL working tree and sibling WSL portal/shared trees. If you mean "deploy only the staged subset," isolate unrelated local edits before running `path:deploy`; the deploy artifact is not limited to the Git index.
- Intake data promotions must prove runtime/authoring alignment before any TEST or PROD bundle is generated. `intake-release` and standalone `intake-runtime-publish` both require `--workflow-id`; the plan output must show `summary.runtimePublish.runtime.workflowId` matching that id before the promotion is safe to apply.
- TEST is currently cost-pruned. Expect one healthy `nwac-test-asg` app instance, one NAT gateway, and target-group smokes with one registered admin target plus one registered portal target. Do not treat a one-target TEST smoke as incomplete; the deploy and SQL helpers auto-discover the current ASG/SSM host(s).
- TEST app rollouts should rehearse PROD user-facing maintenance behavior. Any TEST deploy that can restart app processes, make a surface unavailable, or produce transient `502 Bad Gateway` responses needs a scoped warning first and the affected surface behind the ALB maintenance page before deploy starts. TEST remains less strict than PROD because ordinary app deploys do not require `--yes`, but raw 502s are not an acceptable planned TEST experience. TEST maintenance copy must use the user-facing name `Test and Training environment` and explicitly state that Production is not affected.
- PROD app rollouts are user-impacting unless the plan proves otherwise. Any PROD deploy that refreshes ASG instances, restarts app processes, rotates target groups, or can produce transient `502 Bad Gateway` responses needs a scoped warning first and the affected surface behind the ALB maintenance page before deploy starts, even if it is admin-only, portal-only, or code-only.
- Operator checklist rule: after reviewing the completed plan, state the exact maintenance sequence before running `path:deploy`. For TEST in-place app rollouts that restart admin or portal, use `warning -> wait -> ALB 503 fallback -> deploy -> clear fallback -> smoke normal routing -> clear warning`. For PROD ASG-refresh rollouts, use the ALB fallback for the cutover risk, but clear it if the instance refresh waits on ELB health with `Target.NotInUse` / `insufficient data`; target groups must be in normal forwarding to become healthy. Do not treat the in-app warning as a substitute for the ALB fallback when target health may drop, but keep the in-app warning active until normal-routing smoke passes.
- Current dependency-reinstall safeguard: in-place TEST deploy steps now clear the deployed `node_modules` tree before running remote `npm ci/install`, and the PROD bootstrap path already does the same during instance boot. Keep that rule in any future deploy helper to avoid stale-filesystem `ENOTEMPTY` failures during runtime dependency replacement.

## Most Common Commands

### 1. Deploy current code to TEST

```bash
npm run path:deploy -- --env test --skip-data --release-id <release-id> --qualification-evidence <DEV-GO.json>
```

Use this when:
- you want to deploy app/schema changes to TEST
- you do not want to wipe TEST data first
- you are not intentionally promoting runtime config or workflow authoring rows

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
npm run path:deploy -- --env test --refresh-test-db --skip-data --release-id <release-id> --qualification-evidence <DEV-GO.json> --yes
```

Use this when:
- TEST data can be thrown away
- you want a clean TEST environment
- you want Codex to handle the snapshot generation automatically
- you are not intentionally applying an extra runtime/config promotion after the reset

What this does:
- builds a DEV-derived TEST baseline snapshot automatically
- restores TEST
- applies canonical schema work
- skips additional allowlisted data promotion; the DEV-derived TEST baseline itself includes the current published intake runtime row as part of the reset dataset
- deploys admin + portal
- runs TEST smoke checks

### 3. Deploy to PROD

First plan:

```bash
npm run path:deploy:plan -- --env prod --skip-data
```

For a normal app rollout, use the maintenance sequence so smoke runs after normal routing is restored:

```bash
npm run path:maintenance -- set --env prod --surfaces all --start-in 5m --expected-duration 15m --yes
# wait through the warning window
npm run path:maintenance:fallback -- set --env prod --surfaces all --yes
npm run path:deploy -- --env prod --skip-data --release-id <release-id> --qualification-evidence <TEST-GO.json> --skip-smoke --yes
npm run path:maintenance:fallback -- clear --env prod --surfaces all --yes
npm run path:deploy:smoke -- --env prod
npm run path:maintenance -- clear --env prod --surfaces all --yes
```

If the ASG refresh reports `Target.NotInUse` or insufficient ELB health data while fallback is active, first verify the replacement instance is actually serving local `/healthz` on the admin/portal ports through SSM. If the host is still bootstrapping (`npm ci`, pm2 not started, or local health failing), keep fallback active and recheck shortly. Once local health passes, clear the fallback in another shell so ELB can evaluate real target health, then let the refresh continue.

On the single-instance PROD topology, local readiness does not prove that the target has already met the ALB healthy-threshold count. For an all-surface refresh, hand routing back one surface at a time: clear admin fallback, wait until the admin target group reports `healthy`, and smoke admin; then clear portal fallback, wait until the portal target group reports `healthy`, and smoke both portal hosts. If an immediate public smoke returns `503`, restore fallback at once and repeat the target-group-gated handoff. Keep the in-app warning active until both target groups and all public readiness checks are green.

Use this when:
- the change has already been validated in TEST
- the maintenance warning/fallback sequence has been stated before the run

What this does:
- verifies AWS prod identity
- captures a prod DB restore point if DB mutation is planned
- applies canonical schema work
- does not apply runtime config or allowlisted data when `--skip-data` is used
- deploys artifacts
- waits for prod refresh
- runs prod smoke checks, or records the release before a manual normal-routing smoke when `--skip-smoke` is used during ALB fallback
- for bug/CR releases, requires live feedback report notes/status/history to be reconciled after smoke and targeted recheck

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
bash scripts/run-test-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
```

### PROD

Deploy the code first with the flag still absent or `false`, let the rollout finish, and only then enable the flag:

```bash
npm run path:deploy -- --env prod --skip-schema --skip-data --skip-admin --skip-shared --release-id intake-draft-autosave-prod --yes
```

After prod smoke passes, enable the flag:

```bash
cd /home/bill/ISET/admin-dashboard
bash scripts/run-prod-sql-via-ssm.sh --sql "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('runtime', 'intake.draft_autosave', CAST('{\"enabled\": true}' AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP;"
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

## Runtime/Config Promotion

Runtime configuration is a separate deployment scope, not part of a normal app deploy. Promote it only when Bill explicitly confirms the release includes runtime config or workflow authoring changes.

For intake workflow promotion, first prove the plan names the intended workflow:

```bash
npm run data:sync:plan -- --dataset intake-release --workflow-id 21 --target-env test
npm run data:sync:plan -- --dataset intake-release --workflow-id 21 --target-env prod
```

The plan or manifest must show `summary.runtimePublish.runtime.workflowId` equal to the workflow being promoted before any TEST or PROD apply. Remember that `iset_runtime_config(scope='publish', k='workflow.schema.intake')` is global, not per workflow; applying the wrong runtime row changes the live applicant intake.

When runtime promotion is approved as part of a deploy, include the dataset intentionally:

```bash
npm run path:deploy -- --env test --dataset intake-release --workflow-id 21 --release-id <release-id>
npm run path:deploy -- --env prod --dataset intake-release --workflow-id 21 --release-id <release-id> --yes
```

When only runtime/config promotion is approved, use `data:sync:apply` instead of hiding it inside an app rollout:

```bash
npm run data:sync:apply -- --dataset intake-release --workflow-id 21 --target-env test
npm run data:sync:apply -- --dataset intake-release --workflow-id 21 --target-env prod --yes
```

## Safe Preflight Commands

Release-note generation check before a TEST deploy:

```bash
PATH_RELEASE_ID=<release-id> node scripts/write-build-info.js --build-target test
node -e "const fs=require('fs'); const s=fs.readFileSync('src/generated/publicReleaseNotes.js','utf8'); console.log((s.match(/\"releaseId\": \"([^\"]*)\"/)||[])[1]); console.log([...s.matchAll(/\"title\": \"([^\"]+)\"/g)].map(m=>m[1]).slice(0,2).join('\\n')); console.log(/Earlier changes/i.test(s) ? 'ERROR: Earlier changes exposed' : 'OK: no Earlier changes');"
```

The first printed package title must be the release being deployed, not an older release. Repeat with `--build-target production` for PROD release-note preflight.

Plan TEST:

```bash
npm run path:deploy:plan -- --env test --skip-data
```

Plan TEST reset + deploy:

```bash
npm run path:deploy:plan -- --env test --refresh-test-db --skip-data
```

Plan PROD:

```bash
npm run path:deploy:plan -- --env prod --skip-data
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
- Open the admin landing-page release-notes panel after deploy and confirm the first `What changed` package is the release just deployed and includes the headline user-visible changes. Do not treat a matching release ID/date alone as proof; stale package content with a fresh stamp is a failed release-note verification.
- If the release contains bug/CR fixes, verify the affected live workflow or artifact, then update the corresponding PROD feedback reports before ending the deploy thread. Use `bash scripts/run-prod-sql-via-ssm.sh` for live updates and keep multi-row/guarded updates as SQL artifacts under `sql/ops/`.

## How To Ask Codex

Use plain instructions like:

- `Deploy PATH to test.`
- `Reset test from dev and deploy PATH.`
- `Plan the prod deployment.`
- `Deploy PATH to prod.`
