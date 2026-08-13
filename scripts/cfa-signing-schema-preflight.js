#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const mysql = require('mysql2/promise');

const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');

const REQUIRED_COLUMNS = Object.freeze({
  user: Object.freeze(['id', 'name', 'email', 'cognito_sub', 'email_verified', 'suspended', 'preferred_language']),
  client: Object.freeze(['id', 'first_name', 'last_name', 'applicant_cognito_sub', 'applicant_cognito_username', 'applicant_account_status', 'applicant_account_email', 'applicant_activated_at']),
  iset_case: Object.freeze(['id', 'case_number', 'client_id', 'assigned_staff_profile_id', 'status', 'lifecycle_status', 'stage', 'opened_at', 'case_context_json']),
  iset_application_submission: Object.freeze(['id', 'user_id', 'reference_number', 'intake_payload']),
  iset_application: Object.freeze(['id', 'submission_id', 'client_id', 'case_id', 'payload_json', 'status', 'lifecycle_status', 'decision_outcome', 'awaiting_reason', 'closure_reason', 'docs_requested_active', 'docs_requested_at', 'docs_requested_cleared_at', 'docs_requested_source', 'version', 'row_version']),
  messages: Object.freeze(['id', 'sender_actor_type', 'sender_user_id', 'recipient_actor_type', 'recipient_user_id', 'case_id', 'application_id', 'subject', 'body', 'status']),
  signing_request: Object.freeze(['id', 'workflow_id', 'workflow_name', 'workflow_type', 'case_id', 'participant_user_id', 'created_by_user_id', 'status', 'resolved_schema_json', 'signed_payload_json', 'signed_at', 'completion_event_id', 'artifact_url', 'checklist_doc_type', 'completion_token', 'completion_payload_hash', 'completion_artifact_key', 'completion_claim_token', 'completion_claim_expires_at', 'completion_started_at', 'updated_at']),
  message_signing_request: Object.freeze(['message_id', 'signing_request_id']),
  cfa_series: Object.freeze(['id', 'case_id', 'template_key']),
  cfa_version: Object.freeze(['id', 'series_id', 'version_number', 'status', 'sent_at', 'signed_at', 'signed_by_participant_id', 'snapshot_schema_version', 'metadata_json']),
  cfa_version_documents: Object.freeze(['id', 'cfa_version_id', 'document_type', 'document_id']),
  iset_document: Object.freeze(['id', 'user_id', 'applicant_user_id', 'client_id', 'application_id', 'case_id', 'signing_request_id', 'origin_message_id', 'source', 'file_name', 'file_path', 'mime_type', 'label', 'metadata', 'status', 'document_category', 'visibility', 'checksum_sha256']),
  iset_event_entry: Object.freeze(['id', 'event_type', 'subject_type', 'subject_id', 'actor_applicant_user_id', 'payload_json', 'notification_delivery_mode']),
  iset_event_delivery: Object.freeze(['id', 'event_id', 'channel', 'audience_key', 'status', 'payload_json']),
  iset_internal_notification: Object.freeze(['id', 'event_key', 'metadata']),
  notification_setting: Object.freeze(['id', 'event', 'role', 'language', 'enabled', 'email_alert', 'bell_alert', 'template_id']),
  iset_case_watch: Object.freeze(['case_id', 'staff_profile_id']),
  user_session_audit: Object.freeze(['session_key', 'user_id', 'issued_at', 'last_seen_at', 'ip_hash', 'user_agent_hash']),
  workflow: Object.freeze(['id', 'name', 'status', 'workflow_type', 'document_type']),
  iset_review_workflow: Object.freeze(['id', 'application_id', 'workflow_type', 'current_stage', 'archived_at']),
  iset_case_reminder: Object.freeze(['id', 'case_id', 'application_id', 'status', 'deleted_at', 'metadata_json']),
  staff_profiles: Object.freeze(['id', 'cognito_sub', 'display_name', 'name']),
});

const REQUIRED_OBJECTS = Object.freeze(Object.keys(REQUIRED_COLUMNS));
const REQUIRED_TABLES = REQUIRED_OBJECTS;
const ALLOWED_OUTPUT_ALIASES = Object.freeze([
  'application_case_id',
  'application_id',
  'cfa_link_count',
  'document_count',
  'event_count',
  'message_case_id',
  'row_count',
]);
const ALLOWED_TABLE_ALIASES = Object.freeze(['a', 'c', 'cvd', 'd', 'e', 'm', 'msr', 'sp', 'sr']);

const WORKFLOW_ADMISSION_SQL = `SELECT id, name, status, workflow_type, document_type
   FROM workflow
  WHERE document_type = ?
    AND status = ?
  ORDER BY id ASC
  LIMIT 2`;
const NOTIFICATION_ADMISSION_SQL = `SELECT id, event, role, language, enabled, email_alert, bell_alert, template_id
   FROM notification_setting
  WHERE event = ?
    AND enabled = ?
  ORDER BY id ASC`;

const ZERO_MARKER_STATEMENTS = Object.freeze([
  Object.freeze({ id: 'applicant-user', sql: 'SELECT COUNT(*) FROM user WHERE email = ?', value: model => model.applicantEmail }),
  Object.freeze({ id: 'staff-user', sql: 'SELECT COUNT(*) FROM user WHERE email = ?', value: model => model.staffEmail }),
  Object.freeze({ id: 'client', sql: 'SELECT COUNT(*) FROM client WHERE applicant_account_email = ?', value: model => model.applicantEmail }),
  Object.freeze({ id: 'case', sql: 'SELECT COUNT(*) FROM iset_case WHERE case_number = ?', value: model => model.caseNumber }),
  Object.freeze({ id: 'submission', sql: 'SELECT COUNT(*) FROM iset_application_submission WHERE reference_number = ?', value: model => model.referenceNumber }),
  Object.freeze({ id: 'message', sql: 'SELECT COUNT(*) FROM messages WHERE subject = ?', value: model => model.messageSubject }),
]);

const RESIDUE_IDENTIFIER_STATEMENTS = Object.freeze([
  Object.freeze({ id: 'application', sql: 'SELECT COUNT(*) FROM iset_application WHERE id = ?', field: 'applicationId' }),
  Object.freeze({ id: 'signing-request', sql: 'SELECT COUNT(*) FROM signing_request WHERE id = ?', field: 'signingRequestId' }),
  Object.freeze({ id: 'cfa-series', sql: 'SELECT COUNT(*) FROM cfa_series WHERE id = ?', field: 'cfaSeriesId' }),
  Object.freeze({ id: 'cfa-version', sql: 'SELECT COUNT(*) FROM cfa_version WHERE id = ?', field: 'cfaVersionId' }),
  Object.freeze({ id: 'event', sql: 'SELECT COUNT(*) FROM iset_event_entry WHERE id = ?', field: 'completionEventId' }),
  Object.freeze({ id: 'message-link', sql: 'SELECT COUNT(*) FROM message_signing_request WHERE signing_request_id = ?', field: 'signingRequestId' }),
  Object.freeze({ id: 'version-document-link', sql: 'SELECT COUNT(*) FROM cfa_version_documents WHERE cfa_version_id = ?', field: 'cfaVersionId' }),
  Object.freeze({ id: 'documents', sql: 'SELECT COUNT(*) FROM iset_document WHERE application_id = ? AND case_id = ?', fields: Object.freeze(['applicationId', 'caseId']) }),
  Object.freeze({ id: 'event-delivery', sql: 'SELECT COUNT(*) FROM iset_event_delivery WHERE event_id = ?', field: 'completionEventId' }),
  Object.freeze({ id: 'internal-notification', sql: 'SELECT COUNT(*) FROM iset_internal_notification WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, ?)) = ?', values: Object.freeze(['$.eventId']), field: 'completionEventId' }),
  Object.freeze({ id: 'case-reminder', sql: 'SELECT COUNT(*) FROM iset_case_reminder WHERE application_id = ?', field: 'applicationId' }),
  Object.freeze({ id: 'review-workflow', sql: 'SELECT COUNT(*) FROM iset_review_workflow WHERE application_id = ?', field: 'applicationId' }),
  Object.freeze({ id: 'session-audit', sql: 'SELECT COUNT(*) FROM user_session_audit WHERE user_id = ?', field: 'applicantSub' }),
]);

function residueStatementPlan(fixture) {
  const marker = fixtureIdentity(fixture.attemptId);
  const statements = ZERO_MARKER_STATEMENTS.map(statement => ({
    id: statement.id,
    sql: statement.sql,
    params: [statement.value(marker)],
  }));
  for (const statement of RESIDUE_IDENTIFIER_STATEMENTS) {
    const params = [
      ...(statement.values || []),
      ...(statement.fields || (statement.field ? [statement.field] : [])).map(field => fixture[field]),
    ];
    statements.push({ id: statement.id, sql: statement.sql, params });
  }
  return statements;
}

function statementCatalogue(attemptId) {
  const marker = fixtureIdentity(attemptId);
  const json = JSON.stringify({ cfaSigningSmoke: true, attemptId });
  const statements = [
    ['fixture.applicant-user', `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
     VALUES (?, ?, ?, 1, 0, 'en')`, ['CFA Signing Smoke', marker.applicantEmail, '00000000-0000-4000-8000-000000000001']],
    ['fixture.staff-user', `INSERT INTO user (name, email, email_verified, suspended, preferred_language)
     VALUES (?, ?, 1, 0, 'en')`, ['CFA Smoke Case Manager', marker.staffEmail]],
    ['fixture.client', `INSERT INTO client
       (first_name, last_name, applicant_cognito_sub, applicant_cognito_username,
        applicant_account_status, applicant_account_email, applicant_activated_at)
     VALUES (?, ?, ?, ?, 'activated', ?, NOW())`, ['CFA', 'Signing Smoke', '00000000-0000-4000-8000-000000000001', marker.applicantEmail, marker.applicantEmail]],
    ['fixture.case', `INSERT INTO iset_case
       (case_number, client_id, status, lifecycle_status, stage, opened_at, case_context_json)
     VALUES (?, ?, 'active', 'active', 'case_management', NOW(), CAST(? AS JSON))`, [marker.caseNumber, 1, json]],
    ['fixture.submission', `INSERT INTO iset_application_submission
       (user_id, reference_number, intake_payload)
     VALUES (?, ?, CAST(? AS JSON))`, [1, marker.referenceNumber, json]],
    ['fixture.application', `INSERT INTO iset_application
       (submission_id, client_id, case_id, payload_json, status, lifecycle_status, version, row_version)
     VALUES (?, ?, ?, CAST(? AS JSON), 'in_review', 'assessment', 1, 1)`, [1, 1, 1, json]],
    ['fixture.cfa-series', 'INSERT INTO cfa_series (case_id, template_key) VALUES (?, ?)', [1, 'ISET_CFA_STANDARD']],
    ['fixture.cfa-version', `INSERT INTO cfa_version
       (series_id, version_number, status, sent_at, snapshot_schema_version, metadata_json)
     VALUES (?, 1, 'sent', NOW(), '1.1', CAST(? AS JSON))`, [1, json]],
    ['fixture.prior-document', `INSERT INTO iset_document
       (applicant_user_id, client_id, application_id, case_id, source, file_name, file_path,
        mime_type, label, metadata, status, document_category, visibility)
     VALUES (?, ?, ?, ?, 'system_generated', ?, ?, 'application/pdf', ?, CAST(? AS JSON),
        'active', 'funding_agreement', 'shared')`, [1, 1, 1, 1, 'prior.pdf', `smoke/cfa/${marker.suffix}/prior-clean.pdf`, 'CFA v1', json]],
    ['fixture.prior-link', `INSERT INTO cfa_version_documents (cfa_version_id, document_type, document_id)
     VALUES (?, 'clean', ?)`, [1, 1]],
    ['fixture.signing-request', `INSERT INTO signing_request
       (workflow_id, workflow_name, workflow_type, case_id, participant_user_id,
        created_by_user_id, status, resolved_schema_json, checklist_doc_type)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', CAST(? AS JSON), 'funding_agreement')`, [1, 'Funding Agreement', 'consent-cm-prefill', 1, 1, 1, json]],
    ['fixture.message', `INSERT INTO messages
       (sender_actor_type, sender_user_id, recipient_actor_type, recipient_user_id,
        case_id, application_id, subject, body, status)
     VALUES ('local_user', ?, 'applicant_user', ?, ?, ?, ?, ?, 'unread')`, [1, 1, 1, 1, marker.messageSubject, 'Synthetic CFA']],
    ['fixture.message-link', 'INSERT INTO message_signing_request (message_id, signing_request_id) VALUES (?, ?)', [1, 1]],
    ['assert.signing-request', `SELECT id, status, signed_at, signed_payload_json, completion_event_id, artifact_url
       FROM signing_request WHERE id = ? LIMIT 1`, [1]],
    ['assert.cfa-version', `SELECT id, status, signed_at, signed_by_participant_id, metadata_json
       FROM cfa_version WHERE id = ? LIMIT 1`, [1]],
    ['assert.document-link', `SELECT \`cvd\`.document_id, \`d\`.applicant_user_id, \`d\`.client_id, \`d\`.application_id, \`d\`.case_id,
            \`d\`.signing_request_id, \`d\`.file_path, \`d\`.status
       FROM cfa_version_documents \`cvd\`
       JOIN iset_document \`d\` ON \`d\`.id = \`cvd\`.document_id
      WHERE \`cvd\`.cfa_version_id = ? AND \`cvd\`.document_type = 'clean'
      LIMIT 1`, [1]],
    ['assert.prior-document', 'SELECT status FROM iset_document WHERE id = ? LIMIT 1', [1]],
    ['assert.event', `SELECT id, event_type, subject_type, subject_id, actor_applicant_user_id, payload_json
       FROM iset_event_entry WHERE id = ? LIMIT 1`, ['00000000-0000-4000-8000-000000000002']],
    ['assert.idempotency-request', `SELECT signed_at, signed_payload_json, artifact_url, completion_event_id
       FROM signing_request WHERE id = ? LIMIT 1`, [1]],
    ['assert.idempotency-counts', `SELECT
       (SELECT COUNT(*) FROM iset_document \`d\` WHERE \`d\`.signing_request_id = ?) AS \`document_count\`,
       (SELECT COUNT(*) FROM cfa_version_documents \`cvd\` WHERE \`cvd\`.cfa_version_id = ? AND \`cvd\`.document_type = 'clean') AS \`cfa_link_count\`,
       (SELECT COUNT(*) FROM iset_event_entry \`e\` WHERE \`e\`.id = ?) AS \`event_count\``, [1, 1, '00000000-0000-4000-8000-000000000002']],
    ['cleanup.resolve-applicant', 'SELECT id FROM user WHERE email = ? ORDER BY id ASC LIMIT 2', [marker.applicantEmail]],
    ['cleanup.resolve-staff', 'SELECT id FROM user WHERE email = ? ORDER BY id ASC LIMIT 2', [marker.staffEmail]],
    ['cleanup.resolve-client', 'SELECT id FROM client WHERE applicant_account_email = ? ORDER BY id ASC LIMIT 2', [marker.applicantEmail]],
    ['cleanup.resolve-case', 'SELECT id FROM iset_case WHERE case_number = ? ORDER BY id ASC LIMIT 2', [marker.caseNumber]],
    ['cleanup.resolve-submission', 'SELECT id FROM iset_application_submission WHERE reference_number = ? ORDER BY id ASC LIMIT 2', [marker.referenceNumber]],
    ['cleanup.resolve-message', 'SELECT id FROM messages WHERE subject = ? ORDER BY id ASC LIMIT 2', [marker.messageSubject]],
    ['cleanup.resolve-application', 'SELECT id FROM iset_application WHERE submission_id = ? AND client_id = ? AND case_id = ? ORDER BY id ASC LIMIT 2', [1, 1, 1]],
    ['cleanup.resolve-series', 'SELECT id FROM cfa_series WHERE case_id = ? ORDER BY id ASC LIMIT 2', [1]],
    ['cleanup.resolve-version', 'SELECT id FROM cfa_version WHERE series_id = ? ORDER BY id ASC LIMIT 2', [1]],
    ['cleanup.resolve-request', 'SELECT id, completion_event_id, artifact_url FROM signing_request WHERE case_id = ? AND participant_user_id = ? AND checklist_doc_type = ? ORDER BY id ASC LIMIT 2', [1, 1, 'funding_agreement']],
    ['cleanup.resolve-documents', 'SELECT id, file_path FROM iset_document WHERE application_id = ? AND case_id = ? ORDER BY id ASC LIMIT 3', [1, 1]],
    ['cleanup.session-audit', 'DELETE FROM user_session_audit WHERE user_id = ?', ['00000000-0000-4000-8000-000000000001']],
    ['cleanup.internal-notification', 'DELETE FROM iset_internal_notification WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, ?)) = ?', ['$.eventId', '00000000-0000-4000-8000-000000000002']],
    ['cleanup.event-delivery', 'DELETE FROM iset_event_delivery WHERE event_id = ?', ['00000000-0000-4000-8000-000000000002']],
    ['cleanup.event', 'DELETE FROM iset_event_entry WHERE id = ?', ['00000000-0000-4000-8000-000000000002']],
    ['cleanup.version-documents', 'DELETE FROM cfa_version_documents WHERE cfa_version_id = ?', [1]],
    ['cleanup.message-link', 'DELETE FROM message_signing_request WHERE signing_request_id = ?', [1]],
    ['cleanup.document', 'DELETE FROM iset_document WHERE id = ?', [1]],
    ['cleanup.signing-request', 'DELETE FROM signing_request WHERE id = ?', [1]],
    ['cleanup.message', 'DELETE FROM messages WHERE id = ?', [1]],
    ['cleanup.reminder', 'DELETE FROM iset_case_reminder WHERE application_id = ?', [1]],
    ['cleanup.review-workflow', 'DELETE FROM iset_review_workflow WHERE application_id = ?', [1]],
    ['cleanup.cfa-version', 'DELETE FROM cfa_version WHERE id = ?', [1]],
    ['cleanup.cfa-series', 'DELETE FROM cfa_series WHERE id = ?', [1]],
    ['cleanup.application', 'DELETE FROM iset_application WHERE id = ?', [1]],
    ['cleanup.submission', 'DELETE FROM iset_application_submission WHERE id = ?', [1]],
    ['cleanup.case', 'DELETE FROM iset_case WHERE id = ?', [1]],
    ['cleanup.client', 'DELETE FROM client WHERE id = ?', [1]],
    ['cleanup.user', 'DELETE FROM user WHERE id = ?', [1]],
  ];
  for (const statement of residueStatementPlan({
    attemptId,
    applicationId: 1,
    caseId: 1,
    signingRequestId: 1,
    cfaSeriesId: 1,
    cfaVersionId: 1,
    completionEventId: '00000000-0000-4000-8000-000000000002',
    applicantSub: '00000000-0000-4000-8000-000000000001',
  })) {
    statements.push([`residue.${statement.id}`, statement.sql, statement.params]);
  }
  return statements.map(([id, sql, params]) => Object.freeze({ id, sql, params: Object.freeze(params) }));
}

function validateStatementCatalogue(guard, attemptId) {
  const catalogue = statementCatalogue(attemptId);
  const seen = new Set();
  return catalogue.map(statement => {
    if (seen.has(statement.id)) throw new Error(`cfa_statement_catalogue_duplicate:${statement.id}`);
    seen.add(statement.id);
    guard.validateStatement(statement.sql, statement.params);
    return {
      id: statement.id,
      sqlSha256: crypto.createHash('sha256').update(statement.sql.trim()).digest('hex'),
      parameterCount: statement.params.length,
    };
  });
}

function parseArgs(argv) {
  const args = { evidenceFile: '', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--env-file') args.envFile = path.resolve(argv[++index]);
    else if (token === '--evidence-file') args.evidenceFile = path.resolve(argv[++index]);
    else if (token === '--attempt-id') args.attemptId = argv[++index];
    else if (token === '--expected-database') args.expectedDatabase = argv[++index];
    else if (token === '--expected-db-host') args.expectedDbHost = argv[++index];
    else if (token === '--expected-db-user') args.expectedDbUser = argv[++index];
    else if (token === '--expected-db-server-hostname') args.expectedDbServerHostname = argv[++index];
    else if (token === '--expected-db-port') args.expectedDbPort = Number(argv[++index]);
    else if (token === '--expected-db-principal') args.expectedDbPrincipal = argv[++index];
    else if (token === '--expected-db-version') args.expectedDbVersion = argv[++index];
    else if (token === '--json') args.json = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  for (const key of [
    'envFile',
    'attemptId',
    'expectedDatabase',
    'expectedDbHost',
    'expectedDbUser',
    'expectedDbServerHostname',
    'expectedDbPrincipal',
    'expectedDbVersion',
  ]) {
    if (!String(args[key] || '').trim()) throw new Error(`Missing required ${key}`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/u.test(args.attemptId)) {
    throw new Error('Invalid attemptId');
  }
  if (!Number.isInteger(args.expectedDbPort) || args.expectedDbPort <= 0) {
    throw new Error('Missing or invalid expectedDbPort');
  }
  return args;
}

function readEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function fixtureIdentity(attemptId) {
  const suffix = crypto.createHash('sha256').update(attemptId).digest('hex').slice(0, 16);
  return Object.freeze({
    attemptId,
    suffix,
    applicantEmail: `cfa-signing-test-${suffix}@example.test`,
    staffEmail: `cfa-signing-staff-${suffix}@example.test`,
    caseNumber: `CFA-TEST-${suffix.toUpperCase()}`,
    referenceNumber: `CFA-${suffix.toUpperCase()}`,
    messageSubject: `CFA signing TEST ${suffix}`,
  });
}

function connectionConfig(env) {
  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    multipleStatements: false,
  };
}

function createGuard(connection, args, env, onBeforeStatementExecute = null) {
  return createLiveMysqlSchemaGuard({
    connection,
    expectedIdentity: {
      database: args.expectedDatabase,
      configuredHost: args.expectedDbHost,
      configuredUser: args.expectedDbUser,
      serverHostname: args.expectedDbServerHostname,
      port: args.expectedDbPort,
      currentUser: args.expectedDbPrincipal,
      version: args.expectedDbVersion,
    },
    configuredIdentity: {
      database: env.DB_NAME,
      host: env.DB_HOST,
      user: env.DB_USER,
      port: Number(env.DB_PORT || 3306),
    },
    requiredObjects: REQUIRED_OBJECTS.map(name => ({ name, type: 'table' })),
    absentColumns: [{ object: 'signing_request', name: 'application_id' }],
    allowedOutputAliases: ALLOWED_OUTPUT_ALIASES,
    allowedTableAliases: ALLOWED_TABLE_ALIASES,
    onBeforeStatementExecute,
  });
}

function assertRequiredColumns(guard) {
  for (const [objectName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
    const proof = guard.getObjectProof(objectName);
    if (!proof) throw new Error(`cfa_required_object_unproved:${objectName}`);
    const live = new Set(proof.columns.map(column => column.name));
    const missing = requiredColumns.filter(column => !live.has(column));
    if (missing.length) throw new Error(`cfa_required_columns_unproved:${objectName}:${missing.join(',')}`);
  }
}

function countFromNativeRow(row) {
  const values = Object.values(row || {});
  if (values.length !== 1 || !Number.isInteger(Number(values[0])) || Number(values[0]) < 0) {
    throw new Error('cfa_prerequisite_count_malformed');
  }
  return Number(values[0]);
}

async function executePrerequisiteReads(guard, attemptId) {
  const db = guard.createGuardedConnection();
  const [workflowRows] = await db.execute(WORKFLOW_ADMISSION_SQL, ['funding_agreement', 'active']);
  if (!Array.isArray(workflowRows) || workflowRows.length !== 1) {
    throw new Error(`cfa_workflow_selection_not_unique:${Array.isArray(workflowRows) ? workflowRows.length : 'malformed'}`);
  }
  const workflow = workflowRows[0];
  if (
    !Number.isInteger(Number(workflow.id)) || Number(workflow.id) <= 0 ||
    String(workflow.name || '').trim() === '' ||
    String(workflow.workflow_type || '').trim() === '' ||
    workflow.status !== 'active' ||
    workflow.document_type !== 'funding_agreement'
  ) {
    throw new Error('cfa_workflow_selection_malformed');
  }

  const [notificationRows] = await db.execute(NOTIFICATION_ADMISSION_SQL, ['document_signed', 1]);
  if (!Array.isArray(notificationRows)) throw new Error('cfa_notification_admission_malformed');
  const emailEnabled = notificationRows.filter(row => Number(row.email_alert || 0) !== 0);
  if (emailEnabled.length) throw new Error(`cfa_document_signed_email_enabled:${emailEnabled.map(row => row.id).join(',')}`);

  const marker = fixtureIdentity(attemptId);
  const zeroMarker = [];
  for (const statement of ZERO_MARKER_STATEMENTS) {
    const [rows] = await db.execute(statement.sql, [statement.value(marker)]);
    const count = countFromNativeRow(rows?.[0]);
    zeroMarker.push({ id: statement.id, count });
  }
  const residue = zeroMarker.filter(item => item.count !== 0);
  if (residue.length) throw new Error(`cfa_attempt_marker_not_clean:${JSON.stringify(residue)}`);

  return {
    workflow: {
      id: Number(workflow.id),
      name: workflow.name,
      status: workflow.status,
      workflowType: workflow.workflow_type,
      documentType: workflow.document_type,
    },
    notificationSettings: notificationRows.map(row => ({
      id: Number(row.id),
      event: row.event,
      role: row.role,
      language: row.language,
      enabled: Number(row.enabled),
      emailAlert: Number(row.email_alert || 0),
      bellAlert: Number(row.bell_alert || 0),
      templateId: row.template_id == null ? null : Number(row.template_id),
    })),
    noEmail: true,
    marker,
    zeroMarker,
  };
}

function stableProof(evidence) {
  return {
    identity: evidence.identity,
    structuralDdlHashes: evidence.structuralDdlHashes,
    objects: Object.fromEntries(Object.entries(evidence.objects).map(([name, proof]) => [name, {
      type: proof.type,
      structuralDdlHash: proof.structuralDdlHash,
      columnsHash: proof.columnsHash,
      indexesHash: proof.indexesHash,
      constraintsHash: proof.constraintsHash,
    }])),
  };
}

function compareProofs(first, second) {
  const firstStable = stableProof(first);
  const secondStable = stableProof(second);
  if (JSON.stringify(firstStable) !== JSON.stringify(secondStable)) {
    throw new Error('cfa_metadata_proofs_conflict');
  }
  return {
    stable: true,
    structuralSha256: crypto.createHash('sha256').update(JSON.stringify(firstStable)).digest('hex'),
    rawDdlChangedObjects: Object.keys(first.objects).filter(name => (
      first.objects[name].rawDdlHash !== second.objects[name].rawDdlHash
    )),
  };
}

async function runSinglePreflight(connection, args, env, guardFactory = createGuard) {
  const guard = guardFactory(connection, args, env);
  const evidence = await guard.preflight();
  assertRequiredColumns(guard);
  return { guard, evidence };
}

async function runAdmission(args, dependencies = {}) {
  const env = dependencies.env || readEnv(args.envFile);
  const createConnection = dependencies.createConnection || (config => mysql.createConnection(config));
  const guardFactory = dependencies.createGuard || createGuard;
  const config = connectionConfig(env);
  let firstConnection = null;
  let secondConnection = null;
  try {
    firstConnection = await createConnection(config);
    const first = await runSinglePreflight(firstConnection, args, env, guardFactory);
    const statementCatalogueEvidence = validateStatementCatalogue(first.guard, args.attemptId);
    const prerequisites = await executePrerequisiteReads(first.guard, args.attemptId);
    await firstConnection.end();
    firstConnection = null;

    secondConnection = await createConnection(config);
    const second = await runSinglePreflight(secondConnection, args, env, guardFactory);
    const secondStatementCatalogueEvidence = validateStatementCatalogue(second.guard, args.attemptId);
    if (JSON.stringify(statementCatalogueEvidence) !== JSON.stringify(secondStatementCatalogueEvidence)) {
      throw new Error('cfa_statement_catalogue_changed_between_preflights');
    }
    const comparison = compareProofs(first.evidence, second.evidence);
    return {
      status: 'PASS',
      attemptId: args.attemptId,
      first: first.evidence,
      prerequisites,
      statementCatalogue: statementCatalogueEvidence,
      second: second.evidence,
      comparison,
      verifiedStatementCount: first.guard.evidence().verifiedStatementCount,
      postflightVerifiedStatementCount: second.guard.evidence().verifiedStatementCount,
    };
  } finally {
    if (firstConnection) await firstConnection.end();
    if (secondConnection) await secondConnection.end();
  }
}

function encodeResult(result) {
  const bytes = Buffer.from(JSON.stringify(result));
  const compressed = zlib.gzipSync(bytes, { level: 9 });
  return {
    status: result.status,
    attemptId: result.attemptId,
    evidenceEncoding: 'gzip+base64',
    evidenceSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    evidenceBytes: bytes.length,
    evidenceCompressedBytes: compressed.length,
    evidence: compressed.toString('base64'),
  };
}

function decodeResult(envelope) {
  if (envelope?.evidenceEncoding !== 'gzip+base64' || typeof envelope.evidence !== 'string') {
    throw new Error('cfa_preflight_evidence_envelope_invalid');
  }
  const bytes = zlib.gunzipSync(Buffer.from(envelope.evidence, 'base64'));
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (digest !== envelope.evidenceSha256 || bytes.length !== Number(envelope.evidenceBytes)) {
    throw new Error('cfa_preflight_evidence_digest_mismatch');
  }
  return JSON.parse(bytes.toString('utf8'));
}

function writeEvidenceFile(filename, envelope) {
  if (!path.isAbsolute(filename)) throw new Error('cfa_evidence_file_must_be_absolute');
  const bytes = Buffer.from(`${JSON.stringify(envelope)}\n`, 'utf8');
  const directory = path.dirname(filename);
  const temporary = `${filename}.tmp-${process.pid}-${Date.now()}`;
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(temporary, bytes, { mode: 0o600 });
  fs.renameSync(temporary, filename);
  return {
    schemaVersion: 1,
    transport: 'cfa-admission-file-chunks-v1',
    status: envelope.status,
    attemptId: envelope.attemptId,
    evidenceFile: filename,
    evidenceBytes: bytes.length,
    evidenceFileSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    admissionEvidenceSha256: envelope.evidenceSha256,
    admissionEvidenceBytes: envelope.evidenceBytes,
    admissionEvidenceCompressedBytes: envelope.evidenceCompressedBytes,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runAdmission(args);
  const envelope = encodeResult(result);
  if (args.evidenceFile) console.log(JSON.stringify(writeEvidenceFile(args.evidenceFile, envelope)));
  else if (args.json) console.log(JSON.stringify(envelope));
  else console.log(`PASS ${result.first.identity.database} ${Object.keys(result.first.objects).length} objects ${result.prerequisites.workflow.id}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  ALLOWED_OUTPUT_ALIASES,
  ALLOWED_TABLE_ALIASES,
  NOTIFICATION_ADMISSION_SQL,
  REQUIRED_COLUMNS,
  REQUIRED_OBJECTS,
  REQUIRED_TABLES,
  RESIDUE_IDENTIFIER_STATEMENTS,
  WORKFLOW_ADMISSION_SQL,
  ZERO_MARKER_STATEMENTS,
  assertRequiredColumns,
  compareProofs,
  createGuard,
  decodeResult,
  encodeResult,
  executePrerequisiteReads,
  fixtureIdentity,
  parseArgs,
  readEnv,
  residueStatementPlan,
  runAdmission,
  statementCatalogue,
  validateStatementCatalogue,
  writeEvidenceFile,
};
