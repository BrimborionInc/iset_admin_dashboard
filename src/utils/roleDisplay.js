// UI-friendly role labels without changing canonical role keys used for RBAC
export const ROLE_DISPLAY_MAP = Object.freeze({
  System_Administrator: 'System Administrator',
  'System Administrator': 'System Administrator',
  NWAC_Administrator: 'NWAC Administrator',
  'NWAC Administrator': 'NWAC Administrator',
  Regional_Manager: 'Regional Manager',
  'Regional Manager': 'Regional Manager',
  ISET_Coordinator: 'ISET Coordinator',
  'ISET Coordinator': 'ISET Coordinator'
});

export function getRoleDisplayName(role) {
  if (!role) return '';
  const key = typeof role === 'object' && role !== null
    ? role.value || role.label || role.role || role.name
    : role;
  if (!key) return '';
  const normalized = String(key).trim();
  return ROLE_DISPLAY_MAP[normalized] || normalized;
}
