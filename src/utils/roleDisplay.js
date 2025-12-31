// UI-friendly role labels without changing canonical role keys used for RBAC
export const ROLE_DISPLAY_MAP = Object.freeze({
  SysAdmin: 'System Administrator',
  System_Administrator: 'System Administrator',
  'System Administrator': 'System Administrator',
  'System Admin': 'System Administrator',
  ProgramAdmin: 'NWAC Administrator',
  NWAC_Administrator: 'NWAC Administrator',
  'Program Administrator': 'NWAC Administrator',
  'Program Admin': 'NWAC Administrator',
  RegionalCoordinator: 'Regional Manager',
  Regional_Manager: 'Regional Manager',
  'Regional Coordinator': 'Regional Manager',
  'Regional Manager': 'Regional Manager',
  Adjudicator: 'ISET Coordinator',
  ISET_Coordinator: 'ISET Coordinator',
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
