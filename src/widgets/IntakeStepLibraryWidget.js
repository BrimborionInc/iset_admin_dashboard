import React, { useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Box, Header, Input } from '@cloudscape-design/components';

const IntakeStepLibraryWidget = ({ items = [], status = 'idle', apiBase = '', onAdd }) => {
  const itemI18n = {
    dragHandleAriaLabel: 'Drag handle',
    dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
    resizeHandleAriaLabel: 'Resize handle',
    resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
  };

  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return items;
    return items.filter(it => it.name.toLowerCase().includes(f));
  }, [items, filter]);

  return (
    <BoardItem header={<Header variant="h2">Intake Step Library</Header>} i18nStrings={itemI18n}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Input placeholder="Filter steps" value={filter} onChange={({detail}) => setFilter(detail.value)} />
        {filtered.map(item => (
          <div
            key={item.id}
            onClick={() => onAdd && onAdd(item)}
            style={{ padding: 8, border: '1px solid #d5dbdb', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
          >
            {item.name}
          </div>
        ))}
        {filtered.length === 0 && status !== 'loading' && <Box variant="div" color="text-body-secondary">No steps match.</Box>}
        {status === 'loading' && <Box variant="div" color="text-status-info">Loading…</Box>}
        {status === 'error' && (
          <Box variant="div" color="text-status-danger">Failed to load library from {apiBase || '(no base)'}</Box>
        )}
      </div>
    </BoardItem>
  );
};

export default IntakeStepLibraryWidget;
