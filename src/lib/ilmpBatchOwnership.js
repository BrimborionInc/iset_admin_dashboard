function positiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function classifyIlmpBatchOwnership(contexts = []) {
  const normalizedContexts = Array.isArray(contexts) ? contexts : [];
  const caseKeys = new Set();
  const applicationKeys = new Set();

  normalizedContexts.forEach(context => {
    const caseId = positiveInteger(context?.caseRow?.id);
    const applicationId = positiveInteger(context?.applicationId);
    caseKeys.add(caseId ? `case:${caseId}` : 'case:none');
    applicationKeys.add(applicationId ? `application:${applicationId}` : 'application:none');
  });

  return {
    compatible:
      normalizedContexts.length > 0 &&
      !caseKeys.has('case:none') &&
      caseKeys.size === 1 &&
      applicationKeys.size === 1,
    caseKeys: Array.from(caseKeys),
    applicationKeys: Array.from(applicationKeys),
  };
}

module.exports = { classifyIlmpBatchOwnership };
