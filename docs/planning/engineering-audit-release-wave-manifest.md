# Engineering Audit Consolidated Release-Wave Manifest

Purpose: define the minimum coherent release boundary for the completed `GPT56-2026-07` local remediation programme.

Audience: release operator and future Codex threads.

Status: current local release candidate; TEST and PROD are not authorized by this document.

Last Updated: 2026-07-12

## Decision

Use one coordinated application/schema release through TEST and, after acceptance, one promotion of that same clean source line to PROD. Do not deploy the audit tranches individually. The current commits already contain the cumulative compatible changes, and several fixes cross shared/admin/portal/schema boundaries.

Keep these out of the application release:

- `EA-028` bootstrap/launch-template descriptor activation;
- payment email or Intacct routing activation, real Finance sends, or Sage sandbox/provider calls;
- runtime configuration, published workflow, allowlisted dataset, TEST database refresh, historical repair, or feedback-record mutation unless separately named and authorized;
- the local Intacct mock, which is not a versioned deployable application repository.

## Release Candidate Identity

| Component | Candidate commit / fingerprint | Required release scope |
| --- | --- | --- |
| Admin | `8472bb449e1e4cc96c80f58ae06ed968c272c7a8` | Deploy admin source/build and include canonical migrations. |
| Portal | `28863443f2dc2d0eb58ed8db64de80ffd6eeaf2d` | Deploy portal source/build. |
| Shared | `cf6bfe9bac0949c6ab27fb12ce51f811524afd55` | Deploy shared runtime with both apps. |
| Intacct mock server | SHA-256 `913bdd695f255cc73f0b24b17b8d5fd81d7ab79f408fc9ced3bbf6a9768fddbf` | Local controlled rehearsal only; do not package into PATH. |
| Intacct mock README | SHA-256 `aaf04e97ed5821e91d17f56d9993803d765a41b030bfc5ba549bd49d2a7532b9` | Local contract documentation only. |

The admin repository will gain a documentation-only descendant commit containing this manifest. At release admission, capture the exact clean heads again and require the deploy manifest/tree fingerprints to match; do not rely on these recorded values if any source has moved.

## Canonical Schema Set

Apply the canonical migrations in normal ledger order as part of the same release. Do not replay them manually or rename them.

| Migration | SHA-256 | Coupled behavior |
| --- | --- | --- |
| `20260710_0002_harden_signing_completion_idempotency.sql` | `9412a3fc0d92f554bbe4c1f052805f303d82821c967daee75681623eb0f1300b` | Portal signing completion and shared stable event identity. |
| `20260711_0001_verify_runtime_schema_ownership.sql` | `4e3a919483491bc03093a1efe20311031a37c14d69f4cef25798463cd2737075` | Migration-owned ESDC `prepared` enum; runtime paths are read-only schema consumers. |
| `20260711_0002_harden_client_file_import_concurrency.sql` | `b13168f49eb2bbaaa0d7ff5f97d5163b9fed61e40029c8610f0d5ef9ab67e18b` | Admin durable import run and identity claims. |
| `20260711_0003_add_durable_event_delivery.sql` | `e358cf68694a1b20f40c2bd45f22f27abbda2967afe19f69083a8c14bf6c1759` | Shared/admin/portal durable event and reminder delivery. |
| `20260712_0001_add_payment_submission_attempt.sql` | `032aa67a5d0cf9b83a631c887b20e33e1ba1d6c65504003db2621317228baf75` | Admin payment handoff durability; routing remains disabled. |

All five changes are additive or enum-expanding. They are designed to remain present if an application rollback is needed. Do not attempt a destructive schema rollback during an incident; restore the prior app artifacts, preserve the new tables/columns, and inspect any queued/ambiguous delivery rows before re-promoting.

## One Application Release Boundary

The coordinated release includes the cumulative R0/R2-R7 code line. R1 portal completion is already in PROD but remains part of the portal source candidate. The main cross-component reasons not to split the release are:

- signing durability requires portal, shared stable events, and its migration;
- durable notifications require shared, both event producers/workers, and the delivery migration together;
- canonical AI configuration requires shared plus both app consumers;
- schema ownership/readiness requires migrations plus both `/readyz` contracts and deployment smoke behavior;
- current admin includes the client-import, allocation, payment-attempt, legacy-retirement, and request-ownership repairs against that same schema/runtime line.

Payment routing remains disabled before, during, and after this application release. Deploying its additive attempt table and fail-closed code is not authorization to enable Finance email or Intacct.

## TEST Rehearsal Gate

Use one all-surface maintenance event and the standard `path:deploy` release-admission sequence. Default scope is shared + admin + portal + planned schema, with no dataset or runtime/workflow promotion. Before mutation, require clean pushed source, exact-tree aggregate tests/lint/privacy checks, the five migration inventory/checksum results, a restore point, and the standard warning/fallback plan.

After normal routing is restored, acceptance must cover:

- admin and portal `/readyz`, source/build identity, migration ledger success, and both process/target health checks;
- portal intake completion and signing retry/idempotency with isolated fixtures and complete cleanup;
- Manual Intake current-selection rejection and Case/Payment Workspace scope switching;
- one controlled client-import replay/concurrency fixture with no duplicate identity claim;
- durable event delivery with one controlled event/recipient, including lease/replay status inspection and no historical `legacy` fan-out;
- allocation competition/rollback against isolated budget fixtures;
- PTMA retirement (`410`) and System Administrator-only Hub access;
- AI runtime read/partial-save behavior without `.env` mutation;
- payment readiness/schema only, with provider/email routing still disabled and no real send.

Do not use the local Intacct mock checksum as Sage certification. Current documented success-envelope parsing is local evidence only; payload, error, OAuth, attachment, and multi-vendor fidelity still require separately authorized official/sandbox proof.

## PROD Promotion Gate

Promote the exact TEST-accepted commits and migration bytes; rebuild/re-admit if any source changes. Before PROD mutation, perform the standard read-only preflight for pending migrations, schema compatibility, event-delivery backlog state, payment-routing disabled state, and known historical review inventories. Any proposed repair must be a separate named operation with its own preview, rollback, and authority.

Use one all-surface warning/five-minute notice/ALB fallback/release/normal-routing-smoke sequence. Complete the bilingual Landing Page release package from `docs/meta/next-release-notes-log.md` before build. After release, verify source/build identity, readiness, migration ledger, notification delivery health, payment disabled state, and the targeted workflows above with PROD-safe evidence. Do not create synthetic applicant/payment/provider activity in PROD without explicit approval.

## Separately Authorized Follow-ons

1. `EA-028`: rehearse immutable release-descriptor consumption and rollback in TEST, then seek PROD infrastructure authority. This is not required for the application fixes to run and must not be smuggled into their release.
2. Payment/Intacct activation: resolve business roles and follow-up decisions, obtain current Sage contract/sandbox evidence, run the full TEST payment workflow, and then seek explicit PROD routing/send authority.
3. Historical review/repair inventories: signing duplicates, ambiguous provenance/contact notes, client-import identity collisions, event-delivery reconciliation, and payment attempts remain read-only review queues until a specific repair is approved.

## Current Local Evidence

- Admin aggregate: 65 frontend suites / 267 tests and 17 backend/tooling suites / 71 tests.
- Portal aggregate: 15 frontend suites / 68 tests and 6 backend suites / 52 tests.
- Intacct local drift audit: 18/18 checks passed with known fidelity gaps retained.
- Admin and portal quiet lint, server/test syntax, migration/manifest JSON, and both repository diff checks passed.
- Documentation link audit reports three unrelated pre-existing missing references; no release-manifest or edited Intacct reference is missing.
- No DEV, TEST, PROD, AWS resource, database, runtime configuration, provider, email, artifact, deployment, or live backlog record was accessed or changed while preparing this manifest.
