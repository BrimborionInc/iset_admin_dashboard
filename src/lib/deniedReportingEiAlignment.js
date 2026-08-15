const DENIED_REPORTING_PLAN_SOURCES = new Set([
  'denied_reporting',
  'denied_ineligible_reporting',
]);

function normalizeEiClaimantCode(value) {
  if (value === null || typeof value === 'undefined') return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 3) {
    return String(numeric);
  }

  const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (
    [
      'ei active claim',
      'ei active',
      'ei claimant',
      'employment insurance claimant',
    ].includes(normalized)
  ) {
    return '1';
  }
  if (
    [
      'ei reach back',
      'reach back',
      'reach back / former claimant',
      'former claimant',
      'reach back client',
      'reach back client / former claimant',
      'reach back client/former claimant',
    ].includes(normalized)
  ) {
    return '2';
  }
  if (
    [
      'crf',
      'non insured client',
      'noninsured client',
    ].includes(normalized)
  ) {
    return '3';
  }
  return null;
}

function resolveEiFundingClassification(value) {
  const claimantCode = normalizeEiClaimantCode(value);
  if (!claimantCode) return null;
  return {
    claimantCode,
    fundingStream: claimantCode === '3' ? 'CRF' : 'EI',
  };
}

function normalizeFundingStream(value) {
  if (value === null || typeof value === 'undefined') return null;
  const normalized = String(value).trim().toUpperCase();
  return normalized === 'EI' || normalized === 'CRF' ? normalized : null;
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function parseMetadata(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function firstDefinedValue(...values) {
  return values.find(value => value !== null && typeof value !== 'undefined');
}

function collectDeniedReportingEiAlignmentIssues(context = {}) {
  const plans = (Array.isArray(context.caseActionPlans) ? context.caseActionPlans : [])
    .filter(plan => {
      const metadata = parseMetadata(plan?.metadata ?? plan?.metadata_json);
      return DENIED_REPORTING_PLAN_SOURCES.has(String(metadata.source || '').trim().toLowerCase());
    });
  if (!plans.length) return [];

  const assessmentEligibility = firstDefinedValue(
    context.caseAssessmentRow?.esdc_eligibility,
    context.caseAssessmentRow?.esdcEligibility
  );
  const expected = resolveEiFundingClassification(assessmentEligibility);
  const reportingApplicationId = normalizePositiveInteger(context.applicationId);
  const issues = [];

  plans.forEach(plan => {
    const planId = normalizePositiveInteger(plan?.id ?? plan?.action_plan_id);
    const planApplicationId = normalizePositiveInteger(
      firstDefinedValue(plan?.applicationId, plan?.application_id)
    );
    if (reportingApplicationId && reportingApplicationId !== planApplicationId) {
      issues.push({
        type: 'application_scope_mismatch',
        fieldKey: 'applicationId',
        planId,
        expectedApplicationId: reportingApplicationId,
        actualApplicationId: planApplicationId,
        message: `Denied-reporting Action Plan ${planId || ''} is linked to application ${planApplicationId || 'unset'} instead of reporting application ${reportingApplicationId}.`,
      });
    }

    if (!expected) {
      issues.push({
        type: 'assessment_eligibility_required',
        fieldKey: 'EIClaimant',
        planId,
        assessmentEligibility: assessmentEligibility ?? null,
        message: 'The application assessment must specify CRF, EI Active Claim, or EI Reach Back before its denial can be reported.',
      });
      return;
    }

    const actualClaimantCode = normalizeEiClaimantCode(
      firstDefinedValue(plan?.eiClaimant, plan?.EIClaimant, plan?.ei_claimant)
    );
    if (actualClaimantCode !== expected.claimantCode) {
      issues.push({
        type: 'plan_claimant_mismatch',
        fieldKey: 'EIClaimant',
        planId,
        expectedClaimantCode: expected.claimantCode,
        actualClaimantCode,
        message: `Denied-reporting Action Plan ${planId || ''} must use EI claimant code ${expected.claimantCode} for assessment eligibility ${String(assessmentEligibility).trim()}; found ${actualClaimantCode || 'unset'}.`,
      });
    }

    const storedPlanFundingStream = Object.prototype.hasOwnProperty.call(
      plan || {},
      'storedFundingStream'
    )
      ? plan.storedFundingStream
      : firstDefinedValue(plan?.fundingStream, plan?.funding_stream);
    const actualPlanFundingStream = normalizeFundingStream(storedPlanFundingStream);
    if (actualPlanFundingStream !== expected.fundingStream) {
      issues.push({
        type: 'plan_funding_stream_mismatch',
        fieldKey: 'fundingStream',
        planId,
        expectedFundingStream: expected.fundingStream,
        actualFundingStream: actualPlanFundingStream,
        message: `Denied-reporting Action Plan ${planId || ''} must use funding stream ${expected.fundingStream} for assessment eligibility ${String(assessmentEligibility).trim()}; found ${actualPlanFundingStream || 'unset'}.`,
      });
    }

    (Array.isArray(plan?.interventions) ? plan.interventions : []).forEach(intervention => {
      const interventionId = normalizePositiveInteger(intervention?.id);
      const actualInterventionFundingStream = normalizeFundingStream(
        firstDefinedValue(
          intervention?.fundingStreamDecision,
          intervention?.funding_stream_decision
        )
      );
      if (actualInterventionFundingStream !== expected.fundingStream) {
        issues.push({
          type: 'intervention_funding_stream_mismatch',
          fieldKey: 'fundingStream',
          planId,
          interventionId,
          expectedFundingStream: expected.fundingStream,
          actualFundingStream: actualInterventionFundingStream,
          message: `Intervention ${interventionId || ''} in denied-reporting Action Plan ${planId || ''} must use funding stream ${expected.fundingStream}; found ${actualInterventionFundingStream || 'unset'}.`,
        });
      }
    });
  });

  return issues;
}

module.exports = {
  DENIED_REPORTING_PLAN_SOURCES,
  collectDeniedReportingEiAlignmentIssues,
  normalizeEiClaimantCode,
  normalizeFundingStream,
  resolveEiFundingClassification,
};
