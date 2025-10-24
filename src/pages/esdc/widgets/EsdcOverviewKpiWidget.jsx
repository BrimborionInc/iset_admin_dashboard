import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  ColumnLayout,
  Box,
  Badge,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';

const metrics = [
  {
    id: 'ready-participants',
    label: 'Participants ready to submit',
    value: 18,
    detail: 'Out of 42 awaiting validation',
    badge: { text: '+3 vs last week', color: 'green' },
    href: '/esdc/participants?filter=ready'
  },
  {
    id: 'blocked-participants',
    label: 'Participants blocked',
    value: 7,
    detail: 'Most common issue: postal code mismatch',
    badge: { text: 'Action required', color: 'red' },
    href: '/esdc/participants?filter=blocked'
  },
  {
    id: 'reporting-status',
    label: 'Reporting package status',
    value: 'Q2 draft',
    detail: 'Financial statements uploaded, outcomes pending',
    badge: { text: 'Due in 8 days', color: 'orange' },
    href: '/esdc/reporting'
  },
  {
    id: 'success-rate',
    label: 'Submission success rate (30 days)',
    value: '96%',
    detail: '24 accepted, 1 rejected',
    badge: { text: 'Target 100%', color: 'blue' }
  }
];

const EsdcOverviewKpiWidget = ({
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
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Overview KPIs', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>Submission health KPIs</Header>}
      settings={
        typeof actions.removeItem === 'function'
          ? (
            <ButtonDropdown
              ariaLabel="Submission health KPIs settings"
              variant="icon"
              items={[{ id: 'remove', text: 'Remove widget' }]}
              onItemClick={handleSettingsClick}
            />
          )
          : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <ColumnLayout columns={4} borders="vertical">
        {metrics.map(metric => (
          <Box key={metric.id} padding="m">
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">
                {metric.label}
                {metric.href && (
                  <Box display="inline" margin={{ left: 'xs' }}>
                    <Link href={metric.href}>View</Link>
                  </Box>
                )}
              </Box>
              <Box variant="strong" fontSize="display-l">{metric.value}</Box>
              <Box variant="p">{metric.detail}</Box>
              {metric.badge && (
                <Badge color={metric.badge.color}>{metric.badge.text}</Badge>
              )}
            </SpaceBetween>
          </Box>
        ))}
      </ColumnLayout>
    </BoardItem>
  );
};

export default EsdcOverviewKpiWidget;
