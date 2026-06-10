import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  Header,
  Link,
  SpaceBetween,
  Select,
  StatusIndicator,
  Table,
  Tabs,
} from "@cloudscape-design/components";
import { CodeView } from "@cloudscape-design/code-view";
import boardItemI18nStrings from "../../../widgets/common";

const QueryEditorResultsWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  resultSet,
  error,
  isRunning,
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
            metadata.helpTitle || metadata.title || "Query results",
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
        ariaLabel="Query results widget settings"
        variant="icon"
        items={[{ id: "remove", text: "Remove widget" }]}
        onItemClick={({ detail }) => {
          if (detail?.id === "remove") {
            actions.removeItem();
          }
        }}
      />
    ) : undefined;

  const results = useMemo(() => (
    Array.isArray(resultSet?.results) ? resultSet.results : []
  ), [resultSet?.results]);
  const statements = useMemo(() => (
    Array.isArray(resultSet?.statements) ? resultSet.statements : []
  ), [resultSet?.statements]);
  const [activeStatement, setActiveStatement] = useState(0);

  useEffect(() => {
    if (activeStatement >= results.length) {
      setActiveStatement(0);
    }
  }, [activeStatement, results.length]);

  const statementOptions = useMemo(() => (
    results.map((entry, index) => {
      const statementText = statements[index] || entry?.statement || "";
      const preview = statementText
        ? statementText.replace(/\s+/g, " ").trim().slice(0, 80)
        : "";
      return {
        value: String(index),
        label: `Statement ${index + 1}`,
        description: preview || undefined,
      };
    })
  ), [results, statements]);

  const selectedStatement = statementOptions[activeStatement] || statementOptions[0] || null;

  const activeResult = useMemo(() => results[activeStatement] || null, [activeStatement, results]);
  const items = useMemo(
    () => (activeResult?.type === "select" && Array.isArray(activeResult.rows) ? activeResult.rows : []),
    [activeResult]
  );
  const truncated = !!activeResult?.truncated;
  const resultsDescription = (() => {
    if (activeResult?.type !== "select") return metadata?.description;
    const detail = truncated ? "Showing first 100 rows (truncated)." : `Rows returned: ${items.length}.`;
    if (metadata?.description) return `${metadata.description} ${detail}`;
    return detail;
  })();

  const formattedJson = useMemo(() => {
    if (!activeResult) return "";
    if (activeResult.type === "select") {
      const columns = Array.isArray(activeResult.columns) && activeResult.columns.length > 0
        ? activeResult.columns
        : (items[0] ? Object.keys(items[0]) : []);
      const rows = items.map(row => {
        const ordered = columns.reduce((acc, key) => {
          acc[key] = row?.[key];
          return acc;
        }, {});
        return ordered;
      });
      return JSON.stringify({ columns, rows, rowCount: items.length, truncated }, null, 2);
    }
    if (activeResult.type === "write") {
      return JSON.stringify({
        rowsAffected: activeResult.rowsAffected ?? 0,
        message: activeResult.message || "OK"
      }, null, 2);
    }
    return JSON.stringify(activeResult, null, 2);
  }, [activeResult, items, truncated]);

  const formatTableValue = value => {
    if (value === null || typeof value === "undefined") return "-";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const tableColumns = useMemo(() => {
    if (!activeResult || activeResult.type !== "select") return [];
    const names = Array.isArray(activeResult.columns) && activeResult.columns.length > 0
      ? activeResult.columns
      : (items[0] ? Object.keys(items[0]) : []);
    return names.map(name => ({
      id: name,
      header: name,
      cell: item => formatTableValue(item?.[name]),
    }));
  }, [activeResult, items]);

  const csvOutput = useMemo(() => {
    if (!activeResult) return "";
    if (activeResult.type === "select") {
      const columns = Array.isArray(activeResult.columns) && activeResult.columns.length > 0
        ? activeResult.columns
        : (items[0] ? Object.keys(items[0]) : []);
      const escapeCsv = value => {
        if (value === null || typeof value === "undefined") return "";
        const raw = typeof value === "string" ? value : JSON.stringify(value);
        const escaped = raw.replace(/"/g, "\"\"");
        if (/[",\n\r]/.test(escaped)) return `"${escaped}"`;
        return escaped;
      };
      const header = columns.map(escapeCsv).join(",");
      const rows = items.map(row => columns.map(key => escapeCsv(row?.[key])).join(","));
      return [header, ...rows].join("\n");
    }
    if (activeResult.type === "write") {
      return `rowsAffected,message\n${activeResult.rowsAffected ?? 0},"${(activeResult.message || "OK").replace(/"/g, "\"\"")}"`;
    }
    return "";
  }, [activeResult, items]);

  const [activeTabId, setActiveTabId] = useState("csv");

  const handleCopyJson = useMemo(() => () => {
    if (!formattedJson) return;
    try {
      navigator?.clipboard?.writeText(formattedJson);
    } catch {
      // ignore clipboard errors
    }
  }, [formattedJson]);

  const handleCopyCsv = useMemo(() => () => {
    if (!csvOutput) return;
    try {
      navigator?.clipboard?.writeText(csvOutput);
    } catch {
      // ignore clipboard errors
    }
  }, [csvOutput]);

  const tableContent = !activeResult ? (
    <Box color="text-body-secondary">Run a query to see results.</Box>
  ) : activeResult.type !== "select" ? (
    <Box color="text-body-secondary">No tabular results for write statements.</Box>
  ) : (
    <Table
      variant="embedded"
      items={items}
      columnDefinitions={tableColumns}
      resizableColumns
      wrapLines
      header={<Header variant="h3">Results</Header>}
      empty={<Box>No rows returned.</Box>}
    />
  );

  const jsonContent = !activeResult ? (
    <Box color="text-body-secondary">Run a query to see JSON output.</Box>
  ) : (
    <CodeView
      content={formattedJson || ""}
      wrapLines
      lineNumbers={false}
      actions={(
        <Button onClick={handleCopyJson} disabled={!formattedJson} iconName="copy">
          Copy
        </Button>
      )}
      ariaLabel="Query results JSON"
    />
  );

  const csvContent = !activeResult ? (
    <Box color="text-body-secondary">Run a query to see CSV output.</Box>
  ) : (
    <CodeView
      content={csvOutput || ""}
      wrapLines
      lineNumbers={false}
      actions={(
        <Button onClick={handleCopyCsv} disabled={!csvOutput} iconName="copy">
          Copy
        </Button>
      )}
      ariaLabel="Query results CSV"
    />
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={resultsDescription}
          info={infoLink}
          actions={
            results.length > 1 ? (
              <Select
                selectedOption={selectedStatement}
                onChange={({ detail }) => {
                  const next = Number(detail.selectedOption?.value);
                  if (!Number.isNaN(next)) setActiveStatement(next);
                }}
                options={statementOptions}
                placeholder="Select statement"
              />
            ) : undefined
          }
        >
          {metadata?.title || "Query results"}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        {isRunning && <StatusIndicator type="loading">Running query</StatusIndicator>}
        {error && (
          <Alert type="error" header="Query failed">
            <Box>{error.message || "Query failed."}</Box>
            {Number.isInteger(error.statementIndex) && (
              <Box>Statement: {error.statementIndex + 1}</Box>
            )}
            {error.statement && (
              <Box>SQL: {error.statement}</Box>
            )}
            {error.code && <Box>Code: {error.code}</Box>}
            {error.sqlState && <Box>SQL state: {error.sqlState}</Box>}
          </Alert>
        )}
        {!isRunning && !error && (
          <Tabs
            activeTabId={activeTabId}
            onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
            tabs={[
              {
                id: "csv",
                label: "CSV",
                content: csvContent,
              },
              {
                id: "json",
                label: "JSON",
                content: jsonContent,
              },
              {
                id: "table",
                label: "Table",
                content: tableContent,
              },
            ]}
          />
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default QueryEditorResultsWidget;
