import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  Container,
  ColumnLayout,
  SpaceBetween,
  Table,
  Box,
  StatusIndicator,
  Link,
  TextFilter,
  Select,
  CollectionPreferences,
  Pagination,
  Button,
  ButtonDropdown,
  Modal,
  FormField,
  Alert,
  Textarea,
} from "@cloudscape-design/components";
import boardItemI18nStrings from "./common";
import { apiFetch } from "../../../auth/apiClient";

const COLUMN_WIDTHS_STORAGE_KEY = "contact-communications-queue-widths-v1";
const PREFERENCES_STORAGE_KEY = "contact-communications-queue-preferences-v1";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 rows" },
  { value: 10, label: "10 rows" },
  { value: 20, label: "20 rows" },
];

const ALL_COLUMN_IDS = ["submittedAt", "subject", "status", "applicantName", "actions"];
const REQUIRED_COLUMN_IDS = ["subject", "actions"];

const statusMeta = {
  new: { label: "New", indicator: "info" },
  "in-progress": { label: "In progress", indicator: "in-progress" },
  resolved: { label: "Resolved", indicator: "success" },
  escalated: { label: "Escalated", indicator: "warning" },
  archived: { label: "Archived", indicator: "stopped" },
};

const DEFAULT_PREFERENCES = {
  pageSize: DEFAULT_PAGE_SIZE,
  visibleColumns: ALL_COLUMN_IDS,
  wrapLines: false,
  statusFilter: "all",
};

const statusFilterOptions = [
  { label: "All statuses", value: "all" },
  { label: "New", value: "new" },
  { label: "In progress", value: "in-progress" },
  { label: "Escalated", value: "escalated" },
  { label: "Resolved", value: "resolved" },
  { label: "Archived", value: "archived" },
];

const statusSelectOptions = statusFilterOptions
  .filter(option => option.value !== "all")
  .map(option => ({ label: option.label, value: option.value }));

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
        if (!entry || typeof entry !== "object") return null;
        const id = typeof entry.id === "string" ? entry.id : null;
        const width = Number(entry.width);
        if (!id || !Number.isFinite(width)) return null;
        return { id, width };
      })
      .filter(Boolean);
  } catch (error) {
    console.error("[ContactQueue] Failed to parse stored column widths", error);
    return [];
  }
};

const persistColumnWidths = widths => {
  if (typeof window === "undefined") return;
  try {
    if (Array.isArray(widths) && widths.length) {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    } else {
      window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
    }
  } catch (error) {
    console.error("[ContactQueue] Failed to persist column widths", error);
  }
};

const loadPreferences = () => {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_PREFERENCES;
    }
    const pageSize = PAGE_SIZE_OPTIONS.some(option => option.value === parsed.pageSize)
      ? parsed.pageSize
      : DEFAULT_PREFERENCES.pageSize;
    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? parsed.visibleColumns.filter(id => ALL_COLUMN_IDS.includes(id))
      : DEFAULT_PREFERENCES.visibleColumns;
    const wrapLines = Boolean(parsed.wrapLines);
    const statusFilter = statusFilterOptions.some(option => option.value === parsed.statusFilter)
      ? parsed.statusFilter
      : DEFAULT_PREFERENCES.statusFilter;
    const mergedVisible = Array.from(
      new Set([...visibleColumns, ...REQUIRED_COLUMN_IDS].filter(id => ALL_COLUMN_IDS.includes(id)))
    );
    return {
      pageSize,
      visibleColumns: mergedVisible,
      wrapLines,
      statusFilter,
    };
  } catch (error) {
    console.error("[ContactQueue] Failed to parse stored preferences", error);
    return DEFAULT_PREFERENCES;
  }
};

const persistPreferences = prefs => {
  if (typeof window === "undefined") return;
  const payload = {
    ...DEFAULT_PREFERENCES,
    ...prefs,
  };
  payload.visibleColumns = Array.from(
    new Set(
      (Array.isArray(payload.visibleColumns) ? payload.visibleColumns : DEFAULT_PREFERENCES.visibleColumns).filter(id =>
        ALL_COLUMN_IDS.includes(id)
      )
    )
  );
  REQUIRED_COLUMN_IDS.forEach(id => {
    if (!payload.visibleColumns.includes(id)) {
      payload.visibleColumns.push(id);
    }
  });
  if (!PAGE_SIZE_OPTIONS.some(option => option.value === payload.pageSize)) {
    payload.pageSize = DEFAULT_PAGE_SIZE;
  }
  if (!statusFilterOptions.some(option => option.value === payload.statusFilter)) {
    payload.statusFilter = "all";
  }
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("[ContactQueue] Failed to persist preferences", error);
  }
};

const formatDateTime = value => (value ? new Date(value).toLocaleString("en-CA") : "-");

const DetailItem = ({ label, children }) => (
  <div>
    <SpaceBetween size="xxs">
      <Box fontWeight="bold">{label}</Box>
      {children}
    </SpaceBetween>
  </div>
);

const ContactMessageQueueWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  onDataChanged = () => {},
}) => {
  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [messages, setMessages] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialPreferences.statusFilter);
  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [visibleColumns, setVisibleColumns] = useState(initialPreferences.visibleColumns);
  const [wrapLines, setWrapLines] = useState(initialPreferences.wrapLines);
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const preferencesRef = useRef({
    statusFilter: initialPreferences.statusFilter,
    pageSize: initialPreferences.pageSize,
    visibleColumns: initialPreferences.visibleColumns,
    wrapLines: initialPreferences.wrapLines,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalMessage, setModalMessage] = useState(null);
  const [modalDetail, setModalDetail] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalStatus, setModalStatus] = useState("new");
  const modalMessageIdRef = useRef(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState(null);

  const fallbackStatusLabel =
    modalStatus && typeof modalStatus === "string"
      ? modalStatus
          .split("-")
          .map(part => (part ? part[0].toUpperCase() + part.slice(1) : ""))
          .join(" ")
          .trim() || "Unknown"
      : "Unknown";

  const currentStatusMeta = statusMeta[modalStatus] || {
    label: fallbackStatusLabel,
    indicator: "info",
  };

  const modalSubject = modalDetail?.message?.subject || modalMessage?.subject || "Message details";

  const formatHistoryActor = useCallback(entry => {
    if (!entry) return "Unknown";
    const candidates = [entry.changedByDisplay, entry.changedByName, entry.changedByEmail];
    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
    if (entry.changedByUserId != null) {
      return `User #${entry.changedByUserId}`;
    }
    return "Unknown";
  }, []);

  const formatNoteAuthor = useCallback(note => {
    if (!note) return "Unknown";
    const candidates = [note.authorDisplay, note.authorName, note.authorEmail];
    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }
    if (note.authorUserId != null) {
      return `User #${note.authorUserId}`;
    }
    return "Unknown";
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchText]);

  useEffect(() => {
    setCurrentPageIndex(1);
  }, [statusFilter, debouncedSearch, pageSize]);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    async function loadMessages() {
      setLoading(true);
      setLoadError(null);
      const params = new URLSearchParams();
      params.set("page", String(currentPageIndex));
      params.set("pageSize", String(pageSize));
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }
      try {
        const response = await apiFetch(`/api/admin/contact-messages?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(text || `Failed to load contact messages (status ${response.status})`);
        }
        const data = await response.json();
        if (isCancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        const normalised = items.map(item => ({
          id: item.id,
          submittedAt: item.submittedAt || item.submitted_at || null,
          subject: item.subject || "",
          email: item.email || "",
          applicantName: item.fullName || item.full_name || "",
          status: item.status || "new",
          userId: item.userId ?? item.user_id ?? null,
        }));
        setMessages(normalised);
        const total = Number(data?.total ?? normalised.length);
        setTotalItems(total);
        const maxPage = Math.max(1, Math.ceil(Math.max(total, 0) / pageSize));
        if (currentPageIndex > maxPage) {
          setCurrentPageIndex(maxPage);
        }
      } catch (error) {
        if (isCancelled || controller.signal.aborted) return;
        console.error("[contact-admin] list fetch failed", error);
        setMessages([]);
        setTotalItems(0);
        setLoadError(error?.message || "Failed to load contact messages");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadMessages();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [statusFilter, debouncedSearch, pageSize, currentPageIndex, refreshKey]);

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Contact queue help",
            metadata.aiContext ?? ""
          );
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

  const openMessageModal = useCallback((message) => {
    if (!message || !message.id) return;
    modalMessageIdRef.current = message.id;
    setModalMessage(message);
    setModalStatus(message?.status ?? "new");
    setModalDetail(null);
    setModalError(null);
    setModalLoading(true);
  setNoteText("");
  setNoteError(null);
  setNoteSaving(false);
    (async () => {
      try {
        const response = await apiFetch(`/api/admin/contact-messages/${message.id}`);
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(text || `Failed to load message (status ${response.status})`);
        }
        const data = await response.json();
        if (modalMessageIdRef.current !== message.id) return;
        setModalDetail(data);
        setModalStatus(data?.message?.status ?? message?.status ?? "new");
      } catch (error) {
        if (modalMessageIdRef.current !== message.id) return;
        console.error("[contact-admin] detail fetch failed", error);
        setModalError(error?.message || "Failed to load message details");
      } finally {
        if (modalMessageIdRef.current === message.id) {
          setModalLoading(false);
        }
      }
    })();
  }, []);

  const closeModal = useCallback(() => {
    modalMessageIdRef.current = null;
    setModalMessage(null);
    setModalDetail(null);
    setModalError(null);
    setModalLoading(false);
    setModalSaving(false);
    setNoteText("");
    setNoteSaving(false);
    setNoteError(null);
  }, []);

  const refreshNotes = useCallback(async messageId => {
    if (!messageId) return;
    const response = await apiFetch(`/api/admin/contact-messages/${messageId}/notes`);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Failed to load notes (status ${response.status})`);
    }
    const data = await response.json();
    if (modalMessageIdRef.current !== messageId) return;
    const items = Array.isArray(data?.items) ? data.items : [];
    setModalDetail(prev => {
      if (!prev) return prev;
      return { ...prev, notes: items };
    });
  }, []);

  const handleNoteSubmit = useCallback(async () => {
    if (!modalMessage?.id) return;
    const trimmed = noteText.trim();
    if (!trimmed) {
      setNoteError("Note cannot be empty.");
      return;
    }
    setNoteSaving(true);
    setNoteError(null);
    try {
      const response = await apiFetch(`/api/admin/contact-messages/${modalMessage.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteText: trimmed }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Failed to add note (status ${response.status})`);
      }
      await refreshNotes(modalMessage.id);
      setNoteText("");
    } catch (error) {
      console.error("[contact-admin] add note failed", error);
      setNoteError(error?.message || "Failed to add note");
    } finally {
      setNoteSaving(false);
    }
  }, [modalMessage, noteText, refreshNotes]);

  const handleSaveStatus = useCallback(async () => {
    if (!modalMessage) return;
    setModalSaving(true);
    setModalError(null);
    try {
      const response = await apiFetch(`/api/admin/contact-messages/${modalMessage.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: modalStatus }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Failed to update status (status ${response.status})`);
      }
      setMessages(current =>
        current.map(item =>
          item.id === modalMessage.id ? { ...item, status: modalStatus } : item
        )
      );
      setModalDetail(prev =>
        prev ? { ...prev, message: { ...prev.message, status: modalStatus } } : prev
      );
      setModalMessage(prev => (prev ? { ...prev, status: modalStatus } : prev));
      setModalSaving(false);
      setRefreshKey(key => key + 1);
      try {
        window.dispatchEvent(new CustomEvent("contactMessages:changed"));
      } catch (_) {}
      if (typeof onDataChanged === "function") onDataChanged();
      closeModal();
    } catch (error) {
      console.error("[contact-admin] status update failed", error);
      setModalError(error?.message || "Failed to update status");
      setModalSaving(false);
    }
  }, [modalMessage, modalStatus, onDataChanged, closeModal]);

  const columnDefinitions = useMemo(
    () => [
      {
        id: "submittedAt",
        header: "Submitted",
        cell: item => (item.submittedAt ? new Date(item.submittedAt).toLocaleString("en-CA") : "—"),
        sortingField: "submittedAt",
      },
      {
        id: "subject",
        header: "Subject",
        cell: item => (
          <SpaceBetween size="xs">
            <Box fontWeight="bold">{item.subject || "—"}</Box>
            <Box color="text-body-secondary">{item.email || "—"}</Box>
          </SpaceBetween>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: item => {
          const meta = statusMeta[item.status] ?? statusMeta.new;
          return <StatusIndicator type={meta.indicator}>{meta.label}</StatusIndicator>;
        },
      },
      {
        id: "applicantName",
        header: "Applicant",
        cell: item => item.applicantName || "—",
      },
      {
        id: "actions",
        header: "Actions",
        cell: item => (
          <Button variant="link" onClick={() => openMessageModal(item)}>
            Open
          </Button>
        ),
        minWidth: 90,
      },
    ],
    [openMessageModal]
  );

  const columnWidthMap = useMemo(() => {
    const map = new Map();
    columnWidths.forEach(entry => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const { id, width } = entry;
      if (typeof id === "string" && Number.isFinite(Number(width))) {
        map.set(id, Number(width));
      }
    });
    return map;
  }, [columnWidths]);

  const visibleColumnDefinitions = useMemo(
    () =>
      columnDefinitions
        .filter(column => visibleColumns.includes(column.id))
        .map(column => {
          const storedWidth = columnWidthMap.get(column.id);
          return storedWidth ? { ...column, width: storedWidth } : column;
        }),
    [columnDefinitions, visibleColumns, columnWidthMap]
  );

  const pagesCount = useMemo(
    () => Math.max(1, Math.ceil(Math.max(totalItems, 0) / pageSize)),
    [totalItems, pageSize]
  );

  useEffect(() => {
    const maxPage = Math.max(1, pagesCount);
    if (currentPageIndex > maxPage) {
      setCurrentPageIndex(maxPage);
    }
  }, [currentPageIndex, pagesCount]);

  const pageItems = messages;

  useEffect(() => {
    const next = {
      statusFilter,
      pageSize,
      visibleColumns,
      wrapLines,
    };
    const prev = preferencesRef.current;
    const changed =
      prev.statusFilter !== next.statusFilter ||
      prev.pageSize !== next.pageSize ||
      prev.wrapLines !== next.wrapLines ||
      prev.visibleColumns.join("|") !== next.visibleColumns.join("|");
    if (changed) {
      preferencesRef.current = next;
      persistPreferences(next);
    }
  }, [statusFilter, pageSize, visibleColumns, wrapLines]);

  const preferencesComponent = (
    <CollectionPreferences
      title="Preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={{
        pageSize,
        contentDisplay: visibleColumns.map(id => ({ id, visible: true })),
        wrapLines,
      }}
      pageSizePreference={{
        title: "Page size",
        options: PAGE_SIZE_OPTIONS,
      }}
      wrapLinesPreference={{
        label: "Wrap lines",
        description: "Display message previews on multiple lines.",
      }}
      contentDisplayPreference={{
        title: "Select columns",
        options: columnDefinitions.map(column => ({
          id: column.id,
          label: column.header,
          alwaysVisible: REQUIRED_COLUMN_IDS.includes(column.id),
        })),
      }}
      onConfirm={({ detail }) => {
        if (detail.pageSize && detail.pageSize !== pageSize) {
          setPageSize(detail.pageSize);
          setCurrentPageIndex(1);
        }
        if (typeof detail.wrapLines === "boolean") {
          setWrapLines(detail.wrapLines);
        }
        if (Array.isArray(detail.contentDisplay)) {
          const nextVisible = detail.contentDisplay
            .filter(entry => entry.visible)
            .map(entry => entry.id)
            .filter(id => ALL_COLUMN_IDS.includes(id));
          REQUIRED_COLUMN_IDS.forEach(id => {
            if (!nextVisible.includes(id)) {
              nextVisible.push(id);
            }
          });
          setVisibleColumns(nextVisible);
        }
        if (Array.isArray(detail.columnWidths)) {
          persistColumnWidths(detail.columnWidths);
          setColumnWidths(detail.columnWidths);
        }
      }}
    />
  );

  const paginationComponent = (
    <Pagination
      currentPageIndex={currentPageIndex}
      pagesCount={pagesCount}
      onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
    />
  );

  const handleColumnWidthsChange = ({ detail }) => {
    if (!detail) return;
    const next = [];
    if (Array.isArray(detail.columnWidths)) {
      detail.columnWidths.forEach(entry => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        const { id, width } = entry;
        if (typeof id === "string" && Number.isFinite(Number(width))) {
          next.push({ id, width: Number(width) });
        }
      });
    } else if (Array.isArray(detail.widths)) {
      detail.widths.forEach((width, index) => {
        const definition = visibleColumnDefinitions[index];
        if (definition && Number.isFinite(Number(width))) {
          next.push({ id: definition.id, width: Number(width) });
        }
      });
    }
    if (next.length) {
      setColumnWidths(next);
      persistColumnWidths(next);
    }
  };

  const filterComponent = (
    <SpaceBetween size="s" direction="horizontal">
      <TextFilter
        filteringText={searchText}
        onChange={({ detail }) => {
          setSearchText(detail.filteringText);
          setCurrentPageIndex(1);
        }}
        filteringPlaceholder="Search subject, applicant, or email"
      />
      <Select
        selectedOption={statusFilterOptions.find(option => option.value === statusFilter)}
        onChange={({ detail }) => {
          const value = detail.selectedOption?.value ?? "all";
          setStatusFilter(value);
          setCurrentPageIndex(1);
        }}
        options={statusFilterOptions}
        ariaLabel="Filter by status"
      />
    </SpaceBetween>
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Queue of contact messages awaiting triage."
        >
          Contact queue
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Contact queue settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {loadError && (
        <Box margin={{ bottom: "s" }}>
          <Alert type="error" header="Unable to load messages" dismissible onDismiss={() => setLoadError(null)}>
            {loadError}
          </Alert>
        </Box>
      )}
      <Table
        trackBy="id"
        items={pageItems}
        stickyHeader
        resizableColumns
        onColumnWidthsChange={handleColumnWidthsChange}
        wrapLines={wrapLines}
        columnDefinitions={visibleColumnDefinitions}
        filteringPlaceholder="Search messages"
        header={
          <Header variant="h3" counter={`(${totalItems})`}>
            Contact messages
          </Header>
        }
        filter={filterComponent}
        preferences={preferencesComponent}
        pagination={pagesCount > 1 ? paginationComponent : undefined}
        loading={loading}
        loadingText="Loading contact messages"
        empty={
          <Box padding="m">
            {loading ? "Loading contact messages..." : "No contact messages match the selected filters."}
          </Box>
        }
      />
      <Modal
        visible={!!modalMessage}
        onDismiss={closeModal}
        header={modalSubject}
        size="large"
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            <Button variant="link" onClick={closeModal} disabled={modalSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveStatus} loading={modalSaving} disabled={modalLoading}>
              Save
            </Button>
          </SpaceBetween>
        }
      >
        {modalMessage && (
          <SpaceBetween size="l">
            {modalError && (
              <Alert type="error" header="Unable to load message">
                {modalError}
              </Alert>
            )}
            {modalLoading && !modalDetail ? (
              <StatusIndicator type="loading">Loading message.</StatusIndicator>
            ) : (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Submission details</Header>}>
                  <SpaceBetween size="l">
                    <ColumnLayout columns={2} variant="text-grid">
                      <DetailItem label="Submitted">
                        <Box>{formatDateTime(modalMessage.submittedAt)}</Box>
                      </DetailItem>
                      <DetailItem label="Applicant">
                        <SpaceBetween size="xxs">
                          <Box>{modalMessage.applicantName || "-"}</Box>
                          <Box color="text-body-secondary">{modalMessage.email || "-"}</Box>
                        </SpaceBetween>
                      </DetailItem>
                      <DetailItem label="Subject">
                        <Box>{modalDetail?.message?.subject || modalMessage.subject || "-"}</Box>
                      </DetailItem>
                      <DetailItem label="Current status">
                        <StatusIndicator type={currentStatusMeta.indicator}>
                          {currentStatusMeta.label}
                        </StatusIndicator>
                      </DetailItem>
                    </ColumnLayout>
                    <FormField label="Update status">
                      <Select
                        selectedOption={
                          statusSelectOptions.find(option => option.value === modalStatus) || statusSelectOptions[0]
                        }
                        onChange={({ detail }) => setModalStatus(detail.selectedOption?.value ?? modalStatus)}
                        options={statusSelectOptions}
                        ariaLabel="Update status"
                        disabled={modalSaving}
                      />
                    </FormField>
                  </SpaceBetween>
                </Container>
                <Container header={<Header variant="h2">Message</Header>}>
                  <Box
                    as="pre"
                    padding="m"
                    background="bg-container-secondary"
                    borderRadius="small"
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {modalDetail?.message?.message || "-"}
                  </Box>
                </Container>
                <Container header={<Header variant="h2">Status history</Header>}>
                  {modalDetail?.history?.length ? (
                    <SpaceBetween size="s">
                      {modalDetail.history.map(entry => (
                        <Box key={entry.id} padding="s" background="bg-container-secondary" borderRadius="small">
                          <SpaceBetween size="xxs">
                            <SpaceBetween size="xxs" direction="horizontal" alignItems="center">
                              <StatusIndicator type={statusMeta[entry.newStatus]?.indicator || "info"}>
                                {statusMeta[entry.newStatus]?.label || entry.newStatus}
                              </StatusIndicator>
                              <Box color="text-body-secondary">{formatDateTime(entry.changedAt)}</Box>
                            </SpaceBetween>
                            <Box color="text-body-secondary">Changed by {formatHistoryActor(entry)}</Box>
                          </SpaceBetween>
                        </Box>
                      ))}
                    </SpaceBetween>
                  ) : (
                    <Box color="text-body-secondary">No history recorded.</Box>
                  )}
                </Container>
                <Container header={<Header variant="h2">Internal notes</Header>}>
                  <SpaceBetween size="m">
                    {modalDetail?.notes?.length ? (
                      <SpaceBetween size="s">
                        {modalDetail.notes.map(note => (
                          <Box key={note.id} padding="s" background="bg-container-secondary" borderRadius="small">
                            <SpaceBetween size="xxs">
                              <Box>{note.noteText}</Box>
                              <Box color="text-body-secondary">
                                {formatDateTime(note.createdAt)} - {formatNoteAuthor(note)}
                              </Box>
                            </SpaceBetween>
                          </Box>
                        ))}
                      </SpaceBetween>
                    ) : (
                      <Box color="text-body-secondary">No notes added yet.</Box>
                    )}
                    <SpaceBetween size="s">
                      <FormField label="Add note" errorText={noteError || undefined}>
                        <Textarea
                          value={noteText}
                          onChange={({ detail }) => {
                            setNoteText(detail.value);
                            if (noteError) {
                              setNoteError(null);
                            }
                          }}
                          rows={3}
                          placeholder="Record triage context or follow-up actions"
                          spellcheck={true}
                          disabled={noteSaving}
                        />
                      </FormField>
                      <Box textAlign="right">
                        <Button
                          variant="primary"
                          onClick={handleNoteSubmit}
                          loading={noteSaving}
                          disabled={noteSaving || modalLoading}
                        >
                          Add note
                        </Button>
                      </Box>
                    </SpaceBetween>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            )}
          </SpaceBetween>
        )}
      </Modal>
    </BoardItem>
  );
};

export default ContactMessageQueueWidget;
