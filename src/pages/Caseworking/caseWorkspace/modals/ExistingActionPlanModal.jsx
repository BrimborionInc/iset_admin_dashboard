import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autosuggest,
  Box,
  Button,
  ColumnLayout,
  DatePicker,
  FormField,
  Input,
  Multiselect,
  Modal,
  Select,
  SpaceBetween,
  Textarea,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../../auth/apiClient.js";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
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
  { value: "10", label: "Bachelor's" },
  { value: "11", label: "Master's" },
  { value: "12", label: "Doctorate" },
];

const EDUCATION_OPTIONS = RESULT_EDUCATION_OPTIONS;

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

const FUTURE_EDUCATION_OPTIONS = [
  { value: "5", label: "Secondary diploma / GED" },
  { value: "8", label: "College / CEGEP / non-university diploma" },
  { value: "9", label: "University certificate/diploma" },
  { value: "10", label: "Bachelor's" },
];

const NOC_VERSION_OPTIONS = [
  { value: "2016", label: "2016" },
  { value: "2021", label: "2021" },
];
const DEFAULT_NOC_VERSION = NOC_VERSION_OPTIONS[0]?.value || "";

const EI_CLAIMANT_OPTIONS = [
  { value: "1", label: "Employment insurance claimant" },
  { value: "2", label: "Reach-back client/former claimant" },
  { value: "3", label: "Non-insured client" },
];

const YES_NO_OPTIONS = [
  { value: "1", label: "Yes" },
  { value: "0", label: "No" },
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

const CHILDCARE_FUNDING_OPTIONS = [
  { value: "1", label: "Not applicable" },
  { value: "2", label: "FNICCI" },
  { value: "3", label: "EI/CRF" },
  { value: "4", label: "Provincial funding / subsidy" },
  { value: "5", label: "No funding received" },
  { value: "6", label: "Daycare space not available" },
  { value: "7", label: "Assisted by family / Self-funded" },
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

const EDUCATION_VALUE_TO_ILMP_CODE = {
  no_formal_education: "1",
  grade_7_8: "2",
  grade_9_10: "3",
  grade_11_12: "4",
  secondary_school_diploma_or_ged: "5",
  post_secondary_training: "6",
  apprenticeship_trades: "7",
  cegep: "8",
  college: "8",
  university_certificate: "9",
  bachelors_degree: "10",
  masters_degree: "11",
  doctorate: "12",
};

const PROVINCE_VALUE_TO_ILMP_CODE = {
  nl: "1",
  ns: "2",
  nb: "3",
  pe: "4",
  qc: "5",
  on: "6",
  mb: "7",
  sk: "8",
  ab: "9",
  nt: "10",
  bc: "11",
  yt: "12",
  us: "13",
  usa: "13",
  other: "14",
  nu: "16",
};

const BARRIER_VALUE_TO_ILMP_CODE = {
  none: "1",
  "lack-of-labour-force-attachment": "2",
  "lack of labour force attachment": "2",
  "lack-of-work-experience": "3",
  "lack of work experience": "3",
  "lack-of-transportation": "4",
  "lack of transportation": "4",
  location: "5",
  remoteness: "5",
  language: "6",
  education: "7",
  economic: "8",
  funding: "8",
  "dependent-care": "9",
  "dependent care": "9",
  "lack-of-job-opportunities": "10",
  "lack of job opportunities": "10",
  "lack of marketable skills": "10",
  "physical-or-mental-health": "11",
  "physical or mental health": "11",
  "physical/emotional/mental health": "11",
  other: "12",
};

const defaultForm = {
  name: "",
  status: "active",
  startDate: "",
  reviewDate: "",
  fundingStream: "",
  budgetPot: "",
  educationLevel: "",
  educationProvince: "",
  socialAssistanceRecipient: "",
  eiClaimant: "",
  prevEmployment: "",
  prevEmploymentNoc: "",
  prevEmploymentNocVersion: "",
  prevEmploymentScheduleType: "",
  childcareNeed: "",
  childcareFunding: "",
  barriers: [],
  summary: "",
  resultCode: "",
  resultDate: "",
  resultEducationLevel: "",
  futureEducationLevel: "",
  resultNocVersion: "",
  resultNoc: "",
  outcomeSummary: "",
  closureNotes: "",
};

const normalizeText = value => {
  if (value === null || typeof value === "undefined") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
};

const firstNonBlank = (...values) => {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return "";
};

const normalizeCode = value => normalizeText(value);

const mapEducationToIlmpCode = value => {
  const normalized = normalizeCode(value).toLowerCase();
  if (!normalized) return "";
  if (EDUCATION_OPTIONS.some(option => option.value === normalized)) return normalized;
  if (EDUCATION_VALUE_TO_ILMP_CODE[normalized]) return EDUCATION_VALUE_TO_ILMP_CODE[normalized];
  const matchingLabel = EDUCATION_OPTIONS.find(option => option.label.toLowerCase() === normalized);
  if (matchingLabel) return matchingLabel.value;
  if (normalized.includes("bachelor")) return "10";
  if (normalized.includes("master")) return "11";
  if (normalized.includes("doctor")) return "12";
  if (normalized.includes("secondary") && (normalized.includes("diploma") || normalized.includes("ged"))) return "5";
  if (normalized.includes("college") || normalized.includes("cegep")) return "8";
  return "";
};

const mapProvinceToIlmpCode = value => {
  const normalized = normalizeCode(value).toLowerCase();
  if (!normalized) return "";
  if (PROVINCE_OPTIONS.some(option => option.value === normalized)) return normalized;
  const upper = normalized.toUpperCase();
  const byLabel = PROVINCE_OPTIONS.find(option => option.label.toUpperCase() === upper);
  if (byLabel) return byLabel.value;
  return PROVINCE_VALUE_TO_ILMP_CODE[normalized] || "";
};

const mapYesNoToIlmpCode = value => {
  const normalized = normalizeCode(value).toLowerCase();
  if (!normalized) return "";
  if (["yes", "true", "1", "y"].includes(normalized)) return "1";
  if (["no", "false", "0", "n"].includes(normalized)) return "0";
  return "";
};

const mapEmploymentStatusToIlmpCode = value => {
  const normalized = normalizeCode(value).toLowerCase();
  if (!normalized) return "";
  if (["1", "2", "9"].includes(normalized)) return normalized;
  if (normalized.includes("student")) return "9";
  if (normalized.includes("employ") || normalized.includes("self-employed") || normalized.includes("self employed")) {
    if (normalized.includes("unemploy") || normalized.includes("underemploy")) return "1";
    return "2";
  }
  return "";
};

const mapEmploymentScheduleToIlmpCode = value => {
  const normalized = normalizeCode(value).toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("part-time") || normalized.includes("part time")) return "2";
  if (normalized.includes("full-time") || normalized.includes("full time")) return "1";
  return "";
};

const mapBarrierValuesToIlmpCodes = values => {
  const raw = Array.isArray(values)
    ? values
    : typeof values === "string"
    ? values.split(",")
    : [];
  const codes = raw
    .map(value => {
      const normalized = normalizeCode(value).toLowerCase();
      if (!normalized) return "";
      if (BARRIER_OPTIONS.some(option => option.value === normalized)) return normalized;
      const byLabel = BARRIER_OPTIONS.find(option => option.label.toLowerCase() === normalized);
      return byLabel?.value || BARRIER_VALUE_TO_ILMP_CODE[normalized] || "";
    })
    .filter(Boolean);
  return Array.from(new Set(codes));
};

const readApplicationAnswer = (caseData, key) => {
  const caseContext = caseData?.caseContext || {};
  const answers =
    caseContext.applicationAnswers ||
    caseContext.applicationPayload?.answers ||
    {};
  const raw = answers?.[key];
  if (Array.isArray(raw)) return raw;
  return normalizeText(raw);
};

const ExistingActionPlanModal = ({ visible, onDismiss, onCreated }) => {
  const {
    createActionPlan,
    fetchActionPlanContext,
    caseData,
    loadFundingStreams,
    fundingStreams,
    nocVersions,
    loadNocVersions,
    searchNocCodes,
  } = useCaseWorkspace();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [budgetPotOptions, setBudgetPotOptions] = useState([]);
  const [budgetPotLoading, setBudgetPotLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [prevNocOptions, setPrevNocOptions] = useState([]);
  const [prevNocLoading, setPrevNocLoading] = useState(false);
  const [resultNocOptions, setResultNocOptions] = useState([]);
  const [resultNocLoading, setResultNocLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setForm(defaultForm);
      setLoading(false);
      setError(null);
      setFieldErrors({});
      setContext(null);
      setContextLoading(false);
      setPrevNocOptions([]);
      setPrevNocLoading(false);
      setResultNocOptions([]);
      setResultNocLoading(false);
      return;
    }
    loadFundingStreams().catch(() => {});
    loadNocVersions().catch(() => {});
  }, [visible, loadFundingStreams, loadNocVersions]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setContextLoading(true);
    fetchActionPlanContext()
      .then(result => {
        if (cancelled) return;
        const payload = result?.context || result || {};
        setContext(payload);
        setContextLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setContext({});
        setContextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, fetchActionPlanContext]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const loadBudgetPots = async () => {
      setBudgetPotLoading(true);
      try {
        const response = await apiFetch("/api/reference/budget-pots-lite?chargeableOnly=0");
        if (!response.ok) {
          throw new Error("budget_pot_lookup_failed");
        }
        const payload = await response.json();
        if (cancelled) return;
        const normalizeStream = value => (value ? String(value).trim().toUpperCase() : "");
        const currentStream = normalizeStream(form.fundingStream);
        const options = (Array.isArray(payload) ? payload : [])
          .filter(item => {
            const potType =
              item?.pot_type ??
              item?.potType ??
              item?.type ??
              item?.nodeType ??
              item?.metadata?.pot_type ??
              item?.metadata?.nodeType ??
              "";
            const normalized = String(potType).trim().toLowerCase().replace(/[_\s]+/g, " ");
            return normalized === "funding stream";
          })
          .filter(item => {
            if (!currentStream) return true;
            const fundingSource = normalizeStream(item?.fundingSource || item?.funding_source || "");
            const code = normalizeStream(item?.code || "");
            if (fundingSource) return fundingSource === currentStream;
            if (code.endsWith("-EI") || code.endsWith(" EI")) return currentStream === "EI";
            if (code.endsWith("-CRF") || code.endsWith(" CRF")) return currentStream === "CRF";
            return true;
          })
          .map(item => {
            const value = item?.id ?? item?.value ?? item?.code ?? null;
            if (!value) return null;
            const code = item?.code || "";
            const name = item?.name || item?.description || "";
            const inactiveBadge = item?.isActive === false ? " (inactive)" : "";
            return {
              value: String(value),
              label: `${[code, name].filter(Boolean).join(" - ") || value}${inactiveBadge}`,
            };
          })
          .filter(Boolean);
        setBudgetPotOptions(options);
      } catch (_) {
        if (!cancelled) setBudgetPotOptions([]);
      } finally {
        if (!cancelled) setBudgetPotLoading(false);
      }
    };
    loadBudgetPots();
    return () => {
      cancelled = true;
    };
  }, [visible, form.fundingStream]);

  const fundingStreamOptions = useMemo(
    () =>
      (Array.isArray(fundingStreams) ? fundingStreams : [])
        .map(item => {
          if (!item?.code) return null;
          return {
            value: String(item.code).trim(),
            label: item.label ? String(item.label).trim() : String(item.code).trim(),
          };
        })
        .filter(Boolean),
    [fundingStreams]
  );
  const nocVersionOptions = useMemo(
    () =>
      (Array.isArray(nocVersions) ? nocVersions : []).length
        ? nocVersions
            .map(item => {
              if (!item?.code || !item?.label) return null;
              return {
                value: String(item.code).trim(),
                label: `${String(item.code).trim()} - ${String(item.label).trim()}`,
              };
            })
            .filter(Boolean)
        : NOC_VERSION_OPTIONS,
    [nocVersions]
  );

  const selectedStatus = STATUS_OPTIONS.find(option => option.value === form.status) || STATUS_OPTIONS[0];
  const selectedFundingStream =
    fundingStreamOptions.find(option => option.value === form.fundingStream) || null;
  const selectedBudgetPot =
    budgetPotOptions.find(option => option.value === form.budgetPot) || null;
  const selectedEducationLevel =
    EDUCATION_OPTIONS.find(option => option.value === form.educationLevel) || null;
  const selectedEducationProvince =
    PROVINCE_OPTIONS.find(option => option.value === form.educationProvince) || null;
  const selectedSocialAssistance =
    YES_NO_OPTIONS.find(option => option.value === form.socialAssistanceRecipient) || null;
  const selectedEiClaimant =
    EI_CLAIMANT_OPTIONS.find(option => option.value === form.eiClaimant) || null;
  const selectedPrevEmployment =
    PREV_EMPLOYMENT_OPTIONS.find(option => option.value === form.prevEmployment) || null;
  const selectedPrevNocVersion =
    nocVersionOptions.find(option => option.value === form.prevEmploymentNocVersion) || null;
  const selectedPrevSchedule =
    SCHEDULE_OPTIONS.find(option => option.value === form.prevEmploymentScheduleType) || null;
  const selectedChildcareNeed =
    YES_NO_OPTIONS.find(option => option.value === form.childcareNeed) || null;
  const selectedChildcareFunding =
    CHILDCARE_FUNDING_OPTIONS.find(option => option.value === form.childcareFunding) || null;
  const selectedBarriers = BARRIER_OPTIONS.filter(option => (form.barriers || []).includes(option.value));
  const selectedResultCode =
    RESULT_OPTIONS.find(option => option.value === form.resultCode) || null;
  const selectedResultEducation =
    RESULT_EDUCATION_OPTIONS.find(option => option.value === form.resultEducationLevel) || null;
  const selectedFutureEducation =
    FUTURE_EDUCATION_OPTIONS.find(option => option.value === form.futureEducationLevel) || null;
  const selectedResultNocVersion =
    nocVersionOptions.find(option => option.value === form.resultNocVersion) || null;
  const isClosed = form.status === "closed";

  const effectiveContext = useMemo(() => {
    const caseContext = caseData?.caseContext || {};
    const sourceBarriers =
      Array.isArray(caseContext.employmentBarriers)
        ? caseContext.employmentBarriers
        : Array.isArray(context?.employmentBarriers)
        ? context.employmentBarriers
        : Array.isArray(context?.barriersFromApplication)
        ? context.barriersFromApplication
        : readApplicationAnswer(caseData, "barriers");
    const labourForceStatus = firstNonBlank(
      caseContext.employmentStatus,
      context?.labourForceStatus,
      readApplicationAnswer(caseData, "labour-force-status")
    );
    return {
      educationLevel: mapEducationToIlmpCode(
        firstNonBlank(
          caseContext.educationLevel,
          context?.educationLevel,
          readApplicationAnswer(caseData, "highest-education")
        )
      ),
      educationProvince: mapProvinceToIlmpCode(
        firstNonBlank(
          caseContext.educationProvince,
          context?.educationProvince,
          readApplicationAnswer(caseData, "education-location")
        )
      ),
      socialAssistanceRecipient: mapYesNoToIlmpCode(
        firstNonBlank(
          caseContext.socialAssistance,
          context?.socialAssistance,
          readApplicationAnswer(caseData, "social-assistance")
        )
      ),
      prevEmployment: mapEmploymentStatusToIlmpCode(labourForceStatus),
      prevEmploymentScheduleType: mapEmploymentScheduleToIlmpCode(labourForceStatus),
      childcareNeed: mapYesNoToIlmpCode(
        firstNonBlank(
          caseContext.childcareNeed,
          context?.childcareNeed,
          readApplicationAnswer(caseData, "action-plan-childcare-need"),
          readApplicationAnswer(caseData, "childcare-need")
        )
      ),
      barriers: mapBarrierValuesToIlmpCodes(sourceBarriers),
    };
  }, [caseData, context]);

  useEffect(() => {
    if (!visible) return;
    setForm(current => {
      const next = { ...current };
      if (!next.educationLevel && effectiveContext.educationLevel) {
        next.educationLevel = effectiveContext.educationLevel;
      }
      if (!next.educationProvince && effectiveContext.educationProvince) {
        next.educationProvince = effectiveContext.educationProvince;
      }
      if (!next.socialAssistanceRecipient && effectiveContext.socialAssistanceRecipient) {
        next.socialAssistanceRecipient = effectiveContext.socialAssistanceRecipient;
      }
      if (!next.prevEmployment && effectiveContext.prevEmployment) {
        next.prevEmployment = effectiveContext.prevEmployment;
      }
      if (!next.prevEmploymentScheduleType && effectiveContext.prevEmploymentScheduleType) {
        next.prevEmploymentScheduleType = effectiveContext.prevEmploymentScheduleType;
      }
      if (!next.childcareNeed && effectiveContext.childcareNeed) {
        next.childcareNeed = effectiveContext.childcareNeed;
      }
      if ((!next.barriers || !next.barriers.length) && effectiveContext.barriers.length) {
        next.barriers = effectiveContext.barriers;
      }
      return next;
    });
  }, [visible, effectiveContext]);

  useEffect(() => {
    if (!visible || form.fundingStream) return;
    if (form.eiClaimant === "1" || form.eiClaimant === "2") {
      setForm(current => ({ ...current, fundingStream: "EI" }));
    } else if (form.eiClaimant === "3") {
      setForm(current => ({ ...current, fundingStream: "CRF" }));
    }
  }, [visible, form.eiClaimant, form.fundingStream]);

  const handleChange = (field, value) => {
    setForm(current => {
      const next = { ...current, [field]: value };
      if (field === "prevEmployment" && value !== "2") {
        next.prevEmploymentNoc = "";
        next.prevEmploymentNocVersion = "";
        next.prevEmploymentScheduleType = "";
      }
      if (field === "prevEmploymentNocVersion") {
        next.prevEmploymentNoc = "";
      }
      if (field === "childcareNeed" && value !== "1") {
        next.childcareFunding = "";
      }
      if (field === "resultCode") {
        if (value !== "4") {
          next.futureEducationLevel = "";
        }
        if (value !== "2") {
          next.resultNocVersion = "";
          next.resultNoc = "";
        }
      }
      if (field === "resultNocVersion") {
        next.resultNoc = "";
      }
      return next;
    });
    setFieldErrors(current => {
      const next = { ...current };
      delete next[field];
      if (field === "prevEmployment") {
        delete next.prevEmploymentNoc;
        delete next.prevEmploymentNocVersion;
        delete next.prevEmploymentScheduleType;
      }
      if (field === "prevEmploymentNocVersion") {
        delete next.prevEmploymentNoc;
      }
      if (field === "childcareNeed") {
        delete next.childcareFunding;
      }
      if (field === "resultCode") {
        delete next.futureEducationLevel;
        delete next.resultNocVersion;
        delete next.resultNoc;
      }
      if (field === "resultNocVersion") {
        delete next.resultNoc;
      }
      return next;
    });
    setError(null);
  };

  useEffect(() => {
    if (!visible || !isClosed) return;
    const fallbackVersion = nocVersionOptions[0]?.value || DEFAULT_NOC_VERSION;
    if (form.resultCode === "2" && !form.resultNocVersion && fallbackVersion) {
      setForm(current => ({ ...current, resultNocVersion: fallbackVersion }));
    }
  }, [visible, isClosed, form.resultCode, form.resultNocVersion, nocVersionOptions]);

  const handlePrevNocSearch = useCallback(
    async query => {
      if (!form.prevEmploymentNocVersion) {
        setPrevNocOptions([]);
        return;
      }
      setPrevNocLoading(true);
      try {
        const results = await searchNocCodes({ query, version: form.prevEmploymentNocVersion });
        setPrevNocOptions(
          (results || []).map(item => ({
            value: item.code,
            label: `${item.code} - ${item.title}`,
            description: item.title,
          }))
        );
      } finally {
        setPrevNocLoading(false);
      }
    },
    [form.prevEmploymentNocVersion, searchNocCodes]
  );

  const handleResultNocSearch = useCallback(
    async query => {
      if (!form.resultNocVersion) {
        setResultNocOptions([]);
        return;
      }
      setResultNocLoading(true);
      try {
        const results = await searchNocCodes({ query, version: form.resultNocVersion });
        setResultNocOptions(
          (results || []).map(item => ({
            value: item.code,
            label: `${item.code} - ${item.title}`,
            description: item.title,
          }))
        );
      } finally {
        setResultNocLoading(false);
      }
    },
    [form.resultNocVersion, searchNocCodes]
  );

  const handleSubmit = async () => {
    const nextErrors = {};
    if (!form.name.trim()) {
      nextErrors.name = "Plan name is required.";
    }
    if (!form.startDate) {
      nextErrors.startDate = "Start date is required.";
    }
    if (form.startDate && form.reviewDate && form.reviewDate < form.startDate) {
      nextErrors.reviewDate = "Review date cannot be before the start date.";
    }
    if (!form.educationLevel) {
      nextErrors.educationLevel = "Education level at action plan start is required.";
    }
    if (!form.educationProvince) {
      nextErrors.educationProvince = "Education province is required.";
    }
    if (!form.socialAssistanceRecipient) {
      nextErrors.socialAssistanceRecipient = "Select Yes/No for social assistance.";
    }
    if (!form.eiClaimant) {
      nextErrors.eiClaimant = "Select EI claimant status.";
    }
    if (!form.fundingStream) {
      nextErrors.fundingStream = "Funding stream is required.";
    }
    if (!form.prevEmployment) {
      nextErrors.prevEmployment = "Employment status at plan start is required.";
    }
    if (form.prevEmployment === "2") {
      if (!form.prevEmploymentNocVersion) {
        nextErrors.prevEmploymentNocVersion = "Previous employment NOC version is required.";
      }
      if (!form.prevEmploymentNoc) {
        nextErrors.prevEmploymentNoc = "Previous employment NOC code is required.";
      } else {
        const digits = String(form.prevEmploymentNoc).replace(/\D/g, "");
        const requiredLength = form.prevEmploymentNocVersion === "2021" ? 5 : 4;
        if (digits.length !== requiredLength) {
          nextErrors.prevEmploymentNoc = `Previous employment NOC code must be ${requiredLength} digits for version ${form.prevEmploymentNocVersion || "selected"}.`;
        }
      }
      if (!form.prevEmploymentScheduleType) {
        nextErrors.prevEmploymentScheduleType = "Previous employment schedule type is required.";
      }
    }
    if (form.childcareNeed === "1" && !form.childcareFunding) {
      nextErrors.childcareFunding = "Childcare funding is required when childcare need is Yes.";
    }
    if (!Array.isArray(form.barriers) || !form.barriers.length) {
      nextErrors.barriers = "Select at least one barrier to employment.";
    }
    if (isClosed) {
      if (!form.resultCode) {
        nextErrors.resultCode = "Result code is required for a closed plan.";
      }
      if (!form.resultDate) {
        nextErrors.resultDate = "Result date is required for a closed plan.";
      } else if (form.startDate && form.resultDate < form.startDate) {
        nextErrors.resultDate = "Result date cannot be before the action plan start date.";
      } else {
        const today = new Date().toISOString().slice(0, 10);
        if (form.resultDate > today) {
          nextErrors.resultDate = "Result date cannot be in the future.";
        }
      }
      if (!form.resultEducationLevel) {
        nextErrors.resultEducationLevel = "Action Plan Result Education Level is required.";
      }
      if (form.resultCode === "4" && !form.futureEducationLevel) {
        nextErrors.futureEducationLevel = "Future education level is required for Returned to school.";
      }
      if (form.resultCode === "2") {
        if (!form.resultNocVersion) {
          nextErrors.resultNocVersion = "Result NOC version is required for Employed.";
        }
        if (!form.resultNoc) {
          nextErrors.resultNoc = "Result NOC code is required for Employed.";
        } else {
          const digits = String(form.resultNoc).replace(/\D/g, "");
          const requiredLength = form.resultNocVersion === "2021" ? 5 : 4;
          if (digits.length !== requiredLength) {
            nextErrors.resultNoc = `Result NOC code must be ${requiredLength} digits for version ${form.resultNocVersion || "selected"}.`;
          }
        }
      }
    }
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setError("Please resolve the highlighted fields.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const created = await createActionPlan({
        name: form.name.trim(),
        startDate: form.startDate || null,
        reviewDate: form.reviewDate || null,
        summary: form.summary.trim() || null,
        fundingStream: form.fundingStream || null,
        budgetPot: form.budgetPot || null,
        educationLevel: form.educationLevel || null,
        educationProvince: form.educationProvince || null,
        socialAssistanceRecipient: form.socialAssistanceRecipient || null,
        eiClaimant: form.eiClaimant || null,
        prevEmployment: form.prevEmployment || null,
        prevEmploymentNoc: form.prevEmployment === "2" ? form.prevEmploymentNoc || null : null,
        prevEmploymentNocVersion: form.prevEmployment === "2" ? form.prevEmploymentNocVersion || null : null,
        prevEmploymentScheduleType: form.prevEmployment === "2" ? form.prevEmploymentScheduleType || null : null,
        childcareNeed: form.childcareNeed || null,
        childcareFunding: form.childcareNeed === "1" ? form.childcareFunding || null : null,
        barriers: Array.isArray(form.barriers) ? form.barriers : [],
        status: form.status,
        initialStatus: form.status,
        backloadMode: true,
        entryMode: "backload",
        resultCode: isClosed ? form.resultCode || null : null,
        resultDate: isClosed ? form.resultDate || null : null,
        resultEducationLevel: isClosed ? form.resultEducationLevel || null : null,
        futureEducationLevel: isClosed && form.resultCode === "4" ? form.futureEducationLevel || null : null,
        resultNocVersion: isClosed && form.resultCode === "2" ? form.resultNocVersion || null : null,
        resultNoc: isClosed && form.resultCode === "2" ? form.resultNoc || null : null,
        outcomeSummary: isClosed ? form.outcomeSummary.trim() || null : null,
        closureNotes: isClosed ? form.closureNotes.trim() || null : null,
      });
      onCreated?.(created);
    } catch (submitError) {
      setError(submitError?.message || "Failed to record the existing action plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={loading ? undefined : onDismiss}
      header="Add existing action plan"
      closeAriaLabel="Close add existing action plan modal"
      size="large"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button onClick={onDismiss} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            Save existing action plan
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="l">
        <Alert type="info">
          Record a plan that already existed before PATH go-live. Saving here does not start intake workflow,
          approval routing, or client notifications.
        </Alert>
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Box color="text-body-secondary" fontSize="body-s">
          Capture the current state truthfully. Required reporting fields must be known before saving.
        </Box>
        <SpaceBetween size="m">
          <FormField label="Plan name" errorText={fieldErrors.name}>
            <Input
              value={form.name}
              onChange={({ detail }) => handleChange("name", detail.value)}
              autoFocus
              spellcheck={true}
            />
          </FormField>
          <Box>
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Current status">
                <Select
                  selectedOption={selectedStatus}
                  onChange={({ detail }) => handleChange("status", detail.selectedOption?.value || "active")}
                  options={STATUS_OPTIONS}
                />
              </FormField>
              <FormField label="Funding stream">
                <Select
                  selectedOption={selectedFundingStream}
                  onChange={({ detail }) => handleChange("fundingStream", detail.selectedOption?.value || "")}
                  options={fundingStreamOptions}
                  placeholder="Optional"
                />
              </FormField>
              <FormField label="Start date" errorText={fieldErrors.startDate}>
                <DatePicker
                  value={form.startDate}
                  onChange={({ detail }) => handleChange("startDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <FormField label="Review date" errorText={fieldErrors.reviewDate}>
                <DatePicker
                  value={form.reviewDate}
                  onChange={({ detail }) => handleChange("reviewDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <FormField label="Budget pot">
                <Select
                  selectedOption={selectedBudgetPot}
                  onChange={({ detail }) => handleChange("budgetPot", detail.selectedOption?.value || "")}
                  options={budgetPotOptions}
                  placeholder={budgetPotLoading ? "Loading budget pots" : "Optional"}
                  statusType={budgetPotLoading ? "loading" : "finished"}
                />
              </FormField>
              <FormField
                label="Education Level"
                description="Highest level of education attained at the start of this action plan."
                errorText={fieldErrors.educationLevel}
              >
                <Select
                  selectedOption={selectedEducationLevel}
                  onChange={({ detail }) => handleChange("educationLevel", detail.selectedOption?.value || "")}
                  options={EDUCATION_OPTIONS}
                  placeholder="Select education level"
                  invalid={Boolean(fieldErrors.educationLevel)}
                />
              </FormField>
              <FormField
                label="Education Province"
                description="Province or area where the highest level of education was attained."
                errorText={fieldErrors.educationProvince}
              >
                <Select
                  selectedOption={selectedEducationProvince}
                  onChange={({ detail }) => handleChange("educationProvince", detail.selectedOption?.value || "")}
                  options={PROVINCE_OPTIONS}
                  placeholder="Select province/territory"
                  invalid={Boolean(fieldErrors.educationProvince)}
                />
              </FormField>
            </ColumnLayout>
          </Box>
          <SpaceBetween size="m">
            <Box fontWeight="bold">ILMP action plan reporting fields</Box>
            {contextLoading && (
              <Box color="text-body-secondary" fontSize="body-s">
                Loading participant details for suggested values...
              </Box>
            )}
            <ColumnLayout columns={2} variant="text-grid">
              <FormField
                label="Social Assistance Recipient"
                description="At the time this action plan was created."
                errorText={fieldErrors.socialAssistanceRecipient}
              >
                <Select
                  selectedOption={selectedSocialAssistance}
                  onChange={({ detail }) =>
                    handleChange("socialAssistanceRecipient", detail.selectedOption?.value || "")
                  }
                  options={YES_NO_OPTIONS}
                  placeholder="Select Yes/No"
                  invalid={Boolean(fieldErrors.socialAssistanceRecipient)}
                />
              </FormField>
              <FormField
                label="EI claimant status"
                description="ESDC claimant, reach-back, or non-insured status."
                errorText={fieldErrors.eiClaimant}
              >
                <Select
                  selectedOption={selectedEiClaimant}
                  onChange={({ detail }) => handleChange("eiClaimant", detail.selectedOption?.value || "")}
                  options={EI_CLAIMANT_OPTIONS}
                  placeholder="Select status"
                  invalid={Boolean(fieldErrors.eiClaimant)}
                />
              </FormField>
              <FormField
                label="Employment status at plan start"
                description="Used for previous-employment reporting."
                errorText={fieldErrors.prevEmployment}
              >
                <Select
                  selectedOption={selectedPrevEmployment}
                  onChange={({ detail }) => handleChange("prevEmployment", detail.selectedOption?.value || "")}
                  options={PREV_EMPLOYMENT_OPTIONS}
                  placeholder="Select status"
                  invalid={Boolean(fieldErrors.prevEmployment)}
                />
              </FormField>
              <FormField label="Childcare need" errorText={fieldErrors.childcareNeed}>
                <Select
                  selectedOption={selectedChildcareNeed}
                  onChange={({ detail }) => handleChange("childcareNeed", detail.selectedOption?.value || "")}
                  options={YES_NO_OPTIONS}
                  placeholder="Optional"
                  invalid={Boolean(fieldErrors.childcareNeed)}
                />
              </FormField>
              {form.prevEmployment === "2" && (
                <>
                  <FormField
                    label="Previous employment NOC version"
                    errorText={fieldErrors.prevEmploymentNocVersion}
                  >
                    <Select
                      selectedOption={selectedPrevNocVersion}
                      onChange={({ detail }) =>
                        handleChange("prevEmploymentNocVersion", detail.selectedOption?.value || "")
                      }
                      options={nocVersionOptions}
                      placeholder="Select NOC version"
                      invalid={Boolean(fieldErrors.prevEmploymentNocVersion)}
                    />
                  </FormField>
                  <FormField label="Previous employment schedule" errorText={fieldErrors.prevEmploymentScheduleType}>
                    <Select
                      selectedOption={selectedPrevSchedule}
                      onChange={({ detail }) =>
                        handleChange("prevEmploymentScheduleType", detail.selectedOption?.value || "")
                      }
                      options={SCHEDULE_OPTIONS}
                      placeholder="Select schedule"
                      invalid={Boolean(fieldErrors.prevEmploymentScheduleType)}
                    />
                  </FormField>
                  <FormField label="Previous employment NOC code" errorText={fieldErrors.prevEmploymentNoc}>
                    <Autosuggest
                      value={form.prevEmploymentNoc}
                      onChange={({ detail }) => handleChange("prevEmploymentNoc", detail.value)}
                      onLoadItems={({ detail }) => handlePrevNocSearch(detail.filteringText)}
                      options={prevNocOptions}
                      placeholder={form.prevEmploymentNocVersion ? "Search NOC code" : "Select NOC version first"}
                      empty="No matches"
                      filteringType="manual"
                      statusType={prevNocLoading ? "loading" : "finished"}
                      loadingText="Searching NOC codes"
                      expandToViewport
                      disabled={!form.prevEmploymentNocVersion}
                      spellcheck={false}
                    />
                  </FormField>
                </>
              )}
              {form.childcareNeed === "1" && (
                <FormField label="Childcare funding" errorText={fieldErrors.childcareFunding}>
                  <Select
                    selectedOption={selectedChildcareFunding}
                    onChange={({ detail }) => handleChange("childcareFunding", detail.selectedOption?.value || "")}
                    options={CHILDCARE_FUNDING_OPTIONS}
                    placeholder="Select funding"
                    invalid={Boolean(fieldErrors.childcareFunding)}
                  />
                </FormField>
              )}
            </ColumnLayout>
            <FormField
              label="Barriers to employment"
              description="Choose all barriers that applied when this action plan was created."
              errorText={fieldErrors.barriers}
            >
              <Multiselect
                selectedOptions={selectedBarriers}
                onChange={({ detail }) =>
                  handleChange("barriers", detail.selectedOptions.map(option => option.value))
                }
                options={BARRIER_OPTIONS}
                placeholder="Select barriers"
                invalid={Boolean(fieldErrors.barriers)}
              />
            </FormField>
          </SpaceBetween>
          <FormField label="Plan summary">
            <Textarea
              value={form.summary}
              onChange={({ detail }) => handleChange("summary", detail.value)}
              rows={4}
              placeholder="Optional notes about the existing plan"
              spellcheck={true}
            />
          </FormField>
          {isClosed && (
            <SpaceBetween size="m">
              <Box fontWeight="bold">Closed plan details</Box>
              <ColumnLayout columns={2} variant="text-grid">
                <FormField label="Result code" errorText={fieldErrors.resultCode}>
                  <Select
                    selectedOption={selectedResultCode}
                    onChange={({ detail }) => handleChange("resultCode", detail.selectedOption?.value || "")}
                    options={RESULT_OPTIONS}
                    placeholder="Select result"
                  />
                </FormField>
                <FormField label="Close / result date" errorText={fieldErrors.resultDate}>
                  <DatePicker
                    value={form.resultDate}
                    onChange={({ detail }) => handleChange("resultDate", detail.value)}
                    placeholder="YYYY-MM-DD"
                  />
                </FormField>
                <FormField
                  label="Action Plan Result Education Level"
                  description="Required for closed plans."
                  errorText={fieldErrors.resultEducationLevel}
                >
                  <Select
                    selectedOption={selectedResultEducation}
                    onChange={({ detail }) => handleChange("resultEducationLevel", detail.selectedOption?.value || "")}
                    options={RESULT_EDUCATION_OPTIONS}
                    placeholder="Select education level"
                  />
                </FormField>
                {form.resultCode === "4" && (
                  <FormField
                    label="Action Plan Future Education Level"
                    description="Required when result is Returned to school."
                    errorText={fieldErrors.futureEducationLevel}
                  >
                    <Select
                      selectedOption={selectedFutureEducation}
                      onChange={({ detail }) => handleChange("futureEducationLevel", detail.selectedOption?.value || "")}
                      options={FUTURE_EDUCATION_OPTIONS}
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
                        onChange={({ detail }) => handleChange("resultNocVersion", detail.selectedOption?.value || "")}
                        options={nocVersionOptions}
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
                        onChange={({ detail }) => handleChange("resultNoc", detail.value)}
                        onLoadItems={({ detail }) => handleResultNocSearch(detail.filteringText)}
                        options={resultNocOptions}
                        placeholder={form.resultNocVersion ? "Search NOC code" : "Select NOC version first"}
                        empty="No matches"
                        filteringType="manual"
                        statusType={resultNocLoading ? "loading" : "finished"}
                        loadingText="Searching NOC codes"
                        expandToViewport
                        disabled={!form.resultNocVersion}
                        spellcheck={false}
                      />
                    </FormField>
                  </>
                )}
              </ColumnLayout>
              <FormField label="Outcome summary">
                <Textarea
                  value={form.outcomeSummary}
                  onChange={({ detail }) => handleChange("outcomeSummary", detail.value)}
                  rows={3}
                  placeholder="Optional summary of the completed plan"
                  spellcheck={true}
                />
              </FormField>
              <FormField label="Closure notes">
                <Textarea
                  value={form.closureNotes}
                  onChange={({ detail }) => handleChange("closureNotes", detail.value)}
                  rows={3}
                  placeholder="Optional closure notes"
                  spellcheck={true}
                />
              </FormField>
            </SpaceBetween>
          )}
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default ExistingActionPlanModal;
