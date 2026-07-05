# PROD Repair Notification Log

Purpose: track live PROD data repairs whose affected staff or business owners may need to be informed later.
Audience: operations, product, support, and future AI-assisted maintenance threads.
Last Updated: 2026-07-05

Use this log for repairs that may be externally invisible to staff but should be available for later owner communication. Keep entries concise, evidence-based, and linked to the exact scripts or reports where possible. Do not use this file as approval to mutate PROD; follow the PROD repair rules in `docs/ops/agent-operational-access.md`.

## 2026-07-05 - Feedback #154 wrong-recipient secure-message containment

Status: PROD containment applied; privacy/business follow-up and product fix pending.

Reason: feedback report `#154` (`Deleted secure message`) described a Regional Manager sending a secure message to the wrong participant and deleting it immediately from her own view. Live triage confirmed the delete action only removed the sender mailbox copy; the recipient copy remained in the participant inbox and had been read. The current code can also expose master `messages.subject` / `messages.body` in staff case-thread views, so mailbox-only hiding was not sufficient.

Affected records and owners:

| Item | Value |
| --- | --- |
| Feedback report | `#154` |
| Message | `1128` |
| Case | `129` / `ISET-20260429-AF259F` |
| Sender | Emilie Marion (`emarion@nwac.ca`), Regional Manager |
| Wrong recipient | Molly Hink (`molly.hink@hotmail.com`) |
| Event | `7ec162a2-5624-4cc3-b942-248c5177e518` |

Repair applied:

- Replaced the live message subject/body with a neutral withdrawal notice and marked the master message `deleted=1`, `status='archived'`.
- Moved both sender and recipient `message_item` rows to `folder='deleted'` while preserving the rows and timestamps for audit evidence.
- Redacted the central `staff_secure_message_sent` event subject to `[withdrawn] Message withdrawn`.
- Added a PROD feedback note to report `#154`; the report remains `in_progress` pending privacy/business follow-up and a product fix for true recall/delete-for-everyone plus stronger recipient confirmation.

Evidence:

- Preview script: `sql/ops/prod-feedback-154-secure-message-containment-preview-20260705.sql`.
- Apply script: `sql/ops/prod-feedback-154-secure-message-containment-apply-20260705.sql`.
- Preview SSM command `76528c5b-b886-4735-8c5a-5f829c1f2ad9`: message, mailbox, related-count, and event guards all returned `ready`; related attachment, signing-request, and internal-notification counts were all `0`.
- Apply SSM command `d290da6c-2078-4e92-96d3-9163f05e9b68`: all guards returned ready; live message `1128` now has subject `Message withdrawn` and neutral body text; sender and recipient mailbox rows are deleted; event subject is redacted; feedback note was inserted.

Notification note:

- Suggested reporter message: PATH removed the mistakenly sent secure message content from the live application, replaced it with a neutral withdrawal notice, and confirmed there were no attachments or signing requests linked to it. The system record has been preserved for audit purposes. Because the message had already reached the recipient's inbox and was marked read before containment, PATH cannot say it was unseen; this should be handled as a privacy/business follow-up separately from the technical containment.

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
- Feedback reconciliation SQL `sql/ops/prod-feedback-149-resolved-two-step-prevention-20260705.sql` ran through SSM command `84b08c90-55c2-499e-8691-a1692fb1e674` and moved report `#149` (`Pending Decision - Kitson/Wallace`) from `triaging` to `resolved` with an internal note tying Madison's report to the repaired Kitson/Wallace records and the deployed prevention release.

Prevention status:

- Prevention code is deployed to PROD release `20260705-two-step-review-prevention`. Generated intervention assessment PDFs now pass intervention ids into the document-store helper, and proposal compatibility syncing preserves original submitted timestamps across final-decision updates.

Notification note:

- Suggested owner message later: PATH found and repaired two intervention review packet records where the generated PDFs existed but were not attached to the intervention-specific document view; one related submitted timestamp was also corrected to the original submit-for-review time. Madison's report `#149` has been marked resolved because Kitson is correctly at Decision Maker review, Wallace is final-approved, and the prevention release is live. No staff action is expected unless they still see a missing packet/document or a current Decision Maker action blocked on the affected case.
