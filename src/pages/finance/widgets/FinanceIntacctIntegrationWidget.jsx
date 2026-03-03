import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  FormField,
  Header,
  Input,
  Link,
  Select,
  SpaceBetween,
  StatusIndicator,
  Spinner,
  Textarea,
  Toggle,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../auth/apiClient";
import { boardItemI18nStrings } from "./common";

const INTACCT_REST_BASE_URL =
  process.env.REACT_APP_INTACCT_REST_BASE_URL ||
  process.env.REACT_APP_INTACCT_MOCK_BASE_URL ||
  "http://localhost:4000";
const INTACCT_TENANT_ID =
  process.env.REACT_APP_INTACCT_TENANT_ID ||
  process.env.REACT_APP_INTACCT_MOCK_TENANT_ID ||
  "T-0001";

const DEFAULT_CONFIG = {
  enabled: false,
  environment: "sandbox",
  companyId: INTACCT_TENANT_ID,
  senderId: "",
  senderPassword: "",
  userId: "",
  userPassword: "",
  useSessionAuth: true,
  defaultLocationId: "",
  defaultDepartmentId: "",
  defaultAction: "draft",
  submissionMode: "email",
  notes: "",
};

const normalizeConfig = raw => {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CONFIG };
  const submissionMode =
    raw.submissionMode === "intacct_rest" ||
    raw.submission_mode === "intacct_rest" ||
    raw.useRestApi === true ||
    raw.use_rest_api === true ||
    raw.enabled === true
      ? "intacct_rest"
      : "email";
  return {
    enabled: submissionMode === "intacct_rest",
    environment: raw.environment === "production" ? "production" : "sandbox",
    companyId: raw.companyId || raw.company_id || "",
    senderId: raw.senderId || raw.sender_id || "",
    senderPassword: raw.senderPassword || raw.sender_password || "",
    userId: raw.userId || raw.user_id || "",
    userPassword: raw.userPassword || raw.user_password || "",
    useSessionAuth:
      typeof raw.useSessionAuth === "boolean"
        ? raw.useSessionAuth
        : raw.use_session_auth !== false,
    defaultLocationId: raw.defaultLocationId || raw.default_location_id || "",
    defaultDepartmentId: raw.defaultDepartmentId || raw.default_department_id || "",
    defaultAction: raw.defaultAction === "submit" ? "submit" : "draft",
    submissionMode,
    notes: raw.notes || raw.note || "",
  };
};

const FinanceIntacctIntegrationWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const [savedConfig, setSavedConfig] = useState({ ...DEFAULT_CONFIG });
  const [draftConfig, setDraftConfig] = useState({ ...DEFAULT_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [showSecurityNotice, setShowSecurityNotice] = useState(true);
  const [testStatus, setTestStatus] = useState("idle");
  const [testMessage, setTestMessage] = useState("Not tested");

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch("/api/config/runtime/intacct-integration");
      if (!resp.ok) {
        const message = (await resp.json().catch(() => ({}))).message || resp.statusText;
        throw new Error(message || "Load failed");
      }
      const payload = await resp.json();
      const normalized = normalizeConfig(payload);
      setSavedConfig(normalized);
      setDraftConfig(normalized);
    } catch (err) {
      setError(err?.message || "Failed to load Intacct integration settings.");
      setSavedConfig({ ...DEFAULT_CONFIG });
      setDraftConfig({ ...DEFAULT_CONFIG });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const dirty = useMemo(
    () => JSON.stringify(normalizeConfig(savedConfig)) !== JSON.stringify(normalizeConfig(draftConfig)),
    [savedConfig, draftConfig],
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const resp = await apiFetch("/api/config/runtime/intacct-integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftConfig),
      });
      if (!resp.ok) {
        const message = (await resp.json().catch(() => ({}))).message || resp.statusText;
        throw new Error(message || "Save failed");
      }
      const payload = await resp.json();
      const normalized = normalizeConfig(payload);
      setSavedConfig(normalized);
      setDraftConfig(normalized);
      setSuccess("Intacct integration settings saved.");
    } catch (err) {
      setError(err?.message || "Failed to save Intacct integration settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraftConfig(savedConfig);
    setError(null);
    setSuccess(null);
  };

  const handleTestConnection = async () => {
    setTestStatus("loading");
    setTestMessage("Testing...");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const tokenResp = await fetch(`${INTACCT_REST_BASE_URL}/oauth2/token`, {
        method: "POST",
        signal: controller.signal,
      });
      if (!tokenResp.ok) {
        throw new Error(`Token request failed (${tokenResp.status})`);
      }
      const tokenPayload = await tokenResp.json().catch(() => ({}));
      const token = tokenPayload.access_token;
      if (!token) {
        throw new Error("Token response missing access token");
      }
      const vendorResp = await fetch(`${INTACCT_REST_BASE_URL}/ia/api/v1/objects/vendors`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      if (!vendorResp.ok) {
        throw new Error(`Vendor check failed (${vendorResp.status})`);
      }
      setTestStatus("success");
      setTestMessage("Connected");
    } catch (err) {
      const message = err?.name === "AbortError" ? "Connection timed out" : err?.message || "Failed";
      setTestStatus("error");
      setTestMessage(message);
    } finally {
      clearTimeout(timeout);
    }
  };

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const infoLink = metadata?.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(
          helpContent,
          metadata.helpTitle ?? "Sage Intacct integration",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  const envOptions = [
    { value: "sandbox", label: "Sandbox / test tenant" },
    { value: "production", label: "Production tenant" },
  ];
  const actionOptions = [
    { value: "draft", label: "Draft (recommended for preview)" },
    { value: "submit", label: "Submit / post immediately" },
  ];
  const passwordType = showSecrets ? "text" : "password";
  const statusIndicatorType =
    testStatus === "loading" ? "loading" : testStatus === "success" ? "success" : testStatus === "error" ? "error" : "info";

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Store Sage Intacct integration settings for payment submissions and XML preview generation."
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <StatusIndicator type={statusIndicatorType}>{testMessage}</StatusIndicator>
              <Button
                variant="normal"
                onClick={handleTestConnection}
                disabled={loading || saving || testStatus === "loading"}
              >
                Test connection
              </Button>
              <Button variant="link" onClick={handleReset} disabled={!dirty || loading || saving}>
                Reset
              </Button>
              <Button variant="primary" onClick={handleSave} loading={saving} disabled={!dirty || loading || saving}>
                Save
              </Button>
            </SpaceBetween>
          }
        >
          Sage Intacct integration
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Sage Intacct integration settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {loading ? (
        <Box textAlign="center">
          <Spinner /> Loading...
        </Box>
      ) : (
        <SpaceBetween size="m">
          {showSecurityNotice ? (
            <Alert
              type="warning"
              header="Secrets are stored in the admin database"
              onDismiss={() => setShowSecurityNotice(false)}
            >
              These values are editable in-app for demo purposes. Limit access to Finance Settings
              and avoid using production credentials here until secrets are moved to a secure store.
            </Alert>
          ) : null}
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
          <ColumnLayout columns={2} variant="text-grid">
            <Toggle
              checked={draftConfig.submissionMode === "intacct_rest"}
              onChange={({ detail }) =>
                setDraftConfig(current => ({
                  ...current,
                  submissionMode: detail.checked ? "intacct_rest" : "email",
                  enabled: detail.checked,
                }))
              }
            >
              Use Intacct REST for submissions
            </Toggle>
            <Toggle
              checked={showSecrets}
              onChange={({ detail }) => setShowSecrets(detail.checked)}
            >
              Show secrets
            </Toggle>
          </ColumnLayout>
          <ColumnLayout columns={2} variant="text-grid">
            <FormField
              label="Intacct REST base URL"
              description="Override via REACT_APP_INTACCT_REST_BASE_URL (or REACT_APP_INTACCT_MOCK_BASE_URL in dev)"
            >
              <Input value={INTACCT_REST_BASE_URL} readOnly />
            </FormField>
            <FormField
              label="Tenant ID"
              description="Override via REACT_APP_INTACCT_TENANT_ID (or REACT_APP_INTACCT_MOCK_TENANT_ID in dev)"
            >
              <Input value={INTACCT_TENANT_ID} readOnly />
            </FormField>
            <FormField label="Environment">
              <Select
                selectedOption={envOptions.find(option => option.value === draftConfig.environment)}
                onChange={({ detail }) =>
                  setDraftConfig(current => ({
                    ...current,
                    environment: detail.selectedOption?.value || "sandbox",
                  }))
                }
                options={envOptions}
                placeholder="Select environment"
              />
            </FormField>
            <FormField label="Company ID">
              <Input
                value={draftConfig.companyId}
                onChange={({ detail }) => setDraftConfig(current => ({ ...current, companyId: detail.value }))}
                placeholder="e.g., NWAC"
                autoComplete="off"
              />
            </FormField>
            <FormField label="Sender ID (developer)">
              <Input
                value={draftConfig.senderId}
                onChange={({ detail }) => setDraftConfig(current => ({ ...current, senderId: detail.value }))}
                placeholder="SENDER_ID"
                autoComplete="off"
              />
            </FormField>
            <FormField label="Sender password">
              <Input
                type={passwordType}
                value={draftConfig.senderPassword}
                onChange={({ detail }) => setDraftConfig(current => ({ ...current, senderPassword: detail.value }))}
                placeholder="Sender password"
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Web Services user ID">
              <Input
                value={draftConfig.userId}
                onChange={({ detail }) => setDraftConfig(current => ({ ...current, userId: detail.value }))}
                placeholder="ws-user"
                autoComplete="off"
              />
            </FormField>
            <FormField label="Web Services user password">
              <Input
                type={passwordType}
                value={draftConfig.userPassword}
                onChange={({ detail }) => setDraftConfig(current => ({ ...current, userPassword: detail.value }))}
                placeholder="User password"
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Use session authentication">
              <Toggle
                checked={draftConfig.useSessionAuth}
                onChange={({ detail }) =>
                  setDraftConfig(current => ({ ...current, useSessionAuth: detail.checked }))
                }
              >
                Use getAPISession for repeated calls
              </Toggle>
            </FormField>
            <FormField label="Default AP Bill action">
              <Select
                selectedOption={actionOptions.find(option => option.value === draftConfig.defaultAction)}
                onChange={({ detail }) =>
                  setDraftConfig(current => ({
                    ...current,
                    defaultAction: detail.selectedOption?.value || "draft",
                  }))
                }
                options={actionOptions}
                placeholder="Select action"
              />
            </FormField>
            <FormField label="Default location / entity ID (optional)">
              <Input
                value={draftConfig.defaultLocationId}
                onChange={({ detail }) =>
                  setDraftConfig(current => ({ ...current, defaultLocationId: detail.value }))
                }
                placeholder="e.g., BC"
                autoComplete="off"
              />
            </FormField>
            <FormField label="Default department ID (optional)">
              <Input
                value={draftConfig.defaultDepartmentId}
                onChange={({ detail }) =>
                  setDraftConfig(current => ({ ...current, defaultDepartmentId: detail.value }))
                }
                placeholder="e.g., PROGRAMS"
                autoComplete="off"
              />
            </FormField>
          </ColumnLayout>
          <FormField
            label="Integration notes"
            description="Record vendor/GL mapping rules, required dimensions, or approvals."
          >
            <Textarea
              value={draftConfig.notes}
              onChange={({ detail }) => setDraftConfig(current => ({ ...current, notes: detail.value }))}
              placeholder="Notes for the integration team"
              rows={4}
            />
          </FormField>
          <Box color="text-body-secondary" variant="small">
            These settings drive the Intacct XML preview and submission routing.
            When REST submission is enabled, packets are sent to the configured REST base URL.
          </Box>
        </SpaceBetween>
      )}
    </BoardItem>
  );
};

export default FinanceIntacctIntegrationWidget;
