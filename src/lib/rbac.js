// RBAC policy helpers

const Roles = Object.freeze({
  SysAdmin: 'SysAdmin',
  ProgramAdmin: 'ProgramAdmin',
  RegionalCoordinator: 'RegionalCoordinator',
  Adjudicator: 'Adjudicator',
});

function normalizeRoleKey(role) {
  if (!role) return '';
  return String(role).toLowerCase().replace(/[\s_-]+/g, '');
}

function canAccessAll(auth) {
  const key = normalizeRoleKey(auth?.role);
  return (
    key === 'sysadmin' ||
    key === 'systemadministrator' ||
    key === 'programadmin' ||
    key === 'programadministrator' ||
    key === 'nwacadministrator'
  );
}

function isRegionalCoordinatorRole(role) {
  const key = normalizeRoleKey(role);
  return key === 'regionalcoordinator' || key === 'regionalmanager';
}

function isAssessorRole(role) {
  const key = normalizeRoleKey(role);
  return key === 'adjudicator' || key === 'applicationassessor' || key === 'isetcoordinator';
}

function isRegionScoped(auth) {
  return isRegionalCoordinatorRole(auth?.role) || isAssessorRole(auth?.role);
}

function normalizeRegionIds(auth) {
  const raw = Array.isArray(auth?.regionIds) ? auth.regionIds : [];
  const list = raw.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
  if (list.length) return Array.from(new Set(list));
  const single = Number(auth?.regionId);
  if (Number.isInteger(single) && single > 0) return [single];
  return [];
}

function scopePredicate(tableAlias, auth) {
  if (canAccessAll(auth)) return { sql: '1=1', params: [] };
  if (!isRegionScoped(auth)) return { sql: '0=1', params: [] };
  const regionIds = normalizeRegionIds(auth);
  if (!regionIds.length) return { sql: '0=1', params: [] };
  if (isRegionalCoordinatorRole(auth?.role)) {
    if (regionIds.length === 1) {
      return { sql: `${tableAlias}.region_id = ?`, params: [regionIds[0]] };
    }
    return { sql: `${tableAlias}.region_id IN (${regionIds.map(() => '?').join(',')})`, params: regionIds };
  }
  if (isAssessorRole(auth?.role)) {
    // Both region and assignment constraints (assumes assigned_to_user_id column)
    return { sql: `${tableAlias}.region_id = ? AND ${tableAlias}.assigned_to_user_id = ?`, params: [regionIds[0], Number(auth.userId) || -1] };
  }
  return { sql: '0=1', params: [] };
}

module.exports = { Roles, canAccessAll, isRegionScoped, scopePredicate };
