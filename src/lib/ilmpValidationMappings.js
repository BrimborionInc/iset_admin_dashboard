const ILMP_BARRIER_CODE_LOOKUP = Object.freeze({
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  '11': '11',
  '12': '12',
  none: '1',
  'lack of labour force attachment': '2',
  'lack-of-labour-force-attachment': '2',
  lack_of_labour_force_attachment: '2',
  'lack of work experience': '3',
  'lack-of-work-experience': '3',
  lack_of_work_experience: '3',
  'lack of transportation': '4',
  'lack-of-transportation': '4',
  lack_of_transportation: '4',
  remoteness: '5',
  location: '5',
  language: '6',
  education: '7',
  economic: '8',
  funding: '8',
  'dependent care': '9',
  'dependent-care': '9',
  dependent_care: '9',
  'lack of marketable skills': '10',
  'lack-of-job-opportunities': '10',
  'lack_of_job-opportunities': '10',
  lack_of_job_opportunities: '10',
  'physical/emotional/mental health': '11',
  'physical, emotional, or mental health': '11',
  'physical, emotional and mental health': '11',
  'physical or mental health': '11',
  'physical-or-mental-health': '11',
  physical_or_mental_health: '11',
  other: '12',
  'other barrier': '12',
  'other barrier not listed above': '12',
});

function normalizeNocDigits(value) {
  if (value === null || typeof value === 'undefined') return '';
  return String(value).replace(/\D/g, '');
}

function normaliseIlmpBarrierCode(value) {
  if (value === null || typeof value === 'undefined') return null;
  const key = String(value).trim().toLowerCase();
  if (!key) return null;
  if (key.startsWith('other:')) return '12';
  return ILMP_BARRIER_CODE_LOOKUP[key] || null;
}

function mapIlmpBarrierCodes(values = []) {
  if (!Array.isArray(values) || !values.length) return null;
  const codes = Array.from(new Set(values.map(normaliseIlmpBarrierCode).filter(Boolean)));
  return codes.length ? codes : null;
}

function firstDefinedValue(...values) {
  for (const value of values) {
    if (value !== null && typeof value !== 'undefined' && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

function collectNocLookupPairs(actionPlans = []) {
  const candidatePairs = new Set();
  const addNocPair = (codeRaw, versionRaw) => {
    const version = versionRaw === null || typeof versionRaw === 'undefined'
      ? ''
      : String(versionRaw).trim();
    const code = normalizeNocDigits(codeRaw);
    if (!version || !code) return;
    if (version !== '2016' && version !== '2021') return;
    candidatePairs.add(`${version}:${code}`);
  };

  (Array.isArray(actionPlans) ? actionPlans : []).forEach(plan => {
    if (!plan || typeof plan !== 'object') return;
    const metadata = plan.metadata && typeof plan.metadata === 'object' ? plan.metadata : {};
    addNocPair(
      firstDefinedValue(
        plan.prevEmploymentNoc,
        plan.prev_employment_noc,
        plan.actionPlanPreviousEmploymentNoc,
        plan.ActionPlanPreviousEmploymentNOC,
        metadata.prevEmploymentNoc,
        metadata.prev_employment_noc,
        metadata.actionPlanPreviousEmploymentNoc
      ),
      firstDefinedValue(
        plan.prevEmploymentNocVersion,
        plan.prev_employment_noc_version,
        plan.actionPlanPreviousEmploymentNocVersion,
        plan.ActionPlanPreviousEmploymentNOCVersion,
        metadata.prevEmploymentNocVersion,
        metadata.prev_employment_noc_version,
        metadata.actionPlanPreviousEmploymentNocVersion
      )
    );
    addNocPair(
      firstDefinedValue(
        plan.resultNoc,
        plan.result_noc,
        plan.actionPlanResultRelatedNOC,
        plan.ActionPlanResultRelatedNOC,
        metadata.resultNoc,
        metadata.result_noc,
        metadata.actionPlanResultRelatedNOC
      ),
      firstDefinedValue(
        plan.resultNocVersion,
        plan.result_noc_version,
        plan.actionPlanResultRelatedNOCVersion,
        plan.ActionPlanResultRelatedNOCVersion,
        metadata.resultNocVersion,
        metadata.result_noc_version,
        metadata.actionPlanResultRelatedNOCVersion
      )
    );

    (Array.isArray(plan.interventions) ? plan.interventions : []).forEach(intervention => {
      if (!intervention || typeof intervention !== 'object') return;
      const intvMetadata =
        intervention.metadata && typeof intervention.metadata === 'object'
          ? intervention.metadata
          : {};
      addNocPair(
        firstDefinedValue(
          intervention.relatedNoc,
          intervention.related_noc,
          intervention.noc,
          intervention.interventionRelatedNOC,
          intervention.intervention_related_noc,
          intvMetadata.noc,
          intvMetadata.relatedNoc,
          intvMetadata.related_noc
        ),
        firstDefinedValue(
          intervention.relatedNocVersion,
          intervention.related_noc_version,
          intervention.nocVersion,
          intervention.interventionRelatedNOCVersion,
          intervention.intervention_related_noc_version,
          intvMetadata.nocVersion,
          intvMetadata.relatedNocVersion,
          intvMetadata.related_noc_version
        )
      );
    });
  });

  return candidatePairs;
}

module.exports = {
  ILMP_BARRIER_CODE_LOOKUP,
  collectNocLookupPairs,
  firstDefinedValue,
  mapIlmpBarrierCodes,
  normaliseIlmpBarrierCode,
  normalizeNocDigits,
};
