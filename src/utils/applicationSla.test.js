import {
  computeApplicationSlaMeta,
  getApplicationSlaStageKey,
} from './applicationSla';

describe('application SLA stage selection', () => {
  test('uses assignment when a submitted file is still unassigned', () => {
    expect(
      getApplicationSlaStageKey({
        rawStatus: 'submitted',
        isAssigned: false,
        assessmentEligibility: null,
      })
    ).toBe('assignment');
  });

  test('uses EI status verification when an assigned file has no EI eligibility recorded', () => {
    expect(
      getApplicationSlaStageKey({
        rawStatus: 'submitted',
        isAssigned: true,
        assessmentEligibility: null,
      })
    ).toBe('ei_status_verification');
  });

  test('uses assessment once EI eligibility has been recorded', () => {
    expect(
      getApplicationSlaStageKey({
        rawStatus: 'submitted',
        isAssigned: true,
        assessmentEligibility: 'CRF',
      })
    ).toBe('assessment');
  });

  test('uses program decision for pending approval files even if EI eligibility is blank', () => {
    expect(
      getApplicationSlaStageKey({
        rawStatus: 'pending_approval',
        isAssigned: true,
        assessmentEligibility: null,
      })
    ).toBe('program_decision');
  });
});

describe('computeApplicationSlaMeta', () => {
  test('returns an EI stage-aware label', () => {
    const submittedAt = new Date(Date.now() - 2 * 86400000).toISOString();
    const meta = computeApplicationSlaMeta({
      submittedAt,
      slaTargets: { ei_status_verification: 3 },
      rawStatus: 'submitted',
      isAssigned: true,
      assessmentEligibility: null,
    });

    expect(meta.stage).toBe('ei_status_verification');
    expect(meta.label).toMatch(/^EI Status Verification due/);
  });
});
