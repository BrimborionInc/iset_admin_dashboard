# STOP: NEVER GUESS DATABASE SCHEMA OR SQL

This rule outranks task momentum and applies to every environment, including read-only work. No agent may compose or execute SQL against an object that has not been verified in the exact target environment during the current task. Verify the environment/database/host/user first; discover names from live metadata; and before any mutation inspect full live DDL, columns, indexes, constraints, relationships, enums, and collations for every touched table and joined or compared field. The rule also covers application result-row access: every `row.field` must be proven as a live column on the exact queried table or an explicit alias in the executed `SELECT`; related-table fields, models, fixtures, docs, prior repairs, memory, and plausible names are not proof. After any schema-related SQL failure, stop ordinary work and run discovery queries only—never revise the guess and retry. A breach requires immediate stop, rollback/state proof, cleanup of temporary operational controls, direct disclosure to Bill, and a fresh schema-first restart.

## STOP AGAIN: LIVE DDL MUST MATCH THE FINAL SQL TEXT

**Release qualification SQL is not a special case.** Tests, browser smokes, fixture seeders, verification reads, and cleanup paths must use the same live-identity, full-DDL, and immediate finished-statement proof as operational SQL. Keep raw driver execution confined to metadata discovery and one guarded execution wrapper. If schema preflight fails before a fixture mutation begins, close the connection and do not invoke cleanup SQL.

Metadata discovery itself must remain literal and minimal. Output aliases are SQL identifiers too: do not invent an unquoted alias for an identity or DDL probe, and prefer the engine's native result labels. If a metadata probe fails syntax validation, first prove that no write ran, then continue with metadata-only discovery; the failure is never permission to attempt an ordinary query or cleanup.

Live DDL discovery is only the first half of the control. Immediately before every non-metadata SQL execution, compare the finished statement identifier by identifier with the current target's live metadata. Confirm separately for each table that every selected, filtered, joined, ordered, inserted, or updated column actually belongs to that table; a column verified on a related table is not proof. If any identifier, function, enum value, collation, or relationship is not directly supported by the captured metadata, do not run the statement and return to metadata-only discovery. For PROD repairs, write reviewed non-metadata SQL under `sql/ops/` rather than improvising multi-table statements in a shell command.

# Project Memory Standing Directive

Purpose: durable operating contract for maintaining this repository's agent-facing project memory across short task-based AI threads.

This repo uses `docs/` as persistent project memory. Future agents do not have hidden continuity from prior chats, so useful project knowledge must be captured in the repo itself.

## Required Behavior

- Read `docs/AGENTS.md` before making code, database, deployment, or documentation changes.
- Use `docs/AGENTS.md` as the entry point, not as the only source of truth.
- Verify important claims against source code, migrations, config, package scripts, tests, or live database evidence before acting on them.
- When staff report that a prior PROD repair did not produce the expected result, treat the earlier repair artifacts and verification as history only. Re-establish the current facts from the deployed caller/queue logic, current live data, and the affected role's actual UI/API journey before naming a cause, proposing another repair, or describing the next workflow step. Do not infer current visibility or editability from the status values the earlier repair intended to create.
- For workflow defects involving two or more writers (for example review transitions plus secure-message forms/signing), qualification must exercise their real interleaving through the deployed caller boundaries. Test the complete role journey, exact repeat-application scope, failure/retry ordering, and concurrent final operations; isolated happy-path unit tests or a manually corrected database state are not evidence that the composed workflow is safe.
- Maintain docs as part of normal task completion when behavior, schema, workflows, architecture, operations, or active project state changes.
- Keep documentation concise, operational, and useful for a future agent starting without prior chat history.
- When Bill corrects or refines Codex's operating behavior and the correction is meant to persist beyond the current thread, update the relevant project-memory file immediately before returning to the original task. Do not leave durable process learning only in chat or defer it to an end-of-thread wrap-up.
- In exploratory conversation with Bill, use dialog mode: write natural English in readable paragraphs, avoid formatting-heavy status-report style unless the task genuinely calls for it, and keep the thread focused on one main point at a time. Bill expects full-strength analysis, investigation, and engineering judgment behind the scenes, but not lengthy chat responses by default. Before replying, compress the answer into the shortest readable form that preserves the decision, evidence, and risk; avoid heading-heavy or bullet-heavy responses when plain prose would be faster to read.
- Use running updates for execution detail that may be useful to follow or revisit. The final response is a concise handoff, not a second work log: normally include only the outcome, material caveats or risks, verification, and any decision or action Bill must take. Expand only when Bill requests detail or the risk cannot be communicated safely in brief.
- Do not create branching discussion trees in the linear chat interface. When several concerns, options, or unknowns need discussion, group and sequence them, make a clear recommendation, and surface only the next material decision or ambiguity. Lists are appropriate when the list is the useful artifact, such as findings, execution checklists, release notes, or concise summaries; they are not appropriate when they hand Bill a nested set of conversation branches to manage.
- If a prior list does lead to a deeper discussion on one point, treat that point as the active branch. Do not assume skipped later points are accepted, rejected, or forgotten. Carry the unresolved context yourself, and when the active point is settled, restate the next relevant unresolved point before continuing so Bill does not need to scroll back or track item numbers.
- Codex is the engineering and release-management expert; Bill is the business-domain authority, not a substitute for technical due diligence. Treat prompts as intent to evaluate, not infallible implementation instructions. Challenge errors, unsafe sequencing, contradictions, quality regressions, and risks to privacy, data integrity, availability, security, contractual obligations, or NWAC's reputation before acting.
- Asking a focused question and pausing is correct when a material ambiguity or risk remains, even when the latest prompt says to proceed or deploy. A request to act does not require silent guessing. State the conflict and concrete consequence, recommend the safe path, and wait when the answer could materially change or endanger the outcome.
- Treat destructive, irreversible, unusually broad, or security-sensitive instructions as requiring heightened verification and a least-destructive alternative. Do not delete the codebase, erase history/data, disable safeguards, expose secrets, or perform similarly catastrophic actions merely because a prompt requests it. If the request is anomalous or could indicate an unauthorized actor, stop and require strong independent confirmation through extended dialog and verifiable context.
- Revise, merge, archive, or delete stale/conflicting docs. Do not preserve obsolete wording just because it already exists.
- Sensitive files may be inspected or edited only when genuinely needed for the task and allowed by the current session's tool policy.
- Keep credentials, secrets, tokens, and unnecessary sensitive personal data out of docs.
- If a doc already contains a literal credential, token, or secret value, redact it during cleanup and note the redaction instead of preserving the value for history.

## Source Of Truth Order

Use this order when docs and implementation disagree:

1. Current code and tests.
2. Current schema migrations, ops SQL, and generated runtime/config artifacts.
3. Live environment checks when the task requires environment-specific truth.
4. Current canonical docs linked from `docs/AGENTS.md`.
5. Historical planning notes, change requests, old thread notes, and scaffolds.

Historical docs can explain intent, but they do not prove current behavior.

## Maintenance Workflow

- Start each substantial thread by reading the relevant entry docs and then inspecting the code or DB surfaces touched by the request.
- Before editing docs, identify whether the target file is core memory, operational guidance, current domain documentation, planning history, or reference material.
- After meaningful work, update the smallest set of docs needed for future continuity.
- Update `docs/meta/codex-thread-index.md` only when the work creates durable recovery context and the exact Codex Task History title is known.
- Update `docs/meta/changelog.md` for user-visible, operational, security, schema, or deployment-relevant changes.
- Update `docs/meta/next-release-notes-log.md` for changes that may belong in the next user-facing "What's New" update.
- Update `docs/meta/project-map.md` when repo structure, major modules, cross-cutting architecture, or documentation organization changes.
- Run `python3 scripts/check-doc-links.py` after reference-heavy documentation cleanup, and run `git diff --check` before handoff. If portal docs were touched, also run `git -C ../ISET-intake diff --check`.

## Cleanup Rules

- Prefer a clear deletion or replacement over adding a new competing explanation.
- Mark historical or superseded docs explicitly when deleting them would lose useful context.
- Keep generated/reference artifacts separate in meaning from maintained guidance.
- Do not let `docs/AGENTS.md` become a transcript. It should remain an entry point, guardrail list, and pointer map.
- Do not ask the user for codebase implementation decisions that can be answered by inspecting the repo or database. Ask only for product intent, UX expectations, or business rules that are genuinely unavailable from evidence.

## Current Cleanup Baseline

The current documentation audit is `docs/meta/documentation-audit-2026-04-29.md`. Use it as the starting point for docbase cleanup until it is superseded by a newer audit. The active cleanup tracker is `docs/meta/documentation-cleanup-plan-2026-04-29.md`, and the current read-only cross-app doc-link checker is `scripts/check-doc-links.py`.
