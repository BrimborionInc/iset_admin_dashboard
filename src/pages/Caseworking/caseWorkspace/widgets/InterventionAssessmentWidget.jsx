import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Badge,
  Box,
  Button,
  Modal,
  Link,
  ButtonDropdown,
  ColumnLayout,
  DatePicker,
  FormField,
  Header,
  Input,
  Select,
  SpaceBetween,
  Textarea,
  Autosuggest,
  Multiselect,
  Wizard,
  Table,
  StatusIndicator,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../../auth/apiClient";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import useCurrentUser from "../../../../hooks/useCurrentUser.js";

const defaultFormState = {
  actionPlanId: "",
  code: "",
  rationale: "",
  deliveryPartner: "",
  deliveryMode: "partner", // partner | in_house
  startDate: "",
  endDate: "",
  durationDays: "",
  plannedCost: "",
  notes: "",
  eiConsent: null,
  nocVersion: "",
  nocCode: "",
  institution: "",
  programName: "",
  childcareNeed: "",
  childcareFunding: "",
  postingContext: "external",
  itpDetails: "",
  wageSubsidyDetails: "",
  barriers: [],
  itp: {
    tuition: "",
    books: "",
    materials: "",
    living: "",
  },
  wage: {
    wages: "",
    mercs: "",
    nonwages: "",
    other: "",
  },
  eiVerificationStatus: "",
  eiVerificationNotes: "",
  decisionOutcome: "",
  decisionNotes: "",
};

const parseCurrencyInput = value => {
  if (value === null || typeof value === "undefined") return null;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
};

const countWords = value => {
  if (!value) return 0;
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
};

const limitWords = (value, maxWords) => {
  if (!value) return "";
  const words = String(value).trim().split(/\s+/);
  if (words.length <= maxWords) return value;
  return words.slice(0, maxWords).join(" ");
};

const formatCurrencyDisplay = value => {
  const num = parseCurrencyInput(value);
  if (num === null) return "";
  return `$ ${num.toFixed(2)}`;
};

const formatDocTypeLabel = value => {
  if (!value) return "";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
};

const sumCurrency = entries => {
  if (!entries || typeof entries !== "object") return 0;
  return Object.values(entries).reduce((acc, val) => {
    const num = parseCurrencyInput(val);
    return acc + (Number.isFinite(num) ? num : 0);
  }, 0);
};

const EDUCATION_CODES = new Set([4, 5, 9, 10, 11, 12, 13]);
const EMPLOYER_CODES = new Set([6, 7, 8, 17]);

const requiresNocForCode = value => {
  if (!value) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && EMPLOYER_CODES.has(numeric);
};

const requiresInstitutionForCode = value => {
  if (!value) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && EDUCATION_CODES.has(numeric);
};

const isEducationCode = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && EDUCATION_CODES.has(numeric);
};

const isEmployerCode = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && EMPLOYER_CODES.has(numeric);
};

const isWageSubsidyCode = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && new Set([7, 8]).has(numeric);
};

const requiresExternalPartner = value => isEducationCode(value) || isEmployerCode(value);

const barrierOptions = [
  { value: "education", label: "Education" },
  { value: "lack_of_skills", label: "Lack of marketable skills" },
  { value: "lack_of_experience", label: "Lack of work experience" },
  { value: "remoteness", label: "Remoteness" },
  { value: "transportation", label: "Lack of transportation" },
  { value: "economic", label: "Economic" },
  { value: "language", label: "Language" },
  { value: "dependent_care", label: "Dependent care" },
  { value: "health", label: "Health" },
  { value: "other", label: "Other" },
];

const ESDC_OPTIONS = [
  { label: "CRF", value: "CRF" },
  { label: "EI Active Claim", value: "EI Active Claim" },
  { label: "EI Reach Back", value: "EI Reach Back" },
];
const EI_ELIGIBILITY_ROLE_KEYS = new Set([
  "systemadministrator",
  "sysadmin",
  "programadministrator",
  "programadmin",
  "nwacadministrator",
  "regionalcoordinator",
  "regionalmanager",
]);
const normalizeRoleKey = value =>
  String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
const normalizeFundingStream = value => {
  if (!value) return "";
  const normalized = String(value).trim().toUpperCase();
  if (normalized.includes("CRF")) return "CRF";
  if (normalized.includes("EI")) return "EI";
  return normalized;
};
const deriveFundingStreamFromEiStatus = status => {
  if (!status) return "";
  const normalized = String(status).trim().toUpperCase();
  return normalized === "CRF" ? "CRF" : "EI";
};
const ELIGIBILITY_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/bmp",
  "image/tiff",
];
const ELIGIBILITY_MAX_BYTES = 6 * 1024 * 1024;

const DECISION_OPTIONS = [
  { value: "approved", label: "Approve" },
  { value: "changes_requested", label: "Request changes" },
  { value: "rejected", label: "Reject" },
];

const BASE_STEP_IDS = ["framing", "rationale", "type", "cost", "docs", "review"];
const SUBMITTED_STEP_IDS = ["ei", "decision"];
const ALL_STEP_IDS = [...BASE_STEP_IDS, ...SUBMITTED_STEP_IDS];
const STEP_LABELS = {
  framing: "What is being proposed?",
  rationale: "Why is this intervention needed?",
  type: "How will the intervention be delivered?",
  cost: "What does it cost?",
  docs: "Do you have the right supporting documents?",
  review: "Review and submit",
  ei: "EI status verification",
  decision: "Record of decision",
};
const REQUIRED_STEP_IDS = BASE_STEP_IDS.slice(0, 5);

const RATIONALE_WORD_LIMIT = 400;

const InterventionAssessmentWidget = ({ actions }) => {
  const currentUser = useCurrentUser();
  const {
    caseId: workspaceCaseId,
    caseData,
    selectedActionPlanId,
    setSelectedActionPlanId,
    selectedInterventionId,
    setSelectedInterventionId,
    getInterventionWizardStep,
    getInterventionWizardKeyForCase,
    getInterventionWizardDraft,
    setInterventionWizardStep,
    setInterventionWizardDraft,
    clearInterventionWizardStep,
    clearInterventionWizardDraft,
    interventionCodes,
    interventionCodesLoading,
    loadInterventionCodes,
    createIntervention,
    updateIntervention,
    nocVersions,
    nocVersionsLoading,
    loadNocVersions,
    searchNocCodes,
  } = useCaseWorkspace();

  const resolveInitialStep = useCallback(() => {
    if (typeof getInterventionWizardStep !== "function") return BASE_STEP_IDS[0];
    const resolvedCaseId = workspaceCaseId ?? caseData?.id ?? caseData?.case_id ?? null;
    if (!resolvedCaseId) return BASE_STEP_IDS[0];
    const lastKey =
      typeof getInterventionWizardKeyForCase === "function"
        ? getInterventionWizardKeyForCase(resolvedCaseId)
        : null;
    const keyId = selectedInterventionId ? String(selectedInterventionId) : null;
    const resolvedKey = keyId ? `${resolvedCaseId}:${keyId}` : lastKey || `${resolvedCaseId}:draft`;
    const storedStep = getInterventionWizardStep(resolvedKey);
    return storedStep && BASE_STEP_IDS.includes(storedStep) ? storedStep : BASE_STEP_IDS[0];
  }, [
    workspaceCaseId,
    caseData,
    selectedInterventionId,
    getInterventionWizardKeyForCase,
    getInterventionWizardStep,
  ]);
  const resolveInitialForm = useCallback(() => {
    if (typeof getInterventionWizardDraft !== "function") return defaultFormState;
    const resolvedCaseId = workspaceCaseId ?? caseData?.id ?? caseData?.case_id ?? null;
    if (!resolvedCaseId) return defaultFormState;
    const lastKey =
      typeof getInterventionWizardKeyForCase === "function"
        ? getInterventionWizardKeyForCase(resolvedCaseId)
        : null;
    const keyId = selectedInterventionId ? String(selectedInterventionId) : null;
    const resolvedKey = keyId ? `${resolvedCaseId}:${keyId}` : lastKey || `${resolvedCaseId}:draft`;
    const storedDraft = getInterventionWizardDraft(resolvedKey);
    if (!storedDraft || typeof storedDraft !== "object") return defaultFormState;
    return { ...defaultFormState, ...storedDraft };
  }, [
    workspaceCaseId,
    caseData,
    selectedInterventionId,
    getInterventionWizardKeyForCase,
    getInterventionWizardDraft,
  ]);

  const [form, setForm] = useState(resolveInitialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [nocOptions, setNocOptions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(resolveInitialStep);
  const [attemptedSteps, setAttemptedSteps] = useState({});
  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState(null);
  const [missingRequiredCount, setMissingRequiredCount] = useState(0);
  const [showDocsInfoAlert, setShowDocsInfoAlert] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState({});
  const [checklistUploadError, setChecklistUploadError] = useState(null);
  const [checklistUploadSuccess, setChecklistUploadSuccess] = useState(null);
  const [checklistUploadModalVisible, setChecklistUploadModalVisible] = useState(false);
  const [checklistUploadDocTypes, setChecklistUploadDocTypes] = useState([]);
  const [checklistUploadDocType, setChecklistUploadDocType] = useState("");
  const [checklistUploadLabel, setChecklistUploadLabel] = useState("");
  const [checklistUploading, setChecklistUploading] = useState(false);
  const [decisionBlockerVisible, setDecisionBlockerVisible] = useState(false);
  const [decisionBlockerReasons, setDecisionBlockerReasons] = useState([]);
  const [decisionBlockerTargetStep, setDecisionBlockerTargetStep] = useState(null);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [autoHydrateEnabled, setAutoHydrateEnabled] = useState(true);
  const [hydratedDraftId, setHydratedDraftId] = useState(null);
  const [hydratedDraftUpdatedAt, setHydratedDraftUpdatedAt] = useState(null);
  const [currentInterventionStatus, setCurrentInterventionStatus] = useState(null);
  const [eiVerificationFile, setEiVerificationFile] = useState(null);
  const [eiVerificationFileError, setEiVerificationFileError] = useState(null);
  const [eiVerificationUploadError, setEiVerificationUploadError] = useState(null);
  const [eiVerificationUploadSuccess, setEiVerificationUploadSuccess] = useState(null);
  const [eiVerificationUploading, setEiVerificationUploading] = useState(false);
  const eiVerificationFileInputRef = useRef(null);
  const checklistFileInputRef = useRef(null);
  const nextChecklistDocTypeRef = useRef("");
  const nextChecklistLabelRef = useRef("");
  const skipAutoResetsRef = useRef(false);
  const wizardStepRestoreKeyRef = useRef(null);
  const wizardStepRestoreStepsRef = useRef(null);

  const caseId = useMemo(
    () => workspaceCaseId ?? caseData?.id ?? caseData?.case_id ?? null,
    [workspaceCaseId, caseData]
  );
  const logWizard = useCallback(() => {}, []);
  const resolveStoredStep = useCallback(
    (key, stepIds = ALL_STEP_IDS) => {
      if (!key || typeof getInterventionWizardStep !== "function") return null;
      const stored = getInterventionWizardStep(key);
      if (!stored) return null;
      return stepIds.includes(stored) ? stored : null;
    },
    [getInterventionWizardStep]
  );
  const resolveStoredDraft = useCallback(
    key => {
      if (!key || typeof getInterventionWizardDraft !== "function") return null;
      const stored = getInterventionWizardDraft(key);
      return stored && typeof stored === "object" ? stored : null;
    },
    [getInterventionWizardDraft]
  );
  const hasMeaningfulDraft = useCallback(draft => {
    if (!draft || typeof draft !== "object") return false;
    const textKeys = [
      "code",
      "rationale",
      "deliveryPartner",
      "startDate",
      "endDate",
      "durationDays",
      "plannedCost",
      "notes",
      "nocVersion",
      "nocCode",
      "institution",
      "programName",
      "childcareNeed",
      "childcareFunding",
      "itpDetails",
      "wageSubsidyDetails",
      "eiVerificationStatus",
      "eiVerificationNotes",
      "decisionOutcome",
      "decisionNotes",
    ];
    if (textKeys.some(key => String(draft[key] || "").trim())) return true;
    if (draft.deliveryMode && draft.deliveryMode !== "partner") return true;
    if (draft.postingContext && draft.postingContext !== "external") return true;
    if (draft.eiConsent !== null && typeof draft.eiConsent !== "undefined") return true;
    if (Array.isArray(draft.barriers) && draft.barriers.length) return true;
    const hasNestedValues = obj =>
      obj && Object.values(obj).some(value => String(value || "").trim());
    if (hasNestedValues(draft.itp) || hasNestedValues(draft.wage)) return true;
    return false;
  }, []);
  const mergeStoredDraft = useCallback((baseForm, storedDraft) => {
    if (!storedDraft) return baseForm;
    const merged = { ...baseForm, ...storedDraft };
    if (storedDraft.itp) {
      merged.itp = { ...baseForm.itp, ...storedDraft.itp };
    }
    if (storedDraft.wage) {
      merged.wage = { ...baseForm.wage, ...storedDraft.wage };
    }
    return merged;
  }, []);
  const dismissAlert = useCallback(
    key => {
      setDismissedAlerts(prev => ({ ...prev, [key]: true }));
    },
    [setDismissedAlerts]
  );
  const openWorkspaceWidget = useCallback((widgetId, rowSpan, columnSpan) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("iset-case-workspace:add-widget", {
        detail: { id: widgetId, rowSpan, columnSpan },
      })
    );
  }, []);
  const applicantUserId = useMemo(
    () => caseData?.applicantUserId ?? caseData?.applicant_user_id ?? null,
    [caseData]
  );
  const activeInterventionId = useMemo(
    () => selectedInterventionId ?? selectedDraftId ?? hydratedDraftId ?? null,
    [selectedInterventionId, selectedDraftId, hydratedDraftId]
  );
  const activeInterventionIdValue = useMemo(
    () => (activeInterventionId ? String(activeInterventionId) : null),
    [activeInterventionId]
  );
  const wizardStepKey = useMemo(() => {
    if (!caseId) return null;
    const keyId = selectedInterventionId ? String(selectedInterventionId) : null;
    if (keyId) return `${caseId}:${keyId}`;
    if (typeof getInterventionWizardKeyForCase === "function") {
      const lastKey = getInterventionWizardKeyForCase(caseId);
      if (lastKey) return lastKey;
    }
    return `${caseId}:draft`;
  }, [caseId, selectedInterventionId, getInterventionWizardKeyForCase]);
  const hasBlockingProposal = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans.some(plan =>
      (plan.interventions || []).some(intervention => {
        const statusValue = String(intervention?.status || "").toLowerCase();
        return statusValue === "draft" || statusValue === "submitted";
      })
    );
  }, [caseData]);
  const statusValue = String(currentInterventionStatus || "").toLowerCase();
  const isDraftStatus = statusValue === "draft";
  const isSubmittedStatus = statusValue === "submitted";
  const role = currentUser?.role || null;
  const canonicalRole = role === "Regional Manager" ? "Regional Coordinator" : role;
  const canManageEiEligibility = EI_ELIGIBILITY_ROLE_KEYS.has(normalizeRoleKey(role));
  const canEditSubmitted =
    canonicalRole === "Regional Coordinator" ||
    canonicalRole === "Program Administrator" ||
    canonicalRole === "System Administrator";
  const isEditable = isDraftStatus || (isSubmittedStatus && canEditSubmitted) || (!statusValue && !hasBlockingProposal);
  const isFormLocked = !isEditable || isSubmitting;
  const statusLabel = statusValue
    ? statusValue.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase())
    : hasBlockingProposal
      ? "Read only"
      : "Draft";
  const headerDescription = isSubmittedStatus && isEditable
    ? "Review the submitted proposal, verify EI status, and record the decision. Updates are saved to the submission."
    : isEditable
      ? 'Propose a new intervention for this client. Once completed this will be sent for approval. You can save your work and finish it later using "Save Progress" above. Only one new intervention can be proposed at a time for a participant.'
      : statusValue
        ? "Viewing this intervention in read-only mode."
        : "Select a draft or submitted proposal from the Interventions table to view it here.";
  const activeStepIds = useMemo(
    () => (isSubmittedStatus ? [...BASE_STEP_IDS, ...SUBMITTED_STEP_IDS] : BASE_STEP_IDS),
    [isSubmittedStatus]
  );
  const docsChecklistReady = Boolean(activeInterventionIdValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = event => {
      if (event?.detail?.id !== "interventionAssessment") return;
      if (typeof clearInterventionWizardStep === "function") {
        logWizard("widget removed; clearing stored step", { wizardStepKey });
        clearInterventionWizardStep();
      }
      if (typeof clearInterventionWizardDraft === "function") {
        logWizard("widget removed; clearing stored draft", { wizardStepKey });
        clearInterventionWizardDraft();
      }
    };
    window.addEventListener("iset-case-workspace:widget-removed", handler);
    return () => window.removeEventListener("iset-case-workspace:widget-removed", handler);
  }, [clearInterventionWizardStep, clearInterventionWizardDraft, logWizard, wizardStepKey]);

  useEffect(() => {
    if (!wizardStepKey) return;
    const stepSignature = activeStepIds.join("|");
    const keyChanged = wizardStepRestoreKeyRef.current !== wizardStepKey;
    const stepsChanged = wizardStepRestoreStepsRef.current !== stepSignature;
    if (!keyChanged && !stepsChanged) return;
    wizardStepRestoreKeyRef.current = wizardStepKey;
    wizardStepRestoreStepsRef.current = stepSignature;
    const storedStep = resolveStoredStep(wizardStepKey, activeStepIds);
    logWizard("restore check", {
      wizardStepKey,
      storedStep,
      currentStep,
      activeStepIds,
      keyChanged,
      stepsChanged,
      selectedInterventionId,
    });
    if (storedStep && activeStepIds.includes(storedStep) && storedStep !== currentStep) {
      logWizard("restore step", { from: currentStep, to: storedStep });
      setCurrentStep(storedStep);
      return;
    }
    if (stepsChanged && !activeStepIds.includes(currentStep)) {
      logWizard("clamp step to start", { from: currentStep });
      setCurrentStep(BASE_STEP_IDS[0]);
    }
  }, [wizardStepKey, activeStepIds, currentStep, logWizard, resolveStoredStep]);

  useEffect(() => {
    if (!wizardStepKey || typeof setInterventionWizardStep !== "function") return;
    logWizard("persist step", { wizardStepKey, currentStep });
    setInterventionWizardStep(wizardStepKey, currentStep);
  }, [wizardStepKey, currentStep, setInterventionWizardStep]);

  useEffect(() => {
    if (!wizardStepKey || typeof setInterventionWizardDraft !== "function") return;
    setInterventionWizardDraft(wizardStepKey, form);
  }, [wizardStepKey, form, setInterventionWizardDraft]);
  const docsChecklistComplete =
    docsChecklistReady && missingRequiredCount === 0 && !checklistLoading && !checklistError;

  const isDateOrderValid = useCallback(() => {
    if (!form.startDate || !form.endDate) return false;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return end >= start;
  }, [form.startDate, form.endDate]);

  const reviewMissingReasons = useMemo(() => {
    const reasons = [];
    if (!form.code) reasons.push("Intervention code");
    if (!form.startDate) reasons.push("Start date");
    if (form.startDate && form.endDate && !isDateOrderValid()) {
      reasons.push("Start date must be on or before end date");
    }
    if (!form.rationale || !form.rationale.trim()) reasons.push("Rationale and goals");

    if (form.code) {
      if (isEducationCode(form.code)) {
        if (!form.institution || !form.institution.trim()) reasons.push("Institution");
        if (!form.itpDetails || !form.itpDetails.trim()) reasons.push("ITP details");
      } else if (isEmployerCode(form.code)) {
        if (!form.deliveryPartner || !form.deliveryPartner.trim()) reasons.push("Employer / delivery partner");
        if (!form.nocVersion) reasons.push("NOC version");
        if (!form.nocCode) reasons.push("NOC code");
        if (isWageSubsidyCode(form.code) && (!form.wageSubsidyDetails || !form.wageSubsidyDetails.trim())) {
          reasons.push("Wage subsidy details");
        }
      } else if (form.deliveryMode !== "in_house" && (!form.deliveryPartner || !form.deliveryPartner.trim())) {
        reasons.push("Delivery partner or set delivery mode to in-house");
      }
    }

    if (!isSubmittedStatus) {
      if (!docsChecklistReady) {
        reasons.push("Save progress to enable the documents checklist");
      } else if (checklistLoading) {
        reasons.push("Wait for the documents checklist to finish loading");
      } else if (checklistError) {
        reasons.push("Resolve the documents checklist error");
      } else if (missingRequiredCount > 0) {
        reasons.push("Upload missing documents in Step 5");
      }
    }
    return reasons;
  }, [
    checklistError,
    checklistLoading,
    docsChecklistReady,
    form.code,
    form.deliveryMode,
    form.deliveryPartner,
    form.endDate,
    form.institution,
    form.itpDetails,
    form.nocCode,
    form.nocVersion,
    form.rationale,
    form.startDate,
    form.wageSubsidyDetails,
    isDateOrderValid,
    isSubmittedStatus,
    missingRequiredCount,
  ]);

  const reviewStepErrorText = useMemo(() => {
    if (!reviewMissingReasons.length) return "Complete required fields before continuing.";
    return `Missing: ${reviewMissingReasons.join(" · ")}`;
  }, [reviewMissingReasons]);

  useEffect(() => {
    if (!interventionCodesLoading && (!interventionCodes || interventionCodes.length === 0)) {
      loadInterventionCodes().catch(() => {});
    }
  }, [interventionCodes, interventionCodesLoading, loadInterventionCodes]);

  useEffect(() => {
    if (!nocVersionsLoading && (!nocVersions || nocVersions.length === 0)) {
      loadNocVersions().catch(() => {});
    }
  }, [nocVersions, nocVersionsLoading, loadNocVersions]);

  const planOptions = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans.map(plan => ({
      value: String(plan.id),
      label: plan.title || `Action Plan ${plan.id}`,
      description: plan.status ? `Status: ${plan.status}` : "",
    }));
  }, [caseData]);
  const selectedPlan = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    if (!plans.length) return null;
    const selectedId = form.actionPlanId || selectedActionPlanId;
    if (selectedId) {
      return plans.find(plan => String(plan.id) === String(selectedId)) || null;
    }
    return plans[0] || null;
  }, [caseData, form.actionPlanId, selectedActionPlanId]);
  const selectedPlanFundingStream = useMemo(
    () => normalizeFundingStream(selectedPlan?.fundingStream || selectedPlan?.funding_stream),
    [selectedPlan]
  );
  const requiredFundingStream = useMemo(
    () => deriveFundingStreamFromEiStatus(form.eiVerificationStatus),
    [form.eiVerificationStatus]
  );
  const hasPlanFundingMismatch = useMemo(
    () =>
      Boolean(
        requiredFundingStream &&
          selectedPlanFundingStream &&
          requiredFundingStream !== selectedPlanFundingStream
      ),
    [requiredFundingStream, selectedPlanFundingStream]
  );
  const planMismatchAlertText = useMemo(() => {
    if (!hasPlanFundingMismatch) return "";
    const planLabel =
      selectedPlan?.title || (selectedPlan?.id ? `Action Plan ${selectedPlan.id}` : "the selected Action Plan");
    return `EI eligibility indicates ${requiredFundingStream} funding, but ${planLabel} is set to ${selectedPlanFundingStream}. Close out the current Action Plan, create a new ${requiredFundingStream} plan (only one Action Plan can be active at a time), then select it below to continue.`;
  }, [hasPlanFundingMismatch, requiredFundingStream, selectedPlan, selectedPlanFundingStream]);
  const planSelectorErrorText = useMemo(() => {
    if (hasPlanFundingMismatch) {
      return `Funding stream mismatch: EI status indicates ${requiredFundingStream}, but this Action Plan is ${selectedPlanFundingStream}.`;
    }
    if (!form.actionPlanId) return "Action Plan is required.";
    return undefined;
  }, [hasPlanFundingMismatch, requiredFundingStream, selectedPlanFundingStream, form.actionPlanId]);

  const scrollToWidget = useCallback(() => {
    if (typeof document === "undefined") return;
    const container = document.getElementById("intervention-assessment-widget");
    if (container?.scrollIntoView) {
      container.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    const handleSelect = event => {
      const detail = event?.detail || {};
      const interventionId = detail.interventionId;
      if (!interventionId) return;
      const selectionKey = caseId ? `${caseId}:${interventionId}` : null;
      const storedStep = resolveStoredStep(selectionKey);
      logWizard("select intervention", {
        interventionId,
        selectionKey,
        storedStep,
        planId: detail?.planId ?? null,
        caseId,
      });
      if (typeof setSelectedInterventionId === "function") {
        const numericInterventionId = Number(interventionId);
        setSelectedInterventionId(Number.isFinite(numericInterventionId) ? numericInterventionId : interventionId);
      }
      const planId = detail.planId;
      setAutoHydrateEnabled(true);
      setSelectedDraftId(interventionId);
      setHydratedDraftId(null);
      setHydratedDraftUpdatedAt(null);
      setCurrentInterventionStatus(null);
      setError(null);
      setSuccessMessage("");
      setAttemptedSteps({});
      setCurrentStep(storedStep || BASE_STEP_IDS[0]);
      if (planId) {
        const numericPlanId = Number(planId);
        const resolvedPlanId = Number.isFinite(numericPlanId) ? numericPlanId : planId;
        setForm(prev => ({ ...prev, actionPlanId: String(planId) }));
        if (typeof setSelectedActionPlanId === "function") {
          setSelectedActionPlanId(resolvedPlanId);
        }
      }
      scrollToWidget();
    };

    const handleNew = event => {
      const detail = event?.detail || {};
      const planId = detail.planId;
      if (hasBlockingProposal) {
        setError("A draft or submitted proposal already exists. Resume it from the table.");
        setSuccessMessage("");
        scrollToWidget();
        return;
      }
      logWizard("new draft", { planId });
      setAutoHydrateEnabled(false);
      setSelectedDraftId(null);
      setHydratedDraftId(null);
      setHydratedDraftUpdatedAt(null);
      setCurrentInterventionStatus(null);
      if (typeof setSelectedInterventionId === "function") {
        setSelectedInterventionId(null);
      }
      setError(null);
      setSuccessMessage("");
      setAttemptedSteps({});
      setCurrentStep(BASE_STEP_IDS[0]);
      setForm(prev => ({
        ...defaultFormState,
        actionPlanId: planId ? String(planId) : form.actionPlanId,
      }));
      if (planId && typeof setSelectedActionPlanId === "function") {
        const numericPlanId = Number(planId);
        setSelectedActionPlanId(Number.isFinite(numericPlanId) ? numericPlanId : planId);
      }
      scrollToWidget();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("iset:intervention-assessment:select", handleSelect);
      window.addEventListener("iset:intervention-assessment:new", handleNew);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("iset:intervention-assessment:select", handleSelect);
        window.removeEventListener("iset:intervention-assessment:new", handleNew);
      }
    };
  }, [
    caseId,
    hasBlockingProposal,
    logWizard,
    resolveStoredStep,
    scrollToWidget,
    setSelectedActionPlanId,
    setSelectedInterventionId,
  ]);

  useEffect(() => {
    if (form.actionPlanId || planOptions.length === 0) return;
    const preferred = planOptions.find(option => option.value === String(selectedActionPlanId));
    const fallback = planOptions[0];
    if (preferred) {
      setForm(prev => ({ ...prev, actionPlanId: preferred.value }));
    } else if (fallback) {
      setForm(prev => ({ ...prev, actionPlanId: fallback.value }));
    }
  }, [planOptions, selectedActionPlanId, form.actionPlanId]);

  const codeOptions = useMemo(() => {
    if (!Array.isArray(interventionCodes) || interventionCodes.length === 0) return [];
    return interventionCodes.map(item => ({
      value: String(item.code),
      label: `${item.code} — ${item.label}`,
      codeLabel: item.label,
    }));
  }, [interventionCodes]);


  const nocVersionOptions = useMemo(() => {
    if (!Array.isArray(nocVersions)) return [];
    return nocVersions
      .map(item => ({
        value: item.value || item.code || "",
        label: item.label || item.code || "",
        description: item.description || "",
      }))
      .filter(item => item.value && item.label);
  }, [nocVersions]);

  const fetchNocSuggestions = useCallback(
    async query => {
      const trimmed = (query || "").trim();
      if (!trimmed || trimmed.length < 2 || !form.nocVersion || typeof searchNocCodes !== "function") {
        setNocOptions([]);
        return;
      }
      try {
        setNocSuggestionsLoading(true);
        const results = await searchNocCodes({ query: trimmed, version: form.nocVersion });
        const options = Array.isArray(results)
          ? results.slice(0, 25).map(item => ({
              value: item.code || item.value || "",
              label: item.title ? `${item.code} — ${item.title}` : item.label || item.description || item.code || "",
              description: item.title || item.description || "",
            }))
          : [];
        setNocOptions(options);
      } catch (err) {
        setNocOptions([]);
      } finally {
        setNocSuggestionsLoading(false);
      }
    },
    [form.nocVersion, searchNocCodes]
  );

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleItp = (key, value) => {
    setForm(prev => ({ ...prev, itp: { ...prev.itp, [key]: value } }));
  };

  const handleWage = (key, value) => {
    setForm(prev => ({ ...prev, wage: { ...prev.wage, [key]: value } }));
  };

  const usesCostTables = isEducationCode(form.code) || isEmployerCode(form.code);

  const findExistingDraft = useCallback(() => {
    const plans = caseData?.actionPlans || [];
    const isDraft = status => String(status || "").toLowerCase() === "draft";
    const findById = draftId => {
      const target = String(draftId);
      for (const plan of plans) {
        const list = Array.isArray(plan.interventions) ? plan.interventions : [];
        const match = list.find(item => String(item?.id) === target);
        if (match) return match;
      }
      return null;
    };
    if (selectedDraftId) {
      const match = findById(selectedDraftId);
      if (match && isDraft(match.status)) return match;
    }
    if (hydratedDraftId) {
      const match = findById(hydratedDraftId);
      if (match && isDraft(match.status)) return match;
    }
    const planMatch = plans.find(plan => String(plan.id) === String(form.actionPlanId));
    const planDrafts = planMatch?.interventions?.filter(item => isDraft(item?.status)) || [];
    if (planDrafts.length) {
      return planDrafts.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })[0];
    }
    const allDrafts = plans.flatMap(plan => plan.interventions || []).filter(item => isDraft(item?.status));
    if (!allDrafts.length) return null;
    return allDrafts.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    })[0];
  }, [caseData, form.actionPlanId, hydratedDraftId, selectedDraftId]);

  const findSelectedIntervention = useCallback(() => {
    const plans = caseData?.actionPlans || [];
    const targetId = selectedInterventionId || selectedDraftId || hydratedDraftId;
    if (!targetId) return null;
    const target = String(targetId);
    for (const plan of plans) {
      const list = Array.isArray(plan.interventions) ? plan.interventions : [];
      const match = list.find(item => String(item?.id) === target);
      if (match) return match;
    }
    return null;
  }, [caseData, hydratedDraftId, selectedDraftId, selectedInterventionId]);

  const resolvePlanIdValue = useCallback(value => {
    if (value === null || typeof value === "undefined" || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }, []);

  const getPlanReassignment = useCallback(() => {
    const nextPlanId = resolvePlanIdValue(form.actionPlanId);
    if (!nextPlanId) return null;
    const selected = findSelectedIntervention();
    const currentPlanId = resolvePlanIdValue(selected?.actionPlanId);
    if (currentPlanId && String(currentPlanId) === String(nextPlanId)) return null;
    return {
      interventionId: selected?.id || activeInterventionIdValue,
      nextPlanId,
      currentPlanId,
    };
  }, [activeInterventionIdValue, findSelectedIntervention, form.actionPlanId, resolvePlanIdValue]);

  const persistPlanReassignment = useCallback(async () => {
    const reassignment = getPlanReassignment();
    if (!reassignment) return true;
    if (!reassignment.interventionId || typeof updateIntervention !== "function") {
      setError("Select a submitted proposal before reassigning the Action Plan.");
      return false;
    }
    const numericInterventionId = Number(reassignment.interventionId);
    const resolvedInterventionId = Number.isFinite(numericInterventionId)
      ? numericInterventionId
      : reassignment.interventionId;
    try {
      await updateIntervention(reassignment.nextPlanId, resolvedInterventionId, {
        actionPlanId: reassignment.nextPlanId,
      });
      if (typeof setSelectedActionPlanId === "function") {
        setSelectedActionPlanId(reassignment.nextPlanId);
      }
      return true;
    } catch (err) {
      setError(err?.message || "Unable to update the Action Plan for this intervention.");
      return false;
    }
  }, [getPlanReassignment, setError, setSelectedActionPlanId, updateIntervention]);

  const buildPayload = useCallback(
    statusValue => {
      const selectedCode = codeOptions.find(option => option.value === form.code);
      const derivedTitle = selectedCode?.label || form.code || "Draft intervention";
      const tableCost = isEducationCode(form.code)
        ? sumCurrency(form.itp)
        : isEmployerCode(form.code)
          ? sumCurrency(form.wage)
          : 0;
      const parsedPlanned = parseCurrencyInput(form.plannedCost);
      const costValue = usesCostTables ? tableCost : parsedPlanned ?? 0;
      return {
        code: form.code || null,
        title: derivedTitle,
        status: statusValue,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        durationDays: form.durationDays ? Number(form.durationDays) : null,
        cost: costValue,
        notes: form.rationale || form.notes || "",
        metadata: {
          snapshot: {
            code: form.code || null,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            durationDays: form.durationDays || null,
            rationale: form.rationale || "",
            deliveryMode: form.deliveryMode,
            deliveryPartner: form.deliveryPartner || "",
            nocVersion: form.nocVersion || "",
            nocCode: form.nocCode || "",
            institution: form.institution || "",
            programName: form.programName || "",
            postingContext: form.postingContext || null,
            itpDetails: form.itpDetails || "",
            wageSubsidyDetails: form.wageSubsidyDetails || "",
            itp: form.itp || { tuition: "", books: "", materials: "", living: "" },
            wage: form.wage || { wages: "", mercs: "", nonwages: "", other: "" },
            barriers: Array.isArray(form.barriers) ? form.barriers.map(item => item.value || item) : [],
            eiConsentProvided: form.eiConsent || false,
            plannedCost: form.plannedCost || "",
          },
          proposalNotes: form.notes || "",
          eiConsentProvided: form.eiConsent || false,
          deliveryPartner: form.deliveryPartner || "",
          itpDetails: form.itpDetails || "",
          wageSubsidyDetails: form.wageSubsidyDetails || "",
          barriers: Array.isArray(form.barriers) ? form.barriers.map(item => item.value || item) : [],
          itp: form.itp || { tuition: "", books: "", materials: "", living: "" },
          wage: form.wage || { wages: "", mercs: "", nonwages: "", other: "" },
          postingContext: form.postingContext || null,
          cost: costValue,
          review: {
            eiStatus: form.eiVerificationStatus || "",
            eiNotes: form.eiVerificationNotes || "",
            decision: form.decisionOutcome || "",
            decisionNotes: form.decisionNotes || "",
          },
        },
        noc: form.nocCode || null,
        nocVersion: form.nocVersion || null,
        institution: form.institution || null,
        programName: form.programName || null,
        postingContext: form.postingContext || null,
      };
    },
    [codeOptions, form, usesCostTables]
  );

  useEffect(() => {
    if (skipAutoResetsRef.current) {
      return;
    }
    if (!form.code) {
      return;
    }
    // Reset delivery mode appropriately when code changes, to keep type-step logic consistent
    setForm(prev => {
      const mustUsePartner = requiresExternalPartner(form.code);
      const nextMode = mustUsePartner ? "partner" : "partner";
      return {
        ...prev,
        deliveryMode: nextMode,
        deliveryPartner: "",
        wageSubsidyDetails: "",
        nocCode: requiresNocForCode(form.code) ? prev.nocCode : "",
        nocVersion: requiresNocForCode(form.code) ? prev.nocVersion : "",
        institution: isEducationCode(form.code) ? prev.institution : "",
        programName: isEducationCode(form.code) || isEmployerCode(form.code) ? prev.programName : "",
        itpDetails: isEducationCode(form.code) ? prev.itpDetails : "",
        itp: isEducationCode(form.code) ? prev.itp : { tuition: "", books: "", materials: "", living: "" },
        wage: isEmployerCode(form.code) ? prev.wage : { wages: "", mercs: "", nonwages: "", other: "" },
        plannedCost: usesCostTables ? "" : prev.plannedCost,
      };
    });

    if (!requiresNocForCode(form.code)) {
      setNocOptions([]);
    }
  }, [form.code]);

  useEffect(() => {
    if (!form.nocVersion) {
      setNocOptions([]);
      if (form.nocCode) {
        setForm(prev => ({ ...prev, nocCode: "" }));
      }
    }
  }, [form.nocVersion, form.nocCode]);

  useEffect(() => {
    if (!form.startDate || !form.endDate) {
      if (form.durationDays) setForm(prev => ({ ...prev, durationDays: "" }));
      return;
    }
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      if (form.durationDays) setForm(prev => ({ ...prev, durationDays: "" }));
      return;
    }
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const next = String(diff);
    if (next !== form.durationDays) {
      setForm(prev => ({ ...prev, durationDays: next }));
    }
  }, [form.startDate, form.endDate, form.durationDays]);

  useEffect(() => {
    if (skipAutoResetsRef.current) {
      return;
    }
    if (form.deliveryMode === "in_house" && form.deliveryPartner) {
      setForm(prev => ({ ...prev, deliveryPartner: "", wageSubsidyDetails: "" }));
    }
  }, [form.deliveryMode]);

  const validateStep = useCallback(
    stepId => {
      if (stepId === "framing") {
        return Boolean(form.code) && Boolean(form.startDate) && (!form.endDate || isDateOrderValid());
      }
      if (stepId === "rationale") {
        return Boolean(form.rationale && form.rationale.trim());
      }
      if (stepId === "type") {
        if (isEducationCode(form.code)) {
          return (
            Boolean(form.institution && form.institution.trim()) &&
            Boolean(form.itpDetails && form.itpDetails.trim())
          );
        }
        if (isEmployerCode(form.code)) {
          const base =
            Boolean(form.deliveryPartner && form.deliveryPartner.trim()) &&
            Boolean(form.nocCode && form.nocVersion);
          const wageDetailsOk = !isWageSubsidyCode(form.code) || Boolean(form.wageSubsidyDetails && form.wageSubsidyDetails.trim());
          return base && wageDetailsOk;
        }
        return form.deliveryMode === "in_house" || Boolean(form.deliveryPartner && form.deliveryPartner.trim());
      }
      if (stepId === "cost") {
        const costValid = usesCostTables ? true : true; // optional for non-table types
        return costValid;
      }
      if (stepId === "docs") {
        return isSubmittedStatus ? true : docsChecklistComplete;
      }
      if (stepId === "review") {
        return REQUIRED_STEP_IDS.every(id => {
          if (id === "docs" && isSubmittedStatus) return true;
          return validateStep(id);
        });
      }
      if (stepId === "ei") {
        return Boolean(form.eiVerificationStatus) && !hasPlanFundingMismatch;
      }
      if (stepId === "decision") {
        return true;
      }
      return false;
    },
    [form, isDateOrderValid, docsChecklistComplete, hasPlanFundingMismatch, isSubmittedStatus]
  );

  const isStepValid = useCallback(stepId => validateStep(stepId), [validateStep]);

  const loadChecklist = useCallback(async () => {
    if (!applicantUserId || !activeInterventionIdValue) {
      setChecklistItems([]);
      setMissingRequiredCount(0);
      setChecklistLoading(false);
      setChecklistError(null);
      return;
    }
    setChecklistLoading(true);
    setChecklistError(null);
    try {
      const params = new URLSearchParams();
      params.set("interventionId", activeInterventionIdValue);
      params.set("stage", isSubmittedStatus ? "submitted" : "draft");
      const res = await apiFetch(`/api/applicants/${applicantUserId}/document-checklist?${params.toString()}`, {
        method: "GET",
      });
      if (!res.ok) throw new Error("Failed to load checklist");
      const payload = await res.json().catch(() => ({ items: [], missingRequiredCount: 0 }));
      setChecklistItems(Array.isArray(payload.items) ? payload.items : []);
      setMissingRequiredCount(Number(payload.missingRequiredCount) || 0);
    } catch (err) {
      setChecklistError(err?.message || "Failed to load checklist");
    } finally {
      setChecklistLoading(false);
    }
  }, [applicantUserId, activeInterventionIdValue, isSubmittedStatus]);

  useEffect(() => {
    let cancelled = false;
    if (!applicantUserId) {
      setChecklistItems([]);
      setMissingRequiredCount(0);
      return () => {};
    }
    const safeLoad = async () => {
      if (cancelled) return;
      await loadChecklist();
    };
    safeLoad();
    const handler = event => {
      const targetApplicant = event?.detail?.applicantUserId;
      if (targetApplicant && targetApplicant !== applicantUserId) return;
      loadChecklist();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("iset:supporting-documents:refresh", handler);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("iset:supporting-documents:refresh", handler);
      }
    };
  }, [applicantUserId, loadChecklist]);

  useEffect(() => {
    const plans = caseData?.actionPlans || [];
    const targetPlanId =
      form.actionPlanId ||
      (selectedActionPlanId !== null && typeof selectedActionPlanId !== "undefined"
        ? String(selectedActionPlanId)
        : plans.length
        ? String(plans[0].id)
        : null);
    if (!selectedDraftId && !autoHydrateEnabled) return;
    if (!selectedDraftId && !targetPlanId) return;

    const isDraftStatus = value => String(value || "").toLowerCase() === "draft";
    const sortByRecent = (a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    };
    const findInterventionById = interventionId => {
      const target = String(interventionId);
      for (const plan of plans) {
        const list = Array.isArray(plan.interventions) ? plan.interventions : [];
        const match = list.find(item => String(item?.id) === target);
        if (match) return match;
      }
      return null;
    };
    const pickLatestDraft = list =>
      list
        .filter(item => isDraftStatus(item?.status))
        .sort(sortByRecent)[0];

    const hydrate = draft => {
      if (!draft) return;
      const metadata = draft.metadata || {};
      const snapshot = metadata.snapshot || {};
      const mappedBarriers = Array.isArray(metadata.barriers)
        ? metadata.barriers
            .map(val => barrierOptions.find(opt => opt.value === (val.value || val)))
            .filter(Boolean)
        : Array.isArray(snapshot.barriers)
        ? snapshot.barriers
            .map(val => barrierOptions.find(opt => opt.value === (val.value || val)))
            .filter(Boolean)
        : [];
      const codeValue = snapshot.code || draft.code;
      const deliveryModeValue = requiresExternalPartner(codeValue)
        ? "partner"
        : metadata.deliveryPartner || snapshot.deliveryPartner
        ? "partner"
        : "in_house";
      const tableCostMode = isEducationCode(codeValue) || isEmployerCode(codeValue);
      const plannedCostValue =
        snapshot.plannedCost || draft.plannedCost || (metadata.cost !== undefined ? metadata.cost : "");
      const planId = draft.actionPlanId || targetPlanId;
      const numericPlanId = Number(planId);
      const resolvedPlanId = Number.isFinite(numericPlanId) ? numericPlanId : planId;
      const review = metadata.review && typeof metadata.review === "object" ? metadata.review : {};
      skipAutoResetsRef.current = true;
      setTimeout(() => {
        skipAutoResetsRef.current = false;
      }, 0);
      const storedStepKey = caseId && draft.id ? `${caseId}:${draft.id}` : null;
      const storedDraft = resolveStoredDraft(storedStepKey);
      const shouldMergeDraft = storedDraft && hasMeaningfulDraft(storedDraft);
      const hydratedForm = {
        ...defaultFormState,
        ...form,
        actionPlanId: planId ? String(planId) : form.actionPlanId,
        code: codeValue ? String(codeValue) : "",
        startDate: snapshot.startDate || draft.startDate || "",
        endDate: snapshot.endDate || draft.endDate || "",
        durationDays: snapshot.durationDays
          ? String(snapshot.durationDays)
          : draft.durationDays
          ? String(draft.durationDays)
          : "",
        plannedCost: tableCostMode ? "" : formatCurrencyDisplay(plannedCostValue) || "",
        rationale: snapshot.rationale || draft.notes || metadata.proposalNotes || "",
        notes: metadata.proposalNotes || snapshot.proposalNotes || draft.notes || "",
        deliveryPartner: snapshot.deliveryPartner || metadata.deliveryPartner || "",
        deliveryMode: deliveryModeValue,
        nocVersion: snapshot.nocVersion || draft.nocVersion || "",
        nocCode: snapshot.nocCode || draft.noc || "",
        institution: snapshot.institution || draft.institution || "",
        programName: snapshot.programName || draft.programName || "",
        postingContext: snapshot.postingContext || draft.postingContext || form.postingContext,
        itpDetails: snapshot.itpDetails || metadata.itpDetails || "",
        wageSubsidyDetails: snapshot.wageSubsidyDetails || metadata.wageSubsidyDetails || "",
        barriers: mappedBarriers,
        itp: snapshot.itp || metadata.itp || { tuition: "", books: "", materials: "", living: "" },
        wage: snapshot.wage || metadata.wage || { wages: "", mercs: "", nonwages: "", other: "" },
        eiConsent: snapshot.eiConsentProvided ?? metadata.eiConsentProvided ?? null,
        eiVerificationStatus: review.eiStatus || "",
        eiVerificationNotes: review.eiNotes || "",
        decisionOutcome: review.decision || "",
        decisionNotes: review.decisionNotes || "",
      };
      const nextForm = shouldMergeDraft ? mergeStoredDraft(hydratedForm, storedDraft) : hydratedForm;
      if (storedDraft) {
        logWizard("hydrate merge stored draft", { storedStepKey, stored: shouldMergeDraft });
        if (!shouldMergeDraft) {
          logWizard("hydrate ignored stored draft (empty)", { storedStepKey });
        }
      }
      setForm(nextForm);
      if (planId && typeof setSelectedActionPlanId === "function") {
        setSelectedActionPlanId(resolvedPlanId);
      }
      if (draft.id && typeof setSelectedInterventionId === "function") {
        setSelectedInterventionId(draft.id);
      }
      const draftStatus = String(draft.status || "").toLowerCase();
      const stepIds = draftStatus === "submitted" ? [...BASE_STEP_IDS, ...SUBMITTED_STEP_IDS] : BASE_STEP_IDS;
      const storedStep = resolveStoredStep(storedStepKey, stepIds);
      const nextStep = storedStep || BASE_STEP_IDS[0];
      logWizard("hydrate intervention", {
        interventionId: draft.id,
        storedStepKey,
        storedStep,
        nextStep,
        stepIds,
      });
      setHydratedDraftId(draft.id || null);
      setHydratedDraftUpdatedAt(draft.updatedAt || draft.createdAt || null);
      setCurrentInterventionStatus(String(draft.status || "").toLowerCase() || null);
      setAttemptedSteps({});
      setCurrentStep(nextStep);
      setEiVerificationFile(null);
      setEiVerificationFileError(null);
      setEiVerificationUploadError(null);
      setEiVerificationUploadSuccess(null);
      setEiVerificationUploading(false);
    };

    const localSelection = selectedDraftId ? findInterventionById(selectedDraftId) : null;
    const resolvedIntervention = localSelection
      ? localSelection
      : targetPlanId
      ? pickLatestDraft(
          (plans.find(plan => String(plan.id) === String(targetPlanId))?.interventions || [])
        )
      : null;
    if (resolvedIntervention) {
      const updatedAt = resolvedIntervention.updatedAt || resolvedIntervention.createdAt || null;
      if (resolvedIntervention.id === hydratedDraftId && updatedAt === hydratedDraftUpdatedAt) {
        return;
      }
      hydrate(resolvedIntervention);
      return;
    }

    if (selectedDraftId) {
      logWizard("hydrate missing selection", {
        selectedDraftId,
        targetPlanId,
        interventionCount: plans.reduce((acc, plan) => acc + (plan.interventions || []).length, 0),
      });
    }

    if (!targetPlanId) return;

    // Fallback: fetch interventions for the plan if not present in case data
    (async () => {
      try {
        const res = await apiFetch(`/api/action-plans/${targetPlanId}/interventions`, { method: "GET" });
        if (!res.ok) return;
        const payload = await res.json().catch(() => []);
        const list = Array.isArray(payload) ? payload : [];
        const selected =
          selectedDraftId ? list.find(item => String(item?.id) === String(selectedDraftId)) : null;
        const resolved = selected || pickLatestDraft(list);
        if (!resolved) return;
        const updatedAt = resolved.updatedAt || resolved.createdAt || null;
        if (resolved.id === hydratedDraftId && updatedAt === hydratedDraftUpdatedAt) return;
        hydrate(resolved);
      } catch (_) {
        // ignore hydration errors for now
      }
    })();
  }, [
    apiFetch,
    autoHydrateEnabled,
    caseData,
    caseId,
    form.actionPlanId,
    hydratedDraftId,
    hydratedDraftUpdatedAt,
    logWizard,
    mergeStoredDraft,
    hasMeaningfulDraft,
    resolveStoredDraft,
    resolveStoredStep,
    selectedActionPlanId,
    selectedDraftId,
    setSelectedActionPlanId,
    setSelectedInterventionId,
  ]);

  const uploadEiVerificationIfSelected = useCallback(async ({ interventionId } = {}) => {
    if (isFormLocked) return true;
    if (!eiVerificationFile) {
      return true;
    }
    if (!form.eiVerificationStatus) {
      setEiVerificationUploadError("Select an eligibility value to upload the document.");
      return false;
    }
    if (!applicantUserId) {
      setEiVerificationUploadError("Unable to determine the applicant for this upload.");
      return false;
    }
    const resolvedInterventionId = interventionId || activeInterventionIdValue;
    if (!resolvedInterventionId) {
      setEiVerificationUploadError("Save progress to create the intervention record before uploading EI verification.");
      return false;
    }
    setEiVerificationUploading(true);
    setEiVerificationUploadError(null);
    setEiVerificationUploadSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", eiVerificationFile);
      formData.append("label", "EI Verification");
      formData.append("documentType", "ei_verification");
      if (caseId) formData.append("caseId", caseId);
      formData.append("interventionId", resolvedInterventionId);
      const response = await apiFetch(`/api/applicants/${applicantUserId}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      if (!response || !response.ok) {
        let payload = null;
        try {
          payload = await response.json();
        } catch (_) {
          payload = null;
        }
        const errorCode = payload?.error || null;
        if (errorCode === "unsupported_file_type") {
          throw new Error("That file type is not allowed. Please upload a PDF or image.");
        }
        if (errorCode === "file_too_large") {
          throw new Error("The file is too large to upload.");
        }
        if (errorCode === "application_required_for_document") {
          throw new Error("Select an intervention before uploading this document.");
        }
        if (errorCode === "invalid_document_type") {
          throw new Error("The EI Verification document type is not available.");
        }
        throw new Error(payload?.message || "Failed to upload EI verification document.");
      }
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
          new CustomEvent("iset:supporting-documents:refresh", {
            detail: { applicantUserId },
          })
        );
      }
      const uploadedName = eiVerificationFile?.name || "document";
      setEiVerificationUploadSuccess(`Uploaded ${uploadedName}.`);
      setEiVerificationFile(null);
      setEiVerificationFileError(null);
      return true;
    } catch (err) {
      setEiVerificationUploadError(err?.message || "Failed to upload EI verification document.");
      return false;
    } finally {
      setEiVerificationUploading(false);
    }
  }, [
    apiFetch,
    applicantUserId,
    caseId,
    eiVerificationFile,
    form.eiVerificationStatus,
    activeInterventionIdValue,
    isFormLocked,
  ]);

  const handleNavigate = async ({ detail }) => {
    const { requestedStepIndex } = detail || {};
    if (requestedStepIndex > activeStepIds.length - 1 || requestedStepIndex < 0) return;
    const requestedStepId = activeStepIds[requestedStepIndex];
    const currentIdx = activeStepIds.indexOf(currentStep);
    logWizard("navigate", {
      from: currentStep,
      to: requestedStepId,
      requestedStepIndex,
      currentIdx,
    });
    if (!isEditable) {
      setCurrentStep(requestedStepId);
      return;
    }
    if (requestedStepIndex > currentIdx) {
      setAttemptedSteps(prev => ({ ...prev, [currentStep]: true }));
      const valid = validateStep(currentStep);
      if (!valid) {
        return;
      }
      if (currentStep === "ei") {
        const planOk = await persistPlanReassignment();
        if (!planOk) {
          return;
        }
        const uploadOk = await uploadEiVerificationIfSelected();
        if (!uploadOk) {
          return;
        }
      }
    }
    setError(null);
    setCurrentStep(requestedStepId);
  };

  const handleSubmitDraft = useCallback(
    async event => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      setError(null);
      setSuccessMessage("");
      if (!isEditable) {
        if (hasBlockingProposal && !statusValue) {
          setError("A draft or submitted proposal already exists. Resume it from the table.");
        } else {
          setError("This intervention is read-only and cannot be updated.");
        }
        return;
      }
      if (isSubmittedStatus) {
        setError("Submitted proposals cannot be saved as drafts.");
        return;
      }
      const numericPlanId = Number(form.actionPlanId);
      if (!form.actionPlanId || !Number.isFinite(numericPlanId)) {
        setError("Select an Action Plan before proposing an intervention.");
        return;
      }
      setIsSubmitting(true);
      try {
        const payload = buildPayload("draft");
        const existingDraft = findExistingDraft();
        const actionPlanId = existingDraft?.actionPlanId ?? numericPlanId;
        const saved = existingDraft && typeof updateIntervention === "function"
          ? await updateIntervention(actionPlanId, existingDraft.id, payload)
          : await createIntervention(numericPlanId, payload);

        if (saved?.actionPlanId && saved.actionPlanId !== selectedActionPlanId) {
          setSelectedActionPlanId(saved.actionPlanId);
        }
        if (saved?.id) {
          setSelectedDraftId(saved.id);
          setHydratedDraftId(saved.id);
          setHydratedDraftUpdatedAt(saved.updatedAt || saved.createdAt || null);
          if (typeof setSelectedInterventionId === "function") {
            setSelectedInterventionId(saved.id);
          }
        }
        setAutoHydrateEnabled(true);
        setCurrentInterventionStatus("draft");
        setSuccessMessage("Progress saved.");
      } catch (err) {
        const message = err?.message || "Failed to save draft proposal.";
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      buildPayload,
      findExistingDraft,
      createIntervention,
      form,
      hydratedDraftId,
      hasBlockingProposal,
      isEditable,
      isSubmittedStatus,
      selectedActionPlanId,
      selectedDraftId,
      setSelectedActionPlanId,
      setSelectedInterventionId,
      statusValue,
      updateIntervention,
    ]
  );

  const handleSaveReview = useCallback(
    async event => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      setError(null);
      setSuccessMessage("");
      if (!isEditable) {
        setError("This intervention is read-only and cannot be updated.");
        return;
      }
      if (!isSubmittedStatus) {
        setError("Only submitted proposals can be updated from the review steps.");
        return;
      }
      const selected = findSelectedIntervention();
      const targetId = selected?.id || activeInterventionIdValue;
      const numericTargetId = Number(targetId);
      const resolvedTargetId = Number.isFinite(numericTargetId) ? numericTargetId : targetId;
      const formPlanId = resolvePlanIdValue(form.actionPlanId);
      const selectedPlanId = resolvePlanIdValue(selected?.actionPlanId);
      const actionPlanId = formPlanId || selectedPlanId;
      if (!resolvedTargetId || !actionPlanId) {
        setError("Select a submitted proposal before saving review details.");
        return;
      }
      if (typeof updateIntervention !== "function") {
        setError("Intervention updates are not available.");
        return;
      }
      await uploadEiVerificationIfSelected({ interventionId: resolvedTargetId });
      setIsSubmitting(true);
      try {
        const payload = buildPayload("submitted");
        if (formPlanId && (!selectedPlanId || String(formPlanId) !== String(selectedPlanId))) {
          payload.actionPlanId = formPlanId;
        }
        const saved = await updateIntervention(actionPlanId, resolvedTargetId, payload);
        if (saved?.actionPlanId && saved.actionPlanId !== selectedActionPlanId) {
          setSelectedActionPlanId(saved.actionPlanId);
        }
        if (saved?.id || resolvedTargetId) {
          const resolvedId = saved?.id || resolvedTargetId;
          setSelectedDraftId(resolvedId);
          setHydratedDraftId(resolvedId);
          setHydratedDraftUpdatedAt(saved?.updatedAt || saved?.createdAt || null);
          if (typeof setSelectedInterventionId === "function") {
            setSelectedInterventionId(resolvedId);
          }
        }
        setAutoHydrateEnabled(true);
        setCurrentInterventionStatus("submitted");
        setSuccessMessage("Progress saved.");
      } catch (err) {
        const message = err?.message || "Failed to save review details.";
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      buildPayload,
      findSelectedIntervention,
      form.actionPlanId,
      activeInterventionIdValue,
      hydratedDraftId,
      isEditable,
      isSubmittedStatus,
      resolvePlanIdValue,
      selectedActionPlanId,
      selectedDraftId,
      setSelectedActionPlanId,
      setSelectedInterventionId,
      uploadEiVerificationIfSelected,
      updateIntervention,
    ]
  );

  const handleChecklistRefresh = useCallback(() => {
    setChecklistUploadError(null);
    setChecklistUploadSuccess(null);
    loadChecklist();
  }, [loadChecklist]);

  const handleChecklistUploadClick = useCallback(
    item => {
      if (isFormLocked) return;
      setChecklistUploadError(null);
      setChecklistUploadSuccess(null);
      if (!activeInterventionIdValue) {
        setChecklistUploadError("Save progress to create the intervention record before uploading documents.");
        return;
      }
      const docTypes = Array.isArray(item?.documentTypes) ? item.documentTypes.filter(Boolean) : [];
      if (!docTypes.length) {
        setChecklistUploadError("No document type is configured for this checklist item.");
        return;
      }
      const label = item?.label || "Supporting document";
      if (docTypes.length === 1) {
        nextChecklistDocTypeRef.current = docTypes[0];
        nextChecklistLabelRef.current = label;
        if (checklistFileInputRef.current) {
          checklistFileInputRef.current.click();
        }
        return;
      }
      setChecklistUploadDocTypes(docTypes);
      setChecklistUploadDocType(docTypes[0] || "");
      setChecklistUploadLabel(label);
      setChecklistUploadModalVisible(true);
    },
    [activeInterventionIdValue, isFormLocked]
  );

  const handleChecklistUploadModalDismiss = useCallback(() => {
    setChecklistUploadModalVisible(false);
    setChecklistUploadDocTypes([]);
    setChecklistUploadDocType("");
    setChecklistUploadLabel("");
    setChecklistUploadError(null);
  }, []);

  const handleChecklistUploadModalConfirm = useCallback(() => {
    if (!checklistUploadDocType) {
      setChecklistUploadError("Select a document type to continue.");
      return;
    }
    nextChecklistDocTypeRef.current = checklistUploadDocType;
    nextChecklistLabelRef.current = checklistUploadLabel || "Supporting document";
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
        input.value = "";
      }
      if (!file) return;
      if (!applicantUserId) {
        setChecklistUploadError("Unable to determine the applicant for this upload.");
        return;
      }
      if (!activeInterventionIdValue) {
        setChecklistUploadError("Save progress to create the intervention record before uploading documents.");
        return;
      }
      const docType = nextChecklistDocTypeRef.current;
      if (!docType) {
        setChecklistUploadError("Select a document type to continue.");
        return;
      }
      setChecklistUploading(true);
      setChecklistUploadError(null);
      setChecklistUploadSuccess(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (caseId) formData.append("caseId", caseId);
        formData.append("interventionId", activeInterventionIdValue);
        formData.append("label", nextChecklistLabelRef.current || file.name);
        formData.append("documentType", docType);
        const response = await apiFetch(`/api/applicants/${applicantUserId}/documents/upload`, {
          method: "POST",
          body: formData,
        });
        if (!response || !response.ok) {
          let payload = null;
          try {
            payload = await response.json();
          } catch (_) {
            payload = null;
          }
          const errorCode = payload?.error || null;
          if (errorCode === "unsupported_file_type") {
            throw new Error("That file type is not allowed. Please upload a PDF or image.");
          }
          if (errorCode === "file_too_large") {
            throw new Error("The file is too large to upload.");
          }
          throw new Error(payload?.message || "Failed to upload document.");
        }
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
          window.dispatchEvent(
            new CustomEvent("iset:supporting-documents:refresh", {
              detail: { applicantUserId },
            })
          );
        }
        setChecklistUploadSuccess(`Uploaded ${file.name}.`);
        await loadChecklist();
      } catch (err) {
        setChecklistUploadError(err?.message || "Failed to upload document.");
      } finally {
        setChecklistUploading(false);
        nextChecklistDocTypeRef.current = "";
        nextChecklistLabelRef.current = "";
      }
    },
    [activeInterventionIdValue, applicantUserId, caseId, loadChecklist]
  );

  const handleEiVerificationFileChange = useCallback(event => {
    const input = event?.target;
    const file = input?.files?.[0] || null;
    if (input) {
      input.value = "";
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
      setEiVerificationFileError("Only PDF, JPG, PNG, BMP, or TIFF files are allowed.");
      return;
    }
    if (file.size > ELIGIBILITY_MAX_BYTES) {
      setEiVerificationFile(null);
      setEiVerificationFileError("File is too large (max 6 MB).");
      return;
    }
    setEiVerificationFile(file);
    setEiVerificationFileError(null);
  }, []);

  const handleSubmitDecision = useCallback(
    async event => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      setError(null);
      setSuccessMessage("");
      if (!isEditable) {
        setError("This intervention is read-only and cannot be updated.");
        return;
      }
      if (!isSubmittedStatus) {
        setError("Only submitted proposals can be decided.");
        return;
      }
      const outcome = form.decisionOutcome;
      const reasons = [];
      let targetStep = null;
      if (!outcome) {
        reasons.push("Select a decision outcome in Step 8.");
        targetStep = "decision";
      }
      if (outcome === "approved") {
        if (checklistLoading) {
          reasons.push("Wait for the document checklist to finish loading.");
          targetStep = targetStep || "docs";
        } else if (checklistError) {
          reasons.push("Resolve the checklist error in Step 5 and refresh before approving.");
          targetStep = targetStep || "docs";
        } else if (!docsChecklistReady) {
          reasons.push("Save progress to create the intervention record before approving.");
          targetStep = targetStep || "docs";
        } else if (missingRequiredCount > 0) {
          reasons.push(
            `${missingRequiredCount} required document${missingRequiredCount === 1 ? "" : "s"} missing in Step 5.`
          );
          targetStep = targetStep || "docs";
        }
        if (!form.eiVerificationStatus) {
          reasons.push("Set EI eligibility in Step 7.");
          targetStep = targetStep || "ei";
        }
        if (hasPlanFundingMismatch) {
          reasons.push(`Action Plan funding stream must match EI eligibility (${requiredFundingStream}).`);
          targetStep = targetStep || "ei";
        }
      }
      if (reasons.length) {
        setDecisionBlockerReasons(reasons);
        setDecisionBlockerTargetStep(targetStep);
        setDecisionBlockerVisible(true);
        return;
      }
      const selected = findSelectedIntervention();
      const targetId = selected?.id || activeInterventionIdValue;
      const numericTargetId = Number(targetId);
      const resolvedTargetId = Number.isFinite(numericTargetId) ? numericTargetId : targetId;
      const formPlanId = resolvePlanIdValue(form.actionPlanId);
      const selectedPlanId = resolvePlanIdValue(selected?.actionPlanId);
      const actionPlanId = formPlanId || selectedPlanId;
      if (!resolvedTargetId || !actionPlanId) {
        setError("Select a submitted proposal before submitting a decision.");
        return;
      }
      if (typeof updateIntervention !== "function") {
        setError("Intervention updates are not available.");
        return;
      }
      setIsSubmitting(true);
      try {
        const nextStatus = outcome;
        const payload = buildPayload(nextStatus);
        if (formPlanId && (!selectedPlanId || String(formPlanId) !== String(selectedPlanId))) {
          payload.actionPlanId = formPlanId;
        }
        const saved = await updateIntervention(actionPlanId, resolvedTargetId, payload);
        if (saved?.actionPlanId && saved.actionPlanId !== selectedActionPlanId) {
          setSelectedActionPlanId(saved.actionPlanId);
        }
        if (saved?.id || resolvedTargetId) {
          const resolvedId = saved?.id || resolvedTargetId;
          setSelectedDraftId(resolvedId);
          setHydratedDraftId(resolvedId);
          setHydratedDraftUpdatedAt(saved?.updatedAt || saved?.createdAt || null);
          if (typeof setSelectedInterventionId === "function") {
            setSelectedInterventionId(resolvedId);
          }
        }
        setCurrentInterventionStatus(nextStatus);
        setSuccessMessage("Decision submitted.");
      } catch (err) {
        const message = err?.message || "Failed to submit decision.";
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeInterventionIdValue,
      buildPayload,
      checklistError,
      checklistLoading,
      docsChecklistReady,
      findSelectedIntervention,
      form.actionPlanId,
      form.decisionOutcome,
      form.eiVerificationStatus,
      hasPlanFundingMismatch,
      isEditable,
      isSubmittedStatus,
      missingRequiredCount,
      requiredFundingStream,
      resolvePlanIdValue,
      selectedActionPlanId,
      setSelectedActionPlanId,
      setSelectedInterventionId,
      updateIntervention,
    ]
  );

  const handleSubmitProposal = useCallback(
    async event => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      setError(null);
      setSuccessMessage("");
      if (!isEditable) {
        if (hasBlockingProposal && !statusValue) {
          setError("A draft or submitted proposal already exists. Resume it from the table.");
        } else {
          setError("This intervention is read-only and cannot be submitted.");
        }
        return;
      }
      if (isSubmittedStatus) {
        setError("This proposal has already been submitted.");
        return;
      }
      const numericPlanId = Number(form.actionPlanId);
      if (!form.actionPlanId || !Number.isFinite(numericPlanId)) {
        setError("Select an Action Plan before submitting the proposal.");
        return;
      }
      const requiredSteps = REQUIRED_STEP_IDS;
      const invalidSteps = requiredSteps.filter(stepId => !validateStep(stepId));
      if (invalidSteps.length > 0) {
        setAttemptedSteps(prev => {
          const next = { ...prev };
          invalidSteps.forEach(stepId => {
            next[stepId] = true;
          });
          return next;
        });
        setCurrentStep(invalidSteps[0]);
        setError("Complete required fields before submitting.");
        return;
      }
      setIsSubmitting(true);
      try {
        const payload = buildPayload("submitted");
        const existingDraft = findExistingDraft();
        const actionPlanId = existingDraft?.actionPlanId ?? numericPlanId;
        const saved = existingDraft && typeof updateIntervention === "function"
          ? await updateIntervention(actionPlanId, existingDraft.id, payload)
          : await createIntervention(numericPlanId, payload);
        if (saved?.actionPlanId && saved.actionPlanId !== selectedActionPlanId) {
          setSelectedActionPlanId(saved.actionPlanId);
        }
        if (saved?.id) {
          setSelectedDraftId(saved.id);
          setHydratedDraftId(saved.id);
          setHydratedDraftUpdatedAt(saved.updatedAt || saved.createdAt || null);
          if (typeof setSelectedInterventionId === "function") {
            setSelectedInterventionId(saved.id);
          }
        }
        setAutoHydrateEnabled(true);
        setCurrentInterventionStatus("submitted");
        setSuccessMessage("Proposal submitted for approval.");
      } catch (err) {
        const message = err?.message || "Failed to submit proposal.";
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      buildPayload,
      createIntervention,
      findExistingDraft,
      form.actionPlanId,
      hasBlockingProposal,
      isEditable,
      isSubmittedStatus,
      selectedActionPlanId,
      setSelectedActionPlanId,
      setSelectedInterventionId,
      statusValue,
      updateIntervention,
      validateStep,
    ]
  );

  const renderPlanSelector = ({ description, errorText } = {}) => (
    <FormField
      label="Action Plan"
      description={description || "Choose the plan this proposed intervention belongs to."}
      stretch
      errorText={errorText !== undefined ? errorText : !form.actionPlanId ? "Action Plan is required." : undefined}
    >
      <Select
        selectedOption={planOptions.find(option => option.value === form.actionPlanId) || null}
        onChange={({ detail }) => {
          const value = detail?.selectedOption?.value || "";
          setForm(prev => ({ ...prev, actionPlanId: value }));
          if (value) {
            const numericValue = Number(value);
            setSelectedActionPlanId(Number.isFinite(numericValue) ? numericValue : value);
          }
        }}
        options={planOptions}
        placeholder={planOptions.length ? "Select plan" : "No plans available"}
        disabled={isFormLocked || !planOptions.length}
      />
    </FormField>
  );

  const framingStepContent = (
    <SpaceBetween size="m">
      <ColumnLayout columns={3} variant="text-grid">
        <FormField label="Intervention code" errorText={attemptedSteps.framing && !form.code ? "Required" : undefined}>
          <Select
            selectedOption={codeOptions.find(option => option.value === form.code) || null}
            onChange={({ detail }) => handleChange("code", detail?.selectedOption?.value || "")}
            loadingText="Loading codes"
            statusType={interventionCodesLoading ? "loading" : "finished"}
            placeholder="Select code"
            options={codeOptions}
            disabled={isFormLocked}
          />
        </FormField>
        <FormField
          label="Start date"
          errorText={
            attemptedSteps.framing && !form.startDate
              ? "Required"
              : attemptedSteps.framing && form.startDate && form.endDate && !isDateOrderValid()
                ? "Start date must be on or before end date"
                : undefined
          }
        >
          <DatePicker
            value={form.startDate}
            onChange={({ detail }) => handleChange("startDate", detail.value)}
            disabled={isFormLocked}
          />
        </FormField>
        <FormField
          label="End date"
          errorText={
            attemptedSteps.framing && form.endDate && !isDateOrderValid()
                ? "End date cannot be before start date"
                : undefined
          }
        >
          <DatePicker
            value={form.endDate}
            onChange={({ detail }) => handleChange("endDate", detail.value)}
            disabled={isFormLocked}
          />
        </FormField>
      </ColumnLayout>
    </SpaceBetween>
  );

  const rationaleStepContent = (
    <SpaceBetween size="m">
      <FormField
        label="Rationale and goals"
        description="Explain why a new intervention is needed, referencing outcomes of the last assessment/intervention, remaining gaps, and expected employment results."
        errorText={attemptedSteps.rationale && (!form.rationale || !form.rationale.trim()) ? "Rationale is required." : undefined}
        constraintText={`${countWords(form.rationale)}/${RATIONALE_WORD_LIMIT} words maximum`}
      >
        <Textarea
          value={form.rationale}
          rows={4}
          onChange={({ detail }) => handleChange("rationale", limitWords(detail.value, RATIONALE_WORD_LIMIT))}
          placeholder="Summarize why this intervention is needed and expected outcomes."
          disabled={isFormLocked}
        />
      </FormField>
      <FormField label="Barriers to employment (optional)">
        <Multiselect
          options={barrierOptions}
          selectedOptions={form.barriers}
          onChange={({ detail }) => handleChange("barriers", detail.selectedOptions || [])}
          placeholder="Select barriers"
          disabled={isFormLocked}
        />
      </FormField>
    </SpaceBetween>
  );

  const typeStepContent = (
    <SpaceBetween size="m">
      {!requiresExternalPartner(form.code) && (
        <FormField
          label="Delivery mode"
          description="Choose how this will run. Training codes need an education provider; employer codes need a host/employer with NOC details."
        >
          <Select
            selectedOption={
              form.deliveryMode !== "in_house"
                ? { value: "partner", label: "External delivery partner" }
                : { value: "in_house", label: "In-house (no external partner)" }
            }
            onChange={({ detail }) => {
              const value = detail?.selectedOption?.value || "partner";
              handleChange("deliveryMode", value);
              if (value === "in_house") {
                handleChange("deliveryPartner", "");
              }
            }}
            options={[
              { value: "partner", label: "External delivery partner" },
              { value: "in_house", label: "In-house (no external partner)" },
            ]}
            disabled={isFormLocked}
          />
        </FormField>
      )}

      {isEducationCode(form.code) && (
        <SpaceBetween size="s">
          <ColumnLayout columns={2} variant="text-grid">
            <FormField
              label="Institution"
              description="Training provider or school delivering the program."
              errorText={attemptedSteps.type && !form.institution.trim() ? "Required for this code" : undefined}
            >
              <Input
                value={form.institution}
                onChange={({ detail }) => handleChange("institution", detail.value)}
                disabled={isFormLocked}
              />
            </FormField>
            <FormField
              label="Program name (optional)"
              description="Course, credential, or stream name."
            >
              <Input
                value={form.programName}
                onChange={({ detail }) => handleChange("programName", detail.value)}
                disabled={isFormLocked}
              />
            </FormField>
          </ColumnLayout>
          <FormField
            label="In-Training Plan (ITP) details"
            description="Outline curriculum, milestones, supports, materials, and how this leads to the employment goal."
            errorText={attemptedSteps.type && !form.itpDetails.trim() ? "Required for this code" : undefined}
          >
            <Textarea
              value={form.itpDetails}
              rows={3}
              onChange={({ detail }) => handleChange("itpDetails", detail.value)}
              placeholder="Summarize training plan, key milestones, supports, or materials."
              disabled={isFormLocked}
            />
          </FormField>
        </SpaceBetween>
      )}

      {isEmployerCode(form.code) && (
        <SpaceBetween size="s">
          <ColumnLayout columns={2} variant="text-grid">
            <FormField
              label="Employer / delivery partner"
              description="Employer or host organization providing the placement."
              errorText={attemptedSteps.type && !form.deliveryPartner.trim() ? "Required for this code" : undefined}
            >
              <Input
                value={form.deliveryPartner}
                onChange={({ detail }) => handleChange("deliveryPartner", detail.value)}
                disabled={isFormLocked}
              />
            </FormField>
            <FormField
              label="Program name (optional)"
              description="Job title, role, or program name if defined by the employer."
            >
              <Input
                value={form.programName}
                onChange={({ detail }) => handleChange("programName", detail.value)}
                disabled={isFormLocked}
              />
            </FormField>
          </ColumnLayout>
          <ColumnLayout columns={2} variant="text-grid">
            <FormField
              label="NOC version"
              description="Select the NOC version used for this job/placement."
              errorText={
                attemptedSteps.type && !form.nocVersion && requiresNocForCode(form.code) ? "Required for this code" : undefined
              }
            >
              <Select
                selectedOption={
                  nocVersionOptions.find(option => option.value === form.nocVersion) || null
                }
                onChange={({ detail }) => {
                  const value = detail?.selectedOption?.value || "";
                  handleChange("nocVersion", value);
                  handleChange("nocCode", "");
                  setNocOptions([]);
                }}
                options={nocVersionOptions}
                statusType={nocVersionsLoading ? "loading" : "finished"}
                loadingText="Loading NOC versions"
                placeholder="Select NOC version"
                disabled={isFormLocked}
              />
            </FormField>
            <FormField
              label="NOC code"
              description="Search by code or title; aligns to the job/placement."
              errorText={
                attemptedSteps.type && !form.nocCode && requiresNocForCode(form.code) ? "Required for this code" : undefined
              }
            >
              <Autosuggest
                value={
                  (() => {
                    const match = nocOptions.find(opt => opt.value === form.nocCode);
                    if (match) return match.label;
                    if (form.nocCode) return form.nocCode;
                    return "";
                  })()
                }
                onChange={({ detail }) => {
                  const next = detail.value || "";
                  handleChange("nocCode", next);
                  if (next.length >= 2) fetchNocSuggestions(next);
                  else setNocOptions([]);
                }}
                onSelect={({ detail }) => {
                  const value = detail.value || "";
                  handleChange("nocCode", value);
                }}
                onLoadItems={({ detail }) => {
                  if (detail.filteringText && detail.filteringText.length >= 2) {
                    fetchNocSuggestions(detail.filteringText);
                  }
                }}
                options={nocOptions}
                statusType={nocSuggestionsLoading ? "loading" : "finished"}
                placeholder={
                  requiresNocForCode(form.code)
                    ? form.nocVersion
                      ? "Type to search NOC code"
                      : "Select a NOC version first"
                    : "Not required for this code"
                }
                empty={requiresNocForCode(form.code) ? "No NOC codes found." : "NOC selection not required."}
                disabled={isFormLocked || !requiresNocForCode(form.code) || !form.nocVersion}
                enteredTextLabel={value => `Use "${value}"`}
                expandToViewport
              />
            </FormField>
          </ColumnLayout>
          {isWageSubsidyCode(form.code) && (
            <FormField
              label="Wage subsidy details"
              errorText={attemptedSteps.type && !form.wageSubsidyDetails.trim() ? "Required for this code" : undefined}
            >
              <Textarea
                value={form.wageSubsidyDetails}
                rows={3}
                onChange={({ detail }) => handleChange("wageSubsidyDetails", detail.value)}
                placeholder="Employer, wage subsidy amount/percentage, duration, expectations."
                disabled={isFormLocked}
              />
            </FormField>
          )}
        </SpaceBetween>
      )}

      {!isEducationCode(form.code) && !isEmployerCode(form.code) && (
        form.deliveryMode === "partner" ? (
          <FormField
            label="Delivery partner / provider"
            errorText={attemptedSteps.type && !form.deliveryPartner.trim() ? "Required" : undefined}
          >
            <Input
              value={form.deliveryPartner}
              onChange={({ detail }) => handleChange("deliveryPartner", detail.value)}
              placeholder="Training institution, employer, or provider"
              disabled={isFormLocked}
            />
          </FormField>
        ) : (
          !dismissedAlerts.inHouseDelivery && (
            <Alert
              type="info"
              header="In-house delivery"
              dismissible
              onDismiss={() => dismissAlert("inHouseDelivery")}
            >
              No external delivery partner needed for this intervention.
            </Alert>
          )
        )
      )}
    </SpaceBetween>
  );

  const costStepContent = (
    <SpaceBetween size="m">
      {isEducationCode(form.code) && (
        <Box margin={{ top: "s" }}>
          <Header
            variant="h3"
            description="Note: Clients on an active EI Part I claim are not eligible for a living allowance."
          >
            Individual Training Purchase (ITP)
          </Header>
          <Table
            stripedRows
            columnDefinitions={[
              {
                id: "category",
                header: "Funding Category",
                cell: item => (
                  <span title={item.description || item.label}>{item.label}</span>
                ),
              },
              {
                id: "requested",
                header: "Funding Requested",
                cell: item => (
                  <Input
                    type="text"
                    value={form.itp?.[item.key] || ""}
                    onChange={({ detail }) => {
                      const raw = detail.value.replace(/[^\d.]/g, "");
                      handleItp(item.key, raw);
                    }}
                    onBlur={() => {
                      const raw = form.itp?.[item.key] || "";
                      const num = raw ? parseFloat(raw) : "";
                      const formatted = num !== "" && !Number.isNaN(num) ? `$ ${num.toFixed(2)}` : "";
                      handleItp(item.key, formatted);
                    }}
                    ariaLabel={item.label}
                    disabled={isFormLocked}
                  />
                ),
              },
              {
                id: "actions",
                header: "Actions",
                cell: item => (
                  <Button
                    size="small"
                    variant="inline-link"
                    onClick={() => handleItp(item.key, "")}
                    disabled={isFormLocked}
                  >
                    Clear
                  </Button>
                ),
              },
            ]}
            items={[
              { key: "tuition", label: "Tuition" },
              { key: "books", label: "Books" },
              { key: "materials", label: "Materials" },
              { key: "living", label: "Living Allowance" },
            ]}
            variant="embedded"
            header={null}
            footer={
              <Box fontWeight="bold" textAlign="right">
                Total Intervention Cost: $
                {(
                  Number((form.itp?.tuition || "").replace(/[^\d.]/g, "")) +
                  Number((form.itp?.books || "").replace(/[^\d.]/g, "")) +
                  Number((form.itp?.materials || "").replace(/[^\d.]/g, "")) +
                  Number((form.itp?.living || "").replace(/[^\d.]/g, ""))
                ).toFixed(2)}
              </Box>
            }
          />
        </Box>
      )}

      {isEmployerCode(form.code) && (
        <Box margin={{ top: "s" }}>
          <Header variant="h3">Targeted Wage Subsidy / Job Creation Partnership</Header>
          <Table
            stripedRows
            columnDefinitions={[
              { id: "category", header: "Funding Category", cell: item => item.label },
              {
                id: "requested",
                header: "Funding Requested",
                cell: item => (
                  <Input
                    type="text"
                    value={form.wage?.[item.key] || ""}
                    onChange={({ detail }) => {
                      if (item.key === "other") {
                        handleWage(item.key, detail.value);
                      } else {
                        const raw = detail.value.replace(/[^\d.]/g, "");
                        handleWage(item.key, raw);
                      }
                    }}
                    onBlur={() => {
                      if (item.key === "other") return;
                      const raw = form.wage?.[item.key] || "";
                      const num = raw ? parseFloat(raw) : "";
                      const formatted = num !== "" && !Number.isNaN(num) ? `$ ${num.toFixed(2)}` : "";
                      handleWage(item.key, formatted);
                    }}
                    ariaLabel={item.label}
                    disabled={isFormLocked}
                  />
                ),
              },
              {
                id: "actions",
                header: "Actions",
                cell: item => (
                  <Button
                    size="small"
                    variant="inline-link"
                    onClick={() => handleWage(item.key, "")}
                    disabled={isFormLocked}
                  >
                    Clear
                  </Button>
                ),
              },
            ]}
            items={[
              { key: "wages", label: "Wages" },
              { key: "mercs", label: "MERCs" },
              { key: "nonwages", label: "Non-Wages" },
              { key: "other", label: "Other" },
            ]}
            variant="embedded"
            header={null}
            footer={
              <Box fontWeight="bold" textAlign="right">
                Total Intervention Cost: $
                {(
                  Number((form.wage?.wages || "").replace(/[^\d.]/g, "")) +
                  Number((form.wage?.mercs || "").replace(/[^\d.]/g, "")) +
                  Number((form.wage?.nonwages || "").replace(/[^\d.]/g, "")) +
                  Number((form.wage?.other || "").replace(/[^\d.]/g, ""))
                ).toFixed(2)}
              </Box>
            }
          />
        </Box>
      )}

      {!usesCostTables && (
        <FormField
          label="Planned cost"
          description={`Enter the total cost for this intervention${form.code && codeOptions.find(opt => opt.value === form.code)?.label ? ` (${codeOptions.find(opt => opt.value === form.code)?.label})` : ""}. Leave this blank if the intervention has no cost.`}
          errorText={undefined}
        >
          <Input
            type="text"
            inputMode="decimal"
            value={form.plannedCost}
            onChange={({ detail }) => handleChange("plannedCost", (detail.value || "").replace(/[^\d.]/g, ""))}
            onBlur={() => {
              const formatted = formatCurrencyDisplay(form.plannedCost);
              if (formatted) {
                handleChange("plannedCost", formatted);
              }
            }}
            placeholder="$0.00"
            disabled={isFormLocked}
          />
        </FormField>
      )}

    </SpaceBetween>
  );

  const docsStepContent = (
    <SpaceBetween size="m">
      <input
        type="file"
        ref={checklistFileInputRef}
        style={{ display: "none" }}
        accept=".pdf,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
        onChange={handleChecklistFileSelected}
      />
      {showDocsInfoAlert && (
        <Alert
          type="info"
          header="Supporting documents"
          dismissible
          onDismiss={() => setShowDocsInfoAlert(false)}
        >
          Do not submit this proposal until all required documents are obtained. Missing checklist items below link
          directly to uploads, and the checklist refreshes automatically after new uploads.
        </Alert>
      )}
      {!docsChecklistReady && !dismissedAlerts.docsUploadLocked && (
        <Alert
          type="error"
          header="Save progress to enable uploads"
          dismissible
          onDismiss={() => dismissAlert("docsUploadLocked")}
        >
          Save progress to create the intervention record before uploading documents and validating the checklist.
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
        {checklistError && (
          <Alert type="error" dismissible onDismiss={() => setChecklistError(null)}>
            {checklistError}
          </Alert>
        )}
        <Box>
          <Header
            variant="h3"
            description={
              !docsChecklistReady
                ? "Save progress to load the checklist for this intervention."
                : checklistLoading
                  ? "Loading checklist..."
                  : missingRequiredCount > 0
                    ? `${missingRequiredCount} required item${missingRequiredCount === 1 ? "" : "s"} missing`
                    : <StatusIndicator type="success">All required checklist items are complete.</StatusIndicator>
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="icon"
                  iconName="refresh"
                  ariaLabel="Refresh checklist"
                  onClick={handleChecklistRefresh}
                  disabled={checklistLoading || !docsChecklistReady}
                />
                <Link
                  href="#supporting-documents"
                  onFollow={event => {
                    event.preventDefault();
                    openWorkspaceWidget("supporting-documents", 5, 2);
                  }}
                >
                  Open Supporting Documents
                </Link>
                <Link
                  href="#secure-messaging"
                  onFollow={event => {
                    event.preventDefault();
                    openWorkspaceWidget("secure-messaging", 5, 2);
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
            loading={checklistLoading}
            loadingText="Loading checklist"
            items={checklistItems.filter(item => item.required !== false)}
            columnDefinitions={[
              {
                id: "label",
                header: "Item",
                minWidth: 240,
                cell: item =>
                  item.status !== "complete" ? (
                    <Button
                      variant="inline-link"
                      onClick={() => handleChecklistUploadClick(item)}
                      disabled={!docsChecklistReady || isFormLocked || checklistUploading}
                    >
                      {item.label}
                    </Button>
                  ) : (
                    item.label
                  ),
              },
              {
                id: "status",
                header: "Status",
                minWidth: 160,
                cell: item => {
                  if (item.status === "complete") return <StatusIndicator type="success">Complete</StatusIndicator>;
                  if (item.status === "missing") return <StatusIndicator type="error">Missing</StatusIndicator>;
                  if (item.status === "in_progress") return <StatusIndicator type="info">In progress</StatusIndicator>;
                  return <StatusIndicator type="pending">Pending</StatusIndicator>;
                },
              },
            ]}
            empty={<Box textAlign="center">No checklist items required.</Box>}
          />
        </Box>
      </SpaceBetween>
    </SpaceBetween>
  );

  const selectedCodeOption = useMemo(
    () => codeOptions.find(opt => opt.value === form.code) || null,
    [codeOptions, form.code]
  );
  const selectedEiStatusOption = useMemo(() => {
    if (!form.eiVerificationStatus) return null;
    return (
      ESDC_OPTIONS.find(option => option.value === form.eiVerificationStatus) || {
        value: form.eiVerificationStatus,
        label: form.eiVerificationStatus,
      }
    );
  }, [form.eiVerificationStatus]);
  const selectedDecisionOption = useMemo(() => {
    if (!form.decisionOutcome) return null;
    return (
      DECISION_OPTIONS.find(option => option.value === form.decisionOutcome) || {
        value: form.decisionOutcome,
        label: form.decisionOutcome,
      }
    );
  }, [form.decisionOutcome]);
  const checklistUploadDocTypeOptions = useMemo(
    () =>
      checklistUploadDocTypes.map(type => ({
        value: type,
        label: formatDocTypeLabel(type) || type,
      })),
    [checklistUploadDocTypes]
  );

  const reviewStepContent = (
    <SpaceBetween size="m">
      {!dismissedAlerts.reviewInfo && (
        <Alert
          type="info"
          header="Review proposal"
          dismissible
          onDismiss={() => dismissAlert("reviewInfo")}
        >
        Check details before submitting. EI eligibility is checked during approval. Ensure required documents are complete before you submit.
        </Alert>
      )}
      <ColumnLayout columns={2} variant="text-grid">
        <Box>
          <Header variant="h4">Intervention</Header>
          <div>
            Intervention:{" "}
            {selectedCodeOption ? selectedCodeOption.label : form.code || "—"}
          </div>
          <div>Start: {form.startDate || "—"}</div>
          <div>End: {form.endDate || "Not Set"}</div>
          <div>Duration: {form.endDate ? `${form.durationDays || "—"} days` : "tba"}</div>
          <div>Current Action Plan: {planOptions.find(p => p.value === form.actionPlanId)?.label || "—"}</div>
        </Box>
        <Box>
          <Header variant="h4">Rationale</Header>
          <div>{form.rationale || "—"}</div>
          <div>Barriers: {form.barriers?.length ? form.barriers.map(b => b.label || b.value).join(", ") : "None"}</div>
        </Box>
        <Box>
          <Header variant="h4">Type details</Header>
          <div>
            {form.deliveryMode === "in_house"
              ? "In-house delivery (no external partner)"
              : `Delivery partner: ${form.deliveryPartner || "—"}`}
          </div>
          {isEducationCode(form.code) && (
            <>
              <div>Institution: {form.institution || "—"}</div>
              <div>Program: {form.programName || "—"}</div>
              <div>ITP: {form.itpDetails || "—"}</div>
            </>
          )}
          {isEmployerCode(form.code) && (
            <>
              <div>NOC: {form.nocCode || "—"} ({form.nocVersion || "—"})</div>
              <div>Program: {form.programName || "—"}</div>
              {isWageSubsidyCode(form.code) && <div>Wage subsidy: {form.wageSubsidyDetails || "—"}</div>}
            </>
          )}
        </Box>
        <Box>
          <Header variant="h4">Costs</Header>
          {isEducationCode(form.code) && (
            <div>
              ITP total: {formatCurrencyDisplay(sumCurrency(form.itp)) || "—"}
            </div>
          )}
          {isEmployerCode(form.code) && (
            <div>
              Wage/JCP total: {formatCurrencyDisplay(sumCurrency(form.wage)) || "—"}
            </div>
          )}
          {!usesCostTables && <div>Planned cost: {formatCurrencyDisplay(form.plannedCost) || "—"}</div>}
        </Box>
        <Box>
          <Header variant="h4">Documents</Header>
          <div>
            Checklist status:{" "}
            {!docsChecklistReady ? (
              <StatusIndicator type="info">Save progress to load checklist</StatusIndicator>
            ) : checklistLoading ? (
              <StatusIndicator type="info">Loading checklist</StatusIndicator>
            ) : missingRequiredCount > 0 ? (
              <StatusIndicator type="error">{`${missingRequiredCount} required item${missingRequiredCount === 1 ? "" : "s"} missing`}</StatusIndicator>
            ) : (
              <StatusIndicator type="success">No required items missing</StatusIndicator>
            )}
          </div>
          <SpaceBetween direction="horizontal" size="xs">
            <Link
              href="#supporting-documents"
              onFollow={event => {
                event.preventDefault();
                openWorkspaceWidget("supporting-documents", 5, 2);
              }}
            >
              Open Supporting Documents
            </Link>
            <Link
              href="#secure-messaging"
              onFollow={event => {
                event.preventDefault();
                openWorkspaceWidget("secure-messaging", 5, 2);
              }}
            >
              Open Secure Messaging
            </Link>
          </SpaceBetween>
        </Box>
      </ColumnLayout>
      <FormField label="Notes (optional)">
        <Textarea
          value={form.notes}
          rows={3}
          onChange={({ detail }) => handleChange("notes", detail.value)}
          placeholder="Additional context for approvers (attachments can be added in supporting documents)."
          disabled={isFormLocked}
        />
      </FormField>
    </SpaceBetween>
  );

  const eiVerificationStepContent = (
    <SpaceBetween size="m">
      {canManageEiEligibility && !activeInterventionIdValue && !dismissedAlerts.eiUploadLocked && (
        <Alert
          type="error"
          header="Save progress to enable EI verification"
          dismissible
          onDismiss={() => dismissAlert("eiUploadLocked")}
        >
          Save progress to create the intervention record before uploading EI verification documents.
        </Alert>
      )}
      {hasPlanFundingMismatch && !dismissedAlerts.eiPlanMismatch && (
        <Alert
          type="error"
          header="Action Plan funding stream mismatch"
          dismissible
          onDismiss={() => dismissAlert("eiPlanMismatch")}
        >
          <SpaceBetween size="xs">
            <span>{planMismatchAlertText}</span>
            <Link
              href="#action-plans"
              onFollow={event => {
                event.preventDefault();
                openWorkspaceWidget("actionPlans", 4, 2);
              }}
            >
              View Action Plans
            </Link>
          </SpaceBetween>
        </Alert>
      )}
      {canManageEiEligibility && eiVerificationUploadError && (
        <Alert
          type="error"
          statusIconAriaLabel="Error"
          dismissible
          onDismiss={() => setEiVerificationUploadError(null)}
        >
          {eiVerificationUploadError}
        </Alert>
      )}
      {canManageEiEligibility && eiVerificationUploadSuccess && (
        <Alert
          type="success"
          statusIconAriaLabel="Success"
          dismissible
          onDismiss={() => setEiVerificationUploadSuccess(null)}
        >
          {eiVerificationUploadSuccess}
        </Alert>
      )}
      <FormField
        label="EI Eligibility"
        errorText={
          attemptedSteps.ei && !form.eiVerificationStatus
            ? "Select an eligibility value."
            : undefined
        }
        stretch
      >
        <Select
          selectedOption={selectedEiStatusOption}
          onChange={({ detail }) => {
            handleChange("eiVerificationStatus", detail?.selectedOption?.value || "");
            setEiVerificationUploadError(null);
            setEiVerificationUploadSuccess(null);
          }}
          options={ESDC_OPTIONS}
          placeholder="Select eligibility"
          filteringType="auto"
          disabled={isFormLocked || !canManageEiEligibility}
        />
      </FormField>
      {renderPlanSelector({
        description:
          "If EI status requires a different funding stream, create a new Action Plan and select it here.",
        errorText: planSelectorErrorText,
      })}
      {canManageEiEligibility && (
        <FormField label="EI Verification document" errorText={eiVerificationFileError} stretch>
          <input
            type="file"
            ref={eiVerificationFileInputRef}
            style={{ display: "none" }}
            accept=".pdf,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
            onChange={handleEiVerificationFileChange}
          />
          <Box variant="small" color="text-body-secondary">
            Max size 6 MB. Allowed types: PDF, JPG, PNG, BMP, TIFF.
          </Box>
          <SpaceBetween size="xs" direction="horizontal">
            <Button
              onClick={() =>
                eiVerificationFileInputRef.current && eiVerificationFileInputRef.current.click()
              }
              disabled={isFormLocked || eiVerificationUploading || !activeInterventionIdValue}
            >
              Choose file
            </Button>
            <Box>{eiVerificationFile ? eiVerificationFile.name : "No file selected"}</Box>
          </SpaceBetween>
          <Box variant="small" color="text-body-secondary">
            Upload happens when you continue or save progress.
          </Box>
        </FormField>
      )}
    </SpaceBetween>
  );

  const decisionStepContent = (
    <SpaceBetween size="m">
      <FormField
        label="Decision outcome"
        description="Record the approval decision for this proposal."
      >
        <Select
          selectedOption={selectedDecisionOption}
          onChange={({ detail }) => handleChange("decisionOutcome", detail?.selectedOption?.value || "")}
          options={DECISION_OPTIONS}
          placeholder="Select outcome"
          disabled={isFormLocked}
        />
      </FormField>
      <FormField label="Decision notes (optional)">
        <Textarea
          value={form.decisionNotes}
          rows={3}
          onChange={({ detail }) => handleChange("decisionNotes", detail.value)}
          placeholder="Capture rationale, conditions, or follow-up actions."
          disabled={isFormLocked}
        />
      </FormField>
    </SpaceBetween>
  );

  const checklistUploadModal = (
    <Modal
      visible={checklistUploadModalVisible}
      onDismiss={handleChecklistUploadModalDismiss}
      closeAriaLabel="Close dialog"
      header="Select document type"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={handleChecklistUploadModalDismiss}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleChecklistUploadModalConfirm}>
            Continue
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
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
        <Box variant="small">
          {checklistUploadLabel ? `Uploading for: ${checklistUploadLabel}` : "Choose a document type to upload."}
        </Box>
        <FormField label="Document type">
          <Select
            selectedOption={
              checklistUploadDocTypeOptions.find(option => option.value === checklistUploadDocType) || null
            }
            onChange={({ detail }) => setChecklistUploadDocType(detail?.selectedOption?.value || "")}
            options={checklistUploadDocTypeOptions}
            placeholder="Select document type"
            filteringType="none"
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );

  const decisionBlockerModal = (
    <Modal
      visible={decisionBlockerVisible}
      onDismiss={() => setDecisionBlockerVisible(false)}
      closeAriaLabel="Close dialog"
      header="Cannot submit decision"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="link" onClick={() => setDecisionBlockerVisible(false)}>
            Close
          </Button>
          {decisionBlockerTargetStep && (
            <Button
              variant="primary"
              onClick={() => {
                setDecisionBlockerVisible(false);
                setCurrentStep(decisionBlockerTargetStep);
              }}
            >
              Go to step
            </Button>
          )}
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        <Box>Resolve the following before submitting:</Box>
        <Box>
          <ul>
            {decisionBlockerReasons.map(reason => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Box>
      </SpaceBetween>
    </Modal>
  );

  const stepDefinitionById = {
    framing: { title: STEP_LABELS.framing, content: framingStepContent, isOptional: false },
    rationale: { title: STEP_LABELS.rationale, content: rationaleStepContent, isOptional: false },
    type: { title: STEP_LABELS.type, content: typeStepContent, isOptional: false },
    cost: { title: STEP_LABELS.cost, content: costStepContent, isOptional: false },
    docs: { title: STEP_LABELS.docs, content: docsStepContent, isOptional: false },
    review: { title: STEP_LABELS.review, content: reviewStepContent, isOptional: false },
    ei: { title: STEP_LABELS.ei, content: eiVerificationStepContent, isOptional: false },
    decision: { title: STEP_LABELS.decision, content: decisionStepContent, isOptional: false },
  };

  const steps = activeStepIds
    .map(stepId => {
      const definition = stepDefinitionById[stepId];
      if (!definition) return null;
      return { id: stepId, ...definition };
    })
    .filter(Boolean);

  const readOnlyFormView = (
    <SpaceBetween size="l">
      {steps.map(step => (
        <Box key={step.title}>
          <Header variant="h3">{step.title}</Header>
          {step.content}
        </Box>
      ))}
    </SpaceBetween>
  );

  const showWizard = isDraftStatus || isSubmittedStatus || (!statusValue && !hasBlockingProposal);
  const showReadOnlyForm = statusValue && !isDraftStatus && !isSubmittedStatus;
  const activeStepIndex = Math.max(activeStepIds.indexOf(currentStep), 0);
  const primaryActionLabel = "Save Progress";
  const primaryActionHandler = isSubmittedStatus ? handleSaveReview : handleSubmitDraft;
  const wizardSubmitLabel = isSubmittedStatus ? "Submit Decision" : "Submit for approval";
  const wizardSubmitHandler = isSubmittedStatus ? handleSubmitDecision : handleSubmitProposal;


  return (
    <>
      {checklistUploadModal}
      {decisionBlockerModal}
      <BoardItem
        id="intervention-assessment-widget"
        header={
          <Header
            variant="h2"
            description={headerDescription}
            actions={
              <Button
                variant="primary"
                onClick={primaryActionHandler}
                loading={isSubmitting}
                disabled={isFormLocked}
              >
                {primaryActionLabel}
              </Button>
            }
          >
            Proposed Intervention <Badge color="blue">{statusLabel}</Badge>
          </Header>
        }
        i18nStrings={boardItemI18nStrings}
        settings={
          typeof actions?.removeItem === "function" ? (
            <ButtonDropdown
              ariaLabel="Intervention assessment settings"
              variant="icon"
              items={[{ id: "remove", text: "Remove widget" }]}
              onItemClick={({ detail }) => {
                if (detail?.id === "remove") {
                  actions.removeItem();
                }
              }}
            />
          ) : undefined
        }
      >
        <SpaceBetween size="l">
          {showWizard ? (
            <Wizard
              activeStepIndex={activeStepIndex}
              isLoadingNextStep={isSubmitting || eiVerificationUploading}
              onNavigate={handleNavigate}
              onSubmit={isEditable ? wizardSubmitHandler : undefined}
              steps={steps.map(step => ({
                title: step.title,
                content: step.content,
                isOptional: step.isOptional,
              errorText:
                attemptedSteps[step.id] && !isStepValid(step.id)
                  ? step.id === "review"
                    ? reviewStepErrorText
                    : "Complete required fields before continuing."
                  : undefined,
            }))}
              secondaryActions={null}
              submitButtonText={isEditable ? wizardSubmitLabel : "Read only"}
              cancelButtonText="Cancel"
              nextButtonText="Next"
              previousButtonText="Previous"
            />
          ) : showReadOnlyForm ? (
            readOnlyFormView
          ) : (
            !dismissedAlerts.selectProposal && (
              <Alert
                type="info"
                header="Select a proposal"
                dismissible
                onDismiss={() => dismissAlert("selectProposal")}
              >
                Choose a draft or submitted proposal from the Interventions table to view it here.
              </Alert>
            )
          )}

          {!isEditable && statusValue && (
            !dismissedAlerts.readOnlyView && (
              <Alert
                type="info"
                header="Read-only view"
                dismissible
                onDismiss={() => dismissAlert("readOnlyView")}
              >
                This intervention is {statusLabel.toLowerCase()} and locked for editing.
              </Alert>
            )
          )}
          {error && (
            <Alert
              type="error"
              header="Unable to save proposal"
              dismissible
              onDismiss={() => setError(null)}
            >
              {error}
            </Alert>
          )}
          {successMessage && (
            <Alert
              type="success"
              header={successMessage}
              dismissible
              onDismiss={() => setSuccessMessage("")}
            />
          )}
        </SpaceBetween>
      </BoardItem>
    </>
  );
};

export default InterventionAssessmentWidget;
