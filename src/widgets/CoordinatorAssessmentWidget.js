import React, { forwardRef, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiFetch } from '../auth/apiClient';
import useApplicationLock, { buildLockConflictMessage } from '../hooks/useApplicationLock';
import useCurrentUser from '../hooks/useCurrentUser';
import { canCompleteOutcomeReview, getCaseStatusContext, getApplicationStatusContext } from '../utils/rbac';
import { Box, Header, ButtonDropdown, Link, SpaceBetween, Button, Alert, Modal, FormField, Input, Textarea, Checkbox, DatePicker, Select, Grid, ColumnLayout, Table, RadioGroup, Autosuggest, StatusIndicator, Wizard } from '@cloudscape-design/components';
import ApplicationAssessmentHelp, { NwacAssessmentHelp } from '../helpPanelContents/applicationAssessmentHelp';
import { BoardItem } from '@cloudscape-design/board-components';

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

const RECURRING_PERIOD_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi_weekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' }
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
const COMMUNICATION_DOC_TYPES = new Set([
  'assessment_approval_letter',
  'assessment_denial_letter',
  'funding_agreement'
]);
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

const autoOccurrencesFromDates = (startDate, endDate, period) => {
  if (!startDate || !endDate || !period) return null;
  const startUtc = parseIsoDateToUtc(startDate);
  const endUtc = parseIsoDateToUtc(endDate);
  if (startUtc === null || endUtc === null) return null;
  const diffMs = endUtc - startUtc;
  if (diffMs < 0) return null;
  const days = diffMs / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(days)) return null;
  const periodDays = period === 'bi_weekly' ? 14 : period === 'monthly' ? 30 : period === 'quarterly' ? 90 : 7;
  if (!periodDays) return null;
  return Math.max(1, Math.ceil(days / periodDays));
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
    'startDate',
    'endDate',
    'institution',
    'programName',
    'deliveryMode',
    'recommendation',
    'justification',
    'nwacReviewStatus',
    'nwacReview',
    'nwacReason',
    'interventionCode',
    'interventionDuration',
    'interventionCost',
    'costType',
    'recurringPeriod',
    'recurringAmount',
    'recurringOccurrences',
    'interventionPotId',
    'postingContext',
    'interventionNoc',
    'interventionNocVersion',
    'childcareNeed',
    'childcareFunding',
  ].forEach(takeIfNonEmpty);

  if (isEmptyArray(incoming.barriers) && Array.isArray(current?.barriers) && current.barriers.length) {
    next.barriers = current.barriers;
  }
  if (isEmptyArray(incoming.priorities) && Array.isArray(current?.priorities) && current.priorities.length) {
    next.priorities = current.priorities;
  }

  const mergeObj = (key, shape) => {
    const incomingVal = incoming[key] || {};
    const currentVal = current?.[key] || {};
    const merged = { ...shape };
    Object.keys(shape).forEach((field) => {
      const incomingField = incomingVal[field];
      const currentField = currentVal[field];
      merged[field] = isEmptyString(incomingField) && !isEmptyString(currentField) ? currentField : incomingField ?? '';
    });
    next[key] = merged;
  };
  mergeObj('itp', { tuition: '', books: '', materials: '', living: '', childcare: '', otherLabel: '', otherAmount: '', details: '' });
  mergeObj('wage', { wages: '', mercs: '', nonwages: '', other1Label: '', other1Amount: '', other2Label: '', other2Amount: '', subsidyDetails: '' });
  if (!Object.prototype.hasOwnProperty.call(next, 'deliveryMode') || isEmptyString(incoming.deliveryMode)) {
    next.deliveryMode = current?.deliveryMode || 'partner';
  }
  if (!Object.prototype.hasOwnProperty.call(next, 'costType') || isEmptyString(incoming.costType)) {
    next.costType = current?.costType || 'one_time';
  }
  if (!next.itp || typeof next.itp !== 'object') {
    next.itp = { tuition: '', books: '', materials: '', living: '', childcare: '', otherLabel: '', otherAmount: '', details: '' };
  }
  if (!next.wage || typeof next.wage !== 'object') {
    next.wage = { wages: '', mercs: '', nonwages: '', other1Label: '', other1Amount: '', other2Label: '', other2Amount: '', subsidyDetails: '' };
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
  startDate: '',
  endDate: '',
  institution: '',
  programName: '',
  itp: { tuition: '', books: '', materials: '', living: '', childcare: '', otherLabel: '', otherAmount: '', details: '' },
  wage: { wages: '', mercs: '', nonwages: '', other1Label: '', other1Amount: '', other2Label: '', other2Amount: '', subsidyDetails: '' },
  deliveryMode: 'partner',
  recommendation: '',
  justification: '',
  nwacReviewStatus: '',
  nwacReview: '',
  nwacReason: '',
  interventionCode: '',
  interventionDuration: '',
  interventionCost: '',
  costType: 'one_time',
  recurringPeriod: '',
  recurringAmount: '',
  recurringOccurrences: '',
  interventionPotId: '',
  postingContext: '',
  interventionNoc: '',
  interventionNocVersion: '',
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
  const [attemptedSteps, setAttemptedSteps] = useState({});
  const wizardStepRestoreKeyRef = useRef(null);
  const wizardStepRestoreStepsRef = useRef(null);
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
  const isEligibilityAdmin = ['system administrator', 'program administrator', 'regional manager'].includes(normalizedRole);
  const canUploadEiVerification = ['system administrator', 'program administrator', 'regional manager'].includes(normalizedRole);
  const numericInterventionCost = useMemo(() => parseCurrencyToNumber(assessment.interventionCost), [assessment.interventionCost]);
  const isHighCostApprovalBlocked = canonicalRole === 'regional coordinator' && Number.isFinite(numericInterventionCost) && numericInterventionCost >= APPROVAL_COST_THRESHOLD;

  const [interventionCodes, setInterventionCodes] = useState([]);
  const [interventionCodesLoading, setInterventionCodesLoading] = useState(false);
  const [nocVersions, setNocVersions] = useState([]);
  const [nocVersionsLoading, setNocVersionsLoading] = useState(false);
  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);
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
  const requiresNoc = useMemo(() => requiresNocForCode(assessment.interventionCode), [assessment.interventionCode]);
  const isEducationIntervention = useMemo(() => isEducationCode(assessment.interventionCode), [assessment.interventionCode]);
  const isEmployerIntervention = useMemo(() => isEmployerCode(assessment.interventionCode), [assessment.interventionCode]);
  const isWageSubsidyIntervention = useMemo(() => isWageSubsidyCode(assessment.interventionCode), [assessment.interventionCode]);
  const requiresExternalPartner = useMemo(
    () => requiresExternalPartnerForCode(assessment.interventionCode),
    [assessment.interventionCode]
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
  const selectedInterventionCodeOption = useMemo(
    () => interventionCodes.find(option => option.value === assessment.interventionCode) || null,
    [interventionCodes, assessment.interventionCode]
  );
  const selectedNocVersionOption = useMemo(
    () => nocVersions.find(option => option.value === assessment.interventionNocVersion) || null,
    [nocVersions, assessment.interventionNocVersion]
  );
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

  const buildCostSettingsPayload = useCallback(() => {
    const costType = assessment.costType === 'recurring' ? 'recurring' : 'one_time';
    const recurringAmount = parseCurrencyInput(assessment.recurringAmount);
    const recurringOccurrencesRaw = assessment.recurringOccurrences;
    const recurringOccurrencesValue =
      recurringOccurrencesRaw === '' || recurringOccurrencesRaw === null || typeof recurringOccurrencesRaw === 'undefined'
        ? null
        : Number(recurringOccurrencesRaw);
    const recurringOccurrences = Number.isFinite(recurringOccurrencesValue) ? recurringOccurrencesValue : null;
    const calculatedTotal = parseCurrencyInput(assessment.interventionCost);
    const hasRecurrenceData =
      costType === 'recurring' ||
      Boolean(assessment.recurringPeriod) ||
      recurringAmount !== null ||
      recurringOccurrences !== null;
    const hasCostData = calculatedTotal !== null;
    if (!hasRecurrenceData && !hasCostData) return null;
    return {
      type: costType,
      period: costType === 'recurring' ? assessment.recurringPeriod || '' : '',
      amountPerPeriod: costType === 'recurring' ? recurringAmount : null,
      occurrences: costType === 'recurring' ? recurringOccurrences : null,
      calculatedTotal
    };
  }, [assessment]);

  const buildAssessmentPayload = useCallback(() => {
    const costSettingsPayload = buildCostSettingsPayload();
    const payload = {
      assessment_date_of_assessment: formatDate(assessment.dateOfAssessment) || null,
      assessment_employment_goals: assessment.employmentGoals || null,
      assessment_previous_iset: assessment.previousISET || null,
      assessment_previous_iset_details: assessment.previousISETDetails || null,
      assessment_employment_barriers: assessment.barriers || null,
      assessment_employment_barriers_other_details: assessment.barriersOther || null,
      assessment_local_area_priorities: assessment.priorities || null,
      assessment_other_funding_details: assessment.otherFunding || null,
      assessment_esdc_eligibility: assessment.esdcEligibility || null,
      assessment_intervention_start_date: formatDate(assessment.startDate) || null,
      assessment_intervention_end_date: formatDate(assessment.endDate) || null,
      assessment_institution: assessment.institution || null,
      assessment_program_name: assessment.programName || null,
      assessment_itp: assessment.itp || [],
      assessment_wage: assessment.wage || [],
      assessment_recommendation: assessment.recommendation || null,
      assessment_justification: assessment.justification || null,
      assessment_nwac_review: assessment.nwacReview || null,
      assessment_nwac_reason: assessment.nwacReason || null,
      assessment_intervention_code: assessment.interventionCode || null,
      assessment_intervention_duration_days: assessment.interventionDuration || null,
      assessment_intervention_cost_total: (() => {
        const val = parseCurrencyInput(assessment.interventionCost);
        return val !== null ? String(val) : null;
      })(),
      assessment_intervention_pot_id: assessment.interventionPotId || null,
      postingContext: assessment.postingContext || null,
      assessment_intervention_related_noc: assessment.interventionNoc || null,
      assessment_intervention_related_noc_version: assessment.interventionNocVersion || null,
      assessment_childcare_need: assessment.childcareNeed || null,
      assessment_childcare_funding_details: assessment.childcareFunding || null,
      case_summary: assessment.overview || null
    };
    const baseContext = caseData?.caseContext && typeof caseData.caseContext === 'object' ? caseData.caseContext : null;
    const normalizedMode = assessment.deliveryMode === 'in_house' ? 'in_house' : 'partner';
    const includeLetterDrafts = letterDrafts && typeof letterDrafts === 'object';
    if (baseContext || normalizedMode || costSettingsPayload || includeLetterDrafts) {
      payload.caseContext = {
        ...(baseContext || {}),
        assessmentDeliveryMode: normalizedMode,
        assessmentCostSettings: costSettingsPayload,
        ...(includeLetterDrafts ? { decisionLetterDrafts: letterDrafts } : {})
      };
    }
    return payload;
  }, [assessment, buildCostSettingsPayload, caseData?.caseContext, letterDrafts]);
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
  const manualCostValue = useMemo(() => {
    const val = parseCurrencyInput(assessment.interventionCost);
    return val !== null && Number.isFinite(val) ? val : null;
  }, [assessment.interventionCost]);
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
    () => documentChecklistItems.filter(item => {
      const types = Array.isArray(item?.documentTypes) ? item.documentTypes : [];
      return types.some(type => COMMUNICATION_DOC_TYPES.has(type));
    }),
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
  const usesCostTables = isEducationIntervention || isEmployerIntervention;
  const showChildcareFunding = assessment.childcareNeed === 'yes';
  const showEndDate = Boolean(assessment.startDate);
  const dateGridDefinition = useMemo(
    () => showEndDate ? [{ colspan: 6 }, { colspan: 6 }] : [{ colspan: 6 }],
    [showEndDate]
  );
  useEffect(() => {
    if (requiresNoc) return;
    setAssessment(prev => {
      if (!prev.interventionNoc && !prev.interventionNocVersion) return prev;
      return { ...prev, interventionNoc: '', interventionNocVersion: '' };
    });
  }, [requiresNoc]);
  useEffect(() => {
    setAssessment(prev => {
      let changed = false;
      const next = { ...prev };
      if (!isEducationIntervention) {
        if (next.itp?.details) {
          next.itp = { ...next.itp, details: '' };
          changed = true;
        }
      }
      if (!(isEducationIntervention || isEmployerIntervention)) {
        if (next.programName) {
          next.programName = '';
          changed = true;
        }
      }
      if (!isWageSubsidyIntervention && next.wage?.subsidyDetails) {
        next.wage = { ...next.wage, subsidyDetails: '' };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [isEducationIntervention, isEmployerIntervention, isWageSubsidyIntervention]);
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
  useEffect(() => {
    if (!requiresExternalPartner) return;
    setAssessment(prev => {
      if (prev.deliveryMode === 'partner') return prev;
      return { ...prev, deliveryMode: 'partner' };
    });
  }, [requiresExternalPartner]);
  useEffect(() => {
    if (assessment.deliveryMode !== 'in_house') return;
    setAssessment(prev => {
      if (!prev.institution && !prev.wage?.subsidyDetails) return prev;
      return { ...prev, institution: '', wage: { ...prev.wage, subsidyDetails: '' } };
    });
  }, [assessment.deliveryMode]);
  const calculatedFundingTotal = useMemo(() => {
    if (!usesCostTables) return null;
    const itp = assessment.itp || {};
    const wage = assessment.wage || {};
    const itpTotal = isEducationIntervention
      ? parseCurrencyToNumber(itp.tuition) +
        parseCurrencyToNumber(itp.books) +
        parseCurrencyToNumber(itp.materials) +
        parseCurrencyToNumber(itp.living) +
        parseCurrencyToNumber(itp.childcare) +
        parseCurrencyToNumber(itp.otherAmount)
      : 0;
    const wageTotal = isEmployerIntervention
      ? parseCurrencyToNumber(wage.wages) +
        parseCurrencyToNumber(wage.mercs) +
        parseCurrencyToNumber(wage.nonwages) +
        parseCurrencyToNumber(wage.other1Amount) +
        parseCurrencyToNumber(wage.other2Amount)
      : 0;
    const total = itpTotal + wageTotal;
    if (!Number.isFinite(total) || total <= 0) return null;
    return String(Math.round(total));
  }, [assessment.itp, assessment.wage, isEducationIntervention, isEmployerIntervention, usesCostTables]);
  const tableCostValue = useMemo(() => {
    if (!calculatedFundingTotal) return null;
    const val = parseCurrencyInput(calculatedFundingTotal);
    return val !== null && Number.isFinite(val) ? val : null;
  }, [calculatedFundingTotal]);
  const effectiveCostValue = manualCostValue !== null ? manualCostValue : tableCostValue;
  const decisionHasCost = effectiveCostValue !== null && Number.isFinite(effectiveCostValue) && effectiveCostValue > 0;
  const showDecisionBudgetPot = assessment.nwacReviewStatus === 'approve' && decisionHasCost;
  useEffect(() => {
    if (assessment.nwacReviewStatus === 'approve' && decisionHasCost) return;
    setAssessment(prev => {
      if (!prev.interventionPotId && !prev.postingContext) return prev;
      return { ...prev, interventionPotId: '', postingContext: '' };
    });
  }, [assessment.nwacReviewStatus, decisionHasCost]);
  const showRecurrenceGroup = effectiveCostValue !== null && Number.isFinite(effectiveCostValue) && effectiveCostValue > 0;
  const isRecurringCost = assessment.costType === 'recurring';
  const isRecurringSchedule = showRecurrenceGroup && isRecurringCost;
  const selectedRecurrencePeriodOption = useMemo(
    () => RECURRING_PERIOD_OPTIONS.find(option => option.value === assessment.recurringPeriod) || null,
    [assessment.recurringPeriod]
  );
  const recurringAmountValue = parseCurrencyInput(assessment.recurringAmount);
  const recurringOccurrencesValue = (() => {
    const raw = assessment.recurringOccurrences;
    if (raw === '' || raw === null || typeof raw === 'undefined') return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  })();
  const recurringTotal = useMemo(() => {
    if (!isRecurringSchedule) return null;
    if (!Number.isFinite(recurringAmountValue) || !Number.isFinite(recurringOccurrencesValue)) return null;
    const total = recurringAmountValue * recurringOccurrencesValue;
    return Number.isFinite(total) ? total : null;
  }, [isRecurringSchedule, recurringAmountValue, recurringOccurrencesValue]);
  const fetchNocSuggestions = useCallback(
    async (queryText) => {
      if (!requiresNoc || !assessment.interventionNocVersion) {
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
        params.set('version', assessment.interventionNocVersion);
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
    [assessment.interventionNocVersion, requiresNoc]
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
    const contextCostSettings = (() => {
      const raw = caseData?.caseContext?.assessmentCostSettings;
      return raw && typeof raw === 'object' ? raw : null;
    })();
    const contextCostType = contextCostSettings?.type === 'recurring' ? 'recurring' : 'one_time';
    const contextRecurringPeriod = typeof contextCostSettings?.period === 'string' ? contextCostSettings.period : '';
    const contextRecurringAmount =
      contextCostSettings?.amountPerPeriod !== null && typeof contextCostSettings?.amountPerPeriod !== 'undefined'
        ? String(contextCostSettings.amountPerPeriod)
        : '';
    const contextRecurringOccurrences =
      contextCostSettings?.occurrences !== null && typeof contextCostSettings?.occurrences !== 'undefined'
        ? String(contextCostSettings.occurrences)
        : '';

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
      startDate: formatDate(caseData.assessment_intervention_start_date) || '',
      endDate: formatDate(caseData.assessment_intervention_end_date) || '',
      institution: caseData?.assessment_institution || caseData?.institution || '',
      programName: caseData?.assessment_program_name || '',
      deliveryMode: contextDeliveryMode || 'partner',
      itp: parseOrDefault(caseData.assessment_itp, { tuition: '', books: '', materials: '', living: '', childcare: '', otherLabel: '', otherAmount: '', details: '' }),
      wage: parseOrDefault(caseData.assessment_wage, { wages: '', mercs: '', nonwages: '', other1Label: '', other1Amount: '', other2Label: '', other2Amount: '', subsidyDetails: '' }),
      recommendation: caseData.assessment_recommendation || '',
      justification: caseData.assessment_justification || '',
      nwacReview: caseData.assessment_nwac_review || '',
      nwacReviewStatus: derivedOutcomeStatus,
      nwacReason: caseData.assessment_nwac_reason || '',
      interventionCode: caseData.assessment_intervention_code != null ? String(caseData.assessment_intervention_code) : '',
      interventionDuration: caseData.assessment_intervention_duration_days != null ? String(caseData.assessment_intervention_duration_days) : '',
      interventionCost: caseData.assessment_intervention_cost_total != null ? String(caseData.assessment_intervention_cost_total) : '',
      costType: contextCostType,
      recurringPeriod: contextRecurringPeriod,
      recurringAmount: contextRecurringAmount,
      recurringOccurrences: contextRecurringOccurrences,
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
      interventionNoc: caseData.assessment_intervention_related_noc ? String(caseData.assessment_intervention_related_noc).trim() : '',
      interventionNocVersion: caseData.assessment_intervention_related_noc_version ? String(caseData.assessment_intervention_related_noc_version).trim() : '',
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
    const merged = mergeAssessmentState(assessment, mergedIncoming);
    const mergedWithLimits = {
      ...merged,
      overview: limitWords(merged.overview, OVERVIEW_WORD_LIMIT),
      employmentGoals: limitWords(merged.employmentGoals, EMPLOYMENT_GOALS_WORD_LIMIT)
    };
    setAssessment(mergedWithLimits);
    setInitialAssessment(mergedWithLimits);
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

  useEffect(() => {
    if (!isRecurringSchedule || isAssessmentDisabled) return;
    if (!assessment.startDate || !assessment.endDate || !assessment.recurringPeriod) return;
    const nextOccurrences = autoOccurrencesFromDates(assessment.startDate, assessment.endDate, assessment.recurringPeriod);
    if (nextOccurrences === null) return;
    if (String(nextOccurrences) === String(assessment.recurringOccurrences || '')) return;
    setAssessment(prev => ({ ...prev, recurringOccurrences: String(nextOccurrences) }));
  }, [
    assessment.endDate,
    assessment.recurringOccurrences,
    assessment.recurringPeriod,
    assessment.startDate,
    isAssessmentDisabled,
    isRecurringSchedule
  ]);

  useEffect(() => {
    if (!isRecurringSchedule || isAssessmentDisabled) return;
    if (recurringTotal === null || !Number.isFinite(recurringTotal) || recurringTotal <= 0) return;
    const formatted = formatCurrencyDisplay(recurringTotal);
    setAssessment(prev => (prev.interventionCost === formatted ? prev : { ...prev, interventionCost: formatted }));
  }, [isAssessmentDisabled, isRecurringSchedule, recurringTotal]);

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
      const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
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
  }, [applicantUserId, applicationId]);

  useEffect(() => {
    if (!['docs', 'communication'].includes(currentStep)) return;
    loadDocumentChecklist();
  }, [currentStep, loadDocumentChecklist]);

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
          setChecklistUploadError('EI verification uploads are restricted to admins and regional managers.');
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
    if (decisionHasCost) {
      loadBudgetPots();
    } else {
      setBudgetPotOptions([]);
    }

    return () => {
      cancelled = true;
    };
  }, [assessment.esdcEligibility, normalizedProvince, decisionHasCost, assessment.interventionPotId, deriveFundingStreamFromEligibility]);

  useEffect(() => {
    setNocSuggestions([]);
  }, [assessment.interventionNocVersion]);

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
  // Enhanced handleField to clear error for the field if value is now valid
  const handleField = (field, value) => {
    setAssessment(prevAssessment => {
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
      if (field === 'interventionCode' && !requiresNocForCode(value)) {
        nextAssessment.interventionNoc = '';
        nextAssessment.interventionNocVersion = '';
      }
      if (field === 'interventionCode') {
        const educationCode = isEducationCode(value);
        const employerCode = isEmployerCode(value);
        nextAssessment.deliveryMode = 'partner';
        nextAssessment.institution = '';
        nextAssessment.programName = educationCode || employerCode ? nextAssessment.programName : '';
        nextAssessment.itp = { ...nextAssessment.itp, details: educationCode ? nextAssessment.itp?.details || '' : '' };
        nextAssessment.wage = { ...nextAssessment.wage, subsidyDetails: '' };
      }
      if (field === 'costType') {
        if (value === 'one_time') {
          nextAssessment.recurringPeriod = '';
          nextAssessment.recurringAmount = '';
          nextAssessment.recurringOccurrences = '';
        } else if (value === 'recurring' && !nextAssessment.recurringPeriod) {
          nextAssessment.recurringPeriod = 'weekly';
        }
      }
      if (field === 'deliveryMode' && value === 'in_house') {
        nextAssessment.institution = '';
        nextAssessment.wage = { ...nextAssessment.wage, subsidyDetails: '' };
      }
      if (field === 'startDate' && !value) {
        nextAssessment.endDate = '';
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
      if (hasSubmitted || hasAttemptedSteps) {
        setFieldErrors(validateAssessment(nextAssessment));
      }
      return nextAssessment;
    });
  };
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
  const validateAssessment = (assessment) => {
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
    // 5. Start Date (no longer mandatory)
    // 6. End Date (no longer mandatory)
    const startUtc = parseIsoDateToUtc(assessment.startDate);
    const endUtc = parseIsoDateToUtc(assessment.endDate);
    if (startUtc !== null && endUtc !== null && endUtc < startUtc) {
      errors.endDate = 'End date cannot be before start date.';
    }
    // 7. Institution (no longer mandatory)
    // 8. Program Name (no longer mandatory)
    // 9. ITP/Wage: validation removed, no funding required
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
    // 14. Intervention code required
    if (!assessment.interventionCode) {
      errors.interventionCode = 'Select an intervention code.';
    }
    const requiresNocCode = requiresNocForCode(assessment.interventionCode);
    if (requiresNocCode) {
      if (!assessment.interventionNocVersion) {
        errors.interventionNocVersion = 'Select a NOC version for this intervention code.';
      }
      if (!assessment.interventionNoc) {
        errors.interventionNoc = 'Select a NOC code for this intervention.';
      }
    }
    const educationCode = isEducationCode(assessment.interventionCode);
    const employerCode = isEmployerCode(assessment.interventionCode);
    const wageSubsidyCode = isWageSubsidyCode(assessment.interventionCode);
    if (educationCode) {
      if (!assessment.institution || !assessment.institution.trim()) {
        errors.institution = 'Training institution is required for this intervention code.';
      }
      if (!assessment.itp?.details || !assessment.itp.details.trim()) {
        errors.itpDetails = 'ITP details are required for this intervention code.';
      }
    }
    if (employerCode) {
      if (!assessment.institution || !assessment.institution.trim()) {
        errors.institution = 'Employer / delivery partner is required for this intervention code.';
      }
      if (wageSubsidyCode && (!assessment.wage?.subsidyDetails || !assessment.wage.subsidyDetails.trim())) {
        errors.wageSubsidyDetails = 'Wage subsidy details are required for this intervention code.';
      }
    }
    if (!educationCode && !employerCode && assessment.deliveryMode !== 'in_house') {
      if (!assessment.institution || !assessment.institution.trim()) {
        errors.institution = 'Delivery partner / provider is required when using external delivery.';
      }
    }
    // 15. Optional numeric fields
    let parsedInterventionCost = null;
    if (assessment.interventionCost && String(assessment.interventionCost).trim() !== '') {
      parsedInterventionCost = parseCurrencyInput(assessment.interventionCost);
      if (parsedInterventionCost === null || !Number.isFinite(parsedInterventionCost) || parsedInterventionCost < 0) {
        errors.interventionCost = 'Enter a valid amount in dollars.';
      }
    }
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
  };
  const runDocumentChecklist = useCallback(
    async (onContinue, { allowBypass = true } = {}) => {
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
        const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : '';
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

    const checklistOk = await runDocumentChecklist(submitAssessment, { allowBypass: false });
    if (!checklistOk) return;
    await submitAssessment();
  };

  // Enhanced handleItp and handleWage to clear funding error if valid
  const handleItp = (field, value) => {
    setAssessment(prev => {
      const next = { ...prev, itp: { ...prev.itp, [field]: value } };
      if (hasSubmitted || hasAttemptedSteps) {
        setFieldErrors(validateAssessment(next));
      }
      return next;
    });
  };
  const handleWage = (field, value) => {
    setAssessment(prev => {
      const next = { ...prev, wage: { ...prev.wage, [field]: value } };
      if (hasSubmitted || hasAttemptedSteps) {
        setFieldErrors(validateAssessment(next));
      }
      return next;
    });
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
      const itp = assessment.itp || {};
      const wage = assessment.wage || {};
      const fundingBreakdown = {
        tuition: toAmount(itp.tuition),
        books: toAmount(itp.books),
        materials: toAmount(itp.materials),
        living: toAmount(itp.living),
        childcare: toAmount(itp.childcare),
        other_label: itp.otherLabel || null,
        other_amount: toAmount(itp.otherAmount),
        wage_subsidy: toAmount(wage.wages),
        wage_mercs: toAmount(wage.mercs),
        wage_non_wages: toAmount(wage.nonwages),
        wage_other_1_label: wage.other1Label || null,
        wage_other_1_amount: toAmount(wage.other1Amount),
        wage_other_2_label: wage.other2Label || null,
        wage_other_2_amount: toAmount(wage.other2Amount)
      };
      const totalFunding = Number.isFinite(numericInterventionCost) && numericInterventionCost > 0
        ? numericInterventionCost
        : null;
      const recurringDetails = assessment.costType === 'recurring'
        ? {
          period: assessment.recurringPeriod || null,
          amount: toAmount(assessment.recurringAmount),
          occurrences: assessment.recurringOccurrences ? Number(assessment.recurringOccurrences) : null
        }
        : null;
      const decisionLabel = activeLetterKey === 'approval' ? 'Approval' : 'Denial';
      const reasonSeed = activeLetterKey === 'approval' ? assessment.justification : assessment.nwacReason;
      const contextPayload = {
        decision: decisionLabel,
        applicant_name: applicantName || null,
        tracking_id: trackingReference || null,
        case_number: caseData?.case_number || null,
        assessment_summary: assessment.overview || null,
        employment_goals: assessment.employmentGoals || null,
        program_name: assessment.programName || null,
        institution: assessment.institution || null,
        intervention_type_label: selectedInterventionCodeOption?.label || null,
        intervention_code: assessment.interventionCode || null,
        delivery_mode: assessment.deliveryMode || null,
        intervention_start_date: assessment.startDate || null,
        intervention_end_date: assessment.endDate || null,
        intervention_cost_total: totalFunding || assessment.interventionCost || null,
        recurring_details: recurringDetails,
        funding_breakdown: fundingBreakdown,
        decision_reason_seed: reasonSeed || null
      };
      const prompt = `Draft a concise ${decisionLabel.toLowerCase()} letter for the NWAC ISET program. Return JSON only with keys: letter_title, decision_intro, decision_label, decision_reason, next_step_1, next_step_2. Keep each field brief and professional. If funding amounts or dates are provided, mention them clearly in the decision_reason or next steps. Use the context below and omit unknown details.\n\nContext:\n${JSON.stringify(contextPayload, null, 2)}`;
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
      setLetterDrafts(prev => {
        const current = prev?.[activeLetterKey] || buildEmptyDecisionLetterDraft();
        const nextSteps = Array.isArray(parsed.next_steps || parsed.nextSteps) ? (parsed.next_steps || parsed.nextSteps) : [];
        return {
          ...prev,
          [activeLetterKey]: {
            ...current,
            letter_title: parsed.letter_title || current.letter_title,
            decision_intro: parsed.decision_intro || current.decision_intro,
            decision_label: parsed.decision_label || current.decision_label,
            decision_reason: parsed.decision_reason || current.decision_reason,
            next_step_1: parsed.next_step_1 || nextSteps[0] || current.next_step_1,
            next_step_2: parsed.next_step_2 || nextSteps[1] || current.next_step_2
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
      if (stepId === 'eligibility') {
        return !errors.esdcEligibility;
      }
      if (stepId === 'framing') {
        return !errors.interventionCode && !errors.startDate && !errors.endDate;
      }
      if (stepId === 'rationale') {
        return !errors.overview && !errors.employmentGoals;
      }
      if (stepId === 'type') {
        return !errors.interventionNocVersion && !errors.interventionNoc && !errors.institution && !errors.itpDetails && !errors.wageSubsidyDetails;
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
        return !errors.interventionDuration && !errors.interventionCost && !errors.interventionPotId && !errors.postingContext;
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
    if (assessment.interventionCost && String(assessment.interventionCost).trim() !== '') {
      const parsedCost = parseCurrencyInput(assessment.interventionCost);
      if (parsedCost === null || !Number.isFinite(parsedCost) || parsedCost < 0) {
        errors.interventionCost = 'Enter a valid amount in dollars.';
      }
    }
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
    if (assessment.interventionCost && String(assessment.interventionCost).trim() !== '') {
      const parsedCost = parseCurrencyInput(assessment.interventionCost);
      if (parsedCost === null || !Number.isFinite(parsedCost) || parsedCost < 0) {
        errors.interventionCost = 'Enter a valid amount in dollars.';
      }
    }
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
    const costSettingsPayload = buildCostSettingsPayload();
    const payload = {
      assessment_date_of_assessment: formatDate(assessment.dateOfAssessment) || null,
      assessment_employment_goals: assessment.employmentGoals || null,
      assessment_previous_iset: assessment.previousISET || null,
      assessment_previous_iset_details: assessment.previousISETDetails || null,
      assessment_employment_barriers: assessment.barriers || null,
      assessment_employment_barriers_other_details: assessment.barriersOther || null,
      assessment_local_area_priorities: assessment.priorities || null,
      assessment_other_funding_details: assessment.otherFunding || null,
      assessment_esdc_eligibility: assessment.esdcEligibility || null,
      assessment_intervention_start_date: formatDate(assessment.startDate) || null,
      assessment_intervention_end_date: formatDate(assessment.endDate) || null,
      assessment_institution: assessment.institution || null,
      assessment_program_name: assessment.programName || null,
      assessment_itp: assessment.itp || [],
      assessment_wage: assessment.wage || [],
      assessment_recommendation: assessment.recommendation || null,
      assessment_justification: assessment.justification || null,
      assessment_nwac_review: assessment.nwacReview || null,
      assessment_nwac_reason: assessment.nwacReason || null,
      assessment_intervention_code: assessment.interventionCode || null,
      assessment_intervention_duration_days: assessment.interventionDuration || null,
      assessment_intervention_cost_total: (() => {
        const val = parseCurrencyInput(assessment.interventionCost);
        return val !== null ? String(val) : null;
      })(),
      assessment_intervention_pot_id: assessment.interventionPotId || null,
      postingContext: assessment.postingContext || null,
      assessment_intervention_related_noc: assessment.interventionNoc || null,
      assessment_intervention_related_noc_version: assessment.interventionNocVersion || null,
      assessment_childcare_need: assessment.childcareNeed || null,
      assessment_childcare_funding_details: assessment.childcareFunding || null,
      case_summary: assessment.overview || null,
      assessment_submit_action: true,
      assessment_nwac_review_status: decision || null,
      status: isOutcomeApproved ? 'initiated' : NOT_APPROVED_CASE_STATUS,
      applicationStatus: isOutcomePushBack ? 'in_review' : DECISION_READY_STATUS
    };
    const baseContext = caseData?.caseContext && typeof caseData.caseContext === 'object' ? caseData.caseContext : null;
    const normalizedMode = assessment.deliveryMode === 'in_house' ? 'in_house' : 'partner';
    if (baseContext || normalizedMode || costSettingsPayload) {
      payload.caseContext = {
        ...(baseContext || {}),
        assessmentDeliveryMode: normalizedMode,
        assessmentCostSettings: costSettingsPayload
      };
    }
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
      setValidationAlert([`Regional Coordinators cannot approve applications with total cost \u2265 $${APPROVAL_COST_THRESHOLD.toLocaleString()}. Escalate to NWAC Administrators.`]);
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
    const checklistOk = await runDocumentChecklist(null, { allowBypass: false });
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
          const uploadOk = await uploadEiVerificationIfSelected();
          if (!uploadOk) {
            return;
          }
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
              disabled={isAssessmentDisabled}
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
                disabled={isAssessmentDisabled}
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
            disabled={isEligibilityDisabled}
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
      <Grid gridDefinition={[{ colspan: 6 }]}>
        <FormField
          label="Intervention Code"
          description="Select the intervention type recommended for this client."
          errorText={showFramingErrors && fieldErrors.interventionCode ? fieldErrors.interventionCode : undefined}
        >
          <Select
            selectedOption={selectedInterventionCodeOption}
            onChange={({ detail }) => handleField('interventionCode', detail.selectedOption?.value || '')}
            options={interventionCodes}
            placeholder={interventionCodesLoading ? 'Loading intervention codes...' : 'Select intervention code'}
            statusType={interventionCodesLoading ? 'loading' : 'finished'}
            filteringType="auto"
            data-error-focus={showFramingErrors && fieldErrors.interventionCode ? 'true' : undefined}
            disabled={isAssessmentDisabled}
          />
        </FormField>
      </Grid>
      <Grid gridDefinition={dateGridDefinition}>
        <FormField
          label="Start Date"
          errorText={showFramingErrors && fieldErrors.startDate ? fieldErrors.startDate : undefined}
          description="Enter the planned start date for the intervention or training."
        >
          <DatePicker
            onChange={({ detail }) => handleField('startDate', detail.value)}
            value={assessment.startDate}
            ariaLabel="Start Date"
            data-error-focus={showFramingErrors && fieldErrors.startDate ? 'true' : undefined}
            tabIndex={-1}
            readOnly={isAssessmentDisabled}
            disabled={isAssessmentDisabled}
          />
        </FormField>
        {showEndDate && (
          <FormField
            label="End Date"
            errorText={showFramingErrors && fieldErrors.endDate ? fieldErrors.endDate : undefined}
            description="Enter the planned end date for the intervention or training."
          >
            <DatePicker
              onChange={({ detail }) => handleField('endDate', detail.value)}
              value={assessment.endDate}
              ariaLabel="End Date"
              data-error-focus={showFramingErrors && fieldErrors.endDate ? 'true' : undefined}
              tabIndex={-1}
              readOnly={isAssessmentDisabled || !assessment.startDate}
              disabled={isAssessmentDisabled || !assessment.startDate}
              placeholder={assessment.startDate ? undefined : 'Set a start date first'}
            />
          </FormField>
        )}
      </Grid>
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
              disabled={isAssessmentDisabled}
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
              disabled={isAssessmentDisabled}
            />
          </Box>
        </FormField>
      </Grid>
    </SpaceBetween>
  );

  const typeStepContent = (
    <SpaceBetween size="l">
      {!requiresExternalPartner && (
        <FormField
          label="Delivery mode"
          description="Choose how this will run. Training codes need an education provider; employer codes need a host/employer with NOC details."
        >
          <Select
            selectedOption={
              assessment.deliveryMode !== 'in_house'
                ? { value: 'partner', label: 'External delivery partner' }
                : { value: 'in_house', label: 'In-house (no external partner)' }
            }
            onChange={({ detail }) => handleField('deliveryMode', detail.selectedOption?.value || 'partner')}
            options={[
              { value: 'partner', label: 'External delivery partner' },
              { value: 'in_house', label: 'In-house (no external partner)' }
            ]}
            disabled={isAssessmentDisabled}
          />
        </FormField>
      )}

      {isEducationIntervention && (
        <SpaceBetween size="s">
          <ColumnLayout columns={2} variant="text-grid">
            <FormField
              label="Institution"
              description="Training provider or school delivering the program."
              errorText={showTypeErrors && fieldErrors.institution ? fieldErrors.institution : undefined}
            >
              <Input
                value={assessment.institution}
                onChange={({ detail }) => handleField('institution', detail.value)}
                data-error-focus={showTypeErrors && fieldErrors.institution ? 'true' : undefined}
                disabled={isAssessmentDisabled}
              />
            </FormField>
            <FormField
              label="Program name (optional)"
              description="Course, credential, or stream name."
            >
              <Input
                value={assessment.programName}
                onChange={({ detail }) => handleField('programName', detail.value)}
                disabled={isAssessmentDisabled}
              />
            </FormField>
          </ColumnLayout>
          <FormField
            label="In-Training Plan (ITP) details"
            description="Outline curriculum, milestones, supports, materials, and how this leads to the employment goal."
            errorText={showTypeErrors && fieldErrors.itpDetails ? fieldErrors.itpDetails : undefined}
          >
            <Textarea
              value={assessment.itp?.details || ''}
              rows={3}
              onChange={({ detail }) => handleItp('details', detail.value)}
              placeholder="Summarize training plan, key milestones, supports, or materials."
              data-error-focus={showTypeErrors && fieldErrors.itpDetails ? 'true' : undefined}
              disabled={isAssessmentDisabled}
            />
          </FormField>
        </SpaceBetween>
      )}

      {isEmployerIntervention && (
        <SpaceBetween size="s">
          <ColumnLayout columns={2} variant="text-grid">
            <FormField
              label="Employer / delivery partner"
              description="Employer or host organization providing the placement."
              errorText={showTypeErrors && fieldErrors.institution ? fieldErrors.institution : undefined}
            >
              <Input
                value={assessment.institution}
                onChange={({ detail }) => handleField('institution', detail.value)}
                data-error-focus={showTypeErrors && fieldErrors.institution ? 'true' : undefined}
                disabled={isAssessmentDisabled}
              />
            </FormField>
            <FormField
              label="Program name (optional)"
              description="Job title, role, or program name if defined by the employer."
            >
              <Input
                value={assessment.programName}
                onChange={({ detail }) => handleField('programName', detail.value)}
                disabled={isAssessmentDisabled}
              />
            </FormField>
          </ColumnLayout>
          <ColumnLayout columns={2} variant="text-grid">
            <FormField
              label="NOC version"
              description="Select the NOC version used for this job/placement."
              errorText={showTypeErrors && fieldErrors.interventionNocVersion ? fieldErrors.interventionNocVersion : undefined}
            >
              <Select
                selectedOption={selectedNocVersionOption}
                onChange={({ detail }) => handleField('interventionNocVersion', detail.selectedOption?.value || '')}
                options={nocVersions}
                placeholder={nocVersionsLoading ? 'Loading NOC versions...' : 'Select NOC version'}
                statusType={nocVersionsLoading ? 'loading' : 'finished'}
                filteringType="auto"
                data-error-focus={showTypeErrors && fieldErrors.interventionNocVersion ? 'true' : undefined}
                disabled={isAssessmentDisabled || nocVersionsLoading}
              />
            </FormField>
            <FormField
              label="NOC code"
              description="Search by code or title; aligns to the job/placement."
              errorText={showTypeErrors && fieldErrors.interventionNoc ? fieldErrors.interventionNoc : undefined}
            >
              <Autosuggest
                value={assessment.interventionNoc || ''}
                onChange={({ detail }) => {
                  const inputValue = detail.value || '';
                  handleField('interventionNoc', inputValue);
                  if (inputValue.length >= 2) {
                    fetchNocSuggestions(inputValue);
                  } else {
                    setNocSuggestions([]);
                  }
                }}
                onSelect={({ detail }) => handleField('interventionNoc', detail.value || '')}
                onLoadItems={({ detail }) => {
                  if (detail.filteringText) {
                    fetchNocSuggestions(detail.filteringText);
                  }
                }}
                options={nocSuggestions}
                statusType={nocSuggestionsLoading ? 'loading' : 'finished'}
                expandToViewport
                placeholder={
                  assessment.interventionNocVersion
                    ? 'Type to search NOC code'
                    : 'Select a NOC version first'
                }
                empty="No NOC codes found."
                disabled={isAssessmentDisabled || !assessment.interventionNocVersion}
                enteredTextLabel={value => `Use "${value}"`}
                data-error-focus={showTypeErrors && fieldErrors.interventionNoc ? 'true' : undefined}
              />
            </FormField>
          </ColumnLayout>
          {isWageSubsidyIntervention && (
            <FormField
              label="Wage subsidy details"
              errorText={showTypeErrors && fieldErrors.wageSubsidyDetails ? fieldErrors.wageSubsidyDetails : undefined}
            >
              <Textarea
                value={assessment.wage?.subsidyDetails || ''}
                rows={3}
                onChange={({ detail }) => handleWage('subsidyDetails', detail.value)}
                placeholder="Employer, wage subsidy amount/percentage, duration, expectations."
                data-error-focus={showTypeErrors && fieldErrors.wageSubsidyDetails ? 'true' : undefined}
                disabled={isAssessmentDisabled}
              />
            </FormField>
          )}
        </SpaceBetween>
      )}

      {!isEducationIntervention && !isEmployerIntervention && (
        assessment.deliveryMode === 'partner' ? (
          <FormField
            label="Delivery partner / provider"
            errorText={showTypeErrors && fieldErrors.institution ? fieldErrors.institution : undefined}
          >
            <Input
              value={assessment.institution}
              onChange={({ detail }) => handleField('institution', detail.value)}
              placeholder="Training institution, employer, or provider"
              data-error-focus={showTypeErrors && fieldErrors.institution ? 'true' : undefined}
              disabled={isAssessmentDisabled}
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

  const childcareStepContent = (
    <SpaceBetween size="l">
      <Grid gridDefinition={[{ colspan: 6 }]}>
        <FormField label="Childcare Need" description="Indicate if childcare is required to participate in the intervention.">
          <Select
            selectedOption={selectedChildcareOption}
            onChange={({ detail }) => handleField('childcareNeed', detail.selectedOption?.value || '')}
            options={CHILDCARE_OPTIONS}
            placeholder="Select childcare need"
            disabled={isAssessmentDisabled}
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
              disabled={isAssessmentDisabled || assessment.childcareNeed !== 'yes'}
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
            disabled={isAssessmentDisabled}
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
              disabled={isAssessmentDisabled}
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
                disabled={isAssessmentDisabled}
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
            disabled={isAssessmentDisabled}
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
              disabled={isAssessmentDisabled}
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
            disabled={isAssessmentDisabled}
          />
        </FormField>
      </Grid>
    </SpaceBetween>
  );

  const interventionCostLabel = usesCostTables ? 'Intervention Cost (total)' : 'Planned cost';
  const interventionCostDescription = isRecurringSchedule
    ? 'Calculated from the recurring schedule below.'
    : usesCostTables
      ? calculatedFundingTotal
        ? `Optional. Auto-calculated from funding tables: $${calculatedFundingTotal}. Adjust if needed.`
        : 'Optional. Enter the total planned cost (whole dollars).'
      : `Enter the total cost for this intervention${selectedInterventionCodeOption?.label ? ` (${selectedInterventionCodeOption.label})` : ''}. Leave this blank if the intervention has no cost.`;
  const interventionCostPlaceholder = usesCostTables ? 'e.g. $4,200.00' : '$0.00';
  const displayInterventionCost = isRecurringSchedule && recurringTotal
    ? formatCurrencyDisplay(recurringTotal)
    : assessment.interventionCost;
  const costSummaryGridDefinition = [{ colspan: 12 }];

  const costStepContent = (
    <SpaceBetween size="l">
      {isEducationIntervention && (
        <>
          <Box margin={{ top: 's' }}>
            <Header variant="h3">Individual Training Purchase (ITP)</Header>
          </Box>
          <Table
            stripedRows
            columnDefinitions={[
              { id: 'category', header: 'Funding Category', cell: item => item.label },
              { id: 'requested', header: 'Funding Requested', cell: item => (
                (() => {
                  const amountKey = item.amountKey || item.key;
                  const amountValue = assessment.itp?.[amountKey] || '';
                  const amountInput = (
                    <Input
                      type="text"
                      value={amountValue}
                      onChange={({ detail }) => {
                        const raw = detail.value.replace(/[^\d.]/g, '');
                        handleItp(amountKey, raw);
                      }}
                      onBlur={() => {
                        const raw = assessment.itp?.[amountKey] || '';
                        const num = raw ? parseFloat(raw) : '';
                        const formatted = num !== '' && !isNaN(num) ? `$ ${num.toFixed(2)}` : '';
                        handleItp(amountKey, formatted);
                      }}
                      ariaLabel={item.label}
                      readOnly={isAssessmentDisabled}
                      disabled={isAssessmentDisabled}
                    />
                  );
                  if (!item.labelKey) return amountInput;
                  return (
                    <SpaceBetween size="xs">
                      <Input
                        value={assessment.itp?.[item.labelKey] || ''}
                        onChange={({ detail }) => handleItp(item.labelKey, detail.value)}
                        placeholder="Describe..."
                        ariaLabel={`${item.label} description`}
                        readOnly={isAssessmentDisabled}
                        disabled={isAssessmentDisabled}
                      />
                      {amountInput}
                    </SpaceBetween>
                  );
                })()
              ) },
              { id: 'actions', header: 'Actions', cell: item => (
                isAssessmentDisabled ? null : (
                  <Button
                    size="small"
                    variant="inline-link"
                    onClick={() => {
                      const amountKey = item.amountKey || item.key;
                      if (item.labelKey) handleItp(item.labelKey, '');
                      handleItp(amountKey, '');
                    }}
                  >
                    Clear
                  </Button>
                )
              ) }
            ]}
            items={[
              { key: 'tuition', label: 'Tuition' },
              { key: 'books', label: 'Books' },
              { key: 'materials', label: 'Materials' },
              { key: 'living', label: 'Living Allowance' },
              { key: 'childcare', label: 'Childcare' },
              { label: 'Other (specify)', labelKey: 'otherLabel', amountKey: 'otherAmount' }
            ]}
            variant="embedded"
            header={null}
            footer={
              <>
                <Box fontWeight="bold" textAlign="right">
                  Total Intervention Cost: $
                  {(
                    Number((assessment.itp?.tuition || '').replace(/[^\d.]/g, '')) +
                    Number((assessment.itp?.books || '').replace(/[^\d.]/g, '')) +
                    Number((assessment.itp?.materials || '').replace(/[^\d.]/g, '')) +
                    Number((assessment.itp?.living || '').replace(/[^\d.]/g, '')) +
                    Number((assessment.itp?.childcare || '').replace(/[^\d.]/g, '')) +
                    Number((assessment.itp?.otherAmount || '').replace(/[^\d.]/g, ''))
                  ).toFixed(2)}
                </Box>
              </>
            }
          />
        </>
      )}
      {isEmployerIntervention && (
        <>
          <Box margin={{ top: 'l', bottom: 's' }}>
            <Header variant="h3">Targeted Wage Subsidy / Job Creation Partnership</Header>
          </Box>
          <Table
            stripedRows
            columnDefinitions={[
              { id: 'category', header: 'Funding Category', cell: item => item.label },
              { id: 'requested', header: 'Funding Requested', cell: item => (
                (() => {
                  const amountKey = item.amountKey || item.key;
                  const amountValue = assessment.wage?.[amountKey] || '';
                  const amountInput = (
                    <Input
                      type="text"
                      value={amountValue}
                      onChange={({ detail }) => {
                        const raw = detail.value.replace(/[^\d.]/g, '');
                        handleWage(amountKey, raw);
                      }}
                      onBlur={() => {
                        const raw = assessment.wage?.[amountKey] || '';
                        const num = raw ? parseFloat(raw) : '';
                        const formatted = num !== '' && !isNaN(num) ? `$ ${num.toFixed(2)}` : '';
                        handleWage(amountKey, formatted);
                      }}
                      ariaLabel={item.label}
                      readOnly={isAssessmentDisabled}
                      disabled={isAssessmentDisabled}
                    />
                  );
                  if (!item.labelKey) return amountInput;
                  return (
                    <SpaceBetween size="xs">
                      <Input
                        value={assessment.wage?.[item.labelKey] || ''}
                        onChange={({ detail }) => handleWage(item.labelKey, detail.value)}
                        placeholder="Describe..."
                        ariaLabel={`${item.label} description`}
                        readOnly={isAssessmentDisabled}
                        disabled={isAssessmentDisabled}
                      />
                      {amountInput}
                    </SpaceBetween>
                  );
                })()
              ) },
              { id: 'actions', header: 'Actions', cell: item => (
                isAssessmentDisabled ? null : (
                  <Button
                    size="small"
                    variant="inline-link"
                    onClick={() => {
                      const amountKey = item.amountKey || item.key;
                      if (item.labelKey) handleWage(item.labelKey, '');
                      handleWage(amountKey, '');
                    }}
                  >
                    Clear
                  </Button>
                )
              ) }
            ]}
            items={[
              { key: 'wages', label: 'Wages' },
              { key: 'mercs', label: 'MERCs' },
              { key: 'nonwages', label: 'Non-Wages' },
              { label: 'Other (specify)', labelKey: 'other1Label', amountKey: 'other1Amount' },
              { label: 'Other (specify)', labelKey: 'other2Label', amountKey: 'other2Amount' }
            ]}
            variant="embedded"
            header={null}
            footer={
              <>
                <Box fontWeight="bold" textAlign="right">
                  Total Intervention Cost: $
                  {(
                    Number((assessment.wage?.wages || '').replace(/[^\d.]/g, '')) +
                    Number((assessment.wage?.mercs || '').replace(/[^\d.]/g, '')) +
                    Number((assessment.wage?.nonwages || '').replace(/[^\d.]/g, '')) +
                    Number((assessment.wage?.other1Amount || '').replace(/[^\d.]/g, '')) +
                    Number((assessment.wage?.other2Amount || '').replace(/[^\d.]/g, ''))
                  ).toFixed(2)}
                </Box>
              </>
            }
          />
        </>
      )}
      {!isRecurringSchedule && (
        <>
          <Grid gridDefinition={costSummaryGridDefinition}>
            <FormField
              label={interventionCostLabel}
              description={interventionCostDescription}
              errorText={showCostErrors && fieldErrors.interventionCost ? fieldErrors.interventionCost : undefined}
              secondaryControl={
                !isAssessmentDisabled && calculatedFundingTotal && assessment.interventionCost !== calculatedFundingTotal ? (
                  <Button size="small" onClick={() => handleField('interventionCost', formatCurrencyDisplay(calculatedFundingTotal))}>
                    Use {formatCurrencyDisplay(calculatedFundingTotal) || calculatedFundingTotal}
                  </Button>
                ) : null
              }
            >
              <Input
                inputMode="decimal"
                value={displayInterventionCost || ''}
                onChange={({ detail }) => handleField('interventionCost', detail.value.replace(/[^\d.]/g, ''))}
                onBlur={() => {
                  const formatted = formatCurrencyDisplay(assessment.interventionCost);
                  if (formatted) {
                    handleField('interventionCost', formatted);
                  }
                }}
                placeholder={interventionCostPlaceholder}
                data-error-focus={showCostErrors && fieldErrors.interventionCost ? 'true' : undefined}
                disabled={isAssessmentDisabled}
              />
            </FormField>
          </Grid>
        </>
      )}
      {showRecurrenceGroup && (
        <>
          <FormField label="Cost type">
            <RadioGroup
              onChange={({ detail }) => handleField('costType', detail.value)}
              value={assessment.costType || 'one_time'}
              items={[
                { value: 'one_time', label: 'One-time total' },
                { value: 'recurring', label: 'Recurring schedule' }
              ]}
              disabled={isAssessmentDisabled}
            />
          </FormField>
          {isRecurringSchedule && (
            <>
              <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                <FormField label="Recurrence period">
                  <Select
                    selectedOption={selectedRecurrencePeriodOption}
                    onChange={({ detail }) => handleField('recurringPeriod', detail.selectedOption?.value || '')}
                    options={RECURRING_PERIOD_OPTIONS}
                    placeholder="Select recurrence period"
                    disabled={isAssessmentDisabled}
                  />
                </FormField>
                <FormField label="Amount per period">
                  <Input
                    value={assessment.recurringAmount || ''}
                    onChange={({ detail }) => handleField('recurringAmount', detail.value.replace(/[^\d.]/g, ''))}
                    onBlur={() => {
                      const formatted = formatCurrencyDisplay(assessment.recurringAmount);
                      if (formatted) {
                        handleField('recurringAmount', formatted);
                      }
                    }}
                    inputMode="decimal"
                    placeholder="e.g. 150.00"
                    readOnly={isAssessmentDisabled}
                    disabled={isAssessmentDisabled}
                  />
                </FormField>
              </Grid>
              <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                <FormField
                  label="Number of occurrences"
                  description="Auto-calculated from dates and recurrence."
                >
                  <Input
                    value={assessment.recurringOccurrences || ''}
                    readOnly
                    disabled
                  />
                </FormField>
                <FormField
                  label={interventionCostLabel}
                  description="Calculated total based on recurring schedule."
                  errorText={showCostErrors && fieldErrors.interventionCost ? fieldErrors.interventionCost : undefined}
                >
                  <Input
                    value={displayInterventionCost || ''}
                    data-error-focus={showCostErrors && fieldErrors.interventionCost ? 'true' : undefined}
                    readOnly
                    disabled
                  />
                </FormField>
              </Grid>
            </>
          )}
        </>
      )}
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
                <Input
                  value={activeLetterDraft.next_step_1 || ''}
                  onChange={({ detail }) => updateLetterDraftField('next_step_1', detail.value)}
                  disabled={isLetterEditingDisabled}
                />
              </FormField>
              <FormField label="Next step 2">
                <Input
                  value={activeLetterDraft.next_step_2 || ''}
                  onChange={({ detail }) => updateLetterDraftField('next_step_2', detail.value)}
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
  const reviewNoc = assessment.interventionNoc
    ? `${assessment.interventionNoc}${assessment.interventionNocVersion ? ` (${assessment.interventionNocVersion})` : ''}`
    : assessment.interventionNocVersion
      ? `NOC version ${assessment.interventionNocVersion}`
      : '—';
  const reviewDeliveryMode = assessment.deliveryMode === 'in_house' ? 'In-house (no external partner)' : 'External delivery partner';
  const reviewItpDetails = assessment.itp?.details || '—';
  const reviewWageSubsidyDetails = assessment.wage?.subsidyDetails || '—';
  const reviewCostType = showRecurrenceGroup ? (isRecurringCost ? 'Recurring schedule' : 'One-time total') : '—';
  const reviewRecurrencePeriod = selectedRecurrencePeriodOption?.label || (assessment.recurringPeriod ? formatCaseStatusLabel(assessment.recurringPeriod) : '—');
  const reviewRecurrenceAmount = assessment.recurringAmount ? formatCurrencyDisplay(assessment.recurringAmount) : '—';
  const reviewRecurrenceOccurrences = assessment.recurringOccurrences || '—';
  const reviewRecurrenceTotal = recurringTotal !== null
    ? formatCurrencyDisplay(recurringTotal)
    : formatCurrencyDisplay(assessment.interventionCost) || '—';

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
          <Header variant="h4">Delivery details</Header>
          <div>Intervention code: {selectedInterventionCodeOption?.label || assessment.interventionCode || '—'}</div>
          <div>Delivery mode: {reviewDeliveryMode}</div>
          <div>Provider: {assessment.institution || '—'}</div>
          <div>Program name: {assessment.programName || '—'}</div>
          <div>NOC: {reviewNoc}</div>
          {isEducationIntervention && <div>ITP details: {reviewItpDetails}</div>}
          {isWageSubsidyIntervention && <div>Wage subsidy details: {reviewWageSubsidyDetails}</div>}
          <div>Start: {assessment.startDate || '—'}</div>
          <div>End: {assessment.endDate || 'Not set'}</div>
        </Box>
        <Box>
          <Header variant="h4">Costs</Header>
          <div>Total cost: {formatCurrencyDisplay(displayInterventionCost) || '—'}</div>
          <div>Cost type: {reviewCostType}</div>
          {isRecurringSchedule && (
            <>
              <div>Recurrence period: {reviewRecurrencePeriod}</div>
              <div>Amount per period: {reviewRecurrenceAmount}</div>
              <div>Occurrences: {reviewRecurrenceOccurrences}</div>
              <div>Recurring total: {reviewRecurrenceTotal}</div>
            </>
          )}
          <div>Budget pot: {selectedBudgetPotOption?.label || '—'}</div>
          <div>Paid from: {reviewPostingContext}</div>
        </Box>
      </ColumnLayout>
      {!assessmentSubmitted && renderRecommendationSection()}
    </SpaceBetween>
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
              <RadioGroup
                value={assessment.nwacReviewStatus || ''}
                onChange={({ detail }) => {
                  if (detail.value === 'approve' && isHighCostApprovalBlocked) {
                    setValidationAlert([`Regional Coordinators cannot approve applications with total cost \u2265 $${APPROVAL_COST_THRESHOLD.toLocaleString()}. Escalate to NWAC Administrators.`]);
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
                disabled={isNWACFieldsDisabled}
                readOnly={isNWACFieldsDisabled}
                style={isNWACFieldsDisabled ? { opacity: 0.4 } : undefined}
              />
            </SpaceBetween>
          </FormField>
          <FormField label="Assessment Assurance" errorText={showDecisionErrors && fieldErrors.nwacReview ? fieldErrors.nwacReview : undefined}>
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
              disabled={isNWACFieldsDisabled || assessment.nwacReviewStatus === 'push_back'}
            />
          </FormField>
        </Grid>
        {['reject', 'push_back'].includes(assessment.nwacReviewStatus) && (
          <Grid gridDefinition={[{ colspan: 12 }]}>
            <FormField
              label={assessment.nwacReviewStatus === 'push_back' ? 'Reason for Push Back' : 'Reason for Not Approving'}
              stretch={true}
            >
              <Box width="100%">
                <Textarea value={assessment.nwacReason} onChange={({ detail }) => {
                  if (isNWACFieldsDisabled) return;
                  handleField('nwacReason', detail.value);
                }} data-error-focus={showDecisionErrors && fieldErrors.nwacReason ? 'true' : undefined} disabled={isNWACFieldsDisabled} />
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
                disabled={
                  baseAssessmentLocked ||
                  isEligibilityGateActive ||
                  (!canManageBudgetPotPending && isAssessmentDisabled) ||
                  !decisionHasCost
                }
              />
            </FormField>
            <FormField
              label="Paid from"
              description="Select whether this pot is charged externally or internally."
              errorText={showDecisionErrors && fieldErrors.postingContext ? fieldErrors.postingContext : undefined}
            >
              {isAssessor ? (
                <Input value="External (region/PTMA)" readOnly disabled={!assessment.interventionPotId || !decisionHasCost || isAssessmentDisabled} />
              ) : (
                <Select
                  selectedOption={selectedPostingContext}
                  options={POSTING_OPTIONS}
                  onChange={({ detail }) => handleField('postingContext', detail.selectedOption?.value || '')}
                  placeholder="Select"
                  data-error-focus={showDecisionErrors && fieldErrors.postingContext ? 'true' : undefined}
                  disabled={
                    !assessment.interventionPotId ||
                    !decisionHasCost ||
                    lockedByAnotherUser ||
                    isLockedStatus ||
                    isDecisionFinal ||
                    (isAssessmentDisabled && !canManageBudgetPotPending)
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
    : (showNWACSection ? 'Approve / Mark Not Approved' : 'Submit assessment');

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
              type="info"
              header="Employment insurance eligibility not checked"
              statusIconAriaLabel="Info"
            >
              Assessment sections are locked until a System Admin or Program Admin sets ESDC eligibility.
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
        <Wizard
          activeStepIndex={activeStepIndex}
          isLoadingNextStep={lockingAssessment || checkingChecklist || eiVerificationUploading}
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
              Thank you for declaring a potential conflict of interest. You won’t be able to assess this case while the conflict is reviewed.
            </Box>
            <Box>
              A program admin or regional manager will review and reassign the case as needed. You’ll be redirected to your homepage now.
            </Box>
          </SpaceBetween>
        </Modal>
      </div>
    </BoardItem>
  );
});

export default CoordinatorAssessmentWidget;
