#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const mysql = require('mysql2/promise');

try {
  require('dotenv').config();
} catch (_) {
  // Keep usable when DB_* is already exported by the caller.
}

const APPLICATION_CONTEXT_KEY = 'applicationDecisionLetters';
const ROOT_WORKFLOW_KEYS = [
  'assessmentOtherFunding',
  'assessment_nwac_review_status',
  'decisionLetterDrafts',
  'decision_letter_drafts',
  'decisionLetter',
  'decision_letter',
  'decisionLetterPackDrafts',
  'decision_letter_pack_drafts',
  'decisionLetterSent',
  'decision_letter_sent',
  'decisionLetterSentType',
  'decision_letter_sent_type',
  'decisionLetterSentAt',
  'decision_letter_sent_at',
  'fundingDecisionReasonCode',
  'fundingDecisionReasonLabel',
  'fundingDecisionReasonExplanation',
];

const ASSESSMENT_DOCUMENT_CATEGORIES = new Set([
  'application_form',
  'financial_overview',
  'case_assessment',
  'case_assessment_approved',
  'case_assessment_redline',
  'assessment_approval_letter',
  'assessment_denial_letter',
  'funding_agreement',
]);

function parseArgs(argv) {
  const args = {
    caseId: null,
    appA: null,
    appB: null,
    stage: 'any',
    json: false,
    fixture: false,
    keepFixture: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--case-id') {
      args.caseId = Number.parseInt(argv[++index], 10);
    } else if (token === '--app-a' || token === '--application-a') {
      args.appA = Number.parseInt(argv[++index], 10);
    } else if (token === '--app-b' || token === '--application-b') {
      args.appB = Number.parseInt(argv[++index], 10);
    } else if (token === '--stage') {
      args.stage = String(argv[++index] || '').trim().toLowerCase();
    } else if (token === '--expect-app-b-unsent') {
      args.stage = 'fresh-step14';
    } else if (token === '--expect-app-b-sent') {
      args.stage = 'sent';
    } else if (token === '--fixture') {
      args.fixture = true;
    } else if (token === '--keep-fixture') {
      args.keepFixture = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  const allowedStages = new Set(['any', 'fresh-step14', 'drafted', 'sent']);
  if (!allowedStages.has(args.stage)) {
    throw new Error(`Invalid --stage value: ${args.stage}`);
  }
  if (args.keepFixture && !args.fixture) {
    throw new Error('--keep-fixture requires --fixture');
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/application-assessment-option-b-smoke.js [options]',
    '',
    'Read-only live DEV smoke by default. Use --fixture for an isolated rollback fixture.',
    '',
    'Options:',
    '  --case-id ID                 Case to inspect. Defaults to the first repeat-application case.',
    '  --app-a ID                   Prior/older application. Defaults to the oldest app on the case.',
    '  --app-b ID                   Selected/newer application. Defaults to the newest app on the case.',
    '  --stage any|fresh-step14|drafted|sent',
    '  --expect-app-b-unsent        Alias for --stage fresh-step14.',
    '  --expect-app-b-sent          Alias for --stage sent.',
    '  --fixture                    Create an isolated repeat-application fixture and roll it back.',
    '  --keep-fixture               With --fixture, commit the fixture so it can be opened in the UI.',
    '  --json                       Emit machine-readable JSON.',
    '',
    'Examples:',
    '  node scripts/application-assessment-option-b-smoke.js --case-id 1 --app-b 2 --stage fresh-step14',
    '  node scripts/application-assessment-option-b-smoke.js --fixture',
    '  node scripts/application-assessment-option-b-smoke.js --fixture --keep-fixture',
  ].join('\n');
}

function getDbConfig() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    multipleStatements: false,
  };
  if (!config.host || !config.user || !config.database) {
    throw new Error('DB_HOST, DB_USER, and DB_NAME must be set');
  }
  return config;
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function normalizeId(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function appKey(applicationId) {
  const id = normalizeId(applicationId);
  return id ? String(id) : null;
}

function getScopedContext(caseContext, applicationId) {
  const key = appKey(applicationId);
  if (!key || !caseContext || typeof caseContext !== 'object') return {};
  const applicationContexts = caseContext[APPLICATION_CONTEXT_KEY];
  const scoped = applicationContexts && typeof applicationContexts === 'object'
    ? applicationContexts[key]
    : null;
  return scoped && typeof scoped === 'object' && !Array.isArray(scoped) ? scoped : {};
}

function getSentMarker(scopedContext, letterKey) {
  const sent = scopedContext?.decisionLetterSent || scopedContext?.decision_letter_sent || null;
  if (sent && typeof sent === 'object' && !Array.isArray(sent) && sent[letterKey]) {
    return sent[letterKey];
  }
  const legacyType = scopedContext?.decisionLetterSentType || scopedContext?.decision_letter_sent_type || null;
  const legacyAt = scopedContext?.decisionLetterSentAt || scopedContext?.decision_letter_sent_at || null;
  if (legacyType === letterKey && legacyAt) return legacyAt;
  return null;
}

function hasDecisionDrafts(scopedContext) {
  return Boolean(
    scopedContext?.decisionLetterDrafts ||
    scopedContext?.decision_letter_drafts ||
    scopedContext?.decisionLetter ||
    scopedContext?.decision_letter
  );
}

function hasPackDrafts(scopedContext) {
  return Boolean(scopedContext?.decisionLetterPackDrafts || scopedContext?.decision_letter_pack_drafts);
}

function addCheck(checks, name, pass, details = {}, severity = 'high') {
  checks.push({ name, pass: Boolean(pass), severity, details });
}

async function tableExists(connection, tableName) {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS count
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?`,
    [tableName]
  );
  return Number(row?.count || 0) === 1;
}

async function resolveLiveCase(connection, args) {
  let caseId = normalizeId(args.caseId);
  if (!caseId) {
    const [[row]] = await connection.query(
      `SELECT c.id
         FROM iset_case c
         JOIN iset_application a ON a.case_id = c.id
        GROUP BY c.id
       HAVING COUNT(*) > 1
        ORDER BY c.id ASC
        LIMIT 1`
    );
    caseId = normalizeId(row?.id);
  }
  if (!caseId) {
    throw new Error('No repeat-application case was found. Pass --case-id or create a repeat-application fixture.');
  }
  return caseId;
}

async function loadCaseSnapshot(connection, args) {
  const caseId = await resolveLiveCase(connection, args);
  const [[caseRow]] = await connection.query(
    `SELECT id, case_number, client_id, status, lifecycle_status, case_context_json
       FROM iset_case
      WHERE id = ?
      LIMIT 1`,
    [caseId]
  );
  if (!caseRow) throw new Error(`Case ${caseId} not found`);

  const [applications] = await connection.query(
    `SELECT id, client_id, case_id, status, lifecycle_status, decision_outcome, row_version, created_at, updated_at
       FROM iset_application
      WHERE case_id = ?
      ORDER BY id ASC`,
    [caseId]
  );

  const appIds = applications.map(row => normalizeId(row.id)).filter(Boolean);
  const appA = normalizeId(args.appA) || appIds[0] || null;
  const appB = normalizeId(args.appB) || appIds[appIds.length - 1] || null;

  const [assessmentRows] = appIds.length
    ? await connection.query(
        `SELECT id, application_id, case_id, esdc_eligibility, recommendation, justification,
                nwac_review, nwac_reason, intervention_cost_total, proposed_interventions
           FROM iset_application_assessment
          WHERE case_id = ?
            AND application_id IN (${appIds.map(() => '?').join(', ')})
          ORDER BY application_id ASC`,
        [caseId, ...appIds]
      )
    : [[]];

  const [duplicateRows] = await connection.query(
    `SELECT application_id, COUNT(*) AS count
       FROM iset_application_assessment
      GROUP BY application_id
     HAVING COUNT(*) > 1`
  );

  const [legacyRows] = await connection.query(
    `SELECT case_id, esdc_eligibility, recommendation, justification, nwac_review, nwac_reason
       FROM iset_case_assessment
      WHERE case_id = ?`,
    [caseId]
  );

  const [documents] = await connection.query(
    `SELECT id, application_id, case_id, source, status, document_category, file_name, label, created_at
       FROM iset_document
      WHERE case_id = ?
        AND status = 'active'
        AND document_category IN (${Array.from(ASSESSMENT_DOCUMENT_CATEGORIES).map(() => '?').join(', ')})
      ORDER BY id ASC`,
    [caseId, ...Array.from(ASSESSMENT_DOCUMENT_CATEGORIES)]
  );

  return {
    case: {
      ...caseRow,
      caseContext: parseJson(caseRow.case_context_json, {}),
    },
    applications,
    appA,
    appB,
    assessments: assessmentRows || [],
    duplicateAssessmentOwners: duplicateRows || [],
    legacyAssessments: legacyRows || [],
    documents: documents || [],
  };
}

function summarizeContext(caseContext, applicationId) {
  const scoped = getScopedContext(caseContext, applicationId);
  return {
    applicationId,
    hasScopedContext: Object.keys(scoped).length > 0,
    approvalSentAt: getSentMarker(scoped, 'approval'),
    denialSentAt: getSentMarker(scoped, 'denial'),
    hasDecisionDrafts: hasDecisionDrafts(scoped),
    hasPackDrafts: hasPackDrafts(scoped),
    reviewStatus: scoped.assessment_nwac_review_status || null,
    denialReasonCode: scoped.fundingDecisionReasonCode || null,
  };
}

function runSnapshotChecks(snapshot, args) {
  const checks = [];
  const caseContext = snapshot.case.caseContext || {};
  const applicationIds = new Set(snapshot.applications.map(row => normalizeId(row.id)).filter(Boolean));
  const appA = snapshot.appA;
  const appB = snapshot.appB;
  const appASummary = summarizeContext(caseContext, appA);
  const appBSummary = summarizeContext(caseContext, appB);
  const appAAssessment = snapshot.assessments.find(row => Number(row.application_id) === Number(appA)) || null;
  const appBAssessment = snapshot.assessments.find(row => Number(row.application_id) === Number(appB)) || null;
  const rootKeysPresent = ROOT_WORKFLOW_KEYS.filter(key => Object.prototype.hasOwnProperty.call(caseContext, key));
  const applicationContexts = caseContext[APPLICATION_CONTEXT_KEY];
  const contextKeys = applicationContexts && typeof applicationContexts === 'object'
    ? Object.keys(applicationContexts)
    : [];

  addCheck(
    checks,
    'case has at least two applications',
    snapshot.applications.length >= 2,
    { applicationIds: Array.from(applicationIds) }
  );
  addCheck(checks, 'selected prior application belongs to case', applicationIds.has(appA), { appA });
  addCheck(checks, 'selected current application belongs to case', applicationIds.has(appB), { appB });
  addCheck(checks, 'selected applications are distinct', appA && appB && appA !== appB, { appA, appB });
  addCheck(
    checks,
    'application assessment owner uniqueness is intact',
    snapshot.duplicateAssessmentOwners.length === 0,
    { duplicates: snapshot.duplicateAssessmentOwners }
  );
  addCheck(
    checks,
    'current application has its own assessment row',
    Boolean(appBAssessment),
    { appB, assessmentId: appBAssessment?.id || null }
  );
  addCheck(
    checks,
    'prior/current assessment rows are not the same owner',
    !appAAssessment || !appBAssessment || Number(appAAssessment.id) !== Number(appBAssessment.id),
    { appAAssessmentId: appAAssessment?.id || null, appBAssessmentId: appBAssessment?.id || null }
  );
  addCheck(
    checks,
    'repeat-application case has no root assessment workflow context keys',
    rootKeysPresent.length === 0,
    { rootKeysPresent }
  );
  addCheck(
    checks,
    'current application has application-scoped review context',
    Boolean(appBSummary.reviewStatus),
    appBSummary,
    'medium'
  );
  addCheck(
    checks,
    'current application has no inherited approval sent marker unless stage expects sent',
    args.stage === 'sent' ? Boolean(appBSummary.approvalSentAt) : !appBSummary.approvalSentAt,
    appBSummary
  );

  if (args.stage === 'fresh-step14') {
    addCheck(
      checks,
      'fresh Step 14 current application has no inherited letter drafts or pack drafts',
      !appBSummary.hasDecisionDrafts && !appBSummary.hasPackDrafts,
      appBSummary
    );
  }
  if (args.stage === 'sent') {
    const appBDecisionDocs = snapshot.documents.filter(row =>
      Number(row.application_id) === Number(appB) &&
      ['assessment_approval_letter', 'assessment_denial_letter'].includes(String(row.document_category || ''))
    );
    addCheck(
      checks,
      'sent current application has a decision letter document attached to current application',
      appBDecisionDocs.length > 0,
      { appB, documentIds: appBDecisionDocs.map(row => row.id) }
    );
  }

  const documentsWithInvalidApplication = snapshot.documents.filter(row => {
    const documentApplicationId = normalizeId(row.application_id);
    return documentApplicationId && !applicationIds.has(documentApplicationId);
  });
  const generatedApplicationlessDocs = snapshot.documents.filter(row => !normalizeId(row.application_id));
  addCheck(
    checks,
    'assessment/decision documents do not point outside this case applications',
    documentsWithInvalidApplication.length === 0,
    { documentIds: documentsWithInvalidApplication.map(row => row.id) }
  );
  addCheck(
    checks,
    'assessment/decision documents are application-associated',
    generatedApplicationlessDocs.length === 0,
    { documentIds: generatedApplicationlessDocs.map(row => row.id) },
    'medium'
  );

  return {
    caseId: snapshot.case.id,
    caseNumber: snapshot.case.case_number || null,
    appA,
    appB,
    stage: args.stage,
    applications: snapshot.applications.map(row => ({
      id: row.id,
      status: row.status,
      lifecycleStatus: row.lifecycle_status,
      decisionOutcome: row.decision_outcome,
      rowVersion: row.row_version,
    })),
    assessments: snapshot.assessments.map(row => ({
      id: row.id,
      applicationId: row.application_id,
      esdcEligibility: row.esdc_eligibility,
      recommendation: row.recommendation,
      nwacReview: row.nwac_review,
      costTotal: row.intervention_cost_total,
    })),
    context: {
      rootKeysPresent,
      scopedApplicationKeys: contextKeys,
      appA: appASummary,
      appB: appBSummary,
    },
    documents: snapshot.documents.map(row => ({
      id: row.id,
      applicationId: row.application_id,
      category: row.document_category,
      source: row.source,
      label: row.label,
    })),
    legacyAssessmentCount: snapshot.legacyAssessments.length,
    checks,
  };
}

async function createFixture(connection) {
  const stamp = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const applicantEmail = `option-b-smoke-${stamp}@example.invalid`;
  const [userResult] = await connection.query(
    `INSERT INTO user (name, email, email_verified, preferred_language)
     VALUES (?, ?, 1, 'en')`,
    [`Option B Smoke ${stamp}`, applicantEmail]
  );
  const userId = Number(userResult.insertId);

  const [clientResult] = await connection.query(
    `INSERT INTO client (first_name, last_name, applicant_account_email, applicant_account_status, applicant_activated_at)
     VALUES ('OptionB', 'Smoke', ?, 'activated', NOW())`,
    [applicantEmail]
  );
  const clientId = Number(clientResult.insertId);

  const caseContext = {
    fixture: 'application-assessment-option-b-smoke',
    [APPLICATION_CONTEXT_KEY]: {},
  };
  const [caseResult] = await connection.query(
    `INSERT INTO iset_case (case_number, client_id, status, lifecycle_status, stage, opened_at, case_context_json)
     VALUES (?, ?, 'active', 'active', 'application_assessment_option_b_smoke', NOW(), CAST(? AS JSON))`,
    [`OPTB-${stamp}`.slice(0, 32), clientId, JSON.stringify(caseContext)]
  );
  const caseId = Number(caseResult.insertId);

  const createApplication = async ({ reference, status, lifecycleStatus, decisionOutcome = null }) => {
    const payload = {
      fixture: 'application-assessment-option-b-smoke',
      submission_snapshot: { reference_number: reference },
      personal: { full_name: 'OptionB Smoke' },
      answers: { 'preferred-name': 'OptionB' },
    };
    const [submissionResult] = await connection.query(
      `INSERT INTO iset_application_submission
        (user_id, workflow_id, reference_number, status, intake_payload, schema_snapshot, history, doc_refs, locale)
       VALUES (?, 'iset-v1', ?, 'submitted', CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), 'en')`,
      [userId, reference, JSON.stringify(payload), JSON.stringify({}), JSON.stringify([]), JSON.stringify([])]
    );
    const [applicationResult] = await connection.query(
      `INSERT INTO iset_application
        (submission_id, client_id, case_id, payload_json, status, lifecycle_status, decision_outcome, awaiting_reason)
       VALUES (?, ?, ?, CAST(? AS JSON), ?, ?, ?, 'none')`,
      [submissionResult.insertId, clientId, caseId, JSON.stringify(payload), status, lifecycleStatus, decisionOutcome]
    );
    return Number(applicationResult.insertId);
  };

  const appA = await createApplication({
    reference: `OPTB-A-${stamp}`.slice(0, 32),
    status: 'completed',
    lifecycleStatus: 'closed',
  });
  const appB = await createApplication({
    reference: `OPTB-B-${stamp}`.slice(0, 32),
    status: 'approved',
    lifecycleStatus: 'decision_recorded',
    decisionOutcome: 'approved',
  });

  await connection.query(
    `INSERT INTO iset_application_assessment
      (case_id, application_id, date_of_assessment, overview, employment_goals, esdc_eligibility,
       recommendation, justification, nwac_review, nwac_reason, intervention_cost_total, proposed_interventions)
     VALUES
      (?, ?, CURRENT_DATE(), 'Application A assessment', 'A goals', 'EI Reach Back', 'approve', 'A justification', 'agree', NULL, 111, CAST(? AS JSON)),
      (?, ?, CURRENT_DATE(), 'Application B assessment', 'B goals', 'CRF', 'approve', 'B justification', 'agree', NULL, 222, CAST(? AS JSON))`,
    [
      caseId,
      appA,
      JSON.stringify([{ id: 'a', code: '1', costLines: [{ type: 'OtherEligibleCost', amount: '111' }] }]),
      caseId,
      appB,
      JSON.stringify([{ id: 'b', code: '2', costLines: [{ type: 'OtherEligibleCost', amount: '222' }] }]),
    ]
  );

  const updatedContext = {
    fixture: 'application-assessment-option-b-smoke',
    [APPLICATION_CONTEXT_KEY]: {
      [String(appA)]: {
        assessment_nwac_review_status: 'approve',
        decisionLetterSent: { approval: '2026-05-08T00:00:00.000Z' },
        decisionLetterDrafts: { approval: { decision_intro: 'Prior application only' } },
        decisionLetterPackDrafts: { approval: { generated_at: '2026-05-08T00:00:00.000Z' } },
      },
      [String(appB)]: {
        assessment_nwac_review_status: 'approve',
      },
    },
  };
  await connection.query(
    'UPDATE iset_case SET case_context_json = CAST(? AS JSON) WHERE id = ?',
    [JSON.stringify(updatedContext), caseId]
  );

  const docRows = [
    [appA, 'case_assessment_approved', `option-b-smoke/${stamp}/app-a-assessment.pdf`, 'A approved assessment'],
    [appB, 'case_assessment_approved', `option-b-smoke/${stamp}/app-b-assessment.pdf`, 'B approved assessment'],
  ];
  for (const [applicationId, category, filePath, label] of docRows) {
    await connection.query(
      `INSERT INTO iset_document
        (user_id, applicant_user_id, client_id, application_id, case_id, source, file_name, file_path,
         mime_type, label, metadata, size_bytes, checksum_sha256, status, document_category, visibility)
       VALUES (?, ?, ?, ?, ?, 'system_generated', ?, ?, 'application/pdf', ?, CAST(? AS JSON), 0, ?, 'active', ?, 'internal')`,
      [
        userId,
        userId,
        clientId,
        applicationId,
        caseId,
        `${category}-${applicationId}.pdf`,
        filePath,
        label,
        JSON.stringify({ fixture: 'application-assessment-option-b-smoke' }),
        crypto.createHash('sha256').update(filePath).digest('hex'),
        category,
      ]
    );
  }

  return { caseId, appA, appB };
}

function renderHuman(result) {
  const lines = [];
  lines.push(`Option B assessment smoke: ${result.pass ? 'PASS' : 'FAIL'}`);
  lines.push(`Case ${result.caseId}${result.caseNumber ? ` (${result.caseNumber})` : ''}; app A ${result.appA}; app B ${result.appB}; stage ${result.stage}`);
  if (result.fixtureCommitted) {
    lines.push(`Persistent fixture committed: case ${result.caseId}, app A ${result.appA}, app B ${result.appB}`);
  } else if (result.fixtureRolledBack) {
    lines.push('Fixture transaction rolled back.');
  }
  lines.push('');
  for (const check of result.checks) {
    const marker = check.pass ? 'PASS' : 'FAIL';
    lines.push(`${marker} ${check.name}`);
    if (!check.pass || check.severity !== 'high') {
      lines.push(`  ${JSON.stringify(check.details)}`);
    }
  }
  lines.push('');
  lines.push('Context summary:');
  lines.push(`  root keys: ${result.context.rootKeysPresent.length ? result.context.rootKeysPresent.join(', ') : 'none'}`);
  lines.push(`  app A sent approval: ${result.context.appA.approvalSentAt || 'no'}`);
  lines.push(`  app B sent approval: ${result.context.appB.approvalSentAt || 'no'}`);
  lines.push(`  app B drafts: ${result.context.appB.hasDecisionDrafts ? 'yes' : 'no'}; pack drafts: ${result.context.appB.hasPackDrafts ? 'yes' : 'no'}`);
  lines.push(`  active assessment/decision docs: ${result.documents.length}`);
  return lines.join('\n');
}

async function runLive(connection, args) {
  const snapshot = await loadCaseSnapshot(connection, args);
  return runSnapshotChecks(snapshot, args);
}

async function runFixture(connection, args) {
  await connection.beginTransaction();
  try {
    const fixture = await createFixture(connection);
    const snapshot = await loadCaseSnapshot(connection, {
      ...args,
      caseId: fixture.caseId,
      appA: fixture.appA,
      appB: fixture.appB,
      stage: args.stage === 'any' ? 'fresh-step14' : args.stage,
    });
    const result = runSnapshotChecks(snapshot, {
      ...args,
      stage: args.stage === 'any' ? 'fresh-step14' : args.stage,
    });
    result.fixture = fixture;
    const fixtureChecksPass = result.checks.every(check => check.pass);
    if (args.keepFixture && fixtureChecksPass) {
      await connection.commit();
      result.fixtureCommitted = true;
      result.fixtureRolledBack = false;
    } else {
      result.fixtureRolledBack = true;
      await connection.rollback();
    }
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const connection = await mysql.createConnection(getDbConfig());
  try {
    const checks = [];
    const hasApplicationAssessment = await tableExists(connection, 'iset_application_assessment');
    addCheck(checks, 'application assessment table exists', hasApplicationAssessment, {
      table: 'iset_application_assessment',
    });
    if (!hasApplicationAssessment) {
      const result = {
        pass: false,
        mode: args.fixture ? 'fixture' : 'live',
        stage: args.stage,
        checks,
      };
      if (args.json) console.log(JSON.stringify(result, null, 2));
      else console.log(renderHuman({ ...result, caseId: 'n/a', appA: 'n/a', appB: 'n/a', context: { rootKeysPresent: [], appA: {}, appB: {} }, documents: [] }));
      process.exitCode = 1;
      return;
    }

    const result = args.fixture
      ? await runFixture(connection, args)
      : await runLive(connection, args);
    result.mode = args.fixture ? 'fixture' : 'live';
    result.checks = [...checks, ...result.checks];
    result.pass = result.checks.every(check => check.pass);

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(renderHuman(result));
    }

    if (!result.pass) {
      process.exitCode = 1;
    }
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(`application-assessment-option-b-smoke failed: ${error.message}`);
  process.exit(1);
});
