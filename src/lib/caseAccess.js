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

function evaluateRegionalManagerCaseAccess({ requesterId = null, regionIds = [], caseRow = null } = {}) {
  const assignedToUserId = normalizePositiveInteger(caseRow?.assigned_to_user_id);
  const normalizedRequesterId = normalizePositiveInteger(requesterId);

  if (
    normalizedRequesterId !== null &&
    assignedToUserId !== null &&
    normalizedRequesterId === assignedToUserId
  ) {
    return { allowed: true, reason: 'direct_assignment' };
  }

  const normalizedRegionIds = normalizeRegionIds(regionIds);
  if (!normalizedRegionIds.length) {
    return { allowed: false, detail: 'region_scope_missing' };
  }

  if (assignedToUserId === null) {
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

module.exports = {
  evaluateRegionalManagerCaseAccess,
  getRegionalManagerCaseAccessError,
};
