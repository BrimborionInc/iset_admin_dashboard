# AI Runtime Configuration (Admin)

Purpose: How admin settings propagate to the public portal.
Audience: Admins, Developers
Last Updated: 2026-04-27

- Admin endpoints (server `isetadminserver.js`):
  - `PATCH /api/config/runtime/ai-model` — sets primary model; persists to `.env` and DB `iset_runtime_config('public','ai.model')`.
  - `PATCH /api/config/runtime/ai-params` — updates temperature, top_p, penalties, max_tokens; persists to `.env` and DB key `('public','ai.params')`.
  - `PATCH /api/config/runtime/ai-fallbacks` — sets ordered fallback models; persists to `.env` and DB key `('public','ai.fallbacks')` as JSON array.
- Public portal consumption: `POST /api/ai-support` reads these values on each request; uses `.env` defaults if DB is empty.
- Validation & safety:
  - Model must be from allowed catalog.
  - Params validated for ranges; empty fields are ignored (no-op).
  - Admin `POST /api/ai/chat` blocks obvious raw applicant/client identifiers, credentials, contact details, and known live-record JSON fields in submitted messages and chat context before proxying to OpenRouter.
  - Admin denial-letter drafts use local templates rather than sending applicant denial context to OpenRouter.
  - AI-backed dummy-data generators require the unsafe debug gate plus System Administrator access and reject sensitive free-text guidance.
  - API keys are never stored in DB; only `.env`.
- Troubleshooting:
  - If DB write fails, settings still take effect via `.env` (fallback). Logs show a non-fatal warning.
  - To verify, query: `SELECT scope,k,v FROM iset_runtime_config WHERE scope='public';` in the intake DB.
