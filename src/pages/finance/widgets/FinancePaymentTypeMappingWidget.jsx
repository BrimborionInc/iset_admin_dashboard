import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  AttributeEditor,
  Box,
  Button,
  ButtonDropdown,
  Checkbox,
  ColumnLayout,
  FormField,
  Header,
  Input,
  Link,
  Multiselect,
  Select,
  SpaceBetween,
  Spinner,
  Tabs,
  Textarea,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../auth/apiClient";
import { boardItemI18nStrings } from "./common";

const RECURRENCE_MODE_REQUIRED = "required";
const RECURRENCE_MODE_OPTIONAL = "optional";
const RECURRENCE_MODE_NOT_ALLOWED = "not_allowed";
const SUBMISSION_TIMING_INTERVENTION_START = "intervention_start";
const SUBMISSION_TIMING_INTERVENTION_END = "intervention_end";
const SUBMISSION_TIMING_RECURRENCE_SCHEDULE = "recurrence_schedule";
const SUBMISSION_TIMING_MANUAL_TRIGGER = "manual_trigger";
const DEFAULT_RECURRENCE_MODE_BY_TYPE = {
  LivingAllowance: RECURRENCE_MODE_REQUIRED,
  WageSubsidyEmployer: RECURRENCE_MODE_OPTIONAL,
  OtherEligibleCost: RECURRENCE_MODE_OPTIONAL,
};
const DEFAULT_SUBMISSION_TIMING_BY_TYPE = {
  LivingAllowance: SUBMISSION_TIMING_RECURRENCE_SCHEDULE,
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
  OtherEligibleCost: SUBMISSION_TIMING_MANUAL_TRIGGER,
};
const RECURRENCE_POLICY_OPTIONS = [
  { value: RECURRENCE_MODE_NOT_ALLOWED, label: "Not allowed" },
  { value: RECURRENCE_MODE_OPTIONAL, label: "Allowed (optional)" },
  { value: RECURRENCE_MODE_REQUIRED, label: "Required" },
];
const SUBMISSION_TIMING_OPTIONS = [
  { value: SUBMISSION_TIMING_INTERVENTION_START, label: "Intervention start date" },
  { value: SUBMISSION_TIMING_INTERVENTION_END, label: "Intervention end date" },
  { value: SUBMISSION_TIMING_RECURRENCE_SCHEDULE, label: "Recurrence schedule" },
  { value: SUBMISSION_TIMING_MANUAL_TRIGGER, label: "Manual trigger" },
];
const EMPTY_PAYMENT_TYPE = {
  code: "",
  label: "",
  notes: "",
  requiredEvidence: [],
  recurrenceMode: RECURRENCE_MODE_NOT_ALLOWED,
  submissionTiming: SUBMISSION_TIMING_MANUAL_TRIGGER,
};
const EMPTY_PAYMENT_EVIDENCE_RULE_SET = {
  required: [],
  optional: [],
  postPayRequired: [],
};

const normalizeString = value => (typeof value === "string" ? value.trim() : "");

const normalizeBoolean = value => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return false;
};

const normalizePaymentTypeKey = value => normalizeString(value).toLowerCase();

const normalizeRecurrenceMode = value => {
  if (typeof value !== "string") return RECURRENCE_MODE_NOT_ALLOWED;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === RECURRENCE_MODE_REQUIRED) return RECURRENCE_MODE_REQUIRED;
  if (normalized === RECURRENCE_MODE_OPTIONAL) return RECURRENCE_MODE_OPTIONAL;
  if (normalized === RECURRENCE_MODE_NOT_ALLOWED || normalized === "disabled") {
    return RECURRENCE_MODE_NOT_ALLOWED;
  }
  return RECURRENCE_MODE_NOT_ALLOWED;
};

const normalizeSubmissionTiming = value => {
  if (typeof value !== "string") return SUBMISSION_TIMING_MANUAL_TRIGGER;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === SUBMISSION_TIMING_INTERVENTION_START) {
    return SUBMISSION_TIMING_INTERVENTION_START;
  }
  if (normalized === SUBMISSION_TIMING_INTERVENTION_END) {
    return SUBMISSION_TIMING_INTERVENTION_END;
  }
  if (normalized === SUBMISSION_TIMING_RECURRENCE_SCHEDULE) {
    return SUBMISSION_TIMING_RECURRENCE_SCHEDULE;
  }
  if (normalized === SUBMISSION_TIMING_MANUAL_TRIGGER) {
    return SUBMISSION_TIMING_MANUAL_TRIGGER;
  }
  return SUBMISSION_TIMING_MANUAL_TRIGGER;
};

const normalizeInterventionCode = value => {
  if (value === null || typeof value === "undefined") return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits) {
    const numeric = Number(digits);
    if (Number.isFinite(numeric)) {
      return String(Math.trunc(numeric));
    }
  }
  return trimmed;
};

const normalizeNotes = raw => {
  if (Array.isArray(raw)) {
    return raw.map(note => normalizeString(note)).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/\r?\n/)
      .map(note => note.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeEvidenceTypeList = raw => {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map(value => normalizeString(value)).filter(Boolean)));
};

const readExplicitRequiredEvidence = entry => {
  if (!entry || typeof entry !== "object") return undefined;
  const keys = [
    "requiredEvidence",
    "required_evidence",
    "required",
    "requiredEvidenceTypes",
    "required_evidence_types",
  ];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(entry, key)) {
      return normalizeEvidenceTypeList(entry[key]);
    }
  }
  return undefined;
};

const cloneEvidenceRuleSet = rule => {
  const base = rule && typeof rule === "object" ? rule : {};
  const next = {
    required: normalizeEvidenceTypeList(base.required),
    optional: normalizeEvidenceTypeList(base.optional),
    postPayRequired: normalizeEvidenceTypeList(base.postPayRequired || base.post_pay_required),
  };
  const payeeTypesRaw = base.payeeTypes || base.payee_types;
  if (payeeTypesRaw && typeof payeeTypesRaw === "object") {
    const payeeTypes = {};
    Object.entries(payeeTypesRaw).forEach(([key, value]) => {
      const payeeKey = normalizeString(key).toLowerCase();
      if (!payeeKey) return;
      payeeTypes[payeeKey] = cloneEvidenceRuleSet(value);
    });
    if (Object.keys(payeeTypes).length) {
      next.payeeTypes = payeeTypes;
    }
  }
  return next;
};

const normalizePaymentEvidenceRules = raw => {
  const source = raw && typeof raw === "object" ? raw : {};
  const baseline = cloneEvidenceRuleSet(
    source.baseline || source.baselineEvidence || source.baseline_evidence || EMPTY_PAYMENT_EVIDENCE_RULE_SET,
  );
  const paymentTypes = {};
  const paymentTypesRaw = source.paymentTypes || source.payment_types;
  if (paymentTypesRaw && typeof paymentTypesRaw === "object") {
    Object.entries(paymentTypesRaw).forEach(([key, value]) => {
      const code = normalizeString(key);
      if (!code) return;
      paymentTypes[code] = cloneEvidenceRuleSet(value);
    });
  }
  return { baseline, paymentTypes };
};

const normalizeEvidenceOptions = raw => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .map(option => {
      const value = normalizeString(option?.value || option?.code || option?.id || "");
      if (!value || seen.has(value.toLowerCase())) return null;
      seen.add(value.toLowerCase());
      const label = normalizeString(option?.label || option?.name || value) || value;
      return { value, label };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));
};

const applyRequiredEvidenceToPaymentTypes = (paymentTypes, evidenceRules) => {
  const rulesMap = evidenceRules?.paymentTypes && typeof evidenceRules.paymentTypes === "object"
    ? evidenceRules.paymentTypes
    : {};
  return (paymentTypes || []).map(entry => {
    const code = normalizeString(entry?.code);
    const direct = code ? rulesMap[code] : null;
    const fallback = code
      ? Object.entries(rulesMap).find(([key]) => normalizePaymentTypeKey(key) === normalizePaymentTypeKey(code))
      : null;
    const resolved = direct || (fallback ? fallback[1] : null);
    const explicitRequired = readExplicitRequiredEvidence(entry);
    return {
      ...entry,
      requiredEvidence:
        explicitRequired !== undefined
          ? explicitRequired
          : normalizeEvidenceTypeList(resolved?.required || []),
    };
  });
};

const buildPaymentEvidencePayload = (paymentTypes, existingEvidenceRules) => {
  const baseRules = normalizePaymentEvidenceRules(existingEvidenceRules);
  const existingPaymentTypes = baseRules.paymentTypes || {};
  const nextPaymentTypes = {};
  normalizePaymentTypes(paymentTypes).forEach(entry => {
    const code = normalizeString(entry?.code);
    if (!code) return;
    const existingRule = existingPaymentTypes[code] || {};
    nextPaymentTypes[code] = {
      required: normalizeEvidenceTypeList(entry?.requiredEvidence),
      optional: normalizeEvidenceTypeList(existingRule.optional),
      postPayRequired: normalizeEvidenceTypeList(existingRule.postPayRequired),
      ...(existingRule.payeeTypes && Object.keys(existingRule.payeeTypes).length
        ? { payeeTypes: existingRule.payeeTypes }
        : {}),
    };
  });
  return {
    baseline: cloneEvidenceRuleSet(baseRules.baseline),
    paymentTypes: nextPaymentTypes,
  };
};

const normalizePaymentTypes = list => {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  list.forEach(entry => {
    if (!entry || typeof entry !== "object") return;
    const code = normalizeString(
      entry.code || entry.value || entry.paymentType || entry.payment_type || "",
    );
    if (!code) return;
    const label = normalizeString(entry.label || entry.name) || code;
    const notes = normalizeString(entry.notes || entry.note || "");
    const recurrenceMode = normalizeRecurrenceMode(
      entry.recurrenceMode ||
        entry.recurrence_mode ||
        entry?.recurrence?.mode ||
        entry?.recurrence?.rule ||
        DEFAULT_RECURRENCE_MODE_BY_TYPE[code] ||
        RECURRENCE_MODE_NOT_ALLOWED,
    );
    const requiredEvidence = readExplicitRequiredEvidence(entry);
    const normalized = { code, label, notes, recurrenceMode };
    normalized.submissionTiming = normalizeSubmissionTiming(
      entry.submissionTiming ||
        entry.submission_timing ||
        entry.schedulePolicy ||
        entry.schedule_policy ||
        DEFAULT_SUBMISSION_TIMING_BY_TYPE[code] ||
        SUBMISSION_TIMING_MANUAL_TRIGGER,
    );
    if (requiredEvidence !== undefined) {
      normalized.requiredEvidence = requiredEvidence;
    }
    map.set(code.toLowerCase(), normalized);
  });
  return Array.from(map.values());
};

const normalizeInterventions = list => {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  list.forEach(entry => {
    if (!entry || typeof entry !== "object") return;
    const code = normalizeInterventionCode(
      entry.code || entry.interventionCode || entry.intervention_code,
    );
    if (!code) return;
    const name = normalizeString(entry.name || entry.label);
    const typesRaw =
      entry.availablePaymentTypes ||
      entry.available_payment_types ||
      entry.paymentTypes ||
      entry.payment_types ||
      [];
    const types = Array.isArray(typesRaw)
      ? typesRaw
      : typeof typesRaw === "string"
        ? typesRaw
            .split(",")
            .map(item => item.trim())
            .filter(Boolean)
        : [];
    const availablePaymentTypes = Array.from(
      new Set(types.map(value => normalizeString(value)).filter(Boolean)),
    );
    map.set(code, {
      code,
      name: name || "",
      availablePaymentTypes,
      defaultOnAssessment: normalizeBoolean(
        entry.defaultOnAssessment ??
          entry.default_on_assessment ??
          entry.defaultInAssessment ??
          entry.default_in_assessment,
      ),
    });
  });
  return Array.from(map.values());
};

const normalizeInterventionCodes = list => {
  if (!Array.isArray(list)) return [];
  return list
    .map(entry => {
      const code = normalizeInterventionCode(
        entry?.code ?? entry?.value ?? entry?.interventionCode ?? entry?.intervention_code ?? "",
      );
      if (!code) return null;
      const label = normalizeString(entry?.label ?? entry?.name ?? "");
      return { code, label };
    })
    .filter(Boolean);
};

const mergeInterventionsWithCodes = (interventions, codes) => {
  const existing = new Map();
  (interventions || []).forEach(entry => {
    const code = normalizeInterventionCode(entry?.code);
    if (!code) return;
    existing.set(code, {
      code,
      name: normalizeString(entry?.name || entry?.label || ""),
      availablePaymentTypes: Array.isArray(entry?.availablePaymentTypes)
        ? entry.availablePaymentTypes
        : [],
      defaultOnAssessment: normalizeBoolean(
        entry?.defaultOnAssessment ??
          entry?.default_on_assessment ??
          entry?.defaultInAssessment ??
          entry?.default_in_assessment,
      ),
    });
  });
  const merged = [];
  const normalizedCodes = normalizeInterventionCodes(codes);
  const seen = new Set();
  normalizedCodes.forEach(entry => {
    if (!entry?.code || seen.has(entry.code)) return;
    seen.add(entry.code);
    const match = existing.get(entry.code);
    merged.push({
      code: entry.code,
      name: entry.label || match?.name || "",
      availablePaymentTypes: match?.availablePaymentTypes || [],
      defaultOnAssessment: Boolean(match?.defaultOnAssessment),
    });
    existing.delete(entry.code);
  });
  existing.forEach(entry => {
    merged.push({
      code: entry.code,
      name: entry.name || "",
      availablePaymentTypes: entry.availablePaymentTypes || [],
      defaultOnAssessment: Boolean(entry.defaultOnAssessment),
    });
  });
  return merged;
};

const formatInterventionDisplay = entry => {
  const code = normalizeInterventionCode(entry?.code);
  const name = normalizeString(entry?.name);
  if (code && name) return `${code}. ${name}`;
  return code || name || "";
};

const normalizeCostingDefaults = payload => {
  if (!payload || payload.enabled === false) {
    return { enabled: false, strategy: "allowed", interventions: [], paymentTypes: [] };
  }
  const interventionsRaw = Array.isArray(payload.interventions) ? payload.interventions : [];
  const paymentTypesRaw = Array.isArray(payload.paymentTypes) ? payload.paymentTypes : [];
  const interventions = interventionsRaw
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const code = normalizeInterventionCode(
        entry.code || entry.interventionCode || entry.intervention_code,
      );
      if (!code) return null;
      const suggested = Array.isArray(entry.suggested || entry.suggestedItems || entry.suggested_items)
        ? entry.suggested || entry.suggestedItems || entry.suggested_items
        : [];
      const normalizedSuggested = suggested
        .map(item => {
          if (typeof item === "string") return { type: item };
          if (item && typeof item === "object") {
            return {
              type: item.type || item.paymentType || item.payment_type || "",
              notes: item.notes || item.description || "",
              recurrenceEnabled: item.recurrenceEnabled ?? item.recurrence_enabled ?? null,
            };
          }
          return null;
        })
        .filter(item => item && item.type);
      return {
        code,
        suggested: normalizedSuggested,
      };
    })
    .filter(Boolean);
  const paymentTypes = paymentTypesRaw
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const code = normalizeString(
        entry.code || entry.type || entry.paymentType || entry.payment_type || "",
      );
      if (!code) return null;
      const recurrence = entry.recurrence && typeof entry.recurrence === "object" ? entry.recurrence : {};
      return {
        code,
        recurrence: {
          mode: normalizeRecurrenceMode(
            recurrence.mode ||
              recurrence.rule ||
              entry.recurrenceMode ||
              entry.recurrence_mode ||
              DEFAULT_RECURRENCE_MODE_BY_TYPE[code] ||
              RECURRENCE_MODE_NOT_ALLOWED,
          ),
        },
      };
    })
    .filter(Boolean);
  return {
    enabled: payload.enabled !== false,
    strategy: normalizeString(payload.strategy) || normalizeString(payload.defaultStrategy) || "allowed",
    interventions,
    paymentTypes,
  };
};

const buildRecurrenceModeLookup = config => {
  const lookup = new Map();
  (config?.paymentTypes || []).forEach(entry => {
    const code = normalizeString(entry?.code || entry?.type || entry?.paymentType || entry?.payment_type || "");
    if (!code) return;
    const mode = normalizeRecurrenceMode(
      entry?.recurrence?.mode ||
        entry?.recurrence?.rule ||
        entry?.recurrenceMode ||
        entry?.recurrence_mode ||
        DEFAULT_RECURRENCE_MODE_BY_TYPE[code] ||
        RECURRENCE_MODE_NOT_ALLOWED,
    );
    lookup.set(code, mode);
  });
  return lookup;
};

const applyRecurrenceModesToPaymentTypes = (paymentTypes, recurrenceLookup) =>
  normalizePaymentTypes(paymentTypes).map(entry => {
    const mode =
      (recurrenceLookup instanceof Map && recurrenceLookup.get(entry.code)) ||
      DEFAULT_RECURRENCE_MODE_BY_TYPE[entry.code] ||
      RECURRENCE_MODE_NOT_ALLOWED;
    return {
      ...entry,
      recurrenceMode: normalizeRecurrenceMode(mode),
    };
  });

const buildCostingPaymentTypesPayload = paymentTypes =>
  normalizePaymentTypes(paymentTypes).map(entry => ({
    code: entry.code,
    recurrence: { mode: normalizeRecurrenceMode(entry.recurrenceMode) },
  }));

const cloneCostingDefaults = config => {
  if (!config) return config;
  return {
    ...config,
    interventions: (config.interventions || []).map(entry => ({
      code: entry.code,
      suggested: Array.isArray(entry.suggested)
        ? entry.suggested.map(item => ({ ...item }))
        : [],
    })),
    paymentTypes: (config.paymentTypes || []).map(entry => ({
      code: entry.code,
      recurrence: entry.recurrence ? { ...entry.recurrence } : {},
    })),
  };
};

const mergeCostingDefaultsWithInterventions = (costingDefaults, interventions) => {
  const normalized = normalizeCostingDefaults(costingDefaults);
  const existing = new Map();
  (normalized.interventions || []).forEach(entry => {
    const code = normalizeInterventionCode(entry?.code);
    if (!code) return;
    existing.set(code, {
      code,
      suggested: Array.isArray(entry?.suggested) ? entry.suggested : [],
    });
  });
  const merged = [];
  (interventions || []).forEach(entry => {
    const code = normalizeInterventionCode(entry?.code);
    if (!code) return;
    const match = existing.get(code);
    merged.push({
      code,
      suggested: match?.suggested || [],
    });
    existing.delete(code);
  });
  existing.forEach(entry => {
    merged.push({
      code: entry.code,
      suggested: entry.suggested || [],
    });
  });
  return { ...normalized, interventions: merged };
};

const normalizeCostingDefaultsForSignature = config => {
  if (!config || config.enabled === false) {
    return { enabled: false };
  }
  const interventions = (config.interventions || [])
    .map(entry => {
      const code = normalizeInterventionCode(entry?.code);
      if (!code) return null;
      const suggested = Array.isArray(entry?.suggested)
        ? entry.suggested
            .map(item =>
              normalizeString(item?.type || item?.paymentType || item?.payment_type || ""),
            )
            .filter(Boolean)
        : [];
      suggested.sort((a, b) => a.localeCompare(b));
      return { code, suggested };
    })
    .filter(Boolean)
    .sort((a, b) => a.code.localeCompare(b.code));
  const paymentTypes = (config.paymentTypes || [])
    .map(entry => {
      const code = normalizeString(
        entry?.code || entry?.type || entry?.paymentType || entry?.payment_type || "",
      );
      if (!code) return null;
      const mode = normalizeRecurrenceMode(
        entry?.recurrence?.mode ||
          entry?.recurrenceMode ||
          entry?.recurrence_mode ||
          DEFAULT_RECURRENCE_MODE_BY_TYPE[code] ||
          RECURRENCE_MODE_NOT_ALLOWED,
      );
      return { code, mode };
    })
    .filter(Boolean)
    .sort((a, b) => a.code.localeCompare(b.code));
  return {
    enabled: config.enabled !== false,
    strategy: normalizeString(config.strategy) || "allowed",
    interventions,
    paymentTypes,
  };
};

const buildCostingSignature = config => JSON.stringify(normalizeCostingDefaultsForSignature(config));

const normalizeMapping = raw => {
  const source = raw && typeof raw === "object" ? raw : {};
  const paymentTypes = normalizePaymentTypes(source.paymentTypes || source.payment_types);
  const interventions = normalizeInterventions(source.interventions || []);
  const version = normalizeString(source.version);
  const generatedOn = normalizeString(source.generatedOn || source.generated_on);
  const notes = normalizeNotes(source.notes);
  return {
    version,
    generatedOn,
    notes,
    paymentTypes,
    interventions,
  };
};

const normalizePaymentTypesForSignature = list => {
  if (!Array.isArray(list)) return [];
  return list
    .map(entry => {
      const requiredEvidence = normalizeEvidenceTypeList(entry?.requiredEvidence).sort((a, b) =>
        a.localeCompare(b),
      );
      return {
        code: normalizeString(
          entry?.code || entry?.value || entry?.paymentType || entry?.payment_type || "",
        ),
        label: normalizeString(entry?.label || entry?.name || ""),
        notes: normalizeString(entry?.notes || entry?.note || ""),
        recurrenceMode: normalizeRecurrenceMode(entry?.recurrenceMode),
        submissionTiming: normalizeSubmissionTiming(
          entry?.submissionTiming || entry?.submission_timing,
        ),
        requiredEvidence,
      };
    })
    .filter(
      entry =>
        entry.code ||
        entry.label ||
        entry.notes ||
        entry.submissionTiming !== SUBMISSION_TIMING_MANUAL_TRIGGER ||
        (entry.requiredEvidence || []).length > 0 ||
        entry.recurrenceMode !== RECURRENCE_MODE_NOT_ALLOWED,
    );
};

const normalizeInterventionsForSignature = list => {
  if (!Array.isArray(list)) return [];
  return list
    .map(entry => ({
      code: normalizeInterventionCode(
        entry?.code || entry?.interventionCode || entry?.intervention_code || "",
      ),
      name: normalizeString(entry?.name || entry?.label || ""),
      availablePaymentTypes: Array.isArray(entry?.availablePaymentTypes)
        ? entry.availablePaymentTypes.map(value => normalizeString(value)).filter(Boolean)
        : [],
      defaultOnAssessment: normalizeBoolean(
        entry?.defaultOnAssessment ??
          entry?.default_on_assessment ??
          entry?.defaultInAssessment ??
          entry?.default_in_assessment,
      ),
    }))
    .filter(
      entry =>
        entry.code ||
        entry.name ||
        (entry.availablePaymentTypes || []).length > 0 ||
        entry.defaultOnAssessment,
    );
};

const buildSignature = mapping => {
  if (!mapping) return "";
  return JSON.stringify({
    version: normalizeString(mapping.version),
    generatedOn: normalizeString(mapping.generatedOn),
    notes: normalizeNotes(mapping.notes),
    paymentTypes: normalizePaymentTypesForSignature(mapping.paymentTypes),
    interventions: normalizeInterventionsForSignature(mapping.interventions),
  });
};

const ensureNonEmpty = (items, emptyItem) =>
  items && items.length ? items : [emptyItem];

const buildPaymentTypeOptions = (paymentTypes, interventions) => {
  const map = new Map();
  paymentTypes.forEach(entry => {
    if (!entry?.code) return;
    map.set(entry.code, {
      value: entry.code,
      label: entry.label || entry.code,
    });
  });
  interventions.forEach(entry => {
    (entry.availablePaymentTypes || []).forEach(code => {
      if (!code || map.has(code)) return;
      map.set(code, {
        value: code,
        label: code,
        description: "Not listed in payment types.",
      });
    });
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
};

const FinancePaymentTypeMappingWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const [config, setConfig] = useState(null);
  const [draft, setDraft] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTabId, setActiveTabId] = useState("interventions");
  const [interventionCodes, setInterventionCodes] = useState([]);
  const [costingConfig, setCostingConfig] = useState(null);
  const [costingDraft, setCostingDraft] = useState(null);
  const [paymentEvidenceConfig, setPaymentEvidenceConfig] = useState(
    normalizePaymentEvidenceRules(null),
  );
  const [paymentEvidenceUpdatedAt, setPaymentEvidenceUpdatedAt] = useState(null);
  const [evidenceTypeOptions, setEvidenceTypeOptions] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState({
    noPaymentTypes: false,
    unknownPaymentTypes: false,
  });

  const loadInterventionCodes = useCallback(async () => {
    const response = await apiFetch("/api/reference/intervention-codes", { method: "GET" });
    if (!response.ok) {
      const message = `Failed to load intervention codes (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    const data = await response.json().catch(() => ({}));
    const list = normalizeInterventionCodes(data?.codes);
    setInterventionCodes(list);
    return list;
  }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    let codes = [];
    try {
      try {
        codes = await loadInterventionCodes();
      } catch (err) {
        setInterventionCodes([]);
        setError(current => current || err?.message || "Failed to load intervention codes.");
        codes = [];
      }

      let mappingPayload = null;
      try {
        const response = await apiFetch("/api/config/runtime/payment-type-mapping", {
          method: "GET",
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            payload?.message || payload?.error || `Fetch failed (${response.status})`,
          );
        }
        mappingPayload = await response.json().catch(() => ({}));
      } catch (err) {
        setError(current => current || err?.message || "Failed to load payment type mapping.");
        mappingPayload = null;
      }
      const hasEvidencePayload =
        mappingPayload &&
        (Object.prototype.hasOwnProperty.call(mappingPayload, "paymentEvidence") ||
          Object.prototype.hasOwnProperty.call(mappingPayload, "payment_evidence"));
      if (mappingPayload && !hasEvidencePayload) {
        setError(
          current =>
            current ||
            "Payment evidence rules were not returned by the API. Restart the admin backend with the latest code.",
        );
      }

      const evidenceRules = normalizePaymentEvidenceRules(
        mappingPayload?.paymentEvidence || mappingPayload?.payment_evidence || null,
      );
      const evidenceOptions = normalizeEvidenceOptions(
        mappingPayload?.evidenceTypes || mappingPayload?.evidence_types || [],
      );
      setPaymentEvidenceConfig(evidenceRules);
      setPaymentEvidenceUpdatedAt(
        mappingPayload?.paymentEvidenceUpdatedAt ||
          mappingPayload?.payment_evidence_updated_at ||
          null,
      );
      setEvidenceTypeOptions(evidenceOptions);

      const normalized = normalizeMapping(mappingPayload, { useDefaults: true });
      const mergedInterventions = mergeInterventionsWithCodes(normalized.interventions, codes);
      const merged = {
        ...normalized,
        interventions: mergedInterventions,
        paymentTypes: applyRecurrenceModesToPaymentTypes(
          applyRequiredEvidenceToPaymentTypes(
            normalized.paymentTypes,
            evidenceRules,
          ),
          new Map(),
        ),
      };
      setConfig(merged);
      setDraft({
        ...merged,
        paymentTypes: ensureNonEmpty(merged.paymentTypes, EMPTY_PAYMENT_TYPE),
        interventions: merged.interventions,
      });
      setUpdatedAt(mappingPayload?.updatedAt || null);

      let costingPayload = null;
      try {
        const response = await apiFetch("/api/config/runtime/assessment-costing", {
          method: "GET",
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            payload?.message ||
              payload?.error ||
              `Failed to load assessment costing defaults (${response.status})`,
          );
        }
        costingPayload = await response.json().catch(() => ({}));
      } catch (err) {
        setError(
          current => current || err?.message || "Failed to load assessment costing defaults.",
        );
        costingPayload = null;
      }
      const normalizedCosting = costingPayload
        ? normalizeCostingDefaults(costingPayload)
        : null;
      const mergedCosting = normalizedCosting
        ? mergeCostingDefaultsWithInterventions(normalizedCosting, merged.interventions)
        : null;
      setCostingConfig(mergedCosting);
      setCostingDraft(mergedCosting ? cloneCostingDefaults(mergedCosting) : null);
      const recurrenceLookup = buildRecurrenceModeLookup(mergedCosting);
      const withRecurrence = {
        ...merged,
        paymentTypes: applyRecurrenceModesToPaymentTypes(merged.paymentTypes, recurrenceLookup),
      };
      setConfig(withRecurrence);
      setDraft({
        ...withRecurrence,
        paymentTypes: ensureNonEmpty(withRecurrence.paymentTypes, EMPTY_PAYMENT_TYPE),
        interventions: withRecurrence.interventions,
      });
    } finally {
      setLoading(false);
    }
  }, [loadInterventionCodes]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const paymentTypeOptions = useMemo(() => {
    if (!draft) return [];
    return buildPaymentTypeOptions(draft.paymentTypes, draft.interventions);
  }, [draft]);

  const paymentTypeOptionMap = useMemo(() => {
    const map = new Map();
    paymentTypeOptions.forEach(option => {
      if (option?.value) map.set(option.value, option);
    });
    return map;
  }, [paymentTypeOptions]);

  const evidenceTypeOptionMap = useMemo(() => {
    const map = new Map();
    evidenceTypeOptions.forEach(option => {
      if (option?.value) map.set(option.value, option);
    });
    return map;
  }, [evidenceTypeOptions]);

  const costingDefaultsLookup = useMemo(() => {
    const map = new Map();
    (costingDraft?.interventions || []).forEach(entry => {
      const code = normalizeInterventionCode(entry?.code);
      if (!code) return;
      const types = Array.isArray(entry?.suggested)
        ? entry.suggested
            .map(item =>
              normalizeString(item?.type || item?.paymentType || item?.payment_type || ""),
            )
            .filter(Boolean)
        : [];
      map.set(code, types);
    });
    return map;
  }, [costingDraft]);

  const unknownPaymentTypes = useMemo(() => {
    if (!draft) return [];
    const known = new Set(
      (draft.paymentTypes || []).map(item => normalizeString(item.code)).filter(Boolean),
    );
    const missing = new Set();
    (draft.interventions || []).forEach(entry => {
      (entry.availablePaymentTypes || []).forEach(code => {
        const normalized = normalizeString(code);
        if (normalized && !known.has(normalized)) {
          missing.add(normalized);
        }
      });
    });
    return Array.from(missing.values()).sort((a, b) => a.localeCompare(b));
  }, [draft]);

  const paymentTypeCodeCounts = useMemo(() => {
    const counts = new Map();
    (draft?.paymentTypes || []).forEach(item => {
      const key = normalizePaymentTypeKey(item?.code);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [draft]);

  const interventionCodeCounts = useMemo(() => {
    const counts = new Map();
    (draft?.interventions || []).forEach(item => {
      const key = normalizeInterventionCode(item?.code);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [draft]);

  const getPaymentTypeCodeError = useCallback(
    item => {
      const key = normalizePaymentTypeKey(item?.code);
      if (!key) return "Code is required.";
      if ((paymentTypeCodeCounts.get(key) || 0) > 1) return "Code must be unique.";
      return null;
    },
    [paymentTypeCodeCounts],
  );

  const getInterventionCodeError = useCallback(
    item => {
      const key = normalizeInterventionCode(item?.code);
      if (!key) return "Intervention code is required.";
      if ((interventionCodeCounts.get(key) || 0) > 1) return "Intervention code must be unique.";
      return null;
    },
    [interventionCodeCounts],
  );

  const hasValidationIssues = useMemo(() => {
    if (!draft) return false;
    const paymentTypeInvalid = draft.paymentTypes.some(item => !!getPaymentTypeCodeError(item));
    const interventionInvalid = draft.interventions.some(item => !!getInterventionCodeError(item));
    return paymentTypeInvalid || interventionInvalid;
  }, [draft, getPaymentTypeCodeError, getInterventionCodeError]);

  const configSignature = useMemo(() => buildSignature(config), [config]);
  const draftSignature = useMemo(() => buildSignature(draft), [draft]);
  const costingConfigSignature = useMemo(
    () => buildCostingSignature(costingConfig),
    [costingConfig],
  );
  const costingDraftSignature = useMemo(
    () => buildCostingSignature(costingDraft),
    [costingDraft],
  );
  const mappingDirty = configSignature !== draftSignature;
  const costingDirty = Boolean(costingDraft) && costingConfigSignature !== costingDraftSignature;
  const dirty = mappingDirty || costingDirty;

  const updatePaymentType = useCallback((index, updates) => {
    setDraft(current => {
      if (!current) return current;
      const next = [...(current.paymentTypes || [])];
      next[index] = { ...next[index], ...updates };
      return { ...current, paymentTypes: next };
    });
  }, []);

  const updateDefaultLines = useCallback((code, selectedTypes) => {
    const normalizedCode = normalizeInterventionCode(code);
    if (!normalizedCode) return;
    const normalizedTypes = Array.from(
      new Set((selectedTypes || []).map(value => normalizeString(value)).filter(Boolean)),
    );
    setCostingDraft(current => {
      if (!current) return current;
      let found = false;
      const nextInterventions = (current.interventions || []).map(entry => {
        if (normalizeInterventionCode(entry?.code) !== normalizedCode) return entry;
        found = true;
        const existing = Array.isArray(entry?.suggested) ? entry.suggested : [];
        const existingByType = new Map();
        existing.forEach(item => {
          const type = normalizeString(
            item?.type || item?.paymentType || item?.payment_type || "",
          );
          if (type) existingByType.set(type, item);
        });
        const nextSuggested = normalizedTypes.map(type => existingByType.get(type) || { type });
        return { ...entry, suggested: nextSuggested };
      });
      if (!found) {
        nextInterventions.push({
          code: normalizedCode,
          suggested: normalizedTypes.map(type => ({ type })),
        });
      }
      return { ...current, interventions: nextInterventions };
    });
  }, []);

  const pruneDefaultLinesForAllowedTypes = useCallback((code, allowedTypes) => {
    const normalizedCode = normalizeInterventionCode(code);
    const allowedSet = new Set((allowedTypes || []).map(value => normalizeString(value)).filter(Boolean));
    if (!normalizedCode || allowedSet.size === 0) return;
    setCostingDraft(current => {
      if (!current) return current;
      let changed = false;
      const nextInterventions = (current.interventions || []).map(entry => {
        if (normalizeInterventionCode(entry?.code) !== normalizedCode) return entry;
        const suggested = Array.isArray(entry?.suggested) ? entry.suggested : [];
        const nextSuggested = suggested.filter(item => {
          const type = normalizeString(
            item?.type || item?.paymentType || item?.payment_type || "",
          );
          return type && allowedSet.has(type);
        });
        if (nextSuggested.length === suggested.length) return entry;
        changed = true;
        return { ...entry, suggested: nextSuggested };
      });
      return changed ? { ...current, interventions: nextInterventions } : current;
    });
  }, []);

  const updateIntervention = useCallback((index, updates) => {
    let nextCode = null;
    let nextAllowed = null;
    setDraft(current => {
      if (!current) return current;
      const next = [...(current.interventions || [])];
      next[index] = { ...next[index], ...updates };
      nextCode = next[index]?.code || null;
      nextAllowed = Array.isArray(next[index]?.availablePaymentTypes)
        ? next[index].availablePaymentTypes
        : [];
      return { ...current, interventions: next };
    });
    if (Object.prototype.hasOwnProperty.call(updates || {}, "availablePaymentTypes")) {
      pruneDefaultLinesForAllowedTypes(nextCode, nextAllowed);
    }
  }, [pruneDefaultLinesForAllowedTypes]);

  const handleDefaultLinesChange = useCallback(
    (code, allowedTypes, selectedOptions) => {
      const normalizedSelected = (selectedOptions || [])
        .map(option => normalizeString(option?.value || ""))
        .filter(Boolean);
      if (allowedTypes && allowedTypes.length) {
        const allowedSet = new Set(allowedTypes);
        updateDefaultLines(
          code,
          normalizedSelected.filter(type => allowedSet.has(type)),
        );
        return;
      }
      updateDefaultLines(code, normalizedSelected);
    },
    [updateDefaultLines],
  );

  const handleSave = async () => {
    if (!draft || hasValidationIssues) {
      setError("Fix validation errors before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = normalizeMapping(draft);
      const mappedInterventions = (payload.interventions || []).filter(
        entry =>
          entry?.code &&
          ((entry.availablePaymentTypes || []).length > 0 || entry.defaultOnAssessment === true),
      );
      const paymentTypesPayload = normalizePaymentTypes(payload.paymentTypes).map(entry => ({
        code: entry.code,
        label: entry.label,
        notes: entry.notes || "",
        submissionTiming: normalizeSubmissionTiming(entry.submissionTiming),
      }));
      const costingPaymentTypesPayload = buildCostingPaymentTypesPayload(payload.paymentTypes);
      const recurrenceLookupFromDraft = buildRecurrenceModeLookup({
        paymentTypes: costingPaymentTypesPayload,
      });
      const paymentEvidencePayload = buildPaymentEvidencePayload(
        payload.paymentTypes,
        paymentEvidenceConfig,
      );
      const response = await apiFetch("/api/config/runtime/payment-type-mapping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: payload.version || null,
          generatedOn: payload.generatedOn || null,
          notes: normalizeNotes(payload.notes),
          paymentTypes: paymentTypesPayload,
          interventions: mappedInterventions,
          paymentEvidence: paymentEvidencePayload,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Save failed (${response.status})`);
      }
      const nextEvidenceRules = normalizePaymentEvidenceRules(
        data?.paymentEvidence || data?.payment_evidence || null,
      );
      const nextEvidenceOptions = normalizeEvidenceOptions(
        data?.evidenceTypes || data?.evidence_types || [],
      );
      const normalized = normalizeMapping(data, { useDefaults: true });
      const mergedInterventions = mergeInterventionsWithCodes(
        normalized.interventions,
        interventionCodes,
      );
      const merged = {
        ...normalized,
        interventions: mergedInterventions,
        paymentTypes: applyRecurrenceModesToPaymentTypes(
          applyRequiredEvidenceToPaymentTypes(
            normalized.paymentTypes,
            nextEvidenceRules,
          ),
          recurrenceLookupFromDraft,
        ),
      };
      setConfig(merged);
      setDraft({
        ...merged,
        paymentTypes: ensureNonEmpty(merged.paymentTypes, EMPTY_PAYMENT_TYPE),
        interventions: merged.interventions,
      });
      setUpdatedAt(data?.updatedAt || null);
      setPaymentEvidenceConfig(nextEvidenceRules);
      setPaymentEvidenceUpdatedAt(
        data?.paymentEvidenceUpdatedAt || data?.payment_evidence_updated_at || null,
      );
      setEvidenceTypeOptions(nextEvidenceOptions);

      if (costingDraft) {
        const costingInterventions = (costingDraft.interventions || [])
          .map(entry => {
            const code = normalizeInterventionCode(entry?.code);
            if (!code) return null;
            const seen = new Map();
            (entry?.suggested || []).forEach(item => {
              const type = normalizeString(
                item?.type || item?.paymentType || item?.payment_type || "",
              );
              if (!type || seen.has(type)) return;
              seen.set(type, {
                type,
                notes: item?.notes || item?.description || "",
                recurrenceEnabled:
                  typeof item?.recurrenceEnabled === "boolean"
                    ? item.recurrenceEnabled
                    : typeof item?.recurrence_enabled === "boolean"
                      ? item.recurrence_enabled
                      : null,
              });
            });
            return {
              code,
              suggested: Array.from(seen.values()),
            };
          })
          .filter(Boolean);
        const costingPayload = {
          enabled: costingDraft.enabled !== false,
          strategy: normalizeString(costingDraft.strategy) || "allowed",
          paymentTypes: costingPaymentTypesPayload,
          interventions: costingInterventions,
        };
        const costingResponse = await apiFetch("/api/config/runtime/assessment-costing", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(costingPayload),
        });
        const costingData = await costingResponse.json().catch(() => ({}));
        if (!costingResponse.ok) {
          setError(
            costingData?.message ||
              costingData?.error ||
              `Failed to save assessment costing defaults (${costingResponse.status})`,
          );
          return;
        }
        const normalizedCosting = normalizeCostingDefaults(
          costingData?.config ? costingData.config : costingData,
        );
        const mergedCosting = mergeCostingDefaultsWithInterventions(
          normalizedCosting,
          merged.interventions,
        );
        setCostingConfig(mergedCosting);
        setCostingDraft(cloneCostingDefaults(mergedCosting));
        const recurrenceLookup = buildRecurrenceModeLookup(mergedCosting);
        const withRecurrence = {
          ...merged,
          paymentTypes: applyRecurrenceModesToPaymentTypes(merged.paymentTypes, recurrenceLookup),
        };
        setConfig(withRecurrence);
        setDraft({
          ...withRecurrence,
          paymentTypes: ensureNonEmpty(withRecurrence.paymentTypes, EMPTY_PAYMENT_TYPE),
          interventions: withRecurrence.interventions,
        });
      }

      setSuccess("Payment type mapping, recurrence policy, submission timing, and evidence rules saved.");
    } catch (err) {
      setError(err?.message || "Failed to save payment type mapping.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!config) return;
    setDraft({
      ...config,
      paymentTypes: ensureNonEmpty(config.paymentTypes, EMPTY_PAYMENT_TYPE),
      interventions: config.interventions,
    });
    setCostingDraft(costingConfig ? cloneCostingDefaults(costingConfig) : null);
    setError(null);
    setSuccess(null);
  };

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const infoLink = metadata?.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(
          helpContent,
          metadata.helpTitle ?? "Payment type mapping",
          metadata.aiContext ?? "",
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  const notesText = useMemo(() => normalizeNotes(draft?.notes).join("\n"), [draft]);

  const paymentTypesTab = (
    <SpaceBetween size="m">
      {!dismissedAlerts.noPaymentTypes && !normalizePaymentTypes(draft?.paymentTypes).length && (
        <Alert
          type="info"
          dismissible
          onDismiss={() =>
            setDismissedAlerts(current => ({ ...current, noPaymentTypes: true }))
          }
        >
          No payment types are configured yet. Add at least one payment type to support mapping.
        </Alert>
      )}
      <AttributeEditor
        addButtonText="Add payment type"
        items={draft?.paymentTypes || []}
        onAddButtonClick={() =>
          setDraft(current => {
            if (!current) return current;
            return {
              ...current,
              paymentTypes: [...(current.paymentTypes || []), { ...EMPTY_PAYMENT_TYPE }],
            };
          })
        }
        onRemoveButtonClick={({ detail }) => {
          setDraft(current => {
            if (!current) return current;
            const next = [...(current.paymentTypes || [])];
            next.splice(detail.itemIndex, 1);
            return {
              ...current,
              paymentTypes: ensureNonEmpty(next, EMPTY_PAYMENT_TYPE),
            };
          });
        }}
        definition={[
          {
            label: "Payment type code",
            errorText: item => getPaymentTypeCodeError(item),
            control: (item, index) => (
              <Input
                value={item.code}
                onChange={({ detail }) => updatePaymentType(index, { code: detail.value })}
                placeholder="LivingAllowance"
              />
            ),
          },
          {
            label: "Label",
            control: (item, index) => (
              <Input
                value={item.label}
                onChange={({ detail }) => updatePaymentType(index, { label: detail.value })}
                placeholder="Living allowance"
              />
            ),
          },
          {
            label: "Notes",
            control: (item, index) => (
              <Textarea
                value={item.notes || ""}
                onChange={({ detail }) => updatePaymentType(index, { notes: detail.value })}
                placeholder="Optional notes"
                rows={2}
              />
            ),
          },
          {
            label: "Recurrence policy",
            control: (item, index) => (
              <Select
                selectedOption={
                  RECURRENCE_POLICY_OPTIONS.find(
                    option => option.value === normalizeRecurrenceMode(item.recurrenceMode),
                  ) || RECURRENCE_POLICY_OPTIONS[0]
                }
                onChange={({ detail }) =>
                  updatePaymentType(index, {
                    recurrenceMode:
                      detail.selectedOption?.value || RECURRENCE_MODE_NOT_ALLOWED,
                  })
                }
                options={RECURRENCE_POLICY_OPTIONS}
              />
            ),
          },
          {
            label: "Submission timing",
            control: (item, index) => (
              <Select
                selectedOption={
                  SUBMISSION_TIMING_OPTIONS.find(
                    option =>
                      option.value ===
                      normalizeSubmissionTiming(item.submissionTiming),
                  ) || SUBMISSION_TIMING_OPTIONS[3]
                }
                onChange={({ detail }) =>
                  updatePaymentType(index, {
                    submissionTiming:
                      detail.selectedOption?.value || SUBMISSION_TIMING_MANUAL_TRIGGER,
                  })
                }
                options={SUBMISSION_TIMING_OPTIONS}
              />
            ),
          },
          {
            label: "Required evidence",
            control: (item, index) => (
              <Multiselect
                selectedOptions={normalizeEvidenceTypeList(item.requiredEvidence).map(
                  value => evidenceTypeOptionMap.get(value) || { value, label: value },
                )}
                options={evidenceTypeOptions}
                onChange={({ detail }) =>
                  updatePaymentType(index, {
                    requiredEvidence: detail.selectedOptions.map(option => option.value),
                  })
                }
                placeholder={
                  evidenceTypeOptions.length
                    ? "Select required evidence"
                    : "No evidence types available"
                }
                expandToViewport
              />
            ),
          },
        ]}
      />
      <Box color="text-body-secondary">
        These codes should align with the payment type options used in Finance and Casework.
        Recurrence policy, submission timing, and required evidence selections are enforced per payment type.
      </Box>
    </SpaceBetween>
  );

  const interventionsTab = (
    <SpaceBetween size="m">
      {!dismissedAlerts.unknownPaymentTypes && unknownPaymentTypes.length > 0 && (
        <Alert
          type="warning"
          dismissible
          onDismiss={() =>
            setDismissedAlerts(current => ({ ...current, unknownPaymentTypes: true }))
          }
        >
          These payment types are referenced but not listed above: {unknownPaymentTypes.join(", ")}.
        </Alert>
      )}
      <Box color="text-body-secondary">
        Leave allowed payment types empty to allow all payment types for that intervention.
      </Box>
      <AttributeEditor
        disableAddButton
        disableRemoveButton
        items={draft?.interventions || []}
        definition={[
          {
            label: "Intervention",
            control: item => <Input value={formatInterventionDisplay(item)} readOnly />,
          },
          {
            label: "Allowed payment types",
            control: (item, index) => (
              <Multiselect
                selectedOptions={(item.availablePaymentTypes || [])
                  .map(code => paymentTypeOptionMap.get(code) || { value: code, label: code })}
                options={paymentTypeOptions}
                onChange={({ detail }) =>
                  updateIntervention(index, {
                    availablePaymentTypes: detail.selectedOptions.map(option => option.value),
                  })
                }
                placeholder="Select payment types"
                expandToViewport
              />
            ),
          },
          {
            label: "Default lines",
            control: item => {
              const allowedTypes = Array.isArray(item?.availablePaymentTypes)
                ? Array.from(
                    new Set(
                      item.availablePaymentTypes
                        .map(value => normalizeString(value))
                        .filter(Boolean),
                    ),
                  )
                : [];
              const defaultOptions = allowedTypes.length
                ? allowedTypes.map(code => paymentTypeOptionMap.get(code) || { value: code, label: code })
                : paymentTypeOptions;
              const code = normalizeInterventionCode(item?.code);
              const selectedTypes = code ? costingDefaultsLookup.get(code) || [] : [];
              return (
                <Multiselect
                  selectedOptions={selectedTypes.map(
                    value => paymentTypeOptionMap.get(value) || { value, label: value },
                  )}
                  options={defaultOptions}
                  onChange={({ detail }) =>
                    handleDefaultLinesChange(code || item?.code, allowedTypes, detail.selectedOptions)
                  }
                  placeholder="Select default lines"
                  expandToViewport
                  disabled={!costingDraft}
                />
              );
            },
          },
          {
            label: "Auto-add?",
            control: (item, index) => (
              <Checkbox
                checked={Boolean(item?.defaultOnAssessment)}
                onChange={({ detail }) =>
                  updateIntervention(index, { defaultOnAssessment: detail.checked })
                }
              >
                Add this intervention by default for new assessments
              </Checkbox>
            ),
          },
        ]}
      />
    </SpaceBetween>
  );

  const notesTab = (
    <SpaceBetween size="m">
      <ColumnLayout columns={2} variant="text-grid">
        <FormField label="Version">
          <Input
            value={draft?.version || ""}
            onChange={({ detail }) =>
              setDraft(current => (current ? { ...current, version: detail.value } : current))
            }
            placeholder="2026-01 mapping refresh"
          />
        </FormField>
        <FormField label="Generated on">
          <Input value={draft?.generatedOn || ""} readOnly />
        </FormField>
      </ColumnLayout>
      <FormField label="Notes" description="One note per line.">
        <Textarea
          value={notesText}
          onChange={({ detail }) =>
            setDraft(current =>
              current ? { ...current, notes: normalizeNotes(detail.value) } : current,
            )
          }
          placeholder="Include context for finance reviewers."
        />
      </FormField>
      {updatedAt && (
        <Box color="text-body-secondary">Last updated: {updatedAt}</Box>
      )}
      {paymentEvidenceUpdatedAt && paymentEvidenceUpdatedAt !== updatedAt && (
        <Box color="text-body-secondary">Evidence rules updated: {paymentEvidenceUpdatedAt}</Box>
      )}
    </SpaceBetween>
  );

  const tabs = [
    { id: "interventions", label: "Intervention map", content: interventionsTab },
    { id: "paymentTypes", label: "Payment types", content: paymentTypesTab },
    { id: "notes", label: "Notes and metadata", content: notesTab },
  ];

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Control allowed payment types by intervention, recurrence policy, submission timing, and required evidence by payment type."
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={handleReset}
                disabled={!dirty || loading || saving}
              >
                Reset
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={saving}
                disabled={!dirty || loading || saving || hasValidationIssues}
              >
                Save
              </Button>
            </SpaceBetween>
          }
        >
          Payment type mapping
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Payment type mapping settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {loading ? (
        <Box textAlign="center">
          <Spinner /> Loading...
        </Box>
      ) : (
        <SpaceBetween size="m">
          {error && (
            <Alert type="error" dismissible onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert type="success" dismissible onDismiss={() => setSuccess(null)}>
              {success}
            </Alert>
          )}
          <Tabs
            tabs={tabs}
            activeTabId={activeTabId}
            onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          />
        </SpaceBetween>
      )}
    </BoardItem>
  );
};

export default FinancePaymentTypeMappingWidget;
