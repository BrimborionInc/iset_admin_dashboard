import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  StatusIndicator,
  Button,
  ColumnLayout,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useReconciliationData } from "./ReconciliationDataContext.jsx";
import FinanceReconciliationSyncHelp from "../../../helpPanelContents/financeReconciliationSyncHelp.js";

const ReconciliationSyncStatusWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
}) => {
  const { syncStatus, manualSync, loading } = useReconciliationData();

  const infoHelper = metadata.helpComponent
    ? metadata
    : {
        helpComponent: FinanceReconciliationSyncHelp,
        helpTitle: "Sync status",
        aiContext: FinanceReconciliationSyncHelp.aiContext,
      };

  const infoLink =
    toggleHelpPanel && infoHelper.helpComponent
      ? (
          <Link
            variant="info"
            onFollow={event => {
              event.preventDefault();
              const helpContent = React.createElement(infoHelper.helpComponent);
              toggleHelpPanel(helpContent, infoHelper.helpTitle, infoHelper.aiContext);
            }}
          >
            Info
          </Link>
        )
      : undefined;

  const statusIndicatorType =
    syncStatus.status === "error"
      ? "error"
      : syncStatus.status === "warning"
        ? "warning"
        : "success";
  const statusLabel =
    syncStatus.status === "warning"
      ? "Backlog building - exceptions may be delayed"
      : syncStatus.status === "error"
        ? "Ingest blocked - exceptions may be stale"
        : "Feed healthy - exceptions are up to date";

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Monitor ingestion health for case-management transactions flowing into finance."
        >
          Sync status
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Sync status settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={({ detail }) => {
              if (detail?.id === "remove") {
                actions.removeItem();
              }
            }}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {loading ? (
          <StatusIndicator type="in-progress">Loading sync status</StatusIndicator>
        ) : (
          <StatusIndicator type={statusIndicatorType}>
            {statusLabel}
          </StatusIndicator>
        )}
        <Box variant="p">
          This panel reflects the health of the inbound case-management feed. If the feed lags,
          the transactions queue may not show the latest exceptions.
        </Box>

        <ColumnLayout columns={3} variant="text-grid">
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Last successful sync</Box>
            <Box variant="p">
              {syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : "Unknown"}
            </Box>
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Ingest duration</Box>
            <Box variant="p">{syncStatus.ingestDuration}</Box>
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Next scheduled run</Box>
            <Box variant="p">
              {syncStatus.nextSchedule
                ? new Date(syncStatus.nextSchedule).toLocaleString()
                : "Not scheduled"}
            </Box>
          </SpaceBetween>
        </ColumnLayout>

        <ColumnLayout columns={3} variant="text-grid">
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Critical backlog</Box>
            <Box variant="p">{syncStatus.backlog.critical}</Box>
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Warning backlog</Box>
            <Box variant="p">{syncStatus.backlog.warning}</Box>
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Informational backlog</Box>
            <Box variant="p">{syncStatus.backlog.info}</Box>
          </SpaceBetween>
        </ColumnLayout>

        {syncStatus.errors?.length ? (
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Recent errors</Box>
            {syncStatus.errors.map(error => (
              <Box key={error.id} variant="p">
                <strong>{error.severity.toUpperCase()}</strong> –{" "}
                {new Date(error.time).toLocaleString()} – {error.message}{" "}
                {error.suggestedAction ? `(${error.suggestedAction})` : ""}
              </Box>
            ))}
          </SpaceBetween>
        ) : (
          <Box variant="p">No sync errors recorded in the current period.</Box>
        )}

        <SpaceBetween direction="horizontal" size="xs">
          <Button onClick={manualSync} ariaLabel="Trigger a manual reconciliation sync">
            Trigger manual sync
          </Button>
          <Button variant="link" href="#" onClick={event => event.preventDefault()}>
            View integration logs
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default ReconciliationSyncStatusWidget;
