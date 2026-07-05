# PROD Feedback Batch Repair Tracker - 2026-07-05

Purpose: active handoff tracker for the July 5 PROD bug/CR repair batch.
Audience: operations, product, support, and future AI-assisted maintenance threads.
Last Updated: 2026-07-05

This tracker exists because Bill asked Codex to own the repair stream rather than treating the feedback log as the only driver. The overarching objective is to prove the affected workflows are logically correct, repair damaged records where needed, and batch non-emergency fixes into a planned TEST/PROD release. Do not deploy these prepared fixes one at a time unless Bill explicitly approves an emergency hotfix.

## Batch Rule

- PROD containment/data repair can be immediate only when there is a live privacy, data-integrity, or business-continuity risk and Bill approves the exact mutation.
- Code fixes prepared in DEV stay batched until release planning.
- A feedback report is not resolved until the fix is deployed to PROD and a targeted live recheck proves the reported behavior.
- Live feedback-log notes/status updates are PROD mutations; update them only with the normal PROD access rules and clear approval.

## Current Items

| Report | Type | Status | Repair state | Owner/report context | Next required step |
| --- | --- | --- | --- | --- | --- |
| `#149` Pending Decision - Kitson/Wallace | Bug | `resolved` | PROD data repaired and prevention release deployed | Madison Coppola / two-step review intervention packet symptoms | Owner notification can use `docs/ops/prod-repair-notification-log.md`; no more code work expected unless staff report a new symptom. |
| `#154` Deleted secure message | Bug | `in_progress` | PROD message `1128` contained; admin product fix committed locally, not deployed | Emilie Marion sent a staff-to-applicant secure message to the wrong participant and local delete did not recall it | Keep in batch unless privacy leadership requires faster release. Deploy admin withdrawal/recipient-confirmation fix, then live recheck and update feedback log. |
| `#155` New secure message email notification | Change request | `triaging` | Portal product fix prepared locally, not deployed | Emilie Marion requested staff Outlook subject show applicant name rather than applicant email | Include portal name-resolution fix in the same secure-message batch. After PROD deploy, send/observe a real applicant-origin secure-message notification and update feedback log. |
| `#96` New supporting docs for non-school/employment applications | Bug | `in_progress` | Rechecked read-only; still blocked on NWAC/Bill document-type and upload-rule decisions | Bill/NWAC document checklist input | Do not include in the secure-message release unless the missing business input arrives and the resulting config/code change is prepared/tested. |
| `#97` Change "Letters of Reference" | Change request | `in_progress` | Rechecked read-only; still blocked on wording/document-type decision for First Nations/Inuit identity evidence | Bill/NWAC document checklist input | Do not implement by guesswork. Needs the intended wording/type split before a change can be prepared. |
| `#123` Appeals Workflow | Change request | `triaging` | Rechecked read-only; still policy/spec design, not a release-ready fix | Bill/NWAC appeals policy | Keep out of this bugfix batch. Requires appeal eligibility, statuses, permissions, notifications, artifacts, audit trail, and reporting decisions before implementation. |

## Prepared Secure-Message Batch

- Admin repo commit `143c032 Add secure message withdrawal safeguards` prepares the `#154` product fix: explicit `Withdraw sent message` for plain staff-to-applicant messages, recipient/case confirmation before send, safer Deleted Items wording, and audit-preserving redaction.
- Portal repo local changes prepare the `#155` product fix: `applicant_secure_message_received` now resolves `{applicant_name}` from owned client/application/case evidence before falling back to `user.name` or email.
- The two fixes should be released together because both change staff expectations around secure-message notifications/recall semantics.
- Neither prepared fix has been deployed to TEST or PROD in this batch state.

## Verification Evidence So Far

- `#154` admin code verification completed before this tracker: `node --check isetadminserver.js`, focused Jest tests, `npm run lint`, and `CI=true npm run build` all passed with only known pre-existing warnings.
- `#155` portal code verification on 2026-07-05:
  - `node --check server.js`
  - `node --test notifications/__tests__/secureMessageApplicantName.test.js notifications/__tests__/templateRenderer.test.js notifications/__tests__/applicantEmailNotifications.test.js`
  - `git diff --check`
- Remaining queue read-only recheck used SQL-over-SSM command `f25cc6eb-d3f5-4087-8324-5c68cba179fa` after feedback-table schema proof command `22f04099-feaf-4fd5-8fec-71bae448de01`. It confirmed #96/#97/#123 still have the same blockers recorded in their live notes.

## Release-Gate Notes

- TEST/PROD deploys are disruptive; do not deploy after each individual fix.
- The release package should explicitly include admin and portal changes. Shared should stay unchanged unless a later item requires it.
- Before PROD approval, present the exact release scope, maintenance sequence, smoke checks, and feedback reports to update after live recheck.
