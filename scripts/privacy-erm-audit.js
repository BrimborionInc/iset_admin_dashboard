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
  'staff_message',
  'staff_message_item',
  'staff_message_thread',
  'staff_message_thread_participant',
  'contact_message',
  'jordan_application',
  'jordan_application_draft',
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
    'application_id',
    'version',
    'payload_json',
    'change_summary',
    'created_by_id',
    'created_by_name',
    'restored_from_version',
    'case_id',
    'version_number',
    'source_type',
    'is_current',
    'previous_payload_json',
  ];

  const [columns] = await conn.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'iset_application_version'`
  );
  const present = new Set(columns.map((row) => row.column_name || row.COLUMN_NAME));
  return expected.map((columnName) => ({
    table_name: 'iset_application_version',
    column_name: columnName,
    status: present.has(columnName) ? 'present' : 'missing',
  }));
}

async function buildChecks(conn) {
  const checks = [];
  const hasCaseAssignedStaffProfileId = await columnExists(conn, 'iset_case', 'assigned_staff_profile_id');
  const hasMessageActorColumns = await columnExists(conn, 'messages', 'sender_actor_type')
    && await columnExists(conn, 'messages', 'recipient_actor_type')
    && await columnExists(conn, 'messages', 'sender_user_id')
    && await columnExists(conn, 'messages', 'recipient_user_id')
    && await columnExists(conn, 'messages', 'sender_staff_profile_id')
    && await columnExists(conn, 'messages', 'recipient_staff_profile_id');
  const hasMessageAttachmentClientId = await columnExists(conn, 'message_attachment', 'client_id');
  const caseAssignedStaffJoinExpr = hasCaseAssignedStaffProfileId
    ? 'COALESCE(c.assigned_staff_profile_id, c.assigned_to_user_id)'
    : 'c.assigned_to_user_id';
  const caseAssignmentDomainSql = hasCaseAssignedStaffProfileId
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
    description: 'Delete rules for scope-preserving message, document, signing-request, escalation, and task relationships. SET NULL here can silently detach private records from their case/client/applicant context.',
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
         )
       ORDER BY table_name, constraint_name
    `,
  });

  await runCheck(conn, checks, {
    title: 'Message/document privacy CHECK constraints',
    severity: 'high',
    description: 'CHECK constraints that prevent unscoped secure messages, ambiguous message actors, and privacy-sensitive documents without required lineage.',
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
           'chk_iset_document_system_generated_scope'
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
    description: 'Relationship-looking columns with no FK. This is an inventory, not proof every column needs a constraint.',
    sql: `
      SELECT
        c.table_name,
        c.column_name,
        c.column_type,
        c.is_nullable,
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
    description: 'Columns that read like shared user IDs, sender/recipient IDs, or owner user IDs but are not constrained to user(id).',
    sql: `
      SELECT
        c.table_name,
        c.column_name,
        c.column_type,
        COALESCE(MAX(k.referenced_table_name), '') AS referenced_table,
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
        SUM(su.id IS NULL) AS missing_sender_user,
        SUM(ru.id IS NULL) AS missing_recipient_user,
        SUM(m.case_id IS NULL) AS messages_without_case_id,
        SUM(m.application_id IS NULL) AS messages_without_application_id,
        SUM(m.case_id IS NOT NULL AND c.id IS NULL) AS missing_case,
        SUM(m.application_id IS NOT NULL AND a.id IS NULL) AS missing_application
      FROM messages m
      LEFT JOIN \`user\` su ON su.id = m.sender_id
      LEFT JOIN \`user\` ru ON ru.id = m.recipient_id
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
      LEFT JOIN iset_application a ON a.id = COALESCE(m.application_id, c.application_id)
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
      LEFT JOIN iset_application a ON a.id = COALESCE(m.application_id, c.application_id)
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
        SUM(
          m.id IS NOT NULL
          AND NOT (
            COALESCE(mi.owner_user_id = m.sender_id, 0)
            OR COALESCE(mi.owner_user_id = m.recipient_id, 0)
          )
        ) AS message_items_owner_not_sender_or_recipient,
        ${hasMessageActorColumns
          ? `SUM(
              m.id IS NOT NULL
              AND NOT (
                COALESCE(mi.owner_user_id = m.sender_user_id, 0)
                OR COALESCE(mi.owner_user_id = m.recipient_user_id, 0)
              )
            )`
          : 'NULL'} AS message_items_owner_not_typed_user_participant
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
        m.sender_id,
        m.recipient_id,
        ${hasMessageActorColumns ? 'm.sender_user_id, m.recipient_user_id,' : ''}
        CASE
          WHEN m.id IS NULL THEN 'missing_message'
          WHEN u.id IS NULL THEN 'missing_owner_user'
          ${hasMessageActorColumns
            ? `WHEN NOT (
                   COALESCE(mi.owner_user_id = m.sender_user_id, 0)
                   OR COALESCE(mi.owner_user_id = m.recipient_user_id, 0)
                 ) THEN 'owner_not_typed_user_participant'`
            : ''}
          WHEN NOT (
                 COALESCE(mi.owner_user_id = m.sender_id, 0)
                 OR COALESCE(mi.owner_user_id = m.recipient_id, 0)
               ) THEN 'owner_not_sender_or_recipient'
          ELSE 'ok'
        END AS anomaly
      FROM message_item mi
      LEFT JOIN messages m ON m.id = mi.message_id
      LEFT JOIN \`user\` u ON u.id = mi.owner_user_id
      WHERE m.id IS NULL
         OR u.id IS NULL
         ${hasMessageActorColumns
           ? `OR (
                m.id IS NOT NULL
                AND NOT (
                  COALESCE(mi.owner_user_id = m.sender_user_id, 0)
                  OR COALESCE(mi.owner_user_id = m.recipient_user_id, 0)
                )
              )`
           : ''}
         OR (
              m.id IS NOT NULL
              AND NOT (
                COALESCE(mi.owner_user_id = m.sender_id, 0)
                OR COALESCE(mi.owner_user_id = m.recipient_id, 0)
              )
            )
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
      LEFT JOIN iset_application a ON a.id = c.application_id
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
          client_id IS NULL OR case_id IS NULL OR application_id IS NULL OR applicant_user_id IS NULL OR user_id IS NULL OR origin_message_id IS NULL
        )) AS secure_message_attachment_scope_violations,
        SUM(source = 'system_generated' AND (
          client_id IS NULL OR case_id IS NULL
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
        (SELECT COUNT(*) FROM iset_case) AS cases,
        (SELECT SUM(client_id IS NULL) FROM iset_case) AS cases_missing_client_id,
        (SELECT SUM(application_id IS NOT NULL) FROM iset_case) AS cases_with_application_id,
        (SELECT COUNT(*)
           FROM iset_application a
           JOIN iset_case c ON c.id = a.case_id
          WHERE c.application_id IS NOT NULL AND c.application_id <> a.id) AS application_case_bidirectional_mismatches,
        (SELECT COUNT(*)
           FROM (SELECT case_id FROM iset_application WHERE case_id IS NOT NULL GROUP BY case_id HAVING COUNT(*) > 1) x) AS cases_with_multiple_applications
    `,
  });

  await runCheck(conn, checks, {
    title: 'Case/application mismatch samples',
    severity: 'medium',
    description: 'Sample rows where bidirectional case/application links disagree. IDs only.',
    requires: ['iset_case', 'iset_application'],
    sql: `
      SELECT
        a.id AS application_id,
        a.case_id AS application_case_id,
        a.client_id AS application_client_id,
        c.application_id AS case_application_id,
        c.client_id AS case_client_id
      FROM iset_application a
      JOIN iset_case c ON c.id = a.case_id
      WHERE (c.application_id IS NOT NULL AND c.application_id <> a.id)
         OR (a.client_id IS NOT NULL AND c.client_id IS NOT NULL AND a.client_id <> c.client_id)
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
