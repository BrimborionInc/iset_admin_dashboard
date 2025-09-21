// Dual-pool Cognito support (staff + applicant). Chooses issuer dynamically and maps groups -> role.
const { createRemoteJWKSet, jwtVerify } = require('jose');

// Env (staff): COGNITO_STAFF_USER_POOL_ID, COGNITO_STAFF_CLIENT_ID
// Env (applicant): COGNITO_APPLICANT_USER_POOL_ID, COGNITO_APPLICANT_CLIENT_ID
// Shared: AWS_REGION, AUTH_PROVIDER=cognito

const region = process.env.AWS_REGION || process.env.COGNITO_REGION || '';
function buildIssuer(poolId) {
  return `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
}

// Build pool registry. Historically only COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID were set.
// We now accept either the specific *STAFF* variables or fall back to the generic ones.
const pools = (() => {
  const staffPool = process.env.COGNITO_STAFF_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID;
  const staffClient = process.env.COGNITO_STAFF_CLIENT_ID || process.env.COGNITO_CLIENT_ID;
  const applicantPool = process.env.COGNITO_APPLICANT_USER_POOL_ID;
  const out = {};
  if (staffPool && staffClient) {
    out[buildIssuer(staffPool)] = {
      type: 'staff',
      poolId: staffPool,
      clientId: staffClient,
      jwks: null
    };
  }
  if (applicantPool) {
    out[buildIssuer(applicantPool)] = {
      type: 'applicant',
      poolId: applicantPool,
      clientId: process.env.COGNITO_APPLICANT_CLIENT_ID,
      jwks: null
    };
  }
  const configuredIssuers = Object.keys(out);
  try {
    // Helpful startup visibility; avoids silent unknown_issuer 401 loops.
    console.log('[authn] configured Cognito issuers:', configuredIssuers.length ? configuredIssuers.join(', ') : 'none');
    if (!process.env.COGNITO_STAFF_USER_POOL_ID && process.env.COGNITO_USER_POOL_ID) {
      console.log('[authn] using fallback generic COGNITO_USER_POOL_ID for staff pool');
    }
  } catch {}
  return out;
})();

function getPoolByIssuer(iss) { return pools[iss]; }

function getJWKSForPool(pool) {
  if (!pool.jwks) {
    const jwksUrl = `${pool.issuer || buildIssuer(pool.poolId)}/.well-known/jwks.json`;
    pool.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }
  return pool.jwks;
}

const groupRoleMap = {
  SysAdmin: 'System Administrator',
  ProgramAdmin: 'Program Administrator',
  RegionalCoordinator: 'Regional Coordinator',
  Assessor: 'Application Assessor'
};

async function verifyAnyPool(token) {
  // Decode header.payload minimally to read issuer
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('malformed');
  let payload; try { payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8')); } catch { throw new Error('badpayload'); }
  const iss = payload.iss;
  const pool = getPoolByIssuer(iss);
  if (!pool) throw new Error('unknown_issuer');
  pool.issuer = iss; // cache
  const clientId = pool.clientId;
  if (!clientId) throw new Error('missing_client_id');
  const { payload: claims } = await jwtVerify(token, getJWKSForPool(pool), { issuer: iss, audience: clientId });
  return { claims, pool };
}

function extractAuthFromClaims(claims, poolType) {
  const groups = Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'] : [];
  let mappedRole;
  if (poolType === 'staff') {
    for (const g of groups) { if (groupRoleMap[g]) { mappedRole = groupRoleMap[g]; break; } }
  }
  const regionId = claims.region_id != null ? Number(claims.region_id) : (claims['custom:region_id'] != null ? Number(claims['custom:region_id']) : null);
  const userId = claims.user_id != null ? String(claims.user_id) : (claims['custom:user_id'] != null ? String(claims['custom:user_id']) : null);
  return {
    sub: String(claims.sub || ''),
    role: mappedRole,
    regionId: Number.isFinite(regionId) ? regionId : null,
    userId: userId || null,
    groups,
    subjectType: poolType === 'staff' ? 'staff' : 'applicant',
    claims
  };
}

function authnMiddleware() {
  const enabled = String(process.env.AUTH_PROVIDER || 'none').toLowerCase() === 'cognito';
  if (!enabled) {
    return (req, _res, next) => { req.auth = null; next(); };
  }
  return async (req, res, next) => {
    try {
      const devBypassOn = (process.env.NODE_ENV !== 'production') && (process.env.DEV_AUTH_BYPASS === '1' || process.env.DEV_AUTH_BYPASS === 'true');
      // Provide sane default for local development to match frontend default token
      const devBypassKey = process.env.DEV_AUTH_TOKEN || 'local-dev-secret';
      const hdrBypass = req.get('x-dev-bypass') || req.get('X-Dev-Bypass') || '';
      if (devBypassOn && devBypassKey && hdrBypass && hdrBypass === devBypassKey) {
        const role = req.get('x-dev-role') || undefined;
        req.auth = { sub: 'dev-bypass-user', role: role ? groupRoleMap[role] || role : undefined, regionId: null, userId: null, groups: role ? [role] : [], subjectType: 'staff', claims: { token_use: 'dev-bypass' } };
        return next();
      }
      const relaxedOpen = (process.env.DEV_AUTH_OPEN === '1' || process.env.DEV_AUTH_RELAXED === '1');
      if (devBypassOn && relaxedOpen) {
        const host = req.get('host') || '';
        if (/localhost|127\.0\.0\.1/i.test(host)) {
          const role = req.get('x-dev-role') || undefined;
            req.auth = { sub: 'dev-open', role: role ? groupRoleMap[role] || role : undefined, regionId: null, userId: null, groups: role ? [role] : [], subjectType: role ? 'staff' : 'applicant', claims: { token_use: 'dev-open' } };
          return next();
        }
      }
      const hdr = req.get('authorization') || req.get('Authorization');
      if (!hdr || !/^Bearer\s+/.test(hdr)) return res.status(401).json({ error: 'Missing bearer token' });
      const token = hdr.replace(/^Bearer\s+/i, '').trim();
      if (!token) return res.status(401).json({ error: 'Empty token' });
      const { claims, pool } = await verifyAnyPool(token);
      req.auth = extractAuthFromClaims(claims, pool.type);
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = { authnMiddleware, extractAuthFromClaims };
