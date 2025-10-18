import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  StatusIndicator,
  SpaceBetween,
  Box,
  ButtonDropdown,
  ColumnLayout,
  Link,
  Badge,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";

const complianceSummary = [
  {
    id: "tier",
    label: "Capacity tier",
    value: "Enhancement",
    type: "info",
    description: "Next reassessment FY2026",
  },
  {
    id: "sampling",
    label: "Sampling window",
    value: "25% sampling in progress",
    type: "in-progress",
    description: "14 of 20 transactions reviewed",
  },
  {
    id: "monitoring",
    label: "Monitoring event",
    value: "On-site visit booked - 2025-07-15",
    type: "success",
    description: "Visit team confirmed - Travel booked",
  },
  {
    id: "evidence",
    label: "Evidence backlog",
    value: "8 items need documents",
    type: "warning",
    description: "Focus: Sub-agreement 004 / Q2 travel claims",
  },
];

const outstandingFindings = [
  {
    id: "F-102",
    title: "Evidence missing - staff training receipts",
    due: "Due 2024-12-05",
    owner: "Finance (Priya)",
    severity: "warning",
    href: "/finance/monitoring?finding=F-102",
  },
  {
    id: "F-099",
    title: "Variance explanation required (>10%)",
    due: "Due 2024-11-28",
    owner: "Program (Jordan)",
    severity: "info",
    href: "/finance/reports?variance=ADM",
  },
];

const controlChecks = [
  {
    id: "control-sample",
    label: "Sampling",
    detail: "Generate Q3 sample set by Nov 1",
  },
  {
    id: "control-logs",
    label: "Audit log",
    detail: "Verify signing officer approvals weekly",
  },
];

const SimpleComplianceWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(
          helpContent,
          metadata.helpTitle ?? "Compliance status",
          metadata.aiContext ?? ""
        );
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
      header={<Header variant="h2" info={infoLink}>Compliance status</Header>}
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Compliance status settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="l">
        <ColumnLayout columns={2} variant="text-grid">
          {complianceSummary.map(item => (
            <SpaceBetween key={item.id} size="xxs">
              <Box variant="awsui-key-label">{item.label}</Box>
              <StatusIndicator type={item.type}>{item.value}</StatusIndicator>
              <Box variant="p">{item.description}</Box>
            </SpaceBetween>
          ))}
        </ColumnLayout>
        <SpaceBetween size="s">
          <Box variant="awsui-key-label">Outstanding findings</Box>
          {outstandingFindings.map(finding => (
            <Box key={finding.id} padding={{ vertical: "xs" }}>
              <SpaceBetween size="xxs">
                <SpaceBetween size="xxs" direction="horizontal">
                  <StatusIndicator type={finding.severity}>
                    {finding.id}
                  </StatusIndicator>
                  <Link href={finding.href}>{finding.title}</Link>
                  <Badge color="blue">{finding.owner}</Badge>
                </SpaceBetween>
                <Box variant="awsui-value-large">{finding.due}</Box>
              </SpaceBetween>
            </Box>
          ))}
        </SpaceBetween>
        <SpaceBetween size="s">
          <Box variant="awsui-key-label">Control checklist</Box>
          {controlChecks.map(control => (
            <Box key={control.id} padding={{ bottom: "xs" }}>
              <Box variant="strong">{control.label}</Box>
              <Box variant="p">{control.detail}</Box>
            </Box>
          ))}
          <Link href="/finance/monitoring">Open monitoring workspace</Link>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default SimpleComplianceWidget;



