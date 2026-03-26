// Authorization middleware and helpers for RBAC and regional scoping

function normalizeRole(role) {
  if (!role) return '';
  const trimmed = String(role).trim();
  if (trimmed === 'System_Administrator') return 'SystemAdministrator';
  if (trimmed === 'NWAC_Administrator') return 'NWACAdministrator';
  if (trimmed === 'Regional_Manager') return 'RegionalManager';
  if (trimmed === 'ISET_Coordinator') return 'ISETCoordinator';
  return trimmed.replace(/\s+/g, '');
}

function requireRole(...allowed) {
  return (req, res, next) => {
    const rawRole = req?.auth?.role;
    const role = normalizeRole(rawRole);
    const normAllowed = allowed.map(a => normalizeRole(a));
    if (!role) {
      console.debug('[authz] deny: missing role; allowed=', normAllowed);
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!normAllowed.includes(role)) {
      console.debug('[authz] deny: role', role, 'rawRole=', rawRole, 'not in', normAllowed);
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
