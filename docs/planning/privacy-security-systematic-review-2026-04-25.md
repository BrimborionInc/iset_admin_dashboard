# Privacy and Security Systematic Review - 2026-04-25

Purpose: durable audit log and work plan for the post-incident privacy/security review focused on client-data exposure paths.

## Trigger

On 2026-04-23 the public portal secure-message incident confirmed that applicant-origin secure messages could be misrouted when code treated `iset_case.assigned_to_user_id` (`staff_profiles.id`) as a shared `user.id`. The repaired incident class is documented in `docs/ops/path-portal-secure-message-incident-2026-04-23.txt` and repaired by `sql/ops/prod-fix-applicant-message-recipient-collision-20260423.sql`.

This review extends that incident response from identity-domain correctness into broader object-level authorization for client data.

## Review Method

1. Map externally reachable API surfaces before and after the admin staff-auth middleware.
2. Prioritize client-data objects with high privacy sensitivity: secure messages, documents, payment packets, applications, cases, notes, and generated exports.
3. For each route family, prove both authentication and object-level authorization:
   - staff identity domain: `staff_profiles.id` vs local `user.id`
   - case/client scope: assigned case, regional portfolio, admin/global role, finance role
   - target mutation scope: existing object access and destination object access
   - file access: presigned URLs must not be grantable by document ID alone
4. Patch confirmed exposure paths before speculative cleanup.
5. Add focused regression coverage around reusable authorization primitives.

## Findings Addressed In This Pass

### Admin Supporting Documents

Risk: several document endpoints were staff-authenticated but not scoped to the requester's case/client access. A staff user who could guess or discover a document ID could request a presigned S3 preview URL, list another applicant's documents, mutate metadata/links, duplicate, or delete records without proving access to the underlying case.

Patched in `isetadminserver.js`:

- Added reusable case-access lookups for case, application, action plan, intervention, document, and client-derived context.
- Added `validateDocumentAccess`, `validateApplicantDocumentContextAccess`, and `validateDocumentAttachmentContextAccess`.
- Scoped:
  - `GET /api/applicants/:id/applications`
  - `GET /api/applicants/:id/document-checklist`
  - `GET /api/applicants/:id/documents`
  - `GET /api/cases/:id/documents`
  - `GET /api/documents/:id/presign-download`
  - admin document upload, update, intervention-link, duplicate, and delete routes
- Added frontend case-context query parameters where widgets previously called applicant document endpoints without case/application/intervention context.

### Finance Payment Packets

Risk: payment-packet routes allowed broad payment-role access, including `Regional Manager` and `ISET Coordinator`, but list/detail/export/mutation routes did not consistently scope packets to the user's case access.

Patched in `isetadminserver.js`:

- Added `validatePaymentPacketAccess`, `validatePaymentTargetAccess`, and `validatePaymentPacketDocumentAccess`.
- Finance roles remain global for payment operations.
- Casework payment roles (`Regional Manager`, `ISET Coordinator`) are limited by the same case access rules used elsewhere.
- Batch and ledger endpoints now require global finance/admin payment access rather than casework payment access.
- Payment document attach/update/delete, payment line mutation/status, packet PDF/audit-bundle, communications, validation, send, update, delete, and status routes now validate packet scope.
- Document presign can use a payment-packet context (`paymentPacketId`) when a finance workflow needs to open a same-packet/same-client document that is not yet linked as payment evidence.

### Admin Secure Messages

Risk: admin case-message routes allowed a staff-authenticated requester to read another case's secure-message thread by case ID. The read path also seeded `message_item` mailbox rows for the requester before proving case access, which could turn an unauthorized probe into a durable mailbox association. Attachment presign/adoption and mailbox mutation routes then trusted the mailbox row too much.

Patched in `isetadminserver.js`:

- Retired the broad legacy `GET /api/admin/messages` and `POST /api/admin/messages` endpoints with `410 retired_endpoint`.
- Added message/case access helpers that resolve the message's case/application/applicant context before attachment presign, adoption, status, delete, or purge operations.
- Scoped `GET /api/cases/:id/messages` to require case access for staff requesters before seeding mailbox rows.
- Scoped `POST /api/cases/:id/messages` so staff can send applicant secure messages only for cases they are authorized to access.
- Scoped `GET /api/admin/messages/:id/attachments`, `PUT /api/admin/messages/:id/status`, `PUT /api/admin/messages/:id/delete`, and `DELETE /api/admin/messages/:id/hard-delete`.

Remaining follow-up: run a production data report for unauthorized `message_item` rows that may have been created before this guard was added, then decide whether a guarded cleanup SQL is needed.

### Notes, Reminders, And Events

Risk: notes, reminders, and timeline events carry narrative client data. Several routes were case-authenticated only by URL shape or reminder ID, not by case-level authorization.

Patched in `isetadminserver.js`:

- Added reminder target/access helpers that validate case, application, action-plan, and intervention scope.
- Scoped `GET /api/reminders` so non-admin callers must provide case/application scope and cannot request global reminders.
- Scoped reminder detail, create, update, complete, and acknowledge routes to existing and destination reminder context.
- Scoped case note list/create/update/delete routes to case access before returning or mutating note bodies.
- Scoped `GET /api/cases/:case_id/events` to case access before returning the timeline.

## Durable Rules

- Never grant document file access from `iset_document.id` alone. Resolve the document to case/application/action-plan/intervention/client/payment context first.
- Applicant document list/checklist routes must include scoped context for non-admin users: `caseId`, `applicationId`, or `interventionId`.
- A mutation that moves or links a document must validate both the existing document and the destination context.
- Secure-message thread reads must validate case access before seeding or trusting `message_item` rows.
- Secure-message attachment presign/adoption must validate the message's case context, not just mailbox ownership.
- Reminder routes must validate both the existing reminder context and any new destination context on update.
- Case notes and case events must be treated as client data and case-scoped before response.
- Payment packet access has two layers:
  - finance/admin payment roles are global
  - casework payment roles are case-scoped
- Payment batches and full ledger exports are finance/admin-only surfaces.
- Staff actor/audit `*_user_id` columns still require explicit local `user.id` resolution; do not reuse `staff_profiles.id`.

## Verification

- `node.exe --check isetadminserver.js`
- `node.exe ./node_modules/jest/bin/jest.js tests/applicationSubmissionDocumentScope.test.js tests/caseAccess.test.js --runInBand`
- `git diff --check`

The WSL `node` binary is not available in this checkout; direct `node` failed, while Windows `node.exe` was available and used successfully.

## Deployment

These changes close high-severity client-data exposure paths and were promoted after verification:

- TEST release `20260425-113852` deployed successfully.
- PROD release `20260425-114853` deployed successfully.
- PROD restore snapshot: `path-prod-20260425-114853-20260425114911`.
- PROD smoke checks returned 200/ok for admin, portal, and public health endpoints.

## Remaining Review Lanes

- Public portal unauthenticated/support endpoints still need live review, but DEV now tightens AI support prompt/history sensitive-data filtering before OpenRouter calls.
- Public portal secure-message routes should still get live denial tests, even though the initial scan found them substantially safer after the 2026-04-23 incident fix and DEV now removes checked shared-user-to-staff-profile email fallbacks.
- Escalations and generated consent/declaration forms have now been covered in DEV route-scope hardening; signing-request detail/sign scope is covered by the static smoke, but live denial tests are still needed.
- Admin feedback attachments now have an initial DEV pass: presigned attachment URLs are generated only from report-detail rows and that detail route is System Administrator-only. Admin AI/debug surfaces now have an initial DEV pass: admin AI chat blocks obvious raw identifiers before OpenRouter, denial-letter drafts use local templates, and AI dummy-data generators require the unsafe debug gate. Notification template/routing configuration APIs now enforce System/NWAC Administrator access server-side, and legacy generic `/api/users` shared-table directory endpoints are retired. Broader diagnostic/debug endpoint live denial tests are still needed.
- SQL/reporting/export surfaces have an initial DEV pass: Query Editor export is active-database only, reporting dashboards are admin-only, and finance payment exports use finance/global or packet-scope guards. Live denial/export tests are still needed.
- Full automated route-level regression coverage for document, payment, message, note, reminder, and event object-scope denial cases.
