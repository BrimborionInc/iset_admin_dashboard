import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { SideNavigation as CloudscapeSideNavigation, Badge } from '@cloudscape-design/components';
import { isIamOn, hasValidSession, getIdTokenClaims, getRoleFromClaims } from '../auth/cognito';
import roleMatrix from '../config/roleMatrix.json';

const commonFooterItems = [
  { type: 'divider' },
  { type: 'link', text: 'Notifications', href: '/notifications', info: <Badge color="red">23</Badge> },
  { type: 'link', text: 'Documentation', href: 'https://example.com', external: true },
];

const SideNavigation = ({ currentRole }) => {
  const history = useHistory();
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
  const allNavItems = [
    {
      type: 'section',
      text: 'ISET Administration',
      items: [
        { type: 'link', text: 'Application Assignment', href: '/case-assignment-dashboard' },
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
        { type: 'link', text: 'Application Assessment', href: '/case-management' },
      ],
    },
    {
      type: 'section',
      text: 'Other Dashboards',
      items: [
  // Removed duplicate href '/case-management' (already present as Application Assessment above)
        { type: 'link', text: 'Reminders and Notifications', href: '/manage-notifications' },
        { type: 'link', text: 'Secure Messaging', href: '/manage-messages' },
        { type: 'link', text: 'Reporting and Monitoring', href: '/reporting-and-monitoring-dashboard' },
        // Only System Administrators can see authoring/flow management links
        ...(currentRole?.value === 'System Administrator'
          ? [
              { type: 'link', text: 'Manage Intake Steps', href: '/manage-components' },
              { type: 'link', text: 'Manage Workflows', href: '/manage-workflows' },
            ]
          : []),
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
        { type: 'link', text: 'Options', href: '/options-dashboard' },
        { type: 'link', text: 'Visual Settings', href: '/visual-settings' },
  { type: 'link', text: 'Notification Settings', href: '/notification-settings-dashboard' },
        { type: 'link', text: 'Language Settings', href: '/language-settings-dashboard' },
        { type: 'link', text: 'Configuration Settings', href: '/configuration-settings' },
        { type: 'link', text: 'Test Config Dashboard', href: '/test-config-dashboard' },
  // Removed duplicate href '/manage-components' (already present under Other Dashboards)
      ],
    },
    {
      type: 'section',
      text: 'Security',
      defaultExpanded: false,
      items: [
        { type: 'link', text: 'Options', href: '/security-options-dashboard' },
        { type: 'link', text: 'Visual Settings', href: '/security-visual-settings-dashboard' },
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
    if (allowed) return allowed.includes(roleValue);
    if (roleMatrix?.default === 'deny') return false;
    return true;
  }

  function filterNavItemsForRole(role, signedOut) {
    if (signedOut) {
      const support = allNavItems.find(s => s.type === 'section' && s.text === 'Support');
      return [support, ...commonFooterItems].filter(Boolean);
    }
    const roleValue = role?.value || role;
    if (roleValue === 'System Administrator') return [...allNavItems, ...commonFooterItems];
    if (roleValue === 'Program Administrator') {
  let filteredSections = allNavItems.map(section => {
        if (section.type === 'section' && section.text === 'ISET Administration') {
          const newItems = section.items.filter(item => item.text !== 'ARMS Integration' && item.text !== 'Notification Settings');
          // Do not push another Assessment Review link here
          return { ...section, items: newItems };
        }
        if (section.type === 'section' && section.text === 'Other Dashboards') {
          return {
            ...section,
            items: section.items.filter(item =>
              item.text !== 'Manage Intake Steps' &&
              item.text !== 'Manage Workflows' &&
              item.text !== 'Reminders and Notifications'
            ),
          };
        }
        if (section.type === 'section' && section.text === 'Configuration') {
          return {
            ...section,
            items: section.items.filter(item =>
              item.text === 'Options' || item.text === 'Visual Settings'
            ),
          };
        }
        return section;
      });
      filteredSections = filteredSections.map(section => ({
        ...section,
        items: section.items?.filter(item => isAllowed(item.href, roleValue))
      }));
      return [...filteredSections, ...commonFooterItems];
    }
    if (roleValue === 'Regional Coordinator') {
      let filteredSections = allNavItems.map(section => {
        if (section.type === 'section' && section.text === 'ISET Administration') {
          return {
            ...section,
            items: section.items.filter(item =>
              item.text === 'Application Assignment' || item.text === 'PTMA Management'
            ),
          };
        }
        if (section.type === 'section' && section.text === 'ISET Assessment') {
          return section;
        }
        if (section.type === 'section' && section.text === 'Other Dashboards') {
          return {
            ...section,
            items: section.items.filter(item =>
              item.text === 'Secure Messaging' || item.text === 'Reporting and Monitoring'
            ),
          };
        }
        if (section.type === 'section' && section.text === 'Configuration') {
          return {
            ...section,
            items: section.items.filter(item =>
              item.text === 'User Management' || item.text === 'Options' || item.text === 'Visual Settings'
            ),
          };
        }
        return section;
      });
      filteredSections = filteredSections.map(section => ({
        ...section,
        items: section.items?.filter(item => isAllowed(item.href, roleValue))
      }));
      return [...filteredSections, ...commonFooterItems];
    }
    if (roleValue === 'PTMA Staff') {
      const filteredSections = allNavItems
        .map(section => {
          if (section.type === 'section' && section.text === 'ISET Assessment') {
            return {
              ...section,
              items: section.items.filter(item => item.text === 'Application Assessment'),
            };
          }
          if (section.type === 'section' && section.text === 'Other Dashboards') {
            return {
              ...section,
              items: section.items.filter(item => item.text === 'Secure Messaging'),
            };
          }
          if (section.type === 'section' && section.text === 'Support') {
            return section;
          }
          return null;
        })
        .filter(Boolean)
        .map(section => ({
          ...section,
          items: section.items?.filter(item => isAllowed(item.href, roleValue))
        }));
      return [...filteredSections, ...commonFooterItems];
    }
    // Default: show all items for unknown role
    // Additionally enforce deny-by-default against roleMatrix for non-SA roles
    const filteredSections = allNavItems.map(section => {
      if (!section.items) return section;
      return {
        ...section,
        items: section.items.filter(item => isAllowed(item.href, roleValue))
      };
    });
    return [...filteredSections, ...commonFooterItems];
  }

  const iamOn = isIamOn();
  const simSignedOut = (() => { try { return sessionStorage.getItem('simulateSignedOut') === 'true'; } catch { return false; } })();
  const signedIn = hasValidSession();
  const tokenRole = getRoleFromClaims(getIdTokenClaims());
  const effectiveRole = (iamOn && signedIn && tokenRole) ? { value: tokenRole } : currentRole;
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
