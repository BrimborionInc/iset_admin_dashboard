import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ColumnLayout,
  DatePicker,
  FormField,
  Input,
  Modal,
  SpaceBetween,
  Spinner,
  Textarea,
} from "@cloudscape-design/components";
import useCurrentUser from "../../../../hooks/useCurrentUser.js";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import {
  formatBarriers,
  formatEducationLevel,
  formatLabourForceStatus,
  formatLocalPriorities,
} from "../utils/isetOptionLabels.js";

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

const defaultForm = {
  name: "",
  startDate: "",
  reviewDate: "",
  summary: "",
};

const NewActionPlanModal = ({
  visible,
  mode = "create",
  plan = null,
  onDismiss,
  onCreated,
  onSaved,
}) => {
  const { createActionPlan, updateActionPlan, fetchActionPlanContext, upsertActionPlanReviewReminder, caseData } = useCaseWorkspace();
  const currentUser = useCurrentUser();
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState(null);
  const isEdit = mode === "edit" && plan;

  useEffect(() => {
    if (!visible) {
      setForm(defaultForm);
      setError(null);
      return;
    }
    if (isEdit) {
      setForm({
        name: plan?.title || plan?.name || "",
        startDate: plan?.startDate || "",
        reviewDate: plan?.endDate || "",
        summary: plan?.summary || "",
      });
    } else {
      setForm(defaultForm);
    }
  }, [visible, isEdit, plan]);

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

  const handleSubmit = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setError("Plan name is required.");
      return;
    }
    if (!form.startDate && !isEdit) {
      setError("Start date is required.");
      return;
    }
    if (form.startDate && form.reviewDate && form.reviewDate < form.startDate) {
      setError("Review date cannot be before start date.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isEdit) {
        const updated = await updateActionPlan(plan.id, {
          name: trimmedName,
          startDate: form.startDate || null,
          reviewDate: form.reviewDate || null,
          summary: form.summary || null,
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
    onDismiss();
  };

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
        <Box>
          <ReadOnlyItem label="Employment barriers" value={employmentBarriers} />
          <ReadOnlyItem label="Local area priorities" value={localPriorities} />
          <ReadOnlyItem label="Previous ISET" value={formatBoolean(details.previousIset)} />
          <ReadOnlyItem label="Previous ISET details" value={details.previousIsetDetails || "-"} />
          <ReadOnlyItem label="Other funding" value={details.otherFunding || "-"} />
        </Box>
      </ColumnLayout>
    );
  };

  return (
    <Modal
      visible={visible}
      header={isEdit ? "Edit action plan" : "New action plan"}
      onDismiss={handleDismiss}
      closeAriaLabel={isEdit ? "Close edit action plan modal" : "Close new action plan modal"}
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
        <ColumnLayout columns={2} variant="text-grid">
          <FormField label="Plan name" stretch>
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
          <FormField label="Start date" stretch>
            <DatePicker
              value={form.startDate}
              onChange={({ detail }) => setForm(current => ({ ...current, startDate: detail.value }))}
              placeholder="YYYY-MM-DD"
            />
          </FormField>
          <FormField label="Review date" stretch>
            <DatePicker
              value={form.reviewDate}
              onChange={({ detail }) => setForm(current => ({ ...current, reviewDate: detail.value }))}
              placeholder="YYYY-MM-DD"
            />
          </FormField>
        </ColumnLayout>
        <Box>
          <h4 style={{ marginBottom: "0.5rem" }}>Client context</h4>
          {isEdit ? (
            <SpaceBetween size="s">
              <SummaryPreview summary={form.summary} />
              <Box color="text-body-secondary">
                Update the summary above to adjust this plan&apos;s front-matter. Additional client details remain available in the workspace.
              </Box>
            </SpaceBetween>
          ) : (
            renderContext()
          )}
        </Box>
      </SpaceBetween>
    </Modal>
  );
};

export default NewActionPlanModal;
