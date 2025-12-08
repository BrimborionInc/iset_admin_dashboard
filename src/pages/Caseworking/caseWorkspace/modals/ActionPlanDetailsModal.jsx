import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autosuggest,
  Button,
  ColumnLayout,
  DatePicker,
  ExpandableSection,
  StatusIndicator,
  FormField,
  Input,
  Modal,
  Multiselect,
  Select,
  SpaceBetween,
  Textarea,
} from "@cloudscape-design/components";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import { apiFetch } from "../../../../auth/apiClient.js";

const EI_CLAIMANT_OPTIONS = [
  { value: "1", label: "Employment insurance claimant" },
  { value: "2", label: "Reach-back client/former claimant" },
  { value: "3", label: "Non-insured client" },
];

const PREV_EMPLOYMENT_OPTIONS = [
  { value: "1", label: "Unemployed" },
  { value: "2", label: "Employed" },
  { value: "9", label: "Student" },
];

const SCHEDULE_OPTIONS = [
  { value: "1", label: "Full-time" },
  { value: "2", label: "Part-time" },
];

const YES_NO_OPTIONS = [
  { value: "1", label: "Yes" },
  { value: "0", label: "No" },
];

const deriveAgreementNumberFromFundingStream = fundingStream => {
  if (!fundingStream) return "999999999";
  const key = String(fundingStream).trim().toUpperCase();
  if (key === "EI") return "16535866";
  if (key === "CRF") return "16535841";
  return "999999999";
};

const CHILDCARE_FUNDING_OPTIONS = [
  { value: "1", label: "Not applicable" },
  { value: "2", label: "FNICCI" },
  { value: "3", label: "EI/CRF" },
  { value: "4", label: "Provincial funding / subsidy" },
  { value: "5", label: "No funding received" },
  { value: "6", label: "Daycare space not available" },
  { value: "7", label: "Assisted by family / Self-funded" },
];

const EDUCATION_OPTIONS = [
  { value: "1", label: "No formal education" },
  { value: "2", label: "Up to grade 7–8" },
  { value: "3", label: "Grade 9–10" },
  { value: "4", label: "Grade 11–12" },
  { value: "5", label: "Secondary diploma / GED" },
  { value: "6", label: "Some post-secondary" },
  { value: "7", label: "Apprenticeship / trades / vocational diploma" },
  { value: "8", label: "College / CEGEP / non-university diploma" },
  { value: "9", label: "University certificate/diploma" },
  { value: "10", label: "Bachelor’s" },
  { value: "11", label: "Master’s" },
  { value: "12", label: "Doctorate" },
];

const PROVINCE_OPTIONS = [
  { value: "1", label: "NL" },
  { value: "2", label: "NS" },
  { value: "3", label: "NB" },
  { value: "4", label: "PE" },
  { value: "5", label: "QC" },
  { value: "6", label: "ON" },
  { value: "7", label: "MB" },
  { value: "8", label: "SK" },
  { value: "9", label: "AB" },
  { value: "10", label: "NT" },
  { value: "11", label: "BC" },
  { value: "12", label: "YT" },
  { value: "13", label: "United States" },
  { value: "14", label: "Other country" },
  { value: "16", label: "Nunavut" },
];

const BARRIER_OPTIONS = [
  { value: "1", label: "None" },
  { value: "2", label: "Lack of labour force attachment" },
  { value: "3", label: "Lack of work experience" },
  { value: "4", label: "Lack of transportation" },
  { value: "5", label: "Remoteness" },
  { value: "6", label: "Language" },
  { value: "7", label: "Education" },
  { value: "8", label: "Economic" },
  { value: "9", label: "Dependent care" },
  { value: "10", label: "Lack of marketable skills" },
  { value: "11", label: "Physical/emotional/mental health" },
  { value: "12", label: "Other barrier" },
];

const RESULT_OPTIONS = [
  { value: "1", label: "Unemployed but available for work" },
  { value: "2", label: "Employed" },
  { value: "3", label: "Self-employed" },
  { value: "4", label: "Returned to school" },
  { value: "5", label: "Unspecified – client could not be reached" },
  { value: "6", label: "No longer in labour force" },
  { value: "7", label: "Stay in school" },
  { value: "9", label: "Ready for work" },
];

const RESULT_EDUCATION_OPTIONS = [
  { value: "1", label: "No formal education" },
  { value: "2", label: "Up to grade 7-8" },
  { value: "3", label: "Grade 9-10" },
  { value: "4", label: "Grade 11-12" },
  { value: "5", label: "Secondary diploma / GED" },
  { value: "6", label: "Some post-secondary" },
  { value: "7", label: "Apprenticeship / trades / vocational diploma" },
  { value: "8", label: "College / CEGEP / non-university diploma" },
  { value: "9", label: "University certificate/diploma" },
  { value: "10", label: "Bachelor’s" },
  { value: "11", label: "Master’s" },
  { value: "12", label: "Doctorate" },
];

const FUTURE_EDUCATION_OPTIONS = [
  { value: "5", label: "Secondary diploma / GED" },
  { value: "8", label: "College / CEGEP / non-university diploma" },
  { value: "9", label: "University certificate/diploma" },
  { value: "10", label: "Bachelor’s" },
];

const NOC_VERSION_OPTIONS = [
  { value: "2016", label: "2016" },
  { value: "2021", label: "2021" },
];
const DEFAULT_NOC_VERSION = NOC_VERSION_OPTIONS[0]?.value || "";

const defaultForm = {
  name: "",
  summary: "",
  startDate: "",
  reviewDate: "",
  fundingStream: "",
  budgetPot: "",
  agreementNumber: "",
  educationLevel: "",
  educationProvince: "",
  socialAssistanceRecipient: "",
  eiClaimant: "",
  prevEmployment: "",
  prevEmploymentScheduleType: "",
  prevEmploymentNocVersion: "",
  prevEmploymentNoc: "",
  childcareNeed: "",
  childcareFunding: "",
  barriers: [],
  resultCode: "",
  resultDate: "",
  resultEducationLevel: "",
  futureEducationLevel: "",
  resultNocVersion: "",
  resultNoc: "",
  outcomeSummary: "",
  closureNotes: "",
};

const displayValue = value => (value === null || typeof value === "undefined" || value === "" ? "-" : String(value));
const normaliseYesNoCode = value => {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["1", "yes", "true", "y", "on"].includes(v)) return "1";
  if (["0", "no", "false", "n", "off"].includes(v)) return "0";
  return "";
};

const ActionPlanDetailsModal = ({ visible, plan, onDismiss, onSaved }) => {
  const {
    updateActionPlan,
    activateActionPlan,
    closeActionPlan,
    searchNocCodes,
    caseData,
    fundingStreams,
    fundingStreamsLoading,
    loadFundingStreams,
  } = useCaseWorkspace();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [prevNocOptions, setPrevNocOptions] = useState([]);
  const [prevNocLoading, setPrevNocLoading] = useState(false);
  const [resultNocOptions, setResultNocOptions] = useState([]);
  const [resultNocLoading, setResultNocLoading] = useState(false);
  const [editEnabled, setEditEnabled] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closeoutExpanded, setCloseoutExpanded] = useState(false);
  const [planExpanded, setPlanExpanded] = useState(true);
  const [fundingExpanded, setFundingExpanded] = useState(true);
  const [applicantExpanded, setApplicantExpanded] = useState(true);
  const [potOptions, setPotOptions] = useState([]);
  const [potLoading, setPotLoading] = useState(false);
  const initialFormRef = useRef(defaultForm);

  const loadPots = useCallback(async query => {
    setPotLoading(true);
    try {
      const resp = await apiFetch("/api/finance/budget-pots");
      const data = resp.ok ? await resp.json() : [];
      const qLower = (query || "").toLowerCase();
      const opts = (Array.isArray(data) ? data : [])
        .filter(item => {
          const potType =
            item?.pot_type ??
            item?.potType ??
            item?.type ??
            item?.nodeType ??
            item?.metadata?.pot_type ??
            item?.metadata?.nodeType ??
            "";
          return String(potType).trim().toLowerCase() === "funding stream";
        })
        .filter(item => item?.isActive !== false)
        .filter(item => {
          if (!qLower) return true;
          const name = String(item?.name || "").toLowerCase();
          const code = String(item?.code || "").toLowerCase();
          return name.includes(qLower) || code.includes(qLower);
        })
        .map(item => {
          const value = item.id || item.value || item.code;
          if (!value) return null;
          const code = item.code || "";
          const label = item.label || item.name || code || "";
          return {
            value: String(value),
            label,
            description: code || undefined,
          };
        })
        .filter(Boolean);
      setPotOptions(opts);
    } catch (err) {
      console.warn("[ActionPlan] budget pot lookup failed", err);
      setPotOptions([]);
    } finally {
      setPotLoading(false);
    }
  }, []);

  const fundingStreamSelectOptions = useMemo(() => {
    const formatted = (Array.isArray(fundingStreams) ? fundingStreams : []).map(item => {
      if (!item) return null;
      const value = item.code ? String(item.code).trim() : null;
      const label = item.label ? String(item.label).trim() : value;
      if (!value || !label) return null;
      return { value, label };
    }).filter(Boolean);
    if (form.fundingStream && !formatted.some(opt => opt.value === form.fundingStream)) {
      formatted.push({ value: form.fundingStream, label: `${form.fundingStream} (legacy)`, disabled: true });
    }
    return formatted;
  }, [fundingStreams, form.fundingStream]);

  const selectedFundingStream = useMemo(
    () => fundingStreamSelectOptions.find(opt => opt.value === form.fundingStream) || null,
    [fundingStreamSelectOptions, form.fundingStream]
  );

  const selectedBudgetPot = useMemo(
    () =>
      potOptions.find(opt => opt.value === form.budgetPot) ||
      (form.budgetPot ? { value: form.budgetPot, label: form.budgetPot } : null),
    [potOptions, form.budgetPot]
  );

  const clearFieldError = useCallback(field => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!visible || !plan) return;
    const status = (plan.status || "").toLowerCase();
    setEditEnabled(status !== "closed");
    setShowEditConfirm(false);
    const planFundingStream = plan?.fundingStream || plan?.funding_stream || "";
    const derivedAgreement = deriveAgreementNumberFromFundingStream(planFundingStream);
    const agreementNumber = plan?.agreementNumber || plan?.agreement_number || derivedAgreement;
    const childcareNeedCode = normaliseYesNoCode(plan?.childcareNeed);
    const childcareFundingCode = (() => {
      const val = plan?.childcareFunding;
      if (val === null || typeof val === "undefined") return "";
      const str = String(val).trim();
      return CHILDCARE_FUNDING_OPTIONS.some(opt => opt.value === str) ? str : "";
    })();
    setForm({
      name: plan?.title || plan?.name || "",
      summary: plan?.summary || "",
      startDate: plan?.startDate || "",
      reviewDate: plan?.endDate || "",
      fundingStream: planFundingStream,
      budgetPot: plan?.budgetPot || plan?.budget_pot || "",
      agreementNumber,
      educationLevel: plan?.educationLevel ? String(plan.educationLevel) : "",
      educationProvince: plan?.educationProvince ? String(plan.educationProvince) : "",
      socialAssistanceRecipient: plan?.socialAssistanceRecipient !== null && plan?.socialAssistanceRecipient !== undefined ? String(plan.socialAssistanceRecipient) : "",
      eiClaimant: plan?.eiClaimant ? String(plan.eiClaimant) : "",
      prevEmployment: plan?.prevEmployment ? String(plan.prevEmployment) : "",
      prevEmploymentScheduleType: plan?.prevEmploymentScheduleType ? String(plan.prevEmploymentScheduleType) : "",
      prevEmploymentNocVersion: plan?.prevEmploymentNocVersion || "",
      prevEmploymentNoc: plan?.prevEmploymentNoc || "",
      childcareNeed: childcareNeedCode || "",
      childcareFunding: childcareFundingCode,
      barriers: Array.isArray(plan?.barriers) ? plan.barriers.map(b => String(b)) : [],
      resultCode: plan?.resultCode ? String(plan.resultCode) : "",
      resultDate: plan?.resultDate || "",
      resultEducationLevel: plan?.resultEducationLevel ? String(plan.resultEducationLevel) : "",
      futureEducationLevel: plan?.futureEducationLevel ? String(plan.futureEducationLevel) : "",
      resultNocVersion: plan?.resultNocVersion || "",
      resultNoc: plan?.resultNoc || "",
      outcomeSummary: plan?.outcomeSummary || "",
      closureNotes: plan?.closureNotes || "",
    });
    setError(null);
    setFieldErrors({});
    setValidationError(null);
    initialFormRef.current = {
      name: plan?.title || plan?.name || "",
      summary: plan?.summary || "",
      startDate: plan?.startDate || "",
      reviewDate: plan?.endDate || "",
      fundingStream: planFundingStream,
      budgetPot: plan?.budgetPot || plan?.budget_pot || "",
      agreementNumber,
      educationLevel: plan?.educationLevel ? String(plan.educationLevel) : "",
      educationProvince: plan?.educationProvince ? String(plan.educationProvince) : "",
      socialAssistanceRecipient: plan?.socialAssistanceRecipient !== null && plan?.socialAssistanceRecipient !== undefined ? String(plan.socialAssistanceRecipient) : "",
      eiClaimant: plan?.eiClaimant ? String(plan.eiClaimant) : "",
      prevEmployment: plan?.prevEmployment ? String(plan.prevEmployment) : "",
      prevEmploymentScheduleType: plan?.prevEmploymentScheduleType ? String(plan.prevEmploymentScheduleType) : "",
      prevEmploymentNocVersion: plan?.prevEmploymentNocVersion || "",
      prevEmploymentNoc: plan?.prevEmploymentNoc || "",
      childcareNeed: childcareNeedCode || "",
      childcareFunding: childcareFundingCode,
      barriers: Array.isArray(plan?.barriers) ? plan.barriers.map(b => String(b)) : [],
      resultCode: plan?.resultCode ? String(plan.resultCode) : "",
      resultDate: plan?.resultDate || "",
      resultEducationLevel: plan?.resultEducationLevel ? String(plan.resultEducationLevel) : "",
      futureEducationLevel: plan?.futureEducationLevel ? String(plan.futureEducationLevel) : "",
      resultNocVersion: plan?.resultNocVersion || "",
      resultNoc: plan?.resultNoc || "",
      outcomeSummary: plan?.outcomeSummary || "",
      closureNotes: plan?.closureNotes || "",
    };
    setPrevNocOptions([]);
    setResultNocOptions([]);
    loadFundingStreams().catch(() => {});
    loadPots().catch(() => {});
    setPlanExpanded(true);
    setFundingExpanded(true);
    setApplicantExpanded(true);
    setCloseoutExpanded(false);
  }, [visible, plan, loadFundingStreams, loadPots]);

  useEffect(() => {
    if (!form.fundingStream) return;
    const derived = deriveAgreementNumberFromFundingStream(form.fundingStream);
    if (form.agreementNumber === derived) return;
    setForm(current => ({
      ...current,
      agreementNumber: derived,
    }));
  }, [form.fundingStream, form.agreementNumber]);

  useEffect(() => {
    if (form.fundingStream) return;
    if (form.eiClaimant === "1" || form.eiClaimant === "2") {
      setForm(current => ({
        ...current,
        fundingStream: "EI",
        agreementNumber: deriveAgreementNumberFromFundingStream("EI"),
      }));
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.fundingStream;
        delete next.agreementNumber;
        return next;
      });
    } else if (form.eiClaimant === "3") {
      setForm(current => ({
        ...current,
        fundingStream: "CRF",
        agreementNumber: deriveAgreementNumberFromFundingStream("CRF"),
      }));
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.fundingStream;
        delete next.agreementNumber;
        return next;
      });
    }
  }, [form.eiClaimant, form.fundingStream]);

  // Keep childcare funding aligned with need: auto-set to Not applicable when need is No.
  useEffect(() => {
    const need = normaliseYesNoCode(form.childcareNeed);
    if (need === "0" && form.childcareFunding !== "1") {
      setForm(current => ({ ...current, childcareFunding: "1" }));
    }
    if (need !== "1") {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.childcareFunding;
        return next;
      });
    }
  }, [form.childcareNeed, form.childcareFunding]);

  // Clear education province when education level is No formal education.
  useEffect(() => {
    if (form.educationLevel === "1" && form.educationProvince) {
      setForm(current => ({ ...current, educationProvince: "" }));
    }
    if (form.educationLevel === "1") {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.educationProvince;
        return next;
      });
    }
  }, [form.educationLevel, form.educationProvince]);

  // If employment is Employed, ensure a NOC version is available for lookup by default.
  useEffect(() => {
    if (form.prevEmployment === "2" && !form.prevEmploymentNocVersion && DEFAULT_NOC_VERSION) {
      setForm(current => ({ ...current, prevEmploymentNocVersion: DEFAULT_NOC_VERSION }));
    }
    if (form.prevEmployment !== "2") {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next.prevEmploymentScheduleType;
        delete next.prevEmploymentNocVersion;
        delete next.prevEmploymentNoc;
        return next;
      });
    }
  }, [form.prevEmployment, form.prevEmploymentNocVersion]);

  const handlePrevNocSearch = useCallback(async query => {
    if (!form.prevEmploymentNocVersion) {
      setPrevNocOptions([]);
      return;
    }
    setPrevNocLoading(true);
    try {
      const res = await searchNocCodes({ query, version: form.prevEmploymentNocVersion });
      const opts = (res || []).map(item => ({
        value: item.code,
        label: `${item.code} — ${item.title}`,
        description: item.title,
      }));
      setPrevNocOptions(opts);
    } finally {
      setPrevNocLoading(false);
    }
  }, [form.prevEmploymentNocVersion, searchNocCodes]);

  const handleResultNocSearch = useCallback(async query => {
    if (!form.resultNocVersion) {
      setResultNocOptions([]);
      return;
    }
    setResultNocLoading(true);
    try {
      const res = await searchNocCodes({ query, version: form.resultNocVersion });
      const opts = (res || []).map(item => ({
        value: item.code,
        label: `${item.code} — ${item.title}`,
        description: item.title,
      }));
      setResultNocOptions(opts);
    } finally {
      setResultNocLoading(false);
    }
  }, [form.resultNocVersion, searchNocCodes]);

  const validate = () => {
    const errors = {};
    const digits = String(form.agreementNumber || "").replace(/\D/g, "");
    if (!form.name.trim()) errors.name = "Plan name is required.";
    if (!form.startDate) errors.startDate = "Start date is required.";
    if (form.startDate && form.reviewDate && form.reviewDate < form.startDate) errors.reviewDate = "Review date cannot be before start date.";
    if (!form.fundingStream) errors.fundingStream = "Funding stream is required.";
    if (!form.budgetPot) errors.budgetPot = "Budget pot is required.";
    if (!digits || digits.length < 7 || digits.length > 9) errors.agreementNumber = "Agreement number must be 7–9 digits.";
    if (!form.socialAssistanceRecipient) errors.socialAssistanceRecipient = "Social assistance recipient is required.";
    if (!form.educationLevel) errors.educationLevel = "Education level is required.";
    if (form.educationLevel && form.educationLevel !== "1" && !form.educationProvince) errors.educationProvince = "Education province is required when education level is set.";
    if (!form.eiClaimant) errors.eiClaimant = "EI claimant status is required.";
    if (!form.prevEmployment) errors.prevEmployment = "Employment status at plan start is required.";
    if (form.prevEmployment === "2") {
      if (!form.prevEmploymentScheduleType) errors.prevEmploymentScheduleType = "Schedule type is required when employment status is Employed.";
      if (!form.prevEmploymentNocVersion) errors.prevEmploymentNocVersion = "NOC version is required when employment status is Employed.";
      if (!form.prevEmploymentNoc) errors.prevEmploymentNoc = "NOC code is required when employment status is Employed.";
    }
    const planStart = plan?.startDate || plan?.effectiveDate || form.startDate || null;
    const latestInterventionEnd = Array.isArray(plan?.interventions)
      ? plan.interventions
          .map(item => item?.endDate || item?.end_date || null)
          .filter(Boolean)
          .sort()
          .pop()
      : null;
    const childcareNeedCode = normaliseYesNoCode(form.childcareNeed);
    if (childcareNeedCode === "1" && !form.childcareFunding) errors.childcareFunding = "Childcare funding is required when childcare need is Yes.";
    const startEducation = form.educationLevel ? Number(form.educationLevel) : null;
    const anyCloseout = form.resultCode || form.resultDate || form.resultEducationLevel || form.futureEducationLevel || form.resultNoc || form.resultNocVersion || form.outcomeSummary;
    if (anyCloseout) {
      if (!form.resultCode) errors.resultCode = "Result code is required.";
      if (!form.resultDate) errors.resultDate = "Result date is required.";
      if (!form.resultEducationLevel) errors.resultEducationLevel = "Action Plan Result Education Level is required.";
      const closeoutEducation = form.resultEducationLevel ? Number(form.resultEducationLevel) : null;
      if (Number.isFinite(startEducation) && Number.isFinite(closeoutEducation) && closeoutEducation < startEducation) {
        errors.resultEducationLevel = `Result education cannot be lower than the plan start level (${form.educationLevel || ""}).`;
      }
      if (form.resultDate) {
        const today = new Date();
        const resultDt = new Date(form.resultDate);
        if (planStart && resultDt < new Date(planStart)) {
          errors.resultDate = "Result date cannot be before the action plan start date.";
        }
        if (latestInterventionEnd && resultDt < new Date(latestInterventionEnd)) {
          errors.resultDate = "Result date cannot be before the latest intervention end date.";
        }
        if (resultDt > today) {
          errors.resultDate = "Result date cannot be in the future.";
        }
      }
      if (form.resultCode === "4" && !form.futureEducationLevel) errors.futureEducationLevel = "Future education level is required for Returned to school.";
      if (form.resultCode === "2") {
        if (!form.resultNocVersion) errors.resultNocVersion = "Result NOC version is required for Employed.";
        if (!form.resultNoc) {
          errors.resultNoc = "Result NOC code is required for Employed.";
        } else {
          const len = form.resultNocVersion === "2021" ? 5 : 4;
          const digitsNoc = form.resultNoc.replace(/\D/g, "");
          if (digitsNoc.length !== len) errors.resultNoc = `Result NOC code must be ${len} digits for version ${form.resultNocVersion}.`;
        }
      }
    }
    return errors;
  };

  const buildPayload = () => {
    const fundingStream = form.fundingStream || "";
    const agreementNumber = deriveAgreementNumberFromFundingStream(fundingStream);
    const childcareNeedCode = normaliseYesNoCode(form.childcareNeed) || null;
    const childcareFundingCode =
      childcareNeedCode === "1" && CHILDCARE_FUNDING_OPTIONS.some(opt => opt.value === form.childcareFunding)
        ? form.childcareFunding
        : null;
    const isPlanClosed = (plan.status || "").toLowerCase() === "closed";
    return {
      name: form.name.trim(),
      startDate: form.startDate || null,
      reviewDate: form.reviewDate || null,
      summary: form.summary || null,
      fundingStream: fundingStream || null,
      budgetPot: form.budgetPot || null,
      agreementNumber: agreementNumber || null,
      educationLevel: form.educationLevel || null,
      educationProvince: form.educationProvince || null,
      socialAssistanceRecipient: form.socialAssistanceRecipient || null,
      eiClaimant: form.eiClaimant || null,
      prevEmployment: form.prevEmployment || null,
      prevEmploymentScheduleType: form.prevEmployment === "2" ? form.prevEmploymentScheduleType || null : null,
      prevEmploymentNocVersion: form.prevEmployment === "2" ? form.prevEmploymentNocVersion || null : null,
      prevEmploymentNoc: form.prevEmployment === "2" ? form.prevEmploymentNoc || null : null,
      childcareNeed: childcareNeedCode,
      childcareFunding: childcareFundingCode,
      barriers: Array.isArray(form.barriers) ? form.barriers : [],
      resultCode: form.resultCode || null,
      resultDate: form.resultDate || null,
      resultEducationLevel: form.resultCode ? form.resultEducationLevel || null : null,
      futureEducationLevel: form.resultCode === "4" ? form.futureEducationLevel || null : null,
      resultNocVersion: form.resultCode === "2" ? form.resultNocVersion || null : null,
      resultNoc: form.resultCode === "2" ? form.resultNoc || null : null,
      outcomeSummary: form.outcomeSummary || null,
      closureNotes: form.closureNotes || null,
      allowClosedEdit: isPlanClosed ? true : undefined,
    };
  };

  const isDirty = useMemo(() => {
    try {
      return JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
    } catch (_e) {
      return true;
    }
  }, [form]);

  const sectionHasPlanErrors = useCallback(
    errors => Boolean(errors.name || errors.startDate || errors.reviewDate),
    []
  );
  const sectionHasFundingErrors = useCallback(
    errors => Boolean(errors.fundingStream || errors.budgetPot || errors.agreementNumber),
    []
  );
  const sectionHasApplicantErrors = useCallback(errors =>
    Boolean(
      errors.eiClaimant ||
        errors.socialAssistanceRecipient ||
        errors.childcareNeed ||
        errors.childcareFunding ||
        errors.educationLevel ||
        errors.educationProvince ||
        errors.prevEmployment ||
        errors.prevEmploymentScheduleType ||
        errors.prevEmploymentNocVersion ||
        errors.prevEmploymentNoc
    ), []);

  const handleSubmit = async () => {
    if (!editEnabled) {
      setValidationError("Editing is disabled for closed action plans. Use Edit to enable changes.");
      return null;
    }
    const validation = validate();
    if (Object.keys(validation).length) {
      setValidationError(Object.values(validation)[0]);
      setFieldErrors(validation);
      return null;
    }
    setFieldErrors({});
    setValidationError(null);
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      const updated = await updateActionPlan(plan.id, payload);
      setSaving(false);
      setEditEnabled(false);
      initialFormRef.current = { ...form };
      if (onSaved) onSaved(updated);
      return updated;
    } catch (err) {
      setSaving(false);
      setError(err?.message || "Failed to update action plan.");
      return null;
    }
  };

  if (!visible || !plan) return null;

  const selectedPrevEmployment = PREV_EMPLOYMENT_OPTIONS.find(opt => opt.value === form.prevEmployment) || null;
  const selectedEiClaimant = EI_CLAIMANT_OPTIONS.find(opt => opt.value === form.eiClaimant) || null;
  const selectedEducationLevel = EDUCATION_OPTIONS.find(opt => opt.value === form.educationLevel) || null;
  const selectedEducationProvince = PROVINCE_OPTIONS.find(opt => opt.value === form.educationProvince) || null;
  const selectedSocialAssistance = YES_NO_OPTIONS.find(opt => opt.value === form.socialAssistanceRecipient) || null;
  const selectedChildcareNeed = YES_NO_OPTIONS.find(opt => opt.value === form.childcareNeed) || null;
  const selectedChildcareFunding = CHILDCARE_FUNDING_OPTIONS.find(opt => opt.value === form.childcareFunding) || null;
  const selectedPrevEmploymentNocVersion = NOC_VERSION_OPTIONS.find(opt => opt.value === form.prevEmploymentNocVersion) || null;
  const selectedResultCode = RESULT_OPTIONS.find(opt => opt.value === form.resultCode) || null;
  const selectedResultEducation = RESULT_EDUCATION_OPTIONS.find(opt => opt.value === form.resultEducationLevel) || null;
  const selectedFutureEducation = FUTURE_EDUCATION_OPTIONS.find(opt => opt.value === form.futureEducationLevel) || null;
  const selectedResultNocVersion = NOC_VERSION_OPTIONS.find(opt => opt.value === form.resultNocVersion) || null;
  const selectedBarriers = BARRIER_OPTIONS.filter(opt => (form.barriers || []).includes(opt.value));

  const metadata = {
    status: plan.status || null,
    interventionCount: plan.interventionCount ?? plan.interventions?.length ?? null,
    createdAt: plan.createdAt || null,
    updatedAt: plan.updatedAt || null,
    activatedAt: plan.activatedAt || null,
    closedAt: plan.closedAt || null,
    archivedAt: plan.archivedAt || null,
    owner: caseData?.owner?.email || caseData?.owner?.name || "-",
    caseId: plan.caseId || caseData?.caseNumber || caseData?.trackingId || "-",
  };

  const isClosed = (plan.status || "").toLowerCase() === "closed";
  const planStatus = (plan.status || "").toLowerCase();
  const isDraft = planStatus === "draft";
  const isActive = planStatus === "active";

  return (
    <>
      <Modal
        visible={visible}
        header="Action plan details"
        onDismiss={
          saving
            ? null
            : () => {
                setEditEnabled(!isClosed);
        setShowEditConfirm(false);
        setShowActivateConfirm(false);
        setShowCloseConfirm(false);
        setCloseoutExpanded(false);
        onDismiss();
      }
        }
        closeAriaLabel="Close action plan details modal"
        size="large"
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            {isClosed && !editEnabled && (
              <StatusIndicator type="stopped">
                Closed plans are read-only. Edit only to correct mistakes.
              </StatusIndicator>
            )}
            <Button
              onClick={
                saving
                  ? null
                  : () => {
                      setEditEnabled(!isClosed);
                      setShowEditConfirm(false);
                      setCloseoutExpanded(false);
                      onDismiss();
                    }
              }
              disabled={saving}
            >
              Cancel
            </Button>
            {isClosed && (
              <Button
                variant="primary"
                onClick={() => setShowEditConfirm(true)}
                disabled={saving || editEnabled}
              >
                Edit
              </Button>
            )}
            {isDraft && (
              <Button
                variant={isDirty ? "normal" : "primary"}
                onClick={async () => {
                  const updated = await handleSubmit();
                  if (!updated && isDirty) return;
                  setShowActivateConfirm(true);
                }}
                loading={saving}
                disabled={saving}
              >
                Activate plan
              </Button>
            )}
            {isActive && (
              <Button
                variant={closeoutExpanded ? "primary" : isDirty ? "normal" : "primary"}
                onClick={async () => {
                  const validation = validate();
                  if (Object.keys(validation).length) {
                    setValidationError(Object.values(validation)[0]);
                    setFieldErrors(validation);
                    setCloseoutExpanded(true);
                    setPlanExpanded(sectionHasPlanErrors(validation));
                    setFundingExpanded(sectionHasFundingErrors(validation));
                    setApplicantExpanded(sectionHasApplicantErrors(validation));
                    return;
                  }
                  if (isDirty) {
                    const updated = await handleSubmit();
                    if (!updated) return;
                  }
                  setCloseoutExpanded(true);
                  setPlanExpanded(false);
                  setFundingExpanded(false);
                  setApplicantExpanded(false);
                  const hasCloseout = form.resultCode || form.resultDate || form.resultEducationLevel;
                  if (!hasCloseout) {
                    setValidationError("Result code, date, and education level are required to close this plan.");
                    setFieldErrors(prev => ({
                      ...prev,
                      resultCode: prev.resultCode || (!form.resultCode ? "Result code is required." : undefined),
                      resultDate: prev.resultDate || (!form.resultDate ? "Result date is required." : undefined),
                      resultEducationLevel:
                        prev.resultEducationLevel ||
                        (!form.resultEducationLevel ? "Action Plan Result Education Level is required." : undefined),
                    }));
                    return;
                  }
                  setShowCloseConfirm(true);
                }}
                disabled={saving}
              >
                Closeout plan
              </Button>
            )}
            {!(isActive && closeoutExpanded) && (
              <Button
                variant={isDirty ? "primary" : "normal"}
                onClick={handleSubmit}
                loading={saving}
                disabled={isClosed && !editEnabled}
              >
                Save changes
              </Button>
            )}
          </SpaceBetween>
        }
      >
      <SpaceBetween size="l">
        {validationError && (
          <Alert
            type="error"
            dismissible
            dismissAriaLabel="Dismiss validation message"
            onDismiss={() => setValidationError(null)}
          >
            {validationError}
          </Alert>
        )}
        {error && (
          <Alert
            type="error"
            dismissible
            dismissAriaLabel="Dismiss error message"
            onDismiss={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <ExpandableSection
          headerText="About the plan"
          defaultExpanded={planExpanded}
          onChange={({ detail }) => setPlanExpanded(detail.expanded)}
        >
          <ColumnLayout columns={3} variant="text-grid">
            <FormField label="Plan name" errorText={fieldErrors.name}>
              <Input
                value={form.name}
                readOnly={isClosed && !editEnabled}
                onChange={({ detail }) => {
                  clearFieldError("name");
                  setForm(curr => ({ ...curr, name: detail.value }));
                }}
              />
            </FormField>
            <FormField label="Plan status">
              <Input value={displayValue(plan.status)} readOnly />
            </FormField>
            <FormField label="Assigned to">
              <Input value={displayValue(metadata.owner)} readOnly />
            </FormField>
            <FormField label="Start date" description="When the plan becomes active." errorText={fieldErrors.startDate}>
              <DatePicker
                value={form.startDate}
                disabled={isClosed && !editEnabled}
                onChange={({ detail }) => {
                  clearFieldError("startDate");
                  setForm(curr => ({ ...curr, startDate: detail.value }));
                }}
                placeholder="YYYY-MM-DD"
              />
            </FormField>
            <FormField
              label="Review date"
              description="This will trigger a reminder on this date in the calendar."
              errorText={fieldErrors.reviewDate}
            >
              <DatePicker
                value={form.reviewDate}
                disabled={isClosed && !editEnabled}
                onChange={({ detail }) => {
                  clearFieldError("reviewDate");
                  setForm(curr => ({ ...curr, reviewDate: detail.value }));
                }}
              placeholder="YYYY-MM-DD"
            />
          </FormField>
            <FormField label="Created at">
              <Input value={displayValue(metadata.createdAt)} readOnly />
            </FormField>
            <FormField label="Last updated">
              <Input value={displayValue(metadata.updatedAt)} readOnly />
            </FormField>
            <FormField label="Activated at">
              <Input value={displayValue(metadata.activatedAt)} readOnly />
            </FormField>
            <FormField label="Closed at">
              <Input value={displayValue(metadata.closedAt)} readOnly />
            </FormField>
            <FormField label="Interventions">
              <Input value={displayValue(metadata.interventionCount)} readOnly />
            </FormField>
            <FormField label="Archived at">
              <Input value={displayValue(metadata.archivedAt)} readOnly />
            </FormField>
            <FormField label="Plan summary" description="High-level objective for this plan.">
              <Textarea
                value={form.summary}
                readOnly={isClosed && !editEnabled}
                rows={3}
                onChange={({ detail }) => setForm(curr => ({ ...curr, summary: detail.value }))}
                placeholder="High-level objective for this plan"
              />
            </FormField>
          </ColumnLayout>
        </ExpandableSection>

        <ExpandableSection
          headerText="About the funding"
          defaultExpanded={fundingExpanded}
          onChange={({ detail }) => setFundingExpanded(detail.expanded)}
        >
          <ColumnLayout columns={3} variant="text-grid">
          <FormField label="Funding stream" description="Select funding stream for this action plan." errorText={fieldErrors.fundingStream}>
            <Select
              selectedOption={selectedFundingStream}
              options={fundingStreamSelectOptions}
              onChange={({ detail }) => {
                clearFieldError("fundingStream");
                clearFieldError("agreementNumber");
                setForm(current => ({
                  ...current,
                  fundingStream: detail.selectedOption?.value || "",
                  agreementNumber: deriveAgreementNumberFromFundingStream(detail.selectedOption?.value || ""),
                }));
              }}
              placeholder={fundingStreamsLoading ? "Loading funding streams" : "Select funding stream"}
              statusType={fundingStreamsLoading ? "loading" : "finished"}
              empty={fundingStreamsLoading ? undefined : "No funding streams available"}
              disabled={isClosed && !editEnabled}
            />
          </FormField>
          <FormField label="Budget pot" description="Select the budget pot for this action plan." errorText={fieldErrors.budgetPot}>
            <Select
              selectedOption={selectedBudgetPot}
              options={potOptions}
              onChange={({ detail }) => {
                clearFieldError("budgetPot");
                setForm(current => ({ ...current, budgetPot: detail.selectedOption?.value || "" }));
              }}
              filteringType="auto"
              onLoadItems={({ detail }) => {
                if (detail?.filteringText !== undefined) {
                  loadPots(detail.filteringText);
                }
                }}
                placeholder={potLoading ? "Loading budget pots" : "Select budget pot"}
                statusType={potLoading ? "loading" : "finished"}
                empty={potLoading ? undefined : "No budget pots found"}
                disabled={isClosed && !editEnabled}
              />
            </FormField>
            <FormField label="Agreement Number" description="Mapped automatically from funding stream (read-only)." errorText={fieldErrors.agreementNumber}>
              <Input value={form.agreementNumber} readOnly />
            </FormField>
          </ColumnLayout>
        </ExpandableSection>

        <ExpandableSection
          headerText="About the applicant"
          defaultExpanded={applicantExpanded}
          onChange={({ detail }) => setApplicantExpanded(detail.expanded)}
        >
          <SpaceBetween size="m">
            <FormField
              label="Barriers to Employment"
              description="A client may have more than one (1) barrier to employment. Choose all that apply."
            >
              <Multiselect
                options={BARRIER_OPTIONS}
                selectedOptions={selectedBarriers}
                onChange={({ detail }) =>
                  setForm(current => ({
                    ...current,
                    barriers: (detail.selectedOptions || []).map(opt => opt.value),
                  }))
                }
                inlineTokens
                tokenLimit={5}
                deselectAriaLabel={e => `Remove ${e.option?.label || e.option?.value}`}
                placeholder="Select barriers"
              />
            </FormField>
            <ColumnLayout columns={3} variant="text-grid">
              <FormField label="EI claimant status" description="ESDC codes: claimant, reach-back, or non-insured." errorText={fieldErrors.eiClaimant}>
                <Select
                  selectedOption={selectedEiClaimant}
                  options={EI_CLAIMANT_OPTIONS}
                  onChange={({ detail }) => {
                    clearFieldError("eiClaimant");
                    setForm(curr => ({ ...curr, eiClaimant: detail.selectedOption?.value || "" }));
                  }}
              placeholder="Select EI status"
            />
          </FormField>
          <FormField label="Social Assistance Recipient" description="Is the client a Social Assistance Recipient at the time of creation of the Action Plan?" errorText={fieldErrors.socialAssistanceRecipient}>
            <Select
              selectedOption={selectedSocialAssistance}
              options={YES_NO_OPTIONS}
              onChange={({ detail }) => {
                clearFieldError("socialAssistanceRecipient");
                setForm(curr => ({ ...curr, socialAssistanceRecipient: detail.selectedOption?.value || "" }));
              }}
              placeholder="Select"
            />
          </FormField>
          <FormField label="Childcare need" description="ESDC code 0 = No, 1 = Yes." errorText={fieldErrors.childcareNeed}>
            <Select
              selectedOption={selectedChildcareNeed}
              options={YES_NO_OPTIONS}
              onChange={({ detail }) => {
                clearFieldError("childcareNeed");
                setForm(curr => ({ ...curr, childcareNeed: detail.selectedOption?.value || "" }));
              }}
              placeholder="Select"
            />
          </FormField>
          {normaliseYesNoCode(form.childcareNeed) === "1" && (
            <FormField label="Childcare funding" description="ESDC code 1–7." errorText={fieldErrors.childcareFunding}>
              <Select
                selectedOption={selectedChildcareFunding}
                options={CHILDCARE_FUNDING_OPTIONS}
                onChange={({ detail }) => {
                  clearFieldError("childcareFunding");
                  setForm(curr => ({ ...curr, childcareFunding: detail.selectedOption?.value || "" }));
                }}
                placeholder="Select"
              />
            </FormField>
          )}
          <FormField label="Education Level" description="Highest level of education attained at the time of creation of Action Plan." errorText={fieldErrors.educationLevel}>
            <Select
              selectedOption={selectedEducationLevel}
              options={EDUCATION_OPTIONS}
              onChange={({ detail }) => {
                clearFieldError("educationLevel");
                setForm(curr => ({ ...curr, educationLevel: detail.selectedOption?.value || "" }));
              }}
              placeholder="Select education level"
            />
          </FormField>
          {form.educationLevel && form.educationLevel !== "1" && (
            <FormField label="Education Province" description="Province (or area outside Canada) in which the highest level of education was attained." errorText={fieldErrors.educationProvince}>
              <Select
                selectedOption={selectedEducationProvince}
                options={PROVINCE_OPTIONS}
                onChange={({ detail }) => {
                  clearFieldError("educationProvince");
                  setForm(curr => ({ ...curr, educationProvince: detail.selectedOption?.value || "" }));
                }}
                placeholder="Select province/territory"
              />
            </FormField>
          )}
              <FormField
                label="Employment status at plan start"
                description="The client’s employment status at the start of this action plan"
                errorText={fieldErrors.prevEmployment}
              >
                <Select
                  selectedOption={selectedPrevEmployment}
                  options={PREV_EMPLOYMENT_OPTIONS}
                  onChange={({ detail }) => {
                    clearFieldError("prevEmployment");
                    clearFieldError("prevEmploymentScheduleType");
                    clearFieldError("prevEmploymentNocVersion");
                    clearFieldError("prevEmploymentNoc");
                    setForm(curr => ({ ...curr, prevEmployment: detail.selectedOption?.value || "" }));
                  }}
                  placeholder="Select status"
                />
              </FormField>
              {form.prevEmployment === "2" && (
                <>
                  <FormField
                    label="Schedule type"
                    description="Required when employment status is Employed."
                    errorText={fieldErrors.prevEmploymentScheduleType}
                  >
                    <Select
                      selectedOption={SCHEDULE_OPTIONS.find(opt => opt.value === form.prevEmploymentScheduleType) || null}
                      options={SCHEDULE_OPTIONS}
                      onChange={({ detail }) => {
                        clearFieldError("prevEmploymentScheduleType");
                        setForm(curr => ({ ...curr, prevEmploymentScheduleType: detail.selectedOption?.value || "" }));
                      }}
                      placeholder="Select schedule type"
                      invalid={Boolean(fieldErrors.prevEmploymentScheduleType)}
                    />
                  </FormField>
                  <FormField
                    label="NOC Version"
                    description="NOC version for the client's employment at action plan start."
                    errorText={fieldErrors.prevEmploymentNocVersion}
                  >
                    <Select
                      selectedOption={selectedPrevEmploymentNocVersion}
                      options={NOC_VERSION_OPTIONS}
                      onChange={({ detail }) => {
                        clearFieldError("prevEmploymentNocVersion");
                        setForm(curr => ({ ...curr, prevEmploymentNocVersion: detail.selectedOption?.value || "" }));
                      }}
                      placeholder="Select NOC version"
                      invalid={Boolean(fieldErrors.prevEmploymentNocVersion)}
                    />
                  </FormField>
                  <FormField
                    label="NOC Code Lookup"
                    description="NOC code for the client's employment at action plan start."
                    errorText={fieldErrors.prevEmploymentNoc}
                  >
                    <Autosuggest
                      value={form.prevEmploymentNoc || ""}
                      onChange={({ detail }) => {
                        clearFieldError("prevEmploymentNoc");
                        setForm(curr => ({ ...curr, prevEmploymentNoc: detail.value }));
                      }}
                      onLoadItems={({ detail }) => handlePrevNocSearch(detail.filteringText)}
                      options={prevNocOptions}
                      placeholder={form.prevEmploymentNocVersion ? "Search NOC code" : "Select NOC version first"}
                      empty="No matches"
                      filteringType="manual"
                      statusType={prevNocLoading ? "loading" : "finished"}
                      loadingText="Searching NOC codes"
                      expandToViewport
                      disabled={form.prevEmployment !== "2" || !form.prevEmploymentNocVersion}
                      invalid={Boolean(fieldErrors.prevEmploymentNoc)}
                    />
                  </FormField>
                </>
              )}
            </ColumnLayout>
          </SpaceBetween>
        </ExpandableSection>

        {(plan?.status === "closed" || form.resultCode || form.resultDate || form.outcomeSummary || form.closureNotes || closeoutExpanded) && (
          <ExpandableSection
            headerText="Closeout details"
            headerDescription="Result, education, and NOC details for closing this action plan."
            defaultExpanded={closeoutExpanded}
            onChange={({ detail }) => setCloseoutExpanded(detail.expanded)}
          >
          <SpaceBetween size="m">
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Result code" errorText={fieldErrors.resultCode}>
                <Select
                  selectedOption={selectedResultCode}
                  options={RESULT_OPTIONS}
                  onChange={({ detail }) => {
                    clearFieldError("resultCode");
                    setForm(curr => ({ ...curr, resultCode: detail.selectedOption?.value || "" }));
                  }}
                  placeholder="Select result"
                />
              </FormField>
              <FormField label="Result date" errorText={fieldErrors.resultDate}>
                <DatePicker
                  value={form.resultDate}
                  onChange={({ detail }) => {
                    clearFieldError("resultDate");
                    setForm(curr => ({ ...curr, resultDate: detail.value }));
                  }}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <FormField
                label="Action Plan Result Education Level"
                description={`ESDC code after completion. Participant level at plan start: ${displayValue(plan.educationLevel) || "-"}. Result cannot be lower than start.`}
                errorText={fieldErrors.resultEducationLevel}
              >
                <Select
                  selectedOption={selectedResultEducation}
                  options={RESULT_EDUCATION_OPTIONS}
                  onChange={({ detail }) => {
                    clearFieldError("resultEducationLevel");
                    setForm(curr => ({ ...curr, resultEducationLevel: detail.selectedOption?.value || "" }));
                  }}
                  placeholder="Select education level"
                />
              </FormField>
              {form.resultCode === "4" && (
                <FormField
                  label="Action Plan Future Education Level"
                  description="Required when Returned to school."
                  errorText={fieldErrors.futureEducationLevel}
                >
                  <Select
                    selectedOption={selectedFutureEducation}
                    options={FUTURE_EDUCATION_OPTIONS}
                    onChange={({ detail }) => {
                      clearFieldError("futureEducationLevel");
                      setForm(curr => ({ ...curr, futureEducationLevel: detail.selectedOption?.value || "" }));
                    }}
                    placeholder="Select future education level"
                  />
                </FormField>
              )}
              {form.resultCode === "2" && (
                <>
                  <FormField
                    label="Result NOC Version"
                    description="Required when result is Employed."
                    errorText={fieldErrors.resultNocVersion}
                  >
                    <Select
                      selectedOption={selectedResultNocVersion}
                      options={NOC_VERSION_OPTIONS}
                      onChange={({ detail }) => {
                        clearFieldError("resultNocVersion");
                        setForm(curr => ({ ...curr, resultNocVersion: detail.selectedOption?.value || "" }));
                      }}
                      placeholder="Select NOC version"
                    />
                  </FormField>
                  <FormField
                    label="Result NOC code"
                    description="Required when result is Employed."
                    errorText={fieldErrors.resultNoc}
                  >
                  <Autosuggest
                    value={form.resultNoc}
                    onChange={({ detail }) => {
                      clearFieldError("resultNoc");
                      setForm(curr => ({ ...curr, resultNoc: detail.value }));
                    }}
                    onLoadItems={({ detail }) => handleResultNocSearch(detail.filteringText)}
                    options={resultNocOptions}
                    placeholder={form.resultNocVersion ? "Search NOC code" : "Select NOC version first"}
                    empty="No matches"
                    filteringType="manual"
                    statusType={resultNocLoading ? "loading" : "finished"}
                    loadingText="Searching NOC codes"
                    expandToViewport
                    disabled={!form.resultNocVersion}
                  />
                </FormField>
                </>
              )}
            </ColumnLayout>
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Outcome summary (optional)">
                <Textarea
                  value={form.outcomeSummary}
                  rows={3}
                  onChange={({ detail }) => setForm(curr => ({ ...curr, outcomeSummary: detail.value }))}
                  placeholder="Summarize the plan outcome"
                />
              </FormField>
              <FormField label="Closure notes (optional)">
                <Textarea
                  value={form.closureNotes}
                  rows={3}
                  onChange={({ detail }) => setForm(curr => ({ ...curr, closureNotes: detail.value }))}
                  placeholder="Internal notes"
                />
              </FormField>
            </ColumnLayout>
          </SpaceBetween>
          </ExpandableSection>
        )}

      </SpaceBetween>
      </Modal>

      <Modal
        visible={showEditConfirm}
        header="Enable editing for closed plan?"
        closeAriaLabel="Dismiss edit confirmation"
        onDismiss={() => setShowEditConfirm(false)}
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            <Button onClick={() => setShowEditConfirm(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditEnabled(true);
                setShowEditConfirm(false);
              }}
            >
              Enable editing
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          <Alert type="warning">
            Closed action plans should only be edited to correct mistakes. Proceeding will enable editing for this
            session; saving or leaving will return the plan to read-only.
          </Alert>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={showActivateConfirm}
        header="Activate action plan?"
        closeAriaLabel="Dismiss activation confirmation"
        onDismiss={() => setShowActivateConfirm(false)}
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            <Button onClick={() => setShowActivateConfirm(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  const updated = await activateActionPlan(plan.id);
                  setShowActivateConfirm(false);
                  if (onSaved) onSaved(updated);
                } catch (err) {
                  const message =
                    err?.code === "active_plan_exists"
                      ? "Another action plan is already active. Close it before activating this one."
                      : err?.message || "Failed to activate action plan.";
                  setError(message);
                  setShowActivateConfirm(false);
                }
              }}
            >
              Activate
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          <Alert type="warning">
            Activate this plan? Only one action plan can be active at a time. Active plans cannot be deleted; close
            them instead.
          </Alert>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={showCloseConfirm}
        header="Close out action plan?"
        closeAriaLabel="Dismiss close confirmation"
        onDismiss={() => setShowCloseConfirm(false)}
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            <Button onClick={() => setShowCloseConfirm(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  const payload = {
                    resultCode: form.resultCode || null,
                    resultDate: form.resultDate || null,
                    resultNocVersion: form.resultNocVersion || null,
                    resultNoc: form.resultNoc || null,
                    resultEducationLevel: form.resultEducationLevel || null,
                    futureEducationLevel: form.futureEducationLevel || null,
                    outcomeSummary: form.outcomeSummary || null,
                    closureNotes: form.closureNotes || null,
                  };
                  const updated = await closeActionPlan(plan.id, payload);
                  setShowCloseConfirm(false);
                  if (onSaved) onSaved(updated);
                } catch (err) {
                  setError(err?.message || "Failed to close action plan.");
                  setShowCloseConfirm(false);
                }
              }}
            >
              Close action plan
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          <Alert type="warning">
            Close this plan? Ensure all interventions are closed. Result details are required to complete closeout.
          </Alert>
        </SpaceBetween>
      </Modal>
    </>
  );
};

export default ActionPlanDetailsModal;
