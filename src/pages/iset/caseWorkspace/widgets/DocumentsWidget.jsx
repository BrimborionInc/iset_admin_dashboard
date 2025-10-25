import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
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

const DocumentsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseData } = useCaseWorkspace();

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Documents", metadata.aiContext ?? "");
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
          description={metadata.description ?? "Manage supporting documentation for this case."}
          actions={<Button iconName="upload">Upload document</Button>}
        >
          {metadata.title ?? "Documents"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Documents settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {caseData?.documents?.length ? (
        <Table
          items={caseData.documents}
          columnDefinitions={[
            { id: "name", header: "File name", cell: item => item.name || "Untitled" },
            { id: "uploadedBy", header: "Uploaded by", cell: item => item.uploadedBy || "—" },
            {
              id: "uploadedAt",
              header: "Uploaded on",
              cell: item => (item.uploadedAt ? new Date(item.uploadedAt).toLocaleString() : "—"),
            },
          ]}
          trackBy="id"
          empty={<Box padding="m">No documents uploaded yet.</Box>}
        />
      ) : (
        <Box padding="m">
          <StatusIndicator type="info">No documents uploaded yet.</StatusIndicator>
        </Box>
      )}
    </BoardItem>
  );
};

export default DocumentsWidget;
