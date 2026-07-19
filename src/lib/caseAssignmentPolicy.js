const ASSIGN_ROLE_ALLOWLIST = new Set([
  'System Administrator',
  'NWAC Administrator',
  'Regional Manager',
  'System_Administrator',
  'NWAC_Administrator',
  'Regional_Manager',
]);

const ASSIGN_FORBIDDEN_ROLES = new Set([
  'ISET Coordinator',
  'ISET_Coordinator',
]);

function ensureCanAssignCase(identity, targetStaff) {
  const role = identity?.role || '';
  if (ASSIGN_FORBIDDEN_ROLES.has(role) || !ASSIGN_ROLE_ALLOWLIST.has(role)) {
    return false;
  }

  // Assignment targets are staff identities and must remain active. Case access
  // is validated separately before this target-policy check runs.
  if (!targetStaff || targetStaff.status !== 'active') {
    return false;
  }

  // Regional Managers deliberately have the same cross-region target scope as
  // the other assignment-capable roles. Their access to the source case remains
  // governed by the case-access policy.
  return true;
}

module.exports = {
  ensureCanAssignCase,
};
