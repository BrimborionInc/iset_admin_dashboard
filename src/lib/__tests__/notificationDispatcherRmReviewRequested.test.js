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
          application_id: 73,
          intervention_id: 81,
          action_plan_id: 91,
          proposal_id: 101,
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
    expect(inserted.map(params => JSON.parse(params[11]))).toEqual([
      expect.objectContaining({
        caseId: 1,
        applicationId: 73,
        interventionId: 81,
        actionPlanId: 91,
        proposalId: 101,
        workflowType: 'application_assessment',
      }),
      expect.objectContaining({
        caseId: 1,
        applicationId: 73,
        interventionId: 81,
        actionPlanId: 91,
        proposalId: 101,
        workflowType: 'application_assessment',
      }),
    ]);
  });

  test('routes forwarded changes to an explicit dual-role RM submitter without role broadcast', async () => {
    const inserted = [];
    let explicitRecipientParams = null;
    const pool = {
      query: jest.fn(async (sql, params = []) => {
        if (sql.includes('FROM notification_setting')) {
          return [[{
            id: 601,
            event: 'rm_review_changes_forwarded',
            role: 'ISET Coordinator',
            language: 'en',
            enabled: 1,
            email_alert: 0,
            bell_alert: 1,
            template_id: null,
          }]];
        }
        if (sql.includes('FROM iset_case c')) {
          return [[{
            id: 76,
            case_number: 'ISET-76',
            case_status: 'submitted',
            assigned_to: 67787,
            assigned_staff_profile_id: 67787,
            applicant_id: 2,
            applicant_name: 'Joanna Nevers',
            application_reference: 'ISET-76',
          }]];
        }
        if (sql.includes('FROM staff_profiles sp') && sql.includes('WHERE sp.id IN')) {
          explicitRecipientParams = params;
          return [[{
            id: 67787,
            email: 'dual-role.manager@example.test',
            primary_role: 'Regional Manager',
            display_name: 'Dual Role Manager',
            preferred_language: 'en',
          }]];
        }
        if (sql.includes('FROM iset_case_watch')) return [[]];
        if (sql.includes('SELECT id FROM iset_internal_notification')) return [[]];
        if (sql.includes('INSERT INTO iset_internal_notification')) {
          inserted.push(params);
          return [{ insertId: 1 }];
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
    };

    await dispatchInternalNotifications({
      pool,
      event: {
        id: 'event-forwarded-dual-role',
        event_type: 'rm_review_changes_forwarded',
        severity: 'warning',
        case_id: 76,
        subject_type: 'case',
        subject_id: '76',
        event_data: {
          application_id: 73,
          workflow_type: 'application_assessment',
          recipient_staff_profile_id: 67787,
          note: 'Please add the requested financial claim.',
        },
        actor: {
          type: 'staff',
          staffProfileId: 67787,
          displayName: 'Dual Role Manager',
        },
      },
      logger: { warn: jest.fn(), error: jest.fn() },
    });

    expect(inserted).toHaveLength(1);
    expect(explicitRecipientParams).toEqual(['en', 67787]);
    expect(inserted[0][0]).toBe('rm_review_changes_forwarded');
    expect(inserted[0][4]).toBe('user');
    expect(inserted[0][7]).toBe(67787);
    expect(JSON.parse(inserted[0][11])).toEqual(expect.objectContaining({
      role: 'ISET Coordinator',
      applicationId: 73,
      workflowType: 'application_assessment',
    }));
    expect(pool.query.mock.calls.some(([sql]) => (
      sql.includes('FROM staff_profiles sp') && sql.includes('WHERE LOWER(REPLACE(sp.primary_role')
    ))).toBe(false);
  });
});
