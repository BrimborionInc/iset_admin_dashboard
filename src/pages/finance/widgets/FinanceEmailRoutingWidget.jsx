import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  Header,
  Input,
  Link,
  SpaceBetween,
  Spinner,
  Table,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../auth/apiClient";
import { boardItemI18nStrings } from "./common";

const normalizeRoutingMap = (value = {}) => {
  const out = {};
  Object.entries(value).forEach(([code, email]) => {
    const trimmedCode = String(code || "").trim().toUpperCase();
    const trimmedEmail = String(email || "").trim();
    if (!trimmedCode) return;
    if (trimmedEmail) {
      out[trimmedCode] = trimmedEmail;
    }
  });
  return out;
};

const FinanceEmailRoutingWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const [regions, setRegions] = useState([]);
  const [savedRouting, setSavedRouting] = useState({});
  const [draftRouting, setDraftRouting] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [regionsResponse, routingResponse] = await Promise.all([
        apiFetch("/api/regions/canada"),
        apiFetch("/api/config/runtime/finance-email-routing"),
      ]);

      if (!regionsResponse.ok) {
        throw new Error(`Region lookup failed (${regionsResponse.status})`);
      }
      const regionsPayload = await regionsResponse.json();
      const regionsList = Array.isArray(regionsPayload)
        ? regionsPayload
            .map(row => ({
              code: String(row.code || "").trim().toUpperCase(),
              name: row.name || row.name_en || row.code || "",
            }))
            .filter(row => row.code)
        : [];
      setRegions(regionsList);

      if (!routingResponse.ok) {
        throw new Error(`Finance email routing load failed (${routingResponse.status})`);
      }
      const routingPayload = await routingResponse.json();
      const routingMap = normalizeRoutingMap(routingPayload?.regions || {});
      setSavedRouting(routingMap);
      setDraftRouting(routingMap);
    } catch (err) {
      setError(err?.message || "Failed to load finance email routing.");
      setRegions([]);
      setSavedRouting({});
      setDraftRouting({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const rows = useMemo(() => {
    const sorted = [...regions].sort((a, b) => a.name.localeCompare(b.name));
    return sorted.map(region => ({
      code: region.code,
      name: region.name,
      email: draftRouting[region.code] || "",
    }));
  }, [regions, draftRouting]);

  const dirty = useMemo(() => {
    const saved = JSON.stringify(normalizeRoutingMap(savedRouting));
    const draft = JSON.stringify(normalizeRoutingMap(draftRouting));
    return saved !== draft;
  }, [savedRouting, draftRouting]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = { regions: normalizeRoutingMap(draftRouting) };
      const resp = await apiFetch("/api/config/runtime/finance-email-routing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const message = (await resp.json().catch(() => ({}))).message || resp.statusText;
        throw new Error(message || "Save failed");
      }
      const saved = await resp.json();
      const normalized = normalizeRoutingMap(saved?.regions || {});
      setSavedRouting(normalized);
      setDraftRouting(normalized);
      setSuccess("Finance email routing saved.");
    } catch (err) {
      setError(err?.message || "Failed to save finance email routing.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraftRouting(savedRouting);
    setSuccess(null);
    setError(null);
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
          metadata.helpTitle ?? "Finance email routing",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Configure one finance recipient per province or territory for outbound payment packets."
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={handleReset} disabled={!dirty || loading || saving}>
                Reset
              </Button>
              <Button variant="primary" onClick={handleSave} loading={saving} disabled={!dirty || loading || saving}>
                Save
              </Button>
            </SpaceBetween>
          }
        >
          Finance email routing
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Finance email routing settings"
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
          <Table
            items={rows}
            columnDefinitions={[
              {
                id: "region",
                header: "Province / Territory",
                cell: item => `${item.name} (${item.code})`,
              },
              {
                id: "email",
                header: "Finance email",
                cell: item => (
                  <Input
                    value={item.email}
                    placeholder="finance@example.org"
                    autoComplete="off"
                    onChange={({ detail }) => {
                      setDraftRouting(current => ({
                        ...current,
                        [item.code]: detail.value,
                      }));
                    }}
                  />
                ),
              },
            ]}
            trackBy="code"
            variant="embedded"
            empty={<Box padding="m">No regions available.</Box>}
            header={<Header variant="h3">Recipient list</Header>}
          />
          <Box color="text-body-secondary">
            Packets route to the configured address for their reporting unit or case region.
          </Box>
        </SpaceBetween>
      )}
    </BoardItem>
  );
};

export default FinanceEmailRoutingWidget;
