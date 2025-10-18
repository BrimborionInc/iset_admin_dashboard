import React, { useMemo, useState, useCallback } from 'react';
import Table from '@cloudscape-design/components/table';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import Checkbox from '@cloudscape-design/components/checkbox';
import Badge from '@cloudscape-design/components/badge';
import Spinner from '@cloudscape-design/components/spinner';
import Alert from '@cloudscape-design/components/alert';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Button from '@cloudscape-design/components/button';
import { useRoleMatrix } from '../context/RoleMatrixContext';

const ROLE_COLUMNS = [
  { key: 'System Administrator', label: 'System Administrator', editable: false },
  { key: 'Program Administrator', label: 'Program Admin', editable: true },
  { key: 'Regional Coordinator', label: 'Regional Coordinator', editable: true },
  { key: 'Application Assessor', label: 'Application Assessor', editable: true }
];

const ROUTE_LABELS = {
  '/access-control': 'Access Control',
  '/admin/upload-config': 'File Upload Config',
  '/application-case/:id': 'Application Case',
  '/arms-reporting': 'ARMS Reporting',
  '/audit-logs-dashboard': 'Audit and Logs',
  '/capacity-planning-dashboard': 'Capacity Planning',
  '/case-assignment-dashboard': 'Manage Applications',
  '/case-assignment-dashboard?view=assignment': 'Application Assignment',
  '/configuration-settings': 'Configuration Settings',
  '/configuration/events': 'Event Capture',
  '/custom-dashboards-dashboard': 'Custom Dashboards',
  '/finance/allocations': 'Allocations & Transfers',
  '/finance/budgets': 'Budgets',
  '/finance/forecasting': 'Forecasting & Scenarios',
  '/finance/monitoring': 'Monitoring & Evidence',
  '/finance/overview': 'Finance Overview',
  '/finance/reconciliation': 'Reconciliation',
  '/finance/reports': 'Financial Reports',
  '/finance/settings': 'Finance Settings',
  '/help-support-dashboard': 'Help and Support',
  '/language-settings-dashboard': 'Language Settings',
  '/manage-components': 'Manage Intake Steps',
  '/manage-notifications': 'Notification Settings',  '/manage-security-options': 'Security Settings',
  '/manage-workflows': 'Manage Workflows',
  '/modify-component/:id': 'Modify Intake Step',
  '/modify-workflow': 'Modify Workflow',
  '/nwac-hub-management': 'NWAC Hub Management',
  '/ptma-management': 'PTMA Management',
  '/release-management-dashboard': 'Release Management',
  '/reporting-and-monitoring-dashboard': 'Reporting and Monitoring',
  '/reporting-dashboard': 'Reporting Dashboard',
  '/service-levels-dashboard': 'Service Levels',
  '/system-performance-dashboard': 'System Performance',
  '/tutorials-dashboard': 'Tutorials',
  '/user-management-dashboard': 'User Management',
  '/visual-settings': 'Visual Settings'
};

const getRouteLabel = (route) => ROUTE_LABELS[route] || route;

const AccessControlMatrix = () => {
  const { roleMatrix, isLoading, error, pendingRoutes, reloadRoleMatrix, refreshRoleMatrix, updateRouteRoles } = useRoleMatrix();
  const [interactionError, setInteractionError] = useState(null);

  const rows = useMemo(() => {
    if (!roleMatrix?.routes) return [];
    return Object.entries(roleMatrix.routes)
      .map(([path, allowed]) => ({
        path,
        name: getRouteLabel(path),
        allowed: Array.isArray(allowed) ? allowed : [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [roleMatrix]);

  const handleToggle = useCallback(async (route, role, checked) => {
    setInteractionError(null);
    try {
      await updateRouteRoles(route, current => {
        const set = new Set(current);
        if (checked) {
          set.add(role);
        } else if (role !== 'System Administrator') {
          set.delete(role);
        }
        return Array.from(set);
      });
    } catch (err) {
      setInteractionError(err?.message || 'Failed to update access control.');
    }
  }, [updateRouteRoles]);

  const renderEditableCell = (roleKey, label) => (item) => (
    <Checkbox
      checked={item.allowed.includes(roleKey)}
      disabled={!!pendingRoutes[item.path] || isLoading}
      onChange={({ detail }) => handleToggle(item.path, roleKey, detail.checked)}
      ariaLabel={`Toggle access for ${label} on ${item.name}`}
    />
  );

  const columns = [
    {
      id: 'name',
      header: 'Dashboard',
      cell: item => item.name,
      sortingField: 'name',
    },
    {
      id: 'route',
      header: 'Route',
      cell: item => (
        <SpaceBetween size="xs">
          <span>{item.path}</span>
          {pendingRoutes[item.path] && <StatusIndicator type="loading">Saving</StatusIndicator>}
        </SpaceBetween>
      ),
      sortingField: 'path',
    },
    ...ROLE_COLUMNS.map(column => ({
      id: column.key,
      header: column.label,
      cell: column.editable
        ? renderEditableCell(column.key, column.label)
        : (item => (
          <Badge color="green">Always</Badge>
        )),
      sortingComparator: (a, b) => {
        const aHas = a.allowed.includes(column.key);
        const bHas = b.allowed.includes(column.key);
        if (aHas === bHas) return 0;
        return aHas ? -1 : 1;
      },
    })),
  ];

  if (isLoading && !roleMatrix) {
    return (
      <Box padding="m" textAlign="center">
        <Spinner />
      </Box>
    );
  }

  return (
    <Box padding="m">
      <SpaceBetween size="m">
        <Alert
          type="info"
          header="Manage dashboard access"
          action={(
            <Button
              onClick={() => refreshRoleMatrix().catch(() => {})}
              iconName="refresh"
              variant="link"
              disabled={isLoading}
            >
              Restore defaults
            </Button>
          )}
        >
          Updates apply immediately for all administrators and persist in the shared configuration store. Use Restore defaults to reinstate the baseline configuration.
        </Alert>
        {error && (
          <Alert
            type="error"
            header="Unable to load access control settings"
            action={
              <Button onClick={() => reloadRoleMatrix().catch(() => {})} variant="primary" disabled={isLoading}>Retry</Button>
            }
          >
            {error}
          </Alert>
        )}
        {interactionError && (
          <Alert
            type="error"
            dismissible
            onDismiss={() => setInteractionError(null)}
          >
            {interactionError}
          </Alert>
        )}
        <Table
          items={rows}
          columnDefinitions={columns}
          header={<Header variant="h3">Route Access Matrix</Header>}
          loading={isLoading}
          loadingText="Loading access control settings"
          sortingDisabled={false}
          wrapLines
          resizableColumns
          stickyHeader
          empty={<Box textAlign="center">No routes configured.</Box>}
        />
      </SpaceBetween>
    </Box>
  );
};

export default AccessControlMatrix;


