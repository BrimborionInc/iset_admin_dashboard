const {
  formatNotificationContent,
} = require('../../../../shared/events/notificationDispatcher');

describe('critical admin feedback notifications', () => {
  test('formats critical bug/change request alert content', () => {
    const content = formatNotificationContent(
      {
        event_type: 'admin_feedback_critical',
        event_data: {
          admin_feedback_report_id: '42',
          admin_feedback_report_type: 'change_request',
          admin_feedback_summary: 'Payment dashboard is unavailable',
          admin_feedback_reporter_name: 'Regional Manager',
        },
      },
      null
    );

    expect(content).toEqual({
      title: 'Critical bug/CR',
      message: 'Critical Change request #42: Payment dashboard is unavailable. Reporter: Regional Manager.',
      severity: 'error',
    });
  });
});
