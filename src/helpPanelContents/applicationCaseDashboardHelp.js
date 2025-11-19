import React from 'react';

const ApplicationCaseDashboardHelp = () => (
  <div>
    <h2>ISET Application Assessment dashboard</h2>
    <p>
      This board is the in-depth workspace for a single application. It lets you review the dossier, capture corrections,
      complete the coordinator assessment, manage documents, coordinate with applicants, and track activity over time.
    </p>

    <h3>Current widgets</h3>
    <ul>
      <li><strong>Application Overview</strong> – case summary with status, reference numbers, owner, and quick actions.</li>
      <li><strong>ISET Application Form</strong> – submitted application with edit mode and version history where permitted.</li>
      <li><strong>Application Assessment</strong> – coordinator assessment workflow, declarations, and status progression.</li>
      <li><strong>Supporting Documents</strong> – document list with refresh/search and source filters.</li>
      <li><strong>Secure Messaging</strong> – inbox/sent/deleted threads with compose and attachments.</li>
      <li><strong>Notes and Tasks</strong> – case notes plus lightweight task tracking.</li>
      <li><strong>Case Calendar</strong> – calendar and list views for reminders and deadlines tied to the case.</li>
      <li><strong>Events Timeline</strong> – chronological log of submissions, status changes, and related case events.</li>
    </ul>

    <h3>Typical review flow</h3>
    <ol>
      <li>Start with <em>Application Overview</em> to confirm the case owner, status, and any outstanding alerts.</li>
      <li>Open the <em>ISET Application Form</em> to verify the data provided during intake and capture corrections if
        needed (toggle edit mode to publish updates).</li>
      <li>Work through the <em>Application Assessment</em> widget, ensuring all required sections are completed before
        submitting for NWAC review.</li>
      <li>Attach or review <em>Supporting Documents</em> to confirm eligibility evidence.</li>
      <li>Use <em>Secure Messaging</em> to request clarifications from the applicant or <em>Notes and Tasks</em> to log
        internal context.</li>
      <li>After finalising the outcome notice, monitor downstream automations in the <em>Application Events</em> log.</li>
    </ol>

    <h3>Tips</h3>
    <ul>
      <li>The board layout is flexible: drag to reorder, resize, or remove widgets; use the widget palette to add them back, and use reset to return to the default. Layout choices are saved per browser.</li>
      <li>Reloading the page pulls fresh case data; unsaved edits inside a widget (e.g., an in-progress form) are not preserved.</li>
      <li>Each widget provides its own Info link with deeper guidance when you need process-specific help.</li>
      <li>Honor compliance timelines from the ISET training module: contact new applicants within five days and make up to
        three attempts if documentation is missing before closing for non-response.</li>
      <li>Use <em>Supporting Documents</em> to verify mandatory items (Status/Treaty or Nation letters, self-declaration, ID,
        acceptance letter, statement of fees, band/treaty denial where applicable) before recommending funding.</li>
      <li>Pending applications stay pending until all docs, a case manager recommendation, NWAC approval, and the signed
        Funding Agreement are in place; track this in <em>Application Overview</em> and case notes.</li>
    </ul>
  </div>
);

ApplicationCaseDashboardHelp.aiContext = `You are assisting an NWAC case coordinator while they work in the "ISET Application Assessment" dashboard. The board contains widgets for Application Overview (case summary), ISET Application Form (editable intake submission), Application Assessment (decision workflow), Supporting Documents, Secure Messaging, Notes and Tasks, Case Calendar, and Events Timeline.

When the coordinator needs to correct applicant data, direct them to open the ISET Application Form widget, press **Edit**, confirm the modal, adjust the required fields, then choose **Save**. Saving creates a new version that can be reviewed under **View versions**; the original submission stays available. Editing is disabled once the case status is Approved or Rejected.

Remind them to document any coordinator-made edits in Case Notes and, when the applicant must be notified, send a Secure Message from the same workspace. After updates, they can refresh Application Overview or Application Events to confirm the change propagated.

Bring in ISET program rules from the training module:
- Compliance timelines: contact new applicants within five days; make up to three attempts for missing information before closure.
- Evidence expectations: Status/Treaty card or two Nation letters plus self-declaration; two pieces of ID; official acceptance letter and fee statement; band/treaty funding denial (if applicable); monthly budget, income and expense proofs for living allowance; attendance reports monthly.
- Pending definition: an application remains pending until docs are complete, the case manager recommendation is recorded, NWAC provides a decision, and the Funding Agreement is signed.
- Processing expectations: triage quickly and note the three-week review window once all documentation is received; use Case Notes to log outreach attempts and documentation gaps to keep ARMS/audit trail complete.
- All applications (funded or not) must be recorded; avoid untracked closures and keep status reasons explicit.`;

export default ApplicationCaseDashboardHelp;
