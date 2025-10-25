import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Box,
  Button,
  ButtonDropdown,
  Header,
  Link,
  SpaceBetween,
  Textarea,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const TasksNotesWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseData } = useCaseWorkspace();

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Tasks & notes", metadata.aiContext ?? "");
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
          description={metadata.description ?? "Capture follow-ups and internal notes for this case."}
          actions={<Button iconName="add-plus">Add note</Button>}
        >
          {metadata.title ?? "Tasks & notes"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Tasks and notes settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {caseData?.notes?.map(note => (
          <Box key={note.id} padding="m" background="layer-1" borderRadius="medium">
            <SpaceBetween size="xs">
              <strong>{note.author}</strong>
              <span style={{ color: "var(--color-text-body-secondary)" }}>
                {new Date(note.createdAt).toLocaleString()}
              </span>
              <Textarea value={note.body} readOnly ariaLabel="Note text" />
            </SpaceBetween>
          </Box>
        ))}
        {(!caseData?.notes || caseData.notes.length === 0) && (
          <Box padding="m" color="text-body-secondary">
            No notes yet. Use Add note to capture follow-ups for this case.
          </Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default TasksNotesWidget;
