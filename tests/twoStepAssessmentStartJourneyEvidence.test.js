const {
  validateAssessmentStartJourneyEvidence,
} = require('../scripts/two-step-review-test-smoke');

const clone = value => JSON.parse(JSON.stringify(value));

function buildValidEvidence() {
  const selected = {
    id: 101,
    case_id: 77,
    status: 'submitted',
    lifecycle_status: 'submitted',
    decision_outcome: null,
    awaiting_reason: 'none',
    docs_requested_active: 0,
    docs_requested_source: null,
    row_version: 1,
    workflow_id: null,
    current_stage: null,
    current_owner_role: null,
    submitted_by_staff_profile_id: null,
    nwac_decision: null,
  };
  const sibling = {
    id: 102,
    submission_id: 202,
    client_id: 44,
    case_id: 77,
    payload_json: '{"fixture":"attempt-r3"}',
    status: 'submitted',
    lifecycle_status: 'submitted',
    decision_outcome: null,
    awaiting_reason: 'none',
    closure_reason: null,
    docs_requested_active: 0,
    docs_requested_at: null,
    docs_requested_cleared_at: null,
    docs_requested_source: null,
    row_version: 1,
    created_at: '2026-08-13T12:00:00.000Z',
    updated_at: '2026-08-13T12:00:00.000Z',
  };
  const selectedAssessment = {
    application_id: 101,
    case_id: 77,
    overview: 'Seed assessment overview',
    recommendation: 'recommend',
    created_at: '2026-08-13T12:00:00.000Z',
    updated_at: '2026-08-13T12:00:00.000Z',
  };
  const siblingAssessment = {
    application_id: 102,
    case_id: 77,
    overview: 'Sibling sentinel',
    recommendation: 'recommend',
    created_at: '2026-08-13T12:00:00.000Z',
    updated_at: '2026-08-13T12:00:00.000Z',
  };
  const caseRow = {
    id: 77,
    case_number: 'TSTEP-assessmentStart-attempt-r3',
    client_id: 44,
    assigned_staff_profile_id: 55,
    status: 'intake',
    lifecycle_status: 'intake',
    stage: 'two_step_smoke',
    portfolio_region_id: 9,
    case_context_json: '{"fixture":"attempt-r3"}',
    created_by_staff_profile_id: 55,
    updated_by_staff_profile_id: 55,
  };
  const unrelatedWorkflows = [{
    id: 900,
    case_id: 70,
    application_id: 90,
    workflow_type: 'application_assessment',
    current_stage: 'final_decision_recorded',
    current_owner_role: null,
    submitted_by_staff_profile_id: 50,
    nwac_decision: 'approved',
  }];
  const before = {
    selected,
    sibling,
    selectedAssessment,
    siblingAssessment,
    caseRow,
    conflictDeclarations: [],
    unrelatedWorkflows,
  };
  const declaration = {
    id: 500,
    case_id: 77,
    staff_profile_id: 55,
    signed_at: '2026-08-13T12:01:00.000Z',
    revoked_at: null,
    declaration_choice: 'no_conflict',
    conflict_details: null,
  };
  const afterDeclaration = clone(before);
  afterDeclaration.conflictDeclarations = [declaration];
  const afterSave = clone(afterDeclaration);
  afterSave.selected.status = 'in_review';
  afterSave.selected.lifecycle_status = 'in_review';
  afterSave.selected.row_version = 2;
  afterSave.selectedAssessment.overview = 'ASSESSMENT-START-attempt-r3';
  afterSave.selectedAssessment.updated_at = '2026-08-13T12:02:00.000Z';

  return {
    attemptStamp: 'attempt-r3',
    actor: { staffProfileId: 55, role: 'Regional Manager' },
    declarationRequest: {
      applicationId: 101,
      expectedRowVersion: 1,
      signed: true,
      choice: 'no_conflict',
      hasStatusFields: false,
      httpStatus: 200,
    },
    saveRequest: {
      applicationId: 101,
      expectedRowVersion: 1,
      overview: 'ASSESSMENT-START-attempt-r3',
      hasStatusFields: false,
    },
    saveResponse: { httpStatus: 200, success: true },
    before,
    afterDeclaration,
    afterSave,
  };
}

describe('two-step TEST assessment-start journey evidence', () => {
  test('accepts the exact assigned Regional Manager journey and returns bounded evidence', () => {
    expect(validateAssessmentStartJourneyEvidence(buildValidEvidence())).toEqual({
      caseId: 77,
      selectedApplicationId: 101,
      siblingApplicationId: 102,
      assignedStaffProfileId: 55,
      assignedRole: 'Regional Manager',
      unrelatedWorkflowCount: 1,
      selectedRowVersionBefore: 1,
      selectedRowVersionAfter: 2,
    });
  });

  test('admits the other product-authorized assigned role only when its exact profile owns the case', () => {
    const evidence = buildValidEvidence();
    evidence.actor.role = 'ISET Coordinator';
    expect(validateAssessmentStartJourneyEvidence(evidence).assignedRole).toBe('ISET Coordinator');

    evidence.actor.staffProfileId = 56;
    expect(() => validateAssessmentStartJourneyEvidence(evidence)).toThrow(
      'assessment_start_journey_evidence_invalid:assigned_actor_invalid'
    );
  });

  test('rejects a declaration that advances either application or mutates protected state', () => {
    const evidence = buildValidEvidence();
    evidence.afterDeclaration.selected.status = 'in_review';
    expect(() => validateAssessmentStartJourneyEvidence(evidence)).toThrow(
      'assessment_start_journey_evidence_invalid:declaration_changed_protected_state'
    );
  });

  test('rejects malformed, failed, or status-authoring assessment-save evidence', () => {
    const missingSnapshot = buildValidEvidence();
    delete missingSnapshot.afterSave.caseRow;
    expect(() => validateAssessmentStartJourneyEvidence(missingSnapshot)).toThrow(
      'assessment_start_journey_evidence_invalid:snapshot_record_missing'
    );

    const failedResponse = buildValidEvidence();
    failedResponse.saveResponse = { httpStatus: 409, success: false };
    expect(() => validateAssessmentStartJourneyEvidence(failedResponse)).toThrow(
      'assessment_start_journey_evidence_invalid:assessment_save_request_invalid'
    );

    const authoredStatus = buildValidEvidence();
    authoredStatus.saveRequest.hasStatusFields = true;
    expect(() => validateAssessmentStartJourneyEvidence(authoredStatus)).toThrow(
      'assessment_start_journey_evidence_invalid:assessment_save_request_invalid'
    );
  });

  test.each([
    ['sibling application', evidence => { evidence.afterSave.sibling.status = 'in_review'; }],
    ['sibling assessment', evidence => { evidence.afterSave.siblingAssessment.overview = 'changed'; }],
    ['case', evidence => { evidence.afterSave.caseRow.status = 'active'; }],
    ['unrelated workflow', evidence => { evidence.afterSave.unrelatedWorkflows[0].current_stage = 'rm_review'; }],
    ['declaration', evidence => { evidence.afterSave.conflictDeclarations[0].declaration_choice = 'conflict'; }],
  ])('rejects a first save that changes the protected %s control', (_label, mutate) => {
    const evidence = buildValidEvidence();
    mutate(evidence);
    expect(() => validateAssessmentStartJourneyEvidence(evidence)).toThrow(
      'assessment_start_journey_evidence_invalid:save_changed_protected_state'
    );
  });

  test('rejects an ambiguous transition that advances the wrong selected record version', () => {
    const evidence = buildValidEvidence();
    evidence.afterSave.selected.row_version = 3;
    expect(() => validateAssessmentStartJourneyEvidence(evidence)).toThrow(
      'assessment_start_journey_evidence_invalid:selected_application_transition_invalid'
    );
  });
});
