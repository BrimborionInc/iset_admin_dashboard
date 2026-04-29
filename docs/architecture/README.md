# Architecture Docs

Status: mixed architecture notes, proposals, and roadmap material.

Use these docs to understand architectural intent and historical decisions, but verify current behavior against code, migrations, deployment scripts, and environment checks before implementing.

## Current Use

- `case-lifecycle-operating-model.md`: case/application lifecycle operating model reference.
- `migration-runner-overview.md`: migration runner architecture; verify against `isetadminserver.js` and `scripts/path-schema-migrate.js`.
- `prod-architecture-roadmap.md`: roadmap material, not guaranteed current implementation.
- `public-portal-rebuild-proposal.md`: proposal material; current TEST/PROD portal behavior remains in `../ISET-intake` unless `docs/AGENTS.md` says otherwise.
- `integrations/`: integration architecture notes.

## Cleanup Rule

When touching architecture docs, add a status line such as `current`, `proposal`, `roadmap`, `historical`, or `needs verification`.
