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
  Multiselect,
  Select,
  SpaceBetween,
  Spinner,
  Textarea,
  ExpandableSection,
} from "@cloudscape-design/components";
import useCurrentUser from "../../../../hooks/useCurrentUser.js";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import {
  formatBarriers,
  formatEducationLevel,
  formatLabourForceStatus,
  formatLocalPriorities,
} from "../utils/isetOptionLabels.js";
import { apiFetch } from "../../../../auth/apiClient.js";

const ReadOnlyItem = ({ label, value }) => (
  <div style={{ marginBottom: "0.5rem" }}>
    <div style={{ fontSize: "0.75rem", color: "var(--color-text-body-secondary)" }}>{label}</div>
    <div>{value ?? "-"}</div>
  </div>
);

const formatBoolean = value => {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value === null || typeof value === "undefined") return "-";
  const str = String(value).trim().toLowerCase();
  if (["yes", "true", "1"].includes(str)) return "Yes";
  if (["no", "false", "0"].includes(str)) return "No";
  return value;
};

const NOC_VERSION_OPTIONS = [
  { value: "2016", label: "2016" },
  { value: "2021", label: "2021" },
];

const SummaryPreview = ({ summary }) => {
  if (!summary) return null;
  const lines = summary.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  const preview = lines.slice(0, 3).join("\n");
  return (
    <Box padding="s" variant="highlight">
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-body-secondary)", marginBottom: "0.25rem" }}>
        Plan summary preview
      </div>
      <div style={{ whiteSpace: "pre-wrap" }}>{preview}</div>
      {lines.length > 3 && (
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-body-secondary)", marginTop: "0.25rem" }}>
          (Showing first 3 lines)
        </div>
      )}
    </Box>
  );
};

const EI_CLAIMANT_OPTIONS = [
  { value: "1", label: "Employment insurance claimant" },
  { value: "2", label: "Reach-back client/former claimant" },
  { value: "3", label: "Non-insured client" },
];

const AGREEMENT_BY_EI = {
  "1": "16535866",
  "2": "16535866",
  "3": "16535841",
};

const deriveAgreementNumber = eiClaimantValue => {
  const key = eiClaimantValue ? String(eiClaimantValue).trim() : "";
  return AGREEMENT_BY_EI[key] || "999999999";
};

const deriveAgreementNumberFromFundingStream = fundingStream => {
  if (!fundingStream) return "999999999";
  const key = String(fundingStream).trim().toUpperCase();
  if (key === "EI") return "16535866";
  if (key === "CRF") return "16535841";
  return "999999999";
};

const PREV_EMPLOYMENT_OPTIONS = [
  { value: "1", label: "Unemployed" },
  { value: "2", label: "Employed" },
  { value: "9", label: "Student" },
];

const YES_NO_OPTIONS = [
  { value: "1", label: "Yes" },
  { value: "0", label: "No" },
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

const SCHEDULE_OPTIONS = [
  { value: "1", label: "Full-time" },
  { value: "2", label: "Part-time" },
];

const defaultForm = {
  name: "",
  startDate: "",
  reviewDate: "",
  summary: "",
  agreementNumber: "",
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
};

const NewActionPlanModal = ({
  visible,
  mode = "create",
  plan = null,
  onDismiss,
  onCreated,
  onSaved,
}) => {
  const {
    createActionPlan,
    updateActionPlan,
    fetchActionPlanContext,
    upsertActionPlanReviewReminder,
    caseData,
    searchNocCodes,
    fundingStreams,
    fundingStreamsLoading,
    loadFundingStreams,
  } = useCaseWorkspace();
  const currentUser = useCurrentUser();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [nocOptions, setNocOptions] = useState([]);
  const [nocLoading, setNocLoading] = useState(false);
  const [potOptions, setPotOptions] = useState([]);
  const [potLoading, setPotLoading] = useState(false);
  const isEdit = mode === "edit" && plan;
  useEffect(() => {
    setForm(current => ({
      ...current,
      agreementNumber: deriveAgreementNumberFromFundingStream(current.fundingStream),
    }));
  }, [form.fundingStream]);

  useEffect(() => {
    if (form.fundingStream) return;
    if (form.eiClaimant === "1" || form.eiClaimant === "2") {
      setForm(current => ({ ...current, fundingStream: "EI", agreementNumber: deriveAgreementNumberFromFundingStream("EI") }));
    } else if (form.eiClaimant === "3") {
      setForm(current => ({ ...current, fundingStream: "CRF", agreementNumber: deriveAgreementNumberFromFundingStream("CRF") }));
    }
  }, [form.eiClaimant]);
  const loadPots = useMemo(
    () => async query => {
      setPotLoading(true);
      try {
        const resp = await apiFetch(`/api/finance/budget-pots`);
        if (!resp.ok) {
          throw new Error(`Lookup failed (${resp.status})`);
        }
        const data = await resp.json();
        const qLower = (query || "").toLowerCase();
        const options = (Array.isArray(data) ? data : [])
          .filter(item => {
            const potType =
              item?.pot_type ??
              item?.potType ??
              item?.type ??
              item?.nodeType ??
              item?.metadata?.pot_type ??
              item?.metadata?.nodeType ??
              "";
            const norm = String(potType).trim().toLowerCase().replace(/[_\s]+/g, " ");
            return norm === "funding stream";
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
        setPotOptions(options);
      } catch (e) {
        console.warn("[ActionPlan] pot lookup failed", e);
        setPotOptions([]);
      } finally {
        setPotLoading(false);
      }
    },
    []
  );

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

  useEffect(() => {
    if (!visible) {
      setForm(defaultForm);
      setError(null);
      setNocOptions([]);
      return;
    }
    if (isEdit) {
      setForm({
        name: plan?.title || plan?.name || "",
        startDate: plan?.startDate || "",
        reviewDate: plan?.endDate || "",
        summary: plan?.summary || "",
        fundingStream: plan?.fundingStream || plan?.funding_stream || "",
        agreementNumber: deriveAgreementNumberFromFundingStream(plan?.fundingStream || plan?.funding_stream),
        budgetPot: plan?.budgetPot || plan?.budget_pot || "",
        educationLevel: plan?.education_level ? String(plan.education_level) : "",
        educationProvince: plan?.education_province ? String(plan.education_province) : "",
        socialAssistanceRecipient: plan?.social_assistance_recipient !== null && plan?.social_assistance_recipient !== undefined
          ? String(plan.social_assistance_recipient)
          : "",
        eiClaimant: plan?.eiClaimant ? String(plan.eiClaimant) : "",
        prevEmployment: plan?.prevEmployment ? String(plan.prevEmployment) : "",
        prevEmploymentNoc: plan?.prevEmploymentNoc || "",
        prevEmploymentNocVersion: plan?.prevEmploymentNocVersion || "",
        prevEmploymentScheduleType: plan?.prevEmploymentScheduleType ? String(plan.prevEmploymentScheduleType) : "",
        childcareNeed: plan?.childcare_need !== null && plan?.childcare_need !== undefined ? String(plan.childcare_need) : "",
        childcareFunding: plan?.childcare_funding ? String(plan.childcare_funding) : "",
        barriers: Array.isArray(plan?.barriers) ? plan.barriers.map(b => String(b)) : [],
      });
    } else {
      setForm(defaultForm);
    }
    if (visible) {
      loadPots();
      loadFundingStreams().catch(() => {});
    }
  }, [visible, isEdit, plan, loadPots, loadFundingStreams]);

  const handleNocSearch = useCallback(
    async (query) => {
      if (!form.prevEmploymentNocVersion) {
        setNocOptions([]);
        return;
      }
      setNocLoading(true);
      try {
        const results = await searchNocCodes({ query, version: form.prevEmploymentNocVersion });
        const opts = (results || []).map(item => ({
          value: item.code,
          label: `${item.code} — ${item.title}`,
          description: item.title,
        }));
        setNocOptions(opts);
      } catch (err) {
        setNocOptions([]);
      } finally {
        setNocLoading(false);
      }
    },
    [searchNocCodes, form.prevEmploymentNocVersion]
  );

  useEffect(() => {
    if (!visible || isEdit) return;
    let cancelled = false;
    setContextLoading(true);
    fetchActionPlanContext()
      .then(result => {
        if (cancelled) return;
        const payload = result?.context || result || {};
        setContext(payload);
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
  }, [visible, isEdit, fetchActionPlanContext]);

  const eligibilityValue = useMemo(() => {
    const contextEligibility = context?.eligibility || context?.Eligibility;
    return contextEligibility || caseData?.eligibility || "-";
  }, [context, caseData]);

  const validateForm = useCallback(() => {
    const errors = {};
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      errors.name = "Plan name is required.";
    }
    if (!form.startDate && !isEdit) {
      errors.startDate = "Start date is required.";
    }
    if (form.startDate && form.reviewDate && form.reviewDate < form.startDate) {
      errors.reviewDate = "Review date cannot be before start date.";
    }
    const digits = form.agreementNumber.replace(/\D/g, "");
    if (!digits || digits.length < 7 || digits.length > 9) {
      errors.agreementNumber = "Agreement number must be 7–9 digits.";
    }
    if (!form.socialAssistanceRecipient) {
      errors.socialAssistanceRecipient = "Select Yes/No for social assistance.";
    }
    if (!form.eiClaimant) {
      errors.eiClaimant = "Select EI claimant status.";
    }
    if (!form.prevEmployment) {
      errors.prevEmployment = "Employment status at plan start is required.";
    }
    if (form.prevEmployment === "2") {
      if (!form.prevEmploymentNoc) {
        errors.prevEmploymentNoc = "NOC code is required when employment status is Employed.";
      }
      if (!form.prevEmploymentNocVersion) {
        errors.prevEmploymentNocVersion = "NOC version is required when employment status is Employed.";
      }
      if (!form.prevEmploymentScheduleType) {
        errors.prevEmploymentScheduleType = "Schedule type is required when employment status is Employed.";
      }
    }
    if (form.childcareNeed === "1" && !form.childcareFunding) {
      errors.childcareFunding = "Childcare funding is required when childcare need is Yes.";
    }
    if (form.educationLevel && !form.educationProvince) {
      errors.educationProvince = "Education province is required when education level is set.";
    }
    if (!form.fundingStream) {
      errors.fundingStream = "Funding stream is required.";
    }
    if (!form.budgetPot) {
      errors.budgetPot = "Budget pot is required.";
    }
    return errors;
  }, [form, isEdit]);

  const handleSubmit = async () => {
    setValidationError(null);
    setFieldErrors({});
    const errors = validateForm();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setValidationError("Please resolve the highlighted fields.");
      return;
    }
    const trimmedName = form.name.trim();
    setLoading(true);
    setError(null);
    try {
      if (isEdit) {
        const updated = await updateActionPlan(plan.id, {
          name: trimmedName,
          startDate: form.startDate || null,
          reviewDate: form.reviewDate || null,
          summary: form.summary || null,
          budgetPot: form.budgetPot || null,
          fundingStream: form.fundingStream || null,
          agreementNumber: form.agreementNumber || null,
          educationLevel: form.educationLevel || null,
          educationProvince: form.educationProvince || null,
          socialAssistanceRecipient: form.socialAssistanceRecipient || null,
          eiClaimant: form.eiClaimant || null,
          prevEmployment: form.prevEmployment || null,
          prevEmploymentNoc: form.prevEmployment === "2" ? form.prevEmploymentNoc || null : null,
          prevEmploymentNocVersion: form.prevEmployment === "2" ? form.prevEmploymentNocVersion || null : null,
          prevEmploymentScheduleType: form.prevEmployment === "2" ? form.prevEmploymentScheduleType || null : null,
          childcareNeed: form.childcareNeed || null,
          childcareFunding: form.childcareFunding || null,
          barriers: Array.isArray(form.barriers) ? form.barriers : [],
        });
        await upsertActionPlanReviewReminder({ ...plan, ...updated }, form.reviewDate || null);
        setLoading(false);
        if (onSaved) onSaved(updated);
      } else {
        const created = await createActionPlan({
          name: trimmedName,
          startDate: form.startDate,
          reviewDate: form.reviewDate || null,
          summary: form.summary || null,
          ownerStaffProfileId: currentUser?.userId || caseData?.owner?.id || null,
          budgetPot: form.budgetPot || null,
          fundingStream: form.fundingStream || null,
          agreementNumber: form.agreementNumber || null,
          educationLevel: form.educationLevel || null,
          educationProvince: form.educationProvince || null,
          socialAssistanceRecipient: form.socialAssistanceRecipient || null,
          eiClaimant: form.eiClaimant || null,
          prevEmployment: form.prevEmployment || null,
          prevEmploymentNoc: form.prevEmployment === "2" ? form.prevEmploymentNoc || null : null,
          prevEmploymentNocVersion: form.prevEmployment === "2" ? form.prevEmploymentNocVersion || null : null,
          prevEmploymentScheduleType: form.prevEmployment === "2" ? form.prevEmploymentScheduleType || null : null,
          childcareNeed: form.childcareNeed || null,
          childcareFunding: form.childcareFunding || null,
          barriers: Array.isArray(form.barriers) ? form.barriers : [],
        });
        if (form.reviewDate) {
          await upsertActionPlanReviewReminder(created, form.reviewDate);
        }
        setLoading(false);
        setForm(defaultForm);
        onCreated(created);
      }
    } catch (err) {
      setLoading(false);
      setError(err?.message || (isEdit ? "Failed to update action plan." : "Failed to create action plan."));
    }
  };

  const handleDismiss = () => {
    if (loading) return;
    setForm(defaultForm);
    setError(null);
    setValidationError(null);
    setFieldErrors({});
    onDismiss();
  };

  const selectedPrevEmployment = PREV_EMPLOYMENT_OPTIONS.find(opt => opt.value === form.prevEmployment) || null;
  const selectedEiClaimant = EI_CLAIMANT_OPTIONS.find(opt => opt.value === form.eiClaimant) || null;
  const selectedEducationLevel = EDUCATION_OPTIONS.find(opt => opt.value === form.educationLevel) || null;
  const selectedEducationProvince = PROVINCE_OPTIONS.find(opt => opt.value === form.educationProvince) || null;
  const selectedSocialAssistance = YES_NO_OPTIONS.find(opt => opt.value === form.socialAssistanceRecipient) || null;
  const selectedChildcareNeed = YES_NO_OPTIONS.find(opt => opt.value === form.childcareNeed) || null;
  const selectedChildcareFunding = CHILDCARE_FUNDING_OPTIONS.find(opt => opt.value === form.childcareFunding) || null;
  const selectedPrevEmploymentNocVersion = NOC_VERSION_OPTIONS.find(opt => opt.value === form.prevEmploymentNocVersion) || null;
  const selectedBarriers = BARRIER_OPTIONS.filter(opt => (form.barriers || []).includes(opt.value));

  const renderContext = () => {
    if (contextLoading) {
      return (
        <Box padding="m">
          <Spinner />
        </Box>
      );
    }
    const details = context || {};
    const employmentGoals =
      details.employmentGoals ||
      details.longTermGoal ||
      details.shortTermGoal ||
      "-";
    const employmentStatus =
      formatLabourForceStatus(details.labourForceStatus) ||
      details.labourForceStatus ||
      "-";
    const educationLevel =
      formatEducationLevel(details.educationLevel) ||
      details.educationLevel ||
      "-";
    const employmentBarriers =
      formatBarriers(details.employmentBarriers) ||
      formatBarriers(details.barriersFromApplication) ||
      "-";
    const localPriorities =
      formatLocalPriorities(details.localAreaPriorities) ||
      details.localAreaPriorities ||
      "-";

    return (
      <SpaceBetween size="s">
        <ColumnLayout columns={2} variant="text-grid">
          <Box>
            <ReadOnlyItem label="Eligibility" value={eligibilityValue} />
            <ReadOnlyItem label="Employment goals" value={employmentGoals} />
            <ReadOnlyItem label="Employment status" value={employmentStatus} />
            <ReadOnlyItem label="Employment NOC" value={details.employmentNoc || "-"} />
            <ReadOnlyItem label="Employment NOC version" value={details.employmentNocVersion || "-"} />
          </Box>
          <Box>
            <ReadOnlyItem label="Education level" value={educationLevel} />
            <ReadOnlyItem label="Social assistance" value={formatBoolean(details.socialAssistance)} />
            <ReadOnlyItem label="Employment insurance" value={formatBoolean(details.employmentInsurance)} />
            <ReadOnlyItem label="Childcare need" value={formatBoolean(details.childcareNeed)} />
            <ReadOnlyItem label="Childcare funding" value={details.childcareFunding || "-"} />
          </Box>
        </ColumnLayout>
        <ColumnLayout columns={2} variant="text-grid">
          <Box>
            <ReadOnlyItem label="Employment barriers" value={employmentBarriers} />
            <ReadOnlyItem label="Local area priorities" value={localPriorities} />
          </Box>
          <Box>
            <ReadOnlyItem label="Previous ISET" value={formatBoolean(details.previousIset)} />
            <ReadOnlyItem label="Previous ISET details" value={details.previousIsetDetails || "-"} />
            <ReadOnlyItem label="Other funding" value={details.otherFunding || "-"} />
          </Box>
        </ColumnLayout>
      </SpaceBetween>
    );
  };

  return (
    <Modal
      visible={visible}
      header={isEdit ? "Edit action plan" : "New action plan"}
      onDismiss={handleDismiss}
      closeAriaLabel={isEdit ? "Close edit action plan modal" : "Close new action plan modal"}
      size="large"
      footer={
        <SpaceBetween size="xs" direction="horizontal">
          <Button onClick={handleDismiss} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            {isEdit ? "Save changes" : "Create action plan"}
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="l">
        {(error || validationError) && (
          <Alert
            type="error"
            dismissible
            dismissAriaLabel="Dismiss error message"
            onDismiss={() => {
              setError(null);
              setValidationError(null);
            }}
          >
            {error || validationError}
          </Alert>
        )}
        <ColumnLayout columns={3} variant="text-grid">
          <FormField
            label="Plan name"
            stretch
            errorText={fieldErrors.name}
          >
            <Input
              value={form.name}
              onChange={({ detail }) => setForm(current => ({ ...current, name: detail.value }))}
              placeholder="e.g. Skills Development 2025"
            />
          </FormField>
          <FormField label="Plan summary" stretch>
            <Textarea
              value={form.summary}
              rows={3}
              onChange={({ detail }) => setForm(current => ({ ...current, summary: detail.value }))}
              placeholder="High-level objective for this plan"
            />
          </FormField>
          <FormField label="Start date" stretch errorText={fieldErrors.startDate}>
            <DatePicker
              value={form.startDate}
              onChange={({ detail }) => setForm(current => ({ ...current, startDate: detail.value }))}
              placeholder="YYYY-MM-DD"
            />
          </FormField>
          <FormField
            label="Review date"
            stretch
            description="This will trigger a reminder on this date in the calendar."
            errorText={fieldErrors.reviewDate}
          >
            <DatePicker
              value={form.reviewDate}
              onChange={({ detail }) => setForm(current => ({ ...current, reviewDate: detail.value }))}
              placeholder="YYYY-MM-DD"
            />
          </FormField>
          <FormField
            label="Funding stream"
            description="Select funding stream for this action plan."
            errorText={fieldErrors.fundingStream}
          >
            <Select
              selectedOption={selectedFundingStream}
              options={fundingStreamSelectOptions}
              onChange={({ detail }) =>
                setForm(current => ({
                  ...current,
                  fundingStream: detail.selectedOption?.value || "",
                  agreementNumber: deriveAgreementNumberFromFundingStream(detail.selectedOption?.value || ""),
                }))
              }
              placeholder={fundingStreamsLoading ? "Loading funding streams" : "Select funding stream"}
              statusType={fundingStreamsLoading ? "loading" : "finished"}
              empty={fundingStreamsLoading ? undefined : "No funding streams available"}
            />
          </FormField>
          <FormField
            label="Agreement Number"
            description="Mapped automatically from funding stream (read-only)."
            errorText={fieldErrors.agreementNumber}
          >
            <Input value={form.agreementNumber} readOnly />
          </FormField>
          <FormField
            label="Budget pot"
            description="Select the budget pot for this action plan."
            errorText={fieldErrors.budgetPot}
          >
            <Select
              selectedOption={
                potOptions.find(opt => opt.value === form.budgetPot) ||
                (form.budgetPot ? { value: form.budgetPot, label: form.budgetPot } : null)
              }
              options={potOptions}
              onChange={({ detail }) => setForm(current => ({ ...current, budgetPot: detail.selectedOption?.value || "" }))}
              filteringType="auto"
              onLoadItems={({ detail }) => {
                if (detail?.filteringText !== undefined) {
                  loadPots(detail.filteringText);
                }
              }}
              placeholder={potLoading ? "Loading budget pots" : "Select budget pot"}
              statusType={potLoading ? "loading" : "finished"}
              empty={potLoading ? undefined : "No budget pots found"}
            />
          </FormField>
          <FormField label="EI claimant status" description="ESDC codes: claimant, reach-back, or non-insured.">
            <Select
              selectedOption={selectedEiClaimant}
              options={EI_CLAIMANT_OPTIONS}
              onChange={({ detail }) => setForm(current => ({ ...current, eiClaimant: detail.selectedOption?.value || "" }))}
              placeholder="Select EI status"
              invalid={Boolean(fieldErrors.eiClaimant)}
            />
          </FormField>
            <FormField
              label="Employment status at plan start"
              description="The client’s employment status at the start of this action plan"
              errorText={fieldErrors.prevEmployment}
            >
              <Select
                selectedOption={selectedPrevEmployment}
                options={PREV_EMPLOYMENT_OPTIONS}
                onChange={({ detail }) => setForm(current => ({ ...current, prevEmployment: detail.selectedOption?.value || "" }))}
                placeholder="Select status"
                invalid={Boolean(fieldErrors.prevEmployment)}
              />
            </FormField>
          {form.prevEmployment === "2" && (
            <>
              <FormField
                label="NOC Version"
                description="The version of National Occupation Code to use for lookup."
                errorText={fieldErrors.prevEmploymentNocVersion}
              >
                <Select
                  selectedOption={selectedPrevEmploymentNocVersion}
                  options={NOC_VERSION_OPTIONS}
                  onChange={({ detail }) => setForm(current => ({ ...current, prevEmploymentNocVersion: detail.selectedOption?.value || "" }))}
                  placeholder="Select NOC version"
                  invalid={Boolean(fieldErrors.prevEmploymentNocVersion)}
                />
              </FormField>
              <FormField
                label="NOC Code Lookup"
                description="Lookup the NOC Code for the client's employment."
                errorText={fieldErrors.prevEmploymentNoc}
              >
                <Autosuggest
                  value={form.prevEmploymentNoc || ""}
                  onChange={({ detail }) => setForm(current => ({ ...current, prevEmploymentNoc: detail.value }))}
                  onLoadItems={({ detail }) => handleNocSearch(detail.filteringText)}
                  options={nocOptions}
                  placeholder={form.prevEmploymentNocVersion ? "Search NOC code" : "Select NOC version first"}
                  empty="No matches"
                  filteringType="manual"
                  statusType={nocLoading ? "loading" : "finished"}
                  loadingText="Searching NOC codes"
                  expandToViewport
                  disabled={!form.prevEmploymentNocVersion}
                  invalid={Boolean(fieldErrors.prevEmploymentNoc)}
                />
              </FormField>
              <FormField
                label="Schedule type"
                description="Required when employment status is Employed."
                errorText={fieldErrors.prevEmploymentScheduleType}
              >
                <Select
                  selectedOption={SCHEDULE_OPTIONS.find(opt => opt.value === form.prevEmploymentScheduleType) || null}
                  options={SCHEDULE_OPTIONS}
                  onChange={({ detail }) =>
                    setForm(current => ({ ...current, prevEmploymentScheduleType: detail.selectedOption?.value || "" }))
                  }
                  placeholder="Select schedule type"
                  invalid={Boolean(fieldErrors.prevEmploymentScheduleType)}
                />
              </FormField>
            </>
          )}
          <FormField
            label="Education Level"
            description="Highest level of education attained at the time of creation of Action Plan."
          >
            <Select
              selectedOption={selectedEducationLevel}
              options={EDUCATION_OPTIONS}
              onChange={({ detail }) => setForm(current => ({ ...current, educationLevel: detail.selectedOption?.value || "" }))}
              placeholder="Select education level"
            />
          </FormField>
          <FormField
            label="Education Province"
            description="Province (or area outside Canada) in which the highest level of education was attained."
            errorText={fieldErrors.educationProvince}
          >
            <Select
              selectedOption={selectedEducationProvince}
              options={PROVINCE_OPTIONS}
              onChange={({ detail }) => setForm(current => ({ ...current, educationProvince: detail.selectedOption?.value || "" }))}
              placeholder="Select province/territory"
              invalid={Boolean(fieldErrors.educationProvince)}
            />
          </FormField>
          <FormField
            label="Social Assistance Recipient"
            description="Is the client a Social Assistance Recipient at the time of creation of the Action Plan?"
            errorText={fieldErrors.socialAssistanceRecipient}
          >
            <Select
              selectedOption={selectedSocialAssistance}
              options={YES_NO_OPTIONS}
              onChange={({ detail }) => setForm(current => ({ ...current, socialAssistanceRecipient: detail.selectedOption?.value || "" }))}
              placeholder="Select"
              invalid={Boolean(fieldErrors.socialAssistanceRecipient)}
            />
          </FormField>
          <FormField
            label="Childcare need"
            description="ESDC code 0 = No, 1 = Yes."
          >
            <Select
              selectedOption={selectedChildcareNeed}
              options={YES_NO_OPTIONS}
              onChange={({ detail }) => setForm(current => ({ ...current, childcareNeed: detail.selectedOption?.value || "" }))}
              placeholder="Select"
            />
          </FormField>
          <FormField
            label="Childcare funding"
            description="ESDC code 1–7."
            errorText={fieldErrors.childcareFunding}
          >
            <Select
              selectedOption={selectedChildcareFunding}
              options={CHILDCARE_FUNDING_OPTIONS}
              onChange={({ detail }) => setForm(current => ({ ...current, childcareFunding: detail.selectedOption?.value || "" }))}
              placeholder="Select"
              invalid={Boolean(fieldErrors.childcareFunding)}
            />
          </FormField>
        </ColumnLayout>
        <FormField label="Barriers to Employment" description="A client may have more than one (1) barrier to employment. Choose all that apply.">
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
        <Box>
          {isEdit ? (
            <SpaceBetween size="s">
              <SummaryPreview summary={form.summary} />
              <Box color="text-body-secondary">
                Update the summary above to adjust this plan&apos;s front-matter. Additional client details remain available in the workspace.
              </Box>
            </SpaceBetween>
          ) : (
            <ExpandableSection
              headerText="Client context"
              headerDescription="Expand to show the participant’s details to inform this action plan"
              defaultExpanded={false}
            >
              {renderContext()}
            </ExpandableSection>
          )}
        </Box>
      </SpaceBetween>
    </Modal>
  );
};

export default NewActionPlanModal;
