import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { SideNavigation as CloudscapeSideNavigation, Badge } from '@cloudscape-design/components';
import { isIamOn, hasValidSession, getIdTokenClaims, getRoleFromClaims } from '../auth/cognito';
import { useRoleMatrix, toCanonicalRole } from '../context/RoleMatrixContext';

const commonFooterItems = [
  { type: 'divider' },
  { type: 'link', text: 'Documentation', href: 'https://example.com', external: true },
];

const SideNavigation = ({ currentRole }) => {
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
  // Compute role context early so it can be used inside nav item construction
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
        // Ensure unique hrefs across navigation; add query param but route still matches
        { type: 'link', text: 'Application Assignment', href: '/case-assignment-dashboard?view=assignment' },
                { type: 'link', text: 'NWAC Hub Management', href: '/nwac-hub-management' }, // Placeholder link
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
  // Removed duplicate href '/case-management' (already present as My Case Queue above)
        { type: 'link', text: 'Reminders and Notifications', href: '/manage-notifications' },
        { type: 'link', text: 'Secure Messaging', href: '/manage-messages' },
        { type: 'link', text: 'Reporting and Monitoring', href: '/reporting-and-monitoring-dashboard' },
        // Authoring links moved to dedicated 'Intake Form Editor' section
      ],
    },
    // Dedicated section for intake form editing / workflow authoring
    {
      type: 'section',
      text: 'Intake Form Editor',
      items: [
        { type: 'link', text: 'Manage Intake Steps', href: '/manage-components' },
        { type: 'link', text: 'Manage Workflows', href: '/manage-workflows' },
      ]
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
        { type: 'link', text: 'Notification Settings', href: '/notification-settings-dashboard' },
        { type: 'link', text: 'Language Settings', href: '/language-settings-dashboard' },
        { type: 'link', text: 'Configuration Settings', href: '/configuration-settings' },
        { type: 'link', text: 'File Upload Config', href: '/admin/upload-config' },
  // Removed duplicate href '/manage-components' (already present under Other Dashboards)
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
      // Signed out: no navigation sections, minimal footer (documentation link only)
      return [...commonFooterItems];
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
    return [...pruneSections(filteredSections), ...commonFooterItems];
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
        // Intercept to use SPA navigation and avoid full reloads
        if (e.detail && e.detail.href && !e.detail.external) {
          e.preventDefault();
          history.push(e.detail.href);
        }
      }}
    />
  );
};

export default SideNavigation;
