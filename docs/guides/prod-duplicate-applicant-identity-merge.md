# PROD Duplicate Applicant Identity Merge

Status: current operational guidance for rare live data repairs. Verify schema, code, and live DB state before use.
Last reviewed: 2026-05-04 after the Jodie Stephens PROD repair.

Purpose: record how to detect and repair the pattern where one real applicant has both an imported case/client identity and a later public-portal application identity. This is not a general-purpose merge script. Treat every PROD repair as bespoke, guarded, snapshotted, and recoverable.

## Pattern

This can happen when an applicant was first loaded through Client Batch Import with one email address, then later registered and submitted through the public portal with a different email address.

The public portal intentionally does not fuzzy-match portal applicants to existing imported clients by name, DOB, SIN, or email. The hardened identity path links by the authenticated applicant account/Cognito subject and pinned client relationship. If an imported client has only an invitation or a different account identity, the portal can create a new `user`, `client`, `iset_case`, `iset_application_submission`, and `iset_application`.

Detection signals:

- Same or near-same applicant name across an imported client/case and a public portal application.
- Imported case context includes `clientFileImport` metadata with source workbook, worksheet, row, and import actor.
- Imported client account events show `account_created` from `client_file_import` and possibly `invitation_sent`.
- Public portal user account is activated and owns the submitted application.
- The public portal application has its own client/case, often with a different applicant email.
- Staff may have already started draft action plan, intervention, or proposal work on the imported case.

## Source Of Truth

When the public portal application is the applicant-submitted current record, treat it as canonical for personal details and applicant email. Prefer moving staff work from the imported record into the public application context over moving the public application onto the imported record.

For the 2026-05-04 Jodie Stephens repair, the survivor was public portal client `156` / user `199` / case `134` / application `56`, and the imported identity client `72` / user `75` / case `72` was retired. The reviewed SQL script was `sql/ops/prod-merge-jodie-stephens-client-case-20260504.sql`.

## Repair Shape

Before mutating PROD:

- Verify PROD DB access through `docs/ops/agent-operational-access.md` and `scripts/run-prod-sql-via-ssm.sh`.
- Build a read-only inventory first: clients, users, cases, applications, submissions, action plans, interventions, proposals, assessments, documents, notes/events, messages, reminders, client account events, and audit rows.
- Confirm there is no existing assessment on the survivor application/case unless the repair explicitly accounts for it.
- Take an Aurora snapshot and record the snapshot ID in the SQL metadata.
- Use an application lock when the survivor application exists, and add an admin-scoped runtime service announcement telling staff not to edit the affected records during the repair. Current locking may be optimistic-only, so do not rely on the lock as a complete global write barrier.
- Use a reviewed SQL file with explicit expected IDs and guard checks. Do not improvise ad hoc updates directly in the shell.

Typical merge actions:

- Insert `iset_client_merge_audit` and `iset_case_merge_audit` rows with run ID, snapshot ID, source/target IDs, counts, and rationale.
- Keep the public portal `client`, `user`, `iset_case`, `iset_application_submission`, and `iset_application` as the survivor.
- Seed a draft `iset_case_assessment` on the survivor case/application from any unsubmitted staff proposal metadata when business intent is to continue assessment from that work. Leave missing assessment fields null for staff completion instead of inventing answers.
- Rehome the original draft action plan/intervention/proposal rows to the survivor case/application only if useful for traceability, then mark them archived/withdrawn rather than active.
- Move imported-case manual-upload documents to the survivor client/case/application while preserving `source = 'manual_upload'`, original uploader `user_id`, and previous scope in metadata. If a manual-upload document is linked to an application, it must satisfy `chk_iset_document_manual_upload_scope`, including `applicant_user_id`.
- Preserve portal-submitted documents with `source = 'application_submission'` so staff can distinguish applicant-submitted files from manually uploaded files.
- Repoint case timeline/event rows and client account events only after confirming their object scope and preserving previous IDs in metadata.
- Suspend or otherwise disable the old imported local applicant user if it should not remain usable, especially when it has a different email.
- Retire the imported case shell by archiving/detaching it rather than hard deleting it.

## Verification

After the transaction, independently verify:

- The survivor application remains in the intended lifecycle/status.
- Exactly one draft assessment exists for the survivor application/case when one was created.
- Moved document counts match preflight counts, and source groups still distinguish `application_submission` from `manual_upload`.
- No key child tables still reference the retired case/client unless deliberately preserved as audit metadata.
- The old user is disabled if required.
- The old case is archived/detached and marked as a merged duplicate.
- Client and case merge audit rows exist and include the run ID and snapshot ID.
- Any maintenance warning and application lock are cleared only after verification.

## Recovery Notes

Do not hard delete the imported client/case during this repair class. The safe recovery posture is:

- Aurora snapshot before mutation.
- Guarded transaction with fail-closed checks.
- Audit rows in merge audit tables.
- Metadata on moved records preserving previous scope.
- Retired source case/client/user state left available for forensic review.

The Jodie Stephens repair attempted apply once, hit the manual-upload document CHECK constraint, and rolled back cleanly with no partial changes. The corrected script set `applicant_user_id` for moved application-linked manual uploads and then completed successfully under run ID `jodie-stephens-merge-20260504123533`.
