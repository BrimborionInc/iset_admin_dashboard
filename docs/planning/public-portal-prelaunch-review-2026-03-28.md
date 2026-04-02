# Public Portal Prelaunch Review And Rich HTML Regression Handoff

Purpose: capture the durable findings and fixes from the 2026-03-28/2026-03-29 Codex thread that reviewed the public portal for launch readiness and investigated the flattened Client Funding Agreement render bug.

This note is not the production hostname cutover thread for `https://iset.nwac.ca`. That separate topic is indexed under `Prod portal hostname cutover`.

## Scope covered in the thread

- Production-aware 360 review of the public portal in `../ISET-intake`, with emphasis on privacy, security, and launch blockers.
- Follow-up discussion of critical findings one at a time.
- Fixes applied in the sibling public-portal repo for two confirmed security issues plus raw intake-payload logging.
- Investigation and fix for a regression where workflow-authored HTML in digital forms was being flattened into plain text in the portal.
- DEV DB inspection of the `EFT & Wire Transfer Direct Debit` workflow to confirm step/routing structure.
- Triage of a MinIO storage error message to determine whether it represented disk exhaustion or a service outage.

## Durable findings

### 1. Raw intake payloads were being copied into server logs

- The intended design was server-side draft persistence for dynamic intake data, not browser-local durable storage.
- The issue was not draft persistence itself. The problem was extra `console.log(...)` calls in `../ISET-intake/server.js` writing raw applicant patch payloads to runtime logs after save.
- Fix applied in `../ISET-intake/server.js`:
  - default to metadata-only dynamic-intake save logging
  - gate raw payload logging behind `LOG_SENSITIVE_INTAKE_PAYLOADS=true`
  - ignore that flag when `NODE_ENV=production`

### 2. Applicant messaging trusted caller-supplied target IDs

- Pre-fix behavior allowed applicant message send paths to trust `recipient_id` and, in one path, `case_id` / `application_id`.
- Fix applied in `../ISET-intake/server.js`:
  - resolve recipient/case/application server-side from the applicant's current messaging context
  - require replies to map to a message the applicant owns and that still resolves to the assigned case manager

### 3. Upload deletion lacked ownership checks

- Pre-fix behavior allowed deletion based on a known file path/key without confirming ownership.
- Fix applied in `../ISET-intake/server.js`:
  - resolve the file against applicant-owned rows first
  - only delete objects/rows when the authenticated applicant owns the file

### 4. Funding Agreement / digital-form HTML render regression

- DEV DB inspection showed the stored `signing_request.resolved_schema_json` for the affected CFA still contained the expected authored HTML, including full structural markup and inline styles.
- Root cause was the recent sanitizer path added in the public-portal renderer:
  - `../ISET-intake/src/utils/sanitizeRichTextHtml.js` allowed only a tiny tag subset
  - `../ISET-intake/src/renderer/renderers.js` passed workflow-authored HTML through that sanitizer before `dangerouslySetInnerHTML`
- Result: tags such as `div`, `table`, `thead`, `tbody`, `tr`, `td`, `span`, and `style` were stripped, flattening the CFA into plain text.
- Fix applied in `../ISET-intake/src/renderer/renderers.js`:
  - restore direct raw HTML rendering for authored dynamic-form content in the shared renderer path
  - this was the explicit launch-mode decision for digital forms and dynamic intake

### 5. EFT workflow inspection

- DEV DB workflow located:
  - `workflow.id = 43`
  - `name = EFT & Wire Transfer Direct Debit`
  - `status = draft`
  - `workflow_type = consent-no-prefill`
  - `document_type = EFT_form`
- Branching structure confirmed:
  - step `133` -> step `134`
  - step `134` branches on `eft-or-wire`
  - `eft` -> step `135`
  - `wire-transfer` -> step `136`
  - both continue to step `138`, then step `137`
- Important intent confirmed by user:
  - step `139` (`Vendor EFT - Offical Use Only`) is intentionally attached to the workflow for PDF/generated output and is not meant to be reachable in the participant flow

### 6. MinIO storage error interpretation

- Investigated the error:
  - `Storage resources are insufficient for the write operation .minio.sys/buckets/.bloomcycle.bin`
- Findings during the thread:
  - drive `X:` still had ample free space
  - MinIO was running and listening on port `9000`
  - Windows-side health checks returned `200` for `/minio/health/live` and `/minio/health/ready`
- Working interpretation:
  - transient storage/I/O hiccup during MinIO background scanner work
  - not evidence of actual disk exhaustion and not a persistent service outage at the time checked

## Remaining launch-review context from the thread

These were discussed as still-open launch items rather than fully resolved in that chat:

- Upload malware scanning remained a stub and should not be treated as a finished control.
- Public AI help chat privacy needed policy confirmation before launch.
- Production object-storage configuration still needed verification against the real prod runtime.

## High-value paths

- Public portal backend/runtime: `../ISET-intake/server.js`
- Public portal shared renderer: `../ISET-intake/src/renderer/renderers.js`
- Public portal HTML sanitizer introduced by the security patch: `../ISET-intake/src/utils/sanitizeRichTextHtml.js`
- Public portal signing-request detail page: `../ISET-intake/src/pages/DocumentDetail.js`
- Context entry for the separate production hostname/domain thread: `docs/meta/codex-thread-index.md` -> `Prod portal hostname cutover`
