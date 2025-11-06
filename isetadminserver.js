const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const { maskName } = require('./src/utils/utils');
const { getInternalNotifications, dismissInternalNotification } = require('./src/internalNotifications');
const {
  createCaseWatch,
  deleteCaseWatch,
  listCaseWatchesForUser,
} = require('./src/server/caseWatchRepository');
const { dispatchInternalNotifications } = require('../shared/events/notificationDispatcher');
const nunjucks = require("nunjucks");
let pool; // Initialized after DB config loads
const { getRenderer: getComponentRenderer } = require('./src/server/componentRenderRegistry');
const { createEventService, EventValidationError, registerNotificationHook } = require('../shared/events');

const ENSURED_HISTORY_EVENT_TYPE_ENUM = { prepared: false };

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CONSENT_PARAGRAPHS = [
  "I, the undersigned, give my expressed and informed consent to the Native Women's Association of Canada and/or its sub-agreement holders to the Indigenous Skills and Employment Training Program (hereinafter referred to as ISET), to collect personal or sensitive information as it relates to my request for funding under the ISET program funded by Employment and Social Development Canada (ESDC). My consent extends to providing my Social Insurance Number (SIN), to determine my eligibility for interventions such as skills training and wage subsidies as part of the Labour Market Development Agreements (LMDA) program.",
  'I acknowledge that the information is collected and administered in accordance with the Privacy Act (R.S.C. 1985, c P-21), the Department Employment and Social Development Canada Act (S.C. 2005, c.34), and the Access to Information Act (R.S.C., 1985, c.A-1). Information collected is to be used to determine eligibility for the ISET program; to measure results of this Agreement and evaluate its success; evaluate the effectiveness of the Program in achieving its objective; and, to meet its obligations of accountability by reporting on the results of the Program.',
  "All information referred to above shall be treated as confidential, and the Native Women's Association of Canada and its sub-agreement holders will take all security measures reasonably necessary for the protection of such information against unauthorized release or disclosure.",
  'Further, I understand that my personal information shall not be used or disclosed for purposes other than those for which it was collected, except with the expressed consent of you, as the client, or as required by law. Personal information shall be retained only as long as necessary for the fulfilment of those purposes.'
];

const CONSENT_LOGO_PATH = path.join(__dirname, 'public', 'nwac-consent-logo.png');
let consentLogoDataUriCache = null;

function getConsentLogoDataUri() {
  if (consentLogoDataUriCache !== null) return consentLogoDataUriCache;
  try {
    const logoBuffer = fs.readFileSync(CONSENT_LOGO_PATH);
    consentLogoDataUriCache = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (err) {
    console.warn('[consent-pdf] Unable to load NWAC logo:', err.message);
    consentLogoDataUriCache = '';
  }
  return consentLogoDataUriCache;
}

function formatConsentDate(value) {
  if (!value) return 'Not signed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const ISET_TEST_DATA_TABLE_ORDER = [
  'iset_internal_notification_dismissal',
  'iset_internal_notification',
  'iset_case_action_item',
  'iset_case_action_plan',
  'iset_case_assessment',
  'iset_case_compliance_check',
  'iset_case_document',
  'iset_case_event',
  'iset_case_financial_snapshot',
  'iset_case_intervention',
  'iset_case_note',
  'iset_case_task',
  'iset_case_watch',
  'iset_event_receipt',
  'iset_event_outbox',
  'iset_event_entry',
  'iset_intake.message_attachment',
  'iset_intake.messages',
  'iset_document',
  'iset_application_version',
  'iset_application_draft_dynamic',
  'iset_application_file',
  'iset_application_submission',
  'iset_application_draft',
  'esdc_participant_submission_history',
  'esdc_participant_submission',
  'esdc_reporting_note',
  'esdc_reporting_package',
  'iset_case',
  'client',
  'iset_application',
];

const SLA_STAGE_PLACEHOLDER = [
  { stage_key: 'intake_triage', display_name: 'Intake triage', target_hours: 24, description: 'Time to first open and triage new application.' },
  { stage_key: 'assignment', display_name: 'Assignment', target_hours: 72, description: 'Time to assign a coordinator or assessor after triage.' },
  { stage_key: 'assessment', display_name: 'Assessment', target_hours: 240, description: 'Working time for assessors to complete review (10 days).' },
  { stage_key: 'program_decision', display_name: 'Program decision', target_hours: 48, description: 'Decision turnaround once assessment is complete.' },
];

const SLA_STAGE_LABELS = SLA_STAGE_PLACEHOLDER.reduce((acc, item) => {
  acc[item.stage_key] = item.display_name;
  return acc;
}, {});

const ACCESS_MATRIX_ROLE_ORDER = ['System Administrator', 'Program Administrator', 'Regional Coordinator', 'Application Assessor'];
const ACCESS_MATRIX_ROLE_ALIASES = {
  'Application Assessor': 'Application Assessor',
  ApplicationAssessor: 'Application Assessor',
  'PTMA Staff': 'Application Assessor',
  PTMAStaff: 'Application Assessor',
  Adjudicator: 'Application Assessor',
  SysAdmin: 'System Administrator',
  'System Admin': 'System Administrator',
  'Program Admin': 'Program Administrator',
  ProgramAdministrator: 'Program Administrator',
};

function canonicaliseAccessRole(role) {
  if (!role) return null;
  const mapped = ACCESS_MATRIX_ROLE_ALIASES[role] || role;
  return String(mapped).trim() || null;
}

function sanitiseAccessRoles(roles = []) {
  const set = new Set();
  if (Array.isArray(roles)) {
    roles.forEach(role => {
      const canonical = canonicaliseAccessRole(role);
      if (canonical) set.add(canonical);
    });
  }
  set.add('System Administrator');
  const ordered = [];
  for (const role of ACCESS_MATRIX_ROLE_ORDER) {
    if (set.has(role)) {
      ordered.push(role);
      set.delete(role);
    }
  }
  if (set.size > 0) {
    Array.from(set).sort().forEach(role => ordered.push(role));
  }
  return ordered;
}

function normaliseAccessControlRoutes(routes = {}) {
  if (!routes || typeof routes !== 'object') return {};
  const entries = Object.entries(routes)
    .filter(([route]) => typeof route === 'string' && route.trim().length > 0)
    .map(([route, allowed]) => {
      const trimmedRoute = route.trim();
      const roleList = sanitiseAccessRoles(Array.isArray(allowed) ? allowed : []);
      return [trimmedRoute, roleList];
    });
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc, [route, allowed]) => {
      acc[route] = allowed;
      return acc;
    }, {});
}

function normaliseAccessControlMatrix(matrix) {
  if (!matrix || typeof matrix !== 'object') {
    return { default: 'deny', routes: {} };
  }
  const rawDefault = typeof matrix.default === 'string' ? matrix.default.trim().toLowerCase() : 'deny';
  const defaultPolicy = rawDefault === 'allow' ? 'allow' : 'deny';
  const routes = normaliseAccessControlRoutes(matrix.routes || {});
  return { default: defaultPolicy, routes };
}


async function ensureEsdcPreparedHistoryEventType(connection) {
  if (ENSURED_HISTORY_EVENT_TYPE_ENUM.prepared) return;
  const executor = connection && typeof connection.query === 'function' ? connection : pool;
  if (!executor || typeof executor.query !== 'function') return;
  try {
    await executor.query(`
      ALTER TABLE esdc_participant_submission_history
      MODIFY COLUMN event_type ENUM('validated','ready','prepared','submitted','accepted','rejected') NOT NULL
    `);
    ENSURED_HISTORY_EVENT_TYPE_ENUM.prepared = true;
  } catch (err) {
    const code = err && err.code;
    if (code === 'ER_NO_SUCH_TABLE') {
      ENSURED_HISTORY_EVENT_TYPE_ENUM.prepared = true;
      return;
    }
    if (code === 'ER_TABLEACCESS_DENIED_ERROR') {
      console.warn('[esdc] insufficient privileges to alter history event_type enum:', err.message);
      return;
    }
    if (code && code.startsWith('ER_')) {
      const message = err.message || '';
      if (/duplicate/i.test(message) || /already exists/i.test(message)) {
        ENSURED_HISTORY_EVENT_TYPE_ENUM.prepared = true;
        return;
      }
    }
    if (!ENSURED_HISTORY_EVENT_TYPE_ENUM.prepared) {
      console.warn('[esdc] failed to ensure prepared event history enum:', err.message || err);
    }
  }
}

async function ensureEsdcParticipantSubmissionRecord(db, caseId, applicationId) {
  if (!caseId) return;
  const executor = db && typeof db.query === 'function' ? db : pool;
  if (!executor) return;
  try {
    await executor.query(
      `INSERT INTO esdc_participant_submission (
         case_id,
         application_id,
         readiness_status,
         readiness_summary,
         warnings,
         blocking_issues,
         last_validated_at,
         submission_status,
         submitted_at,
         submitted_by_user_id,
         payload_snapshot,
         payload_storage_key,
         payload_checksum,
         rejection_reason
       ) VALUES (?, ?, 'needs_review', NULL, NULL, NULL, NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL)
       ON DUPLICATE KEY UPDATE
         application_id = VALUES(application_id),
         readiness_status = 'needs_review',
         readiness_summary = NULL,
         warnings = NULL,
         blocking_issues = NULL,
         last_validated_at = NULL,
         submission_status = 'pending',
         submitted_at = NULL,
         submitted_by_user_id = NULL,
         payload_snapshot = NULL,
         payload_storage_key = NULL,
         payload_checksum = NULL,
         rejection_reason = NULL,
         updated_at = NOW()`,
      [caseId, applicationId || null]
    );
  } catch (err) {
    console.error('[esdc] ensure participant submission failed', err);
  }
}

async function markEsdcParticipantSubmissionNeedsReview(db, caseId, options = {}) {
  if (!caseId) return;
  const executor = db && typeof db.query === 'function' ? db : pool;
  if (!executor) return;
  const { resetSnapshot = true, resetSubmissionStatus = true } = options;
  const assignments = [
    "readiness_status = 'needs_review'",
    'readiness_summary = NULL',
    'warnings = NULL',
    'blocking_issues = NULL',
    'last_validated_at = NULL',
    'updated_at = NOW()'
  ];
  if (resetSnapshot) {
    assignments.push(
      'payload_snapshot = NULL',
      'payload_storage_key = NULL',
      'payload_checksum = NULL',
      'rejection_reason = NULL'
    );
  }
  if (resetSubmissionStatus) {
    assignments.push(
      "submission_status = 'pending'",
      'submitted_at = NULL',
      'submitted_by_user_id = NULL'
    );
  }
  try {
    const sql = `UPDATE esdc_participant_submission SET ${assignments.join(', ')} WHERE case_id = ?`;
    await executor.query(sql, [caseId]);
  } catch (err) {
    console.error('[esdc] mark participant submission needs review failed', err);
  }
}

const { ILMP_PARTICIPANT_RULES, PROVINCE_CODES } = require('./src/server/esdcIlmpParticipantRules');
const GENDER_VALUE_MAP = {
  male: 'male',
  man: 'male',
  m: 'male',
  '1': 'female',
  female: 'female',
  woman: 'female',
  f: 'female',
  'two spirit': 'unspecified',
  'transgender woman': 'unspecified',
  'gender diverse': 'unspecified',
  '2': 'unspecified',
  '3': 'unspecified',
  '4': 'unspecified',
  '5': 'unspecified',
  'prefer not to say': 'unspecified',
  unspecified: 'unspecified',
  unknown: 'unspecified',
  other: 'unspecified'
};

const INDIGENOUS_VALUE_MAP = {
  'first_nations_status': 'registered-indian',
  'first nations (status)': 'registered-indian',
  'registered indian': 'registered-indian',
  'first_nations_non_status': 'non-status-indian',
  'first nations (non-status)': 'non-status-indian',
  metis: 'metis',
  'm\u00e9tis': 'metis',
  'métis': 'metis',
  inuit: 'inuit'
};

const PROVINCE_CODE_MAP = {
  ab: 'AB',
  alberta: 'AB',
  bc: 'BC',
  'british columbia': 'BC',
  mb: 'MB',
  manitoba: 'MB',
  nb: 'NB',
  'new brunswick': 'NB',
  nl: 'NL',
  'newfoundland and labrador': 'NL',
  ns: 'NS',
  'nova scotia': 'NS',
  nt: 'NT',
  'northwest territories': 'NT',
  nu: 'NU',
  nunavut: 'NU',
  on: 'ON',
  ontario: 'ON',
  pe: 'PE',
  'prince edward island': 'PE',
  qc: 'QC',
  quebec: 'QC',
  sk: 'SK',
  saskatchewan: 'SK',
  yt: 'YT',
  'yukon territory': 'YT',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  other: 'OT',
  'other country': 'OT'
};

function normaliseString(value) {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = normaliseString(entry);
      if (candidate) return candidate;
    }
    return null;
  }
  if (typeof value === 'object') {
    if (value && typeof value.value !== 'undefined') {
      return normaliseString(value.value);
    }
    if (value && typeof value.text !== 'undefined') {
      return normaliseString(value.text);
    }
    try {
      return normaliseString(JSON.stringify(value));
    } catch {
      return null;
    }
  }
  return null;
}

function cleanSin(raw) {
  const str = normaliseString(raw);
  if (!str) return null;
  const digits = str.replace(/\D/g, '');
  return digits.length === 0 ? null : digits;
}

function isValidSin(digits) {
  if (!/^\d{9}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function parseDate(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const str = normaliseString(value);
  if (!str) return null;
  // Accept YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, ISO 8601
  const normalized = str.replace(/\//g, '-');
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date;
  // Attempt to flip DD-MM-YYYY
  const parts = normalized.split('-');
  if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
    const [dd, mm, yyyy] = parts;
    const iso = `${yyyy}-${mm}-${dd}`;
    const fallback = new Date(iso);
    if (!Number.isNaN(fallback.getTime())) return fallback;
  }
  return null;
}

function calculateAge(date) {
  if (!date) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

function extractSin(context) {
  const { payload = {}, answers = {} } = context;
  const personal = payload.personal || {};
  const candidates = [
    personal.sin,
    personal.social_insurance_number,
    personal.socialInsuranceNumber,
    answers.sin,
    answers['sin-number'],
    answers['sin_number'],
    answers['social-insurance-number'],
    answers['social_insurance_number'],
    answers['personal-sin'],
    answers['personal_sin'],
    answers['identity_sin']
  ];
  for (const value of candidates) {
    const normalized = cleanSin(value);
    if (normalized) return normalized;
  }
  return null;
}

function extractDob(context) {
  const { payload = {}, answers = {} } = context;
  const personal = payload.personal || {};
  const candidates = [
    personal.date_of_birth,
    personal.dateOfBirth,
    answers['date-of-birth'],
    answers['dob'],
    answers['birth-date'],
    answers['birthdate'],
    answers['personal-date-of-birth']
  ];
  for (const value of candidates) {
    const date = parseDate(value);
    if (date) return date;
  }
  return null;
}

function extractGender(context) {
  const { payload = {}, answers = {} } = context;
  const personal = payload.personal || {};
  const candidates = [
    personal.gender,
    personal.sex,
    answers.gender,
    answers['personal-gender'],
    answers['sex'],
    answers['gender-identity'],
    answers['what-is-your-gender-identity']
  ];
  for (const value of candidates) {
    const normalized = normaliseString(value);
    if (!normalized) continue;
    const mapped = GENDER_VALUE_MAP[normalized.toLowerCase()];
    if (mapped) return mapped;
    return normalized;
  }
  return null;
}

function extractFirstName(context) {
  const { payload = {}, answers = {} } = context;
  const personal = payload.personal || {};
  const candidates = [
    personal.first_name,
    personal.firstName,
    personal.given_name,
    personal.givenName,
    answers['first-name'],
    answers['first_name'],
    answers['given-name'],
    answers['given_name'],
    answers['personal-first-name'],
    answers['personal_first_name'],
    answers['personal-given-name'],
    answers['personal_given_name']
  ];
  for (const value of candidates) {
    const normalised = normaliseString(value);
    if (normalised) return normalised;
  }
  return null;
}

function extractLastName(context) {
  const { payload = {}, answers = {} } = context;
  const personal = payload.personal || {};
  const candidates = [
    personal.last_name,
    personal.lastName,
    personal.family_name,
    personal.familyName,
    answers['last-name'],
    answers['last_name'],
    answers['family-name'],
    answers['family_name'],
    answers['personal-last-name'],
    answers['personal_last_name'],
    answers['personal-family-name'],
    answers['personal_family_name']
  ];
  for (const value of candidates) {
    const normalised = normaliseString(value);
    if (normalised) return normalised;
  }
  return null;
}

function extractMiddleInitials(context) {
  const { payload = {}, answers = {} } = context;
  const personal = payload.personal || {};
  const candidates = [
    personal.middle_name,
    personal.middleName,
    personal.middle_initials,
    personal.middleInitials,
    answers['middle-name'],
    answers['middle-names'],
    answers['middle_names'],
    answers['middle_name'],
    answers['middle-initial'],
    answers['middle_initial'],
    answers['personal-middle-name'],
    answers['personal_middle_name'],
    answers['personal-middle-initials'],
    answers['personal_middle_initials']
  ];
  for (const value of candidates) {
    const normalised = normaliseString(value);
    if (normalised) {
      if (normalised.length === 1) return normalised.toUpperCase();
      return normalised
        .split(/\s+/)
        .map(part => part[0]?.toUpperCase())
        .filter(Boolean)
        .join('');
    }
  }
  return null;
}

function extractIndigenousIdentity(context) {
  const { payload = {}, answers = {} } = context;
  const personal = payload.personal || {};
  const candidates = [
    personal.indigenous_identity,
    personal.indigenousIdentity,
    personal.indigenous_group,
    personal.indigenousGroup,
    answers['indigenous-identity'],
    answers['indigenous_identity'],
    answers['indigenous-group'],
    answers['indigenous_group'],
    answers['identity-indigenous'],
    answers['legal-indigenous-identity']
  ];
  for (const value of candidates) {
    if (value === null || typeof value === 'undefined') continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const normalized = normaliseString(entry);
        if (normalized) {
          const mapped = INDIGENOUS_VALUE_MAP[normalized.toLowerCase()] || normalized;
          return mapped;
        }
      }
    } else {
      const normalized = normaliseString(value);
      if (normalized) {
        const mapped = INDIGENOUS_VALUE_MAP[normalized.toLowerCase()] || normalized;
        return mapped;
      }
    }
  }
  return null;
}

function extractAddressFromStructuredObject(object) {
  if (!object || typeof object !== 'object') return null;
  const line1 = normaliseString(object.line1 || object.address1 || object.address_line_1 || object.street || object.street1 || object.addressLine1 || object.address);
  const city = normaliseString(object.city || object.town || object.municipality);
  const provinceRaw = normaliseString(object.province || object.province_code || object.region || object.state || object.territory);
  const postalCode = normaliseString(object.postal_code || object.postalCode || object.postcode || object.zip || object.zipcode);
  const province = provinceRaw ? (PROVINCE_CODE_MAP[provinceRaw.toLowerCase()] || provinceRaw.toUpperCase()) : null;
  if (!line1 && !city && !province && !postalCode) return null;
  return { line1, city, province, postalCode };
}

function extractAddress(context) {
  const { payload = {}, answers = {} } = context;
  const personal = payload.personal || {};
  const contact = payload.contact || {};

  const candidateObjects = [
    personal.address,
    personal.home_address,
    personal.homeAddress,
    contact.home_address,
    contact.homeAddress,
    contact.address,
    answers['home-address'],
    answers['home_address'],
    answers['address'],
    answers['residential-address'],
    answers['residential_address'],
    {
      line1: answers['address-street-address'] || answers['address_street_address'],
      city: answers['address-city'] || answers['address_city'],
      province: answers['address-province'] || answers['address_province'],
      postalCode: answers['address-postcode'] || answers['address_postcode']
    }
  ];

  for (const candidate of candidateObjects) {
    const structured = extractAddressFromStructuredObject(candidate);
    if (structured) return structured;
    if (typeof candidate === 'string') {
      const normalized = normaliseString(candidate);
      if (normalized) {
        return { line1: normalized };
      }
    }
  }

  const derived = {
    line1: normaliseString(answers['home-address-line-1'] || answers['home_address_line_1'] || answers['home-address-line1'] || answers['address-line-1'] || answers['street-address']),
    line2: normaliseString(answers['home-address-line-2'] || answers['home_address_line_2'] || answers['address-line-2']),
    city: normaliseString(answers['home-address-city'] || answers['home_address_city'] || answers['address-city'] || answers['address_city'] || answers['city']),
    province: normaliseString(answers['home-address-province'] || answers['home_address_province'] || answers['address-province'] || answers['address_province'] || answers['province'] || answers['territory'] || answers['state']),
    postalCode: normaliseString(answers['home-address-postal-code'] || answers['home_address_postal_code'] || answers['address-postcode'] || answers['address_postcode'] || answers['postal-code'] || answers['postal_code'] || answers['postcode'] || answers['zip'])
  };

  if (derived.line1 || derived.city || derived.province || derived.postalCode) {
    const provinceCode = derived.province ? (PROVINCE_CODE_MAP[derived.province.toLowerCase()] || derived.province.toUpperCase()) : null;
    return { line1: derived.line1, city: derived.city, province: provinceCode, postalCode: derived.postalCode };
  }

  if (personal.address_line_1 || personal.addressLine1 || personal.address1) {
    return {
      line1: normaliseString(personal.address_line_1 || personal.addressLine1 || personal.address1),
      city: normaliseString(personal.city),
      province: normaliseString(personal.province),
      postalCode: normaliseString(personal.postal_code || personal.postalCode)
    };
  }

  return null;
}

function coerceBoolean(value) {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (!normalised) return null;
    if (['yes', 'y', 'true', 't', '1', 'on'].includes(normalised)) return true;
    if (['no', 'n', 'false', 'f', '0', 'off'].includes(normalised)) return false;
  }
  return null;
}

function formatBooleanAsYesNo(value) {
  if (value === null || typeof value === 'undefined') return null;
  return value ? 'Yes' : 'No';
}

function extractPreferredName(context) {
  const { answers = {} } = context;
  return normaliseString(
    answers['preferred-name'] ||
    answers['preferred_name'] ||
    answers['preferredName']
  );
}

function extractMaritalStatus(context) {
  const { answers = {} } = context;
  const raw = normaliseString(
    answers['marital-status'] ||
    answers['marital_status'] ||
    answers['maritalStatus']
  );
  if (!raw) return null;
  const key = raw.toLowerCase();
  return MARITAL_STATUS_LABELS[key] || raw.charAt(0).toUpperCase() + raw.slice(1);
}

function extractDependentChildrenInfo(context) {
  const { answers = {} } = context;
  const indicator = answers['dependent-children'] ??
    answers['dependent_children'] ??
    answers['dependentChildren'] ??
    answers['dependent_children_indicator'];
  const hasDependents = coerceBoolean(indicator);
  const countRaw = answers['dependent-children-count'] ??
    answers['dependent_children_count'] ??
    answers['number-of-dependent-children'];
  let count = null;
  if (typeof countRaw !== 'undefined' && countRaw !== null) {
    const numeric = Number(String(countRaw).trim());
    if (Number.isFinite(numeric) && numeric >= 0) {
      count = Math.round(numeric);
    }
  }
  const agesRaw = normaliseString(
    answers['ages-of-children'] ||
    answers['ages_of_children'] ||
    answers['dependent-children-ages']
  );
  let ages = [];
  if (agesRaw) {
    ages = agesRaw
      .split(/[^0-9]+/)
      .map(part => part.trim())
      .filter(part => part.length > 0);
    if (ages.length && (count === null || count === 0)) {
      count = ages.length;
    }
  }
  if (count === null && hasDependents === false) {
    count = 0;
  }
  if (count === null && hasDependents === true) {
    count = Math.max(1, ages.length || 1);
  }
  return { count, ages };
}

function extractLanguageSpoken(context) {
  const { answers = {} } = context;
  const languageRaw = normaliseString(
    answers['language-spoken'] ||
    answers['language_spoken'] ||
    answers['preferred-language'] ||
    answers['preferred_language']
  );
  if (!languageRaw) return null;
  const key = languageRaw.toLowerCase();
  if (LANGUAGE_SPOKEN_MAP[key]) return LANGUAGE_SPOKEN_MAP[key];
  if (key.includes('english') && key.includes('french')) return 'English and French';
  if (key.includes('english')) return 'English only';
  if (key.includes('french')) return 'French only';
  if (key.includes('aboriginal')) return 'Aboriginal language(s) only';
  return languageRaw;
}

function extractVisibleMinority(context) {
  const { answers = {} } = context;
  const raw = answers['visible-minority'] || answers['visible_minority'];
  const bool = coerceBoolean(raw);
  return formatBooleanAsYesNo(bool);
}

function extractDisabilityInfo(context) {
  const { answers = {} } = context;
  const raw = answers['has-disability'] || answers['has_disability'] || answers['disability'];
  const declared = coerceBoolean(raw);
  const description = normaliseString(
    answers['disability-description'] ||
    answers['disability_description'] ||
    answers['disabilityDetails']
  );
  return {
    declared: formatBooleanAsYesNo(declared),
    description: declared ? description || null : null
  };
}

function extractContactDetails(context) {
  const { answers = {} } = context;
  const email = normaliseString(
    answers['contact-email-address'] ||
    answers['contact_email_address'] ||
    answers['email']
  );
  const phone = normaliseString(
    answers['telephone-day'] ||
    answers['telephone_day'] ||
    answers['phone']
  );
  const alternatePhone = normaliseString(
    answers['telephone-alt'] ||
    answers['telephone_alt'] ||
    answers['alternate-phone']
  );
  const mailingAddress = normaliseString(
    answers['address-mailing-address'] ||
    answers['address_mailing_address'] ||
    answers['mailing-address']
  );
  const homeCommunity = normaliseString(
    answers['home-comminuty'] ||
    answers['home_community'] ||
    answers['home-community']
  );
  if (!email && !phone && !alternatePhone && !mailingAddress && !homeCommunity) {
    return null;
  }
  return { email, phone, alternatePhone, mailingAddress, homeCommunity };
}

function extractEmergencyContactDetails(context) {
  const { answers = {} } = context;
  const name = normaliseString(
    answers['emergency-contact-name'] ||
    answers['emergency_contact_name']
  );
  const relationship = normaliseString(
    answers['emergency-contact-relationship'] ||
    answers['emergency_contact_relationship']
  );
  const phone = normaliseString(
    answers['emergency-contact-telephone'] ||
    answers['emergency_contact_telephone']
  );
  if (!name && !relationship && !phone) return null;
  return { name, relationship, phone };
}

function extractAgreementNumber(context) {
  const { answers = {}, submissionRow } = context;
  const registration = normaliseString(
    answers['agreement-number'] ||
    answers['agreement_number'] ||
    answers['registration-number'] ||
    answers['registration_number']
  );
  if (registration) return registration;
  const snapshotRef = submissionRow?.reference_number || null;
  return snapshotRef || null;
}

function extractClientStatusDetails(context) {
  const { answers = {} } = context;
  const rawStatus = normaliseString(
    answers['client-status-at-intake'] ||
    answers['client_status_at_intake'] ||
    answers['labour-force-status'] ||
    answers['labour_force_status']
  );
  const key = rawStatus ? rawStatus.toLowerCase() : null;
  const statusLabel = key ? (CLIENT_STATUS_MAP[key] || rawStatus) : null;
  const scheduleKey = key || '';
  const scheduleType = EMPLOYMENT_SCHEDULE_MAP[scheduleKey] || null;
  const noc = normaliseString(
    answers['employment-noc'] ||
    answers['employment_noc'] ||
    answers['previous-employment-noc']
  );
  const nocVersion = normaliseString(
    answers['employment-noc-version'] ||
    answers['employment_noc_version'] ||
    answers['previous-employment-noc-version']
  );
  return {
    status: statusLabel || null,
    scheduleType: scheduleType,
    noc: noc || null,
    nocVersion: nocVersion || null
  };
}

function extractEducationDetails(context) {
  const { answers = {} } = context;
  const levelRaw = normaliseString(
    answers['education-level'] ||
    answers['education_level'] ||
    answers['example-radio-2'] ||
    answers['highest-education']
  );
  let level = null;
  if (levelRaw) {
    const key = levelRaw.toLowerCase();
    if (EDUCATION_LEVEL_MAP[key]) {
      level = EDUCATION_LEVEL_MAP[key];
    } else {
      level = levelRaw;
    }
  }
  const year = normaliseString(
    answers['education-year'] ||
    answers['education_year']
  );
  const location = normaliseString(
    answers['education-location'] ||
    answers['education_location'] ||
    answers['edication-location']
  );
  if (!level && !year && !location) return null;
  return {
    level: level,
    yearCompleted: year,
    location: location
  };
}

function extractSocialAssistanceStatus(context) {
  const { answers = {} } = context;
  const raw = answers['social-assistance'] ||
    answers['social_assistance'] ||
    answers['socialAssistance'];
  return formatBooleanAsYesNo(coerceBoolean(raw));
}

function extractEiClaimant(context, clientStatus) {
  const { answers = {} } = context;
  const explicit = normaliseString(
    answers['ei-claimant'] ||
    answers['ei_claimant']
  );
  if (explicit) {
    return explicit;
  }
  if (clientStatus?.status === 'Employed') {
    return 'Employment insurance claimant';
  }
  return 'Non-insured client';
}

function extractEmploymentBarriers(context) {
  const { answers = {} } = context;
  const rawBarriers = answers.barriers ||
    answers['barriers'] ||
    answers['barrier-to-employment'] ||
    answers['barrier_to_employment'];
  let list = [];
  if (Array.isArray(rawBarriers)) {
    list = rawBarriers;
  } else if (typeof rawBarriers === 'string') {
    list = rawBarriers.split(',').map(item => item.trim()).filter(Boolean);
  }
  const mapped = [];
  list.forEach(item => {
    const key = String(item || '').trim().toLowerCase();
    if (!key) return;
    const label = BARRIER_VALUE_MAP[key] || item;
    if (label) mapped.push(label);
  });
  const otherDescription = normaliseString(
    answers['other-barrier'] ||
    answers['other_barrier']
  );
  if (otherDescription) {
    mapped.push(`Other: ${otherDescription}`);
  }
  return mapped;
}

function extractRequestedSupports(context) {
  const { answers = {} } = context;
  const rawSupports = answers['requested-supports'] ||
    answers['requested_supports'] ||
    answers['supports-requested'];
  let list = [];
  if (Array.isArray(rawSupports)) {
    list = rawSupports;
  } else if (typeof rawSupports === 'string') {
    list = rawSupports.split(',').map(item => item.trim()).filter(Boolean);
  }
  const mapped = list
    .map(item => {
      const key = String(item || '').trim().toLowerCase();
      return REQUESTED_SUPPORTS_MAP[key] || item;
    })
    .filter(Boolean);
  const otherDescription = normaliseString(
    answers['other-requested-support'] ||
    answers['other_requested_support']
  );
  return {
    list: mapped,
    otherDescription: otherDescription || null
  };
}

function mapInterventionOutcome(value) {
  const normalised = normaliseString(value);
  if (!normalised) return null;
  const key = normalised.toLowerCase();
  if (['completed', 'complete'].includes(key)) return 'Completed';
  if (['in progress', 'in-progress', 'inprogress', 'ongoing'].includes(key)) return 'In progress';
  if (['incomplete'].includes(key)) return 'Incomplete';
  if (['failed', 'failed to report', 'failed-to-report'].includes(key)) return 'Failed to report';
  if (['cancelled', 'canceled'].includes(key)) return 'Cancelled';
  if (['rescheduled'].includes(key)) return 'Rescheduled';
  return normalised;
}

function extractActionPlanDetails(context, clientStatus, requestedSupports) {
  const { answers = {}, caseRow, applicationRow, caseAssessmentRow, caseActionPlans } = context;
  const assessment = caseAssessmentRow || {};

  const selectCasePlan = plans => {
    if (!Array.isArray(plans) || plans.length === 0) return null;
    const priorities = {
      active: 0,
      draft: 1,
      closed: 2,
      archived: 3,
    };
    return [...plans]
      .sort((a, b) => {
        const sa = (a.status || '').toLowerCase();
        const sb = (b.status || '').toLowerCase();
        const pa = priorities[sa] ?? 4;
        const pb = priorities[sb] ?? 4;
        if (pa !== pb) return pa - pb;
        const dateA = a.activatedAt || a.effectiveDate || a.createdAt || null;
        const dateB = b.activatedAt || b.effectiveDate || b.createdAt || null;
        if (dateA && dateB) {
          const diff = new Date(dateB).getTime() - new Date(dateA).getTime();
          if (diff !== 0 && Number.isFinite(diff)) return diff < 0 ? -1 : 1;
        }
        return (b.id || 0) - (a.id || 0);
      })[0];
  };

  const normaliseNumericString = (value, { min = null, max = null } = {}) => {
    if (value === null || typeof value === "undefined" || value === "") return null;
    let candidate = null;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      candidate = Math.trunc(value);
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const cleaned = trimmed.replace(/[^\d-]/g, "");
      if (!cleaned) return null;
      const parsed = Number.parseInt(cleaned, 10);
      if (!Number.isFinite(parsed)) return null;
      candidate = parsed;
    } else {
      return null;
    }
    if (min !== null && candidate < min) return null;
    if (max !== null && candidate > max) return null;
    return String(candidate);
  };

  const formatDateValue = value => {
    const parsed = parseDate(value);
    return parsed ? parsed.toISOString().slice(0, 10) : null;
  };

  const plannedSupports = requestedSupports?.list && requestedSupports.list.length ? requestedSupports.list : [];

  const mapCaseIntervention = intervention => {
    if (!intervention) return null;
    const metadata = intervention.metadata || {};
    const startDate = intervention.startDate ? formatDateValue(intervention.startDate) : null;
    const endDate = intervention.endDate ? formatDateValue(intervention.endDate) : null;

    let duration = null;
    if (startDate && endDate) {
      const start = parseDate(startDate);
      const end = parseDate(endDate);
      if (start && end) {
        const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        if (Number.isFinite(diffDays) && diffDays >= 0 && diffDays <= 999) {
          duration = String(diffDays);
        }
      }
    }
    if (!duration) {
      if (Number.isFinite(metadata.durationDays)) {
        duration = normaliseNumericString(metadata.durationDays, { min: 0, max: 999 });
      } else if (Number.isFinite(metadata.durationWeeks)) {
        const days = Math.round(Number(metadata.durationWeeks) * 7);
        if (Number.isFinite(days) && days >= 0 && days <= 999) {
          duration = String(days);
        }
      }
    }

    const normaliseCost = value => normaliseNumericString(value, { min: 0, max: 999999 });
    const metadataCostSettings = metadata && typeof metadata === "object" && metadata.costSettings && typeof metadata.costSettings === "object"
      ? metadata.costSettings
      : null;
    const metadataRecurrence = metadata && typeof metadata === "object" && metadata.recurrence && typeof metadata.recurrence === "object"
      ? metadata.recurrence
      : null;
    const multiplyIfNumeric = (left, right) => {
      const a = Number(left);
      const b = Number(right);
      return Number.isFinite(a) && Number.isFinite(b) ? a * b : null;
    };
    const metadataCostCandidates = [];
    if (metadataCostSettings) {
      metadataCostCandidates.push(
        metadataCostSettings.calculatedTotal,
        metadataCostSettings.total,
        multiplyIfNumeric(metadataCostSettings.amountPerPeriod, metadataCostSettings.occurrences)
      );
    }
    if (metadataRecurrence) {
      metadataCostCandidates.push(
        metadataRecurrence.calculatedTotal,
        metadataRecurrence.total,
        multiplyIfNumeric(metadataRecurrence.amountPerPeriod, metadataRecurrence.occurrences)
      );
    }
    const costCandidates = [
      intervention.actualAmount,
      intervention.approvedAmount,
      intervention.budgetAmount,
      metadata.cost,
      ...metadataCostCandidates,
      intervention.cost
    ];
    let cost = null;
    for (const candidate of costCandidates) {
      if (typeof candidate === "undefined") continue;
      const normalised = normaliseCost(candidate);
      if (normalised !== null) {
        cost = normalised;
        break;
      }
    }

    const codeCandidate = metadata.code ?? intervention.code ?? intervention.intervention_type ?? null;
    const code = normaliseNumericString(codeCandidate, { min: 0, max: 99 });

    const outcome = mapInterventionOutcome(intervention.outcome ?? intervention.outcomeCode ?? metadata.outcome);

    const supports = Array.isArray(metadata.supports) && metadata.supports.length
      ? metadata.supports
      : plannedSupports;

    const notes = [];
    if (metadata.notes) {
      if (Array.isArray(metadata.notes)) {
        metadata.notes.forEach(note => {
          if (note) notes.push(String(note));
        });
      } else if (typeof metadata.notes === "string") {
        metadata.notes.split(/\r?\n/).forEach(line => {
          if (line.trim()) notes.push(line.trim());
        });
      }
    }
    if (intervention.notes && typeof intervention.notes === "string") {
      intervention.notes.split(/\r?\n/).forEach(line => {
        if (line.trim()) notes.push(line.trim());
      });
    }

    const relatedNoc = metadata.noc || intervention.noc || clientStatus?.noc || null;
    const relatedNocVersion = metadata.nocVersion || intervention.nocVersion || clientStatus?.nocVersion || null;

    if (!code && !startDate && !endDate && !outcome && !duration && !cost && !notes.length && !supports.length) {
      return null;
    }

    return {
      code,
      description: metadata.title || intervention.title || intervention.description || null,
      startDate,
      endDate,
      outcome,
      duration,
      cost,
      relatedNoc,
      relatedNocVersion,
      supports: supports && supports.length ? supports : null,
      notes,
    };
  };

  const casePlan = selectCasePlan(caseActionPlans);
  if (casePlan) {
    const metadata = casePlan.metadata || {};
    const planStartDate = formatDateValue(casePlan.effectiveDate) || (casePlan.interventions?.length ? formatDateValue(casePlan.interventions[0].startDate) : null);
    const planResultDate = formatDateValue(casePlan.resultDate);
    const planResultCode = normaliseString(casePlan.resultCode || metadata.resultCode || null);

    const resolveBoolean = value => {
      if (typeof value === "string") {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === "yes" || trimmed === "no") {
          return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        }
      }
      const coerced = coerceBoolean(value);
      if (coerced === null) return null;
      return formatBooleanAsYesNo(coerced);
    };

    const planChildcareNeed = (
      resolveBoolean(casePlan.childcareNeed) ??
      resolveBoolean(metadata.childcareNeed ?? metadata.childcare_need) ??
      null
    );

    const planChildcareFunding = metadata.childcareFunding ?? metadata.childcare_funding ?? casePlan.childcareFunding ?? null;

    const planGoalDescription = (
      metadata.goalDescription ??
      metadata.goal ??
      casePlan.goalDescription ??
      casePlan.summary ??
      null
    );

    const mappedInterventions = Array.isArray(casePlan.interventions)
      ? casePlan.interventions.map(mapCaseIntervention).filter(Boolean)
      : [];

    if (
      !planStartDate &&
      !planResultDate &&
      !planResultCode &&
      !planChildcareNeed &&
      !planChildcareFunding &&
      !planGoalDescription &&
      mappedInterventions.length === 0
    ) {
      // fall back to assessment/application data
    } else {
      return {
        startDate: planStartDate,
        resultDate: planResultDate,
        resultCode: planResultCode,
        childcareNeed: planChildcareNeed,
        childcareFunding: planChildcareFunding,
        goalDescription: planGoalDescription || normaliseString(answers['long-term-goal'] || answers['long_term_goal']) || null,
        interventions: mappedInterventions,
      };
    }
  }

  const startRaw = answers['action-plan-start-date'] || answers['action_plan_start_date'];
  const resultDateRaw = answers['action-plan-result-date'] || answers['action_plan_result_date'];
  const resultCodeRaw = answers['action-plan-result-code'] || answers['action_plan_result_code'];
  const childcareNeedRaw = answers['action-plan-childcare-need'] || answers['action_plan_childcare_need'];
  const childcareFundingRaw = answers['action-plan-childcare-funding'] || answers['action_plan_childcare_funding'];
  const targetProgramRaw = normaliseString(answers['target-program'] || answers['target_program']);
  const goalDescription = normaliseString(answers['long-term-goal'] || answers['long_term_goal']);

  const startDateSource =
    parseDate(startRaw) ||
    (caseRow?.created_at ? new Date(caseRow.created_at) : null) ||
    (applicationRow?.row?.created_at ? new Date(applicationRow.row.created_at) : null);

  const startDate = formatDateValue(assessment.plan_start_date) ||
    (startDateSource ? startDateSource.toISOString().slice(0, 10) : null);

  const resultDate =
    formatDateValue(assessment.action_plan_result_date) ||
    formatDateValue(resultDateRaw);

  const resultCode =
    normaliseString(assessment.action_plan_result_code) ||
    normaliseString(resultCodeRaw);

  const childcareNeed = (() => {
    const assessmentNeed = coerceBoolean(
      typeof assessment.childcare_need !== 'undefined' && assessment.childcare_need !== null
        ? assessment.childcare_need
        : null
    );
    if (assessmentNeed !== null) {
      return formatBooleanAsYesNo(assessmentNeed);
    }
    return formatBooleanAsYesNo(coerceBoolean(childcareNeedRaw));
  })();

  const childcareFunding =
    normaliseString(assessment.childcare_funding_details) ||
    normaliseString(childcareFundingRaw);

  const fundingSummary = assessment ? summariseAssessmentFunding(assessment) : null;

  const interventionStart =
    formatDateValue(assessment.intervention_start_date) ||
    formatDateValue(answers['intervention-start-date'] || answers['intervention_start_date']) ||
    (startDateSource ? startDateSource.toISOString().slice(0, 10) : null);

  const interventionEnd =
    formatDateValue(assessment.intervention_end_date) ||
    formatDateValue(answers['intervention-end-date'] || answers['intervention_end_date']);

  const interventionCode = normaliseNumericString(assessment.intervention_code, { min: 1, max: 99 });
  const interventionOutcomeCode = normaliseNumericString(assessment.intervention_outcome_code, { min: 1, max: 99 });
  const interventionDuration = normaliseNumericString(assessment.intervention_duration_days, { min: 0, max: 999 });
  const interventionCost = normaliseNumericString(assessment.intervention_cost_total, { min: 0, max: 999999 });
  const interventionNoc = normaliseString(assessment.intervention_related_noc);
  const interventionNocVersion = normaliseString(assessment.intervention_related_noc_version);

  let computedDuration = interventionDuration;
  if (!computedDuration && interventionStart && interventionEnd) {
    const startDateObj = parseDate(interventionStart);
    const endDateObj = parseDate(interventionEnd);
    if (startDateObj && endDateObj) {
      const diffDays = Math.round((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
      if (Number.isFinite(diffDays) && diffDays >= 0 && diffDays <= 999) {
        computedDuration = String(diffDays);
      }
    }
  }

  const effectiveCost = (() => {
    if (interventionCost) return interventionCost;
    if (!fundingSummary) return null;
    const rounded = Math.round(fundingSummary.total);
    if (!Number.isFinite(rounded) || rounded < 0) return null;
    return String(rounded);
  })();

  const interventionOutcome =
    interventionOutcomeCode ||
    mapInterventionOutcome(answers['intervention-outcome'] || answers['intervention_outcome']) ||
    null;

  const interventionDescription = (() => {
    if (normaliseString(assessment.program_name)) return normaliseString(assessment.program_name);
    if (targetProgramRaw) return targetProgramRaw;
    if (normaliseString(assessment.institution)) return normaliseString(assessment.institution);
    return null;
  })();

  const supports = requestedSupports?.list && requestedSupports.list.length
    ? requestedSupports.list
    : [];

  const interventionNotes = [];
  if (requestedSupports?.otherDescription) {
    interventionNotes.push(requestedSupports.otherDescription);
  }
  if (goalDescription) {
    interventionNotes.push(goalDescription);
  }
  if (fundingSummary && fundingSummary.breakdown.length) {
    const breakdown = fundingSummary.breakdown
      .map(entry => `${entry.label}: ${entry.display}`)
      .join('; ');
    if (breakdown) {
      interventionNotes.push(`Funding breakdown - ${breakdown}`);
    }
  }

  const interventions = [];
  const shouldIncludeIntervention =
    interventionCode ||
    interventionDescription ||
    interventionStart ||
    interventionEnd ||
    interventionOutcome ||
    computedDuration ||
    effectiveCost ||
    interventionNoc ||
    interventionNocVersion ||
    supports.length ||
    interventionNotes.length;

  if (shouldIncludeIntervention) {
    interventions.push({
      code: interventionCode,
      description: interventionDescription,
      startDate: interventionStart,
      endDate: interventionEnd,
      outcome: interventionOutcome,
      duration: computedDuration,
      cost: effectiveCost,
      relatedNoc: interventionNoc || clientStatus?.noc || null,
      relatedNocVersion: interventionNocVersion || clientStatus?.nocVersion || null,
      supports,
      notes: interventionNotes.length ? interventionNotes : null
    });
  }

  if (!startDate && !resultDate && !resultCode && !childcareNeed && !interventions.length && !goalDescription) {
    return null;
  }

  return {
    startDate,
    resultDate,
    resultCode,
    childcareNeed,
    childcareFunding,
    goalDescription,
    interventions
  };
}

function isValidCanadianPostalCode(value) {
  if (!value) return false;
  return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(value.trim());
}

function evaluateFieldRule(fieldKey, fieldDef, extractedValue, context) {
  const results = [];
  const warnings = [];
  const blockingIssues = [];

  const value = typeof fieldDef.normalise === 'function'
    ? fieldDef.normalise(extractedValue)
    : extractedValue;

  if (fieldDef.required) {
    const missing = value === null || typeof value === 'undefined' || (typeof value === 'string' && value.trim() === '');
    if (missing) {
      const msg = `${fieldDef.label} is required.`;
      blockingIssues.push(`[${fieldKey}] ${msg}`);
      results.push({
        id: `${fieldKey}-required`,
        label: fieldDef.label,
        category: 'mandatory',
        severity: 'blocking',
        passed: false,
        message: msg,
        detail: null
      });
      return { value, results, warnings, blockingIssues };
    }
  }

  if (Array.isArray(fieldDef.allowedValues)) {
    const allowedCodes = fieldDef.allowedValues.map(entry => (typeof entry === 'object' ? entry.code : entry));
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
    if (!allowedCodes.some(code => code.toLowerCase() === normalized)) {
      const msg = `${fieldDef.label} must be one of the permitted values.`;
      blockingIssues.push(`[${fieldKey}] ${msg}`);
      results.push({
        id: `${fieldKey}-allowed`,
        label: fieldDef.label,
        category: 'mandatory',
        severity: 'blocking',
        passed: false,
        message: msg,
        detail: value
      });
      return { value, results, warnings, blockingIssues };
    }
    results.push({
      id: `${fieldKey}-allowed`,
      label: fieldDef.label,
      category: 'mandatory',
      severity: 'info',
      passed: true,
      message: null,
      detail: value
    });
  }

  if (Array.isArray(fieldDef.tests)) {
    fieldDef.tests.forEach(test => {
      let passed = true;
      let message = null;
      let detail = value;
      try {
        passed = test.validate(value, context);
      } catch (err) {
        passed = false;
        message = err?.message || 'Validation failed.';
      }
      if (!passed && !message) {
        message = test.description || `${fieldDef.label} failed validation.`;
      }
      results.push({
        id: test.id,
        label: fieldDef.label,
        category: fieldDef.required ? 'mandatory' : 'optional',
        severity: test.severity || 'blocking',
        passed,
        message: message || null,
        detail
      });
      if (!passed) {
        const formatted = `[${fieldKey}] ${message}`;
        if ((test.severity || 'blocking') === 'blocking') {
          blockingIssues.push(formatted);
        } else {
          warnings.push(formatted);
        }
      }
    });
  } else {
    results.push({
      id: `${fieldKey}-presence`,
      label: fieldDef.label,
      category: fieldDef.required ? 'mandatory' : 'optional',
      severity: 'info',
      passed: true,
      message: null,
      detail: value
    });
  }

  return { value, results, warnings, blockingIssues };
}

function runIlmpValidation(context) {
  const ruleResults = [];
  const warnings = [];
  const blockingIssues = [];

  const extracted = {
    socialInsuranceNumber: extractSin(context),
    dateOfBirth: (() => {
      const dob = extractDob(context);
      return dob ? dob.toISOString().slice(0, 10) : null;
    })(),
    gender: extractGender(context),
    aboriginalGroup: (extractIndigenousIdentity(context) || '').toLowerCase(),
    addressStreet: null,
    addressCity: null,
    addressProvince: null,
    postalCode: null
  };

  const address = extractAddress(context) || {};
  extracted.addressStreet = address.line1 || null;
  extracted.addressCity = address.city || null;
  extracted.addressProvince = address.province ? String(address.province).toUpperCase() : null;
  extracted.postalCode = address.postalCode || null;

  const fieldKeys = Object.keys(ILMP_PARTICIPANT_RULES.fields);
  fieldKeys.forEach(key => {
    const fieldDef = ILMP_PARTICIPANT_RULES.fields[key];
    const evaluation = evaluateFieldRule(key, fieldDef, extracted[key], {
      ...extracted,
      context
    });
    ruleResults.push(...evaluation.results);
    warnings.push(...evaluation.warnings);
    blockingIssues.push(...evaluation.blockingIssues);
    extracted[key] = evaluation.value;
  });

  const mandatoryResults = ruleResults.filter(rule => rule.category === 'mandatory');
  const optionalResults = ruleResults.filter(rule => rule.category === 'optional');

  const mandatoryTotal = mandatoryResults.length;
  const mandatoryComplete = mandatoryResults.filter(rule => rule.passed).length;
  const optionalTotal = optionalResults.length;
  const optionalComplete = optionalResults.filter(rule => rule.passed).length;

  const readinessSummary = {
    mandatory: { total: mandatoryTotal, complete: mandatoryComplete },
    optional: { total: optionalTotal, complete: optionalComplete },
    warnings: warnings.length,
    blocking: blockingIssues.length,
    rules: ruleResults
  };

  let readinessStatus = 'ready';
  if (blockingIssues.length > 0) {
    readinessStatus = 'blocked';
  } else if (warnings.length > 0 || (mandatoryTotal > 0 && mandatoryComplete < mandatoryTotal)) {
    readinessStatus = 'needs_review';
  }

  return {
    readinessStatus,
    readinessSummary,
    warnings,
    blockingIssues
  };
}

const GENDER_LABEL_MAP = {
  male: 'Male',
  female: 'Female',
  unspecified: 'Unspecified'
};

const INDIGENOUS_LABEL_MAP = {
  'registered-indian': 'Registered Indian',
  'non-status-indian': 'Non-status Indian',
  metis: 'Metis',
  inuit: 'Inuit'
};

const PROVINCE_LABEL_MAP = PROVINCE_CODES.reduce((acc, entry) => {
  acc[entry.code] = entry.name;
  return acc;
}, {});

const MARITAL_STATUS_LABELS = {
  married: 'Married',
  'married or equivalent': 'Married',
  single: 'Single',
  divorced: 'Divorced',
  widowed: 'Widowed',
  separated: 'Separated',
  'common-law': 'Married'
};

const LANGUAGE_SPOKEN_MAP = {
  en: 'English only',
  eng: 'English only',
  english: 'English only',
  fr: 'French only',
  fra: 'French only',
  french: 'French only',
  'en-fr': 'English and French',
  'fr-en': 'English and French',
  bilingual: 'English and French'
};

const CLIENT_STATUS_MAP = {
  unemployed: 'Unemployed',
  underemployed: 'Unemployed',
  'not_employed': 'Unemployed',
  'not-employed': 'Unemployed',
  'not employed': 'Unemployed',
  'employed-full-time': 'Employed',
  'employed part-time': 'Employed',
  'employed-part-time': 'Employed',
  employed: 'Employed',
  'self-employed': 'Employed',
  'self employed': 'Employed',
  student: 'Student',
  'full-time student': 'Student',
  'part-time student': 'Student'
};

const EMPLOYMENT_SCHEDULE_MAP = {
  'employed-full-time': 'Full-time',
  'employed part-time': 'Part-time',
  'employed-part-time': 'Part-time',
  'self-employed': 'Full-time'
};

const EDUCATION_LEVEL_MAP = {
  no_formal_education: 'No formal education',
  grade_7_8: 'Up to Grade 7-8 (Secondaire I-II)',
  grade_9_10: 'Grade 9-10 (Secondaire III)',
  grade_11_12: 'Grade 11-12 (Secondaire IV-V)',
  secondary_school_diploma_or_ged: 'Secondary School Diploma or GED',
  post_secondary_training: 'Some post-secondary training',
  apprenticeship_trades: 'Apprenticeship or trades certificate or diploma',
  cegep: 'College, CEGEP, or other non-university certificate or diploma',
  college: 'College, CEGEP, or other non-university certificate or diploma',
  university_certificate: 'University certificate or diploma',
  bachelors_degree: 'University - Bachelor Degree',
  masters_degree: 'University - Master\'s Degree',
  doctorate: 'University - Doctorate'
};

const BARRIER_VALUE_MAP = {
  education: 'Education',
  funding: 'Economic',
  'lack-of-job-opportunities': 'Lack of marketable skills',
  location: 'Remoteness',
  'lack-of-transportation': 'Lack of transportation',
  'lack-of-work-experience': 'Lack of work experience',
  'lack-of-labour-force-attachment': 'Lack of labour force attachment',
  language: 'Language',
  'dependent-care': 'Dependent care',
  'physical-or-mental-health': 'Physical or mental health',
  'other': 'Other barrier not listed above',
  none: 'None'
};

const REQUESTED_SUPPORTS_MAP = {
  tuition: 'Tuition',
  books: 'Books or program materials',
  living: 'Living allowance',
  transportation: 'Transportation',
  other: 'Other'
};

const INTERVENTION_PROGRAM_MAP = {
  skills_development: {
    description: 'Skills Development - Education'
  },
  tws: {
    description: 'Work Experience - Wage Subsidy'
  },
  jcp: {
    description: 'Work Experience - Job Creation Partnerships'
  },
  not_yet: {
    description: 'Pre-Career Development'
  }
};

const ASSESSMENT_ITP_LABELS = {
  tuition: 'Tuition',
  books: 'Books',
  materials: 'Materials',
  living: 'Living allowance'
};

const ASSESSMENT_WAGE_LABELS = {
  wages: 'Wages',
  mercs: 'MERCs',
  nonwages: 'Non-wages',
  other: 'Other wage supports'
};

function normaliseCurrencyAmount(value) {
  if (value === null || typeof value === 'undefined') return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const str = String(value).trim();
  if (!str) return 0;
  const cleaned = str.replace(/[^0-9.+-]/g, '');
  if (!cleaned) return 0;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summariseAssessmentFunding(assessmentRow) {
  if (!assessmentRow) return null;

  const categories = [];
  let total = 0;

  const addCategory = (label, rawValue) => {
    const amount = normaliseCurrencyAmount(rawValue);
    if (amount <= 0) return;
    total += amount;
    categories.push({
      label,
      amount,
      display: typeof rawValue === 'string' && rawValue.trim().length ? rawValue.trim() : amount.toFixed(2)
    });
  };

  let itpPayload = assessmentRow.itp_payload;
  if (typeof itpPayload === 'string') {
    try {
      itpPayload = JSON.parse(itpPayload);
    } catch (_) {
      itpPayload = null;
    }
  }
  if (itpPayload && typeof itpPayload === 'object') {
    Object.entries(ASSESSMENT_ITP_LABELS).forEach(([key, label]) => {
      if (Object.prototype.hasOwnProperty.call(itpPayload, key)) {
        addCategory(label, itpPayload[key]);
      }
    });
  }

  let wagePayload = assessmentRow.wage_payload;
  if (typeof wagePayload === 'string') {
    try {
      wagePayload = JSON.parse(wagePayload);
    } catch (_) {
      wagePayload = null;
    }
  }
  if (wagePayload && typeof wagePayload === 'object') {
    Object.entries(ASSESSMENT_WAGE_LABELS).forEach(([key, label]) => {
      if (Object.prototype.hasOwnProperty.call(wagePayload, key)) {
        addCategory(label, wagePayload[key]);
      }
    });
  }

  if (total <= 0 || categories.length === 0) {
    return null;
  }

  return {
    total,
    breakdown: categories
  };
}

const AUTO_PLAN_METADATA_SOURCE = 'auto_assessment';

function pruneNullish(value) {
  if (Array.isArray(value)) {
    const next = value
      .map(pruneNullish)
      .filter(item => item !== null && typeof item !== 'undefined' && (typeof item !== 'object' || (Array.isArray(item) ? item.length : Object.keys(item).length)));
    return next.length ? next : undefined;
  }
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, val]) => {
      const pruned = pruneNullish(val);
      if (pruned !== null && typeof pruned !== 'undefined') {
        next[key] = pruned;
      }
    });
    return Object.keys(next).length ? next : undefined;
  }
  if (value === null || typeof value === 'undefined') return undefined;
  return value;
}

const toDateOnlyString = (value) => {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const calculateDurationDaysFromDates = (startDate, endDate) => {
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
};

async function findStaffProfileIdByUserId(connection, userId) {
  if (!Number.isFinite(userId)) return null;

  const [[userRow]] = await connection.query(
    'SELECT cognito_sub, email FROM user WHERE id = ? LIMIT 1',
    [userId]
  );
  if (!userRow) return null;

  if (userRow.cognito_sub) {
    const [[bySub]] = await connection.query(
      'SELECT id FROM staff_profiles WHERE cognito_sub = ? LIMIT 1',
      [userRow.cognito_sub]
    );
    if (bySub && bySub.id) {
      return Number(bySub.id);
    }
  }

  if (userRow.email) {
    const [[byEmail]] = await connection.query(
      'SELECT id FROM staff_profiles WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [userRow.email]
    );
    if (byEmail && byEmail.id) {
      return Number(byEmail.id);
    }
  }

  return null;
}

async function ensureUserExists(connection, userId) {
  if (!Number.isFinite(userId)) return null;
  const [[row]] = await connection.query(
    'SELECT id FROM user WHERE id = ? LIMIT 1',
    [userId]
  );
  return row && row.id ? Number(row.id) : null;
}

async function fetchInterventionCodeLabel(connection, code) {
  if (code === null || typeof code === 'undefined') return null;
  const numericCode = Number.parseInt(code, 10);
  if (!Number.isFinite(numericCode)) return null;
  const [[row]] = await connection.query(
    `SELECT label
       FROM esdc_intervention_code
      WHERE code = ?
      ORDER BY is_active DESC, display_order ASC, code ASC
      LIMIT 1`,
    [numericCode]
  );
  return row ? row.label || null : null;
}

async function ensureAutoPlanAndInterventionFromAssessment(connection, {
  caseId,
  caseRow,
  approvalUserId
}) {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return { createdPlan: false, createdIntervention: false };
  }

  const [[assessmentRow]] = await connection.query(
    'SELECT * FROM iset_case_assessment WHERE case_id = ? LIMIT 1',
    [caseId]
  );
  if (!assessmentRow) {
    return { createdPlan: false, createdIntervention: false };
  }

  const codeRaw = assessmentRow.intervention_code;
  const code = codeRaw !== null && typeof codeRaw !== 'undefined' ? String(codeRaw).trim() : '';
  if (!code) {
    return { createdPlan: false, createdIntervention: false };
  }

  const startDate = toDateOnlyString(assessmentRow.intervention_start_date);
  const endDate = toDateOnlyString(assessmentRow.intervention_end_date);
  const storedDuration = Number.isFinite(Number(assessmentRow.intervention_duration_days))
    ? Number(assessmentRow.intervention_duration_days)
    : null;
  const computedDuration = storedDuration !== null ? storedDuration : calculateDurationDaysFromDates(startDate, endDate);

  const storedCost = Number.isFinite(Number(assessmentRow.intervention_cost_total))
    ? Number(assessmentRow.intervention_cost_total)
    : null;
  const fundingSummary = summariseAssessmentFunding(assessmentRow);
  const computedCost = storedCost !== null
    ? storedCost
    : (fundingSummary && Number.isFinite(Number(fundingSummary.total)) ? Number(fundingSummary.total) : null);

  const noc = assessmentRow.intervention_related_noc
    ? String(assessmentRow.intervention_related_noc).trim()
    : null;
  const nocVersion = assessmentRow.intervention_related_noc_version
    ? String(assessmentRow.intervention_related_noc_version).trim()
    : null;
  const childcareNeedValue = assessmentRow.childcare_need;
  const childcareNeed = childcareNeedValue === null || typeof childcareNeedValue === 'undefined'
    ? null
    : Number(childcareNeedValue) === 1
      ? 'yes'
      : Number(childcareNeedValue) === 0
        ? 'no'
        : null;
  const childcareFunding = assessmentRow.childcare_funding_details
    ? String(assessmentRow.childcare_funding_details).trim()
    : null;

  const programName = assessmentRow.program_name ? String(assessmentRow.program_name).trim() : null;
  const institution = assessmentRow.institution ? String(assessmentRow.institution).trim() : null;
  const overview = assessmentRow.overview ? String(assessmentRow.overview).trim() : null;
  const justification = assessmentRow.justification ? String(assessmentRow.justification).trim() : null;
  const recommendation = assessmentRow.recommendation ? String(assessmentRow.recommendation).trim() : null;

  const [[existingAutoPlan]] = await connection.query(
    `SELECT id, status FROM iset_case_action_plan
      WHERE case_id = ?
        AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = ?
      LIMIT 1`,
    [caseId, AUTO_PLAN_METADATA_SOURCE]
  );
  if (existingAutoPlan) {
    return { createdPlan: false, createdIntervention: false };
  }

  const [[existingPlan]] = await connection.query(
    `SELECT id FROM iset_case_action_plan
      WHERE case_id = ?
        AND status IN ('draft','active')
      LIMIT 1`,
    [caseId]
  );
  if (existingPlan) {
    // Preserve manually created plan; do not auto-generate duplicates.
    return { createdPlan: false, createdIntervention: false };
  }

  const interventionLabel = await fetchInterventionCodeLabel(connection, code);
  const now = new Date();

  const assignedStaffProfileId = Number.isFinite(Number(caseRow.assigned_to_user_id))
    ? Number(caseRow.assigned_to_user_id)
    : null;
  let ownerStaffProfileId = assignedStaffProfileId;
  if (!ownerStaffProfileId && Number.isFinite(Number(approvalUserId))) {
    ownerStaffProfileId = await findStaffProfileIdByUserId(connection, Number(approvalUserId));
  }

  let ownerUserId = null;
  if (Number.isFinite(Number(approvalUserId))) {
    ownerUserId = await ensureUserExists(connection, Number(approvalUserId));
  }

  const planNameCandidates = [
    programName,
    institution,
    interventionLabel ? `${interventionLabel} Plan` : null,
    `Intervention ${code}`,
    'Initial Action Plan',
  ].filter(Boolean);
  let planName = planNameCandidates.length ? planNameCandidates[0] : 'Action Plan';
  if (planName.length > 255) {
    planName = planName.slice(0, 252) + '...';
  }

  const planStatus = 'draft';
  const planMetadata = pruneNullish({
    source: AUTO_PLAN_METADATA_SOURCE,
    generatedAt: now.toISOString(),
    assessmentSummary: overview || null,
    recommendation: recommendation || null,
    programName: programName || null,
    trainingInstitution: institution || null,
    childcareNeed: childcareNeed || null,
    childcareFunding: childcareFunding || null,
    recommendedIntervention: pruneNullish({
      code,
      label: interventionLabel || null,
      startDate: startDate || null,
      endDate: endDate || null,
      durationDays: computedDuration || null,
      noc: noc || null,
      nocVersion: nocVersion || null,
      cost: computedCost || null,
      fundingBreakdown: fundingSummary ? fundingSummary.breakdown : null,
    }),
  });

  const [planInsert] = await connection.query(
    `INSERT INTO iset_case_action_plan
       (case_id, name, status, owner_staff_profile_id, owner_user_id, effective_date, review_date, activated_at, notes, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      caseId,
      planName,
      planStatus,
      ownerStaffProfileId || null,
      ownerUserId || null,
      startDate || null,
      endDate || null,
      null,
      justification || null,
      planMetadata ? JSON.stringify(planMetadata) : null,
    ]
  );

  const planId = planInsert.insertId;
  const interventionTitleCandidates = [
    programName,
    interventionLabel ? `${interventionLabel} Intervention` : null,
    `Intervention ${code}`,
    'Initial Intervention',
  ].filter(Boolean);
  const interventionTitle = interventionTitleCandidates.length ? interventionTitleCandidates[0] : 'Initial Intervention';

  const interventionMetadata = pruneNullish({
    source: AUTO_PLAN_METADATA_SOURCE,
    title: interventionTitle,
    programName: programName || null,
    trainingInstitution: institution || null,
    noc: noc || null,
    nocVersion: nocVersion || null,
    durationDays: computedDuration || null,
    childcareNeed: childcareNeed || null,
    childcareFunding: childcareFunding || null,
    cost: computedCost || null,
    compliance: { ilmp: 'pending', finance: 'pending' },
    generatedAt: now.toISOString(),
  });

  const budgetAmount =
    computedCost !== null && Number.isFinite(computedCost) ? Number(computedCost) : null;

  await connection.query(
    `INSERT INTO iset_case_intervention
       (case_id,
        action_plan_id,
        intervention_type,
        status,
        start_date,
        end_date,
        funding_stream,
        budget_amount,
        approved_amount,
        actual_amount,
        outcome_code,
        notes,
        metadata_json,
        created_by_staff_profile_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      caseId,
      planId,
      code,
      'planned',
      startDate || null,
      endDate || null,
      null,
      budgetAmount,
      null,
      null,
      null,
      justification || null,
      interventionMetadata ? JSON.stringify(interventionMetadata) : null,
      ownerStaffProfileId || null,
    ]
  );

  return {
    createdPlan: true,
    createdIntervention: true,
    planStatus,
    suggestedCaseStatus: 'initiated'
  };
}

function escapeXml(value) {
  if (value === null || typeof value === 'undefined') return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function appendXmlElement(lines, level, tag, value) {
  if (value === null || typeof value === 'undefined') return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value);
    if (!text.length) return;
    const indent = '  '.repeat(level);
    lines.push(`${indent}<${tag}>${escapeXml(text)}</${tag}>`);
    return;
  }
  if (Array.isArray(value)) {
    if (!value.length) return;
    value.forEach(item => appendXmlElement(lines, level, tag, item));
    return;
  }
  if (typeof value === 'object') {
    const indent = '  '.repeat(level);
    const initialLength = lines.length;
    lines.push(`${indent}<${tag}>`);
    Object.entries(value).forEach(([childTag, childValue]) => {
      appendXmlElement(lines, level + 1, childTag, childValue);
    });
    if (lines.length === initialLength + 1) {
      // no children were added; remove opening tag
      lines.pop();
      return;
    }
    lines.push(`${indent}</${tag}>`);
  }
}

function buildIlmpParticipantPayload(context) {
  const firstName = extractFirstName(context);
  const lastName = extractLastName(context);
  const middleInitials = extractMiddleInitials(context);
  const sin = extractSin(context);
  const dob = extractDob(context);
  const gender = extractGender(context);
  const indigenousIdentity = extractIndigenousIdentity(context);
  const address = extractAddress(context) || {};
  const preferredName = extractPreferredName(context);
  const maritalStatus = extractMaritalStatus(context);
  const dependentInfo = extractDependentChildrenInfo(context);
  const languageSpoken = extractLanguageSpoken(context);
  const visibleMinority = extractVisibleMinority(context);
  const disabilityInfo = extractDisabilityInfo(context);
  const contactDetails = extractContactDetails(context);
  const emergencyContact = extractEmergencyContactDetails(context);
  const agreementNumber = extractAgreementNumber(context);
  const clientStatus = extractClientStatusDetails(context);
  const educationDetails = extractEducationDetails(context);
  const socialAssistanceStatus = extractSocialAssistanceStatus(context);
  const requestedSupports = extractRequestedSupports(context);
  const actionPlanDetails = extractActionPlanDetails(context, clientStatus, requestedSupports);
  const barriers = extractEmploymentBarriers(context);
  const eiClaimant = extractEiClaimant(context, clientStatus);

  const formatDate = dateObj => {
    if (!dateObj) return null;
    const iso = dateObj instanceof Date ? dateObj.toISOString() : new Date(dateObj).toISOString();
    if (!iso) return null;
    return iso.slice(0, 10);
  };

  const genderLabel = gender ? (GENDER_LABEL_MAP[gender] || gender) : null;
  const indigenousLabel = indigenousIdentity ? (INDIGENOUS_LABEL_MAP[indigenousIdentity] || indigenousIdentity) : null;
  const provinceCode = address.province ? address.province : null;
  const provinceName = provinceCode ? (PROVINCE_LABEL_MAP[provinceCode] || provinceCode) : null;

  const dependentChildrenNode = (() => {
    if (!dependentInfo) return null;
    const hasCount = typeof dependentInfo.count === 'number' && dependentInfo.count >= 0;
    const hasAges = Array.isArray(dependentInfo.ages) && dependentInfo.ages.length > 0;
    if (!hasCount && !hasAges) return null;
    return {
      Count: hasCount ? String(dependentInfo.count) : null,
      Ages: hasAges ? { Age: dependentInfo.ages } : null
    };
  })();

  const disabilityNode = (() => {
    if (!disabilityInfo) return null;
    if (!disabilityInfo.declared && !disabilityInfo.description) return null;
    return {
      Declared: disabilityInfo.declared,
      Description: disabilityInfo.description
    };
  })();

  const contactNode = (() => {
    if (!contactDetails) return null;
    const { email, phone, alternatePhone, mailingAddress, homeCommunity } = contactDetails;
    if (!email && !phone && !alternatePhone && !mailingAddress && !homeCommunity) return null;
    return {
      EmailAddress: email || null,
      DaytimePhoneNumber: phone || null,
      AlternatePhoneNumber: alternatePhone || null,
      MailingAddress: mailingAddress || null,
      HomeCommunity: homeCommunity || null
    };
  })();

  const emergencyNode = (() => {
    if (!emergencyContact) return null;
    const { name, relationship, phone } = emergencyContact;
    if (!name && !relationship && !phone) return null;
    return {
      Name: name || null,
      Relationship: relationship || null,
      PhoneNumber: phone || null
    };
  })();

  const employmentDetailsNode = (() => {
    if (!clientStatus) return null;
    const { noc, nocVersion, scheduleType } = clientStatus;
    if (!noc && !nocVersion && !scheduleType) return null;
    return {
      EmploymentNOC: noc || null,
      EmploymentNOCVersion: nocVersion || null,
      EmploymentScheduleType: scheduleType || null
    };
  })();

  const educationNode = (() => {
    if (!educationDetails) return null;
    const { level, yearCompleted, location } = educationDetails;
    if (!level && !yearCompleted && !location) return null;
    return {
      EducationLevel: level || null,
      EducationYearCompleted: yearCompleted || null,
      EducationLocation: location || null
    };
  })();

  const barriersNode = barriers && barriers.length
    ? { Barrier: barriers }
    : null;

  const requestedSupportsNode = (() => {
    if (!requestedSupports) return null;
    const hasSupports = requestedSupports.list && requestedSupports.list.length;
    const hasOther = Boolean(requestedSupports.otherDescription);
    if (!hasSupports && !hasOther) return null;
    return {
      Support: hasSupports ? requestedSupports.list : null,
      OtherDescription: hasOther ? requestedSupports.otherDescription : null
    };
  })();

  const actionPlanNode = (() => {
    if (!actionPlanDetails) return null;
    const {
      startDate,
      resultDate,
      resultCode,
      childcareNeed,
      childcareFunding,
      goalDescription,
      interventions
    } = actionPlanDetails;
    const hasInterventions = Array.isArray(interventions) && interventions.length > 0;
    const interventionNode = hasInterventions
      ? {
          Intervention: interventions.map(entry => ({
            InterventionCode: entry.code || null,
            InterventionDescription: entry.description || null,
            InterventionStartDate: entry.startDate || null,
            InterventionEndDate: entry.endDate || null,
            InterventionOutcome: entry.outcome || null,
            InterventionDuration: entry.duration || null,
            InterventionRelatedNOC: entry.relatedNoc || null,
            InterventionRelatedNOCVersion: entry.relatedNocVersion || null,
            InterventionCost: entry.cost || null,
            RequestedSupports: entry.supports && entry.supports.length ? { Support: entry.supports } : null,
            Notes: entry.notes && entry.notes.length ? { Note: entry.notes } : null
          }))
        }
      : null;
    if (
      !startDate &&
      !resultDate &&
      !resultCode &&
      !childcareNeed &&
      !childcareFunding &&
      !goalDescription &&
      !interventionNode
    ) {
      return null;
    }
    return {
      ActionPlanStartDate: startDate || null,
      ActionPlanResultDate: resultDate || null,
      ActionPlanResultCode: resultCode || null,
      ChildcareNeed: childcareNeed || null,
      ChildcareFunding: childcareFunding || null,
      GoalDescription: goalDescription || null,
      Interventions: interventionNode
    };
  })();

  const addressNode = (() => {
    if (!address.line1 && !address.city && !address.province && !address.postalCode) return null;
    return {
      StreetAddress: address.line1 || null,
      Municipality: address.city || null,
      Province: provinceCode || null,
      ProvinceName: provinceName || null,
      PostalZIPCode: address.postalCode || null
    };
  })();

  const generatedAt = new Date().toISOString();

  const canonical = {
    GeneratedAt: generatedAt,
    Client: {
      SocialInsuranceNumber: sin || null,
      FirstName: firstName || null,
      PreferredName: preferredName || null,
      LastName: lastName || null,
      MiddleInitials: middleInitials || null,
      DateOfBirth: formatDate(dob) || null,
      Gender: genderLabel || null,
      AboriginalGroup: indigenousLabel || null,
      MaritalStatus: maritalStatus || null,
      DependentChildren: dependentChildrenNode,
      LanguageSpoken: languageSpoken || null,
      VisibleMinority: visibleMinority || null,
      Disability: disabilityNode,
      Address: addressNode,
      ContactDetails: contactNode,
      EmergencyContact: emergencyNode,
      AgreementNumber: agreementNumber || null,
      ClientStatusAtIntake: clientStatus?.status || null,
      EmploymentDetails: employmentDetailsNode,
      Education: educationNode,
      SocialAssistanceRecipient: socialAssistanceStatus || null,
      EIClaimant: eiClaimant || null,
      BarrierToEmployment: barriersNode,
      RequestedSupports: requestedSupportsNode,
      ActionPlan: actionPlanNode
    }
  };

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ILMPParticipantPayload>'
  ];
  appendXmlElement(lines, 1, 'GeneratedAt', canonical.GeneratedAt);
  appendXmlElement(lines, 1, 'Client', canonical.Client);
  lines.push('</ILMPParticipantPayload>');

  return {
    xml: lines.join('\n'),
    generatedAt,
    canonical
  };
}

async function loadEsdcParticipantSubmissionContext(connection, submissionId, options = {}) {
  const numericId = Number(submissionId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    const err = new Error('Invalid participant submission id');
    err.statusCode = 400;
    throw err;
  }

  const conn = connection || await pool.getConnection();
  const releaseConnection = !connection;
  const useForUpdate = options.forUpdate === true;

  try {
    const submissionQuery = `
      SELECT *
      FROM esdc_participant_submission
      WHERE id = ?
      ${useForUpdate ? 'FOR UPDATE' : ''}
    `;
    const [[submissionRow]] = await conn.query(submissionQuery, [numericId]);
    if (!submissionRow) {
      const err = new Error('Participant submission not found');
      err.statusCode = 404;
      throw err;
    }

    const effectiveCaseId = options.caseId || submissionRow.case_id;
    if (!effectiveCaseId) {
      const err = new Error('Participant submission is not linked to a case');
      err.statusCode = 409;
      throw err;
    }

    const [[caseRow]] = await conn.query('SELECT * FROM iset_case WHERE id = ? LIMIT 1', [effectiveCaseId]);
    if (!caseRow) {
      const err = new Error('Associated case not found');
      err.statusCode = 404;
      throw err;
    }

    let caseActionPlans = [];
    try {
      const [planRows] = await conn.query(
        `SELECT *
           FROM iset_case_action_plan
           WHERE case_id = ? AND archived_at IS NULL
           ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 WHEN 'closed' THEN 2 ELSE 3 END,
                    COALESCE(activated_at, effective_date, created_at) DESC,
                    id DESC`,
        [caseRow.id]
      );
      if (planRows && planRows.length) {
        const planMap = new Map();
        const planIds = [];
        planRows.forEach(planRow => {
          const metadata = safeJsonParse(planRow.metadata_json, {}) || {};
          planIds.push(planRow.id);
          planMap.set(planRow.id, {
            id: planRow.id,
            caseId: planRow.case_id,
            name: planRow.name,
            status: planRow.status,
            createdAt: planRow.created_at,
            effectiveDate: planRow.effective_date,
            reviewDate: planRow.review_date,
            activatedAt: planRow.activated_at,
            closedAt: planRow.closed_at,
            resultCode: planRow.result_code,
            resultDate: planRow.result_date,
            outcomeSummary: planRow.outcome_summary || null,
            closureNotes: planRow.closure_notes || null,
            summary: metadata.summary || planRow.notes || null,
            childcareNeed: metadata.childcareNeed ?? metadata.childcare_need ?? null,
            childcareFunding: metadata.childcareFunding ?? metadata.childcare_funding ?? null,
            goalDescription: metadata.goalDescription ?? metadata.goal ?? metadata.summary ?? null,
            metadata,
            interventions: [],
          });
        });
        if (planIds.length) {
          const placeholders = planIds.map(() => '?').join(', ');
          const [interventionRows] = await conn.query(
            `SELECT *
               FROM iset_case_intervention
               WHERE action_plan_id IN (${placeholders})
               ORDER BY start_date IS NULL, start_date ASC, id ASC`,
            planIds
          );
          interventionRows.forEach(row => {
            const plan = planMap.get(row.action_plan_id);
            if (plan) {
              plan.interventions.push(mapInterventionRow(row));
            }
          });
        }
        caseActionPlans = Array.from(planMap.values());
      }
    } catch (err) {
      console.warn('[esdc] failed to load case action plans', err);
    }

    let caseAssessmentRow = null;
    try {
      const [[assessmentRow]] = await conn.query('SELECT * FROM iset_case_assessment WHERE case_id = ? LIMIT 1', [caseRow.id]);
      caseAssessmentRow = assessmentRow || null;
    } catch (err) {
      const code = err && err.code;
      if (code && code !== 'ER_NO_SUCH_TABLE') throw err;
    }

    const applicationId = submissionRow.application_id || caseRow.application_id || null;
    let applicationPayload = null;
    if (applicationId) {
      applicationPayload = await readApplicationPayload(
        conn,
        applicationId,
        { forUpdate: useForUpdate }
      );
    }

    return {
      connection: conn,
      releaseConnection,
      submissionId: numericId,
      submissionRow,
      caseRow,
      caseAssessmentRow,
      caseActionPlans,
      applicationId,
      applicationRow: applicationPayload?.row || null,
      payload: applicationPayload?.payload || {},
      answers: applicationPayload?.payload?.answers || {}
    };
  } catch (error) {
    if (releaseConnection) {
      conn.release();
    }
    throw error;
  }
}

async function validateEsdcParticipantSubmission({ submissionId, caseId } = {}, options = {}) {
  const connection = options.connection || await pool.getConnection();
  const releaseConnection = !options.connection;
  const useTransaction = options.transaction !== false;

  try {
    if (useTransaction) await connection.beginTransaction();

    const context = await loadEsdcParticipantSubmissionContext(connection, submissionId, {
      caseId,
      forUpdate: true
    });

    const evaluation = runIlmpValidation(context);

    await connection.query(
      `UPDATE esdc_participant_submission
         SET readiness_status = ?,
             readiness_summary = ?,
             warnings = ?,
             blocking_issues = ?,
             last_validated_at = NOW(),
             updated_at = NOW()
       WHERE id = ?`,
      [
        evaluation.readinessStatus,
        JSON.stringify(evaluation.readinessSummary),
        JSON.stringify(evaluation.warnings),
        JSON.stringify(evaluation.blockingIssues),
        context.submissionId
      ]
    );

    await connection.query(
      `INSERT INTO esdc_participant_submission_history
         (participant_submission_id, event_type, event_details, occurred_at)
       VALUES (?, 'validated', CAST(? AS JSON), NOW())`,
      [
        context.submissionId,
        JSON.stringify({
          readiness_status: evaluation.readinessStatus,
          mandatory: evaluation.readinessSummary.mandatory,
          optional: evaluation.readinessSummary.optional,
          warnings: evaluation.warnings.length,
          blocking: evaluation.blockingIssues.length,
          rules: evaluation.readinessSummary.rules
        })
      ]
    );

    if (useTransaction) await connection.commit();

    return {
      submissionId: context.submissionId,
      caseId: context.caseRow.id,
      readinessStatus: evaluation.readinessStatus,
      readinessSummary: evaluation.readinessSummary,
      warnings: evaluation.warnings,
      blockingIssues: evaluation.blockingIssues
    };
  } catch (err) {
    if (useTransaction) {
      try { await connection.rollback(); } catch (_) {}
    }
    throw err;
  } finally {
    if (releaseConnection) connection.release();
  }
}

async function prepareEsdcParticipantSubmission({ submissionId, caseId } = {}, options = {}) {
  const connection = options.connection || await pool.getConnection();
  const releaseConnection = !options.connection;
  const useTransaction = options.transaction !== false;

  try {
    if (useTransaction) await connection.beginTransaction();

    const context = await loadEsdcParticipantSubmissionContext(connection, submissionId, {
      caseId,
      forUpdate: true
    });
    const evaluation = runIlmpValidation(context);

    await connection.query(
      `UPDATE esdc_participant_submission
         SET readiness_status = ?,
             readiness_summary = ?,
             warnings = ?,
             blocking_issues = ?,
             last_validated_at = NOW(),
             updated_at = NOW()
       WHERE id = ?`,
      [
        evaluation.readinessStatus,
        JSON.stringify(evaluation.readinessSummary),
        JSON.stringify(evaluation.warnings),
        JSON.stringify(evaluation.blockingIssues),
        context.submissionId
      ]
    );

    if (evaluation.blockingIssues.length > 0) {
      if (useTransaction) await connection.commit();
      return { blocking: true, evaluation };
    }

    const snapshot = buildIlmpParticipantPayload(context);
    const checksum = crypto.createHash('sha256').update(snapshot.xml, 'utf8').digest('hex');
    const storageKey = [
      'participants',
      context.caseRow?.id || context.submissionRow?.case_id || `submission-${context.submissionId}`,
      `ilmp-client-${context.submissionId}-${Date.now()}.xml`
    ]
      .filter(Boolean)
      .join('/');

    const payloadSnapshot = {
      schema: 'esdc-ilmp-client-v1',
      generatedAt: snapshot.generatedAt,
      submissionId: context.submissionId,
      caseId: context.caseRow?.id || null,
      applicationId: context.applicationId || null,
      readinessStatus: evaluation.readinessStatus,
      readinessSummary: evaluation.readinessSummary,
      warnings: evaluation.warnings,
      blockingIssues: evaluation.blockingIssues,
      canonical: snapshot.canonical,
      xml: snapshot.xml
    };

    await connection.query(
      `UPDATE esdc_participant_submission
         SET payload_snapshot = ?, payload_storage_key = ?, payload_checksum = ?, updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(payloadSnapshot), storageKey, checksum, context.submissionId]
    );

    await ensureEsdcPreparedHistoryEventType(connection);

    await connection.query(
      `INSERT INTO esdc_participant_submission_history
         (participant_submission_id, event_type, event_details, payload_checksum, occurred_at)
       VALUES (?, 'prepared', CAST(? AS JSON), ?, NOW())`,
      [
        context.submissionId,
        JSON.stringify({
          storageKey,
          generatedAt: snapshot.generatedAt,
          readiness_status: evaluation.readinessStatus
        }),
        checksum
      ]
    );

    const [[submission]] = await connection.query(
      `
      SELECT eps.*, COALESCE(ias.reference_number, CONCAT('CASE-', eps.case_id)) AS tracking_id
      FROM esdc_participant_submission eps
      LEFT JOIN iset_application ia ON ia.id = eps.application_id
      LEFT JOIN iset_application_submission ias ON ias.id = ia.submission_id
      WHERE eps.id = ?
      `,
      [context.submissionId]
    );
    const [history] = await connection.query(
      `
      SELECT *
      FROM esdc_participant_submission_history
      WHERE participant_submission_id = ?
      ORDER BY occurred_at DESC, id DESC
      `,
      [context.submissionId]
    );

    if (useTransaction) await connection.commit();

    return {
      blocking: false,
      submission,
      history,
      payload: payloadSnapshot,
      checksum,
      storageKey,
      evaluation
    };
  } catch (err) {
    if (useTransaction) {
      try { await connection.rollback(); } catch (_) {}
    }
    throw err;
  } finally {
    if (releaseConnection) connection.release();
  }
}

let DEFAULT_ACCESS_CONTROL_MATRIX = { default: 'deny', routes: {} };
try {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const accessControlConfig = require('./src/config/roleMatrix.json');
  DEFAULT_ACCESS_CONTROL_MATRIX = normaliseAccessControlMatrix(accessControlConfig);
} catch (err) {
  console.warn('[access-control] failed to load default role matrix configuration:', err.message);
}

async function readAccessControlMatrix() {
  try {
    const [rows] = await pool.query("SELECT v, updated_at FROM iset_runtime_config WHERE scope='admin' AND k='accessControlMatrix' LIMIT 1");
    if (!rows || rows.length === 0) {
      return { ...DEFAULT_ACCESS_CONTROL_MATRIX, source: 'default', updatedAt: null };
    }
    const row = rows[0];
    let payload = row.v;
    if (payload && typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (err) {
        console.warn('[access-control] invalid JSON in persisted matrix, falling back to defaults:', err.message);
        payload = null;
      }
    }
    const matrix = normaliseAccessControlMatrix(payload || DEFAULT_ACCESS_CONTROL_MATRIX);
    const updatedAt = row.updated_at ? new Date(row.updated_at).toISOString() : null;
    return { ...matrix, source: payload ? 'db' : 'default', updatedAt };
  } catch (err) {
    if (!isMissingTableErrorLocal(err)) {
      console.error('[access-control] failed to read persisted matrix:', err.message);
    }
    return { ...DEFAULT_ACCESS_CONTROL_MATRIX, source: 'default', updatedAt: null };
  }
}

async function writeAccessControlMatrix(nextMatrix) {
  const normalised = normaliseAccessControlMatrix(nextMatrix);
  await pool.query("CREATE TABLE IF NOT EXISTS iset_runtime_config (id INT AUTO_INCREMENT PRIMARY KEY, scope VARCHAR(32) NOT NULL, k VARCHAR(128) NOT NULL, v JSON NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_scope_key (scope,k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
  await pool.query(
    "INSERT INTO iset_runtime_config (scope,k,v) VALUES ('admin','accessControlMatrix', CAST(? AS JSON)) ON DUPLICATE KEY UPDATE v=VALUES(v), updated_at=CURRENT_TIMESTAMP",
    [JSON.stringify(normalised)]
  );
  const saved = await readAccessControlMatrix();
  return saved;
}

const isMissingTableErrorLocal = (err) => {
  if (!err) return false;
  if (err.code === 'ER_NO_SUCH_TABLE') return true;
  const message = typeof err.message === 'string' ? err.message : '';
  return /does(n't| not) exist/i.test(message) || /no such table/i.test(message);
};

async function clearTableWithCount(connection, tableName) {
  try {
    const [[countRow]] = await connection.query(`SELECT COUNT(*) AS total FROM ${tableName}`);
    const deleted = Number(countRow?.total ?? 0);
    await connection.query(`DELETE FROM ${tableName}`);
    try {
      await connection.query(`ALTER TABLE ${tableName} AUTO_INCREMENT = 1`);
    } catch (resetErr) {
      if (!isMissingTableErrorLocal(resetErr)) {
        console.warn(`[clear-test] auto_increment reset failed for ${tableName}:`, resetErr.message);
      }
    }
    return { table: tableName, deleted };
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return { table: tableName, skipped: true, reason: 'missing_table' };
    }
    throw err;
  }
}

function clonePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch (err) {
    console.warn('[versions] failed to clone payload', err.message || err);
    return {};
  }
}


function resolveRequestActor(req) {
  const actorId = req.auth?.sub || req.auth?.id || req.auth?.user_id || req.auth?.userId || req.get('X-Dev-UserId') || req.get('x-dev-userid') || null;
  const actorName = req.auth?.name || req.get('X-Dev-Username') || req.get('x-dev-username') || null;
  return { actorId, actorName };
}

const ASSIGN_ROLE_ALLOWLIST = new Set([
  'System Administrator',
  'Program Administrator',
  'Regional Coordinator',
  'SysAdmin',
  'ProgramAdmin',
  'RegionalCoordinator',
]);

const ASSIGN_FORBIDDEN_ROLES = new Set([
  'Application Assessor',
  'Adjudicator',
  'ApplicationAssessor',
]);

function getRequesterIdentity(req) {
  const role = inferUserRole(req);
  const userIdRaw = req?.staffProfile?.id ?? req?.auth?.userId ?? req?.auth?.sub ?? null;
  const regionRaw = req?.staffProfile?.region_id ?? req?.auth?.regionId ?? null;
  const userId = Number.parseInt(userIdRaw, 10);
  const regionId = Number.parseInt(regionRaw, 10);
  return {
    role: role || null,
    userId: Number.isFinite(userId) ? userId : null,
    regionId: Number.isFinite(regionId) ? regionId : null,
  };
}

async function fetchCaseRow(caseId) {
  const [[row]] = await pool.query(
    'SELECT id, application_id, client_id, assigned_to_user_id, status FROM iset_case WHERE id = ? LIMIT 1',
    [caseId]
  );
  return row || null;
}

async function fetchActionPlanWithCase(planId) {
  const [[row]] = await pool.query(
    `SELECT
       ap.*,
       c.assigned_to_user_id,
       c.portfolio_region_id,
       sp.region_id AS owner_region_id,
       (
         SELECT COUNT(*)
         FROM iset_case_intervention ci
         WHERE ci.action_plan_id = ap.id
     ) AS intervention_count
   FROM iset_case_action_plan ap
   JOIN iset_case c ON c.id = ap.case_id
   LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id
   WHERE ap.id = ?
   LIMIT 1`,
    [planId]
  );
  return row || null;
}

async function fetchInterventionWithCase(interventionId) {
  const [[row]] = await pool.query(
    `SELECT
       ci.*,
       ap.status AS action_plan_status,
       ap.case_id AS action_plan_case_id,
       ap.id AS action_plan_id,
       c.assigned_to_user_id,
       c.portfolio_region_id,
       sp.region_id AS owner_region_id
     FROM iset_case_intervention ci
     LEFT JOIN iset_case_action_plan ap ON ap.id = ci.action_plan_id
     LEFT JOIN iset_case c ON c.id = ci.case_id
     LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id
     WHERE ci.id = ?
     LIMIT 1`,
    [interventionId]
  );
  return row || null;
}

function validateCaseAccessForPlan(req, planRow) {
  const role = inferUserRole(req);
  const identity = getRequesterIdentity(req);

  const allowAll =
    role === 'System Administrator' ||
    role === 'Program Administrator' ||
    role === 'SysAdmin' ||
    role === 'ProgramAdmin';

  if (allowAll) return null;

  if (role === 'Regional Coordinator' || role === 'RegionalCoordinator') {
    const regionId = Number.isFinite(identity.regionId) ? Number(identity.regionId) : Number.NaN;
    if (!Number.isFinite(regionId)) {
      return { status: 403, body: { error: 'forbidden', detail: 'region_scope_missing' } };
    }
    const isUnassigned =
      planRow.assigned_to_user_id === null || typeof planRow.assigned_to_user_id === 'undefined';
    const portfolioMatch =
      Number.isFinite(planRow.portfolio_region_id) &&
      Number(planRow.portfolio_region_id) === regionId;
    const ownerMatch =
      Number.isFinite(planRow.owner_region_id) &&
      Number(planRow.owner_region_id) === regionId;
    if (!isUnassigned && !portfolioMatch && !ownerMatch) {
      return { status: 403, body: { error: 'forbidden', detail: 'region_scope_mismatch' } };
    }
    return null;
  }

  if (role === 'Application Assessor' || role === 'Adjudicator') {
    const requesterId = Number.isFinite(identity.userId) ? Number(identity.userId) : Number.NaN;
    if (!Number.isFinite(requesterId)) {
      return { status: 403, body: { error: 'forbidden', detail: 'assessor_scope_missing' } };
    }
    if (Number(planRow.assigned_to_user_id) !== requesterId) {
      return { status: 403, body: { error: 'forbidden' } };
    }
    return null;
  }

  return { status: 403, body: { error: 'forbidden' } };
}

function normaliseStaffProfileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.display_name || row.name || null,
    email: row.email || null,
    role: row.primary_role || null,
    regionId: row.region_id || null,
  };
}

async function fetchStaffProfileById(staffId) {
  if (!Number.isFinite(staffId)) return null;
  const [[row]] = await pool.query(
    'SELECT id, display_name, name, email, primary_role, region_id FROM staff_profiles WHERE id = ? LIMIT 1',
    [staffId]
  );
  return normaliseStaffProfileRow(row);
}

async function fetchStaffProfileBySub(sub) {
  if (!sub || typeof sub !== 'string') return null;
  const trimmed = sub.trim();
  if (!trimmed) return null;
  const [[row]] = await pool.query(
    'SELECT id, display_name, name, email, primary_role, region_id FROM staff_profiles WHERE cognito_sub = ? LIMIT 1',
    [trimmed]
  );
  return normaliseStaffProfileRow(row);
}

async function fetchStaffProfileByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  const [[row]] = await pool.query(
    'SELECT id, display_name, name, email, primary_role, region_id FROM staff_profiles WHERE LOWER(email) = LOWER(?) LIMIT 1',
    [trimmed]
  );
  return normaliseStaffProfileRow(row);
}

async function resolveStaffProfileIdentifier(identifier) {
  if (identifier === null || typeof identifier === 'undefined') return null;

  if (Number.isFinite(identifier)) {
    return fetchStaffProfileById(Number(identifier));
  }

  if (typeof identifier === 'string') {
    const trimmed = identifier.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const numericId = Number.parseInt(trimmed, 10);
      const byId = await fetchStaffProfileById(numericId);
      if (byId) return byId;
    }

    const bySub = await fetchStaffProfileBySub(trimmed);
    if (bySub) return bySub;

    if (trimmed.includes('@')) {
      const byEmail = await fetchStaffProfileByEmail(trimmed);
      if (byEmail) return byEmail;
    }
  }

  return null;
}

async function fetchTrackingIdForCase(applicationId, caseId) {
  if (applicationId) {
    const [[tracking]] = await pool.query(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.submission_snapshot.reference_number')) AS reference_number
         FROM iset_application
        WHERE id = ?
        LIMIT 1`,
      [applicationId]
    );
    if (tracking && tracking.reference_number) {
      return tracking.reference_number;
    }
  }
  return caseId ? `CASE-${caseId}` : null;
}

function ensureCanAssignCase(identity, targetStaff) {
  const { role, regionId } = identity || {};
  if (ASSIGN_FORBIDDEN_ROLES.has(role)) {
    return false;
  }
  if (ASSIGN_ROLE_ALLOWLIST.has(role || '')) {
    if (role === 'Regional Coordinator' || role === 'RegionalCoordinator') {
      if (!Number.isFinite(regionId)) return false;
      if (targetStaff && targetStaff.regionId && Number(targetStaff.regionId) !== Number(regionId)) {
        return false;
      }
    }
    return true;
  }
  return false;
}

async function persistCaseAssignment(caseId, toUserId) {
  await pool.query(
    'UPDATE iset_case SET assigned_to_user_id = ?, updated_at = NOW() WHERE id = ?',
    [toUserId, caseId]
  );
}

async function publishAssignmentEvent({ caseId, applicationId, previousStaff, nextStaff, actor }) {
  const trackingId = await fetchTrackingIdForCase(applicationId, caseId);
  const payload = {
    tracking_id: trackingId,
    from_assignee_id: previousStaff?.id ?? null,
    from_assignee_email: previousStaff?.email ?? null,
    from_assignee_name: previousStaff?.name ?? null,
    to_assignee_id: nextStaff?.id ?? null,
    to_assignee_email: nextStaff?.email ?? null,
    to_assignee_name: nextStaff?.name ?? null,
  };

  let eventType = null;
  if (previousStaff?.id && nextStaff?.id && previousStaff.id !== nextStaff.id) {
    eventType = 'case_reassigned';
    payload.message = `Case reassigned from ${previousStaff.name || previousStaff.email || previousStaff.id} to ${nextStaff.name || nextStaff.email || nextStaff.id}.`;
  } else if (!previousStaff?.id && nextStaff?.id) {
    eventType = 'case_assigned';
    payload.message = `Case assigned to ${nextStaff.name || nextStaff.email || nextStaff.id}.`;
  } else if (previousStaff?.id && !nextStaff?.id) {
    eventType = 'case_unassigned';
    payload.message = `Case unassigned from ${previousStaff.name || previousStaff.email || previousStaff.id}.`;
  }

  if (!eventType) return;

  const actorId = actor?.actorId || null;
  const actorName = actor?.actorName || null;

  await captureCaseEvent({
    type: eventType,
    caseId,
    payload,
    trackingId,
    actorId,
    actorName,
  });
}

function resolveActiveStaffProfileId(req) {
  const candidateValues = [];
  if (req?.staffProfile?.id) candidateValues.push(req.staffProfile.id);
  if (req?.auth?.staffProfileId) candidateValues.push(req.auth.staffProfileId);
  if (typeof req?.get === 'function') {
    candidateValues.push(req.get('X-Dev-UserId'));
    candidateValues.push(req.get('x-dev-userid'));
  }
  for (const value of candidateValues) {
    if (value === null || typeof value === 'undefined') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return null;
}

function normaliseWatchMetadata(input) {
  if (input === null || typeof input === 'undefined') return null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed ? { note: trimmed } : null;
  }
  if (typeof input === 'object') {
    try {
      const clone = JSON.parse(JSON.stringify(input));
      return Object.keys(clone).length ? clone : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseListQueryParam(raw) {
  if (typeof raw === 'undefined' || raw === null) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  const tokens = [];
  for (const value of values) {
    if (value === null || typeof value === 'undefined') continue;
    const parts = String(value).split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) tokens.push(trimmed);
    }
  }
  return tokens;
}

function parseDateQueryParam(raw) {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first === 'undefined' || first === null || first === '') {
    return { provided: false, value: null };
  }
  if (first instanceof Date && !Number.isNaN(first.getTime())) {
    return { provided: true, value: first };
  }
  const date = new Date(first);
  if (Number.isNaN(date.getTime())) {
    return { provided: true, value: null };
  }
  return { provided: true, value: date };
}

function firstQueryValue(raw) {
  if (Array.isArray(raw)) {
    return raw.length ? raw[0] : undefined;
  }
  return raw;
}

async function captureCaseEvent({ type, caseId, payload, actorId, actorName, actorType = 'staff', trackingId, correlationId }) {
  try {
    await emitCaseEventSdk({
      type,
      caseId,
      actor: { type: actorType, id: actorId || null, displayName: actorName || null },
      payload,
      trackingId,
      correlationId,
    });
  } catch (err) {
    if (err instanceof EventValidationError) {
      console.warn('[events] captureCaseEvent validation failed', type, err.message, err.details || {});
    } else {
      console.error('[events] captureCaseEvent failed', type, err?.message || err);
    }
  }

}
let applicationVersionTableEnsured = false;
async function ensureApplicationVersionTable() {
  if (applicationVersionTableEnsured) return;
  const createSql = `
    CREATE TABLE IF NOT EXISTS iset_application_version (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      application_id bigint unsigned NOT NULL,
      version int NOT NULL,
      payload_json json NOT NULL,
      change_summary text,
      created_by_id varchar(128),
      created_by_name varchar(255),
      restored_from_version int DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_application_version (application_id, version),
      KEY idx_application_version_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  try {
    await pool.query(createSql);
    applicationVersionTableEnsured = true;
  } catch (err) {
    console.error('[versions] failed to ensure version table', err.message || err);
    throw err;
  }
}

function sanitiseAnswersPayload(answers = {}) {
  const result = {};
  if (!answers || typeof answers !== 'object') return result;
  for (const [key, value] of Object.entries(answers)) {
    if (value === undefined) continue;
    if (value === null) {
      result[key] = null;
    } else if (typeof value === 'object') {
      try {
        result[key] = JSON.parse(JSON.stringify(value));
      } catch (_) {
        result[key] = String(value);
      }
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

async function hydrateSubmissionAnswersIfNeeded(connection, applicationRow, payloadObj) {
  if (payloadObj.answers && typeof payloadObj.answers === 'object' && Object.keys(payloadObj.answers).length) {
    return;
  }
  const submissionId = applicationRow?.submission_id;
  if (!submissionId) return;
  try {
    const [[submission]] = await connection.query('SELECT intake_payload FROM iset_application_submission WHERE id = ? LIMIT 1', [submissionId]);
    if (!submission || !submission.intake_payload) return;
    let intake = submission.intake_payload;
    if (typeof intake === 'string') {
      try { intake = JSON.parse(intake); } catch { intake = {}; }
    }
    if (intake && typeof intake === 'object') {
      const candidate = intake.answers || intake.form_answers || intake.data || intake;
      if (candidate && typeof candidate === 'object') {
        payloadObj.answers = { ...candidate };
      }
    }
  } catch (err) {
    console.warn('[versions] failed to hydrate submission answers', err.message || err);
  }
}

async function readApplicationPayload(connection, applicationId, options = { forUpdate: false }) {
  const clause = options.forUpdate ? 'FOR UPDATE' : '';
  const [[row]] = await connection.query(`SELECT * FROM iset_application WHERE id = ? ${clause}`.trim(), [applicationId]);
  if (!row) return null;
  let payload = row.payload_json;
  if (payload && typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }
  if (!payload || typeof payload !== 'object') payload = {};
  await hydrateSubmissionAnswersIfNeeded(connection, row, payload);
  return {
    row,
    payload
  };
}

function toDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function toIsoDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function safeJsonParse(value, fallback = null) {
  if (value === null || typeof value === 'undefined') return fallback;
  try {
    let source = value;
    if (Buffer.isBuffer(source)) {
      source = source.toString('utf8');
    }
    if (typeof source === 'string') {
      return JSON.parse(source);
    }
    if (typeof source === 'object') {
      return source;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function mapIlmpComplianceFromSubmission(row) {
  const defaultSummary = {
    status: 'pending',
    messages: [],
    warnings: [],
    blockingIssues: [],
    summary: null,
    lastValidatedAt: null,
  };

  if (!row) {
    return defaultSummary;
  }

  const statusMap = {
    ready: 'clean',
    blocked: 'warning',
    needs_review: 'pending',
    pending: 'pending',
    reviewing: 'pending',
  };
  const rawStatus = typeof row.readiness_status === 'string' ? row.readiness_status.toLowerCase() : null;
  const status = statusMap[rawStatus] || defaultSummary.status;

  const toStringArray = value => {
    const parsed = safeJsonParse(value, value);
    if (Array.isArray(parsed)) {
      return parsed
        .map(item => (typeof item === 'string' ? item.trim() : item))
        .filter(item => typeof item === 'string' && item.length);
    }
    if (typeof parsed === 'string') {
      const trimmed = parsed.trim();
      return trimmed ? [trimmed] : [];
    }
    return [];
  };

  const warnings = toStringArray(row.warnings);
  const blockingIssues = toStringArray(row.blocking_issues);
  const messages = [...blockingIssues, ...warnings];
  const summary = safeJsonParse(row.readiness_summary, null);
  const lastValidatedAt = row.last_validated_at ? toIsoDateTime(row.last_validated_at) : null;

  return {
    status,
    messages,
    warnings,
    blockingIssues,
    summary,
    lastValidatedAt,
  };
}

function mapActionPlanRow(plan) {
  if (!plan) return null;
  const metadata = safeJsonParse(plan.metadata_json, null);
  const toNumber = value => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };
  return {
    id: plan.id,
    caseId: plan.case_id || plan.caseId || null,
    name: plan.name || null,
    status: plan.status || null,
    effectiveDate: toIsoDateTime(plan.effective_date),
    reviewDate: toIsoDateTime(plan.review_date),
    activatedAt: toIsoDateTime(plan.activated_at),
    closedAt: toIsoDateTime(plan.closed_at),
    archivedAt: toIsoDateTime(plan.archived_at),
    resultCode: plan.result_code || null,
    resultDate: toDateOnly(plan.result_date),
    outcomeSummary: plan.outcome_summary || null,
    closureNotes: plan.closure_notes || null,
    ownerStaffProfileId: plan.owner_staff_profile_id || null,
    ownerUserId: plan.owner_user_id || null,
    summary:
      metadata && typeof metadata.summary !== 'undefined'
        ? metadata.summary
        : plan.notes || null,
    interventionCount: toNumber(plan.intervention_count),
    createdAt: toIsoDateTime(plan.created_at),
    updatedAt: toIsoDateTime(plan.updated_at),
    interventions: Array.isArray(plan.interventions) ? plan.interventions : undefined,
  };
}

function normaliseInterventionStatus(status) {
  if (!status) return 'planned';
  const value = String(status).trim().toLowerCase();
  if (['planned', 'planning', 'draft'].includes(value)) return 'planned';
  if (['active', 'inprogress', 'in-progress', 'in_progress', 'progress'].includes(value)) return 'in_progress';
  if (['complete', 'completed', 'closed', 'done', 'finished'].includes(value)) return 'completed';
  if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
  if (['suspended', 'on-hold', 'on_hold'].includes(value)) return 'suspended';
  return 'planned';
}

function isInterventionClosedStatus(status) {
  const value = normaliseInterventionStatus(status);
  return value === 'completed' || value === 'cancelled';
}

function normaliseRecurringCostType(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'recurring') return 'recurring';
  if (['one_time', 'one-time', 'one time', 'single', 'fixed'].includes(trimmed)) return 'one_time';
  return null;
}

function normaliseRecurringNumber(value) {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function mergeRecurringCostMetadata(target, source, fallbackTotal) {
  if (!target || typeof target !== 'object' || !source || typeof source !== 'object') {
    return false;
  }

  const before = JSON.stringify(target);
  const costTypeProvided = Object.prototype.hasOwnProperty.call(source, 'costType');
  const costSettingsProvided = Object.prototype.hasOwnProperty.call(source, 'costSettings');
  const recurrenceProvided = Object.prototype.hasOwnProperty.call(source, 'recurrence');

  let resolvedCostType = costTypeProvided ? normaliseRecurringCostType(source.costType) : null;

  const existingCostSettings =
    target.costSettings && typeof target.costSettings === 'object' ? target.costSettings : null;
  const existingRecurrence =
    target.recurrence && typeof target.recurrence === 'object' ? target.recurrence : null;

  if (costSettingsProvided) {
    const rawSettings = source.costSettings;
    if (rawSettings && typeof rawSettings === 'object') {
      const settingsType = normaliseRecurringCostType(rawSettings.type);
      if (!resolvedCostType && settingsType) {
        resolvedCostType = settingsType;
      }
      const period = typeof rawSettings.period === 'string' ? rawSettings.period.trim() : '';
      const amount = normaliseRecurringNumber(rawSettings.amountPerPeriod);
      const occurrences = normaliseRecurringNumber(rawSettings.occurrences);
      let total = normaliseRecurringNumber(
        Object.prototype.hasOwnProperty.call(rawSettings, 'calculatedTotal')
          ? rawSettings.calculatedTotal
          : null
      );
      if (total === null && Number.isFinite(fallbackTotal)) {
        total = fallbackTotal;
      }
      const shouldPersist =
        resolvedCostType === 'recurring' ||
        settingsType === 'recurring' ||
        period.length > 0 ||
        amount !== null ||
        occurrences !== null;
      if (shouldPersist) {
        const nextSettings = {
          type: 'recurring',
          period: period || '',
          amountPerPeriod: amount,
          occurrences,
          calculatedTotal: total,
        };
        const sameSettings =
          existingCostSettings &&
          existingCostSettings.type === 'recurring' &&
          (existingCostSettings.period || '') === nextSettings.period &&
          normaliseRecurringNumber(existingCostSettings.amountPerPeriod) === nextSettings.amountPerPeriod &&
          normaliseRecurringNumber(existingCostSettings.occurrences) === nextSettings.occurrences &&
          normaliseRecurringNumber(existingCostSettings.calculatedTotal) === nextSettings.calculatedTotal;
        if (!sameSettings) {
          target.costSettings = nextSettings;
        }
        resolvedCostType = 'recurring';
      } else if (existingCostSettings) {
        delete target.costSettings;
      }
    } else if (existingCostSettings) {
      delete target.costSettings;
    }
  }

  if (costTypeProvided) {
    if (resolvedCostType === 'recurring') {
      if (target.costType !== 'recurring') {
        target.costType = 'recurring';
      }
    } else if (resolvedCostType === 'one_time') {
      if (target.costType !== 'one_time') {
        target.costType = 'one_time';
      }
      if (target.costSettings) {
        delete target.costSettings;
      }
    } else if (Object.prototype.hasOwnProperty.call(target, 'costType')) {
      delete target.costType;
    }
  } else if (target.costSettings && resolvedCostType === 'recurring') {
    if (target.costType !== 'recurring') {
      target.costType = 'recurring';
    }
  }

  if (recurrenceProvided) {
    const rawRecurrence = source.recurrence;
    if (target.costType === 'recurring' && rawRecurrence && typeof rawRecurrence === 'object') {
      const period = typeof rawRecurrence.period === 'string' ? rawRecurrence.period.trim() : '';
      const amount = normaliseRecurringNumber(rawRecurrence.amountPerPeriod);
      const occurrences = normaliseRecurringNumber(rawRecurrence.occurrences);
      let total = normaliseRecurringNumber(
        Object.prototype.hasOwnProperty.call(rawRecurrence, 'calculatedTotal')
          ? rawRecurrence.calculatedTotal
          : null
      );
      if (total === null && Number.isFinite(fallbackTotal)) {
        total = fallbackTotal;
      }
      const nextRecurrence = {
        period: period || '',
        amountPerPeriod: amount,
        occurrences,
        calculatedTotal: total,
      };
      const sameRecurrence =
        existingRecurrence &&
        (existingRecurrence.period || '') === nextRecurrence.period &&
        normaliseRecurringNumber(existingRecurrence.amountPerPeriod) === nextRecurrence.amountPerPeriod &&
        normaliseRecurringNumber(existingRecurrence.occurrences) === nextRecurrence.occurrences &&
        normaliseRecurringNumber(existingRecurrence.calculatedTotal) === nextRecurrence.calculatedTotal;
      if (!sameRecurrence) {
        target.recurrence = nextRecurrence;
      }
      if (target.costType !== 'recurring') {
        target.costType = 'recurring';
      }
    } else if (existingRecurrence) {
      delete target.recurrence;
    }
  } else if (
    (costTypeProvided && resolvedCostType !== 'recurring') ||
    (costSettingsProvided && !target.costSettings)
  ) {
    if (existingRecurrence) {
      delete target.recurrence;
    }
  }

  if (target.costType === 'recurring' && !target.costSettings) {
    delete target.costType;
  }
  if (target.costType && target.costType !== 'recurring') {
    target.costType = 'one_time';
  }

  const after = JSON.stringify(target);
  return before !== after;
}

function mapInterventionRow(row) {
  if (!row) return null;
  const metadata = safeJsonParse(row.metadata_json, null) || {};
  const toNumber = value => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };
  const normaliseStatus = status => (typeof status === 'string' ? status.trim().toLowerCase() : null);
  const status = normaliseInterventionStatus(row.status);
  const complianceMeta =
    metadata && typeof metadata.compliance === 'object' && metadata.compliance !== null
      ? metadata.compliance
      : {};
  const approvedAmount = toNumber(row.approved_amount);
  const budgetAmount = toNumber(row.budget_amount);
  const actualAmount = toNumber(row.actual_amount);
  const costFromMeta = toNumber(metadata.cost);
  const resolvedCost = approvedAmount ?? budgetAmount ?? costFromMeta;
  const startDate = toDateOnly(row.start_date);
  const endDate = toDateOnly(row.end_date);
  let durationWeeks = toNumber(metadata.durationWeeks);
  if (!Number.isFinite(durationWeeks) && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const diffDays = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
      durationWeeks = Math.max(1, Math.round(diffDays / 7));
    }
  }

  const notes =
    typeof metadata.notes === 'string'
      ? metadata.notes
      : Array.isArray(metadata.notes)
      ? metadata.notes.join('\n')
      : row.notes || null;

  const compliance = {
    ilmp:
      typeof complianceMeta.ilmp === 'string'
        ? complianceMeta.ilmp
        : isInterventionClosedStatus(status)
        ? 'ok'
        : 'pending',
    finance:
      typeof complianceMeta.finance === 'string'
        ? complianceMeta.finance
        : Number.isFinite(approvedAmount) || Number.isFinite(budgetAmount)
        ? 'ok'
        : 'pending',
  };

  return {
    id: row.id,
    caseId: row.case_id || null,
    actionPlanId: row.action_plan_id || null,
    code: metadata.code || row.intervention_type || null,
    title: metadata.title || metadata.description || row.notes || null,
    description: metadata.description || null,
    status,
    startDate,
    endDate,
    durationWeeks: Number.isFinite(durationWeeks) ? durationWeeks : null,
    outcome: metadata.outcome || metadata.outcomeLabel || row.outcome_code || null,
    outcomeCode: row.outcome_code || null,
    fundingStream: row.funding_stream || metadata.fundingStream || null,
    cost: Number.isFinite(resolvedCost) ? resolvedCost : null,
    budgetAmount,
    approvedAmount,
    actualAmount,
    potId: metadata.potId || metadata.budgetPotId || null,
    noc: metadata.noc || null,
    nocVersion: metadata.nocVersion || null,
    notes,
    compliance,
    createdByStaffProfileId: row.created_by_staff_profile_id || null,
    createdAt: toIsoDateTime(row.created_at),
    updatedAt: toIsoDateTime(row.updated_at),
    closedAt: toIsoDateTime(row.closed_at),
    metadata: Object.keys(metadata).length ? metadata : null,
  };
}

const CASE_STATUS_DERIVED_VALUES = Object.freeze({
  pendingApproval: 'pending_approval',
  initiated: 'initiated',
  active: 'active',
  dormant: 'dormant',
  readyToClose: 'ready_to_close',
  closed: 'closed',
  archived: 'archived',
});

const CASE_STATUS_TERMINAL_VALUES = [
  CASE_STATUS_DERIVED_VALUES.closed,
  CASE_STATUS_DERIVED_VALUES.archived,
  CASE_STATUS_DERIVED_VALUES.readyToClose,
  'withdrawn',
  'cancelled',
  'rejected',
  'completed',
];
const CASE_STATUS_HOLD_VALUES = [
  'docs_requested',
  'docs requested',
  'action required',
  'action required (docs requested)',
  'pending info',
  'pending information',
  'info requested',
  'information requested',
  'on hold',
  'on_hold',
];
const CASE_STATUS_EXCLUDED_FOR_ASSESSMENT = Array.from(new Set([
  ...CASE_STATUS_TERMINAL_VALUES,
  ...CASE_STATUS_HOLD_VALUES,
]));
const CASE_STATUS_AWAITING_DECISION = [CASE_STATUS_DERIVED_VALUES.pendingApproval];

const CASE_STATUS_FINAL_SET = new Set([
  CASE_STATUS_DERIVED_VALUES.readyToClose,
  CASE_STATUS_DERIVED_VALUES.closed,
  CASE_STATUS_DERIVED_VALUES.archived,
]);

const CASE_STATUS_INITIATED_SEEDS = new Set([
  CASE_STATUS_DERIVED_VALUES.initiated,
  CASE_STATUS_DERIVED_VALUES.active,
  CASE_STATUS_DERIVED_VALUES.dormant,
  CASE_STATUS_DERIVED_VALUES.readyToClose,
  CASE_STATUS_DERIVED_VALUES.closed,
  CASE_STATUS_DERIVED_VALUES.archived,
  'approved',
]);

const CASE_STATUS_PENDING_SEEDS = new Set([
  CASE_STATUS_DERIVED_VALUES.pendingApproval,
  'open',
  'pending',
  'pending_approval',
  'submitted',
  'in_review',
  null,
]);


const CASE_STATUS_TERMINAL_VALUES_LOWER = CASE_STATUS_TERMINAL_VALUES.map(v => v.toLowerCase());
const CASE_STATUS_HOLD_VALUES_LOWER = CASE_STATUS_HOLD_VALUES.map(v => v.toLowerCase());
const CASE_STATUS_EXCLUDED_FOR_ASSESSMENT_LOWER = CASE_STATUS_EXCLUDED_FOR_ASSESSMENT.map(v => v.toLowerCase());
const CASE_STATUS_AWAITING_DECISION_LOWER = CASE_STATUS_AWAITING_DECISION.map(v => v.toLowerCase());
const DUE_SOON_THRESHOLD_HOURS = 7 * 24;
const DUE_TODAY_THRESHOLD_HOURS = 24;


const normaliseCaseStatusValue = value => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const trimmed = String(value).trim().toLowerCase();
  return trimmed || null;
};

async function recomputeCaseStatus(caseId, connection = null) {
  const numericCaseId = Number(caseId);
  if (!Number.isInteger(numericCaseId) || numericCaseId <= 0) {
    return { status: null, previousStatus: null, changed: false };
  }

  let conn = connection;
  let shouldRelease = false;
  if (!conn) {
    conn = await pool.getConnection();
    shouldRelease = true;
  }

  try {
    const [[caseRow]] = await conn.query(
      'SELECT id, status, application_id FROM iset_case WHERE id = ? LIMIT 1',
      [numericCaseId]
    );
    if (!caseRow) {
      return { status: null, previousStatus: null, changed: false };
    }

    const currentStatus = normaliseCaseStatusValue(caseRow.status);
    if (currentStatus && CASE_STATUS_FINAL_SET.has(currentStatus)) {
      return { status: currentStatus, previousStatus: currentStatus, changed: false };
    }

    const [[planSummary]] = await conn.query(
      `SELECT
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
          SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_count,
          SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived_count,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_count,
          COUNT(*) AS total_count
        FROM iset_case_action_plan
        WHERE case_id = ?`,
      [numericCaseId]
    );

    const activePlans = Number(planSummary?.active_count || 0);
    const closedPlans = Number(planSummary?.closed_count || 0) + Number(planSummary?.archived_count || 0);
    const draftPlans = Number(planSummary?.draft_count || 0);
    const totalPlans = Number(planSummary?.total_count || 0);

    let nextStatus = currentStatus;

    if (activePlans > 0) {
      nextStatus = CASE_STATUS_DERIVED_VALUES.active;
    } else if (closedPlans > 0) {
      nextStatus = CASE_STATUS_DERIVED_VALUES.dormant;
    } else if (draftPlans > 0) {
      nextStatus = CASE_STATUS_DERIVED_VALUES.initiated;
    } else if (totalPlans > 0) {
      nextStatus = CASE_STATUS_DERIVED_VALUES.initiated;
    } else if (CASE_STATUS_INITIATED_SEEDS.has(currentStatus)) {
      nextStatus = CASE_STATUS_DERIVED_VALUES.initiated;
    } else if (CASE_STATUS_PENDING_SEEDS.has(currentStatus)) {
      nextStatus = CASE_STATUS_DERIVED_VALUES.pendingApproval;
    } else if (!currentStatus) {
      nextStatus = CASE_STATUS_DERIVED_VALUES.pendingApproval;
    } else {
      // Preserve unrecognised states to avoid accidental downgrade.
      nextStatus = currentStatus;
    }

    if (nextStatus === currentStatus || !nextStatus) {
      return { status: currentStatus, previousStatus: currentStatus, changed: false };
    }

    await conn.query(
      'UPDATE iset_case SET status = ?, updated_at = NOW() WHERE id = ?',
      [nextStatus, numericCaseId]
    );

    return { status: nextStatus, previousStatus: currentStatus, changed: true };
  } finally {
    if (shouldRelease && conn) {
      conn.release();
    }
  }
}

async function buildClientProfileFromApplication(connection, applicationId) {
  const applicationPayload = await readApplicationPayload(connection, applicationId, { forUpdate: true });
  if (!applicationPayload) return null;

  let submissionRow = null;
  const submissionId = applicationPayload.row?.submission_id || null;
  if (submissionId) {
    const [[submission]] = await connection.query(
      'SELECT * FROM iset_application_submission WHERE id = ? LIMIT 1',
      [submissionId]
    );
    submissionRow = submission || null;
  }

  const payload = applicationPayload.payload || {};
  const answers = payload.answers || {};
  const context = {
    payload,
    answers,
    submissionRow
  };

  const clamp = (value, limit) => {
    const normalised = normaliseString(value);
    if (!normalised) return null;
    return normalised.length > limit ? normalised.slice(0, limit) : normalised;
  };

  const firstName = clamp(extractFirstName(context) || extractPreferredName(context), 128) || 'Unknown';
  const lastName = clamp(extractLastName(context), 128) || 'Client';
  const initials = clamp(extractMiddleInitials(context), 16);
  const preferredName = clamp(extractPreferredName(context), 128);
  const dob = toDateOnly(extractDob(context));
  const gender = clamp(extractGender(context), 32);
  const aboriginalGroup = clamp(extractIndigenousIdentity(context), 64);

  const addressStructure = extractAddress(context);
  const sanitise = value => {
    const normalised = normaliseString(value);
    return normalised || null;
  };

  const address = addressStructure
    ? {
        line1: sanitise(addressStructure.line1),
        line2: sanitise(addressStructure.line2),
        city: sanitise(addressStructure.city),
        province: sanitise(addressStructure.province),
        postalCode: sanitise(addressStructure.postalCode)
      }
    : null;

  const contactDetailsRaw = extractContactDetails(context);
  const contactEmailNormalized = contactDetailsRaw?.email
    ? sanitise(contactDetailsRaw.email)?.toLowerCase() || null
    : null;
  const contact = contactDetailsRaw
    ? {
        email: sanitise(contactDetailsRaw.email),
        emailNormalized: contactEmailNormalized,
        phone: sanitise(contactDetailsRaw.phone),
        alternatePhone: sanitise(contactDetailsRaw.alternatePhone),
        mailingAddress: sanitise(contactDetailsRaw.mailingAddress),
        homeCommunity: sanitise(contactDetailsRaw.homeCommunity)
      }
    : null;

  const referenceNumber =
    sanitise(payload?.submission_snapshot?.reference_number) ||
    sanitise(submissionRow?.reference_number) ||
    null;

  const addressPayload = {
    source: 'iset_application',
    extractedAt: new Date().toISOString(),
    applicationId,
    submissionId,
    referenceNumber,
    preferredName,
    address,
    contact
  };

  return {
    firstName,
    lastName,
    initials,
    dob,
    gender,
    aboriginalGroup,
    emailNormalized: contactEmailNormalized,
    addressJson: JSON.stringify(addressPayload)
  };
}

async function ensureCaseClientLinkForApproval(connection, { caseId, applicationId, existingClientId }) {
  if (existingClientId) return existingClientId;
  if (!applicationId) return null;

  const profile = await buildClientProfileFromApplication(connection, applicationId);
  if (!profile) {
    console.warn('[cases] unable to build client profile for application %s (case %s)', applicationId, caseId);
    return null;
  }

  const lowerFirst = profile.firstName.toLowerCase();
  const lowerLast = profile.lastName.toLowerCase();
  let targetClientId = null;

  if (profile.emailNormalized) {
    const [[byEmail]] = await connection.query(
      `SELECT id
         FROM client
        WHERE address_json IS NOT NULL
          AND JSON_UNQUOTE(JSON_EXTRACT(address_json, '$.contact.emailNormalized')) = ?
        LIMIT 1`,
      [profile.emailNormalized]
    );
    if (byEmail) {
      targetClientId = byEmail.id;
    }
  }

  if (!targetClientId) {
    if (profile.dob) {
      const [[byNameDob]] = await connection.query(
        `SELECT id
           FROM client
          WHERE LOWER(first_name) = ?
            AND LOWER(last_name) = ?
            AND dob = ?
          LIMIT 1`,
        [lowerFirst, lowerLast, profile.dob]
      );
      if (byNameDob) {
        targetClientId = byNameDob.id;
      }
    } else {
      const [[byNameOnly]] = await connection.query(
        `SELECT id
           FROM client
          WHERE LOWER(first_name) = ?
            AND LOWER(last_name) = ?
            AND dob IS NULL
          LIMIT 1`,
        [lowerFirst, lowerLast]
      );
      if (byNameOnly) {
        targetClientId = byNameOnly.id;
      }
    }
  }

  if (!targetClientId) {
    const [insertResult] = await connection.query(
      `INSERT INTO client (dob, gender, aboriginal_group, last_name, first_name, initials, address_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        profile.dob,
        profile.gender,
        profile.aboriginalGroup,
        profile.lastName,
        profile.firstName,
        profile.initials,
        profile.addressJson
      ]
    );
    targetClientId = insertResult.insertId;
  } else {
    await connection.query(
      'UPDATE client SET updated_at = NOW() WHERE id = ?',
      [targetClientId]
    );
  }

  await connection.query(
    'UPDATE iset_case SET client_id = ?, updated_at = NOW() WHERE id = ?',
    [targetClientId, caseId]
  );

  return targetClientId;
}

async function getHighestApplicationVersion(connection, applicationId, fallbackCurrentVersion) {
  await ensureApplicationVersionTable();
  const [[maxRow]] = await connection.query('SELECT MAX(version) AS maxVersion FROM iset_application_version WHERE application_id = ?', [applicationId]);
  const maxVersion = Number(maxRow?.maxVersion || 0);
  return Math.max(Number(fallbackCurrentVersion || 0), maxVersion);
}

async function ensureVersionSnapshotExists(connection, applicationId, version, payloadObj, actorMeta) {
  await ensureApplicationVersionTable();
  const [[exists]] = await connection.query('SELECT id FROM iset_application_version WHERE application_id = ? AND version = ? LIMIT 1', [applicationId, version]);
  if (exists) return;
  const serialised = JSON.stringify(payloadObj ?? {});
  await connection.query(
    'INSERT INTO iset_application_version (application_id, version, payload_json, change_summary, created_by_id, created_by_name, restored_from_version) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [applicationId, version, serialised, actorMeta?.changeSummary || null, actorMeta?.actorId || null, actorMeta?.actorName || null, null]
  );
}

async function insertNewVersionEntry(connection, applicationId, version, payloadObj, metadata = {}) {
  await ensureApplicationVersionTable();
  const serialised = JSON.stringify(payloadObj ?? {});
  await connection.query(
    'INSERT INTO iset_application_version (application_id, version, payload_json, change_summary, created_by_id, created_by_name, restored_from_version) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      applicationId,
      version,
      serialised,
      metadata.changeSummary || null,
      metadata.actorId || null,
      metadata.actorName || null,
      metadata.restoredFromVersion || null
    ]
  );
}

const DEFAULT_LOCK_CONFIG = Object.freeze({
  mode: 'optimistic',
  lockTtlMinutes: 15,
  heartbeatMinutes: 2
});

function normaliseLockConfig(raw) {
  const config = { ...DEFAULT_LOCK_CONFIG };
  if (raw && typeof raw === 'object') {
    const mode = typeof raw.mode === 'string' ? raw.mode.trim().toLowerCase() : '';
    if (['optimistic', 'pessimistic', 'mixed'].includes(mode)) {
      config.mode = mode === 'mixed' ? 'pessimistic' : mode; // treat mixed as pessimistic for now
    }
    const ttl = Number(raw.lockTtlMinutes ?? raw.ttlMinutes);
    if (Number.isFinite(ttl) && ttl >= 1) {
      config.lockTtlMinutes = Math.min(Math.round(ttl), 240);
    }
    const heartbeat = Number(raw.heartbeatMinutes ?? raw.heartbeat);
    if (Number.isFinite(heartbeat) && heartbeat >= 1) {
      config.heartbeatMinutes = Math.min(Math.round(heartbeat), config.lockTtlMinutes);
    }
  }
  // If pessimistic requested but heartbeat exceeds ttl, clamp
  if (config.heartbeatMinutes > config.lockTtlMinutes) {
    config.heartbeatMinutes = config.lockTtlMinutes;
  }
  return config;
}

async function readLockConfig() {
  try {
    const [[row]] = await pool.query("SELECT v FROM iset_runtime_config WHERE scope='admin' AND k='locking' LIMIT 1");
    if (!row) return { ...DEFAULT_LOCK_CONFIG, source: 'default' };
    let value = row.v;
    if (value && typeof value === 'string') {
      try { value = JSON.parse(value); } catch { value = null; }
    }
    const config = normaliseLockConfig(value);
    return { ...config, source: row ? 'stored' : 'default' };
  } catch (err) {
    console.warn('[locking] read config failed:', err.message);
    return { ...DEFAULT_LOCK_CONFIG, source: 'error' };
  }
}

async function writeLockConfig(config) {
  const normalised = normaliseLockConfig(config);
  await pool.query("CREATE TABLE IF NOT EXISTS iset_runtime_config (id INT AUTO_INCREMENT PRIMARY KEY, scope VARCHAR(32) NOT NULL, k VARCHAR(128) NOT NULL, v JSON NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_scope_key (scope,k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
  await pool.query(
    "INSERT INTO iset_runtime_config (scope,k,v) VALUES ('admin','locking',CAST(? AS JSON)) ON DUPLICATE KEY UPDATE v=VALUES(v)",
    [JSON.stringify(normalised)]
  );
  return normalised;
}

function resolveLockIdentity(req) {
  const actor = resolveRequestActor(req) || {};
  let userId = actor.actorId || req.auth?.sub || req.auth?.user_id || req.auth?.id || req.get('X-Dev-UserId') || req.get('x-dev-userid') || null;
  let displayName = actor.actorName || req.auth?.name || req.staffProfile?.display_name || req.staffProfile?.name || req.get('X-Dev-Username') || req.get('x-dev-username') || null;
  let email = req.auth?.email || req.staffProfile?.email || req.get('X-Dev-Email') || req.get('x-dev-email') || null;
  if (typeof userId === 'number') userId = String(userId);
  return {
    userId: userId ? String(userId) : null,
    displayName: displayName || null,
    email: email || null
  };
}

function lockingModeRequiresPessimistic(config) {
  const mode = (config?.mode || '').toLowerCase();
  return mode && mode !== 'optimistic';
}

async function enforceApplicationLock(connection, applicationId, req, lockConfig) {
  if (!lockingModeRequiresPessimistic(lockConfig)) {
    return { ok: true, reason: 'not_required' };
  }
  const identity = resolveLockIdentity(req);
  if (!identity.userId) {
    return { ok: false, reason: 'identity_missing' };
  }
  const [[lockRow]] = await connection.query(
    'SELECT owner_user_id, owner_display_name, owner_email, expires_at FROM application_lock WHERE application_id = ? FOR UPDATE',
    [applicationId]
  );
  const now = new Date();
  if (!lockRow) {
    return { ok: false, reason: 'missing' };
  }
  const expired = !lockRow.expires_at || new Date(lockRow.expires_at) <= now;
  if (expired) {
    await connection.query('DELETE FROM application_lock WHERE application_id = ?', [applicationId]);
    return { ok: false, reason: 'expired' };
  }
  if (lockRow.owner_user_id !== identity.userId) {
    return { ok: false, reason: 'owned_by_other', lock: lockRow };
  }
  return { ok: true, lock: lockRow };
}

// Configure Nunjucks to use GOV.UK Frontend components
nunjucks.configure([
  path.join(__dirname, 'src', 'server-macros'),
  path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist'),
], {
  autoescape: true,
  watch: false,
  noCache: true,
});

// Define the generateGUID function
const generateGUID = () => {
  return Math.random().toString(36).substring(2, 11).toUpperCase();
};

// Use dynamic path based on the environment
const dotenvPath = process.env.NODE_ENV === 'production'
  ? '/home/ec2-user/admin-dashboard/.env'  // Path for production
  : path.resolve(__dirname, '.env'); // Development/local path
require('dotenv').config({ path: dotenvPath });


console.log("Loaded .env from:", dotenvPath);  // Debugging log
console.log("CORS Allowed Origin:", process.env.ALLOWED_ORIGIN);

// Set a default value for ALLOWED_ORIGIN in development if not set in .env
if (process.env.NODE_ENV !== 'production' && !process.env.ALLOWED_ORIGIN) {
  // Allow both portal (3000) and admin UI (3001) in dev
  process.env.ALLOWED_ORIGIN = 'http://localhost:3000,http://localhost:3001';
}

const express = require('express');
const { CognitoIdentityProviderClient, ListUsersInGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const intakeEnvPath = path.resolve(__dirname, '../ISET-intake/.env');
if (fs.existsSync(intakeEnvPath)) {
  require('dotenv').config({ path: intakeEnvPath, override: false });
  console.log('Loaded intake .env fallback from:', intakeEnvPath);
}
const cheerio = require('cheerio');
const { sendSecureMessageAlert, sendDecisionOutcome } = require('../ISET-intake/notifications/applicantEmailNotifications');
const axios = require('axios');
// Workflow normalization (shared preview/publish schema builder)
let buildWorkflowSchema; // lazy require inside try-catch to avoid crash if file missing
try {
  ({ buildWorkflowSchema } = require('./src/workflows/normalizeWorkflow'));
} catch (e) {
  console.warn('[init] normalizeWorkflow module load failed:', e.message);
}
let validateWorkflow;
try { ({ validateWorkflow } = require('./src/workflows/validateComponents')); } catch (e) { console.warn('validator load failed:', e.message); }
// NOTE: SUPPORTED_COMPONENT_TYPES is already defined later in this file for publish support.
// We only attempt to import if not present (in older restored versions). If shadowed, ignore.
let importedSupportedTypes;
try { ({ SUPPORTED_COMPONENT_TYPES: importedSupportedTypes } = require('./src/workflows/constants')); } catch (e) { /* optional */ }

// --- Dual Portal Workflow Publish Helper (writes normalized schema to both portals) ---
function writeIfChanged(file, content) {
  try {
    if (fs.existsSync(file)) {
      const existing = fs.readFileSync(file, 'utf8');
      if (existing === content) return false;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
    return true;
  } catch (err) {
    console.error('[publish] write failed', file, err.message);
    throw err;
  }
}

const app = express();
const port = process.env.PORT || 5001; // Use port from .env
const buildDir = path.join(__dirname, 'build');

// Lightweight health check for ALB
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(bodyParser.json({ limit: '1mb' }));

// Serve static admin SPA assets when the build output is present on disk
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
}

app.use('/api/', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});


const corsOptions = {
  origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Publish endpoint for workflows (dev/internal) - writes normalized schema to legacy & new portals
app.post('/api/workflows/:id/publish', async (req, res) => {
  const idRaw = req.params.id;
  const workflowId = Number(idRaw);
  if (!Number.isFinite(workflowId) || workflowId <= 0) {
    return res.status(400).json({ error: 'invalid_workflow_id', detail: idRaw });
  }
  if (!buildWorkflowSchema) {
    return res.status(500).json({ error: 'unavailable', message: 'buildWorkflowSchema not loaded' });
  }
  try {
    let schema;
    try { schema = await buildWorkflowSchema({ pool, workflowId }); } catch (eInner) {
      return res.status(500).json({ error: 'normalization_failed', message: eInner.message });
    }
    if (!schema) return res.status(500).json({ error: 'schema_null' });
    // Full normalized schema object retained for new portal; legacy portal expects array of step objects only.
    const fullJson = JSON.stringify(schema, null, 2);
    const legacyJson = Array.isArray(schema) ? JSON.stringify(schema, null, 2) : JSON.stringify(schema.steps || [], null, 2);
    const publishedAt = new Date().toISOString();
    const schemaMeta = schema && typeof schema === 'object' && schema.meta && typeof schema.meta === 'object' ? schema.meta : null;
    const meta = { workflowId, generatedAt: publishedAt };
    if (schemaMeta) meta.schemaMeta = schemaMeta;
    const legacyPath = path.resolve(__dirname, '../ISET-intake/src/intakeFormSchema.json');
    const legacyMeta = path.resolve(__dirname, '../ISET-intake/src/intakeFormSchema.meta.json');
    const newPortalPath = path.resolve(__dirname, '../iset-public-portal/apps/api/src/data/intakeFormSchema.json');
    const newPortalMeta = path.resolve(__dirname, '../iset-public-portal/apps/api/src/data/intakeFormSchema.meta.json');
    const actor = resolveRequestActor(req);
    const publishedBy = {
      id: actor?.actorId || null,
      name: actor?.actorName || null,
      email: req.auth?.email || req.get?.('X-Dev-Email') || req.get?.('x-dev-email') || null
    };
    const schemaArray = Array.isArray(schema) ? schema : (Array.isArray(schema?.steps) ? schema.steps : []);
    const normalizedPayload = {
      meta,
      schema: schemaArray,
      version: `${publishedAt}#${workflowId}`,
      publishedAt,
      publishedBy
    };
    if (!Array.isArray(schema)) {
      normalizedPayload.schemaEnvelope = schema;
      if (!normalizedPayload.meta.schemaMeta && schema?.meta && typeof schema.meta === 'object') {
        normalizedPayload.meta.schemaMeta = schema.meta;
      }
    }
    const payloadPreChecksum = JSON.stringify(normalizedPayload);
    const checksum = crypto.createHash('sha256').update(payloadPreChecksum, 'utf8').digest('hex');
    normalizedPayload.checksum = checksum;
    meta.checksum = checksum;
    const payloadJson = JSON.stringify(normalizedPayload);
    const metaJson = JSON.stringify(meta, null, 2);
    const results = [];
    try { const changed = writeIfChanged(legacyPath, legacyJson); const metaChanged = writeIfChanged(legacyMeta, metaJson); results.push({ target: 'legacy', file: legacyPath, changed, metaChanged, shape: 'steps[]' }); } catch (eL) { results.push({ target: 'legacy', error: eL.message }); }
    try { const changed = writeIfChanged(newPortalPath, fullJson); const metaChanged = writeIfChanged(newPortalMeta, metaJson); results.push({ target: 'new', file: newPortalPath, changed, metaChanged, shape: 'full-schema' }); } catch (eN) { results.push({ target: 'new', error: eN.message }); }
    try {
      await pool.query(
        "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('publish', 'workflow.schema.intake', CAST(? AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP",
        [payloadJson]
      );
      results.push({
        target: 'runtime-config',
        scope: 'publish',
        key: 'workflow.schema.intake',
        upserted: true,
        shape: 'normalized',
        version: normalizedPayload.version
      });
    } catch (dbErr) {
      results.push({ target: 'runtime-config', error: dbErr.message });
    }
    const hadError = results.some(r => r.error);
    res.status(hadError ? 207 : 200).json({ ok: !hadError, workflowId, results });
  } catch (err) {
    res.status(500).json({ error: 'publish_failed', message: err.message });
  }
});

// --- Public Linkage Coverage Proxy (moved before auth middleware) ---------
// Returns aggregate, non-sensitive linkage stats from the intake service WITHOUT requiring admin auth.
// Placed here (before Cognito auth mounting) so /api/admin/linkage-stats is publicly reachable.
// Caching: 10s in-memory to reduce upstream load during dashboard refreshes.
let __linkageStatsCache = { ts: 0, ttlMs: 10_000, data: null };
app.get('/api/admin/linkage-stats', async (req, res) => {
  try {
    const baseRaw = process.env.LINKAGE_STATS_URL || process.env.INTAKE_BASE_URL || 'http://localhost:5000';
    const base = /^https?:\/\//i.test(baseRaw) ? baseRaw : `http://${baseRaw}`;
    const url = base.replace(/\/$/, '') + '/api/admin/linkage-stats';

    if (__linkageStatsCache.data && (Date.now() - __linkageStatsCache.ts) < __linkageStatsCache.ttlMs) {
      return res.json({ ...(__linkageStatsCache.data || {}), _cache: true, _source: 'cache', _public: true });
    }

    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

    let resp, text;
    try {
      resp = await fetch(url, { headers: { 'Content-Type': 'application/json' }, timeout: 5000 });
      text = await resp.text();
    } catch (netErr) {
      return res.status(502).json({ error: 'linkage_stats_failed', category: 'network', message: netErr.message, upstreamBase: base });
    }
    if (!resp.ok) {
      return res.status(resp.status === 404 ? 404 : 502).json({ error: 'linkage_stats_failed', category: 'upstream', status: resp.status, body: text.slice(0,500), upstreamBase: base });
    }
    let json;
    try { json = JSON.parse(text); } catch {
      return res.status(502).json({ error: 'linkage_stats_failed', category: 'parse', upstreamBase: base, body: text.slice(0,500) });
    }
    __linkageStatsCache = { ts: Date.now(), ttlMs: __linkageStatsCache.ttlMs, data: json };
    res.json({ ...json, _cache: false, _source: 'upstream', _public: true });
  } catch (e) {
    res.status(500).json({ error: 'linkage_stats_proxy_failed', message: e.message });
  }
});

// --- Upload Config Proxy (for standalone dashboard hitting admin port) ---
// Forwards to intake service which hosts canonical implementation.
// GET  /api/admin/upload-config  -> proxy to {INTAKE_BASE_URL}/api/admin/upload-config
// PATCH /api/admin/upload-config -> proxy body and return result
app.all(['/api/admin/upload-config'], async (req, res) => {
  try {
    const baseRaw = process.env.INTAKE_BASE_URL || 'http://localhost:5000';
    const base = /^https?:\/\//i.test(baseRaw) ? baseRaw : `http://${baseRaw}`;
    const targetUrl = base.replace(/\/$/, '') + '/api/admin/upload-config';
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    const method = req.method.toUpperCase();
    if (!['GET','PATCH'].includes(method)) {
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    const headers = { 'Content-Type': 'application/json' };
    // Forward dev bypass + role headers for local auth simulation
    const fwdHeaders = ['x-dev-bypass','x-dev-role','x-dev-userid'];
    let devBypassActive = false;
    for (const h of fwdHeaders) {
      const v = req.headers[h];
      if (v) {
        headers[h] = v;
        if (h === 'x-dev-bypass') devBypassActive = true;
      }
    }
    // Always forward bearer/cookie tokens so real Cognito sessions work even if dev bypass headers are present.
    // The intake service will ignore them when bypass headers are used.
    if (req.headers['authorization']) {
      headers['authorization'] = req.headers['authorization'];
    }
    if (req.headers['cookie']) {
      headers['cookie'] = req.headers['cookie'];
    }
    let body;
    if (method === 'PATCH') {
      body = JSON.stringify(req.body || {});
    }
    let upstream;
    try {
      upstream = await fetch(targetUrl, { method, headers, body, timeout: 8000 });
    } catch (netErr) {
      return res.status(502).json({ error: 'upstream_unreachable', message: netErr.message, upstream: targetUrl });
    }
    const text = await upstream.text();
    let json;
    try { json = JSON.parse(text); } catch {
      return res.status(502).json({ error: 'upstream_invalid_json', snippet: text.slice(0,200) });
    }
    res.status(upstream.status).json(json);
  } catch (e) {
    res.status(500).json({ error: 'upload_config_proxy_failed', message: e.message });
  }
});

// Minimal staff profile upsert middleware.
// Purpose: ensure a local operational record exists (mirrors Cognito identity) for future assignment logic.
// Relies on global `pool` defined later in file; waits until pool is available.
async function staffProfileMiddleware(req, res, next) {
  try {
    if (!req.auth || !req.auth.sub) return next();
    // pool may not yet be defined if this middleware executes before DB init section; poll a few ms.
    let attempts = 0;
    while (typeof pool === 'undefined' && attempts < 20) { // ~200ms max wait
      await new Promise(r => setTimeout(r, 10));
      attempts++;
    }
    if (!pool) return next();
    const { sub, email, role, regionId } = req.auth;
    await pool.query(`CREATE TABLE IF NOT EXISTS staff_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cognito_sub VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(320) NULL,
      primary_role VARCHAR(64) NULL,
      /* region_id optional ??? legacy tables may not have it */
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_role (primary_role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    // Attempt to add region_id if supported (ignore failures / old MySQL not supporting IF NOT EXISTS)
    try { await pool.query('ALTER TABLE staff_profiles ADD COLUMN region_id INT NULL'); } catch(_) {}
    try { await pool.query('ALTER TABLE staff_profiles ADD INDEX idx_region (region_id)'); } catch(_) {}
    // Determine if region_id column exists (cache per process)
    if (typeof global.__HAS_REGION_ID_COL === 'undefined') {
      try {
        await pool.query('SELECT region_id FROM staff_profiles LIMIT 0');
        global.__HAS_REGION_ID_COL = true;
      } catch { global.__HAS_REGION_ID_COL = false; }
    }
    // Ensure non-null email if schema has NOT NULL constraint (fallback to synthetic)
    const derivedEmail = email || req.auth?.claims?.email || req.auth?.claims?.Email || null;
    const safeEmail = derivedEmail || (sub ? `${sub}@placeholder.local` : 'unknown@placeholder.local');
    if (global.__HAS_REGION_ID_COL) {
      await pool.query(`INSERT INTO staff_profiles (cognito_sub,email,primary_role,region_id) VALUES (?,?,?,?)
        ON DUPLICATE KEY UPDATE email=VALUES(email), primary_role=VALUES(primary_role), region_id=VALUES(region_id)`,
        [sub, safeEmail, role || null, Number.isFinite(regionId) ? regionId : null]);
    } else {
      await pool.query(`INSERT INTO staff_profiles (cognito_sub,email,primary_role) VALUES (?,?,?)
        ON DUPLICATE KEY UPDATE email=VALUES(email), primary_role=VALUES(primary_role)`,
        [sub, safeEmail, role || null]);
    }
    let rows;
    try {
      [rows] = await pool.query('SELECT id, cognito_sub, email, primary_role, region_id FROM staff_profiles WHERE cognito_sub=? LIMIT 1', [sub]);
    } catch (selErr) {
      if (/region_id/.test(selErr.message)) {
        [rows] = await pool.query('SELECT id, cognito_sub, email, primary_role FROM staff_profiles WHERE cognito_sub=? LIMIT 1', [sub]);
      } else throw selErr;
    }
    if (rows && rows[0]) req.staffProfile = rows[0];
  } catch (e) {
    console.warn('[staff_profiles] middleware failed (non-fatal):', e.message);
  } finally {
    return next();
  }
}

// --- Authentication (Cognito) - feature flagged ---
// New: allow local development bypass via DEV_DISABLE_AUTH=true (non-production only)
try {
  const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
  const devDisableAuth = process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
  const devAuthBypass = (process.env.DEV_AUTH_BYPASS === 'true' || process.env.DEV_AUTH_BYPASS === '1') && process.env.NODE_ENV !== 'production';
  if (authProvider === 'cognito' && devDisableAuth) {
    console.warn('\n============================================================');
    console.warn('[AUTH] DEV AUTH BYPASS ACTIVE (DEV_DISABLE_AUTH=true)');
    console.warn('[AUTH] All /api requests are unauthenticated locally.');
    console.warn('[AUTH] DO NOT USE THIS IN PROD. Remove DEV_DISABLE_AUTH to re-enable.');
    console.warn('============================================================\n');
    // Mark responses so calls are visibly unauthenticated in network inspector
    app.use((req, res, next) => { res.setHeader('X-Auth-Bypassed', 'true'); next(); });
  } else if (authProvider === 'cognito') {
    const { authnMiddleware } = require('./src/middleware/authn');
    // Attach auth first, then staff profile enrichment
    app.use('/api', authnMiddleware(), staffProfileMiddleware);
    if (devAuthBypass) {
      console.warn('[AUTH] Cognito auth enabled but DEV_AUTH_BYPASS=true: X-Dev-Bypass header with matching token will short-circuit auth in middleware');
    }
  }
} catch (e) {
  console.warn('Auth middleware init failed:', e?.message);
}

// Mount admin users router (Cognito administrative user lifecycle)
try {
  const adminUsersRouter = require('./src/routes/admin/users');
  app.use('/api/admin', adminUsersRouter);
} catch (e) {
  console.warn('Admin users router mount failed:', e?.message);
}

// Simple auth probe for smoke testing
app.get('/api/auth/me', (req, res) => {
  const enabled = String(process.env.AUTH_PROVIDER || 'none').toLowerCase() === 'cognito';
  if (!enabled) return res.status(200).json({ provider: 'none', auth: null });
  if (!req.auth) return res.status(401).json({ error: 'Unauthenticated' });
  res.json({ provider: 'cognito', auth: req.auth });
});

const ASSIGNABLE_COGNITO_GROUPS = [
  { group: 'ProgramAdmin', label: 'Program Administrator' },
  { group: 'RegionalCoordinator', label: 'Regional Coordinator' },
  { group: 'Adjudicator', label: 'Application Assessor' },
  { group: 'SysAdmin', label: 'System Administrator' }
];
const ASSIGNABLE_GROUP_LABEL = new Map(ASSIGNABLE_COGNITO_GROUPS.map(entry => [entry.group, entry.label]));
const ASSIGNABLE_GROUP_NAMES = ASSIGNABLE_COGNITO_GROUPS.map(entry => entry.group);
const PLACEHOLDER_ASSIGNABLE_STAFF = [
  { id: 'placeholder-program-admin', email: 'admin@nwac.ca', role: 'Program Administrator', display_name: 'Admin (Program Administrator)' },
  { id: 'placeholder-regional-coordinator', email: 'coordinator@nwac.ca', role: 'Regional Coordinator', display_name: 'Coordinator (Regional Coordinator)' },
  { id: 'placeholder-adjudicator', email: 'user@nwac.ca', role: 'Application Assessor', display_name: 'Assessor (Application Assessor)' }
];
const PLACEHOLDER_ASSIGNABLE_LOOKUP = new Map(PLACEHOLDER_ASSIGNABLE_STAFF.map(entry => [entry.email.toLowerCase(), entry]));

const COGNITO_POOL_ID = process.env.COGNITO_USER_POOL_ID || process.env.USER_POOL_ID || process.env.AWS_USER_POOL_ID || null;
const COGNITO_REGION = process.env.AWS_REGION || process.env.COGNITO_REGION || null;
let cognitoAssignableClient = null;
function getCognitoAssignableClient() {
  if (!COGNITO_REGION) throw new Error('Missing AWS region for Cognito');
  if (!cognitoAssignableClient) {
    cognitoAssignableClient = new CognitoIdentityProviderClient({ region: COGNITO_REGION });
  }
  return cognitoAssignableClient;
}
async function fetchActiveSlaTargets(pool) {
  try {
    const [rows] = await pool.query(
      `SELECT id, stage_key, display_name, target_hours, description, applies_to_role, active_from, active_to, created_at, created_by, updated_at, updated_by
       FROM sla_stage_target
       WHERE active_to IS NULL
       ORDER BY stage_key, COALESCE(applies_to_role, '')`
    );
    return rows;
  } catch (err) {
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      return SLA_STAGE_PLACEHOLDER.map(item => ({
        id: null,
        stage_key: item.stage_key,
        display_name: item.display_name,
        target_hours: item.target_hours,
        description: item.description,
        applies_to_role: null,
        active_from: null,
        active_to: null,
        created_at: null,
        created_by: null,
        updated_at: null,
        updated_by: null
      }));
    }
    throw err;
  }
}

async function fetchSlaTargetById(pool, id) {
  const [[row]] = await pool.query(
    'SELECT id, stage_key, display_name, target_hours, description, applies_to_role, active_from, active_to, created_at, created_by, updated_at, updated_by FROM sla_stage_target WHERE id = ?',
    [id]
  );
  return row || null;
}

function normalizeSlaTarget(row) {
  if (!row) return null;
  return {
    id: row.id,
    stage_key: row.stage_key,
    display_name: row.display_name,
    target_hours: row.target_hours,
    description: row.description,
    applies_to_role: row.applies_to_role,
    active_from: row.active_from,
    active_to: row.active_to,
    created_at: row.created_at,
    created_by: row.created_by,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}


const WORK_QUEUE_BUCKET_META = {
  'overdue': {
    label: 'Overdue',
    description: 'Cases past the program turnaround target.'
  },
  'region-queue': {
    label: 'Assigned to my region',
    description: 'Cases owned by the coordinator or assessors in their region.'
  },
  'needs-reassignment': {
    label: 'Assigned to me',
    description: 'Cases currently assigned to the coordinator.'
  },
  'assigned-to-me': {
    label: 'Assigned to me',
    description: 'Cases currently assigned to the assessor.'
  },
  'awaiting-info': {
    label: 'Awaiting applicant info',
    description: 'Regional cases waiting on applicant action.'
  },
  'awaiting-applicant': {
    label: 'Awaiting applicant response',
    description: 'Cases waiting for applicant action.'
  },
  'due-this-week': {
    label: 'Due this week',
    description: 'Cases in the region approaching their SLA deadline within 7 days.'
  },
  'due-today': {
    label: 'Due today',
    description: 'Cases approaching their SLA deadline within the next working day.'
  },
  'awaiting-decision': {
    label: 'Awaiting program decision',
    description: 'Assessments that need a Program Administrator approval.'
  },
  'new-submissions': {
    label: 'New submissions',
    description: 'Applications received in the last 24 hours awaiting triage.'
  },
  'unassigned': {
    label: 'Unassigned backlog',
    description: 'Cases ready to be routed to regional teams or assessors.'
  },
  'in-assessment': {
    label: 'In assessment',
    description: 'Applications actively under review across all regions.'
  },
  'on-hold': {
    label: 'On hold / info requested',
    description: 'Applicants have been asked for more information.'
  }
};
async function countProgramAdminNewSubmissions(pool) {
  try {
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS total
         FROM iset_application_submission s
         LEFT JOIN iset_application a ON a.submission_id = s.id
         LEFT JOIN iset_case c ON c.application_id = a.id
        WHERE s.submitted_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND c.id IS NULL`
    );
    return Number(row?.total ?? 0);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return 0;
    }
    throw err;
  }
}


async function countProgramAdminUnassignedBacklog(pool) {
  try {
    const terminalValues = CASE_STATUS_TERMINAL_VALUES.map(v => v.toLowerCase());
    const params = [];
    let statusCondition = 'c.status IS NULL';
    if (terminalValues.length) {
      const placeholders = terminalValues.map(() => '?').join(',');
      statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
      params.push(...terminalValues);
    }
    const sql = `SELECT COUNT(*) AS total
         FROM iset_case c
        WHERE (c.assigned_to_user_id IS NULL OR c.assigned_to_user_id = 0)
          AND ${statusCondition}`;
    const [[row]] = await pool.query(sql, params);
    return Number(row?.total ?? 0);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return 0;
    }
    throw err;
  }
}

async function countProgramAdminInAssessment(pool) {
  try {
    const excludedStatuses = ['approved', 'rejected', 'withdrawn', 'archived', 'pending_approval'];
    const params = [];
    let statusCondition = 'c.status IS NULL';
    if (excludedStatuses.length) {
      const placeholders = excludedStatuses.map(() => '?').join(',');
      statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
      params.push(...excludedStatuses);
    }
    const sql = `SELECT COUNT(*) AS total
         FROM iset_case c
        WHERE c.assigned_to_user_id IS NOT NULL
          AND ${statusCondition}`;
    const [[row]] = await pool.query(sql, params);
    return Number(row?.total ?? 0);
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      return 0;
    }
    if (isMissingTableErrorLocal(err)) {
      return 0;
    }
    throw err;
  }
}



async function countProgramAdminAwaitingDecision(pool) {
  try {
    const sql = `SELECT COUNT(*) AS total
         FROM iset_case c
        WHERE c.status IS NOT NULL
          AND LOWER(c.status) = ?`;
    const [[row]] = await pool.query(sql, ['pending_approval']);
    return Number(row?.total ?? 0);
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      return 0;
    }
    if (isMissingTableErrorLocal(err)) {
      return 0;
    }
    throw err;
  }
}



async function countProgramAdminOverdue(pool) {
  try {
    const targets = await fetchActiveSlaTargets(pool);
    const stageTargets = new Map();
    for (const row of targets) {
      if (!row || row.applies_to_role) continue;
      stageTargets.set(row.stage_key, Number(row.target_hours) || 0);
    }
    const getTarget = stageKey => {
      if (stageTargets.has(stageKey)) return stageTargets.get(stageKey);
      const fallback = SLA_STAGE_PLACEHOLDER.find(item => item.stage_key === stageKey);
      return fallback ? fallback.target_hours : 0;
    };

    const assignmentHours = getTarget('assignment');
    const assessmentHours = getTarget('assessment');
    const decisionHours = getTarget('program_decision');

    const terminalValues = CASE_STATUS_TERMINAL_VALUES.map(v => v.toLowerCase());
    const excludedValues = CASE_STATUS_EXCLUDED_FOR_ASSESSMENT.map(v => v.toLowerCase());
    const awaitingStatuses = CASE_STATUS_AWAITING_DECISION.map(v => v.toLowerCase());
    const disallowedForAssessment = Array.from(new Set([...excludedValues, ...awaitingStatuses]));

    let total = 0;

    if (assignmentHours > 0) {
      const params = [];
      let statusCondition = 'c.status IS NULL';
      if (terminalValues.length) {
        const placeholders = terminalValues.map(() => '?').join(',');
        statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
        params.push(...terminalValues);
      }
      const sql = `SELECT COUNT(*) AS total
           FROM iset_case c
          WHERE (c.assigned_to_user_id IS NULL OR c.assigned_to_user_id = 0)
            AND ${statusCondition}
            AND TIMESTAMPDIFF(HOUR, COALESCE(c.last_activity_at, c.updated_at, c.created_at), NOW()) > ?`;
      params.push(assignmentHours);
      try {
        const [[row]] = await pool.query(sql, params);
        total += Number(row?.total ?? 0);
      } catch (err) {
        if (!(err && err.code === 'ER_BAD_FIELD_ERROR') && !isMissingTableErrorLocal(err)) {
          throw err;
        }
      }
    }

    if (assessmentHours > 0) {
      const params = [];
      let statusCondition = 'c.status IS NULL';
      if (disallowedForAssessment.length) {
        const placeholders = disallowedForAssessment.map(() => '?').join(',');
        statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
        params.push(...disallowedForAssessment);
      }
      const sql = `SELECT COUNT(*) AS total
           FROM iset_case c
          WHERE c.assigned_to_user_id IS NOT NULL
            AND ${statusCondition}
            AND TIMESTAMPDIFF(HOUR, COALESCE(c.last_activity_at, c.updated_at, c.created_at), NOW()) > ?`;
      params.push(assessmentHours);
      try {
        const [[row]] = await pool.query(sql, params);
        total += Number(row?.total ?? 0);
      } catch (err) {
        if (!(err && err.code === 'ER_BAD_FIELD_ERROR') && !isMissingTableErrorLocal(err)) {
          throw err;
        }
      }
    }

    if (decisionHours > 0 && awaitingStatuses.length) {
      const awaitingPlaceholders = awaitingStatuses.map(() => '?').join(',');
      const conditions = ['c.status IS NOT NULL', `LOWER(c.status) IN (${awaitingPlaceholders})`];
      const params = [...awaitingStatuses];
      if (terminalValues.length) {
        const terminalPlaceholders = terminalValues.map(() => '?').join(',');
        conditions.push(`LOWER(c.status) NOT IN (${terminalPlaceholders})`);
        params.push(...terminalValues);
      }
      const whereClause = conditions.join('\n          AND ');
      const sql = `SELECT COUNT(*) AS total
           FROM iset_case c
          WHERE ${whereClause}
          AND TIMESTAMPDIFF(HOUR, COALESCE(c.last_activity_at, c.updated_at, c.created_at), NOW()) > ?`;
      params.push(decisionHours);
      try {
        const [[row]] = await pool.query(sql, params);
        total += Number(row?.total ?? 0);
      } catch (err) {
        if (!(err && err.code === 'ER_BAD_FIELD_ERROR') && !isMissingTableErrorLocal(err)) {
          throw err;
        }
      }
    }

    return total;
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return 0;
    }
    throw err;
  }
}


async function countProgramAdminOnHold(pool) {
  try {
    const holdValues = CASE_STATUS_HOLD_VALUES.map(v => v.toLowerCase());
    if (!holdValues.length) return 0;
    const placeholders = holdValues.map(() => '?').join(',');
    const sql = `SELECT COUNT(*) AS total
         FROM iset_case c
        WHERE c.status IS NOT NULL
          AND LOWER(c.status) IN (${placeholders})`;
    const [[row]] = await pool.query(sql, holdValues);
    return Number(row?.total ?? 0);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return 0;
    }
    throw err;
  }
}


async function countProgramAdminOnHold(pool) {
  try {
    if (!CASE_STATUS_HOLD_VALUES.length) return 0;
    const placeholders = CASE_STATUS_HOLD_VALUES.map(() => '?').join(',');
    const sql = `SELECT COUNT(*) AS total
         FROM iset_case c
        WHERE c.status IS NOT NULL
          AND LOWER(c.status) IN (${placeholders})`;
    const [[row]] = await pool.query(sql, CASE_STATUS_HOLD_VALUES);
    return Number(row?.total ?? 0);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return 0;
    }
    throw err;
  }
}



function normalizeStaffIdList(list) {
  if (!Array.isArray(list)) return [];
  const normalized = [];
  for (const value of list) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) normalized.push(id);
  }
  return Array.from(new Set(normalized));
}

async function resolveRegionalCoordinatorContext(req) {
  if (!pool) return { valid: false, staffIds: [] };
  const headerUserIdRaw = req.get('X-Dev-UserId') || req.get('x-dev-userid') || null;
  const headerRegionIdRaw = req.get('X-Dev-RegionId') || req.get('x-dev-regionid') || null;
  const candidateIdRaw = headerUserIdRaw ?? req.staffProfile?.id ?? null;
  let regionIdRaw = headerRegionIdRaw ?? req.staffProfile?.region_id ?? req.auth?.regionId ?? null;

  const collected = [];
  let coordinatorId = null;

  const tryResolveCoordinator = async (rawId) => {
    const numeric = Number(rawId);
    if (!Number.isInteger(numeric) || numeric <= 0) return null;
    if (req.staffProfile && req.staffProfile.id === numeric) {
      if (!collected.includes(numeric)) collected.push(numeric);
      if (regionIdRaw == null && req.staffProfile.region_id != null) regionIdRaw = req.staffProfile.region_id;
      return numeric;
    }
    try {
      const [[profile]] = await pool.query('SELECT id, cognito_sub, email, primary_role, region_id FROM staff_profiles WHERE id = ? LIMIT 1', [numeric]);
      if (profile) {
        req.staffProfile = req.staffProfile || profile;
        if (!collected.includes(numeric)) collected.push(numeric);
        if (regionIdRaw == null && profile.region_id != null) regionIdRaw = profile.region_id;
        return numeric;
      }
    } catch (err) {
      if (!isMissingTableErrorLocal(err)) throw err;
    }
    return null;
  };

  coordinatorId = await tryResolveCoordinator(candidateIdRaw);

  if (regionIdRaw == null && coordinatorId != null) {
    try {
      const [[row]] = await pool.query('SELECT region_id FROM staff_profiles WHERE id = ? LIMIT 1', [coordinatorId]);
      if (row && row.region_id != null) regionIdRaw = row.region_id;
    } catch (err) {
      if (!isMissingTableErrorLocal(err)) throw err;
    }
  }

  const normalizedRegionId = Number(regionIdRaw);
  if (Number.isInteger(normalizedRegionId) && normalizedRegionId > 0) {
    try {
      const [rows] = await pool.query('SELECT id FROM staff_profiles WHERE region_id = ?', [normalizedRegionId]);
      for (const row of rows || []) {
        if (!row || row.id == null) continue;
        const id = Number(row.id);
        if (Number.isInteger(id) && id > 0 && !collected.includes(id)) collected.push(id);
      }
      regionIdRaw = normalizedRegionId;
    } catch (err) {
      if (!isMissingTableErrorLocal(err)) throw err;
    }
  }

  const staffIds = normalizeStaffIdList(collected);
  const coordinatorInList = coordinatorId && staffIds.includes(coordinatorId) ? coordinatorId : null;
  const staffProfileId = coordinatorInList || (staffIds.length ? staffIds[0] : null);
  const regionId = Number.isInteger(Number(regionIdRaw)) && Number(regionIdRaw) > 0 ? Number(regionIdRaw) : null;

  if (process.env.NODE_ENV !== 'production') {
    console.log('[work-queue][rc-context]', {
      requestedId: candidateIdRaw,
      requestedRegion: regionIdRaw,
      resolvedStaffProfileId: staffProfileId,
      resolvedRegionId: regionId,
      staffIds
    });
  }

  return {
    valid: Number.isInteger(staffProfileId) && staffProfileId > 0,
    staffProfileId: Number.isInteger(staffProfileId) && staffProfileId > 0 ? staffProfileId : null,
    regionId,
    staffIds
  };
}

async function resolveApplicationAssessorContext(req) {
  if (!pool) return { valid: false, staffIds: [] };
  const headerUserIdRaw = req.get('X-Dev-UserId') || req.get('x-dev-userid') || null;
  const headerRegionIdRaw = req.get('X-Dev-RegionId') || req.get('x-dev-regionid') || null;
  const candidateIdRaw = headerUserIdRaw ?? req.staffProfile?.id ?? null;
  let regionIdRaw = headerRegionIdRaw ?? req.staffProfile?.region_id ?? req.auth?.regionId ?? null;

  if (process.env.NODE_ENV !== 'production') {
    console.log('[assessor-resolve:start]', {
      headerUserIdRaw,
      staffProfileId: req.staffProfile?.id ?? null,
      staffProfileRole: req.staffProfile?.primary_role ?? null,
      candidateIdRaw,
      regionIdRaw
    });
  }

  const matchesAssessorRole = (profile) => {
    const role = profile?.primary_role;
    if (typeof role !== 'string') return false;
    return role.toLowerCase().replace(/\s+/g, '') === 'applicationassessor';
  };

  const tryResolveById = async (rawId) => {
    const numeric = Number(rawId);
    if (!Number.isInteger(numeric) || numeric <= 0) return null;
    if (req.staffProfile && req.staffProfile.id === numeric) {
      return matchesAssessorRole(req.staffProfile) ? numeric : null;
    }
    try {
      const [[profile]] = await pool.query('SELECT id, cognito_sub, email, primary_role, region_id FROM staff_profiles WHERE id = ? LIMIT 1', [numeric]);
      if (profile && matchesAssessorRole(profile)) {
        req.staffProfile = req.staffProfile || profile;
        return numeric;
      }
    } catch (err) {
      if (!isMissingTableErrorLocal(err)) throw err;
    }
    return null;
  };

  const tryResolveByRegion = async (regionNumeric) => {
    try {
      const [rows] = await pool.query('SELECT id, cognito_sub, email, primary_role, region_id FROM staff_profiles WHERE region_id = ? ORDER BY id ASC', [regionNumeric]);
      const match = (rows || []).find(row => row && matchesAssessorRole(row));
      if (match && Number.isInteger(Number(match.id)) && Number(match.id) > 0) {
        req.staffProfile = req.staffProfile || match;
        return Number(match.id);
      }
    } catch (err) {
      if (!isMissingTableErrorLocal(err)) throw err;
    }
    return null;
  };

  let resolvedId = await tryResolveById(candidateIdRaw);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[assessor-resolve:after-id]', { candidateIdRaw, resolvedId });
  }

  if (!resolvedId && regionIdRaw != null) {
    const regionNumeric = Number(regionIdRaw);
    if (Number.isInteger(regionNumeric) && regionNumeric > 0) {
      resolvedId = await tryResolveByRegion(regionNumeric);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[assessor-resolve:after-region]', { regionNumeric, resolvedId });
      }
      if (resolvedId) {
        regionIdRaw = regionNumeric;
      }
    }
  }

  if (!resolvedId) {
    try {
      const [[row]] = await pool.query('SELECT id, cognito_sub, email, primary_role, region_id FROM staff_profiles WHERE primary_role = ? ORDER BY id ASC LIMIT 1', ['Application Assessor']);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[assessor-resolve:global-fallback]', row || null);
      }
      if (row && matchesAssessorRole(row)) {
        req.staffProfile = req.staffProfile || row;
        resolvedId = Number(row.id);
        if (row.region_id != null) regionIdRaw = row.region_id;
      }
    } catch (err) {
      if (!isMissingTableErrorLocal(err)) throw err;
    }
  }

  if (!resolvedId) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[work-queue][assessor-context]', { requestedId: candidateIdRaw, reason: 'no_assessor_profile' });
    }
    return { valid: false, staffIds: [] };
  }

  const staffIds = normalizeStaffIdList([resolvedId]);
  const context = {
    valid: staffIds.length === 1,
    staffProfileId: staffIds.length === 1 ? staffIds[0] : null,
    regionId: req.staffProfile?.region_id ?? (regionIdRaw != null ? Number(regionIdRaw) : null),
    staffIds
  };

  if (process.env.NODE_ENV !== 'production') {
    console.log('[work-queue][assessor-context]', {
      requestedId: candidateIdRaw,
      resolvedId: context.staffProfileId,
      resolvedRegionId: context.regionId,
      staffIds: context.staffIds
    });
  }

  return context;
}



async function countRegionalAssignedToRegion(pool, staffIds, context = {}) {
  const ids = normalizeStaffIdList(staffIds);
  const coordinatorIdRaw = context?.staffProfileId ?? context?.coordinatorId ?? null;
  const regionIdRaw = context?.regionId ?? null;
  const coordinatorId = Number(coordinatorIdRaw);
  const regionId = Number(regionIdRaw);
  const filters = [];
  const params = [];

  if (Number.isInteger(coordinatorId) && coordinatorId > 0) {
    filters.push('c.assigned_to_user_id = ?');
    params.push(coordinatorId);
  }

  if (Number.isInteger(regionId) && regionId > 0) {
    filters.push('sp.region_id = ?');
    params.push(regionId);
  }

  if (!filters.length && ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    filters.push(`c.assigned_to_user_id IN (${placeholders})`);
    params.push(...ids);
  }

  if (!filters.length) return 0;

  let statusCondition = 'c.status IS NULL';
  if (CASE_STATUS_TERMINAL_VALUES_LOWER.length) {
    const statusPlaceholders = CASE_STATUS_TERMINAL_VALUES_LOWER.map(() => '?').join(',');
    statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${statusPlaceholders}))`;
    params.push(...CASE_STATUS_TERMINAL_VALUES_LOWER);
  }

  const sql = `SELECT COUNT(*) AS total
         FROM iset_case c
         LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id
        WHERE c.assigned_to_user_id IS NOT NULL
          AND (${filters.join(' OR ')})
          AND ${statusCondition}`;
  const [[row]] = await pool.query(sql, params);
  return Number(row?.total ?? 0);
}



async function countRegionalNeedsReassignment(pool, staffProfileId) {
  const coordinatorId = Number(staffProfileId);
  if (!Number.isInteger(coordinatorId) || coordinatorId <= 0) return 0;
  const params = [coordinatorId];
  let statusCondition = 'c.status IS NULL';
  if (CASE_STATUS_TERMINAL_VALUES_LOWER.length) {
    const statusPlaceholders = CASE_STATUS_TERMINAL_VALUES_LOWER.map(() => '?').join(',');
    statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${statusPlaceholders}))`;
    params.push(...CASE_STATUS_TERMINAL_VALUES_LOWER);
  }
  const sql = `SELECT COUNT(*) AS total
         FROM iset_case c
        WHERE c.assigned_to_user_id = ?
          AND ${statusCondition}`;
  const [[row]] = await pool.query(sql, params);
  return Number(row?.total ?? 0);
}

async function countRegionalAwaitingApplicantInfo(pool, staffIds) {
  const ids = normalizeStaffIdList(staffIds);
  if (!ids.length) return 0;
  if (!CASE_STATUS_HOLD_VALUES_LOWER.length) return 0;
  const staffPlaceholders = ids.map(() => '?').join(',');
  const holdPlaceholders = CASE_STATUS_HOLD_VALUES_LOWER.map(() => '?').join(',');
  const params = [...ids, ...CASE_STATUS_HOLD_VALUES_LOWER];
  const sql = `SELECT COUNT(*) AS total
         FROM iset_case c
        WHERE c.assigned_to_user_id IN (${staffPlaceholders})
          AND c.status IS NOT NULL
          AND LOWER(c.status) IN (${holdPlaceholders})`;
  const [[row]] = await pool.query(sql, params);
  return Number(row?.total ?? 0);
}

async function countRegionalDueThisWeek(pool, staffIds) {
  const ids = normalizeStaffIdList(staffIds);
  if (!ids.length) return 0;
  const targets = await fetchActiveSlaTargets(pool);
  const stageTargets = new Map();
  for (const row of targets) {
    if (!row || row.applies_to_role) continue;
    stageTargets.set(row.stage_key, Number(row.target_hours) || 0);
  }
  const getTarget = stageKey => {
    if (stageTargets.has(stageKey)) return stageTargets.get(stageKey);
    const fallback = SLA_STAGE_PLACEHOLDER.find(item => item.stage_key === stageKey);
    return fallback ? fallback.target_hours : 0;
  };

  const assessmentHours = getTarget('assessment');
  const decisionHours = getTarget('program_decision');
  const stageValues = CASE_STATUS_AWAITING_DECISION_LOWER;
  const excludedValues = CASE_STATUS_EXCLUDED_FOR_ASSESSMENT_LOWER;
  const terminalValues = CASE_STATUS_TERMINAL_VALUES_LOWER;
  const staffPlaceholders = ids.map(() => '?').join(',');
  const elapsedExpr = 'TIMESTAMPDIFF(HOUR, COALESCE(c.last_activity_at, c.updated_at, c.created_at), NOW())';

  let total = 0;

  if (assessmentHours > 0) {
    const params = [...ids];
    let statusExcludingPendingCondition = 'c.status IS NULL';
    if (stageValues.length) {
      const placeholders = stageValues.map(() => '?').join(',');
      statusExcludingPendingCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
      params.push(...stageValues);
    }
    let statusCondition = 'c.status IS NULL';
    if (excludedValues.length) {
      const placeholders = excludedValues.map(() => '?').join(',');
      statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
      params.push(...excludedValues);
    }
    const lowerBound = Math.max(assessmentHours - DUE_SOON_THRESHOLD_HOURS, 0);
    const upperBound = assessmentHours;
    const sql = `SELECT COUNT(*) AS total
       FROM iset_case c
      WHERE c.assigned_to_user_id IN (${staffPlaceholders})
        AND ${statusExcludingPendingCondition}
        AND ${statusCondition}
        AND ${elapsedExpr} >= ?
        AND ${elapsedExpr} < ?`;
    params.push(lowerBound, upperBound);
    try {
      const [[row]] = await pool.query(sql, params);
      total += Number(row?.total ?? 0);
    } catch (err) {
      if (!(err && err.code === 'ER_BAD_FIELD_ERROR') && !isMissingTableErrorLocal(err)) {
        throw err;
      }
    }
  }

  if (decisionHours > 0 && stageValues.length) {
    const stagePlaceholders = stageValues.map(() => '?').join(',');
    const params = [...ids, ...stageValues];
    let statusCondition = 'c.status IS NULL';
    if (terminalValues.length) {
      const placeholders = terminalValues.map(() => '?').join(',');
      statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
      params.push(...terminalValues);
    }
    const lowerBound = Math.max(decisionHours - DUE_SOON_THRESHOLD_HOURS, 0);
    const upperBound = decisionHours;
    const sql = `SELECT COUNT(*) AS total
           FROM iset_case c
           WHERE c.assigned_to_user_id IN (${staffPlaceholders})
            AND c.status IS NOT NULL
            AND LOWER(c.status) IN (${stagePlaceholders})
            AND ${statusCondition}
            AND ${elapsedExpr} >= ?
            AND ${elapsedExpr} < ?`;
    params.push(lowerBound, upperBound);
    try {
      const [[row]] = await pool.query(sql, params);
      total += Number(row?.total ?? 0);
    } catch (err) {
      if (!(err && err.code === 'ER_BAD_FIELD_ERROR') && !isMissingTableErrorLocal(err)) {
        throw err;
      }
    }
  }

  return total;
}

async function countRegionalOverdue(pool, staffIds) {
  const ids = normalizeStaffIdList(staffIds);
  if (!ids.length) return 0;
  const targets = await fetchActiveSlaTargets(pool);
  const stageTargets = new Map();
  for (const row of targets) {
    if (!row || row.applies_to_role) continue;
    stageTargets.set(row.stage_key, Number(row.target_hours) || 0);
  }
  const getTarget = stageKey => {
    if (stageTargets.has(stageKey)) return stageTargets.get(stageKey);
    const fallback = SLA_STAGE_PLACEHOLDER.find(item => item.stage_key === stageKey);
    return fallback ? fallback.target_hours : 0;
  };

  const assessmentHours = getTarget('assessment');
  const decisionHours = getTarget('program_decision');
  const stageValues = CASE_STATUS_AWAITING_DECISION_LOWER;
  const excludedValues = CASE_STATUS_EXCLUDED_FOR_ASSESSMENT_LOWER;
  const terminalValues = CASE_STATUS_TERMINAL_VALUES_LOWER;
  const staffPlaceholders = ids.map(() => '?').join(',');
  const elapsedExpr = 'TIMESTAMPDIFF(HOUR, COALESCE(c.last_activity_at, c.updated_at, c.created_at), NOW())';

  let total = 0;

  if (assessmentHours > 0) {
    const params = [...ids];
    let statusExcludingPendingCondition = 'c.status IS NULL';
    if (stageValues.length) {
      const placeholders = stageValues.map(() => '?').join(',');
      statusExcludingPendingCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
      params.push(...stageValues);
    }
    let statusCondition = 'c.status IS NULL';
    if (excludedValues.length) {
      const placeholders = excludedValues.map(() => '?').join(',');
      statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
      params.push(...excludedValues);
    }
    params.push(assessmentHours);
    const sql = `SELECT COUNT(*) AS total
       FROM iset_case c
      WHERE c.assigned_to_user_id IN (${staffPlaceholders})
        AND ${statusExcludingPendingCondition}
        AND ${statusCondition}
        AND ${elapsedExpr} > ?`;
    try {
      const [[row]] = await pool.query(sql, params);
      total += Number(row?.total ?? 0);
    } catch (err) {
      if (!(err && err.code === 'ER_BAD_FIELD_ERROR') && !isMissingTableErrorLocal(err)) {
        throw err;
      }
    }
  }

  if (decisionHours > 0 && stageValues.length) {
    const stagePlaceholders = stageValues.map(() => '?').join(',');
    const params = [...ids, ...stageValues];
    let statusCondition = 'c.status IS NULL';
    if (terminalValues.length) {
      const placeholders = terminalValues.map(() => '?').join(',');
      statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
      params.push(...terminalValues);
    }
    params.push(decisionHours);
    const sql = `SELECT COUNT(*) AS total
           FROM iset_case c
           WHERE c.assigned_to_user_id IN (${staffPlaceholders})
            AND c.status IS NOT NULL
            AND LOWER(c.status) IN (${stagePlaceholders})
            AND ${statusCondition}
            AND ${elapsedExpr} > ?`;
    try {
      const [[row]] = await pool.query(sql, params);
      total += Number(row?.total ?? 0);
    } catch (err) {
      if (!(err && err.code === 'ER_BAD_FIELD_ERROR') && !isMissingTableErrorLocal(err)) {
        throw err;
      }
    }
  }

  return total;
}

async function countAssessorAssignedToMe(pool, staffProfileId) {
  const assessorId = Number(staffProfileId);
  if (!Number.isInteger(assessorId) || assessorId <= 0) return 0;
  const params = [assessorId];
  let statusCondition = 'c.status IS NULL';
  if (CASE_STATUS_TERMINAL_VALUES_LOWER.length) {
    const placeholders = CASE_STATUS_TERMINAL_VALUES_LOWER.map(() => '?').join(',');
    statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
    params.push(...CASE_STATUS_TERMINAL_VALUES_LOWER);
  }
  const sql = `SELECT COUNT(*) AS total
         FROM iset_case c
        WHERE c.assigned_to_user_id = ?
          AND ${statusCondition}`;
  const [[row]] = await pool.query(sql, params);
  return Number(row?.total ?? 0);
}

async function countAssessorAwaitingApplicantResponse(pool, staffProfileId) {
  const assessorId = Number(staffProfileId);
  if (!Number.isInteger(assessorId) || assessorId <= 0) return 0;
  if (!CASE_STATUS_HOLD_VALUES_LOWER.length) return 0;
  const statusPlaceholders = CASE_STATUS_HOLD_VALUES_LOWER.map(() => '?').join(',');
  const sql = `SELECT COUNT(*) AS total
         FROM iset_case c
        WHERE c.assigned_to_user_id = ?
          AND c.status IS NOT NULL
          AND LOWER(c.status) IN (${statusPlaceholders})`;
  const params = [assessorId, ...CASE_STATUS_HOLD_VALUES_LOWER];
  const [[row]] = await pool.query(sql, params);
  return Number(row?.total ?? 0);
}

async function countAssessorDueToday(pool, staffProfileId) {
  const ids = normalizeStaffIdList([staffProfileId]);
  if (!ids.length) return 0;
  const targets = await fetchActiveSlaTargets(pool);
  const stageTargets = new Map();
  for (const row of targets) {
    if (!row || row.applies_to_role) continue;
    stageTargets.set(row.stage_key, Number(row.target_hours) || 0);
  }
  const getTarget = stageKey => {
    if (stageTargets.has(stageKey)) return stageTargets.get(stageKey);
    const fallback = SLA_STAGE_PLACEHOLDER.find(item => item.stage_key === stageKey);
    return fallback ? fallback.target_hours : 0;
  };

  const assessmentHours = getTarget('assessment');
  const decisionHours = getTarget('program_decision');
  const awaitingStatuses = CASE_STATUS_AWAITING_DECISION_LOWER;
  const excludedValues = CASE_STATUS_EXCLUDED_FOR_ASSESSMENT_LOWER;
  const terminalValues = CASE_STATUS_TERMINAL_VALUES_LOWER;
  const disallowedForAssessment = Array.from(new Set([...excludedValues, ...awaitingStatuses]));
  const staffPlaceholders = ids.map(() => '?').join(',');
  const elapsedExpr = 'TIMESTAMPDIFF(HOUR, COALESCE(c.last_activity_at, c.updated_at, c.created_at), NOW())';

  let total = 0;

  if (assessmentHours > 0) {
    const lowerBound = Math.max(assessmentHours - DUE_TODAY_THRESHOLD_HOURS, 0);
    const upperBound = assessmentHours;
    if (upperBound > lowerBound) {
      const params = [...ids];
      let statusCondition = 'c.status IS NULL';
      if (disallowedForAssessment.length) {
        const placeholders = disallowedForAssessment.map(() => '?').join(',');
        statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
        params.push(...disallowedForAssessment);
      }
      params.push(lowerBound, upperBound);
      const sql = `SELECT COUNT(*) AS total
           FROM iset_case c
          WHERE c.assigned_to_user_id IN (${staffPlaceholders})
            AND ${statusCondition}
            AND ${elapsedExpr} >= ?
            AND ${elapsedExpr} < ?`;
      try {
        const [[row]] = await pool.query(sql, params);
        total += Number(row?.total ?? 0);
      } catch (err) {
        if (!(err && err.code === 'ER_BAD_FIELD_ERROR') && !isMissingTableErrorLocal(err)) {
          throw err;
        }
      }
    }
  }

  if (decisionHours > 0 && awaitingStatuses.length) {
    const lowerBound = Math.max(decisionHours - DUE_TODAY_THRESHOLD_HOURS, 0);
    const upperBound = decisionHours;
    if (upperBound > lowerBound) {
      const stagePlaceholders = awaitingStatuses.map(() => '?').join(',');
      const params = [...ids, ...awaitingStatuses];
      let statusCondition = 'c.status IS NULL';
      if (terminalValues.length) {
        const placeholders = terminalValues.map(() => '?').join(',');
        statusCondition = `(c.status IS NULL OR LOWER(c.status) NOT IN (${placeholders}))`;
        params.push(...terminalValues);
      }
      params.push(lowerBound, upperBound);
      const sql = `SELECT COUNT(*) AS total
       FROM iset_case c
      WHERE c.assigned_to_user_id IN (${staffPlaceholders})
        AND c.status IS NOT NULL
        AND LOWER(c.status) IN (${stagePlaceholders})
        AND ${statusCondition}
        AND ${elapsedExpr} >= ?
        AND ${elapsedExpr} < ?`;
      try {
        const [[row]] = await pool.query(sql, params);
        total += Number(row?.total ?? 0);
      } catch (err) {
        if (!(err && err.code === 'ER_BAD_FIELD_ERROR') && !isMissingTableErrorLocal(err)) {
          throw err;
        }
      }
    }
  }

  return total;
}



async function countAssessorOverdue(pool, staffProfileId) {
  const ids = normalizeStaffIdList([staffProfileId]);
  if (!ids.length) return 0;
  return countRegionalOverdue(pool, ids);
}



function inferUserRole(req) {
  if (req.staffProfile && req.staffProfile.primary_role) return req.staffProfile.primary_role;
  if (req.auth && req.auth.role) return req.auth.role;
  if (req.get) {
    const headerRole = req.get('X-Dev-Role') || req.get('x-dev-role');
    if (headerRole) return headerRole;
  }
  return null;
}

function hasSlaAdminAccess(req) {
  const role = inferUserRole(req);
  return role === 'System Administrator' || role === 'Program Administrator';
}

function resolveActorLabel(req) {
  const { actorId, actorName } = resolveRequestActor(req) || {};
  if (actorName) return actorName;
  if (actorId) return actorId;
  if (req.get) {
    const headerUser = req.get('X-Dev-UserId') || req.get('x-dev-userid');
    if (headerUser) return headerUser;
  }
  return 'admin-dashboard';
}

async function ensureStaffProfile(pool, cognitoSub, email, roleLabel, legacyKey) {
  try {
    const subKey = cognitoSub || null;
    const legacy = legacyKey && legacyKey !== subKey ? legacyKey : null;

    let targetId = null;
    if (subKey) {
      const [[bySub]] = await pool.query('SELECT id FROM staff_profiles WHERE cognito_sub=? LIMIT 1', [subKey]);
      if (bySub && bySub.id) targetId = bySub.id;
    }
    if (!targetId && legacy) {
      const [[byLegacy]] = await pool.query('SELECT id FROM staff_profiles WHERE cognito_sub=? LIMIT 1', [legacy]);
      if (byLegacy && byLegacy.id) targetId = byLegacy.id;
    }
    if (!targetId && email) {
      const [[byEmail]] = await pool.query('SELECT id FROM staff_profiles WHERE email=? LIMIT 1', [email]);
      if (byEmail && byEmail.id) targetId = byEmail.id;
    }

    const finalSub = subKey || legacy || email || null;
    if (targetId) {
      const updates = [];
      const params = [];
      if (finalSub) { updates.push('cognito_sub=?'); params.push(finalSub); }
      if (email) { updates.push('email=?'); params.push(email); }
      if (roleLabel) { updates.push('primary_role=?'); params.push(roleLabel); }
      if (updates.length) {
        const sql = `UPDATE staff_profiles SET ${updates.join(', ')} WHERE id=?`;
        params.push(targetId);
        await pool.query(sql, params);
      }
      return targetId;
    }

    if (!finalSub && !email) return null;
    const insertKey = finalSub || email || legacy;
    if (!insertKey) return null;
    const insertEmail = email || `${insertKey}@placeholder.local`;
    await pool.query(`INSERT INTO staff_profiles (cognito_sub,email,primary_role) VALUES (?,?,?)
      ON DUPLICATE KEY UPDATE email=VALUES(email), primary_role=VALUES(primary_role)`, [insertKey, insertEmail, roleLabel || null]);
    const [[finalRow]] = await pool.query('SELECT id FROM staff_profiles WHERE cognito_sub=? LIMIT 1', [insertKey]);
    return finalRow && finalRow.id ? finalRow.id : null;
  } catch (err) {
    console.warn('[staff-assignable] ensureStaffProfile error:', err.message);
    return null;
  }
}
async function fetchAssignableFromCognito(pool) {
  if (!COGNITO_POOL_ID || !COGNITO_REGION) return null;
  try {
    const client = getCognitoAssignableClient();
    const seen = new Map();
    for (const groupName of ASSIGNABLE_GROUP_NAMES) {
      let nextToken = undefined;
      do {
        const resp = await client.send(new ListUsersInGroupCommand({ UserPoolId: COGNITO_POOL_ID, GroupName: groupName, Limit: 60, NextToken: nextToken }));
        const users = resp.Users || [];
        for (const user of users) {
          const username = user?.Username;
          if (!username) continue;
          if (seen.has(username)) continue;
          const attr = Object.fromEntries((user.Attributes || []).map(a => [a.Name, a.Value]));
          const email = attr.email || username;
          if (!email) continue;
          const canonicalSub = attr.sub || username;
          const staffId = await ensureStaffProfile(pool, canonicalSub, email, ASSIGNABLE_GROUP_LABEL.get(groupName) || groupName, username);
          if (!staffId) continue;
          const displayName = attr.name || attr['custom:display_name'] || email;
          seen.set(username, {
            id: staffId,
            email,
            role: ASSIGNABLE_GROUP_LABEL.get(groupName) || groupName,
            display_name: displayName
          });
        }
        nextToken = resp.NextToken;
      } while (nextToken);
    }
    return Array.from(seen.values());
  } catch (err) {
    console.error('[staff-assignable] Cognito fetch failed:', err.message);
    return null;
  }
}

// List assignable staff for case assignment
// GET /api/staff/assignable
// In dev bypass (IAM off) returns placeholder identities; otherwise queries staff_profiles by allowed roles.
app.get('/api/staff/assignable', async (req, res) => {
  try {
    const placeholderStaff = PLACEHOLDER_ASSIGNABLE_STAFF;
    const iamModeHeader = (req.get('x-iam-mode') || req.get('X-Iam-Mode') || '').toLowerCase();
    const bypassHeader = !!(req.get('x-dev-bypass') || req.get('X-Dev-Bypass'));
    const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
    const envIamEnabled = authProvider === 'cognito';
    const devBypassEnv = process.env.DEV_DISABLE_AUTH === 'true' || process.env.DEV_AUTH_BYPASS === 'true';
    const isAuthenticated = !!req.auth && envIamEnabled;
    const explicitOn = iamModeHeader === 'on';
    const explicitOff = iamModeHeader === 'off';

    if (process.env.NODE_ENV !== 'production') {
      console.log('[staff-assignable] context', {
        iamModeHeader,
        bypassHeader,
        authProvider,
        envIamEnabled,
        devBypassEnv,
        isAuthenticated,
        explicitOn,
        explicitOff,
        hasAuth: !!req.auth,
        authRole: req.auth ? req.auth.role : null
      });
    }

    if ((bypassHeader && !explicitOn) || explicitOff) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[staff-assignable] returning placeholders (bypass or explicitOff)');
      }
      return res.json(placeholderStaff);
    }

    if (!envIamEnabled || (!isAuthenticated && devBypassEnv && !explicitOn)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[staff-assignable] returning placeholders (env or unauthenticated)');
      }
      return res.json(placeholderStaff);
    }

    if (envIamEnabled) {
      const cognitoStaff = await fetchAssignableFromCognito(pool);
      if (Array.isArray(cognitoStaff) && cognitoStaff.length) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[staff-assignable] returning', cognitoStaff.length, 'staff from Cognito');
        }
        return res.json(cognitoStaff);
      }
    }

    const roles = ['Program Administrator','Regional Coordinator','Application Assessor'];
    const [rows] = await pool.query(
      `SELECT id, cognito_sub, email, primary_role AS role, email AS display_name
         FROM staff_profiles
        WHERE primary_role IN (${roles.map(()=>'?').join(',')})
        ORDER BY primary_role, email`, roles);
    res.json(rows.map(r => ({ id: r.id, email: r.email, role: r.role, display_name: r.display_name })));
  } catch (e) {
    console.error('GET /api/staff/assignable failed:', e.message);
    res.status(500).json({ error: 'assignable_fetch_failed' });
  }
});

// PATCH /api/cases/:id/assign { assignee_id | placeholder_email }
// Accepts either a real staff_profiles id or a placeholder email when IAM off.
app.patch('/api/cases/:id/assign', async (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  if (!Number.isInteger(caseId) || caseId < 1) return res.status(400).json({ error: 'invalid_case_id' });
  const { assignee_id, placeholder_email } = req.body || {};
  try {
    const [[caseRow]] = await pool.query('SELECT id, application_id, assigned_to_user_id FROM iset_case WHERE id=? LIMIT 1', [caseId]);
    if (!caseRow) return res.status(404).json({ error: 'case_not_found' });
    const previousAssigneeId = caseRow.assigned_to_user_id != null ? Number(caseRow.assigned_to_user_id) : null;
    let previousAssigneeMeta = null;
    if (previousAssigneeId) {
      const [[prevMeta]] = await pool.query('SELECT id, display_name, email FROM staff_profiles WHERE id=? LIMIT 1', [previousAssigneeId]);
      previousAssigneeMeta = prevMeta || null;
    }
    let assignId = null;
    if (assignee_id) {
      const [[staff]] = await pool.query('SELECT id FROM staff_profiles WHERE id=? LIMIT 1', [assignee_id]);
      if (!staff) return res.status(400).json({ error: 'staff_not_found' });
      assignId = staff.id;
    } else if (placeholder_email) {
      const emailNorm = String(placeholder_email).toLowerCase();
      const placeholderMeta = PLACEHOLDER_ASSIGNABLE_LOOKUP.get(emailNorm);
      const inferredRole = placeholderMeta?.role || 'Application Assessor';
      const subVal = `placeholder-${emailNorm}`;
      try {
        await pool.query(`INSERT INTO staff_profiles (cognito_sub,email,primary_role) VALUES (?,?,?)
          ON DUPLICATE KEY UPDATE email=VALUES(email), primary_role=VALUES(primary_role)`, [ subVal, placeholder_email, inferredRole ]);
      } catch (insErr) {
        try {
          await pool.query(`INSERT INTO staff_profiles (cognito_sub,email) VALUES (?,?) ON DUPLICATE KEY UPDATE email=VALUES(email)`, [ subVal, placeholder_email ]);
          await pool.query(`UPDATE staff_profiles SET primary_role=? WHERE cognito_sub=? AND (primary_role IS NULL OR primary_role='')`, [ inferredRole, subVal ]);
        } catch (fallbackErr) {
          console.warn('Placeholder staff insert fallback failed:', fallbackErr.message);
        }
      }
      const [[row]] = await pool.query('SELECT id FROM staff_profiles WHERE cognito_sub=? LIMIT 1', [ subVal ]);
      assignId = row?.id || null;
    } else {
      return res.status(400).json({ error: 'assignee_required' });
    }
    const normalizedAssignId = assignId != null ? Number(assignId) : null;
    await pool.query('UPDATE iset_case SET assigned_to_user_id=?, updated_at=NOW() WHERE id=?', [normalizedAssignId, caseId]);
    let newAssigneeMeta = null;
    if (normalizedAssignId) {
      const [[nextMeta]] = await pool.query('SELECT id, display_name, email FROM staff_profiles WHERE id=? LIMIT 1', [normalizedAssignId]);
      newAssigneeMeta = nextMeta || null;
    }
    let trackingId = null;
    if (caseRow.application_id) {
      const [[trackingRow]] = await pool.query(`SELECT JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.submission_snapshot.reference_number')) AS submission_ref FROM iset_application WHERE id=? LIMIT 1`, [caseRow.application_id]);
      trackingId = trackingRow?.submission_ref || null;
    }
    if (!trackingId) trackingId = `CASE-${caseId}`;
    const { actorId, actorName } = resolveRequestActor(req);
    let eventType = null;
    if (previousAssigneeId && normalizedAssignId && previousAssigneeId !== normalizedAssignId) {
      eventType = 'case_reassigned';
    } else if (!previousAssigneeId && normalizedAssignId) {
      eventType = 'case_assigned';
    } else if (previousAssigneeId && normalizedAssignId === null) {
      eventType = 'case_unassigned';
    }
    if (eventType) {
      const payload = {
        tracking_id: trackingId,
        from_assignee_id: previousAssigneeMeta?.id ?? null,
        from_assignee_email: previousAssigneeMeta?.email ?? null,
        from_assignee_name: previousAssigneeMeta?.display_name ?? null,
        to_assignee_id: newAssigneeMeta?.id ?? null,
        to_assignee_email: newAssigneeMeta?.email ?? placeholder_email ?? null,
        to_assignee_name: newAssigneeMeta?.display_name ?? null,
      };
      const fromLabel = payload.from_assignee_name || payload.from_assignee_email || previousAssigneeId || 'previous assignee';
      const toLabel = eventType === 'case_unassigned' ? 'Unassigned' : (payload.to_assignee_name || payload.to_assignee_email || normalizedAssignId || 'assignee');
      if (eventType === 'case_reassigned') {
        payload.message = `Case reassigned from ${fromLabel} to ${toLabel}.`;
      } else if (eventType === 'case_assigned') {
        payload.message = `Case assigned to ${toLabel}.`;
      } else if (eventType === 'case_unassigned') {
        payload.message = `Case unassigned from ${fromLabel}.`;
      }
      try {
        await captureCaseEvent({
          type: eventType,
          caseId,
          payload,
          trackingId,
          actorId,
          actorName,
        });
      } catch (_) {}
    }
    return res.json({ ok: true, case_id: caseId, assigned_to_user_id: normalizedAssignId });
  } catch (e) {
    console.error('PATCH /api/cases/:id/assign failed:', e.message);
    res.status(500).json({ error: 'assign_failed', message: e.message });
  }
});

// ---------------------------------------------------------------------------
// Contact Messages (admin dashboard)
// ---------------------------------------------------------------------------
const CONTACT_MSG_PAGE_SIZE = 25;
const CONTACT_MSG_PAGE_SIZE_MAX = 100;

function resolveContactAdminRole(req) {
  const role = inferUserRole(req);
  if (role === 'System Administrator' || role === 'Program Administrator') {
    return role;
  }
  return null;
}

app.get('/api/admin/contact-messages', async (req, res) => {
  if (!resolveContactAdminRole(req)) return res.status(403).json({ error: 'forbidden' });

  const page = Math.max(1, parseInt(req.query.page ?? '1', 10) || 1);
  const pageSize = Math.min(
    CONTACT_MSG_PAGE_SIZE_MAX,
    Math.max(1, parseInt(req.query.pageSize ?? `${CONTACT_MSG_PAGE_SIZE}`, 10) || CONTACT_MSG_PAGE_SIZE)
  );
  const offset = (page - 1) * pageSize;

  const status = typeof req.query.status === 'string' && req.query.status !== 'all'
    ? req.query.status.trim()
    : null;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const submittedAfter = req.query.submittedAfter ? new Date(req.query.submittedAfter) : null;
  const submittedBefore = req.query.submittedBefore ? new Date(req.query.submittedBefore) : null;

  const where = [];
  const params = [];

  if (status) {
    where.push('cm.status = ?');
    params.push(status);
  }
  if (search) {
    const like = `%${search}%`;
    where.push(`(
      cm.full_name LIKE ? OR
      cm.email LIKE ? OR
      cm.subject LIKE ? OR
      cm.message LIKE ?
    )`);
    params.push(like, like, like, like);
  }
  if (submittedAfter && !Number.isNaN(submittedAfter.valueOf())) {
    where.push('cm.submitted_at >= ?');
    params.push(submittedAfter);
  }
  if (submittedBefore && !Number.isNaN(submittedBefore.valueOf())) {
    where.push('cm.submitted_at <= ?');
    params.push(submittedBefore);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
         FROM contact_message cm
         ${whereClause}`,
      params
    );

    const [items] = await pool.query(
      `SELECT
         cm.id,
         cm.submitted_at   AS submittedAt,
         cm.full_name      AS fullName,
         cm.email,
         cm.subject,
         cm.status,
         cm.user_id        AS userId
       FROM contact_message cm
       ${whereClause}
       ORDER BY cm.submitted_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({ items, page, pageSize, total });
  } catch (err) {
    console.error('[contact-admin] list failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// --- ESDC participant submissions -------------------------------------------------
const esdcRouter = express.Router();

/**
 * GET /api/esdc/participants
 * Query parameters (optional):
 *   readiness (ready|needs_review|blocked)
 *   search (tracking ID / name)
 *   limit / offset
 */
esdcRouter.get('/participants', async (req, res, next) => {
  const {
    readiness,
    search,
    limit = 25,
    offset = 0,
  } = req.query;

  const params = [];
  const where = [];

  if (readiness && ['ready', 'needs_review', 'blocked'].includes(readiness)) {
    where.push('eps.readiness_status = ?');
    params.push(readiness);
  }

  if (search) {
    where.push('(COALESCE(ias.reference_number, CONCAT(\'CASE-\', eps.case_id)) LIKE ? OR ia.payload_json->>"$.personal.last_name" LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [rows] = await pool.query(
      `
      SELECT
        eps.id,
        eps.case_id,
        eps.readiness_status,
        eps.submission_status,
        eps.last_validated_at,
        eps.submitted_at,
        COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.personal.full_name')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$.personal.full_name')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.answers."preferred-name"')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$.answers."preferred-name"')), ''),
          NULLIF(TRIM(CONCAT_WS(' ',
            JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.answers."first-name"')),
            JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.answers."middle-names"')),
            JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.answers."last-name"'))
          )), ''),
          NULLIF(TRIM(CONCAT_WS(' ',
            JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.answers.first_name')),
            JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.answers.middle_names')),
            JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.answers.last_name'))
          )), ''),
          NULLIF(TRIM(CONCAT_WS(' ',
            JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.personal.first_name')),
            JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.personal.middle_name')),
            JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.personal.last_name'))
          )), ''),
          NULLIF(TRIM(CONCAT_WS(' ',
            JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$.answers."first-name"')),
            JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$.answers."middle-names"')),
            JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$.answers."last-name"'))
          )), ''),
          NULLIF(TRIM(CONCAT_WS(' ',
            JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$.answers.first_name')),
            JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$.answers.middle_names')),
            JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$.answers.last_name'))
          )), ''),
          NULLIF(TRIM(CONCAT_WS(' ',
            JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$.personal.first_name')),
            JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$.personal.middle_name')),
            JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$.personal.last_name'))
          )), ''),
          COALESCE(ias.reference_number, CONCAT('CASE-', eps.case_id))
        ) AS participant_name,
        COALESCE(ias.reference_number, CONCAT('CASE-', eps.case_id)) AS tracking_id
      FROM esdc_participant_submission eps
      LEFT JOIN iset_application ia ON ia.id = eps.application_id
      LEFT JOIN iset_application_submission ias ON ias.id = ia.submission_id
      ${whereClause}
      ORDER BY eps.last_validated_at DESC, eps.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, Number(limit), Number(offset)]
    );

    const [[{ total }]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM esdc_participant_submission eps
      LEFT JOIN iset_application ia ON ia.id = eps.application_id
      LEFT JOIN iset_application_submission ias ON ias.id = ia.submission_id
      ${whereClause}
      `,
      params
    );

    const items = rows.map(row => ({
      id: row.id,
      case_id: row.case_id,
      readiness_status: row.readiness_status,
      submission_status: row.submission_status,
      last_validated_at: row.last_validated_at,
      submitted_at: row.submitted_at,
      tracking_id: row.tracking_id,
      participant_name: row.participant_name || row.tracking_id
    }));

    res.json({ total, items });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/esdc/participants/:id
 */
esdcRouter.get('/participants/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const [[submission]] = await pool.query(
      `
      SELECT
        eps.*,
        COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.personal.full_name')), ''),
          NULLIF(TRIM(CONCAT_WS(' ',
            JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.personal.first_name')),
            JSON_UNQUOTE(JSON_EXTRACT(ia.payload_json, '$.personal.last_name'))
          )), ''),
          COALESCE(ias.reference_number, CONCAT('CASE-', eps.case_id))
        ) AS participant_name,
        COALESCE(ias.reference_number, CONCAT('CASE-', eps.case_id)) AS tracking_id
      FROM esdc_participant_submission eps
      LEFT JOIN iset_application ia ON ia.id = eps.application_id
      LEFT JOIN iset_application_submission ias ON ias.id = ia.submission_id
      WHERE eps.id = ?
      `,
      [id]
    );
    if (!submission) {
      return res.status(404).json({ error: 'Participant submission not found' });
    }

    const [history] = await pool.query(
      `
      SELECT *
      FROM esdc_participant_submission_history
      WHERE participant_submission_id = ?
      ORDER BY occurred_at DESC
      `,
      [id]
    );

    res.json({ submission, history });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/esdc/participants/:id/validate
 * (Re-run validation logic; placeholder updates metadata right now.)
 */
esdcRouter.post('/participants/:id/validate', async (req, res, next) => {
  const { id } = req.params;
  try {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return res.status(400).json({ error: 'invalid_participant_id' });
    }

    await validateEsdcParticipantSubmission({ submissionId: numericId });

    const [[submission]] = await pool.query(
      `
      SELECT eps.*, COALESCE(ias.reference_number, CONCAT('CASE-', eps.case_id)) AS tracking_id
      FROM esdc_participant_submission eps
      LEFT JOIN iset_application ia ON ia.id = eps.application_id
      LEFT JOIN iset_application_submission ias ON ias.id = ia.submission_id
      WHERE eps.id = ?
      `,
      [numericId]
    );
    if (!submission) {
      return res.status(404).json({ error: 'Participant submission not found' });
    }

    const [history] = await pool.query(
      `
      SELECT *
      FROM esdc_participant_submission_history
      WHERE participant_submission_id = ?
      ORDER BY occurred_at DESC, id DESC
      `,
      [numericId]
    );

    res.json({ ok: true, submission, history });
  } catch (err) {
    if (err && err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message || 'validation_failed' });
    }
    next(err);
  }
});

/**
 * POST /api/esdc/participants/:id/prepare
 * Generates/stores payload snapshot based on latest validated data.
 */
esdcRouter.post('/participants/:id/prepare', async (req, res, next) => {
  const numericId = Number(req.params.id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json({ error: 'invalid_participant_id' });
  }

  try {
    const result = await prepareEsdcParticipantSubmission({ submissionId: numericId });
    if (result.blocking) {
      return res.status(409).json({
        error: 'blocking_validation_issues',
        readinessStatus: result.evaluation.readinessStatus,
        readinessSummary: result.evaluation.readinessSummary,
        warnings: result.evaluation.warnings,
        blockingIssues: result.evaluation.blockingIssues
      });
    }
    res.json({
      ok: true,
      submission: result.submission,
      history: result.history,
      payload: result.payload,
      checksum: result.checksum,
      storageKey: result.storageKey
    });
  } catch (err) {
    if (err && err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message || 'validation_failed' });
    }
    next(err);
  }
});

/**
 * GET /api/esdc/participants/:id/payload
 * Returns the stored payload snapshot (if generated).
 */
esdcRouter.get('/participants/:id/payload', async (req, res, next) => {
  const numericId = Number(req.params.id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json({ error: 'invalid_participant_id' });
  }
  try {
    const [[row]] = await pool.query(
      `
      SELECT payload_snapshot, payload_checksum, payload_storage_key, updated_at
      FROM esdc_participant_submission
      WHERE id = ?
      `,
      [numericId]
    );
    if (!row) {
      return res.status(404).json({ error: 'Participant submission not found' });
    }
    let snapshot = row.payload_snapshot;
    if (snapshot && typeof snapshot === 'string') {
      try {
        snapshot = JSON.parse(snapshot);
      } catch {
        // leave as-is (raw string)
      }
    }
    res.json({
      payload: snapshot || null,
      checksum: row.payload_checksum || null,
      storageKey: row.payload_storage_key || null,
      updatedAt: row.updated_at || null
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/esdc/participants/:id/submit
 * Marks submission as sent and logs history. Body can include rejectionReason or success flag.
 */
esdcRouter.post('/participants/:id/submit', async (req, res, next) => {
  const { id } = req.params;
  const { status = 'submitted', rejectionReason = null } = req.body || {};
  const actorUserId = req.user?.id || null;

  if (!['submitted', 'accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid submission status' });
  }

  try {
    const [result] = await pool.query(
      `
      UPDATE esdc_participant_submission
      SET submission_status = ?, submitted_at = NOW(), submitted_by_user_id = ?, rejection_reason = ?
      WHERE id = ?
      `,
      [status, actorUserId, rejectionReason, id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Participant submission not found' });
    }

    await pool.query(
      `
      INSERT INTO esdc_participant_submission_history
        (participant_submission_id, event_type, actor_user_id, event_details)
      VALUES
        (?, ?, ?, JSON_OBJECT('rejectionReason', ?))
      `,
      [id, status, actorUserId, rejectionReason]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/esdc/participants/:id/history
 * (Convenience endpoint if the workspace wants to fetch history separately.)
 */
esdcRouter.get('/participants/:id/history', async (req, res, next) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM esdc_participant_submission_history
      WHERE participant_submission_id = ?
      ORDER BY occurred_at DESC
      `,
      [id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/esdc/participants/:id/history
 * Add manual note / event entry.
 */
esdcRouter.post('/participants/:id/history', async (req, res, next) => {
  const { id } = req.params;
  const { eventType = 'validated', details = {} } = req.body || {};
  const actorUserId = req.user?.id || null;

  if (!['validated', 'ready', 'submitted', 'accepted', 'rejected'].includes(eventType)) {
    return res.status(400).json({ error: 'Invalid event type' });
  }

  try {
    await pool.query(
      `
      INSERT INTO esdc_participant_submission_history
        (participant_submission_id, event_type, actor_user_id, event_details)
      VALUES (?, ?, ?, ?)
      `,
      [id, eventType, actorUserId, JSON.stringify(details || {})]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Mount under your existing API router:
app.use('/api/esdc', esdcRouter);


app.get('/api/admin/contact-messages/:id', async (req, res) => {
  if (!resolveContactAdminRole(req)) return res.status(403).json({ error: 'forbidden' });

  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });

  try {
    const [[message]] = await pool.query(
      `SELECT
         cm.id,
         cm.submitted_at   AS submittedAt,
         cm.full_name      AS fullName,
         cm.email,
         cm.subject,
         cm.message,
         cm.status,
         cm.user_id        AS userId,
         cm.submitted_ip   AS submittedIp,
         cm.updated_at     AS updatedAt
       FROM contact_message cm
       WHERE cm.id = ?
       LIMIT 1`,
      [id]
    );
    if (!message) return res.status(404).json({ error: 'not_found' });

    const [history] = await pool.query(
      `SELECT
         h.id,
         h.previous_status AS previousStatus,
         h.new_status      AS newStatus,
         h.changed_by_user_id AS changedByUserId,
         h.changed_at      AS changedAt,
         u.name            AS changedByName,
         u.email           AS changedByEmail,
         CASE
           WHEN u.name IS NOT NULL AND TRIM(u.name) <> '' THEN u.name
           WHEN u.email IS NOT NULL AND u.email <> '' THEN u.email
           ELSE NULL
         END AS changedByDisplay
       FROM contact_message_status_history h
       LEFT JOIN user u ON u.id = h.changed_by_user_id
       WHERE h.contact_message_id = ?
       ORDER BY h.changed_at DESC, h.id DESC`,
      [id]
    );

    const [notes] = await pool.query(
      `SELECT
         n.id,
         n.note_text       AS noteText,
         n.author_user_id  AS authorUserId,
         n.created_at      AS createdAt,
         u.name            AS authorName,
         u.email           AS authorEmail,
         CASE
           WHEN u.name IS NOT NULL AND TRIM(u.name) <> '' THEN u.name
           WHEN u.email IS NOT NULL AND u.email <> '' THEN u.email
           ELSE NULL
         END AS authorDisplay
       FROM contact_message_note n
       LEFT JOIN user u ON u.id = n.author_user_id
       WHERE n.contact_message_id = ?
       ORDER BY n.created_at DESC, n.id DESC`,
      [id]
    );

    res.json({ message, history, notes });
  } catch (err) {
    console.error('[contact-admin] detail failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.patch('/api/admin/contact-messages/:id/status', async (req, res) => {
  if (!resolveContactAdminRole(req)) return res.status(403).json({ error: 'forbidden' });

  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });

  const nextStatus = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
  if (!nextStatus) return res.status(400).json({ error: 'invalid_status' });

  const actorUserId = req.staffProfile?.id || req.auth?.userId || null;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [[current]] = await connection.query(
      'SELECT status FROM contact_message WHERE id = ? LIMIT 1',
      [id]
    );
    if (!current) {
      await connection.rollback();
      return res.status(404).json({ error: 'not_found' });
    }

    if (current.status !== nextStatus) {
      await connection.query(
        `UPDATE contact_message
           SET status = ?, updated_at = NOW()
         WHERE id = ?`,
        [nextStatus, id]
      );

      await connection.query(
        `INSERT INTO contact_message_status_history
           (contact_message_id, previous_status, new_status, changed_by_user_id, changed_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [id, current.status, nextStatus, actorUserId]
      );
    }

    await connection.commit();

    try {
      await dispatchInternalNotifications?.({
        type: 'contact_message.updated',
        payload: {
          messageId: id,
          previousStatus: current.status,
          newStatus: nextStatus,
          changedBy: actorUserId
        }
      });
    } catch (notifyErr) {
      console.warn('[contact-admin] status notification failed', notifyErr.message);
    }

    res.json({ success: true, status: nextStatus });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    console.error('[contact-admin] status update failed', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/admin/contact-messages/:id/notes', async (req, res) => {
  if (!resolveContactAdminRole(req)) return res.status(403).json({ error: 'forbidden' });

  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });

  const noteText = typeof req.body?.noteText === 'string' ? req.body.noteText.trim() : '';
  if (!noteText) return res.status(400).json({ error: 'invalid_note' });

  let authorUserId = null;
  try {
    const candidateIdValues = [req.auth?.userId, req.auth?.user_id, req.auth?.id]
      .map(value => {
        const numeric = Number.parseInt(value, 10);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
      })
      .filter(value => value !== null);
    if (candidateIdValues.length) {
      const placeholders = candidateIdValues.map(() => '?').join(', ');
      const [idRows] = await pool.query(
        `SELECT id FROM user WHERE id IN (${placeholders}) LIMIT 1`,
        candidateIdValues
      );
      if (idRows && idRows[0] && Number.isFinite(Number(idRows[0].id))) {
        authorUserId = Number(idRows[0].id);
      }
    }
    if (authorUserId === null) {
      const candidateEmails = new Set();
      if (typeof req.auth?.email === 'string' && req.auth.email.trim()) {
        candidateEmails.add(req.auth.email.trim());
      }
      if (typeof req.staffProfile?.email === 'string' && req.staffProfile.email.trim()) {
        candidateEmails.add(req.staffProfile.email.trim());
      }
      if (candidateEmails.size) {
        const emailList = Array.from(candidateEmails);
        const placeholders = emailList.map(() => '?').join(', ');
        const [emailRows] = await pool.query(
          `SELECT id FROM user WHERE email IN (${placeholders}) LIMIT 1`,
          emailList
        );
        if (emailRows && emailRows[0] && Number.isFinite(Number(emailRows[0].id))) {
          authorUserId = Number(emailRows[0].id);
        }
      }
    }
  } catch (lookupErr) {
    console.warn('[contact-admin] unable to resolve note author user id', lookupErr.message);
    authorUserId = null;
  }

  try {
    await pool.query(
      `INSERT INTO contact_message_note
         (contact_message_id, author_user_id, note_text, created_at)
       VALUES (?, ?, ?, NOW())`,
      [id, authorUserId, noteText]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[contact-admin] add note failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/api/admin/contact-messages/:id/notes', async (req, res) => {
  if (!resolveContactAdminRole(req)) return res.status(403).json({ error: 'forbidden' });

  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });

  try {
    const [notes] = await pool.query(
      `SELECT
         n.id,
         n.note_text       AS noteText,
         n.author_user_id  AS authorUserId,
         n.created_at      AS createdAt,
         u.name            AS authorName,
         u.email           AS authorEmail,
         CASE
           WHEN u.name IS NOT NULL AND TRIM(u.name) <> '' THEN u.name
           WHEN u.email IS NOT NULL AND u.email <> '' THEN u.email
           ELSE NULL
         END AS authorDisplay
       FROM contact_message_note n
       LEFT JOIN user u ON u.id = n.author_user_id
       WHERE n.contact_message_id = ?
       ORDER BY n.created_at DESC, n.id DESC`,
      [id]
    );
    res.json({ items: notes });
  } catch (err) {
    console.error('[contact-admin] notes fetch failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});


app.post('/api/clear-iset-test-data', async (_req, res) => {
  let connection;
  const report = [];
  const startedAt = Date.now();
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const tableName of ISET_TEST_DATA_TABLE_ORDER) {
      try {
        const outcome = await clearTableWithCount(connection, tableName);
        report.push(outcome);
      } catch (err) {
        err.tableName = tableName;
        throw err;
      }
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();
    res.json({ ok: true, cleared: report, durationMs: Date.now() - startedAt });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
      try { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (_) {}
    }
    const message = err?.message || 'Failed to clear test data';
    const table = err?.tableName || null;
    console.error('[clear-iset-test-data] failed', table ? `${table}:` : '', message);
    res.status(500).json({ error: 'clear_test_data_failed', message, table });
  } finally {
    if (connection) connection.release();
  }
});

// (Removed duplicate linkage-stats route; public version defined earlier before auth.)


// --- AI Chat proxy & status (server-side, avoids exposing API keys in browser) -----
// GET  /api/ai/status -> { enabled: boolean, provider: string|null }
// POST /api/ai/chat   -> OpenRouter streaming/standard chat completion
const AI_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || '';
if (!AI_KEY) {
  console.warn('[AI] No OPENROUTER_API_KEY / OPENROUTER_KEY set. /api/ai/chat will return 501 (disabled).');
} else {
  console.log('[AI] OpenRouter key detected. AI translation/chat enabled.');
}
// Simple in-memory cache for model catalog
let __aiModelsCache = { fetchedAt: 0, ttl: 0, data: [] };
async function fetchOpenRouterModels(force = false) {
  const now = Date.now();
  const ttlMs = (parseInt(process.env.OPENROUTER_MODELS_TTL || '3600', 10) || 3600) * 1000;
  if (!force && __aiModelsCache.data.length && (now - __aiModelsCache.fetchedAt) < __aiModelsCache.ttl) {
    return { fromCache: true, models: __aiModelsCache.data };
  }
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (AI_KEY) headers.Authorization = `Bearer ${AI_KEY}`;
    const resp = await axios.get('https://openrouter.ai/api/v1/models', { headers, timeout: 10000 });
    const raw = resp.data?.data || resp.data?.models || [];
    // Normalize subset of useful fields
    const models = raw.map(m => ({
      id: m.id || m.name || m.slug,
      name: m.name || m.id,
      context: m.context_length || m.context_length_tokens || m.context || null,
      pricing: m.pricing || m.cost || null,
      description: m.description || '',
      architecture: m.architecture || m.family || null,
      provider: m.provider || (m.id ? m.id.split('/')[0] : null)
    })).filter(m => m.id);
    __aiModelsCache = { fetchedAt: now, ttl: ttlMs, data: models };
    return { fromCache: false, models };
  } catch (e) {
    console.warn('[AI] fetch models failed:', e.message);
    return { fromCache: false, models: [] };
  }
}
// Policy allowlist: env OPENROUTER_ALLOWED_MODELS (comma) or prefixes OPENROUTER_ALLOWED_PREFIXES
function isModelAllowed(modelId) {
  if (!modelId) return false;
  const allowModels = (process.env.OPENROUTER_ALLOWED_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowModels.length && allowModels.includes(modelId)) return true;
  const allowPrefixes = (process.env.OPENROUTER_ALLOWED_PREFIXES || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowPrefixes.length && allowPrefixes.some(p => modelId.startsWith(p))) return true;
  // Fallback to legacy prefix list if none configured
  if (!allowModels.length && !allowPrefixes.length) {
    const legacy = ['openai/','mistralai/','anthropic/','google/','meta/'];
    return legacy.some(p => modelId.startsWith(p));
  }
  return false;
}
// GET /api/ai/models -> dynamic model catalog (role not strictly required but we may restrict later)
app.get('/api/ai/models', async (req, res) => {
  try {
    const { models, fromCache } = await fetchOpenRouterModels(Boolean(req.query.force));
    // Apply allowlist filter
    const filtered = models.filter(m => isModelAllowed(m.id));
    res.json({ count: filtered.length, fromCache, ttlSeconds: (parseInt(process.env.OPENROUTER_MODELS_TTL || '3600',10)||3600), models: filtered });
  } catch (e) {
    res.status(500).json({ error: 'models_fetch_failed', message: e.message });
  }
});
app.get('/api/ai/status', (_req, res) => {
  const enabled = !!AI_KEY;
  const configuredModel = (process.env.OPENROUTER_MODEL || '').trim();
  const params = {
    temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7'),
    top_p: parseFloat(process.env.OPENROUTER_TOP_P || '1'),
    max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '0', 10) || null,
    presence_penalty: parseFloat(process.env.OPENROUTER_PRESENCE_PENALTY || '0'),
    frequency_penalty: parseFloat(process.env.OPENROUTER_FREQUENCY_PENALTY || '0')
  };
  const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  res.json({ enabled, provider: enabled ? 'openrouter' : null, model: (global.__AI_MODEL_OVERRIDE || configuredModel || 'mistralai/mistral-7b-instruct'), params, fallbacks });
});
// Body: { messages: [{ role, content }], model? }
app.post('/api/ai/chat', async (req, res) => {
  try {
    const key = AI_KEY;
    if (!key) {
      return res.status(501).json({ error: 'ai_disabled', message: 'AI assistant disabled (missing API key).' });
    }
    const { messages, model } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages_required' });
    }
    // Sanitize payload and cap size
    const safeMessages = messages
      .slice(0, 12)
      .map(m => ({
        role: ['system','user','assistant'].includes(String(m.role).toLowerCase()) ? String(m.role).toLowerCase() : 'user',
        content: String(m.content ?? '').slice(0, 8000)
      }));
    const FALLBACK_MODEL = 'mistralai/mistral-7b-instruct';
  const defaultModel = (global.__AI_MODEL_OVERRIDE || process.env.OPENROUTER_MODEL || '').trim() || FALLBACK_MODEL;
    const requestedModel = (typeof model === 'string' && model.trim()) ? model.trim() : null;
    const mdl = requestedModel || defaultModel;
    const headers = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.ALLOWED_ORIGIN || 'http://localhost:3001',
      'X-Title': 'Admin Dashboard Assistant',
    };
    // Generation params (defaults from env; allow per-request override if provided)
    const params = {
      temperature: Math.min(2, Math.max(0, typeof req.body.temperature === 'number' ? req.body.temperature : parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7'))),
      top_p: Math.min(1, Math.max(0, typeof req.body.top_p === 'number' ? req.body.top_p : parseFloat(process.env.OPENROUTER_TOP_P || '1'))),
      presence_penalty: Math.min(2, Math.max(-2, typeof req.body.presence_penalty === 'number' ? req.body.presence_penalty : parseFloat(process.env.OPENROUTER_PRESENCE_PENALTY || '0'))),
      frequency_penalty: Math.min(2, Math.max(-2, typeof req.body.frequency_penalty === 'number' ? req.body.frequency_penalty : parseFloat(process.env.OPENROUTER_FREQUENCY_PENALTY || '0'))),
    };
    const maxTokensEnv = parseInt(process.env.OPENROUTER_MAX_TOKENS || '0', 10);
    const max_tokens = typeof req.body.max_tokens === 'number' ? req.body.max_tokens : (maxTokensEnv > 0 ? maxTokensEnv : undefined);
    if (max_tokens && (!Number.isInteger(max_tokens) || max_tokens < 1)) return res.status(400).json({ error: 'invalid_max_tokens' });
    const fallbacksChain = (process.env.OPENROUTER_FALLBACK_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
    const attempted = [];
    async function tryModel(modelId) {
      attempted.push(modelId);
      const payload = { model: modelId, messages: safeMessages, ...params };
      if (max_tokens) payload.max_tokens = max_tokens;
      return axios.post('https://openrouter.ai/api/v1/chat/completions', payload, { headers });
    }
    let resp;
    let primaryError = null;
    try {
      resp = await tryModel(mdl);
    } catch (err) {
      primaryError = err;
      const status = err?.response?.status;
      // Iterate fallbacks if configured error and chain exists
      if ([400,401,402,403,404,422].includes(Number(status)) && fallbacksChain.length) {
        for (const fb of fallbacksChain) {
          if (fb === mdl) continue; // skip if same
            try {
              resp = await tryModel(fb);
              return res.status(200).json({ ...resp.data, _fallbackChain: attempted });
            } catch (e2) {
              continue;
            }
        }
      }
      const details = err?.response?.data || { message: err.message };
      return res.status(status || 500).json({ error: 'proxy_failed', details, attempted, _fallbackChain: attempted });
    }
    res.status(200).json({ ...resp.data, _attempted: attempted });
  } catch (e) {
    const status = e?.response?.status || 500;
    const details = e?.response?.data || { message: e.message };
    res.status(status).json({ error: 'proxy_failed', details });
  }
});

// PATCH /api/config/runtime/ai-model  { model: "model-name" }
// Non-persistent (in-memory) override for active session; requires System Administrator role when auth enabled
app.patch('/api/config/runtime/ai-model', async (req, res) => {
  try {
    const body = req.body || {};
    const nextModel = (body.model || '').trim();
    if (!nextModel) return res.status(400).json({ error: 'model_required' });
    // Basic allowlist (can be expanded)
    const allowedPrefixes = ['openai/', 'mistralai/', 'anthropic/', 'google/', 'meta/'];
    if (!allowedPrefixes.some(p => nextModel.startsWith(p))) {
      return res.status(400).json({ error: 'unsupported_model', message: 'Model prefix not allowed in this environment.' });
    }
    // Authorization: if auth provider enabled, require SysAdmin
    const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
    const devAuthBypassed = authProvider === 'cognito' && process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
    let effectiveRole = req.auth?.role;
    if ((!effectiveRole || devAuthBypassed) && !req.auth) {
      // Attempt to derive role from dev bypass header (since auth middleware not attached in bypass mode)
      const hdrRole = req.get('x-dev-role') || req.get('X-Dev-Role');
      if (hdrRole) effectiveRole = hdrRole;
    }
    if (authProvider === 'cognito' && !devAuthBypassed) {
      if (effectiveRole !== 'System Administrator') return res.status(403).json({ error: 'forbidden' });
    } else {
      // Non-cognito or bypass mode: still enforce role if header provided; allow if System Administrator else forbid
      if (effectiveRole && effectiveRole !== 'System Administrator') {
        return res.status(403).json({ error: 'forbidden' });
      }
    }
    const prev = global.__AI_MODEL_OVERRIDE || process.env.OPENROUTER_MODEL || '';
    // Persist to .env file (atomic-ish replace). We retain previous lines & replace/append OPENROUTER_MODEL.
    let persisted = false;
    try {
      const envFile = dotenvPath; // resolved earlier depending on NODE_ENV
      let content = '';
      try { content = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''; } catch { /* ignore read error */ }
      const lines = content.split(/\r?\n/);
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*OPENROUTER_MODEL\s*=/.test(lines[i])) { lines[i] = `OPENROUTER_MODEL=${nextModel}`; found = true; break; }
      }
      if (!found) {
        if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
        lines.push(`OPENROUTER_MODEL=${nextModel}`);
      }
      const newContent = lines.join('\n');
      // Write via temp file then rename for a bit more safety
      const tmpPath = envFile + '.tmp';
      fs.writeFileSync(tmpPath, newContent, 'utf8');
      fs.renameSync(tmpPath, envFile);
      persisted = true;
      // Reflect immediately in process env & clear volatile override
      process.env.OPENROUTER_MODEL = nextModel;
      delete global.__AI_MODEL_OVERRIDE;
    } catch (fileErr) {
      // Fall back to in-memory override if file write fails
      global.__AI_MODEL_OVERRIDE = nextModel;
      console.warn('[ai-model] Failed to persist to .env, using in-memory override only:', fileErr.message);
    }
    // Also persist to shared runtime_config for public scope so portal can consume
    try {
      await pool.query("CREATE TABLE IF NOT EXISTS iset_runtime_config (id INT AUTO_INCREMENT PRIMARY KEY, scope VARCHAR(32) NOT NULL, k VARCHAR(128) NOT NULL, v JSON NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_scope_key (scope,k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
      await pool.query("INSERT INTO iset_runtime_config (scope,k,v) VALUES ('public','ai.model',JSON_OBJECT('model',?)) ON DUPLICATE KEY UPDATE v=VALUES(v)", [ nextModel ]);
    } catch (dbErr) {
      console.warn('[ai-model] DB persist failed (non-fatal):', dbErr.message);
    }
    // Lightweight audit log (stdout). Could be extended to DB later.
    console.log('[audit] ai-model-change', JSON.stringify({ when: new Date().toISOString(), prev, next: nextModel, by: req.auth?.sub || 'dev-bypass', role: effectiveRole || null, persisted }));
    res.json({ ok: true, model: nextModel, persisted });
  } catch (e) {
    res.status(500).json({ error: 'ai_model_update_failed', message: e.message });
  }
});

// GET current AI generation params & fallbacks
app.get('/api/config/runtime/ai-params', (req, res) => {
  try {
    const params = {
      temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7'),
      top_p: parseFloat(process.env.OPENROUTER_TOP_P || '1'),
      max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '0', 10) || null,
      presence_penalty: parseFloat(process.env.OPENROUTER_PRESENCE_PENALTY || '0'),
      frequency_penalty: parseFloat(process.env.OPENROUTER_FREQUENCY_PENALTY || '0')
    };
    const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
    res.json({ params, fallbacks });
  } catch (e) {
    res.status(500).json({ error: 'ai_params_fetch_failed', message: e.message });
  }
});

function persistEnvUpdates(updates) {
  const envFile = dotenvPath;
  let content = '';
  try { content = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''; } catch { /* ignore */ }
  const lines = content.split(/\r?\n/);
  const map = new Map();
  for (const l of lines) {
    const m = l.match(/^\s*([^#=]+?)\s?=\s?(.*)$/);
    if (m) map.set(m[1].trim(), m[2]);
  }
  Object.entries(updates).forEach(([k,v]) => { if (v === null || typeof v === 'undefined') return; map.set(k, String(v)); });
  const newLines = [];
  const seen = new Set();
  for (const l of lines) {
    const m = l.match(/^\s*([^#=]+?)\s?=/);
    if (m) {
      const key = m[1].trim();
      if (updates[key] !== undefined && !seen.has(key)) {
        newLines.push(`${key}=${map.get(key)}`);
        seen.add(key);
        continue;
      }
    }
    newLines.push(l);
  }
  for (const [k,v] of Object.entries(updates)) {
    if (!seen.has(k)) newLines.push(`${k}=${v}`);
  }
  const finalContent = newLines.join('\n');
  const tmp = envFile + '.tmp';
  fs.writeFileSync(tmp, finalContent, 'utf8');
  fs.renameSync(tmp, envFile);
  // Reflect into process.env
  Object.entries(updates).forEach(([k,v]) => { process.env[k] = String(v); });
}

// PATCH AI generation params
app.patch('/api/config/runtime/ai-params', async (req, res) => {
  try {
    const body = req.body || {};
    const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
    const devAuthBypassed = authProvider === 'cognito' && process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
    let role = req.auth?.role;
    if ((!role || devAuthBypassed) && !req.auth) {
      const hdrRole = req.get('x-dev-role') || req.get('X-Dev-Role');
      if (hdrRole) role = hdrRole;
    }
    if (role !== 'System Administrator') return res.status(403).json({ error: 'forbidden' });
    const toNumberOrNull = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    const temperature = toNumberOrNull(body.temperature);
    const top_p = toNumberOrNull(body.top_p);
    const max_tokens = toNumberOrNull(body.max_tokens);
    const presence_penalty = toNumberOrNull(body.presence_penalty);
    const frequency_penalty = toNumberOrNull(body.frequency_penalty);
    function inRange(val, min, max) { return typeof val === 'number' && !Number.isNaN(val) && val >= min && val <= max; }
    if (temperature !== null && !inRange(temperature, 0, 2)) return res.status(400).json({ error: 'invalid_temperature' });
    if (top_p !== null && !inRange(top_p, 0, 1)) return res.status(400).json({ error: 'invalid_top_p' });
    if (presence_penalty !== null && !inRange(presence_penalty, -2, 2)) return res.status(400).json({ error: 'invalid_presence_penalty' });
    if (frequency_penalty !== null && !inRange(frequency_penalty, -2, 2)) return res.status(400).json({ error: 'invalid_frequency_penalty' });
    if (max_tokens !== null && (!Number.isInteger(max_tokens) || max_tokens < 1)) return res.status(400).json({ error: 'invalid_max_tokens' });
    const updates = {};
    if (temperature !== null) updates.OPENROUTER_TEMPERATURE = temperature;
    if (top_p !== null) updates.OPENROUTER_TOP_P = top_p;
    if (max_tokens !== null) updates.OPENROUTER_MAX_TOKENS = max_tokens;
    if (presence_penalty !== null) updates.OPENROUTER_PRESENCE_PENALTY = presence_penalty;
    if (frequency_penalty !== null) updates.OPENROUTER_FREQUENCY_PENALTY = frequency_penalty;
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'no_updates' });
    try { persistEnvUpdates(updates); } catch (e) { return res.status(500).json({ error: 'persist_failed', message: e.message }); }
    try {
      const payload = {};
      if (updates.OPENROUTER_TEMPERATURE !== undefined) payload.temperature = Number(updates.OPENROUTER_TEMPERATURE);
      if (updates.OPENROUTER_TOP_P !== undefined) payload.top_p = Number(updates.OPENROUTER_TOP_P);
      if (updates.OPENROUTER_PRESENCE_PENALTY !== undefined) payload.presence_penalty = Number(updates.OPENROUTER_PRESENCE_PENALTY);
      if (updates.OPENROUTER_FREQUENCY_PENALTY !== undefined) payload.frequency_penalty = Number(updates.OPENROUTER_FREQUENCY_PENALTY);
      if (updates.OPENROUTER_MAX_TOKENS !== undefined) payload.max_tokens = Number(updates.OPENROUTER_MAX_TOKENS);
      await pool.query("CREATE TABLE IF NOT EXISTS iset_runtime_config (id INT AUTO_INCREMENT PRIMARY KEY, scope VARCHAR(32) NOT NULL, k VARCHAR(128) NOT NULL, v JSON NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_scope_key (scope,k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
      await pool.query("INSERT INTO iset_runtime_config (scope,k,v) VALUES ('public','ai.params',JSON_OBJECT('temperature',?, 'top_p',?, 'presence_penalty',?, 'frequency_penalty',?, 'max_tokens', ?)) ON DUPLICATE KEY UPDATE v=VALUES(v)", [ payload.temperature ?? null, payload.top_p ?? null, payload.presence_penalty ?? null, payload.frequency_penalty ?? null, payload.max_tokens ?? null ]);
    } catch (dbErr) {
      console.warn('[ai-params] DB persist failed (non-fatal):', dbErr.message);
    }
    console.log('[audit] ai-params-change', JSON.stringify({ when: new Date().toISOString(), updates, by: req.auth?.sub || 'dev-bypass', role }));
    res.json({ ok: true, updates });
  } catch (e) { res.status(500).json({ error: 'ai_params_update_failed', message: e.message }); }
});

// PATCH AI fallback chain (comma-separated list)
app.patch('/api/config/runtime/ai-fallbacks', async (req, res) => {
  try {
    const body = req.body || {};
    const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
    const devAuthBypassed = authProvider === 'cognito' && process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
    let role = req.auth?.role;
    if ((!role || devAuthBypassed) && !req.auth) {
      const hdrRole = req.get('x-dev-role') || req.get('X-Dev-Role'); if (hdrRole) role = hdrRole;
    }
    if (role !== 'System Administrator') return res.status(403).json({ error: 'forbidden' });
    const listRaw = body.fallbackModels || body.fallbacks || [];
    const list = Array.isArray(listRaw) ? listRaw : String(listRaw).split(',');
    const cleaned = list.map(s => String(s).trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
    for (const mdl of cleaned) { if (!isModelAllowed(mdl)) return res.status(400).json({ error: 'unsupported_model_in_fallbacks', model: mdl }); }
    try { persistEnvUpdates({ OPENROUTER_FALLBACK_MODELS: cleaned.join(',') }); } catch (e) { return res.status(500).json({ error: 'persist_failed', message: e.message }); }
    try {
      await pool.query("CREATE TABLE IF NOT EXISTS iset_runtime_config (id INT AUTO_INCREMENT PRIMARY KEY, scope VARCHAR(32) NOT NULL, k VARCHAR(128) NOT NULL, v JSON NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_scope_key (scope,k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
      await pool.query("INSERT INTO iset_runtime_config (scope,k,v) VALUES ('public','ai.fallbacks', CAST(? AS JSON)) ON DUPLICATE KEY UPDATE v=VALUES(v)", [ JSON.stringify(cleaned) ]);
    } catch (dbErr) {
      console.warn('[ai-fallbacks] DB persist failed (non-fatal):', dbErr.message);
    }
    console.log('[audit] ai-fallbacks-change', JSON.stringify({ when: new Date().toISOString(), fallbackModels: cleaned, by: req.auth?.sub || 'dev-bypass', role }));
    res.json({ ok: true, fallbackModels: cleaned });
  } catch (e) { res.status(500).json({ error: 'ai_fallbacks_update_failed', message: e.message }); }
});

app.get('/api/access-control/matrix', async (_req, res) => {
  try {
    const saved = await readAccessControlMatrix();
    res.json({
      matrix: { default: saved.default, routes: saved.routes },
      source: saved.source,
      updatedAt: saved.updatedAt,
      defaults: DEFAULT_ACCESS_CONTROL_MATRIX,
    });
  } catch (err) {
    console.error('[access-control] failed to load matrix:', err);
    res.status(500).json({ error: 'access_matrix_load_failed', message: err.message });
  }
});

app.put('/api/access-control/matrix', async (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const body = req.body || {};
    const payload = body.matrix && typeof body.matrix === 'object' ? body.matrix : body;
    const saved = await writeAccessControlMatrix(payload);
    res.json({
      matrix: { default: saved.default, routes: saved.routes },
      source: saved.source || 'db',
      updatedAt: saved.updatedAt,
      defaults: DEFAULT_ACCESS_CONTROL_MATRIX,
    });
  } catch (err) {
    console.error('[access-control] failed to persist matrix:', err);
    res.status(500).json({ error: 'access_matrix_update_failed', message: err.message });
  }
});

app.get('/api/config/runtime/locking', async (_req, res) => {
  const config = await readLockConfig();
  res.json(config);
});

app.patch('/api/config/runtime/locking', async (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const saved = await writeLockConfig(req.body || {});
    res.json(saved);
  } catch (err) {
    console.error('[locking] config update failed:', err);
    res.status(500).json({ error: 'locking_config_update_failed', message: err.message });
  }
});

// --- Runtime Configuration Introspection (non-secret) -----------------------
// GET /api/config/runtime -> selected non-sensitive runtime configuration values
// NOTE: Only exposes values safe for admin viewing; secrets go through /api/config/security
// ---------------- Multi-scope Auth Runtime (Phase 4) ----------------
// Persistent (filesystem JSON) multi-scope auth configuration
// Public-only fields: maxPasswordResetsPerDay, anomalyProtection
const authConfigPath = process.env.AUTH_CONFIG_FILE || path.resolve(__dirname, 'db', 'auth-config.json');
const AUTH_CONFIG_SCOPE = 'admin';
const AUTH_CONFIG_KEY = 'auth.config';

function deepMerge(to, from) {
  if (!from || typeof from !== 'object') return to;
  Object.keys(from).forEach(k => {
    const fv = from[k];
    if (fv && typeof fv === 'object' && !Array.isArray(fv)) {
      if (!to[k] || typeof to[k] !== 'object') to[k] = {};
      deepMerge(to[k], fv);
    } else {
      to[k] = fv;
    }
  });
  return to;
}

function defaultAuthConfig() {
  return {
    admin: {
      tokenTtl: { access: 3600, id: 3600, refresh: 86400, frontendIdle: 900, absolute: 28800 },
      policy: {
        mfaMode: 'optional',
        pkceRequired: true,
        passwordPolicy: { minLength: 12, requireUpper: true, requireLower: true, requireNumber: true, requireSymbol: false },
        lockout: { threshold: 5, durationSeconds: 900 },
        federation: { providers: [], lastSync: null }
      }
    },
    public: {
      tokenTtl: { access: 3600, id: 3600, refresh: 86400, frontendIdle: 900, absolute: 28800 },
      policy: {
        mfaMode: 'off',
        pkceRequired: true,
        passwordPolicy: { minLength: 12, requireUpper: true, requireLower: true, requireNumber: true, requireSymbol: false },
        lockout: { threshold: 5, durationSeconds: 900 },
        federation: { providers: [], lastSync: null },
        maxPasswordResetsPerDay: 5,
        anomalyProtection: 'standard'
      }
    }
  };
}

function loadAuthConfigFromFile() {
  try {
    if (!fs.existsSync(authConfigPath)) return null;
    const raw = fs.readFileSync(authConfigPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[auth-config] Failed reading fallback auth config file:', e.message);
    return null;
  }
}

async function ensureRuntimeConfigTable() {
  if (!pool) return;
  await pool.query("CREATE TABLE IF NOT EXISTS iset_runtime_config (id INT AUTO_INCREMENT PRIMARY KEY, scope VARCHAR(32) NOT NULL, k VARCHAR(128) NOT NULL, v JSON NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_scope_key (scope,k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
}

async function readAuthConfigFromDatabase() {
  if (!pool) return null;
  try {
    await ensureRuntimeConfigTable();
    const [rows] = await pool.query("SELECT v FROM iset_runtime_config WHERE scope = ? AND k = ? LIMIT 1", [AUTH_CONFIG_SCOPE, AUTH_CONFIG_KEY]);
    if (!rows || rows.length === 0) return null;
    let payload = rows[0].v;
    if (payload && typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (err) {
        console.warn('[auth-config] Invalid JSON in runtime_config, ignoring stored value:', err.message);
        return null;
      }
    }
    return payload && typeof payload === 'object' ? payload : null;
  } catch (e) {
    if (!isMissingTableErrorLocal(e)) {
      console.warn('[auth-config] Failed to load config from runtime_config:', e.message);
    }
    return null;
  }
}

function applyAuthConfigSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  const merged = deepMerge(defaultAuthConfig(), snapshot);
  __authConfig.admin = merged.admin;
  __authConfig.public = merged.public;
}

async function persistAuthConfig(cfg) {
  if (!cfg) return;
  const serialisable = {
    admin: cfg.admin,
    public: cfg.public,
  };
  let persistedToDb = false;
  if (pool) {
    try {
      await ensureRuntimeConfigTable();
      await pool.query(
        "INSERT INTO iset_runtime_config (scope,k,v) VALUES (?,?,CAST(? AS JSON)) ON DUPLICATE KEY UPDATE v=VALUES(v), updated_at=CURRENT_TIMESTAMP",
        [AUTH_CONFIG_SCOPE, AUTH_CONFIG_KEY, JSON.stringify(serialisable)]
      );
      persistedToDb = true;
    } catch (e) {
      console.warn('[auth-config] Persist to runtime_config failed, attempting filesystem fallback:', e.message);
    }
  }
  if (!persistedToDb) {
    try {
      const dir = path.dirname(authConfigPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = authConfigPath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(serialisable, null, 2), 'utf8');
      fs.renameSync(tmp, authConfigPath);
    } catch (e) {
      console.warn('[auth-config] Filesystem persist failed:', e.message);
    }
  }
}

const __authConfig = global.__authConfig || (global.__authConfig = defaultAuthConfig());
applyAuthConfigSnapshot(loadAuthConfigFromFile());

async function hydrateAuthConfigFromDatabase() {
  try {
    const snapshot = await readAuthConfigFromDatabase();
    if (snapshot) applyAuthConfigSnapshot(snapshot);
  } catch (e) {
    console.warn('[auth-config] Hydration from database failed:', e.message);
  }
}

function sysAdminOnly(req) {
  const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
  const devAuthBypassed = authProvider === 'cognito' && process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
  let role = req.auth?.role;
  if ((!role || devAuthBypassed) && !req.auth) {
    const hdrRole = req.get('x-dev-role') || req.get('X-Dev-Role');
    if (hdrRole) role = hdrRole;
  }
  // Normalize legacy / short group codes (e.g., "SysAdmin") to canonical display roles
  const normalizeRole = (r) => {
    if (!r) return r;
    const map = {
      SysAdmin: 'System Administrator',
      'System Administrator': 'System Administrator'
    };
    return map[r] || r;
  };
  return normalizeRole(role) === 'System Administrator';
}

app.get('/api/config/runtime', (req, res) => {
  try {
    const enabled = !!AI_KEY;
    const aiModel = (process.env.OPENROUTER_MODEL || '').trim() || 'mistralai/mistral-7b-instruct';
    const aiParams = {
      temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7'),
      top_p: parseFloat(process.env.OPENROUTER_TOP_P || '1'),
      max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '0',10) || null,
      presence_penalty: parseFloat(process.env.OPENROUTER_PRESENCE_PENALTY || '0'),
      frequency_penalty: parseFloat(process.env.OPENROUTER_FREQUENCY_PENALTY || '0')
    };
    const fallbackModels = (process.env.OPENROUTER_FALLBACK_MODELS || '').split(',').map(s=>s.trim()).filter(Boolean);
    const authProvider = String(process.env.AUTH_PROVIDER || 'none');
    const devBypass = process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
    const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const nodeEnv = process.env.NODE_ENV || 'development';
    const authAdmin = __authConfig.admin;
    const authPublic = __authConfig.public;
    res.json({
      ai: { enabled, model: aiModel, params: aiParams, fallbackModels },
      auth: { // legacy combined surface (admin-focused)
        tokenTtl: authAdmin.tokenTtl,
        mfa: { mode: authAdmin.policy.mfaMode },
        passwordPolicy: authAdmin.policy.passwordPolicy,
        lockout: authAdmin.policy.lockout,
        pkceRequired: authAdmin.policy.pkceRequired,
        devBypass,
        provider: authProvider
      },
      authAdmin: {
        provider: 'cognito',
        issuer: process.env.COGNITO_ISSUER || '',
        tokenTtl: authAdmin.tokenTtl,
        mfa: { mode: authAdmin.policy.mfaMode },
        passwordPolicy: authAdmin.policy.passwordPolicy,
        lockout: authAdmin.policy.lockout,
        pkceRequired: authAdmin.policy.pkceRequired,
        federation: authAdmin.policy.federation
      },
      authPublic: {
        provider: 'cognito',
        issuer: process.env.COGNITO_ISSUER || '',
        tokenTtl: authPublic.tokenTtl,
        mfa: { mode: authPublic.policy.mfaMode },
        passwordPolicy: authPublic.policy.passwordPolicy,
        lockout: authPublic.policy.lockout,
        pkceRequired: authPublic.policy.pkceRequired,
        federation: authPublic.policy.federation,
        maxPasswordResetsPerDay: authPublic.policy.maxPasswordResetsPerDay,
        anomalyProtection: authPublic.policy.anomalyProtection
      },
      cors: { allowedOrigins },
      env: { nodeEnv }
    });
  } catch (e) {
    res.status(500).json({ error: 'config_runtime_failed', message: e.message });
  }
});

// --- Event capture configuration (SysAdmin only) ---
app.get('/api/admin/event-types', (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const catalog = getEventCatalog().map(category => ({
      id: category.id,
      label: category.label,
      description: category.description,
      severity: category.severity,
      source: category.source || null,
      draft: Boolean(category.draft),
      locked: Boolean(category.locked),
      types: category.types.map(type => ({
        id: type.id,
        label: type.label,
        severity: type.severity,
        source: type.source || null,
        draft: Boolean(type.draft),
        locked: Boolean(type.locked)
      }))
    }));
    res.json({ categories: catalog });
  } catch (err) {
    console.error('[events] failed to load event catalog', err);
    res.status(500).json({ error: 'event_types_fetch_failed', message: err.message });
  }
});

app.get('/api/admin/event-capture-rules', async (req, res) => {
  if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
  try {
    const state = await loadEventCaptureState();
    res.json(state);
  } catch (err) {
    console.error('[events] failed to load capture rules', err);
    res.status(500).json({ error: 'event_capture_rules_fetch_failed', message: err.message });
  }
});

app.patch('/api/admin/event-capture-rules', async (req, res) => {
  if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
  try {
    const body = req.body || {};
    let updates = [];
    if (Array.isArray(body.updates)) updates = body.updates;
    else if (Array.isArray(body)) updates = body;
    else if (body.categoryId || body.category) updates = [body];
    const actorId = req.auth?.sub || req.auth?.id || req.auth?.user_id || req.get('X-Dev-UserId') || req.get('x-dev-userid') || null;
    const state = await updateEventCaptureRules(updates, actorId);
    res.json(state);
  } catch (err) {
    console.error('[events] failed to update capture rules', err);
    res.status(500).json({ error: 'event_capture_rules_update_failed', message: err.message });
  }
});


// PATCH auth session TTLs (supports scope=admin|public, fallback both if none)
app.patch('/api/config/runtime/auth-session', async (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const scope = (req.query.scope || '').toLowerCase();
    if (scope && !['admin', 'public'].includes(scope)) return res.status(400).json({ error: 'invalid_scope' });
    const ttl = (req.body || {}).tokenTtl || {};
    const apply = target => {
      ['access', 'id', 'refresh', 'frontendIdle', 'absolute'].forEach(k => { if (ttl[k] !== undefined) target.tokenTtl[k] = ttl[k]; });
    };
    if (scope) apply(__authConfig[scope]); else { apply(__authConfig.admin); apply(__authConfig.public); }
    await persistAuthConfig(__authConfig);
    res.json({ tokenTtl: scope ? __authConfig[scope].tokenTtl : { ...__authConfig.admin.tokenTtl } });
  } catch (e) { res.status(500).json({ error: 'auth_session_update_failed', message: e.message }); }
});

// PATCH auth policy (scope)
app.patch('/api/config/runtime/auth-policy', async (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const scope = (req.query.scope || '').toLowerCase();
    if (scope && !['admin', 'public'].includes(scope)) return res.status(400).json({ error: 'invalid_scope' });
    const body = req.body || {};
    const apply = target => {
      if (body.mfa && typeof body.mfa.mode === 'string') target.policy.mfaMode = body.mfa.mode;
      if (body.pkceRequired !== undefined) target.policy.pkceRequired = !!body.pkceRequired;
      if (body.passwordPolicy) target.policy.passwordPolicy = { ...target.policy.passwordPolicy, ...body.passwordPolicy };
      if (body.lockout) target.policy.lockout = { ...target.policy.lockout, ...body.lockout };
    };
    if (scope) apply(__authConfig[scope]); else { apply(__authConfig.admin); apply(__authConfig.public); }
    // Public-only fields
    if (body.maxPasswordResetsPerDay !== undefined && (!scope || scope === 'public')) {
      const target = scope ? __authConfig[scope] : __authConfig.public; // if both, only apply to public
      target.policy.maxPasswordResetsPerDay = Number(body.maxPasswordResetsPerDay) || 0;
    }
    if (body.anomalyProtection && (!scope || scope === 'public')) {
      const target = scope ? __authConfig[scope] : __authConfig.public;
      target.policy.anomalyProtection = String(body.anomalyProtection);
    }
    await persistAuthConfig(__authConfig);
    const src = scope ? __authConfig[scope] : __authConfig.admin;
    const pub = __authConfig.public;
    const base = {
      mfa: { mode: src.policy.mfaMode },
      passwordPolicy: src.policy.passwordPolicy,
      lockout: src.policy.lockout,
      pkceRequired: src.policy.pkceRequired
    };
    if (scope === 'public') {
      base.maxPasswordResetsPerDay = pub.policy.maxPasswordResetsPerDay;
      base.anomalyProtection = pub.policy.anomalyProtection;
    }
    res.json(base);
  } catch (e) { res.status(500).json({ error: 'auth_policy_update_failed', message: e.message }); }
});

// Federation sync (dummy timestamp update for now)
app.post('/api/config/runtime/auth-federation-sync', async (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const scope = (req.query.scope || '').toLowerCase();
    if (scope && !['admin', 'public'].includes(scope)) return res.status(400).json({ error: 'invalid_scope' });
    const now = new Date().toISOString();
    const apply = target => { target.policy.federation.lastSync = now; };
    if (scope) apply(__authConfig[scope]); else { apply(__authConfig.admin); apply(__authConfig.public); }
    await persistAuthConfig(__authConfig);
    res.json({ lastSync: now });
  } catch (e) { res.status(500).json({ error: 'auth_federation_sync_failed', message: e.message }); }
});

// GET /api/config/security -> secret presence + masked forms (never full secret values)
app.get('/api/config/security', (req, res) => {
  try {
    // Derive effective role (mirror logic used in ai-model PATCH for consistency)
    const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
    const devAuthBypassed = authProvider === 'cognito' && process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
    let effectiveRole = req.auth?.role || null;
    if ((!effectiveRole || devAuthBypassed) && !req.auth) {
      const hdrRole = req.get('x-dev-role') || req.get('X-Dev-Role');
      if (hdrRole) effectiveRole = hdrRole;
    }
    const MASK_LEVEL = (() => {
      if (effectiveRole === 'System Administrator') return 'admin'; // standard masked view
      if (effectiveRole === 'Program Administrator') return 'restricted'; // heavily masked
      return 'none'; // no visibility
    })();
    const baseMask = (val) => {
      if (!val) return { present: false, masked: null };
      const str = String(val);
      if (str.length <= 8) return { present: true, masked: str[0] + '***' + str.slice(-1) };
      return { present: true, masked: str.slice(0, 4) + '***' + str.slice(-4) };
    };
    const restrictedRemask = (masked) => {
      if (!masked) return null;
      // Replace all but last 2 visible chars with * to further restrict
      return masked.replace(/.(?=..$)/g, '*');
    };
    const secretDefs = [
      { key: 'OPENROUTER_API_KEY', val: process.env.OPENROUTER_API_KEY },
      { key: 'OPENROUTER_KEY', val: process.env.OPENROUTER_KEY },
      { key: 'DB_PASS', val: process.env.DB_PASS },
      { key: 'DEV_DB_KEY', val: process.env.DEV_DB_KEY },
    ];
    let secrets = [];
    if (MASK_LEVEL !== 'none') {
      secrets = secretDefs.map(s => {
        const masked = baseMask(s.val);
        if (MASK_LEVEL === 'restricted' && masked.present) {
          return { key: s.key, present: true, masked: restrictedRemask(masked.masked) };
        }
        return { key: s.key, present: masked.present, masked: masked.masked };
      });
    }
    res.json({ role: effectiveRole, visibility: MASK_LEVEL, secrets });
  } catch (e) {
    res.status(500).json({ error: 'config_security_failed', message: e.message });
  }
});

// ---------------- Session Audit (Phase 8) -----------------
// Endpoints assume audit table (created by intake service) exists in same DB.
// Protected: System Administrator only.
app.get('/api/audit/session/stats', async (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const [[agg]] = await pool.query(`SELECT COUNT(*) total, MIN(issued_at) oldest, MAX(last_seen_at) newest FROM user_session_audit`).catch(()=>[[{ total:0, oldest:null, newest:null }]]);
    const [[last24]] = await pool.query(`SELECT COUNT(DISTINCT user_id) active_users_24h, COUNT(*) rows_24h FROM user_session_audit WHERE last_seen_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`).catch(()=>[[{ active_users_24h:0, rows_24h:0 }]]);
    res.json({ total: agg.total, oldest: agg.oldest, newest: agg.newest, activeUsers24h: last24.active_users_24h, rows24h: last24.rows_24h });
  } catch (e) { res.status(500).json({ error: 'session_audit_stats_failed', message: e.message }); }
});
app.get('/api/audit/session/recent', async (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit||'50',10)));
    const [rows] = await pool.query(`SELECT user_id, session_key, issued_at, last_seen_at, ip_hash, user_agent_hash FROM user_session_audit ORDER BY last_seen_at DESC LIMIT ?`, [limit]);
    res.json({ count: rows.length, sessions: rows });
  } catch (e) { res.status(500).json({ error: 'session_audit_recent_failed', message: e.message }); }
});
app.post('/api/audit/session/prune', async (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const days = Math.min(365, Math.max(1, parseInt(req.query.days||req.body?.days||'60',10)));
    const [result] = await pool.query(`DELETE FROM user_session_audit WHERE last_seen_at < DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]);
    res.json({ pruned: result.affectedRows || 0, olderThanDays: days });
  } catch (e) { res.status(500).json({ error: 'session_audit_prune_failed', message: e.message }); }
});

app.post('/api/locks/application/:id', async (req, res) => {
  try {
    if (!req.auth || req.auth.subjectType !== 'staff') {
      return res.status(403).json({ error: 'forbidden' });
    }
    const applicationId = Number(req.params.id);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({ error: 'invalid_application_id' });
    }
    const identity = resolveLockIdentity(req);
    if (!identity.userId) {
      return res.status(400).json({ error: 'lock_identity_missing' });
    }
    const lockConfig = await readLockConfig();
    const ttlMinutesRaw = req.body?.ttlMinutes ?? req.body?.lockTtlMinutes;
    let ttlMinutes = Number(ttlMinutesRaw);
    if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {
      ttlMinutes = lockConfig.lockTtlMinutes || DEFAULT_LOCK_CONFIG.lockTtlMinutes;
    }
    ttlMinutes = Math.max(1, Math.min(240, Math.round(ttlMinutes)));
    const heartbeatMinutesRaw = Number(lockConfig.heartbeatMinutes ?? DEFAULT_LOCK_CONFIG.heartbeatMinutes);
    if (Number.isFinite(heartbeatMinutesRaw) && heartbeatMinutesRaw > 0) {
      const normalizedHeartbeat = Math.min(240, Math.max(1, Math.round(heartbeatMinutesRaw)));
      ttlMinutes = Math.max(ttlMinutes, normalizedHeartbeat);
    }
    const expiresAt = new Date(Date.now() + ttlMinutes * 60000);
    const allowForce = req.body?.force === true && sysAdminOnly(req);
    const connection = await pool.getConnection();
    let persistedLockRow = null;
    let reusedExisting = false;
    try {
      await connection.beginTransaction();
      const [[applicationRow]] = await connection.query(
        'SELECT id FROM iset_application WHERE id = ? LIMIT 1 FOR UPDATE',
        [applicationId]
      );
      if (!applicationRow) {
        await connection.rollback();
        return res.status(404).json({ error: 'application_not_found', lock: null });
      }
      const [[existing]] = await connection.query(
        'SELECT owner_user_id, owner_display_name, owner_email, expires_at FROM application_lock WHERE application_id = ? FOR UPDATE',
        [applicationId]
      );
      const now = new Date();
      if (existing) {
        const expired = !existing.expires_at || new Date(existing.expires_at) <= now;
        const sameOwner = existing.owner_user_id && existing.owner_user_id === identity.userId;
        reusedExisting = !expired && sameOwner;
        if (expired) {
          await connection.query('DELETE FROM application_lock WHERE application_id = ?', [applicationId]);
        } else if (!sameOwner) {
          if (!allowForce) {
            await connection.rollback();
            return res.status(423).json({
              error: 'locked',
              reason: 'owned_by_other',
              lock: {
                owner_user_id: existing.owner_user_id,
                owner_display_name: existing.owner_display_name,
                owner_email: existing.owner_email,
                expires_at: existing.expires_at
              }
            });
          }
        }
      }
      await connection.query(
        `INSERT INTO application_lock (application_id, owner_user_id, owner_display_name, owner_email, acquired_at, expires_at)
         VALUES (?, ?, ?, ?, NOW(), ?)
         ON DUPLICATE KEY UPDATE owner_user_id = VALUES(owner_user_id), owner_display_name = VALUES(owner_display_name),
           owner_email = VALUES(owner_email), acquired_at = NOW(), expires_at = VALUES(expires_at)`,
        [applicationId, identity.userId, identity.displayName || identity.email || identity.userId, identity.email || null, expiresAt]
      );
      const [[lockRow]] = await connection.query(
        'SELECT application_id, owner_user_id, owner_display_name, owner_email, acquired_at, expires_at FROM application_lock WHERE application_id = ? LIMIT 1',
        [applicationId]
      );
      persistedLockRow = lockRow || null;
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
    if (!persistedLockRow) {
      return res.status(500).json({ error: 'lock_acquire_failed', message: 'Lock persisted state unavailable', lock: null });
    }
    const lockPayload = {
      application_id: applicationId,
      owner_user_id: persistedLockRow.owner_user_id || identity.userId,
      owner_display_name: persistedLockRow.owner_display_name || identity.displayName || identity.email || identity.userId,
      owner_email: persistedLockRow.owner_email || identity.email || null,
      acquired_at: persistedLockRow.acquired_at ? new Date(persistedLockRow.acquired_at).toISOString() : new Date().toISOString(),
      expires_at: persistedLockRow.expires_at ? new Date(persistedLockRow.expires_at).toISOString() : expiresAt.toISOString(),
      ttl_minutes: ttlMinutes,
      heartbeat_minutes: Number(lockConfig.heartbeatMinutes ?? DEFAULT_LOCK_CONFIG.heartbeatMinutes) || null,
      reused: reusedExisting
    };
    res.json({ success: true, lock: lockPayload });
  } catch (error) {
    console.error('[locking] acquire failed:', error);
    res.status(500).json({ error: 'lock_acquire_failed', message: error.message, lock: null });
  }
});

app.delete('/api/locks/application/:id', async (req, res) => {
  try {
    if (!req.auth || req.auth.subjectType !== 'staff') {
      return res.status(403).json({ error: 'forbidden' });
    }
    const applicationId = Number(req.params.id);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({ error: 'invalid_application_id' });
    }
    const identity = resolveLockIdentity(req);
    if (!identity.userId) {
      return res.status(400).json({ error: 'lock_identity_missing' });
    }
    const allowForce = (req.query.force === 'true' || req.body?.force === true) && sysAdminOnly(req);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[applicationRow]] = await connection.query(
        'SELECT id FROM iset_application WHERE id = ? LIMIT 1 FOR UPDATE',
        [applicationId]
      );
      if (!applicationRow) {
        await connection.rollback();
        return res.status(404).json({ error: 'application_not_found', lock: null });
      }
      const [[existing]] = await connection.query(
        'SELECT owner_user_id, owner_display_name, owner_email, expires_at FROM application_lock WHERE application_id = ? FOR UPDATE',
        [applicationId]
      );
      const now = new Date();
      if (!existing) {
        await connection.commit();
        return res.json({ released: false, lock: null });
      }
      const expired = !existing.expires_at || new Date(existing.expires_at) <= now;
      const sameOwner = existing.owner_user_id && existing.owner_user_id === identity.userId;
      if (!expired && !sameOwner && !allowForce) {
        await connection.rollback();
        return res.status(423).json({
          error: 'locked',
          reason: 'owned_by_other',
          lock: {
            owner_user_id: existing.owner_user_id,
            owner_display_name: existing.owner_display_name,
            owner_email: existing.owner_email,
            expires_at: existing.expires_at
          }
        });
      }
      await connection.query('DELETE FROM application_lock WHERE application_id = ?', [applicationId]);
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
    res.json({ released: true, lock: null });
  } catch (error) {
    console.error('[locking] release failed:', error);
    res.status(500).json({ error: 'lock_release_failed', message: error.message, lock: null });
  }
});

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  charset: 'utf8mb4_general_ci'
};

pool = mysql.createPool(dbConfig);
hydrateAuthConfigFromDatabase().catch(err => {
  console.warn('[auth-config] Initial hydration failed:', err.message);
});

app.get('/api/config/sla-targets', async (req, res) => {
  try {
    if (!hasSlaAdminAccess(req)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const targets = await fetchActiveSlaTargets(pool);
    const normalized = targets.map(normalizeSlaTarget).filter(Boolean);
    res.json({ targets: normalized });
  } catch (e) {
    console.error('[sla-targets] fetch failed:', e.message);
    res.status(500).json({ error: 'sla_targets_fetch_failed', message: e.message });
  }
});

app.put('/api/config/sla-targets/:id', async (req, res) => {
  try {
    if (!hasSlaAdminAccess(req)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'invalid_target_id' });
    }
    const existing = await fetchSlaTargetById(pool, id);
    if (!existing) {
      return res.status(404).json({ error: 'target_not_found' });
    }
    if (existing.active_to) {
      return res.status(409).json({ error: 'target_inactive' });
    }
    const body = req.body || {};
    const hoursRaw = body.target_hours ?? body.targetHours;
    if (hoursRaw === null || typeof hoursRaw === 'undefined') {
      return res.status(400).json({ error: 'target_hours_required' });
    }
    const targetHours = Number(hoursRaw);
    if (!Number.isFinite(targetHours) || !Number.isInteger(targetHours) || targetHours <= 0) {
      return res.status(400).json({ error: 'target_hours_invalid' });
    }
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const actorLabel = resolveActorLabel(req);
    await pool.query(
      'UPDATE sla_stage_target SET target_hours = ?, description = ?, updated_by = ? WHERE id = ? AND active_to IS NULL',
      [targetHours, description || null, actorLabel, id]
    );
    const updated = await fetchSlaTargetById(pool, id);
    res.json({ ok: true, target: normalizeSlaTarget(updated) });
  } catch (e) {
    console.error('[sla-targets] update failed:', e.message);
    res.status(500).json({ error: 'sla_target_update_failed', message: e.message });
  }
});

app.post('/api/config/sla-targets', async (req, res) => {
  let connection;
  try {
    if (!hasSlaAdminAccess(req)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const body = req.body || {};
    const stageKey = String(body.stage_key || body.stage || '').trim();
    if (!stageKey) {
      return res.status(400).json({ error: 'stage_key_required' });
    }
    const hoursRaw = body.target_hours ?? body.targetHours;
    if (hoursRaw === null || typeof hoursRaw === 'undefined') {
      return res.status(400).json({ error: 'target_hours_required' });
    }
    const targetHours = Number(hoursRaw);
    if (!Number.isFinite(targetHours) || !Number.isInteger(targetHours) || targetHours <= 0) {
      return res.status(400).json({ error: 'target_hours_invalid' });
    }
    const appliesToRoleRaw = body.applies_to_role ?? body.appliesToRole ?? null;
    const appliesToRole = typeof appliesToRoleRaw === 'string' && appliesToRoleRaw.trim() ? appliesToRoleRaw.trim() : null;
    const displayNameRaw = body.display_name || body.displayName || SLA_STAGE_LABELS[stageKey] || stageKey;
    const displayName = typeof displayNameRaw === 'string' && displayNameRaw.trim() ? displayNameRaw.trim() : stageKey;
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const actorLabel = resolveActorLabel(req);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query(
      `UPDATE sla_stage_target
       SET active_to = NOW(), updated_by = ?
       WHERE stage_key = ?
         AND active_to IS NULL
         AND (
           (applies_to_role IS NULL AND ? IS NULL)
           OR applies_to_role = ?
         )`,
      [actorLabel, stageKey, appliesToRole, appliesToRole]
    );
    const [result] = await connection.query(
      `INSERT INTO sla_stage_target (stage_key, display_name, target_hours, description, applies_to_role, is_default, created_by, updated_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        stageKey,
        displayName,
        targetHours,
        description || null,
        appliesToRole || null,
        appliesToRole ? 0 : 1,
        actorLabel,
        actorLabel
      ]
    );
    await connection.commit();
    const created = await fetchSlaTargetById(pool, result.insertId);
    res.status(201).json({ ok: true, target: normalizeSlaTarget(created) });
  } catch (e) {
    if (connection) {
      try { await connection.rollback(); } catch { /* ignore */ }
    }
    console.error('[sla-targets] create failed:', e.message);
    res.status(500).json({ error: 'sla_target_create_failed', message: e.message });
  } finally {
    if (connection) connection.release();
  }
});



app.get('/api/dashboard/application-work-queue', async (req, res) => {
  let role = inferUserRole(req) || 'Guest';
  const iamModeHeader = (req.get('X-Iam-Mode') || req.get('x-iam-mode') || req.headers['x-iam-mode'] || '').toLowerCase();
  if (iamModeHeader === 'off') {
    const simRole = req.get('X-Dev-Role') || req.get('x-dev-role') || null;
    if (simRole) {
      role = simRole;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[work-queue][role]', {
      iamMode: iamModeHeader,
      headerRole: req.get('X-Dev-Role') || req.get('x-dev-role') || null,
      resolvedRole: role,
      staffRole: req.staffProfile?.primary_role || null,
      authRole: req.auth?.role || null
    });
  }

  try {
    if (role === 'Program Administrator') {
      const [newSubmissionCount, unassignedCount, inAssessmentCount, awaitingDecisionCount, onHoldCount, overdueCount] = await Promise.all([
        countProgramAdminNewSubmissions(pool),
        countProgramAdminUnassignedBacklog(pool),
        countProgramAdminInAssessment(pool),
        countProgramAdminAwaitingDecision(pool),
        countProgramAdminOnHold(pool),
        countProgramAdminOverdue(pool)
      ]);
      const metaNew = WORK_QUEUE_BUCKET_META['new-submissions'];
      const metaUnassigned = WORK_QUEUE_BUCKET_META['unassigned'];
      const metaAssessment = WORK_QUEUE_BUCKET_META['in-assessment'];
      const metaDecision = WORK_QUEUE_BUCKET_META['awaiting-decision'];
      const metaOnHold = WORK_QUEUE_BUCKET_META['on-hold'];
      return res.json({
        role,
        generatedAt: new Date().toISOString(),
        buckets: [
          {
            id: 'new-submissions',
            label: metaNew?.label || 'New submissions',
            description: metaNew?.description || null,
            count: newSubmissionCount
          },
          {
            id: 'unassigned',
            label: metaUnassigned?.label || 'Unassigned backlog',
            description: metaUnassigned?.description || null,
            count: unassignedCount
          },
          {
            id: 'in-assessment',
            label: metaAssessment?.label || 'In assessment',
            description: metaAssessment?.description || null,
            count: inAssessmentCount
          },
          {
            id: 'awaiting-decision',
            label: metaDecision?.label || 'Awaiting program decision',
            description: metaDecision?.description || null,
            count: awaitingDecisionCount
          },
          {
            id: 'on-hold',
            label: metaOnHold?.label || 'On hold / info requested',
            description: metaOnHold?.description || null,
            count: onHoldCount
          },
          {
            id: 'overdue',
            label: WORK_QUEUE_BUCKET_META['overdue']?.label || 'Overdue',
            description: WORK_QUEUE_BUCKET_META['overdue']?.description || null,
            count: overdueCount
          }
        ]
      });
    }

    if (role === 'Regional Coordinator') {
      const metaRegion = WORK_QUEUE_BUCKET_META['region-queue'];
      const metaNeeds = WORK_QUEUE_BUCKET_META['needs-reassignment'];
      const metaAwaiting = WORK_QUEUE_BUCKET_META['awaiting-info'];
      const metaDueWeek = WORK_QUEUE_BUCKET_META['due-this-week'];
      const metaOverdue = WORK_QUEUE_BUCKET_META['overdue'];

      let regionQueueCount = 0;
      let needsReassignmentCount = 0;
      let awaitingInfoCount = 0;
      let dueThisWeekCount = 0;
      let overdueCount = 0;

      const context = await resolveRegionalCoordinatorContext(req);
      if (context?.valid) {
        const { staffIds, staffProfileId, regionId } = context;
        const contextParams = { staffProfileId, regionId };
        [
          regionQueueCount,
          needsReassignmentCount,
          awaitingInfoCount,
          dueThisWeekCount,
          overdueCount
        ] = await Promise.all([
          countRegionalAssignedToRegion(pool, staffIds, contextParams),
          countRegionalNeedsReassignment(pool, staffProfileId),
          countRegionalAwaitingApplicantInfo(pool, staffIds),
          countRegionalDueThisWeek(pool, staffIds),
          countRegionalOverdue(pool, staffIds)
        ]);
      } else if (process.env.NODE_ENV !== 'production') {
        console.log('[work-queue][regional] context invalid', context);
      }

      return res.json({
        role,
        generatedAt: new Date().toISOString(),
        buckets: [
          {
            id: 'region-queue',
            label: metaRegion?.label || 'Assigned to my region',
            description: metaRegion?.description || null,
            count: regionQueueCount
          },
          {
            id: 'needs-reassignment',
            label: metaNeeds?.label || 'Assigned to me',
            description: metaNeeds?.description || null,
            count: needsReassignmentCount
          },
          {
            id: 'awaiting-info',
            label: metaAwaiting?.label || 'Awaiting applicant info',
            description: metaAwaiting?.description || null,
            count: awaitingInfoCount
          },
          {
            id: 'due-this-week',
            label: metaDueWeek?.label || 'Due this week',
            description: metaDueWeek?.description || null,
            count: dueThisWeekCount
          },
          {
            id: 'overdue',
            label: metaOverdue?.label || 'Overdue',
            description: metaOverdue?.description || null,
            count: overdueCount
          }
        ]
      });
    }

    if (role === 'Application Assessor') {
      const metaAssigned = WORK_QUEUE_BUCKET_META['assigned-to-me'];
      const metaDueToday = WORK_QUEUE_BUCKET_META['due-today'];
      const metaAwaitingApplicant = WORK_QUEUE_BUCKET_META['awaiting-applicant'];
      const metaOverdue = WORK_QUEUE_BUCKET_META['overdue'];

      let assignedCount = 0;
      let dueTodayCount = 0;
      let awaitingApplicantCount = 0;
      let overdueCount = 0;

      const context = await resolveApplicationAssessorContext(req);
      if (context?.valid && context.staffProfileId) {
        const staffId = context.staffProfileId;
        [
          assignedCount,
          dueTodayCount,
          awaitingApplicantCount,
          overdueCount
        ] = await Promise.all([
          countAssessorAssignedToMe(pool, staffId),
          countAssessorDueToday(pool, staffId),
          countAssessorAwaitingApplicantResponse(pool, staffId),
          countAssessorOverdue(pool, staffId)
        ]);
      } else if (process.env.NODE_ENV !== 'production') {
        console.log('[work-queue][assessor] context invalid', context);
      }

      return res.json({
        role,
        generatedAt: new Date().toISOString(),
        buckets: [
          {
            id: 'assigned-to-me',
            label: metaAssigned?.label || 'Assigned to me',
            description: metaAssigned?.description || null,
            count: assignedCount
          },
          {
            id: 'due-today',
            label: metaDueToday?.label || 'Due today',
            description: metaDueToday?.description || null,
            count: dueTodayCount
          },
          {
            id: 'awaiting-applicant',
            label: metaAwaitingApplicant?.label || 'Awaiting applicant response',
            description: metaAwaitingApplicant?.description || null,
            count: awaitingApplicantCount
          },
          {
            id: 'overdue',
            label: metaOverdue?.label || 'Overdue',
            description: metaOverdue?.description || null,
            count: overdueCount
          }
        ]
      });
    }

    return res.json({
      role,
      generatedAt: new Date().toISOString(),
      buckets: []
    });
  } catch (e) {
    console.error('[work-queue] fetch failed:', e.message);
    res.status(500).json({ error: 'application_work_queue_fetch_failed', message: e.message });
  }
});




const eventService = createEventService({ pool, logger: console });
registerNotificationHook(async (event) => {
  await dispatchInternalNotifications({ pool, event, logger: console });
});

const emitEvent = eventService.emit;
const emitCaseEventSdk = eventService.emitCaseEvent;
const getCaseEvents = eventService.getCaseTimeline;
const getEventFeed = eventService.getEventFeed;
const markEventRead = eventService.markRead;
const loadEventCaptureState = eventService.loadCaptureState;
const updateEventCaptureRules = eventService.updateCaptureRules;
const getEventCatalog = eventService.getCatalog;

async function deleteTableIfExists(tableName) {
  try {
    await pool.query(`DELETE FROM ${tableName}`);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      console.warn(`[purge] skipped missing table ${tableName}`);
      return;
    }
    throw err;
  }
}


const getAuthenticatedNumericUserId = (req) => {
  if (!req) return null;
  const values = [];
  if (req.auth) {
    values.push(req.auth.userId);
    values.push(req.auth.user_id);
    values.push(req.auth.id);
  }
  if (typeof req.get === 'function') {
    values.push(req.get('X-Dev-UserId'));
    values.push(req.get('x-dev-userid'));
  }
  for (const value of values) {
    if (value == null) continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return null;
};

const CASE_NOTE_MAX_LENGTH = 5000;

const CASE_NOTE_SELECT = `
  SELECT
    n.id,
    n.case_id,
    n.body,
    n.is_internal,
    n.is_pinned,
    n.follow_up_at,
    n.reminder_id,
    n.created_at,
    n.updated_at,
    n.edited_at,
    n.author_staff_profile_id,
    n.author_user_id,
    sp.display_name AS author_display_name,
    sp.name AS author_name,
    sp.primary_role AS author_role,
    sp.email AS author_email,
    au.email AS author_user_email,
    n.edited_by_staff_profile_id,
    esp.display_name AS editor_display_name,
    esp.name AS editor_name,
    esp.primary_role AS editor_role,
    esp.email AS editor_email,
    n.edited_by_user_id,
    eu.email AS editor_user_email
  FROM iset_case_note n
  LEFT JOIN staff_profiles sp ON sp.id = n.author_staff_profile_id
  LEFT JOIN user au ON au.id = n.author_user_id
  LEFT JOIN staff_profiles esp ON esp.id = n.edited_by_staff_profile_id
  LEFT JOIN user eu ON eu.id = n.edited_by_user_id`;

const mapCaseNoteRow = (row = {}) => {
  if (!row || Object.keys(row).length === 0) return null;
  const authorDisplay = row.author_display_name || row.author_name || null;
  const editorDisplay = row.editor_display_name || row.editor_name || null;
  const mapped = {
    id: row.id,
    caseId: row.case_id,
    body: row.body,
    isInternal: row.is_internal == null ? true : row.is_internal === 1,
    isPinned: row.is_pinned === 1,
    followUpAt: row.follow_up_at || null,
    reminderId: row.reminder_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    editedAt: row.edited_at || null,
    author: {
      staffProfileId: row.author_staff_profile_id || null,
      userId: row.author_user_id || null,
      displayName: authorDisplay,
      name: row.author_name || null,
      email: row.author_email || row.author_user_email || null,
      role: row.author_role || null
    }
  };
  if (row.edited_at) {
    mapped.editor = {
      staffProfileId: row.edited_by_staff_profile_id || null,
      userId: row.edited_by_user_id || null,
      displayName: editorDisplay,
      name: row.editor_name || null,
      email: row.editor_email || row.editor_user_email || null,
      role: row.editor_role || null
    };
  } else {
    mapped.editor = null;
  }
  return mapped;
};

const fetchCaseNotesForCase = async (caseId) => {
  const sql = `${CASE_NOTE_SELECT}\n WHERE n.case_id = ? AND n.deleted_at IS NULL\n ORDER BY n.is_pinned DESC, n.created_at DESC`;
  const [rows] = await pool.query(sql, [caseId]);
  return rows.map(mapCaseNoteRow);
};

const fetchCaseNoteById = async (caseId, noteId) => {
  const sql = `${CASE_NOTE_SELECT}\n WHERE n.case_id = ? AND n.id = ? AND n.deleted_at IS NULL\n LIMIT 1`;
  const [rows] = await pool.query(sql, [caseId, noteId]);
  return rows.length ? mapCaseNoteRow(rows[0]) : null;
};

const REMINDER_ALLOWED_STATUSES = new Set(['open', 'completed', 'cancelled']);
const REMINDER_METADATA_ERROR = 'ERR_INVALID_REMINDER_METADATA';
const REMINDER_DATE_ERROR = 'ERR_INVALID_REMINDER_DATE';

const coerceOptionalPositiveInt = (value) => {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  const token = typeof value === 'string' ? value.trim() : value;
  if (token === '') return null;
  const numeric = Number(token);
  if (!Number.isFinite(numeric)) return Number.NaN;
  const intValue = Math.trunc(numeric);
  if (!Number.isInteger(intValue) || intValue <= 0) return Number.NaN;
  return intValue;
};

const coerceOptionalNonNegativeInt = (value) => {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  const token = typeof value === 'string' ? value.trim() : value;
  if (token === '') return null;
  const numeric = Number(token);
  if (!Number.isFinite(numeric)) return Number.NaN;
  const intValue = Math.trunc(numeric);
  if (!Number.isInteger(intValue) || intValue < 0) return Number.NaN;
  return intValue;
};

const parseBooleanFlag = (value, defaultValue = false) => {
  if (typeof value === 'undefined') return defaultValue;
  if (value === null) return false;
  const token = String(value).trim().toLowerCase();
  if (!token) return false;
  if (token === '1' || token === 'true' || token === 'yes' || token === 'y' || token === 'on') return true;
  if (token === '0' || token === 'false' || token === 'no' || token === 'n' || token === 'off') return false;
  return defaultValue;
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const normaliseReminderStatus = (value, fallback = 'open', options = {}) => {
  const { allowAll = false } = options;
  if (value === undefined || value === null) return fallback;
  const token = String(value).trim().toLowerCase();
  if (!token) return fallback;
  if (token === 'all') {
    return allowAll ? null : undefined;
  }
  return REMINDER_ALLOWED_STATUSES.has(token) ? token : undefined;
};

const parseReminderDateInput = (value, fieldName = null) => {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error('invalid_date');
    err.code = REMINDER_DATE_ERROR;
    if (fieldName) err.field = fieldName;
    throw err;
  }
  return date;
};

const encodeReminderMetadataValue = (value) => {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(trimmed);
    }
  }
  try {
    return JSON.stringify(value);
  } catch (err) {
    const metadataError = new Error('invalid_metadata');
    metadataError.code = REMINDER_METADATA_ERROR;
    throw metadataError;
  }
};

const resolveReminderMetadataInput = (body = {}) => {
  if (Object.prototype.hasOwnProperty.call(body, 'metadata')) {
    return encodeReminderMetadataValue(body.metadata);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'metadataJson')) {
    const value = body.metadataJson;
    if (value === null) return null;
    if (typeof value !== 'string') {
      const err = new Error('invalid_metadata');
      err.code = REMINDER_METADATA_ERROR;
      throw err;
    }
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      const err = new Error('invalid_metadata');
      err.code = REMINDER_METADATA_ERROR;
      throw err;
    }
  }
  return undefined;
};

const mapReminderStaffProfile = (row, prefix) => {
  if (!row) return null;
  const idKey = `${prefix}_staff_profile_id`;
  const id = row[idKey] || null;
  if (!id) return null;
  return {
    staffProfileId: id,
    displayName: row[`${prefix}_display_name`] || row[`${prefix}_name`] || null,
    name: row[`${prefix}_name`] || null,
    role: row[`${prefix}_role`] || null,
    email: row[`${prefix}_email`] || null
  };
};

const REMINDER_SELECT = `
  SELECT
    r.id,
    r.case_id,
    r.application_id,
    r.action_plan_id,
    r.intervention_id,
    r.title,
    r.description,
    r.category,
    r.status,
    r.due_at,
    r.completed_at,
    r.completed_by_staff_profile_id,
    r.assigned_staff_profile_id,
    r.metadata_json,
    r.created_at,
    r.created_by_staff_profile_id,
    r.updated_at,
    r.updated_by_staff_profile_id,
    r.deleted_at,
    assigned.display_name AS assigned_display_name,
    assigned.name AS assigned_name,
    assigned.primary_role AS assigned_role,
    assigned.email AS assigned_email,
    completed.display_name AS completed_by_display_name,
    completed.name AS completed_by_name,
    completed.primary_role AS completed_by_role,
    completed.email AS completed_by_email,
    created.display_name AS created_by_display_name,
    created.name AS created_by_name,
    created.primary_role AS created_by_role,
    created.email AS created_by_email,
    updated.display_name AS updated_by_display_name,
    updated.name AS updated_by_name,
    updated.primary_role AS updated_by_role,
    updated.email AS updated_by_email
  FROM iset_case_reminder r
  LEFT JOIN staff_profiles assigned ON assigned.id = r.assigned_staff_profile_id
  LEFT JOIN staff_profiles completed ON completed.id = r.completed_by_staff_profile_id
  LEFT JOIN staff_profiles created ON created.id = r.created_by_staff_profile_id
  LEFT JOIN staff_profiles updated ON updated.id = r.updated_by_staff_profile_id`;

const mapReminderRow = (row = {}) => {
  if (!row || Object.keys(row).length === 0) return null;
  return {
    id: row.id,
    caseId: row.case_id || null,
    applicationId: row.application_id || null,
    actionPlanId: row.action_plan_id || null,
    interventionId: row.intervention_id || null,
    title: row.title,
    description: row.description || null,
    category: row.category || null,
    status: row.status,
    dueAt: row.due_at || null,
    completedAt: row.completed_at || null,
    completedByStaffProfileId: row.completed_by_staff_profile_id || null,
    assignedStaffProfileId: row.assigned_staff_profile_id || null,
    metadata: safeJsonParse(row.metadata_json, null),
    createdAt: row.created_at || null,
    createdByStaffProfileId: row.created_by_staff_profile_id || null,
    updatedAt: row.updated_at || null,
    updatedByStaffProfileId: row.updated_by_staff_profile_id || null,
    deletedAt: row.deleted_at || null,
    assignedTo: mapReminderStaffProfile(row, 'assigned'),
    completedBy: mapReminderStaffProfile(row, 'completed_by'),
    createdBy: mapReminderStaffProfile(row, 'created_by'),
    updatedBy: mapReminderStaffProfile(row, 'updated_by')
  };
};

const fetchReminderById = async (reminderId) => {
  const sql = `${REMINDER_SELECT}\n WHERE r.id = ? AND r.deleted_at IS NULL\n LIMIT 1`;
  const [rows] = await pool.query(sql, [reminderId]);
  return rows.length ? mapReminderRow(rows[0]) : null;
};

const listReminders = async (options = {}) => {
  const { caseId, applicationId, includeGlobal = false, statuses = [], limit, offset } = options;
  const conditions = ['r.deleted_at IS NULL'];
  const params = [];
  const scopeClauses = [];

  if (Number.isInteger(caseId) && caseId > 0) {
    scopeClauses.push('r.case_id = ?');
    params.push(caseId);
  }
  if (Number.isInteger(applicationId) && applicationId > 0) {
    scopeClauses.push('r.application_id = ?');
    params.push(applicationId);
  }
  if (includeGlobal) {
    scopeClauses.push('(r.case_id IS NULL AND r.application_id IS NULL)');
  }
  if (scopeClauses.length) {
    conditions.push(`(${scopeClauses.join(' OR ')})`);
  }
  if (Array.isArray(statuses) && statuses.length) {
    const placeholders = statuses.map(() => '?').join(',');
    conditions.push(`r.status IN (${placeholders})`);
    params.push(...statuses);
  }

  let sql = `${REMINDER_SELECT}\n`;
  if (conditions.length) {
    sql += `WHERE ${conditions.join('\n  AND ')}\n`;
  }
  sql += 'ORDER BY r.due_at IS NULL ASC, r.due_at ASC, r.id DESC';

  const limitIsValid = Number.isInteger(limit) && limit > 0;
  const offsetIsValid = Number.isInteger(offset) && offset >= 0;
  if (limitIsValid) {
    sql += ' LIMIT ?';
    params.push(limit);
    if (offsetIsValid) {
      sql += ' OFFSET ?';
      params.push(offset);
    }
  }

  const [rows] = await pool.query(sql, params);
  return rows.map(mapReminderRow);
};

const NOTE_REMINDER_CATEGORY = 'Case note follow-up';

const deriveReminderTitleFromNote = (body = '') => {
  if (!body) return 'Case follow-up';
  const text = String(body).trim();
  if (!text) return 'Case follow-up';
  const firstLine = text.split(/\r?\n/).find(line => line.trim());
  const value = (firstLine || text).trim();
  if (value.length <= 120) return value;
  return `${value.slice(0, 117)}...`;
};

const deriveReminderDescriptionFromNote = (body = '') => {
  if (!body) return null;
  const text = String(body).trim();
  if (!text) return null;
  return text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
};

const buildNoteReminderMetadata = (noteId) =>
  JSON.stringify({
    source: 'case_note',
    case_note_id: noteId,
  });

const loadCaseIdentifiers = async (connection, caseId) => {
  const [[row]] = await connection.query(
    'SELECT id, application_id FROM iset_case WHERE id = ? LIMIT 1',
    [caseId]
  );
  return row || null;
};

const createReminderForCaseNote = async (connection, { caseId, applicationId, noteId, noteBody, dueAt, staffProfileId }) => {
  if (!dueAt) return null;
  const title = deriveReminderTitleFromNote(noteBody);
  const description = deriveReminderDescriptionFromNote(noteBody);
  const metadataJson = buildNoteReminderMetadata(noteId);
  const actorId = Number.isInteger(staffProfileId) && staffProfileId > 0 ? staffProfileId : null;
  const assignedId = actorId;
  const sql = `INSERT INTO iset_case_reminder
    (case_id, application_id, title, description, category, status, due_at, assigned_staff_profile_id, metadata_json, created_by_staff_profile_id, updated_by_staff_profile_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
  const params = [
    caseId,
    applicationId ?? null,
    title,
    description,
    NOTE_REMINDER_CATEGORY,
    'open',
    dueAt,
    assignedId,
    metadataJson,
    actorId,
    actorId,
  ];
  const [result] = await connection.query(sql, params);
  return result.insertId;
};

const updateReminderForCaseNote = async (connection, reminderId, { noteId, noteBody, dueAt, staffProfileId }) => {
  if (!reminderId) return null;
  const title = deriveReminderTitleFromNote(noteBody);
  const description = deriveReminderDescriptionFromNote(noteBody);
  const metadataJson = buildNoteReminderMetadata(noteId);
  const actorId = Number.isInteger(staffProfileId) && staffProfileId > 0 ? staffProfileId : null;
  const sql = `UPDATE iset_case_reminder
    SET title = ?, description = ?, category = ?, status = 'open', due_at = ?, completed_at = NULL, completed_by_staff_profile_id = NULL,
        assigned_staff_profile_id = ?, metadata_json = ?, updated_by_staff_profile_id = ?, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL`;
  const params = [
    title,
    description,
    NOTE_REMINDER_CATEGORY,
    dueAt,
    actorId,
    metadataJson,
    actorId,
    reminderId,
  ];
  const [result] = await connection.query(sql, params);
  if (!result.affectedRows) {
    return null;
  }
  return reminderId;
};

const cancelReminderForCaseNote = async (connection, reminderId, staffProfileId) => {
  if (!reminderId) return;
  const actorId = Number.isInteger(staffProfileId) && staffProfileId > 0 ? staffProfileId : null;
  await connection.query(
    `UPDATE iset_case_reminder
       SET status = 'cancelled',
           deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           updated_by_staff_profile_id = COALESCE(?, updated_by_staff_profile_id)
     WHERE id = ? AND deleted_at IS NULL`,
    [actorId, reminderId]
  );
};

// --- Simple SQL Migration Runner (auto-executes .sql files in /sql once) -----------------
// Strategy:
// 1. Ensure tracking table `iset_migration` (id, filename, checksum, applied_at, duration_ms, success, error_snippet).
// 2. Read all *.sql files in ./sql (non-recursive), sort by filename asc.
// 3. For each file, compute SHA256 checksum. If filename+checksum already recorded with success=1, skip.
// 4. Execute file contents via single multi-statement split on /;\n/ boundaries (basic splitter ignoring inside strings is overkill here; assume migration scripts are simple). If any statement fails, record failure (first 500 chars of error) and stop further execution to avoid partial ordering surprises.
// 5. Log summary.
// ENV Controls:
//   DISABLE_AUTO_MIGRATIONS=true -> skip runner.
//   AUTO_MIGRATIONS_DRY_RUN=true -> report pending without executing.
// Notes: idempotency encouraged inside scripts; runner only executes once per checksum.
(async () => {
  try {
    if (String(process.env.DISABLE_AUTO_MIGRATIONS || 'false').toLowerCase() === 'true') {
      console.log('[migrations] Auto migration runner disabled via DISABLE_AUTO_MIGRATIONS');
      return;
    }
    const sqlDir = path.join(__dirname, 'sql');
    if (!fs.existsSync(sqlDir)) {
      console.log('[migrations] No sql directory present, skipping');
      return;
    }
    await pool.query(`CREATE TABLE IF NOT EXISTS iset_migration (\n      id INT AUTO_INCREMENT PRIMARY KEY,\n      filename VARCHAR(255) NOT NULL,\n      checksum CHAR(64) NOT NULL,\n      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      duration_ms INT NOT NULL,\n      success TINYINT(1) NOT NULL DEFAULT 1,\n      error_snippet TEXT NULL,\n      UNIQUE KEY uniq_filename_checksum (filename, checksum)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    const [appliedRows] = await pool.query('SELECT filename, checksum, success FROM iset_migration');
    const appliedMap = new Map(appliedRows.map(r => [r.filename + '|' + r.checksum, r]));
    const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort();
    if (!files.length) { console.log('[migrations] No .sql files found'); return; }
    const crypto = require('crypto');
    const pending = [];
    for (const file of files) {
      const full = path.join(sqlDir, file);
      const content = fs.readFileSync(full, 'utf8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      if (appliedMap.has(file + '|' + checksum)) continue; // already applied this exact content
      pending.push({ file, full, content, checksum });
    }
    if (!pending.length) { console.log('[migrations] No pending migrations'); return; }
    const dryRun = String(process.env.AUTO_MIGRATIONS_DRY_RUN || 'false').toLowerCase() === 'true';
    if (dryRun) {
      console.log('[migrations] DRY RUN pending migrations:', pending.map(p => p.file));
      return;
    }
    console.log('[migrations] Applying', pending.length, 'migration(s):', pending.map(p => p.file).join(', '));
    for (const m of pending) {
      const start = Date.now();
      let success = 0; let errorSnippet = null;
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const statements = m.content
          .split(/;\s*(?:\n|$)/) // split on semicolon followed by newline or EOF
          .map(s => s.trim())
          .filter(s => s.length);
        for (const stmt of statements) {
          try {
            await connection.query(stmt);
          } catch (inner) {
            if (inner && /Duplicate column name/i.test(inner.message || '')) {
              console.warn(`[migrations] Skipping duplicate column statement in ${m.file}`);
              continue;
            }
            if (inner && /Duplicate key name/i.test(inner.message || '')) {
              console.warn(`[migrations] Skipping duplicate index statement in ${m.file}`);
              continue;
            }
            if (inner && /ER_NO_SUCH_TABLE/.test(inner.code || '') ) {
              console.warn(`[migrations] Missing table for statement in ${m.file}: ${inner.message}`);
              continue;
            }
            throw inner;
          }
        }
        await connection.commit();
        success = 1;
        console.log(`[migrations] Applied ${m.file} (${statements.length} statements)`);
      } catch (e) {
        errorSnippet = (e && e.message ? e.message : String(e)).slice(0, 500);
        try { await connection.rollback(); } catch (_) {}
        console.error(`[migrations] FAILED ${m.file}:`, errorSnippet);
      } finally {
        connection.release();
      }
      const duration = Date.now() - start;
      await pool.query('INSERT INTO iset_migration (filename, checksum, duration_ms, success, error_snippet) VALUES (?,?,?,?,?)', [m.file, m.checksum, duration, success, errorSnippet]);
      if (!success) {
        console.error('[migrations] Halting further migrations due to failure');
        break;
      }
    }
  } catch (err) {
    console.error('[migrations] Runner unexpected error:', err.message);
  }
})();

// --- Startup DB diagnostic (enable/disable via ENABLE_DB_DIAG env var; defaults to true) ---------
// Logs which physical MySQL instance we're connected to plus a quick summary of the step table.
// This helps detect situations where manual SQL sessions and the Node process point at different instances.
// Safe / read-only. To silence, set ENABLE_DB_DIAG=false in the environment.
(async () => {
  if (String(process.env.ENABLE_DB_DIAG || 'true').toLowerCase() === 'true') {
    try {
      const [[meta]] = await pool.query('SELECT @@hostname AS host, @@port AS port, DATABASE() AS db');
      const [[counts]] = await pool.query('SELECT COUNT(*) AS stepCount, COALESCE(MAX(id),0) AS maxStepId FROM iset_intake.step');
      const [recent] = await pool.query('SELECT id, name, status FROM iset_intake.step ORDER BY id DESC LIMIT 5');
      console.log('[DB-DIAG]', JSON.stringify({
        host: meta.host,
        port: meta.port,
        database: meta.db,
        stepCount: counts.stepCount,
        maxStepId: counts.maxStepId,
        recentSteps: recent.map(r => ({ id: r.id, name: r.name, status: r.status }))
      }));
    } catch (e) {
      console.warn('[DB-DIAG] failed:', e && e.message ? e.message : e);
    }
  }
})();

// ---------------- Component Template Validation (initial: radio) -----------------
// We load JSON Schemas from src/component-lib/schemas. For now we focus on radio.
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, strict: false });
const schemaCache = {};
function loadSchemaIfNeeded(key) {
  if (schemaCache[key]) return schemaCache[key];
  try {
    const schemaPath = path.join(__dirname, 'src', 'component-lib', 'schemas', `${key}.schema.json`);
    if (fs.existsSync(schemaPath)) {
      const raw = fs.readFileSync(schemaPath, 'utf8');
      const json = JSON.parse(raw);
      schemaCache[key] = ajv.compile(json);
      return schemaCache[key];
    }
  } catch (e) {
    console.warn(`[schema] Failed loading schema for ${key}:`, e.message);
  }
  schemaCache[key] = null; // cache miss to avoid repeated fs hits
  return null;
}

function validateTemplatePayload(templateKey, payloadProps) {
  const validate = loadSchemaIfNeeded(templateKey);
  if (!validate) return { ok: true }; // no schema -> allow (future components)
  const valid = validate(payloadProps);
  if (valid) return { ok: true };
  return {
    ok: false,
    errors: (validate.errors || []).map(e => ({
      instancePath: e.instancePath,
      message: e.message,
      keyword: e.keyword,
      params: e.params
    }))
  };
}

// Sync radio template from filesystem source of truth if drift (latest-only approach)
// This does NOT create historical versions; it updates latest in-place given pre-release status.
async function syncRadioTemplateFromFile() {
  try {
    const filePath = path.join(__dirname, 'src', 'component-lib', 'radio.template.json');
    if (!fs.existsSync(filePath)) return;
    const fileJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // Always target latest (highest version then highest id) so admin UI (which selects latest) stays in sync
    const [rows] = await pool.query('SELECT * FROM component_templates WHERE template_key = ? ORDER BY version DESC, id DESC LIMIT 1', ['radio']).catch(() => [null]);
    let row = rows && rows.length ? rows[0] : null;
    if (!row) {
      // Fallback: singular table name
      const [rowsAlt] = await pool.query('SELECT * FROM component_template WHERE template_key = ? ORDER BY version DESC, id DESC LIMIT 1', ['radio']).catch(() => [null]);
      row = rowsAlt && rowsAlt.length ? rowsAlt[0] : null;
    }
    if (!row) {
      // Auto-insert initial row if missing so template becomes available
      try {
        const insertSqlPlural = 'INSERT INTO component_templates (template_key, type, version, label, description, status, default_props, prop_schema, has_options, option_schema, export_njk_template) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
        const params = [fileJson.template_key || 'radio', fileJson.type || fileJson.template_key || 'radio', 1, fileJson.label, fileJson.description || '', fileJson.status || 'active', JSON.stringify(fileJson.default_props), JSON.stringify(fileJson.prop_schema), fileJson.has_options ? 1 : 0, JSON.stringify(fileJson.option_schema || null), fileJson.export_njk_template || null];
        let [ins] = await pool.query(insertSqlPlural, params).catch(() => [null]);
        if (!ins || !ins.insertId) {
          const insertSqlSingular = 'INSERT INTO component_template (template_key, type, version, label, description, status, default_props, prop_schema, has_options, option_schema, export_njk_template) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
          await pool.query(insertSqlSingular, params);
        }
        console.log('[sync] radio template inserted (initial) from file');
      } catch (e2) {
        console.warn('[sync] failed inserting radio template:', e2.message);
      }
      return;
    }
    const dbProps = typeof row.default_props === 'string' ? (() => { try { return JSON.parse(row.default_props); } catch { return {}; } })() : (row.default_props || row.props || {});
    const dbSchema = typeof row.prop_schema === 'string' ? (() => { try { return JSON.parse(row.prop_schema); } catch { return []; } })() : (row.prop_schema || row.editable_fields || []);
    const exportTpl = row.export_njk_template || row.export_njk || null;
    const drift = JSON.stringify(dbProps) !== JSON.stringify(fileJson.default_props)
      || JSON.stringify(dbSchema) !== JSON.stringify(fileJson.prop_schema)
      || String(exportTpl || '') !== String(fileJson.export_njk_template || '')
      || (row.label !== fileJson.label)
      || (String(row.description||'') !== String(fileJson.description||''));
    if (drift) {
      const sqlPlural = 'UPDATE component_templates SET label=?, description=?, status=?, default_props=?, prop_schema=?, has_options=?, option_schema=?, export_njk_template=? WHERE id=?';
      const params = [fileJson.label, fileJson.description || '', fileJson.status || 'active', JSON.stringify(fileJson.default_props), JSON.stringify(fileJson.prop_schema), fileJson.has_options ? 1 : 0, JSON.stringify(fileJson.option_schema || null), fileJson.export_njk_template || null, row.id];
      let [result] = await pool.query(sqlPlural, params).catch(() => [null]);
      if (!result || result.affectedRows === 0) {
        const sqlSingular = 'UPDATE component_template SET label=?, description=?, status=?, default_props=?, prop_schema=?, has_options=?, option_schema=?, export_njk_template=? WHERE id=?';
        await pool.query(sqlSingular, params);
      }
      console.log('[sync] radio template (latest version) updated from file source of truth');
    }
  } catch (e) {
    console.warn('[sync] radio template sync failed:', e.message);
  }
}

// Fire and forget sync on startup (non-blocking)
syncRadioTemplateFromFile();

// Generic helper to sync a template by key (initial reuse for input)
async function syncTemplateFromFile(templateKey) {
  try {
    const filePath = path.join(__dirname, 'src', 'component-lib', `${templateKey}.template.json`);
    if (!fs.existsSync(filePath)) return;
    const fileJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const [rowsPlural] = await pool.query('SELECT * FROM component_templates WHERE template_key = ? ORDER BY version DESC, id DESC LIMIT 1', [templateKey]).catch(() => [null]);
    let row = rowsPlural && rowsPlural.length ? rowsPlural[0] : null;
    if (!row) {
      const [rowsSingular] = await pool.query('SELECT * FROM component_template WHERE template_key = ? ORDER BY version DESC, id DESC LIMIT 1', [templateKey]).catch(() => [null]);
      row = rowsSingular && rowsSingular.length ? rowsSingular[0] : null;
    }
    if (!row) {
      // Auto insert new template if missing
      try {
        const insertSqlPlural = 'INSERT INTO component_templates (template_key, type, version, label, description, status, default_props, prop_schema, has_options, option_schema, export_njk_template) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
        const params = [fileJson.template_key || templateKey, fileJson.type || fileJson.template_key || templateKey, 1, fileJson.label, fileJson.description || '', fileJson.status || 'active', JSON.stringify(fileJson.default_props), JSON.stringify(fileJson.prop_schema), fileJson.has_options ? 1 : 0, JSON.stringify(fileJson.option_schema || null), fileJson.export_njk_template || null];
        let [ins] = await pool.query(insertSqlPlural, params).catch(() => [null]);
        if (!ins || !ins.insertId) {
          const insertSqlSingular = 'INSERT INTO component_template (template_key, type, version, label, description, status, default_props, prop_schema, has_options, option_schema, export_njk_template) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
          await pool.query(insertSqlSingular, params);
        }
        console.log(`[sync] ${templateKey} template inserted (initial) from file`);
      } catch (e2) {
        console.warn(`[sync] failed inserting ${templateKey} template:`, e2.message);
      }
      return;
    }
    const dbProps = typeof row.default_props === 'string' ? (() => { try { return JSON.parse(row.default_props); } catch { return {}; } })() : (row.default_props || {});
    const dbSchema = typeof row.prop_schema === 'string' ? (() => { try { return JSON.parse(row.prop_schema); } catch { return []; } })() : (row.prop_schema || []);
    const exportTpl = row.export_njk_template || row.export_njk || null;
    const drift = JSON.stringify(dbProps) !== JSON.stringify(fileJson.default_props)
      || JSON.stringify(dbSchema) !== JSON.stringify(fileJson.prop_schema)
      || String(exportTpl || '') !== String(fileJson.export_njk_template || '')
      || (row.label !== fileJson.label)
      || (String(row.description||'') !== String(fileJson.description||''));
    if (drift) {
      const sqlPlural = 'UPDATE component_templates SET label=?, description=?, status=?, default_props=?, prop_schema=?, has_options=?, option_schema=?, export_njk_template=? WHERE id=?';
      const params = [fileJson.label, fileJson.description || '', fileJson.status || 'active', JSON.stringify(fileJson.default_props), JSON.stringify(fileJson.prop_schema), fileJson.has_options ? 1 : 0, JSON.stringify(fileJson.option_schema || null), fileJson.export_njk_template || null, row.id];
      let [result] = await pool.query(sqlPlural, params).catch(() => [null]);
      if (!result || result.affectedRows === 0) {
        const sqlSingular = 'UPDATE component_template SET label=?, description=?, status=?, default_props=?, prop_schema=?, has_options=?, option_schema=?, export_njk_template=? WHERE id=?';
        await pool.query(sqlSingular, params);
      }
      console.log(`[sync] ${templateKey} template updated from file source of truth`);
    }
  } catch (e) {
    console.warn(`[sync] ${templateKey} template sync failed:`, e.message);
  }
}

// Input template sync (reuse generic helper)
async function syncInputTemplateFromFile() { return syncTemplateFromFile('input'); }
syncInputTemplateFromFile();

// Checkbox template sync (reuse generic helper)
async function syncCheckboxTemplateFromFile() { return syncTemplateFromFile('checkbox'); }
syncCheckboxTemplateFromFile();

// Date-input template sync (reuse generic helper)
async function syncDateInputTemplateFromFile() { return syncTemplateFromFile('date-input'); }
syncDateInputTemplateFromFile();

// File-upload template sync (reuse generic helper)
async function syncFileUploadTemplateFromFile() { return syncTemplateFromFile('file-upload'); }
syncFileUploadTemplateFromFile();

// Summary-list template sync (reuse generic helper)
async function syncSummaryListTemplateFromFile() { return syncTemplateFromFile('summary-list'); }
syncSummaryListTemplateFromFile();

// Textarea template sync (reuse generic helper)
async function syncTextareaTemplateFromFile() { return syncTemplateFromFile('textarea'); }
syncTextareaTemplateFromFile();

// Character-count template sync (reuse generic helper)
async function syncCharacterCountTemplateFromFile() { return syncTemplateFromFile('character-count'); }
syncCharacterCountTemplateFromFile();

// Inset-text template sync (reuse generic helper)
async function syncInsetTextTemplateFromFile() { return syncTemplateFromFile('inset-text'); }
syncInsetTextTemplateFromFile();

// Panel template sync (reuse generic helper)
async function syncPanelTemplateFromFile() { return syncTemplateFromFile('panel'); }
syncPanelTemplateFromFile();

// Details template sync (reuse generic helper)
async function syncDetailsTemplateFromFile() { return syncTemplateFromFile('details'); }
syncDetailsTemplateFromFile();

// Text-block template sync (reuse generic helper)
async function syncTextBlockTemplateFromFile() { return syncTemplateFromFile('text-block'); }
syncTextBlockTemplateFromFile();

// Select template sync (reuse generic helper)
async function syncSelectTemplateFromFile() { return syncTemplateFromFile('select'); }
syncSelectTemplateFromFile();

// Warning-text template sync (reuse generic helper)
async function syncWarningTextTemplateFromFile() { return syncTemplateFromFile('warning-text'); }
syncWarningTextTemplateFromFile();

// Signature-ack template sync (reuse generic helper)
async function syncSignatureAckTemplateFromFile() { return syncTemplateFromFile('signature-ack'); }
syncSignatureAckTemplateFromFile();

// Dev helper endpoint to force re-sync of radio template from filesystem (no versioning bump)
app.post('/api/dev/sync/radio-template', async (_req, res) => {
  await syncRadioTemplateFromFile();
  res.json({ ok: true, message: 'Radio template sync attempted' });
});

// Dev helper to sync input template
app.post('/api/dev/sync/input-template', async (_req, res) => {
  await syncInputTemplateFromFile();
  res.json({ ok: true, message: 'Input template sync attempted' });
});

// Dev helper to sync checkbox template
app.post('/api/dev/sync/checkbox-template', async (_req, res) => {
  await syncCheckboxTemplateFromFile();
  res.json({ ok: true, message: 'Checkbox template sync attempted' });
});

// Dev helper to sync date-input template
app.post('/api/dev/sync/date-input-template', async (_req, res) => {
  await syncDateInputTemplateFromFile();
  res.json({ ok: true, message: 'Date-input template sync attempted' });
});

// Dev helper to sync file-upload template
app.post('/api/dev/sync/file-upload-template', async (_req, res) => {
  await syncFileUploadTemplateFromFile();
  res.json({ ok: true, message: 'File-upload template sync attempted' });
});

// Dev helper to sync summary-list template
app.post('/api/dev/sync/summary-list-template', async (_req, res) => {
  await syncSummaryListTemplateFromFile();
  res.json({ ok: true, message: 'Summary-list template sync attempted' });
});

// Dev helper to sync textarea template
app.post('/api/dev/sync/textarea-template', async (_req, res) => {
  await syncTextareaTemplateFromFile();
  res.json({ ok: true, message: 'Textarea template sync attempted' });
});

// Dev helper to sync character-count template
app.post('/api/dev/sync/character-count-template', async (_req, res) => {
  await syncCharacterCountTemplateFromFile();
  res.json({ ok: true, message: 'Character-count template sync attempted' });
});

// Dev helper to sync inset-text template
app.post('/api/dev/sync/inset-text-template', async (_req, res) => {
  await syncInsetTextTemplateFromFile();
  res.json({ ok: true, message: 'Inset-text template sync attempted' });
});

// Dev helper to sync panel template
app.post('/api/dev/sync/panel-template', async (_req, res) => {
  await syncPanelTemplateFromFile();
  res.json({ ok: true, message: 'Panel template sync attempted' });
});

// Dev helper to sync details template
app.post('/api/dev/sync/details-template', async (_req, res) => {
  await syncDetailsTemplateFromFile();
  res.json({ ok: true, message: 'Details template sync attempted' });
});

// Dev helper to sync text-block template
app.post('/api/dev/sync/text-block-template', async (_req, res) => {
  await syncTextBlockTemplateFromFile();
  res.json({ ok: true, message: 'Text-block template sync attempted' });
});

// Dev helper to sync select template
app.post('/api/dev/sync/select-template', async (_req, res) => {
  await syncSelectTemplateFromFile();
  res.json({ ok: true, message: 'Select template sync attempted' });
});

// Dev helper to sync signature-ack template
app.post('/api/dev/sync/signature-ack-template', async (_req, res) => {
  await syncSignatureAckTemplateFromFile();
  res.json({ ok: true, message: 'Signature-ack template sync attempted' });
});

// ---------------- Component Templates Endpoints (Library) -----------------
// Provides CRUD-lite access to component template definitions stored in DB.
// Actual schema (DESCRIBE iset_intake.component_template):
// id (PK), template_key (varchar), version (int), type (varchar), label (varchar), description (text),
// default_props (json, NOT NULL), prop_schema (json, nullable), export_njk_template (text), status (varchar),
// created_at (datetime), updated_at (datetime), has_options (tinyint), option_schema (json)
// NOTE: Earlier code used conceptual names: name -> label, props -> default_props, editable_fields -> prop_schema.
// For backward compatibility we still emit name + editable_fields, but writes now target the correct columns.

async function selectComponentTemplates() {
  // Try plural then singular
  const [rowsPlural] = await pool.query('SELECT * FROM component_templates').catch(() => [null]);
  if (rowsPlural) return rowsPlural;
  const [rowsSingular] = await pool.query('SELECT * FROM component_template');
  return rowsSingular;
}

function normalizeTemplateRow(row) {
  const parse = (v, def = null) => {
    if (v == null) return def;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return def; }
  };
  const defaultProps = parse(row.default_props, {});
  const propSchema = parse(row.prop_schema, []);
  const optionSchema = parse(row.option_schema, null);
  const label = row.label || row.name || row.template_key || row.type || '';
  return {
    id: row.id,
    label,
    // name retained for backward compatibility with any frontend code still expecting it
    name: label,
    description: row.description || '',
    status: row.status || 'active',
    type: row.type || row.template_key || label,
    template_key: row.template_key || row.type || label,
    version: row.version || 1,
    // Expose both legacy and canonical keys
    default_props: defaultProps,
    prop_schema: propSchema,
    props: defaultProps,
    editable_fields: propSchema,
    has_options: !!(row.has_options || row.hasOptions),
    option_schema: optionSchema,
  };
}

// Lightweight read endpoint for component templates (dev + admin usage)
// GET /api/component-templates?templateKey=character-count&includeTemplate=1
// Returns normalized rows; if templateKey provided, filters to latest active version of that key.
app.get('/api/component-templates', async (req, res) => {
  try {
    const { templateKey, includeTemplate } = req.query || {};
    let rows = await selectComponentTemplates();
    if (templateKey) {
      // Filter to rows matching template_key and take highest version if version column exists
      const matches = rows.filter(r => String(r.template_key || r.templateKey || r.type || '').toLowerCase() === String(templateKey).toLowerCase());
      if (matches.length) {
        const sorted = matches.sort((a,b) => (Number(b.version||0) - Number(a.version||0)));
        rows = [sorted[0]];
      } else {
        rows = [];
      }
    }
    let out = rows.map(r => {
      const norm = normalizeTemplateRow(r);
      // Alias legacy plural key to singular for UI consistency
      if (String(norm.template_key).toLowerCase() === 'checkboxes') {
        norm.template_key = 'checkbox';
        norm.type = 'checkbox';
      }
      if (includeTemplate) {
        norm.export_njk_template = r.export_njk_template || r.export_njk || null;
      }
      return norm;
    });
    // Deduplicate by template_key keeping latest version (and preferring rows with richer option_schema length)
    const byKey = new Map();
    for (const tpl of out) {
      const k = String(tpl.template_key).toLowerCase();
      const existing = byKey.get(k);
      if (!existing) { byKey.set(k, tpl); continue; }
      const exScore = (existing.version||0) * 10 + (Array.isArray(existing.option_schema)? existing.option_schema.length:0);
      const newScore = (tpl.version||0) * 10 + (Array.isArray(tpl.option_schema)? tpl.option_schema.length:0);
      if (newScore >= exScore) byKey.set(k, tpl);
    }
    out = Array.from(byKey.values());
    res.status(200).json({ count: out.length, templates: out });
  } catch (e) {
    console.error('GET /api/component-templates failed:', e);
    res.status(500).json({ error: 'component_templates_fetch_failed' });
  }
});

// Removed earlier simple list handler; consolidated logic lives later in file (includes augmentation & version filtering)

app.put('/api/component-templates/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  // Accept both legacy and canonical field names from client
  const label = body.label ?? body.name; // prefer label
  const type = body.type;
  const template_key = body.template_key;
  const version = body.version;
  const default_props = body.default_props ?? body.props; // unify
  const prop_schema = body.prop_schema ?? body.editable_fields; // unify
  const has_options = body.has_options;
  const option_schema = body.option_schema;

  // Schema validation (radio only for now) ??? use template_key or type to identify
  const tk = (template_key || type || '').toLowerCase();
  if (tk === 'radio' && default_props) {
    const result = validateTemplatePayload('radio', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'input' && default_props) {
    const result = validateTemplatePayload('input', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'textarea' && default_props) {
    const result = validateTemplatePayload('textarea', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'character-count' && default_props) {
    const result = validateTemplatePayload('character-count', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if ((tk === 'checkbox' || tk === 'checkboxes') && default_props) {
    const result = validateTemplatePayload('checkbox', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'inset-text' && default_props) {
    const result = validateTemplatePayload('inset-text', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'panel' && default_props) {
    const result = validateTemplatePayload('panel', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'details' && default_props) {
    const result = validateTemplatePayload('details', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'text-block' && default_props) {
    const result = validateTemplatePayload('text-block', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'signature-ack' && default_props) {
    const result = validateTemplatePayload('signature-ack', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }

  const updates = [];
  const params = [];
  function push(col, val, json = false) {
    if (typeof val === 'undefined') return;
    updates.push(`${col} = ?`);
    params.push(json ? JSON.stringify(val) : val);
  }
  push('label', label);
  push('type', type);
  push('template_key', template_key);
  push('version', version);
  push('default_props', default_props, true);
  push('prop_schema', prop_schema, true);
  push('has_options', typeof has_options === 'boolean' ? (has_options ? 1 : 0) : undefined);
  push('option_schema', option_schema, true);

  if (!updates.length) return res.status(400).json({ error: 'no_updates' });
  try {
    params.push(id);
    const sqlPlural = `UPDATE component_templates SET ${updates.join(', ')} WHERE id = ?`;
    let [result] = await pool.query(sqlPlural, params).catch(() => [null]);
    if (!result || result.affectedRows === 0) {
      const sqlSingular = `UPDATE component_template SET ${updates.join(', ')} WHERE id = ?`;
      [result] = await pool.query(sqlSingular, params);
      if (!result || result.affectedRows === 0) return res.status(404).json({ error: 'not_found' });
    }
    res.status(200).json({ ok: true, updated_fields: updates.map(u => u.split(' ')[0]) });
  } catch (e) {
    res.status(500).json({ error: 'component_template_update_failed', details: e.message });
  }
});

// Targeted fix endpoint to normalize "Confirmation Panel" -> "Panel" and ensure proper fields.
app.post('/api/component-templates/fix/panel-normalize', async (_req, res) => {
  try {
    const rows = await selectComponentTemplates();
    const candidates = rows.filter(r => {
      const nm = String(r.name || '').toLowerCase();
      const tp = String(r.type || '').toLowerCase();
      const tk = String(r.template_key || '').toLowerCase();
      return nm.includes('confirmation panel') || tp === 'confirmation-panel' || tk === 'confirmation-panel';
    });
    if (!candidates.length) return res.status(200).json({ updated: 0, message: 'No matching panel templates found.' });
    let updated = 0;
    for (const row of candidates) {
      const baseProps = (() => {
        try { return typeof row.props === 'string' ? JSON.parse(row.props) : (row.props || {}); } catch { return {}; }
      })();
      if (!baseProps.titleText) baseProps.titleText = 'Application complete';
      if (!baseProps.html) baseProps.html = 'Your reference number<br><strong>ABC123</strong>';
      const editable = ['titleText','html'];
      const params = [ 'Panel', 'panel', 'panel', 1, JSON.stringify(baseProps), JSON.stringify(editable), 0, null, row.id ];
      // Try plural then singular
      const sqlPlural = 'UPDATE component_templates SET name=?, type=?, template_key=?, version=?, props=?, editable_fields=?, has_options=?, option_schema=? WHERE id=?';
      let [result] = await pool.query(sqlPlural, params).catch(() => [null]);
      if (!result || result.affectedRows === 0) {
        const sqlSingular = 'UPDATE component_template SET name=?, type=?, template_key=?, version=?, props=?, editable_fields=?, has_options=?, option_schema=? WHERE id=?';
        [result] = await pool.query(sqlSingular, params);
      }
      if (result && result.affectedRows > 0) updated += result.affectedRows;
    }
    res.status(200).json({ updated });
  } catch (e) {
    res.status(500).json({ error: 'panel_normalize_failed', details: e.message });
  }
});

// Migration: prune prefix/suffix props from character-count templates (should not be translatable)
app.post('/api/component-templates/fix/character-count-prune-prefix-suffix', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT id, default_props, prop_schema FROM iset_intake.component_template WHERE template_key='character-count'`);
    let updated = 0;
    const changed = [];
    for (const r of rows) {
      let props = {}; try { props = r.default_props ? JSON.parse(r.default_props) : {}; } catch { props = {}; }
      let schema = []; try { schema = r.prop_schema ? JSON.parse(r.prop_schema) : []; } catch { schema = []; }
      const beforeJSON = JSON.stringify(props);
      // Remove stray prefix/suffix keys (text objects or scalars)
      if (props && typeof props === 'object') {
        if (props.prefix) delete props.prefix;
        if (props.suffix) delete props.suffix;
      }
      // Remove any schema entries referencing prefix or suffix
      if (Array.isArray(schema) && schema.length) {
        const filtered = schema.filter(f => !(f && typeof f === 'object' && /(^|\.)prefix(\.|$)/i.test(String(f.path||f.key||''))));
        const filtered2 = filtered.filter(f => !(f && typeof f === 'object' && /(^|\.)suffix(\.|$)/i.test(String(f.path||f.key||''))));
        schema = filtered2;
      }
      const afterJSON = JSON.stringify(props);
      if (afterJSON !== beforeJSON) {
        await pool.query(`UPDATE iset_intake.component_template SET default_props=?, prop_schema=? WHERE id=?`, [afterJSON, JSON.stringify(schema), r.id]);
        updated++; changed.push(r.id);
      }
    }
    res.status(200).json({ ok: true, updated, changed });
  } catch (e) {
    console.error('character-count prune prefix/suffix failed', e);
    res.status(500).json({ error: 'character_count_prune_failed', details: e.message });
  }
});

// One-off migration endpoint to persist label.classes insertion and legacy required removal.
// Safe to run multiple times (idempotent) ??? it will only update rows needing changes.
app.post('/api/component-templates/migrate/label-required-cleanup', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT id, template_key, type, default_props, prop_schema FROM iset_intake.component_template`);
    const labelClassOptions = [ 'govuk-label', 'govuk-label--s', 'govuk-label--m', 'govuk-label--l', 'govuk-label--xl' ];
    const inputLike = new Set(['input','textarea','character-count','select','file-upload','password-input']);
    let updated = 0;
    const changedTemplates = [];
    for (const r of rows) {
      let changed = false;
      let schema = [];
      try { schema = r.prop_schema ? JSON.parse(r.prop_schema) : []; } catch { schema = []; }
      if (!Array.isArray(schema)) schema = [];
      const beforeLen = schema.length;
      schema = schema.filter(f => f && f.key !== 'required' && f.path !== 'required');
      if (schema.length !== beforeLen) changed = true;
      const hasLabelText = schema.some(f => f && (f.path === 'label.text' || f.key === 'label.text'));
      const hasLabelClasses = schema.some(f => f && (f.path === 'label.classes' || f.key === 'label.classes'));
      if (hasLabelText && !hasLabelClasses) {
        const insertIdx = schema.findIndex(f => f && (f.path === 'label.text' || f.key === 'label.text'));
        const fieldDef = { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions };
        if (insertIdx >= 0) schema.splice(insertIdx + 1, 0, fieldDef); else schema.push(fieldDef);
        changed = true;
      }
      let defaults = {};
      try { defaults = r.default_props ? JSON.parse(r.default_props) : {}; } catch { defaults = {}; }
      if (inputLike.has(String(r.type).toLowerCase())) {
        if (!defaults.label || typeof defaults.label !== 'object') {
          defaults.label = { text: (defaults.label && defaults.label.text) || 'Label', classes: 'govuk-label--m' };
          changed = true;
        } else if (!defaults.label.classes) {
          defaults.label.classes = 'govuk-label--m';
          changed = true;
        }
      }
      if (changed) {
        await pool.query(`UPDATE iset_intake.component_template SET prop_schema = ?, default_props = ? WHERE id = ?`, [JSON.stringify(schema), JSON.stringify(defaults), r.id]);
        updated++;
        changedTemplates.push({ id: r.id, key: r.template_key, type: r.type });
      }
    }
    res.status(200).json({ message: 'Label/required cleanup complete', updated, changedTemplates });
  } catch (err) {
    console.error('label-required-cleanup failed', err);
    res.status(500).json({ error: 'label_required_cleanup_failed' });
  }
});

// POST /api/component-templates/migrate/backfill-props
// Persists any runtime-backfilled props & editable_fields for input-like templates missing schema (idempotent)
app.post('/api/component-templates/migrate/backfill-props', async (_req, res) => {
  try {
    const targets = ['character-count','input','textarea','select','file-upload','password-input'];
    const [rows] = await pool.query(`SELECT id, type, default_props, prop_schema FROM iset_intake.component_template`);
    const labelClassOptions = [ 'govuk-label', 'govuk-label--s', 'govuk-label--m', 'govuk-label--l', 'govuk-label--xl' ];
    let updated = 0;
    const changed = [];
    for (const r of rows) {
      const t = String(r.type || '').toLowerCase();
      if (!targets.includes(t)) continue;
      let props = {}; try { props = r.default_props ? JSON.parse(r.default_props) : {}; } catch { props = {}; }
      let schema = []; try { schema = r.prop_schema ? JSON.parse(r.prop_schema) : []; } catch { schema = []; }
      if (!Array.isArray(schema)) schema = [];
      const originalSchemaLen = schema.length;
      const originalPropsJSON = JSON.stringify(props);
      // Normalise label
      if (!props.label || typeof props.label !== 'object') props.label = { text: 'Label', classes: 'govuk-label--m' };
      else if (!props.label.classes) props.label.classes = 'govuk-label--m';
      const ensure = (k, v) => { if (!(k in props)) props[k] = v; };
      if (t === 'character-count') {
        ensure('name','message'); ensure('id',''); ensure('rows','5'); ensure('maxlength','200'); ensure('threshold','75');
        if (!props.hint || typeof props.hint !== 'object') props.hint = { text: 'Do not include personal information.' };
        if (!props.formGroup) props.formGroup = { classes: '' };
        if (!props.errorMessage) props.errorMessage = { text: '' };
      } else if (t === 'input') {
        ensure('name','input-1'); ensure('id','input-1'); ensure('type','text');
        if (!props.hint || typeof props.hint !== 'object' || !props.hint.text) props.hint = { text: 'This is the optional hint text' };
        if (!props.errorMessage) props.errorMessage = { text: '' };
        if (!props.formGroup) props.formGroup = { classes: '' };
      } else if (t === 'textarea') {
        ensure('name','more-detail'); ensure('id','more-detail'); ensure('rows','5');
        if (!props.hint || typeof props.hint !== 'object' || !props.hint.text) props.hint = { text: 'Don\'t include personal or financial information.' };
        if (!props.errorMessage) props.errorMessage = { text: '' };
        if (!props.formGroup) props.formGroup = { classes: '' };
      } else if (t === 'select') {
        ensure('name','example-select');
        if (!Array.isArray(props.items) || !props.items.length) props.items = [ { text: 'Option 1', value: '1' }, { text: 'Option 2', value: '2' }, { text: 'Option 3', value: '3' } ];
        if (!props.hint || typeof props.hint !== 'object' || !props.hint.text) props.hint = { text: 'Pick from the options' };
      } else if (t === 'file-upload') {
        ensure('name','uploadedFile');
        if (!props.hint || typeof props.hint !== 'object' || !props.hint.text) props.hint = { text: 'Files must be under 10MB.' };
        if (!props.errorMessage) props.errorMessage = { text: '' };
      } else if (t === 'password-input') {
        ensure('name','password');
        if (!props.hint || typeof props.hint !== 'object' || !props.hint.text) props.hint = { text: 'This is the optional hint text' };
        if (!props.errorMessage) props.errorMessage = { text: '' };
      }
      // Rebuild schema only if empty
      if (!schema.length) {
        if (t === 'character-count') schema = [
          { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
          { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
          { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
          { key: 'maxlength', path: 'maxlength', type: 'text', label: 'Max Length' },
          { key: 'threshold', path: 'threshold', type: 'text', label: 'Threshold (%)' },
          { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
        ];
        else if (t === 'input') schema = [
          { key: 'name', path: 'name', type: 'text', label: 'Field name' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'type', path: 'type', type: 'enum', label: 'Input type', options: ['text','email','number','password','tel','url','search'] },
          { key: 'label.text', path: 'label.text', type: 'text', label: 'Label' },
          { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
          { key: 'hint.text', path: 'hint.text', type: 'text', label: 'Hint' },
          { key: 'errorMessage.text', path: 'errorMessage.text', type: 'text', label: 'Error message' },
          { key: 'classes', path: 'classes', type: 'text', label: 'Input classes' }
        ];
        else if (t === 'textarea') schema = [
          { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
          { key: 'labelClasses', path: 'label.classes', type: 'select', label: 'Label Classes', options: labelClassOptions.slice(0,4) },
          { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
          { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'rows', path: 'rows', type: 'text', label: 'Rows (number as text)' },
          { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
        ];
        else if (t === 'select') schema = [
          { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
          { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
          { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
          { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
        ];
        else if (t === 'file-upload') schema = [
          { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
          { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
          { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
          { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
        ];
        else if (t === 'password-input') schema = [
          { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
          { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
          { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
          { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
        ];
      }
      // Remove legacy required if present
      const filteredSchema = schema.filter(f => f.key !== 'required' && f.path !== 'required');
      if (filteredSchema.length !== schema.length) schema = filteredSchema;
      if (schema.length && !schema.some(f => f.path === 'label.classes') && schema.some(f => f.path === 'label.text')) {
        const idx = schema.findIndex(f => f.path === 'label.text');
        const def = { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions };
        if (idx >= 0) schema.splice(idx + 1, 0, def); else schema.push(def);
      }
      const newPropsJSON = JSON.stringify(props);
      const newSchemaJSON = JSON.stringify(schema);
      if (newPropsJSON !== originalPropsJSON || schema.length !== originalSchemaLen) {
        await pool.query(`UPDATE iset_intake.component_template SET default_props = ?, prop_schema = ? WHERE id = ?`, [newPropsJSON, newSchemaJSON, r.id]);
        updated++; changed.push({ id: r.id, type: t });
      }
    }
    res.status(200).json({ message: 'Backfill complete', updated, changed });
  } catch (err) {
    console.error('backfill-props failed', err);
    res.status(500).json({ error: 'backfill_props_failed' });
  }
});

// Admin routes (delegated user management) - feature flagged
try {
  const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
  if (authProvider === 'cognito') {
    const adminUsers = require('./src/routes/admin/users');
    app.use('/api/admin', adminUsers);
  }
} catch (e) {
  console.warn('Admin routes init failed:', e?.message);
}

// --- DEV-ONLY DB Inspector (read-only) ------------------------------------
// Enable with ENABLE_DEV_DB_INSPECTOR=true and optional DEV_DB_KEY as a simple shared secret.
// Endpoints:
//   GET    /api/dev/db/tables                      -> list tables in the configured database
//   GET    /api/dev/db/describe?table=NAME         -> describe columns for a table
//   GET    /api/dev/db/sample?table=NAME&limit=100 -> sample rows from a table (default 50)
//   POST   /api/dev/db/query { sql, params? }      -> run a read-only SELECT (LIMIT enforced)
// Security:
// - Only active when ENABLE_DEV_DB_INSPECTOR=true
// - Optional header auth via x-dev-key matching DEV_DB_KEY
// - Strictly read-only: only allows SQL starting with SELECT and blocks dangerous tokens
// - Adds a default LIMIT if none provided
// - Redacts sensitive-looking fields in results (password, token, sin/ssn, secret, etc.)
const ENABLE_DEV_DB_INSPECTOR = process.env.ENABLE_DEV_DB_INSPECTOR === 'true';

function devInspectorGuard(req, res, next) {
  if (!ENABLE_DEV_DB_INSPECTOR) return res.status(404).json({ error: 'Not found' });
  const key = process.env.DEV_DB_KEY || '';
  if (key && req.get('x-dev-key') !== key) return res.status(403).json({ error: 'Forbidden' });
  next();
}

function redactValue(key, val) {
  if (val == null) return val;
  const k = String(key || '').toLowerCase();
  if (/(password|pass|secret|token|sin|ssn|nid|credit|card|cvv)/i.test(k)) return '***';
  if (/email/.test(k)) {
    const s = String(val);
    const at = s.indexOf('@');
    if (at > 1) return `${s[0]}***@${s.slice(at + 1)}`;
    return '***';
  }
  return val;
}

function redactRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = redactValue(k, v);
  return out;
}

function ensureSelectSQL(sql) {
  if (typeof sql !== 'string') return { ok: false, reason: 'SQL must be a string' };
  const s = sql.trim().replace(/;\s*$/g, '');
  const low = s.toLowerCase();
  if (!low.startsWith('select')) return { ok: false, reason: 'Only SELECT statements are allowed' };
  if (/\b(update|delete|insert|drop|alter|truncate|create|grant|revoke|replace)\b/i.test(low)) {
    return { ok: false, reason: 'Only read-only SELECT is permitted' };
  }
  // Disallow INTO OUTFILE and other file ops
  if (/\binto\s+outfile\b|\bload_file\s*\(/i.test(low)) return { ok: false, reason: 'Dangerous SQL token' };
  return { ok: true, sql: s };
}

function appendDefaultLimit(sql) {
  const low = sql.toLowerCase();
  if (/\blimit\s+\d+/i.test(low)) return sql;
  return `${sql} LIMIT 100`;
}

// List tables in current database
app.get('/api/dev/db/tables', devInspectorGuard, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME AS table_name, TABLE_ROWS AS approx_rows
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME`,
      [dbConfig.database]
    );
    res.json({ ok: true, tables: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Describe columns for a table
app.get('/api/dev/db/describe', devInspectorGuard, async (req, res) => {
  const table = req.query.table;
  if (!table) return res.status(400).json({ ok: false, error: 'Missing table' });
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION`,
      [dbConfig.database, table]
    );
    res.json({ ok: true, columns: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Sample rows
app.get('/api/dev/db/sample', devInspectorGuard, async (req, res) => {
  const table = req.query.table;
  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 1000);
  if (!table) return res.status(400).json({ ok: false, error: 'Missing table' });
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` LIMIT ${limit}`);
    res.json({ ok: true, rows: rows.map(redactRow), limit });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Run a parameterized, read-only SELECT
app.post('/api/dev/db/query', devInspectorGuard, async (req, res) => {
  try {
    const { sql, params } = req.body || {};
    const check = ensureSelectSQL(sql);
    if (!check.ok) return res.status(400).json({ ok: false, error: check.reason });
    const finalSQL = appendDefaultLimit(check.sql);
    const [rows] = await pool.query(finalSQL, Array.isArray(params) ? params : []);
    res.json({ ok: true, rows: rows.map(redactRow), sql: finalSQL });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Supported component types in the Public Portal renderer (Milestone 6)
// Keep this list in sync with ISET-intake/src/renderer/renderers.js registry keys
// Aliases are included for safety (e.g., 'checkboxes' and 'checkbox', 'date' and 'date-input').
const SUPPORTED_COMPONENT_TYPES = new Set([
  'radio',
  'panel',
  'input',
  'text',
  'email',
  'phone',
  'password',
  'password-input',
  'number',
  'textarea',
  'select',
  'checkbox',
  'checkboxes',
  'date',
  'date-input',
  'label',
  'paragraph',
  'inset-text',
  'warning-text',
  'details',
  'accordion',
  'character-count',
  'file-upload',
  'summary-list',
  'signature-ack',
]);

// Discoverable list for the Admin UI
app.get('/api/publish/supported-component-types', (_req, res) => {
  res.json({ supported: Array.from(SUPPORTED_COMPONENT_TYPES).sort() });
});

// --- Nunjucks environment for component preview ---------------------------
// Existing global configuration already set above; we create a local reference.
// We attempt to include GOV.UK frontend macros (path may vary depending on install structure).
// Fallback: rely on previously configured nunjucks instance.
let env;
try {
  // Reconfigure with additional search paths without breaking existing one.
  env = nunjucks.configure([
    path.join(__dirname, 'src', 'server-macros'),
    path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist'),
    path.join(__dirname, 'node_modules', 'govuk-frontend')
  ], { autoescape: true, noCache: true });
} catch (e) {
  console.warn('Nunjucks reconfigure for preview failed, using existing instance:', e.message);
  env = nunjucks;
}

// Helper: render a single component template to HTML using export_njk_template from DB
function renderRegistryComponent(entry, comp) {
  if (!entry) return null;
  const props = typeof entry.prepareProps === 'function'
    ? entry.prepareProps(comp)
    : ((comp && typeof comp.props === 'object' && comp.props !== null) ? { ...comp.props } : {});
  const context = { props, component: comp };
  if (entry.macro) {
    const macroConfig = entry.macro;
    const macroFile = macroConfig.file;
    const macroName = macroConfig.name;
    if (!macroFile || !macroName) {
      throw new Error('Macro configuration requires file and name');
    }
    const tpl = `{% from "${macroFile}" import ${macroName} %}{{ ${macroName}(props) }}`;
    return env.renderString(tpl, context);
  }
  if (typeof entry.render === 'function') {
    return entry.render({ env, component: comp, props, context, renderComponentHtml });
  }
  throw new Error('Unsupported registry entry');
}

async function renderComponentHtml(comp, depth = 0) {
  if (depth > 4) return '<!-- max depth reached -->';
  const templateKey = comp.template_key || comp.templateKey || comp.templateKey || null;
  const type = comp.type || null;
  const registryEntry = getComponentRenderer({ templateKey, type });
  if (registryEntry) {
    try {
      return renderRegistryComponent(registryEntry, comp);
    } catch (e) {
      console.warn(`registry render failed for ${templateKey || type}: ${e.message}`);
    }
  }
  let rows;
  if (templateKey) {
    [rows] = await pool.query(
      `SELECT export_njk_template FROM iset_intake.component_template
       WHERE status='active' AND template_key=? ORDER BY version DESC LIMIT 1`,
      [templateKey]
    );
  } else if (type) {
    [rows] = await pool.query(
      `SELECT export_njk_template FROM iset_intake.component_template
       WHERE status='active' AND type=? ORDER BY version DESC LIMIT 1`,
      [type]
    );
  } else {
    return '<!-- component missing template reference -->';
  }
  const tpl = rows?.[0]?.export_njk_template;
  if (!tpl) return `<!-- missing template for ${templateKey || type} -->`;
  try {
    // Normalise radio option hint strings -> { text: "..." } objects so GOV.UK macro renders them.
    const tKey = (templateKey || type || '').toLowerCase();
    // Normalise hint strings for choice components (radios, checkboxes, select)
    if ((tKey === 'radio' || tKey === 'radios' || tKey === 'select' || tKey === 'checkbox' || tKey === 'checkboxes') && comp?.props && Array.isArray(comp.props.items)) {
      // Process conditional follow-up questions (single depth currently) for radios + checkboxes
      if ((tKey === 'radio' || tKey === 'radios' || tKey === 'checkbox' || tKey === 'checkboxes')) {
        const newItems = [];
        for (const it of comp.props.items) {
          if (it && it.conditional && Array.isArray(it.conditional.questions) && it.conditional.questions.length) {
            // Render each follow-up component to HTML
            const htmlParts = [];
            for (const q of it.conditional.questions) {
              try {
                // Defensive clone; ensure nested component has template_key if only type present
                const childComp = { ...q };
                if (!childComp.template_key && childComp.type) childComp.template_key = childComp.type;
                const rendered = await renderComponentHtml(childComp, depth + 1);
                htmlParts.push(rendered);
              } catch (e) {
                htmlParts.push(`<!-- follow-up render error: ${e.message} -->`);
              }
            }
            const combined = htmlParts.join('\n');
            const { questions, ...restCond } = it.conditional;
            newItems.push({
              ...it,
              ...(typeof it.hint === 'string' && it.hint.trim() !== '' ? { hint: { text: it.hint } } : {}),
              conditional: { ...restCond, html: combined }
            });
            continue;
          }
          // No conditional questions
          if (it && typeof it.hint === 'string' && it.hint.trim() !== '') {
            newItems.push({ ...it, hint: { text: it.hint } });
          } else {
            newItems.push(it);
          }
        }
        comp = { ...comp, props: { ...comp.props, items: newItems } };
      } else {
        comp = { ...comp, props: { ...comp.props, items: comp.props.items.map(it => {
          if (it && typeof it.hint === 'string' && it.hint.trim() !== '') {
            return { ...it, hint: { text: it.hint } };
          }
          return it;
        }) } };
      }
    }
    // Backward compatibility: earlier editor bug nested updated date-input items under props.props.items
    if ((tKey === 'date' || tKey === 'date-input') && comp?.props) {
      const nested = comp.props?.props?.items;
      if (Array.isArray(nested) && (!Array.isArray(comp.props.items) || nested.some(n => n?.autocomplete) )) {
        comp = { ...comp, props: { ...comp.props, items: nested } };
      }
    }
    // Prune empty errorMessage objects so GOV.UK macros don't apply error styling by presence alone
    try {
      if (comp?.props && comp.props.errorMessage) {
        const em = comp.props.errorMessage;
        let empty = false;
        if (typeof em.text === 'string') {
          empty = em.text.trim() === '';
        } else if (em && typeof em.text === 'object' && em.text !== null) {
          const vals = Object.values(em.text).map(v => (typeof v === 'string') ? v.trim() : '');
            empty = vals.length > 0 && vals.every(v => v === '');
        } else if (!em.text) {
          // No text field at all
          empty = true;
        }
        if (empty) {
          // Remove field entirely so macro treats as no error
          const { errorMessage, ...rest } = comp.props;
          comp = { ...comp, props: rest };
        }
      }
    } catch { /* ignore pruning errors */ }
    return env.renderString(tpl, { props: comp.props || {} });
  } catch (e) {
    console.error('NJK render error:', e);
    return `<!-- render error for ${templateKey || type}: ${e.message} -->`;
  }
}

// Wrap rendered fragments in a standalone GOV.UK HTML document
// Expose local GOV.UK frontend dist (once) so iframe can load assets
if (!app.locals.__govukStaticMounted) {
  const govukDistPath = path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist', 'govuk');
  app.use('/assets/govuk', express.static(govukDistPath));
  app.locals.__govukStaticMounted = true;
}

function wrapGovukDoc(innerHtml) {
  // Inline GOV.UK assets to avoid separate network fetches inside iframe which may 404 or be blocked.
  let css = '';
  let jsModule = '';
  try {
    css = fs.readFileSync(path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist', 'govuk', 'govuk-frontend.min.css'), 'utf8');
  } catch (e) {
    css = '/* failed to inline govuk css: ' + e.message + ' */';
  }
  try {
    jsModule = fs.readFileSync(path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist', 'govuk', 'govuk-frontend.min.js'), 'utf8');
  } catch (e) {
    jsModule = '/* failed to inline govuk js: ' + e.message + ' */';
  }
  return `<!doctype html>
  <html lang="en" class="govuk-template">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Preview</title>
      <style>${css}\nbody { margin:16px; }</style>
    </head>
    <body class="govuk-template__body">
      <script>
        // Ensure GOV.UK Frontend support class is present so component JS will initialise
        // and CSS rules like .govuk-frontend-supported .govuk-radios__conditional--hidden apply.
        (function(){
          var cls = document.body.className || '';
            if(!/\bgovuk-frontend-supported\b/.test(cls)) cls += (cls?' ':'') + 'govuk-frontend-supported';
            if(!/\bjs-enabled\b/.test(cls)) cls += (cls?' ':'') + 'js-enabled';
            document.body.className = cls;
        })();
      </script>
  <div class="govuk-width-container">${innerHtml}</div>
  <script type="module">${jsModule}
  try { window.GOVUKFrontend && window.GOVUKFrontend.initAll(); } catch(e) { console.warn('GOV.UK initAll failed (module)'); }
  </script>
      <script>
// Minimal fallback for conditional radios & checkboxes (no debug logging)
(function(){
  function apply(){
    const support = document.body.classList.contains('govuk-frontend-supported');
    // Reset all conditional containers (radios + checkboxes)
    document.querySelectorAll('.govuk-radios__conditional').forEach(el => { el.classList.add('govuk-radios__conditional--hidden'); if(!support) el.style.display='none'; else if(el.style.display==='none') el.style.removeProperty('display'); });
    document.querySelectorAll('.govuk-checkboxes__conditional').forEach(el => { el.classList.add('govuk-checkboxes__conditional--hidden'); if(!support) el.style.display='none'; else if(el.style.display==='none') el.style.removeProperty('display'); });
    function toggle(input, group){
      const condId = input.getAttribute('aria-controls') || input.getAttribute('data-aria-controls');
      if(!condId) return;
      const condEl = document.getElementById(condId);
      if(!condEl) return;
      const type = group === 'checkbox' ? 'checkboxes' : 'radios';
      const hiddenClass = type === 'checkboxes' ? 'govuk-checkboxes__conditional--hidden' : 'govuk-radios__conditional--hidden';
      const show = input.checked;
      condEl.classList.toggle(hiddenClass, !show);
      input.setAttribute('aria-expanded', show ? 'true':'false');
      if(show) condEl.style.removeProperty('display'); else if(!support) condEl.style.display='none'; else condEl.style.removeProperty('display');
    }
    document.querySelectorAll('input[type=radio]').forEach(inp => { if(inp.classList.contains('govuk-radios__input') || inp.hasAttribute('aria-controls') || inp.hasAttribute('data-aria-controls')) toggle(inp,'radio'); });
    document.querySelectorAll('input[type=checkbox]').forEach(inp => { if(inp.classList.contains('govuk-checkboxes__input') || inp.hasAttribute('aria-controls') || inp.hasAttribute('data-aria-controls')) toggle(inp,'checkbox'); });
  }
  document.addEventListener('change', e => { if (e.target && e.target.matches && (e.target.matches('input[type=radio]') || e.target.matches('input[type=checkbox]'))) apply(); });
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(apply,0); else document.addEventListener('DOMContentLoaded', apply);
})();
      </script>
    </body>
  </html>`;
}


// --- Intake step preview cache helpers --------------------------------------
const PREVIEW_CACHE_MAX_ITEMS = 18;
const PREVIEW_CACHE_MAX_WEIGHT = 2 * 1024 * 1024; // 2 MB total payload (html + canonical json)
const PREVIEW_CACHE_PER_STEP_LIMIT = 4;
const PREVIEW_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const PREVIEW_CACHE_VERSION = process.env.PREVIEW_CACHE_SALT || process.env.GIT_COMMIT || 'v1';
const PREVIEW_MAX_COMPONENTS = 400;
const PREVIEW_MAX_PAYLOAD_BYTES = 1 * 1024 * 1024; // 1 MB

const previewCache = new Map();
let previewCacheWeight = 0;

function estimateBytes(value) {
  if (!value) return 0;
  return Buffer.byteLength(String(value), 'utf8');
}

function canonicalisePreviewValue(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return null;
  if (typeof value === 'object') {
    if (seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) {
      return value.map(item => canonicalisePreviewValue(item, seen));
    }
    const result = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      const normalised = canonicalisePreviewValue(value[key], seen);
      if (typeof normalised === 'undefined') continue;
      result[key] = normalised;
    }
    return result;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return String(value);
  }
}

function computePreviewSignature(components, language) {
  const canonical = canonicalisePreviewValue(components);
  const canonicalJson = JSON.stringify(canonical);
  const hash = crypto.createHash('sha1').update(`${PREVIEW_CACHE_VERSION}|${language}|${canonicalJson}`).digest('hex');
  return { canonicalJson, hash };
}

function removePreviewCacheEntry(cacheKey) {
  const entry = previewCache.get(cacheKey);
  if (!entry) return;
  previewCache.delete(cacheKey);
  previewCacheWeight = Math.max(0, previewCacheWeight - (entry.weight || 0));
}

function touchPreviewCacheEntry(cacheKey) {
  const entry = previewCache.get(cacheKey);
  if (!entry) return null;
  previewCache.delete(cacheKey);
  previewCache.set(cacheKey, entry);
  return entry;
}

function trimPreviewCache(stepKey) {
  if (stepKey) {
    const perStepKeys = [];
    for (const [key, entry] of previewCache.entries()) {
      if (entry.stepKey === stepKey) perStepKeys.push({ key, entry });
    }
    while (perStepKeys.length > PREVIEW_CACHE_PER_STEP_LIMIT) {
      const oldest = perStepKeys.shift();
      if (oldest) removePreviewCacheEntry(oldest.key);
    }
  }
  while (previewCache.size > PREVIEW_CACHE_MAX_ITEMS || previewCacheWeight > PREVIEW_CACHE_MAX_WEIGHT) {
    const oldestKey = previewCache.keys().next().value;
    if (!oldestKey) break;
    removePreviewCacheEntry(oldestKey);
  }
}

function normalisePreviewLanguage(value) {
  if (typeof value === 'string') {
    const token = value.trim().toLowerCase();
    if (token === 'fr' || token === 'fr-ca' || token === 'fr_fr' || token === 'french') {
      return 'fr';
    }
  }
  return 'en';
}

function safeParseJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

// POST /api/preview/step : render array of components to full HTML doc
app.post('/api/preview/step', async (req, res) => {
  if (!ensureStepEditor(req, res)) return;
  res.set('Cache-Control', 'no-cache, private');
  const startedAt = Date.now();
  try {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const language = normalisePreviewLanguage(body.language || body.locale || body.localeCode || body.lang);
    const rawStepId = body.stepId || body.id || null;
    const stepKey = rawStepId ? `step:${rawStepId}` : `anon:${req.auth?.sub || req.auth?.userId || 'anonymous'}`;

    let componentsInput = typeof body.components === 'undefined' ? [] : body.components;
    componentsInput = safeParseJson(componentsInput);
    if (!Array.isArray(componentsInput)) {
      return res.status(400).json({ error: 'components must be an array' });
    }
    if (componentsInput.length > PREVIEW_MAX_COMPONENTS) {
      return res.status(413).json({ error: `Preview payload too large (max ${PREVIEW_MAX_COMPONENTS} components)` });
    }

    let approxPayloadBytes = 0;
    try {
      approxPayloadBytes = Buffer.byteLength(JSON.stringify(componentsInput), 'utf8');
    } catch (_) {
      approxPayloadBytes = PREVIEW_MAX_PAYLOAD_BYTES + 1;
    }
    if (approxPayloadBytes > PREVIEW_MAX_PAYLOAD_BYTES) {
      return res.status(413).json({ error: 'Preview payload too large' });
    }

    const validationErrors = [];
    const sanitisedComponents = componentsInput.map((component, index) => {
      if (!component || typeof component !== 'object') {
        validationErrors.push({ index, code: 'INVALID_COMPONENT', message: 'Component must be an object' });
        return null;
      }
      const clone = { ...component };
      const props = clone.props && typeof clone.props === 'object' ? { ...clone.props } : {};
      clone.props = props;
      if (!clone.template_key && clone.templateKey) clone.template_key = clone.templateKey;
      const templateToken = typeof clone.template_key === 'string' && clone.template_key.trim()
        ? clone.template_key.trim()
        : (typeof clone.type === 'string' ? clone.type.trim() : '');
      if (!templateToken) {
        validationErrors.push({
          index,
          code: 'MISSING_TEMPLATE_KEY',
          message: 'template_key (or type) is required for preview rendering',
          componentId: clone.id || props.name || null,
        });
      } else {
        clone.template_key = templateToken;
      }
      return clone;
    }).filter(Boolean);

    if (validationErrors.length) {
      return res.status(422).json({ error: 'Invalid component payload', details: validationErrors });
    }

    const componentLookup = new Map();
    for (const comp of sanitisedComponents) {
      const keys = [];
      if (comp.id !== undefined && comp.id !== null) keys.push(String(comp.id));
      const nameKey = comp.props?.name;
      if (nameKey) keys.push(String(nameKey));
      for (const key of keys) {
        if (!componentLookup.has(key)) {
          componentLookup.set(key, comp);
        }
      }
    }

    const referencedChildKeys = new Set();
    const preparedComponents = sanitisedComponents.map(orig => {
      const clone = { ...orig, props: { ...(orig.props || {}) } };
      if (!clone.template_key && clone.templateKey) clone.template_key = clone.templateKey;
      const tKey = String(clone.template_key || clone.type || '').toLowerCase();
      if ((tKey === 'radio' || tKey === 'radios' || tKey === 'checkbox' || tKey === 'checkboxes') && Array.isArray(clone.props.items)) {
        const items = clone.props.items.map(item => {
          if (!item || typeof item !== 'object') return item;
          const next = { ...item };
          if (typeof next.hint === 'string' && next.hint.trim() === '') {
            delete next.hint;
          }
          if (next.conditionalChildId) {
            const child = componentLookup.get(String(next.conditionalChildId));
            if (child && child !== orig) {
              const refKey = child.id != null ? String(child.id) : (child.props?.name ? String(child.props.name) : null);
              if (refKey) referencedChildKeys.add(refKey);
              next.conditional = {
                questions: [
                  {
                    ...child,
                    props: { ...(child.props || {}) },
                  },
                ],
              };
            }
          }
          return next;
        });
        clone.props = { ...clone.props, items };
      }
      return clone;
    });

    const renderTargets = [];
    for (const comp of preparedComponents) {
      const key = comp && (comp.id != null ? String(comp.id) : (comp.props?.name ? String(comp.props.name) : null));
      if (key && referencedChildKeys.has(key)) continue;
      renderTargets.push({ ...comp, props: { ...(comp.props || {}) } });
    }

    const { canonicalJson, hash } = computePreviewSignature(renderTargets, language);
    const cacheKey = `${stepKey}|${language}|${hash}`;
    const now = Date.now();
    const cached = previewCache.get(cacheKey);
    if (cached) {
      if ((now - cached.createdAt) > PREVIEW_CACHE_TTL_MS) {
        removePreviewCacheEntry(cacheKey);
      } else {
        const fresh = touchPreviewCacheEntry(cacheKey) || cached;
        res.set('ETag', fresh.etag);
        res.set('X-Preview-Cache', 'hit');
        return res.status(200).type('text/html').send(fresh.html);
      }
    }

    res.set('X-Preview-Cache', 'miss');

    let html = '';
    for (const comp of renderTargets) {
      try {
        html += `${await renderComponentHtml(comp, 0)}\n`;
      } catch (error) {
        console.error('Preview component render failed', {
          stepId: rawStepId,
          language,
          componentId: comp.id || comp.props?.name || null,
          template: comp.template_key || null,
          message: error?.message || error,
        });
        return res.status(422).json({
          error: 'Failed to render component',
          componentId: comp.id || comp.props?.name || null,
          templateKey: comp.template_key || null,
          message: error?.message || 'Render error',
        });
      }
    }

    if (html) {
      try {
        const $ = cheerio.load(html);
        $('div.govuk-radios').each((_, group) => {
          const $group = $(group);
          $group.find('input.govuk-radios__input').each((__, inp) => {
            const $inp = $(inp);
            if (!$inp.attr('aria-controls') && $inp.attr('data-aria-controls')) {
              $inp.attr('aria-controls', $inp.attr('data-aria-controls'));
            }
            const condId = $inp.attr('aria-controls');
            if (!condId) return;
            const $cond = $('#' + condId);
            if (!$cond.length) return;
            const checked = $inp.is(':checked');
            $inp.attr('aria-expanded', checked ? 'true' : 'false');
            if (!checked) {
              if (!$cond.hasClass('govuk-radios__conditional--hidden')) $cond.addClass('govuk-radios__conditional--hidden');
            } else {
              $cond.removeClass('govuk-radios__conditional--hidden');
              const cleaned = ($cond.attr('style') || '').replace(/display:\s*none;?/, '');
              if (cleaned) $cond.attr('style', cleaned); else $cond.removeAttr('style');
            }
          });
        });
        $('div.govuk-checkboxes').each((_, group) => {
          const $group = $(group);
          $group.find('input.govuk-checkboxes__input').each((__, inp) => {
            const $inp = $(inp);
            if (!$inp.attr('aria-controls') && $inp.attr('data-aria-controls')) {
              $inp.attr('aria-controls', $inp.attr('data-aria-controls'));
            }
            const condId = $inp.attr('aria-controls');
            if (!condId) return;
            const $cond = $('#' + condId);
            if (!$cond.length) return;
            const checked = $inp.is(':checked');
            $inp.attr('aria-expanded', checked ? 'true' : 'false');
            if (!checked) {
              if (!$cond.hasClass('govuk-checkboxes__conditional--hidden')) $cond.addClass('govuk-checkboxes__conditional--hidden');
            } else {
              $cond.removeClass('govuk-checkboxes__conditional--hidden');
              const cleaned = ($cond.attr('style') || '').replace(/display:\s*none;?/, '');
              if (cleaned) $cond.attr('style', cleaned); else $cond.removeAttr('style');
            }
          });
        });
        html = $.html();
      } catch (e) {
        console.warn('conditional preprocess failed:', e.message);
      }
    }

    const doc = wrapGovukDoc(html);
    const etag = `W/"preview-${hash}"`;
    const entryWeight = estimateBytes(doc) + estimateBytes(canonicalJson);
    if (entryWeight <= PREVIEW_CACHE_MAX_WEIGHT) {
      previewCache.set(cacheKey, { html: doc, createdAt: now, weight: entryWeight, stepKey, etag });
      previewCacheWeight += entryWeight;
      trimPreviewCache(stepKey);
      res.set('X-Preview-Cache', 'store');
    } else {
      res.set('X-Preview-Cache', 'bypass');
    }

    res.set('ETag', etag);
    return res.status(200).type('text/html').send(doc);
  } catch (err) {
    console.error('POST /api/preview/step failed:', err);
    res.status(500).json({ error: 'Failed to render preview' });
  } finally {
    const duration = Date.now() - startedAt;
    if (duration > 2000) {
      console.warn('[preview] slow render', { durationMs: duration });
    }
  }
});

// POST /api/render/component
// Body: { templateKey?, version?, templateId?, props: {...} }
// Returns raw HTML rendered via the template's export_njk_template and provided props.
app.post('/api/render/component', async (req, res) => {
  try {
    const { templateKey, version, templateId, props } = req.body || {};
    if (!props) return res.status(400).json({ error: 'props required' });

    let rows;
    if (templateId) {
      [rows] = await pool.query(
        `SELECT export_njk_template
           FROM iset_intake.component_template
          WHERE id = ? AND status = 'active'`,
        [templateId]
      );
    } else if (templateKey) {
      const v = Number.isInteger(version) ? version : 1;
      [rows] = await pool.query(
        `SELECT export_njk_template
           FROM iset_intake.component_template
          WHERE template_key = ? AND version = ? AND status = 'active'`,
        [templateKey, v]
      );
    } else {
      return res.status(400).json({ error: 'templateKey or templateId required' });
    }

    const tpl = rows?.[0]?.export_njk_template;
    if (!tpl) return res.status(404).json({ error: 'Missing or inactive template' });

    let html;
    try {
      let normProps = props;
      try {
        const keyLower = (templateKey || rows?.[0]?.template_key || '').toLowerCase();
        // Normalise hint strings for choice components (radios, checkboxes, select)
        if ((keyLower === 'radio' || keyLower === 'radios' || keyLower === 'select' || keyLower === 'checkbox' || keyLower === 'checkboxes') && normProps && Array.isArray(normProps.items)) {
          normProps = { ...normProps, items: normProps.items.map(it => {
            if (it && typeof it.hint === 'string' && it.hint.trim() !== '') {
              return { ...it, hint: { text: it.hint } };
            }
            return it;
          }) };
        }
        // Backward compatibility for date-input nested props bug
        if ((keyLower === 'date' || keyLower === 'date-input') && normProps) {
          const nested = normProps?.props?.items;
          if (Array.isArray(nested) && (!Array.isArray(normProps.items) || nested.some(n => n?.autocomplete))) {
            normProps = { ...normProps, items: nested };
          }
        }
        // Prune empty errorMessage to avoid false error styling in working area
        if (normProps && normProps.errorMessage) {
          const em = normProps.errorMessage;
          let empty = false;
          if (typeof em.text === 'string') empty = em.text.trim() === '';
          else if (em && typeof em.text === 'object' && em.text !== null) {
            const vals = Object.values(em.text).map(v => typeof v === 'string' ? v.trim() : '');
            empty = vals.length > 0 && vals.every(v => v === '');
          } else if (!em.text) empty = true;
          if (empty) {
            const { errorMessage, ...rest } = normProps;
            normProps = rest;
          }
        }
      } catch { /* ignore normalisation errors */ }
      html = env.renderString(tpl, { props: normProps });
    } catch (e) {
      console.error('Nunjucks render error:', e);
      return res.status(500).json({ error: 'Render failed', details: String(e).slice(0, 200) });
    }
    res.type('html').send(html);
  } catch (err) {
    console.error('POST /api/render/component failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Dev-only: seed a simple content-only Text component template into the template catalog
// Enable by setting ENABLE_DEV_SEED_TEMPLATES=true
app.post('/api/dev/seed-text-template', async (req, res) => {
  try {
    const enabled = String(process.env.ENABLE_DEV_SEED_TEMPLATES || 'false').toLowerCase() === 'true';
    if (!enabled) return res.status(403).json({ error: 'Seeding disabled. Set ENABLE_DEV_SEED_TEMPLATES=true to enable.' });

    // Determine next version for this template_key
    const templateKey = 'text-block'; // avoid collision with input type "text"
    const [[verRow]] = await pool.query(
      `SELECT COALESCE(MAX(version), 0) AS v
         FROM iset_intake.component_template
        WHERE template_key = ?`,
      [templateKey]
    );
    const nextVersion = Number(verRow?.v || 0) + 1;

    const defaultProps = {
      text: 'Example text',
      classes: 'govuk-body'
    };

    // Minimal editor schema for the Step Editor Properties panel
    const propSchema = [
      { label: 'Text', path: 'text', type: 'textarea', required: true },
      {
        label: 'Classes',
        path: 'classes',
        type: 'select',
        options: [
          'govuk-body', 'govuk-body-s', 'govuk-hint', 'govuk-inset-text',
          'govuk-heading-s', 'govuk-heading-m', 'govuk-heading-l', 'govuk-heading-xl',
          'govuk-label--s', 'govuk-label--m', 'govuk-label--l', 'govuk-label--xl'
        ]
      }
    ];

    // Nunjucks template: choose element based on classes
  const exportNunjucks = `
{% set cls = props.classes or 'govuk-body' %}
{% set text = props.text or '' %}
{% if cls and (cls.indexOf('govuk-inset-text') != -1) %}
<div class="govuk-inset-text">{{ text }}</div>
{% elif cls and (cls.indexOf('govuk-heading-xl') != -1) %}
<h1 class="govuk-heading-xl">{{ text }}</h1>
{% elif cls and (cls.indexOf('govuk-heading-l') != -1) %}
<h2 class="govuk-heading-l">{{ text }}</h2>
{% elif cls and (cls.indexOf('govuk-heading-m') != -1) %}
<h3 class="govuk-heading-m">{{ text }}</h3>
{% elif cls and (cls.indexOf('govuk-heading-s') != -1) %}
<h4 class="govuk-heading-s">{{ text }}</h4>
{% else %}
<p class="{{ cls }}">{{ text }}</p>
{% endif %}`;

    await pool.query(
      `INSERT INTO iset_intake.component_template
         (template_key, version, type, label, description, default_props, prop_schema, has_options, option_schema, status, export_njk_template)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        templateKey,
        nextVersion,
        'paragraph', // distinct from input 'text'
        'Text',
        'Static text block (headings or body).',
        JSON.stringify(defaultProps),
        JSON.stringify(propSchema),
        0,
        null,
        'active',
        exportNunjucks
      ]
    );

    res.status(201).json({ ok: true, template_key: templateKey, version: nextVersion });
  } catch (err) {
    console.error('Seed text template failed:', err);
    res.status(500).json({ error: 'Failed to seed text template' });
  }
});

// GET /api/audit/parity-sample?templateKey=radio
// Renders the latest active template and performs basic GOV.UK structure checks.
app.get('/api/audit/parity-sample', async (req, res) => {
  try {
    const { templateKey } = req.query;
    if (!templateKey) return res.status(400).json({ error: 'templateKey required' });
    const [[row]] = await pool.query(
      `SELECT export_njk_template, default_props, type
         FROM iset_intake.component_template
        WHERE template_key = ? AND status='active'
        ORDER BY version DESC
        LIMIT 1`,
      [templateKey]
    );
    if (!row) return res.status(404).json({ error: 'Template not found' });
    const props = (() => { try { return JSON.parse(row.default_props || '{}'); } catch { return {}; } })();
    const html = env.renderString(row.export_njk_template, { props });
    const $ = cheerio.load(html);
    const issues = [];
    // Minimal checks by type
    const t = String(row.type || '').toLowerCase();
    if (t === 'radio' || t === 'radios') {
      if ($('.govuk-radios').length === 0) issues.push('Missing .govuk-radios container');
      if ($('input.govuk-radios__input[type="radio"]').length === 0) issues.push('No radio inputs');
      if ($('.govuk-fieldset__legend').length === 0) issues.push('Missing fieldset legend');
    } else if (t === 'checkbox' || t === 'checkboxes') {
      if ($('.govuk-checkboxes').length === 0) issues.push('Missing .govuk-checkboxes container');
      if ($('input.govuk-checkboxes__input[type="checkbox"]').length === 0) issues.push('No checkbox inputs');
      if ($('.govuk-fieldset__legend').length === 0) issues.push('Missing fieldset legend');
    } else if (t === 'input' || t === 'text') {
      if ($('input.govuk-input').length === 0) issues.push('No govuk input');
      if ($('label.govuk-label').length === 0) issues.push('Missing label');
    } else if (t === 'textarea' || t === 'character-count') {
      if ($('textarea.govuk-textarea').length === 0 && $('.govuk-character-count').length === 0) issues.push('No textarea/character-count');
    } else if (t === 'select') {
      if ($('select.govuk-select').length === 0) issues.push('No govuk select');
    } else if (t === 'date' || t === 'date-input') {
      if ($('.govuk-date-input').length === 0) issues.push('No govuk date-input');
    } else if (t === 'file-upload') {
      if ($('input.govuk-file-upload[type="file"]').length === 0) issues.push('No file upload input');
    }
    res.json({ templateKey, type: t, issues, ok: issues.length === 0, html });
  } catch (err) {
    console.error('GET /api/audit/parity-sample failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/component-templates/panel/version
// Creates a new version of the panel template (id provided or discovered by template_key='panel')
// Adds support for html body (html vs text) while retaining titleText.
app.post('/api/component-templates/panel/version', async (req, res) => {
  try {
    // Find current latest active panel template
    const [[row]] = await pool.query(`SELECT * FROM iset_intake.component_template WHERE template_key='panel' AND status='active' ORDER BY version DESC LIMIT 1`);
    if (!row) return res.status(404).json({ error: 'panel_template_not_found' });
    const currentVersion = Number(row.version || 0);
    const nextVersion = currentVersion + 1;
    const defaultProps = (() => { try { return JSON.parse(row.default_props); } catch { return {}; } })();
    // Promote existing text to html if html not present
    if (!defaultProps.html && defaultProps.text) {
      // Preserve line breaks
      defaultProps.html = String(defaultProps.text).replace(/\n/g, '<br>');
    }
    if (!defaultProps.titleText) defaultProps.titleText = 'Application complete';
    // Remove now redundant plain text if both html & text exist (keep html authoritative)
    if (defaultProps.html) delete defaultProps.text;
    if (typeof defaultProps.headingLevel === 'undefined') defaultProps.headingLevel = 1;
    if (typeof defaultProps.classes === 'undefined') defaultProps.classes = '';

    const newPropSchema = [
      { key: 'titleText', path: 'titleText', type: 'text', label: 'Title Text' },
      { key: 'html', path: 'html', type: 'textarea', label: 'HTML Content' },
      { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' },
      { key: 'headingLevel', path: 'headingLevel', type: 'number', label: 'Heading Level' }
    ];

    const newNunjucks = `{% from "govuk/components/panel/macro.njk" import govukPanel %}\n\n{{ govukPanel({\n  titleText: props.titleText,\n  html: props.html,\n  headingLevel: props.headingLevel,\n  classes: props.classes\n}) }}`;

    await pool.query(
      `INSERT INTO iset_intake.component_template
        (template_key, version, type, label, description, default_props, prop_schema, has_options, option_schema, status, export_njk_template)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        row.template_key,
        nextVersion,
        row.type || 'panel',
        'Panel',
        'Confirmation / summary panel with title and HTML body.',
        JSON.stringify(defaultProps),
        JSON.stringify(newPropSchema),
        row.has_options || 0,
        row.option_schema || null,
        'active',
        newNunjucks
      ]
    );

    res.status(201).json({ ok: true, template_key: row.template_key, version: nextVersion });
  } catch (e) {
    console.error('panel version create failed', e);
    res.status(500).json({ error: 'panel_version_failed', details: e.message });
  }
});

// POST /api/component-templates/character-count/version2
// Creates a new version (v2) of the character-count template with expanded schema & i18n-aware text fields.
app.post('/api/component-templates/character-count/version2', async (_req, res) => {
  try {
    const [[row]] = await pool.query(`SELECT * FROM iset_intake.component_template WHERE template_key='character-count' AND status='active' ORDER BY version DESC LIMIT 1`);
    const currentVersion = row ? Number(row.version || 0) : 0;
    const nextVersion = currentVersion + 1;
    // Build new default props (preserve existing where possible)
    const base = (() => { try { return row ? JSON.parse(row.default_props || '{}') : {}; } catch { return {}; } })();
    const defaultProps = {
      name: base.name || 'message',
      id: base.id || '',
      label: base.label && typeof base.label === 'object' ? base.label : { text: base.label?.text || 'Message' },
      hint: base.hint && typeof base.hint === 'object' ? base.hint : { text: base.hint?.text || 'Do not include personal information.' },
      errorMessage: base.errorMessage && typeof base.errorMessage === 'object' ? base.errorMessage : { text: '' },
      formGroup: base.formGroup || { classes: '' },
      classes: base.classes || 'govuk-!-margin-bottom-6',
      rows: base.rows || 5,
      maxlength: base.maxlength || 200,
      threshold: base.threshold || 75,
      maxwords: base.maxwords || null,
      autocomplete: base.autocomplete || '',
      spellcheck: typeof base.spellcheck === 'boolean' ? base.spellcheck : true,
      value: base.value || ''
    };
    // Editable field schema (v2)
    const propSchema = [
      { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
      { key: 'id', path: 'id', type: 'text', label: 'ID' },
      { key: 'label.text', path: 'label.text', type: 'text', label: 'Label Text' },
      { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: ['govuk-label--s','govuk-label--m','govuk-label--l','govuk-label--xl','govuk-visually-hidden'] },
      { key: 'hint.text', path: 'hint.text', type: 'text', label: 'Hint Text' },
      { key: 'errorMessage.text', path: 'errorMessage.text', type: 'text', label: 'Error Message' },
      { key: 'rows', path: 'rows', type: 'number', label: 'Rows' },
      { key: 'maxlength', path: 'maxlength', type: 'number', label: 'Max Length (chars)' },
      { key: 'threshold', path: 'threshold', type: 'number', label: 'Threshold (%)' },
      { key: 'maxwords', path: 'maxwords', type: 'number', label: 'Max Words (optional)' },
      { key: 'autocomplete', path: 'autocomplete', type: 'text', label: 'Autocomplete' },
      { key: 'spellcheck', path: 'spellcheck', type: 'boolean', label: 'Spellcheck' },
      { key: 'value', path: 'value', type: 'textarea', label: 'Default Value' },
      { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
    ];
    // Updated Nunjucks (gracefully handle maxwords)
    const exportNunjucks = `{% from "govuk/components/character-count/macro.njk" import govukCharacterCount %}\n\n{{ govukCharacterCount({\n  name: props.name,\n  id: props.id or props.name,\n  rows: props.rows,\n  maxlength: props.maxlength,\n  maxwords: props.maxwords,\n  threshold: props.threshold,\n  label: props.label,\n  hint: props.hint,\n  errorMessage: props.errorMessage,\n  formGroup: props.formGroup,\n  classes: props.classes,\n  autocomplete: props.autocomplete,\n  spellcheck: props.spellcheck,\n  value: props.value\n}) }}`;
    await pool.query(
      `INSERT INTO iset_intake.component_template (template_key, version, type, label, description, default_props, prop_schema, has_options, option_schema, status, export_njk_template)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        'character-count',
        nextVersion,
        'character-count',
        'Character Count',
        'Textarea with live character/word count (v2)',
        JSON.stringify(defaultProps),
        JSON.stringify(propSchema),
        0,
        null,
        'active',
        exportNunjucks
      ]
    );
    res.status(201).json({ ok: true, template_key: 'character-count', version: nextVersion });
  } catch (e) {
    console.error('character-count v2 create failed', e);
    res.status(500).json({ error: 'character_count_v2_failed', details: e.message });
  }
});

// POST /api/component-templates/textarea/version2
// Creates a new version (v2) of the textarea template with bilingual-ready defaults and expanded schema.
app.post('/api/component-templates/textarea/version2', async (_req, res) => {
  try {
    const [[row]] = await pool.query(`SELECT * FROM iset_intake.component_template WHERE template_key='textarea' AND status='active' ORDER BY version DESC LIMIT 1`);
    const currentVersion = row ? Number(row.version || 0) : 0;
    const nextVersion = currentVersion + 1;
    const base = (() => { try { return row ? JSON.parse(row.default_props || '{}') : {}; } catch { return {}; } })();
    const defaultProps = {
      name: base.name || 'more-detail',
      id: base.id || (base.name || 'more-detail'),
      label: base.label && typeof base.label === 'object' ? base.label : { text: base.label?.text || base.label || 'Textarea input', classes: (base.label && base.label.classes) || 'govuk-label--m' },
      hint: base.hint && typeof base.hint === 'object' ? base.hint : { text: base.hint?.text || "Don't include personal or financial information." },
      errorMessage: base.errorMessage && typeof base.errorMessage === 'object' ? base.errorMessage : { text: '' },
      classes: base.classes || '',
      rows: base.rows || 5,
      autocomplete: base.autocomplete || '',
      spellcheck: typeof base.spellcheck === 'boolean' ? base.spellcheck : true,
      value: base.value || ''
    };
    const propSchema = [
      { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
      { key: 'id', path: 'id', type: 'text', label: 'ID' },
      { key: 'label.text', path: 'label.text', type: 'text', label: 'Label Text' },
      { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: ['govuk-label--s','govuk-label--m','govuk-label--l','govuk-label--xl','govuk-visually-hidden'] },
      { key: 'hint.text', path: 'hint.text', type: 'text', label: 'Hint Text' },
      { key: 'rows', path: 'rows', type: 'number', label: 'Rows' },
      { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' },
      { key: 'autocomplete', path: 'autocomplete', type: 'text', label: 'Autocomplete' },
      { key: 'spellcheck', path: 'spellcheck', type: 'boolean', label: 'Spellcheck' },
      { key: 'value', path: 'value', type: 'textarea', label: 'Default Value' }
    ];
    const nunjucks = `{% from "govuk/components/textarea/macro.njk" import govukTextarea %}\n\n{{ govukTextarea({\n  name: props.name,\n  id: props.id or props.name,\n  label: props.label,\n  hint: props.hint,\n  errorMessage: props.errorMessage,\n  classes: props.classes,\n  rows: props.rows,\n  autocomplete: props.autocomplete,\n  spellcheck: props.spellcheck,\n  value: props.value\n}) }}`;
    await pool.query(
      `INSERT INTO iset_intake.component_template (template_key, version, type, label, description, default_props, prop_schema, has_options, option_schema, status, export_njk_template)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        'textarea',
        nextVersion,
        'textarea',
        'Textarea',
        'Multi-line text input (v2)',
        JSON.stringify(defaultProps),
        JSON.stringify(propSchema),
        0,
        null,
        'active',
        nunjucks
      ]
    );
    res.status(201).json({ ok: true, template_key: 'textarea', version: nextVersion });
  } catch (e) {
    console.error('textarea v2 create failed', e);
    res.status(500).json({ error: 'textarea_v2_failed', details: e.message });
  }
});

// POST /api/component-templates/prune-old
// Marks older active versions (status='active') of each template_key as 'inactive', keeping only the highest version active.
app.post('/api/component-templates/prune-old', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT template_key, MAX(version) AS maxv FROM iset_intake.component_template WHERE status='active' GROUP BY template_key`);
    let totalUpdated = 0;
    for (const r of rows) {
      const { template_key, maxv } = r;
      const [result] = await pool.query(
        `UPDATE iset_intake.component_template SET status='inactive' WHERE template_key=? AND status='active' AND version < ?`,
        [template_key, maxv]
      );
      totalUpdated += result.affectedRows || 0;
    }
    res.status(200).json({ ok: true, deactivated: totalUpdated });
  } catch (e) {
    console.error('prune-old failed', e);
    res.status(500).json({ error: 'prune_failed', details: e.message });
  }
});

// Helper: run minimal GOV.UK structure checks by component type
function parityChecks($, type, props) {
  const t = String(type || '').toLowerCase();
  const issues = [];
  // Helper: form-group presence
  const hasFormGroup = $('.govuk-form-group').length > 0;
  const hasErrorGroup = $('.govuk-form-group--error').length > 0;
  const expectOptions = Array.isArray(props?.items) && props.items.length > 0;
  const expectLabel = !!(props?.label?.text || props?.fieldset?.legend?.text || props?.titleText);

  if (t === 'radio' || t === 'radios') {
    if ($('.govuk-radios').length === 0) issues.push('Missing .govuk-radios container');
    if ($('input.govuk-radios__input[type="radio"]').length === 0) issues.push('No radio inputs');
    if ($('fieldset.govuk-fieldset').length === 0) issues.push('Missing fieldset');
    if ($('.govuk-fieldset__legend').length === 0) issues.push('Missing fieldset legend');
    // All radios should share same name
    const names = new Set();
    $('input.govuk-radios__input[type="radio"]').each((_, el) => { const n = $(el).attr('name'); if (n) names.add(n); });
    if (names.size > 1) issues.push('Radio inputs do not share the same name');
    // Label-for association
    $('input.govuk-radios__input[type="radio"]').each((_, el) => {
      const id = $(el).attr('id');
      if (!id) issues.push('Radio input missing id');
      const lab = id ? $(`label.govuk-label[for="${id}"]`) : null;
      if (id && (!lab || lab.length === 0)) issues.push(`Missing label[for=${id}]`);
    });
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'checkbox' || t === 'checkboxes') {
    if ($('.govuk-checkboxes').length === 0) issues.push('Missing .govuk-checkboxes container');
    if ($('input.govuk-checkboxes__input[type="checkbox"]').length === 0) issues.push('No checkbox inputs');
    if ($('fieldset.govuk-fieldset').length === 0) issues.push('Missing fieldset');
    if ($('.govuk-fieldset__legend').length === 0) issues.push('Missing fieldset legend');
    // Label-for association
    $('input.govuk-checkboxes__input[type="checkbox"]').each((_, el) => {
      const id = $(el).attr('id');
      if (!id) issues.push('Checkbox input missing id');
      const lab = id ? $(`label.govuk-label[for="${id}"]`) : null;
      if (id && (!lab || lab.length === 0)) issues.push(`Missing label[for=${id}]`);
    });
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'input' || t === 'text' || t === 'email' || t === 'number' || t === 'password' || t === 'phone' || t === 'password-input') {
    if ($('input.govuk-input').length === 0) issues.push('No govuk input');
    if ($('label.govuk-label').length === 0) issues.push('Missing label');
    const input = $('input.govuk-input').first();
    const id = input.attr('id');
    if (!id) issues.push('Input missing id');
    if (id && $(`label.govuk-label[for="${id}"]`).length === 0) issues.push('Label not associated via for=');
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'textarea' || t === 'character-count') {
    if ($('textarea.govuk-textarea').length === 0 && $('.govuk-character-count').length === 0) issues.push('No textarea/character-count');
    const ta = $('textarea.govuk-textarea').first();
    if (ta && ta.length) {
      const id = ta.attr('id');
      if (!id) issues.push('Textarea missing id');
      if (id && $(`label.govuk-label[for="${id}"]`).length === 0) issues.push('Label not associated via for=');
    }
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'select') {
    if ($('select.govuk-select').length === 0) issues.push('No govuk select');
    const sel = $('select.govuk-select').first();
    const id = sel.attr('id');
    if (!id) issues.push('Select missing id');
    if (id && $(`label.govuk-label[for="${id}"]`).length === 0) issues.push('Label not associated via for=');
    if (expectOptions && $('select.govuk-select option').length === 0) issues.push('No options rendered');
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'date' || t === 'date-input') {
    if ($('.govuk-date-input').length === 0) issues.push('No govuk date-input');
    const base = $('.govuk-date-input');
    if (base.length) {
      const inputs = base.find('input');
      if (inputs.length < 3) issues.push('Date input missing parts');
    }
    if ($('.govuk-fieldset__legend').length === 0) issues.push('Missing fieldset legend');
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'file-upload') {
    if ($('input.govuk-file-upload[type="file"]').length === 0) issues.push('No file upload input');
    const fu = $('input.govuk-file-upload[type="file"]').first();
    const id = fu.attr('id');
    if (!id) issues.push('File upload missing id');
    if (id && $(`label.govuk-label[for="${id}"]`).length === 0) issues.push('Label not associated via for=');
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'details') {
    if ($('details.govuk-details').length === 0) issues.push('No govuk details');
  } else if (t === 'accordion') {
    if ($('.govuk-accordion').length === 0) issues.push('No govuk accordion');
  } else if (t === 'label' || t === 'paragraph' || t === 'inset-text' || t === 'warning-text' || t === 'panel' || t === 'summary-list') {
    // Content components: best-effort checks
    // No strict checks beyond presence
  }
  return issues;
}

// GET /api/audit/parity-all?limit=50
// Iterate active component templates and report basic parity issues per type
app.get('/api/audit/parity-all', async (req, res) => {
  try {
    const limit = Math.max(0, parseInt(req.query.limit || '0', 10)) || null;
    const [rows] = await pool.query(
      `SELECT template_key, version, type, status, default_props, export_njk_template
         FROM iset_intake.component_template
        WHERE status='active'
        ORDER BY template_key, version DESC`
    );
    const seen = new Set();
    const list = [];
    for (const r of rows) {
      const key = r.template_key;
      if (seen.has(key)) continue; // take highest version per key
      seen.add(key);
      list.push(r);
      if (limit && list.length >= limit) break;
    }
    const results = [];
    for (const r of list) {
      let props = {};
      try { props = typeof r.default_props === 'string' ? JSON.parse(r.default_props) : (r.default_props || {}); } catch {}
      const t = String(r.type || '').toLowerCase();
      // Inject minimal props for structure checks if missing
      if (t === 'radio' || t === 'radios') {
        if (!props.fieldset) props.fieldset = { legend: { text: 'Choose one' } };
        if (!Array.isArray(props.items) || props.items.length === 0) props.items = [{ text: 'Option A', value: 'a' }, { text: 'Option B', value: 'b' }];
      } else if (t === 'checkbox' || t === 'checkboxes') {
        if (!props.fieldset) props.fieldset = { legend: { text: 'Select all that apply' } };
        if (!Array.isArray(props.items) || props.items.length === 0) props.items = [{ text: 'Alpha', value: 'a' }, { text: 'Beta', value: 'b' }];
      } else if (t === 'select') {
        if (!props.label) props.label = { text: 'Pick one' };
        if (!Array.isArray(props.items) || props.items.length === 0) props.items = [{ text: 'One', value: '1' }, { text: 'Two', value: '2' }];
      } else if (t === 'input' || t === 'text' || t === 'email' || t === 'number' || t === 'password' || t === 'phone' || t === 'password-input') {
        if (!props.label) props.label = { text: 'Label' };
      } else if (t === 'textarea' || t === 'character-count') {
        if (!props.label) props.label = { text: 'Label' };
      } else if (t === 'date' || t === 'date-input') {
        if (!props.fieldset) props.fieldset = { legend: { text: 'Date of birth' } };
      } else if (t === 'file-upload') {
        if (!props.label) props.label = { text: 'Upload a file' };
      } else if (t === 'paragraph') {
        if (!props.text) props.text = 'Paragraph text';
      }
      let issues = [];
      let renderError = null;
      try {
        const html = env.renderString(r.export_njk_template || '', { props });
        const $ = cheerio.load(html || '');
        issues = parityChecks($, r.type, props);
      } catch (e) {
        renderError = String(e.message || e).slice(0, 300);
      }
      results.push({
        template_key: r.template_key,
        version: r.version,
        type: r.type,
        ok: !renderError && issues.length === 0,
        issues,
        error: renderError,
      });
    }
    const summary = {
      total: results.length,
      ok: results.filter(x => x.ok).length,
      withIssues: results.filter(x => x.issues && x.issues.length).length,
      withErrors: results.filter(x => x.error).length,
      byType: Object.fromEntries(
        Array.from(new Set(results.map(r => String(r.type || '').toLowerCase())))
          .map(t => [t, {
            total: results.filter(r => String(r.type || '').toLowerCase() === t).length,
            ok: results.filter(r => String(r.type || '').toLowerCase() === t && r.ok).length,
          }])
      )
    };
    res.json({ summary, results });
  } catch (err) {
    console.error('GET /api/audit/parity-all failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/audit/parity-portal?templateKey=radios
// Compare NJK structure with a derived portal component shape for a single template
app.get('/api/audit/parity-portal', async (req, res) => {
  try {
    const { templateKey } = req.query;
    if (!templateKey) return res.status(400).json({ error: 'templateKey required' });
    const [[tpl]] = await pool.query(
      `SELECT template_key, version, type, default_props, export_njk_template
         FROM iset_intake.component_template
        WHERE template_key = ? AND status='active'
        ORDER BY version DESC
        LIMIT 1`,
      [templateKey]
    );
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    const props = (() => { try { return JSON.parse(tpl.default_props || '{}'); } catch { return {}; } })();
    // Render NJK
    let html = '';
    try { html = env.renderString(tpl.export_njk_template || '', { props }); } catch (e) {}
    const $ = cheerio.load(html || '');

    // Derive portal component shape (minimal)
    const tplType = String(tpl.type || '').toLowerCase();
    const normalisedType = (tplType === 'checkbox' ? 'checkboxes' : (tplType === 'radios' ? 'radio' : tplType));
    const labelText = props?.fieldset?.legend?.text ?? props?.label?.text ?? props?.titleText ?? '';
    const hintText = props?.hint?.text ?? props?.text ?? '';
    let options = [];
    if (['radio', 'radios', 'checkbox', 'checkboxes', 'select'].includes(tplType)) {
      const items = Array.isArray(props?.items) ? props.items : [];
      options = items.map(it => ({
        label: it?.text ?? it?.html ?? String(it?.value ?? ''),
        value: typeof it?.value !== 'undefined' ? it.value : (it?.text ?? it?.html ?? '')
      }));
    }
    const portal = {
      type: normalisedType,
      label: labelText,
      hint: hintText,
      optionsCount: options.length,
    };

    // NJK structural capture
    const struct = { container: null, inputsCount: 0, legendText: null };
    if (normalisedType === 'radio') {
      struct.container = $('.govuk-radios').length > 0;
      struct.inputsCount = $('input.govuk-radios__input[type="radio"]').length;
      struct.legendText = $('.govuk-fieldset__legend').first().text().trim() || null;
    } else if (normalisedType === 'checkboxes') {
      struct.container = $('.govuk-checkboxes').length > 0;
      struct.inputsCount = $('input.govuk-checkboxes__input[type="checkbox"]').length;
      struct.legendText = $('.govuk-fieldset__legend').first().text().trim() || null;
    } else if (normalisedType === 'select') {
      struct.container = $('select.govuk-select').length > 0;
      struct.inputsCount = $('select.govuk-select option').length;
      struct.legendText = $('label.govuk-label').first().text().trim() || null;
    } else if (normalisedType === 'input') {
      struct.container = $('input.govuk-input').length > 0;
      struct.inputsCount = $('input.govuk-input').length;
      struct.legendText = $('label.govuk-label').first().text().trim() || null;
    } else if (normalisedType === 'textarea') {
      struct.container = $('textarea.govuk-textarea').length > 0;
      struct.inputsCount = $('textarea.govuk-textarea').length;
      struct.legendText = $('label.govuk-label').first().text().trim() || null;
    } else if (normalisedType === 'date-input') {
      struct.container = $('.govuk-date-input').length > 0;
      struct.inputsCount = $('.govuk-date-input input').length;
      struct.legendText = $('.govuk-fieldset__legend').first().text().trim() || null;
    } else if (normalisedType === 'file-upload') {
      struct.container = $('input.govuk-file-upload[type="file"]').length > 0;
      struct.inputsCount = $('input.govuk-file-upload[type="file"]').length;
      struct.legendText = $('label.govuk-label').first().text().trim() || null;
    }

    // Issues
    const issues = [];
    // Expect a visible label/legend when props include it
    const expectsLabel = !!(props?.fieldset?.legend?.text || props?.label?.text || props?.titleText);
    if (normalisedType === 'radio' || normalisedType === 'checkboxes') {
      if (!struct.container) issues.push('Missing container');
      if (portal.optionsCount && struct.inputsCount && portal.optionsCount !== struct.inputsCount) {
        issues.push(`Input count mismatch: options=${portal.optionsCount} njk=${struct.inputsCount}`);
      }
      if (expectsLabel && (!struct.legendText || !struct.legendText.length)) {
        issues.push('Missing legend text');
      }
      if (portal.label && struct.legendText && struct.legendText.length && !struct.legendText.toLowerCase().includes(String(portal.label).toLowerCase())) {
        issues.push('Legend text does not include label');
      }
    } else if (['input','textarea','select','date-input','file-upload'].includes(normalisedType)) {
      if (!struct.container) issues.push('Missing core container element');
      if (normalisedType === 'select' && expectsLabel && (!struct.legendText || !struct.legendText.length)) {
        issues.push('Missing select label');
      }
      if (normalisedType === 'select' && portal.optionsCount && struct.inputsCount && portal.optionsCount !== struct.inputsCount) {
        issues.push(`Option count mismatch: options=${portal.optionsCount} njk=${struct.inputsCount}`);
      }
    }

    res.json({
      templateKey,
      type: tpl.type,
      portal,
      njk: struct,
      ok: issues.length === 0,
      issues,
    });
  } catch (err) {
    console.error('GET /api/audit/parity-portal failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Utility: resolve simple JSONPath-like strings used in prop_schema, e.g. "label.text", "items[0].value"
function getByPath(obj, path) {
  try {
    if (!path) return undefined;
    const tokens = path
      .replace(/\[(\d+)\]/g, '.$1') // items[0].value -> items.0.value
      .split('.')
      .filter(Boolean);
    return tokens.reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  } catch {
    return undefined;
  }
}

// GET /api/audit/component-templates
// Optional query: ?limit=nn
app.get('/api/audit/component-templates', async (req, res) => {
  try {
    const limit = Math.max(0, parseInt(req.query.limit || '0', 10)) || null;
    const [rows] = await pool.query(
      `SELECT id, template_key, version, type, status,
              default_props, prop_schema, has_options, option_schema, export_njk_template
         FROM iset_intake.component_template
         ORDER BY template_key, version`
    );
    const slice = limit ? rows.slice(0, limit) : rows;

    const results = [];
    for (const r of slice) {
      const issues = [];
      let renderOk = false;
      let renderError = null;

      let props = {};
      try {
        props = typeof r.default_props === 'string' ? JSON.parse(r.default_props) : (r.default_props || {});
      } catch (e) {
        issues.push({ code: 'DEFAULT_PROPS_INVALID_JSON', detail: String(e).slice(0, 160) });
      }

      // Check prop_schema paths exist in default_props
      let schema = [];
      try {
        schema = typeof r.prop_schema === 'string' ? JSON.parse(r.prop_schema) : (r.prop_schema || []);
      } catch (e) {
        issues.push({ code: 'PROP_SCHEMA_INVALID_JSON', detail: String(e).slice(0, 160) });
      }
      const missingPaths = [];
      if (Array.isArray(schema)) {
        for (const fld of schema) {
          const pth = fld?.path;
          if (pth) {
            const val = getByPath(props, pth);
            if (typeof val === 'undefined') {
              missingPaths.push({ key: fld.key || null, path: pth });
            }
          }
        }
      }
      if (missingPaths.length) {
        issues.push({ code: 'PROP_SCHEMA_PATH_MISSING_IN_DEFAULTS', detail: missingPaths });
      }

      // Option sanity checks
      const itemsVal = getByPath(props, 'items');
      if (r.has_options) {
        if (!Array.isArray(itemsVal) || itemsVal.length === 0) {
          issues.push({ code: 'HAS_OPTIONS_BUT_NO_ITEMS', detail: 'has_options=1 but default_props.items missing/empty' });
        }
      }
      if ((r.type === 'radio' || r.type === 'checkboxes')) {
        const legendText = getByPath(props, 'fieldset.legend.text');
        if (!legendText) {
          issues.push({ code: 'FIELDSET_LEGEND_TEXT_MISSING', detail: 'fieldset.legend.text should exist for radios/checkboxes' });
        }
        if (!Array.isArray(itemsVal) || itemsVal.length === 0) {
          issues.push({ code: 'CHOICE_ITEMS_MISSING', detail: 'radios/checkboxes should define props.items[]' });
        }
      }

      // Render test (only if template present)
      if (!r.export_njk_template || !String(r.export_njk_template).trim()) {
        issues.push({ code: 'MISSING_TEMPLATE', detail: 'export_njk_template empty' });
      } else {
        try {
          // Render using real GOV.UK macros; macro imports live inside export_njk_template text.
          const html = env.renderString(r.export_njk_template, { props });
          if (!html || !html.trim()) {
            renderError = 'Empty HTML output';
          } else {
            renderOk = true;
          }
        } catch (e) {
          renderError = String(e && e.message ? e.message : e).slice(0, 300);
        }
      }
      if (renderError) {
        issues.push({ code: 'RENDER_ERROR', detail: renderError });
      }

      results.push({
        id: r.id,
        template_key: r.template_key,
        version: r.version,
        type: r.type,
        status: r.status,
        ok: issues.length === 0,
        warnings: issues.filter(i => i.code !== 'RENDER_ERROR' && i.code !== 'MISSING_TEMPLATE'),
        errors: issues.filter(i => i.code === 'RENDER_ERROR' || i.code === 'MISSING_TEMPLATE')
      });
    }

    const summary = {
      total: results.length,
      ok: results.filter(r => r.ok).length,
      withErrors: results.filter(r => r.errors.length).length,
      withWarnings: results.filter(r => r.warnings.length).length
    };
    res.json({ summary, results });
  } catch (err) {
    console.error('GET /api/audit/component-templates failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- helpers ---------------------------------------------------------------
function normaliseJson(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

const STEP_EDITOR_GROUPS = new Set(['SysAdmin', 'ProgramAdmin', 'RegionalCoordinator']);
const STEP_EDITOR_ROLES = new Set(['System Administrator', 'Program Administrator', 'Regional Coordinator']);

function isAuthEnabled() {
  return String(process.env.AUTH_PROVIDER || 'none').toLowerCase() === 'cognito';
}

function ensureStepEditor(req, res) {
  if (!isAuthEnabled()) return true;
  const groups = Array.isArray(req.auth?.groups) ? req.auth.groups : [];
  const role = req.auth?.role || null;
  if (groups.some(g => STEP_EDITOR_GROUPS.has(g)) || (role && STEP_EDITOR_ROLES.has(role))) {
    return true;
  }
  res.status(403).json({ error: 'Not authorized to manage intake steps' });
  return false;
}

// --- Steps API (DB-only, versioned component templates) --------------------
// List steps for the Workflow Editor's library
app.get('/api/steps', async (req, res) => {
  if (!ensureStepEditor(req, res)) return;
  try {
    const { q, limit, offset, status } = req.query;
    const filters = [];
    const params = [];
    if (typeof q === 'string' && q.trim()) {
      const search = `%${q.trim().toLowerCase().replace(/\s+/g, '%')}%`;
      filters.push('LOWER(s.name) LIKE ?');
      params.push(search);
    }
    if (typeof status === 'string' && status.trim()) {
      const allowedStatuses = ['draft', 'active', 'inactive'];
      const statuses = status.split(',').map(s => s.trim().toLowerCase()).filter(s => allowedStatuses.includes(s));
      if (statuses.length) {
        filters.push(`s.status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const pageSizeRaw = Number.parseInt(limit, 10);
    const offsetRaw = Number.parseInt(offset, 10);
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 1), 500) : 200;
    const offsetValue = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const selectSql = `
      SELECT
        s.id,
        s.name,
        s.status,
        s.created_at,
        s.updated_at,
        COUNT(sc.id) AS component_count
      FROM iset_intake.step s
      LEFT JOIN iset_intake.step_component sc ON sc.step_id = s.id
      ${whereClause}
      GROUP BY s.id, s.name, s.status, s.created_at, s.updated_at
      ORDER BY s.name
      LIMIT ? OFFSET ?
    `;
    const queryParams = [...params, pageSize, offsetValue];
    const [rows] = await pool.query(selectSql, queryParams);

    const countSql = `
      SELECT COUNT(*) AS total
      FROM iset_intake.step s
      ${whereClause}
    `;
    const [[countRow]] = await pool.query(countSql, params);

    res.status(200).json({
      items: rows,
      total: countRow.total,
      limit: pageSize,
      offset: offsetValue,
      query: typeof q === 'string' ? q : null
    });
  } catch (err) {
    console.error('GET /api/steps failed:', err);
    res.status(500).json({ error: 'Failed to fetch steps' });
  }
});

// --- Workflow CRUD API -----------------------------------------------------
// Data model recap:
// - workflow(id, name, status)
// - workflow_step(workflow_id, step_id, is_start)
// - workflow_route(workflow_id, source_step_id, mode('linear'|'by_option'), field_key, default_next_step_id)
// - workflow_route_option(workflow_id, source_step_id, option_value, next_step_id)

// Helpers
async function stepsExist(stepIds, conn) {
  if (!Array.isArray(stepIds) || stepIds.length === 0) return true;
  const [rows] = await conn.query(
    `SELECT id FROM iset_intake.step WHERE id IN (${stepIds.map(() => '?').join(',')})`,
    stepIds
  );
  return rows.length === stepIds.length;
}

async function getWorkflowDetails(workflowId) {
  const [[wf]] = await pool.query(
    `SELECT id, name, status, created_at, updated_at
       FROM iset_intake.workflow
      WHERE id = ?`,
    [workflowId]
  );
  if (!wf) return null;

  const [steps] = await pool.query(
    `SELECT ws.step_id AS id, s.name, ws.is_start
       FROM iset_intake.workflow_step ws
       JOIN iset_intake.step s ON s.id = ws.step_id
      WHERE ws.workflow_id = ?
      ORDER BY s.name`,
    [workflowId]
  );

  const [routes] = await pool.query(
    `SELECT workflow_id, source_step_id, mode, field_key, default_next_step_id
       FROM iset_intake.workflow_route
      WHERE workflow_id = ?
      ORDER BY source_step_id`,
    [workflowId]
  );
  const [opts] = await pool.query(
    `SELECT workflow_id, source_step_id, option_value, next_step_id
       FROM iset_intake.workflow_route_option
      WHERE workflow_id = ?
      ORDER BY source_step_id, option_value`,
    [workflowId]
  );
  // Attach options to their route
  const routesOut = routes.map(r => ({ ...r, options: [] }));
  for (const o of opts) {
    const idx = routesOut.findIndex(r => r.source_step_id === o.source_step_id);
    if (idx >= 0) routesOut[idx].options.push({ option_value: o.option_value, next_step_id: o.next_step_id });
  }

  return { ...wf, steps, routes: routesOut };
}

// List workflows
app.get('/api/workflows', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, status, created_at, updated_at
         FROM iset_intake.workflow
        ORDER BY updated_at DESC, id DESC`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('GET /api/workflows failed:', err);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

// Get a single workflow with steps and routes
app.get('/api/workflows/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const wf = await getWorkflowDetails(id);
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });
    res.status(200).json(wf);
  } catch (err) {
    console.error('GET /api/workflows/:id failed:', err);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// Create workflow
// Body: { name: string, status?: 'draft'|'active'|'inactive', steps: number[], start_step_id: number, routes?: [ { source_step_id, mode, field_key?, default_next_step_id?, options?: [{ option_value, next_step_id }] } ] }
app.post('/api/workflows', async (req, res) => {
  const { name, status = 'draft', steps = [], start_step_id = null, routes = [] } = req.body || {};
  if (!name || !Array.isArray(steps) || steps.length === 0 || !start_step_id) {
    return res.status(400).json({ error: 'name, steps[], and start_step_id are required' });
  }
  if (!steps.includes(start_step_id)) {
    return res.status(400).json({ error: 'start_step_id must be included in steps[]' });
  }
  try {
    const newId = await withTx(async (conn) => {
      if (!(await stepsExist(steps, conn))) {
        throw Object.assign(new Error('One or more step IDs are invalid'), { code: 400 });
      }
      const [ins] = await conn.query(
        `INSERT INTO iset_intake.workflow (name, status) VALUES (?, ?)`,
        [name, status]
      );
      const workflowId = ins.insertId;

      // Insert membership and start flag
      const wsValues = steps.map(stepId => [workflowId, stepId, stepId === start_step_id ? 1 : 0]);
      await conn.query(
        `INSERT INTO iset_intake.workflow_step (workflow_id, step_id, is_start) VALUES ?`,
        [wsValues]
      );

      // Insert routes
      if (Array.isArray(routes) && routes.length) {
        // Basic validation
        for (const r of routes) {
          if (!r || !r.source_step_id || !r.mode) {
            throw Object.assign(new Error('Each route requires source_step_id and mode'), { code: 400 });
          }
          if (r.mode === 'by_option' && !r.field_key) {
            throw Object.assign(new Error('by_option routes require field_key'), { code: 400 });
          }
        }
        const routeValues = routes.map(r => [workflowId, r.source_step_id, r.mode, r.field_key || null, r.default_next_step_id || null]);
        await conn.query(
          `INSERT INTO iset_intake.workflow_route (workflow_id, source_step_id, mode, field_key, default_next_step_id)
           VALUES ?`,
          [routeValues]
        );

        // Route options
        const optValues = [];
        for (const r of routes) {
          if (Array.isArray(r.options) && r.options.length) {
            for (const o of r.options) {
              if (!o || !o.option_value || !o.next_step_id) {
                throw Object.assign(new Error('route option requires option_value and next_step_id'), { code: 400 });
              }
              optValues.push([workflowId, r.source_step_id, String(o.option_value), o.next_step_id]);
            }
          }
        }
        if (optValues.length) {
          await conn.query(
            `INSERT INTO iset_intake.workflow_route_option (workflow_id, source_step_id, option_value, next_step_id)
             VALUES ?`,
            [optValues]
          );
        }
      }

      return workflowId;
    });
    res.status(201).json({ id: newId });
  } catch (err) {
    if (err.code === 400) return res.status(400).json({ error: err.message });
    console.error('POST /api/workflows failed:', err);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// Update workflow
// Body: { name?: string, status?: string, steps?: number[], start_step_id?: number, routes?: [...] }
app.put('/api/workflows/:id', async (req, res) => {
  const { id } = req.params;
  const { name, status, steps, start_step_id, routes } = req.body || {};
  try {
    await withTx(async (conn) => {
      // ensure workflow exists
      const [[wf]] = await conn.query(`SELECT id FROM iset_intake.workflow WHERE id = ?`, [id]);
      if (!wf) throw Object.assign(new Error('Workflow not found'), { code: 404 });

      if (name != null || status != null) {
        await conn.query(
          `UPDATE iset_intake.workflow SET
             name = COALESCE(?, name),
             status = COALESCE(?, status)
           WHERE id = ?`,
          [name ?? null, status ?? null, id]
        );
      }

      if (Array.isArray(steps)) {
        if (steps.length === 0) throw Object.assign(new Error('steps[] cannot be empty'), { code: 400 });
        const startId = start_step_id ?? null;
        if (startId && !steps.includes(startId)) {
          throw Object.assign(new Error('start_step_id must be in steps[]'), { code: 400 });
        }
        if (!(await stepsExist(steps, conn))) {
          throw Object.assign(new Error('One or more step IDs are invalid'), { code: 400 });
        }
        await conn.query(`DELETE FROM iset_intake.workflow_step WHERE workflow_id = ?`, [id]);
        const values = steps.map(stepId => [id, stepId, startId ? (stepId === startId ? 1 : 0) : 0]);
        await conn.query(
          `INSERT INTO iset_intake.workflow_step (workflow_id, step_id, is_start) VALUES ?`,
          [values]
        );
      } else if (start_step_id != null) {
        // Only update start flag
        await conn.query(`UPDATE iset_intake.workflow_step SET is_start = 0 WHERE workflow_id = ?`, [id]);
        await conn.query(`UPDATE iset_intake.workflow_step SET is_start = 1 WHERE workflow_id = ? AND step_id = ?`, [id, start_step_id]);
      }

      if (Array.isArray(routes)) {
        // Replace routes
        await conn.query(`DELETE FROM iset_intake.workflow_route_option WHERE workflow_id = ?`, [id]);
        await conn.query(`DELETE FROM iset_intake.workflow_route WHERE workflow_id = ?`, [id]);
        if (routes.length) {
          for (const r of routes) {
            if (!r || !r.source_step_id || !r.mode) {
              throw Object.assign(new Error('Each route requires source_step_id and mode'), { code: 400 });
            }
            if (r.mode === 'by_option' && !r.field_key) {
              throw Object.assign(new Error('by_option routes require field_key'), { code: 400 });
            }
          }
          const routeValues = routes.map(r => [id, r.source_step_id, r.mode, r.field_key || null, r.default_next_step_id || null]);
          await conn.query(
            `INSERT INTO iset_intake.workflow_route (workflow_id, source_step_id, mode, field_key, default_next_step_id)
             VALUES ?`,
            [routeValues]
          );
          const optValues = [];
          for (const r of routes) {
            if (Array.isArray(r.options) && r.options.length) {
              for (const o of r.options) {
                if (!o || !o.option_value || !o.next_step_id) {
                  throw Object.assign(new Error('route option requires option_value and next_step_id'), { code: 400 });
                }
                optValues.push([id, r.source_step_id, String(o.option_value), o.next_step_id]);
              }
            }
          }
          if (optValues.length) {
            await conn.query(
              `INSERT INTO iset_intake.workflow_route_option (workflow_id, source_step_id, option_value, next_step_id)
               VALUES ?`,
              [optValues]
            );
          }
        }
      }
    });
    res.status(200).json({ id, message: 'Workflow updated' });
  } catch (err) {
    if (err.code === 404) return res.status(404).json({ error: 'Workflow not found' });
    if (err.code === 400) return res.status(400).json({ error: err.message });
    console.error('PUT /api/workflows/:id failed:', err);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// Delete workflow (cascade removes children via FK)
app.delete('/api/workflows/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [r] = await pool.query(`DELETE FROM iset_intake.workflow WHERE id = ?`, [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Workflow not found' });
    res.status(200).json({ message: 'Workflow deleted' });
  } catch (err) {
    console.error('DELETE /api/workflows/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// --- Runtime Preview (normalized schema) --------------------------------------
// GET /api/workflows/:id/preview -> { steps, meta }
app.get('/api/workflows/:id/preview', async (req, res) => {
  if (!buildWorkflowSchema) return res.status(500).json({ error: 'preview_unavailable', message: 'Normalization module not loaded' });
  const { id } = req.params;
  const audit = String(req.query.auditTemplates || 'false').toLowerCase() === 'true';
  try {
    const out = await buildWorkflowSchema({ pool, workflowId: id, auditTemplates: audit });
    // Optional contract validation (dev aid): ?validate=true
    let validation = null;
    if (validateWorkflow && String(req.query.validate||'false').toLowerCase()==='true') {
      validation = validateWorkflow({ steps: out.steps, meta: out.meta });
    }
    res.status(200).json({ steps: out.steps, meta: out.meta, validation });
  } catch (e) {
    if (e.code === 404) return res.status(404).json({ error: 'Workflow not found' });
    if (e.code === 400) return res.status(400).json({ error: 'invalid_workflow', details: e.details, message: e.message });
    console.error('GET /api/workflows/:id/preview failed:', e);
    res.status(500).json({ error: 'Failed to build preview schema' });
  }
});

// Dev: validate workflow contract without fetching steps manually
app.get('/api/workflows/:id/validate', async (req,res) => {
  if (!buildWorkflowSchema || !validateWorkflow) return res.status(500).json({ error:'validator_unavailable' });
  try {
    const out = await buildWorkflowSchema({ pool, workflowId: req.params.id });
    const validation = validateWorkflow({ steps: out.steps, meta: out.meta });
    res.json(validation);
  } catch (e) {
    const status = e.code === 404 ? 404 : 500;
    res.status(status).json({ error: e.message });
  }
});

// Meta: list supported component types (helps admin UI understand renderer coverage)
app.get('/api/meta/supported-component-types', (_req, res) => {
  if (!SUPPORTED_COMPONENT_TYPES) return res.status(500).json({ error: 'not_available' });
  res.json({ types: Array.from(SUPPORTED_COMPONENT_TYPES) });
});

// (Legacy single-portal publish endpoint removed; dual-portal version defined earlier.)

// --- Component Templates API (for Step Editor library) ---------------------
// Returns the catalogue of reusable component templates (active only by default)
app.get('/api/component-templates', async (req, res) => {
  try {
    const onlyActive = (req.query.status ?? 'active') === 'active';
    const where = onlyActive ? "WHERE status = 'active'" : '';
    const [rows] = await pool.query(`
      SELECT
        id,
        template_key,
        version,
        type,
        label,
        description,
        default_props,
        prop_schema,
        has_options,
        option_schema,
        status
      FROM iset_intake.component_template
      ${where}
      ORDER BY label, template_key, version
    `);
    // When only active templates are requested, return only the highest version per template_key to avoid duplicates
    let filtered = rows;
    if (onlyActive) {
      const byKey = new Map();
      for (const r of rows) {
        const k = r.template_key;
        const prev = byKey.get(k);
        if (!prev || Number(r.version) > Number(prev.version)) byKey.set(k, r);
      }
      filtered = Array.from(byKey.values());
    }
    // parse JSON safely locally (don't rely on other helpers for forward compatibility)
    const parseJson = v => {
      if (v == null) return null;
      if (typeof v === 'object') return v; // already parsed
      try { return JSON.parse(v); } catch { return null; }
    };
    // Sanitize defaults for input-like components to avoid default error state
    const stripClasses = (cls, toRemove) => (String(cls || '')
      .split(/\s+/)
      .filter(c => c && !toRemove.includes(c))
      .join(' '));
    const out = filtered.map(r => {
      const propsRaw = parseJson(r.default_props) ?? {};
      const t = String(r.type || '').toLowerCase();
    if (['input', 'text', 'email', 'number', 'password', 'phone', 'password-input'].includes(t)) {
        try {
          if (propsRaw && typeof propsRaw === 'object') {
            // Remove error classes from formGroup/classes
            if (propsRaw.formGroup && typeof propsRaw.formGroup === 'object') {
              propsRaw.formGroup.classes = stripClasses(propsRaw.formGroup.classes, ['govuk-form-group--error']);
            }
            propsRaw.classes = stripClasses(propsRaw.classes, ['govuk-input--error']);
    // Keep any errorMessage defined by author; UI may choose to show or ignore
            // Alternative defaults requested by authoring UX
            // 1) Label classes -> 'govuk-label--m' if not provided
            if (!propsRaw.label || typeof propsRaw.label !== 'object') {
              propsRaw.label = { text: (propsRaw.label && propsRaw.label.text) || 'Label', classes: 'govuk-label--m' };
            } else if (!propsRaw.label.classes || String(propsRaw.label.classes).trim() === '') {
              propsRaw.label.classes = 'govuk-label--m';
            }
            // 2) Hint default text when missing or empty
            const hintText = propsRaw?.hint?.text;
            if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !String(hintText || '').trim()) {
              propsRaw.hint = { ...(propsRaw.hint || {}), text: 'This is the optional hint text' };
            }
          }
        } catch (_) {}
        } else if (t === 'paragraph') {
          try {
            if (propsRaw && typeof propsRaw === 'object') {
              if (!propsRaw.text) propsRaw.text = 'Paragraph text';
              if (!propsRaw.classes) propsRaw.classes = 'govuk-body';
            }
          } catch (_) {}
        }
      let editable = parseJson(r.prop_schema) ?? [];
      // 1. Broad removal of legacy 'required' editable field (validation panel now authoritative)
      editable = editable.filter(f => (f.key !== 'required' && f.path !== 'required'));
      // 2. Ensure label.classes select for any component that has label.text editing but lacks label.classes
      const hasLabelText = editable.some(f => f.path === 'label.text' || f.key === 'label.text');
      const hasLabelClasses = editable.some(f => f.path === 'label.classes' || f.key === 'label.classes');
      const labelClassOptions = [ 'govuk-label', 'govuk-label--s', 'govuk-label--m', 'govuk-label--l', 'govuk-label--xl' ];
      if (hasLabelText && !hasLabelClasses) {
        const insertIdx = editable.findIndex(f => f.path === 'label.text' || f.key === 'label.text');
        const fieldDef = {
          key: 'label.classes',
          path: 'label.classes',
          type: 'select',
          label: 'Label classes',
          options: labelClassOptions
        };
        if (insertIdx >= 0) editable.splice(insertIdx + 1, 0, fieldDef); else editable.push(fieldDef);
      }
      // 3. Component-type specific normalisation for character-count / textarea / input to ensure default label classes
      if (['character-count','textarea','input','select','file-upload','password-input'].includes(t)) {
        if (!propsRaw.label || typeof propsRaw.label !== 'object') {
          propsRaw.label = { text: (propsRaw.label && propsRaw.label.text) || (propsRaw.label && typeof propsRaw.label === 'string' ? propsRaw.label : 'Label'), classes: 'govuk-label--m' };
        } else if (!propsRaw.label.classes) {
          propsRaw.label.classes = 'govuk-label--m';
        }
      }
      // 4. Backfill lost default props for certain templates (post-migration safety net)
      if (t === 'character-count') {
        if (!('name' in propsRaw)) propsRaw.name = 'message';
        if (!('id' in propsRaw)) propsRaw.id = '';
        if (!('rows' in propsRaw)) propsRaw.rows = '5';
        if (!('maxlength' in propsRaw)) propsRaw.maxlength = '200';
        if (!('threshold' in propsRaw)) propsRaw.threshold = '75';
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object') propsRaw.hint = { text: 'Do not include personal information.' };
        if (!propsRaw.formGroup) propsRaw.formGroup = { classes: '' };
        if (!propsRaw.errorMessage) propsRaw.errorMessage = { text: '' };
      } else if (t === 'input') {
        if (!('name' in propsRaw)) propsRaw.name = 'input-1';
        if (!('id' in propsRaw)) propsRaw.id = 'input-1';
        if (!('type' in propsRaw)) propsRaw.type = 'text';
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !propsRaw.hint.text) propsRaw.hint = { text: 'This is the optional hint text' };
        if (!propsRaw.errorMessage) propsRaw.errorMessage = { text: '' };
        if (!propsRaw.formGroup) propsRaw.formGroup = { classes: '' };
      } else if (t === 'textarea') {
        if (!('name' in propsRaw)) propsRaw.name = 'more-detail';
        if (!('id' in propsRaw)) propsRaw.id = 'more-detail';
        if (!('rows' in propsRaw)) propsRaw.rows = '5';
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !propsRaw.hint.text) propsRaw.hint = { text: 'Don\'t include personal or financial information.' };
        if (!propsRaw.errorMessage) propsRaw.errorMessage = { text: '' };
        if (!propsRaw.formGroup) propsRaw.formGroup = { classes: '' };
      } else if (t === 'select') {
        if (!('name' in propsRaw)) propsRaw.name = 'example-select';
        if (!Array.isArray(propsRaw.items) || !propsRaw.items.length) {
          propsRaw.items = [ { text: 'Option 1', value: '1' }, { text: 'Option 2', value: '2' }, { text: 'Option 3', value: '3' } ];
        }
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !propsRaw.hint.text) propsRaw.hint = { text: 'Pick from the options' };
      } else if (t === 'file-upload') {
        if (!('name' in propsRaw)) propsRaw.name = 'uploadedFile';
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !propsRaw.hint.text) propsRaw.hint = { text: 'Files must be under 10MB.' };
        if (!propsRaw.errorMessage) propsRaw.errorMessage = { text: '' };
      } else if (t === 'password-input') {
        if (!('name' in propsRaw)) propsRaw.name = 'password';
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !propsRaw.hint.text) propsRaw.hint = { text: 'This is the optional hint text' };
        if (!propsRaw.errorMessage) propsRaw.errorMessage = { text: '' };
      }
      // 5. Reconstruct editable_fields if empty (DB may have lost schema). Build minimal viable schema.
      if ((!editable || !editable.length) && ['character-count','input','textarea','select','file-upload','password-input'].includes(t)) {
        const labelClassOptions = [ 'govuk-label', 'govuk-label--s', 'govuk-label--m', 'govuk-label--l', 'govuk-label--xl' ];
        if (t === 'character-count') {
          editable = [
            { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
            { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
            { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
            { key: 'maxlength', path: 'maxlength', type: 'text', label: 'Max Length' },
            { key: 'threshold', path: 'threshold', type: 'text', label: 'Threshold (%)' },
            { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
          ];
        } else if (t === 'input') {
          editable = [
            { key: 'name', path: 'name', type: 'text', label: 'Field name' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'type', path: 'type', type: 'enum', label: 'Input type', options: ['text','email','number','password','tel','url','search'] },
            { key: 'label.text', path: 'label.text', type: 'text', label: 'Label' },
            { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
            { key: 'hint.text', path: 'hint.text', type: 'text', label: 'Hint' },
            { key: 'errorMessage.text', path: 'errorMessage.text', type: 'text', label: 'Error message' },
            { key: 'classes', path: 'classes', type: 'text', label: 'Input classes' }
          ];
        } else if (t === 'textarea') {
          editable = [
            { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
            { key: 'labelClasses', path: 'label.classes', type: 'select', label: 'Label Classes', options: labelClassOptions.slice(0,4) },
            { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
            { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'rows', path: 'rows', type: 'text', label: 'Rows (number as text)' },
            { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
          ];
        } else if (t === 'select') {
          editable = [
            { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
            { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
            { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
            { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
          ];
        } else if (t === 'file-upload') {
          editable = [
            { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
            { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
            { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
            { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
          ];
        } else if (t === 'password-input') {
          editable = [
            { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
            { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
            { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
            { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
          ];
        }
      }
      return {
        id: r.id,
        key: r.template_key,
        version: r.version,
        type: r.type,
        label: r.label,
        description: r.description ?? null,
        props: propsRaw,
        editable_fields: editable,
        has_options: !!r.has_options,
        option_schema: parseJson(r.option_schema) ?? null,
        status: r.status
      };
    });
    res.status(200).json(out);
  } catch (err) {
    console.error('GET /api/component-templates failed:', err);
    res.status(500).json({ error: 'Failed to fetch component templates' });
  }
});

// Step detail with composed components (ordered)
app.get('/api/steps/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [[step]] = await pool.query(
      `SELECT id, name, status, ui_meta FROM iset_intake.step WHERE id = ?`,
      [id]
    );
    if (!step) return res.status(404).json({ error: 'Step not found' });

    const [components] = await pool.query(
      `SELECT
         sc.id,
         sc.position,
         sc.template_id,
         ct.template_key,
         ct.version,
         sc.props_overrides
       FROM iset_intake.step_component sc
       JOIN iset_intake.component_template ct ON ct.id = sc.template_id
       WHERE sc.step_id = ?
       ORDER BY sc.position`,
      [id]
    );

    const mapped = components.map(c => ({
      id: c.id,
      position: c.position,
      templateId: c.template_id,
      templateKey: c.template_key,
      templateVersion: c.version,
      props: normaliseJson(c.props_overrides)
    }));

    res.status(200).json({
      id: step.id,
      name: step.name,
      status: step.status,
      ui_meta: normaliseJson(step.ui_meta),
      components: mapped
    });
  } catch (err) {
    console.error('GET /api/steps/:id failed:', err);
    res.status(500).json({ error: 'Failed to fetch step' });
  }
});

// --- helpers for transactional writes --------------------------------------
async function withTx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

// Resolve component template references: supports templateId or template_key
async function resolveTemplateIds(components, conn) {
  // Collect missing IDs keyed by template_key
  const missingKeys = Array.from(new Set(
    components
      .filter(c => !c || typeof c !== 'object')
      .map(() => null)
  ));
  const keys = Array.from(new Set(
    components
      .filter(c => c && !c.templateId && c.template_key)
      .map(c => String(c.template_key))
  ));

  const map = new Map();
  if (keys.length) {
    const [rows] = await conn.query(
      `SELECT id, template_key, version
       FROM iset_intake.component_template
       WHERE status='active' AND template_key IN (${keys.map(() => '?').join(',')})
       ORDER BY template_key, version DESC`,
      keys
    );
    // take highest version per key
    for (const row of rows) {
      if (!map.has(row.template_key)) map.set(row.template_key, row.id);
    }
  }

  return components.map((c, i) => {
    if (!c || typeof c !== 'object') {
      throw Object.assign(new Error(`Invalid component at index ${i}`), { code: 400 });
    }
    const templateId = c.templateId || map.get(c.template_key) || null;
    if (!templateId) {
      throw Object.assign(new Error(`Missing template reference for component at index ${i}`), { code: 400 });
    }
    return {
      templateId: Number(templateId),
      props: c.props ? (typeof c.props === 'string' ? normaliseJson(c.props) : c.props) : null
    };
  });
}

// --- Create a new step ------------------------------------------------------
// Body: { name: string, status: 'active'|'inactive', components: [{ templateId:number|, template_key?:string, props?:object }], ui_meta?: any }
app.post('/api/steps', async (req, res) => {
  if (!ensureStepEditor(req, res)) return;
  const { name, status = 'active', components = [], ui_meta = null } = req.body || {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  // Defensive sanitation: strip placeholder summary-list rows if dynamic config present
  if (Array.isArray(components)) {
    components.forEach(c => {
      try {
        if (!c || !c.props) return;
        const t = String(c.template_key || c.type || '').toLowerCase();
        if (t === 'summary-list') {
          const p = c.props;
            const hasConfig = (Array.isArray(p.included) && p.included.length) || p.workflowId;
            if (hasConfig && Array.isArray(p.rows)) delete p.rows;
        }
      } catch { /* ignore */ }
    });
  }
  if (!trimmedName || !Array.isArray(components)) {
    return res.status(400).json({ error: 'name and components[] are required' });
  }
  // Server-side validation: Data Key uniqueness + pattern; date-input structural integrity
  try {
    const seen = new Map(); // lowercased name -> original
    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      if (!c || typeof c !== 'object') continue;
      const props = c.props || {};
      const dataKey = props.name;
      if (dataKey != null) {
        if (typeof dataKey !== 'string' || !/^[-a-z0-9_]+$/.test(dataKey)) {
          return res.status(400).json({ error: `Invalid Data Key at component index ${i}: must match ^[-a-z0-9_]+$` });
        }
        const k = dataKey.toLowerCase();
        if (seen.has(k)) {
          return res.status(400).json({ error: `Duplicate Data Key '${dataKey}' at component index ${i} (also used earlier)` });
        }
        seen.set(k, dataKey);
      }
      // date-input structural validation (lightweight)
      const typeKey = String(c.template_key || c.type || '').toLowerCase();
      if (typeKey === 'date-input' || typeKey === 'date') {
        if (!Array.isArray(props.items)) {
          return res.status(400).json({ error: `date-input at index ${i} missing items[] array` });
        }
        const names = props.items.map(it => it && it.name).filter(Boolean);
        const requiredParts = ['day','month','year'];
        const missing = requiredParts.filter(r => !names.includes(r));
        if (missing.length) {
          return res.status(400).json({ error: `date-input at index ${i} missing required parts: ${missing.join(', ')}` });
        }
      }
      if (typeKey === 'file-upload' || typeKey === 'fileupload') {
        if (props.accept && typeof props.accept === 'string') {
          if (props.accept.length > 200) return res.status(400).json({ error: `file-upload at index ${i} accept too long (max 200 chars)` });
          const parts = props.accept.split(',').map(s => s.trim()).filter(Boolean);
          if (parts.length > 0) {
            const invalid = parts.filter(p => !/^\.[A-Za-z0-9]+$/.test(p) && !/^[A-Za-z0-9-]+\/[A-Za-z0-9+.-]+$/.test(p));
            if (invalid.length) return res.status(400).json({ error: `file-upload at index ${i} invalid accept tokens: ${invalid.slice(0,5).join(', ')}` });
          }
        }
        if (props.documentType && typeof props.documentType === 'string') {
          if (!/^[-a-zA-Z0-9_]+$/.test(props.documentType)) return res.status(400).json({ error: `file-upload at index ${i} invalid documentType (use alphanumeric, dash, underscore)` });
          if (props.documentType.length > 40) return res.status(400).json({ error: `file-upload at index ${i} documentType too long (max 40)` });
        }
      }
    }
  } catch (e) {
    return res.status(400).json({ error: 'Validation failed', details: String(e).slice(0,200) });
  }
  try {
    const stepId = await withTx(async (conn) => {
      const [dup] = await conn.query(
        `SELECT id FROM iset_intake.step WHERE LOWER(name) = LOWER(?) LIMIT 1`,
        [trimmedName]
      );
      if (dup.length) {
        const err = new Error('Step name already exists');
        err.status = 409;
        err.code = 'DUPLICATE_STEP_NAME';
        throw err;
      }
      const [r] = await conn.query(
        `INSERT INTO iset_intake.step (name, status, ui_meta) VALUES (?,?,?)`,
        [trimmedName, status, ui_meta ? JSON.stringify(ui_meta) : null]
      );
      const newId = r.insertId;
      if (components.length) {
        const resolved = await resolveTemplateIds(components, conn);
        const values = resolved.map((c, i) => [
          newId,
          i + 1,
          c.templateId,
          c.props ? JSON.stringify(c.props) : null,
        ]);
        await conn.query(
          `INSERT INTO iset_intake.step_component (step_id, position, template_id, props_overrides)
           VALUES ?`,
          [values]
        );
      }
      return newId;
    });
    res.status(201).json({ id: stepId });
  } catch (err) {
    if (err.status === 409 || err.code === 'DUPLICATE_STEP_NAME' || err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Step name already exists' });
    }
    if (err.code === 400) return res.status(400).json({ error: err.message });
    console.error('POST /api/steps failed:', err);
    res.status(500).json({ error: 'Failed to create step' });
  }
});

// --- Update a step (replace components) -------------------------------------
// Body: { name?: string, status?: string, components?: [{ templateId|template_key, props }], ui_meta?: any }
app.put('/api/steps/:id', async (req, res) => {
  if (!ensureStepEditor(req, res)) return;
  const { id } = req.params;
  const { name, status, components, ui_meta } = req.body || {};
  if (typeof name === 'string' && !name.trim()) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }
  const trimmedName = typeof name === 'string' ? name.trim() : undefined;
  // Defensive sanitation (same as POST)
  if (Array.isArray(components)) {
    components.forEach(c => {
      try {
        if (!c || !c.props) return;
        const t = String(c.template_key || c.type || '').toLowerCase();
        if (t === 'summary-list') {
          const p = c.props;
          const hasConfig = (Array.isArray(p.included) && p.included.length) || p.workflowId;
          if (hasConfig && Array.isArray(p.rows)) delete p.rows;
        }
      } catch { /* ignore */ }
    });
  }
  try {
    if (Array.isArray(components)) {
      // Same validation logic as in POST route
      const seen = new Map();
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        if (!c || typeof c !== 'object') continue;
        const props = c.props || {};
        const dataKey = props.name;
        if (dataKey != null) {
          if (typeof dataKey !== 'string' || !/^[-a-z0-9_]+$/.test(dataKey)) {
            return res.status(400).json({ error: `Invalid Data Key at component index ${i}: must match ^[-a-z0-9_]+$` });
          }
          const k = dataKey.toLowerCase();
          if (seen.has(k)) {
            return res.status(400).json({ error: `Duplicate Data Key '${dataKey}' at component index ${i} (also used earlier)` });
          }
          seen.set(k, dataKey);
        }
        const typeKey = String(c.template_key || c.type || '').toLowerCase();
        if (typeKey === 'date-input' || typeKey === 'date') {
          if (!Array.isArray(props.items)) {
            return res.status(400).json({ error: `date-input at index ${i} missing items[] array` });
          }
          const names = props.items.map(it => it && it.name).filter(Boolean);
          const requiredParts = ['day','month','year'];
          const missing = requiredParts.filter(r => !names.includes(r));
          if (missing.length) {
            return res.status(400).json({ error: `date-input at index ${i} missing required parts: ${missing.join(', ')}` });
          }
        }
        if (typeKey === 'file-upload' || typeKey === 'fileupload') {
          if (props.accept && typeof props.accept === 'string') {
            if (props.accept.length > 200) return res.status(400).json({ error: `file-upload at index ${i} accept too long (max 200 chars)` });
            const parts = props.accept.split(',').map(s => s.trim()).filter(Boolean);
            if (parts.length > 0) {
              const invalid = parts.filter(p => !/^\.[A-Za-z0-9]+$/.test(p) && !/^[A-Za-z0-9-]+\/[A-Za-z0-9+.-]+$/.test(p));
              if (invalid.length) return res.status(400).json({ error: `file-upload at index ${i} invalid accept tokens: ${invalid.slice(0,5).join(', ')}` });
            }
          }
          if (props.documentType && typeof props.documentType === 'string') {
            if (!/^[-a-zA-Z0-9_]+$/.test(props.documentType)) return res.status(400).json({ error: `file-upload at index ${i} invalid documentType (use alphanumeric, dash, underscore)` });
            if (props.documentType.length > 40) return res.status(400).json({ error: `file-upload at index ${i} documentType too long (max 40)` });
          }
        }
      }
    }
    await withTx(async (conn) => {
      // ensure step exists
      const [[exists]] = await conn.query(
        `SELECT id FROM iset_intake.step WHERE id = ?`,
        [id]
      );
      if (!exists) throw Object.assign(new Error('Not found'), { code: 404 });

      if (typeof trimmedName === 'string') {
        const [dup] = await conn.query(
          `SELECT id FROM iset_intake.step WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1`,
          [trimmedName, id]
        );
        if (dup.length) {
          const err = new Error('Step name already exists');
          err.status = 409;
          err.code = 'DUPLICATE_STEP_NAME';
          throw err;
        }
      }

      if (name != null || status != null || typeof ui_meta !== 'undefined') {
        await conn.query(
          `UPDATE iset_intake.step SET
             name = COALESCE(?, name),
             status = COALESCE(?, status),
             ui_meta = ?
           WHERE id = ?`,
          [
            typeof trimmedName === 'string' ? trimmedName : null,
            status ?? null,
            typeof ui_meta === 'undefined' ? null : JSON.stringify(ui_meta),
            id
          ]
        );
      }

      if (Array.isArray(components)) {
        // replace all components atomically
        await conn.query(`DELETE FROM iset_intake.step_component WHERE step_id = ?`, [id]);
        if (components.length) {
          const resolved = await resolveTemplateIds(components, conn);
          const values = resolved.map((c, i) => [
            id,
            i + 1,
            c.templateId,
            c.props ? JSON.stringify(c.props) : null,
          ]);
          await conn.query(
            `INSERT INTO iset_intake.step_component (step_id, position, template_id, props_overrides)
             VALUES ?`,
            [values]
          );
        }
      }
    });
    res.status(200).json({ id, message: 'Step updated' });
  } catch (err) {
    if (err.code === 404) return res.status(404).json({ error: 'Step not found' });
    if (err.code === 400) return res.status(400).json({ error: err.message });
    if (err.status === 409 || err.code === 'DUPLICATE_STEP_NAME' || err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Step name already exists' });
    }
    console.error('PUT /api/steps/:id failed:', err);
    res.status(500).json({ error: 'Failed to update step' });
  }
});

// --- Delete a step ----------------------------------------------------------
app.delete('/api/steps/:id', async (req, res) => {
  if (!ensureStepEditor(req, res)) return;
  const { id } = req.params;
  try {
    const [[ref]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM iset_intake.workflow_step WHERE step_id = ?`,
      [id]
    );
    if (ref.cnt > 0) {
      const [workflowNames] = await pool.query(
        `SELECT w.name
           FROM iset_intake.workflow_step ws
           JOIN iset_intake.workflow w ON w.id = ws.workflow_id
          WHERE ws.step_id = ?
          ORDER BY w.name
          LIMIT 10`,
        [id]
      );
      return res.status(409).json({
        error: `Step is used by ${ref.cnt} workflow(s)`,
        workflows: workflowNames.map(row => row.name)
      });
    }
    await withTx(async (conn) => {
      await conn.query(`DELETE FROM iset_intake.step_component WHERE step_id = ?`, [id]);
      await conn.query(`DELETE FROM iset_intake.step WHERE id = ?`, [id]);
    });
    res.status(200).json({ message: 'Step deleted' });
  } catch (err) {
    console.error('DELETE /api/steps/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete step' });
  }
});


/**
 * GET /api/intake-officers
 *
 * Returns all evaluators (both roles) with their PTMA assignments (if any).
 * - Only active evaluators are included.
 * - If an evaluator has multiple PTMAs, they appear once per PTMA.
 * - If an evaluator has no PTMA, ptma fields are null and label is 'Not assigned to a PTMA'.
 */
app.get('/api/intake-officers', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.id AS evaluator_id,
        e.name AS evaluator_name,
        e.email AS evaluator_email,
        e.role AS evaluator_role,
        p.id AS ptma_id,
        p.name AS ptma_name,
        p.iset_code AS ptma_code,
        p.iset_full_name AS ptma_full_name,
        p.iset_status AS ptma_status,
        p.iset_province AS ptma_province,
        p.iset_indigenous_group AS ptma_indigenous_group,
        IFNULL(p.name, 'Not assigned to a PTMA') AS ptma_label
      FROM iset_evaluators e
      LEFT JOIN iset_evaluator_ptma ep ON e.id = ep.evaluator_id AND (ep.unassigned_at IS NULL OR ep.unassigned_at > CURDATE())
      LEFT JOIN ptma p ON ep.ptma_id = p.id
      WHERE e.status = 'active'
      ORDER BY e.name, p.name
    `);
    res.status(200).json(rows);
  } catch (error) {
    // Graceful fallback if table(s) not present in current environment (dev migrations not applied yet)
    if (error && (error.code === 'ER_NO_SUCH_TABLE' || /no such table/i.test(error.message))) {
      console.warn('[intake-officers] evaluator tables missing; returning empty list fallback');
      return res.status(200).json([]);
    }
    console.error('Error fetching intake officers:', error);
    res.status(500).json({ error: 'Failed to fetch intake officers' });
  }
});


/**
 * POST /api/cases
 *
 * In new minimal schema:
 * - If application_id is provided, create case referencing existing working application.
 * - Else if submission_id provided, ingest submission -> working application (iset_application) then create case.
 * Body fields:
 *   submission_id?: number
 *   application_id?: number
 *   assigned_to_user_id?: number | null
 */
app.post('/api/cases', async (req, res) => {
  const {
    submission_id,
    application_id,
    client_id,
    clientId,
    assigned_to_user_id,
    assignedToUserId,
    status,
  } = req.body || {};

  const resolvedClientId = Number.parseInt(client_id ?? clientId ?? '', 10);
  if (!Number.isInteger(resolvedClientId) || resolvedClientId < 1) {
    return res.status(422).json({ error: 'client_id_required' });
  }

  if (!application_id && !submission_id) {
    return res.status(400).json({ error: 'Provide either application_id or submission_id' });
  }

  const [[clientRow]] = await pool.query('SELECT id FROM client WHERE id = ? LIMIT 1', [
    resolvedClientId,
  ]);
  if (!clientRow) {
    return res.status(404).json({ error: 'client_not_found' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const assignedUserId =
      assigned_to_user_id ?? assignedToUserId ?? null;
    let assignTargetId = null;
    if (assignedUserId !== null && typeof assignedUserId !== 'undefined') {
      const parsedAssignee = Number.parseInt(assignedUserId, 10);
      if (!Number.isInteger(parsedAssignee) || parsedAssignee < 1) {
        await conn.rollback();
        return res.status(422).json({ error: 'invalid_assigned_user_id' });
      }
      const [[assigneeRow]] = await conn.query(
        'SELECT id, display_name, name, email, primary_role, region_id FROM staff_profiles WHERE id = ? LIMIT 1',
        [parsedAssignee]
      );
      if (!assigneeRow) {
        await conn.rollback();
        return res.status(404).json({ error: 'assigned_user_not_found' });
      }
      assignTargetId = parsedAssignee;
    }

    let workingApplicationId = application_id || null;

    if (!workingApplicationId && submission_id) {
      const [existingApp] = await conn.query(
        'SELECT id FROM iset_application WHERE submission_id = ? LIMIT 1',
        [submission_id]
      );
      if (existingApp.length > 0) {
        workingApplicationId = existingApp[0].id;
      } else {
        const [subRows] = await conn.query(
          'SELECT * FROM iset_application_submission WHERE id = ? LIMIT 1',
          [submission_id]
        );
        if (subRows.length === 0) {
          await conn.rollback();
          return res.status(404).json({ error: 'submission_not_found' });
        }
        const submission = subRows[0];
        const payload = {
          source: 'submission_ingest',
          ingested_at: new Date().toISOString(),
          submission_snapshot: submission,
        };
        const [insertApp] = await conn.query(
          'INSERT INTO iset_application (submission_id, payload_json, status, version, created_at, updated_at) VALUES (?,?,?,?,NOW(),NOW())',
          [submission_id, JSON.stringify(payload), 'active', 1]
        );
        workingApplicationId = insertApp.insertId;
      }
    }

    if (workingApplicationId) {
      const [caseExists] = await conn.query(
        'SELECT id FROM iset_case WHERE application_id = ? LIMIT 1',
        [workingApplicationId]
      );
      if (caseExists.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'case_already_exists', case_id: caseExists[0].id });
      }
    }

    const normalizedStatus = typeof status === 'string' && status.trim() ? status.trim() : 'open';

    const [insertCase] = await conn.query(
      'INSERT INTO iset_case (application_id, client_id, assigned_to_user_id, status, created_at, updated_at) VALUES (?,?,?,?,NOW(),NOW())',
      [workingApplicationId, resolvedClientId, assignTargetId, normalizedStatus]
    );

    await conn.commit();

    if (assignTargetId) {
      try {
        const actor = resolveRequestActor(req);
        const nextStaff = await fetchStaffProfileById(assignTargetId);
        await publishAssignmentEvent({
          caseId: insertCase.insertId,
          applicationId: workingApplicationId,
          previousStaff: null,
          nextStaff,
          actor,
        });
      } catch (eventError) {
        console.warn('[cases] assignment event emit failed after create', eventError);
      }
    }

    return res.status(201).json({
      message: 'case_created',
      case_id: insertCase.insertId,
      application_id: workingApplicationId,
      client_id: resolvedClientId,
      assigned_to_user_id: assignTargetId,
      status: normalizedStatus,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Error creating case (minimal ingestion flow):', err);
    return res.status(500).json({ error: 'internal_error', detail: err.message });
  } finally {
    conn.release();
  }
});

/**
 * POST /api/applications/ingest-from-submission
 * Body: { submission_id }
 * Idempotent: returns existing working application if already ingested.
 */
app.post('/api/applications/ingest-from-submission', async (req, res) => {
  const { submission_id } = req.body || {};
  if (!submission_id) return res.status(400).json({ error: 'submission_id_required' });
  try {
    const [existing] = await pool.query('SELECT id FROM iset_application WHERE submission_id = ? LIMIT 1', [submission_id]);
    if (existing.length > 0) {
      return res.status(200).json({ message: 'already_ingested', application_id: existing[0].id });
    }
    const [subRows] = await pool.query('SELECT * FROM iset_application_submission WHERE id = ? LIMIT 1', [submission_id]);
    if (subRows.length === 0) return res.status(404).json({ error: 'submission_not_found' });
    const submission = subRows[0];
    const payload = { source: 'submission_ingest_manual', ingested_at: new Date().toISOString(), submission_snapshot: submission };
    const [insertApp] = await pool.query(
      'INSERT INTO iset_application (submission_id, payload_json, status, version, created_at, updated_at) VALUES (?,?,?,?,NOW(),NOW())',
      [submission_id, JSON.stringify(payload), 'active', 1]
    );
    return res.status(201).json({ message: 'ingested', application_id: insertApp.insertId });
  } catch (err) {
    console.error('Error ingesting submission:', err);
    return res.status(500).json({ error: 'internal_error', detail: err.message });
  }
});



/**
 * GET /api/case-assignment/unassigned-applications
 *
 * Updated to source from iset_application_submission (new submission persistence table).
 * Returns submissions that have no corresponding case in iset_case.
 *
 * Response fields expected by frontend widget:
 * - application_id (aliased to submission id for now; will map when case created)
 * - tracking_id (submission reference_number)
 * - applicant_name
 * - email
 * - submitted_at
 */
app.get('/api/case-assignment/unassigned-applications', async (req, res) => {
  try {
    let sql = `
      SELECT 
        s.id AS application_id,
        s.reference_number AS tracking_id,
        s.submitted_at AS submitted_at,
        u.name AS applicant_name,
        u.email AS email
      FROM iset_application_submission s
      JOIN user u ON s.user_id = u.id
      LEFT JOIN iset_case c ON c.application_id = s.id  -- NOTE: temporary if application_id will point to submission id in new model
      WHERE c.id IS NULL\n`;
    const params = [];
    // NOTE: Scoping disabled for submissions until region / ownership columns are defined on iset_application_submission.
    // Previous attempt tried to use scopeApplications and introduced a nonexistent s.region_id reference causing errors.
    sql += '      ORDER BY s.submitted_at DESC';
    const [rows] = await pool.query(sql, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching unassigned applications (submission table):', err);
    res.status(500).json({ error: 'Failed to fetch unassigned applications' });
  }
});


/**
 * GET /api/tasks
 *
 * Returns all open tasks assigned to the authenticated caseworker (hard???coded to user_id = 18 for now).
 *
 * Response fields:
 * - id
 * - case_id
 * - title
 * - description
 * - due_date
 * - priority
 * - status
 * - source
 * - remind_at
 * - snoozed_until
 * - repeat_interval_days
 * - tracking_id
 */
app.get('/api/tasks', async (req, res) => {
  let userId = 18; // replace with req.user.id when auth is active
  try {
    const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
    if (authProvider === 'cognito') {
      userId = Number(req.auth?.userId) || -1;
    }
  } catch (_) {}
  try {
    let sql = `SELECT
         t.id,
         t.case_id,
         t.title,
         t.description,
         t.due_date,
         t.priority,
         t.status,
         t.source,
         t.remind_at,
         t.snoozed_until,
         t.repeat_interval_days,
         a.tracking_id  -- Include tracking_id from iset_application
       FROM iset_case_task t
       JOIN iset_case c ON t.case_id = c.id
       JOIN iset_application a ON c.application_id = a.id
       WHERE t.assigned_to_user_id = ?\n`;
    const params = [userId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        sql += ` AND ${scopeSql}\n`;
        params.push(...scopeParams);
      }
    } catch (_) {}
    sql += ` AND t.status IN ('open', 'in_progress')\n`;
    sql += ` ORDER BY 
         t.priority = 'high' DESC,
         t.due_date < CURDATE() DESC,
         t.due_date ASC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});


///Casework Task Scheduler
const generateSystemTasks = async () => {
  try {
    // Fetch all 'documents_overdue' events from the unified event store
    let events = [];
    try {
      const [rows] = await pool.query(
        `SELECT e.id,
                e.subject_id,
                CAST(e.subject_id AS UNSIGNED) AS case_id,
                e.payload_json AS payload,
                e.captured_at,
                JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS tracking_id
           FROM iset_event_entry e
           JOIN iset_case c ON c.id = CAST(e.subject_id AS UNSIGNED)
           JOIN iset_application a ON c.application_id = a.id
          WHERE e.subject_type = 'case' AND e.event_type = 'documents_overdue'`
      );
      events = rows;
    } catch (err) {
      if (isMissingTableErrorLocal(err)) {
        console.warn('[tasks] event store unavailable; skipping documents_overdue sync');
        events = [];
      } else {
        throw err;
      }
    }

    for (const event of events) {
      const caseIdRaw = event.case_id ?? event.subject_id;
      const caseId = Number(caseIdRaw);
      if (!Number.isFinite(caseId)) continue;

      let payload = event.payload;
      if (payload && typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = {};
        }
      } else if (!payload || typeof payload !== 'object') {
        payload = {};
      }

      let missingItems = payload.missing;
      if (Array.isArray(missingItems)) {
        missingItems = missingItems.filter(item => item != null && item !== '');
      } else if (typeof missingItems === 'string' && missingItems.trim()) {
        missingItems = [missingItems.trim()];
      } else {
        missingItems = [];
      }

      if (missingItems.length === 0) continue;

      const trackingId = event.tracking_id || payload.tracking_id || `CASE-${caseId}`;

      const [existingTask] = await pool.query(
        `SELECT id FROM iset_case_task WHERE case_id = ? AND title = 'Request missing documents' AND status != 'completed'`,
        [caseId]
      );

      if (existingTask.length > 0) continue;

      const title = 'Request missing documents';
      const description = `Follow up with applicant to submit ${missingItems.join(', ')}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2);

      await pool.query(
        `INSERT INTO iset_case_task (
          case_id, assigned_to_user_id, title, description, due_date, priority, status, source, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseId,
          18,
          title,
          description,
          dueDate,
          'high',
          'open',
          'system',
          null,
        ]
      );

      console.log(`[tasks] created documents_overdue task for case ${trackingId}`);
    }
  } catch (err) {
    console.error('Error generating system tasks:', err);
  }
};

// Dummy draft data helpers ---------------------------------------------------
const DUMMY_DRAFT_HISTORY = [
  'consent',
  'indigenous-declaration',
  'conflict-of-interest',
  'social-insurance-number',
  'name',
  'date-of-birth',
  'gender',
  'contact-information',
  'emergency-contact',
  'indigenous-legal-identity',
  'registration-number',
  'home-community',
  'demographics',
  'disability-and-social-assistance',
  'labour-force-and-education-history',
  'employment-goals-and-barriers',
  'financial-supports-requested',
  'household-income',
  'household-expenses',
  'summary-page',
  'iset-document-upload',
  'legal-and-submission'
];

const DUMMY_APPLICATION_PROFILES = [
  {
    id: "aiyana-bear",
    registrationPrefix: "FN",
    payload: {
      "dob": "1991-06-14",
      "consent": { "name": "Aiyana Bear", "signed": true },
      "indigenous_declaration": { "name": "Aiyana Bear", "signed": true },
      "conflict_of_interest": "no_conflict",
      "conflict_applicant_signature": { "name": "Aiyana Bear", "signed": true },
      "barriers": ["education", "funding"],
      "last-name": "Bear",
      "first-name": "Aiyana",
      "address-city": "Maskwacis",
      "income-other": "Seasonal beading workshops",
      "middle-names": "Skye",
      "spouses-name": "",
      "expenses-rent": "880",
      "other-barrier": "",
      "telephone-alt": "",
      "telephone-day": "(780) 555-4821",
      "top-up-amount": "0",
      "education-year": "2013",
      "has-disability": "no",
      "home-comminuty": "Maskwacis",
      "income-jordans": "0",
      "income-spousal": "0",
      "long-term-goal": "Launch a Cree language mentorship program for youth in Maskwacis.",
      "marital-status": "single",
      "preferred-name": "Aiyana",
      "target-program": "skills_development",
      "eligibility-age": "yes",
      "example-input-5": "55",
      "example-radio-2": "college",
      "address-postcode": "T0C 1N0",
      "address-province": "ab",
      "ages-of-children": "",
      "visible-minority": "true",
      "income-employment": "2100",
      "social-assistance": "no",
      "dependent-children": "no",
      "edication-location": "Blue Quills University, AB",
      "eligibility-female": "yes",
      "expenses-groceries": "430",
      "expenses-utilities": "190",
      "preferred-language": "en",
      "requested-supports": ["tuition", "living"],
      "expenses-other-list": "Cultural workshop supplies 55",
      "income-band-funding": "150",
      "labour-force-status": "underemployed",
      "registration-number": "FN-000000",
      "eligibility-canadian": "yes",
      "eligibility-training": "yes",
      "expenses-transitpass": "75",
      "income-child-benefit": "0",
      "income-social-assist": "0",
      "contact-email-address": "aiyana.bear@example.com",
      "eligibility-financial": "yes",
      "address-street-address": "14 Buffalo Drive",
      "disability-description": "No disability disclosed.",
      "eligibility-employment": "yes",
      "eligibility-indigenous": "yes",
      "emergency-contact-name": "Evelyn Bear",
      "address-mailing-address": "",
      "other-requested-support": "",
      "social-insurance-number": "000 000 000",
      "eligibility-disqualified": "no",
      "income-other-description": "120",
      "legal-indigenous-identity": "first_nations_status",
      "emergency-contact-telephone": "(780) 555-4820",
      "biological_sex": "female",
      "gender_identity": "female",
      "disability-support": "no",
      "disability-support_yes_follow": "",
      "education-location": "ab",
      "income-child-support": "0",
      "income-alimony": "0",
      "expenses_bus_pass": "75",
      "expenses-parking": "0",
      "expenses_transport_mileage": "0",
      "expenses_transport": ["buss_pass"],
      "emergency-contact-relationship": "Aunt"
    }
  },
  {
    id: "noah-whitecloud",
    registrationPrefix: "OCN",
    conflict: {
      value: "conflict",
      follow: "Spouse employed part-time by regional PTMA; recused from decision-making."
    },
    payload: {
      "dob": "1987-11-03",
      "consent": { "name": "Noah Whitecloud", "signed": true },
      "indigenous_declaration": { "name": "Noah Whitecloud", "signed": true },
      "conflict_of_interest": "conflict",
      "2022_conflict_follow": "Spouse employed part-time by regional PTMA; recused from decision-making.",
      "conflict_applicant_signature": { "name": "Noah Whitecloud", "signed": true },
      "barriers": ["lack-of-job-opportunities", "other"],
      "last-name": "Whitecloud",
      "first-name": "Noah",
      "address-city": "The Pas",
      "income-other": "Traditional crafts sold at winter market",
      "middle-names": "River",
      "spouses-name": "Jordan Whitecloud",
      "expenses-rent": "920",
      "other-barrier": "Seasonal road closures limit access to training centres.",
      "telephone-alt": "(204) 555-7746",
      "telephone-day": "(204) 555-7742",
      "top-up-amount": "420",
      "education-year": "2008",
      "has-disability": "yes",
      "home-comminuty": "Opaskwayak Cree Nation",
      "income-jordans": "0",
      "income-spousal": "1850",
      "long-term-goal": "Create a land-based skills program that employs community youth year-round.",
      "marital-status": "married",
      "preferred-name": "Noah",
      "target-program": "jcp",
      "eligibility-age": "yes",
      "example-input-5": "120",
      "example-radio-2": "apprenticeship_trades",
      "address-postcode": "R9A 1K8",
      "address-province": "mb",
      "ages-of-children": "5, 9",
      "visible-minority": "true",
      "income-employment": "0",
      "social-assistance": "yes",
      "dependent-children": "yes",
      "edication-location": "University College of the North, MB",
      "eligibility-female": "yes",
      "expenses-groceries": "520",
      "expenses-utilities": "240",
      "preferred-language": "en",
      "requested-supports": ["living", "transportation", "other"],
      "expenses-other-list": "Childcare co-op fees 120",
      "income-band-funding": "90",
      "labour-force-status": "unemployed",
      "registration-number": "OCN-000000",
      "eligibility-canadian": "yes",
      "eligibility-training": "yes",
      "expenses-transitpass": "95",
      "income-child-benefit": "420",
      "income-social-assist": "540",
      "contact-email-address": "noah.whitecloud@example.com",
      "eligibility-financial": "yes",
      "address-street-address": "102 Cedar Trail",
      "disability-description": "Managing chronic respiratory issues made worse by smoke season.",
      "eligibility-employment": "yes",
      "eligibility-indigenous": "yes",
      "emergency-contact-name": "Marla Whitecloud",
      "address-mailing-address": "PO Box 1027, The Pas, MB R9A 1M4",
      "other-requested-support": "Childcare during evening classes.",
      "social-insurance-number": "000 000 000",
      "eligibility-disqualified": "no",
      "income-other-description": "260",
      "legal-indigenous-identity": "first_nations_status",
      "emergency-contact-telephone": "(431) 555-0145",
      "biological_sex": "male",
      "gender_identity": "male",
      "disability-support": "yes",
      "disability-support_yes_follow": "Requires ergonomic workstation setup.",
      "education-location": "mb",
      "income-child-support": "0",
      "income-alimony": "0",
      "expenses_bus_pass": "95",
      "expenses-parking": "0",
      "expenses_transport_mileage": "120",
      "expenses_transport": ["buss_pass", "mileage"],
      "emergency-contact-relationship": "Sister"
    }
  },
  {
    id: "serenity-kalluk",
    registrationPrefix: "IK",
    payload: {
      "dob": "1993-02-18",
      "consent": { "name": "Serenity Kalluk", "signed": true },
      "indigenous_declaration": { "name": "Serenity Kalluk", "signed": true },
      "conflict_of_interest": "no_conflict",
      "conflict_applicant_signature": { "name": "Serenity Kalluk", "signed": true },
      "barriers": ["location", "funding"],
      "last-name": "Kalluk",
      "first-name": "Serenity",
      "address-city": "Iqaluit",
      "income-other": "Community art commissions",
      "middle-names": "Aurora",
      "spouses-name": "",
      "expenses-rent": "1320",
      "other-barrier": "",
      "telephone-alt": "",
      "telephone-day": "(867) 555-1934",
      "top-up-amount": "360",
      "education-year": "2015",
      "has-disability": "no",
      "home-comminuty": "Iqaluit",
      "income-jordans": "0",
      "income-spousal": "0",
      "long-term-goal": "Train as an environmental technician to support community water systems.",
      "marital-status": "single",
      "preferred-name": "Serenity",
      "target-program": "skills_development",
      "eligibility-age": "yes",
      "example-input-5": "140",
      "example-radio-2": "college",
      "address-postcode": "X0A 0H0",
      "address-province": "nu",
      "ages-of-children": "3, 7",
      "visible-minority": "false",
      "income-employment": "950",
      "social-assistance": "yes",
      "dependent-children": "yes",
      "education-location": "nu",
      "expenses-groceries": "580",
      "expenses-utilities": "310",
      "preferred-language": "en",
      "requested-supports": ["tuition", "living", "transportation"],
      "expenses-other-list": "Community childcare co-op 140",
      "income-band-funding": "240",
      "labour-force-status": "student",
      "registration-number": "IK-000000",
      "expenses-transitpass": "85",
      "income-child-benefit": "460",
      "income-social-assist": "320",
      "income-child-support": "0",
      "income-alimony": "0",
      "income-other-description": "0",
      "contact-email-address": "serenity.kalluk@example.com",
      "address-street-address": "8 Nanuq Crescent",
      "disability-description": "",
      "address-mailing-address": "",
      "other-requested-support": "",
      "social-insurance-number": "000 000 000",
      "legal-indigenous-identity": "inuit",
      "emergency-contact-telephone": "(867) 555-1930",
      "biological_sex": "female",
      "gender_identity": "female",
      "disability-support": "no",
      "disability-support_yes_follow": "",
      "expenses_bus_pass": "85",
      "expenses-parking": "60",
      "expenses_transport_mileage": "50",
      "expenses_transport": ["buss_pass", "parking", "mileage"],
      "emergency-contact-name": "Amaruq Kalluk",
      "emergency-contact-relationship": "Uncle"
    }
  },
  {
    id: "jonah-sutherland",
    registrationPrefix: "NT",
    payload: {
      "dob": "1990-04-27",
      "consent": { "name": "Jonah Sutherland", "signed": true },
      "indigenous_declaration": { "name": "Jonah Sutherland", "signed": true },
      "conflict_of_interest": "no_conflict",
      "conflict_applicant_signature": { "name": "Jonah Sutherland", "signed": true },
      "barriers": ["education", "other"],
      "last-name": "Sutherland",
      "first-name": "Jonah",
      "address-city": "Yellowknife",
      "income-other": "0",
      "middle-names": "Lake",
      "spouses-name": "",
      "expenses-rent": "1180",
      "other-barrier": "Needs interpreter support for certain workshops.",
      "telephone-alt": "",
      "telephone-day": "(867) 555-7842",
      "top-up-amount": "310",
      "education-year": "2012",
      "has-disability": "yes",
      "home-comminuty": "Yellowknife",
      "income-jordans": "0",
      "income-spousal": "0",
      "long-term-goal": "Develop a northern tech hub for Indigenous entrepreneurs in Yellowknife.",
      "marital-status": "single",
      "preferred-name": "Jonah",
      "target-program": "tws",
      "eligibility-age": "yes",
      "example-input-5": "",
      "example-radio-2": "university_certificate",
      "address-postcode": "X1A 2P7",
      "address-province": "nt",
      "ages-of-children": "",
      "visible-minority": "false",
      "income-employment": "1950",
      "social-assistance": "no",
      "dependent-children": "no",
      "edication-location": "Aurora College, NT",
      "eligibility-female": "yes",
      "expenses-groceries": "460",
      "expenses-utilities": "230",
      "preferred-language": "en",
      "requested-supports": ["tuition", "transportation", "other"],
      "expenses-other-list": "Interpreter services 95",
      "income-band-funding": "180",
      "labour-force-status": "employed-part-time",
      "registration-number": "NT-000000",
      "eligibility-canadian": "yes",
      "eligibility-training": "yes",
      "expenses-transitpass": "85",
      "income-child-benefit": "0",
      "income-social-assist": "0",
      "contact-email-address": "bill@sillery.co.uk",
      "eligibility-financial": "yes",
      "address-street-address": "44 Willow Flats",
      "disability-description": "Lives with partial hearing loss and uses hearing aids.",
      "eligibility-employment": "yes",
      "eligibility-indigenous": "yes",
      "emergency-contact-name": "Mara Sutherland",
      "address-mailing-address": "",
      "other-requested-support": "Assistive technology for remote learning.",
      "social-insurance-number": "000 000 000",
      "eligibility-disqualified": "no",
      "income-other-description": "",
      "legal-indigenous-identity": "metis",
      "emergency-contact-telephone": "(867) 555-7841",
      "what-is-your-gender-identity": "4",
      "emergency-contact-relationship": "Sibling"
    }
  },
  {
    id: "maya-papatie",
    registrationPrefix: "QC",
    payload: {
      "dob": "1994-09-12",
      "consent": { "name": "Maya Papatie", "signed": true },
      "indigenous_declaration": { "name": "Maya Papatie", "signed": true },
      "barriers": ["funding", "location"],
      "last-name": "Papatie",
      "first-name": "Maya",
      "address-city": "Val-d'Or",
      "income-other": "180",
      "middle-names": "Laurence",
      "spouses-name": "",
      "expenses-rent": "710",
      "other-barrier": "",
      "telephone-alt": "",
      "telephone-day": "(819) 555-4418",
      "top-up-amount": "280",
      "education-year": "2018",
      "has-disability": "no",
      "home-comminuty": "Kitcisakik",
      "income-jordans": "0",
      "income-spousal": "0",
      "long-term-goal": "Create a land stewardship training program for Algonquin youth.",
      "marital-status": "single",
      "preferred-name": "Maya",
      "target-program": "skills_development",
      "eligibility-age": "yes",
      "example-input-5": "",
      "example-radio-2": "college",
      "address-postcode": "J9P 0B9",
      "address-province": "qc",
      "ages-of-children": "",
      "visible-minority": "false",
      "income-employment": "1250",
      "social-assistance": "no",
      "dependent-children": "no",
      "edication-location": "Cegep de l'Abitibi-Temiscamingue, QC",
      "eligibility-female": "yes",
      "expenses-groceries": "360",
      "expenses-utilities": "150",
      "preferred-language": "fr",
      "requested-supports": ["tuition", "living", "other"],
      "expenses-other-list": "Travel for land-based practicum 95",
      "income-band-funding": "200",
      "labour-force-status": "student",
      "registration-number": "QC-000000",
      "eligibility-canadian": "yes",
      "eligibility-training": "yes",
      "expenses-transitpass": "65",
      "income-child-benefit": "0",
      "income-social-assist": "0",
      "contact-email-address": "bill@sillery.co.uk",
      "eligibility-financial": "yes",
      "address-street-address": "27 Rue des Pins",
      "disability-description": "No disability disclosed.",
      "eligibility-employment": "yes",
      "eligibility-indigenous": "yes",
      "emergency-contact-name": "Elise Papatie",
      "address-mailing-address": "C.P. 45, Val-d'Or, QC J9P 3C3",
      "other-requested-support": "Travel for land-based practicum.",
      "social-insurance-number": "000 000 000",
      "eligibility-disqualified": "no",
      "income-other-description": "Summer guide honorarium.",
      "legal-indigenous-identity": "first_nations_status",
      "emergency-contact-telephone": "(819) 555-4415",
      "what-is-your-gender-identity": "1",
      "emergency-contact-relationship": "Sister"
    }
  },
  {
    id: "layla-doucette",
    registrationPrefix: "NS",
    payload: {
      "dob": "1985-01-22",
      "consent": { "name": "Layla Doucette", "signed": true },
      "indigenous_declaration": { "name": "Layla Doucette", "signed": true },
      "barriers": ["funding", "lack-of-job-opportunities"],
      "last-name": "Doucette",
      "first-name": "Layla",
      "address-city": "Sydney",
      "income-other": "0",
      "middle-names": "Marie",
      "spouses-name": "",
      "expenses-rent": "940",
      "other-barrier": "",
      "telephone-alt": "",
      "telephone-day": "(902) 555-6712",
      "top-up-amount": "390",
      "education-year": "2006",
      "has-disability": "yes",
      "home-comminuty": "Membertou",
      "income-jordans": "0",
      "income-spousal": "0",
      "long-term-goal": "Expand a community catering business that employs youth from Membertou.",
      "marital-status": "divorced",
      "preferred-name": "Layla",
      "target-program": "tws",
      "eligibility-age": "yes",
      "example-input-5": "",
      "example-radio-2": "college",
      "address-postcode": "B1P 4W6",
      "address-province": "ns",
      "ages-of-children": "10",
      "visible-minority": "false",
      "income-employment": "2400",
      "social-assistance": "no",
      "dependent-children": "yes",
      "edication-location": "Nova Scotia Community College, NS",
      "eligibility-female": "yes",
      "expenses-groceries": "520",
      "expenses-utilities": "240",
      "preferred-language": "en",
      "requested-supports": ["living", "transportation"],
      "expenses-other-list": "Vehicle maintenance 140",
      "income-band-funding": "0",
      "labour-force-status": "self-employed",
      "registration-number": "NS-000000",
      "eligibility-canadian": "yes",
      "eligibility-training": "yes",
      "expenses-transitpass": "110",
      "income-child-benefit": "320",
      "income-social-assist": "0",
      "contact-email-address": "bill@sillery.co.uk",
      "eligibility-financial": "yes",
      "address-street-address": "55 Tower Road",
      "disability-description": "Recovering from knee surgery; uses mobility supports during long days.",
      "eligibility-employment": "yes",
      "eligibility-indigenous": "yes",
      "emergency-contact-name": "June Paul",
      "address-mailing-address": "",
      "other-requested-support": "",
      "social-insurance-number": "000 000 000",
      "eligibility-disqualified": "no",
      "income-other-description": "",
      "legal-indigenous-identity": "first_nations_status",
      "emergency-contact-telephone": "(902) 555-6710",
      "what-is-your-gender-identity": "1",
      "emergency-contact-relationship": "Mother"
    }
  },
  {
    id: "elias-redsky",
    registrationPrefix: "MB",
    payload: {
      "dob": "1989-08-30",
      "consent": { "name": "Elias Redsky", "signed": true },
      "indigenous_declaration": { "name": "Elias Redsky", "signed": true },
      "barriers": ["education", "other"],
      "last-name": "Redsky",
      "first-name": "Elias",
      "address-city": "Winnipeg",
      "income-other": "210",
      "middle-names": "James",
      "spouses-name": "",
      "expenses-rent": "780",
      "other-barrier": "Needs trauma-informed counselling near campus.",
      "telephone-alt": "",
      "telephone-day": "(204) 555-2341",
      "top-up-amount": "380",
      "education-year": "2010",
      "has-disability": "yes",
      "home-comminuty": "Lake St. Martin First Nation",
      "income-jordans": "0",
      "income-spousal": "0",
      "long-term-goal": "Complete social work diploma to support evacuees from northern communities.",
      "marital-status": "single",
      "preferred-name": "Elias",
      "target-program": "skills_development",
      "eligibility-age": "yes",
      "example-input-5": "",
      "example-radio-2": "college",
      "address-postcode": "R3B 0S1",
      "address-province": "mb",
      "ages-of-children": "",
      "visible-minority": "true",
      "income-employment": "0",
      "social-assistance": "yes",
      "dependent-children": "no",
      "edication-location": "Red River College Polytechnic, MB",
      "eligibility-female": "no",
      "expenses-groceries": "470",
      "expenses-utilities": "210",
      "preferred-language": "en",
      "requested-supports": ["tuition", "living", "other"],
      "expenses-other-list": "Counselling co-pay 85",
      "income-band-funding": "170",
      "labour-force-status": "unemployed",
      "registration-number": "MB-000000",
      "eligibility-canadian": "yes",
      "eligibility-training": "yes",
      "expenses-transitpass": "95",
      "income-child-benefit": "0",
      "income-social-assist": "640",
      "contact-email-address": "bill@sillery.co.uk",
      "eligibility-financial": "yes",
      "address-street-address": "219 Selkirk Avenue",
      "disability-description": "Living with PTSD; attends regular counselling sessions.",
      "eligibility-employment": "yes",
      "eligibility-indigenous": "yes",
      "emergency-contact-name": "Clara Redsky",
      "address-mailing-address": "",
      "other-requested-support": "Access to culturally safe counselling during studies.",
      "social-insurance-number": "000 000 000",
      "eligibility-disqualified": "no",
      "income-other-description": "Seasonal wildfire crew honorarium.",
      "legal-indigenous-identity": "first_nations_non_status",
      "emergency-contact-telephone": "(204) 555-2340",
      "what-is-your-gender-identity": "5",
      "emergency-contact-relationship": "Mother"
    }
  },
  {
    id: "sasha-deer",
    registrationPrefix: "YT",
    payload: {
      "dob": "1992-05-19",
      "consent": { "name": "Sasha Deer", "signed": true },
      "indigenous_declaration": { "name": "Sasha Deer", "signed": true },
      "barriers": ["location", "funding"],
      "last-name": "Deer",
      "first-name": "Sasha",
      "address-city": "Whitehorse",
      "income-other": "0",
      "middle-names": "North",
      "spouses-name": "",
      "expenses-rent": "1020",
      "other-barrier": "",
      "telephone-alt": "",
      "telephone-day": "(867) 555-7804",
      "top-up-amount": "300",
      "education-year": "2016",
      "has-disability": "no",
      "home-comminuty": "Carcross/Tagish First Nation",
      "income-jordans": "0",
      "income-spousal": "0",
      "long-term-goal": "Launch a land-based tourism co-op highlighting Tagish culture.",
      "marital-status": "single",
      "preferred-name": "Sasha",
      "target-program": "skills_development",
      "eligibility-age": "yes",
      "example-input-5": "",
      "example-radio-2": "college",
      "address-postcode": "Y1A 3T7",
      "address-province": "yt",
      "ages-of-children": "",
      "visible-minority": "false",
      "income-employment": "1650",
      "social-assistance": "no",
      "dependent-children": "no",
      "edication-location": "Yukon University, YT",
      "eligibility-female": "yes",
      "expenses-groceries": "410",
      "expenses-utilities": "190",
      "preferred-language": "en",
      "requested-supports": ["tuition", "transportation"],
      "expenses-other-list": "Land-based training gear 120",
      "income-band-funding": "220",
      "labour-force-status": "student",
      "registration-number": "YT-000000",
      "eligibility-canadian": "yes",
      "eligibility-training": "yes",
      "expenses-transitpass": "85",
      "income-child-benefit": "0",
      "income-social-assist": "0",
      "contact-email-address": "bill@sillery.co.uk",
      "eligibility-financial": "yes",
      "address-street-address": "17 Birch Grove",
      "disability-description": "No disability disclosed.",
      "eligibility-employment": "yes",
      "eligibility-indigenous": "yes",
      "emergency-contact-name": "Rowan Deer",
      "address-mailing-address": "",
      "other-requested-support": "",
      "social-insurance-number": "000 000 000",
      "eligibility-disqualified": "no",
      "income-other-description": "",
      "legal-indigenous-identity": "first_nations_status",
      "emergency-contact-telephone": "(867) 555-7803",
      "what-is-your-gender-identity": "4",
      "emergency-contact-relationship": "Sibling"
    }
  },
  {
    id: "kenzie-ashkewe",
    registrationPrefix: "ON",
    payload: {
      "dob": "1988-12-05",
      "consent": { "name": "Kenzie Ashkewe", "signed": true },
      "indigenous_declaration": { "name": "Kenzie Ashkewe", "signed": true },
      "barriers": ["funding", "education"],
      "last-name": "Ashkewe",
      "first-name": "Kenzie",
      "address-city": "Midland",
      "income-other": "90",
      "middle-names": "Hope",
      "spouses-name": "Lee Ashkewe",
      "expenses-rent": "1240",
      "other-barrier": "",
      "telephone-alt": "",
      "telephone-day": "(705) 555-6182",
      "top-up-amount": "420",
      "education-year": "2011",
      "has-disability": "yes",
      "home-comminuty": "Beausoleil First Nation",
      "income-jordans": "0",
      "income-spousal": "3200",
      "long-term-goal": "Become a licensed electrician specialising in community housing projects.",
      "marital-status": "married",
      "preferred-name": "Kenzie",
      "target-program": "skills_development",
      "eligibility-age": "yes",
      "example-input-5": "",
      "example-radio-2": "college",
      "address-postcode": "L4R 1K3",
      "address-province": "on",
      "ages-of-children": "4, 12",
      "visible-minority": "true",
      "income-employment": "1850",
      "social-assistance": "no",
      "dependent-children": "yes",
      "edication-location": "Georgian College, ON",
      "eligibility-female": "yes",
      "expenses-groceries": "560",
      "expenses-utilities": "230",
      "preferred-language": "en",
      "requested-supports": ["tuition", "living", "other"],
      "expenses-other-list": "Childcare for evening classes 180",
      "income-band-funding": "260",
      "labour-force-status": "employed-part-time",
      "registration-number": "ON-000000",
      "eligibility-canadian": "yes",
      "eligibility-training": "yes",
      "expenses-transitpass": "110",
      "income-child-benefit": "360",
      "income-social-assist": "0",
      "contact-email-address": "bill@sillery.co.uk",
      "eligibility-financial": "yes",
      "address-street-address": "88 Water Street",
      "disability-description": "ADHD diagnosis; uses coaching to stay on track.",
      "eligibility-employment": "yes",
      "eligibility-indigenous": "yes",
      "emergency-contact-name": "Lee Ashkewe",
      "address-mailing-address": "",
      "other-requested-support": "Adaptive learning coach sessions.",
      "social-insurance-number": "000 000 000",
      "eligibility-disqualified": "no",
      "income-other-description": "Sales from weekend market booth.",
      "legal-indigenous-identity": "first_nations_status",
      "emergency-contact-telephone": "(705) 555-6181",
      "what-is-your-gender-identity": "1",
      "emergency-contact-relationship": "Spouse"
    }
  },
  {
    id: "tara-penashue",
    registrationPrefix: "NL",
    payload: {
      "dob": "1990-07-08",
      "consent": { "name": "Tara Penashue", "signed": true },
      "indigenous_declaration": { "name": "Tara Penashue", "signed": true },
      "barriers": ["location", "other"],
      "last-name": "Penashue",
      "first-name": "Tara",
      "address-city": "Sheshatshiu",
      "income-other": "150",
      "middle-names": "Marie",
      "spouses-name": "Mark Penashue",
      "expenses-rent": "860",
      "other-barrier": "Limited broadband makes online coursework difficult.",
      "telephone-alt": "",
      "telephone-day": "(709) 555-4412",
      "top-up-amount": "360",
      "education-year": "2009",
      "has-disability": "no",
      "home-comminuty": "Sheshatshiu Innu First Nation",
      "income-jordans": "0",
      "income-spousal": "0",
      "long-term-goal": "Complete social service worker diploma to support Innu families navigating services.",
      "marital-status": "separated",
      "preferred-name": "Tara",
      "target-program": "skills_development",
      "eligibility-age": "yes",
      "example-input-5": "",
      "example-radio-2": "college",
      "address-postcode": "A0P 1M0",
      "address-province": "nl",
      "ages-of-children": "8, 11",
      "visible-minority": "false",
      "income-employment": "780",
      "social-assistance": "yes",
      "dependent-children": "yes",
      "edication-location": "College of the North Atlantic, NL",
      "eligibility-female": "yes",
      "expenses-groceries": "510",
      "expenses-utilities": "210",
      "preferred-language": "en",
      "requested-supports": ["living", "transportation", "other"],
      "expenses-other-list": "After-school program fees 130",
      "income-band-funding": "120",
      "labour-force-status": "student",
      "registration-number": "NL-000000",
      "eligibility-canadian": "yes",
      "eligibility-training": "yes",
      "expenses-transitpass": "95",
      "income-child-benefit": "520",
      "income-social-assist": "420",
      "contact-email-address": "bill@sillery.co.uk",
      "eligibility-financial": "yes",
      "address-street-address": "6 Innu Road",
      "disability-description": "No disability disclosed.",
      "eligibility-employment": "yes",
      "eligibility-indigenous": "yes",
      "emergency-contact-name": "Annie Penashue",
      "address-mailing-address": "PO Box 211, Sheshatshiu, NL A0P 1M0",
      "other-requested-support": "Elder-led childcare support during field training.",
      "social-insurance-number": "000 000 000",
      "eligibility-disqualified": "no",
      "income-other-description": "Seasonal craft sales at community events.",
      "legal-indigenous-identity": "inuit",
      "emergency-contact-telephone": "(709) 555-4410",
      "what-is-your-gender-identity": "1",
      "emergency-contact-relationship": "Mother"
    }
  }
];
const randomChoice = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index];
};

const randomIntInclusive = (min, max) => {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  if (upper <= lower) {
    return lower;
  }
  return lower + Math.floor(Math.random() * (upper - lower + 1));
};

const generateRegistrationNumber = (prefix) => {
  const safePrefix = String(prefix || 'ISET').trim().toUpperCase() || 'ISET';
  return `${safePrefix}-${randomIntInclusive(100000, 999999)}`;
};

const generateRandomSin = () => {
  const digits = Array.from({ length: 9 }, (_, idx) => {
    if (idx === 0) {
      return randomIntInclusive(1, 9);
    }
    return randomIntInclusive(0, 9);
  });
  return `${digits.slice(0, 3).join('')} ${digits.slice(3, 6).join('')} ${digits.slice(6).join('')}`;
};

const coerceMoneyString = (value, fallback = '0') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const str = String(value).trim();
  if (!str) return fallback;
  const match = str.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? match[0] : fallback;
};

const coerceYesNo = (value, defaultValue = 'no') => {
  if (value === null || value === undefined) return defaultValue;
  const str = String(value).trim().toLowerCase();
  if (['yes', 'true', '1'].includes(str)) return 'yes';
  if (['no', 'false', '0'].includes(str)) return 'no';
  return defaultValue;
};

const normaliseDummyDraftPayload = (draftPayload, template) => {
  const firstName = (draftPayload['first-name'] || '').trim();
  const lastName = (draftPayload['last-name'] || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Demo Applicant';

  const templateConflict = template?.conflict || {};
  if (!draftPayload.conflict_of_interest) {
    draftPayload.conflict_of_interest = templateConflict.value || 'no_conflict';
  }
  if (!draftPayload.conflict_applicant_signature || typeof draftPayload.conflict_applicant_signature !== 'object') {
    draftPayload.conflict_applicant_signature = { name: fullName, signed: true };
  } else if (!draftPayload.conflict_applicant_signature.name) {
    draftPayload.conflict_applicant_signature.name = fullName;
  }
  if (draftPayload.conflict_of_interest === 'conflict') {
    if (templateConflict.follow && !draftPayload['2022_conflict_follow']) {
      draftPayload['2022_conflict_follow'] = templateConflict.follow;
    }
  } else if (!templateConflict.follow) {
    delete draftPayload['2022_conflict_follow'];
  }

  if (!draftPayload.biological_sex) {
    const eligFemale = coerceYesNo(draftPayload['eligibility-female'], 'no');
    draftPayload.biological_sex = eligFemale === 'yes' ? 'female' : 'male';
  }
  if (!draftPayload.gender_identity) {
    const genderMap = {
      '1': 'female',
      '2': 'other',
      '3': 'other',
      '4': 'other',
      '5': 'other',
      female: 'female',
      male: 'male'
    };
    const original = draftPayload['what-is-your-gender-identity'];
    const mapped = genderMap[String(original || '').toLowerCase()] || draftPayload.biological_sex || 'female';
    draftPayload.gender_identity = mapped;
  }

  draftPayload['has-disability'] = coerceYesNo(draftPayload['has-disability'], 'no');
  draftPayload['social-assistance'] = coerceYesNo(draftPayload['social-assistance'], 'no');
  draftPayload['dependent-children'] = coerceYesNo(draftPayload['dependent-children'], 'no');
  draftPayload['disability-support'] = coerceYesNo(
    draftPayload['disability-support'],
    draftPayload['has-disability'] === 'yes' ? 'yes' : 'no'
  );
  if (!draftPayload['disability-support_yes_follow']) {
    draftPayload['disability-support_yes_follow'] = '';
  }

  if (!draftPayload['education-location']) {
    draftPayload['education-location'] = draftPayload['address-province'] || 'other';
  }

  const incomeKeys = [
    'income-employment',
    'income-spousal',
    'income-social-assist',
    'income-child-support',
    'income-child-benefit',
    'income-jordans',
    'income-band-funding',
    'income-alimony',
    'income-other-description'
  ];
  incomeKeys.forEach(key => {
    draftPayload[key] = coerceMoneyString(draftPayload[key]);
  });
  if (!draftPayload['income-other']) {
    draftPayload['income-other'] = '';
  }

  draftPayload['top-up-amount'] = coerceMoneyString(draftPayload['top-up-amount']);
  draftPayload['example-input-5'] = coerceMoneyString(draftPayload['example-input-5']);

  if (!draftPayload['expenses_bus_pass'] && draftPayload['expenses-transitpass'] !== undefined) {
    draftPayload['expenses_bus_pass'] = coerceMoneyString(draftPayload['expenses-transitpass']);
  } else {
    draftPayload['expenses_bus_pass'] = coerceMoneyString(draftPayload['expenses_bus_pass']);
  }
  draftPayload['expenses-parking'] = coerceMoneyString(draftPayload['expenses-parking']);
  draftPayload['expenses_transport_mileage'] = coerceMoneyString(draftPayload['expenses_transport_mileage']);
  if (!Array.isArray(draftPayload['expenses_transport'])) {
    const transport = [];
    if (Number(coerceMoneyString(draftPayload['expenses_bus_pass'])) > 0) transport.push('buss_pass');
    if (Number(coerceMoneyString(draftPayload['expenses-parking'])) > 0) transport.push('parking');
    if (Number(coerceMoneyString(draftPayload['expenses_transport_mileage'])) > 0) transport.push('mileage');
    draftPayload['expenses_transport'] = transport;
  }

  draftPayload['contact-email-address'] = draftPayload['contact-email-address'] || 'demo.applicant@example.com';
};

const buildDummyDraft = () => {
  const template = randomChoice(DUMMY_APPLICATION_PROFILES) || DUMMY_APPLICATION_PROFILES[0];
  const draftPayload = JSON.parse(JSON.stringify(template.payload));
  draftPayload['registration-number'] = generateRegistrationNumber(template.registrationPrefix);
  draftPayload['social-insurance-number'] = generateRandomSin();
  normaliseDummyDraftPayload(draftPayload, template);
  const history = Array.isArray(template.history) && template.history.length
    ? [...template.history]
    : [...DUMMY_DRAFT_HISTORY];
  const applicantName = [
    draftPayload['first-name'],
    draftPayload['last-name']
  ].filter(Boolean).join(' ').trim() || 'Demo Applicant';
  return {
    draftPayload,
    history,
    summary: {
      applicantName,
      profileId: template.id,
      homeCommunity: draftPayload['home-comminuty'] || null,
      targetProgram: draftPayload['target-program'] || null
    }
  };
};
// --- Dummy Draft Insertion (test helper) ------------------------------------
// POST /api/create-dummy-draft
// Body (optional): { userId?: number, stepCursor?: string, workflowId?: string }
// Inserts or updates a single-row draft (table has UNIQUE user_id) to speed portal testing.
app.post('/api/create-dummy-draft', async (req, res) => {
  try {
    const body = req.body || {};
    const userId = Number(body.userId) || 48;               // default test applicant
    const workflowId = String(body.workflowId || 'iset-v1');
    const stepCursor = String(body.stepCursor || 'summary-page');

    const { draftPayload, history, summary } = buildDummyDraft();

    // Check existing row
    const [existingRows] = await pool.query(
      'SELECT id, version FROM iset_intake.iset_application_draft_dynamic WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (existingRows.length) {
      const current = existingRows[0];
      const newVersion = Number(current.version || 1) + 1;
      await pool.query(
        `UPDATE iset_intake.iset_application_draft_dynamic
           SET workflow_id = ?, step_cursor = ?, draft_payload = ?, history = ?, doc_refs = NULL, version = ?
         WHERE user_id = ?`,
        [workflowId, stepCursor, JSON.stringify(draftPayload), JSON.stringify(history), newVersion, userId]
      );
      return res.json({
        ok: true,
        action: 'updated',
        userId,
        version: newVersion,
        stepCursor,
        workflowId,
        applicant: summary
      });
    }

    // Insert fresh
    await pool.query(
      `INSERT INTO iset_intake.iset_application_draft_dynamic
         (user_id, workflow_id, step_cursor, draft_payload, history, doc_refs, version)
       VALUES (?,?,?,?,?,NULL,1)`,
      [userId, workflowId, stepCursor, JSON.stringify(draftPayload), JSON.stringify(history)]
    );

    res.json({
      ok: true,
      action: 'inserted',
      userId,
      version: 1,
      stepCursor,
      workflowId,
      applicant: summary
    });
  } catch (err) {
    console.error('[dummy-draft] error:', err.message);
    res.status(500).json({ error: 'dummy_draft_failed', message: err.message });
  }
});

// Unified applicant documents endpoint now sources from iset_document (generalized store)
app.get('/api/applicants/:id/documents', async (req, res) => {
  const applicantId = req.params.id;
  try {
    const [rows] = await pool.query(
      `SELECT id, case_id, application_id, file_name, file_path, label, source, created_at AS uploaded_at
       FROM iset_document
       WHERE applicant_user_id = ? AND status = 'active'
       ORDER BY created_at DESC`,
      [applicantId]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching applicant documents:', error);
    res.status(500).json({ error: 'Failed to fetch applicant documents' });
  }
});

app.get('/api/documents/:id/presign-download', async (req, res) => {
  const documentId = Number(req.params.id);
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return res.status(400).json({ error: 'invalid_document_id' });
  }
  try {
    const [[doc]] = await pool.query(
      "SELECT id, file_name, file_path FROM iset_document WHERE id = ? AND status = 'active' LIMIT 1",
      [documentId]
    );
    if (!doc) {
      return res.status(404).json({ error: 'document_not_found' });
    }
    if (!doc.file_path) {
      return res.status(404).json({ error: 'file_missing' });
    }
    const storageModeEnv = (process.env.UPLOAD_MODE || process.env.UPLOAD_DRIVER || '').toLowerCase();
    const storageMode = storageModeEnv === 's3' ? 's3' : 'local-direct';
    if (storageMode === 's3') {
      try {
        const { presignGet } = require('../ISET-intake/s3Provider');
        const presigned = await presignGet({ key: doc.file_path });
        return res.json({
          mode: 's3',
          fileId: doc.id,
          filename: doc.file_name,
          key: doc.file_path,
          presigned
        });
      } catch (err) {
        console.error('[admin:documents:presign-download:s3] error', err);
        return res.status(500).json({ error: 's3_presign_failed' });
      }
    }
    const normalizedPath = String(doc.file_path).replace(/\\\\/g, '/').replace(/^\/+/, '');
    return res.json({
      mode: 'local-direct',
      fileId: doc.id,
      filename: doc.file_name,
      path: '/' + normalizedPath
    });
  } catch (error) {
    console.error('[admin:documents:presign-download] error', error);
    return res.status(500).json({ error: 'failed_to_presign_document' });
  }
});

/**
 * GET /api/cases
 *
 * Returns paginated case listings with client + owner context.
 * Response shape:
 * {
 *   items: CaseRow[],
 *   page,
 *   pageSize,
 *   totalCount
 * }
 */
app.get('/api/cases', async (req, res) => {
  const firstValue = value => firstQueryValue(value);
  const parseList = value => {
    if (Array.isArray(value)) return value.flatMap(item => parseList(item));
    if (typeof value === 'string') {
      return value
        .split(',')
        .map(token => token.trim())
        .filter(token => token.length);
    }
    if (value === null || typeof value === 'undefined') return [];
    return [String(value).trim()].filter(Boolean);
  };
  const toIsoString = value => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && String(value).trim() !== '') {
      return new Date(asNumber).toISOString();
    }
    try {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
      return null;
    }
  };

  try {
    const page = Math.max(1, parseInt(firstValue(req.query.page) ?? '1', 10) || 1);
    const rawPageSize = parseInt(firstValue(req.query.pageSize) ?? '25', 10);
    const pageSize = Math.min(Math.max(Number.isFinite(rawPageSize) ? rawPageSize : 25, 1), 100);
    const offset = (page - 1) * pageSize;

    const whereClauses = [];
    const params = [];

    const statusFilters = parseList(req.query.status)
      .map(normaliseCaseStatusValue)
      .filter(Boolean);
    if (statusFilters.length) {
      whereClauses.push(
        `LOWER(COALESCE(c.status, '')) IN (${statusFilters.map(() => '?').join(', ')})`
      );
      params.push(...statusFilters);
    } else {
      whereClauses.push(`LOWER(COALESCE(c.status, '')) <> ?`);
      params.push(CASE_STATUS_DERIVED_VALUES.archived);
    }

    const ownerFilters = parseList(req.query.owner)
      .map(token => Number.parseInt(token, 10))
      .filter(Number.isFinite);
    if (ownerFilters.length) {
      whereClauses.push(`c.assigned_to_user_id IN (${ownerFilters.map(() => '?').join(', ')})`);
      params.push(...ownerFilters);
    }

    const searchRaw = firstValue(req.query.query);
    if (typeof searchRaw === 'string' && searchRaw.trim()) {
      const search = `%${searchRaw.trim().toLowerCase()}%`;
      whereClauses.push(
        `(
          LOWER(COALESCE(cl.first_name, '')) LIKE ?
          OR LOWER(COALESCE(cl.last_name, '')) LIKE ?
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.full_name'))) LIKE ?
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."preferred-name"'))) LIKE ?
          OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number'))) LIKE ?
          OR LOWER(COALESCE(sp.display_name, sp.name, '')) LIKE ?
          OR LOWER(COALESCE(sp.email, '')) LIKE ?
        )`.replace(/\s+/g, ' ')
      );
      params.push(search, search, search, search, search, search, search);
    }

    const role = inferUserRole(req);
    const requesterId = Number.parseInt(
      req?.staffProfile?.id ?? req?.auth?.userId ?? req?.auth?.sub ?? '', 10
    );
    const requesterRegionId = Number.parseInt(
      req?.staffProfile?.region_id ?? req?.auth?.regionId ?? '', 10
    );

    const allowAll =
      role === 'System Administrator' ||
      role === 'Program Administrator' ||
      role === 'SysAdmin' ||
      role === 'ProgramAdmin';

    if (!allowAll) {
      if (role === 'Regional Coordinator') {
        if (!Number.isFinite(requesterRegionId)) {
          return res.status(403).json({ error: 'forbidden', detail: 'region_scope_missing' });
        }
        whereClauses.push('(sp.region_id = ? OR c.assigned_to_user_id IS NULL)');
        params.push(requesterRegionId);
      } else if (role === 'Application Assessor' || role === 'Adjudicator') {
        if (!Number.isFinite(requesterId)) {
          return res.status(403).json({ error: 'forbidden', detail: 'assessor_scope_missing' });
        }
        whereClauses.push('c.assigned_to_user_id = ?');
        params.push(requesterId);
      } else {
        return res.status(403).json({ error: 'forbidden' });
      }
    }

    const sortMap = {
      status: 'c.status',
      createdAt: 'c.created_at',
      updatedAt: 'c.updated_at',
      clientName: 'client_sort_last_name',
    };
    const sortKey = String(firstValue(req.query.sort) || '').trim();
    const sortColumn = sortMap[sortKey] || 'c.updated_at';
    const direction =
      String(firstValue(req.query.direction) || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const baseFrom = `
      FROM iset_case c
      LEFT JOIN client cl ON c.client_id = cl.id
      LEFT JOIN iset_application a ON c.application_id = a.id
      LEFT JOIN staff_profiles sp ON c.assigned_to_user_id = sp.id
      LEFT JOIN (
        SELECT
          case_id,
          SUM(
            CASE
              WHEN LOWER(COALESCE(status, '')) IN ('open', 'in_progress', 'in-progress', 'inprogress')
              THEN 1
              ELSE 0
            END
          ) AS open_task_count,
          SUM(
            CASE
              WHEN LOWER(COALESCE(status, '')) IN ('open', 'in_progress', 'in-progress', 'inprogress')
                AND due_at IS NOT NULL
                AND due_at < NOW()
              THEN 1
              ELSE 0
            END
          ) AS overdue_task_count
        FROM iset_case_task
        GROUP BY case_id
      ) task_counts ON task_counts.case_id = c.id
      LEFT JOIN (
        SELECT
          case_id,
          SUM(
            CASE
              WHEN LOWER(COALESCE(status, '')) IN (
                'planned',
                'planning',
                'draft',
                'in_progress',
                'in-progress',
                'inprogress',
                'suspended',
                'on_hold',
                'on-hold',
                'active'
              )
              THEN 1
              ELSE 0
            END
          ) AS open_intervention_count,
          COUNT(*) AS total_intervention_count
        FROM iset_case_intervention
        GROUP BY case_id
      ) intervention_counts ON intervention_counts.case_id = c.id
    `;

  const selectSql = `
      SELECT
        c.id,
        c.status,
        a.status AS application_status,
        a.status AS application_status,
        c.case_number,
        c.priority,
        c.risk_rating,
        c.next_action_due_at,
        COALESCE(task_counts.open_task_count, 0) AS open_task_count,
        COALESCE(task_counts.overdue_task_count, 0) AS overdue_task_count,
        COALESCE(intervention_counts.open_intervention_count, 0) AS open_intervention_count,
        COALESCE(intervention_counts.total_intervention_count, 0) AS total_intervention_count,
        c.application_id,
        c.client_id,
        c.assigned_to_user_id,
        c.created_at,
        c.updated_at,
        sp.id AS owner_id,
        COALESCE(sp.display_name, sp.name) AS owner_name,
        sp.email AS owner_email,
        sp.primary_role AS owner_role,
        sp.region_id AS owner_region_id,
        cl.first_name AS client_first_name,
        cl.last_name AS client_last_name,
        cl.gender AS client_gender,
        cl.dob AS client_dob,
        cl.aboriginal_group AS client_aboriginal_group,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS tracking_id,
        a.created_at AS submitted_at,
        JSON_EXTRACT(a.payload_json, '$') AS payload_json,
        COALESCE(
          NULLIF(cl.last_name, ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.last_name')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."last-name"')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers.last_name')), '')
        ) AS client_sort_last_name
      ${baseFrom}
    `;

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const itemsSql = `
      ${selectSql}
      ${whereSql}
      ORDER BY ${sortColumn} ${direction}
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS total
      ${baseFrom}
      ${whereSql}
    `;

    const [rows] = await pool.query(itemsSql, [...params, pageSize, offset]);
    const [[countRow] = []] = await pool.query(countSql, params);
    const totalCount = Number(countRow?.total ?? 0);

    const mapRowToCase = row => {
      let payload = null;
      if (row.payload_json) {
        try {
          const asString =
            typeof row.payload_json === 'string'
              ? row.payload_json
              : Buffer.isBuffer(row.payload_json)
              ? row.payload_json.toString('utf8')
              : JSON.stringify(row.payload_json);
          payload = JSON.parse(asString);
        } catch {
          payload = null;
        }
      }

      const payloadPersonal = (payload && payload.personal) || {};
      const payloadAnswers = (payload && payload.answers) || {};
      const payloadSubmission = (payload && payload.submission_snapshot) || {};

      const fallbackFirstName =
        row.client_first_name ||
        payloadPersonal.first_name ||
        payloadAnswers['first-name'] ||
        payloadAnswers.first_name ||
        null;
      const fallbackLastName =
        row.client_last_name ||
        payloadPersonal.last_name ||
        payloadAnswers['last-name'] ||
        payloadAnswers.last_name ||
        null;

      const client = {
        id: row.client_id || null,
        firstName: fallbackFirstName || null,
        lastName: fallbackLastName || null,
        gender: row.client_gender || payloadPersonal.gender || null,
        dob: toIsoString(row.client_dob) || payloadPersonal.dob || null,
        aboriginalGroup: row.client_aboriginal_group || payloadPersonal.aboriginal_group || null,
      };

      const owner =
        row.owner_id || row.owner_email
          ? {
              id: row.owner_id || null,
              name: row.owner_name || row.owner_email || null,
              email: row.owner_email || null,
              role: row.owner_role || null,
              regionId: row.owner_region_id || null,
            }
          : null;

      const statusNormalized = normaliseCaseStatusValue(row.status);
      const resolvedStatus = statusNormalized || CASE_STATUS_DERIVED_VALUES.pendingApproval;

      const openTasks = Number.isFinite(Number(row.open_task_count))
        ? Number(row.open_task_count)
        : 0;
      const overdueTasks = Number.isFinite(Number(row.overdue_task_count))
        ? Number(row.overdue_task_count)
        : 0;
      const openInterventions = Number.isFinite(Number(row.open_intervention_count))
        ? Number(row.open_intervention_count)
        : 0;
      const totalInterventions = Number.isFinite(Number(row.total_intervention_count))
        ? Number(row.total_intervention_count)
        : 0;

      const counts = {
        openTasks,
        overdueTasks,
        openInterventions,
        totalInterventions,
      };

      return {
        id: row.id,
        status: resolvedStatus,
        statusRaw: row.status || null,
        priority: row.priority || null,
        riskRating: row.risk_rating || null,
        openedAt: toIsoString(row.created_at),
        closedAt: null,
        lastActivityAt: toIsoString(row.updated_at),
        nextActionDueAt: toIsoString(row.next_action_due_at),
        applicationId: row.application_id || null,
        trackingId:
          row.tracking_id ||
          payloadSubmission.reference_number ||
          (row.id ? `CASE-${row.id}` : null),
        submittedAt: toIsoString(row.submitted_at),
        owner,
        client,
        openTasks,
        overdueTasks,
        openInterventions,
        totalInterventions,
        regionId: owner?.regionId ?? null,
        counts,
      };
    };

    const items = rows.map(mapRowToCase);

    res.json({
      items,
      page,
      pageSize,
      totalCount,
    });
  } catch (error) {
    console.error('GET /api/cases failed:', error);
    res.status(500).json({ error: 'cases_fetch_failed', detail: error?.message || String(error) });
  }
});

async function handleAssignmentRequest(req, res, { requireExistingAssignee = false, disallowSelfReassign = false } = {}) {
  const caseId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(caseId) || caseId < 1) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }

  const toUserIdRaw = req.body?.toUserId ?? req.body?.assigneeId ?? req.body?.assignedToUserId ?? null;
  const toUserId = Number.parseInt(toUserIdRaw, 10);
  if (!Number.isInteger(toUserId) || toUserId < 1) {
    return res.status(422).json({ error: 'invalid_target_user' });
  }

  try {
    const identity = getRequesterIdentity(req);
    const caseRow = await fetchCaseRow(caseId);
    if (!caseRow) {
      return res.status(404).json({ error: 'case_not_found' });
    }

    if (requireExistingAssignee && !caseRow.assigned_to_user_id) {
      return res.status(409).json({ error: 'no_current_assignee' });
    }

    const requesterIsCurrentAssignee =
      Number.isFinite(identity.userId) &&
      Number(caseRow.assigned_to_user_id) === Number(identity.userId);
    if (disallowSelfReassign && requesterIsCurrentAssignee) {
      return res.status(403).json({ error: 'forbidden', detail: 'self_reassign_not_allowed' });
    }

    const targetStaff = await fetchStaffProfileById(toUserId);
    if (!targetStaff) {
      return res.status(404).json({ error: 'staff_not_found' });
    }

    if (!ensureCanAssignCase(identity, targetStaff)) {
      return res.status(403).json({ error: 'forbidden', detail: 'assignment_not_permitted' });
    }

    const previousStaff =
      caseRow.assigned_to_user_id != null
        ? await fetchStaffProfileById(Number(caseRow.assigned_to_user_id))
        : null;

    if (previousStaff?.id && Number(previousStaff.id) === Number(toUserId)) {
      return res.status(200).json({
        ok: true,
        caseId,
        assignedToUserId: toUserId,
        unchanged: true,
      });
    }

    await persistCaseAssignment(caseId, toUserId);

    await publishAssignmentEvent({
      caseId,
      applicationId: caseRow.application_id || null,
      previousStaff,
      nextStaff: targetStaff,
      actor: resolveRequestActor(req),
    });

    return res.status(200).json({
      ok: true,
      caseId,
      assignedToUserId: toUserId,
    });
  } catch (error) {
    console.error('Assignment request failed:', error);
    return res
      .status(500)
      .json({ error: 'assignment_failed', detail: error?.message || String(error) });
  }
}

app.post('/api/cases/:id/assign', (req, res) =>
  handleAssignmentRequest(req, res, { requireExistingAssignee: false, disallowSelfReassign: false })
);

app.post('/api/cases/:id/reassign', (req, res) =>
  handleAssignmentRequest(req, res, { requireExistingAssignee: true, disallowSelfReassign: true })
);

// -------------------------------------------------------------
// Application Versioning (Working Copy) Endpoints (Initial Draft)
// -------------------------------------------------------------
// GET /api/cases/:case_id/application/versions  -> list metadata of versions
// GET /api/cases/:case_id/application/current   -> current working version payload
// POST /api/cases/:case_id/application/versions -> create new version (full payload replace for now)

app.get('/api/cases/:case_id/application/versions', async (req, res) => {
  const caseId = Number(req.params.case_id);
  if (!caseId) return res.status(400).json({ error: 'invalid_case_id' });
  try {
    const [rows] = await pool.query(
      `SELECT id, version_number, created_at, source_type, change_summary, is_current
         FROM iset_application_version
        WHERE case_id = ?
        ORDER BY version_number ASC`,
      [caseId]
    );
    return res.json(rows);
  } catch (e) {
    console.error('[versions:list] error', e);
    return res.status(500).json({ error: 'failed_to_list_versions' });
  }
});

app.get('/api/cases/:case_id/application/current', async (req, res) => {
  const caseId = Number(req.params.case_id);
  if (!caseId) return res.status(400).json({ error: 'invalid_case_id' });
  try {
    const [[row]] = await pool.query(
      `SELECT id, version_number, payload_json, created_at, source_type, change_summary
         FROM iset_application_version
        WHERE case_id = ? AND is_current = 1
        LIMIT 1`,
      [caseId]
    );
    if (!row) return res.status(404).json({ error: 'no_current_version' });
    return res.json(row);
  } catch (e) {
    console.error('[versions:current] error', e);
    return res.status(500).json({ error: 'failed_to_fetch_current_version' });
  }
});

app.post('/api/cases/:case_id/application/versions', async (req, res) => {
  const caseId = Number(req.params.case_id);
  if (!caseId) return res.status(400).json({ error: 'invalid_case_id' });
  const { payload, changeSummary, sourceType = 'manual_edit' } = req.body || {};
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'payload_required' });
  try {
    // Fetch current version
    const [[current]] = await pool.query(
      `SELECT id, version_number, payload_json, submission_id
         FROM iset_application_version
        WHERE case_id = ? AND is_current = 1
        LIMIT 1`,
      [caseId]
    );
    if (!current) {
      return res.status(409).json({ error: 'no_initial_version', message: 'Initial version not seeded yet.' });
    }
    const nextVersion = current.version_number + 1;
    const crypto = require('crypto');
    const canonical = JSON.stringify(payload);
    const hash = crypto.createHash('sha256').update(canonical).digest('hex');
    // Mark old current
    await pool.query('UPDATE iset_application_version SET is_current = 0 WHERE id = ?', [current.id]);
    // Insert new
    await pool.query(
      `INSERT INTO iset_application_version (
         case_id, submission_id, version_number, payload_json, created_by_evaluator_id, change_summary, source_type, previous_version_id, payload_hash, is_current
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        caseId,
        current.submission_id,
        nextVersion,
        JSON.stringify(payload),
        null, // TODO: link evaluator (need auth mapping)
        changeSummary || null,
        sourceType,
        current.id,
        hash
      ]
    );
    await markEsdcParticipantSubmissionNeedsReview(null, caseId, { resetSnapshot: true, resetSubmissionStatus: true });
    return res.status(201).json({ message: 'version_created', version_number: nextVersion, hash });
  } catch (e) {
    console.error('[versions:create] error', e);
    return res.status(500).json({ error: 'failed_to_create_version' });
  }
});


// Get a single case by case id
app.get('/api/cases/:id/workspace', async (req, res) => {
  const caseId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }

  try {
    const sql = `
      SELECT
        c.id,
        c.application_id,
        c.client_id,
        c.assigned_to_user_id,
        c.case_number,
        c.status,
        c.priority,
        c.risk_rating,
        c.opened_at,
        c.closed_at,
        c.updated_at,
        c.next_action_due_at,
        COALESCE(task_counts.open_task_count, 0) AS open_task_count,
        COALESCE(task_counts.overdue_task_count, 0) AS overdue_task_count,
        COALESCE(intervention_counts.open_intervention_count, 0) AS open_intervention_count,
        COALESCE(intervention_counts.total_intervention_count, 0) AS total_intervention_count,
        c.portfolio_region_id,
        cl.first_name AS client_first_name,
        cl.last_name AS client_last_name,
        cl.dob AS client_dob,
        cl.gender AS client_gender,
        cl.aboriginal_group AS client_aboriginal_group,
        cl.address_json AS client_address_json,
        sp.display_name AS owner_display_name,
        sp.name AS owner_name,
        sp.email AS owner_email,
        sp.primary_role AS owner_role,
        sp.region_id AS owner_region_id,
        cr.code AS region_code,
        cr.name_en AS region_name,
        owner_region.code AS owner_region_code,
        owner_region.name_en AS owner_region_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.first_name')) AS payload_personal_first_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.last_name')) AS payload_personal_last_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.full_name')) AS payload_personal_full_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."first-name"')) AS payload_answers_first_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."last-name"')) AS payload_answers_last_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers.dob')) AS payload_answers_dob,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."preferred-name"')) AS payload_preferred_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS payload_reference_number,
        s.reference_number AS submission_reference_number,
        a.created_at AS application_created_at,
        COALESCE(
          applicant_submission.id,
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.user_id')), '')
        ) AS applicant_user_id,
        COALESCE(
          applicant_submission.name,
          JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.full_name')),
          JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."first-name"'))
        ) AS applicant_name,
        applicant_submission.email AS applicant_email
      FROM iset_case c
      LEFT JOIN client cl ON cl.id = c.client_id
      LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id
      LEFT JOIN canada_region cr ON cr.region_id = c.portfolio_region_id
      LEFT JOIN canada_region owner_region ON owner_region.region_id = sp.region_id
      LEFT JOIN iset_application a ON a.id = c.application_id
      LEFT JOIN iset_application_submission s ON s.id = a.submission_id
      LEFT JOIN user applicant_submission ON applicant_submission.id = s.user_id
      LEFT JOIN (
        SELECT
          case_id,
          SUM(
            CASE
              WHEN LOWER(COALESCE(status, '')) IN ('open', 'in_progress', 'in-progress', 'inprogress')
              THEN 1
              ELSE 0
            END
          ) AS open_task_count,
          SUM(
            CASE
              WHEN LOWER(COALESCE(status, '')) IN ('open', 'in_progress', 'in-progress', 'inprogress')
                AND due_at IS NOT NULL
                AND due_at < NOW()
              THEN 1
              ELSE 0
            END
          ) AS overdue_task_count
        FROM iset_case_task
        GROUP BY case_id
      ) task_counts ON task_counts.case_id = c.id
      LEFT JOIN (
        SELECT
          case_id,
          SUM(
            CASE
              WHEN LOWER(COALESCE(status, '')) IN (
                'planned',
                'planning',
                'draft',
                'in_progress',
                'in-progress',
                'inprogress',
                'suspended',
                'on_hold',
                'on-hold',
                'active'
              )
              THEN 1
              ELSE 0
            END
          ) AS open_intervention_count,
          COUNT(*) AS total_intervention_count
        FROM iset_case_intervention
        GROUP BY case_id
      ) intervention_counts ON intervention_counts.case_id = c.id
      WHERE c.id = ?
      LIMIT 1
    `;

    const [[row] = []] = await pool.query(sql, [caseId]);
    if (!row) {
      return res.status(404).json({ error: 'case_not_found' });
    }

    const identity = getRequesterIdentity(req);
    const role = inferUserRole(req);
    const allowAll =
      role === 'System Administrator' ||
      role === 'Program Administrator' ||
      role === 'SysAdmin' ||
      role === 'ProgramAdmin';

    if (!allowAll) {
      if (role === 'Regional Coordinator' || role === 'RegionalCoordinator') {
        const regionId = Number.isFinite(identity.regionId) ? Number(identity.regionId) : null;
        if (!Number.isFinite(regionId)) {
          return res.status(403).json({ error: 'forbidden', detail: 'region_scope_missing' });
        }
        const isUnassigned = typeof row.assigned_to_user_id === 'undefined' || row.assigned_to_user_id === null;
        const portfolioRegionMatch =
          Number.isFinite(row.portfolio_region_id) && Number(row.portfolio_region_id) === regionId;
        const ownerRegionMatch =
          Number.isFinite(row.owner_region_id) && Number(row.owner_region_id) === regionId;
        if (!isUnassigned && !portfolioRegionMatch && !ownerRegionMatch) {
          return res.status(403).json({ error: 'forbidden', detail: 'region_scope_mismatch' });
        }
      } else if (role === 'Application Assessor' || role === 'Adjudicator') {
        const requesterId = Number.isFinite(identity.userId) ? Number(identity.userId) : null;
        if (!Number.isFinite(requesterId)) {
          return res.status(403).json({ error: 'forbidden', detail: 'assessor_scope_missing' });
        }
        if (Number(row.assigned_to_user_id) !== requesterId) {
          return res.status(403).json({ error: 'forbidden' });
        }
      } else {
        return res.status(403).json({ error: 'forbidden' });
      }
    }

    let clientRegionObject = null;
    let clientRegionLabel = null;
    const parsedAddress = safeJsonParse(row.client_address_json, null);
    if (parsedAddress && typeof parsedAddress === 'object') {
      const addressDetails =
        parsedAddress.address && typeof parsedAddress.address === 'object'
          ? parsedAddress.address
          : parsedAddress;
      const provinceCandidate = normaliseString(
        addressDetails?.province ||
          addressDetails?.province_code ||
          addressDetails?.provinceCode ||
          parsedAddress?.province ||
          parsedAddress?.province_code ||
          parsedAddress?.provinceCode
      );
      if (provinceCandidate) {
        const provinceCode =
          PROVINCE_CODE_MAP[provinceCandidate.toLowerCase()] || provinceCandidate.toUpperCase();
        const provinceName = PROVINCE_LABEL_MAP[provinceCode] || provinceCode;
        clientRegionObject = {
          code: provinceCode,
          name: provinceName,
        };
        clientRegionLabel = provinceName;
      }
    }

    const [planRows] = await pool.query(
      `SELECT
         ap.id,
         ap.case_id,
         ap.name,
         ap.status,
         ap.effective_date,
         ap.review_date,
         ap.activated_at,
         ap.closed_at,
         ap.result_code,
         ap.result_date,
         ap.outcome_summary,
         ap.closure_notes,
         ap.owner_staff_profile_id,
         ap.owner_user_id,
         ap.notes,
         ap.metadata_json,
          ap.archived_at,
         ap.created_at,
         ap.updated_at,
         (
           SELECT COUNT(*)
           FROM iset_case_intervention ci
           WHERE ci.action_plan_id = ap.id
         ) AS intervention_count
       FROM iset_case_action_plan ap
       WHERE ap.case_id = ?
       ORDER BY ap.created_at ASC, ap.id ASC`,
      [caseId]
    );

    const planIds = planRows.map(plan => plan.id).filter(id => Number.isFinite(Number(id)));
    const interventionsByPlan = new Map();
    if (planIds.length > 0) {
      const [interventionRows] = await pool.query(
        `SELECT
           ci.*
         FROM iset_case_intervention ci
         WHERE ci.action_plan_id IN (?)
         ORDER BY ci.start_date IS NULL, ci.start_date ASC, ci.id ASC`,
        [planIds]
      );
      interventionRows.forEach(row => {
        const mapped = mapInterventionRow(row);
        if (!mapped) return;
        const key = row.action_plan_id || 0;
        if (!interventionsByPlan.has(key)) interventionsByPlan.set(key, []);
        interventionsByPlan.get(key).push(mapped);
      });
    }

    const actionPlans = planRows.map(plan => {
      const interventions = interventionsByPlan.get(plan.id) || [];
      const mapped = mapActionPlanRow({ ...plan, interventions });
      mapped.interventions = interventions;
      mapped.interventionCount = interventions.length;
      return mapped;
    });

    const toCurrencyValue = value => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return null;
      }
      return Math.round(numeric * 100) / 100;
    };

    const normalisePotEntry = (entry, index = 0) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const allocated =
        toCurrencyValue(
          entry.allocated ??
            entry.allocated_amount ??
            entry.totalAllocated ??
            entry.budget ??
            entry.limit ??
            entry.allocation
        ) ?? 0;
      const committed =
        toCurrencyValue(
          entry.committed ??
            entry.committed_amount ??
            entry.totalCommitted ??
            entry.encumbered ??
            entry.commitment
        ) ?? 0;
      const actual =
        toCurrencyValue(
          entry.actual ??
            entry.actual_amount ??
            entry.spent ??
            entry.spent_amount ??
            entry.disbursed ??
            entry.actuals
        ) ?? 0;
      const id = entry.id || entry.potId || entry.budgetPotId || `pot-${index}`;
      const nameCandidate =
        entry.name ||
        entry.title ||
        entry.label ||
        entry.potName ||
        entry.pot_label ||
        entry.pot ||
        entry.category ||
        entry.fundingStream ||
        entry.funding_stream ||
        id;
      const name =
        typeof nameCandidate === 'string' && nameCandidate.trim().length
          ? nameCandidate.trim()
          : `Budget pot ${index + 1}`;
      return {
        id,
        name,
        allocated,
        committed,
        actual,
      };
    };

    const parseSnapshotDetails = value => {
      if (!value) return [];
      let parsed = value;
      if (typeof value === 'string') {
        try {
          parsed = JSON.parse(value);
        } catch (_) {
          return [];
        }
      }
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.pots)) {
          return parsed.pots;
        }
        return Object.values(parsed);
      }
      return [];
    };

    let financeSummary = null;
    try {
      const [[snapshotRow]] = await pool.query(
        `SELECT
           as_of_date,
           allocated_amount,
           committed_amount,
           spent_amount,
           variance_amount,
           details_json
         FROM iset_case_financial_snapshot
         WHERE case_id = ?
         ORDER BY as_of_date DESC, created_at DESC
         LIMIT 1`,
        [caseId]
      );
      if (snapshotRow) {
        const allocated = toCurrencyValue(snapshotRow.allocated_amount);
        const committed = toCurrencyValue(snapshotRow.committed_amount);
        const actuals = toCurrencyValue(snapshotRow.spent_amount);
        const variance =
          toCurrencyValue(snapshotRow.variance_amount) ??
          (allocated !== null && actuals !== null ? toCurrencyValue(allocated - actuals) : null);
        const potEntries = parseSnapshotDetails(snapshotRow.details_json)
          .map((entry, index) => normalisePotEntry(entry, index))
          .filter(Boolean)
          .sort((a, b) => (b.allocated || 0) - (a.allocated || 0));
        financeSummary = {
          allocated: allocated ?? (potEntries.length ? potEntries.reduce((sum, pot) => sum + pot.allocated, 0) : null),
          committed:
            committed ?? (potEntries.length ? potEntries.reduce((sum, pot) => sum + pot.committed, 0) : null),
          actuals:
            actuals ?? (potEntries.length ? potEntries.reduce((sum, pot) => sum + pot.actual, 0) : null),
          variance:
            variance ??
            (allocated !== null && actuals !== null ? toCurrencyValue(allocated - actuals) : null),
          asOfDate: snapshotRow.as_of_date ? toDateOnlyString(snapshotRow.as_of_date) : null,
          pots: potEntries,
        };
      }
    } catch (err) {
      console.warn('[workspace] failed to load finance snapshot for case', caseId, err);
    }

    if (!financeSummary && actionPlans.length > 0) {
      const potMap = new Map();
      const addAmount = (bucket, field, value) => {
        const numeric = toCurrencyValue(value);
        if (numeric !== null) {
          bucket[field] += numeric;
        }
      };
      actionPlans.forEach(plan => {
        (plan.interventions || []).forEach(intervention => {
          const nameCandidates = [
            intervention.metadata?.finance?.potName,
            intervention.metadata?.finance?.potLabel,
            intervention.metadata?.budget?.name,
            intervention.metadata?.budget?.label,
            intervention.metadata?.potName,
            intervention.potId,
            intervention.fundingStream,
            intervention.metadata?.title,
          ];
          const name =
            nameCandidates.find(value => typeof value === 'string' && value.trim().length) ||
            'General allocation';
          const key =
            intervention.potId ||
            intervention.metadata?.budget?.id ||
            intervention.metadata?.finance?.potId ||
            name;
          if (!potMap.has(key)) {
            potMap.set(key, { id: key, name, allocated: 0, committed: 0, actual: 0 });
          }
          const bucket = potMap.get(key);
          addAmount(bucket, 'allocated', intervention.budgetAmount ?? intervention.metadata?.cost);
          addAmount(
            bucket,
            'committed',
            intervention.approvedAmount ??
              intervention.metadata?.finance?.committed ??
              intervention.metadata?.committed ??
              intervention.budgetAmount ??
              intervention.metadata?.cost
          );
          addAmount(bucket, 'actual', intervention.actualAmount ?? intervention.metadata?.finance?.actual);
        });
      });
      const pots = Array.from(potMap.values()).sort((a, b) => b.allocated - a.allocated);
      if (pots.length) {
        const allocated = pots.reduce((sum, pot) => sum + pot.allocated, 0);
        const committed = pots.reduce((sum, pot) => sum + pot.committed, 0);
        const actuals = pots.reduce((sum, pot) => sum + pot.actual, 0);
        financeSummary = {
          allocated: toCurrencyValue(allocated),
          committed: toCurrencyValue(committed),
          actuals: toCurrencyValue(actuals),
          variance: toCurrencyValue(allocated - actuals),
          pots,
        };
      }
    }

    const firstNameCandidates = [
      row.client_first_name,
      row.payload_personal_first_name,
      row.payload_answers_first_name,
      row.payload_preferred_name,
    ];
    const lastNameCandidates = [
      row.client_last_name,
      row.payload_personal_last_name,
      row.payload_answers_last_name,
    ];
    const firstName =
      firstNameCandidates.map(value => normaliseString(value)).find(Boolean) || null;
    const lastName =
      lastNameCandidates.map(value => normaliseString(value)).find(Boolean) || null;
    const fullNameFallback = normaliseString(row.payload_personal_full_name);
    const clientFullName =
      [firstName, lastName].filter(Boolean).join(' ') ||
      fullNameFallback ||
      normaliseString(row.payload_preferred_name) ||
      null;

    const payloadDob = normaliseString(row.payload_answers_dob);
    const dateOfBirth = toDateOnly(row.client_dob) || payloadDob || null;

    const trackingId =
      normaliseString(row.payload_reference_number) ||
      normaliseString(row.submission_reference_number) ||
      null;

    const agreementNumber =
      trackingId ||
      normaliseString(row.case_number) ||
      (row.id ? `CASE-${row.id}` : null);

    const caseNumber =
      normaliseString(row.case_number) ||
      trackingId ||
      (row.id ? `CASE-${row.id}` : null);

    const ownerName =
      normaliseString(row.owner_display_name) ||
      normaliseString(row.owner_name) ||
      normaliseString(row.owner_email) ||
      null;

    const caseRegion =
      row.region_name
        ? {
            id: row.portfolio_region_id || null,
            code: normaliseString(row.region_code),
            name: normaliseString(row.region_name),
          }
        : null;
    const ownerRegion =
      row.owner_region_name
        ? {
            id: row.owner_region_id || null,
            code: normaliseString(row.owner_region_code),
            name: normaliseString(row.owner_region_name),
          }
        : null;
    const counts = {
      openTasks: Number.isFinite(Number(row.open_task_count)) ? Number(row.open_task_count) : 0,
      overdueTasks: Number.isFinite(Number(row.overdue_task_count))
        ? Number(row.overdue_task_count)
        : 0,
      openInterventions: Number.isFinite(Number(row.open_intervention_count))
        ? Number(row.open_intervention_count)
        : 0,
      totalInterventions: Number.isFinite(Number(row.total_intervention_count))
        ? Number(row.total_intervention_count)
        : 0,
    };

    const statusNormalized = normaliseCaseStatusValue(row.status);
    const applicationStatusNormalised = normaliseCaseStatusValue(row.application_status);
    console.debug('[workspace] status payload', {
      caseId,
      caseStatus: statusNormalized || row.status || null,
      applicationStatus: applicationStatusNormalised || row.application_status || null,
    });

    const resolveApplicantUserId = value => {
      if (value === null || typeof value === 'undefined') return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const applicantUserIdValue = resolveApplicantUserId(row.applicant_user_id);
    const applicantNameValue = normaliseString(row.applicant_name) || null;
    const applicantEmailValue = normaliseString(row.applicant_email) || null;

    const response = {
      id: row.id,
      caseNumber,
      status: statusNormalized || CASE_STATUS_DERIVED_VALUES.pendingApproval,
      statusRaw: row.status || null,
      applicantUserId: applicantUserIdValue,
      applicant_user_id: applicantUserIdValue,
      applicantName: applicantNameValue,
      applicant_name: applicantNameValue,
      applicantEmail: applicantEmailValue,
      applicant_email: applicantEmailValue,
      applicationStatus: applicationStatusNormalised || row.application_status || null,
      priority: row.priority || null,
      riskRating: row.risk_rating || null,
      openedAt: toIsoDateTime(row.opened_at),
      closedAt: toIsoDateTime(row.closed_at),
      updatedAt: toIsoDateTime(row.updated_at),
      nextActionDueAt: toIsoDateTime(row.next_action_due_at),
      trackingId,
      applicationId: row.application_id || null,
      submittedAt: toIsoDateTime(row.application_created_at),
      client: {
        id: row.client_id || null,
        firstName,
        lastName,
        fullName: clientFullName || (firstName || lastName ? [firstName, lastName].filter(Boolean).join(' ') : 'Unknown client'),
        preferredName: normaliseString(row.payload_preferred_name) || null,
        dateOfBirth,
        gender: row.client_gender || null,
        aboriginalGroup: row.client_aboriginal_group || null,
        region: clientRegionObject,
        regionLabel: clientRegionLabel,
      },
      owner: {
        id: row.assigned_to_user_id || null,
        name: ownerName,
        email: row.owner_email || null,
        role: row.owner_role || null,
        regionId: row.owner_region_id || null,
        region: ownerRegion,
      },
      eligibility: normaliseString(row.assessment_esdc_eligibility) || null,
      counts,
      actionPlans,
    };

    const firstDefined = (...values) => {
      for (const value of values) {
        if (value !== undefined && value !== null) return value;
      }
      return null;
    };

    const normaliseYesNo = value => {
      if (value === null || typeof value === 'undefined') return null;
      const trimmed = String(value).trim().toLowerCase();
      if (['1', 'yes', 'true', 'y', 'on'].includes(trimmed)) return 'yes';
      if (['0', 'no', 'false', 'n', 'off'].includes(trimmed)) return 'no';
      return null;
    };

    const parseArrayField = value => {
      if (value === null || typeof value === 'undefined') return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed;
        } catch (_) {
          return trimmed
            .split(',')
            .map(entry => entry.trim())
            .filter(Boolean);
        }
        return [trimmed];
      }
      if (typeof value === 'object') {
        return Object.values(value)
          .map(entry => (typeof entry === 'string' ? entry.trim() : entry))
          .filter(Boolean);
      }
      return [];
    };

    const parseJsonField = (value, fallback) => {
      if (value === null || typeof value === 'undefined') return fallback;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return fallback;
        try {
          const parsed = JSON.parse(trimmed);
          return typeof parsed === 'object' && parsed !== null ? parsed : fallback;
        } catch (_) {
          return fallback;
        }
      }
      if (typeof value === 'object') return value;
      return fallback;
    };

    const toStringOrNull = value => (value === null || typeof value === 'undefined' ? null : String(value));
    const toTrimmedStringOrNull = value => {
      const result = toStringOrNull(value);
      if (!result) return null;
      const trimmed = result.trim();
      return trimmed.length ? trimmed : null;
    };

    let assessmentRow = null;
    try {
      const [[assessmentRecord] = []] = await pool.query(
        'SELECT * FROM iset_case_assessment WHERE case_id = ? LIMIT 1',
        [caseId]
      );
      assessmentRow = assessmentRecord || null;
    } catch (err) {
      console.warn('[workspace] failed to load assessment for case', caseId, err);
    }

    const DEFAULT_ITP_PAYLOAD = { tuition: '', books: '', materials: '', living: '' };
    const DEFAULT_WAGE_PAYLOAD = { wages: '', mercs: '', nonwages: '', other: '' };

    const employmentBarriers = parseArrayField(
      firstDefined(assessmentRow?.employment_barriers, row.assessment_employment_barriers)
    );
    const localAreaPriorities = parseArrayField(
      firstDefined(assessmentRow?.local_area_priorities, row.assessment_local_area_priorities)
    );
    const previousIsetNormalised = normaliseYesNo(
      firstDefined(assessmentRow?.previous_iset, row.assessment_previous_iset)
    );
    const childcareNeedNormalised = normaliseYesNo(
      firstDefined(assessmentRow?.childcare_need, row.assessment_childcare_need)
    );

    const interventionCodeValue = toStringOrNull(
      firstDefined(assessmentRow?.intervention_code, row.assessment_intervention_code)
    );
    const interventionOutcomeValue = toStringOrNull(
      firstDefined(assessmentRow?.intervention_outcome_code, row.assessment_intervention_outcome_code)
    );
    const interventionDurationValue = toStringOrNull(
      firstDefined(assessmentRow?.intervention_duration_days, row.assessment_intervention_duration_days)
    );
    const interventionCostValue = toStringOrNull(
      firstDefined(assessmentRow?.intervention_cost_total, row.assessment_intervention_cost_total)
    );
    const interventionNocValue = toTrimmedStringOrNull(
      firstDefined(assessmentRow?.intervention_related_noc, row.assessment_intervention_related_noc)
    );
    const interventionNocVersionValue = toTrimmedStringOrNull(
      firstDefined(assessmentRow?.intervention_related_noc_version, row.assessment_intervention_related_noc_version)
    );

    const rawAssessmentItp = parseJsonField(
      firstDefined(assessmentRow?.itp_payload, row.assessment_itp),
      null
    );
    const assessmentItp =
      rawAssessmentItp && typeof rawAssessmentItp === 'object'
        ? rawAssessmentItp
        : { ...DEFAULT_ITP_PAYLOAD };
    const rawAssessmentWage = parseJsonField(
      firstDefined(assessmentRow?.wage_payload, row.assessment_wage),
      null
    );
    const assessmentWage =
      rawAssessmentWage && typeof rawAssessmentWage === 'object'
        ? rawAssessmentWage
        : { ...DEFAULT_WAGE_PAYLOAD };

    const dateOfAssessmentRaw = firstDefined(
      assessmentRow?.date_of_assessment,
      row.assessment_date_of_assessment
    );
    const startDateRaw = firstDefined(
      assessmentRow?.intervention_start_date,
      row.assessment_intervention_start_date
    );
    const endDateRaw = firstDefined(
      assessmentRow?.intervention_end_date,
      row.assessment_intervention_end_date
    );
    const resultDateRaw = firstDefined(
      assessmentRow?.action_plan_result_date,
      row.assessment_action_plan_result_date
    );

    response.case_summary = assessmentRow?.overview ?? row.case_summary ?? null;
    response.assessment_date_of_assessment = toDateOnlyString(dateOfAssessmentRaw);
    response.assessment_employment_goals =
      assessmentRow?.employment_goals ?? row.assessment_employment_goals ?? null;
    response.assessment_previous_iset = previousIsetNormalised;
    response.assessment_previous_iset_details =
      assessmentRow?.previous_iset_details ?? row.assessment_previous_iset_details ?? null;
    response.assessment_employment_barriers = employmentBarriers;
    response.assessment_local_area_priorities = localAreaPriorities;
    response.assessment_other_funding_details =
      assessmentRow?.other_funding_details ?? row.assessment_other_funding_details ?? null;
    response.assessment_esdc_eligibility =
      normaliseString(firstDefined(assessmentRow?.esdc_eligibility, row.assessment_esdc_eligibility)) || null;
    response.assessment_intervention_start_date = toDateOnlyString(startDateRaw);
    response.assessment_intervention_end_date = toDateOnlyString(endDateRaw);
    response.assessment_institution = assessmentRow?.institution ?? row.assessment_institution ?? null;
    response.assessment_program_name = assessmentRow?.program_name ?? row.assessment_program_name ?? null;
    response.assessment_itp = assessmentItp;
    response.assessment_wage = assessmentWage;
    response.assessment_recommendation =
      assessmentRow?.recommendation ?? row.assessment_recommendation ?? null;
    response.assessment_justification =
      assessmentRow?.justification ?? row.assessment_justification ?? null;
    response.assessment_nwac_review =
      assessmentRow?.nwac_review ?? row.assessment_nwac_review ?? null;
    response.assessment_nwac_reason =
      assessmentRow?.nwac_reason ?? row.assessment_nwac_reason ?? null;
    response.assessment_intervention_code = interventionCodeValue;
    response.assessment_intervention_outcome_code = interventionOutcomeValue;
    response.assessment_intervention_duration_days = interventionDurationValue;
    response.assessment_intervention_cost_total = interventionCostValue;
    response.assessment_intervention_related_noc = interventionNocValue;
    response.assessment_intervention_related_noc_version = interventionNocVersionValue;
    response.assessment_childcare_need = childcareNeedNormalised;
    response.assessment_childcare_funding_details =
      assessmentRow?.childcare_funding_details ?? row.assessment_childcare_funding_details ?? null;
    response.assessment_action_plan_result_code =
      assessmentRow?.action_plan_result_code ?? row.assessment_action_plan_result_code ?? null;
    response.assessment_action_plan_result_date = toDateOnlyString(resultDateRaw);

    response.eligibility = response.assessment_esdc_eligibility;
    response.finance = financeSummary;

    const [[ilmpComplianceRow]] = await pool.query(
      `SELECT readiness_status, readiness_summary, warnings, blocking_issues, last_validated_at, payload_snapshot, payload_checksum, payload_storage_key
         FROM esdc_participant_submission
         WHERE case_id = ?
         ORDER BY id DESC
         LIMIT 1`,
      [caseId]
    );
    response.compliance = {
      ilmp: mapIlmpComplianceFromSubmission(ilmpComplianceRow),
      finance: { status: 'pending', messages: [] },
    };
    if (ilmpComplianceRow) {
      const snapshot = safeJsonParse(ilmpComplianceRow.payload_snapshot, null);
      response.exportPreview = {
        ilmp: snapshot
          ? {
              schema: snapshot.schema || null,
              generatedAt: snapshot.generatedAt || null,
              storageKey: ilmpComplianceRow.payload_storage_key || snapshot.storageKey || null,
              checksum: ilmpComplianceRow.payload_checksum || snapshot.checksum || null,
              canonical: snapshot.canonical || null,
              xml: snapshot.xml || null,
            }
          : null,
      };
    } else {
      response.exportPreview = { ilmp: null };
    }

    res.set('Cache-Control', 'no-store, max-age=0');
    res.json(response);
  } catch (error) {
    console.error('GET /api/cases/:id/workspace failed:', error);
    res.status(500).json({ error: 'workspace_fetch_failed', detail: error?.message || String(error) });
  }
});

app.post('/api/cases/:id/validate-ilmp', async (req, res) => {
  const caseId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }

  try {
    const [[caseRow]] = await pool.query(
      'SELECT id, application_id FROM iset_case WHERE id = ? LIMIT 1',
      [caseId]
    );
    if (!caseRow) {
      return res.status(404).json({ error: 'case_not_found' });
    }

    await ensureEsdcParticipantSubmissionRecord(null, caseId, caseRow.application_id || null);

    const [[submissionRow]] = await pool.query(
      'SELECT id FROM esdc_participant_submission WHERE case_id = ? ORDER BY id DESC LIMIT 1',
      [caseId]
    );
    if (!submissionRow) {
      return res.status(500).json({ error: 'submission_initialization_failed' });
    }

    await validateEsdcParticipantSubmission({ submissionId: submissionRow.id, caseId });

    const [[updatedSubmission]] = await pool.query(
      `SELECT readiness_status, readiness_summary, warnings, blocking_issues, last_validated_at
         FROM esdc_participant_submission
         WHERE id = ?`,
      [submissionRow.id]
    );

    const compliance = {
      ilmp: mapIlmpComplianceFromSubmission(updatedSubmission),
      finance: { status: 'pending', messages: [] },
    };

    res.json({ compliance });
  } catch (error) {
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message || 'case_ilmp_validation_failed' });
    }
    console.error('POST /api/cases/:id/validate-ilmp failed:', error);
    res
      .status(500)
      .json({ error: 'case_ilmp_validation_failed', detail: error?.message || String(error) });
  }
});

app.post('/api/cases/:id/prepare-ilmp', async (req, res) => {
  const caseId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }

  try {
    const [[caseRow]] = await pool.query(
      'SELECT id, application_id FROM iset_case WHERE id = ? LIMIT 1',
      [caseId]
    );
    if (!caseRow) {
      return res.status(404).json({ error: 'case_not_found' });
    }

    await ensureEsdcParticipantSubmissionRecord(null, caseId, caseRow.application_id || null);

    const [[submissionRow]] = await pool.query(
      'SELECT id FROM esdc_participant_submission WHERE case_id = ? ORDER BY id DESC LIMIT 1',
      [caseId]
    );
    if (!submissionRow) {
      return res.status(500).json({ error: 'submission_initialization_failed' });
    }

    const result = await prepareEsdcParticipantSubmission({ submissionId: submissionRow.id, caseId });
    if (result.blocking) {
      return res.status(409).json({
        error: 'blocking_validation_issues',
        readinessStatus: result.evaluation.readinessStatus,
        readinessSummary: result.evaluation.readinessSummary,
        warnings: result.evaluation.warnings,
        blockingIssues: result.evaluation.blockingIssues
      });
    }

    const compliance = {
      ilmp: mapIlmpComplianceFromSubmission(result.submission),
      finance: { status: 'pending', messages: [] }
    };

    const payloadSnapshot = result.payload
      ? {
          schema: result.payload.schema || null,
          generatedAt: result.payload.generatedAt || null,
          storageKey: result.storageKey || result.payload.storageKey || null,
          checksum: result.checksum || result.payload.checksum || null,
          canonical: result.payload.canonical || null,
          xml: result.payload.xml || null
        }
      : null;

    res.json({ compliance, payload: payloadSnapshot });
  } catch (error) {
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message || 'case_ilmp_prepare_failed' });
    }
    console.error('POST /api/cases/:id/prepare-ilmp failed:', error);
    res
      .status(500)
      .json({ error: 'case_ilmp_prepare_failed', detail: error?.message || String(error) });
  }
});

app.get('/api/cases/:id/action-plan/context', async (req, res) => {
  const caseId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    const [[caseRow]] = await connection.query(
      `SELECT
         c.application_id,
         c.assigned_to_user_id,
         c.portfolio_region_id,
         sp.region_id AS owner_region_id
       FROM iset_case c
       LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id
       WHERE c.id = ?
       LIMIT 1`,
      [caseId]
    );

    if (!caseRow) {
      return res.status(404).json({ error: 'case_not_found' });
    }

    const role = inferUserRole(req);
    const identity = getRequesterIdentity(req);
    const allowAll =
      role === 'System Administrator' ||
      role === 'Program Administrator' ||
      role === 'SysAdmin' ||
      role === 'ProgramAdmin';

    if (!allowAll) {
      if (role === 'Regional Coordinator' || role === 'RegionalCoordinator') {
        const regionId = Number.isFinite(identity.regionId) ? Number(identity.regionId) : null;
        if (!Number.isFinite(regionId)) {
          return res.status(403).json({ error: 'forbidden', detail: 'region_scope_missing' });
        }
        const isUnassigned = caseRow.assigned_to_user_id === null || typeof caseRow.assigned_to_user_id === 'undefined';
        const portfolioMatch =
          Number.isFinite(caseRow.portfolio_region_id) && Number(caseRow.portfolio_region_id) === regionId;
        const ownerMatch =
          Number.isFinite(caseRow.owner_region_id) && Number(caseRow.owner_region_id) === regionId;
        if (!isUnassigned && !portfolioMatch && !ownerMatch) {
          return res.status(403).json({ error: 'forbidden', detail: 'region_scope_mismatch' });
        }
      } else if (role === 'Application Assessor' || role === 'Adjudicator') {
        const requesterId = Number.isFinite(identity.userId) ? Number(identity.userId) : null;
        if (!Number.isFinite(requesterId)) {
          return res.status(403).json({ error: 'forbidden', detail: 'assessor_scope_missing' });
        }
        if (Number(caseRow.assigned_to_user_id) !== requesterId) {
          return res.status(403).json({ error: 'forbidden' });
        }
      } else {
        return res.status(403).json({ error: 'forbidden' });
      }
    }

    const [[assessmentRow]] = await connection.query(
      `SELECT
         overview,
         employment_goals,
         previous_iset,
         previous_iset_details,
         employment_barriers,
         local_area_priorities,
         other_funding_details,
         esdc_eligibility,
         intervention_start_date,
         intervention_end_date,
         intervention_code,
         intervention_outcome_code,
         intervention_duration_days,
         intervention_cost_total,
         intervention_related_noc,
         intervention_related_noc_version,
         childcare_need,
         childcare_funding_details,
         institution,
         program_name,
         itp_payload,
         wage_payload,
         recommendation,
         justification
       FROM iset_case_assessment
       WHERE case_id = ?
       LIMIT 1`,
      [caseId]
    );

    let answers = {};
    if (caseRow.application_id) {
      const applicationPayload = await readApplicationPayload(connection, caseRow.application_id, { forUpdate: false });
      answers = applicationPayload?.payload?.answers || {};
    }

    const parseArray = value => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value.map(entry => normaliseString(entry)).filter(Boolean);
      }
      const parsed = safeJsonParse(value, null);
      if (Array.isArray(parsed)) {
        return parsed.map(entry => normaliseString(entry)).filter(Boolean);
      }
      if (typeof value === 'string') {
        try {
          const attempt = JSON.parse(value);
          if (Array.isArray(attempt)) {
            return attempt.map(entry => normaliseString(entry)).filter(Boolean);
          }
        } catch (_) {
          return value
            .split(',')
            .map(entry => normaliseString(entry))
            .filter(Boolean);
        }
      }
      return [];
    };

    const readAnswer = key => {
      if (!answers || typeof answers !== 'object') return null;
      const raw = answers[key];
      if (raw === null || typeof raw === 'undefined') return null;
      if (Array.isArray(raw)) {
        return raw.map(entry => normaliseString(entry)).filter(Boolean);
      }
      if (typeof raw === 'object') return raw;
      return normaliseString(raw);
    };

    const readFirstAnswer = (...keys) => {
      for (const key of keys) {
        if (!key) continue;
        const value = readAnswer(key);
        if (value !== null && typeof value !== 'undefined') {
          return value;
        }
      }
      return null;
    };

    const employmentBarriers =
      parseArray(assessmentRow?.employment_barriers) || parseArray(readAnswer('barriers'));
    const localAreaPriorities =
      parseArray(assessmentRow?.local_area_priorities) || parseArray(readAnswer('local-area-priorities'));

    const normaliseYesNo = value => {
      if (value === null || typeof value === 'undefined') return null;
      const trimmed = String(value).trim().toLowerCase();
      if (['1', 'yes', 'true'].includes(trimmed)) return 'yes';
      if (['0', 'no', 'false'].includes(trimmed)) return 'no';
      return null;
    };

    const previousIsetNormalised = normaliseYesNo(assessmentRow?.previous_iset);
    const previousIsetBoolean = previousIsetNormalised === null ? null : previousIsetNormalised === 'yes';
    const childcareNeedNormalised = normaliseYesNo(assessmentRow?.childcare_need);

    const interventionCodeValue =
      assessmentRow && assessmentRow.intervention_code !== null && typeof assessmentRow.intervention_code !== 'undefined'
        ? String(assessmentRow.intervention_code)
        : null;
    const interventionOutcomeValue =
      assessmentRow && assessmentRow.intervention_outcome_code !== null && typeof assessmentRow.intervention_outcome_code !== 'undefined'
        ? String(assessmentRow.intervention_outcome_code)
        : null;
    const interventionDurationValue =
      assessmentRow && assessmentRow.intervention_duration_days !== null && typeof assessmentRow.intervention_duration_days !== 'undefined'
        ? String(assessmentRow.intervention_duration_days)
        : null;
    const interventionCostValue =
      assessmentRow && assessmentRow.intervention_cost_total !== null && typeof assessmentRow.intervention_cost_total !== 'undefined'
        ? String(assessmentRow.intervention_cost_total)
        : null;
    const interventionNocValue = assessmentRow?.intervention_related_noc
      ? String(assessmentRow.intervention_related_noc).trim()
      : null;
    const interventionNocVersionValue = assessmentRow?.intervention_related_noc_version
      ? String(assessmentRow.intervention_related_noc_version).trim()
      : null;
    const assessmentItp = safeJsonParse(assessmentRow?.itp_payload, assessmentRow?.itp_payload ?? null);
    const assessmentWage = safeJsonParse(assessmentRow?.wage_payload, assessmentRow?.wage_payload ?? null);

    const context = {
      eligibility: normaliseString(assessmentRow?.esdc_eligibility) || null,
      employmentGoals:
        assessmentRow?.employment_goals ||
        normaliseString(readFirstAnswer('long-term-goal', 'short-term-goal', 'employment-goals')) ||
        null,
      previousIset: previousIsetBoolean,
      previousIsetDetails: assessmentRow?.previous_iset_details || null,
      employmentBarriers,
      localAreaPriorities,
      otherFunding: assessmentRow?.other_funding_details || null,
      labourForceStatus: readFirstAnswer('labour-force-status', 'employment-status') || null,
      employmentNoc: readFirstAnswer('action-plan-result-related-noc', 'current-noc') || null,
      employmentNocVersion:
        readFirstAnswer('action-plan-result-related-noc-version', 'current-noc-version') || null,
      educationLevel:
        readFirstAnswer(
          'action-plan-result-education-level',
          'example-radio-2',
          'education-level',
          'education-highest-level'
        ) ||
        null,
      childcareNeed:
        childcareNeedNormalised ||
        readFirstAnswer('action-plan-childcare-need', 'childcare-need', 'childcare-required') ||
        null,
      childcareFunding:
        assessmentRow?.childcare_funding_details ||
        readFirstAnswer(
          'action-plan-childcare-funded-code',
          'childcare-funding',
          'childcare-funded',
          'childcare-supported'
        ) ||
        null,
      socialAssistance: readFirstAnswer('social-assistance', 'receives-social-assistance') || null,
      employmentInsurance:
        readFirstAnswer(
          'employment-insurance-status',
          'employment-insurance',
          'ei-status',
          'ei-benefits'
        ) || null,
      barriersFromApplication: Array.isArray(readAnswer('barriers'))
        ? readAnswer('barriers')
        : parseArray(readAnswer('barriers')),
      longTermGoal: normaliseString(readFirstAnswer('long-term-goal')) || null,
      shortTermGoal: normaliseString(readFirstAnswer('short-term-goal')) || null,
      targetProgram: normaliseString(readFirstAnswer('target-program')) || null,
    };

    const assessmentPayload = {
      case_summary: assessmentRow?.overview || null,
      assessment_employment_goals: assessmentRow?.employment_goals || null,
      assessment_previous_iset: normaliseYesNo(assessmentRow?.previous_iset),
      assessment_previous_iset_details: assessmentRow?.previous_iset_details || null,
      assessment_employment_barriers: employmentBarriers,
      assessment_local_area_priorities: localAreaPriorities,
      assessment_other_funding_details: assessmentRow?.other_funding_details || null,
      assessment_esdc_eligibility: normaliseString(assessmentRow?.esdc_eligibility) || null,
      assessment_intervention_start_date: assessmentRow?.intervention_start_date ? toDateOnlyString(assessmentRow.intervention_start_date) : null,
      assessment_intervention_end_date: assessmentRow?.intervention_end_date ? toDateOnlyString(assessmentRow.intervention_end_date) : null,
      assessment_intervention_code: assessmentRow && assessmentRow.intervention_code !== null && typeof assessmentRow.intervention_code !== "undefined" ? String(assessmentRow.intervention_code) : null,
      assessment_intervention_outcome_code: assessmentRow && assessmentRow.intervention_outcome_code !== null && typeof assessmentRow.intervention_outcome_code !== "undefined" ? String(assessmentRow.intervention_outcome_code) : null,
      assessment_intervention_duration_days: assessmentRow && assessmentRow.intervention_duration_days !== null && typeof assessmentRow.intervention_duration_days !== "undefined" ? String(assessmentRow.intervention_duration_days) : null,
      assessment_intervention_cost_total: assessmentRow && assessmentRow.intervention_cost_total !== null && typeof assessmentRow.intervention_cost_total !== "undefined" ? String(assessmentRow.intervention_cost_total) : null,
      assessment_intervention_related_noc: assessmentRow?.intervention_related_noc ? String(assessmentRow.intervention_related_noc).trim() : null,
      assessment_intervention_related_noc_version: assessmentRow?.intervention_related_noc_version ? String(assessmentRow.intervention_related_noc_version).trim() : null,
      assessment_childcare_need: normaliseYesNo(assessmentRow?.childcare_need),
      assessment_childcare_funding_details: assessmentRow?.childcare_funding_details || null,
      assessment_institution: assessmentRow?.institution || null,
      assessment_program_name: assessmentRow?.program_name || null,
      assessment_itp: safeJsonParse(assessmentRow?.itp_payload, assessmentRow?.itp_payload ?? null),
      assessment_wage: safeJsonParse(assessmentRow?.wage_payload, assessmentRow?.wage_payload ?? null),
      assessment_recommendation: assessmentRow?.recommendation || null,
      assessment_justification: assessmentRow?.justification || null,
    };

    res.json({ context, ...assessmentPayload });
  } catch (error) {
    console.error('GET /api/cases/:id/action-plan/context failed:', error);
    res.status(500).json({ error: 'action_plan_context_failed', detail: error?.message || String(error) });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/reference/intervention-codes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT code, label, schema_version
         FROM esdc_intervention_code
        WHERE is_active = 1
        ORDER BY display_order ASC, code ASC`
    );
    const codes = rows.map(row => ({
      code: String(row.code),
      label: row.label,
      schemaVersion: row.schema_version || null,
    }));
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ codes });
  } catch (error) {
    console.error('GET /api/reference/intervention-codes failed:', error);
    res.status(500).json({ error: 'intervention_codes_fetch_failed', detail: error?.message || String(error) });
  }
});

app.get('/api/reference/intervention-outcomes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT code, label, schema_version
         FROM esdc_intervention_outcome
        WHERE is_active = 1
        ORDER BY display_order ASC, code ASC`
    );
    const outcomes = rows.map(row => ({
      code: String(row.code),
      label: row.label,
      schemaVersion: row.schema_version || null,
    }));
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ outcomes });
  } catch (error) {
    console.error('GET /api/reference/intervention-outcomes failed:', error);
    res.status(500).json({ error: 'intervention_outcomes_fetch_failed', detail: error?.message || String(error) });
  }
});

app.get('/api/reference/funding-streams', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT code, label, description
         FROM funding_stream
        WHERE is_active = 1
        ORDER BY display_order ASC, label ASC`
    );
    const streams = rows.map(row => ({
      code: row.code,
      label: row.label,
      description: row.description || null,
    }));
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ streams });
  } catch (error) {
    console.error('GET /api/reference/funding-streams failed:', error);
    res.status(500).json({ error: 'funding_streams_fetch_failed', detail: error?.message || String(error) });
  }
});

app.get('/api/reference/noc-versions', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT code, label, description
         FROM noc_version
        WHERE is_active = 1
        ORDER BY display_order ASC, code ASC`
    );
    const versions = rows.map(row => ({
      code: row.code,
      label: row.label,
      description: row.description || null,
    }));
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ versions });
  } catch (error) {
    console.error('GET /api/reference/noc-versions failed:', error);
    res.status(500).json({ error: 'noc_versions_fetch_failed', detail: error?.message || String(error) });
  }
});

app.get('/api/reference/noc-codes', async (req, res) => {
  const { version, q, limit } = req.query || {};
  const versionCode = typeof version === 'string' ? version.trim() : null;
  const searchTerm = typeof q === 'string' ? q.trim() : '';
  const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);

  try {
    const clauses = ['is_active = 1'];
    const params = [];

    if (versionCode) {
      clauses.push('version_code = ?');
      params.push(versionCode);
    }

    if (searchTerm) {
      const normalised = normaliseString(searchTerm);
      const lowered = normalised ? normalised.toLowerCase() : '';
      clauses.push('(code LIKE ? OR search_title LIKE ?)');
      params.push(`${normalised}%`, `%${lowered}%`);
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `
      SELECT code, version_code, title
        FROM noc_code
        ${whereClause}
        ORDER BY display_order ASC, code ASC
        LIMIT ?
    `;
    params.push(cappedLimit);

    const [rows] = await pool.query(sql, params);
    const codes = rows.map(row => ({
      code: row.code,
      version: row.version_code,
      title: row.title,
    }));
    res.set('Cache-Control', 'public, max-age=600');
    res.json({ codes });
  } catch (error) {
    console.error('GET /api/reference/noc-codes failed:', error);
    res.status(500).json({ error: 'noc_codes_fetch_failed', detail: error?.message || String(error) });
  }
});

app.post('/api/cases/:id/action-plans', async (req, res) => {
  const caseId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }

  const {
    name,
    summary = null,
    startDate = null,
    reviewDate = null,
    ownerStaffProfileId = null,
  } = req.body || {};

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    return res.status(422).json({ error: 'name_required', message: 'Action plan name is required.' });
  }
  if (!startDate) {
    return res.status(422).json({ error: 'start_date_required', message: 'Action plan start date is required.' });
  }

  const role = inferUserRole(req);
  const identity = getRequesterIdentity(req);

  const [[caseRow]] = await pool.query(
    `SELECT
       c.application_id,
       c.assigned_to_user_id,
       c.portfolio_region_id,
       sp.region_id AS owner_region_id
     FROM iset_case c
     LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id
     WHERE c.id = ?
     LIMIT 1`,
    [caseId]
  );

  if (!caseRow) {
    return res.status(404).json({ error: 'case_not_found' });
  }

  const allowAll =
    role === 'System Administrator' ||
    role === 'Program Administrator' ||
    role === 'SysAdmin' ||
    role === 'ProgramAdmin';

  if (!allowAll) {
    if (role === 'Regional Coordinator' || role === 'RegionalCoordinator') {
      const regionId = Number.isFinite(identity.regionId) ? Number(identity.regionId) : null;
      if (!Number.isFinite(regionId)) {
        return res.status(403).json({ error: 'forbidden', detail: 'region_scope_missing' });
      }
      const isUnassigned = caseRow.assigned_to_user_id === null || typeof caseRow.assigned_to_user_id === 'undefined';
      const portfolioMatch =
        Number.isFinite(caseRow.portfolio_region_id) && Number(caseRow.portfolio_region_id) === regionId;
      const ownerMatch =
        Number.isFinite(caseRow.owner_region_id) && Number(caseRow.owner_region_id) === regionId;
      if (!isUnassigned && !portfolioMatch && !ownerMatch) {
        return res.status(403).json({ error: 'forbidden', detail: 'region_scope_mismatch' });
      }
    } else if (role === 'Application Assessor' || role === 'Adjudicator') {
      const requesterId = Number.isFinite(identity.userId) ? Number(identity.userId) : null;
      if (!Number.isFinite(requesterId)) {
        return res.status(403).json({ error: 'forbidden', detail: 'assessor_scope_missing' });
      }
      if (Number(caseRow.assigned_to_user_id) !== requesterId) {
        return res.status(403).json({ error: 'forbidden' });
      }
    } else {
      return res.status(403).json({ error: 'forbidden' });
    }
  }

  let resolvedOwnerStaffProfileId = null;
  if (ownerStaffProfileId !== null && typeof ownerStaffProfileId !== 'undefined') {
    const ownerProfile = await resolveStaffProfileIdentifier(ownerStaffProfileId);
    if (!ownerProfile) {
      return res.status(404).json({ error: 'owner_not_found' });
    }
    resolvedOwnerStaffProfileId = Number(ownerProfile.id);
  }

  if (resolvedOwnerStaffProfileId === null && Number.isFinite(identity.userId)) {
    resolvedOwnerStaffProfileId = Number(identity.userId);
  }
  if (resolvedOwnerStaffProfileId === null && Number.isFinite(caseRow.assigned_to_user_id)) {
    resolvedOwnerStaffProfileId = Number(caseRow.assigned_to_user_id);
  }

  const planStatus = 'draft';
  const metadata = summary ? { summary } : null;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO iset_case_action_plan
         (case_id, name, status, owner_staff_profile_id, owner_user_id, effective_date, review_date, notes, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        trimmedName || null,
        planStatus,
        resolvedOwnerStaffProfileId || null,
        null,
        startDate || null,
        reviewDate || null,
        summary || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    await connection.commit();
    await recomputeCaseStatus(caseId, connection);

    const planRow = await fetchActionPlanWithCase(result.insertId);
    const payload =
      planRow ? mapActionPlanRow(planRow) : {
        id: result.insertId,
        caseId,
        name: trimmedName || null,
        status: planStatus,
        effectiveDate: toIsoDateTime(startDate),
        reviewDate: toIsoDateTime(reviewDate),
        ownerStaffProfileId: resolvedOwnerStaffProfileId || null,
        ownerUserId: null,
        summary: summary || null,
        interventionCount: 0,
      };

    res.status(201).json(payload);
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    console.error('POST /api/cases/:id/action-plans failed:', error);
    res.status(500).json({ error: 'create_action_plan_failed', detail: error?.message || String(error) });
  } finally {
    if (connection) connection.release();
  }
});

app.get('/api/action-plans/:id/interventions', async (req, res) => {
  const planId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ error: 'invalid_action_plan_id' });
  }

  try {
    const planRow = await fetchActionPlanWithCase(planId);
    if (!planRow) {
      return res.status(404).json({ error: 'action_plan_not_found' });
    }

    const accessError = validateCaseAccessForPlan(req, planRow);
    if (accessError) {
      return res.status(accessError.status).json(accessError.body);
    }

    const [rows] = await pool.query(
      `SELECT
         ci.*
       FROM iset_case_intervention ci
       WHERE ci.action_plan_id = ?
       ORDER BY ci.start_date IS NULL, ci.start_date ASC, ci.id ASC`,
      [planId]
    );
    const interventions = rows.map(mapInterventionRow).filter(Boolean);
    res.status(200).json({ actionPlanId: planId, interventions });
  } catch (error) {
    console.error('GET /api/action-plans/:id/interventions failed:', error);
    res.status(500).json({ error: 'fetch_interventions_failed', detail: error?.message || String(error) });
  }
});

app.post('/api/action-plans/:id/interventions', async (req, res) => {
  const planId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ error: 'invalid_action_plan_id' });
  }

  const {
    code,
    title,
    status,
    startDate = null,
    endDate = null,
    durationWeeks = null,
    outcome = null,
    cost = null,
    potId = null,
    fundingStream = null,
    notes = null,
    noc = null,
    nocVersion = null,
    approvedAmount = null,
    actualAmount = null,
    metadata: metadataPayload = null,
  } = req.body || {};

  const trimmedCode = typeof code === 'string' ? code.trim() : '';
  if (!trimmedCode) {
    return res.status(422).json({ error: 'code_required', message: 'Intervention code is required.' });
  }

  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  if (!trimmedTitle) {
    return res.status(422).json({ error: 'title_required', message: 'Intervention title is required.' });
  }

  const normaliseDate = value => {
    if (!value && value !== 0) return null;
    const str = String(value).trim();
    if (!str) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return 'invalid';
    }
    return str;
  };

  const startDateValue = normaliseDate(startDate);
  if (startDateValue === 'invalid') {
    return res.status(422).json({ error: 'invalid_start_date', message: 'Start date must be in YYYY-MM-DD format.' });
  }
  const endDateValue = normaliseDate(endDate);
  if (endDateValue === 'invalid') {
    return res.status(422).json({ error: 'invalid_end_date', message: 'End date must be in YYYY-MM-DD format.' });
  }

  if (startDateValue && endDateValue && endDateValue < startDateValue) {
    return res.status(422).json({ error: 'end_before_start', message: 'End date cannot be before start date.' });
  }

  const parseNumeric = value => {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : NaN;
  };

  const durationWeeksValue = parseNumeric(durationWeeks);
  if (Number.isNaN(durationWeeksValue)) {
    return res.status(422).json({ error: 'invalid_duration', message: 'Duration (weeks) must be a number.' });
  }
  if (durationWeeksValue !== null && durationWeeksValue < 0) {
    return res.status(422).json({ error: 'invalid_duration', message: 'Duration (weeks) cannot be negative.' });
  }

  const plannedCostValue = parseNumeric(cost);
  if (Number.isNaN(plannedCostValue)) {
    return res.status(422).json({ error: 'invalid_cost', message: 'Cost must be a number.' });
  }

  const approvedAmountValue = parseNumeric(approvedAmount);
  if (Number.isNaN(approvedAmountValue)) {
    return res.status(422).json({ error: 'invalid_approved_amount', message: 'Approved amount must be a number.' });
  }

  const actualAmountValue = parseNumeric(actualAmount);
  if (Number.isNaN(actualAmountValue)) {
    return res.status(422).json({ error: 'invalid_actual_amount', message: 'Actual amount must be a number.' });
  }

  const statusValue = normaliseInterventionStatus(status);

  try {
    const planRow = await fetchActionPlanWithCase(planId);
    if (!planRow) {
      return res.status(404).json({ error: 'action_plan_not_found' });
    }

    const accessError = validateCaseAccessForPlan(req, planRow);
    if (accessError) {
      return res.status(accessError.status).json(accessError.body);
    }

    const planStatus = normaliseInterventionStatus(planRow.status);
    if (planStatus === 'completed' || planStatus === 'cancelled' || planRow.status === 'archived' || planRow.status === 'closed') {
      return res.status(409).json({ error: 'plan_not_editable', message: 'Cannot add interventions to a closed or archived plan.' });
    }

    const identity = getRequesterIdentity(req);
    const createdBy = Number.isFinite(identity.userId) ? Number(identity.userId) : null;

    const trimmedOutcome = typeof outcome === 'string' ? outcome.trim() : '';
    const trimmedPotId = typeof potId === 'string' ? potId.trim() : '';
    const trimmedFundingStream = typeof fundingStream === 'string' ? fundingStream.trim() : '';
    const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';
    const trimmedNoc = typeof noc === 'string' ? noc.trim() : '';
    const trimmedNocVersion = typeof nocVersion === 'string' ? nocVersion.trim() : '';

    const metadata = {};
    metadata.code = trimmedCode;
    metadata.title = trimmedTitle;
    if (durationWeeksValue !== null) metadata.durationWeeks = durationWeeksValue;
    if (Number.isFinite(plannedCostValue)) metadata.cost = plannedCostValue;
    if (trimmedPotId) metadata.potId = trimmedPotId;
    if (trimmedFundingStream) metadata.fundingStream = trimmedFundingStream;
    if (trimmedNotes) metadata.notes = trimmedNotes;
    if (trimmedOutcome) metadata.outcome = trimmedOutcome;
    if (trimmedNoc) metadata.noc = trimmedNoc;
    if (trimmedNocVersion) metadata.nocVersion = trimmedNocVersion;
    metadata.compliance = { ilmp: 'pending', finance: 'pending' };

    const recurringFallbackTotal = Number.isFinite(plannedCostValue)
      ? plannedCostValue
      : normaliseRecurringNumber(metadata.cost);
    const metadataSource =
      metadataPayload && typeof metadataPayload === 'object' ? metadataPayload : null;
    if (metadataSource) {
      mergeRecurringCostMetadata(metadata, metadataSource, recurringFallbackTotal);
    }

    const [result] = await pool.query(
      `INSERT INTO iset_case_intervention
         (case_id,
          action_plan_id,
          intervention_type,
          status,
          start_date,
          end_date,
          funding_stream,
          budget_amount,
          approved_amount,
          actual_amount,
          outcome_code,
          notes,
          metadata_json,
          created_by_staff_profile_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planRow.case_id,
        planId,
        trimmedCode,
        statusValue,
        startDateValue || null,
        endDateValue || null,
        trimmedFundingStream || null,
        Number.isFinite(plannedCostValue) ? plannedCostValue : null,
        Number.isFinite(approvedAmountValue) ? approvedAmountValue : null,
        Number.isFinite(actualAmountValue) ? actualAmountValue : null,
        trimmedOutcome || null,
        trimmedNotes || null,
        Object.keys(metadata).length ? JSON.stringify(metadata) : null,
        createdBy,
      ]
    );

    await pool.query('UPDATE iset_case_action_plan SET updated_at = NOW() WHERE id = ?', [planId]);

    const interventionId = result.insertId;
    const interventionRow = await fetchInterventionWithCase(interventionId);
    const payload = mapInterventionRow(interventionRow);
    res.status(201).json(payload);
  } catch (error) {
    console.error('POST /api/action-plans/:id/interventions failed:', error);
    res.status(500).json({ error: 'create_intervention_failed', detail: error?.message || String(error) });
  }
});

app.patch('/api/interventions/:id', async (req, res) => {
  const interventionId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(interventionId) || interventionId <= 0) {
    return res.status(400).json({ error: 'invalid_intervention_id' });
  }

  const body = req.body || {};
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'no_updates', message: 'No intervention fields provided for update.' });
  }

  const parseNumeric = value => {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : NaN;
  };
  const normaliseDate = value => {
    if (!Object.prototype.hasOwnProperty.call(body, value)) return undefined;
    const raw = body[value];
    if (raw === null || raw === '') return null;
    const str = String(raw).trim();
    if (!str) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return 'invalid';
    }
    return str;
  };

  const startDateValue = normaliseDate('startDate');
  if (startDateValue === 'invalid') {
    return res.status(422).json({ error: 'invalid_start_date', message: 'Start date must be in YYYY-MM-DD format.' });
  }
  const endDateValue = normaliseDate('endDate');
  if (endDateValue === 'invalid') {
    return res.status(422).json({ error: 'invalid_end_date', message: 'End date must be in YYYY-MM-DD format.' });
  }
  if (
    typeof startDateValue === 'string' &&
    typeof endDateValue === 'string' &&
    startDateValue !== null &&
    endDateValue !== null &&
    endDateValue < startDateValue
  ) {
    return res.status(422).json({ error: 'end_before_start', message: 'End date cannot be before start date.' });
  }

  const durationProvided = Object.prototype.hasOwnProperty.call(body, 'durationWeeks');
  const durationWeeksValue = durationProvided ? parseNumeric(body.durationWeeks) : undefined;
  if (Number.isNaN(durationWeeksValue)) {
    return res.status(422).json({ error: 'invalid_duration', message: 'Duration (weeks) must be a number.' });
  }
  if (durationWeeksValue !== undefined && durationWeeksValue !== null && durationWeeksValue < 0) {
    return res.status(422).json({ error: 'invalid_duration', message: 'Duration (weeks) cannot be negative.' });
  }

  const costProvided = Object.prototype.hasOwnProperty.call(body, 'cost');
  const plannedCostValue = costProvided ? parseNumeric(body.cost) : undefined;
  if (Number.isNaN(plannedCostValue)) {
    return res.status(422).json({ error: 'invalid_cost', message: 'Cost must be a number.' });
  }

  const approvedProvided = Object.prototype.hasOwnProperty.call(body, 'approvedAmount');
  const approvedAmountValue = approvedProvided ? parseNumeric(body.approvedAmount) : undefined;
  if (Number.isNaN(approvedAmountValue)) {
    return res.status(422).json({ error: 'invalid_approved_amount', message: 'Approved amount must be a number.' });
  }

  const actualProvided = Object.prototype.hasOwnProperty.call(body, 'actualAmount');
  const actualAmountValue = actualProvided ? parseNumeric(body.actualAmount) : undefined;
  if (Number.isNaN(actualAmountValue)) {
    return res.status(422).json({ error: 'invalid_actual_amount', message: 'Actual amount must be a number.' });
  }

  const statusProvided = Object.prototype.hasOwnProperty.call(body, 'status');
  const statusValue = statusProvided ? normaliseInterventionStatus(body.status) : undefined;
  if (statusValue === 'completed' || statusValue === 'cancelled') {
    return res.status(422).json({
      error: 'use_close_endpoint',
      message: 'Use POST /api/interventions/:id/close to complete or cancel an intervention.',
    });
  }

  try {
    const interventionRow = await fetchInterventionWithCase(interventionId);
    if (!interventionRow) {
      return res.status(404).json({ error: 'intervention_not_found' });
    }

    const planId = interventionRow.action_plan_id;
    let planRow = null;
    if (Number.isInteger(planId)) {
      planRow = await fetchActionPlanWithCase(planId);
      if (!planRow) {
        return res.status(404).json({ error: 'action_plan_not_found' });
      }
      const accessError = validateCaseAccessForPlan(req, planRow);
      if (accessError) {
        return res.status(accessError.status).json(accessError.body);
      }
      if (['closed', 'archived'].includes((planRow.status || '').toLowerCase())) {
        return res.status(409).json({ error: 'plan_not_editable', message: 'Cannot modify interventions on a closed or archived plan.' });
      }
    } else {
      const caseRow = await fetchCaseRow(interventionRow.case_id);
      if (!caseRow) {
        return res.status(404).json({ error: 'case_not_found' });
      }
      const role = inferUserRole(req);
      const identity = getRequesterIdentity(req);
      const allowAll =
        role === 'System Administrator' ||
        role === 'Program Administrator' ||
        role === 'SysAdmin' ||
        role === 'ProgramAdmin';
      if (!allowAll) {
        if (role === 'Regional Coordinator' || role === 'RegionalCoordinator') {
          const regionId = Number.isFinite(identity.regionId) ? Number(identity.regionId) : null;
          if (!Number.isFinite(regionId) || Number(caseRow.assigned_to_user_id) !== regionId) {
            return res.status(403).json({ error: 'forbidden' });
          }
        } else if (role === 'Application Assessor' || role === 'Adjudicator') {
          const requesterId = Number.isFinite(identity.userId) ? Number(identity.userId) : null;
          if (!Number.isFinite(requesterId) || Number(caseRow.assigned_to_user_id) !== requesterId) {
            return res.status(403).json({ error: 'forbidden' });
          }
        } else {
          return res.status(403).json({ error: 'forbidden' });
        }
      }
    }

    const updates = [];
    const params = [];
    let metadataChanged = false;
    const metadata = safeJsonParse(interventionRow.metadata_json, null) || {};
    const metadataPayload =
      body.metadata && typeof body.metadata === 'object' ? body.metadata : null;

    if (Object.prototype.hasOwnProperty.call(body, 'code')) {
      const trimmedCode = typeof body.code === 'string' ? body.code.trim() : '';
      if (!trimmedCode) {
        return res.status(422).json({ error: 'code_required', message: 'Intervention code is required.' });
      }
      updates.push('intervention_type = ?');
      params.push(trimmedCode);
      metadata.code = trimmedCode;
      metadataChanged = true;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const trimmedTitle = typeof body.title === 'string' ? body.title.trim() : '';
      if (!trimmedTitle) {
        return res.status(422).json({ error: 'title_required', message: 'Intervention title is required.' });
      }
      metadata.title = trimmedTitle;
      metadataChanged = true;
    }

    if (statusProvided) {
      updates.push('status = ?');
      params.push(statusValue);
    }

    if (typeof startDateValue !== 'undefined') {
      updates.push('start_date = ?');
      params.push(startDateValue || null);
    }
    if (typeof endDateValue !== 'undefined') {
      updates.push('end_date = ?');
      params.push(endDateValue || null);
    }

    if (durationProvided) {
      if (durationWeeksValue === null) {
        delete metadata.durationWeeks;
      } else {
        metadata.durationWeeks = durationWeeksValue;
      }
      metadataChanged = true;
    }

    if (costProvided) {
      updates.push('budget_amount = ?');
      params.push(plannedCostValue === null ? null : plannedCostValue);
      if (plannedCostValue === null) {
        delete metadata.cost;
      } else {
        metadata.cost = plannedCostValue;
      }
      metadataChanged = true;
    }

    if (approvedProvided) {
      updates.push('approved_amount = ?');
      params.push(approvedAmountValue === null ? null : approvedAmountValue);
    }

    if (actualProvided) {
      updates.push('actual_amount = ?');
      params.push(actualAmountValue === null ? null : actualAmountValue);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'outcome')) {
      const trimmedOutcome = typeof body.outcome === 'string' ? body.outcome.trim() : '';
      updates.push('outcome_code = ?');
      params.push(trimmedOutcome || null);
      if (trimmedOutcome) {
        metadata.outcome = trimmedOutcome;
      } else {
        delete metadata.outcome;
      }
      metadataChanged = true;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'potId')) {
      const trimmedPotId = typeof body.potId === 'string' ? body.potId.trim() : '';
      if (trimmedPotId) {
        metadata.potId = trimmedPotId;
      } else {
        delete metadata.potId;
      }
      metadataChanged = true;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'fundingStream')) {
      const trimmedFundingStream = typeof body.fundingStream === 'string' ? body.fundingStream.trim() : '';
      updates.push('funding_stream = ?');
      params.push(trimmedFundingStream || null);
      if (trimmedFundingStream) {
        metadata.fundingStream = trimmedFundingStream;
      } else {
        delete metadata.fundingStream;
      }
      metadataChanged = true;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
      const trimmedNotes = typeof body.notes === 'string' ? body.notes.trim() : '';
      updates.push('notes = ?');
      params.push(trimmedNotes || null);
      if (trimmedNotes) {
        metadata.notes = trimmedNotes;
      } else {
        delete metadata.notes;
      }
      metadataChanged = true;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'noc')) {
      const trimmedNoc = typeof body.noc === 'string' ? body.noc.trim() : '';
      if (trimmedNoc) {
        metadata.noc = trimmedNoc;
      } else {
        delete metadata.noc;
      }
      metadataChanged = true;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'nocVersion')) {
      const trimmedNocVersion = typeof body.nocVersion === 'string' ? body.nocVersion.trim() : '';
      if (trimmedNocVersion) {
        metadata.nocVersion = trimmedNocVersion;
      } else {
        delete metadata.nocVersion;
      }
      metadataChanged = true;
    }

    const recurringPayload = (() => {
      if (metadataPayload) {
        return metadataPayload;
      }
      let hasFields = false;
      const payload = {};
      if (Object.prototype.hasOwnProperty.call(body, 'costSettings')) {
        payload.costSettings = body.costSettings;
        hasFields = true;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'costType')) {
        payload.costType = body.costType;
        hasFields = true;
      }
      if (Object.prototype.hasOwnProperty.call(body, 'recurrence')) {
        payload.recurrence = body.recurrence;
        hasFields = true;
      }
      return hasFields ? payload : null;
    })();
    if (recurringPayload) {
      const fallbackTotal = Number.isFinite(plannedCostValue)
        ? plannedCostValue
        : normaliseRecurringNumber(metadata.cost);
      if (mergeRecurringCostMetadata(metadata, recurringPayload, fallbackTotal)) {
        metadataChanged = true;
      }
    }

    if (!updates.length && !metadataChanged) {
      return res.status(400).json({ error: 'no_updates', message: 'No intervention fields provided for update.' });
    }

    const metadataCopy = { ...metadata };
    Object.keys(metadataCopy).forEach(key => {
      if (metadataCopy[key] === undefined) {
        delete metadataCopy[key];
      }
      if (metadataCopy[key] === null && key !== 'compliance') {
        delete metadataCopy[key];
      }
    });
    if (metadataCopy.compliance && typeof metadataCopy.compliance !== 'object') {
      delete metadataCopy.compliance;
    }

    if (metadataChanged) {
      updates.push('metadata_json = ?');
      params.push(Object.keys(metadataCopy).length ? JSON.stringify(metadataCopy) : null);
    }

    updates.push('updated_at = NOW()');

    params.push(interventionId);
    const sql = `UPDATE iset_case_intervention SET ${updates.join(', ')} WHERE id = ?`;
    await pool.query(sql, params);

    if (planId) {
      await pool.query('UPDATE iset_case_action_plan SET updated_at = NOW() WHERE id = ?', [planId]);
    }

    const updatedRow = await fetchInterventionWithCase(interventionId);
    const payload = mapInterventionRow(updatedRow);
    res.status(200).json(payload);
  } catch (error) {
    console.error('PATCH /api/interventions/:id failed:', error);
    res.status(500).json({ error: 'update_intervention_failed', detail: error?.message || String(error) });
  }
});

app.post('/api/interventions/:id/close', async (req, res) => {
  const interventionId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(interventionId) || interventionId <= 0) {
    return res.status(400).json({ error: 'invalid_intervention_id' });
  }

  const {
    outcome,
    status = 'completed',
    actualAmount = null,
    completionDate = null,
    notes = null,
  } = req.body || {};

  const statusValue = normaliseInterventionStatus(status);
  if (!['completed', 'cancelled'].includes(statusValue)) {
    return res.status(422).json({ error: 'invalid_status', message: 'Status must be completed or cancelled.' });
  }

  const trimmedOutcome = typeof outcome === 'string' ? outcome.trim() : '';
  if (!trimmedOutcome) {
    return res.status(422).json({ error: 'outcome_required', message: 'Outcome code is required to close an intervention.' });
  }

  const parseNumeric = value => {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : NaN;
  };
  const actualAmountValue = parseNumeric(actualAmount);
  if (Number.isNaN(actualAmountValue)) {
    return res.status(422).json({ error: 'invalid_actual_amount', message: 'Actual amount must be a number.' });
  }

  const normaliseDate = raw => {
    if (!raw && raw !== 0) return null;
    const str = String(raw).trim();
    if (!str) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return 'invalid';
    }
    return str;
  };
  const completionDateValue = normaliseDate(completionDate);
  if (completionDateValue === 'invalid') {
    return res.status(422).json({ error: 'invalid_completion_date', message: 'Completion date must be in YYYY-MM-DD format.' });
  }

  try {
    const interventionRow = await fetchInterventionWithCase(interventionId);
    if (!interventionRow) {
      return res.status(404).json({ error: 'intervention_not_found' });
    }

    const planId = interventionRow.action_plan_id;
    if (!planId) {
      return res.status(409).json({ error: 'intervention_unlinked', message: 'Cannot close an intervention that is not linked to an action plan.' });
    }

    const planRow = await fetchActionPlanWithCase(planId);
    if (!planRow) {
      return res.status(404).json({ error: 'action_plan_not_found' });
    }

    const accessError = validateCaseAccessForPlan(req, planRow);
    if (accessError) {
      return res.status(accessError.status).json(accessError.body);
    }

    const currentStatus = normaliseInterventionStatus(interventionRow.status);
    if (['completed', 'cancelled'].includes(currentStatus)) {
      return res.status(200).json(mapInterventionRow(interventionRow));
    }

    const metadata = safeJsonParse(interventionRow.metadata_json, null) || {};
    if (!metadata.compliance || typeof metadata.compliance !== 'object') {
      metadata.compliance = { ilmp: 'pending', finance: 'pending' };
    }
    metadata.outcome = trimmedOutcome;
    if (Number.isFinite(actualAmountValue)) {
      metadata.actualAmount = actualAmountValue;
      metadata.compliance.finance = 'ok';
    } else {
      delete metadata.actualAmount;
      metadata.compliance.finance = metadata.compliance.finance || 'pending';
    }
    metadata.compliance.ilmp = 'ok';

    const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';
    const updates = [
      'status = ?',
      'outcome_code = ?',
      'actual_amount = ?',
      'closed_at = NOW()',
      'metadata_json = ?',
    ];
    const params = [
      statusValue,
      trimmedOutcome,
      Number.isFinite(actualAmountValue) ? actualAmountValue : null,
    ];

    Object.keys(metadata).forEach(key => {
      if (metadata[key] === undefined) {
        delete metadata[key];
      }
    });

    params.push(JSON.stringify(metadata));

    if (completionDateValue !== null) {
      updates.push('end_date = ?');
      params.push(completionDateValue || null);
    }
    if (completionDateValue === null) {
      // keep alignment with params
    }

    if (trimmedNotes) {
      updates.push('notes = ?');
      params.push(trimmedNotes);
      metadata.notes = trimmedNotes;
    } else if (notes !== undefined) {
      updates.push('notes = NULL');
      delete metadata.notes;
    }

    updates.push('updated_at = NOW()');

    params.push(interventionId);
    const sql = `UPDATE iset_case_intervention SET ${updates.join(', ')} WHERE id = ?`;
    await pool.query(sql, params);
    await pool.query('UPDATE iset_case_action_plan SET updated_at = NOW() WHERE id = ?', [planId]);

    const updatedRow = await fetchInterventionWithCase(interventionId);
    const payload = mapInterventionRow(updatedRow);
    res.status(200).json(payload);
  } catch (error) {
    console.error('POST /api/interventions/:id/close failed:', error);
    res.status(500).json({ error: 'close_intervention_failed', detail: error?.message || String(error) });
  }
});

app.post('/api/action-plans/:id/activate', async (req, res) => {
  const planId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ error: 'invalid_action_plan_id' });
  }

  try {
    const planRow = await fetchActionPlanWithCase(planId);
    if (!planRow) {
      return res.status(404).json({ error: 'action_plan_not_found' });
    }

    const accessError = validateCaseAccessForPlan(req, planRow);
    if (accessError) {
      return res.status(accessError.status).json(accessError.body);
    }

    if (planRow.status === 'active') {
      return res.status(200).json(mapActionPlanRow(planRow));
    }
    if (planRow.status !== 'draft') {
      return res.status(409).json({ error: 'invalid_status', detail: 'action_plan_not_draft' });
    }

    const [[existingActive]] = await pool.query(
      `SELECT id
         FROM iset_case_action_plan
        WHERE case_id = ?
          AND id <> ?
          AND status = 'active'
          AND archived_at IS NULL
        LIMIT 1`,
      [planRow.case_id, planId]
    );
    if (existingActive) {
      return res.status(409).json({ error: 'active_plan_exists', detail: 'case_already_has_active_plan' });
    }

    try {
      await pool.query(
        `UPDATE iset_case_action_plan
           SET status = 'active',
               activated_at = NOW(),
               closed_at = NULL,
               archived_at = NULL,
               result_code = NULL,
               result_date = NULL,
               outcome_summary = NULL,
               closure_notes = NULL,
               updated_at = NOW()
         WHERE id = ?`,
        [planId]
      );
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'active_plan_exists', detail: 'case_already_has_active_plan' });
      }
      throw error;
    }

    const updatedRow = await fetchActionPlanWithCase(planId);
    await recomputeCaseStatus(planRow.case_id);
    res.status(200).json(mapActionPlanRow(updatedRow));
  } catch (error) {
    console.error('POST /api/action-plans/:id/activate failed:', error);
    res.status(500).json({ error: 'activate_action_plan_failed', detail: error?.message || String(error) });
  }
});

app.post('/api/action-plans/:id/close', async (req, res) => {
  const planId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ error: 'invalid_action_plan_id' });
  }

  const { resultCode, resultDate, outcomeSummary = null, closureNotes = null } = req.body || {};
  const trimmedResultCode = typeof resultCode === 'string' ? resultCode.trim() : '';
  if (!trimmedResultCode) {
    return res.status(422).json({ error: 'result_code_required', message: 'Result code is required to close an action plan.' });
  }
  const resultDateStr = typeof resultDate === 'string' ? resultDate.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resultDateStr)) {
    return res.status(422).json({ error: 'invalid_result_date', message: 'Result date must be in YYYY-MM-DD format.' });
  }

  try {
    const planRow = await fetchActionPlanWithCase(planId);
    if (!planRow) {
      return res.status(404).json({ error: 'action_plan_not_found' });
    }

    const accessError = validateCaseAccessForPlan(req, planRow);
    if (accessError) {
      return res.status(accessError.status).json(accessError.body);
    }

    if (planRow.status === 'closed') {
      return res.status(200).json(mapActionPlanRow(planRow));
    }
    if (planRow.status !== 'active') {
      return res.status(409).json({ error: 'invalid_status', detail: 'action_plan_not_active' });
    }

    const [interventionRows] = await pool.query(
      `SELECT ci.*
         FROM iset_case_intervention ci
        WHERE ci.action_plan_id = ?`,
      [planId]
    );
    const mappedInterventions = interventionRows.map(mapInterventionRow).filter(Boolean);
    const openInterventions = mappedInterventions
      .filter(item => {
        const status = String(item.status || '').toLowerCase();
        return status !== 'completed' && status !== 'cancelled';
      })
      .map(item => ({
        id: item.id,
        code: item.code,
        title: item.title,
        status: item.status,
      }));

    if (openInterventions.length > 0) {
      return res.status(409).json({
        error: 'open_interventions_block_close',
        message: 'Close or cancel the listed interventions before closing this action plan.',
        interventions: openInterventions,
      });
    }

    if (planRow.effective_date && resultDateStr < toDateOnly(planRow.effective_date)) {
      return res.status(422).json({ error: 'result_date_before_start', message: 'Result date cannot be before the plan start date.' });
    }

    const summaryValue =
      typeof outcomeSummary === 'string' ? outcomeSummary.trim() || null : null;
    const closureNotesValue =
      typeof closureNotes === 'string' ? closureNotes.trim() || null : null;

    await pool.query(
      `UPDATE iset_case_action_plan
         SET status = 'closed',
             closed_at = NOW(),
             archived_at = NULL,
             result_code = ?,
             result_date = ?,
             outcome_summary = ?,
             closure_notes = ?,
             updated_at = NOW()
       WHERE id = ?`,
      [trimmedResultCode, resultDateStr, summaryValue, closureNotesValue, planId]
    );

    const updatedRow = await fetchActionPlanWithCase(planId);
    await recomputeCaseStatus(planRow.case_id);
    res.status(200).json(mapActionPlanRow(updatedRow));
  } catch (error) {
    console.error('POST /api/action-plans/:id/close failed:', error);
    res.status(500).json({ error: 'close_action_plan_failed', detail: error?.message || String(error) });
  }
});

app.post('/api/action-plans/:id/archive', async (req, res) => {
  const planId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ error: 'invalid_action_plan_id' });
  }

  const { closureNotes = null } = req.body || {};
  const closureNotesValue =
    typeof closureNotes === 'string' ? closureNotes.trim() || null : null;

  try {
    const planRow = await fetchActionPlanWithCase(planId);
    if (!planRow) {
      return res.status(404).json({ error: 'action_plan_not_found' });
    }

    const accessError = validateCaseAccessForPlan(req, planRow);
    if (accessError) {
      return res.status(accessError.status).json(accessError.body);
    }

    if (planRow.status === 'active') {
      return res.status(409).json({ error: 'invalid_status', detail: 'close_plan_before_archive' });
    }

    if (planRow.status === 'archived') {
      return res.status(200).json(mapActionPlanRow(planRow));
    }

    await pool.query(
      `UPDATE iset_case_action_plan
         SET status = 'archived',
             archived_at = NOW(),
             closure_notes = COALESCE(?, closure_notes),
             updated_at = NOW()
       WHERE id = ?`,
      [closureNotesValue, planId]
    );

    const updatedRow = await fetchActionPlanWithCase(planId);
    await recomputeCaseStatus(planRow.case_id);
    res.status(200).json(mapActionPlanRow(updatedRow));
  } catch (error) {
    console.error('POST /api/action-plans/:id/archive failed:', error);
    res.status(500).json({ error: 'archive_action_plan_failed', detail: error?.message || String(error) });
  }
});

app.patch('/api/action-plans/:id', async (req, res) => {
  const planId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ error: 'invalid_action_plan_id' });
  }

  const { name, startDate = null, reviewDate = null, summary = null } = req.body || {};
  const trimmedName = typeof name === 'string' ? name.trim() : null;
  if (!trimmedName) {
    return res.status(422).json({ error: 'name_required', message: 'Action plan name is required.' });
  }
  if (startDate && reviewDate && reviewDate < startDate) {
    return res.status(422).json({ error: 'invalid_dates', message: 'Review date cannot be before start date.' });
  }

  try {
    const planRow = await fetchActionPlanWithCase(planId);
    if (!planRow) {
      return res.status(404).json({ error: 'action_plan_not_found' });
    }

    const accessError = validateCaseAccessForPlan(req, planRow);
    if (accessError) {
      return res.status(accessError.status).json(accessError.body);
    }

    const status = (planRow.status || '').toLowerCase();
    if (status === 'archived') {
      return res.status(409).json({ error: 'invalid_status', detail: 'archived_plan_read_only' });
    }
    if (status === 'closed') {
      return res.status(409).json({ error: 'invalid_status', detail: 'closed_plan_read_only' });
    }

    const metadata = safeJsonParse(planRow.metadata_json, null) || {};
    if (summary !== null && typeof summary !== 'undefined') {
      metadata.summary = summary || null;
    }

    await pool.query(
      `UPDATE iset_case_action_plan
         SET name = ?,
             effective_date = ?,
             review_date = ?,
             notes = ?,
             metadata_json = ?
       WHERE id = ?`,
      [
        trimmedName,
        startDate || null,
        reviewDate || null,
        summary || null,
        Object.keys(metadata).length ? JSON.stringify(metadata) : null,
        planId,
      ]
    );

    const updatedRow = await fetchActionPlanWithCase(planId);
    res.status(200).json(mapActionPlanRow(updatedRow));
  } catch (error) {
    console.error('PATCH /api/action-plans/:id failed:', error);
    res.status(500).json({ error: 'update_action_plan_failed', detail: error?.message || String(error) });
  }
});

app.get('/api/cases/:id', async (req, res) => {
  const caseId = req.params.id;
  try {
    // Fetch case core details + assessment snapshot
    const baseSql = `
      SELECT
        c.id,
        c.application_id,
        c.assigned_to_user_id,
        sp.email AS assigned_user_email,
        c.status,
        a.status AS application_status,
        c.created_at,
        c.updated_at,
        a.row_version AS application_row_version,
        al.owner_user_id AS lock_owner_id,
        al.owner_display_name AS lock_owner_name,
        al.owner_email AS lock_owner_email,
        al.expires_at AS lock_expires_at,
        COALESCE(s.user_id, JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.user_id'))) AS applicant_user_id,
        COALESCE(s.reference_number, JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number'))) AS tracking_id,
        s.created_at AS submitted_at,
        ca.date_of_assessment AS assessment_date_of_assessment,
        ca.overview AS case_summary,
        ca.employment_goals AS assessment_employment_goals,
        ca.previous_iset AS assessment_previous_iset,
        ca.previous_iset_details AS assessment_previous_iset_details,
        ca.employment_barriers AS assessment_employment_barriers,
        ca.local_area_priorities AS assessment_local_area_priorities,
        ca.other_funding_details AS assessment_other_funding_details,
        ca.esdc_eligibility AS assessment_esdc_eligibility,
        ca.intervention_start_date AS assessment_intervention_start_date,
        ca.intervention_end_date AS assessment_intervention_end_date,
        ca.institution AS assessment_institution,
        ca.program_name AS assessment_program_name,
        ca.itp_payload AS assessment_itp,
        ca.wage_payload AS assessment_wage,
        ca.recommendation AS assessment_recommendation,
        ca.justification AS assessment_justification,
        ca.nwac_review AS assessment_nwac_review,
        ca.nwac_reason AS assessment_nwac_reason,
        ca.intervention_code AS assessment_intervention_code,
        ca.intervention_outcome_code AS assessment_intervention_outcome_code,
        ca.intervention_duration_days AS assessment_intervention_duration_days,
        ca.intervention_cost_total AS assessment_intervention_cost_total,
        ca.intervention_related_noc AS assessment_intervention_related_noc,
        ca.intervention_related_noc_version AS assessment_intervention_related_noc_version,
        ca.childcare_need AS assessment_childcare_need,
        ca.childcare_funding_details AS assessment_childcare_funding_details,
        ca.action_plan_result_code AS assessment_action_plan_result_code,
        ca.action_plan_result_date AS assessment_action_plan_result_date
      FROM iset_case c
      LEFT JOIN iset_application a ON c.application_id = a.id
      LEFT JOIN application_lock al ON al.application_id = c.application_id AND al.expires_at > NOW()
      LEFT JOIN iset_application_submission s ON s.id = a.submission_id
      LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id
      LEFT JOIN iset_case_assessment ca ON ca.case_id = c.id
      WHERE c.id = ?
    `;

    const params = [caseId];

    let rows;
    try {
      [rows] = await pool.query(baseSql + ' LIMIT 1', params);
    } catch (e) {
      const noTable = e && e.code === 'ER_NO_SUCH_TABLE';
      const badField = e && e.code === 'ER_BAD_FIELD_ERROR';
      if (noTable || badField) {
        if (!global.__LOGGED_CASE_DETAIL_FALLBACK) {
          console.warn('[case:detail] falling back (reason=' + e.code + '): building dynamic minimal query');
          global.__LOGGED_CASE_DETAIL_FALLBACK = true;
        }
        // Discover existing columns on iset_case for safe selection
        let existingCols = [];
        try {
          const [colRows] = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name='iset_case'");
          existingCols = colRows.map(r => r.column_name);
        } catch (_) { /* ignore */ }
        const preferred = [
          'id','application_id','assigned_to_user_id','status','priority','opened_at','closed_at','last_activity_at'
        ];
        const picked = preferred.filter(c => existingCols.includes(c));
        if (picked.length === 0) picked.push('id','application_id','status');
        const caseSelectParts = picked.map(c => `c.${c}`);
        // Discover application + submission columns to safely build applicant join
        let appCols = []; let subCols = []; let hasApp = true; let hasSubmission = true;
        let staffCols = []; let hasStaffProfiles = true;
        try {
          const [ac] = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name='iset_application'");
          appCols = ac.map(r=>r.column_name);
        } catch(_) { hasApp = false; }
        if (appCols.includes('submission_id')) {
          try {
            const [sc] = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name='iset_application_submission'");
            subCols = sc.map(r=>r.column_name);
          } catch(_) { hasSubmission = false; }
        }
        try {
          const [sp] = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name='staff_profiles'");
          staffCols = sp.map(r => r.column_name);
        } catch(_) { hasStaffProfiles = false; }
        const hasAppUserId = appCols.includes('user_id');
        const hasSubmissionUser = appCols.includes('submission_id') && subCols.includes('user_id');
        const hasStaffEmail = hasStaffProfiles && staffCols.includes('email');
        let applicantJoin = ''; let applicantSelect = 'NULL AS applicant_name, NULL AS applicant_email, NULL AS applicant_user_id';
        if (hasSubmissionUser) {
          applicantJoin = 'JOIN iset_application_submission s ON a.submission_id = s.id JOIN user applicant ON s.user_id = applicant.id';
          applicantSelect = 'applicant.name AS applicant_name, applicant.email AS applicant_email, applicant.id AS applicant_user_id';
        } else if (hasAppUserId) {
          applicantJoin = 'JOIN user applicant ON a.user_id = applicant.id';
          applicantSelect = 'applicant.name AS applicant_name, applicant.email AS applicant_email, applicant.id AS applicant_user_id';
        }
        // Only include submission join if application table exists and has submission_id
        const submissionJoin = (hasApp && appCols.includes('submission_id'))
          ? 'LEFT JOIN iset_application_submission s ON a.submission_id = s.id'
          : '';
        // Build applicant select, coalescing to submission user id if available
        const coalesceSelect = applicantSelect.includes('applicant_user_id')
          ? applicantSelect.replace('applicant.id AS applicant_user_id','COALESCE(applicant.id, s.user_id) AS applicant_user_id')
          : (hasSubmissionUser ? applicantSelect + ', s.user_id AS applicant_user_id' : applicantSelect + ', NULL AS applicant_user_id');

        // Tracking fields only when application table exists
        const trackingSelect = hasApp
          ? "JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS tracking_id, a.created_at AS submitted_at"
          : "NULL AS tracking_id, NULL AS submitted_at";

        const fromClause = hasApp
          ? 'FROM iset_case c JOIN iset_application a ON c.application_id = a.id'
          : 'FROM iset_case c';

        const staffJoin = (hasStaffEmail && existingCols.includes('assigned_to_user_id'))
          ? 'LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id'
          : '';

        caseSelectParts.push(staffJoin ? 'sp.email AS assigned_user_email' : 'NULL AS assigned_user_email');
        caseSelectParts.push(hasApp && appCols.includes('status') ? 'a.status AS application_status' : 'NULL AS application_status');
        const caseSelect = caseSelectParts.join(', ');

        const fallbackSql = `SELECT ${caseSelect}, ${trackingSelect}, ${coalesceSelect} ${fromClause} ${submissionJoin} ${applicantJoin} ${staffJoin} WHERE c.id = ? LIMIT 1`;
        [rows] = await pool.query(fallbackSql, [caseId]);
      } else {
        throw e;
      }
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const row = rows[0];
    if (!row.applicant_user_id && row.application_id) {
      try {
        const [[r2]] = await pool.query(`SELECT s.user_id FROM iset_application a JOIN iset_application_submission s ON a.submission_id = s.id WHERE a.id=? LIMIT 1`, [row.application_id]);
        if (r2 && r2.user_id) row.applicant_user_id = r2.user_id;
      } catch(_) {}
    }
    res.set('Cache-Control','no-store, max-age=0');
    res.status(200).json(row);
  } catch (error) {
    console.error('Error fetching case:', error);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

// TEMP: Backfill documents from legacy iset_application_file into iset_document (test data only)
app.post('/api/dev/backfill-documents', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT f.user_id, f.file_path, f.original_filename, f.detected_mime, f.id AS legacy_id, f.size_bytes, a.id AS application_id
      FROM iset_application_file f
      LEFT JOIN iset_application a ON a.submission_id = f.submission_id OR a.user_id = f.user_id
      WHERE f.status='clean' OR f.status='pending'`);
    let inserted = 0;
    for (const r of rows) {
      try {
        await pool.query(`INSERT INTO iset_document (applicant_user_id, application_id, file_name, file_path, source, status, mime_type, size_bytes)
          VALUES (?,?,?,?, 'application_submission','active', ?, ?)
          ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at), status='active', mime_type=VALUES(mime_type), size_bytes=VALUES(size_bytes)`,
          [r.user_id, r.application_id || null, r.original_filename, r.file_path, r.detected_mime || null, r.size_bytes || null]);
        inserted++;
      } catch(_) {}
    }
    res.json({ backfilled: inserted, scanned: rows.length });
  } catch (e) {
    console.error('[backfill-documents] error', e.message);
    res.status(500).json({ error: 'backfill_failed' });
  }
});


/**
 * POST /api/counter-session
 * 
 * Starts a new counter session for a user at a given counter.
 * 
 * - Only one active session is allowed per counter at a time.
 * - If the counter is already in use (no logout_time recorded), the request will fail.
 * - A successful request creates a new row in the counter_session table.
 * 
 * Expected request body:
 * {
 *   "userId": 123,       // ID of the user (staff member)
 *   "counterId": 5       // ID of the counter they are logging into
 * }
 */
app.post('/api/counter-session', async (req, res) => {
  const { userId, counterId } = req.body;

  try {
    // Step 1: Check if there is an existing active session for this counter
    const [existing] = await pool.query(
      'SELECT id FROM counter_session WHERE counter_id = ? AND logout_time IS NULL',
      [counterId]
    );

    // Step 2: If there is an active session, reject the request
    if (existing.length > 0) {
      return res.status(409).send({ message: 'This counter is already in use.' });
    }

    // Step 3: Insert new session into the counter_session table
    await pool.query(
      'INSERT INTO counter_session (counter_id, user_id) VALUES (?, ?)',
      [counterId, userId]
    );

    // Step 4: Return success
    res.status(201).send({ message: 'Counter session started successfully.' });
  } catch (error) {
    // Log the error for debugging
    console.error('Error starting counter session:', error);
    // Return error response
    res.status(500).send({ message: 'Failed to start counter session', error: error.message });
  }
});

/**
 * GET /api/counter-session/active?userId=1
 * 
 * Returns the currently active counter session for the given user, if one exists.
 * 
 * Response:
 * {
 *   counterId: 1,
 *   counterName: "Booth 1",
 *   locationId: 1,
 *   loginTime: "2025-04-03T14:18:00Z"
 * }
 */
app.get('/api/counter-session/active', async (req, res) => {
  const { userId } = req.query;

  try {
    const [rows] = await pool.query(`
      SELECT cs.counter_id AS counterId, c.name AS counterName, c.location_id AS locationId, cs.login_time AS loginTime
      FROM counter_session cs
      JOIN counter c ON cs.counter_id = c.id
      WHERE cs.user_id = ? AND cs.logout_time IS NULL
      ORDER BY cs.login_time DESC
      LIMIT 1
    `, [userId]);

    if (rows.length === 0) {
      return res.status(404).send({ message: 'No active session found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).send({ message: 'Failed to fetch session' });
  }
});


/**
 * DELETE /api/counter-session/:counterId
 * 
 * Signs out the currently active session for the specified counter.
 * 
 * - Updates the latest active session (logout_time IS NULL) to mark it as ended.
 * - Safe to call even if no session is currently active.
 */

/**
 * GET /api/counters
 * 
 * Fetches a list of all counters from the system.
 * 
 * Each counter has:
 * - id: the internal identifier
 * - name: display name (e.g. "Booth 1", "Counter A")
 * 
 * This endpoint is used by the Counter Sign-In widget to populate the dropdown
 * of available counters at a location.
 */
app.get('/api/counters', async (req, res) => {
  try {
    // Query the database for all counters (id and name)
    const [rows] = await pool.query('SELECT id, name FROM counter');

    // Return the result as JSON
    res.json(rows);
  } catch (error) {
    // Log any errors and return a 500 status
    console.error('Error fetching counters:', error);
    res.status(500).send({ message: 'Failed to fetch counters' });
  }
});


// --- Basic Users and Roles for Admin UI pages (lightweight) ---------------
// List basic users from the user table for demo/admin views
app.get('/api/users', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email
         FROM user
        ORDER BY id DESC
        LIMIT 500`
    );
    // Shape to match UI expectations (includes a role field even if null)
    const out = rows.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role || null }));
    res.status(200).json(out);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Static role catalogue for the Roles table in Manage Users
function severityToAlertVariant(severity) {
  const value = (severity || '').toLowerCase();
  if (value === 'success') return 'success';
  if (value === 'warning') return 'warning';
  if (value === 'error') return 'error';
  return 'info';
}

// GET event catalogue entries (shared configuration)
app.get('/api/events', async (req, res) => {
  try {
    const catalog = getEventCatalog();
    const rows = [];

    for (const category of catalog) {
      if (!category) continue;
      const categoryId = category.id;
      const types = Array.isArray(category.types) ? category.types : [];
      const categoryDescription = category.description || '';
      const categorySource = category.source || null;
      const categorySeverity = category.severity || 'info';
      for (const type of types) {
        if (!type || !type.id) continue;
        const severity = type.severity || categorySeverity || 'info';
        rows.push({
          value: type.id,
          label: type.label || type.id,
          description: type.description || categoryDescription,
          category: categoryId,
          category_label: category.label || categoryId,
          category_description: categoryDescription,
          severity,
          alert_variant: severityToAlertVariant(severity),
          source: type.source || categorySource,
          locked: Boolean(type.locked),
          draft: Boolean(type.draft || category.draft),
        });
      }
    }

    res.json(rows);
  } catch (err) {
    console.error('[events:list] failed', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.get('/api/roles', (_req, res) => {
  // Keep in sync with navigation/feature flags as needed
  const roles = [
    { id: 'SysAdmin', name: 'System Administrator', description: 'Full administrative access to the Admin Portal.' },
    { id: 'ProgramAdmin', name: 'Program Administrator', description: 'Manage programs, templates, and reporting.' },
    { id: 'RegionalCoordinator', name: 'Regional Coordinator', description: 'Coordinate case assignments and oversee regional workflows.' },
    { id: 'ApplicationAssessor', name: 'Application Assessor', description: 'Assessor-level view and updates for assigned cases.' },
  ];
  res.status(200).json(roles);
});

// Minimal notifications summary for Manage Notifications landing
app.get('/api/notifications/summary', async (_req, res) => {
  try {
    // Provide a simple summary based on existing notification_template rows if present
    const [rows] = await pool.query(
      `SELECT type, language, status, COUNT(*) AS count
         FROM notification_template
        GROUP BY type, language, status
        ORDER BY type, language, status`
    ).catch(() => [ [] ]); // if table missing, fall back to empty array

    const summary = Array.isArray(rows) ? rows : [];
    res.status(200).json({ templatesSummary: summary });
  } catch (err) {
    // If anything fails, return an empty structure so UI keeps working
    console.warn('Notifications summary unavailable:', err?.message || err);
    res.status(200).json({ templatesSummary: [] });
  }
});


app.delete('/api/counter-session/:counterId', async (req, res) => {
  const counterId = req.params.counterId;

  try {
    // Step 1: Update the latest active session by setting logout_time
    const [result] = await pool.query(`
      UPDATE counter_session
      SET logout_time = NOW()
      WHERE counter_id = ? AND logout_time IS NULL
    `, [counterId]);

    if (result.affectedRows > 0) {
      res.status(200).send({ message: 'Counter session ended successfully' });
    } else {
      res.status(200).send({ message: 'No active session to end' });
    }

  } catch (error) {
    console.error('Error ending counter session:', error);
    res.status(500).send({ message: 'Failed to end counter session', error: error.message });
  }
});


// New endpoint to return list of option data sources
app.get('/api/option-data-sources', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, label, endpoint FROM option_data_sources ORDER BY label');
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch option data sources:', error);
    res.status(500).json({ error: 'Failed to retrieve option data sources' });
  }
});


app.get('/api/blocksteps/:id', async (req, res) => {
  const { id } = req.params;

  try {
    console.log(`Fetching BlockStep with ID: ${id}`);

    const [rows] = await pool.query(
      'SELECT id, name, type, config_path, status FROM blockstep WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      console.warn(`BlockStep with ID ${id} not found.`);
      return res.status(404).json({ message: 'BlockStep not found' });
    }

    const blockStep = rows[0];

    // Don't try to read or parse .njk here; let frontend load it via /api/load-njk-template
    blockStep.components = []; // Ensure components key exists, even if unused

    res.status(200).json(blockStep);
  } catch (error) {
    console.error('Error fetching BlockStep:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// GET endpoint to retrieve all BlockSteps from the database
app.get('/api/blocksteps', async (req, res) => {
  try {
    // Query the database for all BlockSteps
    const [blocksteps] = await pool.query(
      'SELECT id, name, type, config_path, status FROM blockstep'
    );

    // Return the fetched BlockSteps as JSON
    res.status(200).json(blocksteps);
  } catch (error) {
    // Log and return an error if the query fails
    console.error('Error fetching blocksteps:', error);
    res.status(500).json({ message: 'Failed to fetch blocksteps' });
  }
});

app.post('/api/blocksteps', async (req, res) => {
  const { name, status, components, njkContent } = req.body;

  if (!name || !components || components.length === 0 || !njkContent) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Generate slug for file name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const configPath = `blocksteps/blockstep_${slug}_v1.njk`;
  const jsonPath = configPath.replace('.njk', '.json');

  try {
    // Insert DB row
    const [result] = await pool.query(`
      INSERT INTO blockstep (name, type, config_path, status)
      VALUES (?, 'nunjucks', ?, ?)
    `, [name, configPath, status]);

    const newId = result.insertId;

    // Write Nunjucks file
    fs.writeFileSync(path.join(__dirname, configPath), njkContent, 'utf8');

    // Write JSON file
    fs.writeFileSync(path.join(__dirname, jsonPath), JSON.stringify({ name, status, components }, null, 2), 'utf8');

    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('Error creating new blockstep:', err);
    res.status(500).json({ message: 'Failed to create blockstep' });
  }
});

app.put('/api/blocksteps/:id', async (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body;

  if (!name || !status) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    await pool.query(`
      UPDATE blockstep
      SET name = ?, status = ?
      WHERE id = ?
    `, [name, status, id]);

    res.status(200).json({ message: 'BlockStep updated successfully' });
  } catch (err) {
    console.error('Error updating BlockStep:', err);
    res.status(500).json({ message: 'Failed to update BlockStep' });
  }
});

app.delete('/api/blocksteps/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the blockstep record to get file paths
    const [rows] = await pool.query('SELECT config_path FROM blockstep WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'BlockStep not found' });
    }

    const { config_path } = rows[0];
    const jsonPath = config_path.replace('.njk', '.json');

    // Delete the blockstep record from the database
    await pool.query('DELETE FROM blockstep WHERE id = ?', [id]);

    // Delete the associated files
    const njkFullPath = path.join(__dirname, config_path);
    const jsonFullPath = path.join(__dirname, jsonPath);

    if (fs.existsSync(njkFullPath)) fs.unlinkSync(njkFullPath);
    if (fs.existsSync(jsonFullPath)) fs.unlinkSync(jsonFullPath);

    res.status(200).json({ message: 'BlockStep and associated files deleted successfully.' });
  } catch (error) {
    console.error('Error deleting BlockStep:', error);
    res.status(500).json({ message: 'Failed to delete BlockStep.' });
  }
});

app.get('/api/render-nunjucks', (req, res) => {
  const { template_path } = req.query;

  if (!template_path) {
    console.error('template_path query parameter is required');
    return res.status(400).json({ error: 'template_path query parameter is required' });
  }

  const filePath = path.join(__dirname, template_path);
  console.log('Reading Nunjucks template from:', filePath);

  fs.readFile(filePath, 'utf8', (err, template) => {
    if (err) {
      console.error('Error reading Nunjucks template:', err);
      return res.status(500).json({ error: 'Failed to load Nunjucks template' });
    }

    try {
      // Render the Nunjucks template
      const renderedHtml = nunjucks.renderString(template);
      res.send(renderedHtml);
    } catch (renderError) {
      console.error('Error rendering Nunjucks template:', renderError);
      res.status(500).json({ error: 'Failed to render Nunjucks template' });
    }
  });
});

// GET /api/load-njk-template
// This endpoint loads the raw contents of a Nunjucks (.njk) template file from disk.
//
// It is used by the Modify Intake Step UI to preview the saved template exactly as it was last written.
// The frontend sends the file path (relative to the project root) using the `?path=` query parameter.
// The server reads the file as plain text and returns its contents without parsing.
//
// Example request:
//   GET /api/load-njk-template?path=blocksteps/blockstep_request-extra-time_v1.njk
//
// Returns:
//   200 OK with text/plain body if successful
//   400 if `path` is missing
//   500 if the file cannot be read

app.get('/api/load-njk-template', (req, res) => {
  const { path: templatePath } = req.query;

  if (!templatePath) {
    console.error('Missing template path');
    return res.status(400).send('Missing template path');
  }

  const fullPath = path.join(__dirname, templatePath);
  console.log('Loading Nunjucks template from:', fullPath);

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    res.type('text/plain').send(content);
  } catch (err) {
    console.error('Error reading .njk file:', err.message);
    res.status(500).send('Could not read template file');
  }
});

app.get('/api/search-users', async (req, res) => {
  const { query } = req.query;
  try {
    const [users] = await pool.query(`
      SELECT id, name, email, phone_number
      FROM user
      WHERE name LIKE ? OR email LIKE ? OR phone_number LIKE ?
    `, [`%${query}%`, `%${query}%`, `%${query}%`]);
    res.status(200).send(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).send({ message: 'Failed to search users' });
  }
});


// Save slot search criteria to a separate variable
let slotSearchCriteria = {};
let appointmentData = {};

app.post('/api/save-slot-search-criteria', (req, res) => {
  slotSearchCriteria = { ...req.body };
  appointmentData = { ...appointmentData, ...req.body };
  res.status(200).send({ message: 'Slot search criteria and appointment data saved successfully' });
});

app.get('/api/get-slot-search-criteria', (req, res) => {
  res.status(200).send(slotSearchCriteria);
});

app.get('/api/get-appointment', (req, res) => {
  res.status(200).send(appointmentData);
});

app.get('/api/services', async (req, res) => {
  try {
    const [services] = await pool.query('SELECT id, name FROM service_type');
    res.status(200).send(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).send({ message: 'Failed to fetch services' });
  }
});

// --- Notification Templates API (DB-backed) ---

// Get all templates
app.get('/api/templates', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, type, status, language, subject, content, created_at, updated_at
      FROM notification_template
      ORDER BY name, language, type, status
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get a template by ID
app.get('/api/templates/:templateId', async (req, res) => {
  const templateId = req.params.templateId;
  try {
    const [rows] = await pool.query(
      'SELECT id, name, type, status, language, subject, content, created_at, updated_at FROM notification_template WHERE id = ?',
      [templateId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Save (create or update) a template by ID
app.post('/api/templates/:templateId', async (req, res) => {
  const templateId = req.params.templateId;
  const { name, type, status, language, subject, content } = req.body;
  if (!name || !type || !content || !subject) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // If templateId is 'new' or not a number, insert; else update
    if (templateId === 'new' || isNaN(Number(templateId))) {
      const [result] = await pool.query(
        `INSERT INTO notification_template (name, type, status, language, subject, content) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, type, status, language, subject, content]
      );
      res.status(201).json({ id: result.insertId, message: 'Template created' });
    } else {
      const [result] = await pool.query(
        `UPDATE notification_template SET name=?, type=?, status=?, language=?, subject=?, content=? WHERE id=?`,
        [name, type, status, language, subject, content, templateId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.status(200).json({ id: templateId, message: 'Template updated' });
    }
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

// Delete a template by ID
app.delete('/api/templates/:templateId', async (req, res) => {
  const templateId = req.params.templateId;
  try {
    const [result] = await pool.query(
      'DELETE FROM notification_template WHERE id = ?',
      [templateId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.status(200).json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

app.get('/api/admin/messages', async (req, res) => {
  try {
    console.log("Fetching messages...");  // ???? Log request start

    const [messages] = await pool.query(`
          SELECT id, sender_id, recipient_id, subject, body, status, deleted, urgent, created_at 
          FROM messages
          ORDER BY urgent DESC, created_at DESC
      `);

    console.log("Messages fetched:", messages);  // ???? Log retrieved messages

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);  // ???? Log error details
    res.status(500).json({ error: error.message });  // ???? Send error details in response
  }
});


app.post('/api/admin/messages', async (req, res) => {
  const { sender_id, recipient_id, subject, body, urgent } = req.body;

  if (!sender_id || !recipient_id || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [result] = await pool.query(`
          INSERT INTO messages (sender_id, recipient_id, subject, body, status, deleted, urgent, created_at)
          VALUES (?, ?, ?, ?, 'unread', FALSE, ?, NOW())
      `, [sender_id, recipient_id, subject, body, urgent]);

    res.status(201).json({ message: 'Message sent', messageId: result.insertId });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Mark a message as deleted
app.put('/api/admin/messages/:id/delete', async (req, res) => {
  const messageId = req.params.id;
  try {
    const [result] = await pool.query(
      'UPDATE messages SET deleted = 1 WHERE id = ?',
      [messageId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Update message status (PUT /api/admin/messages/:id/status)
app.put('/api/admin/messages/:id/status', async (req, res) => {
  const messageId = req.params.id;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Missing status' });
  }
  try {
    await pool.query('UPDATE messages SET status = ? WHERE id = ?', [status, messageId]);
    res.status(200).json({ message: 'Status updated' });
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ error: 'Failed to update message status' });
  }
});

// Case workspace helpers
const ensureCaseExists = async (caseId) => {
  try {
    const [[row]] = await pool.query('SELECT id FROM iset_case WHERE id = ? LIMIT 1', [caseId]);
    return !!row;
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return false;
    }
    throw err;
  }
};

// Case reminders API
app.get('/api/reminders', async (req, res) => {
  const caseIdRaw = req.query.caseId ?? req.query.case_id;
  const applicationIdRaw = req.query.applicationId ?? req.query.application_id;
  const includeGlobalRaw = req.query.includeGlobal ?? req.query.include_global ?? false;
  const statusRaw = req.query.status ?? req.query.statuses;
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;

  const caseId = coerceOptionalPositiveInt(caseIdRaw);
  if (Number.isNaN(caseId)) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }
  const applicationId = coerceOptionalPositiveInt(applicationIdRaw);
  if (Number.isNaN(applicationId)) {
    return res.status(400).json({ error: 'invalid_application_id' });
  }
  const includeGlobal = parseBooleanFlag(includeGlobalRaw, false);

  let statuses;
  if (typeof statusRaw === 'undefined') {
    statuses = ['open'];
  } else {
    const source = Array.isArray(statusRaw) ? statusRaw : [statusRaw];
    const tokens = source
      .flatMap(token => String(token).split(','))
      .map(token => token.trim().toLowerCase())
      .filter(Boolean);
    if (!tokens.length) {
      return res.status(400).json({ error: 'invalid_status', allowed: Array.from(REMINDER_ALLOWED_STATUSES) });
    }
    if (tokens.includes('all')) {
      statuses = Array.from(REMINDER_ALLOWED_STATUSES);
    } else {
      const validTokens = tokens.filter(token => REMINDER_ALLOWED_STATUSES.has(token));
      if (!validTokens.length) {
        return res.status(400).json({ error: 'invalid_status', allowed: Array.from(REMINDER_ALLOWED_STATUSES) });
      }
      statuses = validTokens;
    }
  }

  let limitValue = coerceOptionalPositiveInt(limitRaw);
  if (Number.isNaN(limitValue)) {
    return res.status(400).json({ error: 'invalid_limit' });
  }
  if (limitValue === undefined || limitValue === null) {
    limitValue = 200;
  }
  if (limitValue > 500) {
    limitValue = 500;
  }

  let offsetValue = coerceOptionalNonNegativeInt(offsetRaw);
  if (Number.isNaN(offsetValue)) {
    return res.status(400).json({ error: 'invalid_offset' });
  }
  if (offsetValue === undefined || offsetValue === null) {
    offsetValue = 0;
  }

  try {
    const reminders = await listReminders({
      caseId,
      applicationId,
      includeGlobal,
      statuses,
      limit: limitValue,
      offset: offsetValue
    });
    return res.json(reminders);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return res.json([]);
    }
    console.error('GET /api/reminders failed:', err.message);
    return res.status(500).json({ error: 'failed_to_load_reminders' });
  }
});

app.get('/api/reminders/:reminderId', async (req, res) => {
  const reminderId = Number.parseInt(req.params.reminderId, 10);
  if (!Number.isInteger(reminderId) || reminderId <= 0) {
    return res.status(400).json({ error: 'invalid_reminder_id' });
  }
  try {
    const reminder = await fetchReminderById(reminderId);
    if (!reminder) {
      return res.status(404).json({ error: 'reminder_not_found' });
    }
    return res.json(reminder);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return res.status(404).json({ error: 'reminder_not_found' });
    }
    console.error(`GET /api/reminders/${reminderId} failed:`, err.message);
    return res.status(500).json({ error: 'failed_to_load_reminder' });
  }
});

app.post('/api/reminders', async (req, res) => {
  const body = req.body || {};
  const caseIdValue = coerceOptionalPositiveInt(body.caseId ?? body.case_id);
  if (Number.isNaN(caseIdValue)) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }
  const applicationIdValue = coerceOptionalPositiveInt(body.applicationId ?? body.application_id);
  if (Number.isNaN(applicationIdValue)) {
    return res.status(400).json({ error: 'invalid_application_id' });
  }
  const actionPlanIdValue = coerceOptionalPositiveInt(body.actionPlanId ?? body.action_plan_id);
  if (Number.isNaN(actionPlanIdValue)) {
    return res.status(400).json({ error: 'invalid_action_plan_id' });
  }
  const interventionIdValue = coerceOptionalPositiveInt(body.interventionId ?? body.intervention_id);
  if (Number.isNaN(interventionIdValue)) {
    return res.status(400).json({ error: 'invalid_intervention_id' });
  }
  const assignedStaffProfileIdValue = coerceOptionalPositiveInt(body.assignedStaffProfileId ?? body.assigned_staff_profile_id);
  if (Number.isNaN(assignedStaffProfileIdValue)) {
    return res.status(400).json({ error: 'invalid_assigned_staff_profile_id' });
  }
  let completedByStaffProfileIdValue = coerceOptionalPositiveInt(body.completedByStaffProfileId ?? body.completed_by_staff_profile_id);
  if (Number.isNaN(completedByStaffProfileIdValue)) {
    return res.status(400).json({ error: 'invalid_completed_by_staff_profile_id' });
  }

  let dueAtValue;
  try {
    dueAtValue = parseReminderDateInput(body.dueAt ?? body.due_at, 'due_at');
  } catch (err) {
    if (err.code === REMINDER_DATE_ERROR) {
      return res.status(400).json({ error: 'invalid_due_at' });
    }
    throw err;
  }

  let completedAtValue;
  try {
    completedAtValue = parseReminderDateInput(body.completedAt ?? body.completed_at, 'completed_at');
  } catch (err) {
    if (err.code === REMINDER_DATE_ERROR) {
      return res.status(400).json({ error: 'invalid_completed_at' });
    }
    throw err;
  }

  let metadataJsonValue;
  try {
    metadataJsonValue = resolveReminderMetadataInput(body);
  } catch (err) {
    if (err.code === REMINDER_METADATA_ERROR) {
      return res.status(400).json({ error: 'invalid_metadata' });
    }
    throw err;
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return res.status(400).json({ error: 'title_required' });
  }
  if (title.length > 255) {
    return res.status(400).json({ error: 'title_too_long', max: 255 });
  }

  let descriptionValue = null;
  if (hasOwn(body, 'description')) {
    if (body.description === null) {
      descriptionValue = null;
    } else if (typeof body.description === 'string') {
      const trimmed = body.description.trim();
      descriptionValue = trimmed || null;
    } else {
      return res.status(400).json({ error: 'invalid_description' });
    }
  } else if (typeof body.description === 'string') {
    const trimmed = body.description.trim();
    descriptionValue = trimmed || null;
  }

  let categoryValue = null;
  if (hasOwn(body, 'category')) {
    if (body.category === null) {
      categoryValue = null;
    } else {
      const token = String(body.category).trim();
      if (!token) {
        categoryValue = null;
      } else {
        if (token.length > 100) {
          return res.status(400).json({ error: 'category_too_long', max: 100 });
        }
        categoryValue = token;
      }
    }
  } else if (typeof body.category === 'string') {
    const token = body.category.trim();
    if (token) {
      if (token.length > 100) {
        return res.status(400).json({ error: 'category_too_long', max: 100 });
      }
      categoryValue = token;
    }
  }

  let statusValue = normaliseReminderStatus(body.status, 'open');
  if (!statusValue) {
    return res.status(400).json({ error: 'invalid_status', allowed: Array.from(REMINDER_ALLOWED_STATUSES) });
  }

  const actingStaffProfileId = req.staffProfile?.id || null;
  if (statusValue !== 'completed') {
    completedAtValue = null;
    completedByStaffProfileIdValue = null;
  } else {
    if (!completedAtValue) {
      completedAtValue = new Date();
    }
    if (!completedByStaffProfileIdValue) {
      completedByStaffProfileIdValue = actingStaffProfileId || null;
    }
  }

  try {
    if (Number.isInteger(caseIdValue) && caseIdValue > 0) {
      const caseExists = await ensureCaseExists(caseIdValue);
      if (!caseExists) {
        return res.status(404).json({ error: 'case_not_found' });
      }
    }

    const insertSql = `INSERT INTO iset_case_reminder
      (case_id, application_id, action_plan_id, intervention_id, title, description, category, status, due_at, completed_at, completed_by_staff_profile_id, assigned_staff_profile_id, metadata_json, created_by_staff_profile_id, updated_by_staff_profile_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const insertParams = [
      Number.isInteger(caseIdValue) ? caseIdValue : null,
      Number.isInteger(applicationIdValue) ? applicationIdValue : null,
      Number.isInteger(actionPlanIdValue) ? actionPlanIdValue : null,
      Number.isInteger(interventionIdValue) ? interventionIdValue : null,
      title,
      descriptionValue,
      categoryValue,
      statusValue,
      dueAtValue ?? null,
      completedAtValue ?? null,
      completedByStaffProfileIdValue ?? null,
      Number.isInteger(assignedStaffProfileIdValue) ? assignedStaffProfileIdValue : null,
      metadataJsonValue ?? null,
      actingStaffProfileId || null,
      actingStaffProfileId || null
    ];

    let insertResult;
    try {
      [insertResult] = await pool.query(insertSql, insertParams);
    } catch (err) {
      if (isMissingTableErrorLocal(err)) {
        return res.status(500).json({ error: 'reminders_not_available' });
      }
      throw err;
    }
    const reminder = await fetchReminderById(insertResult.insertId);
    return res.status(201).json(reminder);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return res.status(500).json({ error: 'reminders_not_available' });
    }
    console.error('POST /api/reminders failed:', err.message);
    return res.status(500).json({ error: 'failed_to_create_reminder' });
  }
});

app.put('/api/reminders/:reminderId', async (req, res) => {
  const reminderId = Number.parseInt(req.params.reminderId, 10);
  if (!Number.isInteger(reminderId) || reminderId <= 0) {
    return res.status(400).json({ error: 'invalid_reminder_id' });
  }
  const body = req.body || {};

  let existing;
  try {
    existing = await fetchReminderById(reminderId);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return res.status(404).json({ error: 'reminder_not_found' });
    }
    console.error(`PUT /api/reminders/${reminderId} failed to load existing:`, err.message);
    return res.status(500).json({ error: 'failed_to_update_reminder' });
  }
  if (!existing) {
    return res.status(404).json({ error: 'reminder_not_found' });
  }

  const updates = [];
  const params = [];
  const actingStaffProfileId = req.staffProfile?.id || null;

  const caseIdProvided = hasOwn(body, 'caseId') || hasOwn(body, 'case_id');
  if (caseIdProvided) {
    const caseIdValue = coerceOptionalPositiveInt(body.caseId ?? body.case_id);
    if (Number.isNaN(caseIdValue)) {
      return res.status(400).json({ error: 'invalid_case_id' });
    }
    if (Number.isInteger(caseIdValue) && caseIdValue > 0) {
      const caseExists = await ensureCaseExists(caseIdValue);
      if (!caseExists) {
        return res.status(404).json({ error: 'case_not_found' });
      }
    }
    updates.push('case_id = ?');
    params.push(Number.isInteger(caseIdValue) ? caseIdValue : null);
  }

  const applicationIdProvided = hasOwn(body, 'applicationId') || hasOwn(body, 'application_id');
  if (applicationIdProvided) {
    const applicationIdValue = coerceOptionalPositiveInt(body.applicationId ?? body.application_id);
    if (Number.isNaN(applicationIdValue)) {
      return res.status(400).json({ error: 'invalid_application_id' });
    }
    updates.push('application_id = ?');
    params.push(Number.isInteger(applicationIdValue) ? applicationIdValue : null);
  }

  const actionPlanProvided = hasOwn(body, 'actionPlanId') || hasOwn(body, 'action_plan_id');
  if (actionPlanProvided) {
    const actionPlanIdValue = coerceOptionalPositiveInt(body.actionPlanId ?? body.action_plan_id);
    if (Number.isNaN(actionPlanIdValue)) {
      return res.status(400).json({ error: 'invalid_action_plan_id' });
    }
    updates.push('action_plan_id = ?');
    params.push(Number.isInteger(actionPlanIdValue) ? actionPlanIdValue : null);
  }

  const interventionProvided = hasOwn(body, 'interventionId') || hasOwn(body, 'intervention_id');
  if (interventionProvided) {
    const interventionIdValue = coerceOptionalPositiveInt(body.interventionId ?? body.intervention_id);
    if (Number.isNaN(interventionIdValue)) {
      return res.status(400).json({ error: 'invalid_intervention_id' });
    }
    updates.push('intervention_id = ?');
    params.push(Number.isInteger(interventionIdValue) ? interventionIdValue : null);
  }

  if (hasOwn(body, 'title')) {
    const titleValue = typeof body.title === 'string' ? body.title.trim() : '';
    if (!titleValue) {
      return res.status(400).json({ error: 'title_required' });
    }
    if (titleValue.length > 255) {
      return res.status(400).json({ error: 'title_too_long', max: 255 });
    }
    updates.push('title = ?');
    params.push(titleValue);
  }

  if (hasOwn(body, 'description')) {
    if (body.description === null) {
      updates.push('description = ?');
      params.push(null);
    } else if (typeof body.description === 'string') {
      const trimmed = body.description.trim();
      updates.push('description = ?');
      params.push(trimmed || null);
    } else {
      return res.status(400).json({ error: 'invalid_description' });
    }
  }

  if (hasOwn(body, 'category')) {
    if (body.category === null) {
      updates.push('category = ?');
      params.push(null);
    } else {
      const token = String(body.category).trim();
      if (!token) {
        updates.push('category = ?');
        params.push(null);
      } else {
        if (token.length > 100) {
          return res.status(400).json({ error: 'category_too_long', max: 100 });
        }
        updates.push('category = ?');
        params.push(token);
      }
    }
  }

  let dueAtProvided = hasOwn(body, 'dueAt') || hasOwn(body, 'due_at');
  let dueAtValue;
  if (dueAtProvided) {
    try {
      dueAtValue = parseReminderDateInput(body.dueAt ?? body.due_at, 'due_at');
    } catch (err) {
      if (err.code === REMINDER_DATE_ERROR) {
        return res.status(400).json({ error: 'invalid_due_at' });
      }
      throw err;
    }
    updates.push('due_at = ?');
    params.push(dueAtValue ?? null);
  }

  let completedAtProvided = hasOwn(body, 'completedAt') || hasOwn(body, 'completed_at');
  let completedAtValue;
  if (completedAtProvided) {
    try {
      completedAtValue = parseReminderDateInput(body.completedAt ?? body.completed_at, 'completed_at');
    } catch (err) {
      if (err.code === REMINDER_DATE_ERROR) {
        return res.status(400).json({ error: 'invalid_completed_at' });
      }
      throw err;
    }
  }

  const assignedProvided = hasOwn(body, 'assignedStaffProfileId') || hasOwn(body, 'assigned_staff_profile_id');
  if (assignedProvided) {
    const assignedValue = coerceOptionalPositiveInt(body.assignedStaffProfileId ?? body.assigned_staff_profile_id);
    if (Number.isNaN(assignedValue)) {
      return res.status(400).json({ error: 'invalid_assigned_staff_profile_id' });
    }
    updates.push('assigned_staff_profile_id = ?');
    params.push(Number.isInteger(assignedValue) ? assignedValue : null);
  }

  let completedByProvided = hasOwn(body, 'completedByStaffProfileId') || hasOwn(body, 'completed_by_staff_profile_id');
  let completedByValue;
  if (completedByProvided) {
    completedByValue = coerceOptionalPositiveInt(body.completedByStaffProfileId ?? body.completed_by_staff_profile_id);
    if (Number.isNaN(completedByValue)) {
      return res.status(400).json({ error: 'invalid_completed_by_staff_profile_id' });
    }
  }

  if (hasOwn(body, 'metadata') || hasOwn(body, 'metadataJson')) {
    let metadataJsonValue;
    try {
      metadataJsonValue = resolveReminderMetadataInput(body);
    } catch (err) {
      if (err.code === REMINDER_METADATA_ERROR) {
        return res.status(400).json({ error: 'invalid_metadata' });
      }
      throw err;
    }
    updates.push('metadata_json = ?');
    params.push(metadataJsonValue ?? null);
  }

  const statusProvided = hasOwn(body, 'status');
  let statusValue;
  if (statusProvided) {
    statusValue = normaliseReminderStatus(body.status, null);
    if (!statusValue) {
      return res.status(400).json({ error: 'invalid_status', allowed: Array.from(REMINDER_ALLOWED_STATUSES) });
    }
  }

  if (statusProvided) {
    if (statusValue === 'completed') {
      if (!completedAtProvided) {
        if (existing.completedAt) {
          const existingDate = new Date(existing.completedAt);
          completedAtValue = Number.isNaN(existingDate.getTime()) ? new Date() : existingDate;
        } else {
          completedAtValue = new Date();
        }
        completedAtProvided = true;
      }
      if (!completedByProvided) {
        const existingCompletedBy = coerceOptionalPositiveInt(existing.completedByStaffProfileId);
        if (Number.isInteger(existingCompletedBy) && existingCompletedBy > 0) {
          completedByValue = existingCompletedBy;
        } else {
          completedByValue = actingStaffProfileId || null;
        }
        completedByProvided = true;
      }
    } else {
      if (!completedAtProvided) {
        completedAtValue = null;
        completedAtProvided = true;
      }
      if (!completedByProvided) {
        completedByValue = null;
        completedByProvided = true;
      }
    }
  }

  if (statusProvided) {
    updates.push('status = ?');
    params.push(statusValue);
  }
  if (completedAtProvided) {
    updates.push('completed_at = ?');
    params.push(completedAtValue ?? null);
  }
  if (completedByProvided) {
    updates.push('completed_by_staff_profile_id = ?');
    params.push(Number.isInteger(completedByValue) ? completedByValue : null);
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'no_fields_to_update' });
  }

  updates.push('updated_by_staff_profile_id = ?');
  params.push(actingStaffProfileId || null);
  updates.push('updated_at = CURRENT_TIMESTAMP');

  const updateSql = `UPDATE iset_case_reminder SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`;
  params.push(reminderId);

  try {
    const [result] = await pool.query(updateSql, params);
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'reminder_not_found' });
    }
    const reminder = await fetchReminderById(reminderId);
    return res.json(reminder);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return res.status(404).json({ error: 'reminder_not_found' });
    }
    console.error(`PUT /api/reminders/${reminderId} failed:`, err.message);
    return res.status(500).json({ error: 'failed_to_update_reminder' });
  }
});

app.post('/api/reminders/:reminderId/complete', async (req, res) => {
  const reminderId = Number.parseInt(req.params.reminderId, 10);
  if (!Number.isInteger(reminderId) || reminderId <= 0) {
    return res.status(400).json({ error: 'invalid_reminder_id' });
  }
  const body = req.body || {};

  let completedAtValue;
  try {
    completedAtValue = parseReminderDateInput(body.completedAt ?? body.completed_at, 'completed_at');
  } catch (err) {
    if (err.code === REMINDER_DATE_ERROR) {
      return res.status(400).json({ error: 'invalid_completed_at' });
    }
    throw err;
  }
  if (!completedAtValue) {
    completedAtValue = new Date();
  }

  let completedByValue = coerceOptionalPositiveInt(body.completedByStaffProfileId ?? body.completed_by_staff_profile_id);
  if (Number.isNaN(completedByValue)) {
    return res.status(400).json({ error: 'invalid_completed_by_staff_profile_id' });
  }

  const actingStaffProfileId = req.staffProfile?.id || null;

  let existing;
  try {
    existing = await fetchReminderById(reminderId);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return res.status(404).json({ error: 'reminder_not_found' });
    }
    console.error(`POST /api/reminders/${reminderId}/complete failed to load existing:`, err.message);
    return res.status(500).json({ error: 'failed_to_complete_reminder' });
  }
  if (!existing) {
    return res.status(404).json({ error: 'reminder_not_found' });
  }

  if (!Number.isInteger(completedByValue) || completedByValue <= 0) {
    const existingCompletedBy = coerceOptionalPositiveInt(existing.completedByStaffProfileId);
    if (Number.isInteger(existingCompletedBy) && existingCompletedBy > 0) {
      completedByValue = existingCompletedBy;
    } else {
      completedByValue = actingStaffProfileId || null;
    }
  }

  try {
    const updateSql = `UPDATE iset_case_reminder
      SET status = 'completed', completed_at = ?, completed_by_staff_profile_id = ?, updated_by_staff_profile_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL`;
    const updateParams = [completedAtValue, Number.isInteger(completedByValue) ? completedByValue : null, actingStaffProfileId || null, reminderId];
    const [result] = await pool.query(updateSql, updateParams);
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'reminder_not_found' });
    }
    const reminder = await fetchReminderById(reminderId);
    return res.json(reminder);
  } catch (err) {
    if (isMissingTableErrorLocal(err)) {
      return res.status(404).json({ error: 'reminder_not_found' });
    }
    console.error(`POST /api/reminders/${reminderId}/complete failed:`, err.message);
    return res.status(500).json({ error: 'failed_to_complete_reminder' });
  }
});

// Case notes CRUD

app.get('/api/cases/:caseId/notes', async (req, res) => {
  const caseId = parseInt(req.params.caseId, 10);
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }
  try {
    const caseExists = await ensureCaseExists(caseId);
    if (!caseExists) {
      return res.status(404).json({ error: 'case_not_found' });
    }
    let notes = [];
    try {
      notes = await fetchCaseNotesForCase(caseId);
    } catch (err) {
      if (isMissingTableErrorLocal(err)) {
        return res.json([]);
      }
      throw err;
    }
    return res.json(notes);
  } catch (err) {
    console.error('GET /api/cases/:caseId/notes failed:', err.message);
    return res.status(500).json({ error: 'failed_to_load_notes' });
  }
});

app.post('/api/cases/:caseId/notes', async (req, res) => {
  const caseId = parseInt(req.params.caseId, 10);
  const { body: bodyInput, isPinned } = req.body || {};
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }
  const trimmed = typeof bodyInput === 'string' ? bodyInput.trim() : '';
  if (!trimmed) {
    return res.status(400).json({ error: 'invalid_body' });
  }
  if (trimmed.length > CASE_NOTE_MAX_LENGTH) {
    return res.status(400).json({ error: 'body_too_long', max: CASE_NOTE_MAX_LENGTH });
  }
  const followUpInput = Object.prototype.hasOwnProperty.call(req.body || {}, 'followUpAt')
    ? req.body.followUpAt
    : req.body?.follow_up_at;
  let followUpDateValue;
  try {
    followUpDateValue = parseReminderDateInput(followUpInput, 'follow_up_at');
  } catch (err) {
    if (err.code === REMINDER_DATE_ERROR) {
      return res.status(400).json({ error: 'invalid_follow_up_at' });
    }
    throw err;
  }
  const followUpDate = followUpDateValue === undefined ? null : followUpDateValue;
  const staffProfileId = req.staffProfile?.id || null;
  const authorUserId = getAuthenticatedNumericUserId(req);
  const pinnedValue = isPinned ? 1 : 0;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const caseRow = await loadCaseIdentifiers(connection, caseId);
    if (!caseRow) {
      await connection.rollback();
      return res.status(404).json({ error: 'case_not_found' });
    }
    let insertResult;
    try {
      [insertResult] = await connection.query(
        'INSERT INTO iset_case_note (case_id, author_staff_profile_id, author_user_id, body, is_internal, is_pinned, follow_up_at) VALUES (?,?,?,?,1,?,?)',
        [caseId, staffProfileId, authorUserId, trimmed, pinnedValue, followUpDate ?? null]
      );
    } catch (err) {
      if (isMissingTableErrorLocal(err)) {
        await connection.rollback();
        return res.status(500).json({ error: 'case_notes_unavailable' });
      }
      throw err;
    }
    const noteId = insertResult.insertId;
    if (followUpDate) {
      try {
        const reminderId = await createReminderForCaseNote(connection, {
          caseId,
          applicationId: caseRow.application_id || null,
          noteId,
          noteBody: trimmed,
          dueAt: followUpDate,
          staffProfileId,
        });
        await connection.query('UPDATE iset_case_note SET reminder_id = ? WHERE id = ?', [reminderId, noteId]);
      } catch (err) {
        if (isMissingTableErrorLocal(err)) {
          await connection.rollback();
          return res.status(500).json({ error: 'reminders_not_available' });
        }
        throw err;
      }
    }
    await connection.commit();
    const note = await fetchCaseNoteById(caseId, noteId);
    return res.status(201).json(note);
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }
    if (isMissingTableErrorLocal(err)) {
      return res.status(500).json({ error: 'case_notes_unavailable' });
    }
    console.error('POST /api/cases/:caseId/notes failed:', err.message);
    return res.status(500).json({ error: 'failed_to_create_note' });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/api/cases/:caseId/notes/:noteId', async (req, res) => {
  const caseId = parseInt(req.params.caseId, 10);
  const noteId = parseInt(req.params.noteId, 10);
  const { body: bodyInput, isPinned } = req.body || {};
  const followUpInput = hasOwn(req.body || {}, 'followUpAt') ? req.body.followUpAt : req.body?.follow_up_at;
  if (!Number.isInteger(caseId) || caseId <= 0 || !Number.isInteger(noteId) || noteId <= 0) {
    return res.status(400).json({ error: 'invalid_identifier' });
  }
  if (bodyInput === undefined && isPinned === undefined && followUpInput === undefined) {
    return res.status(400).json({ error: 'no_fields_to_update' });
  }
  let trimmed;
  if (bodyInput !== undefined) {
    trimmed = typeof bodyInput === 'string' ? bodyInput.trim() : '';
    if (!trimmed) {
      return res.status(400).json({ error: 'invalid_body' });
    }
    if (trimmed.length > CASE_NOTE_MAX_LENGTH) {
      return res.status(400).json({ error: 'body_too_long', max: CASE_NOTE_MAX_LENGTH });
    }
  }
  let parsedFollowUp;
  if (followUpInput !== undefined) {
    try {
      parsedFollowUp = parseReminderDateInput(followUpInput, 'follow_up_at');
    } catch (err) {
      if (err.code === REMINDER_DATE_ERROR) {
        return res.status(400).json({ error: 'invalid_follow_up_at' });
      }
      throw err;
    }
    if (parsedFollowUp === undefined) {
      parsedFollowUp = null;
    }
  }
  const staffProfileId = req.staffProfile?.id || null;
  const editorUserId = getAuthenticatedNumericUserId(req);
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT id, case_id, body, is_pinned, follow_up_at, reminder_id FROM iset_case_note WHERE id = ? AND case_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
      [noteId, caseId]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'note_not_found' });
    }
    const existing = rows[0];
    const updates = [];
    const params = [];
    if (bodyInput !== undefined) {
      updates.push('body = ?');
      params.push(trimmed);
    }
    if (isPinned !== undefined) {
      updates.push('is_pinned = ?');
      params.push(isPinned ? 1 : 0);
    }
    const followUpProvided = followUpInput !== undefined;
    if (followUpProvided) {
      updates.push('follow_up_at = ?');
      params.push(parsedFollowUp ?? null);
    }
    let reminderId = existing.reminder_id ? Number(existing.reminder_id) : null;
    const noteBodyForReminder = bodyInput !== undefined ? trimmed : existing.body || '';
    const existingFollowUpDate = existing.follow_up_at ? new Date(existing.follow_up_at) : null;

    let caseIdentifiersCache = null;
    const ensureCaseIdentifiers = async () => {
      if (caseIdentifiersCache) return caseIdentifiersCache;
      const identifiers = await loadCaseIdentifiers(connection, caseId);
      caseIdentifiersCache = identifiers || { application_id: null };
      return caseIdentifiersCache;
    };

    if (followUpProvided) {
      if (parsedFollowUp) {
        try {
          if (reminderId) {
            const updated = await updateReminderForCaseNote(connection, reminderId, {
              noteId,
              noteBody: noteBodyForReminder,
              dueAt: parsedFollowUp,
              staffProfileId,
            });
            if (!updated) {
              const newReminderId = await createReminderForCaseNote(connection, {
                caseId,
                applicationId: (await ensureCaseIdentifiers())?.application_id || null,
                noteId,
                noteBody: noteBodyForReminder,
                dueAt: parsedFollowUp,
                staffProfileId,
              });
              reminderId = newReminderId;
              updates.push('reminder_id = ?');
              params.push(reminderId);
            }
          } else {
            const newReminderId = await createReminderForCaseNote(connection, {
              caseId,
              applicationId: (await ensureCaseIdentifiers())?.application_id || null,
              noteId,
              noteBody: noteBodyForReminder,
              dueAt: parsedFollowUp,
              staffProfileId,
            });
            reminderId = newReminderId;
            updates.push('reminder_id = ?');
            params.push(reminderId);
          }
        } catch (err) {
          if (isMissingTableErrorLocal(err)) {
            await connection.rollback();
            return res.status(500).json({ error: 'reminders_not_available' });
          }
          throw err;
        }
      } else {
        if (reminderId) {
          try {
            await cancelReminderForCaseNote(connection, reminderId, staffProfileId);
          } catch (err) {
            if (isMissingTableErrorLocal(err)) {
              await connection.rollback();
              return res.status(500).json({ error: 'reminders_not_available' });
            }
            throw err;
          }
        }
        updates.push('reminder_id = ?');
        params.push(null);
      }
    } else if (bodyInput !== undefined && reminderId) {
      try {
        await updateReminderForCaseNote(connection, reminderId, {
          noteId,
          noteBody: noteBodyForReminder,
          dueAt: existingFollowUpDate,
          staffProfileId,
        });
      } catch (err) {
        if (isMissingTableErrorLocal(err)) {
          await connection.rollback();
          return res.status(500).json({ error: 'reminders_not_available' });
        }
        throw err;
      }
    }

    if (!updates.length) {
      await connection.rollback();
      return res.status(400).json({ error: 'no_fields_to_update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP(3)');
    updates.push('edited_at = CURRENT_TIMESTAMP(3)');
    updates.push('edited_by_staff_profile_id = ?');
    params.push(staffProfileId);
    updates.push('edited_by_user_id = ?');
    params.push(editorUserId);

    try {
      const [result] = await connection.query(
        `UPDATE iset_case_note SET ${updates.join(', ')} WHERE id = ? AND case_id = ? AND deleted_at IS NULL`,
        [...params, noteId, caseId]
      );
      if (!result.affectedRows) {
        await connection.rollback();
        return res.status(404).json({ error: 'note_not_found' });
      }
    } catch (err) {
      if (isMissingTableErrorLocal(err)) {
        await connection.rollback();
        return res.status(404).json({ error: 'note_not_found' });
      }
      throw err;
    }

    await connection.commit();
    const note = await fetchCaseNoteById(caseId, noteId);
    return res.json(note);
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }
    console.error('PUT /api/cases/:caseId/notes/:noteId failed:', err.message);
    return res.status(500).json({ error: 'failed_to_update_note' });
  } finally {
    if (connection) connection.release();
  }
});

app.delete('/api/cases/:caseId/notes/:noteId', async (req, res) => {
  const caseId = parseInt(req.params.caseId, 10);
  const noteId = parseInt(req.params.noteId, 10);
  if (!Number.isInteger(caseId) || caseId <= 0 || !Number.isInteger(noteId) || noteId <= 0) {
    return res.status(400).json({ error: 'invalid_identifier' });
  }
  const staffProfileId = req.staffProfile?.id || null;
  const editorUserId = getAuthenticatedNumericUserId(req);
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT reminder_id FROM iset_case_note WHERE id = ? AND case_id = ? AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
      [noteId, caseId]
    );
    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'note_not_found' });
    }
    const reminderId = rows[0].reminder_id ? Number(rows[0].reminder_id) : null;
    try {
      const [result] = await connection.query(
        'UPDATE iset_case_note SET deleted_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3), edited_at = CURRENT_TIMESTAMP(3), edited_by_staff_profile_id = ?, edited_by_user_id = ?, follow_up_at = NULL, reminder_id = NULL WHERE id = ? AND case_id = ? AND deleted_at IS NULL',
        [staffProfileId, editorUserId, noteId, caseId]
      );
      if (!result.affectedRows) {
        await connection.rollback();
        return res.status(404).json({ error: 'note_not_found' });
      }
    } catch (err) {
      if (isMissingTableErrorLocal(err)) {
        await connection.rollback();
        return res.status(404).json({ error: 'note_not_found' });
      }
      throw err;
    }
    if (reminderId) {
      try {
        await cancelReminderForCaseNote(connection, reminderId, staffProfileId);
      } catch (err) {
        if (isMissingTableErrorLocal(err)) {
          await connection.rollback();
          return res.status(500).json({ error: 'reminders_not_available' });
        }
        throw err;
      }
    }
    await connection.commit();
    return res.status(204).send();
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback failure
      }
    }
    console.error('DELETE /api/cases/:caseId/notes/:noteId failed:', err.message);
    return res.status(500).json({ error: 'failed_to_delete_note' });
  } finally {
    if (connection) connection.release();
  }
});
// Secure messaging: case-scoped thread fetch
// GET /api/cases/:id/messages
// Returns latest messages involving the applicant for this case (either direction)
app.get('/api/cases/:id/messages', async (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  if (!Number.isInteger(caseId) || caseId < 1) return res.status(400).json({ error: 'invalid_case_id' });
  try {
    // Resolve applicant user id for this case
    let caseRow;
    try {
      [[caseRow]] = await pool.query(
        `SELECT COALESCE(applicant.id, s.user_id) AS applicant_user_id
         FROM iset_case c
         JOIN iset_application a ON c.application_id = a.id
         LEFT JOIN iset_application_submission s ON a.submission_id = s.id
         LEFT JOIN user applicant ON s.user_id = applicant.id
         WHERE c.id = ?
         LIMIT 1`,
        [caseId]
      );
    } catch (e) {
      const noTable = e && e.code === 'ER_NO_SUCH_TABLE';
      const badField = e && e.code === 'ER_BAD_FIELD_ERROR';
      if (noTable || badField) {
        // During migrations or on minimal schemas, return empty thread gracefully
        return res.json({ applicant_user_id: null, items: [] });
      }
      throw e;
    }
    const applicantId = caseRow?.applicant_user_id || null;
    if (!applicantId) return res.status(404).json({ error: 'applicant_not_found' });

    const limit = Math.min(Math.max(parseInt(req.query.limit || '200', 10) || 200, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    const [rows] = await pool.query(
      `SELECT id, case_id, application_id, sender_id, recipient_id, subject, body, status, deleted, urgent, created_at
         FROM messages
        WHERE sender_id = ? OR recipient_id = ?
        ORDER BY created_at ASC
        LIMIT ? OFFSET ?`,
      [applicantId, applicantId, limit, offset]
    );
    res.json({ applicant_user_id: applicantId, items: rows });
  } catch (e) {
    console.error('GET /api/cases/:id/messages failed:', e.message);
    res.status(500).json({ error: 'failed_to_fetch_messages' });
  }
});

// Secure messaging: send message to applicant for case
// POST /api/cases/:id/messages  { subject, body, urgent }
app.post('/api/cases/:id/messages', async (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  const { subject, body, urgent } = req.body || {};
  if (!Number.isInteger(caseId) || caseId < 1) return res.status(400).json({ error: 'invalid_case_id' });
  if (!subject || !body) return res.status(400).json({ error: 'missing_required_fields' });
  try {
    // Resolve applicant user id
    const [[caseRow]] = await pool.query(
      `SELECT c.application_id,
              COALESCE(applicant.id, s.user_id) AS applicant_user_id,
              COALESCE(
                s.reference_number,
                JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number'))
              ) AS tracking_reference
         FROM iset_case c
         JOIN iset_application a ON c.application_id = a.id
         LEFT JOIN iset_application_submission s ON a.submission_id = s.id
         LEFT JOIN user applicant ON s.user_id = applicant.id
        WHERE c.id = ?
        LIMIT 1`,
      [caseId]
    );
    const recipientId = caseRow?.applicant_user_id || null;
    if (!recipientId) return res.status(404).json({ error: 'applicant_not_found' });

    // Resolve sender user id from Cognito auth context (create if missing)
    const email = req?.auth?.email || null;
    const sub = req?.auth?.sub || null;
    if (!email && !sub) return res.status(401).json({ error: 'unauthorized' });
    let senderId = null;
    let row;
    if (sub) { [[row]] = await pool.query('SELECT id FROM user WHERE cognito_sub = ? LIMIT 1', [sub]); }
    if (!row && email) { [[row]] = await pool.query('SELECT id FROM user WHERE email = ? LIMIT 1', [email]); }
    if (!row) {
      const safeEmail = email || `${sub}@placeholder.local`;
      const preferredLanguage = 'en';
      const name = req?.auth?.name || safeEmail;
      const [ins] = await pool.query(
        `INSERT INTO user (name,email,cognito_sub,email_verified,suspended,preferred_language)
         VALUES (?,?,?,1,0,?)`,
        [name, safeEmail, sub || null, preferredLanguage]
      );
      senderId = ins.insertId;
    } else {
      senderId = row.id;
    }

    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, case_id, application_id, subject, body, status, deleted, urgent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'unread', FALSE, ?, NOW())`,
      [senderId, recipientId, caseId, caseRow?.application_id || null, subject, body, !!urgent]
    );
    try {
      await sendSecureMessageAlert({
        pool,
        userId: recipientId,
        trackingId: caseRow?.tracking_reference || null,
      });
    } catch (notifyErr) {
      console.error('[notifications] secure message email failed', notifyErr?.message || notifyErr);
    }
    res.status(201).json({ message: 'Message sent', messageId: result.insertId });
  } catch (e) {
    console.error('POST /api/cases/:id/messages failed:', e.message);
    res.status(500).json({ error: 'failed_to_send_message' });
  }
});

app.get('/api/me/case-watches', async (req, res) => {
  try {
    const staffProfileId = resolveActiveStaffProfileId(req);
    if (!staffProfileId) {
      return res.status(401).json({ error: 'staff_profile_required' });
    }

    const [[staffRow]] = await pool.query(
      'SELECT id, primary_role FROM staff_profiles WHERE id = ? LIMIT 1',
      [staffProfileId]
    );
    if (!staffRow) {
      return res.status(404).json({ error: 'staff_profile_not_found' });
    }

    const watches = await listCaseWatchesForUser(pool, staffProfileId);
    if (!watches.length) {
      return res.status(200).json([]);
    }

    const caseIds = Array.from(
      new Set(
        watches
          .map((entry) => Number(entry.caseId))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    );

    let caseMap = new Map();
    if (caseIds.length) {
      const placeholders = caseIds.map(() => '?').join(',');
      const [caseRows] = await pool.query(
        `SELECT
            c.id,
            c.status,
            c.assigned_to_user_id,
            c.updated_at,
            sub.reference_number AS tracking_id,
            applicant.name AS applicant_name,
            applicant.email AS applicant_email,
            staff.email AS assigned_staff_email
         FROM iset_case c
         LEFT JOIN iset_application a ON a.id = c.application_id
         LEFT JOIN iset_application_submission sub ON sub.id = a.submission_id
         LEFT JOIN user applicant ON applicant.id = sub.user_id
         LEFT JOIN staff_profiles staff ON staff.id = c.assigned_to_user_id
        WHERE c.id IN (${placeholders})`,
        caseIds
      );
      caseMap = new Map(caseRows.map((row) => [Number(row.id), row]));
    }

    const payload = watches.map((watch) => {
      const caseId = Number(watch.caseId);
      const match = caseMap.get(caseId) || {};
      const assignedRaw = match.assigned_to_user_id;
      const assignedToStaffProfileId =
        assignedRaw === null || typeof assignedRaw === 'undefined'
          ? null
          : Number(assignedRaw);

      const statusNormalised = normaliseCaseStatusValue(match.status);
      return {
        caseId,
        metadata: watch.metadata,
        createdAt: watch.createdAt,
        updatedAt: watch.updatedAt,
        status: statusNormalised || CASE_STATUS_DERIVED_VALUES.pendingApproval,
        statusRaw: match.status || null,
        trackingId: match.tracking_id || null,
        applicantName: match.applicant_name || match.applicant_email || null,
        applicantEmail: match.applicant_email || null,
        assignedToStaffProfileId: Number.isFinite(assignedToStaffProfileId)
          ? assignedToStaffProfileId
          : null,
        assignedStaffEmail: match.assigned_staff_email || null,
        lastActivityAt: match.updated_at || null,
      };
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error('[case-watch] list failed', error);
    res.status(500).json({ error: 'failed_to_list_case_watches' });
  }
});

app.post('/api/cases/:caseId/watch', async (req, res) => {
  const caseId = Number(req.params.caseId);
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }

  const staffProfileId = resolveActiveStaffProfileId(req);
  if (!staffProfileId) {
    return res.status(401).json({ error: 'staff_profile_required' });
  }

  try {
    const [[staffRow]] = await pool.query(
      'SELECT id, primary_role FROM staff_profiles WHERE id = ? LIMIT 1',
      [staffProfileId]
    );
    if (!staffRow) {
      return res.status(404).json({ error: 'staff_profile_not_found' });
    }

    const [[caseRow]] = await pool.query(
      `SELECT
          c.id,
          c.status,
          c.assigned_to_user_id,
          c.updated_at,
          sub.reference_number AS tracking_id,
          applicant.name AS applicant_name,
          applicant.email AS applicant_email,
          staff.email AS assigned_staff_email
         FROM iset_case c
         LEFT JOIN iset_application a ON a.id = c.application_id
         LEFT JOIN iset_application_submission sub ON sub.id = a.submission_id
         LEFT JOIN user applicant ON applicant.id = sub.user_id
         LEFT JOIN staff_profiles staff ON staff.id = c.assigned_to_user_id
        WHERE c.id = ?
        LIMIT 1`,
      [caseId]
    );
    if (!caseRow) {
      return res.status(404).json({ error: 'case_not_found' });
    }

    let metadata = null;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'metadata')) {
      metadata = normaliseWatchMetadata(req.body.metadata);
      if (metadata) {
        const encoded = JSON.stringify(metadata);
        if (encoded.length > 2048) {
          return res.status(400).json({ error: 'metadata_too_large' });
        }
      }
    }

    const watch = await createCaseWatch(pool, { caseId, staffProfileId, metadata });
    const { actorId, actorName } = resolveRequestActor(req) || {};

    try {
      await captureCaseEvent({
        type: 'case_watch_added',
        caseId,
        payload: {
          staffProfileId,
          staffPrimaryRole: staffRow.primary_role || null,
        },
        actorId,
        actorName,
      });
    } catch (eventErr) {
      console.warn('[case-watch] failed to emit watch_added event', eventErr);
    }

    res.status(200).json({
      watch,
      case: {
        id: Number(caseRow.id),
        status: normaliseCaseStatusValue(caseRow.status) || CASE_STATUS_DERIVED_VALUES.pendingApproval,
        statusRaw: caseRow.status || null,
        trackingId: caseRow.tracking_id || null,
        applicantName: caseRow.applicant_name || caseRow.applicant_email || null,
        applicantEmail: caseRow.applicant_email || null,
        assignedToStaffProfileId:
          caseRow.assigned_to_user_id == null
            ? null
            : Number(caseRow.assigned_to_user_id),
        assignedStaffEmail: caseRow.assigned_staff_email || null,
        lastActivityAt: caseRow.updated_at || null,
      },
    });
  } catch (error) {
    console.error('[case-watch] create failed', error);
    res.status(500).json({ error: 'failed_to_create_case_watch' });
  }
});

app.delete('/api/cases/:caseId/watch', async (req, res) => {
  const caseId = Number(req.params.caseId);
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }

  const staffProfileId = resolveActiveStaffProfileId(req);
  if (!staffProfileId) {
    return res.status(401).json({ error: 'staff_profile_required' });
  }

  try {
    const [[staffRow]] = await pool.query(
      'SELECT id, primary_role FROM staff_profiles WHERE id = ? LIMIT 1',
      [staffProfileId]
    );
    if (!staffRow) {
      return res.status(404).json({ error: 'staff_profile_not_found' });
    }

    const [[caseRow]] = await pool.query(
      'SELECT id FROM iset_case WHERE id = ? LIMIT 1',
      [caseId]
    );
    if (!caseRow) {
      return res.status(404).json({ error: 'case_not_found' });
    }

    const removed = await deleteCaseWatch(pool, { caseId, staffProfileId });

    if (removed > 0) {
      const { actorId, actorName } = resolveRequestActor(req) || {};
      try {
        await captureCaseEvent({
          type: 'case_watch_removed',
          caseId,
          payload: {
            staffProfileId,
            staffPrimaryRole: staffRow.primary_role || null,
          },
          actorId,
          actorName,
        });
      } catch (eventErr) {
        console.warn('[case-watch] failed to emit watch_removed event', eventErr);
      }
    }

    res.status(200).json({ removed: removed > 0 });
  } catch (error) {
    console.error('[case-watch] delete failed', error);
    res.status(500).json({ error: 'failed_to_remove_case_watch' });
  }
});

app.get('/api/location-services/:locationId', async (req, res) => {
  const { locationId } = req.params;
  try {
    const [services] = await pool.query(`
      SELECT st.id, st.name
      FROM location_service_link ls
      JOIN service_type st ON ls.service_id = st.id
      WHERE ls.location_id = ?
    `, [locationId]);
    res.status(200).send(services);
  } catch (error) {
    console.error('Error fetching location services:', error);
    res.status(500).send({ message: 'Failed to fetch location services' });
  }
});

app.post('/api/location-services/:locationId', async (req, res) => {
  const { locationId } = req.params;
  const serviceIds = req.body;

  try {
    // Delete existing services for the location
    await pool.query('DELETE FROM location_service_link WHERE location_id = ?', [locationId]);

    // Insert new services for the location
    const values = serviceIds.map(serviceId => [locationId, serviceId]);
    await pool.query('INSERT INTO location_service_link (location_id, service_id) VALUES ?', [values]);

    res.status(200).send({ message: 'Services updated successfully' });
  } catch (error) {
    console.error('Error updating location services:', error);
    res.status(500).send({ message: 'Failed to update location services' });
  }
});

app.put('/api/location-services/:locationId', async (req, res) => {
  const { locationId } = req.params;
  const serviceIds = req.body;

  try {
    // Delete existing services for the location
    await pool.query('DELETE FROM location_service_link WHERE location_id = ?', [locationId]);

    // Insert new services for the location
    const values = serviceIds.map(serviceId => [locationId, serviceId]);
    await pool.query('INSERT INTO location_service_link (location_id, service_id) VALUES ?', [values]);

    res.status(200).send({ message: 'Services updated successfully' });
  } catch (error) {
    console.error('Error updating location services:', error);
    res.status(500).send({ message: 'Failed to update location services' });
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const { country, location, service } = req.query;
    console.log('Received query parameters:', req.query); // Debugging log

    let query = `
SELECT 
    a.id, 
    u.name, 
    s.date, 
    s.time, 
    a.status, 
    st.name AS serviceType, 
    l.name AS location
FROM appointment a
JOIN user u ON a.user_id = u.id
JOIN booking b ON a.id = b.appointment_id
JOIN slot s ON b.slot_id = s.id  -- Direct join with slot using slot_id from booking
JOIN service_type st ON a.serviceType = st.id
JOIN location l ON s.location_id = l.id
WHERE 1=1;
    `;

    if (country && country !== 'all') {
      query += ` AND l.country_id = ${mysql.escape(country)}`;
    }

    if (location && location !== 'all') {
      query += ` AND l.id = ${mysql.escape(location)}`;
    }

    if (service && service !== 'all') {
      query += ` AND st.name = ${mysql.escape(service)}`;
    }

    console.log('Constructed SQL query:', query); // Debugging log

    const [appointments] = await pool.query(query);

    // Mask the name field
    const maskedAppointments = appointments.map(appointment => {
      const nameParts = appointment.name.split(' ');
      const maskedName = nameParts.map(part => {
        if (part.length <= 2) return part;
        return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
      }).join(' ');
      return { ...appointment, name: maskedName };
    });

    res.status(200).send(maskedAppointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).send({ message: 'Failed to fetch appointments' });
  }
});

app.get('/api/appointments/:id', async (req, res) => {
  const appointmentId = req.params.id;
  try {
    const [appointment] = await pool.query(`
SELECT 
    a.id, 
    u.name, 
    s.date, 
    s.time, 
    a.status, 
    st.name AS serviceType, 
    l.name AS location
FROM appointment a
JOIN user u ON a.user_id = u.id
JOIN booking b ON a.id = b.appointment_id
JOIN slot s ON b.slot_id = s.id  -- Direct join with slot using slot_id from booking
JOIN service_type st ON a.serviceType = st.id
JOIN location l ON s.location_id = l.id
WHERE a.id = ?;
    `, [appointmentId]);

    if (appointment.length === 0) {
      return res.status(404).send({ message: 'Appointment not found' });
    }

    res.status(200).send(appointment[0]);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).send({ message: 'Failed to fetch appointment' });
  }
});

app.put('/api/appointments/:id', async (req, res) => {
  const appointmentId = req.params.id;
  const { status } = req.body;

  try {
    // Update the status in the appointment table
    await pool.query('UPDATE appointment SET status = ? WHERE id = ?', [status, appointmentId]);

    if (status === 'serving') {
      // Update the service_start_time in the queue table
      await pool.query('UPDATE queue SET service_start_time = ? WHERE appointment_id = ?', [new Date(), appointmentId]);
    } else if (status === 'package' || status === 'complete') {
      // Update the service_end_time in the queue table
      await pool.query('UPDATE queue SET service_end_time = ? WHERE appointment_id = ?', [new Date(), appointmentId]);
    } else if (status === 'booked') {
      // Delete the record from the queue table
      await pool.query('DELETE FROM queue WHERE appointment_id = ?', [appointmentId]);
    }

    res.status(200).send({ message: 'Appointment status updated successfully' });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).send({ message: 'Failed to update appointment status' });
  }
});

app.delete('/api/queue/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM queue WHERE appointment_id = ?', [appointmentId]);

    if (result.affectedRows === 0) {
      return res.status(404).send({ message: 'Queue record not found' });
    }

    res.status(200).send({ message: 'Queue record deleted successfully' });
  } catch (error) {
    console.error('Error deleting queue record:', error);
    res.status(500).send({ message: 'Failed to delete queue record' });
  }
});

const formatDateTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
};

app.put('/api/queue', async (req, res) => {
  const { appointmentId, service_start_time, service_end_time, status } = req.body;

  try {
    const formattedStartTime = formatDateTime(service_start_time);
    const formattedEndTime = formatDateTime(service_end_time);

    const [result] = await pool.query(`
      UPDATE queue 
      SET 
        service_start_time = COALESCE(?, service_start_time), 
        service_end_time = COALESCE(?, service_end_time), 
        status = COALESCE(?, status)
      WHERE appointment_id = ?
    `, [formattedStartTime, formattedEndTime, status, appointmentId]);

    if (result.affectedRows === 0) {
      return res.status(404).send({ message: 'Queue record not found' });
    }

    res.status(200).send({ message: 'Queue record updated successfully' });
  } catch (error) {
    console.error('Error updating queue record:', error);
    res.status(500).send({ message: 'Failed to update queue record' });
  }
});

// --- PTMA Endpoints ---

// List all PTMAs or Hubs (filter by type if provided)
app.get('/api/ptmas', async (req, res) => {
  try {
    const type = req.query.type;
    let whereClause = '';
    let params = [];
    if (type === 'PTMA' || type === 'Hub') {
      whereClause = 'WHERE type = ?';
      params = [type];
    }
    // Get all PTMAs or Hubs
    const [ptmas] = await pool.query(`
      SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
      ${whereClause}
    `, params);

    // Get applications (all cases per PTMA/Hub)
    const [applicationCounts] = await pool.query(`
      SELECT ptma_id, COUNT(*) AS applications
      FROM iset_case
      WHERE ptma_id IS NOT NULL
      GROUP BY ptma_id
    `);
    // Get open cases per PTMA/Hub
    const [openCaseCounts] = await pool.query(`
      SELECT ptma_id, COUNT(*) AS cases
      FROM iset_case
      WHERE ptma_id IS NOT NULL AND status IN ('submitted','open')
      GROUP BY ptma_id
    `);
    // Build lookup maps
    const applicationsMap = Object.fromEntries(applicationCounts.map(r => [r.ptma_id, r.applications]));
    const casesMap = Object.fromEntries(openCaseCounts.map(r => [r.ptma_id, r.cases]));

    // Map DB fields to API fields for each PTMA/Hub, adding counts
    const mapped = ptmas.map(db => ({
      id: db.id,
      full_name: db.iset_full_name,
      code: db.iset_code,
      status: db.iset_status,
      province: db.iset_province,
      indigenous_group: db.iset_indigenous_group,
      full_address: db.iset_full_address,
      agreement_id: db.iset_agreement_id,
      notes: db.iset_notes,
      website_url: db.website_url || null,
      contact_name: db.contact_name || null,
      contact_email: db.contact_email || null,
      contact_phone: db.contact_phone || null,
      contact_notes: db.contact_notes || null,
      applications: applicationsMap[db.id] || 0,
      cases: casesMap[db.id] || 0
    }));
    res.status(200).json(mapped);
  } catch (error) {
    console.error('Error fetching PTMAs:', error);
    res.status(500).send({ message: 'Failed to fetch PTMAs' });
  }
});

// Get PTMA by ID
app.get('/api/ptmas/:id', async (req, res) => {
  const ptmaId = req.params.id;
  try {
    const [ptmas] = await pool.query(`
      SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
      WHERE id = ?
    `, [ptmaId]);
    if (ptmas.length === 0) {
      return res.status(404).send({ message: 'PTMA not found' });
    }
    // Map DB fields to API fields
    const db = ptmas[0];
    res.status(200).json({
      id: db.id,
      full_name: db.iset_full_name,
      code: db.iset_code,
      status: db.iset_status,
      province: db.iset_province,
      indigenous_group: db.iset_indigenous_group,
      full_address: db.iset_full_address,
      agreement_id: db.iset_agreement_id,
      notes: db.iset_notes,
      website_url: db.website_url || null,
      contact_name: db.contact_name || null,
      contact_email: db.contact_email || null,
      contact_phone: db.contact_phone || null,
      contact_notes: db.contact_notes || null
    });
  } catch (error) {
    console.error('Error fetching PTMA:', error);
    res.status(500).send({ message: 'Failed to fetch PTMA' });
  }
});

// Create PTMA
app.post('/api/ptmas', async (req, res) => {
  const {
    location,
    iset_full_name,
    iset_code,
    iset_status,
    iset_province,
    iset_indigenous_group,
    iset_full_address,
    iset_agreement_id,
    iset_notes,
    website_url,
    contact_name,
    contact_email,
    contact_phone,
    contact_notes
  } = req.body;
  try {
    const [result] = await pool.query(`
          INSERT INTO ptma (name, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [location, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes]);
    const ptmaId = result.insertId;
    const [newPtma] = await pool.query(`
      SELECT id, name AS location, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
      WHERE id = ?
    `, [ptmaId]);
    res.status(201).send(newPtma[0]);
  } catch (error) {
    console.error('Error creating PTMA:', error);
    res.status(500).send({ message: 'Failed to create PTMA' });
  }
});

// Update PTMA
app.put('/api/ptmas/:id', async (req, res) => {
  const ptmaId = req.params.id;
  const {
    full_name,
    code,
    status,
    province,
    indigenous_group,
    full_address,
    agreement_id,
    notes,
    website_url,
    contact_name,
    contact_email,
    contact_phone,
    contact_notes
  } = req.body;
  try {
    await pool.query(`
      UPDATE ptma SET 
        iset_full_name = ?,
        iset_code = ?,
        iset_status = ?,
        iset_province = ?,
        iset_indigenous_group = ?,
        iset_full_address = ?,
        iset_agreement_id = ?,
        iset_notes = ?,
        website_url = ?,
        contact_name = ?,
        contact_email = ?,
        contact_phone = ?,
        contact_notes = ?
      WHERE id = ?
    `, [full_name, code, status, province, indigenous_group, full_address, agreement_id, notes, website_url, contact_name, contact_email, contact_phone, contact_notes, ptmaId]);
    const [updatedPtma] = await pool.query(`
      SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
      WHERE id = ?
    `, [ptmaId]);
    const db = updatedPtma[0];
    res.status(200).json({
      id: db.id,
      full_name: db.iset_full_name,
      code: db.iset_code,
      status: db.iset_status,
      province: db.iset_province,
      indigenous_group: db.iset_indigenous_group,
      full_address: db.iset_full_address,
      agreement_id: db.iset_agreement_id,
      notes: db.iset_notes,
      website_url: db.website_url || null,
      contact_name: db.contact_name || null,
      contact_email: db.contact_email || null,
      contact_phone: db.contact_phone || null,
      contact_notes: db.contact_notes || null
    });
  } catch (error) {
    console.error('Error updating PTMA:', error);
    res.status(500).send({ message: 'Failed to update PTMA' });
  }
});

// Delete PTMA
app.delete('/api/ptmas/:id', async (req, res) => {
  const ptmaId = req.params.id;
  try {
    await pool.query('DELETE FROM ptma WHERE id = ?', [ptmaId]);
    res.status(200).send({ message: 'PTMA deleted successfully' });
  } catch (error) {
    console.error('Error deleting PTMA:', error);
    res.status(500).send({ message: 'Failed to delete PTMA' });
  }
});

// Get evaluators for a PTMA
app.get('/api/ptmas/:ptmaId/evaluators', async (req, res) => {
  const { ptmaId } = req.params;
  try {
    const [evaluators] = await pool.query(`
      SELECT 
        e.id, 
        e.name, 
        e.email, 
        e.role,
        ep.assigned_at,
        ep.unassigned_at
      FROM iset_evaluators e
      JOIN iset_evaluator_ptma ep 
        ON e.id = ep.evaluator_id
      WHERE ep.ptma_id = ?
        AND (ep.unassigned_at IS NULL OR ep.unassigned_at > CURDATE())
      ORDER BY e.name
    `, [ptmaId]);
    res.status(200).json(evaluators);
  } catch (error) {
    console.error('Error fetching evaluators for PTMA:', error);
    res.status(500).json({ error: 'Failed to fetch evaluators' });
  }
});
// --- End PTMA Endpoints ---

// Get full iset_application by application_id
app.get('/api/applications/:id', async (req, res) => {
  const applicationId = req.params.id;
  try {
    // Get application data
    let appSql = 'SELECT * FROM iset_application a WHERE a.id = ?';
    const appParams = [applicationId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeApplications } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeApplications(req.auth || {}, 'a');
        if (/\bregion_id\b/.test(scopeSql)) {
          try {
            // Detect if region_id column exists on iset_application; skip predicate if missing (legacy schema)
            await pool.query('SELECT region_id FROM iset_application LIMIT 0');
            appSql += ` AND ${scopeSql}`;
            appParams.push(...scopeParams);
          } catch (colErr) {
            console.warn('[rbac] skipping application region scope (column missing):', colErr.code || colErr.message);
          }
        } else {
          appSql += ` AND ${scopeSql}`;
          appParams.push(...scopeParams);
        }
      }
    } catch (_) {}
    const [[application]] = await pool.query(appSql, appParams);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Enrich payload_json with submission answers if minimal snapshot only
    try {
      let payload = application.payload_json;
      if (payload && typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { payload = {}; }
      }
      if (!payload || typeof payload !== 'object') payload = {};
      const hasAnswers = payload.answers || payload.form_answers || payload.data;
      const submissionId = application.submission_id;
      let schemaFields = null;
      if (!hasAnswers && submissionId) {
        try {
          const [[sub]] = await pool.query('SELECT intake_payload, schema_snapshot FROM iset_application_submission WHERE id = ? LIMIT 1', [submissionId]);
          if (sub && sub.intake_payload) {
            let intake = sub.intake_payload;
            if (typeof intake === 'string') {
              try { intake = JSON.parse(intake); } catch { intake = {}; }
            }
            if (intake && typeof intake === 'object') {
              // Heuristic: prefer explicit answers keys, else attach whole intake as answers
              const candidate = intake.answers || intake.form_answers || intake.data || intake;
              if (candidate && typeof candidate === 'object') {
                payload.answers = candidate;
              }
            }
          }
          if (sub && sub.schema_snapshot) {
            try {
              let snap = sub.schema_snapshot;
              if (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch { snap = null; } }
              if (snap && typeof snap === 'object' && snap.fields && typeof snap.fields === 'object') {
                schemaFields = snap.fields;
              }
            } catch(_) {}
          }
        } catch (enrichErr) {
          console.warn('[enrich] submission intake payload unavailable:', enrichErr.code || enrichErr.message);
        }
      }
      // Attach schema field metadata if present
      if (schemaFields) {
        payload._schema_fields = schemaFields; // underscored to avoid collision
      }
      application.payload_json = payload; // keep as object; frontend handles object or string
    } catch (payloadErr) {
      console.warn('[enrich] payload processing failed:', payloadErr.message);
    }

    // Get case info (if exists) with defensive column detection (legacy schemas may lack some fields)
    const caseBaseCols = ['id','assigned_to_user_id','status'];
    const optionalCols = ['priority','program_type','case_summary','opened_at','closed_at','last_activity_at','ptma_id'];
    const presentOptional = [];
    for (const col of optionalCols) {
      try { await pool.query(`SELECT ${col} FROM iset_case LIMIT 0`); presentOptional.push(col); } catch(_) { /* skip missing */ }
    }
    const caseCols = [...caseBaseCols, ...presentOptional];
    let caseSql = `SELECT ${caseCols.join(', ')} FROM iset_case c WHERE application_id = ?`;
    const caseParams = [applicationId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        caseSql += ` AND ${scopeSql}`;
        caseParams.push(...scopeParams);
      }
    } catch (_) {}
    const [[caseRow]] = await pool.query(caseSql, caseParams);

    let evaluator = null;
    let ptma = null;
    if (caseRow) {
      // Get evaluator info
      const [[evalRow]] = await pool.query(
        'SELECT id, name, email, role, status FROM iset_evaluators WHERE id = ?',
        [caseRow.assigned_to_user_id]
      );
      evaluator = evalRow || null;
      // Get PTMA info directly from iset_case.ptma_id
      if (caseRow.ptma_id) {
        const [[ptmaRow]] = await pool.query(
          'SELECT id, name, iset_code FROM ptma WHERE id = ?',
          [caseRow.ptma_id]
        );
        ptma = ptmaRow || null;
      }
    }

    if (application.row_version !== undefined && application.row_version !== null) {
      application.row_version = Number(application.row_version);
    }
    try {
      const [[lockRow]] = await pool.query(
        'SELECT owner_user_id, owner_display_name, owner_email, expires_at FROM application_lock WHERE application_id = ? AND expires_at > NOW() LIMIT 1',
        [applicationId]
      );
      if (lockRow) {
        application.lock_owner_id = lockRow.owner_user_id;
        application.lock_owner_name = lockRow.owner_display_name || null;
        application.lock_owner_email = lockRow.owner_email || null;
        application.lock_expires_at = lockRow.expires_at;
      } else {
        application.lock_owner_id = null;
        application.lock_owner_name = null;
        application.lock_owner_email = null;
        application.lock_expires_at = null;
      }
    } catch (_) {
      application.lock_owner_id = null;
      application.lock_owner_name = null;
      application.lock_owner_email = null;
      application.lock_expires_at = null;
    }
    res.status(200).json({ ...application, assigned_evaluator: evaluator, ptma, case: caseRow || null });
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

/**
 * GET /api/applications/:id/ptma
 *
 * Returns the PTMA(s) for the assigned evaluator of the given application, or null if not assigned.
 */
app.get('/api/applications/:id/ptma', async (req, res) => {
  const applicationId = req.params.id;
  try {
    // Get assigned evaluator for this application (via iset_case)
    let s = 'SELECT assigned_to_user_id FROM iset_case c WHERE application_id = ?';
    const sParams = [applicationId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        s += ` AND ${scopeSql}`;
        sParams.push(...scopeParams);
      }
    } catch (_) {}
    const [[caseRow]] = await pool.query(s, sParams);
    if (!caseRow) {
      return res.status(200).json({ ptmas: [] });
    }
    // Get all current PTMA assignments for this evaluator
    const [ptmaRows] = await pool.query(
      `SELECT p.id, p.name, p.iset_code, p.iset_full_name, p.iset_status, p.iset_province, p.iset_indigenous_group
       FROM iset_evaluator_ptma ep
       JOIN ptma p ON ep.ptma_id = p.id
       WHERE ep.evaluator_id = ? AND (ep.unassigned_at IS NULL OR ep.unassigned_at > CURDATE())`,
      [caseRow.assigned_to_user_id]
    );
    res.status(200).json({ ptmas: ptmaRows });
  } catch (error) {
    console.error('Error fetching ptma for application:', error);
    res.status(500).json({ error: 'Failed to fetch ptma for application' });
  }
});

// Update case_summary for a given application
app.put('/api/applications/:id/ptma-case-summary', async (req, res) => {
  const applicationId = req.params.id;
  const { case_summary } = req.body;
  if (!case_summary) {
    return res.status(400).json({ error: 'Missing case_summary in request body' });
  }
  try {
    // Update the case_summary in iset_case for the given application_id
    let upd = 'UPDATE iset_case c SET case_summary = ? WHERE application_id = ?';
    const updParams = [case_summary, applicationId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        upd += ` AND ${scopeSql}`;
        updParams.push(...scopeParams);
      }
    } catch (_) {}
    const [result] = await pool.query(upd, updParams);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Case not found for this application' });
    }
    // Return the updated case_summary (and optionally the full case row)
  const [[updatedCase]] = await pool.query('SELECT case_summary FROM iset_case WHERE application_id = ?', [applicationId]);
    res.status(200).json({ case_summary: updatedCase.case_summary });
  } catch (error) {
    console.error('Error updating case summary:', error);
    res.status(500).json({ error: 'Failed to update case summary' });
  }
});

// PATCH /api/applications/:id/answers
// Body: { answers: { key: newValue, ... } }
// Merges into payload_json.answers without overwriting unspecified keys; does not modify submission snapshot.
app.patch('/api/applications/:id/answers', async (req, res) => {
  const applicationId = req.params.id;
  const { answers } = req.body || {};
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return res.status(400).json({ error: 'Missing or invalid answers object in body' });
  }
  try {
    // Load current payload plus submission id
  const [[row]] = await pool.query('SELECT payload_json, submission_id FROM iset_application WHERE id = ? LIMIT 1', [applicationId]);
    if (!row) return res.status(404).json({ error: 'Application not found' });
    let payload = row.payload_json;
    if (payload && typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { payload = {}; } }
    if (!payload || typeof payload !== 'object') payload = {};
    if (!payload.answers || typeof payload.answers !== 'object') payload.answers = {};

    // Determine candidate submission id (prefer column, else payload_json.submission_snapshot.id)
    let candidateSubmissionId = row.submission_id;
    if (!candidateSubmissionId) {
      try {
        if (payload.submission_snapshot && payload.submission_snapshot.id) {
          candidateSubmissionId = payload.submission_snapshot.id;
        }
      } catch(_) { /* ignore */ }
    }

    // Bootstrap missing keys from immutable submission snapshot so we don't lose fields when saving a single edit.
    try {
      if (candidateSubmissionId) {
        const [[sub]] = await pool.query('SELECT intake_payload FROM iset_application_submission WHERE id = ? LIMIT 1', [candidateSubmissionId]);
        if (sub && sub.intake_payload) {
          let intake = sub.intake_payload;
            if (typeof intake === 'string') { try { intake = JSON.parse(intake); } catch { intake = {}; } }
          if (intake && typeof intake === 'object') {
            const sourceAnswers = intake.answers || intake.form_answers || intake.data || intake;
            if (sourceAnswers && typeof sourceAnswers === 'object') {
              const existingKeyCount = Object.keys(payload.answers).length;
              const sourceKeyCount = Object.keys(sourceAnswers).length;
              // If existing answers look minimal compared to source, hydrate all keys (allow overwrite of sparse placeholder)
              const hydrateAll = existingKeyCount === 0 || (existingKeyCount < 5 && sourceKeyCount > existingKeyCount);
              for (const [k,v] of Object.entries(sourceAnswers)) {
                if (hydrateAll || payload.answers[k] === undefined) payload.answers[k] = v;
              }
            }
          }
        }
      }
    } catch (bootstrapErr) {
      console.warn('[answers:patch] bootstrap from submission failed:', bootstrapErr.code || bootstrapErr.message);
    }

    // Apply provided updates
    for (const [k, v] of Object.entries(answers)) {
      payload.answers[k] = v;
    }

    const serialized = JSON.stringify(payload);

    // Optional lightweight versioning: if version table exists, store previous payload before update
    try {
      await pool.query('INSERT INTO iset_application_version (application_id, previous_payload_json) VALUES (?, ?)', [applicationId, row.payload_json]);
    } catch (verErr) {
      // table may not exist yet; ignore
    }

    await pool.query('UPDATE iset_application SET payload_json = ? WHERE id = ?', [serialized, applicationId]);
    res.status(200).json({ updated: Object.keys(answers), answers: payload.answers });
  } catch (err) {
    console.error('Error patching application answers:', err);
    res.status(500).json({ error: 'Failed to update application answers' });
  }
});

app.get('/api/applications/:id/versions', async (req, res) => {
  const applicationId = Number(req.params.id);
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({ error: 'invalid_application_id' });
  }
  const connection = await pool.getConnection();
  try {
    const current = await readApplicationPayload(connection, applicationId);
    if (!current) {
      return res.status(404).json({ error: 'Application not found' });
    }
    await ensureApplicationVersionTable();
    const [rows] = await connection.query(
      'SELECT id, application_id, version, change_summary, created_by_id, created_by_name, restored_from_version, created_at FROM iset_application_version WHERE application_id = ? ORDER BY version DESC, id DESC',
      [applicationId]
    );
    const currentVersionNumber = Number(current.row.version || 1);
    const versions = rows.map(row => {
      const versionNumber = Number(row.version);
      return {
        id: row.id,
        version: versionNumber,
        changeSummary: row.change_summary || null,
        savedById: row.created_by_id || null,
        savedBy: row.created_by_name || null,
        restoredFromVersion: row.restored_from_version === null ? null : Number(row.restored_from_version),
        savedAt: row.created_at,
        isCurrent: false,
        isOriginal: versionNumber === 1,
        canRestore: false
      };
    });
    if (!versions.some(v => v.version === currentVersionNumber)) {
      versions.unshift({
        id: null,
        version: currentVersionNumber,
        changeSummary: null,
        savedById: null,
        savedBy: null,
        restoredFromVersion: null,
        savedAt: current.row.updated_at || current.row.created_at,
        isCurrent: true,
        isOriginal: currentVersionNumber === 1,
        canRestore: false
      });
    }
    const hasMultipleVersions = versions.length > 1;
    for (const item of versions) {
      item.isCurrent = item.version === currentVersionNumber;
      item.isOriginal = item.isOriginal || item.version === 1;
      item.canRestore = hasMultipleVersions && item.version < currentVersionNumber;
    }
    res.json({ versions, currentVersion: currentVersionNumber });
  } catch (error) {
    console.error('Error listing application versions:', error);
    res.status(500).json({ error: 'Failed to load application versions' });
  } finally {
    connection.release();
  }
});

app.get('/api/applications/:id/versions/:versionId', async (req, res) => {
  const applicationId = Number(req.params.id);
  const { versionId } = req.params;
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({ error: 'invalid_application_id' });
  }
  const connection = await pool.getConnection();
  try {
    const current = await readApplicationPayload(connection, applicationId);
    if (!current) {
      return res.status(404).json({ error: 'Application not found' });
    }
    const currentVersionNumber = Number(current.row.version || 1);
    if (versionId === 'current') {
      return res.json({
        id: null,
        applicationId,
        version: currentVersionNumber,
        payload: current.payload,
        changeSummary: null,
        savedById: null,
        savedBy: null,
        restoredFromVersion: null,
        savedAt: current.row.updated_at || current.row.created_at,
        isCurrent: true
      });
    }
    const numericId = Number(versionId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return res.status(400).json({ error: 'invalid_version_id' });
    }
    await ensureApplicationVersionTable();
    const [[versionRow]] = await connection.query(
      'SELECT id, application_id, version, payload_json, change_summary, created_by_id, created_by_name, restored_from_version, created_at FROM iset_application_version WHERE id = ? AND application_id = ? LIMIT 1',
      [numericId, applicationId]
    );
    if (!versionRow) {
      return res.status(404).json({ error: 'Version not found' });
    }
    let payload = versionRow.payload_json;
    if (payload && typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }
    res.json({
      id: versionRow.id,
      applicationId,
      version: Number(versionRow.version),
      payload: payload || {},
      changeSummary: versionRow.change_summary || null,
      savedById: versionRow.created_by_id || null,
      savedBy: versionRow.created_by_name || null,
      restoredFromVersion: versionRow.restored_from_version === null ? null : Number(versionRow.restored_from_version),
      savedAt: versionRow.created_at,
      isCurrent: Number(versionRow.version) === currentVersionNumber
    });
  } catch (error) {
    console.error('Error reading application version:', error);
    res.status(500).json({ error: 'Failed to load application version' });
  } finally {
    connection.release();
  }
});

app.post('/api/consent-letter/pdf', async (req, res) => {
  const { applicationId, consentSigned, consentSignedName, consentSignedAt } = req.body || {};
  if (!applicationId) {
    return res.status(400).json({ error: 'applicationId is required' });
  }

  const signed = Boolean(consentSigned);
  const signatureName = signed ? (consentSignedName || 'Not provided') : 'Not signed';
  const signedOnDisplay = signed ? formatConsentDate(consentSignedAt) : 'Not signed';
  const logoDataUri = getConsentLogoDataUri();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Client EI Consent</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #1b1b1b; margin: 40px; line-height: 1.5; }
    h1 { text-align: center; font-size: 24px; margin-bottom: 12px; }
    h2 { font-size: 18px; margin-top: 32px; }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo img { max-height: 80px; width: auto; }
    .signature-box { border: 1px solid #9ba7b6; border-radius: 6px; padding: 16px; min-height: 80px; display: flex; align-items: center; font-size: 22px; font-family: 'Segoe Script', 'Lucida Handwriting', cursive; }
    .signature-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .meta { font-size: 14px; color: #374151; }
    .footer { text-align: center; font-size: 12px; color: #6b7280; margin-top: 48px; }
    .paragraph { margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding-right: 16px; }
  </style>
</head>
<body>
  <div class="logo">
    ${logoDataUri ? `<img src="${logoDataUri}" alt="Native Women's Association of Canada logo" />` : ''}
  </div>
  <h1>CLIENT CONSENT FOR EI VERIFICATION</h1>
  ${CONSENT_PARAGRAPHS.map(paragraph => `<p class="paragraph">${escapeHtml(paragraph)}</p>`).join('')}
  <h2>Client acknowledgement</h2>
  <p>I confirm that I have read and understood the above consent and agree to proceed with my application.</p>
  <table style="margin-top: 24px;">
    <tr>
      <td style="width: 50%;">
        <div class="meta"><strong>Client signature</strong></div>
        <div class="signature-box">${escapeHtml(signatureName)}</div>
        <div class="signature-label">Client signature</div>
      </td>
      <td style="width: 50%;">
        <div class="meta"><strong>Signed on</strong></div>
        <div class="meta">${escapeHtml(signedOnDisplay)}</div>
        <div class="signature-label">Electronic consent captured via the ISET intake portal.</div>
      </td>
    </tr>
  </table>
  <div class="footer">NWAC wishes to acknowledge support for this project through the Government of Canada's ISET Program.</div>
</body>
</html>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '25mm', bottom: '25mm', left: '20mm', right: '20mm' }
    });
    await page.close();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="client-ei-consent-${applicationId}.pdf"`);
    return res.end(pdfBuffer);
  } catch (err) {
    console.error('[consent-pdf] failed to generate PDF:', err);
    return res.status(500).json({ error: 'Unable to generate consent PDF' });
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
});

app.post('/api/applications/:id/versions', async (req, res) => {
  const applicationId = Number(req.params.id);
  const { answers, changeSummary, expectedRowVersion } = req.body || {};
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({ error: 'invalid_application_id' });
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return res.status(400).json({ error: 'invalid_answers' });
  }
  const expectedRowVersionNumber = Number(expectedRowVersion);
  if (!Number.isInteger(expectedRowVersionNumber) || expectedRowVersionNumber <= 0) {
    return res.status(400).json({ error: 'invalid_expected_row_version' });
  }
  const lockConfig = await readLockConfig();
  const connection = await pool.getConnection();
  let currentRowVersion = null;
  let lockCheck = { ok: true, reason: 'not_checked', lock: null };
  try {
    await connection.beginTransaction();
    lockCheck = await enforceApplicationLock(connection, applicationId, req, lockConfig);
    if (!lockCheck.ok) {
      await connection.rollback();
      return res.status(423).json({
        error: lockCheck.reason === 'missing' || lockCheck.reason === 'expired'
          ? 'lock_required'
          : (lockCheck.reason === 'identity_missing' ? 'lock_identity_missing' : 'locked'),
        reason: lockCheck.reason,
        currentRowVersion: null,
        lock: lockCheck.lock || null
      });
    }
    const actor = resolveRequestActor(req);
    const summaryText = typeof changeSummary === 'string' ? changeSummary.trim() : '';
    const actorMeta = {
      actorId: actor.actorId || null,
      actorName: actor.actorName || null,
      changeSummary: summaryText ? summaryText.slice(0, 1000) : null
    };
    const current = await readApplicationPayload(connection, applicationId);
    if (!current) {
      await connection.rollback();
      return res.status(404).json({ error: 'Application not found' });
    }
    currentRowVersion = Number(current.row.row_version || 1);
    if (currentRowVersion !== expectedRowVersionNumber) {
      await connection.rollback();
      return res.status(409).json({ error: 'row_version_conflict', currentRowVersion });
    }
    const currentVersionNumber = Number(current.row.version || 1);
    const originalPayload = clonePayload(current.payload);
    const updatedPayload = clonePayload(current.payload);
    const newAnswers = sanitiseAnswersPayload(answers);
    const existingAnswers = updatedPayload.answers && typeof updatedPayload.answers === 'object'
      ? { ...updatedPayload.answers }
      : {};
    updatedPayload.answers = existingAnswers;
    Object.assign(updatedPayload.answers, newAnswers);

    await ensureVersionSnapshotExists(connection, applicationId, currentVersionNumber, originalPayload, null);
    const highestVersion = await getHighestApplicationVersion(connection, applicationId, currentVersionNumber);
    const nextVersion = highestVersion + 1;

    const [updateResult] = await connection.query(
      'UPDATE iset_application SET payload_json = ?, version = ?, updated_at = NOW(), row_version = row_version + 1 WHERE id = ? AND row_version = ?',
      [JSON.stringify(updatedPayload), nextVersion, applicationId, currentRowVersion]
    );
    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'row_version_conflict', currentRowVersion, lock: lockCheck.lock || null });
    }

    try {
      await insertNewVersionEntry(connection, applicationId, nextVersion, updatedPayload, actorMeta);
    } catch (insertErr) {
      if (insertErr?.code === 'ER_DUP_ENTRY') {
        await connection.rollback();
        return res.status(409).json({
          error: 'row_version_conflict',
          currentRowVersion: currentRowVersion + 1,
          lock: lockCheck.lock || null
        });
      }
      throw insertErr;
    }

    await connection.commit();
    res.status(200).json({
      applicationId,
      version: nextVersion,
      rowVersion: currentRowVersion + 1,
      lock: lockCheck.lock || null
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error saving application version:', error);
    res.status(500).json({ error: 'Failed to save application version', lock: lockCheck.lock || null });
  } finally {
    connection.release();
  }
});

app.post('/api/applications/:id/versions/:versionId/restore', async (req, res) => {
  const applicationId = Number(req.params.id);
  const { versionId } = req.params;
  const { expectedRowVersion } = req.body || {};
  if (!Number.isInteger(applicationId) || applicationId <= 0) {
    return res.status(400).json({ error: 'invalid_application_id' });
  }
  const numericId = Number(versionId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json({ error: 'invalid_version_id' });
  }
  const expectedRowVersionNumber = Number(expectedRowVersion);
  if (!Number.isInteger(expectedRowVersionNumber) || expectedRowVersionNumber <= 0) {
    return res.status(400).json({ error: 'invalid_expected_row_version' });
  }
  const lockConfig = await readLockConfig();
  const connection = await pool.getConnection();
  let currentRowVersion = null;
  let lockCheck = { ok: true, reason: 'not_checked', lock: null };
  try {
    await connection.beginTransaction();
    const current = await readApplicationPayload(connection, applicationId);
    if (!current) {
      await connection.rollback();
      return res.status(404).json({ error: 'Application not found', lock: null });
    }
    currentRowVersion = Number(current.row.row_version || 1);
    lockCheck = await enforceApplicationLock(connection, applicationId, req, lockConfig);
    if (!lockCheck.ok) {
      await connection.rollback();
      return res.status(423).json({
        error: lockCheck.reason === 'missing' || lockCheck.reason === 'expired'
          ? 'lock_required'
          : (lockCheck.reason === 'identity_missing' ? 'lock_identity_missing' : 'locked'),
        reason: lockCheck.reason,
        lock: lockCheck.lock || null
      });
    }
    if (currentRowVersion !== expectedRowVersionNumber) {
      await connection.rollback();
      return res.status(409).json({ error: 'row_version_conflict', currentRowVersion, lock: lockCheck.lock || null });
    }
    await ensureApplicationVersionTable();
    const [[versionRow]] = await connection.query(
      'SELECT id, application_id, version, payload_json, change_summary, created_by_id, created_by_name, restored_from_version, created_at FROM iset_application_version WHERE id = ? AND application_id = ? LIMIT 1',
      [numericId, applicationId]
    );
    if (!versionRow) {
      await connection.rollback();
      return res.status(404).json({ error: 'Version not found' });
    }
    const currentVersionNumber = Number(current.row.version || 1);
    const targetVersionNumber = Number(versionRow.version);
    if (targetVersionNumber >= currentVersionNumber) {
      await connection.rollback();
      return res.status(400).json({ error: 'Only earlier versions can be restored', code: 'cannot_restore_non_earlier_version' });
    }
    let payload = versionRow.payload_json;
    if (payload && typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }
    if (!payload || typeof payload !== 'object') {
      payload = {};
    }
    const currentPayloadClone = clonePayload(current.payload);
    await ensureVersionSnapshotExists(connection, applicationId, currentVersionNumber, currentPayloadClone, null);
    const [restoreResult] = await connection.query(
      'UPDATE iset_application SET payload_json = ?, version = ?, updated_at = NOW(), row_version = row_version + 1 WHERE id = ? AND row_version = ?',
      [JSON.stringify(payload || {}), targetVersionNumber, applicationId, currentRowVersion]
    );
    if (restoreResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'row_version_conflict', currentRowVersion, lock: lockCheck.lock || null });
    }
    await connection.commit();
    res.status(200).json({
      applicationId,
      version: targetVersionNumber,
      restoredFromVersion: currentVersionNumber,
      rowVersion: currentRowVersion + 1,
      lock: lockCheck.lock || null
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error restoring application version:', error);
    res.status(500).json({ error: 'Failed to restore application version', lock: lockCheck.lock || null });
  } finally {
    connection.release();
  }
});

// Fallback all non-API requests to the SPA entry point so client routing works in test/prod
if (fs.existsSync(buildDir)) {
  app.get('*', (req, res, next) => {
    const pathLower = (req.path || '').toLowerCase();
    if (pathLower.startsWith('/api') || pathLower.startsWith('/healthz') || pathLower.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(buildDir, 'index.html'));
  });
}

// Serve uploaded files statically for document viewing (corrected path)
app.use('/uploads', express.static('X:/ISET/ISET-intake/uploads'));

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`CORS allowed origin: ${corsOptions.origin}`);
});

// Get all events for a specific case (with user name, event type label, and alert variant)
app.get('/api/cases/:case_id/events', async (req, res) => {
  const caseId = Number(req.params.case_id);
  if (!Number.isInteger(caseId)) {
    return res.status(400).json({ error: 'invalid_case_id' });
  }
  try {
    const { actorId } = resolveRequestActor(req);
    const limitParam = Number(req.query.limit);
    const offsetParam = Number(req.query.offset);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

    const typeFilter = parseListQueryParam(req.query.type ?? req.query.types ?? req.query.event_type ?? req.query.eventType);
    const categoryFilter = parseListQueryParam(req.query.category ?? req.query.categories ?? req.query.event_category ?? req.query.eventCategory);

    const sinceMeta = parseDateQueryParam(req.query.since ?? req.query.after ?? req.query.from);
    if (sinceMeta.provided && !sinceMeta.value) {
      return res.status(400).json({ error: 'invalid_since' });
    }
    const untilMeta = parseDateQueryParam(req.query.until ?? req.query.before ?? req.query.to);
    if (untilMeta.provided && !untilMeta.value) {
      return res.status(400).json({ error: 'invalid_until' });
    }

    const items = await getCaseEvents({
      caseId,
      requesterId: actorId,
      limit,
      offset,
      types: typeFilter,
      categories: categoryFilter,
      since: sinceMeta.value,
      until: untilMeta.value,
    });
    console.log('[events] case timeline', caseId, items.length);
    res.json(items);
  } catch (error) {
    console.error('[events] failed to load case timeline', error);
    res.status(500).json({ error: 'case_events_fetch_failed', message: error.message });
  }
});

// --- Unified Applications Listing Endpoint ----------------------------------
// GET /api/applications?status=Open,In%20Review&limit=50&offset=0
// Role scoping rules (no client override):
//   Program Administrator -> all cases
//   Regional Coordinator  -> cases in their region/team (derivation TBD: using evaluator_ptma join as proxy)
//   Application Assessor  -> only cases assigned to them
// If a submission exists with no case yet:
//   - Visible only to Program Administrators (future) ??? currently excluded for simplicity
// Response: { count, rows:[ { case_id, tracking_id, applicant_name, status, assigned_user_id, assigned_user_name, submitted_at, region, ptma_codes, sla_risk } ] }
app.get('/api/applications', async (req, res) => {
  try {
    if (!req.auth || req.auth.subjectType !== 'staff') return res.status(403).json({ error: 'forbidden' });
    const { status, limit = 50, offset = 0, search } = req.query;
    const role = req.auth.role;
    const regionId = req.auth.regionId || req.staffProfile?.region_id || null;

    // Base case + application join using new lean model.
    // Assignment user now from staff_profiles (nullable); tracking_id fallback derived from payload_json->submission_snapshot.reference_number if tracking_id column absent.
    // We'll attempt to select a.tracking_id; if schema lacks it, COALESCE will choose JSON extracted value.
    let baseSql = `SELECT c.id AS case_id, c.application_id, c.status AS case_status, a.status AS application_status, c.assigned_to_user_id,
      c.created_at AS opened_at, c.updated_at AS last_activity_at,
      sp.email AS assigned_user_email, sp.primary_role AS assigned_user_role,
      sp.id AS staff_profile_id,
      al.owner_user_id AS lock_owner_id,
      al.owner_display_name AS lock_owner_name,
      al.owner_email AS lock_owner_email,
      al.expires_at AS lock_expires_at,
      JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS tracking_id,
      a.created_at AS submitted_at,
      JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."preferred-name"')) AS preferred_name,
      JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."first-name"')) AS applicant_first_name,
      JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."last-name"')) AS applicant_last_name,
      JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.full_name')) AS applicant_full_name,
      JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.first_name')) AS applicant_personal_first_name,
      JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.last_name')) AS applicant_personal_last_name,
      JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$."preferred-name"')) AS submission_preferred_name,
      JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$."first-name"')) AS submission_first_name,
      JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$."last-name"')) AS submission_last_name,
      0 AS is_unassigned_submission
      FROM iset_case c
      JOIN iset_application a ON c.application_id = a.id
      LEFT JOIN iset_application_submission ias ON ias.id = a.submission_id
      LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id
      LEFT JOIN application_lock al ON al.application_id = c.application_id AND al.expires_at > NOW()`;

    const where = [];
    const params = [];
    if (status) {
      const list = String(status).split(',').map(s => s.trim()).filter(Boolean);
      if (list.length) { where.push(`c.status IN (${list.map(()=>'?').join(',')})`); params.push(...list); }
    }
    if (search) {
      const term = `%${search}%`;
  where.push("(JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) LIKE ? OR sp.email LIKE ? OR c.case_summary LIKE ?)");
      params.push(term, term, term);
    }

    if (role === 'Application Assessor') {
      if (!req.staffProfile?.id) return res.json({ count: 0, rows: [] });
      where.push('c.assigned_to_user_id = ?'); params.push(req.staffProfile.id);
    } else if (role === 'Regional Coordinator') {
      // For now: filter by shared region (when regionId present) OR assignments directly to coordinator
      if (regionId) {
        where.push('(sp.region_id = ? OR c.assigned_to_user_id = ?)');
        params.push(regionId, req.staffProfile?.id || 0);
      } else if (req.staffProfile?.id) {
        where.push('c.assigned_to_user_id = ?'); params.push(req.staffProfile.id);
      } else {
        return res.json({ count: 0, rows: [] });
      }
    } else if (role === 'System Administrator' || role === 'Program Administrator') {
      // full access
    } else {
      return res.status(403).json({ error: 'forbidden_role' });
    }

    if (where.length) baseSql += '\nWHERE ' + where.join(' AND ');
    baseSql += '\nGROUP BY c.id';

    let finalSql = baseSql;
    const finalParams = [...params];

    // Add unassigned submissions (applications without case) for elevated roles.
    if (role === 'Program Administrator' || role === 'System Administrator') {
      finalSql = `(${baseSql})\nUNION ALL\n(
        SELECT NULL AS case_id, a.id AS application_id, 'New' AS case_status, a.status AS application_status, NULL AS assigned_to_user_id, NULL AS opened_at, NULL AS last_activity_at,
        NULL AS assigned_user_email, NULL AS assigned_user_role, NULL AS staff_profile_id,
        NULL AS lock_owner_id, NULL AS lock_owner_name, NULL AS lock_owner_email, NULL AS lock_expires_at,
  JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS tracking_id,
        a.created_at AS submitted_at,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."preferred-name"')) AS preferred_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."first-name"')) AS applicant_first_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."last-name"')) AS applicant_last_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.full_name')) AS applicant_full_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.first_name')) AS applicant_personal_first_name,
        JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.personal.last_name')) AS applicant_personal_last_name,
        JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$."preferred-name"')) AS submission_preferred_name,
        JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$."first-name"')) AS submission_first_name,
        JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$."last-name"')) AS submission_last_name,
        1 AS is_unassigned_submission
        FROM iset_application a
        LEFT JOIN iset_application_submission ias ON ias.id = a.submission_id
        LEFT JOIN iset_case c2 ON c2.application_id = a.id
        WHERE c2.id IS NULL
      )`;
    }

    finalSql += `\nORDER BY submitted_at DESC\nLIMIT ? OFFSET ?`;
    finalParams.push(Number(limit), Number(offset));

    const [rows] = await pool.query(finalSql, finalParams);

    // Count
    let count = rows.length;
    try {
      if (role === 'Program Administrator' || role === 'System Administrator') {
        let countCaseSql = 'SELECT COUNT(DISTINCT c.id) AS cnt FROM iset_case c JOIN iset_application a ON c.application_id = a.id LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id';
        if (where.length) countCaseSql += ' WHERE ' + where.join(' AND ');
        const [[caseCnt]] = await pool.query(countCaseSql, params);
        const [[unassignedCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM iset_application a LEFT JOIN iset_case c2 ON c2.application_id = a.id WHERE c2.id IS NULL');
        count = (caseCnt?.cnt || 0) + (unassignedCnt?.cnt || 0);
      } else {
        let countSql = 'SELECT COUNT(DISTINCT c.id) AS cnt FROM iset_case c JOIN iset_application a ON c.application_id = a.id LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id';
        if (where.length) countSql += ' WHERE ' + where.join(' AND ');
        const [[cRow]] = await pool.query(countSql, params);
        if (cRow && typeof cRow.cnt === 'number') count = cRow.cnt;
      }
    } catch (_) {}

    const now = Date.now();
    const rowsOut = rows.map(r => {
      const submittedMs = r.submitted_at ? new Date(r.submitted_at).getTime() : now;
      const ageDays = (now - submittedMs) / 86400000;
      const caseStatus = r.case_status || null;
      const appStatus = r.application_status || null;
      const sla_risk = (caseStatus !== 'Closed' && caseStatus !== 'Rejected' && ageDays > 14) ? 'overdue' : 'ok';
      const lockOwnerId = r.lock_owner_id || null;
      const lockOwnerName = r.lock_owner_name || null;
      const lockOwnerEmail = r.lock_owner_email || null;
      const preferredName = normaliseString(r.preferred_name) ||
        normaliseString(r.submission_preferred_name);
      const firstName = normaliseString(r.applicant_first_name) ||
        normaliseString(r.submission_first_name) ||
        normaliseString(r.applicant_personal_first_name);
      const lastName = normaliseString(r.applicant_last_name) ||
        normaliseString(r.submission_last_name) ||
        normaliseString(r.applicant_personal_last_name);
      const fallbackFullName = normaliseString(r.applicant_full_name);
      const combined = [firstName, lastName].filter(Boolean).join(' ').trim();
      let applicantName = combined.length ? combined : null;
      if (!applicantName) {
        applicantName = preferredName;
      }
      if (!applicantName) {
        applicantName = fallbackFullName;
      }
      return {
        case_id: r.case_id,
        application_id: r.application_id,
        tracking_id: r.tracking_id,
        status: caseStatus,
        case_status: caseStatus,
        application_status: appStatus,
        assigned_user_id: r.assigned_to_user_id,
        assigned_user_email: r.assigned_user_email || null,
        assigned_user_role: r.assigned_user_role || null,
        submitted_at: r.submitted_at,
        ptma_codes: null, // legacy field removed; placeholder for future taxonomy
        region: null, // region derivation TBD (could parse from application payload or staff profile)
        is_unassigned: r.is_unassigned_submission === 1,
        sla_risk,
        lock_owner_id: lockOwnerId,
        lock_owner_name: lockOwnerName,
        lock_owner_email: lockOwnerEmail,
        lock_expires_at: r.lock_expires_at || null,
        is_locked: Boolean(lockOwnerId),
        applicant_name: applicantName
      };
    });
    res.json({ count, rows: rowsOut });
  } catch (e) {
    console.error('GET /api/applications failed:', e);
    res.status(500).json({ error: 'applications_fetch_failed', message: e.message });
  }
});


/**
 * POST /api/purge-cases
 *
 * Clears case-related tables (documents, notes, tasks) and wipes the event store before removing cases.
 * Used for demo reset purposes only.
 */
app.post('/api/purge-cases', async (req, res) => {
  try {
    // Delete from child tables first due to foreign key constraints
    await deleteTableIfExists('iset_case_document');
    await deleteTableIfExists('iset_case_note');
    await deleteTableIfExists('iset_case_task');
    await deleteTableIfExists('iset_event_receipt');
    await deleteTableIfExists('iset_event_outbox');
    await deleteTableIfExists('iset_event_entry');
    await deleteTableIfExists('iset_case');
    res.status(200).json({ message: 'All cases and related data purged.' });
  } catch (error) {
    console.error('Error purging cases:', error);
    res.status(500).json({ error: 'Failed to purge cases' });
  }
});

// Purge all applications, drafts, and files (for demo reset)
app.post('/api/purge-applications', async (req, res) => {
  try {
    // Delete from child tables first to avoid FK constraint errors
    await pool.query('DELETE FROM iset_application_file');
    await pool.query('DELETE FROM iset_application_draft');
    await pool.query('DELETE FROM iset_application');
    res.status(200).json({ message: 'All applications, drafts, and files have been deleted.' });
  } catch (error) {
    console.error('Error purging applications:', error);
    res.status(500).json({ error: 'Failed to purge applications.' });
  }
});


// Endpoint to get the content of a .njk file
app.get('/api/get-njk-file', (req, res) => {
  const templatePath = req.query.template_path;
  const filePath = path.join(__dirname, templatePath); // Corrected path

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading .njk file:', err);
      return res.status(500).send('Error reading .njk file');
    }
    res.send(data);
  });
});

//This is probably safe to remove. It was from when I stoed jsons, not nunjucks.
app.get('/api/blockstep-json', (req, res) => {
  const { config_path } = req.query;

  if (!config_path) {
    console.error('config_path query parameter is required'); // Add logging
    return res.status(400).json({ error: 'config_path query parameter is required' });
  }

  const filePath = path.join(__dirname, config_path);
  console.log('Reading BlockStep JSON from:', filePath); // Add logging

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading BlockStep JSON:', err); // Add logging
      return res.status(500).json({ error: 'Failed to load BlockStep JSON' });
    }

    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      console.error('Error parsing JSON file:', parseError); // Add logging
      res.status(500).json({ error: 'Invalid JSON format' });
    }
  });
});

app.post('/api/generate-static-njk-template', (req, res) => {
  const { components } = req.body;

  if (!Array.isArray(components)) {
    return res.status(400).json({ error: 'Missing or invalid components array' });
  }

  const flattenProps = (obj, prefix = '') => {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        Object.assign(acc, flattenProps(value, path));
      } else {
        acc[path] = value;
      }
      return acc;
    }, {});
  };

  try {
    const rendered = components.map((component) => {
      const mergedProps = {
        ...component.props,
        ...component.props?.props
      };

      const templateBeforeInjection = component.nunjucks_template || '';
      let template = templateBeforeInjection;

      const shouldInjectAttributes =
        mergedProps.mode === 'dynamic' &&
        mergedProps.endpoint &&
        !template.includes('attributes:');

      if (shouldInjectAttributes) {
        const match = template.match(/(govukRadios|govukSelect|govukCheckboxes)\s*\(\s*{([\s\S]*?)\}\s*\)/);
        if (match) {
          const componentName = match[1];
          const innerProps = match[2];

          const injectedValue = JSON.stringify(
            { 'data-options-endpoint': mergedProps.endpoint },
            null,
            2
          ).replace(/^/gm, '  '); // indent for Nunjucks readability

          const insertion = `attributes: ${injectedValue},\n`;
          const modifiedInner = insertion + innerProps;

          template = template.replace(innerProps, modifiedInner);
        }
      }

      const flatProps = flattenProps(mergedProps);

      for (const [path, value] of Object.entries(flatProps)) {
        const pattern = new RegExp(`props\\.${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');

        let stringified;
        if (value === undefined || value === null) {
          stringified = '';
        } else if (typeof value === 'string') {
          stringified = `"${value}"`;
        } else if (Array.isArray(value) || typeof value === 'object') {
          stringified = JSON.stringify(value, null, 2);
        } else {
          stringified = String(value);
        }

        template = template.replace(pattern, stringified);
      }

      template = template.replace(/,\s*([}\]])/g, '$1');

      return template;
    });

    const output = rendered.filter(Boolean).join('\n\n');
    res.send(output);
  } catch (err) {
    console.error('Error generating static Nunjucks template:', err);
    res.status(500).json({ error: 'Failed to generate static Nunjucks template' });
  }
});

app.post('/api/save-blockstep-json', (req, res) => {
  const { json_path, content } = req.body;

  if (!json_path || !content) {
    return res.status(400).json({ message: 'Missing json_path or content' });
  }

  const fullPath = path.join(__dirname, json_path);

  fs.writeFile(fullPath, content, 'utf8', (err) => {
    if (err) {
      console.error('Error saving JSON file:', err);
      return res.status(500).json({ message: 'Failed to save JSON file' });
    }

    res.status(200).json({ message: 'JSON file saved successfully' });
  });
});


// Endpoint to save the content of a .njk file
app.post('/api/save-njk-file', (req, res) => {
  const templatePath = req.body.template_path;
  const content = req.body.content;
  const filePath = path.join(__dirname, templatePath); // Corrected path

  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (err) {
      console.error('Error saving .njk file:', err);
      return res.status(500).send('Error saving .njk file');
    }
    res.send('File saved successfully');
  });
});

// Endpoint to fetch all components
app.get('/api/govuk-components', async (req, res) => {
  try {
    const [components] = await pool.query('SELECT * FROM govuk_component');
    res.status(200).json(components);
  } catch (error) {
    console.error('Error fetching components:', error);
    res.status(500).json({ message: 'Failed to fetch components' });
  }
});

// Endpoint to fetch a single component by ID
app.get('/api/govuk-components/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [components] = await pool.query('SELECT * FROM govuk_component WHERE id = ?', [id]);
    if (components.length === 0) {
      return res.status(404).json({ message: 'Component not found' });
    }
    res.status(200).json(components[0]);
  } catch (error) {
    console.error('Error fetching component:', error);
    res.status(500).json({ message: 'Failed to fetch component' });
  }
});

// Endpoint to create a new component
app.post('/api/govuk-components', async (req, res) => {
  const { type, label, props } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO govuk_component (type, label, props) VALUES (?, ?, ?)', [type, label, JSON.stringify(props)]);
    res.status(201).json({ id: result.insertId, type, label, props });
  } catch (error) {
    console.error('Error creating component:', error);
    res.status(500).json({ message: 'Failed to create component' });
  }
});

// Endpoint to update an existing component
app.put('/api/govuk-components/:id', async (req, res) => {
  const { id } = req.params;
  const { type, label, props } = req.body;
  try {
    await pool.query('UPDATE govuk_component SET type = ?, label = ?, props = ? WHERE id = ?', [type, label, JSON.stringify(props), id]);
    res.status(200).json({ id, type, label, props });
  } catch (error) {
    console.error('Error updating component:', error);
    res.status(500).json({ message: 'Failed to update component' });
  }
});

// Endpoint to delete a component
app.delete('/api/govuk-components/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM govuk_component WHERE id = ?', [id]);
    res.status(200).json({ message: 'Component deleted successfully' });
  } catch (error) {
    console.error('Error deleting component:', error);
    res.status(500).json({ message: 'Failed to delete component' });
  }
});

app.get('/api/load-blockstep-json', (req, res) => {
  const { path: jsonPath } = req.query;

  if (!jsonPath) {
    return res.status(400).json({ message: 'Missing path parameter' });
  }

  const fullPath = path.join(__dirname, jsonPath);

  fs.readFile(fullPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading JSON file:', err.message);
      return res.status(500).json({ message: 'Failed to read JSON file' });
    }

    try {
      const jsonData = JSON.parse(data);
      res.status(200).json(jsonData);
    } catch (parseErr) {
      console.error('Invalid JSON format:', parseErr.message);
      res.status(500).json({ message: 'Invalid JSON format' });
    }
  });
});

app.post('/api/render-njk', (req, res) => {
  const { template, props } = req.body;

  if (!template || typeof template !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid template' });
  }

  try {
    const renderedHtml = nunjucks.renderString(template, { props });
    res.send(renderedHtml);
  } catch (err) {
    console.error('Nunjucks render error:', err);
    res.status(500).json({ error: 'Failed to render Nunjucks template' });
  }
});

app.get('/api/admin/messages/:id/attachments', async (req, res) => {
  const messageId = req.params.id;
  const caseIdFromQuery = req.query.case_id ? parseInt(req.query.case_id, 10) : null;
  try {
    // Get all attachments for this message
    const [attachments] = await pool.query(
      `SELECT id, message_id, file_path, original_filename, uploaded_at, user_id, application_id
       FROM message_attachment
      
       WHERE message_id = ?
       ORDER BY uploaded_at ASC`,
      [messageId]
    );

    // Get the message to determine sender/recipient
    const [[message]] = await pool.query(
      `SELECT * FROM messages WHERE id = ?`,
      [messageId]
    );
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    let caseId = caseIdFromQuery;
    let caseApplicationId = null;
    let applicantUserId = null;

    if (caseId) {
      try {
        const [[caseRow]] = await pool.query(
          'SELECT application_id FROM iset_case WHERE id = ? LIMIT 1',
          [caseId]
        );
        if (caseRow && caseRow.application_id) {
          caseApplicationId = caseRow.application_id;
          const [[appRow]] = await pool.query(
            'SELECT user_id FROM iset_application WHERE id = ? LIMIT 1',
            [caseRow.application_id]
          );
          if (appRow && appRow.user_id) {
            applicantUserId = appRow.user_id;
          }
        }
      } catch (err) {
        console.warn('[admin:attachments] failed to resolve application for case %s: %s', caseId, err.message);
      }
    }

    const resolvedApplicationId = caseApplicationId || message.application_id || null;
    if (!applicantUserId) {
      applicantUserId =
        message.applicant_user_id ||
        message.applicantUserId ||
        message.sender_id ||
        message.recipient_id ||
        null;
    }

    if (caseId) {
      for (const att of attachments) {
        const docApplicantUserId =
          applicantUserId ||
          att.applicant_user_id ||
          att.user_id ||
          message.sender_id ||
          message.recipient_id ||
          null;
        const docUserId = att.user_id || message.sender_id || message.recipient_id || null;

        let relativeFilePath = att.file_path.replace(/\\/g, '/');
        const uploadsIndex = relativeFilePath.lastIndexOf('uploads/');
        if (uploadsIndex !== -1) {
          relativeFilePath = relativeFilePath.substring(uploadsIndex);
        }
        relativeFilePath = relativeFilePath.replace(/\\/g, '/');

        let createdAt = att.uploaded_at ? new Date(att.uploaded_at) : new Date();
        if (Number.isNaN(createdAt.getTime())) {
          createdAt = new Date();
        }

        try {
          await pool.query(
            `INSERT INTO iset_document (case_id, application_id, applicant_user_id, user_id, origin_message_id, source, file_name, file_path, label, created_at)
             VALUES (?, ?, ?, ?, ?, 'secure_message_attachment', ?, ?, 'Secure Message Attachment', ?)
             ON DUPLICATE KEY UPDATE applicant_user_id = VALUES(applicant_user_id), application_id = VALUES(application_id), user_id = VALUES(user_id), origin_message_id = VALUES(origin_message_id), updated_at = NOW()` ,
            [
              caseId,
              resolvedApplicationId,
              docApplicantUserId,
              docUserId,
              messageId,
              att.original_filename || 'Attachment',
              relativeFilePath,
              createdAt
            ]
          );
        } catch (err) {
          if (err && (err.code === 'ER_DUP_ENTRY' || err.code === '23505')) {
            continue;
          } else {
            console.error('Error inserting into iset_document:', err);
            throw err;
          }
        }
      }
    }

    res.status(200).json(attachments);
  } catch (error) {
    console.error('Error fetching message attachments:', error);
    res.status(500).json({ error: 'Failed to fetch message attachments' });
  }
});

// Hard delete a message and its attachments
app.delete('/api/admin/messages/:id/hard-delete', async (req, res) => {
  const messageId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Delete attachments first
    await conn.query('DELETE FROM message_attachment WHERE message_id = ?', [messageId]);
    // Delete the message
    const [result] = await conn.query('DELETE FROM messages WHERE id = ?', [messageId]);
    await conn.commit();
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Message not found' });
    } else {
      res.status(200).json({ message: 'Message and attachments deleted' });
    }
  } catch (error) {
    await conn.rollback();
    console.error('Error hard deleting message:', error);
    res.status(500).json({ error: 'Failed to hard delete message' });
  } finally {
    conn.release();
  }
});

// Update assessment fields for a case
app.put('/api/cases/:id', async (req, res) => {
  const caseId = Number(req.params.id);
  if (!Number.isInteger(caseId)) {
    return res.status(400).json({ success: false, error: 'Invalid case id', lock: null });
  }

  const body = req.body || {};
  const identity = getRequesterIdentity(req);
  const expectedRowVersionRaw = body.expectedApplicationRowVersion ?? body.expectedRowVersion;
  let expectedRowVersionNumber = null;
  if (expectedRowVersionRaw !== undefined) {
    expectedRowVersionNumber = Number(expectedRowVersionRaw);
    if (!Number.isInteger(expectedRowVersionNumber) || expectedRowVersionNumber <= 0) {
      return res.status(400).json({ success: false, error: 'invalid_expected_row_version', lock: null });
    }
  }

  const lockConfig = await readLockConfig();
  const toNull = v => (v === undefined || v === null || v === '' ? null : v);
  const toJsonValue = (val, fallback) => {
    if (typeof val === 'undefined') return undefined;
    if (val === null) return null;
    try { return JSON.stringify(val); } catch { return JSON.stringify(fallback); }
  };
  const toTinyInt = (val) => {
    if (typeof val === 'undefined') return undefined;
    if (val === null || val === '') return null;
    const str = String(val).trim().toLowerCase();
    if (['1','true','yes','y','on'].includes(str)) return 1;
    if (['0','false','no','n','off'].includes(str)) return 0;
    return null;
  };
  const toNumericRange = (val, { min = 0, max = null, stripNonDigits = true } = {}) => {
    if (typeof val === 'undefined') return undefined;
    if (val === null || val === '') return null;
    let str = String(val).trim();
    if (stripNonDigits) {
      str = str.replace(/[^\d-]/g, '');
    }
    if (!str) return null;
    const num = Number.parseInt(str, 10);
    if (!Number.isFinite(num)) return null;
    if (num < min) return null;
    if (max !== null && num > max) return null;
    return num;
  };

  let conn;
  let beforeStatus = null;
  let normalizedStatus;
  let normalizedStatusLower = null;
  let statusChanged = false;
  let bumpApplicationRowVersion = false;
  let newRowVersion = null;
  let applicationId = null;
  let lockCheck = { ok: true, reason: 'not_checked', lock: null };
  let statusToPersist = null;
  let applicationStatusToPersist = null;
  let shouldEnsureClientLink = false;
  let shouldMarkSubmissionNeedsReview = false;
  let shouldRecomputeCaseStatus = false;
  let autoPlanSuggestion = null;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[existingCase]] = await conn.query(
      `SELECT c.status, c.application_id, c.client_id, c.assigned_to_user_id, a.row_version,
              al.owner_user_id AS lock_owner_user_id,
              al.owner_display_name AS lock_owner_display_name,
              al.owner_email AS lock_owner_email,
              al.expires_at AS lock_expires_at
         FROM iset_case c
         JOIN iset_application a ON a.id = c.application_id
         LEFT JOIN application_lock al ON al.application_id = c.application_id AND al.expires_at > NOW()
        WHERE c.id = ?
        LIMIT 1 FOR UPDATE`,
      [caseId]
    );
    if (!existingCase) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: 'Case not found', lock: null });
    }
    beforeStatus = existingCase.status || null;
    const beforeStatusLower = beforeStatus ? String(beforeStatus).toLowerCase() : null;
    const beforeStatusNormalised = normaliseCaseStatusValue(beforeStatus);
    const beforeClientId = existingCase.client_id || null;
    let ensuredClientId = beforeClientId;
    applicationId = Number(existingCase.application_id);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      applicationId = null;
    }
    const currentApplicationRowVersion = Number(existingCase.row_version || 1);
    newRowVersion = currentApplicationRowVersion;

    lockCheck = await enforceApplicationLock(conn, applicationId, req, lockConfig);
    if (!lockCheck.ok) {
      await conn.rollback();
      return res.status(423).json({
        success: false,
        error: lockCheck.reason === 'missing' || lockCheck.reason === 'expired'
          ? 'lock_required'
          : (lockCheck.reason === 'identity_missing' ? 'lock_identity_missing' : 'locked'),
        reason: lockCheck.reason,
        lock: lockCheck.lock || null
      });
    }
    if (expectedRowVersionNumber !== null && expectedRowVersionNumber !== currentApplicationRowVersion) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        error: 'row_version_conflict',
        currentRowVersion: currentApplicationRowVersion,
        lock: lockCheck.lock || null
      });
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      normalizedStatus = toNull(body.status);
      normalizedStatusLower = normalizedStatus ? String(normalizedStatus).toLowerCase() : null;
      const requestedStatus = normaliseCaseStatusValue(normalizedStatus);

      if (!requestedStatus) {
        await conn.rollback();
        return res.status(422).json({ success: false, error: 'invalid_status', lock: lockCheck.lock || null });
      }

      switch (requestedStatus) {
        case 'approved':
        case 'initiated':
          statusToPersist = CASE_STATUS_DERIVED_VALUES.initiated;
          break;
        case 'pending':
        case 'pending_approval':
        case 'open':
        case 'submitted':
        case 'in_review':
          statusToPersist = CASE_STATUS_DERIVED_VALUES.pendingApproval;
          break;
        case 'active':
          statusToPersist = CASE_STATUS_DERIVED_VALUES.active;
          break;
        case 'dormant':
          statusToPersist = CASE_STATUS_DERIVED_VALUES.dormant;
          break;
        case 'ready_to_close':
          statusToPersist = CASE_STATUS_DERIVED_VALUES.readyToClose;
          break;
        case 'closed':
          statusToPersist = CASE_STATUS_DERIVED_VALUES.closed;
          break;
        case 'archived':
          statusToPersist = CASE_STATUS_DERIVED_VALUES.archived;
          break;
        default:
          await conn.rollback();
          return res.status(422).json({ success: false, error: 'unsupported_status', lock: lockCheck.lock || null });
      }

      if (statusToPersist !== beforeStatusNormalised) {
        await conn.query('UPDATE iset_case SET status = ? WHERE id = ?', [statusToPersist, caseId]);
        statusChanged = true;
        bumpApplicationRowVersion = true;
        shouldRecomputeCaseStatus = true;
        if (statusToPersist === CASE_STATUS_DERIVED_VALUES.initiated) {
          shouldEnsureClientLink = true;
        }
        if (beforeStatusNormalised === CASE_STATUS_DERIVED_VALUES.initiated && statusToPersist !== CASE_STATUS_DERIVED_VALUES.initiated) {
          shouldMarkSubmissionNeedsReview = true;
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'applicationStatus')) {
      const rawApplicationStatus = toNull(body.applicationStatus);
      if (rawApplicationStatus) {
        const normalizedAppStatus = normaliseCaseStatusValue(rawApplicationStatus) || String(rawApplicationStatus).trim().toLowerCase();
        if (normalizedAppStatus) {
          applicationStatusToPersist = normalizedAppStatus;
        }
      }
    }

    const assessmentKeys = [
      'assessment_date_of_assessment',
      'assessment_employment_goals',
      'assessment_previous_iset',
      'assessment_previous_iset_details',
      'assessment_employment_barriers',
      'assessment_local_area_priorities',
      'assessment_other_funding_details',
      'assessment_esdc_eligibility',
      'assessment_intervention_start_date',
      'assessment_intervention_end_date',
      'assessment_institution',
      'assessment_program_name',
      'assessment_itp',
      'assessment_wage',
      'assessment_recommendation',
      'assessment_justification',
      'assessment_nwac_review',
      'assessment_nwac_reason',
      'assessment_intervention_code',
      'assessment_intervention_outcome_code',
      'assessment_intervention_duration_days',
      'assessment_intervention_cost_total',
      'assessment_intervention_related_noc',
      'assessment_intervention_related_noc_version',
      'assessment_childcare_need',
      'assessment_childcare_funding_details',
      'assessment_action_plan_result_code',
      'assessment_action_plan_result_date',
      'case_summary'
    ];

    const hasAssessmentPayload = assessmentKeys.some(key => Object.prototype.hasOwnProperty.call(body, key));

    if (hasAssessmentPayload) {
      const insertColumns = ['case_id'];
      const insertValues = [caseId];
      const updateAssignments = [];
      const add = (column, value) => {
        if (typeof value === 'undefined') return;
        insertColumns.push(column);
        insertValues.push(value);
        updateAssignments.push(`${column} = VALUES(${column})`);
      };

      add('date_of_assessment', toNull(body.assessment_date_of_assessment));
      add('overview', toNull(body.case_summary));
      add('employment_goals', toNull(body.assessment_employment_goals));
      add('previous_iset', toTinyInt(body.assessment_previous_iset));
      add('previous_iset_details', toNull(body.assessment_previous_iset_details));
      add('employment_barriers', toJsonValue(body.assessment_employment_barriers ?? null, []));
      add('local_area_priorities', toJsonValue(body.assessment_local_area_priorities ?? null, []));
      add('other_funding_details', toNull(body.assessment_other_funding_details));
      add('esdc_eligibility', toNull(body.assessment_esdc_eligibility));
      add('intervention_start_date', toNull(body.assessment_intervention_start_date));
      add('intervention_end_date', toNull(body.assessment_intervention_end_date));
      add('institution', toNull(body.assessment_institution));
      add('program_name', toNull(body.assessment_program_name));
      add('itp_payload', toJsonValue(body.assessment_itp ?? null, { tuition: '', books: '', materials: '', living: '' }));
      add('wage_payload', toJsonValue(body.assessment_wage ?? null, { wages: '', mercs: '', nonwages: '', other: '' }));
      add('recommendation', toNull(body.assessment_recommendation));
      add('justification', toNull(body.assessment_justification));
      add('nwac_review', toNull(body.assessment_nwac_review));
      add('nwac_reason', toNull(body.assessment_nwac_reason));
      add('intervention_code', toNumericRange(body.assessment_intervention_code, { min: 1, max: 99 }));
      add('intervention_outcome_code', toNumericRange(body.assessment_intervention_outcome_code, { min: 1, max: 99 }));
      add('intervention_duration_days', toNumericRange(body.assessment_intervention_duration_days, { min: 0, max: 999 }));
      add('intervention_cost_total', toNumericRange(body.assessment_intervention_cost_total, { min: 0, max: 999999 }));
      add('intervention_related_noc', toNull(body.assessment_intervention_related_noc));
      add('intervention_related_noc_version', toNull(body.assessment_intervention_related_noc_version));
      add('childcare_need', toTinyInt(body.assessment_childcare_need));
      add('childcare_funding_details', toNull(body.assessment_childcare_funding_details));
      add('action_plan_result_code', toNull(body.assessment_action_plan_result_code));
      add('action_plan_result_date', toNull(body.assessment_action_plan_result_date));

      if (updateAssignments.length) {
        const placeholders = insertColumns.map(() => '?').join(', ');
        const updateClause = updateAssignments.join(', ');
        await conn.query(
          `INSERT INTO iset_case_assessment (${insertColumns.join(', ')}) VALUES (${placeholders})
           ON DUPLICATE KEY UPDATE ${updateClause}`,
          insertValues
        );
        bumpApplicationRowVersion = true;
      }
    }

    const targetStatus = statusToPersist || beforeStatusNormalised;

    if (applicationStatusToPersist === 'approved') {
      const approvalUserId = identity && typeof identity.userId !== 'undefined'
        ? Number(identity.userId)
        : null;
      autoPlanSuggestion = await ensureAutoPlanAndInterventionFromAssessment(conn, {
        caseId,
        caseRow: existingCase,
        approvalUserId: Number.isFinite(approvalUserId) ? approvalUserId : null,
      });
      if (autoPlanSuggestion.createdPlan || autoPlanSuggestion.createdIntervention) {
        shouldRecomputeCaseStatus = true;
      }
    }

    if ((shouldEnsureClientLink || (!ensuredClientId && targetStatus === CASE_STATUS_DERIVED_VALUES.initiated)) && applicationId) {
      ensuredClientId = await ensureCaseClientLinkForApproval(conn, {
        caseId,
        applicationId,
        existingClientId: ensuredClientId
      });
      await ensureEsdcParticipantSubmissionRecord(conn, caseId, applicationId);
    }

    if (hasAssessmentPayload && targetStatus === CASE_STATUS_DERIVED_VALUES.initiated) {
      shouldMarkSubmissionNeedsReview = true;
    }

    if (shouldMarkSubmissionNeedsReview) {
      await markEsdcParticipantSubmissionNeedsReview(conn, caseId, { resetSnapshot: true, resetSubmissionStatus: true });
    }

    if (applicationStatusToPersist && applicationId) {
      await conn.query('UPDATE iset_application SET status = ? WHERE id = ?', [applicationStatusToPersist, applicationId]);
      bumpApplicationRowVersion = true;
    }

    if (bumpApplicationRowVersion) {
      if (!applicationId) {
        await conn.rollback();
        return res.status(500).json({ success: false, error: 'application_missing' });
      }
      const [appUpdate] = await conn.query('UPDATE iset_application SET row_version = row_version + 1 WHERE id = ?', [applicationId]);
      if (!appUpdate.affectedRows) {
        await conn.rollback();
        return res.status(404).json({ success: false, error: 'Application not found' });
      }
      newRowVersion = currentApplicationRowVersion + 1;
    }

    if (shouldRecomputeCaseStatus) {
      await recomputeCaseStatus(caseId, conn);
    }

    await conn.commit();
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
      conn.release();
      conn = null;
    }
    console.error('Error updating assessment:', error);
    return res.status(500).json({ success: false, error: error.message, lock: lockCheck.lock || null });
  } finally {
    if (conn) conn.release();
  }

  try {
    const [[caseRow]] = await pool.query(
      `SELECT c.status, c.application_id,
              COALESCE(s.user_id, JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.user_id'))) AS applicant_user_id,
              COALESCE(s.reference_number, JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number'))) AS tracking_id,
              a.row_version AS application_row_version,
              ca.date_of_assessment,
              ca.overview,
              ca.employment_goals,
              ca.previous_iset,
              ca.previous_iset_details,
              ca.employment_barriers,
              ca.local_area_priorities,
              ca.other_funding_details,
              ca.esdc_eligibility,
              ca.intervention_start_date,
              ca.intervention_end_date,
              ca.institution,
              ca.program_name,
              ca.itp_payload,
              ca.wage_payload,
              ca.recommendation,
              ca.justification,
              ca.nwac_review,
              ca.nwac_reason,
              ca.intervention_code AS assessment_intervention_code,
              ca.intervention_outcome_code AS assessment_intervention_outcome_code,
              ca.intervention_duration_days AS assessment_intervention_duration_days,
              ca.intervention_cost_total AS assessment_intervention_cost_total,
              ca.intervention_related_noc AS assessment_intervention_related_noc,
              ca.intervention_related_noc_version AS assessment_intervention_related_noc_version,
              ca.childcare_need AS assessment_childcare_need,
              ca.childcare_funding_details AS assessment_childcare_funding_details,
              ca.action_plan_result_code AS assessment_action_plan_result_code,
              ca.action_plan_result_date AS assessment_action_plan_result_date
         FROM iset_case c
         JOIN iset_application a ON c.application_id = a.id
         LEFT JOIN iset_application_submission s ON s.id = a.submission_id
         LEFT JOIN iset_case_assessment ca ON ca.case_id = c.id
        WHERE c.id = ?`,
      [caseId]
    );

    try {
      caseRow.assessment_employment_barriers = caseRow.assessment_employment_barriers
        ? (typeof caseRow.assessment_employment_barriers === 'string'
            ? JSON.parse(caseRow.assessment_employment_barriers)
            : caseRow.assessment_employment_barriers)
        : [];
    } catch { caseRow.assessment_employment_barriers = []; }
    try {
      caseRow.assessment_local_area_priorities = caseRow.assessment_local_area_priorities
        ? (typeof caseRow.assessment_local_area_priorities === 'string'
            ? JSON.parse(caseRow.assessment_local_area_priorities)
            : caseRow.assessment_local_area_priorities)
        : [];
    } catch { caseRow.assessment_local_area_priorities = []; }
    try {
      caseRow.assessment_itp = caseRow.assessment_itp
        ? (typeof caseRow.assessment_itp === 'string'
            ? JSON.parse(caseRow.assessment_itp)
            : caseRow.assessment_itp)
        : { tuition: '', books: '', materials: '', living: '' };
    } catch { caseRow.assessment_itp = { tuition: '', books: '', materials: '', living: '' }; }
    try {
      caseRow.assessment_wage = caseRow.assessment_wage
        ? (typeof caseRow.assessment_wage === 'string'
            ? JSON.parse(caseRow.assessment_wage)
            : caseRow.assessment_wage)
        : { wages: '', mercs: '', nonwages: '', other: '' };
    } catch { caseRow.assessment_wage = { wages: '', mercs: '', nonwages: '', other: '' }; }
    if (caseRow.assessment_previous_iset !== null && caseRow.assessment_previous_iset !== undefined) {
      caseRow.assessment_previous_iset = Number(caseRow.assessment_previous_iset);
    }
    if (caseRow.assessment_intervention_code !== null && caseRow.assessment_intervention_code !== undefined) {
      caseRow.assessment_intervention_code = String(caseRow.assessment_intervention_code);
    }
    if (caseRow.assessment_intervention_outcome_code !== null && caseRow.assessment_intervention_outcome_code !== undefined) {
      caseRow.assessment_intervention_outcome_code = String(caseRow.assessment_intervention_outcome_code);
    }
    if (caseRow.assessment_intervention_duration_days !== null && caseRow.assessment_intervention_duration_days !== undefined) {
      const duration = Number(caseRow.assessment_intervention_duration_days);
      caseRow.assessment_intervention_duration_days = Number.isNaN(duration) ? null : String(duration);
    }
    if (caseRow.assessment_intervention_cost_total !== null && caseRow.assessment_intervention_cost_total !== undefined) {
      const cost = Number(caseRow.assessment_intervention_cost_total);
      caseRow.assessment_intervention_cost_total = Number.isNaN(cost) ? null : String(cost);
    }
    if (typeof caseRow.assessment_intervention_related_noc === 'string') {
      caseRow.assessment_intervention_related_noc = caseRow.assessment_intervention_related_noc.trim();
    }
    if (typeof caseRow.assessment_intervention_related_noc_version === 'string') {
      caseRow.assessment_intervention_related_noc_version = caseRow.assessment_intervention_related_noc_version.trim();
    }
    if (caseRow.assessment_childcare_need !== null && caseRow.assessment_childcare_need !== undefined) {
      const need = Number(caseRow.assessment_childcare_need);
      caseRow.assessment_childcare_need = Number.isNaN(need) ? null : (need === 1 ? 'yes' : need === 0 ? 'no' : null);
    }
    if (typeof caseRow.assessment_childcare_funding_details === 'string') {
      caseRow.assessment_childcare_funding_details = caseRow.assessment_childcare_funding_details.trim();
    }
    if (typeof caseRow.assessment_action_plan_result_code === 'string') {
      caseRow.assessment_action_plan_result_code = caseRow.assessment_action_plan_result_code.trim();
    }
    if (caseRow.assessment_action_plan_result_date) {
      const dateValue = caseRow.assessment_action_plan_result_date;
      if (dateValue instanceof Date) {
        caseRow.assessment_action_plan_result_date = Number.isNaN(dateValue.getTime())
          ? null
          : dateValue.toISOString().slice(0, 10);
      } else if (typeof dateValue === 'string') {
        caseRow.assessment_action_plan_result_date = dateValue.slice(0, 10);
      } else {
        caseRow.assessment_action_plan_result_date = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(caseRow, 'application_row_version')) {
      caseRow.application_row_version = caseRow.application_row_version === null || caseRow.application_row_version === undefined
        ? null
        : Number(caseRow.application_row_version);
    }

    const afterStatus = (normalizedStatus !== undefined ? normalizedStatus : caseRow.status) || caseRow.status;
    const { actorId, actorName } = resolveRequestActor(req);
    const trackingId = caseRow?.tracking_id || null;

    if (statusChanged) {
      try {
        await captureCaseEvent({
          type: 'status_changed',
          caseId,
          payload: { from: beforeStatus || null, to: afterStatus, tracking_id: trackingId },
          trackingId,
          actorId,
          actorName,
        });
      } catch (_) {}
      try {
        await sendDecisionOutcome({
          pool,
          userId: caseRow?.applicant_user_id || null,
          trackingId,
          status: afterStatus,
        });
      } catch (notifyErr) {
        console.error('[notifications] decision email failed', notifyErr?.message || notifyErr);
      }
    }

    const assessmentSubmitted = body.assessment_recommendation && body.assessment_justification;
    if (assessmentSubmitted) {
      const coordinatorName = actorName || '';
      await captureCaseEvent({
        type: 'assessment_submitted',
        caseId,
        payload: {
          evaluator_name: coordinatorName || null,
          tracking_id: trackingId,
          message: coordinatorName
            ? 'Assessment submitted by coordinator: ' + coordinatorName + '.'
            : 'Assessment submitted by coordinator.',
        },
        trackingId,
        actorId,
        actorName: coordinatorName || actorName,
      });
    }

    if (body.assessment_nwac_review) {
      await captureCaseEvent({
        type: 'nwac_review_submitted',
        caseId,
        payload: {
          evaluator_name: actorName || null,
          tracking_id: trackingId,
          message: 'NWAC review submitted.',
        },

        trackingId,
        actorId,
        actorName,
      });
    }

    const responseRowVersion = caseRow?.application_row_version ?? newRowVersion ?? null;
    res.json({
      success: true,
      status: afterStatus,
      application_row_version: responseRowVersion,
      lock: lockCheck.lock || null
    });
  } catch (error) {
    console.error('Error updating assessment:', error);
    res.status(500).json({ success: false, error: error.message, lock: lockCheck.lock || null });
  }
});


// --- Event timeline endpoints (new pipeline) ---

app.get('/api/events/feed', async (req, res) => {
  const limitParam = Number(req.query.limit);
  const offsetParam = Number(req.query.offset);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

  const typeFilter = parseListQueryParam(req.query.type ?? req.query.types ?? req.query.event_type ?? req.query.eventType);
  const categoryFilter = parseListQueryParam(req.query.category ?? req.query.categories ?? req.query.event_category ?? req.query.eventCategory);
  const subjectTypeFilter = parseListQueryParam(req.query.subjectType ?? req.query.subject_type ?? req.query.subjectTypes);
  const subjectIdRaw = firstQueryValue(req.query.subjectId ?? req.query.subject_id ?? null);
  const normalizedSubjectId = subjectIdRaw === undefined || subjectIdRaw === null ? null : (String(subjectIdRaw).trim() || null);

  const sinceMeta = parseDateQueryParam(req.query.since ?? req.query.after ?? req.query.from);
  if (sinceMeta.provided && !sinceMeta.value) {
    return res.status(400).json({ error: 'invalid_since' });
  }
  const untilMeta = parseDateQueryParam(req.query.until ?? req.query.before ?? req.query.to);
  if (untilMeta.provided && !untilMeta.value) {
    return res.status(400).json({ error: 'invalid_until' });
  }

  try {
    const { actorId } = resolveRequestActor(req);
    const items = await getEventFeed({
      limit,
      offset,
      requesterId: actorId,
      types: typeFilter,
      categories: categoryFilter,
      subjectType: subjectTypeFilter,
      subjectId: normalizedSubjectId,
      since: sinceMeta.value,
      until: untilMeta.value,
    });
    res.json(items);
  } catch (err) {
    console.error('[events] failed to load feed', err);
    res.status(500).json({ error: 'event_feed_fetch_failed' });
  }
});

app.post('/api/events', async (req, res) => {
  const body = req.body || {};
  const type = body.type || body.eventType || body.event_type;
  if (!type) {
    return res.status(400).json({ error: 'type_required' });
  }
  const { actorId, actorName } = resolveRequestActor(req);
  const payload = body.payload || body.event_data || {};
  const correlationId = body.correlationId || body.correlation_id || null;

  let subject = body.subject || null;
  if (!subject) {
    if (body.caseId != null) subject = { type: 'case', id: body.caseId };
    else if (body.case_id != null) subject = { type: 'case', id: body.case_id };
    else if (body.subjectType && typeof body.subjectId !== 'undefined') {
      subject = { type: body.subjectType, id: body.subjectId };
    } else if (body.subject_type && typeof body.subject_id !== 'undefined') {
      subject = { type: body.subject_type, id: body.subject_id };
    }
  }

  const actor = body.actor || {
    type: body.actorType || 'staff',
    id: body.actorId || actorId || null,
    displayName: body.actorName || actorName || null,
  };

  try {
    const event = await emitEvent({
      type,
      subject,
      actor,
      payload,
      trackingId: body.trackingId || payload.tracking_id || body.caseTrackingId || null,
      correlationId,
    });
    res.status(201).json(event);
  } catch (err) {
    if (err instanceof EventValidationError) {
      return res.status(400).json({ error: 'event_validation_failed', message: err.message, details: err.details || null });
    }
    console.error('[events] failed to emit event', err);
    res.status(500).json({ error: 'event_emit_failed', message: err?.message || 'Unable to emit event' });
  }
});

app.patch('/api/events/:eventId/read', async (req, res) => {
  const eventId = req.params.eventId;
  const { actorId } = resolveRequestActor(req);
  if (!eventId) {
    return res.status(400).json({ error: 'event_id_required' });
  }
  if (!actorId) {
    return res.status(400).json({ error: 'actor_required' });
  }
  try {
    const updated = await markEventRead({ eventId, requesterId: actorId });
    if (!updated) {
      return res.status(404).json({ error: 'event_not_found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[events] failed to mark read', err);
    res.status(500).json({ error: 'event_mark_read_failed' });
  }
});

// Notification Settings Endpoints
// GET all notification settings with template info
app.get('/api/notifications', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT ns.*, nt.name as template_name, nt.language as template_language
            FROM notification_setting ns
            LEFT JOIN notification_template nt ON ns.template_id = nt.id
            ORDER BY ns.event, ns.role, ns.language
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch notification settings' });
    }
});

// POST create or update a notification setting
app.post('/api/notifications', async (req, res) => {
    const { id, event, role, template_id, language, enabled, email_alert, bell_alert } = req.body;
    try {
        if (id) {
            // Update existing
            await pool.query(
                `UPDATE notification_setting SET event=?, role=?, template_id=?, language=?, enabled=?, email_alert=?, bell_alert=?, updated_at=NOW() WHERE id=?`,
                [event, role, template_id, language, enabled, email_alert ?? 0, bell_alert ?? 0, id]
            );
            res.json({ success: true, id });
        } else {
            // Insert new
            const [result] = await pool.query(
                `INSERT INTO notification_setting (event, role, template_id, language, enabled, email_alert, bell_alert) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [event, role, template_id, language, enabled, email_alert ?? 0, bell_alert ?? 0]
            );
            res.json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save notification setting' });
    }
});

// DELETE a notification setting
app.delete('/api/notifications/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM notification_setting WHERE id=?`, [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete notification setting' });
    }
});

// GET all roles (legacy SQL directory)
app.get('/api/roles', async (req, res) => {
    try {
        const [roles] = await pool.query('SELECT RoleID as id, RoleName as name, RoleDescription as description FROM role');
        res.status(200).send(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).send({ message: 'Failed to fetch roles' });
    }
});

// New endpoints for users and roles
app.get('/api/users', async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.name, u.email, GROUP_CONCAT(r.RoleName) as role
      FROM user u
      LEFT JOIN user_role_link ur ON u.id = ur.UserID
      LEFT JOIN role r ON ur.RoleID = r.RoleID
      GROUP BY u.id
    `);

    // Anonymise user names
    const anonymisedUsers = users.map(user => ({
      ...user,
      name: maskName(user.name)
    }));

    res.status(200).send(anonymisedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send({ message: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [user] = await pool.query('SELECT id, name FROM user WHERE id = ?', [id]);
    if (user.length === 0) {
      return res.status(404).send({ message: 'User not found' });
    }
    res.status(200).send(user[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).send({ message: 'Failed to fetch user' });
  }
});

// --- Internal Notifications API ---
app.get('/api/me/notifications', async (req, res) => {
  try {
    const { actorId } = resolveRequestActor(req);
    const staffProfileId = req.staffProfile?.id || null;
    const headerUserId = req.get('X-Dev-UserId') || req.get('x-dev-userid') || null;
    const candidateIds = [staffProfileId, actorId, headerUserId];
    let normalizedUserId = null;
    for (const value of candidateIds) {
      if (value === null || typeof value === 'undefined') continue;
      const numeric = Number(value);
      if (!Number.isNaN(numeric) && numeric > 0) {
        normalizedUserId = numeric;
        break;
      }
    }

    let authContext = req.auth ? { ...req.auth } : {};
    if (normalizedUserId && !authContext.user_id && !authContext.userId && !authContext.id) {
      authContext.user_id = normalizedUserId;
    }
    if (!authContext.role && req.staffProfile?.primary_role) {
      authContext.role = req.staffProfile.primary_role;
    }
    if (!authContext.role) {
      const headerRole = req.get('X-Dev-Role') || req.get('x-dev-role') || null;
      if (headerRole) authContext.role = headerRole;
    }

    const notifications = await getInternalNotifications(pool, authContext);
    res.status(200).json(notifications);
  } catch (error) {
    console.error('[notifications] fetch failed', error);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

app.post('/api/me/notifications/:id/dismiss', async (req, res) => {
  const notificationId = Number(req.params.id);

  if (!notificationId || Number.isNaN(notificationId)) {
    return res.status(400).json({ error: 'Invalid notification id' });
  }

  const { actorId } = resolveRequestActor(req);
  const staffProfileId = req.staffProfile?.id || null;
  const headerUserId = req.get('X-Dev-UserId') || req.get('x-dev-userid') || null;
  const candidateIds = [staffProfileId, actorId, headerUserId];
  let normalizedUserId = null;
  for (const value of candidateIds) {
    if (value === null || typeof value === 'undefined') continue;
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && numeric > 0) {
      normalizedUserId = numeric;
      break;
    }
  }

  let authContext = req.auth ? { ...req.auth } : null;
  if (!authContext) {
    authContext = normalizedUserId ? { user_id: normalizedUserId } : null;
  } else if (!authContext.user_id && !authContext.userId && !authContext.id && normalizedUserId) {
    authContext.user_id = normalizedUserId;
  }
  if (authContext) {
    if (!authContext.role && req.staffProfile?.primary_role) {
      authContext.role = req.staffProfile.primary_role;
    }
    if (!authContext.role) {
      const headerRole = req.get('X-Dev-Role') || req.get('x-dev-role') || null;
      if (headerRole) authContext.role = headerRole;
    }
  }

  const resolvedUserId = authContext?.user_id || authContext?.userId || authContext?.id || null;
  if (!resolvedUserId) {
    return res.status(401).json({ error: 'User context not available' });
  }

  try {
    await dismissInternalNotification(pool, authContext, notificationId);
    res.status(200).json({ success: true });
  } catch (error) {
    if (error && error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error('[notifications] dismiss failed', error);
    res.status(500).json({ error: 'Failed to dismiss notification' });
  }
});


















