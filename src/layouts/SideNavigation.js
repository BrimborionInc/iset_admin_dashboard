import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { SideNavigation as CloudscapeSideNavigation, Badge } from '@cloudscape-design/components';
import { isIamOn, hasValidSession, getIdTokenClaims, getRoleFromClaims } from '../auth/cognito';
import { useRoleMatrix, toCanonicalRole } from '../context/RoleMatrixContext';

const defaultFooterItems = [
  { type: 'divider' },
  { type: 'link', text: 'Documentation', href: 'https://example.com', external: true },
];

const SideNavigation = ({ currentRole, notificationCount = 0 }) => {
  const pruneSections = (items = []) =>
    items.filter(item => {
      if (!item) return false;
      if (item.type !== 'section') return true;
      const childItems = Array.isArray(item.items) ? item.items.filter(Boolean) : [];
      return childItems.length > 0;
    });

  const history = useHistory();
  const { roleMatrix } = useRoleMatrix();
  const [tick, setTick] = useState(0);
  const [expandedSections, setExpandedSections] = useState(() => {
    try {
      const raw = sessionStorage.getItem('sideNavExpanded');
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    const onChange = () => setTick(t => t + 1);
    window.addEventListener('auth:session-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('auth:session-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem('sideNavExpanded', JSON.stringify(Array.from(expandedSections))); } catch {}
  }, [expandedSections]);

  const iamOn = isIamOn();
  const simSignedOut = (() => { try { return sessionStorage.getItem('simulateSignedOut') === 'true'; } catch { return false; } })();
  const signedIn = hasValidSession();
  const tokenRole = getRoleFromClaims(getIdTokenClaims());
  const effectiveRole = (iamOn && signedIn && tokenRole) ? { value: tokenRole } : currentRole;

  const allNavItems = [
    {
      type: 'section',
      text: 'ISET Administration',
      items: [
        { type: 'link', text: 'Application Assignment', href: '/case-assignment-dashboard?view=assignment' },
        { type: 'link', text: 'NWAC Hub Management', href: '/nwac-hub-management' },
        { type: 'link', text: 'PTMA Management', href: '/ptma-management' },
        { type: 'link', text: 'ARMS Reporting', href: '/arms-reporting' },
        { type: 'link', text: 'Assessment Review', href: '/assessment-review' },
      ],
    },
    {
      type: 'section',
      text: 'ISET Assessment',
      items: [
        { type: 'link', text: 'Manage Applications', href: '/case-assignment-dashboard' },
        { type: 'link', text: 'My Case Queue', href: '/case-management' },
      ],
    },
    {
      type: 'section',
      text: 'Other Dashboards',
      items: [
        { type: 'link', text: 'Secure Messaging', href: '/manage-messages' },
        { type: 'link', text: 'Reporting and Monitoring', href: '/reporting-and-monitoring-dashboard' },
      ],
    },
    {
      type: 'section',
      text: 'Intake Workflow Studio',
      items: [
        { type: 'link', text: 'Manage Intake Steps', href: '/manage-components' },
        { type: 'link', text: 'Manage Workflows', href: '/manage-workflows' },
      ],
    },
    {
      type: 'section',
      text: 'Analytics Dashboard',
      defaultExpanded: false,
      items: [
        { type: 'link', text: 'Service Levels', href: '/service-levels-dashboard' },
        { type: 'link', text: 'Capacity Planning', href: '/capacity-planning-dashboard' },
        { type: 'link', text: 'Reporting', href: '/reporting-dashboard' },
        { type: 'link', text: 'System Performance', href: '/system-performance-dashboard' },
        { type: 'link', text: 'Custom Dashboards', href: '/custom-dashboards-dashboard' },
      ],
    },
    {
      type: 'section',
      text: 'Configuration',
      defaultExpanded: false,
      items: [
        { type: 'link', text: 'User Management', href: '/user-management-dashboard' },
        { type: 'link', text: 'Release Management', href: '/release-management-dashboard' },
        { type: 'link', text: 'Notification Settings', href: '/manage-notifications' },
        { type: 'link', text: 'Language Settings', href: '/language-settings-dashboard' },
        { type: 'link', text: 'Event Logging', href: '/configuration/events' },
        { type: 'link', text: 'Configuration Settings', href: '/configuration-settings' },
        { type: 'link', text: 'File Upload Config', href: '/admin/upload-config' },
      ],
    },
    {
      type: 'section',
      text: 'Security',
      defaultExpanded: false,
      items: [
        { type: 'link', text: 'Audit and Logs', href: '/audit-logs-dashboard' },
        { type: 'link', text: 'Security Settings', href: '/manage-security-options' },
        { type: 'link', text: 'Access Control', href: '/access-control' },
      ],
    },
    {
      type: 'section',
      text: 'Support',
      defaultExpanded: false,
      items: [
        { type: 'link', text: 'Tutorials', href: '/tutorials-dashboard' },
        { type: 'link', text: 'Help and Support', href: '/help-support-dashboard' },
      ],
    },
  ];

  const notificationsFooterItem = notificationCount > 0
    ? {
        type: 'link',
        text: 'Notifications',
        href: '/manage-notifications',
        info: <Badge color="red">{notificationCount}</Badge>,
      }
    : {
        type: 'link',
        text: 'Notifications',
        href: '/manage-notifications',
      };

  function isAllowed(href, roleValue) {
    if (!href) return true;
    const allowed = roleMatrix?.routes?.[href];
    const canonicalRole = toCanonicalRole(roleValue);
    if (allowed) return allowed.includes(canonicalRole);
    if (roleMatrix?.default === 'deny') return false;
    return true;
  }

  function filterNavItemsForRole(role, signedOut) {
    if (signedOut) {
      return [...defaultFooterItems];
    }

    const roleValue = role?.value || role;
    const canonicalRole = toCanonicalRole(roleValue);

    const filteredSections = allNavItems.map(section => {
      if (!section.items) return section;
      return {
        ...section,
        items: section.items.filter(item => isAllowed(item.href, canonicalRole)),
      };
    });

    const footerItems = [...defaultFooterItems];
    if (isAllowed('/manage-notifications', canonicalRole)) {
      const dividerIndex = footerItems.findIndex(item => item?.type === 'divider');
      const insertAt = dividerIndex >= 0 ? dividerIndex + 1 : 0;
      footerItems.splice(insertAt, 0, notificationsFooterItem);
    }

    return [...pruneSections(filteredSections), ...footerItems];
  }

  const filteredNavItems = filterNavItemsForRole(effectiveRole, (iamOn && !signedIn) || (!iamOn && simSignedOut));

  const itemsWithExpandState = useMemo(() => {
    const apply = (items) => items.map(item => {
      if (item?.type === 'section') {
        const key = item.text || item.href || JSON.stringify(item);
        return {
          ...item,
          defaultExpanded: expandedSections.has(key),
          items: item.items ? apply(item.items) : item.items,
        };
      }
      return item;
    });
    return apply(filteredNavItems);
  }, [filteredNavItems, expandedSections]);

  return (
    <CloudscapeSideNavigation
      header={{
        href: '/',
        text: 'ISET Admin',
      }}
      items={itemsWithExpandState}
      onChange={(e) => {
        const detail = e?.detail;
        const item = detail?.item;
        if (item?.type === 'section') {
          const key = item.text || item.href || JSON.stringify(item);
          setExpandedSections(prev => {
            const next = new Set(prev);
            if (detail?.expanded) next.add(key); else next.delete(key);
            return next;
          });
        }
      }}
      onFollow={(e) => {
        if (e.detail && e.detail.href && !e.detail.external) {
          e.preventDefault();
          history.push(e.detail.href);
        }
      }}
    />
  );
};

export default SideNavigation;
