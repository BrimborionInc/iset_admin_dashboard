import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../auth/apiClient';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  Table,
  Box,
  Button,
  ButtonDropdown,
  SpaceBetween,
  Alert,
  Link,
  Modal,
  FormField,
  Input,
  CollectionPreferences,
  Tabs,
  StatusIndicator,
  Select,
  Multiselect,
  Hotspot,
  TextFilter
} from '@cloudscape-design/components';
import SupportingDocumentsHelp from '../helpPanelContents/supportingDocumentsHelp';
import { useCaseWorkspace } from '../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx';
import { closePendingDocumentWindow, navigateDocumentWindow, openPendingDocumentWindow } from '../utils/documentOpen';
import useCurrentUser from '../hooks/useCurrentUser';
import { getRoleGroups } from '../utils/rbac';
import { resolveApplicationStateFields } from '../utils/applicationStatus';
import { formatInterventionStatusLabel, resolveInterventionStateFields } from '../utils/interventionStatus';

const REFRESH_EVENT = 'iset:supporting-documents:refresh';
const OPEN_UPLOAD_EVENT = 'iset:supporting-documents:open-upload';
const CASE_DOCUMENT_SCOPES = new Set(['client', 'case', 'action_plan', 'application']);

const PREFERENCES_STORAGE_KEY = 'supporting-documents-table-preferences-v3';
const COLUMN_WIDTHS_STORAGE_KEY = 'supporting-documents-table-widths-v2';
const ALL_COLUMN_IDS = ['label', 'uploaded_at', 'file_name', 'case_number', 'scope', 'source', 'actions'];
const REQUIRED_COLUMN_IDS = ['actions'];
const DEFAULT_VISIBLE_COLUMN_IDS = ['label', 'uploaded_at', 'source', 'actions'];
const DOCUMENT_TYPE_PLACEHOLDER_OPTION = { value: '', label: 'Select document type', scope: '' };

const formatDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
};

const normalizeSortText = value => String(value || '').trim().toLowerCase();

const toSortTimestamp = value => {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
};

const buildVisibleColumnOrder = ids => {
  const visibleSet = new Set([...(Array.isArray(ids) ? ids : []), ...REQUIRED_COLUMN_IDS]);
  return ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
};

const parseMetadata = value => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const SOURCE_LABELS = {
  application_submission: 'Applicant upload',
  secure_message_attachment: 'Secure message attachment',
  manual_upload: 'Staff upload',
  system_generated: 'PATH generated'
};
const STAFF_REASSIGNABLE_DOCUMENT_SOURCES = new Set(['manual_upload', 'legacy_intake_upload']);

const hasSourceBoundDocumentLineage = item => {
  if (item?.origin_message_id) return true;
  const source = String(item?.source || '').trim().toLowerCase();
  return !STAFF_REASSIGNABLE_DOCUMENT_SOURCES.has(source);
};

const formatSourceLabel = item => {
  const source = item?.source;
  if (!source) return '';
  const normalized = String(source).trim().toLowerCase();
  if (!normalized) return '';
  const metadata = parseMetadata(item?.metadata);
  const generatedKind = String(
    metadata?.generated_kind || metadata?.generatedKind || metadata?.display_source || ''
  )
    .trim()
    .toLowerCase();
  if (generatedKind === 'signed_form') return 'Signed form';
  if (normalized === 'system_generated') {
    const label = String(item?.label || metadata?.label || '').toLowerCase();
    if (label.includes('(signed)')) return 'Signed form';
  }
  return SOURCE_LABELS[normalized] || normalized.replace(/_/g, ' ');
};

const formatApplicationStatus = value => {
  if (!value) return '';
  const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['rejected', 'declined', 'denied', 'not_approved'].includes(normalized)) return 'Denied';
  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
};

const formatApplicationStatusTag = value => formatApplicationStatus(value) || undefined;
const formatInterventionStatusTag = value => {
  const label = formatInterventionStatusLabel(value);
  return label && label !== '-' ? label : undefined;
};
const buildStatusTag = label => (label ? [label] : undefined);

const buildInterventionDocumentOption = (intervention, planLabel, planId) => {
  if (!intervention?.id) return null;
  const interventionState = resolveInterventionStateFields(intervention, { fallbackStatus: null });
  return {
    value: String(intervention.id),
    label: intervention.title || intervention.code || `Intervention ${intervention.id}`,
    description: planLabel ? `Plan: ${planLabel}` : undefined,
    status: interventionState.effectiveStatus || intervention.status || null,
    review_status: interventionState.reviewStatus || null,
    delivery_status: interventionState.deliveryStatus || null,
    planId,
  };
};

const normalizeIdList = list =>
  Array.from(new Set((Array.isArray(list) ? list : []).map(value => String(value)).filter(Boolean)))
    .sort();

const hasDocumentAssociationChanged = ({
  document,
  scope,
  usesApplicationFallback,
  applicationId,
  actionPlanId,
  interventionIds,
}) => {
  const originalApplicationId = document?.application_id ? String(document.application_id) : '';
  const originalActionPlanId = document?.action_plan_id ? String(document.action_plan_id) : '';
  const originalInterventionIds = normalizeIdList(document?.intervention_ids);
  const normalizedInterventionIds = normalizeIdList(interventionIds);

  if (scope === 'application' && !usesApplicationFallback) {
    return Boolean(applicationId && applicationId !== originalApplicationId);
  }
  if (scope === 'application' || scope === 'action_plan') {
    return (
      (actionPlanId || '') !== originalActionPlanId ||
      JSON.stringify(normalizedInterventionIds) !== JSON.stringify(originalInterventionIds)
    );
  }
  return false;
};

const SCOPE_LABELS = {
  client: 'Client',
  application: 'Application',
  case: 'Case',
  action_plan: 'Action plan',
  payment_packet: 'Payment packet'
};

const formatScopeLabel = scope => SCOPE_LABELS[scope] || 'Application';

const ModalScopeHint = ({ children }) => (
  <Box variant="small" color="text-body-secondary">
    {children}
  </Box>
);

const SupportingDocumentsWidget = ({ actions, caseData: propCaseData, toggleHelpPanel }) => {
  const workspace = useCaseWorkspace();
  const { role: currentUserRole } = useCurrentUser();
  const {
    isAdminRole: canDownloadOriginalDocuments,
    isSystemAdministratorRole,
  } = getRoleGroups(currentUserRole);
  const caseData = useMemo(() => {
    if (propCaseData) return propCaseData;
    if (workspace && typeof workspace === 'object') {
      if (workspace.caseData) return workspace.caseData;
    }
    return null;
  }, [propCaseData, workspace]);
  const isCaseWorkspace = Boolean(workspace?.caseData);
  const selectedInterventionId = workspace?.selectedInterventionId ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiFetch('/api/document-types');
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        const opts = Array.isArray(data?.items)
          ? data.items
              .filter(d => d && d.code)
              .map(d => ({
                value: d.code,
                label: d.label || d.code,
                scope: d.scope || 'application'
              }))
          : [];
        const list = [DOCUMENT_TYPE_PLACEHOLDER_OPTION, ...opts];
        setDocumentTypeOptions(list);
      } catch (_) {
        setDocumentTypeOptions([DOCUMENT_TYPE_PLACEHOLDER_OPTION]);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const [applicationOptions, setApplicationOptions] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingDownloads, setPendingDownloads] = useState({});
  const [pendingOriginalDownloads, setPendingOriginalDownloads] = useState({});
  const [documentTypeOptions, setDocumentTypeOptions] = useState([DOCUMENT_TYPE_PLACEHOLDER_OPTION]);
  const [labelModalVisible, setLabelModalVisible] = useState(false);
  const [pendingLabel, setPendingLabel] = useState('');
  const [labelError, setLabelError] = useState('');
  const [pendingDeletes, setPendingDeletes] = useState({});
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleteRefused, setDeleteRefused] = useState(false);
  const [pendingRestores, setPendingRestores] = useState({});
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreError, setRestoreError] = useState('');
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState(null);
  const [downloadConfirm, setDownloadConfirm] = useState('');
  const [activeTabId, setActiveTabId] = useState('documents');
  const isDeletedView = activeTabId === 'deleted';
  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState(null);
  const [missingRequiredCount, setMissingRequiredCount] = useState(0);
  const [checklistGateLabel, setChecklistGateLabel] = useState('');
  const visibleChecklistItems = useMemo(
    () => checklistItems.filter(item => item.required !== false),
    [checklistItems]
  );
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editLabelError, setEditLabelError] = useState('');
  const [editDocument, setEditDocument] = useState(null);
  const [editCategory, setEditCategory] = useState('');
  const [editCategoryError, setEditCategoryError] = useState('');
  const [editApplicationId, setEditApplicationId] = useState('');
  const [editActionPlanId, setEditActionPlanId] = useState('');
  const [editInterventionIds, setEditInterventionIds] = useState([]);
  const [editAttachError, setEditAttachError] = useState('');
  const [pendingCategory, setPendingCategory] = useState('');
  const [pendingCategoryError, setPendingCategoryError] = useState('');
  const [pendingApplication, setPendingApplication] = useState('');
  const [pendingApplicationError, setPendingApplicationError] = useState('');
  const [pendingActionPlan, setPendingActionPlan] = useState('');
  const [pendingActionPlanError, setPendingActionPlanError] = useState('');
  const [pendingInterventions, setPendingInterventions] = useState([]);
  const [selectedApplicationFilter, setSelectedApplicationFilter] = useState('');
  const [selectedInterventionFilter, setSelectedInterventionFilter] = useState('');
  const [documentFilteringText, setDocumentFilteringText] = useState('');
  const [interventionSelectionMode, setInterventionSelectionMode] = useState('auto');
  const lastInterventionContextRef = useRef('');
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [duplicateDocument, setDuplicateDocument] = useState(null);
  const [duplicateLabel, setDuplicateLabel] = useState('');
  const [duplicateCategory, setDuplicateCategory] = useState('');
  const [duplicateApplicationId, setDuplicateApplicationId] = useState('');
  const [duplicateActionPlanId, setDuplicateActionPlanId] = useState('');
  const [duplicateInterventionIds, setDuplicateInterventionIds] = useState([]);
  const [duplicateError, setDuplicateError] = useState('');
  const [duplicateSubmitting, setDuplicateSubmitting] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const defaultVisibleColumns = buildVisibleColumnOrder(DEFAULT_VISIBLE_COLUMN_IDS);
    if (typeof window === 'undefined') return defaultVisibleColumns;
    try {
      const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (!raw) return defaultVisibleColumns;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaultVisibleColumns;
      const stored = Array.isArray(parsed.visibleColumns)
        ? parsed.visibleColumns.filter(id => ALL_COLUMN_IDS.includes(id))
        : [];
      const ordered = buildVisibleColumnOrder(stored);
      return ordered.length ? ordered : defaultVisibleColumns;
    } catch (err) {
      console.error('[SupportingDocuments] failed to read table preferences', err);
      return defaultVisibleColumns;
    }
  });
  const [columnWidths, setColumnWidths] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(entry => {
          if (!entry || typeof entry !== 'object') return null;
          const id = typeof entry.id === 'string' ? entry.id : null;
          const width = Number(entry.width);
          if (!id || !Number.isFinite(width)) return null;
          return { id, width };
        })
        .filter(Boolean);
    } catch (err) {
      console.error('[SupportingDocuments] failed to read column widths', err);
      return [];
    }
  });
  const [sortingState, setSortingState] = useState({ columnId: 'uploaded_at', isDescending: true });
  const fileInputRef = useRef(null);
  const nextUploadLabelRef = useRef('');
  const nextUploadCategoryRef = useRef('');
  const nextUploadApplicationIdRef = useRef('');
  const nextUploadActionPlanIdRef = useRef('');
  const nextUploadInterventionIdsRef = useRef([]);
  const applicantUserId =
    caseData?.applicant_user_id ??
    caseData?.applicantUserId ??
    workspace?.applicant_user_id ??
    workspace?.applicantUserId ??
    null;
  const caseId =
    caseData?.id ??
    caseData?.case_id ??
    workspace?.case_id ??
    workspace?.caseId ??
    null;
  const applicationId =
    caseData?.application_id ??
    caseData?.applicationId ??
    workspace?.application_id ??
    workspace?.applicationId ??
    null;
  const caseWorkspaceApplicationId = applicationId ? String(applicationId) : '';
  const isApplicationLessCaseWorkspace = Boolean(isCaseWorkspace && caseId && !caseWorkspaceApplicationId);
  const canUseApplicantDocumentMode = Boolean(applicantUserId) && !isApplicationLessCaseWorkspace;
  const isCaseDocumentMode = Boolean(isCaseWorkspace && caseId && !canUseApplicantDocumentMode);
  const canUploadDocuments = canUseApplicantDocumentMode || isCaseDocumentMode;
  const usesApplicationScopeFallback = useCallback(
    scope => scope === 'application' && isCaseDocumentMode,
    [isCaseDocumentMode]
  );
  const buildApplicationFallbackTarget = useCallback(
    (actionPlanValue, interventionValues) => {
      const nextActionPlanId = String(actionPlanValue || '').trim();
      if (nextActionPlanId) {
        return {
          applicationId: '',
          actionPlanId: nextActionPlanId,
          interventionIds: normalizeIdList(interventionValues),
          caseId: ''
        };
      }
      return {
        applicationId: '',
        actionPlanId: '',
        interventionIds: [],
        caseId: caseId ? String(caseId) : ''
      };
    },
    [caseId]
  );
  const applyClientScopeContext = useCallback(
    (payload, item = null) => {
      const nextCaseId = caseId ? String(caseId) : item?.case_id ? String(item.case_id) : '';
      if (nextCaseId) {
        payload.caseId = nextCaseId;
        return true;
      }
      const nextApplicationId = applicationId
        ? String(applicationId)
        : item?.application_id
          ? String(item.application_id)
          : '';
      if (nextApplicationId) {
        payload.applicationId = nextApplicationId;
        return true;
      }
      const nextActionPlanId = item?.action_plan_id ? String(item.action_plan_id) : '';
      if (nextActionPlanId) {
        payload.actionPlanId = nextActionPlanId;
        return true;
      }
      return false;
    },
    [applicationId, caseId]
  );
  const uploadBlockedMessage = isCaseDocumentMode
    ? 'Unable to upload until a case is selected.'
    : 'Unable to upload until an applicant is selected.';
  const widgetTitle = isCaseDocumentMode ? 'Case Documents' : 'Supporting Documents';
  const widgetSummary = isCaseDocumentMode
    ? 'View and manage documents attached to this client file.'
    : 'This widget displays documents related to the applicant, including application, action plan, payment packet, and secure message attachments.';
  const interventionOptions = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    const options = [];
    plans.forEach(plan => {
      if (!plan?.id) return;
      const planId = String(plan.id);
      const planLabel = plan?.title || plan?.name || '';
      const list = Array.isArray(plan?.interventions) ? plan.interventions : [];
      list.forEach(intervention => {
        const option = buildInterventionDocumentOption(intervention, planLabel, planId);
        if (option) {
          options.push(option);
        }
      });
    });
    return options;
  }, [caseData]);
  const interventionOptionMap = useMemo(() => {
    const map = new Map();
    interventionOptions.forEach(option => {
      map.set(String(option.value), option);
    });
    return map;
  }, [interventionOptions]);
  const actionPlanOptions = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans
      .filter(plan => plan?.id)
      .map(plan => ({
        value: String(plan.id),
        label: plan.title || plan.name || `Action plan ${plan.id}`,
        description: plan.status ? formatApplicationStatus(plan.status) : undefined
      }));
  }, [caseData]);
  const actionPlanOptionMap = useMemo(() => {
    const map = new Map();
    actionPlanOptions.forEach(option => {
      map.set(String(option.value), option);
    });
    return map;
  }, [actionPlanOptions]);
  const actionPlanInterventionMap = useMemo(() => {
    const map = new Map();
    const plans = caseData?.actionPlans || [];
    plans.forEach(plan => {
      if (!plan?.id) return;
      const planId = String(plan.id);
      const planLabel = plan?.title || plan?.name || '';
      const list = Array.isArray(plan?.interventions) ? plan.interventions : [];
      const options = list
        .map(intervention => buildInterventionDocumentOption(intervention, planLabel, planId))
        .filter(Boolean);
      map.set(planId, options);
    });
    return map;
  }, [caseData]);
  const interventionPlanMap = useMemo(() => {
    const map = new Map();
    const plans = caseData?.actionPlans || [];
    plans.forEach(plan => {
      if (!plan?.id) return;
      const planId = String(plan.id);
      const list = Array.isArray(plan?.interventions) ? plan.interventions : [];
      list.forEach(intervention => {
        if (!intervention?.id) return;
        map.set(String(intervention.id), planId);
      });
    });
    return map;
  }, [caseData]);

  const resolveDocumentType = useCallback(item => {
    if (!item) return '';
    if (typeof item.document_category === 'string' && item.document_category) {
      return item.document_category;
    }
    const meta = parseMetadata(item.metadata);
    if (meta && typeof meta.document_type === 'string') {
      return meta.document_type;
    }
    return '';
  }, []);
  const loadApplicantApplications = useCallback(async () => {
    if (!applicantUserId) {
      setApplicationOptions([]);
      return;
    }
    setApplicationsLoading(true);
    try {
      const res = await apiFetch(`/api/applicants/${applicantUserId}/applications`);
      if (!res.ok) throw new Error('Failed to load applications');
      const payload = await res.json().catch(() => ({ items: [] }));
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const opts = items
        .filter(item => item && item.applicationId)
        .map(item => {
          const applicationState = resolveApplicationStateFields(item);
          const value = String(item.applicationId);
          const reference = item.referenceNumber || item.caseNumber || value;
          const label = isCaseWorkspace
            ? item.caseNumber
              ? `Case ${item.caseNumber}`
              : `Application ${reference}`
            : `Application ${reference}`;
          const description = isCaseWorkspace
            ? item.caseNumber && item.referenceNumber
              ? `Application ${item.referenceNumber}`
              : null
            : formatApplicationStatus(applicationState.applicationStatus) || null;
          return {
            value,
            label,
            description: description || undefined,
            status: applicationState.applicationStatus || null
          };
        });
      // Ensure the current workspace application appears as an option even if not returned
      if (applicationId && !opts.find(opt => opt.value === String(applicationId))) {
        opts.unshift({
          value: String(applicationId),
          label: `Application ${applicationId}`,
          description: 'Workspace application'
        });
      }
      setApplicationOptions(opts);
    } catch (err) {
      console.error('[SupportingDocuments] failed to load applications', err);
      setApplicationOptions([]);
    } finally {
      setApplicationsLoading(false);
    }
  }, [applicantUserId, applicationId, isCaseWorkspace]);
  const availableDocumentTypeOptions = useMemo(() => {
    if (!isCaseDocumentMode) {
      return documentTypeOptions;
    }
    const filtered = documentTypeOptions.filter(
      opt => !opt?.value || CASE_DOCUMENT_SCOPES.has(opt.scope || 'application')
    );
    return filtered.length ? filtered : [DOCUMENT_TYPE_PLACEHOLDER_OPTION];
  }, [documentTypeOptions, isCaseDocumentMode]);
  const getDocumentTypeScope = useCallback(
    code => {
      if (!code) return '';
      const match = documentTypeOptions.find(opt => opt.value === code);
      return match?.scope || 'application';
    },
    [documentTypeOptions]
  );
  const persistPreferences = useCallback(
    nextVisibleColumns => {
      if (typeof window === 'undefined') return;
      try {
        const ordered = buildVisibleColumnOrder(
          (nextVisibleColumns || []).filter(id => ALL_COLUMN_IDS.includes(id))
        );
        const payload = { visibleColumns: ordered };
        window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.error('[SupportingDocuments] failed to persist table preferences', err);
      }
    },
    []
  );

  const persistColumnWidths = useCallback(widths => {
    if (typeof window === 'undefined') return;
    try {
      if (!Array.isArray(widths) || !widths.length) {
        window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
        return;
      }
      const payload = widths
        .map(entry => {
          if (!entry || typeof entry !== 'object') return null;
          const id = typeof entry.id === 'string' ? entry.id : null;
          const width = Number(entry.width);
          if (!id || !Number.isFinite(width)) return null;
          return { id, width };
        })
        .filter(Boolean);
      if (payload.length) {
        window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(payload));
      } else {
        window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
      }
    } catch (err) {
      console.error('[SupportingDocuments] failed to persist column widths', err);
    }
  }, []);

  const loadDocuments = useCallback(
    async (options = {}) => {
      const { silent = false, applicationId: applicationIdOverride, interventionId: interventionIdOverride } = options;
      const filterInterventionId =
        typeof interventionIdOverride === 'string' || typeof interventionIdOverride === 'number'
          ? String(interventionIdOverride || '')
          : selectedInterventionFilter;
      const filterApplicationId =
        typeof applicationIdOverride === 'string' || typeof applicationIdOverride === 'number'
          ? String(applicationIdOverride || '')
          : selectedApplicationFilter;
      if (!canUploadDocuments) {
        setDocuments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams();
        if (isCaseWorkspace && filterInterventionId) {
          params.set('interventionId', filterInterventionId);
        } else if (isCaseWorkspace && caseId) {
          params.set('caseId', String(caseId));
        } else if (!isCaseWorkspace && filterApplicationId) {
          params.set('applicationId', filterApplicationId);
        } else if (!isCaseWorkspace && caseId) {
          params.set('caseId', String(caseId));
        } else if (!isCaseWorkspace && applicationId) {
          params.set('applicationId', String(applicationId));
        }
        if (isDeletedView) {
          params.set('view', 'deleted');
        }
        const query = params.toString() ? `?${params.toString()}` : '';
        const endpoint = canUseApplicantDocumentMode
          ? `/api/applicants/${applicantUserId}/documents${query}`
          : `/api/cases/${caseId}/documents${query}`;
        const res = await apiFetch(endpoint);
        if (!res.ok) throw new Error(`Failed to load ${isCaseDocumentMode ? 'case documents' : 'supporting documents'}`);
        const data = await res.json().catch(() => []);
        setDocuments(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err?.message || `Failed to load ${isCaseDocumentMode ? 'case documents' : 'supporting documents'}`);
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [
      applicantUserId,
      canUploadDocuments,
      canUseApplicantDocumentMode,
      caseId,
      applicationId,
      isCaseDocumentMode,
      isCaseWorkspace,
      isDeletedView,
      selectedApplicationFilter,
      selectedInterventionFilter,
    ]
  );

  const loadChecklist = useCallback(async () => {
    if (!canUseApplicantDocumentMode) {
      setChecklistItems([]);
      setMissingRequiredCount(0);
      setChecklistGateLabel('');
      setChecklistError(null);
      setChecklistLoading(false);
      return;
    }
    const selectedIntervention =
      isCaseWorkspace && selectedInterventionFilter
        ? interventionOptions.find(opt => opt.value === selectedInterventionFilter) || null
        : null;
    if (isCaseWorkspace && !selectedIntervention) {
      setChecklistItems([]);
      setMissingRequiredCount(0);
      setChecklistGateLabel('');
      setChecklistLoading(false);
      return;
    }
    setChecklistLoading(true);
    setChecklistError(null);
    try {
      const params = new URLSearchParams();
      if (isCaseWorkspace && selectedIntervention?.value) {
        params.set('interventionId', selectedIntervention.value);
        const statusValue = String(selectedIntervention.review_status || selectedIntervention.status || '').toLowerCase();
        const stage = statusValue && statusValue !== 'draft' ? 'submitted' : 'draft';
        params.set('stage', stage);
      } else if (applicationId) {
        params.set('applicationId', String(applicationId));
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`/api/applicants/${applicantUserId}/document-checklist${query}`);
      if (!res.ok) throw new Error('Failed to load checklist');
      const payload = await res.json().catch(() => ({ items: [], missingRequiredCount: 0 }));
      setChecklistItems(Array.isArray(payload.items) ? payload.items : []);
      setMissingRequiredCount(Number(payload.missingRequiredCount) || 0);
      setChecklistGateLabel(typeof payload.gateLabel === 'string' ? payload.gateLabel : '');
    } catch (err) {
      setChecklistError(err?.message || 'Failed to load checklist');
      setChecklistGateLabel('');
    } finally {
      setChecklistLoading(false);
    }
  }, [applicantUserId, applicationId, canUseApplicantDocumentMode, interventionOptions, isCaseWorkspace, selectedInterventionFilter]);

  useEffect(() => {
    if (!canUploadDocuments) {
      setDocuments([]);
      setLoading(false);
      setRefreshing(false);
      setChecklistItems([]);
      setMissingRequiredCount(0);
      setChecklistGateLabel('');
      setChecklistError(null);
      setChecklistLoading(false);
      return;
    }
    loadDocuments();
    loadChecklist();
  }, [canUploadDocuments, loadDocuments, loadChecklist]);

  useEffect(() => {
    if (!canUseApplicantDocumentMode) {
      setApplicationOptions([]);
      setSelectedApplicationFilter('');
      setPendingApplication('');
      return;
    }
    if (!isCaseWorkspace) {
      setSelectedApplicationFilter('');
    }
    setPendingApplication(applicationId ? String(applicationId) : '');
    loadApplicantApplications();
  }, [canUseApplicantDocumentMode, applicationId, isCaseWorkspace, loadApplicantApplications]);

  useEffect(() => {
    if (!isCaseWorkspace) {
      setSelectedInterventionFilter('');
      setPendingActionPlan('');
      setPendingInterventions([]);
      setInterventionSelectionMode('auto');
      lastInterventionContextRef.current = '';
      return;
    }
    if (selectedInterventionId) {
      const value = String(selectedInterventionId);
      const previous = lastInterventionContextRef.current;
      const shouldSync =
        interventionSelectionMode !== 'manual' ||
        selectedInterventionFilter === previous ||
        selectedInterventionFilter === value;
      if (shouldSync) {
        setSelectedInterventionFilter(value);
        setPendingInterventions([value]);
        const planId = interventionPlanMap.get(value) || '';
        setPendingActionPlan(planId);
        setInterventionSelectionMode('auto');
      }
      lastInterventionContextRef.current = value;
      return;
    }
    if (!selectedInterventionFilter && interventionOptions.length && interventionSelectionMode !== 'manual') {
      setSelectedInterventionFilter(interventionOptions[0].value);
    }
  }, [
    isCaseWorkspace,
    selectedInterventionId,
    selectedInterventionFilter,
    interventionOptions,
    interventionSelectionMode,
    interventionPlanMap
  ]);

  useEffect(() => {
    if (!canUploadDocuments || typeof window === 'undefined') return;
    const handler = event => {
      const targetApplicant = event?.detail?.applicantUserId;
      const targetCase = event?.detail?.caseId;
      if (targetApplicant && applicantUserId && String(targetApplicant) !== String(applicantUserId)) return;
      if (targetCase && caseId && String(targetCase) !== String(caseId)) return;
      loadDocuments({ silent: true });
      if (canUseApplicantDocumentMode) {
        loadChecklist();
      }
    };
    window.addEventListener(REFRESH_EVENT, handler);
    return () => {
      window.removeEventListener(REFRESH_EVENT, handler);
    };
  }, [applicantUserId, canUploadDocuments, canUseApplicantDocumentMode, caseId, loadDocuments, loadChecklist]);

  useEffect(() => {
    if (canUseApplicantDocumentMode || activeTabId !== 'checklist') return;
    setActiveTabId('documents');
  }, [activeTabId, canUseApplicantDocumentMode]);

  const handleViewDocument = useCallback(
    async item => {
      const documentId = item?.id;
      if (!documentId) return;
      const pendingWindow = openPendingDocumentWindow();
      setError(null);
      setPendingDownloads(prev => ({ ...prev, [documentId]: true }));
      try {
        const res = await apiFetch(`/api/documents/${documentId}/presign-download`);
        if (!res || !res.ok) {
          const payload = await res?.json?.().catch(() => null);
          const message =
            payload?.message ||
            (res && res.status === 404 ? 'Document not found' : 'Failed to prepare download');
          throw new Error(message);
        }
        const payload = await res.json().catch(() => null);
        if (!payload) throw new Error('Invalid download response');
        const targetUrl = payload.presigned?.url || '';
        if (!targetUrl) {
          throw new Error('Document download unavailable');
        }
        if (!navigateDocumentWindow(pendingWindow, targetUrl)) {
          throw new Error('Document preview was blocked by the browser. Allow pop-ups for PATH and try again.');
        }
      } catch (err) {
        closePendingDocumentWindow(pendingWindow);
        console.error('[SupportingDocumentsWidget] document open failed', err);
        setError(err?.message || 'Failed to open document');
      } finally {
        setPendingDownloads(prev => {
          const next = { ...prev };
          delete next[documentId];
          return next;
        });
      }
    },
    []
  );
  const openDownloadModal = useCallback(item => {
    if (!canDownloadOriginalDocuments || !item?.id) return;
    setDownloadTarget(item);
    setDownloadConfirm('');
    setDownloadModalVisible(true);
  }, [canDownloadOriginalDocuments]);
  const handleDownloadCancel = useCallback(() => {
    setDownloadModalVisible(false);
    setDownloadTarget(null);
    setDownloadConfirm('');
  }, []);
  const handleDownloadConfirm = useCallback(async () => {
    const documentId = downloadTarget?.id;
    if (!documentId) {
      handleDownloadCancel();
      return;
    }
    const pendingWindow = openPendingDocumentWindow('Please wait while PATH prepares the original file download.');
    setError(null);
    setPendingOriginalDownloads(prev => ({ ...prev, [documentId]: true }));
    try {
      const res = await apiFetch(`/api/documents/${encodeURIComponent(documentId)}/presign-download?mode=original`);
      if (!res || !res.ok) {
        const payload = await res?.json?.().catch(() => null);
        const message =
          payload?.message ||
          (res && res.status === 403
            ? 'Only System Administrators and NWAC Administrators can download original files.'
            : (res && res.status === 404 ? 'Document not found' : 'Failed to prepare document download'));
        throw new Error(message);
      }
      const payload = await res.json().catch(() => null);
      if (!payload) throw new Error('Invalid download response');
      const targetUrl = payload.presigned?.url || '';
      if (!targetUrl) {
        throw new Error('Document download unavailable');
      }
      if (!navigateDocumentWindow(pendingWindow, targetUrl)) {
        throw new Error('Original file download was blocked by the browser. Allow pop-ups for PATH and try again.');
      }
      handleDownloadCancel();
    } catch (err) {
      closePendingDocumentWindow(pendingWindow);
      setError(err?.message || 'Failed to download original document');
    } finally {
      setPendingOriginalDownloads(prev => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
    }
  }, [downloadTarget, handleDownloadCancel]);
  const openLabelModal = useCallback(() => {
    if (uploading) return;
    if (!canUploadDocuments) {
      setError(uploadBlockedMessage);
      return;
    }
    setLabelError('');
    setPendingApplicationError('');
    setPendingActionPlanError('');
    setPendingCategoryError('');
    if (!availableDocumentTypeOptions.some(opt => opt.value === pendingCategory)) {
      setPendingCategory('');
    }
    const initialApplication = canUseApplicantDocumentMode
      ? selectedApplicationFilter ||
        (applicationId ? String(applicationId) : '') ||
        (applicationOptions.length === 1 ? applicationOptions[0].value : '')
      : '';
    setPendingApplication(canUseApplicantDocumentMode ? initialApplication || '' : '');
    if (isCaseWorkspace) {
      const initialIntervention =
        selectedInterventionFilter ||
        (selectedInterventionId ? String(selectedInterventionId) : '') ||
        (interventionOptions.length === 1 ? interventionOptions[0].value : '');
      const initialPlan =
        (initialIntervention && interventionPlanMap.get(initialIntervention)) ||
        (actionPlanOptions.length === 1 ? actionPlanOptions[0].value : '');
      setPendingActionPlan(initialPlan || '');
      if (initialPlan && initialIntervention) {
        const allowed = new Set(
          (actionPlanInterventionMap.get(String(initialPlan)) || []).map(opt => opt.value)
        );
        setPendingInterventions(allowed.has(initialIntervention) ? [initialIntervention] : []);
      } else if (initialIntervention) {
        setPendingInterventions([initialIntervention]);
      } else {
        setPendingInterventions([]);
      }
    } else {
      setPendingActionPlan('');
      setPendingInterventions([]);
    }
    setLabelModalVisible(true);
    setPendingLabel(prev => prev || '');
  }, [
    canUploadDocuments,
    uploading,
    isCaseWorkspace,
    canUseApplicantDocumentMode,
    selectedApplicationFilter,
    selectedInterventionFilter,
    selectedInterventionId,
    applicationId,
    applicationOptions,
    availableDocumentTypeOptions,
    interventionOptions,
    actionPlanOptions,
    actionPlanInterventionMap,
    interventionPlanMap,
    pendingCategory,
    uploadBlockedMessage,
  ]);
  useEffect(() => {
    if (!canUploadDocuments || typeof window === 'undefined') return undefined;
    const handler = event => {
      const targetApplicant = event?.detail?.applicantUserId;
      const targetCase = event?.detail?.caseId;
      if (targetApplicant && applicantUserId && String(targetApplicant) !== String(applicantUserId)) return;
      if (targetCase && caseId && String(targetCase) !== String(caseId)) return;
      openLabelModal();
    };
    window.addEventListener(OPEN_UPLOAD_EVENT, handler);
    return () => {
      window.removeEventListener(OPEN_UPLOAD_EVENT, handler);
    };
  }, [applicantUserId, canUploadDocuments, caseId, openLabelModal]);
  const handleLabelModalDismiss = useCallback(() => {
    setLabelModalVisible(false);
    setLabelError('');
    setPendingApplicationError('');
    setPendingActionPlanError('');
    setPendingCategoryError('');
  }, []);
  const handleLabelConfirm = useCallback(() => {
    const trimmed = (pendingLabel || '').trim();
    const categoryTrimmed = (pendingCategory || '').trim();
    if (!trimmed) {
      setLabelError('Enter a document label.');
      return;
    }
    if (!categoryTrimmed) {
      setPendingCategoryError('Select a document type.');
      return;
    }
    const scope = getDocumentTypeScope(categoryTrimmed);
    let targetApplicationId = '';
    let targetActionPlanId = '';
    let targetInterventionIds = [];
    if (scope === 'application') {
      if (canUseApplicantDocumentMode) {
        targetApplicationId = (pendingApplication || '').trim();
        if (!targetApplicationId) {
          setPendingApplicationError('Select which application this document should be attached to.');
          return;
        }
      } else {
        const fallbackTarget = buildApplicationFallbackTarget(pendingActionPlan, pendingInterventions);
        targetActionPlanId = fallbackTarget.actionPlanId;
        targetInterventionIds = fallbackTarget.interventionIds;
        if (!targetActionPlanId && !fallbackTarget.caseId) {
          setLabelError('This document must be attached to a case or action plan.');
          return;
        }
      }
    }
    if (scope === 'case') {
      if (!caseId) {
        setLabelError('This document type must be attached to a case.');
        return;
      }
    }
    if (scope === 'client' && !caseId && !applicationId) {
      setLabelError('Unable to determine which case or application should validate this client document.');
      return;
    }
    if (scope === 'action_plan') {
      targetActionPlanId = (pendingActionPlan || '').trim();
      if (!targetActionPlanId) {
        setPendingActionPlanError('Select which action plan this document should be attached to.');
        return;
      }
      targetInterventionIds = normalizeIdList(pendingInterventions);
    }
    nextUploadLabelRef.current = trimmed;
    nextUploadCategoryRef.current = categoryTrimmed;
    nextUploadApplicationIdRef.current =
      targetApplicationId || (scope === 'client' && !caseId && applicationId ? String(applicationId) : '');
    nextUploadActionPlanIdRef.current = targetActionPlanId || '';
    nextUploadInterventionIdsRef.current = targetInterventionIds;
    setLabelError('');
    setPendingCategoryError('');
    setPendingApplicationError('');
    setPendingActionPlanError('');
    setLabelModalVisible(false);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [
    pendingLabel,
    pendingCategory,
    pendingApplication,
    pendingActionPlan,
    pendingInterventions,
    canUseApplicantDocumentMode,
    buildApplicationFallbackTarget,
    getDocumentTypeScope,
    applicationId,
    caseId
  ]);
  const handleFileSelected = useCallback(
    async event => {
      const input = event?.target;
      const file = input?.files?.[0] || null;
      if (input) {
        input.value = '';
      }
      if (!file) return;
      if (!canUploadDocuments) {
        setError(uploadBlockedMessage);
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (caseId) formData.append('caseId', caseId);
        const applicationIdForUpload = (nextUploadApplicationIdRef.current || '').trim();
        if (applicationIdForUpload) formData.append('applicationId', applicationIdForUpload);
        const actionPlanIdForUpload = (nextUploadActionPlanIdRef.current || '').trim();
        if (actionPlanIdForUpload) formData.append('actionPlanId', actionPlanIdForUpload);
        const interventionIdsForUpload = nextUploadInterventionIdsRef.current;
        if (Array.isArray(interventionIdsForUpload) && interventionIdsForUpload.length) {
          formData.append('interventionIds', JSON.stringify(interventionIdsForUpload));
        }
        const labelForUpload = (nextUploadLabelRef.current || '').trim() || file.name;
        formData.append('label', labelForUpload);
        const categoryForUpload = (nextUploadCategoryRef.current || '').trim();
        if (categoryForUpload) formData.append('documentType', categoryForUpload);
        const uploadPath = canUseApplicantDocumentMode
          ? `/api/applicants/${applicantUserId}/documents/upload`
          : `/api/cases/${caseId}/documents/upload`;
        const response = await apiFetch(uploadPath, {
          method: 'POST',
          body: formData
        });
        if (!response || !response.ok) {
          let payload = null;
          if (response && typeof response.json === 'function') {
            try {
              payload = await response.json();
            } catch (_) {
              payload = null;
            }
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
          if (errorCode === 'invalid_applicant_id') {
            throw new Error('Unable to determine which applicant this upload belongs to.');
          }
          if (errorCode === 'invalid_case_id') {
            throw new Error('Unable to determine which case this upload belongs to.');
          }
          if (errorCode === 'client_id_required') {
            throw new Error('Unable to determine which client this document belongs to.');
          }
          if (errorCode === 'application_required_for_document') {
            throw new Error('Select an application for this document type before uploading.');
          }
          if (errorCode === 'case_required_for_document') {
            throw new Error('This document type must be attached to a case.');
          }
          if (errorCode === 'action_plan_required_for_document' || errorCode === 'action_plan_required') {
            throw new Error('Select an action plan for this document type before uploading.');
          }
          if (errorCode === 'interventions_multi_plan' || errorCode === 'interventions_plan_mismatch') {
            throw new Error('Selected interventions must belong to the same action plan.');
          }
          if (errorCode === 'interventions_not_found') {
            throw new Error('One or more selected interventions could not be found.');
          }
          if (errorCode === 'invalid_document_type') {
            throw new Error('The selected document type is not valid or inactive.');
          }
          if (errorCode === 'document_type_lookup_failed') {
            throw new Error('Unable to validate the document type. Try again.');
          }
          throw new Error(payload?.message || 'Failed to upload document.');
        }
        await loadDocuments({ silent: true });
        if (canUseApplicantDocumentMode) {
          await loadChecklist();
        }
      } catch (err) {
        const message = err?.message || 'Failed to upload document.';
        setError(message);
      } finally {
        setUploading(false);
        nextUploadLabelRef.current = '';
        nextUploadCategoryRef.current = '';
        nextUploadApplicationIdRef.current = '';
        nextUploadActionPlanIdRef.current = '';
        nextUploadInterventionIdsRef.current = [];
        setPendingLabel('');
        setPendingCategory('');
        setPendingApplication(canUseApplicantDocumentMode && applicationId ? String(applicationId) : '');
        setPendingActionPlan('');
        setPendingInterventions([]);
      }
    },
    [
      applicantUserId,
      applicationId,
      canUploadDocuments,
      canUseApplicantDocumentMode,
      caseId,
      loadChecklist,
      loadDocuments,
      uploadBlockedMessage,
    ]
  );
  const handleInlineEdit = useCallback(
    async (item, column, newValue) => {
      const columnId = column?.id;
      const nextValue = typeof newValue === 'string' ? newValue : '';
      if (columnId !== 'label') return;
      const trimmed = nextValue.trim();
      if (!trimmed) {
        setError('Document label cannot be empty.');
        return;
      }
      if (!item?.id) {
        setError('Cannot update this document.');
        return;
      }
      setError(null);
      const original = documents;
      setDocuments(prev =>
        Array.isArray(prev) ? prev.map(doc => (doc.id === item.id ? { ...doc, label: trimmed } : doc)) : prev
      );
      try {
        const res = await apiFetch(`/api/documents/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: trimmed })
        });
        if (!res || !res.ok) {
          let payload = null;
          try {
            payload = await res.json();
          } catch (_) {
            payload = null;
          }
          throw new Error(payload?.message || 'Failed to update document label.');
        }
        await loadDocuments({ silent: true });
      } catch (err) {
        setError(err?.message || 'Failed to update document label.');
        setDocuments(original);
        throw err;
      }
    },
    [documents, loadDocuments]
  );

  const openDeleteModal = useCallback(item => {
    if (!item?.id) return;
    if (item.can_delete === false) {
      setError(item.delete_disabled_reason || "PATH needs to keep this document, so it can't be deleted.");
      return;
    }
    setDeleteTarget(item);
    setDeleteError('');
    setDeleteRefused(false);
    setDeleteModalVisible(true);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteModalVisible(false);
    setDeleteTarget(null);
    setDeleteError('');
    setDeleteRefused(false);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget?.id) {
      handleDeleteCancel();
      return;
    }
    setError(null);
    setDeleteError('');
    setPendingDeletes(prev => ({ ...prev, [deleteTarget.id]: true }));
    try {
      const res = await apiFetch(`/api/documents/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res || !res.ok) {
        let payload = null;
        try {
          payload = await res.json();
        } catch (_) {
          payload = null;
        }
        if (payload?.error === 'document_immutable') {
          setDeleteRefused(true);
          setDeleteError(payload?.message || "This document can't be deleted.");
          return;
        }
        setDeleteError(payload?.message || 'The document could not be deleted. Please try again.');
        return;
      }
      await loadDocuments({ silent: true });
      if (canUseApplicantDocumentMode) {
        await loadChecklist();
      }
      handleDeleteCancel();
    } catch (err) {
      setDeleteError(err?.message || 'The document could not be deleted. Please try again.');
    } finally {
      setPendingDeletes(prev => {
        const next = { ...prev };
        if (deleteTarget?.id) {
          delete next[deleteTarget.id];
        }
        return next;
      });
    }
  }, [canUseApplicantDocumentMode, deleteTarget, loadChecklist, loadDocuments, handleDeleteCancel]);

  const openRestoreModal = useCallback(item => {
    if (!item?.id || item.can_restore !== true) return;
    setRestoreTarget(item);
    setRestoreError('');
    setRestoreModalVisible(true);
  }, []);

  const handleRestoreCancel = useCallback(() => {
    setRestoreModalVisible(false);
    setRestoreTarget(null);
    setRestoreError('');
  }, []);

  const handleRestoreConfirm = useCallback(async () => {
    const documentId = restoreTarget?.id;
    if (!documentId) {
      handleRestoreCancel();
      return;
    }
    setRestoreError('');
    setPendingRestores(previous => ({ ...previous, [documentId]: true }));
    try {
      const response = await apiFetch(`/api/documents/${encodeURIComponent(documentId)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await response?.json?.().catch(() => null);
      if (!response?.ok) {
        setRestoreError(payload?.message || 'The document could not be restored. Please try again.');
        return;
      }
      await loadDocuments({ silent: true });
      if (canUseApplicantDocumentMode) {
        await loadChecklist();
      }
      handleRestoreCancel();
    } catch (error) {
      setRestoreError(error?.message || 'The document could not be restored. Please try again.');
    } finally {
      setPendingRestores(previous => {
        const next = { ...previous };
        delete next[documentId];
        return next;
      });
    }
  }, [canUseApplicantDocumentMode, handleRestoreCancel, loadChecklist, loadDocuments, restoreTarget]);

  const openEditModal = useCallback(item => {
    if (!item || !item.id) return;
    const nextType = resolveDocumentType(item);
    const scope = getDocumentTypeScope(nextType);
    let nextApplicationId = item.application_id ? String(item.application_id) : '';
    let nextActionPlanId = item.action_plan_id ? String(item.action_plan_id) : '';
    let nextInterventionIds = normalizeIdList(item.intervention_ids);
    if (scope === 'application') {
      if (!nextApplicationId && !nextActionPlanId && caseWorkspaceApplicationId) {
        nextApplicationId = String(caseWorkspaceApplicationId);
      } else if (!nextApplicationId && !nextActionPlanId && selectedApplicationFilter) {
        nextApplicationId = String(selectedApplicationFilter);
      } else if (!nextApplicationId && !nextActionPlanId && applicationId) {
        nextApplicationId = String(applicationId);
      }
    } else if (scope === 'action_plan') {
      if (!nextActionPlanId && selectedInterventionFilter) {
        nextActionPlanId = interventionPlanMap.get(String(selectedInterventionFilter)) || '';
      } else if (!nextActionPlanId && actionPlanOptions.length === 1) {
        nextActionPlanId = actionPlanOptions[0].value;
      }
      if (!nextInterventionIds.length && selectedInterventionFilter) {
        nextInterventionIds = [String(selectedInterventionFilter)];
      }
      if (nextActionPlanId) {
        const allowed = new Set(
          (actionPlanInterventionMap.get(String(nextActionPlanId)) || []).map(opt => opt.value)
        );
        nextInterventionIds = nextInterventionIds.filter(id => allowed.has(String(id)));
      }
    }
    setEditDocument(item);
    setEditLabel(item.label || item.file_name || '');
    setEditLabelError('');
    setEditCategory(nextType);
    setEditCategoryError('');
    setEditApplicationId(nextApplicationId);
    setEditActionPlanId(nextActionPlanId);
    setEditInterventionIds(nextInterventionIds);
    setEditAttachError('');
    setEditModalVisible(true);
  }, [
    actionPlanInterventionMap,
    actionPlanOptions,
    applicationId,
    caseWorkspaceApplicationId,
    getDocumentTypeScope,
    interventionPlanMap,
    resolveDocumentType,
    selectedApplicationFilter,
    selectedInterventionFilter
  ]);

  const handleEditDismiss = useCallback(() => {
    setEditModalVisible(false);
    setEditDocument(null);
    setEditLabel('');
    setEditLabelError('');
    setEditCategory('');
    setEditCategoryError('');
    setEditApplicationId('');
    setEditActionPlanId('');
    setEditInterventionIds([]);
    setEditAttachError('');
  }, []);

  const handleEditSave = useCallback(async () => {
    const trimmedLabel = (editLabel || '').trim();
    const trimmedType = (editCategory || '').trim();
    if (!trimmedLabel) {
      setEditLabelError('Enter a document label.');
      return;
    }
    if (!trimmedType) {
      setEditCategoryError('Select a document type.');
      return;
    }
    if (!editDocument?.id) {
      setEditLabelError('Missing document reference.');
      return;
    }
    setEditLabelError('');
    setEditCategoryError('');
    setEditAttachError('');
    const scope = getDocumentTypeScope(trimmedType);
    const associationChanged = hasDocumentAssociationChanged({
      document: editDocument,
      scope,
      usesApplicationFallback: usesApplicationScopeFallback(scope),
      applicationId: editApplicationId,
      actionPlanId: editActionPlanId,
      interventionIds: editInterventionIds,
    });
    const detailsChanged =
      trimmedType !== resolveDocumentType(editDocument) || associationChanged;
    const payload = { label: trimmedLabel };
    if (detailsChanged) {
      payload.documentType = trimmedType;
      if (scope === 'application') {
        if (canUseApplicantDocumentMode) {
          const nextApplicationId = (editApplicationId || '').trim();
          if (!nextApplicationId) {
            setEditAttachError('Select which application this document should be attached to.');
            return;
          }
          payload.applicationId = nextApplicationId;
        } else {
          const fallbackTarget = buildApplicationFallbackTarget(editActionPlanId, editInterventionIds);
          if (fallbackTarget.actionPlanId) {
            payload.actionPlanId = fallbackTarget.actionPlanId;
            payload.interventionIds = fallbackTarget.interventionIds;
          } else if (fallbackTarget.caseId) {
            payload.caseId = fallbackTarget.caseId;
          } else {
            setEditAttachError('This document must be attached to a case or action plan.');
            return;
          }
        }
      } else if (scope === 'case') {
        const nextCaseId = caseId ? String(caseId) : editDocument?.case_id ? String(editDocument.case_id) : '';
        if (!nextCaseId) {
          setEditAttachError('This document type must be attached to a case.');
          return;
        }
        payload.caseId = nextCaseId;
      } else if (scope === 'client') {
        if (!applyClientScopeContext(payload, editDocument)) {
          setEditAttachError('Unable to determine which case or application should validate this client document.');
          return;
        }
      } else if (scope === 'action_plan') {
        const nextActionPlanId = (editActionPlanId || '').trim();
        if (!nextActionPlanId) {
          setEditAttachError('Select which action plan this document should be attached to.');
          return;
        }
        payload.actionPlanId = nextActionPlanId;
        payload.interventionIds = normalizeIdList(editInterventionIds);
      }
    }
    try {
      const res = await apiFetch(`/api/documents/${editDocument.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res || !res.ok) {
        let payload = null;
        try {
          payload = await res.json();
        } catch (_) {
          payload = null;
        }
        throw new Error(payload?.message || 'Failed to update document.');
      }
      await loadDocuments({ silent: true });
      if (canUseApplicantDocumentMode) {
        await loadChecklist();
      }
      handleEditDismiss();
    } catch (err) {
      setEditLabelError(err?.message || 'Failed to update document.');
    }
  }, [
    editLabel,
    editCategory,
    editDocument,
    editApplicationId,
    editActionPlanId,
    editInterventionIds,
    applyClientScopeContext,
    buildApplicationFallbackTarget,
    getDocumentTypeScope,
    loadDocuments,
    loadChecklist,
    handleEditDismiss,
    canUseApplicantDocumentMode,
    caseId,
    resolveDocumentType,
    usesApplicationScopeFallback
  ]);

  const openDuplicateModal = useCallback(item => {
    if (!item || !item.id) return;
    const nextType = resolveDocumentType(item);
    const scope = getDocumentTypeScope(nextType);
    let nextApplicationId = '';
    let nextActionPlanId = '';
    let nextInterventionIds = [];
    if (scope === 'application') {
      if (item.application_id) {
        nextApplicationId = String(item.application_id);
      } else if (item.action_plan_id) {
        nextActionPlanId = String(item.action_plan_id);
        nextInterventionIds = normalizeIdList(item.intervention_ids);
      } else if (caseWorkspaceApplicationId) {
        nextApplicationId = String(caseWorkspaceApplicationId);
      } else if (selectedApplicationFilter) {
        nextApplicationId = String(selectedApplicationFilter);
      } else if (applicationId) {
        nextApplicationId = String(applicationId);
      }
    } else if (scope === 'action_plan') {
      if (item.action_plan_id) {
        nextActionPlanId = String(item.action_plan_id);
      } else if (selectedInterventionFilter) {
        nextActionPlanId = interventionPlanMap.get(String(selectedInterventionFilter)) || '';
      } else if (actionPlanOptions.length === 1) {
        nextActionPlanId = actionPlanOptions[0].value;
      }
      nextInterventionIds = normalizeIdList(item.intervention_ids);
      if (!nextInterventionIds.length && selectedInterventionFilter) {
        nextInterventionIds = [String(selectedInterventionFilter)];
      }
      if (nextActionPlanId) {
        const allowed = new Set(
          (actionPlanInterventionMap.get(String(nextActionPlanId)) || []).map(opt => opt.value)
        );
        nextInterventionIds = nextInterventionIds.filter(id => allowed.has(String(id)));
      }
    }
    setDuplicateDocument(item);
    setDuplicateLabel(item.label || item.file_name || '');
    setDuplicateCategory(nextType);
    setDuplicateApplicationId(nextApplicationId);
    setDuplicateActionPlanId(nextActionPlanId);
    setDuplicateInterventionIds(nextInterventionIds);
    setDuplicateError('');
    setDuplicateModalVisible(true);
  }, [
    actionPlanInterventionMap,
    actionPlanOptions,
    applicationId,
    caseWorkspaceApplicationId,
    getDocumentTypeScope,
    interventionPlanMap,
    resolveDocumentType,
    selectedApplicationFilter,
    selectedInterventionFilter
  ]);

  const handleDuplicateDismiss = useCallback(() => {
    setDuplicateModalVisible(false);
    setDuplicateDocument(null);
    setDuplicateLabel('');
    setDuplicateCategory('');
    setDuplicateApplicationId('');
    setDuplicateActionPlanId('');
    setDuplicateInterventionIds([]);
    setDuplicateError('');
    setDuplicateSubmitting(false);
  }, []);

  const handleDuplicateConfirm = useCallback(async () => {
    if (!duplicateDocument?.id) {
      setDuplicateError('Missing document reference.');
      return;
    }
    const trimmedLabel = (duplicateLabel || '').trim();
    const trimmedType = (duplicateCategory || '').trim();
    if (!trimmedLabel) {
      setDuplicateError('Enter a document label.');
      return;
    }
    if (!trimmedType) {
      setDuplicateError('Select a document type.');
      return;
    }
    const scope = getDocumentTypeScope(trimmedType);
    const payload = { label: trimmedLabel, documentType: trimmedType };
    if (scope === 'application') {
      if (canUseApplicantDocumentMode) {
        const nextApplicationId = (duplicateApplicationId || '').trim();
        if (!nextApplicationId) {
          setDuplicateError('Select which application this document should be attached to.');
          return;
        }
        payload.applicationId = nextApplicationId;
      } else {
        const fallbackTarget = buildApplicationFallbackTarget(duplicateActionPlanId, duplicateInterventionIds);
        if (fallbackTarget.actionPlanId) {
          payload.actionPlanId = fallbackTarget.actionPlanId;
          payload.interventionIds = fallbackTarget.interventionIds;
        } else if (fallbackTarget.caseId) {
          payload.caseId = fallbackTarget.caseId;
        } else {
          setDuplicateError('This document must be attached to a case or action plan.');
          return;
        }
      }
    } else if (scope === 'case') {
      const nextCaseId = caseId ? String(caseId) : duplicateDocument?.case_id ? String(duplicateDocument.case_id) : '';
      if (!nextCaseId) {
        setDuplicateError('This document type must be attached to a case.');
        return;
      }
      payload.caseId = nextCaseId;
    } else if (scope === 'client') {
      if (!applyClientScopeContext(payload, duplicateDocument)) {
        setDuplicateError('Unable to determine which case or application should validate this client document.');
        return;
      }
    } else if (scope === 'action_plan') {
      const nextActionPlanId = (duplicateActionPlanId || '').trim();
      if (!nextActionPlanId) {
        setDuplicateError('Select which action plan this document should be attached to.');
        return;
      }
      payload.actionPlanId = nextActionPlanId;
      payload.interventionIds = normalizeIdList(duplicateInterventionIds);
    }
    setDuplicateSubmitting(true);
    setDuplicateError('');
    try {
      const res = await apiFetch(`/api/documents/${duplicateDocument.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res || !res.ok) {
        let payload = null;
        try {
          payload = await res.json();
        } catch (_) {
          payload = null;
        }
        throw new Error(payload?.message || 'Failed to duplicate document.');
      }
      await loadDocuments({ silent: true });
      if (canUseApplicantDocumentMode) {
        await loadChecklist();
      }
      handleDuplicateDismiss();
    } catch (err) {
      setDuplicateError(err?.message || 'Failed to duplicate document.');
    } finally {
      setDuplicateSubmitting(false);
    }
  }, [
    duplicateDocument,
    duplicateLabel,
    duplicateCategory,
    duplicateApplicationId,
    duplicateActionPlanId,
    duplicateInterventionIds,
    applyClientScopeContext,
    buildApplicationFallbackTarget,
    getDocumentTypeScope,
    loadDocuments,
    loadChecklist,
    handleDuplicateDismiss,
    canUseApplicantDocumentMode,
    caseId
  ]);

  const handleRefresh = () => {
    if (!canUploadDocuments) return;
    loadDocuments({ silent: true });
    if (canUseApplicantDocumentMode) {
      loadChecklist();
    }
  };

  const handleApplicationFilterChange = useCallback(
    ({ detail }) => {
      const next = detail?.selectedOption?.value || '';
      setSelectedApplicationFilter(next);
      loadDocuments({ silent: false, applicationId: next });
    },
    [loadDocuments]
  );

  const handleInterventionFilterChange = useCallback(
    ({ detail }) => {
      const next = detail?.selectedOption?.value || '';
      setInterventionSelectionMode('manual');
      setSelectedInterventionFilter(next);
      loadDocuments({ silent: false, interventionId: next });
      loadChecklist();
    },
    [loadDocuments, loadChecklist]
  );

  const hasMultipleApplications = applicationOptions.length > 1;

  const getDocumentReferenceLabel = useCallback(
    item => {
      const linkedInterventions = Array.isArray(item?.intervention_ids) ? item.intervention_ids : [];
      if (linkedInterventions.length) {
        const labels = linkedInterventions.map(id => {
          const key = String(id);
          const option = interventionOptionMap.get(key);
          return option?.label ? option.label : `Intervention ${key}`;
        });
        if (labels.length === 1) return `Intervention: ${labels[0]}`;
        if (labels.length <= 2) return `Interventions: ${labels.join(', ')}`;
        return `Interventions (${labels.length})`;
      }
      if (item?.action_plan_id) {
        const planKey = String(item.action_plan_id);
        const plan = actionPlanOptionMap.get(planKey);
        return plan?.label ? `Action plan: ${plan.label}` : `Action plan ${planKey}`;
      }
      const referenceNumber = item?.reference_number || item?.referenceNumber || null;
      if (!isCaseWorkspace) {
        if (referenceNumber) return referenceNumber;
        if (item?.application_id) return `Application ${item.application_id}`;
      }
      if (item?.case_number) return item.case_number;
      if (referenceNumber) return referenceNumber;
      if (item?.application_id) return `Application ${item.application_id}`;
      return 'Client';
    },
    [actionPlanOptionMap, interventionOptionMap, isCaseWorkspace]
  );

  const getDocumentSortValue = useCallback(
    (item, columnId) => {
      switch (columnId) {
        case 'label':
          return normalizeSortText(item?.label || item?.file_name || '');
        case 'uploaded_at':
          return toSortTimestamp(item?.deleted_at || item?.uploaded_at);
        case 'file_name':
          return normalizeSortText(item?.file_name || '');
        case 'source':
          return normalizeSortText(formatSourceLabel(item));
        case 'case_number':
          return normalizeSortText(getDocumentReferenceLabel(item));
        case 'scope':
          return normalizeSortText(formatScopeLabel(item?.scope));
        default:
          return null;
      }
    },
    [getDocumentReferenceLabel]
  );

  const compareDocuments = useCallback(
    (columnId, a, b) => {
      const aValue = getDocumentSortValue(a, columnId);
      const bValue = getDocumentSortValue(b, columnId);
      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined || aValue === '') return 1;
      if (bValue === null || bValue === undefined || bValue === '') return -1;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return aValue - bValue;
      }
      return String(aValue).localeCompare(String(bValue));
    },
    [getDocumentSortValue]
  );

  const documentFilteringNeedle = documentFilteringText.trim().toLowerCase();
  const filteredDocuments = useMemo(() => {
    if (!documentFilteringNeedle) return Array.isArray(documents) ? documents : [];
    return (Array.isArray(documents) ? documents : []).filter(item => {
      const haystack = [
        item?.label,
        item?.file_name,
        item?.document_type_label,
        formatSourceLabel(item),
        getDocumentReferenceLabel(item),
        formatScopeLabel(item?.scope)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(documentFilteringNeedle);
    });
  }, [documents, documentFilteringNeedle, getDocumentReferenceLabel]);

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: 'label',
        header: 'Document label',
        cell: item => item.label || item.file_name || '',
        sortingComparator: (a, b) => compareDocuments('label', a, b),
        ...(isDeletedView
          ? {}
          : {
              editConfig: {
                ariaLabel: 'Document label',
                editIconAriaLabel: 'Edit document label',
                disabledReason: item => (!item?.id ? 'Cannot edit this document.' : undefined),
                editingCell: (item, { currentValue, setValue }) => (
                  <Input
                    autoFocus
                    value={currentValue ?? item.label ?? item.file_name ?? ''}
                    onChange={({ detail }) => setValue(detail.value)}
                    placeholder="e.g., Government ID"
                  />
                )
              }
            })
      },
      {
        id: 'uploaded_at',
        header: isDeletedView ? 'Deleted' : 'Uploaded',
        cell: item => formatDateTime(isDeletedView ? item.deleted_at : item.uploaded_at),
        sortingComparator: (a, b) => compareDocuments('uploaded_at', a, b)
      },
      {
        id: 'file_name',
        header: 'File Name',
        cell: item => item.file_name || '',
        sortingComparator: (a, b) => compareDocuments('file_name', a, b)
      },
      {
        id: 'case_number',
        header: isCaseWorkspace ? 'Case / Plan' : 'Application',
        cell: item => getDocumentReferenceLabel(item),
        sortingComparator: (a, b) => compareDocuments('case_number', a, b)
      },
      {
        id: 'scope',
        header: 'Scope',
        cell: item => formatScopeLabel(item.scope),
        sortingComparator: (a, b) => compareDocuments('scope', a, b)
      },
      {
        id: 'source',
        header: 'Source',
        cell: item => formatSourceLabel(item),
        sortingComparator: (a, b) => compareDocuments('source', a, b)
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: item => {
          const isAvailable = Boolean(item?.id && item?.file_path);
          if (!isAvailable) {
            return <span style={{ color: '#888' }}>Unavailable</span>;
          }
          const inFlight = !!pendingDownloads[item.id];
          const downloadingOriginal = !!pendingOriginalDownloads[item.id];
          const deleting = !!pendingDeletes[item.id];
          const restoring = !!pendingRestores[item.id];
          const canDuplicate = item?.scope !== 'client';
          const allowDuplicate = canDuplicate && (isCaseWorkspace || hasMultipleApplications);
          const actionItems = isDeletedView
            ? [
                { id: 'view', text: inFlight ? 'View (loading...)' : 'View', disabled: inFlight },
                ...(canDownloadOriginalDocuments
                  ? [{
                      id: 'download',
                      text: downloadingOriginal ? 'Download (loading...)' : 'Download',
                      disabled: downloadingOriginal,
                    }]
                  : []),
                {
                  id: 'restore',
                  text: restoring ? 'Restore (in progress...)' : 'Restore',
                  disabled: restoring || item.can_restore !== true,
                  disabledReason: item.restore_disabled_reason || undefined,
                },
              ]
            : [
                { id: 'edit', text: 'Edit' },
                ...(allowDuplicate ? [{ id: 'duplicate', text: 'Duplicate' }] : []),
                ...(canDownloadOriginalDocuments
                  ? [{ id: 'download', text: downloadingOriginal ? 'Download (loading...)' : 'Download', disabled: downloadingOriginal }]
                  : []),
                { id: 'view', text: inFlight ? 'View (loading...)' : 'View', disabled: inFlight },
                {
                  id: 'delete',
                  text: deleting ? 'Delete (in progress...)' : 'Delete',
                  disabled: deleting || item.can_delete === false,
                  disabledReason: item.delete_disabled_reason || undefined,
                }
              ];
          return (
            <ButtonDropdown
              ariaLabel={`Actions for ${item.label || item.file_name || 'document'}`}
              items={actionItems}
              expandToViewport
              onItemClick={({ detail }) => {
                switch (detail.id) {
                  case 'edit':
                    openEditModal(item);
                    break;
                  case 'duplicate':
                    openDuplicateModal(item);
                    break;
                  case 'download':
                    openDownloadModal(item);
                    break;
                  case 'view':
                    handleViewDocument(item);
                    break;
                  case 'delete':
                    openDeleteModal(item);
                    break;
                  case 'restore':
                    openRestoreModal(item);
                    break;
                  default:
                    break;
                }
              }}
            >
              Actions
            </ButtonDropdown>
          );
        }
      }
    ],
    [
      handleViewDocument,
      openDownloadModal,
      openDeleteModal,
      openDuplicateModal,
      openEditModal,
      openRestoreModal,
      pendingRestores,
      pendingOriginalDownloads,
      pendingDownloads,
      pendingDeletes,
      canDownloadOriginalDocuments,
      compareDocuments,
      getDocumentReferenceLabel,
      isCaseWorkspace,
      hasMultipleApplications,
      isDeletedView,
    ]
  );

  const mergedColumnDefinitions = useMemo(
    () =>
      baseColumnDefinitions.map(column => {
        const stored = columnWidths.find(entry => entry.id === column.id);
        if (stored?.width) {
          return { ...column, width: stored.width };
        }
        return column;
      }),
    [baseColumnDefinitions, columnWidths]
  );

  const columnDefinitionsForTable = useMemo(() => {
    const allowed = new Set([...visibleColumns, ...REQUIRED_COLUMN_IDS]);
    return mergedColumnDefinitions.filter(column => allowed.has(column.id));
  }, [mergedColumnDefinitions, visibleColumns]);

  useEffect(() => {
    const hasActiveSortingColumn = columnDefinitionsForTable.some(
      column => column.id === sortingState.columnId && typeof column.sortingComparator === 'function'
    );
    if (hasActiveSortingColumn) return;
    const fallbackColumn = columnDefinitionsForTable.find(
      column => typeof column.sortingComparator === 'function'
    );
    if (!fallbackColumn?.id) return;
    setSortingState({
      columnId: fallbackColumn.id,
      isDescending: fallbackColumn.id === 'uploaded_at'
    });
  }, [columnDefinitionsForTable, sortingState.columnId]);

  const sortedDocuments = useMemo(() => {
    const next = Array.isArray(filteredDocuments) ? [...filteredDocuments] : [];
    const { columnId, isDescending } = sortingState;
    if (!columnId) return next;
    next.sort((a, b) => {
      const result = compareDocuments(columnId, a, b);
      return isDescending ? -result : result;
    });
    return next;
  }, [filteredDocuments, sortingState, compareDocuments]);

  const activeSortingColumn = useMemo(
    () => columnDefinitionsForTable.find(column => column.id === sortingState.columnId),
    [columnDefinitionsForTable, sortingState.columnId]
  );

  const preferencesState = useMemo(
    () => ({
      contentDisplay: mergedColumnDefinitions.map(column => ({
        id: column.id,
        visible: visibleColumns.includes(column.id)
      })),
      columnWidths
    }),
    [mergedColumnDefinitions, visibleColumns, columnWidths]
  );

  const columnPreferenceOptions = useMemo(
    () =>
      mergedColumnDefinitions.map(column => ({
        id: column.id,
        label: typeof column.header === 'string' ? column.header : column.id,
        alwaysVisible: REQUIRED_COLUMN_IDS.includes(column.id)
      })),
    [mergedColumnDefinitions]
  );

  const applyColumnWidthUpdates = useCallback(
    updates => {
      if (!Array.isArray(updates)) {
        setColumnWidths([]);
        persistColumnWidths([]);
        return;
      }
      const allowedIds = new Set(mergedColumnDefinitions.map(column => column.id));
      const tempMap = new Map();
      updates.forEach(entry => {
        if (!entry || typeof entry !== 'object') return;
        const { id, width } = entry;
        if (!allowedIds.has(id)) return;
        const numericWidth = Number(width);
        if (Number.isFinite(numericWidth)) {
          tempMap.set(id, numericWidth);
        }
      });
      const ordered = [];
      mergedColumnDefinitions.forEach(column => {
        if (tempMap.has(column.id)) {
          ordered.push({ id: column.id, width: tempMap.get(column.id) });
        }
      });
      setColumnWidths(ordered);
      persistColumnWidths(ordered);
    },
    [mergedColumnDefinitions, persistColumnWidths]
  );

  const handleColumnWidthsChange = useCallback(
    ({ detail }) => {
      if (!detail) return;
      const next = [];
      if (Array.isArray(detail.columnWidths)) {
        detail.columnWidths.forEach(entry => {
          if (!entry || typeof entry !== 'object') return;
          const { id, width } = entry;
          if (typeof id === 'string' && Number.isFinite(Number(width))) {
            next.push({ id, width: Number(width) });
          }
        });
      } else if (Array.isArray(detail.widths)) {
        detail.widths.forEach((width, index) => {
          const column = columnDefinitionsForTable[index];
          if (!column) return;
          if (Number.isFinite(Number(width))) {
            next.push({ id: column.id, width: Number(width) });
          }
        });
      }
      if (next.length) {
        applyColumnWidthUpdates(next);
      }
    },
    [applyColumnWidthUpdates, columnDefinitionsForTable]
  );

  const handlePreferencesConfirm = useCallback(
    ({ detail }) => {
      const display = detail?.contentDisplay || detail?.preferences?.contentDisplay || [];
      if (Array.isArray(display)) {
        const nextVisible = display
          .filter(entry => entry && entry.visible)
          .map(entry => entry.id)
          .filter(id => ALL_COLUMN_IDS.includes(id));
        const ordered = buildVisibleColumnOrder(nextVisible);
        setVisibleColumns(ordered);
        persistPreferences(ordered);
      }
      const widths = detail?.columnWidths || detail?.preferences?.columnWidths || [];
      if (Array.isArray(widths) && widths.length) {
        applyColumnWidthUpdates(widths);
      }
    },
    [persistPreferences, applyColumnWidthUpdates]
  );

  const applicationFilterOptions = useMemo(() => {
    const opts = [{ value: '', label: 'All documents (client + all applications)' }];
    applicationOptions.forEach(opt => {
      const statusLabel = formatApplicationStatus(opt.status || '').toLowerCase();
      const description = typeof opt.description === 'string' ? opt.description.trim() : '';
      const descriptionLower = description.toLowerCase();
      const showStatusTag =
        opt.status &&
        (!descriptionLower ||
          (descriptionLower !== statusLabel && descriptionLower !== String(opt.status).toLowerCase()));
      opts.push({
        value: opt.value,
        label: opt.label,
        description: opt.description,
        tags: showStatusTag ? buildStatusTag(formatApplicationStatusTag(opt.status)) : undefined
      });
    });
    return opts;
  }, [applicationOptions]);

  const selectedApplicationFilterOption = useMemo(
    () =>
      applicationFilterOptions.find(opt => opt.value === selectedApplicationFilter) ||
      applicationFilterOptions[0],
    [applicationFilterOptions, selectedApplicationFilter]
  );

  const interventionFilterOptions = useMemo(() => {
    const opts = [{ value: '', label: 'All case documents' }];
    interventionOptions.forEach(opt => {
      opts.push({
        value: opt.value,
        label: opt.label,
        description: opt.description,
        tags: opt.status ? buildStatusTag(formatInterventionStatusTag(opt.status)) : undefined
      });
    });
    return opts;
  }, [interventionOptions]);

  const selectedInterventionFilterOption = useMemo(
    () =>
      interventionFilterOptions.find(opt => opt.value === selectedInterventionFilter) ||
      interventionFilterOptions[0],
    [interventionFilterOptions, selectedInterventionFilter]
  );

  const applicationSelectOptions = useMemo(
    () =>
      applicationOptions.map(opt => {
        const statusLabel = formatApplicationStatus(opt.status || '').toLowerCase();
        const description = typeof opt.description === 'string' ? opt.description.trim() : '';
        const descriptionLower = description.toLowerCase();
        const showStatusTag =
          opt.status &&
          (!descriptionLower ||
            (descriptionLower !== statusLabel && descriptionLower !== String(opt.status).toLowerCase()));
        return {
          ...opt,
          tags: showStatusTag ? buildStatusTag(formatApplicationStatusTag(opt.status)) : undefined
        };
      }),
    [applicationOptions]
  );

  const pendingActionPlanInterventionOptions = useMemo(() => {
    const options = actionPlanInterventionMap.get(String(pendingActionPlan || '')) || [];
    return options.map(opt => ({
      ...opt,
      tags: opt.status ? buildStatusTag(formatInterventionStatusTag(opt.status)) : undefined
    }));
  }, [actionPlanInterventionMap, pendingActionPlan]);
  const editActionPlanInterventionOptions = useMemo(() => {
    const options = actionPlanInterventionMap.get(String(editActionPlanId || '')) || [];
    return options.map(opt => ({
      ...opt,
      tags: opt.status ? buildStatusTag(formatInterventionStatusTag(opt.status)) : undefined
    }));
  }, [actionPlanInterventionMap, editActionPlanId]);
  const duplicateActionPlanInterventionOptions = useMemo(() => {
    const options = actionPlanInterventionMap.get(String(duplicateActionPlanId || '')) || [];
    return options.map(opt => ({
      ...opt,
      tags: opt.status ? buildStatusTag(formatInterventionStatusTag(opt.status)) : undefined
    }));
  }, [actionPlanInterventionMap, duplicateActionPlanId]);
  const pendingSelectedInterventionOptions = useMemo(() => {
    const selected = new Set(normalizeIdList(pendingInterventions));
    return pendingActionPlanInterventionOptions.filter(opt => selected.has(opt.value));
  }, [pendingActionPlanInterventionOptions, pendingInterventions]);
  const editSelectedInterventionOptions = useMemo(() => {
    const selected = new Set(normalizeIdList(editInterventionIds));
    return editActionPlanInterventionOptions.filter(opt => selected.has(opt.value));
  }, [editActionPlanInterventionOptions, editInterventionIds]);
  const duplicateSelectedInterventionOptions = useMemo(() => {
    const selected = new Set(normalizeIdList(duplicateInterventionIds));
    return duplicateActionPlanInterventionOptions.filter(opt => selected.has(opt.value));
  }, [duplicateActionPlanInterventionOptions, duplicateInterventionIds]);

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={preferencesState}
      contentDisplayPreference={{
        title: 'Select columns',
        options: columnPreferenceOptions
      }}
      onConfirm={handlePreferencesConfirm}
    />
  );

  const pendingDocScope = getDocumentTypeScope(pendingCategory);
  const editDocType = editCategory || resolveDocumentType(editDocument);
  const editDocScope = editDocType ? getDocumentTypeScope(editDocType) : '';
  const duplicateDocScope = getDocumentTypeScope(duplicateCategory);
  const pendingUsesApplicationFallback = usesApplicationScopeFallback(pendingDocScope);
  const editUsesApplicationFallback = usesApplicationScopeFallback(editDocScope);
  const duplicateUsesApplicationFallback = usesApplicationScopeFallback(duplicateDocScope);
  const pendingUsesDirectCaseApplication = false;
  const editUsesDirectCaseApplication = false;
  const duplicateUsesDirectCaseApplication = false;
  const showChecklistTab = canUseApplicantDocumentMode;
  const uploadApplicationOptions = useMemo(() => {
    if (!applicationSelectOptions.length) {
      return [{ value: '', label: 'No applications available' }];
    }
    return applicationSelectOptions;
  }, [applicationSelectOptions]);
  const uploadSelectedApplicationOption =
    uploadApplicationOptions.find(opt => opt.value === pendingApplication) || uploadApplicationOptions[0];
  const selectedEditApplicationOption =
    applicationSelectOptions.find(opt => opt.value === editApplicationId) || null;
  const selectedDuplicateApplicationOption =
    applicationSelectOptions.find(opt => opt.value === duplicateApplicationId) || null;
  const selectedPendingActionPlanOption =
    actionPlanOptions.find(opt => opt.value === pendingActionPlan) || null;
  const selectedEditActionPlanOption =
    actionPlanOptions.find(opt => opt.value === editActionPlanId) || null;
  const selectedDuplicateActionPlanOption =
    actionPlanOptions.find(opt => opt.value === duplicateActionPlanId) || null;
  const editAssociationChanged = hasDocumentAssociationChanged({
    document: editDocument,
    scope: editDocScope,
    usesApplicationFallback: editUsesApplicationFallback,
    applicationId: editApplicationId,
    actionPlanId: editActionPlanId,
    interventionIds: editInterventionIds,
  });
  const editHasSourceBoundLineage = hasSourceBoundDocumentLineage(editDocument);

  const documentsTableContent = (
    <SpaceBetween size="s">
      <TextFilter
        filteringText={documentFilteringText}
        onChange={({ detail }) => setDocumentFilteringText(detail.filteringText)}
        filteringPlaceholder={isDeletedView ? 'Find deleted documents' : 'Find documents'}
        countText={
          documentFilteringText
            ? `${sortedDocuments.length} match${sortedDocuments.length === 1 ? '' : 'es'}`
            : undefined
        }
      />
      <Table
        trackBy="id"
        loading={loading || refreshing}
        loadingText={isDeletedView ? 'Loading deleted documents' : `Loading ${isCaseDocumentMode ? 'case documents' : 'supporting documents'}`}
        variant="embedded"
        items={sortedDocuments}
        columnDefinitions={columnDefinitionsForTable}
        resizableColumns
        stickyHeader
        enableKeyboardNavigation
        sortingColumn={activeSortingColumn || { id: sortingState.columnId }}
        sortingDescending={sortingState.isDescending}
        onSortingChange={({ detail }) => {
          const columnId = detail?.sortingColumn?.id;
          if (columnId) {
            setSortingState({ columnId, isDescending: detail.isDescending });
          }
        }}
        onColumnWidthsChange={handleColumnWidthsChange}
        preferences={preferencesComponent}
        submitEdit={isDeletedView ? undefined : handleInlineEdit}
        ariaLabels={{
          activateEditLabel: (column, item) => `Edit ${item?.label || item?.file_name || 'document'} ${column.header}`,
          cancelEditLabel: column => `Cancel editing ${column.header}`,
          submitEditLabel: column => `Submit editing ${column.header}`,
          tableLabel: isDeletedView
            ? 'Deleted documents'
            : isCaseDocumentMode
              ? 'Case documents'
              : 'Supporting documents'
        }}
        empty={
          <Box textAlign="center">
            {documentFilteringText
              ? 'No matching documents.'
              : isDeletedView
                ? 'No deleted documents to display.'
                : isCaseDocumentMode
                  ? 'No case documents to display.'
                  : 'No supporting documents to display.'}
          </Box>
        }
      />
    </SpaceBetween>
  );


  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <Modal
        visible={labelModalVisible}
        onDismiss={handleLabelModalDismiss}
        closeAriaLabel="Close dialog"
        header="Set document label"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleLabelModalDismiss}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleLabelConfirm}>
              Continue
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <FormField
            label="Document label"
            description="Enter how this document should be listed in Supporting Documents."
            errorText={labelError}
          >
            <Input
              value={pendingLabel}
              placeholder="e.g., Government ID"
              onChange={({ detail }) => setPendingLabel(detail.value)}
              autoFocus
            />
          </FormField>
          <FormField
            label="Document type"
            description="Select the category for this document."
            errorText={pendingCategoryError}
          >
            <Select
              selectedOption={
                availableDocumentTypeOptions.find(opt => opt.value === pendingCategory) || availableDocumentTypeOptions[0]
              }
              onChange={({ detail }) => setPendingCategory(detail.selectedOption.value || '')}
              options={availableDocumentTypeOptions}
              selectedAriaLabel="Selected document type"
              placeholder="Select document type"
            />
          </FormField>
          {pendingDocScope === 'client' || pendingDocScope === 'payment_packet' ? (
            <ModalScopeHint>
              {pendingDocScope === 'client'
                ? 'Client-scoped documents are reusable across all cases.'
                : 'Payment packet documents stay attached to the client record.'}
            </ModalScopeHint>
          ) : null}
          {pendingDocScope === 'case' ? (
            <FormField
              label="Case"
              description="This document will be attached to the active case."
            >
              <Box>
                {caseData?.case_number || caseData?.caseNumber
                  ? `Case ${caseData.case_number || caseData.caseNumber}`
                  : caseId
                    ? `Case ${caseId}`
                    : 'No case selected'}
              </Box>
            </FormField>
          ) : null}
          {pendingDocScope === 'application' && canUseApplicantDocumentMode ? (
            <FormField
              label="Attach to application"
              description="Select which application this document should be attached to."
              errorText={pendingApplicationError}
            >
              <Select
                selectedOption={uploadSelectedApplicationOption}
                onChange={({ detail }) => {
                  setPendingApplicationError('');
                  setPendingApplication(detail.selectedOption.value || '');
                }}
                options={uploadApplicationOptions}
                placeholder={applicationSelectOptions.length ? 'Select application' : 'No applications available'}
                loading={applicationsLoading}
                filteringType="none"
              />
            </FormField>
          ) : null}
          {pendingDocScope === 'application' && pendingUsesDirectCaseApplication ? (
            <ModalScopeHint>
              This case already has a linked application. PATH will attach this document there.
            </ModalScopeHint>
          ) : null}
          {pendingDocScope === 'application' && pendingUsesApplicationFallback ? (
            <>
              <ModalScopeHint>
                PATH will store this document under the selected action plan, or the case file if no action plan is
                chosen.
              </ModalScopeHint>
              <FormField
                label="Store under action plan"
                description="Optional but recommended for imported or backloaded application documents."
                errorText={pendingActionPlanError}
              >
                <Select
                  selectedOption={selectedPendingActionPlanOption}
                  onChange={({ detail }) => {
                    setPendingActionPlanError('');
                    const nextPlan = detail.selectedOption?.value || '';
                    setPendingActionPlan(nextPlan);
                    setPendingInterventions([]);
                  }}
                  options={actionPlanOptions}
                  placeholder={actionPlanOptions.length ? 'Select action plan (optional)' : 'No action plans available'}
                  filteringType="none"
                />
              </FormField>
              <FormField
                label="Link interventions (optional)"
                description="Select the interventions this document supports."
              >
                <Multiselect
                  selectedOptions={pendingSelectedInterventionOptions}
                  onChange={({ detail }) => {
                    const nextIds = (detail.selectedOptions || []).map(opt => opt.value);
                    setPendingInterventions(nextIds);
                  }}
                  options={pendingActionPlanInterventionOptions}
                  placeholder={
                    pendingActionPlanInterventionOptions.length
                      ? 'Select interventions'
                      : 'No interventions available'
                  }
                  disabled={!pendingActionPlan}
                />
              </FormField>
            </>
          ) : null}
          {pendingDocScope === 'action_plan' ? (
            <>
              <FormField
                label="Action plan"
                description="Select which action plan this document should be attached to."
                errorText={pendingActionPlanError}
              >
                <Select
                  selectedOption={selectedPendingActionPlanOption}
                  onChange={({ detail }) => {
                    setPendingActionPlanError('');
                    const nextPlan = detail.selectedOption?.value || '';
                    setPendingActionPlan(nextPlan);
                    setPendingInterventions([]);
                  }}
                  options={actionPlanOptions}
                  placeholder={actionPlanOptions.length ? 'Select action plan' : 'No action plans available'}
                  filteringType="none"
                />
              </FormField>
              <FormField
                label="Link interventions (optional)"
                description="Select one or more interventions this document supports."
              >
                <Multiselect
                  selectedOptions={pendingSelectedInterventionOptions}
                  onChange={({ detail }) => {
                    const nextIds = (detail.selectedOptions || []).map(opt => opt.value);
                    setPendingInterventions(nextIds);
                  }}
                  options={pendingActionPlanInterventionOptions}
                  placeholder={
                    pendingActionPlanInterventionOptions.length
                      ? 'Select interventions'
                      : 'No interventions available'
                  }
                  disabled={!pendingActionPlan}
                />
              </FormField>
            </>
          ) : null}
        </SpaceBetween>
      </Modal>
      <Modal
        visible={downloadModalVisible}
        onDismiss={handleDownloadCancel}
        closeAriaLabel="Close dialog"
        header="Download original file"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleDownloadCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDownloadConfirm}
              disabled={downloadConfirm.trim().toLowerCase() !== 'download' || pendingOriginalDownloads[downloadTarget?.id]}
              loading={pendingOriginalDownloads[downloadTarget?.id]}
            >
              Download original file
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <Alert type="warning" header="Privacy risk">
            This will download the original file to this device in its native format. Downloaded files can be copied,
            retained outside PATH, or synchronized to other local or cloud storage.
          </Alert>
          <Box>
            Only continue if local download is authorized for this record and you will handle the file according to
            NWAC privacy, confidentiality, and records-management requirements.
          </Box>
          <Box variant="awsui-key-label">
            File: {downloadTarget?.file_name || downloadTarget?.label || 'Selected document'}
          </Box>
          <FormField label="Type download to confirm">
            <Input
              value={downloadConfirm}
              onChange={({ detail }) => setDownloadConfirm(detail.value)}
              autoFocus
              placeholder="download"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={deleteModalVisible}
        onDismiss={handleDeleteCancel}
        closeAriaLabel="Close dialog"
        header="Delete document"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleDeleteCancel}>
              {deleteRefused ? 'Close' : 'Cancel'}
            </Button>
            {!deleteRefused && (
              <Button
                variant="primary"
                onClick={handleDeleteConfirm}
                disabled={Boolean(pendingDeletes[deleteTarget?.id])}
                loading={pendingDeletes[deleteTarget?.id]}
              >
                Delete
              </Button>
            )}
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          {deleteError && (
            <Alert type="error" header={deleteRefused ? "This document can't be deleted" : 'Delete failed'}>
              {deleteError}
            </Alert>
          )}
          {!deleteRefused && (
            <Box>Delete this document?</Box>
          )}
        </SpaceBetween>
      </Modal>
      <Modal
        visible={restoreModalVisible}
        onDismiss={handleRestoreCancel}
        closeAriaLabel="Close dialog"
        header="Restore document"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleRestoreCancel}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleRestoreConfirm}
              loading={pendingRestores[restoreTarget?.id]}
              disabled={pendingRestores[restoreTarget?.id]}
            >
              Restore
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          {restoreError && <Alert type="error">{restoreError}</Alert>}
          <Box>
            This puts the file back in Supporting Documents. Checklists and other PATH processes will be able to use it
            again.
          </Box>
          <Box variant="awsui-key-label">
            File: {restoreTarget?.file_name || restoreTarget?.label || 'Selected document'}
          </Box>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={editModalVisible}
        onDismiss={handleEditDismiss}
        closeAriaLabel="Close dialog"
        header="Edit document details"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleEditDismiss}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleEditSave}>
              Save
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <FormField label="Document label" errorText={editLabelError}>
            <Input value={editLabel} onChange={({ detail }) => setEditLabel(detail.value)} autoFocus />
          </FormField>
          <FormField label="Document type" errorText={editCategoryError}>
            <Select
              selectedOption={
                availableDocumentTypeOptions.find(opt => opt.value === editCategory) || availableDocumentTypeOptions[0]
              }
              onChange={({ detail }) => setEditCategory(detail.selectedOption.value || '')}
              options={availableDocumentTypeOptions}
              selectedAriaLabel="Selected document type"
              placeholder="Select document type"
            />
          </FormField>
          {editDocScope === 'application' && canUseApplicantDocumentMode && (
            <>
              <FormField
                label="Attach to application"
                description={
                  editHasSourceBoundLineage && editDocument?.application_id
                    ? 'This document stays with the application where it originated.'
                    : 'Application-scoped documents must be attached to an application.'
                }
                errorText={editAttachError}
              >
                <Select
                  selectedOption={selectedEditApplicationOption}
                  onChange={({ detail }) => {
                    setEditAttachError('');
                    setEditApplicationId(detail.selectedOption?.value || '');
                  }}
                  options={applicationSelectOptions}
                  placeholder={applicationSelectOptions.length ? 'Select application' : 'No applications available'}
                  loading={applicationsLoading}
                  filteringType="none"
                  disabled={editHasSourceBoundLineage && Boolean(editDocument?.application_id)}
                />
              </FormField>
              {editAssociationChanged && (
                <Alert type="warning" header="Moving this document">
                  Changing the attachment will remove this document from the original submission and may make it
                  incomplete.
                </Alert>
              )}
            </>
          )}
          {editDocScope === 'application' && editUsesDirectCaseApplication && (
            <ModalScopeHint>
              This case already has a linked application. PATH will keep this document attached there.
            </ModalScopeHint>
          )}
          {editDocScope === 'application' && editUsesApplicationFallback && (
            <>
              <ModalScopeHint>
                PATH will store this document under the selected action plan, or the case file if no action plan is
                chosen.
              </ModalScopeHint>
              <FormField
                label="Store under action plan"
                description="Optional but recommended for imported or backloaded application documents."
                errorText={editAttachError}
              >
                <Select
                  selectedOption={selectedEditActionPlanOption}
                  onChange={({ detail }) => {
                    setEditAttachError('');
                    const nextPlan = detail.selectedOption?.value || '';
                    setEditActionPlanId(nextPlan);
                    setEditInterventionIds([]);
                  }}
                  options={actionPlanOptions}
                  placeholder={actionPlanOptions.length ? 'Select action plan (optional)' : 'No action plans available'}
                  filteringType="none"
                />
              </FormField>
              <FormField
                label="Link interventions (optional)"
                description="Select the interventions this document supports."
              >
                <Multiselect
                  selectedOptions={editSelectedInterventionOptions}
                  onChange={({ detail }) => {
                    const nextIds = (detail.selectedOptions || []).map(opt => opt.value);
                    setEditInterventionIds(nextIds);
                  }}
                  options={editActionPlanInterventionOptions}
                  placeholder={
                    editActionPlanInterventionOptions.length
                      ? 'Select interventions'
                      : 'No interventions available'
                  }
                  disabled={!editActionPlanId}
                />
              </FormField>
              {editAssociationChanged && (
                <Alert type="warning" header="Moving this document">
                  Changing the action plan or intervention links will update where this document appears.
                </Alert>
              )}
            </>
          )}
          {editDocScope === 'case' && (
            <ModalScopeHint>This document is attached to the current case.</ModalScopeHint>
          )}
          {editDocScope === 'action_plan' && (
            <>
              <FormField
                label="Action plan"
                description="Select which action plan this document should be attached to."
                errorText={editAttachError}
              >
                <Select
                  selectedOption={selectedEditActionPlanOption}
                  onChange={({ detail }) => {
                    setEditAttachError('');
                    const nextPlan = detail.selectedOption?.value || '';
                    setEditActionPlanId(nextPlan);
                    setEditInterventionIds([]);
                  }}
                  options={actionPlanOptions}
                  placeholder={actionPlanOptions.length ? 'Select action plan' : 'No action plans available'}
                  filteringType="none"
                />
              </FormField>
              <FormField
                label="Link interventions (optional)"
                description="Select the interventions this document supports."
              >
                <Multiselect
                  selectedOptions={editSelectedInterventionOptions}
                  onChange={({ detail }) => {
                    const nextIds = (detail.selectedOptions || []).map(opt => opt.value);
                    setEditInterventionIds(nextIds);
                  }}
                  options={editActionPlanInterventionOptions}
                  placeholder={
                    editActionPlanInterventionOptions.length
                      ? 'Select interventions'
                      : 'No interventions available'
                  }
                  disabled={!editActionPlanId}
                />
              </FormField>
              {editAssociationChanged && (
                <Alert type="warning" header="Moving this document">
                  Changing the action plan or interventions will update where this document appears.
                </Alert>
              )}
            </>
          )}
          {editDocScope === 'client' && (
            <ModalScopeHint>Client-scoped documents do not require an application, case, or action plan.</ModalScopeHint>
          )}
          {editDocScope === 'payment_packet' && (
            <ModalScopeHint>Payment packet documents stay attached to the client record.</ModalScopeHint>
          )}
        </SpaceBetween>
      </Modal>
      <Modal
        visible={duplicateModalVisible}
        onDismiss={handleDuplicateDismiss}
        closeAriaLabel="Close dialog"
        header="Duplicate document"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleDuplicateDismiss}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleDuplicateConfirm} loading={duplicateSubmitting}>
              Duplicate
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          {duplicateError && <Alert type="error">{duplicateError}</Alert>}
          <FormField label="Document label">
            <Input
              value={duplicateLabel}
              onChange={({ detail }) => setDuplicateLabel(detail.value)}
              placeholder="Document label"
              autoFocus
            />
          </FormField>
          <FormField label="Document type">
            <Select
              selectedOption={
                availableDocumentTypeOptions.find(opt => opt.value === duplicateCategory) || availableDocumentTypeOptions[0]
              }
              onChange={({ detail }) => setDuplicateCategory(detail.selectedOption.value || '')}
              options={availableDocumentTypeOptions}
              selectedAriaLabel="Selected document type"
              placeholder="Select document type"
            />
          </FormField>
          {duplicateDocScope === 'application' && canUseApplicantDocumentMode && (
            <FormField label="Attach to application">
              <Select
                selectedOption={selectedDuplicateApplicationOption}
                onChange={({ detail }) => {
                  setDuplicateError('');
                  setDuplicateApplicationId(detail.selectedOption?.value || '');
                }}
                options={applicationSelectOptions}
                placeholder={applicationSelectOptions.length ? 'Select application' : 'No applications available'}
                loading={applicationsLoading}
                filteringType="none"
              />
            </FormField>
          )}
          {duplicateDocScope === 'application' && duplicateUsesDirectCaseApplication && (
            <ModalScopeHint>
              This case already has a linked application. PATH will attach the duplicate there.
            </ModalScopeHint>
          )}
          {duplicateDocScope === 'application' && duplicateUsesApplicationFallback && (
            <>
              <ModalScopeHint>
                PATH will store the duplicate under the selected action plan, or the case file if no action plan is
                chosen.
              </ModalScopeHint>
              <FormField label="Store under action plan">
                <Select
                  selectedOption={selectedDuplicateActionPlanOption}
                  onChange={({ detail }) => {
                    setDuplicateError('');
                    const nextPlan = detail.selectedOption?.value || '';
                    setDuplicateActionPlanId(nextPlan);
                    setDuplicateInterventionIds([]);
                  }}
                  options={actionPlanOptions}
                  placeholder={actionPlanOptions.length ? 'Select action plan (optional)' : 'No action plans available'}
                  filteringType="none"
                />
              </FormField>
              <FormField
                label="Link interventions (optional)"
                description="Select the interventions this document supports."
              >
                <Multiselect
                  selectedOptions={duplicateSelectedInterventionOptions}
                  onChange={({ detail }) => {
                    const nextIds = (detail.selectedOptions || []).map(opt => opt.value);
                    setDuplicateInterventionIds(nextIds);
                  }}
                  options={duplicateActionPlanInterventionOptions}
                  placeholder={
                    duplicateActionPlanInterventionOptions.length
                      ? 'Select interventions'
                      : 'No interventions available'
                  }
                  disabled={!duplicateActionPlanId}
                />
              </FormField>
            </>
          )}
          {duplicateDocScope === 'case' && (
            <ModalScopeHint>This duplicate will attach to the current case.</ModalScopeHint>
          )}
          {duplicateDocScope === 'action_plan' && (
            <>
              <FormField label="Action plan">
                <Select
                  selectedOption={selectedDuplicateActionPlanOption}
                  onChange={({ detail }) => {
                    setDuplicateError('');
                    const nextPlan = detail.selectedOption?.value || '';
                    setDuplicateActionPlanId(nextPlan);
                    setDuplicateInterventionIds([]);
                  }}
                  options={actionPlanOptions}
                  placeholder={actionPlanOptions.length ? 'Select action plan' : 'No action plans available'}
                  filteringType="none"
                />
              </FormField>
              <FormField
                label="Link interventions (optional)"
                description="Select the interventions this document supports."
              >
                <Multiselect
                  selectedOptions={duplicateSelectedInterventionOptions}
                  onChange={({ detail }) => {
                    const nextIds = (detail.selectedOptions || []).map(opt => opt.value);
                    setDuplicateInterventionIds(nextIds);
                  }}
                  options={duplicateActionPlanInterventionOptions}
                  placeholder={
                    duplicateActionPlanInterventionOptions.length
                      ? 'Select interventions'
                      : 'No interventions available'
                  }
                  disabled={!duplicateActionPlanId}
                />
              </FormField>
            </>
          )}
          {duplicateDocScope === 'client' && (
            <ModalScopeHint>Client-scoped documents do not need an application, case, or action plan.</ModalScopeHint>
          )}
          {duplicateDocScope === 'payment_packet' && (
            <ModalScopeHint>Payment packet documents stay attached to the client record.</ModalScopeHint>
          )}
        </SpaceBetween>
      </Modal>
      <BoardItem
      header={
        <Header
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                iconName="upload"
                onClick={openLabelModal}
                disabled={!canUploadDocuments || isDeletedView}
                loading={uploading}
              >
                Upload
              </Button>
              <Button
                variant="icon"
                iconName="refresh"
                ariaLabel="Refresh supporting documents"
                onClick={handleRefresh}
                disabled={loading || refreshing || !canUploadDocuments}
              />
            </SpaceBetween>
          }
          info={
            toggleHelpPanel ? (
              <Link
                variant="info"
                onFollow={() =>
                  toggleHelpPanel(
                    <SupportingDocumentsHelp />,
                    'Supporting Documents Help',
                    SupportingDocumentsHelp.aiContext
                  )
                }
              >
                Info
              </Link>
            ) : undefined
          }
        >
          <Hotspot hotspotId="app-workspace-supporting-documents" direction="right" />
          {widgetTitle}
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription:
          'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription:
          'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        actions && actions.removeItem && (
          <ButtonDropdown
            items={[{ id: 'remove', text: 'Remove' }]}
            ariaLabel="Board item settings"
            variant="icon"
            onItemClick={() => actions && actions.removeItem && actions.removeItem()}
          />
        )
      }
    >
      <SpaceBetween size="s">
        <Box variant="small">
          {widgetSummary}
        </Box>
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Tabs
          activeTabId={activeTabId}
          onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          tabs={[
            {
              id: 'documents',
              label: 'Documents',
              content: documentsTableContent
            },
            ...(isSystemAdministratorRole
              ? [{ id: 'deleted', label: 'Deleted', content: documentsTableContent }]
              : []),
            ...(showChecklistTab
              ? [
                  {
                    id: 'checklist',
                    label: (
                      <SpaceBetween direction="horizontal" size="xs">
                        <span>Checklist</span>
                        {missingRequiredCount > 0 ? (
                          <StatusIndicator type="error">{`${missingRequiredCount} missing`}</StatusIndicator>
                        ) : (
                          <StatusIndicator type="success">Complete</StatusIndicator>
                        )}
                      </SpaceBetween>
                    ),
                    content: (
                      <SpaceBetween size="s">
                        {checklistError && (
                          <Alert type="error" dismissible onDismiss={() => setChecklistError(null)}>
                            {checklistError}
                          </Alert>
                        )}
                        {isCaseWorkspace && !selectedInterventionFilter && (
                          <Alert type="info">Select an intervention to view its checklist.</Alert>
                        )}
                        <Table
                          trackBy="id"
                          variant="embedded"
                          header={
                            checklistGateLabel
                              ? <Header variant="h3">{checklistGateLabel}</Header>
                              : <Header variant="h3">Checklist</Header>
                          }
                          loading={checklistLoading}
                          loadingText="Loading checklist"
                          items={visibleChecklistItems}
                          resizableColumns
                          columnDefinitions={[
                            { id: 'label', header: 'Item', cell: item => item.label, minWidth: 220 },
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
                      </SpaceBetween>
                    )
                  }
                ]
              : [])]}
        />
        <FormField label={isCaseWorkspace ? 'Show documents relevant to' : 'View documents for'}>
          <Select
            selectedOption={isCaseWorkspace ? selectedInterventionFilterOption : selectedApplicationFilterOption}
            onChange={isCaseWorkspace ? handleInterventionFilterChange : handleApplicationFilterChange}
            options={isCaseWorkspace ? interventionFilterOptions : applicationFilterOptions}
            placeholder={isCaseWorkspace ? 'All case documents' : 'All documents'}
            loading={!isCaseWorkspace && applicationsLoading}
            filteringType="none"
          />
        </FormField>
      </SpaceBetween>
      </BoardItem>
    </>
  );
};

export default SupportingDocumentsWidget;
