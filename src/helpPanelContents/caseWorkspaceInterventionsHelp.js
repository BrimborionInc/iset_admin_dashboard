import React from "react";

const CaseWorkspaceInterventionsHelp = () => (
  <div>
    <p>
      Interventions are the actual services, training, or activities the client is participating in.
      Keep them current so the case record, reminders, and reporting all reflect what is really
      happening.
    </p>

    <h3>When updating interventions</h3>
    <ul>
      <li>Keep start and end dates aligned to the client&apos;s real schedule because those dates drive reminders and milestone tracking.</li>
      <li>Record the intervention type, description, and outcome clearly so another staff member can understand what support was provided.</li>
      <li>Assign the correct budget or funding context so finance and casework stay aligned.</li>
      <li>Use notes for delivery details, barriers, employer or training-provider context, and follow-up actions the team should remember.</li>
    </ul>

    <h3>Quality checks</h3>
    <ul>
      <li>Resolve validation warnings promptly because they often mean missing reporting data or inconsistent dates.</li>
      <li>If an intervention is paused, cancelled, or changed, update the status so dashboards and reminders stay accurate.</li>
      <li>Multiple interventions may be appropriate when they support the client&apos;s employment goal, but each one should still be justified and tracked clearly.</li>
      <li>For employer-based interventions such as wage subsidy, make sure required employer information is in the file before treating the intervention as ready to move forward.</li>
      <li>Review completed interventions before closing the related action plan, and make sure any required post-intervention follow-up, including the 12-week follow-up where applicable, is recorded before closing the case.</li>
    </ul>

    <h3>Approval-letter follow-up</h3>
    <ul>
      <li>For an approved new intervention proposal, use <strong>Actions &gt; Prepare approval letters</strong> on the intervention row.</li>
      <li>For an approved revision, use <strong>Prepare funding revision letter</strong> and send the client funding revision letter from the same follow-up area.</li>
      <li>PATH opens the intervention follow-up on <strong>Approval letters</strong>. Select <strong>Generate drafts</strong>, review or edit the <strong>Client letter</strong> and any institution, loan-provider, or other-funder letter tabs, then use <strong>Send client approval letter</strong>.</li>
      <li>Institution, loan-provider, and other-funder letters are reviewed or downloaded for manual handling; PATH does not automatically send those supporting letters.</li>
      <li>This follow-up is for approved new intervention proposals and approved revisions. Historical/backloaded approved interventions do not unlock the letter follow-up just because their status is approved.</li>
    </ul>

    <h3>Imported client-file backloads</h3>
    <ul>
      <li>Use <strong>Case header &gt; Add existing intervention</strong> when the service already existed before PATH go-live or belongs to an imported/application-less file.</li>
      <li>Attach the historical intervention to the real action plan. Archived plans cannot receive backloaded interventions, closed plans only accept completed or cancelled interventions, and in-progress or suspended interventions require an active plan.</li>
      <li>Completed or cancelled historical interventions need the real end date and outcome.</li>
      <li><strong>Actual amount</strong> and payment lines entered during backload are historical only. They do not create live payment packets, finance submissions, or applicant notifications.</li>
    </ul>
  </div>
);

CaseWorkspaceInterventionsHelp.aiContext = `You are helping with the Interventions widget on the Case Workspace. Explain interventions as the actual client activities or supports being delivered. Emphasize accurate dates, status, outcome details, and clear linkage to the client's employment goal. Mention that multiple interventions can exist when justified, and remind the user to keep employer or provider requirements and other supporting details documented in the file. When the intervention ends, remind the user to capture the outcome and complete any required post-intervention follow-up, including the 12-week follow-up where applicable, before the case is closed. For approved new intervention proposal approval-letter follow-up, direct staff to the Interventions row action \`Prepare approval letters\`, then the \`Approval letters\` step where they click \`Generate drafts\`, review/edit the Client letter and supporting letter tabs, and use \`Send client approval letter\`; institution, loan-provider, and other-funder letters are reviewed/downloaded for manual handling rather than auto-sent. If the question is about imported or application-less cases, explain that historical interventions should be entered from \`Case header > Add existing intervention\`, that archived plans are blocked, closed plans only accept completed/cancelled interventions, in-progress or suspended interventions require an active plan, and that backloaded actual amounts or payment lines are historical only rather than live payment workflow.`;

export default CaseWorkspaceInterventionsHelp;
