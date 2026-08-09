export const resolveInterventionApprovalQueueEiStatus = row => {
  const value = row?.interventionEiStatus ?? row?.intervention_ei_status ?? null;
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
};
