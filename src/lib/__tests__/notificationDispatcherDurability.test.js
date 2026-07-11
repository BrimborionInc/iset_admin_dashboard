const {
  dispatchAssignmentNotificationEmails,
} = require('../../../../shared/events/notificationDispatcher');

describe('durable event-driven email planning', () => {
  test('queues one recipient delivery instead of calling the provider during fanout', async () => {
    const deliveryInserts = [];
    const pool = {
      query: jest.fn(async (statement, params = []) => {
        const sql = String(statement).replace(/\s+/gu, ' ').trim();
        if (sql.includes('FROM notification_setting')) {
          return [[{
            id: 1,
            event: 'case_assigned',
            role: 'ISET Coordinator',
            language: 'en',
            enabled: 1,
            email_alert: 1,
            template_id: 9,
            template_name: 'Case assigned',
            template_subject: 'Case assigned',
            template_content: 'Assigned to {message_to_name}',
            template_localized: null,
          }], []];
        }
        if (sql.includes('FROM iset_case c')) {
          return [[{
            id: 7,
            case_number: 'CASE-7',
            case_status: 'active',
            assigned_staff_profile_id: 42,
            assigned_to: 42,
            applicant_name: 'Applicant',
            application_reference: 'APP-7',
          }], []];
        }
        if (sql.includes('FROM staff_profiles sp') && sql.includes('sp.id IN')) {
          return [[{
            id: 42,
            email: 'coordinator@example.ca',
            primary_role: 'ISET Coordinator',
            display_name: 'Coordinator',
            preferred_language: 'en',
          }], []];
        }
        if (sql.includes('FROM iset_case_watch')) return [[], []];
        if (sql.startsWith('INSERT INTO iset_event_delivery')) {
          deliveryInserts.push(params);
          return [{ affectedRows: 1 }, []];
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
    };

    await dispatchAssignmentNotificationEmails({
      pool,
      event: {
        id: 'event-assigned-1',
        event_type: 'case_assigned',
        source: 'admin',
        subject_type: 'case',
        subject_id: '7',
        case_id: 7,
        event_data: { assigned_staff_profile_id: 42 },
      },
      logger: { warn: jest.fn(), error: jest.fn() },
    });

    expect(deliveryInserts).toHaveLength(1);
    expect(deliveryInserts[0][0]).toBe('event-assigned-1');
    expect(deliveryInserts[0][1]).toBe('staff:42');
    expect(JSON.parse(deliveryInserts[0][3])).toEqual(expect.objectContaining({
      to: 'coordinator@example.ca',
      subject: 'Case assigned',
    }));
  });
});
