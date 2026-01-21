import React from 'react';

const HomeDashboardHelp = () => (
  <div>
    <h2>NWAC ISET homepage</h2>
    <p>
      This is the landing dashboard for day-to-day ISET work. It surfaces role-specific work queues,
      a quick metrics snapshot, recent activity, and your flagged applications so you can jump into priority files quickly.
    </p>

    <h3>What you can do here</h3>
    <ul>
      <li>Review the highest-priority queues for your role and open a file in one click.</li>
      <li>Scan a weekly/monthly/quarterly/yearly metrics snapshot for workload and funding pace.</li>
      <li>Track recent updates across applications and cases.</li>
      <li>Keep a personal list of flagged applications that need follow-up.</li>
      <li>Manage conflicts of interest, approvals, and escalations through the queue buckets.</li>
    </ul>

    <h3>Key widgets</h3>
    <ul>
      <li><strong>Work Queue</strong> - bucketed counts that reflect your role. Select a bucket to drive the queue table.</li>
      <li><strong>Work Queue Items</strong> - table view of the selected bucket with filters, flags, and direct workspace links.</li>
      <li><strong>Metrics</strong> - activity totals for this week, month, quarter, and year.</li>
      <li><strong>Recent Activity</strong> - newest assignments, status changes, and system events.</li>
      <li><strong>My Tagged Applications</strong> - cases you have flagged for follow-up; clear flags once resolved.</li>
      <li><strong>Development Tracker</strong> - internal development tasks (System Administrators only).</li>
    </ul>

    <h3>Layout tips</h3>
    <ul>
      <li>Use <em>Add widget</em> to bring back removed panels; <em>Reset layout</em> restores the default layout.</li>
      <li>Drag and resize widgets to fit your workflow. The layout saves per browser.</li>
      <li>Use the refresh icon inside a widget to pull the latest data without reloading the page.</li>
      <li>Use the flag icon in Work Queue Items to add or remove cases from your flagged list.</li>
    </ul>
  </div>
);

HomeDashboardHelp.aiContext = `You are assisting a user on the NWAC ISET homepage (route /). This dashboard is a role-based landing board that shows work queues, queue items, metrics, recent activity, and flagged applications. NWAC Administrators and Regional Managers see the consolidated Work Queue and Work Queue Items widgets plus Metrics. ISET Coordinators see the ISET-specific queue, Work Queue Items, and Metrics. System Administrators see the development tracker widget instead of Metrics.

Guide users to select a work queue bucket to populate the Work Queue Items table, use filters to find a record, and open the linked workspace. Mention Add widget and Reset layout actions, and remind them that layouts are stored per browser.
`;

export default HomeDashboardHelp;
