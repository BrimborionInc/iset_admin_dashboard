# Conflict of Interest Declaration (Admin Assessment)

Purpose: capture how the assessment workspace records conflict-of-interest attestations now that signing is tracked per staff member. Reference this when updating the coordinator assessment widget, API handlers, or data extracts.

Last Updated: 2026-07-09

## Key Changes

- Legacy boolean fields on `iset_case_assessment` (`conflict_declaration_signed`, `_at`, `_by`) have been removed.
- Each signature is now persisted in `iset_case_conflict_declaration` with one active row per `(case_id, staff_profile_id)`:
  - `id` BIGINT PK, `case_id`, `staff_profile_id`, `signed_at`, optional `signed_ip`, `signed_user_agent`.
  - `declaration_choice` (`no_conflict` | `conflict`) captures what the coordinator declared at sign time; `conflict_details` stores their written disclosure when `declaration_choice = conflict`.
  - Conflict review is recorded as a disposition on the original declaration, not by rewriting the declaration: `resolution_outcome` (`cleared` | `reassigned`), `resolved_at`, `resolved_by_staff_profile_id`, and optional `resolution_note`.
  - `revoked_at` + `revoked_reason` allow manual resets without deleting audit history.
  - A partial unique index (`case_id`, `staff_profile_id`, `revoked_at IS NULL`) prevents duplicate active signatures.

## API Behaviour

- `GET /api/cases/:id` and the internal refresh path now join `iset_case_conflict_declaration` for the **requesting staff profile**. Response fields:
  - `assessment_conflict_declaration_signed` → `1/0` depending on whether the current user has an active row.
  - `assessment_conflict_declaration_signed_at` → timestamp from their row.
  - `assessment_conflict_declaration_signed_by` → their `staff_profile_id`.
  - `assessment_conflict_declaration_choice` → `'no_conflict'` or `'conflict'` (defaults to `no_conflict` for legacy rows).
  - `assessment_conflict_declaration_details` → disclosure text (nullable, only present when the coordinator declared a conflict).
  - `assessment_conflict_declaration_resolution_outcome`, `_resolved_at`, and `_resolution_note` describe any administrator/manager disposition of the staff member's declared conflict.
- `PUT /api/cases/:id { assessment_conflict_declaration_signed }` inserts or revokes rows:
  - `1` ⇒ insert new row if none active (captures IP/UA metadata, emits `conflict_declaration_signed` event). Supports optional `assessment_conflict_declaration_choice` + `assessment_conflict_declaration_details` to record disclosures in the same write (details required when declaring a conflict).
  - `0` ⇒ soft-revoke the signer’s active row (sets `revoked_at = NOW()`), used when resetting a declaration.
  - The endpoint now requires an identified staff profile; requests without `req.staffProfile.id` are rejected with `conflict_declaration_requires_staff_profile`.
- `GET /api/dashboard/conflict-declarations` lists only active declared conflicts with no disposition (`declaration_choice='conflict'`, `revoked_at IS NULL`, `resolution_outcome IS NULL`).
- `POST /api/cases/:id/conflicts/resolve` requires `staff_profile_id` and `resolution_note`. It preserves the original `declaration_choice='conflict'`, writes `resolution_outcome='cleared'`, records `conflict_declaration_resolved`, and sends a direct staff-profile bell notification to the declaring staff member using applicant-name wording and the resolution note.
- `POST /api/cases/:id/conflicts/revoke` accepts the new `assignee_id` and performs the case assignment, `resolution_outcome='reassigned'` disposition, soft revocation, `conflict_declaration_reassigned` event, and direct declaring-staff notification as one transaction. Reassignment accepts optional reviewer notes; when supplied, the note is stored on the disposition row and included in the event payload/direct notification alongside the original declaration, resolver, applicant name, and new assignee.
- Conflict disposition, audit-event, and declaring-staff notification writes are atomic. A failed event or notification write rolls back the disposition; concurrent review attempts lock the declaration and only one disposition can win.
- Conflict disposition bell notifications intentionally bypass broad role-audience notification settings. They target the declaring `staff_profile_id` directly so a conflict review response is not broadcast to other coordinators, managers, or administrators.

## UI Requirements

- Coordinator Assessment widget keeps the gate for case managers and evaluates it per user (the case unlocks only after **you** sign).
- Members of the NWAC Administrator group are exempt from the widget gate during approval review; their approval workflow is blocked by EI eligibility and normal decision permissions, not by a per-case conflict declaration.
- Declaration flow must let coordinators explicitly choose between “no conflict” and “I have a potential conflict”, requiring a text disclosure when a conflict is declared.
- A persisted declared conflict blocks the coordinator until it receives a disposition. A `cleared` disposition unlocks the assessment while preserving the original conflict declaration and review audit trail.
- After signing, the widget stores the returned timestamp and the declared choice so it can show “Conflict declaration signed on YYYY-MM-DD (no conflict|conflict declared)”.
- Info copy under the declaration reminds coordinators that signatures are personal and must be re-done after reassignment.
- The `Unresolved Conflicts` resolve modal requires notes. Conflict-related reassignment also shows an optional notes field. Review notes are stored in the disposition/event payload and sent to the staff member who declared the conflict.

## Operational Notes

- Because signatures cascade on case delete (`ON DELETE CASCADE`), data cleanup remains simple.
- If QA needs to reset a declaration, calling `PUT /api/cases/:id` with `assessment_conflict_declaration_signed = 0` as the original signer will revoke their row; a new signer will still see the pending gate until they sign.
