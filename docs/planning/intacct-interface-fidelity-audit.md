Status: current
Purpose: Track how faithfully the local Intacct mock and PATH sender model the external Sage Intacct interface.
Audience: Admin dashboard engineers, mock-service engineers, future Intacct integration threads.
Last Updated: 2026-06-15

# Sage Intacct Interface Fidelity Audit

## Why this exists

The mock Intacct service is not meant to be only a convenient local fake. Its job is to give PATH a realistic external interface so that payment and reconciliation functionality built against the mock can later point at a real Sage Intacct backend with minimal surprise.

This file is the human audit trail. The companion manifest at `docs/data/integrations/intacct-interface-fidelity-manifest.json` and `npm run audit:intacct-contract` provide a lightweight local drift guard.

Important boundary: the local audit script proves that the PATH sender and mock still agree with the currently recorded local contract. It does not prove Sage fidelity by itself. Sage fidelity needs current Sage documentation evidence or an approved Sage sandbox tenant replay.

## Evidence Consulted

Local evidence:

- PATH sender in `isetadminserver.js`, especially `resolveIntacctRestBaseUrl`, `fetchIntacctRestAccessToken`, `fetchIntacctVendors`, `createIntacctVendor`, `buildIntacctRestBillPayload`, and `sendIntacctRestForPacket`.
- Mock service in `../intacct-mock-service/src/server.js`.
- Mock service README in `../intacct-mock-service/README.md`.
- Historical PATH finance docs and UI previews that still mention the XML Web Services APBILL shape.

Official Sage evidence checked on 2026-06-15:

- Sage Intacct REST API reference: https://developer.sage.com/intacct/apis/intacct/1/intacct-openapi
- Sage Intacct REST OAuth 2.0 docs: https://developer.sage.com/intacct/docs/1/sage-intacct-rest-api/authorization-and-security/oauth2
- Sage XML-to-REST object map: https://developer.sage.com/intacct/docs/1/sage-intacct-rest-api/get-started/xml-rest-object-map
- Sage XML API reference: https://developer.intacct.com/api/
- Sage XML Accounts Payable bills reference: https://developer.intacct.com/api/accounts-payable/bills/
- Sage XML Accounts Payable vendors reference: https://developer.intacct.com/api/accounts-payable/vendors/

Note: several `developer.sage.com` REST pages are JavaScript-rendered and could not be captured line-by-line from this terminal session. Search-index snippets from those official pages showed the current REST object naming. Treat exact REST create/update payload shape as needing confirmation in the official OpenAPI page or a sandbox before implementation.

## Current Local Contract

PATH currently treats the Intacct integration as a REST-style flow:

| Area | PATH sender | Mock support | Current fidelity posture |
| --- | --- | --- | --- |
| Token | `POST /oauth2/token` | Returns a fixed bearer token | Local-only convenience; not real OAuth validation |
| Vendors | `GET/POST /ia/api/v1/objects/accounts-payable/vendor` | Supports canonical route plus legacy local aliases; DEV can persist vendors in `intacct_mock_vendor` and seed PATH payment `payee_reference` values | Path now matches current official REST object-map evidence, but vendor field fidelity still needs Sage evidence |
| AP bills | `POST /ia/api/v1/objects/accounts-payable/bill` | Creates in-memory bills on canonical route plus legacy local aliases; records PATH packet/case/client/intervention metadata when provided | Path now matches current official REST object-map evidence |
| AP bill get | `GET /ia/api/v1/objects/accounts-payable/bill/:id` | Returns in-memory bill on canonical route plus legacy local aliases | Path now matches current official REST object-map evidence |
| Attachments | `POST /ia/api/v1/objects/accounts-payable/bill/:id/attachments` | No-op accepted stub on canonical route plus legacy local aliases | Route is Sage-style, but exact supporting-document behavior still needs Sage evidence |
| Errors | Expects `{ error: { message, details } }` | Returns `{ error: { code, message, details } }` | Likely response-envelope mismatch |
| Success | Expects `{ data: { id } }` | Returns `{ data: ... }` | Likely response-envelope mismatch |

The mock also serves dashboard-only endpoints under `/mock/api/*`. Those are allowed test conveniences and are not part of the simulated Sage-facing contract.

## Current Sage-Aligned Findings

Strong evidence:

- Sage XML AP bills use the `APBILL` object and bill lines under `APBILLITEMS`.
- Sage XML AP bill create requires, unless creating a draft, vendor, transaction date, due date, and at least one bill line.
- Sage XML AP bill line accounting uses fields such as `ACCOUNTNO` or `ACCOUNTLABEL`, `TRX_AMOUNT`, `ENTRYDESCRIPTION`, `LOCATIONID`, and `DEPARTMENTID`.
- Sage XML vendors use the `VENDOR` object.
- Official REST object-map snippets indicate `APBILL` maps to `accounts-payable/bill` and `VENDOR` maps to `accounts-payable/vendor`.
- Official REST tutorial snippets use a base like `https://api.intacct.com/ia/api/v1` with paths under `/objects/accounts-payable/vendor/...`.
- Official REST response examples/snippets use `ia::result`, `ia::meta`, and `ia::error` envelopes.

Needs confirmation:

- Exact REST create payload for `accounts-payable/bill`.
- Exact REST create payload for `accounts-payable/vendor`.
- Official attachment or supporting-document linkage pattern for REST AP bills versus XML `SUPDOCID`.
- Whether PATH should target REST as the primary production integration path, XML Web Services, or a supported hybrid.

## Known Fidelity Gaps

| Gap | Risk | Current status | Recommended next move |
| --- | --- | --- | --- |
| Mock token endpoint returns a fixed token and only checks for any bearer header. | Medium | Accepted for local only | Add negative auth cases and token-shape validation mode once real auth pattern is confirmed. |
| Mock success/error envelopes use `{ data }` and `{ error }`, not apparent Sage REST `ia::result` and `ia::meta`. | High | Needs fix/evidence | Add Sage-envelope mode to the mock and adapt PATH parsing before sandbox replay. |
| PATH bill payload is simplified snake_case JSON (`vendor_id`, `bill_date`, `due_date`, `gl_account`). | High | Needs fix/evidence | Map PATH domain payloads to documented REST fields or to XML APBILL fields if XML is selected. |
| Legacy local aliases under `/objects/vendors` and `/objects/apbills` remain accepted by the mock and are available as local fallback for PATH when the base URL is localhost. | Low | Accepted mock-only during transition | Remove after canonical route usage has been stable and no local tooling depends on the old paths. |
| One PATH payment packet currently creates one external bill using the first line's vendor. | High | Known design gap | Split external bills by vendor/payee, then by any Sage-required grouping dimensions. |
| Attachments are a no-op stub. | Medium | Needs evidence | Verify Sage attachment/supporting-document API and model rejected, duplicate, and missing-document cases. |
| Vendor create/list is too small. | Medium | Needs evidence | Compare required vendor fields, active/inactive state, term/contact/tax/payment fields, pagination, and duplicate behavior. |
| Query/list behavior lacks Sage pagination, filters, sorting, and error behavior. | Medium | Needs evidence | Add query-service or object-list semantics required by PATH. |
| Idempotency and duplicate invoice behavior are not modeled. | High | Needs design | Decide external ID, bill number, or control-id strategy and simulate duplicate responses. |
| Dashboard lifecycle states are mock-side overlays. | Medium | Accepted mock-only if labeled | Keep dashboard states separate from Sage AP states unless mapped to documented Sage fields. |
| No sandbox replay exists. | High | Open | Build a redacted sandbox canary once credentials and tenant policy are available. |

## Maintenance Model

Keep three layers in sync:

1. Human audit: update this file whenever PATH sender behavior, mock route/payload behavior, Sage documentation evidence, or sandbox evidence changes.
2. Static drift guard: update `docs/data/integrations/intacct-interface-fidelity-manifest.json` whenever the local contract intentionally changes, then run `npm run audit:intacct-contract`.
3. Runtime evidence: add focused mock smokes and, when available, Sage sandbox replay tests for the same scenarios.

Every known divergence should be classified as one of:

- `target-fidelity`: behavior we intend to make match Sage.
- `accepted-mock-only`: local-only behavior that must remain clearly outside the Sage-facing contract.
- `needs-sage-evidence`: behavior we should not cement until official docs or sandbox evidence confirms it.

Definition of done for future Intacct mock fidelity changes:

- The PATH sender and mock pass `npm run audit:intacct-contract`.
- New or changed behavior is covered by a focused local mock smoke or unit test.
- This audit is updated with any changed evidence, gap status, or explicit mock-only exception.
- If the change claims Sage fidelity rather than local compatibility, it cites official Sage docs or sandbox evidence.

## Recommended Next Implementation Slice

1. Add a Sage-envelope response mode in the mock and update PATH parsing to accept `ia::result`/`ia::meta` first while retaining local envelope parsing during transition.
2. Refactor bill creation so one packet can produce multiple external bills grouped by vendor/payee and any confirmed Sage grouping dimensions.
3. Confirm exact REST create payload fields for `accounts-payable/bill` and `accounts-payable/vendor` against the official OpenAPI reference or sandbox evidence.
4. Verify Sage attachment/supporting-document behavior and replace the no-op attachment stub with a faithful simulation.
5. Add sandbox replay fixtures once a Sage Intacct sandbox tenant is available.

## Implementation Progress

- 2026-06-15: Canonical Sage-style REST object paths became primary for PATH and the mock:
  - `/ia/api/v1/objects/accounts-payable/vendor`
  - `/ia/api/v1/objects/accounts-payable/bill`
  - legacy local aliases remain available in the mock and as local-only PATH fallback for 404/405 responses.
- 2026-06-15: PATH server-side Intacct HTTP calls now use the local Node runtime's built-in `fetch` wrapper with timeout handling, removing a DEV runtime failure when `node-fetch` is not installed. This is an operational sender fix, not a Sage-fidelity change.
- 2026-06-15: DEV mock startup now fills missing `DB_*` settings from the sibling admin `.env`, creates/uses `intacct_mock_vendor`, and seeds static vendors plus PATH payment-line `payee_reference` values by default. This removes local fixture drift such as `vendor_id does not exist` for valid PATH payment packets; exact Sage vendor create/list field fidelity remains a separate open gap.
- 2026-06-15: PATH AP bill payloads now include packet/case/client/intervention/source metadata for mock traceability and derive bill currency from packet lines before falling back to `CAD`. This improves local integration observability without resolving the larger Sage REST payload-shape gap.
