const ILMP_BARRIER_TO_PARTICIPANT_VALUE = Object.freeze({
  '1': 'none',
  '2': 'lack-of-labour-force-attachment',
  '3': 'lack-of-work-experience',
  '4': 'lack-of-transportation',
  '5': 'location',
  '6': 'language',
  '7': 'education',
  '8': 'funding',
  '9': 'dependent-care',
  '10': 'lack-of-job-opportunities',
  '11': 'physical-or-mental-health',
  '12': 'other',
});

const ILMP_EDUCATION_TO_PARTICIPANT_VALUE = Object.freeze({
  '1': 'no_formal_education',
  '2': 'grade_7_8',
  '3': 'grade_9_10',
  '4': 'grade_11_12',
  '5': 'secondary_school_diploma_or_ged',
  '6': 'post_secondary_training',
  '7': 'apprenticeship_trades',
  '8': 'college',
  '9': 'university_certificate',
  '10': 'bachelors_degree',
  '11': 'masters_degree',
  '12': 'doctorate',
});

const ILMP_PROVINCE_TO_PARTICIPANT_VALUE = Object.freeze({
  '1': 'nl',
  '2': 'ns',
  '3': 'nb',
  '4': 'pe',
  '5': 'qc',
  '6': 'on',
  '7': 'mb',
  '8': 'sk',
  '9': 'ab',
  '10': 'nt',
  '11': 'bc',
  '12': 'yt',
  '13': 'other',
  '14': 'other',
  '16': 'nu',
});

const ILMP_CHILDCARE_FUNDING_TO_PARTICIPANT_VALUE = Object.freeze({
  '2': 'fnicci',
  '3': 'ei-crf',
  '4': 'provincial-funding-subsidy',
  '5': 'no-funding-received',
  '6': 'daycare-not-available',
  '7': 'assisted-by-family',
});

function normalizeString(value) {
  if (value === null || typeof value === 'undefined') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function firstNonBlank(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return '';
}

function normalizeCode(value) {
  const normalized = normalizeString(value);
  return normalized || '';
}

function normalizeCodeList(value) {
  if (Array.isArray(value)) {
    return value
      .map(normalizeCode)
      .filter(Boolean);
  }
  const normalized = normalizeString(value);
  if (!normalized) return [];
  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed)) return normalizeCodeList(parsed);
  } catch (_) {
    // Fall through to comma parsing.
  }
  return normalized
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function unique(values) {
  const seen = new Set();
  const result = [];
  values.forEach(value => {
    const normalized = normalizeString(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function isBlankValue(value) {
  if (value === null || typeof value === 'undefined') return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.map(normalizeString).filter(Boolean).length === 0;
  return false;
}

function isOnlyLegacyCodes(value, codeMap) {
  const normalized = normalizeCodeList(value);
  if (!normalized.length) return false;
  return normalized.every(entry => Object.prototype.hasOwnProperty.call(codeMap, entry));
}

function shouldReplaceCurrentValue(currentValue, replacementPolicy) {
  if (isBlankValue(currentValue)) return true;
  if (!replacementPolicy) return false;
  return replacementPolicy(currentValue);
}

function setIfBlank(target, source, field, value, changedFields, replacementPolicy = null) {
  if (isBlankValue(value)) return;
  if (!shouldReplaceCurrentValue(source[field], replacementPolicy)) return;
  target[field] = Array.isArray(value) ? [...value] : value;
  changedFields.push(field);
}

function mapYesNoCode(value) {
  const code = normalizeCode(value).toLowerCase();
  if (['1', 'yes', 'true', 'y'].includes(code)) return 'yes';
  if (['0', 'no', 'false', 'n'].includes(code)) return 'no';
  return '';
}

function mapEiClaimantToEmploymentInsurance(value) {
  const code = normalizeCode(value);
  if (code === '1' || code === '2') return 'yes';
  if (code === '3') return 'no';
  return '';
}

function mapPreviousEmploymentToParticipantStatus(value, scheduleType = null) {
  const code = normalizeCode(value);
  const schedule = normalizeCode(scheduleType);
  if (code === '1') return 'unemployed';
  if (code === '9') return 'student';
  if (code === '2' && schedule === '1') return 'employed-full-time';
  if (code === '2' && schedule === '2') return 'employed-part-time';
  return '';
}

function mapChildcareFunding(value) {
  const code = normalizeCode(value);
  const mapped = ILMP_CHILDCARE_FUNDING_TO_PARTICIPANT_VALUE[code];
  return mapped ? [mapped] : [];
}

function mapBarriers(value) {
  return unique(
    normalizeCodeList(value)
      .map(code => ILMP_BARRIER_TO_PARTICIPANT_VALUE[code])
      .filter(Boolean)
  );
}

function mapEducationLevel(value) {
  const code = normalizeCode(value);
  return ILMP_EDUCATION_TO_PARTICIPANT_VALUE[code] || code || '';
}

function mapEducationProvince(value) {
  const code = normalizeCode(value);
  return ILMP_PROVINCE_TO_PARTICIPANT_VALUE[code] || code.toLowerCase() || '';
}

function normalizeCaseContext(existingContext) {
  if (!existingContext || typeof existingContext !== 'object' || Array.isArray(existingContext)) {
    return {};
  }
  return { ...existingContext };
}

function mergeBackloadActionPlanParticipantDetails(existingContext, actionPlan = {}) {
  const source = normalizeCaseContext(existingContext);
  const next = { ...source };
  const changedFields = [];
  const barrierValues = mapBarriers(
    actionPlan.BarrierToEmployment ??
      actionPlan.barrierToEmployment ??
      actionPlan.barriers
  );
  const educationLevel = mapEducationLevel(actionPlan.educationLevel ?? actionPlan.education_level);
  const educationProvince = mapEducationProvince(actionPlan.educationProvince ?? actionPlan.education_province);
  const socialAssistance = mapYesNoCode(
    actionPlan.socialAssistanceRecipient ??
      actionPlan.SocialAssistanceRecipient ??
      actionPlan.social_assistance_recipient
  );
  const eiClaimant = firstNonBlank(actionPlan.EIClaimant, actionPlan.eiClaimant, actionPlan.ei_claimant);
  const prevEmployment = firstNonBlank(
    actionPlan.actionPlanPreviousEmployment,
    actionPlan.prevEmployment,
    actionPlan.prev_employment
  );
  const prevEmploymentSchedule = firstNonBlank(
    actionPlan.actionPlanPreviousEmploymentScheduleType,
    actionPlan.prevEmploymentScheduleType,
    actionPlan.prev_employment_schedule_type
  );
  const childcareNeed = mapYesNoCode(
    actionPlan.actionPlanChildcareNeed ??
      actionPlan.actionPlanChildCareNeed ??
      actionPlan.childcareNeed
  );
  const childcareFunding = mapChildcareFunding(
    actionPlan.actionPlanChildcareFundedCode ??
      actionPlan.actionPlanChildCareFundedCode ??
      actionPlan.childcareFunding
  );
  const otherBarrier = firstNonBlank(
    actionPlan.otherBarrier,
    actionPlan.other_barrier,
    actionPlan.otherBarrierDetails,
    actionPlan.employmentBarriersOtherDetails,
    actionPlan.employment_barriers_other_details,
    actionPlan.barriersOtherDetails,
    actionPlan.barriers_other_details
  );

  setIfBlank(next, source, 'employmentGoals', firstNonBlank(actionPlan.employmentGoals, actionPlan.goalDescription, actionPlan.summary), changedFields);
  setIfBlank(next, source, 'educationLevel', educationLevel, changedFields, current => isOnlyLegacyCodes(current, ILMP_EDUCATION_TO_PARTICIPANT_VALUE));
  setIfBlank(next, source, 'educationProvince', educationProvince, changedFields, current => isOnlyLegacyCodes(current, ILMP_PROVINCE_TO_PARTICIPANT_VALUE));
  setIfBlank(next, source, 'socialAssistance', socialAssistance, changedFields, current => ['0', '1'].includes(normalizeCode(current)));
  setIfBlank(next, source, 'eiClaimant', eiClaimant, changedFields);
  setIfBlank(next, source, 'employmentInsurance', mapEiClaimantToEmploymentInsurance(eiClaimant), changedFields, current => ['0', '1'].includes(normalizeCode(current)));
  setIfBlank(next, source, 'employmentStatus', mapPreviousEmploymentToParticipantStatus(prevEmployment, prevEmploymentSchedule), changedFields, current => ['1', '2', '9'].includes(normalizeCode(current)));
  setIfBlank(next, source, 'childcareNeed', childcareNeed, changedFields, current => ['0', '1'].includes(normalizeCode(current)));
  setIfBlank(next, source, 'childcareFunding', childcareFunding, changedFields, current => isOnlyLegacyCodes(current, ILMP_CHILDCARE_FUNDING_TO_PARTICIPANT_VALUE));
  setIfBlank(next, source, 'employmentBarriers', barrierValues, changedFields, current => isOnlyLegacyCodes(current, ILMP_BARRIER_TO_PARTICIPANT_VALUE));
  if (barrierValues.includes('other')) {
    setIfBlank(next, source, 'otherBarrier', otherBarrier, changedFields);
  }

  return { caseContext: next, changedFields };
}

function mergeBackloadInterventionParticipantDetails(existingContext, intervention = {}) {
  const source = normalizeCaseContext(existingContext);
  const next = { ...source };
  const changedFields = [];
  const noc = firstNonBlank(
    intervention.interventionRelatedNOC,
    intervention.relatedNoc,
    intervention.related_noc,
    intervention.noc
  );
  const nocVersion = firstNonBlank(
    intervention.interventionRelatedNOCVersion,
    intervention.relatedNocVersion,
    intervention.related_noc_version,
    intervention.nocVersion
  );

  setIfBlank(next, source, 'programNoc', noc, changedFields);
  setIfBlank(next, source, 'programNocVersion', nocVersion, changedFields);

  return { caseContext: next, changedFields };
}

module.exports = {
  ILMP_BARRIER_TO_PARTICIPANT_VALUE,
  ILMP_CHILDCARE_FUNDING_TO_PARTICIPANT_VALUE,
  ILMP_EDUCATION_TO_PARTICIPANT_VALUE,
  ILMP_PROVINCE_TO_PARTICIPANT_VALUE,
  mergeBackloadActionPlanParticipantDetails,
  mergeBackloadInterventionParticipantDetails,
};
