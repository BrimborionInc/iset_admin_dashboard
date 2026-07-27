const DENIED_APPLICATION_STATUSES = new Set([
  'rejected',
  'declined',
  'denied',
  'ineligible',
  'withdrawn',
  'cancelled',
  'canceled',
  'not_complete',
  'not_completed',
  'nc',
]);

const APPROVED_APPLICATION_STATUSES = new Set([
  'approved',
  'completed',
  'complete',
]);

const FUNDING_ELIGIBLE_INTERVENTION_STATUSES = new Set([
  'approved',
  'in_progress',
  'suspended',
  'completed',
]);

const normalizeStatus = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const isExplicitManualReportingRecord = ({
  metadata = {},
  payload = {},
  actionPlanMetadata = {},
} = {}) => {
  const source = normalizeStatus(
    metadata?.source ??
    payload?.source ??
    actionPlanMetadata?.source
  );
  const entryMode = normalizeStatus(
    metadata?.entryMode ??
    metadata?.entry_mode ??
    payload?.entryMode ??
    payload?.entry_mode ??
    actionPlanMetadata?.entryMode ??
    actionPlanMetadata?.entry_mode
  );
  const backloadMode =
    metadata?.backloadMode ??
    metadata?.backload_mode ??
    payload?.backloadMode ??
    payload?.backload_mode ??
    actionPlanMetadata?.backloadMode ??
    actionPlanMetadata?.backload_mode;
  return (
    source === 'manual_backload' ||
    entryMode === 'existing' ||
    backloadMode === true ||
    normalizeStatus(backloadMode) === 'true'
  );
};

const toPositiveInteger = value => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const resolveReportingApplicationLineage = ({
  actionPlanApplicationId,
  proposalApplicationId,
  esdcApplicationId,
  uniquePlanProposalApplicationId,
  planProposalApplicationCount,
} = {}) => {
  const sources = [];
  const addCandidate = (source, value) => {
    const applicationId = toPositiveInteger(value);
    if (applicationId) sources.push({ source, applicationId });
  };

  addCandidate('action_plan', actionPlanApplicationId);
  addCandidate('intervention_proposal', proposalApplicationId);
  addCandidate('esdc_submission', esdcApplicationId);
  if (Number(planProposalApplicationCount) === 1) {
    addCandidate('unique_action_plan_proposal', uniquePlanProposalApplicationId);
  }

  const candidateApplicationIds = Array.from(
    new Set(sources.map(candidate => candidate.applicationId))
  );
  return {
    applicationId: candidateApplicationIds.length === 1
      ? candidateApplicationIds[0]
      : null,
    sources: sources.map(candidate => candidate.source),
    candidateApplicationIds,
    conflict: candidateApplicationIds.length > 1,
  };
};

const isRegionalSnapshotFundingEligible = ({
  effectiveStatus,
  storedInterventionStatus,
  actionPlanStatus,
  actionPlanArchivedAt,
  sourceInterventionId,
} = {}) => {
  const archived =
    Boolean(actionPlanArchivedAt) ||
    normalizeStatus(storedInterventionStatus) === 'archived' ||
    normalizeStatus(actionPlanStatus) === 'archived';
  const originalDraft =
    normalizeStatus(storedInterventionStatus) === 'draft' &&
    !toPositiveInteger(sourceInterventionId);
  return (
    !archived &&
    (
      originalDraft ||
      FUNDING_ELIGIBLE_INTERVENTION_STATUSES.has(normalizeStatus(effectiveStatus))
    )
  );
};

const toDateOnly = value => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const isDateInRange = (value, start, end) => {
  const date = toDateOnly(value);
  const rangeStart = toDateOnly(start);
  const rangeEnd = toDateOnly(end);
  return Boolean(date && rangeStart && rangeEnd && date >= rangeStart && date <= rangeEnd);
};

const roundCurrency = value => Math.round((Number(value) || 0) * 100) / 100;

const classifyApplicationOutcome = application => {
  const decisionOutcome = normalizeStatus(application?.decisionOutcome ?? application?.decision_outcome);
  const status = normalizeStatus(application?.status);
  if (decisionOutcome === 'denied' || DENIED_APPLICATION_STATUSES.has(status)) {
    return 'denied';
  }
  if (decisionOutcome === 'approved' || APPROVED_APPLICATION_STATUSES.has(status)) {
    return 'approved';
  }
  return 'pending';
};

const resolveApplicationKey = application => {
  const applicationId = Number(application?.id ?? application?.applicationId);
  if (Number.isFinite(applicationId) && applicationId > 0) {
    return `application-${applicationId}`;
  }
  const submissionId = Number(application?.submissionId ?? application?.submission_id);
  if (Number.isFinite(submissionId) && submissionId > 0) {
    return `submission-${submissionId}`;
  }
  return null;
};

const resolveInterventionApplicationId = intervention => {
  const value = Number(intervention?.applicationId ?? intervention?.application_id);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const collectInterventionActivityDates = intervention => {
  const explicitDates = Array.isArray(intervention?.activityDates)
    ? intervention.activityDates.map(toDateOnly).filter(Boolean)
    : [];
  if (explicitDates.length) return explicitDates;
  const startDate = toDateOnly(intervention?.startDate ?? intervention?.start_date);
  return startDate ? [startDate] : [];
};

const issueAppliesToPeriod = (issue, periodStart, periodEnd) => {
  if (issue?.includeInEveryPeriod) return true;
  const dates = [
    issue?.reportingDate,
    issue?.fallbackDate,
    issue?.interventionStartDate,
  ].filter(Boolean);
  if (!dates.length) return true;
  return dates.some(date => isDateInRange(date, periodStart, periodEnd));
};

function calculateRegionalSnapshotMetrics({
  applications = [],
  interventions = [],
  periodStart,
  periodEnd,
  dataQualityIssues = [],
  includeAuditDetails = false,
} = {}) {
  const applicationById = new Map();
  applications.forEach(application => {
    const id = Number(application?.id ?? application?.applicationId);
    if (Number.isFinite(id) && id > 0) {
      applicationById.set(id, application);
    }
  });

  const interventionsByApplicationId = new Map();
  interventions.forEach(intervention => {
    const applicationId = resolveInterventionApplicationId(intervention);
    if (!applicationId || !applicationById.has(applicationId)) return;
    const current = interventionsByApplicationId.get(applicationId) || [];
    current.push(intervention);
    interventionsByApplicationId.set(applicationId, current);
  });

  const receivedKeys = new Set();
  const approvedKeys = new Set();
  const deniedKeys = new Set();
  const pendingKeys = new Set();
  const countedApplicationAudit = new Map();

  applications.forEach(application => {
    const key = resolveApplicationKey(application);
    if (!key) return;
    const applicationId = Number(application?.id ?? application?.applicationId);
    const linkedInterventions = interventionsByApplicationId.get(applicationId) || [];
    const interventionDates = Array.from(
      new Set(linkedInterventions.flatMap(collectInterventionActivityDates))
    );
    const reportingDates = interventionDates.length
      ? interventionDates
      : [toDateOnly(application?.submittedAt ?? application?.submitted_at)].filter(Boolean);
    if (!reportingDates.some(date => isDateInRange(date, periodStart, periodEnd))) {
      return;
    }

    receivedKeys.add(key);
    const storedOutcome = classifyApplicationOutcome(application);
    const approvedByNewInterventionProposal = linkedInterventions.some(
      intervention => intervention?.approvedNewInterventionProposal === true
    );
    const outcome =
      storedOutcome === 'pending' && approvedByNewInterventionProposal
        ? 'approved'
        : storedOutcome;
    if (outcome === 'approved') approvedKeys.add(key);
    else if (outcome === 'denied') deniedKeys.add(key);
    else pendingKeys.add(key);
    if (includeAuditDetails && Number.isFinite(applicationId) && applicationId > 0) {
      countedApplicationAudit.set(applicationId, {
        application,
        outcome,
        reportingDates: reportingDates
          .filter(date => isDateInRange(date, periodStart, periodEnd))
          .sort(),
      });
    }
  });

  const fundedClientKeys = new Set();
  const applicationFundingAudit = new Map();
  const fundedClientAudit = new Map();
  let crfFundingAmount = 0;
  let eiFundingAmount = 0;
  let fundedInterventionCount = 0;

  interventions.forEach(intervention => {
    const applicationId = resolveInterventionApplicationId(intervention);
    if (!applicationId || !applicationById.has(applicationId)) return;
    const qualifyingOccurrences = (Array.isArray(intervention?.fundingOccurrences)
      ? intervention.fundingOccurrences
      : [])
      .filter(occurrence =>
        Number(occurrence?.amount) > 0 &&
        isDateInRange(occurrence?.date, periodStart, periodEnd)
      );
    if (!qualifyingOccurrences.length) return;

    fundedInterventionCount += 1;
    const clientId = Number(intervention?.clientId ?? intervention?.client_id);
    const clientKey =
      Number.isFinite(clientId) && clientId > 0
        ? `client-${clientId}`
        : `application-${applicationId}`;
    fundedClientKeys.add(clientKey);
    if (includeAuditDetails && !fundedClientAudit.has(clientKey)) {
      fundedClientAudit.set(clientKey, {
        clientId: Number.isFinite(clientId) && clientId > 0 ? clientId : null,
        clientName: applicationById.get(applicationId)?.clientName || '',
        applicationReferences: new Set(),
        caseReferences: new Set(),
        occurrenceCount: 0,
        crfFundingAmount: 0,
        eiFundingAmount: 0,
      });
    }

    qualifyingOccurrences.forEach(occurrence => {
      const amount = Number(occurrence.amount);
      const isEi = String(occurrence?.fundingSource || '').toUpperCase() === 'EI';
      if (isEi) {
        eiFundingAmount += amount;
      } else {
        crfFundingAmount += amount;
      }
      if (includeAuditDetails) {
        const applicationAudit = applicationFundingAudit.get(applicationId) || {
          occurrenceCount: 0,
          crfFundingAmount: 0,
          eiFundingAmount: 0,
        };
        applicationAudit.occurrenceCount += 1;
        if (isEi) applicationAudit.eiFundingAmount += amount;
        else applicationAudit.crfFundingAmount += amount;
        applicationFundingAudit.set(applicationId, applicationAudit);

        const clientAudit = fundedClientAudit.get(clientKey);
        const application = applicationById.get(applicationId);
        clientAudit.occurrenceCount += 1;
        if (isEi) clientAudit.eiFundingAmount += amount;
        else clientAudit.crfFundingAmount += amount;
        if (application?.reference) clientAudit.applicationReferences.add(application.reference);
        if (application?.caseReference) clientAudit.caseReferences.add(application.caseReference);
      }
    });
  });

  const filteredIssues = (Array.isArray(dataQualityIssues) ? dataQualityIssues : [])
    .filter(issue => issueAppliesToPeriod(issue, periodStart, periodEnd));

  const applicationsReceived = receivedKeys.size;
  const fundedApplications = approvedKeys.size;
  const deniedIneligibleWithdrawn = deniedKeys.size;
  const pendingDecision = pendingKeys.size;

  const result = {
    liveMetrics: {
      applicationsReceived,
      funded: fundedApplications,
      fundedApplications,
      deniedIneligibleWithdrawn,
      pendingDecision,
    },
    fundingMetrics: {
      crfFundingAmount: roundCurrency(crfFundingAmount),
      eiFundingAmount: roundCurrency(eiFundingAmount),
      fundedClientCount: fundedClientKeys.size,
      fundedInterventionCount,
    },
    dataQualityIssues: filteredIssues,
  };
  if (includeAuditDetails) {
    result.auditDetails = {
      approvedApplications: Array.from(countedApplicationAudit.entries())
        .filter(([, entry]) => entry.outcome === 'approved')
        .map(([applicationId, entry]) => {
          const funding = applicationFundingAudit.get(applicationId) || {
            occurrenceCount: 0,
            crfFundingAmount: 0,
            eiFundingAmount: 0,
          };
          const crfAmount = roundCurrency(funding.crfFundingAmount);
          const eiAmount = roundCurrency(funding.eiFundingAmount);
          return {
            applicationId,
            applicationReference: entry.application?.reference || `Application ${applicationId}`,
            caseReference: entry.application?.caseReference || '',
            clientId: entry.application?.clientId || null,
            clientName: entry.application?.clientName || '',
            reportingDates: entry.reportingDates,
            fundedClient: funding.occurrenceCount > 0,
            fundingOccurrenceCount: funding.occurrenceCount,
            crfFundingAmount: crfAmount,
            eiFundingAmount: eiAmount,
            totalFundingAmount: roundCurrency(crfAmount + eiAmount),
          };
        })
        .sort((left, right) =>
          String(left.applicationReference).localeCompare(String(right.applicationReference))
        ),
      fundedClients: Array.from(fundedClientAudit.values())
        .map(entry => {
          const crfAmount = roundCurrency(entry.crfFundingAmount);
          const eiAmount = roundCurrency(entry.eiFundingAmount);
          return {
            clientId: entry.clientId,
            clientName: entry.clientName,
            applicationReferences: Array.from(entry.applicationReferences).sort(),
            caseReferences: Array.from(entry.caseReferences).sort(),
            fundingOccurrenceCount: entry.occurrenceCount,
            crfFundingAmount: crfAmount,
            eiFundingAmount: eiAmount,
            totalFundingAmount: roundCurrency(crfAmount + eiAmount),
          };
        })
        .sort((left, right) =>
          String(left.clientName || left.clientId || '').localeCompare(
            String(right.clientName || right.clientId || '')
          )
        ),
    };
  }
  return result;
}

module.exports = {
  calculateRegionalSnapshotMetrics,
  classifyApplicationOutcome,
  isExplicitManualReportingRecord,
  isRegionalSnapshotFundingEligible,
  isDateInRange,
  resolveReportingApplicationLineage,
  toDateOnly,
};
