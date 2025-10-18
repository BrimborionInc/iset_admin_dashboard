import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import { Header, Box, ButtonDropdown, SpaceBetween, ColumnLayout, Badge, Link } from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";

const badgeColorByTone = {
  info: "blue",
  positive: "green",
  warning: "red",
  neutral: "grey",
};

const kpiMetrics = [
  {
    id: "budget",
    label: "Total budget",
    primary: "$4.2M",
    secondary: "Spent $2.9M / Remaining $1.3M",
    highlight: { text: "69% of fiscal plan", tone: "info" },
    link: { text: "View budgets", href: "/finance/budgets" },
  },
  {
    id: "adminflat",
    label: "Admin flat-rate usage",
    primary: "$480K / $525K",
    secondary: "FR% 15 / Override pending: No",
    highlight: { text: "91% of cap consumed", tone: "warning" },
    link: { text: "Admin rules", href: "/finance/settings?tab=policy" },
  },
  {
    id: "evidence",
    label: "Evidence coverage",
    primary: "82%",
    secondary: "Flagged transactions: 14 (needs review)",
    highlight: { text: "Coverage target: 90%", tone: "info" },
    link: { text: "Review gaps", href: "/finance/monitoring?view=evidence" },
  },
  {
    id: "forecast",
    label: "Forecast variance",
    primary: "-$120K",
    secondary: "Forecasted YE spend $4.08M vs. budget $4.2M",
    trend: "positive",
    link: { text: "Open forecast", href: "/finance/forecasting" },
  },
];

const SimpleKpiWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
}) => {
  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(
          helpContent,
          metadata.helpTitle ?? "Finance KPIs",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>High-level KPIs</Header>}
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="High-level KPIs settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        <ColumnLayout columns={4} borders="vertical">
          {kpiMetrics.map(metric => (
            <Box key={metric.id} padding={{ top: "s", bottom: "s", right: "s", left: "s" }}>
              <SpaceBetween size="xxs">
                <Box variant="awsui-key-label">
                  {metric.label}
                  {metric.link && (
                    <Box display="inline" margin={{ left: "xs" }}>
                      <Link href={metric.link.href}>{metric.link.text}</Link>
                    </Box>
                  )}
                </Box>
                <Box variant="strong">
                  {metric.primary}
                </Box>
                {metric.secondary && (
                  <Box variant="p">
                    {metric.secondary}
                  </Box>
                )}
                {metric.highlight && (
                  <Badge color={badgeColorByTone[metric.highlight.tone] ?? "grey"}>
                    {metric.highlight.text}
                  </Badge>
                )}
                {metric.trend && (
                  <Badge color={metric.trend === "positive" ? "green" : "red"}>
                    {metric.trend === "positive" ? "Favourable variance" : "Unfavourable variance"}
                  </Badge>
                )}
              </SpaceBetween>
            </Box>
          ))}
        </ColumnLayout>
      </SpaceBetween>
    </BoardItem>
  );
};

export default SimpleKpiWidget;
