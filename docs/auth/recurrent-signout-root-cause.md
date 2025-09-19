# Recurrent Sign-Out After Navigating to Protected Dashboards

## Summary
Users were immediately signed out after visiting protected pages (e.g. Configuration Settings) despite a successful Cognito Hosted UI sign-in. The root cause was a backend pool configuration mismatch: backend middleware expected `COGNITO_STAFF_USER_POOL_ID` / `COGNITO_STAFF_CLIENT_ID`, while only generic `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` were defined. This caused `unknown_issuer` 401 responses, triggering client session clearing.

## Technical Root Cause
`authn.js` builds a registry of acceptable Cognito issuers based solely on the presence of staff/applicant pool specific env variables. Without those, the token's `iss` (e.g. `https://cognito-idp.ca-central-1.amazonaws.com/ca-central-1_inn3R0tte`) had no match, producing a 401 prior to any application logic. The frontend `apiClient.js` interprets 401 (authentication failure) by calling `clearSession()`, giving the appearance of an immediate sign-out.

## Contributing Factors
- Renaming / introduction of dual-pool support without backward compatibility for original env names.
- Lack of startup logging to reveal that zero pools were registered.
- Session clearing on first 401 masks the deeper cause from UI perspective.

## Fix Implemented (Permanent)
1. Added fallback logic in `src/middleware/authn.js` to treat `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` as staff pool if specific staff variables are absent.
2. Added startup logging of configured issuers for diagnostic transparency.
3. Mirrored env variables in `.env`:
   ```
   COGNITO_STAFF_USER_POOL_ID=ca-central-1_inn3R0tte
   COGNITO_STAFF_CLIENT_ID=20kfc4cqdgaql73uiu39snolq8
   ```
4. Left placeholder comments for optional applicant pool to avoid future partial configuration.

## Validation Steps
- Sign in via Hosted UI.
- Open Network tab, navigate to `/configuration-settings`.
- Confirm `/api/config/runtime` returns 200 (not 401).
- Check server logs for `[authn] configured Cognito issuers:` line including the pool issuer.

## Rollback / Contingency
If dual-pool differentiation becomes mandatory, ensure both sets are explicitly present. The fallback can remain—it provides safe backward compatibility.

## Related Files
- `src/middleware/authn.js`
- `.env`
- `src/auth/apiClient.js` (401 handling)
- `docs/auth/signout-on-navigation.md`

## Future Hardening Ideas
- Emit distinct error code `unknown_issuer` in 401 body so frontend can detect configuration issues and avoid clearing a valid session.
- Add health endpoint verifying JWKS reachability at startup.
- Provide an admin UI panel to display recognized issuers & audiences.

## Last Updated
2025-09-19
