import { resolveInterventionApprovalQueueEiStatus } from '../interventionApprovalQueueEiStatus';

describe('intervention approval queue EI status', () => {
  test('uses the intervention proposal review value when application EI differs', () => {
    expect(
      resolveInterventionApprovalQueueEiStatus({
        intervention_ei_status: 'EI Reach Back',
        assessment_esdc_eligibility: 'CRF',
      })
    ).toBe('EI Reach Back');
  });

  test('does not fall back to application assessment EI', () => {
    expect(
      resolveInterventionApprovalQueueEiStatus({
        intervention_ei_status: null,
        assessment_esdc_eligibility: 'EI Active Claim',
      })
    ).toBeNull();
  });

  test('accepts the camel-case API alias and trims its display value', () => {
    expect(
      resolveInterventionApprovalQueueEiStatus({
        interventionEiStatus: '  CRF  ',
        assessment_esdc_eligibility: 'EI Reach Back',
      })
    ).toBe('CRF');
  });
});
