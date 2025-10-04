# ISET Application Form Widget - Edit Mode Design

## Overview
- enable admin users to unlock an applicant submission for targeted corrections without altering the canonical submission record
- maintain strict separation between immutable intake payloads and mutable admin-managed application records
- provide inline guardrails (confirmation, messaging, version visibility) so edits remain traceable and reversible
- keep legally sensitive sections (consent, eligibility, uploaded documents) read-only even in edit mode

## Goals
- add explicit edit enablement flow, including confirmation copy that reinforces legal-record considerations and explains how to revert using version history
- switch approved sections of the read-only widget UI into editable controls backed by the latest row in `iset_intake.iset_application`
- persist edits by writing a new versioned record in `iset_intake.iset_application`, promoting it as the current version
- surface a modal-based version history browser with restore capability that keeps the main widget surface focused on the form
- remove the legacy "Case summary & notes" section from this widget (it will live in a dedicated widget)

## Non-Goals
- altering immutable data held in `iset_intake.iset_application_submission`
- changing the underlying Cloudscape layout or section ordering beyond what is necessary to toggle editability
- introducing editing for the consent, eligibility, or supporting document sections

## Data Model Touchpoints
- `iset_intake.iset_application_submission`
  - `intake_payload`: immutable snapshot of applicant-submitted data (read-only reference)
  - `schema_snapshot`: JSON structure describing field metadata, options, and localization; used to shape editable controls
- `iset_intake.iset_application`
  - stores mutable admin-managed representation of the application
  - `version`: monotonically increasing identifier per `application_id`
  - saving edits creates a new row; prior rows remain available for history/restoration
- `iset_case`
  - related case management information (read-only context for this feature)

## Editing Workflow
1. **Initial state**
   - widget renders in read-only mode using existing section layout and presentational helpers
   - Cloudscape BoardItem actions display an `Edit` button and a `View versions` button
   - the "Case summary & notes" section is no longer rendered
2. **Edit confirmation**
   - clicking `Edit` opens a Cloudscape confirmation modal or callout panel
   - message highlights legal-record requirements and directs the reviewer to the version history modal for viewing/restoring older versions
   - confirmation enables edit mode; cancellation keeps the widget read-only
3. **Editable state**
   - editable sections rehydrate into form controls using values from the latest `iset_intake.iset_application` record
   - non-editable sections (consent & declarations, eligibility screening, supporting documents) remain read-only with their existing presentational rendering
   - field controls and options derive from `schema_snapshot` where needed (e.g., select lists, radio/checkbox labels)
   - board-level `Save` and `Cancel` buttons appear; disabled when there are no dirty fields or a save is in-flight
4. **Financial tables**
   - income and expense tables keep their existing rows and layout
   - only the amount column becomes editable via inline input controls; category/source cells remain static
5. **Cancel edits**
   - reverts editable fields to the persisted latest version and returns to read-only mode
6. **Save edits**
   - performs client-side validation (matching intake constraints where possible)
   - PATCH/POST request updates the application payload and records a new version row in `iset_intake.iset_application`
   - on success: show toast/flash, update local state with returned version payload, revert UI to read-only mode

## Editable Coverage
- Sections treated as editable: identity, contact information, emergency contact, demographics & supports, education & employment, barriers & support requests, income & expenses (amounts only), narrative fields, and other applicant-supplied data
- Sections always read-only: consent & declarations, eligibility screening, supporting documents

## UI Components
- **BoardItem header actions**
  - `Edit` button (read-only mode)
  - `View versions` button (always available except during save)
  - `Save` & `Cancel` buttons (edit mode), using standard Cloudscape BoardItem action area
- **Confirmation dialog**
  - appears prior to entering edit mode
  - copy includes: "Editing creates a new version", "Original submission remains available", instructions for accessing the version history modal
- **Form controls**
  - reuse existing section rendering but swap static text components with matching Cloudscape inputs (Input, Select, RadioGroup, Textarea, DatePicker, etc.) within editable sections
  - leverage `schema_snapshot` metadata for option lists and control hints
- **Inline financial editing**
  - render amount cells with inline editable controls (e.g., `Input` or `FormField` + `Input`), maintaining table layout and totals logic
- **Flashbar feedback**
  - success: "Application updates saved; version X is now current"
  - error: display API/validation messages

## API & Persistence Considerations
- continue using the existing endpoints that update `iset_intake.iset_application` (`PATCH /api/applications/:id/answers`, `POST /api/applications/:id/versions`, restore endpoints)
- require optimistic locking via version number or updated timestamp to prevent overwriting concurrent edits (to be validated with backend team)
- API should log auditing metadata (editor user id, timestamps) for version history display

## Version History Modal
- launch from the `View versions` button
- modal contents:
  - table/list of versions including version number, saved timestamp, editor, optional change summary (if available)
  - buttons: `View details` (loads chosen version into a preview drawer) and `Restore`
- restoring a version should
  - hydrate form state with the selected version's payload
  - create a new version upon save instead of mutating historical rows
  - note within modal that restoring requires saving to finalize

## Validation & Error Handling
- replicate original intake validation rules where feasible (required fields, option membership)
- highlight field-level errors inline; ensure `Save` enters a loading state while awaiting server response
- handle API failures with actionable messaging and keep the form in editable state for correction

## Layout Preservation
- maintain current section ordering, expandable section usage, and responsive column layout in both read-only and edit modes
- editing controls should respect existing `KeyValuePairs`/`ColumnLayout` structures to avoid layout shift

## Future Considerations
- implement the dedicated "Case Notes" widget that absorbs the former case summary functionality
- introduce diff view in version history modal for quicker comparison between versions
- explore read-only audit log linking edits to specific reviewers and case actions
