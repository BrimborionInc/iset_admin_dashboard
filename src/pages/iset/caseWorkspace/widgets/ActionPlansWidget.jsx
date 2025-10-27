import React, { useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
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
import NewActionPlanModal from "../modals/NewActionPlanModal.jsx";

const ActionPlansWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    caseData,
    selectedActionPlanId,
    setSelectedActionPlanId,
    refresh,
  } = useCaseWorkspace();
  const [modalVisible, setModalVisible] = useState(false);
  const [createMessage, setCreateMessage] = useState(null);

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

  const handleCreated = plan => {
    setCreateMessage(plan?.name || "Action plan created.");
    if (plan?.id) {
      setSelectedActionPlanId(plan.id);
    }
    refresh().catch(() => {});
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description ?? "Manage action plans and select one to edit interventions."}
          actions={
            <Button iconName="add-plus" onClick={() => setModalVisible(true)}>
              New action plan
            </Button>
          }
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
      <SpaceBetween size="m">
        {createMessage && (
          <Alert type="success" onDismiss={() => setCreateMessage(null)}>
            {createMessage}
          </Alert>
        )}
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
                cell: item => {
                  const start = item.startDate ? new Date(item.startDate).toLocaleDateString() : "-";
                  const end = item.endDate ? new Date(item.endDate).toLocaleDateString() : "-";
                  return `${start} - ${end}`;
                },
              },
              {
                id: "status",
                header: "Status",
                cell: item => (
                  <StatusIndicator type={item.status === "open" || item.status === "draft" ? "info" : "success"}>
                    {item.status ?? "unknown"}
                  </StatusIndicator>
                ),
              },
              {
                id: "interventions",
                header: "Interventions",
                cell: item =>
                  Number.isFinite(item.interventionCount)
                    ? item.interventionCount
                    : item.interventions
                    ? item.interventions.length
                    : 0,
              },
            ]}
            items={plans}
            empty={<Box padding="m">No action plans defined yet.</Box>}
            header={<Header variant="h3">Action plans</Header>}
          />
        ) : (
          <Box padding="m">No action plans defined yet.</Box>
        )}
      </SpaceBetween>
      {modalVisible && (
        <NewActionPlanModal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          onCreated={plan => {
            setModalVisible(false);
            handleCreated(plan);
          }}
        />
      )}
    </BoardItem>
  );
};

export default ActionPlansWidget;
