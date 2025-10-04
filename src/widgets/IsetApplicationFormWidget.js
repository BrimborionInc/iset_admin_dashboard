
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
  Input,
  Select,
  Multiselect,
  Spinner
} from '@cloudscape-design/components';
import IsetApplicationFormHelpPanelContent from '../helpPanelContents/isetApplicationFormHelpPanelContent';
import { apiFetch } from '../auth/apiClient';

const NOT_PROVIDED = <Box color="text-body-secondary">Not provided</Box>;

const OPTION_LABELS = {
  'eligibility-indigenous': { yes: 'Yes', no: 'No' },
  'eligibility-female': { yes: 'Yes', no: 'No' },
  'eligibility-canadian': { yes: 'Yes', no: 'No' },
  'eligibility-age': { yes: 'Yes', no: 'No' },
  'eligibility-employment': { yes: 'Yes', no: 'No' },
  'eligibility-training': { yes: 'Yes', no: 'No' },
  'eligibility-financial': { yes: 'Yes', no: 'No' },
  'eligibility-disqualified': { yes: 'Yes', no: 'No' },
  'what-is-your-gender-identity': {
    '1': 'Woman',
    '2': 'Two-Spirit',
    '3': 'Transgender Woman',
    '4': 'Gender Diverse',
    '5': 'Prefer not to say'
  },
  'address-province': {
    ab: 'Alberta',
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
  'legal-indigenous-identity': {
    first_nations_status: 'First Nations (Status)',
    first_nations_non_status: 'First Nations (Non-Status)',
    inuit: 'Inuit',
    metis: 'Metis'
  },
  'preferred-language': { en: 'English', fr: 'French' },
  'visible-minority': { true: 'Yes', false: 'No' },
  'marital-status': {
    married: 'Married',
    single: 'Single',
    separated: 'Separated',
    divorced: 'Divorced',
    widowed: 'Widowed'
  },
  'dependent-children': { yes: 'Yes', no: 'No' },
  'has-disability': { yes: 'Yes', no: 'No' },
  'social-assistance': { yes: 'Yes', no: 'No' },
  'labour-force-status': {
    unemployed: 'Unemployed',
    underemployed: 'Underemployed',
    'employed-full-time': 'Employed full-time',
    'employed-part-time': 'Employed part-time',
    'self-employed': 'Self-employed',
    student: 'Student',
    other: 'Other'
  },
  'example-radio-2': {
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
  },
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
    not_yet: 'Not yet'
  },
  'requested-supports': {
    tuition: 'Tuition',
    books: 'Books / Materials',
    living: 'Living allowance',
    transportation: 'Transportation',
    other: 'Other'
  }
};

const cloneAnswers = (source) => JSON.parse(JSON.stringify(source || {}));

// Normalise a wide variety of yes/no input shapes to 'yes' | 'no' | null
const normaliseYesNo = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim().toLowerCase();
  if (['yes', 'true', '1', 'y'].includes(s)) return 'yes';
  if (['no', 'false', '0', 'n'].includes(s)) return 'no';
  return null;
};

// Render a Pass/Fail badge for eligibility keys, with inverted logic for 'eligibility-disqualified'.
const formatEligibility = (key, value) => {
  const yn = normaliseYesNo(value);
  if (yn === null) return NOT_PROVIDED;
  const inverted = key === 'eligibility-disqualified';
  const pass = inverted ? yn === 'no' : yn === 'yes';
  return <Badge color={pass ? 'green' : 'red'}>{pass ? 'Pass' : 'Fail'}</Badge>;
};

const DOCUMENT_FIELDS = [
  { key: 'status-card', label: 'Status / Treaty Card (or equivalent)' },
  { key: 'govt-id', label: 'Government-issued ID' },
  { key: 'acceptance-letter', label: 'Letter of Acceptance' },
  { key: 'applicant-pay-stubs', label: 'Pay stubs (applicant)' },
  { key: 'spouse-pay-stubs', label: 'Pay stubs (spouse)' },
  { key: 'uploaded-file-6', label: 'Band denial letter' }
];

const INCOME_FIELDS = [
  { key: 'income-employment', label: 'Employment income' },
  { key: 'income-spousal', label: 'Spousal income' },
  { key: 'income-social-assist', label: 'Social assistance' },
  { key: 'income-child-benefit', label: 'Canada Child Benefit' },
  { key: 'income-jordans', label: "Jordan's Principle" },
  { key: 'income-band-funding', label: 'Band funding' },
  { key: 'income-other', label: 'Other income' }
];

const EXPENSE_FIELDS = [
  { key: 'expenses-rent', label: 'Rent / Mortgage' },
  { key: 'expenses-utilities', label: 'Utilities' },
  { key: 'expenses-groceries', label: 'Groceries' },
  { key: 'expenses-transitpass', label: 'Transit pass' },
  { key: 'example-input-5', label: 'Other expenses total' }
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
  if (!map) return String(value);
  const normalised = String(value).toLowerCase();
  return map[normalised] || map[value] || String(value);
};

const formatOptionList = (key, values) => {
  if ((values === null || values === undefined) || (Array.isArray(values) && values.length === 0)) return NOT_PROVIDED;
  const list = Array.isArray(values) ? values : [values];
  const chips = list.map((item, index) => {
    if (String(key).startsWith('eligibility-')) {
      return <React.Fragment key={index}>{formatEligibility(key, item)}</React.Fragment>;
    }
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

const normaliseFilePath = (filePath) => {
  if (!filePath) return null;
  const normalised = String(filePath).replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  return normalised.startsWith('/') ? normalised : `/${normalised}`;
};

const renderDocumentLinks = (value) => {
  if (!value) return NOT_PROVIDED;
  const files = Array.isArray(value) ? value : [value];
  const valid = files.filter(Boolean);
  if (!valid.length) return NOT_PROVIDED;
  return (
    <SpaceBetween size="xs">
      {valid.map((file, index) => {
        const name = file?.name || 'Uploaded document';
        const size = file?.size ? `(${Math.round(file.size / 1024)} KB)` : '';
        const href = normaliseFilePath(file?.filePath);
        const label = [name, size].filter(Boolean).join(' ');
        return href ? (
          <Link key={index} href={href} external>
            {label || name}
          </Link>
        ) : (
          <span key={index}>{label || name}</span>
        );
      })}
    </SpaceBetween>
  );
};

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
    if (normaliseForCompare(baseline?.[key]) !== normaliseForCompare(updated?.[key])) {
      diff[key] = updated?.[key];
    }
  });
  return diff;
};
const SECTION_DEFINITIONS = [
  {
    id: 'consent',
    title: 'Consent & declarations',
    description: 'Signatures captured at submission time.',
    columns: 2,
    editable: false,
    items: [
      {
        label: 'Application consent',
        renderValue: answers => signatureStatus(answers?.consent)
      },
      {
        label: 'Indigenous declaration',
        renderValue: answers => signatureStatus(answers?.indigenous_declaration)
      }
    ]
  },
  {
    id: 'eligibility',
    title: 'Eligibility screening',
    description: 'Snapshot of automated eligibility questions.',
    columns: 2,
    editable: false,
    items: [
      {
        label: 'First Nations / Inuit / Metis member',
        renderValue: answers => formatOptionList('eligibility-indigenous', answers['eligibility-indigenous'])
      },
      {
        label: 'Identifies as woman / gender diverse',
        renderValue: answers => formatOptionList('eligibility-female', answers['eligibility-female'])
      },
      {
        label: 'Canadian citizen',
        renderValue: answers => formatOptionList('eligibility-canadian', answers['eligibility-canadian'])
      },
      {
        label: 'Aged 15 or older',
        renderValue: answers => formatOptionList('eligibility-age', answers['eligibility-age'])
      },
      {
        label: 'Unemployed / under-employed / at risk',
        renderValue: answers => formatOptionList('eligibility-employment', answers['eligibility-employment'])
      },
      {
        label: 'Pursuing post-secondary training',
        renderValue: answers => formatOptionList('eligibility-training', answers['eligibility-training'])
      },
      {
        label: 'Has unmet financial need',
        renderValue: answers => formatOptionList('eligibility-financial', answers['eligibility-financial'])
      },
      {
        label: 'Previous ISET default',
        renderValue: answers => formatOptionList('eligibility-disqualified', answers['eligibility-disqualified'])
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
        label: 'Gender identity',
        field: 'what-is-your-gender-identity',
        controlType: 'select',
        optionsKey: 'what-is-your-gender-identity',
        renderValue: answers => formatOption('what-is-your-gender-identity', answers['what-is-your-gender-identity'])
      },
      { label: 'Social Insurance Number', field: 'social-insurance-number', controlType: 'input', renderValue: answers => renderPlainText(answers['social-insurance-number']) },
      {
        label: 'Legal Indigenous identity',
        field: 'legal-indigenous-identity',
        controlType: 'select',
        optionsKey: 'legal-indigenous-identity',
        renderValue: answers => formatOption('legal-indigenous-identity', answers['legal-indigenous-identity'])
      },
      { label: 'Registration number', field: 'registration-number', controlType: 'input', renderValue: answers => renderPlainText(answers['registration-number']) },
      { label: 'Home community', field: 'home-comminuty', controlType: 'input', renderValue: answers => renderPlainText(answers['home-comminuty']) }
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
    title: 'Demographics & supports',
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
      {
        label: 'Has dependent children',
        field: 'dependent-children',
        controlType: 'select',
        optionsKey: 'dependent-children',
        renderValue: answers => formatOption('dependent-children', answers['dependent-children'])
      },
      {
        label: 'Disability',
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
        field: 'example-radio-2',
        controlType: 'select',
        optionsKey: 'example-radio-2',
        renderValue: answers => formatOption('example-radio-2', answers['example-radio-2'])
      },
      { label: 'Year completed', field: 'education-year', controlType: 'input', renderValue: answers => renderPlainText(answers['education-year']) },
      { label: 'Where completed', field: 'edication-location', controlType: 'input', renderValue: answers => renderPlainText(answers['edication-location']) },
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
    id: 'barriers',
    title: 'Barriers & support requests',
    description: 'Self-reported barriers and requested supports.',
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
      { label: 'Other barrier', field: 'other-barrier', controlType: 'textarea', renderValue: answers => renderTextBlock(answers['other-barrier']) },
      {
        label: 'Supports requested',
        field: 'requested-supports',
        controlType: 'multiselect',
        optionsKey: 'requested-supports',
        renderValue: answers => formatOptionList('requested-supports', answers['requested-supports'])
      },
      { label: 'Other support detail', field: 'other-requested-support', controlType: 'textarea', renderValue: answers => renderTextBlock(answers['other-requested-support']) }
    ]
  },
  {
    id: 'finances',
    title: 'Income & expenses',
    description: 'Monthly household cash flow snapshot.',
    columns: 2,
    editable: true,
    tables: [
      {
        id: 'income-table',
        header: <Header variant="h4">Monthly income</Header>,
        fields: INCOME_FIELDS,
        totalLabel: 'Total monthly income',
        editableAmounts: true,
        trackBy: 'name'
      },
      {
        id: 'expense-table',
        header: <Header variant="h4">Monthly expenses</Header>,
        fields: EXPENSE_FIELDS,
        totalLabel: 'Total monthly expenses',
        editableAmounts: true,
        trackBy: 'name'
      }
    ],
    items: [
      { label: 'Other income detail', field: 'income-other-description', controlType: 'textarea', renderValue: answers => renderTextBlock(answers['income-other-description']) },
      { label: 'Other expenses (list)', field: 'expenses-other-list', controlType: 'textarea', renderValue: answers => renderTextBlock(answers['expenses-other-list']) }
    ]
  },
  {
    id: 'documents',
    title: 'Supporting documents',
    description: "These are the files the applicant uploaded in support of this application. For all files associated with this applicant's email address, and to manage files, see the Supporting Documents widget.",
    columns: 2,
    editable: false,
    items: DOCUMENT_FIELDS.map(({ key, label }) => ({
      label,
      renderValue: answers => renderDocumentLinks(answers[key])
    }))
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
              <FormField key={`${id}-${item.field}`} label={item.label} constraintText={item.constraintText}>
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
const IsetApplicationFormWidget = ({ actions, application_id, caseData, toggleHelpPanel }) => {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(Boolean(application_id));
  const [loadError, setLoadError] = useState(null);
  const [flashbarItems, setFlashbarItems] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editableAnswers, setEditableAnswers] = useState({});
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
  }, [application_id]);

  const { answers, payload } = useMemo(() => {
    if (!application) return { answers: {}, payload: {} };
    const payload = application.__payload || {};
    const rawAnswers = payload.answers || payload.intake_answers || payload;
    return {
      payload,
      answers: rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {}
    };
  }, [application]);

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
      setEditableAnswers(cloneAnswers(answers));
    }
  }, [answers, isEditing]);

  const handleFieldChange = useCallback((field, value) => {
    setEditableAnswers(prev => ({ ...prev, [field]: value }));
  }, []);

  const diff = useMemo(() => answersDiff(answers, editableAnswers), [answers, editableAnswers]);
  const hasDirtyFields = isEditing && Object.keys(diff).length > 0;

  const handleRequestEdit = useCallback(() => {
    setShowEditConfirm(true);
  }, []);

  const handleConfirmEdit = useCallback(() => {
    setShowEditConfirm(false);
    setIsEditing(true);
    setEditableAnswers(cloneAnswers(answers));
  }, [answers]);

  const handleCancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditableAnswers(cloneAnswers(answers));
  }, [answers]);

  const handleSave = useCallback(async () => {
    if (!application_id) return;
    const changes = answersDiff(answers, editableAnswers);
    if (!Object.keys(changes).length) {
      setIsEditing(false);
      pushFlash({ type: 'info', content: 'No changes to save' });
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/applications/${application_id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: changes })
      });
      if (!res.ok) {
        let message = 'Failed to save application updates';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch (_) {}
        const err = new Error(message);
        err.status = res.status;
        throw err;
      }
      await res.json().catch(() => ({}));
      setIsEditing(false);
      setVersionsLoaded(false);
      pushFlash({ type: 'success', content: 'Application updates saved' });
      await refreshApplication();
    } catch (error) {
      pushFlash({ type: 'error', content: error?.message || 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  }, [application_id, answers, editableAnswers, pushFlash, refreshApplication]);
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
    setRestoringVersionId(versionRow.id);
    setVersionError(null);
    try {
      const res = await apiFetch(`/api/applications/${application_id}/versions/${versionRow.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        let message = 'Failed to restore version';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch (_) {}
        throw new Error(message);
      }
      const result = await res.json().catch(() => ({}));
      const restoredVersion = Number(result?.version) || versionRow.version;
      pushFlash({ type: 'success', content: `Restored version ${restoredVersion}` });
      await refreshApplication();
      await fetchVersionsList();
      setVersionDetails(null);
      setIsEditing(false);
    } catch (error) {
      pushFlash({ type: 'error', content: error?.message || 'Failed to restore version' });
    } finally {
      setRestoringVersionId(null);
    }
  }, [application_id, fetchVersionsList, pushFlash, refreshApplication]);

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
        value={value ?? ''}
        onChange={({ detail }) => handleFieldChange(fieldKey, detail.value)}
        disabled={disabled}
      />
    );
  }, [editableAnswers, handleFieldChange, saving, schemaSnapshot]);
  const versionColumns = useMemo(() => [
    {
      id: 'version',
      header: 'Version',
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
      cell: item => formatDateTime(item.savedAt)
    },
    {
      id: 'savedBy',
      header: 'Saved by',
      cell: item => item.savedBy || '—'
    },
    {
      id: 'changeSummary',
      header: 'Change summary',
      cell: item => item.changeSummary ? <Box>{item.changeSummary}</Box> : '—'
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: item => (
        <SpaceBetween direction="horizontal" size="xs">
          <Button size="small" onClick={() => handleViewVersion(item)} disabled={versionDetailsLoading}>
            View
          </Button>
          {item.canRestore && (
            <Button
              size="small"
              variant="primary"
              onClick={() => handleRestoreVersion(item)}
              disabled={restoringVersionId === item.id}
              loading={restoringVersionId === item.id}
            >
              Restore
            </Button>
          )}
        </SpaceBetween>
      )
    }
  ], [handleRestoreVersion, handleViewVersion, restoringVersionId, versionDetailsLoading]);

  const employmentNarrativeReadOnly = renderTextBlock(answers['long-term-goal']);
  const employmentNarrativeValue = editableAnswers['long-term-goal'] ?? '';
  const showEmploymentNarrative = isEditing || employmentNarrativeReadOnly !== NOT_PROVIDED;

  const headerActions = (
    <SpaceBetween direction="horizontal" size="xs">
      {isEditing ? (
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
        <Button onClick={handleRequestEdit} disabled={loading || !application} variant="primary">
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
              onFollow={() => toggleHelpPanel && toggleHelpPanel(<IsetApplicationFormHelpPanelContent />, 'ISET Application Form Help')}
            >
              Info
            </Link>
          }
          actions={headerActions}
        >
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
          <SpaceBetween size="l">
            {SECTION_DEFINITIONS.map(section => (
              <Section
                key={section.id}
                {...section}
                isEditing={isEditing}
                answers={answers}
                editableAnswers={editableAnswers}
                renderEditableField={renderEditableField}
                onFieldChange={handleFieldChange}
                saving={saving}
              />
            ))}
            {showEmploymentNarrative && (
              <ExpandableSection
                headerText="Employment goal narrative"
                headerDescription="Applicant's description of their long-term employment objective."
                defaultExpanded={false}
              >
                {isEditing ? (
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
          </SpaceBetween>
          {flashbarItems.length > 0 && <Flashbar items={flashbarItems} />}
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
                <Button variant="primary" onClick={handleConfirmEdit}>
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
          <SpaceBetween size="m">
            {versionError && <Box color="text-status-critical">{versionError}</Box>}
            <Table
              items={versions}
              trackBy="rowId"
              columnDefinitions={versionColumns}
              loading={versionsLoading}
              loadingText="Loading versions"
              empty={<Box>No saved versions yet</Box>}
            />
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={fetchVersionsList} disabled={versionsLoading} iconName="refresh">
                Refresh
              </Button>
            </SpaceBetween>
            {versionDetailsLoading && (
              <Spinner />
            )}
            {versionDetails && !versionDetailsLoading && (
              <ExpandableSection
                headerText={versionDetails.id ? `Version ${versionDetails.version} details` : 'Current version details'}
                defaultExpanded={false}
              >
                <Box fontFamily="monospace" whiteSpace="pre-wrap">
                  {JSON.stringify(versionDetails.payload?.answers ?? versionDetails.payload ?? {}, null, 2)}
                </Box>
              </ExpandableSection>
            )}
          </SpaceBetween>
        </Modal>
      )}
    </BoardItem>
  );
};
export default IsetApplicationFormWidget;

