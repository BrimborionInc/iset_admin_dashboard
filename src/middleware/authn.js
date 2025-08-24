// Authentication middleware for AWS Cognito JWTs (Hosted UI OIDC Code + PKCE)
// Verifies ID/Access token via JWKS and attaches req.auth
const { createRemoteJWKSet, jwtVerify } = require('jose');

// Expected env:
// - AUTH_PROVIDER=cognito|none
// - COGNITO_ISSUER=https://cognito-idp.<region>.amazonaws.com/<userPoolId>
// - COGNITO_JWKS_URL=https://cognito-idp.<region>.amazonaws.com/<userPoolId>/.well-known/jwks.json
// - COGNITO_CLIENT_ID=<app client id>

let jwksCache = null;
function getJWKS() {
  const jwksUrl = process.env.COGNITO_JWKS_URL || '';
  if (!jwksUrl) throw new Error('Missing COGNITO_JWKS_URL');
  if (!jwksCache) jwksCache = createRemoteJWKSet(new URL(jwksUrl));
  return jwksCache;
}

function getIssuer() {
  const iss = process.env.COGNITO_ISSUER || '';
  if (!iss) throw new Error('Missing COGNITO_ISSUER');
  return iss;
}

function getAudience() {
  const aud = process.env.COGNITO_CLIENT_ID || '';
  if (!aud) throw new Error('Missing COGNITO_CLIENT_ID');
  return aud;
}

async function verifyToken(token) {
  const issuer = getIssuer();
  const audience = getAudience();
  const { payload } = await jwtVerify(token, getJWKS(), { issuer, audience });
  return payload;
}

function extractAuthFromClaims(claims) {
  // Prefer custom claims injected by Pre-Token-Gen Lambda
  const role = claims.role || (Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'][0] : undefined);
  const regionId = claims.region_id != null ? Number(claims.region_id) : (claims['custom:region_id'] != null ? Number(claims['custom:region_id']) : null);
  const userId = claims.user_id != null ? String(claims.user_id) : (claims['custom:user_id'] != null ? String(claims['custom:user_id']) : null);
  return {
    sub: String(claims.sub || ''),
    role: role ? String(role) : undefined,
    regionId: Number.isFinite(regionId) ? regionId : null,
    userId: userId || null,
    claims,
  };
}

function authnMiddleware() {
  const enabled = String(process.env.AUTH_PROVIDER || 'none').toLowerCase() === 'cognito';
  if (!enabled) {
    // Dev-only: allow through without auth; DO NOT use in production
    return (req, _res, next) => {
      req.auth = null;
      next();
    };
  }
  return async (req, res, next) => {
    try {
      // Dev bypass: only when explicitly enabled and in development
      const devBypassOn = (process.env.NODE_ENV !== 'production') && (process.env.DEV_AUTH_BYPASS === '1' || process.env.DEV_AUTH_BYPASS === 'true');
      const devBypassKey = process.env.DEV_AUTH_TOKEN || '';
      const hdrBypass = req.get('x-dev-bypass') || req.get('X-Dev-Bypass') || '';
      if (devBypassOn && devBypassKey && hdrBypass && hdrBypass === devBypassKey) {
        const role = req.get('x-dev-role') || req.get('X-Dev-Role') || undefined;
        const regionIdHdr = req.get('x-dev-regionid') || req.get('X-Dev-RegionId') || req.get('x-dev-region-id') || undefined;
        const userIdHdr = req.get('x-dev-userid') || req.get('X-Dev-UserId') || req.get('x-dev-user-id') || undefined;
        const email = req.get('x-dev-email') || undefined;
        const regionId = regionIdHdr != null && regionIdHdr !== '' ? Number(regionIdHdr) : null;
        req.auth = {
          sub: userIdHdr ? String(userIdHdr) : 'dev-bypass-user',
          role: role ? String(role) : undefined,
          regionId: Number.isFinite(regionId) ? regionId : null,
          userId: userIdHdr ? String(userIdHdr) : null,
          claims: {
            token_use: 'dev-bypass',
            email: email || undefined,
            role: role || undefined,
            region_id: Number.isFinite(regionId) ? regionId : undefined,
            user_id: userIdHdr || undefined,
          },
        };
        return next();
      }

      // Relaxed dev bypass: when enabled, allow localhost requests without token
      // Controlled by DEV_AUTH_OPEN=1 (or DEV_AUTH_RELAXED=1) and only effective in non-prod
      const relaxedOpen = (process.env.DEV_AUTH_OPEN === '1' || process.env.DEV_AUTH_RELAXED === '1');
      if (devBypassOn && relaxedOpen) {
        const origin = req.get('origin') || req.get('referer') || '';
        const host = req.get('host') || '';
        const ip = req.ip || req.connection?.remoteAddress || '';
        const isLocal = /localhost|127\.0\.0\.1/i.test(`${origin} ${host}`) || ip === '::1' || ip === '127.0.0.1';
        if (isLocal) {
          const role = req.get('x-dev-role') || req.get('X-Dev-Role') || undefined;
          req.auth = {
            sub: 'dev-open',
            role: role ? String(role) : undefined,
            regionId: null,
            userId: null,
            claims: { token_use: 'dev-open' }
          };
          return next();
        }
      }

      const hdr = req.get('authorization') || req.get('Authorization');
      if (!hdr || !/^Bearer\s+/.test(hdr)) return res.status(401).json({ error: 'Missing bearer token' });
      const token = hdr.replace(/^Bearer\s+/i, '').trim();
      if (!token) return res.status(401).json({ error: 'Empty token' });
      const claims = await verifyToken(token);
      req.auth = extractAuthFromClaims(claims);
      return next();
    } catch (e) {
  return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = { authnMiddleware, extractAuthFromClaims };
