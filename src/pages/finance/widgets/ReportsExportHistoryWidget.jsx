import React, { useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Table,
  Box,
  Button,
  StatusIndicator,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useReportsData } from "./ReportsDataContext.jsx";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-reports-exports-widths-v1";

const loadColumnWidths = () => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(entry => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const id = typeof entry.id === "string" ? entry.id : null;
        const width = Number(entry.width);
        if (!id || !Number.isFinite(width)) {
          return null;
        }
        return { id, width };
      })
      .filter(Boolean);
  } catch (error) {
    console.error("[FinanceReports] failed to parse export history column widths", error);
    return [];
  }
};

const persistColumnWidths = widths => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (Array.isArray(widths) && widths.length) {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    } else {
      window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
    }
  } catch (error) {
    console.error("[FinanceReports] failed to persist export history column widths", error);
  }
};

const ReportsExportHistoryWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { exportsForSelectedReport, acknowledgeExport, selectedReport } = useReportsData();
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths);

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(helpContent, metadata.helpTitle ?? "Export history", metadata.aiContext ?? "");
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

  const widthMap = useMemo(() => new Map(columnWidths.map(entry => [entry.id, entry.width])), [columnWidths]);

  const columnDefinitions = useMemo(
    () => [
      {
        id: "generatedOn",
        header: "Generated on",
        width: widthMap.get("generatedOn"),
        cell: item => new Date(item.generatedOn).toLocaleString(),
      },
      {
        id: "format",
        header: "Format",
        width: widthMap.get("format"),
        cell: item => `${item.format} v${item.envelopeVersion}`,
      },
      {
        id: "channel",
        header: "Channel",
        width: widthMap.get("channel"),
        cell: item => item.channel,
      },
      {
        id: "status",
        header: "Status",
        width: widthMap.get("status"),
        cell: item => (
          <StatusIndicator
            type={
              item.status === "acknowledged"
                ? "success"
                : item.status === "delivered"
                  ? "info"
                  : "warning"
            }
          >
            {item.status.replace(/_/g, " ")}
          </StatusIndicator>
        ),
      },
      {
        id: "acknowledgementOn",
        header: "Acknowledged on",
        width: widthMap.get("acknowledgementOn"),
        cell: item => (item.acknowledgementOn ? new Date(item.acknowledgementOn).toLocaleString() : "Pending"),
      },
      {
        id: "hash",
        header: "Hash",
        width: widthMap.get("hash"),
        cell: item => item.hash,
      },
    ],
    [widthMap]
  );

  const handleColumnWidthsChange = ({ detail }) => {
    const next = [];
    if (Array.isArray(detail?.columnWidths)) {
      detail.columnWidths.forEach(entry => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        const { id, width } = entry;
        const numeric = Number(width);
        if (typeof id === "string" && Number.isFinite(numeric)) {
          next.push({ id, width: numeric });
        }
      });
    } else if (Array.isArray(detail?.widths)) {
      detail.widths.forEach((width, index) => {
        const column = columnDefinitions[index];
        const numeric = Number(width);
        if (column && Number.isFinite(numeric)) {
          next.push({ id: column.id, width: numeric });
        }
      });
    }
    if (next.length) {
      setColumnWidths(next);
      persistColumnWidths(next);
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Monitor export packages and acknowledgements."
        >
          Export history
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Export history settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <Table
          items={exportsForSelectedReport}
          trackBy="id"
          columnDefinitions={columnDefinitions}
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          variant="embedded"
          empty={
            <Box padding="m">
              {selectedReport
                ? "No export packages generated yet."
                : "Select a report to review export history."}
            </Box>
          }
          header={
            <Header variant="h3" counter={`(${exportsForSelectedReport.length})`}>
              Submission exports
            </Header>
          }
        />
        <SpaceBetween size="xs" direction="horizontal">
          <Button
            disabled={!exportsForSelectedReport.some(exportItem => exportItem.status === "pending_ack")}
            onClick={() => {
              exportsForSelectedReport
                .filter(item => item.status === "pending_ack")
                .forEach(item => acknowledgeExport(item.id));
            }}
          >
            Mark pending as acknowledged
          </Button>
          <Button
            variant="link"
            href="/finance/reports?view=export-log"
          >
            Open export log
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default ReportsExportHistoryWidget;
