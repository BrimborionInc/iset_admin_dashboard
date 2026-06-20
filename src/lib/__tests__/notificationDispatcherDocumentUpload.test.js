const {
  formatNotificationContent,
} = require('../../../../shared/events/notificationDispatcher');

describe('document upload notification content', () => {
  test('names the staff uploader when staff upload a document for an applicant', () => {
    const content = formatNotificationContent(
      {
        event_type: 'document_uploaded',
        event_data: {
          file_name: 'EI Verification.png',
          document_type: 'ei_verification',
        },
        actor: {
          type: 'staff',
          staffProfileId: 968,
          displayName: 'quebec.manager@awentech.ca',
        },
      },
      {
        applicant_name: 'Jacqueline Sillery',
      }
    );

    expect(content).toMatchObject({
      title: 'Document uploaded',
      message: 'quebec.manager@awentech.ca uploaded EI Verification.png for Jacqueline Sillery.',
      severity: 'success',
    });
  });

  test('keeps applicant-upload wording for applicant-originated uploads', () => {
    const content = formatNotificationContent(
      {
        event_type: 'document_uploaded',
        event_data: {
          file_name: 'Client EI consent - Jacqueline Sillery.pdf',
        },
        actor: {
          type: 'applicant',
          applicantUserId: 2,
          displayName: 'Jacqueline Sillery',
        },
      },
      {
        applicant_name: 'Jacqueline Sillery',
      }
    );

    expect(content.message).toBe('Jacqueline Sillery uploaded Client EI consent - Jacqueline Sillery.pdf.');
  });
});
