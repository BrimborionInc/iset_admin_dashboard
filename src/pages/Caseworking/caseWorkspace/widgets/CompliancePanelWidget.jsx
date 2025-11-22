import React, { useCallback, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
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
  const [validating, setValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

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

  const handleValidate = useCallback(async () => {
    setErrorMessage(null);
    setValidating(true);
    try {
      await runComplianceChecks();
    } catch (err) {
      setErrorMessage(err?.message || "Unable to run ILMP validation.");
    } finally {
      setValidating(false);
    }
  }, [runComplianceChecks]);

  const normaliseStatusType = status => {
    const value = typeof status === "string" ? status.toLowerCase() : "pending";
    switch (value) {
      case "clean":
      case "ok":
        return "success";
      case "warning":
        return "warning";
      case "blocked":
      case "error":
        return "error";
      default:
        return "pending";
    }
  };

  const ilmpStatus = compliance.ilmp?.status ?? "pending";
  const financeStatus = compliance.finance?.status ?? "pending";
  const ilmpWarnings = Array.isArray(compliance.ilmp?.warnings) ? compliance.ilmp.warnings : [];
  const ilmpBlocking = Array.isArray(compliance.ilmp?.blockingIssues) ? compliance.ilmp.blockingIssues : [];
  const ilmpFallbackMessages = Array.isArray(compliance.ilmp?.messages) ? compliance.ilmp.messages : [];
  const ilmpMessages =
    ilmpBlocking.length || ilmpWarnings.length ? [] : ilmpFallbackMessages;
  const financeMessages = Array.isArray(compliance.finance?.messages) ? compliance.finance.messages : [];

  const ilmpLastValidatedAt = useMemo(() => {
    const value = compliance.ilmp?.lastValidatedAt;
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, [compliance.ilmp?.lastValidatedAt]);

  const renderMessage = (prefix, message, index, severity = "warning") => (
    <Box
      key={`${prefix}-${index}`}
      padding="m"
      background={severity === "error" ? "#FDF3F2" : "#FFF9E6"}
      borderRadius="medium"
      borderLeft={severity === "error" ? "3px solid #C91515" : "3px solid #B07906"}
      color={severity === "error" ? "text-status-error" : "text-status-warning"}
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
            <Button iconName="refresh" onClick={handleValidate} loading={validating}>
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
      <SpaceBetween size="m">
        {errorMessage && (
          <Alert type="error" dismissible onDismiss={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}
        <ColumnLayout columns={2} variant="text-grid">
          <Container
            header={
        <Header
          variant="h3"
          description="ILMP validation: blocked means export fails; warning means export is valid but needs attention."
          actions={
            <StatusIndicator type={normaliseStatusType(ilmpStatus)}>
              {ilmpStatus}
            </StatusIndicator>
          }
              >
                ILMP validation
              </Header>
            }
          >
            <SpaceBetween size="s">
              {ilmpLastValidatedAt && (
                <Box fontSize="body-s" color="text-body-secondary">
                  Last validated: {ilmpLastValidatedAt}
                </Box>
              )}
              {ilmpBlocking.map((message, index) => renderMessage("ilmp-block", message, index, "error"))}
              {ilmpWarnings.map((message, index) => renderMessage("ilmp-warning", message, index, "warning"))}
              {ilmpMessages.map((message, index) => renderMessage("ilmp-message", message, index, "warning"))}
              {ilmpBlocking.length === 0 && ilmpWarnings.length === 0 && ilmpMessages.length === 0 ? (
                <Box color="text-body-secondary">No ILMP issues detected.</Box>
              ) : null}
            </SpaceBetween>
          </Container>
          <Container
            header={
              <Header
                variant="h3"
                description="Budget mapping and variance rules"
                actions={
                  <StatusIndicator type={normaliseStatusType(financeStatus)}>
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
                financeMessages.map((message, index) => renderMessage("finance", message, index, "warning"))
              )}
            </SpaceBetween>
          </Container>
        </ColumnLayout>
      </SpaceBetween>
    </BoardItem>
  );
};

export default CompliancePanelWidget;
