const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  createTransferredHarnessDescriptor,
  validateAssessmentStartPrerequisiteEvidence,
  validateAssessmentStartJourneyEvidence,
} = require('../scripts/two-step-review-test-smoke');

const clone = value => JSON.parse(JSON.stringify(value));

describe('two-step TEST harness transfer boundary', () => {
  test('binds exact source bytes to an attempt-owned S3 key and remote path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'two-step-harness-transfer-'));
    try {
      const sourcePath = path.join(root, 'runner.js');
      fs.writeFileSync(sourcePath, "process.stdout.write('synthetic runner');\n");
      const descriptor = createTransferredHarnessDescriptor(
        sourcePath,
        'two-step-1786663557212-d37a6b9c78'
      );
      expect(descriptor).toMatchObject({
        key: 'ssm-scripts/two-step-review-smoke-two-step-1786663557212-d37a6b9c78.runner.js',
        remotePath: '/tmp/two-step-review-smoke-two-step-1786663557212-d37a6b9c78.runner.js',
        bytes: 42,
      });
      expect(descriptor.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(Buffer.isBuffer(descriptor.source)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('rejects an ambiguous attempt stamp and a symlinked source', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'two-step-harness-transfer-'));
    try {
      const sourcePath = path.join(root, 'runner.js');
      const linkPath = path.join(root, 'runner-link.js');
      fs.writeFileSync(sourcePath, 'synthetic');
      fs.symlinkSync(sourcePath, linkPath);
      expect(() => createTransferredHarnessDescriptor(sourcePath, 'r8')).toThrow(
        'transferred_harness_stamp_invalid'
      );
      expect(() => createTransferredHarnessDescriptor(
        linkPath,
        'two-step-1786663557212-d37a6b9c78'
      )).toThrow('transferred_harness_source_not_regular_file');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('executes the transferred source and exposes a focused journey mode', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'two-step-review-test-smoke.js'),
      'utf8'
    );
    expect(source).not.toContain("node ${shellQuote('/opt/nwac/admin-dashboard/scripts/two-step-review-test-smoke.js')}");
    expect(source).toContain('node ${shellQuote(transferredHarness.remotePath)} --remote-runner');
    expect(source).toContain('TWO_STEP_REVIEW_HARNESS_SHA256=${shellQuote(transferredHarness.sha256)}');
    expect(source).toContain("NODE_PATH=${shellQuote('/opt/nwac/admin-dashboard/node_modules')}");
    expect(source).toContain("executionMode: config.assessmentStartOnly ? 'assessment-start-only' : 'full-two-step-review'");
    expect(source).toContain('await runAssessmentStartApplicationWorkflow(auth);');
    expect(source).toContain('deleteRemoteScript(remoteHarnessKey, options)');
    expect(source).toContain('verifiedTemporaryObjectCleanup.push(remoteHarnessKey)');
  });

  test('recreates transferred-source dependency failure and proves the declared module root repairs it', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'two-step-harness-module-root-'));
    try {
      const transferredPath = path.join(root, 'runner.js');
      fs.copyFileSync(
        path.resolve(__dirname, '..', 'scripts', 'two-step-review-test-smoke.js'),
        transferredPath
      );
      const launcher = [
        '(async () => {',
        '  const runner = require(process.argv[1]);',
        "  const dispatcher = runner.createFreshLoopbackDispatcher('http://127.0.0.1:65534');",
        '  await dispatcher.close();',
        '})().catch(error => { console.error(error.stack || error); process.exit(1); });',
      ].join('\n');
      const withoutModuleRoot = spawnSync(process.execPath, ['-e', launcher, transferredPath], {
        cwd: root,
        env: { ...process.env, NODE_PATH: '' },
        encoding: 'utf8',
      });
      expect(withoutModuleRoot.status).not.toBe(0);
      expect(withoutModuleRoot.stderr).toContain("Cannot find module 'undici'");

      const withModuleRoot = spawnSync(process.execPath, ['-e', launcher, transferredPath], {
        cwd: root,
        env: {
          ...process.env,
          NODE_PATH: path.resolve(__dirname, '..', 'node_modules'),
        },
        encoding: 'utf8',
      });
      expect(withModuleRoot.status).toBe(0);
      expect(withModuleRoot.stderr).toBe('');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

function buildValidEvidence() {
  const attemptStamp = 'attempt-r4';
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
  const buildEiDocument = ({ id, applicationId, kind, checksum, size }) => {
    const fileName = `two-step-review-${attemptStamp}-assessment-start-${kind}-ei-verification.pdf`;
    const label = `Synthetic assessment-start ${kind} EI verification ${attemptStamp}`;
    return {
      id,
      case_id: 77,
      application_id: applicationId,
      action_plan_id: null,
      client_id: 44,
      applicant_user_id: 300,
      user_id: 400,
      source: 'manual_upload',
      file_name: fileName,
      file_path: `uploads/2026/08/13/300/${kind}-owned-key.pdf`,
      mime_type: 'application/pdf',
      label,
      metadata: JSON.stringify({
        label,
        document_type: 'ei_verification',
        ei_eligibility_status: 'crf',
      }),
      size_bytes: size,
      checksum_sha256: checksum,
      status: 'active',
      document_category: 'ei_verification',
      created_at: '2026-08-13T12:00:30.000Z',
      updated_at: '2026-08-13T12:00:30.000Z',
    };
  };
  const eiDocuments = [
    buildEiDocument({
      id: 700,
      applicationId: 101,
      kind: 'selected',
      checksum: 'a'.repeat(64),
      size: 301,
    }),
    buildEiDocument({
      id: 701,
      applicationId: 102,
      kind: 'sibling',
      checksum: 'b'.repeat(64),
      size: 302,
    }),
  ];
  const buildChecklist = complete => ({
    gateId: 'start_assessment',
    gateLabel: 'Gate 2 - Start Assessment',
    missingRequiredCount: complete ? 0 : 1,
    items: [
      {
        id: 'ei-consent-form',
        label: 'EI Consent Form',
        required: true,
        minCount: 1,
        matchedCount: 1,
        status: 'complete',
        documentTypes: ['ei_consent'],
        sources: ['application_form'],
      },
      {
        id: 'ei-eligibility-verification',
        label: 'EI Eligibility Verification',
        required: true,
        minCount: 1,
        matchedCount: complete ? 1 : 0,
        status: complete ? 'complete' : 'missing',
        documentTypes: ['ei_verification'],
        sources: ['application_submission', 'manual_upload', 'secure_message_attachment'],
      },
      {
        id: 'case-manager-assessment',
        label: 'Case manager assessment',
        required: false,
        minCount: 1,
        matchedCount: 0,
        status: 'complete',
        documentTypes: ['case_assessment'],
        sources: ['application_form'],
      },
    ],
  });
  const prerequisites = {
    attemptStamp,
    caseId: 77,
    selectedApplicationId: 101,
    siblingApplicationId: 102,
    clientId: 44,
    applicantUserId: 300,
    uploaderUserId: 400,
    assessments: [
      { application_id: 101, case_id: 77, esdc_eligibility: 'CRF' },
      { application_id: 102, case_id: 77, esdc_eligibility: 'CRF' },
    ],
    documents: clone(eiDocuments),
    uploads: eiDocuments.map((document, index) => ({
      kind: index === 0 ? 'selected' : 'sibling',
      response: {
        ok: true,
        document: {
          id: document.id,
          case_id: document.case_id,
          application_id: document.application_id,
          client_id: document.client_id,
          applicant_user_id: document.applicant_user_id,
          file_name: document.file_name,
          file_path: document.file_path,
          label: document.label,
          document_category: document.document_category,
          source: document.source,
          status: document.status,
        },
      },
    })),
    checklistBefore: buildChecklist(false),
    checklistAfter: buildChecklist(true),
    objectAdditions: {
      prefixes: ['uploads/2026/08/13/300/'],
      currentObjects: eiDocuments.map(document => ({
        key: document.file_path,
        size: document.size_bytes,
        etag: `etag-${document.id}`,
      })),
      versions: eiDocuments.map(document => ({
        key: document.file_path,
        versionId: `version-${document.id}`,
        kind: 'version',
        size: document.size_bytes,
      })),
    },
  };
  const before = {
    selected,
    sibling,
    selectedAssessment,
    siblingAssessment,
    caseRow,
    conflictDeclarations: [],
    unrelatedWorkflows,
    eiDocuments: clone(eiDocuments),
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
  afterSave.selectedAssessment.overview = `ASSESSMENT-START-${attemptStamp}`;
  afterSave.selectedAssessment.updated_at = '2026-08-13T12:02:00.000Z';

  return {
    attemptStamp,
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
      overview: `ASSESSMENT-START-${attemptStamp}`,
      hasStatusFields: false,
    },
    saveResponse: { httpStatus: 200, success: true },
    prerequisites,
    before,
    afterDeclaration,
    afterSave,
  };
}

describe('two-step TEST assessment-start prerequisite evidence', () => {
  test('matches the product-owned canonical CRF metadata contract', () => {
    const productSource = fs.readFileSync(path.resolve(__dirname, '..', 'isetadminserver.js'), 'utf8');
    expect(productSource).toContain("if (normalized === 'crf') return 'crf';");
    expect(productSource).toContain(
      'metadataObj.ei_eligibility_status = normalizeEsdcEligibilityValue(eiEligibilityStatus);'
    );
  });

  test('accepts signed selected consent plus two distinct application-scoped CRF documents and exact object versions', () => {
    expect(validateAssessmentStartPrerequisiteEvidence(buildValidEvidence().prerequisites)).toEqual({
      caseId: 77,
      selectedApplicationId: 101,
      siblingApplicationId: 102,
      eligibilityStatus: 'CRF',
      documentIds: [700, 701],
      objectKeys: [
        'uploads/2026/08/13/300/selected-owned-key.pdf',
        'uploads/2026/08/13/300/sibling-owned-key.pdf',
      ],
      objectCurrentCount: 2,
      objectVersionCount: 2,
    });
  });

  test.each([
    ['missing sibling document', evidence => { evidence.documents.pop(); }, 'cardinality_invalid'],
    ['invalid sibling eligibility', evidence => { evidence.assessments[1].esdc_eligibility = 'Unknown'; }, 'application_eligibility_invalid'],
    ['cross-scoped sibling document', evidence => { evidence.documents[1].application_id = 101; }, 'application_document_scope_invalid'],
    ['non-synthetic manifest', evidence => { evidence.documents[0].label = 'EI verification'; }, 'document_manifest_invalid'],
    ['display-form EI metadata instead of the product canonical value', evidence => {
      const metadata = JSON.parse(evidence.documents[0].metadata);
      metadata.ei_eligibility_status = 'CRF';
      evidence.documents[0].metadata = JSON.stringify(metadata);
    }, 'document_manifest_invalid'],
    ['contradictory upload response', evidence => { evidence.uploads[0].response.document.application_id = 102; }, 'upload_response_invalid'],
    ['missing selected signed EI consent', evidence => {
      evidence.checklistBefore.items[0].matchedCount = 0;
      evidence.checklistBefore.items[0].status = 'missing';
      evidence.checklistBefore.missingRequiredCount = 2;
    }, 'checklist_contract_invalid'],
    ['unexpected required start prerequisite', evidence => {
      evidence.checklistBefore.items.push({
        id: 'unexpected',
        required: true,
        matchedCount: 0,
        status: 'missing',
        documentTypes: ['unexpected'],
      });
      evidence.checklistBefore.missingRequiredCount = 3;
    }, 'checklist_contract_invalid'],
    ['incomplete start checklist after fixture setup', evidence => {
      evidence.checklistAfter.items[0].matchedCount = 0;
      evidence.checklistAfter.items[0].status = 'missing';
      evidence.checklistAfter.missingRequiredCount = 1;
    }, 'checklist_contract_invalid'],
    ['shared document bytes', evidence => { evidence.documents[1].checksum_sha256 = 'a'.repeat(64); }, 'document_bytes_not_distinct'],
    ['missing object version', evidence => { evidence.objectAdditions.versions.pop(); }, 'cardinality_invalid'],
    ['delete marker instead of owned version', evidence => { evidence.objectAdditions.versions[0].kind = 'delete-marker'; }, 'object_manifest_invalid'],
  ])('rejects %s evidence', (_label, mutate, code) => {
    const evidence = buildValidEvidence().prerequisites;
    mutate(evidence);
    expect(() => validateAssessmentStartPrerequisiteEvidence(evidence)).toThrow(
      `assessment_start_prerequisite_evidence_invalid:${code}`
    );
  });
});

describe('two-step TEST assessment-start journey evidence', () => {
  test('accepts the exact assigned Regional Manager journey and returns bounded evidence', () => {
    expect(validateAssessmentStartJourneyEvidence(buildValidEvidence())).toEqual({
      caseId: 77,
      selectedApplicationId: 101,
      siblingApplicationId: 102,
      assignedStaffProfileId: 55,
      assignedRole: 'Regional Manager',
      unrelatedWorkflowCount: 1,
      eiVerificationDocumentIds: [700, 701],
      eiVerificationObjectKeys: [
        'uploads/2026/08/13/300/selected-owned-key.pdf',
        'uploads/2026/08/13/300/sibling-owned-key.pdf',
      ],
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
    ['EI verification documents', evidence => { evidence.afterSave.eiDocuments[0].status = 'archived'; }],
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
