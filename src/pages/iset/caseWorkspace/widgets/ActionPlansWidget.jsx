import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Button,
  ButtonDropdown,
  Header,
  Link,
  StatusIndicator,
  Table,
  Box,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const ActionPlansWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    caseData,
    selectedActionPlanId,
    setSelectedActionPlanId,
    updateActionPlan,
  } = useCaseWorkspace();

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Action plans", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const plans = caseData?.actionPlans ?? [];

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
          description={metadata.description ?? "Manage action plans and select one to edit interventions."}
          actions={<Button iconName="add-plus">New action plan</Button>}
        >
          {metadata.title ?? "Action plans"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Action plans settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {plans.length ? (
        <Table
          trackBy="id"
          variant="embedded"
          resizableColumns
          selectionType="single"
          selectedItems={plans.filter(plan => plan.id === selectedActionPlanId)}
          onSelectionChange={({ detail }) => {
            const plan = detail?.selectedItems?.[0];
            if (plan?.id) {
              setSelectedActionPlanId(plan.id);
            }
          }}
          columnDefinitions={[
            { id: "title", header: "Plan", cell: item => item.title || "Untitled", isRowHeader: true },
            {
              id: "dates",
              header: "Dates",
              cell: item =>
                `${item.startDate ? new Date(item.startDate).toLocaleDateString() : "—"} → ${
                  item.endDate ? new Date(item.endDate).toLocaleDateString() : "—"
                }`,
            },
            {
              id: "status",
              header: "Status",
              cell: item => (
                <StatusIndicator type={item.status === "open" ? "info" : "success"}>
                  {item.status ?? "unknown"}
                </StatusIndicator>
              ),
            },
            {
              id: "interventions",
              header: "Interventions",
              cell: item => (item.interventions ? item.interventions.length : 0),
            },
          ]}
          items={plans}
          empty={<Box padding="m">No action plans defined yet.</Box>}
          header={<Header variant="h3">Action plans</Header>}
        />
      ) : (
        <Box padding="m">No action plans defined yet.</Box>
      )}
    </BoardItem>
  );
};

export default ActionPlansWidget;
