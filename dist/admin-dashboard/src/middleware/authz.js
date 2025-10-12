// Authorization middleware and helpers for RBAC and regional scoping

const AUTH_ENABLED = String(process.env.AUTH_PROVIDER || 'none').trim().toLowerCase() === 'cognito';

function normalizeRole(role) {
  if (!role) return role;
  const trimmed = String(role).trim();
  const compact = trimmed.replace(/\s+/g, '');
  switch (compact) {
    case 'SystemAdministrator': return 'SysAdmin';
    case 'ProgramAdministrator': return 'ProgramAdmin';
    case 'RegionalCoordinator': return 'RegionalCoordinator';
    // Allow already canonical
    case 'SysAdmin':
    case 'ProgramAdmin':
    case 'Adjudicator':
      return compact;
    default:
      return compact; // fallthrough; may still match if allowed list normalized similarly
  }
}

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!AUTH_ENABLED) return next(); // Dev / auth disabled: allow
    const rawRole = req?.auth?.role;
    const role = normalizeRole(rawRole);
    const normAllowed = allowed.map(a => normalizeRole(a));
    if (!role) {
      console.debug('[authz] deny: missing role; allowed=', normAllowed, 'env AUTH_PROVIDER=', process.env.AUTH_PROVIDER);
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!normAllowed.includes(role)) {
      console.debug('[authz] deny: role', role, 'rawRole=', rawRole, 'not in', normAllowed, 'env AUTH_PROVIDER=', process.env.AUTH_PROVIDER);
      return res.status(403).json({ error: 'Forbidden' });
    }
    console.debug('[authz] allow role', role, 'allowed=', normAllowed);
    return next();
  };
}

function scopedAccess(req) {
  const role = req?.auth?.role || null;
  const regionId = req?.auth?.regionId || null;
  const userId = req?.auth?.userId || null;
  return { role, regionId, userId };
}

module.exports = { requireRole, scopedAccess };
