import React, { useEffect, useMemo, useState } from 'react';
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
  StatusIndicator
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

const DOCUMENT_FIELDS = [
  { key: 'status-card', label: 'Status / Treaty Card (or equivalent)' },
  { key: 'govt-id', label: 'Government-issued ID' },
  { key: 'acceptance-letter', label: 'Letter of Acceptance' },
  { key: 'applicant-pay-stubs', label: 'Pay stubs (applicant)' },
  { key: 'spouse-pay-stubs', label: 'Pay stubs (spouse)' },
  { key: 'uploaded-file-6', label: 'Band denial letter' }
];

const currencyFormatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 });

const normaliseString = (value) => (typeof value === 'string' ? value.trim() : value);

const formatCurrency = (value) => {
  if (value === null || value === undefined) return NOT_PROVIDED;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  if (!cleaned) return NOT_PROVIDED;
  const number = Number(cleaned);
  if (Number.isNaN(number)) return String(value);
  return currencyFormatter.format(number);
};

const formatDate = (value) => {
  if (!value) return NOT_PROVIDED;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
};

const asBadge = (value, positiveLabel = 'Yes', negativeLabel = 'No') => {
  if (value === null || value === undefined || value === '') return NOT_PROVIDED;
  const normalised = String(value).toLowerCase();
  if (['yes', 'true', '1', 'y'].includes(normalised)) {
    return <Badge color="green">{positiveLabel}</Badge>;
  }
  if (['no', 'false', '0', 'n'].includes(normalised)) {
    return <Badge color="red">{negativeLabel}</Badge>;
  }
  return <Badge color="blue">{String(value)}</Badge>;
};

const formatOption = (key, value) => {
  if (value === null || value === undefined || value === '') return NOT_PROVIDED;
  const map = OPTION_LABELS[key];
  if (!map) return String(value);
  const normalised = String(value).toLowerCase();
  return map[normalised] || map[value] || String(value);
};

const formatOptionList = (key, values) => {
  if (!values || (Array.isArray(values) && values.length === 0)) return NOT_PROVIDED;
  const list = Array.isArray(values) ? values : [values];
  const chips = list.map((item, index) => {
    const label = formatOption(key, item);
    if (typeof label === "string" && ["Yes", "No"].includes(label)) {
      return <Badge key={index} color={label === "Yes" ? "green" : "grey"}>{label}</Badge>;
    }
    return <Badge key={index} color="blue">{label}</Badge>;
  });
  return <SpaceBetween direction="horizontal" size="xs">{chips}</SpaceBetween>;
};

const renderTextBlock = (value) => {
  if (!value || !String(value).trim()) return NOT_PROVIDED;
  return <Box whiteSpace="pre-wrap">{value}</Box>;
};

const renderAddress = (answers) => {
  const parts = [
    answers['address-street-address'],
    answers['address-city'],
    formatOption('address-province', answers['address-province']),
    answers['address-postcode']
  ].filter(Boolean);
  if (!parts.length) return NOT_PROVIDED;
  return <Box>{parts.join(', ')}</Box>;
};

const renderMailingAddress = (value) => {
  if (!value || !String(value).trim()) return NOT_PROVIDED;
  return <Box>{value}</Box>;
};

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

const Section = ({ title, description, columns = 2, items, defaultExpanded = true }) => {
  const prepared = items.map(({ label, value }) => ({
    label,
    value: value === null || value === undefined ? NOT_PROVIDED : value,
  }));
  return (
    <ExpandableSection
      headerText={title}
      text={description}
      defaultExpanded={defaultExpanded}
    >
      <KeyValuePairs columns={columns} items={prepared} />
    </ExpandableSection>
  );
};

const IsetApplicationFormWidget = ({ actions, application_id, caseData, toggleHelpPanel }) => {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(Boolean(application_id));
  const [loadError, setLoadError] = useState(null);
  const [flashbarItems, setFlashbarItems] = useState([]);
  const [caseSummary, setCaseSummary] = useState('');
  const [initialCaseSummary, setInitialCaseSummary] = useState('');
  const [savingCaseSummary, setSavingCaseSummary] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!application_id) {
      setApplication(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setLoadError(null);

    apiFetch(`/api/applications/${application_id}`)
      .then(async res => {
        if (res.ok) return res.json();
        let message = 'Failed to load application';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch (_) {
          // ignore
        }
        if (res.status === 404) message = 'Application not found';
        if (res.status === 401) message = 'Not authorized to view this application';
        const err = new Error(message);
        err.status = res.status;
        throw err;
      })
      .then(data => {
        if (cancelled) return;
        let payload = data.payload_json;
        if (payload && typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch (_) {
            payload = {};
          }
        }
        data.__payload = payload || {};
        setApplication(data);
        const summary = data.case?.case_summary || '';
        setCaseSummary(summary);
        setInitialCaseSummary(summary);
      })
      .catch(err => {
        if (!cancelled) {
          setApplication(null);
          setLoadError(err?.message || 'Failed to load application');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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

  const sections = useMemo(() => {
    const sections = [];

    sections.push({
      id: 'consent',
      title: 'Consent & declarations',
      description: 'Signatures captured at submission time.',
      columns: 2,
      items: [
        { label: 'Application consent', value: signatureStatus(answers?.consent) },
        { label: 'Indigenous declaration', value: signatureStatus(answers?.indigenous_declaration) }
      ]
    });

    sections.push({
      id: 'eligibility',
      title: 'Eligibility screening',
      description: 'Snapshot of automated eligibility questions.',
      columns: 2,
      items: [
        { label: 'First Nations / Inuit / Metis member', value: formatOptionList('eligibility-indigenous', answers['eligibility-indigenous']) },
        { label: 'Identifies as woman / gender diverse', value: formatOptionList('eligibility-female', answers['eligibility-female']) },
        { label: 'Canadian citizen', value: formatOptionList('eligibility-canadian', answers['eligibility-canadian']) },
        { label: 'Aged 15 or older', value: formatOptionList('eligibility-age', answers['eligibility-age']) },
        { label: 'Unemployed / under-employed / at risk', value: formatOptionList('eligibility-employment', answers['eligibility-employment']) },
        { label: 'Pursuing post-secondary training', value: formatOptionList('eligibility-training', answers['eligibility-training']) },
        { label: 'Has unmet financial need', value: formatOptionList('eligibility-financial', answers['eligibility-financial']) },
        { label: 'Previous ISET default', value: formatOptionList('eligibility-disqualified', answers['eligibility-disqualified']) }
      ]
    });

    const fullName = [answers['first-name'], answers['middle-names'], answers['last-name']].filter(Boolean).join(' ');

    sections.push({
      id: 'identity',
      title: 'Applicant identity',
      description: 'Core biographical details provided by the applicant.',
      columns: 3,
      items: [
        { label: 'Full name', value: fullName || NOT_PROVIDED },
        { label: 'Preferred name', value: answers['preferred-name'] ? <Box>{answers['preferred-name']}</Box> : NOT_PROVIDED },
        { label: 'Date of birth', value: formatDate(answers['dob']) },
        { label: 'Gender identity', value: formatOption('what-is-your-gender-identity', answers['what-is-your-gender-identity']) },
        { label: 'Social Insurance Number', value: answers['social-insurance-number'] ? <Box>{answers['social-insurance-number']}</Box> : NOT_PROVIDED },
        { label: 'Legal Indigenous identity', value: formatOption('legal-indigenous-identity', answers['legal-indigenous-identity']) },
        { label: 'Registration number', value: answers['registration-number'] ? <Box>{answers['registration-number']}</Box> : NOT_PROVIDED },
        { label: 'Home community', value: answers['home-comminuty'] ? <Box>{answers['home-comminuty']}</Box> : NOT_PROVIDED }
      ]
    });

    sections.push({
      id: 'contact',
      title: 'Contact information',
      description: 'Primary communication channels for follow-up.',
      columns: 2,
      items: [
        { label: 'Primary address', value: renderAddress(answers) },
        { label: 'Mailing address (if different)', value: renderMailingAddress(answers['address-mailing-address']) },
        { label: 'Daytime phone', value: answers['telephone-day'] ? <Box>{answers['telephone-day']}</Box> : NOT_PROVIDED },
        { label: 'Alternate phone', value: answers['telephone-alt'] ? <Box>{answers['telephone-alt']}</Box> : NOT_PROVIDED },
        { label: 'Email address', value: answers['contact-email-address'] ? <Box>{answers['contact-email-address']}</Box> : NOT_PROVIDED }
      ]
    });

    sections.push({
      id: 'emergency',
      title: 'Emergency contact',
      description: 'Designated contact in case of urgent updates.',
      columns: 2,
      items: [
        { label: 'Name', value: answers['emergency-contact-name'] ? <Box>{answers['emergency-contact-name']}</Box> : NOT_PROVIDED },
        { label: 'Relationship', value: answers['emergency-contact-relationship'] ? <Box>{answers['emergency-contact-relationship']}</Box> : NOT_PROVIDED },
        { label: 'Telephone', value: answers['emergency-contact-telephone'] ? <Box>{answers['emergency-contact-telephone']}</Box> : NOT_PROVIDED }
      ]
    });

    sections.push({
      id: 'demographics',
      title: 'Demographics & supports',
      description: 'Additional context for program prioritisation.',
      columns: 2,
      items: [
        { label: 'Preferred language', value: formatOption('preferred-language', answers['preferred-language']) },
        { label: 'Visible minority', value: formatOption('visible-minority', answers['visible-minority']) },
        { label: 'Marital status', value: formatOption('marital-status', answers['marital-status']) },
        { label: 'Has dependent children', value: formatOption('dependent-children', answers['dependent-children']) },
        { label: 'Disability', value: formatOption('has-disability', answers['has-disability']) },
        { label: 'Disability details', value: renderTextBlock(answers['disability-description']) },
        { label: 'Receiving social assistance', value: formatOption('social-assistance', answers['social-assistance']) },
        { label: 'Top-up amount', value: formatCurrency(answers['top-up-amount']) }
      ]
    });

    sections.push({
      id: 'education',
      title: 'Education & employment',
      description: 'Current labour force status and academic history.',
      columns: 2,
      items: [
        { label: 'Labour force status', value: formatOption('labour-force-status', answers['labour-force-status']) },
        { label: 'Highest education completed', value: formatOption('example-radio-2', answers['example-radio-2']) },
        { label: 'Year completed', value: answers['education-year'] ? <Box>{answers['education-year']}</Box> : NOT_PROVIDED },
        { label: 'Where completed', value: answers['edication-location'] ? <Box>{answers['edication-location']}</Box> : NOT_PROVIDED },
        { label: 'Identified program / employer', value: formatOption('target-program', answers['target-program']) }
      ]
    });

    sections.push({
      id: 'barriers',
      title: 'Barriers & support requests',
      description: 'Self-reported barriers and requested supports.',
      columns: 2,
      items: [
        { label: 'Current barriers', value: formatOptionList('barriers', answers['barriers']) },
        { label: 'Other barrier', value: renderTextBlock(answers['other-barrier']) },
        { label: 'Supports requested', value: formatOptionList('requested-supports', answers['requested-supports']) },
        { label: 'Other support detail', value: renderTextBlock(answers['other-requested-support']) }
      ]
    });

    sections.push({
      id: 'income',
      title: 'Household income',
      description: 'Reported monthly income sources.',
      columns: 2,
      items: [
        { label: 'Employment income', value: formatCurrency(answers['income-employment']) },
        { label: 'Spousal income', value: formatCurrency(answers['income-spousal']) },
        { label: 'Social assistance', value: formatCurrency(answers['income-social-assist']) },
        { label: 'Canada Child Benefit', value: formatCurrency(answers['income-child-benefit']) },
        { label: "Jordan's Principle", value: formatCurrency(answers['income-jordans']) },
        { label: 'Band funding', value: formatCurrency(answers['income-band-funding']) },
        { label: 'Other income', value: formatCurrency(answers['income-other']) },
        { label: 'Other income detail', value: renderTextBlock(answers['income-other-description']) }
      ]
    });

    sections.push({
      id: 'expenses',
      title: 'Household expenses',
      description: 'Applicant’s estimated monthly costs.',
      columns: 2,
      items: [
        { label: 'Rent / Mortgage', value: formatCurrency(answers['expenses-rent']) },
        { label: 'Utilities', value: formatCurrency(answers['expenses-utilities']) },
        { label: 'Groceries', value: formatCurrency(answers['expenses-groceries']) },
        { label: 'Transit pass', value: formatCurrency(answers['expenses-transitpass']) },
        { label: 'Other expenses (list)', value: renderTextBlock(answers['expenses-other-list']) },
        { label: 'Other expenses total', value: formatCurrency(answers['example-input-5']) }
      ]
    });

    sections.push({
      id: 'documents',
      title: 'Supporting documents',
      description: 'Files uploaded alongside the application.',
      columns: 2,
      items: DOCUMENT_FIELDS.map(({ key, label }) => ({ label, value: renderDocumentLinks(answers[key]) }))
    });

    return sections;
  }, [answers]);

  const employmentNarrative = renderTextBlock(answers['long-term-goal']);

  const dirtyCaseSummary = caseSummary !== initialCaseSummary;

  const saveCaseSummary = () => {
    setSavingCaseSummary(true);
    apiFetch(`/api/applications/${application_id}/ptma-case-summary`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_summary: caseSummary })
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then(data => {
        const newValue = data.case_summary || data.case?.case_summary || caseSummary;
        setInitialCaseSummary(newValue);
        setCaseSummary(newValue);
        setFlashbarItems([
          {
            type: 'success',
            content: 'Case summary saved',
            dismissible: true,
            onDismiss: () => setFlashbarItems([])
          }
        ]);
      })
      .catch(() => {
        setFlashbarItems([
          {
            type: 'error',
            content: 'Failed to save case summary',
            dismissible: true,
            onDismiss: () => setFlashbarItems([])
          }
        ]);
      })
      .finally(() => setSavingCaseSummary(false));
  };

  const cancelCaseSummary = () => {
    setCaseSummary(initialCaseSummary);
  };

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
        <SpaceBetween size="l">
          {sections.map(section => (
            <Section key={section.id} {...section} />
          ))}

          {employmentNarrative !== NOT_PROVIDED && (
            <ExpandableSection
              headerText="Employment goal narrative"
              text="Applicant's description of their long-term employment objective."
              defaultExpanded={false}
            >
              {employmentNarrative}
            </ExpandableSection>
          )}

          <ExpandableSection
            headerText="Case summary & notes"
            text="Reviewer notes shared across the assessment team."
            defaultExpanded={false}
          >
            <SpaceBetween size="s">
              <Textarea
                rows={5}
                value={caseSummary}
                onChange={({ detail }) => setCaseSummary(detail.value)}
                placeholder="Add reviewer notes for this application"
              />
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={saveCaseSummary} disabled={!dirtyCaseSummary} loading={savingCaseSummary} variant="primary">
                  Save notes
                </Button>
                <Button variant="link" disabled={!dirtyCaseSummary || savingCaseSummary} onClick={cancelCaseSummary}>
                  Discard changes
                </Button>
              </SpaceBetween>
            </SpaceBetween>
          </ExpandableSection>

          {flashbarItems.length > 0 && <Flashbar items={flashbarItems} />}
        </SpaceBetween>
      )}
    </BoardItem>
  );
};

export default IsetApplicationFormWidget;
