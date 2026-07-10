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

  test('conflict resolution notifications use applicant names and include reviewer notes', () => {
    const content = formatNotificationContent(
      {
        event_type: 'conflict_declaration_resolved',
        event_data: {
          applicant_name: 'ISET-20260709-ABC123',
          resolution_note: 'Relationship reviewed; coordinator may continue.',
          resolved_by_name: 'Shelley Stacey',
        },
        actor: {
          type: 'staff',
          staffProfileId: 12,
          displayName: 'Shelley Stacey',
        },
      },
      {
        client_first_name: 'Avery',
        client_last_name: 'Martin',
      }
    );

    expect(content).toEqual({
      title: 'Conflict declaration resolved',
      message: 'Shelley Stacey reviewed a declared conflict for Avery Martin and cleared the staff member to continue. Note: Relationship reviewed; coordinator may continue.',
      severity: 'success',
    });
    expect(content.message).not.toContain('ISET-20260709-ABC123');
  });

  test('conflict reassignment notifications use applicant names, new assignee, and reviewer notes', () => {
    const content = formatNotificationContent(
      {
        event_type: 'conflict_declaration_reassigned',
        event_data: {
          applicant_name: 'ISET-20260709-XYZ789',
          reassigned_to_name: 'Amanda Curtis',
          resolution_note: 'Moving this file to avoid the disclosed relationship.',
          resolved_by_name: 'Shelley Stacey',
        },
      },
      {
        submission_first_name: 'Jamie',
        submission_last_name: 'River',
      }
    );

    expect(content).toEqual({
      title: 'Conflict declaration reassigned',
      message: 'Shelley Stacey reassigned the file for Jamie River after reviewing a declared conflict. New assignee: Amanda Curtis. Note: Moving this file to avoid the disclosed relationship.',
      severity: 'info',
    });
    expect(content.message).not.toContain('ISET-20260709-XYZ789');
  });
});
