# Planning Docs

Status: mixed current and historical material.

First-pass triage index: `docs/meta/planning-cr-archive-triage-2026-04-29.md`.

This directory contains active plans, execution logs, historical design notes, one-off thread handoffs, and review packs. Do not treat every file in this directory as current implementation truth.

## How To Use

- Start with `docs/AGENTS.md` and follow its task-specific pointers.
- Verify planning claims against code, migrations, config, tests, and live database checks before implementing.
- Prefer the most recent canonical plan for the domain you are touching.
- If a file is contradicted by current code or a newer canonical doc, update, mark historical, or supersede it rather than adding another competing note.

## Higher-Trust Current Planning Docs

As of 2026-07-10, these are the main planning docs intentionally linked from `docs/AGENTS.md`:

- `client-case-application-target-model.md`
- `client-case-application-migration-plan.md`
- `application-assessment-application-scope-migration-plan.md`
- `privacy-erm-cleanup-grand-release-plan.md`
- `privacy-erm-cleanup-progress.md`
- `privacy-security-systematic-review-2026-04-25.md`
- `public-portal-legacy-fallback-security-review-2026-04-25.md`
- `status-architecture-overhaul.md`
- `step19-checkbox-conditionality-followup.md`
- `path-document-type-canonical-review.md`
- `admin-ai-chatbot-knowledge-base-transformation.md`
- `admin-ai-chatbot-coverage-register.md`
- `engineering-audit-register.md`
- `engineering-audit-release-wave-manifest.md`
- `staff-record-correction-controls-proposal-email.md`
- `rm-two-step-review-workflow.md`
- `rm-two-step-review-assurance-prod-rollout-2026-08-09.md`
- `release-qualification-harness-rebuild-plan-2026-08-10.md`

`client-case-application-cutover-dependency-inventory.md` is useful for dependency history, but `docs/AGENTS.md` currently says to use `client-case-application-target-model.md` for the live target model where they differ.

## Current Product/Content Source Briefs

- `path-promo-website-source-brief.md` - source material for drafting a PATH promotional website; useful for product messaging, feature inventory, migration/onboarding positioning, versioned-artifact positioning, and claims to verify before publication.

## Cleanup Rule

When continuing documentation cleanup, add a short status block to any planning file you touch:

- `Status: current`
- `Status: historical`
- `Status: superseded by <path>`
- `Status: needs verification`

Do not bulk-label files without checking enough evidence to justify the label.
