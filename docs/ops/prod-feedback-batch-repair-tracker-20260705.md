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
| `#149` Pending Decision - Kitson/Wallace | Bug | `resolved` | PROD data repaired and prevention release deployed; Bill sent Madison owner update on 2026-07-05 | Madison Coppola / two-step review intervention packet symptoms | No more code work expected unless staff report a new symptom. |
| `#154` Deleted secure message | Bug | `in_progress` | PROD message `1128` contained; admin product fix deployed to PROD in release `20260705-secure-message-batch`; Bill sent Emilie follow-up on 2026-07-05 | Emilie Marion sent a staff-to-applicant secure message to the wrong participant and local delete did not recall it | Owner/privacy follow-up remains. Resolve only after business-owner confirmation that incident follow-up is complete. |
| `#155` New secure message email notification | Change request | `in_progress` | Portal product fix deployed to PROD in release `20260705-secure-message-batch`; source and selector validated without sending a live test email; Bill sent Emilie follow-up on 2026-07-05 | Emilie Marion requested staff Outlook subject show applicant name rather than applicant email | Resolve after the next legitimate applicant-origin secure-message notification, or staff confirmation, proves the Outlook subject uses the applicant name. |
| `#96` New supporting docs for non-school/employment applications | Bug | `in_progress` | Rechecked read-only; still blocked on NWAC/Bill document-type and upload-rule decisions | Bill/NWAC document checklist input | Do not include in the secure-message release unless the missing business input arrives and the resulting config/code change is prepared/tested. |
| `#97` Change "Letters of Reference" | Change request | `in_progress` | Rechecked read-only; still blocked on wording/document-type decision for First Nations/Inuit identity evidence | Bill/NWAC document checklist input | Do not implement by guesswork. Needs the intended wording/type split before a change can be prepared. |
| `#123` Appeals Workflow | Change request | `triaging` | Rechecked read-only; still policy/spec design, not a release-ready fix | Bill/NWAC appeals policy | Keep out of this bugfix batch. Requires appeal eligibility, statuses, permissions, notifications, artifacts, audit trail, and reporting decisions before implementation. |

## Prepared Secure-Message Batch

- Admin repo commit `143c032 Add secure message withdrawal safeguards` prepares the `#154` product fix: explicit `Withdraw sent message` for plain staff-to-applicant messages, recipient/case confirmation before send, safer Deleted Items wording, and audit-preserving redaction.
- Portal repo commit `b4b138e Fix applicant secure message notification names` prepares the `#155` product fix: `applicant_secure_message_received` now resolves `{applicant_name}` from owned client/application/case evidence before falling back to `user.name` or email.
- The two fixes should be released together because both change staff expectations around secure-message notifications/recall semantics.
- Both prepared fixes were deployed to TEST and PROD in release `20260705-secure-message-batch`.

## Verification Evidence So Far

- `#154` admin code verification completed before this tracker: `node --check isetadminserver.js`, focused Jest tests, `npm run lint`, and `CI=true npm run build` all passed with only known pre-existing warnings.
- `#155` portal code verification on 2026-07-05:
  - `node --check server.js`
  - `node --test notifications/__tests__/secureMessageApplicantName.test.js notifications/__tests__/templateRenderer.test.js notifications/__tests__/applicantEmailNotifications.test.js`
  - `git diff --check`
- Remaining queue read-only recheck used SQL-over-SSM command `f25cc6eb-d3f5-4087-8324-5c68cba179fa` after feedback-table schema proof command `22f04099-feaf-4fd5-8fec-71bae448de01`. It confirmed #96/#97/#123 still have the same blockers recorded in their live notes.

## Release-Gate Notes

- TEST/PROD deploys are disruptive; do not deploy after each individual fix.
- Approved release scope: secure messaging only, release id `20260705-secure-message-batch`.
- Planned app scope: admin + portal; skip schema, skip data/runtime config, skip shared.
- Before PROD approval, present the exact release scope, maintenance sequence, smoke checks, and feedback reports to update after live recheck.

## Release Prep Evidence

- Admin focused preflight on 2026-07-05:
  - `node --check isetadminserver.js`
  - `CI=true npm test -- --watchAll=false --runTestsByPath src/lib/__tests__/secureMessageWithdrawalGuards.test.js src/lib/__tests__/applicationStatusRawWorkflowGuards.test.js`
  - `npm run lint` passed with the known three pre-existing warnings in `src/lib/__tests__/pathPatchBugGuards.test.js`.
  - `PATH_RELEASE_ID=20260705-secure-message-batch CI=true npm run build` passed with the known empty-source-map warning and bundle-size warning.
- Portal focused preflight on 2026-07-05:
  - `node --check server.js`
  - `node --test notifications/__tests__/secureMessageApplicantName.test.js notifications/__tests__/templateRenderer.test.js notifications/__tests__/applicantEmailNotifications.test.js`
  - `PATH_RELEASE_ID=20260705-secure-message-batch CI=true npm run build`
- Release-note preflight generated `src/generated/publicReleaseNotes.js` with `Release 20260705-secure-message-batch` as the first English and French package group and exactly three package groups.
- Non-mutating TEST deploy plan: `npm run path:deploy:plan -- --env test --skip-schema --skip-data --skip-shared --release-id 20260705-secure-message-batch`; manifest `/home/bill/ISET/admin-dashboard/tmp/path-deploy/test/20260705-secure-message-batch--2026-07-05T13-06-28-807Z.json`; AWS identity `arn:aws:iam::124355655255:user/CODEX_CLI_Admin`; app deploy `shared=false admin=true portal=true`; smoke targets `2`.
- TEST deployment on 2026-07-05: `npm run path:deploy -- --env test --skip-schema --skip-data --skip-shared --release-id 20260705-secure-message-batch --skip-smoke`; manifest `/home/bill/ISET/admin-dashboard/tmp/path-deploy/test/20260705-secure-message-batch--2026-07-05T13-12-38-829Z.json`; admin artifact `s3://nwac-test-artifacts/admin-dashboard/admin-dashboard-20260705-091238.zip`; portal artifact `s3://nwac-test-artifacts/portal/portal-20260705-091716.zip`; install SSM commands `5aad611d-a69e-41b0-b965-5b5522cfd85d` and `f736a730-a903-4842-82d4-001750bb2433`; normal-routing smoke green for admin `:5001` and portal `:5000`; deployed-source SSM command `ce4cbac4-f71b-46ac-b7d7-db16774efdb0` confirmed release markers; fallback returned to normal forwarding and SQL-over-SSM command `0a6e957f-3248-4f28-8ecb-33810bf6afc9` confirmed `service_announcement_rows = 0`.
- PROD deploy plan on 2026-07-05: `npm run path:deploy:plan -- --env prod --skip-schema --skip-data --skip-shared --release-id 20260705-secure-message-batch`; manifest `/home/bill/ISET/admin-dashboard/tmp/path-deploy/prod/20260705-secure-message-batch--2026-07-05T13-25-39-387Z.json`; identity `arn:aws:sts::468278742295:assumed-role/nwac-prod-codex-operator/codex-prod-operator`; app deploy `shared=false admin=true portal=true`; source tree clean; smoke targets `3`.
- PROD feedback prerelease update on 2026-07-05: SQL artifact `sql/ops/prod-feedback-secure-message-batch-prerelease-20260705.sql`; SQL-over-SSM command `19f5fd71-1e36-482c-9920-338808e02966`; `#155` moved from `triaging` to `planned`; `#154` stayed `in_progress`.
- PROD deployment on 2026-07-05: `npm run path:deploy -- --env prod --skip-schema --skip-data --skip-shared --release-id 20260705-secure-message-batch --skip-smoke --yes`; manifest `/home/bill/ISET/admin-dashboard/tmp/path-deploy/prod/20260705-secure-message-batch--2026-07-05T13-34-06-602Z.json`; no schema/data/runtime/shared change. Sequence used all-surface warning, all-surface ALB fallback, deploy, local replacement health check, fallback clear for ELB health evaluation, normal-routing smoke, source-marker check, and warning clear. ASG refresh `d4f1d52e-bba3-45ea-9cab-6aaafb27e74b` completed on replacement instance `i-0a24b80359df52380`; final smoke returned `200` for `https://nwac-console.awentech.ca/healthz`, `https://iset.nwac.ca/healthz`, and `https://nwac-public.awentech.ca/healthz`; fallback status returned all PROD hostnames to normal forwarding.
- PROD deployed-source and targeted validation on 2026-07-05: marker SSM command `bd63dd80-c45b-4267-857d-9ac2014a137b` confirmed release id plus admin withdrawal/recipient-confirmation markers and portal applicant-name markers. Read-only SQL-over-SSM command `56372f66-848e-45eb-82c1-ed93e420b34a` confirmed message `1128` remains withdrawn/redacted with both mailbox copies deleted, zero linked attachments/signing requests, and redacted send-event subject; it also confirmed report `#155` context `ISET-20260429-AF259F` has email-like account display name but client name `Molly Hink`. Selector SSM command `2b4c0643-fdf8-43f6-b868-28aff1b35f48` returned `selector-ok:Molly Hink`.
- PROD feedback closeout on 2026-07-05: SQL artifact `sql/ops/prod-feedback-secure-message-batch-prod-closeout-20260705.sql`; SQL-over-SSM command `5402f753-6661-40ee-82b1-dbc71973c4ac`; `#154` remains `in_progress`; `#155` moved from `planned` to `in_progress` because no real applicant-origin PROD email was created for testing.
