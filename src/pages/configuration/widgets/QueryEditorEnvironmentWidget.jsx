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
import boardItemI18nStrings from "../../../widgets/common";

const QueryEditorEnvironmentWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  envLabel,
  envLoading,
}) => {
  const infoLink = useMemo(() => {
    if (!metadata?.helpComponent || !toggleHelpPanel) return undefined;
    return (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const HelpComponent = metadata.helpComponent;
          toggleHelpPanel(
            <HelpComponent />,
            metadata.helpTitle || metadata.title || "Environment",
            metadata.aiContext || "",
          );
        }}
      >
        Info
      </Link>
    );
  }, [metadata, toggleHelpPanel]);

  const settingsMenu =
    actions && typeof actions.removeItem === "function" ? (
      <ButtonDropdown
        ariaLabel="Environment widget settings"
        variant="icon"
        items={[{ id: "remove", text: "Remove widget" }]}
        onItemClick={({ detail }) => {
          if (detail?.id === "remove") {
            actions.removeItem();
          }
        }}
      />
    ) : undefined;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={metadata?.description}
          info={infoLink}
        >
          {metadata?.title || "Environment"}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="xs">
        {envLoading ? (
          <StatusIndicator type="loading">Loading environment</StatusIndicator>
        ) : (
          <Box>Environment: {envLabel || "Unknown"}</Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default QueryEditorEnvironmentWidget;
