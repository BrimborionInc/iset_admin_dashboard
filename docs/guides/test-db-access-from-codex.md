# Test DB Access From Codex

Verified on 2026-03-28 from the Codex Linux sandbox.

## Current status

- Codex has a working AWS CLI profile for test: `nwac-test`
- Region: `ca-central-1`
- Direct TCP access from the sandbox to the test Aurora cluster is not expected
- Verified working path: run `mysql` on an SSM-managed `nwac-test-app` EC2 instance by using `aws ssm send-command`

## Why the indirect path is required

- The current test Aurora cluster is `nwac-test-db`
- The DB security group only allows MySQL `3306` from the app security group `nwac-test-app`
- On 2026-03-28 this was verified from AWS:
  - DB security group: `sg-0c40bbad564397261`
  - App security group: `sg-06630837f3494d641`
- Result: future Codex chats should assume "query test DB through SSM on an app host", not "connect straight from the sandbox"

## Verified working resources

- Live SSM-managed app instances observed on 2026-03-28:
  - `i-09fe8c219a4564040`
  - `i-0a8be782ed8604211`
- Both were tagged `nwac-test-app`
- The helper script auto-discovers a running online `nwac-test-app` instance instead of hard-coding one instance ID
- The local sandbox does not currently have `session-manager-plugin`, so `aws ssm start-session` is not the preferred automation path here

## Use the helper script

Preferred command for future Codex work:

```bash
scripts/run-test-sql-via-ssm.sh --sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='iset_intake';"
```

From a SQL file:

```bash
scripts/run-test-sql-via-ssm.sh --sql-file /path/to/query.sql
```

From stdin:

```bash
cat /path/to/query.sql | scripts/run-test-sql-via-ssm.sh
```

Notes:

- The script reads `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, and `DB_NAME` from repo-root `.env.test`
- The script uses AWS profile `nwac-test` and region `ca-central-1` by default
- `--sql-file` now stages the file through `s3://nwac-test-artifacts/ssm-sql/...` before execution so larger bundles do not exceed SSM document size limits
- Override the target instance with `--instance-id` if needed
- If the target app host is missing `mysql`, the script installs a client package through the instance's package manager before executing the query
- Output is streamed back from SSM command invocation stdout/stderr
- The higher-level config promotion entry point now lives in `scripts/path-data-sync.js`; that CLI uses this helper when the target environment is `test`

## Destructive TEST reset path

There is now a dedicated destructive reset command for TEST:

```bash
npm run test:db:refresh:plan -- --source-env dev
npm run test:db:refresh -- --source-env dev --yes
```

Notes:

- `scripts/path-test-db-refresh.js` is the operator entry point.
- `scripts/run-test-db-restore-via-ssm.sh` is the lower-level restore helper.
- The current implementation uses `nwac-test-artifacts/db-refresh/...` for uploaded dumps.
- `--source-env dev` now removes the old manual-dump prerequisite by having Codex generate the TEST baseline snapshot automatically from DEV.
- That DEV-derived snapshot is schema + allowlisted safe/reference data only, plus the published intake runtime row; applicant, case, message, payment, and identity-link rows are excluded by design.
- The helper reads DB credentials from `nwac-test-db-credentials`, but supplies the TEST host/name/port itself because the secret currently contains only `username` and `password`.
- The run is destructive: it drops and recreates `iset_intake`, restores the dump, runs canonical schema apply, and then runs TEST smoke unless skipped.
- Do not run it casually; TEST is disposable, but this still overwrites the live shared TEST database immediately.
- The same flow is available as part of the one-command TEST deploy path: `npm run path:deploy -- --env test --refresh-test-db --dataset intake-release --workflow-id 21 --yes`

## Large JSON export caveat

- On 2026-04-01, large JSON/hex exports through `aws ssm send-command` were observed truncating in `StandardOutputContent` at roughly 24 KB.
- Do not assume a multi-row export is complete just because the SQL itself succeeded on the remote host; verify the returned payload size/content locally.
- For large intake-form authoring pulls, prefer exporting one `step_component` row at a time and wrapping the JSON with:
  `REPLACE(TO_BASE64(CAST(JSON_OBJECT(...) AS CHAR(1000000) CHARACTER SET utf8mb4)), CHAR(10), '')`
- Reconstruct the rows locally after download instead of trying to stream a large JSON/hex blob back in one command.
- When the goal is to move TEST intake edits into DEV so DEV becomes the editing source of truth, pull authoring rows (`step`, `step_component`) in addition to any published runtime JSON you want as a reference snapshot.

## Verification performed

End-to-end execution was verified by running read-only SQL through SSM on `i-09fe8c219a4564040` and getting a successful result from the `iset_intake` database.

## Guardrails

- Default to read-only SQL unless the user explicitly asks for writes
- For data copy tasks from TEST to DEV, first export only the rows/columns needed, then load them into DEV using the documented DEV DB workflow in `docs/AGENTS.md`
- Older repo scripts currently reference retired instance IDs for test DB restore/deploy work; do not assume those IDs are current without re-checking AWS
