import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  Container,
  Header,
  Link,
  SpaceBetween,
  StatusIndicator,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const CompliancePanelWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseData, runComplianceChecks } = useCaseWorkspace();

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Compliance status", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const compliance = caseData?.compliance ?? {};

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const ilmpStatus = compliance.ilmp?.status ?? "pending";
  const financeStatus = compliance.finance?.status ?? "pending";
  const ilmpMessages = compliance.ilmp?.messages ?? [];
  const financeMessages = compliance.finance?.messages ?? [];

  const renderMessage = (prefix, message, index) => (
    <Box
      key={`${prefix}-${index}`}
      padding="m"
      background="#FFF9E6"
      borderRadius="medium"
      borderLeft="3px solid #B07906"
      color="text-status-warning"
    >
      {message}
    </Box>
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description ?? "View ILMP and finance validation results before export."}
          actions={
            <Button iconName="refresh" onClick={() => runComplianceChecks().catch(() => {})}>
              Run validation
            </Button>
          }
        >
          {metadata.title ?? "Compliance"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Compliance panel settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <ColumnLayout columns={2} variant="text-grid">
        <Container
          header={
            <Header
              variant="h3"
              description="Schema checks for ILMP export"
              actions={
                <StatusIndicator type={ilmpStatus === "clean" ? "success" : "warning"}>
                  {ilmpStatus}
                </StatusIndicator>
              }
            >
              ILMP validation
            </Header>
          }
        >
          <SpaceBetween size="s">
            {ilmpMessages.length === 0 ? (
              <Box color="text-body-secondary">No warnings. ILMP export is ready.</Box>
            ) : (
              ilmpMessages.map((message, index) => renderMessage("ilmp", message, index))
            )}
          </SpaceBetween>
        </Container>
        <Container
          header={
            <Header
              variant="h3"
              description="Budget mapping and variance rules"
              actions={
                <StatusIndicator type={financeStatus === "clean" ? "success" : "warning"}>
                  {financeStatus}
                </StatusIndicator>
              }
            >
              Finance validation
            </Header>
          }
        >
          <SpaceBetween size="s">
            {financeMessages.length === 0 ? (
              <Box color="text-body-secondary">No finance issues detected.</Box>
            ) : (
              financeMessages.map((message, index) => renderMessage("finance", message, index))
            )}
          </SpaceBetween>
        </Container>
      </ColumnLayout>
    </BoardItem>
  );
};

export default CompliancePanelWidget;
