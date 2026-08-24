# Client Batch Import Dashboard

Date: 2026-03-23

## Summary

- Route: `/iset/imports/client-files`
- Navigation label: `Configuration > Client Batch Import`
- Default access: `System Administrator`, `NWAC Administrator`
- Purpose: backload participant/client spreadsheets into real client files without fabricating historical applications or downstream case artefacts.
- Follow-on operating model: after import, case managers build out pre-go-live action plans, interventions, funding/cost details, and documents from the Case Workspace using explicit backload actions rather than fake intake workflow.

## Current behavior

- Accepts one `.xlsx`, `.xlsm`, or `.csv` file per dry run.
- Current limits:
  - 5 MB upload size
  - 500 data rows per run
- Requires a header row and recognizes the client-profile columns used for identity, contact, address, Indigenous identity, and SIN. `Date of Birth` is accepted when known but is not required for commit.
- Auto-detects the most likely header row by recognized import columns instead of assuming the first populated row is the header.
- Auto-skips leading guidance or field-mapping rows after the header when the sheet includes import instructions above the real data.
- Supports an optional `First data row` override in the UI when staff need to force the dry run to start from a specific row.
- The current NWAC template header `SIN (9 digits; will be hashed)` is still accepted as the live SIN import column despite the legacy wording.
- Template helper columns such as `QC Status (auto)` and `Home Community Code (saved)` are intentionally ignored without warning.
- Provides a dry-run preview before any write occurs.
- Commit is disabled when any row is blocked.

## Matching and commit rules

- Matching precedence:
  - raw `SIN`
  - prior case/submission `SIN` fallback
  - normalized email
  - first name + last name + DOB when DOB is available
  - stricter name-only fallback when DOB is absent
- Rows are blocked when:
  - required name/header data is invalid or missing
  - the same person appears more than once in the uploaded file
  - the row matches more than one client
  - the matched client already has multiple cases
- SIN-specific behavior:
  - a malformed or checksum-failing SIN is shown as a warning in dry run, not a blocking error
  - the raw digits are still imported into the client file for later review/correction in Case Workspace
  - the importer stores raw `sin` values in the client/case profile payloads and uses raw 9-digit SIN values for import matching
- DOB-specific behavior:
  - a blank DOB does not block import
  - an unreadable DOB is shown as a warning and imported as blank
- Ready rows commit in one of three modes:
  - create a new `client` and a new application-less `iset_case`
  - create an application-less `iset_case` for an existing matched client
  - update the single existing case already linked to the matched client
- Commit is retry- and concurrency-safe at the database boundary:
  - an identical request by the same staff actor replays its stored committed result
  - a hashed row-identity claim serializes new-client creation without storing SIN in the claim key
  - case cardinality is checked again after the canonical client is locked, so a concurrent case create is updated rather than duplicated
  - if the locked client has multiple cases or an identity claim conflicts, commit fails closed for explicit review

## Intentional constraints

- May silently create/link an applicant account only when the import row resolves to one clean email value, but does not send any applicant email during import.
- Does not create `iset_application`, `iset_application_submission`, assessment, action-plan, intervention, or document placeholder records.
- Writes participant profile data into:
  - `client`
  - `client.address_json`
  - `iset_case.case_context_json`
- Uses the same participant profile structure that the Case Workspace participant editor reads and writes.

## Key files

- `src/pages/imports/ClientFileImportDashboard.jsx`
- `src/pages/imports/widgets/ClientFileImportWidget.jsx`
- `src/helpPanelContents/clientFileImportDashboardHelp.js`
- `src/helpPanelContents/clientFileImportWidgetHelp.js`
- `isetadminserver.js`
- `docs/guides/client-file-imports.md`
