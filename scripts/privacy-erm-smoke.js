#!/usr/bin/env node
'use strict';

const mysql = require('mysql2/promise');
const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');

const EXPECTED_DEV_DATABASE_IDENTITY = Object.freeze({
  configured: Object.freeze({
    host: '172.26.176.1',
    port: 3306,
    user: 'root',
    database: 'iset_intake',
  }),
  live: Object.freeze({
    database: 'iset_intake',
    serverHostname: 'DESKTOP-PDFA51K',
    port: 3306,
    currentUser: 'root@172.26.%',
    version: '8.0.40',
  }),
});

function parseArgs(argv) {
  const args = { json: false, schemaPreflightOnly: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
    } else if (arg === '--schema-preflight-only') {
      args.schemaPreflightOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function usage() {
  return [
    'Usage: env-cmd -f .env node scripts/privacy-erm-smoke.js [--json] [--schema-preflight-only]',
    '',
    'Runs read-only privacy ERM smoke checks against the configured MySQL database.',
    'The checks use counts and constraint names only; they do not print private row payloads.',
    '--schema-preflight-only proves identity and full object metadata without ordinary reads.',
  ].join('\n');
}

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME,
    multipleStatements: false,
  };
}

const RETIRED_TABLES = [
  'govuk_component',
  'jordan_application',
  'jordan_application_draft',
  'appointment',
  'booking',
  'slot',
  'queue',
  'ticket_counter',
  'zzz_legacy_documents',
];

const RETIRED_COLUMNS = [
  ['messages', 'sender_id'],
  ['messages', 'recipient_id'],
  ['iset_case', 'assigned_to_user_id'],
  ['iset_case', 'application_id'],
  ['iset_internal_notification', 'audience_user_id'],
  ['iset_internal_notification_dismissal', 'user_id'],
  ['iset_event_receipt', 'recipient_id'],
  ['iset_application_version', 'created_by_id'],
];

const REQUIRED_FKS = [
  'fk_messages_case',
  'fk_messages_application',
  'fk_messages_sender_user',
  'fk_messages_sender_staff_profile',
  'fk_messages_recipient_user',
  'fk_messages_recipient_staff_profile',
  'fk_message_item_message',
  'fk_message_item_owner_user',
  'fk_message_attachment_message',
  'fk_message_attachment_case',
  'fk_message_attachment_client',
  'fk_message_attachment_application',
  'fk_message_attachment_user',
  'fk_iset_document_user',
  'fk_iset_document_applicant_user',
  'fk_iset_document_client',
  'fk_iset_document_case',
  'fk_iset_document_application',
  'fk_iset_document_origin_message',
  'fk_iset_document_action_plan',
  'fk_iset_document_task',
  'fk_signing_request_workflow',
  'fk_signing_request_case',
  'fk_signing_request_participant_user',
  'fk_signing_request_created_by_user',
  'fk_application_escalation_application',
  'fk_application_escalation_case',
  'fk_application_escalation_requester_user',
  'fk_application_escalation_current_owner_user',
  'fk_application_escalation_resolved_by_user',
  'fk_case_task_created_by_user',
  'fk_case_task_updated_by_user',
  'fk_internal_notification_staff_profile',
  'fk_internal_notification_applicant_user',
  'fk_internal_notification_dismissal_notification',
  'fk_internal_notification_dismissal_staff_profile',
  'fk_internal_notification_dismissal_applicant_user',
  'fk_pending_uploads_user',
  'fk_application_lock_application',
  'fk_iset_application_client_id',
  'fk_iset_application_case_id',
  'fk_iset_application_submission_id',
  'fk_iset_application_version_application',
  'fk_cfa_series_case',
  'fk_cfa_version_series',
  'fk_cfa_version_supersedes',
  'fk_cfa_version_signed_participant',
  'fk_cfa_version_documents_version',
  'fk_cfa_version_documents_document',
  'fk_client_applicant_account_event_client',
  'fk_input_json_state_client',
  'fk_case_assessment_intervention_budget_pot',
  'fk_case_reminder_action_plan',
  'fk_staff_profiles_region',
];

const REQUIRED_CHECKS = [
  'chk_messages_sender_actor_scope',
  'chk_messages_recipient_actor_scope',
  'chk_messages_exactly_one_applicant_actor',
  'chk_message_attachment_required_scope',
  'chk_iset_document_application_submission_scope',
  'chk_iset_document_manual_upload_scope',
  'chk_iset_document_secure_message_attachment_scope',
  'chk_iset_document_system_generated_scope',
  'chk_internal_notification_audience_typed_scope',
  'chk_internal_notification_dismissal_typed_viewer_scope',
  'chk_iset_event_receipt_exactly_one_typed_viewer',
  'chk_iset_event_entry_typed_actor_scope',
];

const REQUIRED_PRIVACY_OBJECTS = [
  { name: 'application_lock', type: 'table' },
  { name: 'budget_pot', type: 'table' },
  { name: 'canada_region', type: 'table' },
  { name: 'cfa_series', type: 'table' },
  { name: 'cfa_version', type: 'table' },
  { name: 'cfa_version_documents', type: 'table' },
  { name: 'client', type: 'table' },
  { name: 'client_applicant_account_event', type: 'table' },
  { name: 'input_json_state', type: 'table' },
  { name: 'iset_application', type: 'table' },
  { name: 'iset_application_escalation', type: 'table' },
  { name: 'iset_application_submission', type: 'table' },
  { name: 'iset_application_version', type: 'table' },
  { name: 'iset_case', type: 'table' },
  { name: 'iset_case_action_plan', type: 'table' },
  { name: 'iset_case_assessment', type: 'table' },
  { name: 'iset_case_reminder', type: 'table' },
  { name: 'iset_case_task', type: 'table' },
  { name: 'iset_document', type: 'table' },
  { name: 'iset_event_entry', type: 'table' },
  { name: 'iset_event_receipt', type: 'table' },
  { name: 'iset_internal_notification', type: 'table' },
  { name: 'iset_internal_notification_dismissal', type: 'table' },
  { name: 'message_attachment', type: 'table' },
  { name: 'message_item', type: 'table' },
  { name: 'messages', type: 'table' },
  { name: 'pending_uploads', type: 'table' },
  { name: 'signing_request', type: 'table' },
  { name: 'staff_profiles', type: 'table' },
  { name: 'user', type: 'table' },
  { name: 'workflow', type: 'table' },
  { name: 'privacy_erm_event_actor_scope_hardening_audit', type: 'table' },
  { name: 'privacy_erm_legacy_table_retirement_audit', type: 'table' },
  { name: 'privacy_erm_relationship_fk_hardening_audit', type: 'table' },
];

const REQUIRED_PRIVACY_CONSTRAINTS = [
  ['messages', 'fk_messages_case', 'foreign_key', 'case_id', 'iset_case', 'id'],
  ['messages', 'fk_messages_application', 'foreign_key', 'application_id', 'iset_application', 'id'],
  ['messages', 'fk_messages_sender_user', 'foreign_key', 'sender_user_id', 'user', 'id'],
  ['messages', 'fk_messages_sender_staff_profile', 'foreign_key', 'sender_staff_profile_id', 'staff_profiles', 'id'],
  ['messages', 'fk_messages_recipient_user', 'foreign_key', 'recipient_user_id', 'user', 'id'],
  ['messages', 'fk_messages_recipient_staff_profile', 'foreign_key', 'recipient_staff_profile_id', 'staff_profiles', 'id'],
  ['message_item', 'fk_message_item_message', 'foreign_key', 'message_id', 'messages', 'id'],
  ['message_item', 'fk_message_item_owner_user', 'foreign_key', 'owner_user_id', 'user', 'id'],
  ['message_attachment', 'fk_message_attachment_message', 'foreign_key', 'message_id', 'messages', 'id'],
  ['message_attachment', 'fk_message_attachment_case', 'foreign_key', 'case_id', 'iset_case', 'id'],
  ['message_attachment', 'fk_message_attachment_client', 'foreign_key', 'client_id', 'client', 'id'],
  ['message_attachment', 'fk_message_attachment_application', 'foreign_key', 'application_id', 'iset_application', 'id'],
  ['message_attachment', 'fk_message_attachment_user', 'foreign_key', 'user_id', 'user', 'id'],
  ['iset_document', 'fk_iset_document_user', 'foreign_key', 'user_id', 'user', 'id'],
  ['iset_document', 'fk_iset_document_applicant_user', 'foreign_key', 'applicant_user_id', 'user', 'id'],
  ['iset_document', 'fk_iset_document_client', 'foreign_key', 'client_id', 'client', 'id'],
  ['iset_document', 'fk_iset_document_case', 'foreign_key', 'case_id', 'iset_case', 'id'],
  ['iset_document', 'fk_iset_document_application', 'foreign_key', 'application_id', 'iset_application', 'id'],
  ['iset_document', 'fk_iset_document_origin_message', 'foreign_key', 'origin_message_id', 'messages', 'id'],
  ['iset_document', 'fk_iset_document_action_plan', 'foreign_key', 'action_plan_id', 'iset_case_action_plan', 'id'],
  ['iset_document', 'fk_iset_document_task', 'foreign_key', 'linked_task_id', 'iset_case_task', 'id'],
  ['signing_request', 'fk_signing_request_workflow', 'foreign_key', 'workflow_id', 'workflow', 'id'],
  ['signing_request', 'fk_signing_request_case', 'foreign_key', 'case_id', 'iset_case', 'id'],
  ['signing_request', 'fk_signing_request_participant_user', 'foreign_key', 'participant_user_id', 'user', 'id'],
  ['signing_request', 'fk_signing_request_created_by_user', 'foreign_key', 'created_by_user_id', 'user', 'id'],
  ['iset_application_escalation', 'fk_application_escalation_application', 'foreign_key', 'application_id', 'iset_application', 'id'],
  ['iset_application_escalation', 'fk_application_escalation_case', 'foreign_key', 'case_id', 'iset_case', 'id'],
  ['iset_application_escalation', 'fk_application_escalation_requester_user', 'foreign_key', 'requester_user_id', 'user', 'id'],
  ['iset_application_escalation', 'fk_application_escalation_current_owner_user', 'foreign_key', 'current_owner_user_id', 'user', 'id'],
  ['iset_application_escalation', 'fk_application_escalation_resolved_by_user', 'foreign_key', 'resolved_by_user_id', 'user', 'id'],
  ['iset_case_task', 'fk_case_task_created_by_user', 'foreign_key', 'created_by_user_id', 'user', 'id'],
  ['iset_case_task', 'fk_case_task_updated_by_user', 'foreign_key', 'updated_by_user_id', 'user', 'id'],
  ['iset_internal_notification', 'fk_internal_notification_staff_profile', 'foreign_key', 'audience_staff_profile_id', 'staff_profiles', 'id'],
  ['iset_internal_notification', 'fk_internal_notification_applicant_user', 'foreign_key', 'audience_applicant_user_id', 'user', 'id'],
  ['iset_internal_notification_dismissal', 'fk_internal_notification_dismissal_notification', 'foreign_key', 'notification_id', 'iset_internal_notification', 'id'],
  ['iset_internal_notification_dismissal', 'fk_internal_notification_dismissal_staff_profile', 'foreign_key', 'viewer_staff_profile_id', 'staff_profiles', 'id'],
  ['iset_internal_notification_dismissal', 'fk_internal_notification_dismissal_applicant_user', 'foreign_key', 'viewer_applicant_user_id', 'user', 'id'],
  ['pending_uploads', 'fk_pending_uploads_user', 'foreign_key', 'user_id', 'user', 'id'],
  ['application_lock', 'fk_application_lock_application', 'foreign_key', 'application_id', 'iset_application', 'id'],
  ['iset_application', 'fk_iset_application_client_id', 'foreign_key', 'client_id', 'client', 'id'],
  ['iset_application', 'fk_iset_application_case_id', 'foreign_key', 'case_id', 'iset_case', 'id'],
  ['iset_application', 'fk_iset_application_submission_id', 'foreign_key', 'submission_id', 'iset_application_submission', 'id'],
  ['iset_application_version', 'fk_iset_application_version_application', 'foreign_key', 'application_id', 'iset_application', 'id'],
  ['cfa_series', 'fk_cfa_series_case', 'foreign_key', 'case_id', 'iset_case', 'id'],
  ['cfa_version', 'fk_cfa_version_series', 'foreign_key', 'series_id', 'cfa_series', 'id'],
  ['cfa_version', 'fk_cfa_version_supersedes', 'foreign_key', 'supersedes_version_id', 'cfa_version', 'id'],
  ['cfa_version', 'fk_cfa_version_signed_participant', 'foreign_key', 'signed_by_participant_id', 'user', 'id'],
  ['cfa_version_documents', 'fk_cfa_version_documents_version', 'foreign_key', 'cfa_version_id', 'cfa_version', 'id'],
  ['cfa_version_documents', 'fk_cfa_version_documents_document', 'foreign_key', 'document_id', 'iset_document', 'id'],
  ['client_applicant_account_event', 'fk_client_applicant_account_event_client', 'foreign_key', 'client_id', 'client', 'id'],
  ['input_json_state', 'fk_input_json_state_client', 'foreign_key', 'client_id', 'client', 'id'],
  ['iset_case_assessment', 'fk_case_assessment_intervention_budget_pot', 'foreign_key', 'intervention_budget_pot_id', 'budget_pot', 'id'],
  ['iset_case_reminder', 'fk_case_reminder_action_plan', 'foreign_key', 'action_plan_id', 'iset_case_action_plan', 'id'],
  ['staff_profiles', 'fk_staff_profiles_region', 'foreign_key', 'region_id', 'canada_region', 'region_id'],
  ['messages', 'chk_messages_sender_actor_scope', 'check'],
  ['messages', 'chk_messages_recipient_actor_scope', 'check'],
  ['messages', 'chk_messages_exactly_one_applicant_actor', 'check'],
  ['message_attachment', 'chk_message_attachment_required_scope', 'check'],
  ['iset_document', 'chk_iset_document_application_submission_scope', 'check'],
  ['iset_document', 'chk_iset_document_manual_upload_scope', 'check'],
  ['iset_document', 'chk_iset_document_secure_message_attachment_scope', 'check'],
  ['iset_document', 'chk_iset_document_system_generated_scope', 'check'],
  ['iset_internal_notification', 'chk_internal_notification_audience_typed_scope', 'check'],
  ['iset_internal_notification_dismissal', 'chk_internal_notification_dismissal_typed_viewer_scope', 'check'],
  ['iset_event_receipt', 'chk_iset_event_receipt_exactly_one_typed_viewer', 'check'],
  ['iset_event_entry', 'chk_iset_event_entry_typed_actor_scope', 'check'],
].map(([object, name, type, column, referencedObject, referencedColumn]) => ({
  object,
  name,
  type,
  ...(column ? {
    columns: [column],
    referencedObject,
    referencedColumns: [referencedColumn],
  } : {}),
}));
const PRIVACY_TABLE_ALIASES = [
  'account_event',
  'application_row',
  'case_row',
  'client_row',
  'event_actor_audit',
  'mailbox_item',
  'mailbox_owner',
  'message_row',
  'relationship_audit',
  'retirement_audit',
];

function createPrivacySchemaGuard(connection, dbConfig, guardFactory = createLiveMysqlSchemaGuard) {
  return guardFactory({
    connection,
    expectedIdentity: {
      ...EXPECTED_DEV_DATABASE_IDENTITY.live,
      configuredHost: EXPECTED_DEV_DATABASE_IDENTITY.configured.host,
      configuredUser: EXPECTED_DEV_DATABASE_IDENTITY.configured.user,
    },
    configuredIdentity: {
      host: dbConfig.host,
      port: Number(dbConfig.port),
      user: dbConfig.user,
      database: dbConfig.database,
    },
    requiredObjects: REQUIRED_PRIVACY_OBJECTS,
    absentObjects: RETIRED_TABLES,
    absentColumns: RETIRED_COLUMNS.map(([object, name]) => ({ object, name })),
    requiredConstraints: REQUIRED_PRIVACY_CONSTRAINTS,
    allowedTableAliases: PRIVACY_TABLE_ALIASES,
  });
}

function assertConfiguredPrivacyDevTarget(dbConfig) {
  const configured = EXPECTED_DEV_DATABASE_IDENTITY.configured;
  if (
    String(dbConfig?.host || '').trim() !== configured.host
    || Number(dbConfig?.port) !== configured.port
    || String(dbConfig?.user || '').trim() !== configured.user
    || String(dbConfig?.database || '').trim() !== configured.database
  ) {
    throw new Error('privacy_erm_smoke_configured_database_target_not_authorized');
  }
  return true;
}

function derivePrivacyStructuralEvidence(guard) {
  const absentColumns = RETIRED_COLUMNS.flatMap(([object, name]) => {
    const proof = guard.getObjectProof(object);
    if (!proof) throw new Error(`privacy_erm_object_proof_missing:${object}`);
    const present = (proof.columns || []).some(column => column.name === name);
    return present ? [] : [`${object}.${name}`];
  });
  const constraints = REQUIRED_PRIVACY_CONSTRAINTS.flatMap(spec => {
    const proof = guard.getObjectProof(spec.object);
    if (!proof) throw new Error(`privacy_erm_object_proof_missing:${spec.object}`);
    const expectedType = String(spec.type).replace(/_/g, ' ').toUpperCase();
    const found = (proof.constraints || []).find(candidate => (
      candidate.name === spec.name
      && candidate.type === expectedType
      && JSON.stringify(candidate.columns || []) === JSON.stringify(spec.columns || [])
      && String(candidate.referencedObject || '') === String(spec.referencedObject || '')
      && JSON.stringify(candidate.referencedColumns || []) === JSON.stringify(spec.referencedColumns || [])
    ));
    return found ? [`${spec.object}.${spec.name}`] : [];
  });
  if (absentColumns.length !== RETIRED_COLUMNS.length) {
    throw new Error('privacy_erm_absent_column_proof_incomplete');
  }
  if (constraints.length !== REQUIRED_PRIVACY_CONSTRAINTS.length) {
    throw new Error('privacy_erm_constraint_proof_incomplete');
  }
  return { absentColumns, constraints };
}

async function scalar(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  const first = rows && rows[0] ? rows[0] : {};
  const value = Object.values(first)[0];
  return Number(value || 0);
}

function addCheck(results, check) {
  results.push(check);
}

async function expectZero(conn, results, name, sql, params = [], severity = 'high') {
  const actual = await scalar(conn, sql, params);
  addCheck(results, { name, severity, expected: 0, actual, pass: actual === 0 });
}

async function expectEquals(conn, results, name, expected, sql, params = [], severity = 'high') {
  const actual = await scalar(conn, sql, params);
  addCheck(results, { name, severity, expected, actual, pass: actual === expected });
}

async function runPrivacyChecks(conn, checks) {
  await expectZero(
    conn,
    checks,
    'relationship hardening blockers',
    `SELECT COUNT(*)
       FROM \`privacy_erm_relationship_fk_hardening_audit\` AS \`relationship_audit\`
      WHERE \`relationship_audit\`.\`missing_target\` = 1
         OR \`relationship_audit\`.\`scope_mismatch\` = 1`
  );

  await expectZero(
    conn,
    checks,
    'event actor scope blockers',
    `SELECT COUNT(*)
       FROM \`privacy_erm_event_actor_scope_hardening_audit\` AS \`event_actor_audit\`
      WHERE \`event_actor_audit\`.\`missing_required_typed_actor\` = 1
         OR \`event_actor_audit\`.\`dual_typed_actor\` = 1`
  );

  await expectZero(
    conn,
    checks,
    'message mailbox anomalies',
    `SELECT COUNT(*)
       FROM \`message_item\` AS \`mailbox_item\`
       LEFT JOIN \`messages\` AS \`message_row\`
         ON \`message_row\`.\`id\` = \`mailbox_item\`.\`message_id\`
       LEFT JOIN \`user\` AS \`mailbox_owner\`
         ON \`mailbox_owner\`.\`id\` = \`mailbox_item\`.\`owner_user_id\`
      WHERE \`message_row\`.\`id\` IS NULL
         OR \`mailbox_owner\`.\`id\` IS NULL
         OR (
              (\`message_row\`.\`sender_user_id\` IS NULL OR \`mailbox_item\`.\`owner_user_id\` <> \`message_row\`.\`sender_user_id\`)
          AND (\`message_row\`.\`recipient_user_id\` IS NULL OR \`mailbox_item\`.\`owner_user_id\` <> \`message_row\`.\`recipient_user_id\`)
         )`
  );

  await expectZero(
    conn,
    checks,
    'secure message scope anomalies',
    `SELECT COUNT(*)
       FROM \`messages\`
      WHERE \`messages\`.\`case_id\` IS NULL
         OR \`messages\`.\`sender_actor_type\` IS NULL
         OR \`messages\`.\`recipient_actor_type\` IS NULL
         OR (
              (\`messages\`.\`sender_actor_type\` = 'applicant_user')
            + (\`messages\`.\`recipient_actor_type\` = 'applicant_user')
         ) <> 1
         OR (
              \`messages\`.\`sender_actor_type\` = 'applicant_user'
              AND (\`messages\`.\`sender_user_id\` IS NULL OR \`messages\`.\`sender_staff_profile_id\` IS NOT NULL)
         )
         OR (
              \`messages\`.\`recipient_actor_type\` = 'applicant_user'
              AND (\`messages\`.\`recipient_user_id\` IS NULL OR \`messages\`.\`recipient_staff_profile_id\` IS NOT NULL)
         )
         OR (
              \`messages\`.\`sender_actor_type\` = 'staff_profile'
              AND (\`messages\`.\`sender_staff_profile_id\` IS NULL OR \`messages\`.\`sender_user_id\` IS NULL)
         )
         OR (
              \`messages\`.\`recipient_actor_type\` = 'staff_profile'
              AND (\`messages\`.\`recipient_staff_profile_id\` IS NULL OR \`messages\`.\`recipient_user_id\` IS NULL)
         )
         OR (
              \`messages\`.\`sender_actor_type\` = 'local_user'
              AND (\`messages\`.\`sender_user_id\` IS NULL OR \`messages\`.\`sender_staff_profile_id\` IS NOT NULL)
         )
         OR (
              \`messages\`.\`recipient_actor_type\` = 'local_user'
              AND (\`messages\`.\`recipient_user_id\` IS NULL OR \`messages\`.\`recipient_staff_profile_id\` IS NOT NULL)
         )
         OR (
              \`messages\`.\`sender_actor_type\` = 'system'
              AND \`messages\`.\`sender_staff_profile_id\` IS NOT NULL
         )
         OR (
              \`messages\`.\`recipient_actor_type\` = 'system'
              AND \`messages\`.\`recipient_staff_profile_id\` IS NOT NULL
         )`
  );

  await expectZero(
    conn,
    checks,
    'document source-scope anomalies',
    `SELECT COUNT(*)
       FROM \`iset_document\`
      WHERE (
              \`iset_document\`.\`source\` = 'application_submission'
              AND (\`iset_document\`.\`client_id\` IS NULL OR \`iset_document\`.\`case_id\` IS NULL OR \`iset_document\`.\`application_id\` IS NULL OR \`iset_document\`.\`applicant_user_id\` IS NULL)
            )
         OR (
              \`iset_document\`.\`source\` = 'manual_upload'
              AND (\`iset_document\`.\`client_id\` IS NULL OR \`iset_document\`.\`case_id\` IS NULL OR (\`iset_document\`.\`application_id\` IS NOT NULL AND \`iset_document\`.\`applicant_user_id\` IS NULL))
            )
         OR (
              \`iset_document\`.\`source\` = 'secure_message_attachment'
              AND (
                   \`iset_document\`.\`client_id\` IS NULL
                OR \`iset_document\`.\`case_id\` IS NULL
                OR \`iset_document\`.\`applicant_user_id\` IS NULL
                OR \`iset_document\`.\`user_id\` IS NULL
                OR \`iset_document\`.\`origin_message_id\` IS NULL
              )
            )
         OR (
              \`iset_document\`.\`source\` = 'system_generated'
              AND (\`iset_document\`.\`client_id\` IS NULL OR \`iset_document\`.\`case_id\` IS NULL OR (\`iset_document\`.\`application_id\` IS NOT NULL AND \`iset_document\`.\`applicant_user_id\` IS NULL))
            )`
  );

  await expectZero(
    conn,
    checks,
    'application ownership anomalies',
    `SELECT COUNT(*)
       FROM \`iset_application\` AS \`application_row\`
       LEFT JOIN \`iset_case\` AS \`case_row\`
         ON \`case_row\`.\`id\` = \`application_row\`.\`case_id\`
      WHERE \`application_row\`.\`client_id\` IS NULL
         OR \`application_row\`.\`case_id\` IS NULL
         OR \`case_row\`.\`id\` IS NULL
         OR \`case_row\`.\`client_id\` IS NULL
         OR \`case_row\`.\`client_id\` <> \`application_row\`.\`client_id\``
  );

  await expectZero(
    conn,
    checks,
    'client account event orphan rows',
    `SELECT COUNT(*)
       FROM \`client_applicant_account_event\` AS \`account_event\`
       LEFT JOIN \`client\` AS \`client_row\`
         ON \`client_row\`.\`id\` = \`account_event\`.\`client_id\`
      WHERE \`client_row\`.\`id\` IS NULL`
  );

  await expectEquals(
    conn,
    checks,
    'zzz legacy document retirement audit rows',
    1,
    `SELECT COUNT(*)
       FROM \`privacy_erm_legacy_table_retirement_audit\` AS \`retirement_audit\`
      WHERE \`retirement_audit\`.\`table_name\` = 'zzz_legacy_documents'`,
    [],
    'medium'
  );

  return checks;
}

async function runPrivacyErmSmoke({
  connection,
  args,
  dbConfig,
  guardFactory = createLiveMysqlSchemaGuard,
}) {
  const guard = createPrivacySchemaGuard(connection, dbConfig, guardFactory);
  const schemaEvidence = await guard.preflight();
  const structuralEvidence = derivePrivacyStructuralEvidence(guard);
  if (args.schemaPreflightOnly) {
    return {
      ok: true,
      mode: 'schema-preflight-only',
      checks: [],
      schemaEvidence,
      structuralEvidence,
    };
  }

  const checks = [
    {
      name: 'retired legacy tables absent',
      severity: 'high',
      expected: RETIRED_TABLES.length,
      actual: schemaEvidence.absentObjects?.length || 0,
      pass: (schemaEvidence.absentObjects?.length || 0) === RETIRED_TABLES.length,
    },
    {
      name: 'retired compatibility columns absent',
      severity: 'high',
      expected: RETIRED_COLUMNS.length,
      actual: structuralEvidence.absentColumns.length,
      pass: structuralEvidence.absentColumns.length === RETIRED_COLUMNS.length,
    },
    {
      name: 'required privacy constraints proven from owner DDL',
      severity: 'high',
      expected: REQUIRED_PRIVACY_CONSTRAINTS.length,
      actual: structuralEvidence.constraints.length,
      pass: structuralEvidence.constraints.length === REQUIRED_PRIVACY_CONSTRAINTS.length,
    },
  ];
  const guardedConnection = guard.createGuardedConnection();
  await runPrivacyChecks(guardedConnection, checks);
  const failed = checks.filter(check => !check.pass);
  return {
    ok: failed.length === 0,
    mode: 'read-only-integrity',
    checks,
    schemaEvidence: guard.evidence(),
    structuralEvidence,
  };
}

function renderReport(report) {
  const lines = [];
  if (report.mode === 'schema-preflight-only') {
    lines.push('Privacy ERM schema preflight passed; no ordinary SQL was executed.');
    lines.push(`Verified objects: ${Object.keys(report.schemaEvidence.objects || {}).length}`);
    lines.push(`Proven absent objects: ${(report.schemaEvidence.absentObjects || []).length}`);
    lines.push(`Proven absent columns: ${(report.structuralEvidence.absentColumns || []).length}`);
    lines.push(`Proven constraints: ${(report.structuralEvidence.constraints || []).length}`);
    return lines.join('\n');
  }
  for (const check of report.checks) {
    const status = check.pass ? 'PASS' : 'FAIL';
    lines.push(`${status} ${check.name}: expected ${check.expected}, actual ${check.actual}`);
    if (!check.pass && check.detail && check.detail.length) {
      lines.push(`  detail: ${JSON.stringify(check.detail)}`);
    }
  }
  lines.push(report.ok ? 'Privacy ERM smoke passed.' : 'Privacy ERM smoke failed.');
  return lines.join('\n');
}

async function main({ argv = process.argv, mysqlModule = mysql } = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return null;
  }

  const dbConfig = getDbConfig();
  assertConfiguredPrivacyDevTarget(dbConfig);
  const connection = await mysqlModule.createConnection(dbConfig);
  let report;
  try {
    report = await runPrivacyErmSmoke({ connection, args, dbConfig });
  } finally {
    await connection.end();
  }
  console.log(args.json ? JSON.stringify(report, null, 2) : renderReport(report));
  if (!report.ok) process.exitCode = 1;
  return report;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  REQUIRED_CHECKS,
  REQUIRED_FKS,
  REQUIRED_PRIVACY_CONSTRAINTS,
  REQUIRED_PRIVACY_OBJECTS,
  RETIRED_COLUMNS,
  RETIRED_TABLES,
  assertConfiguredPrivacyDevTarget,
  createPrivacySchemaGuard,
  derivePrivacyStructuralEvidence,
  main,
  parseArgs,
  renderReport,
  runPrivacyChecks,
  runPrivacyErmSmoke,
};
