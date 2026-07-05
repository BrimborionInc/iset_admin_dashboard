# PROD Repair Notification Log

Purpose: track live PROD data repairs whose affected staff or business owners may need to be informed later.
Audience: operations, product, support, and future AI-assisted maintenance threads.
Last Updated: 2026-07-05

Use this log for repairs that may be externally invisible to staff but should be available for later owner communication. Keep entries concise, evidence-based, and linked to the exact scripts or reports where possible. Do not use this file as approval to mutate PROD; follow the PROD repair rules in `docs/ops/agent-operational-access.md`.

## 2026-07-05 - Two-step review intervention packet repair

Status: PROD data repair and prevention deploy applied; owner notification pending.

Reason: workflow-first two-step review audit found two intervention proposal workflows with generated packet PDFs that were not linked through `iset_document_intervention`, plus one proposal compatibility row whose `submitted_at` had drifted to the final approval time.

Affected records and owners:

| Workflow | Case | Proposal | Intervention | Current stage | Primary owner to inform | Other owner/context |
| --- | --- | --- | --- | --- | --- | --- |
| `12` | `CASE-2026-0000044` | `332` | `219` | `nwac_review` | Amanda Curtis (`acurtis@nwac.ca`), Regional Manager, submitter/RM/case owner | No final Decision Maker yet |
| `13` | `CASE-2026-0000050` | `339` | `220` | `final_decision_recorded` | Amanda Curtis (`acurtis@nwac.ca`), Regional Manager, submitter/RM/case owner | Madison Coppola (`mcoppola@nwac.ca`), NWAC Administrator/Decision Maker |

Repair applied:

- Inserted five missing intervention-document links for active generated PDFs:
  `5087 -> 219`, `5089 -> 219`, `5112 -> 220`, `5113 -> 220`, `5142 -> 220`.
- Reset proposal `339` `submitted_at` from `2026-06-30 19:21:05` to the authoritative workflow submit time `2026-06-30 18:29:16`; `reviewed_at` remains `2026-06-30 19:21:05`.

Evidence:

- Preview scripts: `sql/ops/prod-two-step-review-document-link-repair-preview-20260705.sql` and `sql/ops/prod-two-step-review-proposal-timestamp-repair-preview-20260705.sql`.
- Apply scripts: `sql/ops/prod-two-step-review-document-link-repair-apply-20260705.sql` and `sql/ops/prod-two-step-review-proposal-timestamp-repair-apply-20260705.sql`.
- Document-link apply SSM command `459edc15-812d-4a90-9678-017aa8b69c8e`: guard found `5/5` ready rows and inserted `5` links at DB time `2026-07-05 11:12:29`.
- Timestamp apply SSM command `8e1ecbb5-94e7-4d50-9bd4-f84b61ff8eaa`: updated `1` proposal row and verified `submitted_delta_seconds = 0`.
- Post-repair systemic audit SSM command `c6ee10df-3f48-4c5e-b226-0707d4b65180`: no workflow/status, missing packet document, or proposal timestamp mismatch rows returned.
- Prevention release `20260705-two-step-review-prevention` deployed to PROD on 2026-07-05 as admin-only with no DB mutation. ASG refresh `56e2371d-7fce-4f78-8d7c-257272bfa177` replaced the admin host with `i-0307e0c730b98a7bc`; deployed-source SSM command `a1129867-9c9e-42cd-89ef-4635fdf12824` confirmed release id and both prevention markers.
- Post-deploy systemic audit SSM command `7405d66e-0bf6-4076-808d-114b562715e7`: returned only runtime flag and workflow stage-count sections, with no known mismatch rows.

Prevention status:

- Prevention code is deployed to PROD release `20260705-two-step-review-prevention`. Generated intervention assessment PDFs now pass intervention ids into the document-store helper, and proposal compatibility syncing preserves original submitted timestamps across final-decision updates.

Notification note:

- Suggested owner message later: PATH found and repaired two intervention review packet records where the generated PDFs existed but were not attached to the intervention-specific document view; one related submitted timestamp was also corrected to the original submit-for-review time. No staff action is expected unless they still see a missing packet/document on the affected case.
