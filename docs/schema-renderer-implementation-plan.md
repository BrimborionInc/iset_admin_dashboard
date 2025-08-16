# Implementation Plan — Publish Semantic Workflow JSON; Render in Portal with React GOV.UK

Last updated: 2025-08-16
Owner: Admin Dashboard / Public Portal teams

## Current status (2025-08-16)
## Current status

* M0 renderers built in portal, with Schema Preview and tests.
* Conditional reveals, Summary List (+formatters), File Upload wired to backend.
* Admin publish writes portal schema; Dynamic Test route renders published schema via shared renderers and is auth-guarded.
* Dynamic Test now merges values into aggregate intake JSON; Finish preview shows entered data (not just history).
* GOV.UK error summary/focus added to Dynamic Test for parity with Schema Preview.
* M6 implemented: Admin publish now validates component types against the portal's supported set and blocks unsupported types with a 400 error detailing the offending step/component.
* M7 advanced: Expanded parity checks (labels/ids/fieldset, form-group presence, option/part counts). CI gate wired via `npm run audit:parity` (non‑zero on issues). Portal tests assert GOV.UK structure.
* M8 done: Feature-flagged routing switch; `/apply` and `/start-application` use the schema flow when `USE_SCHEMA_RENDERER` is true (dev/test routes remain unchanged).
* M9 done: Publish pipeline audits used templates and writes meta with `schemaVersion` and template catalog (key/version/type/count); blocks on broken templates.

### What’s implemented (mapping to milestones)
- M0 Baseline/Schema guardrails: JSON Schema of record (`src/GeneralIntakeControlSchema.json`) and Ajv test validating published schema (`src/__tests__/schemaValidation.test.js`).
- M1 Minimal renderer: Registry-based React renderers in portal for input, textarea, select, radios, checkboxes, date, file-upload, content (label/inset/warning/details/accordion), character-count, and summary-list.
- M2 Stateful form + nav: `SchemaPreview` manages values/errors with Next/Previous.
- M3 Branching: json-logic evaluated per step.
- M4 Validation + error UI: Required/minLength/pattern; GOV.UK error summary with anchors and focus; page title prefix on error.
- M6 Unsupported/advanced components strategy: Publish-time validation added; unsupported types are rejected. Discover supported types at `/api/publish/supported-component-types`.
## How to test
- Post-M0 essentials: conditional reveals; summary-list review step; summary formatters.
- Upload integration: `/api/upload-application-file` and `/api/delete-bil` wired from the `file-upload` component; multiple and single file flows supported.

3. Walk the flow; uploads go to `/api/upload-application-file`, remove via `/api/delete-bil`.
4. Finish to view Intake JSON Preview; expect your entered values and the history array.
5. Schema Preview (`/schema-preview`) is a dev harness for quick visual checks.
- `ISET-intake/src/renderer/renderers.js` — GOV.UK-compliant components, conditional reveals, summary-list with formatters, file-upload with upload/remove.
- `ISET-intake/src/GeneralIntakeControlSchema.json` — schema-of-record (enum includes `summary-list`).
- `ISET-intake/src/intakeFormSchema.json` — demo schema with conditional reveal and review step.
- `ISET-intake/src/__tests__/schemaValidation.test.js`, `ISET-intake/src/App.test.js` — tests.

### Key files (server)
- `ISET-intake/server.js` — existing endpoints used by preview:
  - `POST /api/upload-application-file` (auth required; multer + DB insert + case event)
  - `DELETE /api/delete-bil` (remove uploaded file by filePath)

## How to test quickly
1) Ensure the portal (React) and API (Express) are running. The axios base URL defaults to `http://localhost:5000` in development.
2) Open the Schema Preview page in the portal; walk through steps:
   - Validation: leave required fields empty to trigger GOV.UK error summary and anchors.
   - Conditional reveals: choose the radio option that reveals a textarea.
   - Review: the “Check your answers” step renders a Summary List with formatted values.
   - File upload: select a PDF/JPG/PNG/BMP/TIFF ≤ 2MB while authenticated; see upload status and a Remove link that deletes the file server-side.

## Next steps
- Enhance upload UX: show file sizes/types; optional download link if a secure download route is exposed.
- Expand formatters (e.g., array labeling, custom mappers), and add unit tests for formatters.
- Focus first invalid control automatically (beyond summary), while keeping GOV.UK guidance.
- Add a small README in portal documenting the schema contract and supported types (M10 doc item).
- Done: unsupported types policy = block at publish with clear error. Consider adding a fallback later only for legacy content if needed.

## Working agreement (constraints)
- Admin authoring/preview may use Nunjucks (server-side) for fidelity.
- Published artifact to portal is semantic JSON (no HTML), versioned.
- Portal renders using React components styled with GOV.UK classes/JS (no Nunjucks at runtime).
- Prefer incremental delivery with tests; add types one by one. Block or fallback for unsupported.
- Admin endpoint today: `/api/workflows/:id/publish` writes `../ISET-intake/src/intakeFormSchema.json`.

## Milestone 0 — Baseline and guardrails
- Add schemaVersion to published JSON (e.g., "1.0").
- Create a JSON Schema (portal) describing: steps, components, types, labels {en, fr}, hints, required, options, normalize, routing (linear/by_option), defaults.
- Tests
  - Validate real published files against the JSON Schema.
  - Smoke parse test in portal (load sample and assert structure).
- Acceptance: portal can parse schema; CI fails on invalid schema.

## Milestone 1 — Minimal renderer (read-only UI)
- Create renderer registry (type → React component) in portal (e.g., `src/renderer/registry.ts`).
- Implement initial types (no validation yet): input, textarea, radios, checkboxes, select, date-input, button.
- Render a single step from schema. Run `GOVUKFrontend.initAll()` post-mount.
- Tests: unit tests per renderer (labels, hints, classes); basic accessibility checks.
- Acceptance: first step renders correctly for supported types.

## Milestone 2 — Stateful form + navigation
- Add form state (values, touched, errors) in a StepView component.
- Implement Next/Back using order from schema; support `nextStepId` when present.
- Tests: navigation unit tests; controlled input read/write tests.
- Acceptance: user can complete linear steps.

## Milestone 3 — Branching logic
- Evaluate branching rules from schema (json-logic or equivalent).
- Honor `defaultNextStepId`.
- Tests: 2–3 branching scenarios; edge cases (unknown field, default fallback).
- Acceptance: branching routes reliably.

## Milestone 4 — Validation and error display
- Map schema flags to validators: required, normalize (trim, number, date-iso).
- Render GOV.UK error patterns (messages, aria, classes) in React.
- Tests: validation unit tests; error rendering snapshots.
- Acceptance: invalid fields block navigation with correct error UI.

## Milestone 5 — i18n
- Ensure schema holds bilingual content (labels/hints).
- Add language context; runtime toggle without re-publish.
- Tests: language toggle updates DOM; fallback when missing translation.
- Acceptance: step renders in EN/FR.

## Milestone 6 — Unsupported/advanced components strategy
- Strategy: Block publish when any step includes an unsupported component type.
- API: `GET /api/publish/supported-component-types` lists the allowed types (kept in sync with portal registry).
- Behavior: `POST /api/workflows/:id/publish` returns 400 with details `{ step, step_id, position, template_key, type }` on first unsupported component.
- Tests: attempt to publish a workflow containing an unsupported `type` in one component template → expect 400; publish a workflow with only supported types → expect 200 and files written.
- Acceptance: No silent fallback; authors get actionable errors before publish.

## Milestone 7 — Parity checks vs Nunjucks
- Admin endpoints:
  - `/api/audit/parity-sample` — render one template and report structural issues.
  - `/api/audit/parity-all` — summarize across active templates; injects minimal props for structure checks.
  - `/api/audit/parity-portal` — compare NJK structure against a derived portal shape.
- Portal tests: `src/__tests__/govukStructure.test.js` verifies key GOV.UK classes per renderer.
- Script: `npm run audit:parity` to gate CI (non-zero exit on parity issues).
- Acceptance: expand coverage to key components and enforce gate before roll-out.

## Milestone 8 — Feature flag and rollout
- Portal flag: `USE_SCHEMA_RENDERER` (default true) created in `src/config.js`, consumed by `App.js`.
- Canary in lower envs; monitor.
- Tests: E2E smoke with flag on/off.
- Acceptance: safe switch, easy rollback.

## Milestone 9 — Admin publish pipeline polish
- Publish payload includes: `schemaVersion`, timestamp, component template versions used, optional per-component support status.
- Integrate `/api/audit/component-templates` into publish to guard broken templates.
- Tests: publish output validates against schema and passes audit.
- Acceptance: artifacts are validated, versioned, and traceable.

## Milestone 10 — Docs and samples
- README in portal: schema contract, supported types, how to add a renderer.
- Example fixtures: minimal step, radios with branching, date input, file upload (later).
- Tests: fixtures validated in CI.
- Acceptance: team can extend safely.

## Deliverable cadence
- Week 1: M0–M1
- Week 2: M2–M3
- Week 3: M4 + basic i18n
- Week 4: M5–M7
- Week 5: M8–M10, cutover

## Open questions to confirm along the way
- Exact component type list for v1 support.
- Error message copy and localization source.
- Storage of in-progress answers (session/localStorage/DB) in portal.
- Accessibility acceptance criteria per component.

## Notes
- Keep admin preview (Nunjucks) as the fidelity oracle; power parity tests with it.
- Expand supported types only as needed; maintain a registry and coverage matrix.
