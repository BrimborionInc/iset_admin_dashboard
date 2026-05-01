import React from 'react';

const ManageTemplatesWidgetHelp = () => (
  <div>
    <h2>Template Editor</h2>
    <p>
      Use this widget to draft the subject and body that PATH renders when a
      notification template is used by an event/role setting. Pick a template
      from the library, edit the English and French tabs, and save when the
      copy is ready for Notification Settings.
    </p>
    <p>
      The subject and body each have a searchable field picker for supported
      placeholders. The collapsed field reference groups the available fields by
      context: case/applicant, staff/event, NWAC review, decision, and
      links/support.
    </p>
    <p>
      Use the Preview scenario menu to test the same template against common
      event families such as NWAC approved, NWAC denied, NWAC changes requested,
      secure message, applicant submission, and generic staff alert. The preview
      shows sample values only; the real email still uses the event context sent
      by the dispatcher.
    </p>
    <p>
      Unknown-field warnings mean the template needs review because those fields
      may render as literal text. Scenario notes are advisory: the field is
      valid, but may not usually be present for the selected event family.
    </p>
    <p>
      Formatting buttons insert template markup such as <code>[b]</code>,
      <code>[ul]</code>, and <code>[link url="..."]</code>. The preview renders
      that markup as HTML, and the SES pipeline uses the same saved localized
      template payload from <code>notification_template.localized</code>.
    </p>
  </div>
);

export default ManageTemplatesWidgetHelp;
