import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Box,
  ButtonDropdown,
  Header,
  Link,
  SpaceBetween,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";

const FinanceSettingsOverviewWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const infoLink = metadata?.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(
          helpContent,
          metadata.helpTitle ?? "Finance settings overview",
          metadata.aiContext ?? "",
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Configuration area for tuning finance module behaviour, policy parameters, and terminology."
        >
          Finance settings overview
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Finance settings overview settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <Box variant="p">
          <strong>Concept:</strong> Centralise organisation-specific finance settings so
          administrators can tune rules without code changes, aligning with the
          "configuration over deployment" guidance in CR-0003.
        </Box>
        <Box>
          <strong>Key user goals</strong>
          <ul>
            <li>Toggle between simple and advanced module modes, setting hierarchy depth and default views.</li>
            <li>Maintain policy parameters such as administrative flat-rate percentage, capital thresholds, and sampling cadence overrides.</li>
            <li>Configure approval workflows, role visibility, terminology (pots/buckets), and integration endpoints.</li>
          </ul>
        </Box>
        <Box>
          <strong>Provisional widgets</strong>
          <ul>
            <li>Module mode card (Simple vs. Advanced) with preview of enabled features.</li>
            <li>Policy configuration form covering admin flat-rate, capital asset rules, and eligible expenditure categories.</li>
            <li>Approval workflow matrix showing thresholds and required approvers per action.</li>
            <li>Terminology and localisation editor for UI labels (English/French/Indigenous languages).</li>
          </ul>
        </Box>
        <Box>
          <strong>Dependencies and notes</strong>
          <ul>
            <li>Changes should propagate to Budgets, Allocations, Reconciliation, and Monitoring dashboards in real time.</li>
            <li>Expect to store configuration in the shared settings service so CODEX rules remain updateable without redeploys.</li>
            <li>Needs audit logging to capture who adjusted finance policies and when.</li>
            <li>Define configurable thresholds for KPI badge colours (e.g., when status flips between red, yellow, green) so dashboard visuals align with organisational tolerances.</li>
          </ul>
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
};

export default FinanceSettingsOverviewWidget;
