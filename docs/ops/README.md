# Operations Docs

Status: operational guidance and runbooks. Verify before acting.
Last reviewed: 2026-04-29 during ops documentation cleanup.

This directory contains deployment guides, environment guides, migration-runner notes, incident notes, and infrastructure runbooks. Operational docs can become dangerous when stale, so treat code, package scripts, AWS/DB live checks, and current `docs/AGENTS.md` guardrails as higher authority.

## How To Use

- For TEST/PROD deploys, start with `docs/AGENTS.md`, then `deployments/deployment-quick-guide.md` and `deployments/path-deploy-orchestrator.md`.
- For Codex/WSL DB access, TEST SQL, PROD start/stop, or AWS profile details, use `agent-operational-access.md`.
- For PROD-specific work, also read `deployments/prod-deployment-guide.md` and `environments/prod-env-guide.md`.
- For TEST environment work, use `environments/test-env-config-map.md`, `environments/test-env-db-refresh.md`, and current rehearsal notes when relevant.
- For privacy ERM migration work, use `environments/privacy-erm-grand-cleanup-rehearsal.md` with the controlling planning docs.
- For Terraform, use `runbooks/` and verify against `infra/terraform/`.

## Safety Rules

- Do not run PROD-changing commands from an old runbook without checking `docs/AGENTS.md` and current scripts.
- Treat any PROD deploy that can restart processes, refresh instances, or change ALB routing as user-impacting unless the plan proves otherwise.
- Use maintenance warnings/fallbacks according to current deployment guardrails before user-visible interruptions.
- If an ops doc conflicts with current `package.json` scripts or deploy tooling, update the doc before acting.

## Cleanup Rule

When touching an ops doc, add or update a clear status/date line and verify command names against `package.json` or the relevant script.
