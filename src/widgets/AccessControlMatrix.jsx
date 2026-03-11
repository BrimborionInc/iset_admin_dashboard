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
import { getRoleDisplayName } from '../utils/roleDisplay';

const ROLE_COLUMNS = [
  { key: 'System Administrator', label: getRoleDisplayName('System Administrator'), editable: false },
  { key: 'Program Administrator', label: getRoleDisplayName('Program Administrator'), editable: true },
  { key: 'Regional Coordinator', label: getRoleDisplayName('Regional Coordinator'), editable: true },
  { key: 'Application Assessor', label: getRoleDisplayName('Application Assessor'), editable: true }
];

const NAV_SECTIONS = [
  {
    section: 'Intake and Assessment',
    items: [
      { href: '/iset/applications/intake', label: 'Manual Application Intake' },
      { href: '/case-assignment-dashboard', label: 'Application Assessment' },
    ],
  },
  {
    section: 'Case Management',
    items: [
      { href: '/iset/cases', label: 'Case Management' },
      { href: '/case-management', label: 'My Case Queue' },
      { href: '/job-bank-search', label: 'Job Bank Search' },
    ],
  },
  {
    section: 'Budgets and Payments',
    items: [
      { href: '/finance/overview', label: 'Finance Overview' },
      { href: '/finance/budgets', label: 'Budgets' },
      { href: '/finance/allocations', label: 'Allocations & Transfers' },
      { href: '/finance/payments', label: 'Payments' },
      { href: '/finance/reconciliation', label: 'Reconciliation' },
      { href: '/finance/reports', label: 'Financial Reports' },
      { href: '/finance/monitoring', label: 'Monitoring & Evidence' },
      { href: '/finance/forecasting', label: 'Forecasting & Scenarios' },
      { href: '/finance/settings', label: 'Finance Settings' },
    ],
  },
  {
    section: 'ESDC Reporting',
    items: [
      { href: '/esdc/overview', label: 'Overview' },
      { href: '/esdc/participants', label: 'ILMP Exports' },
      { href: '/esdc/reporting', label: 'Reporting' },
    ],
  },
  {
    section: 'Edit Digital Forms',
    items: [
      { href: '/manage-components', label: 'Manage Intake Steps' },
      { href: '/manage-workflows', label: 'Manage Workflows' },
    ],
  },
  {
    section: 'Analytics Dashboard',
    items: [{ href: '/reporting-and-monitoring-dashboard', label: 'Reporting and Monitoring' }],
  },
  {
    section: 'ISET Administration',
    items: [
      { href: '/nwac-hub-management', label: 'NWAC Hub Management' },
      { href: '/ptma-management', label: 'PTMA Management' },
    ],
  },
  {
    section: 'Configuration',
    items: [
      { href: '/user-management-dashboard', label: 'User Management' },
      { href: '/release-management-dashboard', label: 'Release Management' },
      { href: '/manage-notifications', label: 'Notification Settings' },
      { href: '/template-editor', label: 'Template Editor' },
      { href: '/language-settings-dashboard', label: 'Language Settings' },
      { href: '/configuration/events', label: 'Event Logging' },
      { href: '/configuration-settings', label: 'Configuration Settings' },
      { href: '/configuration/query-editor', label: 'Query Editor' },
      { href: '/admin/upload-config', label: 'File Upload Config' },
    ],
  },
  {
    section: 'Security',
    items: [
      { href: '/audit-logs-dashboard', label: 'Audit and Logs' },
      { href: '/manage-security-options', label: 'Security Settings' },
      { href: '/access-control', label: 'Access Control' },
    ],
  },
  {
    section: 'Support',
    items: [
      { href: '/documentation', label: 'Guidance' },
      { href: '/tutorials-dashboard', label: 'Tutorials' },
      { href: '/help-support-dashboard', label: 'Help and Support' },
    ],
  },
  {
    section: 'Footer links',
    items: [
      { href: '/contact-communications', label: 'Contact Communications' },
      { href: '/messages', label: 'Messages' },
    ],
  },
];

const NAV_ROUTE_META = NAV_SECTIONS.reduce((acc, section, sectionIndex) => {
  (section.items || []).forEach((item, routeIndex) => {
    if (!item?.href) return;
    acc[item.href] = {
      section: section.section,
      sectionOrder: sectionIndex,
      routeOrder: routeIndex,
      label: item.label,
    };
  });
  return acc;
}, {});

const DEFAULT_META = {
  section: 'Other routes',
  sectionOrder: Number.MAX_SAFE_INTEGER,
  routeOrder: Number.MAX_SAFE_INTEGER,
  label: null,
};

const ROUTE_LABELS = {
  '/arms-reporting': 'ARMS Reporting',
  '/access-control': 'Access Control',
  '/admin/upload-config': 'File Upload Config',
  '/application-case/:id': 'Application Case',
  '/audit-logs-dashboard': 'Audit and Logs',
  '/capacity-planning-dashboard': 'Capacity Planning',
  '/case-assignment-dashboard': 'Manage Applications',
  '/case-assignment-dashboard?view=assignment': 'Application Assignment',
  '/contact-communications': 'Contact Communications',
  '/custom-dashboards-dashboard': 'Custom Dashboards',
  '/documentation': 'Documentation',
  '/messages': 'Messages',
  '/configuration-settings': 'Configuration Settings',
  '/configuration/events': 'Event Capture',
  '/configuration/query-editor': 'Query Editor',
  '/finance/allocations': 'Allocations & Transfers',
  '/finance/budgets': 'Budgets',
  '/finance/payments': 'Finance Payments',
  '/finance/forecasting': 'Forecasting & Scenarios',
  '/finance/monitoring': 'Monitoring & Evidence',
  '/finance/overview': 'Finance Overview',
  '/finance/reconciliation': 'Reconciliation',
  '/finance/reports': 'Financial Reports',
  '/finance/settings': 'Finance Settings',
  '/esdc/overview': 'ESDC Submissions Overview',
  '/esdc/participants': 'ILMP Submissions & Exports',
  '/esdc/reporting': 'Reporting Packages',
  '/help-support-dashboard': 'Help and Support',
  '/language-settings-dashboard': 'Language Settings',
  '/manage-components': 'Manage Intake Steps',
  '/manage-notifications': 'Notification Settings',
  '/template-editor': 'Template Editor',
  '/manage-security-options': 'Security Settings',
  '/manage-workflows': 'Manage Workflows',
  '/iset/applications/intake': 'Manual Application Intake',
  '/iset/cases': 'ISET Clients',
  '/iset/cases/new': 'New Case',
  '/cases/:caseId': 'Case Workspace',
  '/modify-component/:id': 'Modify Intake Step',
  '/modify-workflow': 'Modify Workflow',
  '/nwac-hub-management': 'NWAC Hub Management',
  '/ptma-management': 'PTMA Management',
  '/release-management-dashboard': 'Release Management',
  '/reporting-and-monitoring-dashboard': 'Reporting and Monitoring',
  '/tutorials-dashboard': 'Tutorials',
  '/user-management-dashboard': 'User Management',
  '/visual-settings': 'Visual Settings'
};

const toTitleCase = text =>
  String(text || '')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const normalizeAcronyms = text =>
  text
    .replace(/\bIset\b/g, 'ISET')
    .replace(/\bEsdc\b/g, 'ESDC')
    .replace(/\bIlmp\b/g, 'ILMP')
    .replace(/\bNwac\b/g, 'NWAC')
    .replace(/\bArms\b/g, 'ARMS');

const prettifyRouteLabel = route => {
  const path = String(route || '').split('?')[0];
  if (!path || path === '/') return 'Home';
  const normalized = path
    .split('/')
    .filter(Boolean)
    .map(segment => segment.replace(/^:/, ''))
    .join(' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\bdashboard\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return path;
  return normalizeAcronyms(toTitleCase(normalized));
};

const getRouteMeta = route => {
  const exact = NAV_ROUTE_META[route];
  if (exact) return exact;
  const base = String(route || '').split('?')[0];
  return NAV_ROUTE_META[base] || DEFAULT_META;
};
const getRouteLabel = route => getRouteMeta(route).label || ROUTE_LABELS[route] || prettifyRouteLabel(route);

const AccessControlMatrix = () => {
  const { roleMatrix, isLoading, error, pendingRoutes, reloadRoleMatrix, refreshRoleMatrix, updateRouteRoles } = useRoleMatrix();
  const [interactionError, setInteractionError] = useState(null);

  const rows = useMemo(() => {
    if (!roleMatrix?.routes) return [];
    return Object.entries(roleMatrix.routes)
      .map(([path, allowed]) => ({
        path,
        section: getRouteMeta(path).section,
        sectionOrder: getRouteMeta(path).sectionOrder,
        routeOrder: getRouteMeta(path).routeOrder,
        name: getRouteLabel(path),
        allowed: Array.isArray(allowed) ? allowed : [],
      }))
      .sort((a, b) => {
        if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
        if (a.routeOrder !== b.routeOrder) return a.routeOrder - b.routeOrder;
        return a.name.localeCompare(b.name);
      });
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
      id: 'section',
      header: 'Navigation section',
      cell: item => item.section,
      sortingComparator: (a, b) => {
        if (a.sectionOrder !== b.sectionOrder) return a.sectionOrder - b.sectionOrder;
        return a.section.localeCompare(b.section);
      },
    },
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


