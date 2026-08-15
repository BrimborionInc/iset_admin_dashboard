const {
  clearCaseLevelReportingContext,
  prepareCaseForNewApplication,
} = require('../caseApplicationLifecycle');

const historicalContext = {
  reportingOnlyDenied: true,
  reportingOnlyDeniedIneligible: true,
  reportingCorrectionAllowed: true,
  excludeFromCaseworkQueues: true,
  reportingTrigger: 'denial',
  reportingSeedSource: 'denied_reporting',
  reportingDeniedAt: '2026-08-01',
  applicationId: 101,
  applicationAnswers: { applicant: 'Historical denial' },
  firstName: 'Historical',
  fundingDecisionReasonCode: 'eligibility_not_met',
  applicationReportingArtifacts: {
    101: {
      reportingTrigger: 'denial',
      reportingSeedSource: 'denied_reporting',
      reportingCorrectionAllowed: true,
    },
  },
  applicationDecisionLetters: {
    101: { decisionLetterSent: true },
  },
};

describe('case lifecycle for another application', () => {
  test('removes obsolete case-wide reporting flags and preserves application history', () => {
    const result = clearCaseLevelReportingContext(historicalContext);

    expect(result.contextChanged).toBe(true);
    expect(result.caseContext).not.toHaveProperty('excludeFromCaseworkQueues');
    expect(result.caseContext).not.toHaveProperty('reportingOnlyDenied');
    expect(result.caseContext).not.toHaveProperty('applicationAnswers');
    expect(result.caseContext).not.toHaveProperty('firstName');
    expect(result.caseContext).not.toHaveProperty('fundingDecisionReasonCode');
    expect(result.caseContext.applicationReportingArtifacts).toEqual(
      historicalContext.applicationReportingArtifacts
    );
    expect(result.caseContext.applicationDecisionLetters).toEqual(
      historicalContext.applicationDecisionLetters
    );
  });

  test('reopens a terminal reporting-only case for the new application', () => {
    const result = prepareCaseForNewApplication({
      status: 'closed',
      lifecycle_status: 'closed',
      case_context_json: JSON.stringify(historicalContext),
    });

    expect(result.shouldReopen).toBe(true);
    expect(result.contextChanged).toBe(true);
  });

  test('does not reset an active case without case-wide reporting flags', () => {
    const result = prepareCaseForNewApplication({
      status: 'active',
      lifecycle_status: 'active',
      case_context_json: JSON.stringify({
        firstName: 'Legacy root snapshot',
        applicationReportingArtifacts: historicalContext.applicationReportingArtifacts,
      }),
    });

    expect(result.shouldReopen).toBe(false);
    expect(result.contextChanged).toBe(true);
    expect(result.caseContext).not.toHaveProperty('firstName');
  });

  test('clears stale reporting exclusion without resetting an already active case', () => {
    const result = prepareCaseForNewApplication({
      status: 'active',
      lifecycle_status: 'active',
      case_context_json: JSON.stringify(historicalContext),
    });

    expect(result.shouldReopen).toBe(false);
    expect(result.contextChanged).toBe(true);
    expect(result.caseContext).not.toHaveProperty('excludeFromCaseworkQueues');
  });
});
