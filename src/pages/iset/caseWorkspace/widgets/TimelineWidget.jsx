import React, { useMemo } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Box,
  ButtonDropdown,
  Header,
  Link,
  SpaceBetween,
  StatusIndicator,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const TimelineWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseData } = useCaseWorkspace();

  const events = useMemo(() => {
    if (!caseData) return [];
    const base = [];
    caseData.actionPlans?.forEach(plan => {
      base.push({
        label: plan.title,
        description: `Plan ${plan.status}`,
        icon: plan.status === "open" ? "status-info" : "status-positive",
        timestamp: plan.startDate,
      });
      plan.interventions?.forEach(intervention => {
        base.push({
          label: `Intervention ${intervention.code}`,
          description: intervention.title,
          icon: "status-info",
          timestamp: intervention.startDate,
          additionalInfo: intervention.notes,
        });
      });
    });
    return base.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [caseData]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Case timeline", metadata.aiContext ?? "");
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
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description ?? "Chronology of action plans, interventions, and key updates."}
        >
          {metadata.title ?? "Timeline"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Timeline settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {events.length === 0 ? (
        <Box padding="m">
          <StatusIndicator type="info">No timeline events recorded yet.</StatusIndicator>
        </Box>
      ) : (
        <SpaceBetween size="s">
          {events.map(event => {
            const statusType =
              event.icon === "status-positive"
                ? "success"
                : event.icon === "status-warning"
                ? "warning"
                : "info";
            return (
              <Box key={`${event.label}-${event.timestamp}`} padding="m" background="layer-1" borderRadius="medium">
                <SpaceBetween size="xxs">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <strong>{event.label}</strong>
                    <StatusIndicator type={statusType}>{event.description}</StatusIndicator>
                  </div>
                  <div style={{ color: "var(--color-text-body-secondary)" }}>
                    {event.timestamp ? new Date(event.timestamp).toLocaleString() : "Pending date"}
                  </div>
                  {event.additionalInfo && (
                    <div style={{ color: "var(--color-text-body-secondary)" }}>{event.additionalInfo}</div>
                  )}
                </SpaceBetween>
              </Box>
            );
          })}
        </SpaceBetween>
      )}
    </BoardItem>
  );
};

export default TimelineWidget;
