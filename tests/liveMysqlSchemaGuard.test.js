const crypto = require('crypto');

const { createLiveMysqlSchemaGuard } = require('../scripts/lib/live-mysql-schema-guard');

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
  serverHostname = 'DESKTOP-PDFA51K',
  port = 3306,
  currentUser = 'root@172.26.%',
  version = '8.0.40',
  omitObject = null,
  forbiddenColumn = false,
  wrongForeignKeyOwner = false,
  wrongForeignKeyType = false,
  noUniqueIndex = false,
} = {}) {
  const objects = {
    alpha: {
      type: 'BASE TABLE',
      ddl: "CREATE TABLE `alpha` (`id` bigint NOT NULL, `name` varchar(255) NOT NULL, `status` enum('active','inactive') NOT NULL, PRIMARY KEY (`id`))",
      columns: [column('id', 'bigint'), column('name'), column('status', "enum('active','inactive')")],
      indexes: [{ Table: 'alpha', Key_name: 'PRIMARY', Non_unique: noUniqueIndex ? 1 : 0, Seq_in_index: 1, Column_name: 'id' }],
      constraints: [{ CONSTRAINT_NAME: 'PRIMARY', CONSTRAINT_TYPE: 'PRIMARY KEY' }],
      constraintColumns: [{
        CONSTRAINT_NAME: 'PRIMARY',
        COLUMN_NAME: 'id',
        REFERENCED_TABLE_NAME: null,
        REFERENCED_COLUMN_NAME: null,
        ORDINAL_POSITION: 1,
      }],
    },
    beta: {
      type: 'BASE TABLE',
      ddl: 'CREATE TABLE `beta` (`id` bigint NOT NULL, `alpha_id` bigint NOT NULL, `note` varchar(255) NOT NULL, PRIMARY KEY (`id`), CONSTRAINT `fk_beta_alpha` FOREIGN KEY (`alpha_id`) REFERENCES `alpha` (`id`))',
      columns: [column('id', 'bigint'), column('alpha_id', wrongForeignKeyType ? 'varchar(255)' : 'bigint'), column('note')],
      indexes: [
        { Table: 'beta', Key_name: 'PRIMARY', Non_unique: 0, Seq_in_index: 1, Column_name: 'id' },
        { Table: 'beta', Key_name: 'fk_beta_alpha', Non_unique: 1, Seq_in_index: 1, Column_name: 'alpha_id' },
      ],
      constraints: [
        { CONSTRAINT_NAME: 'PRIMARY', CONSTRAINT_TYPE: 'PRIMARY KEY' },
        { CONSTRAINT_NAME: 'fk_beta_alpha', CONSTRAINT_TYPE: 'FOREIGN KEY' },
      ],
      constraintColumns: [
        {
          CONSTRAINT_NAME: 'PRIMARY',
          COLUMN_NAME: 'id',
          REFERENCED_TABLE_NAME: null,
          REFERENCED_COLUMN_NAME: null,
          ORDINAL_POSITION: 1,
        },
        {
          CONSTRAINT_NAME: 'fk_beta_alpha',
          COLUMN_NAME: wrongForeignKeyOwner ? 'id' : 'alpha_id',
          REFERENCED_TABLE_NAME: 'alpha',
          REFERENCED_COLUMN_NAME: 'id',
          ORDINAL_POSITION: 1,
        },
      ],
    },
    alpha_view: {
      type: 'VIEW',
      ddl: 'CREATE ALGORITHM=UNDEFINED VIEW `alpha_view` AS select `alpha`.`id` AS `id`,`alpha`.`name` AS `name` from `alpha`',
      columns: [column('id', 'bigint'), column('name')],
      indexes: [],
      constraints: [],
      constraintColumns: [],
    },
  };
  if (forbiddenColumn) objects.alpha.columns.push(column('retired_field'));
  if (omitObject) delete objects[omitObject];

  const query = jest.fn(async (sql, params = []) => {
    const normalized = String(sql).trim().replace(/\s+/g, ' ');
    if (['START TRANSACTION', 'COMMIT', 'ROLLBACK'].includes(normalized)) {
      return [{ affectedRows: 0 }, []];
    }
    if (normalized === 'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()') {
      return [[{
        'DATABASE()': database,
        '@@hostname': serverHostname,
        '@@port': port,
        'CURRENT_USER()': currentUser,
        'VERSION()': version,
      }], []];
    }
    if (normalized.startsWith('SHOW FULL TABLES FROM `iset_intake` LIKE ?')) {
      const name = params[0];
      return [objects[name] ? [{ Tables_in_iset_intake: name, Table_type: objects[name].type }] : [], []];
    }
    const create = /^SHOW CREATE (TABLE|VIEW) `([^`]+)`$/u.exec(normalized);
    if (create && objects[create[2]]) {
      const label = create[1] === 'VIEW' ? 'Create View' : 'Create Table';
      return [[{ [create[1] === 'VIEW' ? 'View' : 'Table']: create[2], [label]: objects[create[2]].ddl }], []];
    }
    const columns = /^SHOW FULL COLUMNS FROM `([^`]+)`$/u.exec(normalized);
    if (columns && objects[columns[1]]) return [objects[columns[1]].columns, []];
    const indexes = /^SHOW INDEX FROM `([^`]+)`$/u.exec(normalized);
    if (indexes && objects[indexes[1]]) return [objects[indexes[1]].indexes, []];
    if (normalized.includes('FROM information_schema.TABLE_CONSTRAINTS')) {
      return [objects[params[0]]?.constraints || [], []];
    }
    if (normalized.includes('FROM information_schema.KEY_COLUMN_USAGE')) {
      return [objects[params[0]]?.constraintColumns || [], []];
    }
    if (normalized.includes('FROM information_schema.KEYWORDS')) {
      return [params[0] === 'SELECT' ? [{ WORD: 'SELECT', RESERVED: 1 }] : [], []];
    }
    if (normalized.includes('FROM information_schema.columns')) {
      const proof = objects[params[0]]?.columns.find(item => item.Field === params[1]);
      return [proof ? [{ column_type: proof.Type }] : [], []];
    }
    throw new Error(`unexpected raw query: ${normalized}`);
  });
  const execute = jest.fn(async () => [[{ id: 1 }], []]);
  return { query, execute };
}

function createGuard(connection, overrides = {}) {
  return createLiveMysqlSchemaGuard({
    connection,
    expectedIdentity: {
      database: 'iset_intake',
      configuredHost: '172.26.176.1',
      configuredUser: 'root',
      serverHostname: 'DESKTOP-PDFA51K',
      port: 3306,
      currentUser: 'root@172.26.%',
      version: '8.0.40',
    },
    configuredIdentity: {
      host: '172.26.176.1',
      user: 'root',
      database: 'iset_intake',
      port: 3306,
    },
    requiredObjects: [
      { name: 'alpha', type: 'table' },
      { name: 'beta', type: 'table' },
    ],
    optionalObjects: [{ name: 'alpha_view', type: 'view' }],
    allowedOutputAliases: ['safe_alias'],
    allowedTableAliases: ['a', 'b'],
    cryptoModule: crypto,
    ...overrides,
  });
}

describe('reusable live MySQL schema guard', () => {
  test('pins configured/live identity and records one-object structural hashes', async () => {
    const connection = createDriver();
    const guard = createGuard(connection);

    const evidence = await guard.preflight();

    expect(evidence.identity).toEqual(expect.objectContaining({
      database: 'iset_intake',
      host: 'DESKTOP-PDFA51K',
      port: 3306,
      currentUser: 'root@172.26.%',
      version: '8.0.40',
    }));
    expect(evidence.objects.alpha).toEqual(expect.objectContaining({
      type: 'table',
      columnCount: 3,
      constraintCount: 1,
      uniqueIndexCount: 1,
      ddlHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      indexesHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      constraintsHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }));
    expect(evidence.objects.alpha_view.type).toBe('view');
    expect(guard.objectExists('alpha_view', 'view')).toBe(true);
    expect(guard.getObjectProof('beta').constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'fk_beta_alpha',
        columns: ['alpha_id'],
        referencedObject: 'alpha',
        referencedColumns: ['id'],
      }),
    ]));
    expect(guard.getObjectProof('alpha').uniqueIndexes).toEqual({ primary: ['id'] });
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test.each([
    ['database', { database: 'wrong' }, 'schema_guard_wrong_database'],
    ['server hostname', { serverHostname: 'prod-db' }, 'schema_guard_wrong_database_hostname'],
    ['port', { port: 3307 }, 'schema_guard_wrong_database_port'],
    ['principal', { currentUser: 'root@localhost' }, 'schema_guard_wrong_database_principal'],
    ['version', { version: '9.0.1' }, 'schema_guard_database_engine_unverified'],
  ])('wrong live %s fails after native identity only', async (_label, driverOptions, code) => {
    const connection = createDriver(driverOptions);
    const guard = createGuard(connection);

    await expect(guard.preflight()).rejects.toMatchObject({ code });
    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('missing object and wrong configured identity fail before ordinary SQL', async () => {
    const missingConnection = createDriver({ omitObject: 'beta' });
    await expect(createGuard(missingConnection).preflight()).rejects.toMatchObject({
      code: 'schema_guard_required_object_missing',
    });
    expect(missingConnection.execute).not.toHaveBeenCalled();

    const wrongConfigConnection = createDriver();
    const guard = createGuard(wrongConfigConnection, {
      configuredIdentity: {
        host: 'prod-db',
        user: 'root',
        database: 'iset_intake',
        port: 3306,
      },
    });
    await expect(guard.preflight()).rejects.toMatchObject({ code: 'schema_guard_wrong_configured_host' });
    expect(wrongConfigConnection.query).toHaveBeenCalledTimes(1);
    expect(wrongConfigConnection.execute).not.toHaveBeenCalled();
  });

  test('required constraints and retired columns fail closed during preflight', async () => {
    const wrongFkConnection = createDriver({ wrongForeignKeyOwner: true });
    const wrongFkGuard = createGuard(wrongFkConnection, {
      requiredConstraints: [{
        object: 'beta',
        name: 'fk_beta_alpha',
        type: 'foreign_key',
        columns: ['alpha_id'],
        referencedObject: 'alpha',
        referencedColumns: ['id'],
      }],
    });
    await expect(wrongFkGuard.preflight()).rejects.toMatchObject({
      code: 'schema_guard_constraint_columns_mismatch',
    });
    expect(wrongFkConnection.execute).not.toHaveBeenCalled();

    const wrongTypeConnection = createDriver({ wrongForeignKeyType: true });
    const wrongTypeGuard = createGuard(wrongTypeConnection, {
      requiredConstraints: [{
        object: 'beta',
        name: 'fk_beta_alpha',
        type: 'foreign_key',
        columns: ['alpha_id'],
        referencedObject: 'alpha',
        referencedColumns: ['id'],
      }],
    });
    await expect(wrongTypeGuard.preflight()).rejects.toMatchObject({
      code: 'schema_guard_constraint_column_type_mismatch',
    });
    expect(wrongTypeConnection.execute).not.toHaveBeenCalled();

    const retiredConnection = createDriver({ forbiddenColumn: true });
    const retiredGuard = createGuard(retiredConnection, {
      absentColumns: [{ object: 'alpha', name: 'retired_field' }],
    });
    await expect(retiredGuard.preflight()).rejects.toMatchObject({
      code: 'schema_guard_forbidden_column_present',
    });
    expect(retiredConnection.execute).not.toHaveBeenCalled();
  });

  test('optional and explicitly absent objects are proven without ordinary SQL', async () => {
    const connection = createDriver({ omitObject: 'alpha_view' });
    const guard = createGuard(connection, { absentObjects: ['legacy_table'] });
    const evidence = await guard.preflight();

    expect(guard.objectExists('alpha_view', 'view')).toBe(false);
    expect(evidence.optionalAbsentObjects).toEqual(['alpha_view']);
    expect(evidence.absentObjects).toEqual(['legacy_table']);
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('native numeric keyword metadata rejects an allowlisted reserved alias', async () => {
    const connection = createDriver();
    const guard = createGuard(connection, { allowedOutputAliases: ['select'] });

    await expect(guard.preflight()).rejects.toMatchObject({ code: 'schema_guard_alias_reserved' });
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('guarded facade routes helper metadata and ordinary statements through the right boundary', async () => {
    const connection = createDriver();
    const guard = createGuard(connection);
    await guard.preflight();
    const guarded = guard.createGuardedConnection();

    await guarded.query(
      'SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
      ['alpha', 'status']
    );
    await guarded.query('SELECT id, status FROM alpha WHERE status = ?', ['active']);
    await guarded.beginTransaction();
    await guarded.rollback();

    expect(connection.execute).toHaveBeenCalledTimes(1);
    expect(connection.query).toHaveBeenCalledWith('START TRANSACTION');
    expect(connection.query).toHaveBeenCalledWith('ROLLBACK');
    expect(guard.evidence().verifiedStatementCount).toBe(3);
  });

  test.each([
    ['wrong-owner column', 'SELECT `a`.note, `b`.note FROM alpha AS `a` JOIN beta AS `b` ON `b`.alpha_id = `a`.id', [], 'schema_guard_column_wrong_owner'],
    ['unqualified nested column', 'SELECT (SELECT COUNT(*) FROM beta AS `b` WHERE `b`.alpha_id = `a`.id) FROM alpha AS `a` WHERE status = ?', ['active'], 'schema_guard_multitable_column_unqualified'],
    ['bad output alias', 'SELECT COUNT(*) AS select FROM alpha', [], 'schema_guard_output_alias_unquoted'],
    ['unproved quoted output alias', 'SELECT COUNT(*) AS `not_declared` FROM alpha', [], 'schema_guard_output_alias_unverified'],
    ['unproved quoted table alias', 'SELECT `x`.id FROM alpha AS `x`', [], 'schema_guard_table_alias_unverified'],
    ['bad function', 'SELECT mystery(name) FROM alpha', [], 'schema_guard_function_unverified'],
    ['bad enum', 'SELECT id FROM alpha WHERE status = ?', ['retired'], 'schema_guard_enum_value_unverified'],
    ['bad relationship', 'SELECT `a`.id, `b`.note FROM alpha AS `a` JOIN beta AS `b` ON `b`.id = `a`.id', [], 'schema_guard_join_relationship_unverified'],
  ])('%s never reaches the ordinary driver', async (_label, sql, params, code) => {
    const connection = createDriver();
    const guard = createGuard(connection);
    await guard.preflight();

    await expect(guard.execute(sql, params)).rejects.toMatchObject({ code });
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('live-proven but unquoted table/output aliases never reach the ordinary driver', async () => {
    const connection = createDriver();
    const guard = createGuard(connection);
    await guard.preflight();

    await expect(guard.execute('SELECT a.id FROM alpha a')).rejects.toMatchObject({
      code: 'schema_guard_table_alias_unquoted',
    });
    await expect(guard.execute('SELECT COUNT(*) AS safe_alias FROM alpha')).rejects.toMatchObject({
      code: 'schema_guard_output_alias_unquoted',
    });
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('fully qualified join and correlated subquery relationships execute', async () => {
    const connection = createDriver();
    const guard = createGuard(connection);
    await guard.preflight();

    await guard.execute(
      'SELECT `a`.id, `b`.note FROM alpha AS `a` JOIN beta AS `b` ON `b`.alpha_id = `a`.id WHERE `a`.status = ?',
      ['active']
    );
    await guard.execute(
      'SELECT `a`.id, (SELECT COUNT(*) FROM beta AS `b` WHERE `b`.alpha_id = `a`.id) AS `safe_alias` FROM alpha AS `a` WHERE `a`.status = ?',
      ['active']
    );

    expect(connection.execute).toHaveBeenCalledTimes(2);
  });

  test('FOR UPDATE is recognized as pinned MySQL syntax rather than an unqualified column', async () => {
    const connection = createDriver();
    const guard = createGuard(connection);
    await guard.preflight();

    await guard.execute(
      'SELECT id, status FROM alpha WHERE status = ? FOR UPDATE',
      ['active']
    );

    expect(connection.execute).toHaveBeenCalledTimes(1);
  });

  test('INSERT validates required omissions and ON DUPLICATE live unique-key applicability', async () => {
    const connection = createDriver();
    const guard = createGuard(connection);
    await guard.preflight();

    await expect(
      guard.execute('INSERT INTO alpha (name, status) VALUES (?, ?)', ['missing-id', 'active'])
    ).rejects.toMatchObject({ code: 'schema_guard_insert_required_column_omitted' });
    expect(connection.execute).not.toHaveBeenCalled();

    await guard.execute(
      'INSERT INTO alpha (id, name, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = ?',
      [1, 'first', 'active', 'updated']
    );
    expect(connection.execute).toHaveBeenCalledTimes(1);

    const noUniqueConnection = createDriver({ noUniqueIndex: true });
    const noUniqueGuard = createGuard(noUniqueConnection);
    await noUniqueGuard.preflight();
    await expect(noUniqueGuard.execute(
      'INSERT INTO alpha (id, name, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = ?',
      [1, 'first', 'active', 'updated']
    )).rejects.toMatchObject({ code: 'schema_guard_insert_duplicate_key_unverified' });
    expect(noUniqueConnection.execute).not.toHaveBeenCalled();
  });
});
