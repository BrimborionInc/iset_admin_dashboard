import React, { useMemo } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import { Box, ButtonDropdown, ColumnLayout, Header, Link, SpaceBetween, StatusIndicator } from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const CaseHeaderWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseData, isLoading, error } = useCaseWorkspace();

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
  const statusLabel = rawStatus
    ? rawStatus
        .split(/[_-]/g)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Unknown";
  const statusType = (() => {
    switch (normalizedStatus) {
      case "active":
      case "closed":
      case "archived":
        return "success";
      case "ready_to_close":
        return "warning";
      case "pending_approval":
      case "initiated":
      case "dormant":
        return "info";
      case "cancelled":
      case "rejected":
      case "withdrawn":
        return "error";
      default:
        return "info";
    }
  })();
  const caseNumber = caseData?.caseNumber || (caseData?.id ? `CASE-${caseData.id}` : "-");
  const clientName = caseData?.client?.name ?? "Unknown client";

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
              items={[
                { id: "assign", text: "Assign / reassign" },
                { id: "close", text: "Mark ready to close" },
                { id: "archive", text: "Archive case" },
              ]}
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
      </SpaceBetween>
    </BoardItem>
  );
};

export default CaseHeaderWidget;
