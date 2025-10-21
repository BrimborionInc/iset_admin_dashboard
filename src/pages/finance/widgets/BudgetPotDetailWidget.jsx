import React, { useMemo } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  StatusIndicator,
  Link,
  ColumnLayout,
  Badge,
  Button,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useBudgetsData } from "./BudgetsDataContext.jsx";

const BudgetPotDetailWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { pots, selectedPotId } = useBudgetsData();
  const pot = useMemo(() => {
    if (!Array.isArray(pots) || pots.length === 0) {
      return null;
    }
    if (selectedPotId) {
      const match = pots.find(entry => entry.id === selectedPotId);
      if (match) {
        return match;
      }
    }
    return pots[0];
  }, [pots, selectedPotId]);
  const activePotId = pot?.id ?? null;
  const adminPercentage =
    pot && pot.adjusted ? Math.round(((pot.adminShare ?? 0) / pot.adjusted) * 1000) / 10 : 0;
  const lifecycleType =
    pot?.status === "draft"
      ? "warning"
      : pot?.status === "pending"
        ? "info"
        : pot?.status === "archived"
          ? "stopped"
          : "success";
  const lifecycleLabel =
    pot?.status === "draft"
      ? "Draft"
      : pot?.status === "pending"
        ? "Pending publish"
        : pot?.status === "archived"
          ? "Archived"
          : "Published";
  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Pot detail", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const adjustments = useMemo(() => pot?.adjustments ?? [], [pot]);
  const approvals = useMemo(() => pot?.approvals ?? [], [pot]);
  const evidence = useMemo(() => pot?.evidence ?? [], [pot]);

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Review history, evidence, and policy guardrails for the selected pot."
        >
          Pot detail
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Pot detail settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="l">
        <SpaceBetween size="xs">
          <Box variant="awsui-key-label">Selected pot</Box>
          {pot ? (
            <SpaceBetween size="s">
              <SpaceBetween size="xxs">
                <Box variant="strong">{pot.name}</Box>
                <SpaceBetween direction="horizontal" size="xxs">
                  {pot.code ? <Badge color="blue">{pot.code}</Badge> : null}
                  {pot.owner ? <Badge color="green">{pot.owner}</Badge> : null}
                </SpaceBetween>
                {pot.description ? <Box variant="p">{pot.description}</Box> : null}
              </SpaceBetween>
              <SpaceBetween direction="horizontal" size="xs">
                <StatusIndicator type={lifecycleType}>{lifecycleLabel}</StatusIndicator>
                <StatusIndicator type={adminPercentage > 15 ? "warning" : "info"}>
                  Admin allocation {adminPercentage.toFixed(1)}%
                </StatusIndicator>
              </SpaceBetween>
            </SpaceBetween>
          ) : (
            <StatusIndicator type="pending">No pot selected</StatusIndicator>
          )}
        </SpaceBetween>

        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Owner</Box>
            <Box variant="p">{pot?.owner ?? "Unassigned"}</Box>
            <Box variant="awsui-key-label">Policy guardrails</Box>
            <Box variant="p">{pot?.policyNotes ?? "Policy notes not captured yet."}</Box>
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Quick actions</Box>
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                iconName="edit"
                disabled={!activePotId}
                onClick={() => {
                  if (!activePotId) {
                    return;
                  }
                  window.dispatchEvent(
                    new CustomEvent("financeBudgets:managePot", {
                      detail: { mode: "edit", potId: activePotId },
                    })
                  );
                }}
              >
                Edit pot
              </Button>
              <Button
                iconName="add-plus"
                disabled={!activePotId}
                onClick={() => {
                  if (!activePotId) {
                    return;
                  }
                  window.dispatchEvent(
                    new CustomEvent("financeBudgets:managePot", {
                      detail: { mode: "create", parentId: activePotId },
                    })
                  );
                }}
              >
                Create child
              </Button>
              <Button
                iconName="tools"
                disabled={!activePotId}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("financeBudgets:navigate", { detail: { target: "forecasting", potId: activePotId } })
                  )
                }
              >
                Open forecasting
              </Button>
              <Button
                iconName="shuffle"
                disabled={!activePotId}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("financeBudgets:navigate", { detail: { target: "allocations", potId: activePotId } })
                  )
                }
              >
                Start reallocation
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        </ColumnLayout>

        <SpaceBetween size="s">
          <Box variant="awsui-key-label">Adjustment timeline</Box>
          {adjustments.length ? (
            adjustments.map(entry => (
              <Box key={entry.id} padding={{ bottom: "xs" }}>
                <SpaceBetween size="xxs">
                  <Box variant="strong">
                    {entry.date} - {entry.type} {entry.amount >= 0 ? "increase" : "decrease"} $
                    {Math.abs(entry.amount).toLocaleString("en-CA")}
                  </Box>
                  <Box variant="p">{entry.reason}</Box>
                  <Box variant="awsui-key-label">Submitted by {entry.user}</Box>
                </SpaceBetween>
              </Box>
            ))
          ) : (
            <Box variant="p">No adjustments recorded for this pot.</Box>
          )}
        </SpaceBetween>

        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Approvals &amp; controls</Box>
            {approvals.length ? (
              approvals.map(approval => (
                <Box key={approval.id} variant="p">
                  <strong>{approval.type}</strong> ({approval.id}) - {approval.date} - {approval.owner}
                </Box>
              ))
            ) : (
              <Box variant="p">No approvals recorded yet.</Box>
            )}
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Evidence references</Box>
            {evidence.length ? (
              evidence.map(doc => (
                <Link key={doc.id} href={doc.href}>
                  {doc.label}
                </Link>
              ))
            ) : (
              <Box variant="p">No evidence linked.</Box>
            )}
          </SpaceBetween>
        </ColumnLayout>
      </SpaceBetween>
    </BoardItem>
  );
};

export default BudgetPotDetailWidget;
