import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Link,
  FormField,
  Select,
  Input,
  Textarea,
  ColumnLayout,
  Box,
  StatusIndicator,
  Button,
  Alert,
  Modal,
  Table,
  FileUpload,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { apiFetch } from "../../../auth/apiClient";

const DEFAULT_STATE = {
  sourcePot: null,
  destinationPot: null,
  amount: "",
  effectiveDate: "",
  justification: "",
  tags: "",
};

const formatCurrency = value =>
  Number.isFinite(value) ? `$${value.toLocaleString("en-CA")}` : "-";

const formatCurrencyDisplay = value => {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) return value;
  return `$${num.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

const AllocationTransferWizardWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  prefillRequest,
  onPrefillConsumed,
  potOptions = [],
  potMetrics = {},
  createAllocation,
  refreshAllocations,
}) => {
  const [formState, setFormState] = useState(DEFAULT_STATE);
  const [lastSubmission, setLastSubmission] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [errors, setErrors] = useState({});
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [newEvidenceLabel, setNewEvidenceLabel] = useState("");
  const [newEvidenceType, setNewEvidenceType] = useState("");
  const [newEvidenceUploads, setNewEvidenceUploads] = useState([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [evidenceModalError, setEvidenceModalError] = useState(null);
  const [editingEvidenceId, setEditingEvidenceId] = useState(null);
  const [editingExistingAttachments, setEditingExistingAttachments] = useState([]);
  const [validationState, setValidationState] = useState({ status: "idle", violations: [], message: null });
  const validationAbortRef = useRef(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const cleanupAttachments = async (attachments = []) => {
    const targets = (attachments || []).filter(att => att && att.key);
    if (!targets.length) return;
    await Promise.all(
      targets.map(async att => {
        try {
          await apiFetch("/api/allocations/evidence/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: att.key }),
          });
        } catch (_) {
          /* swallow cleanup errors */
        }
      })
    );
  };

  const uploadEvidenceFile = async file => {
    if (!file) return null;
    if (file.size > MAX_EVIDENCE_BYTES) {
      throw new Error("Files must be 5 MB or less.");
    }
    const formData = new FormData();
    formData.append("file", file);
    if (newEvidenceLabel.trim()) formData.append("label", newEvidenceLabel.trim());
    if (newEvidenceType.trim()) formData.append("documentType", newEvidenceType.trim());
    const response = await apiFetch("/api/allocations/evidence/upload", {
      method: "POST",
      body: formData,
    });
    if (!response || !response.ok) {
      let payload = null;
      try { payload = await response.json(); } catch (_) { payload = null; }
      const message = payload?.message || payload?.error || "Upload failed.";
      throw new Error(message);
    }
    let payload = null;
    try { payload = await response.json(); } catch (_) { payload = null; }
    return {
      key: payload.key,
      url: payload.url || null,
      name: payload.name || file.name,
      size: payload.size || file.size,
      type: payload.type || file.type || null,
    };
  };
  const resetForm = (options = {}) => {
    const { cleanupUploads = false } = options;
    if (cleanupUploads) {
      cleanupAttachments(evidenceItems.flatMap(item => item.attachments || []));
    }
    setFormState(DEFAULT_STATE);
    setValidationState({ status: "idle", violations: [], message: null });
    setSuccessMessage(null);
    setEvidenceItems([]);
    setNewEvidenceLabel("");
    setNewEvidenceType("");
    setNewEvidenceUploads([]);
    setErrors({});
    setSubmitError(null);
    setEditingEvidenceId(null);
    setEditingExistingAttachments([]);
  };

  // Normalize pot options: only leaf (no children) and sorted alpha by label
  const leafPotOptions = useMemo(() => {
    const childrenByParent = new Map();
    (potOptions || []).forEach(opt => {
      if (opt.parentId) {
        childrenByParent.set(String(opt.parentId), true);
      }
    });
    const leaves = (potOptions || []).filter(opt => !childrenByParent.has(String(opt.value)));
    return [...leaves].sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  }, [potOptions]);

  useEffect(() => {
    if (!prefillRequest || !prefillRequest.potId) {
      return;
    }
    const optionMatch = leafPotOptions.find(option => option.value === prefillRequest.potId);
    if (!optionMatch) {
      return;
    }
    setFormState(current => ({
      ...current,
      sourcePot: optionMatch,
      destinationPot:
        current.destinationPot && current.destinationPot.value === optionMatch.value
          ? null
          : current.destinationPot,
      justification: current.justification
        ? current.justification
        : "Aligning spend with updated forecasts from Budgets dashboard.",
    }));
    if (typeof onPrefillConsumed === "function") {
      onPrefillConsumed();
    }
  }, [prefillRequest, onPrefillConsumed, leafPotOptions]);

  const derived = useMemo(() => {
    const amount = Number(formState.amount);
    const sourceMeta = potMetrics[formState.sourcePot?.value] ?? null;
    const destMeta = potMetrics[formState.destinationPot?.value] ?? null;
    const sourceAvailable = Number(sourceMeta?.available);
    const destAvailable = Number(destMeta?.available);
    const destAdminPct = Number(destMeta?.adminPct);
    const evidenceReady = evidenceItems.length > 0;
    const availableAfter =
      Number.isFinite(sourceAvailable) && Number.isFinite(amount) ? sourceAvailable - amount : null;
    const destAvailableAfter =
      Number.isFinite(destAvailable) && Number.isFinite(amount) ? destAvailable + amount : null;
    const adminAfter =
      Number.isFinite(destAdminPct) && Number.isFinite(amount) ? destAdminPct + amount / 100000 : null;

    const issues = [];
    if (Number.isFinite(sourceAvailable) && Number.isFinite(amount) && amount > sourceAvailable) {
      issues.push({
        type: "error",
        text: "Transfer exceeds available balance in source pot.",
      });
    }
    if (Number.isFinite(adminAfter) && adminAfter > 15) {
      issues.push({
        type: "warning",
        text: "Destination admin attribution would exceed 15% cap. Capture ESDC approval reference.",
      });
    }
    const forecastVariance = Number(sourceMeta?.forecastVariance);
    if (Number.isFinite(amount) && amount > 0 && Number.isFinite(forecastVariance) && forecastVariance < -5) {
      issues.push({
        type: "info",
        text: "Source pot forecast already behind plan. Confirm program manager sign-off.",
      });
    }

    return {
      amount: Number.isFinite(amount) ? amount : null,
      availableAfter,
      destAvailableAfter,
      adminAfter,
      issues,
      evidenceReady,
    };
  }, [formState.amount, formState.destinationPot, formState.sourcePot, evidenceItems.length]);

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Transfer wizard",
            metadata.aiContext ?? ""
          );
        }}
      >
        Info
      </Link>
    ) : undefined;

  const fetchValidation = useCallback(
    async ({ sourceId, destId, signal }) => {
      if (!sourceId || !destId || sourceId === destId) {
        setValidationState({ status: "idle", violations: [], message: null });
        return;
      }
      setValidationState({ status: "pending", violations: [], message: null });
      try {
        const resp = await apiFetch("/api/finance/allocations/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourcePotId: sourceId, destinationPotId: destId }),
          signal,
        });
        if (!resp.ok) {
          const payload = await resp.json().catch(() => null);
          const message = payload?.error || `Validation failed (${resp.status})`;
          setValidationState({ status: "error", violations: [], message });
          return;
        }
        const payload = await resp.json();
        setValidationState({
          status: "done",
          violations: Array.isArray(payload.violations) ? payload.violations : [],
          message: null,
          ok: payload.ok !== false,
        });
      } catch (err) {
        if (err?.name === "AbortError") return;
        setValidationState({
          status: "error",
          violations: [],
          message: "Validation temporarily unavailable. Try again.",
        });
      }
    },
    []
  );

  useEffect(() => {
    const sourceId = formState.sourcePot?.value;
    const destId = formState.destinationPot?.value;
    if (!sourceId || !destId || sourceId === destId) {
      setValidationState({ status: "idle", violations: [], message: null });
      return;
    }
    if (validationAbortRef.current) {
      validationAbortRef.current.abort();
    }
    const controller = new AbortController();
    validationAbortRef.current = controller;
    const timer = setTimeout(() => {
      fetchValidation({ sourceId, destId, signal: controller.signal });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [formState.sourcePot, formState.destinationPot, fetchValidation]);

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const updateField = (key, value) => {
    setFormState(current => ({
      ...current,
      [key]: value,
    }));
    setErrors(current => ({ ...current, [key]: null }));
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formState.sourcePot) {
      nextErrors.sourcePot = "Select a source pot.";
    }
    if (!formState.destinationPot) {
      nextErrors.destinationPot = "Select a destination pot.";
    }
    if (
      formState.sourcePot?.value &&
      formState.destinationPot?.value &&
      formState.sourcePot.value === formState.destinationPot.value
    ) {
      nextErrors.destinationPot = "Source and destination must be different.";
    }
    const amountNum = Number(formState.amount);
    if (!formState.amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      nextErrors.amount = "Enter a positive transfer amount.";
    }
    const sourceAvailable = potMetrics[formState.sourcePot?.value]?.available;
    if (
      Number.isFinite(Number(sourceAvailable)) &&
      Number.isFinite(amountNum) &&
      amountNum > Number(sourceAvailable)
    ) {
      nextErrors.amount = "Amount exceeds available balance in the source pot.";
    }
    if (!formState.effectiveDate) {
      nextErrors.effectiveDate = "Select an effective date.";
    }
    const justificationText = (formState.justification || "").trim();
    if (justificationText.length < 10) {
      nextErrors.justification = "Provide a brief justification (10+ characters).";
    }
    evidenceItems.forEach(item => {
      if (!item?.label || !item.label.trim()) {
        nextErrors.evidence = "Evidence items require a label.";
      }
    });
    return nextErrors;
  };

  const handleAddEvidence = () => {
    const label = newEvidenceLabel.trim();
    if (!label) {
      setEvidenceModalError("Add a label for the evidence item.");
      return;
    }
    const nextItem = {
      id: editingEvidenceId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label,
      type: newEvidenceType.trim() || null,
      attachments: [...editingExistingAttachments, ...newEvidenceUploads],
    };
    setEvidenceItems(current =>
      editingEvidenceId
        ? current.map(item => (item.id === editingEvidenceId ? nextItem : item))
        : [...current, nextItem]
    );
    setNewEvidenceLabel("");
    setNewEvidenceType("");
    setNewEvidenceUploads([]);
    setEditingEvidenceId(null);
    setEditingExistingAttachments([]);
    setErrors(current => ({ ...current, evidence: null }));
    setEvidenceModalError(null);
    setEvidenceModalOpen(false);
  };

  const handleRemoveEvidence = id => {
    setEvidenceItems(current => current.filter(item => item.id !== id));
  };
  const handleRemoveEvidenceWithCleanup = async id => {
    const target = evidenceItems.find(item => item.id === id);
    if (target?.attachments?.length) {
      cleanupAttachments(target.attachments);
    }
    handleRemoveEvidence(id);
  };

  const handleEvidenceFileChange = async files => {
    if (!files || !files.length) {
      setNewEvidenceUploads([]);
      return;
    }
    setUploadingEvidence(true);
    try {
      const uploads = [];
      for (const file of files) {
        const uploaded = await uploadEvidenceFile(file);
        if (uploaded) {
          uploads.push(uploaded);
        }
      }
      setNewEvidenceUploads(current => [...current, ...uploads]);
      setEvidenceModalError(null);
    } catch (err) {
      setEvidenceModalError(err?.message || "Upload failed.");
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSuccessMessage(null);
    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      setSubmitError("Please resolve the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      // Revalidate on submit
      const validateResp = await apiFetch("/api/finance/allocations/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePotId: formState.sourcePot.value,
          destinationPotId: formState.destinationPot.value,
        }),
      });
      if (!validateResp.ok) {
        const payload = await validateResp.json().catch(() => null);
        setSubmitError(payload?.error || `Validation failed (${validateResp.status})`);
        setSubmitting(false);
        return;
      }
      const validatePayload = await validateResp.json();
      if (
        validatePayload.ok === false ||
        (Array.isArray(validatePayload.violations) &&
          validatePayload.violations.some(v => v.severity === "error"))
      ) {
        setValidationState({
          status: "done",
          violations: validatePayload.violations || [],
          message: null,
          ok: false,
        });
        setSubmitting(false);
        return;
      }

      const evidencePayload = evidenceItems.map(item => ({
        label: item.label,
        type: item.type || null,
        attachments: item.attachments || [],
      }));
      const payload = {
        sourcePotId: formState.sourcePot?.value,
        destinationPotId: formState.destinationPot?.value,
        amount: Number(formState.amount),
        justification: formState.justification.trim(),
      };
      if (formState.effectiveDate) {
        payload.effectiveDate = formState.effectiveDate;
      }
      const apiResponse = typeof createAllocation === "function" ? await createAllocation(payload) : null;
      if (apiResponse && apiResponse.ok === false && Array.isArray(apiResponse.violations)) {
        setValidationState({
          status: "done",
          violations: apiResponse.violations,
          message: null,
          ok: false,
        });
        setSubmitting(false);
        return;
      }
      setLastSubmission({
        ...formState,
        submittedAt: new Date().toISOString(),
        response: apiResponse,
        policyIssues: derived.issues,
        evidence: evidencePayload,
      });
      setSuccessMessage("Transfer proposed and sent for approval.");
      resetForm();
      if (typeof refreshAllocations === "function") {
        refreshAllocations();
      }
    } catch (error) {
      const message = error?.message || "Unable to submit transfer right now.";
      setSubmitError(message);
      console.error("[Allocations] submit failed", error);
    } finally {
      setSubmitting(false);
    }
  };

  const disableSubmit =
    submitting ||
    validationState.status === "pending" ||
    (validationState.status === "done" &&
      validationState.violations?.some(v => v.severity === "error"));

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Stage reallocations with built-in policy guidance before routing for approval."
        >
          Transfer wizard
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Transfer wizard settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="l">
        <ColumnLayout columns={3} variant="text-grid">
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Source available after transfer</Box>
            <StatusIndicator
              type={
                Number.isFinite(derived.availableAfter)
                  ? derived.availableAfter >= 0
                    ? "success"
                    : "error"
                  : "pending"
              }
            >
              {formatCurrency(derived.availableAfter)}
            </StatusIndicator>
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Destination admin allocation</Box>
            <StatusIndicator
              type={
                Number.isFinite(derived.destAvailableAfter)
                  ? derived.destAvailableAfter >= 0
                    ? "success"
                    : "error"
                  : "pending"
              }
            >
              {formatCurrency(derived.destAvailableAfter)}
            </StatusIndicator>
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Evidence attachments</Box>
            <StatusIndicator type={derived.evidenceReady ? "success" : "pending"}>
              {derived.evidenceReady ? "Ready" : "Pending"}
            </StatusIndicator>
          </SpaceBetween>
        </ColumnLayout>

        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size="s">
            <FormField label="Source pot" stretch errorText={errors.sourcePot}>
              <Select
                placeholder="Select source"
              options={leafPotOptions.filter(option => option.value !== formState.destinationPot?.value)}
                selectedOption={formState.sourcePot}
                onChange={({ detail }) => updateField("sourcePot", detail.selectedOption)}
              />
            </FormField>
            <FormField label="Destination pot" stretch errorText={errors.destinationPot}>
              <Select
                placeholder="Select destination"
              options={leafPotOptions.filter(option => option.value !== formState.sourcePot?.value)}
                selectedOption={formState.destinationPot}
                onChange={({ detail }) => updateField("destinationPot", detail.selectedOption)}
              />
            </FormField>
            {validationState.status === "pending" ? (
              <StatusIndicator type="loading">Validating transfer policy…</StatusIndicator>
            ) : null}
            {validationState.message ? (
              <Alert type="error" statusIconAriaLabel="Error message">
                {validationState.message}
              </Alert>
            ) : null}
            {validationState.status === "done" &&
            Array.isArray(validationState.violations) &&
            validationState.violations.length ? (
              <Alert type="error" statusIconAriaLabel="Validation errors">
                <SpaceBetween size="xxs">
                  {validationState.violations.map(v => (
                    <Box key={v.code} variant="p">
                      {v.message ||
                        (v.code === "missing_funding_source"
                          ? "Both pots must be classified (Funding source) in Budgets before transfers can be validated."
                          : v.code === "ei_to_crf_not_permitted"
                            ? "Transfers from EI-funded pots to CRF-funded pots are not permitted."
                            : v.code)}
                    </Box>
                  ))}
                </SpaceBetween>
              </Alert>
            ) : null}
            <FormField label="Transfer amount" stretch errorText={errors.amount}>
              <Input
                placeholder="e.g., 75,000.00"
                value={amountFocused ? formState.amount : formatCurrencyDisplay(formState.amount)}
                onChange={({ detail }) => updateField("amount", detail.value)}
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
              />
            </FormField>
            <FormField label="Effective date" stretch errorText={errors.effectiveDate}>
              <Input
                type="date"
                value={formState.effectiveDate}
                onChange={({ detail }) => updateField("effectiveDate", detail.value)}
              />
            </FormField>
          </SpaceBetween>
          <SpaceBetween size="s">
            <FormField label="Justification" errorText={errors.justification}>
              <Textarea
                placeholder="Explain the rationale, reference approvals, and highlight forecast impact."
                value={formState.justification}
                onChange={({ detail }) => updateField("justification", detail.value)}
                rows={6}
              />
            </FormField>
            <FormField
              label="Tags &amp; references"
              description="Board minute IDs, approval references, or internal tracking codes."
            >
              <Input
                placeholder="NWAC-BRD-24-07; ESDC-UAF-2024"
                value={formState.tags}
                onChange={({ detail }) => updateField("tags", detail.value)}
              />
            </FormField>
          </SpaceBetween>
        </ColumnLayout>

        <SpaceBetween size="m">
          {successMessage ? (
            <Alert type="success" statusIconAriaLabel="Success">
              {successMessage}
            </Alert>
          ) : null}
          {submitError ? (
            <Alert type="error" statusIconAriaLabel="Error message">
              {submitError}
            </Alert>
          ) : null}
          {derived.issues.map(issue => (
            <Alert key={issue.text} type={issue.type} statusIconAriaLabel={`${issue.type} message`}>
              {issue.text}
            </Alert>
          ))}
        </SpaceBetween>

        <SpaceBetween size="s">
          <Table
            variant="embedded"
            stripedRows
            wrapLines
            resizableColumns={false}
            header={
              <Header
                variant="h3"
                description="List evidence IDs, memo references, or documents to attach."
                actions={
                  <Button
                    iconName="add-plus"
                  onClick={() => {
                    setEvidenceModalError(null);
                    setEditingEvidenceId(null);
                    setNewEvidenceLabel("");
                    setNewEvidenceType("");
                    setNewEvidenceUploads([]);
                    setEditingExistingAttachments([]);
                    setEvidenceModalOpen(true);
                  }}
                >
                    Add evidence item
                  </Button>
                }
              >
                Evidence references
              </Header>
            }
            columnDefinitions={[
              { id: "label", header: "Label", cell: item => item.label },
              { id: "type", header: "Type", cell: item => item.type || "Not set" },
              {
                id: "attachment",
                header: "Attachment",
                cell: item =>
                  Array.isArray(item.attachments) && item.attachments.length > 0
                    ? `${item.attachments.length} file${item.attachments.length > 1 ? "s" : ""}`
                    : "Not attached",
              },
              {
                id: "actions",
                header: "Actions",
                cell: item => (
                  <SpaceBetween size="xs" direction="horizontal">
                    <Button
                      iconName="edit"
                      variant="icon"
                      ariaLabel="Edit evidence item"
                      onClick={() => {
                        setEvidenceModalError(null);
                        setEditingEvidenceId(item.id);
                        setNewEvidenceLabel(item.label);
                        setNewEvidenceType(item.type || "");
                        setNewEvidenceUploads([]);
                        setEditingExistingAttachments(item.attachments || []);
                        setEvidenceModalOpen(true);
                      }}
                    />
                    <Button
                      iconName="remove"
                      variant="icon"
                      ariaLabel="Remove evidence item"
                      onClick={() => handleRemoveEvidenceWithCleanup(item.id)}
                    />
                  </SpaceBetween>
                ),
              },
            ]}
            items={evidenceItems}
            empty={<Box variant="p">No evidence references added yet.</Box>}
            contentDensity="compact"
            trackBy="id"
          />
          {errors.evidence ? (
            <Alert type="error" statusIconAriaLabel="Error message">
              {errors.evidence}
            </Alert>
          ) : null}
        </SpaceBetween>

        <SpaceBetween size="xs" direction="horizontal">
          <Button
            variant="primary"
            disabled={disableSubmit}
            loading={submitting}
            onClick={handleSubmit}
          >
            Submit transfer for approval
          </Button>
          <Button
            variant="link"
            onClick={() => resetForm({ cleanupUploads: true })}
          >
            Clear form
          </Button>
        </SpaceBetween>

        {lastSubmission ? (
          <Box variant="awsui-key-label">
            Last submitted {new Date(lastSubmission.submittedAt).toLocaleString()} — awaiting workflow routing.
          </Box>
        ) : null}
        <Modal
          visible={evidenceModalOpen}
          header={editingEvidenceId ? "Edit evidence item" : "Add evidence item"}
          onDismiss={() => {
            if (newEvidenceUploads.length) {
              cleanupAttachments(newEvidenceUploads);
            }
            setEvidenceModalOpen(false);
            setEvidenceModalError(null);
            setEditingEvidenceId(null);
            setEditingExistingAttachments([]);
            setNewEvidenceUploads([]);
          }}
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() => {
                  if (newEvidenceUploads.length) {
                    cleanupAttachments(newEvidenceUploads);
                  }
                  setEvidenceModalOpen(false);
                  setEvidenceModalError(null);
                  setEditingEvidenceId(null);
                  setEditingExistingAttachments([]);
                  setNewEvidenceUploads([]);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAddEvidence}>
                Save evidence
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            {evidenceModalError ? (
              <Alert type="error" statusIconAriaLabel="Error message">
                {evidenceModalError}
              </Alert>
            ) : null}
            <FormField label="Evidence label (required)">
              <Input
                placeholder="e.g., BRD-123 or ESDC-UAF-2024"
                value={newEvidenceLabel}
                onChange={({ detail }) => setNewEvidenceLabel(detail.value)}
              />
            </FormField>
            <FormField label="Type (optional)">
              <Input
                placeholder="e.g., memo, board minutes"
                value={newEvidenceType}
                onChange={({ detail }) => setNewEvidenceType(detail.value)}
              />
            </FormField>
            <FormField
              label="Attachments (optional)"
              description="Upload supporting documents. Max 5 MB each."
            >
              <FileUpload
                accept={[
                  "application/pdf",
                  "application/msword",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "application/vnd.ms-excel",
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  "text/plain",
                  "image/png",
                  "image/jpeg",
                ]}
                value={[]}
                onChange={({ detail }) => handleEvidenceFileChange(detail.value || [])}
                multiple
                loading={uploadingEvidence}
                constraintText="PDF, Word, Excel, text, PNG, JPG. Max 5 MB each."
              />
            </FormField>
            {newEvidenceUploads.length > 0 ? (
              <FormField label="New uploads (staged)">
                <SpaceBetween size="xs">
                  {newEvidenceUploads.map(file => (
                    <Box key={file.key} variant="p">
                      {file.name} ({Math.round((file.size || 0) / 1024)} KB)
                    </Box>
                  ))}
                </SpaceBetween>
              </FormField>
            ) : null}
            {editingExistingAttachments.length > 0 ? (
              <FormField label="Existing attachments">
                <SpaceBetween size="xs">
                  {editingExistingAttachments.map(file => (
                    <Box key={file.name} variant="p">
                      {file.name} ({Math.round((file.size || 0) / 1024)} KB)
                    </Box>
                  ))}
                </SpaceBetween>
              </FormField>
            ) : null}
          </SpaceBetween>
        </Modal>
      </SpaceBetween>
    </BoardItem>
  );
};

export default AllocationTransferWizardWidget;
