# STOP: NEVER GUESS DATABASE SCHEMA OR SQL

This is the first and non-negotiable instruction for every agent working in this repository.

## STOP AGAIN: CHECK THE FINISHED SQL AGAINST LIVE SCHEMA BEFORE EXECUTION

- **TESTS, SMOKES, FIXTURE SEEDERS, AND CLEANUP SCRIPTS ARE NOT EXEMPT.** Prove the live target and DDL first, guard every finished non-metadata statement, and never run cleanup SQL after a schema-preflight failure that occurred before fixture mutation.
- **OUTPUT ALIASES AND METADATA PROBES ARE NOT EXEMPT.** An invented alias can itself be reserved or invalid. Prefer the database's native metadata labels; if an alias is essential, quote and validate it for the exact live engine before relying on it. A failed identity/DDL probe authorizes only corrected metadata discovery, never ordinary reads, cleanup, or mutation.
- **SUBQUERIES AND SMOKE ASSERTIONS ARE NOT SEPARATE SCOPES.** In any statement that mentions more than one table, qualify every column with its live-DDL-proven table alias, including columns inside scalar or correlated subqueries. A column name that exists on several tables is ambiguous even when each reference appears inside a different subquery.
- Retrieving live DDL is not enough. Immediately before executing every non-metadata SQL statement, compare every identifier in the finished SQL text against the live metadata captured for that exact target environment.
- Check one table at a time and explicitly confirm that every selected, filtered, joined, ordered, inserted, or updated column belongs to that table. Never carry a similarly named column from another table into the statement.
- If even one identifier, function, enum value, collation, or relationship cannot be pointed to in the current live metadata output, do not run the statement. Return to metadata-only discovery.
- For PROD repair work, put reviewed non-metadata SQL in an artifact under `sql/ops/`; do not improvise multi-table inventory or mutation SQL directly in a shell command.
- Acceptance fixtures must reproduce every live-schema-proven relationship enforced by the product. Resolve environment-owned references as one compatible set; never select the first row from one table and assume its related mapping exists.

- Never compose or execute SQL that references a table, column, index, constraint, relationship, enum, collation, function, or database object that has not been verified against the exact target environment in the current task. This prohibition includes read-only `SELECT` statements and applies to DEV, TEST, and PROD.
- Before any SQL, verify the target account/environment, database, host, and current user. Discover object names through live metadata. Before any mutation, inspect the full live DDL (`SHOW CREATE TABLE` plus any required `SHOW FULL COLUMNS`/index/constraint metadata) for every table touched and every joined or compared field.
- Code, ORM models, migrations, docs, earlier repairs, remembered names, and plausible naming conventions are not proof of the deployed schema. Do not turn a failed guessed query into a revised guess: stop ordinary work and return to schema-discovery queries only.
- PROD requires an additional fail-closed sequence: verified schema evidence, read-only inventory/preview, explicit identifiers and guards, reviewed apply and recovery artifacts, appropriate lock/warning/snapshot controls, and independent post-apply verification. User urgency or authorization never waives schema proof.
- If this rule is breached, stop immediately. Do not retry the mutation. Prove whether anything changed, roll back or recover if needed, clear temporary locks/warnings/procedures, tell Bill plainly, and restart from live schema discovery only after the failure has been reviewed.

# Agent Entry Point

Read `docs/AGENTS.md` first. Treat it as the required project entry point before making code, database, deployment, or documentation changes in this repository.

This repo uses the docs under `docs/` as persistent project memory for future short task-based AI threads. Follow the maintenance rules linked from `docs/AGENTS.md` and keep that project memory current when your work changes behavior, schema, architecture, operations, or active project state.
