import React, { useMemo } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Badge,
  Box,
  Button,
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

const InterventionsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    caseData,
    selectedActionPlanId,
    updateIntervention,
  } = useCaseWorkspace();

  const activePlan = useMemo(
    () => caseData?.actionPlans?.find(plan => plan.id === selectedActionPlanId),
    [caseData, selectedActionPlanId]
  );

  const interventions = activePlan?.interventions ?? [];

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Interventions", metadata.aiContext ?? "");
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

  const statusBadge = status => {
    if (status === "ok") return <Badge color="green">OK</Badge>;
    if (status === "warning") return <Badge color="blue">Warning</Badge>;
    if (status === "error") return <Badge color="red">Error</Badge>;
    return <Badge color="grey">Pending</Badge>;
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={
            metadata.description ??
            "Manage ILMP-compliant intervention data, including budget pots and outcomes."
          }
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Button iconName="add-plus" disabled={!activePlan}>
                Add intervention
              </Button>
              <Button iconName="edit" disabled={!activePlan}>
                Edit selected
              </Button>
            </SpaceBetween>
          }
        >
          {metadata.title ?? "Interventions"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Interventions settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {activePlan ? (
        <Table
          trackBy="id"
          items={interventions}
          variant="embedded"
          columnDefinitions={[
            { id: "code", header: "Code", cell: item => item.code ?? "—", isRowHeader: true },
            { id: "title", header: "Description", cell: item => item.title ?? "—" },
            {
              id: "dates",
              header: "Start → End",
              cell: item =>
                `${item.startDate ? new Date(item.startDate).toLocaleDateString() : "—"} → ${
                  item.endDate ? new Date(item.endDate).toLocaleDateString() : "—"
                }`,
            },
            { id: "outcome", header: "Outcome", cell: item => item.outcome ?? "—" },
            { id: "duration", header: "Duration (weeks)", cell: item => item.durationWeeks ?? "—" },
            { id: "cost", header: "Cost", cell: item => formatCurrency(item.cost) },
            { id: "pot", header: "Budget pot", cell: item => item.potId ?? "Unmapped" },
            {
              id: "compliance",
              header: "Compliance",
              cell: item => (
                <SpaceBetween size="xxs" direction="horizontal">
                  {statusBadge(item.compliance?.ilmp ?? "pending")}
                  {statusBadge(item.compliance?.finance ?? "pending")}
                </SpaceBetween>
              ),
            },
          ]}
          empty={<Box padding="m">No interventions defined for this action plan.</Box>}
        />
      ) : (
        <Box padding="m">
          <StatusIndicator type="info">Select an action plan to manage interventions.</StatusIndicator>
        </Box>
      )}
    </BoardItem>
  );
};

export default InterventionsWidget;
