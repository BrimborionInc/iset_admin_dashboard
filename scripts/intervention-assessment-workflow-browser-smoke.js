#!/usr/bin/env node
/*
 * DEV browser smoke for high-risk Intervention Assessment workflow paths.
 *
 * This loads the real local Case Workspace bundle with deterministic mocked API
 * data and verifies the Regional Manager two-step review paths for new
 * intervention proposals and intervention revisions, including post-approval
 * letter follow-up entry points.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const {
  REVIEW_ACTIONS: REVIEW_WORKFLOW_ACTIONS,
  getReviewTransition,
} = require('../src/lib/reviewWorkflow');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'intervention-assessment-workflow-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';
const CONSOLE_SNIPPET_LIMIT = 1500;

const CASE_ID = 1;
const APPLICATION_ID = 2;
const APPLICANT_USER_ID = 42;
const ACTION_PLAN_ID = 10;
const PROPOSAL_ID = 101;
const REVISION_ID = 102;
const SOURCE_INTERVENTION_ID = 201;
const SOURCE_TITLE = '3 - Employment counselling';
const INTERVENTION_WIDGET_SELECTOR = '#intervention-assessment-widget';
const NON_POLLING_REFERENCE_PATHS = [
  '/api/reference/intervention-codes',
  '/api/reference/noc-versions',
];

const STAFF_PROFILE_IDS = {
  coordinatorSubmitter: 1,
  regionalManagerSubmitter: 2,
  decisionMaker: 3,
  otherCoordinator: 4,
  otherRegionalManager: 5,
  systemAdministrator: 6,
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

const roleProfiles = {
  'ISET Coordinator': {
    email: 'quebec.coordinator.1@awentech.ca',
    name: 'Quebec Coordinator',
    groups: ['ISET_Coordinator'],
    staffProfileId: STAFF_PROFILE_IDS.coordinatorSubmitter,
  },
  'Regional Manager': {
    email: 'quebec.manager@awentech.ca',
    name: 'Quebec Regional Manager',
    groups: ['Regional_Manager'],
    staffProfileId: STAFF_PROFILE_IDS.regionalManagerSubmitter,
  },
  'NWAC Administrator': {
    email: 'program.admin@awentech.ca',
    name: 'Decision Maker',
    groups: ['NWAC_Administrator'],
    staffProfileId: STAFF_PROFILE_IDS.decisionMaker,
  },
  'System Administrator': {
    email: 'system.admin@awentech.ca',
    name: 'System Administrator',
    groups: ['System_Administrator'],
    staffProfileId: STAFF_PROFILE_IDS.systemAdministrator,
  },
};

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.INTERVENTION_ASSESSMENT_WORKFLOW_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.INTERVENTION_ASSESSMENT_WORKFLOW_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
    scenarioNames: new Set(
      String(process.env.INTERVENTION_ASSESSMENT_WORKFLOW_SMOKE_SCENARIOS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
    ),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--frontend-base') {
      args.frontendBase = argv[index + 1] || args.frontendBase;
      index += 1;
    } else if (token === '--screenshot-dir') {
      args.screenshotDir = argv[index + 1] || args.screenshotDir;
      index += 1;
    } else if (token === '--scenario') {
      String(argv[index + 1] || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .forEach(value => args.scenarioNames.add(value));
      index += 1;
    } else if (token === '--help' || token === '-h') {
      console.log([
        'Usage: node scripts/intervention-assessment-workflow-browser-smoke.js [options]',
        '',
        'Options:',
        '  --frontend-base URL     React app origin. Default: http://localhost:3001',
        '  --screenshot-dir DIR    Directory for browser screenshots.',
        '  --scenario NAMES        Comma-separated scenario names. Default: all.',
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

function fakeJwt(role, profileOverride = null) {
  const profile = profileOverride || roleProfiles[role] || roleProfiles['ISET Coordinator'];
  const issuedAt = Math.floor(Date.now() / 1000);
  return [
    base64UrlEncode({ alg: 'none', typ: 'JWT' }),
    base64UrlEncode({
      sub: `smoke-${String(role || 'user').toLowerCase().replace(/\s+/g, '-')}`,
      email: profile.email,
      name: profile.name,
      role,
      'cognito:groups': profile.groups,
      staffProfileId: profile.staffProfileId,
      staff_profile_id: profile.staffProfileId,
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
    const result = await predicate();
    if (result) return result;
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function countApiCallsByPath(state, paths) {
  return Object.fromEntries(paths.map(pathname => [
    pathname,
    state.apiCalls.filter(call => call.path === pathname).length,
  ]));
}

async function assertNonPollingReferenceCallsSettle(state, timeoutMs = 5_000, quietMs = 750) {
  const startedAt = Date.now();
  let lastCounts = countApiCallsByPath(state, NON_POLLING_REFERENCE_PATHS);
  let unchangedSince = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await delay(100);
    const nextCounts = countApiCallsByPath(state, NON_POLLING_REFERENCE_PATHS);
    if (JSON.stringify(nextCounts) !== JSON.stringify(lastCounts)) {
      lastCounts = nextCounts;
      unchangedSince = Date.now();
      continue;
    }
    if (Date.now() - unchangedSince >= quietMs) return lastCounts;
  }

  throw new Error(
    `Non-polling reference requests did not settle: ${JSON.stringify(lastCounts)}`
  );
}

function buildCostLine(amount = 150) {
  return {
    id: `cost-${amount}`,
    label: 'Tuition',
    paymentType: 'tuition',
    payeeType: 'institution',
    payeeName: 'Example College',
    amount: String(amount),
    notes: '',
  };
}

function buildProposedIntervention({ amount = 150 } = {}) {
  return {
    id: `proposal-line-${amount}`,
    code: '3',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    deliveryMode: 'partner',
    institution: 'Example College',
    programName: 'Employment counselling',
    itpDetails: 'Counselling plan and employment readiness supports are documented.',
    wageSubsidyDetails: '',
    interventionNoc: '',
    interventionNocVersion: '',
    suggestionsSeeded: true,
    costLines: [buildCostLine(amount)],
  };
}

function buildReviewWorkflow(stage, overrides = {}) {
  const submittedByStaffProfileId = overrides.submittedByStaffProfileId || STAFF_PROFILE_IDS.coordinatorSubmitter;
  const submittedByRole = overrides.submittedByRole || 'ISET Coordinator';
  const currentOwnerRole = stage === REVIEW_STAGES.nwacReview
    ? 'NWAC Administrator'
    : stage === REVIEW_STAGES.returnedToSubmitter
      ? submittedByRole
      : 'Regional Manager';
  return {
    id: overrides.id || 501,
    workflowType: overrides.workflowType || 'intervention_proposal',
    workflow_type: overrides.workflowType || 'intervention_proposal',
    currentStage: stage,
    current_stage: stage,
    currentOwnerRole,
    current_owner_role: currentOwnerRole,
    submittedByStaffProfileId,
    submitted_by_staff_profile_id: submittedByStaffProfileId,
    submittedByRole,
    submitted_by_role: submittedByRole,
    rmReviewNote: overrides.rmReviewNote || '',
    rm_review_note: overrides.rmReviewNote || '',
    nwacDecisionNote: overrides.nwacDecisionNote || '',
    nwac_decision_note: overrides.nwacDecisionNote || '',
    submittedAt: '2026-06-19T16:00:00.000Z',
    submitted_at: '2026-06-19T16:00:00.000Z',
  };
}

function buildMetadata({ amount = 150, isRevision = false, review = {}, lastAppliedRevision = null, approvalLetterFollowUp = null } = {}) {
  const metadata = {
    rationale: 'Goals go here\nBarriers: Other',
    otherFundingDetails: { involved: 'no', sources: [], nwacCoverage: '', notes: '' },
    childcareNeed: 'no',
    childcareFunding: '',
    barriers: ['other'],
    proposedInterventions: [buildProposedIntervention({ amount })],
    review: {
      eiStatus: 'CRF',
      eiNotes: '',
      decision: review.decision || '',
      decisionNotes: review.decisionNotes || '',
      eiDocumentId: null,
    },
  };
  if (isRevision) {
    metadata.revision = {
      kind: 'approved_intervention',
      sourceInterventionId: SOURCE_INTERVENTION_ID,
      sourceActionPlanId: ACTION_PLAN_ID,
      sourceStatus: 'approved',
      sourceTitle: SOURCE_TITLE,
      openedAt: '2026-06-19T15:00:00.000Z',
    };
  }
  if (lastAppliedRevision) {
    metadata.lastAppliedRevision = lastAppliedRevision;
  }
  if (approvalLetterFollowUp) {
    metadata.approvalLetterFollowUp = approvalLetterFollowUp;
  }
  return metadata;
}

function buildIntervention({
  id = PROPOSAL_ID,
  status = 'submitted',
  stage = REVIEW_STAGES.rmReview,
  amount = 150,
  isRevision = false,
  withReviewWorkflow = true,
  rmReviewNote = '',
  nwacDecisionNote = '',
  approvalFollowUp = false,
  revisionFollowUp = false,
  createdByStaffProfileId = STAFF_PROFILE_IDS.coordinatorSubmitter,
  submittedByStaffProfileId = createdByStaffProfileId,
  submittedByRole = createdByStaffProfileId === STAFF_PROFILE_IDS.regionalManagerSubmitter
    ? 'Regional Manager'
    : 'ISET Coordinator',
} = {}) {
  const approved = status === 'approved';
  const lastAppliedRevision = revisionFollowUp
    ? {
        draftInterventionId: REVISION_ID,
        sourceInterventionId: SOURCE_INTERVENTION_ID,
        sourceTitle: SOURCE_TITLE,
        appliedAt: '2026-06-19T20:20:31.796Z',
      }
    : null;
  const approvalLetterFollowUp = approvalFollowUp || revisionFollowUp
    ? {
        status: 'pending',
        completed: false,
        kind: revisionFollowUp ? 'revision' : 'new',
        revisionDraftInterventionId: revisionFollowUp ? REVISION_ID : null,
        appliedAt: revisionFollowUp ? '2026-06-19T20:20:31.796Z' : null,
      }
    : null;
  const reviewWorkflow = withReviewWorkflow
    ? (
        approved
          ? buildReviewWorkflow(REVIEW_STAGES.finalDecisionRecorded, {
              workflowType: isRevision || revisionFollowUp ? 'intervention_revision' : 'intervention_proposal',
              rmReviewNote: rmReviewNote || 'RM reviewed and supports this request.',
              submittedByStaffProfileId,
              submittedByRole,
            })
          : buildReviewWorkflow(stage, {
              workflowType: isRevision ? 'intervention_revision' : 'intervention_proposal',
              rmReviewNote,
              nwacDecisionNote,
              submittedByStaffProfileId,
              submittedByRole,
            })
      )
    : null;
  const metadata = buildMetadata({
    amount,
    isRevision,
    review: { decision: approved ? 'approved' : '', decisionNotes: nwacDecisionNote || '' },
    lastAppliedRevision,
    approvalLetterFollowUp,
  });
  return {
    id,
    actionPlanId: ACTION_PLAN_ID,
    action_plan_id: ACTION_PLAN_ID,
    title: isRevision || revisionFollowUp ? 'Employment counselling revision' : 'Employment counselling',
    code: '3',
    status,
    reviewStatus: status,
    review_status: status,
    deliveryStatus: approved ? 'planned' : null,
    delivery_status: approved ? 'planned' : null,
    proposalId: approved ? 301 : null,
    proposal_id: approved ? 301 : null,
    proposalReviewStatus: approved ? 'approved' : null,
    proposal_review_status: approved ? 'approved' : null,
    proposalKind: isRevision || revisionFollowUp ? 'revision' : 'new',
    proposal_kind: isRevision || revisionFollowUp ? 'revision' : 'new',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    institution: 'Example College',
    programName: 'Employment counselling',
    notes: 'Training aligns with the employment plan.',
    createdByStaffProfileId,
    created_by_staff_profile_id: createdByStaffProfileId,
    createdAt: '2026-06-19T15:00:00.000Z',
    updatedAt: '2026-06-19T16:00:00.000Z',
    metadata,
    reviewWorkflow,
    review_workflow: reviewWorkflow,
    twoStepReviewEnabled: true,
    two_step_review_enabled: true,
  };
}

function buildApprovedSourceIntervention() {
  return {
    id: SOURCE_INTERVENTION_ID,
    actionPlanId: ACTION_PLAN_ID,
    action_plan_id: ACTION_PLAN_ID,
    title: SOURCE_TITLE,
    code: '3',
    status: 'approved',
    reviewStatus: 'approved',
    review_status: 'approved',
    deliveryStatus: 'planned',
    delivery_status: 'planned',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    institution: 'Employment Counsellor McGee',
    programName: 'Employment counselling',
    metadata: {
      source: 'approved_intervention',
      proposedInterventions: [buildProposedIntervention({ amount: 100 })],
    },
  };
}

function buildCasePayload(intervention) {
  const interventions = [intervention];
  if (
    (intervention?.metadata?.revision || intervention?.metadata?.lastAppliedRevision) &&
    String(intervention?.id) !== String(SOURCE_INTERVENTION_ID)
  ) {
    interventions.unshift(buildApprovedSourceIntervention());
  }
  return {
    id: CASE_ID,
    case_id: CASE_ID,
    application_id: APPLICATION_ID,
    applicationId: APPLICATION_ID,
    application_row_version: 7,
    applicationRowVersion: 7,
    applicant_user_id: APPLICANT_USER_ID,
    applicantUserId: APPLICANT_USER_ID,
    tracking_id: 'ISET-20260619-D35BCD',
    applicant_name: 'Jacqueline Sillery',
    first_name: 'Jacqueline',
    preferred_name: 'Jacqueline',
    last_name: 'Sillery',
    applicant_email: 'jack@sillery.co.uk',
    email: 'jack@sillery.co.uk',
    applicant_phone: '(514) 782-4396',
    phone: '(514) 782-4396',
    address_province: 'QC',
    application_address_province: 'QC',
    status: 'initiated',
    lifecycle_status: 'active',
    applicationStatus: 'approved',
    application_status: 'approved',
    applicationStatusRaw: 'approved',
    application_lifecycle_status: 'active',
    applicationLifecycleStatus: 'active',
    decision_outcome: 'approved',
    assigned_staff_profile_id: 1,
    assigned_user_email: 'quebec.coordinator.1@awentech.ca',
    assigned_user_display_name: 'Quebec Coordinator',
    submitted_at: '2026-06-19T15:00:00Z',
    created_at: '2026-06-19T15:00:00Z',
    updated_at: '2026-06-19T16:00:00Z',
    docs_requested_active: 0,
    lock_owner_id: null,
    lock_owner_name: null,
    lock_owner_email: null,
    lock_expires_at: null,
    payload_json: JSON.stringify({
      'first-name': 'Jacqueline',
      'last-name': 'Sillery',
      'preferred-name': 'Jacqueline',
      email: 'jack@sillery.co.uk',
      'requested-supports': ['tuition'],
    }),
    caseContext: {
      applicationAssessmentContext: { [APPLICATION_ID]: {} },
      applicationReportingArtifacts: {},
    },
    actionPlans: [
      {
        id: ACTION_PLAN_ID,
        case_id: CASE_ID,
        applicationId: APPLICATION_ID,
        application_id: APPLICATION_ID,
        title: '2026 employment plan',
        name: '2026 employment plan',
        status: 'active',
        lifecycle_status: 'active',
        fundingStream: 'CRF',
        funding_stream: 'CRF',
        budgetPotId: 99,
        budget_pot_id: 99,
        postingContext: 'external',
        posting_context: 'external',
        createdAt: '2026-06-19T15:00:00.000Z',
        updatedAt: '2026-06-19T16:00:00.000Z',
        interventions,
        interventionCount: interventions.length,
      },
    ],
  };
}

function buildApplicationPayload() {
  return {
    id: APPLICATION_ID,
    case_id: CASE_ID,
    applicant_user_id: APPLICANT_USER_ID,
    row_version: 7,
    payload_json: '{}',
    status: 'approved',
    lifecycle_status: 'active',
    applicant_name: 'Jacqueline Sillery',
    tracking_id: 'ISET-20260619-D35BCD',
    submitted_at: '2026-06-19T15:00:00Z',
    created_at: '2026-06-19T15:00:00Z',
    updated_at: '2026-06-19T16:00:00Z',
  };
}

function mutateReviewAction(state, action, note) {
  const current = state.intervention;
  let stage = current.reviewWorkflow?.currentStage || REVIEW_STAGES.rmReview;
  let status = current.status || 'submitted';
  let rmReviewNote = current.reviewWorkflow?.rmReviewNote || '';
  let nwacDecisionNote = current.reviewWorkflow?.nwacDecisionNote || '';

  if (action === REVIEW_ACTIONS.rmReturnToSubmitter) {
    stage = REVIEW_STAGES.returnedToSubmitter;
    status = 'changes_requested';
    rmReviewNote = note;
  } else if (action === REVIEW_ACTIONS.rmSubmitToNwac) {
    stage = REVIEW_STAGES.nwacReview;
    status = 'submitted';
    rmReviewNote = note || rmReviewNote || 'RM reviewed and supports this request.';
  } else if (action === REVIEW_ACTIONS.rmForwardChangesToSubmitter) {
    stage = REVIEW_STAGES.returnedToSubmitter;
    status = 'changes_requested';
    rmReviewNote = note;
    nwacDecisionNote = nwacDecisionNote || 'Decision Maker requested changes before approval.';
  }

  state.intervention = buildIntervention({
    id: current.id,
    status,
    stage,
    amount: state.amount,
    isRevision: state.isRevision,
    rmReviewNote,
    nwacDecisionNote,
    createdByStaffProfileId:
      current.createdByStaffProfileId ||
      current.created_by_staff_profile_id ||
      STAFF_PROFILE_IDS.coordinatorSubmitter,
    submittedByStaffProfileId:
      current.reviewWorkflow?.submittedByStaffProfileId ||
      current.review_workflow?.submitted_by_staff_profile_id ||
      current.createdByStaffProfileId ||
      current.created_by_staff_profile_id ||
      STAFF_PROFILE_IDS.coordinatorSubmitter,
    submittedByRole:
      current.reviewWorkflow?.submittedByRole ||
      current.review_workflow?.submitted_by_role ||
      'ISET Coordinator',
  });
  state.casePayload = buildCasePayload(state.intervention);
  return state.intervention;
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
      const profile = state.profile;
      request.respond(jsonResponse({
        auth: {
          sub: `smoke-${profile.staffProfileId}`,
          email: profile.email,
          name: profile.name,
          role: state.role,
          groups: profile.groups,
          staffProfileId: profile.staffProfileId,
          regionIds: [1],
        },
        profile: {
          id: profile.staffProfileId,
          email: profile.email,
          name: profile.name,
          role: state.role,
          region_id: 1,
          region_ids: [1],
        },
      }));
      return;
    }
    if ((pathname === `/api/cases/${CASE_ID}` || pathname === `/api/cases/${CASE_ID}/workspace`) && method === 'GET') {
      request.respond(jsonResponse(state.casePayload));
      return;
    }
    if (pathname === `/api/interventions/${state.intervention.id}/review-workflow/action` && method === 'POST') {
      const body = request.postData() ? JSON.parse(request.postData()) : {};
      state.mutations.reviewActions.push({ body });
      const workflowType = state.isRevision ? 'intervention_revision' : 'intervention_proposal';
      const transition = getReviewTransition({
        action: body.action,
        currentStage: state.intervention.reviewWorkflow?.currentStage || state.intervention.review_workflow?.current_stage || null,
        workflowType,
        role: state.role,
      });
      if (!transition.allowed) {
        request.respond(jsonResponse({
          error: 'review_workflow_transition_forbidden',
          message: 'Review workflow transition forbidden.',
        }, 403));
        return;
      }
      const updated = mutateReviewAction(state, body.action, body.note || '');
      request.respond(jsonResponse({ success: true, intervention: updated }));
      return;
    }
    if (pathname === `/api/interventions/${state.intervention.id}` && method === 'PATCH') {
      const body = request.postData() ? JSON.parse(request.postData()) : {};
      state.mutations.interventionUpdates.push({ body });
      const currentWorkflow = state.intervention.reviewWorkflow || state.intervention.review_workflow || null;
      const currentStage = currentWorkflow?.currentStage || currentWorkflow?.current_stage || null;
      const recordedSubmitterStaffProfileId =
        currentWorkflow?.submittedByStaffProfileId ||
        currentWorkflow?.submitted_by_staff_profile_id ||
        state.intervention.createdByStaffProfileId ||
        state.intervention.created_by_staff_profile_id ||
        null;
      const isReturnedSubmitterMutation = currentStage === REVIEW_STAGES.returnedToSubmitter;
      const isSupportOverride = state.role === 'System Administrator';
      if (
        isReturnedSubmitterMutation &&
        !isSupportOverride &&
        Number(recordedSubmitterStaffProfileId) !== Number(state.profile.staffProfileId)
      ) {
        request.respond(jsonResponse({
          error: 'intervention_submitter_mismatch',
          message: 'Only the recorded submitter may update this returned intervention request.',
        }, 403));
        return;
      }
      const workflowType = state.isRevision ? 'intervention_revision' : 'intervention_proposal';
      let reviewWorkflow = currentWorkflow;
      if (String(body.status || '').trim().toLowerCase() === 'submitted') {
        const transition = getReviewTransition({
          action: REVIEW_WORKFLOW_ACTIONS.SubmitForRmReview,
          currentStage,
          workflowType,
          role: state.role,
        });
        if (!transition.allowed) {
          request.respond(jsonResponse({
            error: 'review_workflow_transition_forbidden',
            message: 'Review workflow transition forbidden.',
          }, 403));
          return;
        }
        reviewWorkflow = buildReviewWorkflow(transition.nextStage, {
          workflowType,
          submittedByStaffProfileId:
            recordedSubmitterStaffProfileId || state.profile.staffProfileId,
          submittedByRole:
            currentWorkflow?.submittedByRole ||
            currentWorkflow?.submitted_by_role ||
            state.role,
        });
      }
      state.intervention = {
        ...state.intervention,
        ...body,
        status: body.status || state.intervention.status,
        reviewStatus: body.status || state.intervention.reviewStatus,
        review_status: body.status || state.intervention.review_status,
        reviewWorkflow,
        review_workflow: reviewWorkflow,
        twoStepReviewEnabled: true,
        two_step_review_enabled: true,
      };
      state.casePayload = buildCasePayload(state.intervention);
      request.respond(jsonResponse(state.intervention));
      return;
    }
    if (pathname === `/api/applications/${APPLICATION_ID}`) {
      request.respond(jsonResponse(buildApplicationPayload()));
      return;
    }
    if (pathname === '/api/access-control/matrix') {
      request.respond(jsonResponse({ default: 'allow', routes: {} }));
      return;
    }
    if (pathname === '/api/me/tutorial-progress') {
      request.respond(jsonResponse({
        items: [
          { tutorialId: 'case-workspace-overview-v3', status: 'dismissed' },
          { tutorialId: 'iset-coordinator-intro-v2', status: 'dismissed' },
        ],
      }));
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
    if (pathname === `/api/applications/${APPLICATION_ID}/watchlist-hit`) {
      request.respond(jsonResponse({ hasHit: false, hit: null }));
      return;
    }
    if (pathname === `/api/applicants/${APPLICANT_USER_ID}/document-checklist`) {
      request.respond(jsonResponse({ items: [], missingRequiredCount: 0 }));
      return;
    }
    if (pathname === `/api/applicants/${APPLICANT_USER_ID}/applications`) {
      request.respond(jsonResponse([{ id: APPLICATION_ID, application_id: APPLICATION_ID, case_id: CASE_ID }]));
      return;
    }
    if (pathname === `/api/applicants/${APPLICANT_USER_ID}/documents` || pathname === `/api/cases/${CASE_ID}/documents`) {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/document-types') {
      request.respond(jsonResponse([
        { code: 'case_assessment', label: 'Assessment PDF', scope: 'case' },
      ]));
      return;
    }
    if (pathname === `/api/cases/${CASE_ID}/messages`) {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === `/api/cases/${CASE_ID}/notes`) {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/reminders') {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === `/api/cases/${CASE_ID}/events`) {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/reference/intervention-codes') {
      request.respond(jsonResponse([{ code: '3', label: 'Employment counselling', name: 'Employment counselling' }]));
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
      request.respond(jsonResponse({ paymentTypes: [], payeeTypes: [], interventions: [] }));
      return;
    }
    if (pathname === '/api/workflows') {
      request.respond(jsonResponse([
        { id: 77, status: 'active', document_type: 'assessment_approval_letter', title: 'Approval letter' },
      ]));
      return;
    }
    if (pathname === '/api/reference/budget-pots-lite' || pathname === '/api/finance/budget-pots') {
      request.respond(jsonResponse({
        items: [
          { id: 99, label: 'QC-2025-CRF', name: 'QC-2025-CRF', funding_stream: 'CRF', posting_context: 'external' },
        ],
      }));
      return;
    }
    if (pathname === '/api/reference/noc-codes') {
      request.respond(jsonResponse({ items: [] }));
      return;
    }

    request.respond(jsonResponse({ items: [], rows: [], total: 0, count: 0 }));
  });
}

async function installBrowserSession(page, frontendBase, role, profile) {
  const session = {
    idToken: fakeJwt(role, profile),
    accessToken: fakeJwt(role, profile),
    refreshToken: null,
    expiresAt: Math.floor(Date.now() / 1000) + 3300,
  };
  await page.evaluateOnNewDocument((authSession, baseUrl) => {
    window.__API_BASE__ = baseUrl;
    sessionStorage.setItem('authSession', JSON.stringify(authSession));
    localStorage.removeItem('iset-case-workspace-layout-v14');
  }, session, frontendBase);
}

async function visibleEnabledButtons(page, text, options = {}) {
  return page.evaluate(({ targetText, scopeSelector }) => {
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
    const scope = scopeSelector ? document.querySelector(scopeSelector) : document;
    if (!scope) return [];
    return Array.from(scope.querySelectorAll('button, [role="button"]'))
      .filter(button => isVisible(button))
      .filter(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true')
      .map((button, index) => ({ index, text: normalize(button.innerText || button.textContent || '') }))
      .filter(button => button.text === targetText);
  }, { targetText: text, scopeSelector: options.scopeSelector || INTERVENTION_WIDGET_SELECTOR });
}

async function visibleButtonStates(page, text, options = {}) {
  return page.evaluate(({ targetText, scopeSelector }) => {
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
    const scope = scopeSelector ? document.querySelector(scopeSelector) : document;
    if (!scope) return [];
    return Array.from(scope.querySelectorAll('button, [role="button"]'))
      .filter(isVisible)
      .map((button, index) => ({
        index,
        text: normalize(button.innerText || button.textContent || ''),
        disabled: Boolean(button.disabled || button.getAttribute('aria-disabled') === 'true'),
      }))
      .filter(button => button.text === targetText);
  }, { targetText: text, scopeSelector: options.scopeSelector || INTERVENTION_WIDGET_SELECTOR });
}

async function clickButtonByText(page, text, options = {}) {
  const clicked = await page.evaluate(({ targetText, preferLast, scopeSelector }) => {
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
    const scope = scopeSelector ? document.querySelector(scopeSelector) : document;
    if (!scope) return false;
    const buttons = Array.from(scope.querySelectorAll('button, [role="button"]'))
      .filter(button => isVisible(button))
      .filter(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true');
    const matches = buttons.filter(button => normalize(button.innerText || button.textContent || '') === targetText);
    const target = preferLast ? matches[matches.length - 1] : matches[0];
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return true;
  }, {
    targetText: text,
    preferLast: Boolean(options.preferLast),
    scopeSelector: options.scopeSelector || INTERVENTION_WIDGET_SELECTOR,
  });
  if (!clicked) {
    const available = await visibleEnabledButtons(page, text, options);
    throw new Error(`Could not click button "${text}". Matching visible enabled buttons: ${JSON.stringify(available)}`);
  }
}

async function fillFirstVisibleTextarea(page, value, options = {}) {
  const filled = await page.evaluate(({ text, scopeSelector }) => {
    const isVisible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    const scope = scopeSelector ? document.querySelector(scopeSelector) : document;
    if (!scope) return false;
    const textarea = Array.from(scope.querySelectorAll('textarea')).find(isVisible);
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
  }, { text: value, scopeSelector: options.scopeSelector || INTERVENTION_WIDGET_SELECTOR });
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

async function assertTextAbsent(page, text) {
  const found = await page.evaluate(targetText => Boolean(document.body && document.body.innerText.includes(targetText)), text);
  if (found) throw new Error(`Unexpected text found: ${text}`);
}

async function assertButtonAbsent(page, text) {
  const buttons = await visibleEnabledButtons(page, text);
  if (buttons.length) throw new Error(`Unexpected enabled button "${text}" was visible.`);
}

async function waitForEnabledButton(page, text, timeoutMs = 45_000) {
  return waitUntil(async () => {
    const buttons = await visibleEnabledButtons(page, text);
    return buttons.length ? buttons : null;
  }, `enabled button "${text}"`, timeoutMs);
}

async function getRationaleTextareaState(page) {
  return page.evaluate(scopeSelector => {
    const scope = document.querySelector(scopeSelector);
    const textarea = scope?.querySelector(
      'textarea[placeholder="Summarize why these interventions are needed and expected outcomes."]'
    );
    if (!textarea) return null;
    const rect = textarea.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);
    return {
      disabled: Boolean(textarea.disabled),
      readOnly: Boolean(textarea.readOnly),
      value: textarea.value,
      visible:
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none',
    };
  }, INTERVENTION_WIDGET_SELECTOR);
}

async function navigateToRationaleStep(page) {
  for (let index = 0; index < 8; index += 1) {
    const rationale = await getRationaleTextareaState(page);
    if (rationale?.visible) return rationale;
    const nextButtons = await visibleEnabledButtons(page, 'Next');
    if (!nextButtons.length) break;
    await clickButtonByText(page, 'Next');
    await delay(300);
  }

  const debugState = await page.evaluate(scopeSelector => {
    const scope = document.querySelector(scopeSelector);
    if (!scope) return { widgetPresent: false };
    const isVisible = element => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    return {
      widgetPresent: true,
      text: String(scope.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1_000),
      textareas: Array.from(scope.querySelectorAll('textarea'))
        .filter(isVisible)
        .map(element => ({
          placeholder: element.getAttribute('placeholder') || '',
          disabled: Boolean(element.disabled),
          readOnly: Boolean(element.readOnly),
        })),
    };
  }, INTERVENTION_WIDGET_SELECTOR);
  throw new Error(`Could not reach intervention rationale step: ${JSON.stringify(debugState)}`);
}

async function getVisibleWizardContentSignature(page) {
  return page.evaluate(scopeSelector => {
    const scope = document.querySelector(scopeSelector);
    if (!scope) return null;
    const isVisible = element => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    return Array.from(scope.querySelectorAll('h1, h2, h3, h4, legend, label, input, textarea, select'))
      .filter(isVisible)
      .map(element => [
        element.tagName,
        normalize(element.innerText || element.textContent || ''),
        normalize(element.getAttribute('name') || ''),
        normalize(element.getAttribute('placeholder') || ''),
        normalize(element.value || ''),
        Boolean(element.disabled),
        Boolean(element.readOnly),
      ].join('|'))
      .join('\n');
  }, INTERVENTION_WIDGET_SELECTOR);
}

async function assertReturnedBodyReadOnly(page, state) {
  const rationale = await navigateToRationaleStep(page);
  if (!rationale.disabled && !rationale.readOnly) {
    throw new Error('Expected the returned intervention rationale to be read-only for a non-submitter.');
  }
  const readOnlyButtons = await navigateToReviewStep(page, {
    expectedActionText: 'Read only',
    expectedDisabled: null,
  });
  if (readOnlyButtons.some(button => !button.disabled)) {
    await clickButtonByText(page, 'Read only');
  }
  await assertButtonAbsent(page, 'Save progress');
  await assertButtonAbsent(page, 'Resubmit for review');
  await delay(250);
  if (state.mutations.interventionUpdates.length !== 0) {
    throw new Error('A read-only returned intervention unexpectedly issued a PATCH request.');
  }
}

async function editReturnedRationale(page, value) {
  const rationale = await navigateToRationaleStep(page);
  if (rationale.disabled || rationale.readOnly) {
    throw new Error('Expected the recorded submitter to have an editable returned intervention rationale.');
  }
  const selector = `${INTERVENTION_WIDGET_SELECTOR} textarea[placeholder="Summarize why these interventions are needed and expected outcomes."]`;
  await page.evaluate(targetSelector => {
    document.querySelector(targetSelector)?.scrollIntoView({ block: 'center', inline: 'center' });
  }, selector);
  await page.click(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.type(value);
  await waitUntil(async () => {
    const nextState = await getRationaleTextareaState(page);
    return nextState?.value === value ? nextState : null;
  }, 'edited intervention rationale value');
  await delay(150);
}

async function navigateToReviewStep(
  page,
  { expectedActionText = 'Resubmit for review', expectedDisabled = false } = {}
) {
  for (let index = 0; index < 8; index += 1) {
    const actionButtons = await visibleButtonStates(page, expectedActionText);
    const expectedButtons = expectedDisabled === null
      ? actionButtons
      : actionButtons.filter(button => button.disabled === expectedDisabled);
    if (expectedButtons.length) return expectedButtons;

    const beforeSignature = await getVisibleWizardContentSignature(page);
    await waitForEnabledButton(page, 'Next');
    await clickButtonByText(page, 'Next');
    await waitUntil(async () => {
      const nextActionButtons = await visibleButtonStates(page, expectedActionText);
      if (
        expectedDisabled === null
          ? nextActionButtons.length > 0
          : nextActionButtons.some(button => button.disabled === expectedDisabled)
      ) return true;
      const afterSignature = await getVisibleWizardContentSignature(page);
      return afterSignature && afterSignature !== beforeSignature;
    }, 'intervention wizard step transition', 10_000);
    await delay(100);
  }

  throw new Error(
    `Could not reach intervention review action "${expectedActionText}" (disabled=${expectedDisabled}).`
  );
}

async function assertReturnedSubmitterIdentity(intervention, expectedStaffProfileId) {
  const createdByStaffProfileId =
    intervention.createdByStaffProfileId || intervention.created_by_staff_profile_id || null;
  const submittedByStaffProfileId =
    intervention.reviewWorkflow?.submittedByStaffProfileId ||
    intervention.review_workflow?.submitted_by_staff_profile_id ||
    null;
  if (Number(createdByStaffProfileId) !== Number(expectedStaffProfileId)) {
    throw new Error(
      `Expected createdByStaffProfileId ${expectedStaffProfileId}, got ${createdByStaffProfileId}`
    );
  }
  if (Number(submittedByStaffProfileId) !== Number(expectedStaffProfileId)) {
    throw new Error(
      `Expected submittedByStaffProfileId ${expectedStaffProfileId}, got ${submittedByStaffProfileId}`
    );
  }
}

function requireSingleReturnedCorrectionAutosave(state, label) {
  const correctionAutosaves = state.mutations.interventionUpdates.filter(
    entry => String(entry.body.status || '').trim().toLowerCase() === 'changes_requested'
  );
  if (correctionAutosaves.length !== 1) {
    throw new Error(
      `Expected one ${label} autosave while traversing the returned wizard, got ${correctionAutosaves.length}.`
    );
  }
  return correctionAutosaves[0];
}

async function assertRecordedSubmitterCanEditAndResubmit(
  page,
  state,
  { rationale, completeSeparateRmSignoff = false } = {}
) {
  await assertReturnedSubmitterIdentity(state.intervention, state.profile.staffProfileId);
  await waitForText(page, 'Changes requested');
  await editReturnedRationale(page, rationale);
  await navigateToReviewStep(page);

  await waitUntil(
    () => state.mutations.interventionUpdates.find(entry => entry.body.status === 'changes_requested'),
    'returned intervention autosave'
  );
  const saveUpdate = requireSingleReturnedCorrectionAutosave(state, 'returned intervention correction');
  if (saveUpdate.body.metadata?.rationale !== rationale) {
    throw new Error(`Returned intervention autosave lost the edited rationale: ${saveUpdate.body.metadata?.rationale}`);
  }
  await assertButtonAbsent(page, 'Submit for final decision');
  if (state.mutations.reviewActions.length !== 0) {
    throw new Error('A returned submitter reached an RM review action before resubmitting.');
  }

  const beforeResubmitSignature = await getVisibleWizardContentSignature(page);
  await clickButtonByText(page, 'Resubmit for review');
  const submitUpdate = await waitUntil(
    () => state.mutations.interventionUpdates.find(entry => entry.body.status === 'submitted'),
    'returned intervention resubmit'
  );
  if (submitUpdate.body.metadata?.rationale !== rationale) {
    throw new Error(`Returned intervention resubmit lost the edited rationale: ${submitUpdate.body.metadata?.rationale}`);
  }
  if (state.intervention.reviewWorkflow?.currentStage !== REVIEW_STAGES.rmReview) {
    throw new Error(
      `Expected returned intervention to re-enter RM review, got ${state.intervention.reviewWorkflow?.currentStage}`
    );
  }

  await waitUntil(async () => {
    const afterResubmitSignature = await getVisibleWizardContentSignature(page);
    return (
      afterResubmitSignature &&
      afterResubmitSignature !== beforeResubmitSignature
    ) ? afterResubmitSignature : null;
  }, 'post-resubmit intervention wizard refresh', 10_000);

  if (!completeSeparateRmSignoff) {
    await assertButtonAbsent(page, 'Submit for final decision');
    return;
  }

  await navigateToReviewStep(page, {
    expectedActionText: 'Submit for final decision',
    expectedDisabled: false,
  });
  if (state.mutations.reviewActions.length !== 0) {
    throw new Error('Regional Manager sign-off was not kept as a separate post-resubmission action.');
  }
  await clickButtonByText(page, 'Submit for final decision');
  const reviewAction = await waitUntil(
    () => state.mutations.reviewActions[0],
    'separate Regional Manager sign-off'
  );
  if (reviewAction.body.action !== REVIEW_ACTIONS.rmSubmitToNwac) {
    throw new Error(`Expected separate RM sign-off action, got ${reviewAction.body.action}`);
  }
  if (state.intervention.reviewWorkflow?.currentStage !== REVIEW_STAGES.nwacReview) {
    throw new Error(
      `Expected separate RM sign-off to enter final-decision review, got ${state.intervention.reviewWorkflow?.currentStage}`
    );
  }
  await waitForText(page, 'Intervention request submitted for final decision.');
}

function buildReturnedReadOnlyScenario({ name, role, profile, isRevision = false }) {
  return {
    name,
    role,
    profile,
    step: 'rationale',
    intervention: {
      id: isRevision ? REVISION_ID : PROPOSAL_ID,
      status: 'changes_requested',
      stage: REVIEW_STAGES.returnedToSubmitter,
      amount: 150,
      isRevision,
      createdByStaffProfileId: STAFF_PROFILE_IDS.coordinatorSubmitter,
      submittedByStaffProfileId: STAFF_PROFILE_IDS.coordinatorSubmitter,
      submittedByRole: 'ISET Coordinator',
      rmReviewNote: 'The original submitter must correct this request.',
    },
    assert: async (page, state) => {
      await assertReturnedSubmitterIdentity(
        state.intervention,
        STAFF_PROFILE_IDS.coordinatorSubmitter
      );
      await assertReturnedBodyReadOnly(page, state);
    },
  };
}

function buildSystemAdministratorOverrideScenario({ name, isRevision = false }) {
  const rationale = isRevision
    ? 'System Administrator support correction for the returned intervention change.'
    : 'System Administrator support correction for the returned intervention proposal.';
  return {
    name,
    role: 'System Administrator',
    step: 'rationale',
    intervention: {
      id: isRevision ? REVISION_ID : PROPOSAL_ID,
      status: 'changes_requested',
      stage: REVIEW_STAGES.returnedToSubmitter,
      amount: 150,
      isRevision,
      createdByStaffProfileId: STAFF_PROFILE_IDS.coordinatorSubmitter,
      submittedByStaffProfileId: STAFF_PROFILE_IDS.coordinatorSubmitter,
      submittedByRole: 'ISET Coordinator',
    },
    assert: async (page, state) => {
      await assertReturnedSubmitterIdentity(
        state.intervention,
        STAFF_PROFILE_IDS.coordinatorSubmitter
      );
      await editReturnedRationale(page, rationale);
      await navigateToReviewStep(page);
      await waitUntil(
        () => state.mutations.interventionUpdates.find(entry => entry.body.status === 'changes_requested'),
        'System Administrator support save'
      );
      const update = requireSingleReturnedCorrectionAutosave(
        state,
        'System Administrator support correction'
      );
      if (update.body.metadata?.rationale !== rationale) {
        throw new Error(`System Administrator support save lost the edited rationale: ${update.body.metadata?.rationale}`);
      }
      if (state.mutations.reviewActions.length !== 0) {
        throw new Error('System Administrator support edit unexpectedly performed a business review action.');
      }
    },
  };
}

function buildScenarioState(scenario) {
  const role = scenario.role;
  const defaultProfile = roleProfiles[role] || roleProfiles['ISET Coordinator'];
  const profile = {
    ...defaultProfile,
    ...(scenario.profile || {}),
  };
  const intervention = buildIntervention(scenario.intervention);
  return {
    name: scenario.name,
    role,
    profile,
    isRevision: Boolean(scenario.intervention?.isRevision),
    amount: scenario.intervention?.amount || 150,
    intervention,
    casePayload: buildCasePayload(intervention),
    apiCalls: [],
    mutations: {
      interventionUpdates: [],
      reviewActions: [],
    },
    consoleLines: [],
    failures: [],
  };
}

function buildUrl(frontendBase, interventionId, step) {
  const query = new URLSearchParams({
    entry: 'approval',
    approvalType: 'intervention',
    interventionId: String(interventionId),
    planId: String(ACTION_PLAN_ID),
  });
  if (step) query.set('step', step);
  return `${frontendBase}/cases/${CASE_ID}?${query.toString()}`;
}

async function runScenario(browser, args, scenario) {
  const state = buildScenarioState(scenario);
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  await page.setViewport({ width: 1360, height: 940, deviceScaleFactor: 1 });

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

  const screenshotPath = path.join(args.screenshotDir, `${scenario.name}.png`);
  try {
    await installApiStubs(page, state);
    await installBrowserSession(page, args.frontendBase, state.role, state.profile);
    await page.goto(buildUrl(args.frontendBase, state.intervention.id, scenario.step), { waitUntil: 'domcontentloaded' });
    await scenario.assert(page, state);
    await assertNonPollingReferenceCallsSettle(state);
    await delay(400);
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
    apiCalls: state.apiCalls.map(call => `${call.method} ${call.path}${call.search}`),
    interventionUpdates: state.mutations.interventionUpdates.map(entry => entry.body),
    reviewActions: state.mutations.reviewActions.map(entry => entry.body),
    failures: state.failures,
    consoleWarnings: state.consoleLines.filter(line => line.type === 'warning' || line.type === 'error').slice(-10),
  };
}

const scenarios = [
  {
    name: 'rm-submit-draft-new-proposal',
    role: 'Regional Manager',
    step: 'review',
    intervention: {
      id: PROPOSAL_ID,
      status: 'draft',
      amount: 150,
      isRevision: false,
      withReviewWorkflow: false,
      createdByStaffProfileId: STAFF_PROFILE_IDS.regionalManagerSubmitter,
    },
    assert: async (page, state) => {
      await waitForText(page, 'Propose new intervention');
      for (let index = 0; index < 8; index += 1) {
        const readyToSubmit = await page.evaluate(() => (
          Boolean(document.body && document.body.innerText.includes('Submit for review'))
        ));
        if (readyToSubmit) break;
        await clickButtonByText(page, 'Next');
        await delay(250);
      }
      await waitForText(page, 'Submit for review');
      await clickButtonByText(page, 'Submit for review');
      const update = await waitUntil(() => state.mutations.interventionUpdates[0], 'RM draft proposal submit');
      if (update.body.status !== 'submitted') {
        throw new Error(`Expected submitted status, got ${update.body.status}`);
      }
      if (state.intervention.reviewWorkflow?.workflowType !== 'intervention_proposal') {
        throw new Error(`Expected intervention_proposal workflow, got ${state.intervention.reviewWorkflow?.workflowType}`);
      }
      if (state.intervention.reviewWorkflow?.currentStage !== REVIEW_STAGES.rmReview) {
        throw new Error(`Expected RM review stage, got ${state.intervention.reviewWorkflow?.currentStage}`);
      }
      await waitForText(page, 'Intervention proposal submitted to Regional Manager review.');
    },
  },
  {
    name: 'rm-submit-draft-revision',
    role: 'Regional Manager',
    step: 'review',
    intervention: {
      id: REVISION_ID,
      status: 'draft',
      amount: 150,
      isRevision: true,
      withReviewWorkflow: false,
      createdByStaffProfileId: STAFF_PROFILE_IDS.regionalManagerSubmitter,
    },
    assert: async (page, state) => {
      await waitForText(page, 'Draft a proposed change to');
      for (let index = 0; index < 8; index += 1) {
        const readyToSubmit = await page.evaluate(() => (
          Boolean(document.body && document.body.innerText.includes('Submit for review'))
        ));
        if (readyToSubmit) break;
        await clickButtonByText(page, 'Next');
        await delay(250);
      }
      await waitForText(page, 'Submit for review');
      await clickButtonByText(page, 'Submit for review');
      const update = await waitUntil(() => state.mutations.interventionUpdates[0], 'RM draft revision submit');
      if (update.body.status !== 'submitted') {
        throw new Error(`Expected submitted status, got ${update.body.status}`);
      }
      if (state.intervention.reviewWorkflow?.workflowType !== 'intervention_revision') {
        throw new Error(`Expected intervention_revision workflow, got ${state.intervention.reviewWorkflow?.workflowType}`);
      }
      if (state.intervention.reviewWorkflow?.currentStage !== REVIEW_STAGES.rmReview) {
        throw new Error(`Expected RM review stage, got ${state.intervention.reviewWorkflow?.currentStage}`);
      }
      await waitForText(page, 'Intervention change submitted to Regional Manager review.');
    },
  },
  {
    name: 'rm-new-proposal-return',
    role: 'Regional Manager',
    intervention: {
      id: PROPOSAL_ID,
      status: 'submitted',
      stage: REVIEW_STAGES.rmReview,
      amount: 150,
    },
    assert: async (page, state) => {
      await waitForText(page, 'Review intervention proposal');
      await waitForText(page, 'Review and submit');
      await waitForText(page, 'Review note');
      await waitForText(page, 'Return to submitter');
      await waitForText(page, 'Submit for final decision');
      await fillFirstVisibleTextarea(page, 'RM needs updated proposal details.');
      await clickButtonByText(page, 'Return to submitter');
      const action = await waitUntil(() => state.mutations.reviewActions[0], 'RM return action');
      if (action.body.action !== REVIEW_ACTIONS.rmReturnToSubmitter) {
        throw new Error(`Expected RM return action, got ${action.body.action}`);
      }
      if (action.body.note !== 'RM needs updated proposal details.') {
        throw new Error(`Unexpected RM note: ${action.body.note}`);
      }
      await waitForText(page, 'Intervention request returned to the submitter.');
    },
  },
  {
    name: 'rm-new-proposal-submit-upward',
    role: 'Regional Manager',
    intervention: {
      id: PROPOSAL_ID,
      status: 'submitted',
      stage: REVIEW_STAGES.rmReview,
      amount: 150,
    },
    assert: async (page, state) => {
      await waitForText(page, 'Review intervention proposal');
      await waitForText(page, 'Review and submit');
      await waitForText(page, 'Submit for final decision');
      await clickButtonByText(page, 'Submit for final decision');
      const action = await waitUntil(() => state.mutations.reviewActions[0], 'RM submit-upward action');
      if (action.body.action !== REVIEW_ACTIONS.rmSubmitToNwac) {
        throw new Error(`Expected RM submit-upward action, got ${action.body.action}`);
      }
      await waitForText(page, 'Intervention request submitted for final decision.');
    },
  },
  {
    name: 'decision-maker-new-proposal',
    role: 'NWAC Administrator',
    intervention: {
      id: PROPOSAL_ID,
      status: 'submitted',
      stage: REVIEW_STAGES.nwacReview,
      amount: 25050,
      rmReviewNote: 'RM signed off and recommends final approval.',
    },
    assert: async page => {
      await waitForText(page, 'Review intervention proposal');
      await waitForText(page, 'Record of decision');
      await waitForText(page, 'Case manager proposal recommendation');
      await waitForText(page, 'Regional Manager review note');
      await waitForText(page, 'RM signed off and recommends final approval.');
      await waitForText(page, 'Decision on the new intervention proposal');
      await waitForText(page, 'Shelley approval required');
      await waitForText(page, 'Only Shelley Stacey (sstacey@nwac.ca) can approve funding of $20,000 or above.');
      await assertTextAbsent(page, 'Madison/Shelley');
    },
  },
  {
    name: 'rm-forward-decision-maker-changes',
    role: 'Regional Manager',
    intervention: {
      id: PROPOSAL_ID,
      status: 'submitted',
      stage: REVIEW_STAGES.returnedToRm,
      amount: 150,
      rmReviewNote: 'Initial RM sign-off note.',
      nwacDecisionNote: 'Decision Maker needs the cost reduced below the approval threshold.',
    },
    assert: async (page, state) => {
      await waitForText(page, 'Review intervention proposal');
      await waitForText(page, 'Decision Maker requested changes');
      await waitForText(page, 'Decision Maker needs the cost reduced below the approval threshold.');
      await waitForText(page, 'Note to submitter');
      await waitForText(page, 'Forward changes to submitter');
      await assertButtonAbsent(page, 'Submit for final decision');
      await fillFirstVisibleTextarea(page, 'Please reduce the amount and resubmit for review.');
      await clickButtonByText(page, 'Forward changes to submitter');
      const action = await waitUntil(() => state.mutations.reviewActions[0], 'RM forward-changes action');
      if (action.body.action !== REVIEW_ACTIONS.rmForwardChangesToSubmitter) {
        throw new Error(`Expected RM forward-changes action, got ${action.body.action}`);
      }
      await waitForText(page, 'Requested changes forwarded to the submitter.');
    },
  },
  {
    name: 'coordinator-submitter-edits-and-resubmits-returned-new-proposal',
    role: 'ISET Coordinator',
    step: 'rationale',
    intervention: {
      id: PROPOSAL_ID,
      status: 'changes_requested',
      stage: REVIEW_STAGES.returnedToSubmitter,
      amount: 25050,
      createdByStaffProfileId: STAFF_PROFILE_IDS.coordinatorSubmitter,
      submittedByStaffProfileId: STAFF_PROFILE_IDS.coordinatorSubmitter,
      submittedByRole: 'ISET Coordinator',
      rmReviewNote: 'Drop it below 20K.',
      nwacDecisionNote: 'It is above the limit for my approval.',
    },
    assert: async (page, state) => {
      await waitForText(page, 'Propose new intervention');
      await waitForText(page, 'Changes requested');
      await waitForText(page, 'Decision Maker note');
      await waitForText(page, 'It is above the limit for my approval.');
      await waitForText(page, 'Regional Manager note');
      await waitForText(page, 'Drop it below 20K.');
      await assertTextAbsent(page, 'Resubmit for approval');
      await assertTextAbsent(page, 'Madison/Shelley');
      await assertRecordedSubmitterCanEditAndResubmit(page, state, {
        rationale: 'Coordinator corrected the returned new intervention proposal.',
      });
    },
  },
  {
    name: 'coordinator-submitter-edits-and-resubmits-returned-revision',
    role: 'ISET Coordinator',
    step: 'rationale',
    intervention: {
      id: REVISION_ID,
      status: 'changes_requested',
      stage: REVIEW_STAGES.returnedToSubmitter,
      amount: 150,
      isRevision: true,
      createdByStaffProfileId: STAFF_PROFILE_IDS.coordinatorSubmitter,
      submittedByStaffProfileId: STAFF_PROFILE_IDS.coordinatorSubmitter,
      submittedByRole: 'ISET Coordinator',
      rmReviewNote: 'Update the intervention change rationale.',
      nwacDecisionNote: 'Clarify why this intervention change is needed.',
    },
    assert: async (page, state) => {
      await waitForText(page, 'Draft a proposed change to');
      await waitForText(page, 'Changes requested');
      await assertRecordedSubmitterCanEditAndResubmit(page, state, {
        rationale: 'Coordinator corrected the returned intervention change.',
      });
    },
  },
  buildReturnedReadOnlyScenario({
    name: 'different-coordinator-cannot-edit-returned-new-proposal',
    role: 'ISET Coordinator',
    profile: {
      email: 'quebec.coordinator.2@awentech.ca',
      name: 'Different Quebec Coordinator',
      staffProfileId: STAFF_PROFILE_IDS.otherCoordinator,
    },
  }),
  buildReturnedReadOnlyScenario({
    name: 'different-coordinator-cannot-edit-returned-revision',
    role: 'ISET Coordinator',
    profile: {
      email: 'quebec.coordinator.2@awentech.ca',
      name: 'Different Quebec Coordinator',
      staffProfileId: STAFF_PROFILE_IDS.otherCoordinator,
    },
    isRevision: true,
  }),
  buildReturnedReadOnlyScenario({
    name: 'different-regional-manager-cannot-edit-returned-new-proposal',
    role: 'Regional Manager',
    profile: {
      email: 'quebec.manager.2@awentech.ca',
      name: 'Different Quebec Regional Manager',
      staffProfileId: STAFF_PROFILE_IDS.otherRegionalManager,
    },
  }),
  buildReturnedReadOnlyScenario({
    name: 'different-regional-manager-cannot-edit-returned-revision',
    role: 'Regional Manager',
    profile: {
      email: 'quebec.manager.2@awentech.ca',
      name: 'Different Quebec Regional Manager',
      staffProfileId: STAFF_PROFILE_IDS.otherRegionalManager,
    },
    isRevision: true,
  }),
  buildReturnedReadOnlyScenario({
    name: 'decision-maker-cannot-edit-returned-new-proposal',
    role: 'NWAC Administrator',
  }),
  buildReturnedReadOnlyScenario({
    name: 'decision-maker-cannot-edit-returned-revision',
    role: 'NWAC Administrator',
    isRevision: true,
  }),
  buildSystemAdministratorOverrideScenario({
    name: 'system-administrator-support-override-returned-new-proposal',
  }),
  buildSystemAdministratorOverrideScenario({
    name: 'system-administrator-support-override-returned-revision',
    isRevision: true,
  }),
  {
    name: 'same-regional-manager-resubmits-then-signs-off-new-proposal',
    role: 'Regional Manager',
    step: 'rationale',
    intervention: {
      id: PROPOSAL_ID,
      status: 'changes_requested',
      stage: REVIEW_STAGES.returnedToSubmitter,
      amount: 150,
      createdByStaffProfileId: STAFF_PROFILE_IDS.regionalManagerSubmitter,
      submittedByStaffProfileId: STAFF_PROFILE_IDS.regionalManagerSubmitter,
      submittedByRole: 'Regional Manager',
      rmReviewNote: 'Correct the submitter-owned proposal before another RM sign-off.',
      nwacDecisionNote: 'Decision Maker requested clearer proposal rationale.',
    },
    assert: async (page, state) => {
      await assertRecordedSubmitterCanEditAndResubmit(page, state, {
        rationale: 'Regional Manager corrected the proposal while acting as its recorded submitter.',
        completeSeparateRmSignoff: true,
      });
    },
  },
  {
    name: 'same-regional-manager-resubmits-then-signs-off-revision',
    role: 'Regional Manager',
    step: 'rationale',
    intervention: {
      id: REVISION_ID,
      status: 'changes_requested',
      stage: REVIEW_STAGES.returnedToSubmitter,
      amount: 150,
      isRevision: true,
      createdByStaffProfileId: STAFF_PROFILE_IDS.regionalManagerSubmitter,
      submittedByStaffProfileId: STAFF_PROFILE_IDS.regionalManagerSubmitter,
      submittedByRole: 'Regional Manager',
      rmReviewNote: 'Correct the submitter-owned change before another RM sign-off.',
      nwacDecisionNote: 'Decision Maker requested clearer revision rationale.',
    },
    assert: async (page, state) => {
      await assertRecordedSubmitterCanEditAndResubmit(page, state, {
        rationale: 'Regional Manager corrected the revision while acting as its recorded submitter.',
        completeSeparateRmSignoff: true,
      });
    },
  },
  {
    name: 'decision-maker-revision',
    role: 'NWAC Administrator',
    intervention: {
      id: REVISION_ID,
      status: 'submitted',
      stage: REVIEW_STAGES.nwacReview,
      amount: 150,
      isRevision: true,
      rmReviewNote: 'RM reviewed the proposed intervention change.',
    },
    assert: async page => {
      await waitForText(page, 'Review intervention change');
      await waitForText(page, 'Record of decision');
      await waitForText(page, 'Recommendation for this change');
      await waitForText(page, 'Regional Manager review note');
      await waitForText(page, 'RM reviewed the proposed intervention change.');
      await waitForText(page, 'Decision on the proposed intervention change');
      await assertTextAbsent(page, 'Madison/Shelley');
    },
  },
  {
    name: 'approved-new-proposal-follow-up',
    role: 'ISET Coordinator',
    step: 'communication',
    intervention: {
      id: PROPOSAL_ID,
      status: 'approved',
      amount: 150,
      approvalFollowUp: true,
    },
    assert: async page => {
      await waitForText(page, 'Intervention approval follow-up');
      await waitForText(page, 'Intervention proposal approved');
      await waitForText(page, 'This intervention proposal has been approved. Prepare or send the client approval letter and related funding documents from here.');
      await waitForText(page, 'Approval letters');
      await waitForText(page, 'Generate drafts');
      await assertTextAbsent(page, 'letter was sent');
    },
  },
  {
    name: 'approved-revision-follow-up',
    role: 'ISET Coordinator',
    step: 'communication',
    intervention: {
      id: SOURCE_INTERVENTION_ID,
      status: 'approved',
      amount: 150,
      isRevision: false,
      revisionFollowUp: true,
    },
    assert: async page => {
      await waitForText(page, 'Intervention change follow-up');
      await waitForText(page, 'Revision approved');
      await waitForText(page, `The approved revision was applied to ${SOURCE_TITLE}. Prepare or send the funding revision letter from here.`);
      await waitForText(page, 'Funding revision letters');
      await waitForText(page, 'Generate drafts');
      await assertTextAbsent(page, 'Revision complete');
      await assertTextAbsent(page, 'letter was sent');
    },
  },
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.screenshotDir, { recursive: true });
  ensureLocalChromeLibraryPath();

  const chromeExecutable = findChromeExecutable();
  if (!chromeExecutable) {
    throw new Error('Could not find a Chromium executable for Puppeteer. Set PUPPETEER_EXECUTABLE_PATH.');
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chromeExecutable,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const selectedScenarios = args.scenarioNames.size
    ? scenarios.filter(scenario => args.scenarioNames.has(scenario.name))
    : scenarios;
  const unknownScenarioNames = Array.from(args.scenarioNames)
    .filter(name => !scenarios.some(scenario => scenario.name === name));
  if (unknownScenarioNames.length) {
    throw new Error(`Unknown intervention workflow smoke scenarios: ${unknownScenarioNames.join(', ')}`);
  }
  if (!selectedScenarios.length) {
    throw new Error('No intervention workflow smoke scenarios selected.');
  }

  const results = [];
  try {
    for (const scenario of selectedScenarios) {
      results.push(await runScenario(browser, args, scenario));
    }
  } finally {
    await browser.close();
  }

  const summary = {
    pass: results.every(result => result.pass),
    screenshotDir: args.screenshotDir,
    scenarios: results,
  };
  if (!summary.pass) {
    console.error(JSON.stringify(summary, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
