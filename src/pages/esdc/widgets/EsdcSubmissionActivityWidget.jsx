import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  Table,
  Box,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';

const activityItems = [
  {
    id: 'act-1',
    timestamp: '2025-10-22T14:32:00Z',
    actor: 'M. Cardinal',
    action: 'Validated participant',
    detail: 'Checklist cleared for client 712345678',
    link: '/esdc/participants/712345678'
  },
  {
    id: 'act-2',
    timestamp: '2025-10-21T09:05:00Z',
    actor: 'L. Hamilton',
    action: 'Submitted reporting package',
    detail: 'Q1 FY25 package uploaded and logged',
    link: '/esdc/reporting'
  },
  {
    id: 'act-3',
    timestamp: '2025-10-20T16:48:00Z',
    actor: 'J. Dunn',
    action: 'Submission rejected',
    detail: 'ESDC rejected participant file (postal code mismatch)',
    link: '/esdc/participants?filter=blocked'
  }
];

const EsdcSubmissionActivityWidget = ({
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
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Submission activity', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>Recent submission activity</Header>}
      settings={
        typeof actions.removeItem === 'function'
          ? (
            <ButtonDropdown
              ariaLabel="Recent submission activity settings"
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
            id: 'timestamp',
            header: 'When',
            cell: item => new Date(item.timestamp).toLocaleString()
          },
          {
            id: 'actor',
            header: 'Who',
            cell: item => item.actor
          },
          {
            id: 'action',
            header: 'What',
            cell: item => item.action
          },
          {
            id: 'detail',
            header: 'Details',
            cell: item => item.link ? (
              <Link href={item.link}>{item.detail}</Link>
            ) : item.detail
          }
        ]}
        items={activityItems}
        resizableColumns
        stickyHeader
        wrapLines
        empty={<Box textAlign="center">No activity recorded yet.</Box>}
        variant="container"
      />
    </BoardItem>
  );
};

export default EsdcSubmissionActivityWidget;
