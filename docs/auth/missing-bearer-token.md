# Missing Bearer Token / { error: "Missing bearer/access token" }

Last Updated: 2026-03-24

## Symptom
Some API calls (widgets, dashboards) intermittently fail with 401 JSON payloads such as:
```json
{ "message": "Missing bearer/access token" }
```
The UI widget then shows empty state (e.g., Supporting Documents) although data exists in the database.

## When It Appears
- When a widget uses `fetch()` directly instead of the unified `apiFetch` helper, so no `Authorization: Bearer <id_token>` header is attached.
- During callback/session bootstrap bugs where a protected route or widget fires before the real Cognito session is available.

## Root Causes
1. Pre-IAM code paths using raw `fetch()` omitted auth headers.
2. Early render of a widget before session initialization; direct fetch fired while tokens were still being exchanged or refreshed.
3. Fragmented frontend auth state, where different parts of the app derived session/role/current-user separately.

## Fix Strategy (Implemented / Ongoing)
- Enforce single entry point: all network calls must use `apiFetch` from `src/auth/apiClient.js`.
- Audit widgets to confirm no stray raw `fetch` calls remain.
- Keep frontend auth state centralized so route guards, navigation, and widgets all read the same real Cognito session and current-user context.
- Keep `/auth/callback` shell-less so the full app does not render against partial auth state.

## Current Gaps / TODO
- Provide fallback evaluators source still pending; unrelated but shares access patterns.
- Add deletion propagation for document removal (next doc sync task).

## Verification Checklist
- [ ] SupportingDocumentsWidget network request shows `Authorization` header.
- [ ] No 401 responses for `/api/applicants/:id/documents` after page stabilized (post-initial auth load).
- [ ] `/auth/callback` completes without briefly rendering an auth error state inside the main app shell.

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
- Add a developer toolbar panel listing last 10 API calls and attached auth metadata.
