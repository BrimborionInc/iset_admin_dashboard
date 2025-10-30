import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

const APPLICATION_FINAL_STATUSES = new Set(['approved', 'completed', 'rejected', 'withdrawn', 'archived']);
const APPLICATION_LOCKED_STATUSES = new Set(['approved', 'completed', 'rejected', 'withdrawn', 'archived']);
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
  const diff = Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24));
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

const CoordinatorAssessmentWidget = ({ actions, toggleHelpPanel, caseData, application_id, onCaseUpdate }) => {
  // State for form fields
  const [assessment, setAssessment] = useState({});
  const [initialAssessment, setInitialAssessment] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [alert, setAlert] = useState(null);
  const [applicationRowVersion, setApplicationRowVersion] = useState(() => Number(caseData?.application_row_version || 0));
  const [isChanged, setIsChanged] = useState(false);
  const [showNWACSection, setShowNWACSection] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [validationAlert, setValidationAlert] = useState(null);
  const [isEditingAssessment, setIsEditingAssessment] = useState(false);
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
  const [localAssessmentSubmitted, setLocalAssessmentSubmitted] = useState(false);
  const alertAnchorRef = useRef(null);
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

  const [interventionCodes, setInterventionCodes] = useState([]);
  const [interventionCodesLoading, setInterventionCodesLoading] = useState(false);
  const [nocVersions, setNocVersions] = useState([]);
  const [nocVersionsLoading, setNocVersionsLoading] = useState(false);
  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);

  const rawApplicationStatus = caseData?.applicationStatus ?? caseData?.application_status ?? null;
  const rawCaseStatusSnapshot = caseData?.status ?? '';
  const canonicalCaseStatusSnapshot = getCaseStatusContext(rawCaseStatusSnapshot).canonicalStatus;
  const applicationStatusContext = getApplicationStatusContext(rawApplicationStatus);
  const canonicalApplicationStatus = applicationStatusContext.canonicalStatus || canonicalCaseStatusSnapshot;
  const isPendingApprovalStatus = canonicalApplicationStatus === 'pending_approval';

  const isDecisionFinal = APPLICATION_FINAL_STATUSES.has(canonicalApplicationStatus);
  const isLockedStatus = APPLICATION_LOCKED_STATUSES.has(canonicalApplicationStatus);
  const showOutcomeByStatus = APPLICATION_OUTCOME_STATUSES.has(canonicalApplicationStatus);
  const isOutcomeNoticeDisabled = isDecisionFinal;
  const canManageOutcomeReview = canCompleteOutcomeReview({ role: userRole, status: rawApplicationStatus });
  const lacksOutcomePermission = Boolean(userRole) && isPendingApprovalStatus && !canManageOutcomeReview;
  const requiresNoc = useMemo(() => requiresNocForCode(assessment.interventionCode), [assessment.interventionCode]);
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
  const lockAlertMessage = useMemo(() => {
    const lockExpiresAt = activeLock?.expiresAt ? new Date(activeLock.expiresAt) : null;
    if (lockedByAnotherUser) {
      return buildLockConflictMessage({ reason: 'owned_by_other', lock: activeLock });
    }
    if (lockHeldByCurrentUser) {
      const ownerLabel = currentUserName || activeLock?.ownerDisplayName || 'you';
      const expiresFragment = lockExpiresAt ? ` (expires ${lockExpiresAt.toLocaleTimeString()})` : '';
      return `You (${ownerLabel}) currently hold an edit lock${expiresFragment}. Save or cancel to release it for other users.`;
    }
    return null;
  }, [activeLock, currentUserName, lockHeldByCurrentUser, lockedByAnotherUser]);

  useEffect(() => {
    setApplicationRowVersion(Number(caseData?.application_row_version || 0));
  }, [caseData?.application_row_version]);

  // Pre-populate fields from application form as placeholders
  useEffect(() => {
    if (!caseData) return;
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
    setAssessment(a => ({ ...placeholders, ...a }));
    setInitialAssessment(placeholders);
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
    setIsChanged(JSON.stringify(assessment) !== JSON.stringify(initialAssessment));
  }, [assessment, initialAssessment]);

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
    setTimeout(() => {
      alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }, []);
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
    if (assessment.interventionCost && !/^\d+$/.test(assessment.interventionCost.trim())) {
      errors.interventionCost = 'Cost must be a whole number (no decimals).';
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
          firstErrorField.focus();
        } else {
          alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 0);
      return;
    }
    // --- POST-VALIDATION WORKFLOW ---
    const lockCheck = await ensureLockForOperation();
    if (!lockCheck.ok) return;
    const releaseAfterSuccess = lockCheck.localOwner || lockHeldByCurrentUser;
    // 1. If assessment_date_of_assessment is missing, set to today (2025-06-11)
    let dateOfAssessment = assessment.dateOfAssessment;
    if (!dateOfAssessment) {
      dateOfAssessment = '2025-06-11';
    }
    dateOfAssessment = formatDate(dateOfAssessment);

    // 2. Save assessment (PUT /api/cases/:id)
    const versionToken = Number(applicationRowVersion || caseData?.application_row_version || 0);
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
      assessment_intervention_cost_total: assessment.interventionCost || null,
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
        if (latestVersion) setApplicationRowVersion(latestVersion);
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
        setTimeout(() => {
          alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
        releaseLock({ silent: true }).catch(() => {});
        return;
      }
      if (!res.ok || !result?.success) throw new Error(result?.error || 'Failed to save assessment.');
      const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
      if (updatedRowVersion) {
        setApplicationRowVersion(updatedRowVersion);
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
      scrollToPageTop();
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
      setTimeout(() => {
        alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
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
      assessment_intervention_cost_total: assessment.interventionCost || null,
      assessment_intervention_related_noc: assessment.interventionNoc || null,
      assessment_intervention_related_noc_version: assessment.interventionNocVersion || null,
      assessment_childcare_need: assessment.childcareNeed || null,
      assessment_childcare_funding_details: assessment.childcareFunding || null,
      case_summary: assessment.overview || null
      };
      const lockCheck = await ensureLockForOperation();
      if (!lockCheck.ok) return;
      const versionToken = Number(applicationRowVersion || caseData?.application_row_version || 0);
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
        if (latestVersion) setApplicationRowVersion(latestVersion);
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
        setTimeout(() => {
          alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
        releaseLock({ silent: true }).catch(() => {});
        return;
      }
      if (res.ok && result?.success) {
        const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
        if (updatedRowVersion) {
          setApplicationRowVersion(updatedRowVersion);
        }
        setAlert({ type: 'success', content: 'Assessment saved successfully. All changes have been recorded.', dismissible: true, statusIconAriaLabel: 'Success' });
        setInitialAssessment(assessment);
        setIsChanged(false);
        // Refresh caseData from backend to reflect latest changes
        if (typeof actions?.refreshCaseData === 'function') {
          try {
            await actions.refreshCaseData();
          } catch (_) {
            // ignore refresh errors
          }
        }
        // Scroll to the alert anchor so the alert is visible
        setTimeout(() => {
          alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
      } else {
        setAlert({ type: 'error', content: result.error || 'Failed to save assessment.', dismissible: true, statusIconAriaLabel: 'Error' });
        setTimeout(() => {
          alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
      }
    } catch (err) {
      setAlert({ type: 'error', content: err.message || 'Failed to save assessment.', dismissible: true, statusIconAriaLabel: 'Error' });
      setTimeout(() => {
        alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  };

  // UI logic: once status reaches pending approval or a final decision, lock assessment fields and surface NWAC review
  const isAssessmentSubmitted = canonicalApplicationStatus === 'pending_approval';
  const isReviewComplete = APPLICATION_FINAL_STATUSES.has(canonicalApplicationStatus);
  const assessmentSubmitted = localAssessmentSubmitted || isAssessmentSubmitted || isReviewComplete || isDecisionFinal || isLockedStatus || lockedByAnotherUser;
  // Disable all fields (including NWAC) if review is complete, a final decision exists, or status is locked
  const isAssessmentDisabled = lockedByAnotherUser || isLockedStatus || isReviewComplete || isDecisionFinal || (assessmentSubmitted && !isEditingAssessment);
  const isNWACFieldsDisabled = lockedByAnotherUser || !showNWACSection || !isPendingApprovalStatus || isReviewComplete || isDecisionFinal || !canManageOutcomeReview;

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
          firstErrorField.focus();
        } else {
          alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 0);
      return;
    }
    // Send full assessment payload to backend
    const lockCheck = await ensureLockForOperation();
    if (!lockCheck.ok) return;
    const releaseAfterSuccess = lockCheck.localOwner || lockHeldByCurrentUser;
    const versionToken = Number(applicationRowVersion || caseData?.application_row_version || 0);
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
      assessment_intervention_cost_total: assessment.interventionCost || null,
      assessment_intervention_related_noc: assessment.interventionNoc || null,
      assessment_intervention_related_noc_version: assessment.interventionNocVersion || null,
      assessment_childcare_need: assessment.childcareNeed || null,
      assessment_childcare_funding_details: assessment.childcareFunding || null,
      case_summary: assessment.overview || null,
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
        if (latestVersion) setApplicationRowVersion(latestVersion);
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
        setTimeout(() => {
          alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
        return;
      }
      if (!res.ok || !result?.success) throw new Error(result?.error || 'Failed to save NWAC review.');
      const updatedRowVersion = Number(result?.application_row_version ?? (versionToken > 0 ? versionToken + 1 : null));
      if (updatedRowVersion) {
        setApplicationRowVersion(updatedRowVersion);
      }
      // 2. Log NWAC review submitted event
      const userId = caseData?.user_id || caseData?.applicant_user_id || null;
      if (userId) {
        await apiFetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'nwac_review_submitted',
            caseId: caseData.id,
            payload: {
              message: 'NWAC review submitted.',
              nwac_review: assessment.nwacReview,
              timestamp: new Date().toISOString(),
            },
          }),
        });
        // 4. Log event for approval/rejection
        await apiFetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: assessment.nwacReviewStatus === 'approve' ? 'case_approved' : 'case_rejected',
            caseId: caseData.id,
            payload: {
              message: assessment.nwacReviewStatus === 'approve' ? 'Case approved by NWAC.' : 'Case rejected by NWAC.',
              reason: assessment.nwacReason || '',
              nwac_review: assessment.nwacReview,
              timestamp: new Date().toISOString(),
            },
          }),
        });

      }
      // 4. Refresh caseData to reflect new status
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
      scrollToPageTop();
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
      setTimeout(() => {
        alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              {!lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && isReviewComplete && (
                <Button variant="normal" onClick={() => setShowEditConfirmModal(true)}>Edit</Button>
              )}
              {!lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && assessmentSubmitted && !isEditingAssessment && (
                <Button variant="normal" onClick={() => setShowEditConfirmModal(true)}>Edit</Button>
              )}
              {!lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && (!assessmentSubmitted || isEditingAssessment) && (
                <Button variant="primary" disabled={!isChanged} onClick={handleSave}>Save</Button>
              )}
              {!lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && (!assessmentSubmitted || isEditingAssessment) && (
                <Button variant="normal" disabled={!isChanged} onClick={handleCancel}>Cancel</Button>
              )}
              {!lockedByAnotherUser && !isLockedStatus && !isDecisionFinal && !isReviewComplete && (!assessmentSubmitted || isEditingAssessment) && (
                <Button variant="primary" onClick={handleSubmit}>Submit</Button>
              )}
              {!lockedByAnotherUser && showOutcomeByStatus && showNWACSection && !isEditingAssessment && !isOutcomeNoticeDisabled && (
                <Button variant="primary" onClick={handleComplete} disabled={!isPendingApprovalStatus || !canManageOutcomeReview}>Approve/Reject</Button>
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
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions && actions.removeItem && actions.removeItem()}
        />
      }
    >
      <Box>
        <Box variant="small" margin={{ bottom: 's' }}>
          This form is used by the ISET admin team to assess the applicant’s needs, eligibility, and funding recommendation. Complete all required sections before submitting. After submission, the final approval fields will become available.
        </Box>
        <div ref={alertAnchorRef} style={{ height: 0, margin: 0, padding: 0, border: 0 }} aria-hidden="true" />
        {lockAlertMessage && (
          <Alert type={lockedByAnotherUser ? 'warning' : 'info'}>
            {lockAlertMessage}
          </Alert>
        )}
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
        {!showNWACSection && (
          <Box color="text-status-inactive" margin={{ bottom: 's' }}>
            Outcome notice will be available after the assessment is submitted.
          </Box>
        )}
        {showNWACSection && (
            <>
              {sectionHeader('Outcome Notice')}
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
              {/* Move Reason for Denial outside the 6-6 grid for full width */}
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
            {/* Approve confirmation modal */}
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
          {assessment.previousISET === 'yes' && (
            <Grid gridDefinition={[{ colspan: 12 }]}> 
              <FormField label="If Yes, provide dates and specifics" stretch={true} errorText={hasSubmitted && fieldErrors.previousISETDetails ? fieldErrors.previousISETDetails : undefined}
                description="List the dates and details of any previous ISET funding the client has received.">
                <Box width="100%">
                  <Textarea value={assessment.previousISETDetails} onChange={({ detail }) => handleField('previousISETDetails', detail.value)} data-error-focus={hasSubmitted && fieldErrors.previousISETDetails ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
                </Box>
              </FormField>
            </Grid>
          )}
        </Grid>
        {sectionHeader('Barriers to Employment')}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Barriers (select all that apply)" errorText={hasSubmitted && fieldErrors.barriers ? fieldErrors.barriers : undefined}
            description="Select all barriers that may impact the client's ability to obtain or maintain employment. These may be self-identified or observed during assessment.">
            <ColumnLayout columns={3} borders="horizontal">
              {BARRIERS.map(barrier => (
                <Checkbox
                  key={barrier}
                  checked={assessment.barriers?.includes(barrier)}
                  onChange={({ detail }) => {
                    const next = assessment.barriers || [];
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
                  checked={assessment.priorities?.includes(priority)}
                  onChange={({ detail }) => {
                    const next = assessment.priorities || [];
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
        {sectionHeader('ESDC Eligibility')}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Eligibility" errorText={hasSubmitted && fieldErrors.esdcEligibility ? fieldErrors.esdcEligibility : undefined}
            description="Select the client's eligibility category for ESDC funding. This is required for reporting and program compliance.">
            <Select
              selectedOption={ESDC_OPTIONS.find(o => o.value === assessment.esdcEligibility) || null}
              onChange={({ detail }) => handleField('esdcEligibility', detail.selectedOption.value)}
              options={ESDC_OPTIONS}
              placeholder="Select eligibility"
              ariaLabel="Eligibility"
              data-error-focus={hasSubmitted && fieldErrors.esdcEligibility ? 'true' : undefined}
              tabIndex={-1}
              disabled={isAssessmentDisabled}
            />
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
        {sectionHeader('Optional Reporting Details')}
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
                <Button size="small" onClick={() => handleField('interventionCost', calculatedFundingTotal)}>
                  Use {calculatedFundingTotal}
                </Button>
              ) : null
            }
          >
            <Input
              inputMode="numeric"
              value={assessment.interventionCost || ''}
              onChange={({ detail }) => handleField('interventionCost', detail.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 4200"
              data-error-focus={hasSubmitted && fieldErrors.interventionCost ? 'true' : undefined}
              disabled={isAssessmentDisabled}
            />
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
        {sectionHeader("Coordinator's Recommendation")}
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
      </Box>
    </BoardItem>
  );
};

export default CoordinatorAssessmentWidget;




