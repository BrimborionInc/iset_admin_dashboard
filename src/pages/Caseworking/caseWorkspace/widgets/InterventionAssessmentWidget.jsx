import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Badge,
  Box,
  Button,
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

const STEP_IDS = ["framing", "rationale", "type", "cost", "docs", "review"];
const STEP_LABELS = {
  framing: "What is being proposed?",
  rationale: "Why is this intervention needed?",
  type: "How will the intervention be delivered?",
  cost: "What does it cost?",
  docs: "Do you have the right supporting documents?",
  review: "Review and submit",
};

const RATIONALE_WORD_LIMIT = 400;

const InterventionAssessmentWidget = ({ actions }) => {
  const {
    caseData,
    selectedActionPlanId,
    setSelectedActionPlanId,
    interventionCodes,
    interventionCodesLoading,
    loadInterventionCodes,
    createIntervention,
    nocVersions,
    nocVersionsLoading,
    loadNocVersions,
    searchNocCodes,
  } = useCaseWorkspace();

  const [form, setForm] = useState(defaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [nocOptions, setNocOptions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(STEP_IDS[0]);
  const [attemptedSteps, setAttemptedSteps] = useState({});
  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState(null);
  const [missingRequiredCount, setMissingRequiredCount] = useState(0);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [autoHydrateEnabled, setAutoHydrateEnabled] = useState(true);
  const [hydratedDraftId, setHydratedDraftId] = useState(null);
  const [hydratedDraftUpdatedAt, setHydratedDraftUpdatedAt] = useState(null);
  const skipAutoResetsRef = useRef(false);

  const applicantUserId = useMemo(
    () => caseData?.applicantUserId ?? caseData?.applicant_user_id ?? null,
    [caseData]
  );
  const applicationId = useMemo(
    () => caseData?.applicationId ?? caseData?.application_id ?? null,
    [caseData]
  );

  const isDateOrderValid = useCallback(() => {
    if (!form.startDate || !form.endDate) return false;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return end >= start;
  }, [form.startDate, form.endDate]);

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
      const planId = detail.planId;
      setAutoHydrateEnabled(true);
      setSelectedDraftId(interventionId);
      setHydratedDraftId(null);
      setHydratedDraftUpdatedAt(null);
      setError(null);
      setSuccessMessage("");
      setAttemptedSteps({});
      setCurrentStep(STEP_IDS[0]);
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
      setAutoHydrateEnabled(false);
      setSelectedDraftId(null);
      setHydratedDraftId(null);
      setHydratedDraftUpdatedAt(null);
      setError(null);
      setSuccessMessage("");
      setAttemptedSteps({});
      setCurrentStep(STEP_IDS[0]);
      setForm(prev => ({
        ...defaultFormState,
        actionPlanId: planId ? String(planId) : prev.actionPlanId,
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
  }, [scrollToWidget, setSelectedActionPlanId]);

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
        return Boolean(form.code) && Boolean(form.startDate) && Boolean(form.endDate) && isDateOrderValid();
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
        return true;
      }
      if (stepId === "review") {
        return STEP_IDS.slice(0, 5).every(id => validateStep(id));
      }
      return false;
    },
    [form, isDateOrderValid]
  );

  const isStepValid = useCallback(stepId => validateStep(stepId), [validateStep]);

  useEffect(() => {
    let cancelled = false;
    const loadChecklist = async () => {
      if (!applicantUserId) {
        setChecklistItems([]);
        setMissingRequiredCount(0);
        return;
      }
      setChecklistLoading(true);
      setChecklistError(null);
      try {
        const query = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : "";
        const res = await apiFetch(`/api/applicants/${applicantUserId}/document-checklist${query}`, {
          method: "GET",
        });
        if (!res.ok) throw new Error("Failed to load checklist");
        const payload = await res.json().catch(() => ({ items: [], missingRequiredCount: 0 }));
        if (cancelled) return;
        setChecklistItems(Array.isArray(payload.items) ? payload.items : []);
        setMissingRequiredCount(Number(payload.missingRequiredCount) || 0);
      } catch (err) {
        if (!cancelled) setChecklistError(err?.message || "Failed to load checklist");
      } finally {
        if (!cancelled) setChecklistLoading(false);
      }
    };
    loadChecklist();
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
  }, [applicantUserId, applicationId]);

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
    const findDraftById = draftId => {
      const target = String(draftId);
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
      skipAutoResetsRef.current = true;
      setTimeout(() => {
        skipAutoResetsRef.current = false;
      }, 0);
      setForm(prev => ({
        ...prev,
        actionPlanId: planId ? String(planId) : prev.actionPlanId,
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
        postingContext: snapshot.postingContext || draft.postingContext || prev.postingContext,
        itpDetails: snapshot.itpDetails || metadata.itpDetails || "",
        wageSubsidyDetails: snapshot.wageSubsidyDetails || metadata.wageSubsidyDetails || "",
        barriers: mappedBarriers,
        itp: snapshot.itp || metadata.itp || { tuition: "", books: "", materials: "", living: "" },
        wage: snapshot.wage || metadata.wage || { wages: "", mercs: "", nonwages: "", other: "" },
        eiConsent: snapshot.eiConsentProvided ?? metadata.eiConsentProvided ?? null,
      }));
      if (planId && typeof setSelectedActionPlanId === "function") {
        setSelectedActionPlanId(resolvedPlanId);
      }
      setHydratedDraftId(draft.id || null);
      setHydratedDraftUpdatedAt(draft.updatedAt || draft.createdAt || null);
      setAttemptedSteps({});
      setCurrentStep(STEP_IDS[0]);
    };

    const localDraft = selectedDraftId ? findDraftById(selectedDraftId) : null;
    const resolvedDraft = localDraft
      ? localDraft
      : targetPlanId
      ? pickLatestDraft(
          (plans.find(plan => String(plan.id) === String(targetPlanId))?.interventions || [])
        )
      : null;
    if (resolvedDraft) {
      const updatedAt = resolvedDraft.updatedAt || resolvedDraft.createdAt || null;
      if (resolvedDraft.id === hydratedDraftId && updatedAt === hydratedDraftUpdatedAt) {
        return;
      }
      hydrate(resolvedDraft);
      return;
    }

    if (!targetPlanId) return;

    // Fallback: fetch interventions for the plan if not present in case data
    (async () => {
      try {
        const res = await apiFetch(`/api/action-plans/${targetPlanId}/interventions`, { method: "GET" });
        if (!res.ok) return;
        const payload = await res.json().catch(() => []);
        const list = Array.isArray(payload) ? payload : [];
        const draft = pickLatestDraft(list);
        if (!draft) return;
        const updatedAt = draft.updatedAt || draft.createdAt || null;
        if (draft.id === hydratedDraftId && updatedAt === hydratedDraftUpdatedAt) return;
        hydrate(draft);
      } catch (_) {
        // ignore hydration errors for now
      }
    })();
  }, [
    apiFetch,
    autoHydrateEnabled,
    caseData,
    form.actionPlanId,
    hydratedDraftId,
    hydratedDraftUpdatedAt,
    selectedActionPlanId,
    selectedDraftId,
    setSelectedActionPlanId,
  ]);

  const handleNavigate = ({ detail }) => {
    const { requestedStepIndex } = detail || {};
    if (requestedStepIndex > STEP_IDS.length - 1 || requestedStepIndex < 0) return;
    const requestedStepId = STEP_IDS[requestedStepIndex];
    const currentIdx = STEP_IDS.indexOf(currentStep);
    if (requestedStepIndex > currentIdx) {
      setAttemptedSteps(prev => ({ ...prev, [currentStep]: true }));
      const valid = validateStep(currentStep);
      if (!valid) {
        return;
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
      const numericPlanId = Number(form.actionPlanId);
      if (!form.actionPlanId || !Number.isFinite(numericPlanId)) {
        setError("Select an Action Plan before proposing an intervention.");
        return;
      }
      setIsSubmitting(true);
      try {
        const selectedCode = codeOptions.find(option => option.value === form.code);
        const derivedTitle = selectedCode?.label || form.code || "Draft intervention";
        const tableCost = isEducationCode(form.code)
          ? sumCurrency(form.itp)
          : isEmployerCode(form.code)
            ? sumCurrency(form.wage)
            : 0;
        const parsedPlanned = parseCurrencyInput(form.plannedCost);
        const costValue = usesCostTables ? tableCost : parsedPlanned ?? 0;
        const payload = {
          code: form.code || null,
          title: derivedTitle,
          status: "draft",
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
              barriers: Array.isArray(form.barriers)
                ? form.barriers.map(item => item.value || item)
                : [],
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
          },
          noc: form.nocCode || null,
          nocVersion: form.nocVersion || null,
          institution: form.institution || null,
          programName: form.programName || null,
          postingContext: form.postingContext || null,
        };
        const created = await createIntervention(numericPlanId, payload);
        if (created?.actionPlanId && created.actionPlanId !== selectedActionPlanId) {
          setSelectedActionPlanId(created.actionPlanId);
        }
        setSuccessMessage("Draft intervention proposal saved.");
      } catch (err) {
        const message = err?.message || "Failed to save draft proposal.";
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [createIntervention, form, selectedActionPlanId, setSelectedActionPlanId]
  );

  const renderPlanSelector = () => (
    <FormField
      label="Action Plan"
      description="Choose the plan this proposed intervention belongs to."
      stretch
      errorText={!form.actionPlanId && "Action Plan is required."}
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
        disabled={!planOptions.length}
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
          <DatePicker value={form.startDate} onChange={({ detail }) => handleChange("startDate", detail.value)} />
        </FormField>
        <FormField
          label="End date"
          errorText={
            attemptedSteps.framing && !form.endDate
              ? "Required"
              : attemptedSteps.framing && form.startDate && form.endDate && !isDateOrderValid()
                ? "End date cannot be before start date"
                : undefined
          }
        >
          <DatePicker value={form.endDate} onChange={({ detail }) => handleChange("endDate", detail.value)} />
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
        />
      </FormField>
      <FormField label="Barriers to employment (optional)">
        <Multiselect
          options={barrierOptions}
          selectedOptions={form.barriers}
          onChange={({ detail }) => handleChange("barriers", detail.selectedOptions || [])}
          placeholder="Select barriers"
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
              <Input value={form.institution} onChange={({ detail }) => handleChange("institution", detail.value)} />
            </FormField>
            <FormField
              label="Program name (optional)"
              description="Course, credential, or stream name."
            >
              <Input value={form.programName} onChange={({ detail }) => handleChange("programName", detail.value)} />
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
              <Input value={form.deliveryPartner} onChange={({ detail }) => handleChange("deliveryPartner", detail.value)} />
            </FormField>
            <FormField
              label="Program name (optional)"
              description="Job title, role, or program name if defined by the employer."
            >
              <Input value={form.programName} onChange={({ detail }) => handleChange("programName", detail.value)} />
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
                disabled={!requiresNocForCode(form.code) || !form.nocVersion}
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
                  />
                ),
              },
              {
                id: "actions",
                header: "Actions",
                cell: item => (
                  <Button size="small" variant="inline-link" onClick={() => handleItp(item.key, "")}>
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
                  />
                ),
              },
              {
                id: "actions",
                header: "Actions",
                cell: item => (
                  <Button size="small" variant="inline-link" onClick={() => handleWage(item.key, "")}>
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
          />
        </FormField>
      )}

    </SpaceBetween>
  );

  const docsStepContent = (
    <SpaceBetween size="m">
      <Alert type="info" header="Supporting documents">
        Do not submit this proposal until all required documents are obtained. Use secure messaging to request missing documents and the Supporting Documents widget to verify what is available or outstanding. EI eligibility documents are confirmed at approval.
      </Alert>
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
              missingRequiredCount > 0
                ? `${missingRequiredCount} required item${missingRequiredCount === 1 ? "" : "s"} missing`
                : "All required checklist items are complete."
            }
            actions={
              <Link href="#supporting-documents" onFollow={e => e.preventDefault()}>
                Open Supporting Documents
              </Link>
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
              { id: "label", header: "Item", cell: item => item.label, minWidth: 240 },
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

  const reviewStepContent = (
    <SpaceBetween size="m">
      <Alert type="info" header="Review proposal">
        Check details before submitting. EI eligibility is checked during approval. Ensure required documents are complete before you submit.
      </Alert>
      <ColumnLayout columns={2} variant="text-grid">
        <Box>
          <Header variant="h4">Intervention</Header>
          <div>
            Intervention:{" "}
            {selectedCodeOption ? selectedCodeOption.label : form.code || "—"}
          </div>
          <div>Start: {form.startDate || "—"}</div>
          <div>End: {form.endDate || "—"}</div>
          <div>Duration: {form.durationDays || "—"} days</div>
          <div>Action Plan: {planOptions.find(p => p.value === form.actionPlanId)?.label || "—"}</div>
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
            {missingRequiredCount > 0 ? (
              <StatusIndicator type="error">{`${missingRequiredCount} required item${missingRequiredCount === 1 ? "" : "s"} missing`}</StatusIndicator>
            ) : (
              <StatusIndicator type="success">No required items missing</StatusIndicator>
            )}
          </div>
          <div>
            <Link href="#supporting-documents" onFollow={e => e.preventDefault()}>
              Open Supporting Documents
            </Link>
          </div>
        </Box>
      </ColumnLayout>
      <FormField label="Notes (optional)">
        <Textarea
          value={form.notes}
          rows={3}
          onChange={({ detail }) => handleChange("notes", detail.value)}
          placeholder="Additional context for approvers (attachments can be added in supporting documents)."
        />
      </FormField>
    </SpaceBetween>
  );

  const steps = [
    { title: STEP_LABELS.framing, content: framingStepContent, isOptional: false },
    { title: STEP_LABELS.rationale, content: rationaleStepContent, isOptional: false },
    { title: STEP_LABELS.type, content: typeStepContent, isOptional: false },
    { title: STEP_LABELS.cost, content: costStepContent, isOptional: false },
    { title: STEP_LABELS.docs, content: docsStepContent, isOptional: false },
    { title: STEP_LABELS.review, content: reviewStepContent, isOptional: false },
  ];


  return (
    <BoardItem
      id="intervention-assessment-widget"
      header={
        <Header
          variant="h2"
          description='Propose a new intervention for this client. Once completed this will be sent for approval. You can save your work and finish it later using "Save draft" above. Only one new intervention can be proposed at a time for a participant.'
          actions={
            <Button
              variant="primary"
              onClick={handleSubmitDraft}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Save draft
            </Button>
          }
        >
          Proposed Intervention <Badge color="blue">Draft</Badge>
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
        <Wizard
          activeStepIndex={STEP_IDS.indexOf(currentStep)}
          isLoadingNextStep={isSubmitting}
          onNavigate={handleNavigate}
          onSubmit={handleSubmitDraft}
          steps={steps.map((step, idx) => ({
            title: step.title,
            content: step.content,
            isOptional: step.isOptional,
            errorText:
              attemptedSteps[STEP_IDS[idx]] && !isStepValid(STEP_IDS[idx])
                ? "Complete required fields before continuing."
                : undefined,
          }))}
          secondaryActions={null}
          submitButtonText="Submit proposal"
          cancelButtonText="Cancel"
          nextButtonText="Next"
          previousButtonText="Previous"
        />

        {error && (
          <Alert type="error" header="Unable to save proposal">
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert type="success" header={successMessage} />
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default InterventionAssessmentWidget;
