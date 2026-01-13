import React from "react";

const ContactCommunicationsHelp = () => (
  <div>
    <p>
      Use this dashboard to triage questions and support requests submitted from the public ISET portal.
    </p>

    <h3>Purpose</h3>
    <p>
      Provide NWAC Administrators with a consolidated view of new and in-progress contact messages, including the
      applicant context and a quick way to update status as triage progresses.
    </p>

    <h3>Key workflows</h3>
    <ul>
      <li>Review the queue of new messages and switch status as replies are drafted or completed.</li>
      <li>Track response progress and resolution outcomes to ensure applicants receive timely support.</li>
      <li>Capture recurring inquiries so knowledge base and portal copy can be updated.</li>
    </ul>

    <h3>Data sources</h3>
    <ul>
      <li>
        Records originate from the public portal&apos;s <code>/api/contact</code> endpoint and reside in the{" "}
        <code>contact_message</code> table.
      </li>
      <li>
        Staff updates sync back to the admin API, emitting <code>contact_message.updated</code> events for audit and notifications.
      </li>
    </ul>

    <h3>Next steps toward production</h3>
    <ul>
      <li>Hook widgets into live data services and enforce RBAC for message actions.</li>
      <li>Connect acknowledgement templates once the auto-reply decision in CR-0005 is finalised.</li>
      <li>Capture analytics on response time to support future SLA reporting.</li>
    </ul>
  </div>
);

ContactCommunicationsHelp.aiContext =
  "Describe the Contact Communications dashboard that surfaces contact_message records from the public portal, shows queue status, and helps NWAC Administrators triage applicant enquiries.";

export default ContactCommunicationsHelp;
