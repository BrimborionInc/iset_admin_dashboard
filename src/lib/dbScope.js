// Helpers to inject mandatory WHERE predicates for RBAC scoping
const { scopePredicate, canAccessAll } = require('./rbac');

// Applications don't have assigned_to_user_id; adjudicators should be scoped by region only
function scopeApplications(auth, alias = 'a') {
  if (canAccessAll(auth)) return { sql: '1=1', params: [] };
  const regionId = Number(auth?.regionId);
  if (!Number.isFinite(regionId)) return { sql: '0=1', params: [] };
  // RC and Adjudicator: region only
  return { sql: `${alias}.region_id = ?`, params: [regionId] };
}

function scopeCases(auth, alias = 'c') {
  return scopePredicate(alias, auth);
}

module.exports = { scopeApplications, scopeCases };
