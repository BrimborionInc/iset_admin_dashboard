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
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import {
  formatBarriers,
  formatEducationLevel,
  formatLabourForceStatus,
  formatLocalPriorities,
} from "../utils/isetOptionLabels.js";

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

const statusType = status => {
  switch ((status || "").toLowerCase()) {
    case "draft":
      return "pending";
    case "active":
      return "info";
    case "closed":
      return "success";
    case "archived":
      return "stopped";
    default:
      return "info";
  }
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
  const { updateActionPlan, fetchActionPlanContext, upsertActionPlanReviewReminder, caseData } = useCaseWorkspace();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", summary: "", startDate: "", reviewDate: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);

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
  }, [visible, fetchActionPlanContext]);

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
      await upsertActionPlanReviewReminder({ ...plan, ...updated }, form.reviewDate || null);
      setSaving(false);
      setEditing(false);
      if (onSaved) onSaved(updated);
    } catch (err) {
      setSaving(false);
      setError(err?.message || "Failed to update action plan.");
    }
  };

  const employmentContext = useMemo(() => {
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

    return {
      employmentGoals,
      employmentStatus,
      educationLevel,
      employmentBarriers,
      localPriorities,
      details,
    };
  }, [context]);

  if (!visible || !plan) {
    return null;
  }

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
              value={caseData?.caseNumber || caseData?.trackingId || plan.caseId || "-"}
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
              <ReadOnlyField
                label="Employment goals"
                description="Applicant’s stated goals and context."
                value={employmentContext.employmentGoals}
                multiline
                rows={3}
              />
              <ReadOnlyField label="Employment status" description="Current employment situation." value={employmentContext.employmentStatus} />
              <ReadOnlyField label="Education level" description="Highest completed education." value={employmentContext.educationLevel} />
              <ReadOnlyField label="Employment NOC" description="NOC code provided in application." value={employmentContext.details?.employmentNoc || "-"} />
              <ReadOnlyField label="Employment NOC version" description="NOC version associated to the code." value={employmentContext.details?.employmentNocVersion || "-"} />
              <ReadOnlyField label="Social assistance" description="Receiving social assistance." value={formatBoolean(employmentContext.details?.socialAssistance)} />
              <ReadOnlyField label="Employment insurance" description="Employment insurance status." value={formatBoolean(employmentContext.details?.employmentInsurance)} />
              <ReadOnlyField label="Childcare need" description="Whether childcare support is needed." value={formatBoolean(employmentContext.details?.childcareNeed)} />
              <ReadOnlyField label="Childcare funding" description="Details on childcare funding." value={employmentContext.details?.childcareFunding || "-"} />
              <ReadOnlyField label="Employment barriers" description="Barriers identified by the applicant." value={employmentContext.employmentBarriers} multiline rows={3} />
              <ReadOnlyField label="Local area priorities" description="Priority categories relevant to this case." value={employmentContext.localPriorities} />
              <ReadOnlyField label="Previous ISET" description="Has the applicant used ISET before." value={formatBoolean(employmentContext.details?.previousIset)} />
              <ReadOnlyField label="Previous ISET details" description="Context on prior ISET participation." value={employmentContext.details?.previousIsetDetails || "-"} multiline rows={2} />
              <ReadOnlyField label="Other funding" description="Additional funding noted in the application." value={employmentContext.details?.otherFunding || "-"} multiline rows={2} />
            </ColumnLayout>
          )}
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default ActionPlanDetailsModal;
