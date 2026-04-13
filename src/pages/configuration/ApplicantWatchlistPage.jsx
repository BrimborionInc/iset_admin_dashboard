import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  ColumnLayout,
  Container,
  DatePicker,
  Flashbar,
  FormField,
  Header,
  Input,
  Modal,
  Select,
  SpaceBetween,
  Table,
  TextFilter,
  Textarea,
} from "@cloudscape-design/components";
import { apiFetch } from "../../auth/apiClient";
import { cleanSin, formatSinDisplay, maskSinForDisplay } from "../../utils/applicantWatchlist";

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const FILTER_OPTIONS = [
  { label: "All entries", value: "all" },
  { label: "Active only", value: "active" },
  { label: "Inactive only", value: "inactive" },
];

const emptyForm = () => ({
  fullName: "",
  firstName: "",
  lastName: "",
  dob: "",
  sin: "",
  notes: "",
  status: "active",
});

const trimText = value => (typeof value === "string" ? value.trim() : "");

const formatDate = value => {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatDateTime = value => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const truncate = (value, limit = 120) => {
  const text = trimText(value);
  if (!text) return "—";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}…`;
};

const makeFlash = (type, content) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  content,
  dismissible: true,
});

const parseResponseError = async response => {
  try {
    const payload = await response.json();
    return payload;
  } catch {
    return null;
  }
};

const buildFormState = item => ({
  fullName: item?.fullName || "",
  firstName: item?.firstName || "",
  lastName: item?.lastName || "",
  dob: item?.dob || "",
  sin: cleanSin(item?.sin) || "",
  notes: item?.notes || "",
  status: item?.status || "active",
});

const buildSearchText = item =>
  [
    item?.fullName,
    item?.firstName,
    item?.lastName,
    item?.dob,
    item?.sin,
    item?.notes,
    item?.sourceLabel,
    item?.sourceTrackingId,
    item?.sourceCaseNumber,
    item?.updatedByLabel,
    item?.createdByLabel,
    item?.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const ApplicantWatchlistPage = () => {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [flashItems, setFlashItems] = useState([]);
  const [filteringText, setFilteringText] = useState("");
  const [selectedFilter, setSelectedFilter] = useState(FILTER_OPTIONS[0]);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(() => emptyForm());
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rowActionId, setRowActionId] = useState(null);

  const dismissFlash = useCallback(id => {
    setFlashItems(current => current.filter(item => item.id !== id));
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await apiFetch("/api/admin/applicant-watchlist");
      if (!response.ok) {
        const payload = await parseResponseError(response);
        throw new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
      }
      const payload = await response.json();
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setCounts({
        total: Number(payload?.counts?.total || 0),
        active: Number(payload?.counts?.active || 0),
        inactive: Number(payload?.counts?.inactive || 0),
      });
    } catch (error) {
      setLoadError(error?.message || "Unable to load the applicant watchlist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filteredItems = useMemo(() => {
    const filterValue = selectedFilter?.value || "all";
    const search = filteringText.trim().toLowerCase();
    return items.filter(item => {
      if (filterValue !== "all" && item.status !== filterValue) {
        return false;
      }
      if (!search) {
        return true;
      }
      return buildSearchText(item).includes(search);
    });
  }, [filteringText, items, selectedFilter]);

  const updateForm = useCallback((key, value) => {
    setForm(current => ({ ...current, [key]: value }));
  }, []);

  const openCreateEditor = useCallback(() => {
    setEditingItem(null);
    setForm(emptyForm());
    setFormError(null);
    setEditorVisible(true);
  }, []);

  const openEditEditor = useCallback(item => {
    setEditingItem(item);
    setForm(buildFormState(item));
    setFormError(null);
    setEditorVisible(true);
  }, []);

  const closeEditor = useCallback(() => {
    if (saving) return;
    setEditorVisible(false);
    setEditingItem(null);
    setForm(emptyForm());
    setFormError(null);
  }, [saving]);

  const saveEntry = useCallback(async () => {
    const fullName = trimText(form.fullName);
    const dob = trimText(form.dob);
    const sin = cleanSin(form.sin) || "";

    if (!fullName || !dob || sin.length !== 9) {
      setFormError("Full name, date of birth, and a 9-digit SIN are required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const body = {
        fullName,
        firstName: trimText(form.firstName) || null,
        lastName: trimText(form.lastName) || null,
        dob,
        sin,
        notes: trimText(form.notes) || null,
      };
      if (editingItem) {
        body.status = form.status || "active";
      }

      const response = await apiFetch(
        editingItem
          ? `/api/admin/applicant-watchlist/${editingItem.id}`
          : "/api/admin/applicant-watchlist",
        {
          method: editingItem ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const payload = await parseResponseError(response);
        if (response.status === 409) {
          throw new Error("That SIN is already present on another watchlist entry.");
        }
        if (response.status === 400 && payload?.error === "identity_missing") {
          throw new Error("Full name, date of birth, and a 9-digit SIN are required.");
        }
        if (response.status === 400 && payload?.error === "notes_too_long") {
          throw new Error(`Notes must be ${payload?.max || 2000} characters or fewer.`);
        }
        if (response.status === 400 && payload?.error === "invalid_status") {
          throw new Error("Choose a valid watchlist status.");
        }
        throw new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
      }

      const payload = await response.json();
      await loadEntries();
      setFlashItems(current => [
        ...current,
        makeFlash(
          "success",
          editingItem
            ? payload?.eventType === "applicant_watchlist_removed"
              ? "Applicant watchlist entry marked inactive."
              : payload?.eventType === "applicant_watchlist_added"
                ? "Applicant watchlist entry reactivated."
                : "Applicant watchlist entry updated."
            : payload?.mode === "reactivated"
              ? "Applicant watchlist entry reactivated."
              : "Applicant watchlist entry added."
        ),
      ]);
      closeEditor();
    } catch (error) {
      setFormError(error?.message || "Unable to save the watchlist entry.");
    } finally {
      setSaving(false);
    }
  }, [closeEditor, editingItem, form, loadEntries]);

  const updateStatus = useCallback(async (item, nextStatus) => {
    if (!item?.id || !nextStatus || item.status === nextStatus) {
      return;
    }
    setRowActionId(item.id);
    try {
      const response = await apiFetch(`/api/admin/applicant-watchlist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const payload = await parseResponseError(response);
        throw new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
      }
      await loadEntries();
      setFlashItems(current => [
        ...current,
        makeFlash(
          "success",
          nextStatus === "inactive"
            ? "Applicant watchlist entry marked inactive."
            : "Applicant watchlist entry reactivated."
        ),
      ]);
    } catch (error) {
      setFlashItems(current => [
        ...current,
        makeFlash("error", error?.message || "Unable to update the watchlist status."),
      ]);
    } finally {
      setRowActionId(null);
    }
  }, [loadEntries]);

  const columns = useMemo(() => ([
    {
      id: "applicant",
      header: "Applicant",
      cell: item => (
        <SpaceBetween size="xxs">
          <Box fontWeight="bold">{item.fullName || "—"}</Box>
          {(item.firstName || item.lastName) && (
            <Box color="text-status-inactive">
              {[item.firstName, item.lastName].filter(Boolean).join(" ")}
            </Box>
          )}
        </SpaceBetween>
      ),
    },
    {
      id: "dob",
      header: "Date of birth",
      cell: item => formatDate(item.dob),
    },
    {
      id: "sin",
      header: "SIN",
      cell: item => maskSinForDisplay(item.sin) || "—",
    },
    {
      id: "notes",
      header: "Notes",
      cell: item => truncate(item.notes),
    },
    {
      id: "source",
      header: "Source",
      cell: item => item.sourceLabel || "Direct entry",
    },
    {
      id: "updated",
      header: "Updated",
      cell: item => (
        <SpaceBetween size="xxs">
          <Box>{formatDateTime(item.updatedAt || item.createdAt)}</Box>
          <Box color="text-status-inactive">{item.updatedByLabel || item.createdByLabel || "—"}</Box>
        </SpaceBetween>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: item => (
        <SpaceBetween direction="horizontal" size="xs">
          <Button onClick={() => openEditEditor(item)} disabled={rowActionId === item.id}>
            Edit
          </Button>
          <Button
            variant="inline-link"
            loading={rowActionId === item.id}
            onClick={() => updateStatus(item, item.status === "active" ? "inactive" : "active")}
          >
            {item.status === "active" ? "Disable watch" : "Enable watch"}
          </Button>
        </SpaceBetween>
      ),
    },
  ]), [openEditEditor, rowActionId, updateStatus]);

  const flashbarItems = useMemo(
    () =>
      flashItems.map(item => ({
        ...item,
        onDismiss: () => dismissFlash(item.id),
      })),
    [dismissFlash, flashItems]
  );

  return (
    <SpaceBetween size="l">
      {flashbarItems.length > 0 && <Flashbar items={flashbarItems} />}
      <Container>
        <SpaceBetween size="m">
          <Box color="text-status-inactive">
            Direct manager view for applicant watchlist entries keyed by SIN. The table masks SIN values; full values
            are shown only inside the editor for authorized roles.
          </Box>
          <ColumnLayout columns={3} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Total entries</Box>
              <Box variant="h3">{counts.total}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Active</Box>
              <Box variant="h3">{counts.active}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Inactive</Box>
              <Box variant="h3">{counts.inactive}</Box>
            </div>
          </ColumnLayout>
        </SpaceBetween>
      </Container>

      {loadError && (
        <Alert type="error" header="Unable to load the applicant watchlist">
          {loadError}
        </Alert>
      )}

      <Table
        items={filteredItems}
        loading={loading}
        loadingText="Loading applicant watchlist entries"
        trackBy="id"
        wrapLines
        columnDefinitions={columns}
        header={
          <Header
            counter={`(${filteredItems.length})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={loadEntries} loading={loading}>
                  Refresh
                </Button>
                <Button variant="primary" onClick={openCreateEditor}>
                  Add entry
                </Button>
              </SpaceBetween>
            }
          >
            Applicant Watchlist
          </Header>
        }
        filter={
          <SpaceBetween size="m">
            <Select
              selectedOption={selectedFilter}
              onChange={({ detail }) => setSelectedFilter(detail.selectedOption)}
              options={FILTER_OPTIONS}
              selectedAriaLabel="Selected filter"
            />
            <TextFilter
              filteringText={filteringText}
              filteringPlaceholder="Find by name, SIN, note, or source"
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
            />
          </SpaceBetween>
        }
        empty={
          <Box textAlign="center" color="inherit">
            No watchlist entries match the current filter.
          </Box>
        }
      />

      <Modal
        visible={editorVisible}
        onDismiss={closeEditor}
        closeAriaLabel="Close applicant watchlist editor"
        size="large"
        header={editingItem ? "Edit applicant watchlist entry" : "Add applicant watchlist entry"}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={closeEditor} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveEntry} loading={saving}>
                {editingItem ? "Save changes" : "Add entry"}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          {formError && <Alert type="error">{formError}</Alert>}
          <ColumnLayout columns={2}>
            <FormField label="Applicant full name" description="Required.">
              <Input
                value={form.fullName}
                onChange={({ detail }) => updateForm("fullName", detail.value)}
                placeholder="Full name"
              />
            </FormField>
            <FormField label="Date of birth" description="Required.">
              <DatePicker
                value={form.dob}
                onChange={({ detail }) => updateForm("dob", detail.value)}
                placeholder="YYYY-MM-DD"
              />
            </FormField>
            <FormField label="First name">
              <Input
                value={form.firstName}
                onChange={({ detail }) => updateForm("firstName", detail.value)}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Last name">
              <Input
                value={form.lastName}
                onChange={({ detail }) => updateForm("lastName", detail.value)}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Social Insurance Number" description="Required. Enter 9 digits.">
              <Input
                value={form.sin ? (formatSinDisplay(form.sin) || form.sin) : ""}
                onChange={({ detail }) => updateForm("sin", cleanSin(detail.value) || "")}
                placeholder="123 456 789"
              />
            </FormField>
            {editingItem ? (
              <FormField label="Status">
                <Select
                  selectedOption={STATUS_OPTIONS.find(option => option.value === form.status) || STATUS_OPTIONS[0]}
                  onChange={({ detail }) => updateForm("status", detail.selectedOption?.value || "active")}
                  options={STATUS_OPTIONS}
                  selectedAriaLabel="Selected status"
                />
              </FormField>
            ) : (
              <FormField label="Status">
                <Input value="Active" disabled />
              </FormField>
            )}
          </ColumnLayout>

          <FormField label="Notes">
            <Textarea
              value={form.notes}
              onChange={({ detail }) => updateForm("notes", detail.value)}
              rows={6}
              placeholder="Explain why this applicant is watchlisted and what staff should do when a future watchlist hit is reviewed"
            />
          </FormField>

          {editingItem && (
            <Container>
              <ColumnLayout columns={2} variant="text-grid">
                <div>
                  <Box variant="awsui-key-label">Source</Box>
                  <Box>{editingItem.sourceLabel || "Direct entry"}</Box>
                </div>
                <div>
                  <Box variant="awsui-key-label">Updated</Box>
                  <Box>{formatDateTime(editingItem.updatedAt || editingItem.createdAt)}</Box>
                </div>
                <div>
                  <Box variant="awsui-key-label">Updated by</Box>
                  <Box>{editingItem.updatedByLabel || editingItem.createdByLabel || "—"}</Box>
                </div>
                <div>
                  <Box variant="awsui-key-label">Current masked SIN</Box>
                  <Box>{maskSinForDisplay(editingItem.sin) || "—"}</Box>
                </div>
              </ColumnLayout>
            </Container>
          )}
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};

export default ApplicantWatchlistPage;
