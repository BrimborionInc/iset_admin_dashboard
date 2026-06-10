# ISET Application Form widget

## Workflow

Application Assessment

## Source

- src/widgets/IsetApplicationFormWidget.js

## Primary Route Context

- /application-case/:id

## Purpose

Displays intake submission data with controlled edit/version behavior.

## User Actions (observed)

- Open and inspect widget state for current case/submission/packet context.
- Use widget controls to progress work for the owning workflow.
- Navigate to linked records or execute relevant operational actions.

## Inputs / Dependencies

- Route context identifiers (case id, participant id, or selected packet).
- Back-end API payloads and runtime configuration for this feature area.
- Role/permission checks enforced by route guards and server APIs.

## Outputs / Side Effects

- Persists workflow data and emits status transitions relevant to the workflow.
- Updates dependent widgets through shared context/event updates.
- Contributes auditability via timeline/history/notes where applicable.

## Current Notes

- Keep this document aligned whenever this widget is refactored, renamed, moved, or given new actions.
- Add endpoint-level detail and UAT script rows in the next documentation pass.
- The widget is primarily a read/edit rendering of the submitted application payload, not an operational data grid. Its embedded tables are used for fixed-format application answers and should not be treated like sortable queue tables unless the authored intake component semantics call for it.
- Community/band fields use search-style inputs, and editable financial-style fields use constrained currency inputs where rendered by the application form component.
