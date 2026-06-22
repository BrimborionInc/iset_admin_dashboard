export function resolveApplicationAssessmentEligibility(...records) {
  const candidates = records.filter(record => record && typeof record === 'object');

  for (const record of candidates) {
    const value =
      record.assessment_esdc_eligibility ??
      record.assessmentEsdcEligibility ??
      record.esdc_eligibility ??
      record.esdcEligibility ??
      null;
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value;
    }
  }

  return null;
}
