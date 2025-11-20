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
  Badge,
  Modal,
  Multiselect,
  Select,
  SpaceBetween,
  Spinner,
  Textarea,
} from "@cloudscape-design/components";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const formatDateDisplay = value => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
};

const formatDateTimeDisplay = value => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const toDateInputValue = value => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return value || "";
  return date.toISOString().slice(0, 10);
};

const toApiDateValue = value => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return value;
  return date.toISOString().slice(0, 10);
};

const displayValue = (val) => (val === null || typeof val === "undefined" || val === "" ? "-" : String(val));

const normaliseYesNoValue = (value) => {
  if (value === null || typeof value === "undefined") return "";
  if (value === true) return "yes";
  if (value === false) return "no";
  const str = String(value).trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(str)) return "yes";
  if (["no", "n", "false", "0"].includes(str)) return "no";
  return "";
};

const parseList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(item => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).map(item => String(item).trim()).filter(Boolean);
      }
    } catch (_) {
      const split = value.split(",").map(item => item.trim()).filter(Boolean);
      if (split.length) return split;
    }
  }
  return [];
};

const yesNoOptions = [
  { value: "", label: "Not set" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const employmentStatusOptions = [
  { value: "", label: "Not set" },
  { value: "Unemployed", label: "Unemployed" },
  { value: "Underemployed", label: "Underemployed" },
  { value: "Employed Full-time", label: "Employed Full-time" },
  { value: "Employed Part-time", label: "Employed Part-time" },
  { value: "Self-employed", label: "Self-employed" },
  { value: "Student", label: "Student" },
  { value: "Other", label: "Other" },
];

const educationLevelOptions = [
  { value: "", label: "Not set" },
  { value: "No formal education", label: "No formal education" },
  { value: "Up to Grade 7-8 (Secondaire I-II)", label: "Up to Grade 7-8 (Secondaire I-II)" },
  { value: "Grade 9-10 (Secondaire III)", label: "Grade 9-10 (Secondaire III)" },
  { value: "Grade 11-12 (Secondaire IV-V)", label: "Grade 11-12 (Secondaire IV-V)" },
  { value: "Secondary School Diploma or GED", label: "Secondary School Diploma or GED" },
  { value: "Some post-secondary training", label: "Some post-secondary training" },
  { value: "Apprenticeship/trades certificate or diploma", label: "Apprenticeship/trades certificate or diploma" },
  { value: "CEGEP or other non-university certificate/diploma", label: "CEGEP or other non-university certificate/diploma" },
  { value: "College or other non-university certificate/diploma", label: "College or other non-university certificate/diploma" },
  { value: "University certificate or diploma", label: "University certificate or diploma" },
  { value: "University - Bachelor Degree", label: "University - Bachelor Degree" },
  { value: "University - Master's Degree", label: "University - Master's Degree" },
  { value: "University - Doctorate", label: "University - Doctorate" },
];

const employmentBarrierOptions = [
  { value: "None", label: "None" },
  { value: "Education", label: "Education" },
  { value: "Lack of Marketable Skills", label: "Lack of Marketable Skills" },
  { value: "Lack of Work Experience", label: "Lack of Work Experience" },
  { value: "Remoteness", label: "Remoteness" },
  { value: "Lack of Transportation", label: "Lack of Transportation" },
  { value: "Economic", label: "Economic" },
  { value: "Language", label: "Language" },
  { value: "Lack of Labour Force Attachment", label: "Lack of Labour Force Attachment" },
  { value: "Dependent Care", label: "Dependent Care" },
  { value: "Physical, Emotional, or Mental Health", label: "Physical, Emotional, or Mental Health" },
  { value: "Other", label: "Other" },
];

const localPriorityOptions = [
  { value: "Off Reserve", label: "Off Reserve" },
  { value: "Single Parent Family", label: "Single Parent Family" },
  { value: "Woman over 45", label: "Woman over 45" },
  { value: "Literacy", label: "Literacy" },
  { value: "Youth", label: "Youth" },
  { value: "Unskilled Clerical/Service Worker", label: "Unskilled Clerical/Service Worker" },
  { value: "No Grade 12", label: "No Grade 12" },
  { value: "Unskilled Labourer", label: "Unskilled Labourer" },
  { value: "Non-Targeted", label: "Non-Targeted" },
];

const ReadOnlyField = ({ label, description, value, multiline = false, rows = 3 }) => (
  <FormField
    label={<Box fontWeight="bold">{label}</Box>}
    description={description}
  >
    {multiline ? (
      <Textarea value={displayValue(value)} readOnly rows={rows} />
    ) : (
      <Input value={displayValue(value)} readOnly />
    )}
  </FormField>
);

const ActionPlanDetailsModal = ({ visible, plan, onDismiss, onSaved }) => {
  const {
    updateActionPlan,
    fetchActionPlanContext,
    upsertActionPlanReviewReminder,
    caseData,
    saveCaseContext,
    loadNocVersions,
    nocVersions,
    searchNocCodes,
  } = useCaseWorkspace();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", summary: "", startDate: "", reviewDate: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [caseContext, setCaseContext] = useState(null);
  const [caseContextForm, setCaseContextForm] = useState({
    employmentGoals: "",
    employmentStatus: "",
    educationLevel: "",
    employmentNocVersion: "",
    employmentNoc: "",
    socialAssistance: "",
    employmentInsurance: "",
    childcareNeed: "",
    childcareFunding: "",
    employmentBarriers: [],
    localAreaPriorities: [],
    previousIset: "",
    previousIsetDetails: "",
    otherFunding: "",
  });
  const [nocOptions, setNocOptions] = useState([]);
  const [nocSearching, setNocSearching] = useState(false);

  const seedCaseContextForm = useCallback((source = {}) => {
    const details = source || {};
    setCaseContextForm({
      employmentGoals: details.employmentGoals || details.longTermGoal || details.shortTermGoal || "",
      employmentStatus: details.employmentStatus || details.labourForceStatus || "",
      educationLevel: details.educationLevel || "",
      employmentNocVersion: details.employmentNocVersion || "",
      employmentNoc: details.employmentNoc || "",
      socialAssistance: normaliseYesNoValue(details.socialAssistance),
      employmentInsurance: normaliseYesNoValue(details.employmentInsurance),
      childcareNeed: normaliseYesNoValue(details.childcareNeed),
      childcareFunding: details.childcareFunding || "",
      employmentBarriers: parseList(details.employmentBarriers || details.barriersFromApplication),
      localAreaPriorities: parseList(details.localAreaPriorities),
      previousIset: normaliseYesNoValue(details.previousIset),
      previousIsetDetails: details.previousIsetDetails || "",
      otherFunding: details.otherFunding || "",
    });
  }, []);

  useEffect(() => {
    if (!plan) return;
    setForm({
      name: plan?.title || plan?.name || "",
      summary: plan?.summary || "",
      startDate: toDateInputValue(plan?.startDate),
      reviewDate: toDateInputValue(plan?.endDate),
    });
    setEditing(false);
    setError(null);
  }, [plan]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setContextLoading(true);
    fetchActionPlanContext()
      .then(result => {
        if (cancelled) return;
        const payload = result?.context || result || {};
        const nextCaseContext = result?.caseContext || payload?.caseContext || caseData?.caseContext || null;
        const merged = { ...(payload || {}), ...(nextCaseContext || {}) };
        setContext(merged);
        setCaseContext(nextCaseContext);
        seedCaseContextForm(nextCaseContext || merged);
        setContextLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setContext({});
        setContextLoading(false);
        setError(err?.message || "Unable to load client context.");
      });
    return () => {
      cancelled = true;
    };
  }, [visible, fetchActionPlanContext, caseData, seedCaseContextForm]);

  useEffect(() => {
    if (!visible) return;
    loadNocVersions().catch(() => {});
  }, [visible, loadNocVersions]);

  useEffect(() => {
    if (!visible) return;
    if (caseData?.caseContext && !caseContext) {
      setCaseContext(caseData.caseContext);
      seedCaseContextForm(caseData.caseContext);
    }
  }, [visible, caseData, caseContext, seedCaseContextForm]);

  const handleNocSearch = useCallback(
    async (filteringText = "") => {
      if (!caseContextForm.employmentNocVersion) {
        setNocOptions([]);
        return;
      }
      setNocSearching(true);
      try {
        const results = await searchNocCodes({
          version: caseContextForm.employmentNocVersion,
          query: filteringText || caseContextForm.employmentNoc || "",
        });
        if (Array.isArray(results)) {
          setNocOptions(results);
        }
      } catch (err) {
        console.warn("[ActionPlanDetailsModal] noc search failed", err?.message || err);
      } finally {
        setNocSearching(false);
      }
    },
    [caseContextForm.employmentNocVersion, caseContextForm.employmentNoc, searchNocCodes]
  );

  useEffect(() => {
    if (!visible) return;
    if (!caseContextForm.employmentNocVersion) {
      setNocOptions([]);
      return;
    }
    if (caseContextForm.employmentNoc) {
      handleNocSearch(caseContextForm.employmentNoc).catch(() => {});
    }
  }, [visible, caseContextForm.employmentNocVersion, caseContextForm.employmentNoc, handleNocSearch]);

  const nocVersionOptionsList = useMemo(() => {
    const base = [{ value: "", label: "Not set" }];
    if (!Array.isArray(nocVersions)) return base;
    return base.concat(
      nocVersions.map(item => ({
        value: item.code || item.value || "",
        label: item.label || item.code || "",
        description: item.description || undefined,
      }))
    );
  }, [nocVersions]);

  const autosuggestOptions = useMemo(
    () =>
      Array.isArray(nocOptions)
        ? nocOptions
            .map(item => ({
              value: item.code || item.value || "",
              label: item.title ? `${item.code} — ${item.title}` : item.label || item.code || "",
              description: item.title || item.label || null,
            }))
            .filter(item => item.value)
        : [],
    [nocOptions]
  );

  const handleDismiss = () => {
    if (saving) return;
    setEditing(false);
    if (plan) {
      setForm({
        name: plan?.title || plan?.name || "",
        summary: plan?.summary || "",
        startDate: plan?.startDate || "",
        reviewDate: plan?.endDate || "",
      });
    }
    seedCaseContextForm(caseContext || context || {});
    onDismiss();
  };

  const handleCancelEdit = () => {
    if (saving) return;
    if (plan) {
      setForm({
        name: plan?.title || plan?.name || "",
        summary: plan?.summary || "",
        startDate: plan?.startDate || "",
        reviewDate: plan?.endDate || "",
      });
    }
    seedCaseContextForm(caseContext || context || {});
    setEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!plan) return;
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("Plan name is required.");
      return;
    }
    if (!form.startDate) {
      setError("Start date is required.");
      return;
    }
    if (form.startDate && form.reviewDate && form.reviewDate < form.startDate) {
      setError("Review date cannot be before start date.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateActionPlan(plan.id, {
        name: trimmedName,
        startDate: toApiDateValue(form.startDate),
        reviewDate: toApiDateValue(form.reviewDate),
        summary: form.summary || null,
      });
      const toNullable = (value) => {
        if (value === undefined || value === null) return null;
        const str = String(value);
        return str.trim().length ? value : null;
      };
      const nextContext = {
        ...(caseContext || {}),
        employmentGoals: toNullable(caseContextForm.employmentGoals?.trim() || ""),
        employmentStatus: toNullable(caseContextForm.employmentStatus),
        educationLevel: toNullable(caseContextForm.educationLevel),
        employmentNocVersion: toNullable(caseContextForm.employmentNocVersion),
        employmentNoc: toNullable(caseContextForm.employmentNoc),
        socialAssistance: toNullable(caseContextForm.socialAssistance),
        employmentInsurance: toNullable(caseContextForm.employmentInsurance),
        childcareNeed: toNullable(caseContextForm.childcareNeed),
        childcareFunding: toNullable(caseContextForm.childcareFunding?.trim() || ""),
        employmentBarriers: Array.isArray(caseContextForm.employmentBarriers)
          ? caseContextForm.employmentBarriers.filter(Boolean)
          : [],
        localAreaPriorities: Array.isArray(caseContextForm.localAreaPriorities)
          ? caseContextForm.localAreaPriorities.filter(Boolean)
          : [],
        previousIset: toNullable(caseContextForm.previousIset),
        previousIsetDetails: toNullable(caseContextForm.previousIsetDetails?.trim() || ""),
        otherFunding: toNullable(caseContextForm.otherFunding?.trim() || ""),
      };
      await saveCaseContext(nextContext);
      await upsertActionPlanReviewReminder({ ...plan, ...updated }, form.reviewDate || null);
      setCaseContext(nextContext);
      seedCaseContextForm(nextContext);
      setSaving(false);
      setEditing(false);
      if (onSaved) onSaved(updated);
    } catch (err) {
      setSaving(false);
      setError(err?.message || "Failed to update action plan.");
    }
  };

  if (!visible || !plan) {
    return null;
  }

  const findOption = (options, value) =>
    (options || []).find(opt => opt.value === value) || (options && options[0]) || null;

  const employmentStatusOption = findOption(employmentStatusOptions, caseContextForm.employmentStatus);
  const educationLevelOption = findOption(educationLevelOptions, caseContextForm.educationLevel);
  const socialAssistanceOption = findOption(yesNoOptions, caseContextForm.socialAssistance);
  const employmentInsuranceOption = findOption(yesNoOptions, caseContextForm.employmentInsurance);
  const childcareNeedOption = findOption(yesNoOptions, caseContextForm.childcareNeed);
  const previousIsetOption = findOption(yesNoOptions, caseContextForm.previousIset);
  const nocVersionOption = findOption(nocVersionOptionsList, caseContextForm.employmentNocVersion);
  const selectedBarriers = employmentBarrierOptions.filter(opt =>
    (caseContextForm.employmentBarriers || []).includes(opt.value)
  );
  const selectedPriorities = localPriorityOptions.filter(opt =>
    (caseContextForm.localAreaPriorities || []).includes(opt.value)
  );
  const nocCodeOption =
    autosuggestOptions.find(opt => opt.value === caseContextForm.employmentNoc) || null;
  const nocDisplayValue = nocCodeOption
    ? `${nocCodeOption.value} — ${nocCodeOption.description || nocCodeOption.label || ''}`.trim()
    : displayValue(caseContextForm.employmentNoc);

  const footer = editing ? (
    <SpaceBetween size="xs" direction="horizontal">
      <Button onClick={handleCancelEdit} disabled={saving}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSave} loading={saving}>
        Save changes
      </Button>
    </SpaceBetween>
  ) : (
    <SpaceBetween size="xs" direction="horizontal">
      <Button onClick={handleDismiss}>
        Close
      </Button>
      <Button variant="primary" onClick={() => setEditing(true)}>
        Edit plan
      </Button>
    </SpaceBetween>
  );

  return (
    <Modal
      visible={visible}
      header="Action plan details"
      onDismiss={handleDismiss}
      closeAriaLabel="Close action plan details modal"
      size="large"
      footer={footer}
    >
      <SpaceBetween size="l">
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

        <SpaceBetween size="s">
          <Box fontSize="heading-m" fontWeight="bold">
            Plan overview
          </Box>
          <ColumnLayout columns={3} variant="text-grid">
            <FormField label="Plan name">
              {editing ? (
                <Input
                  value={form.name}
                  onChange={({ detail }) => setForm(current => ({ ...current, name: detail.value }))}
                />
              ) : (
                <Input value={form.name || "Untitled"} readOnly />
              )}
            </FormField>
            <FormField label="Plan summary" description="High-level objective for this plan.">
              {editing ? (
                <Textarea
                  value={form.summary}
                  rows={3}
                  onChange={({ detail }) => setForm(current => ({ ...current, summary: detail.value }))}
                  placeholder="High-level objective for this plan"
                />
              ) : (
                <Textarea value={form.summary || "-"} readOnly rows={3} />
              )}
            </FormField>
            <FormField label="Start date" description="When the plan becomes active.">
              {editing ? (
                <DatePicker
                  value={form.startDate}
                  onChange={({ detail }) => setForm(current => ({ ...current, startDate: detail.value }))}
                  placeholder="YYYY-MM-DD"
                />
              ) : (
                <Input value={formatDateDisplay(form.startDate)} readOnly />
              )}
            </FormField>
            <FormField label="Review date" description="Next scheduled review for this plan.">
              {editing ? (
                <DatePicker
                  value={form.reviewDate}
                  onChange={({ detail }) => setForm(current => ({ ...current, reviewDate: detail.value }))}
                  placeholder="YYYY-MM-DD"
                />
              ) : (
                <Input value={formatDateDisplay(form.reviewDate)} readOnly />
              )}
            </FormField>
          </ColumnLayout>
        </SpaceBetween>

        <SpaceBetween size="s">
          <Box fontSize="heading-m" fontWeight="bold">
            Status & metrics
          </Box>
          <ColumnLayout columns={3} variant="text-grid">
            <FormField label={<Box fontWeight="bold">Status</Box>} description="Current lifecycle state of the plan.">
              <Input
                value={displayValue(plan.status)}
                readOnly
                ariaLabel="Plan status"
              />
            </FormField>
            <ReadOnlyField label="Interventions" description="Number of linked interventions." value={Number.isFinite(plan.interventionCount) ? plan.interventionCount : "-"} />
            <ReadOnlyField label="Outcome summary" description="Summary recorded at closure." value={plan.outcomeSummary || "-"} multiline rows={2} />
            <ReadOnlyField label="Closure notes" description="Notes captured when closing the plan." value={plan.closureNotes || "-"} multiline rows={2} />
            <ReadOnlyField label="Result code" description="Outcome identifier for reporting." value={plan.resultCode || "-"} />
            <ReadOnlyField label="Result date" description="Date the result was recorded." value={formatDateDisplay(plan.resultDate)} />
            <ReadOnlyField label="Created at" description="When the plan was created." value={formatDateTimeDisplay(plan.createdAt)} />
            <ReadOnlyField label="Last updated" description="Most recent update timestamp." value={formatDateTimeDisplay(plan.updatedAt)} />
            <ReadOnlyField
              label="Case ID"
              description="Associated case identifier."
              value={
                caseData?.caseNumber ||
                caseData?.trackingId ||
                caseData?.tracking_id ||
                caseData?.agreementNumber ||
                plan.caseId ||
                "-"
              }
            />
            <ReadOnlyField
              label="Assigned to"
              description="Plan owner from the case header."
              value={caseData?.owner?.email || caseData?.owner?.name || "-"}
            />
            <ReadOnlyField label="Activated at" description="When the plan was activated." value={formatDateTimeDisplay(plan.activatedAt)} />
            <ReadOnlyField label="Closed at" description="When the plan was closed." value={formatDateTimeDisplay(plan.closedAt)} />
            <ReadOnlyField label="Archived at" description="When the plan was archived." value={formatDateTimeDisplay(plan.archivedAt)} />
          </ColumnLayout>
        </SpaceBetween>

        <SpaceBetween size="s">
          <Box fontSize="heading-m" fontWeight="bold">
            Client context
          </Box>
          {contextLoading ? (
            <Box padding="m">
              <Spinner />
            </Box>
          ) : (
            <ColumnLayout columns={3} variant="text-grid">
              <FormField
                label={<Box fontWeight="bold">Employment goals</Box>}
                description="Summarize the client's goals and request."
              >
                {editing ? (
                  <Textarea
                    value={caseContextForm.employmentGoals}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => ({ ...current, employmentGoals: detail.value }))
                    }
                    rows={4}
                  />
                ) : (
                  <Textarea value={displayValue(caseContextForm.employmentGoals)} readOnly rows={4} />
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Employment status</Box>}
                description="Current employment situation."
              >
                {editing ? (
                  <Select
                    selectedOption={employmentStatusOption}
                    options={employmentStatusOptions}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => ({
                        ...current,
                        employmentStatus: detail.selectedOption?.value || "",
                      }))
                    }
                    selectedAriaLabel="Employment status"
                  />
                ) : (
                  <Input value={displayValue(employmentStatusOption?.label || caseContextForm.employmentStatus)} readOnly />
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Education level</Box>}
                description="Highest completed education."
              >
                {editing ? (
                  <Select
                    selectedOption={educationLevelOption}
                    options={educationLevelOptions}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => ({
                        ...current,
                        educationLevel: detail.selectedOption?.value || "",
                      }))
                    }
                    selectedAriaLabel="Education level"
                  />
                ) : (
                  <Input value={displayValue(educationLevelOption?.label || caseContextForm.educationLevel)} readOnly />
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Employment NOC version</Box>}
                description="Select a NOC version before searching for the code."
              >
                {editing ? (
                  <Select
                    selectedOption={nocVersionOption}
                    options={nocVersionOptionsList}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => {
                        const nextVersion = detail.selectedOption?.value || "";
                        return {
                          ...current,
                          employmentNocVersion: nextVersion,
                          employmentNoc: nextVersion === current.employmentNocVersion ? current.employmentNoc : "",
                        };
                      })
                    }
                    selectedAriaLabel="NOC version"
                    placeholder="Select NOC version"
                  />
                ) : (
                  <Input value={displayValue(nocVersionOption?.label || caseContextForm.employmentNocVersion)} readOnly />
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Employment NOC code</Box>}
                description="Lookup the related NOC code."
              >
                {editing ? (
                  <Autosuggest
                    value={caseContextForm.employmentNoc || ""}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => ({ ...current, employmentNoc: detail.value }))
                    }
                    options={autosuggestOptions}
                    onLoadItems={({ detail }) => handleNocSearch(detail.filteringText)}
                    placeholder={
                      caseContextForm.employmentNocVersion
                        ? "Search NOC code"
                        : "Select NOC version first"
                    }
                    empty="No matches"
                    filteringType="manual"
                    statusType={nocSearching ? "loading" : "finished"}
                    loadingText="Searching NOC codes"
                    disabled={!caseContextForm.employmentNocVersion}
                  />
                ) : (
                  <Input value={displayValue(nocDisplayValue)} readOnly />
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Social assistance</Box>}
                description="Whether the client receives social assistance."
              >
                {editing ? (
                  <Select
                    selectedOption={socialAssistanceOption}
                    options={yesNoOptions}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => ({
                        ...current,
                        socialAssistance: detail.selectedOption?.value || "",
                      }))
                    }
                    selectedAriaLabel="Social assistance"
                  />
                ) : (
                  <Input value={displayValue(socialAssistanceOption?.label || caseContextForm.socialAssistance)} readOnly />
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Employment insurance</Box>}
                description="Employment insurance status."
              >
                {editing ? (
                  <Select
                    selectedOption={employmentInsuranceOption}
                    options={yesNoOptions}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => ({
                        ...current,
                        employmentInsurance: detail.selectedOption?.value || "",
                      }))
                    }
                    selectedAriaLabel="Employment insurance"
                  />
                ) : (
                  <Input value={displayValue(employmentInsuranceOption?.label || caseContextForm.employmentInsurance)} readOnly />
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Childcare need</Box>}
                description="Whether childcare support is required."
              >
                {editing ? (
                  <Select
                    selectedOption={childcareNeedOption}
                    options={yesNoOptions}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => ({
                        ...current,
                        childcareNeed: detail.selectedOption?.value || "",
                      }))
                    }
                    selectedAriaLabel="Childcare need"
                  />
                ) : (
                  <Input value={displayValue(childcareNeedOption?.label || caseContextForm.childcareNeed)} readOnly />
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Childcare funding</Box>}
                description="Details on childcare funding."
              >
                {editing ? (
                  <Input
                    value={caseContextForm.childcareFunding}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => ({ ...current, childcareFunding: detail.value }))
                    }
                  />
                ) : (
                  <Input value={displayValue(caseContextForm.childcareFunding)} readOnly />
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Employment barriers</Box>}
                description="Barriers identified by the client."
              >
                {editing ? (
                  <Multiselect
                    options={employmentBarrierOptions}
                    selectedOptions={selectedBarriers}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => ({
                        ...current,
                        employmentBarriers: (detail.selectedOptions || []).map(opt => opt.value),
                      }))
                    }
                    tokenLimit={3}
                    placeholder="Select barriers"
                    deselectAriaLabel={e => `Remove ${e.option?.label || e.option?.value}`}
                  />
                ) : (
                  <SpaceBetween size="xs" direction="horizontal" wrap>
                    {(selectedBarriers && selectedBarriers.length) ? (
                      selectedBarriers.map(item => (
                        <Badge key={item.value || item.label} color="blue">
                          {item.label || item.value}
                        </Badge>
                      ))
                    ) : (
                      <Badge color="grey">Not set</Badge>
                    )}
                  </SpaceBetween>
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Local area priorities</Box>}
                description="Priority categories relevant to this client."
              >
                {editing ? (
                  <Multiselect
                    options={localPriorityOptions}
                    selectedOptions={selectedPriorities}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => ({
                        ...current,
                        localAreaPriorities: (detail.selectedOptions || []).map(opt => opt.value),
                      }))
                    }
                    tokenLimit={3}
                    placeholder="Select priorities"
                    deselectAriaLabel={e => `Remove ${e.option?.label || e.option?.value}`}
                  />
                ) : (
                  <SpaceBetween size="xs" direction="horizontal" wrap>
                    {(selectedPriorities && selectedPriorities.length) ? (
                      selectedPriorities.map(item => (
                        <Badge key={item.value || item.label} color="blue">
                          {item.label || item.value}
                        </Badge>
                      ))
                    ) : (
                      <Badge color="grey">Not set</Badge>
                    )}
                  </SpaceBetween>
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Previous ISET</Box>}
                description="Has the client used ISET before?"
              >
                {editing ? (
                  <Select
                    selectedOption={previousIsetOption}
                    options={yesNoOptions}
                    onChange={({ detail }) =>
                      setCaseContextForm(current => ({
                        ...current,
                        previousIset: detail.selectedOption?.value || "",
                      }))
                    }
                    selectedAriaLabel="Previous ISET"
                  />
                ) : (
                  <Input value={displayValue(previousIsetOption?.label || caseContextForm.previousIset)} readOnly />
                )}
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Previous ISET details</Box>}
                description="Context about prior ISET participation."
              >
                <Textarea
                  value={caseContextForm.previousIsetDetails}
                  onChange={({ detail }) =>
                    setCaseContextForm(current => ({ ...current, previousIsetDetails: detail.value }))
                  }
                  rows={3}
                  readOnly={!editing}
                />
              </FormField>
              <FormField
                label={<Box fontWeight="bold">Other funding</Box>}
                description="Additional funding noted for this client."
              >
                <Textarea
                  value={caseContextForm.otherFunding}
                  onChange={({ detail }) =>
                    setCaseContextForm(current => ({ ...current, otherFunding: detail.value }))
                  }
                  rows={3}
                  readOnly={!editing}
                />
              </FormField>
            </ColumnLayout>
          )}
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default ActionPlanDetailsModal;
