# Workflow Studio (Intake Authoring)
**Purpose:** How the admin console builds and edits intake workflows (step library, canvas, props, preview, runtime schema).  
**Audience:** Engineers extending workflow authoring or adding component props.  
**Last Updated:** 2026-06-10

## High-level flow
- **Manage Intake Steps page** (`src/pages/manageIntakeSteps.js`, route `/manage-components`): Cloudscape board with three widgets:
  - **Intake Step Library** (`IntakeStepTableWidget`): lists `/api/steps`, supports filter, row selection, sortable/resizable columns, create/modify/delete, and preview selection.
  - **Preview** (`PreviewIntakeStep`): loads `/api/steps/:id`, posts the normalized component payload to `/api/preview/step`, and renders the returned portal-style HTML in an iframe that flex-fills the board item without overflowing it.
  - **Step JSON** (`PreviewStepJSON`): shows the selected step payload for inspection and copy.
  - Board controls follow the standard route-header `Add widget` / `Reset layout` pattern through the shared split-panel palette. Reset restores all three widgets and closes the palette if nothing remains available.
- **Manage Workflows page** (`src/pages/manageWorkflows.js`): Cloudscape board with four widgets:
  - **Workflow Library** (`WorkflowListWidget`): lists `/api/workflows`, links to modify, delete.
  - **Workflow Properties** (`WorkflowPropertiesWidget`): editable workflow metadata (name/status/start step) for the selected workflow.
  - **Workflow Preview** (`WorkflowPreviewWidget`): runs portal-style renderer for a workflow with a pannable/zoomable DAG graph, minimap, layout switcher, and interactive runner.
  - **Runtime Schema** (`WorkflowRuntimeSchemaWidget`): shows JSON schema for the selected workflow.
- **Modify Intake Step editor** (`src/pages/modifyIntakeStep.js`, route `/modify-component/:id`):
  - Three-column authoring workspace: searchable component library, server-rendered GOV.UK working area with drag/reorder/delete/inline label editing, and the properties/translation/validation/conditional-visibility side panel.
  - The inner editor header shows the current step name while the route header remains `Modify Intake Step`; Save starts disabled after a clean load and only enables for real edits.
  - Loading keeps repeated content-only components that do not have `props.name`/`props.id`; dedupe applies only to components with an actual authored data key/id.
  - Template metadata enrichment is editor-only and must not mark a freshly loaded step dirty. Ordinary PUT saves omit `ui_meta`, and the backend preserves existing `step.ui_meta` unless the request explicitly sends a replacement.
  - Save alerts surface precise backend validation errors such as duplicate Data Keys or invalid file-upload settings instead of collapsing them to a generic failure.
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
- **Preview** uses the same renderers as the portal and now mirrors runtime conditional-visibility operators plus whole-step skipping for steps whose authored components all hide.
- **Workflow Preview graph**: the graph tab uses React Flow with ELK layout, custom fixed-size workflow-step nodes, summarized conditional edge labels, fit-view controls, a minimap, and vertical/horizontal layout options from the widget settings menu. The graph viewport flex-fills the Cloudscape board item content area so board resizing changes the available pan/zoom surface. Custom nodes must keep invisible React Flow handles so edges can resolve correctly.
- **File-upload preview rule**: the real applicant runtime now uses one `Upload` button that conditionally opens `Take photo` plus `Choose file` on likely mobile camera-capable devices; admin previews show a static explanation of that chooser instead of trying to invoke camera/file pickers from the editor surface.
- **Runtime schema widget** shows the server-generated schema for the selected workflow for sanity checks.
- **DEV publish parity**: verified on 2026-04-14 that workflow `21` authoring rows rebuild the same `iset_runtime_config(scope='publish', k='workflow.schema.intake')` payload through `buildWorkflowSchema` / `scripts/publish-workflow.js` once timestamp/checksum fields are ignored, so the step library, workflow library, and published runtime row are back in sync for that intake.

## Access Guardrails
- Workflow/component authoring endpoints are step-editor-only. This includes component template list/update/fix/version/prune, component render/audit endpoints, workflow detail/mutation/preview/validate, and the `/modify-component/:id` frontend route.
- `GET /api/workflows` remains broadly available because casework widgets use it to select workflow attachments, but workflow detail and mutations require step-editor access.
- Legacy blockstep and raw Nunjucks generator/render endpoints are old debug surfaces. Keep them behind unsafe-admin-debug enablement plus System Administrator access; do not use them as normal authoring APIs.

## Persistence & storage keys
- Board layout on Manage Intake Steps / Manage Components: `manage-components-board-layout-v2` (localStorage).
- Board layout on Manage Workflows: `manageWorkflows.board.items.v1` (localStorage).
- Canvas draft: `mw:steps-v1` (sessionStorage).
- Template sync: on server start; dev endpoints `/api/dev/sync/<template>-template` exist for manual refresh.

## Browser smokes
- Manage Intake Steps has a local Puppeteer smoke: `npm run smoke:manage-components:browser`.
  - The smoke loads `/manage-components` with deterministic API stubs, seeds a one-widget saved layout, verifies the route-header Add widget/Reset layout controls, confirms the palette exposes missing widgets, resets to the full board, checks the Intake Step Library sortable/resizable table, selects a step, verifies the preview endpoint and iframe sizing, captures `tmp/manage-components-smoke/manage-components-dashboard.png`, and fails if `/api/steps` keeps refiring after idle.
- Modify Intake Step has a local Puppeteer smoke: `npm run smoke:modify-component:browser`.
  - The smoke loads `/modify-component/132` with deterministic step/template/render stubs, verifies the route/header/editor regions, checks the component-library search, confirms repeated static text blocks survive load, verifies initial Save is disabled, selects a working-area component, adds a Text Input, asserts the added component renders before saving, checks precise backend save-error surfacing, confirms a later successful save payload omits editor-only fields and `ui_meta`, runs Validate, captures `tmp/modify-component-smoke/modify-component-132-editor.png`, and fails if API calls keep refiring after initial render or component selection.

## When adding new fields (example: document label)
- Add prop to template + schema (`src/component-lib/file-upload.template.json`, `schemas/file-upload.schema.json`).
- Verify editor form surfaces it (auto via `prop_schema`; otherwise extend `StepPropertiesWidget`).
- Update portal renderer to send prop through presign/finalize and persist into `iset_document` (label/metadata).
- Update docs and `docs/meta/project-map.md` if new areas change.

## Notes / gaps
- No dedicated guide existed; keep this file current when studio behavior changes.
- Conditional visibility enhancements and schema publishing rules should be documented here when extended.
- The step editor condition builder now supports the runtime checkbox-array operators (`contains`, `notContains`, `containsAny`, `notContainsAny`, `containsAll`) on the currently supported target component types, `WorkflowPreviewWidget` now mirrors the same whole-step skip behavior as the portal runtime, and Manual Intake now uses the same operator set for renderable manual-intake steps.
- Manual Intake still intentionally skips portal-only upload/signature steps, so treat parity there as limited to steps the admin path can actually render.
