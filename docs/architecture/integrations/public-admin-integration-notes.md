# Public <> Admin Portal Integration Notes
Last updated: 2025-09-27

## Delivery Status
- Phase 1 "Clean foundation" complete: Vite + React app, Fastify mock API, shared packages, CI, accessibility baseline, thin ports/adapters seam.
- Phase 2 "Auth & runtime contracts" complete: OIDC scaffolding, runtime config adapters, HTTP client abstraction, session heartbeat stub. Tooling (build, lint, typecheck, unit, e2e) is green.
- Phase 3 "Feature spines" complete: intake runner, messaging centre, and dashboard snapshot slices wired through adapters; awaiting data salvage for production wiring.
- Phase 4 "Intake persistence salvage" complete: API now uses MySQL for dynamic drafts and submissions, mirrors legacy auto-ingest and case event hooks, and supports schema-validated env configuration.
- Phase 5 "Messaging persistence salvage" complete: Fastify messaging routes now stream from MySQL messages/message_attachment tables via repositories; unread counts and dashboard badges use live data while in-memory adapters remain for tests.
- Front-end shell salvage underway: legacy GOV.UK header/footer/welcome screens, Welcome copy, and footer navigation now wrap the new routes via @iset/legacy; Cookies, Privacy, and the legacy applicant dashboard are ported verbatim while data wiring still points at the summary endpoint.
- Intake runner now renders inside the GOV.UK container with legacy back-link, progress bar, and form controls for a screen-faithful experience.
- /api/intake/schema now serves the full 21-step legacy workflow; unit tests updated to assert the new metadata payload.
- Static assets: legacy GOV.UK font files copied to Vite public assets to eliminate decode errors and keep typography identical.
- Dev web server now binds to port 3000 (Vite config + env vars) so Cognito redirect/logout URIs remain identical to the legacy portal.
- Logout request flow now mirrors legacy behaviour; HTTP client skips JSON headers when no body is sent so Fastify accepts the sign-out call.
- Hosted logout now sends `logout_uri`, `redirect_uri`, and `response_type=code`; ensure the same URL (http://localhost:3000/) is registered in Cognito allowed logout URIs.
- Auth UX salvage complete: legacy login, register, forgot/reset password, profile completion, and sign-out flows are now served via the legacy providers with exact copy/markup and wired to the Cognito-backed API adapters.
- Local env wired to legacy Cognito dev client IDs; running \
pm run api\ + \
pm run web\ with the new .env.development.local files now exercises real hosted sign-in.

## Deployment Topology
- Public portal and admin console run on separate servers yet share the MySQL schema for submissions, drafts, and messaging tables.
- Uploaded documents will migrate from the legacy filesystem path to an encrypted S3 bucket (KMS enforced, TLS only) shared across portals.
- Runtime config and event triggers are shared through the database; there is still no message bus.

## Workflow Publication Flow
- Admin authors manage workflows in the Step Builder; publishing now normalises the schema and upserts it into `iset_runtime_config` with `scope='publish'` / `k='workflow.schema.intake'`. File writes remain for backward compatibility but are no longer the source of truth.
- Meta data (translation/validation counts, workflow metadata) accompanies the runtime payload so the portal can verify completeness before rendering.
- The public portal reads `/api/runtime/workflow-schema` on demand, eliminating the previous build-time JSON dependency.

## Intake Submission Lifecycle
- Canonical intake path is schema-driven via the published runtime-config payload; Jordan/static experiments stay quarantined in packages/legacy.
- /api/intake/draft now persists to iset_application_draft_dynamic, merging step payloads, history, and workflow version while logging application_saved_draft events.
- /api/intake/submit inserts into iset_application_submission, snapshots schema metadata, auto-creates iset_application / iset_case, deletes the draft row, and records application_submitted in iset_case_event.
- Responses surface reference numbers and timestamps; frontend clears local state and redirects to the dashboard without caching applicant data beyond the visible DOM.

## Messaging and Events
- Applicant threads now resolve from MySQL `messages`/`message_attachment` via a repository seam; opening a thread marks staff replies as read and preserves per-case scoping in the thread id.
- Sending a reply persists to the shared tables, logs `message_sent` into `iset_case_event`, and the in-memory adapter is retained solely for tests or sandbox runs.
- Dashboard unread counts now come from repository summaries; the lightweight userEvents map still seeds the toast feed until admin-driven event ingestion is salvaged.

## File Upload Storage
- Legacy uploads store to X:\ISET\ISET-intake\uploads; S3 adapter (s3Provider.js) is ready but defaults to filesystem.
- Target state keeps UPLOAD_DRIVER=s3 with KMS encryption, presigned PUT/GET, and shared access between portals.
- Upload size and scanning policy remain configurable in the admin console; public portal adapter forwards those limits.

## Runtime Configuration & Environment
- Server env schema now validates database credentials alongside log level/port and enforces deterministic USE_IN_MEMORY_PERSISTENCE toggles.
- When USE_IN_MEMORY_PERSISTENCE=false, the API requires DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME; otherwise it falls back to the in-memory repository used by tests.
- Client env validation (Vite) unchanged; secrets continue to live in process env vars with zod checks at startup.

## Testing and Quality Notes
- Unit suite exercises auth, runtime config, draft persistence (MySQL), submission auto-ingest, messaging flows, and dashboard summary.
- Playwright smoke run covers axe checks, draft save/submit, messaging replies, and dashboard rendering against the new backend.
- CI (
pm run ci) remains the gate: typecheck ? lint ? unit ? e2e ? build ? npm audit ? SBOM generation.

## Outstanding Follow-Ups
- Intake runner UI still needs richer validation messaging, accessibility polish, and failure handling (pps/web/src/features/intake/IntakeRunner.tsx).
- Messaging centre needs loading/empty states, attachment upload UX, and eventual compose-new-thread support once the S3 adapter is ready (pps/web/src/features/messaging/MessagingCenter.tsx).
- Dashboard snapshot points at mock data; connect to real analytics/events when persistence for metrics is ready (pps/web/src/features/dashboard/DashboardSnapshot.tsx).
- Surface admin-originated events (e.g., `message_received`) from `iset_case_event` into the applicant event feed when we integrate the events-capture service.
- Add negative-path tests (draft save failure, submission error handling, resume from saved draft, messaging send failures) once we expose corresponding API hooks.
- Add end-to-end coverage for Cognito login/registration/reset flows once staging credentials are available (current suite relies on dev headers).









