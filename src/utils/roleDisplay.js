// UI-friendly role labels without changing canonical role keys used for RBAC
export const ROLE_DISPLAY_MAP = Object.freeze({
  SysAdmin: 'System Admin',
  'System Administrator': 'System Admin',
  'System Admin': 'System Admin',
  ProgramAdmin: 'Program Admin',
  'Program Administrator': 'Program Admin',
  'Program Admin': 'Program Admin',
  RegionalCoordinator: 'Regional Manager',
  'Regional Coordinator': 'Regional Manager',
  'Regional Manager': 'Regional Manager',
  Adjudicator: 'ISET Coordinator',
  Assessor: 'ISET Coordinator',
  ApplicationAssessor: 'ISET Coordinator',
  'Application Assessor': 'ISET Coordinator',
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
