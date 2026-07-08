const {
  formatNotificationContent,
} = require('../../../../shared/events/notificationDispatcher');

describe('applicant names in notification content', () => {
  test('prefers client/submission first-last names over email-shaped applicant payloads', () => {
    const content = formatNotificationContent(
      {
        event_type: 'rm_review_submitted_to_nwac',
        event_data: {
          workflow_type: 'application_assessment',
          applicant_name: 'jen79g@gmail.com',
          applicant_username: 'jen79g@gmail.com',
        },
        actor: {
          type: 'staff',
          staffProfileId: 968,
          displayName: 'Nunavut Regional Manager',
        },
      },
      {
        applicant_name: 'jen79g@gmail.com',
        applicant_user_name: 'jen79g@gmail.com',
        applicant_email: 'jen79g@gmail.com',
        client_first_name: 'Jennifer',
        client_last_name: 'Glass',
        submission_first_name: 'Jenny',
        submission_last_name: 'Glass',
      }
    );

    expect(content).toEqual({
      title: 'Ready for final decision',
      message: "Regional Manager submitted Jennifer Glass' assessment for final decision.",
      severity: 'success',
    });
  });

  test('uses registered applicant email when no applicant name is available', () => {
    const content = formatNotificationContent(
      {
        event_type: 'rm_review_submitted_to_nwac',
        event_data: {
          workflow_type: 'application_assessment',
        },
        actor: {
          type: 'staff',
          staffProfileId: 968,
          displayName: 'Nunavut Regional Manager',
        },
      },
      {
        applicant_email: 'missing.name@example.test',
      }
    );

    expect(content.message).toBe(
      "Regional Manager submitted missing.name@example.test's assessment for final decision."
    );
  });

  test('secure-message notifications prefer resolved applicant name over portal display email', () => {
    const content = formatNotificationContent(
      {
        event_type: 'applicant_secure_message_received',
        event_data: {
          from_display_name: 'molly.hink@hotmail.com',
          from_email: 'molly.hink@hotmail.com',
        },
        actor: {
          type: 'applicant',
          applicantUserId: 42,
          displayName: 'molly.hink@hotmail.com',
          email: 'molly.hink@hotmail.com',
        },
      },
      {
        client_first_name: 'Molly',
        client_last_name: 'Hink',
        applicant_email: 'molly.hink@hotmail.com',
      }
    );

    expect(content.message).toBe('Molly Hink sent a secure message from the applicant portal.');
  });
});
