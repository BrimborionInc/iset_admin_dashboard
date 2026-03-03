# nForm Extraction Plan

Purpose: Define a repeatable plan to extract nForm-related functionality from the current PATH-aligned workspace into a new standalone workspace at `X:\nForm` (`/mnt/x/nForm`).
Audience: Engineering and operations teams maintaining PATH, nForm, and shared services.
Last Updated: 2026-02-26
Status: Planned

## Context Snapshot
Current top-level workspace (`/mnt/x/ISET`) includes multiple repositories/folders:
- `admin-dashboard`
- `ISET-intake`
- `iset-public-portal`
- `shared`
- `intacct-mock-service`
- Additional workspace/config artifacts

Extraction target:
- New base folder: `X:\nForm` (`/mnt/x/nForm`)

## Objectives
- Isolate nForm features and dependencies from PATH-oriented code.
- Copy only required elements into the new workspace.
- Reduce cruft (dead code, legacy scripts, stale docs, one-off artifacts).
- Preserve runtime behavior for nForm workflows during and after extraction.

## Non-Objectives (Phase 1)
- Full toolchain migration (for example, Webpack to Vite) before extraction stabilizes.
- Broad architecture redesign unrelated to nForm extraction.
- Rewriting stable modules solely for style/structure.

## Guardrails
- Keep `npm` as package manager during extraction.
- Prefer minimal-change stabilization first, then optional modernization.
- Do not remove or mutate PATH source of truth until nForm workspace is validated.
- Use a manifest-driven copy process so extraction is auditable and repeatable.

## Extraction Strategy
Primary strategy: `A -> B`
- `A` (bootstrap): Copy the full working codebase into `X:\\nForm` first to preserve runtime behavior.
- `B` (refine): Remove PATH/ISET-specific capabilities selectively using a reviewed manifest.

Why this strategy:
- Reduces risk of missed hidden dependencies during initial move.
- Keeps a runnable baseline while classification and cleanup proceed.
- Produces a safer path to the same end-state as pure selective copy.

Not selected for Phase 1:
- Pure `B` from day one (copy only nForm subsets) because dependency misses are more likely and recovery is slower.

## Phase Plan

### Phase 1: Scope Definition
Deliverables:
- `docs/planning/nform-scope.md`
- In/out matrix identifying nForm vs PATH-only areas.

Actions:
1. Identify all user-facing nForm capabilities and related backend flows.
2. Classify modules as `in`, `out`, or `needs-decision`.
3. Capture open questions blocking classification.

Exit Criteria:
- Scope reviewed and approved.

### Phase 2: Dependency Inventory
Deliverables:
- `docs/planning/nform-dependency-map.md`

Actions:
1. Map frontend entry points, routes, widgets, and shared components used by nForm.
2. Map backend endpoints, services, data access, jobs, and integrations.
3. Identify cross-repo dependencies (`shared`, `ISET-intake`, `iset-public-portal`, etc.).

Exit Criteria:
- Known runtime and build dependencies documented.

### Phase 3: Copy Manifest
Deliverables:
- `docs/planning/nform-copy-manifest.md`
- `docs/planning/nform-copy-manifest.json`

Actions:
1. Build file/folder list tagged `keep`, `optional`, `drop`.
2. Mark owner/rationale for each ambiguous area.
3. Add exclusion rules for obvious cruft (temp logs, backups, one-off patches, generated noise).

Exit Criteria:
- Manifest approved for dry run.

### Phase 4: Dry-Run Extraction
Deliverables:
- Dry-run copy log
- `docs/planning/nform-extraction-dry-run.md`

Actions:
1. Create `/mnt/x/nForm` structure.
2. Perform full bootstrap copy of source workspace into `/mnt/x/nForm` (strategy `A`).
3. Produce before/after tree and file count summary.

Exit Criteria:
- Dry run completes with a runnable baseline in `/mnt/x/nForm`.

### Phase 5: Selective Prune (A -> B)
Deliverables:
- `docs/planning/nform-prune-manifest.md`
- `docs/planning/nform-prune-log.md`

Actions:
1. Apply manifest-driven removals for PATH/ISET-specific modules.
2. Remove known cruft categories (stale backups, temp logs, one-off patch files, obsolete docs).
3. Track each removal with rationale and rollback note.

Exit Criteria:
- PATH/ISET-specific code is removed or isolated; nForm core remains runnable.

### Phase 6: Standalone Stabilization
Deliverables:
- Working `nForm` workspace with updated local config
- `docs/planning/nform-stabilization-notes.md`

Actions:
1. Fix imports/path aliases/package scripts/config references.
2. Replace PATH-coupled config defaults with nForm-specific values.
3. Remove unresolved PATH-only references.

Exit Criteria:
- Local install/build/start succeeds for core nForm flows.

### Phase 7: Validation and Cleanup
Deliverables:
- `docs/planning/nform-validation-report.md`
- `docs/planning/nform-cruft-removal-log.md`

Actions:
1. Run available tests/lint/build checks.
2. Smoke-test key nForm workflows.
3. Remove dead files and stale docs discovered during validation.

Exit Criteria:
- No blocker defects for baseline nForm operation.

### Phase 8: Handoff and Next Modernization Step
Deliverables:
- `docs/planning/nform-handoff-summary.md`
- Optional `docs/planning/nform-vite-migration-plan.md`

Actions:
1. Publish final keep/drop report and risk register.
2. Decide on post-stabilization migration (for example, Vite).

Exit Criteria:
- nForm extraction complete and ready for ongoing iteration.

## Decision Log (to maintain during execution)
- Decision: Keep `npm` during extraction; evaluate Vite after stabilization.
  - Reason: Reduces simultaneous change risk.
  - Date: 2026-02-26
- Decision: Manifest-first extraction.
  - Reason: Traceability and rollback confidence.
  - Date: 2026-02-26
- Decision: Use `A -> B` approach (full copy, then selective PATH/ISET pruning).
  - Reason: Faster bootstrap with lower break risk than pure selective copy.
  - Date: 2026-02-26

## Initial Risks
- Hidden PATH coupling in shared modules.
- Environment/config drift between old and new workspaces.
- Incomplete copy if dependency map misses dynamic imports or runtime-loaded templates.

## Mitigations
- Add dependency verification during dry run.
- Keep extraction script and manifest under version control.
- Validate with workflow-focused smoke tests before declaring cutover readiness.

## Immediate Next Steps
1. Produce `nform-scope.md` with in/out classification.
2. Build dependency map across relevant repos.
3. Draft copy manifest for approval before performing copy.
