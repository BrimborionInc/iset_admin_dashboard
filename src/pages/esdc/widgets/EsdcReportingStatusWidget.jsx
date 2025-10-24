import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  Table,
  Box,
  Link,
  StatusIndicator,
  Button,
  ButtonDropdown
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';

const packages = [
  {
    id: 'FY25-Q1',
    period: 'FY25 Q1',
    due: '2025-08-15',
    status: 'accepted',
    owner: 'Finance',
    notes: 'Accepted on first submission'
  },
  {
    id: 'FY25-Q2',
    period: 'FY25 Q2',
    due: '2025-11-15',
    status: 'in-progress',
    owner: 'Program',
    notes: 'Financials uploaded, outcomes pending'
  },
  {
    id: 'FY24-Annual',
    period: 'FY24 Annual',
    due: '2025-05-30',
    status: 'rejected',
    owner: 'Finance',
    notes: 'Waiting for revised schedule B attachment'
  }
];

const statusIndicator = status => {
  if (status === 'accepted') return <StatusIndicator type="success">Accepted</StatusIndicator>;
  if (status === 'rejected') return <StatusIndicator type="error">Rejected</StatusIndicator>;
  return <StatusIndicator type="info">In progress</StatusIndicator>;
};

const EsdcReportingStatusWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel
}) => {
  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === 'remove' && typeof actions.removeItem === 'function') {
      actions.removeItem();
    }
  };

  const infoLink = metadata?.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Reporting packages', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
          actions={<Button iconName="external">Open workspace</Button>}
        >
          Reporting packages
        </Header>
      )}
      settings={
        typeof actions.removeItem === 'function'
          ? (
            <ButtonDropdown
              ariaLabel="Reporting packages settings"
              variant="icon"
              items={[{ id: 'remove', text: 'Remove widget' }]}
              onItemClick={handleSettingsClick}
            />
          )
          : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Table
        columnDefinitions={[
          {
            id: 'period',
            header: 'Period',
            cell: item => <Link href={`/esdc/reporting?period=${encodeURIComponent(item.id)}`}>{item.period}</Link>
          },
          {
            id: 'due',
            header: 'Due',
            cell: item => new Date(item.due).toLocaleDateString()
          },
          {
            id: 'status',
            header: 'Status',
            cell: item => statusIndicator(item.status)
          },
          {
            id: 'owner',
            header: 'Owner',
            cell: item => item.owner
          },
          {
            id: 'notes',
            header: 'Notes',
            cell: item => item.notes
          }
        ]}
        items={packages}
        resizableColumns
        stickyHeader
        empty={<Box textAlign="center">No reporting packages scheduled.</Box>}
        variant="container"
      />
    </BoardItem>
  );
};

export default EsdcReportingStatusWidget;
