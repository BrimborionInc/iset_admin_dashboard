const {
  PATH_REVIEW,
  buildIlmpIssueMessage,
  collectIlmpIssueMessages,
  getIlmpParticipantFieldContext,
} = require('../ilmpIssueMessages');

describe('ilmpIssueMessages', () => {
  test('builds staff-facing messages with location, ESDC rule, and fix', () => {
    expect(buildIlmpIssueMessage({
      location: 'Action plan "Actions leading to withdrawal"',
      issue: 'EI claimant status is missing',
      esdcRule: 'ESDC Data Exchange Guide Appendix A: <EIClaimant> is mandatory.',
      fix: 'edit the named action plan and select Claimant, Reach-back, or Non-insured.'
    })).toBe(
      'Action plan "Actions leading to withdrawal": EI claimant status is missing. ESDC rule: ESDC Data Exchange Guide Appendix A: <EIClaimant> is mandatory. Fix: edit the named action plan and select Claimant, Reach-back, or Non-insured.'
    );
  });

  test('collects only failed rule messages at the requested severity', () => {
    const messages = collectIlmpIssueMessages([
      {
        id: '[actionPlan-69]-ei-claimant-required',
        location: 'Action plan "Actions leading to withdrawal"',
        severity: 'blocking',
        passed: false,
        message: 'EI claimant status is required.',
        esdcRule: 'ESDC Data Exchange Guide Appendix A: <EIClaimant> is mandatory.',
        fix: 'edit the named action plan.'
      },
      {
        id: '[actionPlan-69]-review',
        location: 'Action plan "Actions leading to withdrawal"',
        severity: 'warning',
        passed: false,
        message: 'Review this action plan.',
        esdcRule: PATH_REVIEW,
        fix: 'review the named action plan.'
      },
      {
        id: 'passed',
        severity: 'blocking',
        passed: true,
        message: null
      }
    ], 'blocking');

    expect(messages).toEqual([
      'Action plan "Actions leading to withdrawal": EI claimant status is required. ESDC rule: ESDC Data Exchange Guide Appendix A: <EIClaimant> is mandatory. Fix: edit the named action plan.'
    ]);
    expect(messages[0]).not.toContain('[actionPlan-69]');
  });

  test('knows where participant detail fields should be corrected', () => {
    expect(getIlmpParticipantFieldContext('postalCode')).toMatchObject({
      location: 'Participant details - Contact details',
      esdcElement: '<postalZIPCode>'
    });
  });
});
