import React from 'react';
import { SideNavigation as CloudscapeSideNavigation, Badge } from '@cloudscape-design/components';

const SideNavigation = () => {
  const navItems = [
    {
      type: 'section',
      text: 'NWAC Administrator',
      items: [
        { type: 'link', text: 'Application Assignment', href: '/case-assignment-dashboard' },
        { type: 'link', text: 'PTMA Management', href: '/ptma-management' },
      ],
    },
    {
      type: 'section',
      text: 'Regional Coordinator',
      items: [
        { type: 'link', text: 'Application Management', href: '/case-management' }, // relabeled and updated href to match Case Management
      ],
    },
    {
      type: 'section',
      text: 'Other Dashboards', // Renamed group
      items: [
        { type: 'link', text: 'Case Management', href: '/case-management' }, // Update the link and text
        { type: 'link', text: 'Reminders and Notifications', href: '/manage-notifications' }, // Correct the link and relabel
        { type: 'link', text: 'Secure Messaging', href: '/manage-messages' }, // Add the new link
        { type: 'link', text: 'Reporting and Monitoring', href: '/reporting-and-monitoring-dashboard' }, // Update the link to the new page
        { type: 'link', text: 'Intake Editor', href: '/manage-components' }, // Update the link to the new page
        { type: 'link', text: 'Manage ISET Holders', href: '/manage-organisations' }, // Add the new link
      ],
    },
    // Removed "Applicant Feedback" section
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
    { type: 'divider' },
    {
      type: 'section',
      text: 'Configuration',
      defaultExpanded: false,
      items: [
        { type: 'link', text: 'User Management', href: '/user-management-dashboard' },
        { type: 'link', text: 'Release Management', href: '/release-management-dashboard' },
        { type: 'link', text: 'Options', href: '/options-dashboard' },
        { type: 'link', text: 'Visual Settings', href: '/visual-settings' }, // Update the link
        { type: 'link', text: 'Notification Settings', href: '/notification-settings-dashboard' },
        { type: 'link', text: 'Language Settings', href: '/language-settings-dashboard' },
        { type: 'link', text: 'Configuration Settings', href: '/configuration-settings' },
        { type: 'link', text: 'Test Config Dashboard', href: '/test-config-dashboard' }, // Update the link
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
        { type: 'link', text: 'Security Settings', href: '/manage-security-options' }, // Update the link
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Support',
      defaultExpanded: false,
      items: [
        { type: 'link', text: 'Tutorials', href: '/tutorials-dashboard' },
        { type: 'link', text: 'Help and Support', href: '/help-support-dashboard' },
      ],
    },
    { type: 'divider' },
    { type: 'link', text: 'Notifications', href: '/notifications', info: <Badge color="red">23</Badge> },
    { type: 'link', text: 'Documentation', href: 'https://example.com', external: true },
  ];

  return (
    <CloudscapeSideNavigation
      header={{
        href: '/',
        text: 'Admin Console',
      }}
      items={navItems}
      //onFollow={handleNavigation}
    />
  );
};

export default SideNavigation;
