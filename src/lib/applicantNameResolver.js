const GENERIC_NAME_VALUES = new Set([
  'applicant',
  'applicant name',
  'client',
  'client name',
  'participant',
  'participant name',
  'student',
  'student name',
  'unknown',
  'n/a',
  'na',
  '-',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normaliseNameValue(value, { allowGeneric = false } = {}) {
  if (value === null || typeof value === 'undefined') return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (!allowGeneric && GENERIC_NAME_VALUES.has(text.toLowerCase())) return null;
  return text;
}

function pickFirst(...values) {
  for (const value of values) {
    const normalized = normaliseNameValue(value);
    if (normalized) return normalized;
  }
  return null;
}

function buildName(parts = []) {
  const normalized = parts.map(part => normaliseNameValue(part)).filter(Boolean);
  return normalized.length ? normalized.join(' ') : null;
}

function buildNameFromObject(source = {}, keySets = []) {
  if (!isPlainObject(source)) return null;
  for (const keys of keySets) {
    const name = buildName(keys.map(key => source[key]));
    if (name) return name;
  }
  return null;
}

function firstToken(value) {
  const normalized = normaliseNameValue(value);
  if (!normalized) return null;
  return normalized.split(/\s+/)[0] || null;
}

function getCaseContextParts(caseContext = {}) {
  const context = isPlainObject(caseContext) ? caseContext : {};
  const personal = isPlainObject(context.applicationPersonal) ? context.applicationPersonal : {};
  const answers = isPlainObject(context.applicationAnswers) ? context.applicationAnswers : {};
  return { context, personal, answers };
}

function getPayloadParts(payload = {}) {
  const source = isPlainObject(payload) ? payload : {};
  const personal = isPlainObject(source.personal) ? source.personal : {};
  const answers = isPlainObject(source.answers) ? source.answers : {};
  const snapshot = isPlainObject(source.submission_snapshot) ? source.submission_snapshot : {};
  return { source, personal, answers, snapshot };
}

const DIRECT_FULL_NAME_KEYS = [
  'applicant_full_name',
  'applicantFullName',
  'applicant_legal_name',
  'applicantLegalName',
  'full_name',
  'fullName',
  'name',
];

const FIRST_MIDDLE_LAST_KEY_SETS = [
  ['first-name', 'middle-names', 'last-name'],
  ['first_name', 'middle_names', 'last_name'],
  ['firstName', 'middleNames', 'lastName'],
  ['given_name', 'middle_names', 'family_name'],
  ['givenName', 'middleNames', 'familyName'],
  ['first-name', 'last-name'],
  ['first_name', 'last_name'],
  ['firstName', 'lastName'],
  ['given_name', 'family_name'],
  ['givenName', 'familyName'],
];

function resolveApplicantNameFromPayload(payload, fallback = null) {
  if (!isPlainObject(payload)) return normaliseNameValue(fallback);
  const { source, personal, answers, snapshot } = getPayloadParts(payload);
  const directFullName = [
    ...DIRECT_FULL_NAME_KEYS.map(key => source[key]),
    ...DIRECT_FULL_NAME_KEYS.map(key => personal[key]),
    ...DIRECT_FULL_NAME_KEYS.map(key => snapshot[key]),
    ...DIRECT_FULL_NAME_KEYS.map(key => answers[key]),
  ];
  const structuredFullName =
    buildNameFromObject(source, FIRST_MIDDLE_LAST_KEY_SETS) ||
    buildNameFromObject(personal, FIRST_MIDDLE_LAST_KEY_SETS) ||
    buildNameFromObject(snapshot, FIRST_MIDDLE_LAST_KEY_SETS) ||
    buildNameFromObject(answers, FIRST_MIDDLE_LAST_KEY_SETS);
  return pickFirst(
    ...directFullName,
    structuredFullName,
    source?.consent?.name,
    source?.indigenous_declaration?.name,
    source?.legal_submission_sig?.name,
    source?.conflict_applicant_signature?.name,
    fallback
  );
}

function resolveApplicantDisplayName({
  caseContext = null,
  submissionPayload = null,
  client = null,
  caseRow = null,
  applicantUser = null,
  fallback = null,
  allowEmailFallback = false,
} = {}) {
  const { context, personal, answers } = getCaseContextParts(caseContext);
  const clientObject = isPlainObject(client) ? client : {};
  const clientDetails = isPlainObject(clientObject.details) ? clientObject.details : {};
  const row = isPlainObject(caseRow) ? caseRow : {};
  const user = isPlainObject(applicantUser) ? applicantUser : {};
  const submissionFullName = buildName([
    row.submission_first_name,
    row.submission_middle_names,
    row.submission_last_name,
  ]);
  const clientFullName = buildName([
    clientObject.firstName || clientObject.first_name || row.client_first_name,
    clientObject.middleName || clientObject.middle_name || row.client_middle_name,
    clientObject.lastName || clientObject.last_name || row.client_last_name,
  ]);
  const caseContextFullName =
    buildNameFromObject(context, FIRST_MIDDLE_LAST_KEY_SETS) ||
    buildNameFromObject(personal, FIRST_MIDDLE_LAST_KEY_SETS) ||
    buildNameFromObject(answers, FIRST_MIDDLE_LAST_KEY_SETS);
  const preferredFallback = pickFirst(
    context.preferredName,
    context.preferred_name,
    personal.preferredName,
    personal.preferred_name,
    answers['preferred-name'],
    answers.preferred_name,
    answers.preferredName,
    row.submission_preferred_name,
    submissionPayload?.['preferred-name'],
    submissionPayload?.preferred_name,
    submissionPayload?.preferredName
  );
  const emailFallback = allowEmailFallback
    ? pickFirst(user.email, row.applicant_email, row.client_email, clientObject.email, clientObject.applicant_account_email)
    : null;

  return pickFirst(
    row.applicant_legal_name,
    row.applicantLegalName,
    resolveApplicantNameFromPayload(submissionPayload, null),
    ...DIRECT_FULL_NAME_KEYS.map(key => context[key]),
    ...DIRECT_FULL_NAME_KEYS.map(key => personal[key]),
    ...DIRECT_FULL_NAME_KEYS.map(key => answers[key]),
    submissionFullName,
    caseContextFullName,
    clientFullName,
    clientObject.fullName,
    clientObject.full_name,
    clientObject.name,
    clientDetails.fullName,
    clientDetails.full_name,
    row.client_name,
    row.applicant_name,
    user.name,
    user.display_name,
    user.displayName,
    preferredFallback,
    emailFallback,
    fallback
  );
}

function resolveApplicantSalutationName({
  caseContext = null,
  submissionPayload = null,
  client = null,
  caseRow = null,
  applicantUser = null,
  fallback = null,
} = {}) {
  const { context, personal, answers } = getCaseContextParts(caseContext);
  const { source, personal: payloadPersonal, answers: payloadAnswers } = getPayloadParts(submissionPayload);
  const row = isPlainObject(caseRow) ? caseRow : {};
  const preferred = pickFirst(
    context.preferredName,
    context.preferred_name,
    personal.preferredName,
    personal.preferred_name,
    answers['preferred-name'],
    answers.preferred_name,
    answers.preferredName,
    source['preferred-name'],
    source.preferred_name,
    source.preferredName,
    payloadPersonal.preferredName,
    payloadPersonal.preferred_name,
    payloadAnswers['preferred-name'],
    payloadAnswers.preferred_name,
    payloadAnswers.preferredName
  );
  if (preferred) return preferred;

  const firstName = pickFirst(
    context.firstName,
    context.first_name,
    context.givenName,
    context.given_name,
    personal.firstName,
    personal.first_name,
    personal.givenName,
    personal.given_name,
    answers['first-name'],
    answers.first_name,
    answers.firstName,
    answers['personal-first-name'],
    answers.personal_first_name,
    source['first-name'],
    source.first_name,
    source.firstName,
    payloadPersonal.firstName,
    payloadPersonal.first_name,
    payloadAnswers['first-name'],
    payloadAnswers.first_name,
    payloadAnswers.firstName,
    row.submission_first_name,
    row.client_first_name
  );
  if (firstName) return firstName;

  const displayName = resolveApplicantDisplayName({
    caseContext,
    submissionPayload,
    client,
    caseRow,
    applicantUser,
    fallback,
    allowEmailFallback: false,
  });
  return firstToken(displayName) || firstToken(fallback);
}

module.exports = {
  normaliseNameValue,
  resolveApplicantDisplayName,
  resolveApplicantNameFromPayload,
  resolveApplicantSalutationName,
};
