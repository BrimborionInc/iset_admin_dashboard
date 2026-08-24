# PATH Content-Production Source Pack

Status: current curated entry point for marketing and product-manual production.
Audience: Bill, ChatGPT Pro content projects, Codex support threads, reviewers, and documentation maintainers.
Last Updated: 2026-08-21

## Purpose

Use this directory as the controlled handoff between the PATH repositories and a ChatGPT Pro project that is producing marketing material or a product manual. It exists because the wider `docs/` tree is valuable project memory, but it mixes current guidance, implementation notes, plans, release evidence, and historical material.

This pack is current through **2026-08-21**. It is a curated publishing input, not a blanket statement that every source-repository feature is enabled in PROD.

## Local ChatGPT Desktop Project

A local project connected to this folder does not show the standard uploaded Project-instructions field in its Edit Project dialog. Keep the folder attached as the primary source folder and place `path-marketing-local-project-agents.md` in the folder under the exact name `AGENTS.md`. Codex automatically discovers that file from the primary folder. For Chat or Work, start with `path-marketing-project-starter-prompt.md`; its opening instruction explicitly loads `chatgpt-project-instructions.md` and the controlling source files.

The local project already has file access through the attached folder, so it does not need a second upload of the same files. A standard non-local ChatGPT Project still uses the upload and Project-instructions workflow below.

## Upload These Files To The ChatGPT Project

Upload the files in this order:

1. `docs/product/chatgpt-project-instructions.md`
2. `docs/product/path-capability-source-pack.md`
3. `docs/product/path-marketing-project-starter-prompt.md` when starting a marketing project
4. `docs/product/codex-support-handoff.md`
5. `docs/product/path-product-manual-source-map.md` when producing a product manual
6. `docs/product/dev-screenshot-runbook.md` when the deliverable needs interface images
7. `docs/planning/path-promo-website-source-brief.md` when producing marketing material
8. `docs/guides/rm-two-step-review-user-guide.md` when producing staff workflow guidance
9. Selected public-portal manual pages from `../ISET-intake/docs/portal/` only when the deliverable covers those functions
10. Approved images from `docs/product/assets/screenshots/`

Do not upload the whole repository or the whole `docs/` tree. That would mix obsolete plans, operational incident details, named internal users, environment evidence, and source material whose release state is not established.

## Source Hierarchy

When sources disagree, use this order:

1. Exact deployed-environment evidence for the target release and role
2. Current application source plus focused tests for that exact behavior
3. This curated capability source pack
4. Current user guides, feature docs, help panels, and portal manual entries
5. Changelog and release notes, after separating deployed entries from DEV/TBD entries
6. Planning docs
7. Historical/archive material

`docs/product/path-capability-source-pack.md` records the current publishing boundary. It intentionally overrides broader or older wording in the promotional source brief where release status matters.

## Files In This Pack

- `path-capability-source-pack.md` — product vocabulary, evidence/status rules, current capability matrix, limitations, and safe claim boundaries.
- `path-marketing-local-project-agents.md` — template to copy into a local project's primary folder as `AGENTS.md`.
- `path-marketing-project-starter-prompt.md` — ready-to-paste first prompt for a PATH marketing-materials Project.
- `path-product-manual-source-map.md` — recommended manual structure, chapter-to-source mapping, readiness, and first verification batch.
- `chatgpt-project-instructions.md` — ready-to-paste instructions for the ChatGPT Pro project.
- `codex-support-handoff.md` — request/response format for questions, source checks, screenshots, walkthroughs, and supporting artifacts.
- `dev-screenshot-runbook.md` — DEV-only screenshot privacy, evidence, naming, review, and promotion workflow.
- `assets/screenshots/README.md` — approved screenshot catalogue. Raw captures do not belong there.

## Refresh Rule

Refresh this pack when any of the following occurs:

- a PATH release changes user-visible behavior;
- a DEV/TBD capability is enabled in PROD;
- a current route, role, label, or workflow stage changes;
- a screenshot is approved or superseded;
- a manual procedure is found to differ from the deployed UI;
- a marketing claim needs new evidence.

For a refresh, ask Codex to compare the proposed claim or procedure with current code, current project guidance, and the target environment. A passing link check proves only that references resolve; it does not prove product currency.

## Publication Gate

Before final publication:

- resolve every `Codex verification required` marker;
- use only claims permitted by the capability matrix;
- confirm manual steps against the intended PROD release and role;
- use approved synthetic-data screenshots only;
- remove internal routes, names, emails, IDs, incident details, and implementation jargon unless the audience explicitly needs them;
- complete product-owner, privacy, accessibility, and brand review.
