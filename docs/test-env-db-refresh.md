# Test Environment Database Refresh Workflow

Goal: Load a scrubbed MySQL snapshot into the Aurora test cluster reliably and audibly, without manual RDS console steps.

## 1. Source Data Preparation
1. Export production schema/data to `iset_intake_test_dump.sql`.
2. Run local scrub scripts (PII removal, Cognito user table truncation).
3. Validate dump with checksum + schema diff tooling; store artifacts under versioned folder `db/backups/YYYYMMDD/`.

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
   - `aws s3 cp iset_intake_test_dump.sql.gz s3://nwac-test-db-import/YYYYMMDD/`.
   - Tag object with `Environment=test`, `DataClass=scrubbed`.
2. **Invoke Automation**
   - `aws ssm start-automation-execution --document-name NWACTest-DBRefresh --parameters dumpKey=YYYYMMDD/iset_intake_test_dump.sql.gz`.
3. **Automation Steps**
   1. Validate checksum (compare with expected hash parameter).
   2. Create temporary Aurora clone or pause writer connections.
   3. Drop existing schema (optional) or truncate tables via migration runner.
   4. Stream dump into Aurora using `mysql` (through Data API or temporary EC2 container).
   5. Run post-load migrations (`node migrationRunner.js --strict`).
   6. Rebuild derived data (materialized views, caches).
   7. Record outcome in CloudWatch Logs + SNS notification.
4. **Post-Refresh Validation**
   - Smoke test API endpoints (`/healthz`, `/api/status`).
   - Run automated test suite against environment (optional).
   - Archive automation execution report in `nwac-test-db-import-reports` bucket.

## 4. Rollback Strategy
- Enable Aurora automated snapshots (7-day retention).
- If refresh fails, restore from latest snapshot (`aws rds restore-db-cluster-to-point-in-time`) and reattach reader instances.
- Maintain last-known-good dump (tagged) for quick re-apply.

## 5. Future Enhancements
- Integrate schema validation to detect drift before restore.
- Add option to seed anonymized synthetic applicants for load testing.
- Build GitHub Actions workflow to trigger refresh after new migrations merge.

Owner: _(add name)_  
Last updated: _(add date)_
