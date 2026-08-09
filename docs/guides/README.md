# Guides

Status: maintained how-to material, with possible stale older pages.

This directory contains implementation and workflow guides used by agents during feature work. Guides are more actionable than planning notes, but they still need verification against code and current docs before changes are made.

## How To Use

- For configurable dashboard/widget work, start with `configurable-dashboard-notes.md`.
- For workflow authoring, start with `workflow-studio.md`.
- For imports/backload work, start with `client-file-imports.md`.
- For rare PROD duplicate imported-client/public-portal applicant merges, start with `prod-duplicate-applicant-identity-merge.md`.
- For case workspace behavior, start with `case-workspace-guidance.md`.
- For the live Regional Manager/Decision Maker approval flow, EI checks, and Client Funding Agreement handoff, use `rm-two-step-review-user-guide.md`.
- For status model work, start with `status-lifecycle-implementation.md` and the planning docs linked from `docs/AGENTS.md`.
- For DB access from Codex/WSL, use `test-db-access-from-codex.md`.
- For Cognito staff recovery, use `test-staff-cognito-recovery.md`.
- For retiring old staff Cognito custom region/user-id values, use `staff-cognito-legacy-attribute-cleanup.md`.
- For Synthesia-backed PATH tutorial/training video production, use `synthesia-training-video-production.md`.

## Cleanup Rule

When touching a guide, verify its commands, routes, file paths, and role assumptions. If a guide is only historical, mark it explicitly rather than leaving it as live how-to guidance.
