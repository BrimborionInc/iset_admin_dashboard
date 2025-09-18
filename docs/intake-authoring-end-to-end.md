# Intake Authoring End-to-End

Purpose: Document how intake steps move from component authoring in the admin dashboard to published digital forms in the public intake portal.
Audience: Workflow authors, product owners, and developers supporting authoring tooling.
Last Updated: 2025-09-16

## Authoring Pipeline At A Glance
1. Start a step draft from the intake Step Library or create a new step from scratch.
2. Assemble components in the Step Builder workspace, configuring names, storage keys, layout classes, and behavioural props.
3. Localise labels, hints, help text, and messages in English and French.
4. Attach validation (required flags, rule sets, custom predicate logic) and confirm inline preview behaviour.
5. Save the step, then use Preview to exercise conditional reveals, validation, and translations.
6. Organise steps inside a workflow, define branching and publication status, and run the workflow-level preview.
7. Publish the workflow, which normalises the schema and writes `intakeFormSchema.json` (+ meta) to the intake portal repo.
8. Verify the published schema inside the portal (Dynamic Runner) and release through usual deployment channels.

## Step Builder Workspace
- **Library (left rail)**: Curated component catalogue (input, textarea, radio, checkbox, panel, inset text, summary list, file upload, signature acknowledgement, etc.). Click to append or drag into position.
- **Working Area (centre)**: Live GOV.UK-rendered canvas with inline text editing. Drag the handle to reorder; clicking a card selects it for property editing.
- **Properties & Validation panel (right)**: Structured editors for component props, translations, storage wiring, conditional logic, and validation rules. Tabs collapse/expand to keep context focused.
- **Toolbar (top)**: Undo/redo, Save, Save as Copy, Delete Step, and breadcrumbs back to the workflow overview.

## Component Configuration
Every component shares a baseline contract: `type`, `props`, and (optionally) `validation`. Key areas to review when configuring:
- **Identity & Storage**: `name`, `storageKey`, and any integration identifiers must stay unique within the step. Storage defaults to `name` when blank.
- **Content**: Labels, legends, hints, prefixes/suffixes, option text, summary rows, footers. Inline edits sync with structured fields.
- **Layout & Styling**: GOV.UK classes (`govuk-input--width-10`, `govuk-fieldset__legend--m`, custom form-group classes) controlled via pickers with manual override.
- **Behaviour**: Component-specific props (radio option source mode, default values, input types, character count thresholds, dynamic data endpoints, conditional reveal linkage via `conditionalChildId`).
- **Accessibility**: Visually hidden labels, ARIA descriptions, autocomplete tokens, spellcheck toggles.

Refer to the component pattern docs in this directory (`component-*.md`) for deeper guidance on each type.

## Translations & Localisation
- All user-facing copy supports bilingual authoring. Structured text fields display an EN/FR toggle; inline edits prompt for both languages when saved.
- Translation completeness is tracked per component and surfaced as a badge in the component list and workflow summary.
- Required validation messages, inline hints, panel content, inset notices, and file upload instructions must include both languages before publication.
- For dynamic data sources, provide bilingual labels in the endpoint payload or define a translation map in the component props.

## Validation Model
- **Required Toggle**: Enables baseline presence checks. Radio buttons evaluate both on change and submit; other components currently enforce on submit.
- **Rule Builder**: Uses the unified schema (`type`, `trigger`, `severity`, `message`, plus type-specific settings). Available rule types: `predicate`, `atLeastOne`, `range`, `length`, `pattern`, `compare`.
- **Predicate Rules**: Accept json-logic that returns `true` when invalid (`{ "!": { "var": "field-name" } }`, etc.). Use sparingly in favour of dedicated rule types for clarity.
- **Blocking vs Advisory**: `severity="error"` + `block=true` stops forward navigation. Warnings surface in the UI (non-blocking) and should guide rather than prevent.
- **Rule Ordering**: Arrange from simplest to most complex. Only the first blocking error per component shows at runtime; warnings may stack.

## Saving, Copying, and Previewing Steps
- `Save` persists the current step draft; the status banner confirms success and clears the dirty state.
- `Save as Copy` duplicates the step (new identifier) while keeping the original intact, useful for variants of similar layouts.
- `Preview` opens the `WorkflowPreviewWidget` for the current step, rendering with the same normalization logic as the public portal. Use it to:
  - Exercise conditional option reveals and file-upload visibility.
  - Inspect bilingual rendering (language toggle in the preview).
  - Trigger validation rules via change/submit to confirm behaviour.
  - Download the raw schema payload for QA or pair reviews.

## Building Workflows from Steps
- The workflow overview lists steps with status (Active/Inactive), last modified timestamp, translation completeness, and validation summary.
- Drag to reorder steps; set `defaultNextStepId` or branching conditions (`json-logic` expressions) to control progression.
- Workflow-level metadata includes title/description, category tags, portal visibility flag, and analytics id.
- Use the workflow preview to navigate the journey end-to-end, ensuring branching, state persistence, and summary pages behave as expected.
- Inactive steps remain saved but are excluded from preview and publication until reactivated.

## Publishing to the Public Intake Portal
1. Select `Publish` from the workflow actions menu.
2. The server invokes `buildWorkflowSchema` (`src/workflows/normalizeWorkflow.js`), which:
   - Normalizes step order, component ids, storage keys, branching, and conditional reveals.
   - Embeds conditional child components under their parent options (radios/checkboxes) and removes duplicates.
   - Validates component templates against AJV schemas where provided.
   - Produces `{ steps, meta }`, including translation and validation completeness metrics.
3. The publish endpoint writes:
   - `X:\ISET\ISET-intake\src\intakeFormSchema.json`
   - `X:\ISET\ISET-intake\src\intakeFormSchema.meta.json`
4. A publish summary appears with file paths and commit hints for developers.
5. Republish whenever step or workflow changes are ready for QA/UAT; the portal repo should be committed separately.

## Testing
- Run `npm test -- --watch=false` (Jest via `react-scripts`) after any authoring UI change. This exercises smoke suites in `src/**/*.test.js` and must stay green before publish.
- When signature-related components change, exercise the interactive preview (drag a signature step into a test workflow) and confirm `WorkflowPreviewWidget` transitions through unsigned -> signed -> cleared states.
- For workflow normalization or publish-pipeline updates, run the portal smoke suite (documented in `ISET-intake/docs/features/intake-form.md`).
## Portal Consumption & QA
- The public portal dynamic runner (`ISET-intake/src/pages/DynamicTest.js`) imports `intakeFormSchema.json` at build time. Branching, validation, conditional reveals, and storage key mapping mirror admin previews.
- The meta file feeds smoke tests (`utils/validatePublishedSchema.js`, `__tests__/schemaValidation.test.js`) and dashboard statistics.
- Use the portal `SchemaPreview` route or Jest tests to confirm published changes before deployment.
- Portal translations are driven entirely by the authored schema; missing translations surface as `key` fallbacks or empty text, so ensure authoring QA covers both languages.

## Authoring Checklist Before Publishing
- [ ] All component labels, hints, help text, and validation messages localised (EN/FR).
- [ ] Validation rules cover required business constraints and fire in preview.
- [ ] Conditional reveals verified for both admin preview and portal runtime.
- [ ] Workflow branching paths exercised (happy paths + edge cases).
- [ ] File upload rules tested for hidden states and document messaging.
- [ ] Publish output pushed to the intake repo with accompanying meta updates and smoke tests run.

## Related References
- Component pattern specs: `component-*.md`
- Normalization design: `workflow-normalization.md`
- Conditional embedding RCA: `workflow-publication-conditional-components.md`
- Intake portal runtime map: `../ISET-intake/docs/project-map.md`
