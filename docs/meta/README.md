# Meta Docs

Status: project-memory control layer.

This directory contains the documents that govern how future agents recover context, maintain docs, and understand repo-level state.

## Current Control Files

- `standing-directive.md`: durable project-memory maintenance contract.
- `documentation-audit-2026-04-29.md`: current documentation cleanup audit and queue.
- `documentation-cleanup-plan-2026-04-29.md`: active execution tracker for the broader cross-app docbase cleanup effort, including `../ISET-intake/docs`.
- `meta-log-retention-2026-04-29.md`: retention/use policy for large meta logs.
- `project-map.md`: repo/module map.
- `codex-thread-index.md`: cross-thread recovery index.
- `changelog.md`: technical/user-visible change log.
- `next-release-notes-log.md`: working log for user-facing release notes.

## Historical Or Redirect Files

- `codex-crib-sheet.md`: superseded redirect kept for historical searches.
- `level0-document-checklist.md`: historical implementation log retained for provenance.

## Cleanup Rule

Do not add broad subsystem detail here unless it controls future-agent behavior. Prefer pointers to domain docs over duplicating implementation detail. Search large logs with targeted terms instead of reading them front to back.
