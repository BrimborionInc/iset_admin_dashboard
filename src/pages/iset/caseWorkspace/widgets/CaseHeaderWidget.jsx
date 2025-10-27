import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  Header,
  Link,
  SpaceBetween,
  StatusIndicator,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const CaseHeaderWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseData, isLoading, error, refresh } = useCaseWorkspace();

  const DetailItem = ({ label, value }) => (
    <div style={{ marginBottom: "0.5rem" }}>
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-body-secondary)" }}>{label}</div>
      <div>{value ?? "-"}</div>
    </div>
  );

  const formatDate = value => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString();
  };

  const formatDateTime = value => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };

  const formatNumber = value => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toLocaleString("en-CA");
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString("en-CA") : "0";
  };

  const stageLabel = [caseData?.stage, caseData?.subStage].filter(Boolean).join(" / ") || "-";
  const caseNumber = caseData?.caseNumber || (caseData?.id ? `CASE-${caseData.id}` : "-");
  const statusLabel = caseData?.status ?? "Unknown";
  const normalizedStatus = statusLabel.toLowerCase();
  const statusType =
    normalizedStatus === "ready-to-close" ||
    normalizedStatus === "approved" ||
    normalizedStatus === "closed" ||
    normalizedStatus === "completed"
      ? "success"
      : normalizedStatus === "at-risk" || normalizedStatus === "overdue"
      ? "error"
      : "info";
  const clientName = caseData?.client?.name ?? "Unknown client";
  const clientRegion = caseData?.client?.region ?? "Not set";
  const counts = caseData?.counts || {};

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
      actions.removeItem();
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description ?? "Client details, eligibility, owner, and quick actions."}
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Button iconName="refresh" onClick={() => refresh().catch(() => {})} loading={isLoading}>
                Refresh
              </Button>
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
            </SpaceBetween>
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
          <ColumnLayout columns={3} variant="text-grid">
            <Box>
              <h4 style={{ marginBottom: "0.5rem" }}>Case</h4>
              <DetailItem label="Case number" value={caseNumber} />
              <DetailItem label="Stage" value={stageLabel} />
              <DetailItem label="Next action due" value={formatDate(caseData?.nextActionDueAt)} />
              <DetailItem label="Last updated" value={formatDateTime(caseData?.updatedAt)} />
              <StatusIndicator type={statusType}>{statusLabel}</StatusIndicator>
            </Box>
            <Box>
              <h4 style={{ marginBottom: "0.5rem" }}>Client</h4>
              <DetailItem label="Name" value={clientName} />
              <DetailItem label="Date of birth" value={formatDate(caseData?.client?.dateOfBirth)} />
              <DetailItem label="Region" value={clientRegion} />
              <DetailItem label="Eligibility" value={caseData?.eligibility ?? "-"} />
            </Box>
            <Box>
              <h4 style={{ marginBottom: "0.5rem" }}>Owner & activity</h4>
              <DetailItem label="Owner" value={caseData?.owner?.name ?? "Unassigned"} />
              <DetailItem label="Owner email" value={caseData?.owner?.email ?? "-"} />
              <DetailItem label="Open tasks" value={formatNumber(counts.openTasks)} />
              <DetailItem label="Overdue tasks" value={formatNumber(counts.overdueTasks)} />
              <DetailItem label="Open interventions" value={formatNumber(counts.openInterventions)} />
            </Box>
          </ColumnLayout>
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
