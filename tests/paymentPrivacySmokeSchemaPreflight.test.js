const fs = require('fs');
const path = require('path');

const {
  EXPECTED_DEV_DATABASE_IDENTITY,
  EXPECTED_TEST_DATABASE_IDENTITY,
  PAYMENT_SCHEMA_OBJECTS,
  cleanupFixture,
  createPaymentsSchemaGuard,
  forceSubmittedForFollowUp,
  parseArgs: parsePaymentArgs,
  resolveAuthorizedPaymentDatabaseIdentity,
  runDbRollbackSmoke,
  runPaymentsWorkflowSmoke,
} = require('../scripts/payments-workflow-smoke');
const {
  REQUIRED_CHECKS,
  REQUIRED_FKS,
  REQUIRED_PRIVACY_CONSTRAINTS,
  REQUIRED_PRIVACY_OBJECTS,
  RETIRED_COLUMNS,
  parseArgs: parsePrivacyArgs,
  runPrivacyErmSmoke,
} = require('../scripts/privacy-erm-smoke');

function mysqlColumn(Field, Type = 'varchar(255)') {
  return {
    Field,
    Type,
    Collation: Type.includes('char') ? 'utf8mb4_unicode_ci' : null,
    Null: 'YES',
    Key: Field === 'id' ? 'PRI' : '',
    Default: null,
    Extra: '',
  };
}

function buildSchema(requiredObjects, columnsByObject, constraints = []) {
  const constraintsByObject = new Map();
  const structuralColumnsByObject = new Map();
  for (const spec of constraints) {
    const rows = constraintsByObject.get(spec.object) || [];
    rows.push(spec);
    constraintsByObject.set(spec.object, rows);
    const localColumns = structuralColumnsByObject.get(spec.object) || new Set();
    (spec.columns || []).forEach(column => localColumns.add(column));
    structuralColumnsByObject.set(spec.object, localColumns);
    if (spec.referencedObject) {
      const referencedColumns = structuralColumnsByObject.get(spec.referencedObject) || new Set();
      (spec.referencedColumns || []).forEach(column => referencedColumns.add(column));
      structuralColumnsByObject.set(spec.referencedObject, referencedColumns);
    }
  }
  return Object.fromEntries(requiredObjects.map(spec => {
    const object = typeof spec === 'string' ? { name: spec, type: 'table' } : spec;
    const columnNames = new Set([
      'id',
      ...(columnsByObject[object.name] || []),
      ...(structuralColumnsByObject.get(object.name) || []),
    ]);
    for (const constraint of constraintsByObject.get(object.name) || []) {
      (constraint.columns || []).forEach(column => columnNames.add(column));
    }
    const columns = [...columnNames].map(name => mysqlColumn(name, name === 'id' || name.endsWith('_id') || name === 'code' ? 'bigint unsigned' : 'varchar(255)'));
    const ddlKind = object.type === 'view' ? 'VIEW' : 'TABLE';
    const ddl = `CREATE ${ddlKind} \`${object.name}\` AS synthetic metadata proof`;
    return [object.name, {
      ...object,
      columns,
      ddl,
      constraints: constraintsByObject.get(object.name) || [],
    }];
  }));
}

function fullMetadataConnection(schema, executeImpl = async () => [[{ 'COUNT(*)': 0 }], []]) {
  const query = jest.fn(async (sql, params = []) => {
    if (sql === 'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()') {
      return [[{
        'DATABASE()': 'iset_intake',
        '@@hostname': 'DESKTOP-PDFA51K',
        '@@port': 3306,
        'CURRENT_USER()': 'root@172.26.%',
        'VERSION()': '8.0.40',
      }], []];
    }
    const discovery = /^SHOW FULL TABLES FROM `iset_intake` LIKE \?$/.exec(sql);
    if (discovery) {
      const object = schema[params[0]];
      if (!object) return [[], []];
      return [[{ Tables_in_iset_intake: object.name, Table_type: object.type === 'view' ? 'VIEW' : 'BASE TABLE' }], []];
    }
    const create = /^SHOW CREATE (TABLE|VIEW) `([^`]+)`$/.exec(sql);
    if (create) {
      const object = schema[create[2]];
      const label = create[1] === 'VIEW' ? 'Create View' : 'Create Table';
      return [[{ [create[1] === 'VIEW' ? 'View' : 'Table']: create[2], [label]: object.ddl }], []];
    }
    const fullColumns = /^SHOW FULL COLUMNS FROM `([^`]+)`$/.exec(sql);
    if (fullColumns) return [schema[fullColumns[1]].columns, []];
    const indexes = /^SHOW INDEX FROM `([^`]+)`$/.exec(sql);
    if (indexes) return [[{ Table: indexes[1], Key_name: 'PRIMARY', Column_name: 'id' }], []];
    if (sql.startsWith('SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE FROM information_schema.TABLE_CONSTRAINTS')) {
      return [(schema[params[0]].constraints || []).map(spec => ({
        CONSTRAINT_NAME: spec.name,
        CONSTRAINT_TYPE: spec.type.replace(/_/g, ' ').toUpperCase(),
      })), []];
    }
    if (sql.startsWith('SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME')) {
      return [(schema[params[0]].constraints || []).flatMap(spec => (spec.columns || []).map((column, index) => ({
        CONSTRAINT_NAME: spec.name,
        COLUMN_NAME: column,
        REFERENCED_TABLE_NAME: spec.referencedObject || null,
        REFERENCED_COLUMN_NAME: spec.referencedColumns?.[index] || null,
        ORDINAL_POSITION: index + 1,
      }))), []];
    }
    if (sql === 'SELECT WORD, RESERVED FROM information_schema.KEYWORDS WHERE WORD = ?') {
      return [[{ WORD: params[0], RESERVED: 'NO' }], []];
    }
    if (['START TRANSACTION', 'COMMIT', 'ROLLBACK'].includes(sql)) return [{ affectedRows: 0 }, []];
    throw new Error(`unexpected raw query: ${sql}`);
  });
  return { query, execute: jest.fn(executeImpl) };
}

const PAYMENT_COLUMNS = {
  user: ['name', 'email', 'email_verified', 'preferred_language', 'cognito_sub'],
  client: ['first_name', 'last_name', 'applicant_account_email', 'applicant_account_status', 'applicant_activated_at', 'address_json'],
  iset_case: ['case_number', 'client_id', 'status', 'lifecycle_status', 'stage', 'opened_at', 'case_context_json'],
  iset_application_submission: ['user_id', 'workflow_id', 'reference_number', 'status', 'intake_payload', 'schema_snapshot', 'history', 'doc_refs', 'locale'],
  iset_application: ['submission_id', 'client_id', 'case_id', 'payload_json', 'status', 'lifecycle_status', 'decision_outcome', 'awaiting_reason'],
  budget_pot: ['name', 'code', 'fiscal_year', 'fiscal_year_tag', 'pot_type', 'funding_source', 'is_active', 'approved_amount', 'adjusted_amount', 'metadata'],
  esdc_intervention_code: ['code', 'is_active', 'display_order'],
  iset_case_intervention: ['case_id', 'intervention_code', 'status', 'delivery_status', 'start_date', 'end_date', 'intervention_cost', 'budget_amount', 'approved_amount', 'notes', 'metadata_json', 'eligibility_result', 'funding_stream_decision'],
  iset_document: ['user_id', 'applicant_user_id', 'client_id', 'application_id', 'case_id', 'source', 'file_name', 'file_path', 'mime_type', 'label', 'metadata', 'size_bytes', 'checksum_sha256', 'status', 'document_category', 'visibility'],
  payment_packet: ['case_id', 'client_id', 'intervention_id', 'reporting_unit', 'status', 'follow_up_status', 'requester_user_id', 'submitted_at', 'sent_at', 'due_by', 'follow_up_due_at', 'follow_up_updated_at', 'notes_internal', 'risk_flags', 'metadata', 'created_at', 'updated_at'],
  payment_packet_line: ['payment_packet_id', 'intervention_id', 'payment_type', 'payee_type', 'payee_name', 'payee_reference', 'amount', 'currency', 'invoice_reference_number', 'requested_payment_date', 'budget_pot_id', 'funding_stream', 'status', 'follow_up_status', 'follow_up_due_at', 'follow_up_updated_at', 'metadata', 'created_at', 'updated_at'],
  payment_packet_document: ['payment_packet_id', 'payment_packet_line_id', 'document_id', 'evidence_type', 'required', 'received_at', 'verified_by_user_id', 'verified_at', 'notes', 'created_at'],
  payment_status_event: ['payment_packet_id', 'payment_packet_line_id', 'from_status', 'to_status', 'actor_user_id', 'notes', 'metadata', 'created_at'],
  payment_followup_event: ['payment_packet_id', 'payment_packet_line_id', 'from_status', 'to_status', 'actor_user_id', 'note', 'due_at', 'document_id', 'metadata', 'created_at'],
  payment_packet_communication: ['payment_packet_id', 'direction', 'channel', 'sender_user_id', 'sender_label', 'recipients_json', 'subject', 'body', 'template_key', 'attachments_json', 'status', 'sent_at', 'created_at', 'updated_at'],
  finance_transaction: ['case_id', 'case_intervention_id', 'budget_pot_id', 'posting_context', 'amount', 'currency', 'status', 'transaction_date', 'description', 'evidence_ref', 'metadata', 'created_by_user_id', 'created_at', 'updated_at'],
  payment_line_transaction: ['payment_packet_line_id', 'finance_transaction_id', 'created_at'],
  payment_batch_line: ['payment_packet_line_id'],
  payment_override: ['payment_packet_id'],
};

const PAYMENT_CONSTRAINTS = [
  { object: 'payment_packet_line', name: 'fk_fake_line_packet', type: 'foreign_key', columns: ['payment_packet_id'], referencedObject: 'payment_packet', referencedColumns: ['id'] },
  { object: 'payment_line_transaction', name: 'fk_fake_link_line', type: 'foreign_key', columns: ['payment_packet_line_id'], referencedObject: 'payment_packet_line', referencedColumns: ['id'] },
  { object: 'payment_line_transaction', name: 'fk_fake_link_transaction', type: 'foreign_key', columns: ['finance_transaction_id'], referencedObject: 'finance_transaction', referencedColumns: ['id'] },
];

const PRIVACY_QUERY_COLUMNS = {
  privacy_erm_relationship_fk_hardening_audit: ['missing_target', 'scope_mismatch'],
  privacy_erm_event_actor_scope_hardening_audit: ['missing_required_typed_actor', 'dual_typed_actor'],
  privacy_erm_legacy_table_retirement_audit: ['table_name'],
  message_item: ['message_id', 'owner_user_id'],
  messages: ['case_id', 'sender_actor_type', 'recipient_actor_type', 'sender_user_id', 'recipient_user_id', 'sender_staff_profile_id', 'recipient_staff_profile_id'],
  iset_document: ['source', 'client_id', 'case_id', 'application_id', 'applicant_user_id', 'user_id', 'origin_message_id'],
  iset_application: ['client_id', 'case_id'],
  iset_case: ['client_id'],
  client_applicant_account_event: ['client_id'],
};

function exactDbConfig() {
  return {
    ...EXPECTED_DEV_DATABASE_IDENTITY.configured,
    password: '',
    multipleStatements: false,
  };
}

function fakePreflightConnection({ database = 'iset_intake', objectPresent = false } = {}) {
  const query = jest.fn(async (sql, params = []) => {
    if (sql === 'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()') {
      return [[{
        'DATABASE()': database,
        '@@hostname': 'DESKTOP-PDFA51K',
        '@@port': 3306,
        'CURRENT_USER()': 'root@172.26.%',
        'VERSION()': '8.0.40',
      }], []];
    }
    if (/^SHOW FULL TABLES FROM `iset_intake` LIKE \?$/.test(sql)) {
      if (!objectPresent) return [[], []];
      return [[{ Tables_in_iset_intake: params[0], Table_type: 'BASE TABLE' }], []];
    }
    throw new Error(`unexpected metadata query: ${sql}`);
  });
  return {
    query,
    execute: jest.fn(async () => {
      throw new Error('ordinary SQL must not execute during a failed preflight');
    }),
  };
}

function assertNoOrdinaryOrCleanup(connection) {
  expect(connection.execute).not.toHaveBeenCalled();
  const rawSql = connection.query.mock.calls.map(call => String(call[0]));
  expect(rawSql.some(sql => /^(START TRANSACTION|COMMIT|ROLLBACK|INSERT|UPDATE|DELETE)\b/i.test(sql))).toBe(false);
  expect(rawSql.every(sql => (
    sql === 'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()'
    || /^SHOW FULL TABLES FROM `iset_intake` LIKE \?$/.test(sql)
  ))).toBe(true);
}

describe('payment and privacy smoke schema admission', () => {
  test('payment configured-target admission is a closed DEV/TEST allowlist with no PROD fallback', () => {
    expect(resolveAuthorizedPaymentDatabaseIdentity(EXPECTED_DEV_DATABASE_IDENTITY.configured)).toBe(EXPECTED_DEV_DATABASE_IDENTITY);
    expect(resolveAuthorizedPaymentDatabaseIdentity(EXPECTED_TEST_DATABASE_IDENTITY.configured)).toBe(EXPECTED_TEST_DATABASE_IDENTITY);
    expect(() => resolveAuthorizedPaymentDatabaseIdentity({
      host: 'nwac-prod-db.example.invalid',
      port: 3306,
      user: 'app_admin',
      database: 'iset_intake',
    })).toThrow('payments_smoke_configured_database_target_not_authorized');
  });

  test('privacy structural expectations cover every named FK and CHECK exactly once', () => {
    const foreignKeys = REQUIRED_PRIVACY_CONSTRAINTS
      .filter(spec => spec.type === 'foreign_key')
      .map(spec => spec.name)
      .sort();
    const checks = REQUIRED_PRIVACY_CONSTRAINTS
      .filter(spec => spec.type === 'check')
      .map(spec => spec.name)
      .sort();

    expect(foreignKeys).toEqual([...REQUIRED_FKS].sort());
    expect(checks).toEqual([...REQUIRED_CHECKS].sort());
    expect(new Set(foreignKeys).size).toBe(foreignKeys.length);
    expect(new Set(checks).size).toBe(checks.length);
  });

  test('payment wrong live identity aborts before ordinary SQL, transaction, residue, or cleanup', async () => {
    const connection = fakePreflightConnection({ database: 'wrong_database' });

    await expect(runPaymentsWorkflowSmoke({
      connection,
      args: parsePaymentArgs([]),
      dbConfig: exactDbConfig(),
    })).rejects.toMatchObject({ code: 'schema_guard_wrong_database' });

    assertNoOrdinaryOrCleanup(connection);
    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  test('payment missing live object aborts before transaction, mutation, residue, or cleanup', async () => {
    const connection = fakePreflightConnection();

    await expect(runPaymentsWorkflowSmoke({
      connection,
      args: parsePaymentArgs([]),
      dbConfig: exactDbConfig(),
    })).rejects.toMatchObject({ code: 'schema_guard_required_object_missing' });

    assertNoOrdinaryOrCleanup(connection);
  });

  test('payment wrong live column DDL is rejected before ordinary execution or transaction control', async () => {
    const schema = buildSchema(PAYMENT_SCHEMA_OBJECTS, PAYMENT_COLUMNS, PAYMENT_CONSTRAINTS);
    schema.esdc_intervention_code.columns = schema.esdc_intervention_code.columns
      .filter(column => column.Field !== 'is_active');
    const connection = fullMetadataConnection(schema);

    await expect(runPaymentsWorkflowSmoke({
      connection,
      args: parsePaymentArgs([]),
      dbConfig: exactDbConfig(),
    })).rejects.toMatchObject({ code: 'schema_guard_column_wrong_owner' });

    expect(connection.execute).not.toHaveBeenCalled();
    const rawSql = connection.query.mock.calls.map(call => String(call[0]));
    expect(rawSql.some(sql => ['START TRANSACTION', 'COMMIT', 'ROLLBACK'].includes(sql))).toBe(false);
  });

  test('privacy wrong live identity aborts before any integrity SELECT', async () => {
    const connection = fakePreflightConnection({ database: 'wrong_database' });

    await expect(runPrivacyErmSmoke({
      connection,
      args: parsePrivacyArgs(['node', 'privacy-erm-smoke.js']),
      dbConfig: exactDbConfig(),
    })).rejects.toMatchObject({ code: 'schema_guard_wrong_database' });

    assertNoOrdinaryOrCleanup(connection);
    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  test('privacy missing live object aborts before any integrity SELECT', async () => {
    const connection = fakePreflightConnection();

    await expect(runPrivacyErmSmoke({
      connection,
      args: parsePrivacyArgs(['node', 'privacy-erm-smoke.js']),
      dbConfig: exactDbConfig(),
    })).rejects.toMatchObject({ code: 'schema_guard_required_object_missing' });

    assertNoOrdinaryOrCleanup(connection);
  });

  test('privacy wrong constraint DDL aborts before any integrity SELECT', async () => {
    const incompleteConstraints = REQUIRED_PRIVACY_CONSTRAINTS.slice(1);
    const schema = buildSchema(REQUIRED_PRIVACY_OBJECTS, PRIVACY_QUERY_COLUMNS, incompleteConstraints);
    const connection = fullMetadataConnection(schema);

    await expect(runPrivacyErmSmoke({
      connection,
      args: parsePrivacyArgs(['node', 'privacy-erm-smoke.js']),
      dbConfig: exactDbConfig(),
    })).rejects.toMatchObject({ code: 'schema_guard_required_constraint_missing' });

    expect(connection.execute).not.toHaveBeenCalled();
    const rawSql = connection.query.mock.calls.map(call => String(call[0]));
    expect(rawSql.some(sql => ['START TRANSACTION', 'COMMIT', 'ROLLBACK'].includes(sql))).toBe(false);
  });

  test.each([
    ['payment', runPaymentsWorkflowSmoke, parsePaymentArgs(['--schema-preflight-only'])],
    ['privacy', runPrivacyErmSmoke, parsePrivacyArgs(['node', 'privacy-erm-smoke.js', '--schema-preflight-only'])],
  ])('%s schema-preflight-only mode does not create an ordinary connection facade', async (_name, runner, args) => {
    const connection = { query: jest.fn(), execute: jest.fn() };
    const createGuardedConnection = jest.fn(() => {
      throw new Error('ordinary facade must not be created');
    });
    const guardFactory = jest.fn(() => ({
      preflight: jest.fn(async () => ({
        objects: { proven: { type: 'table' } },
        absentObjects: [],
        verifiedStatementCount: 0,
      })),
      createGuardedConnection,
      evidence: jest.fn(),
      getObjectProof: jest.fn(object => ({
        columns: [],
        constraints: REQUIRED_PRIVACY_CONSTRAINTS
          .filter(spec => spec.object === object)
          .map(spec => ({
            name: spec.name,
            type: spec.type.replace(/_/g, ' ').toUpperCase(),
            columns: spec.columns || [],
            referencedObject: spec.referencedObject || null,
            referencedColumns: spec.referencedColumns || [],
          })),
      })),
    }));

    const result = await runner({
      connection,
      args,
      dbConfig: exactDbConfig(),
      guardFactory,
    });

    expect(result.mode).toBe('schema-preflight-only');
    if (_name === 'privacy') {
      expect(result.structuralEvidence.absentColumns).toHaveLength(RETIRED_COLUMNS.length);
      expect(result.structuralEvidence.constraints).toHaveLength(REQUIRED_PRIVACY_CONSTRAINTS.length);
    }
    expect(createGuardedConnection).not.toHaveBeenCalled();
    expect(connection.query).not.toHaveBeenCalled();
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('payment rollback mode validates every finished SQL shape through the live guard facade', async () => {
    const schema = buildSchema(PAYMENT_SCHEMA_OBJECTS, PAYMENT_COLUMNS, PAYMENT_CONSTRAINTS);
    let insertId = 100;
    let lineId = null;
    const connection = fullMetadataConnection(schema, async (sql) => {
      if (/^SELECT `intervention_reference`\.`code`/i.test(sql.trim())) {
        return [[{ code: 7 }], []];
      }
      if (/^INSERT\s+INTO\s+payment_packet_line\b/i.test(sql.trim())) {
        lineId = ++insertId;
        return [{ insertId: lineId }, []];
      }
      if (/^INSERT\b/i.test(sql.trim())) return [{ insertId: ++insertId }, []];
      if (/^UPDATE\b|^DELETE\b/i.test(sql.trim())) return [{ affectedRows: 1 }, []];
      if (/FROM payment_packet WHERE id = \?/i.test(sql)) {
        return [[{ status: 'submitted', follow_up_status: 'follow_up_logged' }], []];
      }
      if (/FROM payment_packet_line WHERE payment_packet_id = \?/i.test(sql)) {
        return [[{ id: lineId, status: 'submitted', follow_up_status: 'follow_up_logged' }], []];
      }
      if (/FROM payment_packet_document WHERE payment_packet_id = \?/i.test(sql)) {
        return [[
          { payment_packet_line_id: lineId, evidence_type: 'FundingAgreement' },
          { payment_packet_line_id: null, evidence_type: 'ClientApplicationSigned' },
          { payment_packet_line_id: null, evidence_type: 'CaseManagerAssessment' },
          { payment_packet_line_id: null, evidence_type: 'IndigenousIdentity' },
          { payment_packet_line_id: null, evidence_type: 'BandFundingConfirmationOrDenial' },
        ], []];
      }
      if (/FROM payment_followup_event WHERE payment_packet_id = \?/i.test(sql)) {
        return [[{ to_status: 'sent_to_finance' }, { to_status: 'follow_up_logged' }], []];
      }
      if (/FROM payment_packet_communication WHERE payment_packet_id = \?/i.test(sql)) {
        return [[{ subject: 'Synthetic communication' }], []];
      }
      if (/FROM `finance_transaction` AS `ft`/i.test(sql)) {
        return [[{ status: 'submitted', amount: 125.25, payment_packet_line_id: lineId }], []];
      }
      if (/^SELECT\s+\(SELECT COUNT\(\*\)/i.test(sql.trim())) {
        return [[{
          users: 0,
          clients: 0,
          cases: 0,
          submissions: 0,
          applications: 0,
          interventions: 0,
          budget_pots: 0,
          documents: 0,
          packets: 0,
          packet_lines: 0,
          finance_transactions: 0,
        }], []];
      }
      throw new Error(`unexpected guarded payment statement: ${sql}`);
    });

    const result = await runPaymentsWorkflowSmoke({
      connection,
      args: parsePaymentArgs([]),
      dbConfig: exactDbConfig(),
    });

    expect(result.pass).toBe(true);
    expect(result.rollback.fixtureRolledBack).toBe(true);
    expect(result.schemaEvidence.verifiedStatementCount).toBeGreaterThan(20);
  });

  test('payment persistent cleanup resolves relationships inside its guarded transaction', async () => {
    const schema = buildSchema(PAYMENT_SCHEMA_OBJECTS, PAYMENT_COLUMNS, PAYMENT_CONSTRAINTS);
    const connection = fullMetadataConnection(schema, async (sql) => {
      if (/^SELECT id FROM payment_packet WHERE/i.test(sql.trim())) return [[{ id: 501 }], []];
      if (/^SELECT id FROM payment_packet_line WHERE/i.test(sql.trim())) return [[{ id: 601 }], []];
      if (/^DELETE\b/i.test(sql.trim())) return [{ affectedRows: 1 }, []];
      if (/^SELECT\s+\(SELECT COUNT\(\*\)/i.test(sql.trim())) {
        return [[{
          users: 0,
          clients: 0,
          cases: 0,
          submissions: 0,
          applications: 0,
          interventions: 0,
          budget_pots: 0,
          documents: 0,
          packets: 0,
          packet_lines: 0,
          finance_transactions: 0,
        }], []];
      }
      throw new Error(`unexpected guarded cleanup statement: ${sql}`);
    });
    const guard = createPaymentsSchemaGuard(connection, exactDbConfig());
    await guard.preflight();

    const counts = await cleanupFixture(guard.createGuardedConnection(), {
      stamp: 'synthetic-cleanup-stamp',
      mutationStarted: true,
      packetId: 501,
      interventionId: 11,
      applicationId: 12,
      submissionId: 13,
      caseId: 14,
      clientId: 15,
      budgetPotId: 16,
      userId: 17,
    });

    expect(Object.values(counts).every(value => value === 0)).toBe(true);
    const controls = connection.query.mock.calls.map(call => call[0]);
    expect(controls).toContain('START TRANSACTION');
    expect(controls).toContain('COMMIT');
    expect(guard.evidence().verifiedStatementCount).toBeGreaterThan(15);
  });

  test('payment safe post-send setup validates every direct mutation shape', async () => {
    const schema = buildSchema(PAYMENT_SCHEMA_OBJECTS, PAYMENT_COLUMNS, PAYMENT_CONSTRAINTS);
    const connection = fullMetadataConnection(schema, async (sql) => {
      if (/^UPDATE\b/i.test(sql.trim())) return [{ affectedRows: 1 }, []];
      if (/^INSERT\b/i.test(sql.trim())) return [{ insertId: 701 }, []];
      throw new Error(`unexpected guarded post-send statement: ${sql}`);
    });
    const guard = createPaymentsSchemaGuard(connection, exactDbConfig());
    await guard.preflight();

    await forceSubmittedForFollowUp(guard.createGuardedConnection(), {
      packetId: 501,
      lineId: 601,
      caseId: 11,
      interventionId: 12,
      budgetPotId: 13,
      lineAmount: 125.25,
      userId: 14,
      marker: { fixture: 'payment-test' },
    }, 14);

    expect(guard.evidence().verifiedStatementCount).toBe(6);
  });

  test('payment rollback mode does not roll back or inspect residue when its first fixture statement fails before mutation', async () => {
    const connection = {
      beginTransaction: jest.fn(async () => {}),
      query: jest.fn(async () => {
        throw new Error('synthetic_statement_guard_rejection');
      }),
      rollback: jest.fn(async () => {}),
    };

    await expect(runDbRollbackSmoke(connection, [], { interventionCode: 7 }))
      .rejects.toThrow('synthetic_statement_guard_rejection');

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
  });

  test('payment rollback mode rolls back and proves zero residue after its first fixture mutation fails', async () => {
    const connection = {
      beginTransaction: jest.fn(async () => {}),
      query: jest.fn()
        .mockResolvedValueOnce([{ insertId: 101 }, []])
        .mockRejectedValueOnce(new Error('synthetic_post_mutation_failure'))
        .mockResolvedValueOnce([[{
          users: 0,
          clients: 0,
          cases: 0,
          submissions: 0,
          applications: 0,
          interventions: 0,
          budget_pots: 0,
          documents: 0,
          packets: 0,
          packet_lines: 0,
          finance_transactions: 0,
        }], []]),
      rollback: jest.fn(async () => {}),
    };

    await expect(runDbRollbackSmoke(connection, [], { interventionCode: 7 }))
      .rejects.toThrow('synthetic_post_mutation_failure');

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.query).toHaveBeenCalledTimes(3);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls[2][0]).toMatch(/^SELECT\s+\(SELECT COUNT\(\*\)/);
  });

  test('payment rollback mode aggregates a residue failure with the original post-mutation error', async () => {
    const connection = {
      beginTransaction: jest.fn(async () => {}),
      query: jest.fn()
        .mockResolvedValueOnce([{ insertId: 101 }, []])
        .mockRejectedValueOnce(new Error('synthetic_post_mutation_failure'))
        .mockResolvedValueOnce([[{
          users: 1,
          clients: 0,
          cases: 0,
          submissions: 0,
          applications: 0,
          interventions: 0,
          budget_pots: 0,
          documents: 0,
          packets: 0,
          packet_lines: 0,
          finance_transactions: 0,
        }], []]),
      rollback: jest.fn(async () => {}),
    };

    await expect(runDbRollbackSmoke(connection, [], { interventionCode: 7 }))
      .rejects.toMatchObject({
        code: 'payments_smoke_rollback_recovery_failed',
        errors: [
          expect.objectContaining({ message: 'synthetic_post_mutation_failure' }),
          expect.objectContaining({ code: 'payments_smoke_rollback_residue_detected' }),
        ],
      });

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.query).toHaveBeenCalledTimes(3);
  });

  test('payment cleanup is a no-op when fixture mutation never began', async () => {
    const connection = {
      beginTransaction: jest.fn(async () => {}),
      query: jest.fn(async () => {
        throw new Error('cleanup must not query');
      }),
      rollback: jest.fn(async () => {}),
      commit: jest.fn(async () => {}),
    };

    await expect(cleanupFixture(connection, {
      stamp: 'synthetic-never-mutated',
      mutationStarted: false,
    })).resolves.toBeNull();

    expect(connection.beginTransaction).not.toHaveBeenCalled();
    expect(connection.query).not.toHaveBeenCalled();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test('privacy full mode validates every integrity statement after structural preflight', async () => {
    const schema = buildSchema(REQUIRED_PRIVACY_OBJECTS, PRIVACY_QUERY_COLUMNS, REQUIRED_PRIVACY_CONSTRAINTS);
    const connection = fullMetadataConnection(schema, async (sql) => {
      const count = sql.includes('privacy_erm_legacy_table_retirement_audit') ? 1 : 0;
      return [[{ 'COUNT(*)': count }], []];
    });

    const result = await runPrivacyErmSmoke({
      connection,
      args: parsePrivacyArgs(['node', 'privacy-erm-smoke.js']),
      dbConfig: exactDbConfig(),
    });

    expect(result.ok).toBe(true);
    expect(result.schemaEvidence.verifiedStatementCount).toBe(8);
    expect(result.checks.every(check => check.pass)).toBe(true);
  });

  test('source keeps every full mode behind the same in-process preflight boundary', () => {
    const paymentSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'payments-workflow-smoke.js'), 'utf8');
    const privacySource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'privacy-erm-smoke.js'), 'utf8');

    expect(paymentSource.indexOf('await guard.preflight()')).toBeLessThan(paymentSource.indexOf('guard.createGuardedConnection()'));
    expect(privacySource.indexOf('await guard.preflight()')).toBeLessThan(privacySource.indexOf('guard.createGuardedConnection()'));
    expect(paymentSource).toContain('payments_smoke_intervention_code_not_preflighted');
    expect(paymentSource).not.toMatch(/VALUES\s*\(\?,\s*1,\s*'approved'/);
    expect(privacySource).not.toContain('information_schema');
    expect(privacySource).not.toContain('workflow string-key rows');
    expect(paymentSource).toContain('if (require.main === module)');
    expect(privacySource).toContain('if (require.main === module)');
  });
});
