# Events Tracking Overhaul

## Purpose and Scope
- Establish a refreshed, end-to-end strategy for logging and surfacing ISET application events.
- Replace legacy tables (iset_case_event, iset_event_type) and ad-hoc logging helpers with a cohesive domain model.
- Cover both backend emission patterns and frontend consumption.
- Capture open questions and stakeholder requirements before implementation.

## Guiding Goals
- **Consistency**: A single contract for emitting, storing, and retrieving events across services.
- **Traceability**: Every event should include contextual metadata (actor, subject, correlation IDs) to support audit trails.
- **Extensibility**: Easy to add new event categories without schema churn or fragile joins.
- **Performance**: Efficient querying for timeline widgets and notification feeds.
- **Security**: Enforce scoping so staff only see events tied to cases they manage.

## Current State Summary (for reference)
- Backend helper `addCaseEvent` inserts into `iset_case_event`; other paths relied on POST `/api/case-events`; this is being replaced with the unified `/api/events` emitter.
- Event data is stored as JSON blobs with minimal validation and limited indexing beyond `created_at` and `event_type`.
- Frontend widgets (`ApplicationEvents`, `CaseUpdates`) now read from the new `/api/cases/:id/events` and `/api/events/feed` surfaces.
- Event taxonomy lives in `iset_event_type` with `label` and `alert_variant` only.

## Progress Log

### 2025-09-25 - Event capture enablement (admin)
- Lifted the event catalogue, capture service, and emitter into `../shared/events` so both admin and portal stacks can reuse the same emit/update logic (portal wiring still outstanding).
- Hooked the admin server to the shared emitter/service, exposing `/api/admin/event-types` and `/api/admin/event-capture-rules` while consulting runtime capture toggles before persisting events.
- Added a lightweight cache in the emitter that honours `iset_runtime_config` rules and invalidates itself whenever capture rules are updated.
- Refined the Event Capture dashboard by replacing the vertical list with an embedded Cloudscape table that surfaces attributes, last-updated metadata, and per-type capture toggles.
- Noted a remaining gap: the public portal still writes to `iset_case_event`; we will rebuild that backend in a clean workspace before adopting the shared emitter there.

## Proposed Documentation Outline

## Event Store Schema (Phase 1 rollout)
- **iset_event_entry**: canonical event rows (char(36) UUID id, category, event_type, severity, source, subject_type, subject_id, actor_type, actor_id, actor_display_name, payload_json, tracking_id, correlation_id, captured_by, captured_at, ingested_at). Indexed on (subject_type, subject_id, captured_at DESC) and (event_type, captured_at DESC).
- **iset_event_receipt**: per-recipient read/ack state (composite PK on event_id + recipient_id) storing `read_at`, enabling dashboards to track unread counts without mutating event rows.
- **iset_event_outbox**: async fan-out queue (pending/delivering/delivered/failed) with attempt counters and next_attempt_at so future workers can push into notification buses or analytics sinks without blocking emitters.
- Existing iset_case_event / iset_event_type remain read-only for reference during the transition and will be retired once emitters migrate.

Initial migration (sql/migrations/20250926_create_event_store.sql) seeds these tables idempotently; the server's migration bootstraper already executes migrations on startup.


1. **Domain Concepts**
   - Actors (staff, applicants, system jobs)
   - Subjects (case, application, document)
   - Event categories and severity levels
2. **Data Model**
   - Core schema (event store, type catalogue, denormalised views)
   - Indexing, retention strategy, archival
3. **Event Lifecycle**
   - Emission patterns (synchronous vs async)
   - Validation and enrichment pipeline
   - Delivery guarantees and idempotency expectations
4. **API Surface**
   - Ingress: standardised backend SDK/service interface
   - Egress: REST (or GraphQL) endpoints, pagination, filtering, subscription options
5. **Frontend Integration**
   - Widgets consuming events, expected payload shape, caching and polling
   - Notification routing (toast/snackbar, dashboard, email hooks)
6. **Operational Considerations**
   - Observability (metrics, tracing)
   - Security and RBAC enforcement
   - Data migration (if any) and rollout plan
7. **Configuration Dashboard**
   - Admin UI for enabling/disabling event capture by category/type
   - Persistence model and caching strategy for runtime toggles
   - Audit logging of configuration changes
8. **Open Questions & Decisions Log**
   - Items requiring stakeholder input
   - Implementation milestones



## Configuration Dashboard Concept
- **Audience**: System Administrators with appropriate RBAC permissions.
- **UI Sketch**: Table listing event categories (and optionally individual event types) with columns for Category, Description, Severity, Enabled. Include search/filter and inline tooltips.
- **Granularity**: Default to category-level toggles; allow drilling into specific event types where finer control is warranted.
- **Current Policy**: All categories and event types stay configurable until we formally designate compliance locks.
- **Safety Rails**:
  - Keep the capability to mark compliance-critical categories for future locking even though none are locked today.
  - Display warnings if disabling will impact downstream features (dashboards, notifications, reports).
- **Persistence**: New event_capture_rules table storing environment, category/type, enabled flag, metadata (who changed it, when, reason).
- **Runtime Behaviour**: Event emitter module hydrates rules into an in-memory cache with periodic refresh or change notifications. Emission calls consult the cache before persisting.
- **Audit Trail**: Configuration changes raise their own admin-level events so we can investigate missing data retroactively.
- **RBAC Integration**: Update the dashboard/role matrix so only authorised roles (e.g., SysAdmin) can view or change settings. Other roles either do not see the dashboard or have read-only access.

## Initial Requirements Checklist (Draft)
- Replace legacy tables with new schema supporting at least:
  - Event id, category, type, subject references (case/application/document IDs)
  - Actor metadata (actor_type, actor_id, derived display name)
  - Correlation ID / timeline grouping
  - Structured payload with versioning (payload_version + JSON data)
  - Flags for unread/acknowledged states per staff user
- Create canonical service for emitting events (Node service module or separate microservice).
- Support bulk event ingestion for background jobs without blocking main transaction.
- Provide audit-friendly retention (e.g., 7 years) with soft-delete/archival strategy.
- Surface configuration state through the new dashboard and reflect it in API responses (e.g., indicate when an event type is disabled).

## Open Questions (To Discuss)
1. Do we need multi-tenant or environment partitioning in the event store?
2. Should events support attachments or links to documents?
3. How will unread/read status be tracked? Per user, per role, or case-level acknowledgements?
4. Do we require real-time push (WebSocket/SSE) or is polling acceptable?
5. Any compliance requirements (PHIN, retention mandates) influencing storage location?
6. Should event taxonomy align with existing notification templates or diverge?
7. How granular should the configuration dashboard be (category-only vs per-event overrides)?
8. Should configuration changes require change-management approvals or multi-person acknowledgement?

## Next Steps
- Gather stakeholder input to confirm functional requirements, including configuration UI needs and RBAC rules.
- Finalise data model and API contracts.
- Plan migration / rollout (including cleanup of legacy endpoints and widgets).
- Align backend/frontend sprint scope.

## Shared Portal + Admin Configuration
- The public portal and admin console rely on separate backends but share the same database. Event capture toggles must therefore be persisted centrally so both stacks honour them.
- Reuse iset_runtime_config as the source of truth: store event capture rules under a dedicated scope (e.g., events_capture) with keys like category.case_lifecycle.enabled or per-event overrides.
- Admin dashboard writes to this table via the API; portal backend consumes the same settings during its bootstrapping or caches with periodic refresh.
- Include versioning or checksum fields so each backend can detect staleness and reload without restarts.
- Treat configuration changes as cross-tenant: we should document the contract so portal engineers know which keys to read.
- Example record:
  ```json
  {
    "scope": "events_capture",
    "k": "public_portal.application.saved_draft",
    "v": {
      "enabled": true,
      "last_changed_by": 42,
      "last_changed_at": "2025-09-25T15:21:00Z"
    }
  }
  ```
- Critical portal events (e.g., submission receipts) can be earmarked for locking later, but at this stage every type remains configurable.
- Ensure RBAC updates reflect that only authorised system administrators can alter these shared settings.

## Current Event Type Inventory

### Seeded Catalogue (`iset_event_type`)
| event_type | Label | Notes |
| --- | --- | --- |
| application_created | Application created | Insert-only catalogue entry; not currently emitted in admin backend |
| application_draft_deleted | Application draft deleted | Portal-side concept; no admin emitter yet |
| application_saved_draft | Application draft saved | Portal-side draft saves |
| application_submitted | Application submitted | Visible in dev data; emitted by portal submission flow |
| case_assigned | Case assigned | Seeded but no active emitter in current admin code |
| case_unassigned | Case unassigned | Seeded but no active emitter |
| document_uploaded | Document uploaded | Present in live data; emitted when files are adopted |
| message_deleted | Message deleted | Seeded; no emitter located |
| message_received | Message received | Seeded; no emitter located |
| message_sent | Message sent | Seeded; no emitter located |
| system_error | System error | Reserved for automated fault reporting |

### Observed in `iset_case_event` (dev database)
- application_submitted
- document_uploaded
- status_changed *(inserted by backend helper; not registered in the catalogue)*

### Backend Auto-Emitted (bypassing catalogue)
- status_changed — added in `PUT /api/cases/:id` when coordinator status changes.
- assessment_submitted — emitted alongside assessment submission.
- nwac_review_submitted — emitted when NWAC review payload is present.
- case_approved / case_rejected — sent by the coordinator widget via `/api/events`.
- documents_overdue — referenced by reporting queries; no matching emitter located.

### Frontend Expectations & Draft Event Types
- case_reassigned — rendered in `CaseUpdates` widget, but no current emitter.
- note_added — expected by `CaseUpdates`; relies on future notes feature.
- followup_due — expected by `CaseUpdates`; likely tied to task SLA logic.

### Gaps Identified
- Several emitted event types (`status_changed`, `assessment_submitted`, `nwac_review_submitted`, `case_approved`, `case_rejected`) are missing from `iset_event_type`, so metadata (label, alert variant) is unavailable in the UI.
- Seeded catalogue entries (e.g., `case_assigned`, `message_sent`) have no emitting code paths in the current admin backend, suggesting either unfinished features or portal-only flows.
- The configuration dashboard will need an authoritative list that merges catalogue entries with code expectations; we should validate each before deciding whether to lock or retire them later.
- Future retention/compliance requirements may introduce additional event types; keep the catalogue extensible and versioned.

## Configuration Dashboard UI Plan
- **Navigation**: Add a new board under the existing "Configuration" category in the left-hand navigation (e.g., `/configuration/events`). Menu entry visible only to `System Administrator` role via RBAC matrix updates.
- **Route / Component**: Introduce a dedicated React page (`src/pages/configuration/EventCaptureDashboard.js`) that renders within the existing ContentLayout shell. Use lazy loading so it does not impact default bundles.
- **Layout**: Top-level `ContentLayout` with a header describing the purpose, followed by a `Table` listing categories/types. Include toolbar actions for search/filter and future bulk enable/disable operations.
- **Columns**: Category, Event Type (optional when expanded), Description, Severity, Enabled toggle, Locked indicator (future use), Last Updated (user + timestamp), Source (portal/admin).
- **Interactions**:
  - Toggle switches patch `iset_runtime_config` via `/api/admin/event-capture-rules` (new endpoint) with optimistic UI updates and error toasts.
  - Expand rows (accordion) to reveal individual event types when a category groups multiple items.
  - Display badges for portal-only vs admin-only emitters to clarify scope.
- **RBAC**: Guard the route via frontend role check (similar to other admin-only boards) and backend authorization on the new API endpoints.
- **Empty/Error States**: Provide informative messages when rules are missing or API calls fail; include a quick link to documentation.
- **Audit Surfacing**: Inline banner listing the most recent configuration change (actor + timestamp) pulled from the config payload metadata.

## Backend Scaffolding & Cleanup Roadmap
1. **Inventory & Catalogue Normalisation**
   - Backfill missing `iset_event_type` rows for currently emitted types (`status_changed`, `assessment_submitted`, etc.).
   - Annotate each type with preliminary category/severity and flag candidates for the configuration UI.
2. **Legacy Teardown Preparation**
   - Wrap existing direct inserts into a thin adapter that calls a no-op event service stub; feature-flagged to allow gradual switch.
   - Document all touchpoints scheduled for removal (helpers, routes, widgets expecting legacy payloads).
3. **Event Service + Outbox Scaffolding**
   - Create new modules (`src/lib/events/service.ts`, `db/migrations/...`) implementing emit contract, rule cache, and DB tables (`event_entry`, `event_outbox`, etc.).
   - Provide CLI/dev tooling to seed rules and types for local environments.
4. **Configuration APIs**
   - Implement `/api/admin/event-capture-rules` (GET/PATCH) and `/api/admin/event-types` for the dashboard.
   - Ensure responses include lock status placeholders and audit metadata sourced from `iset_runtime_config` and the catalogue.
5. **Frontend Wiring**
   - Build the Event Capture dashboard page, connect to new APIs, and integrate into the nav.
   - Update `ApplicationEvents` to gracefully handle the transitional state (placeholder data) until the new event store is live.
6. **Emitter Migration**
   - Replace legacy helpers (`addCaseEvent`, direct SQL inserts) with the new event service, ensuring capture rules are respected.
   - Update portal/backend flows to share the same emitter package.
7. **Cleanup & Verification**
   - Remove deprecated tables/endpoints once the new store powers all consumers.
   - Add monitoring hooks and smoke tests validating key event flows end-to-end.

## Proposed Architecture

### Event Service Layer
- Provide a single entry point emitEvent({ category, type, subject, actor, payload, channel, correlationId, options }) that all backends call.
- Responsibilities:
  - Hydrate capture rules (cached from iset_runtime_config scope events_capture).
  - Prepare for future mandatory/locked events while short-circuiting disabled categories/types.
  - Enrich payload with identifiers (event UUID, timestamps, environment, correlation ID).
  - Persist to the canonical event store (DB table or queuing outbox) and optionally fan out to secondary sinks (logs, notifications).
  - Expose async guarantees (e.g., options.deliveryMode = 'async' | 'sync').

### Storage Model
- New tables:
  - event_entry capturing core fields: id, category, type, subject_type, subject_id, actor_type, actor_id, actor_snapshot, payload_version, payload_json, correlation_id, channel, environment, captured_at, emitted_by, capture_status.
  - event_receipt (optional) to track user-specific read/ack states without bloating event_entry.
  - event_type_catalog defining category/type metadata (labels, severity, optional lock flags).
- Indexing strategy: composite indexes on (subject_type, subject_id, captured_at DESC) and (category, type, captured_at DESC) to keep timeline queries performant.
- Retention: plan archival routine (e.g., move events older than X years to cold storage) while keeping audit guarantees.

### Resilience & Delivery
- Support an outbox pattern: transactional insert into event_outbox when emitting inside business transactions; background worker flushes to event_entry or external bus. Avoids blocking user flows if the event store lags.
- Retries with exponential backoff and dead-letter queue for problematic payloads.
- Health metrics: queue depth, failed writes, config cache staleness.

### API Surface Refresh
- Expose `/api/cases/:id/events` and `/api/events/feed` endpoints backed by the new store, honouring filters (category, type, subject, time range).
- Provide mutation endpoints for marking events read, acknowledging, or updating receipts (driven by event_receipt).
- Ensure responses include structured metadata (category, type, payload_version, actor summary) so modernised widgets render richer output.

### Frontend Integration
- Keep existing layout for ApplicationEvents but refactor data load to new API contract.
- Extend widget to interpret new fields (e.g., show category badges, link to subject entity).
- Optionally supply real-time updates later (WebSocket/SSE) once backend supports streaming.

### Configuration Sync
- Admin dashboard writes capture rules into iset_runtime_config (scope='events_capture').
- Event service refreshes its cache on a schedule or when notified via pub/sub.
- Public portal backend reads same keys; if offline, falls back to last-seen snapshot with version tokens.
## Implementation Plan (High-Level)

1. **Documentation & Design Finalisation**
   - Socialise this document with backend/frontend/portal stakeholders.
   - Confirm schema, API shapes, and configuration format.

2. **Clean Break Preparation**
   - Remove legacy event helpers/routes/tables from codebase (retain widget shell with placeholder data).
   - Feature-flag the new event surfaces so we can ship incrementally.

3. **Core Infrastructure**
   - Create new database schema (event_entry, event_type_catalog, optional event_receipt, event_outbox).
   - Implement the event service layer with rule cache + emit pipeline.
   - Wire configuration lookups to iset_runtime_config.

4. **Backend APIs**
   - Build new REST endpoints (and service methods) to fetch events, mark read, etc., using the fresh schema.
   - Add admin endpoints to manage event catalog (if needed) and to expose capture-rule status.

5. **Frontend Integration**
   - Update ApplicationEvents widget to call new endpoints while preserving layout.
   - Add admin configuration dashboard UI (table of categories/types with toggles, audit info).
   - Ensure RBAC matrix includes the new dashboard.

6. **Portal Alignment**
   - Refactor public portal backend to emit via the shared event service (or shared module) and honour capture settings.
   - Add health logging to confirm portal cache refresh.

7. **Observability & Ops**
   - Instrument metrics/logging around emit success/fail, queue depth, cache refresh.
   - Create dashboards/alerts for configuration mismatches or backlog spikes.

8. **Rollout & Cleanup**
   - Backfill any seed event types into event_type_catalog.
   - Remove feature flags once the new pipeline runs end-to-end.
   - Document operator runbooks (configuration updates, troubleshooting).

## TODO (Implementation Follow-up)
- Hook the new event service into the future event outbox/migration scripts once the storage schema is ready.
- Expand the API contract to return detailed validation errors (future locked/mandatory events) instead of silently skipping updates.
- Tighten the Event Capture dashboard with search, filtering, and audit trails when the catalogue grows.

## Next Steps (Immediate)
- Finalise scope for Step 2 (legacy code removal) and create tracking tasks.
- Draft schema migration scripts and event service interface skeletons.
- Define API contracts (OpenAPI/TypeScript types) for frontend and portal teams.






























