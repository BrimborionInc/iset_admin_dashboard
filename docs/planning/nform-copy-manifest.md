# nForm v1 Extraction Manifest

Purpose: Define which current PATH paths inform nForm, how they must be handled, and where they belong in the target monorepo.
Audience: Engineers performing the extraction.
Last Updated: 2026-07-23
Status: Active path-level manifest. This is sufficient to control repository scaffolding; implementation will refine individual-file exceptions without broadening the agreed product boundary.
Machine-readable companion: `docs/planning/nform-copy-manifest.json`

## Classification

- `keep`: reusable with only path/package/name changes and verification.
- `split`: contains a reusable core that must be separated from PATH behavior before entering nForm.
- `rewrite`: current behavior proves the requirement but the implementation contract is unsuitable for nForm.
- `drop`: PATH, demo, generated, obsolete, or inactive material that must not enter nForm.
- `new`: required nForm capability with no suitable current implementation.

`split` never means copy the whole path and clean it later. Extract only the identified responsibility with focused tests.

## Repository Sources

- `admin`: `/home/bill/ISET/admin-dashboard`
- `portal`: `/home/bill/ISET/ISET-intake`
- `shared`: `/home/bill/ISET/shared`

## Target Shape

```text
nform/
  apps/
    staff-portal/
    public-portal/
    api/
  packages/
    auth/
    component-library/
    intake-authoring/
    intake-schema/
    intake-runtime/
    events/
    notifications/
    storage/
    ui/
  db/
    migrations/
    seeds/platform/
  infra/
  scripts/
  tests/
  docs/
```

## Controlling Decisions

1. Do not copy either monolithic server into nForm.
2. Do not import PATH migration history or data.
3. Do not import a published ISET schema or demo intake.
4. Do not write published runtime artifacts into source files.
5. Do not retain PATH role names, groups, schema qualifiers, workflow types, event catalogs, or business entities as defaults.
6. Preserve the two application surfaces while allowing their current React/router differences during v1.
7. Extract shared contracts first so staff preview, public runtime, backend validation, and publication compile against the same component/intake schema.

## Extraction Waves

### Wave 1: Contracts and clean persistence

- Create monorepo/package scaffolding.
- Implement the clean schema from `nform-v1-schema-and-extension-contract.md`.
- Extract intake/component schemas, validation, and publication contracts.
- Establish shared test fixtures without publishing a sample intake into the platform seed.

### Wave 2: Staff authoring

- Extract component and step editors.
- Extract intake graph editing, validation, preview, versioning, governance, publication, and rollback.
- Build a clean staff shell containing only platform surfaces.

### Wave 3: Public runtime

- Extract renderer/navigation/validation.
- Implement route/slug-based intake selection.
- Implement anonymous and authenticated session ownership.
- Implement optional authenticated save/resume.

### Wave 4: Submission and platform services

- Implement neutral completion, attachments, extension hook, durable event, and submissions registry.
- Extract generic notifications, storage, audit/events, and service announcements.

### Wave 5: Deployment and empty-platform validation

- Adapt AWS infrastructure/deployment mechanics.
- Bootstrap only the configured System Administrator.
- Run the acceptance invariants with temporary test-created intakes that are removed after tests.

## Explicit Exclusions

- PATH casework, application assessment, finance, payments, ESDC, ILMP, regional reporting, messaging tied to cases, watchlists, Intacct, Job Bank, document checklists, funding agreements, and signed ISET forms.
- VAC appointment previews or legacy appointment database artifacts. VAC is a downstream validation fork, not seed content.
- Admin `apps/web`, which is not the active staff application build.
- Build artifacts, archives, backups, generated workflow JSON, database dumps, repair scripts, and production/test data tooling.

## Required Verification Before Copying

- Every `split` extraction gets focused contract tests before it is copied into the target.
- Component contract tests must render identical semantics in staff preview and public runtime.
- Publication tests must prove immutable versions, authorization/governance, rollback, and no filesystem writes.
- Public runtime tests must cover anonymous and authenticated sessions without browser answer/history persistence.
- Completion tests must prove neutral-only writes, idempotency, attachment transfer, outbox emission, solution-hook atomicity, and rollback.
- A repository-wide forbidden-language/schema check must fail on PATH/ISET/NWAC business identifiers outside clearly marked historical documentation.

## Next Action

Use the JSON companion to scaffold the target directories and create a source-extraction checklist. Do not copy source until the clean schema migration and shared intake/component contract package exist.
