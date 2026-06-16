Purpose: Capture the design baseline, product intent, and phased implementation plan for the mock Sage Intacct dashboard and PATH reconciliation simulation work.
Audience: Admin dashboard engineers, mock-service engineers, future chat threads.
Last Updated: 2026-06-15

# Intacct Mock Dashboard Design

## Why this exists
- This document is a durable handoff for ongoing design work.
- The user explicitly called out that chat-thread context is not durable enough for this task.
- Future work should resume from this file instead of relying on prior conversation context.

## Repos in scope
- Admin dashboard: `/home/bill/ISET/admin-dashboard`
- Mock service: `/home/bill/ISET/intacct-mock-service`

## Related fidelity audit
- Use `docs/planning/intacct-interface-fidelity-audit.md` as the current contract-fidelity audit before changing PATH Intacct sender behavior or mock Sage-facing routes.
- Use `docs/data/integrations/intacct-interface-fidelity-manifest.json` plus `npm run audit:intacct-contract` as the local PATH/mock drift guard.
- The audit guard does not certify Sage fidelity by itself; claims about Sage behavior still need current official Sage documentation or approved sandbox evidence.

## Problem statement
- The current mock Intacct service only accepts submitted AP bill payloads and returns basic success/failure responses.
- PATH needs a test interface that shows what has been submitted and then simulates downstream Sage/AP processing so reconciliation features can be developed and tested.
- The current PATH demo integration appears to model one payment packet as one external Intacct bill, which is likely too simple for real AP behavior.

## Overarching fidelity goal
- The mock service should be a faithful external-interface simulator for Sage Intacct, not just a convenient local fake.
- PATH functionality should be developed against the mock with enough contract fidelity that switching the same PATH integration code to a genuine Sage Intacct backend should not significantly bug out because of avoidable differences in authentication flow, endpoint paths, payload shape, validation rules, status/error responses, attachment handling, idempotency, or vendor/AP-bill object semantics.
- When the real Sage interface is uncertain, verify against current Sage Intacct published documentation or an approved sandbox tenant before treating mock behavior as authoritative.
- Mock-only dashboard and testing conveniences are acceptable, but they must stay clearly separated from the simulated Sage-facing API contract.

## Current evidence

### Mock service
- `intacct-mock-service/src/server.js` is a minimal Express app.
- It currently supports:
  - token issuance
  - vendor list/create/get
  - AP bill create/get
  - attachment stub
  - health check
- Bills are stored in memory.
- Vendors are seeded in memory and, when MySQL is reachable, persisted in `intacct_mock_vendor`; local DEV startup can load missing DB settings from the sibling admin `.env` and seed PATH payment-line `payee_reference` values into the mock vendor store.
- The mock dashboard now includes a test bill lifecycle, but those states are mock-side reconciliation simulations unless explicitly mapped to Sage AP state fields.

### PATH current Intacct behavior
- `isetadminserver.js` builds one REST AP bill payload per payment packet.
- The payload includes PATH trace metadata (`packet_id`, case/client/intervention identifiers, and `source_system`) for mock dashboard visibility.
- The bill currency is taken from the packet when present, then from a single line currency, then falls back to `CAD`.
- The payload uses the first packet line to derive `vendor_id` for the whole bill:
  - `isetadminserver.js` -> `buildIntacctRestBillPayload`
- The payment-packet XML preview follows the same simplification:
  - `src/pages/finance/widgets/PaymentDetailWidget.jsx`
- PATH payment packets can contain multiple lines with different payees/vendors.

## Design correction
- Keep `payment packet` as PATH's internal workflow container.
- Do not treat `payment packet` as the external accounting bill.
- Introduce a derived external submission model:
  - one PATH packet can produce one or more mock Sage bills
  - the minimum grouping rule should be by vendor/payee
- Submission and reconciliation should operate on derived mock bills, then roll results back to packet lines and packet summaries.

## Locked decisions from design interview

### Product direction
- Build a separate mock-service UI, not a dashboard inside the main admin app.
- The mock service should be startable with `npm start` from its own repo.
- The mock service UI may auto-open in a new browser tab on local Windows startup, but this is optional behavior and should not be required for service startup.

### Delivery sequence
- MVP priority 1: see submitted items in the mock dashboard.
- MVP priority 2: change mock Sage-side status from the mock UI.
- MVP priority 3: add PATH sync/pull and reconciliation integration.

### Sync model
- PATH should use pull/sync, not depend on push callbacks.
- Finance Settings should eventually include a configurable poll interval:
  - `src/pages/finance/widgets/FinanceIntacctIntegrationWidget.jsx`

### UX stance
- Start with MVP only.
- Keep chat/output design concise during ongoing collaboration.

## Recommended canonical model

### PATH objects
- `PaymentPacket`
- `PaymentPacketLine`

### Mock Sage objects
- `MockExternalBill`
- `MockExternalBillLine`
- `MockExternalBillEvent`

### Mapping
- One `PaymentPacket` can derive multiple `MockExternalBill` records.
- Each derived bill should contain one or more PATH lines that belong to the same vendor/payee group.
- Each bill should keep references back to:
  - PATH packet ID
  - PATH line IDs
  - case/client/intervention context needed for testing and display

## Recommended mock bill lifecycle
- `accepted`
- `on_hold`
- `rejected`
- `approved_for_payment`
- `paid`
- `voided`

Notes:
- `accepted` means PATH submission created the external bill successfully.
- `paid` is the key downstream state PATH reconciliation needs.
- `on_hold`, `rejected`, and `voided` give enough negative-path coverage for early reconciliation work.

## Recommended event payload fields
- `id`
- `bill_id`
- `event_type`
- `status`
- `occurred_at`
- `actor`
- `reason_code`
- `note`
- `payment_reference` (for `paid`)
- `payment_method` (for `paid`)
- `metadata`

## Recommended reason codes for MVP
- `missing_evidence`
- `vendor_mismatch`
- `invalid_gl_account`
- `missing_dimension`
- `duplicate_invoice`
- `policy_review`
- `manual_test`

## MVP scope

### MVP 1: visibility
- Serve a separate mock dashboard UI from the mock service.
- Show submitted PATH packets received by the mock.
- Show derived mock bills created from those packets.
- Show bill-level context:
  - PATH packet ID
  - vendor
  - amounts
  - submitted time
  - current status
  - constituent PATH line references
- Keep this read-only in the first slice if needed.

### MVP 2: status simulation
- Allow changing mock bill status from the mock UI.
- Record a bill event for each state change.
- Support the main manual actions:
  - place on hold
  - reject
  - approve for payment
  - mark paid
  - void

### MVP 3: PATH sync/reconciliation
- Add PATH-side polling of the mock service on a configurable interval.
- Add a manual sync action.
- Map mock bill states/events back to PATH reconciliation records.
- Show downstream Sage-style state in the reconciliation UI.

## Recommended UI structure for the mock service

### Separate mock dashboard
- Main route served by the mock service itself.
- Primary operator is the developer/tester, not end users.

### Recommended layout
- Primary table: derived mock bills
- Side/detail panel:
  - packet context
  - bill lines
  - bill events
  - action controls

Rationale:
- Bills are the external system unit PATH should reconcile against.
- Packet context is still important, but should not be the main working object for mock Sage operations.

## PATH design implications
- The current one-bill-per-packet demo path should eventually be refactored.
- PATH submission should derive multiple external bills when packet lines belong to different vendors/payees.
- PATH should not silently hide that split from operators forever.
- Recommended UX later:
  - show a split preview at submission time
  - allow user confirmation
  - track each derived bill separately after submission

## Open design items
- Exact grouping rules beyond vendor:
  - vendor only
  - or vendor + currency + bill date + entity/location constraints
- Whether the first mock UI should show:
  - `Packet -> Bills -> Lines` hierarchy
  - or a flat Bills-first table with packet context in detail view
- Exact persistence choice for mock bill/event state:
  - in-memory for first slice
  - or MySQL-backed from the start
- Whether mock startup should auto-open the browser by default or behind an env flag

## Recommended next execution order
1. Extend the mock service data model to store submitted packets, derived bills, and bill events.
2. Add a simple mock-service UI that lists submitted packets and derived bills.
3. Add bill-status mutation actions in that UI.
4. Add PATH-side sync configuration in `FinanceIntacctIntegrationWidget.jsx`.
5. Add PATH-side sync endpoint/job/manual action.
6. Refactor PATH submission tracking from packet-only outcomes to derived external bill outcomes.

## Implementation progress
- 2026-06-15: Reworked the mock dashboard into a denser development/testing console:
  - fixed `/dashboard` asset loading by serving dashboard CSS/JS from `/dashboard/*`
  - added local contract endpoint visibility for token, vendor, and AP bill routes
  - added summary metrics, status filtering, optional auto-refresh, and a sample-bill generator
  - improved AP bill detail readability with compact status/action controls, line cards, event timeline, and copyable raw payloads
  - separated AP bill lifecycle events from attachment transport activity so uploads do not read as repeated bill-acceptance events
- 2026-06-15: Promoted canonical Sage-style REST object paths for PATH and the mock while retaining old mock aliases for local compatibility:
  - `/ia/api/v1/objects/accounts-payable/vendor`
  - `/ia/api/v1/objects/accounts-payable/bill`
- 2026-06-15: Added the Sage Intacct interface fidelity audit and local contract drift guard:
  - `docs/planning/intacct-interface-fidelity-audit.md`
  - `docs/data/integrations/intacct-interface-fidelity-manifest.json`
  - `npm run audit:intacct-contract`
- 2026-06-15: Stabilized DEV testing setup by making the mock vendor store DB-backed when available, auto-seeding PATH payment-line vendor references, and surfacing PATH packet/case/client/intervention metadata in submitted-packet rows.
- 2026-03-16: Added separate mock-service dashboard route at `/dashboard`.
- 2026-03-16: Added in-memory mock state for:
  - submitted packet envelopes
  - AP bills
  - bill events
- 2026-03-16: Added dashboard API for bills, packets, vendors, and bill actions.
- 2026-03-16: Added first prototype UI with tabs:
  - `AP Bills`
  - `Submitted Packets`
  - `Vendors`
- 2026-03-16: Added right-side detail panel and bill action controls.
- 2026-03-16: Added mock vendor-create path for the dashboard UI.
- 2026-03-16: Updated mock-service README with dashboard route and MVP notes.
- 2026-03-16: Verification completed via syntax checks only; no parallel server was started so the existing dev environment would not be disrupted.

## Thread restart instructions
- Re-read `docs/AGENTS.md`.
- Re-read `docs/planning/intacct-interface-fidelity-audit.md` and then this file.
- Then inspect:
  - `/home/bill/ISET/intacct-mock-service/src/server.js`
  - `/home/bill/ISET/admin-dashboard/isetadminserver.js`
  - `/home/bill/ISET/admin-dashboard/src/pages/finance/widgets/FinanceIntacctIntegrationWidget.jsx`
  - `/home/bill/ISET/admin-dashboard/src/pages/finance/widgets/PaymentDetailWidget.jsx`
  - `/home/bill/ISET/admin-dashboard/src/pages/finance/widgets/ReconciliationDataContext.jsx`
