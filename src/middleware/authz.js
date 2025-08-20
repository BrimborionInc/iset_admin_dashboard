// Authorization middleware and helpers for RBAC and regional scoping

function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req?.auth?.role;
    if (!role) return res.status(403).json({ error: 'Forbidden' });
    if (!allowed.includes(role)) return res.status(403).json({ error: 'Forbidden' });
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
