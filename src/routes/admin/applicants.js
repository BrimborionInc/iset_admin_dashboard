// Applicant account lookup routes (Cognito applicant pool + DB user table join)
const express = require('express');
const router = express.Router();

const { requireRole } = require('../../middleware/authz');
const { resolveAwsCredentials } = require('../../lib/awsCredentials');
const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');

const REGION = process.env.AWS_REGION || process.env.COGNITO_REGION;

function parseTrustedPools(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => {
      const [poolIdRaw, clientIdRaw] = token.split(':');
      const poolId = (poolIdRaw || '').trim();
      const clientId = (clientIdRaw || '').trim() || null;
      return poolId ? { poolId, clientId } : null;
    })
    .filter(Boolean);
}

function resolveApplicantPoolId() {
  // In this repo's environment templates, admin-dashboard receives the applicant pool via COGNITO_TRUSTED_POOLS.
  // Example: COGNITO_TRUSTED_POOLS=ca-central-1_<applicantPoolId>:<applicantClientId>
  const trusted = parseTrustedPools(process.env.COGNITO_TRUSTED_POOLS);
  if (!trusted.length) return null;

  // Prefer a pool that's different from the staff/admin pool id when multiple are provided.
  const staffPoolId = process.env.COGNITO_STAFF_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID || null;
  const nonStaff = staffPoolId ? trusted.find(p => p.poolId && p.poolId !== staffPoolId) : null;
  return (nonStaff || trusted[0]).poolId || null;
}

function getClient() {
  const credentials = resolveAwsCredentials();
  const config = { region: REGION };
  if (credentials) config.credentials = credentials;
  return new CognitoIdentityProviderClient(config);
}

function getDbPoolFromRequest(req) {
  const pool = req?.app?.locals?.pool;
  return pool && typeof pool.query === 'function' ? pool : null;
}

function toAttrMap(user) {
  return Object.fromEntries((user?.Attributes || []).map(a => [a.Name, a.Value]));
}

// GET /admin/applicants
// Lists applicant Cognito users that also exist in DB table `user` (matching user.cognito_sub = cognito sub).
// Response: { source, users: [{ userId, email, username, cognitoSub }] }
router.get('/applicants', requireRole('System Administrator'), async (req, res) => {
  try {
    if (!REGION) {
      return res.status(500).json({ error: 'missing_aws_region', message: 'Missing AWS_REGION/COGNITO_REGION' });
    }
    const applicantPoolId = resolveApplicantPoolId();
    if (!applicantPoolId) {
      return res.status(500).json({
        error: 'missing_applicant_pool',
        message: 'Missing COGNITO_TRUSTED_POOLS entry for the applicant pool (required to list applicant accounts).',
      });
    }

    const pool = getDbPoolFromRequest(req);
    if (!pool) {
      return res.status(500).json({ error: 'db_unavailable', message: 'Database pool unavailable (app.locals.pool missing).' });
    }

    const client = getClient();
    const limit = 60;
    const maxUsers = 250;
    const users = [];
    let paginationToken = undefined;

    while (true) {
      const resp = await client.send(new ListUsersCommand({
        UserPoolId: applicantPoolId,
        Limit: limit,
        PaginationToken: paginationToken,
      }));
      for (const u of (resp.Users || [])) {
        users.push(u);
        if (users.length >= maxUsers) break;
      }
      if (users.length >= maxUsers) break;
      paginationToken = resp.PaginationToken;
      if (!paginationToken) break;
    }

    const mapped = users.map(u => {
      const attr = toAttrMap(u);
      const cognitoSub = attr.sub || null;
      const email = attr.email || null;
      return {
        username: u.Username || null,
        email,
        cognitoSub,
      };
    }).filter(u => u.cognitoSub);

    if (!mapped.length) {
      return res.json({ source: 'cognito+db', users: [] });
    }

    const subs = Array.from(new Set(mapped.map(u => u.cognitoSub)));
    const placeholders = subs.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT id, email, cognito_sub
         FROM user
        WHERE cognito_sub IN (${placeholders})`,
      subs
    );
    const bySub = new Map((rows || []).map(r => [String(r.cognito_sub || ''), r]));

    const joined = mapped
      .map(u => {
        const row = bySub.get(String(u.cognitoSub));
        if (!row?.id) return null;
        return {
          userId: Number(row.id),
          email: row.email || u.email || u.username,
          username: u.username,
          cognitoSub: u.cognitoSub,
        };
      })
      .filter(Boolean)
      .sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));

    return res.json({ source: 'cognito+db', users: joined });
  } catch (err) {
    const msg = err?.message || String(err);
    if (/not authorized to perform: cognito-idp:ListUsers/i.test(msg)) {
      return res.status(403).json({
        error: 'cognito_list_users_forbidden',
        message: 'Backend AWS credentials lack permission cognito-idp:ListUsers on the applicant user pool.',
        detail: msg,
      });
    }
    console.warn('[admin-applicants] list failed:', msg);
    return res.status(500).json({ error: 'admin_applicants_failed', message: msg });
  }
});

module.exports = router;
