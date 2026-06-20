const {
  dispatchInternalNotifications,
  formatNotificationContent,
} = require('../../../../shared/events/notificationDispatcher');

describe('RM review requested notifications', () => {
  test('formats Pending Review arrival copy for Regional Managers', () => {
    const content = formatNotificationContent(
      {
        event_type: 'rm_review_requested',
        event_data: {
          workflow_type: 'application_assessment',
        },
        actor: {
          type: 'staff',
          staffProfileId: 752,
          displayName: 'quebec.coordinator.1@awentech.ca',
        },
      },
      {
        applicant_name: 'Jacqueline Sillery',
      }
    );

    expect(content).toEqual({
      title: 'Pending Review',
      message: "quebec.coordinator.1@awentech.ca submitted Jacqueline Sillery's assessment for Regional Manager review.",
      severity: 'info',
    });
  });

  test('sends bell alerts to Regional Managers in the case review region', async () => {
    const inserted = [];
    let staffRegionParams = null;
    const pool = {
      query: jest.fn(async (sql, params = []) => {
        if (sql.includes('FROM notification_setting')) {
          return [[{
            id: 501,
            event: 'rm_review_requested',
            role: 'Regional Manager',
            language: 'en',
            enabled: 1,
            email_alert: 0,
            bell_alert: 1,
            template_id: null,
          }]];
        }

        if (sql.includes('FROM iset_case c')) {
          return [[{
            id: 1,
            case_number: 'ISET-20260620-C69321',
            case_status: 'submitted',
            application_id: 1,
            assigned_to: 752,
            assigned_staff_profile_id: 752,
            portfolio_region_id: null,
            owner_region_id: 11,
            review_region_id: 11,
            applicant_id: 2,
            applicant_name: 'Jacqueline Sillery',
            application_reference: 'ISET-20260620-C69321',
          }]];
        }

        if (sql.includes('FROM staff_profiles sp') && sql.includes('LEFT JOIN staff_region sr')) {
          staffRegionParams = params;
          return [[
            {
              id: 968,
              email: 'quebec.manager@awentech.ca',
              primary_role: 'Regional Manager',
              display_name: 'quebec.manager@awentech.ca',
            },
            {
              id: 4011,
              email: 'emarion@nwac.ca',
              primary_role: 'Regional Manager',
              display_name: 'Eve Marion',
            },
          ]];
        }

        if (sql.includes('SELECT id FROM iset_internal_notification')) {
          return [[]];
        }

        if (sql.includes('INSERT INTO iset_internal_notification')) {
          inserted.push(params);
          return [{ insertId: inserted.length }];
        }

        throw new Error(`Unexpected query: ${sql}`);
      }),
    };

    await dispatchInternalNotifications({
      pool,
      event: {
        id: 'event-1',
        event_type: 'rm_review_requested',
        severity: 'info',
        case_id: 1,
        subject_type: 'case',
        subject_id: '1',
        event_data: {
          workflow_type: 'application_assessment',
          review_stage: 'rm_review',
          tracking_id: 'ISET-20260620-C69321',
        },
        actor: {
          type: 'staff',
          staffProfileId: 752,
          displayName: 'quebec.coordinator.1@awentech.ca',
        },
      },
      logger: { warn: jest.fn(), error: jest.fn() },
    });

    expect(inserted).toHaveLength(2);
    expect(staffRegionParams).toEqual([11, 11]);
    expect(inserted.map(params => params[7])).toEqual([968, 4011]);
    expect(inserted.every(params => params[0] === 'rm_review_requested')).toBe(true);
    expect(inserted.every(params => params[2] === 'Pending Review')).toBe(true);
  });
});
