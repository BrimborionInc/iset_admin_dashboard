# Participant Details widget

## Workflow

Case Management

## Source

- src/pages/Caseworking/caseWorkspace/widgets/ParticipantDetailsWidget.jsx

## Primary Route Context

- /cases/:caseId

## Purpose

Maintains the participant's current case-level facts without changing an application's frozen assessment, decision, or communication state.

## User Actions (observed)

- Review the current participant profile and ILMP source fields.
- Edit and save the widget from either direct Case Workspace entry or an application-selected entry.

## Inputs / Dependencies

- The case ID identifies the current participant record. An `applicationId` is neither required nor sent for this case-level operation.
- Existing application answers may hydrate older files, but the save request contains only changed fields from the canonical Participant Details DTO rather than a copy of `caseContext`. Unchanged legacy values therefore cannot block or be rewritten by an unrelated correction.
- Normal case access rules apply to ISET Coordinators, Regional Managers, NWAC Administrators, and System Administrators.

## Outputs / Side Effects

- `PATCH /api/cases/:caseId/participant-details` accepts only the widget's participant-owned fields, rejects unknown/application-owned fields atomically, and merges the controlled mapping into the freshly locked `iset_case.case_context_json`.
- Application decision letters, application assessment contexts, reporting artifacts, and unrelated case state are preserved.
- A changed save marks current non-archived mutable ILMP readiness for the case as needing review. Submitted/accepted payload snapshots, storage keys, checksums, and submission status remain historical evidence. A no-op save performs no case or ILMP write.
- The workspace installs the authoritative returned case context and immediately shows ILMP compliance as pending when revalidation is required.

## Current Notes

- This boundary deliberately does not weaken the generic application-mutation guard and does not infer or inject a case-primary application ID.
- The current implementation is local and unreleased. It requires no database migration or historical data repair; feedback `#195` must remain unresolved until the deployed Regional Manager journey is rechecked.
