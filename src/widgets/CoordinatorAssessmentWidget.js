import React, { forwardRef, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { apiFetch } from '../auth/apiClient';
import useApplicationLock, { buildLockConflictMessage } from '../hooks/useApplicationLock';
import useCurrentUser from '../hooks/useCurrentUser';
import { canCompleteOutcomeReview, getApplicationStatusContext } from '../utils/rbac';
import { Box, Header, ButtonDropdown, Link, SpaceBetween, Button, Alert, Modal, FormField, Input, Textarea, Checkbox, DatePicker, Select, Grid, ColumnLayout, Table, RadioGroup, Autosuggest, StatusIndicator, Wizard, Hotspot, Tabs } from '@cloudscape-design/components';
import ApplicationAssessmentHelp, { NwacAssessmentHelp } from '../helpPanelContents/applicationAssessmentHelp';
import { BoardItem } from '@cloudscape-design/board-components';
import { findOptionByValue } from '../pages/finance/widgets/paymentOptions';
import { getCurrencyInputDisplayValue } from '../utils/currencyFormat';
import { buildApplicantFacingReasonSentence, normalizeTemplateSentence } from '../utils/decisionLetterText';
import { closePendingDocumentWindow, navigateDocumentWindow, openPendingDocumentWindow } from '../utils/documentOpen';
import {
  APPLICATION_FINAL_STATUSES,
  APPLICATION_LOCKED_STATUSES,
  POST_DECISION_APPLICATION_STATUSES,
  buildAssessmentDecisionAlignmentError,
  deriveAssessmentDecisionStatusFromAgreement,
  deriveAssessmentReviewStatusSelection,
  deriveApplicationDecisionOutcome,
} from '../utils/applicationStatus';
import {
  canEditApplicationAssessmentBody,
  canPreserveReturnedAssessmentEligibility,
  isReturnedAssessmentEligibilityChangeUnverified,
} from '../utils/assessmentEditAccess';

const BARRIERS = [
  'None', 'Education', 'Lack of Marketable Skills', 'Lack of Work Experience', 'Remoteness', 'Lack of Transportation', 'Economic', 'Language', 'Lack of Labour Force Attachment', 'Dependent Care', 'Physical, Emotional, or Mental Health', 'Other'
];
const PRIORITIES = [
  'Off Reserve', 'Single Parent Family', 'Woman over 45', 'Literacy', 'Youth', 'Unskilled Clerical/Service Worker', 'No Grade 12', 'Unskilled Labourer', 'Non-Targeted'
];
const STABLE_CHECKBOX_GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0.5rem 1.5rem',
  alignItems: 'start'
};
const ESDC_OPTIONS = [
  { label: 'CRF', value: 'CRF' },
  { label: 'EI Active Claim', value: 'EI Active Claim' },
  { label: 'EI Reach Back', value: 'EI Reach Back' }
];
const RECOMMEND_OPTIONS = [
  { label: 'Recommend funding this intervention', value: 'recommend' },
  { label: 'Do not recommend funding', value: 'no_recommend' },
  { label: 'Recommend alternative intervention', value: 'alternative' }
];
const FUNDING_DECISION_OPTIONS = [
  { value: 'approve', label: 'Approve funding' },
  { value: 'reject', label: 'Deny funding' },
  { value: 'push_back', label: 'Request changes' }
];
const ASSESSMENT_REVIEW_STAGES = {
  rmReview: 'rm_review',
  nwacReview: 'nwac_review',
  returnedToRm: 'returned_to_rm',
  returnedToSubmitter: 'returned_to_submitter',
  finalDecisionRecorded: 'final_decision_recorded',
  withdrawn: 'withdrawn'
};
const ASSESSMENT_REVIEW_ACTIONS = {
  rmReturnToSubmitter: 'rm_return_to_submitter',
  rmSubmitToNwac: 'rm_submit_to_nwac',
  rmForwardChangesToSubmitter: 'rm_forward_changes_to_submitter'
};
const resolveRecommendationLabel = (value, fallback = 'No recommendation recorded') => {
  const normalized = String(value || '').trim().toLowerCase();
  const directOption = RECOMMEND_OPTIONS.find(option => option.value === normalized);
  if (directOption) return directOption.label;
  if (['fund', 'approve'].includes(normalized)) return 'Recommend funding this intervention';
  if (['do_not_fund', 'reject', 'decline'].includes(normalized)) return 'Do not recommend funding';
  if (normalized === 'alternative') return 'Recommend alternative intervention';
  return value ? String(value) : fallback;
};
const DENIAL_REASON_OPTIONS = [
  { value: 'eligibility_not_met', label: 'Eligibility criteria not met' },
  { value: 'documentation_missing', label: 'Required identity/supporting documentation not sufficient' },
  { value: 'training_not_aligned', label: 'Training not aligned with employment goal or labour-market outcomes' },
  { value: 'already_educated_employable', label: 'Applicant is already educated/employable for current objective' },
  { value: 'institution_not_eligible', label: 'Selected institution/program is not eligible under ISET criteria' },
  { value: 'duplicate_funding', label: 'Requested supports duplicate confirmed funding from another source' },
  { value: 'funding_unavailable', label: 'Funding not available under the requested stream' }
];
const DENIAL_REASON_LABEL_MAP = DENIAL_REASON_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});
const FUNDING_DECISION_REASON_CODE_KEY = 'fundingDecisionReasonCode';
const FUNDING_DECISION_REASON_LABEL_KEY = 'fundingDecisionReasonLabel';
const FUNDING_DECISION_REASON_EXPLANATION_KEY = 'fundingDecisionReasonExplanation';
const DENIAL_REASON_WORD_LIMIT = 100;
const buildDenialTemplateDraftForReason = ({
  reasonCode,
  requestedProgramName,
  requestedInstitution,
  employmentGoal,
  denialExplanation,
  optionsForward,
  partialServicesAvailable,
  otherFundingSummary
} = {}) => {
  const programPhrase = (() => {
    const program = String(requestedProgramName || '').trim();
    const institution = String(requestedInstitution || '').trim();
    if (program && institution) return `to pursue ${program} at ${institution}`;
    if (program) return `to pursue ${program}`;
    if (institution) return `to pursue training at ${institution}`;
    return 'seeking training support';
  })();
  const intro = [
    `Thank you for your recent application to the Native Women's Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program ${programPhrase}.`,
    'We appreciate the time and effort you invested in the application process and the interest you have shown in pursuing higher education and training.'
  ].join(' ');
  const detail = buildApplicantFacingReasonSentence(denialExplanation);
  const nextStepsText = Array.isArray(optionsForward) ? optionsForward.map(normalizeTemplateSentence).filter(Boolean).join(' ') : '';
  const partialServicesText = Array.isArray(partialServicesAvailable) && partialServicesAvailable.length
    ? `In the meantime, we can continue to offer limited supports including ${partialServicesAvailable.join(', ')}.`
    : '';
  const goalText = String(employmentGoal || '').trim();

  const buildReason = (...paragraphs) =>
    paragraphs
      .map(p => String(p || '').trim())
      .filter(Boolean)
      .join('\n\n');

  switch (String(reasonCode || '').trim()) {
    case 'documentation_missing':
      return {
        decision_intro: intro,
        decision_reason: buildReason(
          'After reviewing your application, your funding request is denied at this time because the required documentation confirming eligibility is not yet sufficient under NWAC ISET criteria.',
          detail ||
            'A self-declaration or partial third-party confirmation may be helpful, but on its own it is not sufficient to establish eligibility for NWAC ISET funding.',
          'We would be happy to reassess your eligibility when the required supporting documentation is received.',
          partialServicesText || nextStepsText
        )
      };
    case 'institution_not_eligible':
      return {
        decision_intro: intro,
        decision_reason: buildReason(
          'Under NWAC ISET eligibility criteria, funding is limited to publicly funded or provincially recognized training institutions and programs.',
          detail ||
            'Based on the information in your file, the selected institution or program is not currently eligible for funding under this requirement.',
          nextStepsText ||
            'If you identify a comparable program through an eligible institution, we would be pleased to reassess your application provided other criteria are met.'
        )
      };
    case 'duplicate_funding':
      return {
        decision_intro: intro,
        decision_reason: buildReason(
          'As part of our standard review process, NWAC verifies existing financial supports to avoid overlap in funding.',
          detail ||
            (otherFundingSummary
              ? `Our file review indicates existing support already covers requested costs (${otherFundingSummary}).`
              : 'Our review indicates that requested supports overlap with confirmed funding from another source.'),
          'Because overlapping supports cannot be duplicated under ISET policy, this request is denied at this time.',
          nextStepsText
        )
      };
    case 'already_educated_employable':
      return {
        decision_intro: intro,
        decision_reason: buildReason(
          'The ISET program prioritizes applicants facing significant barriers to employment and limited access to education or occupational training.',
          detail ||
            'Based on your file, you are currently considered educated and employable for your present objective, and your request does not meet current funding-priority criteria.',
          nextStepsText ||
            'We encourage you to explore alternate funding pathways such as scholarships, grants, or bursaries for advanced studies.'
        )
      };
    case 'training_not_aligned':
      return {
        decision_intro: intro,
        decision_reason: buildReason(
          `At this time, your application is denied because the proposed training does not align closely enough with your stated employment objective${goalText ? ` (${goalText})` : ''}.`,
          detail ||
            'ISET funding decisions must be linked to a clear skills-development and labour-market pathway.',
          nextStepsText ||
            'You are welcome to reapply when your selected program aligns more directly with your employment goal and labour-market outcomes.'
        )
      };
    case 'funding_unavailable':
      return {
        decision_intro: intro,
        decision_reason: buildReason(
          'At this time, your application is denied because funding is not currently available under the requested stream.',
          detail || '',
          nextStepsText || 'Please contact your case manager to review alternate supports or future intake opportunities.'
        )
      };
    case 'eligibility_not_met':
    default:
      return {
        decision_intro: intro,
        decision_reason: buildReason(
          'After reviewing your application against NWAC ISET eligibility criteria, your request is denied at this time.',
          detail || 'The information currently on file does not meet one or more eligibility requirements for this funding request.',
          nextStepsText || 'You may reapply if your circumstances change and program criteria are met.'
        )
      };
  }
};
const CHILDCARE_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' }
];

const POSTING_OPTIONS = [
  { value: 'external', label: 'External (region/PTMA)' },
  { value: 'internal', label: 'Internal (NWAC)' }
];

const EDUCATION_CODES = new Set([4, 5, 9, 10, 11, 12, 13]);
const EMPLOYER_CODES = new Set([6, 7, 8, 17]);
const WAGE_SUBSIDY_CODES = new Set([7, 8]);
const NOC_REQUIRED_CODES = new Set([6, 7, 8, 9, 10, 11, 12, 13, 17]);

const isEducationCode = (value) => {
  if (!value) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && EDUCATION_CODES.has(numeric);
};
const isEmployerCode = (value) => {
  if (!value) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && EMPLOYER_CODES.has(numeric);
};
const isWageSubsidyCode = (value) => {
  if (!value) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && WAGE_SUBSIDY_CODES.has(numeric);
};
const requiresExternalPartnerForCode = (value) => isEducationCode(value) || isEmployerCode(value);
const requiresNocForCode = (value) => {
  if (!value) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && NOC_REQUIRED_CODES.has(numeric);
};

const OVERVIEW_WORD_LIMIT = 400;
const EMPLOYMENT_GOALS_WORD_LIMIT = 400;
const HIGH_VALUE_FUNDING_APPROVAL_THRESHOLD = 20000;
const HIGH_VALUE_FUNDING_APPROVER_EMAIL = 'sstacey@nwac.ca';
const PROGRAM_ADMIN_ROLE_KEYS = new Set(['nwacadministrator']);
const LEGACY_APPLICATION_FALLBACK_STATUSES = new Set([
  'submitted',
  'in_review',
  'docs_requested',
  'closure_notice',
  'pending_approval',
  'decision_ready',
  'approved',
  'completed',
  'rejected',
  'closed',
  'archived',
]);
const ELIGIBILITY_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/bmp',
  'image/tiff'
];
const ELIGIBILITY_MAX_BYTES = 6 * 1024 * 1024;

const assessmentWizardStepStore = new Map();
const assessmentWizardLastKeyByCase = new Map();

const BASE_STEP_IDS = [
  'eligibility',
  'framing',
  'rationale',
  'barriers',
  'priorities',
  'otherFunding',
  'type',
  'childcare',
  'previousIset',
  'cost',
  'docs',
  'review'
];
const SUBMITTED_STEP_IDS = ['decision'];
const COMMUNICATION_STEP_IDS = ['communication'];
const FUNDING_DOCS_STEP_ID = 'fundingDocs';
const FUNDING_DOCS_STEP_IDS = [FUNDING_DOCS_STEP_ID];
const START_ASSESSMENT_STAGE = 'start_assessment';
const SUBMIT_ASSESSMENT_STAGE = 'submit_assessment';
const COMMUNICATION_CHECKLIST_STAGE = 'approve_and_commence';
const STEP_LABELS = {
  eligibility: 'Assess Eligibility',
  framing: 'What is being proposed?',
  rationale: 'Why is this intervention needed?',
  type: 'How will the intervention be delivered?',
  childcare: 'Does the client need childcare?',
  previousIset: 'Has the client received previous ISET funding?',
  barriers: 'Barriers to employment',
  priorities: 'Local area priorities (target areas)',
  otherFunding: 'Other funding sources',
  cost: 'What will it cost?',
  docs: 'Do you have the right supporting documents?',
  review: 'Review and submit',
  decision: 'Approval and decision',
  communication: 'Communication & agreement',
  fundingDocs: 'Funding forms and signatures'
};
const REQUIRED_STEP_IDS = BASE_STEP_IDS.slice(0, BASE_STEP_IDS.length - 1);
const OTHER_FUNDING_INVOLVED_OPTIONS = [
  { label: 'No', value: 'no' },
  { label: 'Yes', value: 'yes' },
  { label: 'Unknown', value: 'unknown' }
];
const OTHER_FUNDER_STATUS_CONFIRMED = 'confirmed';
const OTHER_FUNDER_STATUS_OPTIONS = [
  {
    label: 'Confirmed',
    value: OTHER_FUNDER_STATUS_CONFIRMED,
    description: 'This funder has confirmed coverage.'
  },
  {
    label: 'Pending',
    value: 'pending',
    description: 'A request or application is still waiting for a decision.'
  },
  {
    label: 'Denied',
    value: 'denied',
    description: 'Funding was requested and denied.'
  },
  {
    label: 'Unknown / not confirmed',
    value: 'unknown',
    description: 'The source is known, but coverage or amount is not confirmed.'
  }
];
const OTHER_FUNDER_STATUS_VALUE_SET = new Set(OTHER_FUNDER_STATUS_OPTIONS.map(option => option.value));
const OTHER_FUNDER_TYPE_OPTIONS = [
  {
    label: 'ISET Holder',
    value: 'iset_holder',
    description: 'Another ISET holder funding part of the plan.'
  },
  {
    label: 'Federal Program',
    value: 'federal_program',
    description: 'Federal funding program outside ISET.'
  },
  {
    label: 'Prov/Terr Program',
    value: 'provincial_territorial_program',
    description: 'Provincial or territorial grant/support.'
  },
  {
    label: 'Indigenous Government',
    value: 'indigenous_government_org',
    description: 'Band, Tribal Council, Métis/Inuit/regional Indigenous org.'
  },
  {
    label: 'Employer',
    value: 'employer',
    description: 'Employer-funded training, wage support, or sponsorship.'
  },
  {
    label: 'Bursary/Scholarship',
    value: 'education_bursary_scholarship',
    description: 'Education bursary, scholarship, or award.'
  },
  {
    label: 'Nonprofit/Charity',
    value: 'nonprofit_charity',
    description: 'Foundation, charity, or community nonprofit support.'
  },
  {
    label: 'Insurance/Compensation',
    value: 'insurance_compensation',
    description: 'Insurance, WCB/WSIB, settlement, or compensation support.'
  },
  {
    label: 'Personal/Family',
    value: 'personal_family',
    description: 'Self-funded or family-funded support.'
  },
  {
    label: 'Other Public',
    value: 'other_public',
    description: 'Municipal or other public agency support.'
  },
  {
    label: 'Other',
    value: 'other',
    description: 'Any other funding source.'
  }
];
const OTHER_FUNDER_TYPE_VALUE_SET = new Set(OTHER_FUNDER_TYPE_OPTIONS.map(option => option.value));
const resolveOtherFunderTypeLabel = value =>
  OTHER_FUNDER_TYPE_OPTIONS.find(option => option.value === normalizeOtherFunderType(value))?.label || 'Other';
const normalizeOtherFunderStatus = (value, source = {}) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (normalized === 'not_confirmed' || normalized === 'notconfirmed') return 'unknown';
  if (OTHER_FUNDER_STATUS_VALUE_SET.has(normalized)) return normalized;
  return String(source?.coverage || '').trim() ? OTHER_FUNDER_STATUS_CONFIRMED : 'unknown';
};
const resolveOtherFunderStatusLabel = value =>
  OTHER_FUNDER_STATUS_OPTIONS.find(option => option.value === normalizeOtherFunderStatus(value))?.label ||
  'Unknown / not confirmed';
const isConfirmedOtherFundingSource = source =>
  normalizeOtherFunderStatus(source?.status, source) === OTHER_FUNDER_STATUS_CONFIRMED;

const scrollToPageTop = () => {
  if (typeof window !== 'undefined') {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (_) {
      window.scrollTo(0, 0);
    }
  }
};

const SCROLL_DEBUG = true;
const debugScroll = (...args) => {
  if (SCROLL_DEBUG && typeof console !== 'undefined' && console.debug) {
    console.debug('[assessment scroll]', ...args);
  }
};
const isScrollable = (el) => {
  if (!el || !(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY;
  const canScroll = ['auto', 'scroll'].includes(overflowY);
  return canScroll && el.scrollHeight > el.clientHeight;
};
const findScrollableAncestor = (el) => {
  let current = el;
  while (current && current.parentElement) {
    if (isScrollable(current)) return current;
    current = current.parentElement;
  }
  return null;
};
const scrollElementToTop = (element) => {
  if (!element) {
    debugScroll('skip: no element');
    return;
  }
  try {
    element.scrollTo({ top: 0, behavior: 'smooth' });
    debugScroll('element scrollTo smooth', !!element);
  } catch (err) {
    element.scrollTop = 0;
    debugScroll('element scrollTop fallback', err?.message);
  }
};
const scrollWidgetAndPageTopOnce = (rootRef) => {
  const rootEl = rootRef?.current || null;
  const scrollTarget = rootEl ? findScrollableAncestor(rootEl) || rootEl : null;
  debugScroll('scrollWidgetAndPageTopOnce start', !!rootEl, 'scrollTargetIsRoot?', scrollTarget === rootEl);
  scrollElementToTop(scrollTarget);
  try {
    scrollToPageTop();
    debugScroll('window scrollTo success');
  } catch (err) {
    debugScroll('window scrollTo failed', err?.message);
  }
};

const resolveCaseContext = (caseData) => {
  if (caseData?.caseContext && typeof caseData.caseContext === 'object') {
    return caseData.caseContext;
  }
  if (caseData?.case_context && typeof caseData.case_context === 'object') {
    return caseData.case_context;
  }
  const rawContext = caseData?.case_context_json;
  if (typeof rawContext === 'string' && rawContext.trim()) {
    try {
      const parsed = JSON.parse(rawContext);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {
      return {};
    }
  }
  return {};
};

// Helper to format date as YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string' && date.length >= 10) return date.slice(0, 10);
  const d = new Date(date);
  if (isNaN(d)) return '';
  return d.toISOString().slice(0, 10);
};

const parseIsoDateToUtc = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\//g, '-');
  const parts = normalized.split('-');
  if (parts.length !== 3) return null;
  const [yyyy, mm, dd] = parts.map(part => Number.parseInt(part, 10));
  if (![yyyy, mm, dd].every(Number.isFinite)) return null;
  return Date.UTC(yyyy, mm - 1, dd);
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatShortDate = (value) => {
  const normalized = formatDate(value);
  if (!normalized) return '';
  const [yyyy, mm, dd] = normalized.split('-');
  const monthIndex = Number(mm) - 1;
  if (!yyyy || !dd || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return '';
  const monthLabel = MONTH_LABELS[monthIndex];
  return `${dd.padStart(2, '0')} ${monthLabel} ${yyyy}`;
};

const formatInterventionDates = (startDate, endDate) => {
  const normalizedStart = formatDate(startDate);
  const normalizedEnd = formatDate(endDate);
  const start = formatShortDate(normalizedStart);
  const end = formatShortDate(normalizedEnd);
  if (!start) return '—';
  if (!end || (normalizedStart && normalizedStart === normalizedEnd)) return start;
  return `${start}-${end}`;
};

const isDateInPast = (value) => {
  const normalized = formatDate(value);
  if (!normalized) return false;
  const dateUtc = parseIsoDateToUtc(normalized);
  if (dateUtc === null) return false;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return dateUtc < todayUtc;
};

const formatCaseStatusLabel = (value) => {
  if (!value) return '';
  return String(value)
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

const calculateDurationDays = (start, end) => {
  const startUtc = parseIsoDateToUtc(start);
  const endUtc = parseIsoDateToUtc(end);
  if (startUtc === null || endUtc === null) return null;
  // Inclusive day count; if start and end are the same day, duration is 1.
  const diff = Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff;
};

const MAX_INTERVENTION_DURATION_DAYS = 999;
const clampInterventionDurationDaysForIlmp = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.min(Math.round(numeric), MAX_INTERVENTION_DURATION_DAYS);
};

const addMonthsUtc = (startDate, monthsToAdd) => {
  const startUtc = parseIsoDateToUtc(startDate);
  if (startUtc === null) return '';
  const base = new Date(startUtc);
  const monthIndex = base.getUTCMonth() + monthsToAdd;
  base.setUTCMonth(monthIndex);
  if (Number.isNaN(base.getTime())) return '';
  return base.toISOString().slice(0, 10);
};

const deriveEndDateFromOccurrences = (startDate, occurrences) => {
  if (!startDate || !Number.isFinite(occurrences) || occurrences <= 0) return '';
  return addMonthsUtc(startDate, occurrences - 1);
};

const autoOccurrencesFromDates = (startDate, endDate, period) => {
  if (!startDate || !endDate || !period) return null;
  const startUtc = parseIsoDateToUtc(startDate);
  const endUtc = parseIsoDateToUtc(endDate);
  if (startUtc === null || endUtc === null) return null;
  if (endUtc < startUtc) return null;
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  const monthCount =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1;
  if (period === 'monthly') return Math.max(1, monthCount);
  if (period === 'quarterly') return Math.max(1, Math.ceil(monthCount / 3));
  const diffDays = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  if (!Number.isFinite(diffDays) || diffDays < 1) return null;
  const periodDays = period === 'bi_weekly' ? 14 : period === 'weekly' ? 7 : null;
  if (!periodDays) return null;
  return Math.max(1, Math.ceil(diffDays / periodDays));
};

const mergeRecurrenceDefaults = (base, overrides = {}) => {
  const pick = (value, fallback) =>
    value === '' || value === null || typeof value === 'undefined' ? fallback : value;
  return {
    ...base,
    ...overrides,
    startDate: pick(overrides.startDate, base.startDate),
    endDate: pick(overrides.endDate, base.endDate),
    occurrences: pick(overrides.occurrences, base.occurrences),
    amountPerPeriod: pick(overrides.amountPerPeriod, base.amountPerPeriod)
  };
};

const parseCurrencyToNumber = (value) => {
  if (value === null || typeof value === 'undefined') return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const cleaned = String(value).replace(/[^0-9.+-]/g, '');
  if (!cleaned) return 0;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCurrencyInput = (value) => {
  if (value === null || typeof value === 'undefined') return null;
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
};

const SUPPORTING_DOCS_REFRESH_EVENT = 'iset:supporting-documents:refresh';
const CASE_NOTES_REFRESH_EVENT = 'case-notes-refresh';
const CASE_EVENTS_REFRESH_EVENT = 'case-events-refresh';
const SUBMIT_PDF_CONFLICT_DOCUMENT_LABELS = Object.freeze({
  application_form: 'Application form',
  financial_overview: 'Financial overview'
});
const parseDocumentMetadata = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
const resolveDocumentType = (row) => {
  const direct = row?.document_category || row?.documentType || row?.document_type || null;
  if (direct) return String(direct).trim().toLowerCase();
  const metadata = parseDocumentMetadata(row?.metadata);
  const fromMetadata = metadata?.document_type || metadata?.documentType || null;
  return fromMetadata ? String(fromMetadata).trim().toLowerCase() : '';
};
const formatSubmitConflictUploadedAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};
const summarizeSubmitConflictDocuments = (documents = []) => {
  const list = Array.isArray(documents) ? documents : [];
  if (!list.length) return 'Existing uploaded files will be kept if selected below.';
  const preview = list.slice(0, 2).map(doc => {
    const name = doc?.label || doc?.fileName || 'Uploaded file';
    const uploadedAt = formatSubmitConflictUploadedAt(doc?.uploadedAt);
    return uploadedAt ? `${name} (${uploadedAt})` : name;
  });
  const remainingCount = list.length - preview.length;
  if (remainingCount > 0) {
    preview.push(`+${remainingCount} more`);
  }
  return preview.join(', ');
};

const formatCurrencyDisplay = (value) => {
  const num = parseCurrencyInput(value);
  if (num === null) return '';
  return `$ ${num.toFixed(2)}`;
};
const formatCurrencyForLetter = (value) => {
  const num = parseCurrencyInput(value);
  if (num === null) return '';
  return `$${num.toFixed(2)}`;
};

const normalizeAnswerValue = (value) => {
  if (value === null || typeof value === 'undefined') return '';
  if (typeof value === 'object') {
    if (value?.value !== undefined) return String(value.value).trim();
    if (value?.text !== undefined) return String(value.text).trim();
  }
  return String(value).trim();
};
const formatSupportLabelForLetter = (label) => {
  const trimmed = String(label || '').trim();
  if (!trimmed) return '';
  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
};
const toReadablePaymentTypeLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
};
const SUPPORT_LABEL_OVERRIDES = {
  TuitionFeesDirect: 'tuition',
  TuitionFeesReimbursement: 'tuition',
  BooksMaterialsDirect: 'books or program materials',
  BooksMaterialsReimbursement: 'books or program materials',
  LivingAllowance: 'living allowance',
  ResidenceCost: 'residence costs',
  Childcare: 'childcare',
  Transportation: 'transportation',
  WageSubsidyEmployer: 'targeted wage subsidy',
  SpecializedEquipmentAdvance: 'specialized equipment',
  SpecializedEquipmentReimbursement: 'specialized equipment',
  JCPProjectCost: 'project costs',
  SEBSupport: 'self-employment supports',
  OtherEligibleCost: 'other eligible costs'
};
const getSupportLabelFromPaymentType = (type) => {
  if (!type) return '';
  const override = SUPPORT_LABEL_OVERRIDES[type];
  if (override) return override;
  const base = toReadablePaymentTypeLabel(type).replace(/\s*\([^)]*\)\s*/g, '').trim();
  if (!base) return '';
  return formatSupportLabelForLetter(base);
};
const costLineHasPositiveFundingAmount = (line) => parseCurrencyToNumber(line?.amount) > 0;

const interventionHasFundedCostLines = (intervention) => {
  if (!intervention || typeof intervention !== 'object') return false;
  const costLines = Array.isArray(intervention?.costLines) ? intervention.costLines : [];
  if (costLines.some(costLineHasPositiveFundingAmount)) {
    return true;
  }
  const total = parseCurrencyToNumber(
    intervention?.costTotal ??
      intervention?.totalCost ??
      intervention?.cost ??
      intervention?.interventionCost
  );
  return total > 0;
};

const buildUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalizeOtherFundingInvolved = value => {
  if (value === null || typeof value === 'undefined') return '';
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'yes') return 'yes';
  if (normalized === 'no') return 'no';
  if (normalized === 'unknown') return 'unknown';
  return '';
};

const normalizeOtherFunderType = value => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!normalized) return 'other';
  if (OTHER_FUNDER_TYPE_VALUE_SET.has(normalized)) return normalized;
  return 'other';
};

const buildEmptyOtherFundingSource = (overrides = {}) => {
  const base = {
    id: overrides.id || buildUuid(),
    name: '',
    type: 'other',
    status: OTHER_FUNDER_STATUS_CONFIRMED,
    amount: '',
    coverage: '',
    notes: '',
    ...overrides
  };
  return {
    ...base,
    type: normalizeOtherFunderType(base.type || 'other'),
    status: normalizeOtherFunderStatus(base.status, base)
  };
};

const buildOtherFundingSourceModalState = (overrides = {}) => ({
  visible: false,
  mode: 'add',
  sourceId: null,
  draft: buildEmptyOtherFundingSource(),
  original: null,
  ...overrides
});

const validateOtherFundingSourceDraft = draft => {
  const next = buildEmptyOtherFundingSource(draft || {});
  const errors = {};
  if (!String(next.name || '').trim()) {
    errors.name = 'Funder name is required.';
  }
  if (isConfirmedOtherFundingSource(next) && !String(next.coverage || '').trim()) {
    errors.coverage = 'Coverage details are required for confirmed funding.';
  }
  const rawAmount = String(next.amount || '').trim();
  const parsedAmount = parseCurrencyInput(rawAmount);
  if (rawAmount && (parsedAmount === null || !Number.isFinite(parsedAmount) || parsedAmount < 0)) {
    errors.amount = 'Enter a valid amount in dollars, or leave it blank.';
  }
  return errors;
};

const parseLegacyOtherFundingSummary = value => {
  const text = String(value || '').trim();
  if (!text) return {};
  const involvedMatch = text.match(/Other funding involved:\s*(Yes|No|Unknown)\.?/i);
  const involved = involvedMatch ? involvedMatch[1].toLowerCase() : '';
  const notesMatch = text.match(/(?:^|\s)Notes:\s*([\s\S]*)$/i);
  const notes = notesMatch
    ? notesMatch[1].trim()
    : text.replace(/Other funding involved:\s*(Yes|No|Unknown)\.?\s*/i, '').trim();
  return {
    involved,
    sources: [],
    notes: notes || text
  };
};

const normalizeOtherFundingSources = (value, { keepEmpty = false, preserveWhitespace = false } = {}) => {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      const rawName = String(entry.name || '');
      const rawCoverage = String(entry.coverage || '');
      const rawAmount = String(entry.amount ?? entry.fundingAmount ?? entry.funding_amount ?? '');
      const rawNotes = String(entry.notes || '');
      const status = normalizeOtherFunderStatus(
        entry.status || entry.fundingStatus || entry.funding_status,
        entry
      );
      const normalized = buildEmptyOtherFundingSource({
        id: entry.id || buildUuid(),
        name: preserveWhitespace ? rawName : rawName.trim(),
        type: entry.type || 'other',
        status,
        amount: preserveWhitespace ? rawAmount : rawAmount.trim(),
        coverage: preserveWhitespace ? rawCoverage : rawCoverage.trim(),
        notes: preserveWhitespace ? rawNotes : rawNotes.trim()
      });
      const hasValues =
        rawName.trim() ||
        rawCoverage.trim() ||
        rawAmount.trim() ||
        rawNotes.trim() ||
        entry.status ||
        entry.fundingStatus ||
        entry.funding_status;
      return hasValues || keepEmpty ? normalized : null;
    })
    .filter(Boolean);
};

const normalizeOtherFundingDetails = (rawDetails, options = {}) => {
  const source =
    rawDetails && typeof rawDetails === 'object'
      ? rawDetails
      : (typeof rawDetails === 'string' ? parseLegacyOtherFundingSummary(rawDetails) : {});
  const keepEmptySources = Boolean(options.keepEmptySources);
  const preserveWhitespace = Boolean(options.preserveWhitespace);
  const involved = normalizeOtherFundingInvolved(source.involved);
  const populatedSources = normalizeOtherFundingSources(
    source.sources,
    { preserveWhitespace }
  );
  const sources = keepEmptySources
    ? normalizeOtherFundingSources(
        source.sources,
        { keepEmpty: true, preserveWhitespace }
      )
    : populatedSources;
  const rawNwacCoverage = String(source.nwacCoverage || '');
  const nwacCoverage = preserveWhitespace ? rawNwacCoverage : rawNwacCoverage.trim();
  const rawNotes = String(source.notes || '');
  const notes = preserveWhitespace ? rawNotes : rawNotes.trim();
  const resolvedInvolved =
    involved ||
    (populatedSources.length || String(nwacCoverage || '').trim() || String(notes || '').trim() ? 'yes' : '');
  return {
    involved: resolvedInvolved,
    sources,
    nwacCoverage,
    notes
  };
};

const buildOtherFundingSummary = details => {
  if (!details || typeof details !== 'object') return '';
  const involved = normalizeOtherFundingInvolved(details.involved);
  const sources = normalizeOtherFundingSources(details.sources);
  const nwacCoverage = String(details.nwacCoverage || '').trim();
  const notes = String(details.notes || '').trim();
  const lines = [];
  if (involved === 'yes') lines.push('Other funding involved: Yes.');
  if (involved === 'no') lines.push('Other funding involved: No.');
  if (involved === 'unknown') lines.push('Other funding involved: Unknown.');
  if (sources.length) {
    const formatted = sources.map(entry => {
      const typeLabel = resolveOtherFunderTypeLabel(entry.type);
      const statusLabel = resolveOtherFunderStatusLabel(entry.status);
      const name = entry.name || 'Unnamed funder';
      const amount = formatOtherFundingAmountDisplay(entry.amount);
      const coverage = entry.coverage || (isConfirmedOtherFundingSource(entry) ? 'Coverage not specified' : 'No confirmed coverage');
      const sourceNotes = entry.notes ? `; notes: ${entry.notes}` : '';
      return `${typeLabel}: ${name} (${statusLabel}; ${coverage}${amount ? `; amount: ${amount}` : ''}${sourceNotes})`;
    });
    lines.push(`Other funders: ${formatted.join('; ')}`);
  }
  if (nwacCoverage) {
    lines.push(`NWAC funding covers: ${nwacCoverage}`);
  }
  if (notes) {
    lines.push(`Notes: ${notes}`);
  }
  return lines.join(' ');
};

const formatOtherFundingAmountDisplay = value => {
  const amount = parseCurrencyInput(value);
  return amount !== null && Number.isFinite(amount) ? getCurrencyInputDisplayValue(amount, false) : '';
};

const toSafeFileToken = (value, fallback = 'letter') => {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token || fallback;
};

const toTitleCaseWords = (value) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());

const toSentenceCaseWords = (value) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
};

const formatCostTypeForLetter = (type) => {
  const direct = String(type || '').trim();
  if (!direct) return 'Approved support';
  if (SUPPORT_LABEL_OVERRIDES[direct]) {
    return toSentenceCaseWords(SUPPORT_LABEL_OVERRIDES[direct]);
  }
  return toSentenceCaseWords(toTitleCaseWords(direct));
};

const formatCaseManagerSignatureLines = ({ caseManagerName = '', caseManagerEmail = '', caseManagerPhone = '' } = {}) => {
  const lines = [];
  lines.push("NATIVE WOMEN'S ASSOCIATION OF CANADA (ISET Program)");
  lines.push('');
  if (caseManagerName) lines.push(caseManagerName);
  if (caseManagerEmail) lines.push(caseManagerEmail);
  if (caseManagerPhone) lines.push(caseManagerPhone);
  return lines.join('\n');
};

const buildInstitutionApprovalLetters = ({
  interventions = [],
  interventionTotals = new Map(),
  applicantName = '',
  trackingReference = '',
  decisionDate = '',
  caseManagerName = '',
  caseManagerEmail = '',
  caseManagerPhone = ''
} = {}) => {
  const normalizePayeeType = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const resolveInstitutionPayeeCategory = (line, institutionName) => {
    const payee = line?.payee && typeof line.payee === 'object' ? line.payee : {};
    const payeeTypeKey = normalizePayeeType(payee.type);
    const payeeTypeRaw = String(payee.type || '').trim().toLowerCase();
    const payeeName = String(payee.name || '').trim().toLowerCase();
    const institutionKey = String(institutionName || '').trim().toLowerCase();
    const paymentType = String(line?.type || '').trim().toLowerCase();
    const payeeHint = `${payeeTypeKey} ${payeeTypeRaw} ${payeeName}`.trim();

    if (/(participant|client|student|applicant)/.test(payeeHint)) return 'client';
    if (/(institution|university|college|school|training)/.test(payeeHint)) return 'institution';
    if (/(employer|supplier|vendor|provider|organization|organisation|community|nonprofit|charity)/.test(payeeHint)) return 'other';

    if (
      payeeTypeKey === 'accreditededucationaltraininginstitution' ||
      payeeTypeKey === 'traininginstitution' ||
      payeeTypeKey === 'traininginstitute'
    ) {
      return 'institution';
    }

    if (institutionKey && payeeName && payeeName.includes(institutionKey)) return 'institution';
    if (paymentType.includes('tuition')) return 'institution';
    if (paymentType.includes('reimbursement')) return 'client';

    if (
      paymentType.includes('living') ||
      paymentType.includes('transport') ||
      paymentType.includes('childcare')
    ) {
      return 'client';
    }
    if (paymentType.includes('books') || paymentType.includes('materials') || paymentType.includes('equipment')) {
      if (paymentType.includes('direct')) return 'other';
      return 'client';
    }

    return 'other';
  };
  const byInstitution = new Map();
  (Array.isArray(interventions) ? interventions : []).forEach(intervention => {
    const institution = String(intervention?.institution || '').trim();
    if (!institution) return;
    const interventionId = intervention?.id;
    const totalAmount = Number(interventionTotals?.get(interventionId) || 0);
    if (!(totalAmount > 0)) return;
    if (!byInstitution.has(institution)) {
      byInstitution.set(institution, {
        institution,
        totalAmount: 0,
        programs: new Set(),
        terms: new Set(),
        lineItems: []
      });
    }
    const target = byInstitution.get(institution);
    target.totalAmount += totalAmount;
    const programName = String(intervention?.programName || '').trim();
    if (programName) target.programs.add(programName);
    const termLabel = formatInterventionDates(intervention?.startDate, intervention?.endDate);
    if (termLabel && termLabel !== '—') target.terms.add(termLabel);
    const costLines = Array.isArray(intervention?.costLines) ? intervention.costLines : [];
    costLines.forEach((line, lineIndex) => {
      const amount = parseCurrencyToNumber(line?.amount);
      if (!(amount > 0)) return;
      const label = formatCostTypeForLetter(line?.type);
      target.lineItems.push({
        id: `${interventionId || 'intervention'}-${line?.id || lineIndex + 1}`,
        label,
        amount,
        termLabel,
        type: line?.type || '',
        payee: line?.payee && typeof line.payee === 'object' ? { ...line.payee } : null
      });
    });
  });
  return Array.from(byInstitution.values()).map((item, index) => {
    const programText = item.programs.size ? Array.from(item.programs).join(', ') : 'approved training supports';
    const termText = item.terms.size ? Array.from(item.terms).join('; ') : 'As assessed';
    const fundingLines = item.lineItems.length
      ? item.lineItems
      : [{
          id: `total-${index + 1}`,
          label: 'Approved training costs',
          amount: item.totalAmount,
          termLabel: termText,
          type: 'TuitionFeesDirect',
          payee: { type: 'AccreditedEducationalTrainingInstitution', name: item.institution }
        }];
    const formatFundingLine = line => `- ${line.label}: ${formatCurrencyForLetter(line.amount)}  Term/Dates: ${line.termLabel || termText}`;
    const institutionPayLines = [];
    const clientPayLines = [];
    const otherPayLines = [];
    fundingLines.forEach(line => {
      const category = resolveInstitutionPayeeCategory(line, item.institution);
      if (category === 'institution') {
        institutionPayLines.push(line);
      } else if (category === 'client') {
        clientPayLines.push(line);
      } else {
        otherPayLines.push(line);
      }
    });
    const fundingSectionParts = [];
    if (institutionPayLines.length) {
      fundingSectionParts.push(
        `The NWAC ISET Program has approved payment of the following costs directly to ${item.institution} on behalf of the student:`,
        institutionPayLines.map(formatFundingLine).join('\n')
      );
    }
    if (clientPayLines.length) {
      fundingSectionParts.push(
        'The following supports have also been approved for payment directly to the student:',
        clientPayLines.map(formatFundingLine).join('\n')
      );
    }
    if (otherPayLines.length) {
      fundingSectionParts.push(
        'The following supports have also been approved for payment to other eligible payees:',
        otherPayLines.map(formatFundingLine).join('\n')
      );
    }
    const fundingSection = fundingSectionParts.join('\n\n');
    const signatureBlock = formatCaseManagerSignatureLines({
      caseManagerName,
      caseManagerEmail,
      caseManagerPhone
    });
    const body = [
      'Letter of Approval (Institution)',
      `Date: ${decisionDate || ''}`,
      '',
      item.institution,
      '',
      'To Whom It May Concern,',
      '',
      "This letter is to formally confirm that the Native Women's Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program, has approved education-related funding on behalf of the following student:",
      '',
      `Student Name: ${applicantName || 'Student'}`,
      `Training Institution: ${item.institution}`,
      `Program of Study: ${programText}`,
      '',
      fundingSection,
      '',
      "These funds are provided under the ISET Program and are intended solely to support the student's participation in the approved training program noted above. Please note that all payments are made on behalf of the student. In the event of an overpayment, withdrawal, or change in enrollment status, any unused or refunded funds must be returned directly to the NWAC ISET Program and not issued to the student.",
      '',
      'Should you require additional documentation or clarification, please do not hesitate to contact the undersigned.',
      '',
      'Sincerely,',
      signatureBlock
    ].join('\n');
    return {
      id: `institution-${index + 1}`,
      recipientName: item.institution,
      title: `Institution Letter — ${item.institution}`,
      fileName: `institution-letter-${toSafeFileToken(item.institution, `recipient-${index + 1}`)}.txt`,
      body
    };
  });
};

const buildCoFunderApprovalLetters = ({
  fundingSources = [],
  nwacCoverage = '',
  notes = '',
  interventions = [],
  interventionTotals = new Map(),
  applicantName = '',
  trackingReference = '',
  decisionDate = '',
  caseManagerName = '',
  caseManagerEmail = '',
  caseManagerPhone = ''
} = {}) => {
  const coverageText = String(nwacCoverage || '').trim();
  const notesText = String(notes || '').trim();
  const normalizeInlineText = value => String(value || '').replace(/\s+/g, ' ').trim();
  const approvedTotal = (Array.isArray(interventions) ? interventions : [])
    .reduce((sum, intervention) => sum + Number(interventionTotals?.get(intervention?.id) || 0), 0);
  const institutionSet = new Set();
  const programSet = new Set();
  const termSet = new Set();
  const nwacFundingBreakdownLines = [];
  (Array.isArray(interventions) ? interventions : []).forEach(intervention => {
    const institution = String(intervention?.institution || '').trim();
    const program = String(intervention?.programName || '').trim();
    if (institution) institutionSet.add(institution);
    if (program) programSet.add(program);
    const term = formatInterventionDates(intervention?.startDate, intervention?.endDate);
    if (term && term !== '—') termSet.add(term);
    const costLines = Array.isArray(intervention?.costLines) ? intervention.costLines : [];
    costLines.forEach(line => {
      const amount = parseCurrencyToNumber(line?.amount);
      if (!(amount > 0)) return;
      const lineLabel = formatCostTypeForLetter(line?.type);
      const payee = line?.payee && typeof line.payee === 'object' ? line.payee : {};
      const payeeType = String(payee.type || deriveDefaultPayeeTypeForCostLine(line?.type) || '').trim();
      const explicitPayeeName = normalizeInlineText(payee.name || '');
      const defaultPayeeName = normalizeInlineText(
        deriveDefaultPayeeNameForCostLine(payeeType, intervention, applicantName || '')
      );
      const payeeName = explicitPayeeName || defaultPayeeName;
      const payeeTypeKey = normalizePayeeTypeKey(payeeType);
      const payeePhrase = (() => {
        if (payeeName) return payeeName;
        if (payeeTypeKey === 'participantclient' || payeeTypeKey === 'client') return applicantName || 'the student';
        const target = PAYEE_TYPE_DETAIL_TARGET_BY_KEY[payeeTypeKey] || '';
        return target ? `the ${target}` : 'the approved payee';
      })();
      const termLabel = term && term !== '—' ? term : '';
      nwacFundingBreakdownLines.push(
        `- ${lineLabel}: ${formatCurrencyForLetter(amount)} payable to ${payeePhrase}${termLabel ? ` (Term/Dates: ${termLabel})` : ''}`
      );
    });
  });
  const institutionText = institutionSet.size ? Array.from(institutionSet).join('; ') : 'the approved training institution';
  const programText = programSet.size ? Array.from(programSet).join('; ') : 'the approved program';
  const termText = termSet.size ? Array.from(termSet).join('; ') : 'the approved term(s)';
  const signatureBlock = formatCaseManagerSignatureLines({
    caseManagerName,
    caseManagerEmail,
    caseManagerPhone
  });
  return (Array.isArray(fundingSources) ? fundingSources.filter(isConfirmedOtherFundingSource) : [])
    .map((source, index) => {
      const funderName = String(source?.name || '').trim();
      if (!funderName) return null;
      const funderTypeLabel = resolveOtherFunderTypeLabel(source?.type);
      const sourceCoverage = String(source?.coverage || '').trim();
      const sourceAmount = formatOtherFundingAmountDisplay(source?.amount);
      const body = [
        'Letter of Approval (Other Funding Source)',
        `Date: ${decisionDate || ''}`,
        '',
        funderName,
        '',
        'To Whom It May Concern,',
        '',
        `I am writing to let you know that the Native Women's Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program, will be funding ${applicantName || 'the student'} for ${termText} in ${programText} at ${institutionText}.`,
        '',
        approvedTotal > 0
          ? `I have approved funding in the amount of ${formatCurrencyForLetter(approvedTotal)} for eligible costs under this intervention plan, which will be paid directly to approved payees as specified in the assessment.`
          : 'I have approved funding for eligible costs under this intervention plan, which will be paid directly to approved payees as specified in the assessment.',
        nwacFundingBreakdownLines.length ? '' : null,
        nwacFundingBreakdownLines.length ? 'NWAC funding breakdown:' : null,
        nwacFundingBreakdownLines.length ? nwacFundingBreakdownLines.join('\n') : null,
        '',
        `As documented in the assessment records, ${funderName} (${funderTypeLabel}) is identified as funding the following:`,
        sourceCoverage ? `- ${normalizeInlineText(sourceCoverage)}` : '- Funding details to be confirmed through your office.',
        sourceAmount ? `- Confirmed other funding amount: ${sourceAmount}` : '',
        coverageText ? `- NWAC coverage summary: ${normalizeInlineText(coverageText)}` : '',
        notesText ? `- Coordination notes: ${normalizeInlineText(notesText)}` : '',
        trackingReference ? `- File reference: ${normalizeInlineText(trackingReference)}` : '',
        '',
        'If you have any questions, please do not hesitate to contact me directly.',
        '',
        'Sincerely,',
        signatureBlock
      ]
        .map(line => (line === null || typeof line === 'undefined' ? '' : String(line)))
        .join('\n');
      return {
        id: source?.id || `funder-${index + 1}`,
        recipientName: funderName,
        title: `Other Funding Source Letter — ${funderName}`,
        fileName: `other-funding-source-letter-${toSafeFileToken(funderName, `recipient-${index + 1}`)}.txt`,
        body
      };
    })
    .filter(Boolean);
};

const buildLoanProviderApprovalLetters = ({
  interventions = [],
  applicantName = '',
  trackingReference = '',
  decisionDate = '',
  caseManagerName = '',
  caseManagerEmail = '',
  caseManagerPhone = ''
} = {}) => {
  const normalizeInlineText = value => String(value || '').replace(/\s+/g, ' ').trim();
  const groupedLetters = new Map();

  (Array.isArray(interventions) ? interventions : []).forEach(intervention => {
    const termLabel = formatInterventionDates(intervention?.startDate, intervention?.endDate);
    const costLines = Array.isArray(intervention?.costLines) ? intervention.costLines : [];
    costLines.forEach((line, lineIndex) => {
      if (normalizePaymentTypeCode(line?.type) !== 'StudentLoanRepayment') return;
      const amount = parseCurrencyToNumber(line?.amount);
      if (!(amount > 0)) return;
      const payee = line?.payee && typeof line.payee === 'object' ? line.payee : {};
      const payeeType = String(payee.type || deriveDefaultPayeeTypeForCostLine(line?.type) || '').trim();
      const explicitPayeeName = normalizeInlineText(payee.name || '');
      const defaultPayeeName = normalizeInlineText(
        deriveDefaultPayeeNameForCostLine(payeeType, intervention, applicantName || '')
      );
      const payeeName = explicitPayeeName || defaultPayeeName || 'Student loan provider';
      const accountNumber = normalizeInlineText(payee.reference || '');
      const groupKey = `${payeeName.toLowerCase()}::${accountNumber.toLowerCase() || 'no-account'}`;
      if (!groupedLetters.has(groupKey)) {
        groupedLetters.set(groupKey, {
          payeeName,
          accountNumber,
          totalAmount: 0,
          lineItems: []
        });
      }
      const target = groupedLetters.get(groupKey);
      target.totalAmount += amount;
      target.lineItems.push({
        id: `${intervention?.id || 'intervention'}-${line?.id || lineIndex + 1}`,
        label: formatCostTypeForLetter(line?.type),
        amount,
        termLabel: termLabel && termLabel !== '—' ? termLabel : ''
      });
    });
  });

  const signatureBlock = formatCaseManagerSignatureLines({
    caseManagerName,
    caseManagerEmail,
    caseManagerPhone
  });

  return Array.from(groupedLetters.values()).map((item, index) => {
    const applicantPossessive = applicantName ? `${applicantName}'s` : "the participant's";
    const fundingLines = item.lineItems.map(line =>
      `- ${line.label}: ${formatCurrencyForLetter(line.amount)}${line.termLabel ? ` (Term/Dates: ${line.termLabel})` : ''}`
    );
    const body = [
      'Letter of Approval (Loan Provider)',
      `Date: ${decisionDate || ''}`,
      '',
      item.payeeName,
      '',
      'To Whom It May Concern,',
      '',
      `This letter is to formally confirm that the Native Women's Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program, will repay a portion of ${applicantPossessive} eligible student loan in the total amount of ${formatCurrencyForLetter(item.totalAmount)}. Please apply this payment to the repayable portion of the account noted below.`,
      '',
      `Student Name: ${applicantName || 'Student'}`,
      item.accountNumber
        ? `Loan Account Number: ${item.accountNumber}`
        : 'Loan Account Number: To be confirmed by case manager',
      trackingReference ? `File Reference: ${normalizeInlineText(trackingReference)}` : null,
      fundingLines.length ? '' : null,
      fundingLines.length ? 'Approved repayment lines:' : null,
      fundingLines.length ? fundingLines.join('\n') : null,
      '',
      'If there is an overpayment, or if the participant withdraws from the approved program, any refunded funds must be returned directly to the NWAC ISET Program and not to the participant.',
      '',
      'Please let me know if you have any questions.',
      '',
      'Sincerely,',
      signatureBlock
    ]
      .map(line => (line === null || typeof line === 'undefined' ? '' : String(line)))
      .join('\n');
    return {
      id: `loan-provider-${index + 1}`,
      recipientName: item.payeeName,
      title: `Loan Provider Letter — ${item.payeeName}`,
      fileName: `loan-provider-letter-${toSafeFileToken(item.payeeName, `recipient-${index + 1}`)}.txt`,
      body
    };
  });
};

const sanitizeCurrencyInput = (value, options = {}) => {
  const { preserveTrailingDecimal = false } = options;
  if (value === null || value === undefined) return '';
  const cleaned = String(value).replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  const hasDecimal = cleaned.includes('.');
  const [whole, ...rest] = cleaned.split('.');
  const decimals = rest.join('').slice(0, 2);
  if (!hasDecimal) return whole;
  if (decimals.length) return `${whole}.${decimals}`;
  return preserveTrailingDecimal ? `${whole}.` : whole;
};

const buildEmptyCostLine = (overrides = {}) => ({
  id: buildUuid(),
  type: '',
  amount: '',
  notes: '',
  payee: {
    type: '',
    name: '',
    reference: ''
  },
  recurrence: {
    enabled: false,
    startDate: '',
    endDate: '',
    occurrences: '',
    amountPerPeriod: ''
  },
  ...overrides
});

const buildEmptyIntervention = (overrides = {}) => ({
  id: buildUuid(),
  code: '',
  startDate: '',
  endDate: '',
  deliveryMode: 'partner',
  institution: '',
  programName: '',
  itpDetails: '',
  wageSubsidyDetails: '',
  interventionNoc: '',
  interventionNocVersion: '',
  suggestionsSeeded: false,
  costLines: [],
  ...overrides
});

const normalizeCostLine = (raw, defaults = {}) => {
  if (!raw || typeof raw !== 'object') return null;
  const recurrenceRaw = raw.recurrence && typeof raw.recurrence === 'object' ? raw.recurrence : {};
  const payeeRaw = raw.payee && typeof raw.payee === 'object' ? raw.payee : {};
  const normalized = {
    id: raw.id || buildUuid(),
    type: normalizePaymentTypeCode(raw.type || raw.paymentType || raw.payment_type) || '',
    amount:
      raw.amount === null || typeof raw.amount === 'undefined'
        ? ''
        : String(raw.amount),
    notes: raw.notes || raw.description || '',
    payee: {
      type: String(payeeRaw.type || raw.payeeType || raw.payee_type || '').trim(),
      name: String(payeeRaw.name || raw.payeeName || raw.payee_name || '').trim(),
      reference: String(payeeRaw.reference || raw.payeeReference || raw.payee_reference || '').trim()
    },
    recurrence: {
      enabled: Boolean(recurrenceRaw.enabled ?? raw.recurrenceEnabled ?? raw.recurrence_enabled),
      startDate: formatDate(recurrenceRaw.startDate || recurrenceRaw.start_date || raw.recurrenceStartDate || raw.recurrence_start_date || ''),
      endDate: formatDate(recurrenceRaw.endDate || recurrenceRaw.end_date || raw.recurrenceEndDate || raw.recurrence_end_date || ''),
      occurrences:
        recurrenceRaw.occurrences === null || typeof recurrenceRaw.occurrences === 'undefined'
          ? ''
          : String(recurrenceRaw.occurrences),
      amountPerPeriod:
        recurrenceRaw.amountPerPeriod === null || typeof recurrenceRaw.amountPerPeriod === 'undefined'
          ? ''
          : String(recurrenceRaw.amountPerPeriod)
    }
  };
  return { ...buildEmptyCostLine(defaults), ...normalized };
};

const normalizeProposedIntervention = (raw, defaults = {}) => {
  if (!raw || typeof raw !== 'object') return null;
  const costLinesRaw = Array.isArray(raw.costLines) ? raw.costLines : Array.isArray(raw.cost_lines) ? raw.cost_lines : [];
  const normalized = {
    id: raw.id || buildUuid(),
    code: raw.code || raw.interventionCode || raw.intervention_code || '',
    startDate: formatDate(raw.startDate || raw.interventionStartDate || raw.intervention_start_date || ''),
    endDate: formatDate(raw.endDate || raw.interventionEndDate || raw.intervention_end_date || ''),
    deliveryMode: raw.deliveryMode || raw.delivery_mode || 'partner',
    institution: raw.institution || '',
    programName: raw.programName || raw.program_name || '',
    itpDetails: raw.itpDetails || raw.itp_details || raw.itp?.details || '',
    wageSubsidyDetails: raw.wageSubsidyDetails || raw.wage_subsidy_details || raw.wage?.subsidyDetails || '',
    interventionNoc: raw.interventionNoc || raw.intervention_noc || '',
    interventionNocVersion: raw.interventionNocVersion || raw.intervention_noc_version || '',
    suggestionsSeeded: Boolean(raw.suggestionsSeeded ?? raw.suggestions_seeded),
    costLines: costLinesRaw.map(item => normalizeCostLine(item)).filter(Boolean)
  };
  return { ...buildEmptyIntervention(defaults), ...normalized };
};

const hasInterventionValues = (intervention) => {
  if (!intervention || typeof intervention !== 'object') return false;
  const hasCode = Boolean(intervention.code && String(intervention.code).trim());
  const hasDates = Boolean(intervention.startDate || intervention.endDate);
  const hasDetails = Boolean(
    intervention.institution ||
      intervention.programName ||
      intervention.itpDetails ||
      intervention.wageSubsidyDetails ||
      intervention.interventionNoc ||
      intervention.interventionNocVersion
  );
  const hasCostLines = Array.isArray(intervention.costLines) && intervention.costLines.length > 0;
  return hasCode || hasDates || hasDetails || hasCostLines;
};

const normalizeProposedInterventions = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  const normalized = list
    .map(item => normalizeProposedIntervention(item))
    .filter(Boolean)
    .filter(hasInterventionValues);
  if (normalized.length) return normalized;
  return [];
};

const normalizeInterventionCodeValue = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};
const PAYMENT_TYPE_ALIASES = {
  wagesubsidyemployer: 'WageSubsidyEmployer',
  wagesubsidy: 'WageSubsidyEmployer',
  targetedwagesubsidyemployer: 'WageSubsidyEmployer',
  targetedwagesubsidy: 'WageSubsidyEmployer',
  residencecost: 'ResidenceCost',
  residencecosts: 'ResidenceCost',
  residencefee: 'ResidenceCost',
  residencefees: 'ResidenceCost',
  residence: 'ResidenceCost',
  housing: 'ResidenceCost'
};
const PAYEE_TYPE_PARTICIPANT_CLIENT = 'ParticipantClient';
const PAYEE_TYPES_DEFAULT_FROM_INTERVENTION = new Set([
  'AccreditedEducationalTrainingInstitution',
  'EmployerWageSubsidyPartner',
  'CommunityNonProfitOrganization'
]);
const PAYMENT_TYPE_DEFAULT_PAYEE_TYPE = {
  LivingAllowance: PAYEE_TYPE_PARTICIPANT_CLIENT,
  ResidenceCost: 'AccreditedEducationalTrainingInstitution',
  TuitionFeesReimbursement: PAYEE_TYPE_PARTICIPANT_CLIENT,
  SpecializedEquipmentReimbursement: PAYEE_TYPE_PARTICIPANT_CLIENT,
  Transportation: PAYEE_TYPE_PARTICIPANT_CLIENT,
  BooksMaterialsReimbursement: PAYEE_TYPE_PARTICIPANT_CLIENT,
  TuitionFeesDirect: 'AccreditedEducationalTrainingInstitution',
  WageSubsidyEmployer: 'EmployerWageSubsidyPartner',
  Childcare: 'ChildcareProvider',
  BooksMaterialsDirect: 'TrainingRelatedSupplier',
  SpecializedEquipmentAdvance: 'TrainingRelatedSupplier',
  JCPProjectCost: 'CommunityNonProfitOrganization',
  StudentLoanRepayment: 'StudentLoanServicer'
};
const SUBMISSION_TIMING_INTERVENTION_START = 'intervention_start';
const SUBMISSION_TIMING_INTERVENTION_END = 'intervention_end';
const SUBMISSION_TIMING_RECURRENCE_SCHEDULE = 'recurrence_schedule';
const SUBMISSION_TIMING_MANUAL_TRIGGER = 'manual_trigger';
const DEFAULT_SUBMISSION_TIMING_BY_TYPE = {
  LivingAllowance: SUBMISSION_TIMING_RECURRENCE_SCHEDULE,
  ResidenceCost: SUBMISSION_TIMING_INTERVENTION_START,
  TuitionFeesDirect: SUBMISSION_TIMING_INTERVENTION_START,
  TuitionFeesReimbursement: SUBMISSION_TIMING_INTERVENTION_END,
  SpecializedEquipmentAdvance: SUBMISSION_TIMING_INTERVENTION_START,
  SpecializedEquipmentReimbursement: SUBMISSION_TIMING_INTERVENTION_END,
  WageSubsidyEmployer: SUBMISSION_TIMING_RECURRENCE_SCHEDULE,
  Childcare: SUBMISSION_TIMING_RECURRENCE_SCHEDULE,
  Transportation: SUBMISSION_TIMING_RECURRENCE_SCHEDULE,
  BooksMaterialsDirect: SUBMISSION_TIMING_INTERVENTION_START,
  BooksMaterialsReimbursement: SUBMISSION_TIMING_INTERVENTION_END,
  JCPProjectCost: SUBMISSION_TIMING_MANUAL_TRIGGER,
  SEBSupport: SUBMISSION_TIMING_RECURRENCE_SCHEDULE,
  OtherEligibleCost: SUBMISSION_TIMING_MANUAL_TRIGGER
};
const normalizePayeeTypeKey = value =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const PAYEE_TYPE_DETAIL_TARGET_BY_KEY = {
  participantclient: 'client',
  client: 'client',
  vendor: 'vendor',
  traininginstitution: 'institution',
  traininginstitute: 'institution',
  traininginstitue: 'institution',
  accreditededucationaltraininginstitution: 'institution',
  employer: 'employer',
  employerwagesubsidypartner: 'employer',
  childcareprovider: 'childcare provider',
  communitynonprofitorganization: 'community organization',
  trainingrelatedsupplier: 'supplier',
  professionalbusinessservicesprovider: 'service provider',
  studentloanservicer: 'student loan provider',
  other: 'other payee'
};
const normalizePaymentTypeCode = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return PAYMENT_TYPE_ALIASES[key] || raw;
};
const normalizeSubmissionTiming = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === SUBMISSION_TIMING_INTERVENTION_START) return SUBMISSION_TIMING_INTERVENTION_START;
  if (normalized === SUBMISSION_TIMING_INTERVENTION_END) return SUBMISSION_TIMING_INTERVENTION_END;
  if (normalized === SUBMISSION_TIMING_RECURRENCE_SCHEDULE) return SUBMISSION_TIMING_RECURRENCE_SCHEDULE;
  if (normalized === SUBMISSION_TIMING_MANUAL_TRIGGER) return SUBMISSION_TIMING_MANUAL_TRIGGER;
  return null;
};
const deriveDefaultPayeeTypeForCostLine = (costLineType) => {
  const normalizedType = normalizePaymentTypeCode(costLineType);
  if (!normalizedType) return '';
  return PAYMENT_TYPE_DEFAULT_PAYEE_TYPE[normalizedType] || '';
};
const deriveDefaultPayeeNameForCostLine = (payeeType, intervention, participantLegalName) => {
  const normalizedType = String(payeeType || '').trim();
  if (!normalizedType) return '';
  if (normalizedType === PAYEE_TYPE_PARTICIPANT_CLIENT) {
    return participantLegalName || '';
  }
  if (PAYEE_TYPES_DEFAULT_FROM_INTERVENTION.has(normalizedType)) {
    return String(intervention?.institution || '').trim();
  }
  return '';
};
const applyCostLinePayeeDefaults = (draft, intervention, participantLegalName, options = {}) => {
  if (!draft || typeof draft !== 'object') return draft;
  const { allowTypeAutofill = true } = options;
  const payee = draft.payee && typeof draft.payee === 'object' ? draft.payee : {};
  let payeeType = String(payee.type || '').trim();
  if (!payeeType && allowTypeAutofill) {
    payeeType = deriveDefaultPayeeTypeForCostLine(draft.type);
  }
  const existingName = String(payee.name || '').trim();
  const defaultName = deriveDefaultPayeeNameForCostLine(payeeType, intervention, participantLegalName);
  const nextPayee = {
    type: payeeType,
    name: existingName,
    reference: String(payee.reference || '').trim()
  };
  if (payeeType === PAYEE_TYPE_PARTICIPANT_CLIENT) {
    nextPayee.name = defaultName || existingName;
    nextPayee.reference = '';
  } else if (!nextPayee.name && defaultName) {
    nextPayee.name = defaultName;
  }
  return { ...draft, payee: nextPayee };
};

const buildPaymentTypeMappingLookup = (mapping) => {
  const lookup = new Map();
  if (!mapping || !Array.isArray(mapping.interventions)) return lookup;
  mapping.interventions.forEach(entry => {
    const code = normalizeInterventionCodeValue(entry?.code);
    if (!code) return;
    const types = Array.isArray(entry.availablePaymentTypes)
      ? entry.availablePaymentTypes.filter(Boolean)
      : [];
    lookup.set(code, new Set(types));
  });
  return lookup;
};

const normalizeCostingDefaults = (payload) => {
  if (!payload || payload.enabled === false) return { enabled: false };
  const interventionsRaw = Array.isArray(payload.interventions) ? payload.interventions : [];
  const paymentTypesRaw = Array.isArray(payload.paymentTypes) ? payload.paymentTypes : [];
  const interventions = interventionsRaw
    .map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      const code = normalizeInterventionCodeValue(entry.code || entry.interventionCode || entry.intervention_code);
      if (!code) return null;
      const suggested = Array.isArray(entry.suggested || entry.suggestedItems || entry.suggested_items)
        ? entry.suggested || entry.suggestedItems || entry.suggested_items
        : [];
      const normalizedSuggested = suggested
        .map(item => {
          if (typeof item === 'string') return { type: item };
          if (item && typeof item === 'object') {
            return {
              type: normalizePaymentTypeCode(item.type || item.paymentType || item.payment_type) || '',
              notes: item.notes || item.description || '',
              recurrenceEnabled: item.recurrenceEnabled ?? item.recurrence_enabled ?? null
            };
          }
          return null;
        })
        .filter(item => item && item.type);
      return {
        code,
        suggested: normalizedSuggested
      };
    })
    .filter(Boolean);
  const paymentTypes = paymentTypesRaw
    .map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      const code = normalizePaymentTypeCode(entry.code || entry.type || entry.paymentType || entry.payment_type);
      if (!code) return null;
      const recurrence = entry.recurrence && typeof entry.recurrence === 'object' ? entry.recurrence : {};
      return {
        code,
        recurrence: {
          mode: recurrence.mode || recurrence.rule || entry.recurrenceMode || entry.recurrence_mode || 'not_allowed'
        }
      };
    })
    .filter(Boolean);
  return {
    enabled: payload.enabled !== false,
    strategy: payload.strategy || payload.defaultStrategy || 'allowed',
    interventions,
    paymentTypes
  };
};

const normalizePaymentTypeMappingPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const paymentTypesRaw = Array.isArray(payload.paymentTypes) ? payload.paymentTypes : Array.isArray(payload.payment_types) ? payload.payment_types : [];
  const payeeTypesRaw = Array.isArray(payload.payeeTypes) ? payload.payeeTypes : Array.isArray(payload.payee_types) ? payload.payee_types : [];
  const paymentTypes = paymentTypesRaw
    .map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      const code = normalizePaymentTypeCode(entry.code || entry.value || entry.paymentType || entry.payment_type);
      if (!code) return null;
      return {
        code,
        label:
          typeof entry.label === 'string' && entry.label.trim()
            ? entry.label.trim()
            : typeof entry.name === 'string' && entry.name.trim()
              ? entry.name.trim()
              : code,
        submissionTiming: normalizeSubmissionTiming(entry.submissionTiming || entry.submission_timing)
      };
    })
    .filter(Boolean);
  const payeeTypes = payeeTypesRaw
    .map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      const codeRaw = entry.code || entry.value || entry.payeeType || entry.payee_type;
      const code = typeof codeRaw === 'string' ? codeRaw.trim() : '';
      if (!code) return null;
      return {
        code,
        label:
          typeof entry.label === 'string' && entry.label.trim()
            ? entry.label.trim()
            : typeof entry.name === 'string' && entry.name.trim()
              ? entry.name.trim()
              : code,
        description:
          typeof entry.description === 'string' && entry.description.trim()
            ? entry.description.trim()
            : typeof entry.helpText === 'string' && entry.helpText.trim()
              ? entry.helpText.trim()
              : null
      };
    })
    .filter(Boolean);
  const interventionsRaw = Array.isArray(payload.interventions) ? payload.interventions : [];
  const isTrue = (value) => value === true || value === 1 || value === '1' || value === 'true';
  const interventions = interventionsRaw
    .map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      const code = normalizeInterventionCodeValue(entry.code || entry.interventionCode || entry.intervention_code);
      if (!code) return null;
      const typesRaw = entry.availablePaymentTypes || entry.available_payment_types || entry.paymentTypes || entry.payment_types || [];
      const types = Array.isArray(typesRaw)
        ? Array.from(new Set(typesRaw.map(value => String(value || '').trim()).filter(Boolean)))
        : [];
      return {
        code,
        name: entry.name || entry.label || null,
        availablePaymentTypes: types,
        defaultOnAssessment:
          isTrue(entry.defaultOnAssessment) ||
          isTrue(entry.default_on_assessment) ||
          isTrue(entry.defaultInAssessment) ||
          isTrue(entry.default_in_assessment)
      };
    })
    .filter(Boolean);
  if (!interventions.length && !paymentTypes.length && !payeeTypes.length) return null;
  return { ...payload, paymentTypes, payeeTypes, interventions };
};

const buildDefaultAssessmentInterventionsFromMapping = (mapping) => {
  if (!mapping || !Array.isArray(mapping.interventions)) return [];
  return mapping.interventions
    .filter(entry => entry?.defaultOnAssessment === true)
    .map(entry => {
      const code = normalizeInterventionCodeValue(entry?.code);
      if (!code) return null;
      return buildEmptyIntervention({ code });
    })
    .filter(Boolean);
};

const isRecurrenceScheduleComplete = (line) => {
  const recurrence = line?.recurrence || {};
  if (!recurrence.enabled) return false;
  const startDate = formatDate(recurrence.startDate);
  if (!startDate) return false;
  const occurrencesValue =
    recurrence.occurrences === '' || recurrence.occurrences === null || typeof recurrence.occurrences === 'undefined'
      ? null
      : Number(recurrence.occurrences);
  const occurrences = Number.isFinite(occurrencesValue) ? occurrencesValue : null;
  if (!occurrences || occurrences <= 0) return false;
  const endDate = formatDate(recurrence.endDate) || deriveEndDateFromOccurrences(startDate, occurrences);
  if (!endDate) return false;
  const startUtc = parseIsoDateToUtc(startDate);
  const endUtc = parseIsoDateToUtc(endDate);
  if (startUtc !== null && endUtc !== null && endUtc < startUtc) return false;
  return true;
};

const recalcRecurringAmounts = ({ amount, amountPerPeriod, occurrences, adjustMode }) => {
  const occ = Number(occurrences);
  if (!Number.isFinite(occ) || occ <= 0) {
    return { amount, amountPerPeriod };
  }
  const totalValue = parseCurrencyInput(amount);
  const perPeriodValue = parseCurrencyInput(amountPerPeriod);
  const normalize = (value) => (value === null || typeof value === 'undefined' ? '' : formatCurrencyDisplay(value));
  if (adjustMode === 'total') {
    if (Number.isFinite(perPeriodValue)) {
      return { amount: normalize(perPeriodValue * occ), amountPerPeriod };
    }
    if (Number.isFinite(totalValue)) {
      return { amount, amountPerPeriod: normalize(totalValue / occ) };
    }
    return { amount, amountPerPeriod };
  }
  if (Number.isFinite(totalValue)) {
    return { amount, amountPerPeriod: normalize(totalValue / occ) };
  }
  if (Number.isFinite(perPeriodValue)) {
    return { amount: normalize(perPeriodValue * occ), amountPerPeriod };
  }
  return { amount, amountPerPeriod };
};

const formatDocTypeLabel = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

const isEmptyString = (val) => val === null || val === undefined || val === '';
const isEmptyArray = (val) => !Array.isArray(val) || val.length === 0;
const countWords = (value) => {
  if (!value) return 0;
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
};
const limitWords = (value, maxWords) => {
  if (!value) return '';
  const words = String(value).trim().split(/\s+/);
  if (words.length <= maxWords) return value;
  return words.slice(0, maxWords).join(' ');
};
const normalizeConflictDeclarationChoice = (value) => {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim().toLowerCase();
  if (['no_conflict', 'no-conflict', 'none', 'no'].includes(normalized)) return 'no_conflict';
  if (['conflict', 'has_conflict', 'has-conflict', 'potential_conflict'].includes(normalized)) return 'conflict';
  return '';
};
const normalizeConflictResolutionOutcome = (value) => {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim().toLowerCase();
  if (['cleared', 'clear', 'resolved', 'approved_to_continue'].includes(normalized)) return 'cleared';
  if (['reassigned', 'reassign', 'routed'].includes(normalized)) return 'reassigned';
  return '';
};
const mergeAssessmentState = (current, incoming) => {
  const next = { ...incoming };
  const takeIfNonEmpty = (key) => {
    if (isEmptyString(incoming[key]) && !isEmptyString(current?.[key])) {
      next[key] = current[key];
    }
  };
  [
    'dateOfAssessment',
    'clientName',
    'overview',
    'employmentGoals',
    'previousISET',
    'previousISETDetails',
    'barriersOther',
    'otherFundingInvolved',
    'otherFundingNwacCoverage',
    'otherFundingNotes',
    'esdcEligibility',
    'recommendation',
    'justification',
    'nwacReviewStatus',
    'nwacReview',
    'nwacReason',
    'interventionPotId',
    'postingContext',
    'childcareNeed',
    'childcareFunding',
  ].forEach(takeIfNonEmpty);

  if (isEmptyArray(incoming.barriers) && Array.isArray(current?.barriers) && current.barriers.length) {
    next.barriers = current.barriers;
  }
  if (isEmptyArray(incoming.priorities) && Array.isArray(current?.priorities) && current.priorities.length) {
    next.priorities = current.priorities;
  }
  if (isEmptyArray(incoming.otherFundingSources) && Array.isArray(current?.otherFundingSources) && current.otherFundingSources.length) {
    next.otherFundingSources = current.otherFundingSources;
  }

  if (Array.isArray(incoming.proposedInterventions) && incoming.proposedInterventions.length) {
    next.proposedInterventions = incoming.proposedInterventions;
  } else if (Array.isArray(current?.proposedInterventions) && current.proposedInterventions.length) {
    next.proposedInterventions = current.proposedInterventions;
  }

  return next;
};

const buildEmptyAssessment = () => ({
  dateOfAssessment: '',
  clientName: '',
  overview: '',
  employmentGoals: '',
  previousISET: '',
  previousISETDetails: '',
  barriers: [],
  barriersOther: '',
  priorities: [],
  otherFundingInvolved: '',
  otherFundingSources: [],
  otherFundingNwacCoverage: '',
  otherFundingNotes: '',
  esdcEligibility: '',
  proposedInterventions: [],
  recommendation: '',
  justification: '',
  nwacReviewStatus: '',
  nwacReview: '',
  nwacReason: '',
  interventionPotId: '',
  postingContext: '',
  childcareNeed: '',
  childcareFunding: ''
});

const DEFAULT_ORG_NAME = 'NWAC ISET Program';
const buildEmptyDecisionLetterDraft = () => ({
  decision_date: '',
  letter_title: '',
  decision_intro: '',
  decision_label: '',
  decision_reason: '',
  next_step_1: '',
  next_step_2: '',
  coordinator_name: '',
  organization_name: ''
});
const hasDecisionLetterContent = (draft) => {
  if (!draft || typeof draft !== 'object') return false;
  return ['decision_intro', 'decision_reason', 'next_step_1', 'next_step_2'].some(key => {
    const value = draft[key];
    return typeof value === 'string' && value.trim();
  });
};
const buildEmptyDecisionLetterDrafts = () => ({
  approval: buildEmptyDecisionLetterDraft(),
  denial: buildEmptyDecisionLetterDraft()
});
const APPLICATION_ASSESSMENT_CONTEXT_KEY = 'applicationDecisionLetters';
const APPLICATION_ASSESSMENT_CONTEXT_ROOT_KEYS = [
  'assessmentOtherFunding',
  'assessment_nwac_review_status',
  'decisionLetterDrafts',
  'decision_letter_drafts',
  'decisionLetter',
  'decision_letter',
  'decisionLetterPackDrafts',
  'decision_letter_pack_drafts',
  'decisionLetterSent',
  'decision_letter_sent',
  'decisionLetterSentType',
  'decision_letter_sent_type',
  'decisionLetterSentAt',
  'decision_letter_sent_at',
  FUNDING_DECISION_REASON_CODE_KEY,
  FUNDING_DECISION_REASON_LABEL_KEY,
  FUNDING_DECISION_REASON_EXPLANATION_KEY
];
const normalizeApplicationContextKey = (value) => {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) return String(numeric);
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
};
const isPlainObject = value => value && typeof value === 'object' && !Array.isArray(value);
const getApplicationAssessmentContext = (context, applicationId, { allowLegacyFallback = false } = {}) => {
  if (!isPlainObject(context)) return {};
  const applicationKey = normalizeApplicationContextKey(applicationId);
  if (!applicationKey) return context;
  const applicationContexts = context[APPLICATION_ASSESSMENT_CONTEXT_KEY];
  const scopedContext = isPlainObject(applicationContexts) && isPlainObject(applicationContexts[applicationKey])
    ? applicationContexts[applicationKey]
    : null;
  if (scopedContext) return scopedContext;
  return allowLegacyFallback ? context : {};
};
const getDecisionLetterDrafts = (context, applicationId) => {
  const assessmentContext = getApplicationAssessmentContext(context, applicationId);
  return (
    assessmentContext.decisionLetterDrafts ||
    assessmentContext.decision_letter_drafts ||
    assessmentContext.decisionLetter ||
    assessmentContext.decision_letter ||
    null
  );
};
const getDecisionLetterSent = (context, applicationId) => {
  const assessmentContext = getApplicationAssessmentContext(context, applicationId);
  if (!assessmentContext || typeof assessmentContext !== 'object') return null;
  const raw = assessmentContext.decisionLetterSent || assessmentContext.decision_letter_sent || null;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  const legacyType = assessmentContext.decisionLetterSentType || assessmentContext.decision_letter_sent_type || null;
  const legacyAt = assessmentContext.decisionLetterSentAt || assessmentContext.decision_letter_sent_at || null;
  if (legacyType && legacyAt) {
    return { [legacyType]: legacyAt };
  }
  return null;
};
const getDecisionLetterPackDrafts = (context, applicationId) => {
  const assessmentContext = getApplicationAssessmentContext(context, applicationId);
  if (!assessmentContext || typeof assessmentContext !== 'object') return null;
  const raw = assessmentContext.decisionLetterPackDrafts || assessmentContext.decision_letter_pack_drafts || null;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  return null;
};
const buildApplicationAssessmentCaseContext = (baseContext, applicationId, updates = {}) => {
  const context = isPlainObject(baseContext) ? { ...baseContext } : {};
  const applicationKey = normalizeApplicationContextKey(applicationId);
  if (!applicationKey) {
    return { ...context, ...(isPlainObject(updates) ? updates : {}) };
  }
  APPLICATION_ASSESSMENT_CONTEXT_ROOT_KEYS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(context, key)) {
      delete context[key];
    }
  });
  const existingApplicationContexts = isPlainObject(context[APPLICATION_ASSESSMENT_CONTEXT_KEY])
    ? context[APPLICATION_ASSESSMENT_CONTEXT_KEY]
    : {};
  const existingScopedContext = getApplicationAssessmentContext(baseContext, applicationId);
  context[APPLICATION_ASSESSMENT_CONTEXT_KEY] = {
    ...existingApplicationContexts,
    [applicationKey]: {
      ...(isPlainObject(existingScopedContext) ? existingScopedContext : {}),
      ...(isPlainObject(updates) ? updates : {})
    }
  };
  return context;
};
const normalizeDecisionDateValue = (value, fallback = '') => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return fallback || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const formatted = formatDate(trimmed);
  return formatted || trimmed;
};
const LETTER_MARKERS = {
  date: /^date\s*:/i,
  decision: /^decision\s*:/i,
  reason: /^reason\s*:/i,
  nextSteps: /^next steps?\s*:/i,
  sincerely: /^sincerely\b/i
};
const buildLetterBodyFromDraft = (
  draft = {},
  { includeNextSteps = true, includeDecisionLabel = true, includeReasonLabel = true } = {}
) => {
  const safe = value => (typeof value === 'string' ? value.trim() : '');
  const title = safe(draft.letter_title);
  const date = safe(draft.decision_date);
  const intro = typeof draft.decision_intro === 'string' ? draft.decision_intro.trim() : '';
  const decisionLabel = safe(draft.decision_label);
  const reason = typeof draft.decision_reason === 'string' ? draft.decision_reason.trim() : '';
  const nextStep1 = typeof draft.next_step_1 === 'string' ? draft.next_step_1.trim() : '';
  const nextStep2 = typeof draft.next_step_2 === 'string' ? draft.next_step_2.trim() : '';
  const coordinator = safe(draft.coordinator_name);
  const organization = safe(draft.organization_name);
  const lines = [];
  if (title) lines.push(title);
  if (date) lines.push(`Date: ${date}`);
  if (lines.length) lines.push('');
  if (intro) {
    lines.push(intro);
    lines.push('');
  }
  if (includeDecisionLabel && decisionLabel) {
    lines.push(`Decision: ${decisionLabel}`);
  }
  if (reason) {
    if (includeReasonLabel) {
      if (reason.includes('\n')) {
        lines.push('Reason:');
        lines.push(reason);
      } else {
        lines.push(`Reason: ${reason}`);
      }
    } else {
      if (includeDecisionLabel && decisionLabel && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      lines.push(reason);
    }
  } else if (includeReasonLabel) {
    lines.push('Reason:');
  }
  if (includeNextSteps) {
    lines.push('');
    lines.push('Next steps:');
    lines.push(nextStep1 ? `- ${nextStep1}` : '- ');
    lines.push(nextStep2 ? `- ${nextStep2}` : '- ');
  }
  lines.push('');
  lines.push('Sincerely,');
  if (coordinator) lines.push(coordinator);
  if (organization) lines.push(organization);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
const parseLetterBodyToDraft = (value, fallback = buildEmptyDecisionLetterDraft()) => {
  const base = { ...fallback };
  const normalized = typeof value === 'string' ? value.replace(/\r\n/g, '\n') : '';
  const lines = normalized.split('\n');
  const trimmedLines = lines.map(line => line.trim());
  const dateIndex = trimmedLines.findIndex(line => LETTER_MARKERS.date.test(line));
  const decisionIndex = trimmedLines.findIndex(line => LETTER_MARKERS.decision.test(line));
  const reasonIndex = trimmedLines.findIndex(line => LETTER_MARKERS.reason.test(line));
  const nextStepsIndex = trimmedLines.findIndex(line => LETTER_MARKERS.nextSteps.test(line));
  const sincerelyIndex = trimmedLines.findIndex(line => LETTER_MARKERS.sincerely.test(line));
  const hasMarkers = [dateIndex, decisionIndex, reasonIndex, nextStepsIndex, sincerelyIndex].some(index => index >= 0);
  if (!hasMarkers) {
    base.decision_intro = normalized.trim();
    return base;
  }
  let titleIndex = -1;
  if (dateIndex > 0) {
    for (let i = dateIndex - 1; i >= 0; i -= 1) {
      if (trimmedLines[i]) {
        titleIndex = i;
        break;
      }
    }
  } else if (dateIndex === -1) {
    titleIndex = trimmedLines.findIndex(line => line.length > 0);
  }
  if (titleIndex >= 0) {
    base.letter_title = lines[titleIndex].trim();
  } else if (dateIndex === 0) {
    base.letter_title = '';
  }
  if (dateIndex >= 0) {
    const dateValue = lines[dateIndex].replace(LETTER_MARKERS.date, '').trim();
    base.decision_date = normalizeDecisionDateValue(dateValue, base.decision_date);
  }
  const introStartBase = dateIndex >= 0 ? dateIndex + 1 : (titleIndex >= 0 ? titleIndex + 1 : 0);
  const endCandidates = [decisionIndex, reasonIndex, nextStepsIndex, sincerelyIndex].filter(index => index >= 0);
  const introEnd = endCandidates.length ? Math.min(...endCandidates) : lines.length;
  let introStart = introStartBase;
  while (introStart < introEnd && !trimmedLines[introStart]) {
    introStart += 1;
  }
  const hasDecisionMarker = decisionIndex >= 0;
  const hasReasonMarker = reasonIndex >= 0;
  if (!hasDecisionMarker && !hasReasonMarker) {
    const bodyLines = lines.slice(introStart, introEnd);
    const paragraphs = [];
    let current = [];
    bodyLines.forEach(line => {
      if (!line.trim()) {
        if (current.length) {
          paragraphs.push(current.join('\n').trim());
          current = [];
        }
        return;
      }
      current.push(line);
    });
    if (current.length) {
      paragraphs.push(current.join('\n').trim());
    }
    base.decision_intro = paragraphs[0] || '';
    base.decision_reason = paragraphs.slice(1).join('\n\n').trim();
  } else {
    base.decision_intro = lines.slice(introStart, introEnd).join('\n').trim();
  }
  if (decisionIndex >= 0) {
    base.decision_label = lines[decisionIndex].replace(LETTER_MARKERS.decision, '').trim();
  }
  if (reasonIndex >= 0) {
    const reasonEndCandidates = [nextStepsIndex, sincerelyIndex].filter(index => index > reasonIndex);
    const reasonEnd = reasonEndCandidates.length ? Math.min(...reasonEndCandidates) : lines.length;
    const reasonLines = lines.slice(reasonIndex, reasonEnd);
    const firstLine = reasonLines[0].replace(LETTER_MARKERS.reason, '').trim();
    const rest = reasonLines.slice(1).join('\n').trim();
    base.decision_reason = [firstLine, rest].filter(Boolean).join('\n').trim();
  }
  if (nextStepsIndex >= 0) {
    const stepsEnd = sincerelyIndex > nextStepsIndex ? sincerelyIndex : lines.length;
    const stepLines = lines.slice(nextStepsIndex + 1, stepsEnd);
    const steps = [];
    stepLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed === '-' || trimmed === '*' || /^\d+[.)]$/.test(trimmed)) return;
      const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/) || trimmed.match(/^\d+[.)]\s+(.*)$/);
      if (bulletMatch) {
        const content = bulletMatch[1].trim();
        if (content) steps.push(content);
        return;
      }
      if (!steps.length) {
        steps.push(trimmed);
        return;
      }
      steps[steps.length - 1] = `${steps[steps.length - 1]} ${trimmed}`.trim();
    });
    base.next_step_1 = steps[0] || '';
    base.next_step_2 = steps[1] || '';
  }
  if (sincerelyIndex >= 0) {
    const closingLines = lines.slice(sincerelyIndex + 1).map(line => line.trim()).filter(Boolean);
    base.coordinator_name = closingLines[0] || '';
    base.organization_name = closingLines[1] || '';
  }
  return base;
};
const extractJsonFromAi = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const CoordinatorAssessmentWidget = forwardRef(
  ({ actions, toggleHelpPanel, caseData, application_id, onCaseUpdate, applicationRowVersion, onRowVersionUpdate, workspaceEntry }, ref) => {
  const history = useHistory();
  const approvalWorkspaceEntry =
    workspaceEntry?.mode === 'approval' && workspaceEntry?.approvalType === 'application'
      ? workspaceEntry
      : null;
  const approvalRequestedStep = approvalWorkspaceEntry?.step || null;
  // State for form fields
  const [assessment, setAssessment] = useState(() => buildEmptyAssessment());
  const [initialAssessment, setInitialAssessment] = useState(() => buildEmptyAssessment());
  const [letterDrafts, setLetterDrafts] = useState(() => buildEmptyDecisionLetterDrafts());
  const [initialLetterDrafts, setInitialLetterDrafts] = useState(() => buildEmptyDecisionLetterDrafts());
  const [letterBody, setLetterBody] = useState('');
  const [approvalLetterPackTabId, setApprovalLetterPackTabId] = useState('client');
  const [approvalLetterPackGenerated, setApprovalLetterPackGenerated] = useState(false);
  const initialApplicationId = caseData?.application_id ?? caseData?.applicationId ?? application_id ?? null;
  const [savedApprovalLetterPackDrafts, setSavedApprovalLetterPackDrafts] = useState(
    () => getDecisionLetterPackDrafts(caseData?.caseContext, initialApplicationId) || null
  );
  const [decisionLetterSent, setDecisionLetterSent] = useState(
    () => getDecisionLetterSent(caseData?.caseContext, initialApplicationId) || {}
  );
  const letterBodyDirtyRef = useRef(false);
  const lastActiveLetterKeyRef = useRef(null);
  const [denialReasonModalVisible, setDenialReasonModalVisible] = useState(false);
  const [denialReasonChoice, setDenialReasonChoice] = useState(
    () => getApplicationAssessmentContext(caseData?.caseContext, initialApplicationId)?.[FUNDING_DECISION_REASON_CODE_KEY] || ''
  );
  const [denialReasonExplanation, setDenialReasonExplanation] = useState(
    () => getApplicationAssessmentContext(caseData?.caseContext, initialApplicationId)?.[FUNDING_DECISION_REASON_EXPLANATION_KEY] || ''
  );
  const [denialReasonErrors, setDenialReasonErrors] = useState({});
  const [denyFundingModalVisible, setDenyFundingModalVisible] = useState(false);
  const [denyFundingLoading, setDenyFundingLoading] = useState(false);
  const [pendingDecisionJump, setPendingDecisionJump] = useState(false);
  const [denyFundingFlowActive, setDenyFundingFlowActive] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [alert, setAlert] = useState(null);
  const [applicationRowVersionState, setApplicationRowVersion] = useState(() =>
    Number(applicationRowVersion || caseData?.application_row_version || 0)
  );
  const updateRowVersion = useCallback(
    (next) => {
      const numeric = Number(next || 0);
      if (!numeric) return;
      setApplicationRowVersion(prev => {
        const target = numeric > (prev || 0) ? numeric : prev || numeric;
        return target;
      });
      if (typeof onRowVersionUpdate === 'function') {
        onRowVersionUpdate(numeric);
      }
    },
    [onRowVersionUpdate]
  );
  const [isChanged, setIsChanged] = useState(false);
  const [draftingLetter, setDraftingLetter] = useState(false);
  const [draftingLetterError, setDraftingLetterError] = useState(null);
  const [sendingLetter, setSendingLetter] = useState(false);
  const [sendingLetterError, setSendingLetterError] = useState(null);
  const [letterWorkflows, setLetterWorkflows] = useState({ approval: null, denial: null });
  const [letterWorkflowsLoading, setLetterWorkflowsLoading] = useState(false);
  const [letterWorkflowsError, setLetterWorkflowsError] = useState(null);
  const [showNWACSection, setShowNWACSection] = useState(false);
  const [reviewWorkflowNote, setReviewWorkflowNote] = useState('');
  const [reviewWorkflowActionLoading, setReviewWorkflowActionLoading] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [validationAlert, setValidationAlert] = useState(null);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [submitDocumentConflictModalVisible, setSubmitDocumentConflictModalVisible] = useState(false);
  const [submitDocumentConflicts, setSubmitDocumentConflicts] = useState([]);
  const [submitDocumentRetention, setSubmitDocumentRetention] = useState({});
  const [isEditingAssessment, setIsEditingAssessment] = useState(false);
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);
  const [showRecallConfirmModal, setShowRecallConfirmModal] = useState(false);
  const [isRecallingAssessment, setIsRecallingAssessment] = useState(false);
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
  const [showSendApprovalLetterConfirmModal, setShowSendApprovalLetterConfirmModal] = useState(false);
  const [showDecisionPendingAlert, setShowDecisionPendingAlert] = useState(true);
  const [dismissedReviewNoticeKey, setDismissedReviewNoticeKey] = useState(null);
  const [showFundingDocsIncompleteModal, setShowFundingDocsIncompleteModal] = useState(false);
  const [localAssessmentSubmitted, setLocalAssessmentSubmitted] = useState(false);
  const [checklistWarningVisible, setChecklistWarningVisible] = useState(false);
  const [checklistWarningItems, setChecklistWarningItems] = useState([]);
  const [checklistNextAction, setChecklistNextAction] = useState(null);
  const [budgetPotOptions, setBudgetPotOptions] = useState([]);
  const [budgetPotLoading, setBudgetPotLoading] = useState(false);
  const [checklistCheckError, setChecklistCheckError] = useState(null);
  const [checkingChecklist, setCheckingChecklist] = useState(false);
  const [documentChecklistItems, setDocumentChecklistItems] = useState([]);
  const [documentChecklistMissingCount, setDocumentChecklistMissingCount] = useState(0);
  const [documentChecklistLoading, setDocumentChecklistLoading] = useState(false);
  const [documentChecklistError, setDocumentChecklistError] = useState(null);
  const [docsUploadLockedDismissed, setDocsUploadLockedDismissed] = useState(false);
  const [checklistUploadError, setChecklistUploadError] = useState(null);
  const [checklistUploadSuccess, setChecklistUploadSuccess] = useState(null);
  const [checklistUploadModalVisible, setChecklistUploadModalVisible] = useState(false);
  const [checklistUploadDocTypes, setChecklistUploadDocTypes] = useState([]);
  const [checklistUploadDocType, setChecklistUploadDocType] = useState('');
  const [checklistUploadLabel, setChecklistUploadLabel] = useState('');
  const [checklistUploading, setChecklistUploading] = useState(false);
  const [eiVerificationFile, setEiVerificationFile] = useState(null);
  const [eiVerificationFileError, setEiVerificationFileError] = useState(null);
  const [eiVerificationUploadError, setEiVerificationUploadError] = useState(null);
  const [eiVerificationUploadSuccess, setEiVerificationUploadSuccess] = useState(null);
  const [eiVerificationUploading, setEiVerificationUploading] = useState(false);
  const [eiVerificationDocuments, setEiVerificationDocuments] = useState([]);
  const [eiVerificationDocsLoading, setEiVerificationDocsLoading] = useState(false);
  const [eiVerificationDocsError, setEiVerificationDocsError] = useState(null);
  const [eiVerificationDocDownloads, setEiVerificationDocDownloads] = useState({});
  const eiVerificationFileInputRef = useRef(null);
  const checklistFileInputRef = useRef(null);
  const nextChecklistDocTypeRef = useRef('');
  const pendingAssessmentSubmitRef = useRef(null);
  const nextChecklistLabelRef = useRef('');
  const [currentStep, setCurrentStep] = useState(BASE_STEP_IDS[0]);
  const [wizardNavPriming, setWizardNavPriming] = useState(false);
  const [attemptedSteps, setAttemptedSteps] = useState({});
  const wizardStepRestoreKeyRef = useRef(null);
  const wizardStepRestoreStepsRef = useRef(null);
  const approvalEntryStepAppliedRef = useRef(null);
  const wizardNavPrimeRef = useRef({ signature: null, restoreStep: null });
  const suppressPostDecisionStepAutoPrimeRef = useRef(false);
  const defaultInterventionSeedCaseKeyRef = useRef(null);
  const defaultInterventionSeedAppliedRef = useRef(false);
  const widgetRootRef = useRef(null);
  const alertAnchorRef = useRef(null);
  const previousAlertKeyRef = useRef(null);
  const setWidgetRootRef = useCallback((node) => {
    widgetRootRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref && typeof ref === 'object') {
      ref.current = node;
    }
  }, [ref]);
  const {
    lockState,
    acquireLock,
    releaseLock,
    refreshLock: refreshLockHeartbeat,
    isLockedByMe
  } = useApplicationLock(application_id);
  const [lockingAssessment, setLockingAssessment] = useState(false);
  const {
    userId: currentUserId,
    staffProfileId: currentStaffProfileId,
    displayName: currentUserName,
    email: currentUserEmail,
    role: currentUserRole,
    groups: currentUserGroups
  } = useCurrentUser();
  const userRole = currentUserRole || '';
  const normalizedRole = (userRole || '').toString().trim().toLowerCase();
  const canonicalRole = normalizedRole === 'regional manager' ? 'regional manager' : normalizedRole;
  const isAssessor = canonicalRole === 'iset coordinator';
  const groupKeys = Array.isArray(currentUserGroups)
    ? currentUserGroups.map(group => String(group || '').trim().toLowerCase().replace(/[\s-]+/g, '_'))
    : [];
  const isIsetCoordinator = groupKeys.includes('iset_coordinator');
  const roleKey = normalizedRole.replace(/[\s_-]+/g, '');
  const normalizedUserEmail = (currentUserEmail || '').trim().toLowerCase();
  const isProgramAdminRole = PROGRAM_ADMIN_ROLE_KEYS.has(roleKey);
  const isNwacAdministrator = isProgramAdminRole || groupKeys.includes('nwac_administrator');
  const canApproveHighValueFunding = normalizedUserEmail === HIGH_VALUE_FUNDING_APPROVER_EMAIL;
  const eligibilityRoleAllowlist = new Set([
    'systemadministrator',
    'nwacadministrator',
    'regionalmanager'
  ]);
  const canManageEiEligibility = eligibilityRoleAllowlist.has(roleKey);
  const isEligibilityAdmin = canManageEiEligibility;
  const canUploadEiVerification = canManageEiEligibility;
  const proposedInterventions = useMemo(
    () => (Array.isArray(assessment.proposedInterventions) ? assessment.proposedInterventions : []),
    [assessment.proposedInterventions]
  );
  const interventionTotals = useMemo(() => {
    const totals = new Map();
    proposedInterventions.forEach(intervention => {
      const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
      const total = lines.reduce((sum, line) => {
        const amount = parseCurrencyInput(line.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      totals.set(intervention.id, total);
    });
    return totals;
  }, [proposedInterventions]);
  const overallCostTotal = useMemo(() => {
    let total = 0;
    interventionTotals.forEach(value => {
      if (Number.isFinite(value)) total += value;
    });
    return total;
  }, [interventionTotals]);
  const approvalHasFundingPackage = useMemo(() => {
    if (proposedInterventions.some(interventionHasFundedCostLines)) {
      return true;
    }
    return Number.isFinite(overallCostTotal) && overallCostTotal > 0;
  }, [overallCostTotal, proposedInterventions]);
  const isHighValueFundingApprovalBlocked =
    Number.isFinite(overallCostTotal) &&
    overallCostTotal >= HIGH_VALUE_FUNDING_APPROVAL_THRESHOLD &&
    !canApproveHighValueFunding;
  const approvalBlockMessage = isHighValueFundingApprovalBlocked
    ? `Only Shelley Stacey (${HIGH_VALUE_FUNDING_APPROVER_EMAIL}) can approve funding of $${HIGH_VALUE_FUNDING_APPROVAL_THRESHOLD.toLocaleString()} or above.`
    : null;
  const selectedDecisionRequiresHighValueApprover =
    assessment.nwacReviewStatus === 'approve' && Boolean(approvalBlockMessage);

  const [interventionCodes, setInterventionCodes] = useState([]);
  const [interventionCodesLoading, setInterventionCodesLoading] = useState(false);
  const [nocVersions, setNocVersions] = useState([]);
  const [nocVersionsLoading, setNocVersionsLoading] = useState(false);
  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);
  const [paymentTypeMapping, setPaymentTypeMapping] = useState(null);
  // Start in loading state so default intervention seeding cannot run before mapping fetch starts.
  const [paymentTypeMappingLoading, setPaymentTypeMappingLoading] = useState(true);
  const [costingDefaults, setCostingDefaults] = useState(null);
  const [costingDefaultsLoading, setCostingDefaultsLoading] = useState(false);
  const [interventionModal, setInterventionModal] = useState({
    visible: false,
    mode: 'view',
    interventionId: null,
    draft: null,
    original: null
  });
  const [interventionModalErrors, setInterventionModalErrors] = useState({});
  const [interventionDeleteId, setInterventionDeleteId] = useState(null);
  const [otherFundingSourceModal, setOtherFundingSourceModal] = useState(() =>
    buildOtherFundingSourceModalState()
  );
  const [otherFundingSourceModalErrors, setOtherFundingSourceModalErrors] = useState({});
  const [costLineModal, setCostLineModal] = useState({
    visible: false,
    mode: 'view',
    interventionId: null,
    lineId: null,
    draft: null,
    original: null
  });
  const [costLineModalErrors, setCostLineModalErrors] = useState({});
  const [costLineAmountFocused, setCostLineAmountFocused] = useState(false);
  const [costLineAmountPerPeriodFocused, setCostLineAmountPerPeriodFocused] = useState(false);
  const [inlineAmountEditingId, setInlineAmountEditingId] = useState(null);
  const [endDateAdjustModal, setEndDateAdjustModal] = useState(null);
  const [occurrenceConfirmModal, setOccurrenceConfirmModal] = useState(null);
  const [conflictDeclarationSigned, setConflictDeclarationSigned] = useState(Boolean(caseData?.assessment_conflict_declaration_signed));
  const [, setConflictDeclarationSignedAt] = useState(caseData?.assessment_conflict_declaration_signed_at || null);
  const [persistedConflictDeclarationChoice, setPersistedConflictDeclarationChoice] = useState(
    normalizeConflictDeclarationChoice(
      caseData?.assessment_conflict_declaration_choice ||
      (caseData?.assessment_conflict_declaration_signed ? 'no_conflict' : '')
    )
  );
  const [persistedConflictDeclarationDetails, setPersistedConflictDeclarationDetails] = useState(
    caseData?.assessment_conflict_declaration_details || ''
  );
  const [conflictDeclarationResolutionOutcome, setConflictDeclarationResolutionOutcome] = useState(
    normalizeConflictResolutionOutcome(caseData?.assessment_conflict_declaration_resolution_outcome)
  );
  const [conflictDeclarationChoice, setConflictDeclarationChoice] = useState(
    normalizeConflictDeclarationChoice(
      caseData?.assessment_conflict_declaration_choice ||
      (caseData?.assessment_conflict_declaration_signed ? 'no_conflict' : '')
    )
  );
  const [conflictDeclarationDetails, setConflictDeclarationDetails] = useState(caseData?.assessment_conflict_declaration_details || '');
  const [isSigningDeclaration, setIsSigningDeclaration] = useState(false);
  const [declarationError, setDeclarationError] = useState(null);
  const [conflictHoldModalVisible, setConflictHoldModalVisible] = useState(false);
  const [, setShowConflictAlert] = useState(true);
  const scrollWidgetAndPageTop = useCallback(() => {
    debugScroll('scrollWidgetAndPageTop');
    scrollWidgetAndPageTopOnce(widgetRootRef);
  }, []);
  const scrollAfterAction = useCallback(() => {
    // Scroll widget and page to top after save/submit actions.
    debugScroll('scrollAfterAction');
    scrollWidgetAndPageTopOnce(widgetRootRef);
  }, []);

  const rawApplicationStatus =
    caseData?.applicationStatusRaw ??
    caseData?.application_status_raw ??
    caseData?.applicationStatus ??
    caseData?.application_status ??
    null;
  const rawCaseStatusSnapshot = caseData?.status ?? '';
  const applicationStatusContext = getApplicationStatusContext(rawApplicationStatus);
  const legacyApplicationFallbackContext = getApplicationStatusContext(rawCaseStatusSnapshot);
  const caseDerivedApplicationStatus = LEGACY_APPLICATION_FALLBACK_STATUSES.has(
    legacyApplicationFallbackContext.canonicalStatus
  )
    ? legacyApplicationFallbackContext.canonicalStatus
    : '';
  const canonicalApplicationStatus = applicationStatusContext.canonicalStatus || caseDerivedApplicationStatus;
  const isPendingApprovalStatus = applicationStatusContext.isPendingApprovalStatus;
  const normalizedApplicationStatus = canonicalApplicationStatus || '';
  const isPostDecisionStatus = POST_DECISION_APPLICATION_STATUSES.has(normalizedApplicationStatus);
  const isCompletedStatus = normalizedApplicationStatus === 'completed';
  const persistedDecisionOutcome = useMemo(
    () => deriveApplicationDecisionOutcome({
      applicationStatus: canonicalApplicationStatus || rawApplicationStatus,
      caseStatus: rawCaseStatusSnapshot,
      decisionOutcome: caseData?.decision_outcome ?? caseData?.decisionOutcome ?? null,
      reviewStatus: caseData?.assessment_nwac_review_status ?? caseData?.assessment_nwac_review ?? null,
    }),
    [
      canonicalApplicationStatus,
      rawApplicationStatus,
      rawCaseStatusSnapshot,
      caseData?.decision_outcome,
      caseData?.decisionOutcome,
      caseData?.assessment_nwac_review_status,
      caseData?.assessment_nwac_review,
    ]
  );
  const decisionOutcome = useMemo(() => {
    const decision = assessment.nwacReviewStatus;
    if (decision === 'approve') return 'approved';
    if (decision === 'reject') return 'denied';
    return persistedDecisionOutcome;
  }, [assessment.nwacReviewStatus, persistedDecisionOutcome]);
  const activeLetterKey = decisionOutcome === 'approved' ? 'approval' : decisionOutcome === 'denied' ? 'denial' : null;
  const applicantUserId = caseData?.applicant_user_id ?? caseData?.applicantUserId ?? null;
  const applicationId = caseData?.application_id ?? caseData?.applicationId ?? application_id ?? null;
  const caseId = caseData?.id ?? caseData?.case_id ?? null;
  const reviewWorkflow = caseData?.reviewWorkflow || caseData?.review_workflow || null;
  const reviewStage = reviewWorkflow?.currentStage || reviewWorkflow?.current_stage || null;
  const reviewWorkflowMetadata = (() => {
    const raw = reviewWorkflow?.metadata || reviewWorkflow?.metadata_json || {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
    if (typeof raw !== 'string') return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  })();
  const requiresSubmitterCorrectionReturn = Boolean(
    reviewWorkflowMetadata.requiresSubmitterCorrectionReturn === true ||
    reviewWorkflowMetadata.requires_submitter_correction_return === true
  );
  const hasReviewWorkflow = Boolean(reviewStage);
  const reviewWorkflowSubmitterStaffProfileId = Number(
    reviewWorkflow?.submittedByStaffProfileId ??
    reviewWorkflow?.submitted_by_staff_profile_id ??
    0
  );
  const isCurrentReviewWorkflowSubmitter = Boolean(
    reviewWorkflowSubmitterStaffProfileId > 0 &&
    Number(currentStaffProfileId) === reviewWorkflowSubmitterStaffProfileId
  );
  const twoStepReviewEnabled = Boolean(
    caseData?.twoStepReviewEnabled ||
    caseData?.two_step_review_enabled ||
    hasReviewWorkflow
  );
  const isRegionalManager = roleKey === 'regionalmanager';
  const isReviewWithRegionalManager =
    twoStepReviewEnabled &&
    (
      reviewStage === ASSESSMENT_REVIEW_STAGES.rmReview ||
      reviewStage === ASSESSMENT_REVIEW_STAGES.returnedToRm
    );
  const isReviewWithNwac =
    twoStepReviewEnabled &&
    reviewStage === ASSESSMENT_REVIEW_STAGES.nwacReview;
  // The workflow stage is authoritative for reviewer ownership. Keep reviewer
  // controls reachable even if an independent lifecycle writer left the
  // application status stale (for example, a document-request completion).
  const isApplicationAssessmentReviewerStage =
    isReviewWithRegionalManager || isReviewWithNwac;
  const canRegionalManagerReview = isRegionalManager && isReviewWithRegionalManager;
  useEffect(() => {
    if (!caseId) {
      setDecisionLetterSent({});
      return;
    }
    const sent = getDecisionLetterSent(caseData?.caseContext, applicationId) || {};
    setDecisionLetterSent(sent);
  }, [applicationId, caseData?.caseContext, caseId]);
  useEffect(() => {
    const saved = getDecisionLetterPackDrafts(caseData?.caseContext, applicationId);
    setSavedApprovalLetterPackDrafts(saved || null);
  }, [applicationId, caseData?.caseContext]);
  useEffect(() => {
    const assessmentContext = getApplicationAssessmentContext(caseData?.caseContext, applicationId);
    const persistedReasonCode = assessmentContext?.[FUNDING_DECISION_REASON_CODE_KEY];
    setDenialReasonChoice(typeof persistedReasonCode === 'string' ? persistedReasonCode.trim() : '');
    const persistedReasonExplanation = assessmentContext?.[FUNDING_DECISION_REASON_EXPLANATION_KEY];
    setDenialReasonExplanation(
      typeof persistedReasonExplanation === 'string' ? persistedReasonExplanation.trim() : ''
    );
  }, [applicationId, caseData?.caseContext]);
  const applicantName = useMemo(() => {
    const ctx = resolveCaseContext(caseData);
    const personal = ctx.applicationPersonal || {};
    const answers = ctx.applicationAnswers || {};
    const candidates = [
      caseData?.applicant_name,
      caseData?.applicantName,
      ctx.preferredName,
      ctx.preferred_name,
      answers['preferred-name'],
      answers['preferred_name'],
      personal.preferred_name,
      personal.preferredName,
      personal.first_name && personal.last_name ? `${personal.first_name} ${personal.last_name}` : null,
      personal.firstName && personal.lastName ? `${personal.firstName} ${personal.lastName}` : null
    ];
    return candidates.map(v => (typeof v === 'string' ? v.trim() : v)).find(Boolean) || '';
  }, [caseData]);
  const applicantSalutationName = useMemo(() => {
    const ctx = resolveCaseContext(caseData);
    const personal = ctx.applicationPersonal || {};
    const answers = ctx.applicationAnswers || {};
    const normalize = value => {
      if (value === null || typeof value === 'undefined') return '';
      return String(value).trim();
    };
    const firstToken = value => {
      const normalized = normalize(value);
      if (!normalized) return '';
      return normalized.split(/\s+/)[0] || '';
    };
    const preferredCandidates = [
      caseData?.preferred_name,
      caseData?.preferredName,
      ctx.preferredName,
      ctx.preferred_name,
      answers['preferred-name'],
      answers.preferred_name,
      personal.preferred_name,
      personal.preferredName
    ];
    const preferred = preferredCandidates.map(normalize).find(Boolean);
    if (preferred) return preferred;
    const firstNameCandidates = [
      caseData?.submission_first_name,
      caseData?.submissionFirstName,
      caseData?.first_name,
      caseData?.firstName,
      ctx.first_name,
      ctx.firstName,
      personal.first_name,
      personal.firstName,
      answers['first-name'],
      answers.first_name,
      answers['personal-first-name'],
      answers.personal_first_name
    ];
    const firstName = firstNameCandidates.map(normalize).find(Boolean);
    if (firstName) return firstName;
    return firstToken(applicantName);
  }, [applicantName, caseData]);
  const participantLegalName = useMemo(() => {
    const ctx = resolveCaseContext(caseData);
    const personal = ctx.applicationPersonal || {};
    const answers = ctx.applicationAnswers || {};
    const client = caseData?.client && typeof caseData.client === 'object' ? caseData.client : {};
    const clientDetails = client.details && typeof client.details === 'object' ? client.details : {};
    const normalizeNamePart = value => {
      if (value === null || typeof value === 'undefined') return '';
      const trimmed = String(value).trim();
      return trimmed || '';
    };
    const buildFullName = (first, last) => {
      const firstName = normalizeNamePart(first);
      const lastName = normalizeNamePart(last);
      if (!firstName || !lastName) return '';
      return `${firstName} ${lastName}`;
    };
    const normalizeFullName = value => {
      const text = normalizeNamePart(value);
      if (!text) return '';
      return text.includes(' ') ? text : '';
    };
    const candidates = [
      normalizeFullName(caseData?.applicant_legal_name || caseData?.applicantLegalName),
      buildFullName(
        caseData?.submission_first_name || caseData?.submissionFirstName || caseData?.first_name || caseData?.firstName,
        caseData?.submission_last_name || caseData?.submissionLastName || caseData?.last_name || caseData?.lastName
      ),
      buildFullName(client.firstName, client.lastName),
      buildFullName(
        clientDetails.first_name || clientDetails.firstName || clientDetails.given_name || clientDetails.givenName,
        clientDetails.last_name || clientDetails.lastName || clientDetails.family_name || clientDetails.familyName
      ),
      buildFullName(
        ctx.first_name || ctx.firstName || ctx.given_name || ctx.givenName,
        ctx.last_name || ctx.lastName || ctx.family_name || ctx.familyName
      ),
      buildFullName(
        personal.first_name || personal.firstName || personal.given_name || personal.givenName,
        personal.last_name || personal.lastName || personal.family_name || personal.familyName
      ),
      buildFullName(
        answers['first-name'] || answers.first_name || answers['personal-first-name'] || answers.personal_first_name,
        answers['last-name'] || answers.last_name || answers['personal-last-name'] || answers.personal_last_name
      ),
      normalizeFullName(
        client.fullName || client.full_name || clientDetails.full_name || clientDetails.fullName || caseData?.applicant_name || caseData?.applicantName
      ),
    ];
    return candidates.find(Boolean) || '';
  }, [caseData]);
  useEffect(() => {
    if (!participantLegalName) return;
    setCostLineModal(prev => {
      if (!prev?.visible || !prev?.draft) return prev;
      const payee = prev.draft.payee && typeof prev.draft.payee === 'object' ? prev.draft.payee : {};
      if (String(payee.type || '').trim() !== PAYEE_TYPE_PARTICIPANT_CLIENT) return prev;
      if (String(payee.name || '').trim() === participantLegalName) return prev;
      return {
        ...prev,
        draft: {
          ...prev.draft,
          payee: {
            ...payee,
            name: participantLegalName,
          },
        },
      };
    });
  }, [participantLegalName]);
  const trackingReference = useMemo(() => {
    const candidates = [
      caseData?.tracking_id,
      caseData?.trackingId,
      caseData?.submission_reference,
      caseData?.reference_number,
      caseData?.case_number
    ];
    return candidates.map(v => (typeof v === 'string' ? v.trim() : v)).find(Boolean) || '';
  }, [caseData]);
  const existingClientInfo = useMemo(() => {
    if (!caseData?.existing_client_has_prior_case) return null;
    const priorCaseId = caseData?.existing_client_prior_case_id ?? null;
    const priorCaseNumber = caseData?.existing_client_prior_case_number ?? null;
    const priorCaseStatus = caseData?.existing_client_prior_case_status ?? null;
    const priorCaseOwnerName = caseData?.existing_client_prior_case_owner_name ?? null;
    const priorCaseOwnerEmail = caseData?.existing_client_prior_case_owner_email ?? null;
    const managerLabel = (() => {
      if (priorCaseOwnerName && priorCaseOwnerEmail && priorCaseOwnerName !== priorCaseOwnerEmail) {
        return `${priorCaseOwnerName} (${priorCaseOwnerEmail})`;
      }
      return priorCaseOwnerName || priorCaseOwnerEmail || null;
    })();
    const caseLabel = priorCaseNumber
      ? `Case ${priorCaseNumber}`
      : priorCaseId
        ? `Case ${priorCaseId}`
        : 'Existing case';
    const statusLabel = formatCaseStatusLabel(priorCaseStatus);
    return {
      caseLabel,
      statusLabel,
      managerLabel
    };
  }, [caseData]);
  const wizardStepKey = useMemo(() => {
    const baseId = caseData?.id ?? applicationId ?? application_id ?? null;
    if (!baseId) return null;
    const baseKey = `assessment:${baseId}`;
    if (!approvalWorkspaceEntry?.key) return baseKey;
    return `${baseKey}:approval:${approvalWorkspaceEntry.key}`;
  }, [caseData?.id, applicationId, application_id, approvalWorkspaceEntry?.key]);

  const isDecisionFinal = APPLICATION_FINAL_STATUSES.has(normalizedApplicationStatus);
  const isLockedStatus = APPLICATION_LOCKED_STATUSES.has(normalizedApplicationStatus);
  const showOutcomeByStatus = isPendingApprovalStatus || isReviewWithNwac;
  const isOutcomeNoticeDisabled = isDecisionFinal;
  const canManageOutcomeReview =
    canCompleteOutcomeReview({ role: userRole, status: rawApplicationStatus }) ||
    (
      isReviewWithNwac &&
      canCompleteOutcomeReview({ role: userRole, status: 'pending_approval' })
    );
  const canNwacReview =
    canManageOutcomeReview &&
    (
      !twoStepReviewEnabled ||
      !hasReviewWorkflow ||
      isReviewWithNwac
    );
  const interventionCodeLookup = useMemo(() => {
    const map = new Map();
    interventionCodes.forEach(option => {
      if (!option?.value) return;
      map.set(String(option.value), option);
    });
    return map;
  }, [interventionCodes]);
  const resolveInterventionLabel = useCallback(
    (code) => {
      if (!code) return '';
      const normalized = String(code);
      const match = interventionCodeLookup.get(normalized);
      if (match?.label) return match.label.replace(/^\s*\d+\s*–\s*/, '');
      return normalized;
    },
    [interventionCodeLookup]
  );
  const paymentTypeMappingLookup = useMemo(
    () => buildPaymentTypeMappingLookup(paymentTypeMapping),
    [paymentTypeMapping]
  );
  const configuredPaymentTypeOptions = useMemo(() => {
    const list = Array.isArray(paymentTypeMapping?.paymentTypes) ? paymentTypeMapping.paymentTypes : [];
    return list
      .map(entry => {
        const code = normalizePaymentTypeCode(entry?.code);
        if (!code) return null;
        return {
          value: code,
          label: entry?.label || code
        };
      })
      .filter(Boolean);
  }, [paymentTypeMapping]);
  const configuredPayeeTypeOptions = useMemo(() => {
    const list = Array.isArray(paymentTypeMapping?.payeeTypes) ? paymentTypeMapping.payeeTypes : [];
    return list
      .map(entry => {
        const code = typeof entry?.code === 'string' ? entry.code.trim() : '';
        if (!code) return null;
        return {
          value: code,
          label: entry?.label || code,
          description: entry?.description || undefined
        };
      })
      .filter(Boolean);
  }, [paymentTypeMapping]);
  const paymentTypeLabelLookup = useMemo(() => {
    const map = new Map();
    configuredPaymentTypeOptions.forEach(option => {
      if (!option?.value) return;
      map.set(String(option.value), option.label || option.value);
    });
    return map;
  }, [configuredPaymentTypeOptions]);
  const applicationAnswers = useMemo(() => {
    const context = caseData?.caseContext || {};
    const candidates = [
      context.applicationAnswers,
      context.applicationPayload?.answers,
      caseData?.application?.intake_payload?.answers,
      caseData?.application?.intakePayload?.answers,
      caseData?.application?.payload?.answers,
      caseData?.applicationVersion?.intake_payload?.answers,
      caseData?.applicationVersion?.payload_json?.answers,
      caseData?.applicationVersion?.payload?.answers
    ];
    return candidates.find(candidate => candidate && typeof candidate === 'object') || {};
  }, [caseData]);
  const normalizeAnswerArray = useCallback((value) => {
    if (value === null || typeof value === 'undefined') return [];
    if (Array.isArray(value)) {
      return value.map(item => String(item || '').trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(item => String(item || '').trim()).filter(Boolean);
        }
      } catch (_) {}
      return trimmed.split(',').map(item => item.trim()).filter(Boolean);
    }
    if (typeof value === 'object') {
      return Object.values(value).map(item => String(item || '').trim()).filter(Boolean);
    }
    return [];
  }, []);
  const readApplicationAnswer = useCallback(
    (keys) => {
      const source = applicationAnswers || {};
      for (const key of keys) {
        if (!key) continue;
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          return source[key];
        }
      }
      return null;
    },
    [applicationAnswers]
  );
  const requestedSupportTypes = useMemo(
    () =>
      normalizeAnswerArray(
        readApplicationAnswer([
          'financial_support_types',
          'financial-support-types',
          'financial_support_type',
          'financial-support-type'
        ])
      ),
    [normalizeAnswerArray, readApplicationAnswer]
  );
  const otherFundingForLetters = useMemo(
    () =>
      normalizeOtherFundingDetails({
        involved: assessment.otherFundingInvolved,
        sources: assessment.otherFundingSources,
        nwacCoverage: assessment.otherFundingNwacCoverage,
        notes: assessment.otherFundingNotes
      }),
    [
      assessment.otherFundingInvolved,
      assessment.otherFundingNwacCoverage,
      assessment.otherFundingNotes,
      assessment.otherFundingSources
    ]
  );
  const institutionApprovalLetters = useMemo(
    () =>
      buildInstitutionApprovalLetters({
        interventions: proposedInterventions,
        interventionTotals,
        applicantName: participantLegalName || applicantName,
        trackingReference,
        decisionDate: formatDate(new Date()),
        caseManagerName: currentUserName || '',
        caseManagerEmail: currentUserEmail || '',
        caseManagerPhone: ''
      }),
    [
      applicantName,
      participantLegalName,
      currentUserEmail,
      currentUserName,
      interventionTotals,
      proposedInterventions,
      trackingReference
    ]
  );
  const coFunderApprovalLetters = useMemo(
    () =>
      buildCoFunderApprovalLetters({
        fundingSources: otherFundingForLetters.sources,
        nwacCoverage: otherFundingForLetters.nwacCoverage,
        notes: otherFundingForLetters.notes,
        interventions: proposedInterventions,
        interventionTotals,
        applicantName: participantLegalName || applicantName,
        trackingReference,
        decisionDate: formatDate(new Date()),
        caseManagerName: currentUserName || '',
        caseManagerEmail: currentUserEmail || '',
        caseManagerPhone: ''
      }),
    [
      applicantName,
      participantLegalName,
      currentUserEmail,
      currentUserName,
      interventionTotals,
      otherFundingForLetters.notes,
      otherFundingForLetters.nwacCoverage,
      otherFundingForLetters.sources,
      proposedInterventions,
      trackingReference
    ]
  );
  const loanProviderApprovalLetters = useMemo(
    () =>
      buildLoanProviderApprovalLetters({
        interventions: proposedInterventions,
        applicantName: participantLegalName || applicantName,
        trackingReference,
        decisionDate: formatDate(new Date()),
        caseManagerName: currentUserName || '',
        caseManagerEmail: currentUserEmail || '',
        caseManagerPhone: ''
      }),
    [
      applicantName,
      participantLegalName,
      currentUserEmail,
      currentUserName,
      proposedInterventions,
      trackingReference
    ]
  );
  const downloadLetterAsText = useCallback((fileName, body) => {
    if (!body || typeof window === 'undefined' || typeof document === 'undefined') return;
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || `approval-letter-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, []);
  const hasLivingAllowanceRequest = useMemo(
    () => requestedSupportTypes.includes('living_allowance'),
    [requestedSupportTypes]
  );
  const hasChildcareRequest = useMemo(() => {
    const raw = readApplicationAnswer(['childcare_requested', 'childcare-requested']);
    if (raw === null || typeof raw === 'undefined') return false;
    const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : raw === true ? 'yes' : String(raw);
    return ['yes', 'true', '1'].includes(normalized);
  }, [readApplicationAnswer]);
  // Costing should follow the wizard's "Childcare Need" answer first.
  const includeChildcareCostItems = useMemo(() => {
    const childcareNeed = String(assessment.childcareNeed || '').trim().toLowerCase();
    if (childcareNeed === 'yes') return true;
    if (childcareNeed === 'no') return false;
    // Fallback for older assessments where childcare need is not set yet.
    return hasChildcareRequest;
  }, [assessment.childcareNeed, hasChildcareRequest]);
  const effectiveCostingDefaults = useMemo(() => {
    if (costingDefaults && costingDefaults.enabled !== false) return costingDefaults;
    return { enabled: false, strategy: 'allowed', interventions: [], paymentTypes: [] };
  }, [costingDefaults]);
  const recurrenceModeByType = useMemo(() => {
    const map = new Map();
    if (effectiveCostingDefaults && Array.isArray(effectiveCostingDefaults.paymentTypes)) {
      effectiveCostingDefaults.paymentTypes.forEach(entry => {
        const code = normalizePaymentTypeCode(entry?.code);
        if (!code) return;
        const mode = entry?.recurrence?.mode ? String(entry.recurrence.mode).trim() : 'not_allowed';
        map.set(code, mode || 'not_allowed');
      });
    }
    return map;
  }, [effectiveCostingDefaults]);
  const getRecurrenceModeForType = useCallback(
    (type) => {
      if (!type) return 'not_allowed';
      const normalized = normalizePaymentTypeCode(type);
      return recurrenceModeByType.get(normalized) || 'not_allowed';
    },
    [recurrenceModeByType]
  );
  const submissionTimingByType = useMemo(() => {
    const map = new Map();
    const paymentTypes = Array.isArray(paymentTypeMapping?.paymentTypes)
      ? paymentTypeMapping.paymentTypes
      : [];
    paymentTypes.forEach(entry => {
      const code = normalizePaymentTypeCode(entry?.code || entry?.paymentType || entry?.payment_type);
      if (!code) return;
      const timing =
        normalizeSubmissionTiming(entry?.submissionTiming || entry?.submission_timing) ||
        DEFAULT_SUBMISSION_TIMING_BY_TYPE[code] ||
        SUBMISSION_TIMING_MANUAL_TRIGGER;
      map.set(code, timing);
    });
    Object.entries(DEFAULT_SUBMISSION_TIMING_BY_TYPE).forEach(([code, timing]) => {
      if (!map.has(code)) map.set(code, timing);
    });
    return map;
  }, [paymentTypeMapping]);
  const getSubmissionTimingForType = useCallback(
    (type) => {
      const code = normalizePaymentTypeCode(type);
      if (!code) return SUBMISSION_TIMING_MANUAL_TRIGGER;
      return (
        submissionTimingByType.get(code) ||
        DEFAULT_SUBMISSION_TIMING_BY_TYPE[code] ||
        SUBMISSION_TIMING_MANUAL_TRIGGER
      );
    },
    [submissionTimingByType]
  );
  const getCostLineDetailsText = useCallback(
    (line, intervention = null) => {
      const mode = getRecurrenceModeForType(line?.type);
      const required = mode === 'required';
      const enabled = Boolean(line?.recurrence?.enabled);
      const recurrenceEnabled = enabled || required;
      const recurrence = line?.recurrence || {};
      let occurrences = null;
      if (recurrenceEnabled) {
        const occurrencesRaw =
          recurrence.occurrences === '' || recurrence.occurrences === null || typeof recurrence.occurrences === 'undefined'
            ? null
            : Number(recurrence.occurrences);
        occurrences = Number.isFinite(occurrencesRaw) && occurrencesRaw > 0 ? occurrencesRaw : null;
        if (!occurrences) {
          const startDate = formatDate(recurrence.startDate);
          const endDate = formatDate(recurrence.endDate);
          if (startDate && endDate) {
            const computed = autoOccurrencesFromDates(startDate, endDate, 'monthly');
            if (computed) occurrences = computed;
          }
        }
      }
      const amountPerPeriod = parseCurrencyInput(recurrence.amountPerPeriod);
      const perPeriodText =
        recurrenceEnabled && amountPerPeriod !== null
          ? `${formatCurrencyDisplay(amountPerPeriod)} per month`
          : '';
      const submissionTiming = getSubmissionTimingForType(line?.type);
      const interventionStart = formatDate(intervention?.startDate);
      const interventionEnd = formatDate(intervention?.endDate);
      const recurrenceStart = formatDate(recurrence.startDate);
      const recurrenceEnd = formatDate(recurrence.endDate);
      const explicitPayableDate = formatDate(
        line?.payableDate ||
          line?.payable_date ||
          line?.paymentDate ||
          line?.payment_date ||
          line?.dateDue ||
          line?.date_due
      );
      const firstInstallmentDate =
        recurrenceStart ||
        explicitPayableDate ||
        (submissionTiming === SUBMISSION_TIMING_INTERVENTION_END
          ? interventionEnd || recurrenceEnd
          : interventionStart || recurrenceEnd);
      const firstInstallmentDateLabel = firstInstallmentDate
        ? formatShortDate(firstInstallmentDate)
        : '';
      let payableText = 'payable';
      if (recurrenceEnabled) {
        if (occurrences && occurrences > 0) {
          payableText = `payable in ${occurrences} monthly installment${occurrences === 1 ? '' : 's'}`;
        } else {
          payableText = 'payable in monthly installments';
        }
        if (firstInstallmentDateLabel) {
          payableText += ` starting ${firstInstallmentDateLabel}`;
        }
      } else {
        let payableDate = '';
        if (submissionTiming === SUBMISSION_TIMING_INTERVENTION_START) {
          payableDate = formatShortDate(interventionStart || recurrenceStart || explicitPayableDate);
        } else if (submissionTiming === SUBMISSION_TIMING_INTERVENTION_END) {
          payableDate = formatShortDate(interventionEnd || recurrenceEnd || explicitPayableDate);
        } else if (submissionTiming === SUBMISSION_TIMING_RECURRENCE_SCHEDULE) {
          payableDate = formatShortDate(
            recurrenceStart || explicitPayableDate || interventionStart || interventionEnd
          );
        } else if (submissionTiming === SUBMISSION_TIMING_MANUAL_TRIGGER) {
          payableDate = formatShortDate(explicitPayableDate);
        }
        payableText = payableDate ? `payable on ${payableDate}` : 'payable';
      }
      const payeeName = String(line?.payee?.name || '').trim();
      const explicitPayeeTypeKey = normalizePayeeTypeKey(line?.payee?.type);
      const inferredPayeeTypeKey = normalizePayeeTypeKey(deriveDefaultPayeeTypeForCostLine(line?.type));
      const payeeTypeKey = explicitPayeeTypeKey || inferredPayeeTypeKey;
      const payeeTarget = PAYEE_TYPE_DETAIL_TARGET_BY_KEY[payeeTypeKey] || '';
      const payeeText = payeeName ? `to ${payeeName}` : payeeTarget ? `to ${payeeTarget}` : '';
      const notesText = String(line?.notes || '').trim();
      let text = payableText || '—';
      if (perPeriodText) {
        text = `${text} (${perPeriodText})`;
      }
      if (payeeText) {
        text = `${text} ${payeeText}`;
      }
      return {
        text,
        notesText
      };
    },
    [getRecurrenceModeForType, getSubmissionTimingForType]
  );
  const getAllowedPaymentTypesForIntervention = useCallback(
    (code) => {
      const normalized = normalizeInterventionCodeValue(code);
      if (!normalized) return [];
      const allowed = paymentTypeMappingLookup.get(normalized);
      if (!allowed) return [];
      return Array.from(allowed);
    },
    [paymentTypeMappingLookup]
  );
  const buildCostItemOptions = useCallback(
    (intervention) => {
      const allowed = new Set(getAllowedPaymentTypesForIntervention(intervention?.code));
      return configuredPaymentTypeOptions.filter(option => {
        if (!option?.value) return false;
        if (allowed.size && !allowed.has(option.value)) return false;
        if (!includeChildcareCostItems && option.value === 'Childcare') return false;
        return true;
      });
    },
    [configuredPaymentTypeOptions, getAllowedPaymentTypesForIntervention, includeChildcareCostItems]
  );
  const buildRecurrenceFromIntervention = useCallback(
    (intervention, enabled) => {
      if (!enabled) {
        return {
          enabled: false,
          startDate: '',
          endDate: '',
          occurrences: '',
          amountPerPeriod: ''
        };
      }
      const startDate = intervention?.startDate || '';
      const endDate = intervention?.endDate || '';
      const occurrences = startDate && endDate ? autoOccurrencesFromDates(startDate, endDate, 'monthly') : null;
      return {
        enabled: true,
        startDate,
        endDate,
        occurrences: occurrences ? String(occurrences) : '',
        amountPerPeriod: ''
      };
    },
    []
  );
  const buildSuggestedCostLines = useCallback(
    (intervention) => {
      if (!effectiveCostingDefaults.enabled) return [];
      const code = normalizeInterventionCodeValue(intervention?.code);
      if (!code) return [];
      const allowed = new Set(getAllowedPaymentTypesForIntervention(code));
      const defaultsEntry = Array.isArray(effectiveCostingDefaults.interventions)
        ? effectiveCostingDefaults.interventions.find(entry => entry.code === code)
        : null;
      const hasExplicitDefaults = Boolean(defaultsEntry);
      let suggested = defaultsEntry?.suggested || [];
      if (!suggested.length && effectiveCostingDefaults.strategy === 'allowed' && !hasExplicitDefaults) {
        if (!allowed.size) return null;
        suggested = Array.from(allowed).map(type => ({ type }));
      }
      if (!Array.isArray(suggested) || !suggested.length) return [];
      const seen = new Set();
      return suggested
        .map(item => {
          const type = item?.type ? String(item.type).trim() : '';
          if (!type) return null;
          if (allowed.size && !allowed.has(type)) return null;
          if (!hasLivingAllowanceRequest && type === 'LivingAllowance') return null;
          if (!includeChildcareCostItems && type === 'Childcare') return null;
          if (seen.has(type)) return null;
          seen.add(type);
          const recurrenceMode = getRecurrenceModeForType(type);
          const recurrenceEnabled =
            typeof item?.recurrenceEnabled === 'boolean'
              ? item.recurrenceEnabled
              : recurrenceMode === 'required';
          const recurrence = buildRecurrenceFromIntervention(intervention, recurrenceEnabled);
          return buildEmptyCostLine({
            type,
            notes: item?.notes || '',
            recurrence
          });
        })
        .filter(Boolean);
    },
    [
      buildRecurrenceFromIntervention,
      effectiveCostingDefaults,
      getAllowedPaymentTypesForIntervention,
      getRecurrenceModeForType,
      includeChildcareCostItems,
      hasLivingAllowanceRequest
    ]
  );
  const normalizedDraftConflictChoice = useMemo(
    () => normalizeConflictDeclarationChoice(conflictDeclarationChoice),
    [conflictDeclarationChoice]
  );
  const normalizedPersistedConflictChoice = useMemo(
    () => normalizeConflictDeclarationChoice(persistedConflictDeclarationChoice),
    [persistedConflictDeclarationChoice]
  );
  const normalizedConflictResolutionOutcome = useMemo(
    () => normalizeConflictResolutionOutcome(conflictDeclarationResolutionOutcome),
    [conflictDeclarationResolutionOutcome]
  );
  const hasDraftDeclaredConflict = normalizedDraftConflictChoice === 'conflict';
  const hasPersistedDeclaredConflict =
    normalizedPersistedConflictChoice === 'conflict' &&
    normalizedConflictResolutionOutcome !== 'cleared';
  const isDeclarationGateActive = !isNwacAdministrator && (!conflictDeclarationSigned || hasPersistedDeclaredConflict);
  const eligibilitySet = Boolean(assessment.esdcEligibility);
  const isEligibilityGateActive = isDeclarationGateActive || !eligibilitySet;
  const showCommunicationStep = isPostDecisionStatus;
  const approvalLetterSentAt = decisionLetterSent?.approval || null;
  const approvalLetterSent = Boolean(approvalLetterSentAt);
  const showFundingDocsStep = decisionOutcome === 'approved' && (approvalLetterSent || isCompletedStatus);
  const activeStepIds = useMemo(() => {
    if (!showNWACSection) return BASE_STEP_IDS;
    const afterSubmit = [...BASE_STEP_IDS, ...SUBMITTED_STEP_IDS];
    if (!showCommunicationStep) return afterSubmit;
    const steps = [...afterSubmit, ...COMMUNICATION_STEP_IDS];
    return showFundingDocsStep ? [...steps, ...FUNDING_DOCS_STEP_IDS] : steps;
  }, [showNWACSection, showCommunicationStep, showFundingDocsStep]);
  const declarationContinueStep = useMemo(() => {
    if (approvalRequestedStep && activeStepIds.includes(approvalRequestedStep)) {
      return approvalRequestedStep;
    }
    return BASE_STEP_IDS[0];
  }, [activeStepIds, approvalRequestedStep]);
  useEffect(() => {
    if (!pendingDecisionJump) return;
    if (!activeStepIds.includes('decision')) return;
    setCurrentStep('decision');
    setPendingDecisionJump(false);
  }, [pendingDecisionJump, activeStepIds]);
  const navigateToAssessmentWizardStep = useCallback(
    (stepId) => {
      if (!stepId || !activeStepIds.includes(stepId)) return;
      if (approvalWorkspaceEntry?.mode === 'approval' && typeof history?.replace === 'function') {
        const currentLocation =
          history.location ||
          (typeof window !== 'undefined' ? window.location : null);
        const params = new URLSearchParams(currentLocation?.search || '');
        params.set('entry', 'approval');
        params.set('approvalType', 'application');
        params.set('step', stepId);
        history.replace({
          pathname: currentLocation?.pathname || '',
          search: `?${params.toString()}`,
          hash: currentLocation?.hash || ''
        });
      }
      setCurrentStep(stepId);
      if (wizardStepKey) {
        assessmentWizardStepStore.set(String(wizardStepKey), stepId);
      }
    },
    [activeStepIds, approvalWorkspaceEntry?.mode, history, wizardStepKey]
  );
  const docsChecklistReady = Boolean(applicantUserId && applicationId);
  const docsChecklistComplete = Boolean(
    docsChecklistReady &&
      documentChecklistMissingCount === 0 &&
      !documentChecklistLoading &&
      !documentChecklistError
  );
  const dispatchSupportingDocsRefresh = useCallback(() => {
    if (typeof actions?.refreshChecklist === 'function') {
      actions.refreshChecklist().catch(() => {});
    }
    if (typeof window !== 'undefined') {
      try {
        const detail = applicantUserId ? { applicantUserId } : undefined;
        window.dispatchEvent(new CustomEvent(SUPPORTING_DOCS_REFRESH_EVENT, { detail }));
      } catch (_) {
        // ignore dispatch errors
      }
    }
  }, [actions, applicantUserId]);
  const dispatchCaseNotesRefresh = useCallback(() => {
    if (!caseId || typeof window === 'undefined') return;
    try {
      const detail = { caseId };
      window.dispatchEvent(new CustomEvent(CASE_NOTES_REFRESH_EVENT, { detail }));
      window.dispatchEvent(new CustomEvent(CASE_EVENTS_REFRESH_EVENT, { detail }));
    } catch (_) {
      // ignore dispatch errors
    }
  }, [caseId]);
  const closeSubmitDocumentConflictModal = useCallback(() => {
    setSubmitDocumentConflictModalVisible(false);
    setSubmitDocumentConflicts([]);
    setSubmitDocumentRetention({});
  }, []);
  const inspectAssessmentSubmitDocumentConflicts = useCallback(async () => {
    const loadDocuments = async (endpoint) => {
      const res = await apiFetch(endpoint);
      if (!res.ok) {
        throw new Error('Failed to inspect existing supporting documents.');
      }
      const payload = await res.json().catch(() => []);
      return Array.isArray(payload) ? payload : [];
    };

    let documents = [];
    let loaded = false;
    let lastError = null;

    if (applicantUserId) {
      try {
        const params = new URLSearchParams();
        if (applicationId) {
          params.set('applicationId', String(applicationId));
        } else if (caseId) {
          params.set('caseId', String(caseId));
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        documents = await loadDocuments(`/api/applicants/${applicantUserId}/documents${query}`);
        loaded = true;
      } catch (err) {
        lastError = err;
      }
    }

    if (!loaded && caseId) {
      try {
        documents = await loadDocuments(`/api/cases/${caseId}/documents`);
        loaded = true;
      } catch (err) {
        lastError = err;
      }
    }

    if (!loaded) {
      if (lastError) throw lastError;
      return [];
    }

    const filteredDocuments = documents.filter(row => {
      const documentType = resolveDocumentType(row);
      if (!Object.prototype.hasOwnProperty.call(SUBMIT_PDF_CONFLICT_DOCUMENT_LABELS, documentType)) {
        return false;
      }
      const source = String(row?.source || '').trim().toLowerCase();
      if (source === 'system_generated') return false;
      if (applicationId) {
        const rowApplicationId = Number(row?.application_id || row?.applicationId || 0);
        return rowApplicationId === Number(applicationId);
      }
      const rowCaseId = Number(row?.case_id || row?.caseId || 0);
      return caseId ? rowCaseId === Number(caseId) || !rowCaseId : true;
    });

    const grouped = new Map();
    filteredDocuments.forEach(row => {
      const documentType = resolveDocumentType(row);
      if (!documentType) return;
      const existing = grouped.get(documentType) || {
        documentType,
        title: SUBMIT_PDF_CONFLICT_DOCUMENT_LABELS[documentType] || documentType,
        documents: []
      };
      existing.documents.push({
        id: row?.id || null,
        label: row?.label || null,
        fileName: row?.file_name || row?.fileName || null,
        uploadedAt: row?.uploaded_at || row?.uploadedAt || null
      });
      grouped.set(documentType, existing);
    });

    return Array.from(grouped.values()).map(entry => ({
      ...entry,
      documents: [...entry.documents].sort((left, right) => {
        const leftTime = new Date(left?.uploadedAt || 0).getTime();
        const rightTime = new Date(right?.uploadedAt || 0).getTime();
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      }),
      count: entry.documents.length,
      summary: summarizeSubmitConflictDocuments(entry.documents)
    }));
  }, [applicantUserId, applicationId, caseId]);
  const handleSubmitDocumentConflictDismiss = useCallback(() => {
    pendingAssessmentSubmitRef.current = null;
    closeSubmitDocumentConflictModal();
  }, [closeSubmitDocumentConflictModal]);
  const handleSubmitDocumentConflictConfirm = useCallback(async () => {
    const submitFn = pendingAssessmentSubmitRef.current;
    pendingAssessmentSubmitRef.current = null;
    const preserveExistingApplicationForm = Boolean(submitDocumentRetention.application_form);
    const preserveExistingFinancialOverview = Boolean(submitDocumentRetention.financial_overview);
    closeSubmitDocumentConflictModal();
    if (typeof submitFn === 'function') {
      await submitFn({
        preserveExistingApplicationForm,
        preserveExistingFinancialOverview
      });
    }
  }, [closeSubmitDocumentConflictModal, submitDocumentRetention]);
  const openAssessmentWidget = useCallback((widgetId) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('applicationAssessment:palette:add', { detail: { id: widgetId } }));
  }, []);
  useEffect(() => {
    if (!showCommunicationStep) return;
    let cancelled = false;
    const loadLetterWorkflows = async () => {
      setLetterWorkflowsLoading(true);
      setLetterWorkflowsError(null);
      try {
        const resp = await apiFetch('/api/workflows');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json().catch(() => []);
        const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        const filtered = rows
          .map(r => ({
            id: r.id,
            workflowType: (r.workflow_type || r.workflowType || '').trim(),
            documentType: (r.document_type || r.documentType || '').trim()
          }))
          .filter(r => r.workflowType === 'consent-no-prefill' || r.workflowType === 'consent-cm-prefill');
        const approval = filtered.find(r => r.documentType === 'assessment_approval_letter');
        const denial = filtered.find(r => r.documentType === 'assessment_denial_letter');
        if (!cancelled) {
          setLetterWorkflows({
            approval: approval?.id || null,
            denial: denial?.id || null
          });
        }
      } catch (err) {
        if (!cancelled) {
          setLetterWorkflowsError(err?.message || 'Failed to load letter workflows.');
          setLetterWorkflows({ approval: null, denial: null });
        }
      } finally {
        if (!cancelled) setLetterWorkflowsLoading(false);
      }
    };
    loadLetterWorkflows();
    return () => { cancelled = true; };
  }, [showCommunicationStep]);
  useEffect(() => {
    setShowConflictAlert(true);
  }, [conflictDeclarationSigned, hasPersistedDeclaredConflict]);
  const selectedBudgetPotOption = useMemo(() => {
    const match = budgetPotOptions.find(
      option => String(option.value) === String(assessment.interventionPotId)
    );
    if (match) return match;
    if (assessment.interventionPotId) {
      const labelParts = [];
      if (caseData?.assessment_intervention_pot_code) labelParts.push(caseData.assessment_intervention_pot_code);
      if (caseData?.assessment_intervention_pot_name) labelParts.push(caseData.assessment_intervention_pot_name);
      const fallbackLabel = labelParts.length ? labelParts.join(' - ') : assessment.interventionPotId;
      return { value: assessment.interventionPotId, label: fallbackLabel };
    }
    return null;
  }, [budgetPotOptions, assessment.interventionPotId, caseData]);


  const participantProvince = useMemo(() => {
    const context = caseData?.caseContext || {};
    const clientRegion = caseData?.client?.regionDetails?.code || caseData?.client?.region?.code || null;

    // Immutable submission payload (when no edits made)
    const submissionAnswers =
      context?.applicationAnswers?.['address-province'] ||
      context?.applicationPayload?.answers?.['address-province'] ||
      context?.applicationPayload?.answers?.['province'] ||
      caseData?.submission_address_province ||
      caseData?.submissionAddressProvince ||
      null;

    // Mutable application payloads (edits)
    const application = caseData?.application || {};
    const applicationPayload = application?.intake_payload || application?.intakePayload || application?.payload || {};
    const applicationAnswers =
      applicationPayload?.answers?.['address-province'] ||
      applicationPayload?.answers?.['province'] ||
      application?.address_province ||
      application?.application_address_province ||
      application?.applicationProvince ||
      application?.application_province ||
      caseData?.application_address_province ||
      caseData?.application_province_fallback ||
      application?.province ||
      null;
    const applicationVersion = caseData?.applicationVersion || {};
    const applicationVersionPayload = applicationVersion?.intake_payload || applicationVersion?.payload_json || {};
    const applicationVersionAnswers =
      applicationVersionPayload?.answers?.['address-province'] ||
      applicationVersionPayload?.answers?.['province'] ||
      null;

    // Direct case-level projections (if API surfaces them)
    const caseLevelProvince =
      caseData?.address_province ||
      caseData?.addressProvince ||
      caseData?.application_address_province ||
      null;

    return (
      applicationAnswers ||
      applicationVersionAnswers ||
      caseLevelProvince ||
      context.addressProvince ||
      context.address?.province ||
      clientRegion ||
      submissionAnswers ||
      ''
    );
  }, [caseData]);
  const normalizedProvince = participantProvince ? String(participantProvince).trim().toUpperCase() : '';
  const deriveFundingStreamFromEligibility = useCallback((eligibility) => {
    const normalized = (eligibility || '').toString().toLowerCase();
    if (normalized.includes('ei')) return 'EI';
    if (normalized.includes('crf')) return 'CRF';
    return '';
  }, []);

  const interventionPotRef = useRef('');
  useEffect(() => {
    interventionPotRef.current = assessment.interventionPotId;
  }, [assessment.interventionPotId]);

  useEffect(() => {
    if (!isAssessor) return;
    if (!assessment.interventionPotId) return;
    if (assessment.postingContext !== 'external') {
      setAssessment(prev => ({ ...prev, postingContext: 'external' }));
    }
  }, [isAssessor, assessment.interventionPotId, assessment.postingContext]);

  const serializeCostLine = useCallback((line) => {
    const recurrence = line?.recurrence || {};
    const payee = line?.payee || {};
    const payeeType = typeof payee.type === 'string' ? payee.type.trim() : '';
    const payeeName = typeof payee.name === 'string' ? payee.name.trim() : '';
    const payeeReference = typeof payee.reference === 'string' ? payee.reference.trim() : '';
    const occurrencesValue =
      recurrence.occurrences === '' || recurrence.occurrences === null || typeof recurrence.occurrences === 'undefined'
        ? null
        : Number(recurrence.occurrences);
    const occurrences = Number.isFinite(occurrencesValue) ? occurrencesValue : null;
    return {
      id: line?.id || buildUuid(),
      type: line?.type || null,
      amount: parseCurrencyInput(line?.amount),
      notes: line?.notes || null,
      payee:
        payeeType || payeeName || payeeReference
          ? {
              type: payeeType || null,
              name: payeeName || null,
              reference: payeeReference || null
            }
          : null,
      recurrence: {
        enabled: Boolean(recurrence.enabled),
        startDate: formatDate(recurrence.startDate) || null,
        endDate: formatDate(recurrence.endDate) || null,
        occurrences,
        amountPerPeriod: parseCurrencyInput(recurrence.amountPerPeriod),
      },
    };
  }, []);

  const serializeProposedInterventions = useCallback(
    (interventions) => {
      const list = Array.isArray(interventions) ? interventions.filter(hasInterventionValues) : [];
      if (!list.length) return [];
      return list.map(item => ({
        id: item.id || buildUuid(),
        code: item.code || null,
        startDate: formatDate(item.startDate) || null,
        endDate: formatDate(item.endDate) || null,
        deliveryMode: item.deliveryMode === 'in_house' ? 'in_house' : 'partner',
        institution: item.institution || null,
        programName: item.programName || null,
        itpDetails: item.itpDetails || null,
        wageSubsidyDetails: item.wageSubsidyDetails || null,
        interventionNoc: item.interventionNoc || null,
        interventionNocVersion: item.interventionNocVersion || null,
        suggestionsSeeded: Boolean(item.suggestionsSeeded),
        costLines: Array.isArray(item.costLines) ? item.costLines.map(serializeCostLine) : [],
      }));
    },
    [serializeCostLine]
  );

  const buildAssessmentPayload = useCallback(({ includeDecisionFields = false } = {}) => {
    const proposedInterventionsPayload = serializeProposedInterventions(proposedInterventions);
    const primary = proposedInterventions[0] || null;
    const primaryStartDate = primary?.startDate || '';
    const primaryEndDate = primary?.endDate || '';
    const interventionDuration = clampInterventionDurationDaysForIlmp(
      calculateDurationDays(primaryStartDate, primaryEndDate)
    );
    const hasProposedInterventions = proposedInterventionsPayload.length > 0;
    const overallTotalValue =
      hasProposedInterventions && Number.isFinite(overallCostTotal)
        ? overallCostTotal
        : null;
    const normalizedOtherFunding = normalizeOtherFundingDetails(
      {
        involved: assessment.otherFundingInvolved,
        sources: assessment.otherFundingSources,
        nwacCoverage: assessment.otherFundingNwacCoverage,
        notes: assessment.otherFundingNotes
      }
    );
    const otherFundingSummary = buildOtherFundingSummary(normalizedOtherFunding);
    const payload = {
      applicationId: applicationId || null,
      assessment_date_of_assessment: formatDate(assessment.dateOfAssessment) || null,
      assessment_employment_goals: assessment.employmentGoals || null,
      assessment_previous_iset: assessment.previousISET || null,
      assessment_previous_iset_details: assessment.previousISETDetails || null,
      assessment_employment_barriers: assessment.barriers || null,
      assessment_employment_barriers_other_details: assessment.barriersOther || null,
      assessment_local_area_priorities: assessment.priorities || null,
      assessment_other_funding_details: otherFundingSummary || null,
      assessment_esdc_eligibility: isEligibilityAdmin ? (assessment.esdcEligibility || null) : undefined,
      assessment_intervention_start_date: formatDate(primaryStartDate) || null,
      assessment_intervention_end_date: formatDate(primaryEndDate) || null,
      assessment_institution: primary?.institution || null,
      assessment_program_name: primary?.programName || null,
      assessment_itp: {
        tuition: '',
        books: '',
        materials: '',
        living: '',
        childcare: '',
        otherLabel: '',
        otherAmount: '',
        details: primary?.itpDetails || ''
      },
      assessment_wage: {
        wages: '',
        mercs: '',
        nonwages: '',
        other1Label: '',
        other1Amount: '',
        other2Label: '',
        other2Amount: '',
        subsidyDetails: primary?.wageSubsidyDetails || ''
      },
      assessment_recommendation: assessment.recommendation || null,
      assessment_justification: assessment.justification || null,
      assessment_intervention_code: primary?.code || null,
      assessment_intervention_duration_days: interventionDuration !== null ? String(interventionDuration) : null,
      assessment_intervention_cost_total: overallTotalValue !== null ? overallTotalValue.toFixed(2) : null,
      assessment_intervention_pot_id: assessment.interventionPotId || null,
      postingContext: assessment.postingContext || null,
      assessment_intervention_related_noc: primary?.interventionNoc || null,
      assessment_intervention_related_noc_version: primary?.interventionNocVersion || null,
      assessment_childcare_need: assessment.childcareNeed || null,
      assessment_childcare_funding_details: assessment.childcareFunding || null,
      case_summary: assessment.overview || null,
      assessment_proposed_interventions: proposedInterventionsPayload.length ? proposedInterventionsPayload : null
    };
    if (includeDecisionFields) {
      payload.assessment_nwac_review_status = assessment.nwacReviewStatus || null;
      payload.assessment_nwac_review = assessment.nwacReview || null;
      payload.assessment_nwac_reason = assessment.nwacReason || null;
    }
    const baseContext = caseData?.caseContext && typeof caseData.caseContext === 'object' ? caseData.caseContext : null;
    const existingAssessmentContext = getApplicationAssessmentContext(
      baseContext,
      applicationId,
      { allowLegacyFallback: true }
    );
    const hasExistingOtherFundingContext = Object.prototype.hasOwnProperty.call(
      existingAssessmentContext,
      'assessmentOtherFunding'
    );
    if (hasExistingOtherFundingContext || normalizedOtherFunding.involved || normalizedOtherFunding.sources.length || normalizedOtherFunding.nwacCoverage || normalizedOtherFunding.notes) {
      // Assessment saves must be a content-only context patch. Re-sending the full
      // case context can reshape legacy Decision Maker fields and be classified as
      // an unauthorised decision mutation for a returned submitter.
      payload.caseContext = buildApplicationAssessmentCaseContext(null, applicationId, {
        assessmentOtherFunding: normalizedOtherFunding
      });
    }
    return payload;
  }, [
    applicationId,
    assessment,
    caseData?.caseContext,
    isEligibilityAdmin,
    overallCostTotal,
    proposedInterventions,
    serializeProposedInterventions
  ]);
  const handlePostingContextErrors = useCallback((result) => {
    const code = result?.error || result?.code;
    if (['missing_internal_gl_code', 'missing_external_gl_code', 'posting_context_not_permitted'].includes(code)) {
      const message = result?.message || 'Check Paid from selection.';
      setFieldErrors(prev => ({ ...prev, postingContext: message }));
      setValidationAlert([message]);
      return true;
    }
    return false;
  }, []);
  const selectedChildcareOption = useMemo(
    () => CHILDCARE_OPTIONS.find(option => option.value === assessment.childcareNeed) || null,
    [assessment.childcareNeed]
  );
  const selectedPostingContext = useMemo(
    () => POSTING_OPTIONS.find(opt => opt.value === assessment.postingContext) || null,
    [assessment.postingContext]
  );
  const isCommunicationStep = currentStep === 'communication';
  const isFundingDocsStep = currentStep === FUNDING_DOCS_STEP_ID;
  const requiredDocumentChecklistItems = useMemo(
    () => documentChecklistItems.filter(item => item?.required !== false),
    [documentChecklistItems]
  );
  const fundingDocsChecklistItems = useMemo(
    () => documentChecklistItems,
    [documentChecklistItems]
  );
  const requiredFundingDocsChecklistItems = useMemo(
    () => fundingDocsChecklistItems.filter(item => item?.required !== false),
    [fundingDocsChecklistItems]
  );
  const fundingDocsChecklistInProgressCount = useMemo(
    () => requiredFundingDocsChecklistItems.filter(item => item?.status === 'in_progress').length,
    [requiredFundingDocsChecklistItems]
  );
  const fundingDocsChecklistMissingCount = useMemo(
    () => requiredFundingDocsChecklistItems.filter(item => item?.status !== 'complete').length,
    [requiredFundingDocsChecklistItems]
  );
  const docsRequestedActive = Number(
    caseData?.docs_requested_active ??
    caseData?.docsRequestedActive ??
    0
  ) === 1;
  const fundingFormsRequestSent = docsRequestedActive || fundingDocsChecklistInProgressCount > 0;
  const showFundingDocsChecklist = decisionOutcome === 'approved';
  const fundingDocsChecklistComplete = showFundingDocsChecklist
    ? Boolean(
        docsChecklistReady &&
          fundingDocsChecklistMissingCount === 0 &&
          !documentChecklistLoading &&
          !documentChecklistError
      )
    : true;
  const checklistUploadDocTypeOptions = useMemo(
    () =>
      checklistUploadDocTypes.map(type => ({
        value: type,
        label: formatDocTypeLabel(type) || type
      })),
    [checklistUploadDocTypes]
  );
  const canManageBudgetPotPending = useMemo(() => {
    const allowed = new Set(['system administrator', 'nwac administrator', 'regional manager']);
    return allowed.has(normalizedRole);
  }, [normalizedRole]);
  const showChildcareFunding = assessment.childcareNeed === 'yes';
  useEffect(() => {
    const caseSeedKey = String(caseData?.id || caseData?.case_id || application_id || '');
    if (defaultInterventionSeedCaseKeyRef.current === caseSeedKey) return;
    defaultInterventionSeedCaseKeyRef.current = caseSeedKey;
    defaultInterventionSeedAppliedRef.current = false;
  }, [application_id, caseData?.case_id, caseData?.id]);
  useEffect(() => {
    if (defaultInterventionSeedAppliedRef.current) return;
    if (paymentTypeMappingLoading) return;
    const assessmentCurrent = Array.isArray(assessment.proposedInterventions)
      ? assessment.proposedInterventions
      : [];
    if (assessmentCurrent.length) {
      defaultInterventionSeedAppliedRef.current = true;
      return;
    }
    const seededInterventions = buildDefaultAssessmentInterventionsFromMapping(paymentTypeMapping);
    defaultInterventionSeedAppliedRef.current = true;
    if (!seededInterventions.length) return;
    setAssessment(prev => {
      const current = Array.isArray(prev.proposedInterventions) ? prev.proposedInterventions : [];
      if (current.length) return prev;
      return { ...prev, proposedInterventions: seededInterventions };
    });
    setInitialAssessment(prev => {
      const current = Array.isArray(prev.proposedInterventions) ? prev.proposedInterventions : [];
      if (current.length) return prev;
      return { ...prev, proposedInterventions: seededInterventions };
    });
  }, [assessment.proposedInterventions, paymentTypeMapping, paymentTypeMappingLoading]);
  useEffect(() => {
    setAssessment(prev => {
      const current = Array.isArray(prev.proposedInterventions) ? prev.proposedInterventions : [];
      if (!current.length) return prev;
      let changed = false;
      const nextInterventions = current.map(intervention => {
        const next = { ...intervention };
        const educationCode = isEducationCode(next.code);
        const employerCode = isEmployerCode(next.code);
        const wageSubsidyCode = isWageSubsidyCode(next.code);
        const requiresExternal = requiresExternalPartnerForCode(next.code);
        const needsNoc = requiresNocForCode(next.code);
        if (!needsNoc && (next.interventionNoc || next.interventionNocVersion)) {
          next.interventionNoc = '';
          next.interventionNocVersion = '';
          changed = true;
        }
        if (requiresExternal && next.deliveryMode !== 'partner') {
          next.deliveryMode = 'partner';
          changed = true;
        }
        if (!educationCode && next.itpDetails) {
          next.itpDetails = '';
          changed = true;
        }
        if (!(educationCode || employerCode) && next.programName) {
          next.programName = '';
          changed = true;
        }
        if (!wageSubsidyCode && next.wageSubsidyDetails) {
          next.wageSubsidyDetails = '';
          changed = true;
        }
        if (next.deliveryMode === 'in_house' && !(educationCode || employerCode)) {
          if (next.institution) {
            next.institution = '';
            changed = true;
          }
        }
        return next;
      });
      return changed ? { ...prev, proposedInterventions: nextInterventions } : prev;
    });
  }, [proposedInterventions]);
  useEffect(() => {
    if (costingDefaultsLoading || paymentTypeMappingLoading) return;
    setAssessment(prev => {
      const current = Array.isArray(prev.proposedInterventions) ? prev.proposedInterventions : [];
      if (!current.length) return prev;
      let changed = false;
      const nextInterventions = current.map(intervention => {
        if (!intervention.code) return intervention;
        if (intervention.suggestionsSeeded) return intervention;
        const existingLines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        if (existingLines.length) {
          changed = true;
          return { ...intervention, suggestionsSeeded: true };
        }
        const suggestedLines = buildSuggestedCostLines(intervention);
        if (suggestedLines === null) return intervention;
        changed = true;
        return {
          ...intervention,
          costLines: suggestedLines,
          suggestionsSeeded: true
        };
      });
      return changed ? { ...prev, proposedInterventions: nextInterventions } : prev;
    });
  }, [buildSuggestedCostLines, costingDefaultsLoading, paymentTypeMappingLoading, proposedInterventions]);
  useEffect(() => {
    if (assessment.childcareNeed === 'yes') return;
    setAssessment(prev => {
      if (!prev.childcareFunding) return prev;
      return { ...prev, childcareFunding: '' };
    });
  }, [assessment.childcareNeed]);
  useEffect(() => {
    const hasOtherBarrier = Array.isArray(assessment.barriers) && assessment.barriers.includes('Other');
    if (hasOtherBarrier) return;
    setAssessment(prev => {
      if (!prev.barriersOther) return prev;
      return { ...prev, barriersOther: '' };
    });
  }, [assessment.barriers]);
  const decisionHasCost = Number.isFinite(overallCostTotal) && overallCostTotal > 0;
  const showDecisionBudgetPot = assessment.nwacReviewStatus === 'approve' && decisionHasCost;
  useEffect(() => {
    if (assessment.nwacReviewStatus === 'approve' && decisionHasCost) return;
    setAssessment(prev => {
      if (!prev.interventionPotId && !prev.postingContext) return prev;
      return { ...prev, interventionPotId: '', postingContext: '' };
    });
  }, [assessment.nwacReviewStatus, decisionHasCost]);
  const fetchNocSuggestions = useCallback(
    async (queryText, nocVersion) => {
      if (!nocVersion) {
        setNocSuggestions([]);
        return;
      }
      const query = typeof queryText === 'string' ? queryText.trim() : '';
      if (query.length < 2) {
        setNocSuggestions([]);
        return;
      }
      setNocSuggestionsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '25');
        params.set('q', query);
        params.set('version', nocVersion);
        const response = await apiFetch(`/api/reference/noc-codes?${params.toString()}`, { method: 'GET' });
        if (!response.ok) throw new Error(`Failed to load NOC codes (${response.status})`);
        const data = await response.json();
        const options = Array.isArray(data?.codes)
          ? data.codes
              .map(item => ({
                value: item?.code ? String(item.code).trim() : null,
                label: item?.title ? `${item.code} – ${item.title}` : String(item.code || ''),
                description: item?.title || null
              }))
              .filter(option => option.value && option.label)
          : [];
        setNocSuggestions(options);
      } catch (error) {
        setNocSuggestions([]);
      } finally {
        setNocSuggestionsLoading(false);
      }
    },
    []
  );
  const activeLock = useMemo(() => {
    if (lockState.owned && lockState.lock) {
      return lockState.lock;
    }
    if (caseData?.lock_owner_user_id || caseData?.lock_owner_display_name || caseData?.lock_owner_email) {
      return {
        applicationId: application_id || caseData?.application_id || null,
        ownerUserId: caseData?.lock_owner_user_id ? String(caseData.lock_owner_user_id) : null,
        ownerDisplayName: caseData?.lock_owner_display_name || null,
        ownerEmail: caseData?.lock_owner_email || null,
        expiresAt: caseData?.lock_expires_at || null,
        acquiredAt: null,
        ttlMinutes: null,
        heartbeatMinutes: null,
        reused: false
      };
    }
    return null;
  }, [
    application_id,
    caseData?.application_id,
    caseData?.lock_expires_at,
    caseData?.lock_owner_display_name,
    caseData?.lock_owner_email,
    caseData?.lock_owner_user_id,
    lockState.lock,
    lockState.owned
  ]);
  const lockOwnerId = activeLock?.ownerUserId ? String(activeLock.ownerUserId) : null;
  const lockHeldByCurrentUser = Boolean(isLockedByMe || (currentUserId && lockOwnerId && String(currentUserId) === lockOwnerId));
  const lockedByAnotherUser = Boolean(lockOwnerId && !lockHeldByCurrentUser);
  const hasDeclarationChoice =
    normalizedDraftConflictChoice === 'no_conflict' || normalizedDraftConflictChoice === 'conflict';
  const conflictDetailsNormalized = useMemo(
    () => (typeof conflictDeclarationDetails === 'string' ? conflictDeclarationDetails.trim() : ''),
    [conflictDeclarationDetails]
  );
  const overviewWordCount = useMemo(() => countWords(assessment.overview), [assessment.overview]);
  const employmentGoalsWordCount = useMemo(
    () => countWords(assessment.employmentGoals),
    [assessment.employmentGoals]
  );
  const hasAttemptedSteps = useMemo(
    () => Object.values(attemptedSteps).some(Boolean),
    [attemptedSteps]
  );
  const denialReasonWordCount = useMemo(
    () => countWords(denialReasonExplanation),
    [denialReasonExplanation]
  );
  const isDeclarationSubmissionDisabled =
    !hasDeclarationChoice ||
    (hasDraftDeclaredConflict && !conflictDetailsNormalized) ||
    lockedByAnotherUser ||
    isSigningDeclaration;

  const activeLetterDraft = useMemo(() => {
    if (!activeLetterKey) return buildEmptyDecisionLetterDraft();
    return letterDrafts?.[activeLetterKey] || buildEmptyDecisionLetterDraft();
  }, [activeLetterKey, letterDrafts]);
  const showApprovalLetterPackTabs = activeLetterKey === 'approval';
  const letterWorkflowId = activeLetterKey ? letterWorkflows?.[activeLetterKey] : null;
  const letterAlreadySent = Boolean(activeLetterKey && decisionLetterSent?.[activeLetterKey]);
  const deniedApplicationCloseoutComplete = decisionOutcome === 'denied' && letterAlreadySent;
  const isLetterEditingDisabled = lockedByAnotherUser || isCompletedStatus || letterAlreadySent;
  const canGenerateLetterDraft = Boolean(activeLetterKey) && !isLetterEditingDisabled && !draftingLetter;
  const canSaveLetterDraft = Boolean(activeLetterKey) && !isLetterEditingDisabled;
  const canSendLetter =
    Boolean(activeLetterKey) &&
    !isLetterEditingDisabled &&
    !!letterWorkflowId &&
    !sendingLetter &&
    hasDecisionLetterContent(activeLetterDraft);
  useEffect(() => {
    if (!showApprovalLetterPackTabs && approvalLetterPackTabId !== 'client') {
      setApprovalLetterPackTabId('client');
    }
  }, [approvalLetterPackTabId, showApprovalLetterPackTabs]);
  useEffect(() => {
    if (activeLetterKey !== 'approval') {
      if (approvalLetterPackGenerated) setApprovalLetterPackGenerated(false);
      return;
    }
    const savedApprovalPack = savedApprovalLetterPackDrafts?.approval;
    const savedGenerated = Boolean(savedApprovalPack && typeof savedApprovalPack === 'object');
    if ((hasDecisionLetterContent(activeLetterDraft) || savedGenerated) && !approvalLetterPackGenerated) {
      setApprovalLetterPackGenerated(true);
    }
  }, [activeLetterDraft, activeLetterKey, approvalLetterPackGenerated, savedApprovalLetterPackDrafts]);
  const approvalSavedPack = useMemo(() => {
    const raw = savedApprovalLetterPackDrafts?.approval;
    return raw && typeof raw === 'object' ? raw : null;
  }, [savedApprovalLetterPackDrafts]);
  const approvalSavedInstitutionLetters = useMemo(() => {
    const raw = approvalSavedPack?.institutionLetters;
    if (!Array.isArray(raw)) return [];
    return raw.filter(item => item && typeof item === 'object');
  }, [approvalSavedPack]);
  const approvalSavedCoFunderLetters = useMemo(() => {
    const raw = approvalSavedPack?.coFunderLetters;
    if (!Array.isArray(raw)) return [];
    return raw.filter(item => item && typeof item === 'object');
  }, [approvalSavedPack]);
  const approvalSavedLoanProviderLetters = useMemo(() => {
    const raw = approvalSavedPack?.loanProviderLetters;
    if (!Array.isArray(raw)) return [];
    return raw.filter(item => item && typeof item === 'object');
  }, [approvalSavedPack]);
  const approvalInstitutionLettersForDisplay =
    approvalLetterPackGenerated && approvalSavedInstitutionLetters.length
      ? approvalSavedInstitutionLetters
      : institutionApprovalLetters;
  const approvalCoFunderLettersForDisplay =
    approvalLetterPackGenerated && approvalSavedCoFunderLetters.length
      ? approvalSavedCoFunderLetters
      : coFunderApprovalLetters;
  const approvalLoanProviderLettersForDisplay =
    approvalLetterPackGenerated && approvalSavedLoanProviderLetters.length
      ? approvalSavedLoanProviderLetters
      : loanProviderApprovalLetters;
  const buildApprovalLetterPackDraft = useCallback(
    (overrides = {}) => ({
      generated_at: approvalSavedPack?.generated_at || new Date().toISOString(),
      institutionLetters: overrides.institutionLetters || approvalInstitutionLettersForDisplay,
      coFunderLetters: overrides.coFunderLetters || approvalCoFunderLettersForDisplay,
      loanProviderLetters: overrides.loanProviderLetters || approvalLoanProviderLettersForDisplay
    }),
    [
      approvalCoFunderLettersForDisplay,
      approvalInstitutionLettersForDisplay,
      approvalLoanProviderLettersForDisplay,
      approvalSavedPack?.generated_at
    ]
  );
  const updateApprovalLetterPackLetterBody = useCallback(
    (letterGroup, targetLetter, nextBody, targetIndex = null) => {
      if (!letterGroup || !targetLetter) return;
      const targetKey = targetLetter.id || targetLetter.fileName || targetLetter.title || '';
      const replaceBody = letters => {
        const source = Array.isArray(letters) ? letters : [];
        return source.map((letter, index) => {
          const letterKey = letter?.id || letter?.fileName || letter?.title || '';
          const isMatch = targetKey ? letterKey === targetKey : index === targetIndex;
          if (!isMatch) return letter;
          return { ...letter, body: nextBody };
        });
      };
      setSavedApprovalLetterPackDrafts(prev => {
        const currentPack = prev?.approval && typeof prev.approval === 'object' ? prev.approval : {};
        const basePack = buildApprovalLetterPackDraft({
          institutionLetters: Array.isArray(currentPack.institutionLetters)
            ? currentPack.institutionLetters
            : approvalInstitutionLettersForDisplay,
          coFunderLetters: Array.isArray(currentPack.coFunderLetters)
            ? currentPack.coFunderLetters
            : approvalCoFunderLettersForDisplay,
          loanProviderLetters: Array.isArray(currentPack.loanProviderLetters)
            ? currentPack.loanProviderLetters
            : approvalLoanProviderLettersForDisplay
        });
        const nextPack = {
          ...basePack,
          [letterGroup]: replaceBody(basePack[letterGroup])
        };
        return {
          ...(prev || {}),
          approval: nextPack
        };
      });
    },
    [
      approvalCoFunderLettersForDisplay,
      approvalInstitutionLettersForDisplay,
      approvalLoanProviderLettersForDisplay,
      buildApprovalLetterPackDraft
    ]
  );
  useEffect(() => {
    const letterContextKey = `${caseId || 'case'}:${activeLetterKey || 'none'}`;
    if (!activeLetterKey) {
      setLetterBody('');
      letterBodyDirtyRef.current = false;
      lastActiveLetterKeyRef.current = letterContextKey;
      return;
    }
    const keyChanged = lastActiveLetterKeyRef.current !== letterContextKey;
    if (keyChanged || !letterBodyDirtyRef.current) {
      const includeNextSteps =
        activeLetterKey === 'denial' && Boolean(activeLetterDraft.next_step_1 || activeLetterDraft.next_step_2);
      const includeDecisionLabel = false;
      const includeReasonLabel = false;
      const hasContent = hasDecisionLetterContent(activeLetterDraft);
      if (!hasContent) {
        setLetterBody('');
      } else {
        setLetterBody(buildLetterBodyFromDraft(activeLetterDraft, {
          includeNextSteps,
          includeDecisionLabel,
          includeReasonLabel
        }));
      }
      letterBodyDirtyRef.current = false;
      lastActiveLetterKeyRef.current = letterContextKey;
    }
  }, [activeLetterDraft, activeLetterKey, caseId]);

  useEffect(() => {
    const incoming = Number(caseData?.application_row_version || 0);
    if (incoming) {
      updateRowVersion(incoming);
    }
  }, [caseData?.application_row_version, updateRowVersion]);
  useEffect(() => {
    const incoming = Number(applicationRowVersion || 0);
    if (incoming && incoming > (Number(applicationRowVersionState) || 0)) {
      updateRowVersion(incoming);
    }
  }, [applicationRowVersion, applicationRowVersionState, updateRowVersion]);

  // Pre-populate fields from application form as placeholders
  useEffect(() => {
    if (!caseData) return;
    const incomingVersion = Number(caseData?.application_row_version || 0);
    if (incomingVersion && incomingVersion < (Number(applicationRowVersionState) || 0)) {
      // Ignore stale payloads so we don't overwrite newer local edits after a save.
      return;
    }
    const parseOrDefault = (val, def) => {
      if (!val) return def;
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        if (parsed && typeof parsed === 'object') {
          return { ...def, ...parsed };
        }
      } catch (_) {
        return def;
      }
      return def;
    };
    const derivedOutcomeStatus = (() => {
      return deriveAssessmentReviewStatusSelection({
        assessmentReviewStatus: caseData?.assessment_nwac_review_status ?? null,
        assessmentReview: caseData?.assessment_nwac_review ?? null,
        applicationStatus: canonicalApplicationStatus || rawApplicationStatus,
        applicationLifecycleStatus: caseData?.application_lifecycle_status ?? caseData?.applicationLifecycleStatus ?? null,
        caseStatus: caseData?.status ?? null,
        decisionOutcome: caseData?.decision_outcome ?? caseData?.decisionOutcome ?? null,
        awaitingReason:
          caseData?.application_awaiting_reason ??
          caseData?.applicationAwaitingReason ??
          null,
        closureReason:
          caseData?.application_closure_reason ??
          caseData?.applicationClosureReason ??
          null,
      });
    })();

    const contextDeliveryMode = (() => {
      const raw = caseData?.caseContext?.assessmentDeliveryMode || caseData?.caseContext?.deliveryMode;
      if (typeof raw !== 'string') return '';
      const normalized = raw.trim().toLowerCase();
      return normalized === 'in_house' || normalized === 'partner' ? normalized : '';
    })();
    const parseMaybeJson = (value) => {
      if (!value) return null;
      if (typeof value === 'object') return value;
      try {
        return JSON.parse(value);
      } catch (_) {
        return null;
      }
    };
    const legacyItp = parseOrDefault(caseData.assessment_itp, {
      tuition: '',
      books: '',
      materials: '',
      living: '',
      childcare: '',
      otherLabel: '',
      otherAmount: '',
      details: ''
    });
    const legacyWage = parseOrDefault(caseData.assessment_wage, {
      wages: '',
      mercs: '',
      nonwages: '',
      other1Label: '',
      other1Amount: '',
      other2Label: '',
      other2Amount: '',
      subsidyDetails: ''
    });
    const proposedRaw =
      caseData.assessment_proposed_interventions ||
      caseData.assessmentProposedInterventions ||
      caseData.proposed_interventions ||
      null;
    const parsedProposed = parseMaybeJson(proposedRaw);
    const legacyCostLine = (() => {
      if (parsedProposed) return null;
      const rawTotal = caseData.assessment_intervention_cost_total;
      const parsedTotal = parseCurrencyInput(rawTotal);
      if (parsedTotal === null || parsedTotal <= 0) {
        return null;
      }
      return buildEmptyCostLine({
        type: 'OtherEligibleCost',
        amount: String(rawTotal),
        recurrence: {
          enabled: false,
          startDate: '',
          endDate: '',
          occurrences: '',
          amountPerPeriod: ''
        }
      });
    })();
    const legacyIntervention = buildEmptyIntervention({
      code: caseData.assessment_intervention_code != null ? String(caseData.assessment_intervention_code) : '',
      startDate: formatDate(caseData.assessment_intervention_start_date) || '',
      endDate: formatDate(caseData.assessment_intervention_end_date) || '',
      deliveryMode: contextDeliveryMode || 'partner',
      institution: caseData?.assessment_institution || caseData?.institution || '',
      programName: caseData?.assessment_program_name || '',
      itpDetails: legacyItp.details || '',
      wageSubsidyDetails: legacyWage.subsidyDetails || '',
      interventionNoc: caseData.assessment_intervention_related_noc ? String(caseData.assessment_intervention_related_noc).trim() : '',
      interventionNocVersion: caseData.assessment_intervention_related_noc_version
        ? String(caseData.assessment_intervention_related_noc_version).trim()
        : '',
      suggestionsSeeded: Boolean(legacyCostLine),
      costLines: legacyCostLine ? [legacyCostLine] : []
    });
    const legacyHasValues = Boolean(
      legacyIntervention.code ||
        legacyIntervention.startDate ||
        legacyIntervention.endDate ||
        legacyIntervention.institution ||
        legacyIntervention.programName ||
        legacyIntervention.itpDetails ||
        legacyIntervention.wageSubsidyDetails ||
        legacyIntervention.interventionNoc ||
        legacyIntervention.interventionNocVersion ||
        (Array.isArray(legacyIntervention.costLines) && legacyIntervention.costLines.length)
    );
    const proposedInterventions = parsedProposed
      ? normalizeProposedInterventions(parsedProposed)
      : (legacyHasValues ? [legacyIntervention] : []);

    const assessmentContext = getApplicationAssessmentContext(caseData?.caseContext, applicationId);
    const normalizedOtherFunding = normalizeOtherFundingDetails(
      assessmentContext?.assessmentOtherFunding
    );
    const placeholders = {
      dateOfAssessment: caseData.assessment_date_of_assessment || '',
      clientName: caseData.assigned_user_email || '',
      overview: caseData?.case_summary || '',
      employmentGoals: caseData?.assessment_employment_goals || caseData?.employment_goals || '',
      previousISET: (() => {
        const raw = caseData.assessment_previous_iset;
        if (raw === null || typeof raw === 'undefined') return '';
        if (typeof raw === 'string') {
          const normalized = raw.trim().toLowerCase();
          if (normalized === 'yes' || normalized === 'no') return normalized;
          if (['1', 'true', 'y', 'on'].includes(normalized)) return 'yes';
          if (['0', 'false', 'n', 'off'].includes(normalized)) return 'no';
          return '';
        }
        if (raw === true || raw === 1) return 'yes';
        if (raw === false || raw === 0) return 'no';
        if (Number.isFinite(Number(raw))) {
          return Number(raw) === 1 ? 'yes' : Number(raw) === 0 ? 'no' : '';
        }
        return '';
      })(),
      previousISETDetails: caseData?.assessment_previous_iset_details || '',
      barriers: Array.isArray(caseData?.assessment_employment_barriers)
        ? caseData.assessment_employment_barriers
        : (Array.isArray(caseData?.employment_barriers) ? caseData.employment_barriers : []),
      barriersOther: caseData?.assessment_employment_barriers_other_details || '',
      priorities: Array.isArray(caseData?.assessment_local_area_priorities)
        ? caseData.assessment_local_area_priorities
        : [],
      otherFundingInvolved: normalizedOtherFunding.involved,
      otherFundingSources: normalizedOtherFunding.sources,
      otherFundingNwacCoverage: normalizedOtherFunding.nwacCoverage,
      otherFundingNotes: normalizedOtherFunding.notes,
      esdcEligibility: caseData.assessment_esdc_eligibility || '',
      proposedInterventions,
      recommendation: caseData.assessment_recommendation || '',
      justification: caseData.assessment_justification || '',
      nwacReview: caseData.assessment_nwac_review || '',
      nwacReviewStatus: derivedOutcomeStatus,
      nwacReason: caseData.assessment_nwac_reason || '',
      interventionPotId: (() => {
        if (caseData.assessment_intervention_pot_id != null) {
          return String(caseData.assessment_intervention_pot_id);
        }
        const firstPlan = Array.isArray(caseData?.actionPlans) && caseData.actionPlans.length
          ? caseData.actionPlans[0]
          : null;
        const planPot = firstPlan?.budgetPot ?? firstPlan?.budget_pot ?? null;
        return planPot != null ? String(planPot) : '';
      })(),
      childcareNeed: (() => {
        const raw = caseData.assessment_childcare_need;
        if (raw === null || typeof raw === 'undefined') return '';
        if (typeof raw === 'string') {
          const lowered = raw.trim().toLowerCase();
          if (lowered === 'yes' || lowered === 'no') return lowered;
        }
        if (raw === true || raw === 1 || raw === '1') return 'yes';
        if (raw === false || raw === 0 || raw === '0') return 'no';
        return '';
      })(),
      childcareFunding: caseData.assessment_childcare_funding_details || '',
      postingContext: caseData.assessment_posting_context || caseData.assessmentPostingContext || ''
    };
    const mergedIncoming = { ...buildEmptyAssessment(), ...placeholders };
    setAssessment(prev => {
      const merged = mergeAssessmentState(prev, mergedIncoming);
      const mergedWithLimits = {
        ...merged,
        overview: limitWords(merged.overview, OVERVIEW_WORD_LIMIT),
        employmentGoals: limitWords(merged.employmentGoals, EMPLOYMENT_GOALS_WORD_LIMIT)
      };
      setInitialAssessment(mergedWithLimits);
      return mergedWithLimits;
    });
    setConflictDeclarationSigned(Boolean(caseData?.assessment_conflict_declaration_signed));
    setConflictDeclarationSignedAt(caseData?.assessment_conflict_declaration_signed_at || null);
    const incomingConflictChoice = normalizeConflictDeclarationChoice(
      caseData?.assessment_conflict_declaration_choice ||
      (caseData?.assessment_conflict_declaration_signed ? 'no_conflict' : '')
    );
    const incomingConflictDetails = caseData?.assessment_conflict_declaration_details || '';
    setPersistedConflictDeclarationChoice(incomingConflictChoice);
    setPersistedConflictDeclarationDetails(incomingConflictDetails);
    setConflictDeclarationResolutionOutcome(
      normalizeConflictResolutionOutcome(caseData?.assessment_conflict_declaration_resolution_outcome)
    );
    setConflictDeclarationChoice(incomingConflictChoice);
    setConflictDeclarationDetails(incomingConflictDetails);
    setDeclarationError(null);

    const contextDrafts = getDecisionLetterDrafts(caseData?.caseContext, applicationId);
    const normalizeDraft = (draft, defaults) => {
      const src = draft && typeof draft === 'object' ? draft : {};
      return {
        decision_date: src.decision_date || defaults.decision_date || '',
        letter_title: src.letter_title || defaults.letter_title || '',
        decision_intro: src.decision_intro || defaults.decision_intro || '',
        decision_label: src.decision_label || defaults.decision_label || '',
        decision_reason: src.decision_reason || defaults.decision_reason || '',
        next_step_1: src.next_step_1 || defaults.next_step_1 || '',
        next_step_2: src.next_step_2 || defaults.next_step_2 || '',
        coordinator_name: src.coordinator_name || defaults.coordinator_name || '',
        organization_name: src.organization_name || defaults.organization_name || ''
      };
    };
    const baseDecisionDate = formatDate(new Date());
    const defaultApproval = {
      decision_date: baseDecisionDate,
      letter_title: 'Letter of Approval',
      decision_intro: '',
      decision_label: 'Approved',
      decision_reason: '',
      next_step_1: '',
      next_step_2: '',
      coordinator_name: currentUserName || '',
      organization_name: DEFAULT_ORG_NAME
    };
    const defaultDenial = {
      decision_date: baseDecisionDate,
      letter_title: 'Letter of Denial',
      decision_intro: '',
      decision_label: 'Denied',
      decision_reason: '',
      next_step_1: '',
      next_step_2: '',
      coordinator_name: currentUserName || '',
      organization_name: DEFAULT_ORG_NAME
    };
    const mergedDrafts = {
      approval: normalizeDraft(contextDrafts?.approval || contextDrafts?.approved, defaultApproval),
      denial: normalizeDraft(contextDrafts?.denial || contextDrafts?.denied || contextDrafts?.rejected, defaultDenial)
    };
    setLetterDrafts(mergedDrafts);
    setInitialLetterDrafts(mergedDrafts);
  }, [
    applicationId,
    applicationRowVersionState,
    canonicalApplicationStatus,
    caseData,
    currentUserName,
    rawApplicationStatus
  ]);

  // Show NWAC section after submission, review completion, or outcome-ready status
  useEffect(() => {
    const pendingApproval = isPendingApprovalStatus;
    const shouldShowOutcome =
      pendingApproval ||
      isApplicationAssessmentReviewerStage ||
      isDecisionFinal ||
      isPostDecisionStatus;
    setShowNWACSection(shouldShowOutcome);
    setLocalAssessmentSubmitted(shouldShowOutcome);
  }, [
    isApplicationAssessmentReviewerStage,
    isDecisionFinal,
    isPendingApprovalStatus,
    isPostDecisionStatus
  ]);

  useEffect(() => {
    setReviewWorkflowNote('');
  }, [reviewStage, reviewWorkflow?.id]);

  // UI logic: once status reaches pending decision or a final decision, lock assessment fields and surface decision review
  const isAssessmentSubmitted =
    isPendingApprovalStatus || isApplicationAssessmentReviewerStage;
  const isReviewComplete = APPLICATION_FINAL_STATUSES.has(normalizedApplicationStatus);
  const isReturnedToSubmitterStage =
    twoStepReviewEnabled && reviewStage === ASSESSMENT_REVIEW_STAGES.returnedToSubmitter;
  const preserveReturnedAssessmentEligibility = canPreserveReturnedAssessmentEligibility({
    reviewWorkflow,
    currentEligibility: assessment.esdcEligibility,
    initialEligibility: initialAssessment.esdcEligibility,
  });
  const shouldUnlockWizardNavigation =
    !isEditingAssessment &&
    (
      isPendingApprovalStatus ||
      isApplicationAssessmentReviewerStage ||
      isReturnedToSubmitterStage ||
      isPostDecisionStatus ||
      isReviewComplete
    );
  const assessmentSubmitted =
    localAssessmentSubmitted ||
    isAssessmentSubmitted ||
    isReviewComplete ||
    isDecisionFinal ||
    isPostDecisionStatus ||
    isLockedStatus ||
    lockedByAnotherUser;
  // Disable all fields (including NWAC) if review is complete, a final decision exists, status is locked, conflict not signed, or eligibility not set
  const baseAssessmentLocked = lockedByAnotherUser || isLockedStatus || isReviewComplete || isDecisionFinal || isPostDecisionStatus;
  const canEditAssessmentBody = canEditApplicationAssessmentBody({
    isAssessor,
    isRegionalManager,
    isSystemAdministrator: roleKey === 'systemadministrator',
    applicationStatus: normalizedApplicationStatus,
    reviewWorkflow,
    currentStaffProfileId,
  });
  const assessmentEditBlockedMessage = isRegionalManager
    ? 'Regional Managers can edit their own in-review drafts, including assessments returned to them as the original submitter. Other submitted assessments must move through the review actions instead.'
    : 'This role cannot edit assessment fields in the current stage.';
  const canManageEligibilityDuringAssessment =
    canManageEiEligibility &&
    !baseAssessmentLocked &&
    !isDeclarationGateActive;
  const isAssessmentDisabled =
    baseAssessmentLocked ||
    !canEditAssessmentBody ||
    isEligibilityGateActive ||
    isPendingApprovalStatus ||
    isApplicationAssessmentReviewerStage ||
    (assessmentSubmitted && !isEditingAssessment);
  const checklistUploadsLocked = isAssessmentDisabled && !isCommunicationStep && !isFundingDocsStep;
  const isNWACFieldsDisabled =
    baseAssessmentLocked ||
    isEligibilityGateActive ||
    !showNWACSection ||
    !(isPendingApprovalStatus || isReviewWithNwac) ||
    !canNwacReview;
  const isEligibilityDisabled = !canManageEligibilityDuringAssessment || !isEligibilityAdmin;
  const isEiVerificationUploadDisabled =
    !canManageEligibilityDuringAssessment ||
    !canUploadEiVerification ||
    eiVerificationUploading ||
    !applicationId ||
    !applicantUserId;
  const applicationWidgetTitle =
    currentStep === FUNDING_DOCS_STEP_ID
      ? 'Application approval follow-up'
      : isCommunicationStep
        ? 'Application decision follow-up'
        : showNWACSection
          ? 'Application decision'
          : 'Application assessment';
  const applicationWidgetHelpTitle = showNWACSection ? 'Application Decision Help' : 'Application Assessment Help';
  const applicationPhaseDescription =
    currentStep === FUNDING_DOCS_STEP_ID
      ? 'The program decision is recorded. Complete the required funding forms and signatures before marking this workflow complete.'
      : isCommunicationStep
        ? 'The program decision is recorded. Prepare or send the applicant communication and complete any remaining approval follow-up from here.'
        : currentStep === 'decision'
          ? isReviewWithRegionalManager
            ? requiresSubmitterCorrectionReturn
              ? 'Return this reopened assessment to the original submitter with correction notes. It cannot be submitted for another final decision until the submitter corrects and resubmits it.'
              : 'Review the submitted assessment and either return it with notes or submit it for final decision.'
            : isReviewWithNwac
              ? 'Review the Regional Manager sign-off, confirm the program decision, and capture any required approval notes.'
              : 'Review the submitted assessment, confirm the program decision, and capture any required decision notes.'
          : showNWACSection
            ? isReviewWithRegionalManager
              ? 'Regional Manager review is in progress before the final decision.'
              : isReviewWithNwac
                ? 'Review the submitted assessment and record the final decision.'
                : 'Review the submitted assessment and move it through the final decision.'
            : "Assess the applicant's needs, eligibility, and funding recommendation. Complete all required sections before submitting for review.";
  const showDenyFundingShortcut = !isDecisionFinal && !isPostDecisionStatus;
  const denyFundingBlockedReason = (() => {
    if (!showDenyFundingShortcut) return '';
    if (!caseId) return 'Save progress to create a case before denying funding.';

    if (lockedByAnotherUser) return 'This case is currently locked by another user.';

    if (isLockedStatus) return 'This application is locked and cannot be updated.';
    return '';
  })();
  const canUseDenyFundingShortcut = showDenyFundingShortcut && !denyFundingBlockedReason;

  const resolveStoredWizardStep = useCallback((key, allowedSteps) => {
    if (!key) return null;
    const stored = assessmentWizardStepStore.get(String(key));
    if (!stored) return null;
    return allowedSteps.includes(stored) ? stored : null;
  }, []);

  useEffect(() => {
    if (!wizardStepKey) return;
    const stepSignature = activeStepIds.join('|');
    const keyChanged = wizardStepRestoreKeyRef.current !== wizardStepKey;
    const stepsChanged = wizardStepRestoreStepsRef.current !== stepSignature;
    if (!keyChanged && !stepsChanged) return;
    wizardStepRestoreKeyRef.current = wizardStepKey;
    wizardStepRestoreStepsRef.current = stepSignature;
    if (approvalRequestedStep && activeStepIds.includes(approvalRequestedStep)) {
      if (approvalRequestedStep !== currentStep) {
        setCurrentStep(approvalRequestedStep);
      }
      return;
    }
    const storedStep = resolveStoredWizardStep(wizardStepKey, activeStepIds);
    if (storedStep && storedStep !== currentStep) {
      setCurrentStep(storedStep);
      return;
    }
    if (!activeStepIds.includes(currentStep)) {
      setCurrentStep(BASE_STEP_IDS[0]);
    }
  }, [wizardStepKey, activeStepIds, approvalRequestedStep, currentStep, resolveStoredWizardStep]);

  useEffect(() => {
    const requestedStep = approvalRequestedStep;
    if (!wizardStepKey || !requestedStep) return;
    if (!activeStepIds.includes(requestedStep)) return;
    const approvalKey = `${wizardStepKey}:${approvalWorkspaceEntry.key}:${requestedStep}`;
    if (approvalEntryStepAppliedRef.current === approvalKey) return;
    approvalEntryStepAppliedRef.current = approvalKey;
    if (currentStep !== requestedStep) {
      setCurrentStep(requestedStep);
    }
  }, [activeStepIds, approvalRequestedStep, approvalWorkspaceEntry, currentStep, wizardStepKey]);

  useEffect(() => {
    if (approvalRequestedStep) {
      wizardNavPrimeRef.current = { signature: null, restoreStep: null };
      if (wizardNavPriming) {
        setWizardNavPriming(false);
      }
      return;
    }
    if (!shouldUnlockWizardNavigation || activeStepIds.length < 2) return;
    const signature = activeStepIds.join('|');
    if (suppressPostDecisionStepAutoPrimeRef.current) {
      suppressPostDecisionStepAutoPrimeRef.current = false;
      wizardNavPrimeRef.current = { signature, restoreStep: null };
      if (wizardNavPriming) {
        setWizardNavPriming(false);
      }
      return;
    }
    if (wizardNavPrimeRef.current.signature === signature) return;
    const lastStepId = activeStepIds[activeStepIds.length - 1];
    if (!lastStepId) {
      wizardNavPrimeRef.current = { signature, restoreStep: null };
      return;
    }
    if (currentStep !== lastStepId) {
      wizardNavPrimeRef.current = { signature, restoreStep: currentStep };
      setWizardNavPriming(true);
      setCurrentStep(lastStepId);
      return;
    }
    wizardNavPrimeRef.current = { signature, restoreStep: null };
  }, [approvalRequestedStep, activeStepIds, currentStep, shouldUnlockWizardNavigation, wizardNavPriming]);

  useEffect(() => {
    if (!wizardNavPriming) return;
    const lastStepId = activeStepIds[activeStepIds.length - 1];
    if (currentStep !== lastStepId) return;
    const restoreStep = wizardNavPrimeRef.current.restoreStep;
    wizardNavPrimeRef.current.restoreStep = null;
    setWizardNavPriming(false);
    if (restoreStep && restoreStep !== currentStep && activeStepIds.includes(restoreStep)) {
      setCurrentStep(restoreStep);
    }
  }, [wizardNavPriming, activeStepIds, currentStep]);

  useEffect(() => {
    if (!wizardStepKey) return;
    const normalizedKey = String(wizardStepKey);
    assessmentWizardStepStore.set(normalizedKey, currentStep);
    const caseKey = normalizedKey.split(':')[1] || normalizedKey;
    assessmentWizardLastKeyByCase.set(caseKey, normalizedKey);
  }, [wizardStepKey, currentStep]);

  const loadDocumentChecklist = useCallback(async () => {
    if (!applicantUserId) {
      setDocumentChecklistItems([]);
      setDocumentChecklistMissingCount(0);
      setDocumentChecklistError(null);
      return;
    }
    setDocumentChecklistLoading(true);
    setDocumentChecklistError(null);
    try {
      const params = new URLSearchParams();
      if (applicationId) {
        params.set('applicationId', applicationId);
      } else if (caseId) {
        params.set('caseId', String(caseId));
      }
      if (currentStep === 'communication' || currentStep === FUNDING_DOCS_STEP_ID) {
        params.set('stage', COMMUNICATION_CHECKLIST_STAGE);
      } else if (currentStep === 'docs') {
        params.set('stage', SUBMIT_ASSESSMENT_STAGE);
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`/api/applicants/${applicantUserId}/document-checklist${query}`);
      if (!res.ok) {
        throw new Error('Failed to load document checklist.');
      }
      const payload = await res.json().catch(() => ({ items: [], missingRequiredCount: 0 }));
      const items = Array.isArray(payload.items) ? payload.items : [];
      setDocumentChecklistItems(items);
      setDocumentChecklistMissingCount(Number(payload.missingRequiredCount) || 0);
    } catch (err) {
      setDocumentChecklistError(err?.message || 'Checklist check failed.');
      setDocumentChecklistItems([]);
      setDocumentChecklistMissingCount(0);
    } finally {
      setDocumentChecklistLoading(false);
    }
  }, [applicantUserId, applicationId, caseId, currentStep]);

  useEffect(() => {
    if (wizardNavPriming) return;
    if (!['docs', 'communication', FUNDING_DOCS_STEP_ID].includes(currentStep)) return;
    loadDocumentChecklist();
  }, [currentStep, loadDocumentChecklist, wizardNavPriming]);

  const handleChecklistRefresh = useCallback(() => {
    setChecklistUploadError(null);
    setChecklistUploadSuccess(null);
    loadDocumentChecklist();
  }, [loadDocumentChecklist]);

  const handleChecklistUploadClick = useCallback(
    item => {
      if (isAssessmentDisabled && !isCommunicationStep && !isFundingDocsStep) return;
      setChecklistUploadError(null);
      setChecklistUploadSuccess(null);
      if (!docsChecklistReady) {
        setChecklistUploadError('Save progress to enable uploads and checklist validation.');
        return;
      }
      const rawDocTypes = Array.isArray(item?.documentTypes) ? item.documentTypes.filter(Boolean) : [];
      const docTypes = canUploadEiVerification
        ? rawDocTypes
        : rawDocTypes.filter(type => type !== 'ei_verification');
      if (!docTypes.length) {
        if (!canUploadEiVerification && rawDocTypes.includes('ei_verification')) {
          setChecklistUploadError('EI verification uploads are restricted to Decision Makers, Regional Managers, and System Administrators.');
          return;
        }
        setChecklistUploadError('No document type is configured for this checklist item.');
        return;
      }
      const label = item?.label || 'Supporting document';
      if (docTypes.length === 1) {
        nextChecklistDocTypeRef.current = docTypes[0];
        nextChecklistLabelRef.current = label;
        if (checklistFileInputRef.current) {
          checklistFileInputRef.current.click();
        }
        return;
      }
      setChecklistUploadDocTypes(docTypes);
      setChecklistUploadDocType(docTypes[0] || '');
      setChecklistUploadLabel(label);
      setChecklistUploadModalVisible(true);
    },
    [canUploadEiVerification, docsChecklistReady, isAssessmentDisabled, isCommunicationStep, isFundingDocsStep]
  );

  const handleChecklistUploadModalDismiss = useCallback(() => {
    setChecklistUploadModalVisible(false);
    setChecklistUploadDocTypes([]);
    setChecklistUploadDocType('');
    setChecklistUploadLabel('');
    setChecklistUploadError(null);
  }, []);

  const handleChecklistUploadModalConfirm = useCallback(() => {
    if (!checklistUploadDocType) {
      setChecklistUploadError('Select a document type to continue.');
      return;
    }
    nextChecklistDocTypeRef.current = checklistUploadDocType;
    nextChecklistLabelRef.current = checklistUploadLabel || 'Supporting document';
    handleChecklistUploadModalDismiss();
    if (checklistFileInputRef.current) {
      checklistFileInputRef.current.click();
    }
  }, [checklistUploadDocType, checklistUploadLabel, handleChecklistUploadModalDismiss]);

  const handleChecklistFileSelected = useCallback(
    async event => {
      const input = event?.target;
      const file = input?.files?.[0] || null;
      if (input) {
        input.value = '';
      }
      if (!file) return;
      if (!applicantUserId) {
        setChecklistUploadError('Unable to determine the applicant for this upload.');
        return;
      }
      if (!docsChecklistReady) {
        setChecklistUploadError('Save progress to enable uploads and checklist validation.');
        return;
      }
      const docType = nextChecklistDocTypeRef.current;
      if (!docType) {
        setChecklistUploadError('Select a document type to continue.');
        return;
      }
      setChecklistUploading(true);
      setChecklistUploadError(null);
      setChecklistUploadSuccess(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (caseId) formData.append('caseId', caseId);
        if (applicationId) formData.append('applicationId', String(applicationId));
        formData.append('label', nextChecklistLabelRef.current || file.name);
        formData.append('documentType', docType);
        const response = await apiFetch(`/api/applicants/${applicantUserId}/documents/upload`, {
          method: 'POST',
          body: formData
        });
        if (!response || !response.ok) {
          let payload = null;
          try {
            payload = await response.json();
          } catch (_) {
            payload = null;
          }
          const errorCode = payload?.error || null;
          if (errorCode === 'unsupported_file_type') {
            throw new Error('That file type is not allowed. Please upload a PDF, Word (.doc or .docx), JPG, PNG, BMP, or TIFF file.');
          }
          if (errorCode === 'file_too_large') {
            const maxBytes = payload?.maxBytes;
            const maxMb = maxBytes ? Math.ceil(Number(maxBytes) / (1024 * 1024)) : null;
            throw new Error(
              maxMb
                ? `The file is too large. The maximum supported size is ${maxMb} MB.`
                : 'The file is too large to upload.'
            );
          }
          if (errorCode === 'application_required_for_document') {
            throw new Error('Save progress to create the application record before uploading this document.');
          }
          if (errorCode === 'invalid_document_type') {
            throw new Error('The selected document type is not valid or inactive.');
          }
          if (errorCode === 'document_type_lookup_failed') {
            throw new Error('Unable to validate the document type. Try again.');
          }
          throw new Error(payload?.message || 'Failed to upload document.');
        }
        dispatchSupportingDocsRefresh();
        setChecklistUploadSuccess(`Uploaded ${file.name}.`);
        await loadDocumentChecklist();
      } catch (err) {
        setChecklistUploadError(err?.message || 'Failed to upload document.');
      } finally {
        setChecklistUploading(false);
        nextChecklistDocTypeRef.current = '';
        nextChecklistLabelRef.current = '';
      }
    },
    [applicantUserId, applicationId, caseId, dispatchSupportingDocsRefresh, docsChecklistReady, loadDocumentChecklist]
  );
  const loadEiVerificationDocuments = useCallback(
    async ({ silent = false } = {}) => {
      if (!applicantUserId || !applicationId) {
        setEiVerificationDocuments([]);
        setEiVerificationDocsError(null);
        setEiVerificationDocsLoading(false);
        return;
      }
      if (!silent) setEiVerificationDocsLoading(true);
      setEiVerificationDocsError(null);
      try {
        const params = new URLSearchParams();
        params.set('applicationId', String(applicationId));
        const res = await apiFetch(`/api/applicants/${applicantUserId}/documents?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to load EI verification documents.');
        }
        const payload = await res.json().catch(() => []);
        const docs = (Array.isArray(payload) ? payload : []).filter(row => resolveDocumentType(row) === 'ei_verification');
        setEiVerificationDocuments(docs);
        if (docs.length) {
          setFieldErrors(prev => {
            if (!prev?.eiVerification) return prev;
            const next = { ...prev };
            delete next.eiVerification;
            return next;
          });
        }
      } catch (err) {
        setEiVerificationDocsError(err?.message || 'Failed to load EI verification documents.');
        setEiVerificationDocuments([]);
      } finally {
        if (!silent) setEiVerificationDocsLoading(false);
      }
    },
    [applicantUserId, applicationId]
  );

  const uploadEiVerificationIfSelected = useCallback(async (selectedFile = null) => {
    const fileToUpload = selectedFile || eiVerificationFile;
    if (!canManageEligibilityDuringAssessment || !canUploadEiVerification) return true;
    if (!fileToUpload) {
      return true;
    }
    if (eiVerificationUploading) {
      setEiVerificationUploadError('Upload in progress. Please wait for it to finish.');
      return false;
    }
    if (!assessment.esdcEligibility) {
      setEiVerificationUploadError('Select an Employment Insurance status to upload the document.');
      return false;
    }
    if (!applicantUserId) {
      setEiVerificationUploadError('Unable to determine the applicant for this upload.');
      return false;
    }
    if (!applicationId) {
      setEiVerificationUploadError('Unable to determine the application for this upload.');
      return false;
    }
    setEiVerificationUploading(true);
    setEiVerificationUploadError(null);
    setEiVerificationUploadSuccess(null);
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('label', 'EI Verification');
      formData.append('documentType', 'ei_verification');
      formData.append('eligibilityStatus', assessment.esdcEligibility);
      if (caseId) formData.append('caseId', caseId);
      formData.append('applicationId', applicationId);
      const response = await apiFetch(`/api/applicants/${applicantUserId}/documents/upload`, {
        method: 'POST',
        body: formData
      });
      if (!response || !response.ok) {
        let payload = null;
        try {
          payload = await response.json();
        } catch (_) {
          payload = null;
        }
        const errorCode = payload?.error || null;
        if (errorCode === 'unsupported_file_type') {
          throw new Error('That file type is not allowed. Please upload a PDF, Word (.doc or .docx), JPG, PNG, BMP, or TIFF file.');
        }
        if (errorCode === 'file_too_large') {
          throw new Error('The file is too large to upload.');
        }
        if (errorCode === 'application_required_for_document') {
          throw new Error('Select an application before uploading this document.');
        }
        if (errorCode === 'invalid_document_type') {
          throw new Error('The EI Verification document type is not available.');
        }
          throw new Error(payload?.message || 'Failed to upload EI verification document.');
      }
      if (typeof window !== 'undefined') {
        try {
          const detail = applicantUserId ? { applicantUserId } : undefined;
          window.dispatchEvent(new CustomEvent(SUPPORTING_DOCS_REFRESH_EVENT, { detail }));
        } catch (_) {}
      }
      const uploadedName = fileToUpload?.name || 'document';
      setEiVerificationUploadSuccess(`Uploaded ${uploadedName}.`);
      setEiVerificationFile(null);
      setEiVerificationFileError(null);
      await loadEiVerificationDocuments({ silent: true });
      return true;
    } catch (err) {
      setEiVerificationUploadError(err?.message || 'Failed to upload EI verification document.');
      return false;
    } finally {
      setEiVerificationUploading(false);
    }
  }, [applicantUserId, applicationId, assessment.esdcEligibility, canManageEligibilityDuringAssessment, canUploadEiVerification, caseId, eiVerificationFile, eiVerificationUploading, loadEiVerificationDocuments]);

  const handleEiVerificationFileChange = useCallback(async event => {
    const input = event?.target;
    const file = input?.files?.[0] || null;
    if (input) {
      input.value = '';
    }
    setEiVerificationUploadError(null);
    setEiVerificationUploadSuccess(null);
    if (!file) {
      setEiVerificationFile(null);
      setEiVerificationFileError(null);
      return;
    }
    if (!ELIGIBILITY_ALLOWED_MIME_TYPES.includes(file.type)) {
      setEiVerificationFile(null);
      setEiVerificationFileError('Only PDF, Word (.doc or .docx), JPG, PNG, BMP, or TIFF files are allowed.');
      return;
    }
    if (file.size > ELIGIBILITY_MAX_BYTES) {
      setEiVerificationFile(null);
      setEiVerificationFileError('File is too large (max 6 MB).');
      return;
    }
    setEiVerificationFile(file);
    setEiVerificationFileError(null);
    setFieldErrors(prev => {
      if (!prev?.eiVerification) return prev;
      const next = { ...prev };
      delete next.eiVerification;
      return next;
    });
    await uploadEiVerificationIfSelected(file);
  }, [uploadEiVerificationIfSelected]);

  useEffect(() => {
    let cancelled = false;

    const loadInterventionCodes = async () => {
      setInterventionCodesLoading(true);
      try {
        const response = await apiFetch('/api/reference/intervention-codes', { method: 'GET' });
        if (!response.ok) throw new Error(`Failed to load intervention codes (${response.status})`);
        const data = await response.json();
        if (cancelled) return;
        const options = Array.isArray(data?.codes)
          ? data.codes
              .map(item => ({
                value: item?.code ? String(item.code) : null,
                label: item?.label ? `${item.code} – ${item.label}` : String(item.code || '')
              }))
              .filter(option => option.value && option.label)
          : [];
        setInterventionCodes(options);
      } catch (error) {
        if (!cancelled) {
          setInterventionCodes([]);
        }
      } finally {
        if (!cancelled) setInterventionCodesLoading(false);
      }
    };

    const loadNocVersions = async () => {
      setNocVersionsLoading(true);
      try {
        const response = await apiFetch('/api/reference/noc-versions', { method: 'GET' });
        if (!response.ok) throw new Error(`Failed to load NOC versions (${response.status})`);
        const data = await response.json();
        if (cancelled) return;
        const options = Array.isArray(data?.versions)
          ? data.versions
              .map(item => ({
                value: item?.code ? String(item.code).trim() : null,
                label: item?.label ? item.label : String(item.code || '')
              }))
              .filter(option => option.value && option.label)
          : [];
        setNocVersions(options);
      } catch (error) {
        if (!cancelled) {
          setNocVersions([]);
        }
      } finally {
        if (!cancelled) setNocVersionsLoading(false);
      }
    };

    const loadPaymentTypeMapping = async () => {
      setPaymentTypeMappingLoading(true);
      try {
        const response = await apiFetch('/api/finance/payment-intervention-type-map', { method: 'GET' });
        if (!response.ok) throw new Error(`Failed to load payment type mapping (${response.status})`);
        const payload = await response.json();
        const normalized = normalizePaymentTypeMappingPayload(payload);
        if (!cancelled) {
          setPaymentTypeMapping(normalized);
        }
      } catch (error) {
        if (!cancelled) {
          setPaymentTypeMapping(null);
        }
      } finally {
        if (!cancelled) setPaymentTypeMappingLoading(false);
      }
    };

    const loadCostingDefaults = async () => {
      setCostingDefaultsLoading(true);
      try {
        const response = await apiFetch('/api/config/runtime/assessment-costing', { method: 'GET' });
        if (!response.ok) throw new Error(`Failed to load costing defaults (${response.status})`);
        const payload = await response.json();
        const normalized = normalizeCostingDefaults(payload);
        if (!cancelled) {
          setCostingDefaults(normalized);
        }
      } catch (error) {
        if (!cancelled) {
          setCostingDefaults(null);
        }
      } finally {
        if (!cancelled) setCostingDefaultsLoading(false);
      }
    };

    const loadBudgetPots = async (query) => {
      setBudgetPotLoading(true);
      try {
        let data = [];
        let response = await apiFetch('/api/reference/budget-pots-lite?chargeableOnly=1');
        if (!response || !response.ok) {
          response = await apiFetch('/api/finance/budget-pots');
        }
        data = response && response.ok ? await response.json() : [];
        if (cancelled) return;
        const qLower = (query || '').toString().toLowerCase();
        const targetFundingStream = deriveFundingStreamFromEligibility(assessment.esdcEligibility);
        const options = (Array.isArray(data) ? data : [])
          .filter(item => {
            const potType = item?.potType || item?.pot_type || item?.type || '';
            const norm = potType.toString().trim().toLowerCase().replace(/[_\s]+/g, ' ');
            return norm === 'funding stream';
          })
          .filter(item => {
            const selectedId = interventionPotRef.current ? String(interventionPotRef.current) : '';
            const itemId = item?.id || item?.value || item?.code || '';
            const itemIdStr = itemId ? String(itemId) : '';
            const isSelected = selectedId && itemIdStr === selectedId;
            const isActive = !(item?.isActive === false || item?.is_active === false || item?.is_active === 0);
            if (!isActive && !isSelected) return false;

            const normalize = v => (v ? String(v).trim().toUpperCase() : '');
            const potFunding = normalize(item.fundingSource || item.funding_source) || (() => {
              const code = normalize(item.code);
              if (!code) return '';
              if (code.includes('-EI') || code.endsWith(' EI')) return 'EI';
              if (code.includes('-CRF') || code.endsWith(' CRF')) return 'CRF';
              return '';
            })();
            if (targetFundingStream) {
              const streamNorm = normalize(targetFundingStream);
              if (streamNorm && potFunding && potFunding !== streamNorm) return false;
            }
            if (!normalizedProvince) return true;
            const regions = Array.isArray(item.regions) ? item.regions.map(r => normalize(r)) : [];
            if (isSelected && !regions.length) return true;
            if (!regions.length) return false;
            return regions.includes(normalizedProvince) || isSelected;
          })
          .filter(item => {
            if (!qLower) return true;
            const name = String(item?.name || '').toLowerCase();
            const code = String(item?.code || '').toLowerCase();
            return name.includes(qLower) || code.includes(qLower);
          })
          .map(item => {
            const value = item?.id ?? item?.value ?? item?.code ?? null;
            if (!value) return null;
            const code = item?.code || "";
            const name = item?.name || item?.description || "";
            const inactiveBadge = item?.isActive === false ? ' (inactive)' : '';
            const label = code || name ? [code, name].filter(Boolean).join(' - ') + inactiveBadge : String(value);
            return {
              value: String(value),
              label: label || String(value),
              description: name || undefined,
            };
          })
          .filter(Boolean);
        setBudgetPotOptions(options);
      } catch (_) {
        if (!cancelled) {
          setBudgetPotOptions([]);
        }
      } finally {
        if (!cancelled) setBudgetPotLoading(false);
      }
    };

    loadInterventionCodes();
    loadNocVersions();
    loadPaymentTypeMapping();
    loadCostingDefaults();
    if (decisionHasCost) {
      loadBudgetPots();
    } else {
      setBudgetPotOptions([]);
    }

    return () => {
      cancelled = true;
    };
  }, [assessment.esdcEligibility, normalizedProvince, decisionHasCost, assessment.interventionPotId, deriveFundingStreamFromEligibility]);

  // Track changes
  useEffect(() => {
    const assessmentChanged = JSON.stringify(assessment) !== JSON.stringify(initialAssessment);
    const letterChanged = JSON.stringify(letterDrafts) !== JSON.stringify(initialLetterDrafts);
    setIsChanged(assessmentChanged || letterChanged);
  }, [assessment, initialAssessment, letterDrafts, initialLetterDrafts]);

  useEffect(() => {
    if (!alertAnchorRef.current) return;
    const alertKey =
      alert?.content ||
      alert?.header ||
      validationAlert?.content ||
      validationAlert?.header ||
      declarationError ||
      null;
    const hasAlert = Boolean(alert || validationAlert || declarationError);
    if (!hasAlert) {
      previousAlertKeyRef.current = null;
      return;
    }
    if (previousAlertKeyRef.current === alertKey) {
      return;
    }
    previousAlertKeyRef.current = alertKey;
    // Do not scroll the anchor into view; rely on post-action scrolls to top to avoid conflicting scrolls.
  }, [alert, validationAlert, declarationError]);

  useEffect(() => {
    const nextVersion = Number(caseData?.application_row_version || 0);
    if (
      Number.isFinite(nextVersion) &&
      nextVersion > 0 &&
      (applicationRowVersionState === 0 || nextVersion > applicationRowVersionState)
    ) {
      updateRowVersion(nextVersion);
    }
  }, [caseData?.application_row_version, applicationRowVersionState, updateRowVersion]);

  const validateAssessment = useCallback(
    assessment => {
      const errors = {};
      // 1. Overview
      if (!assessment.overview || !assessment.overview.trim()) {
        errors.overview = 'Client application overview is required.';
      }
      // 2. Employment Goals
      if (!assessment.employmentGoals || !assessment.employmentGoals.trim()) {
        errors.employmentGoals = 'Employment goals are required.';
      }
      // 3. Barriers
      if (!Array.isArray(assessment.barriers) || assessment.barriers.length === 0) {
        errors.barriers = 'Select at least one barrier to employment.';
      } else if (assessment.barriers.includes('Other') && !assessment.barriersOther?.trim()) {
        errors.barriersOther = 'Provide details for the "Other" barrier.';
      }
      // 4. ESDC Eligibility
      if (!assessment.esdcEligibility) {
        errors.esdcEligibility = 'Employment Insurance status is required.';
      }
      if (
        canUploadEiVerification &&
        !preserveReturnedAssessmentEligibility &&
        !eiVerificationFile &&
        !eiVerificationDocuments.length
      ) {
        errors.eiVerification = 'An EI verification document is required before continuing.';
      }
      // 5. Proposed interventions + dates
      const proposed = Array.isArray(assessment.proposedInterventions) ? assessment.proposedInterventions : [];
      const interventionErrors = {};
      const costLineErrors = {};
      if (!proposed.length) {
        interventionErrors._global = 'Add at least one proposed intervention.';
      }
      proposed.forEach((intervention, interventionIndex) => {
        const entryErrors = {};
        const interventionKey = intervention.id || String(interventionIndex);
        if (!intervention.code) {
          entryErrors.code = 'Select an intervention code.';
        }
        if (!intervention.startDate) {
          entryErrors.startDate = 'Start date is required.';
        }
        const startUtc = parseIsoDateToUtc(intervention.startDate);
        const endUtc = parseIsoDateToUtc(intervention.endDate);
        if (startUtc !== null && endUtc !== null && endUtc < startUtc) {
          entryErrors.endDate = 'End date cannot be before start date.';
        }
        const requiresNocCode = requiresNocForCode(intervention.code);
        if (requiresNocCode) {
          if (!intervention.interventionNocVersion) {
            entryErrors.interventionNocVersion = 'Select a NOC version for this intervention.';
          }
          if (!intervention.interventionNoc) {
            entryErrors.interventionNoc = 'Select a NOC code for this intervention.';
          }
        }
        const educationCode = isEducationCode(intervention.code);
        const employerCode = isEmployerCode(intervention.code);
        const wageSubsidyCode = isWageSubsidyCode(intervention.code);
        if (educationCode) {
          if (!intervention.institution || !intervention.institution.trim()) {
            entryErrors.institution = 'Training institution is required for this intervention code.';
          }
          if (!intervention.itpDetails || !intervention.itpDetails.trim()) {
            entryErrors.itpDetails = 'ITP details are required for this intervention code.';
          }
        }
        if (employerCode) {
          if (!intervention.institution || !intervention.institution.trim()) {
            entryErrors.institution = 'Employer / delivery partner is required for this intervention code.';
          }
          if (wageSubsidyCode && (!intervention.wageSubsidyDetails || !intervention.wageSubsidyDetails.trim())) {
            entryErrors.wageSubsidyDetails = 'Wage subsidy details are required for this intervention code.';
          }
        }
        if (!educationCode && !employerCode && intervention.deliveryMode !== 'in_house') {
          if (!intervention.institution || !intervention.institution.trim()) {
            entryErrors.institution = 'Delivery partner / provider is required when using external delivery.';
          }
        }
        if (Object.keys(entryErrors).length) {
          interventionErrors[interventionKey] = entryErrors;
        }
        const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        const lineErrors = {};
        lines.forEach((line, lineIndex) => {
          const detailErrors = {};
          const lineKey = line.id || `${interventionKey}-line-${lineIndex}`;
          if (!line.type) {
            detailErrors.type = 'Select a cost item.';
          }
          if (line.amount === null || typeof line.amount === 'undefined' || String(line.amount).trim() === '') {
            detailErrors.amount = 'Enter an amount for this cost item.';
          } else {
            const parsedAmount = parseCurrencyInput(line.amount);
            if (parsedAmount === null || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
              detailErrors.amount = 'Enter a valid amount in dollars.';
            }
          }
          const recurrenceMode = getRecurrenceModeForType(line.type);
          const recurrenceRequired = recurrenceMode === 'required';
          const recurrenceEnabled = Boolean(line.recurrence?.enabled);
          if ((recurrenceRequired || recurrenceEnabled) && !isRecurrenceScheduleComplete(line)) {
            detailErrors.recurrence = 'Complete the installments schedule.';
          }
          if (Object.keys(detailErrors).length) {
            lineErrors[lineKey] = detailErrors;
          }
        });
        if (Object.keys(lineErrors).length) {
          costLineErrors[interventionKey] = lineErrors;
        }
      });
      if (Object.keys(interventionErrors).length) {
        errors.interventions = interventionErrors;
      }
      if (Object.keys(costLineErrors).length) {
        errors.costLines = costLineErrors;
      }
      // 10. Recommendation
      if (!assessment.recommendation) {
        errors.recommendation = 'Recommendation is required.';
      }
      // 11. Justification
      if (!assessment.justification || !assessment.justification.trim()) {
        errors.justification = 'Justification is required.';
      }
      // 12. Conditional: Previous ISET Details
      if (assessment.previousISET === 'yes' && (!assessment.previousISETDetails || !assessment.previousISETDetails.trim())) {
        errors.previousISETDetails = 'Details for previous ISET funding are required.';
      }
      // 13. Conditional: NWAC fields
      if (assessment.recommendation === 'no_recommend' && assessment.nwacReview && !assessment.nwacReason) {
        errors.nwacReason = 'Reason for denial is required.';
      }
      // 14. Budget pot validation (only if set)
      if (assessment.interventionPotId) {
        const potExists = budgetPotOptions.some(opt => opt?.value === assessment.interventionPotId);
        if (!potExists) {
          errors.interventionPotId = 'Select a valid budget pot.';
        }
        if (!assessment.postingContext) {
          errors.postingContext = 'Select how this pot is paid from.';
        }
      }
      return errors;
    },
    [
      budgetPotOptions,
      canUploadEiVerification,
      eiVerificationDocuments.length,
      eiVerificationFile,
      getRecurrenceModeForType,
      preserveReturnedAssessmentEligibility
    ]
  );

  const validateAssessmentForDeny = useCallback(assessment => {
    const errors = {};
    if (!assessment.recommendation) {
      errors.recommendation = 'Recommendation is required.';
    }
    if (!assessment.justification || !assessment.justification.trim()) {
      errors.justification = 'Justification is required.';
    }
    return errors;
  }, []);

  // Handlers
  const updateAssessmentWithValidation = useCallback(
    (updater) => {
      setAssessment(prevAssessment => {
        const nextAssessment = typeof updater === 'function' ? updater(prevAssessment) : updater;
        if (hasSubmitted || hasAttemptedSteps) {
          setFieldErrors(validateAssessment(nextAssessment));
        }
        return nextAssessment;
      });
    },
    [hasAttemptedSteps, hasSubmitted, validateAssessment]
  );

  // Enhanced handleField to clear error for the field if value is now valid
  const handleField = (field, value) => {
    if (field === 'nwacReviewStatus' && value !== 'reject' && value !== 'push_back') {
      setDenialReasonChoice('');
      setDenialReasonExplanation('');
    }
    updateAssessmentWithValidation(prevAssessment => {
      const nextValue = (() => {
        if (field === 'overview') return limitWords(value, OVERVIEW_WORD_LIMIT);
        if (field === 'employmentGoals') return limitWords(value, EMPLOYMENT_GOALS_WORD_LIMIT);
        return value;
      })();
      const nextAssessment = { ...prevAssessment, [field]: nextValue };
      if (field === 'previousISET' && value !== 'yes') {
        nextAssessment.previousISETDetails = '';
      }
      if (field === 'nwacReviewStatus' && value !== 'reject' && value !== 'push_back') {
        nextAssessment.nwacReason = '';
      }
      if (field === 'childcareNeed' && value !== 'yes') {
        nextAssessment.childcareFunding = '';
      }
      if (field === 'otherFundingInvolved' && (!value || value === 'no')) {
        nextAssessment.otherFundingSources = [];
        nextAssessment.otherFundingNwacCoverage = '';
      }
      if (field === 'esdcEligibility') {
        nextAssessment.interventionPotId = '';
        nextAssessment.postingContext = '';
      }
      if (field === 'interventionPotId') {
        if (!value) {
          nextAssessment.postingContext = '';
        } else if (!nextAssessment.postingContext) {
          nextAssessment.postingContext = 'external';
        }
      }
      if (field === 'postingContext') {
        const { postingContext: _ignore, ...rest } = fieldErrors;
        setFieldErrors(rest);
      }
      if (
        ['otherFundingInvolved', 'otherFundingSources', 'otherFundingNwacCoverage', 'otherFundingNotes'].includes(field)
      ) {
        const normalizedOtherFunding = normalizeOtherFundingDetails(
          {
            involved: nextAssessment.otherFundingInvolved,
            sources: nextAssessment.otherFundingSources,
            nwacCoverage: nextAssessment.otherFundingNwacCoverage,
            notes: nextAssessment.otherFundingNotes
          },
          { keepEmptySources: true, preserveWhitespace: true }
        );
        nextAssessment.otherFundingInvolved = normalizedOtherFunding.involved;
        nextAssessment.otherFundingSources = normalizedOtherFunding.sources;
        nextAssessment.otherFundingNwacCoverage = normalizedOtherFunding.nwacCoverage;
        nextAssessment.otherFundingNotes = normalizedOtherFunding.notes;
      }
      return nextAssessment;
    });
  };
  const applyAssessmentAssurance = (value) => {
    if (isNWACFieldsDisabled) return;
    const inferredDecision = deriveAssessmentDecisionStatusFromAgreement({
      recommendation: assessment.recommendation,
      assessmentReview: value,
    });
    if (inferredDecision === 'approve' && approvalBlockMessage) {
      setValidationAlert([approvalBlockMessage]);
    }
    if (inferredDecision === 'approve' && !approvalBlockMessage) {
      setDenialReasonChoice('');
      setDenialReasonExplanation('');
    }
    updateAssessmentWithValidation(prevAssessment => {
      const nextAssessment = { ...prevAssessment, nwacReview: value };
      if (inferredDecision && !(inferredDecision === 'approve' && approvalBlockMessage)) {
        nextAssessment.nwacReviewStatus = inferredDecision;
        if (inferredDecision === 'approve') {
          nextAssessment.nwacReason = '';
        }
      }
      return nextAssessment;
    });
  };
  const applyFundingDecision = (value) => {
    if (value === 'approve' && approvalBlockMessage) {
      setValidationAlert([approvalBlockMessage]);
      return;
    }
    if (isNWACFieldsDisabled) return;
    if (value === 'approve' && assessment.nwacReason) {
      setShowApproveConfirmModal(true);
      return;
    }
    handleField('nwacReviewStatus', value);
    if (value === 'approve') handleField('nwacReason', '');
    if (value === 'push_back') handleField('nwacReview', '');
  };
  const updateProposedInterventions = useCallback(
    (updater) => {
      updateAssessmentWithValidation(prev => {
        const current = Array.isArray(prev.proposedInterventions) ? prev.proposedInterventions : [];
        const next = typeof updater === 'function' ? updater(current) : updater;
        return { ...prev, proposedInterventions: next };
      });
    },
    [updateAssessmentWithValidation]
  );
  const updateIntervention = useCallback(
    (interventionId, updater) => {
      if (!interventionId) return;
      updateProposedInterventions(current =>
        current.map(intervention => {
          if (intervention.id !== interventionId) return intervention;
          const updated = typeof updater === 'function' ? updater(intervention) : { ...intervention, ...updater };
          return updated;
        })
      );
    },
    [updateProposedInterventions]
  );
  const addIntervention = useCallback(
    (draft) => {
      const nextIntervention = normalizeProposedIntervention(draft);
      if (!nextIntervention) return;
      updateProposedInterventions(current => [...current, nextIntervention]);
    },
    [updateProposedInterventions]
  );
  const removeIntervention = useCallback(
    (interventionId) => {
      updateProposedInterventions(current => current.filter(intervention => intervention.id !== interventionId));
    },
    [updateProposedInterventions]
  );
  const cloneIntervention = useCallback((intervention) => {
    if (!intervention || typeof intervention !== 'object') return buildEmptyIntervention();
    return {
      ...intervention,
      costLines: Array.isArray(intervention.costLines)
        ? intervention.costLines.map(line => ({ ...line, recurrence: { ...(line.recurrence || {}) } }))
        : []
    };
  }, []);
  const resetInterventionModal = useCallback(() => {
    setInterventionModal({
      visible: false,
      mode: 'view',
      interventionId: null,
      draft: null,
      original: null
    });
    setInterventionModalErrors({});
  }, []);
  const openAddInterventionModal = useCallback(() => {
    const draft = buildEmptyIntervention();
    setInterventionModal({
      visible: true,
      mode: 'add',
      interventionId: null,
      draft,
      original: draft
    });
    setInterventionModalErrors({});
  }, []);
  const openViewInterventionModal = useCallback(
    (interventionId) => {
      const intervention = proposedInterventions.find(item => item.id === interventionId);
      if (!intervention) return;
      const draft = cloneIntervention(intervention);
      setInterventionModal({
        visible: true,
        mode: 'view',
        interventionId,
        draft,
        original: draft
      });
      setInterventionModalErrors({});
    },
    [cloneIntervention, proposedInterventions]
  );
  const startInterventionEdit = useCallback(() => {
    setInterventionModal(prev => {
      if (!prev.draft) return prev;
      return {
        ...prev,
        mode: 'edit',
        draft: cloneIntervention(prev.draft),
        original: prev.original || cloneIntervention(prev.draft)
      };
    });
    setInterventionModalErrors({});
  }, [cloneIntervention]);
  const cancelInterventionEdit = useCallback(() => {
    setInterventionModal(prev => {
      if (!prev.original) return prev;
      return {
        ...prev,
        mode: 'view',
        draft: cloneIntervention(prev.original)
      };
    });
    setInterventionModalErrors({});
  }, [cloneIntervention]);
  const updateInterventionModalDraft = useCallback((updater) => {
    setInterventionModal(prev => {
      if (!prev.draft) return prev;
      const nextDraft = typeof updater === 'function' ? updater(prev.draft) : { ...prev.draft, ...updater };
      return { ...prev, draft: nextDraft };
    });
  }, []);
  const confirmInterventionDelete = useCallback(() => {
    if (!interventionDeleteId) return;
    removeIntervention(interventionDeleteId);
    setInterventionDeleteId(null);
  }, [interventionDeleteId, removeIntervention]);
  const updateCostLine = useCallback(
    (interventionId, lineId, updater) => {
      updateIntervention(interventionId, intervention => {
        const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        const nextLines = lines.map(line => {
          if (line.id !== lineId) return line;
          const updated = typeof updater === 'function' ? updater(line) : { ...line, ...updater };
          return { ...updated, recurrence: { ...line.recurrence, ...(updated.recurrence || {}) } };
        });
        return { ...intervention, costLines: nextLines };
      });
    },
    [updateIntervention]
  );
  const addCostLine = useCallback(
    (interventionId, line) => {
      updateIntervention(interventionId, intervention => {
        const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        return { ...intervention, costLines: [...lines, line] };
      });
    },
    [updateIntervention]
  );
  const removeCostLine = useCallback(
    (interventionId, lineId) => {
      updateIntervention(interventionId, intervention => {
        const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        return { ...intervention, costLines: lines.filter(line => line.id !== lineId) };
      });
    },
    [updateIntervention]
  );
  const hydrateCostLineRecurrence = useCallback(
    (line, intervention, adjustMode = 'total', options = {}) => {
      const { recalcOccurrences = true } = options;
      const recurrenceMode = getRecurrenceModeForType(line?.type);
      const recurrenceRequired = recurrenceMode === 'required';
      const recurrenceEnabled = recurrenceRequired || Boolean(line?.recurrence?.enabled);
      if (!recurrenceEnabled) {
        return {
          ...line,
          recurrence: buildRecurrenceFromIntervention(intervention, false)
        };
      }
      const fallbackRecurrence = buildRecurrenceFromIntervention(intervention, true);
      const recurrence = {
        ...mergeRecurrenceDefaults(fallbackRecurrence, line.recurrence || {}),
        enabled: true
      };
      if (recalcOccurrences && recurrence.startDate && recurrence.endDate) {
        const computed = autoOccurrencesFromDates(recurrence.startDate, recurrence.endDate, 'monthly');
        if (computed) {
          recurrence.occurrences = String(computed);
        }
      }
      if (recurrence.startDate && recurrence.occurrences && !recurrence.endDate) {
        const derivedEnd = deriveEndDateFromOccurrences(recurrence.startDate, Number(recurrence.occurrences));
        if (derivedEnd) {
          recurrence.endDate = derivedEnd;
        }
      }
      const amounts = recalcRecurringAmounts({
        amount: line.amount,
        amountPerPeriod: recurrence.amountPerPeriod,
        occurrences: recurrence.occurrences,
        adjustMode
      });
      return {
        ...line,
        amount: amounts.amount,
        recurrence: {
          ...recurrence,
          amountPerPeriod: amounts.amountPerPeriod
        }
      };
    },
    [buildRecurrenceFromIntervention, getRecurrenceModeForType]
  );
  const applyInterventionDateChangeToIntervention = useCallback(
    (intervention, { startDate, endDate }, adjustMode = 'total') => {
      const nextStartDate = typeof startDate === 'undefined' ? intervention.startDate : startDate;
      const nextEndDate = typeof endDate === 'undefined' ? intervention.endDate : endDate;
      const updatedLines = (Array.isArray(intervention.costLines) ? intervention.costLines : []).map(line => {
        if (!line?.recurrence?.enabled) return line;
        const recurrence = { ...(line.recurrence || {}) };
        if (typeof startDate !== 'undefined') recurrence.startDate = nextStartDate || '';
        if (typeof endDate !== 'undefined') recurrence.endDate = nextEndDate || '';
        return hydrateCostLineRecurrence(
          { ...line, recurrence },
          { ...intervention, startDate: nextStartDate, endDate: nextEndDate },
          adjustMode
        );
      });
      return {
        ...intervention,
        startDate: nextStartDate,
        endDate: nextEndDate,
        costLines: updatedLines
      };
    },
    [hydrateCostLineRecurrence]
  );
  const applyInterventionDateChange = useCallback(
    (interventionId, nextDates, adjustMode = 'total') => {
      updateIntervention(interventionId, intervention =>
        applyInterventionDateChangeToIntervention(intervention, nextDates, adjustMode)
      );
    },
    [applyInterventionDateChangeToIntervention, updateIntervention]
  );
  const hasRecurringLineWithAmount = useCallback((intervention) => {
    const lines = Array.isArray(intervention?.costLines) ? intervention.costLines : [];
    return lines.some(line => {
      if (!line?.recurrence?.enabled) return false;
      const amount = parseCurrencyInput(line.amount);
      return amount !== null && Number.isFinite(amount);
    });
  }, []);
  const saveInterventionModal = useCallback(() => {
    const { mode, interventionId, draft, original } = interventionModal;
    if (!draft) return;
    const errors = {};
    const nextStartDate = formatDate(draft.startDate);
    const nextEndDate = formatDate(draft.endDate);
    if (!draft.code) {
      errors.code = 'Select an intervention.';
    }
    if (!nextStartDate) {
      errors.startDate = 'Start date is required.';
    }
    const startUtc = parseIsoDateToUtc(nextStartDate);
    const endUtc = parseIsoDateToUtc(nextEndDate);
    if (startUtc !== null && endUtc !== null && endUtc < startUtc) {
      errors.endDate = 'End date cannot be before start date.';
    }
    if (Object.keys(errors).length) {
      setInterventionModalErrors(errors);
      return;
    }
    if (mode === 'add') {
      addIntervention({ ...draft, startDate: nextStartDate, endDate: nextEndDate });
      resetInterventionModal();
      return;
    }
    if (mode === 'edit' && interventionId) {
      const intervention = proposedInterventions.find(item => item.id === interventionId);
      const startChanged = nextStartDate !== formatDate(original?.startDate);
      const endChanged = nextEndDate !== formatDate(original?.endDate);
      if (startChanged || endChanged) {
        const needsPrompt = endChanged && hasRecurringLineWithAmount(intervention);
        if (needsPrompt) {
          setEndDateAdjustModal({
            interventionId,
            previousEndDate: formatDate(original?.endDate),
            nextEndDate,
            nextStartDate,
            mode: 'total'
          });
          if (startChanged) {
            applyInterventionDateChange(interventionId, { startDate: nextStartDate }, 'total');
          }
        } else {
          applyInterventionDateChange(
            interventionId,
            {
              startDate: startChanged ? nextStartDate : undefined,
              endDate: endChanged ? nextEndDate : undefined
            },
            'total'
          );
        }
      }
      resetInterventionModal();
    }
  }, [
    addIntervention,
    applyInterventionDateChange,
    hasRecurringLineWithAmount,
    interventionModal,
    proposedInterventions,
    resetInterventionModal
  ]);
  const cloneCostLine = useCallback((line) => {
    if (!line || typeof line !== 'object') return buildEmptyCostLine();
    return {
      ...line,
      payee: { ...(line.payee || {}) },
      recurrence: { ...(line.recurrence || {}) }
    };
  }, []);
  const resetCostLineModal = useCallback(() => {
    setCostLineModal({
      visible: false,
      mode: 'view',
      interventionId: null,
      lineId: null,
      draft: null,
      original: null
    });
    setCostLineModalErrors({});
    setCostLineAmountFocused(false);
    setCostLineAmountPerPeriodFocused(false);
  }, []);
  const openCostLineModal = useCallback(
    (interventionId, lineId) => {
      const intervention = proposedInterventions.find(item => item.id === interventionId);
      const line = intervention?.costLines?.find(entry => entry.id === lineId);
      if (!line) return;
      const draft = applyCostLinePayeeDefaults(cloneCostLine(line), intervention, participantLegalName, {
        allowTypeAutofill: false
      });
      setCostLineModal({
        visible: true,
        mode: 'view',
        interventionId,
        lineId,
        draft,
        original: applyCostLinePayeeDefaults(cloneCostLine(line), intervention, participantLegalName, {
          allowTypeAutofill: false
        })
      });
      setCostLineModalErrors({});
    },
    [cloneCostLine, participantLegalName, proposedInterventions]
  );
  const openAddCostLineModal = useCallback((interventionId) => {
    const intervention = proposedInterventions.find(item => item.id === interventionId) || null;
    const draft = applyCostLinePayeeDefaults(
      buildEmptyCostLine(),
      intervention,
      participantLegalName,
      { allowTypeAutofill: true }
    );
    setCostLineModal({
      visible: true,
      mode: 'add',
      interventionId,
      lineId: null,
      draft,
      original: draft
    });
    setCostLineModalErrors({});
  }, [participantLegalName, proposedInterventions]);
  const startCostLineEdit = useCallback(() => {
    setCostLineModal(prev => {
      if (!prev.draft) return prev;
      return {
        ...prev,
        mode: 'edit',
        draft: cloneCostLine(prev.draft),
        original: prev.original || cloneCostLine(prev.draft)
      };
    });
    setCostLineModalErrors({});
  }, [cloneCostLine]);
  const cancelCostLineEdit = useCallback(() => {
    setCostLineModal(prev => {
      if (!prev.original) return prev;
      return {
        ...prev,
        mode: 'view',
        draft: cloneCostLine(prev.original)
      };
    });
    setCostLineModalErrors({});
  }, [cloneCostLine]);
  const updateCostLineDraft = useCallback((updater) => {
    setCostLineModal(prev => {
      if (!prev.draft) return prev;
      const nextDraft = typeof updater === 'function' ? updater(prev.draft, prev) : { ...prev.draft, ...updater };
      return { ...prev, draft: nextDraft };
    });
  }, []);
  const updateCostLinePayeeType = useCallback(
    (nextPayeeType) => {
      setCostLineModal(prev => {
        if (!prev.draft) return prev;
        const intervention = proposedInterventions.find(item => item.id === prev.interventionId) || null;
        const normalizedPayeeType = String(nextPayeeType || '').trim();
        const nextPayee = {
          ...(prev.draft.payee || {}),
          type: normalizedPayeeType
        };
        if (normalizedPayeeType === PAYEE_TYPE_PARTICIPANT_CLIENT) {
          nextPayee.name = '';
          nextPayee.reference = '';
        }
        const nextDraft = applyCostLinePayeeDefaults(
          {
            ...prev.draft,
            payee: nextPayee
          },
          intervention,
          participantLegalName,
          { allowTypeAutofill: false }
        );
        return { ...prev, draft: nextDraft };
      });
      setCostLineModalErrors({});
    },
    [participantLegalName, proposedInterventions]
  );
  const updateCostLineType = useCallback(
    (nextType) => {
      setCostLineModal(prev => {
        if (!prev.draft) return prev;
        const intervention = proposedInterventions.find(item => item.id === prev.interventionId);
        if (!intervention) return prev;
        const recurrenceMode = getRecurrenceModeForType(nextType);
        const submissionTiming = getSubmissionTimingForType(nextType);
        const recurrenceEnabled =
          recurrenceMode === 'required'
            ? true
            : recurrenceMode === 'not_allowed'
              ? false
              : submissionTiming === SUBMISSION_TIMING_RECURRENCE_SCHEDULE && Boolean(prev.draft.recurrence?.enabled);
        const baseRecurrence = buildRecurrenceFromIntervention(intervention, recurrenceEnabled);
        const mergedRecurrence = mergeRecurrenceDefaults(baseRecurrence, prev.draft.recurrence || {});
        const recurrence = recurrenceEnabled
          ? { ...mergedRecurrence, enabled: true }
          : baseRecurrence;
        const previousPayee = prev.draft.payee && typeof prev.draft.payee === 'object' ? prev.draft.payee : {};
        const previousDefaultPayeeType = deriveDefaultPayeeTypeForCostLine(prev.draft.type);
        const nextDefaultPayeeType = deriveDefaultPayeeTypeForCostLine(nextType);
        const previousPayeeType = String(previousPayee.type || '').trim();
        const previousPayeeName = String(previousPayee.name || '').trim();
        const participantName = String(participantLegalName || '').trim();
        const shouldResetPayee =
          Boolean(nextDefaultPayeeType) &&
          (
            !previousPayeeType ||
            previousPayeeType === previousDefaultPayeeType ||
            (
              previousPayeeType === nextDefaultPayeeType &&
              participantName &&
              previousPayeeName === participantName
            )
          );
        const payee = shouldResetPayee
          ? { type: nextDefaultPayeeType, name: '', reference: '' }
          : previousPayee;
        const nextDraft = applyCostLinePayeeDefaults(
          {
            ...prev.draft,
            type: nextType,
            payee,
            recurrence
          },
          intervention,
          participantLegalName,
          { allowTypeAutofill: true }
        );
        return {
          ...prev,
          draft: nextDraft
        };
      });
      setCostLineModalErrors({});
    },
    [
      buildRecurrenceFromIntervention,
      getRecurrenceModeForType,
      getSubmissionTimingForType,
      participantLegalName,
      proposedInterventions
    ]
  );
  const toggleCostLineRecurrence = useCallback(
    (enabled) => {
      setCostLineModal(prev => {
        if (!prev.draft) return prev;
        const intervention = proposedInterventions.find(item => item.id === prev.interventionId);
        if (!intervention) return prev;
        const recurrenceMode = getRecurrenceModeForType(prev.draft.type);
        const resolvedEnabled =
          recurrenceMode === 'required'
            ? true
            : recurrenceMode === 'not_allowed'
              ? false
              : enabled;
        const baseRecurrence = buildRecurrenceFromIntervention(intervention, resolvedEnabled);
        const existing = prev.draft.recurrence || {};
        const mergedRecurrence = mergeRecurrenceDefaults(baseRecurrence, existing);
        const recurrence = resolvedEnabled
          ? { ...mergedRecurrence, enabled: true }
          : baseRecurrence;
        return {
          ...prev,
          draft: {
            ...prev.draft,
            recurrence
          }
        };
      });
      setCostLineModalErrors({});
    },
    [buildRecurrenceFromIntervention, getRecurrenceModeForType, proposedInterventions]
  );
  const updateCostLineAmount = useCallback((value) => {
    const sanitized = sanitizeCurrencyInput(value, { preserveTrailingDecimal: true });
    updateCostLineDraft(draft => {
      const next = { ...draft, amount: sanitized };
      if (draft.recurrence?.enabled && draft.recurrence?.occurrences) {
        const occ = Number(draft.recurrence.occurrences);
        if (Number.isFinite(occ) && occ > 0) {
          const total = parseCurrencyInput(sanitized);
          next.recurrence = {
            ...draft.recurrence,
            amountPerPeriod: total !== null ? formatCurrencyDisplay(total / occ) : ''
          };
        }
      }
      return next;
    });
  }, [updateCostLineDraft]);
  const blurCostLineAmount = useCallback(() => {
    setCostLineAmountFocused(false);
    updateCostLineDraft(draft => {
      const sanitized = sanitizeCurrencyInput(draft.amount);
      return { ...draft, amount: sanitized || '' };
    });
  }, [updateCostLineDraft]);
  const blurCostLineAmountPerPeriod = useCallback(() => {
    setCostLineAmountPerPeriodFocused(false);
    updateCostLineDraft(draft => {
      const recurrence = { ...(draft.recurrence || {}) };
      recurrence.amountPerPeriod = sanitizeCurrencyInput(recurrence.amountPerPeriod) || '';
      return { ...draft, recurrence };
    });
  }, [updateCostLineDraft]);
  const updateCostLineAmountPerPeriod = useCallback((value) => {
    const sanitized = sanitizeCurrencyInput(value, { preserveTrailingDecimal: true });
    updateCostLineDraft(draft => {
      const recurrence = { ...(draft.recurrence || {}), amountPerPeriod: sanitized };
      const occ = Number(recurrence.occurrences);
      let amount = draft.amount;
      if (Number.isFinite(occ) && occ > 0) {
        const per = parseCurrencyInput(sanitized);
        if (per !== null) {
          amount = formatCurrencyDisplay(per * occ);
        }
      }
      return { ...draft, amount, recurrence };
    });
  }, [updateCostLineDraft]);
  const updateCostLineOccurrences = useCallback((value) => {
    const cleaned = String(value || '').replace(/[^\d]/g, '');
    updateCostLineDraft(draft => {
      const recurrence = { ...(draft.recurrence || {}), occurrences: cleaned };
      if (recurrence.startDate && cleaned && !recurrence.endDate) {
        const derivedEnd = deriveEndDateFromOccurrences(recurrence.startDate, Number(cleaned));
        recurrence.endDate = derivedEnd || recurrence.endDate || '';
      }
      const amounts = recalcRecurringAmounts({
        amount: draft.amount,
        amountPerPeriod: recurrence.amountPerPeriod,
        occurrences: recurrence.occurrences,
        adjustMode: 'total'
      });
      return { ...draft, amount: amounts.amount, recurrence: { ...recurrence, amountPerPeriod: amounts.amountPerPeriod } };
    });
  }, [updateCostLineDraft]);
  const updateCostLineRecurrenceStart = useCallback((value) => {
    updateCostLineDraft(draft => {
      const recurrence = { ...(draft.recurrence || {}), startDate: value };
      if (recurrence.startDate && recurrence.endDate) {
        const occ = autoOccurrencesFromDates(recurrence.startDate, recurrence.endDate, 'monthly');
        recurrence.occurrences = occ ? String(occ) : '';
      }
      const amounts = recalcRecurringAmounts({
        amount: draft.amount,
        amountPerPeriod: recurrence.amountPerPeriod,
        occurrences: recurrence.occurrences,
        adjustMode: 'total'
      });
      return { ...draft, amount: amounts.amount, recurrence: { ...recurrence, amountPerPeriod: amounts.amountPerPeriod } };
    });
  }, [updateCostLineDraft]);
  const updateCostLineRecurrenceEnd = useCallback((value) => {
    updateCostLineDraft(draft => {
      const recurrence = { ...(draft.recurrence || {}), endDate: value };
      if (recurrence.startDate && recurrence.endDate) {
        const occ = autoOccurrencesFromDates(recurrence.startDate, recurrence.endDate, 'monthly');
        recurrence.occurrences = occ ? String(occ) : '';
      }
      const amounts = recalcRecurringAmounts({
        amount: draft.amount,
        amountPerPeriod: recurrence.amountPerPeriod,
        occurrences: recurrence.occurrences,
        adjustMode: 'total'
      });
      return { ...draft, amount: amounts.amount, recurrence: { ...recurrence, amountPerPeriod: amounts.amountPerPeriod } };
    });
  }, [updateCostLineDraft]);
  const commitCostLine = useCallback(
    (interventionId, line, mode, lineId = null) => {
      if (mode === 'add') {
        addCostLine(interventionId, line);
      } else if (mode === 'edit' && lineId) {
        updateCostLine(interventionId, lineId, line);
      }
    },
    [addCostLine, updateCostLine]
  );
  const saveCostLineModal = useCallback(() => {
    const { interventionId, draft, mode, lineId, original } = costLineModal;
    if (!interventionId || !draft) return;
    const intervention = proposedInterventions.find(item => item.id === interventionId);
    if (!intervention) return;
    const errors = {};
    if (!draft.type) {
      errors.type = 'Select a cost item.';
    }
    const recurrenceMode = getRecurrenceModeForType(draft.type);
    const recurrenceRequired = recurrenceMode === 'required';
    const recurrenceEnabled = recurrenceRequired || Boolean(draft.recurrence?.enabled);
    const payeeDraft = applyCostLinePayeeDefaults(draft, intervention, participantLegalName, {
      allowTypeAutofill: true
    });
    const recalcOccurrences = !draft.recurrence?.occurrences && Boolean(draft.recurrence?.endDate);
    const hydratedDraft = hydrateCostLineRecurrence(
      { ...payeeDraft, recurrence: { ...(payeeDraft.recurrence || {}), enabled: recurrenceEnabled } },
      intervention,
      'total',
      { recalcOccurrences }
    );
    if ((recurrenceRequired || recurrenceEnabled) && !isRecurrenceScheduleComplete(hydratedDraft)) {
      errors.recurrence = 'Complete the installments schedule.';
    }
    if (Object.keys(errors).length) {
      setCostLineModalErrors(errors);
      return;
    }
    const occurrencesChanged =
      String(hydratedDraft.recurrence?.occurrences || '') !==
      String(original?.recurrence?.occurrences || '');
    if (recurrenceEnabled && intervention.endDate && occurrencesChanged) {
      setOccurrenceConfirmModal({
        interventionId,
        lineId,
        mode,
        draft: hydratedDraft,
        originalOccurrences: original?.recurrence?.occurrences || ''
      });
      return;
    }
    commitCostLine(interventionId, hydratedDraft, mode, lineId);
    resetCostLineModal();
  }, [
    commitCostLine,
    costLineModal,
    getRecurrenceModeForType,
    hydrateCostLineRecurrence,
    participantLegalName,
    proposedInterventions,
    resetCostLineModal
  ]);
  const deleteCostLineFromModal = useCallback(() => {
    if (!costLineModal.interventionId || !costLineModal.lineId) {
      resetCostLineModal();
      return;
    }
    removeCostLine(costLineModal.interventionId, costLineModal.lineId);
    resetCostLineModal();
  }, [costLineModal, removeCostLine, resetCostLineModal]);
  const confirmOccurrencesUpdateEndDate = useCallback(() => {
    const pending = occurrenceConfirmModal;
    if (!pending) return;
    const intervention = proposedInterventions.find(item => item.id === pending.interventionId);
    if (!intervention) {
      setOccurrenceConfirmModal(null);
      return;
    }
    const occurrences = Number(pending.draft?.recurrence?.occurrences);
    const startDate = intervention.startDate;
    const nextEndDate =
      startDate && Number.isFinite(occurrences) && occurrences > 0
        ? deriveEndDateFromOccurrences(startDate, occurrences)
        : intervention.endDate || '';
    updateProposedInterventions(current =>
      current.map(item => {
        if (item.id !== pending.interventionId) return item;
        const lines = Array.isArray(item.costLines) ? item.costLines : [];
        const nextLines =
          pending.mode === 'add'
            ? [...lines, pending.draft]
            : lines.map(line => (line.id === pending.lineId ? pending.draft : line));
        const nextIntervention = { ...item, costLines: nextLines };
        return applyInterventionDateChangeToIntervention(nextIntervention, { endDate: nextEndDate }, 'total');
      })
    );
    setOccurrenceConfirmModal(null);
    resetCostLineModal();
  }, [
    applyInterventionDateChangeToIntervention,
    occurrenceConfirmModal,
    proposedInterventions,
    resetCostLineModal,
    updateProposedInterventions
  ]);
  const keepOccurrencesWithoutEndDateChange = useCallback(() => {
    const pending = occurrenceConfirmModal;
    if (!pending) return;
    const intervention = proposedInterventions.find(item => item.id === pending.interventionId);
    if (!intervention) {
      setOccurrenceConfirmModal(null);
      return;
    }
    const reverted = {
      ...pending.draft,
      recurrence: {
        ...(pending.draft.recurrence || {}),
        occurrences: pending.originalOccurrences
      }
    };
    const hydrated = hydrateCostLineRecurrence(reverted, intervention, 'total', { recalcOccurrences: false });
    commitCostLine(pending.interventionId, hydrated, pending.mode, pending.lineId);
    setOccurrenceConfirmModal(null);
    resetCostLineModal();
  }, [commitCostLine, hydrateCostLineRecurrence, occurrenceConfirmModal, proposedInterventions, resetCostLineModal]);
  const handleInlineAmountChange = useCallback(
    (interventionId, lineId, value) => {
      const sanitized = sanitizeCurrencyInput(value, { preserveTrailingDecimal: true });
      updateCostLine(interventionId, lineId, line => {
        const next = { ...line, amount: sanitized };
        if (line.recurrence?.enabled && line.recurrence?.occurrences) {
          const occ = Number(line.recurrence.occurrences);
          if (Number.isFinite(occ) && occ > 0) {
            const total = parseCurrencyInput(sanitized);
            next.recurrence = {
              ...line.recurrence,
              amountPerPeriod: total !== null ? formatCurrencyDisplay(total / occ) : ''
            };
          }
        }
        return next;
      });
    },
    [updateCostLine]
  );
  const handleInlineAmountBlur = useCallback((interventionId, lineId) => {
    setInlineAmountEditingId(prev => (prev === lineId ? null : prev));
    updateCostLine(interventionId, lineId, line => ({
      ...line,
      amount: sanitizeCurrencyInput(line.amount) || ''
    }));
  }, [updateCostLine]);
  const exitAssessmentWorkspace = useCallback(() => {
    if (typeof actions?.exitAssessment === 'function') {
      actions.exitAssessment();
      return;
    }
    if (history && typeof history.goBack === 'function' && typeof window !== 'undefined' && window.history.length > 1) {
      history.goBack();
      return;
    }
    if (history && typeof history.push === 'function') {
      history.push('/case-management');
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.assign('/case-management');
    }
  }, [actions, history]);
  const handleCancel = () => setShowCancelModal(true);
  const confirmCancel = async () => {
    setAssessment(initialAssessment);
    setLetterDrafts(initialLetterDrafts);
    setShowCancelModal(false);
    setAlert(null);
    setDenyFundingFlowActive(false);
    setIsEditingAssessment(false);
    try {
      await releaseLock({ silent: true });
    } catch (_) {}
    exitAssessmentWorkspace();
  };
  const showLockAlert = useCallback((detail, severity = 'warning') => {
    const message = buildLockConflictMessage(detail);
    setAlert({
      type: severity,
      content: message,
      dismissible: true,
      statusIconAriaLabel: severity === 'warning' ? 'Warning' : 'Error'
    });
    scrollWidgetAndPageTop();
  }, [scrollWidgetAndPageTop]);
  const beginEditingAssessment = useCallback(async () => {
    if (lockingAssessment || isDecisionFinal || isLockedStatus) return;
    if (lockedByAnotherUser) {
      showLockAlert({ reason: 'owned_by_other', lock: activeLock }, 'warning');
      return;
    }
    setLockingAssessment(true);
    const lockResult = await acquireLock();
    setLockingAssessment(false);
    if (!lockResult?.ok) {
      const message = buildLockConflictMessage(lockResult);
      setAlert({
        type: lockResult?.status === 423 ? 'warning' : 'error',
        content: message,
        dismissible: true,
        statusIconAriaLabel: 'Lock conflict'
      });
      return;
    }
    setIsEditingAssessment(true);
    setShowEditConfirmModal(false);
    setShowCancelModal(false);
    setAlert(null);
  }, [acquireLock, activeLock, isDecisionFinal, isLockedStatus, lockedByAnotherUser, lockingAssessment, showLockAlert]);
  const handleRecallAssessmentSubmission = useCallback(async () => {
    if (!caseData?.id) return;
    setIsRecallingAssessment(true);
    setAlert(null);
    try {
      const requestBody = {};
      if (applicationId) {
        requestBody.applicationId = applicationId;
      }
      const versionToken = Number(applicationRowVersionState || caseData?.application_row_version || caseData?.applicationRowVersion || 0);
      if (versionToken > 0) {
        requestBody.expectedRowVersion = versionToken;
      }
      const res = await apiFetch(`/api/cases/${caseData.id}/assessment/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const result = await res.json().catch(() => null);
      if (res.status === 409 && result?.error === 'row_version_conflict') {
        const latestVersion = Number(result?.currentRowVersion || 0);
        if (latestVersion) updateRowVersion(latestVersion);
        if (typeof actions?.refreshCaseData === 'function') {
          await actions.refreshCaseData().catch(() => {});
        }
        setAlert({
          type: 'warning',
          content: 'This assessment changed while you were working. The latest data has been reloaded; review it and try again.',
          dismissible: true,
          statusIconAriaLabel: 'Warning'
        });
        scrollAfterAction();
        return;
      }
      if (!res.ok || !result?.success) {
        throw new Error(result?.message || result?.error || 'Failed to recall assessment submission.');
      }
      const updatedRowVersion = Number(result?.application_row_version || result?.applicationRowVersion || 0);
      if (updatedRowVersion) {
        updateRowVersion(updatedRowVersion);
      }
      if (typeof onCaseUpdate === 'function') {
        onCaseUpdate({
          applicationStatus: result?.applicationStatus || 'in_review',
          application_status: result?.applicationStatus || 'in_review',
          applicationStatusRaw: result?.applicationStatus || 'in_review',
          application_row_version: updatedRowVersion || undefined,
        });
      }
      if (typeof actions?.refreshCaseData === 'function') {
        await actions.refreshCaseData().catch(() => {});
      }
      dispatchSupportingDocsRefresh();
      setLocalAssessmentSubmitted(false);
      setShowNWACSection(false);
      setIsEditingAssessment(false);
      setShowRecallConfirmModal(false);
      setCurrentStep('review');
      setAlert({
        type: 'success',
        content: 'Assessment submission recalled. You can make corrections and submit it again when ready.',
        dismissible: true,
        statusIconAriaLabel: 'Success'
      });
      scrollAfterAction();
    } catch (err) {
      setAlert({
        type: 'error',
        content: err?.message || 'Failed to recall assessment submission.',
        dismissible: true,
        statusIconAriaLabel: 'Error'
      });
      scrollAfterAction();
    } finally {
      setIsRecallingAssessment(false);
    }
  }, [
    actions,
    applicationId,
    applicationRowVersionState,
    caseData?.applicationRowVersion,
    caseData?.application_row_version,
    caseData?.id,
    dispatchSupportingDocsRefresh,
    onCaseUpdate,
    scrollAfterAction,
    updateRowVersion
  ]);
  const ensureLockForOperation = useCallback(async () => {
    if (!application_id) {
      showLockAlert({ reason: 'invalid_application_id' }, 'error');
      return { ok: false, localOwner: false };
    }
    if (lockedByAnotherUser) {
      showLockAlert({ reason: 'owned_by_other', lock: activeLock }, 'warning');
      return { ok: false, localOwner: false };
    }
    if (!lockState.owned) {
      const result = await acquireLock();
      if (!result?.ok) {
        showLockAlert(result, result?.status === 423 ? 'warning' : 'error');
        return { ok: false, localOwner: false };
      }
      return { ok: true, localOwner: result.localOwner };
    }
    if (lockHeldByCurrentUser) {
      refreshLockHeartbeat().catch(() => {});
    }
    return { ok: true, localOwner: false };
  }, [
    acquireLock,
    activeLock,
    application_id,
    lockHeldByCurrentUser,
    lockedByAnotherUser,
    lockState.owned,
    refreshLockHeartbeat,
    showLockAlert
  ]);
  const handleSignDeclaration = useCallback(async () => {
    if (isSigningDeclaration) {
      return;
    }
    const choice = normalizeConflictDeclarationChoice(conflictDeclarationChoice);
    const detailsValue = typeof conflictDeclarationDetails === 'string' ? conflictDeclarationDetails.trim() : '';
    if (conflictDeclarationSigned) {
      const persistedChoice = normalizedPersistedConflictChoice;
      const persistedDetails = typeof persistedConflictDeclarationDetails === 'string'
        ? persistedConflictDeclarationDetails.trim()
        : '';
      const unchangedChoice = choice && choice === persistedChoice;
      const unchangedDetails = choice !== 'conflict' || detailsValue === persistedDetails;
      if (unchangedChoice && unchangedDetails) {
        if (choice === 'conflict') {
          setConflictHoldModalVisible(true);
        }
        return;
      }
    }
    if (!choice) {
      setDeclarationError('Select whether you have a conflict of interest for this case.');
      return;
    }
    if (choice === 'conflict' && !detailsValue) {
      setDeclarationError('Provide details about the potential conflict or bias before proceeding.');
      return;
    }
    setIsSigningDeclaration(true);
    setDeclarationError(null);
    try {
      const lockCheck = await ensureLockForOperation();
      if (!lockCheck.ok) {
        setIsSigningDeclaration(false);
        return;
      }
      const releaseAfterSuccess = lockCheck.localOwner || lockHeldByCurrentUser;
      const versionToken = Number(applicationRowVersionState || caseData?.application_row_version || 0);
      const shouldPromoteToInReview = canonicalApplicationStatus === 'submitted';
      const payload = {
        applicationId: applicationId || null,
        assessment_conflict_declaration_signed: true,
        assessment_conflict_declaration_choice: choice,
        assessment_conflict_declaration_details: choice === 'conflict' ? detailsValue : ''
      };
      if (shouldPromoteToInReview) {
        payload.status = 'in_review';
        payload.applicationStatus = 'in_review';
      }
      if (versionToken > 0) {
        payload.expectedRowVersion = versionToken;
      }
      const res = await apiFetch(`/api/cases/${caseData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json().catch(() => ({}));
      if (res.status === 409 && result?.error === 'row_version_conflict') {
        const latestVersion = Number(result?.currentRowVersion ?? result?.application_row_version);
        if (latestVersion) updateRowVersion(latestVersion);
        if (typeof actions?.refreshCaseData === 'function') {
          try {
            await actions.refreshCaseData();
          } catch (_) {}
        }
        setAlert({
          type: 'warning',
          content: 'Another user updated this case. The latest information has been reloaded; review and try again.',
          dismissible: true,
          statusIconAriaLabel: 'Warning'
        });
        scrollAfterAction();
        if (releaseAfterSuccess) {
          releaseLock({ silent: true }).catch(() => {});
        }
        return;
      }
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to sign conflict of interest declaration.');
      }
      const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
      if (updatedRowVersion) {
        updateRowVersion(updatedRowVersion);
      }
      const signedAtIso = new Date().toISOString();
      setConflictDeclarationSigned(true);
      setConflictDeclarationSignedAt(signedAtIso);
      setPersistedConflictDeclarationChoice(choice);
      setPersistedConflictDeclarationDetails(choice === 'conflict' ? detailsValue : '');
      setConflictDeclarationResolutionOutcome('');
      setConflictDeclarationChoice(choice);
      setConflictDeclarationDetails(choice === 'conflict' ? detailsValue : '');
      if (typeof actions?.refreshCaseData === 'function') {
        try {
          await actions.refreshCaseData();
        } catch (_) {}
      }
      if (typeof onCaseUpdate === 'function') {
        const updates = {
          assessment_conflict_declaration_signed: true,
          assessment_conflict_declaration_signed_at: signedAtIso,
          assessment_conflict_declaration_signed_by: currentUserId || null,
          assessment_conflict_declaration_choice: choice,
          assessment_conflict_declaration_details: choice === 'conflict' ? detailsValue : '',
          assessment_conflict_declaration_resolution_outcome: null,
          assessment_conflict_declaration_resolved_at: null,
          assessment_conflict_declaration_resolution_note: null
        };
        if (shouldPromoteToInReview) {
          updates.status = 'in_review';
          updates.statusRaw = 'in_review';
          updates.applicationStatus = 'in_review';
        }
        onCaseUpdate(updates);
      }
      if (choice === 'conflict') {
        setConflictHoldModalVisible(true);
      } else {
        setCurrentStep(declarationContinueStep);
        setAttemptedSteps({});
      }
      if (releaseAfterSuccess) {
        releaseLock({ silent: true }).catch(() => {});
      }
    } catch (error) {
      setDeclarationError(error?.message || 'Failed to sign the conflict of interest declaration.');
      setAlert({
        type: 'error',
        content: error?.message || 'Failed to sign the conflict of interest declaration.',
        dismissible: true,
        statusIconAriaLabel: 'Error'
      });
      scrollAfterAction();
    } finally {
      setIsSigningDeclaration(false);
    }
  }, [
    actions,
    applicationId,
    caseData?.application_row_version,
    caseData?.id,
    conflictDeclarationSigned,
    conflictDeclarationChoice,
    conflictDeclarationDetails,
    declarationContinueStep,
    persistedConflictDeclarationDetails,
    normalizedPersistedConflictChoice,
    isSigningDeclaration,
    canonicalApplicationStatus,
    ensureLockForOperation,
    lockHeldByCurrentUser,
    onCaseUpdate,
    releaseLock,
    scrollAfterAction,
    updateRowVersion,
    applicationRowVersionState,
    currentUserId
  ]);
  const persistEligibilitySelection = useCallback(async () => {
    if (!caseData?.id || !isEligibilityAdmin) return { ok: true };
    const normalize = value => (value ? String(value).trim().toLowerCase() : '');
    const nextEligibility = assessment.esdcEligibility || '';
    const currentEligibility = caseData?.assessment_esdc_eligibility || '';
    if (!normalize(nextEligibility) && !normalize(currentEligibility)) {
      return { ok: true };
    }
    if (normalize(nextEligibility) === normalize(currentEligibility)) {
      return { ok: true };
    }
    const lockCheck = await ensureLockForOperation();
    if (!lockCheck.ok) return { ok: false };
    const releaseAfterSuccess = lockCheck.localOwner || lockHeldByCurrentUser;
    const versionToken = Number(applicationRowVersionState || caseData?.application_row_version || 0);
    const payload = {
      applicationId: applicationId || null,
      assessment_esdc_eligibility: nextEligibility || null
    };
    if (versionToken > 0) {
      payload.expectedRowVersion = versionToken;
    }
    try {
      const res = await apiFetch(`/api/cases/${caseData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json().catch(() => ({}));
      if (res.status === 423) {
        showLockAlert({ reason: result?.reason || result?.error, lock: result?.lock });
        if (releaseAfterSuccess) {
          releaseLock({ silent: true }).catch(() => {});
        }
        return { ok: false };
      }
      if (res.status === 409) {
        const latestVersion = Number(result?.currentRowVersion ?? result?.application_row_version);
        if (latestVersion) updateRowVersion(latestVersion);
        if (typeof actions?.refreshCaseData === 'function') {
          try {
            await actions.refreshCaseData();
          } catch (_) {}
        }
        setAlert({
          type: 'warning',
          content: 'Another user updated this case. The latest information has been reloaded; review and try again.',
          dismissible: true,
          statusIconAriaLabel: 'Warning'
        });
        scrollAfterAction();
        if (releaseAfterSuccess) {
          releaseLock({ silent: true }).catch(() => {});
        }
        return { ok: false };
      }
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to save eligibility.');
      }
      const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
      if (updatedRowVersion) {
        updateRowVersion(updatedRowVersion);
      }
      if (typeof onCaseUpdate === 'function') {
        const updates = { assessment_esdc_eligibility: nextEligibility || null };
        if (updatedRowVersion) updates.application_row_version = updatedRowVersion;
        onCaseUpdate(updates);
      }
      setInitialAssessment(prev => ({ ...prev, esdcEligibility: nextEligibility || '' }));
      if (typeof actions?.refreshCaseData === 'function') {
        try {
          await actions.refreshCaseData();
        } catch (_) {}
      }
      if (releaseAfterSuccess) {
        releaseLock({ silent: true }).catch(() => {});
      }
      return { ok: true };
    } catch (err) {
      setAlert({
        type: 'error',
        content: err?.message || 'Failed to save eligibility.',
        dismissible: true,
        statusIconAriaLabel: 'Error'
      });
      scrollAfterAction();
      if (releaseAfterSuccess) {
        releaseLock({ silent: true }).catch(() => {});
      }
      return { ok: false };
    }
  }, [
    actions,
    applicationId,
    applicationRowVersionState,
    assessment.esdcEligibility,
    caseData?.assessment_esdc_eligibility,
    caseData?.application_row_version,
    caseData?.id,
    ensureLockForOperation,
    isEligibilityAdmin,
    lockHeldByCurrentUser,
    onCaseUpdate,
    releaseLock,
    scrollAfterAction,
    showLockAlert,
    updateRowVersion
  ]);
  useEffect(() => {
    loadEiVerificationDocuments();
  }, [loadEiVerificationDocuments]);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = event => {
      const targetApplicant = event?.detail?.applicantUserId;
      if (targetApplicant && String(targetApplicant) !== String(applicantUserId || '')) return;
      loadEiVerificationDocuments({ silent: true });
    };
    window.addEventListener(SUPPORTING_DOCS_REFRESH_EVENT, handler);
    return () => window.removeEventListener(SUPPORTING_DOCS_REFRESH_EVENT, handler);
  }, [applicantUserId, loadEiVerificationDocuments]);
  const handleOpenEiVerificationDocument = useCallback(async (item) => {
    const documentId = item?.id;
    if (!documentId) return;
    const pendingWindow = openPendingDocumentWindow();
    setEiVerificationDocsError(null);
    setEiVerificationDocDownloads(prev => ({ ...prev, [documentId]: true }));
    try {
      const res = await apiFetch(`/api/documents/${documentId}/presign-download`);
      if (!res || !res.ok) {
        const payload = await res?.json?.().catch(() => null);
        throw new Error(payload?.message || 'Failed to open EI verification document.');
      }
      const payload = await res.json().catch(() => null);
      if (!payload) throw new Error('Failed to open EI verification document.');
      const targetUrl = payload?.presigned?.url || payload?.url || '';
      if (!targetUrl) throw new Error('Document URL is unavailable.');
      if (!navigateDocumentWindow(pendingWindow, targetUrl)) {
        throw new Error('Document preview was blocked by the browser. Allow pop-ups for PATH and try again.');
      }
    } catch (err) {
      closePendingDocumentWindow(pendingWindow);
      setEiVerificationDocsError(err?.message || 'Failed to open EI verification document.');
    } finally {
      setEiVerificationDocDownloads(prev => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
    }
  }, []);
  const buildValidationMessages = (errors) => {
    const messages = [];
    const seen = new Set();
    const appendMessage = (value) => {
      if (!value) return;
      if (typeof value === 'string') {
        if (!seen.has(value)) {
          seen.add(value);
          messages.push(value);
        }
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(appendMessage);
        return;
      }
      if (typeof value === 'object') {
        Object.values(value).forEach(appendMessage);
      }
    };
    appendMessage(errors);
    return messages;
  };
  const runDocumentChecklist = useCallback(
    async (onContinue, { allowBypass = true, stage = null } = {}) => {
      if (!applicantUserId) {
        setChecklistWarningItems([]);
        setChecklistNextAction(null);
        return true;
      }
      setChecklistCheckError(null);
      setChecklistWarningItems([]);
      setChecklistWarningVisible(false);
      setChecklistNextAction(null);
      setCheckingChecklist(true);
      try {
        const params = new URLSearchParams();
        if (applicationId) {
          params.set('applicationId', applicationId);
        } else if (caseId) {
          params.set('caseId', String(caseId));
        }
        if (stage) {
          params.set('stage', stage);
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        const res = await apiFetch(`/api/applicants/${applicantUserId}/document-checklist${query}`);
        if (!res.ok) {
          throw new Error('Failed to load document checklist.');
        }
        const payload = await res.json().catch(() => ({ items: [], missingRequiredCount: 0 }));
        const items = Array.isArray(payload.items) ? payload.items : [];
        const missing = items.filter(i => i && i.required !== false && i.status !== 'complete');
        if (missing.length > 0) {
          setChecklistWarningItems(missing);
          setChecklistWarningVisible(true);
          if (allowBypass && typeof onContinue === 'function') {
            setChecklistNextAction(() => onContinue);
          } else {
            setChecklistNextAction(null);
          }
          return false;
        }
        setChecklistNextAction(null);
        return true;
      } catch (err) {
        setChecklistCheckError(err?.message || 'Checklist check failed. You may proceed.');
        return true;
      } finally {
        setCheckingChecklist(false);
      }
    },
    [applicantUserId, applicationId, caseId]
  );
  const handleSubmit = async () => {
    if (lockedByAnotherUser) {
      showLockAlert({ reason: 'owned_by_other', lock: activeLock }, 'warning');
      return;
    }
    if (!canEditAssessmentBody) {
      setAlert({
        type: 'warning',
        content: assessmentEditBlockedMessage,
        dismissible: true,
        statusIconAriaLabel: 'Warning'
      });
      scrollAfterAction();
      return;
    }
    setHasSubmitted(true);
    setValidationAlert(null);
    const errors = denyFundingFlowActive
      ? validateAssessmentForDeny(assessment)
      : validateAssessment(assessment);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setValidationAlert(buildValidationMessages(errors));
      // Scroll to first error field
      setTimeout(() => {
        const firstErrorField = document.querySelector('[data-error-focus="true"]');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof firstErrorField.focus === 'function') {
            firstErrorField.focus();
          }
        }
      }, 0);
      return;
    }

    const submitAssessment = async ({
      preserveExistingApplicationForm = false,
      preserveExistingFinancialOverview = false
    } = {}) => {
      setIsSubmittingAssessment(true);
      try {
        // --- POST-VALIDATION WORKFLOW ---
        const lockCheck = await ensureLockForOperation();
        if (!lockCheck.ok) return;
        const releaseAfterSuccess = lockCheck.localOwner || lockHeldByCurrentUser;
        // Pull the freshest row_version before building the submit payload to avoid optimistic conflicts.
        let latestRowVersion = applicationRowVersionState;
        try {
          const latest = typeof actions?.refreshCaseData === 'function' ? await actions.refreshCaseData() : null;
          const refreshedVersion = Number(latest?.application_row_version || latest?.applicationRowVersion || 0);
          if (refreshedVersion > 0) {
            latestRowVersion = refreshedVersion;
            updateRowVersion(refreshedVersion);
            if (typeof onRowVersionUpdate === 'function') {
              onRowVersionUpdate(refreshedVersion);
            }
          }
        } catch (_) {}

        // 1. Always stamp assessment date on submit.
        const dateOfAssessment = formatDate(new Date());

        // 2. Save assessment (PUT /api/cases/:id)
        const versionToken = Number(latestRowVersion || caseData?.application_row_version || 0);
        let nextApplicationStatus = caseData?.applicationStatus || caseData?.status || null;
        const payload = {
          ...buildAssessmentPayload(),
          dateOfAssessment,
          assessment_date_of_assessment: dateOfAssessment,
          assessment_submit_action: true,
        };
        if (!APPLICATION_FINAL_STATUSES.has(canonicalApplicationStatus)) {
          payload.status = 'intake';
          payload.applicationStatus = 'pending_approval';
          nextApplicationStatus = 'pending_approval';
        }
        const requestBody = { ...payload };
        if (preserveExistingApplicationForm) {
          requestBody.assessment_preserve_existing_application_form = true;
        }
        if (preserveExistingFinancialOverview) {
          requestBody.assessment_preserve_existing_financial_overview = true;
        }
        if (versionToken > 0) {
          requestBody.expectedRowVersion = versionToken;
        }
        try {
          // Save assessment
          const res = await apiFetch(`/api/cases/${caseData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
          let result = null;
          try {
            result = await res.json();
          } catch (_) {
            result = null;
          }
          if (res.status === 423) {
            showLockAlert({ reason: result?.reason || result?.error, lock: result?.lock });
            setIsEditingAssessment(false);
            releaseLock({ silent: true }).catch(() => {});
            return;
          }
          if (res.status === 409) {
            const latestVersion = Number(result?.currentRowVersion ?? result?.application_row_version);
            if (latestVersion) updateRowVersion(latestVersion);
            if (typeof actions?.refreshCaseData === 'function') {
              try {
                await actions.refreshCaseData();
              } catch (_) {}
            }
            setIsEditingAssessment(false);
            setAlert({
              type: 'warning',
              content: 'Another user updated this assessment. The latest data has been reloaded; review it and try again.',
              dismissible: true,
              statusIconAriaLabel: 'Warning'
            });
            scrollAfterAction();
            releaseLock({ silent: true }).catch(() => {});
            return;
          }
          if (handlePostingContextErrors(result)) {
            scrollAfterAction();
            return;
          }
          if (!res.ok || !result?.success) {
            throw new Error(result?.error || 'Failed to save assessment.');
          }
          const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
          if (updatedRowVersion) {
            updateRowVersion(updatedRowVersion);
          }

          // 3. Reload caseData (to update status, etc.)
          const fallbackUpdates = {
            status: payload.status ?? caseData?.status ?? null,
            statusRaw: payload.status ?? caseData?.status ?? null,
            applicationStatus: payload.applicationStatus ?? nextApplicationStatus ?? caseData?.applicationStatus ?? null,
          };
          const nextReviewWorkflow = result?.reviewWorkflow || result?.review_workflow || null;
          if (nextReviewWorkflow) {
            fallbackUpdates.reviewWorkflow = nextReviewWorkflow;
            fallbackUpdates.review_workflow = nextReviewWorkflow;
            fallbackUpdates.twoStepReviewEnabled = true;
            fallbackUpdates.two_step_review_enabled = true;
          }
          if (updatedRowVersion) {
            fallbackUpdates.application_row_version = updatedRowVersion;
          }
          if (typeof onCaseUpdate === 'function') {
            onCaseUpdate(fallbackUpdates);
          }
          if (typeof actions?.refreshCaseData === 'function') {
            try {
              await actions.refreshCaseData();
            } catch (_) {
              // ignore refresh errors, fallback already applied
            }
          }
          dispatchSupportingDocsRefresh();
          setIsEditingAssessment(false);
          setShowNWACSection(true);
          setLocalAssessmentSubmitted(true);
          setFieldErrors({});
          setHasSubmitted(false);
          scrollAfterAction();
          setAlert({
            type: 'success',
            content: nextReviewWorkflow || twoStepReviewEnabled
              ? 'Assessment submitted to Regional Manager review.'
              : 'Assessment submitted successfully. Application status moved to Pending Decision. A Decision Maker must record the final outcome.',
            dismissible: true,
            statusIconAriaLabel: 'Success'
          });
          setValidationAlert(null);
          if (denyFundingFlowActive) {
            setDenyFundingFlowActive(false);
            setPendingDecisionJump(true);
          }
          if (releaseAfterSuccess) {
            releaseLock({ silent: true }).catch(() => {});
          }
        } catch (err) {
          setAlert({ type: 'error', content: err.message || 'Failed to submit assessment.', dismissible: true, statusIconAriaLabel: 'Error' });
          scrollAfterAction();
        }
      } finally {
        setIsSubmittingAssessment(false);
      }
    };

    const submitAssessmentWithConflictCheck = async () => {
      setIsSubmittingAssessment(true);
      try {
        const conflicts = await inspectAssessmentSubmitDocumentConflicts();
        if (conflicts.length > 0) {
          pendingAssessmentSubmitRef.current = submitAssessment;
          setSubmitDocumentConflicts(conflicts);
          setSubmitDocumentRetention(
            conflicts.reduce((acc, conflict) => {
              acc[conflict.documentType] = true;
              return acc;
            }, {})
          );
          setSubmitDocumentConflictModalVisible(true);
          return;
        }
      } catch (err) {
        setAlert({
          type: 'error',
          content: err?.message || 'Could not verify whether uploaded Application form or Financial overview files already exist. Review Supporting Documents and try again.',
          dismissible: true,
          statusIconAriaLabel: 'Error'
        });
        scrollAfterAction();
        return;
      } finally {
        setIsSubmittingAssessment(false);
      }

      await submitAssessment();
    };

    const checklistOk = await runDocumentChecklist(submitAssessmentWithConflictCheck, {
      allowBypass: denyFundingFlowActive,
      stage: SUBMIT_ASSESSMENT_STAGE
    });
    if (!checklistOk) return;
    await submitAssessmentWithConflictCheck();
  };

  const handleLetterBodyChange = useCallback(
    ({ detail }) => {
      if (!activeLetterKey) return;
      const value = detail.value || '';
      setLetterBody(value);
      letterBodyDirtyRef.current = true;
      setLetterDrafts(prev => {
        const current = prev?.[activeLetterKey] || buildEmptyDecisionLetterDraft();
        const parsed = parseLetterBodyToDraft(value, current);
        return { ...prev, [activeLetterKey]: parsed };
      });
    },
    [activeLetterKey]
  );

  const persistLetterContext = useCallback(
    async ({ silent = false, contextUpdates = null, letterDraftsOverride = null } = {}) => {
      if (!caseId) return { ok: false };
      const lockCheck = await ensureLockForOperation();
      if (!lockCheck.ok) return { ok: false };
      const versionToken = Number(applicationRowVersionState || caseData?.application_row_version || 0);
      const baseContext = caseData?.caseContext && typeof caseData.caseContext === 'object' ? caseData.caseContext : {};
      const nextDecisionLetterSent =
        (contextUpdates && contextUpdates.decisionLetterSent) ||
        (decisionLetterSent && Object.keys(decisionLetterSent).length ? decisionLetterSent : null);
      const effectiveLetterDrafts = letterDraftsOverride || letterDrafts;
      const updatedContext = buildApplicationAssessmentCaseContext(baseContext, applicationId, {
        ...(contextUpdates || {}),
        ...(nextDecisionLetterSent ? { decisionLetterSent: nextDecisionLetterSent } : {}),
        decisionLetterDrafts: effectiveLetterDrafts
      });
      const payload = {
        applicationId: applicationId || null,
        caseContext: updatedContext
      };
      if (versionToken > 0) {
        payload.expectedRowVersion = versionToken;
      }
      const res = await apiFetch(`/api/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const latestVersion = Number(result?.currentRowVersion ?? result?.application_row_version);
        if (latestVersion) updateRowVersion(latestVersion);
        if (!silent) {
          setAlert({
            type: 'warning',
            content: 'Another user updated this case. The latest data has been reloaded; review it and try again.',
            dismissible: true,
            statusIconAriaLabel: 'Warning'
          });
        }
        return { ok: false };
      }
      if (!res.ok || !result?.success) {
        if (!silent) {
          setAlert({
            type: 'error',
            content: result?.message || result?.error || 'Failed to save the letter draft.',
            dismissible: true,
            statusIconAriaLabel: 'Error'
          });
        }
        return { ok: false };
      }
      const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
      if (updatedRowVersion) updateRowVersion(updatedRowVersion);
      return { ok: true, updatedRowVersion, caseContext: updatedContext };
    },
    [
      applicationRowVersionState,
      applicationId,
      caseData?.application_row_version,
      caseData?.caseContext,
      caseId,
      ensureLockForOperation,
      decisionLetterSent,
      letterDrafts,
      updateRowVersion
    ]
  );

  const persistLetterDraft = useCallback(
    async ({ silent = false, letterDraftsOverride = null } = {}) => {
      const effectiveLetterDrafts = letterDraftsOverride || letterDrafts;
      const assessmentContext = getApplicationAssessmentContext(caseData?.caseContext, applicationId);
      const denialReasonCode = activeLetterKey === 'denial'
        ? String(denialReasonChoice || assessmentContext?.[FUNDING_DECISION_REASON_CODE_KEY] || '').trim()
        : '';
      const denialReasonExplanationValue = activeLetterKey === 'denial'
        ? String(denialReasonExplanation || assessmentContext?.[FUNDING_DECISION_REASON_EXPLANATION_KEY] || '').trim()
        : '';
      const contextUpdates = activeLetterKey === 'approval'
        ? {
            decisionLetterPackDrafts: {
              ...(savedApprovalLetterPackDrafts || {}),
              approval: buildApprovalLetterPackDraft()
            }
          }
        : activeLetterKey === 'denial'
          ? {
              [FUNDING_DECISION_REASON_CODE_KEY]: denialReasonCode || null,
              [FUNDING_DECISION_REASON_LABEL_KEY]: denialReasonCode
                ? (DENIAL_REASON_LABEL_MAP[denialReasonCode] || null)
                : null,
              [FUNDING_DECISION_REASON_EXPLANATION_KEY]: denialReasonExplanationValue || null
            }
        : null;
      const result = await persistLetterContext({ silent, contextUpdates, letterDraftsOverride: effectiveLetterDrafts });
      if (!result.ok) return result;
      if (activeLetterKey === 'approval' && contextUpdates?.decisionLetterPackDrafts) {
        setSavedApprovalLetterPackDrafts(contextUpdates.decisionLetterPackDrafts);
      }
      setInitialLetterDrafts(effectiveLetterDrafts);
      if (!silent) {
        setAlert({
          type: 'success',
          content: activeLetterKey === 'approval' ? 'Letter drafts saved.' : 'Letter draft saved.',
          dismissible: true,
          statusIconAriaLabel: 'Success'
        });
      }
      return result;
    },
    [
      activeLetterKey,
      applicationId,
      buildApprovalLetterPackDraft,
      caseData?.caseContext,
      denialReasonChoice,
      denialReasonExplanation,
      letterDrafts,
      persistLetterContext,
      savedApprovalLetterPackDrafts
    ]
  );

  const openDenialReasonModal = () => {
    setDenialReasonErrors({});
    setDenialReasonModalVisible(true);
  };
  const handleConfirmDenialReason = async () => {
    const errors = {};
    if (!denialReasonChoice) {
      errors.reason = 'Select a primary denial reason.';
    }
    const explanationValue = denialReasonExplanation.trim();
    if (!explanationValue) {
      errors.explanation = 'Provide a brief explanation for the selected reason.';
    }
    setDenialReasonErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setDenialReasonModalVisible(false);
    await generateLetterDraft({
      denialReasonChoice,
      denialReasonExplanation: explanationValue
    });
  };
  const generateLetterDraft = async ({ denialReasonChoice, denialReasonExplanation } = {}) => {
    if (!activeLetterKey) {
      setDraftingLetterError('Select a decision outcome before generating a draft.');
      return;
    }
    const isDenialDraft = activeLetterKey === 'denial';
    const decisionDate = formatDate(new Date());
    setDraftingLetter(true);
    setDraftingLetterError(null);
    letterBodyDirtyRef.current = false;
    let denialTemplateDraft = null;
    try {
      const interventions = Array.isArray(proposedInterventions) ? proposedInterventions : [];
      const multiInterventions = interventions.length > 1;
      const primary = multiInterventions ? null : (interventions[0] || null);
      const costLines = interventions.flatMap(intervention =>
        Array.isArray(intervention?.costLines) ? intervention.costLines : []
      );
      const totalFunding = Number.isFinite(overallCostTotal) && overallCostTotal > 0 ? overallCostTotal : null;
      if (!isDenialDraft) {
        const submissionDate = (() => {
          const raw =
            caseData?.submitted_at ||
            caseData?.application?.submitted_at ||
            caseData?.application?.created_at ||
            caseData?.created_at ||
            null;
          return formatDate(raw);
        })();
        const requestedProgramNameFallback = String(primary?.programName || '').trim();
        const requestedInstitutionFallback = String(primary?.institution || '').trim();
        const requestedInterventionLabelFallback = String(resolveInterventionLabel(primary?.code) || '').trim();
        const approvalLetterHasFunding = costLines.some(costLineHasPositiveFundingAmount) || Boolean(totalFunding);
        const requestPhraseMode = (() => {
          if (!approvalLetterHasFunding) return 'intervention';
          if (interventions.length > 1) return 'support';
          if (requestedProgramNameFallback || isEducationCode(primary?.code)) return 'pursuit';
          return 'support';
        })();
        const requestPhrase = (() => {
          if (!approvalLetterHasFunding) {
            if (interventions.length > 1) {
              return 'for the approved interventions in your plan';
            }
            if (requestedProgramNameFallback && requestedInstitutionFallback) {
              return `for ${requestedProgramNameFallback} at ${requestedInstitutionFallback}`;
            }
            if (requestedProgramNameFallback) {
              return `for ${requestedProgramNameFallback}`;
            }
            if (requestedInstitutionFallback && isEducationCode(primary?.code)) {
              return `for training at ${requestedInstitutionFallback}`;
            }
            if (requestedInstitutionFallback) {
              return `for ${requestedInstitutionFallback}`;
            }
            if (requestedInterventionLabelFallback) {
              return `for ${requestedInterventionLabelFallback}`;
            }
            return 'for the approved intervention in your plan';
          }
          if (interventions.length > 1) {
            return 'to receive support for the approved interventions in your plan';
          }
          if (requestedProgramNameFallback && requestedInstitutionFallback) {
            return `to pursue ${requestedProgramNameFallback} at ${requestedInstitutionFallback}`;
          }
          if (requestedProgramNameFallback) {
            return `to pursue ${requestedProgramNameFallback}`;
          }
          if (requestedInstitutionFallback && isEducationCode(primary?.code)) {
            return `to pursue training at ${requestedInstitutionFallback}`;
          }
          if (requestedInstitutionFallback) {
            return `to receive support for training at ${requestedInstitutionFallback}`;
          }
          if (requestedInterventionLabelFallback) {
            const label = requestedInterventionLabelFallback.toLowerCase();
            return requestPhraseMode === 'pursuit'
              ? `to pursue ${label}`
              : `to receive support for ${label}`;
          }
          return 'to receive Indigenous Skills and Employment Training (ISET) support';
        })();
        const toReadablePaymentType = (value) => {
          const raw = String(value || '').trim();
          if (!raw) return '';
          return raw.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
        };
        const normalizeSpace = (value) => String(value || '').trim().replace(/\s+/g, ' ');
        const toSentenceCaseLabel = (value) => {
          const normalized = normalizeSpace(value);
          if (!normalized) return '';
          return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
        };
        const getCostLineLabel = (type) => {
          const normalizedType = normalizePaymentTypeCode(type);
          const direct = normalizedType ? paymentTypeLabelLookup.get(String(normalizedType)) : '';
          const plainDirect = String(direct || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
          if (plainDirect) return toSentenceCaseLabel(plainDirect);
          const supportLabel = getSupportLabelFromPaymentType(normalizedType || type);
          if (supportLabel) return toSentenceCaseLabel(supportLabel);
          const fallback = toReadablePaymentType(normalizedType || type);
          return toSentenceCaseLabel(fallback);
        };
        const resolveOccurrences = (recurrence = {}, intervention = null) => {
          const raw = recurrence.occurrences;
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed > 0) return parsed;
          const startDate = formatDate(recurrence.startDate) || formatDate(intervention?.startDate);
          const endDate = formatDate(recurrence.endDate) || formatDate(intervention?.endDate);
          if (startDate && endDate) {
            return autoOccurrencesFromDates(startDate, endDate, 'monthly') || null;
          }
          return null;
        };
        const resolvePayeePhrase = (line) => {
          const payeeName = normalizeSpace(line?.payee?.name);
          const payeeTypeKey = normalizePayeeTypeKey(
            line?.payee?.type || deriveDefaultPayeeTypeForCostLine(line?.type)
          );
          const applicantNameNormalized = normalizeSpace(applicantName || '').toLowerCase();
          const payeeNameNormalized = payeeName.toLowerCase();
          const payeeIsApplicant =
            payeeTypeKey === 'participantclient' ||
            payeeTypeKey === 'client' ||
            (payeeNameNormalized && applicantNameNormalized && payeeNameNormalized === applicantNameNormalized);
          if (payeeIsApplicant) return 'you';
          if (payeeName) return payeeName;
          const payeeTarget = PAYEE_TYPE_DETAIL_TARGET_BY_KEY[payeeTypeKey] || '';
          if (payeeTarget) return `the ${payeeTarget}`;
          return 'the approved payee';
        };
        const resolvePayableDateLabel = (line, intervention = null) => {
          const recurrence = line?.recurrence && typeof line.recurrence === 'object' ? line.recurrence : {};
          const submissionTiming = getSubmissionTimingForType(line?.type);
          const interventionStart = formatDate(intervention?.startDate);
          const interventionEnd = formatDate(intervention?.endDate);
          const recurrenceStart = formatDate(recurrence.startDate);
          const recurrenceEnd = formatDate(recurrence.endDate);
          const explicitPayableDate = formatDate(
            line?.payableDate ||
              line?.payable_date ||
              line?.paymentDate ||
              line?.payment_date ||
              line?.dateDue ||
              line?.date_due
          );
          let payableDate = '';
          if (submissionTiming === SUBMISSION_TIMING_INTERVENTION_START) {
            payableDate = interventionStart || recurrenceStart || explicitPayableDate;
          } else if (submissionTiming === SUBMISSION_TIMING_INTERVENTION_END) {
            payableDate = interventionEnd || recurrenceEnd || explicitPayableDate;
          } else if (submissionTiming === SUBMISSION_TIMING_RECURRENCE_SCHEDULE) {
            payableDate = recurrenceStart || explicitPayableDate || interventionStart || interventionEnd;
          } else if (submissionTiming === SUBMISSION_TIMING_MANUAL_TRIGGER) {
            payableDate = explicitPayableDate;
          }
          return payableDate ? formatShortDate(payableDate) : '';
        };
        const buildCostLineDetail = (line, intervention = null) => {
          if (!line?.type) return null;
          const label = getCostLineLabel(line.type);
          if (!label) return null;
          const amount = parseCurrencyToNumber(line.amount);
          if (!(amount > 0)) return null;
          const amountText = formatCurrencyForLetter(amount);
          const payeePhrase = resolvePayeePhrase(line);
          const payableDateLabel = resolvePayableDateLabel(line, intervention);
          const recurrenceMode = getRecurrenceModeForType(line?.type);
          const recurrenceEnabled = Boolean(line?.recurrence?.enabled) || recurrenceMode === 'required';
          if (recurrenceEnabled) {
            const occurrences = resolveOccurrences(line.recurrence || {}, intervention);
            let detail = `${label}: ${amountText} payable to ${payeePhrase}`;
            if (occurrences && occurrences > 0) {
              detail += ` in ${occurrences} monthly installment${occurrences === 1 ? '' : 's'}`;
            } else {
              detail += ' in monthly installments';
            }
            if (payableDateLabel) {
              detail += ` after ${payableDateLabel}`;
            }
            if (line.type === 'LivingAllowance') {
              detail += ' on production of an attendance report';
            }
            return `${detail}.`;
          }
          let detail = `${label}: ${amountText} payable to ${payeePhrase}`;
          if (payableDateLabel) {
            detail += ` after ${payableDateLabel}`;
          }
          return `${detail}.`;
        };
        const buildInterventionApprovalSummary = (intervention, index) => {
          const parts = [
            String(resolveInterventionLabel(intervention?.code) || '').trim(),
            String(intervention?.programName || '').trim(),
            String(intervention?.institution || '').trim()
          ]
            .filter(Boolean)
            .filter((value, valueIndex, list) =>
              list.findIndex(candidate => candidate.toLowerCase() === value.toLowerCase()) === valueIndex
            );
          const summary = parts.join(' — ') || `Intervention ${index + 1}`;
          const termLabel = formatInterventionDates(intervention?.startDate, intervention?.endDate);
          return termLabel && termLabel !== '—'
            ? `${summary} (${termLabel})`
            : summary;
        };
        const fundingLineItems = interventions.flatMap(intervention => {
          const costLines = Array.isArray(intervention?.costLines) ? intervention.costLines : [];
          return costLines.map(line => buildCostLineDetail(line, intervention)).filter(Boolean);
        });
        const openingTemplate = approvalLetterHasFunding
          ? 'I am writing to let you know that I have assessed your application{{REFERENCE_CLAUSE}} for funding to the Native Women\'s Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program{{SUBMISSION_CLAUSE}}, {{REQUEST_PHRASE}}.'
          : 'I am writing to let you know that I have assessed your application{{REFERENCE_CLAUSE}} submitted to the Native Women\'s Association of Canada (NWAC) through its Indigenous Skills and Employment Training (ISET) Program{{SUBMISSION_CLAUSE}}, {{REQUEST_PHRASE}}.';
        const closingTemplate = approvalLetterHasFunding
          ? 'If you have any questions, please do not hesitate to contact me directly. I look forward to supporting you through your ISET intervention.'
          : 'If you have any questions about your approved intervention or next steps, please do not hesitate to contact me directly. I look forward to supporting you through your ISET intervention.';
        const aiContext = {
          request_mode: requestPhraseMode,
          has_multiple_interventions: interventions.length > 1,
          approval_mode: approvalLetterHasFunding ? 'funded_intervention' : 'intervention_only'
        };
        const hasRequiredTokens = (value) =>
          typeof value === 'string' &&
          value.includes('{{REFERENCE_CLAUSE}}') &&
          value.includes('{{SUBMISSION_CLAUSE}}') &&
          value.includes('{{REQUEST_PHRASE}}');
        let openingParagraphTemplate = openingTemplate;
        let closingParagraph = closingTemplate;
        try {
          const prompt = `You are editing approved ${approvalLetterHasFunding ? 'funding' : 'intervention'} letters for case managers.

Rewrite the templates for clarity and professionalism while keeping facts unchanged.
Return JSON only with keys: opening_paragraph, closing_sentence.

Hard requirements:
- Keep placeholders exactly as written: {{REFERENCE_CLAUSE}}, {{SUBMISSION_CLAUSE}}, {{REQUEST_PHRASE}}.
- Do not add new placeholders.
- Do not add any personal data.
- Keep a formal, supportive, applicant-facing tone.
- Keep each sentence concise.

Opening template:
${openingTemplate}

Closing template:
${closingTemplate}

Context:
${JSON.stringify(aiContext, null, 2)}`;
          const resp = await apiFetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: 'You improve letter copy. Respond only with JSON.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.2
            })
          });
          if (resp.ok) {
            const data = await resp.json().catch(() => ({}));
            const content = data?.choices?.[0]?.message?.content || '';
            const parsed = extractJsonFromAi(content);
            const aiOpening = typeof parsed?.opening_paragraph === 'string' ? parsed.opening_paragraph.trim() : '';
            const aiClosing = typeof parsed?.closing_sentence === 'string' ? parsed.closing_sentence.trim() : '';
            if (hasRequiredTokens(aiOpening)) {
              openingParagraphTemplate = aiOpening;
            }
            if (aiClosing) {
              closingParagraph = aiClosing;
            }
          }
        } catch (_) {
          // Keep deterministic templates when AI is unavailable.
        }
        const resolvedOpeningParagraph = openingParagraphTemplate
          .replace(/\{\{REFERENCE_CLAUSE\}\}/g, trackingReference ? ` (reference ${trackingReference})` : '')
          .replace(/\{\{SUBMISSION_CLAUSE\}\}/g, submissionDate ? ` submitted on ${submissionDate}` : '')
          .replace(/\{\{REQUEST_PHRASE\}\}/g, requestPhrase)
          .replace(/[ \t]{2,}/g, ' ')
          .replace(/\s+,/g, ',')
          .replace(/\s+\./g, '.')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        const recipientName = String(applicantSalutationName || '').trim() || 'Client';
        const approvalIntro = [`Dear ${recipientName},`, '', resolvedOpeningParagraph].join('\n');
        let fundingParagraph = 'I have approved funding for your eligible supports under this intervention.';
        if (!approvalLetterHasFunding) {
          if (interventions.length > 1) {
            const lines = ['I have approved the following interventions in your plan:'];
            interventions.forEach((intervention, index) => {
              lines.push(`- ${buildInterventionApprovalSummary(intervention, index)}`);
            });
            fundingParagraph = lines.join('\n');
          } else {
            fundingParagraph = `I have approved your intervention plan for ${buildInterventionApprovalSummary(primary || interventions[0] || {}, 0)}.`;
          }
        } else if (fundingLineItems.length) {
          const lines = ['I have approved the following funding amounts:'];
          fundingLineItems.forEach(detail => lines.push(`- ${detail}`));
          fundingParagraph = lines.join('\n');
        }
        const agreementParagraph = approvalLetterHasFunding
          ? 'I have attached the Client Funding Agreement for your review, along with a Banking Details form. Please review and complete the attachments at your earliest convenience so we can proceed with your funding deposit.'
          : 'Because this approval does not include funded cost lines, there are no funding forms for you to complete at this stage.';
        setLetterDrafts(prev => {
          const current = prev?.[activeLetterKey] || buildEmptyDecisionLetterDraft();
          return {
            ...prev,
            [activeLetterKey]: {
              ...current,
              decision_date: decisionDate,
              letter_title: 'Letter of Approval',
              decision_label: 'Approved',
              decision_intro: approvalIntro,
              decision_reason: [fundingParagraph, agreementParagraph, closingParagraph].filter(Boolean).join('\n\n'),
              next_step_1: '',
              next_step_2: ''
            }
          };
        });
        return;
      }
      const denialReasonCode = String(denialReasonChoice || '').trim();
      const denialExplanation = typeof denialReasonExplanation === 'string'
        ? denialReasonExplanation.trim()
        : '';
      const optionsForwardByReason = {
        documentation_missing: ['Provide the required documentation and request a reassessment.'],
        training_not_aligned: ['Reapply when your selected program aligns more directly with your employment goal and labour-market outcomes.'],
        already_educated_employable: ['Explore alternate funding pathways such as scholarships, grants, or bursaries for advanced studies.'],
        institution_not_eligible: ['Reapply with a comparable program offered through a publicly funded or provincially recognized institution.'],
        duplicate_funding: ['Contact your case manager if your existing funding situation changes and reassessment is needed.'],
        funding_unavailable: ['Contact your case manager to review other available supports or timing options.'],
        eligibility_not_met: ['You may reapply if your circumstances change and eligibility criteria are met.']
      };
      const optionsForward = optionsForwardByReason[denialReasonCode] || [];
      const partialServicesAvailable = denialReasonCode === 'documentation_missing'
        ? [
            'Career and client assessments',
            'Access to labour-market information and career exploration support',
            'Referrals to other programs and community agencies',
            'Resume and cover-letter support'
          ]
        : [];
      const normalizedOtherFunding = normalizeOtherFundingDetails({
        involved: assessment.otherFundingInvolved,
        sources: assessment.otherFundingSources,
        nwacCoverage: assessment.otherFundingNwacCoverage,
        notes: assessment.otherFundingNotes
      });
      const otherFundingSummary = buildOtherFundingSummary(normalizedOtherFunding);
      const requestedProgramName = primary?.programName || null;
      const requestedInstitution = primary?.institution || null;
      const applicantEmploymentGoal = String(
        assessment.employmentGoals ||
          normalizeAnswerValue(readApplicationAnswer(['long-term-goal', 'long_term_goal', 'longTermGoal'])) ||
          ''
      ).trim() || null;
      denialTemplateDraft = buildDenialTemplateDraftForReason({
        reasonCode: denialReasonCode,
        requestedProgramName,
        requestedInstitution,
        employmentGoal: applicantEmploymentGoal,
        denialExplanation,
        optionsForward,
        partialServicesAvailable,
        otherFundingSummary
      });
      setLetterDrafts(prev => {
        const current = prev?.[activeLetterKey] || buildEmptyDecisionLetterDraft();
        return {
          ...prev,
          [activeLetterKey]: {
            ...current,
            decision_date: decisionDate,
            letter_title: 'Letter of Denial',
            decision_label: 'Denied',
            decision_intro: denialTemplateDraft.decision_intro || current.decision_intro,
            decision_reason: denialTemplateDraft.decision_reason || current.decision_reason,
            next_step_1: '',
            next_step_2: ''
          }
        };
      });
      return;
    } catch (err) {
      if (isDenialDraft && denialTemplateDraft) {
        setLetterDrafts(prev => {
          const current = prev?.[activeLetterKey] || buildEmptyDecisionLetterDraft();
          return {
            ...prev,
            [activeLetterKey]: {
              ...current,
              decision_date: decisionDate,
              letter_title: 'Letter of Denial',
              decision_label: 'Denied',
              decision_intro: denialTemplateDraft?.decision_intro || current.decision_intro,
              decision_reason: denialTemplateDraft?.decision_reason || current.decision_reason,
              next_step_1: '',
              next_step_2: ''
            }
          };
        });
        setDraftingLetterError('A template-based denial draft was applied after a drafting error.');
      } else {
        setDraftingLetterError(err?.message || 'Failed to generate a letter draft.');
      }
    } finally {
      setDraftingLetter(false);
    }
  };
  const handleGenerateLetterDraft = async () => {
    if (!activeLetterKey) {
      setDraftingLetterError('Select a decision outcome before generating a draft.');
      return;
    }
    if (activeLetterKey === 'denial') {
      openDenialReasonModal();
      return;
    }
    setApprovalLetterPackGenerated(true);
    setSavedApprovalLetterPackDrafts(prev => ({
      ...(prev || {}),
      approval: {
        generated_at: new Date().toISOString(),
        institutionLetters: institutionApprovalLetters,
        coFunderLetters: coFunderApprovalLetters,
        loanProviderLetters: loanProviderApprovalLetters
      }
    }));
    await generateLetterDraft();
  };

  const markDecisionLetterSent = useCallback(
    async (letterKey) => {
      if (!letterKey) return { ok: false };
      const timestamp = new Date().toISOString();
      const existing = decisionLetterSent && typeof decisionLetterSent === 'object' ? decisionLetterSent : {};
      const nextSent = { ...existing, [letterKey]: timestamp };
      setDecisionLetterSent(nextSent);
      const baseSent = getDecisionLetterSent(caseData?.caseContext, applicationId) || {};
      const mergedSent = { ...baseSent, ...nextSent };
      const result = await persistLetterContext({
        silent: true,
        contextUpdates: { decisionLetterSent: mergedSent }
      });
      if (!result.ok) {
        setAlert({
          type: 'warning',
          content: 'Decision letter sent, but the case record was not updated. Refresh to ensure the Funding forms and signatures step remains available.',
          dismissible: true,
          statusIconAriaLabel: 'Warning'
        });
      }
      return { ok: result.ok, sentAt: timestamp, updatedRowVersion: result.updatedRowVersion || null };
    },
    [applicationId, caseData?.caseContext, decisionLetterSent, persistLetterContext]
  );

  const handleSendDecisionLetter = async () => {
    if (!caseId || !activeLetterKey) {
      setSendingLetterError('Select a decision outcome before sending the letter.');
      return { ok: false };
    }
    if (activeLetterKey === 'denial') {
      const assessmentContext = getApplicationAssessmentContext(caseData?.caseContext, applicationId);
      const effectiveDenialReasonCode = String(
        denialReasonChoice || assessmentContext?.[FUNDING_DECISION_REASON_CODE_KEY] || ''
      ).trim();
      if (!effectiveDenialReasonCode) {
        setSendingLetterError('Select a denial reason before sending the letter.');
        return { ok: false };
      }
    }
    if (!letterWorkflowId) {
      setSendingLetterError('Letter workflow is not configured yet.');
      return { ok: false };
    }
    setSendingLetter(true);
    setSendingLetterError(null);
    try {
      const sendDecisionDate = formatDate(new Date());
      const refreshedActiveLetterDraft = {
        ...activeLetterDraft,
        decision_date: sendDecisionDate
      };
      const refreshedLetterDrafts = {
        ...(letterDrafts || {}),
        [activeLetterKey]: refreshedActiveLetterDraft
      };
      setLetterDrafts(refreshedLetterDrafts);
      const saved = await persistLetterDraft({ silent: true, letterDraftsOverride: refreshedLetterDrafts });
      if (!saved.ok) {
        throw new Error('Save the letter draft before sending.');
      }
      const subject =
        activeLetterKey === 'approval'
          ? 'Letter of Approval'
          : 'Letter of Denial';
      const includeNextSteps =
        activeLetterKey === 'denial' && Boolean(refreshedActiveLetterDraft.next_step_1 || refreshedActiveLetterDraft.next_step_2);
      const messageBody = buildLetterBodyFromDraft(refreshedActiveLetterDraft, {
        includeNextSteps,
        includeDecisionLabel: false,
        includeReasonLabel: false
      });
      const body =
        messageBody ||
        (activeLetterKey === 'approval'
          ? 'Please review your approval letter in the portal.'
          : 'Please review your decision letter in the portal.');
      const payload = {
        subject,
        body,
        urgent: false,
        toDisplayName: applicantName || 'Applicant',
        fromDisplayName: currentUserName || 'Case Worker',
        attachments: [{ workflow_id: letterWorkflowId }]
      };
      if (applicationId) {
        payload.applicationId = applicationId;
      }
      const response = await apiFetch(`/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        let detail = '';
        try {
          const data = await response.json();
          if (data && typeof data === 'object') {
            if (data.error === 'funding_forms_workflows_missing' && Array.isArray(data.missing) && data.missing.length) {
              detail = `Required funding-form workflows are missing: ${data.missing.join(', ')}.`;
            } else {
              detail = data.message || data.error || '';
            }
          }
        } catch (_) {
          detail = await response.text().catch(() => '');
        }
        throw new Error(detail || 'Failed to send the decision letter.');
      }
      setAlert({
        type: 'success',
        content: 'Decision letter sent to the applicant.',
        dismissible: true,
        statusIconAriaLabel: 'Success'
      });
      dispatchSupportingDocsRefresh();
      await loadDocumentChecklist();
      const sentResult = await markDecisionLetterSent(activeLetterKey);
      return { ok: true, updatedRowVersion: sentResult.updatedRowVersion || null };
    } catch (err) {
      setSendingLetterError(err?.message || 'Failed to send the decision letter.');
      return { ok: false, error: err };
    } finally {
      setSendingLetter(false);
    }
  };

  const handleSave = async ({ silent = false } = {}) => {
    if (lockedByAnotherUser) {
      if (!silent) {
        showLockAlert({ reason: 'owned_by_other', lock: activeLock }, 'warning');
      }
      return { ok: false, reason: 'locked' };
    }
    if (!canEditAssessmentBody) {
      if (!silent) {
        setAlert({
          type: 'warning',
          content: assessmentEditBlockedMessage,
          dismissible: true,
          statusIconAriaLabel: 'Warning'
        });
        scrollAfterAction();
      }
      return { ok: false, reason: 'forbidden' };
    }
    if (!silent) {
      setAlert(null);
    }
    try {
      const eligibilityUploadOk = await uploadEiVerificationIfSelected();
      if (!eligibilityUploadOk) {
        return { ok: false, reason: 'ei_verification_upload' };
      }
      if (isReturnedAssessmentEligibilityChangeUnverified({
        reviewWorkflow,
        currentEligibility: assessment.esdcEligibility,
        initialEligibility: initialAssessment.esdcEligibility,
        hasVerificationDocument: eiVerificationDocuments.length > 0,
        hasSelectedVerificationFile: Boolean(eiVerificationFile),
      })) {
        setFieldErrors(prev => ({
          ...prev,
          eiVerification: 'Upload an EI verification document before saving a changed EI status.',
        }));
        if (!silent) {
          setAlert({
            type: 'warning',
            content: 'Upload an EI verification document before saving a changed EI status.',
            dismissible: true,
            statusIconAriaLabel: 'Warning'
          });
          scrollAfterAction();
        }
        return { ok: false, reason: 'ei_verification_required' };
      }
      const payload = buildAssessmentPayload();
      const lockCheck = await ensureLockForOperation();
      if (!lockCheck.ok) return { ok: false, reason: 'lock' };
      const versionToken = Number(applicationRowVersionState || caseData?.application_row_version || 0);
      const requestBody = { ...payload };
      if (versionToken > 0) {
        requestBody.expectedRowVersion = versionToken;
      }
      const res = await apiFetch(`/api/cases/${caseData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      let result = null;
      try {
        result = await res.json();
      } catch (_) {
        result = null;
      }
      if (res.status === 423) {
        if (!silent) {
          showLockAlert({ reason: result?.reason || result?.error, lock: result?.lock });
          setIsEditingAssessment(false);
          releaseLock({ silent: true }).catch(() => {});
        }
        return { ok: false, reason: 'locked' };
      }
      if (res.status === 409) {
        const latestVersion = Number(result?.currentRowVersion ?? result?.application_row_version);
        if (latestVersion) updateRowVersion(latestVersion);
        if (typeof actions?.refreshCaseData === 'function') {
          try {
            await actions.refreshCaseData();
          } catch (_) {}
        }
        if (!silent) {
          setIsEditingAssessment(false);
          setAlert({
            type: 'warning',
            content: 'Another user updated this assessment. The latest data has been reloaded; review it and try again.',
            dismissible: true,
            statusIconAriaLabel: 'Warning'
          });
          scrollAfterAction();
          releaseLock({ silent: true }).catch(() => {});
        }
        return { ok: false, reason: 'conflict' };
      }
      const postingContextErrorCodes = new Set([
        'missing_internal_gl_code',
        'missing_external_gl_code',
        'posting_context_not_permitted'
      ]);
      const postingContextCode = result?.error || result?.code;
      if (postingContextErrorCodes.has(postingContextCode)) {
        if (!silent) {
          handlePostingContextErrors(result);
          scrollAfterAction();
        }
        return { ok: false, reason: 'posting_context' };
      }
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to save assessment.');
      }

      const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
      const caseUpdatePayload = { ...payload };
      if (updatedRowVersion) {
        updateRowVersion(updatedRowVersion);
        caseUpdatePayload.application_row_version = updatedRowVersion;
      }
      if (typeof onCaseUpdate === 'function') {
        onCaseUpdate(caseUpdatePayload);
      }
      if (!silent) {
        setAlert({
          type: 'success',
          content: 'Assessment saved successfully. All changes have been recorded.',
          dismissible: true,
          statusIconAriaLabel: 'Success'
        });
      }
      setInitialAssessment(assessment);
      setInitialLetterDrafts(letterDrafts);
      setIsChanged(false);
      if (!silent) {
        scrollAfterAction();
      }
      // Refresh caseData from backend to reflect latest changes
      if (typeof actions?.refreshCaseData === 'function') {
        try {
          await actions.refreshCaseData();
        } catch (_) {
          // ignore refresh errors
        }
      }
      return { ok: true };
    } catch (err) {
      if (!silent) {
        setAlert({
          type: 'error',
          content: err.message || 'Failed to save assessment.',
          dismissible: true,
          statusIconAriaLabel: 'Error'
        });
        scrollAfterAction();
      }
      return { ok: false, error: err };
    }
  };

  // Lock editing state if final decision has been recorded
  useEffect(() => {
    if (isDecisionFinal || isLockedStatus || lockedByAnotherUser) {
      setIsEditingAssessment(false);
      setShowEditConfirmModal(false);
      setShowCancelModal(false);
      setShowApproveConfirmModal(false);
      releaseLock({ silent: true }).catch(() => {});
    }
  }, [isDecisionFinal, isLockedStatus, lockedByAnotherUser, releaseLock]);

  // For decision review validation
  const validateNWACReview = useCallback(assessment => {
    const errors = {};
    const decision = assessment.nwacReviewStatus;
    const alignmentError = buildAssessmentDecisionAlignmentError({
      recommendation: assessment.recommendation,
      assessmentReview: assessment.nwacReview,
      decisionStatus: decision,
    });
    if (!decision) {
      errors.nwacReviewStatus = 'Funding decision selection is required.';
    }
    if (decision && decision !== 'push_back' && !assessment.nwacReview) {
      errors.nwacReview = 'Assessment assurance outcome is required.';
    }
    if (alignmentError) {
      errors.nwacReviewStatus = alignmentError;
    }
    if ((decision === 'reject' || decision === 'push_back') && (!assessment.nwacReason || !assessment.nwacReason.trim())) {
      errors.nwacReason = decision === 'push_back'
        ? 'Request Changes note is required.'
        : 'Reason for denial is required.';
    }
    return errors;
  }, []);
  const shouldShowStepErrors = useCallback(
    (stepId) => hasSubmitted || attemptedSteps[stepId],
    [hasSubmitted, attemptedSteps]
  );
  const validateWizardStep = useCallback(
    (stepId) => {
      if (isAssessmentDisabled && !['decision', 'eligibility', 'communication', FUNDING_DOCS_STEP_ID].includes(stepId)) {
        return true;
      }
      const errors = validateAssessment(assessment);
      const interventionErrors = errors.interventions || {};
      const hasInterventionFieldError = (keys = []) =>
        Object.values(interventionErrors).some(entry => entry && keys.some(key => entry[key]));
      if (stepId === 'eligibility') {
        return !errors.esdcEligibility && !errors.eiVerification;
      }
      if (stepId === 'framing') {
        if (interventionErrors._global) return false;
        return !hasInterventionFieldError(['code', 'startDate', 'endDate']);
      }
      if (stepId === 'rationale') {
        return !errors.overview && !errors.employmentGoals;
      }
      if (stepId === 'type') {
        return !hasInterventionFieldError([
          'interventionNocVersion',
          'interventionNoc',
          'institution',
          'itpDetails',
          'wageSubsidyDetails'
        ]);
      }
      if (stepId === 'childcare') {
        return true;
      }
      if (stepId === 'previousIset') {
        return !errors.previousISETDetails;
      }
      if (stepId === 'barriers') {
        return !errors.barriers;
      }
      if (stepId === 'priorities') {
        return true;
      }
      if (stepId === 'otherFunding') {
        return true;
      }
      if (stepId === 'cost') {
        return !errors.costLines || Object.keys(errors.costLines).length === 0;
      }
      if (stepId === 'docs') {
        return assessmentSubmitted ? true : docsChecklistComplete;
      }
      if (stepId === 'review') {
        if (denyFundingFlowActive) {
          const denyErrors = validateAssessmentForDeny(assessment);
          return !denyErrors.recommendation && !denyErrors.justification;
        }
        const requiredStepsValid = REQUIRED_STEP_IDS.every(id => validateWizardStep(id));
        return requiredStepsValid && !errors.recommendation && !errors.justification;
      }
      if (stepId === 'decision') {
        if (isNWACFieldsDisabled || !canNwacReview) return true;
        const outcomeErrors = validateNWACReview(assessment);
        return Object.keys(outcomeErrors).length === 0;
      }
      if (stepId === 'communication') {
        return true;
      }
      if (stepId === FUNDING_DOCS_STEP_ID) {
        return fundingDocsChecklistComplete;
      }
      return false;
    },
    [
      assessment,
      assessmentSubmitted,
      canNwacReview,
      docsChecklistComplete,
      denyFundingFlowActive,
      fundingDocsChecklistComplete,
      isAssessmentDisabled,
      isNWACFieldsDisabled,
      validateAssessment,
      validateAssessmentForDeny,
      validateNWACReview
    ]
  );
  const isWizardStepValid = useCallback((stepId) => validateWizardStep(stepId), [validateWizardStep]);

  const validateOutcomeBeforeApprove = () => {
    setHasSubmitted(true);
    setValidationAlert(null);
    const errors = validateNWACReview(assessment);
    const isOutcomeApproved = assessment.nwacReviewStatus === 'approve';
    if (isOutcomeApproved && decisionHasCost && !assessment.interventionPotId) {
      errors.interventionPotId = 'Select a budget pot for the intervention cost.';
    }
    if (isOutcomeApproved && decisionHasCost && assessment.interventionPotId && !assessment.postingContext) {
      errors.postingContext = 'Select how this pot is paid from.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setValidationAlert(buildValidationMessages(errors));
      setTimeout(() => {
        const firstErrorField = document.querySelector('[data-error-focus="true"]');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof firstErrorField.focus === 'function') {
            firstErrorField.focus();
          }
        }
      }, 0);
      return false;
    }
    return true;
  };

  const handleReviewWorkflowAction = async (action) => {
    if (!canRegionalManagerReview) {
      setValidationAlert(['Only the Regional Manager can complete this review action at the current stage.']);
      return;
    }
    if (
      action === ASSESSMENT_REVIEW_ACTIONS.rmSubmitToNwac &&
      requiresSubmitterCorrectionReturn
    ) {
      setValidationAlert([
        'Return this reopened assessment to the original submitter for correction before submitting it for another final decision.'
      ]);
      return;
    }
    const note = String(reviewWorkflowNote || '').trim();
    const noteRequired =
      action === ASSESSMENT_REVIEW_ACTIONS.rmReturnToSubmitter ||
      action === ASSESSMENT_REVIEW_ACTIONS.rmForwardChangesToSubmitter;
    if (noteRequired && !note) {
      setValidationAlert(['Enter review notes before returning the assessment.']);
      return;
    }
    if (!caseId || !applicationId) {
      setValidationAlert(['Application context is missing. Refresh the case and try again.']);
      return;
    }

    setReviewWorkflowActionLoading(action);
    setValidationAlert(null);
    try {
      const versionToken = Number(applicationRowVersionState || caseData?.application_row_version || caseData?.applicationRowVersion || 0);
      const requestBody = {
        action,
        applicationId,
        note: note || null,
      };
      if (versionToken > 0) {
        requestBody.expectedRowVersion = versionToken;
      }
      const res = await apiFetch(`/api/cases/${caseId}/assessment/review-workflow/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const result = await res.json().catch(() => ({}));
      if (res.status === 409 && result?.error === 'row_version_conflict') {
        const latestVersion = Number(result?.currentRowVersion || result?.application_row_version || 0);
        if (latestVersion) updateRowVersion(latestVersion);
        if (typeof actions?.refreshCaseData === 'function') {
          await actions.refreshCaseData().catch(() => {});
        }
        setAlert({
          type: 'warning',
          content: 'This assessment changed while you were reviewing it. The latest data has been reloaded; review it and try again.',
          dismissible: true,
          statusIconAriaLabel: 'Warning'
        });
        scrollAfterAction();
        return;
      }
      if (!res.ok || !result?.success) {
        throw new Error(result?.message || result?.error || 'Failed to update the review workflow.');
      }
      const updatedRowVersion = Number(result?.application_row_version || result?.applicationRowVersion || 0);
      if (updatedRowVersion) updateRowVersion(updatedRowVersion);
      const nextReviewWorkflow = result?.reviewWorkflow || result?.review_workflow || null;
      const nextApplicationStatus = result?.applicationStatus || result?.application_status || caseData?.applicationStatus || null;
      if (typeof onCaseUpdate === 'function') {
        onCaseUpdate({
          applicationStatus: nextApplicationStatus,
          application_status: nextApplicationStatus,
          applicationStatusRaw: nextApplicationStatus,
          application_row_version: updatedRowVersion || undefined,
          reviewWorkflow: nextReviewWorkflow,
          review_workflow: nextReviewWorkflow,
          twoStepReviewEnabled: true,
          two_step_review_enabled: true,
        });
      }
      if (typeof actions?.refreshCaseData === 'function') {
        await actions.refreshCaseData().catch(() => {});
      }
      if (note) {
        dispatchCaseNotesRefresh();
      }
      setReviewWorkflowNote('');
      const returnedToSubmitter =
        action === ASSESSMENT_REVIEW_ACTIONS.rmReturnToSubmitter ||
        action === ASSESSMENT_REVIEW_ACTIONS.rmForwardChangesToSubmitter;
      setShowNWACSection(!returnedToSubmitter);
      setLocalAssessmentSubmitted(!returnedToSubmitter);
      setCurrentStep(returnedToSubmitter ? 'review' : 'decision');
      setFieldErrors({});
      setHasSubmitted(false);
      setAlert({
        type: 'success',
        content:
          action === ASSESSMENT_REVIEW_ACTIONS.rmSubmitToNwac
            ? 'Assessment submitted for final decision.'
            : action === ASSESSMENT_REVIEW_ACTIONS.rmForwardChangesToSubmitter
              ? 'Requested changes forwarded to the submitter.'
              : 'Assessment returned to the submitter with notes.',
        dismissible: true,
        statusIconAriaLabel: 'Success'
      });
      scrollAfterAction();
    } catch (err) {
      setAlert({
        type: 'error',
        content: err?.message || 'Failed to update the review workflow.',
        dismissible: true,
        statusIconAriaLabel: 'Error'
      });
      scrollAfterAction();
    } finally {
      setReviewWorkflowActionLoading(null);
    }
  };

  const handleComplete = async () => {
    if (!isPendingApprovalStatus && !isReviewWithNwac) {
      return;
    }
    if (!canNwacReview) {
      setValidationAlert([
        isReviewWithRegionalManager
          ? 'The Regional Manager must submit this assessment for final decision before a decision can be recorded.'
          : 'Only Decision Makers can record the application decision for this case.'
      ]);
      return;
    }
    setHasSubmitted(true);
    setValidationAlert(null);
    const errors = validateNWACReview(assessment);
    const decision = assessment.nwacReviewStatus;
    const isOutcomeApproved = decision === 'approve';
    const isOutcomePushBack = decision === 'push_back';
    const nextCaseStatus = isOutcomeApproved ? 'initiated' : (isOutcomePushBack ? 'intake' : 'closed');
    const nextApplicationStatus = isOutcomePushBack
      ? (twoStepReviewEnabled && hasReviewWorkflow ? 'pending_approval' : 'in_review')
      : (isOutcomeApproved ? 'approved' : 'rejected');
    if (isOutcomeApproved && decisionHasCost && !assessment.interventionPotId) {
      errors.interventionPotId = 'Select a budget pot for the intervention cost.';
    }
    if (isOutcomeApproved && decisionHasCost && assessment.interventionPotId && !assessment.postingContext) {
      errors.postingContext = 'Select how this pot is paid from.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setValidationAlert(buildValidationMessages(errors));
      setTimeout(() => {
        const firstErrorField = document.querySelector('[data-error-focus="true"]');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof firstErrorField.focus === 'function') {
            firstErrorField.focus();
          }
        }
      }, 0);
      return;
    }
    setIsSubmittingAssessment(true);
    try {
      // Send full assessment payload to backend
      const lockCheck = await ensureLockForOperation();
      if (!lockCheck.ok) return;
      const releaseAfterSuccess = lockCheck.localOwner || lockHeldByCurrentUser;
      const versionToken = Number(applicationRowVersionState || caseData?.application_row_version || 0);
      const completeAssessmentPayload = buildAssessmentPayload({ includeDecisionFields: true });
      const payload = {
        applicationId: applicationId || null,
        assessment_nwac_review_status: completeAssessmentPayload.assessment_nwac_review_status,
        assessment_nwac_review: completeAssessmentPayload.assessment_nwac_review,
        assessment_nwac_reason: completeAssessmentPayload.assessment_nwac_reason,
        assessment_intervention_pot_id: completeAssessmentPayload.assessment_intervention_pot_id,
        postingContext: completeAssessmentPayload.postingContext,
        assessment_submit_action: true,
        status: nextCaseStatus,
        applicationStatus: nextApplicationStatus
      };
      const requestBody = { ...payload };
      if (versionToken > 0) {
        requestBody.expectedRowVersion = versionToken;
      }
      // 1. Update case with decision review and status
      const res = await apiFetch(`/api/cases/${caseData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const result = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const latestVersion = Number(result?.currentRowVersion ?? result?.application_row_version);
        if (latestVersion) updateRowVersion(latestVersion);
        if (typeof actions?.refreshCaseData === 'function') {
          try {
            await actions.refreshCaseData();
          } catch (_) {}
        }
        setAlert({
          type: 'warning',
          content: 'Another user updated this assessment. The latest data has been reloaded; review it and try again.',
          dismissible: true,
          statusIconAriaLabel: 'Warning'
        });
        scrollAfterAction();
        return;
      }
      if (handlePostingContextErrors(result)) {
        scrollAfterAction();
        return;
      }
      if (!res.ok || !result?.success) throw new Error(result?.error || 'Failed to save the decision review.');
      if (!isOutcomePushBack) {
        suppressPostDecisionStepAutoPrimeRef.current = true;
      }
      const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
      if (updatedRowVersion) {
        updateRowVersion(updatedRowVersion);
      }
      // Events emitted server-side; refresh caseData to reflect new status
      const fallbackUpdates = {
        status: result?.status || payload.status,
        statusRaw: result?.status || payload.status,
        applicationStatus: result?.applicationStatus || result?.application_status || payload.applicationStatus || caseData?.applicationStatus || null,
        assessment_nwac_review_status: payload.assessment_nwac_review_status,
        assessment_nwac_review: payload.assessment_nwac_review,
        assessment_nwac_reason: payload.assessment_nwac_reason
      };
      const nextReviewWorkflow = result?.reviewWorkflow || result?.review_workflow || null;
      if (nextReviewWorkflow) {
        fallbackUpdates.reviewWorkflow = nextReviewWorkflow;
        fallbackUpdates.review_workflow = nextReviewWorkflow;
        fallbackUpdates.twoStepReviewEnabled = true;
        fallbackUpdates.two_step_review_enabled = true;
      }
      if (updatedRowVersion) {
        fallbackUpdates.application_row_version = updatedRowVersion;
      }
      if (typeof onCaseUpdate === 'function') {
        onCaseUpdate(fallbackUpdates);
      }
      if (typeof actions?.refreshCaseData === 'function') {
        try {
          await actions.refreshCaseData();
        } catch (_) {
          // ignore refresh errors, fallback already applied
        }
      }
      dispatchSupportingDocsRefresh();
      if (payload.assessment_nwac_reason) {
        dispatchCaseNotesRefresh();
      }
      setIsEditingAssessment(false);
      setShowEditConfirmModal(false);
      setShowApproveConfirmModal(false);
      setShowCancelModal(false);
      setLocalAssessmentSubmitted(true);
      setFieldErrors({});
      setHasSubmitted(false);
      if (!isOutcomePushBack) {
        suppressPostDecisionStepAutoPrimeRef.current = true;
        setCurrentStep('decision');
        if (wizardStepKey) {
          assessmentWizardStepStore.set(String(wizardStepKey), 'decision');
        }
      }
      scrollAfterAction();
      const decisionMessage = (() => {
        if (isOutcomePushBack) {
          return nextReviewWorkflow || twoStepReviewEnabled
            ? 'Changes requested by the Decision Maker and returned to Regional Manager review.'
            : 'Decision pushed back. Application returned to In review.';
        }
        if (isOutcomeApproved) {
          return approvalHasFundingPackage
            ? 'Application marked as approved. Prepare the approval letter and funding agreement.'
            : 'Application marked as approved. Prepare the approval letter.';
        }
        return 'Application marked as denied. Prepare the denial letter.';
      })();
      setAlert({
        type: 'success',
        content: decisionMessage,
        dismissible: true,
        statusIconAriaLabel: 'Success'
      });
      setInitialAssessment(a => ({ ...a, ...payload }));
      setInitialLetterDrafts(letterDrafts);
      setIsChanged(false);
      setValidationAlert(null);
      if (releaseAfterSuccess) {
        releaseLock({ silent: true }).catch(() => {});
      }
    } catch (err) {
      setAlert({ type: 'error', content: err.message || 'Failed to submit outcome notice.', dismissible: true, statusIconAriaLabel: 'Error' });
      scrollAfterAction();
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  const handleApproveClick = async () => {
    if (selectedDecisionRequiresHighValueApprover) {
      setValidationAlert([approvalBlockMessage]);
      return;
    }
    const outcomeValid = validateOutcomeBeforeApprove();
    if (!outcomeValid) return;
    const requiresChecklist = assessment.nwacReviewStatus === 'approve';
    if (requiresChecklist) {
      const checklistOk = await runDocumentChecklist(handleComplete, { allowBypass: true });
      if (checklistOk) {
        await handleComplete();
      }
    } else {
      await handleComplete();
    }
  };

  const updateApplicationStatus = useCallback(
    async ({
      nextStatus,
      successMessage,
      errorMessage = 'Failed to update the application status.',
      refreshDocs = false,
      resetSubmitted = false,
      expectedRowVersion = null
    } = {}) => {
      if (!caseId || !nextStatus) return { ok: false };
      const exactApplicationId = Number(applicationId);
      if (!Number.isInteger(exactApplicationId) || exactApplicationId <= 0) {
        setAlert({
          type: 'error',
          content: 'The selected application could not be identified. Reload the client file before changing its status.',
          dismissible: true,
          statusIconAriaLabel: 'Error'
        });
        scrollAfterAction();
        return { ok: false };
      }
      const lockCheck = await ensureLockForOperation();
      if (!lockCheck.ok) return { ok: false };
      const releaseAfterSuccess = lockCheck.localOwner || lockHeldByCurrentUser;
      const versionToken = Number(expectedRowVersion || applicationRowVersionState || caseData?.application_row_version || 0);
      const payload = {
        applicationId: exactApplicationId,
        applicationStatus: nextStatus
      };
      if (versionToken > 0) {
        payload.expectedRowVersion = versionToken;
      }
      try {
        const res = await apiFetch(`/api/cases/${caseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json().catch(() => ({}));
        if (res.status === 409) {
          const latestVersion = Number(result?.currentRowVersion ?? result?.application_row_version);
          if (latestVersion) updateRowVersion(latestVersion);
          if (typeof actions?.refreshCaseData === 'function') {
            try {
              await actions.refreshCaseData();
            } catch (_) {}
          }
          setAlert({
            type: 'warning',
            content: 'Another user updated this case. The latest data has been reloaded; review it and try again.',
            dismissible: true,
            statusIconAriaLabel: 'Warning'
          });
          scrollAfterAction();
          return { ok: false };
        }
        if (!res.ok || !result?.success) {
          throw new Error(result?.error || errorMessage);
        }
        const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
        if (updatedRowVersion) {
          updateRowVersion(updatedRowVersion);
        }
        if (typeof onCaseUpdate === 'function') {
          const updates = { applicationStatus: nextStatus };
          if (updatedRowVersion) updates.application_row_version = updatedRowVersion;
          onCaseUpdate(updates);
        }
        if (typeof actions?.refreshCaseData === 'function') {
          try {
            await actions.refreshCaseData();
          } catch (_) {}
        }
        if (refreshDocs) {
          dispatchSupportingDocsRefresh();
        }
        if (successMessage) {
          setAlert({
            type: 'success',
            content: successMessage,
            dismissible: true,
            statusIconAriaLabel: 'Success'
          });
        }
        if (resetSubmitted) {
          setHasSubmitted(false);
        }
        scrollAfterAction();
        return { ok: true };
      } catch (err) {
        setAlert({
          type: 'error',
          content: err.message || errorMessage,
          dismissible: true,
          statusIconAriaLabel: 'Error'
        });
        scrollAfterAction();
        return { ok: false };
      } finally {
        if (releaseAfterSuccess) {
          releaseLock({ silent: true }).catch(() => {});
        }
      }
    },
    [
      actions,
      applicationId,
      applicationRowVersionState,
      caseData?.application_row_version,
      caseId,
      dispatchSupportingDocsRefresh,
      ensureLockForOperation,
      lockHeldByCurrentUser,
      onCaseUpdate,
      releaseLock,
      scrollAfterAction,
      updateRowVersion
    ]
  );

  const denyFundingConfirmMessage = 'This will skip the remaining assessment steps and take you to the recommendation to deny funding.';

  const handleDenyFundingConfirm = async () => {
    if (denyFundingLoading) return;
    if (!canUseDenyFundingShortcut) {
      if (denyFundingBlockedReason) {
        setAlert({
          type: 'warning',
          content: denyFundingBlockedReason,
          dismissible: true,
          statusIconAriaLabel: 'Warning'
        });
        scrollAfterAction();
      }
      setDenyFundingModalVisible(false);
      return;
    }
    setDenyFundingLoading(true);
    try {
      const lockCheck = await ensureLockForOperation();
      if (!lockCheck.ok) return;
      setIsEditingAssessment(true);
      setShowEditConfirmModal(false);
      setShowCancelModal(false);
      setAlert(null);
      setDenyFundingFlowActive(true);
      handleField('recommendation', 'no_recommend');
      setDenyFundingModalVisible(false);
      setCurrentStep('review');
    } finally {
      setDenyFundingLoading(false);
    }
  };

  const markApplicationCompleted = useCallback(
    async ({
      successMessage = 'Communication complete. Application marked as completed.',
      expectedRowVersion = null
    } = {}) =>
      updateApplicationStatus({
        nextStatus: 'completed',
        successMessage,
        errorMessage: 'Failed to complete the application.',
        refreshDocs: true,
        resetSubmitted: true,
        expectedRowVersion
      }),
    [updateApplicationStatus]
  );

  const handleCommunicationComplete = async () => {
    if (!showCommunicationStep || isCompletedStatus) {
      return;
    }
    if (decisionOutcome === 'approved') {
      setShowSendApprovalLetterConfirmModal(true);
      return;
    }
    setHasSubmitted(true);
    const letterResult = await handleSendDecisionLetter();
    if (!letterResult.ok) return;
    if (decisionOutcome === 'denied') {
      await markApplicationCompleted({
        successMessage: 'Denial letter sent. Application marked as completed.',
        expectedRowVersion: letterResult.updatedRowVersion || null
      });
      return;
    }
    await markApplicationCompleted();
  };

  const handleFundingDocsComplete = async () => {
    if (!showFundingDocsStep || isCompletedStatus) {
      return;
    }
    if (!fundingDocsChecklistComplete) {
      setShowFundingDocsIncompleteModal(true);
      return;
    }
    setHasSubmitted(true);
    const checklistOk = await runDocumentChecklist(null, {
      allowBypass: false,
      stage: COMMUNICATION_CHECKLIST_STAGE
    });
    if (!checklistOk) return;
    await markApplicationCompleted({
      successMessage: 'All required funding forms are complete. Application marked as completed.'
    });
  };
  const handleConfirmSendApprovalLetter = async () => {
    if (sendingLetter) return;
    setShowSendApprovalLetterConfirmModal(false);
    setHasSubmitted(true);
    const letterResult = await handleSendDecisionLetter();
    if (!letterResult.ok) return;
    setHasSubmitted(false);
  };
  const handleWizardNavigate = async ({ detail }) => {
    const { requestedStepIndex, reason } = detail || {};
    if (
      reason === 'next' &&
      currentStep === 'framing' &&
      proposedInterventions.length === 0 &&
      !isAssessmentDisabled
    ) {
      openAddInterventionModal();
      return;
    }
    if (requestedStepIndex < 0 || requestedStepIndex >= activeStepIds.length) return;
    const requestedStepId = activeStepIds[requestedStepIndex];
    const currentIdx = activeStepIds.indexOf(currentStep);
    let autoSaveOk = false;
    if (requestedStepIndex !== currentIdx && !isAssessmentDisabled && isChanged) {
      const autoSaveResult = await handleSave({ silent: true });
      autoSaveOk = Boolean(autoSaveResult?.ok);
    }
    if (requestedStepIndex > currentIdx) {
      if (!isAssessmentDisabled || currentStep === 'eligibility') {
        setAttemptedSteps(prev => ({ ...prev, [currentStep]: true }));
        setFieldErrors(validateAssessment(assessment));
        const valid = validateWizardStep(currentStep);
        const canNavigateReturnedCorrection =
          isReturnedToSubmitterStage && canEditAssessmentBody;
        if (!valid && !canNavigateReturnedCorrection) {
          return;
        }
        if (
          valid &&
          canManageEligibilityDuringAssessment &&
          currentStep === 'eligibility' &&
          !preserveReturnedAssessmentEligibility
        ) {
          if (!autoSaveOk) {
            const eligibilitySaved = await persistEligibilitySelection();
            if (!eligibilitySaved.ok) {
              return;
            }
            const uploadOk = await uploadEiVerificationIfSelected();
            if (!uploadOk) {
              return;
            }
          }
          const checklistOk = await runDocumentChecklist(null, {
            allowBypass: false,
            stage: START_ASSESSMENT_STAGE
          });
          if (!checklistOk) {
            return;
          }
          dispatchSupportingDocsRefresh();
        }
      }
    }
    if (requestedStepId !== currentStep) {
      // Reset submit-attempt state when moving between steps so stale review errors
      // are not shown immediately on step entry.
      setHasSubmitted(false);
    }
    setCurrentStep(requestedStepId);
  };

  const canRecallAssessmentSubmission =
    !isEligibilityGateActive &&
    !lockedByAnotherUser &&
    !isLockedStatus &&
    !isDecisionFinal &&
    !isReviewComplete &&
    !isPostDecisionStatus &&
    isPendingApprovalStatus &&
    (
      (!twoStepReviewEnabled || !hasReviewWorkflow)
        ? (
            isAssessor ||
            isIsetCoordinator ||
            isRegionalManager ||
            roleKey === 'systemadministrator'
          )
        : (
            reviewStage === ASSESSMENT_REVIEW_STAGES.rmReview &&
            (
              isCurrentReviewWorkflowSubmitter ||
              roleKey === 'systemadministrator'
            )
          )
    ) &&
    assessmentSubmitted &&
    !isEditingAssessment;

  const headerElement = (
    <Header
      variant="h2"
      actions={
        <SpaceBetween direction="horizontal" size="s">
          {canEditAssessmentBody && !isEligibilityGateActive && !lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && isReviewComplete && (
            <Button variant="normal" onClick={() => setShowEditConfirmModal(true)}>Edit</Button>
          )}
          {canRecallAssessmentSubmission && (
            <Button
              variant="normal"
              onClick={() => setShowRecallConfirmModal(true)}
              loading={isRecallingAssessment}
              disabled={isRecallingAssessment}
            >
              Recall submission
            </Button>
          )}
          {canEditAssessmentBody && !isEligibilityGateActive && !lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && !isPendingApprovalStatus && assessmentSubmitted && !isEditingAssessment && (
            <Button variant="normal" onClick={() => setShowEditConfirmModal(true)}>Edit</Button>
          )}
          {canEditAssessmentBody && !isEligibilityGateActive && !lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && (!assessmentSubmitted || isEditingAssessment) && (
            <Button variant="primary" disabled={!isChanged} onClick={() => handleSave()}>Save Progress</Button>
          )}
        </SpaceBetween>
      }
      info={
        <Link
          variant="info"
          onFollow={() => {
            if (!toggleHelpPanel) return;
            if (showNWACSection) {
              toggleHelpPanel(<NwacAssessmentHelp />, applicationWidgetHelpTitle, NwacAssessmentHelp.aiContext);
            } else {
              toggleHelpPanel(<ApplicationAssessmentHelp />, applicationWidgetHelpTitle, ApplicationAssessmentHelp.aiContext);
            }
          }}
        >
          Info
        </Link>
      }
    >
      <Hotspot hotspotId="app-workspace-assessment" direction="right" />
      {applicationWidgetTitle}
    </Header>
  );
  const boardItemI18nStrings = {
    dragHandleAriaLabel: 'Drag handle',
    dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
    resizeHandleAriaLabel: 'Resize handle',
    resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
  };
  const boardItemSettings = (
    <ButtonDropdown
      items={[{ id: 'remove', text: 'Remove' }]}
      ariaLabel="Board item settings"
      variant="icon"
      onItemClick={() => actions && actions.removeItem && actions.removeItem()}
    />
  );

  const renderRecommendationSection = ({ readOnly = isAssessmentDisabled, showErrors = shouldShowStepErrors('review') } = {}) => {
    const showReviewErrors = Boolean(showErrors);
    return (
      <>
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
          <FormField
            label="Recommendation"
            errorText={showReviewErrors && fieldErrors.recommendation ? fieldErrors.recommendation : undefined}
            description="Select your recommendation for this application. If not recommending funding, provide an alternative or rationale below."
          >
            <Select
              selectedOption={RECOMMEND_OPTIONS.find(o => o.value === assessment.recommendation) || null}
              onChange={({ detail }) => handleField('recommendation', detail.selectedOption.value)}
            options={RECOMMEND_OPTIONS}
            placeholder="Select recommendation"
            ariaLabel="Recommendation"
            data-error-focus={showReviewErrors && fieldErrors.recommendation ? 'true' : undefined}
            tabIndex={-1}
            readOnly={readOnly}
          />
          </FormField>
          <FormField
            label="Justification"
            stretch={true}
            errorText={showReviewErrors && fieldErrors.justification ? fieldErrors.justification : undefined}
            description="Provide a clear justification for your recommendation, referencing the client's needs, goals, and eligibility."
          >
            <Box width="100%">
              <Textarea
                value={assessment.justification}
                onChange={({ detail }) => handleField('justification', detail.value)}
                spellcheck={true}
                data-error-focus={showReviewErrors && fieldErrors.justification ? 'true' : undefined}
                tabIndex={-1}
                readOnly={readOnly}
              />
            </Box>
          </FormField>
        </Grid>
      </>
    );
  };
  const showEligibilityErrors = shouldShowStepErrors('eligibility');
  const showFramingErrors = shouldShowStepErrors('framing');
  const showRationaleErrors = shouldShowStepErrors('rationale');
  const showTypeErrors = shouldShowStepErrors('type');
  const showPreviousIsetErrors = shouldShowStepErrors('previousIset');
  const showBarriersErrors = shouldShowStepErrors('barriers');
  const showCostErrors = shouldShowStepErrors('cost');
  const showDecisionErrors = shouldShowStepErrors('decision');
  const sortedEiVerificationDocuments = useMemo(() => {
    if (!Array.isArray(eiVerificationDocuments) || !eiVerificationDocuments.length) return [];
    const toTime = (value) => {
      if (!value) return 0;
      const time = Date.parse(value);
      return Number.isFinite(time) ? time : 0;
    };
    const toNumericId = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };
    return [...eiVerificationDocuments].sort((a, b) => {
      const byUpload = toTime(b?.uploaded_at) - toTime(a?.uploaded_at);
      if (byUpload !== 0) return byUpload;
      const aNum = toNumericId(a?.id);
      const bNum = toNumericId(b?.id);
      if (aNum !== null && bNum !== null && aNum !== bNum) return bNum - aNum;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    });
  }, [eiVerificationDocuments]);
  const interventionFieldErrors = fieldErrors.interventions || {};
  const costLineFieldErrors = fieldErrors.costLines || {};

  const denyFundingShortcut = showDenyFundingShortcut ? (
    <Box border={{ color: 'border-divider', width: 1 }} borderRadius="medium">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <div>
          <Box fontWeight="bold">Not eligible for funding?</Box>
          <Box variant="small" color="text-body-secondary">
            Record a denial now and bypass the remaining assessment steps.
          </Box>
          {denyFundingBlockedReason ? (
            <Box variant="small" color="text-body-secondary">
              {denyFundingBlockedReason}
            </Box>
          ) : null}
        </div>
        <Button
          variant="normal"
          onClick={() => setDenyFundingModalVisible(true)}
          disabled={!canUseDenyFundingShortcut}
        >
          Deny Funding
        </Button>
      </div>
    </Box>
  ) : null;

  const eligibilityStepContent = (
    <SpaceBetween size="m">
      {canUploadEiVerification && (
        <input
          type="file"
          ref={eiVerificationFileInputRef}
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
          onChange={handleEiVerificationFileChange}
        />
      )}
      {canUploadEiVerification && !applicationId && (
        <Alert
          type="error"
          header="Application record required"
        >
          Save progress to associate this assessment with an application before uploading EI verification documents.
        </Alert>
      )}
      {canUploadEiVerification && eiVerificationUploadError && (
        <Alert
          type="error"
          statusIconAriaLabel="Error"
          dismissible
          onDismiss={() => setEiVerificationUploadError(null)}
        >
          {eiVerificationUploadError}
        </Alert>
      )}
      {canUploadEiVerification && eiVerificationUploadSuccess && (
        <Alert
          type="success"
          statusIconAriaLabel="Success"
          dismissible
          onDismiss={() => setEiVerificationUploadSuccess(null)}
        >
          {eiVerificationUploadSuccess}
        </Alert>
      )}
      <Grid gridDefinition={[{ colspan: 6 }]}>
        <FormField
          label="Employment Insurance Status"
          errorText={showEligibilityErrors && fieldErrors.esdcEligibility ? fieldErrors.esdcEligibility : undefined}
          description={
            isEligibilityAdmin
              ? (
                  assessment.esdcEligibility
                    ? 'EI status is set. Change only if correction is needed.'
                    : "Select the client's Employment Insurance status for ESDC funding."
                )
              : 'Set by authorized staff only.'
          }
        >
          {isEligibilityAdmin ? (
            <Select
              selectedOption={ESDC_OPTIONS.find(o => o.value === assessment.esdcEligibility) || null}
              onChange={({ detail }) => {
                handleField('esdcEligibility', detail.selectedOption.value);
                setEiVerificationUploadError(null);
                setEiVerificationUploadSuccess(null);
              }}
              options={ESDC_OPTIONS}
              placeholder="Select EI status"
              ariaLabel="Employment Insurance Status"
              data-error-focus={showEligibilityErrors && fieldErrors.esdcEligibility ? 'true' : undefined}
              tabIndex={-1}
              readOnly={isEligibilityDisabled}
            />
          ) : (
            <Box>{assessment.esdcEligibility || 'Not set'}</Box>
          )}
        </FormField>
      </Grid>
      <FormField
        label="Current EI verification documents"
        errorText={showEligibilityErrors && fieldErrors.eiVerification ? fieldErrors.eiVerification : undefined}
        stretch
      >
        {eiVerificationDocsLoading ? (
          <Box variant="small" color="text-body-secondary">Loading documents...</Box>
        ) : sortedEiVerificationDocuments.length ? (
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {sortedEiVerificationDocuments.map((item, index) => {
              const documentId = item?.id;
              const label = item?.label || item?.file_name || `Document ${documentId || ''}`.trim();
              const uploadedAt = item?.uploaded_at ? formatDate(item.uploaded_at) : '';
              const opening = Boolean(documentId && eiVerificationDocDownloads[documentId]);
              const isCurrent = index === 0;
              return (
                <li key={documentId || `${label}-${uploadedAt}`}>
                  <Link
                    onFollow={event => {
                      event.preventDefault();
                      handleOpenEiVerificationDocument(item);
                    }}
                  >
                    {opening ? 'Opening...' : label}
                  </Link>
                  {uploadedAt ? ` (${uploadedAt})` : ''}
                  {isCurrent ? ' (Current)' : ''}
                </li>
              );
            })}
          </ul>
        ) : (
          <Box variant="small" color="text-body-secondary">No EI verification document uploaded yet.</Box>
        )}
        {eiVerificationDocsError ? (
          <Box variant="small" color="text-status-error">{eiVerificationDocsError}</Box>
        ) : null}
      </FormField>
      {canUploadEiVerification && (
        <FormField label="Add new EI report" errorText={eiVerificationFileError || undefined} stretch>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              onClick={() => eiVerificationFileInputRef.current && eiVerificationFileInputRef.current.click()}
              disabled={isEiVerificationUploadDisabled}
            >
              Choose file
            </Button>
            <Box>{eiVerificationFile ? eiVerificationFile.name : 'No new file chosen'}</Box>
          </div>
          <Box variant="small" color="text-body-secondary">
            Max size 6 MB. Allowed types: PDF, Word (.doc, .docx), JPG, PNG, BMP, TIFF.
          </Box>
        </FormField>
      )}
    </SpaceBetween>
  );

  const framingStepContent = (
    <SpaceBetween size="l">
      {denyFundingShortcut}
      {showFramingErrors && interventionFieldErrors._global && (
        <Alert type="error" statusIconAriaLabel="Error">
          {interventionFieldErrors._global}
        </Alert>
      )}
      <Table
        stripedRows
        variant="embedded"
        trackBy="id"
        items={proposedInterventions}
        resizableColumns
        columnDefinitions={[
          {
            id: 'intervention',
            header: 'Intervention',
            cell: item => {
              const rowErrors = showFramingErrors ? (interventionFieldErrors[item.id] || {}) : {};
              const rowErrorText = rowErrors.code || rowErrors.startDate || rowErrors.endDate;
              return (
                <FormField errorText={rowErrorText}>
                  <Link
                    onFollow={event => {
                      event.preventDefault();
                      openViewInterventionModal(item.id);
                    }}
                    data-error-focus={rowErrorText ? 'true' : undefined}
                  >
                    {resolveInterventionLabel(item.code) || '—'}
                  </Link>
                </FormField>
              );
            }
          },
          {
            id: 'dates',
            header: 'Dates',
            minWidth: 140,
            cell: item => formatInterventionDates(item.startDate, item.endDate)
          },
          {
            id: 'actions',
            header: 'Actions',
            minWidth: 90,
            width: 90,
            cell: item => (
              <Button
                variant="inline-icon"
                iconName="remove"
                ariaLabel="Delete intervention"
                onClick={() => setInterventionDeleteId(item.id)}
                disabled={isAssessmentDisabled}
              />
            )
          }
        ]}
        header={
          <Header
            variant="h3"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="normal"
                  onClick={openAddInterventionModal}
                  disabled={isAssessmentDisabled}
                >
                  Add intervention
                </Button>
              </SpaceBetween>
            }
          >
            Propose Intervention(s)
          </Header>
        }
        empty={<Box textAlign="center">No proposed interventions.</Box>}
      />
    </SpaceBetween>
  );

  const rationaleStepContent = (
    <SpaceBetween size="l">
      {existingClientInfo && (
        <Alert type="info" header="Existing client on file">
          {`This participant already has a case on file (${existingClientInfo.caseLabel}${existingClientInfo.statusLabel ? ` • Status: ${existingClientInfo.statusLabel}` : ''}).`}
        </Alert>
      )}
      {existingClientInfo?.managerLabel && (
        <Grid gridDefinition={[{ colspan: 6 }]}>
          <FormField label="Current Case Manager">
            <Box padding={{ vertical: 'xs' }}>{existingClientInfo.managerLabel}</Box>
          </FormField>
        </Grid>
      )}
      <Grid gridDefinition={[{ colspan: 12 }]}>
        <FormField
          label="Client Application Overview & Request"
          stretch={true}
          errorText={showRationaleErrors && fieldErrors.overview ? fieldErrors.overview : undefined}
          description="Summarize the client's application, background, and the specific request or intervention being considered. Include any relevant context from the application form."
          constraintText={`${overviewWordCount}/${OVERVIEW_WORD_LIMIT} words maximum`}
        >
          <Box width="100%">
            <Textarea
              placeholder={initialAssessment.overview}
              value={assessment.overview}
              onChange={({ detail }) => handleField('overview', detail.value)}
              spellcheck={true}
              data-error-focus={showRationaleErrors && fieldErrors.overview ? 'true' : undefined}
              tabIndex={-1}
              readOnly={isAssessmentDisabled}
            />
          </Box>
        </FormField>
      </Grid>
      <Grid gridDefinition={[{ colspan: 12 }]}>
        <FormField
          label="Client’s Employment Goal(s)"
          stretch={true}
          errorText={showRationaleErrors && fieldErrors.employmentGoals ? fieldErrors.employmentGoals : undefined}
          description="Describe the client's short- and long-term employment goals as discussed during assessment. Reference the goals stated in the application form if available."
          constraintText={`${employmentGoalsWordCount}/${EMPLOYMENT_GOALS_WORD_LIMIT} words maximum`}
        >
          <Box width="100%">
            <Textarea
              placeholder={initialAssessment.employmentGoals}
              value={assessment.employmentGoals}
              onChange={({ detail }) => handleField('employmentGoals', detail.value)}
              spellcheck={true}
              data-error-focus={showRationaleErrors && fieldErrors.employmentGoals ? 'true' : undefined}
              tabIndex={-1}
              readOnly={isAssessmentDisabled}
            />
          </Box>
        </FormField>
      </Grid>
    </SpaceBetween>
  );

  const typeStepContent = (
    <SpaceBetween size="l">
      {proposedInterventions.map(intervention => {
        const educationCode = isEducationCode(intervention.code);
        const employerCode = isEmployerCode(intervention.code);
        const needsNoc = requiresNocForCode(intervention.code);
        const wageSubsidyCode = isWageSubsidyCode(intervention.code);
        const requiresExternal = requiresExternalPartnerForCode(intervention.code);
        const deliveryMode = intervention.deliveryMode === 'in_house' ? 'in_house' : 'partner';
        return (
          <SpaceBetween key={intervention.id} size="m">
            <Header variant="h3">
              {resolveInterventionLabel(intervention.code) || 'Intervention details'}
            </Header>
            {!requiresExternal && (
              <ColumnLayout columns={2} variant="text-grid">
                <FormField
                  label="Delivery mode"
                  description="Choose how this will run."
                >
                  <Select
                    selectedOption={
                      deliveryMode === 'in_house'
                        ? { value: 'in_house', label: 'In-house (no external partner)' }
                        : { value: 'partner', label: 'External delivery partner' }
                    }
                    onChange={({ detail }) =>
                      updateIntervention(intervention.id, { deliveryMode: detail.selectedOption?.value || 'partner' })
                    }
                    options={[
                      { value: 'partner', label: 'External delivery partner' },
                      { value: 'in_house', label: 'In-house (no external partner)' }
                    ]}
                    readOnly={isAssessmentDisabled}
                  />
                </FormField>
                {deliveryMode === 'partner' ? (
                  <FormField
                    label="Delivery partner / provider"
                    description="The training provider or employer."
                    errorText={showTypeErrors ? interventionFieldErrors[intervention.id]?.institution : undefined}
                  >
                    <Input
                      value={intervention.institution}
                      onChange={({ detail }) => updateIntervention(intervention.id, { institution: detail.value })}
                      spellcheck={false}
                      placeholder="Training institution, employer, or provider"
                      data-error-focus={showTypeErrors && interventionFieldErrors[intervention.id]?.institution ? 'true' : undefined}
                      readOnly={isAssessmentDisabled}
                    />
                  </FormField>
                ) : (
                  <Box />
                )}
              </ColumnLayout>
            )}

            {educationCode && (
              <SpaceBetween size="s">
                <ColumnLayout columns={2} variant="text-grid">
                  <FormField
                    label="Institution"
                    description="Training provider or school delivering the program."
                    errorText={showTypeErrors ? interventionFieldErrors[intervention.id]?.institution : undefined}
                  >
                    <Input
                      value={intervention.institution}
                      onChange={({ detail }) => updateIntervention(intervention.id, { institution: detail.value })}
                      spellcheck={false}
                      data-error-focus={showTypeErrors && interventionFieldErrors[intervention.id]?.institution ? 'true' : undefined}
                      readOnly={isAssessmentDisabled}
                    />
                  </FormField>
                  <FormField
                    label="Program name (optional)"
                    description="Course, credential, or stream name."
                  >
                    <Input
                      value={intervention.programName}
                      onChange={({ detail }) => updateIntervention(intervention.id, { programName: detail.value })}
                      spellcheck={false}
                      readOnly={isAssessmentDisabled}
                    />
                  </FormField>
                </ColumnLayout>
                <FormField
                  label="In-Training Plan (ITP) details"
                  description="Outline curriculum, milestones, supports, materials, and how this leads to the employment goal."
                  errorText={showTypeErrors ? interventionFieldErrors[intervention.id]?.itpDetails : undefined}
                >
                  <Textarea
                    value={intervention.itpDetails || ''}
                    rows={3}
                    onChange={({ detail }) => updateIntervention(intervention.id, { itpDetails: detail.value })}
                    spellcheck={true}
                    placeholder="Summarize training plan, key milestones, supports, or materials."
                    data-error-focus={showTypeErrors && interventionFieldErrors[intervention.id]?.itpDetails ? 'true' : undefined}
                    readOnly={isAssessmentDisabled}
                  />
                </FormField>
              </SpaceBetween>
            )}

            {employerCode && (
              <SpaceBetween size="s">
                <ColumnLayout columns={2} variant="text-grid">
                  <FormField
                    label="Employer / delivery partner"
                    description="Employer or host organization providing the placement."
                    errorText={showTypeErrors ? interventionFieldErrors[intervention.id]?.institution : undefined}
                  >
                    <Input
                      value={intervention.institution}
                      onChange={({ detail }) => updateIntervention(intervention.id, { institution: detail.value })}
                      spellcheck={false}
                      data-error-focus={showTypeErrors && interventionFieldErrors[intervention.id]?.institution ? 'true' : undefined}
                      readOnly={isAssessmentDisabled}
                    />
                  </FormField>
                  <FormField
                    label="Program name (optional)"
                    description="Job title, role, or program name if defined by the employer."
                  >
                    <Input
                      value={intervention.programName}
                      onChange={({ detail }) => updateIntervention(intervention.id, { programName: detail.value })}
                      spellcheck={false}
                      readOnly={isAssessmentDisabled}
                    />
                  </FormField>
                </ColumnLayout>
                {wageSubsidyCode && (
                  <FormField
                    label="Wage subsidy details"
                    errorText={showTypeErrors ? interventionFieldErrors[intervention.id]?.wageSubsidyDetails : undefined}
                  >
                    <Textarea
                      value={intervention.wageSubsidyDetails || ''}
                      rows={3}
                      onChange={({ detail }) => updateIntervention(intervention.id, { wageSubsidyDetails: detail.value })}
                      spellcheck={true}
                      placeholder="Employer, wage subsidy amount/percentage, duration, expectations."
                      data-error-focus={showTypeErrors && interventionFieldErrors[intervention.id]?.wageSubsidyDetails ? 'true' : undefined}
                      readOnly={isAssessmentDisabled}
                    />
                  </FormField>
                )}
              </SpaceBetween>
            )}
            {needsNoc && (
              <ColumnLayout columns={2} variant="text-grid">
                <FormField
                  label="NOC version"
                  description="Select the NOC version used for this job/placement."
                  errorText={showTypeErrors ? interventionFieldErrors[intervention.id]?.interventionNocVersion : undefined}
                >
                  <Select
                    selectedOption={
                      nocVersions.find(option => option.value === intervention.interventionNocVersion) || null
                    }
                    onChange={({ detail }) => {
                      updateIntervention(intervention.id, {
                        interventionNocVersion: detail.selectedOption?.value || '',
                        interventionNoc: ''
                      });
                      setNocSuggestions([]);
                    }}
                    options={nocVersions}
                    placeholder={nocVersionsLoading ? 'Loading NOC versions...' : 'Select NOC version'}
                    statusType={nocVersionsLoading ? 'loading' : 'finished'}
                    filteringType="auto"
                    data-error-focus={showTypeErrors && interventionFieldErrors[intervention.id]?.interventionNocVersion ? 'true' : undefined}
                    readOnly={isAssessmentDisabled}
                    disabled={nocVersionsLoading}
                  />
                </FormField>
                <FormField
                  label="NOC code"
                  description="Search by code or title; aligns to the job/placement."
                  errorText={showTypeErrors ? interventionFieldErrors[intervention.id]?.interventionNoc : undefined}
                >
                  <Autosuggest
                    value={intervention.interventionNoc || ''}
                    onChange={({ detail }) => {
                      const inputValue = detail.value || '';
                      updateIntervention(intervention.id, { interventionNoc: inputValue });
                      if (inputValue.length >= 2 && intervention.interventionNocVersion) {
                        fetchNocSuggestions(inputValue, intervention.interventionNocVersion);
                      } else {
                        setNocSuggestions([]);
                      }
                    }}
                    onSelect={({ detail }) => updateIntervention(intervention.id, { interventionNoc: detail.value || '' })}
                    onLoadItems={({ detail }) => {
                      if (detail.filteringText && intervention.interventionNocVersion) {
                        fetchNocSuggestions(detail.filteringText, intervention.interventionNocVersion);
                      }
                    }}
                    options={nocSuggestions}
                    statusType={nocSuggestionsLoading ? 'loading' : 'finished'}
                    expandToViewport
                    placeholder={
                      intervention.interventionNocVersion
                        ? 'Type to search NOC code'
                        : 'Select a NOC version first'
                    }
                    empty="No NOC codes found."
                    readOnly={isAssessmentDisabled}
                    disabled={!intervention.interventionNocVersion}
                    enteredTextLabel={value => `Use "${value}"`}
                    spellcheck={false}
                    data-error-focus={showTypeErrors && interventionFieldErrors[intervention.id]?.interventionNoc ? 'true' : undefined}
                  />
                </FormField>
              </ColumnLayout>
            )}

          </SpaceBetween>
        );
      })}
    </SpaceBetween>
  );

  const childcareStepContent = (
    <SpaceBetween size="l">
      <Grid gridDefinition={[{ colspan: 6 }]}>
        <FormField label="Childcare Need" description="Indicate if childcare is required to participate in the intervention.">
          <Select
            selectedOption={selectedChildcareOption}
            onChange={({ detail }) => handleField('childcareNeed', detail.selectedOption?.value || '')}
            options={CHILDCARE_OPTIONS}
            placeholder="Select childcare need"
            readOnly={isAssessmentDisabled}
          />
        </FormField>
      </Grid>
      {showChildcareFunding && (
        <Grid gridDefinition={[{ colspan: 12 }]}>
          <FormField
            label="Childcare Funding Details (optional)"
            description="Provide any known childcare supports (existing or requested)."
          >
            <Textarea
              value={assessment.childcareFunding || ''}
              onChange={({ detail }) => handleField('childcareFunding', detail.value)}
              spellcheck={true}
              readOnly={isAssessmentDisabled}
              disabled={assessment.childcareNeed !== 'yes'}
            />
          </FormField>
        </Grid>
      )}
    </SpaceBetween>
  );

  const toggleBarrier = (barrier, checked) => {
    const current = Array.isArray(assessment.barriers) ? assessment.barriers : [];
    const next = checked
      ? Array.from(new Set([...current, barrier]))
      : current.filter(item => item !== barrier);
    handleField('barriers', next);
  };

  const togglePriority = (priority, checked) => {
    const current = Array.isArray(assessment.priorities) ? assessment.priorities : [];
    const next = checked
      ? Array.from(new Set([...current, priority]))
      : current.filter(item => item !== priority);
    handleField('priorities', next);
  };

  const addOtherFundingSource = sourceDraft => {
    const current = Array.isArray(assessment.otherFundingSources) ? assessment.otherFundingSources : [];
    handleField('otherFundingSources', [...current, buildEmptyOtherFundingSource(sourceDraft || {})]);
  };

  const updateOtherFundingSource = (sourceId, updates = {}) => {
    const current = Array.isArray(assessment.otherFundingSources) ? assessment.otherFundingSources : [];
    const next = current.map(source =>
      String(source?.id || '') === String(sourceId || '')
        ? buildEmptyOtherFundingSource({ ...source, ...updates })
        : source
    );
    handleField('otherFundingSources', next);
  };

  const removeOtherFundingSource = (sourceId) => {
    const current = Array.isArray(assessment.otherFundingSources) ? assessment.otherFundingSources : [];
    const next = current.filter(source => String(source?.id || '') !== String(sourceId || ''));
    handleField('otherFundingSources', next);
  };

  const resetOtherFundingSourceModal = () => {
    setOtherFundingSourceModal(buildOtherFundingSourceModalState());
    setOtherFundingSourceModalErrors({});
  };

  const openAddOtherFundingSourceModal = () => {
    setOtherFundingSourceModal(
      buildOtherFundingSourceModalState({
        visible: true,
        mode: 'add',
        sourceId: null,
        draft: buildEmptyOtherFundingSource(),
        original: null
      })
    );
    setOtherFundingSourceModalErrors({});
  };

  const openEditOtherFundingSourceModal = sourceId => {
    const current = Array.isArray(assessment.otherFundingSources) ? assessment.otherFundingSources : [];
    const source = current.find(item => String(item?.id || '') === String(sourceId || ''));
    if (!source) return;
    const normalized = buildEmptyOtherFundingSource(source);
    setOtherFundingSourceModal(
      buildOtherFundingSourceModalState({
        visible: true,
        mode: 'edit',
        sourceId: normalized.id,
        draft: normalized,
        original: normalized
      })
    );
    setOtherFundingSourceModalErrors({});
  };

  const updateOtherFundingSourceModalDraft = updates => {
    setOtherFundingSourceModal(prev => {
      if (!prev?.draft) return prev;
      return {
        ...prev,
        draft: buildEmptyOtherFundingSource({
          ...prev.draft,
          ...(updates || {})
        })
      };
    });
  };

  const saveOtherFundingSourceModal = () => {
    const draft = buildEmptyOtherFundingSource(otherFundingSourceModal.draft || {});
    const errors = validateOtherFundingSourceDraft(draft);
    if (Object.keys(errors).length > 0) {
      setOtherFundingSourceModalErrors(errors);
      return;
    }
    if (otherFundingSourceModal.mode === 'edit' && otherFundingSourceModal.sourceId) {
      updateOtherFundingSource(otherFundingSourceModal.sourceId, draft);
      resetOtherFundingSourceModal();
      return;
    }
    addOtherFundingSource(draft);
    resetOtherFundingSourceModal();
  };

  const previousIsetStepContent = (
    <SpaceBetween size="l">
      <Grid gridDefinition={[{ colspan: 6 }]}>
        <FormField
          label="Has the client received previous ISET funding?"
          description="Select yes if the client has received ISET-funded supports in the past."
        >
          <Select
            selectedOption={CHILDCARE_OPTIONS.find(option => option.value === assessment.previousISET) || null}
            onChange={({ detail }) => handleField('previousISET', detail.selectedOption?.value || '')}
            options={CHILDCARE_OPTIONS}
            placeholder="Select"
            readOnly={isAssessmentDisabled}
          />
        </FormField>
      </Grid>
      {assessment.previousISET === 'yes' && (
        <Grid gridDefinition={[{ colspan: 12 }]}>
          <FormField
            label="Previous ISET funding details"
            description="If yes, please include year, program(s) and amount(s)"
            errorText={showPreviousIsetErrors && fieldErrors.previousISETDetails ? fieldErrors.previousISETDetails : undefined}
          >
            <Textarea
              value={assessment.previousISETDetails || ''}
              onChange={({ detail }) => handleField('previousISETDetails', detail.value)}
              spellcheck={false}
              data-error-focus={showPreviousIsetErrors && fieldErrors.previousISETDetails ? 'true' : undefined}
              tabIndex={-1}
              readOnly={isAssessmentDisabled}
            />
          </FormField>
        </Grid>
      )}
    </SpaceBetween>
  );

  const barriersStepContent = (
    <SpaceBetween size="l">
      <FormField
        label="Select barriers"
        description="Select all barriers that apply to this client."
        errorText={showBarriersErrors && fieldErrors.barriers ? fieldErrors.barriers : undefined}
      >
        <div
          data-error-focus={showBarriersErrors && fieldErrors.barriers ? 'true' : undefined}
          tabIndex={-1}
        >
          <div style={STABLE_CHECKBOX_GRID_STYLE}>
            {BARRIERS.map(barrier => (
              <Checkbox
                key={barrier}
                checked={(assessment.barriers || []).includes(barrier)}
                onChange={({ detail }) => toggleBarrier(barrier, detail.checked)}
                readOnly={isAssessmentDisabled}
              >
                {barrier}
              </Checkbox>
            ))}
          </div>
        </div>
      </FormField>
      {(assessment.barriers || []).includes('Other') && (
        <FormField
          label="Other barrier details"
          errorText={showBarriersErrors && fieldErrors.barriersOther ? fieldErrors.barriersOther : undefined}
        >
          <Input
            value={assessment.barriersOther || ''}
            onChange={({ detail }) => handleField('barriersOther', detail.value)}
            spellcheck={true}
            placeholder="Describe the other barrier"
            readOnly={isAssessmentDisabled}
          />
        </FormField>
      )}
    </SpaceBetween>
  );

  const prioritiesStepContent = (
    <SpaceBetween size="l">
      <FormField label="Select local priorities" description="Select all target areas that apply.">
        <ColumnLayout columns={2} variant="text-grid">
          {PRIORITIES.map(priority => (
            <Checkbox
              key={priority}
              checked={(assessment.priorities || []).includes(priority)}
              onChange={({ detail }) => togglePriority(priority, detail.checked)}
              readOnly={isAssessmentDisabled}
            >
              {priority}
            </Checkbox>
          ))}
        </ColumnLayout>
      </FormField>
    </SpaceBetween>
  );

  const otherFundingSourceItems = useMemo(
    () => normalizeOtherFundingSources(assessment.otherFundingSources, { keepEmpty: true }),
    [assessment.otherFundingSources]
  );

  const otherFundingSourceTableColumns = [
    {
      id: 'name',
      header: 'Funder name',
      minWidth: 180,
      cell: item => item.name || '\u2014'
    },
    {
      id: 'type',
      header: 'Funder type',
      minWidth: 140,
      cell: item => resolveOtherFunderTypeLabel(item.type)
    },
    {
      id: 'status',
      header: 'Status',
      minWidth: 150,
      cell: item => resolveOtherFunderStatusLabel(item.status)
    },
    {
      id: 'amount',
      header: 'Amount',
      minWidth: 120,
      cell: item => formatOtherFundingAmountDisplay(item.amount) || '\u2014'
    },
    {
      id: 'coverage',
      header: 'What this funder covers',
      minWidth: 260,
      cell: item => (
        <SpaceBetween size="xxs">
          <Box>{item.coverage || '\u2014'}</Box>
          {item.notes ? <Box fontStyle="italic">{item.notes}</Box> : null}
        </SpaceBetween>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 92,
      minWidth: 92,
      cell: item => (
        <SpaceBetween direction="horizontal" size="xxs">
          <Button
            variant="inline-icon"
            iconName="edit"
            ariaLabel={`Edit ${item.name || 'other funder'}`}
            onClick={() => openEditOtherFundingSourceModal(item.id)}
            disabled={isAssessmentDisabled}
          />
          <Button
            variant="inline-icon"
            iconName="remove"
            ariaLabel={`Delete ${item.name || 'other funder'}`}
            onClick={() => removeOtherFundingSource(item.id)}
            disabled={isAssessmentDisabled}
          />
        </SpaceBetween>
      )
    }
  ];

  const otherFundingStepContent = (
    <SpaceBetween size="l">
      <Grid gridDefinition={[{ colspan: 12 }]}>
        <FormField
          label="Other funding involved?"
          description="Identify whether other funding is part of this request."
        >
          <Select
            selectedOption={
              OTHER_FUNDING_INVOLVED_OPTIONS.find(option => option.value === assessment.otherFundingInvolved) || null
            }
            onChange={({ detail }) => {
              const nextValue = detail.selectedOption?.value || '';
              if (!nextValue || nextValue === 'no') {
                resetOtherFundingSourceModal();
              }
              handleField('otherFundingInvolved', nextValue);
            }}
            options={OTHER_FUNDING_INVOLVED_OPTIONS}
            placeholder="Select"
            readOnly={isAssessmentDisabled}
          />
        </FormField>
      </Grid>
      {assessment.otherFundingInvolved && assessment.otherFundingInvolved !== 'no' && (
        <SpaceBetween size="m">
          <Table
            stripedRows
            variant="embedded"
            trackBy="id"
            items={otherFundingSourceItems}
            columnDefinitions={otherFundingSourceTableColumns}
            resizableColumns
            header={
              <Header
                variant="h3"
                actions={
                  <Button onClick={openAddOtherFundingSourceModal} disabled={isAssessmentDisabled}>
                    Add other funder
                  </Button>
                }
              >
                Other funders
              </Header>
            }
            empty={
              <Alert type="info">
                Add each non-NWAC funder so coordination is clear.
              </Alert>
            }
          />
          <Grid gridDefinition={[{ colspan: 12 }]}>
            <FormField
              label="What NWAC funding will cover"
              description="Describe the NWAC-funded supports to avoid overlap."
            >
              <Textarea
                value={assessment.otherFundingNwacCoverage || ''}
                onChange={({ detail }) => handleField('otherFundingNwacCoverage', detail.value)}
                rows={3}
                spellcheck={true}
                readOnly={isAssessmentDisabled}
              />
            </FormField>
          </Grid>
        </SpaceBetween>
      )}
      <Grid gridDefinition={[{ colspan: 12 }]}>
        <FormField label="Additional notes (optional)">
          <Textarea
            value={assessment.otherFundingNotes || ''}
            onChange={({ detail }) => handleField('otherFundingNotes', detail.value)}
            rows={3}
            spellcheck={true}
            readOnly={isAssessmentDisabled}
          />
        </FormField>
      </Grid>
    </SpaceBetween>
  );

  const overallCostDisplay = formatCurrencyDisplay(overallCostTotal) || '$ 0.00';

  const costStepContent = (
    <SpaceBetween size="l">
      <Box fontWeight="bold">Total proposed cost: {overallCostDisplay}</Box>
      {proposedInterventions.map(intervention => {
        const costLines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        const interventionTotal = interventionTotals.get(intervention.id) || 0;
        const interventionTotalDisplay = formatCurrencyDisplay(interventionTotal) || '$ 0.00';
        const costItemOptions = buildCostItemOptions(intervention);
        const costLineErrors = costLineFieldErrors[intervention.id] || {};
        const interventionLabel = resolveInterventionLabel(intervention.code) || 'Intervention';
        return (
          <SpaceBetween key={intervention.id} size="s">
            <Header
              variant="h3"
              actions={
                <Button
                  onClick={() => openAddCostLineModal(intervention.id)}
                  disabled={isAssessmentDisabled || costItemOptions.length === 0}
                >
                  Add cost item
                </Button>
              }
            >
              {interventionLabel}
            </Header>
            <Table
              stripedRows
              variant="embedded"
              trackBy="id"
              items={costLines}
              resizableColumns
              columnDefinitions={[
                {
                  id: 'type',
                  header: 'Cost item',
                  cell: item => {
                    const label = paymentTypeLabelLookup.get(item.type) || item.type || '—';
                    return (
                      <Link
                        onFollow={event => {
                          event.preventDefault();
                          openCostLineModal(intervention.id, item.id);
                        }}
                      >
                        {label}
                      </Link>
                    );
                  }
                },
                {
                  id: 'amount',
                  header: 'Amount',
                  cell: item => {
                    const lineError = costLineErrors[item.id] || {};
                    const displayValue = inlineAmountEditingId === item.id
                      ? sanitizeCurrencyInput(item.amount, { preserveTrailingDecimal: true })
                      : getCurrencyInputDisplayValue(parseCurrencyInput(item.amount) ?? '', false);
                    return (
                      <FormField errorText={showCostErrors ? lineError.amount : undefined}>
                        <Input
                          inputMode="decimal"
                          value={displayValue}
                          onFocus={() => {
                            if (!isAssessmentDisabled) setInlineAmountEditingId(item.id);
                          }}
                          onChange={({ detail }) => handleInlineAmountChange(intervention.id, item.id, detail.value)}
                          onBlur={() => handleInlineAmountBlur(intervention.id, item.id)}
                          spellcheck={false}
                          placeholder="0.00"
                          readOnly={isAssessmentDisabled}
                          data-error-focus={showCostErrors && lineError.amount ? 'true' : undefined}
                        />
                      </FormField>
                    );
                  }
                },
                {
                  id: 'details',
                  header: 'Details',
                  cell: item => {
                    const details = getCostLineDetailsText(item, intervention);
                    return (
                      <SpaceBetween size="xxs">
                        <Box>{details.text}</Box>
                        {details.notesText && (
                          <Box fontStyle="italic">{details.notesText}</Box>
                        )}
                      </SpaceBetween>
                    );
                  }
                },
                {
                  id: 'actions',
                  header: '',
                  minWidth: 64,
                  width: 64,
                  cell: item => (
                    isAssessmentDisabled ? null : (
                      <Button
                        variant="inline-icon"
                        iconName="remove"
                        ariaLabel="Delete cost item"
                        onClick={() => removeCostLine(intervention.id, item.id)}
                      />
                    )
                  )
                }
              ]}
              empty={<Box padding={{ vertical: 's' }}>Intervention has no cost items.</Box>}
              footer={
                <Box textAlign="right" fontWeight="bold">
                  TOTAL: {interventionTotalDisplay}
                </Box>
              }
            />
          </SpaceBetween>
        );
      })}
    </SpaceBetween>
  );

  const docsStepContent = (
    <SpaceBetween size="m">
      {!applicantUserId && (
        <Alert type="info" header="Checklist unavailable" statusIconAriaLabel="Info">
          Checklist items are not available until the applicant is linked to this case.
        </Alert>
      )}
      {applicantUserId && !docsChecklistReady && !docsUploadLockedDismissed && (
        <Alert
          type="error"
          header="Save progress to enable uploads"
          dismissible
          onDismiss={() => setDocsUploadLockedDismissed(true)}
        >
          Save progress to link the application record before uploading documents and validating the checklist.
        </Alert>
      )}
      {checklistUploadError && (
        <Alert
          type="error"
          statusIconAriaLabel="Error"
          dismissible
          onDismiss={() => setChecklistUploadError(null)}
        >
          {checklistUploadError}
        </Alert>
      )}
      {checklistUploadSuccess && (
        <Alert
          type="success"
          statusIconAriaLabel="Success"
          dismissible
          onDismiss={() => setChecklistUploadSuccess(null)}
        >
          {checklistUploadSuccess}
        </Alert>
      )}
      {fundingFormsRequestSent && (
        <Alert type="info" header="Signature request sent">
          A secure message requesting funding-form signatures has been sent to the applicant. Mark the application complete only when every required item shows <strong>Complete</strong>.
        </Alert>
      )}
      <SpaceBetween size="s">
        {documentChecklistError && (
          <Alert type="error" dismissible onDismiss={() => setDocumentChecklistError(null)}>
            {documentChecklistError}
          </Alert>
        )}
        <Box>
          <Header
            variant="h3"
            description={
              !applicantUserId
                ? 'Link an applicant to load the checklist.'
                : !docsChecklistReady
                  ? 'Save progress to load the checklist for this assessment.'
                  : documentChecklistLoading
                    ? 'Loading checklist...'
                    : documentChecklistMissingCount > 0
                      ? `${documentChecklistMissingCount} required item${documentChecklistMissingCount === 1 ? '' : 's'} missing`
                      : <StatusIndicator type="success">All required checklist items are complete.</StatusIndicator>
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="icon"
                  iconName="refresh"
                  ariaLabel="Refresh checklist"
                  onClick={handleChecklistRefresh}
                  disabled={documentChecklistLoading || !docsChecklistReady}
                />
                <ButtonDropdown
                  variant="icon"
                  iconName="ellipsis"
                  ariaLabel="Checklist actions"
                  items={[
                    { id: 'supporting-documents', text: 'Open supporting documents' },
                    { id: 'secure-messaging', text: 'Open secure messaging' }
                  ]}
                  onItemClick={({ detail }) => {
                    if (detail.id === 'supporting-documents') {
                      openAssessmentWidget('supporting-documents');
                    }
                    if (detail.id === 'secure-messaging') {
                      openAssessmentWidget('secure-messaging');
                    }
                  }}
                />
              </SpaceBetween>
            }
          >
            Checklist
          </Header>
          <Table
            stripedRows
            resizableColumns
            trackBy="id"
            variant="embedded"
            loading={documentChecklistLoading}
            loadingText="Loading checklist"
            items={requiredDocumentChecklistItems}
            columnDefinitions={[
              {
                id: 'label',
                header: 'Item',
                minWidth: 240,
                cell: item => {
                  const rawDocTypes = Array.isArray(item?.documentTypes) ? item.documentTypes.filter(Boolean) : [];
                  const allowedDocTypes = canUploadEiVerification
                    ? rawDocTypes
                    : rawDocTypes.filter(type => type !== 'ei_verification');
                  const isRestricted = !allowedDocTypes.length;
                  if (item.status !== 'complete' && !isRestricted) {
                    return (
                        <Button
                          variant="inline-link"
                          onClick={() => handleChecklistUploadClick(item)}
                          disabled={!docsChecklistReady || checklistUploadsLocked || checklistUploading}
                        >
                          {item.label || item.id}
                        </Button>
                    );
                  }
                  return item.label || item.id;
                }
              },
              {
                id: 'status',
                header: 'Status',
                minWidth: 160,
                cell: item => {
                  if (item.status === 'complete') return <StatusIndicator type="success">Complete</StatusIndicator>;
                  if (item.status === 'missing') return <StatusIndicator type="error">Missing</StatusIndicator>;
                  if (item.status === 'in_progress') return <StatusIndicator type="info">In progress</StatusIndicator>;
                  return <StatusIndicator type="pending">Pending</StatusIndicator>;
                }
              }
            ]}
            empty={<Box textAlign="center">No checklist items required.</Box>}
          />
        </Box>
      </SpaceBetween>
    </SpaceBetween>
  );

  const letterGuidance = decisionOutcome === 'approved'
    ? 'Edit the client approval letter, then edit or review the institution, loan-provider, and other-funder letters in the tabs before downloading them.'
    : 'Write or generate a short letter explaining what is being denied and the reason for denial. Keep the letter policy and evidence based. If in doubt, please consult your manager.';

  const renderEditableLetters = (letters, emptyMessage, letterGroup, options = {}) => {
    if (options.requireDraftGeneration && !approvalLetterPackGenerated) {
      return (
        <Alert type="info" statusIconAriaLabel="Info">
          Click <strong>Generate drafts</strong> to create the approval letter pack.
        </Alert>
      );
    }
    if (!Array.isArray(letters) || !letters.length) {
      return (
        <Alert type="info" statusIconAriaLabel="Info">
          {emptyMessage}
        </Alert>
      );
    }
    return (
      <SpaceBetween size="l">
        {letters.map((letter, letterIndex) => (
          <Box key={letter.id || letter.title}>
            <Header
              variant="h4"
              actions={
                <Button
                  onClick={() => downloadLetterAsText(letter.fileName, letter.body)}
                  iconName="download"
                >
                  Download
                </Button>
              }
            >
              {letter.title}
            </Header>
            <Textarea
              value={letter.body || ''}
              onChange={({ detail }) => {
                updateApprovalLetterPackLetterBody(letterGroup, letter, detail.value || '', letterIndex);
              }}
              rows={14}
              spellcheck={true}
              disabled={isLetterEditingDisabled}
            />
          </Box>
        ))}
      </SpaceBetween>
    );
  };

  const clientLetterTabContent = (
    <SpaceBetween size="m">
      <Textarea
        value={letterBody}
        onChange={handleLetterBodyChange}
        rows={18}
        spellcheck={true}
        disabled={isLetterEditingDisabled}
      />
    </SpaceBetween>
  );

  const communicationStepContent = (
    <SpaceBetween size="m">
      <Box>
        <Header
          variant="h3"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                onClick={handleGenerateLetterDraft}
                disabled={!canGenerateLetterDraft || letterWorkflowsLoading}
                loading={draftingLetter}
                iconAlign="left"
                iconName={activeLetterKey === 'approval' ? 'gen-ai' : 'edit'}
              >
                {activeLetterKey === 'approval' ? 'Generate drafts' : 'Generate draft'}
              </Button>
              <Button
                onClick={() => persistLetterDraft({ silent: false })}
                disabled={!canSaveLetterDraft}
              >
                {activeLetterKey === 'approval' ? 'Save drafts' : 'Save draft'}
              </Button>
            </SpaceBetween>
          }
        >
          <Hotspot hotspotId="nwac-decision-letter" direction="right" />
          Decision letter
        </Header>
        {letterWorkflowsError && (
          <Alert type="error" statusIconAriaLabel="Error" dismissible onDismiss={() => setLetterWorkflowsError(null)}>
            {letterWorkflowsError}
          </Alert>
        )}
        {draftingLetterError && (
          <Alert type="error" statusIconAriaLabel="Error" dismissible onDismiss={() => setDraftingLetterError(null)}>
            {draftingLetterError}
          </Alert>
        )}
        {sendingLetterError && (
          <Alert type="error" statusIconAriaLabel="Error" dismissible onDismiss={() => setSendingLetterError(null)}>
            {sendingLetterError}
          </Alert>
        )}
        {!activeLetterKey && (
          <Alert type="info" statusIconAriaLabel="Info">
            Decision letters are available once an approval or denial has been recorded.
          </Alert>
        )}
        {deniedApplicationCloseoutComplete && (
          <Alert type="success" statusIconAriaLabel="Success">
            Denial letter sent. No further completion action is required for this denied application.
          </Alert>
        )}
        {activeLetterKey && (
          <SpaceBetween size="m">
            <Box>
              {letterGuidance}
            </Box>
            {showApprovalLetterPackTabs ? (
              <Tabs
                activeTabId={approvalLetterPackTabId}
                onChange={({ detail }) => setApprovalLetterPackTabId(detail.activeTabId)}
                tabs={[
                  {
                    id: 'client',
                    label: 'Client letter',
                    content: clientLetterTabContent
                  },
                  {
                    id: 'institution',
                    label: 'Institution letter',
                    content: renderEditableLetters(
                      approvalInstitutionLettersForDisplay,
                      'No institution-directed funding was identified from intervention delivery details and cost lines.',
                      'institutionLetters',
                      { requireDraftGeneration: true }
                    )
                  },
                  {
                    id: 'loan-provider',
                    label: 'Loan provider letters',
                    content: renderEditableLetters(
                      approvalLoanProviderLettersForDisplay,
                      'No student loan repayment lines were identified in the approved cost items.',
                      'loanProviderLetters',
                      { requireDraftGeneration: true }
                    )
                  },
                  {
                    id: 'other-funding',
                    label: 'Letters to other funders',
                    content: renderEditableLetters(
                      approvalCoFunderLettersForDisplay,
                      'No other funding sources were provided in the Other funding sources step.',
                      'coFunderLetters',
                      { requireDraftGeneration: true }
                    )
                  }
                ]}
              />
            ) : (
              <Textarea
                value={letterBody}
                onChange={handleLetterBodyChange}
                rows={18}
                spellcheck={true}
                disabled={isLetterEditingDisabled}
              />
            )}
          </SpaceBetween>
        )}
      </Box>
    </SpaceBetween>
  );

  const fundingDocsStepContent = (
    <SpaceBetween size="m">
      {!applicantUserId && (
        <Alert type="info" header="Checklist unavailable" statusIconAriaLabel="Info">
          Checklist items are not available until the applicant is linked to this case.
        </Alert>
      )}
      {applicantUserId && !docsChecklistReady && (
        <Alert type="error" header="Save progress to enable uploads">
          Save progress to link the application record before uploading documents and validating the checklist.
        </Alert>
      )}
      {checklistUploadError && (
        <Alert
          type="error"
          statusIconAriaLabel="Error"
          dismissible
          onDismiss={() => setChecklistUploadError(null)}
        >
          {checklistUploadError}
        </Alert>
      )}
      {checklistUploadSuccess && (
        <Alert
          type="success"
          statusIconAriaLabel="Success"
          dismissible
          onDismiss={() => setChecklistUploadSuccess(null)}
        >
          {checklistUploadSuccess}
        </Alert>
      )}
      <SpaceBetween size="s">
        {documentChecklistError && (
          <Alert type="error" dismissible onDismiss={() => setDocumentChecklistError(null)}>
            {documentChecklistError}
          </Alert>
        )}
        <Box>
          <Header
            variant="h3"
            description={
              !applicantUserId
                ? 'Link an applicant to load the checklist.'
                : !docsChecklistReady
                  ? 'Save progress to load the checklist for this assessment.'
                  : documentChecklistLoading
                    ? 'Loading checklist...'
                    : fundingDocsChecklistMissingCount > 0
                      ? `${fundingDocsChecklistMissingCount} required item${fundingDocsChecklistMissingCount === 1 ? '' : 's'} outstanding`
                      : <StatusIndicator type="success">All required items are complete.</StatusIndicator>
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="icon"
                  iconName="refresh"
                  ariaLabel="Refresh checklist"
                  onClick={handleChecklistRefresh}
                  disabled={documentChecklistLoading || !docsChecklistReady}
                />
                <ButtonDropdown
                  variant="icon"
                  iconName="ellipsis"
                  ariaLabel="Checklist actions"
                  items={[
                    { id: 'supporting-documents', text: 'Open supporting documents' },
                    { id: 'secure-messaging', text: 'Open secure messaging' }
                  ]}
                  onItemClick={({ detail }) => {
                    if (detail.id === 'supporting-documents') {
                      openAssessmentWidget('supporting-documents');
                    }
                    if (detail.id === 'secure-messaging') {
                      openAssessmentWidget('secure-messaging');
                    }
                  }}
                />
              </SpaceBetween>
            }
          >
            Funding forms checklist
          </Header>
          <Box variant="small" color="text-body-secondary" margin={{ bottom: 's' }}>
            Once the client signs and submits the required forms, mark the application complete. The client will then be active in the Case Management workspace if they are not already active.
          </Box>
          <Table
            stripedRows
            resizableColumns
            trackBy="id"
            variant="embedded"
            loading={documentChecklistLoading}
            loadingText="Loading checklist"
            items={requiredFundingDocsChecklistItems}
            columnDefinitions={[
              {
                id: 'label',
                header: 'Item',
                minWidth: 240,
                cell: item => {
                  const rawDocTypes = Array.isArray(item?.documentTypes) ? item.documentTypes.filter(Boolean) : [];
                  if (item.status !== 'complete' && rawDocTypes.length > 0) {
                    return (
                      <Button
                        variant="inline-link"
                        onClick={() => handleChecklistUploadClick(item)}
                        disabled={!docsChecklistReady || checklistUploadsLocked || checklistUploading}
                      >
                        {item.label || item.id}
                      </Button>
                    );
                  }
                  return item.label || item.id;
                }
              },
              {
                id: 'status',
                header: 'Status',
                minWidth: 160,
                cell: item => {
                  if (item.status === 'complete') return <StatusIndicator type="success">Complete</StatusIndicator>;
                  if (item.status === 'missing') return <StatusIndicator type="error">Missing</StatusIndicator>;
                  if (item.status === 'in_progress') return <StatusIndicator type="info">In progress</StatusIndicator>;
                  return <StatusIndicator type="pending">Pending</StatusIndicator>;
                }
              }
            ]}
            empty={<Box textAlign="center">No checklist items required.</Box>}
          />
        </Box>
      </SpaceBetween>
    </SpaceBetween>
  );

  const reviewOverview = assessment.overview?.trim() || '';
  const reviewEmploymentGoals = assessment.employmentGoals?.trim() || '';
  const reviewEligibility = assessment.esdcEligibility?.trim() || '';
  const reviewChildcareFunding = assessment.childcareFunding?.trim() || '';
  const reviewPreviousIsetDetails = assessment.previousISETDetails?.trim() || '';
  const reviewOtherFundingInvolved =
    assessment.otherFundingInvolved === 'yes'
      ? 'Yes'
      : assessment.otherFundingInvolved === 'no'
        ? 'No'
        : assessment.otherFundingInvolved === 'unknown'
          ? 'Unknown'
          : '';
  const reviewOtherFundingSources = normalizeOtherFundingSources(assessment.otherFundingSources);
  const reviewOtherFundingNwacCoverage = String(assessment.otherFundingNwacCoverage || '').trim();
  const reviewOtherFundingNotes = String(assessment.otherFundingNotes || '').trim();
  const reviewBarriers = assessment.barriers?.length ? assessment.barriers.join(', ') : 'None';
  const reviewBarriersOther = (assessment.barriers || []).includes('Other')
    ? (assessment.barriersOther || '').trim()
    : '';
  const reviewPriorities = assessment.priorities?.length ? assessment.priorities.join(', ') : 'None';
  const reviewPreviousIset = assessment.previousISET === 'yes' ? 'Yes' : assessment.previousISET === 'no' ? 'No' : '';
  const reviewChildcareNeed = assessment.childcareNeed === 'yes' ? 'Yes' : assessment.childcareNeed === 'no' ? 'No' : '';
  const reviewPostingContext = selectedPostingContext?.label || (assessment.postingContext ? formatCaseStatusLabel(assessment.postingContext) : '');
  const reviewOverallCost = formatCurrencyDisplay(overallCostTotal) || '$ 0.00';
  const reviewInterventions = proposedInterventions.map(intervention => {
    const label = resolveInterventionLabel(intervention.code) || 'Intervention';
    const noc = intervention.interventionNoc
      ? `${intervention.interventionNoc}${intervention.interventionNocVersion ? ` (${intervention.interventionNocVersion})` : ''}`
      : intervention.interventionNocVersion
        ? `NOC version ${intervention.interventionNocVersion}`
        : '';
    const providerLabel = intervention.deliveryMode === 'in_house'
      ? 'In House'
      : (intervention.institution || '').trim();
    return {
      id: intervention.id,
      label,
      provider: providerLabel,
      programName: (intervention.programName || '').trim(),
      startDate: intervention.startDate || '',
      endDate: intervention.endDate || '',
      itpDetails: (intervention.itpDetails || '').trim(),
      wageSubsidyDetails: (intervention.wageSubsidyDetails || '').trim(),
      noc
    };
  });
  const reviewInterventionTotals = proposedInterventions.map(intervention => ({
    id: intervention.id,
    label: resolveInterventionLabel(intervention.code) || 'Intervention',
    total: formatCurrencyDisplay(interventionTotals.get(intervention.id) || 0) || '$ 0.00'
  }));

  const reviewStepContent = (
    <SpaceBetween size="m">
      <ColumnLayout columns={2} variant="text-grid">
        <Box>
          <Header variant="h4">Assessment</Header>
          {reviewOverview ? <div>Overview: {reviewOverview}</div> : null}
          {reviewEmploymentGoals ? <div>Employment goals: {reviewEmploymentGoals}</div> : null}
          <div>Barriers: {reviewBarriers}</div>
          {reviewBarriersOther ? <div>Other barrier details: {reviewBarriersOther}</div> : null}
          <div>Local priorities: {reviewPriorities}</div>
        </Box>
        <Box>
          <Header variant="h4">Client context</Header>
          {reviewEligibility ? <div>Employment Insurance Status: {reviewEligibility}</div> : null}
          {reviewChildcareNeed ? <div>Childcare need: {reviewChildcareNeed}</div> : null}
          {reviewChildcareFunding ? <div>Childcare funding: {reviewChildcareFunding}</div> : null}
          {reviewPreviousIset ? <div>Previous ISET funding: {reviewPreviousIset}</div> : null}
          {reviewPreviousIsetDetails ? <div>Previous ISET details: {reviewPreviousIsetDetails}</div> : null}
          {reviewOtherFundingInvolved ? <div>Other funding involved: {reviewOtherFundingInvolved}</div> : null}
          {reviewOtherFundingSources.length ? (
            <SpaceBetween size="xxs">
              {reviewOtherFundingSources.map((source, index) => (
                <div key={source.id || `${source.name}-${index}`}>
                  {resolveOtherFunderTypeLabel(source.type)}: {source.name || 'Unnamed funder'} ({resolveOtherFunderStatusLabel(source.status)})
                  {formatOtherFundingAmountDisplay(source.amount) ? ` — ${formatOtherFundingAmountDisplay(source.amount)}` : ''}
                  {source.coverage ? ` — ${source.coverage}` : ''}
                  {source.notes ? ` — ${source.notes}` : ''}
                </div>
              ))}
            </SpaceBetween>
          ) : null}
          {reviewOtherFundingNwacCoverage ? <div>NWAC funding covers: {reviewOtherFundingNwacCoverage}</div> : null}
          {reviewOtherFundingNotes ? <div>Notes: {reviewOtherFundingNotes}</div> : null}
        </Box>
        <Box>
          <Header variant="h4">Proposed Interventions</Header>
          {reviewInterventions.length === 0 ? (
            <div>—</div>
          ) : (
            <SpaceBetween size="s">
              {reviewInterventions.map(intervention => (
                <Box key={intervention.id}>
                  <Box fontWeight="bold">{intervention.label}</Box>
                  {intervention.provider ? <div>Provider: {intervention.provider}</div> : null}
                  {intervention.programName ? <div>Program name: {intervention.programName}</div> : null}
                  {intervention.noc ? <div>NOC: {intervention.noc}</div> : null}
                  {intervention.itpDetails ? <div>ITP details: {intervention.itpDetails}</div> : null}
                  {intervention.wageSubsidyDetails ? <div>Wage subsidy details: {intervention.wageSubsidyDetails}</div> : null}
                  {intervention.startDate ? <div>Start: {intervention.startDate}</div> : null}
                  {intervention.endDate ? <div>End: {intervention.endDate}</div> : null}
                </Box>
              ))}
            </SpaceBetween>
          )}
        </Box>
        <Box>
          <Header variant="h4">Costs</Header>
          {reviewInterventionTotals.length > 1 ? (
            <>
              <div>Overall proposed cost: {reviewOverallCost}</div>
              {reviewInterventionTotals.map(item => (
                <div key={item.id}>{item.label}: {item.total}</div>
              ))}
            </>
          ) : (
            <div>
              {reviewInterventionTotals[0]?.label
                ? `${reviewInterventionTotals[0].label} total: ${reviewInterventionTotals[0].total}`
                : `Overall proposed cost: ${reviewOverallCost}`}
            </div>
          )}
          {selectedBudgetPotOption?.label ? <div>Budget pot: {selectedBudgetPotOption.label}</div> : null}
          {reviewPostingContext ? <div>Paid from: {reviewPostingContext}</div> : null}
        </Box>
      </ColumnLayout>
      {renderRecommendationSection({
        readOnly: isAssessmentDisabled || (assessmentSubmitted && !isEditingAssessment),
        showErrors: shouldShowStepErrors('review')
      })}
    </SpaceBetween>
  );

  const hasFundingDecision = Boolean(assessment.nwacReviewStatus);
  const shouldShowDecisionPendingAlert =
    showDecisionPendingAlert && isIsetCoordinator && !hasFundingDecision && !isDecisionFinal;

  const otherFundingSourceModalDraft = otherFundingSourceModal.draft
    ? buildEmptyOtherFundingSource(otherFundingSourceModal.draft)
    : null;
  const otherFundingSourceModalDirty =
    otherFundingSourceModal.mode === 'edit'
      ? JSON.stringify(otherFundingSourceModalDraft || {}) !==
        JSON.stringify(otherFundingSourceModal.original || {})
      : true;
  const otherFundingSourceModalContent = (
    <Modal
      visible={otherFundingSourceModal.visible}
      onDismiss={resetOtherFundingSourceModal}
      header={otherFundingSourceModal.mode === 'add' ? 'Add other funder' : 'Edit other funder'}
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="primary"
            onClick={saveOtherFundingSourceModal}
            disabled={isAssessmentDisabled || (otherFundingSourceModal.mode === 'edit' && !otherFundingSourceModalDirty)}
          >
            {otherFundingSourceModal.mode === 'add' ? 'Add funder' : 'Save changes'}
          </Button>
          <Button variant="link" onClick={resetOtherFundingSourceModal}>Cancel</Button>
        </SpaceBetween>
      }
    >
      {otherFundingSourceModalDraft && (
        <SpaceBetween size="s">
          <FormField label="Funder name" errorText={otherFundingSourceModalErrors.name}>
            <Input
              value={otherFundingSourceModalDraft.name || ''}
              onChange={({ detail }) => {
                updateOtherFundingSourceModalDraft({ name: detail.value });
                setOtherFundingSourceModalErrors(prev => {
                  const next = { ...prev };
                  delete next.name;
                  return next;
                });
              }}
              spellcheck={false}
              readOnly={isAssessmentDisabled}
            />
          </FormField>
          <FormField label="Funder type">
            <Select
              selectedOption={
                OTHER_FUNDER_TYPE_OPTIONS.find(option => option.value === otherFundingSourceModalDraft.type) ||
                OTHER_FUNDER_TYPE_OPTIONS.find(option => option.value === 'other') ||
                OTHER_FUNDER_TYPE_OPTIONS[0]
              }
              onChange={({ detail }) => {
                updateOtherFundingSourceModalDraft({ type: detail.selectedOption?.value || 'other' });
              }}
              options={OTHER_FUNDER_TYPE_OPTIONS}
              placeholder="Select funder type"
              readOnly={isAssessmentDisabled}
            />
          </FormField>
          <FormField label="Funding status">
            <Select
              selectedOption={
                OTHER_FUNDER_STATUS_OPTIONS.find(option => option.value === otherFundingSourceModalDraft.status) ||
                OTHER_FUNDER_STATUS_OPTIONS.find(option => option.value === OTHER_FUNDER_STATUS_CONFIRMED)
              }
              onChange={({ detail }) => {
                updateOtherFundingSourceModalDraft({ status: detail.selectedOption?.value || OTHER_FUNDER_STATUS_CONFIRMED });
                setOtherFundingSourceModalErrors(prev => {
                  const next = { ...prev };
                  delete next.coverage;
                  return next;
                });
              }}
              options={OTHER_FUNDER_STATUS_OPTIONS}
              placeholder="Select funding status"
              readOnly={isAssessmentDisabled}
            />
          </FormField>
          <FormField
            label="Amount (optional)"
            description="Leave blank if the amount is not known or not applicable."
            errorText={otherFundingSourceModalErrors.amount}
          >
            <Input
              inputMode="decimal"
              value={otherFundingSourceModalDraft.amount || ''}
              onChange={({ detail }) => {
                updateOtherFundingSourceModalDraft({ amount: detail.value });
                setOtherFundingSourceModalErrors(prev => {
                  const next = { ...prev };
                  delete next.amount;
                  return next;
                });
              }}
              placeholder="0.00"
              spellcheck={false}
              readOnly={isAssessmentDisabled}
            />
          </FormField>
          <FormField
            label="What this funder covers"
            description="Required only when funding is confirmed."
            errorText={otherFundingSourceModalErrors.coverage}
          >
            <Textarea
              value={otherFundingSourceModalDraft.coverage || ''}
              rows={4}
              onChange={({ detail }) => {
                updateOtherFundingSourceModalDraft({ coverage: detail.value });
                setOtherFundingSourceModalErrors(prev => {
                  const next = { ...prev };
                  delete next.coverage;
                  return next;
                });
              }}
              spellcheck={true}
              readOnly={isAssessmentDisabled}
            />
          </FormField>
          <FormField label="Funder notes (optional)">
            <Textarea
              value={otherFundingSourceModalDraft.notes || ''}
              rows={3}
              onChange={({ detail }) => {
                updateOtherFundingSourceModalDraft({ notes: detail.value });
              }}
              spellcheck={true}
              readOnly={isAssessmentDisabled}
            />
          </FormField>
        </SpaceBetween>
      )}
    </Modal>
  );

  const interventionModalDraft = interventionModal.draft || null;
  const interventionModalMode = interventionModal.mode;
  const interventionModalEditable = interventionModalMode === 'add' || interventionModalMode === 'edit';
  const interventionModalDirty =
    interventionModalMode === 'edit'
      ? JSON.stringify(interventionModalDraft || {}) !== JSON.stringify(interventionModal.original || {})
      : true;
  const showStartDateWarning = Boolean(
    interventionModalEditable && interventionModalDraft?.startDate && isDateInPast(interventionModalDraft.startDate)
  );
  const activeInterventionErrors = {
    ...(showFramingErrors ? (interventionFieldErrors[interventionModal.interventionId] || {}) : {}),
    ...((interventionModalMode === 'add' || interventionModalMode === 'edit') ? interventionModalErrors : {})
  };
  const interventionModalErrorList = useMemo(() => {
    const messages = [];
    if (interventionModalErrors.code) messages.push(interventionModalErrors.code);
    if (interventionModalErrors.startDate) messages.push(interventionModalErrors.startDate);
    if (interventionModalErrors.endDate) messages.push(interventionModalErrors.endDate);
    return messages;
  }, [interventionModalErrors]);
  const interventionCodeLabel = interventionModalDraft
    ? resolveInterventionLabel(interventionModalDraft.code) || interventionModalDraft.code || ''
    : '';

  const interventionModalContent = (
    <Modal
      visible={interventionModal.visible}
      onDismiss={resetInterventionModal}
      header={interventionModalMode === 'add' ? 'Add intervention' : 'Intervention details'}
      footer={
        interventionModalMode === 'view' ? (
          <SpaceBetween direction="horizontal" size="xs">
            {!isAssessmentDisabled && (
              <Button variant="primary" onClick={startInterventionEdit}>Edit</Button>
            )}
            {!isAssessmentDisabled && (
              <Button
                variant="normal"
                onClick={() => {
                  if (!interventionModal.interventionId) return;
                  setInterventionDeleteId(interventionModal.interventionId);
                  resetInterventionModal();
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="link" onClick={resetInterventionModal}>Close</Button>
          </SpaceBetween>
        ) : (
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={saveInterventionModal}
              disabled={isAssessmentDisabled || (interventionModalMode === 'edit' && !interventionModalDirty)}
            >
              {interventionModalMode === 'add' ? 'Add intervention' : 'Save changes'}
            </Button>
            <Button
              variant="link"
              onClick={interventionModalMode === 'add' ? resetInterventionModal : cancelInterventionEdit}
            >
              Cancel
            </Button>
          </SpaceBetween>
        )
      }
    >
      {interventionModalDraft && (
        <SpaceBetween size="s">
          {interventionModalErrorList.length > 0 && (
            <Alert type="error" statusIconAriaLabel="Error" header="Please correct the following">
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {interventionModalErrorList.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </Alert>
          )}
          <Box variant="small" color="text-body-secondary">
            You can propose multiple interventions. If you recommend approving this application,
            include at least one proposed intervention. If the application is approved, you can add
            more interventions later for this applicant.
          </Box>
          <FormField
            label="Intervention code"
            description={
              interventionModalMode !== 'add'
                ? 'To change the code, delete this intervention and add a new one.'
                : undefined
            }
            errorText={activeInterventionErrors.code}
          >
            {interventionModalMode === 'add' ? (
              <Select
                selectedOption={
                  interventionCodes.find(option => String(option.value) === String(interventionModalDraft.code)) || null
                }
                onChange={({ detail }) => {
                  updateInterventionModalDraft({ code: detail.selectedOption?.value || '' });
                  setInterventionModalErrors({});
                }}
                options={interventionCodes}
                placeholder={interventionCodesLoading ? 'Loading intervention codes' : 'Select intervention'}
                statusType={interventionCodesLoading ? 'loading' : 'finished'}
                loadingText="Loading intervention codes"
                readOnly={isAssessmentDisabled}
              />
            ) : (
              <Input value={interventionCodeLabel} readOnly />
            )}
          </FormField>
          <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
            <FormField
              label="Start date"
              description="All interventions require a start date."
              errorText={activeInterventionErrors.startDate}
              warningText={showStartDateWarning ? 'Start date is in the past. Update the date if needed.' : undefined}
            >
              <DatePicker
                value={interventionModalDraft.startDate || ''}
                onChange={({ detail }) => {
                  updateInterventionModalDraft({ startDate: detail.value });
                  setInterventionModalErrors(prev => {
                    if (!prev.startDate && !prev.endDate) return prev;
                    const next = { ...prev };
                    delete next.startDate;
                    delete next.endDate;
                    return next;
                  });
                }}
                readOnly={!interventionModalEditable || isAssessmentDisabled}
              />
            </FormField>
            <FormField
              label="End date"
              description="Planned end date."
              errorText={activeInterventionErrors.endDate}
            >
              <DatePicker
                value={interventionModalDraft.endDate || ''}
                onChange={({ detail }) => {
                  updateInterventionModalDraft({ endDate: detail.value });
                  setInterventionModalErrors(prev => {
                    if (!prev.endDate) return prev;
                    const next = { ...prev };
                    delete next.endDate;
                    return next;
                  });
                }}
                readOnly={!interventionModalEditable || isAssessmentDisabled}
              />
            </FormField>
          </Grid>
        </SpaceBetween>
      )}
    </Modal>
  );

  const interventionToDelete = interventionDeleteId
    ? proposedInterventions.find(item => item.id === interventionDeleteId)
    : null;
  const interventionDeleteModal = (
    <Modal
      visible={Boolean(interventionDeleteId)}
      onDismiss={() => setInterventionDeleteId(null)}
      header="Delete intervention?"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" onClick={confirmInterventionDelete} disabled={isAssessmentDisabled}>
            Delete intervention
          </Button>
          <Button variant="normal" onClick={() => setInterventionDeleteId(null)}>Cancel</Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        <Alert type="warning" statusIconAriaLabel="Warning">
          Deleting this intervention will remove all cost items linked to it.
        </Alert>
        <Box>
          {interventionToDelete
            ? `Delete ${resolveInterventionLabel(interventionToDelete.code) || 'this intervention'}?`
            : 'Delete this intervention?'}
        </Box>
      </SpaceBetween>
    </Modal>
  );

  const costLineIntervention = costLineModal.interventionId
    ? proposedInterventions.find(item => item.id === costLineModal.interventionId)
    : null;
  const costLineInterventionLabel = costLineIntervention
    ? resolveInterventionLabel(costLineIntervention.code) || 'Intervention'
    : '';
  const costLineDraft = costLineModal.draft || null;
  const costLineMode = costLineModal.mode;
  const isCostLineEditable = costLineMode === 'edit' || costLineMode === 'add';
  const costLineTypeOptions = costLineIntervention ? buildCostItemOptions(costLineIntervention) : [];
  const costLineTypeLabel = costLineDraft
    ? (paymentTypeLabelLookup.get(costLineDraft.type) || costLineDraft.type || '')
    : '';
  const costLineRecurrenceMode = getRecurrenceModeForType(costLineDraft?.type);
  const costLineRecurrenceRequired = costLineRecurrenceMode === 'required';
  const costLineRecurrenceDisabled = costLineRecurrenceMode === 'not_allowed';
  const costLineRecurrenceEnabled = costLineRecurrenceDisabled
    ? false
    : costLineRecurrenceRequired || Boolean(costLineDraft?.recurrence?.enabled);
  const costLineDirty =
    costLineMode === 'edit'
      ? JSON.stringify(costLineDraft || {}) !== JSON.stringify(costLineModal.original || {})
      : true;
  const costLineAmountDisplay = costLineDraft
    ? getCurrencyInputDisplayValue(
        sanitizeCurrencyInput(costLineDraft.amount, { preserveTrailingDecimal: costLineAmountFocused }),
        isCostLineEditable ? costLineAmountFocused : false
      )
    : '';
  const costLineAmountPerPeriodDisplay = costLineDraft
    ? getCurrencyInputDisplayValue(
        sanitizeCurrencyInput(costLineDraft.recurrence?.amountPerPeriod, {
          preserveTrailingDecimal: costLineAmountPerPeriodFocused,
        }),
        isCostLineEditable ? costLineAmountPerPeriodFocused : false
      )
    : '';
  const costLineRecurrenceStart =
    costLineDraft?.recurrence?.startDate || costLineIntervention?.startDate || '';
  const costLineRecurrenceEnd =
    costLineDraft?.recurrence?.endDate || costLineIntervention?.endDate || '';
  const costLinePayeeType = String(costLineDraft?.payee?.type || '').trim();
  const costLineIsStudentLoanRepayment =
    normalizePaymentTypeCode(costLineDraft?.type) === 'StudentLoanRepayment' ||
    normalizePayeeTypeKey(costLinePayeeType) === 'studentloanservicer';
  const isParticipantPayeeType = costLinePayeeType === PAYEE_TYPE_PARTICIPANT_CLIENT;
  const lockParticipantPayeeName = isParticipantPayeeType && Boolean(participantLegalName);
  const costLinePayeeNamePlaceholder = isParticipantPayeeType
    ? participantLegalName
      ? 'Auto-filled from participant legal name'
      : 'Participant legal name unavailable - enter full legal name'
    : costLineIsStudentLoanRepayment
      ? 'Enter loan provider or servicer name'
    : 'Enter payee name';

  const costLineDetailModal = (
    <Modal
      visible={costLineModal.visible}
      onDismiss={resetCostLineModal}
      header={costLineMode === 'add' ? 'Add cost item' : 'Cost item details'}
      footer={
        costLineMode === 'view' ? (
          <SpaceBetween direction="horizontal" size="xs">
            {!isAssessmentDisabled && (
              <Button variant="primary" onClick={startCostLineEdit}>Edit</Button>
            )}
            {!isAssessmentDisabled && (
              <Button variant="normal" onClick={deleteCostLineFromModal}>Delete</Button>
            )}
            <Button variant="link" onClick={resetCostLineModal}>Close</Button>
          </SpaceBetween>
        ) : (
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={saveCostLineModal}
              disabled={isAssessmentDisabled || (costLineMode === 'edit' && !costLineDirty)}
            >
              {costLineMode === 'add' ? 'Add cost item' : 'Save changes'}
            </Button>
            <Button
              variant="link"
              onClick={costLineMode === 'add' ? resetCostLineModal : cancelCostLineEdit}
            >
              Cancel
            </Button>
          </SpaceBetween>
        )
      }
    >
      {costLineDraft && (
        <SpaceBetween size="s">
          <Box>Intervention: {costLineInterventionLabel || '—'}</Box>
          <FormField label="Cost item" errorText={costLineModalErrors.type}>
            {isCostLineEditable ? (
              <Select
                selectedOption={
                  costLineTypeOptions.find(option => option.value === costLineDraft.type) ||
                  (costLineDraft.type
                    ? { value: costLineDraft.type, label: paymentTypeLabelLookup.get(costLineDraft.type) || costLineDraft.type }
                    : null)
                }
                onChange={({ detail }) => updateCostLineType(detail.selectedOption?.value || '')}
                options={costLineTypeOptions}
                placeholder="Select cost item"
                readOnly={isAssessmentDisabled}
              />
            ) : (
              <Input value={costLineTypeLabel} readOnly />
            )}
          </FormField>
          <FormField label="Total amount">
            <Input
              inputMode="decimal"
              value={costLineAmountDisplay}
              onChange={({ detail }) => updateCostLineAmount(detail.value)}
              onFocus={() => setCostLineAmountFocused(true)}
              onBlur={blurCostLineAmount}
              spellcheck={false}
              placeholder="0.00"
              readOnly={!isCostLineEditable || isAssessmentDisabled}
            />
          </FormField>
          <FormField label="Payee type">
            <Select
              selectedOption={findOptionByValue(configuredPayeeTypeOptions, costLineDraft.payee?.type)}
              onChange={({ detail }) => updateCostLinePayeeType(detail.selectedOption?.value || '')}
              options={configuredPayeeTypeOptions}
              placeholder="Select payee type"
              readOnly={!isCostLineEditable || isAssessmentDisabled}
            />
          </FormField>
          <FormField label={costLineIsStudentLoanRepayment ? 'Loan provider / servicer name' : 'Payee name'}>
            <Input
              value={costLineDraft.payee?.name || ''}
              onChange={({ detail }) =>
                updateCostLineDraft({
                  payee: {
                    ...(costLineDraft.payee || {}),
                    name: detail.value
                  }
                })
              }
              spellcheck={false}
              placeholder={costLinePayeeNamePlaceholder}
              readOnly={!isCostLineEditable || isAssessmentDisabled || lockParticipantPayeeName}
            />
          </FormField>
          {costLinePayeeType && !isParticipantPayeeType && (
            <FormField label={costLineIsStudentLoanRepayment ? 'Loan account number (optional)' : 'Payee reference (optional)'}>
              <Input
                value={costLineDraft.payee?.reference || ''}
                onChange={({ detail }) =>
                  updateCostLineDraft({
                    payee: {
                      ...(costLineDraft.payee || {}),
                      reference: detail.value
                    }
                  })
                }
                spellcheck={false}
                placeholder={costLineIsStudentLoanRepayment ? 'Enter loan account number' : 'Vendor/account reference'}
                readOnly={!isCostLineEditable || isAssessmentDisabled}
              />
            </FormField>
          )}
          <FormField
            label="Installments (monthly)"
            errorText={costLineModalErrors.recurrence}
          >
            <Checkbox
              checked={costLineRecurrenceEnabled}
              onChange={({ detail }) => toggleCostLineRecurrence(detail.checked)}
              disabled={!isCostLineEditable || costLineRecurrenceRequired || costLineRecurrenceDisabled || isAssessmentDisabled}
            >
              Enable installments
            </Checkbox>
          </FormField>
          {costLineRecurrenceEnabled && (
            <SpaceBetween size="s">
              <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                <FormField label="Start date">
                  <DatePicker
                    value={costLineRecurrenceStart}
                    onChange={({ detail }) => updateCostLineRecurrenceStart(detail.value)}
                    readOnly={!isCostLineEditable || isAssessmentDisabled}
                  />
                </FormField>
                <FormField label="End date (optional)">
                  <DatePicker
                    value={costLineRecurrenceEnd}
                    onChange={({ detail }) => updateCostLineRecurrenceEnd(detail.value)}
                    readOnly={!isCostLineEditable || isAssessmentDisabled}
                  />
                </FormField>
              </Grid>
              <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                <FormField label="Number of installments">
                  <Input
                    inputMode="numeric"
                    value={costLineDraft.recurrence?.occurrences || ''}
                    onChange={({ detail }) => updateCostLineOccurrences(detail.value)}
                    spellcheck={false}
                    readOnly={!isCostLineEditable || isAssessmentDisabled}
                  />
                </FormField>
                <FormField label="Amount per month">
                  <Input
                    inputMode="decimal"
                    value={costLineAmountPerPeriodDisplay}
                    onChange={({ detail }) => updateCostLineAmountPerPeriod(detail.value)}
                    onFocus={() => setCostLineAmountPerPeriodFocused(true)}
                    onBlur={blurCostLineAmountPerPeriod}
                    spellcheck={false}
                    readOnly={!isCostLineEditable || isAssessmentDisabled}
                  />
                </FormField>
              </Grid>
            </SpaceBetween>
          )}
          <FormField label="Notes (optional)">
            <Textarea
              value={costLineDraft.notes || ''}
              rows={3}
              onChange={({ detail }) => updateCostLineDraft({ notes: detail.value })}
              spellcheck={true}
              readOnly={!isCostLineEditable || isAssessmentDisabled}
            />
          </FormField>
        </SpaceBetween>
      )}
    </Modal>
  );

  const endDateAdjustmentModal = (
    <Modal
      visible={Boolean(endDateAdjustModal)}
      onDismiss={() => setEndDateAdjustModal(null)}
      header="Update installments schedule?"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="primary"
            onClick={() => {
              if (!endDateAdjustModal) return;
              const nextDates = { endDate: endDateAdjustModal.nextEndDate };
              if (typeof endDateAdjustModal.nextStartDate !== 'undefined') {
                nextDates.startDate = endDateAdjustModal.nextStartDate;
              }
              applyInterventionDateChange(
                endDateAdjustModal.interventionId,
                nextDates,
                endDateAdjustModal.mode
              );
              setEndDateAdjustModal(null);
            }}
          >
            Apply change
          </Button>
          <Button variant="normal" onClick={() => setEndDateAdjustModal(null)}>Cancel</Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        <Box>
          Changing the intervention end date will adjust installments. Choose how to update recurring totals.
        </Box>
        <RadioGroup
          value={endDateAdjustModal?.mode || 'total'}
          onChange={({ detail }) => setEndDateAdjustModal(prev => (prev ? { ...prev, mode: detail.value } : prev))}
          items={[
            { value: 'total', label: 'Adjust total (keep monthly amount)' },
            { value: 'per_period', label: 'Adjust monthly amount (keep total)' }
          ]}
        />
      </SpaceBetween>
    </Modal>
  );

  const occurrenceChangeModal = (
    <Modal
      visible={Boolean(occurrenceConfirmModal)}
      onDismiss={() => setOccurrenceConfirmModal(null)}
      header="Update intervention end date?"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" onClick={confirmOccurrencesUpdateEndDate}>
            Update end date
          </Button>
          <Button variant="normal" onClick={keepOccurrencesWithoutEndDateChange}>
            Keep current end date
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        <Box>
          The number of installments no longer matches the intervention end date. Do you want to update the end date to
          match the new schedule?
        </Box>
      </SpaceBetween>
    </Modal>
  );

  const denialReasonGuidance = denialReasonWordCount > DENIAL_REASON_WORD_LIMIT
    ? `Words: ${denialReasonWordCount}/${DENIAL_REASON_WORD_LIMIT} (over the guidance limit)`
    : `Words: ${denialReasonWordCount}/${DENIAL_REASON_WORD_LIMIT} (guidance only)`;
  const denialReasonModal = (
    <Modal
      visible={denialReasonModalVisible}
      onDismiss={() => {
        setDenialReasonModalVisible(false);
        setDenialReasonErrors({});
      }}
      header="Denial reason for draft"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={() => setDenialReasonModalVisible(false)} disabled={draftingLetter}>
            Cancel
          </Button>
          <Button
            iconAlign="left"
            iconName="edit"
            onClick={handleConfirmDenialReason}
            disabled={draftingLetter}
          >
            Draft letter
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        <Box>
          Select the primary denial reason and summarize it in your own words. This information is saved with the denial workflow and used for reporting.
        </Box>
        <FormField label="Primary denial reason" errorText={denialReasonErrors.reason}>
          <RadioGroup
            value={denialReasonChoice}
            onChange={({ detail }) => {
              setDenialReasonChoice(detail.value);
              setDenialReasonExplanation('');
              setDenialReasonErrors(prev => ({ ...prev, reason: null, explanation: null }));
            }}
            items={DENIAL_REASON_OPTIONS}
          />
        </FormField>
        {denialReasonChoice && (
          <FormField
            label="Brief explanation and suggestions"
            description="Explain how the selected criterion was not met, and include any referral or suggested next steps."
            errorText={denialReasonErrors.explanation}
            constraintText={denialReasonGuidance}
          >
            <Textarea
              value={denialReasonExplanation}
              onChange={({ detail }) => {
                setDenialReasonExplanation(detail.value || '');
                setDenialReasonErrors(prev => ({ ...prev, explanation: null }));
              }}
              placeholder={assessment.nwacReason || ''}
              rows={4}
              spellcheck={true}
            />
          </FormField>
        )}
      </SpaceBetween>
    </Modal>
  );

  const denyFundingModal = (
    <Modal
      visible={denyFundingModalVisible}
      onDismiss={() => {
        if (denyFundingLoading) return;
        setDenyFundingModalVisible(false);
      }}
      header="Deny funding?"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="link"
            onClick={() => setDenyFundingModalVisible(false)}
            disabled={denyFundingLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleDenyFundingConfirm}
            loading={denyFundingLoading}
            disabled={!canUseDenyFundingShortcut || denyFundingLoading}
          >
            Continue
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        <Box>{denyFundingConfirmMessage}</Box>
        {denyFundingBlockedReason ? (
          <Alert type="warning">
            {denyFundingBlockedReason}
          </Alert>
        ) : null}
        {isChanged ? (
          <Alert type="warning">
            You have unsaved assessment changes. Save progress if you need to keep them before denying funding.
          </Alert>
        ) : null}
      </SpaceBetween>
    </Modal>
  );

  const checklistUploadModal = (
    <Modal
      visible={checklistUploadModalVisible}
      onDismiss={handleChecklistUploadModalDismiss}
      header="Select document type"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={handleChecklistUploadModalDismiss}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleChecklistUploadModalConfirm}>
            Upload
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        {checklistUploadError && (
          <Alert type="error" dismissible onDismiss={() => setChecklistUploadError(null)}>
            {checklistUploadError}
          </Alert>
        )}
        <Box>
          {checklistUploadLabel ? `Uploading for: ${checklistUploadLabel}` : 'Choose a document type to upload.'}
        </Box>
        <FormField label="Document type">
          <Select
            selectedOption={
              checklistUploadDocTypeOptions.find(option => option.value === checklistUploadDocType) || null
            }
            onChange={({ detail }) => setChecklistUploadDocType(detail?.selectedOption?.value || '')}
            options={checklistUploadDocTypeOptions}
            placeholder="Select document type"
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );

  const decisionAlignmentWarning = buildAssessmentDecisionAlignmentError({
    recommendation: assessment.recommendation,
    assessmentReview: assessment.nwacReview,
    decisionStatus: assessment.nwacReviewStatus,
  });
  const caseManagerRecommendationSummary = (
    <SpaceBetween size="xs">
      <Header variant="h3">Case manager assessment recommendation</Header>
      <ColumnLayout columns={2} variant="text-grid" minColumnWidth={260}>
        <Box>
          <Box fontWeight="bold">Submitted recommendation</Box>
          <div>{resolveRecommendationLabel(assessment.recommendation)}</div>
        </Box>
        <Box>
          <Box fontWeight="bold">Case manager rationale</Box>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {String(assessment.justification || '').trim() || 'No rationale recorded.'}
          </div>
        </Box>
      </ColumnLayout>
    </SpaceBetween>
  );
  const rmReviewNote = String(reviewWorkflow?.rmReviewNote || reviewWorkflow?.rm_review_note || '').trim();
  const nwacDecisionNote = String(reviewWorkflow?.nwacDecisionNote || reviewWorkflow?.nwac_decision_note || '').trim();
  const reviewWorkflowNotice = (() => {
    // The review workflow owns reviewer routing. Document/signing lifecycle
    // drift must not hide the active reviewer-stage notice.
    if (!twoStepReviewEnabled || !hasReviewWorkflow) return null;
    if (isReviewWithNwac) {
      return {
        key: `assessment-${reviewStage}`,
        type: 'info',
        header: 'Ready for Decision Maker',
        content: 'The Regional Manager has reviewed this assessment and submitted it for final decision.',
        dismissible: true,
      };
    }
    if (reviewStage === ASSESSMENT_REVIEW_STAGES.rmReview && !canRegionalManagerReview) {
      return {
        key: `assessment-${reviewStage}`,
        type: 'info',
        header: 'Waiting for Regional Manager review',
        content: 'The Regional Manager reviews this assessment before the Decision Maker records the final decision.',
        dismissible: true,
      };
    }
    if (reviewStage === ASSESSMENT_REVIEW_STAGES.returnedToRm && !canRegionalManagerReview) {
      return {
        key: `assessment-${reviewStage}`,
        type: 'warning',
        header: 'Decision Maker requested changes',
        content: 'The assessment is back with the Regional Manager before it returns to the submitter.',
        dismissible: false,
      };
    }
    return null;
  })();
  const reviewWorkflowStageAlert =
    reviewWorkflowNotice && dismissedReviewNoticeKey !== reviewWorkflowNotice.key ? (
      <Alert
        type={reviewWorkflowNotice.type}
        header={reviewWorkflowNotice.header}
        dismissible={reviewWorkflowNotice.dismissible}
        onDismiss={
          reviewWorkflowNotice.dismissible
            ? () => setDismissedReviewNoticeKey(reviewWorkflowNotice.key)
            : undefined
        }
      >
        {reviewWorkflowNotice.content}
      </Alert>
    ) : null;
  const regionalManagerReviewContent = isReviewWithRegionalManager ? (
    <SpaceBetween size="m">
      {requiresSubmitterCorrectionReturn && reviewStage === ASSESSMENT_REVIEW_STAGES.rmReview && (
        <Alert type="warning" header="Submitter correction required">
          This assessment was reopened after a final decision. Return it to the original submitter for correction before it can be submitted for another final decision.
        </Alert>
      )}
      {reviewStage === ASSESSMENT_REVIEW_STAGES.returnedToRm && (
        <Alert type="warning" header="Decision Maker requested changes">
          <Box whiteSpace="pre-wrap">
            {String(nwacDecisionNote || '').trim() || 'No change note was recorded.'}
          </Box>
        </Alert>
      )}
      {rmReviewNote && (
        <Alert type="info" header="Latest Regional Manager note">
          <Box whiteSpace="pre-wrap">{rmReviewNote}</Box>
        </Alert>
      )}
      <FormField
        label={
          reviewStage === ASSESSMENT_REVIEW_STAGES.returnedToRm
            ? 'Regional Manager forwarding note'
            : 'Regional Manager review note'
        }
        description={
          reviewStage === ASSESSMENT_REVIEW_STAGES.returnedToRm
            ? "Required when forwarding the Decision Maker's requested changes to the submitter."
            : 'Required when returning the assessment to the submitter.'
        }
      >
        <Textarea
          value={reviewWorkflowNote}
          onChange={({ detail }) => setReviewWorkflowNote(detail.value || '')}
          readOnly={!canRegionalManagerReview || Boolean(reviewWorkflowActionLoading)}
          spellcheck={true}
          rows={4}
        />
      </FormField>
      <SpaceBetween direction="horizontal" size="xs">
        {reviewStage === ASSESSMENT_REVIEW_STAGES.returnedToRm ? (
          <Button
            variant="primary"
            onClick={() => handleReviewWorkflowAction(ASSESSMENT_REVIEW_ACTIONS.rmForwardChangesToSubmitter)}
            loading={reviewWorkflowActionLoading === ASSESSMENT_REVIEW_ACTIONS.rmForwardChangesToSubmitter}
            disabled={!canRegionalManagerReview || Boolean(reviewWorkflowActionLoading)}
          >
            Forward changes to submitter
          </Button>
        ) : (
          <Button
            variant={requiresSubmitterCorrectionReturn ? 'primary' : 'normal'}
            onClick={() => handleReviewWorkflowAction(ASSESSMENT_REVIEW_ACTIONS.rmReturnToSubmitter)}
            loading={reviewWorkflowActionLoading === ASSESSMENT_REVIEW_ACTIONS.rmReturnToSubmitter}
            disabled={!canRegionalManagerReview || Boolean(reviewWorkflowActionLoading)}
          >
            Return to submitter
          </Button>
        )}
        {reviewStage !== ASSESSMENT_REVIEW_STAGES.returnedToRm && !requiresSubmitterCorrectionReturn && (
          <Button
            variant="primary"
            onClick={() => handleReviewWorkflowAction(ASSESSMENT_REVIEW_ACTIONS.rmSubmitToNwac)}
            loading={reviewWorkflowActionLoading === ASSESSMENT_REVIEW_ACTIONS.rmSubmitToNwac}
            disabled={!canRegionalManagerReview || Boolean(reviewWorkflowActionLoading)}
          >
            Submit for final decision
          </Button>
        )}
      </SpaceBetween>
    </SpaceBetween>
  ) : null;
  const regionalManagerDecisionSummary =
    twoStepReviewEnabled && hasReviewWorkflow && !isReviewWithRegionalManager ? (
      <SpaceBetween size="xs">
        <Box fontWeight="bold">Regional Manager review note</Box>
        <Box whiteSpace="pre-wrap">{rmReviewNote || 'No Regional Manager note recorded.'}</Box>
      </SpaceBetween>
    ) : null;
  const submitterChangeInstructionsAlert =
    twoStepReviewEnabled && reviewStage === ASSESSMENT_REVIEW_STAGES.returnedToSubmitter ? (
      <Alert type="warning" header="Changes requested" statusIconAriaLabel="Warning">
        <SpaceBetween size="s">
          <Box>Review the notes below, update the assessment, then resubmit it for review when ready.</Box>
          {nwacDecisionNote ? (
            <Box>
              <Box fontWeight="bold">Decision Maker note</Box>
              <Box whiteSpace="pre-wrap">{nwacDecisionNote}</Box>
            </Box>
          ) : null}
          {rmReviewNote ? (
            <Box>
              <Box fontWeight="bold">Regional Manager note</Box>
              <Box whiteSpace="pre-wrap">{rmReviewNote}</Box>
            </Box>
          ) : null}
          {!nwacDecisionNote && !rmReviewNote ? (
            <Box>No detailed change note was recorded. Contact the Regional Manager before resubmitting.</Box>
          ) : null}
        </SpaceBetween>
      </Alert>
    ) : null;
  const assessmentAssuranceOptions = [
    { label: 'Yes - follow this recommendation', value: 'agree' },
    { label: 'No - record a different outcome', value: 'disagree' }
  ];
  const fundingDecisionOptions = approvalBlockMessage
    ? FUNDING_DECISION_OPTIONS.map(option =>
        option.value === 'approve'
          ? { ...option, disabled: true, description: 'Requires Shelley approval at this funding level.' }
          : option
      )
    : FUNDING_DECISION_OPTIONS;
  const isApprovalDecisionRecorded = decisionOutcome === 'approved';
  const isDenialDecisionRecorded = decisionOutcome === 'denied';
  const shouldShowRecordedDecisionAlert =
    isPostDecisionStatus &&
    !isPendingApprovalStatus &&
    (isApprovalDecisionRecorded || isDenialDecisionRecorded);
  const recordedDecisionFollowUpStep = (() => {
    if (!shouldShowRecordedDecisionAlert || isCompletedStatus) return null;
    if (
      isApprovalDecisionRecorded &&
      letterAlreadySent &&
      showFundingDocsStep &&
      activeStepIds.includes(FUNDING_DOCS_STEP_ID)
    ) {
      return FUNDING_DOCS_STEP_ID;
    }
    if (!letterAlreadySent && activeStepIds.includes('communication')) {
      return 'communication';
    }
    return null;
  })();
  const recordedDecisionAlertHeader = isApprovalDecisionRecorded
    ? 'Approval decision recorded'
    : 'Denial decision recorded';
  const recordedDecisionAlertContent = (() => {
    if (isApprovalDecisionRecorded) {
      if (letterAlreadySent) {
        return 'The approval letter has been sent. Continue with funding forms and signatures when they are required.';
      }
      return approvalHasFundingPackage
        ? 'The approval is saved. Prepare the client approval letter when ready; funding forms and signatures remain a separate follow-up after the letter is sent.'
        : 'The approval is saved. Prepare the client approval letter when ready.';
    }
    if (letterAlreadySent) {
      return 'The denial letter has been sent and the denied application is complete.';
    }
    return 'The denial is saved. Prepare the denial letter when ready.';
  })();
  const recordedDecisionActionLabel = (() => {
    if (recordedDecisionFollowUpStep === FUNDING_DOCS_STEP_ID) return 'Continue funding forms';
    if (recordedDecisionFollowUpStep === 'communication') {
      return isApprovalDecisionRecorded ? 'Prepare approval letter' : 'Prepare denial letter';
    }
    return null;
  })();

  const decisionStepContent = (
    <>
      <SpaceBetween size="l">
        {shouldShowRecordedDecisionAlert && (
          <Alert
            type="success"
            statusIconAriaLabel="Success"
            header={recordedDecisionAlertHeader}
            action={
              recordedDecisionFollowUpStep && recordedDecisionActionLabel ? (
                <Button onClick={() => navigateToAssessmentWizardStep(recordedDecisionFollowUpStep)}>
                  {recordedDecisionActionLabel}
                </Button>
              ) : undefined
            }
          >
            {recordedDecisionAlertContent}
          </Alert>
        )}
        {shouldShowDecisionPendingAlert && (
          <Alert
            type="info"
            dismissible
            onDismiss={() => setShowDecisionPendingAlert(false)}
            header="Funding decision pending"
          >
            A funding decision has not been recorded for this application yet. You will be notified as soon as one is made.
          </Alert>
        )}
        {reviewWorkflowStageAlert}
        {caseManagerRecommendationSummary}
        {regionalManagerDecisionSummary}
        {regionalManagerReviewContent || (
          <>
            {approvalBlockMessage && (
              <Alert type="warning" header="Shelley approval required">
                {approvalBlockMessage}
                {' '}Other Decision Maker outcomes can still be recorded.
              </Alert>
            )}
            {decisionAlignmentWarning && (
              <Alert type="warning" header="Outcome does not match the agreement answer">
                {decisionAlignmentWarning}
              </Alert>
            )}
            <Box
              style={
                isNWACFieldsDisabled || isOutcomeNoticeDisabled
                  ? { opacity: 0.6, pointerEvents: 'none' }
                  : undefined
              }
              aria-disabled={isNWACFieldsDisabled || isOutcomeNoticeDisabled}
            >
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <FormField
                label="Do you agree with this assessment recommendation?"
                description="Your answer sets the default funding outcome below."
                errorText={showDecisionErrors && fieldErrors.nwacReview ? fieldErrors.nwacReview : undefined}
              >
                <Hotspot hotspotId="nwac-assessment-assurance" direction="right">
                  <Select
                    selectedOption={assessmentAssuranceOptions.find(option => option.value === assessment.nwacReview) || null}
                    onChange={({ detail }) => {
                      applyAssessmentAssurance(detail.selectedOption?.value || '');
                    }}
                    options={assessmentAssuranceOptions}
                    placeholder="Select agreement"
                    data-error-focus={showDecisionErrors && fieldErrors.nwacReview ? 'true' : undefined}
                    readOnly={isNWACFieldsDisabled || assessment.nwacReviewStatus === 'push_back'}
                  />
                </Hotspot>
              </FormField>
              <FormField
                label="Funding outcome to record"
                description="Review the outcome before committing the decision."
                errorText={showDecisionErrors && fieldErrors.nwacReviewStatus ? fieldErrors.nwacReviewStatus : undefined}
              >
                <SpaceBetween direction="horizontal" size="xs">
                  <Hotspot hotspotId="nwac-decision-status" direction="right">
                    <RadioGroup
                      value={assessment.nwacReviewStatus || ''}
                      onChange={({ detail }) => applyFundingDecision(detail.value)}
                      items={fundingDecisionOptions}
                      ariaLabel="Funding outcome"
                      data-error-focus={showDecisionErrors && fieldErrors.nwacReviewStatus ? 'true' : undefined}
                      readOnly={isNWACFieldsDisabled}
                    />
                  </Hotspot>
                </SpaceBetween>
              </FormField>
            </Grid>
            {['reject', 'push_back'].includes(assessment.nwacReviewStatus) && (
              <Grid gridDefinition={[{ colspan: 12 }]}>
                <FormField
                  label={assessment.nwacReviewStatus === 'push_back' ? 'Request Changes note' : 'Reason for denial'}
                  stretch={true}
                >
                  <Box width="100%">
                    <Hotspot hotspotId="nwac-decision-reason" direction="right">
                      <Textarea value={assessment.nwacReason} onChange={({ detail }) => {
                        if (isNWACFieldsDisabled) return;
                        handleField('nwacReason', detail.value);
                      }} spellcheck={true} data-error-focus={showDecisionErrors && fieldErrors.nwacReason ? 'true' : undefined} readOnly={isNWACFieldsDisabled} />
                    </Hotspot>
                  </Box>
                </FormField>
              </Grid>
            )}
            {showDecisionBudgetPot && (
              <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                <FormField
                  label="Budget Pot"
                  description="Assign the pot that will fund this intervention."
                  errorText={showDecisionErrors && fieldErrors.interventionPotId ? fieldErrors.interventionPotId : undefined}
                >
                  <Hotspot hotspotId="nwac-budget-pot" direction="right">
                    <Select
                      placeholder={
                        !decisionHasCost
                          ? 'Not assigned for zero-cost interventions'
                          : budgetPotLoading
                            ? 'Loading budget pots'
                            : 'Select budget pot'
                      }
                      selectedOption={selectedBudgetPotOption}
                      options={budgetPotOptions}
                      statusType={budgetPotLoading ? 'loading' : 'finished'}
                      loadingText="Loading budget pots"
                      onChange={({ detail }) => handleField('interventionPotId', detail.selectedOption?.value || '')}
                      data-error-focus={showDecisionErrors && fieldErrors.interventionPotId ? 'true' : undefined}
                      readOnly={
                        baseAssessmentLocked ||
                        isEligibilityGateActive ||
                        (!canManageBudgetPotPending && isAssessmentDisabled)
                      }
                      disabled={!decisionHasCost}
                    />
                  </Hotspot>
                </FormField>
                <FormField
                  label="Paid from"
                  description="Select whether this pot is charged externally or internally."
                  errorText={showDecisionErrors && fieldErrors.postingContext ? fieldErrors.postingContext : undefined}
                >
                  {isAssessor ? (
                    <Input value="External (region/PTMA)" readOnly />
                  ) : (
                    <Select
                      selectedOption={selectedPostingContext}
                      options={POSTING_OPTIONS}
                      onChange={({ detail }) => handleField('postingContext', detail.selectedOption?.value || '')}
                      placeholder="Select"
                      data-error-focus={showDecisionErrors && fieldErrors.postingContext ? 'true' : undefined}
                      readOnly={
                        lockedByAnotherUser ||
                        isLockedStatus ||
                        isDecisionFinal ||
                        (isAssessmentDisabled && !canManageBudgetPotPending)
                      }
                      disabled={
                        !assessment.interventionPotId ||
                        !decisionHasCost
                      }
                    />
                  )}
                </FormField>
              </Grid>
            )}
          </Box>
          </>
        )}
      </SpaceBetween>
      <Modal
        visible={showApproveConfirmModal}
        onDismiss={() => setShowApproveConfirmModal(false)}
        header="Clear decision note?"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="primary" onClick={() => {
              if (isNWACFieldsDisabled) {
                setShowApproveConfirmModal(false);
                return;
              }
              handleField('nwacReason', '');
              handleField('nwacReviewStatus', 'approve');
              setShowApproveConfirmModal(false);
            }}>Clear Note and Approve</Button>
            <Button variant="normal" onClick={() => setShowApproveConfirmModal(false)}>Cancel</Button>
          </SpaceBetween>
        }
      >
        <Box>Switching to "Approved" will clear the current denial or request changes note. Do you want to continue?</Box>
      </Modal>
    </>
  );

  const interventionCount = Array.isArray(proposedInterventions) ? proposedInterventions.length : 0;
  const wizardNextButtonLabel = currentStep === 'framing' && interventionCount === 0 ? 'Add intervention' : 'Next';
  const hasMultipleInterventions = interventionCount > 1;
  const interventionRationaleTitle = hasMultipleInterventions
    ? 'Why are these interventions needed?'
    : STEP_LABELS.rationale;
  const interventionTypeTitle = hasMultipleInterventions
    ? 'How will the interventions be delivered?'
    : STEP_LABELS.type;
  const communicationStepTitle = decisionOutcome === 'approved'
    ? 'Approval letters'
    : decisionOutcome === 'denied'
      ? 'Denial letter'
      : STEP_LABELS.communication;
  const decisionStepTitle = isReviewWithRegionalManager ? 'Regional Manager review' : STEP_LABELS.decision;
  const assessmentSubmitLabel = twoStepReviewEnabled
    ? (reviewStage === ASSESSMENT_REVIEW_STAGES.returnedToSubmitter ? 'Resubmit for review' : 'Submit for review')
    : 'Submit assessment';
  const stepDefinitionById = {
    eligibility: { title: STEP_LABELS.eligibility, content: eligibilityStepContent, isOptional: false },
    framing: { title: STEP_LABELS.framing, content: framingStepContent, isOptional: false },
    rationale: { title: interventionRationaleTitle, content: rationaleStepContent, isOptional: false },
    type: { title: interventionTypeTitle, content: typeStepContent, isOptional: false },
    childcare: { title: STEP_LABELS.childcare, content: childcareStepContent, isOptional: false },
    previousIset: { title: STEP_LABELS.previousIset, content: previousIsetStepContent, isOptional: false },
    barriers: { title: STEP_LABELS.barriers, content: barriersStepContent, isOptional: false },
    priorities: { title: STEP_LABELS.priorities, content: prioritiesStepContent, isOptional: false },
    otherFunding: { title: STEP_LABELS.otherFunding, content: otherFundingStepContent, isOptional: false },
    cost: { title: STEP_LABELS.cost, content: costStepContent, isOptional: false },
    docs: { title: STEP_LABELS.docs, content: docsStepContent, isOptional: false },
    review: { title: STEP_LABELS.review, content: reviewStepContent, isOptional: false },
    decision: { title: decisionStepTitle, content: decisionStepContent, isOptional: false },
    communication: { title: communicationStepTitle, content: communicationStepContent, isOptional: false },
    fundingDocs: { title: STEP_LABELS.fundingDocs, content: fundingDocsStepContent, isOptional: false }
  };

  const steps = activeStepIds
    .map(stepId => {
      const definition = stepDefinitionById[stepId];
      if (!definition) return null;
      return { id: stepId, ...definition };
    })
    .filter(Boolean);

  const activeStepIndex = Math.max(activeStepIds.indexOf(currentStep), 0);
  const canSubmitAssessment = canEditAssessmentBody && !isEligibilityGateActive && !lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && (!assessmentSubmitted || isEditingAssessment) && !isSubmittingAssessment;
  const canSubmitOutcome = !isEligibilityGateActive && !lockedByAnotherUser && showOutcomeByStatus && showNWACSection && !isEditingAssessment && !isOutcomeNoticeDisabled && canNwacReview && !checkingChecklist && !isSubmittingAssessment;
  const canSubmitCommunication =
    isCommunicationStep &&
    showCommunicationStep &&
    !lockedByAnotherUser &&
    !isCompletedStatus &&
    !checkingChecklist &&
    canSendLetter;
  const canSubmitFundingDocs =
    isFundingDocsStep &&
    showFundingDocsStep &&
    !lockedByAnotherUser &&
    !isCompletedStatus &&
    !checkingChecklist;
  const isCommunicationSending = isCommunicationStep && sendingLetter;
  const wizardSubmitHandler = isFundingDocsStep
    ? (canSubmitFundingDocs ? handleFundingDocsComplete : undefined)
    : isCommunicationStep
      ? (canSubmitCommunication ? handleCommunicationComplete : undefined)
      : (showNWACSection ? (canSubmitOutcome ? handleApproveClick : undefined) : (canSubmitAssessment ? handleSubmit : undefined));
  const wizardSubmitLabel = isFundingDocsStep
    ? (isCompletedStatus ? 'Application completed' : 'Mark application complete')
    : isCommunicationStep
      ? (decisionOutcome === 'approved' ? 'Send Client Approval letter' : 'Send Letter')
      : (showNWACSection ? 'Commit' : assessmentSubmitLabel);
  const wizardReadOnlyLabel = 'Read only';
  const hideWizardActions = !wizardSubmitHandler && (isDecisionFinal || isLockedStatus || isReviewWithRegionalManager) && !isFundingDocsStep;
  const wizardSubmitText =
    isCommunicationSending || isSubmittingAssessment || checkingChecklist
      ? 'Working'
      : (deniedApplicationCloseoutComplete
        ? 'Denial letter sent'
        : (wizardSubmitHandler
        ? wizardSubmitLabel
        : (isFundingDocsStep ? wizardSubmitLabel : (hideWizardActions ? undefined : wizardReadOnlyLabel))));
  const submitDocumentConflictModal = (
    <Modal
      visible={submitDocumentConflictModalVisible}
      onDismiss={handleSubmitDocumentConflictDismiss}
      closeAriaLabel="Close existing document warning"
      header="Existing uploaded documents found"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="normal" onClick={handleSubmitDocumentConflictDismiss}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmitDocumentConflictConfirm}>
            {assessmentSubmitLabel}
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="m">
        <Box>
          PATH is about to generate a new Case Manager Assessment PDF automatically. It can also replace the current
          <strong> Application form</strong> and <strong> Financial overview</strong> documents for this application.
        </Box>
        <Box>
          Uploaded files already exist for the items below. Keep the boxes checked to retain those current uploaded files
          instead of replacing them with system-generated PDFs.
        </Box>
        {submitDocumentConflicts.map(conflict => (
          <Checkbox
            key={conflict.documentType}
            checked={Boolean(submitDocumentRetention[conflict.documentType])}
            onChange={({ detail }) => {
              setSubmitDocumentRetention(prev => ({
                ...prev,
                [conflict.documentType]: detail.checked,
              }));
            }}
            description={conflict.summary}
          >
            Keep existing {conflict.title}
          </Checkbox>
        ))}
      </SpaceBetween>
    </Modal>
  );
  const conflictHoldModal = (
    <Modal
      visible={conflictHoldModalVisible}
      onDismiss={() => {
        setConflictHoldModalVisible(false);
        if (typeof window !== 'undefined') {
          window.location.assign('/');
        }
      }}
      closeAriaLabel="Return to homepage"
      header="Conflict of Interest Declared"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="primary"
            onClick={() => {
              setConflictHoldModalVisible(false);
              if (typeof window !== 'undefined') {
                window.location.assign('/');
              }
            }}
          >
            Return to homepage
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        <Box>
          Thank you for declaring a potential conflict of interest. This conflict has been escalated to your manager for resolution.
        </Box>
        <Box>
          If you are cleared to work on the application you will receive a notification, or the application may be reassigned. You will be redirected to your homepage now.
        </Box>
      </SpaceBetween>
    </Modal>
  );

  if (isDeclarationGateActive) {
    return (
      <BoardItem header={headerElement} i18nStrings={boardItemI18nStrings} settings={boardItemSettings}>
        <div ref={setWidgetRootRef}>
          <div ref={alertAnchorRef} />
          <Box variant="small" margin={{ bottom: 's' }}>
            {applicationPhaseDescription}
            {hasPersistedDeclaredConflict
              ? ' A conflict of interest was declared; assessment is locked until the conflict is resolved or the case is reassigned.'
              : showNWACSection
                ? ' Complete the conflict of interest declaration below to unlock the decision review.'
                : ' Complete the conflict of interest declaration below to unlock the assessment.'}
          </Box>
          {alert && (
            <Alert
              type={alert.type}
              dismissible={alert.dismissible}
              onDismiss={() => setAlert(null)}
              statusIconAriaLabel={alert.statusIconAriaLabel}
              header={alert.header}
            >
              {alert.content}
            </Alert>
          )}
          <Box padding={{ top: 'm' }}>
            <SpaceBetween size="m">
              <Box>
                <Box fontWeight="bold">Conflict of Interest Declaration</Box>
                <Box margin={{ top: 'xs' }}>
                  As the staff member working this application, declare whether you have any actual, potential, or perceived conflict of interest or bias related to this
                  applicant's file or assessment. If a conflict exists, describe it so the file can be triaged appropriately.
                </Box>
                <Box color="text-status-inactive">
                  This declaration is recorded per staff member. Even if a previous owner signed, you must complete it before continuing your
                  {showNWACSection ? ' decision review.' : ' assessment work.'}
                </Box>
              </Box>
              {declarationError && (
                <Alert
                  type="error"
                  statusIconAriaLabel="Error"
                  dismissible
                  onDismiss={() => setDeclarationError(null)}
                >
                  {declarationError}
                </Alert>
              )}
              <FormField
                label="Select your declaration"
                description="Choose the option that applies for this application file."
                errorText={!hasDeclarationChoice && declarationError ? declarationError : undefined}
              >
                <RadioGroup
                  value={hasDeclarationChoice ? normalizedDraftConflictChoice : null}
                  items={[
                    {
                      value: 'no_conflict',
                      label: 'I do not have any actual, potential, or perceived conflict of interest or bias for this application file.'
                    },
                    {
                      value: 'conflict',
                      label: 'I may have an actual, potential, or perceived conflict or bias for this application file.',
                      description: 'Describe the relationship or circumstance below so the assessment can be routed appropriately.'
                    }
                  ]}
                  onChange={({ detail }) => {
                    setConflictDeclarationChoice(detail.value);
                    setDeclarationError(null);
                  }}
                  disabled={lockedByAnotherUser || isSigningDeclaration}
                />
              </FormField>
              {hasDraftDeclaredConflict && (
                <FormField
                  label="Conflict details"
                  description="Provide the relationship, organization, or circumstance that may create a conflict of interest."
                  errorText={hasDraftDeclaredConflict && !conflictDetailsNormalized && declarationError ? declarationError : undefined}
                >
                  <Textarea
                    value={conflictDeclarationDetails}
                    onChange={({ detail }) => {
                      setConflictDeclarationDetails(detail.value);
                      setDeclarationError(null);
                    }}
                    placeholder="Include names, roles, timelines, and any context needed for triage."
                    rows={4}
                    spellcheck={false}
                    disabled={lockedByAnotherUser || isSigningDeclaration}
                  />
                </FormField>
              )}
              <SpaceBetween direction="horizontal" size="s">
                <Button
                  variant="primary"
                  onClick={handleSignDeclaration}
                  loading={isSigningDeclaration}
                  disabled={isDeclarationSubmissionDisabled}
                >
                  Sign and Continue
                </Button>
              </SpaceBetween>
              {lockedByAnotherUser && (
                <Box color="text-status-inactive">
                  Another user currently has this case locked. Ask them to release it before signing the declaration.
                </Box>
              )}
            </SpaceBetween>
          </Box>
          {submitDocumentConflictModal}
          {conflictHoldModal}
        </div>
      </BoardItem>
    );
  }

  return (
    <BoardItem
      header={headerElement}
      i18nStrings={boardItemI18nStrings}
      settings={boardItemSettings}
    >
      <div ref={setWidgetRootRef}>
        <div ref={alertAnchorRef} />
        <Box variant="small" margin={{ bottom: 's' }}>
          {applicationPhaseDescription}
        </Box>
        {validationAlert || alert || submitterChangeInstructionsAlert ? (
          <Box margin={{ bottom: 'm' }}>
            <SpaceBetween size="s">
              {validationAlert && (
                <Alert
                  type="warning"
                  dismissible
                  onDismiss={() => setValidationAlert(null)}
                  statusIconAriaLabel="Warning"
                  header="Please review the fields below."
                >
                  <Box margin={{ bottom: 'xxs' }}>One or more fields still require attention:</Box>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {validationAlert.map((message, index) => (
                      <li key={index}>{message}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              {alert && (
                <Alert
                  type={alert.type}
                  dismissible={alert.dismissible}
                  onDismiss={() => setAlert(null)}
                  statusIconAriaLabel={alert.statusIconAriaLabel}
                  header={alert.header}
                >
                  {alert.content}
                </Alert>
              )}
              {submitterChangeInstructionsAlert}
            </SpaceBetween>
          </Box>
        ) : null}
        {submitDocumentConflictModal}
        {isEligibilityGateActive && (
          <>
            <Alert
              type="error"
              header="Employment insurance eligibility not checked"
              statusIconAriaLabel="Error"
            >
              Assessment sections are locked until an authorised user sets ESDC eligibility.
            </Alert>
            <Box margin={{ bottom: 's' }} />
          </>
        )}
        <input
          type="file"
          ref={checklistFileInputRef}
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
          onChange={handleChecklistFileSelected}
        />
        <div
          data-path-assessment-wizard="true"
          data-path-assessment-step={currentStep}
          data-path-assessment-editable={isAssessmentDisabled ? 'false' : 'true'}
          style={{ visibility: wizardNavPriming ? 'hidden' : 'visible' }}
          aria-hidden={wizardNavPriming ? 'true' : undefined}
        >
          <Wizard
            activeStepIndex={activeStepIndex}
            i18nStrings={{ nextButton: wizardNextButtonLabel }}
            isLoadingNextStep={
              lockingAssessment ||
              checkingChecklist ||
              eiVerificationUploading ||
              isSubmittingAssessment ||
              isCommunicationSending
            }
            onNavigate={handleWizardNavigate}
            onSubmit={wizardSubmitHandler}
            onCancel={canSubmitAssessment ? handleCancel : undefined}
            steps={steps.map(step => ({
              title: step.title,
              content: step.content,
              isOptional: step.isOptional,
              errorText:
                attemptedSteps[step.id] && !isWizardStepValid(step.id)
                  ? step.id === 'review'
                    ? 'Complete required fields before submitting.'
                    : 'Complete required fields before continuing.'
                  : undefined,
            }))}
            submitButtonText={wizardSubmitText}
            previousButtonText={hideWizardActions ? undefined : 'Previous'}
            secondaryActions={null}
          />
        </div>
        {otherFundingSourceModalContent}
        {interventionModalContent}
        {interventionDeleteModal}
        {costLineDetailModal}
        {endDateAdjustmentModal}
        {occurrenceChangeModal}
        {denialReasonModal}
        {denyFundingModal}
        {checklistUploadModal}
        <Modal
          visible={showSendApprovalLetterConfirmModal}
          onDismiss={() => setShowSendApprovalLetterConfirmModal(false)}
          header="Send Client Approval letter?"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                onClick={handleConfirmSendApprovalLetter}
                loading={sendingLetter}
              >
                Send Client Approval letter
              </Button>
              <Button
                variant="normal"
                onClick={() => setShowSendApprovalLetterConfirmModal(false)}
                disabled={sendingLetter}
              >
                Cancel
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            <Box>
              {approvalHasFundingPackage
                ? 'This will send the Letter of Approval to the client with attached Client Funding Agreement and EFT/Wire Transfer form for completion.'
                : 'This will send the Letter of Approval to the client. No Client Funding Agreement or funding forms will be attached because the approved intervention does not include funded cost lines.'}
            </Box>
            <Box>
              Institution letters and letters to other funders are not sent by the system. Send those manually as needed.
            </Box>
          </SpaceBetween>
        </Modal>
        <Modal
          visible={showFundingDocsIncompleteModal}
          onDismiss={() => setShowFundingDocsIncompleteModal(false)}
          header="Checklist incomplete"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                onClick={() => setShowFundingDocsIncompleteModal(false)}
              >
                OK
              </Button>
            </SpaceBetween>
          }
        >
          <Box>
            This application cannot be marked complete until all required checklist items have been signed and submitted by the applicant.
          </Box>
        </Modal>
        <Modal
          visible={showCancelModal}
          onDismiss={() => setShowCancelModal(false)}
          header="Exit assessment?"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" onClick={confirmCancel}>Exit Assessment</Button>
              <Button variant="normal" onClick={() => setShowCancelModal(false)}>Cancel</Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="xs">
            <Box>This will exit the assessment workspace.</Box>
            <Box variant="small" color="text-body-secondary">
              Unsaved changes in the current step will be discarded.
            </Box>
          </SpaceBetween>
        </Modal>
        <Modal
          visible={checklistWarningVisible}
          onDismiss={() => {
            setChecklistWarningVisible(false);
            setChecklistNextAction(null);
          }}
          header="Checklist incomplete"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              {typeof checklistNextAction === 'function' ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setChecklistWarningVisible(false);
                    const next = checklistNextAction;
                    setChecklistNextAction(null);
                    if (typeof next === 'function') {
                      next();
                    }
                  }}
                >
                  Continue anyway
                </Button>
              ) : null}
              <Button
                variant="normal"
                onClick={() => {
                  setChecklistWarningVisible(false);
                  setChecklistNextAction(null);
                }}
              >
                Close
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            <Box>
              Some checklist items are still missing. You can proceed, but consider resolving these first.
            </Box>
            {checklistCheckError && <Alert type="warning">{checklistCheckError}</Alert>}
            {checklistWarningItems.length > 0 && (
              <Box as="ul" padding={{ left: 'm' }}>
                {checklistWarningItems.map(item => (
                  <li key={item.id}>{item.label || item.id}</li>
                ))}
              </Box>
            )}
          </SpaceBetween>
        </Modal>
        <Modal
          visible={showRecallConfirmModal}
          onDismiss={() => {
            if (!isRecallingAssessment) {
              setShowRecallConfirmModal(false);
            }
          }}
          header="Recall assessment submission?"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                onClick={handleRecallAssessmentSubmission}
                loading={isRecallingAssessment}
                disabled={isRecallingAssessment}
              >
                Recall submission
              </Button>
              <Button
                variant="normal"
                onClick={() => setShowRecallConfirmModal(false)}
                disabled={isRecallingAssessment}
              >
                Cancel
              </Button>
            </SpaceBetween>
          }
        >
          <Box>
            This will move the assessment back to In Review, remove the submitted PDFs from the active document list,
            and let you make corrections before submitting again.
          </Box>
        </Modal>
        <Modal
          visible={showEditConfirmModal}
          onDismiss={() => setShowEditConfirmModal(false)}
          header="Edit Submitted Assessment?"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                onClick={beginEditingAssessment}
                loading={lockingAssessment}
                disabled={lockingAssessment || lockedByAnotherUser}
              >
                Edit Assessment
              </Button>
              <Button variant="normal" onClick={() => setShowEditConfirmModal(false)}>Cancel</Button>
            </SpaceBetween>
          }
        >
          <Box>Are you sure you want to edit the previously submitted assessment? This will allow you to make changes and resubmit. Your changes will not be saved until you click Save Progress or Submit.</Box>
        </Modal>
        {conflictHoldModal}
      </div>
    </BoardItem>
  );
});

export default CoordinatorAssessmentWidget;
