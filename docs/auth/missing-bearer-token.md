# Missing Bearer Token / { error: "Missing bearer/access token" }

Last Updated: 2025-09-20

## Symptom
Some API calls (widgets, dashboards) intermittently fail with 401 JSON payloads such as:
```json
{ "message": "Missing bearer/access token" }
```
(or in legacy mode, `{ error: "Missing bearer token" }`). The UI widget then shows empty state (e.g., Supporting Documents) although data exists in the database.

## When It Appears
- After enabling Cognito (IAM) mode, older widgets written before token-aware `apiFetch` were added.
- In legacy (bypass) mode when `iamBypass=off` flag logic is misinterpreted and bypass headers are not sent.
- When a widget uses `fetch()` directly instead of the unified `apiFetch` helper, so no `Authorization: Bearer <id_token>` header or dev bypass headers are attached.

## Root Causes
1. Pre-IAM code paths using raw `fetch()` omitted auth headers.
2. Inconsistent casing of custom dev bypass headers vs server expectations (needed `X-Dev-Bypass`, `X-Dev-Role`, `X-Dev-UserId`).
3. Early render of a widget before session initialization; direct fetch fired while tokens still being refreshed.
4. Conditional logic in `apiClient.js` only attaching bypass headers if `sessionStorage.iamBypass === 'off'` but environment toggles not consistently set via DemoNavigation.

## Fix Strategy (Implemented / Ongoing)
- Enforce single entry point: all network calls must use `apiFetch` from `src/auth/apiClient.js`.
- Audit widgets to confirm no stray raw `fetch` calls remain.
- Ensure `apiFetch` handles BOTH modes:
  - Cognito mode: loads/refreshes session, sets `Authorization: Bearer <idToken>`.
  - Legacy/bypass mode: sets `X-Dev-*` headers; also tries bearer if session present (future-proof).
- Add defensive retry in `apiFetch` if a first 401 occurs within first 1s of app load and `authPending` flag set (planned enhancement).

## Current Gaps / TODO
- Provide fallback evaluators source still pending; unrelated but shares access patterns.
- Add deletion propagation for document removal (next doc sync task).

## Verification Checklist
- [ ] SupportingDocumentsWidget network request shows `Authorization` header (Cognito) OR `X-Dev-Bypass` (legacy bypass).
- [ ] Toggling IAM in DemoNavigation triggers `sessionStorage.setItem('iamBypass', 'off'|'on')` and subsequent requests adapt headers.
- [ ] No 401 responses for `/api/applicants/:id/documents` after page stabilized (post-initial auth load).
- [ ] Legacy mode: server logs show dev bypass accepted, endpoint returns 200.

## Commands (Manual DB Sanity)
```sql
SELECT id, applicant_user_id, file_name, source, status FROM iset_document ORDER BY id DESC LIMIT 10;
```

## Related Files
- `src/auth/apiClient.js`
- `src/widgets/SupportingDocumentsWidget.js`
- `isetadminserver.js` (endpoint definitions)
- `ISET-intake/server.js` (portal finalize dual-write)

## Future Hardening
- Introduce a global Axios-like client with interceptors for token refresh & standardized 401 handling.
- Emit structured error codes (`auth_missing_token`, `auth_expired_token`) from backend to disambiguate.
- Add a developer toolbar panel listing last 10 API calls and attached auth mode.
