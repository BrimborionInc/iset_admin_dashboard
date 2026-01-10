import React, { forwardRef, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiFetch } from '../auth/apiClient';
import useApplicationLock, { buildLockConflictMessage } from '../hooks/useApplicationLock';
import useCurrentUser from '../hooks/useCurrentUser';
import { canCompleteOutcomeReview, getCaseStatusContext, getApplicationStatusContext } from '../utils/rbac';
import { Box, Header, ButtonDropdown, Link, SpaceBetween, Button, Alert, Modal, FormField, Input, Textarea, Checkbox, DatePicker, Select, Grid, ColumnLayout, Table, RadioGroup, Autosuggest, StatusIndicator, Wizard, Hotspot } from '@cloudscape-design/components';
import ApplicationAssessmentHelp, { NwacAssessmentHelp } from '../helpPanelContents/applicationAssessmentHelp';
import { BoardItem } from '@cloudscape-design/board-components';
import { PAYMENT_TYPE_OPTIONS } from '../pages/finance/widgets/paymentOptions';
import { getCurrencyInputDisplayValue } from '../utils/currencyFormat';

const BARRIERS = [
  'None', 'Education', 'Lack of Marketable Skills', 'Lack of Work Experience', 'Remoteness', 'Lack of Transportation', 'Economic', 'Language', 'Lack of Labour Force Attachment', 'Dependent Care', 'Physical, Emotional, or Mental Health', 'Other'
];
const PRIORITIES = [
  'Off Reserve', 'Single Parent Family', 'Woman over 45', 'Literacy', 'Youth', 'Unskilled Clerical/Service Worker', 'No Grade 12', 'Unskilled Labourer', 'Non-Targeted'
];
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
const requiresNocForCode = (value) => isEmployerCode(value);

const DECISION_READY_STATUS = 'decision_ready';
const APPLICATION_FINAL_STATUSES = new Set(['approved', 'completed', 'rejected', 'closed', 'archived']);
const APPLICATION_LOCKED_STATUSES = new Set(['approved', 'completed', 'rejected', 'closed', 'archived', DECISION_READY_STATUS]);
const DECISION_READY_STATUSES = new Set([DECISION_READY_STATUS, 'approved']);
const APPROVED_CASE_STATUSES = new Set(['initiated', 'active', 'dormant', 'ready_to_close', 'closed', 'archived', 'approved']);
const OVERVIEW_WORD_LIMIT = 400;
const EMPLOYMENT_GOALS_WORD_LIMIT = 400;
const NOT_APPROVED_CASE_STATUS = 'in_review';
const APPROVAL_COST_THRESHOLD = 25000;
const ELIGIBILITY_ALLOWED_MIME_TYPES = [
  'application/pdf',
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
const START_ASSESSMENT_STAGE = 'start_assessment';
const SUBMIT_ASSESSMENT_STAGE = 'submit_assessment';
const COMMUNICATION_CHECKLIST_STAGE = 'approve_and_commence';
const STEP_LABELS = {
  eligibility: 'EI Eligibility Check',
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
  communication: 'Communication & agreement'
};
const REQUIRED_STEP_IDS = BASE_STEP_IDS.slice(0, BASE_STEP_IDS.length - 1);

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
  const parts = trimmed.split('-');
  if (parts.length !== 3) return null;
  const [yyyy, mm, dd] = parts.map(part => Number.parseInt(part, 10));
  if (![yyyy, mm, dd].every(Number.isFinite)) return null;
  return Date.UTC(yyyy, mm - 1, dd);
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

const formatCurrencyDisplay = (value) => {
  const num = parseCurrencyInput(value);
  if (num === null) return '';
  return `$ ${num.toFixed(2)}`;
};

const buildUuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const sanitizeCurrencyInput = (value) => {
  if (value === null || value === undefined) return '';
  const cleaned = String(value).replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  const [whole, ...rest] = cleaned.split('.');
  const decimals = rest.join('').slice(0, 2);
  return decimals.length ? `${whole}.${decimals}` : whole;
};

const buildEmptyCostLine = (overrides = {}) => ({
  id: buildUuid(),
  type: '',
  amount: '',
  notes: '',
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
  const normalized = {
    id: raw.id || buildUuid(),
    type: raw.type || raw.paymentType || raw.payment_type || '',
    amount:
      raw.amount === null || typeof raw.amount === 'undefined'
        ? ''
        : String(raw.amount),
    notes: raw.notes || raw.description || '',
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

const normalizeProposedInterventions = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  const normalized = list.map(item => normalizeProposedIntervention(item)).filter(Boolean);
  if (normalized.length) return normalized;
  return [];
};

const normalizeInterventionCodeValue = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
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
              type: item.type || item.paymentType || item.payment_type || '',
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
      const code = String(entry.code || entry.type || entry.paymentType || entry.payment_type || '').trim();
      if (!code) return null;
      const recurrence = entry.recurrence && typeof entry.recurrence === 'object' ? entry.recurrence : {};
      return {
        code,
        recurrence: {
          mode: recurrence.mode || recurrence.rule || entry.recurrenceMode || entry.recurrence_mode || 'optional'
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
  if (!payload || payload.enabled === false) return null;
  const interventionsRaw = Array.isArray(payload.interventions) ? payload.interventions : [];
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
        availablePaymentTypes: types
      };
    })
    .filter(Boolean);
  if (!interventions.length) return null;
  return { ...payload, interventions };
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
    'otherFunding',
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
  otherFunding: '',
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
const buildEmptyDecisionLetterDrafts = () => ({
  approval: buildEmptyDecisionLetterDraft(),
  denial: buildEmptyDecisionLetterDraft()
});
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
  ({ actions, toggleHelpPanel, caseData, application_id, onCaseUpdate, applicationRowVersion, onRowVersionUpdate }, ref) => {
  // State for form fields
  const [assessment, setAssessment] = useState(() => buildEmptyAssessment());
  const [initialAssessment, setInitialAssessment] = useState(() => buildEmptyAssessment());
  const [letterDrafts, setLetterDrafts] = useState(() => buildEmptyDecisionLetterDrafts());
  const [initialLetterDrafts, setInitialLetterDrafts] = useState(() => buildEmptyDecisionLetterDrafts());
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
        if (target !== prev && typeof onRowVersionUpdate === 'function') {
          onRowVersionUpdate(target);
        }
        return target;
      });
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [validationAlert, setValidationAlert] = useState(null);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [isEditingAssessment, setIsEditingAssessment] = useState(false);
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
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
  const [showDocsInfoAlert, setShowDocsInfoAlert] = useState(true);
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
  const eiVerificationFileInputRef = useRef(null);
  const checklistFileInputRef = useRef(null);
  const nextChecklistDocTypeRef = useRef('');
  const nextChecklistLabelRef = useRef('');
  const [currentStep, setCurrentStep] = useState(BASE_STEP_IDS[0]);
  const [wizardNavPriming, setWizardNavPriming] = useState(false);
  const [attemptedSteps, setAttemptedSteps] = useState({});
  const wizardStepRestoreKeyRef = useRef(null);
  const wizardStepRestoreStepsRef = useRef(null);
  const wizardNavPrimeRef = useRef({ signature: null, restoreStep: null });
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
    displayName: currentUserName,
    role: currentUserRole
  } = useCurrentUser();
  const userRole = currentUserRole || '';
  const normalizedRole = (userRole || '').toString().trim().toLowerCase();
  const canonicalRole = normalizedRole === 'regional manager' ? 'regional coordinator' : normalizedRole;
  const isAssessor = canonicalRole === 'application assessor';
  const roleKey = normalizedRole.replace(/[\s_-]+/g, '');
  const eligibilityRoleAllowlist = new Set([
    'systemadministrator',
    'sysadmin',
    'programadministrator',
    'programadmin',
    'nwacadministrator',
    'regionalcoordinator',
    'regionalmanager'
  ]);
  const canManageEiEligibility = eligibilityRoleAllowlist.has(roleKey);
  const isEligibilityAdmin = canManageEiEligibility;
  const canUploadEiVerification = canManageEiEligibility;
  const proposedInterventions = useMemo(
    () => (Array.isArray(assessment.proposedInterventions) ? assessment.proposedInterventions : []),
    [assessment.proposedInterventions]
  );
  const primaryIntervention = proposedInterventions[0] || buildEmptyIntervention();
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
  const isHighCostApprovalBlocked =
    canonicalRole === 'regional coordinator' &&
    Number.isFinite(overallCostTotal) &&
    overallCostTotal >= APPROVAL_COST_THRESHOLD;

  const [interventionCodes, setInterventionCodes] = useState([]);
  const [interventionCodesLoading, setInterventionCodesLoading] = useState(false);
  const [nocVersions, setNocVersions] = useState([]);
  const [nocVersionsLoading, setNocVersionsLoading] = useState(false);
  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);
  const [paymentTypeMapping, setPaymentTypeMapping] = useState(null);
  const [paymentTypeMappingLoading, setPaymentTypeMappingLoading] = useState(false);
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
  const [costLineModal, setCostLineModal] = useState({
    visible: false,
    mode: 'view',
    interventionId: null,
    lineId: null,
    draft: null,
    original: null
  });
  const [costLineModalErrors, setCostLineModalErrors] = useState({});
  const [inlineAmountEditingId, setInlineAmountEditingId] = useState(null);
  const [endDateAdjustModal, setEndDateAdjustModal] = useState(null);
  const [occurrenceConfirmModal, setOccurrenceConfirmModal] = useState(null);
  const [conflictDeclarationSigned, setConflictDeclarationSigned] = useState(Boolean(caseData?.assessment_conflict_declaration_signed));
  const [conflictDeclarationSignedAt, setConflictDeclarationSignedAt] = useState(caseData?.assessment_conflict_declaration_signed_at || null);
  const [conflictDeclarationChoice, setConflictDeclarationChoice] = useState(caseData?.assessment_conflict_declaration_choice || '');
  const [conflictDeclarationDetails, setConflictDeclarationDetails] = useState(caseData?.assessment_conflict_declaration_details || '');
  const [isSigningDeclaration, setIsSigningDeclaration] = useState(false);
  const [declarationError, setDeclarationError] = useState(null);
  const [conflictHoldModalVisible, setConflictHoldModalVisible] = useState(false);
  const [showConflictAlert, setShowConflictAlert] = useState(true);
  const scrollWidgetAndPageTop = useCallback(() => {
    debugScroll('scrollWidgetAndPageTop');
    scrollWidgetAndPageTopOnce(widgetRootRef);
  }, []);
  const scrollAfterAction = useCallback(() => {
    // Scroll widget and page to top after save/submit actions.
    debugScroll('scrollAfterAction');
    scrollWidgetAndPageTopOnce(widgetRootRef);
  }, []);

  const rawApplicationStatus = caseData?.applicationStatus ?? caseData?.application_status ?? null;
  const rawApplicationStatusNormalized = typeof rawApplicationStatus === 'string'
    ? rawApplicationStatus.trim().toLowerCase()
    : null;
  const rawCaseStatusSnapshot = caseData?.status ?? '';
  const canonicalCaseStatusSnapshot = getCaseStatusContext(rawCaseStatusSnapshot).canonicalStatus;
  const applicationStatusContext = getApplicationStatusContext(rawApplicationStatus);
  const canonicalApplicationStatus = applicationStatusContext.canonicalStatus || canonicalCaseStatusSnapshot;
  const isPendingApprovalStatus = rawApplicationStatusNormalized === 'pending_approval';
  const normalizedApplicationStatus = rawApplicationStatusNormalized || canonicalApplicationStatus || '';
  const isDecisionReadyStatus = DECISION_READY_STATUSES.has(normalizedApplicationStatus);
  const isCompletedStatus = normalizedApplicationStatus === 'completed';
  const decisionOutcome = useMemo(() => {
    const decision = assessment.nwacReviewStatus;
    if (decision === 'approve') return 'approved';
    if (decision === 'reject') return 'denied';
    if (decision === 'push_back') return null;
    if (rawApplicationStatusNormalized === 'approved') return 'approved';
    if (rawApplicationStatusNormalized === 'rejected' || rawApplicationStatusNormalized === 'declined') return 'denied';
    if (rawApplicationStatusNormalized === 'decision_ready' || rawApplicationStatusNormalized === 'completed') {
      const caseStatusNorm = String(canonicalCaseStatusSnapshot || rawCaseStatusSnapshot || '').trim().toLowerCase();
      if (APPROVED_CASE_STATUSES.has(caseStatusNorm)) return 'approved';
      if (caseStatusNorm === NOT_APPROVED_CASE_STATUS) return 'denied';
    }
    return null;
  }, [assessment.nwacReviewStatus, rawApplicationStatusNormalized, canonicalCaseStatusSnapshot, rawCaseStatusSnapshot]);
  const activeLetterKey = decisionOutcome === 'approved' ? 'approval' : decisionOutcome === 'denied' ? 'denial' : null;
  const applicantUserId = caseData?.applicant_user_id ?? caseData?.applicantUserId ?? null;
  const applicationId = caseData?.application_id ?? caseData?.applicationId ?? application_id ?? null;
  const caseId = caseData?.id ?? caseData?.case_id ?? null;
  const applicantName = useMemo(() => {
    const ctx = caseData?.caseContext || {};
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
  }, [caseData, currentUserName]);
  const wizardStepKey = useMemo(() => {
    const baseId = caseData?.id ?? applicationId ?? application_id ?? null;
    return baseId ? `assessment:${baseId}` : null;
  }, [caseData?.id, applicationId, application_id]);

  const isDecisionFinal = APPLICATION_FINAL_STATUSES.has(normalizedApplicationStatus);
  const isLockedStatus = APPLICATION_LOCKED_STATUSES.has(normalizedApplicationStatus);
  const showOutcomeByStatus = isPendingApprovalStatus;
  const isOutcomeNoticeDisabled = isDecisionFinal;
  const canManageOutcomeReview = canCompleteOutcomeReview({ role: userRole, status: rawApplicationStatus });
  const lacksOutcomePermission = Boolean(userRole) && isPendingApprovalStatus && !canManageOutcomeReview;
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
  const paymentTypeLabelLookup = useMemo(() => {
    const map = new Map();
    PAYMENT_TYPE_OPTIONS.forEach(option => {
      if (!option?.value) return;
      map.set(String(option.value), option.label || option.value);
    });
    return map;
  }, []);
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
  const effectiveCostingDefaults = useMemo(() => {
    if (costingDefaults && costingDefaults.enabled !== false) return costingDefaults;
    return { enabled: false, strategy: 'allowed', interventions: [], paymentTypes: [] };
  }, [costingDefaults]);
  const recurrenceModeByType = useMemo(() => {
    const map = new Map();
    if (effectiveCostingDefaults && Array.isArray(effectiveCostingDefaults.paymentTypes)) {
      effectiveCostingDefaults.paymentTypes.forEach(entry => {
        const code = entry?.code ? String(entry.code).trim() : '';
        if (!code) return;
        const mode = entry?.recurrence?.mode ? String(entry.recurrence.mode).trim() : 'optional';
        map.set(code, mode || 'optional');
      });
    }
    return map;
  }, [effectiveCostingDefaults]);
  const getRecurrenceModeForType = useCallback(
    (type) => {
      if (!type) return 'optional';
      const normalized = String(type).trim();
      return recurrenceModeByType.get(normalized) || 'optional';
    },
    [recurrenceModeByType]
  );
  const getInstallmentText = useCallback(
    (line) => {
      const mode = getRecurrenceModeForType(line?.type);
      const required = mode === 'required';
      const enabled = Boolean(line?.recurrence?.enabled);
      if (!enabled && !required) {
        return 'in 1 installment';
      }
      const recurrence = line?.recurrence || {};
      const occurrencesRaw =
        recurrence.occurrences === '' || recurrence.occurrences === null || typeof recurrence.occurrences === 'undefined'
          ? null
          : Number(recurrence.occurrences);
      let occurrences = Number.isFinite(occurrencesRaw) && occurrencesRaw > 0 ? occurrencesRaw : null;
      if (!occurrences) {
        const startDate = formatDate(recurrence.startDate);
        const endDate = formatDate(recurrence.endDate);
        if (startDate && endDate) {
          const computed = autoOccurrencesFromDates(startDate, endDate, 'monthly');
          if (computed) occurrences = computed;
        }
      }
      if (!occurrences) {
        return 'in — installments';
      }
      return `in ${occurrences} installment${occurrences === 1 ? '' : 's'}`;
    },
    [getRecurrenceModeForType]
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
      const used = new Set(
        Array.isArray(intervention?.costLines)
          ? intervention.costLines.map(line => line?.type).filter(Boolean)
          : []
      );
      return PAYMENT_TYPE_OPTIONS.filter(option => {
        if (!option?.value) return false;
        if (allowed.size && !allowed.has(option.value)) return false;
        if (used.has(option.value)) return false;
        return true;
      });
    },
    [getAllowedPaymentTypesForIntervention]
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
      let suggested = defaultsEntry?.suggested || [];
      if (!suggested.length && effectiveCostingDefaults.strategy === 'allowed') {
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
          if (!hasChildcareRequest && type === 'Childcare') return null;
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
      hasChildcareRequest,
      hasLivingAllowanceRequest
    ]
  );
  const normalizedConflictChoice = useMemo(
    () => normalizeConflictDeclarationChoice(conflictDeclarationChoice),
    [conflictDeclarationChoice]
  );
  const hasDeclaredConflict = normalizedConflictChoice === 'conflict';
  const isDeclarationGateActive = !conflictDeclarationSigned || hasDeclaredConflict;
  const eligibilitySet = Boolean(assessment.esdcEligibility);
  const isEligibilityGateActive = isDeclarationGateActive || !eligibilitySet;
  const showCommunicationStep = isDecisionReadyStatus || isCompletedStatus;
  const activeStepIds = useMemo(() => {
    if (!showNWACSection) return BASE_STEP_IDS;
    const afterSubmit = [...BASE_STEP_IDS, ...SUBMITTED_STEP_IDS];
    return showCommunicationStep ? [...afterSubmit, ...COMMUNICATION_STEP_IDS] : afterSubmit;
  }, [showNWACSection, showCommunicationStep]);
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
  }, [conflictDeclarationSigned, hasDeclaredConflict]);
  const conflictDeclarationSignedDisplayDate = conflictDeclarationSignedAt
    ? formatDate(conflictDeclarationSignedAt)
    : null;
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
      const list = Array.isArray(interventions) ? interventions : [];
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

  const buildAssessmentPayload = useCallback(() => {
    const proposedInterventionsPayload = serializeProposedInterventions(proposedInterventions);
    const primary = proposedInterventions[0] || null;
    const primaryStartDate = primary?.startDate || '';
    const primaryEndDate = primary?.endDate || '';
    const interventionDuration = calculateDurationDays(primaryStartDate, primaryEndDate);
    const overallTotalValue = Number.isFinite(overallCostTotal) ? overallCostTotal : null;
    const payload = {
      assessment_date_of_assessment: formatDate(assessment.dateOfAssessment) || null,
      assessment_employment_goals: assessment.employmentGoals || null,
      assessment_previous_iset: assessment.previousISET || null,
      assessment_previous_iset_details: assessment.previousISETDetails || null,
      assessment_employment_barriers: assessment.barriers || null,
      assessment_employment_barriers_other_details: assessment.barriersOther || null,
      assessment_local_area_priorities: assessment.priorities || null,
      assessment_other_funding_details: assessment.otherFunding || null,
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
      assessment_nwac_review: assessment.nwacReview || null,
      assessment_nwac_reason: assessment.nwacReason || null,
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
    const baseContext = caseData?.caseContext && typeof caseData.caseContext === 'object' ? caseData.caseContext : null;
    const includeLetterDrafts = letterDrafts && typeof letterDrafts === 'object';
    if (baseContext || includeLetterDrafts) {
      payload.caseContext = {
        ...(baseContext || {}),
        ...(includeLetterDrafts ? { decisionLetterDrafts: letterDrafts } : {})
      };
    }
    return payload;
  }, [
    assessment,
    caseData?.caseContext,
    isEligibilityAdmin,
    letterDrafts,
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
  const requiredDocumentChecklistItems = useMemo(
    () => documentChecklistItems.filter(item => item?.required !== false),
    [documentChecklistItems]
  );
  const communicationChecklistItems = useMemo(
    () => documentChecklistItems,
    [documentChecklistItems]
  );
  const requiredCommunicationChecklistItems = useMemo(
    () => communicationChecklistItems.filter(item => item?.required !== false),
    [communicationChecklistItems]
  );
  const communicationChecklistMissingCount = useMemo(
    () => requiredCommunicationChecklistItems.filter(item => item?.status !== 'complete').length,
    [requiredCommunicationChecklistItems]
  );
  const communicationChecklistComplete = Boolean(
    docsChecklistReady &&
      communicationChecklistMissingCount === 0 &&
      !documentChecklistLoading &&
      !documentChecklistError
  );
  const checklistUploadDocTypeOptions = useMemo(
    () =>
      checklistUploadDocTypes.map(type => ({
        value: type,
        label: formatDocTypeLabel(type) || type
      })),
    [checklistUploadDocTypes]
  );
  const canManageBudgetPotPending = useMemo(() => {
    const allowed = new Set(['system administrator', 'program administrator', 'regional manager', 'regional coordinator']);
    return allowed.has(normalizedRole);
  }, [normalizedRole]);
  const showChildcareFunding = assessment.childcareNeed === 'yes';
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
  }, [buildSuggestedCostLines, costingDefaultsLoading, paymentTypeMappingLoading]);
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
    [apiFetch]
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
  const hasDeclarationChoice = normalizedConflictChoice === 'no_conflict' || normalizedConflictChoice === 'conflict';
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
  const isDeclarationSubmissionDisabled =
    !hasDeclarationChoice ||
    (hasDeclaredConflict && !conflictDetailsNormalized) ||
    lockedByAnotherUser ||
    isSigningDeclaration;

  const activeLetterDraft = useMemo(() => {
    if (!activeLetterKey) return buildEmptyDecisionLetterDraft();
    return letterDrafts?.[activeLetterKey] || buildEmptyDecisionLetterDraft();
  }, [activeLetterKey, letterDrafts]);
  const letterWorkflowId = activeLetterKey ? letterWorkflows?.[activeLetterKey] : null;
  const isLetterEditingDisabled = lockedByAnotherUser || isCompletedStatus;
  const canGenerateLetterDraft = Boolean(activeLetterKey) && !isLetterEditingDisabled && !draftingLetter;
  const canSaveLetterDraft = Boolean(activeLetterKey) && !isLetterEditingDisabled;
  const canSendLetter = Boolean(activeLetterKey) && !isLetterEditingDisabled && !!letterWorkflowId && !sendingLetter;

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
      if (caseData?.assessment_nwac_review_status) {
        return String(caseData.assessment_nwac_review_status);
      }
      const statusNorm = typeof rawApplicationStatusNormalized === 'string'
        ? rawApplicationStatusNormalized.trim().toLowerCase()
        : (typeof canonicalApplicationStatus === 'string' ? canonicalApplicationStatus.trim().toLowerCase() : '');
      const caseStatusNorm = typeof caseData?.status === 'string'
        ? caseData.status.trim().toLowerCase()
        : '';
      if (statusNorm === 'approved') return 'approve';
      if (statusNorm === 'rejected') return 'reject';
      if (statusNorm === 'decision_ready' || statusNorm === 'completed') {
        return APPROVED_CASE_STATUSES.has(caseStatusNorm) ? 'approve' : 'reject';
      }
      return '';
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
      if (caseData.assessment_intervention_cost_total === null || typeof caseData.assessment_intervention_cost_total === 'undefined') {
        return null;
      }
      return buildEmptyCostLine({
        type: 'OtherEligibleCost',
        amount: String(caseData.assessment_intervention_cost_total),
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
      otherFunding: caseData?.assessment_other_funding_details || caseData?.other_funding_details || '',
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
    setConflictDeclarationChoice(incomingConflictChoice);
    setConflictDeclarationDetails(caseData?.assessment_conflict_declaration_details || '');
    setDeclarationError(null);

    const contextDrafts =
      caseData?.caseContext?.decisionLetterDrafts ||
      caseData?.caseContext?.decision_letter_drafts ||
      caseData?.caseContext?.decisionLetter ||
      caseData?.caseContext?.decision_letter ||
      null;
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
    const baseDecisionDate = formatDate(caseData?.assessment_date_of_assessment || new Date());
    const defaultApproval = {
      decision_date: baseDecisionDate,
      letter_title: 'Letter of Approval',
      decision_intro: '',
      decision_label: 'Approved',
      decision_reason: caseData?.assessment_justification || '',
      next_step_1: '',
      next_step_2: '',
      coordinator_name: currentUserName || '',
      organization_name: DEFAULT_ORG_NAME
    };
    const defaultDenial = {
      decision_date: baseDecisionDate,
      letter_title: 'Letter of Denial',
      decision_intro: '',
      decision_label: 'Not approved',
      decision_reason: caseData?.assessment_nwac_reason || '',
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
  }, [caseData]);

  // Show NWAC section after submission, review completion, or outcome-ready status
  useEffect(() => {
    const pendingApproval = isPendingApprovalStatus;
    const shouldShowOutcome = pendingApproval || isDecisionFinal || isDecisionReadyStatus;
    setShowNWACSection(shouldShowOutcome);
    setLocalAssessmentSubmitted(pendingApproval || isDecisionFinal || isDecisionReadyStatus);
  }, [isDecisionFinal, isDecisionReadyStatus, isPendingApprovalStatus]);

  // UI logic: once status reaches pending approval or a final decision, lock assessment fields and surface NWAC review
  const isAssessmentSubmitted = isPendingApprovalStatus;
  const isReviewComplete = APPLICATION_FINAL_STATUSES.has(normalizedApplicationStatus);
  const shouldUnlockWizardNavigation = !isEditingAssessment && (isPendingApprovalStatus || isDecisionReadyStatus || isReviewComplete);
  const assessmentSubmitted =
    localAssessmentSubmitted ||
    isAssessmentSubmitted ||
    isReviewComplete ||
    isDecisionFinal ||
    isDecisionReadyStatus ||
    isLockedStatus ||
    lockedByAnotherUser;
  // Disable all fields (including NWAC) if review is complete, a final decision exists, status is locked, conflict not signed, or eligibility not set
  const baseAssessmentLocked = lockedByAnotherUser || isLockedStatus || isReviewComplete || isDecisionFinal || isDecisionReadyStatus;
  const isAssessmentDisabled = baseAssessmentLocked || isEligibilityGateActive || (assessmentSubmitted && !isEditingAssessment);
  const checklistUploadsLocked = isAssessmentDisabled && !isCommunicationStep;
  const isNWACFieldsDisabled = baseAssessmentLocked || isEligibilityGateActive || !showNWACSection || !isPendingApprovalStatus || !canManageOutcomeReview;
  const isEligibilityDisabled = baseAssessmentLocked || isDeclarationGateActive || !isEligibilityAdmin;

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
    const storedStep = resolveStoredWizardStep(wizardStepKey, activeStepIds);
    if (storedStep && storedStep !== currentStep) {
      setCurrentStep(storedStep);
      return;
    }
    if (!activeStepIds.includes(currentStep)) {
      setCurrentStep(BASE_STEP_IDS[0]);
    }
  }, [wizardStepKey, activeStepIds, currentStep, resolveStoredWizardStep]);

  useEffect(() => {
    if (!shouldUnlockWizardNavigation || activeStepIds.length < 2) return;
    const signature = activeStepIds.join('|');
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
  }, [shouldUnlockWizardNavigation, activeStepIds, currentStep]);

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
      }
      if (currentStep === 'communication') {
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
  }, [applicantUserId, applicationId, currentStep]);

  useEffect(() => {
    if (wizardNavPriming) return;
    if (!['docs', 'communication'].includes(currentStep)) return;
    loadDocumentChecklist();
  }, [currentStep, loadDocumentChecklist, wizardNavPriming]);

  const handleChecklistRefresh = useCallback(() => {
    setChecklistUploadError(null);
    setChecklistUploadSuccess(null);
    loadDocumentChecklist();
  }, [loadDocumentChecklist]);

  const handleChecklistUploadClick = useCallback(
    item => {
      if (isAssessmentDisabled && !isCommunicationStep) return;
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
          setChecklistUploadError('EI verification uploads are restricted to Program Administrators, Regional Coordinators/Managers, and System Administrators.');
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
    [canUploadEiVerification, docsChecklistReady, isAssessmentDisabled, isCommunicationStep]
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
            throw new Error('That file type is not allowed. Please upload a PDF or image.');
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

  const handleEiVerificationFileChange = useCallback(event => {
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
      setEiVerificationFileError('Only PDF, JPG, PNG, BMP, or TIFF files are allowed.');
      return;
    }
    if (file.size > ELIGIBILITY_MAX_BYTES) {
      setEiVerificationFile(null);
      setEiVerificationFileError('File is too large (max 6 MB).');
      return;
    }
    setEiVerificationFile(file);
    setEiVerificationFileError(null);
  }, []);

  const uploadEiVerificationIfSelected = useCallback(async () => {
    if (isAssessmentDisabled || !canUploadEiVerification) return true;
    if (!eiVerificationFile) {
      return true;
    }
    if (!assessment.esdcEligibility) {
      setEiVerificationUploadError('Select an eligibility value to upload the document.');
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
      formData.append('file', eiVerificationFile);
      formData.append('label', 'EI Verification');
      formData.append('documentType', 'ei_verification');
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
          throw new Error('That file type is not allowed. Please upload a PDF or image.');
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
      const uploadedName = eiVerificationFile?.name || 'document';
      setEiVerificationUploadSuccess(`Uploaded ${uploadedName}.`);
      setEiVerificationFile(null);
      setEiVerificationFileError(null);
      return true;
    } catch (err) {
      setEiVerificationUploadError(err?.message || 'Failed to upload EI verification document.');
      return false;
    } finally {
      setEiVerificationUploading(false);
    }
  }, [apiFetch, applicantUserId, applicationId, assessment.esdcEligibility, canUploadEiVerification, caseId, eiVerificationFile, isAssessmentDisabled]);

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
  }, [caseData?.application_row_version, applicationRowVersionState, onRowVersionUpdate]);

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
      return nextAssessment;
    });
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
    if (!draft.code) {
      errors.code = 'Select an intervention.';
    }
    if (Object.keys(errors).length) {
      setInterventionModalErrors(errors);
      return;
    }
    if (mode === 'add') {
      addIntervention(draft);
      resetInterventionModal();
      return;
    }
    if (mode === 'edit' && interventionId) {
      const intervention = proposedInterventions.find(item => item.id === interventionId);
      const nextStartDate = formatDate(draft.startDate);
      const nextEndDate = formatDate(draft.endDate);
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
      recurrence: { ...(line.recurrence || {}) }
    };
  }, []);
  const handleInterventionStartDateChange = useCallback(
    (interventionId, nextStartDate) => {
      const endDateUpdate = nextStartDate ? undefined : '';
      applyInterventionDateChange(interventionId, { startDate: nextStartDate, endDate: endDateUpdate }, 'total');
    },
    [applyInterventionDateChange]
  );
  const handleInterventionEndDateChange = useCallback(
    (interventionId, nextEndDate) => {
      const intervention = proposedInterventions.find(item => item.id === interventionId);
      if (!intervention) return;
      if (nextEndDate === intervention.endDate) return;
      if (hasRecurringLineWithAmount(intervention)) {
        setEndDateAdjustModal({
          interventionId,
          previousEndDate: intervention.endDate || '',
          nextEndDate: nextEndDate || '',
          mode: 'total'
        });
        return;
      }
      applyInterventionDateChange(interventionId, { endDate: nextEndDate }, 'total');
    },
    [applyInterventionDateChange, hasRecurringLineWithAmount, proposedInterventions]
  );
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
  }, []);
  const openCostLineModal = useCallback(
    (interventionId, lineId) => {
      const intervention = proposedInterventions.find(item => item.id === interventionId);
      const line = intervention?.costLines?.find(entry => entry.id === lineId);
      if (!line) return;
      const draft = cloneCostLine(line);
      setCostLineModal({
        visible: true,
        mode: 'view',
        interventionId,
        lineId,
        draft,
        original: draft
      });
      setCostLineModalErrors({});
    },
    [cloneCostLine, proposedInterventions]
  );
  const openAddCostLineModal = useCallback((interventionId) => {
    const draft = buildEmptyCostLine();
    setCostLineModal({
      visible: true,
      mode: 'add',
      interventionId,
      lineId: null,
      draft,
      original: draft
    });
    setCostLineModalErrors({});
  }, []);
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
  const updateCostLineType = useCallback(
    (nextType) => {
      setCostLineModal(prev => {
        if (!prev.draft) return prev;
        const intervention = proposedInterventions.find(item => item.id === prev.interventionId);
        if (!intervention) return prev;
        const recurrenceMode = getRecurrenceModeForType(nextType);
        const recurrenceEnabled =
          recurrenceMode === 'required'
            ? true
            : recurrenceMode === 'disabled'
              ? false
              : Boolean(prev.draft.recurrence?.enabled);
        const baseRecurrence = buildRecurrenceFromIntervention(intervention, recurrenceEnabled);
        const mergedRecurrence = mergeRecurrenceDefaults(baseRecurrence, prev.draft.recurrence || {});
        const recurrence = recurrenceEnabled
          ? { ...mergedRecurrence, enabled: true }
          : baseRecurrence;
        return {
          ...prev,
          draft: {
            ...prev.draft,
            type: nextType,
            recurrence
          }
        };
      });
      setCostLineModalErrors({});
    },
    [buildRecurrenceFromIntervention, getRecurrenceModeForType, proposedInterventions]
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
            : recurrenceMode === 'disabled'
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
    const sanitized = sanitizeCurrencyInput(value);
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
    updateCostLineDraft(draft => {
      const formatted = formatCurrencyDisplay(draft.amount);
      return { ...draft, amount: formatted || '' };
    });
  }, [updateCostLineDraft]);
  const updateCostLineAmountPerPeriod = useCallback((value) => {
    const sanitized = sanitizeCurrencyInput(value);
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
    } else if (mode === 'add') {
      const typesInUse = new Set(
        Array.isArray(intervention.costLines) ? intervention.costLines.map(line => line.type).filter(Boolean) : []
      );
      if (typesInUse.has(draft.type)) {
        errors.type = 'This cost item already exists for the intervention.';
      }
    }
    const recurrenceMode = getRecurrenceModeForType(draft.type);
    const recurrenceRequired = recurrenceMode === 'required';
    const recurrenceEnabled = recurrenceRequired || Boolean(draft.recurrence?.enabled);
    const recalcOccurrences = !draft.recurrence?.occurrences && Boolean(draft.recurrence?.endDate);
    const hydratedDraft = hydrateCostLineRecurrence(
      { ...draft, recurrence: { ...(draft.recurrence || {}), enabled: recurrenceEnabled } },
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
      const sanitized = sanitizeCurrencyInput(value);
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
  const handleInlineAmountBlur = useCallback((lineId) => {
    setInlineAmountEditingId(prev => (prev === lineId ? null : prev));
  }, []);
  const handleCancel = () => setShowCancelModal(true);
  const confirmCancel = () => {
    setAssessment(initialAssessment);
    setLetterDrafts(initialLetterDrafts);
    setShowCancelModal(false);
    setAlert(null);
    setIsEditingAssessment(false);
    releaseLock({ silent: true }).catch(() => {});
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
    if (conflictDeclarationSigned || isSigningDeclaration) {
      if (conflictDeclarationSigned && normalizeConflictDeclarationChoice(conflictDeclarationChoice) === 'conflict') {
        setConflictHoldModalVisible(true);
      }
      return;
    }
    const choice = normalizeConflictDeclarationChoice(conflictDeclarationChoice);
    const detailsValue = typeof conflictDeclarationDetails === 'string' ? conflictDeclarationDetails.trim() : '';
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
          assessment_conflict_declaration_details: choice === 'conflict' ? detailsValue : ''
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
        setCurrentStep(BASE_STEP_IDS[0]);
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
    applicationRowVersion,
    caseData?.application_row_version,
    caseData?.id,
    conflictDeclarationSigned,
    conflictDeclarationChoice,
    conflictDeclarationDetails,
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
    const payload = { assessment_esdc_eligibility: nextEligibility || null };
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
    apiFetch,
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
  function validateAssessment(assessment) {
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
      errors.esdcEligibility = 'Eligibility is required.';
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
    if (assessment.nwacReview && !assessment.nwacReason) {
      errors.nwacReason = 'Reason for not approving is required.';
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
  }
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
    [applicantUserId, applicationId]
  );
  const handleSubmit = async () => {
    if (lockedByAnotherUser) {
      showLockAlert({ reason: 'owned_by_other', lock: activeLock }, 'warning');
      return;
    }
    setIsSubmittingAssessment(true);
    try {
      setHasSubmitted(true);
      setValidationAlert(null);
      const errors = validateAssessment(assessment);
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        setValidationAlert([...new Set(Object.values(errors))]);
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

      const submitAssessment = async () => {
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
        };
        if (!APPLICATION_FINAL_STATUSES.has(canonicalApplicationStatus)) {
          payload.status = 'pending_approval';
          payload.applicationStatus = 'pending_approval';
          nextApplicationStatus = 'pending_approval';
        }
        const requestBody = { ...payload };
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
            content: 'Assessment submitted successfully. Application status moved to Pending Approval. Assessments must be approved by an authorised NWAC representative. Your assessment has been flagged for their attention.',
            dismissible: true,
            statusIconAriaLabel: 'Success'
          });
          setValidationAlert(null);
          if (releaseAfterSuccess) {
            releaseLock({ silent: true }).catch(() => {});
          }
        } catch (err) {
          setAlert({ type: 'error', content: err.message || 'Failed to submit assessment.', dismissible: true, statusIconAriaLabel: 'Error' });
          scrollAfterAction();
        }
      };

      const checklistOk = await runDocumentChecklist(submitAssessment, {
        allowBypass: false,
        stage: SUBMIT_ASSESSMENT_STAGE
      });
      if (!checklistOk) return;
      await submitAssessment();
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  const updateLetterDraftField = (field, value) => {
    if (!activeLetterKey) return;
    setLetterDrafts(prev => ({
      ...prev,
      [activeLetterKey]: {
        ...(prev?.[activeLetterKey] || buildEmptyDecisionLetterDraft()),
        [field]: value
      }
    }));
  };

  const persistLetterDraft = useCallback(
    async ({ silent = false } = {}) => {
      if (!caseId) return { ok: false };
      const lockCheck = await ensureLockForOperation();
      if (!lockCheck.ok) return { ok: false };
      const versionToken = Number(applicationRowVersionState || caseData?.application_row_version || 0);
      const baseContext = caseData?.caseContext && typeof caseData.caseContext === 'object' ? caseData.caseContext : {};
      const updatedContext = {
        ...baseContext,
        decisionLetterDrafts: letterDrafts
      };
      const payload = { caseContext: updatedContext };
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
            content: result?.error || 'Failed to save the letter draft.',
            dismissible: true,
            statusIconAriaLabel: 'Error'
          });
        }
        return { ok: false };
      }
      const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
      if (updatedRowVersion) updateRowVersion(updatedRowVersion);
      setInitialLetterDrafts(letterDrafts);
      if (!silent) {
        setAlert({
          type: 'success',
          content: 'Letter draft saved.',
          dismissible: true,
          statusIconAriaLabel: 'Success'
        });
      }
      return { ok: true };
    },
    [applicationRowVersionState, caseData?.application_row_version, caseData?.caseContext, caseId, ensureLockForOperation, letterDrafts, updateRowVersion]
  );

  const handleGenerateLetterDraft = async () => {
    if (!activeLetterKey) {
      setDraftingLetterError('Select a decision outcome before generating a draft.');
      return;
    }
    setDraftingLetter(true);
    setDraftingLetterError(null);
    try {
      const toAmount = (value) => {
        const amount = parseCurrencyToNumber(value);
        return amount > 0 ? amount : null;
      };
      const primary = proposedInterventions[0] || null;
      const costLines = Array.isArray(primary?.costLines) ? primary.costLines : [];
      const sumByType = (types = []) =>
        costLines.reduce((sum, line) => {
          if (!line?.type || !types.includes(line.type)) return sum;
          const amount = parseCurrencyToNumber(line.amount);
          return sum + (amount > 0 ? amount : 0);
        }, 0);
      const knownTypes = new Set([
        'TuitionFeesDirect',
        'TuitionFeesReimbursement',
        'BooksMaterialsDirect',
        'BooksMaterialsReimbursement',
        'LivingAllowance',
        'Childcare',
        'WageSubsidyEmployer'
      ]);
      const otherAmount = costLines.reduce((sum, line) => {
        if (!line?.type || knownTypes.has(line.type)) return sum;
        const amount = parseCurrencyToNumber(line.amount);
        return sum + (amount > 0 ? amount : 0);
      }, 0);
      const fundingBreakdown = {
        tuition: sumByType(['TuitionFeesDirect', 'TuitionFeesReimbursement']) || null,
        books: sumByType(['BooksMaterialsDirect', 'BooksMaterialsReimbursement']) || null,
        materials: null,
        living: sumByType(['LivingAllowance']) || null,
        childcare: sumByType(['Childcare']) || null,
        other_label: null,
        other_amount: otherAmount || null,
        wage_subsidy: sumByType(['WageSubsidyEmployer']) || null,
        wage_mercs: null,
        wage_non_wages: null,
        wage_other_1_label: null,
        wage_other_1_amount: null,
        wage_other_2_label: null,
        wage_other_2_amount: null
      };
      const totalFunding = Number.isFinite(overallCostTotal) && overallCostTotal > 0 ? overallCostTotal : null;
      const recurringDetails = null;
      const requiredDocs = requiredCommunicationChecklistItems
        .map(item => item?.label || item?.id)
        .filter(Boolean);
      const missingDocs = requiredCommunicationChecklistItems
        .filter(item => item?.status !== 'complete')
        .map(item => item?.label || item?.id)
        .filter(Boolean);
      const decisionLabel = activeLetterKey === 'approval' ? 'Approval' : 'Denial';
      const reasonSeed = activeLetterKey === 'approval' ? assessment.justification : assessment.nwacReason;
      const contextPayload = {
        decision: decisionLabel,
        applicant_name: applicantName || null,
        tracking_id: trackingReference || null,
        case_number: caseData?.case_number || null,
        assessment_summary: assessment.overview || null,
        employment_goals: assessment.employmentGoals || null,
        program_name: primary?.programName || null,
        institution: primary?.institution || null,
        intervention_label: primary ? resolveInterventionLabel(primary.code) : null,
        intervention_code: primary?.code || null,
        delivery_mode: primary?.deliveryMode || null,
        intervention_start_date: primary?.startDate || null,
        intervention_end_date: primary?.endDate || null,
        intervention_cost_total: totalFunding || null,
        recurring_details: recurringDetails,
        funding_breakdown: fundingBreakdown,
        required_documents: requiredDocs,
        missing_documents: missingDocs,
        decision_reason_seed: reasonSeed || null
      };
      const reasonInstruction = activeLetterKey === 'denial'
        ? 'For denial letters, decision_reason must be based on decision_reason_seed (Reason for Not Approving). Do not introduce new reasons beyond that text.'
        : 'Use decision_reason_seed as the basis for decision_reason when provided.';
      const prompt = `Draft a concise ${decisionLabel.toLowerCase()} letter for the NWAC ISET program. Return JSON only with keys: letter_title, decision_intro, decision_label, decision_reason, next_step_1, next_step_2. Keep each field brief and professional. ${reasonInstruction} If funding amounts are provided, mention them in the decision_intro or decision_reason. Next steps must focus on start/end dates and the documents required to release payment (use required_documents/missing_documents). Do not mention dollar amounts in next steps. Use the context below and omit unknown details.\n\nContext:\n${JSON.stringify(contextPayload, null, 2)}`;
      const resp = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You draft decision letters for program applicants. Respond only with JSON, no markdown.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3
        })
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => '');
        throw new Error(detail || 'AI draft failed.');
      }
      const data = await resp.json().catch(() => ({}));
      const content = data?.choices?.[0]?.message?.content || '';
      const parsed = extractJsonFromAi(content);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI draft returned invalid JSON.');
      }
      const docList = requiredDocs.length ? requiredDocs.join(', ') : '';
      const defaultDocStep = docList
        ? `Please complete the required documents in your checklist (${docList}) so we can release payment.`
        : 'Please complete the required documents in your checklist so we can release payment.';
      setLetterDrafts(prev => {
        const current = prev?.[activeLetterKey] || buildEmptyDecisionLetterDraft();
        const nextSteps = Array.isArray(parsed.next_steps || parsed.nextSteps) ? (parsed.next_steps || parsed.nextSteps) : [];
        const parsedStep2 = parsed.next_step_2 || nextSteps[1] || current.next_step_2;
        const step2HasCost = typeof parsedStep2 === 'string' && /\$|cost|amount/i.test(parsedStep2);
        return {
          ...prev,
          [activeLetterKey]: {
            ...current,
            letter_title: parsed.letter_title || current.letter_title,
            decision_intro: parsed.decision_intro || current.decision_intro,
            decision_label: parsed.decision_label || current.decision_label,
            decision_reason: parsed.decision_reason || current.decision_reason,
            next_step_1: parsed.next_step_1 || nextSteps[0] || current.next_step_1,
            next_step_2: step2HasCost ? defaultDocStep : (parsedStep2 || defaultDocStep)
          }
        };
      });
    } catch (err) {
      setDraftingLetterError(err?.message || 'Failed to generate a letter draft.');
    } finally {
      setDraftingLetter(false);
    }
  };

  const handleSendDecisionLetter = async () => {
    if (!caseId || !activeLetterKey) {
      setSendingLetterError('Select a decision outcome before sending the letter.');
      return;
    }
    if (!letterWorkflowId) {
      setSendingLetterError('Letter workflow is not configured yet.');
      return;
    }
    setSendingLetter(true);
    setSendingLetterError(null);
    try {
      const saved = await persistLetterDraft({ silent: true });
      if (!saved.ok) {
        throw new Error('Save the letter draft before sending.');
      }
      const subject =
        activeLetterKey === 'approval'
          ? 'Letter of Approval'
          : 'Letter of Denial';
      const body =
        activeLetterKey === 'approval'
          ? 'Please review your approval letter in the portal.'
          : 'Please review your decision letter in the portal.';
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
        const detail = await response.text().catch(() => '');
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
    } catch (err) {
      setSendingLetterError(err?.message || 'Failed to send the decision letter.');
    } finally {
      setSendingLetter(false);
    }
  };

  const handleSave = async () => {
    if (lockedByAnotherUser) {
      showLockAlert({ reason: 'owned_by_other', lock: activeLock }, 'warning');
      return;
    }
    setAlert(null);
    try {
      await uploadEiVerificationIfSelected();
      const payload = buildAssessmentPayload();
      const lockCheck = await ensureLockForOperation();
      if (!lockCheck.ok) return;
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
      const caseUpdatePayload = { ...payload };
      if (updatedRowVersion) {
        updateRowVersion(updatedRowVersion);
        caseUpdatePayload.application_row_version = updatedRowVersion;
      }
      if (typeof onCaseUpdate === 'function') {
        onCaseUpdate(caseUpdatePayload);
      }
      setAlert({ type: 'success', content: 'Assessment saved successfully. All changes have been recorded.', dismissible: true, statusIconAriaLabel: 'Success' });
      setInitialAssessment(assessment);
      setInitialLetterDrafts(letterDrafts);
      setIsChanged(false);
      scrollAfterAction();
      // Refresh caseData from backend to reflect latest changes
      if (typeof actions?.refreshCaseData === 'function') {
        try {
          await actions.refreshCaseData();
        } catch (_) {
          // ignore refresh errors
        }
      }
    } catch (err) {
      setAlert({ type: 'error', content: err.message || 'Failed to save assessment.', dismissible: true, statusIconAriaLabel: 'Error' });
      scrollAfterAction();
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

  // For NWAC review validation
  const validateNWACReview = (assessment) => {
    const errors = {};
    const decision = assessment.nwacReviewStatus;
    if (!decision) {
      errors.nwacReviewStatus = 'Funding decision selection is required.';
    }
    if (decision && decision !== 'push_back' && !assessment.nwacReview) {
      errors.nwacReview = 'Assessment assurance outcome is required.';
    }
    if ((decision === 'reject' || decision === 'push_back') && (!assessment.nwacReason || !assessment.nwacReason.trim())) {
      errors.nwacReason = decision === 'push_back'
        ? 'Reason for push back is required.'
        : 'Reason for not approving is required.';
    }
    return errors;
  };
  const shouldShowStepErrors = useCallback(
    (stepId) => hasSubmitted || attemptedSteps[stepId],
    [hasSubmitted, attemptedSteps]
  );
  const validateWizardStep = useCallback(
    (stepId) => {
      if (isAssessmentDisabled && !['decision', 'eligibility', 'communication'].includes(stepId)) {
        return true;
      }
      const errors = validateAssessment(assessment);
      const interventionErrors = errors.interventions || {};
      const hasInterventionFieldError = (keys = []) =>
        Object.values(interventionErrors).some(entry => entry && keys.some(key => entry[key]));
      if (stepId === 'eligibility') {
        return !errors.esdcEligibility;
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
        const requiredStepsValid = REQUIRED_STEP_IDS.every(id => validateWizardStep(id));
        return requiredStepsValid && !errors.recommendation && !errors.justification;
      }
      if (stepId === 'decision') {
        if (isNWACFieldsDisabled || !canManageOutcomeReview) return true;
        const outcomeErrors = validateNWACReview(assessment);
        return Object.keys(outcomeErrors).length === 0;
      }
      if (stepId === 'communication') {
        return communicationChecklistComplete;
      }
      return false;
    },
    [
      assessment,
      assessmentSubmitted,
      canManageOutcomeReview,
      communicationChecklistComplete,
      docsChecklistComplete,
      isAssessmentDisabled,
      isNWACFieldsDisabled,
      validateAssessment,
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
      setValidationAlert([...new Set(Object.values(errors))]);
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

  const handleComplete = async () => {
    if (!isPendingApprovalStatus) {
      return;
    }
    if (!canManageOutcomeReview) {
      setValidationAlert(['You do not have permission to complete the outcome notice for this case.']);
      return;
    }
    setHasSubmitted(true);
    setValidationAlert(null);
    const errors = validateNWACReview(assessment);
    const decision = assessment.nwacReviewStatus;
    const isOutcomeApproved = decision === 'approve';
    const isOutcomePushBack = decision === 'push_back';
    if (isOutcomeApproved && decisionHasCost && !assessment.interventionPotId) {
      errors.interventionPotId = 'Select a budget pot for the intervention cost.';
    }
    if (isOutcomeApproved && decisionHasCost && assessment.interventionPotId && !assessment.postingContext) {
      errors.postingContext = 'Select how this pot is paid from.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setValidationAlert([...new Set(Object.values(errors))]);
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
    // Send full assessment payload to backend
    const lockCheck = await ensureLockForOperation();
    if (!lockCheck.ok) return;
    const releaseAfterSuccess = lockCheck.localOwner || lockHeldByCurrentUser;
    const versionToken = Number(applicationRowVersionState || caseData?.application_row_version || 0);
    const payload = {
      ...buildAssessmentPayload(),
      assessment_submit_action: true,
      assessment_nwac_review_status: decision || null,
      status: isOutcomeApproved ? 'initiated' : NOT_APPROVED_CASE_STATUS,
      applicationStatus: isOutcomePushBack ? 'in_review' : DECISION_READY_STATUS
    };
    const requestBody = { ...payload };
    if (versionToken > 0) {
      requestBody.expectedRowVersion = versionToken;
    }
    try {
      // 1. Update case with NWAC review and status
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
      if (!res.ok || !result?.success) throw new Error(result?.error || 'Failed to save NWAC review.');
      const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
      if (updatedRowVersion) {
        updateRowVersion(updatedRowVersion);
      }
      // Events emitted server-side; refresh caseData to reflect new status
      const fallbackUpdates = {
        status: payload.status,
        statusRaw: payload.status,
        applicationStatus: payload.applicationStatus || caseData?.applicationStatus || null,
        assessment_nwac_review: payload.assessment_nwac_review,
        assessment_nwac_reason: payload.assessment_nwac_reason
      };
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
      setShowEditConfirmModal(false);
      setShowApproveConfirmModal(false);
      setShowCancelModal(false);
      setLocalAssessmentSubmitted(true);
      setFieldErrors({});
      setHasSubmitted(false);
      scrollAfterAction();
      const decisionMessage = (() => {
        if (isOutcomePushBack) return 'Decision pushed back. Application returned to In review.';
        if (isOutcomeApproved) return 'Decision recorded. Prepare the approval letter and funding agreement.';
        return 'Decision recorded. Prepare the denial letter.';
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
    }
  };

  const handleApproveClick = async () => {
    if (isHighCostApprovalBlocked) {
      setValidationAlert([`Regional Managers cannot approve applications with total cost \u2265 $${APPROVAL_COST_THRESHOLD.toLocaleString()}. Escalate to Program Administrators.`]);
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

  const handleCommunicationComplete = async () => {
    if (!showCommunicationStep || isCompletedStatus) {
      return;
    }
    setHasSubmitted(true);
    const checklistOk = await runDocumentChecklist(null, {
      allowBypass: false,
      stage: COMMUNICATION_CHECKLIST_STAGE
    });
    if (!checklistOk) return;
    const lockCheck = await ensureLockForOperation();
    if (!lockCheck.ok) return;
    const releaseAfterSuccess = lockCheck.localOwner || lockHeldByCurrentUser;
    const versionToken = Number(applicationRowVersionState || caseData?.application_row_version || 0);
    const payload = { applicationStatus: 'completed' };
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
        return;
      }
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to mark communication complete.');
      }
      const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
      if (updatedRowVersion) {
        updateRowVersion(updatedRowVersion);
      }
      if (typeof onCaseUpdate === 'function') {
        const updates = { applicationStatus: 'completed' };
        if (updatedRowVersion) updates.application_row_version = updatedRowVersion;
        onCaseUpdate(updates);
      }
      if (typeof actions?.refreshCaseData === 'function') {
        try {
          await actions.refreshCaseData();
        } catch (_) {}
      }
      dispatchSupportingDocsRefresh();
      setAlert({
        type: 'success',
        content: 'Communication complete. Application marked as completed.',
        dismissible: true,
        statusIconAriaLabel: 'Success'
      });
      setHasSubmitted(false);
      scrollAfterAction();
      if (releaseAfterSuccess) {
        releaseLock({ silent: true }).catch(() => {});
      }
    } catch (err) {
      setAlert({ type: 'error', content: err.message || 'Failed to complete communication.', dismissible: true, statusIconAriaLabel: 'Error' });
      scrollAfterAction();
    }
  };
  const handleWizardNavigate = async ({ detail }) => {
    const { requestedStepIndex } = detail || {};
    if (requestedStepIndex < 0 || requestedStepIndex >= activeStepIds.length) return;
    const requestedStepId = activeStepIds[requestedStepIndex];
    const currentIdx = activeStepIds.indexOf(currentStep);
    if (requestedStepIndex > currentIdx) {
      if (!isAssessmentDisabled || currentStep === 'eligibility') {
        setAttemptedSteps(prev => ({ ...prev, [currentStep]: true }));
        setFieldErrors(validateAssessment(assessment));
        const valid = validateWizardStep(currentStep);
        if (!valid) {
          return;
        }
        if (!isAssessmentDisabled && currentStep === 'eligibility') {
          const eligibilitySaved = await persistEligibilitySelection();
          if (!eligibilitySaved.ok) {
            return;
          }
          const uploadOk = await uploadEiVerificationIfSelected();
          if (!uploadOk) {
            return;
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
    setCurrentStep(requestedStepId);
  };

  const headerElement = (
    <Header
      variant="h2"
      actions={
        <SpaceBetween direction="horizontal" size="s">
          {!isEligibilityGateActive && !lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && isReviewComplete && (
            <Button variant="normal" onClick={() => setShowEditConfirmModal(true)}>Edit</Button>
          )}
          {!isEligibilityGateActive && !lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && assessmentSubmitted && !isEditingAssessment && (
            <Button variant="normal" onClick={() => setShowEditConfirmModal(true)}>Edit</Button>
          )}
          {!isEligibilityGateActive && !lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && (!assessmentSubmitted || isEditingAssessment) && (
            <Button variant="primary" disabled={!isChanged} onClick={handleSave}>Save Progress</Button>
          )}
        </SpaceBetween>
      }
      info={
        <Link
          variant="info"
          onFollow={() => {
            if (!toggleHelpPanel) return;
            if (showNWACSection) {
              toggleHelpPanel(<NwacAssessmentHelp />, 'NWAC Assessment Help', NwacAssessmentHelp.aiContext);
            } else {
              toggleHelpPanel(<ApplicationAssessmentHelp />, 'Application Assessment Help', ApplicationAssessmentHelp.aiContext);
            }
          }}
        >
          Info
        </Link>
      }
    >
      <Hotspot hotspotId="app-workspace-assessment" direction="right" />
      {showNWACSection ? 'NWAC Assessment' : 'Application Assessment'}
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

  const renderRecommendationSection = () => {
    const showReviewErrors = shouldShowStepErrors('review');
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
            readOnly={isAssessmentDisabled}
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
                data-error-focus={showReviewErrors && fieldErrors.justification ? 'true' : undefined}
                tabIndex={-1}
                readOnly={isAssessmentDisabled}
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
  const interventionFieldErrors = fieldErrors.interventions || {};
  const costLineFieldErrors = fieldErrors.costLines || {};

  const eligibilityStepContent = (
    <SpaceBetween size="l">
      {canUploadEiVerification && (
        <input
          type="file"
          ref={eiVerificationFileInputRef}
          style={{ display: 'none' }}
          accept=".pdf,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
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
          label="Eligibility"
          errorText={showEligibilityErrors && fieldErrors.esdcEligibility ? fieldErrors.esdcEligibility : undefined}
          description="Select the client's eligibility category for ESDC funding."
        >
          <Select
            selectedOption={ESDC_OPTIONS.find(o => o.value === assessment.esdcEligibility) || null}
            onChange={({ detail }) => {
              handleField('esdcEligibility', detail.selectedOption.value);
              setEiVerificationUploadError(null);
              setEiVerificationUploadSuccess(null);
            }}
            options={ESDC_OPTIONS}
            placeholder="Select eligibility"
            ariaLabel="Eligibility"
            data-error-focus={showEligibilityErrors && fieldErrors.esdcEligibility ? 'true' : undefined}
            tabIndex={-1}
            readOnly={isEligibilityDisabled}
          />
        </FormField>
      </Grid>
      {canUploadEiVerification && (
        <FormField label="EI Verification document" errorText={eiVerificationFileError} stretch>
          <Box variant="small" color="text-body-secondary">
            Max size 6 MB. Allowed types: PDF, JPG, PNG, BMP, TIFF.
          </Box>
          <SpaceBetween size="xs" direction="horizontal">
            <Button
              onClick={() => eiVerificationFileInputRef.current && eiVerificationFileInputRef.current.click()}
              disabled={isAssessmentDisabled || eiVerificationUploading || !applicationId || !applicantUserId}
            >
              Choose file
            </Button>
            <Box>{eiVerificationFile ? eiVerificationFile.name : 'No file selected'}</Box>
          </SpaceBetween>
          <Box variant="small" color="text-body-secondary">
            Upload happens when you continue or save.
          </Box>
        </FormField>
      )}
    </SpaceBetween>
  );

  const framingStepContent = (
    <SpaceBetween size="l">
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
              <Button onClick={openAddInterventionModal} disabled={isAssessmentDisabled}>
                Add intervention
              </Button>
            }
          >
            Proposed interventions
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
        const wageSubsidyCode = isWageSubsidyCode(intervention.code);
        const requiresExternal = requiresExternalPartnerForCode(intervention.code);
        const deliveryMode = intervention.deliveryMode === 'in_house' ? 'in_house' : 'partner';
        return (
          <SpaceBetween key={intervention.id} size="m">
            <Header variant="h3">
              {resolveInterventionLabel(intervention.code) || 'Intervention details'}
            </Header>
            {!requiresExternal && (
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
                      readOnly={isAssessmentDisabled}
                    />
                  </FormField>
                </ColumnLayout>
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
                      data-error-focus={showTypeErrors && interventionFieldErrors[intervention.id]?.interventionNoc ? 'true' : undefined}
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
                      placeholder="Employer, wage subsidy amount/percentage, duration, expectations."
                      data-error-focus={showTypeErrors && interventionFieldErrors[intervention.id]?.wageSubsidyDetails ? 'true' : undefined}
                      readOnly={isAssessmentDisabled}
                    />
                  </FormField>
                )}
              </SpaceBetween>
            )}

            {!educationCode && !employerCode && (
              deliveryMode === 'partner' ? (
                <FormField
                  label="Delivery partner / provider"
                  errorText={showTypeErrors ? interventionFieldErrors[intervention.id]?.institution : undefined}
                >
                  <Input
                    value={intervention.institution}
                    onChange={({ detail }) => updateIntervention(intervention.id, { institution: detail.value })}
                    placeholder="Training institution, employer, or provider"
                    data-error-focus={showTypeErrors && interventionFieldErrors[intervention.id]?.institution ? 'true' : undefined}
                    readOnly={isAssessmentDisabled}
                  />
                </FormField>
              ) : (
                <Alert type="info" header="In-house delivery">
                  No external delivery partner needed for this intervention.
                </Alert>
              )
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
            description="Provide program names, dates, and outcomes for prior ISET-funded interventions."
            errorText={showPreviousIsetErrors && fieldErrors.previousISETDetails ? fieldErrors.previousISETDetails : undefined}
          >
            <Textarea
              value={assessment.previousISETDetails || ''}
              onChange={({ detail }) => handleField('previousISETDetails', detail.value)}
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
          <ColumnLayout columns={2} variant="text-grid">
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
          </ColumnLayout>
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

  const otherFundingStepContent = (
    <SpaceBetween size="l">
      <Grid gridDefinition={[{ colspan: 12 }]}>
        <FormField
          label="Funding source details"
          description="Capture band try-first funding, EI/CRF stream notes, or other sponsors supporting this request."
        >
          <Textarea
            value={assessment.otherFunding || ''}
            onChange={({ detail }) => handleField('otherFunding', detail.value)}
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
                      ? sanitizeCurrencyInput(item.amount)
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
                          onBlur={() => handleInlineAmountBlur(item.id)}
                          placeholder="0.00"
                          readOnly={isAssessmentDisabled}
                          data-error-focus={showCostErrors && lineError.amount ? 'true' : undefined}
                        />
                      </FormField>
                    );
                  }
                },
                {
                  id: 'installments',
                  header: 'Installments',
                  cell: item => {
                    return getInstallmentText(item);
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
      {showDocsInfoAlert && (
        <Alert
          type="info"
          header="Supporting documents"
          dismissible
          onDismiss={() => setShowDocsInfoAlert(false)}
        >
          Do not submit this assessment until all required documents are obtained. Missing checklist items below link
          directly to uploads, and the checklist refreshes automatically after new uploads.
        </Alert>
      )}
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
                <Link
                  href="#supporting-documents"
                  onFollow={event => {
                    event.preventDefault();
                    openAssessmentWidget('supporting-documents');
                  }}
                >
                  Open Supporting Documents
                </Link>
                <Link
                  href="#secure-messaging"
                  onFollow={event => {
                    event.preventDefault();
                    openAssessmentWidget('secure-messaging');
                  }}
                >
                  Open Secure Messaging
                </Link>
              </SpaceBetween>
            }
          >
            Checklist
          </Header>
          <Table
            stripedRows
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

  const communicationStepContent = (
    <SpaceBetween size="m">
      <Alert
        type="info"
        header="Decision communication"
      >
        Upload the assessment approval or denial letter and ensure any required agreements are signed before completing this step.
      </Alert>
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
      <Box>
        <Header
          variant="h3"
          description={
            activeLetterKey
              ? `Draft and send the ${activeLetterKey === 'approval' ? 'approval' : 'denial'} letter.`
              : 'Record an approval or denial before drafting the letter.'
          }
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                onClick={handleGenerateLetterDraft}
                disabled={!canGenerateLetterDraft || letterWorkflowsLoading}
                loading={draftingLetter}
              >
                Generate draft
              </Button>
              <Button
                onClick={() => persistLetterDraft({ silent: false })}
                disabled={!canSaveLetterDraft}
              >
                Save draft
              </Button>
              <Button
                variant="primary"
                onClick={handleSendDecisionLetter}
                disabled={!canSendLetter}
                loading={sendingLetter}
              >
                Send letter
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
        {activeLetterKey && (
          <SpaceBetween size="m">
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <FormField label="Decision date">
                <DatePicker
                  value={activeLetterDraft.decision_date || ''}
                  onChange={({ detail }) => updateLetterDraftField('decision_date', detail.value)}
                  placeholder="YYYY-MM-DD"
                  disabled={isLetterEditingDisabled}
                />
              </FormField>
              <FormField label="Letter title">
                <Input
                  value={activeLetterDraft.letter_title || ''}
                  onChange={({ detail }) => updateLetterDraftField('letter_title', detail.value)}
                  disabled={isLetterEditingDisabled}
                />
              </FormField>
            </Grid>
            <FormField label="Intro paragraph">
              <Textarea
                value={activeLetterDraft.decision_intro || ''}
                onChange={({ detail }) => updateLetterDraftField('decision_intro', detail.value)}
                rows={3}
                disabled={isLetterEditingDisabled}
              />
            </FormField>
            <FormField label="Decision label">
              <Input
                value={activeLetterDraft.decision_label || ''}
                onChange={({ detail }) => updateLetterDraftField('decision_label', detail.value)}
                disabled={isLetterEditingDisabled}
              />
            </FormField>
            <FormField label="Decision reason">
              <Textarea
                value={activeLetterDraft.decision_reason || ''}
                onChange={({ detail }) => updateLetterDraftField('decision_reason', detail.value)}
                rows={3}
                disabled={isLetterEditingDisabled}
              />
            </FormField>
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <FormField label="Next step 1">
                <Textarea
                  value={activeLetterDraft.next_step_1 || ''}
                  onChange={({ detail }) => updateLetterDraftField('next_step_1', detail.value)}
                  rows={2}
                  disabled={isLetterEditingDisabled}
                />
              </FormField>
              <FormField label="Next step 2">
                <Textarea
                  value={activeLetterDraft.next_step_2 || ''}
                  onChange={({ detail }) => updateLetterDraftField('next_step_2', detail.value)}
                  rows={2}
                  disabled={isLetterEditingDisabled}
                />
              </FormField>
            </Grid>
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <FormField label="Coordinator name">
                <Input
                  value={activeLetterDraft.coordinator_name || ''}
                  onChange={({ detail }) => updateLetterDraftField('coordinator_name', detail.value)}
                  disabled={isLetterEditingDisabled}
                />
              </FormField>
              <FormField label="Organization name">
                <Input
                  value={activeLetterDraft.organization_name || ''}
                  onChange={({ detail }) => updateLetterDraftField('organization_name', detail.value)}
                  disabled={isLetterEditingDisabled}
                />
              </FormField>
            </Grid>
          </SpaceBetween>
        )}
      </Box>
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
                    : communicationChecklistMissingCount > 0
                      ? `${communicationChecklistMissingCount} required item${communicationChecklistMissingCount === 1 ? '' : 's'} missing`
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
                <Link
                  href="#supporting-documents"
                  onFollow={event => {
                    event.preventDefault();
                    openAssessmentWidget('supporting-documents');
                  }}
                >
                  Open Supporting Documents
                </Link>
                <Link
                  href="#secure-messaging"
                  onFollow={event => {
                    event.preventDefault();
                    openAssessmentWidget('secure-messaging');
                  }}
                >
                  Open Secure Messaging
                </Link>
              </SpaceBetween>
            }
          >
            Communication checklist
          </Header>
          <Table
            stripedRows
            trackBy="id"
            variant="embedded"
            loading={documentChecklistLoading}
            loadingText="Loading checklist"
            items={requiredCommunicationChecklistItems}
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

  const reviewAssessmentDate = assessment.dateOfAssessment || 'Set on submit';
  const reviewBarriers = assessment.barriers?.length ? assessment.barriers.join(', ') : 'None';
  const reviewBarriersOther = (assessment.barriers || []).includes('Other') ? (assessment.barriersOther || '—') : null;
  const reviewPriorities = assessment.priorities?.length ? assessment.priorities.join(', ') : 'None';
  const reviewPreviousIset = assessment.previousISET === 'yes' ? 'Yes' : assessment.previousISET === 'no' ? 'No' : '—';
  const reviewChildcareNeed = assessment.childcareNeed === 'yes' ? 'Yes' : assessment.childcareNeed === 'no' ? 'No' : '—';
  const reviewPostingContext = selectedPostingContext?.label || (assessment.postingContext ? formatCaseStatusLabel(assessment.postingContext) : '—');
  const reviewOverallCost = formatCurrencyDisplay(overallCostTotal) || '$ 0.00';
  const reviewInterventions = proposedInterventions.map(intervention => {
    const label = resolveInterventionLabel(intervention.code) || 'Intervention';
    const noc = intervention.interventionNoc
      ? `${intervention.interventionNoc}${intervention.interventionNocVersion ? ` (${intervention.interventionNocVersion})` : ''}`
      : intervention.interventionNocVersion
        ? `NOC version ${intervention.interventionNocVersion}`
        : '—';
    return {
      id: intervention.id,
      label,
      deliveryMode: intervention.deliveryMode === 'in_house' ? 'In-house (no external partner)' : 'External delivery partner',
      institution: intervention.institution || '—',
      programName: intervention.programName || '—',
      startDate: intervention.startDate || '—',
      endDate: intervention.endDate || 'Not set',
      itpDetails: intervention.itpDetails || '',
      wageSubsidyDetails: intervention.wageSubsidyDetails || '',
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
          <div>Date of assessment: {reviewAssessmentDate}</div>
          <div>Overview: {assessment.overview || '—'}</div>
          <div>Employment goals: {assessment.employmentGoals || '—'}</div>
          <div>Barriers: {reviewBarriers}</div>
          {reviewBarriersOther && <div>Other barrier details: {reviewBarriersOther}</div>}
          <div>Local priorities: {reviewPriorities}</div>
        </Box>
        <Box>
          <Header variant="h4">Client context</Header>
          <div>Eligibility: {assessment.esdcEligibility || '—'}</div>
          <div>Childcare need: {reviewChildcareNeed}</div>
          <div>Childcare funding: {assessment.childcareFunding || '—'}</div>
          <div>Previous ISET funding: {reviewPreviousIset}</div>
          <div>Previous ISET details: {assessment.previousISETDetails || '—'}</div>
          <div>Other funding sources: {assessment.otherFunding || '—'}</div>
        </Box>
        <Box>
          <Header variant="h4">Interventions</Header>
          {reviewInterventions.length === 0 ? (
            <div>—</div>
          ) : (
            <SpaceBetween size="s">
              {reviewInterventions.map(intervention => (
                <Box key={intervention.id}>
                  <Box fontWeight="bold">{intervention.label}</Box>
                  <div>Delivery mode: {intervention.deliveryMode}</div>
                  <div>Provider: {intervention.institution}</div>
                  <div>Program name: {intervention.programName}</div>
                  <div>NOC: {intervention.noc}</div>
                  {intervention.itpDetails ? <div>ITP details: {intervention.itpDetails}</div> : null}
                  {intervention.wageSubsidyDetails ? <div>Wage subsidy details: {intervention.wageSubsidyDetails}</div> : null}
                  <div>Start: {intervention.startDate}</div>
                  <div>End: {intervention.endDate}</div>
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
          <div>Budget pot: {selectedBudgetPotOption?.label || '—'}</div>
          <div>Paid from: {reviewPostingContext}</div>
        </Box>
      </ColumnLayout>
      {!assessmentSubmitted && renderRecommendationSection()}
    </SpaceBetween>
  );

  const interventionModalDraft = interventionModal.draft || null;
  const interventionModalMode = interventionModal.mode;
  const interventionModalEditable = interventionModalMode === 'add' || interventionModalMode === 'edit';
  const interventionModalDirty =
    interventionModalMode === 'edit'
      ? JSON.stringify(interventionModalDraft || {}) !== JSON.stringify(interventionModal.original || {})
      : true;
  const activeInterventionErrors = {
    ...(showFramingErrors ? (interventionFieldErrors[interventionModal.interventionId] || {}) : {}),
    ...((interventionModalMode === 'add' || interventionModalMode === 'edit') ? interventionModalErrors : {})
  };
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
            <FormField label="Start date" errorText={activeInterventionErrors.startDate}>
              <DatePicker
                value={interventionModalDraft.startDate || ''}
                onChange={({ detail }) => updateInterventionModalDraft({ startDate: detail.value })}
                readOnly={!interventionModalEditable || isAssessmentDisabled}
              />
            </FormField>
            <FormField label="End date (optional)" errorText={activeInterventionErrors.endDate}>
              <DatePicker
                value={interventionModalDraft.endDate || ''}
                onChange={({ detail }) => updateInterventionModalDraft({ endDate: detail.value })}
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
  const costLineRecurrenceDisabled = costLineRecurrenceMode === 'disabled';
  const costLineRecurrenceEnabled = costLineRecurrenceDisabled
    ? false
    : costLineRecurrenceRequired || Boolean(costLineDraft?.recurrence?.enabled);
  const costLineDirty =
    costLineMode === 'edit'
      ? JSON.stringify(costLineDraft || {}) !== JSON.stringify(costLineModal.original || {})
      : true;
  const costLineAmountDisplay = costLineDraft
    ? (isCostLineEditable
      ? sanitizeCurrencyInput(costLineDraft.amount)
      : getCurrencyInputDisplayValue(parseCurrencyInput(costLineDraft.amount) ?? '', false))
    : '';
  const costLineAmountPerPeriodDisplay = costLineDraft
    ? (isCostLineEditable
      ? sanitizeCurrencyInput(costLineDraft.recurrence?.amountPerPeriod)
      : getCurrencyInputDisplayValue(parseCurrencyInput(costLineDraft.recurrence?.amountPerPeriod) ?? '', false))
    : '';
  const costLineRecurrenceStart =
    costLineDraft?.recurrence?.startDate || costLineIntervention?.startDate || '';
  const costLineRecurrenceEnd =
    costLineDraft?.recurrence?.endDate || costLineIntervention?.endDate || '';

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
            {costLineMode === 'add' ? (
              <Select
                selectedOption={
                  costLineTypeOptions.find(option => option.value === costLineDraft.type) || null
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
              onBlur={blurCostLineAmount}
              placeholder="0.00"
              readOnly={!isCostLineEditable || isAssessmentDisabled}
            />
          </FormField>
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
                    readOnly={!isCostLineEditable || isAssessmentDisabled}
                  />
                </FormField>
                <FormField label="Amount per month">
                  <Input
                    inputMode="decimal"
                    value={costLineAmountPerPeriodDisplay}
                    onChange={({ detail }) => updateCostLineAmountPerPeriod(detail.value)}
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

  const decisionStepContent = (
    <>
      <Box
        style={
          isNWACFieldsDisabled || isOutcomeNoticeDisabled
            ? { opacity: 0.6, pointerEvents: 'none' }
            : undefined
        }
        aria-disabled={isNWACFieldsDisabled || isOutcomeNoticeDisabled}
      >
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
          <FormField label="Funding Decision" errorText={showDecisionErrors && fieldErrors.nwacReviewStatus ? fieldErrors.nwacReviewStatus : undefined}>
            <SpaceBetween direction="horizontal" size="xs">
              <Hotspot hotspotId="nwac-decision-status" direction="right">
                <RadioGroup
                  value={assessment.nwacReviewStatus || ''}
                  onChange={({ detail }) => {
                    if (detail.value === 'approve' && isHighCostApprovalBlocked) {
                      setValidationAlert([`Regional Managers cannot approve applications with total cost \u2265 $${APPROVAL_COST_THRESHOLD.toLocaleString()}. Escalate to Program Administrators.`]);
                      return;
                    }
                    if (isNWACFieldsDisabled) return;
                    if (detail.value === 'approve' && assessment.nwacReason) {
                      setShowApproveConfirmModal(true);
                    } else {
                      handleField('nwacReviewStatus', detail.value);
                      if (detail.value === 'approve') handleField('nwacReason', '');
                      if (detail.value === 'push_back') handleField('nwacReview', '');
                    }
                  }}
                  items={[
                    { value: 'approve', label: 'Approved' },
                    { value: 'reject', label: 'Not Approved' },
                    { value: 'push_back', label: 'Push back to coordinator' }
                  ]}
                  ariaLabel="NWAC Review Status"
                  data-error-focus={showDecisionErrors && fieldErrors.nwacReviewStatus ? 'true' : undefined}
                  readOnly={isNWACFieldsDisabled}
                />
              </Hotspot>
            </SpaceBetween>
          </FormField>
          <FormField label="Assessment Assurance" errorText={showDecisionErrors && fieldErrors.nwacReview ? fieldErrors.nwacReview : undefined}>
            <Hotspot hotspotId="nwac-assessment-assurance" direction="right">
              <Select
                selectedOption={assessment.nwacReview ? { label: assessment.nwacReview, value: assessment.nwacReview } : null}
                onChange={({ detail }) => {
                  if (isNWACFieldsDisabled) return;
                  handleField('nwacReview', detail.selectedOption.value);
                }}
                options={[
                  { label: 'Agree with Coordinator Recommendation', value: 'agree' },
                  { label: 'Disagree with Coordinator Recommendation', value: 'disagree' }
                ]}
                placeholder="Select review outcome"
                data-error-focus={showDecisionErrors && fieldErrors.nwacReview ? 'true' : undefined}
                readOnly={isNWACFieldsDisabled || assessment.nwacReviewStatus === 'push_back'}
              />
            </Hotspot>
          </FormField>
        </Grid>
        {['reject', 'push_back'].includes(assessment.nwacReviewStatus) && (
          <Grid gridDefinition={[{ colspan: 12 }]}>
            <FormField
              label={assessment.nwacReviewStatus === 'push_back' ? 'Reason for Push Back' : 'Reason for Not Approving'}
              stretch={true}
            >
              <Box width="100%">
                <Hotspot hotspotId="nwac-decision-reason" direction="right">
                  <Textarea value={assessment.nwacReason} onChange={({ detail }) => {
                    if (isNWACFieldsDisabled) return;
                    handleField('nwacReason', detail.value);
                  }} data-error-focus={showDecisionErrors && fieldErrors.nwacReason ? 'true' : undefined} readOnly={isNWACFieldsDisabled} />
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
      <Modal
        visible={showApproveConfirmModal}
        onDismiss={() => setShowApproveConfirmModal(false)}
        header="Clear not-approved reason?"
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
            }}>Clear and Approve</Button>
            <Button variant="normal" onClick={() => setShowApproveConfirmModal(false)}>Cancel</Button>
          </SpaceBetween>
        }
      >
        <Box>Switching to "Approve" will clear the reason for not approving. Do you want to continue?</Box>
      </Modal>
    </>
  );

  const stepDefinitionById = {
    eligibility: { title: STEP_LABELS.eligibility, content: eligibilityStepContent, isOptional: false },
    framing: { title: STEP_LABELS.framing, content: framingStepContent, isOptional: false },
    rationale: { title: STEP_LABELS.rationale, content: rationaleStepContent, isOptional: false },
    type: { title: STEP_LABELS.type, content: typeStepContent, isOptional: false },
    childcare: { title: STEP_LABELS.childcare, content: childcareStepContent, isOptional: false },
    previousIset: { title: STEP_LABELS.previousIset, content: previousIsetStepContent, isOptional: false },
    barriers: { title: STEP_LABELS.barriers, content: barriersStepContent, isOptional: false },
    priorities: { title: STEP_LABELS.priorities, content: prioritiesStepContent, isOptional: false },
    otherFunding: { title: STEP_LABELS.otherFunding, content: otherFundingStepContent, isOptional: false },
    cost: { title: STEP_LABELS.cost, content: costStepContent, isOptional: false },
    docs: { title: STEP_LABELS.docs, content: docsStepContent, isOptional: false },
    review: { title: STEP_LABELS.review, content: reviewStepContent, isOptional: false },
    decision: { title: STEP_LABELS.decision, content: decisionStepContent, isOptional: false },
    communication: { title: STEP_LABELS.communication, content: communicationStepContent, isOptional: false }
  };

  const steps = activeStepIds
    .map(stepId => {
      const definition = stepDefinitionById[stepId];
      if (!definition) return null;
      return { id: stepId, ...definition };
    })
    .filter(Boolean);

  const activeStepIndex = Math.max(activeStepIds.indexOf(currentStep), 0);
  const canSubmitAssessment = !isEligibilityGateActive && !lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && (!assessmentSubmitted || isEditingAssessment);
  const canSubmitOutcome = !isEligibilityGateActive && !lockedByAnotherUser && showOutcomeByStatus && showNWACSection && !isEditingAssessment && !isOutcomeNoticeDisabled && canManageOutcomeReview && !checkingChecklist;
  const canSubmitCommunication = isCommunicationStep && showCommunicationStep && !lockedByAnotherUser && !isCompletedStatus && !checkingChecklist;
  const wizardSubmitHandler = isCommunicationStep
    ? (canSubmitCommunication ? handleCommunicationComplete : undefined)
    : (showNWACSection ? (canSubmitOutcome ? handleApproveClick : undefined) : (canSubmitAssessment ? handleSubmit : undefined));
  const wizardSubmitLabel = isCommunicationStep
    ? 'Mark communication complete'
    : (showNWACSection ? 'Commit' : 'Submit assessment');
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
            This form is used by the ISET admin team to assess the applicant's needs, eligibility, and funding recommendation.
            {hasDeclaredConflict
              ? ' A conflict of interest was declared; assessment is locked until the conflict is resolved or the case is reassigned.'
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
                  As the Client Case Manager, declare whether you have any actual, potential, or perceived conflict of interest or bias related to this
                  client's application or assessment. If a conflict exists, describe it so the file can be triaged appropriately.
                </Box>
                <Box color="text-status-inactive">
                  This declaration is recorded per staff member. Even if a previous owner signed, you must complete it before continuing your assessment work.
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
                description="Choose the option that applies for this case."
                errorText={!hasDeclarationChoice && declarationError ? declarationError : undefined}
              >
                <RadioGroup
                  value={hasDeclarationChoice ? normalizedConflictChoice : null}
                  items={[
                    {
                      value: 'no_conflict',
                      label: 'I do not have any actual, potential, or perceived conflict of interest or bias for this case.'
                    },
                    {
                      value: 'conflict',
                      label: 'I may have an actual, potential, or perceived conflict or bias for this case.',
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
              {hasDeclaredConflict && (
                <FormField
                  label="Conflict details"
                  description="Provide the relationship, organization, or circumstance that may create a conflict of interest."
                  errorText={hasDeclaredConflict && !conflictDetailsNormalized && declarationError ? declarationError : undefined}
                >
                  <Textarea
                    value={conflictDeclarationDetails}
                    onChange={({ detail }) => {
                      setConflictDeclarationDetails(detail.value);
                      setDeclarationError(null);
                    }}
                    placeholder="Include names, roles, timelines, and any context needed for triage."
                    rows={4}
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
          This form is used by the ISET admin team to assess the applicant’s needs, eligibility, and funding recommendation. Complete all required sections before submitting. After submission, the final approval fields will become available.
        </Box>
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
        {isEligibilityGateActive && (
          <>
            <Alert
              type="error"
              header="Employment insurance eligibility not checked"
              statusIconAriaLabel="Error"
            >
              Assessment sections are locked until a Program Administrator, Regional Coordinator/Manager, or System Administrator sets ESDC eligibility.
            </Alert>
            <Box margin={{ bottom: 's' }} />
          </>
        )}
        <input
          type="file"
          ref={checklistFileInputRef}
          style={{ display: 'none' }}
          accept=".pdf,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
          onChange={handleChecklistFileSelected}
        />
        <div style={{ visibility: wizardNavPriming ? 'hidden' : 'visible' }} aria-hidden={wizardNavPriming ? 'true' : undefined}>
          <Wizard
            activeStepIndex={activeStepIndex}
            isLoadingNextStep={lockingAssessment || checkingChecklist || eiVerificationUploading || isSubmittingAssessment}
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
            submitButtonText={wizardSubmitHandler ? wizardSubmitLabel : 'Read only'}
            cancelButtonText={canSubmitAssessment ? 'Cancel' : undefined}
            nextButtonText="Next"
            previousButtonText="Previous"
            secondaryActions={null}
          />
        </div>
        {interventionModalContent}
        {interventionDeleteModal}
        {costLineDetailModal}
        {endDateAdjustmentModal}
        {occurrenceChangeModal}
        {checklistUploadModal}
        <Modal
          visible={showCancelModal}
          onDismiss={() => setShowCancelModal(false)}
          header="Discard changes?"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" onClick={confirmCancel}>Discard Changes</Button>
              <Button variant="normal" onClick={() => setShowCancelModal(false)}>Cancel</Button>
            </SpaceBetween>
          }
        >
          <Box>Are you sure you want to discard your changes? This action cannot be undone.</Box>
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
