const EDUCATION_LEVEL_ALIASES = [
  ['1', '1'],
  ['no_formal_education', '1'],
  ['no formal education', '1'],

  ['2', '2'],
  ['grade_7_8', '2'],
  ['up_to_grade_7_8', '2'],
  ['grade 7-8', '2'],
  ['up to grade 7-8', '2'],
  ['up to grade 7-8 (secondaire i-ii)', '2'],

  ['3', '3'],
  ['grade_9_10', '3'],
  ['grade 9-10', '3'],
  ['grade 9-10 (secondaire iii)', '3'],

  ['4', '4'],
  ['grade_11_12', '4'],
  ['grade 11-12', '4'],
  ['grade 11-12 (secondaire iv-v)', '4'],

  ['5', '5'],
  ['secondary_school_diploma_or_ged', '5'],
  ['secondary school diploma or ged', '5'],

  ['6', '6'],
  ['post_secondary_training', '6'],
  ['some post-secondary training', '6'],

  ['7', '7'],
  ['apprenticeship_trades', '7'],
  ['apprenticeship or trades certificate or diploma', '7'],
  ['apprenticeship/trades certificate or diploma', '7'],

  ['8', '8'],
  ['cegep', '8'],
  ['college', '8'],
  ['cegep or other non-university certificate/diploma', '8'],
  ['college or other non-university certificate/diploma', '8'],
  ['college, cegep, or other non-university certificate or diploma', '8'],

  ['9', '9'],
  ['university_certificate', '9'],
  ['university certificate or diploma', '9'],

  ['10', '10'],
  ['bachelors_degree', '10'],
  ['bachelor degree', '10'],
  ["bachelor's degree", '10'],
  ['university - bachelor degree', '10'],
  ["university - bachelor's degree", '10'],

  ['11', '11'],
  ['masters_degree', '11'],
  ['master degree', '11'],
  ["master's degree", '11'],
  ['university - master degree', '11'],
  ["university - master's degree", '11'],

  ['12', '12'],
  ['doctorate', '12'],
  ['doctorate_degree', '12'],
  ['doctorate degree', '12'],
  ['university - doctorate', '12'],
];

function normaliseEducationLookupKey(value) {
  if (value === null || typeof value === 'undefined') return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function looseEducationLookupKey(value) {
  return normaliseEducationLookupKey(value)
    .replace(/\([^)]*\)/g, '')
    .replace(/[_/-]+/g, ' ')
    .replace(/[^a-z0-9'\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ILMP_EDUCATION_LEVEL_CODE_LOOKUP = new Map();

for (const [alias, code] of EDUCATION_LEVEL_ALIASES) {
  const normalized = normaliseEducationLookupKey(alias);
  const loose = looseEducationLookupKey(alias);
  if (normalized) ILMP_EDUCATION_LEVEL_CODE_LOOKUP.set(normalized, code);
  if (loose) ILMP_EDUCATION_LEVEL_CODE_LOOKUP.set(loose, code);
}

function normaliseIlmpEducationLevelCode(value) {
  const normalized = normaliseEducationLookupKey(value);
  if (!normalized) return null;
  return (
    ILMP_EDUCATION_LEVEL_CODE_LOOKUP.get(normalized) ||
    ILMP_EDUCATION_LEVEL_CODE_LOOKUP.get(looseEducationLookupKey(normalized)) ||
    null
  );
}

module.exports = {
  normaliseEducationLookupKey,
  normaliseIlmpEducationLevelCode,
};
