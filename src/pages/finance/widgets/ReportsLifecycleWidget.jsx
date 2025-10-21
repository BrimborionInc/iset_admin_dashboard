import React, { useMemo } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  StatusIndicator,
  SegmentedControl,
  Button,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useReportsData } from "./ReportsDataContext.jsx";

const stageOrder = [
  { id: "draft", label: "Draft" },
  { id: "validation", label: "Validation" },
  { id: "certification", label: "Certification" },
  { id: "submission", label: "Submission" },
];

const statusToIndicator = status => {
  switch (status) {
    case "completed":
      return "success";
    case "submitted":
      return "success";
    case "in_progress":
      return "in-progress";
    case "blocked":
      return "warning";
    case "pending":
    case "not_started":
    default:
      return "pending";
  }
};

const statusLabel = status => {
  switch (status) {
    case "completed":
      return "Completed";
    case "submitted":
      return "Submitted";
    case "in_progress":
      return "In progress";
    case "blocked":
      return "Blocked";
    case "pending":
      return "Pending";
    case "not_started":
    default:
      return "Not started";
  }
};

const ReportsLifecycleWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    reports,
    selectedReportId,
    selectReport,
    setStageStatus,
    setValidationStatus,
    selectedReport,
  } = useReportsData();

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(helpContent, metadata.helpTitle ?? "Report lifecycle", metadata.aiContext ?? "");
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

  const segmentedOptions = useMemo(
    () =>
      reports.map(report => ({
        id: report.id,
        text: report.name,
      })),
    [reports]
  );

  const handleAdvance = () => {
    if (!selectedReport) {
      return;
    }
    const nextStage = stageOrder.find(stage => selectedReport.stage[stage.id] !== "completed" && selectedReport.stage[stage.id] !== "submitted");
    if (!nextStage) {
      return;
    }

    const currentStatus = selectedReport.stage[nextStage.id];
    if (currentStatus === "blocked") {
      return;
    }

    if (currentStatus === "in_progress" || currentStatus === "pending" || currentStatus === "not_started") {
      setStageStatus(selectedReport.id, nextStage.id, "completed");
      if (nextStage.id === "validation") {
        setValidationStatus(selectedReport.id, "clear");
      }
      const nextIndex = stageOrder.findIndex(stage => stage.id === nextStage.id) + 1;
      if (stageOrder[nextIndex]) {
        const upcoming = stageOrder[nextIndex];
        if (selectedReport.stage[upcoming.id] === "pending" || selectedReport.stage[upcoming.id] === "not_started") {
          setStageStatus(selectedReport.id, upcoming.id, "in_progress");
        }
      } else {
        setStageStatus(selectedReport.id, nextStage.id, "submitted");
      }
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={selectedReport ? `${selectedReport.type} report due ${selectedReport.dueDate}` : "Select a report to review lifecycle progress."}
        >
          Report lifecycle
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Report lifecycle settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="l">
        <SegmentedControl
          selectedId={selectedReportId}
          onChange={({ detail }) => selectReport(detail.selectedId)}
          options={segmentedOptions}
        />

        {selectedReport ? (
          <SpaceBetween size="m">
            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Lifecycle stages</Box>
              <SpaceBetween size="s">
                {stageOrder.map(stage => {
                  const currentStatus = selectedReport.stage[stage.id] ?? "not_started";
                  return (
                    <SpaceBetween key={stage.id} size="xxs">
                      <Box variant="strong">{stage.label}</Box>
                      <StatusIndicator type={statusToIndicator(currentStatus)}>
                        {statusLabel(currentStatus)}
                      </StatusIndicator>
                      <Box variant="p">
                        {stage.id === "validation"
                          ? `Validation status: ${selectedReport.validationStatus.replace(/_/g, " ")}`
                          : `Stage key: ${stage.id}`}
                      </Box>
                    </SpaceBetween>
                  );
                })}
              </SpaceBetween>
            </SpaceBetween>

            <SpaceBetween size="s">
              <Box variant="awsui-key-label">Metadata</Box>
              <Box variant="p">Agreement ID: {selectedReport.agreementId}</Box>
              <Box variant="p">
                Last updated:{" "}
                {selectedReport.lastUpdated
                  ? new Date(selectedReport.lastUpdated).toLocaleString()
                  : "Not yet updated"}
              </Box>
              <Box variant="p">
                Signatory status: {selectedReport.signatory.status === "signed" ? "Signed" : "Pending signature"}
              </Box>
            </SpaceBetween>

            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={handleAdvance}
                iconName="status-positive"
                disabled={!stageOrder.some(stage => {
                  const status = selectedReport.stage[stage.id];
                  return status === "in_progress" || status === "pending" || status === "not_started";
                })}
              >
                Advance next stage
              </Button>
              <Button
                href="/finance/budgets"
                iconName="external"
                variant="link"
              >
                Review source data
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        ) : (
          <Box variant="p">Select a report to view lifecycle status.</Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default ReportsLifecycleWidget;

