const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  createEncryptedFixtureEnvelope,
  createLiveSchemaGuard,
} = require('../scripts/two-step-review-test-smoke');

function column(Field, Type = 'varchar(255)', extra = {}) {
  return {
    Field,
    Type,
    Collation: Type.includes('char') ? 'utf8mb4_unicode_ci' : null,
    Null: 'NO',
    Key: '',
    Default: null,
    Extra: '',
    ...extra,
  };
}

function createDriver({
  database = 'iset_intake',
  databaseHost = 'test-aurora-writer',
  databasePort = 3306,
  currentUser = 'path_test@%',
  omitTable = null,
} = {}) {
  const tables = {
    alpha: {
      ddl: 'CREATE TABLE `alpha` (`id` bigint NOT NULL, `name` varchar(255) NOT NULL, `status` enum(\'active\',\'inactive\') NOT NULL, PRIMARY KEY (`id`))',
      columns: [column('id', 'bigint'), column('name'), column('status', "enum('active','inactive')")],
    },
    beta: {
      ddl: 'CREATE TABLE `beta` (`id` bigint NOT NULL, `alpha_id` bigint NOT NULL, `note` varchar(255) NOT NULL, PRIMARY KEY (`id`), CONSTRAINT `fk_beta_alpha` FOREIGN KEY (`alpha_id`) REFERENCES `alpha` (`id`))',
      columns: [column('id', 'bigint'), column('alpha_id', 'bigint'), column('note')],
    },
  };
  if (omitTable) delete tables[omitTable];
  const query = jest.fn(async (sql) => {
    if (sql.startsWith('SELECT DATABASE()')) {
      return [[{
        'DATABASE()': database,
        '@@hostname': databaseHost,
        '@@port': databasePort,
        'CURRENT_USER()': currentUser,
        'VERSION()': '8.0.40',
      }], []];
    }
    if (sql === 'SHOW TABLES') {
      return [Object.keys(tables).map(table => ({ Tables_in_iset_intake: table })), []];
    }
    const createMatch = /^SHOW CREATE TABLE `([^`]+)`$/.exec(sql);
    if (createMatch && tables[createMatch[1]]) {
      return [[{ Table: createMatch[1], 'Create Table': tables[createMatch[1]].ddl }], []];
    }
    const columnsMatch = /^SHOW FULL COLUMNS FROM `([^`]+)`$/.exec(sql);
    if (columnsMatch && tables[columnsMatch[1]]) {
      return [tables[columnsMatch[1]].columns, []];
    }
    throw new Error(`unexpected raw query: ${sql}`);
  });
  const execute = jest.fn(async () => [[{ id: 1 }], []]);
  return { query, execute };
}

function makeGuard(connection, requiredTables = ['alpha', 'beta'], overrides = {}) {
  return createLiveSchemaGuard({
    connection,
    expectedDatabase: 'iset_intake',
    expectedHost: 'test-db.cluster.example.ca',
    expectedUser: 'path_test',
    expectedDatabaseHostname: 'test-aurora-writer',
    expectedPort: 3306,
    expectedPrincipal: 'path_test@%',
    configuredDatabase: 'iset_intake',
    configuredHost: 'test-db.cluster.example.ca',
    configuredUser: 'path_test',
    configuredPort: 3306,
    requiredTables,
    cryptoModule: crypto,
    ...overrides,
  });
}

describe('two-step TEST smoke live-schema guard', () => {
  test('credential envelope retains only authenticated ciphertext outside the remote ephemeral key', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const secretPayload = {
      staffUsers: [{ password: 'secret-password', session: { RefreshToken: 'secret-refresh-token' } }],
      applicantUser: { password: 'secret-applicant-password' },
    };
    const serialized = createEncryptedFixtureEnvelope(secretPayload, publicKey);

    expect(serialized).not.toContain('secret-password');
    expect(serialized).not.toContain('secret-refresh-token');
    expect(serialized).not.toContain('secret-applicant-password');

    const envelope = JSON.parse(serialized);
    const contentKey = crypto.privateDecrypt({
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    }, Buffer.from(envelope.encryptedKey, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', contentKey, Buffer.from(envelope.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(envelope.authenticationTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]);
    expect(JSON.parse(plaintext.toString('utf8'))).toEqual(secretPayload);
    contentKey.fill(0);
    plaintext.fill(0);
  });

  test('proves identity/full DDL and validates a joined statement before execution', async () => {
    const connection = createDriver();
    const guard = makeGuard(connection);

    const evidence = await guard.preflight();
    await guard.execute(
      'SELECT a.id, a.name, b.note FROM alpha a JOIN beta b ON b.alpha_id = a.id WHERE a.status = ?',
      ['active']
    );

    expect(evidence.identity).toEqual(expect.objectContaining({
      database: 'iset_intake',
      host: 'test-aurora-writer',
      currentUser: 'path_test@%',
    }));
    expect(Object.keys(evidence.ddlHashes)).toEqual(['alpha', 'beta']);
    expect(connection.execute).toHaveBeenCalledTimes(1);
    expect(guard.evidence().verifiedStatementCount).toBe(1);
  });

  test('wrong database aborts after identity metadata and before any operational execution', async () => {
    const connection = createDriver({ database: 'wrong_database' });
    const guard = makeGuard(connection);

    await expect(guard.preflight()).rejects.toMatchObject({ code: 'schema_guard_wrong_database' });

    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test.each([
    [
      'configured database differs from the authorized TEST env',
      { configuredDatabase: 'prod_database' },
      'schema_guard_wrong_configured_database',
    ],
    [
      'configured host differs from the authorized TEST env',
      { configuredHost: 'prod-db.cluster.example.ca' },
      'schema_guard_wrong_configured_host',
    ],
    [
      'configured user differs from the authorized TEST env',
      { configuredUser: 'path_prod' },
      'schema_guard_wrong_configured_user',
    ],
  ])('%s aborts before schema discovery or operational execution', async (_label, overrides, code) => {
    const connection = createDriver();
    const guard = makeGuard(connection, ['alpha', 'beta'], overrides);

    await expect(guard.preflight()).rejects.toMatchObject({ code });

    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('live CURRENT_USER principal mismatch aborts before schema discovery or operational execution', async () => {
    const connection = createDriver({ currentUser: 'path_prod@10.%' });
    const guard = makeGuard(connection);

    await expect(guard.preflight()).rejects.toMatchObject({ code: 'schema_guard_wrong_database_principal' });

    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test.each([
    [
      'live server hostname',
      { databaseHost: 'unexpected-aurora-host' },
      'schema_guard_wrong_database_hostname',
    ],
    [
      'live server port',
      { databasePort: 3307 },
      'schema_guard_wrong_database_port',
    ],
  ])('%s mismatch aborts before schema discovery or operational execution', async (_label, driverOptions, code) => {
    const connection = createDriver(driverOptions);
    const guard = makeGuard(connection);

    await expect(guard.preflight()).rejects.toMatchObject({ code });
    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('missing required table aborts during metadata preflight', async () => {
    const connection = createDriver({ omitTable: 'beta' });
    const guard = makeGuard(connection);

    await expect(guard.preflight()).rejects.toMatchObject({ code: 'schema_guard_required_table_missing' });

    expect(connection.execute).not.toHaveBeenCalled();
  });

  test.each([
    ['unverified table', 'SELECT id FROM gamma', 'schema_guard_table_unverified'],
    ['nonexistent column', 'SELECT missing_column FROM alpha', 'schema_guard_column_not_found'],
    [
      'column copied from the wrong owner',
      'SELECT a.note FROM alpha a JOIN beta b ON b.alpha_id = a.id',
      'schema_guard_column_wrong_owner',
    ],
    [
      'join without a live foreign-key relationship',
      'SELECT a.id, b.note FROM alpha a JOIN beta b ON b.id = a.id',
      'schema_guard_join_relationship_unverified',
    ],
    ['unverified SQL function', 'SELECT mystery(name) FROM alpha', 'schema_guard_function_unverified'],
    ['unverified enum value', "SELECT id FROM alpha WHERE status = 'retired'", 'schema_guard_enum_value_unverified'],
  ])('%s aborts before the driver receives the statement', async (_label, sql, code) => {
    const connection = createDriver();
    const guard = makeGuard(connection);
    await guard.preflight();

    await expect(guard.execute(sql)).rejects.toMatchObject({ code });

    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('raw query boundary rejects non-metadata SQL without calling the driver', async () => {
    const connection = createDriver();
    const guard = makeGuard(connection);

    await expect(guard.metadataQuery('SELECT id FROM alpha')).rejects.toMatchObject({
      code: 'schema_guard_raw_query_not_metadata',
    });

    expect(connection.query).not.toHaveBeenCalled();
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('table DDL metadata is inaccessible until SHOW TABLES has proved the table exists', async () => {
    const connection = createDriver();
    const guard = makeGuard(connection);

    await expect(guard.metadataQuery('SHOW CREATE TABLE `alpha`')).rejects.toMatchObject({
      code: 'schema_guard_metadata_table_not_discovered',
    });

    expect(connection.query).not.toHaveBeenCalled();
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('bound enum values in INSERT statements are checked against live column metadata', async () => {
    const connection = createDriver();
    const guard = makeGuard(connection);
    await guard.preflight();

    await expect(guard.execute(
      'INSERT INTO alpha (id, name, status) VALUES (?, ?, ?)',
      [1, 'unsafe', 'retired']
    )).rejects.toMatchObject({ code: 'schema_guard_enum_value_unverified' });

    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('ON DUPLICATE KEY UPDATE is validated as an INSERT assignment, not a second table', async () => {
    const connection = createDriver();
    const guard = makeGuard(connection);
    await guard.preflight();

    await guard.execute(
      'INSERT INTO alpha (id, name, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = ?',
      [1, 'first', 'active', 'updated']
    );

    expect(connection.execute).toHaveBeenCalledTimes(1);
    expect(guard.evidence().verifiedStatementCount).toBe(1);
  });

  test('unquoted output aliases fail closed while quoted aliases and CAST target types are accepted', async () => {
    const connection = createDriver();
    const guard = makeGuard(connection);
    await guard.preflight();

    await expect(guard.execute('SELECT COUNT(*) AS count FROM alpha')).rejects.toMatchObject({
      code: 'schema_guard_output_alias_unquoted',
    });
    expect(connection.execute).not.toHaveBeenCalled();

    await guard.execute('SELECT CAST(name AS CHAR) AS `value_text` FROM alpha');
    expect(connection.execute).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      'function name cannot masquerade as a verified table',
      'SELECT alpha(name) FROM alpha',
      [],
      'schema_guard_function_unverified',
    ],
    [
      'reversed enum comparison is validated',
      'SELECT id FROM alpha WHERE ? = status',
      ['retired'],
      'schema_guard_enum_value_unverified',
    ],
    [
      'enum CASE assignment is rejected when its value domain is not statically proved',
      "UPDATE alpha SET status = CASE WHEN id = ? THEN 'retired' ELSE status END WHERE id = ?",
      [1, 1],
      'schema_guard_enum_expression_unverified',
    ],
    [
      'every VALUES tuple is enum-validated',
      "INSERT INTO alpha (id, name, status) VALUES (?, ?, 'active'), (?, ?, 'retired')",
      [1, 'first', 2, 'second'],
      'schema_guard_enum_value_unverified',
    ],
  ])('%s', async (_label, sql, params, code) => {
    const connection = createDriver();
    const guard = makeGuard(connection);
    await guard.preflight();

    await expect(guard.execute(sql, params)).rejects.toMatchObject({ code });
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('smoke source keeps every direct operational SQL path behind the guard and preserves #179', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'two-step-review-test-smoke.js'),
      'utf8'
    );

    expect(source.match(/connection\.query\(/g) || []).toHaveLength(1);
    expect(source.match(/connection\.execute\(/g) || []).toHaveLength(1);
    expect(source).toContain('return connection.query(sql);');
    expect(source).toContain('return schemaGuard.execute(sql, params);');
    expect(source).not.toMatch(/connection\.(?:beginTransaction|commit|rollback)\(/);
    expect(source).not.toContain("process.env.DB_NAME || 'iset_intake'");
    expect(source).not.toContain('1780058672308');
    expect(source).not.toContain('workflow_id: 52');
    expect(source).not.toMatch(/regionId:\s*1\b/);
    const remoteRunnerSource = source.slice(source.indexOf('function remoteRunner()'));
    expect(remoteRunnerSource).not.toMatch(/\b(?:LEFT|RIGHT|INNER|OUTER)?\s*JOIN\s+[A-Za-z_]/i);
    expect(remoteRunnerSource.match(/\bfetch\(/g) || []).toHaveLength(1);
    expect(source).toContain('const controller = new AbortController();');
    expect(source).toContain('smoke_http_body_limit_exceeded');
    expect(source).toContain("const expectedDbHost = String(adminEnv.DB_HOST || '').trim();");
    expect(source).toContain("const expectedDbUser = String(adminEnv.DB_USER || '').trim();");
    expect(source).toContain("const expectedDbName = String(adminEnv.DB_NAME || '').trim();");
    expect(source).toContain('account: config.awsAccount');
    expect(source).toContain('arn: config.awsArn');
    expect(source).toContain('instanceId: config.instanceId');
    expect(source).toContain("expectedDbServerHostname: requiredEnv('TWO_STEP_REVIEW_EXPECTED_DB_SERVER_HOSTNAME')");
    expect(source).toContain("expectedDbPrincipal: requiredEnv('TWO_STEP_REVIEW_EXPECTED_DB_PRINCIPAL')");
    expect(source).toContain('AutoScalingGroupName:AutoScalingGroupName');
    expect(source).toContain('EXPECTED_TEST_ASG');
    expect(source).toContain('!online.has(options.instanceId) || !running.includes(options.instanceId)');
    expect(source.indexOf('const preflightResult = runRemote({ preflightOnly: true });')).toBeLessThan(
      source.indexOf('user.sub = createStaffUser({ ...user, poolId }, options);')
    );
    expect(source.indexOf('await schemaGuard.preflight()')).toBeLessThan(
      source.indexOf('await resolveFixtureReferences()')
    );
    expect(source.indexOf('await resolveFixtureReferences()')).toBeLessThan(
      source.indexOf('await cleanupFixture({ quiet: true })')
    );
    expect(source).toMatch(/schemaPreflightComplete\s*&&\s*databaseWorkStarted/);
    expect(source).toContain("reason: 'schema_safety_failure'");
    expect(source).toContain('!schemaGuardFailure &&');
    expect(source).toMatch(/SHOW CREATE TABLE \$\{quoteIdentifier\(table\)\}/);
    expect(source).toMatch(/SHOW FULL COLUMNS FROM \$\{quoteIdentifier\(table\)\}/);
    expect(source).toContain('application assessment: legacy Amanda state reproduced on exact TEST fixture');
    expect(source).toContain('application assessment: Financial Overview request starts on a proven non-primary repeat application');
    expect(source).toContain('application assessment: Financial Overview signing preserves the proven non-primary target');
    expect(source).toContain('application assessment: Amanda recovery remains scoped to the non-primary application after RM forward');
    expect(source).toContain('application assessment: deployed UI recovers legacy mismatch to exact submitter-edit state');
    expect(source).toContain('application assessment: exact dual-role journey leaves other synthetic application unchanged');
    expect(source).toContain('application assessment: exact dual-role journey leaves sibling application row byte-for-byte unchanged');
    expect(source).toContain('application assessment: returned-to-RM packet body edit is denied by deployed policy');
    expect(source).toContain('application assessment: returned-to-RM forged escalation is denied by deployed policy');
    expect(source).toContain('application assessment: returned-to-RM UI exposes forwarding but no final-decision escalation');
    expect(source).toContain('application assessment: returned Pending Review item coexists with the existing approved Pending Completion item');
    expect(source).not.toContain('controlledSchemaVersion');
    expect(source).not.toContain('smoke-fail-');
    expect(source).not.toContain('controlled route-failure precondition');
    expect(source).toContain('application assessment: normal signing starts from the exact sent Financial Overview version');
    expect(source).toContain('application assessment: true concurrent normal portal signing calls converge without a server failure');
    expect(source).toContain('application assessment: concurrent applicant signing and RM forward serialize to returned-to-submitter');
    expect(source).toContain('application assessment: exact normal signing replay returns the canonical signed result');
    expect(source).toContain('application assessment: normal success/concurrency/replay produces one canonical signed artifact');
    expect(source).toContain('application assessment: deployed UI supplies the exact scoped optimistic resubmit payload');
    expect(source).toContain('application assessment: exact concurrent resubmit copies serialize to one commit and one stale conflict');
    expect(source).toContain('application assessment: applicant signing overlaps resubmit and completes without deadlock or server failure');
    expect(source).toContain('application assessment: exact stale resubmit replay is a side-effect-free row-version conflict');
    expect(source).toContain('application assessment: resubmit/signing race converges on one canonical RM-review application state');
    expect(source).toContain('application assessment: resubmit race creates exactly one returned-to-submitter review transition');
    expect(source).toContain('application assessment: one resubmit plus one signing creates exactly four scoped durable documents');
    expect(source).toContain('application assessment: four new DB documents map one-to-one to four exact S3 object versions');
    expect(source).toContain('application assessment: corrected resubmission reaches the Decision Maker exact-application queue');
    expect(source).toContain('application assessment: exact dual-role journey leaves sibling reminders byte-for-byte unchanged');
    expect(source).toContain("'user_session_audit'");
    expect(source).toContain("'iset_event_delivery'");
    expect(source).toContain("'iset_event_receipt'");
    expect(source).toContain("'iset_reminder_lifecycle_event'");
    expect(source).toContain("'esdc_participant_submission_history.participant_submission_id'");
    expect(source).toContain("'iset_event_delivery.event_id'");
    expect(source).toContain("'iset_event_receipt.viewer_staff_profile_id'");
    expect(source).toContain("'iset_event_receipt.viewer_applicant_user_id'");
    expect(source).toContain("'iset_reminder_lifecycle_event.reminder_id'");
    expect(source).toContain("'s3api',\n      'list-object-versions'");
    expect(source).toContain("'--version-id'");
    expect(source).toContain('await deleteFixtureObjects({ userIds });');
    expect(source).toContain('if (options.allowEmpty === true) return [];');
    expect(source).toContain('createEncryptedFixtureEnvelope');
    expect(source).toContain('TWO_STEP_REVIEW_CONFIG_ENVELOPE_FILE');
    expect(source).not.toContain('TWO_STEP_REVIEW_CONFIG_FILE');
    expect(source).not.toContain('refreshToken:');
    expect(source).toContain('REMOTE_EVIDENCE_MARKER');
    expect(source).toContain('artifact?.sha256');
    expect(source).toContain('independentlyVerifiedRemoteIdentity');
    expect(source).toContain('temporaryS3ObjectsAllVersionsVerifiedAbsent');
  });
});
