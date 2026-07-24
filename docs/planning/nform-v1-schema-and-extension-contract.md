# nForm v1 Schema and Solution Extension Contract

Purpose: Define the clean nForm v1 persistence boundary and the supported way a fork adds domain behavior without turning core into a case-management model.
Audience: Engineers implementing the standalone nForm repository and downstream solution forks.
Last Updated: 2026-07-23
Status: Active architecture baseline. Table and API names may be refined during implementation, but the ownership boundaries are decisions, not placeholders.

## Design Rules

1. Start from a clean squashed nForm schema; do not replay PATH migrations.
2. Keep staff-portal identities and public-portal identities in separate tables and Cognito pools.
3. Treat an intake definition and each published version as platform records.
4. Treat a submission as an immutable neutral envelope, not an application or case.
5. Put business entities and business statuses in solution-owned tables.
6. Support anonymous and authenticated intake sessions through the same runtime contract.
7. Publish immutable compiled definitions; never write published JSON into application source files.
8. Use database constraints and server-side validation for privacy, integrity, idempotency, and ownership.
9. Permit a narrow in-transaction solution extension for genuinely atomic domain work such as reserving an appointment slot.
10. Emit all post-commit integrations through a durable outbox.

## Identity and Authorization

### `operator_identity`

Internal account allowed to enter the staff portal.

Core fields:

- `id`
- Cognito subject and pool/provider identifier
- normalized email
- display name
- account status
- created/updated/last-login timestamps

This table must not contain region, case assignment, finance, coordinator, or other solution attributes.

### `public_identity`

Authenticated external-user account allowed to enter account-required public journeys.

Core fields mirror the identity/provider boundary above. This table must remain separate from `operator_identity`; email similarity must never bridge the two identity domains automatically.

### Roles and permissions

- `role`
- `permission`
- `role_permission`
- `operator_role`

`System Administrator` is the sole platform-seeded role. Platform permissions include:

- identity and role administration
- intake create/edit/review/publish/rollback
- component-library administration
- submission view/export/retention
- notification/configuration administration
- audit/platform operations

Solutions seed or configure all business roles and permissions.

## Intake Authoring

### `component_type`

Stable component identity such as input, textarea, radio, checkboxes, select, date, file upload, text block, inset text, warning, details, summary, or signature acknowledgement.

### `component_type_version`

Immutable versioned contract containing:

- property schema
- default properties
- authoring editor metadata
- runtime renderer/schema identifier
- validation capabilities
- migration/compatibility metadata
- active/deprecated status

Published intakes reference exact component versions. Arbitrary author-supplied executable code is prohibited.

### `intake_definition`

Stable product identity for a codeless intake:

- stable UUID and route slug
- staff-facing name and optional public title
- lifecycle state
- current working revision
- active published version
- created/updated actor and timestamps

There may be many intake definitions. nForm must not retain one global `workflow.schema.intake` assumption.

### Working authoring graph

- `intake_revision`
- `intake_step`
- `intake_step_component`
- `intake_route`
- `intake_route_option`

An author edits a revision graph. The revision carries:

- anonymous or authenticated access mode
- whether authenticated save/resume is enabled
- locale configuration
- start step
- validation/schema version
- optional solution integration key

Step and component rows are solution-neutral. Any solution metadata must be explicitly namespaced.

### Publication governance

- `intake_publication_request`
- `intake_publication_review`

The configured policy may permit a user with publish permission to publish directly or may require a separate reviewer/publisher. The records retain actors, decisions, notes, timestamps, and the exact revision/checksum reviewed.

### `intake_publication`

Immutable compiled public artifact:

- intake definition and source revision
- monotonically increasing version
- compiled schema JSON
- schema/component contract versions
- checksum
- publisher and optional reviewer evidence
- published timestamp and release note
- supersedes/rollback provenance

`intake_definition.active_publication_id` is changed atomically only after full validation. Rollback repoints this active pointer to a previously valid immutable publication and creates audit evidence.

## Public Runtime State

### `intake_session`

Short-lived server-side response state for both anonymous and authenticated journeys:

- random UUID
- hashed bearer/session secret, never the raw browser token
- intake definition and exact publication
- optional `public_identity_id`
- authentication mode
- encrypted/protected response payload
- navigation history and current step
- attachment staging metadata
- created, last-used, and expiry timestamps
- completion/abandonment state

Anonymous ownership is proven by a Secure, HttpOnly, SameSite cookie plus CSRF/origin controls. Authenticated ownership is additionally bound to the public Cognito identity.

Ephemeral answers and cross-step history remain server-side. They are not stored in browser storage or long-lived client memory.

### `public_response_draft`

Durable save/resume state:

- exact intake publication
- required `public_identity_id`
- payload/history/cursor
- attachment references
- version/concurrency token
- created/updated timestamps

Anonymous journeys cannot create durable drafts in v1. A solution that wants anonymous return links would require a separately designed capability, not an insecure reuse of draft identifiers.

## Neutral Submission

### `submission`

Immutable core envelope:

- UUID and human-safe reference
- intake definition and exact publication
- optional public identity
- anonymous/authenticated mode
- submitted payload
- schema/publication checksum and optional legal snapshot
- navigation/history evidence when retained
- locale
- source/security metadata under an explicit retention policy
- payload checksum and idempotency key
- submitted timestamp
- retention state and timestamps

The submission has no generic business status. Technical integrity/retention fields must not become a hidden application or case lifecycle.

### Attachments

- `attachment`
- `submission_attachment`
- optional staging links to `intake_session` and `public_response_draft`

Core owns:

- S3 object identity
- original/safe display name
- MIME/type/size/hash
- scan/integrity state
- encryption/storage metadata
- upload actor/session
- retention/deletion timestamps

Solutions may create their own document records referencing the immutable core attachment ID. Core attachments never carry client/case/application/appointment foreign keys.

## Staff Submission Registry

The registry reads core submission/publication/identity/attachment data. It supports:

- intake and published-version filters
- reference and date search
- anonymous/authenticated filter
- authorized field/payload view
- attachment access
- schema-aware labels from the submitted publication
- audited export
- retention/legal-hold actions

Solutions may add separate domain dashboards. They must not add solution columns or business statuses to the core registry schema.

## Events, Notifications, and Audit

Core tables:

- `event_entry`
- `audit_entry`
- `outbox_message`
- `outbox_delivery`
- `notification_template`
- `notification_rule`
- `notification_delivery`

Platform event keys include identity lifecycle, intake publication/rollback, session/draft lifecycle, submission completion, attachment lifecycle, notification delivery, and system/security events.

Solution event keys use a namespaced catalog and solution handlers. PATH event names do not ship in nForm.

## Configuration and Staff Workspace

Core tables:

- `runtime_config`
- `operator_dashboard_layout`
- optional `widget_registration` when registration is data-driven
- `service_announcement`
- schema migration ledger/readiness metadata

The empty platform ships only platform administration, authoring/publication, submissions, identities/roles, notifications, audit/events, and platform operations surfaces. It ships no business dashboard or sample intake.

## Submission Completion Contract

Completion proceeds in this order:

1. Resolve the intake session and exact immutable publication.
2. Revalidate the entire merged payload and required attachments server-side.
3. Verify session ownership, authentication mode, idempotency, expiry, and rate/security controls.
4. Open a database transaction.
5. Lock the idempotency/session boundary and reject inconsistent replay.
6. Insert the neutral submission and transfer staged attachments.
7. Invoke the registered solution's optional in-transaction hook.
8. Insert core and solution outbox events.
9. Mark the intake session completed and remove/close any durable draft.
10. Commit.
11. Return the neutral submission receipt plus an optional namespaced solution result.
12. Deliver notifications/integrations asynchronously from the outbox.

### In-transaction solution hook

Interface concept:

```js
async function onSubmissionCreated({
  transaction,
  submission,
  publishedIntake,
  validatedPayload,
  attachments,
  publicIdentity,
}) {
  // Optional solution-owned atomic writes.
  // Return JSON-safe, non-sensitive namespaced receipt metadata only.
}
```

Rules:

- Registered by solution code, never authored as arbitrary script.
- May write only through the supplied transaction.
- Must be deterministic/idempotent for the submission ID.
- Must not alter the neutral submission payload or platform provenance.
- Failure rolls back the complete transaction.
- Output is stored/returned under a solution namespace.
- Slow external providers are prohibited inside the transaction; use outbox events.

This hook is necessary for uses such as appointment capacity reservation where the neutral submission and the domain booking must either both succeed or both fail.

### Post-commit integration

Every successful submission emits a durable `platform.submission.completed` outbox event. Solution consumers and external integrations use at-least-once delivery with idempotency keyed by submission/event ID.

## Migration Boundary

The nForm repository receives one reviewed baseline migration followed by ordinary forward migrations. It does not import:

- PATH client/case/application tables
- ISET workflows or component content
- PATH users or submissions
- PATH notification/event catalogs
- PATH document types/checklists
- PATH reporting/finance/integration tables
- historical repair migrations

The initial platform seed contains only:

- component contracts needed by the codeless editor/runtime
- `System Administrator` role and platform permissions
- environment/bootstrap binding for `bill@sillery.co.uk`
- empty platform configuration

It contains no intake definition, sample submission, demo workflow, or business role.

## Acceptance Invariants

- A clean database boots with no PATH/ISET/NWAC nouns or rows.
- The configured System Administrator can sign into the staff portal.
- Staff can create an intake from an empty state, author steps/components/branches, validate, preview, and publish it without a code deployment.
- Publication creates an immutable database version and never changes source files.
- The public portal can run one anonymous and one authenticated intake definition.
- Both modes create the same neutral submission envelope.
- Authenticated save/resume works; anonymous answers expire server-side without browser persistence.
- Staff can find, view, export, and audit submissions.
- No submission completion path creates a client, case, application, appointment, task, or work queue unless a solution extension is installed.
- A test extension can atomically create a domain record and can prove rollback when its write fails.
