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
- Override the target instance with `--instance-id` if needed
- If the target app host is missing `mysql`, the script installs a client package through the instance's package manager before executing the query
- Output is streamed back from SSM command invocation stdout/stderr

## Verification performed

End-to-end execution was verified by running read-only SQL through SSM on `i-09fe8c219a4564040` and getting a successful result from the `iset_intake` database.

## Guardrails

- Default to read-only SQL unless the user explicitly asks for writes
- For data copy tasks from TEST to DEV, first export only the rows/columns needed, then load them into DEV using the documented DEV DB workflow in `docs/AGENTS.md`
- Older repo scripts currently reference retired instance IDs for test DB restore/deploy work; do not assume those IDs are current without re-checking AWS
