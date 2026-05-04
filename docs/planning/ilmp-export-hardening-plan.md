# ILMP Export Hardening Plan (Schema 1.4)
_Last updated: 2025-01-03_

## Objective
Refactor the ILMP export pipeline to produce fully schema-compliant ILMP (ALMP) participant payloads (v1.4). Align all mappings to `case_context_json` and case/intervention records; enforce code sets and conditional rules; keep frontend as a thin viewer.

## Scope
- Backend ILMP mapper/validator in `isetadminserver.js` (`buildIlmpParticipantPayload`, `runIlmpValidation`).
- Data sources: `case_context_json`, `iset_case_action_plan`, `iset_case_intervention`, assessment records; seeded code tables (province, intervention codes/outcomes).
- Frontend: `ExportPreviewWidget.jsx` (viewer only).

## Plan & Tasks
1) **Lock the contract (ILMP 1.4)**
   - Use `docs/data/ESDC` (ILMP 1.4) to enumerate required/conditional fields and allowed codes.
   - Produce a source → ILMP tag/code map (participant, action plan, interventions).
2) **Close source data gaps**
   - Inventory ILMP-required fields vs `case_context_json` and DB columns.
   - Add/normalise fields that are missing (e.g., outcome code/duration/cost/NOC/version, childcare codes, EI/social assistance codes) to `iset_case_intervention`/`case_context_json` as needed. Since we’re in dev, add columns now rather than carrying ad-hoc metadata.
3) **Centralise mapping in backend**
   - Refactor `buildIlmpParticipantPayload` to:
     - Read participant fields from `case_context_json` first; map to ILMP codes (gender, Indigenous identity, marital status, language, EI, social assistance, childcare, barriers).
     - Normalise address (province code, postal with space) and contact.
     - Map action plan fields: agreement number, start/result dates/codes, childcare need/funding codes, goal/summary.
     - Map interventions: code/outcome/dates/duration/cost/NOC/version, supports/notes; enforce numeric codes per ILMP tables.
     - Emit ALMP root/namespace and strip any non-XSD elements.
   - Keep validation in sync with mapping rules.
4) **Tighten validation**
   - Extend `ILMP_PARTICIPANT_RULES` to enforce code sets (EI claimant, social assistance, childcare, education level/location, barriers, outcomes) and conditionals (duration/cost when dates present; plan result when closed; province/postal prefix).
   - `/prepare-ilmp` should block on schema violations with explicit messages.
5) **Snapshot/export**
   - Ensure payload snapshot stores ALMP XML, checksum, schemaVersion, storage key; `exportPreview.ilmp` reflects the new XML.
6) **Frontend**
   - Keep `ExportPreviewWidget` as a viewer; optionally label the payload as ILMP 1.4 and surface blocking issues from the backend.
7) **Testing**
   - Add backend unit tests for the mapper with fixtures and XSD validation (if practical).
   - Add `/prepare-ilmp` end-to-end tests verifying blocking issues for invalid codes/durations.

## Notes
- Assume ILMP 1.4 is the standard; if a newer XSD is provided, repeat the mapping audit.
- No legacy data to support; prefer schema-aligned columns/metadata now. Application payload is for initial seeding only.

## Progress
- 2025-01-04: Added ILMP-aligned columns to `iset_case_intervention` (intervention_code, related_noc/version, duration_days, intervention_cost) and refactored intervention create/update handlers to populate them. Mapper now prefers columns with metadata fallback; existing rows backfilled from metadata. Next: tighten ILMP mapping/validation to the 1.4 schema and adjust export XML to ALMP structure end-to-end.
- 2026-05-04: ILMP close-out validation and XML emission are now status-driven, not date-driven. Existing `end_date` remains the single stored intervention date, but active/planned/in-progress/suspended interventions may carry it as a planned end date without requiring an outcome or emitting ILMP `interventionEndDate` / `interventionOutcome`. Completed/cancelled interventions still require end date + outcome and emit those close-out fields. Closed action plans require result code/date and related close-out fields; non-terminal plans do not emit result fields.
