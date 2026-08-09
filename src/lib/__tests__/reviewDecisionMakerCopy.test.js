const {
  getEventCatalog,
  getEventType,
} = require('../../../../shared/events/catalog');
const {
  formatNotificationContent,
} = require('../../../../shared/events/notificationDispatcher');
const fs = require('fs');
const path = require('path');

describe('two-step review Decision Maker copy', () => {
  test('uses Decision Maker wording in staff-facing review catalogue labels', () => {
    const assessmentCategory = getEventCatalog().find(category => category.id === 'assessment');

    expect(assessmentCategory.description).toBe(
      'Submitter, Regional Manager, and Decision Maker review milestones.'
    );
    expect(getEventType('rm_review_submitted_to_nwac').label).toBe(
      'RM submitted to Decision Maker'
    );
    expect(getEventType('nwac_review_approved').label).toBe('Decision Maker approved');
    expect(getEventType('nwac_review_denied').label).toBe('Decision Maker denied');
    expect(getEventType('nwac_review_changes_requested').label).toBe(
      'Decision Maker requested changes'
    );
  });

  test('uses Decision Maker as the fallback actor for application decisions', () => {
    expect(
      formatNotificationContent(
        {
          event_type: 'nwac_review_denied',
          event_data: {
            outcome: 'reject',
            reason: 'The request does not meet the program criteria.',
          },
        },
        { applicant_name: 'Test Applicant' }
      )
    ).toEqual({
      title: 'Application denied',
      message:
        "Decision Maker denied Test Applicant's application. Note: The request does not meet the program criteria.",
      severity: 'warning',
    });

    expect(
      formatNotificationContent({ event_type: 'nwac_review_submitted', event_data: {} }, {})
    ).toEqual({
      title: 'Decision Maker review complete',
      message: 'Decision Maker completed final decision review for the application.',
      severity: 'info',
    });
  });

  test('uses Decision Maker as the fallback actor for intervention decisions', () => {
    expect(
      formatNotificationContent(
        {
          event_type: 'intervention_revision_denied',
          event_data: {
            proposal_kind: 'revision',
            outcome: 'rejected',
            decision_notes: 'The revised costs need more support.',
          },
        },
        { applicant_name: 'Test Applicant' }
      )
    ).toEqual({
      title: 'Intervention revision denied',
      message:
        "Decision Maker denied Test Applicant's intervention revision. Note: The revised costs need more support.",
      severity: 'warning',
    });
  });

  test('uses Decision Maker and submitter wording in final assessment packets', () => {
    const serverSource = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
    const templateSource = fs.readFileSync(
      path.join(process.cwd(), 'src/server/templates/pdf/assessment.html'),
      'utf8'
    );
    const finalSectionStart = serverSource.indexOf('function buildAssessmentAgreementSectionHtml');
    const finalSectionEnd = serverSource.indexOf('const resolvePaymentTypeLabel', finalSectionStart);
    const finalSection = serverSource.slice(finalSectionStart, finalSectionEnd);

    expect(templateSource).toContain('Submitter evidence');
    expect(finalSection).toContain('Decision Maker final decision/sign-off');
    expect(finalSection).toContain('Decision Maker decision note');
    expect(finalSection).toContain('Regional Manager review/sign-off');
    expect(finalSection).not.toContain('Reason for denial by NWAC');
    expect(finalSection).not.toContain('Approver eSignature');
  });
});
