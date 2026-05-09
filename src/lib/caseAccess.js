function normalizePositiveInteger(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

function normalizeRegionIds(regionIds) {
  if (!Array.isArray(regionIds)) return [];
  const normalized = [];
  for (const value of regionIds) {
    const regionId = normalizePositiveInteger(value);
    if (regionId !== null && !normalized.includes(regionId)) {
      normalized.push(regionId);
    }
  }
  return normalized;
}

function normalizeRole(role) {
  if (!role) return '';
  const compact = String(role).trim().replace(/[\s-]+/g, '_');
  if (compact === 'System_Administrator') return 'System Administrator';
  if (compact === 'NWAC_Administrator') return 'NWAC Administrator';
  if (compact === 'Regional_Manager') return 'Regional Manager';
  if (compact === 'ISET_Coordinator') return 'ISET Coordinator';
  return String(role).trim();
}

function normalizeSqlAlias(alias, fallback) {
  const value = typeof alias === 'string' ? alias.trim() : '';
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return value;
  return fallback;
}

function resolveAssignedStaffProfileId(caseRow) {
  return (
    normalizePositiveInteger(caseRow?.assigned_staff_profile_id) ||
    normalizePositiveInteger(caseRow?.assigned_to_user_id)
  );
}

function evaluateRegionalManagerCaseAccess({ requesterId = null, regionIds = [], caseRow = null } = {}) {
  const assignedStaffProfileId = resolveAssignedStaffProfileId(caseRow);
  const normalizedRequesterId = normalizePositiveInteger(requesterId);

  if (
    normalizedRequesterId !== null &&
    assignedStaffProfileId !== null &&
    normalizedRequesterId === assignedStaffProfileId
  ) {
    return { allowed: true, reason: 'direct_assignment' };
  }

  const normalizedRegionIds = normalizeRegionIds(regionIds);
  if (!normalizedRegionIds.length) {
    return { allowed: false, detail: 'region_scope_missing' };
  }

  if (assignedStaffProfileId === null) {
    return { allowed: true, reason: 'unassigned' };
  }

  const portfolioRegionId = normalizePositiveInteger(caseRow?.portfolio_region_id);
  if (portfolioRegionId !== null && normalizedRegionIds.includes(portfolioRegionId)) {
    return { allowed: true, reason: 'portfolio_region' };
  }

  const ownerRegionId = normalizePositiveInteger(caseRow?.owner_region_id);
  if (ownerRegionId !== null && normalizedRegionIds.includes(ownerRegionId)) {
    return { allowed: true, reason: 'owner_region' };
  }

  return { allowed: false, detail: 'region_scope_mismatch' };
}

function evaluateCaseAccess({ role = null, requesterId = null, regionIds = [], caseRow = null } = {}) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'System Administrator' || normalizedRole === 'NWAC Administrator') {
    return { allowed: true, reason: 'admin_scope' };
  }

  if (normalizedRole === 'Regional Manager') {
    return evaluateRegionalManagerCaseAccess({ requesterId, regionIds, caseRow });
  }

  if (normalizedRole === 'ISET Coordinator') {
    const assignedStaffProfileId = resolveAssignedStaffProfileId(caseRow);
    const normalizedRequesterId = normalizePositiveInteger(requesterId);
    if (normalizedRequesterId === null) {
      return { allowed: false, detail: 'assessor_scope_missing' };
    }
    if (assignedStaffProfileId !== null && assignedStaffProfileId === normalizedRequesterId) {
      return { allowed: true, reason: 'direct_assignment' };
    }
    return { allowed: false, detail: 'assessor_scope_mismatch' };
  }

  return { allowed: false, detail: 'role_not_allowed' };
}

function getRegionalManagerCaseAccessError(args = {}) {
  const result = evaluateRegionalManagerCaseAccess(args);
  if (result.allowed) return null;
  return {
    status: 403,
    body: {
      error: 'forbidden',
      detail: result.detail || 'region_scope_mismatch',
    },
  };
}

function getCaseAccessError(args = {}) {
  const result = evaluateCaseAccess(args);
  if (result.allowed) return null;
  return {
    status: 403,
    body: {
      error: 'forbidden',
      detail: result.detail || 'case_scope_mismatch',
    },
  };
}

function buildRegionalManagerCaseAccessSql({
  requesterId = null,
  regionIds = [],
  caseAlias = 'c',
  ownerAlias = 'sp',
} = {}) {
  const c = normalizeSqlAlias(caseAlias, 'c');
  const owner = normalizeSqlAlias(ownerAlias, 'sp');
  const normalizedRequesterId = normalizePositiveInteger(requesterId);
  const normalizedRegionIds = normalizeRegionIds(regionIds);
  const conditions = [];
  const params = [];

  if (normalizedRequesterId !== null) {
    conditions.push(`${c}.assigned_staff_profile_id = ?`);
    params.push(normalizedRequesterId);
  }

  if (normalizedRegionIds.length) {
    conditions.push(`${c}.assigned_staff_profile_id IS NULL`);
    const placeholders = normalizedRegionIds.map(() => '?').join(',');
    conditions.push(`${c}.portfolio_region_id IN (${placeholders})`);
    params.push(...normalizedRegionIds);
    conditions.push(`${owner}.region_id IN (${placeholders})`);
    params.push(...normalizedRegionIds);
  }

  if (!conditions.length) return null;
  return {
    clause: `(${conditions.join(' OR ')})`,
    params,
  };
}

module.exports = {
  buildRegionalManagerCaseAccessSql,
  evaluateCaseAccess,
  evaluateRegionalManagerCaseAccess,
  getCaseAccessError,
  getRegionalManagerCaseAccessError,
  resolveAssignedStaffProfileId,
};
