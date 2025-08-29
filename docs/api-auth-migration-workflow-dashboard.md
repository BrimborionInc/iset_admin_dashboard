# API Auth Migration (Workflow Dashboard) – Knowledge Base

## Purpose
Document the recurring "Missing bearer token" error encountered when legacy, unauthenticated API calls (raw `axios` / `fetch`) are used in the admin workflow dashboard after Cognito / dev-bypass authentication was introduced.

Use this as the single reference for:
1. Understanding why the error occurs.
2. Identifying non‑compliant calls.
3. Migrating code to the standardized authenticated request helper (`apiFetch`).
4. Validating the fix and avoiding regressions.

## Background
The admin app now enforces authentication on API routes (except a small set of public/health endpoints). A utility `apiFetch` (in `src/auth/apiClient.js`) injects either:
- A Cognito ID token (`Authorization: Bearer <token>`), or
- Dev bypass headers (`X-Dev-*`) plus the token if available.

Legacy code paths used direct `axios` or `fetch` calls without appending Authorization headers, triggering the server's auth middleware to respond with:
```
HTTP 401
{"error":"Missing bearer token"}
```

## Typical Symptoms
| Symptom | Detail |
|---------|--------|
| Red alert: "Publish failed." | Workflow publish POST `/api/workflows/:id/publish` returns 401. |
| Network tab: 401 + JSON {"error":"Missing bearer token"} | Confirms missing Authorization header. |
| Works in preview widget but not publish/save | Preview already migrated; properties widget still legacy. |

## Root Cause Pattern
Component still imports and uses `axios` (or raw `fetch`) directly instead of `apiFetch`.

## Remediation Pattern
1. Remove `import axios from 'axios'` (or raw fetch usage) in the affected module.
2. Add: `import { apiFetch } from '../auth/apiClient';`
3. Replace call:
   - `axios.get(url)` → `apiFetch(path)` then `await resp.json()` if `resp.ok`.
   - `axios.post(url, body)` → `apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })`.
   - `axios.put(url, body)` similarly with `method: 'PUT'`.
4. Check `resp.ok`; on failure surface an error alert.
5. (Optional) Keep a small helper to DRY response parsing if repeated.

## Example Migration (Publish)
Before:
```js
const { data } = await axios.post(`${API_BASE}/api/workflows/${workflow.id}/publish`);
setAlert({ type: 'success', text: `Published (${data.steps} steps).` });
```
After:
```js
const resp = await apiFetch(`/api/workflows/${workflow.id}/publish`, { method: 'POST' });
if (!resp.ok) throw new Error('Publish failed');
const data = await resp.json();
setAlert({ type: 'success', text: `Published (${data.steps} steps).` });
```

## Locations Already Updated
| File | Status |
|------|--------|
| `src/widgets/WorkflowRuntimeSchemaWidget.js` | Uses `apiFetch` for preview. |
| `src/widgets/WorkflowPropertiesWidget.js` | Migrated (publish & save). |

## Verification Steps
1. Trigger the action (e.g., Publish workflow).
2. Inspect network request headers: confirm `Authorization: Bearer ...` present OR `X-Dev-Bypass` headers in dev mode.
3. Response should be 200; UI shows success alert.
4. No 401 errors in browser console.

## Detection / Auditing
Run a code search for suspicious patterns:
```
grep -R "axios" src/
grep -R "fetch(" src/ | grep -v apiClient
```
All workflow dashboard API calls should route through `apiFetch`. Acceptable exceptions: static asset loads, purely client-side transforms, or 3rd party endpoints (rare here).

## Edge Cases
| Case | Handling |
|------|----------|
| Simulated signed out (dev toggle) | `apiFetch` returns 401 `simulated-unauthenticated`; UI should redirect or surface sign-in prompt. |
| Expired token | `apiFetch` attempts `ensureFreshSession()`, then re-login if needed. |
| Dev bypass off & no session | User redirected to hosted login (buildLoginUrl). |

## Common Mistakes
| Mistake | Impact | Fix |
|---------|--------|-----|
| Forgetting `Content-Type: application/json` on POST/PUT | Server may treat body as empty | Add header + `JSON.stringify(body)` |
| Calling `resp.json()` without checking `resp.ok` | Throws or misleads UI | Guard with `if (!resp.ok)` branch |
| Mixing axios + fetch in same file | Confusing auth path | Standardize on `apiFetch` |

## Quick Checklist for New API Code
1. Import `apiFetch`.
2. Relative path (`/api/...`) only; let helper prepend base.
3. Provide method + headers for mutating requests.
4. Check `resp.ok`; parse JSON once.
5. Gracefully handle 401/403 (optional alert or trigger login flow event).

## Sample Utility (Optional DRY)
```js
async function fetchJson(path, opts) {
  const resp = await apiFetch(path, opts);
  if (!resp.ok) throw new Error(`${opts?.method || 'GET'} ${path} failed: ${resp.status}`);
  return resp.json();
}
```

## Future Enhancements
- ESLint rule to ban raw `fetch` / `axios` imports under `src/widgets/`.
- Central error handler to map status codes to localized messages.
- Telemetry: count 401 origins to catch regressions early.

## FAQ
Q: Why not keep axios?  
A: `apiFetch` centralizes auth token + bypass headers; mixing abstractions risks drift and repeated auth bugs.

Q: How to test without Cognito?  
A: Enable dev bypass (sessionStorage flags) so `apiFetch` injects `X-Dev-*` headers; server must run with dev bypass enabled.

---
Maintained as of: 2025-08-29
Owner: Platform / Auth integration maintainers
