# Source Control and GitHub Operations

Status: canonical PATH source-control safety guide.

Last reviewed: 2026-08-03 after removal of the unsafe automatic Terraform workflow.

## Canonical repositories

- Admin dashboard: `/home/bill/ISET/admin-dashboard`, GitHub repository `BrimborionInc/iset_admin_dashboard`, branch `main`.
- Public portal: `/home/bill/ISET/ISET-intake`, GitHub repository `BrimborionInc/abs-app`, branch `main`.
- Shared runtime: `/home/bill/ISET/shared`, GitHub repository `BrimborionInc/iset_shared`, branch `main`.
- Temporary branches and worktrees may isolate qualification or release work, but deployed commits must be reconciled into `main` and obsolete remote release branches removed after ancestry proof.

## A Git push is an operational event

Never treat a push, branch fast-forward, history reconciliation, branch rename, merge, or workflow-file change as source-control housekeeping alone. GitHub evaluates automation against the pushed commit range. A fast-forward across old commits can therefore trigger path-filtered automation even when those commits were created and deployed long ago.

Before every push, and especially before changing `main`:

1. Fetch the remote and record the exact current remote tip and proposed new tip.
2. Inspect the complete pushed range, not only the final commit:

   ```bash
   git diff --name-status origin/main..main
   git log --oneline origin/main..main
   ```

3. Inventory `.github/workflows/` and inspect every trigger, path filter, environment, permission, credential step, deploy command, Terraform command, and automatic mutation.
4. Check the repository's active GitHub workflows, deployment integrations, and webhooks when the push is unusual, spans many commits, changes the canonical branch, or contains infrastructure/deployment paths.
5. Stop before pushing if the full range can trigger an environment mutation that is not the explicitly authorized purpose of the task. Disable or safely redesign that automation first.
6. Use `git push --dry-run` as a final transport check, while remembering that it does not assess GitHub Actions or external integrations.

The same check applies independently to admin, portal, and shared. A clean working tree and correct ancestry do not prove that a push is operationally safe.

## Deployment boundary

- No push, pull request, merge, branch operation, or path filter may automatically deploy PATH code, change a PATH database, or apply Terraform to TEST or PROD.
- PROD deployments require the established PATH deployment runbook, current qualification evidence, explicit PROD authorization, environment identity proof, scoped maintenance controls, and post-deployment verification.
- Terraform work requires the environment-specific Terraform runbook, exact AWS identity and account proof, an independently reviewed plan, and explicit authorization for the apply. It must never use `terraform apply -auto-approve` from a push-triggered GitHub Actions job.
- Future GitHub Actions may run non-mutating tests on pushes or pull requests. Any environment mutation must be a separately designed manual operation with fail-closed environment selection, protection/approval gates, reviewed credentials and state configuration, and retained evidence.

## Current GitHub automation baseline

On 2026-08-03, the only GitHub Actions workflow in the three PATH repositories was the admin repository's legacy `Terraform Infra` workflow. It was disabled directly in GitHub and its workflow file was removed from `main`. The portal and shared repositories had no workflows and none of the three repositories had push webhooks.

Do not restore the removed Terraform workflow from history. If GitHub-based Terraform automation is proposed later, design and qualify it as new production infrastructure rather than repairing or re-enabling the legacy file.

## 2026-08-02 incident and proof

The admin repository's stale GitHub `main` was fast-forwarded across 434 commits during source-control reconciliation. The pushed range contained historical `infra/**` changes, which matched a legacy workflow trigger and started a job labelled `apply` against its default `prod` environment.

The job failed while attempting AWS OIDC credential configuration. Terraform setup, initialization, plan, and apply were all skipped. The GitHub deployment record ended in `failure`. The follow-up audit found:

- exactly one GitHub Actions run across admin, portal, and shared for the cleanup date;
- no repository webhooks and no other GitHub deployment records from the cleanup;
- no AWS credential session from GitHub in the real PROD account;
- no PROD artifact upload, SSM command, Auto Scaling refresh, RDS control-plane change, or other non-routine AWS write during the cleanup window; and
- no cleanup-generated deployment manifest.

The successful admin-only PROD rollout at 08:17 EDT that morning was the separately authorized `20260801-returned-assessment-edit` release. It completed about one hour before the Git cleanup began at 09:18 EDT and was not triggered by GitHub.
