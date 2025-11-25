# Workflow Studio (Intake Authoring)
**Purpose:** How the admin console builds and edits intake workflows (step library, canvas, props, preview, runtime schema).  
**Audience:** Engineers extending workflow authoring or adding component props.  
**Last Updated:** 2025-11-25

## High-level flow
- **Manage Workflows page** (`src/pages/manageWorkflows.js`): Cloudscape board with four widgets:
  - **Workflow Library** (`WorkflowListWidget`): lists `/api/workflows`, links to modify, delete.
  - **Workflow Properties** (`WorkflowPropertiesWidget`): editable workflow metadata (name/status/start step) for the selected workflow.
  - **Workflow Preview** (`WorkflowPreviewWidget`): runs portal-style renderer for a workflow with DAG graph + interactive runner.
  - **Runtime Schema** (`WorkflowRuntimeSchemaWidget`): shows JSON schema for the selected workflow.
- **Editor (modify workflow)** (`src/pages/modifyWorkflow.js`):
  - Widgets: `IntakeStepLibraryWidget` (fetches `/api/steps`), `WorkflowCanvasWidget` (drag/drop steps and routing), `StepPropertiesWidget` (per-step props), `WorkflowPropertiesEditorWidget` (name/status/start).
  - Canvas state persists to `sessionStorage` key `mw:steps-v1` to survive reloads while editing. Query `?id=` loads existing workflow via `/api/workflows/:id`.
  - Saving posts assembled payload to `/api/workflows` (new) or `/api/workflows/:id` (update); routing normalized via `workflowEditorUtils`.

## Component templates & props
- Source of truth lives in `src/component-lib/*.template.json` plus JSON schemas in `src/component-lib/schemas/*.schema.json`.
- `isetadminserver.js` syncs templates from disk into DB on startup (`component_templates`), and the editor surfaces `prop_schema` entries in `StepPropertiesWidget` forms.
- Adding a prop (e.g., `documentLabel` on `file-upload`) requires:
  1) Update template + schema files.
  2) Restart or call the dev sync endpoint to push into DB.
  3) Ensure `StepPropertiesWidget` form renders it (auto if driven by `prop_schema`, otherwise add explicit form control).
  4) Ensure portal renderer honors the prop (in `ISET-intake/src/renderer/renderers.js`).

## Data & publishing
- **Step library** is sourced from `/api/steps`; each step references a component template and stores props.
- **Workflow save payload**: includes steps (with props), routes (linear or by_option), and workflow metadata (name/status/start step).
- **Preview** uses the same renderers as the portal, respecting conditional visibility and file upload rules; nothing persists during preview.
- **Runtime schema widget** shows the server-generated schema for the selected workflow for sanity checks.

## Persistence & storage keys
- Board layout on Manage Workflows: `manageWorkflows.board.items.v1` (localStorage).
- Canvas draft: `mw:steps-v1` (sessionStorage).
- Template sync: on server start; dev endpoints `/api/dev/sync/<template>-template` exist for manual refresh.

## When adding new fields (example: document label)
- Add prop to template + schema (`src/component-lib/file-upload.template.json`, `schemas/file-upload.schema.json`).
- Verify editor form surfaces it (auto via `prop_schema`; otherwise extend `StepPropertiesWidget`).
- Update portal renderer to send prop through presign/finalize and persist into `iset_document` (label/metadata).
- Update docs and `docs/meta/project-map.md` if new areas change.

## Notes / gaps
- No dedicated guide existed; keep this file current when studio behavior changes.
- Conditional visibility enhancements and schema publishing rules should be documented here when extended.
