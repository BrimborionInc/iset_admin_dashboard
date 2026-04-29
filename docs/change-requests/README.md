# Change Request Docs

Status: historical/source material unless a current doc explicitly says otherwise.

First-pass triage index: `docs/meta/planning-cr-archive-triage-2026-04-29.md`.

This directory contains older CR writeups, addenda, implementation notes, and original DOCX source artifacts. These files are useful for intent and provenance, but they are not current implementation truth.

## How To Use

- Use these files to understand historical requirements or why a feature exists.
- Verify current behavior in code, schema, runtime config, tests, and live environment checks before acting.
- For current cross-thread context, search `docs/meta/codex-thread-index.md`.
- For shipped behavior, check `docs/meta/changelog.md` and the relevant current domain doc.
- For live PROD bug/change triage, use the in-app feedback tables and the workflow described in `docs/AGENTS.md`; do not rely on these old CR files as the queue.

## Cleanup Rule

When a change-request file is touched during future cleanup, classify it explicitly:

- `Status: historical source`
- `Status: superseded by <path>`
- `Status: partially implemented; verify before use`
- `Status: current requirement source`

Prefer linking to the current canonical feature, planning, or workflow doc instead of copying old CR text forward.
