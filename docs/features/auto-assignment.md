# Auto Assignment

**Purpose:** Document how automatic assignment rules are configured and consumed across the admin console and public portal.  
**Audience:** Engineers and operators maintaining intake ingest, case assignment, and runtime config.  
**Last Updated:** 2025-12-04

## Overview
- Auto assignment rules are configured in the admin console via the Automatic Assignment widget (`AutoAssignmentConfigWidget.js`) and stored in `iset_runtime_config` (`scope='workflow'`, `k='autoAssignment'`).
- Execution lives in the public portal ingest path (`../ISET-intake/server.js`): when a submission is completed, the portal reads the stored config, extracts facts from the submitted intake payload, and (if enabled) assigns the newly created case to a staff profile.
- The admin applications list now surfaces `address-province` by coalescing from the immutable submission payload, but rule evaluation in the portal already uses the immutable payload directly.

## Rule Model
- Allowed fields: `province`, `indigenous_group`, `any`.
- Operators: `equals`, `in`, `not_in`, `exists`, `always`.
- Prioritization: rules are sorted by ascending `priority`; the first matching rule wins. Rule fields/values are normalized to lowercase strings.
- Province facts are read from `address-province` (fallbacks: `address_province`, `province`) in the submission payload. Indigenous group facts are read from `legal-indigenous-identity` (fallbacks: `legal_indigenous_identity`, `indigenous-identity`, `indigenous_identity`).

## Execution Flow (Portal)
1. Submission ingested -> `iset_application_submission.intake_payload` stored (immutable).
2. Working `iset_application` created if missing (payload starts with a minimal snapshot).
3. Auto assignment runs **once** during ingest:
   - Load config via `readAutoAssignmentConfig`.
   - Build facts with `extractAutoAssignmentFacts(intakePayload)`.
   - Choose assignee with `pickAutoAssignment` (first-match by priority).
   - If a valid `assigneeId` is found (must exist in `staff_profiles`), the new `iset_case` is created with `assigned_to_user_id` set and events logged (`auto_assigned`).
4. No re-evaluation occurs after ingest; edits in admin do not trigger auto assignment.

## Operational Notes
- Config storage: `iset_runtime_config` (`workflow:autoAssignment`), managed via `/api/config/auto-assignment` in the admin server.
- Data source for facts: immutable submission payload (`iset_application_submission.intake_payload`), not the mutable `iset_application.payload_json`.
- If `address-province` is missing in the submission payload, province-based rules will not match.
- Admin-side province column now falls back to the submission payload to display the stored value, but that does not affect portal rule evaluation (which already uses the submission payload).

## Gaps / Next Steps
- Re-evaluate rules on subsequent state changes if required (not implemented).
- Add metrics/telemetry for auto-assignment hits/misses.
- Document any future evaluators or worker processes if they move out of the portal ingest path.
