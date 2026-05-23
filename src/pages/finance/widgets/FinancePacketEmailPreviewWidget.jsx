import React, { useCallback, useEffect, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  ExpandableSection,
  Header,
  Link,
  SpaceBetween,
  Spinner,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../auth/apiClient";
import { boardItemI18nStrings } from "./common";

const FinancePacketEmailPreviewWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch("/api/config/runtime/finance-packet-email-preview");
      if (!resp.ok) {
        const message = (await resp.json().catch(() => ({}))).message || resp.statusText;
        throw new Error(message || "Load failed");
      }
      setPreview(await resp.json());
    } catch (err) {
      setError(err?.message || "Failed to load finance packet email preview.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

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
          metadata.helpTitle ?? "Finance packet email preview",
          metadata.aiContext ?? "",
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
          description="Read-only preview of the payment-packet email generated for Finance."
          actions={
            <Button iconName="refresh" onClick={loadPreview} loading={loading}>
              Refresh
            </Button>
          }
        >
          Finance packet email preview
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Finance packet email preview settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {loading && !preview ? (
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
          <SpaceBetween size="xs">
            <Box color="text-body-secondary" fontSize="body-s">
              Source: current backend finance packet email template.
            </Box>
            <Box color="text-body-secondary" fontSize="body-s">
              Sample data is used. The packet bundle link shown in the preview is a placeholder.
            </Box>
          </SpaceBetween>
          {preview && (
            <>
              <Box>
                <Box variant="awsui-key-label">Subject</Box>
                <Box>{preview.subject}</Box>
              </Box>
              <div
                style={{
                  border: "1px solid #d5dbdb",
                  borderRadius: 4,
                  padding: 16,
                  background: "#ffffff",
                  overflowX: "auto",
                }}
                dangerouslySetInnerHTML={{ __html: preview.bodyHtml || "" }}
              />
              <ExpandableSection headerText="Plain text body">
                <pre
                  style={{
                    color: "#5f6b7a",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    margin: 0,
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {preview.bodyText || ""}
                </pre>
              </ExpandableSection>
            </>
          )}
        </SpaceBetween>
      )}
    </BoardItem>
  );
};

export default FinancePacketEmailPreviewWidget;
