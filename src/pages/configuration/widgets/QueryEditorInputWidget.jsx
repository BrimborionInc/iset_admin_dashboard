import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Button,
  ButtonDropdown,
  Checkbox,
  CodeEditor,
  FileUpload,
  FormField,
  Header,
  Input,
  Link,
  Select,
  SpaceBetween,
  Table,
  Tabs,
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
  exportDatabases = [],
  selectedExportDatabase = "",
  exportTables = [],
  selectedExportTables = [],
  exportOutputPath = "",
  exportMetadataError,
  isExportMetadataLoading,
  isExporting,
  exportStatus,
  onExportDatabaseChange,
  onReloadExportMetadata,
  onExportTableSelectionChange,
  onExportOutputPathChange,
  onRunExport,
}) => {
  const [preferences, setPreferences] = useState({
    wrapLines: true,
    theme: "dawn",
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [loadedFileInfo, setLoadedFileInfo] = useState(null);
  const [activeToolTabId, setActiveToolTabId] = useState("sql-editor");
  const [activeExportTabId, setActiveExportTabId] = useState("selection");

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

  useEffect(() => {
    if (isExporting || exportStatus) {
      setActiveToolTabId("server-export");
      setActiveExportTabId("progress");
    }
  }, [exportStatus, isExporting]);

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

  const databaseOptions = useMemo(
    () =>
      exportDatabases.map(database => ({
        label: database?.label || database?.name || "",
        value: database?.name || database?.value || "",
        description: database?.isSystemSchema ? "System schema" : undefined,
      })).filter(option => option.value),
    [exportDatabases],
  );

  const selectedDatabaseOption = useMemo(
    () => databaseOptions.find(option => option.value === selectedExportDatabase) || null,
    [databaseOptions, selectedExportDatabase],
  );

  const selectedTableItems = useMemo(() => {
    const selectedNames = new Set(selectedExportTables);
    return exportTables.filter(table => selectedNames.has(table.name));
  }, [exportTables, selectedExportTables]);

  const exportTableColumns = useMemo(
    () => [
      {
        id: "name",
        header: "Table",
        cell: item => item?.label || item?.name || "-",
      },
    ],
    [],
  );

  const exportDisabledReason = (() => {
    if (isExportMetadataLoading) return "Wait for server export options to finish loading.";
    if (!selectedExportDatabase) return "Select a database to export.";
    if (!selectedExportTables.length) return "Select at least one table to export.";
    if (!(typeof exportOutputPath === "string" && exportOutputPath.trim())) {
      return "Enter a server-local .sql file path.";
    }
    return "";
  })();

  const canRunExport = !exportDisabledReason && !isExporting;

  const handleRunExport = () => {
    if (!canRunExport) {
      return;
    }
    setActiveToolTabId("server-export");
    setActiveExportTabId("progress");
    onRunExport?.();
  };

  const formatTimestamp = value => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return String(value);
    }
    return parsed.toLocaleString();
  };

  const formatDuration = value => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return "-";
    if (numeric >= 1000) {
      return `${(numeric / 1000).toFixed(1)} s`;
    }
    return `${Math.round(numeric)} ms`;
  };

  const sqlEditorContent = (
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
  );

  const exportSelectionContent = (
    <SpaceBetween size="m">
      {exportMetadataError ? (
        <Alert type="error" header="Server export setup failed">
          {exportMetadataError.message || "Failed to load server export options."}
        </Alert>
      ) : null}
      <Box color="text-body-secondary" fontSize="body-s">
        Server export writes a self-contained SQL dump directly on the admin server at the file path below.
      </Box>
      <FormField
        label="Database"
        description="Select the database to export. All base tables are selected by default when the database changes."
      >
        <SpaceBetween direction="horizontal" size="xs">
          <Select
            selectedOption={selectedDatabaseOption}
            onChange={({ detail }) => onExportDatabaseChange?.(detail.selectedOption?.value || "")}
            options={databaseOptions}
            placeholder="Select database"
            loadingText="Loading databases"
            disabled={!!isExportMetadataLoading || !!isExporting}
            statusType={isExportMetadataLoading ? "loading" : "finished"}
          />
          <Button
            onClick={() => onReloadExportMetadata?.()}
            disabled={!!isExportMetadataLoading || !!isExporting}
          >
            Refresh
          </Button>
        </SpaceBetween>
      </FormField>
      <Table
        variant="embedded"
        trackBy="name"
        selectionType="multi"
        items={exportTables}
        selectedItems={selectedTableItems}
        onSelectionChange={({ detail }) =>
          onExportTableSelectionChange?.((detail.selectedItems || []).map(item => item?.name).filter(Boolean))
        }
        columnDefinitions={exportTableColumns}
        loading={!!isExportMetadataLoading}
        loadingText="Loading tables"
        wrapLines
        header={(
          <Header
            variant="h3"
            counter={`(${selectedExportTables.length}/${exportTables.length})`}
            actions={(
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  onClick={() => onExportTableSelectionChange?.(exportTables.map(table => table.name))}
                  disabled={!exportTables.length || !!isExportMetadataLoading || !!isExporting}
                >
                  Select all
                </Button>
                <Button
                  onClick={() => onExportTableSelectionChange?.([])}
                  disabled={!selectedExportTables.length || !!isExportMetadataLoading || !!isExporting}
                >
                  Unselect all
                </Button>
              </SpaceBetween>
            )}
          >
            Tables to export
          </Header>
        )}
        empty={(
          <Box color="text-body-secondary" padding="m">
            {selectedExportDatabase ? "No base tables were found for the selected database." : "Select a database."}
          </Box>
        )}
      />
      <FormField label="Dump content" description="Hardwired to the requested Workbench-style export mode.">
        <Select
          selectedOption={{ label: "Dump Structure and Data", value: "structure_and_data" }}
          options={[{ label: "Dump Structure and Data", value: "structure_and_data" }]}
          disabled
        />
      </FormField>
      <FormField
        label="Export to self-contained file"
        description="Edit the server-local file path if you want the dump written somewhere else on the admin server."
      >
        <Input
          value={exportOutputPath || ""}
          onChange={({ detail }) => onExportOutputPathChange?.(detail.value)}
          disabled={!!isExportMetadataLoading || !!isExporting}
          placeholder="C:\\Users\\...\\database-YYYYMMDD.sql"
        />
      </FormField>
      <Checkbox checked disabled>
        Include Create Schema
      </Checkbox>
      <SpaceBetween direction="horizontal" size="xs">
        <Button variant="primary" onClick={handleRunExport} loading={!!isExporting} disabled={!canRunExport}>
          Start Export
        </Button>
        {!canRunExport && (
          <Box color="text-body-secondary" fontSize="body-s">
            {exportDisabledReason}
          </Box>
        )}
      </SpaceBetween>
    </SpaceBetween>
  );

  const exportProgressContent = (
    <SpaceBetween size="m">
      {isExporting ? (
        <StatusIndicator type="loading">Creating SQL dump on the server</StatusIndicator>
      ) : null}
      {!isExporting && exportStatus?.type === "error" ? (
        <Alert type="error" header="Server export failed">
          <SpaceBetween size="xs">
            <Box>{exportStatus.message || "Server export failed."}</Box>
            {Array.isArray(exportStatus.missingTables) && exportStatus.missingTables.length ? (
              <Box>Missing tables: {exportStatus.missingTables.join(", ")}</Box>
            ) : null}
            {exportStatus.outputPath ? <Box>File path: {exportStatus.outputPath}</Box> : null}
          </SpaceBetween>
        </Alert>
      ) : null}
      {!isExporting && exportStatus?.type === "success" ? (
        <Alert type="success" header="Server export completed">
          <SpaceBetween size="xs">
            <Box>Database: {exportStatus.database || "-"}</Box>
            <Box>Tables exported: {exportStatus.tableCount || 0}</Box>
            <Box>Output file: {exportStatus.outputPath || "-"}</Box>
            <Box>File size: {formatFileSize(exportStatus.sizeBytes)}</Box>
            <Box>Started: {formatTimestamp(exportStatus.startedAt)}</Box>
            <Box>Finished: {formatTimestamp(exportStatus.finishedAt)}</Box>
            <Box>Duration: {formatDuration(exportStatus.durationMs)}</Box>
          </SpaceBetween>
        </Alert>
      ) : null}
      {!isExporting && !exportStatus ? (
        <Box color="text-body-secondary">Press Start Export to create a self-contained SQL file.</Box>
      ) : null}
    </SpaceBetween>
  );

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
      <Tabs
        activeTabId={activeToolTabId}
        onChange={({ detail }) => setActiveToolTabId(detail.activeTabId)}
        tabs={[
          {
            id: "sql-editor",
            label: "SQL Editor",
            content: sqlEditorContent,
          },
          {
            id: "server-export",
            label: "Server Export",
            content: (
              <Tabs
                activeTabId={activeExportTabId}
                onChange={({ detail }) => setActiveExportTabId(detail.activeTabId)}
                tabs={[
                  {
                    id: "selection",
                    label: "Object Selection",
                    content: exportSelectionContent,
                  },
                  {
                    id: "progress",
                    label: "Export Progress",
                    content: exportProgressContent,
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </BoardItem>
  );
};

export default QueryEditorInputWidget;
