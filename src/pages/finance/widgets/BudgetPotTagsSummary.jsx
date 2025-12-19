import React, { useMemo } from "react";
import { Badge, Box, ColumnLayout, Popover, SpaceBetween } from "@cloudscape-design/components";
import { defaultPotTags } from "./BudgetsDataContext.jsx";

const displayValue = value => {
  if (value === undefined || value === null) return "Not set";
  if (typeof value === "string" && value.trim() === "") return "Not set";
  return value;
};

const BudgetPotTagsSummary = ({ tags, showBadges = false, showGrid = true }) => {
  const resolvedTags = useMemo(() => ({ ...defaultPotTags, ...(tags || {}) }), [tags]);

  const badgeItems = [];
  if (resolvedTags.fundingSource) {
    badgeItems.push({ id: "fundingSource", text: resolvedTags.fundingSource, color: "blue" });
  }
  if (resolvedTags.isRestricted) {
    badgeItems.push({ id: "restricted", text: "Restricted", color: "red" });
  }
  if (resolvedTags.agreementId) {
    badgeItems.push({ id: "agreementId", text: resolvedTags.agreementId, color: "grey" });
  }
  if (resolvedTags.fiscalYearTag) {
    badgeItems.push({ id: "fiscalYearTag", text: resolvedTags.fiscalYearTag, color: "grey" });
  }

  const badgeDescriptions = {
    fundingSource: "Funding source classification used for transfer policies (EI / CRF / Other).",
    restricted: "Restricted pots may have tighter usage/approval guardrails.",
    agreementId: "Agreement or contract identifier tied to this pot.",
    fiscalYearTag: "Fiscal year tag used for reporting/policy (e.g., 2025 or 2025-2026).",
  };

  return (
    <SpaceBetween size="s">
      {showBadges && badgeItems.length ? (
        <SpaceBetween direction="horizontal" size="xxs">
          {badgeItems.map(badge => (
            <Popover
              key={badge.id}
              triggerType="hover"
              size="small"
              position="top"
              content={<Box variant="p">{badgeDescriptions[badge.id] || badge.text}</Box>}
            >
              <Badge color={badge.color}>{badge.text}</Badge>
            </Popover>
          ))}
        </SpaceBetween>
      ) : null}
      {showGrid ? (
        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Funding source</Box>
            <Box variant="p">{displayValue(resolvedTags.fundingSource)}</Box>
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Restricted</Box>
            <Box variant="p">{resolvedTags.isRestricted ? "Yes" : "No"}</Box>
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Agreement ID</Box>
            <Box variant="p">{displayValue(resolvedTags.agreementId)}</Box>
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box variant="awsui-key-label">Fiscal year</Box>
            <Box variant="p">{displayValue(resolvedTags.fiscalYearTag)}</Box>
          </SpaceBetween>
        </ColumnLayout>
      ) : null}
    </SpaceBetween>
  );
};

export default BudgetPotTagsSummary;
