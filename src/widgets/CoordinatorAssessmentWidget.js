import React, { forwardRef, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiFetch } from '../auth/apiClient';
import useApplicationLock, { buildLockConflictMessage } from '../hooks/useApplicationLock';
import useCurrentUser from '../hooks/useCurrentUser';
import { canCompleteOutcomeReview, getCaseStatusContext, getApplicationStatusContext } from '../utils/rbac';
import { Box, Header, ButtonDropdown, Link, SpaceBetween, Button, Alert, Modal, FormField, Input, Textarea, Checkbox, DatePicker, Select, Grid, ColumnLayout, Table, RadioGroup, Autosuggest } from '@cloudscape-design/components';
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

const requiresNocForCode = (value) => {
  if (!value) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 6 && numeric <= 13;
};

const APPLICATION_FINAL_STATUSES = new Set(['approved', 'completed', 'rejected', 'closed', 'archived']);
const APPLICATION_LOCKED_STATUSES = new Set(['approved', 'completed', 'rejected', 'closed', 'archived']);
const APPLICATION_OUTCOME_STATUSES = new Set(['pending_approval']);

// Section header helper for consistent spacing
const sectionHeader = (label) => (
  <Box variant="h3" margin={{ top: 'l', bottom: 's' }}>{label}</Box>
);

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

const calculateDurationDays = (start, end) => {
  const startUtc = parseIsoDateToUtc(start);
  const endUtc = parseIsoDateToUtc(end);
  if (startUtc === null || endUtc === null) return null;
  // Inclusive day count; if start and end are the same day, duration is 1.
  const diff = Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff;
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

const formatCurrencyDisplay = (value) => {
  const num = parseCurrencyInput(value);
  if (num === null) return '';
  return `$ ${num.toFixed(2)}`;
};

const isEmptyString = (val) => val === null || val === undefined || val === '';
const isEmptyArray = (val) => !Array.isArray(val) || val.length === 0;
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
    'otherFunding',
    'esdcEligibility',
    'startDate',
    'endDate',
    'institution',
    'programName',
    'recommendation',
    'justification',
    'nwacReviewStatus',
    'nwacReview',
    'nwacReason',
    'interventionCode',
    'interventionDuration',
    'interventionCost',
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
  mergeObj('itp', { tuition: '', books: '', materials: '', living: '' });
  mergeObj('wage', { wages: '', mercs: '', nonwages: '', other: '' });

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
  priorities: [],
  otherFunding: '',
  esdcEligibility: '',
  startDate: '',
  endDate: '',
  institution: '',
  programName: '',
  itp: { tuition: '', books: '', materials: '', living: '' },
  wage: { wages: '', mercs: '', nonwages: '', other: '' },
  recommendation: '',
  justification: '',
  nwacReviewStatus: '',
  nwacReview: '',
  nwacReason: '',
  interventionCode: '',
  interventionDuration: '',
  interventionCost: '',
  interventionNoc: '',
  interventionNocVersion: '',
  childcareNeed: '',
  childcareFunding: ''
});

const CoordinatorAssessmentWidget = forwardRef(
  ({ actions, toggleHelpPanel, caseData, application_id, onCaseUpdate, applicationRowVersion, onRowVersionUpdate }, ref) => {
  // State for form fields
  const [assessment, setAssessment] = useState(() => buildEmptyAssessment());
  const [initialAssessment, setInitialAssessment] = useState(() => buildEmptyAssessment());
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
  const [checklistCheckError, setChecklistCheckError] = useState(null);
  const [checkingChecklist, setCheckingChecklist] = useState(false);
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
  const isEligibilityAdmin = normalizedRole === 'system administrator' || normalizedRole === 'program administrator';

  const [interventionCodes, setInterventionCodes] = useState([]);
  const [interventionCodesLoading, setInterventionCodesLoading] = useState(false);
  const [nocVersions, setNocVersions] = useState([]);
  const [nocVersionsLoading, setNocVersionsLoading] = useState(false);
  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);
  const [conflictDeclarationSigned, setConflictDeclarationSigned] = useState(Boolean(caseData?.assessment_conflict_declaration_signed));
  const [conflictDeclarationSignedAt, setConflictDeclarationSignedAt] = useState(caseData?.assessment_conflict_declaration_signed_at || null);
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [isSigningDeclaration, setIsSigningDeclaration] = useState(false);
  const [declarationError, setDeclarationError] = useState(null);
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
  const rawCaseStatusSnapshot = caseData?.status ?? '';
  const canonicalCaseStatusSnapshot = getCaseStatusContext(rawCaseStatusSnapshot).canonicalStatus;
  const applicationStatusContext = getApplicationStatusContext(rawApplicationStatus);
  const canonicalApplicationStatus = applicationStatusContext.canonicalStatus || canonicalCaseStatusSnapshot;
  const isPendingApprovalStatus = canonicalApplicationStatus === 'pending_approval';
  const applicantUserId = caseData?.applicant_user_id ?? caseData?.applicantUserId ?? null;
  const applicationId = caseData?.application_id ?? caseData?.applicationId ?? application_id ?? null;

  const isDecisionFinal = APPLICATION_FINAL_STATUSES.has(canonicalApplicationStatus);
  const isLockedStatus = APPLICATION_LOCKED_STATUSES.has(canonicalApplicationStatus);
  const showOutcomeByStatus = APPLICATION_OUTCOME_STATUSES.has(canonicalApplicationStatus);
  const isOutcomeNoticeDisabled = isDecisionFinal;
  const canManageOutcomeReview = canCompleteOutcomeReview({ role: userRole, status: rawApplicationStatus });
  const lacksOutcomePermission = Boolean(userRole) && isPendingApprovalStatus && !canManageOutcomeReview;
  const requiresNoc = useMemo(() => requiresNocForCode(assessment.interventionCode), [assessment.interventionCode]);
  const isDeclarationGateActive = !conflictDeclarationSigned;
  const eligibilitySet = Boolean(assessment.esdcEligibility);
  const isEligibilityGateActive = isDeclarationGateActive || !eligibilitySet;
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
  const selectedChildcareOption = useMemo(
    () => CHILDCARE_OPTIONS.find(option => option.value === assessment.childcareNeed) || null,
    [assessment.childcareNeed]
  );
  const calculatedDuration = useMemo(() => {
    const diff = calculateDurationDays(assessment.startDate, assessment.endDate);
    return diff !== null ? String(diff) : null;
  }, [assessment.startDate, assessment.endDate]);
  const calculatedFundingTotal = useMemo(() => {
    const itp = assessment.itp || {};
    const wage = assessment.wage || {};
    const total =
      parseCurrencyToNumber(itp.tuition) +
      parseCurrencyToNumber(itp.books) +
      parseCurrencyToNumber(itp.materials) +
      parseCurrencyToNumber(itp.living) +
      parseCurrencyToNumber(wage.wages) +
      parseCurrencyToNumber(wage.mercs) +
      parseCurrencyToNumber(wage.nonwages) +
      parseCurrencyToNumber(wage.other);
    if (!Number.isFinite(total) || total <= 0) return null;
    return String(Math.round(total));
  }, [assessment.itp, assessment.wage]);
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
        if (typeof val === 'string') return JSON.parse(val);
        if (typeof val === 'object') return val;
      } catch (e) { return def; }
      return def;
    };
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
      priorities: Array.isArray(caseData?.assessment_local_area_priorities)
        ? caseData.assessment_local_area_priorities
        : [],
      otherFunding: caseData?.assessment_other_funding_details || caseData?.other_funding_details || '',
      esdcEligibility: caseData.assessment_esdc_eligibility || '',
      startDate: formatDate(caseData.assessment_intervention_start_date) || '',
      endDate: formatDate(caseData.assessment_intervention_end_date) || '',
      institution: caseData?.assessment_institution || caseData?.institution || '',
      programName: caseData?.assessment_program_name || '',
      itp: parseOrDefault(caseData.assessment_itp, { tuition: '', books: '', materials: '', living: '' }),
      wage: parseOrDefault(caseData.assessment_wage, { wages: '', mercs: '', nonwages: '', other: '' }),
      recommendation: caseData.assessment_recommendation || '',
      justification: caseData.assessment_justification || '',
      nwacReview: caseData.assessment_nwac_review || '',
      nwacReason: caseData.assessment_nwac_reason || '',
      interventionCode: caseData.assessment_intervention_code != null ? String(caseData.assessment_intervention_code) : '',
      interventionDuration: caseData.assessment_intervention_duration_days != null ? String(caseData.assessment_intervention_duration_days) : '',
      interventionCost: caseData.assessment_intervention_cost_total != null ? String(caseData.assessment_intervention_cost_total) : '',
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
      childcareFunding: caseData.assessment_childcare_funding_details || ''
    };
    const mergedIncoming = { ...buildEmptyAssessment(), ...placeholders };
    const merged = mergeAssessmentState(assessment, mergedIncoming);
    setAssessment(merged);
    setInitialAssessment(merged);
    setConflictDeclarationSigned(Boolean(caseData?.assessment_conflict_declaration_signed));
    setConflictDeclarationSignedAt(caseData?.assessment_conflict_declaration_signed_at || null);
    setDeclarationChecked(false);
    setDeclarationError(null);
  }, [caseData]);

  // Show NWAC section after submission, review completion, final decision, or outcome-ready status
  useEffect(() => {
    const pendingApproval = canonicalApplicationStatus === 'pending_approval';
    const shouldShowOutcome = pendingApproval || isDecisionFinal || showOutcomeByStatus;
    setShowNWACSection(shouldShowOutcome);
    setLocalAssessmentSubmitted(pendingApproval || isDecisionFinal);
  }, [canonicalApplicationStatus, isDecisionFinal, showOutcomeByStatus]);

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

    loadInterventionCodes();
    loadNocVersions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setNocSuggestions([]);
  }, [assessment.interventionNocVersion]);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(assessment) !== JSON.stringify(initialAssessment);
    setIsChanged(changed);
  }, [assessment, initialAssessment]);

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
      const nextAssessment = { ...prevAssessment, [field]: value };
      if (field === 'previousISET' && value !== 'yes') {
        nextAssessment.previousISETDetails = '';
      }
      if (field === 'nwacReviewStatus' && value !== 'reject') {
        nextAssessment.nwacReason = '';
      }
      if (field === 'childcareNeed' && value !== 'yes') {
        nextAssessment.childcareFunding = '';
      }
      if (field === 'interventionCode' && !requiresNocForCode(value)) {
        nextAssessment.interventionNoc = '';
        nextAssessment.interventionNocVersion = '';
      }
      if (hasSubmitted) {
        setFieldErrors(validateAssessment(nextAssessment));
      }
      return nextAssessment;
    });
  };
  const handleCancel = () => setShowCancelModal(true);
  const confirmCancel = () => {
    setAssessment(initialAssessment);
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
    if (!declarationChecked) {
      setDeclarationError('You must confirm the declaration before continuing.');
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
      const payload = { assessment_conflict_declaration_signed: true };
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
      setDeclarationChecked(false);
      const successAlert = {
        type: 'success',
        content: shouldPromoteToInReview
          ? 'Declaration signed. Application status moved to In Review and assessment sections are now available.'
          : 'Conflict of interest declaration signed. Assessment sections are now available.',
        dismissible: true,
        statusIconAriaLabel: 'Success'
      };
      setAlert(successAlert);
      scrollAfterAction();
      if (typeof actions?.refreshCaseData === 'function') {
        try {
          await actions.refreshCaseData();
        } catch (_) {}
      }
      if (typeof onCaseUpdate === 'function') {
        const updates = {
          assessment_conflict_declaration_signed: true,
          assessment_conflict_declaration_signed_at: signedAtIso,
          assessment_conflict_declaration_signed_by: currentUserId || null
        };
        if (shouldPromoteToInReview) {
          updates.status = 'in_review';
          updates.statusRaw = 'in_review';
          updates.applicationStatus = 'in_review';
        }
        onCaseUpdate(updates);
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
    declarationChecked,
    canonicalApplicationStatus,
    ensureLockForOperation,
    lockHeldByCurrentUser,
    onCaseUpdate,
    releaseLock,
    updateRowVersion,
    scrollWidgetAndPageTop
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
    }
    // 4. ESDC Eligibility
    if (!assessment.esdcEligibility) {
      errors.esdcEligibility = 'Eligibility is required.';
    }
    // 5. Start Date (no longer mandatory)
    // 6. End Date (no longer mandatory)
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
      errors.nwacReason = 'Reason for denial is required.';
    }
    // 14. Intervention code required
    if (!assessment.interventionCode) {
      errors.interventionCode = 'Select an intervention code.';
    }
    const numericCode = Number(assessment.interventionCode);
    const requiresNocCode = Number.isFinite(numericCode) && numericCode >= 6 && numericCode <= 13;
    if (requiresNocCode) {
      if (!assessment.interventionNocVersion) {
        errors.interventionNocVersion = 'Select a NOC version for this intervention code.';
      }
      if (!assessment.interventionNoc) {
        errors.interventionNoc = 'Select a NOC code for this intervention.';
      }
    }
    // 15. Optional numeric fields
    if (assessment.interventionDuration && !/^\d+$/.test(assessment.interventionDuration.trim())) {
      errors.interventionDuration = 'Duration must be a whole number of days.';
    }
    if (assessment.interventionCost && String(assessment.interventionCost).trim() !== '') {
      const costNumber = parseCurrencyInput(assessment.interventionCost);
      if (costNumber === null || !Number.isFinite(costNumber) || costNumber < 0) {
        errors.interventionCost = 'Enter a valid amount in dollars.';
      }
    }
    return errors;
  };
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

    // 1. If assessment_date_of_assessment is missing, set to today (2025-06-11)
    let dateOfAssessment = assessment.dateOfAssessment;
    if (!dateOfAssessment) {
      dateOfAssessment = '2025-06-11';
    }
    dateOfAssessment = formatDate(dateOfAssessment);

    // 2. Save assessment (PUT /api/cases/:id)
    const versionToken = Number(latestRowVersion || caseData?.application_row_version || 0);
    let nextApplicationStatus = caseData?.applicationStatus || caseData?.status || null;
    const payload = {
      ...assessment,
      dateOfAssessment,
      assessment_date_of_assessment: dateOfAssessment,
      assessment_employment_goals: assessment.employmentGoals || null,
      assessment_previous_iset: assessment.previousISET || null,
      assessment_previous_iset_details: assessment.previousISETDetails || null,
      assessment_employment_barriers: assessment.barriers || null,
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
      assessment_intervention_related_noc: assessment.interventionNoc || null,
      assessment_intervention_related_noc_version: assessment.interventionNocVersion || null,
      assessment_childcare_need: assessment.childcareNeed || null,
      assessment_childcare_funding_details: assessment.childcareFunding || null,
      case_summary: assessment.overview || null
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
      setIsEditingAssessment(false);
      setShowNWACSection(true);
      setLocalAssessmentSubmitted(true);
      setFieldErrors({});
      setHasSubmitted(false);
      scrollAfterAction();
      setAlert({
        type: 'success',
        content: 'Assessment submitted successfully. Application status moved to Pending Approval. Complete the outcome notice to finish the review.',
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

  // Enhanced handleItp and handleWage to clear funding error if valid
  const handleItp = (field, value) => {
    setAssessment(a => ({ ...a, itp: { ...a.itp, [field]: value } }));
    if (hasSubmitted) {
      setFieldErrors(prev => {
        const next = { ...prev };
        return next;
      });
    }
  };
  const handleWage = (field, value) => {
    setAssessment(a => ({ ...a, wage: { ...a.wage, [field]: value } }));
    if (hasSubmitted) {
      setFieldErrors(prev => {
        const next = { ...prev };
        return next;
      });
    }
  };

  const handleSave = async () => {
    if (lockedByAnotherUser) {
      showLockAlert({ reason: 'owned_by_other', lock: activeLock }, 'warning');
      return;
    }
    setAlert(null);
    try {
      // Prepare payload for backend (map frontend fields to backend fields)
      const payload = {
        assessment_date_of_assessment: formatDate(assessment.dateOfAssessment) || null,
        assessment_employment_goals: assessment.employmentGoals || null,
        assessment_previous_iset: assessment.previousISET || null,
        assessment_previous_iset_details: assessment.previousISETDetails || null,
        assessment_employment_barriers: assessment.barriers || null,
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
        assessment_intervention_related_noc: assessment.interventionNoc || null,
        assessment_intervention_related_noc_version: assessment.interventionNocVersion || null,
        assessment_childcare_need: assessment.childcareNeed || null,
        assessment_childcare_funding_details: assessment.childcareFunding || null,
        case_summary: assessment.overview || null
      };
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

  // UI logic: once status reaches pending approval or a final decision, lock assessment fields and surface NWAC review
  const isAssessmentSubmitted = canonicalApplicationStatus === 'pending_approval';
  const isReviewComplete = APPLICATION_FINAL_STATUSES.has(canonicalApplicationStatus);
  const assessmentSubmitted = localAssessmentSubmitted || isAssessmentSubmitted || isReviewComplete || isDecisionFinal || isLockedStatus || lockedByAnotherUser;
  // Disable all fields (including NWAC) if review is complete, a final decision exists, status is locked, conflict not signed, or eligibility not set
  const baseAssessmentLocked = lockedByAnotherUser || isLockedStatus || isReviewComplete || isDecisionFinal;
  const isAssessmentDisabled = baseAssessmentLocked || isEligibilityGateActive || (assessmentSubmitted && !isEditingAssessment);
  const isNWACFieldsDisabled = baseAssessmentLocked || isEligibilityGateActive || !showNWACSection || !isPendingApprovalStatus || !canManageOutcomeReview;
  const isEligibilityDisabled = baseAssessmentLocked || isDeclarationGateActive || !isEligibilityAdmin;

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
    if (!assessment.nwacReviewStatus) {
      errors.nwacReviewStatus = 'Funding decision selection is required.';
    }
    if (!assessment.nwacReview) {
      errors.nwacReview = 'Assessment assurance outcome is required.';
    }
    if (assessment.nwacReviewStatus === 'reject' && (!assessment.nwacReason || !assessment.nwacReason.trim())) {
      errors.nwacReason = 'Reason for denial is required.';
    }
    return errors;
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
      assessment_date_of_assessment: formatDate(assessment.dateOfAssessment) || null,
      assessment_employment_goals: assessment.employmentGoals || null,
      assessment_previous_iset: assessment.previousISET || null,
      assessment_previous_iset_details: assessment.previousISETDetails || null,
      assessment_employment_barriers: assessment.barriers || null,
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
      assessment_intervention_related_noc: assessment.interventionNoc || null,
      assessment_intervention_related_noc_version: assessment.interventionNocVersion || null,
      assessment_childcare_need: assessment.childcareNeed || null,
      assessment_childcare_funding_details: assessment.childcareFunding || null,
      case_summary: assessment.overview || null,
      assessment_submit_action: true,
      status: assessment.nwacReviewStatus === 'approve' ? 'initiated' : 'archived',
      applicationStatus: assessment.nwacReviewStatus === 'approve' ? 'approved' : 'rejected'
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
      setIsEditingAssessment(false);
      setShowEditConfirmModal(false);
      setShowApproveConfirmModal(false);
      setShowCancelModal(false);
      setLocalAssessmentSubmitted(true);
      setFieldErrors({});
      setHasSubmitted(false);
      scrollAfterAction();
      setAlert({
        type: 'success',
        content: assessment.nwacReviewStatus === 'approve'
          ? 'Outcome notice complete. Application approved.'
          : 'Outcome notice complete. Application rejected.',
        dismissible: true,
        statusIconAriaLabel: 'Success'
      });
      setInitialAssessment(a => ({ ...a, ...payload }));
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
    if (!isPendingApprovalStatus || !canManageOutcomeReview) {
      return handleComplete();
    }
    if (!applicantUserId) {
      return handleComplete();
    }
    setChecklistCheckError(null);
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
        setCheckingChecklist(false);
        return;
      }
    } catch (err) {
      setChecklistCheckError(err?.message || 'Checklist check failed. You may proceed.');
    }
    setCheckingChecklist(false);
    await handleComplete();
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
            <Button variant="primary" disabled={!isChanged} onClick={handleSave}>Save</Button>
          )}
          {!isEligibilityGateActive && !lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && (!assessmentSubmitted || isEditingAssessment) && (
            <Button variant="normal" disabled={!isChanged} onClick={handleCancel}>Cancel</Button>
          )}
          {!isEligibilityGateActive && !lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && (!assessmentSubmitted || isEditingAssessment) && (
            <Button variant="primary" onClick={handleSubmit}>Submit</Button>
          )}
          {!isEligibilityGateActive && !lockedByAnotherUser && showOutcomeByStatus && showNWACSection && !isEditingAssessment && !isOutcomeNoticeDisabled && (
            <Button variant="primary" onClick={handleApproveClick} disabled={!isPendingApprovalStatus || !canManageOutcomeReview || checkingChecklist}>Approve/Reject</Button>
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

  const renderRecommendationSection = () => (
    <>
      {sectionHeader("Assessor's Recommendation")}
      <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
        <FormField label="Recommendation" errorText={hasSubmitted && fieldErrors.recommendation ? fieldErrors.recommendation : undefined}
          description="Select your recommendation for this application. If not recommending funding, provide an alternative or rationale below.">
          <Select
            selectedOption={RECOMMEND_OPTIONS.find(o => o.value === assessment.recommendation) || null}
            onChange={({ detail }) => handleField('recommendation', detail.selectedOption.value)}
            options={RECOMMEND_OPTIONS}
            placeholder="Select recommendation"
            ariaLabel="Recommendation"
            data-error-focus={hasSubmitted && fieldErrors.recommendation ? 'true' : undefined}
            tabIndex={-1}
            disabled={isAssessmentDisabled}
          />
        </FormField>
        <FormField label="Justification" stretch={true} errorText={hasSubmitted && fieldErrors.justification ? fieldErrors.justification : undefined}
          description="Provide a clear justification for your recommendation, referencing the client's needs, goals, and eligibility.">
          <Box width="100%">
            <Textarea  value={assessment.justification} onChange={({ detail }) => handleField('justification', detail.value)} data-error-focus={hasSubmitted && fieldErrors.justification ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
          </Box>
        </FormField>
      </Grid>
    </>
  );

  if (isDeclarationGateActive) {
    return (
      <BoardItem header={headerElement} i18nStrings={boardItemI18nStrings} settings={boardItemSettings}>
        <div ref={setWidgetRootRef}>
          <div ref={alertAnchorRef} />
          <Box variant="small" margin={{ bottom: 's' }}>
            This form is used by the ISET admin team to assess the applicant's needs, eligibility, and funding recommendation.
            Complete the conflict of interest declaration below to unlock the assessment.
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
                As the Client Case Manager, I confirm that I have no actual, potential, or perceived conflict of interest or bias in relation to this
                client's application, assessment and funding, and I have not provided, or attempted to assign the client with priority or preferential
                treatment outside of the established assessment process.
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
              <Checkbox
                checked={declarationChecked}
                onChange={({ detail }) => {
                  setDeclarationChecked(detail.checked);
                  if (detail.checked) {
                    setDeclarationError(null);
                  }
                }}
                disabled={lockedByAnotherUser || isSigningDeclaration}
              >
                I confirm the statement above and agree to proceed.
              </Checkbox>
              <SpaceBetween direction="horizontal" size="s">
                <Button
                  variant="primary"
                  onClick={handleSignDeclaration}
                  loading={isSigningDeclaration}
                  disabled={!declarationChecked || lockedByAnotherUser || isSigningDeclaration}
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
        {conflictDeclarationSigned && (
          <Box color="text-status-success" margin={{ bottom: 's' }}>
            Conflict of interest declaration signed
            {conflictDeclarationSignedDisplayDate ? ` on ${conflictDeclarationSignedDisplayDate}` : ''}.
          </Box>
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
        {!eligibilitySet && (
          <>
            <Alert
              type="info"
              header="Employment insurance eligibility not checked"
              statusIconAriaLabel="Info"
            >
              Assessment sections are locked until a System Administrator or Program Administrator checks ESDC eligibility.
            </Alert>
            <Box margin={{ bottom: 's' }} />
          </>
        )}
        {sectionHeader('ESDC Eligibility')}
        <Grid gridDefinition={[{ colspan: 12 }]}>
          <FormField
            label="Eligibility"
            errorText={hasSubmitted && fieldErrors.esdcEligibility ? fieldErrors.esdcEligibility : undefined}
            description="Select the client's eligibility category for ESDC funding. Only program admins may set this."
          >
            <Select
              selectedOption={ESDC_OPTIONS.find(o => o.value === assessment.esdcEligibility) || null}
              onChange={({ detail }) => handleField('esdcEligibility', detail.selectedOption.value)}
              options={ESDC_OPTIONS}
              placeholder="Select eligibility"
              ariaLabel="Eligibility"
              data-error-focus={hasSubmitted && fieldErrors.esdcEligibility ? 'true' : undefined}
              tabIndex={-1}
              disabled={isEligibilityDisabled}
            />
          </FormField>
        </Grid>
        {!eligibilitySet && <Box margin={{ bottom: 'l' }} />}
        {isEligibilityGateActive ? null : (
        <>
        {sectionHeader('Outcome Notice')}
        {!showNWACSection && (
          <Box color="text-status-inactive" margin={{ top: 'm', bottom: 's' }}>
            Outcome notice will be available after the assessment is submitted.
          </Box>
        )}
        {showNWACSection && (
          <>
            {lacksOutcomePermission && !lockedByAnotherUser && (
              <Alert
                type="info"
                statusIconAriaLabel="Information"
              >
                You do not have permission to complete the NWAC outcome notice. Contact an administrator if you need access.
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
                <FormField label="Funding Decision" errorText={hasSubmitted && fieldErrors.nwacReviewStatus ? fieldErrors.nwacReviewStatus : undefined}>
                  <SpaceBetween direction="horizontal" size="xs">
                    <RadioGroup
                      value={assessment.nwacReviewStatus || ''}
                      onChange={({ detail }) => {
                        if (isNWACFieldsDisabled) return;
                        if (detail.value === 'approve' && assessment.nwacReason) {
                          setShowApproveConfirmModal(true);
                        } else {
                          handleField('nwacReviewStatus', detail.value);
                          if (detail.value === 'approve') handleField('nwacReason', '');
                        }
                      }}
                      items={[
                        { value: 'approve', label: 'Approve' },
                        { value: 'reject', label: 'Reject' }
                      ]}
                      ariaLabel="NWAC Review Status"
                      data-error-focus={hasSubmitted && fieldErrors.nwacReviewStatus ? 'true' : undefined}
                      disabled={isNWACFieldsDisabled}
                      style={isNWACFieldsDisabled ? { opacity: 0.6 } : undefined}
                    />
                  </SpaceBetween>
                </FormField>
                <FormField label="Assessment Assurance" errorText={hasSubmitted && fieldErrors.nwacReview ? fieldErrors.nwacReview : undefined}>
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
                    data-error-focus={hasSubmitted && fieldErrors.nwacReview ? 'true' : undefined}
                    disabled={isNWACFieldsDisabled}
                  />
                </FormField>
              </Grid>
              {assessment.nwacReviewStatus === 'reject' && (
                <Grid gridDefinition={[{ colspan: 12 }]}>
                  <FormField label="Reason for Denial" stretch={true} >
                    <Box width="100%">
                      <Textarea value={assessment.nwacReason} onChange={({ detail }) => {
                        if (isNWACFieldsDisabled) return;
                        handleField('nwacReason', detail.value);
                      }} data-error-focus={hasSubmitted && fieldErrors.nwacReason ? 'true' : undefined} disabled={isNWACFieldsDisabled} />
                    </Box>
                  </FormField>
                </Grid>
              )}
            </Box>
            <Modal
              visible={showApproveConfirmModal}
              onDismiss={() => setShowApproveConfirmModal(false)}
              header="Clear Reason for Denial?"
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
              <Box>Switching to "Approve" will clear the Reason for Denial. Do you want to continue?</Box>
            </Modal>
          </>
        )}
        {assessmentSubmitted && renderRecommendationSection()}
        {sectionHeader('Assessment Overview')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
          <FormField label="Date of Assessment">
            <DatePicker onChange={({ detail }) => handleField('dateOfAssessment', detail.value)} value={assessment.dateOfAssessment} readOnly={assessmentSubmitted} disabled={isAssessmentDisabled} />
          </FormField>
          <FormField label="Current Case Owner">
            <Box padding={{ vertical: 'xs' }}>{assessment.clientName || 'Not assigned'}</Box>
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Client Application Overview & Request" stretch={true} errorText={hasSubmitted && fieldErrors.overview ? fieldErrors.overview : undefined}
            description="Summarize the client's application, background, and the specific request or intervention being considered. Include any relevant context from the application form.">
            <Box width="100%">
              <Textarea placeholder={initialAssessment.overview} value={assessment.overview} onChange={({ detail }) => handleField('overview', detail.value)} data-error-focus={hasSubmitted && fieldErrors.overview ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
            </Box>
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Client’s Employment Goal(s)" stretch={true} errorText={hasSubmitted && fieldErrors.employmentGoals ? fieldErrors.employmentGoals : undefined}
            description="Describe the client's short- and long-term employment goals as discussed during assessment. Reference the goals stated in the application form if available.">
            <Box width="100%">
              <Textarea placeholder={initialAssessment.employmentGoals} value={assessment.employmentGoals} onChange={({ detail }) => handleField('employmentGoals', detail.value)} data-error-focus={hasSubmitted && fieldErrors.employmentGoals ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
            </Box>
          </FormField>
        </Grid>
        {sectionHeader('Previous ISET Funding')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
          <FormField label="Was the Client previously funded under the ISET Program?"
            description="Indicate if the client has received ISET funding in the past. If yes, provide details below.">
            <Checkbox checked={assessment.previousISET === 'yes'} onChange={({ detail }) => handleField('previousISET', detail.checked ? 'yes' : 'no')} disabled={isAssessmentDisabled}>Yes</Checkbox>
          </FormField>
          {assessment.previousISET === 'yes' ? (
            <Grid gridDefinition={[{ colspan: 12 }]}> 
              <FormField label="If Yes, provide dates and specifics" stretch={true} errorText={hasSubmitted && fieldErrors.previousISETDetails ? fieldErrors.previousISETDetails : undefined}
                description="List the dates and details of any previous ISET funding the client has received.">
                <Box width="100%">
                  <Textarea value={assessment.previousISETDetails} onChange={({ detail }) => handleField('previousISETDetails', detail.value)} data-error-focus={hasSubmitted && fieldErrors.previousISETDetails ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
                </Box>
              </FormField>
            </Grid>
          ) : (
            <div />  // placeholder to satisfy two-column grid
          )}
        </Grid>
        {sectionHeader('Barriers to Employment')}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Barriers (select all that apply)" errorText={hasSubmitted && fieldErrors.barriers ? fieldErrors.barriers : undefined}
            description="Select all barriers that may impact the client's ability to obtain or maintain employment. These may be self-identified or observed during assessment.">
            <ColumnLayout columns={3} borders="horizontal">
              {BARRIERS.map((barrier, index) => (
                <Checkbox
                  key={barrier}
                  checked={Array.isArray(assessment.barriers) && assessment.barriers.includes(barrier)}
                  data-error-focus={hasSubmitted && fieldErrors.barriers && index === 0 ? 'true' : undefined}
                  onChange={({ detail }) => {
                    const next = Array.isArray(assessment.barriers) ? assessment.barriers : [];
                    handleField('barriers', detail.checked ? [...next, barrier] : next.filter(b => b !== barrier));
                  }}
                  disabled={isAssessmentDisabled}
                >{barrier}</Checkbox>
              ))}
            </ColumnLayout>
          </FormField>
        </Grid>
        {sectionHeader('Local Area Priorities (Target Areas)')}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Priority Population Groups (select all that apply)"
            description="Identify if the client belongs to any priority population groups targeted by your local area or program.">
            <ColumnLayout columns={3} borders="horizontal">
              {PRIORITIES.map(priority => (
                <Checkbox
                  key={priority}
                  checked={Array.isArray(assessment.priorities) && assessment.priorities.includes(priority)}
                  onChange={({ detail }) => {
                    const next = Array.isArray(assessment.priorities) ? assessment.priorities : [];
                    handleField('priorities', detail.checked ? [...next, priority] : next.filter(p => p !== priority));
                  }}
                  disabled={isAssessmentDisabled}
                >{priority}</Checkbox>
              ))}
            </ColumnLayout>
          </FormField>
        </Grid>
        {sectionHeader('Other Funding Sources')}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Has the Client received any other sources of funding for this intervention?" stretch={true}
            description="Describe any other funding the client has received or applied for in relation to this intervention.">
            <Box width="100%">
              <Textarea placeholder={initialAssessment.otherFunding} value={assessment.otherFunding} onChange={({ detail }) => handleField('otherFunding', detail.value)} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
            </Box>
          </FormField>
        </Grid>
        {sectionHeader('Intervention Recommendation')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
          <FormField
            label="Intervention Code"
            description="Select the intervention type recommended for this client."
            errorText={hasSubmitted && fieldErrors.interventionCode ? fieldErrors.interventionCode : undefined}
          >
            <Select
              selectedOption={selectedInterventionCodeOption}
              onChange={({ detail }) => handleField('interventionCode', detail.selectedOption?.value || '')}
              options={interventionCodes}
              placeholder={interventionCodesLoading ? 'Loading intervention codes...' : 'Select intervention code'}
              statusType={interventionCodesLoading ? 'loading' : 'finished'}
              filteringType="auto"
              data-error-focus={hasSubmitted && fieldErrors.interventionCode ? 'true' : undefined}
              disabled={isAssessmentDisabled}
            />
          </FormField>
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
        <Grid gridDefinition={[{ colspan: 12 }]}>
          <FormField
            label="Childcare Funding Details (optional)"
            description="Provide any known childcare supports (existing or requested)."
          >
            <Textarea
              value={assessment.childcareFunding || ''}
              onChange={({ detail }) => handleField('childcareFunding', detail.value)}
              disabled={isAssessmentDisabled}
            />
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
          <FormField label="Start Date" errorText={hasSubmitted && fieldErrors.startDate ? fieldErrors.startDate : undefined}
            description="Enter the planned start date for the intervention or training.">
            <DatePicker onChange={({ detail }) => handleField('startDate', detail.value)} value={assessment.startDate} ariaLabel="Start Date" data-error-focus={hasSubmitted && fieldErrors.startDate ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
          </FormField>
          <FormField label="End Date" errorText={hasSubmitted && fieldErrors.endDate ? fieldErrors.endDate : undefined}
            description="Enter the planned end date for the intervention or training.">
            <DatePicker onChange={({ detail }) => handleField('endDate', detail.value)} value={assessment.endDate} ariaLabel="End Date" data-error-focus={hasSubmitted && fieldErrors.endDate ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
          <FormField label="Training Institution/Employer" errorText={hasSubmitted && fieldErrors.institution ? fieldErrors.institution : undefined}
            description="Provide the training institution or employer, if applicable.">
            <Input value={assessment.institution} onChange={({ detail }) => handleField('institution', detail.value)} ariaLabel="Training Institution/Employer" data-error-focus={hasSubmitted && fieldErrors.institution ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
          </FormField>
          <FormField label="Program Name" errorText={hasSubmitted && fieldErrors.programName ? fieldErrors.programName : undefined}
            description="Enter the program or position name, if known.">
            <Input value={assessment.programName} onChange={({ detail }) => handleField('programName', detail.value)} ariaLabel="Program Name" data-error-focus={hasSubmitted && fieldErrors.programName ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
          <FormField
            label="NOC Version"
            description="Required only when the intervention code is 6–13."
            errorText={hasSubmitted && fieldErrors.interventionNocVersion ? fieldErrors.interventionNocVersion : undefined}
          >
            <Select
              selectedOption={selectedNocVersionOption}
              onChange={({ detail }) => handleField('interventionNocVersion', detail.selectedOption?.value || '')}
              options={nocVersions}
              placeholder={nocVersionsLoading ? 'Loading NOC versions...' : 'Select NOC version'}
              statusType={nocVersionsLoading ? 'loading' : 'finished'}
              filteringType="auto"
              data-error-focus={hasSubmitted && fieldErrors.interventionNocVersion ? 'true' : undefined}
              disabled={isAssessmentDisabled || nocVersionsLoading}
            />
          </FormField>
          <FormField
            label="NOC Code"
            description={requiresNoc ? 'Search by code or title to select the appropriate NOC.' : 'Optional unless the intervention code is 6–13.'}
            errorText={hasSubmitted && fieldErrors.interventionNoc ? fieldErrors.interventionNoc : undefined}
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
                requiresNoc
                  ? assessment.interventionNocVersion
                    ? 'Type to search NOC code'
                    : 'Select a NOC version first'
                  : 'Not required'
              }
              empty={requiresNoc ? 'No NOC codes found.' : 'NOC selection not required.'}
              disabled={!requiresNoc || isAssessmentDisabled || !assessment.interventionNocVersion}
              enteredTextLabel={value => `Use "${value}"`}
              data-error-focus={hasSubmitted && fieldErrors.interventionNoc ? 'true' : undefined}
            />
          </FormField>
        </Grid>
        <Box margin={{ top: 'l', bottom: 's' }}>
          <Header variant="h3">Individual Training Purchase (ITP)</Header>
        </Box>
        <Table
          stripedRows
          columnDefinitions={[
            { id: 'category', header: 'Funding Category', cell: item => item.label },
            { id: 'requested', header: 'Funding Requested', cell: item => (
              <Input
                type="text"
                value={assessment.itp?.[item.key] || ''}
                onChange={({ detail }) => {
                  const raw = detail.value.replace(/[^\d.]/g, '');
                  handleItp(item.key, raw);
                }}
                onBlur={({ detail }) => {
                  const raw = assessment.itp?.[item.key] || '';
                  const num = raw ? parseFloat(raw) : '';
                  const formatted = num !== '' && !isNaN(num) ? `$ ${num.toFixed(2)}` : '';
                  handleItp(item.key, formatted);
                }}
                ariaLabel={item.label}
                readOnly={isAssessmentDisabled}
                disabled={isAssessmentDisabled}
              />
            ) },
            { id: 'actions', header: 'Actions', cell: item => (
              isAssessmentDisabled ? null : (
                <Button size="small" variant="inline-link" onClick={() => handleItp(item.key, '')}>Clear</Button>
              )
            ) }
          ]}
          items={[
            { key: 'tuition', label: 'Tuition' },
            { key: 'books', label: 'Books' },
            { key: 'materials', label: 'Materials' },
            { key: 'living', label: 'Living Allowance' }
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
                  Number((assessment.itp?.living || '').replace(/[^\d.]/g, ''))
                ).toFixed(2)}
              </Box>
            </>
          }
        />
        <Box margin={{ top: 'l', bottom: 's' }}>
          <Header variant="h3">Targeted Wage Subsidy / Job Creation Partnership</Header>
        </Box>
        <Table
          stripedRows
          columnDefinitions={[
            { id: 'category', header: 'Funding Category', cell: item => item.label },
            { id: 'requested', header: 'Funding Requested', cell: item => (
              <Input
                type="text"
                value={assessment.wage?.[item.key] || ''}
                onChange={({ detail }) => {
                  if (item.key === 'other') {
                    handleWage(item.key, detail.value);
                  } else {
                    const raw = detail.value.replace(/[^\d.]/g, '');
                    handleWage(item.key, raw);
                  }
                }}
                onBlur={({ detail }) => {
                  if (item.key === 'other') return;
                  const raw = assessment.wage?.[item.key] || '';
                  const num = raw ? parseFloat(raw) : '';
                  const formatted = num !== '' && !isNaN(num) ? `$ ${num.toFixed(2)}` : '';
                  handleWage(item.key, formatted);
                }}
                ariaLabel={item.label}
                readOnly={isAssessmentDisabled}
                disabled={isAssessmentDisabled}
              />
            ) },
            { id: 'actions', header: 'Actions', cell: item => (
              isAssessmentDisabled ? null : (
                <Button size="small" variant="inline-link" onClick={() => handleWage(item.key, '')}>Clear</Button>
              )
            ) }
          ]}
          items={[
            { key: 'wages', label: 'Wages' },
            { key: 'mercs', label: 'MERCs' },
            { key: 'nonwages', label: 'Non-Wages' },
            { key: 'other', label: 'Other' }
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
                  Number((assessment.wage?.other || '').replace(/[^\d.]/g, ''))
                ).toFixed(2)}
              </Box>
            </>
          }
        />
        {sectionHeader('Intervention Summary')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
          <FormField
            label="Intervention Duration (days)"
            description={calculatedDuration ? `Optional. Calculated from start/end dates: ${calculatedDuration} day(s).` : 'Optional. Enter the number of days the intervention will run.'}
            errorText={hasSubmitted && fieldErrors.interventionDuration ? fieldErrors.interventionDuration : undefined}
            secondaryControl={
              !isAssessmentDisabled && calculatedDuration && assessment.interventionDuration !== calculatedDuration ? (
                <Button size="small" onClick={() => handleField('interventionDuration', calculatedDuration)}>
                  Use {calculatedDuration}
                </Button>
              ) : null
            }
          >
            <Input
              inputMode="numeric"
              value={assessment.interventionDuration || ''}
              onChange={({ detail }) => handleField('interventionDuration', detail.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 120"
              data-error-focus={hasSubmitted && fieldErrors.interventionDuration ? 'true' : undefined}
              disabled={isAssessmentDisabled}
            />
          </FormField>
          <FormField
            label="Intervention Cost (total)"
            description={calculatedFundingTotal ? `Optional. Auto-calculated from funding tables: $${calculatedFundingTotal}. Adjust if needed.` : 'Optional. Enter the total planned cost (whole dollars).' }
            errorText={hasSubmitted && fieldErrors.interventionCost ? fieldErrors.interventionCost : undefined}
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
              value={assessment.interventionCost || ''}
              onChange={({ detail }) => handleField('interventionCost', detail.value.replace(/[^\d.]/g, ''))}
              onBlur={() => {
                const formatted = formatCurrencyDisplay(assessment.interventionCost);
                if (formatted) {
                  handleField('interventionCost', formatted);
                }
              }}
              placeholder="e.g. $4,200.00"
              data-error-focus={hasSubmitted && fieldErrors.interventionCost ? 'true' : undefined}
              disabled={isAssessmentDisabled}
            />
          </FormField>
        </Grid>

        {!assessmentSubmitted && renderRecommendationSection()}
        </>
        )}
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
          onDismiss={() => setChecklistWarningVisible(false)}
          header="Checklist incomplete"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" onClick={() => { setChecklistWarningVisible(false); handleComplete(); }}>
                Continue anyway
              </Button>
              <Button variant="normal" onClick={() => setChecklistWarningVisible(false)}>Cancel</Button>
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
          <Box>Are you sure you want to edit the previously submitted assessment? This will allow you to make changes and resubmit. Your changes will not be saved until you click Save or Submit.</Box>
        </Modal>
      </div>
    </BoardItem>
  );
});

export default CoordinatorAssessmentWidget;




