// Helpers to inject mandatory WHERE predicates for RBAC scoping
const { scopePredicate, canAccessAll } = require('./rbac');

function normalizeRegionIds(auth) {
  const raw = Array.isArray(auth?.regionIds) ? auth.regionIds : [];
  const list = raw.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
  if (list.length) return Array.from(new Set(list));
  const single = Number(auth?.regionId);
  if (Number.isInteger(single) && single > 0) return [single];
  return [];
}

// Applications don't have assigned_to_user_id; adjudicators should be scoped by region only
function scopeApplications(auth, alias = 'a') {
  if (canAccessAll(auth)) return { sql: '1=1', params: [] };
  const regionIds = normalizeRegionIds(auth);
  if (!regionIds.length) return { sql: '0=1', params: [] };
  // RC and ISET_Coordinator: region only
  if (regionIds.length === 1) {
    return { sql: `${alias}.region_id = ?`, params: [regionIds[0]] };
  }
  return { sql: `${alias}.region_id IN (${regionIds.map(() => '?').join(',')})`, params: regionIds };
}

function scopeCases(auth, alias = 'c') {
  return scopePredicate(alias, auth, 'portfolio_region_id');
}

module.exports = { scopeApplications, scopeCases };
