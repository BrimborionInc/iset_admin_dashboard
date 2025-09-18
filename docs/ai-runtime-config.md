# AI Runtime Configuration (Admin)

Purpose: How admin settings propagate to the public portal.
Audience: Admins, Developers
Last Updated: 2025-09-18

- Admin endpoints (server `isetadminserver.js`):
  - `PATCH /api/config/runtime/ai-model` — sets primary model; persists to `.env` and DB `iset_runtime_config('public','ai.model')`.
  - `PATCH /api/config/runtime/ai-params` — updates temperature, top_p, penalties, max_tokens; persists to `.env` and DB key `('public','ai.params')`.
  - `PATCH /api/config/runtime/ai-fallbacks` — sets ordered fallback models; persists to `.env` and DB key `('public','ai.fallbacks')` as JSON array.
- Public portal consumption: `POST /api/ai-support` reads these values on each request; uses `.env` defaults if DB is empty.
- Validation & safety:
  - Model must be from allowed catalog.
  - Params validated for ranges; empty fields are ignored (no-op).
  - API keys are never stored in DB; only `.env`.
- Troubleshooting:
  - If DB write fails, settings still take effect via `.env` (fallback). Logs show a non-fatal warning.
  - To verify, query: `SELECT scope,k,v FROM iset_runtime_config WHERE scope='public';` in the intake DB.
