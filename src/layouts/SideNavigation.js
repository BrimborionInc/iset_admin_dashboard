import React from 'react';
import { SideNavigation as CloudscapeSideNavigation, Badge } from '@cloudscape-design/components';

const commonFooterItems = [
  { type: 'divider' },
  { type: 'link', text: 'Notifications', href: '/notifications', info: <Badge color="red">23</Badge> },
  { type: 'link', text: 'Documentation', href: 'https://example.com', external: true },
];

const SideNavigation = ({ currentRole }) => {
  const navItems = [
    {
      type: 'section',
      text: 'ISET Administration',
      items: [
        { type: 'link', text: 'Application Assignment', href: '/case-assignment-dashboard' },
                { type: 'link', text: 'NWAC Hub Management', href: '/nwac-hub-management' }, // Placeholder link
        { type: 'link', text: 'PTMA Management', href: '/ptma-management' },

        // Only show Notification Settings for System Administrator
        ...(currentRole?.value === 'System Administrator' ? [{ type: 'link', text: 'Notification Settings', href: '/manage-notifications' }] : []),
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
  { type: 'link', text: 'Intake Editor', href: '/manage-components' },
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
        { type: 'link', text: 'Options', href: '/options-dashboard' },
        { type: 'link', text: 'Visual Settings', href: '/visual-settings' },
        // Only show Notification Settings for System Administrator
        ...(currentRole?.value === 'System Administrator' ? [{ type: 'link', text: 'Notification Settings', href: '/notification-settings-dashboard' }] : []),
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

  function filterNavItemsForRole(role) {
    const roleValue = role?.value || role;
    if (roleValue === 'System Administrator') return [...navItems, ...commonFooterItems];
    if (roleValue === 'Program Administrator') {
      const filteredSections = navItems.map(section => {
        if (section.type === 'section' && section.text === 'ISET Administration') {
          const newItems = section.items.filter(item => item.text !== 'ARMS Integration');
          // Do not push another Assessment Review link here
          return { ...section, items: newItems };
        }
        if (section.type === 'section' && section.text === 'Other Dashboards') {
          return {
            ...section,
            items: section.items.filter(item =>
              item.text !== 'Intake Editor' && item.text !== 'Reminders and Notifications'
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
      return [...filteredSections, ...commonFooterItems];
    }
    if (roleValue === 'Regional Coordinator') {
      const filteredSections = navItems.map(section => {
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
      return [...filteredSections, ...commonFooterItems];
    }
    if (roleValue === 'PTMA Staff') {
      const filteredSections = navItems
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
        .filter(Boolean);
      return [...filteredSections, ...commonFooterItems];
    }
    return [];
  }

  const filteredNavItems = filterNavItemsForRole(currentRole);

  return (
    <CloudscapeSideNavigation
      header={{
        href: '/',
        text: 'Admin Console',
      }}
      items={filteredNavItems}
      //onFollow={handleNavigation}
    />
  );
};

export default SideNavigation;
