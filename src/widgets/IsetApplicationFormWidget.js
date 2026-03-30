
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  Box,
  Flashbar,
  Link,
  ButtonDropdown,
  SpaceBetween,
  Textarea,
  Button,
  ExpandableSection,
  KeyValuePairs,
  Badge,
  StatusIndicator,
  Table,
  ColumnLayout,
  Modal,
  FormField,
  Alert,
  Input,
  Select,
  Multiselect,
  Spinner,
  Autosuggest,
  Hotspot
} from '@cloudscape-design/components';
import IsetApplicationFormHelpPanelContent from '../helpPanelContents/isetApplicationFormHelpPanelContent';
import { apiFetch } from '../auth/apiClient';
import useApplicationLock, { buildLockConflictMessage } from '../hooks/useApplicationLock';
import useCurrentUser from '../hooks/useCurrentUser';

const NOT_PROVIDED = <Box color="text-body-secondary">Not provided</Box>;

const EDUCATION_LEVEL_OPTIONS = {
  no_formal_education: 'No formal education',
  grade_7_8: 'Up to Grade 7-8',
  grade_9_10: 'Grade 9-10',
  grade_11_12: 'Grade 11-12',
  secondary_school_diploma_or_ged: 'Secondary School Diploma or GED',
  post_secondary_training: 'Some post-secondary training',
  apprenticeship_trades: 'Apprenticeship / trades certificate or diploma',
  cegep: 'CEGEP or other non-university certificate / diploma',
  college: 'College or other non-university certificate / diploma',
  university_certificate: 'University certificate or diploma',
  bachelors_degree: "Bachelor's degree",
  masters_degree: "Master's degree",
  doctorate: 'Doctorate'
};

const OPTION_LABELS = {
  'address-province': {
    ab: 'Alberta',
    bc: 'British Columbia',
    mb: 'Manitoba',
    nb: 'New Brunswick',
    nl: 'Newfoundland and Labrador',
    nt: 'Northwest Territories',
    nu: 'Nunavut',
    on: 'Ontario',
    pe: 'Prince Edward Island',
    qc: 'Quebec',
    sk: 'Saskatchewan',
    ns: 'Nova Scotia',
    yt: 'Yukon Territory'
  },
  'education-location': {
    ab: 'Alberta',
    bc: 'British Columbia',
    mb: 'Manitoba',
    nb: 'New Brunswick',
    nl: 'Newfoundland and Labrador',
    ns: 'Nova Scotia',
    nt: 'Northwest Territories',
    nu: 'Nunavut',
    on: 'Ontario',
    pe: 'Prince Edward Island',
    qc: 'Quebec',
    sk: 'Saskatchewan',
    yt: 'Yukon Territory',
    other: 'Other'
  },
  biological_sex: {
    female: 'Female',
    male: 'Male'
  },
  gender_identity: {
    female: 'Female',
    male: 'Male',
    other: 'Other'
  },
  'legal-indigenous-identity': {
    first_nations_status: 'First Nations (Status)',
    first_nations_non_status: 'First Nations (Non-Status)',
    inuit: 'Inuit',
    metis: 'Metis'
  },
  'preferred-language': { en: 'English', fr: 'French' },
  'visible-minority': { true: 'Yes', false: 'No', '1': 'Yes', '0': 'No' },
  'marital-status': {
    married: 'Married or equivalent',
    single: 'Single',
    separated: 'Separated',
    divorced: 'Divorced',
    widowed: 'Widowed'
  },
  'dependent-children': { yes: 'Yes', no: 'No', '1': 'Yes', '0': 'No' },
  'has-disability': { yes: 'Yes', no: 'No', '1': 'Yes', '0': 'No' },
  'disability-support': { yes: 'Yes', no: 'No', '1': 'Yes', '0': 'No' },
  'social-assistance': { yes: 'Yes', no: 'No', '1': 'Yes', '0': 'No' },
  'labour-force-status': {
    unemployed: 'Unemployed',
    underemployed: 'Underemployed',
    'employed-full-time': 'Employed full-time',
    'employed-part-time': 'Employed part-time',
    'self-employed': 'Self-employed',
    student: 'Student',
    other: 'Other'
  },
  'highest-education': { ...EDUCATION_LEVEL_OPTIONS },
  barriers: {
    education: 'Education',
    funding: 'Funding',
    'lack-of-job-opportunities': 'Lack of job opportunities',
    location: 'Location',
    other: 'Other'
  },
  'target-program': {
    skills_development: 'Skills Development (Education)',
    tws: 'Targeted Wage Subsidy',
    jcp: 'Job Creation Partnership',
    group: 'Group Training',
    self_support: 'Self-employment supports',
    not_yet: 'Not yet'
  },
  'requested-supports': {
    tuition: 'Tuition',
    books: 'Books or program materials',
    living: 'Living allowance',
    transportation: 'Transportation',
    childcare: 'Childcare',
    other: 'Other'
  },
  'childcare-fuding-status': {
    'no-funding-received': 'No funding received',
    'ei-crf': 'EI/CRF',
    'provincial-funding-subsidy': 'Provincial funding/subsidy',
    fnicci: 'FNICCI',
    'daycare-not-available': 'Daycare not available',
    'assisted-by-family': 'Assisted by family',
    'self-funded': 'Self-funded'
  },
  expenses_transport: {
    buss_pass: 'Bus pass',
    parking: 'Parking (at the school)',
    mileage: 'Mileage (home to school)'
  },
  ei_status: {
    receiving: 'Currently receiving EI',
    not_receiving: 'Not using EI',
    planning: 'Plan to apply for EI',
    unsure: 'Unsure about EI'
  },
  'ei-documents-receiving': {
    ei_consent: 'Client Consent for EI Verification',
    ei_eligibility: 'EI Eligibility Verification form',
    ei_authorization: 'Service Canada approval to leave work for training'
  }
};

const cloneAnswers = (source) => JSON.parse(JSON.stringify(source || {}));
const normaliseSinInput = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 9);
const formatSinDisplay = (value) => {
  if (value === null || value === undefined || value === '') return NOT_PROVIDED;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return renderPlainText(value);
  const grouped = digits.match(/.{1,3}/g)?.join(' ') || digits;
  return <Box>{grouped}</Box>;
};
const isValidSinChecksum = (digits) => {
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
};

// Normalise a wide variety of yes/no input shapes to 'yes' | 'no' | null
const normaliseYesNo = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim().toLowerCase();
  if (['yes', 'true', '1', 'y'].includes(s)) return 'yes';
  if (['no', 'false', '0', 'n'].includes(s)) return 'no';
  return null;
};

const INCOME_FIELDS = [
  { key: 'income-employment', label: 'Employment income' },
  { key: 'income-spousal', label: 'Spousal income' },
  { key: 'income-social-assist', label: 'Social assistance' },
  { key: 'income-child-support', label: 'Child support' },
  { key: 'income-child-benefit', label: 'Canada Child Benefit' },
  { key: 'income-jordans', label: "Jordan's Principle" },
  { key: 'income-band-funding', label: 'Band funding' },
  { key: 'income-alimony', label: 'Alimony / spousal support' },
  { key: 'income-other-description', label: 'Other income (amount)' }
];

const EXPENSE_FIELDS = [
  { key: 'expenses-rent', label: 'Rent / Mortgage' },
  { key: 'expenses-groceries', label: 'Groceries' },
  { key: 'expenses-electricity', label: 'Electricity/Hydro' },
  { key: 'expenses-heating', label: 'Home Heating' },
  { key: 'expenses-water', label: 'Water' },
  { key: 'expenses-sewerage', label: 'Sewer / Wastewater' },
  { key: 'expenses-garbage', label: 'Waste Management' },
  { key: 'expenses_bus_pass', label: 'Bus pass' },
  { key: 'expenses-parking', label: 'Parking charges' },
  { key: 'expenses-other-total', label: 'Other expenses total' }
];

const currencyFormatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 });

const parseCurrencyValue = (value) => {
  if (value === null || value === undefined) return { number: null, cleaned: '' };
  if (typeof value === 'number' && Number.isFinite(value)) return { number: value, cleaned: String(value) };
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (!cleaned) return { number: null, cleaned };
  const number = Number(cleaned);
  if (Number.isNaN(number)) return { number: null, cleaned };
  return { number, cleaned };
};

const formatCurrency = (value) => {
  const { number, cleaned } = parseCurrencyValue(value);
  if (number === null) {
    if (!cleaned || value === null || value === undefined || value === '') return NOT_PROVIDED;
    return String(value);
  }
  return currencyFormatter.format(number);
};

const formatDate = (value) => {
  if (!value) return NOT_PROVIDED;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
const extractOptionLabel = (optionLabel) => {
  if (typeof optionLabel === 'string') return optionLabel;
  if (optionLabel && typeof optionLabel === 'object') {
    return optionLabel.en || optionLabel.fr || Object.values(optionLabel)[0] || '';
  }
  return '';
};

const getOptionsForField = (fieldKey, schemaSnapshot, fallbackOptions) => {
  const schemaField = schemaSnapshot?.fields?.[fieldKey];
  if (schemaField?.options && Array.isArray(schemaField.options)) {
    return schemaField.options
      .map(option => {
        const label = extractOptionLabel(option.label ?? option.text ?? option);
        const value = option.value ?? option.key ?? option;
        if (label === '' && (value === null || value === undefined)) return null;
        return { label: label || String(value), value: String(value) };
      })
      .filter(Boolean);
  }
  if (fallbackOptions && typeof fallbackOptions === 'object') {
    return Object.entries(fallbackOptions).map(([value, label]) => ({ value: String(value), label }));
  }
  return [];
};

const formatOption = (key, value) => {
  if (value === null || value === undefined || value === '') return NOT_PROVIDED;
  const map = OPTION_LABELS[key];
  if (map) {
    const stringValue = String(value);
    const normalised = stringValue.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(map, normalised)) {
      return map[normalised];
    }
    if (Object.prototype.hasOwnProperty.call(map, stringValue)) {
      return map[stringValue];
    }
  }
  const yn = normaliseYesNo(value);
  if (yn) {
    return yn === 'yes' ? 'Yes' : 'No';
  }
  return String(value);
};

const formatOptionList = (key, values) => {
  if ((values === null || values === undefined) || (Array.isArray(values) && values.length === 0)) return NOT_PROVIDED;
  const list = Array.isArray(values) ? values : [values];
  const chips = list.map((item, index) => {
    const label = formatOption(key, item);
    if (typeof label === 'string' && ['Yes', 'No'].includes(label)) {
      return <Badge key={index} color={label === 'Yes' ? 'green' : 'grey'}>{label}</Badge>;
    }
    return <Badge key={index} color="blue">{label}</Badge>;
  });
  return <SpaceBetween direction="horizontal" size="xs">{chips}</SpaceBetween>;
};
const renderPlainText = (value) => {
  if (value === null || value === undefined || value === '') return NOT_PROVIDED;
  return <Box>{value}</Box>;
};

const renderTextBlock = (value) => {
  if (!value || !String(value).trim()) return NOT_PROVIDED;
  return <Box whiteSpace="pre-wrap">{value}</Box>;
};

const renderMailingAddress = (value) => renderTextBlock(value);

const signatureStatus = (value) => {
  if (!value || typeof value !== 'object') {
    return <StatusIndicator type="pending">Not signed</StatusIndicator>;
  }
  const signed = Boolean(value.signed);
  const signer = value.name ? ` by ${value.name}` : '';
  return signed ? (
    <StatusIndicator type="success">Signed{signer}</StatusIndicator>
  ) : (
    <StatusIndicator type="pending">Not signed</StatusIndicator>
  );
};

const renderConflictDeclaration = (answers) => {
  const signature = answers?.conflict_applicant_signature;
  if (!signature || typeof signature !== 'object' || !signature.signed) {
    return <StatusIndicator type="pending">Not signed</StatusIndicator>;
  }
  const declaration = String(answers?.conflict_of_interest ?? '').trim().toLowerCase();
  const hasConflict = declaration === 'conflict';
  const fallbackName = [answers?.['first-name'] || '', answers?.['last-name'] || '']
    .filter(Boolean)
    .join(' ')
    .trim() || 'applicant';
  const name = signature.name || fallbackName;
  return (
    <StatusIndicator type={hasConflict ? 'warning' : 'success'}>
      {hasConflict ? `Signed with conflict by ${name}` : `Signed no conflict by ${name}`}
    </StatusIndicator>
  );
};

const buildFinancialRows = (fields, answers, totalLabel) => {
  let total = 0;
  const rows = fields.map(({ key, label }) => {
    const rawValue = answers?.[key];
    const { number } = parseCurrencyValue(rawValue);
    if (number !== null) {
      total += number;
    }
    return {
      id: key,
      fieldKey: key,
      name: label,
      rawValue: rawValue ?? '',
      number,
      formattedAmount: number === null ? '' : currencyFormatter.format(number),
      isTotal: false
    };
  });
  const totalRow = {
    id: `${totalLabel}-total`,
    fieldKey: null,
    name: totalLabel,
    rawValue: '',
    number: total,
    formattedAmount: currencyFormatter.format(total),
    isTotal: true
  };
  return [...rows, totalRow];
};

const normaliseForCompare = (value) => {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value ?? '';
};

const answersDiff = (baseline = {}, updated = {}) => {
  const diff = {};
  const keys = new Set([...Object.keys(baseline || {}), ...Object.keys(updated || {})]);
  keys.forEach(key => {
    if (key === 'registration-number') return; // derived UI-only key; ignore in diffs
    if (normaliseForCompare(baseline?.[key]) !== normaliseForCompare(updated?.[key])) {
      diff[key] = updated?.[key];
    }
  });
  return diff;
};

const areValuesEqual = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

const toDisplayLabel = (fieldKey) =>
  String(fieldKey || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());

const normaliseFieldLabel = (label) => {
  if (typeof label === 'string') return label.trim();
  if (label && typeof label === 'object' && typeof label.props?.children === 'string') {
    return String(label.props.children).trim();
  }
  return '';
};

const summariseDiffValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (!value.length) return '—';
    const isSimple = value.every(item => ['string', 'number', 'boolean'].includes(typeof item) || item === null || item === undefined);
    if (isSimple) return value.map(item => (item === null || item === undefined || item === '' ? '—' : String(item))).join(', ');
    return `${value.length} item(s)`;
  }
  if (value && typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'signed')) {
      const signedText = value.signed ? 'Signed' : 'Not signed';
      const nameText = value.name ? ` (${value.name})` : '';
      return `${signedText}${nameText}`;
    }
    if (value.name && typeof value.name === 'string') return value.name;
    return '[complex value]';
  }
  return String(value);
};

const REGISTRATION_KEYS = ['sfn-registration-number', 'nsfn-registration-number', 'metis-registration-number', 'inuit-registration-number', 'registration-number'];
const REGISTRATION_KEY_BY_IDENTITY = {
  first_nations_status: 'sfn-registration-number',
  first_nations_non_status: 'nsfn-registration-number',
  metis: 'metis-registration-number',
  inuit: 'inuit-registration-number'
};

const getRegistrationValue = (answers = {}) => {
  for (const key of REGISTRATION_KEYS) {
    const val = answers?.[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
  }
  return '';
};

const getRegistrationTargetKey = (answers = {}) => {
  for (const key of REGISTRATION_KEYS) {
    if (answers && Object.prototype.hasOwnProperty.call(answers, key) && String(answers[key] ?? '').trim().length > 0) {
      return key;
    }
  }
  const identityKey = REGISTRATION_KEY_BY_IDENTITY[answers?.['legal-indigenous-identity']];
  if (identityKey) {
    return identityKey;
  }
  return 'sfn-registration-number';
};

const buildEditableAnswers = (source = {}) => {
  const next = cloneAnswers(source);
  next['registration-number'] = getRegistrationValue(source);
  return next;
};


const EI_CONSENT_PARAGRAPHS = [
  "I, the undersigned, give my expressed and informed consent to the Native Women's Association of Canada and/or its sub-agreement holders to the Indigenous Skills and Employment Training Program (hereinafter referred to as ISET), to collect personal or sensitive information as it relates to my request for funding under the ISET program funded by Employment and Social Development Canada (ESDC). My consent extends to providing my Social Insurance Number (SIN), to determine my eligibility for interventions such as skills training and wage subsidies as part of the Labour Market Development Agreements (LMDA) program.",
  'I acknowledge that the information is collected and administered in accordance with the Privacy Act (R.S.C. 1985, c P-21), the Department Employment and Social Development Canada Act (S.C. 2005, c.34), and the Access to Information Act (R.S.C., 1985, c.A-1). Information collected is to be used to determine eligibility for the ISET program; to measure results of this Agreement and evaluate its success; evaluate the effectiveness of the Program in achieving its objective; and, to meet its obligations of accountability by reporting on the results of the Program.',
  "All information referred to above shall be treated as confidential, and the Native Women's Association of Canada and its sub-agreement holders will take all security measures reasonably necessary for the protection of such information against unauthorized release or disclosure.",
  'Further, I understand that my personal information shall not be used or disclosed for purposes other than those for which it was collected, except with the expressed consent of you, as the client, or as required by law. Personal information shall be retained only as long as necessary for the fulfilment of those purposes.'
];

const INDIGENOUS_DECLARATION_PARAGRAPHS = [
  'I, the undersigned, understand that the funding opportunity under the Indigenous Skills and Employment Training (ISET) program for which I am being assessed is intended to increase Indigenous participation in the Canadian labour market and support First Nations, Metis and Inuit peoples’ access to sustainable and meaningful employment. The ISET program provides access to training and employment supports to eligible Canadian Indigenous women in their diversities, including status and non-status First Nations, Metis and Inuit peoples whether residing on or off-reserve, in urban centres and in rural, remote communities.',
  'Further, I understand that providing false or misleading information and/or omission of information by me about my Indigenous identity may result in an investigation. If an investigation is founded, it will be grounds for immediate suspension of any funding provided or promised to me and further, revocation of any Funding Agreement signed between me and the Native Women’s Association of Canada and/or its sub-agreement holders, and will result in a repayment of funds to Employment and Social Development Canada (ESDC), for monies I received to which I was not entitled.'
];
const INDIGENOUS_DECLARATION_STATEMENT =
  'I hereby declare that I am an Indigenous person in Canada, which for the purposes of the Indigenous Skills and Employment Training (ISET) Program is inclusive of persons who are First Nations, Inuit, or Metis.';
const CONFLICT_DECLARATION_PARAGRAPHS = [
  'The Indigenous Skills and Employment Training (ISET) program is committed to fairness, transparency, and accountability in all funding decisions.',
  'To protect the integrity of the program, all applicants must declare any actual, potential, or perceived conflicts of interest or biases related to their ISET application.',
  'I do not have any personal, family, financial, or other relationship with any staff member of the Native Women’s Association of Canada (NWAC) or any regional Provincial/Territorial Member Association (PTMA) that could influence or appear to influence the assessment or approval of my ISET application.',
  'I have not attempted to influence or put pressure on any NWAC or regional PTMA staff involved in assessing or approving my ISET application.',
  'I have not requested that my application be given priority ahead of other applicants, as I understand my application will be assessed in the order in which it was received by NWAC and/or the regional PTMA.',
  'I have disclosed below any relationships, positive or negative biases, or circumstances that may create a real or perceived conflict of interest.'
];
const AUTHORIZATION_RELEASE_PARAGRAPHS = [
  "I, the undersigned, give my expressed and informed consent to the educational/training institute or my Employer (under a TWS or JCP), to release information to the Native Women's Association of Canada and/or its sub-agreement holders to the Indigenous Skills and Employment Training Program (hereinafter referred to as ISET).",
  'I understand that my consent and authorization is valid in perpetuity for all information related to the program, classes, attendance, or wage subsidy that are funded by Employment and Social Development Canada (ESDC) under the ISET program and delivered by NWAC and/or its sub-agreement holders.',
  "I understand that it is my personal responsibility to inform the Registrar's Office, my Employer and the NWAC and/or its sub-agreement holder in writing should I decide to withdraw my consent to release student information.",
  'Under the Freedom of Information and Protection of Individual Privacy Act, I have the right to privacy of personal information held by government institutions, including institutions of learning.',
  'My signature denotes my consent and authorization for the training/educational institution or Employer for which I received funding or wage subsidy through the ISET program to release personal information as described above to NWAC and/or its designate.'
];
const CLIENT_ACKNOWLEDGEMENT_PARAGRAPHS = [
  'I, the undersigned, acknowledge that I have been advised by the Native Women’s Association of Canada and/or its sub-agreement holders to the Indigenous Skills and Employment Training Program (hereinafter referred to as ISET) that funding for skills and employment training, living allowance, wage subsidies or other sources of funding are Government of Canada resources advanced through Employment and Social Development Canada (ESDC) to fund the ISET program.',
  'I give my consent to the Native Women’s Association of Canada and/or its sub-agreement holders and their designated authorized representatives, to contact other service agencies, funding providers, educational and training institutions to verify information regarding my application and for verification of household income sources.',
  'Requests for supporting documentation may include but is not limited to: acceptance letter from training institution, letter of decision by Band; ID (Status/Treaty Card, driver’s license, Passport, Health Card or other Government-issued identification); tax assessments; child tax benefit (CTB) statement; Social Assistance statement or letter from agency/caseworker; Record of Employment (ROE); paystubs; letter of employment, bank statements, and other documentation as may be required for verification purposes.',
  'I understand and acknowledge that any false or misleading statements and/or omission of information by me, may be grounds for immediate suspension of any funding and further, revocation of any funding arrangement between me and the Native Women’s Association of Canada and/or its sub-agreement holders, and may result in a repayment of funds to Employment and Social Development Canada (ESDC), for monies I received to which I was not entitled.'
];
const CONFLICT_DECLARATION_STATEMENT =
  'Are you declaring a conflict of interest or bias in relation to your ISET application?';
const CONFLICT_OPTION_LABELS = {
  no_conflict: 'I have no conflicts of interest or biases to declare',
  conflict: 'I wish to declare the following potential conflicts or biases'
};

const resolveSignatureTimestamp = (signature) => {
  if (!signature || typeof signature !== 'object') return null;
  return (
    signature.signedAt ||
    signature.signed_at ||
    signature.timestamp ||
    signature.updatedAt ||
    signature.updated_at ||
    null
  );
};

const buildSectionDefinitions = ({
  onOpenConsentModal,
  onOpenIndigenousModal,
  onOpenAuthorizationModal,
  onOpenClientAcknowledgementModal,
  onOpenConflictModal
} = {}) => [
  {
    id: 'consent',
    title: 'Consent & declarations',
    description: 'Signatures captured at submission time.',
    columns: 2,
    editable: true,
    items: [
      {
        label: (
          <Box display="inline-flex" alignItems="center">
            <Box as="span" display="inline" fontWeight="bold" margin={{ right: 'xxs' }}>
              Indigenous declaration
            </Box>
            <Button
              variant="icon"
              iconName="external"
              ariaLabel="View Indigenous declaration"
              onClick={event => {
                event?.preventDefault();
                event?.stopPropagation();
                onOpenIndigenousModal?.();
              }}
            />
          </Box>
        ),
        editable: false,
        renderValue: answers => signatureStatus(answers?.indigenous_declaration)
      },
      {
        label: 'Nation / community affiliation',
        field: 'indigenous-affiliation-declaration',
        controlType: 'band-search',
        bandSearchKey: 'affiliation',
        placeholder: 'Search communities',
        renderValue: answers => renderPlainText(answers['indigenous-affiliation-declaration'])
      },
      {
        label: (
          <Box display="inline-flex" alignItems="center">
            <Box as="span" display="inline" fontWeight="bold" margin={{ right: 'xxs' }}>
              Client EI consent
            </Box>
            <Button
              variant="icon"
              iconName="external"
              ariaLabel="View client EI consent form"
              onClick={event => {
                event?.preventDefault();
                event?.stopPropagation();
                onOpenConsentModal?.();
              }}
            />
          </Box>
        ),
        editable: false,
        renderValue: answers => (
          signatureStatus(answers?.consent)
        )
      },
      {
        label: (
          <Box display="inline-flex" alignItems="center">
            <Box as="span" display="inline" fontWeight="bold" margin={{ right: 'xxs' }}>
              Authorization for release of ISET client information
            </Box>
            <Button
              variant="icon"
              iconName="external"
              ariaLabel="View authorization for release of ISET client information"
              onClick={event => {
                event?.preventDefault();
                event?.stopPropagation();
                onOpenAuthorizationModal?.();
              }}
            />
          </Box>
        ),
        editable: false,
        renderValue: answers =>
          signatureStatus(
            answers?.auth_froici_sing ||
            answers?.auth_froici_sign ||
            answers?.authorization_for_release_of_iset_client_information
          )
      },
      {
        label: (
          <Box display="inline-flex" alignItems="center">
            <Box as="span" display="inline" fontWeight="bold" margin={{ right: 'xxs' }}>
              Client acknowledgement of funding source
            </Box>
            <Button
              variant="icon"
              iconName="external"
              ariaLabel="View client acknowledgement of funding source"
              onClick={event => {
                event?.preventDefault();
                event?.stopPropagation();
                onOpenClientAcknowledgementModal?.();
              }}
            />
          </Box>
        ),
        editable: false,
        renderValue: answers => signatureStatus(answers?.sig_caofs)
      },
      {
        label: (
          <Box display="inline-flex" alignItems="center">
            <Box as="span" display="inline" fontWeight="bold" margin={{ right: 'xxs' }}>
              Conflict of interest declaration
            </Box>
            <Button
              variant="icon"
              iconName="external"
              ariaLabel="View conflict of interest declaration"
              onClick={event => {
                event?.preventDefault();
                event?.stopPropagation();
                onOpenConflictModal?.();
              }}
            />
          </Box>
        ),
        editable: false,
        renderValue: answers => renderConflictDeclaration(answers)
      }
    ]
  },
  {
    id: 'identity',
    title: 'Applicant identity',
    description: 'Core biographical details provided by the applicant.',
    columns: 3,
    editable: true,
    items: [
      { label: 'First name', field: 'first-name', controlType: 'input', renderValue: answers => renderPlainText(answers['first-name']) },
      { label: 'Middle name(s)', field: 'middle-names', controlType: 'input', renderValue: answers => renderPlainText(answers['middle-names']) },
      { label: 'Last name', field: 'last-name', controlType: 'input', renderValue: answers => renderPlainText(answers['last-name']) },
      { label: 'Preferred name', field: 'preferred-name', controlType: 'input', renderValue: answers => renderPlainText(answers['preferred-name']) },
      { label: 'Date of birth', field: 'dob', controlType: 'date', renderValue: answers => formatDate(answers['dob']) },
      {
        label: 'Biological sex',
        field: 'biological_sex',
        controlType: 'select',
        optionsKey: 'biological_sex',
        renderValue: answers => formatOption('biological_sex', answers['biological_sex'])
      },
      {
        label: 'Gender identity',
        field: 'gender_identity',
        controlType: 'select',
        optionsKey: 'gender_identity',
        renderValue: answers => formatOption('gender_identity', answers['gender_identity'])
      },
      {
        label: 'Social Insurance Number',
        field: 'social-insurance-number',
        controlType: 'input',
        constraintText: 'Enter a 9-digit SIN.',
        renderValue: answers => formatSinDisplay(answers['social-insurance-number'])
      },
      {
        label: 'Legal Indigenous identity',
        field: 'legal-indigenous-identity',
        controlType: 'select',
        optionsKey: 'legal-indigenous-identity',
        renderValue: answers => formatOption('legal-indigenous-identity', answers['legal-indigenous-identity'])
      },
      { label: 'Registration number', field: 'registration-number', controlType: 'input', renderValue: answers => renderPlainText(getRegistrationValue(answers)) },
      {
        label: 'Home community',
        field: 'home-comminuty',
        controlType: 'band-search',
        bandSearchKey: 'home',
        placeholder: 'Search communities',
        renderValue: answers => renderPlainText(answers['home-comminuty'])
      }
    ]
  },
  {
    id: 'contact',
    title: 'Contact information',
    description: 'Primary communication channels for follow-up.',
    columns: 2,
    editable: true,
    items: [
      { label: 'Street address', field: 'address-street-address', controlType: 'input', renderValue: answers => renderPlainText(answers['address-street-address']) },
      { label: 'City', field: 'address-city', controlType: 'input', renderValue: answers => renderPlainText(answers['address-city']) },
      {
        label: 'Province or Territory',
        field: 'address-province',
        controlType: 'select',
        optionsKey: 'address-province',
        renderValue: answers => formatOption('address-province', answers['address-province'])
      },
      { label: 'Postal code', field: 'address-postcode', controlType: 'input', renderValue: answers => renderPlainText(answers['address-postcode']) },
      {
        label: 'Mailing address (if different)',
        field: 'address-mailing-address',
        controlType: 'textarea',
        renderValue: answers => renderMailingAddress(answers['address-mailing-address'])
      },
      { label: 'Daytime phone', field: 'telephone-day', controlType: 'input', renderValue: answers => renderPlainText(answers['telephone-day']) },
      { label: 'Alternate phone', field: 'telephone-alt', controlType: 'input', renderValue: answers => renderPlainText(answers['telephone-alt']) },
      { label: 'Email address', field: 'contact-email-address', controlType: 'input', renderValue: answers => renderPlainText(answers['contact-email-address']) }
    ]
  },
  {
    id: 'emergency',
    title: 'Emergency contact',
    description: 'Designated contact in case of urgent updates.',
    columns: 2,
    editable: true,
    items: [
      { label: 'Name', field: 'emergency-contact-name', controlType: 'input', renderValue: answers => renderPlainText(answers['emergency-contact-name']) },
      { label: 'Relationship', field: 'emergency-contact-relationship', controlType: 'input', renderValue: answers => renderPlainText(answers['emergency-contact-relationship']) },
      { label: 'Telephone', field: 'emergency-contact-telephone', controlType: 'input', renderValue: answers => renderPlainText(answers['emergency-contact-telephone']) }
    ]
  },
  {
    id: 'demographics',
    title: 'Demographics & household',
    description: 'Additional context for program prioritisation.',
    columns: 2,
    editable: true,
    items: [
      {
        label: 'Preferred language',
        field: 'preferred-language',
        controlType: 'select',
        optionsKey: 'preferred-language',
        renderValue: answers => formatOption('preferred-language', answers['preferred-language'])
      },
      {
        label: 'Visible minority',
        field: 'visible-minority',
        controlType: 'select',
        optionsKey: 'visible-minority',
        renderValue: answers => formatOption('visible-minority', answers['visible-minority'])
      },
      {
        label: 'Marital status',
        field: 'marital-status',
        controlType: 'select',
        optionsKey: 'marital-status',
        renderValue: answers => formatOption('marital-status', answers['marital-status'])
      },
      { label: "Spouse's name", field: 'spouses-name', controlType: 'input', renderValue: answers => renderPlainText(answers['spouses-name']) },
      {
        label: 'Has dependent children',
        field: 'dependent-children',
        controlType: 'select',
        optionsKey: 'dependent-children',
        renderValue: answers => formatOption('dependent-children', answers['dependent-children'])
      },
      { label: 'Ages of children', field: 'ages-of-children', controlType: 'input', renderValue: answers => renderPlainText(answers['ages-of-children']) },
      {
        label: 'Has disability',
        field: 'has-disability',
        controlType: 'select',
        optionsKey: 'has-disability',
        renderValue: answers => formatOption('has-disability', answers['has-disability'])
      },
      {
        label: 'Disability details',
        field: 'disability-description',
        controlType: 'textarea',
        renderValue: answers => renderTextBlock(answers['disability-description'])
      },
      {
        label: 'Requesting disability support',
        field: 'disability-support',
        controlType: 'select',
        optionsKey: 'disability-support',
        renderValue: answers => formatOption('disability-support', answers['disability-support'])
      },
      {
        label: 'Disability support request',
        field: 'disability-support_yes_follow',
        controlType: 'textarea',
        renderValue: answers => renderTextBlock(answers['disability-support_yes_follow'])
      },
      {
        label: 'Receiving social assistance',
        field: 'social-assistance',
        controlType: 'select',
        optionsKey: 'social-assistance',
        renderValue: answers => formatOption('social-assistance', answers['social-assistance'])
      },
      {
        label: 'Top-up amount',
        field: 'top-up-amount',
        controlType: 'currency',
        renderValue: answers => formatCurrency(answers['top-up-amount'])
      }
    ]
  },
  {
    id: 'education',
    title: 'Education & employment',
    description: 'Current labour force status and academic history.',
    columns: 2,
    editable: true,
    items: [
      {
        label: 'Labour force status',
        field: 'labour-force-status',
        controlType: 'select',
        optionsKey: 'labour-force-status',
        renderValue: answers => formatOption('labour-force-status', answers['labour-force-status'])
      },
      {
        label: 'Highest education completed',
        field: 'highest-education',
        controlType: 'select',
        optionsKey: 'highest-education',
        renderValue: answers => formatOption('highest-education', answers['highest-education'])
      },
      { label: 'Year completed', field: 'education-year', controlType: 'input', renderValue: answers => renderPlainText(answers['education-year']) },
      {
        label: 'Where completed',
        field: 'education-location',
        controlType: 'select',
        optionsKey: 'education-location',
        renderValue: answers => formatOption('education-location', answers['education-location'])
      },
      {
        label: 'Identified program / employer',
        field: 'target-program',
        controlType: 'select',
        optionsKey: 'target-program',
        renderValue: answers => formatOption('target-program', answers['target-program'])
      }
    ]
  },
  {
    id: 'employment-goals',
    title: 'Employment goals & barriers',
    description: 'Self-identified goals and obstacles.',
    columns: 2,
    editable: true,
    items: [
      {
        label: 'Current barriers',
        field: 'barriers',
        controlType: 'multiselect',
        optionsKey: 'barriers',
        renderValue: answers => formatOptionList('barriers', answers['barriers'])
      },
      { label: 'Other barrier', field: 'other-barrier', controlType: 'textarea', renderValue: answers => renderTextBlock(answers['other-barrier']) }
    ]
  },
  {
    id: 'supports',
    title: 'Supports requested',
    description: 'Funding supports requested by the applicant.',
    columns: 2,
    editable: true,
    items: [
      {
        label: 'Supports requested',
        field: 'requested-supports',
        controlType: 'multiselect',
        optionsKey: 'requested-supports',
        renderValue: answers => formatOptionList('requested-supports', answers['requested-supports'])
      },
      {
        label: 'Current childcare support status',
        field: 'childcare-fuding-status',
        controlType: 'multiselect',
        optionsKey: 'childcare-fuding-status',
        renderValue: answers => {
          const selectedSupports = answers?.['requested-supports'] || [];
          if (!Array.isArray(selectedSupports) || !selectedSupports.includes('childcare')) {
            return NOT_PROVIDED;
          }
          const vals = answers?.['childcare-fuding-status'];
          return formatOptionList('childcare-fuding-status', vals);
        }
      },
      {
        label: 'Other support detail',
        field: 'other-requested-support',
        controlType: 'textarea',
        renderValue: answers => renderTextBlock(answers['other-requested-support'])
      }
    ]
  },
  {
    id: 'finances',
    title: 'Household finances',
    description: 'Monthly household cash flow snapshot.',
    columns: 2,
    editable: true,
    tables: [
      {
        id: 'income-table',
        header: <Header variant="h4">Household income</Header>,
        fields: INCOME_FIELDS,
        totalLabel: 'Total monthly income',
        editableAmounts: true,
        trackBy: 'name'
      },
      {
        id: 'expense-table',
        header: <Header variant="h4">Household expenses</Header>,
        fields: EXPENSE_FIELDS,
        totalLabel: 'Total monthly expenses',
        editableAmounts: true,
        trackBy: 'name'
      }
    ],
    items: [
      { label: 'Other income source(s)', field: 'income-other', controlType: 'textarea', renderValue: answers => renderTextBlock(answers['income-other']) },
      {
        label: 'Transport expense categories',
        field: 'expenses-transport',
        controlType: 'multiselect',
        optionsKey: 'expenses_transport',
        renderValue: answers => {
          const vals = answers?.['expenses-transport'] ?? answers?.['expenses_transport'];
          return formatOptionList('expenses_transport', vals);
        }
      },
      { label: 'Other expenses (list)', field: 'expenses-other-list', controlType: 'textarea', renderValue: answers => renderTextBlock(answers['expenses-other-list']) },
      {
        label: 'Mileage (home to school)',
        field: 'expenses_transport_mileage',
        controlType: 'text',
        renderValue: answers => {
          const val = answers?.['expenses_transport_mileage'];
          if (val === undefined || val === null || val === '') return NOT_PROVIDED;
          return `${val} km per month`;
        }
      },
      {
        label: 'Student loans or grants?',
        field: 'loan-grant',
        controlType: 'select',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' }
        ],
        renderValue: answers => formatOption('loan-grant', answers['loan-grant'])
      },
      {
        label: 'Student loan/grant details',
        field: 'loan-grant-details',
        controlType: 'textarea',
        renderValue: answers => renderTextBlock(answers['loan-grant-details'])
      }
    ]
  },
  {
    id: 'submission',
    title: 'Submission confirmation',
    description: 'Final signature captured at submission.',
    columns: 1,
    editable: false,
    items: [
      {
        label: 'Applicant signature',
        renderValue: answers => signatureStatus(answers?.legal_submission_sig)
      }
    ]
  }
];
const Section = ({
  id,
  title,
  description,
  columns = 2,
  items = [],
  tables = [],
  editable = false,
  isEditing,
  answers,
  editableAnswers,
  renderEditableField,
  onFieldChange,
  fieldErrors = {},
  saving
}) => {
  const displaySource = isEditing && editable ? editableAnswers : answers;
  const editableItems = isEditing && editable ? items.filter(item => item.editable !== false && item.field) : [];
  const staticItems = !isEditing || !editable ? items : items.filter(item => item.editable === false || !item.field);
  const preparedStaticItems = staticItems.map(item => ({
    label: item.label,
    value: item.renderValue(displaySource)
  }));

  const resolvedTables = tables.map(config => {
    const rows = config.fields ? buildFinancialRows(config.fields, displaySource, config.totalLabel) : (config.items || []);
    return { ...config, rows };
  });

  const defaultTableColumns = [
    {
      id: 'name',
      header: 'Category',
      cell: item => <Box fontWeight={item.isTotal ? 'bold' : undefined}>{item.name}</Box>
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: item => (
        <Box textAlign="right" fontWeight={item.isTotal ? 'bold' : undefined}>
          {item.formattedAmount || item.amount || ''}
        </Box>
      )
    }
  ];

  const renderTable = (config) => {
    const rows = config.rows;
    let columnDefinitions = config.columnDefinitions || defaultTableColumns;
    if (isEditing && editable && config.editableAmounts) {
      columnDefinitions = [
        {
          id: 'name',
          header: 'Category',
          cell: item => <Box fontWeight={item.isTotal ? 'bold' : undefined}>{item.name}</Box>
        },
        {
          id: 'amount',
          header: 'Amount',
          cell: item =>
            item.isTotal ? (
              <Box textAlign="right" fontWeight="bold">
                {item.formattedAmount}
              </Box>
            ) : (
              <Input
                value={editableAnswers?.[item.fieldKey] ?? ''}
                onChange={({ detail }) => onFieldChange(item.fieldKey, detail.value)}
                inputMode="decimal"
                placeholder="$0"
                disabled={saving}
              />
            )
        }
      ];
    }
    return (
      <Table
        variant="embedded"
        stripedRows
        resizableColumns={false}
        wrapLines
        header={config.header}
        items={rows}
        columnDefinitions={columnDefinitions}
        trackBy={config.trackBy || 'name'}
      />
    );
  };

  return (
    <ExpandableSection
      headerText={title}
      headerDescription={description}
      defaultExpanded
    >
      <SpaceBetween size="s">
        {resolvedTables.length > 0 && (
          resolvedTables.length > 1 ? (
            <ColumnLayout columns={Math.min(2, resolvedTables.length)} variant="text-grid">
              {resolvedTables.map((config, index) => (
                <div key={config.id || index}>{renderTable(config)}</div>
              ))}
            </ColumnLayout>
          ) : (
            renderTable(resolvedTables[0])
          )
        )}
        {isEditing && editable && editableItems.length > 0 && (
          <ColumnLayout columns={columns} variant="text-grid">
            {editableItems.map(item => (
              <FormField
                key={`${id}-${item.field}`}
                label={item.label}
                constraintText={item.constraintText}
                errorText={fieldErrors[item.field]}
              >
                {renderEditableField(item)}
              </FormField>
            ))}
          </ColumnLayout>
        )}
        {preparedStaticItems.length > 0 && (
          <KeyValuePairs columns={columns} items={preparedStaticItems} />
        )}
      </SpaceBetween>
    </ExpandableSection>
  );
};
const IsetApplicationFormWidget = ({
  actions,
  application_id,
  caseData,
  toggleHelpPanel,
  refreshCaseData,
  onCaseUpdate,
  applicationRowVersion,
  onRowVersionUpdate
}) => {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(Boolean(application_id));
  const [loadError, setLoadError] = useState(null);
  const [flashbarItems, setFlashbarItems] = useState([]);
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const [consentDownloadLoading, setConsentDownloadLoading] = useState(false);
  const [authorizationModalVisible, setAuthorizationModalVisible] = useState(false);
  const [authorizationDownloadLoading, setAuthorizationDownloadLoading] = useState(false);
  const [clientAcknowledgementModalVisible, setClientAcknowledgementModalVisible] = useState(false);
  const [clientAcknowledgementDownloadLoading, setClientAcknowledgementDownloadLoading] = useState(false);
  const [indigenousModalVisible, setIndigenousModalVisible] = useState(false);
  const [indigenousDownloadLoading, setIndigenousDownloadLoading] = useState(false);
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [conflictDownloadLoading, setConflictDownloadLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableAnswers, setEditableAnswers] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsLoaded, setVersionsLoaded] = useState(false);
  const [versionError, setVersionError] = useState(null);
  const [versionDetails, setVersionDetails] = useState(null);
  const [versionDetailsLoading, setVersionDetailsLoading] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState(null);
  const {
    lockState,
    acquireLock,
    releaseLock,
    refreshLock: refreshLockHeartbeat,
    isLockedByMe
  } = useApplicationLock(application_id);
  const [locking, setLocking] = useState(false);
  const { userId: currentUserId, displayName: currentUserName } = useCurrentUser();
  const [bandSearchOptions, setBandSearchOptions] = useState({ affiliation: [], home: [] });
  const [bandSearchLoading, setBandSearchLoading] = useState({ affiliation: false, home: false });

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const pushFlash = useCallback(({ type, content }) => {
    const id = Date.now().toString();
    setFlashbarItems([{
      id,
      type,
      content,
      dismissible: true,
      onDismiss: () => setFlashbarItems(items => items.filter(item => item.id !== id))
    }]);
  }, []);

  const refreshApplication = useCallback(async () => {
    if (!application_id) {
      if (isMountedRef.current) {
        setApplication(null);
        setLoading(false);
      }
      return;
    }
    if (isMountedRef.current) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const res = await apiFetch(`/api/applications/${application_id}`);
      if (!res.ok) {
        let message = 'Failed to load application';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch (_) {}
        if (res.status === 404) message = 'Application not found';
        if (res.status === 401) message = 'Not authorized to view this application';
        const err = new Error(message);
        err.status = res.status;
        throw err;
      }
      const data = await res.json();
      const parsedRowVersion = Number(data?.row_version);
      data.row_version = Number.isFinite(parsedRowVersion) && parsedRowVersion > 0 ? parsedRowVersion : 0;
      let payload = data.payload_json;
      if (payload && typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (_) {
          payload = {};
        }
      }
      data.__payload = payload || {};
      if (isMountedRef.current) {
        setApplication(data);
        setLoadError(null);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setApplication(null);
        setLoadError(error?.message || 'Failed to load application');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [application_id]);

  useEffect(() => {
    refreshApplication();
  }, [refreshApplication]);

  useEffect(() => {
    setIsEditing(false);
    setShowEditConfirm(false);
    setEditableAnswers({});
    setVersionsLoaded(false);
    setVersions([]);
    setVersionDetails(null);
    setVersionError(null);
    releaseLock({ silent: true }).catch(() => {});
  }, [application_id, releaseLock]);

  const { answers, payload } = useMemo(() => {
    if (!application) return { answers: {}, payload: {} };
    const payload = application.__payload || {};
    const rawAnswers = payload.answers || payload.intake_answers || payload;
    return {
      payload,
      answers: rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {}
    };
  }, [application]);

  const [rowVersion, setRowVersion] = useState(() => {
    const fromProp = Number(applicationRowVersion || 0);
    const fromCase = Number(caseData?.application_row_version || 0);
    const fromApp = Number(application?.row_version || 0);
    return Math.max(fromProp || 0, fromCase || 0, fromApp || 0);
  });
  useEffect(() => {
    const incoming = Number(applicationRowVersion || 0);
    if (incoming && incoming > rowVersion) {
      setRowVersion(incoming);
    }
  }, [applicationRowVersion, rowVersion]);
  useEffect(() => {
    const incoming = Number(caseData?.application_row_version || 0);
    if (incoming && incoming > rowVersion) {
      setRowVersion(incoming);
      if (typeof onRowVersionUpdate === 'function') {
        onRowVersionUpdate(incoming);
      }
    }
  }, [caseData?.application_row_version, rowVersion, onRowVersionUpdate]);
  useEffect(() => {
    const incoming = Number(application?.row_version || 0);
    if (incoming && incoming > rowVersion) {
      setRowVersion(incoming);
      if (typeof onRowVersionUpdate === 'function') {
        onRowVersionUpdate(incoming);
      }
    }
  }, [application?.row_version, rowVersion, onRowVersionUpdate]);

  const schemaSnapshot = useMemo(() => {
    let snapshot = payload?.schema_snapshot || payload?.submission_snapshot?.schema_snapshot;
    if (snapshot && typeof snapshot === 'string') {
      try {
        snapshot = JSON.parse(snapshot);
      } catch (_) {
        snapshot = null;
      }
    }
    if (!snapshot) return null;
    if (snapshot.fields && typeof snapshot.fields === 'object') {
      return snapshot;
    }
    if (typeof snapshot === 'object') {
      return { fields: snapshot };
    }
    return null;
  }, [payload]);

  useEffect(() => {
    if (!isEditing) {
      setEditableAnswers(buildEditableAnswers(answers));
    }
  }, [answers, isEditing]);

  const handleFieldChange = useCallback((field, value) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (field === 'social-insurance-number') {
      setEditableAnswers(prev => ({ ...prev, [field]: normaliseSinInput(value) }));
      return;
    }
    if (field === 'registration-number') {
      setEditableAnswers(prev => {
        const targetKey = getRegistrationTargetKey({ ...answers, ...prev });
        return { ...prev, [field]: value, [targetKey]: value };
      });
      return;
    }
    setEditableAnswers(prev => ({ ...prev, [field]: value }));
  }, [answers]);

  const searchIndigenousBands = useCallback(async (query, key = 'affiliation') => {
    const targetKey = key || 'affiliation';
    const trimmed = (query || '').trim();
    if (trimmed.length < 2) {
      setBandSearchOptions(prev => ({ ...prev, [targetKey]: [] }));
      return;
    }
    setBandSearchLoading(prev => ({ ...prev, [targetKey]: true }));
    try {
      const res = await apiFetch(`/api/reference/indigenous-bands?query=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`);
      }
      const data = await res.json().catch(() => []);
      const options = Array.isArray(data)
        ? data
            .map(item => ({
              value: item.bandName || '',
              label: item.bandNumber ? `${item.bandName} (${item.bandNumber})` : (item.bandName || ''),
              description: item.type ? `Type: ${item.type}` : undefined,
            }))
            .filter(opt => opt.value)
        : [];
      setBandSearchOptions(prev => ({ ...prev, [targetKey]: options }));
    } catch (err) {
      console.error('Failed to search indigenous bands', err?.message || err);
    } finally {
      setBandSearchLoading(prev => ({ ...prev, [targetKey]: false }));
    }
  }, []);

  const validateEditableAnswers = useCallback((candidateAnswers = {}) => {
    const errors = {};
    const rawSin = candidateAnswers?.['social-insurance-number'];
    if (rawSin !== undefined && rawSin !== null && String(rawSin).trim() !== '') {
      const digitsOnly = String(rawSin).replace(/\D/g, '');
      if (!/^\d{9}$/.test(digitsOnly)) {
        errors['social-insurance-number'] = 'SIN must be exactly 9 digits.';
      } else if (!isValidSinChecksum(digitsOnly)) {
        errors['social-insurance-number'] = 'SIN checksum is invalid.';
      }
    }
    return errors;
  }, []);

  const handleOpenConsentModal = useCallback(() => {
    setConsentModalVisible(true);
  }, []);

  const handleCloseConsentModal = useCallback(() => {
    setConsentModalVisible(false);
  }, []);

  const handleOpenAuthorizationModal = useCallback(() => {
    setAuthorizationModalVisible(true);
  }, []);

  const handleCloseAuthorizationModal = useCallback(() => {
    setAuthorizationModalVisible(false);
  }, []);

  const handleOpenClientAcknowledgementModal = useCallback(() => {
    setClientAcknowledgementModalVisible(true);
  }, []);

  const handleCloseClientAcknowledgementModal = useCallback(() => {
    setClientAcknowledgementModalVisible(false);
  }, []);

  const handleOpenIndigenousModal = useCallback(() => {
    setIndigenousModalVisible(true);
  }, []);

  const handleCloseIndigenousModal = useCallback(() => {
    setIndigenousModalVisible(false);
  }, []);

  const handleOpenConflictModal = useCallback(() => {
    setConflictModalVisible(true);
  }, []);

  const handleCloseConflictModal = useCallback(() => {
    setConflictModalVisible(false);
  }, []);

  const diff = useMemo(() => answersDiff(answers, editableAnswers), [answers, editableAnswers]);
  const hasDirtyFields = isEditing && Object.keys(diff).length > 0;
  const decisionStatusSource = caseData?.applicationStatus || caseData?.application_status || caseData?.status || '';
  const reportingCaseContext = caseData?.caseContext || {};
  const reportingCorrectionAllowed = Boolean(
    reportingCaseContext?.reportingOnlyDeniedIneligible || reportingCaseContext?.reportingCorrectionAllowed
  );
  const isDecisionFinal = ['approved', 'rejected', 'declined', 'decision_ready', 'completed'].includes(
    decisionStatusSource.toLowerCase()
  );
  const isDecisionEditLocked = isDecisionFinal && !reportingCorrectionAllowed;
  const reportingComplianceStatus = caseData?.compliance?.ilmp?.status || 'pending';
  const reportingStatusMessage = reportingCorrectionAllowed
    ? (
      reportingComplianceStatus === 'clean'
        ? 'This denied-ineligible record is valid for ILMP reporting and will flow into the ESDC queue automatically.'
        : reportingComplianceStatus === 'blocked'
          ? 'This denied-ineligible record is blocked from ILMP reporting until the missing or invalid data below is corrected.'
          : reportingComplianceStatus === 'warning'
            ? 'This denied-ineligible record still needs ILMP review before it can be included in ESDC reporting.'
            : 'This denied-ineligible record stays editable here so ILMP reporting data can be corrected without opening Case Workspace.'
    )
    : '';
  const activeLock = useMemo(() => {
    if (lockState.owned && lockState.lock) {
      return lockState.lock;
    }
    if (application?.lock_owner_id || application?.lock_owner_name || application?.lock_owner_email) {
      return {
        applicationId: application_id || null,
        ownerUserId: application?.lock_owner_id ? String(application.lock_owner_id) : null,
        ownerDisplayName: application?.lock_owner_name || null,
        ownerEmail: application?.lock_owner_email || null,
        expiresAt: application?.lock_expires_at || null,
        acquiredAt: null,
        ttlMinutes: null,
        heartbeatMinutes: null,
        reused: false
      };
    }
    return null;
  }, [
    application?.lock_expires_at,
    application?.lock_owner_email,
    application?.lock_owner_id,
    application?.lock_owner_name,
    application_id,
    lockState.lock,
    lockState.owned
  ]);
  const lockOwnerId = activeLock?.ownerUserId ? String(activeLock.ownerUserId) : null;
  const lockHeldByCurrentUser = Boolean(isLockedByMe || (currentUserId && lockOwnerId && String(currentUserId) === lockOwnerId));
  const lockedByAnotherUser = Boolean(lockOwnerId && !lockHeldByCurrentUser);

  useEffect(() => {
    if (isDecisionEditLocked) {
      setIsEditing(false);
      setShowEditConfirm(false);
      releaseLock({ silent: true }).catch(() => {});
    }
  }, [isDecisionEditLocked, releaseLock]);

  const handleRequestEdit = useCallback(() => {
    if (isDecisionEditLocked) return;
    if (lockedByAnotherUser) {
      pushFlash({ type: 'warning', content: buildLockConflictMessage({ reason: 'owned_by_other', lock: activeLock }) });
      return;
    }
    setShowEditConfirm(true);
  }, [activeLock, isDecisionEditLocked, lockedByAnotherUser, pushFlash]);

  const handleConfirmEdit = useCallback(async () => {
    if (isDecisionEditLocked || locking || lockedByAnotherUser) return;
    setLocking(true);
    const result = await acquireLock();
    setLocking(false);
    if (!result?.ok) {
      const message = buildLockConflictMessage(result);
      pushFlash({ type: result?.status === 423 ? 'info' : 'error', content: message });
      return;
    }
    setShowEditConfirm(false);
    setIsEditing(true);
    setFieldErrors({});
    setEditableAnswers(buildEditableAnswers(answers));
  }, [acquireLock, answers, isDecisionEditLocked, locking, lockedByAnotherUser, pushFlash]);

  const handleCancelEditing = useCallback(() => {
    setIsEditing(false);
    setFieldErrors({});
    setEditableAnswers(buildEditableAnswers(answers));
    releaseLock({ silent: true }).catch(() => {});
  }, [answers, releaseLock]);

  const handleSave = useCallback(async () => {
    if (!application_id) return;
    const validationErrors = validateEditableAnswers(editableAnswers);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      pushFlash({ type: 'error', content: 'Please correct validation errors before saving.' });
      return;
    }
    const changes = answersDiff(answers, editableAnswers);
    if (!Object.keys(changes).length) {
      setIsEditing(false);
      setFieldErrors({});
      releaseLock({ silent: true }).catch(() => {});
      pushFlash({ type: 'info', content: 'No changes to save' });
      return;
    }
    if (!rowVersion) {
      pushFlash({ type: 'error', content: 'Unable to determine the current application version. Reload and try again.' });
      return;
    }
    setSaving(true);
    try {
      let releaseAfterSuccess = false;
      if (!lockState.owned) {
        const lockResult = await acquireLock();
        if (!lockResult?.ok) {
          const message = buildLockConflictMessage(lockResult);
          pushFlash({ type: lockResult?.status === 423 ? 'warning' : 'error', content: message });
          setIsEditing(false);
          releaseLock({ silent: true }).catch(() => {});
          return;
        }
        releaseAfterSuccess = Boolean(lockResult.localOwner);
      } else if (lockHeldByCurrentUser) {
        refreshLockHeartbeat().catch(() => {});
        releaseAfterSuccess = true;
      }

      const response = await apiFetch(`/api/applications/${application_id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: changes, expectedRowVersion: rowVersion })
      });
      let body = null;
      try {
        body = await response.json();
      } catch (_) {
        body = null;
      }

      if (!response.ok) {
        if (response.status === 423) {
          const message = buildLockConflictMessage({ reason: body?.reason || body?.error, lock: body?.lock });
          pushFlash({ type: 'warning', content: message });
          setIsEditing(false);
          setShowEditConfirm(false);
          setVersionsLoaded(false);
          releaseLock({ silent: true }).catch(() => {});
          await refreshApplication();
          return;
        }
        if (response.status === 409) {
          const current = Number(body?.currentRowVersion ?? body?.application_row_version);
          if (Number.isFinite(current) && current > 0) {
            setRowVersion(prev => (current > prev ? current : prev));
            if (typeof onRowVersionUpdate === 'function') {
              onRowVersionUpdate(current);
            }
            setApplication(prev => (prev ? { ...prev, row_version: current } : prev));
          }
          pushFlash({
            type: 'warning',
            content: 'Someone else updated this application first. We reloaded the latest data-review it and try again.'
          });
          setIsEditing(false);
          setShowEditConfirm(false);
          setVersionsLoaded(false);
          releaseLock({ silent: true }).catch(() => {});
          await refreshApplication();
          return;
        }
        const message = body?.message || body?.error || 'Failed to save application updates';
        const err = new Error(message);
        err.status = response.status;
        throw err;
      }

      setIsEditing(false);
      setShowEditConfirm(false);
      setFieldErrors({});
      setVersionsLoaded(false);
      pushFlash({ type: 'success', content: 'Application updates saved' });
      await refreshApplication();
      let refreshedVersion = null;
      if (typeof refreshCaseData === 'function') {
        try {
          const refreshed = await refreshCaseData();
          refreshedVersion = Number(refreshed?.application_row_version || refreshed?.applicationRowVersion || 0);
          if (refreshedVersion) {
            setRowVersion(prev => (refreshedVersion > prev ? refreshedVersion : prev));
            if (typeof onRowVersionUpdate === 'function') {
              onRowVersionUpdate(refreshedVersion);
            }
          }
        } catch (_) {}
      }
      if (typeof onCaseUpdate === 'function') {
        onCaseUpdate({
          application_row_version: refreshedVersion || rowVersion || null
        });
      }
      if (releaseAfterSuccess) {
        releaseLock({ silent: true }).catch(() => {});
      }
    } catch (error) {
      pushFlash({ type: 'error', content: error?.message || 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  }, [
    acquireLock,
    answers,
    application_id,
    rowVersion,
    editableAnswers,
    validateEditableAnswers,
    lockHeldByCurrentUser,
    lockState.owned,
    pushFlash,
    refreshApplication,
    releaseLock,
    refreshLockHeartbeat,
    refreshCaseData,
    onCaseUpdate,
    onRowVersionUpdate
  ]);
  const fetchVersionsList = useCallback(async () => {
    if (!application_id) return;
    setVersionsLoading(true);
    setVersionError(null);
    try {
      const res = await apiFetch(`/api/applications/${application_id}/versions`);
      if (!res.ok) {
        let message = 'Failed to load version history';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch (_) {}
        throw new Error(message);
      }
      const data = await res.json();
      const processed = (data?.versions || []).map(item => ({
        ...item,
        rowId: item.id === null || item.id === undefined ? `current-${item.version}` : String(item.id)
      }));
      if (isMountedRef.current) {
        setVersions(processed);
        setVersionsLoaded(true);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setVersionError(error?.message || 'Failed to load version history');
      }
    } finally {
      if (isMountedRef.current) {
        setVersionsLoading(false);
      }
    }
  }, [application_id]);

  const handleOpenVersionModal = useCallback(() => {
    setVersionModalVisible(true);
    setVersionDetails(null);
    setVersionError(null);
    if (!versionsLoaded) {
      fetchVersionsList();
    }
  }, [fetchVersionsList, versionsLoaded]);

  const handleViewVersionsFromModal = useCallback(() => {
    setShowEditConfirm(false);
    handleOpenVersionModal();
  }, [handleOpenVersionModal]);

  const closeVersionModal = useCallback(() => {
    setVersionModalVisible(false);
    setVersionDetails(null);
    setVersionError(null);
    setVersionDetailsLoading(false);
  }, []);

  const handleViewVersion = useCallback(async (versionRow) => {
    if (!application_id) return;
    const versionIdentifier = versionRow?.id ?? 'current';
    setVersionDetailsLoading(true);
    setVersionError(null);
    try {
      const res = await apiFetch(`/api/applications/${application_id}/versions/${versionIdentifier}`);
      if (!res.ok) {
        let message = 'Failed to load version details';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch (_) {}
        throw new Error(message);
      }
      const data = await res.json();
      if (isMountedRef.current) {
        setVersionDetails(data);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setVersionError(error?.message || 'Failed to load version details');
      }
    } finally {
      if (isMountedRef.current) {
        setVersionDetailsLoading(false);
      }
    }
  }, [application_id]);

  const handleRestoreVersion = useCallback(async (versionRow) => {
    if (!application_id || !versionRow?.id || !versionRow?.canRestore) return;
    if (!rowVersion) {
      pushFlash({ type: 'error', content: 'Unable to determine the current application version. Reload and try again.' });
      return;
    }
    setRestoringVersionId(versionRow.id);
    setVersionError(null);
    try {
      if (!lockState.owned) {
        const lockResult = await acquireLock();
        if (!lockResult?.ok) {
          const message = buildLockConflictMessage(lockResult);
          pushFlash({ type: lockResult?.status === 423 ? 'warning' : 'error', content: message });
          setRestoringVersionId(null);
          return;
        }
      } else if (lockHeldByCurrentUser) {
        refreshLockHeartbeat().catch(() => {});
      }

      const response = await apiFetch(`/api/applications/${application_id}/versions/${versionRow.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRowVersion: rowVersion })
      });
      let body = null;
      try {
        body = await response.json();
      } catch (_) {
        body = null;
      }

      if (!response.ok) {
        if (response.status === 423) {
          const message = buildLockConflictMessage({ reason: body?.reason || body?.error, lock: body?.lock });
          pushFlash({ type: 'warning', content: message });
          setIsEditing(false);
          releaseLock({ silent: true }).catch(() => {});
          await refreshApplication();
          await fetchVersionsList();
          setVersionDetails(null);
          return;
        }
        if (response.status === 409) {
          const current = Number(body?.currentRowVersion ?? body?.application_row_version);
          if (Number.isFinite(current) && current > 0) {
            setRowVersion(prev => (current > prev ? current : prev));
            if (typeof onRowVersionUpdate === 'function') {
              onRowVersionUpdate(current);
            }
            setApplication(prev => (prev ? { ...prev, row_version: current } : prev));
          }
          pushFlash({
            type: 'warning',
            content: 'Someone else updated this application while you were viewing history. We reloaded the latest data.'
          });
          releaseLock({ silent: true }).catch(() => {});
          await refreshApplication();
          await fetchVersionsList();
          setVersionDetails(null);
          setIsEditing(false);
          return;
        }
        const message = body?.error || 'Failed to restore version';
        const err = new Error(message);
        err.status = response.status;
        throw err;
      }

      const restoredVersion = Number(body?.version) || versionRow.version;
      pushFlash({ type: 'success', content: `Restored version ${restoredVersion}` });
      await refreshApplication();
      let refreshedVersion = null;
      if (typeof refreshCaseData === 'function') {
        try {
          const refreshed = await refreshCaseData();
          refreshedVersion = Number(refreshed?.application_row_version || refreshed?.applicationRowVersion || 0);
          if (refreshedVersion) {
            setRowVersion(prev => (refreshedVersion > prev ? refreshedVersion : prev));
            if (typeof onRowVersionUpdate === 'function') {
              onRowVersionUpdate(refreshedVersion);
            }
          }
        } catch (_) {}
      }
      if (typeof onCaseUpdate === 'function') {
        onCaseUpdate({
          application_row_version: refreshedVersion || rowVersion || null
        });
      }
      await fetchVersionsList();
      closeVersionModal();
      setIsEditing(false);
      releaseLock({ silent: true }).catch(() => {});
    } catch (error) {
      pushFlash({ type: 'error', content: error?.message || 'Failed to restore version' });
    } finally {
      setRestoringVersionId(null);
    }
  }, [
    acquireLock,
    application_id,
    rowVersion,
    fetchVersionsList,
    lockHeldByCurrentUser,
    lockState.owned,
    pushFlash,
    refreshApplication,
    releaseLock,
    refreshLockHeartbeat,
    refreshCaseData,
    onCaseUpdate,
    onRowVersionUpdate,
    closeVersionModal
  ]);

  const renderEditableField = useCallback((item) => {
    const fieldKey = item.field;
    const controlType = item.controlType || 'input';
    const value = editableAnswers?.[fieldKey];
    const options = item.options || getOptionsForField(item.optionsKey || fieldKey, schemaSnapshot || { fields: {} }, OPTION_LABELS[item.optionsKey || fieldKey]);
    const disabled = saving || item.disabled;
    if (controlType === 'textarea') {
      return (
        <Textarea
          rows={item.rows || 3}
          value={value ?? ''}
          onChange={({ detail }) => handleFieldChange(fieldKey, detail.value)}
          disabled={disabled}
        />
      );
    }
    if (controlType === 'multiselect') {
      const selectedValues = Array.isArray(value)
        ? value.map(String)
        : value === null || value === undefined || value === '' ? [] : [String(value)];
      const selectedOptions = options.filter(opt => selectedValues.includes(String(opt.value)));
      return (
        <Multiselect
          options={options}
          selectedOptions={selectedOptions}
          placeholder={item.placeholder || 'Select options'}
          onChange={({ detail }) => handleFieldChange(fieldKey, detail.selectedOptions.map(opt => opt.value))}
          disabled={disabled}
        />
      );
    }
    if (controlType === 'select') {
      const selected = options.find(opt => String(opt.value) === String(value ?? '')) || null;
      return (
        <Select
          options={options}
          selectedOption={selected}
          placeholder={item.placeholder || 'Select'}
          onChange={({ detail }) => handleFieldChange(fieldKey, detail.selectedOption?.value ?? '')}
          disabled={disabled}
        />
      );
    }
    if (controlType === 'band-search') {
      const stateKey = item.bandSearchKey || fieldKey;
      const optionsForKey = bandSearchOptions[stateKey] || [];
      const loadingForKey = bandSearchLoading[stateKey];
      return (
        <Autosuggest
          value={value ?? ''}
          options={optionsForKey}
          loadingText="Searching communities..."
          statusType={loadingForKey ? 'loading' : 'finished'}
          expandToViewport
          empty={loadingForKey ? 'Searching communities...' : 'No matches'}
          placeholder={item.placeholder || 'Search communities'}
          onChange={({ detail }) => {
            const next = detail.value || '';
            handleFieldChange(fieldKey, next);
            const query = next.trim();
            if (query.length >= 2) {
              searchIndigenousBands(query, stateKey);
            } else {
              setBandSearchOptions(prev => ({ ...prev, [stateKey]: [] }));
            }
          }}
          onSelect={({ detail }) => {
            handleFieldChange(fieldKey, detail.value || '');
          }}
          disabled={disabled}
        />
      );
    }
    if (controlType === 'date') {
      return (
        <Input
          type="date"
          value={value ?? ''}
          onChange={({ detail }) => handleFieldChange(fieldKey, detail.value)}
          disabled={disabled}
        />
      );
    }
    if (controlType === 'currency') {
      return (
        <Input
          value={value ?? ''}
          onChange={({ detail }) => handleFieldChange(fieldKey, detail.value)}
          inputMode="decimal"
          placeholder="$0"
          disabled={disabled}
        />
      );
    }
    return (
      <Input
        value={fieldKey === 'social-insurance-number' ? normaliseSinInput(value) : (value ?? '')}
        onChange={({ detail }) => handleFieldChange(fieldKey, detail.value)}
        inputMode={fieldKey === 'social-insurance-number' ? 'numeric' : undefined}
        maxLength={fieldKey === 'social-insurance-number' ? 9 : undefined}
        disabled={disabled}
      />
    );
  }, [bandSearchLoading, bandSearchOptions, editableAnswers, handleFieldChange, saving, schemaSnapshot, searchIndigenousBands]);
  const versionColumns = useMemo(() => [
    {
      id: 'version',
      header: 'Version',
      minWidth: 140,
      cell: item => {
        const qualifiers = [];
        if (item.isCurrent) qualifiers.push('current');
        if (item.isOriginal) qualifiers.push('original submission');
        const suffix = qualifiers.length ? ` (${qualifiers.join(' · ')})` : '';
        return `v${item.version}${suffix}`;
      }
    },
    {
      id: 'savedAt',
      header: 'Saved at',
      minWidth: 170,
      cell: item => formatDateTime(item.savedAt)
    },
    {
      id: 'savedBy',
      header: 'Changes Saved by',
      minWidth: 170,
      cell: item => item.savedBy || '—'
    },
    {
      id: 'actions',
      header: 'Actions',
      minWidth: 110,
      cell: item => (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'nowrap' }}>
          <Button variant="inline-link" onClick={() => handleViewVersion(item)} disabled={versionDetailsLoading}>
            View changes
          </Button>
          {item.canRestore ? (
            <Button
              variant="inline-link"
              onClick={() => handleRestoreVersion(item)}
              disabled={restoringVersionId === item.id}
              loading={restoringVersionId === item.id}
            >
              Restore
            </Button>
          ) : null}
        </div>
      )
    }
  ], [handleRestoreVersion, handleViewVersion, restoringVersionId, versionDetailsLoading]);

  const sectionDefinitions = useMemo(
    () =>
      buildSectionDefinitions({
        onOpenConsentModal: handleOpenConsentModal,
        onOpenIndigenousModal: handleOpenIndigenousModal,
        onOpenAuthorizationModal: handleOpenAuthorizationModal,
        onOpenClientAcknowledgementModal: handleOpenClientAcknowledgementModal,
        onOpenConflictModal: handleOpenConflictModal
      }),
    [
      handleOpenConsentModal,
      handleOpenIndigenousModal,
      handleOpenAuthorizationModal,
      handleOpenClientAcknowledgementModal,
      handleOpenConflictModal
    ]
  );
  const fieldLabelLookup = useMemo(() => {
    const lookup = new Map();
    const fromSchema = schemaSnapshot?.fields && typeof schemaSnapshot.fields === 'object'
      ? Object.entries(schemaSnapshot.fields)
      : [];
    fromSchema.forEach(([key, field]) => {
      const schemaLabel = extractOptionLabel(field?.label);
      if (schemaLabel) lookup.set(key, schemaLabel);
    });
    sectionDefinitions.forEach(section => {
      (section?.items || []).forEach(item => {
        if (!item?.field) return;
        const label = normaliseFieldLabel(item.label);
        if (label && !lookup.has(item.field)) {
          lookup.set(item.field, label);
        }
      });
    });
    return lookup;
  }, [schemaSnapshot, sectionDefinitions]);
  const versionDiffRows = useMemo(() => {
    if (!versionDetails) return [];
    const selectedAnswers = versionDetails?.payload?.answers && typeof versionDetails.payload.answers === 'object'
      ? versionDetails.payload.answers
      : {};
    const currentAnswers = answers && typeof answers === 'object' ? answers : {};
    const keys = new Set([...Object.keys(currentAnswers), ...Object.keys(selectedAnswers)]);
    const rows = [];
    keys.forEach(key => {
      if (!key || key === 'registration-number') return;
      const currentValue = currentAnswers[key];
      const selectedValue = selectedAnswers[key];
      if (areValuesEqual(currentValue, selectedValue)) return;
      rows.push({
        id: key,
        field: fieldLabelLookup.get(key) || toDisplayLabel(key),
        currentValue: summariseDiffValue(currentValue),
        selectedValue: summariseDiffValue(selectedValue)
      });
    });
    rows.sort((a, b) => a.field.localeCompare(b.field));
    return rows;
  }, [answers, fieldLabelLookup, versionDetails]);

  const consentSignature = answers?.consent || {};
  const consentSignedName = consentSignature?.name || 'Not provided';
  const consentSigned = Boolean(consentSignature?.signed);
  const consentSignedAtRaw = resolveSignatureTimestamp(consentSignature);
  const submissionTimestampRaw =
    application?.submitted_at ||
    payload?.submission_snapshot?.submitted_at ||
    payload?.submitted_at ||
    application?.created_at ||
    payload?.ingested_at ||
    null;
  const displayTimestamp = consentSignedAtRaw || submissionTimestampRaw;
  const consentSignedAt = displayTimestamp ? formatDateTime(displayTimestamp) : '-';

  const authorizationSignature = (
    answers?.auth_froici_sing ||
    answers?.auth_froici_sign ||
    answers?.authorization_for_release_of_iset_client_information ||
    {}
  );
  const authorizationSignedName = authorizationSignature?.name || 'Not provided';
  const authorizationSigned = Boolean(authorizationSignature?.signed);
  const authorizationSignedAtRaw = resolveSignatureTimestamp(authorizationSignature);
  const authorizationDisplayTimestamp = authorizationSignedAtRaw || submissionTimestampRaw;
  const authorizationSignedAt = authorizationDisplayTimestamp ? formatDateTime(authorizationDisplayTimestamp) : '-';
  const clientAcknowledgementSignature = answers?.sig_caofs || {};
  const clientAcknowledgementSignedName = clientAcknowledgementSignature?.name || 'Not provided';
  const clientAcknowledgementSigned = Boolean(clientAcknowledgementSignature?.signed);
  const clientAcknowledgementSignedAtRaw = resolveSignatureTimestamp(clientAcknowledgementSignature);
  const clientAcknowledgementDisplayTimestamp = clientAcknowledgementSignedAtRaw || submissionTimestampRaw;
  const clientAcknowledgementSignedAt = clientAcknowledgementDisplayTimestamp
    ? formatDateTime(clientAcknowledgementDisplayTimestamp)
    : '-';

  const indigenousSignature = answers?.indigenous_declaration || {};
  const indigenousSignedName = indigenousSignature?.name || 'Not provided';
  const indigenousSigned = Boolean(indigenousSignature?.signed);
  const indigenousSignedAtRaw = resolveSignatureTimestamp(indigenousSignature);
  const indigenousDisplayTimestamp = indigenousSignedAtRaw || submissionTimestampRaw;
  const indigenousSignedAt = indigenousDisplayTimestamp ? formatDateTime(indigenousDisplayTimestamp) : '-';
  const indigenousAffiliation = answers?.['indigenous-affiliation-declaration'] || '';
  const conflictSignature = answers?.conflict_applicant_signature || {};
  const conflictSignedName = conflictSignature?.name || 'Not provided';
  const conflictSigned = Boolean(conflictSignature?.signed);
  const conflictSignedAtRaw = resolveSignatureTimestamp(conflictSignature);
  const conflictDisplayTimestamp = conflictSignedAtRaw || submissionTimestampRaw;
  const conflictSignedAt = conflictDisplayTimestamp ? formatDateTime(conflictDisplayTimestamp) : '-';
  const conflictSelectionRaw = (answers?.conflict_of_interest ?? '').toString().trim().toLowerCase();
  const conflictSelection = conflictSelectionRaw || 'no_conflict';
  const conflictOptionLabel = CONFLICT_OPTION_LABELS[conflictSelection] || CONFLICT_OPTION_LABELS.no_conflict;
  const conflictExplanation = answers?.['2022_conflict_follow'] || '';

  const handleDownloadConsent = useCallback(async () => {
    if (typeof window === 'undefined' || !application?.id) return;
    setConsentDownloadLoading(true);
    try {
      const response = await apiFetch('/api/consent-letter/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          consentSigned,
          consentSignedName,
          consentSignedAt: displayTimestamp
        })
      });
      if (!response.ok) {
        let message = 'Failed to download consent letter';
        try {
          const errBody = await response.json();
          if (errBody?.error) message = errBody.error;
        } catch (_) {}
        throw new Error(message);
      }
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Consent PDF response was empty');
      }
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `client-ei-consent-${application.id}.pdf`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      pushFlash({ type: 'error', content: error?.message || 'Failed to download consent letter' });
    } finally {
      setConsentDownloadLoading(false);
    }
  }, [application?.id, consentSigned, consentSignedName, displayTimestamp, pushFlash]);

  const handleDownloadAuthorization = useCallback(async () => {
    if (typeof window === 'undefined' || !application?.id) return;
    setAuthorizationDownloadLoading(true);
    try {
      const response = await apiFetch('/api/authorization-release/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          declarationSigned: authorizationSigned,
          declarationSignedName: authorizationSignedName,
          declarationSignedAt: authorizationDisplayTimestamp
        })
      });
      if (!response.ok) {
        let message = 'Failed to download authorization for release form';
        try {
          const errBody = await response.json();
          if (errBody?.error) message = errBody.error;
        } catch (_) {}
        throw new Error(message);
      }
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Authorization release response was empty');
      }
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `authorization-release-iset-client-information-${application.id}.pdf`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      pushFlash({ type: 'error', content: error?.message || 'Failed to download authorization for release form' });
    } finally {
      setAuthorizationDownloadLoading(false);
    }
  }, [
    application?.id,
    authorizationSigned,
    authorizationSignedName,
    authorizationDisplayTimestamp,
    pushFlash
  ]);

  const handleDownloadClientAcknowledgement = useCallback(async () => {
    if (typeof window === 'undefined' || !application?.id) return;
    setClientAcknowledgementDownloadLoading(true);
    try {
      const response = await apiFetch('/api/client-acknowledgement/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          declarationSigned: clientAcknowledgementSigned,
          declarationSignedName: clientAcknowledgementSignedName,
          declarationSignedAt: clientAcknowledgementDisplayTimestamp
        })
      });
      if (!response.ok) {
        let message = 'Failed to download client acknowledgement of funding source';
        try {
          const errBody = await response.json();
          if (errBody?.error) message = errBody.error;
        } catch (_) {}
        throw new Error(message);
      }
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Client acknowledgement response was empty');
      }
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `client-acknowledgement-of-funding-source-${application.id}.pdf`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      pushFlash({ type: 'error', content: error?.message || 'Failed to download client acknowledgement of funding source' });
    } finally {
      setClientAcknowledgementDownloadLoading(false);
    }
  }, [
    application?.id,
    clientAcknowledgementSigned,
    clientAcknowledgementSignedName,
    clientAcknowledgementDisplayTimestamp,
    pushFlash
  ]);

  const handleDownloadIndigenous = useCallback(async () => {
    if (typeof window === 'undefined' || !application?.id) return;
    setIndigenousDownloadLoading(true);
    try {
      const response = await apiFetch('/api/indigenous-declaration/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          declarationSigned: indigenousSigned,
          declarationSignedName: indigenousSignedName,
          declarationSignedAt: indigenousSignedAtRaw || submissionTimestampRaw,
          affiliation: indigenousAffiliation
        })
      });
      if (!response.ok) {
        let message = 'Failed to download Indigenous declaration';
        try {
          const errBody = await response.json();
          if (errBody?.error) message = errBody.error;
        } catch (_) {}
        throw new Error(message);
      }
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Indigenous declaration response was empty');
      }
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `indigenous-declaration-${application.id}.pdf`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      pushFlash({ type: 'error', content: error?.message || 'Failed to download Indigenous declaration' });
    } finally {
      setIndigenousDownloadLoading(false);
    }
  }, [
    application?.id,
    indigenousAffiliation,
    indigenousSigned,
    indigenousSignedName,
    indigenousSignedAtRaw,
    submissionTimestampRaw,
    pushFlash
  ]);

  const handleDownloadConflict = useCallback(async () => {
    if (typeof window === 'undefined' || !application?.id) return;
    setConflictDownloadLoading(true);
    try {
      const response = await apiFetch('/api/conflict-declaration/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          declarationSigned: conflictSigned,
          declarationSignedName: conflictSignedName,
          declarationSignedAt: conflictSignedAtRaw || submissionTimestampRaw,
          selection: conflictSelection,
          optionLabel: conflictOptionLabel,
          explanation: conflictExplanation
        })
      });
      if (!response.ok) {
        let message = 'Failed to download conflict of interest declaration';
        try {
          const errBody = await response.json();
          if (errBody?.error) message = errBody.error;
        } catch (_) {}
        throw new Error(message);
      }
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Conflict declaration response was empty');
      }
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `conflict-declaration-${application.id}.pdf`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      pushFlash({ type: 'error', content: error?.message || 'Failed to download conflict of interest declaration' });
    } finally {
      setConflictDownloadLoading(false);
    }
  }, [
    application?.id,
    conflictSigned,
    conflictSignedName,
    conflictSignedAtRaw,
    conflictSelection,
    conflictOptionLabel,
    conflictExplanation,
    submissionTimestampRaw,
    pushFlash
  ]);

  const employmentNarrativeReadOnly = renderTextBlock(answers['long-term-goal']);
  const employmentNarrativeValue = editableAnswers['long-term-goal'] ?? '';
  const showEmploymentNarrative = isEditing || employmentNarrativeReadOnly !== NOT_PROVIDED;
  const currentApplicationStatus = (caseData?.applicationStatus || caseData?.status || application?.status || '')
    .toString()
    .trim()
    .toLowerCase();
  const isClosedStatus = currentApplicationStatus === 'closed' || currentApplicationStatus === 'withdrawn';
  const employmentGoalsIndex = useMemo(
    () => sectionDefinitions.findIndex(section => section.id === 'employment-goals'),
    [sectionDefinitions]
  );
  const sectionsBeforeEmploymentGoals = useMemo(
    () => (employmentGoalsIndex >= 0 ? sectionDefinitions.slice(0, employmentGoalsIndex) : sectionDefinitions),
    [employmentGoalsIndex, sectionDefinitions]
  );
  const sectionsAfterEmploymentGoals = useMemo(
    () => (employmentGoalsIndex >= 0 ? sectionDefinitions.slice(employmentGoalsIndex) : []),
    [employmentGoalsIndex, sectionDefinitions]
  );

  const headerActions = (
    <SpaceBetween direction="horizontal" size="xs">
      {isEditing && !isDecisionEditLocked ? (

        <>
          <Button onClick={handleOpenVersionModal} disabled={saving}>
            View versions
          </Button>
          <Button onClick={handleSave} disabled={!hasDirtyFields || saving} loading={saving} variant="primary">
            Save
          </Button>
          <Button onClick={handleCancelEditing} disabled={saving}>
            Cancel
          </Button>
        </>
      ) : (
        <Button
          onClick={handleRequestEdit}
          disabled={loading || !application || isDecisionEditLocked || lockedByAnotherUser || isClosedStatus}
          variant="primary"
        >
          Edit
        </Button>
      )}
    </SpaceBetween>
  );

  return (
    <BoardItem
      header={
        <Header
          info={
            <Link
              variant="info"
              onFollow={() =>
                toggleHelpPanel &&
                toggleHelpPanel(
                  <IsetApplicationFormHelpPanelContent />,
                  'ISET Application Form Help',
                  IsetApplicationFormHelpPanelContent.aiContext || ''
                )
              }
            >
              Info
            </Link>
          }
          actions={headerActions}
        >
          <Hotspot hotspotId="app-workspace-application-form" direction="right" />
          ISET Application Form
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        actions && actions.removeItem && (
          <ButtonDropdown
            items={[{ id: 'remove', text: 'Remove' }]}
            ariaLabel="Board item settings"
            variant="icon"
            onItemClick={() => actions.removeItem()}
          />
        )
      }
    >
      {loading ? (
        'Loading...'
      ) : loadError ? (
        <Box color="text-status-critical">{loadError}</Box>
      ) : (
        <>
          {flashbarItems.length > 0 && (
            <Box margin={{ bottom: 's' }}>
              <Flashbar items={flashbarItems} />
            </Box>
          )}
          {reportingCorrectionAllowed && (
            <Box margin={{ bottom: 's' }}>
              <Alert
                type={
                  reportingComplianceStatus === 'clean'
                    ? 'success'
                    : reportingComplianceStatus === 'blocked'
                      ? 'error'
                      : reportingComplianceStatus === 'warning'
                        ? 'warning'
                        : 'info'
                }
              >
                {reportingStatusMessage}
              </Alert>
            </Box>
          )}
          <Box variant="small" margin={{ bottom: 's' }}>
            This view presents the applicant's submitted ISET application. Review each section for accuracy, capture clarifications when needed, and use edit mode to publish updates to the case file.
          </Box>
          <SpaceBetween size="l">
            {sectionsBeforeEmploymentGoals.map(section => (
              <Section
                key={section.id}
                {...section}
                isEditing={isEditing}
                answers={answers}
                editableAnswers={editableAnswers}
                renderEditableField={renderEditableField}
                onFieldChange={handleFieldChange}
                fieldErrors={fieldErrors}
                saving={saving}
              />
            ))}
            {showEmploymentNarrative && (
              <ExpandableSection
                headerText="Employment goal narrative"
                headerDescription="Applicant's description of their long-term employment objective."
                defaultExpanded={false}
              >
                {isEditing && !isDecisionEditLocked ? (
                  <Textarea
                    rows={5}
                    value={employmentNarrativeValue}
                    onChange={({ detail }) => handleFieldChange('long-term-goal', detail.value)}
                    disabled={saving}
                  />
                ) : (
                  employmentNarrativeReadOnly
                )}
              </ExpandableSection>
            )}
            {sectionsAfterEmploymentGoals.map(section => (
              <Section
                key={section.id}
                {...section}
                isEditing={isEditing}
                answers={answers}
                editableAnswers={editableAnswers}
                renderEditableField={renderEditableField}
                onFieldChange={handleFieldChange}
                fieldErrors={fieldErrors}
                saving={saving}
              />
            ))}
          </SpaceBetween>
        </>
      )}
      {showEditConfirm && (
        <Modal
          visible
          header="Enable editing"
          onDismiss={() => setShowEditConfirm(false)}
          footer={
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <div style={{ marginRight: 'auto' }}>
                <Button onClick={handleViewVersionsFromModal} disabled={versionsLoading}>
                  View versions
                </Button>
              </div>
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setShowEditConfirm(false)} variant="link">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmEdit}
                  loading={locking}
                  disabled={locking || lockedByAnotherUser}
                >
                  Enable editing
                </Button>
              </SpaceBetween>
            </div>
          }
        >
          <SpaceBetween size="s">
            <Box>
              Editing creates a new version of the application record. The original applicant submission remains available in the version history.
            </Box>
            <Box>
              Use the View versions button to review earlier versions or restore one if you need to undo changes.
            </Box>
          </SpaceBetween>
        </Modal>
      )}
      {versionModalVisible && (
        <Modal
          visible
          header="Version history"
          size="large"
          onDismiss={closeVersionModal}
          footer={
            <SpaceBetween direction="horizontal" size="xs" alignItems="end">
              <Button onClick={closeVersionModal} variant="primary">
                Close
              </Button>
            </SpaceBetween>
          }
        >
          {versionError ? <Box color="text-status-critical" margin={{ bottom: 's' }}>{versionError}</Box> : null}
          <Table
            header={
              <Header
                variant="h3"
                actions={
                  <Button onClick={fetchVersionsList} disabled={versionsLoading} iconName="refresh">
                    Refresh
                  </Button>
                }
              >
                Saved versions
              </Header>
            }
            items={versions}
            trackBy="rowId"
            columnDefinitions={versionColumns}
            resizableColumns
            loading={versionsLoading}
            loadingText="Loading versions"
            empty={<Box>No saved versions yet</Box>}
          />
          {versionDetailsLoading ? <Box margin={{ top: 's' }}><Spinner /></Box> : null}
          {versionDetails && !versionDetailsLoading ? (
            <Box margin={{ top: 's' }}>
              <Header
                variant="h3"
                description={`Compared with current version (v${versions.find(item => item.isCurrent)?.version || 'current'})`}
              >
                {versionDetails.id ? `Changes in v${versionDetails.version}` : 'Changes in current version'}
              </Header>
              {versionDetails.id === null ? (
                <Box variant="small" color="text-body-secondary">Select an older version to view differences.</Box>
              ) : versionDiffRows.length ? (
                <Table
                  variant="embedded"
                  trackBy="id"
                  items={versionDiffRows}
                  columnDefinitions={[
                    { id: 'field', header: 'Field', cell: item => item.field, minWidth: 220 },
                    { id: 'currentValue', header: 'Current', cell: item => item.currentValue, minWidth: 220 },
                    { id: 'selectedValue', header: `Selected (v${versionDetails.version})`, cell: item => item.selectedValue, minWidth: 220 }
                  ]}
                  resizableColumns
                  empty={<Box>No differences found.</Box>}
                />
              ) : (
                <Box variant="small" color="text-body-secondary">No differences from the current version.</Box>
              )}
            </Box>
          ) : null}
        </Modal>
      )}
      {authorizationModalVisible && (
        <Modal
          visible
          size="large"
          header="Authorization for Release of ISET Client Information"
          onDismiss={handleCloseAuthorizationModal}
          footer={
            <SpaceBetween direction="horizontal" size="xs" alignItems="end">
              <Button onClick={handleDownloadAuthorization} loading={authorizationDownloadLoading} disabled={authorizationDownloadLoading}>
                Download (PDF)
              </Button>
              <Button variant="primary" onClick={handleCloseAuthorizationModal}>
                Close
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Box textAlign="center">
              <Box margin={{ bottom: 's' }} display="flex" justifyContent="center">
                <img
                  src="/nwac-consent-logo.png"
                  alt="Native Women's Association of Canada logo"
                  style={{ maxHeight: '64px', width: 'auto' }}
                />
              </Box>
              <Box fontSize="heading-s" fontWeight="bold">
                Native Women's Association of Canada
              </Box>
              <Box fontSize="body-s" color="text-body-secondary">
                Association des femmes autochtones du Canada
              </Box>
            </Box>
            <SpaceBetween size="s">
              {AUTHORIZATION_RELEASE_PARAGRAPHS.map((paragraph, index) => (
                <Box key={index} lineHeight="body-m">
                  {paragraph}
                </Box>
              ))}
            </SpaceBetween>
            <ColumnLayout columns={2} variant="text-grid">
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Client signature</Box>
                <Box
                  borderColor="border-divider"
                  borderStyle="solid"
                  borderWidth="1px"
                  borderRadius="small"
                  padding="m"
                  backgroundColor="background-secondary"
                  minHeight="4rem"
                  display="flex"
                  alignItems="center"
                  justifyContent="flex-start"
                >
                  {authorizationSigned ? (
                    <Box fontFamily="'Segoe Script', 'Lucida Handwriting', cursive" fontSize="heading-xl">
                      {authorizationSignedName}
                    </Box>
                  ) : (
                    <Box color="text-status-inactive">Not signed</Box>
                  )}
                </Box>
                <Box fontSize="body-s" color="text-body-secondary">
                  Client signature
                </Box>
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Signed on</Box>
                <Box>{authorizationSigned ? authorizationSignedAt : 'Not signed'}</Box>
                <Box fontSize="body-s" color="text-body-secondary">
                  Electronic consent captured via the ISET intake portal.
                </Box>
              </SpaceBetween>
            </ColumnLayout>
            <Box color="text-body-secondary" fontSize="body-s" textAlign="center">
              NWAC wishes to acknowledge support for this project through the Government of Canada's ISET Program.
            </Box>
          </SpaceBetween>
        </Modal>
      )}
      {clientAcknowledgementModalVisible && (
        <Modal
          visible
          size="large"
          header="Client Acknowledgement of Funding Source"
          onDismiss={handleCloseClientAcknowledgementModal}
          footer={
            <SpaceBetween direction="horizontal" size="xs" alignItems="end">
              <Button
                onClick={handleDownloadClientAcknowledgement}
                loading={clientAcknowledgementDownloadLoading}
                disabled={clientAcknowledgementDownloadLoading}
              >
                Download (PDF)
              </Button>
              <Button variant="primary" onClick={handleCloseClientAcknowledgementModal}>
                Close
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Box textAlign="center">
              <Box margin={{ bottom: 's' }} display="flex" justifyContent="center">
                <img
                  src="/nwac-consent-logo.png"
                  alt="Native Women's Association of Canada logo"
                  style={{ maxHeight: '64px', width: 'auto' }}
                />
              </Box>
              <Box fontSize="heading-s" fontWeight="bold">
                Native Women's Association of Canada
              </Box>
              <Box fontSize="body-s" color="text-body-secondary">
                Association des femmes autochtones du Canada
              </Box>
            </Box>
            <SpaceBetween size="s">
              {CLIENT_ACKNOWLEDGEMENT_PARAGRAPHS.map((paragraph, index) => (
                <Box key={index} lineHeight="body-m">
                  {paragraph}
                </Box>
              ))}
            </SpaceBetween>
            <ColumnLayout columns={2} variant="text-grid">
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Client signature</Box>
                <Box
                  borderColor="border-divider"
                  borderStyle="solid"
                  borderWidth="1px"
                  borderRadius="small"
                  padding="m"
                  backgroundColor="background-secondary"
                  minHeight="4rem"
                  display="flex"
                  alignItems="center"
                  justifyContent="flex-start"
                >
                  {clientAcknowledgementSigned ? (
                    <Box fontFamily="'Segoe Script', 'Lucida Handwriting', cursive" fontSize="heading-xl">
                      {clientAcknowledgementSignedName}
                    </Box>
                  ) : (
                    <Box color="text-status-inactive">Not signed</Box>
                  )}
                </Box>
                <Box fontSize="body-s" color="text-body-secondary">
                  Client signature
                </Box>
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Signed on</Box>
                <Box>{clientAcknowledgementSigned ? clientAcknowledgementSignedAt : 'Not signed'}</Box>
                <Box fontSize="body-s" color="text-body-secondary">
                  Electronic acknowledgement captured via the ISET intake portal.
                </Box>
              </SpaceBetween>
            </ColumnLayout>
            <Box color="text-body-secondary" fontSize="body-s" textAlign="center">
              NWAC wishes to acknowledge support for this project through the Government of Canada's ISET Program.
            </Box>
          </SpaceBetween>
        </Modal>
      )}
      {indigenousModalVisible && (
        <Modal
          visible
          size="large"
          header="Indigenous Declaration"
          onDismiss={handleCloseIndigenousModal}
          footer={
            <SpaceBetween direction="horizontal" size="xs" alignItems="end">
              <Button onClick={handleDownloadIndigenous} loading={indigenousDownloadLoading} disabled={indigenousDownloadLoading}>
                Download (PDF)
              </Button>
              <Button variant="primary" onClick={handleCloseIndigenousModal}>
                Close
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Box textAlign="center">
              <Box margin={{ bottom: 's' }} display="flex" justifyContent="center">
                <img
                  src="/nwac-consent-logo.png"
                  alt="Native Women's Association of Canada logo"
                  style={{ maxHeight: '64px', width: 'auto' }}
                />
              </Box>
              <Box fontSize="heading-s" fontWeight="bold">
                Native Women's Association of Canada
              </Box>
              <Box fontSize="body-s" color="text-body-secondary">
                Association des femmes autochtones du Canada
              </Box>
            </Box>
            <SpaceBetween size="s">
              {INDIGENOUS_DECLARATION_PARAGRAPHS.map((paragraph, index) => (
                <Box key={index} lineHeight="body-m">
                  {paragraph}
                </Box>
              ))}
            </SpaceBetween>
            <SpaceBetween size="xs">
              <Box fontWeight="bold">My Nation/Community/Treaty Area affiliation</Box>
              <Box>{indigenousAffiliation || 'Not provided'}</Box>
              <Box color="text-body-secondary">
                (e.g., Mohawk of Kahnawà:ke; Inuit of Nunatsiavut; Metis Nation of Alberta, Region 3, etc.)
              </Box>
            </SpaceBetween>
            <SpaceBetween size="xs">
              <Box fontWeight="bold">Declaration</Box>
              <Box color="text-body-secondary">
                {INDIGENOUS_DECLARATION_STATEMENT}
              </Box>
            </SpaceBetween>
            <ColumnLayout columns={2} variant="text-grid">
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Client signature</Box>
                <Box
                  borderColor="border-divider"
                  borderStyle="solid"
                  borderWidth="1px"
                  borderRadius="small"
                  padding="m"
                  backgroundColor="background-secondary"
                  minHeight="4rem"
                  display="flex"
                  alignItems="center"
                  justifyContent="flex-start"
                >
                  {indigenousSigned ? (
                    <Box fontFamily="'Segoe Script', 'Lucida Handwriting', cursive" fontSize="heading-xl">
                      {indigenousSignedName}
                    </Box>
                  ) : (
                    <Box color="text-status-inactive">Not signed</Box>
                  )}
                </Box>
                <Box fontSize="body-s" color="text-body-secondary">
                  Client signature
                </Box>
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Signed on</Box>
                <Box>{indigenousSigned ? indigenousSignedAt : 'Not signed'}</Box>
                <Box fontSize="body-s" color="text-body-secondary">
                  Electronic declaration captured via the ISET intake portal.
                </Box>
              </SpaceBetween>
            </ColumnLayout>
            <Box color="text-body-secondary" fontSize="body-s" textAlign="center">
              NWAC wishes to acknowledge support for this project through the Government of Canada's ISET Program.
            </Box>
          </SpaceBetween>
        </Modal>
      )}
      {conflictModalVisible && (
        <Modal
          visible
          size="large"
          header="Conflict of Interest Declaration"
          onDismiss={handleCloseConflictModal}
          footer={
            <SpaceBetween direction="horizontal" size="xs" alignItems="end">
              <Button onClick={handleDownloadConflict} loading={conflictDownloadLoading} disabled={conflictDownloadLoading}>
                Download (PDF)
              </Button>
              <Button variant="primary" onClick={handleCloseConflictModal}>
                Close
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Box textAlign="center">
              <Box margin={{ bottom: 's' }} display="flex" justifyContent="center">
                <img
                  src="/nwac-consent-logo.png"
                  alt="Native Women's Association of Canada logo"
                  style={{ maxHeight: '64px', width: 'auto' }}
                />
              </Box>
              <Box fontSize="heading-s" fontWeight="bold">
                Native Women's Association of Canada
              </Box>
              <Box fontSize="body-s" color="text-body-secondary">
                Association des femmes autochtones du Canada
              </Box>
            </Box>
            <SpaceBetween size="s">
              {CONFLICT_DECLARATION_PARAGRAPHS.map((paragraph, index) => (
                <Box key={index} lineHeight="body-m">
                  {paragraph}
                </Box>
              ))}
            </SpaceBetween>
            <SpaceBetween size="xs">
              <Box fontWeight="bold">Declaration selection</Box>
              <Box>{conflictOptionLabel}</Box>
              {conflictSelection === 'conflict' && (
                <Box color="text-body-secondary">
                  {conflictExplanation || 'No details provided.'}
                </Box>
              )}
            </SpaceBetween>
            <SpaceBetween size="xs">
              <Box fontWeight="bold">Declaration statement</Box>
              <Box color="text-body-secondary">
                {CONFLICT_DECLARATION_STATEMENT}
              </Box>
            </SpaceBetween>
            <ColumnLayout columns={2} variant="text-grid">
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Client signature</Box>
                <Box
                  borderColor="border-divider"
                  borderStyle="solid"
                  borderWidth="1px"
                  borderRadius="small"
                  padding="m"
                  backgroundColor="background-secondary"
                  minHeight="4rem"
                  display="flex"
                  alignItems="center"
                  justifyContent="flex-start"
                >
                  {conflictSigned ? (
                    <Box fontFamily="'Segoe Script', 'Lucida Handwriting', cursive" fontSize="heading-xl">
                      {conflictSignedName}
                    </Box>
                  ) : (
                    <Box color="text-status-inactive">Not signed</Box>
                  )}
                </Box>
                <Box fontSize="body-s" color="text-body-secondary">
                  Client signature
                </Box>
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Signed on</Box>
                <Box>{conflictSigned ? conflictSignedAt : 'Not signed'}</Box>
                <Box fontSize="body-s" color="text-body-secondary">
                  Electronic declaration captured via the ISET intake portal.
                </Box>
              </SpaceBetween>
            </ColumnLayout>
            <Box color="text-body-secondary" fontSize="body-s" textAlign="center">
              NWAC wishes to acknowledge support for this project through the Government of Canada's ISET Program.
            </Box>
          </SpaceBetween>
        </Modal>
      )}
      {consentModalVisible && (
        <Modal
          visible
          size="large"
          header="CLIENT CONSENT FOR EI VERIFICATION"
          onDismiss={handleCloseConsentModal}
          footer={
            <SpaceBetween direction="horizontal" size="xs" alignItems="end">
              <Button onClick={handleDownloadConsent} loading={consentDownloadLoading} disabled={consentDownloadLoading}>
                Download (PDF)
              </Button>
              <Button variant="primary" onClick={handleCloseConsentModal}>
                Close
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Box textAlign="center">
              <Box margin={{ bottom: 's' }} display="flex" justifyContent="center">
                <img
                  src="/nwac-consent-logo.png"
                  alt="Native Women's Association of Canada logo"
                  style={{ maxHeight: '64px', width: 'auto' }}
                />
              </Box>
              <Box fontSize="heading-s" fontWeight="bold">
                Native Women's Association of Canada
              </Box>
              <Box fontSize="body-s" color="text-body-secondary">
                Association des femmes autochtones du Canada
              </Box>
            </Box>
            <SpaceBetween size="s">
              {EI_CONSENT_PARAGRAPHS.map((paragraph, index) => (
                <Box key={index} lineHeight="body-m">
                  {paragraph}
                </Box>
              ))}
            </SpaceBetween>
            <SpaceBetween size="xs">
              <Box fontWeight="bold">Client acknowledgement</Box>
              <Box color="text-body-secondary">
                I confirm that I have read and understood the above consent and agree to proceed with my application.
              </Box>
            </SpaceBetween>
            <ColumnLayout columns={2} variant="text-grid">
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Client signature</Box>
                <Box
                  borderColor="border-divider"
                  borderStyle="solid"
                  borderWidth="1px"
                  borderRadius="small"
                  padding="m"
                  backgroundColor="background-secondary"
                  minHeight="4rem"
                  display="flex"
                  alignItems="center"
                  justifyContent="flex-start"
                >
                  {consentSigned ? (
                    <Box fontFamily="'Segoe Script', 'Lucida Handwriting', cursive" fontSize="heading-xl">
                      {consentSignedName}
                    </Box>
                  ) : (
                    <Box color="text-status-inactive">Not signed</Box>
                  )}
                </Box>
                <Box fontSize="body-s" color="text-body-secondary">
                  Client signature
                </Box>
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box fontWeight="bold">Signed on</Box>
                <Box>{consentSigned ? consentSignedAt : 'Not signed'}</Box>
                <Box fontSize="body-s" color="text-body-secondary">
                  Electronic consent captured via the ISET intake portal.
                </Box>
              </SpaceBetween>
            </ColumnLayout>
            <Box color="text-body-secondary" fontSize="body-s" textAlign="center">
              NWAC wishes to acknowledge support for this project through the Government of Canada's ISET Program.
            </Box>
          </SpaceBetween>
        </Modal>
      )}
    </BoardItem>
  );
};
export default IsetApplicationFormWidget;



