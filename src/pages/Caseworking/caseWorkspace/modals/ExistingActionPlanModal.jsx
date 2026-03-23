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

const defaultForm = {
  name: "",
  status: "active",
  startDate: "",
  reviewDate: "",
  fundingStream: "",
  budgetPot: "",
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

const ExistingActionPlanModal = ({ visible, onDismiss, onCreated }) => {
  const {
    createActionPlan,
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
  const [resultNocOptions, setResultNocOptions] = useState([]);
  const [resultNocLoading, setResultNocLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setForm(defaultForm);
      setLoading(false);
      setError(null);
      setFieldErrors({});
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

  const selectedStatus = STATUS_OPTIONS.find(option => option.value === form.status) || STATUS_OPTIONS[0];
  const selectedFundingStream =
    fundingStreamOptions.find(option => option.value === form.fundingStream) || null;
  const selectedBudgetPot =
    budgetPotOptions.find(option => option.value === form.budgetPot) || null;
  const selectedResultCode =
    RESULT_OPTIONS.find(option => option.value === form.resultCode) || null;
  const selectedResultEducation =
    RESULT_EDUCATION_OPTIONS.find(option => option.value === form.resultEducationLevel) || null;
  const selectedFutureEducation =
    FUTURE_EDUCATION_OPTIONS.find(option => option.value === form.futureEducationLevel) || null;
  const nocVersionOptions = useMemo(
    () =>
      (Array.isArray(nocVersions) ? nocVersions : []).length
        ? nocVersions
            .map(item => {
              if (!item?.code || !item?.label) return null;
              return {
                value: String(item.code).trim(),
                label: `${String(item.code).trim()} – ${String(item.label).trim()}`,
              };
            })
            .filter(Boolean)
        : NOC_VERSION_OPTIONS,
    [nocVersions]
  );
  const selectedResultNocVersion =
    nocVersionOptions.find(option => option.value === form.resultNocVersion) || null;
  const isClosed = form.status === "closed";

  const handleChange = (field, value) => {
    setForm(current => {
      const next = { ...current, [field]: value };
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
            label: `${item.code} — ${item.title}`,
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
          Capture the current state truthfully. You can fill in missing detail later through normal case management.
        </Box>
        <SpaceBetween size="m">
          <FormField label="Plan name" errorText={fieldErrors.name}>
            <Input
              value={form.name}
              onChange={({ detail }) => handleChange("name", detail.value)}
              autoFocus
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
            </ColumnLayout>
          </Box>
          <FormField label="Plan summary">
            <Textarea
              value={form.summary}
              onChange={({ detail }) => handleChange("summary", detail.value)}
              rows={4}
              placeholder="Optional notes about the existing plan"
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
                />
              </FormField>
              <FormField label="Closure notes">
                <Textarea
                  value={form.closureNotes}
                  onChange={({ detail }) => handleChange("closureNotes", detail.value)}
                  rows={3}
                  placeholder="Optional closure notes"
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
