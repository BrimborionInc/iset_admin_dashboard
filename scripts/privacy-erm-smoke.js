#!/usr/bin/env node
'use strict';

const mysql = require('mysql2/promise');

function parseArgs(argv) {
  const args = { json: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
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
    'Usage: env-cmd -f .env node scripts/privacy-erm-smoke.js [--json]',
    '',
    'Runs read-only privacy ERM smoke checks against the configured MySQL database.',
    'The checks use counts and constraint names only; they do not print private row payloads.',
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

async function scalar(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  const first = rows && rows[0] ? rows[0] : {};
  const value = Object.values(first)[0];
  return Number(value || 0);
}

async function rows(conn, sql, params = []) {
  const [result] = await conn.query(sql, params);
  return result || [];
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

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const conn = await mysql.createConnection(getDbConfig());
  const checks = [];

  await expectZero(
    conn,
    checks,
    'retired legacy tables absent',
    `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (?)`,
    [RETIRED_TABLES]
  );

  const retiredColumnClauses = RETIRED_COLUMNS
    .map(() => '(table_name = ? AND column_name = ?)')
    .join(' OR ');
  await expectZero(
    conn,
    checks,
    'retired compatibility columns absent',
    `SELECT COUNT(*)
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND (${retiredColumnClauses})`,
    RETIRED_COLUMNS.flat()
  );

  const missingFkRows = await rows(
    conn,
    `SELECT required.constraint_name
       FROM (
        ${REQUIRED_FKS.map(() => 'SELECT ? AS constraint_name').join(' UNION ALL ')}
       ) required
       LEFT JOIN information_schema.referential_constraints rc
         ON rc.constraint_schema = DATABASE()
        AND rc.constraint_name = required.constraint_name
      WHERE rc.constraint_name IS NULL
      ORDER BY required.constraint_name`,
    REQUIRED_FKS
  );
  addCheck(checks, {
    name: 'required privacy FKs present',
    severity: 'high',
    expected: 0,
    actual: missingFkRows.length,
    pass: missingFkRows.length === 0,
    detail: missingFkRows.map((row) => row.constraint_name),
  });

  const missingCheckRows = await rows(
    conn,
    `SELECT required.constraint_name
       FROM (
        ${REQUIRED_CHECKS.map(() => 'SELECT ? AS constraint_name').join(' UNION ALL ')}
       ) required
       LEFT JOIN information_schema.table_constraints tc
         ON tc.constraint_schema = DATABASE()
        AND tc.constraint_type = 'CHECK'
        AND tc.constraint_name = required.constraint_name
      WHERE tc.constraint_name IS NULL
      ORDER BY required.constraint_name`,
    REQUIRED_CHECKS
  );
  addCheck(checks, {
    name: 'required privacy CHECK constraints present',
    severity: 'high',
    expected: 0,
    actual: missingCheckRows.length,
    pass: missingCheckRows.length === 0,
    detail: missingCheckRows.map((row) => row.constraint_name),
  });

  await expectZero(
    conn,
    checks,
    'relationship hardening blockers',
    `SELECT COUNT(*) FROM privacy_erm_relationship_fk_hardening_audit WHERE missing_target = 1 OR scope_mismatch = 1`
  );

  await expectZero(
    conn,
    checks,
    'event actor scope blockers',
    `SELECT COUNT(*) FROM privacy_erm_event_actor_scope_hardening_audit WHERE missing_required_typed_actor = 1 OR dual_typed_actor = 1`
  );

  await expectZero(
    conn,
    checks,
    'message mailbox anomalies',
    `SELECT COUNT(*)
       FROM message_item mi
       LEFT JOIN messages m ON m.id = mi.message_id
       LEFT JOIN user u ON u.id = mi.owner_user_id
      WHERE m.id IS NULL
         OR u.id IS NULL
         OR (
              (m.sender_user_id IS NULL OR mi.owner_user_id <> m.sender_user_id)
          AND (m.recipient_user_id IS NULL OR mi.owner_user_id <> m.recipient_user_id)
         )`
  );

  await expectZero(
    conn,
    checks,
    'secure message scope anomalies',
    `SELECT COUNT(*)
       FROM messages
      WHERE case_id IS NULL
         OR sender_actor_type IS NULL
         OR recipient_actor_type IS NULL
         OR (
              (sender_actor_type = 'applicant_user')
            + (recipient_actor_type = 'applicant_user')
         ) <> 1
         OR (
              sender_actor_type = 'applicant_user'
              AND (sender_user_id IS NULL OR sender_staff_profile_id IS NOT NULL)
         )
         OR (
              recipient_actor_type = 'applicant_user'
              AND (recipient_user_id IS NULL OR recipient_staff_profile_id IS NOT NULL)
         )
         OR (
              sender_actor_type = 'staff_profile'
              AND (sender_staff_profile_id IS NULL OR sender_user_id IS NULL)
         )
         OR (
              recipient_actor_type = 'staff_profile'
              AND (recipient_staff_profile_id IS NULL OR recipient_user_id IS NULL)
         )
         OR (
              sender_actor_type = 'local_user'
              AND (sender_user_id IS NULL OR sender_staff_profile_id IS NOT NULL)
         )
         OR (
              recipient_actor_type = 'local_user'
              AND (recipient_user_id IS NULL OR recipient_staff_profile_id IS NOT NULL)
         )
         OR (
              sender_actor_type = 'system'
              AND sender_staff_profile_id IS NOT NULL
         )
         OR (
              recipient_actor_type = 'system'
              AND recipient_staff_profile_id IS NOT NULL
         )`
  );

  await expectZero(
    conn,
    checks,
    'document source-scope anomalies',
    `SELECT COUNT(*)
       FROM iset_document
      WHERE (
              source = 'application_submission'
              AND (client_id IS NULL OR case_id IS NULL OR application_id IS NULL OR applicant_user_id IS NULL)
            )
         OR (
              source = 'manual_upload'
              AND (client_id IS NULL OR case_id IS NULL OR (application_id IS NOT NULL AND applicant_user_id IS NULL))
            )
         OR (
              source = 'secure_message_attachment'
              AND (
                   client_id IS NULL
                OR case_id IS NULL
                OR applicant_user_id IS NULL
                OR user_id IS NULL
                OR origin_message_id IS NULL
              )
            )
         OR (
              source = 'system_generated'
              AND (client_id IS NULL OR case_id IS NULL OR (application_id IS NOT NULL AND applicant_user_id IS NULL))
            )`
  );

  await expectZero(
    conn,
    checks,
    'application ownership anomalies',
    `SELECT COUNT(*)
       FROM iset_application a
       LEFT JOIN iset_case c ON c.id = a.case_id
      WHERE a.client_id IS NULL
         OR a.case_id IS NULL
         OR c.id IS NULL
         OR c.client_id IS NULL
         OR c.client_id <> a.client_id`
  );

  await expectZero(
    conn,
    checks,
    'client account event orphan rows',
    `SELECT COUNT(*)
       FROM client_applicant_account_event e
       LEFT JOIN client c ON c.id = e.client_id
      WHERE c.id IS NULL`
  );

  await expectEquals(
    conn,
    checks,
    'zzz legacy document retirement audit rows',
    1,
    `SELECT COUNT(*) FROM privacy_erm_legacy_table_retirement_audit WHERE table_name = 'zzz_legacy_documents'`,
    [],
    'medium'
  );

  const workflowStringRows = await rows(
    conn,
    `SELECT
        'iset_application_submission' AS table_name,
        COUNT(*) AS unmatched_rows
       FROM iset_application_submission s
       LEFT JOIN workflow w
         ON BINARY CAST(w.id AS CHAR) = BINARY s.workflow_id
         OR BINARY w.name = BINARY s.workflow_id
      WHERE w.id IS NULL
      UNION ALL
      SELECT
        'input_json_state' AS table_name,
        COUNT(*) AS unmatched_rows
       FROM input_json_state i
       LEFT JOIN workflow w
         ON BINARY CAST(w.id AS CHAR) = BINARY i.workflow_id
         OR BINARY w.name = BINARY i.workflow_id
      WHERE w.id IS NULL
      UNION ALL
      SELECT
        'iset_application_draft_dynamic' AS table_name,
        COUNT(*) AS unmatched_rows
       FROM iset_application_draft_dynamic d
       LEFT JOIN workflow w
         ON BINARY CAST(w.id AS CHAR) = BINARY d.workflow_id
         OR BINARY w.name = BINARY d.workflow_id
      WHERE w.id IS NULL`
  );
  addCheck(checks, {
    name: 'workflow string-key rows',
    severity: 'info',
    expected: 'classified, not FK blockers',
    actual: workflowStringRows.reduce((sum, row) => sum + Number(row.unmatched_rows || 0), 0),
    pass: true,
    detail: workflowStringRows,
  });

  await conn.end();

  const failed = checks.filter((check) => !check.pass);
  if (args.json) {
    console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2));
  } else {
    for (const check of checks) {
      const status = check.pass ? 'PASS' : 'FAIL';
      console.log(`${status} ${check.name}: expected ${check.expected}, actual ${check.actual}`);
      if (!check.pass && check.detail && check.detail.length) {
        console.log(`  detail: ${JSON.stringify(check.detail)}`);
      }
    }
    console.log(failed.length === 0 ? 'Privacy ERM smoke passed.' : 'Privacy ERM smoke failed.');
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
