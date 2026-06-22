import { resolveApplicationAssessmentEligibility } from './applicationAssessmentEligibility';

describe('resolveApplicationAssessmentEligibility', () => {
  it('reads snake_case, camelCase, and API shorthand eligibility fields', () => {
    expect(resolveApplicationAssessmentEligibility({ assessment_esdc_eligibility: 'crf' })).toBe('crf');
    expect(resolveApplicationAssessmentEligibility({ assessmentEsdcEligibility: 'reach_back' })).toBe('reach_back');
    expect(resolveApplicationAssessmentEligibility({ esdcEligibility: 'active_claim' })).toBe('active_claim');
  });

  it('falls back to later records when earlier records are blank', () => {
    expect(resolveApplicationAssessmentEligibility(
      { assessment_esdc_eligibility: '' },
      { assessmentEsdcEligibility: 'crf' }
    )).toBe('crf');
  });

  it('returns null when no structured EI eligibility result exists', () => {
    expect(resolveApplicationAssessmentEligibility({}, null, { assessment_esdc_eligibility: ' ' })).toBeNull();
  });
});
