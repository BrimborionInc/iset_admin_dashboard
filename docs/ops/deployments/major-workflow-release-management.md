# Major Workflow Release Management

Status: current operator gate for major PATH workflow changes.
Last Updated: 2026-07-05

Purpose: prevent a repeat of the two-step review rollout failure mode by giving future agents and operators a concrete release-management checklist for major workflow changes.

Audience: Codex, developers, release operators, product owners, and support owners.

## Plain-English Briefing

PATH did not suffer a single isolated bug. A major workflow change changed who owned the next action, when records could be edited, what documents were generated, and what queues staff used. The release management failed because the rollout was not controlled against the whole business state machine. Some fixes then treated symptoms one at a time, which risked creating more incompatible states.

The corrective approach is to treat major workflow releases as business-state releases, not screen fixes. Before and after deployment, PATH must prove the role/status/workflow matrix, generated artifacts, notifications, data repairs, and feedback-report records are all coherent.

## Trigger

Use this gate for any change that materially alters:

- who can start, review, approve, deny, return, withdraw, or complete a workflow;
- queue ownership or staff next-action responsibility;
- editability/read-only state across workflow stages;
- generated PDFs, letters, signing requests, secure messages, or document links;
- notification routing for workflow handoffs;
- compatibility fields used by reports, queues, or legacy screens;
- live record repair after a workflow bug.

Examples include the Regional Manager two-step review workflow, application assessment ownership, intervention proposal/revision review, payment packet lifecycle, applicant secure-message recall semantics, and document-checklist gate changes.

## 2026-07-05 Two-Step Review Finding

The two-step review PROD bug cluster was a release-management failure as well as a code defect. The root control failure was that release acceptance was not expressed as the cross-product of:

- the three affected workflows: application assessment, new intervention proposal, and intervention revision;
- the business states: draft/in progress, submitted to Regional Manager review, returned to submitter, submitted for final decision, returned to Regional Manager, final decision recorded, withdrawn/cancelled;
- the business roles: ISET Coordinator, Regional Manager, and NWAC Administrator / Decision Maker.

Because that matrix was not the controlling release artifact, partial fixes could change one path without proving that the whole state machine still held together. The known concrete record damage was repaired on 2026-07-05: missing intervention-document links for generated packet PDFs and one proposal compatibility timestamp that had drifted to final-approval time. Prevention code was deployed and the post-deploy PROD audit found no known remaining two-step mismatch rows. Feedback `#149` was resolved and the owner update was sent. A later same-day live TEST workflow smoke found and fixed notification-contract gaps for new intervention proposals entering RM review and Decision Maker request-changes on intervention workflows; release `20260705-two-step-review-test-notification-fix` was then deployed to PROD with full shared + admin + portal app artifacts and no schema/data/runtime-config promotion.

The second release-control failure found during the same repair stream was dirty-source packaging risk. PROD app deploys now fail before mutation when the packaged source tree is dirty unless Bill explicitly approves and records an emergency override.

## Mandatory Release Artifact

Every major workflow release must name a release contract before code freeze. The contract can live in a planning doc, but it must be easy to find from `docs/AGENTS.md` or the relevant subsystem doc.

The contract must define:

- workflow types in scope and explicitly out of scope;
- roles and their allowed actions;
- conceptual states and database state authority;
- editability rules by role and state;
- queue placement by role and state;
- required generated artifacts and links;
- required notifications and recipients;
- compatibility fields that must stay in sync;
- data repair or backfill plan for existing records;
- live feedback reports included, deferred, or blocked.

For two-step review, the authoritative contract is the matrix in `docs/planning/rm-two-step-review-workflow.md`.

## Pre-Release Gate

Before TEST or PROD deployment, prove the release against the contract:

- Source state is clean for every packaged repo: admin, portal, and shared where applicable.
- Automated tests cover the role/action/state matrix, not only the changed route.
- Browser or API workflow smokes cover each affected workflow family, including returned/edge states where they exist.
- Generated artifacts are checked at the relationship level, not just file creation: document metadata, normalized join rows, signing requests, message attachments, and event payloads.
- Notification settings and runtime flags are verified in the target environment when they are part of the behavior.
- Existing live records are audited before deploy if the change could have left records stranded in an old state.
- Affected feedback reports are identified before deploy and have current live notes/status when the release is planned.

If the release touches multiple workflow families, do not patch only one family unless the deliberate difference is documented in the contract.

## PROD Deployment Gate

Apply the normal PROD deployment runbook, plus these workflow-specific requirements:

- State the release contract and affected feedback report IDs before asking Bill for PROD approval.
- Use an app/schema-only deploy unless a named data/runtime operation is explicitly approved.
- If data repair is needed, keep preview/apply SQL artifacts under `sql/ops/`, use guards, and record restore/rollback evidence.
- Run normal-routing smoke after fallback is cleared.
- Run deployed-source marker checks for the release behavior, not only `/healthz`.
- Run the targeted workflow/data audit after deploy.

## Closeout Gate

A major workflow release is not complete until all of the following are true:

- the deployed code markers are present in PROD;
- the workflow audit returns no known mismatch rows, or remaining rows are explicitly documented as accepted/blocking follow-up;
- affected feedback reports have current live `status`, `admin_feedback_status_history`, and `admin_feedback_note` rows;
- owner/staff notifications are sent or explicitly parked in `docs/ops/prod-repair-notification-log.md`;
- persistent docs are updated with the release evidence and any new guardrail.

Do not mark a feedback report `resolved` just because code deployed. Mark it resolved only after the deployed behavior and relevant records/artifacts have been rechecked. Otherwise leave it `in_progress` with the remaining verification stated.

## Release Manager Behavior

Codex owns this gate during AI-assisted work. If Bill asks a question that would pull the work into a side path, answer briefly and return to the release contract. If a requested shortcut would skip matrix proof, data repair planning, or feedback reconciliation, correct the path before proceeding.

The feedback log is evidence and workflow input; it is not the release plan. The release plan is the business contract plus code, data, artifacts, notifications, verification, and owner communication.
