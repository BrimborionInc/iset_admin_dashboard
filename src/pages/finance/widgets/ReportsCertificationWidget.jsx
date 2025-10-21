import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  StatusIndicator,
  ColumnLayout,
  Button,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useReportsData } from "./ReportsDataContext.jsx";

const signatoryStatusType = status => {
  switch (status) {
    case "signed":
      return "success";
    case "pending":
      return "info";
    case "declined":
      return "warning";
    default:
      return "pending";
  }
};

const ReportsCertificationWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    selectedReport,
    setSignatoryStatus,
    addExportRecord,
  } = useReportsData();

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(helpContent, metadata.helpTitle ?? "Certification", metadata.aiContext ?? "");
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

  const handleRecordSignature = () => {
    if (!selectedReport) return;
    setSignatoryStatus(selectedReport.id, "signed");
  };

  const handleGenerateExport = () => {
    if (!selectedReport) return;
    addExportRecord({
      reportId: selectedReport.id,
      format: "XML",
      envelopeVersion: "1.4",
      channel: "GC Notify",
    });
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Certification workflow status and telemetry."
        >
          Certification &amp; telemetry
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Certification settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {selectedReport ? (
        <SpaceBetween size="l">
          <ColumnLayout columns={2} variant="text-grid">
            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Signatory</Box>
              <Box variant="strong">{selectedReport.signatory.name}</Box>
              <Box variant="p">{selectedReport.signatory.role}</Box>
              <StatusIndicator type={signatoryStatusType(selectedReport.signatory.status)}>
                {selectedReport.signatory.status === "signed" ? "Signed" : "Pending signature"}
              </StatusIndicator>
              <Box variant="p">
                Signed on:{" "}
                {selectedReport.signatory.signedOn
                  ? new Date(selectedReport.signatory.signedOn).toLocaleString()
                  : "Not yet signed"}
              </Box>
            </SpaceBetween>

            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Telemetry</Box>
              <Box variant="p">Agreement ID: {selectedReport.agreementId}</Box>
              <Box variant="p">Report ID: {selectedReport.id}</Box>
              <Box variant="p">
                Validation status: {selectedReport.validationStatus.replace(/_/g, " ")}
              </Box>
              <Box variant="p">
                Submission stage: {selectedReport.stage.submission.replace(/_/g, " ")}
              </Box>
              <Link href="/finance/settings?tab=telemetry">Configure telemetry</Link>
            </SpaceBetween>
          </ColumnLayout>

          <SpaceBetween size="xs" direction="horizontal">
            <Button
              iconName="status-positive"
              onClick={handleRecordSignature}
              disabled={selectedReport.signatory.status === "signed"}
            >
              Record signature
            </Button>
            <Button
              variant="secondary"
              iconName="generate"
              onClick={handleGenerateExport}
            >
              Generate XML export
            </Button>
            <Button
              variant="link"
              href="/finance/reports?workflow=certification"
            >
              View certification log
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      ) : (
        <Box variant="p">Select a report from the lifecycle widget to view certification details.</Box>
      )}
    </BoardItem>
  );
};

export default ReportsCertificationWidget;

