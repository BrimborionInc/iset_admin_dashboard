import { buildApplicationStatusInfo } from '../../../utils/applicationStatus';
import { buildApplicationQueueStatusFields } from '../homeApplicationQueueFields';

const getRenderedStatusLabel = item => (
  buildApplicationStatusInfo({
    applicationStatus: item.status || item.application_status || null,
    applicationLifecycleStatus: item.application_lifecycle_status ?? null,
    caseStatus: item.case_status || null,
    caseId: item.case_id ?? null,
    assignedUserId: item.assigned_user_id ?? null,
    assessmentEligibility: item.assessment_esdc_eligibility,
    decisionOutcome: item.decision_outcome ?? null,
    awaitingReason: item.application_awaiting_reason ?? null,
    closureReason: item.application_closure_reason ?? null,
    type: item.type,
  }).statusLabel
);

describe('home application queue status fields', () => {
  it('preserves EI eligibility when rebuilding application rows for the Overdue queue', () => {
    const sourceRow = {
      case_id: 44,
      application_status: 'in_review',
      application_lifecycle_status: 'in_review',
      assigned_to_user_id: 12,
      assessment_esdc_eligibility: 'crf',
    };

    const item = {
      type: 'Application',
      case_id: sourceRow.case_id,
      assigned_user_id: sourceRow.assigned_to_user_id,
      ...buildApplicationQueueStatusFields(sourceRow, 'submitted'),
    };

    expect(item.assessment_esdc_eligibility).toBe('crf');
    expect(getRenderedStatusLabel(item)).toBe('In Review');
  });

  it('preserves camelCase EI eligibility when rebuilding application rows', () => {
    const sourceRow = {
      case_id: 46,
      application_status: 'in_review',
      application_lifecycle_status: 'in_review',
      assigned_to_user_id: 14,
      assessmentEsdcEligibility: 'reach_back',
    };

    const item = {
      type: 'Application',
      case_id: sourceRow.case_id,
      assigned_user_id: sourceRow.assigned_to_user_id,
      ...buildApplicationQueueStatusFields(sourceRow, 'submitted'),
    };

    expect(item.assessment_esdc_eligibility).toBe('reach_back');
    expect(getRenderedStatusLabel(item)).toBe('In Review');
  });

  it('still labels assigned submitted rows as awaiting EI validation when no EI result exists', () => {
    const sourceRow = {
      case_id: 45,
      application_status: 'submitted',
      application_lifecycle_status: 'submitted',
      assigned_to_user_id: 13,
      assessment_esdc_eligibility: null,
    };

    const item = {
      type: 'Application',
      case_id: sourceRow.case_id,
      assigned_user_id: sourceRow.assigned_to_user_id,
      ...buildApplicationQueueStatusFields(sourceRow, 'submitted'),
    };

    expect(getRenderedStatusLabel(item)).toBe('Submitted • Awaiting EI Validation');
  });
});
