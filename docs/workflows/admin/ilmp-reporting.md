# Workflow: ILMP Reporting

## Purpose

Prepare participant and reporting-package files for ILMP/ESDC requirements, including readiness checks, validation, payload preview, and export history. PATH currently generates/downloads XML for manual upload; it does not directly submit participant data to ESDC.

## Primary Routes

- `/esdc/participants`
- `/esdc/participant/:clientId`
- `/esdc/reporting`

## Core Widgets (current)

Participant submissions page (`/esdc/participants`):
- Participant submission queue (bucket-style readiness summary, Validate all action, Generate batch XML action, and queue table)
- Recent ILMP exports (optional palette widget for downloaded file audit/requeue work; no longer shown by default)

Participant workspace (`/esdc/participant/:clientId`):
- Submission readiness checklist
- Validation summary
- Payload preview
- Submission history

Reporting packages (`/esdc/reporting`):
- Reporting packages
- Reporting readiness checklist
- Submission notes and follow-ups

Widget references:
- `docs/widgets/admin/esdc-participant-submission-queue-widget.md`
- `docs/widgets/admin/esdc-batch-submission-widget.md`
- `docs/widgets/admin/esdc-participant-submission-history-widget.md`
- `docs/widgets/admin/esdc-readiness-checklist-widget.md`
- `docs/widgets/admin/esdc-participant-workspace-validation-summary-widget.md`
- `docs/widgets/admin/esdc-payload-preview-widget.md`
- `docs/widgets/admin/esdc-participant-workspace-history-widget.md`
- `docs/widgets/admin/esdc-reporting-packages-widget.md`
- `docs/widgets/admin/esdc-reporting-readiness-checklist-widget.md`
- `docs/widgets/admin/esdc-reporting-notes-widget.md`

## Typical Flow

1. Review participant readiness counts and the participant submission queue.
2. Open participant workspace for blocking issues.
3. Resolve readiness items and re-validate payload.
4. Generate and download the batch XML from the participant submission queue header for ready participants, then upload it manually outside PATH.
5. Manage reporting package status/checklist/notes for reporting periods.

## Data & Integration Touchpoints

- ESDC participant submission endpoints.
- ILMP validation and payload generation.
- ISET XML validation treats Appendix A of the ESDC Data Exchange Guide as authoritative for gateway-mandatory fields. Do not rely on the main field sections' `Mandatory: No` wording for ISET exports when Appendix A lists the same element as mandatory.
- Participant export history stores the XML snapshot generated at download/export time. The history `XML` view should not be described as live XML based on current client data.
- Reporting package and notes persistence.
- Intervention/action-plan close-out rules are status-driven: planned end dates on non-terminal interventions stay out of ILMP close-out XML, while completed/cancelled interventions require end date + outcome.
- Intervention duration is exported/stored as the ILMP three-digit duration field and is capped at 999 days. Do not use that cap to limit real program schedules; long intervention start/end dates remain valid and the reportable duration should be clamped.
- Historical/backloaded save flow (updated 2026-06-05): saving an existing/backloaded action plan seeds blank Participant Details fields from the plan's structured ILMP data, including barriers, education/province, social assistance, EI claimant/insurance, previous employment status where it can be mapped, childcare need/funding, and goals/summary. Saving an existing/backloaded intervention seeds blank Participant Details program NOC/version from the intervention NOC. This is an initial data-quality seed only; it preserves staff-entered Participant Details values and does not keep the two records synchronized after staff edits. Older action plans that lack `manual_backload` metadata can still seed when linked interventions carry `manual_backload` / `entryMode=existing` metadata.
- Historical/backloaded action-plan entry guard (updated 2026-06-05): the Add Existing Action Plan modal now loads case/application fallback context and requires the Appendix A action-plan reporting facts before save, including social assistance recipient, EI claimant status, employment status at plan start, action-plan start education level/province, barrier to employment, and conditional previous-employment NOC/version/schedule and childcare funding. The backend create route enforces the same core fields so staff cannot save a backloaded plan that is predictably blocked at ILMP export time.
- PROD Participant Details repair note (2026-06-05): guarded repair `sql/ops/prod-repair-backload-participant-details-seed-20260605.sql` seeded existing/backloaded action-plan/intervention ILMP data into blank Participant Details fields for 30 historical PROD cases. The repair applied 229 field updates, wrote 30 `data_repair` case events, and stored before/after row-level recovery data in `prod_participant_details_backload_seed_audit_20260605`. Post-repair preview `sql/ops/prod-preview-backload-participant-details-seed-20260605.sql` returned `0` remaining candidates. Example verification after repair: Jynell Marr `CASE-2026-0000073` now has Participant Details barriers `["education", "other"]`, program NOC `42201`, and education level `college`.
- PROD Participant Details repair note (2026-06-04): application checkbox/list answers had failed to hydrate into some `iset_case.case_context_json` Participant Details snapshots because the UI answer reader treated arrays as generic objects. After restore point `path-prod-participant-details-arrays-20260604144745`, guarded repair `sql/ops/prod-repair-participant-details-array-backfill-20260604.sql` backfilled 90 cases from each case's primary application, preserving existing Participant Details values, appending missing application values, filling blank `Other` notes only, and writing `data_repair` case events. Post-repair preview `sql/ops/prod-preview-participant-details-array-backfill-20260604.sql` returned `0` remaining candidates; Katrina Woodgate case `MI-MNT3JPF0-5BFEF1` now has barriers `["funding", "other"]`.

## Role Notes

- `/esdc/reporting` is explicitly guarded for Program Administrator (and System Administrator).
- Other ESDC routes are role-matrix controlled.

## Current Gaps / Risks

- ILMP schema conformance and code mappings are sensitive to backend mapping updates.
- Keep this workflow doc aligned with `docs/planning/ilmp-export-hardening-plan.md` and `docs/data/case-finance-data-architecture.md`.
- Current PROD gateway-rejection investigation note (2026-06-04): the 17 records that failed `numberOfDependantChildren` were all imported `client_file_import` cases assigned to Amanda Curtis, with no linked public-portal `iset_application` row and no structured dependent-child yes/no, count, or ages available in case/client JSON or matching case notes. Each record had at least one Amanda-created `manual_backload` / `existing` intervention; most action plans were explicitly stamped the same way, while a few older action-plan rows lacked source metadata but were owned by Amanda. Do not auto-convert missing/null dependant-child values to zero for this population; staff confirmation is needed unless PATH has an explicit `No`, a valid count, or ages from which to count children aged 18 or less.
- Current PROD gateway-rejection investigation note (2026-06-04): the 15 records that failed `maritalStatus` are the same imported/backloaded population pattern: Amanda Curtis owns each case, none has a linked public-portal application, and `case_context_json.maritalStatus` plus `applicationAnswers."marital-status"` are blank. Do not infer a marital status from null; the ESDC code set has no "unknown" or "none" value. These should be included in the staff data request alongside dependent-child facts.
- Current PROD gateway-rejection investigation note (2026-06-04): the same 15 imported/backloaded Amanda Curtis cases failed `languageSpoken`. PATH reads `case_context_json.languageSpoken` / `preferredLanguage` before application `language-spoken` / `preferred-language`, but all four sources are blank and there are no linked applications. The group has one case note, unrelated to language, and no language-like case events. Do not default missing language to English or `None of the above`; staff confirmation is required.
- Current PROD gateway-rejection investigation note (2026-06-04): the single `educationLevel` gateway failure is Piper Campo, case `CASE-2026-0000037`, action plan `61` (`Skills Development`, effective `2025-12-03`). The action plan is a manual backload/existing record with no linked application; action-plan `esdc_action_plan_json.educationLevel`, case `educationLevel`, and application-answer education fields are null. Intervention `133` says `Bachelor of Arts Year 1`, but that is program participation, not proof of the participant's highest completed education at action-plan creation. Treat this as staff-confirmed missing action-plan data. Local code now requires action-plan start education level and education province during both normal and existing/backloaded action-plan creation, not only in Action Plan Details / ILMP validation; deploy is still required before PROD staff see that guard.
- Current open bug note (2026-06-05): feedback report `#137` tracks the Shayleen McNabb `ISET-20260410-78062A` manual-backload data-flow issue where Participant Details displayed application fallback values while root Participant Details and action-plan ILMP JSON were blank. Guarded PROD repair `sql/ops/prod-repair-shayleen-mcnabb-ilmp-safe-fields-20260605.sql` ran after restore point `path-prod-shayleen-ilmp-safe-repair-20260605151744`, wrote audit row `prod_shayleen_ilmp_safe_repair_audit_20260605`, reset ESDC submission `115`, and filled only safe Participant Details/application/action-plan facts. Post-repair preview `sql/ops/prod-preview-shayleen-mcnabb-ilmp-safe-repair-20260605.sql` shows no remaining safe repair candidates; the remaining case-manager facts are barrier to employment, EI claimant category, and previous employment NOC/version if the application full-time employment answer is correct.
