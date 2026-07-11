# AI Runtime Configuration (Admin)

Purpose: How admin settings propagate to the public portal.
Audience: Admins, Developers
Last Updated: 2026-07-11

- Admin endpoints (server `isetadminserver.js`):
  - `PATCH /api/config/runtime/ai-model` — validates and writes primary model to `iset_runtime_config('public','ai.model')`.
  - `PATCH /api/config/runtime/ai-params` — range-validates a partial update, merges it with the current effective values, and writes `('public','ai.params')` without nulling omitted fields.
  - `PATCH /api/config/runtime/ai-fallbacks` — requires an explicit list, validates each model, and writes `('public','ai.fallbacks')` as JSON.
- Admin and portal consumption use `../shared/ai/runtimeConfig.js`. DB values are canonical durable overrides; deployment environment values are bootstrap defaults only when a DB key is absent.
- Validation & safety:
  - Model must be from allowed catalog.
  - Admin chat uses the configured model by default. Only System Administrators may request an override, and that override must pass the same allowlist. Both apps validate configured/fallback models again at use time.
  - Params validated for ranges; empty fields are ignored (no-op).
  - Admin `POST /api/ai/chat` blocks obvious raw applicant/client identifiers, credentials, contact details, and known live-record JSON fields in submitted messages and chat context before proxying to OpenRouter.
  - Admin denial-letter drafts use local templates rather than sending applicant denial context to OpenRouter.
  - AI-backed dummy-data generators require the unsafe debug gate plus System Administrator access and reject sensitive free-text guidance.
  - API keys are never stored in DB; only `.env`.
- Troubleshooting:
  - A DB write failure is a failed configuration save; runtime routes do not rewrite deployed `.env` files or create process-local overrides.
  - Restarting or replacing an instance preserves DB runtime overrides. Changing deployment environment values changes defaults only and does not silently reset existing DB overrides.
  - To verify, query: `SELECT scope,k,v FROM iset_runtime_config WHERE scope='public';` in the intake DB.
