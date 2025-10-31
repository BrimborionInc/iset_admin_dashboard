import React, { useCallback, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  CopyToClipboard,
  ExpandableSection,
  Header,
  Link,
  SpaceBetween,
  Tabs,
} from "@cloudscape-design/components";
import CodeView from "@cloudscape-design/code-view/code-view";
import xmlHighlight from "@cloudscape-design/code-view/highlight/xml";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const ExportPreviewWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseData, prepareIlmpExport } = useCaseWorkspace();
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(null);

  const ilmpPreview = caseData?.exportPreview?.ilmp ?? null;
  const ilmpXml = typeof ilmpPreview?.xml === "string" ? ilmpPreview.xml : null;
  const canonicalPreview = ilmpPreview?.canonical;

  const previewText = useMemo(() => {
    if (typeof ilmpXml === "string" && ilmpXml.trim()) {
      return ilmpXml;
    }
    if (!canonicalPreview) return null;
    if (typeof canonicalPreview === "string") {
      return canonicalPreview.trim() ? canonicalPreview : null;
    }
    try {
      return JSON.stringify(canonicalPreview, null, 2);
    } catch {
      return String(canonicalPreview);
    }
  }, [ilmpXml, canonicalPreview]);

  const isXmlPreview = useMemo(() => {
    if (!previewText) return false;
    const trimmed = previewText.trim();
    return trimmed.startsWith("<") && trimmed.endsWith(">");
  }, [previewText]);

  const ilmpGeneratedAt = ilmpPreview?.generatedAt ?? null;
  const ilmpStorageKey = ilmpPreview?.storageKey ?? null;
  const ilmpChecksum = ilmpPreview?.checksum ?? null;

  const formattedGeneratedAt = useMemo(() => {
    if (!ilmpGeneratedAt) return null;
    const date = new Date(ilmpGeneratedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, [ilmpGeneratedAt]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Export preview", metadata.aiContext ?? "");
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

  const handlePrepare = useCallback(async () => {
    setError(null);
    setPreparing(true);
    try {
      await prepareIlmpExport();
    } catch (err) {
      setError({
        message: err?.message || "Unable to prepare ILMP payload.",
        blockingIssues: err?.details?.blockingIssues || err?.details?.blocking_issues || [],
      });
    } finally {
      setPreparing(false);
    }
  }, [prepareIlmpExport]);

  const handleDownloadIlmp = useCallback(() => {
    if (!ilmpXml || typeof window === "undefined") {
      return;
    }
    try {
      const blob = new Blob([ilmpXml], { type: "text/xml;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = `${caseData?.caseNumber || `case-${caseData?.id || "payload"}`}-ilmp.xml`;
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError({
        message: "Failed to download ILMP XML.",
        blockingIssues: [],
      });
    }
  }, [ilmpXml, caseData?.caseNumber, caseData?.id]);

  const ilmpTabContent = previewText ? (
    <SpaceBetween size="m">
      <ExpandableSection headerText="ILMP payload" defaultExpanded>
        <CodeView
          content={previewText}
          language={isXmlPreview ? "xml" : "json"}
          wrapLines
          highlight={isXmlPreview ? xmlHighlight : undefined}
          ariaLabel="ILMP payload preview"
          actions={
            <CopyToClipboard
              copyButtonAriaLabel="Copy ILMP payload"
              copyErrorText="Copy failed"
              copySuccessText="Copied"
              textToCopy={previewText}
            />
          }
        />
      </ExpandableSection>
      {(formattedGeneratedAt || ilmpStorageKey || ilmpChecksum) && (
        <Box color="text-body-secondary">
          {formattedGeneratedAt && <Box>Generated: {formattedGeneratedAt}</Box>}
          {ilmpStorageKey && <Box>Storage key: {ilmpStorageKey}</Box>}
          {ilmpChecksum && <Box>Checksum: {ilmpChecksum}</Box>}
        </Box>
      )}
    </SpaceBetween>
  ) : (
    <Box padding="m" color="text-body-secondary">
      No ILMP payload has been prepared yet. Run validation to clear any blocking issues, then prepare the export.
    </Box>
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description ?? "Generate ILMP XML and finance postings before export."}
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                iconName="refresh"
                variant="primary"
                onClick={handlePrepare}
                loading={preparing}
              >
                Prepare ILMP payload
              </Button>
              <Button iconName="download" disabled={!ilmpXml} onClick={handleDownloadIlmp}>
                Download ILMP XML
              </Button>
            </SpaceBetween>
          }
        >
          {metadata.title ?? "Export preview"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Export preview settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            <SpaceBetween size="xs">
              <span>{error.message}</span>
              {Array.isArray(error.blockingIssues) && error.blockingIssues.length > 0 && (
                <Box as="ul" margin={{ all: "0" }} padding={{ left: "l" }}>
                  {error.blockingIssues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </Box>
              )}
            </SpaceBetween>
          </Alert>
        )}
      </SpaceBetween>
      <Tabs
        tabs={[
          {
            id: "ilmp",
            label: "ILMP XML",
            content: ilmpTabContent,
          },
          {
            id: "finance",
            label: "Finance postings",
            content: (
              <Box padding="m" fontFamily="monospace" fontSize="body-s">
                Posting summary for agreement {caseData?.agreementNumber ?? "-"} will appear here.
              </Box>
            ),
          },
        ]}
      />
    </BoardItem>
  );
};

export default ExportPreviewWidget;
