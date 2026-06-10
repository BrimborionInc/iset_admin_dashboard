# Test Environment Database Refresh Workflow

Status: current TEST database refresh operator workflow, with older Terraform target-state notes retained for context.
Last reviewed: 2026-06-08 after TEST cost-pruning; current commands checked against `package.json`.

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
- After the 2026-06-08 TEST cost prune, the normal ASG shape is one app host. That is compatible with this workflow; the selected restore host and target-group smoke may both show one registered target per surface.
- Current implementation uses the existing bucket `nwac-test-artifacts` with `db-refresh/` keys instead of a dedicated import bucket.
- The DEV-derived snapshot mode is not a raw full-data clone. It builds full schema for all tables, includes data only for allowlisted safe/reference tables, and includes selected runtime rows from `iset_runtime_config`. Applicant, case, CFA/funding-overview outputs, PTMA contacts, message, budget, payment, and identity-link rows are excluded by design.
- The DEV-derived snapshot also keeps the finance/payment runtime configuration rows needed for TEST workflow demos: `finance/payment.intervention.payment_type_map`, `finance/payment.evidence.rules`, `finance/payment.payee_type_options`, `finance/email.routing`, and `assessment/coordinator.costing.line_item_defaults`.
- The restore helper is `bash scripts/run-test-db-restore-via-ssm.sh`, and the operator CLI is `scripts/path-test-db-refresh.js`.
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
   5. Run TEST smoke via ALB target-group health unless skipped. Current smoke passes when every registered target is healthy, not when a fixed target count is present.
   6. Record a local manifest under `tmp/path-test-db-refresh/`.
4. **Post-Refresh Validation**
   - Current operator default is TEST smoke through `nwac-test-admin-tg` and `nwac-test-portal-tg`.
   - Run automated test suite against environment if needed after the reset completes.

## Recent execution log

- 2026-06-08 post-prune plan verification:
  - Non-mutating command: `npm run test:db:refresh:plan -- --json`.
  - Result: plan succeeded with ASG min/max/desired `1`, one discovered instance `i-0a8be782ed8604211`, `ssmOnline=true`, and restore target `nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com:3306/iset_intake`.
  - No database restore was run; this only verified the host-discovery path after TEST was pruned.
- 2026-05-29 TEST sandbox demo reset:
  - Pre-reset live-data counts: `159` clients, `133` cases, `57` applications, `66` dynamic drafts, `133` messages, and `1784` document rows.
  - Maintenance handling: set a Test and Training in-app warning for all surfaces, enabled the ALB fixed-response maintenance page for admin and portal, restored normal forwarding after DB refresh, then cleared the warning.
  - Reset command: `npm run test:db:refresh -- --source-env dev --skip-smoke --yes`.
  - Manifest: `tmp/path-test-db-refresh/20260529-115918--2026-05-29T11-59-23-602Z.json`.
  - Result: snapshot build, upload, DB restore, canonical schema apply, S3 snapshot cleanup, and local snapshot cleanup all succeeded.
  - Post-reset counts: `0` clients, `0` cases, `0` applications, `0` dynamic drafts, `0` messages, `0` documents, `0` shared users, and `0` staff profiles. Seed TEST staff/demo identities before expecting admin sign-in.
  - Post-reset smoke: `npm run path:deploy:smoke -- --env test` reported both admin targets healthy on port `5001` and both portal targets healthy on port `5000` under the pre-prune two-instance TEST shape.
  - Follow-up correction: the original DEV-derived safe-data allowlist preserved `70` `budget_pot` rows, `65` `budget_pot_region` rows, and `12` `budget_spend_curve` rows. These TEST rows were deleted on 2026-05-29, and `src/lib/testDbSourceSnapshotBuilder.js` was updated so future resets exclude `budget_*` data.
  - Second follow-up correction: cleared leftover generated CFA rows (`cfa_series`, `cfa_version`, `cfa_version_documents`), PTMA contact rows, `component_template_backup`, and tutorial progress. The reset builder was updated so future DEV-derived TEST refreshes exclude those rows too.
  - TEST identity overlay was reapplied after cleanup. The only preserved login-capable staff/shared-user identities are `bill@sillery.co.uk` (`System Administrator`) and `program.admin@awentech.ca` (`NWAC Administrator`).
  - Demo budget scaffold: Bill published a three-pot TEST budget hierarchy for fiscal year `2026-2027`. The demo-ready state is `MNBC-ISET` (`ISET Program`, parent, `$1,000,000`) with two BC-linked child funding streams: `MNBC-ISET-CRF` (`CRF`, `$800,000`, GL `EXT-GL-001`) and `MNBC-ISET-EI` (`EI`, `$200,000`, GL `EXT-GL-002`). The accidental `CFA` label/code was corrected to `CRF`, stale budget draft/snapshot rows were cleared, and finance transactions were left to the MNBC sandbox demo seed.
  - MNBC sandbox demo seed: `sql/ops/test-seed-mnbc-sandbox-demo-20260529.sql` now seeds six synthetic Metis, BC-based applicants using controlled `demo-mnbc-*@awentech.ca` addresses, no applicant Cognito subjects, no PTMA rows, and all six cases assigned to `program.admin@awentech.ca` / staff profile `57180`. The seed covers application states `submitted`, `in_review`, `docs_requested`, `pending_approval`, and two approved/active case-management files; it also creates Participant Details snapshots/application-form `answers`, two action plans, two interventions, one submitted EI living-allowance payment packet, one ILMP participant-submission queue row for Eva Belcourt, two sandbox secure messages, four case tasks, and two internal notes. The seed is idempotent for `source = test_mnbc_sandbox_demo_20260529`.
  - Participant Details correction: the seed was rerun after adding case-level participant snapshot fields and application payload `answers`. Verification showed `0` missing first names, DOBs, BC province snapshots, Metis identity snapshots, `applicationAnswers`, or `applicationPersonal` payloads across all six `MNBC-DEMO-%` cases; Eva Belcourt (`MNBC-DEMO-0005`) now has `Eva Christine Belcourt`, DOB `1983-02-07`, `she/her`, `female`, Metis Nation of British Columbia affiliation, and Vancouver, BC address in the case snapshot.
  - Budget visibility correction: the demo funding lines were correctly assigned to `MNBC-ISET-CRF` and `MNBC-ISET-EI`, but the budget hierarchy reads `budget_pot` rollup columns sourced from `finance_transaction` rows. The seed now creates three demo ledger rows and refreshes the MNBC rollups: parent `MNBC-ISET` committed `$4,450.00`, actual `$3,000.00`; CRF committed `$3,200.00`, actual `$3,000.00`; EI committed `$1,250.00`, actual `$0.00`.
  - Finance/ILMP config correction: after the cleanout, TEST was missing finance runtime rows for payment type mapping, payment evidence rules, payee-type options, email routing, and assessment costing defaults. These rows were restored from DEV on 2026-05-29 and `src/lib/testDbSourceSnapshotBuilder.js` now preserves them during future DEV-derived TEST refreshes. Verification showed `14` payment types, `20` intervention mappings, `14` evidence rule entries, and `8` payee-type options. The ILMP participant queue now has `1` visible MNBC demo row: Eva Belcourt (`MNBC-DEMO-0005`), `needs_review` / `pending`; Farah remains out of the queue because her EI intervention is planned/future.
  - Post-seed smoke: `npm run path:deploy:smoke -- --env test` reported both admin targets healthy on port `5001` and both portal targets healthy on port `5000` under the pre-prune two-instance TEST shape. Since 2026-06-08, one healthy registered target per surface is the normal low-cost TEST expectation.

## 4. Rollback Strategy
- Enable Aurora automated snapshots (7-day retention).
- If refresh fails, restore from latest snapshot (`aws rds restore-db-cluster-to-point-in-time`) and reattach reader instances.
- Maintain last-known-good dump (tagged) for quick re-apply.

## 5. Future Enhancements
- Integrate schema validation to detect drift before restore.
- Add option to seed anonymized synthetic applicants for load testing.
- Build GitHub Actions workflow to trigger refresh after new migrations merge.

Owner: _(add name)_  
Last updated: 2026-06-08
