import React, { useCallback, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  Header,
  Link,
  Modal,
  Alert,
  SpaceBetween,
  StatusIndicator,
  Select,
  FormField,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import { apiFetch } from "../../../../auth/apiClient.js";

const CaseHeaderWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseData, isLoading, error, markReadyToClose, closeCase, reopenCase, refresh } = useCaseWorkspace();
  const [actionError, setActionError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [validationModal, setValidationModal] = useState({
    visible: false,
    blockers: [],
    warnings: [],
    detail: null,
    mode: "ready",
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [headerWarnings, setHeaderWarnings] = useState([]);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState(null);

  const DetailItem = ({ label, value }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--color-text-body-secondary)" }}>{label}</span>
      {React.isValidElement(value) ? (
        value
      ) : (
        <span style={{ fontWeight: 500 }}>{value ?? "-"}</span>
      )}
    </div>
  );

  const formatDateTime = value => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };

  const rawStatus = typeof caseData?.status === "string" ? caseData.status.trim().toLowerCase() : "";
  const normalizedStatus = rawStatus.replace(/-/g, "_");
  const statusKey = normalizedStatus === "withdrawn" ? "closed" : normalizedStatus;
  const labelSource = statusKey || rawStatus;
  const statusLabel = labelSource
    ? labelSource
        .split(/[_-]/g)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Unknown";
  const statusType = (() => {
    switch (statusKey) {
      case "active":
      case "closed":
        return "success";
      case "ready_to_close":
        return "warning";
      case "pending_approval":
      case "initiated":
      case "dormant":
        return "info";
      case "cancelled":
      case "rejected":
      case "closed":
        return "error";
      default:
        return "info";
    }
  })();
  const caseNumber = caseData?.caseNumber || (caseData?.id ? `CASE-${caseData.id}` : "-");
  const clientName = caseData?.client?.name ?? "Unknown client";
  const quickActions = useMemo(() => {
    const items = [{ id: "assign", text: "Assign / reassign" }];
    if (statusKey === "ready_to_close") {
      items.push({ id: "close-case", text: "Close case" });
    } else if (statusKey === "closed") {
      items.push({ id: "reopen-case", text: "Re-open case" });
    } else {
      items.push({ id: "close", text: "Mark ready to close" });
    }
    return items;
  }, [statusKey]);

  const compliance = caseData?.compliance ?? {};
  const mapValidationStatus = status => {
    const value = typeof status === "string" ? status.toLowerCase() : "pending";
    switch (value) {
      case "clean":
      case "ok":
        return { type: "success", label: "Clean" };
      case "warning":
        return { type: "warning", label: "Warnings" };
      case "blocked":
      case "error":
        return { type: "error", label: "Blocked" };
      case "pending":
      default:
        return { type: "pending", label: "Pending" };
    }
  };

  const ilmpStatusSummary = useMemo(() => mapValidationStatus(compliance.ilmp?.status), [compliance.ilmp?.status]);
  const financeStatusSummary = useMemo(() => mapValidationStatus(compliance.finance?.status), [compliance.finance?.status]);
  const ilmpLastValidated = compliance.ilmp?.lastValidatedAt ? formatDateTime(compliance.ilmp.lastValidatedAt) : "-";

  const detailItems = useMemo(() => {
    if (!caseData) {
      return [];
    }
    const statusIndicator = <StatusIndicator type={statusType}>{statusLabel}</StatusIndicator>;
    return [
      { label: "Client name", value: clientName },
      { label: "Case number", value: caseNumber },
      { label: "Status", value: statusIndicator },
      { label: "Owner", value: caseData?.owner?.name ?? "Unassigned" },
      { label: "Last updated", value: formatDateTime(caseData?.updatedAt) },
      {
        label: "ILMP validation",
        value: <StatusIndicator type={ilmpStatusSummary.type}>{ilmpStatusSummary.label}</StatusIndicator>,
      },
      {
        label: "ILMP validated",
        value: ilmpLastValidated,
      },
      {
        label: "Finance validation",
        value: <StatusIndicator type={financeStatusSummary.type}>{financeStatusSummary.label}</StatusIndicator>,
      },
    ];
  }, [
    caseData,
    caseNumber,
    clientName,
    statusLabel,
    statusType,
    ilmpStatusSummary,
    ilmpLastValidated,
    financeStatusSummary,
  ]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Case header", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const buildValidationSummary = useCallback((detail, fallbackMessage) => {
    const blockers = [];
    const warningSet = new Set();
    const addWarning = value => {
      if (value === null || typeof value === "undefined") return;
      const str = typeof value === "string" ? value : String(value);
      const trimmed = str.trim();
      if (trimmed) {
        warningSet.add(trimmed);
      }
    };

    const blockersRaw = detail?.blockers || {};
    if (blockersRaw.actionPlans) {
      const count = blockersRaw.actionPlans;
      blockers.push(
        `${count} action plan${count === 1 ? "" : "s"} are still open. Close or archive plans before marking the case ready to close.`
      );
    }
    if (blockersRaw.interventions) {
      const count = blockersRaw.interventions;
      blockers.push(
        `${count} intervention${count === 1 ? "" : "s"} remain active. Complete or cancel all interventions before closing the case.`
      );
    }
    if (blockersRaw.reminders) {
      const count = blockersRaw.reminders;
      blockers.push(
        `${count} open future reminder${count === 1 ? "" : "s"} exist. Clear or reschedule future reminders before closing the case.`
      );
    }

    const warningsRaw = detail?.warnings || {};
    if (warningsRaw.reminders) {
      const count = warningsRaw.reminders;
      addWarning(
        `${count} open future reminder${count === 1 ? "" : "s"} exist. Clearing or rescheduling them is recommended before closure.`
      );
    }
    if (Array.isArray(warningsRaw.ilmp) && warningsRaw.ilmp.length) {
      warningsRaw.ilmp.forEach(item => addWarning(item));
    }

    const ilmp = detail?.compliance?.ilmp || {};
    if (Array.isArray(ilmp.blockingIssues) && ilmp.blockingIssues.length) {
      ilmp.blockingIssues.forEach(issue => {
        blockers.push(typeof issue === "string" ? issue : String(issue));
      });
    } else if (ilmp.status === "blocked" && !blockers.length) {
      blockers.push("ILMP validation is blocked. Review ILMP readiness details before closing the case.");
    }

    if (Array.isArray(ilmp.warnings) && ilmp.warnings.length) {
      ilmp.warnings.forEach(addWarning);
    } else if (Array.isArray(ilmp.messages) && ilmp.messages.length && warningSet.size === 0) {
      ilmp.messages.forEach(addWarning);
    }

    if (!blockers.length && warningSet.size === 0 && fallbackMessage) {
      addWarning(fallbackMessage);
    }

    return { blockers, warnings: Array.from(warningSet) };
  }, []);

  const openValidationModal = useCallback(
    (detail, fallbackMessage, mode = "ready", summaryOverride = null) => {
      const summary = summaryOverride || buildValidationSummary(detail, fallbackMessage);
      setValidationModal({
        visible: true,
        detail: detail || null,
        blockers: summary.blockers,
        warnings: summary.warnings,
        mode,
      });
      setHeaderWarnings(summary.warnings || []);
    },
    [buildValidationSummary]
  );

  const closeValidationModal = () => {
    setModalLoading(false);
    setValidationModal({
      visible: false,
      blockers: [],
      warnings: [],
      detail: null,
      mode: "ready",
    });
  };

  const handleModalConfirm = async () => {
    setModalLoading(true);
    setActionError(null);
    try {
      if (validationModal.mode === "close") {
        await closeCase();
        await refresh();
        closeValidationModal();
      } else {
        closeValidationModal();
      }
    } catch (err) {
      const detail = err?.details || null;
      openValidationModal(detail, err?.message || "Failed to process case.", validationModal.mode);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      if (typeof window !== "undefined" && window.console) {
        window.console.info("[CaseHeaderWidget] remove requested");
      }
      actions.removeItem();
    } else if (typeof window !== "undefined" && window.console) {
      window.console.info("[CaseHeaderWidget] remove not executed", {
        hasRemove: typeof actions.removeItem === "function",
        detail,
      });
    }
  };

  const loadAssignable = useCallback(async () => {
    setAssignLoading(true);
    setAssignError(null);
    try {
      const res = await apiFetch("/api/staff/assignable");
      if (!res.ok) {
        throw new Error("assignable_fetch_failed");
      }
      const data = await res.json();
      const options = Array.isArray(data)
        ? data.map(staff => ({
            label: `${staff.display_name || staff.email || staff.id} (${staff.role || "Staff"})`,
            value: String(staff.id),
          }))
        : [];
      setAssignableStaff(options);
      const currentOwnerId = caseData?.owner?.id ? String(caseData.owner.id) : null;
      if (currentOwnerId && options.some(opt => opt.value === currentOwnerId)) {
        setSelectedAssignee(options.find(opt => opt.value === currentOwnerId) || null);
      }
    } catch (err) {
      setAssignableStaff([]);
      setAssignError("Unable to load assignable staff.");
    } finally {
      setAssignLoading(false);
    }
  }, [caseData?.owner?.id]);

  const handleAssignSubmit = useCallback(async () => {
    const caseId = caseData?.id;
    if (!caseId || !selectedAssignee?.value) {
      setAssignError("Select an assignee.");
      return;
    }
    setAssignSubmitting(true);
    setAssignError(null);
    try {
      const response = await apiFetch(`/api/cases/${caseId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignee_id: selectedAssignee.value }),
      });
      if (!response.ok) {
        throw new Error("assign_failed");
      }
      setAssignModalVisible(false);
      setSelectedAssignee(null);
      await refresh();
    } catch (err) {
      setAssignError("Assignment failed. Please try again.");
    } finally {
      setAssignSubmitting(false);
    }
  }, [caseData?.id, selectedAssignee, refresh]);

  const handleQuickAction = useCallback(
    async ({ detail }) => {
      if (!detail?.id) return;
      if (detail.id === "assign") {
        setAssignError(null);
        setSelectedAssignee(null);
        setAssignModalVisible(true);
        loadAssignable().catch(() => {});
      } else if (detail.id === "close") {
        setActionError(null);
        setActionLoading(true);
        try {
          const result = await markReadyToClose();
          await refresh();
          openValidationModal(
            result || null,
            "Ready to close completed.",
            "ready",
            buildValidationSummary(result || null, "Ready to close completed.")
          );
        } catch (err) {
          const errorMessage = err?.message || "Failed to mark ready to close.";
          openValidationModal(err?.details || null, errorMessage);
          setActionError(null);
        } finally {
          setActionLoading(false);
        }
      } else if (detail.id === "close-case") {
        setActionError(null);
        setActionLoading(true);
        try {
          const result = await markReadyToClose();
          await refresh();
          openValidationModal(
            result || null,
            "Close case validation completed.",
            "close",
            buildValidationSummary(result || null, "Close case validation completed.")
          );
        } catch (err) {
          setActionError(err?.message || "Failed to close case.");
        } finally {
          setActionLoading(false);
        }
      } else if (detail.id === "reopen-case") {
        setReopenModalOpen(true);
      }
    },
    [markReadyToClose, closeCase, refresh, openValidationModal, buildValidationSummary, loadAssignable]
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description}
          actions={
            <ButtonDropdown
              ariaLabel="Case actions"
              items={quickActions}
              onItemClick={handleQuickAction}
            >
              Quick actions
            </ButtonDropdown>
          }
        >
          {metadata.title ?? "Case header"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Case header settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {headerWarnings.length ? (
          <Alert
            type="warning"
            header="Case close warnings"
            dismissible
            dismissAriaLabel="Dismiss close warnings"
            onDismiss={() => setHeaderWarnings([])}
          >
            <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
              {headerWarnings.map((item, index) => (
                <li key={`header-warning-${index}`}>{item}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {actionLoading ? <StatusIndicator type="loading">Updating case…</StatusIndicator> : null}
        {actionError ? <StatusIndicator type="error">{actionError}</StatusIndicator> : null}
        {error ? (
          <StatusIndicator type="error">{error}</StatusIndicator>
        ) : null}
        {isLoading ? (
          <StatusIndicator type="loading">
            {caseData ? "Refreshing case..." : "Loading case..."}
          </StatusIndicator>
        ) : null}
        {caseData ? (
          <Box>
            <ColumnLayout columns={5} variant="text-grid">
              {detailItems.map(item => (
                <DetailItem key={item.label} label={item.label} value={item.value} />
              ))}
            </ColumnLayout>
          </Box>
        ) : !isLoading && !error ? (
          <Box padding="m">
            <StatusIndicator type="info">No case data available.</StatusIndicator>
          </Box>
        ) : null}
        <Modal
          visible={assignModalVisible}
          onDismiss={() => {
            if (assignSubmitting) return;
            setAssignModalVisible(false);
            setSelectedAssignee(null);
            setAssignError(null);
          }}
          header="Assign / reassign case"
          closeAriaLabel="Close assign modal"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() => {
                  if (assignSubmitting) return;
                  setAssignModalVisible(false);
                  setSelectedAssignee(null);
                  setAssignError(null);
                }}
                disabled={assignSubmitting}
              >
                Cancel
              </Button>
              <Button variant="primary" loading={assignSubmitting} onClick={handleAssignSubmit}>
                Save
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            {assignError ? <StatusIndicator type="error">{assignError}</StatusIndicator> : null}
            <FormField
              label="Assignee"
              description="Select the staff member who will own this case."
              stretch
            >
              <Select
                placeholder={assignLoading ? "Loading staff..." : "Select assignee"}
                selectedOption={selectedAssignee}
                options={assignableStaff}
                onChange={({ detail }) => setSelectedAssignee(detail.selectedOption || null)}
                statusType={assignLoading ? "loading" : "finished"}
                filteringType="auto"
                disabled={assignLoading}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
        <Modal
          visible={validationModal.visible}
          onDismiss={closeValidationModal}
          header="Case closeout checks"
          closeAriaLabel="Close case validation summary"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={closeValidationModal} disabled={modalLoading}>
                Cancel
              </Button>
              {!validationModal.blockers.length ? (
                <Button variant="primary" loading={modalLoading} onClick={handleModalConfirm}>
                  {validationModal.mode === "close" ? "Close case" : "Mark as Ready to Close"}
                </Button>
              ) : null}
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <div>
              <Box fontWeight="bold">Blockers</Box>
              {validationModal.blockers.length ? (
                <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
                  {validationModal.blockers.map((item, index) => (
                    <li key={`blocker-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <Box color="text-body-secondary">No blockers detected.</Box>
              )}
            </div>
            <div>
              <Box fontWeight="bold">Warnings</Box>
              {validationModal.warnings.length ? (
                <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
                  {validationModal.warnings.map((item, index) => (
                    <li key={`warning-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <Box color="text-body-secondary">No warnings detected.</Box>
              )}
            </div>
          </SpaceBetween>
        </Modal>
        <Modal
          visible={reopenModalOpen}
          onDismiss={() => setReopenModalOpen(false)}
          header="Re-open case"
          closeAriaLabel="Dismiss re-open case confirmation"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={() => setReopenModalOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={actionLoading}
                onClick={async () => {
                  if (actionLoading) return;
                  setActionError(null);
                  setActionLoading(true);
                  try {
                    await reopenCase();
                    await refresh();
                  } catch (err) {
                    setActionError(err?.message || "Failed to re-open case.");
                  } finally {
                    setActionLoading(false);
                    setReopenModalOpen(false);
                  }
                }}
              >
                Re-open case
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <Box>
              Re-open this case? The status will move to Dormant and will stay Dormant until a new action plan is initiated.
            </Box>
          </SpaceBetween>
        </Modal>
      </SpaceBetween>
    </BoardItem>
  );
};

export default CaseHeaderWidget;
