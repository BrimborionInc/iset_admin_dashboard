const EDUCATION_CODES = new Set([4, 5, 9, 10, 11, 12, 13]);
const EMPLOYER_CODES = new Set([6, 7, 8, 17]);
const WAGE_SUBSIDY_CODES = new Set([7, 8]);
const NOC_REQUIRED_CODES = new Set([6, 7, 8, 9, 10, 11, 12, 13, 17]);

const toNumericCode = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const isEducationInterventionCode = value => {
  const numeric = toNumericCode(value);
  return numeric !== null && EDUCATION_CODES.has(numeric);
};

export const isEmployerInterventionCode = value => {
  const numeric = toNumericCode(value);
  return numeric !== null && EMPLOYER_CODES.has(numeric);
};

export const isWageSubsidyInterventionCode = value => {
  const numeric = toNumericCode(value);
  return numeric !== null && WAGE_SUBSIDY_CODES.has(numeric);
};

export const requiresExternalPartnerForInterventionCode = value =>
  isEducationInterventionCode(value) || isEmployerInterventionCode(value);

export const requiresNocForInterventionCode = value => {
  const numeric = toNumericCode(value);
  return numeric !== null && NOC_REQUIRED_CODES.has(numeric);
};
