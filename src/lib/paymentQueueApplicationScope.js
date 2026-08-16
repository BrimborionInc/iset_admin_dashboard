function positiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function resolvePaymentPacketApplicationScope(lines = []) {
  const normalizedLines = Array.isArray(lines) ? lines : [];
  const applicationIds = new Set();
  let hasUnscopedLine = false;
  const trackingIdByApplication = new Map();

  normalizedLines.forEach(line => {
    const applicationId = positiveInteger(line?.applicationId ?? line?.application_id);
    if (!applicationId) {
      hasUnscopedLine = true;
      return;
    }
    applicationIds.add(applicationId);
    const trackingId = line?.trackingId ?? line?.tracking_id ?? null;
    if (trackingId) trackingIdByApplication.set(applicationId, trackingId);
  });

  const uniqueApplicationIds = Array.from(applicationIds);
  const applicationId = !hasUnscopedLine && uniqueApplicationIds.length === 1
    ? uniqueApplicationIds[0]
    : null;
  return {
    applicationId,
    trackingId: applicationId ? trackingIdByApplication.get(applicationId) || null : null,
    ambiguous: hasUnscopedLine || uniqueApplicationIds.length > 1,
  };
}

module.exports = { resolvePaymentPacketApplicationScope };
