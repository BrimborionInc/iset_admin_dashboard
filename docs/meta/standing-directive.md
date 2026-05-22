# Project Memory Standing Directive

Purpose: durable operating contract for maintaining this repository's agent-facing project memory across short task-based AI threads.

This repo uses `docs/` as persistent project memory. Future agents do not have hidden continuity from prior chats, so useful project knowledge must be captured in the repo itself.

## Required Behavior

- Read `docs/AGENTS.md` before making code, database, deployment, or documentation changes.
- Use `docs/AGENTS.md` as the entry point, not as the only source of truth.
- Verify important claims against source code, migrations, config, package scripts, tests, or live database evidence before acting on them.
- Maintain docs as part of normal task completion when behavior, schema, workflows, architecture, operations, or active project state changes.
- Keep documentation concise, operational, and useful for a future agent starting without prior chat history.
- In exploratory conversation with Bill, use dialog mode: write natural English in readable paragraphs, avoid formatting-heavy status-report style unless the task genuinely calls for it, and keep the thread focused on one main point at a time.
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
