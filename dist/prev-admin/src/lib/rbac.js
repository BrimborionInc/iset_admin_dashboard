// RBAC policy helpers

const Roles = Object.freeze({
  SysAdmin: 'SysAdmin',
  ProgramAdmin: 'ProgramAdmin',
  RegionalCoordinator: 'RegionalCoordinator',
  Adjudicator: 'Adjudicator',
});

function canAccessAll(auth) {
  return auth?.role === Roles.SysAdmin || auth?.role === Roles.ProgramAdmin;
}

function isRegionScoped(auth) {
  return auth?.role === Roles.RegionalCoordinator || auth?.role === Roles.Adjudicator;
}

function scopePredicate(tableAlias, auth) {
  if (canAccessAll(auth)) return { sql: '1=1', params: [] };
  if (!isRegionScoped(auth) || !Number.isFinite(auth?.regionId)) return { sql: '0=1', params: [] };
  if (auth.role === Roles.RegionalCoordinator) {
    return { sql: `${tableAlias}.region_id = ?`, params: [auth.regionId] };
  }
  if (auth.role === Roles.Adjudicator) {
    // Both region and assignment constraints (assumes assigned_to_user_id column)
    return { sql: `${tableAlias}.region_id = ? AND ${tableAlias}.assigned_to_user_id = ?`, params: [auth.regionId, Number(auth.userId) || -1] };
  }
  return { sql: '0=1', params: [] };
}

module.exports = { Roles, canAccessAll, isRegionScoped, scopePredicate };
