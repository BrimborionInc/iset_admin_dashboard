# Codex Crib Sheet - ISET Platform

## Mission Snapshot
- **Goal**: Give sys admins curated tooling to compose WCAG-compliant intake workflows, publish them, and work submitted applications through the admin console.
- **Repos**: `admin-dashboard` (authoring UI + admin server) and `ISET-intake` (public portal + intake server). Admin publish upserts the runtime payload into `iset_runtime_config` (`scope='publish'`, `k='workflow.schema.intake'`).

## Admin Dashboard Highlights
- **Navigation**: `SideNavigation.js` gates sections by role; keep it aligned with actual routes.
- **Case Workspace**: `applicationCaseDashboard.js` board now renders:
  - `ApplicationOverviewWidget` (4-column span, 4 internal columns) for reference #, contact, assignment, status badge.
  - `IsetApplicationFormWidget` – bespoke layout matching the current ISET intake schema (consent, eligibility badges, identity/contact, demographics, education/employment, financials, file uploads, case notes).
  - `CoordinatorAssessmentWidget` – structured assessor form; `SupportingDocumentsWidget` – applicant docs.
  Widgets default to 2-column × 5-row footprints (overview spans 4) but remain resizable.
- **ISET Application Form widget** (`src/widgets/IsetApplicationFormWidget.js`):
  - Reads `payload.answers` from the published schema and renders curated sections using Cloudscape `Container` + `KeyValuePairs`. Utilises helper formatters (`formatOption`, `formatOptionList`, `formatCurrency`, `renderDocumentLinks`, etc.).
  - Case summary editor + flashbar notifications remain; direct answer editing removed in favour of read-only review.
- **Application Overviews**: `src/widgets/ApplicationOverviewWidget.js` fetches the application row, presents highlights in four columns, and shows status as a header badge.
- **Authoring Side**: `ManageIntakeSteps` and `ManageWorkflows` still rely on server `component_template` sync (AJV validated). No changes today but remember these are the authoring entry points.

## Public Portal
- `/api/runtime/workflow-schema` is the canonical contract (backed by `iset_runtime_config`). Admin widget now mirrors this specific workflow; any schema change requires code updates. Keep that in mind if a new intake (e.g., passport renewal) appears.
- Portal dynamic runner (`src/pages/DynamicTest.js`) fetches and renders the published schema for applicants.

## Backends & Auth
- Admin backend (`isetadminserver.js`) still serves `/api/cases`, `/api/applications`, `/api/applicants/...` endpoints consumed by the widgets.
- DemoNavigation toggle controls IAM; when IAM off, ensure dev bypass env vars are set to avoid missing-token errors.

## Testing & Next Steps
- Run `npm test -- --watch=false` (admin) after widget changes to satisfy lint/tests.
- If schema evolves, update `IsetApplicationFormWidget` mappings (OPTION_LABELS, sections) accordingly.

## Startup Checklist
1. Review this crib sheet and the latest `docs/project-map.md` updates.
2. Confirm admin board layout matches expectations after any schema or styling tweaks.
3. Keep Application Overview/Case widget sizes in sync when modifying the board.
4. When roles or navigation change, update both `SideNavigation.js` and `AppRoutes.js`.
5. For new workflows, decide whether to add bespoke widgets or reintroduce dynamic rendering.

Keep this sheet current whenever architecture, schema, or auth flows evolve so we can ramp quickly each session.
