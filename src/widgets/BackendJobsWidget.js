import React, { useEffect, useState, useCallback, useMemo } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import { Header, Box, SpaceBetween, FormField, Input, Spinner, Link, Alert, ButtonDropdown, Button } from "@cloudscape-design/components";
import { apiFetch } from "../auth/apiClient";
import boardItemI18nStrings from "./common";

const DEFAULT_CONFIG = {
  reminderPollMinutes: 5,
};

const BackendJobsWidget = ({ actions, metadata, toggleHelpPanel }) => {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [edit, setEdit] = useState(DEFAULT_CONFIG);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const dirty = useMemo(() => {
    const current = Number(edit.reminderPollMinutes) || DEFAULT_CONFIG.reminderPollMinutes;
    return current !== (config?.reminderPollMinutes ?? DEFAULT_CONFIG.reminderPollMinutes);
  }, [config?.reminderPollMinutes, edit.reminderPollMinutes]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/config/runtime/backend-jobs");
      if (!res.ok) {
        const message = (await res.json().catch(() => ({}))).message || res.statusText;
        throw new Error(message || "Failed to load backend jobs config");
      }
      const data = await res.json().catch(() => ({}));
      const next = {
        reminderPollMinutes: data?.reminderPollMinutes ?? DEFAULT_CONFIG.reminderPollMinutes,
      };
      setConfig(next);
      setEdit(next);
    } catch (err) {
      setError(err?.message || "Failed to load backend jobs config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = {
        reminderPollMinutes: Number(edit.reminderPollMinutes) || DEFAULT_CONFIG.reminderPollMinutes,
      };
      const res = await apiFetch("/api/config/runtime/backend-jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const message = (await res.json().catch(() => ({}))).message || res.statusText;
        throw new Error(message || "Failed to save backend jobs config");
      }
      setConfig(body);
      setSuccess("Backend jobs configuration saved.");
    } catch (err) {
      setError(err?.message || "Failed to save backend jobs config");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setEdit(config);
    setSuccess(null);
    setError(null);
  };

  const handleOpenHelp = () => {
    if (!toggleHelpPanel || !metadata?.helpComponent) return;
    const title = metadata?.helpTitle || metadata?.title || "Backend jobs";
    const context = metadata?.aiContext || metadata?.helpComponent?.aiContext || "";
    toggleHelpPanel(<metadata.helpComponent />, title, context);
  };

  const infoLink =
    metadata?.helpComponent && toggleHelpPanel ? (
      <Link variant="info" onClick={handleOpenHelp}>
        Info
      </Link>
    ) : undefined;

  const settingsMenu =
    actions && typeof actions.removeItem === "function" ? (
      <ButtonDropdown
        ariaLabel="Backend jobs widget settings"
        variant="icon"
        items={[{ id: "remove", text: "Remove widget" }]}
        onItemClick={({ detail }) => {
          if (detail.id === "remove") actions.removeItem();
        }}
      />
    ) : undefined;

  const headerActions = (
    <SpaceBetween direction="horizontal" size="xs">
      <Button variant="link" onClick={handleReset} disabled={loading || saving || !dirty}>
        Reset
      </Button>
      <Button
        variant="primary"
        loading={saving}
        disabled={loading || saving || !dirty}
        onClick={handleSave}
      >
        Save
      </Button>
    </SpaceBetween>
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={metadata?.description || "Configure server-side background jobs."}
          info={infoLink}
          actions={headerActions}
        >
          {metadata?.title || "Backend jobs"}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      {loading ? (
        <Box textAlign="center">
          <Spinner /> Loading...
        </Box>
      ) : (
        <SpaceBetween size="m">
          {error && (
            <Alert type="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert type="success" onDismiss={() => setSuccess(null)}>
              {success}
            </Alert>
          )}
          <FormField
            label="Reminder poll interval (minutes)"
            description="How often the server checks for due/overdue reminders."
          >
            <Input
              type="number"
              value={String(edit.reminderPollMinutes ?? "")}
              onChange={({ detail }) => setEdit({ ...edit, reminderPollMinutes: detail.value })}
            />
          </FormField>
        </SpaceBetween>
      )}
    </BoardItem>
  );
};

export default BackendJobsWidget;
