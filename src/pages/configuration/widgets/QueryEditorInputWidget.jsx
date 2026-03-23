import React, { useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Button,
  ButtonDropdown,
  CodeEditor,
  FileUpload,
  FormField,
  Header,
  Link,
  SpaceBetween,
  Box,
  StatusIndicator,
} from "@cloudscape-design/components";
import boardItemI18nStrings from "../../../widgets/common";
import ace from "ace-builds";
import "ace-builds/webpack-resolver";
import "ace-builds/src-noconflict/mode-sql";
import "ace-builds/src-noconflict/theme-dawn";
import "ace-builds/src-noconflict/theme-dracula";

ace.config.set("useWorker", false);

const MAX_SQL_UPLOAD_BYTES = 900 * 1024;

const formatFileSize = bytes => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const readTextFile = file => {
  if (!file) return Promise.resolve("");
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.readAsText(file);
  });
};

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
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadedFileInfo, setLoadedFileInfo] = useState(null);

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

  const handleFileChange = async ({ detail }) => {
    const files = Array.isArray(detail?.value) ? detail.value : [];
    setSelectedFiles(files);
    setUploadError(null);
    if (!files.length) {
      return;
    }
    setLoadedFileInfo(null);

    const file = files[0];
    const name = String(file?.name || "");
    const lowerName = name.toLowerCase();
    const hasSupportedExtension = lowerName.endsWith(".sql") || lowerName.endsWith(".txt");
    if (!hasSupportedExtension) {
      setSelectedFiles([]);
      setUploadError("Select a .sql or .txt file.");
      return;
    }

    const size = Number(file?.size || 0);
    if (!size) {
      setSelectedFiles([]);
      setUploadError("The selected file is empty.");
      return;
    }
    if (size > MAX_SQL_UPLOAD_BYTES) {
      setSelectedFiles([]);
      setUploadError(
        `The selected file is ${formatFileSize(size)}. Query Editor uploads are limited to ${formatFileSize(MAX_SQL_UPLOAD_BYTES)} so the request stays within the server's 1 MB JSON limit.`,
      );
      return;
    }

    setIsLoadingFile(true);
    try {
      const rawText = await readTextFile(file);
      const nextSql = String(rawText || "").replace(/^\uFEFF/, "");
      if (!nextSql.trim()) {
        setUploadError("The selected file does not contain any SQL text.");
        return;
      }

      const hasExistingSql = typeof sql === "string" && sql.trim().length > 0;
      const shouldReplace =
        !hasExistingSql ||
        nextSql.trim() === sql.trim() ||
        typeof window === "undefined" ||
        window.confirm(`Replace the current SQL editor text with ${name}?`);

      if (!shouldReplace) {
        return;
      }

      setSql?.(nextSql);
      setLoadedFileInfo({
        name,
        size,
      });
    } catch (err) {
      setUploadError(err?.message || "The selected file could not be read.");
    } finally {
      setSelectedFiles([]);
      setIsLoadingFile(false);
    }
  };

  const canRun =
    typeof sql === "string" && sql.trim().length > 0 && !isRunning && !isLoadingFile;

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
        {uploadError ? (
          <Alert type="error" header="SQL file upload failed">
            {uploadError}
          </Alert>
        ) : null}
        <FormField
          label="SQL text"
          description="Multiple statements allowed (separate with semicolons). You can type directly or load a .sql file into the editor. Results are capped at 100 rows per SELECT."
        >
          <CodeEditor
            ace={ace}
            language="sql"
            value={sql || ""}
            onDelayedChange={event => setSql?.(event.detail.value)}
            preferences={preferences}
            onPreferencesChange={event => setPreferences(event.detail)}
            editorContentHeight={320}
            ariaLabel="SQL text editor"
          />
        </FormField>
        <FormField
          label="Load SQL file"
          description="Upload one .sql or .txt file to replace the current editor text. Review or edit the SQL before running it."
        >
          <FileUpload
            value={selectedFiles}
            onChange={handleFileChange}
            multiple={false}
            accept={[".sql", ".txt", "text/plain"]}
            loading={isLoadingFile}
            constraintText={`One .sql or .txt file, up to ${formatFileSize(MAX_SQL_UPLOAD_BYTES)}.`}
          />
        </FormField>
        {isLoadingFile ? (
          <StatusIndicator type="loading">Loading SQL file into the editor</StatusIndicator>
        ) : null}
        {loadedFileInfo ? (
          <StatusIndicator type="success">
            Loaded {loadedFileInfo.name} ({formatFileSize(loadedFileInfo.size)}) into the editor.
          </StatusIndicator>
        ) : null}
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" onClick={handleRun} loading={!!isRunning} disabled={!canRun}>
            Run
          </Button>
          {!canRun && (
            <Box color="text-body-secondary" fontSize="body-s">
              {isLoadingFile ? "Wait for the SQL file to finish loading." : "Enter SQL text to run."}
            </Box>
          )}
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default QueryEditorInputWidget;
