# Operations Docs

Status: operational guidance and runbooks. Verify before acting.
Last reviewed: 2026-08-09 after the RM two-step review assurance handoff was added.

This directory contains deployment guides, environment guides, migration-runner notes, incident notes, and infrastructure runbooks. Operational docs can become dangerous when stale, so treat code, package scripts, AWS/DB live checks, and current `docs/AGENTS.md` guardrails as higher authority.

## How To Use

- For TEST/PROD deploys, start with `docs/AGENTS.md`, then the authoritative `deployments/release-qualification-runbook.md`; use `deployments/deployment-quick-guide.md` and `deployments/path-deploy-orchestrator.md` for mechanics only.
- For Codex/WSL DB access, TEST SQL, PROD start/stop, or AWS profile details, use `agent-operational-access.md`.
- For PROD-specific work, also read `deployments/prod-deployment-guide.md` and `environments/prod-env-guide.md`.
- For PROD app EC2 right-sizing, use `runbooks/prod-app-instance-rightsize.md`; it is a launch-template/ASG refresh change, not a normal app deploy.
- For PROD Aurora provisioned downsizing, use `runbooks/prod-aurora-provisioned-downsize.md`; do not modify the only writer in place. The 2026-06-14 prep summary is `runbooks/prod-aurora-downsize-prep-summary-20260614.md`.
- For PROD NAT gateway consolidation, use `runbooks/prod-nat-gateway-consolidation.md`; current live state keeps only the `ca-central-1d` NAT and the temporary policy `NWACProdNatConsolidationTemporaryOperator` should be removed after the rollback watch window.
- For TEST environment work, use `environments/test-env-config-map.md`, `environments/test-env-db-refresh.md`, and current rehearsal notes when relevant.
- For feedback `#179`, use `feedback-179-amanda-response-draft-20260809.md` together with the testing assurance and future PROD rollout plan; the email remains a draft until the exact live Application 123 recheck is complete.
- For privacy ERM migration work, use `environments/privacy-erm-grand-cleanup-rehearsal.md` with the controlling planning docs.
- For Terraform, use `runbooks/` and verify against `infra/terraform/`.

## Safety Rules

- Do not run PROD-changing commands from an old runbook without checking `docs/AGENTS.md` and current scripts.
- Treat any PROD deploy that can restart processes, refresh instances, or change ALB routing as user-impacting unless the plan proves otherwise.
- Use maintenance warnings/fallbacks according to current deployment guardrails before user-visible interruptions.
- If an ops doc conflicts with current `package.json` scripts or deploy tooling, update the doc before acting.

## Cleanup Rule

When touching an ops doc, add or update a clear status/date line and verify command names against `package.json` or the relevant script.
