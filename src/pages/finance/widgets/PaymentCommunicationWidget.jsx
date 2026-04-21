import React, { useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Table,
  Box,
  CollectionPreferences,
  Pagination,
  TextFilter,
  Badge,
  Link,
  Button,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { usePaymentsData } from "./PaymentsDataContext.jsx";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-payments-communications-widths-v2";
const LEGACY_PREFERENCES_STORAGE_KEY = "finance-payments-communications-preferences-v2";
const PREFERENCES_STORAGE_KEY = "finance-payments-communications-preferences-v3";
const DEFAULT_PAGE_SIZE = 10;
const CLIENT_NAME_COLUMN_ID = "clientName";

const directionBadge = {
  outbound: { label: "Sent", color: "blue" },
  inbound: { label: "Received", color: "green" },
};

const baseColumns = [
  {
    id: CLIENT_NAME_COLUMN_ID,
    header: "Client name",
    cell: item => item.clientName ?? "-",
  },
  {
    id: "sentOn",
    header: "Timestamp",
    cell: item => new Date(item.sentOn).toLocaleString(),
  },
  {
    id: "packetId",
    header: "Packet",
    cell: item => item.packetId,
  },
  {
    id: "direction",
    header: "Direction",
    cell: item => {
      const badge = directionBadge[item.direction] ?? { label: item.direction, color: "grey" };
      return <Badge color={badge.color}>{badge.label}</Badge>;
    },
  },
  {
    id: "sender",
    header: "Sender",
    cell: item => item.sender,
  },
  {
    id: "recipients",
    header: "Recipients",
    cell: item => item.recipients?.join(", ") ?? "-",
  },
  {
    id: "subject",
    header: "Subject",
    cell: item => item.subject,
  },
  {
    id: "template",
    header: "Template",
    cell: item => item.template,
  },
  {
    id: "attachments",
    header: "Attachments",
    cell: item => (item.attachments?.length ? item.attachments.length : "-"),
  },
];

const defaultPreferences = {
  pageSize: DEFAULT_PAGE_SIZE,
  visibleColumns: baseColumns.map(column => column.id),
};

const normalizePreferences = (parsed, { includeClientName = false } = {}) => {
  const visibleColumns = Array.isArray(parsed?.visibleColumns)
    ? parsed.visibleColumns.filter(id => baseColumns.some(column => column.id === id))
    : defaultPreferences.visibleColumns;
  const nextVisibleColumns =
    includeClientName && !visibleColumns.includes(CLIENT_NAME_COLUMN_ID)
      ? [CLIENT_NAME_COLUMN_ID, ...visibleColumns]
      : visibleColumns;
  return {
    pageSize: Number.isFinite(parsed?.pageSize) ? parsed.pageSize : DEFAULT_PAGE_SIZE,
    visibleColumns: nextVisibleColumns.length ? nextVisibleColumns : defaultPreferences.visibleColumns,
  };
};

const loadColumnWidths = () => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("[Payments] failed to parse communication column widths", error);
    return [];
  }
};

const loadPreferences = () => {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }
  try {
    const currentRaw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (currentRaw) {
      return normalizePreferences(JSON.parse(currentRaw));
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_PREFERENCES_STORAGE_KEY);
    if (legacyRaw) {
      return normalizePreferences(JSON.parse(legacyRaw), { includeClientName: true });
    }

    return defaultPreferences;
  } catch (error) {
    console.error("[Payments] failed to parse communication preferences", error);
    return defaultPreferences;
  }
};

const PaymentCommunicationWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { requests, communications, selectedRequestId, addCommunication } = usePaymentsData();
  const isFinanceView = metadata?.mode === "finance";

  const [filteringText, setFilteringText] = useState("");
  const [columnWidths, setColumnWidths] = useState(() => loadColumnWidths());
  const [preferences, setPreferences] = useState(() => loadPreferences());
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const preferencesRef = useRef(preferences);

  const visibleColumns = useMemo(() => {
    const set = new Set(preferences.visibleColumns ?? baseColumns.map(column => column.id));
    return baseColumns.filter(column => set.has(column.id));
  }, [preferences.visibleColumns]);

  const communicationItems = useMemo(() => {
    const clientNameByPacketId = new Map(
      (requests || [])
        .filter(item => item?.id)
        .map(item => [String(item.id), item.clientName ?? null]),
    );
    return (communications || []).map(item => ({
      ...item,
      clientName: item.clientName ?? clientNameByPacketId.get(String(item.packetId)) ?? null,
    }));
  }, [communications, requests]);

  const filteredItems = useMemo(() => {
    return communicationItems.filter(item => {
      if (item.channel && item.channel !== "email") {
        return false;
      }
      if (selectedRequestId && item.packetId !== selectedRequestId) {
        return false;
      }
      if (!filteringText) {
        return true;
      }
      const lower = filteringText.toLowerCase();
      const packetValue = item.packetId ? String(item.packetId) : "";
      return (
        packetValue.toLowerCase().includes(lower) ||
        (item.subject ?? "").toLowerCase().includes(lower) ||
        (item.recipients ?? []).some(recipient => recipient.toLowerCase().includes(lower))
      );
    });
  }, [communicationItems, selectedRequestId, filteringText]);

  const pageSize = preferences.pageSize ?? DEFAULT_PAGE_SIZE;
  const pagesCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPageIndex, pageSize]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Payment communications", metadata.aiContext ?? "");
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

  const handleColumnWidthsChange = ({ detail }) => {
    const next = [];
    if (Array.isArray(detail?.columnWidths)) {
      detail.columnWidths.forEach(entry => {
        if (!entry || typeof entry !== "object") return;
        const { id, width } = entry;
        const numeric = Number(width);
        if (typeof id === "string" && Number.isFinite(numeric)) {
          next.push({ id, width: numeric });
        }
      });
    } else if (Array.isArray(detail?.widths)) {
      detail.widths.forEach((width, index) => {
        const column = baseColumns[index];
        const numeric = Number(width);
        if (column && Number.isFinite(numeric)) {
          next.push({ id: column.id, width: numeric });
        }
      });
    }
    if (next.length) {
      setColumnWidths(next);
      try {
        window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error("[Payments] failed to persist communication widths", error);
      }
    }
  };

  const savePreferences = next => {
    preferencesRef.current = next;
    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error("[Payments] failed to persist communication preferences", error);
    }
  };

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={{
        pageSize,
        contentDisplay: baseColumns.map(column => ({
          id: column.id,
          visible: visibleColumns.some(visibleColumn => visibleColumn.id === column.id),
        })),
        columnWidths,
      }}
      pageSizePreference={{
        title: "Page size",
        options: [5, 10, 20].map(value => ({ label: `${value} rows`, value })),
      }}
      contentDisplayPreference={{
        title: "Select columns",
        options: baseColumns.map(column => ({
          id: column.id,
          label: column.header,
          alwaysVisible: column.id === "sentOn",
        })),
      }}
      onConfirm={({ detail }) => {
        const nextPreferences = {
          pageSize: detail.pageSize ?? pageSize,
          visibleColumns: detail.contentDisplay
            ? detail.contentDisplay.filter(entry => entry.visible).map(entry => entry.id)
            : preferences.visibleColumns,
        };
        setPreferences(nextPreferences);
        savePreferences(nextPreferences);
        if (Array.isArray(detail.columnWidths)) {
          const widths = detail.columnWidths
            .map(entry => {
              const numeric = Number(entry.width);
              return typeof entry.id === "string" && Number.isFinite(numeric)
                ? { id: entry.id, width: numeric }
                : null;
            })
            .filter(Boolean);
          if (widths.length) {
            setColumnWidths(widths);
            try {
              window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
            } catch (error) {
              console.error("[Payments] failed to persist widths", error);
            }
          }
        }
        setCurrentPageIndex(1);
      }}
    />
  );

  const pagination = (
    <Pagination
      currentPageIndex={currentPageIndex}
      pagesCount={pagesCount}
      onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
      disabled={pagesCount <= 1}
    />
  );

  const selectedPacketLabel = selectedRequestId ? `Packet ${selectedRequestId}` : null;
  const logTargetId = isFinanceView ? null : selectedRequestId ?? communicationItems[0]?.packetId ?? null;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={
            isFinanceView
              ? "Review the communication history for the active packet or across all packets."
              : "Track email interactions and attachments exchanged for finance packets."
          }
        >
          Payment communications
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Payment communications settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <Box variant="small" color="text-body-secondary">
          {selectedPacketLabel
            ? `Showing communications for ${selectedPacketLabel}.`
            : "Showing communications across all packets. Select a packet in the queue to focus this log."}
        </Box>
        <SpaceBetween direction="horizontal" size="xs">
          <TextFilter
            filteringText={filteringText}
            filteringPlaceholder="Search by packet ID, subject, or recipient"
            onChange={({ detail }) => {
              setFilteringText(detail.filteringText);
              setCurrentPageIndex(1);
            }}
            countText={`${filteredItems.length} match${filteredItems.length === 1 ? "" : "es"}`}
          />
          {!isFinanceView ? (
            <Button
              iconName="add-plus"
              disabled={!logTargetId}
              onClick={() =>
                addCommunication({
                  packetId: logTargetId,
                  subject: "Follow-up note",
                  recipients: ["finance@nwac.org"],
                  direction: "outbound",
                })
              }
            >
              Log manual email
            </Button>
          ) : null}
        </SpaceBetween>
        <Table
          trackBy="id"
          items={pagedItems}
          columnDefinitions={visibleColumns.map(column => {
            const width = columnWidths.find(entry => entry.id === column.id)?.width;
            return width ? { ...column, width } : column;
          })}
          variant="embedded"
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          header={
            <Header variant="h3" counter={`(${filteredItems.length})`}>
              Communication log
            </Header>
          }
          empty={<Box padding="m">No communications logged yet.</Box>}
          preferences={preferencesComponent}
          pagination={pagination}
        />
      </SpaceBetween>
    </BoardItem>
  );
};

export default PaymentCommunicationWidget;
