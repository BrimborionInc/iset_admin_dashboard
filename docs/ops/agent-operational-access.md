# Agent Operational Access Notes

Status: current operational access guidance for Codex/WSL threads. Verify live AWS/DB state before running mutating commands.
Last reviewed: 2026-06-14 after PROD NAT consolidation execution.

Purpose: keep database, TEST/PROD, and AWS profile command notes out of `docs/AGENTS.md` while preserving the operational details future agents need.

## Database Documentation And Access

- Start at `docs/data/database-documentation.md` for DB index and cross-app pointers.
- When tables/columns/relationships change, update the index and linked domain docs.
- Regenerate schema dump after schema changes, but do not commit dump files:
  `npm run dump:dev-schema`

## Local Workspace And Deploy Split

- Daily coding/Codex work now happens in the WSL multi-root workspace `/home/bill/ISET/path-dev-wsl.code-workspace`.
- That workspace includes `/home/bill/ISET/admin-dashboard`, `/home/bill/ISET/ISET-intake`, `/home/bill/ISET/shared`, and `/home/bill/ISET/intacct-mock-service`.
- TEST deploys run from `/home/bill/ISET/admin-dashboard`. The WSL-native `path:deploy` TEST app step builds/packages the WSL admin tree, sibling portal tree, and sibling shared tree, then deploys through AWS CLI + SSM.
- PROD deploys also run from `/home/bill/ISET/admin-dashboard`. The WSL-native `path:deploy` PROD app step builds/packages the WSL admin tree, sibling portal tree, and sibling shared tree, uploads fixed latest artifacts to `nwac-prod-artifacts`, then starts and waits for the PROD ASG refresh.
- Do not use stale `X:\ISET` or `/mnt/x/ISET` deploy guidance. Windows `npm.cmd` is not reliable from `\\wsl.localhost\...`, which is why the active app paths are handled by the Node orchestrator instead of the legacy PowerShell component scripts.
- Current WSL shell-helper rule: repo `.sh` helpers are tracked without the executable bit after the Windows-to-WSL checkout migration. Invoke them through `bash scripts/<helper>.sh ...` in docs and commands unless a helper is deliberately changed to executable mode.

## DB Interaction From WSL (DEV)

- MySQL runs on the Windows host and accepts local connections.
- Verified on 2026-04-04: the shared-schema CLI can reach DEV from the sandbox via the repo `.env` when invoked through the Windows Node runtime:
  `"/mnt/c/Program Files/nodejs/node.exe" scripts/path-schema-migrate.js plan`
- Use Windows MySQL client from WSL, not Linux `mysql`:
  `"/mnt/c/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" -h localhost -P 3306 -u root -p"<from .env>" -D iset_intake -e "SELECT 1;"`
- Read credentials from `.env`: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`.
- Connectivity check:
  `"/mnt/c/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" -h localhost -P 3306 -u root -p"<from .env>" -D iset_intake -e "SELECT DATABASE() AS db, @@hostname AS host, @@port AS port;"`
- Schema discovery:
  - Tables: `... -e "SHOW TABLES;"`
  - Table DDL: `... -e "SHOW CREATE TABLE <table_name>\\G"`
  - Recent rows: `... -e "SELECT * FROM <table_name> ORDER BY id DESC LIMIT 10;"`
- Safe write workflow for test data:
  - Confirm table/columns with `SHOW CREATE TABLE`.
  - Wrap writes in `START TRANSACTION; ...; COMMIT;` or `ROLLBACK;`.
  - Use clearly tagged dummy values like `DUMMY_` and `TEST_`.

## TEST DB Interaction From Codex/WSL

- Verified on 2026-03-28: the Codex sandbox can run SQL against TEST indirectly through SSM on a live `nwac-test-app` EC2 instance using AWS profile `nwac-test`.
- Do not assume direct network access from the sandbox to the Aurora cluster. The TEST DB security group only allows MySQL from the app security group, so the normal Codex path is remote execution on the app host.
- Preferred helper for future chats: `bash scripts/run-test-sql-via-ssm.sh`
- Preferred config/data promotion entry point: `npm run data:sync:plan -- --dataset <name> ...` followed by `npm run data:sync:apply -- --target-env test ...`
- Preferred full TEST reset entry points: `npm run test:db:refresh:plan -- --source-env dev` and `npm run test:db:refresh -- --source-env dev --yes`
- Supporting guide: `docs/guides/test-db-access-from-codex.md`
- Current TEST topology caveat: after the 2026-06-08 cost prune, the normal TEST shape is one `nwac-test-asg` app host in `ca-central-1d`. Helpers should auto-discover a healthy SSM-online ASG host; do not require old two-host evidence or hard-code retired instance IDs.
- Current caveat: older scripts such as `scripts/deploy-test-db.ps1` reference retired test instance IDs; re-check live AWS resources before trusting those IDs.
- Current schema rule: treat `admin-dashboard/sql/migrations/` -> `iset_migration` as the canonical PATH shared-schema path. Treat `admin-dashboard/sql/ops/` as manual-only SQL, `admin-dashboard/db/migrations/` as legacy archive, and the portal-side `__migrations` / `schema_migrations` paths as retired for deployed PATH schema work unless a thread explicitly proves otherwise.
- Current privacy ERM rule: secure messages are case-scoped typed-actor records, not applicant-to-assigned-staff personal messages. Preserve `messages.case_id`, typed sender/recipient actor fields, exactly-one-applicant semantics, scoped `message_attachment` rows, source-specific `iset_document` lineage constraints, signing-request case/participant FKs, and escalation/task shared-user FKs when changing messaging, document, form-signing, escalation, or task flows.
- Current route-denial smoke rule: use `npm run smoke:privacy-denials` for live wrong-token/wrong-owner checks. It must use real Cognito bearer tokens from env vars only; do not introduce header impersonation, simulated users, or production-reachable auth bypasses to exercise these paths. For local DEV only, `npm run seed:privacy-denials` can create synthetic wrong-owner fixtures and write ignored IDs under `tmp/`; do not treat that seeder as a TEST/PROD migration.
- Current internal-notification identity rule: DEV migration `20260427_0011_retire_internal_notification_legacy_identity_shadows.sql` physically retires `iset_internal_notification.audience_user_id` and `iset_internal_notification_dismissal.user_id`. New bell-alert code must use `audience_actor_type` plus `audience_staff_profile_id` / `audience_applicant_user_id`, and dismissal code must use `viewer_actor_type` plus `viewer_staff_profile_id` / `viewer_applicant_user_id`. Staff bell alerts target `staff_profiles.id`; applicant-targeted alerts target shared `user.id`. Do not convert `application_lock.owner_user_id` or `user_session_audit.user_id` into shared-user FKs without a dedicated actor/session principal redesign.
- Current event-receipt identity rule: DEV migration `20260427_0012_retire_event_receipt_legacy_recipient_shadow.sql` physically retires `iset_event_receipt.recipient_id`. Event read-state code must use `viewer_staff_profile_id` or `viewer_applicant_user_id`, and each receipt must have exactly one typed viewer.
- Never run destructive broad statements unless explicitly requested.
- If host DB access fails from WSL, run `npm run dump:dev-schema` and continue with read-only analysis from docs.

## PROD DB Interaction From Codex/WSL

- Verified on 2026-05-04: the Codex sandbox can run SQL against PROD indirectly through SSM on a live `nwac-prod-asg` EC2 instance using AWS profile `nwac-prod`.
- Do not assume direct network access from the sandbox to the Aurora cluster. The normal Codex path is remote execution on the PROD app host, where the helper reads `nwac-prod-db-credentials` through the instance role and connects to Aurora inside the VPC.
- Preferred helper for future chats: `bash scripts/run-prod-sql-via-ssm.sh`
- The helper auto-discovers an online in-service PROD app instance from ASG `nwac-prod-asg`, uses profile `nwac-prod`, region `ca-central-1`, DB secret `nwac-prod-db-credentials`, host `nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com`, database `iset_intake`, and port `3306` by default.
- PROD Aurora provisioned downsizing runbook: `docs/ops/runbooks/prod-aurora-provisioned-downsize.md`. Use the temporary-reader/failover pattern; do not modify the only writer in place. The 2026-06-14 revalidation found low CPU/I/O but memory risk, and AWS Compute Optimizer recommended staying on `db.r6g.large`; treat `db.t4g.large` as an explicit-risk trial only. Future execution needs temporary policy `NWACProdAuroraDownsizeTemporaryOperator` from that runbook.
- PROD app EC2 right-size runbook: `docs/ops/runbooks/prod-app-instance-rightsize.md`. The 2026-06-14 `t3.large` -> `t3.medium` change executed successfully on instance `i-034c7daa416ec6865` via launch-template version `2`. Temporary policy `NWACProdAppRightSizeTemporaryOperator` was required for `ec2:CreateLaunchTemplateVersion`; remove it after the rollback watch window, and reattach it only if a later rollback or launch-template change is needed.
- PROD NAT gateway consolidation runbook: `docs/ops/runbooks/prod-nat-gateway-consolidation.md`. The 2026-06-14 execution reduced PROD from three NAT gateways to one keeper NAT, `nat-061b3328c8a74487e` in `ca-central-1d`; all three private route tables now route `0.0.0.0/0` through that NAT. Temporary policy `NWACProdNatConsolidationTemporaryOperator` was required for `ec2:ReplaceRoute`, `ec2:DeleteNatGateway`, and `ec2:ReleaseAddress`; remove it after the rollback watch window.
- Confirm the PROD operator identity before live data work:
  `aws sts get-caller-identity --profile nwac-prod`
- Read-only connectivity check:
  `bash scripts/run-prod-sql-via-ssm.sh --sql "SELECT DATABASE() AS db, @@hostname AS host, @@port AS port, CURRENT_USER() AS mysql_user, (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()) AS table_count;"`
- Use `--sql-file` for reviewed multi-statement repair scripts. The helper stages SQL through `s3://nwac-prod-artifacts/ssm-sql/...` so larger files do not exceed SSM document size limits.
- For PROD data repair, default to preview SQL first, then a guarded apply script with explicit expected identifiers, transaction boundaries where feasible, before/after verification selects, and an audit/recovery trail. Avoid broad destructive statements and do not rely on chat-only evidence for live mutations.
- For PROD SQL, do not guess table or column names. Before selecting, updating, or writing repair SQL against a table whose live shape is not already verified in the current thread, run `SHOW COLUMNS FROM <table>` or `SHOW CREATE TABLE <table>` through the target environment helper and write SQL only against verified columns. If a query fails because a guessed column/table name was used, stop and correct the workflow before any mutation.
- If PROD DB access fails, stop and repair the documented helper/profile path before improvising a new access route.

## PROD Start/Stop Reference

Use these commands to shut down or restart PROD for cost savings in `ca-central-1`.

Shutdown:
- Scale ASG to zero:
  `aws autoscaling update-auto-scaling-group --region ca-central-1 --auto-scaling-group-name nwac-prod-asg --min-size 0 --desired-capacity 0`
- Stop Aurora cluster:
  `aws rds stop-db-cluster --region ca-central-1 --db-cluster-identifier nwac-prod-db`
- Verify ASG:
  `aws autoscaling describe-auto-scaling-groups --region ca-central-1 --auto-scaling-group-names nwac-prod-asg --query 'AutoScalingGroups[0].{Min:MinSize,Desired:DesiredCapacity,Instances:Instances[].[InstanceId,LifecycleState,HealthStatus]}' --output table`
- Verify DB:
  `aws rds describe-db-clusters --region ca-central-1 --db-cluster-identifier nwac-prod-db --query 'DBClusters[0].Status' --output text`

Restart:
- Start Aurora cluster:
  `aws rds start-db-cluster --region ca-central-1 --db-cluster-identifier nwac-prod-db`
- Scale ASG back up:
  `aws autoscaling update-auto-scaling-group --region ca-central-1 --auto-scaling-group-name nwac-prod-asg --min-size 1 --desired-capacity 1`
- Optional: after uploading new `admin-dashboard-latest.zip`, force replacement so new artifact is pulled:
  `aws autoscaling start-instance-refresh --region ca-central-1 --auto-scaling-group-name nwac-prod-asg --preferences MinHealthyPercentage=100,InstanceWarmup=180,SkipMatching=false`
- Verify ASG:
  `aws autoscaling describe-auto-scaling-groups --region ca-central-1 --auto-scaling-group-names nwac-prod-asg --query 'AutoScalingGroups[0].{Min:MinSize,Desired:DesiredCapacity,Instances:Instances[].[InstanceId,LifecycleState,HealthStatus]}' --output table`
- Verify DB:
  `aws rds describe-db-clusters --region ca-central-1 --db-cluster-identifier nwac-prod-db --query 'DBClusters[0].Status' --output text`

Notes:
- This stops compute and database, but ALB/NAT/EIP/VPC endpoint costs may remain.
- Confirm target AWS account before running commands:
  `aws sts get-caller-identity`
- Do not use deploy-script `-SkipBuild` for admin or portal unless you have already inspected the current `build/` output and confirmed it was compiled for the target environment. The compiled React bundle bakes Cognito domains, client IDs, and portal/admin links, so a stale TEST build can ship TEST sign-in targets to PROD even when PROD SSM/runtime env is correct.

## AWS CLI Profile/Account Mapping

- Keep PROD and TEST identities as separate AWS CLI profiles; never rely on implicit defaults.
- Current known mappings in this Codex environment, re-verified 2026-04-20 after the PROD-role cutover:
  - `default` -> `arn:aws:iam::468278742295:user/nwac-prod-automation` (bootstrap identity only; direct PROD resource access is intentionally denied)
  - `nwac-prod` -> `arn:aws:sts::468278742295:assumed-role/nwac-prod-codex-operator/codex-prod-operator` when assumed from `default`
  - `nwac-prod-codex-operator` -> `arn:aws:sts::468278742295:assumed-role/nwac-prod-codex-operator/codex-prod-operator` when assumed from `default`
  - `nwac-test` -> `arn:aws:iam::124355655255:user/CODEX_CLI_Admin` (test account `124355655255`)
- Reduced PROD operator role added 2026-04-20 and widened 2026-04-20 for the full repo-driven deploy/migration path: `nwac-prod-codex-operator` / `nwac-prod` cover artifact uploads in `nwac-prod-artifacts` (`admin/*`, `portal/*`, `shared/*`, `ssm-sql/*`, `db-dumps/*`), PROD SSM SQL/dump execution, ASG refresh, PROD DB restore-point snapshots, and the ALB `path-maintenance-fallback` flow. They still do not allow direct `secretsmanager:GetSecretValue` on `nwac-prod-db-credentials`.
- Legacy Windows/npm deploy processes do not share the same AWS config home as bash/WSL. TEST no longer uses that path; if PROD app deploy is ported by adapting the old PowerShell helpers, credentials must still come from the WSL role-backed profile rather than an implicit Windows default.
- Always pass `--profile` for AWS commands in threads that touch infra or storage:
  - TEST example: `aws s3api get-bucket-encryption --bucket nwac-test-uploads-20251014 --region ca-central-1 --profile nwac-test`
  - PROD example: `aws sts get-caller-identity --profile nwac-prod`
