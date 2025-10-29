import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Box,
  Button,
  ButtonDropdown,
  Header,
  Link,
  SpaceBetween,
  Tabs,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const ExportPreviewWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseData } = useCaseWorkspace();

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Export preview", metadata.aiContext ?? "");
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
          description={metadata.description ?? "Generate ILMP XML and finance postings before export."}
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Button iconName="download">Download ILMP XML</Button>
              <Button iconName="file">Download finance report</Button>
            </SpaceBetween>
          }
        >
          {metadata.title ?? "Export preview"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Export preview settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Tabs
        tabs={[
          {
            id: "ilmp",
            label: "ILMP XML",
            content: (
              <Box padding="m" fontFamily="monospace" fontSize="body-s">
                &lt;ILMP&gt;...scaffold preview for {caseData?.id ?? "case"}...&lt;/ILMP&gt;
              </Box>
            ),
          },
          {
            id: "finance",
            label: "Finance postings",
            content: (
              <Box padding="m" fontFamily="monospace" fontSize="body-s">
                Posting summary for agreement {caseData?.agreementNumber ?? "—"} will appear here.
              </Box>
            ),
          },
        ]}
      />
    </BoardItem>
  );
};

export default ExportPreviewWidget;
