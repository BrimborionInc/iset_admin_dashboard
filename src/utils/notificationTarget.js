const toPositiveInteger = value => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

export const buildNotificationTargetPath = ({
  caseId,
  applicationId,
  trackingId,
  isCaseManaged = false,
}) => {
  const resolvedApplicationId = toPositiveInteger(applicationId);
  if (caseId && resolvedApplicationId) {
    const params = new URLSearchParams({ applicationId: String(resolvedApplicationId) });
    return `/application-case/${caseId}?${params.toString()}`;
  }
  if (caseId) {
    return isCaseManaged ? `/cases/${caseId}` : `/application-case/${caseId}`;
  }
  return trackingId ? `/application-case/${trackingId}` : null;
};
