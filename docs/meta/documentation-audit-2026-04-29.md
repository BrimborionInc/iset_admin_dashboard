# Documentation Audit - 2026-04-29

Purpose: first-pass inventory and cleanup strategy for the agent-facing project memory layer. This is not a full truth audit of every document. It records the current shape of the admin `docs/`, the immediate risks, and the next cleanup order. The active execution tracker is `docs/meta/documentation-cleanup-plan-2026-04-29.md`, and it now explicitly includes the sibling public portal docbase at `../ISET-intake/docs/`.

## Verified Inventory

Checked from `/mnt/x/ISET/admin-dashboard` on 2026-04-29.

- `docs/` contains 402 files.
- The sibling public portal docbase `../ISET-intake/docs/` is also in scope for the broader cleanup plan. First-pass portal inventory on 2026-04-29 found 50 files: 49 Markdown and 1 HTML reference example. README gates have now been added across the portal docs directory tree.
- File types: 236 Markdown, 132 SQL, 8 DOCX, 6 PDF, 6 CSV, 5 XLSX, 4 TXT, 2 XSD, 2 XML, 1 SCH.
- Largest project-memory files:
  - `docs/meta/codex-thread-index.md` around 166 KB.
  - `docs/meta/changelog.md` around 153 KB.
  - `docs/planning/privacy-erm-cleanup-progress.md` around 132 KB.
  - `docs/AGENTS.md` around 115 KB.
  - `docs/meta/next-release-notes-log.md` around 86 KB.
- Top-level docs directories include `architecture`, `assignment`, `auth`, `change-requests`, `components`, `dashboards`, `data`, `features`, `guides`, `inventory`, `meta`, `ops`, `planning`, `requirements`, `runtime`, `testing`, `training`, `widgets`, and `workflows`.
- The repo previously had no root `AGENTS.md`; agents had to be told explicitly to open `docs/AGENTS.md`.
- `README.md` was a Create React App scaffold plus stale legacy appointment-procedure notes before the first cleanup continuation pass. It has now been replaced with a concise PATH admin-dashboard orientation.
- `docs/meta/standing-directive.md` previously mixed old interaction preferences with a broad documentation request; it has been replaced with a project-memory maintenance directive.
- `docs/meta/codex-crib-sheet.md` was an unlinked older quick-start with stale startup guidance. It has been replaced with a superseded-file redirect to the current entry path.
- `docs/meta/level0-document-checklist.md` is now marked as historical and points to the current document-model and document-type review docs.
- `docs/planning/README.md` and `docs/change-requests/README.md` now act as directory gates for mixed current/historical narrative docs.
- `docs/data/README.md`, `docs/requirements/README.md`, and `docs/training/README.md` now classify maintained docs separately from generated dumps, source artifacts, reference standards, and training material.
- `docs/ops/README.md` and `docs/guides/README.md` now classify operational/how-to docs and require command/path verification before acting.
- `docs/README.md` now acts as the top-level docs index, and the remaining top-level directories now have README gates for architecture, assignment, auth, components, dashboards, features, financial reporting requirements, inventory, meta, prompts, runtime, testing, widgets, and workflows.

## Working Classification

Use these classes while curating docs:

- Core memory: `docs/AGENTS.md`, `docs/meta/standing-directive.md`, `docs/meta/project-map.md`, `docs/meta/codex-thread-index.md`, `docs/meta/changelog.md`, `docs/meta/next-release-notes-log.md`.
- Operational runbooks: `docs/ops/**`, deployment guides, DB access guides, environment guides.
- Current architecture and domain docs: selected files under `docs/architecture/**`, `docs/data/**`, `docs/guides/**`, `docs/dashboards/**`, `docs/widgets/**`, and `docs/workflows/**`.
- Planning and historical notes: `docs/planning/**`, many `docs/change-requests/**`, and older implementation trackers. These may contain intent but must be verified against code before use.
- Reference/source artifacts: PDFs, DOCX, XSD/XML/SCH, CSV, XLSX, generated DB structure dumps, and training extracts. These are inputs or evidence, not agent instructions.
- High-risk stale material: generic scaffold docs, obsolete implementation plans, duplicated change-request narratives, old public/human documentation, and any doc that describes legacy schema/routes as current behavior.

## Immediate Risks

- `docs/AGENTS.md` is valuable but too large for a true entry point. It should gradually become a compact map of durable guardrails and pointers, with subsystem details moved to canonical domain docs.
- `docs/meta/codex-thread-index.md`, `docs/meta/changelog.md`, and `docs/meta/next-release-notes-log.md` are useful logs but large enough that future threads should search them by keyword rather than read them front to back.
- Many planning docs likely describe intended or historical behavior. Future agents must verify those claims against code, migrations, package scripts, and database checks.
- Generated/reference files under `docs/data/DB-Structure-Dump`, `docs/data/NOC*`, `docs/requirements`, `docs/training`, and `docs/financial reporting requirements` should not be mixed mentally with maintained agent guidance.
- Large legacy planning and tracker docs remain the next major source of stale guidance risk.
- The ops audit found literal DB password values in historical docs; those have been redacted. Future cleanup should treat any discovered credentials/tokens/API keys as defects to redact, not context to preserve.

## Cleanup Strategy

1. Keep the entry path discoverable:
   - Root `AGENTS.md` points to `docs/AGENTS.md`.
   - `docs/AGENTS.md` points to the standing directive, project map, thread index, and current audit.

2. Reduce contradiction before reducing volume:
   - Replace or quarantine obsolete directives.
   - Mark historical plans explicitly when they are not current.
   - Prefer deleting or merging stale docs over polishing them.

3. Curate by directory, not by one giant rewrite:
   - Start with `docs/meta` because it controls future agent behavior.
   - Then audit `docs/ops` and `docs/guides` because stale operational guidance has high blast radius.
   - Then audit `docs/data` and `docs/planning` against schema/migrations.
   - Finally compress or archive old `change-requests`, widget docs, workflow docs, and human-facing artifacts.

4. Preserve uncertainty:
   - If a doc claim has not been checked against current code or DB state, do not rewrite it as fact.
   - Use clear labels such as `Verified against source on YYYY-MM-DD`, `Historical`, or `Needs verification`.

5. Keep the memory layer small and useful:
   - Entry-point docs should be maps and guardrails.
   - Domain docs should own subsystem details.
   - Thread index entries should be recovery pointers, not transcripts.

## Next Cleanup Queue

- Split bulky `docs/AGENTS.md` subsystem detail into canonical domain docs while keeping links in place.
- Continue reviewing `docs/meta/project-map.md` for stale subsystem details; the first continuation pass fixed README, top-level directory claims, homepage summary, signature-ack planning language, session-state wording, and development-tracker caveats.
- Add status headers to old planning and change-request docs as they are touched: `current`, `historical`, `superseded`, or `needs verification`.
- Decide whether generated DB structure dumps belong under `docs/` long term or should move to generated artifacts excluded from source control.
- Triage `docs/change-requests/**` into current requirements, historical source artifacts, or deletable duplicates.
- Triage generated DB structure dumps for retention/move/delete policy. `docs/data/temp/` now has a README gate; the tracked binaries still need a later keep/archive/delete decision.

## First Cleanup Batch Applied

- Added root `AGENTS.md` as a discoverable entry point.
- Added an explicit project-memory section to `docs/AGENTS.md`.
- Replaced `docs/meta/standing-directive.md` with a current project-memory maintenance directive.
- Added this audit note and linked it from `docs/AGENTS.md`.
- Replaced the stale root `README.md` with current project orientation.
- Refreshed verified portions of `docs/meta/project-map.md` and marked the legacy development tracker as needing separate curation.
- Replaced `docs/meta/codex-crib-sheet.md` with a superseded redirect so historical searches do not find stale onboarding guidance.
- Marked `docs/meta/level0-document-checklist.md` historical so its older "current facts" do not compete with the current document model and canonical document-type review.
- Added `docs/planning/README.md` and `docs/change-requests/README.md` to classify those directories before future agents open stale narrative files.
- Added `docs/data/README.md`, `docs/requirements/README.md`, and `docs/training/README.md` to classify reference/source artifact directories before future agents treat them as maintained guidance.
- Added `docs/ops/README.md` and `docs/guides/README.md` to force verification of operational commands, paths, routes, and role assumptions before future agents act on how-to docs.
- Added `docs/README.md` and README gates for the remaining top-level docs directories so every major docs area now declares its status before future agents read individual files.
- Corrected stale high-risk statements in `docs/data/documents-model.md`, `docs/features/public-portal-security-features.md`, and `docs/dashboards/application-assessment-dashboard.md`.
- Corrected broken/stale references in database docs, public-portal security, file-upload architecture, intake-authoring, AWS TEST environment, and input-JSON CR notes so future agents land on current admin or `../ISET-intake` docs.
- Marked `docs/planning/nform-extraction-plan.md` and `docs/planning/nform-scope.md` as historical/planned and labeled their missing follow-up deliverables as planned outputs rather than existing files.
- Corrected planned-status component docs for `signature-ack` and file-upload conditional rules so future agents can distinguish implemented source anchors from remaining grouped-logic work.
- Corrected additional broken doc references in intake authoring, finance workflow planning, ESDC gap-analysis evidence paths, the PROD Terraform runbook, and an older runtime-config changelog entry.
- Added `scripts/check-doc-links.py` as a reusable read-only local Markdown reference check for future docbase cleanup threads.
- Moved DB/TEST/PROD/AWS profile command detail out of `docs/AGENTS.md` into `docs/ops/agent-operational-access.md`, leaving the entry point with concise guardrails and pointers.
- Added a README gate to `docs/data/temp/` so tracked binary source artifacts are not mistaken for maintained guidance.
- Added `docs/meta/documentation-cleanup-plan-2026-04-29.md` as the persistent progress tracker for the broader cleanup effort.
- Expanded the cleanup plan scope to include `../ISET-intake/docs` as part of the same cross-app Codex memory base.
- Added README gates across `../ISET-intake/docs`, fixed a stale portal-to-admin intake-authoring reference, and extended `scripts/check-doc-links.py` to validate both docbases.
- Compacted `docs/AGENTS.md` by replacing duplicated subsystem status sections with canonical doc pointers, reducing the entry point to roughly 300 lines.
- Added status/review metadata across admin and portal ops runbooks, checked documented deploy/data/migration command names against current package scripts, marked historical TEST/prod environment records, redacted literal DB credentials from historical notes, and updated PROD portal hostname references to include `iset.nwac.ca`.
- Added `docs/meta/planning-cr-archive-triage-2026-04-29.md` to classify the planning, change-request, and portal archive layer into current sources, current references, historical sources, superseded docs, source artifacts, and delete/archive candidates.
- Added `docs/meta/data-artifact-retention-2026-04-29.md` plus a `docs/data/DB-Structure-Dump/README.md` gate so generated schema snapshots and tracked temp binaries are classified as source/generated artifacts rather than maintained agent guidance.
- Added `docs/meta/meta-log-retention-2026-04-29.md` to set search/update/split rules for the large admin and portal meta logs without prematurely splitting them.
- Replaced the superseded Query Editor, document-model ERM, and public-intake renderer planning notes with redirect stubs to reduce duplicate stale guidance while preserving discoverable paths.
