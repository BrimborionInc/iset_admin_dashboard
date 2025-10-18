import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  Table,
  Box,
  ButtonDropdown,
  StatusIndicator,
  SpaceBetween,
  Link,
  Button,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";

const columns = [
  { id: "milestone", header: "Milestone", cell: item => item.milestone },
  { id: "type", header: "Type", cell: item => item.type },
  { id: "due", header: "Due date", cell: item => item.due },
  {
    id: "owner",
    header: "Owner",
    cell: item => item.owner,
  },
  {
    id: "status",
    header: "Status",
    cell: item => (
      <StatusIndicator type={item.statusType}>
        {item.statusLabel}
      </StatusIndicator>
    ),
  },
  {
    id: "action",
    header: "Next step",
    cell: item => <Link href={item.ctaHref}>{item.ctaLabel}</Link>,
  },
];

const items = [
  {
    id: "1",
    milestone: "Q3 interim report certification",
    type: "Reporting",
    due: "2025-01-31",
    owner: "Executive Director",
    statusType: "pending",
    statusLabel: "Awaiting certification",
    ctaLabel: "Review report draft",
    ctaHref: "/finance/reports?report=fy24-q3",
  },
  {
    id: "2",
    milestone: "Monitoring evidence bundle upload",
    type: "Monitoring",
    due: "2024-12-10",
    owner: "Finance Officer",
    statusType: "in-progress",
    statusLabel: "Collecting documents",
    ctaLabel: "Open evidence queue",
    ctaHref: "/finance/monitoring?view=evidence",
  },
  {
    id: "3",
    milestone: "Sub-agreement variance response",
    type: "Compliance",
    due: "2024-11-18",
    owner: "Partner Liaison",
    statusType: "warning",
    statusLabel: "Overdue risk",
    ctaLabel: "Message partner lead",
    ctaHref: "/finance/allocations?subAgreement=SA-004",
  },
];

const SimpleDeadlinesWidget = ({
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
          metadata.helpTitle ?? "Finance deadlines",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  const headerActions = (
    <SpaceBetween size="xs" direction="horizontal">
      <Button href="/finance/reports?schedule=upcoming" variant="link">
        Open calendar
      </Button>
      <Button href="/finance/settings?tab=notifications" variant="link">
        Notifications
      </Button>
      <Button href="/finance/reports?action=create-reminder" variant="link">
        Add reminder
      </Button>
    </SpaceBetween>
  );

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
          actions={headerActions}
        >
          Upcoming deadlines
        </Header>
      )}
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Upcoming deadlines settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Table
        items={items}
        columnDefinitions={columns}
        variant="embedded"
        resizableColumns={false}
        stickyHeader={false}
        empty={<Box padding="s">No upcoming deadlines.</Box>}
      />
    </BoardItem>
  );
};

export default SimpleDeadlinesWidget;
