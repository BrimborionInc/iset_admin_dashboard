import React, { useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Link,
  Table,
  Box,
  Button,
  StatusIndicator,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { FINANCE_PEOPLE } from "./financeDemoData.js";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-allocations-snapshots-widths-v1";

const snapshots = [
  {
    id: "SNAP-FY24-Q2",
    capturedOn: "2024-09-30",
    capturedBy: FINANCE_PEOPLE.programLead,
    reason: "Quarterly close certification",
    totalMovement: 285000,
    adminRate: 12.4,
    reference: "Quarterly Board Pack Oct 2024",
  },
  {
    id: "SNAP-FY24-BRD",
    capturedOn: "2024-08-15",
    capturedBy: FINANCE_PEOPLE.ceo,
    reason: "Board reallocation session",
    totalMovement: 410000,
    adminRate: 11.8,
    reference: "Board Minutes NWAC-BRD-24-07",
  },
  {
    id: "SNAP-FY24-ESDC",
    capturedOn: "2024-07-31",
    capturedBy: FINANCE_PEOPLE.seniorDirector,
    reason: "ESDC variance response submission",
    totalMovement: 195000,
    adminRate: 12.1,
    reference: "ESDC Response Package Aug 2024",
  },
];

const loadColumnWidths = () => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
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
    console.error("[Allocations] failed to parse snapshots column widths", error);
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
    console.error("[Allocations] failed to persist snapshots column widths", error);
  }
};

const AllocationSnapshotsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths);

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Allocation snapshots",
            metadata.aiContext ?? ""
          );
        }}
      >
        Info
      </Link>
    ) : undefined;

  const widthMap = useMemo(() => new Map(columnWidths.map(entry => [entry.id, entry.width])), [columnWidths]);

  const columnDefinitions = useMemo(
    () => [
      {
        id: "capturedOn",
        header: "Captured on",
        width: widthMap.get("capturedOn"),
        cell: item => item.capturedOn,
      },
      {
        id: "reason",
        header: "Reason",
        width: widthMap.get("reason"),
        cell: item => (
          <SpaceBetween size="xxs">
            <Box variant="strong">{item.reason}</Box>
            <Box variant="awsui-key-label">{item.reference}</Box>
          </SpaceBetween>
        ),
      },
      {
        id: "capturedBy",
        header: "Captured by",
        width: widthMap.get("capturedBy"),
        cell: item => item.capturedBy,
      },
      {
        id: "totalMovement",
        header: "Total movement",
        width: widthMap.get("totalMovement"),
        cell: item => `$${item.totalMovement.toLocaleString("en-CA")}`,
      },
      {
        id: "adminRate",
        header: "Admin rate",
        width: widthMap.get("adminRate"),
        cell: item => (
          <StatusIndicator type={item.adminRate > 15 ? "warning" : "success"}>
            {item.adminRate.toFixed(1)}%
          </StatusIndicator>
        ),
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

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const selected = selectedItems[0];

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Capture and restore point-in-time allocation states."
        >
          Allocation snapshots
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Allocation snapshots settings"
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
          items={snapshots}
          trackBy="id"
          selectionType="single"
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
          columnDefinitions={columnDefinitions}
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          variant="embedded"
          header={
            <Header variant="h3" counter={`(${snapshots.length})`}>
              Saved snapshots
            </Header>
          }
        />
        <SpaceBetween size="xs" direction="horizontal">
          <Button
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              window.dispatchEvent(
                new CustomEvent("financeAllocations:restoreSnapshot", { detail: { snapshotId: selected.id } })
              );
            }}
          >
            View snapshot balances
          </Button>
          <Button
            disabled={!selected}
            variant="link"
            onClick={() => {
              if (!selected) return;
              window.dispatchEvent(
                new CustomEvent("financeAllocations:downloadSnapshot", { detail: { snapshotId: selected.id } })
              );
            }}
          >
            Download export
          </Button>
        </SpaceBetween>
        <Box variant="awsui-key-label">
          Snapshots will integrate with audit trail exports when the reporting engine lands.
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
};

export default AllocationSnapshotsWidget;
