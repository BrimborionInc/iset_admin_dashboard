#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DEFAULT_TABLES = [
  'user',
  'staff_profiles',
  'client',
  'iset_application_submission',
  'iset_application',
  'iset_case',
  'iset_document',
  'messages',
  'message_item',
  'message_attachment',
  'iset_internal_notification',
  'iset_internal_notification_dismissal',
  'pending_uploads',
  'application_lock',
  'iset_event_receipt',
  'user_session_audit',
  'client_applicant_account_event',
  'staff_message',
  'staff_message_item',
  'staff_message_thread',
  'staff_message_thread_participant',
  'contact_message',
];

const LEGACY_TABLES = [
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

function parseArgs(argv) {
  const args = {
    out: null,
    maxRows: 50,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') {
      args.out = argv[++i];
    } else if (arg === '--max-rows') {
      args.maxRows = Math.max(1, Number(argv[++i] || 50));
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
    'Usage: env-cmd -f .env node scripts/privacy-erm-audit.js [--out <path>] [--max-rows <n>]',
    '',
    'Runs read-only privacy/entity-relationship checks against the configured MySQL database.',
    'The markdown output intentionally avoids names, emails, message bodies, and file paths.',
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

function quoteIdent(name) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`Unsafe identifier: ${name}`);
  }
  return `\`${name}\``;
}

function casePrimaryApplicationIdSql(caseAlias = 'c') {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(caseAlias)) {
    throw new Error(`Unsafe case alias: ${caseAlias}`);
  }
  return `(
    SELECT a_case.id
      FROM iset_application a_case
     WHERE a_case.case_id = ${caseAlias}.id
     ORDER BY COALESCE(a_case.updated_at, a_case.created_at) DESC, a_case.id DESC
     LIMIT 1
  )`;
}

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return '[buffer]';
  if (typeof value === 'object') return JSON.stringify(value).replace(/\|/g, '\\|');
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function markdownTable(rows) {
  if (!rows || rows.length === 0) return '_No rows._\n';
  const columns = Object.keys(rows[0]);
  const lines = [
    `| ${columns.map(escapeCell).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
  ];
  rows.forEach((row) => {
    lines.push(`| ${columns.map((col) => escapeCell(row[col])).join(' | ')} |`);
  });
  return `${lines.join('\n')}\n`;
}

function truncateRows(rows, maxRows) {
  if (!Array.isArray(rows)) return [];
  if (rows.length <= maxRows) return rows;
  return rows.slice(0, maxRows);
}

async function tableExists(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS count
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS count
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function getExistingTables(conn, tableNames) {
  const existing = new Set();
  for (const tableName of tableNames) {
    if (await tableExists(conn, tableName)) {
      existing.add(tableName);
    }
  }
  return existing;
}

async function runQuery(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

async function runCheck(conn, checks, check) {
  const missing = [];
  if (check.requires) {
    for (const tableName of check.requires) {
      if (!(await tableExists(conn, tableName))) {
        missing.push(tableName);
      }
    }
  }

  if (missing.length > 0) {
    checks.push({
      title: check.title,
      severity: check.severity || 'info',
      description: check.description,
      skipped: `Missing required table(s): ${missing.join(', ')}`,
      rows: [],
      totalRows: 0,
    });
    return;
  }

  try {
    const rows = await runQuery(conn, check.sql, check.params || []);
    checks.push({
      title: check.title,
      severity: check.severity || 'info',
      description: check.description,
      rows,
      totalRows: rows.length,
    });
  } catch (err) {
    checks.push({
      title: check.title,
      severity: check.severity || 'info',
      description: check.description,
      error: err.message,
      rows: [],
      totalRows: 0,
    });
  }
}

async function countSelectedTables(conn) {
  const existingTables = await getExistingTables(conn, DEFAULT_TABLES);
  const rows = [];
  for (const tableName of DEFAULT_TABLES) {
    if (!existingTables.has(tableName)) {
      rows.push({ table_name: tableName, row_count: 'missing' });
      continue;
    }
    const [countRows] = await conn.query(`SELECT COUNT(*) AS row_count FROM ${quoteIdent(tableName)}`);
    rows.push({ table_name: tableName, row_count: Number(countRows[0]?.row_count || 0) });
  }
  return rows;
}

async function legacyTableStatus(conn) {
  const rows = [];
  for (const tableName of LEGACY_TABLES) {
    if (!(await tableExists(conn, tableName))) {
      rows.push({ table_name: tableName, status: 'missing', row_count: '' });
      continue;
    }
    const [countRows] = await conn.query(`SELECT COUNT(*) AS row_count FROM ${quoteIdent(tableName)}`);
    rows.push({ table_name: tableName, status: 'present', row_count: Number(countRows[0]?.row_count || 0) });
  }
  return rows;
}

async function applicationVersionColumnStatus(conn) {
  if (!(await tableExists(conn, 'iset_application_version'))) {
    return [{ table_name: 'iset_application_version', column_name: '', status: 'missing table' }];
  }

  const expected = [
    { columnName: 'application_id' },
    { columnName: 'version' },
    { columnName: 'payload_json' },
    { columnName: 'change_summary' },
    { columnName: 'created_by_id', retiredWhenMissing: true },
    { columnName: 'created_by_staff_profile_id' },
    { columnName: 'created_by_user_id' },
    { columnName: 'created_by_name' },
    { columnName: 'restored_from_version' },
    { columnName: 'case_id' },
    { columnName: 'version_number' },
    { columnName: 'source_type' },
    { columnName: 'is_current' },
    { columnName: 'previous_payload_json' },
  ];

  const [columns] = await conn.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'iset_application_version'`
  );
  const present = new Set(columns.map((row) => row.column_name || row.COLUMN_NAME));
  return expected.map(({ columnName, retiredWhenMissing = false }) => {
    const isPresent = present.has(columnName);
    return {
      table_name: 'iset_application_version',
      column_name: columnName,
      status: isPresent ? 'present' : (retiredWhenMissing ? 'retired' : 'missing'),
    };
  });
}

async function legacyShadowRetirementInventory(conn) {
  const rows = [];

  const addMissing = (tableName, columnName, canonicalField, classification, retirementGate, status = 'missing') => {
    rows.push({
      table_name: tableName,
      column_name: columnName,
      canonical_field: canonicalField,
      classification,
      rows_total: status,
      shadow_values: '',
      canonical_values: '',
      matched_canonical_values: '',
      mismatches_or_unresolved: '',
      retirement_gate: retirementGate,
    });
  };

  const addRow = (base, counts) => {
    rows.push({
      table_name: base.tableName,
      column_name: base.columnName,
      canonical_field: base.canonicalField,
      classification: base.classification,
      rows_total: Number(counts?.rows_total || 0),
      shadow_values: Number(counts?.shadow_values || 0),
      canonical_values: Number(counts?.canonical_values || 0),
      matched_canonical_values: Number(counts?.matched_canonical_values || 0),
      mismatches_or_unresolved: Number(counts?.mismatches_or_unresolved || 0),
      retirement_gate: base.retirementGate,
    });
  };

  const runSingle = async (base, sql, requires) => {
    for (const [tableName, columnNames] of Object.entries(requires || {})) {
      if (!(await tableExists(conn, tableName))) {
        addMissing(base.tableName, base.columnName, base.canonicalField, base.classification, base.retirementGate);
        return;
      }
      for (const columnName of columnNames) {
        if (!(await columnExists(conn, tableName, columnName))) {
          const retired =
            base.retiredWhenMissing &&
            tableName === base.tableName &&
            columnName === base.columnName;
          addMissing(
            base.tableName,
            base.columnName,
            base.canonicalField,
            retired ? `${base.classification} (physically retired in this schema)` : base.classification,
            base.retirementGate,
            retired ? 'retired' : 'missing'
          );
          return;
        }
      }
    }

    const [queryRows] = await conn.query(sql);
    addRow(base, queryRows[0] || {});
  };

  await runSingle(
    {
      tableName: 'messages',
      columnName: 'sender_id',
      canonicalField: 'sender_actor_type + sender_user_id + sender_staff_profile_id',
      classification: 'legacy sender shared-user shadow',
      retiredWhenMissing: true,
      retirementGate: 'Retire after all admin/portal/shared writers and response consumers stop selecting or writing sender_id, and TEST/PROD migration confirms 0 drift.',
    },
    `
      SELECT
        COUNT(*) AS rows_total,
        COALESCE(SUM(sender_id IS NOT NULL), 0) AS shadow_values,
        COALESCE(SUM(sender_user_id IS NOT NULL), 0) AS canonical_values,
        COALESCE(SUM(sender_id IS NOT NULL AND sender_user_id IS NOT NULL AND sender_id = sender_user_id), 0) AS matched_canonical_values,
        COALESCE(SUM(sender_id IS NOT NULL AND (sender_user_id IS NULL OR sender_id <> sender_user_id)), 0) AS mismatches_or_unresolved
      FROM messages
    `,
    { messages: ['sender_id', 'sender_user_id', 'sender_actor_type', 'sender_staff_profile_id'] }
  );

  await runSingle(
    {
      tableName: 'messages',
      columnName: 'recipient_id',
      canonicalField: 'recipient_actor_type + recipient_user_id + recipient_staff_profile_id',
      classification: 'legacy recipient shared-user shadow',
      retiredWhenMissing: true,
      retirementGate: 'Retire after all admin/portal/shared writers and response consumers stop selecting or writing recipient_id, and TEST/PROD migration confirms 0 drift.',
    },
    `
      SELECT
        COUNT(*) AS rows_total,
        COALESCE(SUM(recipient_id IS NOT NULL), 0) AS shadow_values,
        COALESCE(SUM(recipient_user_id IS NOT NULL), 0) AS canonical_values,
        COALESCE(SUM(recipient_id IS NOT NULL AND recipient_user_id IS NOT NULL AND recipient_id = recipient_user_id), 0) AS matched_canonical_values,
        COALESCE(SUM(recipient_id IS NOT NULL AND (recipient_user_id IS NULL OR recipient_id <> recipient_user_id)), 0) AS mismatches_or_unresolved
      FROM messages
    `,
    { messages: ['recipient_id', 'recipient_user_id', 'recipient_actor_type', 'recipient_staff_profile_id'] }
  );

  await runSingle(
    {
      tableName: 'iset_case',
      columnName: 'assigned_to_user_id',
      canonicalField: 'assigned_staff_profile_id',
      classification: 'legacy staff-profile assignment shadow',
      retiredWhenMissing: true,
      retirementGate: 'Retire after admin/portal/shared assignment code no longer uses the legacy name for writes, joins, filters, or response aliases, and TEST/PROD migration confirms 0 drift.',
    },
    `
      SELECT
        COUNT(*) AS rows_total,
        COALESCE(SUM(assigned_to_user_id IS NOT NULL), 0) AS shadow_values,
        COALESCE(SUM(assigned_staff_profile_id IS NOT NULL), 0) AS canonical_values,
        COALESCE(SUM(assigned_to_user_id IS NOT NULL AND assigned_staff_profile_id IS NOT NULL AND assigned_to_user_id = assigned_staff_profile_id), 0) AS matched_canonical_values,
        COALESCE(SUM(assigned_to_user_id IS NOT NULL AND (assigned_staff_profile_id IS NULL OR assigned_to_user_id <> assigned_staff_profile_id)), 0) AS mismatches_or_unresolved
      FROM iset_case
    `,
    { iset_case: ['assigned_to_user_id', 'assigned_staff_profile_id'] }
  );

  await runSingle(
    {
      tableName: 'iset_internal_notification',
      columnName: 'audience_user_id',
      canonicalField: 'audience_actor_type + audience_staff_profile_id + audience_applicant_user_id',
      classification: 'legacy typed notification audience shadow',
      retiredWhenMissing: true,
      retirementGate: 'Retire after notification insert/dedupe/query code uses typed audience keys and a typed unique index replaces audience_user_id compatibility matching.',
    },
    `
      SELECT
        COUNT(*) AS rows_total,
        COALESCE(SUM(audience_user_id IS NOT NULL), 0) AS shadow_values,
        COALESCE(SUM(audience_staff_profile_id IS NOT NULL OR audience_applicant_user_id IS NOT NULL), 0) AS canonical_values,
        COALESCE(SUM(
          audience_user_id IS NOT NULL
          AND (
            (audience_actor_type = 'staff_profile' AND audience_user_id = audience_staff_profile_id)
            OR (audience_actor_type = 'applicant_user' AND audience_user_id = audience_applicant_user_id)
          )
        ), 0) AS matched_canonical_values,
        COALESCE(SUM(
          audience_user_id IS NOT NULL
          AND NOT (
            (audience_actor_type = 'staff_profile' AND audience_user_id = audience_staff_profile_id)
            OR (audience_actor_type = 'applicant_user' AND audience_user_id = audience_applicant_user_id)
          )
        ), 0) AS mismatches_or_unresolved
      FROM iset_internal_notification
    `,
    { iset_internal_notification: ['audience_user_id', 'audience_actor_type', 'audience_staff_profile_id', 'audience_applicant_user_id'] }
  );

  await runSingle(
    {
      tableName: 'iset_internal_notification_dismissal',
      columnName: 'user_id',
      canonicalField: 'viewer_actor_type + viewer_staff_profile_id + viewer_applicant_user_id',
      classification: 'legacy typed notification dismissal shadow',
      retiredWhenMissing: true,
      retirementGate: 'Retire after dismissal lookup/insert code uses typed viewer keys and legacy user_id is removed from uniqueness assumptions.',
    },
    `
      SELECT
        COUNT(*) AS rows_total,
        COALESCE(SUM(user_id IS NOT NULL), 0) AS shadow_values,
        COALESCE(SUM(viewer_staff_profile_id IS NOT NULL OR viewer_applicant_user_id IS NOT NULL), 0) AS canonical_values,
        COALESCE(SUM(
          user_id IS NOT NULL
          AND (
            (viewer_actor_type = 'staff_profile' AND user_id = viewer_staff_profile_id)
            OR (viewer_actor_type = 'applicant_user' AND user_id = viewer_applicant_user_id)
          )
        ), 0) AS matched_canonical_values,
        COALESCE(SUM(
          user_id IS NOT NULL
          AND NOT (
            (viewer_actor_type = 'staff_profile' AND user_id = viewer_staff_profile_id)
            OR (viewer_actor_type = 'applicant_user' AND user_id = viewer_applicant_user_id)
          )
        ), 0) AS mismatches_or_unresolved
      FROM iset_internal_notification_dismissal
    `,
    { iset_internal_notification_dismissal: ['user_id', 'viewer_actor_type', 'viewer_staff_profile_id', 'viewer_applicant_user_id'] }
  );

  await runSingle(
    {
      tableName: 'iset_event_receipt',
      columnName: 'recipient_id',
      canonicalField: 'viewer_staff_profile_id + viewer_applicant_user_id',
      classification: 'legacy event read-state principal shadow',
      retiredWhenMissing: true,
      retirementGate: 'Retire only after event receipt primary/unique keys and shared emitter queries move to typed viewer fields; unresolved legacy recipients must be quarantined rather than guessed.',
    },
    `
      SELECT
        COUNT(*) AS rows_total,
        COALESCE(SUM(recipient_id IS NOT NULL AND recipient_id <> ''), 0) AS shadow_values,
        COALESCE(SUM(viewer_staff_profile_id IS NOT NULL OR viewer_applicant_user_id IS NOT NULL), 0) AS canonical_values,
        COALESCE(SUM(recipient_id IS NOT NULL AND recipient_id <> '' AND (viewer_staff_profile_id IS NOT NULL OR viewer_applicant_user_id IS NOT NULL)), 0) AS matched_canonical_values,
        COALESCE(SUM(viewer_staff_profile_id IS NULL AND viewer_applicant_user_id IS NULL), 0) AS mismatches_or_unresolved
      FROM iset_event_receipt
    `,
    { iset_event_receipt: ['recipient_id', 'viewer_staff_profile_id', 'viewer_applicant_user_id'] }
  );

  await runSingle(
    {
      tableName: 'iset_event_entry',
      columnName: 'actor_id',
      canonicalField: 'actor_staff_profile_id + actor_applicant_user_id',
      classification: 'audit actor principal with typed references',
      retirementGate: 'Do not drop as a simple cleanup. actor_id may be an audit-retained Cognito/system principal; decide rename/redaction only through an audit-retention design.',
    },
    `
      SELECT
        COUNT(*) AS rows_total,
        COALESCE(SUM(actor_id IS NOT NULL AND actor_id <> ''), 0) AS shadow_values,
        COALESCE(SUM(actor_staff_profile_id IS NOT NULL OR actor_applicant_user_id IS NOT NULL), 0) AS canonical_values,
        COALESCE(SUM(actor_id IS NOT NULL AND actor_id <> '' AND (actor_staff_profile_id IS NOT NULL OR actor_applicant_user_id IS NOT NULL)), 0) AS matched_canonical_values,
        COALESCE(SUM(
          (actor_type = 'staff' AND actor_staff_profile_id IS NULL)
          OR (actor_type = 'applicant' AND actor_applicant_user_id IS NULL)
        ), 0) AS mismatches_or_unresolved
      FROM iset_event_entry
    `,
    { iset_event_entry: ['actor_id', 'actor_type', 'actor_staff_profile_id', 'actor_applicant_user_id'] }
  );

  await runSingle(
    {
      tableName: 'iset_application_version',
      columnName: 'created_by_id',
      canonicalField: 'created_by_staff_profile_id + created_by_user_id',
      classification: 'legacy/opaque version author principal',
      retiredWhenMissing: true,
      retirementGate: 'Retire after version display and restore paths use typed author fields exclusively, and TEST/PROD migration confirms no unresolved historical opaque author values.',
    },
    `
      SELECT
        COUNT(*) AS rows_total,
        COALESCE(SUM(created_by_id IS NOT NULL AND created_by_id <> ''), 0) AS shadow_values,
        COALESCE(SUM(created_by_staff_profile_id IS NOT NULL OR created_by_user_id IS NOT NULL), 0) AS canonical_values,
        COALESCE(SUM(created_by_id IS NOT NULL AND created_by_id <> '' AND (created_by_staff_profile_id IS NOT NULL OR created_by_user_id IS NOT NULL)), 0) AS matched_canonical_values,
        COALESCE(SUM(created_by_id IS NOT NULL AND created_by_id <> '' AND created_by_staff_profile_id IS NULL AND created_by_user_id IS NULL), 0) AS mismatches_or_unresolved
      FROM iset_application_version
    `,
    { iset_application_version: ['created_by_id', 'created_by_staff_profile_id', 'created_by_user_id'] }
  );

  await runSingle(
    {
      tableName: 'iset_case',
      columnName: 'application_id',
      canonicalField: 'iset_application.case_id',
      classification: 'legacy case-side primary application pointer',
      retirementGate: 'Retire after reads use iset_application.case_id for the one-case-many-applications model and TEST/PROD reports no bidirectional mismatches.',
      retiredWhenMissing: true,
    },
    `
      SELECT
        COUNT(*) AS rows_total,
        COALESCE(SUM(c.application_id IS NOT NULL), 0) AS shadow_values,
        (SELECT COALESCE(SUM(a.case_id IS NOT NULL), 0) FROM iset_application a) AS canonical_values,
        COALESCE(SUM(c.application_id IS NOT NULL AND a.id IS NOT NULL AND a.case_id = c.id), 0) AS matched_canonical_values,
        COALESCE(SUM(c.application_id IS NOT NULL AND (a.id IS NULL OR a.case_id <> c.id)), 0) AS mismatches_or_unresolved
      FROM iset_case c
      LEFT JOIN iset_application a ON a.id = c.application_id
    `,
    { iset_case: ['application_id'], iset_application: ['case_id'] }
  );

  return rows;
}

async function buildChecks(conn) {
  const checks = [];
  const hasCaseAssignedStaffProfileId = await columnExists(conn, 'iset_case', 'assigned_staff_profile_id');
  const hasCaseLegacyAssignedToUserId = await columnExists(conn, 'iset_case', 'assigned_to_user_id');
  const hasCaseLegacyApplicationId = await columnExists(conn, 'iset_case', 'application_id');
  const hasMessageActorColumns = await columnExists(conn, 'messages', 'sender_actor_type')
    && await columnExists(conn, 'messages', 'recipient_actor_type')
    && await columnExists(conn, 'messages', 'sender_user_id')
    && await columnExists(conn, 'messages', 'recipient_user_id')
    && await columnExists(conn, 'messages', 'sender_staff_profile_id')
    && await columnExists(conn, 'messages', 'recipient_staff_profile_id');
  const hasMessageLegacyParticipantColumns = await columnExists(conn, 'messages', 'sender_id')
    && await columnExists(conn, 'messages', 'recipient_id');
  const hasMessageAttachmentClientId = await columnExists(conn, 'message_attachment', 'client_id');
  const hasInternalNotificationTypedAudience = await columnExists(conn, 'iset_internal_notification', 'audience_actor_type')
    && await columnExists(conn, 'iset_internal_notification', 'audience_staff_profile_id')
    && await columnExists(conn, 'iset_internal_notification', 'audience_applicant_user_id')
    && await columnExists(conn, 'iset_internal_notification_dismissal', 'viewer_actor_type')
    && await columnExists(conn, 'iset_internal_notification_dismissal', 'viewer_staff_profile_id')
    && await columnExists(conn, 'iset_internal_notification_dismissal', 'viewer_applicant_user_id');
  const hasInternalNotificationAudienceShadow = await columnExists(conn, 'iset_internal_notification', 'audience_user_id');
  const hasInternalNotificationDismissalShadow = await columnExists(conn, 'iset_internal_notification_dismissal', 'user_id');
  const hasEventEntryTypedActorRefs = await columnExists(conn, 'iset_event_entry', 'actor_staff_profile_id')
    && await columnExists(conn, 'iset_event_entry', 'actor_applicant_user_id');
  const hasEventReceiptTypedViewerRefs = await columnExists(conn, 'iset_event_receipt', 'viewer_staff_profile_id')
    && await columnExists(conn, 'iset_event_receipt', 'viewer_applicant_user_id');
  const hasEventReceiptLegacyRecipientId = await columnExists(conn, 'iset_event_receipt', 'recipient_id');
  const hasApplicationVersionTypedAuthorRefs = await columnExists(conn, 'iset_application_version', 'created_by_staff_profile_id')
    && await columnExists(conn, 'iset_application_version', 'created_by_user_id');
  const hasApplicationVersionLegacyCreatedById = await columnExists(conn, 'iset_application_version', 'created_by_id');
  const caseAssignedStaffJoinExpr = hasCaseAssignedStaffProfileId
    ? (hasCaseLegacyAssignedToUserId
      ? 'COALESCE(c.assigned_staff_profile_id, c.assigned_to_user_id)'
      : 'c.assigned_staff_profile_id')
    : 'c.assigned_to_user_id';
  const caseAssignmentDomainSql = hasCaseAssignedStaffProfileId && hasCaseLegacyAssignedToUserId
    ? `
      SELECT
        COUNT(*) AS total_cases,
        SUM(c.assigned_to_user_id IS NOT NULL) AS legacy_assigned_cases,
        SUM(c.assigned_staff_profile_id IS NOT NULL) AS explicit_assigned_cases,
        SUM(c.assigned_staff_profile_id IS NOT NULL AND sp_explicit.id IS NOT NULL) AS explicit_matches_staff_profile,
        SUM(c.assigned_staff_profile_id IS NOT NULL AND sp_explicit.id IS NULL) AS explicit_matches_no_staff_profile,
        SUM(c.assigned_to_user_id IS NOT NULL AND sp_legacy.id IS NOT NULL) AS legacy_matches_staff_profile,
        SUM(c.assigned_to_user_id IS NOT NULL AND u_legacy.id IS NOT NULL) AS legacy_matches_shared_user,
        SUM(c.assigned_to_user_id IS NOT NULL AND sp_legacy.id IS NOT NULL AND u_legacy.id IS NOT NULL) AS legacy_matches_both_domains,
        SUM(c.assigned_to_user_id IS NOT NULL AND sp_legacy.id IS NULL AND u_legacy.id IS NULL) AS legacy_matches_neither_domain,
        SUM(c.assigned_to_user_id IS NOT NULL AND c.assigned_staff_profile_id IS NULL) AS legacy_only_assigned,
        SUM(c.assigned_staff_profile_id IS NOT NULL AND c.assigned_to_user_id IS NULL) AS explicit_only_assigned,
        SUM(c.assigned_to_user_id IS NOT NULL AND c.assigned_staff_profile_id IS NOT NULL AND c.assigned_to_user_id <> c.assigned_staff_profile_id) AS assignment_column_drift
      FROM iset_case c
      LEFT JOIN staff_profiles sp_explicit ON sp_explicit.id = c.assigned_staff_profile_id
      LEFT JOIN staff_profiles sp_legacy ON sp_legacy.id = c.assigned_to_user_id
      LEFT JOIN \`user\` u_legacy ON u_legacy.id = c.assigned_to_user_id
    `
    : hasCaseAssignedStaffProfileId
      ? `
      SELECT
        COUNT(*) AS total_cases,
        0 AS legacy_assigned_cases,
        SUM(c.assigned_staff_profile_id IS NOT NULL) AS explicit_assigned_cases,
        SUM(c.assigned_staff_profile_id IS NOT NULL AND sp_explicit.id IS NOT NULL) AS explicit_matches_staff_profile,
        SUM(c.assigned_staff_profile_id IS NOT NULL AND sp_explicit.id IS NULL) AS explicit_matches_no_staff_profile,
        0 AS legacy_matches_staff_profile,
        0 AS legacy_matches_shared_user,
        0 AS legacy_matches_both_domains,
        0 AS legacy_matches_neither_domain,
        0 AS legacy_only_assigned,
        SUM(c.assigned_staff_profile_id IS NOT NULL) AS explicit_only_assigned,
        0 AS assignment_column_drift
      FROM iset_case c
      LEFT JOIN staff_profiles sp_explicit ON sp_explicit.id = c.assigned_staff_profile_id
    `
    : `
      SELECT
        COUNT(*) AS total_cases,
        SUM(c.assigned_to_user_id IS NOT NULL) AS assigned_cases,
        SUM(c.assigned_to_user_id IS NOT NULL AND sp.id IS NOT NULL) AS assigned_matches_staff_profile,
        SUM(c.assigned_to_user_id IS NOT NULL AND u.id IS NOT NULL) AS assigned_matches_shared_user,
        SUM(c.assigned_to_user_id IS NOT NULL AND sp.id IS NOT NULL AND u.id IS NOT NULL) AS assigned_matches_both_domains,
        SUM(c.assigned_to_user_id IS NOT NULL AND sp.id IS NULL AND u.id IS NULL) AS assigned_matches_neither_domain
      FROM iset_case c
      LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id
      LEFT JOIN \`user\` u ON u.id = c.assigned_to_user_id
    `;

  checks.push({
    title: 'Selected table row counts',
    severity: 'info',
    description: 'Row counts for tables involved in the privacy ERM cleanup. Missing means the table does not exist in this database.',
    rows: await countSelectedTables(conn),
    totalRows: DEFAULT_TABLES.length,
  });

  checks.push({
    title: 'Known legacy or experiment table status',
    severity: 'medium',
    description: 'Presence and row counts for tables that look obsolete or experimental.',
    rows: await legacyTableStatus(conn),
    totalRows: LEGACY_TABLES.length,
  });

  checks.push({
    title: 'Application version table column status',
    severity: 'medium',
    description: 'Current application-version columns compared with columns still referenced by old route paths.',
    rows: await applicationVersionColumnStatus(conn),
    totalRows: 0,
  });

  checks.push({
    title: 'Legacy compatibility shadow retirement inventory',
    severity: 'medium',
    description: 'Retirement readiness for known compatibility shadows. Zero mismatches means data is aligned; it does not mean the field is safe to drop until the listed code and migration gate is complete.',
    rows: await legacyShadowRetirementInventory(conn),
    totalRows: 0,
  });

  if (await tableExists(conn, 'iset_application_version')) {
    if (hasApplicationVersionTypedAuthorRefs) {
      await runCheck(conn, checks, {
        title: 'Application version typed author counts',
        severity: 'medium',
        description: hasApplicationVersionLegacyCreatedById
          ? 'Application version authors should use typed staff-profile/local-user references; created_by_id remains compatibility text until retired.'
          : 'Application version authors use typed staff-profile/local-user references; legacy created_by_id is physically retired in this schema.',
        requires: ['iset_application_version', 'staff_profiles', 'user'],
        sql: `
          SELECT
            COUNT(*) AS versions,
            COALESCE(SUM(created_by_staff_profile_id IS NOT NULL), 0) AS staff_profile_author_refs,
            COALESCE(SUM(created_by_user_id IS NOT NULL), 0) AS local_user_author_refs,
            ${hasApplicationVersionLegacyCreatedById
              ? "COALESCE(SUM(created_by_id IS NOT NULL AND created_by_id <> ''), 0)"
              : '0'} AS legacy_created_by_id_values,
            ${hasApplicationVersionLegacyCreatedById
              ? "COALESCE(SUM(created_by_id REGEXP '^[0-9]+$'), 0)"
              : '0'} AS legacy_numeric_created_by_id_values,
            COALESCE(SUM(created_by_staff_profile_id IS NOT NULL AND sp.id IS NULL), 0) AS missing_staff_profile_author,
            COALESCE(SUM(created_by_user_id IS NOT NULL AND u.id IS NULL), 0) AS missing_user_author,
            ${hasApplicationVersionLegacyCreatedById
              ? "COALESCE(SUM(created_by_id IS NOT NULL AND created_by_id <> '' AND created_by_staff_profile_id IS NULL AND created_by_user_id IS NULL), 0)"
              : '0'} AS unresolved_legacy_author_values
          FROM iset_application_version v
          LEFT JOIN staff_profiles sp ON sp.id = v.created_by_staff_profile_id
          LEFT JOIN \`user\` u ON u.id = v.created_by_user_id
        `,
      });
    } else {
      checks.push({
        title: 'Application version typed author counts',
        severity: 'medium',
        description: 'Application version typed author columns are not present in this database yet.',
        rows: [{ status: 'typed author columns missing' }],
        totalRows: 1,
      });
    }
  }

  await runCheck(conn, checks, {
    title: 'Application and CFA lineage relationship counts',
    severity: 'high',
    description: 'Counts missing application submission/version links and CFA case/version/document/participant targets before FK hardening.',
    requires: [
      'iset_application',
      'iset_application_submission',
      'iset_application_version',
      'cfa_series',
      'cfa_version',
      'cfa_version_documents',
      'iset_case',
      'iset_document',
      'user',
    ],
    sql: `
      SELECT
        (SELECT COUNT(*)
           FROM iset_application a
           LEFT JOIN iset_application_submission s ON s.id = a.submission_id
          WHERE a.submission_id IS NOT NULL
            AND s.id IS NULL) AS applications_missing_submission,
        (SELECT COUNT(*)
           FROM iset_application_version av
           LEFT JOIN iset_application a ON a.id = av.application_id
          WHERE a.id IS NULL) AS application_versions_missing_application,
        (SELECT COUNT(*)
           FROM cfa_series cs
           LEFT JOIN iset_case c ON c.id = cs.case_id
          WHERE c.id IS NULL) AS cfa_series_missing_case,
        (SELECT COUNT(*)
           FROM cfa_version cv
           LEFT JOIN cfa_series cs ON cs.id = cv.series_id
          WHERE cs.id IS NULL) AS cfa_versions_missing_series,
        (SELECT COUNT(*)
           FROM cfa_version cv
           LEFT JOIN cfa_version sup ON sup.id = cv.supersedes_version_id
          WHERE cv.supersedes_version_id IS NOT NULL
            AND sup.id IS NULL) AS cfa_versions_missing_supersedes_version,
        (SELECT COUNT(*)
           FROM cfa_version cv
           LEFT JOIN \`user\` u ON u.id = cv.signed_by_participant_id
          WHERE cv.signed_by_participant_id IS NOT NULL
            AND u.id IS NULL) AS cfa_versions_missing_signed_participant,
        (SELECT COUNT(*)
           FROM cfa_version_documents cvd
           LEFT JOIN cfa_version cv ON cv.id = cvd.cfa_version_id
          WHERE cv.id IS NULL) AS cfa_documents_missing_version,
        (SELECT COUNT(*)
           FROM cfa_version_documents cvd
           LEFT JOIN iset_document d ON d.id = cvd.document_id
          WHERE d.id IS NULL) AS cfa_documents_missing_document,
        (SELECT COUNT(*)
           FROM cfa_version_documents cvd
           JOIN cfa_version cv ON cv.id = cvd.cfa_version_id
           JOIN cfa_series cs ON cs.id = cv.series_id
           JOIN iset_case c ON c.id = cs.case_id
           JOIN iset_document d ON d.id = cvd.document_id
          WHERE d.case_id IS NULL
             OR d.client_id IS NULL
             OR d.case_id <> cs.case_id
             OR d.client_id <> c.client_id) AS cfa_documents_case_or_client_mismatch
    `,
  });

  await runCheck(conn, checks, {
    title: 'Remaining relationship hardening counts',
    severity: 'high',
    description: 'Counts missing targets for the next FK-hardening relationships. Workflow IDs are reported separately because current portal runtime stores string workflow keys such as iset-v1, not numeric workflow table IDs.',
    requires: [
      'client_applicant_account_event',
      'client',
      'input_json_state',
      'iset_case_assessment',
      'budget_pot',
      'iset_case_reminder',
      'iset_case_action_plan',
      'staff_profiles',
      'canada_region',
      'iset_application_submission',
      'iset_application_draft_dynamic',
      'workflow',
    ],
    sql: `
      SELECT
        (SELECT COUNT(*)
           FROM client_applicant_account_event e
           LEFT JOIN client c ON c.id = e.client_id
          WHERE c.id IS NULL) AS client_account_events_missing_client,
        (SELECT COUNT(*)
           FROM input_json_state s
           LEFT JOIN client c ON c.id = s.client_id
          WHERE s.client_id IS NOT NULL
            AND c.id IS NULL) AS input_json_state_missing_client,
        (SELECT COUNT(*)
           FROM iset_case_assessment a
           LEFT JOIN budget_pot bp ON bp.id = a.intervention_budget_pot_id
          WHERE a.intervention_budget_pot_id IS NOT NULL
            AND bp.id IS NULL) AS case_assessments_missing_intervention_budget_pot,
        (SELECT COUNT(*)
           FROM iset_case_reminder r
           LEFT JOIN iset_case_action_plan ap ON ap.id = r.action_plan_id
          WHERE r.action_plan_id IS NOT NULL
            AND ap.id IS NULL) AS case_reminders_missing_action_plan,
        (SELECT COUNT(*)
           FROM staff_profiles sp
           LEFT JOIN canada_region cr ON cr.region_id = sp.region_id
          WHERE sp.region_id IS NOT NULL
            AND cr.region_id IS NULL) AS staff_profiles_missing_region,
        (SELECT COUNT(*)
           FROM iset_application_submission s
           LEFT JOIN workflow wid
             ON CONVERT(CAST(wid.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci
              = CONVERT(s.workflow_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
           LEFT JOIN workflow wn
             ON CONVERT(wn.name USING utf8mb4) COLLATE utf8mb4_unicode_ci
              = CONVERT(s.workflow_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
          WHERE wid.id IS NULL
            AND wn.id IS NULL) AS application_submission_workflow_string_unmatched,
        (SELECT COUNT(*)
           FROM input_json_state s
           LEFT JOIN workflow wid
             ON CONVERT(CAST(wid.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci
              = CONVERT(s.workflow_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
           LEFT JOIN workflow wn
             ON CONVERT(wn.name USING utf8mb4) COLLATE utf8mb4_unicode_ci
              = CONVERT(s.workflow_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
          WHERE wid.id IS NULL
            AND wn.id IS NULL) AS input_json_state_workflow_string_unmatched,
        (SELECT COUNT(*)
           FROM iset_application_draft_dynamic d
           LEFT JOIN workflow wid
             ON CONVERT(CAST(wid.id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci
              = CONVERT(d.workflow_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
           LEFT JOIN workflow wn
             ON CONVERT(wn.name USING utf8mb4) COLLATE utf8mb4_unicode_ci
              = CONVERT(d.workflow_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
          WHERE wid.id IS NULL
            AND wn.id IS NULL) AS draft_dynamic_workflow_string_unmatched
    `,
  });

  await runCheck(conn, checks, {
    title: 'Database object summary',
    severity: 'info',
    description: 'High-level schema size and relationship count.',
    sql: `
      SELECT
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE') AS base_tables,
        (SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE()) AS foreign_keys,
        (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE()) AS routines
    `,
  });

  await runCheck(conn, checks, {
    title: 'Privacy-sensitive FK delete rules',
    severity: 'high',
    description: 'Delete rules for scope-preserving message, document, signing-request, escalation, task, notification, upload, lock, application, and CFA relationships. SET NULL here can silently detach private records from their case/client/applicant context or turn targeted records into broad records.',
    sql: `
      SELECT table_name, constraint_name, referenced_table_name, delete_rule
        FROM information_schema.referential_constraints
       WHERE constraint_schema = DATABASE()
         AND (
           (table_name = 'messages' AND constraint_name IN (
             'fk_messages_case',
             'fk_messages_application',
             'fk_messages_sender_user',
             'fk_messages_recipient_user',
             'fk_messages_sender_staff_profile',
             'fk_messages_recipient_staff_profile'
           ))
           OR (table_name = 'iset_case' AND constraint_name IN (
             'fk_iset_case_assigned_staff_profile',
             'fk_iset_case_legacy_assigned_staff_profile'
           ))
           OR (table_name = 'iset_application' AND constraint_name IN (
             'fk_iset_application_submission_id',
             'fk_iset_application_client_id',
             'fk_iset_application_case_id'
           ))
           OR (table_name = 'iset_application_version' AND constraint_name IN (
             'fk_iset_application_version_application',
             'fk_iset_application_version_created_staff_profile',
             'fk_iset_application_version_created_user'
           ))
           OR (table_name = 'cfa_series' AND constraint_name IN (
             'fk_cfa_series_case',
             'fk_cfa_series_created_by_staff_profile'
           ))
           OR (table_name = 'cfa_version' AND constraint_name IN (
             'fk_cfa_version_series',
             'fk_cfa_version_supersedes',
             'fk_cfa_version_signed_participant',
             'fk_cfa_version_created_by_staff_profile',
             'fk_cfa_version_sent_by_staff_profile'
           ))
           OR (table_name = 'cfa_version_documents' AND constraint_name IN (
             'fk_cfa_version_documents_version',
             'fk_cfa_version_documents_document'
           ))
           OR (table_name = 'message_attachment' AND constraint_name IN (
             'fk_message_attachment_message',
             'fk_message_attachment_case',
             'fk_message_attachment_application',
             'fk_message_attachment_client',
             'fk_message_attachment_user'
           ))
           OR (table_name = 'iset_document' AND constraint_name IN (
             'fk_iset_document_user',
             'fk_iset_document_applicant_user',
             'fk_iset_document_case',
             'fk_iset_document_application',
             'fk_iset_document_client',
             'fk_iset_document_origin_message'
           ))
           OR (table_name = 'signing_request' AND constraint_name IN (
             'fk_signing_request_workflow',
             'fk_signing_request_case',
             'fk_signing_request_participant_user',
             'fk_signing_request_created_by_user'
           ))
           OR (table_name = 'iset_application_escalation' AND constraint_name IN (
             'fk_application_escalation_application',
             'fk_application_escalation_case',
             'fk_application_escalation_current_owner_user',
             'fk_application_escalation_requester_user',
             'fk_application_escalation_resolved_by_user'
           ))
           OR (table_name = 'iset_case_task' AND constraint_name IN (
             'fk_case_task_created_by_user',
             'fk_case_task_updated_by_user'
           ))
           OR (table_name = 'iset_internal_notification' AND constraint_name IN (
             'fk_internal_notification_staff_profile',
             'fk_internal_notification_applicant_user'
           ))
           OR (table_name = 'iset_internal_notification_dismissal' AND constraint_name IN (
             'fk_internal_notification_dismissal_notification',
             'fk_internal_notification_dismissal_staff_profile',
             'fk_internal_notification_dismissal_applicant_user'
           ))
           OR (table_name = 'pending_uploads' AND constraint_name IN (
             'fk_pending_uploads_user'
           ))
           OR (table_name = 'application_lock' AND constraint_name IN (
             'fk_application_lock_application'
           ))
           OR (table_name = 'client_applicant_account_event' AND constraint_name IN (
             'fk_client_applicant_account_event_client',
             'fk_client_applicant_account_event_actor_staff'
           ))
           OR (table_name = 'input_json_state' AND constraint_name IN (
             'fk_input_json_state_user',
             'fk_input_json_state_client'
           ))
           OR (table_name = 'iset_case_assessment' AND constraint_name IN (
             'fk_iset_case_assessment_case',
             'fk_case_assessment_intervention_budget_pot'
           ))
           OR (table_name = 'iset_case_reminder' AND constraint_name IN (
             'fk_case_reminder_case',
             'fk_case_reminder_application',
             'fk_case_reminder_action_plan',
             'fk_case_reminder_intervention',
             'fk_case_reminder_assigned_to',
             'fk_case_reminder_completed_by',
             'fk_case_reminder_created_by',
             'fk_case_reminder_updated_by'
           ))
           OR (table_name = 'staff_profiles' AND constraint_name IN (
             'fk_staff_profiles_region'
           ))
         )
       ORDER BY table_name, constraint_name
    `,
  });

  await runCheck(conn, checks, {
    title: 'Privacy CHECK constraints',
    severity: 'high',
    description: 'CHECK constraints that prevent unscoped secure messages, ambiguous message/notification/event actors, and privacy-sensitive documents without required lineage.',
    sql: `
      SELECT tc.table_name, cc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc
          ON cc.constraint_schema = tc.constraint_schema
         AND cc.constraint_name = tc.constraint_name
       WHERE tc.constraint_schema = DATABASE()
         AND tc.constraint_name IN (
           'chk_messages_sender_actor_scope',
           'chk_messages_recipient_actor_scope',
           'chk_messages_exactly_one_applicant_actor',
           'chk_message_attachment_required_scope',
           'chk_iset_document_application_submission_scope',
           'chk_iset_document_manual_upload_scope',
           'chk_iset_document_secure_message_attachment_scope',
           'chk_iset_document_system_generated_scope',
           'chk_internal_notification_audience_scope',
           'chk_internal_notification_audience_typed_scope',
           'chk_internal_notification_dismissal_viewer_scope',
           'chk_internal_notification_dismissal_typed_viewer_scope',
           'chk_iset_event_entry_typed_actor_scope'
         )
       ORDER BY tc.table_name, cc.constraint_name
    `,
  });

  await runCheck(conn, checks, {
    title: 'Stored routines still present',
    severity: 'medium',
    description: 'Routine names only. Definitions are intentionally excluded from the durable report.',
    sql: `
      SELECT routine_name, routine_type
        FROM information_schema.routines
       WHERE routine_schema = DATABASE()
       ORDER BY routine_name
    `,
  });

  await runCheck(conn, checks, {
    title: 'ID-like columns without foreign keys',
    severity: 'high',
    description: 'Relationship-looking columns with no FK. The classification column separates row relationships from runtime keys, external references, audit principals, and legacy surfaces.',
    sql: `
      SELECT
        c.table_name,
        c.column_name,
        c.column_type,
        c.is_nullable,
        CASE
          WHEN c.table_name = 'application_lock' AND c.column_name = 'owner_user_id'
            THEN 'opaque lock owner principal'
          WHEN c.table_name IN ('input_json_state', 'iset_application_draft_dynamic', 'iset_application_submission') AND c.column_name = 'workflow_id'
            THEN 'runtime workflow string key'
          WHEN c.table_name = 'iset_event_entry' AND c.column_name = 'actor_id'
            THEN 'audit actor principal text'
          WHEN c.table_name = 'iset_event_entry' AND c.column_name = 'subject_id'
            THEN 'polymorphic event subject id'
          WHEN c.table_name = 'iset_event_entry' AND c.column_name IN ('correlation_id', 'tracking_id')
            THEN 'event correlation/reference token'
          WHEN c.table_name IN ('budget_pot', 'budget_snapshot_pot') AND c.column_name = 'agreement_id'
            THEN 'external agreement/reference label'
          WHEN c.table_name = 'ptma' AND c.column_name = 'iset_agreement_id'
            THEN 'external ISET agreement reference'
          WHEN c.table_name = 'finance_saved_view' AND c.column_name = 'budget_version_id'
            THEN 'saved-view budget version key'
          WHEN c.table_name = 'payment_packet_communication' AND c.column_name = 'provider_message_id'
            THEN 'external provider message id'
          WHEN c.table_name = 'pending_uploads' AND c.column_name = 'upload_id'
            THEN 'opaque upload token primary key'
          WHEN c.table_name = 'staff_tutorial_progress' AND c.column_name = 'tutorial_id'
            THEN 'static tutorial definition key'
          WHEN c.table_name = 'user_session_audit' AND c.column_name = 'user_id'
            THEN 'opaque session principal'
          WHEN c.table_name = 'canada_region' AND c.column_name = 'region_id'
            THEN 'lookup table primary key'
          WHEN c.table_name = 'zzz_legacy_documents'
            THEN 'retired legacy document upload experiment'
          ELSE 'unclassified relationship-looking id'
        END AS classification,
        CASE
          WHEN c.table_name IN ('input_json_state', 'iset_application_draft_dynamic', 'iset_application_submission') AND c.column_name = 'workflow_id'
            THEN 'Do not coerce to workflow.id; add an explicit workflow key model before constraining.'
          WHEN c.table_name = 'zzz_legacy_documents'
            THEN 'Fail-closed retirement migration drops the table only when empty.'
          WHEN c.table_name IN ('application_lock', 'iset_event_entry', 'user_session_audit')
            THEN 'Retain as audit/runtime principal text unless a separate retention design renames or redacts it.'
          WHEN c.table_name IN ('budget_pot', 'budget_snapshot_pot', 'ptma', 'finance_saved_view', 'payment_packet_communication', 'pending_uploads', 'staff_tutorial_progress', 'canada_region')
            THEN 'Document as non-row identifier; no FK expected.'
          ELSE 'Review before adding any FK.'
        END AS next_action,
        COALESCE(GROUP_CONCAT(DISTINCT s.index_name ORDER BY s.index_name SEPARATOR ', '), '') AS indexes
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage k
        ON k.table_schema = c.table_schema
       AND k.table_name = c.table_name
       AND k.column_name = c.column_name
       AND k.referenced_table_name IS NOT NULL
      LEFT JOIN information_schema.statistics s
        ON s.table_schema = c.table_schema
       AND s.table_name = c.table_name
       AND s.column_name = c.column_name
      WHERE c.table_schema = DATABASE()
        AND c.table_name NOT LIKE 'privacy\\_erm\\_%'
        AND c.column_name <> 'id'
        AND c.column_name LIKE '%\\_id'
        AND k.constraint_name IS NULL
      GROUP BY c.table_name, c.column_name, c.column_type, c.is_nullable
      ORDER BY c.table_name, c.column_name
    `,
  });

  await runCheck(conn, checks, {
    title: 'User-like columns without a user-table FK',
    severity: 'high',
    description: 'Columns that read like shared user IDs, sender/recipient IDs, or owner user IDs but are not constrained to user(id). Classification separates staff-profile shadows and opaque actor IDs from unresolved risks.',
    sql: `
      SELECT
        c.table_name,
        c.column_name,
        c.column_type,
        COALESCE(MAX(k.referenced_table_name), '') AS referenced_table,
        CASE
          WHEN c.table_name = 'iset_case' AND c.column_name = 'assigned_to_user_id'
            THEN 'legacy staff-profile assignment shadow'
          WHEN c.table_name = 'iset_internal_notification' AND c.column_name = 'audience_user_id'
            THEN 'legacy typed notification audience shadow'
          WHEN c.table_name = 'iset_internal_notification_dismissal' AND c.column_name = 'user_id'
            THEN 'legacy typed notification viewer shadow'
          WHEN c.table_name = 'application_lock' AND c.column_name = 'owner_user_id'
            THEN 'opaque lock owner principal'
          WHEN c.table_name = 'iset_event_receipt' AND c.column_name = 'recipient_id'
            THEN 'legacy event read-state principal shadow'
          WHEN c.table_name = 'user_session_audit' AND c.column_name = 'user_id'
            THEN 'opaque session principal'
          WHEN c.table_name = 'iset_application_version' AND c.column_name = 'created_by_id'
            THEN 'opaque version actor principal'
          WHEN c.table_name IN ('jordan_application', 'jordan_application_draft')
            THEN 'retired legacy jordan application identity'
          ELSE 'unclassified'
        END AS classification,
        COALESCE(GROUP_CONCAT(DISTINCT s.index_name ORDER BY s.index_name SEPARATOR ', '), '') AS indexes
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage k
        ON k.table_schema = c.table_schema
       AND k.table_name = c.table_name
       AND k.column_name = c.column_name
       AND k.referenced_table_name IS NOT NULL
      LEFT JOIN information_schema.statistics s
        ON s.table_schema = c.table_schema
       AND s.table_name = c.table_name
       AND s.column_name = c.column_name
      WHERE c.table_schema = DATABASE()
        AND c.table_name NOT LIKE 'privacy\\_erm\\_%'
        AND (
          c.column_name REGEXP '(^|_)user_id$'
          OR c.column_name IN ('sender_id', 'recipient_id', 'owner_user_id', 'created_by_id', 'updated_by_id')
        )
      GROUP BY c.table_name, c.column_name, c.column_type
      HAVING referenced_table = '' OR referenced_table <> 'user'
      ORDER BY c.table_name, c.column_name
    `,
  });

  await runCheck(conn, checks, {
    title: 'Staff-profile-like columns and FK status',
    severity: 'high',
    description: 'Columns that appear to store staff_profiles.id, including the misleading iset_case.assigned_to_user_id column.',
    sql: `
      SELECT
        c.table_name,
        c.column_name,
        c.column_type,
        COALESCE(MAX(k.referenced_table_name), '') AS referenced_table
      FROM information_schema.columns c
      LEFT JOIN information_schema.key_column_usage k
        ON k.table_schema = c.table_schema
       AND k.table_name = c.table_name
       AND k.column_name = c.column_name
       AND k.referenced_table_name IS NOT NULL
      WHERE c.table_schema = DATABASE()
        AND c.table_name NOT LIKE 'privacy\\_erm\\_%'
        AND (
          c.column_name LIKE '%staff_profile_id'
          OR (c.table_name = 'iset_case' AND c.column_name = 'assigned_to_user_id')
          OR c.column_name IN ('assigned_staff_profile_id', 'created_by_staff_profile_id', 'updated_by_staff_profile_id')
        )
      GROUP BY c.table_name, c.column_name, c.column_type
      ORDER BY c.table_name, c.column_name
    `,
  });

  await runCheck(conn, checks, {
    title: 'Case assignment ID domain',
    severity: 'high',
    description: 'Checks whether case assignment IDs match staff_profiles.id and whether the explicit staff-profile assignment column has drifted from the legacy column.',
    requires: ['iset_case', 'staff_profiles', 'user'],
    sql: caseAssignmentDomainSql,
  });

  await runCheck(conn, checks, {
    title: 'Staff profile to shared user overlap',
    severity: 'high',
    description: 'Counts staff profiles that also resolve to rows in the shared user table by Cognito subject or email.',
    requires: ['staff_profiles', 'user'],
    sql: `
      SELECT
        COUNT(*) AS staff_profiles,
        SUM(EXISTS (
          SELECT 1 FROM \`user\` u
           WHERE CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
                 CONVERT(sp.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
        )) AS staff_profiles_matching_user_by_cognito_sub,
        SUM(EXISTS (
          SELECT 1 FROM \`user\` u
           WHERE LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
                 LOWER(CONVERT(sp.email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
        )) AS staff_profiles_matching_user_by_email,
        SUM(EXISTS (
          SELECT 1 FROM \`user\` u
           WHERE CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
                 CONVERT(sp.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
        )
        OR EXISTS (
          SELECT 1 FROM \`user\` u
           WHERE LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
                 LOWER(CONVERT(sp.email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
        )) AS staff_profiles_matching_user_by_any_route
      FROM staff_profiles sp
    `,
  });

  await runCheck(conn, checks, {
    title: 'Shared users overlapping staff and client identity',
    severity: 'high',
    description: 'Counts shared user rows that appear to overlap staff identity and applicant/client identity. No names or emails are emitted.',
    requires: ['staff_profiles', 'user', 'client'],
    sql: `
      SELECT
        COUNT(*) AS shared_users,
        SUM(EXISTS (
          SELECT 1
            FROM staff_profiles sp
           WHERE CONVERT(sp.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
                 CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
              OR LOWER(CONVERT(sp.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
                 LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
        )) AS users_matching_staff_identity,
        SUM(EXISTS (
              SELECT 1
                FROM client c
               WHERE CONVERT(c.applicant_cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
                     CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
                  OR CONVERT(c.applicant_cognito_username USING utf8mb4) COLLATE utf8mb4_unicode_ci =
                     CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
                  OR LOWER(CONVERT(c.applicant_account_email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
                     LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
            )) AS users_matching_client_identity,
        SUM(
          (EXISTS (
            SELECT 1
              FROM staff_profiles sp
             WHERE CONVERT(sp.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
                   CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
                OR LOWER(CONVERT(sp.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
                   LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
          ))
          AND
          (EXISTS (
              SELECT 1
                FROM client c
               WHERE CONVERT(c.applicant_cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
                     CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
                  OR CONVERT(c.applicant_cognito_username USING utf8mb4) COLLATE utf8mb4_unicode_ci =
                     CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
                  OR LOWER(CONVERT(c.applicant_account_email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
                     LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
          ))
        ) AS users_matching_both_staff_and_client_identity
      FROM \`user\` u
    `,
  });

  await runCheck(conn, checks, {
    title: 'Message referential and scope counts',
    severity: 'high',
    description: 'Counts missing relationship targets and unscoped messages.',
    requires: ['messages', 'user', 'iset_case', 'iset_application'],
    sql: `
      SELECT
        COUNT(*) AS messages,
        SUM(m.sender_user_id IS NOT NULL AND su.id IS NULL) AS missing_sender_user,
        SUM(m.recipient_user_id IS NOT NULL AND ru.id IS NULL) AS missing_recipient_user,
        SUM(m.case_id IS NULL) AS messages_without_case_id,
        SUM(m.application_id IS NULL) AS messages_without_application_id,
        SUM(m.case_id IS NOT NULL AND c.id IS NULL) AS missing_case,
        SUM(m.application_id IS NOT NULL AND a.id IS NULL) AS missing_application
      FROM messages m
      LEFT JOIN \`user\` su ON su.id = m.sender_user_id
      LEFT JOIN \`user\` ru ON ru.id = m.recipient_user_id
      LEFT JOIN iset_case c ON c.id = m.case_id
      LEFT JOIN iset_application a ON a.id = m.application_id
    `,
  });

  if (hasMessageActorColumns) {
    await runCheck(conn, checks, {
      title: 'Message actor-domain counts',
      severity: 'high',
      description: 'Counts typed message actor fields added to separate applicant shared-user actors from staff-profile actors.',
      requires: ['messages', 'user', 'staff_profiles'],
      sql: `
        SELECT
          COUNT(*) AS messages,
          SUM(m.sender_actor_type IS NULL) AS missing_sender_actor_type,
          SUM(m.recipient_actor_type IS NULL) AS missing_recipient_actor_type,
          SUM(m.sender_user_id IS NOT NULL AND su.id IS NULL) AS missing_sender_user,
          SUM(m.recipient_user_id IS NOT NULL AND ru.id IS NULL) AS missing_recipient_user,
          SUM(m.sender_staff_profile_id IS NOT NULL AND ssp.id IS NULL) AS missing_sender_staff_profile,
          SUM(m.recipient_staff_profile_id IS NOT NULL AND rsp.id IS NULL) AS missing_recipient_staff_profile,
          SUM(m.sender_actor_type = 'staff_profile' AND m.sender_staff_profile_id IS NULL) AS staff_sender_missing_staff_profile_id,
          SUM(m.recipient_actor_type = 'staff_profile' AND m.recipient_staff_profile_id IS NULL) AS staff_recipient_missing_staff_profile_id,
          SUM(m.sender_actor_type = 'applicant_user' AND m.sender_user_id IS NULL) AS applicant_sender_missing_user_id,
          SUM(m.recipient_actor_type = 'applicant_user' AND m.recipient_user_id IS NULL) AS applicant_recipient_missing_user_id,
          SUM(m.sender_actor_type = 'local_user') AS sender_local_user_fallback,
          SUM(m.recipient_actor_type = 'local_user') AS recipient_local_user_fallback
        FROM messages m
        LEFT JOIN \`user\` su ON su.id = m.sender_user_id
        LEFT JOIN \`user\` ru ON ru.id = m.recipient_user_id
        LEFT JOIN staff_profiles ssp ON ssp.id = m.sender_staff_profile_id
        LEFT JOIN staff_profiles rsp ON rsp.id = m.recipient_staff_profile_id
      `,
    });
  } else {
    checks.push({
      title: 'Message actor-domain counts',
      severity: 'high',
      description: 'Counts typed message actor fields added to separate applicant shared-user actors from staff-profile actors.',
      skipped: 'Message actor-domain columns are not present.',
      rows: [],
      totalRows: 0,
    });
  }

  await runCheck(conn, checks, {
    title: 'Message case/application mismatch samples',
    severity: 'high',
    description: 'Message rows whose case and application point at inconsistent case/client ownership. IDs only.',
    requires: ['messages', 'iset_case', 'iset_application'],
    sql: `
      SELECT
        m.id AS message_id,
        m.case_id,
        m.application_id,
        c.client_id AS case_client_id,
        a.case_id AS application_case_id,
        a.client_id AS application_client_id
      FROM messages m
      JOIN iset_case c ON c.id = m.case_id
      JOIN iset_application a ON a.id = m.application_id
      WHERE (a.case_id IS NOT NULL AND a.case_id <> m.case_id)
         OR (c.client_id IS NOT NULL AND a.client_id IS NOT NULL AND c.client_id <> a.client_id)
      ORDER BY m.id
      LIMIT 50
    `,
  });

  const caseApplicantUserMatch = (prefix) => `
    (
      COALESCE(m.${prefix}_user_id = s.user_id, 0)
      OR COALESCE(m.${prefix}_user_id = applicant_user_by_sub.id, 0)
      OR COALESCE(m.${prefix}_user_id = applicant_user_by_email.id, 0)
    )
  `;
  const typedCaseApplicantActorMatch = (prefix) => `
    (m.${prefix}_actor_type = 'applicant_user' AND ${caseApplicantUserMatch(prefix)})
  `;
  const typedCaseMessageSideValid = (prefix) => `
    (
      ${typedCaseApplicantActorMatch(prefix)}
      OR (m.${prefix}_actor_type = 'staff_profile' AND ${prefix}_sp.id IS NOT NULL AND ${prefix}_user.id IS NOT NULL)
      OR (
        m.${prefix}_actor_type = 'local_user'
        AND ${prefix}_user.id IS NOT NULL
        AND NOT ${caseApplicantUserMatch(prefix)}
      )
      OR m.${prefix}_actor_type = 'system'
    )
  `;
  const caseMessageParticipantSql = hasMessageActorColumns
    ? `
      SELECT
        COUNT(*) AS case_linked_messages,
        SUM(NOT (${typedCaseApplicantActorMatch('sender')} OR ${typedCaseApplicantActorMatch('recipient')})) AS messages_without_case_applicant_actor,
        SUM(m.sender_actor_type = 'applicant_user' AND NOT ${caseApplicantUserMatch('sender')}) AS sender_applicant_not_case_applicant,
        SUM(m.recipient_actor_type = 'applicant_user' AND NOT ${caseApplicantUserMatch('recipient')}) AS recipient_applicant_not_case_applicant,
        SUM(NOT ${typedCaseMessageSideValid('sender')}) AS sender_actor_not_case_applicant_or_staff,
        SUM(NOT ${typedCaseMessageSideValid('recipient')}) AS recipient_actor_not_case_applicant_or_staff
      FROM messages m
      JOIN iset_case c ON c.id = m.case_id
      LEFT JOIN iset_application a ON a.id = COALESCE(m.application_id, ${casePrimaryApplicationIdSql('c')})
      LEFT JOIN iset_application_submission s ON s.id = a.submission_id
      LEFT JOIN client cl ON cl.id = COALESCE(a.client_id, c.client_id)
      LEFT JOIN staff_profiles sender_sp ON sender_sp.id = m.sender_staff_profile_id
      LEFT JOIN staff_profiles recipient_sp ON recipient_sp.id = m.recipient_staff_profile_id
      LEFT JOIN \`user\` sender_user ON sender_user.id = m.sender_user_id
      LEFT JOIN \`user\` recipient_user ON recipient_user.id = m.recipient_user_id
      LEFT JOIN \`user\` applicant_user_by_sub
        ON CONVERT(applicant_user_by_sub.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
           CONVERT(cl.applicant_cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
      LEFT JOIN \`user\` applicant_user_by_email
        ON LOWER(CONVERT(applicant_user_by_email.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
           LOWER(CONVERT(cl.applicant_account_email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
      WHERE m.case_id IS NOT NULL
    `
    : `
      SELECT
        COUNT(*) AS case_linked_messages,
        SUM(
          NOT (
            m.sender_id = staff_user_by_sub.id
            OR m.sender_id = staff_user_by_email.id
            OR m.sender_id = applicant_user_by_sub.id
            OR m.sender_id = applicant_user_by_email.id
          )
        ) AS sender_not_current_case_candidate,
        SUM(
          NOT (
            m.recipient_id = staff_user_by_sub.id
            OR m.recipient_id = staff_user_by_email.id
            OR m.recipient_id = applicant_user_by_sub.id
            OR m.recipient_id = applicant_user_by_email.id
          )
        ) AS recipient_not_current_case_candidate
      FROM messages m
      JOIN iset_case c ON c.id = m.case_id
      LEFT JOIN iset_application a ON a.id = COALESCE(m.application_id, ${casePrimaryApplicationIdSql('c')})
      LEFT JOIN client cl ON cl.id = COALESCE(a.client_id, c.client_id)
      LEFT JOIN staff_profiles sp ON sp.id = ${caseAssignedStaffJoinExpr}
      LEFT JOIN \`user\` staff_user_by_sub
        ON CONVERT(staff_user_by_sub.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
           CONVERT(sp.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
      LEFT JOIN \`user\` staff_user_by_email
        ON LOWER(CONVERT(staff_user_by_email.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
           LOWER(CONVERT(sp.email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
      LEFT JOIN \`user\` applicant_user_by_sub
        ON CONVERT(applicant_user_by_sub.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
           CONVERT(cl.applicant_cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
      LEFT JOIN \`user\` applicant_user_by_email
        ON LOWER(CONVERT(applicant_user_by_email.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
           LOWER(CONVERT(cl.applicant_account_email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
      WHERE m.case_id IS NOT NULL
    `;

  await runCheck(conn, checks, {
    title: 'Case-scoped message participant anomaly counts',
    severity: 'high',
    description: 'Counts case-linked messages whose applicant actor is not the case applicant, or whose opposite actor is not a resolvable staff/local/system participant.',
    requires: ['messages', 'iset_case', 'iset_application', 'client', 'staff_profiles', 'user'],
    sql: caseMessageParticipantSql,
  });

  const messageItemOwnerNotCanonicalParticipantExpr = hasMessageActorColumns
    ? `SUM(
        m.id IS NOT NULL
        AND NOT (
          COALESCE(mi.owner_user_id = m.sender_user_id, 0)
          OR COALESCE(mi.owner_user_id = m.recipient_user_id, 0)
        )
      )`
    : hasMessageLegacyParticipantColumns
      ? `SUM(
          m.id IS NOT NULL
          AND NOT (
            COALESCE(mi.owner_user_id = m.sender_id, 0)
            OR COALESCE(mi.owner_user_id = m.recipient_id, 0)
          )
        )`
      : 'NULL';
  const messageItemOwnerNotLegacyParticipantExpr = hasMessageLegacyParticipantColumns
    ? `SUM(
        m.id IS NOT NULL
        AND NOT (
          COALESCE(mi.owner_user_id = m.sender_id, 0)
          OR COALESCE(mi.owner_user_id = m.recipient_id, 0)
        )
      )`
    : 'NULL';
  const messageItemSampleLegacyColumns = hasMessageLegacyParticipantColumns
    ? 'm.sender_id, m.recipient_id,'
    : 'NULL AS sender_id, NULL AS recipient_id,';
  const messageItemSampleCanonicalAnomaly = hasMessageActorColumns
    ? `WHEN NOT (
          COALESCE(mi.owner_user_id = m.sender_user_id, 0)
          OR COALESCE(mi.owner_user_id = m.recipient_user_id, 0)
        ) THEN 'owner_not_typed_user_participant'`
    : hasMessageLegacyParticipantColumns
      ? `WHEN NOT (
            COALESCE(mi.owner_user_id = m.sender_id, 0)
            OR COALESCE(mi.owner_user_id = m.recipient_id, 0)
          ) THEN 'owner_not_sender_or_recipient'`
      : '';
  const messageItemSampleWhereParticipantAnomaly = hasMessageActorColumns
    ? `OR (
         m.id IS NOT NULL
         AND NOT (
           COALESCE(mi.owner_user_id = m.sender_user_id, 0)
           OR COALESCE(mi.owner_user_id = m.recipient_user_id, 0)
         )
       )`
    : hasMessageLegacyParticipantColumns
      ? `OR (
           m.id IS NOT NULL
           AND NOT (
             COALESCE(mi.owner_user_id = m.sender_id, 0)
             OR COALESCE(mi.owner_user_id = m.recipient_id, 0)
           )
         )`
      : '';

  await runCheck(conn, checks, {
    title: 'Message item anomaly counts',
    severity: 'high',
    description: 'message_item rows are per-user mailbox state; rows for missing messages or nonparticipants are privacy-risk indicators.',
    requires: ['message_item', 'messages', 'user'],
    sql: `
      SELECT
        COUNT(*) AS message_items,
        SUM(m.id IS NULL) AS message_items_missing_message,
        SUM(u.id IS NULL) AS message_items_missing_owner_user,
        ${messageItemOwnerNotCanonicalParticipantExpr} AS message_items_owner_not_sender_or_recipient,
        ${hasMessageActorColumns ? messageItemOwnerNotCanonicalParticipantExpr : 'NULL'} AS message_items_owner_not_typed_user_participant,
        ${messageItemOwnerNotLegacyParticipantExpr} AS message_items_owner_not_legacy_sender_or_recipient
      FROM message_item mi
      LEFT JOIN messages m ON m.id = mi.message_id
      LEFT JOIN \`user\` u ON u.id = mi.owner_user_id
    `,
  });

  await runCheck(conn, checks, {
    title: 'Message item anomaly samples',
    severity: 'high',
    description: 'Sample message_item rows needing cleanup. IDs only.',
    requires: ['message_item', 'messages', 'user'],
    sql: `
      SELECT
        mi.id AS message_item_id,
        mi.message_id,
        mi.owner_user_id,
        ${messageItemSampleLegacyColumns}
        ${hasMessageActorColumns ? 'm.sender_user_id, m.recipient_user_id,' : ''}
        CASE
          WHEN m.id IS NULL THEN 'missing_message'
          WHEN u.id IS NULL THEN 'missing_owner_user'
          ${messageItemSampleCanonicalAnomaly}
          ELSE 'ok'
        END AS anomaly
      FROM message_item mi
      LEFT JOIN messages m ON m.id = mi.message_id
      LEFT JOIN \`user\` u ON u.id = mi.owner_user_id
      WHERE m.id IS NULL
         OR u.id IS NULL
         ${messageItemSampleWhereParticipantAnomaly}
      ORDER BY mi.id
      LIMIT 50
    `,
  });

  await runCheck(conn, checks, {
    title: 'Message attachment scope counts',
    severity: 'high',
    description: 'Attachment rows missing case/application scope or conflicting with their parent message.',
    requires: ['message_attachment', 'messages', 'user', 'iset_case', 'iset_application', 'client'],
    sql: `
      SELECT
        COUNT(*) AS message_attachments,
        COALESCE(SUM(ma.case_id IS NULL), 0) AS attachments_without_case_id,
        ${hasMessageAttachmentClientId ? 'COALESCE(SUM(ma.client_id IS NULL), 0)' : 'NULL'} AS attachments_without_client_id,
        COALESCE(SUM(ma.application_id IS NULL), 0) AS attachments_without_application_id,
        COALESCE(SUM(u.id IS NULL), 0) AS attachments_missing_user,
        COALESCE(SUM(ma.case_id IS NOT NULL AND c.id IS NULL), 0) AS attachments_missing_case,
        ${hasMessageAttachmentClientId ? 'COALESCE(SUM(ma.client_id IS NOT NULL AND cl.id IS NULL), 0)' : 'NULL'} AS attachments_missing_client,
        COALESCE(SUM(ma.application_id IS NOT NULL AND a.id IS NULL), 0) AS attachments_missing_application,
        COALESCE(SUM(m.id IS NOT NULL AND ma.case_id IS NOT NULL AND m.case_id IS NOT NULL AND ma.case_id <> m.case_id), 0) AS attachment_case_mismatch_message_case,
        ${hasMessageAttachmentClientId ? 'COALESCE(SUM(ma.client_id IS NOT NULL AND c.client_id IS NOT NULL AND ma.client_id <> c.client_id), 0)' : 'NULL'} AS attachment_client_mismatch_case_client,
        ${hasMessageAttachmentClientId ? 'COALESCE(SUM(ma.client_id IS NOT NULL AND a.client_id IS NOT NULL AND ma.client_id <> a.client_id), 0)' : 'NULL'} AS attachment_client_mismatch_application_client,
        COALESCE(SUM(m.id IS NOT NULL AND ma.application_id IS NOT NULL AND m.application_id IS NOT NULL AND ma.application_id <> m.application_id), 0) AS attachment_application_mismatch_message_application
      FROM message_attachment ma
      LEFT JOIN messages m ON m.id = ma.message_id
      LEFT JOIN \`user\` u ON u.id = ma.user_id
      LEFT JOIN iset_case c ON c.id = ma.case_id
      LEFT JOIN iset_application a ON a.id = ma.application_id
      ${hasMessageAttachmentClientId ? 'LEFT JOIN client cl ON cl.id = ma.client_id' : ''}
    `,
  });

  await runCheck(conn, checks, {
    title: 'Signing request scope counts',
    severity: 'high',
    description: 'Signing requests are participant-facing private forms; these counts expose missing targets, wrong applicant linkage, and message/case mismatches.',
    requires: ['signing_request', 'message_signing_request', 'messages', 'workflow', 'user', 'iset_case', 'iset_application', 'iset_application_submission', 'client'],
    sql: `
      SELECT
        COUNT(*) AS signing_requests,
        COALESCE(SUM(w.id IS NULL), 0) AS missing_workflow,
        COALESCE(SUM(c.id IS NULL), 0) AS missing_case,
        COALESCE(SUM(participant_user.id IS NULL), 0) AS missing_participant_user,
        COALESCE(SUM(creator_user.id IS NULL), 0) AS missing_creator_user,
        COALESCE(SUM(msr.signing_request_id IS NULL), 0) AS missing_message_link,
        COALESCE(SUM(m.id IS NOT NULL AND m.case_id <> sr.case_id), 0) AS message_case_mismatch,
        COALESCE(SUM(
          NOT (
            COALESCE(sr.participant_user_id = s.user_id, 0)
            OR COALESCE(sr.participant_user_id = applicant_user_by_sub.id, 0)
            OR COALESCE(sr.participant_user_id = applicant_user_by_email.id, 0)
          )
        ), 0) AS participant_not_case_applicant
      FROM signing_request sr
      LEFT JOIN workflow w ON w.id = sr.workflow_id
      LEFT JOIN iset_case c ON c.id = sr.case_id
      LEFT JOIN iset_application a ON a.id = ${casePrimaryApplicationIdSql('c')}
      LEFT JOIN iset_application_submission s ON s.id = a.submission_id
      LEFT JOIN client cl ON cl.id = COALESCE(a.client_id, c.client_id)
      LEFT JOIN \`user\` participant_user ON participant_user.id = sr.participant_user_id
      LEFT JOIN \`user\` creator_user ON creator_user.id = sr.created_by_user_id
      LEFT JOIN message_signing_request msr ON msr.signing_request_id = sr.id
      LEFT JOIN messages m ON m.id = msr.message_id
      LEFT JOIN \`user\` applicant_user_by_sub
        ON CONVERT(applicant_user_by_sub.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
           CONVERT(cl.applicant_cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
      LEFT JOIN \`user\` applicant_user_by_email
        ON LOWER(CONVERT(applicant_user_by_email.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
           LOWER(CONVERT(cl.applicant_account_email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
    `,
  });

  await runCheck(conn, checks, {
    title: 'Escalation scope and actor counts',
    severity: 'high',
    description: 'Application escalations drive private work routing; these counts expose missing application/case/user targets and staff-profile/user domain collisions.',
    requires: ['iset_application_escalation', 'iset_application', 'iset_case', 'user', 'staff_profiles'],
    sql: `
      SELECT
        COUNT(*) AS escalations,
        COALESCE(SUM(a.id IS NULL), 0) AS missing_application,
        COALESCE(SUM(c.id IS NULL), 0) AS missing_case,
        COALESCE(SUM(requester_user.id IS NULL), 0) AS missing_requester_user,
        COALESCE(SUM(e.current_owner_user_id IS NOT NULL AND owner_user.id IS NULL), 0) AS missing_current_owner_user,
        COALESCE(SUM(e.resolved_by_user_id IS NOT NULL AND resolver_user.id IS NULL), 0) AS missing_resolver_user,
        COALESCE(SUM(requester_sp.id IS NOT NULL), 0) AS requester_user_id_matches_staff_profile,
        COALESCE(SUM(e.current_owner_user_id IS NOT NULL AND owner_sp.id IS NOT NULL), 0) AS owner_user_id_matches_staff_profile,
        COALESCE(SUM(e.resolved_by_user_id IS NOT NULL AND resolver_sp.id IS NOT NULL), 0) AS resolver_user_id_matches_staff_profile
      FROM iset_application_escalation e
      LEFT JOIN iset_application a ON a.id = e.application_id
      LEFT JOIN iset_case c ON c.id = e.case_id
      LEFT JOIN \`user\` requester_user ON requester_user.id = e.requester_user_id
      LEFT JOIN \`user\` owner_user ON owner_user.id = e.current_owner_user_id
      LEFT JOIN \`user\` resolver_user ON resolver_user.id = e.resolved_by_user_id
      LEFT JOIN staff_profiles requester_sp ON requester_sp.id = e.requester_user_id
      LEFT JOIN staff_profiles owner_sp ON owner_sp.id = e.current_owner_user_id
      LEFT JOIN staff_profiles resolver_sp ON resolver_sp.id = e.resolved_by_user_id
    `,
  });

  await runCheck(conn, checks, {
    title: 'Case task scope and actor counts',
    severity: 'high',
    description: 'Case tasks are case-scoped private work items; these counts expose missing case/user/staff-profile targets and user/staff-profile domain collisions.',
    requires: ['iset_case_task', 'iset_case', 'user', 'staff_profiles'],
    sql: `
      SELECT
        COUNT(*) AS case_tasks,
        COALESCE(SUM(c.id IS NULL), 0) AS missing_case,
        COALESCE(SUM(t.assigned_to_user_id IS NOT NULL AND assignee_user.id IS NULL), 0) AS missing_assignee_user,
        COALESCE(SUM(t.created_by_user_id IS NOT NULL AND created_user.id IS NULL), 0) AS missing_created_user,
        COALESCE(SUM(t.updated_by_user_id IS NOT NULL AND updated_user.id IS NULL), 0) AS missing_updated_user,
        COALESCE(SUM(t.assigned_to_staff_profile_id IS NOT NULL AND assignee_sp.id IS NULL), 0) AS missing_assignee_staff_profile,
        COALESCE(SUM(t.created_by_staff_profile_id IS NOT NULL AND created_sp.id IS NULL), 0) AS missing_created_staff_profile,
        COALESCE(SUM(t.updated_by_staff_profile_id IS NOT NULL AND updated_sp.id IS NULL), 0) AS missing_updated_staff_profile,
        COALESCE(SUM(t.created_by_user_id IS NOT NULL AND created_user_sp.id IS NOT NULL), 0) AS created_user_id_matches_staff_profile,
        COALESCE(SUM(t.updated_by_user_id IS NOT NULL AND updated_user_sp.id IS NOT NULL), 0) AS updated_user_id_matches_staff_profile
      FROM iset_case_task t
      LEFT JOIN iset_case c ON c.id = t.case_id
      LEFT JOIN \`user\` assignee_user ON assignee_user.id = t.assigned_to_user_id
      LEFT JOIN \`user\` created_user ON created_user.id = t.created_by_user_id
      LEFT JOIN \`user\` updated_user ON updated_user.id = t.updated_by_user_id
      LEFT JOIN staff_profiles assignee_sp ON assignee_sp.id = t.assigned_to_staff_profile_id
      LEFT JOIN staff_profiles created_sp ON created_sp.id = t.created_by_staff_profile_id
      LEFT JOIN staff_profiles updated_sp ON updated_sp.id = t.updated_by_staff_profile_id
      LEFT JOIN staff_profiles created_user_sp ON created_user_sp.id = t.created_by_user_id
      LEFT JOIN staff_profiles updated_user_sp ON updated_user_sp.id = t.updated_by_user_id
    `,
  });

  await runCheck(conn, checks, {
    title: 'Internal notification audience and viewer identity counts',
    severity: 'high',
    description: 'Internal bell alerts should target typed staff-profile or applicant-user subjects. Legacy audience_user_id/user_id columns are compatibility shadows only where still present.',
    requires: ['iset_internal_notification', 'iset_internal_notification_dismissal', 'staff_profiles', 'user'],
    sql: hasInternalNotificationTypedAudience
      ? `
      SELECT
        (SELECT COUNT(*) FROM iset_internal_notification) AS notifications,
        (SELECT COUNT(*) FROM iset_internal_notification WHERE audience_type = 'user') AS user_audience_notifications,
        (SELECT COUNT(*) FROM iset_internal_notification WHERE audience_type = 'user' AND audience_actor_type = 'staff_profile') AS staff_profile_audience_notifications,
        (SELECT COUNT(*) FROM iset_internal_notification WHERE audience_type = 'user' AND audience_actor_type = 'applicant_user') AS applicant_user_audience_notifications,
        (SELECT COUNT(*)
           FROM iset_internal_notification n
           LEFT JOIN staff_profiles sp ON sp.id = n.audience_staff_profile_id
          WHERE n.audience_actor_type = 'staff_profile'
            AND sp.id IS NULL) AS missing_audience_staff_profile,
        (SELECT COUNT(*)
           FROM iset_internal_notification n
           LEFT JOIN \`user\` u ON u.id = n.audience_applicant_user_id
          WHERE n.audience_actor_type = 'applicant_user'
            AND u.id IS NULL) AS missing_audience_applicant_user,
        ${hasInternalNotificationAudienceShadow
          ? `(SELECT COUNT(*)
           FROM iset_internal_notification n
          WHERE n.audience_type = 'user'
            AND (
              (n.audience_actor_type = 'staff_profile' AND n.audience_user_id <> n.audience_staff_profile_id)
              OR (n.audience_actor_type = 'applicant_user' AND n.audience_user_id <> n.audience_applicant_user_id)
              OR n.audience_actor_type IS NULL
            ))`
          : '0'} AS legacy_audience_shadow_mismatches,
        (SELECT COUNT(*) FROM iset_internal_notification_dismissal) AS dismissals,
        (SELECT COUNT(*) FROM iset_internal_notification_dismissal WHERE viewer_actor_type = 'staff_profile') AS staff_profile_dismissals,
        (SELECT COUNT(*) FROM iset_internal_notification_dismissal WHERE viewer_actor_type = 'applicant_user') AS applicant_user_dismissals,
        (SELECT COUNT(*)
           FROM iset_internal_notification_dismissal d
           LEFT JOIN staff_profiles sp ON sp.id = d.viewer_staff_profile_id
          WHERE d.viewer_actor_type = 'staff_profile'
            AND sp.id IS NULL) AS missing_viewer_staff_profile,
        (SELECT COUNT(*)
           FROM iset_internal_notification_dismissal d
           LEFT JOIN \`user\` u ON u.id = d.viewer_applicant_user_id
          WHERE d.viewer_actor_type = 'applicant_user'
            AND u.id IS NULL) AS missing_viewer_applicant_user,
        ${hasInternalNotificationDismissalShadow
          ? `(SELECT COUNT(*)
           FROM iset_internal_notification_dismissal d
          WHERE (d.viewer_actor_type = 'staff_profile' AND d.user_id <> d.viewer_staff_profile_id)
             OR (d.viewer_actor_type = 'applicant_user' AND d.user_id <> d.viewer_applicant_user_id)
             OR d.viewer_actor_type IS NULL)`
          : '0'} AS legacy_dismissal_shadow_mismatches
    `
      : `
      SELECT
        (SELECT COUNT(*) FROM iset_internal_notification) AS notifications,
        (SELECT COUNT(*) FROM iset_internal_notification WHERE audience_type = 'user') AS user_audience_notifications,
        (SELECT COUNT(*)
           FROM iset_internal_notification n
           JOIN staff_profiles sp ON sp.id = n.audience_user_id
          WHERE n.audience_type = 'user') AS legacy_user_audiences_matching_staff_profile,
        (SELECT COUNT(*)
           FROM iset_internal_notification n
           JOIN \`user\` u ON u.id = n.audience_user_id
          WHERE n.audience_type = 'user') AS legacy_user_audiences_matching_shared_user,
        (SELECT COUNT(*)
           FROM iset_internal_notification n
           LEFT JOIN staff_profiles sp ON sp.id = n.audience_user_id
           LEFT JOIN \`user\` u ON u.id = n.audience_user_id
          WHERE n.audience_type = 'user'
            AND sp.id IS NULL
            AND u.id IS NULL) AS legacy_user_audiences_matching_neither,
        (SELECT COUNT(*) FROM iset_internal_notification_dismissal) AS dismissals,
        (SELECT COUNT(*)
           FROM iset_internal_notification_dismissal d
           JOIN staff_profiles sp ON sp.id = d.user_id) AS legacy_dismissals_matching_staff_profile,
        (SELECT COUNT(*)
           FROM iset_internal_notification_dismissal d
           JOIN \`user\` u ON u.id = d.user_id) AS legacy_dismissals_matching_shared_user,
        (SELECT COUNT(*)
           FROM iset_internal_notification_dismissal d
           LEFT JOIN staff_profiles sp ON sp.id = d.user_id
           LEFT JOIN \`user\` u ON u.id = d.user_id
          WHERE sp.id IS NULL
            AND u.id IS NULL) AS legacy_dismissals_matching_neither
    `,
  });

  await runCheck(conn, checks, {
    title: 'Pending upload user ownership counts',
    severity: 'high',
    description: 'Pending upload rows are temporary applicant-owned private upload tokens and should remain constrained to shared user(id).',
    requires: ['pending_uploads', 'user'],
    sql: `
      SELECT
        COUNT(*) AS pending_uploads,
        COALESCE(SUM(u.id IS NULL), 0) AS missing_user,
        COALESCE(SUM(p.expires_at <= NOW()), 0) AS expired_rows
      FROM pending_uploads p
      LEFT JOIN \`user\` u ON u.id = p.user_id
    `,
  });

  if (await tableExists(conn, 'iset_event_entry')) {
    if (hasEventEntryTypedActorRefs) {
      await runCheck(conn, checks, {
        title: 'Event entry typed actor reference counts',
        severity: 'medium',
        description: 'Event actors are typed as staff-profile, applicant-user, or unresolved legacy/system actors. Unresolved staff actors should not be used for authorization.',
        requires: ['iset_event_entry', 'staff_profiles', 'user'],
        sql: `
          SELECT
            actor_type,
            COUNT(*) AS rows_total,
            COALESCE(SUM(actor_staff_profile_id IS NOT NULL), 0) AS typed_staff_profile_refs,
            COALESCE(SUM(actor_applicant_user_id IS NOT NULL), 0) AS typed_applicant_user_refs,
            COALESCE(SUM(actor_type = 'staff' AND actor_staff_profile_id IS NULL), 0) AS unresolved_staff_actor_refs,
            COALESCE(SUM(actor_type = 'applicant' AND actor_applicant_user_id IS NULL), 0) AS unresolved_applicant_actor_refs,
            COALESCE(SUM(actor_type = 'staff' AND actor_id REGEXP '^[0-9]+$'), 0) AS legacy_numeric_staff_actor_ids,
            COALESCE(SUM(actor_type = 'staff' AND actor_id IS NOT NULL AND actor_id NOT REGEXP '^[0-9]+$'), 0) AS staff_actor_subject_ids,
            COALESCE(SUM(actor_type = 'applicant' AND actor_id REGEXP '^[0-9]+$'), 0) AS applicant_numeric_actor_ids
          FROM iset_event_entry
          GROUP BY actor_type
          ORDER BY actor_type
        `,
      });

      await runCheck(conn, checks, {
        title: 'Event entry unresolved actor samples by type',
        severity: 'medium',
        description: 'Aggregated event types still lacking typed actor references, without names or payload content.',
        requires: ['iset_event_entry'],
        sql: `
          SELECT
            event_type,
            actor_type,
            actor_id REGEXP '^[0-9]+$' AS actor_id_is_numeric,
            COUNT(*) AS rows_total
          FROM iset_event_entry
          WHERE (actor_type = 'staff' AND actor_staff_profile_id IS NULL)
             OR (actor_type = 'applicant' AND actor_applicant_user_id IS NULL)
          GROUP BY event_type, actor_type, actor_id_is_numeric
          ORDER BY rows_total DESC, event_type
        `,
      });
    } else {
      checks.push({
        title: 'Event entry typed actor reference counts',
        severity: 'medium',
        description: 'Event actor typed-reference columns are not present in this database yet.',
        rows: [{ status: 'typed actor columns missing' }],
        totalRows: 1,
      });
    }
  }

  if (await tableExists(conn, 'iset_event_receipt')) {
    if (hasEventReceiptTypedViewerRefs) {
      await runCheck(conn, checks, {
        title: 'Event receipt typed viewer counts',
        severity: 'medium',
        description: 'Event read receipts now keep typed viewer references. Legacy recipient_id is a compatibility shadow only where still present and must not be treated as a shared user-table FK.',
        requires: ['iset_event_receipt', 'staff_profiles', 'user'],
        sql: `
          SELECT
            COUNT(*) AS receipts,
            COALESCE(SUM(viewer_staff_profile_id IS NOT NULL), 0) AS staff_profile_viewer_refs,
            COALESCE(SUM(viewer_applicant_user_id IS NOT NULL), 0) AS applicant_user_viewer_refs,
            ${hasEventReceiptLegacyRecipientId
              ? 'COALESCE(SUM(recipient_id IS NOT NULL), 0)'
              : '0'} AS legacy_recipient_id_values,
            COALESCE(SUM(viewer_staff_profile_id IS NULL AND viewer_applicant_user_id IS NULL), 0) AS unresolved_legacy_viewer_values,
            COALESCE(SUM(viewer_staff_profile_id IS NOT NULL AND sp.id IS NULL), 0) AS missing_staff_profile_viewer,
            COALESCE(SUM(viewer_applicant_user_id IS NOT NULL AND u.id IS NULL), 0) AS missing_applicant_user_viewer
          FROM iset_event_receipt r
          LEFT JOIN staff_profiles sp ON sp.id = r.viewer_staff_profile_id
          LEFT JOIN \`user\` u ON u.id = r.viewer_applicant_user_id
        `,
      });
    } else {
      checks.push({
        title: 'Event receipt typed viewer counts',
        severity: 'medium',
        description: 'Event receipt typed-viewer columns are not present in this database yet.',
        rows: [{ status: 'typed viewer columns missing' }],
        totalRows: 1,
      });
    }
  }

  await runCheck(conn, checks, {
    title: 'Opaque actor identifier inventory',
    severity: 'medium',
    description: 'Known opaque identifiers that are intentionally not shared user(id) FKs without a separate redesign.',
    requires: ['application_lock', 'iset_event_receipt', 'user_session_audit', 'user'],
    sql: `
      SELECT
        'application_lock' AS table_name,
        'owner_user_id' AS column_name,
        'opaque lock owner principal, normally Cognito subject/auth actor' AS classification,
        COUNT(*) AS rows_total,
        COALESCE(SUM(owner_user_id REGEXP '^[0-9]+$'), 0) AS numeric_values,
        COALESCE(SUM(owner_user_id NOT REGEXP '^[0-9]+$'), 0) AS nonnumeric_values,
        (SELECT COUNT(*)
           FROM application_lock al
           JOIN \`user\` u ON CAST(al.owner_user_id AS UNSIGNED) = u.id
          WHERE al.owner_user_id REGEXP '^[0-9]+$') AS numeric_values_matching_shared_user
      FROM application_lock
      UNION ALL
      ${hasEventReceiptLegacyRecipientId
        ? `SELECT
        'iset_event_receipt' AS table_name,
        'recipient_id' AS column_name,
        'legacy event read-state principal shadow, typed viewer columns are canonical when present' AS classification,
        COUNT(*) AS rows_total,
        COALESCE(SUM(recipient_id REGEXP '^[0-9]+$'), 0) AS numeric_values,
        COALESCE(SUM(recipient_id NOT REGEXP '^[0-9]+$'), 0) AS nonnumeric_values,
        (SELECT COUNT(*)
           FROM iset_event_receipt er
           JOIN \`user\` u ON CAST(er.recipient_id AS UNSIGNED) = u.id
          WHERE er.recipient_id REGEXP '^[0-9]+$') AS numeric_values_matching_shared_user
      FROM iset_event_receipt`
        : `SELECT
        'iset_event_receipt' AS table_name,
        'recipient_id' AS column_name,
        'legacy event read-state principal shadow (physically retired in this schema)' AS classification,
        COUNT(*) AS rows_total,
        0 AS numeric_values,
        0 AS nonnumeric_values,
        0 AS numeric_values_matching_shared_user
      FROM iset_event_receipt`}
      UNION ALL
      SELECT
        'user_session_audit' AS table_name,
        'user_id' AS column_name,
        'session-audit auth principal, usually Cognito subject/session identity' AS classification,
        COUNT(*) AS rows_total,
        COALESCE(SUM(user_id REGEXP '^[0-9]+$'), 0) AS numeric_values,
        COALESCE(SUM(user_id NOT REGEXP '^[0-9]+$'), 0) AS nonnumeric_values,
        (SELECT COUNT(*)
           FROM user_session_audit usa
           JOIN \`user\` u ON CAST(usa.user_id AS UNSIGNED) = u.id
          WHERE usa.user_id REGEXP '^[0-9]+$') AS numeric_values_matching_shared_user
      FROM user_session_audit
    `,
  });

  await runCheck(conn, checks, {
    title: 'Document scope counts by source',
    severity: 'high',
    description: 'Documents missing client, case, application, or applicant-user scope by source.',
    requires: ['iset_document'],
    sql: `
      SELECT
        source,
        COUNT(*) AS documents,
        SUM(client_id IS NULL) AS missing_client_id,
        SUM(case_id IS NULL) AS missing_case_id,
        SUM(application_id IS NULL) AS missing_application_id,
        SUM(applicant_user_id IS NULL) AS missing_applicant_user_id,
        SUM(origin_message_id IS NULL) AS missing_origin_message_id
      FROM iset_document
      GROUP BY source
      ORDER BY source
    `,
  });

  await runCheck(conn, checks, {
    title: 'Document source-specific constraint violation counts',
    severity: 'high',
    description: 'Counts document rows that would violate the current source-specific privacy lineage rules.',
    requires: ['iset_document'],
    sql: `
      SELECT
        COUNT(*) AS documents,
        SUM(source = 'application_submission' AND (
          client_id IS NULL OR case_id IS NULL OR application_id IS NULL OR applicant_user_id IS NULL
        )) AS application_submission_scope_violations,
        SUM(source = 'manual_upload' AND (
          client_id IS NULL OR case_id IS NULL OR (application_id IS NOT NULL AND applicant_user_id IS NULL)
        )) AS manual_upload_scope_violations,
        SUM(source = 'secure_message_attachment' AND (
          client_id IS NULL OR case_id IS NULL OR applicant_user_id IS NULL OR user_id IS NULL OR origin_message_id IS NULL
        )) AS secure_message_attachment_scope_violations,
        SUM(source = 'system_generated' AND (
          client_id IS NULL OR case_id IS NULL OR (application_id IS NOT NULL AND applicant_user_id IS NULL)
        )) AS system_generated_scope_violations
      FROM iset_document
    `,
  });

  await runCheck(conn, checks, {
    title: 'Document referential counts',
    severity: 'high',
    description: 'Counts document relationship fields whose referenced rows are absent.',
    requires: ['iset_document', 'user', 'client', 'iset_case', 'iset_application', 'messages', 'iset_case_action_plan', 'iset_case_task'],
    sql: `
      SELECT
        COUNT(*) AS documents,
        SUM(d.user_id IS NOT NULL AND u.id IS NULL) AS missing_user,
        SUM(d.applicant_user_id IS NOT NULL AND au.id IS NULL) AS missing_applicant_user,
        SUM(d.client_id IS NOT NULL AND cl.id IS NULL) AS missing_client,
        SUM(d.case_id IS NOT NULL AND c.id IS NULL) AS missing_case,
        SUM(d.application_id IS NOT NULL AND a.id IS NULL) AS missing_application,
        SUM(d.origin_message_id IS NOT NULL AND m.id IS NULL) AS missing_origin_message,
        SUM(d.action_plan_id IS NOT NULL AND ap.id IS NULL) AS missing_action_plan,
        SUM(d.linked_task_id IS NOT NULL AND t.id IS NULL) AS missing_linked_task
      FROM iset_document d
      LEFT JOIN \`user\` u ON u.id = d.user_id
      LEFT JOIN \`user\` au ON au.id = d.applicant_user_id
      LEFT JOIN client cl ON cl.id = d.client_id
      LEFT JOIN iset_case c ON c.id = d.case_id
      LEFT JOIN iset_application a ON a.id = d.application_id
      LEFT JOIN messages m ON m.id = d.origin_message_id
      LEFT JOIN iset_case_action_plan ap ON ap.id = d.action_plan_id
      LEFT JOIN iset_case_task t ON t.id = d.linked_task_id
    `,
  });

  await runCheck(conn, checks, {
    title: 'Document scope mismatch samples',
    severity: 'high',
    description: 'Sample documents whose application, case, client, or origin message scopes disagree. IDs only.',
    requires: ['iset_document', 'iset_case', 'iset_application', 'messages'],
    sql: `
      SELECT
        d.id AS document_id,
        d.client_id,
        d.case_id,
        d.application_id,
        a.case_id AS application_case_id,
        a.client_id AS application_client_id,
        c.client_id AS case_client_id,
        d.origin_message_id,
        m.case_id AS message_case_id,
        m.application_id AS message_application_id
      FROM iset_document d
      LEFT JOIN iset_case c ON c.id = d.case_id
      LEFT JOIN iset_application a ON a.id = d.application_id
      LEFT JOIN messages m ON m.id = d.origin_message_id
      WHERE (d.case_id IS NOT NULL AND d.application_id IS NOT NULL AND a.case_id IS NOT NULL AND a.case_id <> d.case_id)
         OR (d.client_id IS NOT NULL AND d.application_id IS NOT NULL AND a.client_id IS NOT NULL AND a.client_id <> d.client_id)
         OR (d.client_id IS NOT NULL AND d.case_id IS NOT NULL AND c.client_id IS NOT NULL AND c.client_id <> d.client_id)
         OR (d.origin_message_id IS NOT NULL AND d.case_id IS NOT NULL AND m.case_id IS NOT NULL AND m.case_id <> d.case_id)
         OR (d.origin_message_id IS NOT NULL AND d.application_id IS NOT NULL AND m.application_id IS NOT NULL AND m.application_id <> d.application_id)
      ORDER BY d.id
      LIMIT 50
    `,
  });

  await runCheck(conn, checks, {
    title: 'Case/application relationship counts',
    severity: 'medium',
    description: 'Counts current hybrid case/application links against the target one-client -> one-case -> many-applications model.',
    requires: ['iset_case', 'iset_application'],
    sql: `
      SELECT
        (SELECT COUNT(*) FROM iset_application) AS applications,
        (SELECT SUM(client_id IS NULL) FROM iset_application) AS applications_missing_client_id,
        (SELECT SUM(case_id IS NULL) FROM iset_application) AS applications_missing_case_id,
        (SELECT COUNT(*)
           FROM iset_application a
           JOIN iset_case c ON c.id = a.case_id
          WHERE c.client_id IS NULL) AS applications_missing_case_client_id,
        (SELECT COUNT(*)
           FROM iset_application a
           JOIN iset_case c ON c.id = a.case_id
          WHERE a.client_id IS NOT NULL
            AND c.client_id IS NOT NULL
            AND a.client_id <> c.client_id) AS application_case_client_mismatches,
        (SELECT COUNT(*) FROM iset_case) AS cases,
        (SELECT SUM(client_id IS NULL) FROM iset_case) AS cases_missing_client_id,
        ${hasCaseLegacyApplicationId
          ? '(SELECT SUM(application_id IS NOT NULL) FROM iset_case)'
          : '0'} AS cases_with_application_id,
        ${hasCaseLegacyApplicationId
          ? `(SELECT COUNT(*)
               FROM iset_application a
               JOIN iset_case c ON c.id = a.case_id
              WHERE c.application_id IS NOT NULL AND c.application_id <> a.id)`
          : '0'} AS application_case_bidirectional_mismatches,
        (SELECT COUNT(*)
           FROM (SELECT case_id FROM iset_application WHERE case_id IS NOT NULL GROUP BY case_id HAVING COUNT(*) > 1) x) AS cases_with_multiple_applications
    `,
  });

  await runCheck(conn, checks, {
    title: 'Case/application mismatch samples',
    severity: 'medium',
    description: 'Sample rows where case/application ownership links are missing or disagree. IDs only.',
    requires: ['iset_case', 'iset_application'],
    sql: `
      SELECT
        a.id AS application_id,
        a.case_id AS application_case_id,
        a.client_id AS application_client_id,
        ${hasCaseLegacyApplicationId ? 'c.application_id' : 'NULL'} AS case_application_id,
        c.client_id AS case_client_id
      FROM iset_application a
      JOIN iset_case c ON c.id = a.case_id
      WHERE c.client_id IS NULL
         OR ${hasCaseLegacyApplicationId
        ? '(c.application_id IS NOT NULL AND c.application_id <> a.id) OR '
        : ''}(a.client_id IS NOT NULL AND c.client_id IS NOT NULL AND a.client_id <> c.client_id)
      ORDER BY a.id
      LIMIT 50
    `,
  });

  return checks;
}

function renderReport({ dbName, generatedAt, checks, maxRows }) {
  const lines = [];
  lines.push('# Privacy ERM Audit Report');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Database: \`${dbName}\``);
  lines.push('');
  lines.push('This report is read-only and intentionally avoids names, emails, message bodies, and file paths.');
  lines.push('');
  lines.push('## Checks');
  lines.push('');

  for (const check of checks) {
    lines.push(`### ${check.title}`);
    lines.push('');
    lines.push(`Severity: \`${check.severity}\``);
    if (check.description) {
      lines.push('');
      lines.push(check.description);
    }
    if (check.skipped) {
      lines.push('');
      lines.push(`Skipped: ${check.skipped}`);
      lines.push('');
      continue;
    }
    if (check.error) {
      lines.push('');
      lines.push(`Error: ${check.error}`);
      lines.push('');
      continue;
    }
    lines.push('');
    if (check.rows.length > maxRows) {
      lines.push(`Showing ${maxRows} of ${check.rows.length} rows.`);
      lines.push('');
    }
    lines.push(markdownTable(truncateRows(check.rows, maxRows)));
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const dbConfig = getDbConfig();
  if (!dbConfig.database) {
    throw new Error('DB_NAME is not set. Load .env or set DB_NAME before running the audit.');
  }

  const conn = await mysql.createConnection(dbConfig);
  try {
    const checks = await buildChecks(conn);
    const generatedAt = new Date().toISOString();
    const report = renderReport({
      dbName: dbConfig.database,
      generatedAt,
      checks,
      maxRows: args.maxRows,
    });

    if (args.out) {
      const outPath = path.resolve(args.out);
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
      await fs.promises.writeFile(outPath, report, 'utf8');
      console.log(`Privacy ERM audit written to ${outPath}`);
    } else {
      console.log(report);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Privacy ERM audit failed:', err.message || err);
  process.exitCode = 1;
});
