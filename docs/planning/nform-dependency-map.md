# nForm v1 Dependency and Coupling Map

Purpose: Map the current PATH implementation onto the agreed nForm v1 boundary before any standalone repository is created or code is copied.
Audience: Engineering and product owners extracting nForm from PATH.
Last Updated: 2026-07-23
Status: Active initial audit. Verified from the WSL admin, public portal, shared runtime, schema/migrations, and package configuration. File-level classification still needs completion before the copy manifest.

## Executive Finding

nForm cannot be produced safely by copying the current repositories and deleting visibly PATH-specific pages. The reusable authoring system exists, but its persistence, authorization, publication, public runtime, draft handling, upload lifecycle, and submission completion are embedded in PATH/ISET code and schema.

The extraction unit must therefore be a new monorepo assembled by subsystem:

1. Extract and rename the reusable authoring/runtime primitives.
2. Replace ISET persistence and authorization contracts with a minimal nForm schema.
3. Rewrite completion around a neutral submission envelope.
4. Add anonymous/public-session support alongside authenticated external users.
5. Validate the resulting empty platform before importing any downstream solution.

No bulk copy or prune operation is authorized by this map.

## Agreed Core Boundary

nForm core includes:

- A staff portal and public portal.
- Internal-operator and external-user authentication/lifecycle infrastructure.
- `System Administrator` as the only built-in role; solution-defined business roles and permissions.
- Codeless intake-wizard step/component authoring, branching, validation, preview, versioning, publication, and rollback.
- Anonymous or authenticated access configured per public workflow.
- Ephemeral progress and optional authenticated save/resume.
- Neutral submissions, attachments, submission provenance, staff-side submission search/view/export/audit/retention, and integration events.
- Generic notifications, audit/events, storage, configuration, dashboard/workspace composition, API infrastructure, schema migration, testing, and AWS deployment foundations.

nForm core excludes:

- Clients, cases, applications, appointments, bookings, registrations, payments, assessments, interventions, action plans, or other business entities.
- Generic post-submission cases, staff review stages, tasks, assignments, business statuses, or work queues.
- PATH/ISET/NWAC roles, terminology, workflow content, reports, integrations, documents, and operating rules.

## Current Runtime Chain

```text
Staff authoring UI
  -> admin /api/steps, /api/component-templates, /api/workflows
  -> iset_intake.step/component_template/workflow tables
  -> src/workflows/normalizeWorkflow.js
  -> iset_runtime_config publish/workflow.schema.intake
  -> public /api/runtime/workflow-schema
  -> DynamicTest.js + renderer/renderers.js
  -> authenticated, server-held intake state and optional draft
  -> /api/intake/complete
  -> iset_application_submission + client + case + application + PATH events/documents
```

The reusable chain ends immediately before the current completion transaction creates PATH domain records. The present code does not expose that boundary cleanly.

## Subsystem Map

### 1. Staff Portal Shell and Authentication

Current anchors:

- `src/context/AuthContext.js`
- `src/auth/apiClient.js`
- `src/middleware/authn.js`
- `src/middleware/authz.js`
- `src/middleware/requireSystemAdministrator.js`
- `src/pages/manageUsers.js`
- `src/widgets/AccessControlMatrix.jsx`

Classification: `split`.

Keep:

- Cognito-backed staff authentication, session handling, authenticated API client, staff-directory administration primitives, route authorization middleware, and permission evaluation patterns.

Remove/replace:

- PATH role constants and canonicalization.
- Hardcoded NWAC/ISET authorization branches and Cognito group names.
- Region, case assignment, finance, coordinator, Regional Manager, and NWAC Administrator semantics.

Target contract:

- One bootstrap `System Administrator`.
- Solution-defined roles and permissions stored/configured without code branches.

### 2. Codeless Step and Component Authoring

Current anchors:

- `src/pages/manageIntakeSteps.js`
- `src/pages/modifyIntakeStep.js`
- `src/widgets/IntakeStepLibraryWidget.js`
- `src/widgets/IntakeStepTableWidget.js`
- `src/widgets/StepPropertiesWidget.js`
- `src/component-lib/**`
- `src/server/componentRenderRegistry.js`
- `src/portalRendererRegistry.js`
- Admin APIs around `/api/steps`, `/api/step-groups`, `/api/component-templates`, and `/api/render/component` in `isetadminserver.js`

Classification: `split`, with a large reusable core.

Keep:

- Component-template metadata and versioning.
- Approved component library and property schemas.
- Step composition/editor UI.
- Server-side validation and constrained rendering.
- Bilingual/localized value structures as a generic capability.

Remove/replace:

- `iset_intake` database qualification.
- Default step groups for ISET, passport demo, and Nunavut Legal Aid demo.
- PATH roles in `ensureStepEditor`.
- In-repo demo steps, appointment previews, legacy repair/migration endpoints, and one-off template normalization routes.
- Any component properties whose only meaning is an ISET document or case relationship.

Material risk:

- Component definitions are duplicated across database rows, JSON templates, Nunjucks export templates, admin preview registries, and public React renderers. Extraction must establish one versioned component contract and conformance tests across authoring preview and public runtime.

### 3. Workflow/Intake-Journey Authoring

Current anchors:

- `src/pages/manageWorkflows.js`
- `src/pages/modifyWorkflow.js`
- `src/components/ModifyWorkflowEditor.js`
- `src/widgets/WorkflowListWidget.js`
- `src/widgets/WorkflowCanvasWidget.js`
- `src/widgets/WorkflowPropertiesWidget.js`
- Workflow CRUD/preview/validate APIs in `isetadminserver.js`
- `src/workflows/normalizeWorkflow.js`

Classification: `split`, with reusable graph and normalization logic.

Keep:

- Workflow metadata, step membership, start step, linear/conditional routing, graph visualization, validation, preview, and normalized runtime schema generation.

Remove/replace:

- `main-intake`, `consent-no-prefill`, and `consent-cm-prefill` as platform-wide hardcoded workflow types.
- Publish-only-if-`main-intake`.
- `document_type` coupling where it represents PATH generated/signed document workflows.
- PATH role checks and `iset_intake.workflow*` table names.

Target contract:

- An intake definition declares its public authentication mode, draft/save behavior, locale support, component/runtime schema version, and publication governance.
- Downstream solution behavior is an integration hook, not an authored generic case workflow.

### 4. Publication and Versioning

Current anchors:

- `POST /api/workflows/:id/publish` in `isetadminserver.js`
- `scripts/publish-workflow.js`
- `iset_runtime_config(scope='publish', k='workflow.schema.intake')`
- Generated `../ISET-intake/src/intakeFormSchema.json` and metadata file

Classification: `rewrite`.

Reusable:

- Normalization, checksum generation, publisher identity, immutable published payload, validation-before-publish, and public runtime retrieval.

Current blockers:

- Only one global published intake key exists.
- Publication is restricted to PATH `main-intake`.
- Publishing writes into a sibling repository's source tree as well as the database.
- There is no clean first-class immutable publication/version table or rollback model.
- Current authorization permits PATH-specific roles rather than configurable author/reviewer/publisher permissions.

Target contract:

- Store immutable published intake versions in the database.
- Maintain an atomic pointer from each intake definition to its active version.
- Never mutate source files during publication.
- Support direct publish or author/reviewer/publisher separation through permissions/configuration.
- Retain checksum, schema/component versions, actor, timestamp, release notes, validation evidence, and rollback linkage.

### 5. Public Portal Runtime and Rendering

Current anchors:

- `../ISET-intake/src/pages/DynamicTest.js`
- `../ISET-intake/src/hooks/useWorkflowSchema.js`
- `../ISET-intake/src/renderer/renderers.js`
- `../ISET-intake/src/services/intakeWorkflowCompletionValidation.js`
- `GET /api/runtime/workflow-schema`
- `/api/intake-step/:stepId` and `/api/intake-json`

Classification: `split`, with a reusable renderer/runtime surrounded by PATH guards and copy.

Keep:

- Server-driven step navigation.
- Branching and conditional visibility.
- Component rendering and normalization.
- Server-side completion validation against the published definition.
- Privacy rule that avoids retaining cross-step ephemeral answers in browser storage.

Remove/replace:

- Applicant/application terminology and eligibility gates.
- Assumption that all public journeys require `req.user.userId`.
- Single global workflow.
- Hardcoded workflow ID `iset-v1`.
- PATH-specific completion messages, status presentation, and application dashboard.

Required new capability:

- Anonymous public session tokens stored in secure, short-lived HttpOnly cookies and bound to server-side ephemeral state.
- Authenticated external-user journeys continue to use Cognito identity.
- Published intake selection must be route/slug based rather than one global schema.

### 6. Draft and Ephemeral State

Current anchors:

- `input_json_state`
- `iset_application_draft_dynamic`
- Portal `/api/intake-step/**`, `/api/intake-json`, and `/api/draft/**`

Classification: `rewrite around reusable privacy behavior`.

Keep:

- Server-side ephemeral state, TTL/pruning, scoped step hydration, history/cursor management, explicit save-for-later, and no browser aggregate cache.

Replace:

- User-ID-only ownership.
- `iset_application_*` names.
- Hardcoded `iset-v1`.
- PATH events such as `application_started`.

Target schema:

- Ephemeral intake session keyed by a random public session identifier and optionally linked to an external-user identity.
- Durable draft allowed only when the workflow configuration and identity mode permit it.
- Intake-definition and published-version provenance on every state row.

### 7. Neutral Submission Completion

Current anchors:

- `../ISET-intake/src/routes/intakeComplete.js`
- `iset_application_submission`
- Portal `/api/intake/complete`

Classification: `rewrite`; this is the largest domain seam.

Reusable:

- Validate merged payload against the exact published version before writes.
- One transaction for the neutral submission.
- Idempotent completion.
- Reference generation, checksum, locale, source metadata, schema snapshot, history, document references, and timestamps.

Remove:

- Client resolution/creation.
- Case resolution/creation and assignment.
- Application creation and status initialization.
- Watchlist, assessment, auto-assignment, case events, and PATH PDF generation.
- PATH-specific response identifiers.

Target result:

- A neutral immutable submission envelope plus attachment links.
- A durable outbox/integration event emitted after commit.
- Optional solution handler consumes the event or participates through a narrowly defined, idempotent extension contract without changing the core submission meaning.

### 8. Submission Registry

Current state:

- Public users can list/view their own PATH submissions through `/api/submissions` and `/api/submissions/by-reference`.
- Staff submission views are primarily application/case surfaces, not a neutral registry.

Classification: `new core surface`, borrowing generic display/export primitives where useful.

Required:

- Staff list/search/filter by intake definition/version, submission reference, dates, authentication mode, external identity when present, and platform lifecycle.
- Authorized payload/attachment view with field labels resolved from the submitted schema version.
- Export and retention operations with audit.
- No case/application/appointment status columns in the core registry.

### 9. Documents and Storage

Current anchors:

- `../shared/storage/s3Provider.js`
- Portal upload/presign routes and upload policy service.
- `iset_document` and PATH document-type/checklist relationships.

Classification: `split`.

Keep:

- S3 provider, upload policy, MIME/magic-byte checks, size limits, malware-scan integration boundary if present, attachment metadata, presigning, encryption, and audit patterns.

Remove/replace:

- Client/case/application/action-plan/intervention relationships.
- PATH document checklist/type catalogs and signed-form generation.
- Applicant-specific actor labels.

Target:

- Attachment belongs to an intake session, draft, or submission through explicit generic foreign keys; solution documents live in solution schema.

### 10. Notifications and Events

Current anchors:

- `../shared/events/**`
- `../shared/events/notificationDispatcher.js`
- `../shared/events/deliveryQueue.js`
- `../shared/serviceAnnouncement.js`
- Admin notification/template configuration surfaces

Classification: `split`.

Keep:

- Event envelope, durable delivery/outbox, retry/idempotency rules, SES delivery plumbing, template rendering, internal/public audience primitives, and audit.

Remove/replace:

- PATH event catalog and dispatcher branches for applications, cases, assessments, interventions, finance, reminders, watchlists, and ISET documents.
- Applicant/staff/case-specific payload assumptions.

Target:

- Small platform event catalog: identity lifecycle, intake publication, draft lifecycle, submission completed, attachment lifecycle, notification delivery, and system/security events.
- Solution event catalogs and handlers are registered separately.

### 11. Dashboard and Workspace Composition

Current anchors:

- Cloudscape board/dashboard shell and widget layout infrastructure across the admin frontend.
- Most existing widgets and dashboards are PATH solution code.

Classification: `split`.

Keep:

- Layout persistence, widget registry/composition contract, generic table/filter/sort utilities, shell/navigation primitives, access-controlled route registration, appearance/accessibility foundations.

Remove:

- All ISET case/application/finance/ESDC/reporting/home-work-queue widgets and default layouts.

Target empty state:

- System administration, intake authoring, publication history, submissions registry, users/roles, notification configuration, audit/events, and platform health/configuration only.

### 12. Shared Runtime Repository

Current anchors:

- `../shared/**`

Classification: predominantly `drop` or `split`, not wholesale `keep`.

Likely core candidates:

- `storage/s3Provider.js`
- Generic portions of `events/emitter.js`, `events/deliveryQueue.js`, and event service infrastructure
- Generic service-announcement infrastructure

PATH-only:

- `applicantWatchlist.js`
- `attendanceReport.js`
- `financialOverview.js` and its PDF template
- Most current event catalog and notification-dispatch branches

Target:

- Move retained modules into monorepo packages; do not preserve a sibling-repository runtime import.

### 13. Schema and Migrations

Current state:

- Authoring tables use the `iset_intake` schema qualifier.
- Neutral submission data is stored in `iset_application_submission`.
- Draft, document, notification, event, identity, and runtime configuration schemas contain PATH names and foreign keys.
- Migration history is overwhelmingly solution-specific.

Classification: `new clean baseline`.

Do not replay the PATH migration history into a new nForm database.

Create a squashed nForm v1 baseline containing only:

- Internal and external identities/linkage.
- Roles/permissions and staff portal profiles.
- Intake definitions, steps, component templates/versions, routes, published versions, and active-version pointers.
- Anonymous/authenticated intake sessions and optional durable drafts.
- Neutral submissions and attachments.
- Runtime configuration.
- Notification templates/settings/delivery.
- Events/audit/outbox.
- Dashboard/workspace layout configuration.
- Migration ledger and readiness contract.

### 14. Deployment and Repository Layout

Current state:

- Admin, public portal, and shared runtime are separate Git repositories with file-path package/import coupling.
- Portal scripts call admin scripts through sibling paths.
- Deployment tooling is named and structured around PATH/NWAC.
- Admin uses React Router v5/CRA; public portal uses React Router v6/CRACO.
- `apps/web` is not the active admin build entry and should not be mistaken for the production authoring app.

Classification: `rewrite packaging; selectively retain tested deployment mechanics`.

Target:

```text
nform/
  apps/
    staff-portal/
    public-portal/
    api/
  packages/
    intake-schema/
    intake-authoring/
    intake-runtime/
    component-library/
    auth/
    events/
    notifications/
    storage/
    ui/
  db/
    migrations/
    seeds/platform/
  infra/
  scripts/
  docs/
```

The active local target was created at `/home/bill/nForm` on 2026-07-23. This map still controls subsystem extraction; repository creation does not authorize bulk copying.

The two frontend stacks may remain separate applications during v1 extraction. A framework/router migration is not required unless dependency analysis proves it is cheaper than preserving the current stacks.

## Initial Keep / Split / Drop Summary

| Area | Classification | Reason |
|---|---|---|
| Component schemas and constrained component library | Split | Reusable but duplicated and contains solution-specific properties |
| Step/workflow graph editor | Split | Strong reusable core with PATH roles, types, groups, and schema names |
| Workflow normalizer and validator | Split | Core logic, but assumes one ISET schema and current component vocabulary |
| Publish endpoint/script | Rewrite | One global intake, PATH roles/type, sibling source-file mutation |
| Public DynamicTest/runtime renderer | Split | Reusable runtime surrounded by authenticated application semantics |
| Draft/ephemeral state | Rewrite | Privacy model is reusable; ownership and schema are PATH-specific |
| Completion transaction | Rewrite | Neutral validation mechanics wrapped around client/case/application creation |
| Submission registry | New | Current staff views are application/case oriented |
| S3 storage provider | Split | Provider is reusable; document relationships are not |
| Events/notifications | Split | Delivery mechanics reusable; catalog/dispatch is PATH-heavy |
| Dashboard shell/layout | Split | Composition primitives reusable; virtually all content is PATH |
| PATH finance/casework/reporting/integrations | Drop | Solution code |
| Existing migration history | Drop from nForm | Build a clean squashed platform baseline |
| AWS deployment mechanics | Split | Retain AWS approach; remove PATH/NWAC naming and cross-repo assumptions |

## Highest-Risk Couplings

1. Completion currently creates submission, client, case, and application in one PATH transaction.
2. All active intake state endpoints currently require an authenticated external user; anonymous workflows need a secure session design.
3. Publication supports only one global `main-intake` and mutates a sibling repository source file.
4. Authoring authorization and step-library defaults hardcode PATH roles and ISET/demo groups.
5. Preview/public rendering contracts are duplicated across Nunjucks, admin registries, JSON templates, and public React renderers.
6. Schema names and migration history encode ISET throughout.
7. Admin backend and portal backend are very large monoliths, so code must be extracted behind tested service/router boundaries before copying.

## Next Audit Work

1. Complete a file-level manifest for the active authoring UI, normalizer, public runtime, auth, storage, events, notifications, dashboard shell, and deployment tooling.
2. Define the clean nForm schema and extension-event contract.
3. Decide package ownership for shared schema/types so authoring preview and public runtime cannot drift.
4. Define the target bootstrap/empty-state acceptance test.
5. Only then create the standalone repository and begin subsystem extraction.
