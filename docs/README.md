# Documentation Index

Status: directory-level index for agent-facing project memory, source artifacts, and historical material.

Start with `../AGENTS.md` and `docs/AGENTS.md` before using any directory below. The docs tree is intentionally mixed: some files are maintained guidance, some are source/reference artifacts, and some are historical notes retained for provenance.

## Directory Gates

- `meta/`: project-memory controls, thread index, changelog, release notes log, and cleanup audit.
- `architecture/`: architecture notes and roadmap/proposal material; verify against source before acting.
- `assignment/`: staff assignment/reference notes.
- `auth/`: current auth notes plus historical root-cause and migration plans.
- `change-requests/`: historical/source CR material.
- `components/`: component contracts, authoring patterns, and custom component infrastructure notes.
- `dashboards/`: dashboard reference docs; verify against current page/widget source.
- `data/`: maintained data docs plus generated dumps, reference datasets, and temporary source artifacts.
- `features/`: feature-level docs; mixed current/historical.
- `financial reporting requirements/`: external reporting reference artifacts.
- `guides/`: maintained how-to docs; verify commands and paths before acting.
- `inventory/`: inventory/scope matrices; often point-in-time.
- `ops/`: operational runbooks and deployment/environment guidance.
- `planning/`: active plans plus historical design notes and handoffs.
- `prompts/`: prompt snippets/source material, not project behavior.
- `requirements/`: source requirements, specs, and applicant form artifacts.
- `runtime/`: runtime/workflow/event design notes; verify against code.
- `testing/`: UAT prompts/checklists and test reference material.
- `training/`: source training/reference material.
- `widgets/`: widget-level reference docs.
- `workflows/`: workflow-level reference docs.

When a directory has its own `README.md`, read that gate before reading individual files in the directory.

## Maintenance Checks

- Run `python3 scripts/check-doc-links.py` after reference-heavy documentation cleanup. It scans both this admin docbase and `../ISET-intake/docs`.
- Run `git diff --check` before handing off documentation edits.
- Treat the link checker as a guardrail, not proof that a document is current; source/code verification still wins.
