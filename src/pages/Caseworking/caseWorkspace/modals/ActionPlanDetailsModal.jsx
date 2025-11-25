import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autosuggest,
  Box,
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

const defaultForm = {
  name: "",
  summary: "",
  startDate: "",
  reviewDate: "",
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
  const { updateActionPlan, searchNocCodes, caseData } = useCaseWorkspace();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [prevNocOptions, setPrevNocOptions] = useState([]);
  const [prevNocLoading, setPrevNocLoading] = useState(false);
  const [resultNocOptions, setResultNocOptions] = useState([]);
  const [resultNocLoading, setResultNocLoading] = useState(false);
  const [editEnabled, setEditEnabled] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  useEffect(() => {
    if (!visible || !plan) return;
    const status = (plan.status || "").toLowerCase();
    setEditEnabled(status !== "closed");
    setShowEditConfirm(false);
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
      agreementNumber: plan?.agreementNumber || "",
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
    setValidationError(null);
    setPrevNocOptions([]);
    setResultNocOptions([]);
  }, [visible, plan]);

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
    const digits = form.agreementNumber.replace(/\D/g, "");
    if (!form.name.trim()) return "Plan name is required.";
    if (!form.startDate) return "Start date is required.";
    if (form.startDate && form.reviewDate && form.reviewDate < form.startDate) return "Review date cannot be before start date.";
    if (!digits || digits.length < 7 || digits.length > 9) return "Agreement number must be 7–9 digits.";
    if (!form.socialAssistanceRecipient) return "Social assistance recipient is required.";
    if (!form.eiClaimant) return "EI claimant status is required.";
    if (!form.prevEmployment) return "Employment status at plan start is required.";
    if (form.prevEmployment === "2") {
      if (!form.prevEmploymentScheduleType) return "Schedule type is required when employment status is Employed.";
      if (!form.prevEmploymentNocVersion) return "NOC version is required when employment status is Employed.";
      if (!form.prevEmploymentNoc) return "NOC code is required when employment status is Employed.";
    }
    const childcareNeedCode = normaliseYesNoCode(form.childcareNeed);
    if (childcareNeedCode === "1" && !form.childcareFunding) return "Childcare funding is required when childcare need is Yes.";
    if (form.educationLevel && !form.educationProvince) return "Education province is required when education level is set.";
    const anyCloseout = form.resultCode || form.resultDate || form.resultEducationLevel || form.futureEducationLevel || form.resultNoc || form.resultNocVersion || form.outcomeSummary;
    if (anyCloseout) {
      if (!form.resultCode) return "Result code is required.";
      if (!form.resultDate) return "Result date is required.";
      if (!form.resultEducationLevel) return "Action Plan Result Education Level is required.";
      if (form.resultCode === "4" && !form.futureEducationLevel) return "Future education level is required for Returned to school.";
      if (form.resultCode === "2") {
        if (!form.resultNocVersion) return "Result NOC version is required for Employed.";
        if (!form.resultNoc) return "Result NOC code is required for Employed.";
        const len = form.resultNocVersion === "2021" ? 5 : 4;
        const digitsNoc = form.resultNoc.replace(/\D/g, "");
        if (digitsNoc.length !== len) return `Result NOC code must be ${len} digits for version ${form.resultNocVersion}.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!editEnabled) {
      setValidationError("Editing is disabled for closed action plans. Use Edit to enable changes.");
      return;
    }
    const validation = validate();
    if (validation) {
      setValidationError(validation);
      return;
    }
    setValidationError(null);
    setSaving(true);
    setError(null);
    try {
      const childcareNeedCode = normaliseYesNoCode(form.childcareNeed) || null;
      const childcareFundingCode =
        childcareNeedCode === "1" && CHILDCARE_FUNDING_OPTIONS.some(opt => opt.value === form.childcareFunding)
          ? form.childcareFunding
          : null;
      const payload = {
        name: form.name.trim(),
        startDate: form.startDate || null,
        reviewDate: form.reviewDate || null,
        summary: form.summary || null,
        agreementNumber: form.agreementNumber || null,
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
        allowClosedEdit: isClosed ? true : undefined,
      };
      const updated = await updateActionPlan(plan.id, payload);
      setSaving(false);
      setEditEnabled(false);
      if (onSaved) onSaved(updated);
    } catch (err) {
      setSaving(false);
      setError(err?.message || "Failed to update action plan.");
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
                      onDismiss();
                    }
              }
              disabled={saving}
            >
              Close
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
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={saving}
              disabled={isClosed && !editEnabled}
            >
              Save changes
            </Button>
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

        <ColumnLayout columns={3} variant="text-grid">
          <FormField label="Plan name">
            <Input
              value={form.name}
              readOnly={isClosed && !editEnabled}
              onChange={({ detail }) => setForm(curr => ({ ...curr, name: detail.value }))}
            />
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
          <FormField label="Start date" description="When the plan becomes active.">
            <DatePicker
              value={form.startDate}
              disabled={isClosed && !editEnabled}
              onChange={({ detail }) => setForm(curr => ({ ...curr, startDate: detail.value }))}
              placeholder="YYYY-MM-DD"
            />
          </FormField>
          <FormField
            label="Review date"
            description="This will trigger a reminder on this date in the calendar."
          >
            <DatePicker
              value={form.reviewDate}
              disabled={isClosed && !editEnabled}
              onChange={({ detail }) => setForm(curr => ({ ...curr, reviewDate: detail.value }))}
              placeholder="YYYY-MM-DD"
            />
          </FormField>
          <FormField label="Agreement Number" description="Agreement number (EI or CRF).">
            <Input
              value={form.agreementNumber}
              readOnly={isClosed && !editEnabled}
              onChange={({ detail }) => setForm(curr => ({ ...curr, agreementNumber: detail.value }))}
              placeholder="e.g. 999999999"
            />
          </FormField>
          <FormField label="EI claimant status" description="ESDC codes: claimant, reach-back, or non-insured.">
            <Select
              selectedOption={selectedEiClaimant}
              options={EI_CLAIMANT_OPTIONS}
              onChange={({ detail }) => setForm(curr => ({ ...curr, eiClaimant: detail.selectedOption?.value || "" }))}
              placeholder="Select EI status"
            />
          </FormField>
          <FormField
            label="Employment status at plan start"
            description="The client’s employment status at the start of this action plan"
          >
            <Select
              selectedOption={selectedPrevEmployment}
              options={PREV_EMPLOYMENT_OPTIONS}
              onChange={({ detail }) => setForm(curr => ({ ...curr, prevEmployment: detail.selectedOption?.value || "" }))}
              placeholder="Select status"
            />
          </FormField>
          {form.prevEmployment === "2" && (
            <>
              <FormField label="NOC Version" description="The version of National Occupation Code to use for lookup.">
                <Select
                  selectedOption={selectedPrevEmploymentNocVersion}
                  options={NOC_VERSION_OPTIONS}
                  onChange={({ detail }) => setForm(curr => ({ ...curr, prevEmploymentNocVersion: detail.selectedOption?.value || "" }))}
                  placeholder="Select NOC version"
                />
              </FormField>
              <FormField label="NOC Code Lookup" description="Lookup the NOC Code for the client's employment.">
                <Autosuggest
                  value={form.prevEmploymentNoc || ""}
                  onChange={({ detail }) => setForm(curr => ({ ...curr, prevEmploymentNoc: detail.value }))}
                  onLoadItems={({ detail }) => handlePrevNocSearch(detail.filteringText)}
                  options={prevNocOptions}
                  placeholder={form.prevEmploymentNocVersion ? "Search NOC code" : "Select NOC version first"}
                  empty="No matches"
                  filteringType="manual"
                  statusType={prevNocLoading ? "loading" : "finished"}
                  loadingText="Searching NOC codes"
                  expandToViewport
                  disabled={!form.prevEmploymentNocVersion}
                />
              </FormField>
              <FormField label="Schedule type" description="Required when employment status is Employed.">
                <Select
                  selectedOption={SCHEDULE_OPTIONS.find(opt => opt.value === form.prevEmploymentScheduleType) || null}
                  options={SCHEDULE_OPTIONS}
                  onChange={({ detail }) => setForm(curr => ({ ...curr, prevEmploymentScheduleType: detail.selectedOption?.value || "" }))}
                  placeholder="Select schedule type"
                />
              </FormField>
            </>
          )}
          <FormField label="Education Level" description="Highest level of education attained at the time of creation of Action Plan.">
            <Select
              selectedOption={selectedEducationLevel}
              options={EDUCATION_OPTIONS}
              onChange={({ detail }) => setForm(curr => ({ ...curr, educationLevel: detail.selectedOption?.value || "" }))}
              placeholder="Select education level"
            />
          </FormField>
          <FormField label="Education Province" description="Province (or area outside Canada) in which the highest level of education was attained.">
            <Select
              selectedOption={selectedEducationProvince}
              options={PROVINCE_OPTIONS}
              onChange={({ detail }) => setForm(curr => ({ ...curr, educationProvince: detail.selectedOption?.value || "" }))}
              placeholder="Select province/territory"
            />
          </FormField>
          <FormField label="Social Assistance Recipient" description="Is the client a Social Assistance Recipient at the time of creation of the Action Plan?">
            <Select
              selectedOption={selectedSocialAssistance}
              options={YES_NO_OPTIONS}
              onChange={({ detail }) => setForm(curr => ({ ...curr, socialAssistanceRecipient: detail.selectedOption?.value || "" }))}
              placeholder="Select"
            />
          </FormField>
          <FormField label="Childcare need" description="ESDC code 0 = No, 1 = Yes.">
            <Select
              selectedOption={selectedChildcareNeed}
              options={YES_NO_OPTIONS}
              onChange={({ detail }) => setForm(curr => ({ ...curr, childcareNeed: detail.selectedOption?.value || "" }))}
              placeholder="Select"
            />
          </FormField>
          <FormField label="Childcare funding" description="ESDC code 1–7.">
            <Select
              selectedOption={selectedChildcareFunding}
              options={CHILDCARE_FUNDING_OPTIONS}
              onChange={({ detail }) => setForm(curr => ({ ...curr, childcareFunding: detail.selectedOption?.value || "" }))}
              placeholder="Select"
            />
          </FormField>
        </ColumnLayout>
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

        {(plan?.status === "closed" || form.resultCode || form.resultDate || form.outcomeSummary || form.closureNotes) && (
          <ExpandableSection
            headerText="Closeout details"
            headerDescription="Result, education, and NOC details for closing this action plan."
            defaultExpanded={false}
          >
          <SpaceBetween size="m">
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Result code">
                <Select
                  selectedOption={selectedResultCode}
                  options={RESULT_OPTIONS}
                  onChange={({ detail }) => setForm(curr => ({ ...curr, resultCode: detail.selectedOption?.value || "" }))}
                  placeholder="Select result"
                />
              </FormField>
              <FormField label="Result date">
                <DatePicker
                  value={form.resultDate}
                  onChange={({ detail }) => setForm(curr => ({ ...curr, resultDate: detail.value }))}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <FormField
                label="Action Plan Result Education Level"
                description={`ESDC code after completion. Participant level at plan start: ${displayValue(plan.educationLevel) || "-"}. Result cannot be lower than start.`}
              >
                <Select
                  selectedOption={selectedResultEducation}
                  options={RESULT_EDUCATION_OPTIONS}
                  onChange={({ detail }) => setForm(curr => ({ ...curr, resultEducationLevel: detail.selectedOption?.value || "" }))}
                  placeholder="Select education level"
                />
              </FormField>
              {form.resultCode === "4" && (
                <FormField label="Action Plan Future Education Level" description="Required when Returned to school.">
                  <Select
                    selectedOption={selectedFutureEducation}
                    options={FUTURE_EDUCATION_OPTIONS}
                    onChange={({ detail }) => setForm(curr => ({ ...curr, futureEducationLevel: detail.selectedOption?.value || "" }))}
                    placeholder="Select future education level"
                  />
                </FormField>
              )}
              {form.resultCode === "2" && (
                <>
                  <FormField label="Result NOC Version" description="Required when result is Employed.">
                    <Select
                      selectedOption={selectedResultNocVersion}
                      options={NOC_VERSION_OPTIONS}
                      onChange={({ detail }) => setForm(curr => ({ ...curr, resultNocVersion: detail.selectedOption?.value || "" }))}
                      placeholder="Select NOC version"
                    />
                  </FormField>
                  <FormField label="Result NOC code" description="Required when result is Employed.">
                  <Autosuggest
                    value={form.resultNoc}
                    onChange={({ detail }) => setForm(curr => ({ ...curr, resultNoc: detail.value }))}
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

        <ExpandableSection
          headerText="Metadata"
          headerDescription="Read-only action plan metadata."
          defaultExpanded={false}
        >
          <ColumnLayout columns={3} variant="text-grid">
            <FormField label="Status">
              <Input value={displayValue(plan.status)} readOnly />
            </FormField>
            <FormField label="Interventions">
              <Input value={displayValue(metadata.interventionCount)} readOnly />
            </FormField>
            <FormField label="Case ID">
              <Input value={displayValue(metadata.caseId)} readOnly />
            </FormField>
            <FormField label="Created at">
              <Input value={displayValue(metadata.createdAt)} readOnly />
            </FormField>
            <FormField label="Last updated">
              <Input value={displayValue(metadata.updatedAt)} readOnly />
            </FormField>
            <FormField label="Assigned to">
              <Input value={displayValue(metadata.owner)} readOnly />
            </FormField>
            <FormField label="Activated at">
              <Input value={displayValue(metadata.activatedAt)} readOnly />
            </FormField>
            <FormField label="Closed at">
              <Input value={displayValue(metadata.closedAt)} readOnly />
            </FormField>
            <FormField label="Archived at">
              <Input value={displayValue(metadata.archivedAt)} readOnly />
            </FormField>
          </ColumnLayout>
        </ExpandableSection>
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
    </>
  );
};

export default ActionPlanDetailsModal;
