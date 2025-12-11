# Conflict of Interest Declaration (Admin Assessment)

Purpose: capture how the assessment workspace records conflict-of-interest attestations now that signing is tracked per staff member. Reference this when updating the coordinator assessment widget, API handlers, or data extracts.

Last Updated: 2026-01-07

## Key Changes

- Legacy boolean fields on `iset_case_assessment` (`conflict_declaration_signed`, `_at`, `_by`) have been removed.
- Each signature is now persisted in `iset_case_conflict_declaration` with one active row per `(case_id, staff_profile_id)`:
  - `id` BIGINT PK, `case_id`, `staff_profile_id`, `signed_at`, optional `signed_ip`, `signed_user_agent`.
  - `declaration_choice` (`no_conflict` | `conflict`) captures what the coordinator declared at sign time; `conflict_details` stores their written disclosure when `declaration_choice = conflict`.
  - `revoked_at` + `revoked_reason` allow manual resets without deleting audit history.
  - A partial unique index (`case_id`, `staff_profile_id`, `revoked_at IS NULL`) prevents duplicate active signatures.

## API Behaviour

- `GET /api/cases/:id` and the internal refresh path now join `iset_case_conflict_declaration` for the **requesting staff profile**. Response fields:
  - `assessment_conflict_declaration_signed` → `1/0` depending on whether the current user has an active row.
  - `assessment_conflict_declaration_signed_at` → timestamp from their row.
  - `assessment_conflict_declaration_signed_by` → their `staff_profile_id`.
  - `assessment_conflict_declaration_choice` → `'no_conflict'` or `'conflict'` (defaults to `no_conflict` for legacy rows).
  - `assessment_conflict_declaration_details` → disclosure text (nullable, only present when the coordinator declared a conflict).
- `PUT /api/cases/:id { assessment_conflict_declaration_signed }` inserts or revokes rows:
  - `1` ⇒ insert new row if none active (captures IP/UA metadata, emits `conflict_declaration_signed` event). Supports optional `assessment_conflict_declaration_choice` + `assessment_conflict_declaration_details` to record disclosures in the same write (details required when declaring a conflict).
  - `0` ⇒ soft-revoke the signer’s active row (sets `revoked_at = NOW()`), used when resetting a declaration.
  - The endpoint now requires an identified staff profile; requests without `req.staffProfile.id` are rejected with `conflict_declaration_requires_staff_profile`.

## UI Requirements

- Coordinator Assessment widget keeps the gate but evaluates it per user (the case unlocks only after **you** sign).
- Declaration flow must let coordinators explicitly choose between “no conflict” and “I have a potential conflict”, requiring a text disclosure when a conflict is declared.
- After signing, the widget stores the returned timestamp and the declared choice so it can show “Conflict declaration signed on YYYY-MM-DD (no conflict|conflict declared)”.
- Info copy under the declaration reminds coordinators that signatures are personal and must be re-done after reassignment.

## Operational Notes

- Because signatures cascade on case delete (`ON DELETE CASCADE`), data cleanup remains simple.
- If QA needs to reset a declaration, calling `PUT /api/cases/:id` with `assessment_conflict_declaration_signed = 0` as the original signer will revoke their row; a new signer will still see the pending gate until they sign.
