const toPositiveInteger = value => {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

export const buildParticipantWorkspaceHref = item => {
  const caseId = toPositiveInteger(item?.case_id ?? item?.caseId);
  const applicationId = toPositiveInteger(item?.application_id ?? item?.applicationId);
  if (!caseId || !applicationId) return null;
  return `/application-case/${encodeURIComponent(caseId)}?applicationId=${encodeURIComponent(applicationId)}`;
};
