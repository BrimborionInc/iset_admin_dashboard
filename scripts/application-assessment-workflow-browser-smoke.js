#!/usr/bin/env node
/*
 * DEV browser smoke for high-risk Application Assessment workflow paths.
 *
 * This loads the real local React bundle with deterministic mocked API data and
 * verifies conflict declaration, coordinator submit, pending-assessment recall,
 * NWAC approval, approval letter send persistence, and funding-form completion
 * payloads.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const {
  REVIEW_ACTIONS: REVIEW_WORKFLOW_ACTIONS,
  REVIEW_WORKFLOW_TYPES,
  getReviewTransition,
} = require('../src/lib/reviewWorkflow');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'application-assessment-workflow-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';
const CONSOLE_SNIPPET_LIMIT = 1500;

const FRONTEND_CASE_PATH = '/application-case/1?applicationId=2';
const CASE_ID = 1;
const APPLICATION_ID = 2;
const APPLICANT_USER_ID = 42;
const CURRENT_USER_ID = 'smoke-admin-sub';

const roleProfiles = {
  'System Administrator': {
    email: 'program.admin@awentech.ca',
    name: 'Program Admin',
    groups: ['System_Administrator'],
  },
  'ISET Coordinator': {
    email: 'quebec.coordinator.1@awentech.ca',
    name: 'Quebec Coordinator',
    groups: ['ISET_Coordinator'],
  },
  'Regional Manager': {
    email: 'regional.manager@awentech.ca',
    name: 'Regional Manager',
    groups: ['Regional_Manager'],
  },
};

const REVIEW_STAGES = {
  rmReview: 'rm_review',
  nwacReview: 'nwac_review',
  returnedToRm: 'returned_to_rm',
  returnedToSubmitter: 'returned_to_submitter',
  finalDecisionRecorded: 'final_decision_recorded',
};

const REVIEW_ACTIONS = {
  rmReturnToSubmitter: 'rm_return_to_submitter',
  rmSubmitToNwac: 'rm_submit_to_nwac',
  rmForwardChangesToSubmitter: 'rm_forward_changes_to_submitter',
};

const applicationAnswers = {
  'first-name': 'Jacqueline',
  'middle-names': 'Joanne',
  'last-name': 'Sillery',
  'preferred-name': 'Jacqueline',
  email: 'jack@sillery.co.uk',
  'contact-email-address': 'jack@sillery.co.uk',
  'telephone-day': '(514) 782-4396',
  'address-province': 'QC',
  'requested-supports': ['tuition'],
  'training-institution': 'Example College',
  'program-name': 'Administrative Assistant Certificate',
  'long-term-goal': 'Complete training and move into full-time employment.',
};

const now = new Date();
const lockExpiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.APPLICATION_ASSESSMENT_WORKFLOW_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.APPLICATION_ASSESSMENT_WORKFLOW_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--frontend-base') {
      args.frontendBase = argv[index + 1] || args.frontendBase;
      index += 1;
    } else if (token === '--screenshot-dir') {
      args.screenshotDir = argv[index + 1] || args.screenshotDir;
      index += 1;
    } else if (token === '--help' || token === '-h') {
      console.log([
        'Usage: node scripts/application-assessment-workflow-browser-smoke.js [options]',
        '',
        'Options:',
        '  --frontend-base URL     React app origin. Default: http://localhost:3001',
        '  --screenshot-dir DIR    Directory for browser screenshots.',
      ].join('\n'));
      process.exit(0);
    }
  }
  args.frontendBase = String(args.frontendBase || DEFAULT_FRONTEND_BASE).replace(/\/+$/, '');
  return args;
}

function findChromeExecutable() {
  return [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/home/bill/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    '/home/bill/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
    '/home/bill/.cache/puppeteer/chrome/linux-142.0.7444.59/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
  ].filter(Boolean).find(candidate => fs.existsSync(candidate));
}

function ensureLocalChromeLibraryPath() {
  if (!fs.existsSync(LOCAL_CHROME_LIBRARY_PATH)) return;
  const current = process.env.LD_LIBRARY_PATH || '';
  const entries = current.split(':').filter(Boolean);
  if (!entries.includes(LOCAL_CHROME_LIBRARY_PATH)) {
    process.env.LD_LIBRARY_PATH = [LOCAL_CHROME_LIBRARY_PATH, ...entries].join(':');
  }
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fakeJwt(role) {
  const profile = roleProfiles[role] || roleProfiles['System Administrator'];
  const issuedAt = Math.floor(Date.now() / 1000);
  return [
    base64UrlEncode({ alg: 'none', typ: 'JWT' }),
    base64UrlEncode({
      sub: CURRENT_USER_ID,
      email: profile.email,
      name: profile.name,
      role,
      'cognito:groups': profile.groups,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
    'signature',
  ].join('.');
}

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitUntil(predicate, label, timeoutMs = 45_000, intervalMs = 100) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = predicate();
    if (result) return result;
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function parseJsonSafely(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function buildCompleteIntervention() {
  return {
    id: 'intervention-1',
    code: '4',
    startDate: '2026-09-01',
    endDate: '2027-04-30',
    deliveryMode: 'partner',
    institution: 'Example College',
    programName: 'Administrative Assistant Certificate',
    itpDetails: 'Training plan, milestones, and support needs are documented.',
    wageSubsidyDetails: '',
    interventionNoc: '',
    interventionNocVersion: '',
    suggestionsSeeded: true,
    costLines: [],
  };
}

function buildCompleteAssessmentFields(extra = {}) {
  return {
    assessment_esdc_eligibility: 'eligible',
    case_summary: 'Applicant is ready to proceed with training assessment and has a clear employment plan.',
    assessment_employment_goals: 'Complete administrative assistant training and move into full-time employment.',
    assessment_previous_iset: 'no',
    assessment_previous_iset_details: '',
    assessment_employment_barriers: ['Transportation'],
    assessment_employment_barriers_other_details: '',
    assessment_local_area_priorities: ['Skills development'],
    assessment_childcare_need: 'no',
    assessment_childcare_funding_details: '',
    assessment_recommendation: 'recommend',
    assessment_justification: 'Training aligns with the applicant employment goal and local opportunities.',
    assessment_intervention_code: '4',
    assessment_intervention_start_date: '2026-09-01',
    assessment_intervention_end_date: '2027-04-30',
    assessment_institution: 'Example College',
    assessment_program_name: 'Administrative Assistant Certificate',
    assessment_itp: {
      tuition: '',
      books: '',
      materials: '',
      living: '',
      childcare: '',
      otherLabel: '',
      otherAmount: '',
      details: 'Training plan, milestones, and support needs are documented.',
    },
    assessment_wage: {
      wages: '',
      mercs: '',
      nonwages: '',
      other1Label: '',
      other1Amount: '',
      other2Label: '',
      other2Amount: '',
      subsidyDetails: '',
    },
    assessment_intervention_cost_total: '0.00',
    assessment_proposed_interventions: [buildCompleteIntervention()],
    ...extra,
  };
}

function buildApprovalLetterDraft() {
  return {
    decision_date: '2026-06-10',
    letter_title: 'Letter of Approval',
    decision_intro: 'Your application has been approved for the NWAC ISET program.',
    decision_label: 'Approved',
    decision_reason: 'The proposed training aligns with your employment plan.',
    next_step_1: 'Review the attached agreement.',
    next_step_2: 'Return any requested forms through the portal.',
    coordinator_name: 'Program Admin',
    organization_name: 'Native Women\'s Association of Canada',
  };
}

function buildApplicationScopedContext(updates = {}) {
  return {
    applicationAssessmentContext: { [APPLICATION_ID]: {} },
    applicationReportingArtifacts: {},
    applicationDecisionLetters: {
      [String(APPLICATION_ID)]: {
        ...(updates || {}),
      },
    },
  };
}

function buildReviewWorkflow(stage = REVIEW_STAGES.rmReview, overrides = {}) {
  return {
    id: 301,
    workflowType: 'application_assessment',
    workflow_type: 'application_assessment',
    subjectKey: `application_assessment:application:${APPLICATION_ID}`,
    subject_key: `application_assessment:application:${APPLICATION_ID}`,
    caseId: CASE_ID,
    case_id: CASE_ID,
    applicationId: APPLICATION_ID,
    application_id: APPLICATION_ID,
    currentStage: stage,
    current_stage: stage,
    currentOwnerRole:
      stage === REVIEW_STAGES.nwacReview
        ? 'NWAC Administrator'
        : stage === REVIEW_STAGES.returnedToSubmitter
          ? 'Submitter'
          : 'Regional Manager',
    current_owner_role:
      stage === REVIEW_STAGES.nwacReview
        ? 'NWAC Administrator'
        : stage === REVIEW_STAGES.returnedToSubmitter
          ? 'Submitter'
          : 'Regional Manager',
    submittedByStaffProfileId: 1,
    submitted_by_staff_profile_id: 1,
    submittedAt: '2026-06-19T13:00:00.000Z',
    submitted_at: '2026-06-19T13:00:00.000Z',
    rmReviewedByStaffProfileId: null,
    rm_reviewed_by_staff_profile_id: null,
    rmReviewedAt: null,
    rm_reviewed_at: null,
    rmReviewNote: null,
    rm_review_note: null,
    nwacDecidedByStaffProfileId: null,
    nwac_decided_by_staff_profile_id: null,
    nwacDecidedAt: null,
    nwac_decided_at: null,
    nwacDecision: null,
    nwac_decision: null,
    nwacDecisionNote: null,
    nwac_decision_note: null,
    ...overrides,
  };
}

function buildCasePayload({
  status = 'in_review',
  applicationStatus = 'in_review',
  rowVersion = 7,
  completeAssessment = false,
  conflictSigned = true,
  nwacReviewStatus = '',
  nwacReview = '',
  nwacReason = '',
  decisionOutcome = null,
  caseContext = buildApplicationScopedContext(),
  twoStepReviewEnabled = false,
  reviewWorkflow = null,
} = {}) {
  const assessmentFields = completeAssessment
    ? buildCompleteAssessmentFields({
        assessment_nwac_review_status: nwacReviewStatus,
        assessment_nwac_review: nwacReview,
        assessment_nwac_reason: nwacReason,
      })
    : {
        assessment_esdc_eligibility: 'eligible',
      };

  return {
    id: CASE_ID,
    case_id: CASE_ID,
    application_id: APPLICATION_ID,
    applicationId: APPLICATION_ID,
    application_row_version: rowVersion,
    applicationRowVersion: rowVersion,
    applicant_user_id: APPLICANT_USER_ID,
    applicantUserId: APPLICANT_USER_ID,
    tracking_id: 'ISET-20260508-A02882',
    applicant_name: 'Jacqueline Joanne Sillery',
    first_name: 'Jacqueline',
    preferred_name: 'Jacqueline',
    last_name: 'Sillery',
    applicant_email: 'jack@sillery.co.uk',
    email: 'jack@sillery.co.uk',
    applicant_phone: '(514) 782-4396',
    phone: '(514) 782-4396',
    address_province: 'QC',
    application_address_province: 'QC',
    status,
    statusRaw: status,
    lifecycle_status: status === 'closed' ? 'closed' : 'active',
    applicationStatus,
    application_status: applicationStatus,
    applicationStatusRaw: applicationStatus,
    application_status_raw: applicationStatus,
    application_lifecycle_status: applicationStatus === 'completed' ? 'completed' : 'assessment',
    applicationLifecycleStatus: applicationStatus === 'completed' ? 'completed' : 'assessment',
    twoStepReviewEnabled,
    two_step_review_enabled: twoStepReviewEnabled,
    reviewWorkflow,
    review_workflow: reviewWorkflow,
    decision_outcome: decisionOutcome,
    decisionOutcome,
    assigned_staff_profile_id: 1,
    assigned_user_email: 'program.admin@awentech.ca',
    assigned_user_display_name: 'Program Admin',
    submitted_at: '2026-05-08T16:24:00Z',
    created_at: '2026-05-08T16:24:00Z',
    updated_at: '2026-05-08T17:06:42Z',
    docs_requested_active: 0,
    lock_owner_id: null,
    lock_owner_name: null,
    lock_owner_email: null,
    lock_expires_at: null,
    payload_json: JSON.stringify(applicationAnswers),
    assessment_json: JSON.stringify({
      overview: assessmentFields.case_summary || '',
      employmentGoals: assessmentFields.assessment_employment_goals || '',
      recommendation: assessmentFields.assessment_recommendation || '',
      nwacReviewStatus,
      proposedInterventions: assessmentFields.assessment_proposed_interventions || [],
    }),
    assessment_conflict_declaration_signed: conflictSigned,
    assessment_conflict_declaration_signed_at: conflictSigned ? '2026-06-01T15:00:00Z' : null,
    assessment_conflict_declaration_signed_by: conflictSigned ? CURRENT_USER_ID : null,
    assessment_conflict_declaration_choice: conflictSigned ? 'no_conflict' : '',
    assessment_conflict_declaration_details: '',
    caseContext,
    actionPlans: [],
    ...assessmentFields,
  };
}

function buildApplicationPayload(casePayload) {
  return {
    id: APPLICATION_ID,
    case_id: CASE_ID,
    applicant_user_id: APPLICANT_USER_ID,
    row_version: casePayload.application_row_version,
    payload_json: JSON.stringify(applicationAnswers),
    status: casePayload.applicationStatus || casePayload.application_status,
    lifecycle_status: casePayload.application_lifecycle_status,
    applicant_name: 'Jacqueline Joanne Sillery',
    tracking_id: 'ISET-20260508-A02882',
    submitted_at: '2026-05-08T16:24:00Z',
    created_at: '2026-05-08T16:24:00Z',
    updated_at: '2026-05-08T17:06:42Z',
    docs_requested_active: 0,
    lock_owner_id: null,
    lock_owner_name: null,
    lock_owner_email: null,
    lock_expires_at: null,
  };
}

function buildCompleteChecklist() {
  return {
    items: [
      {
        id: 'identity',
        label: 'Government ID',
        required: true,
        status: 'complete',
        documentTypes: ['identity_document'],
      },
      {
        id: 'acceptance',
        label: 'Acceptance letter',
        required: true,
        status: 'complete',
        documentTypes: ['acceptance_letter'],
      },
      {
        id: 'funding-agreement',
        label: 'Client Funding Agreement',
        required: true,
        status: 'complete',
        documentTypes: ['client_funding_agreement'],
      },
    ],
    missingRequiredCount: 0,
    gateLabel: 'Gate 6 - Approve and Commence',
  };
}

function buildDismissedTutorialProgress() {
  return {
    items: [
      { tutorialId: 'iset-coordinator-intro-v2', status: 'dismissed' },
      { tutorialId: 'program-admin-intro-v1', status: 'dismissed' },
      { tutorialId: 'regional-manager-intro-v1', status: 'dismissed' },
      { tutorialId: 'application-workspace-overview-v3', status: 'dismissed' },
      { tutorialId: 'nwac-assessment-decision', status: 'dismissed' },
    ],
  };
}

function buildDocuments() {
  return [
    {
      id: 501,
      label: 'Government ID',
      file_name: 'government-id.pdf',
      document_type: 'identity_document',
      document_type_label: 'Government ID',
      source: 'application_submission',
      scope: 'client',
      application_id: APPLICATION_ID,
      case_id: CASE_ID,
      uploaded_at: '2026-05-08T16:30:00Z',
    },
    {
      id: 502,
      label: 'Acceptance letter',
      file_name: 'acceptance-letter.pdf',
      document_type: 'acceptance_letter',
      document_type_label: 'Acceptance letter',
      source: 'secure_message_attachment',
      scope: 'application',
      application_id: APPLICATION_ID,
      case_id: CASE_ID,
      uploaded_at: '2026-05-09T14:20:00Z',
    },
    {
      id: 503,
      label: 'Client Funding Agreement',
      file_name: 'client-funding-agreement.pdf',
      document_type: 'client_funding_agreement',
      document_type_label: 'Client Funding Agreement',
      source: 'secure_message_attachment',
      scope: 'application',
      application_id: APPLICATION_ID,
      case_id: CASE_ID,
      uploaded_at: '2026-05-10T10:00:00Z',
    },
    {
      id: 504,
      label: 'EI Verification',
      file_name: 'ei-verification.pdf',
      document_type: 'ei_verification',
      document_type_label: 'EI Verification',
      source: 'staff_upload',
      scope: 'application',
      application_id: APPLICATION_ID,
      case_id: CASE_ID,
      uploaded_at: '2026-05-11T10:00:00Z',
    },
  ];
}

function applyCaseMutation(state, body) {
  const currentVersion = Number(state.casePayload.application_row_version || 0) || 0;
  const nextVersion = currentVersion + 1;
  const twoStepEnabled = state.casePayload.twoStepReviewEnabled || state.casePayload.two_step_review_enabled;
  const preservePendingForTwoStepPushback =
    twoStepEnabled &&
    body.assessment_nwac_review_status === 'push_back' &&
    state.casePayload.reviewWorkflow;
  const next = {
    ...state.casePayload,
    ...body,
    application_row_version: nextVersion,
    applicationRowVersion: nextVersion,
  };
  if (twoStepEnabled) {
    next.twoStepReviewEnabled = true;
    next.two_step_review_enabled = true;
    if (body.applicationStatus === 'pending_approval' && body.assessment_recommendation && body.assessment_justification) {
      const transition = getReviewTransition({
        action: REVIEW_WORKFLOW_ACTIONS.SubmitForRmReview,
        workflowType: REVIEW_WORKFLOW_TYPES.ApplicationAssessment,
        role: state.role,
      });
      if (!transition.allowed) {
        return {
          success: false,
          error: 'review_workflow_transition_forbidden',
          _status: 403,
        };
      }
      const workflow = buildReviewWorkflow(REVIEW_STAGES.rmReview);
      next.reviewWorkflow = workflow;
      next.review_workflow = workflow;
    } else if (body.assessment_nwac_review_status && state.casePayload.reviewWorkflow) {
      const currentWorkflow = state.casePayload.reviewWorkflow;
      if (body.assessment_nwac_review_status === 'push_back') {
        const workflow = {
          ...currentWorkflow,
          currentStage: REVIEW_STAGES.returnedToRm,
          current_stage: REVIEW_STAGES.returnedToRm,
          currentOwnerRole: 'Regional Manager',
          current_owner_role: 'Regional Manager',
          nwacDecision: 'changes_requested',
          nwac_decision: 'changes_requested',
          nwacDecisionNote: body.assessment_nwac_reason || '',
          nwac_decision_note: body.assessment_nwac_reason || '',
        };
        next.reviewWorkflow = workflow;
        next.review_workflow = workflow;
        next.applicationStatus = 'pending_approval';
        next.application_status = 'pending_approval';
        next.applicationStatusRaw = 'pending_approval';
        next.application_status_raw = 'pending_approval';
      } else {
        const workflow = {
          ...currentWorkflow,
          currentStage: REVIEW_STAGES.finalDecisionRecorded,
          current_stage: REVIEW_STAGES.finalDecisionRecorded,
          currentOwnerRole: null,
          current_owner_role: null,
          nwacDecision: body.assessment_nwac_review_status === 'approve' ? 'approved' : 'denied',
          nwac_decision: body.assessment_nwac_review_status === 'approve' ? 'approved' : 'denied',
          nwacDecisionNote: body.assessment_nwac_reason || null,
          nwac_decision_note: body.assessment_nwac_reason || null,
        };
        next.reviewWorkflow = workflow;
        next.review_workflow = workflow;
      }
    }
  }
  if (body.applicationStatus && !preservePendingForTwoStepPushback) {
    next.application_status = body.applicationStatus;
    next.applicationStatusRaw = body.applicationStatus;
    next.application_status_raw = body.applicationStatus;
  }
  if (body.status) {
    next.statusRaw = body.status;
  }
  if (body.assessment_nwac_review_status === 'approve') {
    next.decision_outcome = body.applicationStatus === 'approved' ? 'approved' : next.decision_outcome;
    next.decisionOutcome = next.decision_outcome;
  }
  if (body.applicationStatus === 'completed') {
    next.application_lifecycle_status = 'completed';
    next.applicationLifecycleStatus = 'completed';
  }
  state.casePayload = next;
  state.applicationPayload = buildApplicationPayload(next);
  return {
    ...next,
    success: true,
    application_row_version: nextVersion,
    applicationRowVersion: nextVersion,
    reviewWorkflow: next.reviewWorkflow || null,
    review_workflow: next.review_workflow || null,
  };
}

function applyReviewWorkflowAction(state, body) {
  const currentVersion = Number(state.casePayload.application_row_version || 0) || 0;
  const nextVersion = currentVersion + 1;
  const currentWorkflow = state.casePayload.reviewWorkflow || buildReviewWorkflow(REVIEW_STAGES.rmReview);
  const note = typeof body.note === 'string' ? body.note : '';
  let applicationStatus = state.casePayload.applicationStatus || state.casePayload.application_status || 'pending_approval';
  let workflow = currentWorkflow;
  if (body.action === REVIEW_ACTIONS.rmSubmitToNwac) {
    workflow = {
      ...currentWorkflow,
      currentStage: REVIEW_STAGES.nwacReview,
      current_stage: REVIEW_STAGES.nwacReview,
      currentOwnerRole: 'NWAC Administrator',
      current_owner_role: 'NWAC Administrator',
      rmReviewedByStaffProfileId: 1,
      rm_reviewed_by_staff_profile_id: 1,
      rmReviewedAt: '2026-06-19T13:10:00.000Z',
      rm_reviewed_at: '2026-06-19T13:10:00.000Z',
      rmReviewNote: note || currentWorkflow.rmReviewNote || null,
      rm_review_note: note || currentWorkflow.rm_review_note || null,
    };
    applicationStatus = 'pending_approval';
  } else {
    workflow = {
      ...currentWorkflow,
      currentStage: REVIEW_STAGES.returnedToSubmitter,
      current_stage: REVIEW_STAGES.returnedToSubmitter,
      currentOwnerRole: 'Submitter',
      current_owner_role: 'Submitter',
      rmReviewedByStaffProfileId: 1,
      rm_reviewed_by_staff_profile_id: 1,
      rmReviewedAt: '2026-06-19T13:10:00.000Z',
      rm_reviewed_at: '2026-06-19T13:10:00.000Z',
      rmReviewNote: note,
      rm_review_note: note,
    };
    applicationStatus = 'in_review';
  }
  const next = {
    ...state.casePayload,
    applicationStatus,
    application_status: applicationStatus,
    applicationStatusRaw: applicationStatus,
    application_status_raw: applicationStatus,
    twoStepReviewEnabled: true,
    two_step_review_enabled: true,
    reviewWorkflow: workflow,
    review_workflow: workflow,
    application_row_version: nextVersion,
    applicationRowVersion: nextVersion,
  };
  state.casePayload = next;
  state.applicationPayload = buildApplicationPayload(next);
  return {
    success: true,
    applicationId: APPLICATION_ID,
    applicationStatus,
    application_status: applicationStatus,
    application_row_version: nextVersion,
    applicationRowVersion: nextVersion,
    reviewWorkflow: workflow,
    review_workflow: workflow,
  };
}

function applyAssessmentRecall(state) {
  const currentVersion = Number(state.casePayload.application_row_version || 0) || 0;
  const nextVersion = currentVersion + 1;
  const next = {
    ...state.casePayload,
    applicationStatus: 'in_review',
    application_status: 'in_review',
    applicationStatusRaw: 'in_review',
    application_status_raw: 'in_review',
    application_lifecycle_status: 'assessment',
    applicationLifecycleStatus: 'assessment',
    decision_outcome: null,
    decisionOutcome: null,
    application_row_version: nextVersion,
    applicationRowVersion: nextVersion,
  };
  state.casePayload = next;
  state.applicationPayload = buildApplicationPayload(next);
  return {
    success: true,
    applicationId: APPLICATION_ID,
    applicationStatus: 'in_review',
    application_status: 'in_review',
    application_row_version: nextVersion,
    applicationRowVersion: nextVersion,
    archivedDocumentIds: [701],
    eventType: 'assessment_recalled',
  };
}

async function installApiStubs(page, state) {
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      request.continue();
      return;
    }

    const requestRecord = {
      method: request.method(),
      path: url.pathname,
      search: url.search,
      postData: request.postData() || null,
    };
    state.apiCalls.push(requestRecord);

    if (request.method() === 'OPTIONS') {
      request.respond({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'authorization,x-access-token,content-type',
        },
      });
      return;
    }

    const pathname = url.pathname;
    const method = request.method();
    if (pathname === '/api/auth/me') {
      const profile = roleProfiles[state.role] || roleProfiles['System Administrator'];
      request.respond(jsonResponse({
        auth: {
          sub: CURRENT_USER_ID,
          email: profile.email,
          name: profile.name,
          role: state.role,
          groups: profile.groups,
          staffProfileId: 1,
          regionIds: [1],
        },
        profile: {
          id: 1,
          email: profile.email,
          name: profile.name,
          role: state.role,
          region_id: 1,
          region_ids: [1],
        },
      }));
      return;
    }
    if (pathname === '/api/cases/1' && method === 'GET') {
      request.respond(jsonResponse(state.casePayload));
      return;
    }
    if (pathname === '/api/cases/1' && method === 'PUT') {
      const body = parseJsonSafely(request.postData()) || {};
      state.mutations.casePuts.push({ path: `${pathname}${url.search}`, body });
      const result = applyCaseMutation(state, body);
      request.respond(jsonResponse(result, result?._status || 200));
      return;
    }
    if (pathname === '/api/cases/1/assessment/recall' && method === 'POST') {
      const body = parseJsonSafely(request.postData()) || {};
      state.mutations.assessmentRecalls.push({ path: `${pathname}${url.search}`, body });
      request.respond(jsonResponse(applyAssessmentRecall(state)));
      return;
    }
    if (pathname === '/api/cases/1/assessment/review-workflow/action' && method === 'POST') {
      const body = parseJsonSafely(request.postData()) || {};
      state.mutations.reviewActions.push({ path: `${pathname}${url.search}`, body });
      request.respond(jsonResponse(applyReviewWorkflowAction(state, body)));
      return;
    }
    if (pathname === '/api/applications/2' && method === 'GET') {
      request.respond(jsonResponse(state.applicationPayload));
      return;
    }
    if (pathname === '/api/locks/application/2' && method === 'POST') {
      request.respond(jsonResponse({
        success: true,
        lock: {
          application_id: APPLICATION_ID,
          owner_user_id: CURRENT_USER_ID,
          owner_display_name: roleProfiles[state.role]?.name || 'Program Admin',
          owner_email: roleProfiles[state.role]?.email || 'program.admin@awentech.ca',
          expires_at: lockExpiresAt,
        },
      }));
      return;
    }
    if (pathname === '/api/locks/application/2' && method === 'DELETE') {
      request.respond(jsonResponse({ released: true, lock: null }));
      return;
    }
    if (pathname === '/api/cases/1/messages' && method === 'GET') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === '/api/cases/1/messages' && method === 'POST') {
      const body = parseJsonSafely(request.postData()) || {};
      state.mutations.messagePosts.push({ path: `${pathname}${url.search}`, body });
      request.respond(jsonResponse({
        success: true,
        message: {
          id: 9001,
          case_id: CASE_ID,
          application_id: body.applicationId || null,
          subject: body.subject || '',
          body: body.body || '',
          attachments: body.attachments || [],
        },
      }));
      return;
    }
    if (pathname === '/api/access-control/matrix') {
      request.respond(jsonResponse({ default: 'allow', routes: {} }));
      return;
    }
    if (pathname === '/api/me/tutorial-progress') {
      request.respond(jsonResponse(buildDismissedTutorialProgress()));
      return;
    }
    if (pathname === '/api/me/notifications') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === '/api/me/staff-messages/counts') {
      request.respond(jsonResponse({ unread: 0, total: 0 }));
      return;
    }
    if (pathname === '/api/admin/contact-messages') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === '/api/me/staff-profiles') {
      request.respond(jsonResponse({ items: [], profiles: [] }));
      return;
    }
    if (pathname === '/api/service-announcement/current') {
      request.respond(jsonResponse({ announcement: null }));
      return;
    }
    if (pathname === '/api/config/runtime/demo-navigation') {
      request.respond(jsonResponse({ enabled: false }));
      return;
    }
    if (pathname === '/api/regions/canada') {
      request.respond(jsonResponse([{ code: 'QC', name: 'Quebec' }]));
      return;
    }
    if (pathname === '/api/config/sla-targets') {
      request.respond(jsonResponse({ targets: [] }));
      return;
    }
    if (pathname === '/api/escalations') {
      request.respond(jsonResponse({ items: [] }));
      return;
    }
    if (pathname === '/api/applications/2/watchlist-hit') {
      request.respond(jsonResponse({ hasHit: false, hit: null }));
      return;
    }
    if (pathname === `/api/applicants/${APPLICANT_USER_ID}/document-checklist`) {
      request.respond(jsonResponse(buildCompleteChecklist()));
      return;
    }
    if (pathname === `/api/applicants/${APPLICANT_USER_ID}/applications`) {
      request.respond(jsonResponse([
        {
          id: APPLICATION_ID,
          application_id: APPLICATION_ID,
          case_id: CASE_ID,
          tracking_id: 'ISET-20260508-A02882',
          status: state.casePayload.applicationStatus || state.casePayload.application_status,
          description: 'Current application',
        },
      ]));
      return;
    }
    if (pathname === `/api/applicants/${APPLICANT_USER_ID}/documents` || pathname === '/api/cases/1/documents') {
      request.respond(jsonResponse(buildDocuments()));
      return;
    }
    if (pathname === '/api/document-types') {
      request.respond(jsonResponse([
        { code: 'identity_document', label: 'Government ID', scope: 'client' },
        { code: 'acceptance_letter', label: 'Acceptance letter', scope: 'application' },
        { code: 'client_funding_agreement', label: 'Client Funding Agreement', scope: 'application' },
        { code: 'assessment_approval_letter', label: 'Assessment approval letter', scope: 'application' },
      ]));
      return;
    }
    if (pathname === '/api/cases/1/notes') {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/reminders') {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/cases/1/events') {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/workflows') {
      request.respond(jsonResponse([
        {
          id: 9001,
          workflow_type: 'consent-no-prefill',
          document_type: 'assessment_approval_letter',
        },
        {
          id: 9002,
          workflow_type: 'consent-no-prefill',
          document_type: 'assessment_denial_letter',
        },
      ]));
      return;
    }
    if (pathname === '/api/reference/intervention-codes') {
      request.respond(jsonResponse([
        { code: '4', name: 'Occupational skills training' },
      ]));
      return;
    }
    if (pathname === '/api/reference/noc-versions') {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/finance/payment-intervention-type-map') {
      request.respond(jsonResponse({ items: [] }));
      return;
    }
    if (pathname === '/api/config/runtime/assessment-costing') {
      request.respond(jsonResponse({ paymentTypes: [], payeeTypes: [] }));
      return;
    }
    if (pathname === '/api/reference/budget-pots-lite' || pathname === '/api/finance/budget-pots') {
      request.respond(jsonResponse({ items: [] }));
      return;
    }
    if (pathname === '/api/reference/noc-codes') {
      request.respond(jsonResponse({ items: [] }));
      return;
    }
    if (pathname.includes('/presign-download')) {
      request.respond(jsonResponse({ url: 'https://example.invalid/document.pdf' }));
      return;
    }

    request.respond(jsonResponse({ items: [], rows: [], total: 0, count: 0 }));
  });
}

async function installBrowserSession(page, scenario, frontendBase) {
  const session = {
    idToken: fakeJwt(scenario.role),
    accessToken: fakeJwt(scenario.role),
    refreshToken: null,
    expiresAt: Math.floor(Date.now() / 1000) + 3300,
  };
  await page.evaluateOnNewDocument((authSession, baseUrl, forceCoordinatorOnlyLayout) => {
    window.__API_BASE__ = baseUrl;
    sessionStorage.setItem('authSession', JSON.stringify(authSession));
    sessionStorage.removeItem('iset.tutorial.resetApplicationLayout');
    if (forceCoordinatorOnlyLayout) {
      localStorage.setItem('application-assessment-dashboard-layout.v2', JSON.stringify([
        { id: 'coordinator-assessment', rowSpan: 10, columnSpan: 4 },
      ]));
    } else {
      localStorage.removeItem('application-assessment-dashboard-layout.v2');
    }
  }, session, frontendBase, scenario.forceCoordinatorOnlyLayout);
}

async function visibleEnabledButtons(page, text, { exact = true, dialogOnly = false } = {}) {
  return page.evaluate(({ targetText, exactMatch, dialogOnlyValue }) => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    const root = dialogOnlyValue
      ? document.querySelector('[role="dialog"], .awsui-modal')
      : document;
    if (!root) return [];
    return Array.from(root.querySelectorAll('button, [role="button"]'))
      .filter(button => isVisible(button))
      .filter(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true')
      .map((button, index) => ({ index, text: normalize(button.innerText || button.textContent || '') }))
      .filter(button => exactMatch ? button.text === targetText : button.text.includes(targetText));
  }, { targetText: text, exactMatch: exact, dialogOnlyValue: dialogOnly });
}

async function clickButtonByText(page, text, options = {}) {
  const clicked = await page.evaluate(({ targetText, exactMatch, dialogOnlyValue, preferLast }) => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    const root = dialogOnlyValue
      ? document.querySelector('[role="dialog"], .awsui-modal')
      : document;
    if (!root) return false;
    const buttons = Array.from(root.querySelectorAll('button, [role="button"]'))
      .filter(button => isVisible(button))
      .filter(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true');
    const matches = buttons.filter(button => {
      const label = normalize(button.innerText || button.textContent || '');
      return exactMatch ? label === targetText : label.includes(targetText);
    });
    const target = preferLast ? matches[matches.length - 1] : matches[0];
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return true;
  }, {
    targetText: text,
    exactMatch: options.exact !== false,
    dialogOnlyValue: Boolean(options.dialogOnly),
    preferLast: Boolean(options.preferLast),
  });
  if (!clicked) {
    const available = await visibleEnabledButtons(page, text, options);
    throw new Error(`Could not click button "${text}". Matching visible enabled buttons: ${JSON.stringify(available)}`);
  }
}

async function waitForButtonEnabled(page, text, options = {}) {
  await page.waitForFunction(({ targetText, exactMatch, dialogOnlyValue }) => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    const root = dialogOnlyValue
      ? document.querySelector('[role="dialog"], .awsui-modal')
      : document;
    if (!root) return false;
    return Array.from(root.querySelectorAll('button, [role="button"]')).some(button => {
      if (!isVisible(button) || button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
      const label = normalize(button.innerText || button.textContent || '');
      return exactMatch ? label === targetText : label.includes(targetText);
    });
  }, {}, {
    targetText: text,
    exactMatch: options.exact !== false,
    dialogOnlyValue: Boolean(options.dialogOnly),
  });
}

async function clickRadioByLabel(page, text) {
  const clicked = await page.evaluate(targetText => {
    const isVisible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const radios = Array.from(document.querySelectorAll('[role="radio"], input[type="radio"]'))
      .filter(radio => isVisible(radio));
    for (const radio of radios) {
      let node = radio;
      for (let depth = 0; depth < 8 && node; depth += 1) {
        const label = normalize(node.innerText || node.textContent || '');
        if (label.includes(targetText)) {
          radio.scrollIntoView({ block: 'center', inline: 'center' });
          radio.click();
          return true;
        }
        node = node.parentElement;
      }
    }
    const textNode = Array.from(document.querySelectorAll('label, span, div, p'))
      .filter(element => isVisible(element))
      .find(element => normalize(element.innerText || element.textContent || '').includes(targetText));
    if (!textNode) return false;
    const row = textNode.closest('label, [class*="radio"], [class*="control"], div') || textNode.parentElement;
    const control = row?.querySelector?.('[role="radio"], input[type="radio"]');
    if (!control) return false;
    control.scrollIntoView({ block: 'center', inline: 'center' });
    control.click();
    return true;
  }, text);
  if (!clicked) {
    throw new Error(`Could not click radio option containing "${text}"`);
  }
}

async function fillFirstVisibleTextarea(page, value) {
  const filled = await page.evaluate(text => {
    const isVisible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    const textarea = Array.from(document.querySelectorAll('textarea')).find(isVisible);
    if (!textarea) return false;
    textarea.scrollIntoView({ block: 'center', inline: 'center' });
    textarea.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(textarea, text);
    } else {
      textarea.value = text;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, value);
  if (!filled) {
    throw new Error('Could not find a visible textarea to fill.');
  }
}

async function waitForText(page, text, timeout = 45_000) {
  await page.waitForFunction(
    targetText => Boolean(document.body && document.body.innerText.includes(targetText)),
    { timeout },
    text
  );
}

async function waitForWorkspaceReady(page, expectedText) {
  await waitForText(page, 'Application Assessment');
  if (expectedText) {
    await waitForText(page, expectedText);
  }
  await delay(1000);
}

async function advanceCoordinatorWizardToReview(page, submitButtonText = 'Submit assessment') {
  await waitForText(page, 'Assess Eligibility');
  for (let index = 0; index < 11; index += 1) {
    await waitForButtonEnabled(page, 'Next');
    await clickButtonByText(page, 'Next');
    await delay(index === 9 ? 1000 : 350);
    if (index === 9) {
      await waitForText(page, 'All required checklist items are complete.');
    }
  }
  await waitForButtonEnabled(page, submitButtonText);
}

function approvalEntryPath(step) {
  return `${FRONTEND_CASE_PATH}&entry=approval&approvalType=application&step=${encodeURIComponent(step)}`;
}

function buildScenarios() {
  return [
    {
      name: 'conflict-declaration',
      role: 'ISET Coordinator',
      path: FRONTEND_CASE_PATH,
      forceCoordinatorOnlyLayout: true,
      casePayload: buildCasePayload({
        status: 'submitted',
        applicationStatus: 'submitted',
        conflictSigned: false,
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Conflict of Interest Declaration');
        await clickRadioByLabel(page, 'I do not have any actual, potential, or perceived conflict of interest');
        await waitForButtonEnabled(page, 'Sign and Continue');
        await clickButtonByText(page, 'Sign and Continue');
        const declarationPut = await waitUntil(
          () => state.mutations.casePuts.find(entry => entry.body.assessment_conflict_declaration_signed === true),
          'conflict declaration PUT'
        );
        if (declarationPut.body.assessment_conflict_declaration_choice !== 'no_conflict') {
          throw new Error('Conflict declaration did not persist the no-conflict choice.');
        }
        if (declarationPut.body.applicationStatus !== 'in_review') {
          throw new Error('Conflict declaration on a submitted application did not promote it to in_review.');
        }
        if (declarationPut.body.expectedRowVersion !== 7) {
          throw new Error(`Conflict declaration sent wrong expectedRowVersion: ${declarationPut.body.expectedRowVersion}`);
        }
        await waitForText(page, 'Assess Eligibility');
      },
    },
    {
      name: 'coordinator-submit',
      role: 'ISET Coordinator',
      path: FRONTEND_CASE_PATH,
      forceCoordinatorOnlyLayout: true,
      casePayload: buildCasePayload({
        status: 'in_review',
        applicationStatus: 'in_review',
        completeAssessment: true,
        conflictSigned: true,
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Assess Eligibility');
        await advanceCoordinatorWizardToReview(page);
        await clickButtonByText(page, 'Submit assessment');
        const submitPut = await waitUntil(
          () => state.mutations.casePuts.find(entry => entry.body.applicationStatus === 'pending_approval'),
          'assessment submit PUT'
        );
        if (submitPut.body.status !== 'intake') {
          throw new Error(`Coordinator submit sent wrong case status: ${submitPut.body.status}`);
        }
        if (!submitPut.body.assessment_recommendation || !submitPut.body.assessment_justification) {
          throw new Error('Coordinator submit did not include recommendation and justification.');
        }
        if (!submitPut.body.assessment_date_of_assessment) {
          throw new Error('Coordinator submit did not stamp the date of assessment.');
        }
        if (submitPut.body.expectedRowVersion !== 7) {
          throw new Error(`Coordinator submit sent wrong expectedRowVersion: ${submitPut.body.expectedRowVersion}`);
        }
        if (!Array.isArray(submitPut.body.assessment_proposed_interventions) || submitPut.body.assessment_proposed_interventions.length !== 1) {
          throw new Error('Coordinator submit did not include the proposed intervention payload.');
        }
        await waitForText(page, 'Assessment submitted successfully');
      },
    },
    {
      name: 'coordinator-submit-two-step-assessment',
      role: 'ISET Coordinator',
      path: FRONTEND_CASE_PATH,
      forceCoordinatorOnlyLayout: true,
      casePayload: buildCasePayload({
        status: 'in_review',
        applicationStatus: 'in_review',
        completeAssessment: true,
        conflictSigned: true,
        twoStepReviewEnabled: true,
        reviewWorkflow: null,
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Assess Eligibility');
        await advanceCoordinatorWizardToReview(page, 'Submit for review');
        await clickButtonByText(page, 'Submit for review');
        const submitPut = await waitUntil(
          () => state.mutations.casePuts.find(entry => entry.body.applicationStatus === 'pending_approval'),
          'Coordinator two-step assessment submit PUT'
        );
        if (submitPut.body.status !== 'intake') {
          throw new Error(`Coordinator two-step submit sent wrong case status: ${submitPut.body.status}`);
        }
        if (state.casePayload.reviewWorkflow?.currentStage !== REVIEW_STAGES.rmReview) {
          throw new Error(`Coordinator two-step submit did not create an RM review workflow: ${state.casePayload.reviewWorkflow?.currentStage}`);
        }
        await waitForText(page, 'Assessment submitted to Regional Manager review.');
      },
    },
    {
      name: 'regional-manager-submit-draft-assessment',
      role: 'Regional Manager',
      path: FRONTEND_CASE_PATH,
      forceCoordinatorOnlyLayout: true,
      casePayload: buildCasePayload({
        status: 'intake',
        applicationStatus: 'in_review',
        completeAssessment: true,
        conflictSigned: true,
        twoStepReviewEnabled: true,
        reviewWorkflow: null,
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Assess Eligibility');
        await advanceCoordinatorWizardToReview(page, 'Submit for review');
        await clickButtonByText(page, 'Submit for review');
        const submitPut = await waitUntil(
          () => state.mutations.casePuts.find(entry => entry.body.applicationStatus === 'pending_approval'),
          'Regional Manager draft assessment submit PUT'
        );
        if (submitPut.body.status !== 'intake') {
          throw new Error(`RM draft submit sent wrong case status: ${submitPut.body.status}`);
        }
        if (!submitPut.body.assessment_recommendation || !submitPut.body.assessment_justification) {
          throw new Error('RM draft submit did not include recommendation and justification.');
        }
        if (!submitPut.body.assessment_date_of_assessment) {
          throw new Error('RM draft submit did not stamp the date of assessment.');
        }
        if (submitPut.body.expectedRowVersion !== 7) {
          throw new Error(`RM draft submit sent wrong expectedRowVersion: ${submitPut.body.expectedRowVersion}`);
        }
        if (state.casePayload.reviewWorkflow?.currentStage !== REVIEW_STAGES.rmReview) {
          throw new Error(`RM draft submit did not create an RM review workflow: ${state.casePayload.reviewWorkflow?.currentStage}`);
        }
        await waitForText(page, 'Assessment submitted to Regional Manager review.');
      },
    },
    {
      name: 'regional-manager-edit-returned-assessment-as-original-submitter',
      role: 'Regional Manager',
      path: FRONTEND_CASE_PATH,
      forceCoordinatorOnlyLayout: true,
      casePayload: buildCasePayload({
        status: 'intake',
        applicationStatus: 'in_review',
        completeAssessment: true,
        conflictSigned: true,
        twoStepReviewEnabled: true,
        reviewWorkflow: buildReviewWorkflow(REVIEW_STAGES.returnedToSubmitter, {
          submittedByStaffProfileId: 1,
          submitted_by_staff_profile_id: 1,
          rmReviewNote: 'Please clarify the training rationale before approval.',
          rm_review_note: 'Please clarify the training rationale before approval.',
        }),
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Assess Eligibility');
        await waitForButtonEnabled(page, 'Next');
        await clickButtonByText(page, 'Next');
        await waitForText(page, 'What is being proposed?');
        await waitForButtonEnabled(page, 'Next');
        await clickButtonByText(page, 'Next');
        await waitForText(page, 'Why is this intervention needed?');

        const overviewInput = await page.evaluate(() => {
          const textareas = Array.from(document.querySelectorAll('textarea'));
          const visible = textareas.find(element => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          });
          if (!visible) return null;
          return {
            readOnly: visible.readOnly,
            disabled: visible.disabled,
            value: visible.value,
          };
        });
        if (!overviewInput || overviewInput.readOnly || overviewInput.disabled) {
          throw new Error(`Returned assessment remained read-only for its Regional Manager submitter: ${JSON.stringify(overviewInput)}`);
        }

        const revisedOverview = `${overviewInput.value} Clarified after Regional Manager review.`;
        await page.evaluate(value => {
          const textareas = Array.from(document.querySelectorAll('textarea'));
          const visible = textareas.find(element => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          });
          if (!visible) throw new Error('Visible returned-assessment overview textarea was not found.');
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          setter.call(visible, value);
          visible.dispatchEvent(new Event('input', { bubbles: true }));
          visible.dispatchEvent(new Event('change', { bubbles: true }));
        }, revisedOverview);
        await waitForButtonEnabled(page, 'Save Progress');
        await clickButtonByText(page, 'Save Progress');

        const savePut = await waitUntil(
          () => state.mutations.casePuts.find(entry => entry.body.case_summary === revisedOverview),
          'returned Regional Manager assessment save PUT'
        );
        if (savePut.body.applicationId !== APPLICATION_ID) {
          throw new Error(`Returned assessment save used wrong applicationId: ${savePut.body.applicationId}`);
        }
        if (savePut.body.expectedRowVersion !== 7) {
          throw new Error(`Returned assessment save sent wrong expectedRowVersion: ${savePut.body.expectedRowVersion}`);
        }
        if (state.casePayload.reviewWorkflow?.currentStage !== REVIEW_STAGES.returnedToSubmitter) {
          throw new Error(`Returned assessment save changed workflow stage: ${state.casePayload.reviewWorkflow?.currentStage}`);
        }
        await waitForText(page, 'Assessment saved successfully');
      },
    },
    {
      name: 'coordinator-recall-pending-assessment',
      role: 'ISET Coordinator',
      path: FRONTEND_CASE_PATH,
      forceCoordinatorOnlyLayout: true,
      casePayload: buildCasePayload({
        status: 'intake',
        applicationStatus: 'pending_approval',
        completeAssessment: true,
        conflictSigned: true,
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Recall submission');
        const editableButtons = [
          ...(await visibleEnabledButtons(page, 'Save Progress')),
          ...(await visibleEnabledButtons(page, 'Edit')),
        ];
        if (editableButtons.length) {
          throw new Error(`Pending assessment exposed edit controls: ${JSON.stringify(editableButtons)}`);
        }
        await waitForButtonEnabled(page, 'Recall submission');
        await clickButtonByText(page, 'Recall submission');
        await waitForText(page, 'Recall assessment submission?');
        await clickButtonByText(page, 'Recall submission', { preferLast: true });
        const recallPost = await waitUntil(
          () => state.mutations.assessmentRecalls[0],
          'assessment recall POST'
        );
        if (recallPost.body.applicationId !== APPLICATION_ID) {
          throw new Error(`Recall used wrong applicationId: ${recallPost.body.applicationId}`);
        }
        if (recallPost.body.expectedRowVersion !== 7) {
          throw new Error(`Recall sent wrong expectedRowVersion: ${recallPost.body.expectedRowVersion}`);
        }
        await waitForText(page, 'Assessment submission recalled. You can make corrections and submit it again when ready.');
        await waitForText(page, 'Submit assessment');
      },
    },
    {
      name: 'regional-manager-return-to-coordinator',
      role: 'Regional Manager',
      path: approvalEntryPath('decision'),
      casePayload: buildCasePayload({
        status: 'intake',
        applicationStatus: 'pending_approval',
        completeAssessment: true,
        conflictSigned: true,
        twoStepReviewEnabled: true,
        reviewWorkflow: buildReviewWorkflow(REVIEW_STAGES.rmReview),
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Regional Manager review');
        const commitButtons = await visibleEnabledButtons(page, 'Commit');
        if (commitButtons.length) {
          throw new Error(`RM review exposed final Commit control: ${JSON.stringify(commitButtons)}`);
        }
        await waitForText(page, 'Return to Coordinator');
        await fillFirstVisibleTextarea(page, 'Please clarify the training rationale before approval.');
        await clickButtonByText(page, 'Return to Coordinator');
        const reviewAction = await waitUntil(
          () => state.mutations.reviewActions.find(entry => entry.body.action === REVIEW_ACTIONS.rmReturnToSubmitter),
          'RM return review action POST'
        );
        if (reviewAction.body.applicationId !== APPLICATION_ID) {
          throw new Error(`RM return used wrong applicationId: ${reviewAction.body.applicationId}`);
        }
        if (reviewAction.body.expectedRowVersion !== 7) {
          throw new Error(`RM return sent wrong expectedRowVersion: ${reviewAction.body.expectedRowVersion}`);
        }
        if (!String(reviewAction.body.note || '').includes('training rationale')) {
          throw new Error('RM return did not send review notes.');
        }
        await waitForText(page, 'Assessment returned to the Coordinator with notes.');
      },
    },
    {
      name: 'regional-manager-submit-to-nwac',
      role: 'Regional Manager',
      path: approvalEntryPath('decision'),
      casePayload: buildCasePayload({
        status: 'intake',
        applicationStatus: 'pending_approval',
        completeAssessment: true,
        conflictSigned: true,
        twoStepReviewEnabled: true,
        reviewWorkflow: buildReviewWorkflow(REVIEW_STAGES.rmReview),
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Regional Manager review');
        await waitForText(page, 'Submit for final decision');
        await fillFirstVisibleTextarea(page, 'I agree with this recommendation - signed the Regional Manager.');
        await clickButtonByText(page, 'Submit for final decision');
        const reviewAction = await waitUntil(
          () => state.mutations.reviewActions.find(entry => entry.body.action === REVIEW_ACTIONS.rmSubmitToNwac),
          'RM submit-to-NWAC review action POST'
        );
        if (reviewAction.body.applicationId !== APPLICATION_ID) {
          throw new Error(`RM submit used wrong applicationId: ${reviewAction.body.applicationId}`);
        }
        if (reviewAction.body.expectedRowVersion !== 7) {
          throw new Error(`RM submit sent wrong expectedRowVersion: ${reviewAction.body.expectedRowVersion}`);
        }
        if (!String(reviewAction.body.note || '').includes('signed the Regional Manager')) {
          throw new Error('RM submit did not send review notes.');
        }
        await waitForText(page, 'Assessment submitted for final decision.');
        await waitForText(page, 'Regional Manager review note');
        await waitForText(page, 'I agree with this recommendation - signed the Regional Manager.');
      },
    },
    {
      name: 'nwac-request-changes-to-rm',
      role: 'System Administrator',
      path: approvalEntryPath('decision'),
      casePayload: buildCasePayload({
        status: 'intake',
        applicationStatus: 'pending_approval',
        completeAssessment: true,
        conflictSigned: true,
        nwacReviewStatus: 'push_back',
        nwacReview: '',
        nwacReason: 'Please add the missing funding-source explanation.',
        twoStepReviewEnabled: true,
        reviewWorkflow: buildReviewWorkflow(REVIEW_STAGES.nwacReview, {
          rmReviewedByStaffProfileId: 1,
          rm_reviewed_by_staff_profile_id: 1,
          rmReviewedAt: '2026-06-19T13:10:00.000Z',
          rm_reviewed_at: '2026-06-19T13:10:00.000Z',
        }),
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Ready for Decision Maker');
        await waitForButtonEnabled(page, 'Commit');
        await clickButtonByText(page, 'Commit');
        const decisionPut = await waitUntil(
          () => state.mutations.casePuts.find(entry => entry.body.assessment_nwac_review_status === 'push_back'),
          'NWAC request-changes PUT'
        );
        if (decisionPut.body.applicationStatus !== 'in_review') {
          throw new Error(`NWAC request-changes UI sent unexpected applicationStatus: ${decisionPut.body.applicationStatus}`);
        }
        if (!String(decisionPut.body.assessment_nwac_reason || '').includes('funding-source')) {
          throw new Error('NWAC request-changes did not send the change note.');
        }
        await waitForText(page, 'Changes requested by the Decision Maker and returned to Regional Manager review.');
        if (state.casePayload.applicationStatus !== 'pending_approval') {
          throw new Error(`Two-step pushback should stay pending with RM, got ${state.casePayload.applicationStatus}`);
        }
        if (state.casePayload.reviewWorkflow?.currentStage !== REVIEW_STAGES.returnedToRm) {
          throw new Error(`Two-step pushback did not move workflow to returned_to_rm: ${state.casePayload.reviewWorkflow?.currentStage}`);
        }
      },
    },
    {
      name: 'regional-manager-forward-nwac-changes',
      role: 'Regional Manager',
      path: approvalEntryPath('decision'),
      casePayload: buildCasePayload({
        status: 'intake',
        applicationStatus: 'pending_approval',
        completeAssessment: true,
        conflictSigned: true,
        twoStepReviewEnabled: true,
        reviewWorkflow: buildReviewWorkflow(REVIEW_STAGES.returnedToRm, {
          nwacDecision: 'changes_requested',
          nwac_decision: 'changes_requested',
          nwacDecisionNote: 'Please add the missing funding-source explanation.',
          nwac_decision_note: 'Please add the missing funding-source explanation.',
        }),
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Decision Maker requested changes');
        await waitForText(page, 'Decision Maker requested changes');
        const submitToNwacVisible = await page.evaluate(() => {
          const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
          const isVisible = element => {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none';
          };
          return Array.from(document.querySelectorAll('button, [role="button"]')).some(button => (
            isVisible(button) &&
            normalize(button.innerText || button.textContent || '') === 'Submit for final decision'
          ));
        });
        if (submitToNwacVisible) {
          throw new Error('Returned-to-RM review should not offer Submit for final decision.');
        }
        await fillFirstVisibleTextarea(page, 'Coordinator, please address the funding-source explanation.');
        await clickButtonByText(page, 'Forward changes to Coordinator');
        const reviewAction = await waitUntil(
          () => state.mutations.reviewActions.find(entry => entry.body.action === REVIEW_ACTIONS.rmForwardChangesToSubmitter),
          'RM forward-changes review action POST'
        );
        if (reviewAction.body.applicationId !== APPLICATION_ID) {
          throw new Error(`RM forward used wrong applicationId: ${reviewAction.body.applicationId}`);
        }
        if (reviewAction.body.expectedRowVersion !== 7) {
          throw new Error(`RM forward sent wrong expectedRowVersion: ${reviewAction.body.expectedRowVersion}`);
        }
        if (!String(reviewAction.body.note || '').includes('funding-source')) {
          throw new Error('RM forward did not send review notes.');
        }
        await waitForText(page, 'Requested changes forwarded to the Coordinator.');
        if (state.casePayload.applicationStatus !== 'in_review') {
          throw new Error(`RM forward should reopen coordinator editing, got ${state.casePayload.applicationStatus}`);
        }
      },
    },
    {
      name: 'nwac-approval-decision',
      role: 'System Administrator',
      path: approvalEntryPath('decision'),
      casePayload: buildCasePayload({
        status: 'intake',
        applicationStatus: 'pending_approval',
        completeAssessment: true,
        conflictSigned: true,
        nwacReviewStatus: 'approve',
        nwacReview: 'agree',
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Approval and decision');
        await waitForButtonEnabled(page, 'Commit');
        await clickButtonByText(page, 'Commit');
        const decisionPut = await waitUntil(
          () => state.mutations.casePuts.find(entry => entry.body.applicationStatus === 'approved'),
          'NWAC approval decision PUT'
        );
        if (!decisionPut.body.assessment_submit_action) {
          throw new Error('NWAC approval did not include assessment_submit_action.');
        }
        if (decisionPut.body.status !== 'initiated') {
          throw new Error(`NWAC approval sent wrong case status: ${decisionPut.body.status}`);
        }
        if (decisionPut.body.assessment_nwac_review_status !== 'approve') {
          throw new Error('NWAC approval did not persist the approve funding outcome.');
        }
        if (decisionPut.body.expectedRowVersion !== 7) {
          throw new Error(`NWAC approval sent wrong expectedRowVersion: ${decisionPut.body.expectedRowVersion}`);
        }
        await waitForText(page, 'Application marked as approved');
      },
    },
    {
      name: 'approval-letter-send',
      role: 'System Administrator',
      path: approvalEntryPath('communication'),
      casePayload: buildCasePayload({
        status: 'initiated',
        applicationStatus: 'approved',
        completeAssessment: true,
        conflictSigned: true,
        nwacReviewStatus: 'approve',
        nwacReview: 'agree',
        decisionOutcome: 'approved',
        caseContext: buildApplicationScopedContext({
          decisionLetterDrafts: {
            approval: buildApprovalLetterDraft(),
          },
          decisionLetterPackDrafts: {
            approval: {
              generated_at: '2026-06-10T10:00:00.000Z',
              institutionLetters: [],
              coFunderLetters: [],
              loanProviderLetters: [],
            },
          },
        }),
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Approval letters');
        await waitForText(page, 'Decision letter');
        await waitForButtonEnabled(page, 'Send Client Approval letter');
        await clickButtonByText(page, 'Send Client Approval letter');
        await waitForText(page, 'Send Client Approval letter?');
        await waitForButtonEnabled(page, 'Send Client Approval letter');
        await clickButtonByText(page, 'Send Client Approval letter', { preferLast: true });
        const messagePost = await waitUntil(
          () => state.mutations.messagePosts.find(entry => entry.body.subject === 'Letter of Approval'),
          'approval letter secure-message POST'
        );
        if (messagePost.body.applicationId !== APPLICATION_ID) {
          throw new Error(`Approval letter message used wrong applicationId: ${messagePost.body.applicationId}`);
        }
        if (!Array.isArray(messagePost.body.attachments) || messagePost.body.attachments[0]?.workflow_id !== 9001) {
          throw new Error('Approval letter message did not attach the approval workflow.');
        }
        const sentMarkerPut = await waitUntil(
          () => state.mutations.casePuts.find(entry =>
            entry.body.caseContext?.applicationDecisionLetters?.[String(APPLICATION_ID)]?.decisionLetterSent?.approval
          ),
          'application-scoped approval decisionLetterSent PUT'
        );
        const scopedContext = sentMarkerPut.body.caseContext.applicationDecisionLetters[String(APPLICATION_ID)];
        if (!scopedContext.decisionLetterDrafts?.approval) {
          throw new Error('Approval letter sent-marker PUT lost the application-scoped letter draft.');
        }
        if (sentMarkerPut.body.caseContext.decisionLetterSent) {
          throw new Error('Approval letter sent-marker PUT leaked decisionLetterSent at the root case context.');
        }
        await waitForText(page, 'Decision letter sent to the applicant.');
      },
    },
    {
      name: 'funding-docs-completion',
      role: 'System Administrator',
      path: approvalEntryPath('fundingDocs'),
      casePayload: buildCasePayload({
        status: 'initiated',
        applicationStatus: 'approved',
        completeAssessment: true,
        conflictSigned: true,
        nwacReviewStatus: 'approve',
        nwacReview: 'agree',
        decisionOutcome: 'approved',
        caseContext: buildApplicationScopedContext({
          decisionLetterDrafts: {
            approval: buildApprovalLetterDraft(),
          },
          decisionLetterSent: {
            approval: '2026-06-10T10:15:00.000Z',
          },
        }),
      }),
      run: async ({ page, state }) => {
        await waitForWorkspaceReady(page, 'Funding forms and signatures');
        await waitForText(page, 'Funding forms checklist');
        await waitForText(page, 'All required items are complete.');
        await waitForButtonEnabled(page, 'Mark application complete');
        await clickButtonByText(page, 'Mark application complete');
        const completionPut = await waitUntil(
          () => state.mutations.casePuts.find(entry => entry.body.applicationStatus === 'completed'),
          'funding docs completion PUT'
        );
        if (completionPut.body.expectedRowVersion !== 7) {
          throw new Error(`Funding docs completion sent wrong expectedRowVersion: ${completionPut.body.expectedRowVersion}`);
        }
        await waitForText(page, 'All required funding forms are complete. Application marked as completed.');
      },
    },
  ];
}

async function runScenario(browser, args, scenario) {
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  await page.setViewport({ width: 1360, height: 940, deviceScaleFactor: 1 });

  const state = {
    name: scenario.name,
    role: scenario.role,
    casePayload: scenario.casePayload,
    applicationPayload: buildApplicationPayload(scenario.casePayload),
    apiCalls: [],
    mutations: {
      casePuts: [],
      assessmentRecalls: [],
      reviewActions: [],
      messagePosts: [],
    },
    consoleLines: [],
    failures: [],
  };

  page.on('pageerror', error => state.failures.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => {
    const text = message.text();
    const snippet = text.slice(0, CONSOLE_SNIPPET_LIMIT);
    state.consoleLines.push({ type: message.type(), text: snippet });
    if (/ReferenceError|TypeError|Unhandled|Cannot update a component|Failed to load|failed with status|ERR_FAILED|CORS/i.test(text)) {
      state.failures.push({ type: 'console', level: message.type(), text: snippet });
    }
  });
  page.on('requestfailed', request => {
    if (request.url().includes('/api/')) {
      state.failures.push({
        type: 'requestfailed',
        method: request.method(),
        url: request.url(),
        failure: request.failure()?.errorText || null,
      });
    }
  });
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      state.failures.push({ type: 'api', status: response.status(), url: response.url() });
    }
  });

  await installApiStubs(page, state);
  await installBrowserSession(page, scenario, args.frontendBase);

  const targetUrl = `${args.frontendBase}${scenario.path}`;
  const screenshotPath = path.join(args.screenshotDir, `${scenario.name}.png`);
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await scenario.run({ page, state });
    await delay(800);
    await page.evaluate(() => {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (error) {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    state.failures.push({ type: 'scenario', message: error.message, stack: error.stack });
  } finally {
    await page.close().catch(() => {});
  }

  return {
    name: scenario.name,
    pass: state.failures.length === 0,
    screenshot: screenshotPath,
    apiCallCount: state.apiCalls.length,
    casePutCount: state.mutations.casePuts.length,
    assessmentRecallCount: state.mutations.assessmentRecalls.length,
    reviewActionCount: state.mutations.reviewActions.length,
    messagePostCount: state.mutations.messagePosts.length,
    failures: state.failures,
    apiCalls: state.apiCalls.map(call => `${call.method} ${call.path}${call.search}`),
    casePuts: state.mutations.casePuts.map(entry => entry.body),
    assessmentRecalls: state.mutations.assessmentRecalls.map(entry => entry.body),
    reviewActions: state.mutations.reviewActions.map(entry => entry.body),
    messagePosts: state.mutations.messagePosts.map(entry => entry.body),
    consoleWarnings: state.consoleLines.filter(line => line.type === 'warning' || line.type === 'error').slice(-10),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.screenshotDir, { recursive: true });
  ensureLocalChromeLibraryPath();

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: findChromeExecutable(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];
  try {
    for (const scenario of buildScenarios()) {
      results.push(await runScenario(browser, args, scenario));
    }
  } finally {
    await browser.close();
  }

  const pass = results.every(result => result.pass);
  const summary = {
    pass,
    screenshotDir: args.screenshotDir,
    scenarios: results,
  };
  if (!pass) {
    console.error(JSON.stringify(summary, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
