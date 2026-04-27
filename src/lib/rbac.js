// RBAC policy helpers

const Roles = Object.freeze({
  SystemAdministrator: 'System Administrator',
  NWACAdministrator: 'NWAC Administrator',
  RegionalManager: 'Regional Manager',
  ISETCoordinator: 'ISET Coordinator',
});

function normalizeRoleKey(role) {
  if (!role) return '';
  return String(role).toLowerCase().replace(/[\s_-]+/g, '');
}

function canAccessAll(auth) {
  const key = normalizeRoleKey(auth?.role);
  return key === 'systemadministrator' || key === 'nwacadministrator';
}

function isRegionalManagerRole(role) {
  const key = normalizeRoleKey(role);
  return key === 'regionalmanager';
}

function isIsetCoordinatorRole(role) {
  const key = normalizeRoleKey(role);
  return key === 'isetcoordinator';
}

function isRegionScoped(auth) {
  return isRegionalManagerRole(auth?.role) || isIsetCoordinatorRole(auth?.role);
}

function normalizeRegionIds(auth) {
  const raw = Array.isArray(auth?.regionIds) ? auth.regionIds : [];
  const list = raw.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
  if (list.length) return Array.from(new Set(list));
  const single = Number(auth?.regionId);
  if (Number.isInteger(single) && single > 0) return [single];
  return [];
}

function scopePredicate(tableAlias, auth, regionColumn = 'region_id') {
  if (canAccessAll(auth)) return { sql: '1=1', params: [] };
  if (!isRegionScoped(auth)) return { sql: '0=1', params: [] };
  const regionIds = normalizeRegionIds(auth);
  if (!regionIds.length) return { sql: '0=1', params: [] };
  if (isRegionalManagerRole(auth?.role)) {
    if (regionIds.length === 1) {
      return { sql: `${tableAlias}.${regionColumn} = ?`, params: [regionIds[0]] };
    }
    return { sql: `${tableAlias}.${regionColumn} IN (${regionIds.map(() => '?').join(',')})`, params: regionIds };
  }
  if (isIsetCoordinatorRole(auth?.role)) {
    // Coordinator assignment is stored as a staff_profiles.id, not a shared user-table id.
    const staffProfileId = Number(auth?.staffProfileId ?? auth?.userId) || -1;
    return {
      sql: `${tableAlias}.${regionColumn} = ? AND COALESCE(${tableAlias}.assigned_staff_profile_id, ${tableAlias}.assigned_to_user_id) = ?`,
      params: [regionIds[0], staffProfileId],
    };
  }
  return { sql: '0=1', params: [] };
}

module.exports = { Roles, canAccessAll, isRegionScoped, scopePredicate };
