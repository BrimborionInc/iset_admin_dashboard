# Recurrent Sign-Out After Navigation (Cognito)

## Symptom
After a successful Hosted UI sign-in, navigating to ANY dashboard route immediately reverts the UI to the signed-out state or re-prompts for authentication.

## Observed Behaviors
- Home page Sign In worked (redirect + callback) but subsequent route visit triggered `hasValidSession()` to return false.
- Network showed 401 responses on first protected API call post-navigation.
- Session storage sometimes lacked a stored `authSession` object after redirect on alternate port / origin.

## Root Cause
Redirect URI / origin mismatch and resulting token storage instability:
1. The application is served on `http://localhost:3001` (admin React instance) but prior flows or links occasionally referenced `http://localhost:3000` (public React) or a different origin.
2. Cognito Hosted UI authorization code was issued for the configured `redirect_uri` (`http://localhost:3001/auth/callback`). If the running page origin differed (served from 3000 due to a mistaken link or automatic open), the callback executed under a different origin context.
3. Session persistence logic in `cognito.js` uses `sessionStorage`. Because `sessionStorage` is origin-scoped, any mismatch (e.g., login started on 3001, navigation reopened on 3000) results in missing session data when guarded routes load, triggering forced re-auth.
4. Additional friction: the sign-in button on the landing view previously used a plain reload (now fixed) which occasionally restarted the app without reattaching tokens before guarded route evaluation.

## Contributing Factors
- Multiple local React dev servers (3000 public, 3001 admin) with occasional cross-links.
- Absent dynamic redirect configuration forcing a single canonical origin.
- Guard logic immediately probing `hasValidSession()` before token refresh could execute if tokens were near-expiry.

## Fix Implemented
1. Restored proper Sign In trigger on admin dashboard home:
   - Replaced `window.location.reload()` with `window.location.assign(buildLoginUrl())`.
2. Enabled dynamic redirect origin alignment to reduce accidental origin mismatches:
   - Added to `.env`:
     ```
     REACT_APP_USE_DYNAMIC_REDIRECT=true
     REACT_APP_ALLOW_REDIRECT_ORIGIN_MISMATCH=true
     ```
   These allow the app to regenerate the redirect URI at runtime based on the active origin, ensuring Cognito returns the user to the exact host:port they authenticated from.
3. Verified that `AuthCallback` preserves and restores prior in-app location via state parameter, ensuring fewer manual navigations that could jump across origins.
4. Confirmed no stray `clearSession()` calls aside from deliberate 401-auth-failure handling in `apiClient.js`.

## Additional Hardening Recommendations (Optional / Future)
- Add a single `BASE_PORT` or `ADMIN_APP_BASE_URL` constant and eliminate hard-coded localhost references in any deep links.
- Provide an explicit Sign Out button using `buildLogoutUrl()` and `clearSession()` so users do not rely on manual tab closures (reduces stale refresh token mishaps).
- Implement exponential backoff for transient 401s where `authPending` flag is active to avoid clearing a valid session during race conditions.
- Persist session in `localStorage` (optionally encrypted) if multi-tab continuity is desired.

## Validation Checklist
- [ ] Start app on 3001, sign in, navigate to `/manage-applications` -> remains signed in.
- [ ] Hard refresh on a protected route -> still signed in (token refresh path works).
- [ ] Attempt navigation while token near expiry -> refresh succeeds without sign-out.
- [ ] Switching to 3000 (public app) does NOT carry auth (expected) and returning to 3001 keeps session.

## Rollback Considerations
If issues arise with dynamic redirect handling, revert by removing:
```
REACT_APP_USE_DYNAMIC_REDIRECT=true
REACT_APP_ALLOW_REDIRECT_ORIGIN_MISMATCH=true
```
and ensure all links reference only the configured `REACT_APP_COGNITO_REDIRECT_URI` origin.

## Related Files
- `src/auth/cognito.js`
- `src/auth/apiClient.js`
- `src/pages/adminDashboardHomePage.js`
- `.env`
- `src/routes/AppRoutes.js` (Guard logic)

## Last Updated
2025-09-19
