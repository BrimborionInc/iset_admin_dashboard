import React, { useMemo } from 'react';
import Table from '@cloudscape-design/components/table';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import Badge from '@cloudscape-design/components/badge';
import roleMatrix from '../config/roleMatrix.json';

const roles = ['System Administrator','Program Administrator','Regional Coordinator','PTMA Staff'];

export default function AccessControlMatrix() {
  const rows = useMemo(() => {
    const entries = Object.entries(roleMatrix.routes || {});
    return entries.map(([path, allowed]) => ({ path, allowed }));
  }, []);

  return (
    <Box padding="m">
      <Table
        columnDefinitions={[
          { id: 'route', header: 'Route', cell: r => r.path, sortingField: 'path' },
          { id: 'sa', header: 'SA', cell: r => (r.allowed.includes('System Administrator') ? <Badge color="blue">Yes</Badge> : ''), sortingComparator: (a, b) => (a.allowed.includes('System Administrator') === b.allowed.includes('System Administrator') ? 0 : a.allowed.includes('System Administrator') ? -1 : 1) },
          { id: 'pa', header: 'PA', cell: r => (r.allowed.includes('Program Administrator') ? <Badge color="blue">Yes</Badge> : ''), sortingComparator: (a, b) => (a.allowed.includes('Program Administrator') === b.allowed.includes('Program Administrator') ? 0 : a.allowed.includes('Program Administrator') ? -1 : 1) },
          { id: 'rc', header: 'RC', cell: r => (r.allowed.includes('Regional Coordinator') ? <Badge color="blue">Yes</Badge> : ''), sortingComparator: (a, b) => (a.allowed.includes('Regional Coordinator') === b.allowed.includes('Regional Coordinator') ? 0 : a.allowed.includes('Regional Coordinator') ? -1 : 1) },
          { id: 'ptma', header: 'PTMA', cell: r => (r.allowed.includes('PTMA Staff') ? <Badge color="blue">Yes</Badge> : ''), sortingComparator: (a, b) => (a.allowed.includes('PTMA Staff') === b.allowed.includes('PTMA Staff') ? 0 : a.allowed.includes('PTMA Staff') ? -1 : 1) },
        ]}
        items={rows}
        header={<Header variant="h3">Route Access Matrix</Header>}
        sortingDisabled={false}
        wrapLines
        resizableColumns
        stickyHeader
        empty={<Box textAlign="center">No routes configured.</Box>}
      />
    </Box>
  );
}
