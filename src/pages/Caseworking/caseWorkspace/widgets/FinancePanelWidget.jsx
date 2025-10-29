import React, { useMemo } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Box,
  ButtonDropdown,
  Header,
  Link,
  SpaceBetween,
  StatusIndicator,
  Table,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const formatCurrency = value =>
  typeof value === "number" ? `$${value.toLocaleString("en-CA")}` : "$0";

const FinancePanelWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseData } = useCaseWorkspace();

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Finance overview", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const financeSummary = caseData?.finance;
  const rows = useMemo(() => financeSummary?.pots ?? [], [financeSummary]);

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
          description={metadata.description ?? "Budget allocations, commitments, and actuals for this case."}
        >
          {metadata.title ?? "Finance panel"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Finance panel settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <Box>
          <SpaceBetween size="xs" direction="horizontal">
            <span><strong>Allocated:</strong> {formatCurrency(financeSummary?.allocated)}</span>
            <span><strong>Committed:</strong> {formatCurrency(financeSummary?.committed)}</span>
            <span><strong>Actuals:</strong> {formatCurrency(financeSummary?.actuals)}</span>
            <span><strong>Variance:</strong> {formatCurrency(financeSummary?.variance)}</span>
          </SpaceBetween>
        </Box>
        {rows.length ? (
          <Table
            trackBy="id"
            items={rows}
            variant="embedded"
            columnDefinitions={[
              { id: "name", header: "Budget pot", cell: item => item.name || "Unnamed", isRowHeader: true },
              { id: "allocated", header: "Allocated", cell: item => formatCurrency(item.allocated) },
              { id: "committed", header: "Committed", cell: item => formatCurrency(item.committed) },
              { id: "actual", header: "Actual", cell: item => formatCurrency(item.actual) },
              {
                id: "status",
                header: "Status",
                cell: item => {
                  const variance = item.allocated - item.actual;
                  return (
                    <StatusIndicator type={variance >= 0 ? "success" : "error"}>
                      {variance >= 0 ? "Within allocation" : "Overspend"}
                    </StatusIndicator>
                  );
                },
              },
            ]}
            empty={<Box padding="m">No finance data recorded yet.</Box>}
          />
        ) : (
          <Box padding="m">No finance data recorded yet.</Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default FinancePanelWidget;
