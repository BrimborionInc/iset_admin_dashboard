'use strict';

const crypto = require('crypto');

function createLiveMysqlSchemaGuard({
  connection,
  expectedIdentity = {},
  configuredIdentity = {},
  requiredObjects = [],
  optionalObjects = [],
  absentObjects = [],
  absentColumns = [],
  requiredConstraints = [],
  requiredRelationships = [],
  allowedFunctions = [],
  allowedOutputAliases = [],
  allowedTableAliases = [],
  onBeforeStatementExecute = null,
  cryptoModule = crypto,
}) {
  if (!connection || typeof connection.query !== 'function' || typeof connection.execute !== 'function') {
    throw new Error('schema_guard_connection_invalid');
  }
  const expectedDatabase = String(expectedIdentity.database || '').trim();
  const expectedHost = String(expectedIdentity.configuredHost || '').trim();
  const expectedUser = String(expectedIdentity.configuredUser || '').trim();
  const expectedDatabaseHostname = String(expectedIdentity.serverHostname || '').trim();
  const expectedPort = Number(expectedIdentity.port);
  const expectedPrincipal = String(expectedIdentity.currentUser || '').trim();
  const expectedVersion = String(expectedIdentity.version || '').trim();
  const configuredDatabase = String(configuredIdentity.database || '').trim();
  const configuredHost = String(configuredIdentity.host || '').trim();
  const configuredUser = String(configuredIdentity.user || '').trim();
  const configuredPort = Number(configuredIdentity.port);
  if (!/^[A-Za-z0-9_]+$/.test(expectedDatabase)) {
    throw new Error('schema_guard_expected_database_invalid');
  }
  if (![expectedHost, expectedUser, expectedDatabaseHostname, expectedPrincipal, expectedVersion, configuredDatabase, configuredHost, configuredUser].every(value => String(value || '').trim())) {
    throw new Error('schema_guard_expected_connection_identity_invalid');
  }
  if (!Number.isInteger(Number(expectedPort)) || Number(expectedPort) <= 0 || Number(configuredPort) !== Number(expectedPort)) {
    throw new Error('schema_guard_expected_connection_port_invalid');
  }
  function normalizeObjectExpectation(value, defaultRequired) {
    const spec = typeof value === 'string' ? { name: value } : { ...(value || {}) };
    const name = String(spec.name || '').trim().toLowerCase();
    const type = String(spec.type || '').trim().toLowerCase() || null;
    if (!/^[A-Za-z0-9_]+$/.test(name) || (type && !['table', 'view'].includes(type))) {
      throw new Error('schema_guard_object_expectation_invalid');
    }
    return { name, type, required: defaultRequired };
  }
  const required = requiredObjects.map(value => normalizeObjectExpectation(value, true));
  const optional = optionalObjects.map(value => normalizeObjectExpectation(value, false));
  const allExpectedObjects = [...required, ...optional];
  if (!allExpectedObjects.length && !absentObjects.length) {
    throw new Error('schema_guard_expected_objects_invalid');
  }
  const duplicateObjectNames = allExpectedObjects
    .map(item => item.name)
    .filter((name, index, names) => names.indexOf(name) !== index);
  if (duplicateObjectNames.length) {
    throw new Error(`schema_guard_object_expectation_duplicate:${duplicateObjectNames.join(',')}`);
  }
  const expectedAbsentObjects = Array.from(new Set(absentObjects.map(value => normalizeObjectExpectation(value, false).name)));

  const IDENTITY_SQL =
    'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()';
  const SQL_KEYWORDS = new Set([
    'add', 'all', 'alter', 'and', 'as', 'asc', 'between', 'by', 'case', 'char',
    'binary', 'collate', 'date', 'day', 'decimal', 'delete', 'desc', 'distinct',
    'duplicate', 'else', 'end', 'escape', 'exists', 'false', 'from', 'group',
    'for', 'having', 'in', 'insert', 'into', 'is', 'join', 'json', 'key', 'left', 'like',
    'limit', 'not', 'null', 'on', 'or', 'order', 'outer', 'regexp', 'right',
    'select', 'set', 'signed', 'then', 'true', 'unsigned', 'update', 'values',
    'when', 'where', 'with', 'year_month', 'interval', 'minute',
  ]);
  const TABLE_ALIAS_STOP_WORDS = new Set([
    'where', 'left', 'right', 'inner', 'outer', 'join', 'on', 'order', 'group',
    'limit', 'set', 'values', 'having', 'union', 'for', 'use', 'force',
  ]);
  const MYSQL_BUILTINS = new Set([
    'cast', 'coalesce', 'count', 'current_date', 'date_add', 'if', 'json_extract',
    'json_unquote', 'json_valid', 'lower', 'max', 'min', 'now', 'round', 'sum',
    'upper', 'values',
    ...allowedFunctions.map(value => String(value || '').trim().toLowerCase()),
  ]);
  const MYSQL_CAST_TARGET_TYPES = new Set([
    'binary', 'char', 'date', 'datetime', 'decimal', 'json', 'signed', 'time', 'unsigned', 'year_month',
  ]);

  const schema = new Map();
  const verifiedFunctions = new Set();
  const discoveredObjects = new Map();
  const optionalAbsentObjects = new Set();
  const provenAbsentObjects = new Set();
  const liveVerifiedAliases = new Set();
  let identity = null;
  let preflightComplete = false;
  let verifiedStatementCount = 0;
  const verifiedStatements = [];

  for (const alias of [...allowedOutputAliases, ...allowedTableAliases]) {
    const normalized = String(alias || '').trim().toLowerCase();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
      throw new Error(`schema_guard_alias_expectation_invalid:${alias}`);
    }
  }

  function guardError(code, details = '') {
    const error = new Error(details ? `${code}: ${details}` : code);
    error.code = code;
    return error;
  }

  function quoteIdentifier(identifier) {
    const value = String(identifier || '');
    if (!/^[A-Za-z0-9_]+$/.test(value)) {
      throw guardError('schema_guard_identifier_invalid', value);
    }
    return `\`${value}\``;
  }

  function normalizeIdentifier(identifier) {
    return String(identifier || '').replace(/^`|`$/g, '').toLowerCase();
  }

  function maskSqlLiterals(sql) {
    const chars = String(sql).split('');
    let quote = null;
    for (let index = 0; index < chars.length; index += 1) {
      const char = chars[index];
      if (quote) {
        if (char === '\\') {
          chars[index] = ' ';
          if (index + 1 < chars.length) chars[++index] = ' ';
          continue;
        }
        if (char === quote) {
          quote = null;
          chars[index] = ' ';
          continue;
        }
        chars[index] = ' ';
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        chars[index] = ' ';
      }
    }
    if (quote) throw guardError('schema_guard_sql_unterminated_literal');
    return chars.join('');
  }

  function parseEnumValues(type) {
    const match = /^enum\((.*)\)$/i.exec(String(type || '').trim());
    if (!match) return null;
    const values = [];
    const pattern = /'((?:''|\\'|[^'])*)'/g;
    let item;
    while ((item = pattern.exec(match[1]))) {
      values.push(item[1].replace(/''/g, "'").replace(/\\'/g, "'"));
    }
    return new Set(values);
  }

  function parseForeignKeys(createSql) {
    const relationships = [];
    const pattern = /FOREIGN\s+KEY\s*\(\s*`?([A-Za-z0-9_]+)`?\s*\)\s+REFERENCES\s+`?([A-Za-z0-9_]+)`?\s*\(\s*`?([A-Za-z0-9_]+)`?\s*\)/gi;
    let match;
    while ((match = pattern.exec(String(createSql || '')))) {
      relationships.push({
        column: normalizeIdentifier(match[1]),
        targetTable: normalizeIdentifier(match[2]),
        targetColumn: normalizeIdentifier(match[3]),
      });
    }
    return relationships;
  }

  function parseCheckAllowedValues(createSql) {
    const allowedByColumn = new Map();
    const pattern = /`?([A-Za-z_][A-Za-z0-9_]*)`?\s+IN\s*\(([^)]*)\)/gi;
    let match;
    while ((match = pattern.exec(String(createSql || '')))) {
      const values = [];
      const valuePattern = /'((?:''|\\'|[^'])*)'/g;
      let valueMatch;
      while ((valueMatch = valuePattern.exec(match[2]))) {
        values.push(valueMatch[1].replace(/''/g, "'").replace(/\\'/g, "'"));
      }
      if (values.length) allowedByColumn.set(normalizeIdentifier(match[1]), new Set(values));
    }
    return allowedByColumn;
  }

  function metadataStatementKind(sql) {
    const normalized = String(sql || '').trim().replace(/\s+/g, ' ');
    if (normalized === IDENTITY_SQL) return 'identity';
    if (/^SHOW FULL TABLES FROM `?[A-Za-z0-9_]+`? LIKE \?$/i.test(normalized)) return 'object';
    if (/^SHOW CREATE TABLE `?[A-Za-z0-9_]+`?$/i.test(normalized)) return 'create';
    if (/^SHOW CREATE VIEW `?[A-Za-z0-9_]+`?$/i.test(normalized)) return 'create';
    if (/^SHOW FULL COLUMNS FROM `?[A-Za-z0-9_]+`?$/i.test(normalized)) return 'columns';
    if (/^SHOW INDEX FROM `?[A-Za-z0-9_]+`?$/i.test(normalized)) return 'indexes';
    if (/^SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE FROM information_schema\.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? ORDER BY CONSTRAINT_NAME$/i.test(normalized)) return 'constraints';
    if (/^SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, ORDINAL_POSITION FROM information_schema\.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE\(\) AND TABLE_NAME = \? ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION$/i.test(normalized)) return 'constraint-columns';
    if (/^SELECT WORD, RESERVED FROM information_schema\.KEYWORDS WHERE WORD = \?$/i.test(normalized)) return 'keyword';
    if (/^SELECT column_type FROM information_schema\.columns WHERE table_schema = DATABASE\(\) AND table_name = \? AND column_name = \? LIMIT 1$/i.test(normalized)) return 'column-type';
    return null;
  }

  async function metadataQuery(sql, params = []) {
    const kind = metadataStatementKind(sql);
    if (!kind) {
      throw guardError('schema_guard_raw_query_not_metadata', String(sql).slice(0, 120));
    }
    const values = Array.isArray(params) ? params : [];
    if (kind === 'identity' && values.length) {
      throw guardError('schema_guard_metadata_parameter_count_mismatch');
    }
    if (kind === 'object') {
      if (values.length !== 1 || !allExpectedObjects.concat(expectedAbsentObjects.map(name => ({ name }))).some(item => item.name === normalizeIdentifier(values[0]))) {
        throw guardError('schema_guard_metadata_object_not_expected', String(values[0] || 'unknown'));
      }
    }
    if (['create', 'columns', 'indexes'].includes(kind)) {
      const match = /(?:TABLE|VIEW|FROM)\s+`?([A-Za-z0-9_]+)`?$/i.exec(String(sql).trim());
      const objectName = normalizeIdentifier(match?.[1]);
      if (!objectName || !discoveredObjects.has(objectName)) {
        throw guardError('schema_guard_metadata_object_not_discovered', objectName || 'unknown');
      }
    }
    if (['constraints', 'constraint-columns'].includes(kind)) {
      const objectName = normalizeIdentifier(values[0]);
      if (values.length !== 1 || !discoveredObjects.has(objectName)) {
        throw guardError('schema_guard_metadata_object_not_discovered', objectName || 'unknown');
      }
    }
    if (kind === 'keyword') {
      if (values.length !== 1 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(values[0] || ''))) {
        throw guardError('schema_guard_metadata_alias_invalid', String(values[0] || 'unknown'));
      }
    }
    if (kind === 'column-type') {
      const objectName = normalizeIdentifier(values[0]);
      const columnName = normalizeIdentifier(values[1]);
      if (values.length !== 2 || !schema.get(objectName)?.columns.has(columnName)) {
        throw guardError('schema_guard_metadata_column_not_discovered', `${objectName}.${columnName}`);
      }
    }
    return values.length ? connection.query(sql, values) : connection.query(sql);
  }

  function extractTableRefs(maskedSql) {
    const refs = [];
    const patterns = [
      /^\s*INSERT\s+INTO\s+((?:`?[A-Za-z0-9_]+`?\.)?`?[A-Za-z0-9_]+`?)/gi,
      /^\s*UPDATE\s+((?:`?[A-Za-z0-9_]+`?\.)?`?[A-Za-z0-9_]+`?)(?:\s+(?:AS\s+)?(`?[A-Za-z_][A-Za-z0-9_]*`?))?/gi,
      /\b(?:FROM|JOIN)\s+((?:`?[A-Za-z0-9_]+`?\.)?`?[A-Za-z0-9_]+`?)(?:\s+(?:AS\s+)?(`?[A-Za-z_][A-Za-z0-9_]*`?))?/gi,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(maskedSql))) {
        const parts = match[1].split('.').map(normalizeIdentifier);
        const database = parts.length === 2 ? parts[0] : null;
        const table = parts[parts.length - 1];
        const rawAlias = String(match[2] || '');
        let alias = normalizeIdentifier(rawAlias || table);
        if (TABLE_ALIAS_STOP_WORDS.has(alias)) alias = table;
        refs.push({
          database,
          table,
          alias,
          aliasDeclared: Boolean(rawAlias) && alias !== table,
          aliasQuoted: rawAlias.startsWith('`') && rawAlias.endsWith('`'),
        });
      }
    }
    return refs;
  }

  function isVerifiedCastTypeReference(maskedSql, asIndex, token) {
    if (!MYSQL_CAST_TARGET_TYPES.has(normalizeIdentifier(token))) return false;
    let nestedDepth = 0;
    for (let index = asIndex - 1; index >= 0; index -= 1) {
      if (maskedSql[index] === ')') {
        nestedDepth += 1;
        continue;
      }
      if (maskedSql[index] !== '(') continue;
      if (nestedDepth > 0) {
        nestedDepth -= 1;
        continue;
      }
      const functionMatch = /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(maskedSql.slice(0, index));
      return normalizeIdentifier(functionMatch?.[1]) === 'cast';
    }
    return false;
  }

  function resolveColumnOwner(ref, aliasMap, tables) {
    const parts = String(ref || '').replace(/`/g, '').split('.').map(normalizeIdentifier);
    if (parts.length === 2) {
      const table = aliasMap.get(parts[0]);
      if (!table) throw guardError('schema_guard_unknown_alias', parts[0]);
      return { table, column: parts[1] };
    }
    const column = parts[0];
    const owners = tables.filter(table => schema.get(table)?.columns.has(column));
    if (owners.length !== 1) {
      throw guardError(
        owners.length ? 'schema_guard_unqualified_column_ambiguous' : 'schema_guard_column_not_found',
        `${column} (${owners.join(',') || 'no owner'})`
      );
    }
    return { table: owners[0], column };
  }

  function assertColumn(table, column) {
    const tableProof = schema.get(table);
    if (!tableProof) throw guardError('schema_guard_table_unverified', table);
    if (!tableProof.columns.has(column)) {
      throw guardError('schema_guard_column_wrong_owner', `${table}.${column}`);
    }
  }

  function relationshipIsProven(left, right) {
    const leftProof = schema.get(left.table);
    const rightProof = schema.get(right.table);
    return (
      leftProof.foreignKeys.some(fk => (
        fk.column === left.column && fk.targetTable === right.table && fk.targetColumn === right.column
      )) ||
      rightProof.foreignKeys.some(fk => (
        fk.column === right.column && fk.targetTable === left.table && fk.targetColumn === left.column
      ))
    );
  }

  function assertJoinCollation(left, right) {
    const leftCollation = schema.get(left.table)?.columns.get(left.column)?.collation || null;
    const rightCollation = schema.get(right.table)?.columns.get(right.column)?.collation || null;
    if (leftCollation && rightCollation && leftCollation !== rightCollation) {
      throw guardError(
        'schema_guard_join_collation_mismatch',
        `${left.table}.${left.column}(${leftCollation})/${right.table}.${right.column}(${rightCollation})`
      );
    }
  }

  function validateJoins(maskedSql, aliasMap) {
    const joinPattern = /\bJOIN\s+((?:`?[A-Za-z0-9_]+`?\.)?`?[A-Za-z0-9_]+`?)(?:\s+(?:AS\s+)?(`?[A-Za-z_][A-Za-z0-9_]*`?))?\s+ON\s+([\s\S]*?)(?=\b(?:LEFT|RIGHT|INNER|OUTER)?\s*JOIN\b|\bWHERE\b|\bGROUP\b|\bORDER\b|\bLIMIT\b|$)/gi;
    let join;
    while ((join = joinPattern.exec(maskedSql))) {
      const onClause = join[3];
      const equalityPattern = /(`?[A-Za-z_][A-Za-z0-9_]*`?\.`?[A-Za-z_][A-Za-z0-9_]*`?)\s*=\s*(`?[A-Za-z_][A-Za-z0-9_]*`?\.`?[A-Za-z_][A-Za-z0-9_]*`?)/gi;
      let equality;
      let relationshipFound = false;
      while ((equality = equalityPattern.exec(onClause))) {
        const left = resolveColumnOwner(equality[1], aliasMap, []);
        const right = resolveColumnOwner(equality[2], aliasMap, []);
        assertColumn(left.table, left.column);
        assertColumn(right.table, right.column);
        assertJoinCollation(left, right);
        if (left.table !== right.table && relationshipIsProven(left, right)) relationshipFound = true;
      }
      if (!relationshipFound) {
        throw guardError('schema_guard_join_relationship_unverified', join[1].replace(/`/g, ''));
      }
    }
  }

  function validateCrossObjectRelationships(maskedSql, aliasMap) {
    const equalityPattern = /(`?[A-Za-z_][A-Za-z0-9_]*`?\.`?[A-Za-z_][A-Za-z0-9_]*`?)\s*=\s*(`?[A-Za-z_][A-Za-z0-9_]*`?\.`?[A-Za-z_][A-Za-z0-9_]*`?)/gi;
    let equality;
    while ((equality = equalityPattern.exec(maskedSql))) {
      const left = resolveColumnOwner(equality[1], aliasMap, []);
      const right = resolveColumnOwner(equality[2], aliasMap, []);
      assertColumn(left.table, left.column);
      assertColumn(right.table, right.column);
      if (left.table === right.table) continue;
      assertJoinCollation(left, right);
      if (!relationshipIsProven(left, right)) {
        throw guardError(
          'schema_guard_cross_object_relationship_unverified',
          `${left.table}.${left.column}/${right.table}.${right.column}`
        );
      }
    }
  }

  function questionIndexBefore(maskedSql, position) {
    return (maskedSql.slice(0, position).match(/\?/g) || []).length;
  }

  function validateEnumValue(owner, value) {
    const allowedValues = schema.get(owner.table)?.columns.get(owner.column)?.allowedValues;
    if (allowedValues && !allowedValues.has(String(value))) {
      throw guardError('schema_guard_enum_value_unverified', `${owner.table}.${owner.column}=${value}`);
    }
  }

  function validateEnumComparisons(sql, maskedSql, aliasMap, tables, params) {
    const comparisonPattern = /(`?[A-Za-z_][A-Za-z0-9_]*`?(?:\.`?[A-Za-z_][A-Za-z0-9_]*`?)?)\s*(?:=|<>|!=)\s*(\?|'(?:''|\\'|[^'])*')/gi;
    let match;
    while ((match = comparisonPattern.exec(sql))) {
      const owner = resolveColumnOwner(match[1], aliasMap, tables);
      assertColumn(owner.table, owner.column);
      const rawValue = match[2];
      const value = rawValue === '?'
        ? params[questionIndexBefore(maskedSql, match.index + match[0].lastIndexOf('?'))]
        : rawValue.slice(1, -1).replace(/''/g, "'").replace(/\\'/g, "'");
      validateEnumValue(owner, value);
    }
    const reversedComparisonPattern = /(\?|'(?:''|\\'|[^'])*')\s*(?:=|<>|!=)\s*(`?[A-Za-z_][A-Za-z0-9_]*`?(?:\.`?[A-Za-z_][A-Za-z0-9_]*`?)?)/gi;
    while ((match = reversedComparisonPattern.exec(sql))) {
      const owner = resolveColumnOwner(match[2], aliasMap, tables);
      assertColumn(owner.table, owner.column);
      const rawValue = match[1];
      const value = rawValue === '?'
        ? params[questionIndexBefore(maskedSql, match.index)]
        : rawValue.slice(1, -1).replace(/''/g, "'").replace(/\\'/g, "'");
      validateEnumValue(owner, value);
    }
    const inPattern = /(`?[A-Za-z_][A-Za-z0-9_]*`?(?:\.`?[A-Za-z_][A-Za-z0-9_]*`?)?)\s+(?:NOT\s+)?IN\s*\(([^)]*)\)/gi;
    while ((match = inPattern.exec(sql))) {
      const owner = resolveColumnOwner(match[1], aliasMap, tables);
      assertColumn(owner.table, owner.column);
      const allowedValues = schema.get(owner.table)?.columns.get(owner.column)?.allowedValues;
      if (!allowedValues) continue;
      const listStart = match.index + match[0].indexOf('(') + 1;
      const itemPattern = /\?|'(?:''|\\'|[^'])*'/g;
      let item;
      while ((item = itemPattern.exec(match[2]))) {
        const value = item[0] === '?'
          ? params[questionIndexBefore(maskedSql, listStart + item.index)]
          : item[0].slice(1, -1).replace(/''/g, "'").replace(/\\'/g, "'");
        validateEnumValue(owner, value);
      }
    }
  }

  function findClosingParen(sql, openingIndex) {
    let depth = 0;
    let quote = null;
    for (let index = openingIndex; index < sql.length; index += 1) {
      const char = sql[index];
      if (quote) {
        if (char === '\\') {
          index += 1;
          continue;
        }
        if (char === quote) quote = null;
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        continue;
      }
      if (char === '(') depth += 1;
      else if (char === ')' && --depth === 0) return index;
    }
    return -1;
  }

  function splitTopLevelList(text) {
    const values = [];
    let start = 0;
    let depth = 0;
    let quote = null;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quote) {
        if (char === '\\') index += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "'" || char === '"') quote = char;
      else if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      else if (char === ',' && depth === 0) {
        values.push({ value: text.slice(start, index).trim(), offset: start });
        start = index + 1;
      }
    }
    values.push({ value: text.slice(start).trim(), offset: start });
    return values;
  }

  function validateInsertEnums(sql, maskedSql, refs, params) {
    if (!/^INSERT\b/i.test(sql)) return;
    const target = refs[0]?.table;
    if (!target) throw guardError('schema_guard_insert_target_missing');
    const intoMatch = /\bINSERT\s+INTO\s+(?:`?[A-Za-z0-9_]+`?\.)?`?[A-Za-z0-9_]+`?/i.exec(sql);
    const columnsOpen = sql.indexOf('(', intoMatch ? intoMatch.index + intoMatch[0].length : 0);
    const columnsClose = findClosingParen(sql, columnsOpen);
    const valuesMatch = /\bVALUES\s*/i.exec(sql.slice(columnsClose + 1));
    if (columnsOpen < 0 || columnsClose < 0 || !valuesMatch) {
      throw guardError('schema_guard_insert_shape_unverified');
    }
    const valuesKeywordEnd = columnsClose + 1 + valuesMatch.index + valuesMatch[0].length;
    const columns = splitTopLevelList(sql.slice(columnsOpen + 1, columnsClose));
    columns.forEach((columnSpec) => {
      const column = normalizeIdentifier(columnSpec.value);
      assertColumn(target, column);
    });
    const insertedColumns = new Set(columns.map(columnSpec => normalizeIdentifier(columnSpec.value)));
    const missingRequiredColumns = Array.from(schema.get(target).columns.entries())
      .filter(([column, proof]) => (
        !insertedColumns.has(column) &&
        !proof.nullable &&
        proof.defaultValue == null &&
        !/(?:auto_increment|default_generated|virtual generated|stored generated)/iu.test(proof.extra)
      ))
      .map(([column]) => column);
    if (missingRequiredColumns.length) {
      throw guardError(
        'schema_guard_insert_required_column_omitted',
        `${target}:${missingRequiredColumns.join(',')}`
      );
    }
    let cursor = valuesKeywordEnd;
    let tupleCount = 0;
    for (;;) {
      while (/\s/.test(sql[cursor] || '')) cursor += 1;
      if (sql[cursor] !== '(') {
        throw guardError('schema_guard_insert_values_unverified', `expected tuple at ${cursor}`);
      }
      const valuesOpen = cursor;
      const valuesClose = findClosingParen(sql, valuesOpen);
      if (valuesClose < 0) throw guardError('schema_guard_insert_values_unverified');
      const values = splitTopLevelList(sql.slice(valuesOpen + 1, valuesClose));
      if (columns.length !== values.length) {
        throw guardError('schema_guard_insert_column_value_mismatch', `${columns.length}/${values.length}`);
      }
      columns.forEach((columnSpec, index) => {
        const column = normalizeIdentifier(columnSpec.value);
        const allowedValues = schema.get(target)?.columns.get(column)?.allowedValues;
        if (!allowedValues) return;
        const expression = values[index].value;
        let value;
        if (expression === '?') {
          value = params[questionIndexBefore(maskedSql, valuesOpen + 1 + values[index].offset)];
        } else if (/^'(?:''|\\'|[^'])*'$/.test(expression)) {
          value = expression.slice(1, -1).replace(/''/g, "'").replace(/\\'/g, "'");
        } else {
          throw guardError('schema_guard_enum_expression_unverified', `${target}.${column}`);
        }
        validateEnumValue({ table: target, column }, value);
      });
      tupleCount += 1;
      cursor = valuesClose + 1;
      while (/\s/.test(sql[cursor] || '')) cursor += 1;
      if (sql[cursor] === ',') {
        cursor += 1;
        continue;
      }
      const remainder = sql.slice(cursor).trim();
      if (remainder) {
        const duplicatePrefix = /^ON\s+DUPLICATE\s+KEY\s+UPDATE\b/i.exec(remainder);
        if (!duplicatePrefix) {
          throw guardError('schema_guard_insert_trailing_expression_unverified', remainder.slice(0, 80));
        }
        const applicableUniqueIndex = Array.from(schema.get(target).uniqueIndexes.values())
          .some(indexColumns => indexColumns.length && indexColumns.every(column => insertedColumns.has(column)));
        if (!applicableUniqueIndex) {
          throw guardError('schema_guard_insert_duplicate_key_unverified', target);
        }
        const assignmentText = remainder.slice(duplicatePrefix[0].length).trim();
        if (!assignmentText) throw guardError('schema_guard_insert_duplicate_assignment_missing');
        const assignmentStart = cursor + remainder.indexOf(assignmentText);
        for (const assignment of splitTopLevelList(assignmentText)) {
          const equals = assignment.value.indexOf('=');
          if (equals < 1) throw guardError('schema_guard_insert_duplicate_assignment_unverified', assignment.value);
          const lhsParts = assignment.value.slice(0, equals).trim().replace(/`/g, '').split('.');
          if (lhsParts.length > 2 || (lhsParts.length === 2 && normalizeIdentifier(lhsParts[0]) !== target)) {
            throw guardError('schema_guard_insert_duplicate_target_unverified', assignment.value.slice(0, equals).trim());
          }
          const column = normalizeIdentifier(lhsParts[lhsParts.length - 1]);
          assertColumn(target, column);
          const allowedValues = schema.get(target)?.columns.get(column)?.allowedValues;
          if (!allowedValues) continue;
          const expression = assignment.value.slice(equals + 1).trim();
          const expressionOffset = assignmentStart + assignment.offset + equals + 1;
          let value;
          if (expression === '?') {
            value = params[questionIndexBefore(maskedSql, expressionOffset)];
          } else if (/^'(?:''|\\'|[^'])*'$/.test(expression)) {
            value = expression.slice(1, -1).replace(/''/g, "'").replace(/\\'/g, "'");
          } else {
            throw guardError('schema_guard_enum_expression_unverified', `${target}.${column}`);
          }
          validateEnumValue({ table: target, column }, value);
        }
      }
      break;
    }
    if (!tupleCount) throw guardError('schema_guard_insert_values_unverified');
  }

  function validateUpdateEnums(sql, maskedSql, refs, aliasMap, tables, params) {
    if (!/^UPDATE\b/i.test(sql)) return;
    const target = refs[0]?.table;
    if (!target) throw guardError('schema_guard_update_target_missing');
    const setMatch = /\bSET\b/i.exec(maskedSql);
    if (!setMatch) throw guardError('schema_guard_update_set_missing');
    const whereMatch = /\bWHERE\b/i.exec(maskedSql.slice(setMatch.index + setMatch[0].length));
    const setStart = setMatch.index + setMatch[0].length;
    const setEnd = whereMatch ? setStart + whereMatch.index : sql.length;
    const assignments = splitTopLevelList(sql.slice(setStart, setEnd));
    for (const assignment of assignments) {
      const equals = assignment.value.indexOf('=');
      if (equals < 1) throw guardError('schema_guard_update_assignment_unverified', assignment.value);
      const owner = resolveColumnOwner(assignment.value.slice(0, equals).trim(), aliasMap, tables);
      assertColumn(owner.table, owner.column);
      const allowedValues = schema.get(owner.table)?.columns.get(owner.column)?.allowedValues;
      if (!allowedValues) continue;
      const expression = assignment.value.slice(equals + 1).trim();
      const expressionOffset = setStart + assignment.offset + equals + 1;
      let value;
      if (expression === '?') {
        value = params[questionIndexBefore(maskedSql, expressionOffset)];
      } else if (/^'(?:''|\\'|[^'])*'$/.test(expression)) {
        value = expression.slice(1, -1).replace(/''/g, "'").replace(/\\'/g, "'");
      } else {
        throw guardError('schema_guard_enum_expression_unverified', `${owner.table}.${owner.column}`);
      }
      validateEnumValue(owner, value);
    }
  }

  function validateStatement(sql, params = []) {
    if (!preflightComplete) throw guardError('schema_guard_preflight_incomplete');
    const text = String(sql || '').trim();
    if (!text || /;/.test(maskSqlLiterals(text))) {
      throw guardError('schema_guard_statement_shape_invalid');
    }
    const control = text.toUpperCase().replace(/\s+/g, ' ');
    if (['START TRANSACTION', 'COMMIT', 'ROLLBACK'].includes(control)) return;
    if (!/^(SELECT|INSERT|UPDATE|DELETE)\b/i.test(text)) {
      throw guardError('schema_guard_statement_type_forbidden', control.split(' ')[0]);
    }
    const maskedWithIdentifiers = maskSqlLiterals(text);
    const masked = maskedWithIdentifiers.replace(/`/g, '');
    const placeholderCount = (masked.match(/\?/g) || []).length;
    if (placeholderCount !== params.length) {
      throw guardError('schema_guard_parameter_count_mismatch', `${placeholderCount} placeholders / ${params.length} params`);
    }
    const refs = extractTableRefs(maskedWithIdentifiers);
    if (!refs.length) throw guardError('schema_guard_statement_has_no_table');
    const aliasMap = new Map();
    const tables = [];
    const objectReferenceCounts = new Map();
    for (const ref of refs) {
      if (ref.database && ref.database !== normalizeIdentifier(expectedDatabase)) {
        throw guardError('schema_guard_cross_database_reference', `${ref.database}.${ref.table}`);
      }
      if (!schema.has(ref.table)) throw guardError('schema_guard_table_unverified', ref.table);
      objectReferenceCounts.set(ref.table, (objectReferenceCounts.get(ref.table) || 0) + 1);
      if (ref.aliasDeclared && !ref.aliasQuoted) {
        throw guardError('schema_guard_table_alias_unquoted', ref.alias);
      }
      if (ref.aliasDeclared && !liveVerifiedAliases.has(ref.alias)) {
        throw guardError('schema_guard_table_alias_unverified', ref.alias);
      }
      aliasMap.set(ref.alias, ref.table);
      aliasMap.set(ref.table, ref.table);
      if (!tables.includes(ref.table)) tables.push(ref.table);
    }
    for (const [table, count] of objectReferenceCounts) {
      if (count > 1 && refs.some(ref => ref.table === table && !ref.aliasDeclared)) {
        throw guardError('schema_guard_repeated_table_alias_required', table);
      }
    }

    const outputAliases = new Set();
    for (const match of maskedWithIdentifiers.matchAll(/\bAS\s+(`[^`]+`|[A-Za-z_][A-Za-z0-9_]*)/gi)) {
      const rawAlias = match[1];
      if (!rawAlias.startsWith('`') && isVerifiedCastTypeReference(maskedWithIdentifiers, match.index, rawAlias)) continue;
      if (!rawAlias.startsWith('`')) throw guardError('schema_guard_output_alias_unquoted', rawAlias);
      const alias = rawAlias.slice(1, -1);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
        throw guardError('schema_guard_output_alias_invalid', alias);
      }
      const normalizedAlias = normalizeIdentifier(alias);
      if (!liveVerifiedAliases.has(normalizedAlias)) {
        throw guardError('schema_guard_output_alias_unverified', rawAlias);
      }
      outputAliases.add(normalizedAlias);
    }
    const tableDeclarationMatches = [
      ...masked.matchAll(/\b(?:FROM|JOIN|INSERT\s+INTO|DELETE\s+FROM)\s+(?:[A-Za-z0-9_]+\.)?[A-Za-z0-9_]+/gi),
      ...masked.matchAll(/^\s*UPDATE\s+(?:[A-Za-z0-9_]+\.)?[A-Za-z0-9_]+/gi),
    ];
    const tableDeclarationRanges = tableDeclarationMatches
      .map(match => ({ start: match.index, end: match.index + match[0].length }));
    const functions = new Set();
    for (const match of masked.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
      const name = normalizeIdentifier(match[1]);
      if (tableDeclarationRanges.some(range => match.index >= range.start && match.index < range.end)) continue;
      if (SQL_KEYWORDS.has(name)) continue;
      if (!MYSQL_BUILTINS.has(name)) throw guardError('schema_guard_function_unverified', name);
      functions.add(name);
      verifiedFunctions.add(name);
    }

    for (const match of masked.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
      const alias = normalizeIdentifier(match[1]);
      const column = normalizeIdentifier(match[2]);
      if (alias === normalizeIdentifier(expectedDatabase) && schema.has(column)) continue;
      const table = aliasMap.get(alias);
      if (!table) throw guardError('schema_guard_unknown_alias', alias);
      assertColumn(table, column);
    }

    let unqualified = masked;
    unqualified = unqualified.replace(/\b[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*\b/g, ' ');
    unqualified = unqualified.replace(/\b(?:FROM|JOIN)\s+(?:[A-Za-z0-9_]+\.)?[A-Za-z0-9_]+(?:\s+(?:AS\s+)?[A-Za-z_][A-Za-z0-9_]*)?/gi, ' ');
    unqualified = unqualified.replace(/\bINSERT\s+INTO\s+(?:[A-Za-z0-9_]+\.)?[A-Za-z0-9_]+/gi, ' ');
    unqualified = unqualified.replace(/^\s*UPDATE\s+(?:[A-Za-z0-9_]+\.)?[A-Za-z0-9_]+(?:\s+(?:AS\s+)?[A-Za-z_][A-Za-z0-9_]*)?/i, ' ');
    unqualified = unqualified.replace(/\bDELETE\s+FROM\s+(?:[A-Za-z0-9_]+\.)?[A-Za-z0-9_]+(?:\s+(?:AS\s+)?[A-Za-z_][A-Za-z0-9_]*)?/gi, ' ');
    const exclusions = new Set([
      ...SQL_KEYWORDS,
      ...functions,
      ...outputAliases,
      ...tables,
      ...aliasMap.keys(),
    ]);
    for (const match of unqualified.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
      const token = normalizeIdentifier(match[1]);
      if (exclusions.has(token)) continue;
      if (refs.length > 1) {
        throw guardError('schema_guard_multitable_column_unqualified', token);
      }
      const owner = resolveColumnOwner(token, aliasMap, tables);
      assertColumn(owner.table, owner.column);
    }

    validateJoins(masked, aliasMap);
    validateCrossObjectRelationships(masked, aliasMap);
    validateEnumComparisons(text, maskedWithIdentifiers, aliasMap, tables, params);
    validateInsertEnums(text, maskedWithIdentifiers, refs, params);
    validateUpdateEnums(text, maskedWithIdentifiers, refs, aliasMap, tables, params);
    return {
      tables: [...tables].sort(),
      functions: [...functions].sort(),
    };
  }

  function nativeValue(row, label) {
    if (!row || typeof row !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(row, label)) return row[label];
    const key = Object.keys(row).find(candidate => candidate.toLowerCase() === label.toLowerCase());
    return key ? row[key] : null;
  }

  function sha256(value) {
    return cryptoModule.createHash('sha256').update(String(value)).digest('hex');
  }

  function ddlIdentity(type, rawDdl) {
    const rawDdlHash = sha256(rawDdl);
    if (type !== 'table') {
      return {
        rawDdl,
        rawDdlHash,
        structuralDdlHash: rawDdlHash,
        volatileDdlOptions: [],
      };
    }
    const pattern = /(\) ENGINE=InnoDB AUTO_INCREMENT=)([1-9][0-9]*)( DEFAULT CHARSET=)/gu;
    const matches = Array.from(rawDdl.matchAll(pattern));
    if (matches.length > 1) {
      throw guardError('schema_guard_volatile_ddl_option_ambiguous', 'AUTO_INCREMENT');
    }
    if (matches.length === 0) {
      return {
        rawDdl,
        rawDdlHash,
        structuralDdlHash: rawDdlHash,
        volatileDdlOptions: [],
      };
    }
    const observedValue = matches[0][2];
    const structuralDdl = rawDdl.replace(pattern, '$1<VOLATILE_COUNTER>$3');
    return {
      rawDdl,
      rawDdlHash,
      structuralDdlHash: sha256(structuralDdl),
      volatileDdlOptions: [{
        name: 'AUTO_INCREMENT',
        observedValue,
        source: 'SHOW CREATE TABLE',
        scope: 'InnoDB table option between ENGINE and DEFAULT CHARSET',
      }],
    };
  }

  async function proveAlias(alias) {
    const normalized = normalizeIdentifier(alias);
    const [rows] = await metadataQuery(
      'SELECT WORD, RESERVED FROM information_schema.KEYWORDS WHERE WORD = ?',
      [normalized.toUpperCase()]
    );
    const reserved = (rows || []).some((row) => {
      const value = nativeValue(row, 'RESERVED');
      return value === 1 || ['1', 'YES', 'Y', 'TRUE'].includes(String(value ?? '').trim().toUpperCase());
    });
    if (reserved) throw guardError('schema_guard_alias_reserved', normalized);
    liveVerifiedAliases.add(normalized);
  }

  function constraintProofFromRows(constraintRows, constraintColumnRows) {
    const constraints = new Map();
    for (const row of constraintRows || []) {
      const name = normalizeIdentifier(nativeValue(row, 'CONSTRAINT_NAME'));
      if (!name) continue;
      constraints.set(name, {
        name,
        type: String(nativeValue(row, 'CONSTRAINT_TYPE') || '').trim().toUpperCase(),
        columns: [],
        referencedObject: null,
        referencedColumns: [],
      });
    }
    for (const row of constraintColumnRows || []) {
      const name = normalizeIdentifier(nativeValue(row, 'CONSTRAINT_NAME'));
      if (!name || !constraints.has(name)) continue;
      const proof = constraints.get(name);
      const column = normalizeIdentifier(nativeValue(row, 'COLUMN_NAME'));
      const referencedObject = normalizeIdentifier(nativeValue(row, 'REFERENCED_TABLE_NAME'));
      const referencedColumn = normalizeIdentifier(nativeValue(row, 'REFERENCED_COLUMN_NAME'));
      if (column) proof.columns.push(column);
      if (referencedObject) proof.referencedObject = referencedObject;
      if (referencedColumn) proof.referencedColumns.push(referencedColumn);
    }
    return constraints;
  }

  function uniqueIndexProofFromRows(indexRows) {
    const indexes = new Map();
    for (const row of indexRows || []) {
      const name = normalizeIdentifier(nativeValue(row, 'Key_name'));
      const column = normalizeIdentifier(nativeValue(row, 'Column_name'));
      const nonUnique = Number(nativeValue(row, 'Non_unique'));
      const sequence = Number(nativeValue(row, 'Seq_in_index')) || 0;
      if (!name || !column || nonUnique !== 0 || sequence < 1) continue;
      if (!indexes.has(name)) indexes.set(name, []);
      indexes.get(name).push({ column, sequence });
    }
    return new Map(Array.from(indexes.entries()).map(([name, entries]) => [
      name,
      entries.sort((left, right) => left.sequence - right.sequence).map(entry => entry.column),
    ]));
  }

  async function discoverObject(expectation) {
    const [objectRows] = await metadataQuery(
      `SHOW FULL TABLES FROM ${quoteIdentifier(expectedDatabase)} LIKE ?`,
      [expectation.name]
    );
    if (!Array.isArray(objectRows) || objectRows.length === 0) {
      if (expectation.required) throw guardError('schema_guard_required_object_missing', expectation.name);
      optionalAbsentObjects.add(expectation.name);
      return false;
    }
    if (objectRows.length !== 1) throw guardError('schema_guard_object_discovery_ambiguous', expectation.name);
    const values = Object.values(objectRows[0]);
    const discoveredName = normalizeIdentifier(values[0]);
    const nativeType = String(values[1] || '').trim().toUpperCase();
    const type = nativeType === 'VIEW' ? 'view' : nativeType === 'BASE TABLE' ? 'table' : null;
    if (discoveredName !== expectation.name || !type) {
      throw guardError('schema_guard_object_discovery_invalid', `${expectation.name}:${discoveredName}:${nativeType}`);
    }
    if (expectation.type && type !== expectation.type) {
      throw guardError('schema_guard_object_type_mismatch', `${expectation.name}:${type}`);
    }
    discoveredObjects.set(expectation.name, type);

    const createKind = type === 'view' ? 'VIEW' : 'TABLE';
    const [createRows] = await metadataQuery(`SHOW CREATE ${createKind} ${quoteIdentifier(expectation.name)}`);
    const createRow = Array.isArray(createRows) ? createRows[0] : null;
    const createSql = nativeValue(createRow, type === 'view' ? 'Create View' : 'Create Table');
    if (!createSql) throw guardError('schema_guard_create_object_missing', expectation.name);
    const [columnRows] = await metadataQuery(`SHOW FULL COLUMNS FROM ${quoteIdentifier(expectation.name)}`);
    if (!Array.isArray(columnRows) || !columnRows.length) {
      throw guardError('schema_guard_full_columns_missing', expectation.name);
    }
    const [indexRows] = type === 'table'
      ? await metadataQuery(`SHOW INDEX FROM ${quoteIdentifier(expectation.name)}`)
      : [[], []];
    const [constraintRows] = type === 'table'
      ? await metadataQuery(
        'SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY CONSTRAINT_NAME',
        [expectation.name]
      )
      : [[], []];
    const [constraintColumnRows] = type === 'table'
      ? await metadataQuery(
        'SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, ORDINAL_POSITION FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION',
        [expectation.name]
      )
      : [[], []];

    const columns = new Map();
    const checkAllowedValues = parseCheckAllowedValues(createSql);
    for (const columnRow of columnRows) {
      const name = normalizeIdentifier(nativeValue(columnRow, 'Field'));
      if (!name) throw guardError('schema_guard_full_column_name_missing', expectation.name);
      const typeText = String(nativeValue(columnRow, 'Type') || '');
      const enumValues = parseEnumValues(typeText);
      columns.set(name, {
        type: typeText,
        collation: nativeValue(columnRow, 'Collation') || null,
        allowedValues: enumValues || checkAllowedValues.get(name) || null,
        nullable: String(nativeValue(columnRow, 'Null') || '').toUpperCase() === 'YES',
        defaultValue: nativeValue(columnRow, 'Default'),
        extra: String(nativeValue(columnRow, 'Extra') || '').toLowerCase(),
      });
    }
    const constraints = constraintProofFromRows(constraintRows, constraintColumnRows);
    const uniqueIndexes = uniqueIndexProofFromRows(indexRows);
    const foreignKeys = Array.from(constraints.values())
      .filter(item => item.type === 'FOREIGN KEY' && item.referencedObject)
      .flatMap(item => item.columns.map((column, index) => ({
        column,
        targetTable: item.referencedObject,
        targetColumn: item.referencedColumns[index],
      })))
      .filter(item => item.column && item.targetTable && item.targetColumn);
    const fallbackForeignKeys = parseForeignKeys(createSql);
    const ddl = ddlIdentity(type, createSql);
    schema.set(expectation.name, {
      type,
      ...ddl,
      columns,
      constraints,
      uniqueIndexes,
      foreignKeys: foreignKeys.length ? foreignKeys : fallbackForeignKeys,
      ddlHash: ddl.rawDdlHash,
      columnsHash: sha256(JSON.stringify(columnRows)),
      indexesHash: sha256(JSON.stringify(indexRows || [])),
      constraintsHash: sha256(JSON.stringify({ constraintRows, constraintColumnRows })),
    });
    return true;
  }

  function assertStructuralExpectations() {
    for (const spec of absentColumns || []) {
      const objectName = normalizeIdentifier(spec?.object);
      const columnName = normalizeIdentifier(spec?.name);
      if (!schema.has(objectName)) throw guardError('schema_guard_absent_column_object_unverified', objectName);
      if (schema.get(objectName).columns.has(columnName)) {
        throw guardError('schema_guard_forbidden_column_present', `${objectName}.${columnName}`);
      }
    }
    for (const spec of requiredConstraints || []) {
      const objectName = normalizeIdentifier(spec?.object);
      const constraintName = normalizeIdentifier(spec?.name);
      const proof = schema.get(objectName)?.constraints.get(constraintName);
      if (!proof) throw guardError('schema_guard_required_constraint_missing', `${objectName}.${constraintName}`);
      const expectedType = String(spec?.type || '').trim().replace(/_/g, ' ').toUpperCase();
      if (expectedType && proof.type !== expectedType) {
        throw guardError('schema_guard_constraint_type_mismatch', `${objectName}.${constraintName}:${proof.type}`);
      }
      const expectedColumns = (spec?.columns || []).map(normalizeIdentifier);
      if (expectedColumns.length && JSON.stringify(proof.columns) !== JSON.stringify(expectedColumns)) {
        throw guardError('schema_guard_constraint_columns_mismatch', `${objectName}.${constraintName}`);
      }
      const expectedReference = normalizeIdentifier(spec?.referencedObject);
      if (expectedReference && proof.referencedObject !== expectedReference) {
        throw guardError('schema_guard_constraint_reference_mismatch', `${objectName}.${constraintName}`);
      }
      const expectedReferenceColumns = (spec?.referencedColumns || []).map(normalizeIdentifier);
      if (expectedReferenceColumns.length && JSON.stringify(proof.referencedColumns) !== JSON.stringify(expectedReferenceColumns)) {
        throw guardError('schema_guard_constraint_reference_columns_mismatch', `${objectName}.${constraintName}`);
      }
      if (proof.type === 'FOREIGN KEY') {
        const referencedProof = schema.get(proof.referencedObject);
        if (!referencedProof) {
          throw guardError('schema_guard_constraint_reference_object_unverified', `${objectName}.${constraintName}:${proof.referencedObject}`);
        }
        if (proof.columns.length !== proof.referencedColumns.length || !proof.columns.length) {
          throw guardError('schema_guard_constraint_reference_shape_invalid', `${objectName}.${constraintName}`);
        }
        proof.columns.forEach((sourceColumn, index) => {
          const targetColumn = proof.referencedColumns[index];
          const sourceColumnProof = schema.get(objectName)?.columns.get(sourceColumn);
          const targetColumnProof = referencedProof.columns.get(targetColumn);
          if (!sourceColumnProof) throw guardError('schema_guard_constraint_column_wrong_owner', `${objectName}.${sourceColumn}`);
          if (!targetColumnProof) throw guardError('schema_guard_constraint_reference_column_wrong_owner', `${proof.referencedObject}.${targetColumn}`);
          if (normalizeIdentifier(sourceColumnProof.type) !== normalizeIdentifier(targetColumnProof.type)) {
            throw guardError(
              'schema_guard_constraint_column_type_mismatch',
              `${objectName}.${sourceColumn}/${proof.referencedObject}.${targetColumn}`
            );
          }
          if (
            sourceColumnProof.collation &&
            targetColumnProof.collation &&
            sourceColumnProof.collation !== targetColumnProof.collation
          ) {
            throw guardError(
              'schema_guard_constraint_column_collation_mismatch',
              `${objectName}.${sourceColumn}/${proof.referencedObject}.${targetColumn}`
            );
          }
        });
      }
    }
    for (const spec of requiredRelationships || []) {
      const source = {
        table: normalizeIdentifier(spec?.fromObject),
        column: normalizeIdentifier(spec?.fromColumn),
      };
      const target = {
        table: normalizeIdentifier(spec?.toObject),
        column: normalizeIdentifier(spec?.toColumn),
      };
      assertColumn(source.table, source.column);
      assertColumn(target.table, target.column);
      if (!relationshipIsProven(source, target)) {
        throw guardError(
          'schema_guard_required_relationship_missing',
          `${source.table}.${source.column}/${target.table}.${target.column}`
        );
      }
      assertJoinCollation(source, target);
      const sourceType = normalizeIdentifier(schema.get(source.table).columns.get(source.column).type);
      const targetType = normalizeIdentifier(schema.get(target.table).columns.get(target.column).type);
      if (sourceType !== targetType) {
        throw guardError(
          'schema_guard_required_relationship_type_mismatch',
          `${source.table}.${source.column}/${target.table}.${target.column}`
        );
      }
    }
  }

  async function preflight() {
    if (preflightComplete) throw guardError('schema_guard_preflight_already_complete');
    const [identityRows] = await metadataQuery(IDENTITY_SQL);
    const row = Array.isArray(identityRows) ? identityRows[0] : null;
    identity = {
      database: nativeValue(row, 'DATABASE()') || null,
      host: nativeValue(row, '@@hostname') || null,
      port: Number(nativeValue(row, '@@port') || 0) || null,
      currentUser: nativeValue(row, 'CURRENT_USER()') || null,
      version: nativeValue(row, 'VERSION()') || null,
      configuredTarget: {
        host: configuredHost,
        user: configuredUser,
        database: configuredDatabase,
        port: Number(configuredPort),
      },
    };
    if (configuredDatabase !== expectedDatabase) throw guardError('schema_guard_wrong_configured_database', `${configuredDatabase} != ${expectedDatabase}`);
    if (configuredHost !== expectedHost) throw guardError('schema_guard_wrong_configured_host', `${configuredHost} != ${expectedHost}`);
    if (configuredUser !== expectedUser) throw guardError('schema_guard_wrong_configured_user', `${configuredUser} != ${expectedUser}`);
    if (identity.database !== expectedDatabase) throw guardError('schema_guard_wrong_database', `${identity.database || 'null'} != ${expectedDatabase}`);
    if (identity.host !== expectedDatabaseHostname) throw guardError('schema_guard_wrong_database_hostname', `${identity.host || 'null'} != ${expectedDatabaseHostname}`);
    if (identity.port !== Number(expectedPort)) throw guardError('schema_guard_wrong_database_port', `${identity.port || 'null'} != ${expectedPort}`);
    if (identity.currentUser !== expectedPrincipal) throw guardError('schema_guard_wrong_database_principal', `${identity.currentUser || 'null'} != ${expectedPrincipal}`);
    if (!identity.host || !identity.currentUser || !identity.port || !identity.version) throw guardError('schema_guard_database_identity_incomplete');
    const currentAccount = String(identity.currentUser).split('@')[0].replace(/^['`"]|['`"]$/g, '');
    if (currentAccount !== expectedUser) throw guardError('schema_guard_wrong_database_user', `${currentAccount || 'null'} != ${expectedUser}`);
    if (String(identity.version) !== expectedVersion) {
      throw guardError('schema_guard_database_engine_unverified', `${identity.version}:${expectedVersion}`);
    }

    for (const expectation of allExpectedObjects) await discoverObject(expectation);
    for (const name of expectedAbsentObjects) {
      const found = await discoverObject({ name, type: null, required: false });
      if (found) throw guardError('schema_guard_forbidden_object_present', name);
      optionalAbsentObjects.delete(name);
      provenAbsentObjects.add(name);
    }
    assertStructuralExpectations();
    for (const alias of new Set([...allowedOutputAliases, ...allowedTableAliases])) await proveAlias(alias);
    preflightComplete = true;
    return evidence();
  }

  async function execute(sql, params = []) {
    const proof = validateStatement(sql, params);
    const statementType = String(sql || '').trim().split(/\s+/u)[0].toUpperCase();
    if (onBeforeStatementExecute) {
      onBeforeStatementExecute({
        statementType,
        mutating: ['INSERT', 'UPDATE', 'DELETE'].includes(statementType),
        tables: proof?.tables || [],
      });
    }
    verifiedStatementCount += 1;
    verifiedStatements.push({
      sequence: verifiedStatementCount,
      sqlHash: cryptoModule.createHash('sha256').update(String(sql).trim()).digest('hex'),
      tables: proof?.tables || [],
      functions: proof?.functions || [],
    });
    const control = String(sql || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (['START TRANSACTION', 'COMMIT', 'ROLLBACK'].includes(control)) {
      return connection.query(String(sql).trim());
    }
    return connection.execute(sql, params);
  }

  function assertPreflightComplete() {
    if (!preflightComplete) throw guardError('schema_guard_preflight_incomplete');
  }

  function objectExists(name, type = null) {
    assertPreflightComplete();
    const normalizedName = normalizeIdentifier(name);
    const expectation = allExpectedObjects.find(item => item.name === normalizedName);
    if (!expectation) throw guardError('schema_guard_object_not_declared', normalizedName);
    const actualType = discoveredObjects.get(normalizedName) || null;
    if (type && actualType && actualType !== String(type).toLowerCase()) {
      throw guardError('schema_guard_object_type_mismatch', `${normalizedName}:${actualType}`);
    }
    return Boolean(actualType);
  }

  function getObjectProof(name) {
    assertPreflightComplete();
    const normalizedName = normalizeIdentifier(name);
    const proof = schema.get(normalizedName);
    if (!proof) return null;
    return {
      name: normalizedName,
      type: proof.type,
      columns: Array.from(proof.columns.entries()).map(([column, value]) => ({
        name: column,
        type: value.type,
        collation: value.collation,
        allowedValues: value.allowedValues ? Array.from(value.allowedValues) : null,
        nullable: value.nullable,
        defaultValue: value.defaultValue,
        extra: value.extra,
      })),
      uniqueIndexes: Object.fromEntries(Array.from(proof.uniqueIndexes.entries()).map(([name, columns]) => [name, [...columns]])),
      constraints: Array.from(proof.constraints.values()).map(item => ({
        ...item,
        columns: [...item.columns],
        referencedColumns: [...item.referencedColumns],
      })),
      rawDdl: proof.rawDdl,
      rawDdlHash: proof.rawDdlHash,
      ddlHash: proof.ddlHash,
      structuralDdlHash: proof.structuralDdlHash,
      volatileDdlOptions: proof.volatileDdlOptions.map(option => ({ ...option })),
      columnsHash: proof.columnsHash,
      indexesHash: proof.indexesHash,
      constraintsHash: proof.constraintsHash,
    };
  }

  function createGuardedConnection() {
    return Object.freeze({
      query(sql, params = []) {
        if (metadataStatementKind(sql)) return metadataQuery(sql, params);
        return execute(sql, params);
      },
      execute(sql, params = []) {
        if (metadataStatementKind(sql)) return metadataQuery(sql, params);
        return execute(sql, params);
      },
      beginTransaction() {
        return execute('START TRANSACTION');
      },
      commit() {
        return execute('COMMIT');
      },
      rollback() {
        return execute('ROLLBACK');
      },
    });
  }

  function evidence() {
    return {
      identity: identity ? { ...identity } : null,
      objects: Object.fromEntries(Array.from(schema.entries()).map(([name, proof]) => [name, {
        type: proof.type,
        rawDdl: proof.rawDdl,
        rawDdlHash: proof.rawDdlHash,
        ddlHash: proof.ddlHash,
        structuralDdlHash: proof.structuralDdlHash,
        volatileDdlOptions: proof.volatileDdlOptions.map(option => ({ ...option })),
        columnsHash: proof.columnsHash,
        indexesHash: proof.indexesHash,
        constraintsHash: proof.constraintsHash,
        columnCount: proof.columns.size,
        constraintCount: proof.constraints.size,
        uniqueIndexCount: proof.uniqueIndexes.size,
      }])),
      ddlHashes: Object.fromEntries(Array.from(schema.entries()).map(([name, proof]) => [name, proof.ddlHash])),
      structuralDdlHashes: Object.fromEntries(
        Array.from(schema.entries()).map(([name, proof]) => [name, proof.structuralDdlHash])
      ),
      optionalAbsentObjects: Array.from(optionalAbsentObjects).sort(),
      absentObjects: Array.from(provenAbsentObjects).sort(),
      verifiedStatementCount,
      verifiedStatements: verifiedStatements.map(statement => ({ ...statement })),
      verifiedFunctions: Array.from(verifiedFunctions).sort(),
      preflightComplete,
    };
  }

  return {
    createGuardedConnection,
    execute,
    evidence,
    getObjectProof,
    metadataQuery,
    objectExists,
    preflight,
    validateStatement,
  };
}

module.exports = { createLiveMysqlSchemaGuard };
