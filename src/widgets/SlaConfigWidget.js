import React, { useMemo } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  SpaceBetween,
  Alert,
  StatusIndicator,
  Table,
  Box,
  Input,
  Header,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import boardItemI18nStrings from './common';

export default function SlaConfigWidget({
  actions,
  metadata,
  toggleHelpPanel,
  headerActions,
  slaError,
  slaLoading,
  effectiveSlaTargets,
  canEditSla,
  slaEdits,
  handleSlaEdit,
  slaStageLabels
}) {
  const handleOpenHelp = () => {
    if (!toggleHelpPanel) return;
    const HelpComponent = metadata?.helpComponent;
    if (!HelpComponent) return;
    const title = metadata?.helpTitle || metadata?.title || 'SLA configuration';
    const context = metadata?.aiContext || '';
    toggleHelpPanel(<HelpComponent />, title, context);
  };

  const infoLink =
    metadata?.helpComponent && toggleHelpPanel ? (
      <Link variant="info" onClick={handleOpenHelp}>
        Info
      </Link>
    ) : undefined;

  const settingsMenu =
    actions && typeof actions.removeItem === 'function' ? (
      <ButtonDropdown
        ariaLabel="SLA configuration widget settings"
        variant="icon"
        items={[{ id: 'remove', text: 'Remove widget' }]}
        onItemClick={({ detail }) => {
          if (detail.id === 'remove') {
            actions.removeItem();
          }
        }}
      />
    ) : undefined;

  const orderedItems = useMemo(() => {
    const order = ['assignment', 'assessment', 'program_decision'];
    const index = key => {
      const i = order.indexOf(key);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...(effectiveSlaTargets || [])].sort((a, b) => index(a.stage_key) - index(b.stage_key));
  }, [effectiveSlaTargets]);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={metadata?.description}
          info={infoLink}
          actions={headerActions}
        >
          {metadata?.title || 'SLA configuration'}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        {slaError && <Alert type="error" header="SLA configuration">{slaError}</Alert>}
        {slaLoading ? (
          <StatusIndicator type="loading">Loading SLA targets</StatusIndicator>
        ) : (
          <Table
            columnDefinitions={[
              {
                id: 'stage',
                header: 'Stage',
                cell: item => item.display_name || slaStageLabels[item.stage_key] || item.stage_key
              },
              {
                id: 'target',
                header: 'Target (days)',
                cell: item =>
                  canEditSla ? (
                    <Input
                      type="number"
                      value={slaEdits[item.stage_key]?.target_days ?? ''}
                      onChange={e => handleSlaEdit(item.stage_key, 'target_days', e.detail.value)}
                      inputMode="numeric"
                      ariaLabel={`Target days for ${item.display_name || slaStageLabels[item.stage_key] || item.stage_key}`}
                    />
                  ) : (
                    <Box>{item.target_days}</Box>
                  )
              },
              {
                id: 'notes',
                header: 'Notes',
                cell: item =>
                  canEditSla ? (
                    <Input
                      value={slaEdits[item.stage_key]?.description ?? ''}
                      onChange={e => handleSlaEdit(item.stage_key, 'description', e.detail.value)}
                      placeholder="Optional"
                    />
                  ) : (
                    <Box>{item.description || '-'}</Box>
                  )
              }
            ]}
            items={orderedItems}
            trackBy="stage_key"
            variant="embedded"
            empty={<Box>No SLA targets configured.</Box>}
          />
        )}
        {!canEditSla && <StatusIndicator type="stopped">Read only</StatusIndicator>}
      </SpaceBetween>
    </BoardItem>
  );
}
