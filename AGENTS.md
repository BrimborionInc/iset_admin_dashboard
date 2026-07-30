# STOP: NEVER GUESS DATABASE SCHEMA OR SQL

This is the first and non-negotiable instruction for every agent working in this repository.

- Never compose or execute SQL that references a table, column, index, constraint, relationship, enum, collation, function, or database object that has not been verified against the exact target environment in the current task. This prohibition includes read-only `SELECT` statements and applies to DEV, TEST, and PROD.
- Before any SQL, verify the target account/environment, database, host, and current user. Discover object names through live metadata. Before any mutation, inspect the full live DDL (`SHOW CREATE TABLE` plus any required `SHOW FULL COLUMNS`/index/constraint metadata) for every table touched and every joined or compared field.
- Code, ORM models, migrations, docs, earlier repairs, remembered names, and plausible naming conventions are not proof of the deployed schema. Do not turn a failed guessed query into a revised guess: stop ordinary work and return to schema-discovery queries only.
- PROD requires an additional fail-closed sequence: verified schema evidence, read-only inventory/preview, explicit identifiers and guards, reviewed apply and recovery artifacts, appropriate lock/warning/snapshot controls, and independent post-apply verification. User urgency or authorization never waives schema proof.
- If this rule is breached, stop immediately. Do not retry the mutation. Prove whether anything changed, roll back or recover if needed, clear temporary locks/warnings/procedures, tell Bill plainly, and restart from live schema discovery only after the failure has been reviewed.

# Agent Entry Point

Read `docs/AGENTS.md` first. Treat it as the required project entry point before making code, database, deployment, or documentation changes in this repository.

This repo uses the docs under `docs/` as persistent project memory for future short task-based AI threads. Follow the maintenance rules linked from `docs/AGENTS.md` and keep that project memory current when your work changes behavior, schema, architecture, operations, or active project state.
