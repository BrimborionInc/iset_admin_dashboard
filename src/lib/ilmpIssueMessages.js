const APPENDIX_A = 'ESDC Data Exchange Guide Appendix A';
const APPENDIX_B = 'ESDC Data Exchange Guide Appendix B';
const APPENDIX_C = 'ESDC Data Exchange Guide Appendix C';
const PATH_REVIEW = 'PATH review check only; not an ESDC Data Exchange Guide blocker';

const PARTICIPANT_FIELD_CONTEXT = Object.freeze({
  socialInsuranceNumber: {
    location: 'Participant details - Participant identity',
    esdcElement: '<socialInsuranceNumber>',
    esdcRule: `${APPENDIX_A}: SIN is mandatory for ISET submissions; the guide also requires a valid SIN.`,
    fix: 'edit Participant details and correct the Social Insurance Number.'
  },
  firstName: {
    location: 'Participant details - Participant identity',
    esdcElement: '<firstName>',
    esdcRule: `${APPENDIX_A}: First Name is mandatory for ISET submissions.`,
    fix: 'edit Participant details and correct the first name.'
  },
  lastName: {
    location: 'Participant details - Participant identity',
    esdcElement: '<lastName>',
    esdcRule: `${APPENDIX_A}: Last Name is mandatory for ISET submissions.`,
    fix: 'edit Participant details and correct the last name.'
  },
  dateOfBirth: {
    location: 'Participant details - Participant identity',
    esdcElement: '<dateOfBirth>',
    esdcRule: `${APPENDIX_A}: Date of Birth is mandatory for ISET submissions; the guide requires age 1 to 100 and not future-dated.`,
    fix: 'edit Participant details and correct the date of birth.'
  },
  gender: {
    location: 'Participant details - Participant identity',
    esdcElement: '<gender>',
    esdcRule: `${APPENDIX_A}: Client's Gender is mandatory for ISET submissions.`,
    fix: 'edit Participant details and select a valid gender value.'
  },
  aboriginalGroup: {
    location: 'Participant details - Indigenous identity',
    esdcElement: '<aboriginalGroup>',
    esdcRule: `${APPENDIX_A}: Aboriginal Group is mandatory for ISET submissions.`,
    fix: 'edit Participant details and select a valid Indigenous identity value.'
  },
  maritalStatus: {
    location: 'Participant details - Demographics and household',
    esdcElement: '<maritalStatus>',
    esdcRule: `${APPENDIX_A}: Marital Status is mandatory for ISET submissions.`,
    fix: 'edit Participant details and enter marital status.'
  },
  numberOfDependantChildren: {
    location: 'Participant details - Demographics and household',
    esdcElement: '<numberOfDependantChildren>',
    esdcRule: `${APPENDIX_A}: Number of Dependent Children is mandatory for ISET submissions.`,
    fix: 'edit Participant details and enter the number of dependent children.'
  },
  languageSpoken: {
    location: 'Participant details - Contact details',
    esdcElement: '<languageSpoken>',
    esdcRule: `${APPENDIX_A}: Languages Spoken is mandatory for ISET submissions.`,
    fix: 'edit Participant details and enter language spoken.'
  },
  disability: {
    location: 'Participant details - Disability',
    esdcElement: '<disability>',
    esdcRule: `${APPENDIX_A}: Disability is mandatory for ISET submissions.`,
    fix: 'edit Participant details and set Disability to Yes or No.'
  },
  addressStreet: {
    location: 'Participant details - Contact details',
    esdcElement: '<streetAddress>',
    esdcRule: `${APPENDIX_A}: Street Address is mandatory for ISET submissions.`,
    fix: 'edit Participant details and correct the street address.'
  },
  addressCity: {
    location: 'Participant details - Contact details',
    esdcElement: '<municipality>',
    esdcRule: `${APPENDIX_A}: Municipality is mandatory for ISET submissions.`,
    fix: 'edit Participant details and correct the municipality/city.'
  },
  addressProvince: {
    location: 'Participant details - Contact details',
    esdcElement: '<province>',
    esdcRule: `${APPENDIX_A}: Province is mandatory for ISET submissions.`,
    fix: 'edit Participant details and select the province/territory.'
  },
  postalCode: {
    location: 'Participant details - Contact details',
    esdcElement: '<postalZIPCode>',
    esdcRule: `${APPENDIX_A}: Postal Code is mandatory for ISET submissions; the guide validates postal code against province.`,
    fix: 'edit Participant details and correct the postal code/province.'
  }
});

function sentence(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function getIlmpParticipantFieldContext(fieldKey) {
  return PARTICIPANT_FIELD_CONTEXT[fieldKey] || null;
}

function buildIlmpIssueMessage({ location, issue, esdcRule, fix }) {
  const parts = [];
  const cleanLocation = String(location || 'ILMP submission').trim();
  const cleanIssue = String(issue || 'Validation issue detected.').trim();
  parts.push(`${cleanLocation}: ${sentence(cleanIssue)}`);
  if (esdcRule) {
    parts.push(`ESDC rule: ${sentence(esdcRule)}`);
  }
  if (fix) {
    parts.push(`Fix: ${sentence(fix)}`);
  }
  return parts.join(' ');
}

function formatIlmpIssueResult(rule) {
  if (!rule || rule.passed !== false) return null;
  return buildIlmpIssueMessage({
    location: rule.location || rule.label || 'ILMP submission',
    issue: rule.message || 'Validation issue detected.',
    esdcRule: rule.esdcRule || rule.source || PATH_REVIEW,
    fix: rule.fix || 'review the participant, action plan, or intervention named in the message.'
  });
}

function collectIlmpIssueMessages(ruleResults, severity) {
  const wanted = String(severity || '').toLowerCase();
  const seen = new Set();
  const messages = [];
  (Array.isArray(ruleResults) ? ruleResults : []).forEach(rule => {
    if (!rule || rule.passed !== false) return;
    const ruleSeverity = String(rule.severity || '').toLowerCase();
    if (wanted && ruleSeverity !== wanted) return;
    const message = formatIlmpIssueResult(rule);
    if (!message || seen.has(message)) return;
    seen.add(message);
    messages.push(message);
  });
  return messages;
}

module.exports = {
  APPENDIX_A,
  APPENDIX_B,
  APPENDIX_C,
  PATH_REVIEW,
  buildIlmpIssueMessage,
  collectIlmpIssueMessages,
  formatIlmpIssueResult,
  getIlmpParticipantFieldContext
};
