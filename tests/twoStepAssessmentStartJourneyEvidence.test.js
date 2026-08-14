const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  ASSESSMENT_START_JOURNEY_ARTIFACT_KIND,
  ASSESSMENT_START_JOURNEY_ARTIFACT_VERSION,
  captureAssessmentStartBrowserExchange,
  createAssessmentStartJourneyArtifact,
  createTransferredHarnessDescriptor,
  establishAssessmentStartFocusedControl,
  isAssessmentStartCaseMutationResponse,
  replayAssessmentStartJourneyArtifact,
  validateAssessmentStartPrerequisiteEvidence,
  validateAssessmentStartJourneyArtifact,
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

  test('wires the focused control seed and native capture before browser execution', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'two-step-review-test-smoke.js'),
      'utf8'
    );
    const baseSeed = source.indexOf('await seedFixture();');
    const focusedControl = source.indexOf('const focusedControl = await establishAssessmentStartFocusedControl({');
    const objectBaseline = source.indexOf('await proveFixtureObjectPrefixBaseline();');
    const browserLaunch = source.indexOf('browser = await puppeteer.launch({');
    expect(baseSeed).toBeGreaterThan(-1);
    expect(focusedControl).toBeGreaterThan(baseSeed);
    expect(objectBaseline).toBeGreaterThan(focusedControl);
    expect(browserLaunch).toBeGreaterThan(objectBaseline);
    expect(source).toContain("await seedApplicationAssessmentCase('assessmentStartControl'");
    expect(source).toContain('fixture.workflows.assessmentStartControl = workflowId;');
    expect(source).toContain('return snapshot.unrelatedWorkflows;');
    expect(source).toContain("pass('assessment start: focused mode owns an independently captured unrelated workflow control'");
    expect(source).toContain('...Object.values(fixture.cases).filter(Boolean),');
    expect(source).toContain('await deleteWorkflowRows(caseIds, applicationIds, interventionIds, proposalIds);');
    expect(source).toContain('counts.reviewWorkflows = Number(reviewWorkflowCount.count || 0);');
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
    subject_key: 'application_assessment:application:90',
    case_id: 70,
    application_id: 90,
    workflow_type: 'application_assessment',
    current_stage: 'final_decision_recorded',
    current_owner_role: null,
    current_owner_staff_profile_id: 55,
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
      responseSuccess: true,
    },
    saveRequest: {
      applicationId: 101,
      expectedRowVersion: 1,
      overview: `ASSESSMENT-START-${attemptStamp}`,
      hasStatusFields: false,
      hasAssessmentFields: true,
      hasDeclarationFields: false,
    },
    saveResponse: {
      httpStatus: 200,
      success: true,
      applicationStatus: 'in_review',
      lifecycleStatus: 'in_review',
      rowVersion: 2,
    },
    prerequisites,
    before,
    afterDeclaration,
    afterSave,
  };
}

function fakeBrowserResponse({ method = 'PUT', target, requestBody, httpStatus = 200, responseBody }) {
  const requestBodyText = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
  const responseBodyText = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
  return {
    request: () => ({
      method: () => method,
      postData: () => requestBodyText,
    }),
    status: () => httpStatus,
    url: () => target,
    text: async () => responseBodyText,
  };
}

async function buildValidArtifact() {
  const semantic = buildValidEvidence();
  const target = 'http://127.0.0.1:5001/api/cases/77';
  const declaration = await captureAssessmentStartBrowserExchange(fakeBrowserResponse({
    target,
    requestBody: {
      applicationId: 101,
      expectedRowVersion: 1,
      assessment_conflict_declaration_signed: true,
      assessment_conflict_declaration_choice: 'no_conflict',
    },
    responseBody: { success: true },
  }));
  const firstAssessmentSave = await captureAssessmentStartBrowserExchange(fakeBrowserResponse({
    target,
    requestBody: {
      applicationId: 101,
      expectedRowVersion: 1,
      assessment_date_of_assessment: '2026-08-13',
      assessment_esdc_eligibility: 'CRF',
      case_summary: semantic.saveRequest.overview,
    },
    responseBody: {
      success: true,
      applicationStatus: 'in_review',
      application_lifecycle_status: 'in_review',
      application_row_version: 2,
    },
  }));
  return createAssessmentStartJourneyArtifact({
    schemaVersion: ASSESSMENT_START_JOURNEY_ARTIFACT_VERSION,
    kind: ASSESSMENT_START_JOURNEY_ARTIFACT_KIND,
    phase: 'after-first-save-captured',
    attemptStamp: semantic.attemptStamp,
    routePath: '/application-case/77?applicationId=101',
    actor: semantic.actor,
    prerequisites: semantic.prerequisites,
    snapshots: {
      before: semantic.before,
      afterDeclaration: semantic.afterDeclaration,
      afterFirstSave: semantic.afterSave,
    },
    exchanges: { declaration, firstAssessmentSave },
  });
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
  test('captures the first exact case mutation without pre-validating away malformed evidence', () => {
    const target = 'http://127.0.0.1:5001/api/cases/77';
    const valid = fakeBrowserResponse({
      target,
      requestBody: {
        applicationId: 101,
        expectedRowVersion: 1,
        assessment_date_of_assessment: '2026-08-13',
        assessment_esdc_eligibility: 'CRF',
        case_summary: 'ASSESSMENT-START-attempt-r4',
      },
      responseBody: { success: true },
    });
    expect(isAssessmentStartCaseMutationResponse(valid, target)).toBe(true);

    const declaration = fakeBrowserResponse({
      target,
      requestBody: {
        applicationId: 101,
        assessment_conflict_declaration_signed: true,
        assessment_conflict_declaration_choice: 'no_conflict',
      },
      responseBody: { success: true },
    });
    expect(isAssessmentStartCaseMutationResponse(declaration, target)).toBe(true);

    const wrongApplication = fakeBrowserResponse({
      target,
      requestBody: {
        applicationId: 102,
        assessment_date_of_assessment: '2026-08-13',
        assessment_esdc_eligibility: 'CRF',
        case_summary: 'ASSESSMENT-START-attempt-r4',
      },
      responseBody: { success: true },
    });
    expect(isAssessmentStartCaseMutationResponse(wrongApplication, target)).toBe(true);
    expect(isAssessmentStartCaseMutationResponse(valid, 'http://127.0.0.1:5001/api/cases/78')).toBe(false);
    const wrongMethod = fakeBrowserResponse({
      method: 'POST',
      target,
      requestBody: '{malformed',
      responseBody: { success: false },
    });
    expect(isAssessmentStartCaseMutationResponse(wrongMethod, target)).toBe(false);
  });

  test('composes the exact focused-mode seed with captured browser bytes through serialization and replay', async () => {
    const calls = [];
    const seeded = {
      workflowId: 900,
      subjectKey: 'application_assessment:application:90',
      caseId: 70,
      applicationId: 90,
      submittedByStaffProfileId: 50,
      ownerStaffProfileId: 55,
    };
    const store = [];
    const control = await establishAssessmentStartFocusedControl({
      assessmentStartOnly: true,
      seedControl: async () => {
        calls.push('seed');
        store.push({
          id: seeded.workflowId,
          subject_key: seeded.subjectKey,
          case_id: seeded.caseId,
          application_id: seeded.applicationId,
          workflow_type: 'application_assessment',
          current_stage: 'rm_review',
          current_owner_role: 'Regional Manager',
          current_owner_staff_profile_id: seeded.ownerStaffProfileId,
          submitted_by_staff_profile_id: seeded.submittedByStaffProfileId,
          nwac_decision: null,
        });
        return seeded;
      },
      captureControl: async () => {
        calls.push('capture');
        return clone(store);
      },
    });
    expect(calls).toEqual(['seed', 'capture']);
    expect(control).toMatchObject({
      workflowId: 900,
      caseId: 70,
      applicationId: 90,
      capturedRows: [{ id: 900, current_stage: 'rm_review' }],
    });

    const artifact = await buildValidArtifact();
    for (const key of ['before', 'afterDeclaration', 'afterFirstSave']) {
      artifact.snapshots[key].unrelatedWorkflows = clone(control.capturedRows);
    }
    const serializedArtifact = JSON.stringify(artifact);
    expect(replayAssessmentStartJourneyArtifact(serializedArtifact)).toEqual(
      validateAssessmentStartJourneyArtifact(artifact)
    );
    expect(replayAssessmentStartJourneyArtifact(serializedArtifact).unrelatedWorkflowCount).toBe(1);
  });

  test('focused composition rejects a missing captured control and non-focused mode has no fixture effect', async () => {
    const seeded = {
      workflowId: 900,
      subjectKey: 'application_assessment:application:90',
      caseId: 70,
      applicationId: 90,
      submittedByStaffProfileId: 50,
      ownerStaffProfileId: 55,
    };
    await expect(establishAssessmentStartFocusedControl({
      assessmentStartOnly: true,
      seedControl: async () => seeded,
      captureControl: async () => [],
    })).rejects.toThrow('assessment_start_focused_control_invalid:capture_cardinality_invalid');

    const seedControl = jest.fn();
    const captureControl = jest.fn();
    await expect(establishAssessmentStartFocusedControl({
      assessmentStartOnly: false,
      seedControl,
      captureControl,
    })).resolves.toBeNull();
    expect(seedControl).not.toHaveBeenCalled();
    expect(captureControl).not.toHaveBeenCalled();
  });

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

  test('accepts only the two documented raw exchanges and rejects ambiguous or malformed capture', async () => {
    const extraExchange = await buildValidArtifact();
    extraExchange.exchanges.unexpected = clone(extraExchange.exchanges.declaration);
    expect(() => validateAssessmentStartJourneyArtifact(extraExchange)).toThrow(
      'assessment_start_artifact_invalid:exchange_keys_invalid'
    );

    const malformedBody = await buildValidArtifact();
    malformedBody.exchanges.firstAssessmentSave.request.bodyText = '{not-json';
    expect(() => validateAssessmentStartJourneyArtifact(malformedBody)).toThrow(
      'assessment_start_artifact_invalid:firstAssessmentSave_request_body_malformed'
    );

    const unreadableBody = await buildValidArtifact();
    unreadableBody.exchanges.firstAssessmentSave.response.bodyReadError = {
      name: 'ProtocolError',
      message: 'synthetic response body unavailable',
    };
    expect(() => validateAssessmentStartJourneyArtifact(unreadableBody)).toThrow(
      'assessment_start_artifact_invalid:firstAssessmentSave_response_body_unreadable'
    );

    const wrongOrigin = await buildValidArtifact();
    wrongOrigin.exchanges.declaration.request.target = 'http://127.0.0.1:5000/api/cases/77';
    expect(() => validateAssessmentStartJourneyArtifact(wrongOrigin)).toThrow(
      'assessment_start_artifact_invalid:declaration_request_target_invalid'
    );

    const reversedOrder = await buildValidArtifact();
    reversedOrder.exchanges.declaration.capturedAt = '2026-08-14T12:00:01.000Z';
    reversedOrder.exchanges.firstAssessmentSave.capturedAt = '2026-08-14T12:00:00.000Z';
    expect(() => validateAssessmentStartJourneyArtifact(reversedOrder)).toThrow(
      'assessment_start_artifact_invalid:exchange_order_invalid'
    );
  });

  test('reports the exact raw field responsible for native HTTP and semantic failures', async () => {
    const nativeFailure = await buildValidArtifact();
    nativeFailure.exchanges.firstAssessmentSave.response.httpStatus = 409;
    nativeFailure.exchanges.firstAssessmentSave.response.bodyText = JSON.stringify({ success: false });
    expect(() => validateAssessmentStartJourneyArtifact(nativeFailure)).toThrow(
      'assessment_start_journey_evidence_invalid:save_response_http_invalid'
    );

    const conflictingSuccess = await buildValidArtifact();
    conflictingSuccess.exchanges.firstAssessmentSave.response.bodyText = JSON.stringify({ success: false });
    expect(() => validateAssessmentStartJourneyArtifact(conflictingSuccess)).toThrow(
      'assessment_start_journey_evidence_invalid:save_response_success_invalid'
    );

    const contradictoryTransition = await buildValidArtifact();
    const contradictoryResponse = JSON.parse(
      contradictoryTransition.exchanges.firstAssessmentSave.response.bodyText
    );
    contradictoryResponse.applicationStatus = 'submitted';
    contradictoryTransition.exchanges.firstAssessmentSave.response.bodyText = JSON.stringify(
      contradictoryResponse
    );
    expect(() => validateAssessmentStartJourneyArtifact(contradictoryTransition)).toThrow(
      'assessment_start_journey_evidence_invalid:save_response_transition_invalid'
    );

    const wrongVersion = await buildValidArtifact();
    const body = JSON.parse(wrongVersion.exchanges.firstAssessmentSave.request.bodyText);
    body.expectedRowVersion = 99;
    wrongVersion.exchanges.firstAssessmentSave.request.bodyText = JSON.stringify(body);
    try {
      validateAssessmentStartJourneyArtifact(wrongVersion);
      throw new Error('expected validator rejection');
    } catch (error) {
      expect(error.message).toBe('assessment_start_journey_evidence_invalid:save_request_row_version_invalid');
      expect(error.details).toEqual({ expected: 1, actual: 99 });
    }
  });

  test('rejects malformed serialized artifacts before semantic validation', async () => {
    expect(() => replayAssessmentStartJourneyArtifact('')).toThrow(
      'assessment_start_artifact_invalid:serialized_artifact_missing'
    );
    expect(() => replayAssessmentStartJourneyArtifact('{')).toThrow(
      'assessment_start_artifact_invalid:serialized_artifact_malformed'
    );

    const wrongRoute = await buildValidArtifact();
    wrongRoute.routePath = '/application-case/77?applicationId=102';
    expect(() => replayAssessmentStartJourneyArtifact(JSON.stringify(wrongRoute))).toThrow(
      'assessment_start_artifact_invalid:route_scope_invalid'
    );

    const duplicateRouteScope = await buildValidArtifact();
    duplicateRouteScope.routePath = '/application-case/77?applicationId=101&applicationId=101';
    expect(() => replayAssessmentStartJourneyArtifact(JSON.stringify(duplicateRouteScope))).toThrow(
      'assessment_start_artifact_invalid:route_scope_invalid'
    );
  });

  test('live journey retains partial raw capture before replay and records validation detail', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'two-step-review-test-smoke.js'),
      'utf8'
    );
    const rawAssignment = source.indexOf('result.evidence.assessmentStartApplicationRaw = rawArtifact;');
    const declarationCapture = source.indexOf('rawArtifact.exchanges.declaration = exchange;');
    const saveCapture = source.indexOf('rawArtifact.exchanges.firstAssessmentSave = saveExchange;');
    const replay = source.indexOf('summary = replayAssessmentStartJourneyArtifact(serializedArtifact);');
    const declarationExchangeCapture = source.indexOf('const exchange = await captureAssessmentStartBrowserExchange(response);');
    const declarationRetentionCallback = source.indexOf("if (typeof onExchangeCaptured === 'function') onExchangeCaptured(exchange);");
    const declarationParse = source.indexOf("const requestBody = JSON.parse(exchange.request.bodyText || '{}');");
    expect(rawAssignment).toBeGreaterThan(-1);
    expect(declarationCapture).toBeGreaterThan(rawAssignment);
    expect(saveCapture).toBeGreaterThan(declarationCapture);
    expect(replay).toBeGreaterThan(saveCapture);
    expect(declarationExchangeCapture).toBeGreaterThan(-1);
    expect(declarationRetentionCallback).toBeGreaterThan(declarationExchangeCapture);
    expect(declarationParse).toBeGreaterThan(declarationRetentionCallback);
    expect(source).toContain("status: 'failed',\n        code: error?.code || null,");
    expect(source).toContain('errorDetails: serializeTransportCause(error?.details || null)');
    const journeyStart = source.indexOf('async function runAssessmentStartApplicationWorkflow(auth)');
    const journeyEnd = source.indexOf('async function runApplicationAssessmentWorkflow(auth)');
    const journeySource = source.slice(journeyStart, journeyEnd);
    const waitForFirstSave = journeySource.indexOf('const firstSaveResponsePromise = page.waitForResponse');
    const firstNext = journeySource.indexOf("await clickAssessmentWizardButton(page, 'Next');");
    const captureFirstSave = journeySource.indexOf('const response = await firstSaveResponsePromise;');
    expect(waitForFirstSave).toBeGreaterThan(-1);
    expect(firstNext).toBeGreaterThan(waitForFirstSave);
    expect(captureFirstSave).toBeGreaterThan(firstNext);
    expect(journeySource.match(/clickAssessmentWizardButton\(page, 'Next'\)/g)).toHaveLength(1);
    expect(journeySource).not.toContain("clickVisibleButton(page, 'Save Progress')");
  });

  test('follows the product-owned navigation auto-save and row-version lifecycle', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'src', 'widgets', 'CoordinatorAssessmentWidget.js'),
      'utf8'
    );
    const navigationStart = source.indexOf('const handleWizardNavigate = async ({ detail }) => {');
    const navigationEnd = source.indexOf('const canRecallAssessmentSubmission', navigationStart);
    const navigation = source.slice(navigationStart, navigationEnd);
    const silentSave = navigation.indexOf('const autoSaveResult = await handleSave({ silent: true });');
    const stepChange = navigation.indexOf('setCurrentStep(requestedStepId);');
    expect(navigationStart).toBeGreaterThan(-1);
    expect(silentSave).toBeGreaterThan(-1);
    expect(stepChange).toBeGreaterThan(silentSave);

    const saveStart = source.indexOf('const handleSave = async ({ silent = false } = {}) => {');
    const saveEnd = source.indexOf('// Lock editing state if final decision has been recorded', saveStart);
    const save = source.slice(saveStart, saveEnd);
    const versionRead = save.indexOf('const versionToken = Number(applicationRowVersionState');
    const requestDispatch = save.indexOf("const res = await apiFetch(`/api/cases/${caseData.id}`");
    const versionUpdate = save.indexOf('updateRowVersion(updatedRowVersion);');
    expect(saveStart).toBeGreaterThan(-1);
    expect(versionRead).toBeGreaterThan(-1);
    expect(requestDispatch).toBeGreaterThan(versionRead);
    expect(versionUpdate).toBeGreaterThan(requestDispatch);
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
      'assessment_start_journey_evidence_invalid:save_response_http_invalid'
    );

    const authoredStatus = buildValidEvidence();
    authoredStatus.saveRequest.hasStatusFields = true;
    expect(() => validateAssessmentStartJourneyEvidence(authoredStatus)).toThrow(
      'assessment_start_journey_evidence_invalid:save_request_authored_status'
    );

    const declarationShapedSave = buildValidEvidence();
    declarationShapedSave.saveRequest.hasAssessmentFields = false;
    declarationShapedSave.saveRequest.hasDeclarationFields = true;
    expect(() => validateAssessmentStartJourneyEvidence(declarationShapedSave)).toThrow(
      'assessment_start_journey_evidence_invalid:save_request_contract_invalid'
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
