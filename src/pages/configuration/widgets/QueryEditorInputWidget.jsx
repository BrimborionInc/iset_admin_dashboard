import React, { useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Button,
  ButtonDropdown,
  CodeEditor,
  FormField,
  Header,
  Link,
  SpaceBetween,
  Box,
} from "@cloudscape-design/components";
import boardItemI18nStrings from "../../../widgets/common";
import ace from "ace-builds";
import "ace-builds/webpack-resolver";
import "ace-builds/src-noconflict/mode-sql";
import "ace-builds/src-noconflict/theme-dawn";
import "ace-builds/src-noconflict/theme-dracula";

ace.config.set("useWorker", false);

const QueryEditorInputWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  sql,
  setSql,
  onRun,
  isRunning,
}) => {
  const [preferences, setPreferences] = useState({
    wrapLines: true,
    theme: "dawn",
  });

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
            metadata.helpTitle || metadata.title || "Query editor",
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
        ariaLabel="Query editor widget settings"
        variant="icon"
        items={[{ id: "remove", text: "Remove widget" }]}
        onItemClick={({ detail }) => {
          if (detail?.id === "remove") {
            actions.removeItem();
          }
        }}
      />
    ) : undefined;

  const handleRun = () => {
    if (typeof onRun === "function") {
      onRun();
    }
  };

  const canRun = typeof sql === "string" && sql.trim().length > 0 && !isRunning;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={metadata?.description}
          info={infoLink}
        >
          {metadata?.title || "SQL query editor"}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        <FormField
          label="SQL statement"
          description="Multiple statements allowed (separate with semicolons). Results are capped at 100 rows per SELECT."
        >
          <CodeEditor
            ace={ace}
            language="sql"
            value={sql || ""}
            onDelayedChange={event => setSql?.(event.detail.value)}
            preferences={preferences}
            onPreferencesChange={event => setPreferences(event.detail)}
            editorContentHeight={320}
            ariaLabel="SQL statement editor"
          />
        </FormField>
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" onClick={handleRun} loading={!!isRunning} disabled={!canRun}>
            Run
          </Button>
          {!canRun && (
            <Box color="text-body-secondary" fontSize="body-s">
              Enter a SQL statement to run.
            </Box>
          )}
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default QueryEditorInputWidget;
