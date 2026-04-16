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
  const [fieldErrors, setFieldErrors] = useState({});

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
    setFieldErrors({});
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
    const errors = {};
    if (!finalResult) {
      errors.result = "Select a result code.";
    }
    if (!resultDate) {
      errors.resultDate = "Select a result date.";
    }
    if (finalResult && !resultEducation) {
      errors.resultEducation = "Select Action Plan Result Education Level.";
    }
    if (startEducationCode && resultEducation) {
      const startNum = Number(startEducationCode);
      const resultNum = Number(resultEducation);
      if (Number.isFinite(startNum) && Number.isFinite(resultNum) && resultNum < startNum) {
        errors.resultEducation = `Result education cannot be lower than the starting level (${startEducationLabel}).`;
      }
    }
    if (finalResult === "4" && !futureEducation) {
      errors.futureEducation = "Select Future Education Level for Returned to school.";
    }
    if (finalResult === "2") {
      if (!resultNocVersion) {
        errors.resultNocVersion = "Select NOC version for employed result.";
      }
      if (!resultNoc) {
        errors.resultNoc = "Select NOC code for employed result.";
      }
    }
    if (resultDate) {
      const toDateOnly = value => {
        if (!value) return null;
        const trimmed = String(value).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().slice(0, 10);
      };
      const planStart = plan?.startDate || plan?.effectiveDate || null;
      const latestInterventionEnd = Array.isArray(plan?.interventions)
        ? plan.interventions
            .filter(item => {
              const status = String(item?.status || "").toLowerCase();
              return status !== "draft" && status !== "submitted";
            })
            .map(item => item?.endDate || item?.end_date || null)
            .filter(Boolean)
            .sort()
            .pop()
        : null;
      const resultDay = toDateOnly(resultDate);
      const planStartDay = toDateOnly(planStart);
      const latestEndDay = toDateOnly(latestInterventionEnd);
      const today = toDateOnly(new Date());
      if (planStartDay && resultDay && resultDay < planStartDay) {
        errors.resultDate = "Result date cannot be before the action plan start date.";
      }
      if (latestEndDay && resultDay && resultDay < latestEndDay) {
        errors.resultDate = "Result date cannot be before the latest intervention end date.";
      }
      if (today && resultDay && resultDay > today) {
        errors.resultDate = "Result date cannot be in the future.";
      }
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setValidationError(Object.values(errors)[0]);
      return;
    }
    setFieldErrors({});
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
        <FormField label="Result" errorText={fieldErrors.result}>
          <Select
            selectedOption={selectedResult}
            onChange={({ detail }) => {
              setFieldErrors(prev => {
                const next = { ...prev };
                delete next.result;
                return next;
              });
              setSelectedResult(detail.selectedOption);
            }}
            options={RESULT_OPTIONS}
            placeholder="Select result"
          />
        </FormField>
        <FormField label="Result date" errorText={fieldErrors.resultDate}>
          <DatePicker
            value={resultDate}
            onChange={({ detail }) => {
              setFieldErrors(prev => {
                const next = { ...prev };
                delete next.resultDate;
                return next;
              });
              setResultDate(detail.value);
            }}
            placeholder="YYYY-MM-DD"
          />
        </FormField>
        <FormField
          label="Action Plan Result Education Level"
          description={`ESDC code for education level after plan completion. Starting level: ${startEducationLabel}. Cannot decrease.`}
          errorText={fieldErrors.resultEducation}
        >
          <Select
            selectedOption={filteredEducationOptions.find(opt => opt.value === resultEducation) || null}
            options={filteredEducationOptions}
            onChange={({ detail }) => {
              setFieldErrors(prev => {
                const next = { ...prev };
                delete next.resultEducation;
                return next;
              });
              setResultEducation(detail.selectedOption?.value || "");
            }}
            placeholder="Select education level"
          />
        </FormField>
        {selectedResult?.value === "4" && (
          <FormField
            label="Action Plan Future Education Level"
            description="Required when result is Returned to school."
            errorText={fieldErrors.futureEducation}
          >
            <Select
              selectedOption={FUTURE_EDUCATION_OPTIONS.find(opt => opt.value === futureEducation) || null}
              options={FUTURE_EDUCATION_OPTIONS}
              onChange={({ detail }) => {
                setFieldErrors(prev => {
                  const next = { ...prev };
                  delete next.futureEducation;
                  return next;
                });
                setFutureEducation(detail.selectedOption?.value || "");
              }}
              placeholder="Select future education level"
            />
          </FormField>
        )}
        {selectedResult?.value === "2" && (
          <>
            <FormField
              label="Result NOC Version"
              description="Required when result is Employed."
              errorText={fieldErrors.resultNocVersion}
            >
              <Select
                selectedOption={NOC_VERSION_OPTIONS.find(opt => opt.value === resultNocVersion) || null}
                options={NOC_VERSION_OPTIONS}
                onChange={({ detail }) => {
                  setFieldErrors(prev => {
                    const next = { ...prev };
                    delete next.resultNocVersion;
                    return next;
                  });
                  setResultNocVersion(detail.selectedOption?.value || "");
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
                value={resultNoc}
                onChange={({ detail }) => {
                  setFieldErrors(prev => {
                    const next = { ...prev };
                    delete next.resultNoc;
                    return next;
                  });
                  setResultNoc(detail.value);
                }}
                onLoadItems={({ detail }) => handleNocSearch(detail.filteringText)}
                options={nocOptions}
                placeholder={resultNocVersion ? "Search NOC code" : "Select NOC version first"}
                empty="No matches"
                filteringType="manual"
                statusType={nocLoading ? "loading" : "finished"}
                loadingText="Searching NOC codes"
                expandToViewport
                disabled={!resultNocVersion}
                spellcheck={false}
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
            spellcheck={true}
          />
        </FormField>
        <FormField label="Closure notes (optional)">
          <Textarea
            value={closureNotes}
            rows={3}
            onChange={({ detail }) => setClosureNotes(detail.value)}
            placeholder="Internal notes"
            spellcheck={true}
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
};

export default CloseActionPlanModal;
