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
          description={metadata.description ?? "Client details, agreement, owner, and quick actions."}
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
      {error ? (
        <Box padding="m">
          <StatusIndicator type="error">{error}</StatusIndicator>
        </Box>
      ) : (
        <ColumnLayout columns={3}>
          <Box>
            <h4 style={{ marginBottom: "0.25rem" }}>Client</h4>
            <div>{caseData?.client?.name ?? "—"}</div>
            <div style={{ color: "var(--color-text-body-secondary)" }}>
              DOB: {caseData?.client?.dateOfBirth ?? "—"}
            </div>
            <div style={{ color: "var(--color-text-body-secondary)" }}>
              Region: {caseData?.client?.region ?? "—"}
            </div>
          </Box>
          <Box>
            <h4 style={{ marginBottom: "0.25rem" }}>Agreement</h4>
            <div>{caseData?.agreementNumber ?? "—"}</div>
            <div style={{ color: "var(--color-text-body-secondary)" }}>
              Status: {caseData?.status ?? "—"}
            </div>
            <div style={{ color: "var(--color-text-body-secondary)" }}>
              Updated: {caseData?.updatedAt ? new Date(caseData.updatedAt).toLocaleString() : "—"}
            </div>
          </Box>
          <Box>
            <h4 style={{ marginBottom: "0.25rem" }}>Owner</h4>
            <div>{caseData?.owner?.name ?? "Unassigned"}</div>
            <div style={{ color: "var(--color-text-body-secondary)" }}>ID: {caseData?.owner?.id ?? "—"}</div>
            <StatusIndicator type={caseData?.status === "ready-to-close" ? "success" : "info"}>
              {caseData?.status ?? "Unknown"}
            </StatusIndicator>
          </Box>
        </ColumnLayout>
      )}
    </BoardItem>
  );
};

export default CaseHeaderWidget;
