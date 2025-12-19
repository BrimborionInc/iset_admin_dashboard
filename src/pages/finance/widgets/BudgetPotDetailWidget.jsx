import React, { useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  StatusIndicator,
  Link,
  ColumnLayout,
  Badge,
  Button,
  Tabs,
  Table,
  Popover,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useBudgetsData } from "./BudgetsDataContext.jsx";
import BudgetPotTagsSummary from "./BudgetPotTagsSummary.jsx";
import { apiFetch } from "../../../auth/apiClient";

const BudgetPotDetailWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { pots, selectedPotId, selectedDraftId, selectedDraftPots, selectedPotSource } = useBudgetsData();
  const activePot = useMemo(() => {
    if (!Array.isArray(pots) || pots.length === 0) {
      return null;
    }
    if (selectedPotId) {
      const match = pots.find(entry => entry.id === selectedPotId);
      return match ?? null;
    }
    return null;
  }, [pots, selectedPotId]);

  const draftPot = useMemo(() => {
    if (!selectedDraftId || !Array.isArray(selectedDraftPots)) return null;
    if (!selectedPotId) return null;
    return selectedDraftPots.find(p => String(p.id) === String(selectedPotId)) || null;
  }, [selectedDraftId, selectedDraftPots, selectedPotId]);

  const pot = useMemo(() => {
    if (selectedPotSource === "draft" && draftPot) {
      // Merge draft-specific fields over the active pot so policy/tags reflect draft edits while retaining base metadata.
      const base = activePot ? { ...activePot } : {};
      Object.entries(draftPot).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          base[key] = value;
        }
      });
      base.status = draftPot.status || "draft";
      return base;
    }
    if (selectedPotSource === "active") {
      return activePot;
    }
    return null;
  }, [activePot, draftPot, selectedPotSource]);

  const isDraftView = selectedPotSource === "draft";
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
  const potTags = pot
    ? {
        fundingSource: pot.fundingSource || null,
        isRestricted: !!pot.isRestricted,
        agreementId: pot.agreementId || null,
        fiscalYearTag: pot.fiscalYearTag || pot.fiscalYear || null,
      }
    : null;
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
  const [activeTabId, setActiveTabId] = useState("financials");
  const [evidenceError, setEvidenceError] = useState(null);

  const openEvidenceAttachment = async att => {
    if (!att) return;
    const directUrl = att.url && /^https?:\/\//i.test(att.url) ? att.url : null;
    if (directUrl) {
      window.open(directUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!att.key && !att.url) {
      setEvidenceError("Attachment link is unavailable.");
      return;
    }
    setEvidenceError(null);
    try {
      const res = await apiFetch("/api/allocations/evidence/presign-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: att.key || att.url }),
      });
      if (!res || !res.ok) {
        throw new Error("Unable to prepare download.");
      }
      const payload = await res.json().catch(() => null);
      const target = payload?.url;
      if (!target) {
        throw new Error("Download link unavailable.");
      }
      const finalUrl = /^https?:\/\//i.test(target)
        ? target
        : `${process.env.REACT_APP_API_BASE_URL || ""}${target}`;
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setEvidenceError(err?.message || "Failed to open attachment.");
    }
  };

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const renderFinancials = () => {
    const rows = [
      {
        id: "approved",
        label: "Approved amount",
        description: "Original authority for this pot (CAD).",
        value:
          pot?.approved !== undefined && pot?.approved !== null
            ? `$${Number(pot.approved).toLocaleString("en-CA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—",
      },
      {
        id: "adjusted",
        label: "Adjusted amount",
        description: "Approved plus/minus amendments (CAD).",
        value:
          pot?.adjusted !== undefined && pot?.adjusted !== null
            ? `$${Number(pot.adjusted).toLocaleString("en-CA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—",
      },
      {
        id: "committed",
        label: "Committed",
        description: "Total commitments recorded for this pot (CAD).",
        value:
          pot?.committed !== undefined && pot?.committed !== null
            ? `$${Number(pot.committed).toLocaleString("en-CA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—",
      },
      {
        id: "actual",
        label: "Actual",
        description: "Actual spend to date for this pot (CAD).",
        value:
          pot?.actual !== undefined && pot?.actual !== null
            ? `$${Number(pot.actual).toLocaleString("en-CA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—",
      },
      {
        id: "remaining",
        label: "Remaining",
        description: "Available funds remaining (adjusted minus commitments/actuals).",
        value:
          pot?.remaining !== undefined && pot?.remaining !== null
            ? `$${Number(pot.remaining).toLocaleString("en-CA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—",
      },
      {
        id: "forecastVariance",
        label: "Forecast variance",
        description: "Projected variance against adjusted amount.",
        value:
          pot?.forecastVariance !== undefined && pot?.forecastVariance !== null
            ? `$${Number(pot.forecastVariance).toLocaleString("en-CA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—",
      },
      {
        id: "pacing",
        label: "Pacing",
        description: "Spend pace versus period target.",
        value:
          pot?.pacing !== undefined && pot?.pacing !== null
            ? `${Number(pot.pacing).toLocaleString("en-CA", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}%`
            : "—",
      },
    ];

    return (
      <Table
        variant="embedded"
        stripedRows
        columnDefinitions={[
          {
            id: "label",
            header: "Metric",
            cell: item => (
              <SpaceBetween size="xxs">
                <Box variant="strong">{item.label}</Box>
                <Box variant="p" color="text-body-secondary">
                  {item.description}
                </Box>
              </SpaceBetween>
            ),
          },
          {
            id: "value",
            header: "Value",
            cell: item => <Box>{item.value}</Box>,
          },
        ]}
        items={rows}
        trackBy="id"
      />
    );
  };

  const renderAdjustments = () => (
    <Table
      header={
        <Header variant="h3" headingTagOverride="h3">
          Adjustment timeline
        </Header>
      }
      variant="embedded"
      stripedRows
      trackBy="id"
      items={adjustments}
      empty={<Box variant="p">No adjustments recorded for this pot.</Box>}
      columnDefinitions={[
        {
          id: "date",
          header: "Date",
          cell: item => item.date || "—",
        },
        {
          id: "type",
          header: "Type",
          cell: item => item.type || "—",
        },
        {
          id: "amount",
          header: "Amount",
          cell: item => {
            const numeric = Number(item.amount);
            if (!Number.isFinite(numeric)) return "—";
            const formatted = `$${Math.abs(numeric).toLocaleString("en-CA")}`;
            return numeric >= 0 ? formatted : `-${formatted}`;
          },
        },
        {
          id: "reason",
          header: "Reason",
          cell: item => item.reason || "—",
        },
        {
          id: "user",
          header: "Submitted by",
          cell: item => item.user || "—",
        },
      ]}
    />
  );

  const renderApprovals = () => (
    <Table
      header={
        <Header variant="h3" headingTagOverride="h3">
          Approvals &amp; controls
        </Header>
      }
      variant="embedded"
      stripedRows
      trackBy="id"
      items={approvals}
      empty={<Box variant="p">No approvals recorded yet.</Box>}
      columnDefinitions={[
        {
          id: "date",
          header: "Date",
          cell: item => item.date || "—",
        },
        {
          id: "type",
          header: "Type",
          cell: item => item.type || "—",
        },
        {
          id: "owner",
          header: "Owner",
          cell: item => item.owner || "—",
        },
        {
          id: "id",
          header: "Reference",
          cell: item => item.id || "—",
        },
      ]}
    />
  );

  const renderEvidence = () => (
    <SpaceBetween size="s">
      <Header variant="h3" headingTagOverride="h3">
        Evidence references
      </Header>
      <Table
        variant="embedded"
        compact
        wrapLines
        trackBy="id"
        columnDefinitions={[
          { id: "label", header: "Label", cell: item => item.label || "Evidence" },
          { id: "type", header: "Type", cell: item => item.type || "Not set" },
          {
            id: "attachments",
            header: "Attachments",
            cell: item =>
              item.attachments && item.attachments.length ? (
                <SpaceBetween size="xxs">
                  {item.attachments.map((att, idx) => (
                    <Link
                      key={`${item.id}-att-${idx}`}
                      href={att.url || "#"}
                      onFollow={event => {
                        event.preventDefault();
                        openEvidenceAttachment(att);
                      }}
                      target="_blank"
                    >
                      {att.name || att.key || "Attachment"}
                    </Link>
                  ))}
                </SpaceBetween>
              ) : (
                <Box variant="p">-</Box>
              ),
          },
        ]}
        items={
          Array.isArray(evidence)
            ? evidence.map((entry, idx) => {
                const isObject = entry && typeof entry === "object";
                return {
                  id: `evidence-${idx}`,
                  label: isObject ? entry.label : entry,
                  type: isObject ? entry.type : null,
                  attachments:
                    isObject && Array.isArray(entry.attachments) ? entry.attachments : [],
                };
              })
            : []
        }
        empty={<Box variant="p">No evidence linked.</Box>}
      />
      {evidenceError ? (
        <Box variant="p" color="text-status-error">
          {evidenceError}
        </Box>
      ) : null}
    </SpaceBetween>
  );

  const renderPolicy = () => (
    <SpaceBetween size="m">
      <SpaceBetween size="s">
        <Box variant="awsui-key-label">Classification &amp; tags</Box>
        {potTags &&
        (potTags.fundingSource || potTags.agreementId || potTags.fiscalYearTag || potTags.isRestricted) ? (
          <BudgetPotTagsSummary tags={potTags} />
        ) : (
          <Box variant="p" fontStyle="italic">
            Not set
          </Box>
        )}
      </SpaceBetween>
      <SpaceBetween size="s">
        <Box variant="awsui-key-label">Policy notes &amp; references</Box>
        <Box variant="p" fontStyle={pot?.policyNotes ? "normal" : "italic"}>
          {pot?.policyNotes?.trim() ? pot.policyNotes : "Not set"}
        </Box>
      </SpaceBetween>
    </SpaceBetween>
  );

  const tabs = [
    { id: "financials", label: "Financials", content: renderFinancials() },
    { id: "adjustments", label: "Adjustments", content: renderAdjustments() },
    { id: "approvals", label: "Approvals", content: renderApprovals() },
    { id: "evidence", label: "Evidence", content: renderEvidence() },
    { id: "policy", label: "Policy", content: renderPolicy() },
  ];

  const quickActionsMenuItems = [
    {
      id: "edit",
      text: "Edit pot",
      disabled: !activePotId,
      action: () => {
        if (!activePotId) return;
        window.dispatchEvent(
          new CustomEvent("financeBudgets:managePot", {
            detail: { mode: "edit", potId: activePotId },
          })
        );
      },
    },
    {
      id: "create-child",
      text: "Create child",
      disabled: !activePotId,
      action: () => {
        if (!activePotId) return;
        window.dispatchEvent(
          new CustomEvent("financeBudgets:managePot", {
            detail: { mode: "create", parentId: activePotId },
          })
        );
      },
    },
    {
      id: "forecasting",
      text: "Open forecasting",
      disabled: !activePotId,
      action: () =>
        window.dispatchEvent(
          new CustomEvent("financeBudgets:navigate", {
            detail: { target: "forecasting", potId: activePotId },
          })
        ),
    },
    {
      id: "reallocation",
      text: "Start reallocation",
      disabled: !activePotId,
      action: () =>
        window.dispatchEvent(
          new CustomEvent("financeBudgets:navigate", {
            detail: { target: "allocations", potId: activePotId },
          })
        ),
    },
  ];

  const exportMenuItems = [
    { id: "csv", text: "CSV snapshot", disabled: !activePotId },
    { id: "pdf", text: "PDF board pack", disabled: !activePotId },
    { id: "json", text: "JSON API payload", disabled: !activePotId },
  ];

  const handleExport = async format => {
    if (!activePotId) return;
    if (format !== "csv") {
      window.dispatchEvent(
        new CustomEvent("financeBudgets:export", {
          detail: { format, potId: activePotId },
        })
      );
      return;
    }
    try {
      const resp = await apiFetch(`/api/finance/budget-pots/${activePotId}/export?format=csv`, {
        method: "GET",
        headers: { Accept: "text/csv" },
      });
      if (!resp.ok) {
        throw new Error(`Export failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `budget-pot-${activePotId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[PotDetail] CSV export failed", err);
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Review history, evidence, and policy guardrails for the selected pot."
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <ButtonDropdown
                variant="normal"
                ariaLabel="Export pot"
                disabled={!activePotId}
                items={exportMenuItems}
                onItemClick={({ detail }) => handleExport(detail.id)}
              >
                Export
              </ButtonDropdown>
              <ButtonDropdown
                variant="normal"
                ariaLabel="Pot actions"
                disabled={!activePotId}
                items={quickActionsMenuItems.map(item => ({
                  id: item.id,
                  text: item.text,
                  disabled: item.disabled,
                }))}
                onItemClick={({ detail }) => {
                  const item = quickActionsMenuItems.find(entry => entry.id === detail.id);
                  if (item && typeof item.action === "function") {
                    item.action();
                  }
                }}
              >
                Actions
              </ButtonDropdown>
            </SpaceBetween>
          }
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
        <SpaceBetween size="s">
          {pot ? (
            <SpaceBetween size="s">
              <Box variant="strong">{pot.name}</Box>
              <SpaceBetween direction="horizontal" size="xxs">
                <Popover
                  triggerType="hover"
                  size="small"
                  position="top"
                  content={
                    <Box variant="p">
                      {isDraftView
                        ? "Draft pot in the current draft payload. Publish to make active."
                        : "Active (published) pot currently in use."}
                    </Box>
                  }
                >
                  {isDraftView ? <Badge color="red">Draft</Badge> : <Badge color="grey">Active</Badge>}
                </Popover>
                {pot.code ? (
                  <Popover
                    triggerType="hover"
                    size="small"
                    position="top"
                    content={<Box variant="p">Funding code / identifier for this pot.</Box>}
                  >
                    <Badge color="blue">{pot.code}</Badge>
                  </Popover>
                ) : null}
                {pot.owner ? (
                  <Popover
                    triggerType="hover"
                    size="small"
                    position="top"
                    content={<Box variant="p">Responsible owner or coordinating role for this pot.</Box>}
                  >
                    <Badge color="green">{pot.owner}</Badge>
                  </Popover>
                ) : null}
                {pot ? <BudgetPotTagsSummary tags={potTags} showBadges showGrid={false} /> : null}
              </SpaceBetween>
              {pot.description ? <Box variant="p">{pot.description}</Box> : null}
            </SpaceBetween>
          ) : (
            <Alert type="info" header="No pot selected">
              Select a pot in the current Budget hierarchy tab (Active or Draft) to view its details.
            </Alert>
          )}
        </SpaceBetween>

        {pot ? (
          <Tabs
            tabs={tabs}
            activeTabId={activeTabId}
            onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          />
        ) : null}
      </SpaceBetween>
    </BoardItem>
  );
};

export default BudgetPotDetailWidget;
