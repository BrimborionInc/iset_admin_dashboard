import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
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

const RESULT_OPTIONS = [
  { value: "ready_for_work", label: "Ready for work" },
  { value: "found_employment", label: "Found employment" },
  { value: "returned_to_school", label: "Returned to school" },
  { value: "stay_in_school", label: "Stay in school" },
  { value: "other", label: "Other (specify)" },
];

const CloseActionPlanModal = ({
  visible,
  plan,
  submitting = false,
  error = null,
  onSubmit,
  onDismiss,
}) => {
  const [selectedResult, setSelectedResult] = useState(null);
  const [customResult, setCustomResult] = useState("");
  const [resultDate, setResultDate] = useState("");
  const [outcomeSummary, setOutcomeSummary] = useState("");
  const [closureNotes, setClosureNotes] = useState("");
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    const existingCode = plan?.resultCode || "";
    const matchedOption = RESULT_OPTIONS.find(option => option.value === existingCode);
    if (matchedOption) {
      setSelectedResult(matchedOption);
      setCustomResult("");
    } else if (existingCode) {
      setSelectedResult(RESULT_OPTIONS.find(option => option.value === "other") || null);
      setCustomResult(existingCode);
    } else {
      setSelectedResult(null);
      setCustomResult("");
    }
    setResultDate(plan?.resultDate || "");
    setOutcomeSummary(plan?.outcomeSummary || "");
    setClosureNotes(plan?.closureNotes || "");
    setValidationError(null);
  }, [visible, plan]);

  const planTitle = useMemo(() => plan?.title || plan?.name || "Action plan", [plan]);

  const handleSubmit = () => {
    const finalResult =
      selectedResult?.value === "other"
        ? customResult.trim()
        : selectedResult?.value || "";
    if (!finalResult) {
      setValidationError("Select a result code.");
      return;
    }
    if (!resultDate) {
      setValidationError("Select a result date.");
      return;
    }
    setValidationError(null);
    onSubmit({
      resultCode: finalResult,
      resultDate,
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
          <Alert type="error" onDismiss={() => setValidationError(null)}>
            {validationError}
          </Alert>
        )}
        {error && (
          <Alert type="error">
            {error}
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
        {selectedResult?.value === "other" && (
          <FormField label="Specify result">
            <Input
              value={customResult}
              placeholder="Enter result code"
              onChange={({ detail }) => setCustomResult(detail.value)}
            />
          </FormField>
        )}
        <FormField label="Result date">
          <DatePicker
            value={resultDate}
            onChange={({ detail }) => setResultDate(detail.value)}
            placeholder="YYYY-MM-DD"
          />
        </FormField>
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
