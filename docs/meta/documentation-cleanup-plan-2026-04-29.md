# Documentation Cleanup Plan

Status: initial cross-app documentation cleanup pass complete; ongoing maintenance remains.
Owner: Codex in future task-based threads.
Created: 2026-04-29.
Audit baseline: `docs/meta/documentation-audit-2026-04-29.md`.
Scope: `X:\ISET\admin-dashboard\docs` and `X:\ISET\ISET-intake\docs` as one cross-app Codex memory base, with admin and portal docs kept linked but not duplicated.

Purpose: persistent execution tracker for the cross-app docbase cleanup effort. This file records what was completed in the 2026-04-29 cleanup pass and what remains as ongoing maintenance.

## Scope Rule

The historic project memory base spans both repositories:

- Admin dashboard docs: `docs/`
- Current public portal docs: `../ISET-intake/docs/`

The cleanup objective is to transform both into a persistent Codex-oriented repository of cross-thread knowledge. Do not treat portal docs as merely external references. For portal/runtime/auth/intake behavior, `../ISET-intake/docs/AGENTS.md` and the portal `docs/system/**` / `docs/portal/**` tree are in scope and must be curated alongside admin docs.

Keep app-specific implementation detail in the relevant repo's docs. Cross-link rather than copying large sections between docbases.

## Completion Rule For This Pass

This cleanup pass may only be marked complete when all of these are true:

- Entry-point docs are short enough to read at thread start and only contain durable guardrails plus links.
- Every top-level docs directory in both admin and portal docbases has a README/gate or a documented equivalent that classifies the directory and warns about stale/source/generated material where relevant.
- High-risk operational docs have current status/date lines and have been checked against current scripts, package commands, or live environment facts where needed.
- Planning/change-request docs are triaged into current, historical, superseded, source artifact, or delete/archive candidate.
- Broken local and cross-repo Markdown references are either fixed or explicitly documented as intentional placeholders/planned outputs.
- Obsolete duplicate docs have been deleted or archived, not merely labeled.
- Generated dumps, source binaries, training/source artifacts, and maintained guidance are clearly separated.
- `python3 scripts/check-doc-links.py` and `git diff --check` pass.

These criteria were met for the initial 2026-04-29 cleanup pass. This does not mean every narrative claim in every domain doc has been re-proven against source; future domain work should still verify affected docs against code, schema, package scripts, tests, or live environment evidence.

## Progress Summary

| Area | Status | Notes |
|---|---|---|
| Entry discovery | Complete for first pass | Root `AGENTS.md` now points to `docs/AGENTS.md`. |
| Project-memory directive | Complete for first pass | `docs/meta/standing-directive.md` rewritten as maintenance contract. |
| Cleanup audit | Complete for first pass | `docs/meta/documentation-audit-2026-04-29.md` records inventory, risks, and queue. |
| Directory gates | Complete for top-level dirs | All top-level `docs/*/` directories now have README gates. |
| Broken-reference tooling | Complete for cross-app first pass | `scripts/check-doc-links.py` now scans admin and portal docbases and is passing. |
| Portal docbase scope | Complete for first pass | `../ISET-intake/docs` is explicitly in scope; inventory and README gates added. |
| High-risk stale references | Complete for first pass | Broken/stale local and cross-repo references were fixed where found; deeper domain truth audits remain normal maintenance when a domain is next touched. |
| `docs/AGENTS.md` reduction | Complete for first pass | Operational command block and subsystem status blocks moved out or replaced with canonical pointers; file is down to roughly 300 lines. |
| Operational docs audit | Complete for first pass | All admin and portal ops Markdown docs now have `Status` and `Last reviewed` lines; deployment command names were checked against current package scripts; historical environment notes are labeled; literal DB credentials found in docs were redacted. Live AWS state was not exhaustively re-verified. |
| Data/reference artifact separation | Complete for first pass | `docs/meta/data-artifact-retention-2026-04-29.md` now sets first-pass retention rules; `docs/data/DB-Structure-Dump/README.md` and `docs/data/temp/README.md` classify generated/source artifacts. |
| Planning/change-request triage | Complete for first pass | `docs/meta/planning-cr-archive-triage-2026-04-29.md` now classifies planning docs, CR docs, DOCX source artifacts, portal archive docs, and first delete/archive candidates. |
| Large meta-log policy | Complete for first pass | `docs/meta/meta-log-retention-2026-04-29.md` sets search/update/split rules for admin and portal meta logs. |
| Deletion/archive pruning | Complete for obvious first-pass candidates | Three superseded planning files were replaced with redirect stubs. CR source artifacts and binary artifacts remain retained pending narrower evidence-backed cleanup. |

## Completed In Current Thread

- Added root `AGENTS.md`.
- Replaced stale root `README.md`.
- Reworked `docs/meta/standing-directive.md`.
- Added `docs/meta/documentation-audit-2026-04-29.md`.
- Added README gates across top-level docs directories.
- Added `scripts/check-doc-links.py`.
- Fixed stale references across database docs, public-portal security, file uploads, intake authoring, AWS TEST docs, input-JSON CR notes, finance planning, ESDC evidence paths, and PROD Terraform runbook link.
- Marked `docs/meta/codex-crib-sheet.md` and `docs/meta/level0-document-checklist.md` as superseded/historical.
- Marked nForm extraction/scope notes as historical/planned.
- Corrected planned-status component docs for `signature-ack` and file-upload conditional rules.
- Moved DB/TEST/PROD/AWS profile command detail out of `docs/AGENTS.md` into `docs/ops/agent-operational-access.md`.
- Added `docs/data/temp/README.md`.
- Explicitly expanded this plan to include `../ISET-intake/docs`.
- Inventoried `../ISET-intake/docs` at 50 files: 49 Markdown and 1 HTML reference example.
- Added README gates across the portal docbase (`../ISET-intake/docs/**/README.md`) while preserving its `portal/`, `system/`, `archive/`, and `meta/` structure.
- Extended `scripts/check-doc-links.py` to scan both admin and portal docbases and understand docs-root-relative portal references.
- Fixed the stale portal intake-form reference to the admin intake-authoring doc.
- Compacted `docs/AGENTS.md` by replacing duplicated subsystem status sections with pointers to canonical dashboard/feature/data/ops docs.
- Completed the first high-risk ops docs audit pass across admin `docs/ops/**` and portal `../ISET-intake/docs/system/ops/**`.
- Added `Status` and `Last reviewed` metadata to every ops Markdown doc in scope, marking current operator guides separately from historical TEST/prod design/progress records.
- Checked documented deploy/data/migration command names against current admin and portal `package.json` scripts.
- Redacted literal DB password values from `docs/planning/thread-handoff-2026-03-02.md` and `docs/ops/environments/test-environment-progress.md`, and strengthened the standing directive to require redaction when future cleanup finds secrets in docs.
- Updated PROD portal hostname references in ops docs so `https://iset.nwac.ca/` is represented as the primary public portal hostname while `https://nwac-public.awentech.ca/` remains an alias/legacy hostname.
- Added `docs/meta/planning-cr-archive-triage-2026-04-29.md` as the first-pass triage index for admin planning docs, admin change-request docs, and portal archive docs.
- Linked the triage index from `docs/planning/README.md`, `docs/change-requests/README.md`, and `../ISET-intake/docs/archive/README.md`.
- Added historical status headers to the portal archive leaf docs and explicit superseded status headers to the Query Editor and document-model ERM planning notes.
- Recorded delete/archive candidates without deleting them: the superseded Query Editor planning note, document-model ERM adjustment note, public-intake renderer plan, overlapping CR-0003 finance cluster, and original CR DOCX files.
- Added `docs/meta/data-artifact-retention-2026-04-29.md` as the first-pass retention policy for generated schema dumps and tracked temp/source artifacts.
- Added `docs/data/DB-Structure-Dump/README.md`, classifying the 132 tracked SQL files as legacy generated schema snapshots, not maintained guidance.
- Updated `docs/data/README.md` and `docs/data/temp/README.md` to link the retention policy and warn that temp binary artifacts may contain sensitive client, program, or finance data.
- Added `docs/meta/meta-log-retention-2026-04-29.md` as the first-pass search/update/split policy for large admin and portal meta logs.
- Linked the meta-log retention policy from admin and portal meta README gates.
- Replaced three superseded planning files with redirect stubs: `docs/planning/query-editor-dashboard.md`, `docs/planning/document-model-erm-adjustment.md`, and `docs/planning/public-intake-renderer-plan.md`.
- Fixed the invalid text-encoding problem in `docs/planning/public-intake-renderer-plan.md` by replacing the obsolete plan body with a UTF-8 redirect stub.

## Ongoing Maintenance Queue

1. Optional deeper evidence-backed pruning for retained source artifacts, especially the CR-0003 finance cluster, original CR DOCX files, and data/temp binaries.
2. Optional deeper truth audit of high-impact domain docs against current source/schema when those domains are next touched.
3. Run `python3 scripts/check-doc-links.py` and `git diff --check` after each cleanup pass.

## Current Validation

Last validated during the 2026-04-29 superseded-planning-stub pruning pass:

- `python3 scripts/check-doc-links.py` passed.
- `git diff --check` passed.
- `git -C ../ISET-intake diff --check` passed.
- Ops metadata coverage check passed: no Markdown file under admin `docs/ops/**` or portal `../ISET-intake/docs/system/ops/**` is missing `Status` or `Last reviewed`.
- Targeted credential-redaction check passed for the literal DB password patterns found during this pass.
- Planning/CR/archive triage index link coverage passed through `scripts/check-doc-links.py`.
- Data-artifact retention links passed through `scripts/check-doc-links.py`.
- Meta-log retention links passed through `scripts/check-doc-links.py`.
- Superseded planning redirect stubs passed link and whitespace checks.

These checks validate formatting and local Markdown references only. They do not prove narrative docs are current.
