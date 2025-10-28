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
  StatusIndicator,
  Textarea,
} from "@cloudscape-design/components";
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

const ActionPlanDetailsModal = ({ visible, plan, onDismiss, onSaved }) => {
  const { updateActionPlan, fetchActionPlanContext } = useCaseWorkspace();
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
      startDate: plan?.startDate || "",
      reviewDate: plan?.endDate || "",
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
        startDate: form.startDate || null,
        reviewDate: form.reviewDate || null,
        summary: form.summary || null,
      });
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
      footer={footer}
    >
      <SpaceBetween size="l">
        {error && (
          <Alert type="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <ColumnLayout columns={2} variant="text-grid">
          <FormField label="Plan name">
            {editing ? (
              <Input
                value={form.name}
                onChange={({ detail }) => setForm(current => ({ ...current, name: detail.value }))}
              />
            ) : (
              <Box>{form.name || "Untitled"}</Box>
            )}
          </FormField>
          <FormField label="Plan summary">
            {editing ? (
              <Textarea
                value={form.summary}
                rows={3}
                onChange={({ detail }) => setForm(current => ({ ...current, summary: detail.value }))}
                placeholder="High-level objective for this plan"
              />
            ) : (
              <Box style={{ whiteSpace: "pre-wrap" }}>{form.summary || "-"}</Box>
            )}
          </FormField>
          <FormField label="Start date">
            {editing ? (
              <DatePicker
                value={form.startDate}
                onChange={({ detail }) => setForm(current => ({ ...current, startDate: detail.value }))}
                placeholder="YYYY-MM-DD"
              />
            ) : (
              <Box>{formatDateDisplay(form.startDate)}</Box>
            )}
          </FormField>
          <FormField label="Review date">
            {editing ? (
              <DatePicker
                value={form.reviewDate}
                onChange={({ detail }) => setForm(current => ({ ...current, reviewDate: detail.value }))}
                placeholder="YYYY-MM-DD"
              />
            ) : (
              <Box>{formatDateDisplay(form.reviewDate)}</Box>
            )}
          </FormField>
        </ColumnLayout>

        <ColumnLayout columns={2} variant="text-grid">
          <Box>
            <ReadOnlyItem
              label="Status"
              value={
                <StatusIndicator type={statusType(plan.status)}>
                  {plan.status || "unknown"}
                </StatusIndicator>
              }
            />
            <ReadOnlyItem label="Activated at" value={formatDateTimeDisplay(plan.activatedAt)} />
            <ReadOnlyItem label="Closed at" value={formatDateTimeDisplay(plan.closedAt)} />
            <ReadOnlyItem label="Archived at" value={formatDateTimeDisplay(plan.archivedAt)} />
            <ReadOnlyItem label="Result code" value={plan.resultCode || "-"} />
            <ReadOnlyItem label="Result date" value={formatDateDisplay(plan.resultDate)} />
          </Box>
          <Box>
            <ReadOnlyItem label="Outcome summary" value={plan.outcomeSummary || "-"} />
            <ReadOnlyItem label="Closure notes" value={plan.closureNotes || "-"} />
            <ReadOnlyItem label="Interventions" value={Number.isFinite(plan.interventionCount) ? plan.interventionCount : "-"} />
            <ReadOnlyItem label="Created at" value={formatDateTimeDisplay(plan.createdAt)} />
            <ReadOnlyItem label="Last updated" value={formatDateTimeDisplay(plan.updatedAt)} />
            <ReadOnlyItem label="Case ID" value={plan.caseId || "-"} />
            <ReadOnlyItem label="Owner staff profile ID" value={plan.ownerStaffProfileId || "-"} />
            <ReadOnlyItem label="Owner user ID" value={plan.ownerUserId || "-"} />
          </Box>
        </ColumnLayout>

        <Box>
          <h4 style={{ marginBottom: "0.5rem" }}>Client context</h4>
          {contextLoading ? (
            <Box padding="m">
              <Spinner />
            </Box>
          ) : (
            <ColumnLayout columns={2} variant="text-grid">
              <Box>
                <ReadOnlyItem label="Employment goals" value={employmentContext.employmentGoals} />
                <ReadOnlyItem label="Employment status" value={employmentContext.employmentStatus} />
                <ReadOnlyItem label="Employment NOC" value={employmentContext.details?.employmentNoc || "-"} />
                <ReadOnlyItem label="Employment NOC version" value={employmentContext.details?.employmentNocVersion || "-"} />
              </Box>
              <Box>
                <ReadOnlyItem label="Education level" value={employmentContext.educationLevel} />
                <ReadOnlyItem label="Social assistance" value={formatBoolean(employmentContext.details?.socialAssistance)} />
                <ReadOnlyItem label="Employment insurance" value={formatBoolean(employmentContext.details?.employmentInsurance)} />
                <ReadOnlyItem label="Childcare need" value={formatBoolean(employmentContext.details?.childcareNeed)} />
                <ReadOnlyItem label="Childcare funding" value={employmentContext.details?.childcareFunding || "-"} />
              </Box>
              <Box>
                <ReadOnlyItem label="Employment barriers" value={employmentContext.employmentBarriers} />
                <ReadOnlyItem label="Local area priorities" value={employmentContext.localPriorities} />
                <ReadOnlyItem label="Previous ISET" value={formatBoolean(employmentContext.details?.previousIset)} />
                <ReadOnlyItem label="Previous ISET details" value={employmentContext.details?.previousIsetDetails || "-"} />
                <ReadOnlyItem label="Other funding" value={employmentContext.details?.otherFunding || "-"} />
              </Box>
            </ColumnLayout>
          )}
        </Box>
      </SpaceBetween>
    </Modal>
  );
};

export default ActionPlanDetailsModal;
