# Test Environment Database Refresh Workflow

Status: current TEST database refresh operator workflow, with older Terraform target-state notes retained for context.
Last reviewed: 2026-04-29 during ops documentation cleanup; current commands checked against `package.json`.

Goal: Load a scrubbed MySQL snapshot into the Aurora test cluster reliably and audibly, without manual RDS console steps.

Current implementation note (2026-04-04):
- TEST reset is now executable through the operator CLI:
  - Plan from DEV baseline: `npm run test:db:refresh:plan -- --source-env dev`
  - Run from DEV baseline: `npm run test:db:refresh -- --source-env dev --yes`
- Existing S3 objects are also supported:
  - `npm run test:db:refresh -- --snapshot-key db-refresh/<object>.sql.gz --yes`
- Existing local scrubbed dump files are still supported:
  - `npm run test:db:refresh -- --snapshot-file /path/to/scrubbed.sql.gz --yes`
- The command auto-discovers an online `nwac-test-asg` app host, restores the dump through SSM with the app-security-group network path, runs canonical schema apply unless `--skip-schema` is supplied, and then runs TEST smoke unless `--skip-smoke` is supplied.
- Current implementation uses the existing bucket `nwac-test-artifacts` with `db-refresh/` keys instead of a dedicated import bucket.
- The DEV-derived snapshot mode is not a raw full-data clone. It builds full schema for all tables, includes data only for allowlisted safe/reference tables, and includes only the published intake runtime row from `iset_runtime_config`. Applicant, case, message, payment, and identity-link rows are excluded by design.
- The restore helper is `scripts/run-test-db-restore-via-ssm.sh`, and the operator CLI is `scripts/path-test-db-refresh.js`.
- PATH still has explicit allowlisted config-promotion tooling for non-destructive TEST updates through `scripts/path-data-sync.js`.

## 1. Source Data Preparation
1. Preferred path: have Codex build the DEV-derived baseline snapshot automatically with `--source-env dev`.
2. Optional manual path: provide a prepared scrubbed `.sql` / `.sql.gz` file through `--snapshot-file` or an existing S3 object through `--snapshot-key`.
3. If a manual dump is used, it remains the operator's responsibility to ensure it is already scrubbed before restore.

## 2. AWS Resources (Terraform)
- **S3 Bucket:** `nwac-test-db-import` (KMS encrypted, block public access, lifecycle 30 days → Glacier).
- **IAM Role:** `nwac-test-db-loader` with permissions:
  - `rds-data:ExecuteStatement`, `rds:StartExportTask`, `rds:RestoreDBClusterFromS3` as required.
  - `s3:GetObject`, `s3:PutObject` on import bucket.
- **Lambda or ECS Task Definition:** Executes MySQL client restore (`mysql --host <aurora> --ssl-mode=REQUIRED`).
- **SSM Automation Document:** Orchestrates end-to-end steps.
- **Secrets Manager:** `nwac-test/db/admin` for master user credentials (rotation enabled).

## 3. Refresh Procedure
1. **Upload Dump**
   - Current operator path uploads to `s3://nwac-test-artifacts/db-refresh/...` automatically when `--snapshot-file` is used.
   - Current DEV-baseline path first generates a local `.sql.gz` snapshot automatically, then uploads it to the same bucket/key prefix and deletes the local file unless `--keep-generated-snapshot` is supplied.
   - Manual equivalent if needed: `aws s3 cp iset_intake_test_dump.sql.gz s3://nwac-test-artifacts/db-refresh/YYYYMMDD/`.
   - Tag object with `Environment=test`, `DataClass=scrubbed`.
2. **Invoke Automation**
   - Current preferred operator path: `npm run test:db:refresh -- --source-env dev --yes`
   - Existing object path: `npm run test:db:refresh -- --snapshot-key db-refresh/YYYYMMDD/iset_intake_test_dump.sql.gz --yes`
3. **Automation Steps**
   1. Validate the current AWS identity / ASG / online SSM host selection.
   2. Generate the DEV-derived baseline snapshot locally when `--source-env dev` is used, or upload the supplied scrubbed dump to S3 when `--snapshot-file` is used.
   3. On the selected TEST app host, install `mysql` if required, download the dump, drop and recreate `iset_intake`, strip `DEFINER=` clauses while streaming, and restore through the Aurora writer endpoint.
   4. Run canonical post-load migrations with `npm run db:migrate:apply -- --target-env test`.
   5. Run TEST smoke via ALB target-group health unless skipped.
   6. Record a local manifest under `tmp/path-test-db-refresh/`.
4. **Post-Refresh Validation**
   - Current operator default is TEST smoke through `nwac-test-admin-tg` and `nwac-test-portal-tg`.
   - Run automated test suite against environment if needed after the reset completes.

## 4. Rollback Strategy
- Enable Aurora automated snapshots (7-day retention).
- If refresh fails, restore from latest snapshot (`aws rds restore-db-cluster-to-point-in-time`) and reattach reader instances.
- Maintain last-known-good dump (tagged) for quick re-apply.

## 5. Future Enhancements
- Integrate schema validation to detect drift before restore.
- Add option to seed anonymized synthetic applicants for load testing.
- Build GitHub Actions workflow to trigger refresh after new migrations merge.

Owner: _(add name)_  
Last updated: 2026-04-04
