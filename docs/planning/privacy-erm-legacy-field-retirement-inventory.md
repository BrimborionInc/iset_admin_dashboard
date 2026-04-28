# Privacy ERM Legacy Field Retirement Inventory

Purpose: track the remaining compatibility-shadow columns so physical column retirement can be planned without guessing during TEST/PROD migration.

Last Updated: 2026-04-27

Canonical audit source: `docs/data/privacy-erm-audits/dev-20260426.md`, section `Legacy compatibility shadow retirement inventory`.

## Current DEV Snapshot

| Table | Legacy field | Canonical field | DEV values | Drift / unresolved | Retirement classification |
| --- | --- | --- | ---: | ---: | --- |
| `messages` | `sender_id` | `sender_actor_type` + `sender_user_id` + `sender_staff_profile_id` | Retired | 0 | Physically retired in DEV by `20260427_0009`; aggregate retirement audit recorded 6 values and 0 drift before drop. |
| `messages` | `recipient_id` | `recipient_actor_type` + `recipient_user_id` + `recipient_staff_profile_id` | Retired | 0 | Physically retired in DEV by `20260427_0009`; aggregate retirement audit recorded 6 values and 0 drift before drop. |
| `iset_case` | `assigned_to_user_id` | `assigned_staff_profile_id` | Retired | 0 | Physically retired in DEV by `20260427_0010`; aggregate retirement audit recorded 2 values and 0 drift before drop. |
| `iset_internal_notification` | `audience_user_id` | `audience_actor_type` + typed audience ID | Retired | 0 | Physically retired in DEV by `20260427_0011`; aggregate retirement audit recorded 35 direct-audience shadow values and 0 drift before drop. |
| `iset_internal_notification_dismissal` | `user_id` | `viewer_actor_type` + typed viewer ID | Retired | 0 | Physically retired in DEV by `20260427_0011`; aggregate retirement audit recorded 42 dismissal shadow values and 0 drift before drop. |
| `iset_event_receipt` | `recipient_id` | `viewer_staff_profile_id` + `viewer_applicant_user_id` | Retired | 0 | Physically retired in DEV by `20260427_0012`; aggregate retirement audit recorded 0 rows and 0 unresolved typed viewers before drop. |
| `iset_case` | `application_id` | `iset_application.case_id` | Retired | 0 | Physically retired in DEV by `20260427_0013`; row-level retirement audit recorded 2 legacy case pointers, 0 post-backfill mismatches, and all 3 applications now have `case_id`. |
| `iset_event_entry` | `actor_id` | `actor_staff_profile_id` + `actor_applicant_user_id` | 55 | 0 | Retained audit principal text; staff/applicant rows are CHECK-hardened to typed actors in DEV by `20260427_0016`. |
| `iset_application_version` | `created_by_id` | `created_by_staff_profile_id` + `created_by_user_id` | Retired | 0 | Physically retired in DEV by `20260427_0015`; version code now derives author labels from typed refs. |

## Retirement Gates

Physical retirement should happen only after all gates for a field are true in DEV and then repeated in TEST/PROD rehearsal:

- Data gate: audit reports `mismatches_or_unresolved = 0`, or unresolved rows have been explicitly quarantined.
- Code gate: no runtime write path inserts or updates the legacy field, except an intentional migration bridge.
- Response gate: API consumers receive canonical fields and no known internal UI uses the legacy field for routing, display, or authorization.
- Schema gate: replacement indexes/unique keys exist where the legacy column is part of an access or dedupe path.
- Deployment gate: the field is not dropped in the same release that first migrates production data into its canonical replacement.

## Next Code-Removal Order

1. Remaining work is now pre-deployment rehearsal and focused scope-denial testing. The remaining ID-like no-FK inventory is classified as runtime keys, external references, audit principals, upload tokens, tutorial keys, or lookup keys; do not force those into row FKs without a model change.

Completed in DEV:

- Secure-message participant shadows: `messages.sender_id` and `messages.recipient_id` are no longer selected or written by the admin/portal secure-message paths and were physically dropped by migration `20260427_0009_retire_secure_message_legacy_participant_columns.sql`.
- Case assignment shadow: `iset_case.assigned_to_user_id` is no longer selected or written as a physical case column by the admin/portal/shared assignment paths and was physically dropped by migration `20260427_0010_retire_legacy_case_assignment_shadow.sql`. Legacy response aliases may still be emitted from `assigned_staff_profile_id`.
- Internal notification audience/viewer shadows: `iset_internal_notification.audience_user_id` and `iset_internal_notification_dismissal.user_id` are no longer selected or written by notification fetch/dismiss/dispatch paths and were physically dropped by migration `20260427_0011_retire_internal_notification_legacy_identity_shadows.sql`.
- Event receipt shadow: `iset_event_receipt.recipient_id` is no longer used by typed event feed/read-state paths in DEV and was physically dropped by migration `20260427_0012_retire_event_receipt_legacy_recipient_shadow.sql`.
- Case/application pointer: `iset_case.application_id` is no longer selected or written by admin/portal/shared runtime paths and was physically dropped by migration `20260427_0013_retire_legacy_case_application_pointer.sql`. Application ownership now lives on `iset_application.case_id`.
- Application ownership hardening: `iset_application.client_id` and `iset_application.case_id` are required in DEV by migration `20260427_0014_harden_application_case_scope.sql`; the row-level hardening audit recorded 3 applications and 0 blockers.
- Application-version author shadow: `iset_application_version.created_by_id` is no longer selected or written by version runtime paths and was physically dropped by migration `20260427_0015_retire_application_version_legacy_author_shadow.sql`.
- Event-entry typed actor scope: `iset_event_entry.actor_id` is retained audit text, but staff/applicant rows now require the corresponding typed actor ref through migration `20260427_0016_harden_event_entry_typed_actor_scope.sql`.
- Application/CFA relationship hardening: application submission/version lineage and CFA series/version/document/participant references are constrained in DEV by migration `20260427_0017_harden_application_and_cfa_relationship_fks.sql`.
- Remaining relationship hardening: client-account events, input-state client links, case-assessment budget-pot links, case-reminder action-plan links, and staff-profile region links are constrained in DEV by migration `20260427_0018_harden_remaining_relationship_fks.sql` after orphan client-account events were preserved and deleted.
- Legacy document experiment table: `zzz_legacy_documents` was empty in DEV and was physically dropped by migration `20260427_0019_retire_zzz_legacy_documents_table.sql`; TEST/PROD must quarantine/archive any non-empty rows before applying it.

## Retain / Redesign Separately

- `iset_event_entry.actor_id` should not be dropped just because typed actor refs exist. It is retained original-principal audit text and no longer supplies authorization/display enrichment when typed refs exist.
- `application_lock.owner_user_id` and `user_session_audit.user_id` are opaque auth principals, not shared-user FK shadows. Treat them as a lock/session principal redesign, not this retirement lane.
- Submission/draft/input-state `workflow_id` values are runtime string keys such as `iset-v1`, not numeric `workflow.id` values. Redesign with an explicit workflow key column before adding constraints.
- Budget agreement IDs, PTMA agreement IDs, finance saved-view budget-version IDs, payment-provider message IDs, pending-upload IDs, tutorial IDs, event correlation/tracking IDs, and lookup-table primary keys are non-row identifiers in the current model.
