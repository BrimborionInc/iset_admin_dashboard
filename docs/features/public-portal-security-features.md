# Public Portal Security Features Catalog

Purpose: Summarize the technical safeguards built into the public intake portal and API.  
Scope: Runtime code under `X:\ISET\ISET-intake` (frontend, backend, shared services).  
Last Updated: 2026-04-27

## Authentication & Session Control
- **RS256 JWT validation** – `server.js:2014-2640` and `src/auth/verifyJwt.js` enforce issuer, audience, and JWKS signature checks, with fallback to trusted pool overrides when multiple Cognito clients are allowed.
- **Suspension-aware user upsert** – `server.js:2324-2484` links Cognito users to local records, blocks suspended accounts, and records last login timestamps; `src/auth/suspensionCache.js` caches suspension state securely.
- **Session auditing** – `server.js:2520-2604` hashes IP and user-agent details into `user_session_audit`, enabling traceability without storing raw personal data.
- **Secure token storage** – Auth callbacks set HttpOnly cookies (`server.js:40-120`, `docs/auth/cognito-vs-legacy.md`) eliminating token exposure to frontend scripts.
- **Dev bypass guardrails** – `server.js:2050-2134` only permits the X-Dev bypass headers on loopback requests when `DEV_BYPASS_ENABLED` is true, reducing accidental production use.

## Access Enforcement
- **Unified API gate** – `server.js:2656-2760` runs all `/api/*` routes through `verifyJwt` except whitelisted auth endpoints and anonymous `/api/me`, preventing accidental exposure of new routes.
- **Role derivation** – Cognito group claims map to portal roles (`server.js:2324-2332`), allowing fine-grained backend authorization policies.
- **Draft/event operations** – Only authenticated users can access intake drafts (`server.js:6560-6700`) and messaging endpoints (`server.js:7562+`), using the same middleware path.

## Data Handling & Privacy
- **Server-side intake state** – Dynamic intake steps keep answers off the client by combining an in-memory cache with a shared database table (`input_json_state`). The table is keyed by `(user_id, session_token)` and automatically prunes via `expires_at` so data exists only during the session (defaults to ~30 minutes). Lifecycle hooks clear both memory and DB entries on logout, save-and-finish-later, successful submission, or session timeout (`server.js:1660-2100`). TTL duration remains configurable via `iset_runtime_config` (`scope='runtime', k='intake.ephemeral_ttl_minutes'`).
- **Aggregate JSON controls** – `/api/intake-json` now persists merge patches to `input_json_state` (`server.js:1719-1905`), ensuring load-balanced instances read the same state without ever exposing history in browser storage.
- **Sensitive env segregation** – Runtime pulls configuration from `.env` with secrets excluded from source control (`docs/ops/env-vars.md`), keeping credentials out of the bundle.
- **Public AI support filtering** - `/api/ai-support` is intentionally public, but validates prompt length, rate limits by client/language, and rejects both the current prompt and recent chat history if they contain obvious sensitive patterns before sending anything to OpenRouter.

## File Upload Protection
- **Policy enforcement** – `uploadPolicy.js` centrally defines size/type limits, and `server.js:7086-7246` enforces them per request, returning explicit error codes.
- **Magic-number sniffing** – `mimeSniff.js` and `server.js:7120-7140` verify file signatures to detect mismatches between extensions and content.
- **Controlled storage** – Multer disk storage sanitizes filenames and limits size to 2 MB (`server.js:7458-7558`), while S3 mode generates normalized keys with UUID prefixes (`s3Provider.js`).
- **Upload auditing** - Each accepted file is logged through the shared event emitter into `iset_event_entry` with status flags (`server.js:7232-7240`), supporting downstream malware scanning workflows.

## Audit & Monitoring
- **Event catalog** – `logCaseEvent` (`server.js:929-946`) annotates activity with consistent messages, and `docs/data/key-tables.md:13-33` describes the audit tables consumed by ops tooling.
- **Notification dispatch** – `server.js:198-246` wires portal events into `shared/events` for internal alerts, ensuring security-relevant actions (submissions, errors) generate notifications.
- **Password reset throttling** – `server.js:4268-4340` adds in-memory caps on reset attempts per user or IP, laying groundwork for distributed rate limiting.

## Deployment & Configuration Safety
- **Migration guardrails** – `migrationRunner.js` runs SQL migrations transactionally, skips duplicate operations, and defends against missing tables, preserving schema integrity during rollout.
- **Prescribed deployment steps** – `deploy.ps1` codifies front-end build, backend file sync, and environment sync, supporting reproducible deployments (pending future CI/CD hardening).
- **Object storage abstraction** – `s3Provider.js` centralizes key generation and presigned URL handling, enabling seamless transition to encryption-aware drivers.

## Messaging & Notifications
- **Secure messaging context** – `server.js:7562-7890` builds message permissions from case state, ensuring applicants can only access their conversations.
- **SES integration** – `sesMailer.js` uses AWS SES with credentials sourced from environment variables, keeping outbound notifications within audited infrastructure.

## Roadmap Highlights
- Add HTTP security headers middleware (e.g., Helmet) and API rate limiting to further align with CCCS SC-7 requirements.
- Expand logging pipelines to centralized monitoring (CloudWatch/SIEM) for tamper-evident audit trails.
- Migrate file uploads to encrypted object storage with retention policies.
