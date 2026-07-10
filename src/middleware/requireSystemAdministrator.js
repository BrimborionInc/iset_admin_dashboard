function normalizeRole(role) {
  return String(role || '').trim().toLowerCase().replace(/[\s_-]+/gu, '');
}

function isSystemAdministratorRequest(req) {
  const role = req?.auth?.role ?? req?.staffProfile?.primary_role ?? null;
  return normalizeRole(role) === 'systemadministrator';
}

function requireSystemAdministrator(req, res, next) {
  if (!isSystemAdministratorRequest(req)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  return next();
}

module.exports = {
  isSystemAdministratorRequest,
  requireSystemAdministrator,
};
