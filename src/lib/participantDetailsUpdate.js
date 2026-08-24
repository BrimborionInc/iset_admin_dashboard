const PARTICIPANT_DETAILS_FIELDS = Object.freeze([
  'firstName',
  'lastName',
  'preferredName',
  'middleNames',
  'gender',
  'genderIdentity',
  'sex',
  'sexOther',
  'pronouns',
  'sin',
  'dateOfBirth',
  'addressLine1',
  'addressLine2',
  'addressCity',
  'addressProvince',
  'postalCode',
  'emailPrimary',
  'phonePrimary',
  'phoneAlt',
  'mailingLine1',
  'mailingLine2',
  'mailingCity',
  'mailingProvince',
  'mailingPostal',
  'emergencyName',
  'emergencyPhone',
  'emergencyRelationship',
  'indigenousIdentity',
  'indigenousAffiliation',
  'registrationNumber',
  'languageSpoken',
  'visibleMinority',
  'maritalStatus',
  'spouseName',
  'dependentChildren',
  'agesOfChildren',
  'hasDisability',
  'disabilityDescription',
  'homeCommunity',
  'householdComposition',
  'socialAssistance',
  'topUpAmount',
  'disabilitySupport',
  'disabilitySupportDetails',
  'labourForceStatus',
  'highestEducation',
  'educationYear',
  'educationLocation',
  'targetProgram',
  'employerName',
  'employmentNocVersion',
  'employmentNoc',
  'programEmployer',
  'programNocVersion',
  'programNoc',
  'programTrainingProvider',
  'employmentGoals',
  'employmentBarriers',
  'otherBarrier',
  'requestedSupports',
  'childcareFunding',
  'otherRequestedSupport',
  'employmentGoalNarrative',
  'shortTermGoal',
  'incomeOther',
  'expensesTransport',
  'expensesOtherList',
  'loanGrant',
  'loanGrantDetails',
  'expensesTransportMileage',
  'incomeEmployment',
  'incomeSpousal',
  'incomeSocialAssist',
  'incomeChildSupport',
  'incomeChildBenefit',
  'incomeJordans',
  'incomeBandFunding',
  'incomeAlimony',
  'incomeOtherAmount',
  'expensesRent',
  'expensesGroceries',
  'expensesElectricity',
  'expensesHeating',
  'expensesWater',
  'expensesSewerage',
  'expensesGarbage',
  'expensesBusPass',
  'expensesParking',
  'expensesOtherTotal',
]);

const PARTICIPANT_DETAILS_FIELD_SET = new Set(PARTICIPANT_DETAILS_FIELDS);
const PARTICIPANT_DETAILS_ARRAY_FIELDS = new Set([
  'employmentBarriers',
  'requestedSupports',
  'childcareFunding',
  'expensesTransport',
]);
const PARTICIPANT_DETAILS_YES_NO_FIELDS = new Set([
  'visibleMinority',
  'hasDisability',
  'socialAssistance',
  'disabilitySupport',
  'loanGrant',
]);
const REGISTRATION_ANSWER_KEYS = [
  'sfn-registration-number',
  'nsfn-registration-number',
  'metis-registration-number',
  'inuit-registration-number',
  'registration-number',
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function invalidParticipantDetails(field, message = null) {
  const error = new Error('invalid_participant_details');
  error.code = 'invalid_participant_details';
  error.status = 400;
  error.field = field || null;
  error.publicMessage = message || (
    field
      ? `Participant Details contains an unsupported value for ${field}.`
      : 'Participant Details must include at least one supported field.'
  );
  return error;
}

function normalizeYesNo(value) {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(normalized)) return 'yes';
  if (['no', 'n', 'false', '0'].includes(normalized)) return 'no';
  return normalized || null;
}

function isValidSin(value) {
  if (!/^\d{9}$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < value.length; index += 1) {
    let digit = Number(value[index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function normalizeSin(value) {
  if (value === null || typeof value === 'undefined' || String(value).trim() === '') return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 9) {
    throw invalidParticipantDetails('sin', 'Social Insurance Number must be 9 digits.');
  }
  if (!isValidSin(digits)) {
    throw invalidParticipantDetails('sin', 'Social Insurance Number checksum is invalid.');
  }
  return digits;
}

function normalizeDateOnly(value) {
  if (value === null || typeof value === 'undefined' || String(value).trim() === '') return null;
  if (typeof value !== 'string') {
    throw invalidParticipantDetails('dateOfBirth', 'Date of birth must be a valid calendar date.');
  }
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw invalidParticipantDetails('dateOfBirth', 'Date of birth must be a valid calendar date.');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw invalidParticipantDetails('dateOfBirth', 'Date of birth must be a valid calendar date.');
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function sanitizeParticipantDetailsInput(value) {
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    throw invalidParticipantDetails(null);
  }
  const normalized = {};
  for (const key of Object.keys(value)) {
    if (!PARTICIPANT_DETAILS_FIELD_SET.has(key)) {
      throw invalidParticipantDetails(key, `Participant Details cannot change ${key}.`);
    }
    const fieldValue = value[key];
    if (PARTICIPANT_DETAILS_ARRAY_FIELDS.has(key)) {
      if (!Array.isArray(fieldValue)) {
        throw invalidParticipantDetails(key, `${key} must be a list.`);
      }
      if (fieldValue.some(entry => typeof entry !== 'string')) {
        throw invalidParticipantDetails(key, `${key} must contain only text values.`);
      }
      normalized[key] = [...fieldValue];
      continue;
    }
    if (fieldValue !== null && typeof fieldValue !== 'string') {
      throw invalidParticipantDetails(key);
    }
    if (key === 'sin') {
      normalized[key] = normalizeSin(fieldValue);
    } else if (key === 'dateOfBirth') {
      normalized[key] = normalizeDateOnly(fieldValue);
    } else if (PARTICIPANT_DETAILS_YES_NO_FIELDS.has(key)) {
      normalized[key] = normalizeYesNo(fieldValue);
    } else if (key === 'sexOther') {
      normalized[key] = fieldValue && fieldValue.trim() ? fieldValue.trim() : null;
    } else {
      normalized[key] = fieldValue || null;
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(normalized, 'sex') &&
    normalized.sex !== 'other' &&
    Object.prototype.hasOwnProperty.call(normalized, 'sexOther')
  ) {
    normalized.sexOther = null;
  }
  return normalized;
}

function assignMappedFields(target, source, mapping) {
  for (const [sourceKey, targetKeys] of Object.entries(mapping)) {
    if (!Object.prototype.hasOwnProperty.call(source, sourceKey)) continue;
    for (const targetKey of Array.isArray(targetKeys) ? targetKeys : [targetKeys]) {
      target[targetKey] = source[sourceKey];
    }
  }
}

function hasAnyOwnField(source, keys) {
  return keys.some(key => Object.prototype.hasOwnProperty.call(source, key));
}

function getRegistrationTargetKey(answers) {
  const source = isPlainObject(answers) ? answers : {};
  return REGISTRATION_ANSWER_KEYS.find(key => {
    const value = source[key];
    return value !== null && typeof value !== 'undefined' && String(value).trim() !== '';
  }) || 'sfn-registration-number';
}

const ROOT_FIELD_MAPPING = Object.freeze({
  firstName: 'firstName',
  lastName: 'lastName',
  preferredName: 'preferredName',
  middleNames: 'middleNames',
  gender: 'gender',
  genderIdentity: 'genderIdentity',
  pronouns: 'pronouns',
  sex: 'sex',
  sexOther: 'sexOther',
  sin: 'sin',
  dateOfBirth: 'dateOfBirth',
  emailPrimary: 'emailPrimary',
  phonePrimary: 'phonePrimary',
  phoneAlt: 'phoneAlt',
  emergencyName: 'emergencyName',
  emergencyPhone: 'emergencyPhone',
  emergencyRelationship: 'emergencyRelationship',
  indigenousIdentity: 'indigenousIdentity',
  indigenousAffiliation: 'indigenousAffiliation',
  registrationNumber: 'registrationNumber',
  languageSpoken: ['languageSpoken', 'preferredLanguage'],
  visibleMinority: 'visibleMinority',
  maritalStatus: 'maritalStatus',
  spouseName: 'spouseName',
  dependentChildren: 'dependentChildren',
  agesOfChildren: 'agesOfChildren',
  hasDisability: 'hasDisability',
  disabilityDescription: 'disabilityDescription',
  homeCommunity: 'homeCommunity',
  householdComposition: 'householdComposition',
  socialAssistance: 'socialAssistance',
  topUpAmount: 'topUpAmount',
  disabilitySupport: 'disabilitySupport',
  disabilitySupportDetails: 'disabilitySupportDetails',
  labourForceStatus: 'employmentStatus',
  highestEducation: 'educationLevel',
  educationYear: 'educationYear',
  educationLocation: 'educationProvince',
  targetProgram: 'targetProgram',
  employerName: 'employerName',
  employmentNocVersion: 'employmentNocVersion',
  employmentNoc: 'employmentNoc',
  programEmployer: 'programEmployer',
  programNocVersion: 'programNocVersion',
  programNoc: 'programNoc',
  programTrainingProvider: 'programTrainingProvider',
  employmentGoals: 'employmentGoals',
  employmentBarriers: 'employmentBarriers',
  requestedSupports: 'requestedSupports',
  childcareFunding: 'childcareFunding',
  otherBarrier: 'otherBarrier',
  otherRequestedSupport: 'otherRequestedSupport',
  employmentGoalNarrative: 'longTermGoal',
  shortTermGoal: 'shortTermGoal',
  incomeOther: 'incomeOther',
  expensesTransport: 'expensesTransport',
  expensesOtherList: 'expensesOtherList',
  loanGrant: 'loanGrant',
  loanGrantDetails: 'loanGrantDetails',
  expensesTransportMileage: 'expensesTransportMileage',
  incomeEmployment: 'incomeEmployment',
  incomeSpousal: 'incomeSpousal',
  incomeSocialAssist: 'incomeSocialAssist',
  incomeChildSupport: 'incomeChildSupport',
  incomeChildBenefit: 'incomeChildBenefit',
  incomeJordans: 'incomeJordans',
  incomeBandFunding: 'incomeBandFunding',
  incomeAlimony: 'incomeAlimony',
  incomeOtherAmount: 'incomeOtherAmount',
  expensesRent: 'expensesRent',
  expensesGroceries: 'expensesGroceries',
  expensesElectricity: 'expensesElectricity',
  expensesHeating: 'expensesHeating',
  expensesWater: 'expensesWater',
  expensesSewerage: 'expensesSewerage',
  expensesGarbage: 'expensesGarbage',
  expensesBusPass: 'expensesBusPass',
  expensesParking: 'expensesParking',
  expensesOtherTotal: 'expensesOtherTotal',
});

const PERSONAL_FIELD_MAPPING = Object.freeze({
  firstName: 'first_name',
  lastName: 'last_name',
  preferredName: 'preferred_name',
  middleNames: 'middle_names',
  gender: 'gender',
  genderIdentity: 'gender_identity',
  pronouns: 'pronouns',
  sex: 'sex',
  sexOther: 'sex_other',
  sin: 'sin',
  dateOfBirth: 'date_of_birth',
  emailPrimary: 'email',
  phonePrimary: 'phone',
  phoneAlt: 'phone_alt',
  homeCommunity: 'home_community',
});

const ANSWER_FIELD_MAPPING = Object.freeze({
  firstName: 'first-name',
  lastName: 'last-name',
  preferredName: 'preferred-name',
  middleNames: 'middle-names',
  gender: 'gender',
  genderIdentity: 'gender_identity',
  pronouns: 'pronouns',
  sex: ['sex', 'biological_sex'],
  sexOther: ['sex_other', 'biological_sex_other'],
  dateOfBirth: 'dob',
  sin: 'social-insurance-number',
  addressLine1: 'address-street-address',
  addressLine2: 'address-mailing-address',
  addressCity: 'address-city',
  addressProvince: 'address-province',
  postalCode: 'address-postcode',
  mailingLine1: 'mailing-address-street',
  mailingLine2: 'mailing-address-line2',
  mailingCity: 'mailing-address-city',
  mailingProvince: 'mailing-address-province',
  mailingPostal: 'mailing-address-postcode',
  emailPrimary: 'contact-email-address',
  phonePrimary: 'telephone-day',
  phoneAlt: 'telephone-alt',
  emergencyName: 'emergency-contact-name',
  emergencyPhone: 'emergency-contact-telephone',
  emergencyRelationship: 'emergency-contact-relationship',
  indigenousIdentity: 'legal-indigenous-identity',
  indigenousAffiliation: 'indigenous-affiliation-declaration',
  languageSpoken: ['language-spoken', 'preferred-language'],
  visibleMinority: 'visible-minority',
  maritalStatus: 'marital-status',
  spouseName: 'spouses-name',
  dependentChildren: 'dependent-children',
  agesOfChildren: 'ages-of-children',
  hasDisability: 'has-disability',
  disabilityDescription: 'disability-description',
  homeCommunity: ['home-community', 'home-comminuty'],
  householdComposition: 'household-composition',
  socialAssistance: 'social-assistance',
  topUpAmount: 'top-up-amount',
  disabilitySupport: 'disability-support',
  disabilitySupportDetails: 'disability-support_yes_follow',
  labourForceStatus: 'labour-force-status',
  highestEducation: 'highest-education',
  educationYear: 'education-year',
  educationLocation: 'education-location',
  targetProgram: 'target-program',
  programEmployer: 'program-employer',
  programNocVersion: 'program-noc-version',
  programNoc: 'program-noc',
  programTrainingProvider: 'program-training-provider',
  employmentGoals: 'employment-goals',
  employmentBarriers: 'barriers',
  otherBarrier: 'other-barrier',
  requestedSupports: 'requested-supports',
  childcareFunding: 'childcare-fuding-status',
  otherRequestedSupport: 'other-requested-support',
  employmentGoalNarrative: 'long-term-goal',
  shortTermGoal: 'short-term-goal',
  incomeOther: 'income-other',
  expensesOtherList: 'expenses-other-list',
  expensesTransport: 'expenses-transport',
  expensesTransportMileage: 'expenses_transport_mileage',
  loanGrant: 'loan-grant',
  loanGrantDetails: 'loan-grant-details',
  incomeEmployment: 'income-employment',
  incomeSpousal: 'income-spousal',
  incomeSocialAssist: 'income-social-assist',
  incomeChildSupport: 'income-child-support',
  incomeChildBenefit: 'income-child-benefit',
  incomeJordans: 'income-jordans',
  incomeBandFunding: 'income-band-funding',
  incomeAlimony: 'income-alimony',
  incomeOtherAmount: 'income-other-description',
  expensesRent: 'expenses-rent',
  expensesGroceries: 'expenses-groceries',
  expensesElectricity: 'expenses-electricity',
  expensesHeating: 'expenses-heating',
  expensesWater: 'expenses-water',
  expensesSewerage: 'expenses-sewerage',
  expensesGarbage: 'expenses-garbage',
  expensesBusPass: 'expenses_bus_pass',
  expensesParking: 'expenses-parking',
  expensesOtherTotal: 'expenses-other-total',
});

function buildParticipantDetailsCaseContextPatch(normalizedDetails, existingCaseContext = {}) {
  const details = isPlainObject(normalizedDetails) ? normalizedDetails : {};
  const contextPatch = {};
  assignMappedFields(contextPatch, details, ROOT_FIELD_MAPPING);

  const homeAddressFields = ['addressLine1', 'addressLine2', 'addressCity', 'addressProvince', 'postalCode'];
  if (hasAnyOwnField(details, homeAddressFields)) {
    contextPatch.address = {};
    assignMappedFields(contextPatch.address, details, {
      addressLine1: 'line1',
      addressLine2: 'line2',
      addressCity: 'city',
      addressProvince: 'province',
      postalCode: 'postalCode',
    });
  }

  const mailingAddressFields = ['mailingLine1', 'mailingLine2', 'mailingCity', 'mailingProvince', 'mailingPostal'];
  if (hasAnyOwnField(details, mailingAddressFields)) {
    contextPatch.mailingAddress = {};
    assignMappedFields(contextPatch.mailingAddress, details, {
      mailingLine1: 'line1',
      mailingLine2: 'line2',
      mailingCity: 'city',
      mailingProvince: 'province',
      mailingPostal: 'postalCode',
    });
  }

  const personal = {};
  assignMappedFields(personal, details, PERSONAL_FIELD_MAPPING);
  if (hasAnyOwnField(details, homeAddressFields)) {
    personal.address = {};
    assignMappedFields(personal.address, details, {
      addressLine1: 'line1',
      addressLine2: 'line2',
      addressCity: 'city',
      addressProvince: 'province',
      postalCode: 'postalCode',
    });
  }
  if (hasAnyOwnField(details, mailingAddressFields)) {
    personal.mailing_address = {};
    assignMappedFields(personal.mailing_address, details, {
      mailingLine1: 'line1',
      mailingLine2: 'line2',
      mailingCity: 'city',
      mailingProvince: 'province',
      mailingPostal: 'postalCode',
    });
  }
  if (Object.keys(personal).length) contextPatch.applicationPersonal = personal;

  const answers = {};
  assignMappedFields(answers, details, ANSWER_FIELD_MAPPING);
  if (Object.prototype.hasOwnProperty.call(details, 'registrationNumber')) {
    answers['registration-number'] = details.registrationNumber;
    const existingAnswers = isPlainObject(existingCaseContext.applicationAnswers)
      ? existingCaseContext.applicationAnswers
      : {};
    answers[getRegistrationTargetKey(existingAnswers)] = details.registrationNumber;
  }
  if (Object.prototype.hasOwnProperty.call(details, 'childcareFunding') && !details.childcareFunding.length) {
    contextPatch.childcareFunding = null;
    answers['childcare-fuding-status'] = null;
  }
  if (Object.prototype.hasOwnProperty.call(details, 'expensesTransport') && !details.expensesTransport.length) {
    contextPatch.expensesTransport = null;
  }
  if (Object.keys(answers).length) contextPatch.applicationAnswers = answers;

  return contextPatch;
}

module.exports = {
  PARTICIPANT_DETAILS_ARRAY_FIELDS,
  PARTICIPANT_DETAILS_FIELDS,
  buildParticipantDetailsCaseContextPatch,
  sanitizeParticipantDetailsInput,
};
