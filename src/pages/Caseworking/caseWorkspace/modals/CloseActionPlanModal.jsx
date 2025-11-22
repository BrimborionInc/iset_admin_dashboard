import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autosuggest,
  Box,
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  Select,
  SpaceBetween,
  Textarea,
} from "@cloudscape-design/components";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

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

const CloseActionPlanModal = ({
  visible,
  plan,
  submitting = false,
  error = null,
  onSubmit,
  onDismiss,
}) => {
  const { searchNocCodes } = useCaseWorkspace();
  const [selectedResult, setSelectedResult] = useState(null);
  const [resultDate, setResultDate] = useState("");
  const [resultEducation, setResultEducation] = useState("");
  const [futureEducation, setFutureEducation] = useState("");
  const [resultNocVersion, setResultNocVersion] = useState("");
  const [resultNoc, setResultNoc] = useState("");
  const [nocOptions, setNocOptions] = useState([]);
  const [nocLoading, setNocLoading] = useState(false);
  const [outcomeSummary, setOutcomeSummary] = useState("");
  const [closureNotes, setClosureNotes] = useState("");
  const [validationError, setValidationError] = useState(null);
  const [visibleError, setVisibleError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    const existingCode = plan?.resultCode ? String(plan.resultCode) : "";
    const matchedOption = RESULT_OPTIONS.find(option => option.value === existingCode) || null;
    setSelectedResult(matchedOption);
    setResultDate(plan?.resultDate || "");
    setResultEducation(plan?.resultEducationLevel ? String(plan.resultEducationLevel) : "");
    setFutureEducation(plan?.futureEducationLevel ? String(plan.futureEducationLevel) : "");
    setResultNoc(plan?.resultNoc || "");
    setResultNocVersion(plan?.resultNocVersion || "");
    setOutcomeSummary(plan?.outcomeSummary || "");
    setClosureNotes(plan?.closureNotes || "");
    setValidationError(null);
    setVisibleError(error || null);
  }, [visible, plan]);

  useEffect(() => {
    if (!visible) return;
    setVisibleError(error || null);
  }, [error, visible]);

  const planTitle = useMemo(() => plan?.title || plan?.name || "Action plan", [plan]);
  const startEducationCode = useMemo(
    () => (plan?.educationLevel ? String(plan.educationLevel) : ""),
    [plan?.educationLevel]
  );
  const filteredEducationOptions = useMemo(() => {
    if (!startEducationCode) return RESULT_EDUCATION_OPTIONS;
    const startNum = Number(startEducationCode);
    if (!Number.isFinite(startNum)) return RESULT_EDUCATION_OPTIONS;
    return RESULT_EDUCATION_OPTIONS.filter(opt => {
      const num = Number(opt.value);
      if (!Number.isFinite(num)) return false;
      return num >= startNum;
    });
  }, [startEducationCode]);
  const startEducationLabel = useMemo(() => {
    if (!startEducationCode) return "-";
    const opt = RESULT_EDUCATION_OPTIONS.find(o => o.value === startEducationCode);
    return opt ? opt.label : startEducationCode;
  }, [startEducationCode]);

  const handleNocSearch = useCallback(
    async query => {
      if (!resultNocVersion) {
        setNocOptions([]);
        return;
      }
      setNocLoading(true);
      try {
        const res = await searchNocCodes({ query, version: resultNocVersion });
        const opts = (res || []).map(item => ({
          value: item.code,
          label: `${item.code} — ${item.title}`,
          description: item.title,
        }));
        setNocOptions(opts);
      } finally {
        setNocLoading(false);
      }
    },
    [searchNocCodes, resultNocVersion]
  );

  const handleSubmit = () => {
    const finalResult = selectedResult?.value || "";
    if (!finalResult) {
      setValidationError("Select a result code.");
      return;
    }
    if (!resultDate) {
      setValidationError("Select a result date.");
      return;
    }
    if (finalResult && !resultEducation) {
      setValidationError("Select Action Plan Result Education Level.");
      return;
    }
    if (startEducationCode && resultEducation) {
      const startNum = Number(startEducationCode);
      const resultNum = Number(resultEducation);
      if (Number.isFinite(startNum) && Number.isFinite(resultNum) && resultNum < startNum) {
        setValidationError(
          `Result education cannot be lower than the starting level (${startEducationLabel}).`
        );
        return;
      }
    }
    if (finalResult === "4" && !futureEducation) {
      setValidationError("Select Future Education Level for Returned to school.");
      return;
    }
    if (finalResult === "2") {
      if (!resultNocVersion) {
        setValidationError("Select NOC version for employed result.");
        return;
      }
      if (!resultNoc) {
        setValidationError("Select NOC code for employed result.");
        return;
      }
    }
    setValidationError(null);
    onSubmit({
      resultCode: finalResult,
      resultDate,
      resultEducationLevel: resultEducation || null,
      futureEducationLevel: finalResult === "4" ? futureEducation || null : null,
      resultNocVersion: finalResult === "2" ? resultNocVersion || null : null,
      resultNoc: finalResult === "2" ? resultNoc || null : null,
      outcomeSummary: outcomeSummary.trim() || null,
      closureNotes: closureNotes.trim() || null,
    });
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      header="Close action plan"
      onDismiss={submitting ? null : onDismiss}
      closeAriaLabel="Dismiss close action plan modal"
      footer={
        <SpaceBetween size="xs" direction="horizontal">
          <Button onClick={onDismiss} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            Close plan
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="m">
        <Box fontWeight="bold">{planTitle}</Box>
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
        {visibleError && (
          <Alert
            type="error"
            dismissible
            dismissAriaLabel="Dismiss error message"
            onDismiss={() => setVisibleError(null)}
          >
            {visibleError}
          </Alert>
        )}
        <FormField label="Result">
          <Select
            selectedOption={selectedResult}
            onChange={({ detail }) => setSelectedResult(detail.selectedOption)}
            options={RESULT_OPTIONS}
            placeholder="Select result"
          />
        </FormField>
        <FormField label="Result date">
          <DatePicker
            value={resultDate}
            onChange={({ detail }) => setResultDate(detail.value)}
            placeholder="YYYY-MM-DD"
          />
        </FormField>
        <FormField
          label="Action Plan Result Education Level"
          description={`ESDC code for education level after plan completion. Starting level: ${startEducationLabel}. Cannot decrease.`}
        >
          <Select
            selectedOption={filteredEducationOptions.find(opt => opt.value === resultEducation) || null}
            options={filteredEducationOptions}
            onChange={({ detail }) => setResultEducation(detail.selectedOption?.value || "")}
            placeholder="Select education level"
          />
        </FormField>
        {selectedResult?.value === "4" && (
          <FormField label="Action Plan Future Education Level" description="Required when result is Returned to school.">
            <Select
              selectedOption={FUTURE_EDUCATION_OPTIONS.find(opt => opt.value === futureEducation) || null}
              options={FUTURE_EDUCATION_OPTIONS}
              onChange={({ detail }) => setFutureEducation(detail.selectedOption?.value || "")}
              placeholder="Select future education level"
            />
          </FormField>
        )}
        {selectedResult?.value === "2" && (
          <>
            <FormField label="Result NOC Version" description="Required when result is Employed.">
              <Select
                selectedOption={NOC_VERSION_OPTIONS.find(opt => opt.value === resultNocVersion) || null}
                options={NOC_VERSION_OPTIONS}
                onChange={({ detail }) => setResultNocVersion(detail.selectedOption?.value || "")}
                placeholder="Select NOC version"
              />
            </FormField>
            <FormField label="Result NOC code" description="Required when result is Employed.">
              <Autosuggest
                value={resultNoc}
                onChange={({ detail }) => setResultNoc(detail.value)}
                onLoadItems={({ detail }) => handleNocSearch(detail.filteringText)}
                options={nocOptions}
                placeholder={resultNocVersion ? "Search NOC code" : "Select NOC version first"}
                empty="No matches"
                filteringType="manual"
                statusType={nocLoading ? "loading" : "finished"}
                loadingText="Searching NOC codes"
                disabled={!resultNocVersion}
              />
            </FormField>
          </>
        )}
        <FormField label="Outcome summary (optional)">
          <Textarea
            value={outcomeSummary}
            rows={3}
            onChange={({ detail }) => setOutcomeSummary(detail.value)}
            placeholder="Summarize the plan outcome"
          />
        </FormField>
        <FormField label="Closure notes (optional)">
          <Textarea
            value={closureNotes}
            rows={3}
            onChange={({ detail }) => setClosureNotes(detail.value)}
            placeholder="Internal notes"
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
};

export default CloseActionPlanModal;
